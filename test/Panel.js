"use strict";

/**
  Instance.js Tests
  Test composition of the LocusZoom.Instance object and its base classes
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
               fs.readFileSync('./assets/js/app/DataLayer.js')
             ]
    });

    // Reset DOM and LocusZoom singleton after each test
    afterEach(function(){
        LocusZoom._instances = {};
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    it("creates an object for its name space", function() {
        should.exist(LocusZoom.Instance);
    });
    describe("SVG Composition", function() {
        describe("Curtain", function() {
            beforeEach(function(){
                d3.select("body").append("div").attr("id", "instance_id");
                this.instance = LocusZoom.populate("#instance_id");
            });
            it('last child of each panel container should be a curtain element', function(){
                Object.keys(this.instance._panels).forEach(function(panel_id){
                    d3.select(this.instance._panels[panel_id].svg.node().parentNode.lastChild).attr("id").should.be.exactly("instance_id." + panel_id + ".curtain");
                    d3.select(this.instance._panels[panel_id].svg.node().parentNode.lastChild).attr("class").should.be.exactly("lz-curtain");
                }.bind(this));
            });
            it('each panel should have a curtain object with stored svg selector', function(){
                Object.keys(this.instance._panels).forEach(function(panel_id){
                    this.instance._panels[panel_id].curtain.should.be.an.Object;
                    this.instance._panels[panel_id].curtain.svg.should.be.an.Object;
                    assert.equal(this.instance._panels[panel_id].curtain.svg.html(), this.instance.svg.select("#instance_id\\." + panel_id + "\\.curtain").html());
                }.bind(this));
            });
            it('each panel curtain should have a method that drops the curtain', function(){
                Object.keys(this.instance._panels).forEach(function(panel_id){
                    this.instance._panels[panel_id].curtain.drop.should.be.a.Function;
                    this.instance._panels[panel_id].curtain.drop();
                    assert.equal(this.instance._panels[panel_id].curtain.svg.style("display"), "");
                }.bind(this));
            });
            it('each panel curtain should have a method that raises the curtain', function(){
                Object.keys(this.instance._panels).forEach(function(panel_id){
                    this.instance._panels[panel_id].curtain.raise.should.be.a.Function;
                    this.instance._panels[panel_id].curtain.drop();
                    this.instance._panels[panel_id].curtain.raise();
                    assert.equal(this.instance._panels[panel_id].curtain.svg.style("display"), "none");
                }.bind(this));
            });
        });
    });

});