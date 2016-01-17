"use strict";

/**
  LocusZoom.js Data Test Suite
  Test LocusZoom Data access objects
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom Data', function(){

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
    describe("LocusZoom Data Source", function() {

        var TestSource1, TestSource2;
        beforeEach(function() {
            TestSource1 = function(x) {this.init = x};
            TestSource1.SOURCE_NAME = "test1";
            TestSource2 = function(x) {this.init = x};
            TestSource2.SOURCE_NAME = "test2";
            LocusZoom.KnownDataSources = [TestSource1, TestSource2];
        })

        it('should have a DataSources object', function(){
            LocusZoom.DataSources.should.be.a.Function;
        });
        it('should add source via .addSource - object', function(){
            var ds = new LocusZoom.DataSources();
            ds.addSource("t1", new TestSource1());
            ds.keys().should.have.length(1);
            should.exist(ds.getSource("t1"));
        });
        it("should add source via .addSource - array", function() {
            var ds = new LocusZoom.DataSources();
            ds.addSource("t1", ["test1"]);
            ds.keys().should.have.length(1);
            should.exist(ds.getSource("t1"));
        });
        it('should allow chainable adding', function() {
            var ds = new LocusZoom.DataSources();
            ds.addSource("t1", new TestSource1()).addSource("t2", new TestSource1());
            ds.keys().should.have.length(2);
        })
        it('should add sources via setSources() - object', function() {
            var ds = new LocusZoom.DataSources();
            ds.setSources({t1:  new TestSource1(), t2:  new TestSource2()});
            ds.keys().should.have.length(2);
            should.exist(ds.getSource("t1"));
            should.exist(ds.getSource("t2"));
        });

        it('should add sources via setSources() - array', function() {
            var ds = new LocusZoom.DataSources();
            ds.setSources({t1: ["test1"], t2: ["test2"]});
            ds.keys().should.have.length(2);
            should.exist(ds.getSource("t1"));
            should.exist(ds.getSource("t2"));
        });
        it('should add sources via setSources() - string (JSON)', function() {
            var ds = new LocusZoom.DataSources();
            ds.setSources('{"t1": ["test1"], "t2": ["test2"]}');
            ds.keys().should.have.length(2);
            should.exist(ds.getSource("t1"));
            should.exist(ds.getSource("t2"));
        });
        it('should pass in initiization values as object', function() {
            var ds = new LocusZoom.DataSources();
            ds.setSources({"t1": ["test1", {a:10}], "t2": ["test2", {b:20}]});
            ds.keys().should.have.length(2);
            should.exist(ds.getSource("t1").init);
            should.exist(ds.getSource("t1").init.a);
            ds.getSource("t1").init.a.should.equal(10);
            should.exist(ds.getSource("t2").init);
            should.exist(ds.getSource("t2").init.b);
            ds.getSource("t2").init.b.should.equal(20);
        });
    });
});


