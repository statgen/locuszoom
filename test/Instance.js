"use strict";

/**
  Instance.js Tests
  Test composition of the LocusZoom.Instance object and its base classes
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom.Instance', function(){

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
        should.exist(LocusZoom.Instance);
    });

    it("defines its layout defaults", function() {
        LocusZoom.Instance.should.have.property('DefaultLayout').which.is.an.Object;
    });

    describe("Constructor", function() {
        beforeEach(function() {
            this.instance = new LocusZoom.Instance("plot");
        });
        it("returns an object", function() {
            this.instance.should.be.an.Object;
        });
        it('should have an id', function(){
            this.instance.should.have.property('id').which.is.a.String;
        });
        it('should have a layout which is (superficially) a copy of StandardLayout', function(){
            assert.equal(this.instance.layout.width, LocusZoom.StandardLayout.width);
            assert.equal(this.instance.layout.height, LocusZoom.StandardLayout.height);
            assert.equal(this.instance.layout.min_width, LocusZoom.StandardLayout.min_width);
            assert.equal(this.instance.layout.min_height, LocusZoom.StandardLayout.min_height);
        });
    });

    describe("Geometry and Panels", function() {
        beforeEach(function(){
            this.layout = {
                width: 100,
                height: 100,
                min_width: 1,
                min_height: 1,
                resizable: false,
                aspect_ratio: 1,
                panels: {},
                controls: false
            };
            d3.select("body").append("div").attr("id", "plot");
            this.plot = LocusZoom.populate("#plot", {}, this.layout);
        });
        afterEach(function(){
            d3.select("#plot").remove();
            delete this.plot;
        });
        it('should allow for adding arbitrarily many panels', function(){
            this.plot.addPanel.should.be.a.Function;
            var panelA = this.plot.addPanel("panelA", { foo: "bar" });
            panelA.should.have.property("id").which.is.exactly("panelA");
            this.plot.panels.should.have.property(panelA.id).which.is.exactly(panelA);
            this.plot.panels[panelA.id].should.have.property("parent").which.is.exactly(this.plot);
            this.plot.layout.panels.should.have.property("panelA").which.is.an.Object;
            this.plot.layout.panels.panelA.should.have.property("foo").which.is.exactly("bar");
            var panelB = this.plot.addPanel("panelB", { foo: "baz" });
            panelB.should.have.property("id").which.is.exactly("panelB");
            this.plot.panels.should.have.property(panelB.id).which.is.exactly(panelB);
            this.plot.panels[panelB.id].should.have.property("parent").which.is.exactly(this.plot);
            this.plot.layout.panels.should.have.property("panelB").which.is.an.Object;
            this.plot.layout.panels.panelB.should.have.property("foo").which.is.exactly("baz");
        });
        it('should allow for removing panels', function(){
            this.plot.removePanel.should.be.a.Function;
            var panelA = this.plot.addPanel("panelA", { foo: "bar" });
            var panelB = this.plot.addPanel("panelB", { foo: "baz" });
            this.plot.removePanel("panelA");
            this.plot.panels.should.not.have.property("panelA");
            this.plot.layout.panels.should.not.have.property("panelA");
        });
        /*
        it('should allow setting dimensions, bounded by layout minimums', function(){          
            this.plot.setDimensions(563, 681);
            this.plot.layout.width.should.be.exactly(563);
            this.plot.layout.height.should.be.exactly(681);
            this.plot.layout.aspect_ratio.should.be.exactly(563/681);
            this.plot.setDimensions(1320.3, -50);
            this.plot.layout.width.should.be.exactly(1320);
            this.plot.layout.height.should.be.exactly(681);
            this.plot.layout.aspect_ratio.should.be.exactly(1320/681);
            this.plot.setDimensions("q", 0);
            this.plot.layout.width.should.be.exactly(1320);
            this.plot.layout.height.should.be.exactly(LocusZoom.StandardLayout.min_height);
            this.plot.layout.aspect_ratio.should.be.exactly(1320/LocusZoom.StandardLayout.min_height);
            this.plot.setDimensions(0, 0);
            this.plot.layout.width.should.be.exactly(LocusZoom.StandardLayout.min_width);
            this.plot.layout.height.should.be.exactly(LocusZoom.StandardLayout.min_height);
            this.plot.layout.aspect_ratio.should.be.exactly(LocusZoom.StandardLayout.min_width/LocusZoom.StandardLayout.min_height);
        });
        */
        it('should enforce minimum dimensions based on its panels', function(){
            this.plot.addPanel("p1", { width: 50, height: 30, min_width: 50, min_height: 30 });
            this.plot.addPanel("p2", { width: 20, height: 10, min_width: 20, min_height: 10 });
            this.plot.setDimensions(1, 1);
            assert.equal(this.plot.layout.min_width, 50);
            assert.equal(this.plot.layout.min_height, 40);
            this.plot.layout.width.should.be.exactly(this.plot.layout.min_width);
            this.plot.layout.height.should.be.exactly(this.plot.layout.min_height);
        });
        /*
        it('should allow for responsively setting dimensions using a predefined aspect ratio', function(){
            var layout = LocusZoom.mergeLayouts({ aspect_ratio: 2 }, LocusZoom.StandardLayout);
            this.plot = LocusZoom.populate("#plot", {}, layout);
            this.plot.layout.aspect_ratio.should.be.exactly(2);
            assert.equal(this.plot.layout.width/this.plot.layout.height, 2);
            this.plot.setDimensions(2000);
            this.plot.layout.aspect_ratio.should.be.exactly(2);
            assert.equal(this.plot.layout.width/this.plot.layout.height, 2);
            this.plot.setDimensions(900, 900);
            this.plot.layout.aspect_ratio.should.be.exactly(2);
            assert.equal(this.plot.layout.width/this.plot.layout.height, 2);
        });
        */
        /*
        it('should allow for responsively positioning panels using a proportional dimensions', function(){
            var responsive_layout = LocusZoom.mergeLayouts({
                resizable: "responsive",
                aspect_ratio: 2,
                panels: {
                    positions: { proportional_width: 1, proportional_height: 0.6 },
                    genes:     { proportional_width: 1, proportional_height: 0.4 }
                }
            }, LocusZoom.StandardLayout);
            this.plot = LocusZoom.populate("#plot", {}, responsive_layout);
            console.log(this.plot.layout);
            console.log(this.plot.panels.positions.layout);
            console.log(this.plot.panels.genes.layout);
            assert.equal(this.plot.layout.panels.positions.height/this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels.genes.height/this.plot.layout.height, 0.4);
            this.plot.setDimensions(2000);
            assert.equal(this.plot.layout.panels.positions.height/this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels.genes.height/this.plot.layout.height, 0.4);
            this.plot.setDimensions(900, 900);
            assert.equal(this.plot.layout.panels.positions.height/this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels.genes.height/this.plot.layout.height, 0.4);
            this.plot.setDimensions(100, 100);
            assert.equal(this.plot.layout.panels.positions.height/this.plot.layout.height, 0.6);
            assert.equal(this.plot.layout.panels.genes.height/this.plot.layout.height, 0.4);
        });
        */
        it('should not allow for a non-numerical / non-positive predefined dimensions', function(){
            assert.throws(function(){ this.plot = LocusZoom.populate("#plot", {}, { width: 0, height: 0 }) });
            assert.throws(function(){ this.plot = LocusZoom.populate("#plot", {}, { width: 20, height: -20 }) });
            assert.throws(function(){ this.plot = LocusZoom.populate("#plot", {}, { width: "foo", height: 40 }) });
            assert.throws(function(){ this.plot = LocusZoom.populate("#plot", {}, { width: 60, height: [1,2] }) });
        });
        it('should not allow for a non-numerical / non-positive predefined aspect ratio', function(){
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: 0 };
                this.plot = LocusZoom.populate("#plot", {}, responsive_layout);
            });
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: -1 };
                this.plot = LocusZoom.populate("#plot", {}, responsive_layout);
            });
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: "foo" };
                this.plot = LocusZoom.populate("#plot", {}, responsive_layout);
            });
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: [1,2,3] };
                this.plot = LocusZoom.populate("#plot", {}, responsive_layout);
            });
        });
    });

    describe("SVG Composition", function() {
        describe("Mouse Guide Layer", function() {
            beforeEach(function(){
                d3.select("body").append("div").attr("id", "plot");
                this.instance = LocusZoom.populate("#plot");
            });
            it('first child should be a mouse guide layer group element', function(){
                d3.select(this.instance.svg.node().firstChild).attr("id").should.be.exactly("plot.mouse_guide");
            });
            it('should have a mouse guide object with mouse guide svg selectors', function(){
                this.instance.mouse_guide.should.be.an.Object;
                this.instance.mouse_guide.svg.should.be.an.Object;
                assert.equal(this.instance.mouse_guide.svg.html(), this.instance.svg.select("#plot\\.mouse_guide").html());
                this.instance.mouse_guide.vertical.should.be.an.Object;
                assert.equal(this.instance.mouse_guide.vertical.html(), this.instance.svg.select("#plot\\.mouse_guide rect.lz-mouse_guide-vertical").html());
                this.instance.mouse_guide.horizontal.should.be.an.Object;
                assert.equal(this.instance.mouse_guide.horizontal.html(), this.instance.svg.select("#plot\\.mouse_guide rect.lz-mouse_guide-horizontal").html());
            });
        });
        describe("UI Layer", function() {
            beforeEach(function(){
                d3.select("body").append("div").attr("id", "plot");
                this.instance = LocusZoom.populate("#plot");
            });
            it('second-to-last child should be a ui group element', function(){
                var childNodes = this.instance.svg.node().childNodes.length;
                d3.select(this.instance.svg.node().childNodes[childNodes-2]).attr("id").should.be.exactly("plot.ui");
                d3.select(this.instance.svg.node().childNodes[childNodes-2]).attr("class").should.be.exactly("lz-ui");
            });
            it('should have a ui object with ui svg selectors', function(){
                this.instance.ui.should.be.an.Object;
                this.instance.ui.svg.should.be.an.Object;
                assert.equal(this.instance.ui.svg.html(), this.instance.svg.select("#plot\\.ui").html());
                if (this.instance.layout.resizable == "manual"){
                    assert.equal(this.instance.ui.resize_handle.html(), this.instance.svg.select("#plot\\.ui\\.resize_handle").html());
                }
            });
            it('should be hidden by default', function(){
                assert.equal(this.instance.ui.svg.style("display"), "none");
            });
            it('should have a method that shows the UI layer', function(){
                this.instance.ui.show.should.be.a.Function;
                this.instance.ui.show();
                assert.equal(this.instance.ui.svg.style("display"), "");
            });
            it('should have a method that hides the UI layer', function(){
                this.instance.ui.hide.should.be.a.Function;
                this.instance.ui.show();
                this.instance.ui.hide();
                assert.equal(this.instance.ui.svg.style("display"), "none");
            });
        });
        describe("Curtain Layer", function() {
            beforeEach(function(){
                d3.select("body").append("div").attr("id", "plot");
                this.instance = LocusZoom.populate("#plot");
            });
            it('last child should be a curtain group element', function(){
                d3.select(this.instance.svg.node().lastChild).attr("id").should.be.exactly("plot.curtain");
                d3.select(this.instance.svg.node().lastChild).attr("class").should.be.exactly("lz-curtain");
            });
            it('should have a curtain object with stored svg selector', function(){
                this.instance.curtain.should.be.an.Object;
                this.instance.curtain.svg.should.be.an.Object;
                assert.equal(this.instance.curtain.svg.html(), this.instance.svg.select("#plot\\.curtain").html());
            });
            it('should be hidden by default', function(){
                assert.equal(this.instance.curtain.svg.style("display"), "none");
            });
            it('should have a method that drops the curtain', function(){
                this.instance.curtain.drop.should.be.a.Function;
                this.instance.curtain.drop();
                assert.equal(this.instance.curtain.svg.style("display"), "");
            });
            it('should have a method that raises the curtain', function(){
                this.instance.curtain.raise.should.be.a.Function;
                this.instance.curtain.drop();
                this.instance.curtain.raise();
                assert.equal(this.instance.curtain.svg.style("display"), "none");
            });
        });
    });

    describe("Dynamic Panel Positioning", function() {
        beforeEach(function(){
            this.layout = {
                width: 100,
                height: 100,
                min_width: 100,
                min_height: 100,
                resizable: false,
                aspect_ratio: 1,
                panels: {},
                controls: false
            };
            d3.select("body").append("div").attr("id", "plot");
            this.plot = LocusZoom.populate("#plot", {}, this.layout);
        });
        it('Should adjust the size of the plot if a single panel is added that does not completely fill it', function(){
            var panelA = { width: 100, height: 50 };
            this.plot.addPanel('panelA', panelA);
            var svg = d3.select("#plot svg");
            this.plot.layout.width.should.be.exactly(100);
            this.plot.layout.height.should.be.exactly(50);
            (+svg.attr("width")).should.be.exactly(100);
            (+svg.attr("height")).should.be.exactly(50);
            this.plot.panels.panelA.layout.width.should.be.exactly(100);
            this.plot.panels.panelA.layout.height.should.be.exactly(50);
            this.plot.panels.panelA.layout.proportional_height.should.be.exactly(1);
            this.plot.panels.panelA.layout.proportional_origin.y.should.be.exactly(0);
            this.plot.panels.panelA.layout.origin.y.should.be.exactly(0);
            this.plot.sumProportional("height").should.be.exactly(1);
        });
        it('Should extend the size of the plot if panels are added that expand it, and automatically prevent panels from overlapping vertically', function(){
            var panelA = { width: 100, height: 60 };
            var panelB = { width: 100, height: 60 };
            this.plot.addPanel('panelA', panelA);
            this.plot.addPanel('panelB', panelB);
            var svg = d3.select("#plot svg");
            this.plot.layout.width.should.be.exactly(100);
            this.plot.layout.height.should.be.exactly(120);
            (+svg.attr("width")).should.be.exactly(100);
            (+svg.attr("height")).should.be.exactly(120);
            this.plot.panels.panelA.layout.width.should.be.exactly(100);
            this.plot.panels.panelA.layout.height.should.be.exactly(60);
            this.plot.panels.panelA.layout.proportional_height.should.be.exactly(0.5);
            this.plot.panels.panelA.layout.proportional_origin.y.should.be.exactly(0);
            this.plot.panels.panelA.layout.origin.y.should.be.exactly(0);
            this.plot.panels.panelB.layout.width.should.be.exactly(100);
            this.plot.panels.panelB.layout.height.should.be.exactly(60);
            this.plot.panels.panelB.layout.proportional_height.should.be.exactly(0.5);
            this.plot.panels.panelB.layout.proportional_origin.y.should.be.exactly(0.5);
            this.plot.panels.panelB.layout.origin.y.should.be.exactly(60);
            this.plot.sumProportional("height").should.be.exactly(1);
        });
        it('Should resize the plot as panels are removed', function(){
            var panelA = { width: 100, height: 60 };
            var panelB = { width: 100, height: 60 };
            this.plot.addPanel('panelA', panelA);
            this.plot.addPanel('panelB', panelB);
            this.plot.removePanel('panelA');
            var svg = d3.select("#plot svg");
            this.plot.layout.width.should.be.exactly(100);
            this.plot.layout.height.should.be.exactly(60);
            (+svg.attr("width")).should.be.exactly(100);
            (+svg.attr("height")).should.be.exactly(60);
            this.plot.panels.panelB.layout.width.should.be.exactly(100);
            this.plot.panels.panelB.layout.height.should.be.exactly(60);
            this.plot.panels.panelB.layout.proportional_height.should.be.exactly(1);
            this.plot.panels.panelB.layout.proportional_origin.y.should.be.exactly(0);
            this.plot.panels.panelB.layout.origin.y.should.be.exactly(0);
            this.plot.sumProportional("height").should.be.exactly(1);
        });
    });

});
