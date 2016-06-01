"use strict";

/**
  Instance.js Tests
  Test composition of the LocusZoom.Panel object and its base classes
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom.DataLayer', function(){

    // Load all javascript files
    jsdom({
        src: [ fs.readFileSync('./assets/js/vendor/should.min.js'),
               fs.readFileSync('./assets/js/vendor/d3.min.js'),
               fs.readFileSync('./assets/js/vendor/q.min.js'),
               fs.readFileSync('./assets/js/app/LocusZoom.js'),
               fs.readFileSync('./assets/js/app/Data.js'),
               fs.readFileSync('./assets/js/app/Instance.js'),
               fs.readFileSync('./assets/js/app/Panel.js'),
               fs.readFileSync('./assets/js/app/DataLayer.js'),
               fs.readFileSync('./assets/js/app/Singletons.js')
             ]
    });

    // Reset DOM after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    it("creates an object for its name space", function() {
        should.exist(LocusZoom.DataLayer);
    });

    it("defines its layout defaults", function() {
        LocusZoom.DataLayer.should.have.property('DefaultLayout').which.is.an.Object;
    });

    describe("Constructor", function() {
        beforeEach(function() {
            this.datalayer = new LocusZoom.DataLayer();
        });
        it("returns an object", function() {
            this.datalayer.should.be.an.Object;
        });
        it('should have an id', function(){
            this.datalayer.should.have.property('id');
        });
        it('should have an array for caching data', function(){
            this.datalayer.should.have.property('data').which.is.an.Array;
        });
        it('should have an svg object', function(){
            this.datalayer.should.have.property('svg').which.is.an.Object;
        });
        it('should have a layout object', function(){
            this.datalayer.should.have.property('layout').which.is.an.Object;
        });
        it('should have a state object', function(){
            this.datalayer.should.have.property('state').which.is.an.Object;
        });
        it('should have a tooltips object', function(){
            this.datalayer.should.have.property('tooltips').which.is.an.Object;
        });
    });

    describe("Scalable parameter resolution", function() {
        it("has a method to resolve scalable parameters into discrete values", function() {
            this.datalayer = new LocusZoom.DataLayer("test", {});
            this.datalayer.resolveScalableParameter.should.be.a.Function;
        });
        it("passes numbers and strings directly through regardless of data", function() {
            this.datalayer = new LocusZoom.DataLayer("test", {});
            this.layout = { scale: "foo" };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), "foo");
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { foo: "bar" }), "foo");
            this.layout = { scale: 17 };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), 17);
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { foo: "bar" }), 17);
        });
        it("executes a scale function for the data provided", function() {
            this.datalayer = new LocusZoom.DataLayer("test", {});
            this.layout = {
                scale: {
                    scale_function: "categorical_bin",
                    field: "test",
                    parameters: {
                        categories: ["lion", "tiger", "bear"],
                        values: ["dorothy", "toto", "scarecrow"],
                    }
                }
            };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: "lion" }), "dorothy");
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: "manatee" }), null);
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), null);
        });
        it("iterates over an array of options until exhausted or a non-null value is found", function() {
            this.datalayer = new LocusZoom.DataLayer("test", {});
            this.layout = {
                scale: [
                    {
                        scale_function: "if",
                        field: "test",
                        parameters: {
                            field_value: "wizard",
                            then: "oz"
                        }
                    },
                    {
                        scale_function: "categorical_bin",
                        field: "test",
                        parameters: {
                            categories: ["lion", "tiger", "bear"],
                            values: ["dorothy", "toto", "scarecrow"],
                        }
                    },
                    "munchkin"
                ]
            };
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: "wizard" }), "oz");
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: "tiger" }), "toto");
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, { test: "witch" }), "munchkin");
            assert.equal(this.datalayer.resolveScalableParameter(this.layout.scale, {}), "munchkin");
        });
    });

    describe("Extent generation", function() {
        it("has a method to generate an extent function for any axis", function() {
            this.datalayer = new LocusZoom.DataLayer("test", {});
            this.datalayer.getAxisExtent.should.be.a.Function;
        });
        it("throws an error on invalid axis identifiers", function() {
            var data_layer = new LocusZoom.DataLayer();
            assert.throws(function(){ datalayer.getAxisExtent(); });
            assert.throws(function(){ datalayer.getAxisExtent("foo"); });
            assert.throws(function(){ datalayer.getAxisExtent(1); });
            assert.throws(function(){ datalayer.getAxisExtent("y1"); });
        });
        it("generates an accurate extent array for arbitrary data sets", function() {
            this.layout = {
                x_axis: { field: "x" }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [1, 4]);
            this.datalayer.data = [
                { x: 200 }, { x: -73 }, { x: 0 }, { x: 38 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [-73, 200]);
            this.datalayer.data = [
                { x: 6 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [6, 6]);
            this.datalayer.data = [
                { x: "apple" }, { x: "pear" }, { x: "orange" }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [undefined, undefined]);
        });
        it("applies upper and lower buffers to extents as defined in the layout", function() {
            this.layout = {
                x_axis: {
                    field: "x",
                    lower_buffer: 0.05
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [0.85, 4]);
            this.layout = {
                x_axis: {
                    field: "x",
                    upper_buffer: 0.2
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 62 }, { x: 7 }, { x: -18 }, { x: 106 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [-18, 130.8]);
            this.layout = {
                x_axis: {
                    field: "x",
                    lower_buffer: 0.35,
                    upper_buffer: 0.6
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 95 }, { x: 0 }, { x: -4 }, { x: 256 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [-95, 412]);
        });
        it("applies a minimum extent as defined in the layout", function() {
            this.layout = {
                x_axis: {
                    field: "x",
                    min_extent: [ 0, 3 ]
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [0, 4]);
            this.layout = {
                x_axis: {
                    field: "x",
                    upper_buffer: 0.1,
                    lower_buffer: 0.2,
                    min_extent: [ 0, 10 ]
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [0, 10]);
            this.datalayer.data = [
                { x: 0.6 }, { x: 4 }, { x: 5 }, { x: 9 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [-1.08, 10]);
            this.datalayer.data = [
                { x: 0.4 }, { x: 4 }, { x: 5 }, { x: 9.8 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [-1.48, 10.74]);
        });
        it("applies hard floor and ceiling as defined in the layout", function() {
            this.layout = {
                x_axis: {
                    field: "x",
                    min_extent: [6, 10],
                    lower_buffer: 0.5,
                    floor: 0
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 8 }, { x: 9 }, { x: 8 }, { x: 8.5 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [0, 10]);
            this.layout = {
                x_axis: {
                    field: "x",
                    min_extent: [0, 10],
                    upper_buffer: 0.8,
                    ceiling: 5
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [0, 5]);
            this.layout = {
                x_axis: {
                    field: "x",
                    min_extent: [0, 10],
                    lower_buffer: 0.8,
                    upper_buffer: 0.8,
                    floor: 4,
                    ceiling: 6
                }
            }
            this.datalayer = new LocusZoom.DataLayer("test", this.layout);
            this.datalayer.data = [
                { x: 2 }, { x: 4 }, { x: 5 }, { x: 17 }
            ];
            assert.deepEqual(this.datalayer.getAxisExtent("x"), [4, 6]);
        });

    });

    describe("Layout Paramters", function() {
        beforeEach(function(){
            this.plot = null;
            this.layout = {
                panels: {
                    p1: {
                        data_layers: {}
                    }
                },
                controls: false
            };
            d3.select("body").append("div").attr("id", "plot");
        });
        afterEach(function(){
            d3.select("#plot").remove();
            delete this.plot;
        });
        it('should allow for explicitly setting data layer z_index', function(){
            this.layout.panels.p1.data_layers = {
                d1: { type: "line", z_index: 1 },
                d2: { type: "line", z_index: 0 }
            };
            this.plot = LocusZoom.populate("#plot", {}, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ["d2", "d1"]);
            this.plot.panels.p1.data_layers.d1.layout.z_index.should.be.exactly(1);
            this.plot.panels.p1.data_layers.d2.layout.z_index.should.be.exactly(0);
        });
        it('should allow for explicitly setting data layer z_index with a negative value', function(){
            this.layout.panels.p1.data_layers = {
                d1: { type: "line" },
                d2: { type: "line" },
                d3: { type: "line" },
                d4: { type: "line", z_index: -1 }
            };
            this.plot = LocusZoom.populate("#plot", {}, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ["d1", "d2", "d4", "d3"]);
            this.plot.panels.p1.data_layers.d1.layout.z_index.should.be.exactly(0);
            this.plot.panels.p1.data_layers.d2.layout.z_index.should.be.exactly(1);
            this.plot.panels.p1.data_layers.d3.layout.z_index.should.be.exactly(3);
            this.plot.panels.p1.data_layers.d4.layout.z_index.should.be.exactly(2);
        });
    });

});
