/**
 LocusZoom.js Data Test Suite
 Test LocusZoom Data retrieval functionality
 */
import { assert } from 'chai';

import {
    BaseAdapter,
    BaseApiAdapter,
    BaseLZAdapter,
    BaseUMAdapter,
    GeneLZ,
    LDServer,
    RecombLZ,
    StaticSource,
} from '../../../esm/data/adapters';


describe('Data adapters', function () {
    describe('BaseAdapter (removed)', function () {
        it('warns when trying to create instance of (removed) old style adapters', function () {
            assert.throws(
                () => new BaseAdapter({}),
                /have been replaced/
            );
            assert.throws(
                () => new BaseApiAdapter({}),
                /have been replaced/
            );
        });
    });

    describe('BaseLZAdapter', function () {

        class BaseTestClass extends BaseLZAdapter {
            _performRequest(options) {
                // For fixture purposes, just return some data passed in. Can use this to forcibly test cache hit/miss..
                return options._test_data;
            }
        }

        it('will merge options nested in config.params into the base options for backwards compat', function () {
            const source = new BaseTestClass({ a: 1, params: {b: 2, c: 3, a: 4}});
            assert.deepEqual(source._config, {b: 2, c: 3, a: 4}, 'Options in config.params will be merged, and original .params child will be deleted');
        });

        it('checks if request can be satisfied using cached data', function () {
            const source = new BaseTestClass({ prefix_namespace: false });
            const first_test_data = [{a: 1, b:2}];
            const different_if_cache_hit = [{a: 1, b:2}];
            return source.getData({ chr: '1', start: 100, end: 200, _test_data: first_test_data })
                .then((result) => {
                    assert.deepEqual(result, first_test_data, 'First request received data passed in');
                    return source.getData({ chr: '1', start: 125, end: 175, _test_data: different_if_cache_hit });
                })
                .then((result) => {
                    assert.deepEqual(result, first_test_data, 'Second request receives cache data for a region that is superset');
                    return source.getData({ chr: '1', start: 120, end: 180, _test_data: different_if_cache_hit });
                }).then((result) => {
                    assert.deepEqual(result, first_test_data, 'A third request shows that the cache is still based on the widest possible region (first request)');
                    return source.getData({ chr: '2', start: 120, end: 180, _test_data: different_if_cache_hit });
                }).then((result) => assert.deepEqual(result, different_if_cache_hit, 'Diff region, so not a cache hit'));
        });

        it('prefixes responses with the name of the provider', function () {
            const source = new BaseTestClass({});
            return source.getData({
                _provider_name: 'sometest',
                _test_data: [{ a: 1, b: 2 }]}
            ).then((result) => assert.deepEqual(result, [{'sometest:a': 1, 'sometest:b': 2}]));
        });

        it('can optionally restrict final payload to a preset list of fields', function () {
            const source = new BaseTestClass({ limit_fields: ['b'] });
            return source.getData({
                _provider_name: 'sometest',
                _test_data: [{ a: 1, b: 2 }]}
            ).then((result) => assert.deepEqual(result, [{ 'sometest:b': 2}]));
        });

        it('has a helper to locate dependent fields that were already namespaced', function () {
            const source = new BaseTestClass({});
            const match = source._findPrefixedKey({'sometest:aaa': 1, 'sometest:a': 2, 'sometest:aa': 3}, 'a');

            assert.equal(match, 'sometest:a', 'Found correct key and ignored partial suffixes');

            assert.throws(
                () => source._findPrefixedKey([{'sometest:aaa': 1 }], 'no_such_key'),
                /Could not locate/,
                'Pedantically insists that data match the expected contract'
            );
        });
    });

    describe('BaseUMAdapter', function () {
        it('normalizes column-based API responses to rows', function () {
            const adapter = new BaseUMAdapter({ prefix_namespace: false });
            const result = adapter._normalizeResponse({a: [1], b: [2], c: [3]});
            assert.deepEqual(result, [{ a: 1, b: 2, c: 3 }]);
        });

        it('does not try to normalize responses that are already an array', function () {
            const adapter = new BaseUMAdapter({ prefix_namespace: false });
            const data = [{ a: 1, b: 2, c: 3 }];
            const result = adapter._normalizeResponse(data);

            result[0].d = 4; // Mutable reference only works if data is returned as is instead of being reassembled
            assert.deepEqual(result, data, 'Data returned as is');
        });

        it('warns if trying to normalize a response with arrays of different lengths', function () {
            const adapter = new BaseUMAdapter({ prefix_namespace: false });
            assert.throws(
                () => adapter._normalizeResponse({ a: [1, 2], b: [3] }),
                /same length/
            );
        });
    });

    describe('Genome build support in annotations', function () {
        // Run the same tests on two sources
        [GeneLZ, RecombLZ].forEach(function (source_type) {
            const source_name = source_type.name;

            it('accepts either build or source as config option, but not both', function () {
                let source = new source_type({ url: 'www.fake.test', source: 'a', build: 'GRCh37' });
                assert.throws(function () {
                    source._getURL({});
                }, /must provide a parameter specifying either/, `Bad configuration should raise an exception in ${source_type}`);

                source = new source_type({ url: 'www.fake.test', source: 'a' });
                let url = source._getURL({});
                assert.ok(url.match(/ in a/), `Works when specifying source ID for ${source_name}`);

                source = new source_type({ url: 'www.fake.test' });
                url = source._getURL({ genome_build: 'GRCh37' });
                assert.ok(url.match(/GRCh37/), `Works when specifying build name for ${source_name}`);
            });

            it('gives precedence to state.genome_build over its own config', function () {
                const source = new source_type({ url: 'www.fake.test', build: 'GRCh37' });
                const url = source._getURL({ genome_build: 'GRCh38' });

                let pattern = /build=GRCh38/;
                assert.ok(url.match(pattern), `${source_name} produced formed URL: ${url}`);
            });

            it('validates genome build', function () {
                const source = new source_type({ url: 'www.fake.test', build: 99 });
                assert.throws(function () {
                    source._getURL({});
                }, /must specify a valid 'genome_build'/, `Should validate options for ${source_name}`);
            });
        });
    });

    describe('StaticSource', function () {
        it('warns if the `data` key is missing', function () {
            assert.throws(
                () => new StaticSource([]),
                /required option/
            );
            assert.throws(
                () => new StaticSource({}),
                /required option/
            );
        });

        it('Returns the exact data provided by the user, regardless of region', function () {
            const data = { a: 1, b: 2, c: 3 };
            const source = new StaticSource({ data });
            return source.getData({ chr: 1, start: 2, end: 3})
                .then((result) => {
                    assert.deepEqual(data, result, 'Returns hard-coded data');
                    // Deliberately mutate data, then refetch to ensure that mutations on one request don't pollute shared cache.
                    data.d = 4;
                    return source.getData({ chr: 'X', start: 500, end: 1000});
                })
                .then((result) => assert.deepEqual(data, result, 'Returns hard-coded data'));
        });
    });

    describe('LDServer', function () {
        beforeEach(function () {
            this._assoc_data = [
                // Deliberately use several variant formats to verify normalization
                { 'assoc:variant': '1:23_A/C', 'assoc:log_pvalue': 0.2 },
                { 'assoc:variant': '1:24:A:C', 'assoc:log_pvalue': 125 },
                { 'assoc:variant': '1-25-A-C', 'assoc:log_pvalue': 72 },
            ];
        });

        it('finds the best variant if none is provided', function () {
            const provider = new LDServer({});
            const refvar = provider.__find_ld_refvar({}, this._assoc_data);
            assert.equal(refvar, '1:24_A/C', 'Finds variant with max log_pvalue and normalizes spec');
            assert.equal(this._assoc_data[1].lz_is_ld_refvar, true, 'Annotates refvar (best match)');
        });

        it('prefers a refvar from plot.state if one is provided', function () {
            const provider = new LDServer({});
            const refvar = provider.__find_ld_refvar({ ldrefvar: '1-25-A-C' }, this._assoc_data);
            assert.equal(refvar, '1:25_A/C', 'Uses refvar in plot.state and normalizes spec');
            assert.equal(this._assoc_data[2].lz_is_ld_refvar, true, 'Annotates refvar (requested variant)');
        });

        it('ignores state.ldrefvar if it refers to a region outside the current view window', function () {
            const provider = new LDServer({});
            const refvar = provider.__find_ld_refvar({ chr: 'X', start: 100, end: 200, ldrefvar: 'X-99-A-C' }, this._assoc_data);
            assert.equal(refvar, '1:24_A/C', 'Ignores state.ldrefvar because out of range; chooses best refvar instead');
            assert.equal(this._assoc_data[1].lz_is_ld_refvar, true, 'Annotates refvar (best match)');
        });

        it('skips the request if no assoc data was present', function () {
            const source37 = new LDServer({ url: 'www.fake.test', source: '1000G', build: 'GRCh37' });

            let request_options = source37._buildRequestOptions({ ldrefvar: '1:2_A/B' }, []);
            assert.ok(request_options._skip_request, 'Request is flagged to skip');

            assert.throws(
                () => source37._buildRequestOptions({ ldrefvar: '1:2_A/B' }, null),
                /must depend on/,
                'Warns if the adapter is totally misused (not part of a dependency chain)'
            );

            assert.throws(
                () => source37._buildRequestOptions({ ldrefvar: '1:2_A/B' }, [{ some_other_data: true, meets_assoc_contract: false }]),
                /required key name/,
                'Warns if the adapter is totally misused (not given association data)'
            );

        });

        it('chooses best 1000G panel for the given build', function () {
            const source37 = new LDServer({ url: 'www.fake.test', source: '1000G', build: 'GRCh37' });
            let request_options = source37._buildRequestOptions({ ldrefvar: '1:2_A/B' }, this._assoc_data);
            assert.equal(request_options.genome_build, 'GRCh37', 'Build 37 detected');
            assert.equal(request_options.ld_source, '1000G', 'Build 37 uses 1000G panel (old)');

            const source38 = new LDServer({ url: 'www.fake.test', source: '1000G', build: 'GRCh38' });
            request_options = source38._buildRequestOptions({ ldrefvar: '1:2_A/B' }, this._assoc_data);

            assert.equal(request_options.genome_build, 'GRCh38', 'Build 38 detected');
            assert.equal(request_options.ld_source, '1000G-FRZ09', 'Build 38 uses 1000G panel (upgraded)');
        });

        it('validates the selected build name', function () {
            const source = new LDServer({ url: 'www.fake.test', build: 99 });
            assert.throws(() => {
                source._buildRequestOptions({}, this._assoc_data);
            }, /must specify a valid 'genome_build'/);
        });
    });
});
