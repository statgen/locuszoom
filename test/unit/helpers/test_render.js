/**
 Test rendering helpers
 */
import {assert} from 'chai';
import {coalesce_points} from '../../../esm/helpers/render';


describe('Coordinate coalescing', function () {
    beforeEach(function () {
        // Sample data intended to coalesce into ~6 points total
        this.sample_data = [ // Below are some notes for xgap = 3, ygap N/A. Other tests may vary.
            { x: 0, y: 0.5 }, // These points coalesce (using x cutoffs)
            { x: 1, y: 0.9 }, //     '
            { x: 2, y: 0.999 }, //  '
            { x: 3, y: 7.4 }, // Significant hit
            { x: 4, y: 0.001 }, // These points coalesce
            { x: 5, y: 0.05 }, //   '
            { x: 6, y: 128.0 }, // Significant hit
            { x: 7, y: 0.001 }, // These points coalesce
            { x: 8, y: 0.999 }, //   '
            { x: 9, y: 350 },  // Significant hit
        ];
    });
    describe('coalesce_points', function () {
        function _numeric_to_fixed(item) {
            Object.keys(item).forEach(function (key) {
                item[key] = item[key].toFixed ? item[key].toFixed(5) : item[key];
            });
            return item;
        }

        it('handles wide spans for any y within bounds', function () {
            var actual = coalesce_points(
                this.sample_data,
                'x',
                'y',
                3, -Infinity, Infinity,
                Infinity, 0, 1
            );

            actual = actual.map(_numeric_to_fixed);
            var expected = [
                { x: '1.00000', y: '0.79967', lz_weight: '3.00000' },
                { x: '3.00000', y: '7.40000' },
                { x: '4.50000', y: '0.02550', lz_weight: '2.00000' },
                { x: '6.00000', y: '128.00000' },
                { x: '7.50000', y: '0.50000', lz_weight: '2.00000' },
                { x: '9.00000', y: '350.00000' },
            ];
            // assert.equal(actual.length, expected.length);
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it('handles narrow spans with y bounds', function () {
            var actual = coalesce_points(
                this.sample_data,
                'x',
                'y',
                1, -Infinity, Infinity,
                Infinity, 0, 1
            );
            actual = actual.map(_numeric_to_fixed);
            var expected = [
                { x: '0.50000', y: '0.70000', lz_weight: '2.00000' },
                { x: '2.00000', y: '0.99900' },
                { x: '3.00000', y: '7.40000' },
                { x: '4.50000', y: '0.02550', lz_weight: '2.00000' },
                { x: '6.00000', y: '128.00000' },
                { x: '7.50000', y: '0.50000', lz_weight: '2.00000' },
                { x: '9.00000', y: '350.00000' },
            ];

            // assert.equal(actual.length, expected.length);
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it('gap is determined by absolute distance, not nearest point', function () {
            // For points A, B, and C, the gap is determined by A-C, not (synthetic point A-B)-C
            var actual = coalesce_points(
                this.sample_data,
                'x',
                'y',
                1.75, -Infinity, Infinity,  // From sample data: verify that x = 0.5 and x = 2 don't combine
                Infinity, 0, 1
            );
            actual = actual.map(_numeric_to_fixed);
            var expected = [
                { x: '0.50000', y: '0.70000', lz_weight: '2.00000' },
                { x: '2.00000', y: '0.99900' },
                { x: '3.00000', y: '7.40000' },
                { x: '4.50000', y: '0.02550', lz_weight: '2.00000' },
                { x: '6.00000', y: '128.00000' },
                { x: '7.50000', y: '0.50000', lz_weight: '2.00000' },
                { x: '9.00000', y: '350.00000' },
            ];

            // assert.equal(actual.length, expected.length);
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it('handles wide spans, and considers how close y values are', function () {
            var actual = coalesce_points(
                this.sample_data,
                'x',
                'y',
                3, -Infinity, Infinity,
                0.5, 0, 1.0
            );

            actual = actual.map(_numeric_to_fixed);
            var expected = [
                { x: '1.00000', y: '0.79967', lz_weight: '3.00000' },
                { x: '3.00000', y: '7.40000' },
                { x: '4.50000', y: '0.02550', lz_weight: '2.00000' },
                { x: '6.00000', y: '128.00000' },
                { x: '7.00000', y: '0.00100' },
                { x: '8.00000', y: '0.99900' },
                { x: '9.00000', y: '350.00000' },
            ];
            assert.equal(actual.length, expected.length, 'Found correct number of items');
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });
    });
});
