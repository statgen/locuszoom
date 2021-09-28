/**
 * Test custom join logic specific to LZ core code
 */

import {assert} from 'chai';

import {DATA_OPS} from '../../../esm/registry';

describe('Data operations', function() {
    describe('Common behavior', function () {
        it('validates two-argument (join) functions', function () {
            const func = DATA_OPS.get('left_match');
            assert.throws(
                () => func([1, 2, 3], 'paramA'),
                /must receive exactly two recordsets/
            );
        });
    });

    describe('Custom join operations', function () {
        describe('assoc_to_gwas_catalog', function () {
            before(function() {
                this.func = DATA_OPS.get('assoc_to_gwas_catalog');
            });

            beforeEach(function () {
                this.assoc_data = [
                    { 'assoc:chromosome': 1, 'assoc:position': 2 },
                    { 'assoc:chromosome': 1, 'assoc:position': 4 },
                    { 'assoc:chromosome': 1, 'assoc:position': 6 },
                ];
                this.catalog_data = [
                    { 'catalog:chrom': 1, 'catalog:pos': 3, 'catalog:log_pvalue': 1.3, 'catalog:rsid': 'rs3', 'catalog:trait': 'arithomania' },
                    { 'catalog:chrom': 1, 'catalog:pos': 4, 'catalog:log_pvalue': 1.4, 'catalog:rsid': 'rs4', 'catalog:trait': 'arithomania' },
                    { 'catalog:chrom': 1, 'catalog:pos': 5, 'catalog:log_pvalue': 1.5, 'catalog:rsid': 'rs5', 'catalog:trait': 'arithomania' },
                    { 'catalog:chrom': 1, 'catalog:pos': 6, 'catalog:log_pvalue': 1.6, 'catalog:rsid': 'rs6', 'catalog:trait': 'arithomania' },
                ];
            });

            it('aligns records based on loose position match', function () {
                const { func, assoc_data, catalog_data } = this;
                const res = func(
                    {},
                    [assoc_data, catalog_data],
                    'assoc:position',
                    'catalog:pos',
                    'catalog:log_pvalue'
                );

                assert.deepEqual(res, [
                    { 'assoc:chromosome': 1, 'assoc:position': 2 },  // No annotations available for this point
                    {
                        'assoc:chromosome': 1,
                        'assoc:position': 4,
                        'catalog:rsid': 'rs4',
                        'catalog:trait': 'arithomania',
                        'catalog:chrom': 1,
                        'catalog:log_pvalue': 1.4,
                        'catalog:pos': 4,
                        'n_catalog_matches': 1,
                    },
                    {
                        'assoc:chromosome': 1,
                        'assoc:position': 6,
                        'catalog:rsid': 'rs6',
                        'catalog:trait': 'arithomania',
                        'catalog:chrom': 1,
                        'catalog:log_pvalue': 1.6,
                        'catalog:pos': 6,
                        'n_catalog_matches': 1,
                    },
                ]);
            });

            it('handles the case where the same SNP has more than one catalog entry', function () {
                const { assoc_data, func } = this;
                const catalog_data = [
                    { 'catalog:chrom': 1, 'catalog:pos': 4, 'catalog:log_pvalue': 1.40, 'catalog:rsid': 'rs4', 'catalog:trait': 'arithomania' },
                    { 'catalog:chrom': 1, 'catalog:pos': 4, 'catalog:log_pvalue': 1.41, 'catalog:rsid': 'rs4', 'catalog:trait': 'graphomania' },
                    { 'catalog:chrom': 1, 'catalog:pos': 6, 'catalog:log_pvalue': 1.61, 'catalog:rsid': 'rs6', 'catalog:trait': 'arithomania' },
                    { 'catalog:chrom': 1, 'catalog:pos': 6, 'catalog:log_pvalue': 1.60, 'catalog:rsid': 'rs6', 'catalog:trait': 'graphomania' },
                ];

                const res = func(
                    {},
                    [assoc_data, catalog_data],
                    'assoc:position',
                    'catalog:pos',
                    'catalog:log_pvalue'
                );

                assert.deepEqual(res, [
                    { 'assoc:chromosome': 1, 'assoc:position': 2 },  // No annotations available for this point
                    {
                        'assoc:chromosome': 1,
                        'assoc:position': 4,
                        'catalog:chrom': 1,
                        'catalog:log_pvalue': 1.41,
                        'catalog:pos': 4,
                        'catalog:rsid': 'rs4',
                        'catalog:trait': 'graphomania',
                        'n_catalog_matches': 2,
                    },
                    {
                        'assoc:chromosome': 1,
                        'assoc:position': 6,
                        'catalog:chrom': 1,
                        'catalog:log_pvalue': 1.61,
                        'catalog:pos': 6,
                        'catalog:rsid': 'rs6',
                        'catalog:trait': 'arithomania',
                        'n_catalog_matches': 2,
                    },
                ]);
            });

            it('gracefully handles no catalog entries in region', function () {
                const { func, assoc_data } = this;
                const res = func(
                    {},
                    [assoc_data, []],
                    'assoc:position',
                    'catalog:pos',
                    'catalog:log_pvalue'
                );
                assert.deepEqual(res, assoc_data);
            });
        });
    });
});
