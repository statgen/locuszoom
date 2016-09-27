"use strict";

/**
  Dashboard.js Tests
  Test composition and function of dashboard framework and compontents
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var assert = require('assert');
var should = require("should");
var _files = require('./_files.js');

describe('LocusZoom.Dashboard', function(){

    // Load all javascript files
    var src = [];
    _files.forEach(function(_file){ src.push(fs.readFileSync(_file)); });
    jsdom({ src: src });

    // Reset DOM after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    it("defines an abstract dashboard class", function() {
        should.exist(LocusZoom.Dashboard);
        LocusZoom.Dashboard.should.be.a.Function;
    });

    it("defines an abstract dashboard component class", function() {
        should.exist(LocusZoom.Dashboard.Component);
        LocusZoom.Dashboard.Component.should.be.a.Function;
    });

    it("defines an abstract dashboard component button class", function() {
        should.exist(LocusZoom.Dashboard.Component.Button);
        LocusZoom.Dashboard.Component.Button.should.be.a.Function;
    });

    it("defines a singleton object for extending a collection of components", function() {
        should.exist(LocusZoom.Dashboard.Components);
        LocusZoom.Dashboard.Components.should.be.an.Object;
    });

    describe("Covariates Model Component", function() {
        beforeEach(function(){
            var datasources = new LocusZoom.DataSources();
            var layout = {
                dashboard: {
                    components: [
                        {
                            type: "covariates_model"
                        }
                    ]
                }
            };
            d3.select("body").append("div").attr("id", "plot");
            this.plot = LocusZoom.populate("#plot", datasources, layout);
        });
        afterEach(function(){
            d3.select("#plot").remove();
            this.plot = null;
        });
        it("Should have initialized a state object for model covariates", function(){
            this.plot.state.model.should.be.an.Object;
            this.plot.state.model.covariates.should.be.an.Array;
            this.plot.state.model.covariates.length.should.be.exactly(0);
        });
        it("Should have initialized a plot object for interfacing with model covariates", function(){
            this.plot.CovariatesModel.should.be.an.Object;
        });
        it("Should have a method for adding arbitrary elements to covariates model", function(){
            this.plot.state.model.covariates.length.should.be.exactly(0);
            this.plot.CovariatesModel.add("foo");
            this.plot.state.model.covariates.length.should.be.exactly(1);
            this.plot.state.model.covariates[0].should.be.exactly("foo");
        });
        it("Should not allow for adding the same element to covariates model more than once", function(){
            this.plot.state.model.covariates.length.should.be.exactly(0);
            this.plot.CovariatesModel.add("foo");
            this.plot.state.model.covariates.length.should.be.exactly(1);
            this.plot.state.model.covariates[0].should.be.exactly("foo");
            this.plot.CovariatesModel.add("bar");
            this.plot.state.model.covariates.length.should.be.exactly(2);
            this.plot.state.model.covariates[1].should.be.exactly("bar");
            this.plot.CovariatesModel.add("foo");
            this.plot.state.model.covariates.length.should.be.exactly(2);
            var obj1 = { foo: "bar", baz: function(){ return "baz"; } };
            var obj2 = { foo: "asdf", baz: function(){ return "baz"; } };
            this.plot.CovariatesModel.add(obj1);
            this.plot.state.model.covariates.length.should.be.exactly(3);
            this.plot.CovariatesModel.add(obj2);
            this.plot.state.model.covariates.length.should.be.exactly(4);
            this.plot.CovariatesModel.add(obj1);
            this.plot.state.model.covariates.length.should.be.exactly(4);
        });
        it("Should have a method for removing covariates in model via their index in the array", function(){
            this.plot.CovariatesModel.add("foo").CovariatesModel.add("bar").CovariatesModel.add("baz");
            this.plot.state.model.covariates.length.should.be.exactly(3);
            this.plot.CovariatesModel.removeByIdx(1);
            this.plot.state.model.covariates.length.should.be.exactly(2);
            this.plot.state.model.covariates[0].should.be.exactly("foo");
            this.plot.state.model.covariates[1].should.be.exactly("baz");
            assert.throws(function(){ this.plot.CovariatesModel.removeByIdx(9); });
            assert.throws(function(){ this.plot.CovariatesModel.removeByIdx(-1); });
            assert.throws(function(){ this.plot.CovariatesModel.removeByIdx("foo"); });
        });
        it("Should have a method for removing all covariates in model", function(){
            this.plot.CovariatesModel.add("foo").CovariatesModel.add("bar").CovariatesModel.add("baz");
            this.plot.state.model.covariates.length.should.be.exactly(3);
            this.plot.CovariatesModel.removeAll();
            this.plot.state.model.covariates.length.should.be.exactly(0);
        });
    });

});