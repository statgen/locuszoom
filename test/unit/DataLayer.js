'use strict';

/**
 DataLayer.js Tests
 Test composition of the LocusZoom.Panel object and its base classes
 */
describe('LocusZoom.DataLayer', function () {
    // Tests
    it('creates an object for its name space', function () {
        should.exist(LocusZoom.DataLayer);
    });

    it('defines its layout defaults', function () {
        LocusZoom.DataLayer.should.have.property('DefaultLayout').which.is.an.Object;
    });

    describe('Constructor', function () {
        beforeEach(function () {
            this.datalayer = new LocusZoom.DataLayer();
        });
        it('returns an object', function () {
            this.datalayer.should.be.an.Object;
        });
        it('should have an id', function () {
            this.datalayer.should.have.property('id');
        });
        it('should have an array for caching data', function () {
            this.datalayer.should.have.property('data').which.is.an.Array;
        });
        it('should have an svg object', function () {
            this.datalayer.should.have.property('svg').which.is.an.Object;
        });
        it('should have a layout object', function () {
            this.datalayer.should.have.property('layout').which.is.an.Object;
        });
        it('should have a state object', function () {
            this.datalayer.should.have.property('state').which.is.an.Object;
        });
    });

    describe('Z-index sorting', function () {
        beforeEach(function () {
            var layout = {
                width: 800,
                height: 400,
                panels: [
                    {
                        id: 'panel0', width: 800, proportional_width: 1, height: 400, proportional_height: 1,
                        data_layers: [
                            { id: 'layerA', type: 'line' },
                            { id: 'layerB', type: 'line' },
                            { id: 'layerC', type: 'line' },
                            { id: 'layerD', type: 'line' }
                        ]
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', {}, layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('should have a chainable method for moving layers up that stops at the top', function () {
            this.plot.panels.panel0.data_layers.layerB.moveUp.should.be.a.Function;
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerB', 'layerC', 'layerD']);
            this.plot.panels.panel0.data_layers.layerB.moveUp();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerB', 'layerD']);
            this.plot.panels.panel0.data_layers.layerA.layout.z_index.should.be.exactly(0);
            this.plot.panels.panel0.data_layers.layerB.layout.z_index.should.be.exactly(2);
            this.plot.panels.panel0.data_layers.layerC.layout.z_index.should.be.exactly(1);
            this.plot.panels.panel0.data_layers.layerD.layout.z_index.should.be.exactly(3);
            this.plot.panels.panel0.data_layers.layerB.moveUp();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerD', 'layerB']);
            this.plot.panels.panel0.data_layers.layerA.layout.z_index.should.be.exactly(0);
            this.plot.panels.panel0.data_layers.layerB.layout.z_index.should.be.exactly(3);
            this.plot.panels.panel0.data_layers.layerC.layout.z_index.should.be.exactly(1);
            this.plot.panels.panel0.data_layers.layerD.layout.z_index.should.be.exactly(2);
            this.plot.panels.panel0.data_layers.layerB.moveUp().moveUp();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerD', 'layerB']);
            this.plot.panels.panel0.data_layers.layerA.layout.z_index.should.be.exactly(0);
            this.plot.panels.panel0.data_layers.layerB.layout.z_index.should.be.exactly(3);
            this.plot.panels.panel0.data_layers.layerC.layout.z_index.should.be.exactly(1);
            this.plot.panels.panel0.data_layers.layerD.layout.z_index.should.be.exactly(2);
        });
        it('should have a chainable method for moving layers down that stops at the bottom', function () {
            this.plot.panels.panel0.data_layers.layerC.moveDown.should.be.a.Function;
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerB', 'layerC', 'layerD']);
            this.plot.panels.panel0.data_layers.layerC.moveDown();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerB', 'layerD']);
            this.plot.panels.panel0.data_layers.layerA.layout.z_index.should.be.exactly(0);
            this.plot.panels.panel0.data_layers.layerB.layout.z_index.should.be.exactly(2);
            this.plot.panels.panel0.data_layers.layerC.layout.z_index.should.be.exactly(1);
            this.plot.panels.panel0.data_layers.layerD.layout.z_index.should.be.exactly(3);
            this.plot.panels.panel0.data_layers.layerC.moveDown();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerC', 'layerA', 'layerB', 'layerD']);
            this.plot.panels.panel0.data_layers.layerA.layout.z_index.should.be.exactly(1);
            this.plot.panels.panel0.data_layers.layerB.layout.z_index.should.be.exactly(2);
            this.plot.panels.panel0.data_layers.layerC.layout.z_index.should.be.exactly(0);
            this.plot.panels.panel0.data_layers.layerD.layout.z_index.should.be.exactly(3);
            this.plot.panels.panel0.data_layers.layerC.moveDown().moveDown();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerC', 'layerA', 'layerB', 'layerD']);
            this.plot.panels.panel0.data_layers.layerA.layout.z_index.should.be.exactly(1);
            this.plot.panels.panel0.data_layers.layerB.layout.z_index.should.be.exactly(2);
            this.plot.panels.panel0.data_layers.layerC.layout.z_index.should.be.exactly(0);
            this.plot.panels.panel0.data_layers.layerD.layout.z_index.should.be.exactly(3);
        });
    });

    describe('Scalable parameter resolution', function () {
        it('has a method to resolve scalable parameters into discrete values', function () {
            this.datalayer = new LocusZoom.DataLayer({ id: 'test' });
            this.datalayer.resolveScalableParameter.should.be.a.Function;
        });
        it('passes numbers and strings directly through regardless of data', function () {
            this.datalayer = new LocusZoom.DataLayer({ id: 'test' });
            this.layout = { scale: 'foo' };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), 'foo');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { foo: 'bar' }), 'foo');
            this.layout = { scale: 17 };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), 17);
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { foo: 'bar' }), 17);
        });
        it('executes a scale function for the data provided', function () {
            this.datalayer = new LocusZoom.DataLayer({ id: 'test' });
            this.layout = {
                scale: {
                    scale_function: 'categorical_bin',
                    field: 'test',
                    parameters: {
                        categories: ['lion', 'tiger', 'bear'],
                        values: ['dorothy', 'toto', 'scarecrow']
                    }
                }
            };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: 'lion' }), 'dorothy');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: 'manatee' }), null);
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), null);
        });
        it('supports operating on an entire data element in the absence of a specified field', function () {
            LocusZoom.ScaleFunctions.add('test_effect_direction', function (parameters, input) {
                if (typeof input == 'undefined') {
                    return null;
                } else if ((input.beta && input.beta > 0) || (input.or && input.or > 0)) {
                    return parameters['+'] || null;
                } else if ((input.beta && input.beta < 0) || (input.or && input.or < 0)) {
                    return parameters['-'] || null;
                }
                return null;
            });
            this.datalayer = new LocusZoom.DataLayer({ id: 'test' });
            this.layout = {
                scale: {
                    scale_function: 'test_effect_direction',
                    parameters: {
                        '+': 'triangle-up',
                        '-': 'triangle-down'
                    }
                }
            };
            var variants = [{ beta: 0.5 }, { beta: -0.06 }, { or: -0.34 }, { or: 1.6 }, { foo: 'bar' }];
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, variants[0]), 'triangle-up');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, variants[1]), 'triangle-down');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, variants[2]), 'triangle-down');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, variants[3]), 'triangle-up');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, variants[4]), null);

            // Clean up/ deregister scale function when done
            LocusZoom.ScaleFunctions.set('test_effect_direction');
        });
        it('iterates over an array of options until exhausted or a non-null value is found', function () {
            this.datalayer = new LocusZoom.DataLayer({ id: 'test' });
            this.layout = {
                scale: [
                    {
                        scale_function: 'if',
                        field: 'test',
                        parameters: {
                            field_value: 'wizard',
                            then: 'oz'
                        }
                    },
                    {
                        scale_function: 'categorical_bin',
                        field: 'test',
                        parameters: {
                            categories: ['lion', 'tiger', 'bear'],
                            values: ['dorothy', 'toto', 'scarecrow']
                        }
                    },
                    'munchkin'
                ]
            };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: 'wizard' }), 'oz');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: 'tiger' }), 'toto');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: 'witch' }), 'munchkin');
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), 'munchkin');
        });
    });

    describe('Extent generation', function () {
        it('has a method to generate an extent function for any axis', function () {
            this.datalayer = new LocusZoom.DataLayer({ id: 'test' });
            this.datalayer.getAxisExtent.should.be.a.Function;
        });
        it('throws an error on invalid axis identifiers', function () {
            var datalayer = new LocusZoom.DataLayer({ id: 'test' });
            assert.throws(function() { datalayer.getAxisExtent(); });
            assert.throws(function() { datalayer.getAxisExtent('foo'); });
            assert.throws(function() { datalayer.getAxisExtent(1); });
            assert.throws(function() { datalayer.getAxisExtent('y1'); });
        });
        it('generates an accurate extent array for arbitrary data sets', function () {
            this.layout = {
                id: 'test',
                x_axis: { field: 'x' }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);

            this.datalayer.data = [];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [], 'No extent is returned if basic criteria cannot be met');

            this.datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [1, 4]);

            this.datalayer.data = [
                { x: 200 }, { x: -73 }, { x: 0 }, { x: 38 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [-73, 200]);

            this.datalayer.data = [
                { x: 6 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [6, 6]);

            this.datalayer.data = [
                { x: 'apple' }, { x: 'pear' }, { x: 'orange' }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [undefined, undefined]);
        });
        it('applies upper and lower buffers to extents as defined in the layout', function () {
            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    lower_buffer: 0.05
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [0.85, 4]);
            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    upper_buffer: 0.2
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 62 }, { x: 7 }, { x: -18 }, { x: 106 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [-18, 130.8]);
            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    lower_buffer: 0.35,
                    upper_buffer: 0.6
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 95 }, { x: 0 }, { x: -4 }, { x: 256 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [-95, 412]);
        });
        it('applies a minimum extent as defined in the layout', function () {
            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 3]
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [0, 4], 'Increase extent exactly to the boundaries when no padding is specified');

            this.datalayer.data = [];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [0, 3], 'If there is no data, use the specified min_extent as given');

            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    upper_buffer: 0.1,
                    lower_buffer: 0.2,
                    min_extent: [0, 10]
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [0, 10], 'Extent is enforced but no padding applied when data is far from boundary');

            this.datalayer.data = [
                { x: 0.6 }, { x: 4 }, { x: 5 }, { x: 9 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [-1.08, 10], 'Extent is is enforced and padding is applied when data is close to the lower boundary');

            this.datalayer.data = [
                { x: 0.4 }, { x: 4 }, { x: 5 }, { x: 9.8 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [-1.48, 10.74], 'Padding is enforced on both sides when data is close to both boundaries');

        });
        it('applies hard floor and ceiling as defined in the layout', function () {
            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [6, 10],
                    lower_buffer: 0.5,
                    floor: 0
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 8 }, { x: 9 }, { x: 8 }, { x: 8.5 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [0, 10]);
            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 10],
                    upper_buffer: 0.8,
                    ceiling: 5
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [0, 5]);
            this.layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 10],
                    lower_buffer: 0.8,
                    upper_buffer: 0.8,
                    floor: 4,
                    ceiling: 6
                }
            };
            this.datalayer = new LocusZoom.DataLayer(this.layout);
            this.datalayer.data = [
                { x: 2 }, { x: 4 }, { x: 5 }, { x: 17 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent('x'), [4, 6]);
        });

    });

    describe('Layout Parameters', function () {
        beforeEach(function () {
            this.plot = null;
            this.layout = {
                panels: [
                    {
                        id: 'p1',
                        data_layers: []
                    }
                ]
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
                { id: 'd2', type: 'line', z_index: 0 }
            ];
            this.plot = LocusZoom.populate('#plot', {}, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ['d2', 'd1']);
            this.plot.panels.p1.data_layers.d1.layout.z_index.should.be.exactly(1);
            this.plot.panels.p1.data_layers.d2.layout.z_index.should.be.exactly(0);
        });
        it('should allow for explicitly setting data layer z_index with a negative value', function () {
            this.layout.panels[0].data_layers = [
                { id: 'd1', type: 'line' },
                { id: 'd2', type: 'line' },
                { id: 'd3', type: 'line' },
                { id: 'd4', type: 'line', z_index: -1 }
            ];
            this.plot = LocusZoom.populate('#plot', {}, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ['d1', 'd2', 'd4', 'd3']);
            this.plot.panels.p1.data_layers.d1.layout.z_index.should.be.exactly(0);
            this.plot.panels.p1.data_layers.d2.layout.z_index.should.be.exactly(1);
            this.plot.panels.p1.data_layers.d3.layout.z_index.should.be.exactly(3);
            this.plot.panels.p1.data_layers.d4.layout.z_index.should.be.exactly(2);
        });
    });

    describe('Layout mutation helpers (public interface)', function () {
        describe('addField', function () {
            beforeEach(function () {
                this.layer = new LocusZoom.DataLayer();
            });
            afterEach(function () {
                this.layer = null;
            });

            it('should require field and namespace to be specified', function () {
                // TODO: Should there be validation to ensure this is a known namespace?
                var self = this;
                assert.throws(function () {
                    self.layer.addField();
                }, /Must specify field name and namespace to use when adding field/);

                assert.throws(function () {
                    self.layer.addField('afield');
                }, /Must specify field name and namespace to use when adding field/);
            });

            it('should check type of the transformations argument', function () {
                var self = this;
                assert.ok(
                    this.layer.addField('aman', 'aplan'),
                    'Transformations are optional'
                );
                assert.ok(
                    this.layer.addField('aman', 'aplan', 'acanal'),
                    'Transformation can be a string'
                );
                assert.ok(
                    this.layer.addField('aman', 'aplan', ['acanal', 'panama']),
                    'Transformation can be an array'
                );
                assert.throws(function () {
                    self.layer.addField('aman', 'aplan', 42);
                }, /Must provide transformations as either a string or array of strings/);
            });
            it('should construct an appropriate field name and add it to the internal fields array', function () {
                var e1 = 'namespace:field';
                assert.equal(
                    this.layer.addField('field', 'namespace'),
                    e1
                );

                var e2 = 'namespace:field|transformation';
                assert.equal(
                    this.layer.addField('field', 'namespace', 'transformation'),
                    e2
                );

                var e3 = 'namespace:field|t1|t2';
                assert.equal(
                    this.layer.addField('field', 'namespace', ['t1', 't2']),
                    e3
                );

                var fields = this.layer.layout.fields;
                assert.ok(fields.indexOf(e1) !== -1);
                assert.ok(fields.indexOf(e2) !== -1);
                assert.ok(fields.indexOf(e3) !== -1);
            });
        });
    });

    describe('Data Access', function () {
        beforeEach(function () {
            this.plot = null;
            this.ds1_src_data = [
                { id: 2, pvalue: 32.7, ref_allele: 'G' },
                { id: 5, pvalue: 0.53, ref_allele: null },
                { id: 21, pvalue: 412.5, ref_allele: NaN }
            ];
            this.ds1_expected_json_data = JSON.stringify([
                {
                    'ds1:id': 2,
                    'ds1:pvalue': 32.7,
                    'ds1:pvalue|logtoscinotation': '2.00 × 10^-33',
                    'ds1:ref_allele': 'G'
                },
                { 'ds1:id': 5, 'ds1:pvalue': 0.53, 'ds1:pvalue|logtoscinotation': '0.2951', 'ds1:ref_allele': null },
                {
                    'ds1:id': 21,
                    'ds1:pvalue': 412.5,
                    'ds1:pvalue|logtoscinotation': '3.16 × 10^-413',
                    'ds1:ref_allele': NaN
                }
            ]);
            this.ds1_expected_csv_data = '"ds1:id","ds1:pvalue","ds1:pvalue|logtoscinotation","ds1:ref_allele"\n'
                + '2,32.7,"2.00 × 10^-33","G"\n'
                + '5,0.53,"0.2951",null\n'
                + '21,412.5,"3.16 × 10^-413",null';
            this.ds2_src_data = [
                { id: 3, bp: 1234, exons: [{ start: 603, strand: '+' }, { start: 4, strand: '+' }] },
                { id: 35, bp: { a: 1, b: 2 }, exons: [{ start: 34, strand: '+', bar: true }] },
                { id: 64, bp: false, exons: [], other: true }
            ];
            this.ds2_expected_json_data = JSON.stringify([
                { 'ds2:id': 3, 'ds2:bp': 1234, 'ds2:exons': [{ start: 603, strand: '+' }, { start: 4, strand: '+' }] },
                { 'ds2:id': 35, 'ds2:bp': { a: 1, b: 2 }, 'ds2:exons': [{ start: 34, strand: '+', bar: true }] },
                { 'ds2:id': 64, 'ds2:bp': false, 'ds2:exons': [], 'ds2:other': true }
            ]);
            this.ds2_expected_csv_data = '"ds2:id","ds2:bp","ds2:exons","ds2:other"\n'
                + '3,1234,"[Array(2)]",null\n'
                + '35,"[Object]","[Array(1)]",null\n'
                + '64,false,"[Array(0)]",true';
            var data_sources = new LocusZoom.DataSources()
                .add('ds1', ['StaticJSON', this.ds1_src_data])
                .add('ds2', ['StaticJSON', this.ds2_src_data]);
            var layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'dl1',
                                fields: ['ds1:id', 'ds1:pvalue', 'ds1:pvalue|logtoscinotation', 'ds1:ref_allele'],
                                id_field: 'ds1:id',
                                type: 'scatter'
                            },
                            {
                                id: 'dl2',
                                fields: ['ds2:id', 'ds2:bp', 'ds2:exons', 'ds2:other'],
                                id_field: 'ds2:id',
                                type: 'scatter'
                            }
                        ]
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', data_sources, layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should create a exportData() function on the data layer prototype', function () {
            assert.equal(true, true);
            should.exist(LocusZoom.DataLayer.prototype.exportData);
            LocusZoom.DataLayer.prototype.exportData.should.be.a.Function;
            should.exist(this.plot.panels.p.data_layers.dl1.exportData);
            this.plot.panels.p.data_layers.dl1.exportData.should.be.a.Function;
            should.exist(this.plot.panels.p.data_layers.dl2.exportData);
            this.plot.panels.p.data_layers.dl2.exportData.should.be.a.Function;
        });
        it.skip("exportData() should export clean JSON of a data layer's underlying data by default", function (done) {
            this.plot.applyState({ start: 0, end: 100 })
                .then(function () {
                    var json0 = this.plot.panels.p.data_layers.dl1.exportData();
                    var json1 = this.plot.panels.p.data_layers.dl1.exportData('json');
                    var json2 = this.plot.panels.p.data_layers.dl2.exportData('json');
                    assert.deepEqual(json0, this.ds1_expected_json_data);
                    assert.deepEqual(json1, this.ds1_expected_json_data);
                    assert.deepEqual(json2, this.ds2_expected_json_data);
                    done();
                }.bind(this)).catch(done);
        });
        it.skip("exportData() should export clean CSV of a data layer's underlying data when CSV is specified as the format", function (done) {
            this.plot.applyState({ start: 0, end: 100 })
                .then(function () {
                    var csv1 = this.plot.panels.p.data_layers.dl1.exportData('csv');
                    var csv2 = this.plot.panels.p.data_layers.dl2.exportData('csv');
                    assert.deepEqual(csv1, this.ds1_expected_csv_data);
                    assert.deepEqual(csv2, this.ds2_expected_csv_data);
                    done();
                }.bind(this)).catch(done);
        });
        it.skip("exportData() should export clean TSV of a data layer's underlying data when TSV is specified as the format", function (done) {
            this.plot.applyState({ start: 0, end: 100 })
                .then(function () {
                    var tsv1 = this.plot.panels.p.data_layers.dl1.exportData('tsv');
                    var tsv2 = this.plot.panels.p.data_layers.dl2.exportData('tsv');
                    assert.deepEqual(tsv1, this.ds1_expected_csv_data.replace(/,/g, '\t'));
                    assert.deepEqual(tsv2, this.ds2_expected_csv_data.replace(/,/g, '\t'));
                    done();
                }.bind(this)).catch(done);
        });
    });

    describe('Highlight functions', function () {
        beforeEach(function () {
            this.plot = null;
            var data_sources = new LocusZoom.DataSources()
                .add('d', ['StaticJSON', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]]);
            var layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                fields: ['d:id'],
                                id_field: 'd:id',
                                type: 'scatter',
                                highlighted: { onmouseover: 'toggle' }
                            }
                        ]
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', data_sources, layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it.skip('should allow for highlighting and unhighlighting a single element', function (done) {
            this.plot.lzd.getData({}, ['d:id'])
                .then(function () {
                    var state_id = this.plot.panels.p.data_layers.d.state_id;
                    var d = this.plot.panels.p.data_layers.d;
                    var a = d.data[0];
                    var a_id = d.getElementId(a);
                    var b = d.data[1];
                    var c = d.data[2];
                    var c_id = d.getElementId(c);
                    this.plot.state[state_id].highlighted.should.be.an.Array;
                    this.plot.state[state_id].highlighted.length.should.be.exactly(0);
                    this.plot.panels.p.data_layers.d.highlightElement(a);
                    this.plot.state[state_id].highlighted.length.should.be.exactly(1);
                    this.plot.state[state_id].highlighted[0].should.be.exactly(a_id);
                    this.plot.panels.p.data_layers.d.unhighlightElement(a);
                    this.plot.state[state_id].highlighted.length.should.be.exactly(0);
                    this.plot.panels.p.data_layers.d.highlightElement(c);
                    this.plot.state[state_id].highlighted.length.should.be.exactly(1);
                    this.plot.state[state_id].highlighted[0].should.be.exactly(c_id);
                    this.plot.panels.p.data_layers.d.unhighlightElement(b);
                    this.plot.state[state_id].highlighted.length.should.be.exactly(1);
                    this.plot.panels.p.data_layers.d.unhighlightElement(c);
                    this.plot.state[state_id].highlighted.length.should.be.exactly(0);
                    done();
                }.bind(this)).catch(done);
        });
        it.skip('should allow for highlighting and unhighlighting all elements', function (done) {
            this.plot.lzd.getData({}, ['d:id'])
                .then(function () {
                    var state_id = this.plot.panels.p.data_layers.d.state_id;
                    var d = this.plot.panels.p.data_layers.d;
                    var a_id = d.getElementId(d.data[0]);
                    var b_id = d.getElementId(d.data[1]);
                    var c_id = d.getElementId(d.data[2]);
                    this.plot.panels.p.data_layers.d.highlightAllElements();
                    this.plot.state[state_id].highlighted.length.should.be.exactly(3);
                    this.plot.state[state_id].highlighted[0].should.be.exactly(a_id);
                    this.plot.state[state_id].highlighted[1].should.be.exactly(b_id);
                    this.plot.state[state_id].highlighted[2].should.be.exactly(c_id);
                    this.plot.panels.p.data_layers.d.unhighlightAllElements();
                    this.plot.state[state_id].highlighted.length.should.be.exactly(0);
                    done();
                }.bind(this)).catch(done);
        });
    });

    describe('Select functions', function () {
        beforeEach(function () {
            this.plot = null;
            var data_sources = new LocusZoom.DataSources()
                .add('d', ['StaticJSON', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]]);
            var layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                fields: ['d:id'],
                                id_field: 'd:id',
                                type: 'scatter',
                                selected: { onclick: 'toggle' }
                            }
                        ]
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', data_sources, layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it.skip('should allow for selecting and unselecting a single element', function (done) {
            // This test is broken; `.catch=done` is a symptom; it references broken/removed methods
            this.plot.lzd.getData({}, ['d:id'])
                .then(function () {
                    var state_id = this.plot.panels.p.data_layers.d.state_id;
                    var d = this.plot.panels.p.data_layers.d;
                    var a = d.data[0];
                    var a_id = d.getElementId(a);
                    var b = d.data[1];
                    var c = d.data[2];
                    var c_id = d.getElementId(c);
                    this.plot.state[state_id].selected.should.be.an.Array;
                    this.plot.state[state_id].selected.length.should.be.exactly(0);
                    this.plot.panels.p.data_layers.d.selectElement(a);
                    this.plot.state[state_id].selected.length.should.be.exactly(1);
                    this.plot.state[state_id].selected[0].should.be.exactly(a_id);
                    this.plot.panels.p.data_layers.d.unselectElement(a);
                    this.plot.state[state_id].selected.length.should.be.exactly(0);
                    this.plot.panels.p.data_layers.d.selectElement(c);
                    this.plot.state[state_id].selected.length.should.be.exactly(1);
                    this.plot.state[state_id].selected[0].should.be.exactly(c_id);
                    this.plot.panels.p.data_layers.d.unselectElement(b);
                    this.plot.state[state_id].selected.length.should.be.exactly(1);
                    this.plot.panels.p.data_layers.d.unselectElement(c);
                    this.plot.state[state_id].selected.length.should.be.exactly(0);
                    done();
                }.bind(this)).catch(done);
        });
        it.skip('should allow for selecting and unselecting all elements', function (done) {
            this.plot.lzd.getData({}, ['d:id'])
                .then(function () {
                    var state_id = this.plot.panels.p.data_layers.d.state_id;
                    var d = this.plot.panels.p.data_layers.d;
                    var a_id = d.getElementId(d.data[0]);
                    var b_id = d.getElementId(d.data[1]);
                    var c_id = d.getElementId(d.data[2]);
                    this.plot.panels.p.data_layers.d.selectAllElements();
                    this.plot.state[state_id].selected.length.should.be.exactly(3);
                    this.plot.state[state_id].selected[0].should.be.exactly(a_id);
                    this.plot.state[state_id].selected[1].should.be.exactly(b_id);
                    this.plot.state[state_id].selected[2].should.be.exactly(c_id);
                    this.plot.panels.p.data_layers.d.unselectAllElements();
                    this.plot.state[state_id].selected.length.should.be.exactly(0);
                    done();
                }.bind(this)).catch(done);
        });
    });

    describe('Tool tip functions', function () {
        beforeEach(function () {
            this.plot = null;
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
                                    html: 'foo'
                                },
                                behaviors: { onclick: [{ action: 'toggle', status: 'selected', exclusive: true }] }
                            }
                        ]
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', {}, this.layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should allow for creating and destroying tool tips', function () {
            this.plot.panels.p.data_layers.d.data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            this.plot.panels.p.data_layers.d.positionTooltip = function () { return 0; };
            var a = this.plot.panels.p.data_layers.d.data[0];
            var a_id = this.plot.panels.p.data_layers.d.getElementId(a);
            var a_id_q = '#' + (a_id + '-tooltip').replace(/(:|\.|\[|\]|,)/g, '\\$1');
            this.plot.panels.p.data_layers.d.tooltips.should.be.an.Object;
            Object.keys(this.plot.panels.p.data_layers.d.tooltips).length.should.be.exactly(0);
            this.plot.panels.p.data_layers.d.createTooltip(a);
            this.plot.panels.p.data_layers.d.tooltips[a_id].should.be.an.Object;
            Object.keys(this.plot.panels.p.data_layers.d.tooltips).length.should.be.exactly(1);
            assert.equal(d3.select(a_id_q).empty(), false);
            this.plot.panels.p.data_layers.d.destroyTooltip(a_id);
            Object.keys(this.plot.panels.p.data_layers.d.tooltips).length.should.be.exactly(0);
            assert.equal(typeof this.plot.panels.p.data_layers.d.tooltips[a_id], 'undefined');
            assert.equal(d3.select(a_id_q).empty(), true);
        });
        it('should allow for showing or hiding a tool tip based on layout directives and element status', function () {
            this.plot.panels.p.data_layers.d.data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            this.plot.panels.p.data_layers.d.positionTooltip = function () { return 0; };
            var d = this.plot.panels.p.data_layers.d;
            var a = d.data[0];
            var a_id = d.getElementId(a);
            var b = d.data[1];
            var b_id = d.getElementId(b);
            // Make sure the tooltips object is there
            d.should.have.property('tooltips').which.is.an.Object;
            // Test highlighted OR selected
            should(d.tooltips[a_id]).be.type('undefined');
            d.highlightElement(a);
            should(d.tooltips[a_id]).be.an.Object;
            d.unhighlightElement(a);
            should(d.tooltips[a_id]).be.type('undefined');
            d.selectElement(a);
            should(d.tooltips[a_id]).be.an.Object;
            d.unselectElement(a);
            should(d.tooltips[a_id]).be.type('undefined');
            // Test highlight AND selected
            should(d.tooltips[b_id]).be.type('undefined');
            d.highlightElement(b);
            d.selectElement(b);
            should(d.tooltips[a_id]).be.an.Object;
            d.unhighlightElement(b);
            d.unselectElement(b);
            should(d.tooltips[b_id]).be.type('undefined');
        });

        it('should allow tooltip open/close state to be tracked separately from element selection', function () {
            // Regression test for zombie tooltips returning after re-render
            var layer = this.plot.panels.p.data_layers.d;

            var item_a = { id: 'a' };
            layer.data = [item_a, { id: 'b' }, { id: 'c' }];
            layer.positionTooltip = function () {
                return 0;
            }; // Override for unit testing

            // Select a point (which will create a tooltip due to element status). Then close tooltip and re-render.
            //  Confirm state is tracked and tooltip does not magically return.
            var self = this;
            return self.plot.applyState().then(function () { // Render initially so that plot is set up right
                var layer_state = layer.state[layer.state_id];
                layer.setElementStatus('selected', item_a, true, true);
                var internal_id = layer.getElementId(item_a);

                assert.ok(layer.tooltips[internal_id], 'Tooltip created on selection');
                assert.ok(layer_state['selected'].includes(internal_id), 'Item was initially selected');

                layer.destroyTooltip(item_a);
                assert.ok(!layer.tooltips[internal_id], 'Tooltip was destroyed by user close event');

                assert.ok(layer_state['selected'].includes(internal_id), 'Point remains selected after closing tooltip');
                assert.ok(!layer_state['has_tooltip'].includes(internal_id), 'Tooltip was destroyed by user close event');

                return self.plot.applyState().then(function () { // Force a re-render to see if zombie items remain
                    var layer_state = layer.state[layer.state_id];
                    assert.ok(layer_state['selected'].includes(internal_id), 'Point remains selected after re-render');
                    assert.ok(!layer_state['has_tooltip'].includes(internal_id), 'Tooltip remains destroyed after re-render');
                });
            });
        });
    });

    describe('Data Layers collection object', function () {
        it('LocusZoom should have a DataLayers collection object', function () {
            LocusZoom.should.have.property('DataLayers').which.is.an.Object;
        });
        it('should have a method to list available data layers', function () {
            LocusZoom.DataLayers.should.have.property('list').which.is.a.Function;
            LocusZoom.DataLayers.list().should.containEql('scatter');
            LocusZoom.DataLayers.list().should.containEql('line');
            LocusZoom.DataLayers.list().should.containEql('orthogonal_line');
            LocusZoom.DataLayers.list().should.containEql('genes');
            LocusZoom.DataLayers.list().should.containEql('intervals');
            LocusZoom.DataLayers.list().should.containEql('genome_legend');
            LocusZoom.DataLayers.list().should.containEql('forest');
        });
        it('should have a general method to get a data layer by name', function () {
            LocusZoom.DataLayers.should.have.property('get').which.is.a.Function;
        });
        it('should have a method to add a data layer', function () {
            LocusZoom.DataLayers.should.have.property('add').which.is.a.Function;
            LocusZoom.DataLayers.list().should.not.containEql('foo');
            var foo = function (layout) {
                LocusZoom.DataLayer.apply(this, arguments);
                this.DefaultLayout = {};
                this.layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);
                this.render = function () {
                    return 'foo';
                };
                return this;
            };
            LocusZoom.DataLayers.add('foo', foo);
            LocusZoom.DataLayers.list().should.containEql('scatter');
            LocusZoom.DataLayers.list().should.containEql('line');
            LocusZoom.DataLayers.list().should.containEql('orthogonal_line');
            LocusZoom.DataLayers.list().should.containEql('genes');
            LocusZoom.DataLayers.list().should.containEql('intervals');
            LocusZoom.DataLayers.list().should.containEql('genome_legend');
            LocusZoom.DataLayers.list().should.containEql('forest');
            LocusZoom.DataLayers.list().should.containEql('foo');
            var returned_value = LocusZoom.DataLayers.get('foo', { id: 'bar' });
            var expected_value = new foo({ id: 'bar' });
            assert.equal(returned_value.id, expected_value.id);
            assert.deepEqual(returned_value.layout, expected_value.layout);
            assert.equal(returned_value.render(), expected_value.render());
        });
        describe('Extension/subclassing mechanism', function () {
            it('exists', function () {
                LocusZoom.DataLayers.should.have.property('extend').which.is.a.Function;
            });
            it('should validate arguments', function () {
                assert.throws(
                    LocusZoom.DataLayers.extend.bind(null, 'nonexistent-parent', 'whatever', {}),
                    /Attempted to subclass an unknown or unregistered datalayer type/
                );
                assert.throws(
                    LocusZoom.DataLayers.extend.bind(null, 'scatter', 'newchild', 'wrongkindofoverride'),
                    /Must specify an object of properties and methods/
                );
            });
            it('should extend a known datalayer with custom behavior', function () {
                LocusZoom.DataLayers.add('testparent', function (layout) {
                    LocusZoom.DataLayer.apply(this, arguments);
                    this.DefaultLayout = {};
                    this.layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);
                    this.render = function () {
                        return 'foo';
                    };
                    this.classname = 'parent';
                });
                var Child = LocusZoom.DataLayers.extend('testparent', 'testchild', {
                    childMethod: function () {
                        return true;
                    },
                    isChild: true,
                    applyCustomDataMethods: function () {
                        return 12;
                    }  // this one overrides parent behavior!
                });
                var instance = new Child({});

                // Child class is added to the registry
                LocusZoom.DataLayers.list().should.containEql('testparent');
                LocusZoom.DataLayers.list().should.containEql('testchild');

                // Sets custom properties and methods correctly
                assert.equal(instance.classname, 'parent');
                assert.ok(instance.childMethod());
                assert.ok(instance.isChild);

                // Inherits and overrides where appropriate
                assert.ok(instance instanceof LocusZoom.DataLayer);
                assert.equal(instance.applyCustomDataMethods(), 12);
                instance.should.have.property('moveUp').which.is.a.Function;

                // Clean up when done.
                LocusZoom.DataLayers.set('testchild');
                LocusZoom.DataLayers.set('testparent');
            });

            it('should be able to create subclasses several levels deep', function () {
                LocusZoom.DataLayers.add('testparent', function (layout) {
                    LocusZoom.DataLayer.apply(this, arguments);
                    this.DefaultLayout = {};
                    this.layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);
                    this.render = function () {
                        return 'foo';
                    };
                    this.classname = 'parent';
                });
                LocusZoom.DataLayers.extend('testparent', 'testchild', {
                    childMethod: function () {
                        return true;
                    },
                    isChild: true,
                    applyCustomDataMethods: function () {
                        return 12;
                    }  // this one overrides parent behavior!
                });
                var GrandChild = LocusZoom.DataLayers.extend('testchild', 'testgrandchild', {
                    applyCustomDataMethods: function () {
                        return 14;
                    }  // this one overrides parent behavior!
                });

                var instance = new GrandChild({});

                // Child class is added to the registry
                LocusZoom.DataLayers.list().should.containEql('testgrandchild');

                assert.ok(instance.isChild);

                // Inherits and overrides where appropriate
                assert.ok(instance instanceof LocusZoom.DataLayer);
                assert.equal(instance.applyCustomDataMethods(), 14);

                // Clean up when done.
                LocusZoom.DataLayers.set('testgrandchild');
                LocusZoom.DataLayers.set('testchild');
                LocusZoom.DataLayers.set('testparent');
            });
        });
        it('should have a method to change or delete existing data layers', function () {
            LocusZoom.DataLayers.should.have.property('set').which.is.a.Function;
            var foo_new = function (layout) {
                LocusZoom.DataLayer.apply(this, arguments);
                this.DefaultLayout = { foo: 'bar' };
                this.layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);
                this.render = function () {
                    return 'bar';
                };
                return this;
            };
            LocusZoom.DataLayers.set('foo', foo_new);
            LocusZoom.DataLayers.list().should.containEql('scatter');
            LocusZoom.DataLayers.list().should.containEql('line');
            LocusZoom.DataLayers.list().should.containEql('orthogonal_line');
            LocusZoom.DataLayers.list().should.containEql('genes');
            LocusZoom.DataLayers.list().should.containEql('intervals');
            LocusZoom.DataLayers.list().should.containEql('genome_legend');
            LocusZoom.DataLayers.list().should.containEql('forest');
            LocusZoom.DataLayers.list().should.containEql('foo');
            var returned_value = LocusZoom.DataLayers.get('foo', { id: 'baz' });
            var expected_value = new foo_new({ id: 'baz' });
            assert.equal(returned_value.id, expected_value.id);
            assert.deepEqual(returned_value.layout, expected_value.layout);
            assert.equal(returned_value.render(), expected_value.render());
            LocusZoom.DataLayers.set('foo');
            LocusZoom.DataLayers.list().should.containEql('scatter');
            LocusZoom.DataLayers.list().should.containEql('line');
            LocusZoom.DataLayers.list().should.containEql('orthogonal_line');
            LocusZoom.DataLayers.list().should.containEql('genes');
            LocusZoom.DataLayers.list().should.containEql('intervals');
            LocusZoom.DataLayers.list().should.containEql('genome_legend');
            LocusZoom.DataLayers.list().should.containEql('forest');
            LocusZoom.DataLayers.list().should.not.containEql('foo');
        });
        it('should throw an exception if asked to get a function that has not been defined', function () {
            assert.throws(function () {
                LocusZoom.DataLayers.get('nonexistent', this.plot.state);
            });
        });
        it('should throw an exception when trying to add a new data layer that is not a function', function () {
            assert.throws(function () {
                LocusZoom.DataLayers.add('nonfunction', 'foo');
            });
        });
        it('should throw an exception when adding a new data layer with an already in use name', function () {
            assert.throws(function () {
                var foo = function (layout) {
                    LocusZoom.DataLayer.apply(this, arguments);
                    this.DefaultLayout = {};
                    this.layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);
                    this.render = function () {
                        return 'foo';
                    };
                    return this;
                };
                LocusZoom.DataLayers.add('scatter', foo);
            });
        });
        it('should throw an exception if asked to get a data layer without passing both an ID and a layout', function () {
            assert.throws(function () {
                LocusZoom.DataLayers.get('scatter');
            });
            assert.throws(function () {
                LocusZoom.DataLayers.get('scatter', 'foo');
            });
        });
        describe('predefined data layers', function () {
            beforeEach(function () {
                this.list = LocusZoom.DataLayers.list();
            });
            it('should each take its ID from the arguments provided', function () {
                this.list.forEach(function (name) {
                    var foo = new LocusZoom.DataLayers.get(name, { id: 'foo' });
                    assert.equal(foo.id, 'foo');
                });
            });
            it('should each take its layout from the arguments provided and merge it with a built-in DefaultLayout', function () {
                this.list.forEach(function (name) {
                    var layout = { id: 'foo', test: 123 };
                    var foo = new LocusZoom.DataLayers.get(name, layout);
                    var expected_layout = LocusZoom.Layouts.merge(layout, foo.DefaultLayout);
                    assert.deepEqual(foo.layout, expected_layout);
                });
            });
            it('should each implement a render function', function () {
                this.list.forEach(function (name) {
                    var foo = new LocusZoom.DataLayers.get(name, { id: 'foo' });
                    foo.should.have.property('render').which.is.a.Function;
                });
            });
        });
    });

});
