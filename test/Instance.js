"use strict";

/**
  Instance.js Tests
  Test composition of the LocusZoom.Instance object and its base classes
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

describe('LocusZoom.Instance', function(){
    it("creates an object for its name space", function() {
        should.exist(LocusZoom.Instance);
    });
    describe("Constructor", function() {
        beforeEach(function() {
            this.instance = new LocusZoom.Instance("instance_id");
        });
        it("returns an object", function() {
            this.instance.should.be.an.Object();
        });
        it('should have an id', function(){
            this.instance.should.have.property('id').which.is.a.String();
        });
        it('should point to LocusZoom with parent', function(){
            this.instance.should.have.property('parent').which.is.exactly(LocusZoom);
        });
    });
    describe("Configuration API", function() {
        beforeEach(function() {
            this.instance = new LocusZoom.Instance("instance_id");
        });
        it('should allow changing width and height', function(){
            this.instance.setDimensions(0, 0);
            this.instance.view.should.have.property('width').which.is.exactly(0);
            this.instance.view.should.have.property('height').which.is.exactly(0);
            this.instance.setDimensions(100.3, -50);
            this.instance.view.should.have.property('width').which.is.exactly(100);
            this.instance.view.should.have.property('height').which.is.exactly(0);
            this.instance.setDimensions("q", 75);
            this.instance.view.should.have.property('width').which.is.exactly(100);
            this.instance.view.should.have.property('height').which.is.exactly(75);
        });
        it('should allow for adding panels', function(){
            this.instance.addPanel.should.be.a.Function();
            var panel = this.instance.addPanel(LocusZoom.PositionsPanel);
            this.instance._panels.should.have.property(panel.id).which.is.exactly(panel);
            this.instance._panels[panel.id].should.have.property("parent").which.is.exactly(this.instance);
        });
        it('should allow for inializing itself', function(){
            this.instance.initialize.should.be.a.Function();
        });
        it('should allow for mapping to new coordinates', function(){
            this.instance.mapTo.should.be.a.Function();
            this.instance.mapTo(10, 400000, 500000);
            this.instance.state.chr.should.be.exactly(10);
            this.instance.state.start.should.be.exactly(400000);
            this.instance.state.end.should.be.exactly(500000);
        });
    });
    describe("SVG Composition", function() {
        it('should have a curtain object as the last child to obscure the intance when necessary', function(){
            var instance = LocusZoom.addInstanceToDivById("instance_id", {}, LocusZoom.DefaultInstance);
            instance.svg.select("g#"+instance.id+"\\.curtain").should.have.property("length").which.is.exactly(1);
            d3.select(instance.svg.node().lastChild).attr("id").should.be.exactly("instance_id.curtain");
        });
    });
});
