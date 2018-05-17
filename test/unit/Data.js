"use strict";

/**
  LocusZoom.js Data Test Suite
  Test LocusZoom Data access objects
*/
describe("LocusZoom Data", function(){
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
        it("should provide a source_id for all sources defined as part of a chain", function() {
            var ds = new LocusZoom.DataSources();
            ds.add("t1", new TestSource1());
            ds.add("t2", ["test2", {}]);

            assert.equal(ds.sources.t1.source_id, "t1", "Directly added source is aware of chain namespace");
            assert.equal(ds.sources.t2.source_id, "t2", "Source created via options is aware of chain namespace");
        });
    });

    describe("LocusZoom Data.Source", function() {
        describe("Source.extend()", function() {

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

        describe("Source.parseArraysToObjects", function() {
            it("should apply transformations to correct fields, if provided", function() {
                var source = new LocusZoom.Data.Source();
                var res = source.parseArraysToObjects(
                    {a: [1], b: [1]},
                    ["a", "b"], ["namespace:a|add1", "bork:bork"], [function(v) { return v + 1; }, null]
                );
                assert.deepEqual(res, [{"namespace:a|add1": 2, "bork:bork": 1}], "Transformations were applied");
            });
            it("should create one object per piece of data, with namespaced keys", function() {
                var source = new LocusZoom.Data.Source();
                var res = source.parseArraysToObjects(
                    { a: [1, 2], b: [3, 4] },
                    ["a", "b"], ["namespace:a", "namespace:b"], [null, null]
                );
                assert.deepEqual(
                    res,
                    [{"namespace:a": 1, "namespace:b": 3}, {"namespace:a": 2, "namespace:b": 4}],
                    "Correct number and union of elements"
                );
            });
            it("should require all columns of data to be of same length", function() {
                var source = new LocusZoom.Data.Source();
                assert.throws(
                    function() {
                        source.parseArraysToObjects(
                            { a: [1], b: [1,2], c: [1,2,3] },
                            [], [], []);
                    },
                    /expects a response in which all arrays of data are the same length/
                );
            });
            it("should throw an error when requesting a field not in the response", function() {
                var source = new LocusZoom.Data.Source();
                assert.throws(
                    function() {
                        source.parseArraysToObjects(
                            {a: [1], b: [1,2], c: [1,2,3]},
                            ["a", "c", "d"],
                            ["namespace:a", "namespace:c", "namespace:d"],
                            [null, null, null]
                        );
                    },
                    /field d not found in response for namespace:d/
                );
            });
        });

        describe("Source.parseObjectsToObjects", function () {
            it("extracts the specified fields from each record", function () {
                var source = new LocusZoom.Data.Source();
                var res = source.parseObjectsToObjects(
                    [ {"id":1, "val":5}, {"id":2, "val":10}],
                    ["id"], ["namespace:id"], [null]
                );
                assert.deepEqual(res, [{"namespace:id": 1}, {"namespace:id": 2}]);
            });
            it("applies value transformations where appropriate", function () {
                var source = new LocusZoom.Data.Source();
                var res = source.parseObjectsToObjects(
                    [ {"id":1, "val":5}, {"id":2, "val":10}],
                    ["id", "val"], ["namespace:id|add1", "bork:bork"], [function (val) { return val + 1; }, null]
                );
                // Output fields can be mapped to any arbitrary based on the field->outnames provided
                assert.deepEqual(res, [{"namespace:id|add1": 2, "bork:bork": 5}, {"namespace:id|add1": 3, "bork:bork": 10}]);
            });
        });

        describe.skip("Source.parseObjectsToObjects", function () {});

        describe("Source.annotateData", function() {
            it("should annotate returned records with an additional custom field", function () {
                var custom_source_class = LocusZoom.KnownDataSources.extend(
                    "StaticJSON",
                    "AnnotatedJSON",
                    {
                        annotateData: function(records) {
                            // Custom hook that adds a field to every parsed record
                            return records.map(function(item) {
                                item.force = true;
                                return item;
                            });
                        }
                    }
                );
                var source = new custom_source_class([{r:2, d:2}, {c:3, p: "o"}]);
                // Async test depends on promise
                return source.getData({}, [], [])({header: []}).then(function(records) {
                    records.body.forEach(function(item) {
                        assert.ok(item.force, "Record should have an additional key not in raw server payload");
                    });
                });
            });

            it("should be able to annotate using both body and chain", function() {
                var source = LocusZoom.subclass(LocusZoom.Data.Source, {
                    annotateData: function (records, chain) { return records + chain.discrete.another_response; }
                });
                var result = new source().annotateData(
                    "some data",
                    { discrete: { another_response: " up the chain" } }
                );
                assert.equal(result, "some data up the chain");
            });
        });

        describe("Source.getData", function() {
            beforeEach(function() {
                this.sandbox = sinon.sandbox.create();
            });

            it("dependentSource skips making a request if previous sources did not add data to chain.body", function() {
                var source = new LocusZoom.Data.Source();
                source.dependentSource = true;
                var requestStub = this.sandbox.stub(source, "getRequest");

                var callable = source.getData();
                var noRecordsChain = { body: [] };
                callable(noRecordsChain);

                assert.ok(requestStub.notCalled, "Request should be skipped");
            });

            it("dependentSource makes a request if chain.body has data from previous sources", function(done) {
                var source = new LocusZoom.Data.Source();
                source.dependentSource = false;
                var requestStub = this.sandbox.stub(source, "getRequest").callsFake(function() { return Q.when(); });
                this.sandbox.stub(source, "parseResponse").callsFake(function() {
                    // Because this is an async test, `done` will serve as proof that parseResponse was called
                    done();
                });

                var callable = source.getData();
                var hasRecordsChain = { body: [{ some: "data" }] };
                callable(hasRecordsChain);

                assert.ok(requestStub.called, "Request was made");
            });

            afterEach(function() {
                this.sandbox.restore();
            });
        });

        describe("Source.parseResponse", function() {
            it("should allow parseData to return a promise", function(done) {
                var source = LocusZoom.subclass(LocusZoom.Data.Source, {
                    parseData: function (data) { return Q.when(data); }
                });
                var result = new source().parseResponse({data: "a response"}, {});
                result.then(function(chain) {
                    assert.deepEqual(chain.body, "a response");
                    done();
                }).catch(done);
            });

            it("should allow annotateData to return a promise and modify the raw response data", function(done) {
                var source = LocusZoom.subclass(LocusZoom.Data.Source, {
                    annotateData: function (data) { return Q.when(data + " with annotation"); },
                    parseData: function(data) { return data; }
                });
                var result = new source().parseResponse({data: "a response"}, {});
                result.then(function(chain) {
                    assert.deepEqual(chain.body, "a response with annotation");
                    done();
                }).catch(done);
            });

            it("should store annotations in body and chain.discrete where appropriate", function(done) {
                var source = LocusZoom.subclass(LocusZoom.Data.Source, {
                    annotateData: function (data) { return data + " with annotation"; },
                    parseData: function(data) { return data; }
                });
                source.prototype.constructor.SOURCE_NAME = "fake_source";

                var result = new source().parseResponse({data: "a response"}, {});
                result.then(function(chain) {
                    assert.deepEqual(chain.discrete, {fake_source: "a response with annotation"}, "Discrete response uses annotations");
                    assert.deepEqual(chain.body, "a response with annotation", "Combined body uses annotations");
                    done();
                }).catch(done);
            });
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

    describe("LocusZoom Data.ConnectorSource", function() {
        beforeEach(function () {
            this.sandbox = sinon.sandbox.create();

            // Create a source that internally looks for data as "first" from the specified
            this.basic_config = { from: { first: "a_source", second: "b_source" } };
            this.basic_source = LocusZoom.subclass(LocusZoom.Data.ConnectorSource, {
                annotateData: function(records, chain) {
                    // A sample method that uses 2 chain sources + an existing body to build an combined response

                    // Tell the internal method how to find the actual data it relies on internally, regardless of how
                    //   it is called in the namespaced data chain
                    var nameFirst = this._source_name_mapping["first"];
                    var nameSecond = this._source_name_mapping["second"];

                    records.forEach(function(item) {
                        item.a = chain.discrete[nameFirst].a_field;
                        item.b = chain.discrete[nameSecond].b_field;
                    });
                    return records;
                }
            });
            this.basic_source.prototype.constructor.SOURCE_NAME = "test_connector";
        });

        afterEach(function() {
            this.sandbox.restore();
        });

        it("must specify the data it requires from other sources", function() {
            var source = LocusZoom.subclass(LocusZoom.Data.ConnectorSource);
            assert.throws(
                function() { new source(); },
                /Connectors must specify the data they require as init.from = {internal_name: chain_source_id}} pairs/
            );
            assert.ok(
                new source(this.basic_config),
                "Correctly specifies the namespaces containing data that this connector relies on"
            );
        });
        it("must implement a annotateData method", function() {
            var self = this;
            assert.throws(
                function() { new LocusZoom.Data.ConnectorSource(self.basic_config).annotateData(); },
                /This method must be implemented in a subclass/
            );
        });
        it("should fail if the namespaces it relies on are not present in the chain", function() {
            var instance = new this.basic_source(this.basic_config);
            assert.throws(
                function() {  instance.getRequest({}, { discrete: { } }); },
                /test_connector cannot be used before loading required data for: a_source/
            );
        });
        it("should not make any network requests", function(done) {
            var instance = new this.basic_source(this.basic_config);
            var fetchSpy = this.sandbox.stub(instance, "fetchRequest");

            instance.getRequest({}, { discrete: { a_source: 1, b_source: 2 } })
                .then(function() {
                    assert.ok(fetchSpy.notCalled, "No network request was fired");
                    done();
                }).catch(done);
        });
        it("should not return any new data from getRequest", function(done) {
            var instance = new this.basic_source(this.basic_config);
            var expectedBody = { sample: "response data" };
            instance.getRequest({}, { discrete: { a_source: 1, b_source: 2 }, body: expectedBody })
                .then(function(records) {
                    assert.deepEqual(records, expectedBody, "Should return the previous body");
                    done();
                }).catch(done);
        });
        it("should use, but not update, chain.discrete as it produces annotated records", function(done) {
            var expectedBody = [{who: 1, a: "aaa", b: "bbb"}, {what: 2, a: "aaa", b: "bbb"}];
            var rawChain = { a_source: { a_field: "aaa" }, b_source: { b_field: "bbb" } };


            var instance = new this.basic_source(this.basic_config);
            instance.getData()(
                {
                    discrete: rawChain,
                    body: [{ who: 1 }, { what: 2 }]
                }
            ).then(function(response) {
                assert.deepEqual(response.body, expectedBody, "Response body was correctly annotated");
                assert.deepEqual(response.discrete, rawChain, "The chain of individual sources was not changed");
                done();
            }).catch(done);
        });
    });
});
