/**
 * Helpers that control the display of individual points and field values
 * @module
 * @private
 */
import * as d3 from 'd3';

import Field from '../data/field';
import Plot from '../components/plot';
import {applyStyles} from './common';


/**
 * Convert an integer chromosome position to an SI string representation (e.g. 23423456 => "23.42" (Mb))
 * @param {Number} pos Position
 * @param {Number} [exp] Exponent to use for the returned string, eg 6=> MB. If not specified, will attempt to guess
 *   the most appropriate SI prefix based on the number provided.
 * @param {Boolean} [suffix=false] Whether or not to append a suffix (e.g. "Mb") to the end of the returned string
 * @returns {string}
 */
function positionIntToString(pos, exp, suffix) {
    const exp_symbols = { 0: '', 3: 'K', 6: 'M', 9: 'G' };
    suffix = suffix || false;
    if (isNaN(exp) || exp === null) {
        const log = Math.log(pos) / Math.LN10;
        exp = Math.min(Math.max(log - (log % 3), 0), 9);
    }
    const places_exp = exp - Math.floor((Math.log(pos) / Math.LN10).toFixed(exp + 3));
    const min_exp = Math.min(Math.max(exp, 0), 2);
    const places = Math.min(Math.max(places_exp, min_exp), 12);
    let ret = `${(pos / Math.pow(10, exp)).toFixed(places)}`;
    if (suffix && typeof exp_symbols[exp] !== 'undefined') {
        ret += ` ${exp_symbols[exp]}b`;
    }
    return ret;
}

/**
 * Convert an SI string chromosome position to an integer representation (e.g. "5.8 Mb" => 58000000)
 * @param {String} p The chromosome position
 * @returns {Number}
 */
function positionStringToInt(p) {
    let val = p.toUpperCase();
    val = val.replace(/,/g, '');
    const suffixre = /([KMG])[B]*$/;
    const suffix = suffixre.exec(val);
    let mult = 1;
    if (suffix) {
        if (suffix[1] === 'M') {
            mult = 1e6;
        } else if (suffix[1] === 'G') {
            mult = 1e9;
        } else {
            mult = 1e3; //K
        }
        val = val.replace(suffixre, '');
    }
    val = Number(val) * mult;
    return val;
}

/**
 * Generate a "pretty" set of ticks (multiples of 1, 2, or 5 on the same order of magnitude for the range)
 *   Based on R's "pretty" function: https://github.com/wch/r-source/blob/b156e3a711967f58131e23c1b1dc1ea90e2f0c43/src/appl/pretty.c
 * @param {Number[]} range A two-item array specifying [low, high] values for the axis range
 * @param {('low'|'high'|'both'|'neither')} [clip_range='neither'] What to do if first and last generated ticks extend
 *   beyond the range. Set this to "low", "high", "both", or "neither" to clip the first (low) or last (high) tick to
 *   be inside the range or allow them to extend beyond.
 *   e.g. "low" will clip the first (low) tick if it extends beyond the low end of the range but allow the
 *  last (high) tick to extend beyond the range. "both" clips both ends, "neither" allows both to extend beyond.
 * @param {Number} [target_tick_count=5] The approximate number of ticks you would like to be returned; may not be exact
 * @returns {Number[]}
 */
function prettyTicks(range, clip_range, target_tick_count) {
    if (typeof target_tick_count == 'undefined' || isNaN(parseInt(target_tick_count))) {
        target_tick_count = 5;
    }
    target_tick_count = +target_tick_count;

    const min_n = target_tick_count / 3;
    const shrink_sml = 0.75;
    const high_u_bias = 1.5;
    const u5_bias = 0.5 + 1.5 * high_u_bias;

    const d = Math.abs(range[0] - range[1]);
    let c = d / target_tick_count;
    if ((Math.log(d) / Math.LN10) < -2) {
        c = (Math.max(Math.abs(d)) * shrink_sml) / min_n;
    }

    const base = Math.pow(10, Math.floor(Math.log(c) / Math.LN10));
    let base_toFixed = 0;
    if (base < 1 && base !== 0) {
        base_toFixed = Math.abs(Math.round(Math.log(base) / Math.LN10));
    }

    let unit = base;
    if ( ((2 * base) - c) < (high_u_bias * (c - unit)) ) {
        unit = 2 * base;
        if ( ((5 * base) - c) < (u5_bias * (c - unit)) ) {
            unit = 5 * base;
            if ( ((10 * base) - c) < (high_u_bias * (c - unit)) ) {
                unit = 10 * base;
            }
        }
    }

    let ticks = [];
    let i = parseFloat((Math.floor(range[0] / unit) * unit).toFixed(base_toFixed));
    while (i < range[1]) {
        ticks.push(i);
        i += unit;
        if (base_toFixed > 0) {
            i = parseFloat(i.toFixed(base_toFixed));
        }
    }
    ticks.push(i);

    if (typeof clip_range == 'undefined' || ['low', 'high', 'both', 'neither'].indexOf(clip_range) === -1) {
        clip_range = 'neither';
    }
    if (clip_range === 'low' || clip_range === 'both') {
        if (ticks[0] < range[0]) {
            ticks = ticks.slice(1);
        }
    }
    if (clip_range === 'high' || clip_range === 'both') {
        if (ticks[ticks.length - 1] > range[1]) {
            ticks.pop();
        }
    }

    return ticks;
}

