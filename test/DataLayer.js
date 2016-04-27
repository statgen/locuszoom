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

    describe("Extent generation", function() {
        it("has a method to generate an extent function for any axis", function() {
            this.datalayer = new LocusZoom.DataLayer("test", {});
            this.datalayer.getAxisExtent.should.be.a.Function;
        });
        it("throws an error on invalid axis identifiers", function() {
            assert.throws(function(){ this.datalayer.getAxisExtent(); }.bind(this));
            assert.throws(function(){ this.datalayer.getAxisExtent("foo"); }.bind(this));
            assert.throws(function(){ this.datalayer.getAxisExtent(1); }.bind(this));
            assert.throws(function(){ this.datalayer.getAxisExtent("y1"); }.bind(this));
        });
    });

});
