/**
 Test rendering helpers
 */
import {assert} from 'chai';
import {coalesce_scatter_points} from '../../../esm/helpers/render';

const xcs = Symbol.for('lzX');
const ycs = Symbol.for('lzY');

describe('Coordinate coalescing', function () {

    function _addSymbols(data) {
        // internally the coalescing logic depends on a special JS symbol (pixel position) that doesn't collide with
        //  data fields (data value). These symbols don't show up in debug output, so this function adds them to test
        //  data to aid debugging. (eg x is human readable, but Symbol(x) is what the code uses)
        data.forEach((item) => {
            item[xcs] = item.x;
            item[ycs] = item.y;
        });
        return data;
    }

    beforeEach(function () {
        // Sample data intended to coalesce into ~6 points total. Note the use of JS symbols, not field names, to
        //  denote the x field- this is an internal implementation detail to keep the special functionality from
        //  colliding with user data.

        this.sample_data = _addSymbols([ // Below are some notes for xgap = 3, ygap N/A. Other tests may vary.
            { x: 0, y: 0.5 }, // These points coalesce (using x cutoffs)
            { x: 1, y: 0.9 }, //     '
            { x: 2, y: 0.999 }, //  Single point near significant
            { x: 3, y: 7.4 }, // Significant hit
            { x: 4, y: 0.001 }, // These points coalesce
            { x: 5, y: 0.05 }, //   '
            { x: 6, y: 128.0 }, // Significant hit
            { x: 7, y: 0.001 }, // These points coalesce
            { x: 8, y: 0.999 }, //   '
            { x: 9, y: 350 },  // Significant hit
        ]);
    });
    describe('coalesce_scatter_points', function () {
        it('handles wide spans for any y within bounds', function () {
            const actual = coalesce_scatter_points(
                this.sample_data,
                -Infinity, Infinity, 3,
                0, 1, Infinity
            );
            const expected = _addSymbols([
                { x: 1, y: 0.9 },
                { x: 3, y: 7.4 },
                { x: 4, y: 0.001 },
                { x: 6, y: 128 },
                { x: 7, y: 0.001 },
                { x: 9, y: 350 },
            ]);
            // assert.equal(actual.length, expected.length);
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it('handles narrow spans with y bounds', function () {
            const actual = coalesce_scatter_points(
                this.sample_data,
                -Infinity, Infinity, 1,
                0, 1, Infinity
            );
            const expected = _addSymbols([
                { x: 0, y: 0.5 },
                { x: 2, y: 0.999 },
                { x: 3, y: 7.4 },
                { x: 4, y: 0.001 },
                { x: 6, y: 128 },
                { x: 7, y: 0.001 },
                { x: 9, y: 350 },
            ]);

            // assert.equal(actual.length, expected.length);
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it('gap is determined by absolute distance, not nearest point', function () {
            // For points A, B, and C, the gap is determined by A-C, not (synthetic point A-B)-C
            const actual = coalesce_scatter_points(
                this.sample_data,
                -Infinity, Infinity, 1.75,  // From sample data: verify that x = 0.5 and x = 2 don't combine
                0, 1, Infinity
            );
            const expected = _addSymbols([
                { x: 0, y: 0.5 },
                { x: 2, y: 0.999 },
                { x: 3, y: 7.40000 },
                { x: 4, y: 0.001 },
                { x: 6, y: 128.0 },
                { x: 7, y: 0.001 },
                { x: 9, y: 350 },
            ]);

            // assert.equal(actual.length, expected.length);
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it('handles wide spans, and considers how close y values are', function () {
            const actual = coalesce_scatter_points(
                this.sample_data,
                -Infinity, Infinity, 3,
                0.0, 1, 0.5
            );
            const expected = _addSymbols([
                { x: 1, y: 0.9 },
                { x: 3, y: 7.4 },
                { x: 4, y: 0.001 },
                { x: 6, y: 128 },
                { x: 7, y: 0.001 },  // due to small ygap, 7 and 8 are not combined
                { x: 8, y: 0.999 },
                { x: 9, y: 350 },
            ]);
            assert.equal(actual.length, expected.length, 'Found correct number of items');
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it('always adds points that are explicitly marked significant', function () {
            const sample_data = _addSymbols([
                { x: 0, y: 0.5, lz_highlight_match: true },
                { x: 1, y: 0.9, lz_highlight_match: true },
                { x: 2, y: 0.999, lz_highlight_match: true },
            ]);
            const actual = coalesce_scatter_points(
                sample_data,
                -Infinity, Infinity, 3,
                0, 1, Infinity
            );
            assert.deepStrictEqual(actual, sample_data, 'Significant points do not coalesce');
        });
    });
});
