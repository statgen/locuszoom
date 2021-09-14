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
                    assert.equal(res, 6);
                });
        });
    });
});
