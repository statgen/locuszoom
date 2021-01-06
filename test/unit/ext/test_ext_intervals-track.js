import {assert} from 'chai';
import sinon from 'sinon';

import LocusZoom from 'locuszoom';
import {DATA_LAYERS, LAYOUTS} from '../../../esm/registry';
import intervals_plugin from '../../../esm/ext/lz-intervals-track';
import DataSources from '../../../esm/data';
import * as d3 from 'd3';
import {populate} from '../../../esm/helpers/display';

/**
 * Interval annotation track
 */
describe('Interval annotation track', function () {
    before(function() {
        LocusZoom.use(intervals_plugin);
    });

    describe('Auto-create legend from best available data', function () {
        const find_color_options = function (layout) {
            return layout.color.find(function (item) {
                return item.scale_function === 'categorical_bin';
            });
        };

        beforeEach(function () {
            const layout = LAYOUTS.get('data_layer', 'intervals', {
                // Unit tests will use the most rigorous form of the track (coloring and separation are determined by
                //  a unique ID that is separate from the label)
                track_split_field: '{{namespace[intervals]}}state_id',
            });
            const instance = DATA_LAYERS.create('intervals', layout);
            this.instance = instance;
            this.color_config = find_color_options(instance._base_layout);
            this.color_config.field = '{{namespace[intervals]}}state_id';
            this.legend_config = instance._base_layout.legend;
        });

        it('uses the existing layout, unchanged, when a legend and color are specified', function () {
            // Note: if options are provided, they are not checked for consistency with themselves or data.
            this.instance.data = [{something: 1, other: 2}];

            this.instance._base_layout.legend = [{label: 'Walrus', color: 'not'}];
            this.color_config.parameters.categories = ['nonsense', 'twaddle', 'somesuch'];
            this.color_config.parameters.values = ['#FF0000', '#00FF00', '#0000FF'];

            // Apply the test-specific rewrites
            this.instance.layout = this.instance._base_layout;

            // Color and legend are unchanged after applying options
            this.instance._applyLayoutOptions();
            assert.deepEqual(
                this.color_config,
                // Note we are comparing base layout (before auto-gen) to dynamic layout (after)
                find_color_options(this.instance.layout)
            );
            assert.deepEqual(this.instance.layout.legend, this.instance._base_layout.legend);
        });

        it('throws an error when legend (but not color) options are specified', function () {
            this.instance._base_layout.legend = [{filler: 'Hi'}];
            assert.throws(() => {
                this.instance._applyLayoutOptions();
            }, /must be set/);
        });

        it('builds a legend based on data itemRgb values if present', function () {
            this.instance.data = [
                // Interesting property of real data: sometimes two HMM models are assigned the same label.
                //   State id is considered the unambiguous identifier.
                { 'intervals:state_name': 'Strong enhancer', 'intervals:state_id': 1, 'intervals:itemRgb': '#FF0000' },
                { 'intervals:state_name': 'Weak enhancer', 'intervals:state_id': 2, 'intervals:itemRgb': '#00FF00' },
                { 'intervals:state_name': 'Strong enhancer', 'intervals:state_id': 1, 'intervals:itemRgb': '#FF0000' },
                { 'intervals:state_name': 'Strong enhancer', 'intervals:state_id': 3, 'intervals:itemRgb': '#0000FF' },
            ];

            this.instance._applyLayoutOptions();
            assert.equal(this.color_config.parameters.categories.length, 0, 'Initial color configuration is left unchanged');
            assert.equal(this.legend_config.length, 0, 'Initial legend configuration is left unchanged');

            const final_legend = this.instance.layout.legend;
            const final_colors = find_color_options(this.instance.layout);
            assert.deepEqual(final_colors.parameters.categories, [1, 2, 3], 'Unique categories are generated');
            assert.deepEqual(final_colors.parameters.values, ['#FF0000', '#00FF00', '#0000FF'], 'Unique color options are tracked');
            assert.deepEqual(
                final_legend,
                [
                    { color: '#FF0000', 'intervals:state_id': 1, label: 'Strong enhancer', shape: 'rect', 'width': 9 },
                    { color: '#00FF00', 'intervals:state_id': 2, label: 'Weak enhancer', shape: 'rect', 'width': 9 },
                    { color: '#0000FF', 'intervals:state_id': 3, label: 'Strong enhancer', shape: 'rect', 'width': 9 },
                ],
                'Legend items map the correct stateID and colors together'
            );
        });

        it('builds a color scheme based on data state_id_field (and preset color scheme)', function () {
            this.instance.data = [
                // Note: some data has itemRgb field (sans value) and some lacks field entirely. The absence of values
                //  (as null or undefined) causes itemRgb to not be considered in crafting color scheme.
                { 'intervals:state_name': 'Strong enhancer', 'intervals:state_id': 1, 'intervals:itemRgb': null },
                { 'intervals:state_name': 'Weak enhancer', 'intervals:state_id': 2, 'intervals:itemRgb': null },
                { 'intervals:state_name': 'Strong enhancer', 'intervals:state_id': 1  },
                { 'intervals:state_name': 'Strong enhancer', 'intervals:state_id': 3 },
            ];

            this.instance._applyLayoutOptions();
            assert.equal(this.color_config.parameters.categories.length, 0, 'Initial color configuration is left unchanged');
            assert.equal(this.legend_config.length, 0, 'Initial legend configuration is left unchanged');

            const final_legend = this.instance.layout.legend;
            const final_colors = find_color_options(this.instance.layout);
            assert.deepEqual(final_colors.parameters.categories, [1, 2, 3], 'Unique categories are generated');
            assert.deepEqual(
                final_colors.parameters.values,
                ['rgb(212,212,212)', 'rgb(192,192,192)', 'rgb(128,128,128)', 'rgb(189,183,107)', 'rgb(233,150,122)', 'rgb(205,92,92)', 'rgb(138,145,208)', 'rgb(102,205,170)', 'rgb(255,255,0)', 'rgb(194,225,5)', 'rgb(0,100,0)', 'rgb(0,128,0)', 'rgb(50,205,50)', 'rgb(255,69,0)', 'rgb(255,0,0)'],
                'The smallest preset color scheme that fits data size will be used'
            );
            assert.deepEqual(
                final_legend,
                [
                    { color: 'rgb(212,212,212)', 'intervals:state_id': 1, label: 'Strong enhancer', shape: 'rect', 'width': 9 },
                    { color: 'rgb(192,192,192)', 'intervals:state_id': 2, label: 'Weak enhancer', shape: 'rect', 'width': 9 },
                    { color: 'rgb(128,128,128)', 'intervals:state_id': 3, label: 'Strong enhancer', shape: 'rect', 'width': 9 },
                ],
                'Legend items map the correct stateID and colors together'
            );
        });
    });

    describe('collision detection and category grouping', function () {
        beforeEach(function() {
            this.plot = null;
            const data_sources = new DataSources()
                .add('intervals', ['StaticJSON', [
                    { start: 100, end: 200, state_id: 'thing1', state_name: 'redfish', itemRgb: '255,0,0' },
                ]]);

            const layout = {
                panels: [ LAYOUTS.get('panel', 'intervals') ],
                state: { chr: 'X', start: 1, end: 500 },
                width: 800,
            };
            layout.panels[0].data_layers[0].split_tracks = true;

            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
            this._intervals_source = data_sources.get('intervals');
            this._intervals_layer = this.plot.panels.intervals.data_layers.intervals;
        });

        it('re-renders the y-axis when categories change', function () {
            return this.plot.applyState().then(() => {
                assert.deepEqual(this._intervals_layer._categories, ['redfish'], 'Correct initial categories');

                const renderSpy = sinon.spy(this._intervals_layer, 'updateSplitTrackAxis');

                // Replace the original data and trigger a synchronous re-render (no new data fetching)
                this._intervals_layer.data = [{ 'intervals:start': 100, 'intervals:end': 200, 'intervals:state_id': 'thing1', 'intervals:state_name': 'bluefish', 'intervals:itemRgb': '0,0,255' }];
                this._intervals_layer.render();

                assert.ok(renderSpy.called, 'Axis was updated');
                assert.ok(renderSpy.calledWith(['bluefish']), 'Correct new categories were received');
                assert.deepEqual(this._intervals_layer._categories, ['bluefish'], 'Correct final categories');
            });
        });

        it('does not re-render the y-axis when categories stay the same', function () {
            return this.plot.applyState().then(() => {
                assert.deepEqual(this._intervals_layer._categories, ['redfish'], 'Correct initial categories');

                const renderSpy = sinon.spy(this._intervals_layer, 'updateSplitTrackAxis');

                // Replace the original data and trigger a synchronous re-render (no new data fetching)
                this._intervals_layer.data = [ // Same number of categories as original, different # of items
                    { 'intervals:start': 100, 'intervals:end': 200, 'intervals:state_id': 'thing1', 'intervals:state_name': 'redfish', 'intervals:itemRgb': '255,0,0' },
                    { 'intervals:start': 101, 'intervals:end': 201, 'intervals:state_id': 'thing2', 'intervals:state_name': 'redfish', 'intervals:itemRgb': '255,0,0' },
                ];
                this._intervals_layer.render();

                assert.ok(renderSpy.notCalled, 'Axis was not updated');
                assert.deepEqual(this._intervals_layer._categories, ['redfish'], 'Correct final categories');
            });
        });

        it('draw status nodes only when relevant', function () {
            return this.plot.applyState().then(() => {
                const status_nodes = this._intervals_layer._statusnodes_group.node();
                assert.equal(status_nodes.childElementCount, 1, 'In split mode, 1 category means 1 status node');

                // Selecting an element should also trigger a nice display for the associated "status node" background rectangle
                const element = this._intervals_layer.data[0];
                assert.notOk(status_nodes.children[0].classList.contains('lz-data_layer-intervals-statusnode-selected'), 'Unselected elements are not styled as highlighted');
                this._intervals_layer.setElementStatus('selected', element, true, true);
                assert.ok(status_nodes.children[0].classList.contains('lz-data_layer-intervals-statusnode-selected'), 'Selected elements get a highlighted style');

                // Switch to merged tracks mode and count again
                this._intervals_layer.layout.split_tracks = false;
                this._intervals_layer.render();
                assert.equal(status_nodes.childElementCount, 0, 'No status nodes are rendered in merged tracks mode');
            });
        });

        afterEach(function () {
            sinon.restore();
        });
    });
});
