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
               fs.readFileSync('./assets/js/app/DataLayer.js')
             ]
    });

    // Reset DOM and LocusZoom singleton after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    it("creates an object for its name space", function() {
        should.exist(LocusZoom.Instance);
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
        it('should point to LocusZoom with parent', function(){
            this.instance.should.have.property('parent').which.is.exactly(LocusZoom);
        });
    });
    describe("Configuration API", function() {
        beforeEach(function() {
            d3.select("body").append("div").attr("id", "instance_id");
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
            this.instance.addPanel.should.be.a.Function;
            var panel = this.instance.addPanel(LocusZoom.PositionsPanel);
            this.instance._panels.should.have.property(panel.id).which.is.exactly(panel);
            this.instance._panels[panel.id].should.have.property("parent").which.is.exactly(this.instance);
        });
        it('should track whether it\'s initialized', function(){
            this.instance.initialize.should.be.a.Function;
            assert.equal(this.instance.initialized, false);
            d3.select("body").append("div").attr("id", "another_instance_id");
            var another_instance = LocusZoom.populate("#another_instance_id");
            assert.equal(another_instance.initialized, true);
        });
        it('should allow for mapping to new coordinates', function(){
            this.instance.mapTo.should.be.a.Function;
            this.instance.mapTo(10, 400000, 500000);
            this.instance.state.chr.should.be.exactly(10);
            this.instance.state.start.should.be.exactly(400000);
            this.instance.state.end.should.be.exactly(500000);
        });
    });
    describe("SVG Composition", function() {
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
                assert.equal(this.instance.ui.resize_handle.html(), this.instance.svg.select("#instance_id\\.ui\\.resize_handle").html());
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
            it('should have a method for toggling mouseovers', function(){
                this.instance.ui.toggleMouseovers.should.be.a.Function;
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
