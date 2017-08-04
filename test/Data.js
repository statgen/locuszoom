/* global LocusZoom,d3 */
/* global it,require,describe,beforeEach,afterEach */

"use strict";

/**
  LocusZoom.js Data Test Suite
  Test LocusZoom Data access objects
*/

var jsdom = require("mocha-jsdom");
var fs = require("fs");
var assert = require("assert");
var should = require("should");
var files = require("../files.js");

describe("LocusZoom Data", function(){

    // Load all javascript files
    var src = [];
    files.test_include.forEach(function(file){ src.push(fs.readFileSync(file)); });
    jsdom({ src: src });

    // Reset DOM and LocusZoom singleton after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    describe("LocusZoom.Data.Field", function() {
        beforeEach(function() {
            LocusZoom.TransformationFunctions.add("herp", function(x) { return x.toString() + "herp"; });
            LocusZoom.TransformationFunctions.add("derp", function(x) { return x.toString() + "derp"; });
        });
        afterEach(function() {
            LocusZoom.TransformationFunctions.set("herp");
            LocusZoom.TransformationFunctions.set("derp");
        });
        it("should have a Data Field object", function(){
            LocusZoom.Data.should.have.property("Field").which.is.a.Function;
        });
        it("should correctly parse name-only field string into components", function(){
            var f = new LocusZoom.Data.Field("foo");
            f.should.be.an.Object;
            f.should.have.property("full_name").which.is.exactly("foo");
            f.should.have.property("name").which.is.exactly("foo");
            f.should.have.property("namespace").which.is.exactly(null);
            f.should.have.property("transformations").which.is.an.Array;
            f.transformations.length.should.be.exactly(0);
        });
        it("should correctly parse namespaced field string into components", function(){
            var f = new LocusZoom.Data.Field("foo:bar");
            f.should.be.an.Object;
            f.should.have.property("full_name").which.is.exactly("foo:bar");
            f.should.have.property("name").which.is.exactly("bar");
            f.should.have.property("namespace").which.is.exactly("foo");
            f.should.have.property("transformations").which.is.an.Array;
            f.transformations.length.should.be.exactly(0);
        });
        it("should correctly parse namespaced field string with single transformation into components", function(){
            var f = new LocusZoom.Data.Field("foo:bar|herp");
            f.should.be.an.Object;
            f.should.have.property("full_name").which.is.exactly("foo:bar|herp");
            f.should.have.property("name").which.is.exactly("bar");
            f.should.have.property("namespace").which.is.exactly("foo");
            f.should.have.property("transformations").which.is.an.Array;
            f.transformations.length.should.be.exactly(1);
            f.transformations[0].should.be.a.Function;
        });
        it("should correctly parse namespaced field string with multiple transformations into components", function(){
            var f = new LocusZoom.Data.Field("foo:bar|herp|derp");
            f.should.be.an.Object;
            f.should.have.property("full_name").which.is.exactly("foo:bar|herp|derp");
            f.should.have.property("name").which.is.exactly("bar");
            f.should.have.property("namespace").which.is.exactly("foo");
            f.should.have.property("transformations").which.is.an.Array;
            f.transformations.length.should.be.exactly(2);
            f.transformations[0].should.be.a.Function;
            f.transformations[1].should.be.a.Function;
        });
        it("should resolve a value when passed a data object", function(){
            var d = { "foo:bar": 123 };
            var f = new LocusZoom.Data.Field("foo:bar");
            var v = f.resolve(d);
            v.should.be.exactly(123);
        });
        it("should resolve to an unnamespaced value if its present and the explicitly namespaced value is not, and cache the value for future lookups", function(){
            var d = { "bar": 123 };
            var f = new LocusZoom.Data.Field("foo:bar");
            var v = f.resolve(d);
            v.should.be.exactly(123);
            d.should.have.property("foo:bar").which.is.exactly(123);
        });
        it("should apply arbitrarily many transformations in the order defined", function(){
            var d = { "foo:bar": 123 };
            var f = new LocusZoom.Data.Field("foo:bar|herp|derp|herp");
            var v = f.resolve(d);
            v.should.be.exactly("123herpderpherp");
            d.should.have.property("foo:bar|herp|derp|herp").which.is.exactly("123herpderpherp");
        });
    });
    
    describe("LocusZoom.DataSources", function() {

        var TestSource1, TestSource2;
        var originalKnownDataSources;
        beforeEach(function() {
            originalKnownDataSources = LocusZoom.KnownDataSources.getAll().slice(0);
            LocusZoom.KnownDataSources.clear();
            TestSource1 = function(x) {this.init = x;};
            TestSource1.SOURCE_NAME = "test1";
            TestSource2 = function(x) {this.init = x;};
            TestSource2.SOURCE_NAME = "test2";
            LocusZoom.KnownDataSources.add(TestSource1);
            LocusZoom.KnownDataSources.add(TestSource2);
        });
        afterEach(function() {
            LocusZoom.KnownDataSources.setAll(originalKnownDataSources);
        });

        it("should have a DataSources object", function(){
            LocusZoom.DataSources.should.be.a.Function;
        });
        it("should add source via .add() - object", function(){
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
        it("should allow chainable adding", function() {
            var ds = new LocusZoom.DataSources();
            ds.add("t1", new TestSource1()).add("t2", new TestSource1());
            ds.keys().should.have.length(2);
        });
        it("should add sources via fromJSON() - object", function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1:  new TestSource1(), t2:  new TestSource2()});
            ds.keys().should.have.length(2);
            should.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
        it("should add sources via fromJSON() - array", function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1: ["test1"], t2: ["test2"]});
            ds.keys().should.have.length(2);
            should.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
        it("should add sources via fromJSON() - string (JSON)", function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON("{\"t1\": [\"test1\"], \"t2\": [\"test2\"]}");
            ds.keys().should.have.length(2);
            should.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
        it("should pass in initialization values as object", function() {
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
        it("should remove sources via remove()", function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1:  new TestSource1(), t2:  new TestSource2()});
            ds.remove("t1");
            ds.keys().should.have.length(1);
            should.not.exist(ds.get("t1"));
            should.exist(ds.get("t2"));
        });
    });


    describe("LocusZoom.Data.Source.extend()", function() {

        //reset known data sources
        var originalKDS;
        beforeEach(function() {
            originalKDS = LocusZoom.KnownDataSources.getAll().slice(0);
        });
        afterEach(function() {
            LocusZoom.KnownDataSources.setAll(originalKDS);
        });

        it("should work with no parameters", function() {
            var source = LocusZoom.Data.Source.extend();
            //no changes to KDS
            LocusZoom.KnownDataSources.list().length.should.equal(originalKDS.length);
            //has inherited the get data method from base Data.Source
            var obj = new source();
            should.exist(obj.getData);
        });

        it("should respect a custom constructor", function() {
            var source = LocusZoom.Data.Source.extend(function() {
                this.test = 5;
            });
            var obj = new source();
            should.exist(obj.test);
            obj.test.should.equal(5);
        });

        it("should register with KnownDataSources", function() {
            LocusZoom.Data.Source.extend(function() {
                this.test = 11;
            }, "Happy");
            LocusZoom.KnownDataSources.list().length.should.equal(originalKDS.length+1);
            LocusZoom.KnownDataSources.list().should.containEql("Happy");
            var obj = LocusZoom.KnownDataSources.create("Happy");
            should.exist(obj.test);
            obj.test.should.equal(11);
        });

        it("should allow specific prototype", function() {
            var source = LocusZoom.Data.Source.extend(function() {
                this.fromCon = 3;
            }, null, {fromProto:7});
            var obj = new source();
            should.exist(obj.fromCon);
            obj.fromCon.should.equal(3);
            should.exist(obj.fromProto);
            obj.fromProto.should.equal(7);
        });

        it("should easily inherit from known types (string)", function() {
            var source1 = LocusZoom.Data.Source.extend(function() {
                this.name = "Bob";
                this.initOnly = "Boo";
            }, "BaseOne");
            source1.prototype.greet = function() {return "hello " + this.name;};
            var source2 = LocusZoom.Data.Source.extend(function() {
                this.name = "Brenda";
            }, "BaseTwo", "BaseOne");
            var obj = new source2();
            should.exist(obj.name);
            should.exist(obj.greet);
            obj.name.should.equal("Brenda");
            obj.greet().should.equal("hello Brenda");
            should.not.exist(obj.initOnly);
        });

        it("should easily inherit from known types (function)", function() {
            var source1 = LocusZoom.Data.Source.extend(function() {
                this.name = "Bob";
            }, "BaseOne");
            source1.prototype.greet = function() {return "hello " + this.name;};
            var source2 = LocusZoom.Data.Source.extend(function() {
                this.name = "Brenda";
            }, "BaseTwo", source1);
            var obj = new source2();
            should.exist(obj.name);
            should.exist(obj.greet);
            obj.name.should.equal("Brenda");
            obj.greet().should.equal("hello Brenda");
        });

        it("should easily inherit from known types (array)", function() {
            var source1 = LocusZoom.Data.Source.extend(function() {
                this.name = "Bob";
            }, "BaseOne");
            source1.prototype.greet = function() {return "hello " + this.name;};
            var source = LocusZoom.Data.Source.extend(null, "BaseTwo", ["BaseOne"]);
            var obj = new source();
            should.exist(obj.name);
            should.exist(obj.greet);
            obj.name.should.equal("Bob");
            obj.greet().should.equal("hello Bob");
        });
    });

    describe("Static JSON Data Source", function() {
        beforeEach(function(){
            this.datasources = new LocusZoom.DataSources();
            this.namespace = "test";
            this.data = [
                { x: 0, y: 3, z: 8 },
                { x: 2, y: 7, h: 5 },
                { x: 8, y: 1, q: 6 }
            ];
            this.datasources.add( this.namespace, [ "StaticJSON", this.data ] );
            this.layout = {
                panels: [
                    {
                        id: "foo",
                        data_layers: [
                            {
                                id: "bar",
                                type: "line",
                                fields: ["test:x", "test:y"]
                            }
                        ]
                    }
                ]
            };
            d3.select("body").append("div").attr("id", "plot");
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
        });
        afterEach(function(){
            d3.select("#plot").remove();
            delete this.plot;
        });
        it("should pass arbitrary static JSON through a get() request on the data sources object", function() {           
            var get = this.datasources.get(this.namespace);
            assert.deepEqual(get._data, this.data);
        });
        it("should pass only specifically requested fields on static JSON through a getData() request (1)", function(done) {
            this.plot.lzd.getData({}, ["test:x"])
                .then(function(data){
                    var expected_data = [ { "test:x": 0 }, { "test:x": 2 }, { "test:x": 8 } ];
                    data.should.have.property("header").which.is.an.Object;
                    data.should.have.property("body").which.is.an.Object;
                    assert.deepEqual(data.body, expected_data);
                    done();
                }).fail(done);
        });
        it("should pass only specifically requested fields on static JSON through a getData() request (2)", function(done) {
            this.plot.lzd.getData({}, ["test:q"])
                .then(function(data){
                    var expected_data = [ { "test:q": undefined }, { "test:q": undefined }, { "test:q": 6 } ];
                    data.should.have.property("header").which.is.an.Object;
                    data.should.have.property("body").which.is.an.Object;
                    assert.deepEqual(data.body, expected_data);
                    done();
                }).fail(done);
        });
    });

});


