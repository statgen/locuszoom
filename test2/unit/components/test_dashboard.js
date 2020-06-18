import {assert} from 'chai';
import d3 from 'd3';

import Toolbar from '../../../esm/components/toolbar';
import DataSources from '../../../esm/data';
import {populate} from '../../../esm/helpers/display';

describe('LocusZoom.Toolbar', function() {
    describe('Toolbar Composition and Methods', function() {
        beforeEach(function() {
            var datasources = new DataSources();
            var layout = {
                dashboard: {
                    components: [
                        { type: 'dimensions' }
                    ]
                },
                panels: [
                    {
                        id: 'test', width: 100, height: 100,
                        dashboard: {
                            components: [
                                { type: 'remove_panel' }
                            ]
                        }
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('body').selectAll('*').remove();
            this.plot = null;
        });
        it('should be accessible as an attribute of the plot or panel that created it', function() {
            assert.isObject(this.plot.dashboard);
            assert.instanceOf(this.plot.dashboard, Toolbar);

            assert.isObject(this.plot.panels.test.dashboard);
            assert.instanceOf(this.plot.panels.test.dashboard, Toolbar);
        });
        it('should generate a selector for its DOM element when shown', function() {
            this.plot.dashboard.show();
            assert.isArray(this.plot.dashboard.selector);
            assert.instanceOf(this.plot.dashboard.selector, d3.selection);
            assert.equal(this.plot.dashboard.selector.empty(), false);
            assert.equal(this.plot.dashboard.selector.attr('id'), d3.select('#plot\\.dashboard').attr('id'));
            this.plot.panels.test.dashboard.show();
            assert.isArray(this.plot.panels.test.dashboard.selector);
            assert.ok(this.plot.panels.test.dashboard.selector instanceof d3.selection);
            assert.equal(this.plot.panels.test.dashboard.selector.empty(), false);
            assert.equal(this.plot.panels.test.dashboard.selector.attr('id'), d3.select('#plot\\.test\\.dashboard').attr('id'));
        });
        it('should preserve its DOM element and make it invisible when hidden', function() {
            this.plot.dashboard.show();
            this.plot.dashboard.hide();
            assert.notEqual(this.plot.dashboard.selector, null);
            assert.equal(d3.select('#plot\\.dashboard').empty(), false);
            assert.equal(d3.select('#plot\\.dashboard').style('visibility'), 'hidden');
            this.plot.dashboard.show();
            assert.equal(d3.select('#plot\\.dashboard').style('visibility'), 'visible');
            this.plot.panels.test.dashboard.show();
            this.plot.panels.test.dashboard.hide();
            assert.notEqual(this.plot.panels.test.dashboard.selector, null);
            assert.equal(d3.select('#plot\\.test\\.dashboard').empty(), false);
            assert.equal(d3.select('#plot\\.test\\.dashboard').style('visibility'), 'hidden');
            this.plot.panels.test.dashboard.show();
            assert.equal(d3.select('#plot\\.test\\.dashboard').style('visibility'), 'visible');
        });
        it('should remove its DOM element, null out its selector, and reset its components when destroyed', function() {
            this.plot.dashboard.show();
            this.plot.dashboard.destroy();
            assert.equal(this.plot.dashboard.selector, null);
            assert.ok(d3.select('#plot\\.dashboard').empty());
            assert.deepEqual(this.plot.dashboard.components, []);
            this.plot.panels.test.dashboard.show();
            this.plot.panels.test.dashboard.destroy();
            assert.equal(this.plot.panels.test.dashboard.selector, null);
            assert.ok(d3.select('#plot\\.test\\.dashboard').empty());
            assert.deepEqual(this.plot.panels.test.dashboard.components, []);
        });
    });

    describe('Plot-Level Toolbar Rendering Behavior', function() {
        it('should not render a plot-level dashboard DOM element if void of any components', function() {
            var datasources = new DataSources();
            var layout = {
                panels: [
                    { id: 'test', width: 100, height: 100 }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
            assert.equal(d3.select('#plot').empty(), false);
            assert.equal(d3.select('#plot.dashboard').empty(), true);
        });
        it('should render a plot-level dashboard DOM element at least one component is defined', function() {
            var datasources = new DataSources();
            var layout = {
                dashboard: {
                    components: [
                        { type: 'dimensions' }
                    ]
                },
                panels: [
                    { id: 'test', width: 100, height: 100 }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
            assert.equal(d3.select('#plot').empty(), false);
            assert.equal(d3.select('#plot\\.dashboard').empty(), false);
        });
    });

    describe('Dimensions Component', function() {
        beforeEach(function() {
            var datasources = new DataSources();
            var layout = {
                dashboard: {
                    components: [
                        { type: 'dimensions' }
                    ]
                },
                panels: [
                    { id: 'test', width: 100, height: 100 }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('Should show initial plot dimensions', function() {
            assert.equal(this.plot.dashboard.components[0].selector.html(), '100px × 100px');
        });
        it('Should show updated plot dimensions automatically as dimensions change', function() {
            this.plot.setDimensions(220,330);
            assert.equal(this.plot.dashboard.components[0].selector.html(), '220px × 330px');
        });
    });

    describe('Region Scale Component', function() {
        beforeEach(function() {
            var datasources = new DataSources();
            var layout = {
                state: {
                    chr: 1,
                    start: 126547453,
                    end: 126847453
                },
                dashboard: {
                    components: [
                        { type: 'region_scale' }
                    ]
                }
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('Should show initial region scale from state', function() {
            assert.equal(this.plot.dashboard.components[0].selector.html(), '300.00 Kb');
        });
        it('Should show updated region scale from state as state region boundaries change', function() {
            return this.plot.applyState({ chr: 1, start: 126547453, end: 126947453 }).then(() => {
                assert.equal(this.plot.dashboard.components[0].selector.html(), '400.00 Kb');
            });
        });
    });
});
