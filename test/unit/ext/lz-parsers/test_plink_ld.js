import { assert } from 'chai';
import {makePlinkLdParser} from '../../../../esm/ext/lz-parsers/ld';


describe('LD format parsing', function () {
    it('parses PLINK format LD (raw)', function () {
        const line = '22\t37470224\t22-37470224-T-C\t22\t37370297\t22-37370297-T-C\t0.000178517';
        const parser = makePlinkLdParser({normalize: false});
        const actual = parser(line);

        const expected = {
            chromosome1: '22',
            position1: '37470224',
            variant1: '22-37470224-T-C',
            chromosome2: '22',
            position2: '37370297',
            variant2: '22-37370297-T-C',
            correlation: '0.000178517',
        };

        assert.deepEqual(actual, expected, 'All plink fields parsed as expected');
    });

    it('normalizes chromosome names and variant formats', function () {
        const line = 'chrx\t37470224\t22-37470224\tchr22\t37370297\tchr22:37370297-T-C\t0.000178517';
        const parser = makePlinkLdParser({normalize: true});
        const actual = parser(line);

        const expected = {
            chromosome1: 'X',
            chromosome2: '22',
            correlation: 0.000178517,
            position1: 37470224,
            position2: 37370297,
            variant1: '22:37470224',
            variant2: '22:37370297_T/C',
        };

        assert.deepEqual(actual, expected, 'Handles chr prefix, incomplete variants, and normalizes full specifier to EPACTS format (same as LDServer)');
    });
});
