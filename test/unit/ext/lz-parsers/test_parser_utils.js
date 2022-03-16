import { assert } from 'chai';
import { _missingToNull, parseAlleleFrequency, parsePvalToLog } from '../../../../esm/ext/lz-parsers/utils';


describe('missingToNull', () => {
    it('converts a range of missing values to null values', () => {
        // Every other one should get converted
        const values = [0, null, 5, 'n/a', 'bob', '-NaN'];
        const result = _missingToNull(values);
        assert.deepStrictEqual(result, [0, null, 5, null, 'bob', null]);
    });
});

describe('parsePvalToLog', () => {
    it('sidesteps language underflow', () => {
        const val = '1.93e-780';
        const res = parsePvalToLog(val, false);
        assert.equal(res, 779.7144426909922, 'Handled value that would otherwise have underflowed');
    });

    it('handles underflow that occurred in the source data', () => {
        let val = '0';
        let res = parsePvalToLog(val);
        assert.equal(res, Infinity, 'Provides a placeholder when the input data underflowed');

        val = '0.0';
        res = parsePvalToLog(val);
        assert.equal(res, Infinity, 'Provides a placeholder when the input data underflowed (slow path)');
    });
});

describe('parseAlleleFrequency', () => {
    it('returns freq given frequency', () => {
        const res = parseAlleleFrequency({ freq: '0.25', is_alt_effect: true });
        assert.equal(res, 0.25);
    });

    it('returns freq given frequency, and orients to alt', () => {
        const res = parseAlleleFrequency({ freq: '0.25', is_alt_effect: false });
        assert.equal(res, 0.75);
    });

    it('handles missing data', () => {
        const res = parseAlleleFrequency({ freq: 'NA', is_alt_effect: true });
        assert.equal(res, null);
    });

    it('calculates freq from counts', () => {
        const res = parseAlleleFrequency({ allele_count: '25', n_samples: '100' });
        assert.equal(res, 0.125);
    });

    it('calculates freq from counts, and orients to alt', () => {
        const res = parseAlleleFrequency({ allele_count: '75', n_samples: '100', is_alt_effect: false });
        assert.equal(res, 0.625);
    });

    it('handles missing data when working with counts', () => {
        const res = parseAlleleFrequency({ allele_count: 'NA', n_samples: '100' });
        assert.equal(res, null);
    });
});
