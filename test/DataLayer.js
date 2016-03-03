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
               fs.readFileSync('./assets/js/app/DataLayer.js')
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
    });

    describe("Color Functions", function() {
        it('LocusZoom.DataLayer should have a ColorFunctions singleton', function(){
            LocusZoom.DataLayer.should.have.property('ColorFunctions').which.is.an.Object;
        });
        it('should have a method to list available color functions', function(){
            LocusZoom.DataLayer.ColorFunctions.should.have.property('list').which.is.a.Function;
            var returned_list = LocusZoom.DataLayer.ColorFunctions.list();
            var expected_list = ["numeric_cut", "categorical_cut"];
            assert.deepEqual(returned_list, expected_list);
        });
        it('should have a general method to get a color by function name', function(){
            LocusZoom.DataLayer.ColorFunctions.should.have.property('get').which.is.a.Function;
        });
        it('should have a method to add a color function', function(){
            LocusZoom.DataLayer.ColorFunctions.should.have.property('add').which.is.a.Function;
            var foo = function(parameters, value){ return "#000000"; };
            LocusZoom.DataLayer.ColorFunctions.add("foo", foo);
            var returned_list = LocusZoom.DataLayer.ColorFunctions.list();
            var expected_list = ["numeric_cut", "categorical_cut", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_color = LocusZoom.DataLayer.ColorFunctions.get("foo", {}, 0);
            var expected_color = "#000000";
            assert.equal(returned_color, expected_color);
        });
        it('should have a method to change or delete existing color functions', function(){
            LocusZoom.DataLayer.ColorFunctions.should.have.property('set').which.is.a.Function;
            var foo_new = function(parameters, value){ return "#FFFFFF"; };
            LocusZoom.DataLayer.ColorFunctions.set("foo", foo_new);
            var returned_list = LocusZoom.DataLayer.ColorFunctions.list();
            var expected_list = ["numeric_cut", "categorical_cut", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_color = LocusZoom.DataLayer.ColorFunctions.get("foo", {}, 0);
            var expected_color = "#FFFFFF";
            assert.equal(returned_color, expected_color);
            LocusZoom.DataLayer.ColorFunctions.set("foo");
            var returned_list = LocusZoom.DataLayer.ColorFunctions.list();
            var expected_list = ["numeric_cut", "categorical_cut"];
            assert.deepEqual(returned_list, expected_list);
        });
        it('should throw an exception if passed a function name that has not been defined', function(){
            try {
                LocusZoom.DataLayer.ColorFunctions.get("nonexistent", this.instance.state);
            } catch (error){
                assert.ok(error);
            }
        });
        describe("numeric_cut", function() {
            it('should work with arbitrarily many breaks/colors', function(){
                var parameters = {
                    breaks: [0, 0.2, 0.4, 0.6, 0.8],
                    colors: ["color0", "color0.2", "color0.4", "color0.6", "color0.8"],
                    null_color: "null_color"
                };
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, 0), "color0");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, -12), "color0");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, 0.35), "color0.2");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, 0.79999999), "color0.6");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, 3246), "color0.8");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, "foo"), "null_color");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters), "null_color");
                var parameters = {
                    breaks: [-167, -46, 15, 23, 76.8, 952],
                    colors: ["color-167", "color-46", "color15", "color23", "color76.8", "color952"]
                };
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, -50000), "color-167");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, 0), "color-46");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, 76.799999999), "color23");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, 481329), "color952");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters, "foo"), "color-167");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("numeric_cut", parameters), "color-167");
            });
        });
        describe("categorical_cut", function() {
            it('should work with arbitrarily many categories/colors', function(){
                var parameters = {
                    categories: ["dog", "cat", "hippo", "marmoset"],
                    colors: ["color-dog", "color-cat", "color-hippo", "color-marmoset"],
                    null_color: "null_color"
                };
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters, "dog"), "color-dog");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters, "hippo"), "color-hippo");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters, "CAT"), "null_color");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters, 53), "null_color");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters), "null_color");
                var parameters = {
                    categories: ["oxygen", "fluorine", "tungsten"],
                    colors: ["color-oxygen", "color-fluorine", "color-tungsten"]
                };
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters, "fluorine"), "color-fluorine");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters, 135), "color-oxygen");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters, ["tungten"]), "color-oxygen");
                assert.equal(LocusZoom.DataLayer.ColorFunctions.get("categorical_cut", parameters), "color-oxygen");
            });
        });
    });

});
