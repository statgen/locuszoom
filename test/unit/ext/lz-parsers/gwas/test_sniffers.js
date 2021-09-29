import { assert } from 'chai';
import { isHeader, _findColumn, _getPvalColumn, _levenshtein, guessGWAS } from '../../../../../esm/ext/lz-parsers/gwas/sniffers';


describe('Automatic header detection', () => {
    it('Correctly identifies various header rules', () => {
        assert.isOk(isHeader('#Comment'), 'Comment lines are headers!');
        assert.isOk(isHeader('Header\tLabels'), 'Headers tend to be text');
        assert.isNotOk(isHeader('X\t100'), 'Data has numbers');
        assert.isNotOk(isHeader('X\t.'), 'Missing data is still data');
        assert.isNotOk(isHeader('X,100', { delimiter: ',' }), 'Handles data as csv');
        assert.isOk(isHeader('//100', { comment_char: '//' }), 'Handles different comments');
    });
});


describe('Levenshtein distance metric', () => {
    it('Computes levenshtein distance for sample strings', () => {
        const scenarios = [
            ['bob', 'bob', 0],
            ['bob', 'bib', 1],
            ['alice', 'bob', 5],
            ['pvalue', 'p.value', 1],
            ['p.value', 'pvalue', 1],
            ['pvalue', 'log_pvalue', 4],
        ];
        scenarios.forEach((s) => {
            const [a, b, score] = s;
            const val = _levenshtein(a, b);
            assert.equal(score, val, `Incorrect match score for ${a}, ${b}`);
        });
    });
});

describe('_findColumn can fuzzy match column names', () => {
    const pval_names = ['pvalue', 'p.value', 'pval', 'p_score'];

    it('finds the first header that exactly matches a synonym', () => {
        const headers = ['chr', 'pos', 'p.value', 'marker'];
        const match = _findColumn(pval_names, headers);
        assert.equal(match, 2);
    });

    it('chooses the first exact match when more than one is present', () => {
        const headers = ['chr', 'pvalue', 'p.value', 'marker'];
        const match = _findColumn(pval_names, headers);
        assert.equal(match, 1);
    });

    it('prefers exact matches over fuzzy matches', () => {
        const headers = ['chr1', 'pos1', 'pvalues', 'p.value', '1marker'];
        const match = _findColumn(pval_names, headers);
        assert.equal(match, 3);
    });

    it('finds the first header that closely matches a synonym', () => {
        const headers = ['chr', 'pos', 'marker', 'p-value'];
        const match = _findColumn(pval_names, headers);
        assert.equal(match, 3);
    });

    it('returns null if no good match can be found', () => {
        const headers = ['chr', 'pos', 'marker', 'pval_score'];
        const match = _findColumn(pval_names, headers);
        assert.equal(match, null);
    });

    it('will match based on a configurable threshold', () => {
        const headers = ['chr', 'marker', 'pval_score'];
        const match = _findColumn(pval_names, headers, 3);
        assert.equal(match, 2);
    });

    it('skips headers with a null value', () => {
        const headers = ['chr', null, 'marker', 'pval'];
        const match = _findColumn(pval_names, headers);
        assert.equal(match, 3);
    });
});

describe('getPvalColumn', () => {
    it('finds logp before p', () => {
        const headers = ['logpvalue', 'pval'];
        const data_rows = [[0.5, 0.5]];

        const actual = _getPvalColumn(headers, data_rows);
        assert.deepEqual(actual, { pvalue_col: 1, is_neg_log_pvalue: true });
    });

    it('checks that pvalues are in a realistic range 0..1', () => {
        const headers = ['pval'];
        const data_rows = [[100]];

        const actual = _getPvalColumn(headers, data_rows);
        assert.deepEqual(actual, null);
    });
});

