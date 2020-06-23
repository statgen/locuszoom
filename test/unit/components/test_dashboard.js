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
                toolbar: {
                    widgets: [
                        { type: 'dimensions' }
                    ]
                },
                panels: [
                    {
                        id: 'test', width: 100, height: 100,
                        toolbar: {
                            widgets: [
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
            assert.isObject(this.plot.toolbar);
            assert.instanceOf(this.plot.toolbar, Toolbar);

            assert.isObject(this.plot.panels.test.toolbar);
            assert.instanceOf(this.plot.panels.test.toolbar, Toolbar);
        });
        it('should generate a selector for its DOM element when shown', function() {
            this.plot.toolbar.show();
            assert.isArray(this.plot.toolbar.selector);
            assert.instanceOf(this.plot.toolbar.selector, d3.selection);
            assert.equal(this.plot.toolbar.selector.empty(), false);
            assert.equal(this.plot.toolbar.selector.attr('id'), d3.select('#plot\\.toolbar').attr('id'));
            this.plot.panels.test.toolbar.show();
            assert.isArray(this.plot.panels.test.toolbar.selector);
            assert.ok(this.plot.panels.test.toolbar.selector instanceof d3.selection);
            assert.equal(this.plot.panels.test.toolbar.selector.empty(), false);
            assert.equal(this.plot.panels.test.toolbar.selector.attr('id'), d3.select('#plot\\.test\\.toolbar').attr('id'));
        });
        it('should preserve its DOM element and make it invisible when hidden', function() {
            this.plot.toolbar.show();
            this.plot.toolbar.hide();
            assert.notEqual(this.plot.toolbar.selector, null);
            assert.equal(d3.select('#plot\\.toolbar').empty(), false);
            assert.equal(d3.select('#plot\\.toolbar').style('visibility'), 'hidden');
            this.plot.toolbar.show();
            assert.equal(d3.select('#plot\\.toolbar').style('visibility'), 'visible');
            this.plot.panels.test.toolbar.show();
            this.plot.panels.test.toolbar.hide();
            assert.notEqual(this.plot.panels.test.toolbar.selector, null);
            assert.equal(d3.select('#plot\\.test\\.toolbar').empty(), false);
            assert.equal(d3.select('#plot\\.test\\.toolbar').style('visibility'), 'hidden');
            this.plot.panels.test.toolbar.show();
            assert.equal(d3.select('#plot\\.test\\.toolbar').style('visibility'), 'visible');
        });
        it('should remove its DOM element, null out its selector, and reset its widgets when destroyed', function() {
            this.plot.toolbar.show();
            this.plot.toolbar.destroy();
            assert.equal(this.plot.toolbar.selector, null);
            assert.ok(d3.select('#plot\\.toolbar').empty());
            assert.deepEqual(this.plot.toolbar.widgets, []);
            this.plot.panels.test.toolbar.show();
            this.plot.panels.test.toolbar.destroy();
            assert.equal(this.plot.panels.test.toolbar.selector, null);
            assert.ok(d3.select('#plot\\.test\\.toolbar').empty());
            assert.deepEqual(this.plot.panels.test.toolbar.widgets, []);
        });
    });

    describe('Plot-Level Toolbar Rendering Behavior', function() {
        it('should not render a plot-level toolbar DOM element if void of any widgets', function() {
            var datasources = new DataSources();
            var layout = {
                panels: [
                    { id: 'test', width: 100, height: 100 }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
            assert.equal(d3.select('#plot').empty(), false);
            assert.equal(d3.select('#plot.toolbar').empty(), true);
        });
        it('should render a plot-level toolbar DOM element at least one widget is defined', function() {
            var datasources = new DataSources();
            var layout = {
                toolbar: {
                    widgets: [
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
            assert.equal(d3.select('#plot\\.toolbar').empty(), false);
        });
    });

    describe('Dimensions Widget', function() {
        beforeEach(function() {
            var datasources = new DataSources();
            var layout = {
                toolbar: {
                    widgets: [
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
            assert.equal(this.plot.toolbar.widgets[0].selector.html(), '100px × 100px');
        });
        it('Should show updated plot dimensions automatically as dimensions change', function() {
            this.plot.setDimensions(220,330);
            assert.equal(this.plot.toolbar.widgets[0].selector.html(), '220px × 330px');
        });
    });

    describe('Region Scale Widget', function() {
        beforeEach(function() {
            var datasources = new DataSources();
            var layout = {
                state: {
                    chr: 1,
                    start: 126547453,
                    end: 126847453
                },
                toolbar: {
                    widgets: [
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
            assert.equal(this.plot.toolbar.widgets[0].selector.html(), '300.00 Kb');
        });
        it('Should show updated region scale from state as state region boundaries change', function() {
            return this.plot.applyState({ chr: 1, start: 126547453, end: 126947453 }).then(() => {
                assert.equal(this.plot.toolbar.widgets[0].selector.html(), '400.00 Kb');
            });
        });
    });
});
