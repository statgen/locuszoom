/* global require, describe, d3, LocusZoom, beforeEach, afterEach, it */

"use strict";

/**
  Singletons.js Tests
  Test composition of various LocusZoom singleton objects
*/

var jsdom = require("mocha-jsdom");
var fs = require("fs");
var assert = require("assert");
var files = require("../files.js");

describe("LocusZoom Singletons", function(){

    // Load all javascript files
    var src = [];
    files.test_include.forEach(function(file){ src.push(fs.readFileSync(file)); });
    jsdom({ src: src });

    // Reset DOM after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    describe("Label Functions", function() {
        beforeEach(function(){
            d3.select("body").append("div").attr("id", "plot_id");
            this.plot = LocusZoom.populate("#plot_id");
        });
        it("LocusZoom should have a LabelFunctions singleton", function(){
            LocusZoom.should.have.property("LabelFunctions").which.is.an.Object;
        });
        it("should have a method to list available label functions", function(){
            LocusZoom.LabelFunctions.should.have.property("list").which.is.a.Function;
            var returned_list = LocusZoom.LabelFunctions.list();
            var expected_list = ["chromosome"];
            assert.deepEqual(returned_list, expected_list);
        });
        it("should have a general method to get a function or execute it for a result", function(){
            LocusZoom.LabelFunctions.should.have.property("get").which.is.a.Function;
            LocusZoom.LabelFunctions.get("chromosome").should.be.a.Function;
            var returned_label = LocusZoom.LabelFunctions.get("chromosome", { chr: 17, start: 40 });
            var expected_label = "Chromosome 17 (Mb)";
            assert.equal(returned_label, expected_label);
        });
        it("should have a method to add a label function", function(){
            LocusZoom.LabelFunctions.should.have.property("add").which.is.a.Function;
            var foo = function(state){ return "start: " + state.start; };
            LocusZoom.LabelFunctions.add("foo", foo);
            var returned_list = LocusZoom.LabelFunctions.list();
            var expected_list = ["chromosome", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_label = LocusZoom.LabelFunctions.get("foo", { start: 20 });
            var expected_label = "start: 20";
            assert.equal(returned_label, expected_label);
        });
        it("should have a method to change or delete existing label functions", function(){
            LocusZoom.LabelFunctions.should.have.property("set").which.is.a.Function;
            var foo_new = function(state){ return "end: " + state.end; };
            LocusZoom.LabelFunctions.set("foo", foo_new);
            var returned_list = LocusZoom.LabelFunctions.list();
            var expected_list = ["chromosome", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_label = LocusZoom.LabelFunctions.get("foo", { start: 20, end: 50 });
            var expected_label = "end: 50";
            assert.equal(returned_label, expected_label);
            LocusZoom.LabelFunctions.set("foo");
            returned_list = LocusZoom.LabelFunctions.list();
            expected_list = ["chromosome"];
            assert.deepEqual(returned_list, expected_list);
        });
        it("should throw an exception if asked to get a function that has not been defined", function(){
            assert.throws(function(){
                LocusZoom.LabelFunctions.get("nonexistent", {});
            });
        });
        it("should throw an exception when adding a new label function with an already in use name", function(){
            assert.throws(function(){
                var foo = function(state){ return "end: " + state.end; };
                LocusZoom.LabelFunctions.add("chromosome", foo);
            });
        });
        describe("choromosome", function() {
            it("should return a chromosome label for any state", function(){
                assert.equal(LocusZoom.LabelFunctions.get("chromosome", { chr: 10, start: 1, end: 2}), "Chromosome 10 (Mb)");
                assert.equal(LocusZoom.LabelFunctions.get("chromosome", { chr: "foo", start: 1, end: 2}), "Chromosome (Mb)");
                assert.equal(LocusZoom.LabelFunctions.get("chromosome", {}), "Chromosome (Mb)");
            });
        });
    });

    describe("Transformation Functions", function() {
        it("LocusZoom should have a TransformationFunctions singleton", function(){
            LocusZoom.should.have.property("TransformationFunctions").which.is.an.Object;
        });
        it("should have a method to list available label functions", function(){
            LocusZoom.TransformationFunctions.should.have.property("list").which.is.a.Function;
            LocusZoom.TransformationFunctions.list().should.be.an.Array;
            LocusZoom.TransformationFunctions.list().should.containEql("scinotation");
            LocusZoom.TransformationFunctions.list().should.containEql("neglog10");
        });
        it("should have a general method to get a function or execute it for a result", function(){
            LocusZoom.TransformationFunctions.should.have.property("get").which.is.a.Function;
            LocusZoom.TransformationFunctions.get("neglog10").should.be.a.Function;
        });
        it("should have a method to add a transformation function", function(){
            LocusZoom.TransformationFunctions.should.have.property("add").which.is.a.Function;
            var foo = function(x){ return x + 1; };
            LocusZoom.TransformationFunctions.add("foo", foo);
            LocusZoom.TransformationFunctions.list().should.containEql("foo");
            var returned_value = LocusZoom.TransformationFunctions.get("foo")(2);
            var expected_value = 3;
            assert.equal(returned_value, expected_value);
        });
        it("should have a method to change or delete existing transformation functions", function(){
            LocusZoom.TransformationFunctions.should.have.property("set").which.is.a.Function;
            var foo_new = function(x){ return x * 2; };
            LocusZoom.TransformationFunctions.set("foo", foo_new);
            LocusZoom.TransformationFunctions.list().should.containEql("foo");
            var returned_value = LocusZoom.TransformationFunctions.get("foo")(4);
            var expected_value = 8;
            assert.equal(returned_value, expected_value);
            LocusZoom.TransformationFunctions.set("foo");
            LocusZoom.TransformationFunctions.list().should.not.containEql("foo");
        });
        it("should throw an exception if asked to get a function that has not been defined", function(){
            assert.throws(function(){
                LocusZoom.TransformationFunctions.get("nonexistent");
            });
        });
        it("should throw an exception when adding a new transformation function with an already in use name", function(){
            assert.throws(function(){
                var foo = function(x){ return x / 4; };
                LocusZoom.TransformationFunctions.add("neglog10", foo);
            });
        });
        describe("neglog10", function() {
            var tests = [
                { arg: 1,         expected: 0 },
                { arg: 10,        expected: -1 },
                { arg: 0.001,     expected: 2.9999999999999996 },
                { arg: 0.0000324, expected: 4.489454989793387 }
            ];
            tests.forEach(function(test) {
                it("should return correct negative log 10 for " + test.arg, function() {
                    assert.equal(LocusZoom.TransformationFunctions.get("neglog10")(test.arg), test.expected);
                });
            });
        });
        describe("scinotation", function() {
            var tests = [
                { arg: 1,               expected: "1.000" },
                { arg: 0.0562435,       expected: "0.056" },
                { arg: 14000,           expected: "1.40 × 10^4" },
                { arg: 0.0000002436246, expected: "2.44 × 10^-7" }
            ];
            tests.forEach(function(test) {
                it("should return correct scientific notation for " + test.arg, function() {
                    assert.equal(LocusZoom.TransformationFunctions.get("scinotation")(test.arg), test.expected);
                });
            });
        });
    });

    describe("Scale Functions", function() {
        it("LocusZoom should have a ScaleFunctions singleton", function(){
            LocusZoom.should.have.property("ScaleFunctions").which.is.an.Object;
        });
        it("should have a method to list available scale functions", function(){
            LocusZoom.ScaleFunctions.should.have.property("list").which.is.a.Function;
            var returned_list = LocusZoom.ScaleFunctions.list();
            var expected_list = ["if", "numerical_bin", "categorical_bin"];
            assert.deepEqual(returned_list, expected_list);
        });
        it("should have a general method to get a scale by function name", function(){
            LocusZoom.ScaleFunctions.should.have.property("get").which.is.a.Function;
        });
        it("should have a method to add a scale function", function(){
            LocusZoom.ScaleFunctions.should.have.property("add").which.is.a.Function;
            var foo = function(){ return "#000000"; };
            LocusZoom.ScaleFunctions.add("foo", foo);
            var returned_list = LocusZoom.ScaleFunctions.list();
            var expected_list = ["if", "numerical_bin", "categorical_bin", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_value = LocusZoom.ScaleFunctions.get("foo", {}, 0);
            var expected_value = "#000000";
            assert.equal(returned_value, expected_value);
        });
        it("should have a method to change or delete existing scale functions", function(){
            LocusZoom.ScaleFunctions.should.have.property("set").which.is.a.Function;
            var foo_new = function(){ return "#FFFFFF"; };
            LocusZoom.ScaleFunctions.set("foo", foo_new);
            var returned_list = LocusZoom.ScaleFunctions.list();
            var expected_list = ["if", "numerical_bin", "categorical_bin", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_value = LocusZoom.ScaleFunctions.get("foo", {}, 0);
            var expected_value = "#FFFFFF";
            assert.equal(returned_value, expected_value);
            LocusZoom.ScaleFunctions.set("foo");
            returned_list = LocusZoom.ScaleFunctions.list();
            expected_list = ["if", "numerical_bin", "categorical_bin"];
            assert.deepEqual(returned_list, expected_list);
        });
        it("should throw an exception if asked to get a function that has not been defined", function(){
            assert.throws(function(){
                LocusZoom.ScaleFunctions.get("nonexistent", this.plot.state);
            });
        });
        it("should throw an exception when adding a new scale function with an already in use name", function(){
            assert.throws(function(){
                var foo = function(){ return "#FFFFFF"; };
                LocusZoom.ScaleFunctions.add("categorical_bin", foo);
            });
        });
        describe("if", function() {
            it("should match against an arbitrary value, return null if not matched", function(){
                var parameters = {
                    field_value: 6,
                    then: true
                };
                assert.equal(LocusZoom.ScaleFunctions.get("if", parameters, 0), null);
                assert.equal(LocusZoom.ScaleFunctions.get("if", parameters, "foo"), null);
                assert.equal(LocusZoom.ScaleFunctions.get("if", parameters, 6), true);
            });
            it("should optionally allow for defining an else", function(){
                var parameters = {
                    field_value: "kiwi",
                    then: "pineapple",
                    else: "watermelon"
                };
                assert.equal(LocusZoom.ScaleFunctions.get("if", parameters, 0), "watermelon");
                assert.equal(LocusZoom.ScaleFunctions.get("if", parameters, "foo"), "watermelon");
                assert.equal(LocusZoom.ScaleFunctions.get("if", parameters, "kiwi"), "pineapple");
            });
        });
        describe("numerical_bin", function() {
            it("should work with arbitrarily many breaks/values", function(){
                var parameters = {
                    breaks: [-167, -46, 15, 23, 76.8, 952],
                    values: ["value-167", "value-46", "value15", "value23", "value76.8", "value952"]
                };
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, -50000), "value-167");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, 0), "value-46");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, 76.799999999), "value23");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, 481329), "value952");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, "foo"), null);
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters), null);
            });
            it("should work with arbitrarily many breaks/values and an optional null_value parameter", function(){
                var parameters = {
                    breaks: [0, 0.2, 0.4, 0.6, 0.8],
                    values: ["value0", "value0.2", "value0.4", "value0.6", "value0.8"],
                    null_value: "null_value"
                };
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, 0), "value0");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, -12), "value0");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, 0.35), "value0.2");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, 0.79999999), "value0.6");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, 3246), "value0.8");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters, "foo"), "null_value");
                assert.equal(LocusZoom.ScaleFunctions.get("numerical_bin", parameters), "null_value");
            });
        });
        describe("categorical_bin", function() {
            it("should work with arbitrarily many categories/values", function(){
                var parameters = {
                    categories: ["oxygen", "fluorine", "tungsten"],
                    values: ["value-oxygen", "value-fluorine", "value-tungsten"]
                };
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, "fluorine"), "value-fluorine");
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, "tungsten"), "value-tungsten");
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, 135), null);
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, ["tungsten"]), null);
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters), null);
            });
            it("should work with arbitrarily many categories/values and an optional null_value parameter", function(){
                var parameters = {
                    categories: ["dog", "cat", "hippo", "marmoset"],
                    values: ["value-dog", "value-cat", "value-hippo", "value-marmoset"],
                    null_value: "null_value"
                };
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, "dog"), "value-dog");
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, "hippo"), "value-hippo");
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, "CAT"), "null_value");
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters, 53), "null_value");
                assert.equal(LocusZoom.ScaleFunctions.get("categorical_bin", parameters), "null_value");
            });
        });
    });

    describe("Data Layers", function() {
        it("LocusZoom should have a DataLayers singleton", function(){
            LocusZoom.should.have.property("DataLayers").which.is.an.Object;
        });
        it("should have a method to list available data layers", function(){
            LocusZoom.DataLayers.should.have.property("list").which.is.a.Function;
            var returned_list = LocusZoom.DataLayers.list();
            var expected_list = ["scatter", "line", "genes"];
            assert.deepEqual(returned_list, expected_list);
        });
        it("should have a general method to get a data layer by name", function(){
            LocusZoom.DataLayers.should.have.property("get").which.is.a.Function;
        });
        it("should have a method to add a data layer", function(){
            LocusZoom.DataLayers.should.have.property("add").which.is.a.Function;
            var foo = function(layout){
                LocusZoom.DataLayer.apply(this, arguments);
                this.DefaultLayout = {};
                this.layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);
                this.render = function(){ return "foo"; };
                return this;
            };
            LocusZoom.DataLayers.add("foo", foo);
            var returned_list = LocusZoom.DataLayers.list();
            var expected_list = ["scatter", "line", "genes", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_value = LocusZoom.DataLayers.get("foo", { id: "bar" });
            var expected_value = new foo({ id: "bar" });
            assert.equal(returned_value.id, expected_value.id);
            assert.deepEqual(returned_value.layout, expected_value.layout);
            assert.equal(returned_value.render(), expected_value.render());
        });
        it("should have a method to change or delete existing data layers", function(){
            LocusZoom.DataLayers.should.have.property("set").which.is.a.Function;
            var foo_new = function(layout){
                LocusZoom.DataLayer.apply(this, arguments);
                this.DefaultLayout = { foo: "bar" };
                this.layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);
                this.render = function(){ return "bar"; };
                return this;
            };
            LocusZoom.DataLayers.set("foo", foo_new);
            var returned_list = LocusZoom.DataLayers.list();
            var expected_list = ["scatter", "line", "genes", "foo"];
            assert.deepEqual(returned_list, expected_list);
            var returned_value = LocusZoom.DataLayers.get("foo", { id: "baz" });
            var expected_value = new foo_new({ id: "baz" });
            assert.equal(returned_value.id, expected_value.id);
            assert.deepEqual(returned_value.layout, expected_value.layout);
            assert.equal(returned_value.render(), expected_value.render());
            LocusZoom.DataLayers.set("foo");
            returned_list = LocusZoom.DataLayers.list();
            expected_list = ["scatter", "line", "genes"];
            assert.deepEqual(returned_list, expected_list);
        });
        it("should throw an exception if asked to get a function that has not been defined", function(){
            assert.throws(function(){
                LocusZoom.DataLayers.get("nonexistent", this.plot.state);
            });
        });
        it("should throw an exception when trying to add a new data layer that is not a function", function(){
            assert.throws(function(){
                LocusZoom.DataLayers.add("nonfunction", "foo");
            });
        });
        it("should throw an exception when adding a new data layer with an already in use name", function(){
            assert.throws(function(){
                var foo = function(layout){
                    LocusZoom.DataLayer.apply(this, arguments);
                    this.DefaultLayout = {};
                    this.layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);
                    this.render = function(){ return "foo"; };
                    return this;
                };
                LocusZoom.DataLayers.add("scatter", foo);
            });
        });
        it("should throw an exception if asked to get a data layer without passing both an ID and a layout", function(){
            assert.throws(function(){
                LocusZoom.DataLayers.get("scatter");
            });
            assert.throws(function(){
                LocusZoom.DataLayers.get("scatter", "foo");
            });
        });
        describe("predefined data layers", function() {
            beforeEach(function(){
                this.list = LocusZoom.DataLayers.list();
            });
            it("should each take its ID from the arguments provided", function(){
                this.list.forEach(function(name){
                    var foo = new LocusZoom.DataLayers.get(name, { id: "foo" });
                    assert.equal(foo.id, "foo");
                });
            });
            it("should each take its layout from the arguments provided and mergit with a built-in DefaultLayout", function(){
                this.list.forEach(function(name){
                    var layout = { id: "foo", test: 123 };
                    var foo = new LocusZoom.DataLayers.get(name, layout);
                    var expected_layout = LocusZoom.mergeLayouts(layout, foo.DefaultLayout);
                    assert.deepEqual(foo.layout, expected_layout);
                });
            });
            it("should each implement a render function", function(){
                this.list.forEach(function(name){
                    var foo = new LocusZoom.DataLayers.get(name, { id: "foo" });
                    foo.should.have.property("render").which.is.a.Function;
                });
            });
        });
    });

});