describe('guessGWAS format detection', () => {
    it('Returns null if columns could not be identified', () => {
        const headers = ['rsid', 'pval'];
        const data = [['rs1234', 0.5]];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(actual, null);
    });

    it('handles zorp standard format', () => {
        const headers = ['#chrom', 'pos', 'ref', 'alt', 'neg_log_pvalue', 'beta', 'stderr_beta'];
        const data = [['1', '762320', 'C', 'T', '0.36947042857317597', '0.5', '0.1']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(actual, {
            chrom_col: 1,
            pos_col: 2,
            ref_col: 3,
            alt_col: 4,
            pvalue_col: 5,
            is_neg_log_pvalue: true,
            beta_col: 6,
            stderr_beta_col: 7,
        });
    });

    it('handles BOLT-LMM', () => {
        // https://data.broadinstitute.org/alkesgroup/BOLT-LMM/#x1-450008.1
        // This sample drawn from:
        //  ftp://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics/ZhuZ_30940143_GCST007609
        // TODO: The official format spec may use other pvalue col names; add tests for that
        const headers = ['SNP', 'CHR', 'BP', 'A1', 'A0', 'MAF', 'HWEP', 'INFO', 'BETA', 'SE', 'P'];
        const data = [['10:48698435_A_G', '10', '48698435', 'A', 'G', '0.01353', '0.02719', '0.960443', '0.0959329', '0.0941266', '3.3E-01']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(actual, {
            marker_col: 1,
            pvalue_col: 11,
            is_neg_log_pvalue: false,
            beta_col: 9,
            stderr_beta_col: 10,
        });
    });

    it('handles EPACTS', () => {
        // https://genome.sph.umich.edu/wiki/EPACTS#Output_Text_of_All_Test_Statistics
        const headers = ['#CHROM', 'BEGIN', 'END', 'MARKER_ID', 'NS', 'AC', 'CALLRATE', 'MAF', 'PVALUE', 'SCORE', 'N.CASE', 'N.CTRL', 'AF.CASE', 'AF.CTRL'];
        const data = [['20', '1610894', '1610894', '20:1610894_G/A_Synonymous:SIRPG', '266', '138.64', '1', '0.26061', '6.9939e-05', '3.9765', '145', '121', '0.65177', '0.36476']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(actual, { marker_col: 4, pvalue_col: 9, is_neg_log_pvalue: false });
    });

    it('handles EMMAX-EPACTS', () => {
        // Sample from a file that used multiple tools
        const headers = ['#CHROM', 'BEG', 'END', 'MARKER_ID', 'NS', 'AC', 'CALLRATE', 'GENOCNT', 'MAF', 'STAT', 'PVALUE', 'BETA', 'SEBETA', 'R2'];
        const data = [['1', '762320', '762320', '1:762320_C/T_rs75333668', '3805', '100.00', '1.00000', '3707/96/2', '0.01314', '0.7942', '0.4271', '0.08034', '0.1012', '0.0001658']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(actual, {
            marker_col: 4,
            pvalue_col: 11,
            is_neg_log_pvalue: false,
            beta_col: 12,
            stderr_beta_col: 13,
        });
    });

    it('handles METAL', () => {
        const headers = ['#CHROM', 'POS', 'REF', 'ALT', 'N', 'POOLED_ALT_AF', 'DIRECTION_BY_STUDY', 'EFFECT_SIZE', 'EFFECT_SIZE_SD', 'H2', 'PVALUE'];
        const data = [['1', '10177', 'A', 'AC', '491984', '0.00511094', '?-????????????????-????+???????????????????????????????????????????????????????????????????-????????????????????????????????????????????????????????????????????????????????', '-0.0257947', '0.028959', '1.61266e-06', '0.373073']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                chrom_col: 1,
                pos_col: 2,
                ref_col: 3,
                alt_col: 4,
                pvalue_col: 11,
                is_neg_log_pvalue: false,
                beta_col: 8,
                stderr_beta_col: 9,
            }
        );
    });

    it('handles PLINK', () => {
        // Format: https://www.cog-genomics.org/plink2/formats
        // Sample: https://github.com/babelomics/babelomics/wiki/plink.assoc
        // h/t Josh Weinstock
        const headers = ['CHR', 'SNP', 'BP', 'A1', 'F_A', 'F_U', 'A2', 'CHISQ', 'P'];
        const data = [['1', 'rs3094315', '742429', 'C', '0.1509', '0.1394', 'T', '0.0759', '0.782', '1.097']];
        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                chrom_col: 1,
                pos_col: 3,
                ref_col: 4,
                alt_col: 7,
                pvalue_col: 9,
                is_neg_log_pvalue: false,
            }
        );
    });

    it('handles RAREMETAL', () => {
        const headers = ['#CHROM', 'POS', 'REF', 'ALT', 'N', 'POOLED_ALT_AF', 'DIRECTION_BY_STUDY', 'EFFECT_SIZE', 'EFFECT_SIZE_SD', 'H2', 'PVALUE'];
        const data = [['1', '10177', 'A', 'AC', '491984', '0.00511094', '?-????????????????-????+???????????????????????????????????????????????????????????????????-????????????????????????????????????????????????????????????????????????????????', '-0.0257947', '0.028959', '1.61266e-06', '0.373073']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                chrom_col: 1,
                pos_col: 2,
                ref_col: 3,
                alt_col: 4,
                pvalue_col: 11,
                is_neg_log_pvalue: false,
                beta_col: 8,
                stderr_beta_col: 9,
            }
        );
    });

    it('handles RAREMETALWORKER', () => {
        const headers = ['#CHROM', 'POS', 'REF', 'ALT', 'N_INFORMATIVE', 'FOUNDER_AF', 'ALL_AF', 'INFORMATIVE_ALT_AC', 'CALL_RATE', 'HWE_PVALUE', 'N_REF', 'N_HET', 'N_ALT', 'U_STAT', 'SQRT_V_STAT', 'ALT_EFFSIZE', 'PVALUE'];
        const data = [['9', '400066155', 'T', 'C', '432', '0', '0', '0', '1', '1', '432', '0', '0', 'NA', 'NA', 'NA', 'NA']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                chrom_col: 1,
                pos_col: 2,
                ref_col: 3,
                alt_col: 4,
                pvalue_col: 17,
                is_neg_log_pvalue: false,
                beta_col: 16,
            }
        );
    });

    it('handles RVTESTS', () => {
        // Courtesy of xyyin and gzajac
        const headers = ['CHROM', 'POS', 'REF', 'ALT', 'N_INFORMATIVE', 'AF', 'INFORMATIVE_ALT_AC', 'CALL_RATE', 'HWE_PVALUE', 'N_REF', 'N_HET', 'N_ALT', 'U_STAT', 'SQRT_V_STAT', 'ALT_EFFSIZE', 'PVALUE'];
        const data = [['1', '761893', 'G', 'T', '19292', '2.59624e-05:0.000655308:0', '1:1:0', '0.998289:0.996068:0.998381', '1:1:1', '19258:759:18499', '1:1:0', '0:0:0', '1.33113', '0.268484', '18.4664', '7.12493e-07']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                chrom_col: 1,
                pos_col: 2,
                ref_col: 3,
                alt_col: 4,
                pvalue_col: 16,
                is_neg_log_pvalue: false,
                beta_col: 15,
            }
        );
    });

    it('handles SAIGE', () => {
        // https://github.com/weizhouUMICH/SAIGE/wiki/SAIGE-Hands-On-Practical
        const headers = ['CHR', 'POS', 'SNPID', 'Allele1', 'Allele2', 'AC_Allele2', 'AF_Allele2', 'N', 'BETA', 'SE', 'Tstat', 'p.value', 'p.value.NA', 'Is.SPA.converge', 'varT', 'varTstar'];
        const data = [['chr1', '76792', 'chr1:76792:A:C', 'A', 'C', '57', '0.00168639048933983', '16900', '0.573681678183941', '0.663806747906141', '1.30193005902619', '0.387461577915637', '0.387461577915637', '1', '2.2694293866027', '2.41152256615949']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                marker_col: 3,
                pvalue_col: 12,
                is_neg_log_pvalue: false,
                beta_col: 9,
                stderr_beta_col: 10,
            }
        );
    });

    it('parses a mystery format', () => {
        // TODO: Identify the program used and make test more explicit
        // FIXME: This test underscores difficulty of reliable ref/alt detection- a1 comes
        //  before a0, but it might be more valid to switch the order of these columns
        const headers = ['chr', 'rs', 'ps', 'n_mis', 'n_obs', 'allele1', 'allele0', 'af', 'beta', 'se', 'p_score'];
        const data = [['1', 'rs75333668', '762320', '0', '3610', 'T', 'C', '0.013', '-5.667138e-02', '1.027936e-01', '5.814536e-01']];
        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                chrom_col: 1,
                pos_col: 3,
                ref_col: 6,
                alt_col: 7,
                pvalue_col: 11,
                is_neg_log_pvalue: false,
                beta_col: 9,
                stderr_beta_col: 10,
            }
        );
    });

    it('handles output of AlisaM pipeline', () => {
        const headers = ['MarkerName', 'chr', 'pos', 'ref', 'alt', 'minor.allele', 'maf', 'mac', 'n', 'pvalue', 'SNPID', 'BETA', 'SE', 'ALTFreq', 'SNPMarker'];
        const data = [['chr1-281876-AC-A', 'chr1', '281876', 'AC', 'A', 'alt', '0.231428578495979', '1053', '2275', '0.447865946615285', 'rs72502741', '-0.0872936159370696', '0.115014743551501', '0.231428578495979', 'chr1:281876_AC/A']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                chrom_col: 2,
                pos_col: 3,
                ref_col: 4,
                alt_col: 5,
                pvalue_col: 10,
                is_neg_log_pvalue: false,
                beta_col: 12,
                stderr_beta_col: 13,
            }
        );
    });

    it('handles whatever diagram was using', () => {
        const headers = ['Chr:Position', 'Allele1', 'Allele2', 'Effect', 'StdErr', 'P-value', 'TotalSampleSize'];
        const data = [['5:29439275', 'T', 'C', '-0.0003', '0.015', '0.99', '111309']];

        const actual = guessGWAS(headers, data);
        assert.deepEqual(
            actual,
            {
                marker_col: 1,
                pvalue_col: 6,
                is_neg_log_pvalue: false,
                beta_col: 4,
                stderr_beta_col: 5,
            }
        );
    });
});
