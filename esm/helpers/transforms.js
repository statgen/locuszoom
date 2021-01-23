/**
 * Transformation functions: used to transform a raw value from the API. For example, a template or axis label
 *  can convert from pvalue to -log10pvalue
 * @module LocusZoom_TransformationFunctions
 */

/**
 * Return the log10 of a value. Can be composed for, eg, loglog plots.
 * @param value
 * @return {null|number}
 */
export function log10 (value) {
    if (isNaN(value) || value <= 0) {
        return null;
    }
    return Math.log(value) / Math.LN10;
}

/**
 * Return the -log (base 10), a common means of representing pvalues in locuszoom plots
 * @param value
 * @return {number}
 */
export function neglog10 (value) {
    if (isNaN(value) || value <= 0) {
        return null;
    }
    return -Math.log(value) / Math.LN10;
}

/**
 * Convert a number from logarithm to scientific notation. Useful for, eg, a datasource that returns -log(p) by default
 * @param value
 * @return {string}
 */
export function logtoscinotation (value) {
    if (isNaN(value)) {
        return 'NaN';
    }
    if (value === 0) {
        return '1';
    }
    const exp = Math.ceil(value);
    const diff = exp - value;
    const base = Math.pow(10, diff);
    if (exp === 1) {
        return (base / 10).toFixed(4);
    } else if (exp === 2) {
        return (base / 100).toFixed(3);
    } else {
        return `${base.toFixed(2)} × 10^-${exp}`;
    }
}

/**
 * Represent a number in scientific notation
 * @param {Number} value
 * @returns {String}
 */
export function scinotation (value) {
    if (isNaN(value)) {
        return 'NaN';
    }
    if (value === 0) {
        return '0';
    }

    const abs = Math.abs(value);
    let log;
    if (abs > 1) {
        log = Math.ceil(Math.log(abs) / Math.LN10);
    } else {  // 0...1
        log = Math.floor(Math.log(abs) / Math.LN10);
    }
    if (Math.abs(log) <= 3) {
        return value.toFixed(3);
    } else {
        return value.toExponential(2).replace('+', '').replace('e', ' × 10^');
    }
}

/**
 * HTML-escape user entered values for use in constructed HTML fragments
 *
 * For example, this filter can be used on tooltips with custom HTML display
 * @param {String} value HTML-escape the provided value
 * @return {string}
 */
export function htmlescape (value) {
    if (!value) {
        return '';
    }
    value = `${value}`;

    return value.replace(/['"<>&`]/g, function (s) {
        switch (s) {
        case "'":
            return '&#039;';
        case '"':
            return '&quot;';
        case '<':
            return '&lt;';
        case '>':
            return '&gt;';
        case '&':
            return '&amp;';
        case '`':
            return '&#x60;';
        }
    });
}

/**
 * URL-encode the provided text, eg for constructing hyperlinks
 * @param {String} value
 * @return {string}
 */
export function urlencode (value) {
    return encodeURIComponent(value);
}
