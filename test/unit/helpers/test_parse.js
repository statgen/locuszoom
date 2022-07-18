import {assert} from 'chai';

import { parseMarker } from '../../../esm/helpers/parse';


describe('REGEX_MARKER', () => {
    it('handles various marker formats', () => {
        const has_chr_pos = ['chr1:23', 'chrX:23', '1:23', 'X:23'];
        const has_chr_pos_refalt = ['chr1:23_A/C', '1:23_A/C', 'chr1:23:AAAA:G', '1:23_A|C', 'chr1:281876_AC/A', 'chr1_23_A_C'];
        const has_chr_pos_refalt_extra = [
            'chr1:23_A/C_gibberish', '1:23_A/C_gibberish', '1:23_A|C_gibberish',
            '1:51873951_G/GT_1:51873951_G/GT',
        ];

        has_chr_pos.forEach((item) => {
            const match = parseMarker(item);
            assert.ok(match, `Match found for ${item}`);
            assert.lengthOf(match.filter((e) => !!e), 2, `Found chr:pos for ${item}`);
        });
        has_chr_pos_refalt.forEach((item) => {
            const match = parseMarker(item);
            assert.ok(match, `Match found for ${item}`);
            assert.lengthOf(match.filter((e) => !!e), 4, `Found chr:pos_ref/alt for ${item}- actual ${match}`);
        });
        has_chr_pos_refalt_extra.forEach((item) => {
            const match = parseMarker(item);
            assert.ok(match, `Match found for ${item}`);
            assert.lengthOf(match.filter((e) => !!e), 5, `Found chr:pos_ref/alt_extra for ${item}`);
        });

        // Pathological edge cases
        let match = parseMarker('1:51873951_G/GT_1:51873951_G/GT');
        assert.equal(match[0], '1', 'Found correct chrom');
        assert.equal(match[1], '51873951', 'Found correct pos');
        assert.equal(match[2], 'G', 'Found correct ref');
        assert.equal(match[3], 'GT', 'Found correct alt');

        match = parseMarker('sentence_goes_here_1:51873951_G/GT', true);
        assert.isNotOk(match, 'Marker must be at start of string');
    });
});
