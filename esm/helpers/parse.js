/**
 * Parse useful entities
 */

/**
 * @private
 */
const REGEX_MARKER = /^(?:chr)?([a-zA-Z0-9]+?)[_:-](\d+)[_:|-]?(\w+)?[/_:|-]?([^_]+)?_?(.*)?/;

/**
 * Parse a single marker, cleaning up values as necessary
 * @private
 * @param {String} value
 * @param {boolean} test If called in testing mode, do not throw an exception
 * @returns {Array} chr, pos, ref, alt (if match found; ref and alt optional)
 */
function parseMarker(value, test = false) {
    const match = value && value.match(REGEX_MARKER);
    if (match) {
        return match.slice(1);
    }
    if (!test) {
        throw new Error(`Could not understand marker format for ${value}. Should be of format chr:pos or chr:pos_ref/alt`);
    } else {
        return null;
    }
}

/**
 * Normalize a provided variant string into the EPACTS-style `chrom:pos_ref/alt` format expected by LocusZoom and the Michigan LD Server
 *   This allows harmonizing various input data to a consistent format
 * @private
 * @param {String} variant A string that specifies variant information in one of several common formats (like chr1:99_A/C, 1-99-A-C, 1:99:A:C, etc)
 */
function normalizeMarker(variant) {
    const match = parseMarker(variant);
    if (!match) {
        throw new Error(`Unable to normalize marker format for variant: ${variant}`);
    }
    const [chrom, pos, ref, alt] = match;
    let normalized = `${chrom}:${pos}`;
    if (ref && alt) {
        normalized += `_${ref}/${alt}`;
    }
    return normalized;
}


export {
    parseMarker,
    normalizeMarker,
};
