"use strict";

/**
  LocusZoom.js Core Test Suite
  Test composition of the LocusZoom object and its base classes
*/

// General Requirements
var requirejs = require("requirejs");
var assert = require('assert');
var should = require("should");
var jsdom = require("jsdom");

// Load all vendor dependencies and app files before running tests. Order is important!
beforeEach(function(done){
    var modules = [
        './assets/js/vendor/d3.min.js',
        './assets/js/vendor/q.min.js',
        './assets/js/app/LocusZoom.js',
        './assets/js/app/Data.js',
        './assets/js/app/Instance.js',
        './assets/js/app/Panel.js',
        './assets/js/app/DataLayer.js'
    ];
    requirejs(modules, function(){
        done();
    });
});

global.document = jsdom.jsdom('<div id="instance_id"></div>');
global.window = document.defaultView;

describe('LocusZoom', function(){
    it("creates an object for its name space", function() {
        should.exist(LocusZoom);
    });
    describe("Singleton", function() {
        it('should have a version number', function(){
            LocusZoom.should.have.property('version').which.is.a.String();
        });
        it('should have a method for formatting numbers as bases', function(){
            LocusZoom.formatPosition.should.be.a.Function();
            assert.equal(LocusZoom.formatPosition(1),          "1.00 b");
            assert.equal(LocusZoom.formatPosition(1000),       "1.00 Kb");
            assert.equal(LocusZoom.formatPosition(4567),       "4.57 Kb");
            assert.equal(LocusZoom.formatPosition(1000000),    "1.00 Mb");
            assert.equal(LocusZoom.formatPosition(2342345),    "2.34 Mb");
            assert.equal(LocusZoom.formatPosition(1896335235), "1.90 Gb");
        });
        it('should have a method for adding instances to a div by ID', function(){
            LocusZoom.addInstanceToDivById.should.be.a.Function();
        });
        it('should have a method for populating divs with instances by class name', function(){
            LocusZoom.populate.should.be.a.Function();
        });
        it('should have a method for creating a CORS promise', function(){
            LocusZoom.createCORSPromise.should.be.a.Function();
        });
    });
});


