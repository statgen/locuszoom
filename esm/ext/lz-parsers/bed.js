/**
 * Parse BED-family files, which have 3-12 columns
 *   https://genome.ucsc.edu/FAQ/FAQformat.html#format1
 */

import {normalizeChr} from './utils';


function _bedMissing(value) {
    // BED files specify . as the missing/ null value character
    if (value === null || value === undefined || value === '.') {
        return null;
    }
    return value;
}

function _hasNum(value) {
    // Return a number, or null if value marked as missing
    value = _bedMissing(value);
    return value ? +value : null;
}

/**
 * Parse a BED file, according to the widely used UCSC (quasi-)specification
 *
 * NOTE: This original version is aimed at tabix region queries, and carries an implicit assumption that data is the
 *  only thing that will be parsed. It makes no attempt to identify or handle header rows / metadata fields.
 *
 * @function
 * @alias module:ext/lz-parsers~makeBed12Parser
 * @param {Boolean} normalize Whether to normalize the output to the format expected by LocusZoom (eg type coercion
 *  for numbers, removing chr chromosome prefixes, and using 1-based and inclusive coordinates instead of 0-based disjoint intervals)
 * @return function A configured parser function that runs on one line of text from an input file
 */
function makeBed12Parser({normalize = true} = {}) {
    /*
     * @param {String} line The line of text to be parsed
     */
    return (line) => {
        const tokens = line.trim().split('\t');
        // The BED file format has 12 standardized columns. 3 are required and 9 are optional. At present, we will not
        //  attempt to parse any remaining tokens, or nonstandard files that reuse columns with a different meaning.
        //   https://en.wikipedia.org/wiki/BED_(file_format)
        let [
            chrom,
            chromStart,
            chromEnd,
            name,
            score,
            strand,
            thickStart,
            thickEnd,
            itemRgb,
            blockCount,
            blockSizes,
            blockStarts,
        ] = tokens;

        if (!(chrom && chromStart && chromEnd)) {
            throw new Error('Sample data must provide all required BED columns');
        }

        strand = _bedMissing(strand);

        if (normalize) {
            // Mandatory fields
            chrom = normalizeChr(chrom);
            chromStart = +chromStart + 1;  // BED is 0 based start, but LZ plots start at 1
            chromEnd = +chromEnd; // 0-based positions, intervals exclude end position

            // Optional fields, require checking for blanks
            score = _hasNum(score);
            thickStart = _hasNum(thickStart);
            thickEnd = _hasNum(thickEnd);

            itemRgb = _bedMissing(itemRgb);

            // LocusZoom doesn't use these fields for rendering. Parsing below is theoretical/best-effort.
            blockCount = _hasNum(blockCount);

            blockSizes = _bedMissing(blockSizes);
            blockSizes = !blockSizes ? null : blockSizes.replace(/,$/, '').split(',').map((value) => +value); // Comma separated list of sizes -> array of integers

            blockStarts = _bedMissing(blockStarts);
            blockStarts = !blockStarts ? null : blockStarts.replace(/,$/, '').split(',').map((value) => +value + 1); // Comma separated list of sizes -> array of integers (start positions)

            if (blockSizes && blockStarts && blockCount && (blockSizes.length !== blockCount || blockStarts.length !== blockCount)) {
                throw new Error('Block size and start information should provide the same number of items as in blockCount');
            }
        }
        return {
            chrom,
            chromStart,
            chromEnd,
            name,
            score,
            strand,
            thickStart,
            thickEnd,
            itemRgb,
            blockCount,
            blockSizes,
            blockStarts,
        };
    };
}

export { makeBed12Parser };
