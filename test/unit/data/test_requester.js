import {assert} from 'chai';

import Requester, {_JoinTask} from '../../../esm/data/requester';


describe('Requester object defines and parses requests', function () {
    describe('Layout parsing', function () {
        beforeEach(function () {
            this._all_datasources = new Map([
                ['assoc1', {name: 'assoc1'}],
                ['someld', {name: 'someld'}],
                ['assoc2', {name: 'assoc2'}],
            ]);
            this._requester = new Requester(this._all_datasources);
        });

        it('converts layout configuration entities and dependencies', function () {
            // Test name logic
            const namespace_options = {'assoc': 'assoc1', 'ld(assoc)': 'someld'};
            const join_options = [{
                type: 'left_match',
                name: 'combined',
                requires: ['assoc', 'ld'],
                params: ['assoc.variant', 'ld.variant'],
            }];

            const [entities, dependencies] = this._requester._config_to_sources(namespace_options, join_options);

            // Validate names of dependencies are correct
            assert.deepEqual(dependencies, ['assoc', 'ld', 'combined(assoc, ld)'], 'Dependencies are resolved in expected order');

            // Validate that correct dependencies were wired up
            assert.deepEqual([...entities.keys()], ['assoc', 'ld', 'combined']);
            assert.deepEqual(entities.get('assoc'), {name: 'assoc1'});
            assert.deepEqual(entities.get('ld'), {name: 'someld'});

            assert.instanceOf(entities.get('combined'), _JoinTask, 'A join task was created');
        });

        it('provides developer friendly error messages', function () {
            // Test parse errors: namespaces malformed
            assert.throws(() => {
                this._requester._config_to_sources({ 'not.allowed': 'whatever' }, {});
            }, /Invalid namespace name: 'not\.allowed'/);

            // Test duplicate namespace errors: assoc
            assert.throws(() => {
                this._requester._config_to_sources({ 'assoc': {}, 'assoc(dep)': 'this is weird and not supported' }, []);
            }, /namespace name 'assoc' must be unique/);

            // Test duplicate namespace errors: joins
            assert.throws(() => {
                this._requester._config_to_sources(
                    {},
                    [{name: 'combined', type: 'left_match', requires: []}, {name: 'combined', type: 'left_match', requires: []}]
                );
            }, /join name 'combined' must be unique/);
        });
    });
});
