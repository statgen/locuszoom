import { assert } from 'chai';
import sinon from 'sinon';

import {
    AssociationSourceLZ,
    BaseSource,
    ConnectorSource,
    GeneLZ,
    GwasCatalogLZ,
    LDLZ,
    RecombLZ,
    StaticSource
} from '../esm/data';

/**
 LocusZoom.js Data Test Suite
 Test LocusZoom Data access objects
 */
describe('LocusZoom Data', function () {
    describe.skip('LocusZoom.Data.Field', function () {
        beforeEach(function () {
            LocusZoom.TransformationFunctions.add('herp', function (x) {
                return x.toString() + 'herp';
            });
            LocusZoom.TransformationFunctions.add('derp', function (x) {
                return x.toString() + 'derp';
            });
        });
        afterEach(function () {
            LocusZoom.TransformationFunctions.set('herp');
            LocusZoom.TransformationFunctions.set('derp');
        });
        it('should have a Data Field object', function () {
            LocusZoom.Data.should.have.property('Field').which.is.a.Function;
        });
        it('should correctly parse name-only field string into components', function () {
            const f = new LocusZoom.Data.Field('foo');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo');
            f.should.have.property('name').which.is.exactly('foo');
            f.should.have.property('namespace').which.is.exactly(null);
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(0);
        });
        it('should correctly parse namespaced field string into components', function () {
            const f = new LocusZoom.Data.Field('foo:bar');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo:bar');
            f.should.have.property('name').which.is.exactly('bar');
            f.should.have.property('namespace').which.is.exactly('foo');
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(0);
        });
        it('should correctly parse namespaced field string with single transformation into components', function () {
            const f = new LocusZoom.Data.Field('foo:bar|herp');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo:bar|herp');
            f.should.have.property('name').which.is.exactly('bar');
            f.should.have.property('namespace').which.is.exactly('foo');
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(1);
            f.transformations[0].should.be.a.Function;
        });
        it('should correctly parse namespaced field string with multiple transformations into components', function () {
            const f = new LocusZoom.Data.Field('foo:bar|herp|derp');
            f.should.be.an.Object;
            f.should.have.property('full_name').which.is.exactly('foo:bar|herp|derp');
            f.should.have.property('name').which.is.exactly('bar');
            f.should.have.property('namespace').which.is.exactly('foo');
            f.should.have.property('transformations').which.is.an.Array;
            f.transformations.length.should.be.exactly(2);
            f.transformations[0].should.be.a.Function;
            f.transformations[1].should.be.a.Function;
        });
        it('should resolve a value when passed a data object', function () {
            const d = { 'foo:bar': 123 };
            const f = new LocusZoom.Data.Field('foo:bar');
            const v = f.resolve(d);
            v.should.be.exactly(123);
        });
        it('should resolve to an unnamespaced value if its present and the explicitly namespaced value is not, and cache the value for future lookups', function () {
            const d = { 'bar': 123 };
            const f = new LocusZoom.Data.Field('foo:bar');
            const v = f.resolve(d);
            v.should.be.exactly(123);
            d.should.have.property('foo:bar').which.is.exactly(123);
        });
        it('should use annotations (extra_fields) by exact field name, iff no value is present in point data', function () {
            const d = { 'bar': 123, 'foo:my_annotation': 13 };
            const f = new LocusZoom.Data.Field('my_annotation');
            const v = f.resolve(d, { 'my_annotation': 12 });
            assert.equal(v, 12);
        });
        it('should apply arbitrarily many transformations in the order defined', function () {
            const d = { 'foo:bar': 123 };
            const f = new LocusZoom.Data.Field('foo:bar|herp|derp|herp');
            const v = f.resolve(d);
            v.should.be.exactly('123herpderpherp');
            d.should.have.property('foo:bar|herp|derp|herp').which.is.exactly('123herpderpherp');
        });
    });

    describe.skip('LocusZoom.DataSources', function () {

        let TestSource1, TestSource2;
        let originalKnownDataSources;
        beforeEach(function () {
            originalKnownDataSources = LocusZoom.KnownDataSources.getAll().slice(0);
            LocusZoom.KnownDataSources.clear();
            TestSource1 = function (x) {
                this.init = x;
            };
            TestSource1.SOURCE_NAME = 'test1';
            TestSource2 = function (x) {
                this.init = x;
            };
            TestSource2.SOURCE_NAME = 'test2';
            LocusZoom.KnownDataSources.add(TestSource1);
            LocusZoom.KnownDataSources.add(TestSource2);
        });
        afterEach(function () {
            LocusZoom.KnownDataSources.setAll(originalKnownDataSources);
        });

        it('should have a DataSources object', function () {
            LocusZoom.DataSources.should.be.a.Function;
        });
        it('should add source via .add() - object', function () {
            const ds = new LocusZoom.DataSources();
            ds.add('t1', new TestSource1());
            ds.keys().should.have.length(1);
            should.exist(ds.get('t1'));
        });
        it('should add source via .add() - array', function () {
            const ds = new LocusZoom.DataSources();
            ds.add('t1', ['test1']);
            ds.keys().should.have.length(1);
            should.exist(ds.get('t1'));
        });
        it('should allow chainable adding', function () {
            const ds = new LocusZoom.DataSources();
            ds.add('t1', new TestSource1()).add('t2', new TestSource1());
            ds.keys().should.have.length(2);
        });
        it('should add sources via fromJSON() - object', function () {
            const ds = new LocusZoom.DataSources();
            ds.fromJSON({ t1: new TestSource1(), t2: new TestSource2() });
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should add sources via fromJSON() - array', function () {
            const ds = new LocusZoom.DataSources();
            ds.fromJSON({ t1: ['test1'], t2: ['test2'] });
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should add sources via fromJSON() - string (JSON)', function () {
            const ds = new LocusZoom.DataSources();
            ds.fromJSON('{"t1": ["test1"], "t2": ["test2"]}');
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should pass in initialization values as object', function () {
            const ds = new LocusZoom.DataSources();
            ds.fromJSON({ 't1': ['test1', { a: 10 }], 't2': ['test2', { b: 20 }] });
            ds.keys().should.have.length(2);
            should.exist(ds.get('t1').init);
            should.exist(ds.get('t1').init.a);
            ds.get('t1').init.a.should.equal(10);
            should.exist(ds.get('t2').init);
            should.exist(ds.get('t2').init.b);
            ds.get('t2').init.b.should.equal(20);
        });
        it('should remove sources via remove()', function () {
            const ds = new LocusZoom.DataSources();
            ds.fromJSON({ t1: new TestSource1(), t2: new TestSource2() });
            ds.remove('t1');
            ds.keys().should.have.length(1);
            should.not.exist(ds.get('t1'));
            should.exist(ds.get('t2'));
        });
        it('should provide a source_id for all sources defined as part of a chain', function () {
            const ds = new LocusZoom.DataSources();
            ds.add('t1', new TestSource1());
            ds.add('t2', ['test2', {}]);

            assert.equal(ds.sources.t1.source_id, 't1', 'Directly added source is aware of chain namespace');
            assert.equal(ds.sources.t2.source_id, 't2', 'Source created via options is aware of chain namespace');
        });
    });

    describe('LocusZoom Data.Source', function () {
        describe.skip('Source.extend()', function () {

            //reset known data sources
            let originalKDS;
            beforeEach(function () {
                originalKDS = LocusZoom.KnownDataSources.getAll().slice(0);
            });
            afterEach(function () {
                LocusZoom.KnownDataSources.setAll(originalKDS);
            });

            it('should work with no parameters', function () {
                const source = LocusZoom.Data.Source.extend();
                //no changes to KDS
                LocusZoom.KnownDataSources.list().length.should.equal(originalKDS.length);
                //has inherited the get data method from base Data.Source
                const obj = new source();
                should.exist(obj.getData);
            });

            it('should respect a custom constructor', function () {
                const source = LocusZoom.Data.Source.extend(function () {
                    this.test = 5;
                });
                const obj = new source();
                should.exist(obj.test);
                obj.test.should.equal(5);
            });

            it('should register with KnownDataSources', function () {
                LocusZoom.Data.Source.extend(function () {
                    this.test = 11;
                }, 'Happy');
                LocusZoom.KnownDataSources.list().length.should.equal(originalKDS.length + 1);
                LocusZoom.KnownDataSources.list().should.containEql('Happy');
                const obj = LocusZoom.KnownDataSources.create('Happy');
                should.exist(obj.test);
                obj.test.should.equal(11);
            });

            it('should allow specific prototype', function () {
                const source = LocusZoom.Data.Source.extend(function () {
                    this.fromCon = 3;
                }, null, { fromProto: 7 });
                const obj = new source();
                should.exist(obj.fromCon);
                obj.fromCon.should.equal(3);
                should.exist(obj.fromProto);
                obj.fromProto.should.equal(7);
            });

            it('should easily inherit from known types (string)', function () {
                const source1 = LocusZoom.Data.Source.extend(function () {
                    this.name = 'Bob';
                    this.initOnly = 'Boo';
                }, 'BaseOne');
                source1.prototype.greet = function () {
                    return 'hello ' + this.name;
                };
                const source2 = LocusZoom.Data.Source.extend(function () {
                    this.name = 'Brenda';
                }, 'BaseTwo', 'BaseOne');
                const obj = new source2();
                should.exist(obj.name);
                should.exist(obj.greet);
                obj.name.should.equal('Brenda');
                obj.greet().should.equal('hello Brenda');
                should.not.exist(obj.initOnly);
            });

            it('should easily inherit from known types (function)', function () {
                const source1 = LocusZoom.Data.Source.extend(function () {
                    this.name = 'Bob';
                }, 'BaseOne');
                source1.prototype.greet = function () {
                    return 'hello ' + this.name;
                };
                const source2 = LocusZoom.Data.Source.extend(function () {
                    this.name = 'Brenda';
                }, 'BaseTwo', source1);
                const obj = new source2();
                should.exist(obj.name);
                should.exist(obj.greet);
                obj.name.should.equal('Brenda');
                obj.greet().should.equal('hello Brenda');
            });

            it('should easily inherit from known types (array)', function () {
                const source1 = LocusZoom.Data.Source.extend(function () {
                    this.name = 'Bob';
                }, 'BaseOne');
                source1.prototype.greet = function () {
                    return 'hello ' + this.name;
                };
                const source = LocusZoom.Data.Source.extend(null, 'BaseTwo', ['BaseOne']);
                const obj = new source();
                should.exist(obj.name);
                should.exist(obj.greet);
                obj.name.should.equal('Bob');
                obj.greet().should.equal('hello Bob');
            });
        });

        describe('Source.getData', function () {
            it('dependentSource skips making a request if previous sources did not add data to chain.body', function () {
                const source = new BaseSource({});
                source.__dependentSource = true;
                let requestStub = sinon.stub(source, 'getRequest');

                const callable = source.getData();
                const noRecordsChain = { body: [] };
                callable(noRecordsChain);

                assert.ok(requestStub.notCalled, 'Request should be skipped');
            });

            it('dependentSource makes a request if chain.body has data from previous sources', function (done) {
                const source = new BaseSource({});
                source.__dependentSource = false;
                const requestStub = sinon.stub(source, 'getRequest').callsFake(function () {
                    return Promise.resolve();
                });
                sinon.stub(source, 'parseResponse').callsFake(function () {
                    // Because this is an async test, `done` will serve as proof that parseResponse was called
                    done();
                });

                const callable = source.getData();
                const hasRecordsChain = { body: [{ some: 'data' }] };
                callable(hasRecordsChain);

                assert.ok(requestStub.called, 'Request was made');
            });

            afterEach(function () {
                sinon.restore();
            });
        });

        describe('Source.parseResponse', function () {
            // Parse response is a wrapper for a set of helper methods. Test them individually, and combined.
            afterEach(function () {
                sinon.restore();
            });

            describe('Source.normalizeResponse', function () {
                it('should create one object per piece of data', function () {
                    const source = new BaseSource({});
                    const res = source.normalizeResponse(
                        { a: [1, 2], b: [3, 4] });
                    assert.deepEqual(
                        res,
                        [{ a: 1, b: 3 }, { a: 2, b: 4 }],
                        'Correct number and union of elements'
                    );
                });

                it('should require all columns of data to be of same length', function () {
                    const source = new BaseSource({});
                    assert.throws(
                        function () {
                            source.normalizeResponse({ a: [1], b: [1, 2], c: [1, 2, 3] });
                        },
                        /expects a response in which all arrays of data are the same length/
                    );
                });

                it('should return the data unchanged if it is already in the desired shape', function () {
                    const source = new BaseSource({});
                    const data = [{ a: 1, b: 3 }, { a: 2, b: 4 }];
                    const res = source.normalizeResponse(data);
                    assert.deepEqual(res, data);
                });
            });

            describe('Source.annotateData', function () {
                it('should be able to add fields to the returned records', function () {
                    const custom_class = class extends BaseSource {
                        annotateData(records) {
                            // Custom hook that adds a field to every parsed record
                            return records.map(function (item) {
                                item.force = true;
                                return item;
                            });
                        }
                    };

                    // Async test depends on promise
                    return new custom_class({}).parseResponse([{ a: 1, b: 1 }, {
                        a: 2,
                        b: 2
                    }], {}, ['a', 'b', 'force'], ['a', 'b', 'force'], []).then(function (records) {
                        records.body.forEach(function (item) {
                            assert.ok(item.force, 'Record should have an additional key not in raw server payload');
                        });
                    });
                });

                it('should be able to annotate based on info in the body and chain', function () {
                    const custom_class = class extends BaseSource {
                        annotateData(records, chain) {
                            return records + chain.header.param;
                        }
                    };
                    const result = new custom_class({}).annotateData(
                        'some data',
                        { header: { param: ' up the chain' } }
                    );
                    assert.equal(result, 'some data up the chain');
                });
            });

            describe('Source.extractFields', function () {
                it('extracts the specified fields from each record', function () {
                    const source = new BaseSource({});
                    const res = source.extractFields(
                        [{ 'id': 1, 'val': 5 }, { 'id': 2, 'val': 10 }],
                        ['id'], ['namespace:id'], [null]
                    );
                    assert.deepEqual(res, [{ 'namespace:id': 1 }, { 'namespace:id': 2 }]);
                });

                it('applies value transformations where appropriate', function () {
                    const source = new BaseSource({});
                    const res = source.extractFields(
                        [{ 'id': 1, 'val': 5 }, { 'id': 2, 'val': 10 }],
                        ['id', 'val'], ['namespace:id|add1', 'bork:bork'], [function (val) {
                            return val + 1;
                        }, null]
                    );
                    // Output fields can be mapped to any arbitrary based on the field->outnames provided
                    assert.deepEqual(res, [{ 'namespace:id|add1': 2, 'bork:bork': 5 }, {
                        'namespace:id|add1': 3,
                        'bork:bork': 10
                    }]);
                });

                it('throws an error when requesting a field not present in at least one record', function () {
                    const source = new BaseSource({});

                    assert.throws(function () {
                        source.extractFields(
                            [{ 'a': 1 }, { 'a': 2 }],
                            ['b'], ['namespace:b'], [null]
                        );
                    }, /field b not found in response for namespace:b/);
                });
            });

            describe('Source.combineChainBody', function () {
                it('returns only the body by default', function () {
                    const source = new BaseSource({});

                    const expectedBody = [{ 'namespace:a': 1 }];
                    const res = source.combineChainBody(expectedBody, { header: {}, body: [], discrete: {} });

                    assert.deepEqual(res, expectedBody);
                });

                it('can build a body based on records from all sources in the chain', function () {
                    const custom_class = class extends BaseSource {
                        combineChainBody(records, chain) {
                            return records.map(function (item, index) {
                                return Object.assign({}, item, chain.body[index]);
                            });
                        }
                    };
                    const source = new custom_class({});

                    var records = [{ 'namespace:a': 1 }];
                    const res = source.combineChainBody(records, {
                        header: {},
                        body: [{ 'namespace:b': 2 }],
                        discrete: {}
                    });

                    assert.deepEqual(res, [{ 'namespace:a': 1, 'namespace:b': 2 }]);
                });
            });

            describe('integration of steps', function () {
                it('should interpret a string response as JSON', function () {
                    const source = new BaseSource({});

                    return source.parseResponse('{"a_field": ["val"]}', {}, ['a_field'], ['namespace:a_field'], [null])
                        .then(function (chain) {
                            assert.deepEqual(chain.body, [{ 'namespace:a_field': 'val' }]);
                        });
                });

                it('should store annotations in body and chain.discrete where appropriate', function () {
                    const custom_class = class CustomClass extends BaseSource {
                        annotateData(data) {
                            return data + ' with annotation';
                        }

                        normalizeResponse(data) {
                            return data;
                        }

                        extractFields(data) {
                            return data;
                        }
                    };

                    const result = new custom_class({}).parseResponse({ data: 'a response' }, {});
                    return result.then(function (chain) {
                        assert.deepEqual(chain.discrete, { CustomClass: 'a response with annotation' }, 'Discrete response uses annotations');
                        assert.deepEqual(chain.body, 'a response with annotation', 'Combined body uses annotations');
                    });
                });

                it('integrates all methods via promise semantics', function () {
                    // Returning a promise is optional, but should be supported if a custom subclass chooses to do so
                    const custom_class = class CustomClass extends BaseSource {
                        normalizeResponse() {
                            return Promise.resolve([{ a: 1 }]);
                        }

                        annotateData(records) {
                            return Promise.resolve(records.map(function (item) {
                                item.b = item.a + 1;
                                return item;
                            }));
                        }

                        extractFields(data, fields, outnames, trans) {
                            const rec = data.map(function (item) {
                                return { 'bfield': item.b };
                            });
                            return Promise.resolve(rec);
                        }

                        combineChainBody(records) {
                            return Promise.resolve(records);
                        }
                    };

                    const result = new custom_class({}).parseResponse({}, {});
                    const thisBody = [{ bfield: 2 }];
                    const expected = { header: {}, discrete: { CustomClass: thisBody }, body: thisBody };
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
            const source = new AssociationSourceLZ({
                url: 'locuszoom.org', params: { sort: true }
            });

            const sampleData = { position: [2, 1] };
            const expectedData = [{ 'position': 1 }, { 'position': 2 }];

            return source.parseResponse(sampleData, {}, ['position'], ['position'], [null])
                .then(function (resp) {
                    assert.deepEqual(resp.body, expectedData, 'Results are sorted by position');
                });
        });
        it('usually returns normalized data in the order the data was provided', function () {
            const source = new AssociationSourceLZ({
                url: 'locuszoom.org', params: {}
            });
            const sampleData = { position: [2, 1] };
            const expectedData = [{ 'position': 2 }, { 'position': 1 }];

            return source.parseResponse(sampleData, {}, ['position'], ['position'], [null])
                .then(function (resp) {
                    assert.deepEqual(resp.body, expectedData, 'Order of results matches server response');
                });
        });
    });

    describe('Genome build support in annotations', function () {
        // Run the same tests on two sources
        [GeneLZ, RecombLZ].forEach(function (source_type) {
            const source_name = source_type.name;

            it('accepts either build or source as config option, but not both', function () {
                let source = new source_type({ url: 'www.fake.test', params: { source: 'a', build: 'GRCh37' } });
                assert.throws(function () {
                    source.getURL({});
                }, /must provide a parameter specifying either/, 'Bad configuration should raise an exception in ' + source_type);

                source = new source_type({ url: 'www.fake.test', params: { source: 'a' } });
                assert.ok(source.getURL({}), 'Works when specifying source ID for ' + source_name);

                source = new source_type({ url: 'www.fake.test' });
                assert.ok(source.getURL({ genome_build: 'GRCh37' }), 'Works when specifying build name for ' + source_name);
            });

            it('gives precedence to state.genome_build over its own config', function () {
                const source = new source_type({ url: 'www.fake.test', params: { build: 'GRCh37' } });
                const url = source.getURL({ genome_build: 'GRCh38' });

                // HACK: This is the only part of these tests that differs between sources
                let pattern;
                if (source_name === 'GeneLZ') {
                    pattern = /source in 1/;
                } else {
                    pattern = /id in 16/;
                }
                assert.ok(url.match(pattern), source_name + ' produced formed URL: ' + url);
            });

            it('validates genome build', function () {
                const source = new source_type({ url: 'www.fake.test', params: { build: 99 } });
                assert.throws(function () {
                    source.getURL({});
                }, /must specify a valid genome build number/, 'Should validate options for ' + source_name);
            });
        });
    });

    describe('GwasCatalog Source', function () {
        beforeEach(function () {
            this.exampleData = [
                { 'chrom': 1, 'pos': 3, 'log_pvalue': 1.3, 'rsid': 'rs3', 'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 4, 'log_pvalue': 1.4, 'rsid': 'rs4', 'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 5, 'log_pvalue': 1.5, 'rsid': 'rs5', 'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 6, 'log_pvalue': 1.6, 'rsid': 'rs6', 'trait': 'arithomania' },
            ];
            this.sampleChain = {
                body: [
                    { 'assoc:chromosome': 1, 'assoc:position': 2 },
                    { 'assoc:chromosome': 1, 'assoc:position': 4 },
                    { 'assoc:chromosome': 1, 'assoc:position': 6 },
                ],
            };
        });

        it('will respect a specific source ID over the global build param', function () {
            const source = new GwasCatalogLZ({ url: 'www.fake.test', params: { source: 'fjord' } });
            const url = source.getURL({ genome_build: 'GRCh37' });
            assert.ok(url.match('fjord'));
        });

        it('aligns records based on loose position match', function () {
            const source = new GwasCatalogLZ({ url: 'www.fake.test', params: { match_type: 'loose' } });
            const res = source.combineChainBody(this.exampleData, this.sampleChain, ['rsid', 'trait'], ['catalog:rsid', 'catalog:trait']);
            assert.deepEqual(res, [
                { 'assoc:chromosome': 1, 'assoc:position': 2 },  // No annotations available for this point
                {
                    'assoc:chromosome': 1,
                    'assoc:position': 4,
                    'catalog:rsid': 'rs4',
                    'catalog:trait': 'arithomania',
                    'n_catalog_matches': 1
                },
                {
                    'assoc:chromosome': 1,
                    'assoc:position': 6,
                    'catalog:rsid': 'rs6',
                    'catalog:trait': 'arithomania',
                    'n_catalog_matches': 1
                },
            ]);
        });

        it('handles the case where the same SNP has more than one catalog entry', function () {
            const source = new GwasCatalogLZ({ url: 'www.fake.test' });
            const exampleData = [
                { 'chrom': 1, 'pos': 4, 'log_pvalue': 1.40, 'rsid': 'rs4', 'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 4, 'log_pvalue': 1.41, 'rsid': 'rs4', 'trait': 'graphomania' },
                { 'chrom': 1, 'pos': 6, 'log_pvalue': 1.61, 'rsid': 'rs6', 'trait': 'arithomania' },
                { 'chrom': 1, 'pos': 6, 'log_pvalue': 1.60, 'rsid': 'rs6', 'trait': 'graphomania' },
            ];
            const res = source.combineChainBody(exampleData, this.sampleChain, ['log_pvalue'], ['catalog:log_pvalue']);
            assert.deepEqual(res, [
                { 'assoc:chromosome': 1, 'assoc:position': 2 },  // No annotations available for this point
                { 'assoc:chromosome': 1, 'assoc:position': 4, 'catalog:log_pvalue': 1.41, 'n_catalog_matches': 2 },
                { 'assoc:chromosome': 1, 'assoc:position': 6, 'catalog:log_pvalue': 1.61, 'n_catalog_matches': 2 },
            ]);
        });

        it('gracefully handles no catalog entries in region', function () {
            const source = new GwasCatalogLZ({ url: 'www.fake.test', params: { match_type: 'loose' } });
            const res = source.combineChainBody([], this.sampleChain, ['rsid', 'trait'], ['catalog:rsid', 'catalog:trait']);
            assert.deepEqual(res, [
                { 'assoc:chromosome': 1, 'assoc:position': 2 },
                { 'assoc:chromosome': 1, 'assoc:position': 4 },
                { 'assoc:chromosome': 1, 'assoc:position': 6 },
            ]);
        });
    });

    describe('LDLZ2 Source', function () {
        it('validates the selected build name', function () {
            const source = new LDLZ({ url: 'www.fake.test', params: { build: 99 } });
            assert.throws(function () {
                source.getURL({});
            }, /must specify a valid genome build number/);
        });

        it('will prefer a refvar in plot.state if one is provided', function () {
            const source = new LDLZ({ url: 'www.fake.test', params: { build: 'GRCh37' } });
            const ref = source.getRefvar(
                { ldrefvar: 'Something' },
                { header: {}, body: [{ id: 'a', pvalue: 0 }] },
                ['ldrefvar', 'state']
            );
            assert.equal(ref, 'Something');
        });

        it('auto-selects the best reference variant (lowest pvalue)', function () {
            const source = new LDLZ({ url: 'www.fake.test', params: { build: 'GRCh37' } });
            const ref = source.getRefvar(
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
            const source = new LDLZ({ url: 'www.fake.test', params: { build: 'GRCh37' } });
            const ref = source.getRefvar(
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

        it('correctly identifies the variant-marker field', function () {
            //
            const source_default = new LDLZ({ url: 'www.fake.test', params: { build: 'GRCh37' } });
            let dataFields = source_default.findMergeFields(
                { body: [{ 'assoc:id': 'a', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, 'assoc:id', 'Uses a default option (ID)');

            dataFields = source_default.findMergeFields(
                { body: [{ 'assoc:variant': 'a', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, 'assoc:variant', 'Uses a default option (variant name)');

            const source_options = new LDLZ({
                url: 'www.fake.test',
                params: { build: 'GRCh37', id_field: 'marker' }
            });
            dataFields = source_options.findMergeFields(
                { body: [{ 'assoc:id': 'a', 'assoc:marker': 'b', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, 'assoc:marker', 'Uses a provided option (from params.id_field)');

            dataFields = source_options.findMergeFields(
                { body: [{ 'assoc:onefish': 'a', 'assoc:twofish': 'b', log_pvalue: 10 }] }
            );
            assert.equal(dataFields.id, null, 'There is no field matching the requested ID field');
        });

        it('coerces variant formats to one expected by the LD server', function () {
            const source = new LDLZ({ url: 'www.fake.test', params: { build: 'GRCh37' } });

            const portal_format = '8:117974679:G:A';
            const ldserver_format = '8:117974679_G/A';
            const request_url = source.getURL({ ldrefvar: portal_format }, {
                header: {},
                body: []
            }, ['isrefvar', 'state']);
            assert.equal(
                request_url,
                source.getURL({ ldrefvar: ldserver_format }, { header: {}, body: [] }, ['isrefvar', 'state'])
            );
            assert.ok(request_url.includes(encodeURIComponent(ldserver_format)));
        });
    });

    describe('Static Data Source', function () {
        beforeEach(function () {
            this.data = [
                { x: 0, y: 3, z: 8 },
                { x: 2, y: 7, h: 5 },
                { x: 8, y: 1, q: 6 }
            ];
            this.source = new StaticSource(this.data);
        });
        it('should store data passed to the constructor', function () {
            assert.deepEqual(this.source._data, this.data);
        });
        it('should pass only specifically requested fields and respect namespacing', function () {
            return this.source.getData({}, ['x'], ['test:x'], [null])({
                header: {},
                body: [],
                discrete: {}
            }).then(data => {
                const expected_data = [{ 'test:x': 0 }, { 'test:x': 2 }, { 'test:x': 8 }];
                assert.hasAllKeys(data, ['header', 'body', 'discrete']);
                assert.deepEqual(data.body, expected_data);
            });
        });
        it('should pass only specifically requested ', function () {
            return this.source.getData({}, ['q'], ['test:q'], [null])({
                header: {},
                body: [],
                discrete: {}
            }).then(data => {
                const expected_data = [{ 'test:q': undefined }, { 'test:q': undefined }, { 'test:q': 6 }];
                assert.deepEqual(data.body, expected_data);
            });
        });
    });

    describe.skip('LocusZoom Data.ConnectorSource', function () {
        beforeEach(function () {
            // Create a source that internally looks for data as "first" from the specified
            this.basic_config = { sources: { first: 'a_source', second: 'b_source' } };
            this.basic_source = class test_connector extends ConnectorSource {
                combineChainBody(records, chain) {
                    // A sample method that uses 2 chain sources + an existing body to build an combined response

                    // Tell the internal method how to find the actual data it relies on internally, regardless of how
                    //   it is called in the namespaced data chain
                    const nameFirst = this._source_name_mapping['first'];
                    const nameSecond = this._source_name_mapping['second'];

                    records.forEach(function (item) {
                        item.a = chain.discrete[nameFirst].a_field;
                        item.b = chain.discrete[nameSecond].b_field;
                    });
                    return records;
                }
            };
        });

        afterEach(function () {
            sinon.restore();
        });

        it('must specify the data it requires from other sources', function () {
            const source = class extends ConnectorSource {
            };
            assert.throws(
                function () {
                    new source();
                },
                /Connectors must specify the data they require as init.sources = {internal_name: chain_source_id}} pairs/
            );
            assert.ok(
                new source(this.basic_config),
                'Correctly specifies the namespaces containing data that this connector relies on'
            );
        });
        it('must implement a combineChainBody method', function () {
            const source = class extends ConnectorSource {
            };
            assert.throws(
                () => {
                    new source(this.basic_config).combineChainBody();
                },
                /This method must be implemented in a subclass/
            );
        });
        it('should fail if the namespaces it relies on are not present in the chain', function () {
            const instance = new this.basic_source(this.basic_config);
            assert.throws(
                function () {
                    instance.getRequest({}, { discrete: {} });
                },
                /test_connector cannot be used before loading required data for: a_source/
            );
        });
        it('should not make any network requests', function () {
            const instance = new this.basic_source(this.basic_config);
            const fetchSpy = sinon.stub(instance, 'fetchRequest');

            return instance.getRequest({}, { discrete: { a_source: 1, b_source: 2 } })
                .then(function () {
                    assert.ok(fetchSpy.notCalled, 'No network request was fired');
                });
        });
        it('should not return any new data from getRequest', function () {
            const instance = new this.basic_source(this.basic_config);
            const expectedBody = { sample: 'response data' };
            return instance.getRequest({}, { discrete: { a_source: 1, b_source: 2 }, body: expectedBody })
                .then(function (records) {
                    assert.deepEqual(records, expectedBody, 'Should return the previous body');
                });
        });
        it('should build a response by combining data from multiple places', function () {
            // Should have access to data in both chain.discrete and chain.body. (connectors don't have their own data)
            // Not every source in chain.discrete has to be an array of records- this tests arbitrary blobs of JSON
            const rawChain = { a_source: { a_field: 'aaa' }, b_source: { b_field: 'bbb' } };
            const expectedBody = [{ who: 1, a: 'aaa', b: 'bbb' }, { what: 2, a: 'aaa', b: 'bbb' }];

            const instance = new this.basic_source(this.basic_config);
            return instance.getData()(
                {
                    discrete: rawChain,
                    body: [{ who: 1 }, { what: 2 }]
                }
            ).then(function (response) {
                assert.deepEqual(response.body, expectedBody, 'Response body was correctly annotated');
                assert.deepEqual(response.discrete, rawChain, 'The chain of individual sources was not changed');
            });
        });
    });
});

