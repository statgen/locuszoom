import {assert} from 'chai';
import * as d3 from 'd3';
import sinon from 'sinon';

import { MATCHERS, SCALABLE } from '../../../esm/registry';
import BaseDataLayer from '../../../esm/components/data_layer/base';
import {populate} from '../../../esm/helpers/display';
import DataSources from '../../../esm/data';

/**
 DataLayer.js Tests
 Test composition of the LocusZoom.Panel object and its base classes
 */
describe('LocusZoom.DataLayer', function () {
    describe('data contract parsing and validation', function () {
        beforeEach(function () {
            const layer = this.layer = new BaseDataLayer({ id: 'something' });
            layer.parent_plot = { state: {} };
            layer._data_contract = new Set(['assoc:variant', 'assoc:rsid']);
        });

        afterEach(function() {
            sinon.restore();
        });

        it('warns if the data received does not match the inferred fields contract', function () {
            let spy = sinon.spy(console, 'warn');
            this.layer.data = [{ 'assoc:variant': '1:23_A/B', 'assoc:position': 23 }];
            this.layer.applyDataMethods();
            assert.ok(spy.calledTwice, 'Console.warn was called with data contract errors');
            assert.ok(spy.firstCall.args[0].match(/Missing fields are: assoc:rsid/), 'Developer message identifies the missing fields');
        });

        it('will treat the fields contract as satisfied if the field is in at least one record of the response', function () {
            let spy = sinon.spy(console, 'warn');
            this.layer.data = [
                { 'assoc:variant': '1:23_A/B', 'assoc:position': 23 },
                { 'assoc:variant': '1:24_A/B', 'assoc:position': 24, 'assoc:rsid': 'rsYuppers' },
            ];
            this.layer.applyDataMethods();
            assert.ok(spy.notCalled, 'Console.warn was not called with contract errors');
        });
    });

    describe('Z-index sorting', function () {
        beforeEach(function () {
            const layout = {
                width: 800,
                panels: [
                    {
                        id: 'panel0',
                        height: 400,
                        data_layers: [
                            { id: 'layerA', type: 'line' },
                            { id: 'layerB', type: 'line' },
                            { id: 'layerC', type: 'line' },
                            { id: 'layerD', type: 'line' },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', null, layout);
        });

        afterEach(function () {
            d3.select('#plot').remove();
            this.plot = null;
        });

        it('should have a chainable method for moving layers up that stops at the top', function () {
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerB', 'layerC', 'layerD']);

            this.plot.panels.panel0.data_layers.layerB.moveForward();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);

            this.plot.panels.panel0.data_layers.layerB.moveForward();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerD', 'layerB']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 3);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 2);

            this.plot.panels.panel0.data_layers.layerB.moveForward().moveForward();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerD', 'layerB']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 3);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 2);
        });

        it('should have a chainable method for moving layers down that stops at the bottom', function () {
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerB', 'layerC', 'layerD']);

            this.plot.panels.panel0.data_layers.layerC.moveBack();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);

            this.plot.panels.panel0.data_layers.layerC.moveBack();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerC', 'layerA', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);

            this.plot.panels.panel0.data_layers.layerC.moveBack().moveBack();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerC', 'layerA', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);
        });
    });

    describe('Scalable parameter resolution', function () {
        it('passes numbers and strings directly through regardless of data', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            this.layout = { scale: 'foo' };
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, {}), 'foo');
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, { foo: 'bar' }), 'foo');
            this.layout = { scale: 17 };
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, {}), 17);
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, { foo: 'bar' }), 17);
        });

        it('executes a scale function for the data provided', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            const layout = {
                scale: {
                    scale_function: 'categorical_bin',
                    field: 'test',
                    parameters: {
                        categories: ['lion', 'tiger', 'bear'],
                        values: ['dorothy', 'toto', 'scarecrow'],
                    },
                },
            };
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'lion' }), 'dorothy');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'manatee' }), null);
            assert.equal(datalayer.resolveScalableParameter(layout.scale, {}), null);
        });

        it('can operate in a state-aware manner based on index in data[]', function () {
            SCALABLE.add('fake', (parameters, input, index) => index);
            const datalayer = new BaseDataLayer({ id: 'test' });
            const config = { scale_function: 'fake' };
            // The same input value will yield a different scaling function result, because position in data matters.
            assert.equal(datalayer.resolveScalableParameter(config, 'avalue', 0), 0);
            assert.equal(datalayer.resolveScalableParameter(config, 'avalue', 1), 1);

            // Clean up/ deregister scale function when done
            SCALABLE.remove('fake');
        });

        it('supports operating on an entire data element in the absence of a specified field', function () {
            SCALABLE.add('test_effect_direction', function (parameters, input) {
                if (typeof input == 'undefined') {
                    return null;
                } else if ((input.beta && input.beta > 0) || (input.or && input.or > 0)) {
                    return parameters['+'] || null;
                } else if ((input.beta && input.beta < 0) || (input.or && input.or < 0)) {
                    return parameters['-'] || null;
                }
                return null;
            });
            const datalayer = new BaseDataLayer({ id: 'test' });
            const layout = {
                scale: {
                    scale_function: 'test_effect_direction',
                    parameters: {
                        '+': 'triangle-up',
                        '-': 'triangle-down',
                    },
                },
            };
            const variants = [{ beta: 0.5 }, { beta: -0.06 }, { or: -0.34 }, { or: 1.6 }, { foo: 'bar' }];
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[0]), 'triangle-up');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[1]), 'triangle-down');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[2]), 'triangle-down');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[3]), 'triangle-up');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[4]), null);

            // Clean up/ deregister scale function when done
            SCALABLE.remove('test_effect_direction');
        });

        it('iterates over an array of options until exhausted or a non-null value is found', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            const layout = {
                scale: [
                    {
                        scale_function: 'if',
                        field: 'test',
                        parameters: {
                            field_value: 'wizard',
                            then: 'oz',
                        },
                    },
                    {
                        scale_function: 'categorical_bin',
                        field: 'test',
                        parameters: {
                            categories: ['lion', 'tiger', 'bear'],
                            values: ['dorothy', 'toto', 'scarecrow'],
                        },
                    },
                    'munchkin',
                ],
            };
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'wizard' }), 'oz');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'tiger' }), 'toto');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'witch' }), 'munchkin');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, {}), 'munchkin');
        });

        it('can resolve based on an annotation field, even when no point data field by that name is present', function () {
            const layout = {
                id: 'somelayer',
                id_field: 'id',
                scale: [
                    {
                        scale_function: 'if',
                        field: 'custom_field',
                        parameters: { field_value: 'little_dog', then: 'too' },
                    },
                ],
            };
            const datalayer = new BaseDataLayer(layout);
            datalayer.setElementAnnotation({id: 'toto'}, 'custom_field', 'little_dog');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { id: 'toto' }), 'too');
        });
    });

    describe('Extent generation', function () {
        it('throws an error on invalid axis identifiers', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            assert.throws(function() {
                datalayer.getAxisExtent();
            });
            assert.throws(function() {
                datalayer.getAxisExtent('foo');
            });
            assert.throws(function() {
                datalayer.getAxisExtent(1);
            });
            assert.throws(function() {
                datalayer.getAxisExtent('y1');
            });
        });

        it('generates an accurate extent array for arbitrary data sets', function () {
            const layout = {
                id: 'test',
                x_axis: { field: 'x' },
            };
            const datalayer = new BaseDataLayer(layout);

            datalayer.data = [];
            assert.deepEqual(datalayer.getAxisExtent('x'), [], 'No extent is returned if basic criteria cannot be met');

            datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [1, 4]);

            datalayer.data = [
                { x: 200 }, { x: -73 }, { x: 0 }, { x: 38 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-73, 200]);

            datalayer.data = [
                { x: 6 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [6, 6]);

            datalayer.data = [
                { x: 'apple' }, { x: 'pear' }, { x: 'orange' },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [undefined, undefined]);
        });

        it('applies upper and lower buffers to extents as defined in the layout', function () {
            let layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    lower_buffer: 0.05,
                },
            };
            let datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0.85, 4]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    upper_buffer: 0.2,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 62 }, { x: 7 }, { x: -18 }, { x: 106 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-18, 130.8]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    lower_buffer: 0.35,
                    upper_buffer: 0.6,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 95 }, { x: 0 }, { x: -4 }, { x: 256 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-95, 412]);
        });

        it('applies a minimum extent as defined in the layout', function () {
            let layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 3],
                },
            };
            let datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 4], 'Increase extent exactly to the boundaries when no padding is specified');

            datalayer.data = [];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 3], 'If there is no data, use the specified min_extent as given');

            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    upper_buffer: 0.1,
                    lower_buffer: 0.2,
                    min_extent: [0, 10],
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 10], 'Extent is enforced but no padding applied when data is far from boundary');

            datalayer.data = [
                { x: 0.6 }, { x: 4 }, { x: 5 }, { x: 9 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-1.08, 10], 'Extent is is enforced and padding is applied when data is close to the lower boundary');

            datalayer.data = [
                { x: 0.4 }, { x: 4 }, { x: 5 }, { x: 9.8 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-1.48, 10.74], 'Padding is enforced on both sides when data is close to both boundaries');

        });

        it('applies hard floor and ceiling as defined in the layout', function () {
            let layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [6, 10],
                    lower_buffer: 0.5,
                    floor: 0,
                },
            };
            let datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 8 }, { x: 9 }, { x: 8 }, { x: 8.5 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 10]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 10],
                    upper_buffer: 0.8,
                    ceiling: 5,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 5]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 10],
                    lower_buffer: 0.8,
                    upper_buffer: 0.8,
                    floor: 4,
                    ceiling: 6,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 2 }, { x: 4 }, { x: 5 }, { x: 17 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [4, 6]);
        });
    });

    describe('Layout Parameters', function () {
        beforeEach(function () {
            this.plot = null;
            this.layout = {
                panels: [
                    {
                        id: 'p1',
                        data_layers: [],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
        });

        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });

        it('should allow for explicitly setting data layer z_index', function () {
            this.layout.panels[0].data_layers = [
                { id: 'd1', type: 'line', z_index: 1 },
                { id: 'd2', type: 'line', z_index: 0 },
            ];
            this.plot = populate('#plot', null, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ['d2', 'd1']);
            assert.equal(this.plot.panels.p1.data_layers.d1.layout.z_index, 1);
            assert.equal(this.plot.panels.p1.data_layers.d2.layout.z_index, 0);
        });

        it('should allow for explicitly setting data layer z_index with a negative value', function () {
            this.layout.panels[0].data_layers = [
                { id: 'd1', type: 'line' },
                { id: 'd2', type: 'line' },
                { id: 'd3', type: 'line' },
                { id: 'd4', type: 'line', z_index: -1 },
            ];
            this.plot = populate('#plot', null, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ['d1', 'd2', 'd4', 'd3']);
            assert.equal(this.plot.panels.p1.data_layers.d1.layout.z_index, 0);
            assert.equal(this.plot.panels.p1.data_layers.d2.layout.z_index, 1);
            assert.equal(this.plot.panels.p1.data_layers.d3.layout.z_index, 3);
            assert.equal(this.plot.panels.p1.data_layers.d4.layout.z_index, 2);
        });
    });

    describe('Highlight functions', function () {
        beforeEach(function () {
            this.plot = null;
            const data_sources = new DataSources()
                .add('d', ['StaticJSON', { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }]);
            const layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                namespace: { d: 'd' },
                                id: 'd',
                                id_field: 'd:id',
                                type: 'scatter',
                                highlighted: { onmouseover: 'toggle' },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
        });

        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });

        it('should allow for highlighting and unhighlighting a single element', function () {
            return this.plot.applyState()
                .then(() => {
                    const state_id = this.plot.panels.p.data_layers.d.state_id;
                    const layer_state = this.plot.state[state_id];
                    const d = this.plot.panels.p.data_layers.d;
                    const a = d.data[0];
                    const a_id = d.getElementId(a);
                    const b = d.data[1];
                    const c = d.data[2];
                    const c_id = d.getElementId(c);

                    const highlight_flags = layer_state.status_flags.highlighted;
                    assert.equal(highlight_flags.size, 0);

                    this.plot.panels.p.data_layers.d.highlightElement(a);
                    assert.equal(highlight_flags.size, 1);
                    assert.ok(highlight_flags.has(a_id));

                    this.plot.panels.p.data_layers.d.unhighlightElement(a);
                    assert.equal(highlight_flags.size, 0);

                    this.plot.panels.p.data_layers.d.highlightElement(c);
                    assert.equal(highlight_flags.size, 1);
                    assert.ok(highlight_flags.has(c_id));

                    this.plot.panels.p.data_layers.d.unhighlightElement(b);
                    assert.equal(highlight_flags.size, 1);

                    this.plot.panels.p.data_layers.d.unhighlightElement(c);
                    assert.equal(highlight_flags.size, 0);
                });
        });

        it('should allow for highlighting and unhighlighting all elements', function () {
            return this.plot.applyState()
                .then(() => {
                    const layer = this.plot.panels.p.data_layers.d;
                    const state_id = layer.state_id;
                    const layer_state = this.plot.state[state_id];
                    const a_id = layer.getElementId(layer.data[0]);
                    const b_id = layer.getElementId(layer.data[1]);
                    const c_id = layer.getElementId(layer.data[2]);

                    layer.highlightAllElements();
                    const highlight_flags = layer_state.status_flags.highlighted;
                    assert.equal(highlight_flags.size, 3);
                    assert.ok(highlight_flags.has(a_id));
                    assert.ok(highlight_flags.has(b_id));
                    assert.ok(highlight_flags.has(c_id));

                    layer.unhighlightAllElements();
                    assert.equal(layer_state.status_flags.highlighted.size, 0);
                });
        });
    });

    describe('Select functions', function () {
        beforeEach(function () {
            this.plot = null;
            const data_sources = new DataSources()
                .add('d', ['StaticJSON', { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }]);
            const layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                namespace: { d: 'd' },
                                fields: ['d:id'],
                                id_field: 'd:id',
                                type: 'scatter',
                                selected: { onclick: 'toggle' },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
        });

        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });

        it('should allow for selecting and unselecting a single element', function () {
            return this.plot.applyState()
                .then(() => {
                    const layer = this.plot.panels.p.data_layers.d;
                    const state_id = layer.state_id;
                    const layer_state = this.plot.state[state_id];
                    const a = layer.data[0];
                    const a_id = layer.getElementId(a);
                    const b = layer.data[1];
                    const c = layer.data[2];
                    const c_id = layer.getElementId(c);

                    const selected_flags = layer_state.status_flags.selected;
                    assert.equal(selected_flags.size, 0);

                    layer.selectElement(a);
                    assert.equal(selected_flags.size, 1);
                    assert.ok(selected_flags.has(a_id));

                    layer.unselectElement(a);
                    assert.equal(selected_flags.size, 0);

                    layer.selectElement(c);
                    assert.equal(selected_flags.size, 1);
                    assert.ok(selected_flags.has(c_id));

                    layer.unselectElement(b);
                    assert.equal(selected_flags.size, 1);

                    layer.unselectElement(c);
                    assert.equal(selected_flags.size, 0);
                });
        });

        it('should allow for selecting and unselecting all elements', function () {
            return this.plot.applyState()
                .then(() => {
                    const layer = this.plot.panels.p.data_layers.d;
                    const state_id = layer.state_id;
                    const layer_state = this.plot.state[state_id];
                    const a_id = layer.getElementId(layer.data[0]);
                    const b_id = layer.getElementId(layer.data[1]);
                    const c_id = layer.getElementId(layer.data[2]);

                    layer.selectAllElements();
                    const selected_flags = layer_state.status_flags.selected;
                    assert.equal(selected_flags.size, 3);
                    assert.ok(selected_flags.has(a_id));
                    assert.ok(selected_flags.has(b_id));
                    assert.ok(selected_flags.has(c_id));

                    layer.unselectAllElements();
                    assert.equal(layer_state.status_flags.selected.size, 0);
                });
        });
    });

    describe('Tool tip display', function () {
        beforeEach(function () {
            this.layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                type: 'scatter',
                                tooltip: {
                                    closable: true,
                                    show: { or: ['highlighted', 'selected'] },
                                    hide: { and: ['unhighlighted', 'unselected'] },
                                    html: 'foo',
                                },
                                behaviors: { onclick: [{ action: 'toggle', status: 'selected', exclusive: true }] },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', null, this.layout);
        });

        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });

        it('should allow for creating and destroying tool tips', function () {
            this.plot.panels.p.data_layers.d.data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            this.plot.panels.p.data_layers.d.positionTooltip = function () {
                return 0;
            };
            const a = this.plot.panels.p.data_layers.d.data[0];
            const a_id = this.plot.panels.p.data_layers.d.getElementId(a);
            const a_id_q = `#${  (`${a_id  }-tooltip`).replace(/(:|\.|\[|\]|,)/g, '\\$1')}`;
            assert.equal(Object.keys(this.plot.panels.p.data_layers.d.tooltips).length, 0);

            this.plot.panels.p.data_layers.d.createTooltip(a);
            assert.isObject(this.plot.panels.p.data_layers.d.tooltips[a_id]);
            assert.equal(Object.keys(this.plot.panels.p.data_layers.d.tooltips).length, 1);
            assert.equal(d3.select(a_id_q).empty(), false);

            this.plot.panels.p.data_layers.d.destroyTooltip(a_id);
            assert.equal(Object.keys(this.plot.panels.p.data_layers.d.tooltips).length, 0);
            assert.equal(typeof this.plot.panels.p.data_layers.d.tooltips[a_id], 'undefined');
            assert.equal(d3.select(a_id_q).empty(), true);
        });

        it('should allow for showing or hiding a tool tip based on layout directives and element status', function () {
            this.plot.panels.p.data_layers.d.data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            this.plot.panels.p.data_layers.d.positionTooltip = function () {
                return 0;
            };
            const d = this.plot.panels.p.data_layers.d;
            const a = d.data[0];
            const a_id = d.getElementId(a);
            const b = d.data[1];
            const b_id = d.getElementId(b);
            // Make sure the tooltips object is there
            assert.isObject(d.tooltips);
            // Test highlighted OR selected
            assert.isUndefined(d.tooltips[a_id]);

            d.highlightElement(a);
            assert.isObject(d.tooltips[a_id]);

            d.unhighlightElement(a);
            assert.isUndefined(d.tooltips[a_id]);

            d.selectElement(a);
            assert.isObject(d.tooltips[a_id]);

            d.unselectElement(a);
            assert.isUndefined(d.tooltips[a_id]);
            // Test highlight AND selected
            assert.isUndefined(d.tooltips[b_id]);

            d.highlightElement(b);
            d.selectElement(b);
            assert.isObject(d.tooltips[b_id]);

            d.unhighlightElement(b);
            d.unselectElement(b);
            assert.isUndefined(d.tooltips[b_id]);
        });

        it('should allow tooltip open/close state to be tracked separately from element selection', function () {
            // Regression test for zombie tooltips returning after re-render
            const layer = this.plot.panels.p.data_layers.d;
            const status_flags = layer.layer_state.status_flags;

            const item_a = { id: 'a' };
            const internal_id = layer.getElementId(item_a);

            layer.data = [item_a, { id: 'b' }, { id: 'c' }];
            layer.positionTooltip = function () {
                return 0;
            }; // Override for unit testing

            // Select a point (which will create a tooltip due to element status). Then close tooltip and re-render.
            //  Confirm state is tracked and tooltip does not magically return.
            const self = this;
            return self.plot.applyState().then(function () { // Render initially so that plot is set up right
                layer.setElementStatus('selected', item_a, true, true);
                const internal_id = layer.getElementId(item_a);

                assert.ok(layer.tooltips[internal_id], 'Tooltip created on selection');
                assert.ok(status_flags['selected'].has(internal_id), 'Item was initially selected');

                layer.destroyTooltip(item_a);
                assert.ok(!layer.tooltips[internal_id], 'Tooltip was destroyed by user close event');

                assert.ok(status_flags['selected'].has(internal_id), 'Point remains selected after closing tooltip');
                assert.ok(!status_flags['has_tooltip'].has(internal_id), 'Tooltip was destroyed by user close event');

                return self.plot.applyState();
            }).then(function () { // Force a re-render to see if zombie items remain
                assert.ok(status_flags['selected'].has(internal_id), 'Point remains selected after re-render');
                assert.ok(!status_flags['has_tooltip'].has(internal_id), 'Tooltip remains destroyed after re-render');
            });
        });
    });

    describe('data element behaviors', function () {
        beforeEach(function() {
            const data_sources = new DataSources()
                .add('d', ['StaticJSON', { data: [{ id: 'a', x: 1, y: 2 }, { id: 'b', x: 2, y:0 }, { id: 'c', x: 3, y:1 }] }]);

            const layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                namespace: { d: 'd'},
                                type: 'scatter',
                                fields: ['d:id', 'd:x', 'd:y'],
                                id_field: 'd:id',
                                x_axis: { field:  'd:x' },
                                y_axis: { field: 'd:y'},
                                behaviors: {
                                    onclick: [{ action: 'link', href: 'https://dev.example/{{d:id}}', target: '_blank' }],
                                    onmouseover: [{ action: 'set', status: 'highlighted', exclusive: true }],
                                    onmouseout: [{ action: 'unset', status: 'highlighted' }],
                                    onshiftclick: [{ action: 'toggle', status: 'selected' }],
                                },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
        });

        it('can link to an external website', function () {
            // NOTE: Not all variants of this behavior are tested. This only tests opening links in another window.
            //  This is because JSDom sometimes has issues mocking window.location.
            return this.plot.applyState().then(() => {
                const openStub = sinon.stub(window, 'open');

                // Select the first data element
                const datapoint = this.plot.panels.p.data_layers.d.svg.group.select('.lz-data_layer-scatter');

                assert.notEqual(datapoint.size(), 0, 'nodes are rendered');
                datapoint.dispatch('click', { bubbles: true} );

                assert.ok(openStub.calledOnce, 'window.open was called with the specified location and target');
                assert.ok(openStub.calledWith('https://dev.example/a', '_blank'), 'The URL can incorporate parameters from the specified data element');
            });
        });

        it('applies status-based styles when an item receives mouse events', function () {
            // Since sequence is important, this test exercises multiple scenarios in a specific order
            return this.plot.applyState().then(() => {
                // Select the first and second data points
                const first = this.plot.panels.p.data_layers.d.svg.group.select('.lz-data_layer-scatter');
                const second = this.plot.panels.p.data_layers.d.svg.group.selectAll('.lz-data_layer-scatter').filter((d, i) => i === 1);

                assert.notEqual(first.size(), 0, 'nodes are rendered');
                assert.notEqual(second.size(), 0, 'nodes are rendered');
                first.dispatch('mouseover', { bubbles: true} );

                assert.ok(first.node().classList.contains('lz-data_layer-scatter-highlighted'), 'Style is applied appropriately');
                assert.notOk(second.node().classList.contains('lz-data_layer-scatter-highlighted'), 'Style is only applied to the requested node');

                // When a different element receives mouseover, check that exclusivity and styling are applied correctly
                second.dispatch('mouseover', { bubbles: true} );
                assert.notOk(first.node().classList.contains('lz-data_layer-scatter-highlighted'), 'Style is removed from other nodes');
                assert.ok(second.node().classList.contains('lz-data_layer-scatter-highlighted'), 'Style is applied to the new mouseover node');

                // On mouse out, styles are removed
                second.dispatch('mouseout', { bubbles: true} );
                assert.notOk(second.node().classList.contains('lz-data_layer-scatter-highlighted'), 'Style is removed on mouseout');
            });
        });

        it('recognizes keyboard modifiers as distinct events', function () {
            return this.plot.applyState().then(() => {
                const openStub = sinon.stub(window, 'open');

                // Select the first data element
                const datapoint = this.plot.panels.p.data_layers.d.svg.group.select('.lz-data_layer-scatter');

                assert.notEqual(datapoint.size(), 0, 'nodes are rendered');
                datapoint.node().dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey: true}));

                assert.ok(openStub.notCalled, 'The basic click event did not fire because a modifier key was used');
                assert.ok(datapoint.node().classList.contains('lz-data_layer-scatter-selected'), 'Style is applied appropriately');
            });
        });

        afterEach(function () {
            sinon.restore();
        });
    });

    describe('Filtering operations', function () {
        it('can filter numeric data', function () {
            const layer = new BaseDataLayer({id: 'test', id_field: 'a'});
            const options = [{ field: 'a', operator: '>', value: 12 }];
            const data = [{ a: 12 }, { a: 11 }, { a: 13 }];

            const result = data.filter(layer.filter.bind(layer, options));
            assert.equal(result.length, 1);
            assert.deepEqual(result, [{ a: 13 }]);
        });

        it('can apply two filters and both must match', function () {
            const layer = new BaseDataLayer({id_field: 'a'});
            const options = [{ field: 'a', operator: '>', value: 12 }, { field: 'a', operator: '<=', value: 14 }];
            const data = [{ a: 12 }, { a: 11 }, { a: 13 }, { a: 15 }, { a: 14 }];

            const result = data.filter(layer.filter.bind(layer, options));
            assert.equal(result.length, 2);
            assert.deepEqual(result, [{ a: 13 }, { a: 14 }]);
        });

        it('can filter text data', function () {
            const layer = new BaseDataLayer({id_field: 'a'});
            const options = [{ field: 'a', operator: '=', value: 'exact' }];
            const data = [{ a: 'inexact' }, { a: 'exactly' }, { a: 'exact' }];

            const result = data.filter(layer.filter.bind(layer, options));
            assert.equal(result.length, 1);
            assert.deepEqual(result, [{ a: 'exact' }]);
        });

        it('can work with user-specified filters', function () {
            MATCHERS.add('near_to', (a, b) => a < (b + 100) && a > (b - 100));
            const layer = new BaseDataLayer({id_field: 'a'});
            const options = [{ field: 'a', operator: 'near_to', value: 200 }];
            const data = [{ a: 50 }, { a: 200 }, { a: 250 }];

            const result = data.filter(layer.filter.bind(layer, options));
            assert.equal(result.length, 2);
            assert.deepEqual(result, [{ a: 200 }, {a: 250 }]);

            MATCHERS.remove('near_to');
        });

        it('can pass the entire data object to a filter function, if syntax ', function () {
            const spy = sinon.spy();
            MATCHERS.add('filter_spy', spy);
            const layer = new BaseDataLayer({id_field: 'a'});
            const options = [{ operator: 'filter_spy', value: 'anything' }];
            const data = [{ a: 50 }, { a: 200 }, { a: 250 }];

            data.filter(layer.filter.bind(layer, options));
            assert.deepEqual(spy.firstCall.args[0], { a: 50 }, 'Filter was called with object instead of scalar');
            MATCHERS.remove('filter_spy');
        });

        it('can use transformed field values with filter rules', function() {
            const layer = new BaseDataLayer({id_field: 'a'});
            const options = [{ field: 'a|scinotation', operator: '=', value: '1.000' }];
            const data = [{ a: 1 }, { a: 0 }, { a: 1 }];

            const result = data.filter(layer.filter.bind(layer, options));
            assert.equal(result.length, 2);
            // Note that transform results are cached, so they will show up in the internal representation of the data
            //  after fetching
            assert.deepEqual(result, [{ a: 1, 'a|scinotation': '1.000' }, { a: 1, 'a|scinotation': '1.000' }]);
        });

        it('throws an error when an unrecognized filter is specified', function () {
            const layer = new BaseDataLayer({id_field: 'a'});
            const options = [{ field: 'a', operator: 'doesnotexist', value: 200 }];
            const data = [{ a: 50 }, { a: 200 }, { a: 250 }];

            assert.throws(() => {
                data.filter(layer.filter.bind(layer, options));
            }, 'Item not found: doesnotexist');
        });

        describe('interaction with data fetching', function () {
            beforeEach(function () {
                this.plot = null;
                const data_sources = new DataSources()
                    .add('d', ['StaticJSON', {
                        data: [{ id: 1, a: 12 }, { id: 2, a: 11 }, { id: 3, a: 13 }, { id: 4, a: 15 }, { id: 5, a: 14 }],
                    }]);
                const layout = {
                    panels: [
                        {
                            id: 'p',
                            data_layers: [
                                {
                                    id: 'd',
                                    namespace: { d: 'd'},
                                    fields: ['d:id', 'd:a'],
                                    id_field: 'd:id',
                                    type: 'scatter',
                                    filters: null,
                                },
                            ],
                        },
                    ],
                };
                d3.select('body').append('div').attr('id', 'plot');
                this.plot = populate('#plot', data_sources, layout);
            });

            afterEach(function () {
                d3.select('#plot').remove();
                delete this.plot;
            });

            it('passes all data when no filters are defined', function () {
                const layer = this.plot.panels.p.data_layers.d;
                return layer.parent.reMap()
                    .then(() => assert.equal(layer.data.length, 5));
            });

            it('passes modified data when layout filters are used', function () {
                const filters = [{ field: 'd:a', operator: '>', value: 12 }, { field: 'd:a', operator: '<=', value: 14 }];
                const layer = this.plot.panels.p.data_layers.d;
                layer.layout.filters = filters;

                return layer.parent.reMap() // ensures data has been fetched
                    .then(() => {
                        const result = layer._applyFilters();
                        assert.equal(result.length, 2);
                    });
            });

            it('passes modified data when explicit filter function is used', function () {
                const layer = this.plot.panels.p.data_layers.d;
                layer.setFilter((item) => item['d:a'] === 12);
                return layer.parent.reMap()
                    .then(() => {
                        const result = layer._applyFilters();
                        assert.equal(result.length, 1);
                    });
            });

            it('allows explicit filter function to take precedence over layout-defined filters', function () {
                const filters = [{ field: 'd:a', operator: '>', value: 12 }, { field: 'd:a', operator: '<=', value: 14 }];
                const layer = this.plot.panels.p.data_layers.d;
                layer.layout.filters = filters;
                layer.setFilter((item) => item['d:a'] === 12);
                return layer.parent.reMap()
                    .then(() => {
                        const result = layer._applyFilters();
                        assert.equal(result.length, 1);
                    });
            });

            it('respects element annotation cache when applying declarative filters to data', function () {
                const layer = this.plot.panels.p.data_layers.d;
                const filters = [{ field: 'custom_field', operator: '=', value: 'some_value' }];
                const inner_datum = { 'd:id': 1, 'd:a': 12 };
                layer.setElementAnnotation(inner_datum, 'custom_field', 'some_value');
                layer.layout.filters = filters;
                return layer.parent.reMap()
                    .then(() => {
                        const result = layer._applyFilters();
                        assert.equal(result.length, 1);
                        assert.deepEqual(result[0]['d:a'], 12);
                    });
            });
        });
    });

    describe('Persistent annotations', function () {
        beforeEach(function () {
            this.plot = null;
            const data_sources = new DataSources()
                .add('d', ['StaticJSON', { data: [{ id: 'a' }, { id: 'b', some_field: true }, { id: 'c' }] }]);
            const layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                namespace: { d: 'd'},
                                fields: ['d:id', 'd:some_field'],
                                id_field: 'd:id',
                                type: 'scatter',
                                selected: { onclick: 'toggle' },
                                label: {
                                    text: 'd:id',
                                    filters: [{ field: 'custom_field', operator: '=', value: true }],
                                },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
        });

        it('can store user-defined marks for points that persist across re-renders', function () {
            const data_layer = this.plot.panels.p.data_layers.d;
            // Set the annotation for a point with id value of "a"
            const datum = { 'd:id': 'a' };
            data_layer.setElementAnnotation(datum, 'custom_field', 'some_value');

            // Find the element annotation for this point via several different ways
            assert.equal(data_layer.layer_state.extra_fields['plot_p_d-a']['custom_field'], 'some_value', 'Found in internal storage (as elementID)');
            assert.equal(data_layer.getElementAnnotation(datum, 'custom_field'), 'some_value', 'Found via helper method (from id_field)');
            assert.equal(data_layer.getElementAnnotation({'d:id': 'b'}, 'custom_field'), null, 'If no annotation found, returns null. Annotation does not return actual field values.');
            assert.equal(data_layer.getElementAnnotation(datum, 'custom_field'), 'some_value', 'Found via helper method (as data object)');

            // If a datum (but no field) is specified, it will return the appropriate result
            assert.deepEqual(data_layer.getElementAnnotation(datum), {custom_field: 'some_value'}, 'When no key is specified, return object with all annotations');
            assert.deepEqual(data_layer.getElementAnnotation({'d:id': 'b'}), undefined, 'When no key is specified, and no annotations exist, then return nothing');

            return this.plot.applyState().then(function() {
                assert.equal(data_layer.getElementAnnotation(datum, 'custom_field'), 'some_value', 'Annotations persist across renderings');
            });
        });

        it('can use custom markings in layout directives', function () {
            const self = this;
            const data_layer = this.plot.panels.p.data_layers.d;
            assert.equal(data_layer.label_groups, undefined, 'No labels on first render');
            data_layer.setElementAnnotation({'d:id': 'a'}, 'custom_field', true);

            return this.plot.applyState().then(function () {
                assert.equal(data_layer.label_groups.size(), 1, 'Labels are drawn because of annotations');
                // After turning labels on, confirm that we can cycle them off and influence rendering
                data_layer.setElementAnnotation({'d:id': 'a'}, 'custom_field', false);
                return self.plot.applyState();
            }).then(function () {
                assert.equal(data_layer.label_groups.size(), 0, 'Labels are removed because of annotations');
            });
        });

        it('gives precedence to real data fields when an annotation exists with the same name', function () {
            const self = this;
            const data_layer = this.plot.panels.p.data_layers.d;
            data_layer.layout.label.filters[0].field = 'd:some_field';

            // Rerender once so the modified layout takes effect
            return this.plot.applyState().then(function () {
                assert.equal(data_layer.label_groups.size(), 1, 'Labels are drawn on first render because field value says to');
                // Introduce an annotation that conflicts with the data field from the API
                data_layer.setElementAnnotation({'d:id': 'b'}, 'd:some_field', false);
                return self.plot.applyState();
            }).then(function () {
                assert.equal(data_layer.label_groups.size(), 1, 'Real fields says to label, annotation says no. Real field wins.');
            });
        });
    });
});
