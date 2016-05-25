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
               fs.readFileSync('./assets/js/app/DataLayer.js'),
               fs.readFileSync('./assets/js/app/Singletons.js'),
               fs.readFileSync('./assets/js/app/Data.js'),
               fs.readFileSync('./assets/js/app/Instance.js'),
               fs.readFileSync('./assets/js/app/Panel.js')
             ]
    });

    // Reset DOM and LocusZoom singleton after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    describe("LocusZoom.DataSources", function() {

        var TestSource1, TestSource2;
        var originalKnownDataSources;
        beforeEach(function() {
            originalKnownDataSources = LocusZoom.KnownDataSources._data.slice(0);
            LocusZoom.KnownDataSources.clear();
            TestSource1 = function(x) {this.init = x};
            TestSource1.SOURCE_NAME = "test1";
            TestSource2 = function(x) {this.init = x};
            TestSource2.SOURCE_NAME = "test2";
            LocusZoom.KnownDataSources.add(TestSource1);
            LocusZoom.KnownDataSources.add(TestSource2);
        });
        afterEach(function() {
            LocusZoom.KnownDataSources._set_data(originalKnownDataSources);
        });

        it('should have a DataSources object', function(){
            LocusZoom.DataSources.should.be.a.Function;
        });
        it('should add source via .add() - object', function(){
            var ds = new LocusZoom.DataSources();
            ds.add("t1", new TestSource1());
            ds.keys().should.have.length(1);
            should.exist(ds.get("t1"));
        });
        it("should add source via .add() - array", function() {
            var ds = new LocusZoom.DataSources();
            ds.add("t1", ["test1"]);
            ds.keys().should.have.length(1);
            should.exist(ds.get("t1"));
        });
        it('should allow chainable adding', function() {
            var ds = new LocusZoom.DataSources();
            ds.add("t1", new TestSource1()).add("t2", new TestSource1());
            ds.keys().should.have.length(2);
        })
        it('should add sources via fromJSON() - object', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1:  new TestSource1(), t2:  new TestSource2()});
            ds.keys().should.have.length(2);
            should.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
        it('should add sources via fromJSON() - array', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1: ["test1"], t2: ["test2"]});
            ds.keys().should.have.length(2);
            should.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
        it('should add sources via fromJSON() - string (JSON)', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON('{"t1": ["test1"], "t2": ["test2"]}');
            ds.keys().should.have.length(2);
            should.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
        it('should pass in initialization values as object', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({"t1": ["test1", {a:10}], "t2": ["test2", {b:20}]});
            ds.keys().should.have.length(2);
            should.exist(ds.get("t1").init);
            should.exist(ds.get("t1").init.a);
            ds.get("t1").init.a.should.equal(10);
            should.exist(ds.get("t2").init);
            should.exist(ds.get("t2").init.b);
            ds.get("t2").init.b.should.equal(20);
        });
        it('should remove sources via remove()', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1:  new TestSource1(), t2:  new TestSource2()});
            ds.remove("t1");
            ds.keys().should.have.length(1);
            should.not.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
    });

    describe("Static JSON Data Source", function() {
        var datasources, namespace, data;
        beforeEach(function(){
            datasources = new LocusZoom.DataSources();
            namespace = "test";
            data = [ { x: 0, y: 3, z: 8 },
                     { x: 2, y: 7, h: 5 },
                     { x: 8, y: 1, q: 6 } ];
            datasources.add( namespace, [ "StaticJSON", data ] );
        });
        it('should pass arbitrary static JSON through a get() request on the data sources object', function() {           
            var get = datasources.get(namespace);
            assert.deepEqual(get._data, data);
        });
        it('should pass only specifically requested fields on static JSON through a getData() request', function() {
            var layout = {
                panels: {
                    foo: {
                        data_layers: {
                            bar: {
                                type: "line",
                                fields: ["test:x", "test:y"]
                            }
                        }
                    }
                }
            };
            d3.select("body").append("div").attr("id", "plot");
            var plot = LocusZoom.populate("#plot", datasources, layout);
            plot.lzd.getData({}, ["test:x"])
                .then(function(data){
                    var expected_data = [ { "test:x": 0 }, { "test:x": 2 }, { "test:x": 8 } ];
                    data.should.have.property("header").which.is.an.Object;
                    data.should.have.property("body").which.is.an.Object;
                    assert.deepEqual(data.body, expected_data);
                });
            plot.lzd.getData({}, ["test:q"])
                .then(function(data){
                    var expected_data = [ { "test:q": 6 } ];
                    data.should.have.property("header").which.is.an.Object;
                    data.should.have.property("body").which.is.an.Object;
                    assert.deepEqual(data.body, expected_data);
                });
        });
    });

});


