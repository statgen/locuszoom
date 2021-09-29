import { assert } from 'chai';
import { makeParser } from '../../../../../esm/ext/lz-parsers/gwas/parsers';


describe('GWAS parsing', () => {
    describe('Mode selection', () => {
        it.skip('Warns if no marker could be identified', () => {});
    });

    describe('Handles sample data correctly', () => {
        it.skip('parses EPACTS data', () => {
            // FIXME: Alan notes edge cases that may not be handled yet:
            //  -when *PVALUE = 0*, it always indicates a variant is very significant (such that it
            // underflows R's precision limit), and *should be plotted*
            // -when *PVALUE = NA*, it indicates that no test was run for that variant because there
            // were too few copies of the alt allele in the sample, and running the test is a waste
            // of time since it will never be significant. *These can be safely skipped.*"
        });

        it('parses SAIGE data', () => {
            const saige_sample = 'chr1\t76792\tchr1:76792:A:C\tA\tC\t57\t0.00168639048933983\t16900\t0.573681678183941\t0.663806747906141\t1.30193005902619\t0.387461577915637\t0.387461577915637\t1\t2.2694293866027\t2.41152256615949';
            const parser = makeParser({ marker_col: 3, pvalue_col: 12, is_neg_log_pvalue: false });
            const actual = parser(saige_sample);
            assert.deepEqual(actual, {
                alt_allele: 'C',
                chromosome: '1',
                log_pvalue: 0.41177135722616476,
                position: 76792,
                ref_allele: 'A',
                variant: '1:76792_A/C',
                rsid: null,
                beta: null,
                stderr_beta: null,
                alt_allele_freq: null,
            });
        });

        it('parses RVTESTS data', () => {
            const rvtests_sample = '1\t761893\tG\tT\t19292\t2.59624e-05:0.000655308:0\t1:1:0\t0.998289:0.996068:0.998381\t1:1:1\t19258:759:18499\t1:1:0\t0:0:0\t1.33113\t0.268484\t18.4664\t7.12493e-07';
            const parser = makeParser({
                chrom_col: 1,
                pos_col: 2,
                ref_col: 3,
                alt_col: 4,
                pvalue_col: 16,
                is_neg_log_pvalue: false,
                alt_allele_freq: null,
            });
            const actual = parser(rvtests_sample);
            assert.deepEqual(actual, {
                alt_allele: 'T',
                chromosome: '1',
                log_pvalue: 6.147219398093217,
                position: 761893,
                ref_allele: 'G',
                variant: '1:761893_G/T',
                rsid: null,
                beta: null,
                stderr_beta: null,
                alt_allele_freq: null,
            });
        });

        it('parses beta and stderr where appropriate', () => {
            const line = 'X:12_A/T\t0.1\t0.5\t0.6';
            const parser = makeParser({
                marker_col: 1,
                pvalue_col: 2,
                beta_col: 3,
                stderr_beta_col: 4,
            });
            const actual = parser(line);

            assert.deepEqual(actual, {
                chromosome: 'X',
                position: 12,
                ref_allele: 'A',
                alt_allele: 'T',
                variant: 'X:12_A/T',
                rsid: null,
                log_pvalue: 1,
                beta: 0.5,
                stderr_beta: 0.6,
                alt_allele_freq: null,
            });
            // Also handles missing data for beta
            const line2 = 'X:12_A/T\t0.1\t.\t.';
            const actual2 = parser(line2);
            assert.equal(actual2.beta, null);
            assert.equal(actual2.stderr_beta, null);
        });

        it('ensures that ref and alt are uppercase', () => {
            const line = 'X:12\ta\tNA\t0.1';
            const parser = makeParser({
                marker_col: 1,
                ref_col: 2,
                alt_col: 3,
                pvalue_col: 4,
            });
            const actual = parser(line);

            assert.deepEqual(actual, {
                chromosome: 'X',
                position: 12,
                ref_allele: 'A',
                alt_allele: null,
                variant: 'X:12',
                rsid: null,
                log_pvalue: 1,
                beta: null,
                stderr_beta: null,
                alt_allele_freq: null,
            });
        });

        it('handles rsid in various formats', () => {
            const parser = makeParser({
                marker_col: 1,
                ref_col: 2,
                alt_col: 3,
                pvalue_col: 4,
                rsid_col: 5,
            });

            const scenarios = [
                ['.', null],
                ['14', 'rs14'],
                ['RS14', 'rs14'],
            ];
            const line = 'X:12\ta\tNA\t0.1\t';

            scenarios.forEach(([raw, parsed]) => {
                const actual = parser(line + raw);
                assert.equal(actual.rsid, parsed);
            });
        });
    });
});
