'use strict';

/**
  Panel.js Tests
  Test composition of the LocusZoom.Panel object and its base classes
*/
describe('LocusZoom.Panel', function() {
    // Tests
    it('creates an object for its name space', function() {
        should.exist(LocusZoom.Panel);
    });

    it('defines its layout defaults', function() {
        LocusZoom.Panel.should.have.property('DefaultLayout').which.is.an.Object;
    });

    describe('Constructor', function() {
        beforeEach(function() {
            d3.select('body').append('div').attr('id', 'plot_id');
            this.plot = LocusZoom.populate('#plot_id');
            this.panel = this.plot.panels.association;
        });
        afterEach(function() {
            d3.select('#plot_id').remove();
            this.plot = null;
            this.panel = null;
        });
        it('returns an object', function() {
            this.panel.should.be.an.Object;
        });
        it('should have an id', function() {
            this.panel.should.have.property('id');
        });
        it('should have an object for tracking data layers', function() {
            this.panel.should.have.property('data_layers').which.is.an.Object;
        });
        it('should track dimensions, margins, and positioning with a layout object', function() {
            this.panel.should.have.property('layout').which.is.an.Object;
            this.panel.layout.width.should.be.a.Number;
            this.panel.layout.height.should.be.a.Number;
            this.panel.layout.min_width.should.be.a.Number;
            this.panel.layout.min_height.should.be.a.Number;
            this.panel.layout.proportional_width.should.be.a.Number;
            this.panel.layout.proportional_height.should.be.a.Number;
            this.panel.layout.origin.should.be.an.Object;
            this.panel.layout.origin.should.have.property('x').which.is.a.Number;
            this.panel.layout.origin.should.have.property('y').which.is.a.Number;
            this.panel.layout.margin.should.be.an.Object;
            this.panel.layout.margin.should.have.property('top').which.is.a.Number;
            this.panel.layout.margin.should.have.property('right').which.is.a.Number;
            this.panel.layout.margin.should.have.property('bottom').which.is.a.Number;
            this.panel.layout.margin.should.have.property('left').which.is.a.Number;
            this.panel.layout.cliparea.should.be.an.Object;
            this.panel.layout.cliparea.should.have.property('width').which.is.a.Number;
            this.panel.layout.cliparea.should.have.property('height').which.is.a.Number;
            this.panel.layout.cliparea.should.have.property('origin').which.is.an.Object;
            this.panel.layout.cliparea.origin.should.have.property('x').which.is.a.Number;
            this.panel.layout.cliparea.origin.should.have.property('y').which.is.a.Number;
        });
        it('should generate an ID if passed a layout that does not define one', function() {
            this.plot.addPanel({ 'foo': 'bar' });
            var panel_idx = this.plot.layout.panels.length - 1;
            this.plot.layout.panels[panel_idx].should.have.property('id').which.is.a.String;
            this.plot.layout.panels[panel_idx].foo.should.be.exactly('bar');
            this.plot.panels[this.plot.layout.panels[panel_idx].id].should.be.an.Object;
            this.plot.panels[this.plot.layout.panels[panel_idx].id].layout.foo.should.be.exactly('bar');
        });
        it('should throw an error if adding a panel with an ID that is already used', function() {
            this.plot.addPanel({ 'id': 'duplicate', 'foo': 'bar' });
            assert.throws(function() {
                this.plot.addPanel({ 'id': 'duplicate', 'foo2': 'bar2' });
            }.bind(this));
        });
    });

    describe('Geometry Methods', function() {
        beforeEach(function() {
            d3.select('body').append('div').attr('id', 'plot_id');
            this.plot = LocusZoom.populate('#plot_id');
            this.association_panel = this.plot.panels.association;
            this.genes_panel = this.plot.panels.genes;
        });
        afterEach(function() {
            d3.select('#plot_id').remove();
            this.plot = null;
            this.association_panel = null;
            this.genes_panel = null;
        });
        it('should allow changing dimensions', function() {
            this.association_panel.setDimensions(840, 560);
            this.association_panel.layout.should.have.property('width').which.is.exactly(840);
            this.association_panel.layout.should.have.property('height').which.is.exactly(560);
            this.association_panel.setDimensions(9000, -50);
            this.association_panel.layout.should.have.property('width').which.is.exactly(840);
            this.association_panel.layout.should.have.property('height').which.is.exactly(560);
            this.association_panel.setDimensions('q', 942);
            this.association_panel.layout.should.have.property('width').which.is.exactly(840);
            this.association_panel.layout.should.have.property('height').which.is.exactly(560);
        });
        it('should enforce minimum dimensions', function() {
            this.association_panel.layout.width.should.not.be.lessThan(this.association_panel.layout.min_width);
            this.association_panel.layout.height.should.not.be.lessThan(this.association_panel.layout.min_height);
            this.association_panel.setDimensions(this.association_panel.layout.min_width / 2, 0);
            this.association_panel.layout.width.should.not.be.lessThan(this.association_panel.layout.min_width);
            this.association_panel.layout.height.should.not.be.lessThan(this.association_panel.layout.min_height);
            this.association_panel.setDimensions(0, this.association_panel.layout.min_height / 2);
            this.association_panel.layout.width.should.not.be.lessThan(this.association_panel.layout.min_width);
            this.association_panel.layout.height.should.not.be.lessThan(this.association_panel.layout.min_height);
        });
        it('should allow setting origin irrespective of plot dimensions', function() {
            this.plot.setDimensions(500, 600);
            this.association_panel.setOrigin(20, 50);
            this.association_panel.layout.origin.x.should.be.exactly(20);
            this.association_panel.layout.origin.y.should.be.exactly(50);
            this.association_panel.setOrigin(0, 0);
            this.association_panel.layout.origin.x.should.be.exactly(0);
            this.association_panel.layout.origin.y.should.be.exactly(0);
            this.association_panel.setOrigin('q', { foo: 'bar' });
            this.association_panel.layout.origin.x.should.be.exactly(0);
            this.association_panel.layout.origin.y.should.be.exactly(0);
            this.association_panel.setOrigin(700, 800);
            this.association_panel.layout.origin.x.should.be.exactly(700);
            this.association_panel.layout.origin.y.should.be.exactly(800);
        });
        it('should allow setting margin, which sets cliparea origin and dimensions', function() {
            this.association_panel.setMargin(1, 2, 3, 4);
            this.association_panel.layout.margin.top.should.be.exactly(1);
            this.association_panel.layout.margin.right.should.be.exactly(2);
            this.association_panel.layout.margin.bottom.should.be.exactly(3);
            this.association_panel.layout.margin.left.should.be.exactly(4);
            this.association_panel.layout.cliparea.origin.x.should.be.exactly(4);
            this.association_panel.layout.cliparea.origin.y.should.be.exactly(1);
            this.association_panel.layout.cliparea.width.should.be.exactly(this.association_panel.layout.width - (2 + 4));
            this.association_panel.layout.cliparea.height.should.be.exactly(this.association_panel.layout.height - (1 + 3));
            this.association_panel.setMargin(0, '12', -17, {foo: 'bar'});
            this.association_panel.layout.margin.top.should.be.exactly(0);
            this.association_panel.layout.margin.right.should.be.exactly(12);
            this.association_panel.layout.margin.bottom.should.be.exactly(3);
            this.association_panel.layout.margin.left.should.be.exactly(4);
            this.association_panel.layout.cliparea.origin.x.should.be.exactly(4);
            this.association_panel.layout.cliparea.origin.y.should.be.exactly(0);
            this.association_panel.layout.cliparea.width.should.be.exactly(this.association_panel.layout.width - (12 + 4));
            this.association_panel.layout.cliparea.height.should.be.exactly(this.association_panel.layout.height - (0 + 3));
        });
        it('should prevent margins from overlapping', function() {
            this.association_panel.setDimensions(500, 500);
            this.association_panel.setMargin(700, 1000, 900, 800);
            this.association_panel.layout.margin.should.have.property('top').which.is.exactly(150);
            this.association_panel.layout.margin.should.have.property('right').which.is.exactly(350);
            this.association_panel.layout.margin.should.have.property('bottom').which.is.exactly(350);
            this.association_panel.layout.margin.should.have.property('left').which.is.exactly(150);
        });
        it('should have a method for moving panels up that stops at the top', function() {
            this.genes_panel.should.have.property('moveUp').which.is.a.Function;
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['association', 'genes']);
            this.association_panel.layout.should.have.property('y_index').which.is.exactly(0);
            this.genes_panel.layout.should.have.property('y_index').which.is.exactly(1);
            this.genes_panel.moveUp();
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['genes', 'association']);
            this.association_panel.layout.should.have.property('y_index').which.is.exactly(1);
            this.genes_panel.layout.should.have.property('y_index').which.is.exactly(0);
            this.genes_panel.moveUp();
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['genes', 'association']);
            this.association_panel.layout.should.have.property('y_index').which.is.exactly(1);
            this.genes_panel.layout.should.have.property('y_index').which.is.exactly(0);
        });
        it('should have a method for moving panels down that stops at the bottom', function() {
            this.genes_panel.should.have.property('moveDown').which.is.a.Function;
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['association', 'genes']);
            this.association_panel.layout.should.have.property('y_index').which.is.exactly(0);
            this.genes_panel.layout.should.have.property('y_index').which.is.exactly(1);
            this.association_panel.moveDown();
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['genes', 'association']);
            this.association_panel.layout.should.have.property('y_index').which.is.exactly(1);
            this.genes_panel.layout.should.have.property('y_index').which.is.exactly(0);
            this.association_panel.moveDown();
            assert.deepEqual(this.plot.panel_ids_by_y_index, ['genes', 'association']);
            this.association_panel.layout.should.have.property('y_index').which.is.exactly(1);
            this.genes_panel.layout.should.have.property('y_index').which.is.exactly(0);
        });
    });

    describe('Data Layer Methods', function() {
        beforeEach(function() {
            var layout = {
                width: 800,
                height: 400,
                panels: [
                    { id: 'panel0', width: 800, proportional_width: 1, height: 400, proportional_height: 1 }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', {}, layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('should have a method for adding data layers', function() {
            this.plot.panels.panel0.should.have.property('addDataLayer').which.is.a.Function;
            this.plot.panels.panel0.addDataLayer({ id: 'layerA', type: 'line' });
            this.plot.panels.panel0.addDataLayer({ id: 'layerB', type: 'line' });
            this.plot.panels.panel0.data_layers.layerA.should.be.an.Object;
            this.plot.panels.panel0.data_layers.layerA.id.should.be.exactly('layerA');
            this.plot.panels.panel0.data_layers.layerA.layout_idx.should.be.exactly(0);
            this.plot.panels.panel0.data_layers.layerB.should.be.an.Object;
            this.plot.panels.panel0.data_layers.layerB.id.should.be.exactly('layerB');
            this.plot.panels.panel0.data_layers.layerB.layout_idx.should.be.exactly(1);
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerB']);
            assert.equal(typeof this.plot.state[this.plot.panels.panel0.data_layers.layerA.state_id], 'object');
            assert.equal(typeof this.plot.state[this.plot.panels.panel0.data_layers.layerB.state_id], 'object');
        });
        it('should have a method for removing data layers by id', function() {
            this.plot.panels.panel0.should.have.property('removeDataLayer').which.is.a.Function;
            this.plot.panels.panel0.addDataLayer({ id: 'layerA', type: 'line' });
            this.plot.panels.panel0.addDataLayer({ id: 'layerB', type: 'line' });
            this.plot.panels.panel0.addDataLayer({ id: 'layerC', type: 'line' });
            var state_id = this.plot.panels.panel0.data_layers.layerB.state_id;
            assert.equal(typeof this.plot.panels.panel0.data_layers.layerB, 'object');
            assert.equal(typeof this.plot.state[state_id], 'object');
            this.plot.panels.panel0.removeDataLayer('layerB');
            assert.equal(typeof this.plot.panels.panel0.data_layers.layerB, 'undefined');
            assert.equal(typeof this.plot.state[state_id], 'undefined');
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout_idx, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout_idx, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC']);
        });
    });

    describe('Panel Curtain and Loader', function() {
        beforeEach(function() {
            var datasources = new LocusZoom.DataSources();
            this.layout = {
                width: 100,
                height: 100,
                min_width: 100,
                min_height: 100,
                resizable: false,
                aspect_ratio: 1,
                panels: [
                    {
                        id: 'test',
                        width: 100,
                        height: 100
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', datasources, this.layout);
            this.panel = this.plot.panels.test;
        });

        afterEach(function() {
            d3.select('#plot').remove();
        });

        it('should have a curtain object with show/update/hide methods, a showing boolean, and selectors', function() {
            this.panel.should.have.property('curtain').which.is.an.Object;
            this.panel.curtain.should.have.property('showing').which.is.exactly(false);
            this.panel.curtain.should.have.property('show').which.is.a.Function;
            this.panel.curtain.should.have.property('update').which.is.a.Function;
            this.panel.curtain.should.have.property('hide').which.is.a.Function;
            this.panel.curtain.should.have.property('selector').which.is.exactly(null);
            this.panel.curtain.should.have.property('content_selector').which.is.exactly(null);
        });
        it('should show/hide/update on command and track shown status', function() {
            this.panel.curtain.showing.should.be.false;
            this.panel.curtain.should.have.property('selector').which.is.exactly(null);
            this.panel.curtain.should.have.property('content_selector').which.is.exactly(null);
            this.panel.curtain.show('test content');
            this.panel.curtain.showing.should.be.true;
            this.panel.curtain.selector.empty().should.be.false;
            this.panel.curtain.content_selector.empty().should.be.false;
            this.panel.curtain.content_selector.html().should.be.exactly('test content');
            this.panel.curtain.hide();
            this.panel.curtain.showing.should.be.false;
            this.panel.curtain.should.have.property('selector').which.is.exactly(null);
            this.panel.curtain.should.have.property('content_selector').which.is.exactly(null);
        });
        it('should have a loader object with show/update/animate/setPercentCompleted/hide methods, a showing boolean, and selectors', function() {
            this.panel.should.have.property('loader').which.is.an.Object;
            this.panel.loader.should.have.property('showing').which.is.false;
            this.panel.loader.should.have.property('show').which.is.a.Function;
            this.panel.loader.should.have.property('update').which.is.a.Function;
            this.panel.loader.should.have.property('animate').which.is.a.Function;
            this.panel.loader.should.have.property('update').which.is.a.Function;
            this.panel.loader.should.have.property('setPercentCompleted').which.is.a.Function;
            this.panel.loader.should.have.property('selector').which.is.exactly(null);
            this.panel.loader.should.have.property('content_selector').which.is.exactly(null);
            this.panel.loader.should.have.property('progress_selector').which.is.exactly(null);
        });
        it('should show/hide/update on command and track shown status', function() {
            this.panel.loader.showing.should.be.false;
            this.panel.loader.should.have.property('selector').which.is.exactly(null);
            this.panel.loader.should.have.property('content_selector').which.is.exactly(null);
            this.panel.loader.should.have.property('progress_selector').which.is.exactly(null);
            this.panel.loader.show('test content');
            this.panel.loader.showing.should.be.true;
            this.panel.loader.selector.empty().should.be.false;
            this.panel.loader.content_selector.empty().should.be.false;
            this.panel.loader.content_selector.html().should.be.exactly('test content');
            this.panel.loader.progress_selector.empty().should.be.false;
            this.panel.loader.hide();
            this.panel.loader.showing.should.be.false;
            this.panel.loader.should.have.property('selector').which.is.exactly(null);
            this.panel.loader.should.have.property('content_selector').which.is.exactly(null);
            this.panel.loader.should.have.property('progress_selector').which.is.exactly(null);
        });
        it('should allow for animating or showing discrete percentages of completion', function() {
            this.panel.loader.show('test content').animate();
            this.panel.loader.progress_selector.classed('lz-loader-progress-animated').should.be.true;
            this.panel.loader.setPercentCompleted(15);
            this.panel.loader.content_selector.html().should.be.exactly('test content');
            this.panel.loader.progress_selector.classed('lz-loader-progress-animated').should.be.false;
            this.panel.loader.progress_selector.style('width').should.be.exactly('15%');
            this.panel.loader.update('still loading...', 62);
            this.panel.loader.content_selector.html().should.be.exactly('still loading...');
            this.panel.loader.progress_selector.style('width').should.be.exactly('62%');
            this.panel.loader.setPercentCompleted(200);
            this.panel.loader.progress_selector.style('width').should.be.exactly('100%');
            this.panel.loader.setPercentCompleted(-43);
            this.panel.loader.progress_selector.style('width').should.be.exactly('1%');
            this.panel.loader.setPercentCompleted('foo');
            this.panel.loader.progress_selector.style('width').should.be.exactly('1%');
        });
    });

    describe('Panel Interactions', function() {
        beforeEach(function() {
            this.plot = null;
            this.datasources = new LocusZoom.DataSources()
                .add('static', ['StaticJSON', [{ id: 'a', x: 1, y: 2 }, { id: 'b', x: 3, y: 4 }, { id: 'c', x: 5, y: 6 }] ]);
            this.layout = {
                width: 100,
                height: 100,
                panels: [
                    {
                        id: 'p',
                        width: 100,
                        height: 100,
                        axes: {
                            x: { label: 'x' },
                            y1: { label: 'y1' }
                        },
                        interaction: {},
                        data_layers: [
                            {
                                id: 'd',
                                type: 'scatter',
                                fields: ['static:id', 'static:x', 'static:y'],
                                id_field: 'static:id',
                                z_index: 0,
                                x_axis: {
                                    field: 'static:x'
                                },
                                y_axis: {
                                    axis: 1,
                                    field: 'static:y'
                                }
                            }
                        ]
                    }
                ]
            };
            // Stash the original d3.mouse function as some of the tests in this suite will override it to simulate clicks
            this.d3_mouse_orig = d3.mouse;
            d3.select('body').append('div').attr('id', 'plot');
        });
        afterEach(function() {
            d3.select('#plot').remove();
            d3.mouse = this.d3_mouse_orig;
            delete this.plot;
            delete this.datasources;
            delete this.layout;
        });
        it ('should have a method for gathering linked panel IDs', function() {
            d3.select('body').append('div').attr('id', 'plot');
            var layout = {
                width: 100,
                height: 100,
                panels: [
                    { id: 'p1', interaction: { x_linked: true } },
                    { id: 'p2', interaction: { y1_linked: true } },
                    { id: 'p3', interaction: { y1_linked: true } },
                    { id: 'p4', interaction: { x_linked: true } },
                    { id: 'p5', interaction: { y2_linked: true } },
                    { id: 'p6', interaction: { x_linked: true } },
                    { id: 'p7', interaction: { y1_linked: true } }
                ]
            };
            var plot = LocusZoom.populate('#plot', {}, layout);
            plot.panels.p1.getLinkedPanelIds.should.be.a.Function;
            assert.ok(Array.isArray(plot.panels.p1.getLinkedPanelIds()));
            assert.ok(Array.isArray(plot.panels.p1.getLinkedPanelIds('x')));
            assert.deepEqual(plot.panels.p1.getLinkedPanelIds('x'), ['p4','p6']);
            assert.deepEqual(plot.panels.p1.getLinkedPanelIds('y1'), []);
            assert.deepEqual(plot.panels.p3.getLinkedPanelIds('y1'), ['p2','p7']);
            assert.deepEqual(plot.panels.p4.getLinkedPanelIds('foo'), []);
            assert.deepEqual(plot.panels.p4.getLinkedPanelIds({}), []);
            assert.deepEqual(plot.panels.p4.getLinkedPanelIds(7), []);
        });
        it('should establish only what interaction mouse event handlers are needed when no interaction layout directives are defined', function() {
            this.plot = LocusZoom.populate('#plot', this.datasources, this.layout);
            should.not.exist(this.plot.panels.p.svg.container.select('.lz-panel-background')['__onmousedown.plot.p.interaction.drag.background']);
            should.exist(this.plot.svg.node()['__onmouseup.plot']);
            should.exist(this.plot.svg.node()['__onmousemove.plot']);
            should.not.exist(this.plot.panels.p.svg.container.node()['__onwheel.zoom']);
        });
        it('should establish background drag interaction handlers when the layout directive is present', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_background_to_pan = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                assert.equal(typeof self.plot.panels.p.svg.container.select('.lz-panel-background').node()['__onmousedown.plot.p.interaction.drag.background'], 'function');
                assert.equal(typeof self.plot.svg.node()['__onmouseup.plot'], 'function');
                assert.equal(typeof self.plot.svg.node()['__onmousemove.plot'], 'function');

            });
        });
        it('should establish x tick drag interaction handlers when the layout directives are present', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_x_ticks_to_scale = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                assert.equal(typeof self.plot.svg.node()['__onmouseup.plot'], 'function');
                assert.equal(typeof self.plot.svg.node()['__onmousemove.plot'], 'function');
                assert.equal(typeof self.plot.panels.p.svg.container.select('.lz-axis.lz-x .tick text').node()['__onmousedown.plot.p.interaction.drag'], 'function');
            });
        });
        it('should establish y1 tick drag interaction handlers when the layout directives are present', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_y1_ticks_to_scale = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                assert.equal(typeof self.plot.svg.node()['__onmouseup.plot'], 'function');
                assert.equal(typeof self.plot.svg.node()['__onmousemove.plot'], 'function');
                assert.equal(typeof self.plot.panels.p.svg.container.select('.lz-axis.lz-y1 .tick text').node()['__onmousedown.plot.p.interaction.drag'], 'function');
            });
        });
        it('should establish a zoom interaction handler on the panel when the layout directive is present', function() {
            var self = this;
            self.layout.panels[0].interaction.scroll_to_zoom = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                assert.equal(typeof self.plot.panels.p.svg.container.node()['__onmousedown.zoom'], 'function');
            });
        });
        it ('should pan along the x axis when dragging the background', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_background_to_pan = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function () {
                // Simulate click (mousedown) at [ 50, 50 ]
                d3.mouse = function() { return [ 50, 50 ]; };
                self.plot.panels.p.svg.container.select('.lz-panel-background').node()['__onmousedown.plot.p.interaction.drag.background']();
                self.plot.interaction.should.be.an.Object;
                self.plot.interaction.panel_id.should.be.exactly(self.plot.panels.p.id);
                self.plot.interaction.dragging.should.be.an.Object;
                self.plot.interaction.dragging.method.should.be.exactly('background');
                self.plot.interaction.dragging.start_x.should.be.exactly(50);
                self.plot.interaction.dragging.start_y.should.be.exactly(50);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 25, 50 ] (x -25)
                d3.mouse = function() { return [ 25, 50 ]; };
                self.plot.svg.node()['__onmousemove.plot']();
                self.plot.interaction.panel_id.should.be.exactly(self.plot.panels.p.id);
                self.plot.interaction.dragging.method.should.be.exactly('background');
                self.plot.interaction.dragging.start_x.should.be.exactly(50);
                self.plot.interaction.dragging.start_y.should.be.exactly(50);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(-25);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                assert.deepEqual(self.plot.panels.p.x_extent, [2,6]);
                // Simulate mouseup at new location
                self.plot.svg.node()['__onmouseup.plot']();
                assert.deepEqual(self.plot.interaction, {});
                self.plot.panels.p.data_layers.d.layout.x_axis.floor.should.be.exactly(2);
                self.plot.panels.p.data_layers.d.layout.x_axis.ceiling.should.be.exactly(6);
            });
        });
        it ('should scale along the x axis when dragging an x tick', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_x_ticks_to_scale = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                // Simulate click (mousedown) at [ 50, 0 ] (x tick probably doesn't exist there but that's okay)
                d3.mouse = function() { return [ 50, 0 ]; };
                self.plot.panels.p.svg.container.select('.lz-axis.lz-x .tick text').node()['__onmousedown.plot.p.interaction.drag']();
                self.plot.interaction.should.be.an.Object;
                self.plot.interaction.dragging.should.be.an.Object;
                self.plot.interaction.dragging.method.should.be.exactly('x_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(50);
                self.plot.interaction.dragging.start_y.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 25, 0 ] (x -25)
                d3.mouse = function() { return [ 25, 0 ]; };
                self.plot.svg.node()['__onmousemove.plot']();
                self.plot.interaction.dragging.method.should.be.exactly('x_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(50);
                self.plot.interaction.dragging.start_y.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(-25);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                assert.deepEqual(self.plot.panels.p.x_extent, [1,9]);
                // Simulate mouseup at new location
                self.plot.svg.node()['__onmouseup.plot']();
                assert.deepEqual(self.plot.interaction, {});
                self.plot.panels.p.data_layers.d.layout.x_axis.floor.should.be.exactly(1);
                self.plot.panels.p.data_layers.d.layout.x_axis.ceiling.should.be.exactly(9);
            });
        });
        it ('should pan along the x axis when shift+dragging an x tick', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_x_ticks_to_scale = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                var event = { shiftKey: true, preventDefault: function() { return null; } };
                // Simulate shift+click (mousedown) at [ 50, 0 ] (x tick probably doesn't exist there but that's okay)
                d3.mouse = function() { return [ 50, 0 ]; };
                self.plot.panels.p.svg.container.select('.lz-axis.lz-x .tick text').node()['__onmousedown.plot.p.interaction.drag'](event);
                self.plot.interaction.should.be.an.Object;
                self.plot.interaction.dragging.should.be.an.Object;
                self.plot.interaction.dragging.method.should.be.exactly('x_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(50);
                self.plot.interaction.dragging.start_y.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 25, 0 ] (x -25)
                d3.mouse = function() { return [ 25, 0 ]; };
                self.plot.svg.node()['__onmousemove.plot'](event);
                self.plot.interaction.dragging.method.should.be.exactly('x_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(50);
                self.plot.interaction.dragging.start_y.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(-25);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                assert.deepEqual(self.plot.panels.p.x_extent, [2,6]);
                // Simulate mouseup at new location
                self.plot.svg.node()['__onmouseup.plot'](event);
                assert.deepEqual(self.plot.interaction, {});
                self.plot.panels.p.data_layers.d.layout.x_axis.floor.should.be.exactly(2);
                self.plot.panels.p.data_layers.d.layout.x_axis.ceiling.should.be.exactly(6);
            });
        });
        it ('should scale along the y1 axis when dragging a y1 tick', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_y1_ticks_to_scale = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                // Simulate click (mousedown) at [ 0, 25 ] (y1 tick probably doesn't exist there but that's okay)
                d3.mouse = function() { return [ 0, 25 ]; };
                self.plot.panels.p.svg.container.select('.lz-axis.lz-y1 .tick text').node()['__onmousedown.plot.p.interaction.drag']();
                self.plot.interaction.should.be.an.Object;
                self.plot.interaction.dragging.should.be.an.Object;
                self.plot.interaction.dragging.method.should.be.exactly('y1_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(0);
                self.plot.interaction.dragging.start_y.should.be.exactly(25);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 0, 75 ] (x +50)
                d3.mouse = function() { return [ 0, 75 ]; };
                self.plot.svg.node()['__onmousemove.plot']();
                self.plot.interaction.dragging.method.should.be.exactly('y1_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(0);
                self.plot.interaction.dragging.start_y.should.be.exactly(25);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(50);
                assert.deepEqual(self.plot.panels.p.y1_extent, [2,14.000000000000004]);
                // Simulate mouseup at new location
                self.plot.svg.node()['__onmouseup.plot']();
                assert.deepEqual(self.plot.interaction, {});
                self.plot.panels.p.data_layers.d.layout.y_axis.floor.should.be.exactly(2);
                self.plot.panels.p.data_layers.d.layout.y_axis.ceiling.should.be.exactly(14.000000000000004);
            });
        });
        it ('should pan along the y axis when shift+dragging a y tick', function() {
            var self = this;
            self.layout.panels[0].interaction.drag_y1_ticks_to_scale = true;
            self.plot = LocusZoom.populate('#plot', self.datasources, self.layout);
            return Promise.all(self.plot.remap_promises).then(function() {
                var event = { shiftKey: true, preventDefault: function() { return null; } };
                // Simulate shift+click (mousedown) at [ 0, 25 ] (y1 tick probably doesn't exist there but that's okay)
                d3.mouse = function() { return [ 0, 25 ]; };
                self.plot.panels.p.svg.container.select('.lz-axis.lz-y1 .tick text').node()['__onmousedown.plot.p.interaction.drag'](event);
                self.plot.interaction.should.be.an.Object;
                self.plot.interaction.dragging.should.be.an.Object;
                self.plot.interaction.dragging.method.should.be.exactly('y1_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(0);
                self.plot.interaction.dragging.start_y.should.be.exactly(25);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 0, 75 ] (x +50)
                d3.mouse = function() { return [ 0, 75 ]; };
                self.plot.svg.node()['__onmousemove.plot'](event);
                self.plot.interaction.dragging.method.should.be.exactly('y1_tick');
                self.plot.interaction.dragging.start_x.should.be.exactly(0);
                self.plot.interaction.dragging.start_y.should.be.exactly(25);
                self.plot.interaction.dragging.dragged_x.should.be.exactly(0);
                self.plot.interaction.dragging.dragged_y.should.be.exactly(50);
                assert.deepEqual(self.plot.panels.p.y1_extent, [4,8]);
                // Simulate mouseup at new location
                self.plot.svg.node()['__onmouseup.plot'](event);
                assert.deepEqual(self.plot.interaction, {});
                self.plot.panels.p.data_layers.d.layout.y_axis.floor.should.be.exactly(4);
                self.plot.panels.p.data_layers.d.layout.y_axis.ceiling.should.be.exactly(8);
            });
        });
    });

    describe('Panel events', function() {
        beforeEach(function() {
            var layout = {
                panels: [
                    { id: 'panel0' }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', {}, layout);
            this.panel = this.plot.panels.panel0;
        });

        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });

        it('should send events packaged with source and data', function() {
            var spy = sinon.spy();
            this.panel.on('element_clicked', spy);
            this.panel.emit('element_clicked', { something: 1 });

            assert.ok(spy.calledWith({
                sourceID: 'plot.panel0',
                data: {something:1}
            }));
        });
        it('should bubble events to plot and preserve event source + data when expected', function() {
            var panel_spy = sinon.spy();
            var plot_spy = sinon.spy();

            this.plot.on('element_clicked', plot_spy);
            this.panel.on('element_clicked', panel_spy);

            this.panel.emit('element_clicked', {something: 1}, true);

            var expectedEvent = { sourceID: 'plot.panel0', data: {something: 1} };

            assert.ok(plot_spy.calledOnce, 'Plot event was fired');
            assert.ok(plot_spy.calledWith(expectedEvent), 'Plot called with expected event');
            assert.ok(panel_spy.calledOnce, 'Panel event was fired');
            assert.ok(panel_spy.calledWith(expectedEvent), 'Panel called with expected event');
        });
        it('should bubble events to plot (overloaded no-data call signature)', function() {
            var panel_spy = sinon.spy();
            var plot_spy = sinon.spy();

            this.plot.on('element_clicked', plot_spy);
            this.panel.on('element_clicked', panel_spy);

            // When only two arguments are specified, with last one a boolean
            this.panel.emit('element_clicked', true);

            var expectedEvent = { sourceID: 'plot.panel0', data: null };

            assert.ok(plot_spy.calledOnce, 'Plot event was fired');
            assert.ok(plot_spy.calledWith(expectedEvent), 'Plot called with expected event');
            assert.ok(panel_spy.calledOnce, 'Panel event was fired');
            assert.ok(panel_spy.calledWith(expectedEvent), 'Panel called with expected event');
        });
        it('should not bubble events to plot when not expected', function() {
            // "No data" call signature
            var panel_nodata_spy = sinon.spy();
            var plot_nodata_spy = sinon.spy();

            this.plot.on('element_clicked', plot_nodata_spy);
            this.panel.on('element_clicked', panel_nodata_spy);

            this.panel.emit('element_clicked', false);

            var expectedEvent = { sourceID: 'plot.panel0', data: null };

            assert.ok(plot_nodata_spy.notCalled, 'Plot event should not be fired');
            assert.ok(panel_nodata_spy.calledOnce, 'Panel event was fired');
            assert.ok(panel_nodata_spy.calledWith(expectedEvent), 'Panel called with expected event');

            // "Has data" call signature
            var panel_withdata_spy = sinon.spy();
            var plot_withdata_spy = sinon.spy();
            this.panel.on('element_clicked', panel_withdata_spy);
            this.panel.emit('element_clicked', {something: 1}, false);

            var expectedDataEvent = { sourceID: 'plot.panel0', data: {something: 1} };

            assert.ok(plot_withdata_spy.notCalled, 'Plot event (with data) should not be not fired');
            assert.ok(panel_withdata_spy.calledOnce, 'Panel event (with data) was fired');
            assert.ok(panel_withdata_spy.calledWith(expectedDataEvent), 'Panel event (with data) called with expected event');
        });
        it('allows event listeners to be removed / cleaned up individually', function() {
            var listener_handle = this.panel.on('element_clicked', function() {});
            assert.equal(this.panel.event_hooks['element_clicked'].length, 1, 'Registered event listener');

            this.panel.off('element_clicked', listener_handle);
            assert.equal(this.panel.event_hooks['element_clicked'].length, 0, 'De-registered event listener');
        });
        it('allows event listeners to be removed / cleaned up all at once', function() {
            // Register two events!
            this.panel.on('element_clicked', function() {});
            this.panel.on('element_clicked', function() {});
            assert.equal(this.panel.event_hooks['element_clicked'].length, 2, 'Registered event listeners');

            this.panel.off('element_clicked');
            assert.equal(this.panel.event_hooks['element_clicked'].length, 0, 'De-registered event listener');
        });
        it('should scope the value of this to wherever the listener was attached, unless overridden', function() {
            var call_count = 0;
            this.plot.on('element_clicked', function() {
                assert.ok(this instanceof LocusZoom.Plot, 'Plot listener is bound to plot');
                call_count += 1;
            });
            this.panel.on('element_clicked', function(event) {
                assert.ok(this instanceof LocusZoom.Panel, 'Panel listener is bound to panel');
                call_count += 1;
            });

            // Any manually provided binding context will override the one used by default. For example, an event
            //  listener could be used to trigger changes to a viewmodel for a different widget
            var bind_context = { someInstanceMethod: function() {} };
            this.panel.on('element_clicked', function () {
                assert.deepEqual(this, bind_context, 'Manually bound context overrides defaults');
                call_count += 1;
            }.bind(bind_context));

            this.panel.emit('element_clicked', true);
            assert.equal(call_count, 3, 'All listener handlers were called as expected');
        });
    });
});
