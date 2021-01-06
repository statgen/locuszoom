import { assert } from 'chai';
import * as d3 from 'd3';
import sinon from 'sinon';

import { LAYOUTS } from '../../../esm/registry';
import {populate} from '../../../esm/helpers/display';
import DataSources from '../../../esm/data';
import {_updateStatePosition} from '../../../esm/components/plot';

describe('LocusZoom.Plot', function() {
    // Tests

    describe('Geometry and Panels', function() {
        beforeEach(function() {
            const layout = {
                width: 100,
                panels: [],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', null, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should allow for adding arbitrarily many panels', function() {
            const panelA = this.plot.addPanel({ id: 'panelA', foo: 'bar' });
            assert.equal(panelA.id, 'panelA');
            assert.equal(this.plot.panels[panelA.id], panelA);
            assert.equal(this.plot.panels[panelA.id].parent, this.plot);
            assert.equal(this.plot.panels[panelA.id].layout_idx, 0);
            assert.equal(this.plot.layout.panels.length, 1);
            assert.equal(this.plot.layout.panels[0].id, panelA.id);
            assert.equal(this.plot.layout.panels[0].foo, 'bar');

            const panelB = this.plot.addPanel({ id: 'panelB', foo: 'baz' });
            assert.equal(panelB.id, 'panelB');
            assert.equal(this.plot.panels[panelB.id], panelB);
            assert.equal(this.plot.panels[panelB.id].parent, this.plot);
            assert.equal(this.plot.panels[panelB.id].layout_idx, 1);
            assert.equal(this.plot.layout.panels.length, 2);
            assert.equal(this.plot.layout.panels[1].id, 'panelB');
            assert.equal(this.plot.layout.panels[1].foo, 'baz');
        });
        it('should allow for removing panels', function() {
            const panelA = this.plot.addPanel({ id: 'panelA', foo: 'bar', height: 10 });
            const panelB = this.plot.addPanel({ id: 'panelB', foo: 'baz', height: 20 });
            assert.hasAnyKeys(this.plot.panels, ['panelA']);
            assert.equal(this.plot.panels[panelA.id].id, panelA.id);
            assert.equal(this.plot.layout.panels.length, 2);

            assert.equal(this.plot._total_height, 30, 'Initial height is sum of the two panels');

            this.plot.removePanel('panelA');
            assert.doesNotHaveAnyKeys(this.plot.panels, ['panelA']);
            assert.equal(this.plot.layout.panels.length, 1);
            assert.equal(this.plot.layout.panels[0].id, 'panelB');
            assert.equal(this.plot.panels[panelB.id].layout_idx, 0);

            assert.equal(this.plot._total_height, 20, 'Final height is the space requested by the remaining single panel');
        });
        it('should allow setting dimensions', function() {
            this.plot.setDimensions(563, 681);
            assert.equal(this.plot.layout.width, 563);

            // Tests for awkward API choice: invalid numbers can be provided but are quietly ignored.
            this.plot.setDimensions(1320.3, -50);
            assert.equal(this.plot.layout.width, 563);

            this.plot.setDimensions('q', 0);
            assert.equal(this.plot.layout.width, 563, 'Non-numeric value is ignored');
        });
        it('show rescale all panels equally when resizing the plot', function () {
            assert.equal(this.plot._total_height, 0, 'Empty plot has no height');

            const panelA = this.plot.addPanel({ id: 'panelA', height: 100 });
            const panelB = this.plot.addPanel({ id: 'panelB', height: 200 });

            this.plot.setDimensions(100, 600);

            assert.equal(this.plot._total_height, 600, 'Plot is set to the specified height');

            assert.equal(panelA.layout.height, 200, 'Panel A doubles in size because plot doubles in size');
            assert.equal(panelB.layout.height, 400, 'Panel B doubles in size because plot doubles in size');
        });
        it('should rescale all panels and the plot, but only down to the specified minimum size', function () {
            assert.equal(this.plot._total_height, 0, 'Empty plot has no height');

            const panelA = this.plot.addPanel({ id: 'panelA', min_height: 50, height: 100 });
            const panelB = this.plot.addPanel({ id: 'panelB', min_height: 100, height: 200 });

            this.plot.setDimensions(100, 100);

            assert.equal(this.plot._total_height, 150, 'Plot cannot be smaller than min_heights');

            assert.equal(panelA.layout.height, 50, 'Panel A does not shrink below the minimum size');
            assert.equal(panelB.layout.height, 100, 'Panel B does not shrink below the minimum size');
        });
        it('should enforce consistent data layer widths and x-offsets across x-linked panels', function() {
            const layout = {
                width: 1000,
                panels: [
                    LAYOUTS.get('panel', 'association', { margin: { left: 200 } }),
                    LAYOUTS.get('panel', 'association', { id: 'assoc2', margin: { right: 300 } }),
                ],
            };
            this.plot = populate('#plot', null, layout);
            assert.equal(this.plot.layout.panels[0].margin.left, 200);
            assert.equal(this.plot.layout.panels[1].margin.left, 200);
            assert.equal(this.plot.layout.panels[0].margin.right, 300);
            assert.equal(this.plot.layout.panels[1].margin.right, 300);
            assert.equal(this.plot.layout.panels[0].cliparea.origin.x, 200);
            assert.equal(this.plot.layout.panels[1].cliparea.origin.x, 200);
            assert.equal(this.plot.layout.panels[0].origin.x, this.plot.layout.panels[0].origin.x);
        });
        it('should not allow for a non-numerical / non-positive predefined dimensions', function() {
            assert.throws(() => {
                populate('#plot', null, { width: 0 });
            });
            assert.throws(() => {
                populate('#plot', null, { width: 'foo' });
            });
        });
    });

    describe('SVG Composition', function() {
        describe('Mouse Guide Layer', function() {
            beforeEach(function() {
                d3.select('body').append('div').attr('id', 'plot');
                const layout = LAYOUTS.get('plot', 'standard_association');
                layout.state = { chr: '1', start: 1, end: 100000 };
                this.plot = populate('#plot', null, layout);
            });
            it('first child should be a mouse guide layer group element', function() {
                assert.equal(d3.select(this.plot.svg.node().firstChild).attr('id'), 'plot.mouse_guide');
            });
        });
    });

    describe('Dynamic Panel Positioning', function() {
        beforeEach(function() {
            const datasources = new DataSources();
            const layout = {
                width: 100,
                min_width: 100,
                panels: [],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
        });
        it('Should allocate the space requested by the panel, even if less than plot height', function() {
            const panelA = { id: 'panelA', height: 50 };
            this.plot.addPanel(panelA);
            const svg = d3.select('#plot svg');
            assert.equal(this.plot.layout.width, 100);
            assert.equal((+svg.attr('width')), 100);
            assert.equal((+svg.attr('height')), 50);
            assert.equal(this.plot.panels.panelA.layout.height, 50);
            assert.equal(this.plot.panels.panelA.layout.origin.y, 0);
        });
        it('Should extend the size of the plot if panels are added that expand it, and automatically prevent panels from overlapping vertically', function() {
            const panelA = { id: 'panelA', height: 60 };
            const panelB = { id: 'panelB', height: 60 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            const svg = d3.select('#plot svg');
            assert.equal(this.plot.layout.width, 100);
            assert.equal((+svg.attr('width')), 100);
            assert.equal((+svg.attr('height')), 120);
            assert.equal(this.plot.panels.panelA.layout.height, 60);
            assert.equal(this.plot.panels.panelA.layout.origin.y, 0);
            assert.equal(this.plot.panels.panelB.layout.height, 60);
            assert.equal(this.plot.panels.panelB.layout.origin.y, 60);
        });
        it('Should resize the plot as panels are removed', function() {
            const panelA = { id: 'panelA', height: 60 };
            const panelB = { id: 'panelB', height: 60 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.removePanel('panelA');
            const svg = d3.select('#plot svg');
            assert.equal(this.plot.layout.width, 100);
            assert.equal((+svg.attr('width')), 100);
            assert.equal((+svg.attr('height')), 60);
            assert.equal(this.plot.panels.panelB.layout.height, 60);
            assert.equal(this.plot.panels.panelB.layout.origin.y, 0);
        });
        it('Should resize the plot as panels are removed, when panels specify min_height', function() {
            // Small hack; resize the plot after it was created
            this.plot.layout.height = 600;
            this.plot.layout.width = 800;
            this.plot.layout.responsive_resize = true;

            // These numbers are based on a real plot. Expected behavior is chosen to match behavior of a layout where
            //   panels had no min_height specified.
            const panelA = { id: 'panelA', height: 300 };
            const panelB = { id: 'panelB', height: 50 };
            const panelC = { id: 'panelC', height: 225 };

            // Set up the scenario
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.addPanel(panelC);

            this.plot.removePanel('panelC');
            // Check dimensions. Some checks are approximate due to floating point rounding issues.
            assert.equal(this.plot.panels.panelB.layout.height, 50, 'Panel B height matches layout value');
            // When the overall plot specifies a min_height larger than any panel, the final resizing of the panels
            //   must respect that setting. Thus, panels A and B will not have the same relative proportions
            //   after panel C is removed.
            assert.equal(this.plot.panels.panelB.layout.origin.y, 300, 'Panel B origin.y matches layout value');
        });
        it('Should resize the plot while retaining panel proportions when panel is removed, if plot min_height does not take precedence', function() {
            // When we remove a panel, we often want the plot to shrink by exactly that size. (so that the bottom
            //   section simply disappears without changing the appearance of the panels that remain) But if plot
            //   min_height is larger than any one panel, the space actually gets reallocated, and the remaining
            //   panels stretch or shrink.
            // This test ensures that we will see the desired behavior when plot min_height isn't dominant.
            const panelA = { id: 'panelA', height: 300 };
            const panelB = { id: 'panelB', height: 50 };
            const panelC = { id: 'panelC', height: 225 };

            // Set up the scenario
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.addPanel(panelC);

            // Verify that panel A and B adopt a specific proportion (when 3 panels are present)
            assert.equal(this.plot.panels.panelA.layout.height, 300, 'Panel A height matches layout value (before)');
            assert.equal(this.plot.panels.panelB.layout.height, 50, 'Panel B height matches layout value (before)');

            this.plot.removePanel('panelC');
            // Check dimensions. Some checks are approximate due to floating point rounding issues.
            // Panels A and B will have the same size and relative proportions after resize as before
            assert.equal(this.plot.panels.panelA.layout.height, 300, 'Panel A height matches layout (after)');
            assert.equal(this.plot.panels.panelB.layout.height, 50, 'Panel B height matches layout (after)');
            assert.equal(this.plot.panels.panelB.layout.origin.y, 300, 'Panel B origin.y appears immediately after panel A');
        });
        it('Should allow for inserting panels at discrete y indexes', function() {
            const panelA = { id: 'panelA', height: 60 };
            const panelB = { id: 'panelB', height: 61 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            const panelC = { id: 'panelC', height: 62, y_index: 1 }; // In between A and B
            this.plot.addPanel(panelC);
            assert.equal(this.plot.panels.panelA.layout.y_index, 0);
            assert.equal(this.plot.panels.panelB.layout.y_index, 2);
            assert.equal(this.plot.panels.panelC.layout.y_index, 1);
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['panelA', 'panelC', 'panelB']);

            assert.deepEqual(panelA.height, 60, 'panel A height matches layout value');
            assert.deepEqual(panelB.height, 61, 'panel B height matches layout value');
            assert.deepEqual(panelC.height, 62, 'panel C height matches layout value');

            assert.deepEqual(panelA.height + panelB.height + panelC.height, this.plot._total_height, 'Plot height is equal to sum of panels');
        });
        it('Should allow for inserting panels at negative discrete y indexes', function() {
            const panelA = { id: 'panelA', height: 60 };
            const panelB = { id: 'panelB', height: 60 };
            const panelC = { id: 'panelC', height: 60 };
            const panelD = { id: 'panelD', height: 60 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.addPanel(panelC);
            this.plot.addPanel(panelD);
            const panelE = { id: 'panelE', height: 60, y_index: -1 };
            this.plot.addPanel(panelE);
            assert.equal(this.plot.panels.panelA.layout.y_index, 0);
            assert.equal(this.plot.panels.panelB.layout.y_index, 1);
            assert.equal(this.plot.panels.panelC.layout.y_index, 2);
            assert.equal(this.plot.panels.panelD.layout.y_index, 4);
            assert.equal(this.plot.panels.panelE.layout.y_index, 3);
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['panelA', 'panelB', 'panelC', 'panelE', 'panelD']);
        });
    });

    describe('Plot Curtain and Loader', function() {
        beforeEach(function() {
            const datasources = new DataSources();
            const layout = {
                width: 100,
                panels: [],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
        });
        it('should show/hide/update on command and track shown status', function() {
            assert.isFalse(this.plot.curtain.showing);
            assert.isNull(this.plot.curtain.selector);
            assert.isNull(this.plot.curtain.content_selector);

            this.plot.curtain.show('test content');
            assert.isTrue(this.plot.curtain.showing);
            assert.isFalse(this.plot.curtain.selector.empty());
            assert.isFalse(this.plot.curtain.content_selector.empty());
            assert.equal(this.plot.curtain.content_selector.html(), 'test content');

            this.plot.curtain.hide();
            assert.isFalse(this.plot.curtain.showing);
            assert.isNull(this.plot.curtain.selector);
            assert.isNull(this.plot.curtain.content_selector);
        });
        it('should have a loader object with show/update/animate/setPercentCompleted/hide methods, a showing boolean, and selectors', function() {
            assert.isFalse(this.plot.loader.showing);
            assert.isNull(this.plot.loader.selector);
            assert.isNull(this.plot.loader.content_selector);
            assert.isNull(this.plot.loader.progress_selector);
        });
        it('should show/hide/update on command and track shown status', function() {
            assert.isFalse(this.plot.loader.showing);
            assert.isNull(this.plot.loader.selector);
            assert.isNull(this.plot.loader.content_selector);
            assert.isNull(this.plot.loader.progress_selector);

            this.plot.loader.show('test content');
            assert.isTrue(this.plot.loader.showing);
            assert.isFalse(this.plot.loader.selector.empty());
            assert.isFalse(this.plot.loader.content_selector.empty());
            assert.equal(this.plot.loader.content_selector.html(), 'test content');
            assert.isFalse(this.plot.loader.progress_selector.empty());

            this.plot.loader.hide();
            assert.isFalse(this.plot.loader.showing);
            assert.isNull(this.plot.loader.selector);
            assert.isNull(this.plot.loader.content_selector);
            assert.isNull(this.plot.loader.progress_selector);
        });
        it('should allow for animating or showing discrete percentages of completion', function() {
            this.plot.loader.show('test content').animate();
            assert.isTrue(this.plot.loader.progress_selector.classed('lz-loader-progress-animated'));

            this.plot.loader.setPercentCompleted(15);
            assert.equal(this.plot.loader.content_selector.html(), 'test content');

            assert.isFalse(this.plot.loader.progress_selector.classed('lz-loader-progress-animated'));
            assert.equal(this.plot.loader.progress_selector.style('width'), '15%');

            this.plot.loader.update('still loading...', 62);
            assert.equal(this.plot.loader.content_selector.html(), 'still loading...');
            assert.equal(this.plot.loader.progress_selector.style('width'), '62%');

            this.plot.loader.setPercentCompleted(200);
            assert.equal(this.plot.loader.progress_selector.style('width'), '100%');

            this.plot.loader.setPercentCompleted(-43);
            assert.equal(this.plot.loader.progress_selector.style('width'), '1%');

            this.plot.loader.setPercentCompleted('foo');
            assert.equal(this.plot.loader.progress_selector.style('width'), '1%');
        });
    });

    describe('State and Requests', function() {
        beforeEach(function() {
            this.datasources = new DataSources();
            this.layout = { width: 100 };
            d3.select('body').append('div').attr('id', 'plot');
        });
        afterEach(function() {
            this.plot = null;
            this.layout = null;
            d3.select('#plot').remove();
        });
        it('Should apply basic start/end state validation when necessary', function() {
            this.layout.state = { chr: 1, start: -60, end: 10300050 };
            this.plot = populate('#plot', this.datasources, this.layout);
            return Promise.all(this.plot.remap_promises).then(() => {
                assert.equal(this.plot.state.start, 1);
                assert.equal(this.plot.state.end, 10300050);
            });
        });
        it('Should apply minimum region scale state validation if set in the plot layout', function() {
            this.layout.min_region_scale = 2000;
            this.layout.state = { chr: 1, start: 10300000, end: 10300050 };
            this.plot = populate('#plot', this.datasources, this.layout);
            return Promise.all(this.plot.remap_promises).then(() => {
                assert.equal(this.plot.state.start, 10299025);
                assert.equal(this.plot.state.end, 10301025);
            });
        });
        it('Should apply maximum region scale state validation if set in the plot layout', function() {
            this.layout.max_region_scale = 4000000;
            this.layout.state = { chr: 1, start: 10300000, end: 15300000 };
            this.plot = populate('#plot', this.datasources, this.layout);
            return Promise.all(this.plot.remap_promises).then(() => {
                assert.equal(this.plot.state.start, 10800000);
                assert.equal(this.plot.state.end, 14800000);
            });
        });
    });

    describe('subscribeToData', function() {
        beforeEach(function() {
            const layout = {
                panels: [{ id: 'panel0' }],
            };

            this.first_source_data = [ { x: 0, y: false  }, { x: 1, y: true } ];
            this.data_sources = new DataSources()
                .add('first', ['StaticJSON', this.first_source_data ]);

            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', this.data_sources, layout);
        });

        afterEach(function() {
            d3.select('#plot').remove();
            sinon.restore();
        });

        it('allows subscribing to data using a standard limited fields array', function (done) {
            const expectedData = [{ 'first:x': 0 }, { 'first:x': 1 }];

            const dataCallback = sinon.spy();

            this.plot.subscribeToData(
                [ 'first:x' ],
                dataCallback,
                { onerror: done }
            );

            this.plot.applyState().catch(done);

            // Ugly hack: callback was not recognized at time of promise resolution, and data_rendered may be fired
            //  more than once during rerender
            window.setTimeout(function() {
                try {
                    assert.ok(dataCallback.called, 'Data handler was called');
                    assert.ok(dataCallback.calledWith(expectedData), 'Data handler received the expected data');
                    done();
                } catch (error) {
                    done(error);
                }
            }, 0);
        });

        it('allows subscribing to individual (not combined) sources', function (done) {
            const expectedData = { first: [{ 'first:x': 0 }, { 'first:x': 1 }] };
            const dataCallback = sinon.spy();

            this.plot.subscribeToData(
                [ 'first:x' ],
                dataCallback,
                { onerror: done, discrete: true }
            );
            // Ugly hack: callback was not recognized at time of promise resolution, and data_rendered may be fired
            //  more than once during rerender
            window.setTimeout(function() {
                try {
                    assert.ok(dataCallback.called, 'Data handler was called');
                    assert.ok(dataCallback.calledWith(expectedData), 'Data handler received the expected data');
                    done();
                } catch (error) {
                    done(error);
                }
            }, 0);
        });

        it('calls an error callback if a problem occurs while fetching data', function() {
            const dataCallback = sinon.spy();
            const errorCallback = sinon.spy();

            this.plot.subscribeToData(
                [ 'nosource:x' ],
                dataCallback,
                { onerror: errorCallback }
            );

            return this.plot.applyState()
                .then(function() {
                    assert.ok(dataCallback.notCalled, 'Data callback was not called');
                    assert.ok(errorCallback.called, 'Error callback was called');
                });
        });

        it('allows event listeners to be removed / cleaned up individually', function() {
            const dataCallback = sinon.spy();
            const errorCallback = sinon.spy();

            const listener = this.plot.subscribeToData(
                ['nosource:x'],
                dataCallback,
                { onerror: errorCallback }
            );

            this.plot.off('data_rendered', listener);
            this.plot.emit('data_rendered');
            assert.equal(
                this.plot.event_hooks['data_rendered'].indexOf(listener),
                -1,
                'Listener should not be registered'
            );
            assert.ok(dataCallback.notCalled, 'listener success callback was not fired');
            assert.ok(errorCallback.notCalled, 'listener error callback was not fired');
        });
    });

    describe('fires off various events in response to actions', function () {
        it('region_changed event describes exact region change', function () {
            d3.select('body').append('div').attr('id', 'plot');
            const layout = {
                panels: [{ id: 'panel0' }],
            };
            const data_sources = new DataSources();
            const plot = populate('#plot', data_sources, layout);
            // Test should cover a behavior where the requested state is slightly different than the exact state
            const requested_state = { chr: 'X', start: 1000.1, end: 50000.1, extra_thing: 'hi' };
            const expected_state = {chr: 'X', start: 1000, end: 50000 };

            const state_spy = sinon.spy((e) => e);
            const region_spy = sinon.spy((e) => e);
            plot.on('state_changed', state_spy);
            plot.on('region_changed', region_spy);

            return plot.applyState(requested_state).then(function() {
                assert.ok(state_spy.called);
                assert.ok(state_spy.calledWith({sourceID: 'plot', target: plot, data: requested_state}));

                assert.ok(region_spy.called);
                assert.ok(region_spy.calledWith({sourceID: 'plot', target: plot, data: expected_state}));
            });
        });

        describe('allows communication between layers via match events', function () {
            beforeEach(function() {
                this.plot = null;
                const first_source_data = [{ id: 'a', x: 0, y: false }, { id: 'b', x: 1, y: true }];
                const data_sources = new DataSources()
                    .add('s', ['StaticJSON', first_source_data]);
                this.layout = {
                    panels: [
                        {
                            id: 'p',
                            data_layers: [
                                {
                                    id: 'd1',
                                    id_field: 's:id',
                                    type: 'scatter',
                                    fields: ['s:id', 's:x'],
                                    match: { send: 's:x', receive: 's:x' },
                                },
                                {
                                    id: 'd2',
                                    id_field: 's:id',
                                    type: 'scatter',
                                    fields: ['s:id', 's:x', 's:y'],
                                },
                                {
                                    id: 'd3',
                                    id_field: 's:id',
                                    type: 'scatter',
                                    fields: ['s:id', 's:y'],
                                    match: { receive: 's:y' },
                                },
                            ],
                        },
                    ],
                };
                d3.select('body').append('div').attr('id', 'plot');
                this.plot = populate('#plot', data_sources, this.layout);
            });

            afterEach(function() {
                d3.select('#plot').remove();
                delete this.plot;
            });

            const get_matches = function (data) {
                return data.map((item) => item.lz_is_match);
            };

            it('notifies all layers to find matches when an event fires', function () {
                // This is the end result of triggering a match event, and lets us test after render promise complete
                const plot = this.plot;
                return this.plot.applyState({ lz_match_value: 0 }).then(function() {
                    const d1 = get_matches(plot.panels.p.data_layers.d1.data);
                    const d2 = get_matches(plot.panels.p.data_layers.d2.data);
                    const d3 = get_matches(plot.panels.p.data_layers.d3.data);

                    assert.deepEqual(d1, [true, false], 'layer 1 responded to match event');
                    assert.deepEqual(d2, [undefined, undefined], 'layer 2 ignored match event so no flag present');
                    assert.deepEqual(d3, [false, false], 'layer 3 saw match event but no values matched');
                });
            });

            it('allows matching rules to use transforms (on send)', function (done) {
                const layer1 = this.plot.panels.p.data_layers.d1;
                layer1.layout.match.send = 's:x|scinotation';

                // We can validate the send rule by checking what value gets broadcast
                layer1.parent.on('match_requested', (event) => {
                    assert.equal(event.data.value, '0', 'The item value was converted from a number to a string before being broadcast to other panels');
                    done();
                });

                // Trigger the match event on datapoint 1 from layer 1
                layer1.setElementStatus('selected', { 's:id': 'a', 's:x': 0, 's:y': false }, true, true);
            });

            it('allows matching rules to use transforms (on receive)', function () {
                const layer1 = this.plot.panels.p.data_layers.d1;
                layer1.layout.match.receive = 's:x|scinotation';
                return this.plot.applyState({lz_match_value: '1.000'}).then(() => {
                    const matches = get_matches(layer1.data);
                    assert.deepEqual(matches, [false, true], 'The broadcast value is compared to the modified value for a data item');
                });
            });

            it('allows matching rules to use any match operators from the registry', function () {
                const layer1 = this.plot.panels.p.data_layers.d1;
                layer1.layout.match.operator = '>=';
                return this.plot.applyState({lz_match_value: 0.5}).then(() => {
                    const matches = get_matches(layer1.data);
                    assert.deepEqual(matches, [false, true], 'Can match on a rule other than exact match');
                });
            });

            it('allows a match event to trigger filtering behavior', function () {
                // Example use case: click a data layer element, and other layers update to only render items that match that point
                // Originally, match functionality was only used to change HOW something was shown. This allows
                //  matching to also change IF something is shown. Here we capture that this works, but to be honest,
                //  it's not often recommended- the user could get into a situation where they hid all their points, and
                //  have no way to "reset/clear" the match rule to show things again.
                const layer1 = this.plot.panels.p.data_layers.d1;
                // In a real use, we could trigger "only filter on match" with a custom function that returned true
                //  if EITHER a match occurred, OR lz_is_match was undefined (eg, no match had been attempted).
                layer1.layout.filters = [{field: 'lz_is_match', operator: '=', value: true}];
                return this.plot.applyState({lz_match_value: 1}).then(() => {
                    // layer.data contains everything; select only filtered data elements
                    const filtered = layer1._applyFilters();
                    assert.equal(filtered.length, 1, 'Only one data item is shown');
                    assert.equal(
                        filtered[0]['s:id'],
                        'b',
                        'This item displayed is the one that satisfies matching rules'
                    );
                });
            });
        });
    });

    describe('Update State Positions (helper function)', function() {
        it('should do nothing if passed a state with no predicted rules / structure', function() {
            let state = { foo: 'bar' };
            state = _updateStatePosition(state);
            assert.equal(state.foo, 'bar');
            let stateB = { start: 'foo', end: 'bar' };
            stateB = _updateStatePosition(stateB);
            assert.equal(stateB.start, 'foo');
            assert.equal(stateB.end, 'bar');
        });
        it('should enforce no zeros for start and end (if present with chr)', function() {
            let stateA = { chr: 1, start: 0, end: 123 };
            stateA = _updateStatePosition(stateA);
            assert.equal(stateA.start, 1);
            assert.equal(stateA.end, 123);
            let stateB = { chr: 1, start: 1, end: 0 };
            stateB = _updateStatePosition(stateB);
            assert.equal(stateB.start, 1);
            assert.equal(stateB.end, 1);
        });
        it('should enforce no negative values for start and end (if present with chr)', function() {
            let stateA = { chr: 1, start: -235, end: 123 };
            stateA = _updateStatePosition(stateA);
            assert.equal(stateA.start, 1);
            assert.equal(stateA.end, 123);
            let stateB = { chr: 1, start: 1, end: -436 };
            stateB = _updateStatePosition(stateB);
            assert.equal(stateB.start, 1);
            assert.equal(stateB.end, 1);
        });
        it('should enforce no non-integer values for start and end (if present with chr)', function() {
            let stateA = { chr: 1, start: 1234.4, end: 4567.8 };
            stateA = _updateStatePosition(stateA);
            assert.equal(stateA.start, 1234);
            assert.equal(stateA.end, 4567);
        });
        it('should enforce no non-numeric values for start and end (if present with chr)', function() {
            let stateA = { chr: 1, start: 'foo', end: 324523 };
            stateA = _updateStatePosition(stateA);
            assert.equal(stateA.start, 324523);
            assert.equal(stateA.end, 324523);
            let stateB = { chr: 1, start: 68756, end: 'foo' };
            stateB = _updateStatePosition(stateB);
            assert.equal(stateB.start, 68756);
            assert.equal(stateB.end, 68756);
            let stateC = { chr: 1, start: 'foo', end: 'bar' };
            stateC = _updateStatePosition(stateC);
            assert.equal(stateC.start, 1);
            assert.equal(stateC.end, 1);
        });
    });
});
