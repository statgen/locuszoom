/**
 * Parsers for handling common file formats used by LocusZoom plots. Each parser is intended to be used on one line of
 *  text from the specified file.
 * @module
 */

/**
 * Parse a BED file, according to the widely used UCSC (quasi-)specification
 *
 * NOTE: This original version is aimed at tabix region queries, and carries an implicit assumption that data is the
 *  only thing that will be parsed. It makes no attempt to identify or handle header rows / metadata fields.
 *
 * @param {Boolean} normalize Whether to normalize the output to the format expected by LocusZoom (eg type coercion
 *  for numbers, removing chr chromosome prefixes, and using 1-based and inclusive coordinates instead of 0-based disjoint intervals)
 */
function makeUcscBedParser(normalize = true) {
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

        if (normalize) {
            // Mandatory fields
            chrom = chrom.replace(/^chr/g, '');
            chromStart = +chromStart + 1;  // 0 based start
            chromEnd = +chromEnd; // 0-based positions, intervals exclude end position

            // Optional fields, require checking for blanks
            score = +score;
            thickStart = thickStart ? +thickStart : thickStart;
            thickEnd = thickEnd ? +thickEnd : thickEnd;
            itemRgb = itemRgb ? `rgb(${itemRgb})` : itemRgb;
            blockCount = blockCount ? +blockCount : blockCount;
            blockSizes = blockSizes ? blockSizes.replace(/,$/, '').split(',').map((value) => +value) : blockSizes; // Comma separated list of sizes -> array of integers
            blockStarts = blockStarts ? blockStarts.replace(/,$/, '').split(',').map((value) => +value + 1) : blockStarts; // Comma separated list of sizes -> array of integers (start positions)

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

// // Slight build quirk: we use a single webpack config for all modules, but `libraryTarget` expects the entire
// //  module to be exported as `default` in <script> tag mode.
const all = { makeUcscBedParser };

export default all;
export { makeUcscBedParser };
