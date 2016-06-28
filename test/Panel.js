"use strict";

/**
  Instance.js Tests
  Test composition of the LocusZoom.Panel object and its base classes
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom.Panel', function(){

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
        should.exist(LocusZoom.Panel);
    });

    it("defines its layout defaults", function() {
        LocusZoom.Panel.should.have.property('DefaultLayout').which.is.an.Object;
    });

    describe("Constructor", function() {
        beforeEach(function(){
            d3.select("body").append("div").attr("id", "instance_id");
            this.instance = LocusZoom.populate("#instance_id");
            this.panel = this.instance.panels.positions;
        });
        it("returns an object", function() {
            this.panel.should.be.an.Object;
        });
        it('should have an id', function(){
            this.panel.should.have.property('id');
        });
        it('should have an object for tracking data layers', function(){
            this.panel.should.have.property('data_layers').which.is.an.Object;
        });
        it('should track dimensions, margins, and positioning with a layout object', function(){
            this.panel.should.have.property('layout').which.is.an.Object;
            this.panel.layout.width.should.be.a.Number;
            this.panel.layout.height.should.be.a.Number;
            this.panel.layout.min_width.should.be.a.Number;
            this.panel.layout.min_height.should.be.a.Number;
            this.panel.layout.proportional_width.should.be.a.Number;
            this.panel.layout.proportional_height.should.be.a.Number;
            this.panel.layout.origin.should.be.an.Object;
            this.panel.layout.origin.should.have.property('x').which.is.a.Number
            this.panel.layout.origin.should.have.property('y').which.is.a.Number;
            this.panel.layout.margin.should.be.an.Object;
            this.panel.layout.margin.should.have.property('top').which.is.a.Number
            this.panel.layout.margin.should.have.property('right').which.is.a.Number;
            this.panel.layout.margin.should.have.property('bottom').which.is.a.Number;
            this.panel.layout.margin.should.have.property('left').which.is.a.Number;
            this.panel.layout.cliparea.should.be.an.Object;
            this.panel.layout.cliparea.should.have.property('width').which.is.a.Number
            this.panel.layout.cliparea.should.have.property('height').which.is.a.Number;
            this.panel.layout.cliparea.should.have.property('origin').which.is.an.Object;
            this.panel.layout.cliparea.origin.should.have.property('x').which.is.a.Number;
            this.panel.layout.cliparea.origin.should.have.property('y').which.is.a.Number;
        });
        it('should generate an ID if passed a layout that does not define one', function(){
            this.instance.addPanel({ "foo": "bar" });
            var panel_idx = this.instance.layout.panels.length - 1;
            this.instance.layout.panels[panel_idx].should.have.property("id").which.is.a.String;
            this.instance.layout.panels[panel_idx].foo.should.be.exactly("bar");
            this.instance.panels[this.instance.layout.panels[panel_idx].id].should.be.an.Object;
            this.instance.panels[this.instance.layout.panels[panel_idx].id].layout.foo.should.be.exactly("bar");
        });
        it('should throw an error if adding a panel with an ID that is already used', function(){
            this.instance.addPanel({ "id": "duplicate", "foo": "bar" });
            assert.throws(function(){
                this.instance.addPanel({ "id": "duplicate", "foo2": "bar2" });
            }.bind(this));
        });
    });

    describe("Geometry methods", function() {
        beforeEach(function(){
            d3.select("body").append("div").attr("id", "instance_id");
            this.instance = LocusZoom.populate("#instance_id");
            this.panel = this.instance.panels.positions;
        });
        it('should allow changing dimensions', function(){
            this.panel.setDimensions(840, 560);
            this.panel.layout.should.have.property('width').which.is.exactly(840);
            this.panel.layout.should.have.property('height').which.is.exactly(560);
            this.panel.setDimensions(9000, -50);
            this.panel.layout.should.have.property('width').which.is.exactly(840);
            this.panel.layout.should.have.property('height').which.is.exactly(560);
            this.panel.setDimensions("q", 942);
            this.panel.layout.should.have.property('width').which.is.exactly(840);
            this.panel.layout.should.have.property('height').which.is.exactly(560);
        });
        it('should enforce minimum dimensions', function(){
            this.panel.layout.width.should.not.be.lessThan(this.panel.layout.min_width);
            this.panel.layout.height.should.not.be.lessThan(this.panel.layout.min_height);
            this.panel.setDimensions(this.panel.layout.min_width / 2, 0);
            this.panel.layout.width.should.not.be.lessThan(this.panel.layout.min_width);
            this.panel.layout.height.should.not.be.lessThan(this.panel.layout.min_height);
            this.panel.setDimensions(0, this.panel.layout.min_height / 2);
            this.panel.layout.width.should.not.be.lessThan(this.panel.layout.min_width);
            this.panel.layout.height.should.not.be.lessThan(this.panel.layout.min_height);
        });
        it('should allow setting origin irrespective of instance dimensions', function(){
            this.instance.setDimensions(500, 600);
            this.panel.setOrigin(20, 50);
            this.panel.layout.origin.x.should.be.exactly(20);
            this.panel.layout.origin.y.should.be.exactly(50);
            this.panel.setOrigin(0, 0);
            this.panel.layout.origin.x.should.be.exactly(0);
            this.panel.layout.origin.y.should.be.exactly(0);
            this.panel.setOrigin("q", { foo: "bar" });
            this.panel.layout.origin.x.should.be.exactly(0);
            this.panel.layout.origin.y.should.be.exactly(0);
            this.panel.setOrigin(700, 800);
            this.panel.layout.origin.x.should.be.exactly(700);
            this.panel.layout.origin.y.should.be.exactly(800);
        });
        it('should allow setting margin, which sets cliparea origin and dimensions', function(){
            this.panel.setMargin(1, 2, 3, 4);
            this.panel.layout.margin.top.should.be.exactly(1);
            this.panel.layout.margin.right.should.be.exactly(2);
            this.panel.layout.margin.bottom.should.be.exactly(3);
            this.panel.layout.margin.left.should.be.exactly(4);
            this.panel.layout.cliparea.origin.x.should.be.exactly(4);
            this.panel.layout.cliparea.origin.y.should.be.exactly(1);
            this.panel.layout.cliparea.width.should.be.exactly(this.panel.layout.width - (2 + 4));
            this.panel.layout.cliparea.height.should.be.exactly(this.panel.layout.height - (1 + 3));
            this.panel.setMargin(0, "12", -17, {foo: "bar"});
            this.panel.layout.margin.top.should.be.exactly(0);
            this.panel.layout.margin.right.should.be.exactly(12);
            this.panel.layout.margin.bottom.should.be.exactly(3);
            this.panel.layout.margin.left.should.be.exactly(4);
            this.panel.layout.cliparea.origin.x.should.be.exactly(4);
            this.panel.layout.cliparea.origin.y.should.be.exactly(0);
            this.panel.layout.cliparea.width.should.be.exactly(this.panel.layout.width - (12 + 4));
            this.panel.layout.cliparea.height.should.be.exactly(this.panel.layout.height - (0 + 3));
        });
        it('should prevent margins from overlapping', function(){
            this.panel.setDimensions(500, 500);
            this.panel.setMargin(700, 1000, 900, 800);
            this.panel.layout.margin.should.have.property('top').which.is.exactly(150);
            this.panel.layout.margin.should.have.property('right').which.is.exactly(350);
            this.panel.layout.margin.should.have.property('bottom').which.is.exactly(350);
            this.panel.layout.margin.should.have.property('left').which.is.exactly(150);
        });
    });

    describe("Panel Curtain and Loader", function() {
        beforeEach(function(){
            var datasources = new LocusZoom.DataSources();
            this.layout = {
                width: 100,
                height: 100,
                min_width: 100,
                min_height: 100,
                resizable: false,
                aspect_ratio: 1,
                panels: [
                    { id: "test",
                      width: 100,
                      height: 100 }
                ],
                controls: false
            };
            d3.select("body").append("div").attr("id", "plot");
            this.plot = LocusZoom.populate("#plot", datasources, this.layout);
            this.panel = this.plot.panels.test;
        });
        it("should have a curtain object with show/update/hide methods, a showing boolean, and selectors", function(){
            this.panel.should.have.property("curtain").which.is.an.Object;
            this.panel.curtain.should.have.property("showing").which.is.exactly(false);
            this.panel.curtain.should.have.property("show").which.is.a.Function;
            this.panel.curtain.should.have.property("update").which.is.a.Function;
            this.panel.curtain.should.have.property("hide").which.is.a.Function;
            this.panel.curtain.should.have.property("selector").which.is.exactly(null);
            this.panel.curtain.should.have.property("content_selector").which.is.exactly(null);
        });
        it("should show/hide/update on command and track shown status", function(){
            this.panel.curtain.showing.should.be.false();
            this.panel.curtain.should.have.property("selector").which.is.exactly(null);
            this.panel.curtain.should.have.property("content_selector").which.is.exactly(null);
            this.panel.curtain.show("test content");
            this.panel.curtain.showing.should.be.true();
            this.panel.curtain.selector.empty().should.be.false();
            this.panel.curtain.content_selector.empty().should.be.false();
            this.panel.curtain.content_selector.html().should.be.exactly("test content");
            this.panel.curtain.hide();
            this.panel.curtain.showing.should.be.false();
            this.panel.curtain.should.have.property("selector").which.is.exactly(null);
            this.panel.curtain.should.have.property("content_selector").which.is.exactly(null);
        });
        it("should have a loader object with show/update/animate/setPercentCompleted/hide methods, a showing boolean, and selectors", function(){
            this.panel.should.have.property("loader").which.is.an.Object;
            this.panel.loader.should.have.property("showing").which.is.exactly(false);
            this.panel.loader.should.have.property("show").which.is.a.Function;
            this.panel.loader.should.have.property("update").which.is.a.Function;
            this.panel.loader.should.have.property("animate").which.is.a.Function;
            this.panel.loader.should.have.property("update").which.is.a.Function;
            this.panel.loader.should.have.property("setPercentCompleted").which.is.a.Function;
            this.panel.loader.should.have.property("selector").which.is.exactly(null);
            this.panel.loader.should.have.property("content_selector").which.is.exactly(null);
            this.panel.loader.should.have.property("progress_selector").which.is.exactly(null);
        });
        it("should show/hide/update on command and track shown status", function(){
            this.panel.loader.showing.should.be.false();
            this.panel.loader.should.have.property("selector").which.is.exactly(null);
            this.panel.loader.should.have.property("content_selector").which.is.exactly(null);
            this.panel.loader.should.have.property("progress_selector").which.is.exactly(null);
            this.panel.loader.show("test content");
            this.panel.loader.showing.should.be.true();
            this.panel.loader.selector.empty().should.be.false();
            this.panel.loader.content_selector.empty().should.be.false();
            this.panel.loader.content_selector.html().should.be.exactly("test content");
            this.panel.loader.progress_selector.empty().should.be.false();
            this.panel.loader.hide();
            this.panel.loader.showing.should.be.false();
            this.panel.loader.should.have.property("selector").which.is.exactly(null);
            this.panel.loader.should.have.property("content_selector").which.is.exactly(null);
            this.panel.loader.should.have.property("progress_selector").which.is.exactly(null);
        });
        it("should allow for animating or showing discrete percentages of completion", function(){
            this.panel.loader.show("test content").animate();
            this.panel.loader.progress_selector.classed("lz-loader-progress-animated").should.be.true();
            this.panel.loader.setPercentCompleted(15);
            this.panel.loader.content_selector.html().should.be.exactly("test content");
            this.panel.loader.progress_selector.classed("lz-loader-progress-animated").should.be.false();
            this.panel.loader.progress_selector.style("width").should.be.exactly("15%");
            this.panel.loader.update("still loading...", 62);
            this.panel.loader.content_selector.html().should.be.exactly("still loading...");
            this.panel.loader.progress_selector.style("width").should.be.exactly("62%");
            this.panel.loader.setPercentCompleted(200);
            this.panel.loader.progress_selector.style("width").should.be.exactly("100%");
            this.panel.loader.setPercentCompleted(-43);
            this.panel.loader.progress_selector.style("width").should.be.exactly("1%");
            this.panel.loader.setPercentCompleted("foo");
            this.panel.loader.progress_selector.style("width").should.be.exactly("1%");
        });
    });

});
