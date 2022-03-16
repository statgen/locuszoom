import {assert} from 'chai';
import * as d3 from 'd3';

import {populate} from '../../../../esm/helpers/display';
import {DATA_LAYERS} from '../../../../esm/registry';
import DataSources from '../../../../esm/data';


describe('highlight_regions data layer', function () {
    describe('layout validation', function () {
        it('must choose to specify data from regions or fields, but not both', function () {
            const layout = {
                regions: [{start: 1, end: 12}],
                namespace: { 'mydata': 'mydata' },
            };
            assert.throws(
                () => DATA_LAYERS.create('highlight_regions', layout),
                /not both/,
                'Invalid layout options should trigger an error',
            );
        });
        it('does not allow mouse interaction', function () {
            assert.throws(
                () => DATA_LAYERS.create('highlight_regions', { interaction: {}, behaviors: [] }),
                /mouse events/,
                'Invalid layout options should trigger an error',
            );
        });
    });
    describe('data operations', function () {
        beforeEach(function () {
            this.data = [
                {start: 1, end: 100, category: 'a'}, // merge 2
                {start: 25, end: 75, category: 'b'},
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

    describe('rendering', function() {
        beforeEach(function() {
            const layout = {
                width: 100,
                state: {chr: '1', start: 1, end: 36},
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                type: 'highlight_regions',
                                regions: [{start: 1, end: 12}, {start: 24, end: 36}],
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            const sources = new DataSources()
                .add('intervals', ['StaticJSON', { data: [{start: 1, end: 2}] }]);
            this.plot = populate('#plot', sources, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('can render data from regions in layout', function () {
            return this.plot.applyState().then(() => {
                assert.equal(this.plot.panels.p.data_layers.d.svg.group.selectAll('rect').size(), 2, 'Layer draws two regions as specified in the layout');
            });
        });
        it('can render data from regions in data source', function () {
            // Rejigger the original plot layout to work in "datasource mode"
            const layer = this.plot.panels.p.data_layers.d;
            const d_layout = layer.layout;
            Object.assign(d_layout, {
                namespace: { intervals: 'intervals'},
                start_field: 'intervals:start',
                end_field: 'intervals:end',
                regions: [],
            });
            layer.mutateLayout(); // Manually tell the layer that data rules have changed for this specific test
            return this.plot.applyState().then(() => {
                assert.equal(layer.svg.group.selectAll('rect').size(), 1, 'Layer draws one region as pulled from the datasource');
            });
        });
    });
});


