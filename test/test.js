"use strict";

// General Requirements
var requirejs = require("requirejs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom', function(){

    before(function(done){
        requirejs(['./assets/js/app/LocusZoom.js'], function(){
            done();
        });
    });

    it('should have a version number', function(){
        LocusZoom.should.have.property('version').which.is.a.String();
    });

    it('should have an empty _instances object', function(){
        LocusZoom.should.have.property('_instances', {});
    });

    describe('#formatPosition()', function(){
        it ('should properly turn numbers into formatted bases', function(){
            assert.equal("1.00 b", LocusZoom.formatPosition(1));
            assert.equal("1.00 Kb", LocusZoom.formatPosition(1000));
            assert.equal("4.57 Kb", LocusZoom.formatPosition(4567));
            assert.equal("1.00 Mb", LocusZoom.formatPosition(1000000));
            assert.equal("2.34 Mb", LocusZoom.formatPosition(2342345));
            assert.equal("1.90 Gb", LocusZoom.formatPosition(1896335235));
        });
    });

});

