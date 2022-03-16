import {assert} from 'chai';

import {_parse_declaration, getLinkedData} from '../../../../esm/data/undercomplicate/requests';


class SequenceFixture {
    getData(options, ...prior) {
        return prior.reduce((acc, val) => (acc += val), 1);
    }
}

describe('Request helpers', function () {
    describe('Dependency parsing syntax', function () {
        it('parses requests with and without dependencies', function () {
            let result = _parse_declaration('record');
            assert.deepEqual(result, ['record', []]);

            result = _parse_declaration('record(a)');
            assert.deepEqual(result, ['record', ['a']]);

            result = _parse_declaration('record(a, b)');
            assert.deepEqual(result, ['record', ['a', 'b']]);

            result = _parse_declaration('record_12(a, a1)');
            assert.deepEqual(result, ['record_12', ['a', 'a1']]);
        });

        it('rejects invalid syntax', function () {
            assert.throws(() => _parse_declaration('dependency.name'), /Unable to parse/);

            assert.throws(() => _parse_declaration('one_dep another_thing'), /Unable to parse/);
        });
    });

    describe('getLinkedData', function () {
        it('chains requests together while respecting dependencies', function () {
            const entities = new Map();
            const dependencies = ['a', 'b(a)', 'c(a,b)', 'd(c)'];
            const shared_state = new SequenceFixture();
            ['a', 'b', 'c', 'd']
                .forEach((key) => entities.set(key, shared_state));

            // The last result in the chain, by itself, represents a sum of all prior
            return getLinkedData({}, entities, dependencies)
                .then((result) => assert.equal(result, 5));
        });

        it('chains requests and can return all values', function () {
            const entities = new Map();
            const dependencies = ['a', 'b(a)', 'c(a,b)', 'd(c)'];
            const shared_state = new SequenceFixture();
            ['a', 'b', 'c', 'd']
                .forEach((key) => entities.set(key, shared_state));

            // The last result in the chain, by itself, represents a sum of all prior
            return getLinkedData({}, entities, dependencies, false)
                .then((result) => assert.deepEqual(result, [1, 2, 4, 5]));
        });

        it('warns if spec references a non-existent provider', function () {
            assert.throws(
                () => getLinkedData({}, new Map(), ['a']),
                /no matching source was provided/,
            );
        });

        it('warns if circular dependencies were declared', function () {
            assert.throws(
                () => getLinkedData({}, new Map(), ['a(b)', 'b(a)']),
                /circular dependency/,
            );

            assert.throws(
                () => getLinkedData({}, new Map(), ['a(a)']),
                /circular dependency/,
            );
        });
    });
});
