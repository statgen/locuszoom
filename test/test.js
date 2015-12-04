"use strict";

// General Requirements
var requirejs = require("requirejs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom', function() {

    before(function(done) {
        requirejs(['./assets/js/app/LocusZoom.js'], function() {
            done();
        });
    });

    it('should have a version number', function() {
        LocusZoom.should.have.property('version').which.is.a.String();
    });

    it('should have an empty _instances object', function() {
        LocusZoom.should.have.property('_instances', {});
    });

    /*
    describe('#_instances', function () {
        it('should be an empty object', function () {
            console.log("testing");
            assert.equal(typeof LocusZoom, "object");
            //assert.equal(typeof LocusZoom._instances.length, 0);
        });
    });
    */
});
