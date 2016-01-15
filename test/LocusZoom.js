"use strict";

/**
  LocusZoom.js Core Test Suite
  Test composition of the LocusZoom object and its base classes
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom', function(){

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
        LocusZoom.reset();
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    it("creates an object for its name space", function() {
        should.exist(LocusZoom);
    });
    describe("Singleton", function() {
        it('should have a version number', function(){
            LocusZoom.should.have.property('version').which.is.a.String;
        });
        it('should have a method for formatting numbers as megabases', function(){
            LocusZoom.formatMegabase.should.be.a.Function;
            assert.equal(LocusZoom.formatMegabase(1),          "0.000001");
            assert.equal(LocusZoom.formatMegabase(1000),       "0.001");
            assert.equal(LocusZoom.formatMegabase(4567),       "0.005");
            assert.equal(LocusZoom.formatMegabase(1000000),    "1.00");
            assert.equal(LocusZoom.formatMegabase(23423456),   "23.42");
            assert.equal(LocusZoom.formatMegabase(1896335235), "1896.34");
        });
        it('should have a method for generating pretty ticks', function(){
            LocusZoom.prettyTicks.should.be.a.Function;
            assert.deepEqual(LocusZoom.prettyTicks([0, 10]), [0, 2, 4, 6, 8, 10]);
            assert.deepEqual(LocusZoom.prettyTicks([14, 67]), [10, 20, 30, 40, 50, 60, 70]);
            assert.deepEqual(LocusZoom.prettyTicks([0.01, 0.23]), [0, 0.05, 0.10, 0.15, 0.20, 0.25]);
            assert.deepEqual(LocusZoom.prettyTicks([1, 21], 10), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
            assert.deepEqual(LocusZoom.prettyTicks([1, 9], 5, true), [2, 4, 6, 8]);
        });
        it('should have a method for adding instances to a div by ID', function(){
            d3.select("body").append("div").attr("id", "instance_id");
            LocusZoom.addInstanceToDivById.should.be.a.Function;
            LocusZoom.addInstanceToDivById("instance_id", Object(), LocusZoom.DefaultInstance);
            LocusZoom._instances["instance_id"].should.be.an.Object;
            LocusZoom._instances["instance_id"].id.should.be.exactly("instance_id");
            var svg_selector = d3.select('div#instance_id svg');
            svg_selector.should.be.an.Object;
            svg_selector.size().should.be.exactly(1);
            LocusZoom._instances["instance_id"].svg.should.be.an.Object;
            assert.equal(LocusZoom._instances["instance_id"].svg[0][0], svg_selector[0][0]);
        });
        it('should have a method for populating divs with instances by class name', function(){
            d3.select("body").append("div").attr("id", "populated_instance_1").attr("class", "lz");
            d3.select("body").append("div").attr("id", "populated_instance_2").attr("class", "lz");
            LocusZoom.populate.should.be.a.Function;
            LocusZoom.populateAll("div.lz");
            d3.select('div.lz').each(function(){
                var div_selector = d3.select(this);
                var svg_selector = div_selector.select("svg");
                svg_selector.should.be.an.Object;
                svg_selector.size().should.be.exactly(1);
                LocusZoom._instances[div_selector.attr("id")].svg.should.be.an.Object;
                assert.equal(LocusZoom._instances[div_selector.attr("id")].svg[0][0], svg_selector[0][0]);
            });
        });
        describe("Position Queries", function() {
            it('should have a parsePositionQuery function', function() {
                LocusZoom.parsePositionQuery.should.be.a.Function;
            });
            it("should parse chr:start-end", function() {
                var test = LocusZoom.parsePositionQuery("10:45000-65000");
                test.should.have.property("chr","10");
                test.should.have.property("start",45000);
                test.should.have.property("end",65000);
            });
            it("should parse chr:start+end", function() {
                var test = LocusZoom.parsePositionQuery("10:45000+5000");
                test.should.have.property("chr","10");
                test.should.have.property("start",40000);
                test.should.have.property("end",50000);
            });
            it("should parse kb/mb units", function() {
                var test = LocusZoom.parsePositionQuery("10:5.5Mb+2k");
                test.should.have.property("chr","10");
                test.should.have.property("start",5.5e6-2e3);
                test.should.have.property("end",5.5e6+2e3);
            });
            it("should prase chr:pos", function() {
                var test = LocusZoom.parsePositionQuery("2:5500");
                test.should.have.property("chr","2");
                test.should.have.property("position",5500);
            });
        });
        it('should have a method for creating a CORS promise', function(){
            LocusZoom.createCORSPromise.should.be.a.Function;
        });
        
    });

});
