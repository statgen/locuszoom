'use strict';

/**
  Plot.js Tests
  Test composition of the LocusZoom.Plot object and its base classes
*/
describe('LocusZoom.Plot', function() {
    // Tests
    it('creates an object for its name space', function() {
        should.exist(LocusZoom.Plot);
    });

    it('defines its layout defaults', function() {
        LocusZoom.Plot.should.have.property('DefaultLayout').which.is.an.Object;
    });

    describe('Constructor', function() {
        beforeEach(function() {
            this.plot = new LocusZoom.Plot('plot');
        });
        it('returns an object', function() {
            this.plot.should.be.an.Object;
        });
        it('should have an id', function() {
            this.plot.should.have.property('id').which.is.a.String;
        });
        it('should have a layout which is (superficially) a copy of StandardLayout', function() {
            assert.equal(this.plot.layout.width, LocusZoom.StandardLayout.width);
            assert.equal(this.plot.layout.height, LocusZoom.StandardLayout.height);
        });
    });

    describe('Geometry and Panels', function() {
        beforeEach(function() {
            var layout = {
                width: 100,
                height: 100,
                min_width: 1,
                min_height: 1,
                aspect_ratio: 1,
                panels: []
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', {}, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should allow for adding arbitrarily many panels', function() {
            this.plot.addPanel.should.be.a.Function;
            var panelA = this.plot.addPanel({ id: 'panelA', foo: 'bar' });
            panelA.should.have.property('id').which.is.exactly('panelA');
            this.plot.panels.should.have.property(panelA.id).which.is.exactly(panelA);
            this.plot.panels[panelA.id].should.have.property('parent').which.is.exactly(this.plot);
            this.plot.panels[panelA.id].should.have.property('layout_idx').which.is.exactly(0);
            this.plot.layout.panels.length.should.be.exactly(1);
            this.plot.layout.panels[0].should.be.an.Object;
            this.plot.layout.panels[0].should.have.property('id').which.is.exactly('panelA');
            this.plot.layout.panels[0].should.have.property('foo').which.is.exactly('bar');
            var panelB = this.plot.addPanel({ id: 'panelB', foo: 'baz' });
            panelB.should.have.property('id').which.is.exactly('panelB');
            this.plot.panels.should.have.property(panelB.id).which.is.exactly(panelB);
            this.plot.panels[panelB.id].should.have.property('parent').which.is.exactly(this.plot);
            this.plot.panels[panelB.id].should.have.property('layout_idx').which.is.exactly(1);
            this.plot.layout.panels.length.should.be.exactly(2);
            this.plot.layout.panels[1].should.be.an.Object;
            this.plot.layout.panels[1].should.have.property('id').which.is.exactly('panelB');
            this.plot.layout.panels[1].should.have.property('foo').which.is.exactly('baz');
        });
        it('should allow for removing panels', function() {
            this.plot.removePanel.should.be.a.Function;
            var panelA = this.plot.addPanel({ id: 'panelA', foo: 'bar' });
            var panelB = this.plot.addPanel({ id: 'panelB', foo: 'baz' });
            this.plot.panels.should.have.property('panelA');
            this.plot.panels[panelA.id].id.should.be.exactly(panelA.id);
            this.plot.layout.panels.length.should.be.exactly(2);
            this.plot.removePanel('panelA');
            this.plot.panels.should.not.have.property('panelA');
            this.plot.layout.panels.length.should.be.exactly(1);
            this.plot.layout.panels[0].id.should.be.exactly('panelB');
            this.plot.panels[panelB.id].should.have.property('layout_idx').which.is.exactly(0);
        });
        it('should allow setting dimensions, bounded by layout minimums', function() {
            this.plot.setDimensions(563, 681);
            this.plot.layout.width.should.be.exactly(563);
            this.plot.layout.height.should.be.exactly(681);
            this.plot.layout.aspect_ratio.should.be.exactly(563 / 681);
            this.plot.setDimensions(1320.3, -50);
            this.plot.layout.width.should.be.exactly(563);
            this.plot.layout.height.should.be.exactly(681);
            this.plot.layout.aspect_ratio.should.be.exactly(563 / 681);
            this.plot.setDimensions('q', 0);
            this.plot.layout.width.should.be.exactly(563);
            this.plot.layout.height.should.be.exactly(681);
            this.plot.layout.aspect_ratio.should.be.exactly(563 / 681);
            this.plot.setDimensions(1, 1);
            this.plot.layout.width.should.be.exactly(this.plot.layout.min_width);
            this.plot.layout.height.should.be.exactly(this.plot.layout.min_height);
            this.plot.layout.aspect_ratio.should.be.exactly(this.plot.layout.min_width / this.plot.layout.min_height);
        });
        it('should enforce minimum dimensions based on its panels', function() {
            this.plot.addPanel({ id: 'p1', width: 50, height: 30, min_width: 50, min_height: 30 });
            this.plot.addPanel({ id: 'p2', width: 20, height: 10, min_width: 20, min_height: 10 });
            this.plot.setDimensions(1, 1);
            assert.equal(this.plot.layout.min_width, 50);
            assert.equal(this.plot.layout.min_height, 40);
            this.plot.layout.width.should.be.exactly(this.plot.layout.min_width);
            this.plot.layout.height.should.be.exactly(this.plot.layout.min_height);
        });
        it('should allow for responsively positioning panels using a proportional dimensions', function() {
            var responsive_layout = LocusZoom.Layouts.get('plot', 'standard_association', {
                responsive_resize: true,
                aspect_ratio: 2,
                panels: [
                    { id: 'positions', proportional_width: 1, proportional_height: 0.6, min_height: 60 },
                    { id: 'genes', proportional_width: 1, proportional_height: 0.4, min_height: 40 }
                ]
            });
            this.plot = LocusZoom.populate('#plot', {}, responsive_layout);
            assert.equal(this.plot.layout.panels[0].height / this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels[1].height / this.plot.layout.height, 0.4);
            this.plot.setDimensions(2000);
            assert.equal(this.plot.layout.panels[0].height / this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels[1].height / this.plot.layout.height, 0.4);
            this.plot.setDimensions(900, 900);
            assert.equal(this.plot.layout.panels[0].height / this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels[1].height / this.plot.layout.height, 0.4);
            this.plot.setDimensions(100, 100);
            assert.equal(this.plot.layout.panels[0].height / this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels[1].height / this.plot.layout.height, 0.4);
        });
        it('should enforce consistent data layer widths and x-offsets across x-linked panels', function() {
            var layout = {
                width: 1000,
                height: 500,
                aspect_ratio: 2,
                panels: [
                    LocusZoom.Layouts.get('panel', 'association', { margin: { left: 200 } }),
                    LocusZoom.Layouts.get('panel', 'association', { id: 'assoc2', margin: { right: 300 } })
                ]
            };
            this.plot = LocusZoom.populate('#plot', {}, layout);
            assert.equal(this.plot.layout.panels[0].margin.left, 200);
            assert.equal(this.plot.layout.panels[1].margin.left, 200);
            assert.equal(this.plot.layout.panels[0].margin.right, 300);
            assert.equal(this.plot.layout.panels[1].margin.right, 300);
            assert.equal(this.plot.layout.panels[0].cliparea.origin.x, 200);
            assert.equal(this.plot.layout.panels[1].cliparea.origin.x, 200);
            assert.equal(this.plot.layout.panels[0].width, this.plot.layout.panels[0].width);
            assert.equal(this.plot.layout.panels[0].origin.x, this.plot.layout.panels[0].origin.x);
        });
        it('should not allow for a non-numerical / non-positive predefined dimensions', function() {
            assert.throws(function() { this.plot = LocusZoom.populate('#plot', {}, { width: 0, height: 0 }); });
            assert.throws(function() { this.plot = LocusZoom.populate('#plot', {}, { width: 20, height: -20 }); });
            assert.throws(function() { this.plot = LocusZoom.populate('#plot', {}, { width: 'foo', height: 40 }); });
            assert.throws(function() { this.plot = LocusZoom.populate('#plot', {}, { width: 60, height: [1,2] }); });
        });
        it('should not allow for a non-numerical / non-positive predefined aspect ratio', function() {
            assert.throws(function() {
                var responsive_layout = { responsive_resize: true, aspect_ratio: 0 };
                this.plot = LocusZoom.populate('#plot', {}, responsive_layout);
            });
            assert.throws(function() {
                var responsive_layout = { responsive_resize: true, aspect_ratio: -1 };
                this.plot = LocusZoom.populate('#plot', {}, responsive_layout);
            });
            assert.throws(function() {
                var responsive_layout = { responsive_resize: true, aspect_ratio: 'foo' };
                this.plot = LocusZoom.populate('#plot', {}, responsive_layout);
            });
            assert.throws(function() {
                var responsive_layout = { responsive_resize: true, aspect_ratio: [1,2,3] };
                this.plot = LocusZoom.populate('#plot', {}, responsive_layout);
            });
        });
    });

    describe('SVG Composition', function() {
        describe('Mouse Guide Layer', function() {
            beforeEach(function() {
                d3.select('body').append('div').attr('id', 'plot');
                this.plot = LocusZoom.populate('#plot');
            });
            it('first child should be a mouse guide layer group element', function() {
                d3.select(this.plot.svg.node().firstChild).attr('id').should.be.exactly('plot.mouse_guide');
            });
            it('should have a mouse guide object with mouse guide svg selectors', function() {
                this.plot.mouse_guide.should.be.an.Object;
                this.plot.mouse_guide.svg.should.be.an.Object;
                assert.equal(this.plot.mouse_guide.svg.html(), this.plot.svg.select('#plot\\.mouse_guide').html());
                this.plot.mouse_guide.vertical.should.be.an.Object;
                assert.equal(this.plot.mouse_guide.vertical.html(), this.plot.svg.select('#plot\\.mouse_guide rect.lz-mouse_guide-vertical').html());
                this.plot.mouse_guide.horizontal.should.be.an.Object;
                assert.equal(this.plot.mouse_guide.horizontal.html(), this.plot.svg.select('#plot\\.mouse_guide rect.lz-mouse_guide-horizontal').html());
            });
        });
    });

    describe('Dynamic Panel Positioning', function() {
        beforeEach(function() {
            var datasources = new LocusZoom.DataSources();
            var layout = {
                width: 100,
                height: 100,
                min_width: 100,
                min_height: 100,
                aspect_ratio: 1,
                panels: []
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', datasources, layout);
        });
        it('Should adjust the size of the panel if a single panel is added that does not completely fill min_height', function() {
            var panelA = { id: 'panelA', width: 100, height: 50 };
            this.plot.addPanel(panelA);
            var svg = d3.select('#plot svg');
            this.plot.layout.width.should.be.exactly(100);
            this.plot.layout.height.should.be.exactly(100);
            (+svg.attr('width')).should.be.exactly(100);
            (+svg.attr('height')).should.be.exactly(100);
            this.plot.panels.panelA.layout.width.should.be.exactly(100);
            this.plot.panels.panelA.layout.height.should.be.exactly(100);
            this.plot.panels.panelA.layout.proportional_height.should.be.exactly(1);
            this.plot.panels.panelA.layout.proportional_origin.y.should.be.exactly(0);
            this.plot.panels.panelA.layout.origin.y.should.be.exactly(0);
            this.plot.sumProportional('height').should.be.exactly(1);
        });
        it('Should extend the size of the plot if panels are added that expand it, and automatically prevent panels from overlapping vertically', function() {
            var panelA = { id: 'panelA', width: 100, height: 60 };
            var panelB = { id: 'panelB', width: 100, height: 60 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            var svg = d3.select('#plot svg');
            this.plot.layout.width.should.be.exactly(100);
            this.plot.layout.height.should.be.exactly(160);
            (+svg.attr('width')).should.be.exactly(100);
            (+svg.attr('height')).should.be.exactly(160);
            this.plot.panels.panelA.layout.width.should.be.exactly(100);
            this.plot.panels.panelA.layout.height.should.be.exactly(100);
            this.plot.panels.panelA.layout.proportional_height.should.be.exactly(0.625);
            this.plot.panels.panelA.layout.proportional_origin.y.should.be.exactly(0);
            this.plot.panels.panelA.layout.origin.y.should.be.exactly(0);
            this.plot.panels.panelB.layout.width.should.be.exactly(100);
            this.plot.panels.panelB.layout.height.should.be.exactly(60);
            this.plot.panels.panelB.layout.proportional_height.should.be.exactly(0.375);
            this.plot.panels.panelB.layout.proportional_origin.y.should.be.exactly(0.625);
            this.plot.panels.panelB.layout.origin.y.should.be.exactly(100);
            this.plot.sumProportional('height').should.be.exactly(1);
        });
        it('Should resize the plot as panels are removed', function() {
            var panelA = { id: 'panelA', width: 100, height: 60 };
            var panelB = { id: 'panelB', width: 100, height: 60 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.removePanel('panelA');
            var svg = d3.select('#plot svg');
            this.plot.layout.width.should.be.exactly(100);
            this.plot.layout.height.should.be.exactly(100);
            (+svg.attr('width')).should.be.exactly(100);
            (+svg.attr('height')).should.be.exactly(100);
            this.plot.panels.panelB.layout.width.should.be.exactly(100);
            this.plot.panels.panelB.layout.height.should.be.exactly(100);
            this.plot.panels.panelB.layout.proportional_height.should.be.exactly(1);
            this.plot.panels.panelB.layout.proportional_origin.y.should.be.exactly(0);
            this.plot.panels.panelB.layout.origin.y.should.be.exactly(0);
            this.plot.sumProportional('height').should.be.exactly(1);
        });
        it('Should resize the plot as panels are removed, when panels specify min_height', function() {
            // Regression test for a reported edge case where `min_height` caused resizing logic to work differently

            // Small hack; resize the plot after it was created
            this.plot.layout.min_height = this.plot._base_layout.min_height = 600;
            this.plot.layout.height = this.plot._base_layout.height = 600;
            this.plot.layout.width = this.plot._base_layout.width = 800;
            this.plot.layout.min_width = this.plot._base_layout.min_width = 800;
            this.plot.layout.responsive_resize = this.plot._base_layout.responsive_resize = true;

            // These numbers are based on a real plot. Expected behavior is chosen to match behavior of a layout where
            //   panels had no min_height specified.
            var panelA = { id: 'panelA', width: 800, height: 300, min_height: 300 };
            var panelB = { id: 'panelB', width: 800, height: 50, min_height: 50 };
            var panelC = { id: 'panelC', width: 800, height: 225, min_height: 112.5 };

            // Set up the scenario
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.addPanel(panelC);

            this.plot.removePanel('panelC');
            // Check dimensions. Some checks are approximate due to floating point rounding issues.
            this.plot.layout.width.should.be.exactly(800, 'Plot width is incorrect');
            this.plot.layout.height.should.be.approximately(650, 0.000001, 'Plot height is incorrect');

            this.plot.panels.panelB.layout.width.should.be.exactly(800, 'Panel B width is incorrect');
            this.plot.panels.panelB.layout.height.should.be.exactly(50, 'Panel B height is incorrect');
            // When the overall plot specifies a min_height larger than any panel, the final resizing of the panels
            //   must respect that setting. Thus, panels A and B will not have the same relative proportions
            //   after panel C is removed.
            this.plot.panels.panelA.layout.proportional_height.should.be.approximately(600 / 650, 0.000001, 'Panel A proportional height is incorrect');
            this.plot.panels.panelB.layout.proportional_height.should.be.approximately(50 / 650, 0.000001, 'Panel B proportional height is incorrect');
            this.plot.panels.panelB.layout.proportional_origin.y.should.be.exactly(1 - 50 / 650, 'Panel B proportional_origin.y is incorrect');
            this.plot.panels.panelB.layout.origin.y.should.be.exactly(600, 'Panel B origin.y is incorrect');
            this.plot.sumProportional('height').should.be.approximately(1, 0.000001, 'Total height should be 1');
        });
        it('Should resize the plot while retaining panel proportions when panel is removed, if plot min_height does not take precedence', function() {
            // When we remove a panel, we often want the plot to shrink by exactly that size. (so that the bottom
            //   section simply disappears without changing the appearance of the panels that remain) But if plot
            //   min_height is larger than any one panel, the space actually gets reallocated, and the remaining
            //   panels stretch or shrink.
            // This test ensures that we will see the desired behavior when plot min_height isn't dominant.
            var panelA = { id: 'panelA', width: 800, height: 300, min_height: 300 };
            var panelB = { id: 'panelB', width: 800, height: 50, min_height: 50 };
            var panelC = { id: 'panelC', width: 800, height: 225, min_height: 112.5 };

            // Set up the scenario
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.addPanel(panelC);

            // Verify that panel A and B adopt a specific proportion (when 3 panels are present)
            this.plot.panels.panelA.layout.height.should.be.exactly(300, 'Panel A height is incorrect (before)');
            this.plot.panels.panelB.layout.height.should.be.exactly(50, 'Panel B height is incorrect (before)');

            this.plot.removePanel('panelC');
            // Check dimensions. Some checks are approximate due to floating point rounding issues.
            this.plot.layout.width.should.be.exactly(800, 'Plot width is incorrect');
            this.plot.layout.height.should.be.exactly(350, 'Plot height is incorrect');

            // Panels A and B will have the same size and relative proportions after resize as before
            this.plot.panels.panelA.layout.height.should.be.exactly(300, 'Panel A height is incorrect (after)');
            this.plot.panels.panelB.layout.height.should.be.exactly(50, 'Panel B height is incorrect (after)');
            this.plot.panels.panelB.layout.width.should.be.exactly(800, 'Panel B width is incorrect');

            this.plot.panels.panelA.layout.proportional_height.should.be.approximately(300 / 350, 0.000001, 'Panel A proportional height is incorrect');
            this.plot.panels.panelB.layout.proportional_height.should.be.approximately(50 / 350, 0.000001, 'Panel B proportional height is incorrect');
            this.plot.panels.panelB.layout.proportional_origin.y.should.be.approximately(1 - 50 / 350, 0.000001, 'Panel B proportional_origin.y is incorrect');
            this.plot.panels.panelB.layout.origin.y.should.be.exactly(300, 'Panel B origin.y is incorrect');
            this.plot.sumProportional('height').should.be.approximately(1, 0.000001, 'Total proportional height should be 1');
        });
        it('Should allow for inserting panels at discrete y indexes', function() {
            var panelA = { id: 'panelA', width: 100, height: 60 };
            var panelB = { id: 'panelB', idth: 100, height: 60 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            var panelC = { id: 'panelC', width: 100, height: 60, y_index: 1 };
            this.plot.addPanel(panelC);
            this.plot.panels.panelA.layout.y_index.should.be.exactly(0);
            this.plot.panels.panelB.layout.y_index.should.be.exactly(2);
            this.plot.panels.panelC.layout.y_index.should.be.exactly(1);
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['panelA', 'panelC', 'panelB']);
        });
        it('Should allow for inserting panels at negative discrete y indexes', function() {
            var panelA = { id: 'panelA', width: 100, height: 60 };
            var panelB = { id: 'panelB', width: 100, height: 60 };
            var panelC = { id: 'panelC', width: 100, height: 60 };
            var panelD = { id: 'panelD', width: 100, height: 60 };
            this.plot.addPanel(panelA);
            this.plot.addPanel(panelB);
            this.plot.addPanel(panelC);
            this.plot.addPanel(panelD);
            var panelE = { id: 'panelE', width: 100, height: 60, y_index: -1 };
            this.plot.addPanel(panelE);
            this.plot.panels.panelA.layout.y_index.should.be.exactly(0);
            this.plot.panels.panelB.layout.y_index.should.be.exactly(1);
            this.plot.panels.panelC.layout.y_index.should.be.exactly(2);
            this.plot.panels.panelD.layout.y_index.should.be.exactly(4);
            this.plot.panels.panelE.layout.y_index.should.be.exactly(3);
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['panelA', 'panelB', 'panelC', 'panelE', 'panelD']);
        });
    });

    describe('Plot Curtain and Loader', function() {
        beforeEach(function() {
            var datasources = new LocusZoom.DataSources();
            var layout = {
                width: 100,
                height: 100,
                min_width: 100,
                min_height: 100,
                aspect_ratio: 1,
                panels: []
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', datasources, layout);
        });
        it('should have a curtain object with show/update/hide methods, a showing boolean, and selectors', function() {
            this.plot.should.have.property('curtain').which.is.an.Object;
            this.plot.curtain.should.have.property('showing').which.is.exactly(false);
            this.plot.curtain.should.have.property('show').which.is.a.Function;
            this.plot.curtain.should.have.property('update').which.is.a.Function;
            this.plot.curtain.should.have.property('hide').which.is.a.Function;
            this.plot.curtain.should.have.property('selector').which.is.exactly(null);
            this.plot.curtain.should.have.property('content_selector').which.is.exactly(null);
        });
        it('should show/hide/update on command and track shown status', function() {
            this.plot.curtain.showing.should.be.false();
            this.plot.curtain.should.have.property('selector').which.is.exactly(null);
            this.plot.curtain.should.have.property('content_selector').which.is.exactly(null);
            this.plot.curtain.show('test content');
            this.plot.curtain.showing.should.be.true();
            this.plot.curtain.selector.empty().should.be.false();
            this.plot.curtain.content_selector.empty().should.be.false();
            this.plot.curtain.content_selector.html().should.be.exactly('test content');
            this.plot.curtain.hide();
            this.plot.curtain.showing.should.be.false();
            this.plot.curtain.should.have.property('selector').which.is.exactly(null);
            this.plot.curtain.should.have.property('content_selector').which.is.exactly(null);
        });
        it('should have a loader object with show/update/animate/setPercentCompleted/hide methods, a showing boolean, and selectors', function() {
            this.plot.should.have.property('loader').which.is.an.Object;
            this.plot.loader.should.have.property('showing').which.is.exactly(false);
            this.plot.loader.should.have.property('show').which.is.a.Function;
            this.plot.loader.should.have.property('update').which.is.a.Function;
            this.plot.loader.should.have.property('animate').which.is.a.Function;
            this.plot.loader.should.have.property('update').which.is.a.Function;
            this.plot.loader.should.have.property('setPercentCompleted').which.is.a.Function;
            this.plot.loader.should.have.property('selector').which.is.exactly(null);
            this.plot.loader.should.have.property('content_selector').which.is.exactly(null);
            this.plot.loader.should.have.property('progress_selector').which.is.exactly(null);
        });
        it('should show/hide/update on command and track shown status', function() {
            this.plot.loader.showing.should.be.false();
            this.plot.loader.should.have.property('selector').which.is.exactly(null);
            this.plot.loader.should.have.property('content_selector').which.is.exactly(null);
            this.plot.loader.should.have.property('progress_selector').which.is.exactly(null);
            this.plot.loader.show('test content');
            this.plot.loader.showing.should.be.true();
            this.plot.loader.selector.empty().should.be.false();
            this.plot.loader.content_selector.empty().should.be.false();
            this.plot.loader.content_selector.html().should.be.exactly('test content');
            this.plot.loader.progress_selector.empty().should.be.false();
            this.plot.loader.hide();
            this.plot.loader.showing.should.be.false();
            this.plot.loader.should.have.property('selector').which.is.exactly(null);
            this.plot.loader.should.have.property('content_selector').which.is.exactly(null);
            this.plot.loader.should.have.property('progress_selector').which.is.exactly(null);
        });
        it('should allow for animating or showing discrete percentages of completion', function() {
            this.plot.loader.show('test content').animate();
            this.plot.loader.progress_selector.classed('lz-loader-progress-animated').should.be.true();
            this.plot.loader.setPercentCompleted(15);
            this.plot.loader.content_selector.html().should.be.exactly('test content');
            this.plot.loader.progress_selector.classed('lz-loader-progress-animated').should.be.false();
            this.plot.loader.progress_selector.style('width').should.be.exactly('15%');
            this.plot.loader.update('still loading...', 62);
            this.plot.loader.content_selector.html().should.be.exactly('still loading...');
            this.plot.loader.progress_selector.style('width').should.be.exactly('62%');
            this.plot.loader.setPercentCompleted(200);
            this.plot.loader.progress_selector.style('width').should.be.exactly('100%');
            this.plot.loader.setPercentCompleted(-43);
            this.plot.loader.progress_selector.style('width').should.be.exactly('1%');
            this.plot.loader.setPercentCompleted('foo');
            this.plot.loader.progress_selector.style('width').should.be.exactly('1%');
        });
    });

    describe('State and Requests', function() {
        beforeEach(function() {
            this.datasources = new LocusZoom.DataSources();
            this.layout = { width: 100, height: 100 };
            d3.select('body').append('div').attr('id', 'plot');
        });
        afterEach(function() {
            this.plot = null;
            this.layout = null;
            d3.select('#plot').remove();
        });
        it('Should apply basic start/end state validation when necessary', function(done) {
            this.layout.state = { chr: 1, start: -60, end: 10300050 };
            this.plot = LocusZoom.populate('#plot', this.datasources, this.layout);
            Promise.all(this.plot.remap_promises).then(function() {
                assert.equal(this.plot.state.start, 1);
                assert.equal(this.plot.state.end, 10300050);
                done();
            }.bind(this)).catch(done);
        });
        it('Should apply minimum region scale state validation if set in the plot layout', function(done) {
            this.layout.min_region_scale = 2000;
            this.layout.state = { chr: 1, start: 10300000, end: 10300050 };
            this.plot = LocusZoom.populate('#plot', this.datasources, this.layout);
            Promise.all(this.plot.remap_promises).then(function() {
                assert.equal(this.plot.state.start, 10299025);
                assert.equal(this.plot.state.end, 10301025);
                done();
            }.bind(this)).catch(done);
        });
        it('Should apply maximum region scale state validation if set in the plot layout', function(done) {
            this.layout.max_region_scale = 4000000;
            this.layout.state = { chr: 1, start: 10300000, end: 15300000 };
            this.plot = LocusZoom.populate('#plot', this.datasources, this.layout);
            Promise.all(this.plot.remap_promises).then(function() {
                assert.equal(this.plot.state.start, 10800000);
                assert.equal(this.plot.state.end, 14800000);
                done();
            }.bind(this)).catch(done);
        });
    });

    describe('subscribeToData', function() {
        beforeEach(function() {
            var layout = {
                panels: [ { id: 'panel0' } ]
            };

            this.first_source_data = [ { x: 0, y: false  }, { x: 1, y: true } ];
            this.data_sources = new LocusZoom.DataSources()
                .add('first', ['StaticJSON', this.first_source_data ]);

            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', this.data_sources, layout);
        });

        afterEach(function() {
            d3.select('#plot').remove();
            sinon.restore();
        });

        it('allows subscribing to data using a standard limited fields array', function (done) {
            var expectedData = [ {'first:x': 0}, {'first:x': 1} ];

            var dataCallback = sinon.spy();

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
                } catch(error) {
                    done(error);
                }
            }, 0);
        });

        it('allows subscribing to individual (not combined) sources', function (done) {
            var expectedData = { first: [ {'first:x': 0}, {'first:x': 1} ] };
            var dataCallback = sinon.spy();

            this.plot.subscribeToData(
                [ 'first:x' ],
                dataCallback,
                { onerror: done , discrete: true }
            );
            // Ugly hack: callback was not recognized at time of promise resolution, and data_rendered may be fired
            //  more than once during rerender
            window.setTimeout(function() {
                try {
                    assert.ok(dataCallback.called, 'Data handler was called');
                    assert.ok(dataCallback.calledWith(expectedData), 'Data handler received the expected data');
                    done();
                } catch(error) {
                    done(error);
                }
            }, 0);
        });

        it('calls an error callback if a problem occurs while fetching data', function() {
            var dataCallback = sinon.spy();
            var errorCallback = sinon.spy();

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
            var dataCallback = sinon.spy();
            var errorCallback = sinon.spy();

            var listener = this.plot.subscribeToData(
                [ 'nosource:x' ],
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

    describe('allows communication between layers via match events', function () {
        beforeEach(function() {
            this.plot = null;
            var first_source_data = [ { id: 'a', x: 0, y: false  }, { id: 'b', x: 1, y: true } ];
            var data_sources = new LocusZoom.DataSources()
                .add('s', ['StaticJSON', first_source_data ]);
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
                                match: { send: 's:x', receive: 's:x' }
                            },
                            {
                                id: 'd2',
                                id_field: 's:id',
                                type: 'scatter',
                                fields: ['s:id', 's:x', 's:y']
                            },
                            {
                                id: 'd3',
                                id_field: 's:id',
                                type: 'scatter',
                                fields: ['s:id', 's:y'],
                                match: { receive: 's:y' }
                            }
                        ]
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', data_sources, this.layout);
        });

        afterEach(function() {
            d3.select('#plot').remove();
            delete this.plot;
        });

        it('notifies all layers to find matches when an event fires', function () {
            // This is the end result of triggering a match event, and lets us test after render promise complete
            var plot = this.plot;
            return this.plot.applyState({ lz_match_value: 0 }).then(function() {

                var get_matches = function(data) { return data.map(function(item) {return item.lz_highlight_match; }); };
                var d1 = get_matches(plot.panels.p.data_layers.d1.data);
                var d2 = get_matches(plot.panels.p.data_layers.d2.data);
                var d3 = get_matches(plot.panels.p.data_layers.d3.data);

                assert.deepEqual(d1, [true, false], 'layer 1 responded to match event');
                assert.deepEqual(d2, [undefined, undefined], 'layer 2 ignored match event so no flag present');
                assert.deepEqual(d3, [false, false], 'layer 3 saw match event but no values matched');
            });
        });
    });
});
