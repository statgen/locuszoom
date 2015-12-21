"use strict";

/**
  LocusZoom.js Data Test Suite
  Test LocusZoom Data access objects
*/

// General Requirements
var requirejs = require("requirejs");
var assert = require('assert');
var should = require("should");

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

describe('LocusZoom Data', function(){
    describe("LocusZoom Data Source", function() {

        var TestSource1, TestSource2;
        beforeEach(function() {
            TestSource1 = function() {};
            TestSource1.SOURCE_NAME = "test1";
            TestSource2 = function() {};
            TestSource2.SOURCE_NAME = "test2";
            LocusZoom.KnownDataSources = [TestSource1, TestSource2];
        })

        it('should have a DataSources object', function(){
            LocusZoom.DataSources.should.be.a.Function();
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
    });
});