/**
 * Replace placeholders in an html string with field values defined in a data object
 *  Only works on scalar values in data! Will ignore non-scalars. This is useful in, eg, tooltip templates.
 *
 *  NOTE: Trusts content exactly as given. XSS prevention is the responsibility of the implementer.
 * @param {Object} data
 * @param {String} html A placeholder string in which to substitute fields. Supports several template options:
 *   `{{field_name}}` is a variable placeholder for the value of `field_name` from the provided data
 *   `{{#if field_name}} Conditional text {{/if}}` will insert the contents of the tag only if the value exists.
 *     Since this is only an existence check, **variables with a value of 0 will be evaluated as true**.
 *     This can be used with namespaced values, `{{#if assoc:field}}`; any dynamic namespacing will be applied when the
 *     layout is first retrieved.
 * @returns {string}
 */
function parseFields(data, html) {
    if (typeof data != 'object') {
        throw new Error('invalid arguments: data is not an object');
    }
    if (typeof html != 'string') {
        throw new Error('invalid arguments: html is not a string');
    }
    // `tokens` is like [token,...]
    // `token` is like {text: '...'} or {variable: 'foo|bar'} or {condition: 'foo|bar'} or {close: 'if'}
    const tokens = [];
    const regex = /{{(?:(#if )?([A-Za-z0-9_:|]+)|(#else)|(\/if))}}/;
    while (html.length > 0) {
        const m = regex.exec(html);
        if (!m) {
            tokens.push({text: html});
            html = '';
        } else if (m.index !== 0) {
            tokens.push({text: html.slice(0, m.index)});
            html = html.slice(m.index);
        } else if (m[1] === '#if ') {
            tokens.push({condition: m[2]});
            html = html.slice(m[0].length);
        } else if (m[2]) {
            tokens.push({variable: m[2]});
            html = html.slice(m[0].length);
        } else if (m[3] === '#else') {
            tokens.push({branch: 'else'});
            html = html.slice(m[0].length);
        } else if (m[4] === '/if') {
            tokens.push({close: 'if'});
            html = html.slice(m[0].length);
        } else {
            console.error(`Error tokenizing tooltip when remaining template is ${JSON.stringify(html)} and previous tokens are ${JSON.stringify(tokens)} and current regex match is ${JSON.stringify([m[1], m[2], m[3]])}`);
            html = html.slice(m[0].length);
        }
    }
    const astify = function () {
        const token = tokens.shift();
        if (typeof token.text !== 'undefined' || token.variable) {
            return token;
        } else if (token.condition) {
            let dest = token.then = [];
            token.else = [];
            // Inside an if block, consume all tokens related to text and/or else block
            while (tokens.length > 0) {
                if (tokens[0].close === 'if') {
                    tokens.shift();
                    break;
                }
                if (tokens[0].branch === 'else') {
                    tokens.shift();
                    dest = token.else;
                }
                dest.push(astify());
            }
            return token;
        } else {
            console.error(`Error making tooltip AST due to unknown token ${JSON.stringify(token)}`);
            return { text: '' };
        }
    };
    // `ast` is like [thing,...]
    // `thing` is like {text: "..."} or {variable:"foo|bar"} or {condition: "foo|bar", then:[thing,...]}
    const ast = [];
    while (tokens.length > 0) {
        ast.push(astify());
    }

    const resolve = function (variable) {
        if (!Object.prototype.hasOwnProperty.call(resolve.cache, variable)) {
            resolve.cache[variable] = (new Field(variable)).resolve(data);
        }
        return resolve.cache[variable];
    };
    resolve.cache = {};
    const render_node = function (node) {
        if (typeof node.text !== 'undefined') {
            return node.text;
        } else if (node.variable) {
            try {
                const value = resolve(node.variable);
                if (['string', 'number', 'boolean'].indexOf(typeof value) !== -1) {
                    return value;
                }
                if (value === null) {
                    return '';
                }
            } catch (error) {
                console.error(`Error while processing variable ${JSON.stringify(node.variable)}`);
            }
            return `{{${node.variable}}}`;
        } else if (node.condition) {
            try {
                const condition = resolve(node.condition);
                if (condition || condition === 0) {
                    return node.then.map(render_node).join('');
                } else if (node.else) {
                    return node.else.map(render_node).join('');
                }
            } catch (error) {
                console.error(`Error while processing condition ${JSON.stringify(node.variable)}`);
            }
            return '';
        } else {
            console.error(`Error rendering tooltip due to unknown AST node ${JSON.stringify(node)}`);
        }
    };
    return ast.map(render_node).join('');
}

/**
 * Populate a single element with a LocusZoom plot. This is the primary means of generating a new plot, and is part
 *  of the public interface for LocusZoom.
 * @alias module:LocusZoom~populate
 * @public
 * @param {String|d3.selection} selector CSS selector for the container element where the plot will be mounted. Any pre-existing
 *   content in the container will be completely replaced.
 * @param {module:LocusZoom~DataSources} datasource Ensemble of data providers used by the plot
 * @param {Object} layout A JSON-serializable object of layout configuration parameters
 * @returns {Plot} The newly created plot instance
 */
function populate(selector, datasource, layout) {
    if (typeof selector == 'undefined') {
        throw new Error('LocusZoom.populate selector not defined');
    }
    // Empty the selector of any existing content
    d3.select(selector).html('');
    let plot;
    d3.select(selector).call(function(target) {
        // Require each containing element have an ID. If one isn't present, create one.
        if (typeof target.node().id == 'undefined') {
            let iterator = 0;
            while (!d3.select(`#lz-${iterator}`).empty()) {
                iterator++;
            }
            target.attr('id', `#lz-${iterator}`);
        }
        // Create the plot
        plot = new Plot(target.node().id, datasource, layout);
        plot.container = target.node();
        // Detect HTML `data-region` attribute, and use it to fill in state values if present
        if (typeof target.node().dataset !== 'undefined' && typeof target.node().dataset.region !== 'undefined') {
            const parsed_state = parsePositionQuery(target.node().dataset.region);
            Object.keys(parsed_state).forEach(function(key) {
                plot.state[key] = parsed_state[key];
            });
        }
        // Add an SVG to the div and set its dimensions
        plot.svg = d3.select(`div#${plot.id}`)
            .append('svg')
            .attr('version', '1.1')
            .attr('xmlns', 'http://www.w3.org/2000/svg')
            .attr('id', `${plot.id}_svg`)
            .attr('class', 'lz-locuszoom')
            .call(applyStyles, plot.layout.style);

        plot.setDimensions();
        plot.positionPanels();
        // Initialize the plot
        plot.initialize();
        // If the plot has defined data sources then trigger its first mapping based on state values
        if (datasource) {
            plot.refresh();
        }
    });
    return plot;
}

/**
 * Parse region queries into their constituent parts
 * @param {String} x A chromosome position query. May be any of the forms `chr:start-end`, `chr:center+offset`,
 *   or `chr:pos`
 * @returns {{chr:*, start: *, end:*} | {chr:*, position:*}}
 */
function parsePositionQuery(x) {
    const chrposoff = /^(\w+):([\d,.]+[kmgbKMGB]*)([-+])([\d,.]+[kmgbKMGB]*)$/;
    const chrpos = /^(\w+):([\d,.]+[kmgbKMGB]*)$/;
    let match = chrposoff.exec(x);
    if (match) {
        if (match[3] === '+') {
            const center = positionStringToInt(match[2]);
            const offset = positionStringToInt(match[4]);
            return {
                chr:match[1],
                start: center - offset,
                end: center + offset,
            };
        } else {
            return {
                chr: match[1],
                start: positionStringToInt(match[2]),
                end: positionStringToInt(match[4]),
            };
        }
    }
    match = chrpos.exec(x);
    if (match) {
        return {
            chr:match[1],
            position: positionStringToInt(match[2]),
        };
    }
    return null;
}

export { parseFields, parsePositionQuery, populate, positionIntToString, positionStringToInt, prettyTicks };
