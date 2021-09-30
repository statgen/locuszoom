/**
 * Parsers for custom user-specified LD
 */

import {normalizeChr} from './utils';
import {normalizeMarker} from '../../helpers/parse';

/**
 * Parse the output of plink v1.9 R2 calculations relative to one (or a few) target SNPs.
 * See: https://www.cog-genomics.org/plink/1.9/ld and
 * reformatting commands at https://www.cog-genomics.org/plink/1.9/other
 *
 * @returns {Object} Same column names used by the UM LD Server
 */
function makePlinkLdParser(normalize = true) {
    return (line) => {
        // Sample headers are below: SNP_A and SNP_B are based on ID column of the VCF
        // CHR_A   BP_A    SNP_A   CHR_B   BP_B    SNP_B   R2
        let [chromosome1, position1, variant1, chromosome2, position2, variant2, correlation] = line.trim().split('\t');
        if (normalize) {
            chromosome1 = normalizeChr(chromosome1);
            chromosome2 = normalizeChr(chromosome2);
            variant1 = normalizeMarker(variant1);
            variant2 = normalizeMarker(variant2);
            position1 = +position1;
            position2 = +position2;
            correlation = +correlation;
        }

        return {chromosome1, position1, variant1, chromosome2, position2, variant2, correlation};
    };
}

export { makePlinkLdParser };
