import DataSources from '../../../esm/data';
import * as d3 from 'd3';
import {populate} from '../../../esm/helpers/display';
import {assert} from 'chai';
import sinon from 'sinon';


describe('Toolbar widgets', function () {
    describe('Region Scale Widget', function() {
        beforeEach(function() {
            var datasources = new DataSources();
            var layout = {
                state: {
                    chr: 1,
                    start: 126547453,
                    end: 126847453,
                },
                toolbar: {
                    widgets: [
                        { type: 'region_scale' },
                    ],
                },
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('Should show initial region scale from state', function() {
            assert.equal(this.plot.toolbar.widgets[0].selector.html(), '300.00 Kb');
        });
        it('Should show updated region scale from state as state region boundaries change', function() {
            return this.plot.applyState({ chr: 1, start: 126547453, end: 126947453 }).then(() => {
                assert.equal(this.plot.toolbar.widgets[0].selector.html(), '400.00 Kb');
            });
        });
    });

    describe('Filter fields Widget', function () {
        beforeEach(function() {
            const datasources = new DataSources()
                .add('d', ['StaticJSON', {data: [{ id: 1, a: 12 }] }]);
            const layout = {
                panels: [{
                    id: 'p',
                    toolbar: {
                        widgets: [
                            {
                                type: 'filter_field',
                                position: 'right',
                                layer_name: 'd',
                                field: 'd:a',
                                field_display_html: 'Some Name',
                                operator: '!=',
                                data_type: 'number',
                            },
                        ],
                    },
                    data_layers: [
                        {
                            id: 'd',
                            namespace: {d: 'd'},
                            id_field: 'd:id',
                            type: 'scatter',
                        },
                    ],
                }],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
            this.data_layer = this.plot.panels['p'].data_layers['d'];
            this.widget = this.data_layer.parent.toolbar.widgets[0];
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });

        it('creates a filter if none is present in config', function() {
            assert.equal(this.data_layer.layout.filters, null, 'No filters at start');

            const target = this.widget._getTarget();
            assert.deepEqual(target, {field: 'd:a', operator: '!=', value: null}, 'Auto-create blank filter');
        });

        it('updates an existing filter if already present', function() {
            this.data_layer.layout.filters = [{field: 'd:a', operator: '!=', value: 1}];

            this.widget._setFilter(5);
            const target = this.widget._getTarget();
            assert.equal(this.data_layer.layout.filters.length, 1, 'No second filter created');
            assert.deepEqual(target, {field: 'd:a', operator: '!=', value: 5}, 'Updates filter with new value');
        });

        it('sends an event when the widget is updated', function () {
            const widget_spy = sinon.spy();
            this.plot.on('widget_filter_field_action', widget_spy);
            this.plot.on('custom_name', widget_spy);

            this.widget._setFilter(12);

            const expected = {field: 'd:a', operator: '!=', value: 12, filter_id: null};
            assert.ok(widget_spy.calledOnce, 'Widget event was fired');
            assert.deepEqual(widget_spy.firstCall.args[0].data, expected, 'Filter widget fired an event');

            this.widget._event_name = 'custom_name';
            this.widget._setFilter(12);
            assert.ok(widget_spy.calledTwice, 'Widget event was fired again, under the custom event name');
            assert.deepEqual(widget_spy.secondCall.args[0].data, expected, 'Filter widget fired an event under a custom name');
        });

        it('finds a specific filter (by id field) when more than one with same operation is used', function() {
            this.widget._filter_id = 'target';
            this.data_layer.layout.filters = [
                {field: 'd:a', operator: '!=', value: null},
                {field: 'd:a', operator: '!=', value: 'squid', id: 'target'},
                {field: 'd:a', operator: '!=', value: 'cephalopod', id: 'detroit'},
            ];

            this.widget._setFilter('al');
            // assert.equal(this.data_layer.layout.filters.length, 3, '3 filters at end');
            assert.deepEqual(
                this.data_layer.layout.filters,
                [
                    {field: 'd:a', operator: '!=', value: null},
                    {field: 'd:a', operator: '!=', value: 'al', id: 'target'},
                    {field: 'd:a', operator: '!=', value: 'cephalopod', id: 'detroit'},
                ], 'Updates filter with new value');
        });

        it('validates values and coerces types', function() {
            const scenarios = [
                ['0', 0],
                ['', null],
                ['notanumber', null],
            ];
            // This test requires the widget actually be rendered
            this.widget.parent.show();
            this.widget.update();
            scenarios.forEach(([input, output]) => {
                this.widget._value_selector.property('value', input);
                assert.equal(
                    this.widget._getValue(),
                    output,
                    `Number conversion should convert input ${input} to output ${output}`,
                );
            });
        });

        it('clears the filter if no valid option is provided', function() {
            this.widget.parent.show();
            this.widget.update();
            this.widget._setFilter(12);
            assert.equal(this.data_layer.layout.filters.length, 1, 'Filter has been created');

            this.widget._setFilter(null);
            assert.equal(this.data_layer.layout.filters.length, 0, 'Filter has been removed');
        });
    });

    describe('set_state widget', function () {
        beforeEach(function() {
            const datasources = new DataSources()
                .add('d', ['StaticJSON', {data: [{ id: 1, a: 12 }] }]);
            const layout = {
                toolbar: {
                    widgets: [
                        {
                            type: 'set_state',
                            tag: 'test_widget',
                            position: 'right',
                            button_html: 'Your choice: ',
                            show_selected: true,
                            custom_event_name: 'test_choice',
                            state_field: 'chosen_state',
                            options: [
                                { display_name: 'ALL (default)', value: 'ALL' },
                                { display_name: 'Custom', value: 'CUSTOM' },
                            ],
                        },
                    ],
                },
                panels: [{
                    id: 'p',
                    data_layers: [
                        {
                            id: 'd',
                            namespace: {d: 'd'},
                            id_field: 'd:id',
                            type: 'scatter',
                        },
                    ],
                }],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
            this.data_layer = this.plot.panels['p'].data_layers['d'];
            this.widget = this.plot.toolbar.widgets[0];
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });

        it('Updates plot state when a choice is selected', function () {
            this.widget.button.menu.show(); // show menu so that clickable radios are present
            // Simulate user click on one element
            this.plot.container.querySelector('* [name^="set-state"][value="1"]').click();

            return this.plot.applyState().then(() => {
                assert.equal(this.widget._selected_item, 'CUSTOM', 'clicking item changes internal selection');
                assert.equal(this.plot.state.chosen_state, 'CUSTOM', 'plot state updated to reflect user click');
                assert.equal(this.widget.button.html, 'Your choice: CUSTOM', 'Selection (or default) is reflected in button text');
            });
        });

        it('Shows user selection as part of button text', function () {
            assert.equal(this.widget.button.html, 'Your choice: ALL', 'Selection (or default) is reflected in button text');
        });

        it('Fires an event describing the item selected', function (done) {
            this.plot.on('test_choice', (event) => {
                assert.deepEqual(event.data, { choice_name: 'Custom', choice_value: 'CUSTOM', state_field: 'chosen_state'});
                done();
            });


            this.widget.button.menu.show();

            // Simulate user click on one element. Should trigger the callback defined above.
            this.plot.container.querySelector('* [name^="set-state"][value="1"]').click();
        });
    });
});
