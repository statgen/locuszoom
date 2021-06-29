import { assert } from 'chai';

import { makeUcscBedParser } from '../../../esm/ext/lz-parsers';

describe('UCSC-style BED parser', function () {
    beforeEach(function () {
        this.lines = `chr7	127471196	127472363	Pos1	0	+	127471196	127472363	255,0,0
chr7	127472363	127473530	Pos2	0	+	127472363	127473530	255,0,0
chr7	127473530	127474697	Pos3	0	+	127473530	127474697	255,0,0
chr7	127474697	127475864	Pos4	0	+	127474697	127475864	255,0,0
chr7	127475864	127477031	Neg1	0	-	127475864	127477031	0,0,255
chr7	127477031	127478198	Neg2	0	-	127477031	127478198	0,0,255
chr7	127478198	127479365	Neg3	0	-	127478198	127479365	0,0,255
chr7	127479365	127480532	Pos5	0	+	127479365	127480532	255,0,0
chr7	127480532	127481699	Neg4	0	-	127480532	127481699	0,0,255`.split('\n');
    });

    it('defaults to normalizing the parsed data to match expectations', function () {
        const parser = makeUcscBedParser(true);
        const result = parser(this.lines[0]);
        const expected = {
            'blockCount': undefined,
            'blockSizes': undefined,
            'blockStarts': undefined,
            'chrom': '7',
            'chromEnd': 127472363,
            'chromStart': 127471197,
            'itemRgb': 'rgb(255,0,0)',
            'name': 'Pos1',
            'score': 0,
            'strand': '+',
            'thickEnd': 127472363,
            'thickStart': 127471196,
        };
        assert.deepEqual(result, expected, 'All fields are populated in data object with the expected types');
    });

    it('warns if required fields are missing', function () {
        const parser = makeUcscBedParser(true);
        assert.throws(() => parser('chr12\t51'),  /must provide all required/);
    });

    it('returns raw file contents if normalize = false', function () {
        const parser = makeUcscBedParser(false);
        const result = parser(this.lines[0]);
        const expected = {
            'blockCount': undefined,
            'blockSizes': undefined,
            'blockStarts': undefined,
            'chrom': 'chr7',
            'chromEnd': '127472363',
            'chromStart': '127471196',
            'itemRgb': '255,0,0',
            'name': 'Pos1',
            'score': '0',
            'strand': '+',
            'thickEnd': '127472363',
            'thickStart': '127471196',
        };
        assert.deepEqual(result, expected, 'All fields are populated in data object');
    });

    it('handles additional optional BED fields if they are present', function () {
        const parser = makeUcscBedParser(true);
        // The trailing comma in a list-field is part of the UCSC BED examples; weird, but make sure that we handle it!
        const a_line = `chr7	127472363	127473530	Pos2	0	+	127472363	127473530	255,0,0	2	567,488,	0,3512`;
        const result = parser(a_line);
        const extra_expected = {
            'blockCount': 2,
            'blockSizes': [567, 488],
            'blockStarts': [1, 3513],
        };
        assert.deepInclude(result, extra_expected, 'Optional fields are parsed and processed correctly');
    });

    it('performs basic validation of block information', function () {
        const parser = makeUcscBedParser(true);
        // Here, blockSizes has 3 items, but blockCounts calls for 2
        const a_line = `chr7	127472363	127473530	Pos2	0	+	127472363	127473530	255,0,0	2	567,488,999	0,3512`;
        assert.throws(() => parser(a_line), /same number of items/);
    });
});
