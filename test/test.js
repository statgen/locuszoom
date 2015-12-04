"use strict";

/**
  LocusZoom.js Core Test Suite
  Test composition of the LocusZoom object and its base classes
*/

// General Requirements
var requirejs = require("requirejs");
var assert = require('assert');
var should = require("should");

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

describe('LocusZoom', function(){

    // Core LocusZoom properties and methods

    it('should have a version number', function(){
        LocusZoom.should.have.property('version').which.is.a.String();
    });

    it('should have an empty _instances object', function(){
        LocusZoom.should.have.property('_instances', {});
    });

    describe('formatPosition()', function(){
        it ('should properly turn numbers into formatted bases', function(){
            assert.equal("1.00 b", LocusZoom.formatPosition(1));
            assert.equal("1.00 Kb", LocusZoom.formatPosition(1000));
            assert.equal("4.57 Kb", LocusZoom.formatPosition(4567));
            assert.equal("1.00 Mb", LocusZoom.formatPosition(1000000));
            assert.equal("2.34 Mb", LocusZoom.formatPosition(2342345));
            assert.equal("1.90 Gb", LocusZoom.formatPosition(1896335235));
        });
    });

    // Base methods

    it('should have a Data object', function(){
        LocusZoom.should.have.property('Data').which.is.an.Object();
    });
    describe('Data', function(){
        it('should have a Requester object', function(){
            LocusZoom.Data.should.have.property('Requester').which.is.a.Function();
        });
    });

    it('should have an Instance base method', function(){
        LocusZoom.should.have.property('Instance').which.is.a.Function();
    });

    it('should have a Panel base method', function(){
        LocusZoom.should.have.property('Panel').which.is.a.Function();
    });

    it('should have a DataLayer base method', function(){
        LocusZoom.should.have.property('DataLayer').which.is.a.Function();
    });

});


