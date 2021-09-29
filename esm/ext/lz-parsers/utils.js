/**
 * Constant values used by GWAS parser
 */

import { REGEX_MARKER } from '../../helpers/parse';

const MISSING_VALUES = new Set(['', '.', 'NA', 'N/A', 'n/a', 'nan', '-nan', 'NaN', '-NaN', 'null', 'NULL', 'None', null]);

const REGEX_PVAL = /([\d.-]+)([\sxeE]*)([0-9-]*)/;


/**
 * Utility helper that checks for the presence of a numeric value (incl 0),
 *  eg "has column specified"
 * @param num
 * @returns {boolean}
 */
function has(num) {
    return Number.isInteger(num);
}

/**
 * Convert all missing values to a standardized input form
 * Useful for columns like pvalue, where a missing value explicitly allowed
 */
function missingToNull(values, nulls = MISSING_VALUES, placeholder = null) {
    // TODO Make this operate on a single value; cache for efficiency?
    return values.map((v) => (nulls.has(v) ? placeholder : v));
}

/**
 * Parse (and validate) a given number, and return the -log10 pvalue.
 * @param value
 * @param {boolean} is_neg_log
 * @returns {number||null} The -log10 pvalue
 */
function parsePvalToLog(value, is_neg_log = false) {
    // TODO: In future, generalize this for other values prone to underflow
    if (value === null) {
        return value;
    }
    const val = +value;
    if (is_neg_log) { // Take as is
        return val;
    }
    // Regular pvalue: validate and convert
    if (val < 0 || val > 1) {
        throw new Error('p value is not in the allowed range');
    }
    //  0-values are explicitly allowed and will convert to infinity by design, as they often
    //    indicate underflow errors in the input data.
    if (val === 0) {
        // Determine whether underflow is due to the source data, or value conversion
        if (value === '0') {
            // The source data is bad, so insert an obvious placeholder value
            return Infinity;
        }
        // h/t @welchr: aggressively turn the underflowing string value into -log10 via regex
        // Only do this if absolutely necessary, because it is a performance hit

        let [, base, , exponent] = value.match(REGEX_PVAL);
        base = +base;

        if (exponent !== '') {
            exponent = +exponent;
        } else {
            exponent = 0;
        }
        if (base === 0) {
            return Infinity;
        }
        return -(Math.log10(+base) + +exponent);
    }
    return -Math.log10(val);
}

function parseAlleleFrequency({ freq, allele_count, n_samples, is_alt_effect = true }) {
    if (freq !== undefined && allele_count !== undefined) {
        throw new Error('Frequency and allele count options are mutually exclusive');
    }

    let result;
    if (freq === undefined && (MISSING_VALUES.has(allele_count) || MISSING_VALUES.has(n_samples))) {
        // Allele count parsing
        return null;
    }
    if (freq === undefined && allele_count !== undefined) {
        result = +allele_count / +n_samples / 2;
    } else if (MISSING_VALUES.has(freq)) { // Frequency-based parsing
        return null;
    } else {
        result = +freq;
    }

    // No matter how the frequency is specified, this stuff is always done
    if (result < 0 || result > 1) {
        throw new Error('Allele frequency is not in the allowed range');
    }
    if (!is_alt_effect) { // Orient the frequency to the alt allele
        return 1 - result;
    }
    return result;
}

export {
    MISSING_VALUES, REGEX_MARKER,
    missingToNull as _missingToNull,
    has,
    // Exports for unit testing
    parseAlleleFrequency,
    parsePvalToLog,
};
