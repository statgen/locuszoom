/**
 * Convert an integer chromosome position to an SI string representation (e.g. 23423456 => "23.42" (Mb))
 * @param {Number} pos Position
 * @param {Number} [exp] Exponent to use for the returned string, eg 6=> MB. If not specified, will attempt to guess
 *   the most appropriate SI prefix based on the number provided.
 * @param {Boolean} [suffix=false] Whether or not to append a suffix (e.g. "Mb") to the end of the returned string
 * @returns {string}
 */
export function positionIntToString(pos, exp, suffix) {
    var exp_symbols = { 0: '', 3: 'K', 6: 'M', 9: 'G' };
    suffix = suffix || false;
    if (isNaN(exp) || exp === null) {
        var log = Math.log(pos) / Math.LN10;
        exp = Math.min(Math.max(log - (log % 3), 0), 9);
    }
    var places_exp = exp - Math.floor((Math.log(pos) / Math.LN10).toFixed(exp + 3));
    var min_exp = Math.min(Math.max(exp, 0), 2);
    var places = Math.min(Math.max(places_exp, min_exp), 12);
    var ret = '' + (pos / Math.pow(10, exp)).toFixed(places);
    if (suffix && typeof exp_symbols[exp] !== 'undefined') {
        ret += ' ' + exp_symbols[exp] + 'b';
    }
    return ret;
}

/**
 * Convert an SI string chromosome position to an integer representation (e.g. "5.8 Mb" => 58000000)
 * @param {String} p The chromosome position
 * @returns {Number}
 */
export function positionStringToInt(p) {
    var val = p.toUpperCase();
    val = val.replace(/,/g, '');
    var suffixre = /([KMG])[B]*$/;
    var suffix = suffixre.exec(val);
    var mult = 1;
    if (suffix) {
        if (suffix[1] === 'M') {
            mult = 1e6;
        } else if (suffix[1] === 'G') {
            mult = 1e9;
        } else {
            mult = 1e3; //K
        }
        val = val.replace(suffixre,'');
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
export function prettyTicks(range, clip_range, target_tick_count) {
    if (typeof target_tick_count == 'undefined' || isNaN(parseInt(target_tick_count))) {
        target_tick_count = 5;
    }
    target_tick_count = parseInt(target_tick_count);

    var min_n = target_tick_count / 3;
    var shrink_sml = 0.75;
    var high_u_bias = 1.5;
    var u5_bias = 0.5 + 1.5 * high_u_bias;

    var d = Math.abs(range[0] - range[1]);
    var c = d / target_tick_count;
    if ((Math.log(d) / Math.LN10) < -2) {
        c = (Math.max(Math.abs(d)) * shrink_sml) / min_n;
    }

    var base = Math.pow(10, Math.floor(Math.log(c) / Math.LN10));
    var base_toFixed = 0;
    if (base < 1 && base !== 0) {
        base_toFixed = Math.abs(Math.round(Math.log(base) / Math.LN10));
    }

    var unit = base;
    if ( ((2 * base) - c) < (high_u_bias * (c - unit)) ) {
        unit = 2 * base;
        if ( ((5 * base) - c) < (u5_bias * (c - unit)) ) {
            unit = 5 * base;
            if ( ((10 * base) - c) < (high_u_bias * (c - unit)) ) {
                unit = 10 * base;
            }
        }
    }

    var ticks = [];
    var i = parseFloat( (Math.floor(range[0] / unit) * unit).toFixed(base_toFixed) );
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
        if (ticks[0] < range[0]) { ticks = ticks.slice(1); }
    }
    if (clip_range === 'high' || clip_range === 'both') {
        if (ticks[ticks.length - 1] > range[1]) { ticks.pop(); }
    }

    return ticks;
}
