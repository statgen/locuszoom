import {assert} from 'chai';

import Requester, {_JoinTask} from '../../../esm/data/requester';
import {JOINS} from '../../../esm/registry';


describe('Requester object defines and parses requests', function () {
    describe('Layout parsing', function () {
        before(function () {
            JOINS.add('sumtwo', (left, right, some_param) => left + right + some_param);
        });

        after(function () {
            JOINS.remove('sumtwo');
        });

        beforeEach(function () {
            this._all_datasources = new Map([
                ['assoc1', { name: 'assoc1', getData: () => Promise.resolve(1) }],
                ['someld', { name: 'someld', getData: () => Promise.resolve(2) }],
                ['assoc2', { name: 'assoc2' }],
                ['catalog', { name: 'catalog' }],
            ]);
            this._requester = new Requester(this._all_datasources);
        });

        it('builds request data from namespaces and join tasks', function () {
            // Test name logic
            const namespace_options = {'assoc': 'assoc1', 'ld': 'someld'};
            const data_operations = [
                { type: 'fetch', from: ['assoc', 'ld(assoc)'] },
                {
                    type: 'left_match',
                    name: 'combined',
                    requires: ['assoc', 'ld'],
                    params: ['assoc:variant', 'ld:variant'],
                },
            ];

            const [entities, dependencies] = this._requester.config_to_sources(namespace_options, data_operations);

            // Validate names of dependencies are correct
            assert.deepEqual(dependencies, ['assoc', 'ld(assoc)', 'combined(assoc, ld)'], 'Dependencies are resolved in expected order');

            // Validate that correct dependencies were wired up
            assert.deepEqual([...entities.keys()], ['assoc', 'ld', 'combined']);
            assert.deepEqual(entities.get('assoc').name, 'assoc1');
            assert.deepEqual(entities.get('ld').name, 'someld');

            assert.instanceOf(entities.get('combined'), _JoinTask, 'A join task was created');
        });

        it('provides developer friendly error messages', function () {
            // Test parse errors: namespaces malformed
            assert.throws(() => {
                this._requester.config_to_sources({ 'not:allowed': 'whatever' }, []);
            }, /Invalid namespace name: 'not:allowed'/);

            assert.throws(
                () => {
                    this._requester.config_to_sources({ 'somenamespace': 'nowhere' }, []);
                },
                /not found in DataSources/,
                'Namespace references something not registered in datasource'
            );

            // Test duplicate namespace errors: joins
            assert.throws(() => {
                this._requester.config_to_sources(
                    {},
                    [
                        {name: 'combined', type: 'left_match', requires: []},
                        {name: 'combined', type: 'left_match', requires: []},
                    ]
                );
            }, /join name 'combined' must be unique/);

            assert.throws(
                () => {
                    this._requester.config_to_sources(
                        {},
                        [
                            {name: 'combined', type: 'left_match', requires: ['unregistered', 'whatisthis']},
                        ]
                    );
                },
                /cannot operate on unknown provider/
            );

        });

        it('performs joins based on layout spec', function () {
            const namespace_options = {'assoc': 'assoc1', 'ld': 'someld'};
            const data_operations = [
                { type: 'fetch', from: ['assoc', 'ld(assoc)'] },
                {
                    type: 'sumtwo',
                    name: 'combined',
                    requires: ['assoc', 'ld'],
                    params: [3], // tests that params get passed, and can be whatever a join function needs
                },
            ];

            const [entities, dependencies] = this._requester.config_to_sources(namespace_options, data_operations);

            return this._requester.getData({}, entities, dependencies)
                .then((res) => {
                    assert.equal(res, 6);  // 1 + 2 + 3
                });
        });

        it('tries to auto-generate data_operations[@type=fetch] if not provided', function () {
            const namespace_options = { assoc: 'assoc1', catalog: 'catalog', ld: 'someld' };
            let data_operations = []; // no operations, fetch or otherwise

            let [_, dependencies] = this._requester.config_to_sources(namespace_options, data_operations);
            assert.deepEqual(
                data_operations,
                [{type: 'fetch', from: ['assoc', 'catalog', 'ld']}], // autogen doesn't specify dependencies, like ld(assoc)
                'Layout data_ops is mutated in place to reference namespaces (no dependencies assumed when auto-specifying)'
            );

            assert.deepEqual(dependencies, ['assoc', 'catalog', 'ld'], 'Dependencies are auto-guessed from namespaces');

            // Related scenario: no fetch rule defined, but other rules are!
            data_operations = [{ type: 'sumtwo', name: 'somejoin', requires: ['assoc', 'ld'], params: [5] }];
            ([_, dependencies] = this._requester.config_to_sources(namespace_options, data_operations));
            assert.deepEqual(
                data_operations,
                [
                    { type: 'fetch', from: ['assoc', 'catalog', 'ld'] },
                    { type: 'sumtwo', name: 'somejoin', requires: ['assoc', 'ld'], params: [5] },
                ],
                'Auto-generates fetch rules specifically; leaves other data ops untouched'
            );
            assert.deepEqual(dependencies, ['assoc', 'catalog', 'ld', 'somejoin(assoc, ld)'], 'Dependencies are (still) auto-guessed from namespaces');
        });

        it('attempts to reference all namespaces in data_operations[@type=fetch] at least once', function () {
            const namespace_options = {'assoc': 'assoc1', 'catalog': 'catalog'};
            const data_operations = [{ type: 'fetch', from: ['assoc'] }]; // Fetch rules exist, but catalog not referenced! Eg, this could be someone creating a child layout; modifying a nested list is annoying

            const [_, dependencies] = this._requester.config_to_sources(namespace_options, data_operations);
            assert.deepEqual(
                data_operations,
                [{type: 'fetch', from: ['assoc', 'catalog']}],
                'Layout data_ops is mutated in place to reference namespaces (no dependencies assumed when auto-specifying)'
            );
            assert.deepEqual(dependencies, ['assoc', 'catalog'], 'Dependencies take all namespaces into account');
        });

        it('autogenerates names for join operations, if none are provided', function () {
            const namespace_options = { assoc: 'assoc1', catalog: 'catalog' };
            const data_operations = [
                { type: 'fetch', from: ['assoc', 'catalog'] },
                { type: 'sumtwo', name: 'has_name', requires: ['assoc', 'catalog'], params: [] },
                { type: 'sumtwo', requires: ['assoc', 'has_name'], params: [] },
            ];

            const [_, dependencies] = this._requester.config_to_sources(namespace_options, data_operations);
            assert.deepEqual(
                data_operations,
                [
                    { type: 'fetch', from: ['assoc', 'catalog'] },
                    { type: 'sumtwo', name: 'has_name', requires: ['assoc', 'catalog'], params: [] },
                    { type: 'sumtwo', name: 'join0', requires: ['assoc', 'has_name'], params: [] },
                ],
                'Layout data_ops is mutated in place to give a name to any join without one'
            );

            assert.deepEqual(
                dependencies,
                ['assoc', 'catalog', 'has_name(assoc, catalog)', 'join0(assoc, has_name)'],
                'Dependencies reference the auto-generated join names correctly');
        });
    });
});
