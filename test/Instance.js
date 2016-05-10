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
            this.instance = new LocusZoom.Instance("instance_id");
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
    describe("Configuration API", function() {
        beforeEach(function() {
            d3.select("body").append("div").attr("id", "instance_id");
            var layout = LocusZoom.mergeLayouts({ resizable: "manual" }, LocusZoom.StandardLayout);
            this.instance = LocusZoom.populate("#instance_id", {}, layout);
        });
        it('should allow setting dimensions, bounded by layout minimums', function(){
            this.instance.setDimensions(563, 681);
            this.instance.layout.width.should.be.exactly(563);
            this.instance.layout.height.should.be.exactly(681);
            this.instance.layout.aspect_ratio.should.be.exactly(563/681);
            this.instance.setDimensions(1320.3, -50);
            this.instance.layout.width.should.be.exactly(1320);
            this.instance.layout.height.should.be.exactly(681);
            this.instance.layout.aspect_ratio.should.be.exactly(1320/681);
            this.instance.setDimensions("q", 0);
            this.instance.layout.width.should.be.exactly(1320);
            this.instance.layout.height.should.be.exactly(LocusZoom.StandardLayout.min_height);
            this.instance.layout.aspect_ratio.should.be.exactly(1320/LocusZoom.StandardLayout.min_height);
            this.instance.setDimensions(0, 0);
            this.instance.layout.width.should.be.exactly(LocusZoom.StandardLayout.min_width);
            this.instance.layout.height.should.be.exactly(LocusZoom.StandardLayout.min_height);
            this.instance.layout.aspect_ratio.should.be.exactly(LocusZoom.StandardLayout.min_width/LocusZoom.StandardLayout.min_height);
        });
        it('should allow for adding arbitrarily many panels', function(){
            this.instance.addPanel.should.be.a.Function;
            var panel = this.instance.addPanel("panel_1", {});
            this.instance.panels.should.have.property(panel.id).which.is.exactly(panel);
            this.instance.panels[panel.id].should.have.property("parent").which.is.exactly(this.instance);
            var panel = this.instance.addPanel("panel_2", {});
            this.instance.panels.should.have.property(panel.id).which.is.exactly(panel);
            this.instance.panels[panel.id].should.have.property("parent").which.is.exactly(this.instance);
        });
        it('should enforce minimum dimensions based on its panels', function(){
            this.instance.setDimensions(1, 1);
            var calculated_min_width = 0;
            var calculated_min_height = 0;
            var panel;
            for (panel in this.instance.panels){
                calculated_min_width = Math.max(calculated_min_width, this.instance.panels[panel].layout.min_width);
                calculated_min_height += this.instance.panels[panel].layout.min_height;
            }
            assert.equal(this.instance.layout.min_width, calculated_min_width);
            assert.equal(this.instance.layout.min_height, calculated_min_height);
            this.instance.layout.width.should.not.be.lessThan(this.instance.layout.min_width);
            this.instance.layout.height.should.not.be.lessThan(this.instance.layout.min_height);
        });
        it('should allow for responsively setting dimensions using a predefined aspect ratio', function(){
            var layout = LocusZoom.mergeLayouts({ aspect_ratio: 2 }, LocusZoom.StandardLayout);
            this.instance = LocusZoom.populate("#instance_id", {}, layout);
            this.instance.layout.aspect_ratio.should.be.exactly(2);
            assert.equal(this.instance.layout.width/this.instance.layout.height, 2);
            this.instance.setDimensions(2000);
            this.instance.layout.aspect_ratio.should.be.exactly(2);
            assert.equal(this.instance.layout.width/this.instance.layout.height, 2);
            this.instance.setDimensions(900, 900);
            this.instance.layout.aspect_ratio.should.be.exactly(2);
            assert.equal(this.instance.layout.width/this.instance.layout.height, 2);
        });
        it('should allow for responsively positioning panels using a proportional dimensions', function(){
            var responsive_layout = LocusZoom.mergeLayouts({
                resizable: "responsive",
                aspect_ratio: 2,
                panels: {
                    positions: { proportional_width: 1, proportional_height: 0.6 },
                    genes:     { proportional_width: 1, proportional_height: 0.4 }
                }
            }, LocusZoom.StandardLayout);
            this.instance = LocusZoom.populate("#instance_id", {}, responsive_layout);
            assert.equal(this.instance.layout.panels.positions.height/this.instance.layout.height, 0.6);
            assert.equal(this.instance.layout.panels.genes.height/this.instance.layout.height, 0.4);
            this.instance.setDimensions(2000);
            assert.equal(this.instance.layout.panels.positions.height/this.instance.layout.height, 0.6);
            assert.equal(this.instance.layout.panels.genes.height/this.instance.layout.height, 0.4);
            this.instance.setDimensions(900, 900);
            assert.equal(this.instance.layout.panels.positions.height/this.instance.layout.height, 0.6);
            assert.equal(this.instance.layout.panels.genes.height/this.instance.layout.height, 0.4);
            this.instance.setDimensions(100, 100);
            assert.equal(this.instance.layout.panels.positions.height/this.instance.layout.height, 0.6);
            assert.equal(this.instance.layout.panels.genes.height/this.instance.layout.height, 0.4);
        });
        it('should not allow for a non-numerical / non-positive predefined dimensions', function(){
            assert.throws(function(){ this.instance = LocusZoom.populate("#instance_id", {}, { width: 0, height: 0 }) });
            assert.throws(function(){ this.instance = LocusZoom.populate("#instance_id", {}, { width: 20, height: -20 }) });
            assert.throws(function(){ this.instance = LocusZoom.populate("#instance_id", {}, { width: "foo", height: 40 }) });
            assert.throws(function(){ this.instance = LocusZoom.populate("#instance_id", {}, { width: 60, height: [1,2] }) });
        });
        it('should not allow for a non-numerical / non-positive predefined aspect ratio', function(){
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: 0 };
                this.instance = LocusZoom.populate("#instance_id", {}, responsive_layout);
            });
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: -1 };
                this.instance = LocusZoom.populate("#instance_id", {}, responsive_layout);
            });
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: "foo" };
                this.instance = LocusZoom.populate("#instance_id", {}, responsive_layout);
            });
            assert.throws(function(){
                var responsive_layout = { resizable: "responsive", aspect_ratio: [1,2,3] };
                this.instance = LocusZoom.populate("#instance_id", {}, responsive_layout);
            });
        });
        it('should allow for mapping to new coordinates', function(){
            /*
              // BUSTED - Need to mock data sources to make these tests work again!
            this.instance.mapTo.should.be.a.Function;
            this.instance.mapTo(10, 400000, 500000);
            this.instance.state.chr.should.be.exactly(10);
            this.instance.state.start.should.be.exactly(400000);
            this.instance.state.end.should.be.exactly(500000);
            */
        });
        it('should allow for refreshing data without mapping to new coordinates', function(){
            /*
              // BUSTED - Need to mock data sources to make these tests work again!
            this.instance.refresh.should.be.a.Function;
            this.instance.mapTo(10, 400000, 500000);
            this.instance.refresh();
            this.instance.state.chr.should.be.exactly(10);
            this.instance.state.start.should.be.exactly(400000);
            this.instance.state.end.should.be.exactly(500000);
            */
        });
    });
    describe("SVG Composition", function() {
        describe("Mouse Guide Layer", function() {
            beforeEach(function(){
                d3.select("body").append("div").attr("id", "instance_id");
                this.instance = LocusZoom.populate("#instance_id");
            });
            it('first child should be a mouse guide layer group element', function(){
                d3.select(this.instance.svg.node().firstChild).attr("id").should.be.exactly("instance_id.mouse_guide");
            });
            it('should have a mouse guide object with mouse guide svg selectors', function(){
                this.instance.mouse_guide.should.be.an.Object;
                this.instance.mouse_guide.svg.should.be.an.Object;
                assert.equal(this.instance.mouse_guide.svg.html(), this.instance.svg.select("#instance_id\\.mouse_guide").html());
                this.instance.mouse_guide.vertical.should.be.an.Object;
                assert.equal(this.instance.mouse_guide.vertical.html(), this.instance.svg.select("#instance_id\\.mouse_guide rect.lz-mouse_guide-vertical").html());
                this.instance.mouse_guide.horizontal.should.be.an.Object;
                assert.equal(this.instance.mouse_guide.horizontal.html(), this.instance.svg.select("#instance_id\\.mouse_guide rect.lz-mouse_guide-horizontal").html());
            });
        });
        describe("UI Layer", function() {
            beforeEach(function(){
                d3.select("body").append("div").attr("id", "instance_id");
                this.instance = LocusZoom.populate("#instance_id");
            });
            it('second-to-last child should be a ui group element', function(){
                var childNodes = this.instance.svg.node().childNodes.length;
                d3.select(this.instance.svg.node().childNodes[childNodes-2]).attr("id").should.be.exactly("instance_id.ui");
                d3.select(this.instance.svg.node().childNodes[childNodes-2]).attr("class").should.be.exactly("lz-ui");
            });
            it('should have a ui object with ui svg selectors', function(){
                this.instance.ui.should.be.an.Object;
                this.instance.ui.svg.should.be.an.Object;
                assert.equal(this.instance.ui.svg.html(), this.instance.svg.select("#instance_id\\.ui").html());
                if (this.instance.layout.resizable == "manual"){
                    assert.equal(this.instance.ui.resize_handle.html(), this.instance.svg.select("#instance_id\\.ui\\.resize_handle").html());
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
                d3.select("body").append("div").attr("id", "instance_id");
                this.instance = LocusZoom.populate("#instance_id");
            });
            it('last child should be a curtain group element', function(){
                d3.select(this.instance.svg.node().lastChild).attr("id").should.be.exactly("instance_id.curtain");
                d3.select(this.instance.svg.node().lastChild).attr("class").should.be.exactly("lz-curtain");
            });
            it('should have a curtain object with stored svg selector', function(){
                this.instance.curtain.should.be.an.Object;
                this.instance.curtain.svg.should.be.an.Object;
                assert.equal(this.instance.curtain.svg.html(), this.instance.svg.select("#instance_id\\.curtain").html());
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
});
