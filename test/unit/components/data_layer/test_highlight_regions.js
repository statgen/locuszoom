import {assert} from 'chai';

import {DATA_LAYERS} from '../../../../esm/registry';


describe('highlight_regions data layer', function () {
    beforeEach(function () {
        this.data = [
            {start: 1, end: 100, category: 'a'}, // merge 2
            { start: 25, end: 75, category: 'b' },
            {start: 50, end: 150, category: 'a'},
            {start: 200, end: 300, category: 'a'}, // take as is
            {start: 400, end: 450, category: 'a'}, // merge 2
            {start: 425, end: 448, category: 'a'},
        ];
    });
    it('will show all data given if no merge_field is specified', function () {
        const layout = { merge_field: null };
        const instance = DATA_LAYERS.create('highlight_regions', layout);
        assert.deepEqual(instance._mergeNodes(this.data), this.data, 'If no merge is specified, data is unchanged');
    });
    it('will merge adjacent nodes of the same type but preserve categories', function () {
        const layout = { merge_field: 'category' };
        const instance = DATA_LAYERS.create('highlight_regions', layout);
        const expected = [
            {start: 1, end: 150, category: 'a'},
            {start: 200, end: 300, category: 'a'},
            {start: 400, end: 450, category: 'a'},
            {start: 25, end: 75, category: 'b'},
        ];
        assert.deepEqual(instance._mergeNodes(this.data), expected, 'Merged fields respect categories and groups');
    });
});


