/*
 * Transformation functions: used to transform a raw value from the API. For example, a template or axis label
 *  can convert from pvalue to -log10pvalue
 */

/**
 * Return the -log (base 10)
 * @function neglog10
 */
// LocusZoom.TransformationFunctions.add('neglog10', function(x) {
export const neglog10 = (value) => {
    if (isNaN(value) || value <= 0) {
        return null;
    }
    return -Math.log(value) / Math.LN10;
};
/**
 * Convert a number from logarithm to scientific notation. Useful for, eg, a datasource that returns -log(p) by default
 * @function logtoscinotation
 */
// LocusZoom.TransformationFunctions.add('logtoscinotation', function(x) {
export const logtoscinotation = (value) => {
    if (isNaN(value)) {
        return 'NaN';
    }
    if (value === 0) {
        return '1';
    }
    var exp = Math.ceil(value);
    var diff = exp - value;
    var base = Math.pow(10, diff);
    if (exp === 1) {
        return (base / 10).toFixed(4);
    } else if (exp === 2) {
        return (base / 100).toFixed(3);
    } else {
        return base.toFixed(2) + ' × 10^-' + exp;
    }
};
/**
 * Represent a number in scientific notation
 * @function scinotation
 * @param {Number} value
 * @returns {String}
 */
// LocusZoom.TransformationFunctions.add('scinotation', function(x) {
export const scinotation = (value) => {
    if (isNaN(value)) {
        return 'NaN';
    }
    if (value === 0) {
        return '0';
    }

    var abs = Math.abs(value);
    var log;
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
};
/**
 * HTML-escape user entered values for use in constructed HTML fragments
 *
 * For example, this filter can be used on tooltips with custom HTML display
 * @function htmlescape
 * @param {String} value HTML-escape the provided value
 */
export const htmlescape = (value) => {
    if (!value) {
        return '';
    }
    value = value + '';

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
};

/**
 * URL-encode the provided text, eg for constructing hyperlinks
 * @function urlencode
 * @param {String} str
 */
export const urlencode = function(value) {
    return encodeURIComponent(value);
};
