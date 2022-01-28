import {parseMarker} from '../../../helpers/parse';

import {
    MISSING_VALUES,
    has,
    parseAlleleFrequency,
    parsePvalToLog, normalizeChr,
} from '../utils';


/**
 * Specify how to parse a GWAS file, given certain column information.
 * Outputs an object with fields in portal API format.
 *
 * All column options must be provided as 1-indexed column IDs (human-friendly argument values)
 * @function
 * @alias module:ext/lz-parsers~makeGWASParser
 * @param options
 * @param [options.marker_col] A single identifier that specifies all of chrom, pos, ref, and alt as a single string field. Eg 1:23_A/C
 * @param [options.chrom_col] Chromosome
 * @param [options.pos_col] Position
 * @param [options.ref_col] Reference allele (relative to human reference genome, eg GRCh37 or 38).
 * @param [options.alt_col] Alt allele. Some programs specify generic A1/A2 instead; it is the job of the user to identify which columns of this GWAS are ref and alt.
 * @param [options.rsid_col] rsID
 * @param options.pvalue_col p-value (or -log10p)
 * @param [options.beta_col]
 * @param [options.stderr_beta_col]
 * @param [options.allele_freq_col] Specify allele frequencies directly
 * @param [options.allele_count_col] Specify allele frequencies in terms of count and n_samples
 * @param [options.n_samples_col]
 * @param [options.is_alt_effect=true] Some programs specify beta and frequency information in terms of ref, others alt. Identify effect allele to orient values to the correct allele.
 * @param [options.is_neg_log_pvalue=false]
 * @param [options.delimiter='\t'] Since this parser is usually used with tabix data, this is rarely changed (tabix does not accept other delimiters)
 * @return {function(string)} A parser function that can be called on each line of text with the provided options
 */
function makeGWASParser(
    {
        // Required fields
        marker_col, // Identify the variant: marker OR chrom/pos/ref/alt
        chrom_col,
        pos_col,
        ref_col,
        alt_col,
        pvalue_col, // pvalue (or log_pvalue; see options below)
        // Optional fields
        is_neg_log_pvalue = false,
        rsid_col,
        beta_col,
        stderr_beta_col,
        allele_freq_col, // Frequency: given directly, OR in terms of counts
        allele_count_col,
        n_samples_col,
        is_alt_effect = true, // whether effect allele is oriented towards alt. We don't support files like METAL, where ref/alt may switch places per line of the file
        delimiter = '\t',
    },
) {
    // Column IDs should be 1-indexed (human friendly)
    if (has(marker_col) && has(chrom_col) && has(pos_col)) {
        throw new Error('Must specify either marker OR chr + pos');
    }
    if (!(has(marker_col) || (has(chrom_col) && has(pos_col)))) {
        throw new Error('Must specify how to locate marker');
    }

    if (has(allele_count_col) && has(allele_freq_col)) {
        throw new Error('Allele count and frequency options are mutually exclusive');
    }
    if (has(allele_count_col) && !has(n_samples_col)) {
        throw new Error('To calculate allele frequency from counts, you must also provide n_samples');
    }


    return (line) => {
        const fields = line.split(delimiter);
        let chr;
        let pos;
        let ref;
        let alt;
        let rsid = null;

        let freq;
        let beta = null;
        let stderr_beta = null;
        let alt_allele_freq = null;
        let allele_count;
        let n_samples;

        if (has(marker_col)) {
            [chr, pos, ref, alt] = parseMarker(fields[marker_col - 1], false);
        } else if (has(chrom_col) && has(pos_col)) {
            chr = fields[chrom_col - 1];
            pos = fields[pos_col - 1];
        } else {
            throw new Error('Must specify all fields required to identify the variant');
        }

        chr = normalizeChr(chr);
        if (chr.startsWith('RS')) {
            throw new Error(`Invalid chromosome specified: value "${chr}" is an rsID`);
        }

        if (has(ref_col)) {
            ref = fields[ref_col - 1];
        }

        if (has(alt_col)) {
            alt = fields[alt_col - 1];
        }

        if (has(rsid_col)) {
            rsid = fields[rsid_col - 1];
        }

        if (MISSING_VALUES.has(ref)) {
            ref = null;
        }
        if (MISSING_VALUES.has(alt)) {
            alt = null;
        }

        if (MISSING_VALUES.has(rsid)) {
            rsid = null;
        } else if (rsid) {
            rsid = rsid.toLowerCase();
            if (!rsid.startsWith('rs')) {
                rsid = `rs${rsid}`;
            }
        }

        const log_pval = parsePvalToLog(fields[pvalue_col - 1], is_neg_log_pvalue);
        ref = ref || null;
        alt = alt || null;

        if (has(allele_freq_col)) {
            freq = fields[allele_freq_col - 1];
        }
        if (has(allele_count_col)) {
            allele_count = fields[allele_count_col - 1];
            n_samples = fields[n_samples_col - 1];
        }

        if (has(beta_col)) {
            beta = fields[beta_col - 1];
            beta = MISSING_VALUES.has(beta) ? null : (+beta);
        }

        if (has(stderr_beta_col)) {
            stderr_beta = fields[stderr_beta_col - 1];
            stderr_beta = MISSING_VALUES.has(stderr_beta) ? null : (+stderr_beta);
        }

        if (allele_freq_col || allele_count_col) {
            alt_allele_freq = parseAlleleFrequency({
                freq,
                allele_count,
                n_samples,
                is_alt_effect,
            });
        }
        const ref_alt = (ref && alt) ? `_${ref}/${alt}` : '';
        return {
            chromosome: chr,
            position: +pos,
            ref_allele: ref ? ref.toUpperCase() : null,
            alt_allele: alt ? alt.toUpperCase() : null,
            variant: `${chr}:${pos}${ref_alt}`,
            rsid,
            log_pvalue: log_pval,
            beta,
            stderr_beta,
            alt_allele_freq,
        };
    };
}


export { makeGWASParser };
