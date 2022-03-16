import {assert} from 'chai';

import {left_match, inner_match, full_outer_match} from '../../../../esm/data/undercomplicate/joins';


describe('Data Join Helpers', function() {
    beforeEach(function () {
        this.left_data = [
            { gene_id: 'ENSG00000148737', pval: .05 },
            { gene_id: 'ENSG00000012048', pval: .0005 }, // not on right
        ];

        this.right_data = [
            { gene_id: 'ENSG00000148737', catalog: true }, // 2 matches for 1 item on left
            { gene_id: 'ENSG00000148737', catalog: false }, // '
            { gene_id: 'ENSG00000128731', catalog: true }, // Not on left
        ];
    });

    describe('left join helper', function () {
        it('takes all records on left, merged with 1 or more records on right', function () {
            const expected = [
                { gene_id: 'ENSG00000148737', pval: .05, catalog: true },
                { gene_id: 'ENSG00000148737', pval: .05, catalog: false },
                { gene_id: 'ENSG00000012048', pval: .0005 },
            ];

            const actual = left_match(this.left_data, this.right_data, 'gene_id', 'gene_id');
            assert.deepEqual(actual, expected);
        });
    });

    describe('inner join helper', function () {
        it('takes only records with matches on both left and right', function () {
            const expected = [
                { gene_id: 'ENSG00000148737', pval: .05, catalog: true },
                { gene_id: 'ENSG00000148737', pval: .05, catalog: false },
            ];
            const actual = inner_match(this.left_data, this.right_data, 'gene_id', 'gene_id');
            assert.deepEqual(actual, expected);
        });
    });

    describe('full outer join helper', function () {
        it('takes all records, matching them where suitable', function () {
            const expected = [
                { gene_id: 'ENSG00000148737', pval: .05, catalog: true },
                { gene_id: 'ENSG00000148737', pval: .05, catalog: false },
                { gene_id: 'ENSG00000012048', pval: .0005 },
                { gene_id: 'ENSG00000128731', catalog: true },
            ];

            const actual = full_outer_match(this.left_data, this.right_data, 'gene_id', 'gene_id');
            assert.deepEqual(actual, expected);
        });
    });
});
