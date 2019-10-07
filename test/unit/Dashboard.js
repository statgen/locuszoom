'use strict';

/**
  Dashboard.js Tests
  Test composition and function of dashboard framework and compontents
*/

describe('LocusZoom.Dashboard', function() {
    // Tests
    it('defines an abstract dashboard class', function() {
        should.exist(LocusZoom.Dashboard);
        LocusZoom.Dashboard.should.be.a.Function;
    });

    it('defines an abstract dashboard component class', function() {
        should.exist(LocusZoom.Dashboard.Component);
        LocusZoom.Dashboard.Component.should.be.a.Function;
    });

    it('defines an abstract dashboard component button class', function() {
        should.exist(LocusZoom.Dashboard.Component.Button);
        LocusZoom.Dashboard.Component.Button.should.be.a.Function;
    });

    it('defines a singleton object for extending a collection of components', function() {
        should.exist(LocusZoom.Dashboard.Components);
        LocusZoom.Dashboard.Components.should.be.an.Object;
    });

    describe('Dashboard Composition and Methods', function() {
        beforeEach(function() {
            var datasources = new LocusZoom.DataSources();
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
            this.plot = LocusZoom.populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('body').selectAll('*').remove();
            this.plot = null;
        });
        it('should be accessible as an attribute of the plot or panel that created it', function() {
            this.plot.dashboard.should.be.an.Object;
            assert.ok(this.plot.dashboard instanceof LocusZoom.Dashboard);
            this.plot.panels.test.dashboard.should.be.an.Object;
            assert.ok(this.plot.panels.test.dashboard instanceof LocusZoom.Dashboard);
        });
        it('should generate a selector for its DOM element when shown', function() {
            this.plot.dashboard.show();
            this.plot.dashboard.selector.should.be.an.Object;
            assert.ok(this.plot.dashboard.selector instanceof d3.selection);
            assert.equal(this.plot.dashboard.selector.empty(), false);
            assert.equal(this.plot.dashboard.selector.attr('id'), d3.select('#plot\\.dashboard').attr('id'));
            this.plot.panels.test.dashboard.show();
            this.plot.panels.test.dashboard.selector.should.be.an.Object;
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

    describe('Plot-Level Dashboard Rendering Behavior', function() {
        it('should not render a plot-level dashboard DOM element if void of any components', function() {
            var datasources = new LocusZoom.DataSources();
            var layout = {
                panels: [
                    { id: 'test', width: 100, height: 100 }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', datasources, layout);
            assert.equal(d3.select('#plot').empty(), false);
            assert.equal(d3.select('#plot.dashboard').empty(), true);
        });
        it('should render a plot-level dashboard DOM element at least one component is defined', function() {
            var datasources = new LocusZoom.DataSources();
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
            this.plot = LocusZoom.populate('#plot', datasources, layout);
            assert.equal(d3.select('#plot').empty(), false);
            assert.equal(d3.select('#plot\\.dashboard').empty(), false);
        });
    });

    describe('Dimensions Component', function() {
        beforeEach(function() {
            var datasources = new LocusZoom.DataSources();
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
            this.plot = LocusZoom.populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('Should show initial plot dimensions', function() {
            this.plot.dashboard.components[0].selector.html().should.be.exactly('100px × 100px');
        });
        it('Should show updated plot dimensions automatically as dimensions change', function() {
            this.plot.setDimensions(220,330);
            this.plot.dashboard.components[0].selector.html().should.be.exactly('220px × 330px');
        });
    });

    describe('Region Scale Component', function() {
        beforeEach(function() {
            var datasources = new LocusZoom.DataSources();
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
            this.plot = LocusZoom.populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('Should show initial region scale from state', function() {
            this.plot.dashboard.components[0].selector.html().should.be.exactly('300.00 Kb');
        });
        it('Should show updated region scale from state as state region boundaries change', function(done) {
            this.plot.applyState({ chr: 1, start: 126547453, end: 126947453 }).then(function() {
                this.plot.dashboard.components[0].selector.html().should.be.exactly('400.00 Kb');
                done();
            }.bind(this)).catch(done);
        });
    });

    describe('Covariates Model Component', function() {
        beforeEach(function() {
            var datasources = new LocusZoom.DataSources();
            var layout = {
                dashboard: {
                    components: [
                        { type: 'covariates_model' }
                    ]
                }
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', datasources, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('Should have initialized a state object for model covariates', function() {
            this.plot.state.model.should.be.an.Object;
            this.plot.state.model.covariates.should.be.an.Array;
            this.plot.state.model.covariates.length.should.be.exactly(0);
        });
        it('Should have initialized a plot object for interfacing with model covariates', function() {
            this.plot.CovariatesModel.should.be.an.Object;
        });
        it('Should have a method for adding arbitrary elements to covariates model', function() {
            this.plot.state.model.covariates.length.should.be.exactly(0);
            this.plot.CovariatesModel.add('foo');
            this.plot.state.model.covariates.length.should.be.exactly(1);
            this.plot.state.model.covariates[0].should.be.exactly('foo');
        });
        it('Should not allow for adding the same element to covariates model more than once', function() {
            this.plot.state.model.covariates.length.should.be.exactly(0);
            this.plot.CovariatesModel.add('foo');
            this.plot.state.model.covariates.length.should.be.exactly(1);
            this.plot.state.model.covariates[0].should.be.exactly('foo');
            this.plot.CovariatesModel.add('bar');
            this.plot.state.model.covariates.length.should.be.exactly(2);
            this.plot.state.model.covariates[1].should.be.exactly('bar');
            this.plot.CovariatesModel.add('foo');
            this.plot.state.model.covariates.length.should.be.exactly(2);
            var obj1 = { foo: 'bar', baz: function() { return 'baz'; } };
            var obj2 = { foo: 'asdf', baz: function() { return 'baz'; } };
            this.plot.CovariatesModel.add(obj1);
            this.plot.state.model.covariates.length.should.be.exactly(3);
            this.plot.CovariatesModel.add(obj2);
            this.plot.state.model.covariates.length.should.be.exactly(4);
            this.plot.CovariatesModel.add(obj1);
            this.plot.state.model.covariates.length.should.be.exactly(4);
        });
        it('Should have a method for removing covariates in model via their index in the array', function() {
            this.plot.CovariatesModel.add('foo').CovariatesModel.add('bar').CovariatesModel.add('baz');
            this.plot.state.model.covariates.length.should.be.exactly(3);
            this.plot.CovariatesModel.removeByIdx(1);
            this.plot.state.model.covariates.length.should.be.exactly(2);
            this.plot.state.model.covariates[0].should.be.exactly('foo');
            this.plot.state.model.covariates[1].should.be.exactly('baz');
            assert.throws(function() { this.plot.CovariatesModel.removeByIdx(9); });
            assert.throws(function() { this.plot.CovariatesModel.removeByIdx(-1); });
            assert.throws(function() { this.plot.CovariatesModel.removeByIdx('foo'); });
        });
        it('Should have a method for removing all covariates in model', function() {
            this.plot.CovariatesModel.add('foo').CovariatesModel.add('bar').CovariatesModel.add('baz');
            this.plot.state.model.covariates.length.should.be.exactly(3);
            this.plot.CovariatesModel.removeAll();
            this.plot.state.model.covariates.length.should.be.exactly(0);
        });
    });

});
