'use strict';

/**
  LocusZoom.js Data Test Suite
  Test LocusZoom Data access objects
*/
describe('LocusZoom Data', function() {
    describe('LocusZoom.Data.Field', function() {
        beforeEach(function() {
            LocusZoom.TransformationFunctions.add('herp', function(x) { return x.toString() + 'herp'; });
            LocusZoom.TransformationFunctions.add('derp', function(x) { return x.toString() + 'derp'; });
        });
        afterEach(function() {
            LocusZoom.TransformationFunctions.set('herp');
            LocusZoom.TransformationFunctions.set('derp');
        });
        it('should have a Data Field object', function() {
            LocusZoom.Data.should.have.property('Field').which.is.a.Function;
        });
        it('should correctly parse name-only field string into components', function() {
            var f = new LocusZoom.Data.Field('foo');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo');
            f.should.have.property('name').which.is.exactly('foo');
            f.should.have.property('namespace').which.is.exactly(null);
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(0);
        });
        it('should correctly parse namespaced field string into components', function() {
            var f = new LocusZoom.Data.Field('foo:bar');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo:bar');
            f.should.have.property('name').which.is.exactly('bar');
            f.should.have.property('namespace').which.is.exactly('foo');
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(0);
        });
        it('should correctly parse namespaced field string with single transformation into components', function() {
            var f = new LocusZoom.Data.Field('foo:bar|herp');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo:bar|herp');
            f.should.have.property('name').which.is.exactly('bar');
            f.should.have.property('namespace').which.is.exactly('foo');
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(1);
            f.transformations[0].should.be.a.Function;
        });
        it('should correctly parse namespaced field string with multiple transformations into components', function() {
            var f = new LocusZoom.Data.Field('foo:bar|herp|derp');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo:bar|herp|derp');
            f.should.have.property('name').which.is.exactly('bar');
            f.should.have.property('namespace').which.is.exactly('foo');
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(2);
            f.transformations[0].should.be.a.Function;
            f.transformations[1].should.be.a.Function;
        });
        it('should resolve a value when passed a data object', function() {
            var d = { 'foo:bar': 123 };
            var f = new LocusZoom.Data.Field('foo:bar');
            var v = f.resolve(d);
            v.should.be.exactly(123);
        });
        it('should resolve to an unnamespaced value if its present and the explicitly namespaced value is not, and cache the value for future lookups', function() {
            var d = { 'bar': 123 };
            var f = new LocusZoom.Data.Field('foo:bar');
            var v = f.resolve(d);
            v.should.be.exactly(123);
            d.should.have.property('foo:bar').which.is.exactly(123);
        });
        it('should apply arbitrarily many transformations in the order defined', function() {
            var d = { 'foo:bar': 123 };
            var f = new LocusZoom.Data.Field('foo:bar|herp|derp|herp');
            var v = f.resolve(d);
            v.should.be.exactly('123herpderpherp');
            d.should.have.property('foo:bar|herp|derp|herp').which.is.exactly('123herpderpherp');
        });
    });

    describe('LocusZoom.DataSources', function() {

        var TestSource1, TestSource2;
        var originalKnownDataSources;
        beforeEach(function() {
            originalKnownDataSources = LocusZoom.KnownDataSources.getAll().slice(0);
            LocusZoom.KnownDataSources.clear();
            TestSource1 = function(x) {this.init = x;};
            TestSource1.SOURCE_NAME = 'test1';
            TestSource2 = function(x) {this.init = x;};
            TestSource2.SOURCE_NAME = 'test2';
            LocusZoom.KnownDataSources.add(TestSource1);
            LocusZoom.KnownDataSources.add(TestSource2);
        });
        afterEach(function() {
            LocusZoom.KnownDataSources.setAll(originalKnownDataSources);
        });

        it('should have a DataSources object', function() {
            LocusZoom.DataSources.should.be.a.Function;
        });
        it('should add source via .add() - object', function() {
            var ds = new LocusZoom.DataSources();
            ds.add('t1', new TestSource1());
            ds.keys().should.have.length(1);
            should.exist(ds.get('t1'));
        });
        it('should add source via .add() - array', function() {
            var ds = new LocusZoom.DataSources();
            ds.add('t1', ['test1']);
            ds.keys().should.have.length(1);
            should.exist(ds.get('t1'));
        });
        it('should allow chainable adding', function() {
            var ds = new LocusZoom.DataSources();
            ds.add('t1', new TestSource1()).add('t2', new TestSource1());
            ds.keys().should.have.length(2);
        });
        it('should add sources via fromJSON() - object', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1:  new TestSource1(), t2:  new TestSource2()});
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should add sources via fromJSON() - array', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1: ['test1'], t2: ['test2']});
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should add sources via fromJSON() - string (JSON)', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON('{"t1": ["test1"], "t2": ["test2"]}');
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should pass in initialization values as object', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({'t1': ['test1', {a:10}], 't2': ['test2', {b:20}]});
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1').init);
            should.exist(ds.get('t1').init.a);
            ds.get('t1').init.a.should.equal(10);
            should.exist(ds.get('t2').init);
            should.exist(ds.get('t2').init.b);
            ds.get('t2').init.b.should.equal(20);
        });
        it('should remove sources via remove()', function() {
            var ds = new LocusZoom.DataSources();
            ds.fromJSON({t1:  new TestSource1(), t2:  new TestSource2()});
            ds.remove('t1');
            ds.keys().should.have.length(1);
            should.not.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should provide a source_id for all sources defined as part of a chain', function() {
            var ds = new LocusZoom.DataSources();
            ds.add('t1', new TestSource1());
            ds.add('t2', ['test2', {}]);

            assert.equal(ds.sources.t1.source_id, 't1', 'Directly added source is aware of chain namespace');
            assert.equal(ds.sources.t2.source_id, 't2', 'Source created via options is aware of chain namespace');
        });
    });

    describe('LocusZoom Data.Source', function() {
        describe('Source.extend()', function() {

            //reset known data sources
            var originalKDS;
            beforeEach(function() {
                originalKDS = LocusZoom.KnownDataSources.getAll().slice(0);
            });
            afterEach(function() {
                LocusZoom.KnownDataSources.setAll(originalKDS);
            });

            it('should work with no parameters', function() {
                var source = LocusZoom.Data.Source.extend();
                //no changes to KDS
                LocusZoom.KnownDataSources.list().length.should.equal(originalKDS.length);
                //has inherited the get data method from base Data.Source
                var obj = new source();
                should.exist(obj.getData);
            });

            it('should respect a custom constructor', function() {
                var source = LocusZoom.Data.Source.extend(function() {
                    this.test = 5;
                });
                var obj = new source();
                should.exist(obj.test);
                obj.test.should.equal(5);
            });

            it('should register with KnownDataSources', function() {
                LocusZoom.Data.Source.extend(function() {
                    this.test = 11;
                }, 'Happy');
                LocusZoom.KnownDataSources.list().length.should.equal(originalKDS.length + 1);
                LocusZoom.KnownDataSources.list().should.containEql('Happy');
                var obj = LocusZoom.KnownDataSources.create('Happy');
                should.exist(obj.test);
                obj.test.should.equal(11);
            });

            it('should allow specific prototype', function() {
                var source = LocusZoom.Data.Source.extend(function() {
                    this.fromCon = 3;
                }, null, {fromProto:7});
                var obj = new source();
                should.exist(obj.fromCon);
                obj.fromCon.should.equal(3);
                should.exist(obj.fromProto);
                obj.fromProto.should.equal(7);
            });

            it('should easily inherit from known types (string)', function() {
                var source1 = LocusZoom.Data.Source.extend(function() {
                    this.name = 'Bob';
                    this.initOnly = 'Boo';
                }, 'BaseOne');
                source1.prototype.greet = function() {return 'hello ' + this.name;};
                var source2 = LocusZoom.Data.Source.extend(function() {
                    this.name = 'Brenda';
                }, 'BaseTwo', 'BaseOne');
                var obj = new source2();
                should.exist(obj.name);
                should.exist(obj.greet);
                obj.name.should.equal('Brenda');
                obj.greet().should.equal('hello Brenda');
                should.not.exist(obj.initOnly);
            });

            it('should easily inherit from known types (function)', function() {
                var source1 = LocusZoom.Data.Source.extend(function() {
                    this.name = 'Bob';
                }, 'BaseOne');
                source1.prototype.greet = function() {return 'hello ' + this.name;};
                var source2 = LocusZoom.Data.Source.extend(function() {
                    this.name = 'Brenda';
                }, 'BaseTwo', source1);
                var obj = new source2();
                should.exist(obj.name);
                should.exist(obj.greet);
                obj.name.should.equal('Brenda');
                obj.greet().should.equal('hello Brenda');
            });

            it('should easily inherit from known types (array)', function() {
                var source1 = LocusZoom.Data.Source.extend(function() {
                    this.name = 'Bob';
                }, 'BaseOne');
                source1.prototype.greet = function() {return 'hello ' + this.name;};
                var source = LocusZoom.Data.Source.extend(null, 'BaseTwo', ['BaseOne']);
                var obj = new source();
                should.exist(obj.name);
                should.exist(obj.greet);
                obj.name.should.equal('Bob');
                obj.greet().should.equal('hello Bob');
            });
        });

        describe('Source.getData', function() {
            it('dependentSource skips making a request if previous sources did not add data to chain.body', function() {
                var source = new LocusZoom.Data.Source();
                source.dependentSource = true;
                var requestStub = sinon.stub(source, 'getRequest');

                var callable = source.getData();
                var noRecordsChain = { body: [] };
                callable(noRecordsChain);

                assert.ok(requestStub.notCalled, 'Request should be skipped');
            });

            it('dependentSource makes a request if chain.body has data from previous sources', function(done) {
                var source = new LocusZoom.Data.Source();
                source.dependentSource = false;
                var requestStub = sinon.stub(source, 'getRequest').callsFake(function() { return Promise.resolve(); });
                sinon.stub(source, 'parseResponse').callsFake(function() {
                    // Because this is an async test, `done` will serve as proof that parseResponse was called
                    done();
                });

                var callable = source.getData();
                var hasRecordsChain = { body: [{ some: 'data' }] };
                callable(hasRecordsChain);

                assert.ok(requestStub.called, 'Request was made');
            });

            afterEach(function() {
                sinon.restore();
            });
        });

        describe('Source.parseResponse', function() {
            // Parse response is a wrapper for a set of helper methods. Test them individually, and combined.
            afterEach(function() {
                sinon.restore();
            });

            it('lets empty response edge cases pass with a warning', function () {
                // This is a hack around a browser edge case, and intent may change later
                var error_stub = sinon.stub(console, 'error');
                var source = new LocusZoom.Data.Source();

                var expected_chain = { dummy: true };
                return source.parseResponse('', expected_chain, [], [], []).then(function(res) {
                    assert.deepEqual(res, expected_chain);
                    assert.ok(error_stub.called, 'An error message was logged');
                });
            });

            describe('Source.parseArraysToObjects', function() {
                it('should provide a legacy wrapper for completely deprecated method', function() {
                    var source = new LocusZoom.Data.Source();
                    var res = source.parseArraysToObjects(
                        {a: [1], b: [1]},
                        ['a', 'b'], ['namespace:a|add1', 'bork:bork'], [function(v) { return v + 1; }, null]
                    );

                    assert.deepEqual(res, [{'namespace:a|add1': 2, 'bork:bork': 1}], 'Transformations were applied');
                });
            });

            describe('Source.parseObjectsToObjects', function () {
                it('should provide a legacy wrapper for completely deprecated method', function() {
                    var source = new LocusZoom.Data.Source();
                    var stub = sinon.stub(source, 'extractFields');
                    source.parseObjectsToObjects([], [], [], []);
                    assert.ok(stub.called, 'extractFields was called');
                });
            });

            describe('Source.normalizeResponse', function () {
                it('should create one object per piece of data', function() {
                    var source = new LocusZoom.Data.Source();
                    var res = source.normalizeResponse(
                        { a: [1, 2], b: [3, 4] } );
                    assert.deepEqual(
                        res,
                        [ {a: 1, b: 3}, {a: 2, b: 4} ],
                        'Correct number and union of elements'
                    );
                });

                it('should require all columns of data to be of same length', function() {
                    var source = new LocusZoom.Data.Source();
                    assert.throws(
                        function() {
                            source.normalizeResponse( { a: [1], b: [1,2], c: [1,2,3] } );
                        },
                        /expects a response in which all arrays of data are the same length/
                    );
                });

                it('should return the data unchanged if it is already in the desired shape', function () {
                    var source = new LocusZoom.Data.Source();
                    var data = [ {a: 1, b: 3}, {a: 2, b: 4} ];
                    var res = source.normalizeResponse( data );
                    assert.deepEqual(res, data);
                });
            });

            describe('Source.annotateData', function() {
                it('should be able to add fields to the returned records', function () {
                    var source = LocusZoom.subclass(LocusZoom.Data.Source, {
                        annotateData: function (records) {
                            // Custom hook that adds a field to every parsed record
                            return records.map(function(item) {
                                item.force = true;
                                return item;
                            });
                        }
                    });

                    // Async test depends on promise
                    return new source().parseResponse([{a:1, b:1}, {a:2, b: 2}], {}, ['a', 'b', 'force'], ['a', 'b', 'force'], []).then(function(records) {
                        records.body.forEach(function(item) {
                            assert.ok(item.force, 'Record should have an additional key not in raw server payload');
                        });
                    });
                });

                it('should be able to annotate based on info in the body and chain', function() {
                    var source = LocusZoom.subclass(LocusZoom.Data.Source, {
                        annotateData: function (records, chain) { return records + chain.header.param; }
                    });
                    var result = new source().annotateData(
                        'some data',
                        { header: { param: ' up the chain' } }
                    );
                    assert.equal(result, 'some data up the chain');
                });
            });

            describe('Source.extractFields', function () {
                it('allows a legacy alias via parseArraysToObjects', function () {
                    var source = new LocusZoom.Data.Source();
                    var res = source.parseArraysToObjects(
                        [ {'id':1, 'val':5}, {'id':2, 'val':10}],
                        ['id'], ['namespace:id'], [null]
                    );

                    assert.deepEqual(res, [{'namespace:id': 1}, {'namespace:id': 2}]);
                });

                it('extracts the specified fields from each record', function () {
                    var source = new LocusZoom.Data.Source();
                    var res = source.extractFields(
                        [ {'id':1, 'val':5}, {'id':2, 'val':10}],
                        ['id'], ['namespace:id'], [null]
                    );
                    assert.deepEqual(res, [{'namespace:id': 1}, {'namespace:id': 2}]);
                });

                it('applies value transformations where appropriate', function () {
                    var source = new LocusZoom.Data.Source();
                    var res = source.extractFields(
                        [ {'id':1, 'val':5}, {'id':2, 'val':10}],
                        ['id', 'val'], ['namespace:id|add1', 'bork:bork'], [function (val) { return val + 1; }, null]
                    );
                    // Output fields can be mapped to any arbitrary based on the field->outnames provided
                    assert.deepEqual(res, [{'namespace:id|add1': 2, 'bork:bork': 5}, {'namespace:id|add1': 3, 'bork:bork': 10}]);
                });

                it('throws an error when requesting a field not present in at least one record', function () {
                    var source = new LocusZoom.Data.Source();


                    assert.throws(function() {
                        source.extractFields(
                            [ {'a':1}, {'a':2}],
                            ['b'], ['namespace:b'], [null]
                        );
                    }, /field b not found in response for namespace:b/);
                });
            });

            describe('Source.combineChainBody', function () {
                it('returns only the body by default', function() {
                    var source = new LocusZoom.Data.Source();

                    var expectedBody = [ { 'namespace:a': 1 } ];
                    var res = source.combineChainBody(expectedBody, {header: {}, body: [], discrete: {}});

                    assert.deepEqual(res, expectedBody);
                });

                it('can build a body based on records from all sources in the chain', function() {
                    var base_source = LocusZoom.subclass(LocusZoom.Data.Source, {
                        combineChainBody: function(records, chain) {
                            return records.map(function(item, index) {
                                return Object.assign({}, item, chain.body[index]);
                            });
                        }
                    });
                    var source = new base_source();

                    var records = [ { 'namespace:a': 1 } ];
                    var res = source.combineChainBody(records, {header: {}, body: [{'namespace:b': 2}], discrete: {}});

                    assert.deepEqual(res, [{ 'namespace:a':1, 'namespace:b': 2 }]);
                });
            });

            describe('integration of steps', function () {
                it('should interpret a string response as JSON', function () {
                    var source = new LocusZoom.Data.Source();

                    return source.parseResponse('{"a_field": ["val"]}', {}, ['a_field'], ['namespace:a_field'], [null])
                        .then(function (chain) {
                            assert.deepEqual(chain.body, [{'namespace:a_field': 'val'}]);
                        });
                });

                it('should store annotations in body and chain.discrete where appropriate', function() {
                    var source = LocusZoom.subclass(LocusZoom.Data.Source, {
                        annotateData: function (data) { return data + ' with annotation'; },
                        normalizeResponse: function (data) { return data; },
                        extractFields: function (data) { return data; }
                    });
                    source.prototype.constructor.SOURCE_NAME = 'fake_source';

                    var result = new source().parseResponse({data: 'a response'}, {});
                    return result.then(function(chain) {
                        assert.deepEqual(chain.discrete, {fake_source: 'a response with annotation'}, 'Discrete response uses annotations');
                        assert.deepEqual(chain.body, 'a response with annotation', 'Combined body uses annotations');
                    });
                });

                it('integrates all methods via promise semantics', function () {
                    // Returning a promise is optional, but should be supported if a custom subclass chooses to do so
                    var basic_source = LocusZoom.subclass(LocusZoom.Data.Source, {
                        normalizeResponse: function () { return Promise.resolve( [{a:1}] ); },
                        annotateData: function (records) {
                            return Promise.resolve(records.map(function(item) {
                                item.b = item.a + 1;
                                return item;
                            }));
                        },
                        extractFields: function (data, fields, outnames, trans) {
                            var rec = data.map(function(item) { return {'bfield': item.b}; });
                            return Promise.resolve(rec); },
                        combineChainBody: function (records) { return Promise.resolve(records); }
                    });
                    basic_source.prototype.constructor.SOURCE_NAME = 'fake_source';

                    var result = new basic_source().parseResponse({}, {});
                    var thisBody = [{bfield: 2}];
                    var expected = { header: {}, discrete: { fake_source: thisBody }, body: thisBody};
                    return result.then(function (final) {
                        assert.deepEqual(final.body, expected.body, 'Chain produces expected result body');
                        assert.deepEqual(final.discrete, expected.discrete, 'The parsed results from this source are also stored in chain.discrete');
                    });
                });
            });
        });
    });

    describe('Association Data Source', function () {
        it('allows normalization + sorting of data', function () {
            var source = new LocusZoom.Data.AssociationSource({
                url: 'locuszoom.org', params: { sort: true }
            });

            var sampleData = { position: [2, 1] };
            var expectedData = [{'position': 1}, {'position': 2}];

            return source.parseResponse(sampleData, {}, ['position'], ['position'], [null])
                .then(function(resp) {
                    assert.deepEqual(resp.body, expectedData, 'Results are sorted by position');
                });
        });
        it('usually returns normalized data in the order the data was provided', function () {
            var source = new LocusZoom.Data.AssociationSource({
                url: 'locuszoom.org', params: {}
            });
            var sampleData = { position: [2, 1] };
            var expectedData = [{'position': 2}, {'position': 1}];

            return source.parseResponse(sampleData, {}, ['position'], ['position'], [null])
                .then(function(resp) {
                    assert.deepEqual(resp.body, expectedData, 'Order of results matches server response');
                });
        });
    });

    describe('Genome build support in annotations', function() {
        // Run the same tests on two sources
        ['GeneSource', 'RecombinationRateSource'].forEach(function(source_name) {
            it('accepts either build or source as config option, but not both', function () {
                var source_type = LocusZoom.Data[source_name];  // Allows generating dynamic tests before LZ symbol is loaded

                var source = new source_type({url: 'www.fake.test', params: { source: 'a', build: 'GRCh37' }});
                assert.throws(function() { source.getURL({});  }, /must provide a parameter specifying either/, 'Bad configuration should raise an exception in ' + source_name);

                source = new source_type({url: 'www.fake.test', params: { source: 'a' }});
                assert.ok(source.getURL({}), 'Works when specifying source ID for ' + source_name);

                source = new source_type({ url: 'www.fake.test' });
                assert.ok(source.getURL({ genome_build: 'GRCh37' }), 'Works when specifying build name for ' + source_name);
            });

            it('gives precedence to state.genome_build over its own config', function () {
                var source_type = LocusZoom.Data[source_name];

                var source = new source_type({url: 'www.fake.test', params: { build: 'GRCh37' }});
                var url = source.getURL({ genome_build: 'GRCh38' });

                // HACK: This is the only part of these tests that differs between sources
                var pattern;
                if (source_name === 'GeneSource') {
                    pattern = /source in 1/;
                } else {
                    pattern = /id in 16/;
                }
                assert.ok(url.match(pattern), source_name + ' produced formed URL: ' + url );
            });

            it('validates genome build', function () {
                var source_type = LocusZoom.Data[source_name];
                var source = new source_type({url: 'www.fake.test', params: { build: 99 }});
                assert.throws(function () { source.getURL({}); }, /must specify a valid genome build number/, 'Should validate options for ' + source_name);
            });
        });
    });

    describe('GwasCatalog Source', function () {
        beforeEach(function() {
            this.exampleData = [
                { 'chrom': 1, 'pos': 3, 'log_pvalue': 1.3,  'rsid': 'rs3',  'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 4, 'log_pvalue': 1.4,  'rsid': 'rs4',  'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 5, 'log_pvalue': 1.5,  'rsid': 'rs5',  'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 6, 'log_pvalue': 1.6,  'rsid': 'rs6',  'trait': 'arithomania' },
            ];
            this.sampleChain = {
                body: [
                    { 'assoc:chromosome': 1, 'assoc:position': 2 },
                    { 'assoc:chromosome': 1, 'assoc:position': 4 },
                    { 'assoc:chromosome': 1, 'assoc:position': 6 },
                ],
            };
        });

        it('will respect a specific source ID over the global build param', function() {
            var source = new LocusZoom.Data.GwasCatalog({url: 'www.fake.test', params: { source: 'fjord' }});
            var url = source.getURL( { genome_build: 'GRCh37' } );
            assert.ok(url.match('fjord'));
        });

        it('aligns records based on loose position match', function () {
            var source = new LocusZoom.Data.GwasCatalog({url: 'www.fake.test', params: {match_type: 'loose'}});
            var res = source.combineChainBody(this.exampleData, this.sampleChain, ['rsid', 'trait'], ['catalog:rsid', 'catalog:trait']);
            assert.deepEqual(res, [
                { 'assoc:chromosome': 1, 'assoc:position': 2 },  // No annotations available for this point
                { 'assoc:chromosome': 1, 'assoc:position': 4, 'catalog:rsid': 'rs4', 'catalog:trait': 'arithomania', 'n_catalog_matches': 1 },
                { 'assoc:chromosome': 1, 'assoc:position': 6, 'catalog:rsid': 'rs6', 'catalog:trait': 'arithomania', 'n_catalog_matches': 1 },
            ]);
        });

        it('handles the case where the same SNP has more than one catalog entry', function() {
            var source = new LocusZoom.Data.GwasCatalog({url: 'www.fake.test' });
            var exampleData = [
                { 'chrom': 1, 'pos': 4, 'log_pvalue': 1.40,  'rsid': 'rs4',  'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 4, 'log_pvalue': 1.41,  'rsid': 'rs4',  'trait': 'graphomania' },
                { 'chrom': 1, 'pos': 6, 'log_pvalue': 1.61,  'rsid': 'rs6',  'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 6, 'log_pvalue': 1.60,  'rsid': 'rs6',  'trait': 'graphomania' },
            ];
            var res = source.combineChainBody(exampleData, this.sampleChain, ['log_pvalue'], ['catalog:log_pvalue']);
            assert.deepEqual(res, [
                { 'assoc:chromosome': 1, 'assoc:position': 2 },  // No annotations available for this point
                { 'assoc:chromosome': 1, 'assoc:position': 4, 'catalog:log_pvalue': 1.41, 'n_catalog_matches': 2 },
                { 'assoc:chromosome': 1, 'assoc:position': 6, 'catalog:log_pvalue': 1.61, 'n_catalog_matches': 2 },
            ]);
        });

        it('gracefully handles no catalog entries in region', function () {
            var source = new LocusZoom.Data.GwasCatalog({url: 'www.fake.test', params: {match_type: 'loose'}});
            var res = source.combineChainBody([], this.sampleChain, ['rsid', 'trait'], ['catalog:rsid', 'catalog:trait']);
            assert.deepEqual(res, [
                { 'assoc:chromosome': 1, 'assoc:position': 2 },
                { 'assoc:chromosome': 1, 'assoc:position': 4 },
                { 'assoc:chromosome': 1, 'assoc:position': 6 },
            ]);
        });
    });

    describe('LDLZ2 Source', function() {
        it('validates the selected build name', function () {
            var source = new LocusZoom.Data.LDSource2({url: 'www.fake.test', params: { build: 99 }});
            assert.throws(function () { source.getURL({}); }, /must specify a valid genome build number/);
        });

        it('will prefer a refvar in plot.state if one is provided', function () {
            var source = new LocusZoom.Data.LDSource2({url: 'www.fake.test', params: { build: 'GRCh37' }});
            var ref = source.getRefvar(
                {ldrefvar: 'Something'},
                {header: {}, body: [{id: 'a', pvalue: 0}]},
                ['ldrefvar', 'state']
            );
            assert.equal(ref, 'Something');
        });

        it('auto-selects the best reference variant (lowest pvalue)', function () {
            var source = new LocusZoom.Data.LDSource2({url: 'www.fake.test', params: { build: 'GRCh37' }});
            var ref = source.getRefvar(
                {},
                {
                    header: {},
                    body: [
                        { id: 'a', pvalue: 0.5 },
                        { id: 'b', pvalue: 0.05 },
                        { id: 'c', pvalue: 0.1 },
                    ],
                },
                ['isrefvar', 'state']
            );
            assert.equal(ref, 'b');
        });

        it('auto-selects the best reference variant (largest nlog_pvalue)', function () {
            var source = new LocusZoom.Data.LDSource2({url: 'www.fake.test', params: { build: 'GRCh37' }});
            var ref = source.getRefvar(
                {},
                {
                    header: {},
                    body: [
                        { id: 'a', log_pvalue: 10 },
                        { id: 'b', log_pvalue: 50 },
                        { id: 'c', log_pvalue: 7 },
                    ],
                },
                ['isrefvar', 'state']
            );
            assert.equal(ref, 'b');
        });

        it('correctly identifies the variant-marker field', function() {
            //
            var source_default = new LocusZoom.Data.LDSource2({url: 'www.fake.test', params: { build: 'GRCh37' }});
            var dataFields = source_default.findMergeFields(
                { body: [{ 'assoc:id': 'a', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, 'assoc:id', 'Uses a default option (ID)');

            dataFields = source_default.findMergeFields(
                { body: [{ 'assoc:variant': 'a', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, 'assoc:variant', 'Uses a default option (variant name)');

            var source_options = new LocusZoom.Data.LDSource2({url: 'www.fake.test',
                params: { build: 'GRCh37', id_field: 'marker' }});
            dataFields = source_options.findMergeFields(
                { body: [{ 'assoc:id': 'a', 'assoc:marker': 'b', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, 'assoc:marker', 'Uses a provided option (from params.id_field)');

            dataFields = source_options.findMergeFields(
                { body: [{ 'assoc:onefish': 'a', 'assoc:twofish': 'b', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, null, 'There is no field matching the requested ID field');
        });
    });

    describe('Static JSON Data Source', function() {
        beforeEach(function() {
            this.datasources = new LocusZoom.DataSources();
            this.namespace = 'test';
            this.data = [
                { x: 0, y: 3, z: 8 },
                { x: 2, y: 7, h: 5 },
                { x: 8, y: 1, q: 6 }
            ];
            this.datasources.add( this.namespace, [ 'StaticJSON', this.data ] );
            this.layout = {
                panels: [
                    {
                        id: 'foo',
                        data_layers: [
                            {
                                id: 'bar',
                                type: 'line',
                                fields: ['test:x', 'test:y']
                            }
                        ]
                    }
                ]
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = LocusZoom.populate('#plot', this.datasources, this.layout);
        });
        afterEach(function() {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should pass arbitrary static JSON through a get() request on the data sources object', function() {
            var get = this.datasources.get(this.namespace);
            assert.deepEqual(get._data, this.data);
        });
        it('should pass only specifically requested fields on static JSON through a getData() request (1)', function(done) {
            this.plot.lzd.getData({}, ['test:x'])
                .then(function(data) {
                    var expected_data = [ { 'test:x': 0 }, { 'test:x': 2 }, { 'test:x': 8 } ];
                    data.should.have.property('header').which.is.an.Object;
                    data.should.have.property('body').which.is.an.Object;
                    assert.deepEqual(data.body, expected_data);
                    done();
                }).catch(done);
        });
        it('should pass only specifically requested fields on static JSON through a getData() request (2)', function(done) {
            this.plot.lzd.getData({}, ['test:q'])
                .then(function(data) {
                    var expected_data = [ { 'test:q': undefined }, { 'test:q': undefined }, { 'test:q': 6 } ];
                    data.should.have.property('header').which.is.an.Object;
                    data.should.have.property('body').which.is.an.Object;
                    assert.deepEqual(data.body, expected_data);
                    done();
                }).catch(done);
        });
    });

    describe('LocusZoom Data.ConnectorSource', function() {
        beforeEach(function () {
            // Create a source that internally looks for data as "first" from the specified
            this.basic_config = { sources: { first: 'a_source', second: 'b_source' } };
            this.basic_source = LocusZoom.subclass(LocusZoom.Data.ConnectorSource, {
                combineChainBody: function(records, chain) {
                    // A sample method that uses 2 chain sources + an existing body to build an combined response

                    // Tell the internal method how to find the actual data it relies on internally, regardless of how
                    //   it is called in the namespaced data chain
                    var nameFirst = this._source_name_mapping['first'];
                    var nameSecond = this._source_name_mapping['second'];

                    records.forEach(function(item) {
                        item.a = chain.discrete[nameFirst].a_field;
                        item.b = chain.discrete[nameSecond].b_field;
                    });
                    return records;
                }
            });
            this.basic_source.prototype.constructor.SOURCE_NAME = 'test_connector';
        });

        afterEach(function() {
            sinon.restore();
        });

        it('must specify the data it requires from other sources', function() {
            var source = LocusZoom.subclass(LocusZoom.Data.ConnectorSource);
            assert.throws(
                function() { new source(); },
                /Connectors must specify the data they require as init.sources = {internal_name: chain_source_id}} pairs/
            );
            assert.ok(
                new source(this.basic_config),
                'Correctly specifies the namespaces containing data that this connector relies on'
            );
        });
        it('must implement a combineChainBody method', function() {
            var self = this;
            var source = LocusZoom.subclass(LocusZoom.Data.ConnectorSource);
            assert.throws(
                function() { new source(self.basic_config).combineChainBody(); },
                /This method must be implemented in a subclass/
            );
        });
        it('should fail if the namespaces it relies on are not present in the chain', function() {
            var instance = new this.basic_source(this.basic_config);
            assert.throws(
                function() {  instance.getRequest({}, { discrete: { } }); },
                /test_connector cannot be used before loading required data for: a_source/
            );
        });
        it('should not make any network requests', function() {
            var instance = new this.basic_source(this.basic_config);
            var fetchSpy = sinon.stub(instance, 'fetchRequest');

            return instance.getRequest({}, { discrete: { a_source: 1, b_source: 2 } })
                .then(function() { assert.ok(fetchSpy.notCalled, 'No network request was fired'); });
        });
        it('should not return any new data from getRequest', function() {
            var instance = new this.basic_source(this.basic_config);
            var expectedBody = { sample: 'response data' };
            return instance.getRequest({}, { discrete: { a_source: 1, b_source: 2 }, body: expectedBody })
                .then(function(records) { assert.deepEqual(records, expectedBody, 'Should return the previous body'); });
        });
        it('should build a response by combining data from multiple places', function() {
            // Should have access to data in both chain.discrete and chain.body. (connectors don't have their own data)
            // Not every source in chain.discrete has to be an array of records- this tests arbitrary blobs of JSON
            var rawChain = { a_source: { a_field: 'aaa' }, b_source: { b_field: 'bbb' } };
            var expectedBody = [{who: 1, a: 'aaa', b: 'bbb'}, {what: 2, a: 'aaa', b: 'bbb'}];

            var instance = new this.basic_source(this.basic_config);
            return instance.getData()(
                {
                    discrete: rawChain,
                    body: [{ who: 1 }, { what: 2 }]
                }
            ).then(function(response) {
                assert.deepEqual(response.body, expectedBody, 'Response body was correctly annotated');
                assert.deepEqual(response.discrete, rawChain, 'The chain of individual sources was not changed');
            });
        });
    });
});

