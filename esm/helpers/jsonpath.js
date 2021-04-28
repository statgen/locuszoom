/**
 * Simplified JSONPath implementation
 *
 * This is designed to make it easier to modify part of a LocusZoom layout, using a syntax based on intent
 *   ("modify association panels") rather than hard-coded assumptions ("modify the first button, and gosh I hope the order doesn't change")
 *
 * This DOES NOT support the full JSONPath specification. Notable limitations:
 * - Arrays can only be indexed by filter expression, not by number (can't ask for "array item 1")
 * - Filter expressions support only exact match, `field === value`. There is no support for "and" statements or
 *  arbitrary JS expressions beyond a single exact comparison. (the parser may be improved in the future if use cases emerge)
 */

const ATTR_REGEX = /^(\*|[\w]+)/; // attribute names can be wildcard or valid variable names
const EXPR_REGEX = /^\[\?\(@((?:\.[\w]+)+) *===? *([0-9.eE-]+|"[^"]*"|'[^']*')\)\]/;  // Arrays can be indexed using filter expressions like `[?(@.id === value)]` where value is a number or a single-or-double quoted string

function get_next_token(q) {
    // This just grabs everything that looks good.
    // The caller should check that the remaining query is valid.
    if (q.substr(0, 2) === '..') {
        if (q[2] === '[') {
            return {
                text: '..',
                attr: '*',
                depth: '..',
            };
        }
        const m = ATTR_REGEX.exec(q.substr(2));
        if (!m) {
            throw `Cannot parse ${JSON.stringify(q)} as dotdot_attr.`;
        }
        return {
            text: `..${m[0]}`,
            attr: m[1],
            depth: '..',
        };
    } else if (q[0] === '.') {
        const m = ATTR_REGEX.exec(q.substr(1));
        if (!m) {
            throw `Cannot parse ${JSON.stringify(q)} as dot_attr.`;
        }
        return {
            text: `.${m[0]}`,
            attr: m[1],
            depth: '.',
        };
    } else if (q[0] === '[') {
        const m = EXPR_REGEX.exec(q);
        if (!m) {
            throw `Cannot parse ${JSON.stringify(q)} as expr.`;
        }
        let value;
        try {
            // Parse strings and numbers
            value = JSON.parse(m[2]);
        } catch (e) {
            // Handle single-quoted strings
            value = JSON.parse(m[2].replace(/^'|'$/g, '"'));
        }

        return {
            text: m[0],
            attrs: m[1].substr(1).split('.'),
            value: value,
        };
    } else {
        throw `The query ${JSON.stringify(q)} doesn't look valid.`;
    }
}

function normalize_query(q) {
    // Normalize the start of the query so that it's just a bunch of selectors one-after-another.
    // Otherwise the first selector is a little different than the others.
    if (!q) {
        return '';
    }
    if (!['$', '['].includes(q[0])) {
        q = `$.${  q}`;
    } // It starts with a dotless attr, so prepend the implied `$.`.
    if (q[0] === '$') {
        q = q.substr(1);
    }  // strip the leading $
    return q;
}

function tokenize (q) {
    q = normalize_query(q);
    let selectors = [];
    while (q.length) {
        const selector = get_next_token(q);
        q = q.substr(selector.text.length);
        selectors.push(selector);
    }
    return selectors;
}

function get_elements_from_selectors (data, selectors, item_callback) {
    item_callback = item_callback || ((parent, key) => parent[key]);

    // This returns a list of matching elements
    if (!selectors.length) {
        return [data];
    }
    const sel = selectors[0];
    const remaining_selectors = selectors.slice(1);
    let ret = [];

    if (sel.attr && sel.depth === '.' && sel.attr !== '*') { // .attr
        const d = data[sel.attr];
        if (selectors.length === 1) {
            if (d !== undefined) {
                ret.push(item_callback(data, sel.attr));
            }
        } else {
            ret.push(...get_elements_from_selectors(d, remaining_selectors, item_callback));
        }
    } else if (sel.attr && sel.depth === '.' && sel.attr === '*') { // .*
        for (let d of Object.values(data)) {
            ret.push(...get_elements_from_selectors(d, remaining_selectors, item_callback));
        }
    } else if (sel.attr && sel.depth === '..') { // ..
        // If `sel.attr` matches, recurse with that match.
        // And also recurse on every value using unchanged selectors.
        // I bet `..*..*` duplicates results, so don't do it please.
        if (typeof data === 'object' && data !== null) {
            if (sel.attr !== '*' && sel.attr in data) { // Exact match!
                // The .. could be in the middle of a selector string, so we may or may not be returning a result immediately
                if (!remaining_selectors.length) {
                    // If we are mutating the value, we need access to both parent and field: run the (maybe mutation) callback before we recurse
                    item_callback(data, sel.attr);
                }
                ret.push(...get_elements_from_selectors(data[sel.attr], remaining_selectors, item_callback));
            }
            for (let d of Object.values(data)) {
                ret.push(...get_elements_from_selectors(d, selectors, item_callback)); // No match, just recurse
                if (sel.attr === '*') { // Wildcard match
                    ret.push(...get_elements_from_selectors(d, remaining_selectors, item_callback));
                }
            }
        }
    } else if (sel.attrs) { // [?(@.attr===value)]
        for (let d of Object.values(data)) {
            let subject = d;
            for (let a of sel.attrs) {
                subject = subject[a];
            }
            if (subject === sel.value) {
                ret.push(...get_elements_from_selectors(d, remaining_selectors, item_callback));
            }
        }
    }
    return ret;
}

/**
 *
 * @param {object} data The data object to query
 * @param {string} query A JSONPath-compliant query string
  * @param {function} [item_callback] A function that will be called on every matching leaf node (eg, the last item when resolving the selector): `(parent, key) => item_value`
 *  This is used internally to implement query (get value) and mutations (change value).
 *  By default, simply returns the desired value (key from a data object).
 * @returns {Array}
 */
function query (data, query, item_callback) {
    const selectors = tokenize(query);
    return get_elements_from_selectors(data, selectors, item_callback);
}

export { query };
