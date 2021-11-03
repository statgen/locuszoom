import {assert} from 'chai';

import Requester, {_JoinTask} from '../../../esm/data/requester';
import {DATA_OPS} from '../../../esm/registry';


describe('Requester object defines and parses requests', function () {
    describe('Layout parsing', function () {
        before(function () {
            DATA_OPS.add('sumtwo', (
                {plot_state: { state_field = 0 }},
                [left, right],
                some_param
            ) => left + right + some_param + state_field);
        });

        after(function () {
            DATA_OPS.remove('sumtwo');
        });

        beforeEach(function () {
            this._all_datasources = new Map([
                ['assoc1', { name: 'assoc1', getData: () => Promise.resolve(1) }],
                ['someld', { name: 'someld', getData: () => Promise.resolve(2) }],
                ['intervals', { name: 'intervals', getData: () => Promise.resolve(['a', 'b', 'c', 'd']) }],
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

        it('passes a copy of plot.state to each data op, and can act on the parameters', function () {
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

            return this._requester.getData({ state_field: 20 }, entities, dependencies)
                .then((res) => {
                    assert.equal(res, 26);  // 1 + 2 + 3 + 20
                });
        });

        it('passes a reference to the initiator, allowing it to do things like mutate the data layer layout when data is received', function () {
            const namespace_options = {'intervals': 'intervals'};
            DATA_OPS.add('layer_mutator', ({plot_state, data_layer}, [data]) => {
                // This sort of operation is very special-purpose and tied to the mock layout and changes we want to see!
                data_layer.layout.mock_x_categories = data;
                // An operation must always return data in the end. This usage is pretty esoteric, in that it exits solely to create side effects.
                return data;
            });

            const data_operations = [
                { type: 'fetch', from: ['intervals'] },
                {
                    type: 'layer_mutator',
                    name: 'combined',
                    requires: ['intervals'],
                    params: [3],
                },
            ];

            const mock_layer = {
                layout: {
                    mock_x_categories: [],
                },
            };
            const [entities, dependencies] = this._requester.config_to_sources(namespace_options, data_operations, mock_layer);

            return this._requester.getData({}, entities, dependencies)
                .then((res) => {
                    assert.deepEqual(mock_layer.layout.mock_x_categories, res, 'In this example, mock categories exactly match returned data');
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
