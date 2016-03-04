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

    describe("Scale Functions", function() {
        it('LocusZoom.DataLayer should have a ScaleFunctions singleton', function(){
            LocusZoom.DataLayer.should.have.property('ScaleFunctions').which.is.an.Object;
        });
        it('should have a method to list available scale functions', function(){
            LocusZoom.DataLayer.ScaleFunctions.should.have.property('list').which.is.a.Function;
            var returned_list = LocusZoom.DataLayer.ScaleFunctions.list();
            var expected_list = ["numerical_cut", "categorical_cut"];
            assert.deepEqual(returned_list, expected_list);
        });
        it('should have a general method to get a scale by function name', function(){
            LocusZoom.DataLayer.ScaleFunctions.should.have.property('get').which.is.a.Function;
        });
        it('should have a method to add a scale function', function(){
            LocusZoom.DataLayer.ScaleFunctions.should.have.property('add').which.is.a.Function;
            var foo = function(parameters, value){ return "#000000"; };
            LocusZoom.DataLayer.ScaleFunctions.add("foo", foo);
            var returned_list = LocusZoom.DataLayer.ScaleFunctions.list();
            var expected_list = ["numerical_cut", "categorical_cut", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_value = LocusZoom.DataLayer.ScaleFunctions.get("foo", {}, 0);
            var expected_value = "#000000";
            assert.equal(returned_value, expected_value);
        });
        it('should have a method to change or delete existing scale functions', function(){
            LocusZoom.DataLayer.ScaleFunctions.should.have.property('set').which.is.a.Function;
            var foo_new = function(parameters, value){ return "#FFFFFF"; };
            LocusZoom.DataLayer.ScaleFunctions.set("foo", foo_new);
            var returned_list = LocusZoom.DataLayer.ScaleFunctions.list();
            var expected_list = ["numerical_cut", "categorical_cut", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_value = LocusZoom.DataLayer.ScaleFunctions.get("foo", {}, 0);
            var expected_value = "#FFFFFF";
            assert.equal(returned_value, expected_value);
            LocusZoom.DataLayer.ScaleFunctions.set("foo");
            var returned_list = LocusZoom.DataLayer.ScaleFunctions.list();
            var expected_list = ["numerical_cut", "categorical_cut"];
            assert.deepEqual(returned_list, expected_list);
        });
        it('should throw an exception if passed a function name that has not been defined', function(){
            try {
                LocusZoom.DataLayer.ScaleFunctions.get("nonexistent", this.instance.state);
            } catch (error){
                assert.ok(error);
            }
        });
        describe("numerical_cut", function() {
            it('should work with arbitrarily many breaks/values', function(){
                var parameters = {
                    breaks: [0, 0.2, 0.4, 0.6, 0.8],
                    values: ["value0", "value0.2", "value0.4", "value0.6", "value0.8"],
                    null_value: "null_value"
                };
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, 0), "value0");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, -12), "value0");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, 0.35), "value0.2");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, 0.79999999), "value0.6");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, 3246), "value0.8");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, "foo"), "null_value");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters), "null_value");
                var parameters = {
                    breaks: [-167, -46, 15, 23, 76.8, 952],
                    values: ["value-167", "value-46", "value15", "value23", "value76.8", "value952"]
                };
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, -50000), "value-167");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, 0), "value-46");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, 76.799999999), "value23");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, 481329), "value952");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters, "foo"), "value-167");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("numerical_cut", parameters), "value-167");
            });
        });
        describe("categorical_cut", function() {
            it('should work with arbitrarily many categories/values', function(){
                var parameters = {
                    categories: ["dog", "cat", "hippo", "marmoset"],
                    values: ["value-dog", "value-cat", "value-hippo", "value-marmoset"],
                    null_value: "null_value"
                };
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters, "dog"), "value-dog");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters, "hippo"), "value-hippo");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters, "CAT"), "null_value");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters, 53), "null_value");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters), "null_value");
                var parameters = {
                    categories: ["oxygen", "fluorine", "tungsten"],
                    values: ["value-oxygen", "value-fluorine", "value-tungsten"]
                };
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters, "fluorine"), "value-fluorine");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters, 135), "value-oxygen");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters, ["tungsten"]), "value-oxygen");
                assert.equal(LocusZoom.DataLayer.ScaleFunctions.get("categorical_cut", parameters), "value-oxygen");
            });
        });
    });

});
