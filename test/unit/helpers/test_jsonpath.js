import {assert} from 'chai';

import { query } from '../../../esm/helpers/jsonpath';

describe('jsonpath query syntax', function () {
    const sample_data = {
        id: 'sample',
        width: 800,
        panels: [
            {
                id: 'a',
                data_layers: [{id: 'a1', type: 'scatter'}],
            },
            {
                id: 'b',
                data_layers: [{id: 'b1', type: 'scatter'}],
            },
        ],
    };

    it('can query direct child keys by exact match', function () {
        const actual = query(sample_data, '$.panels');
        assert.deepEqual(actual, [sample_data.panels]);
    });

    it('can query direct child keys by wildcard selector', function () {
        const actual = query(sample_data, '$.*');
        assert.sameDeepMembers(actual, [...Object.values(sample_data)]);
    });

    it('can query child keys at any level of recursion', function () {
        const actual = query(sample_data, '$..id');
        assert.sameDeepMembers(actual, ['sample', 'a', 'a1', 'b', 'b1']);
    });

    it('can recursively both objects and array elements', function () {
        const actual = query(sample_data, '$..panels..data_layers..id');
        assert.sameDeepMembers(actual, ['a1', 'b1']);
    });

    it('can query array items based on a filter expression', function () {
        let actual = query(sample_data, '$.panels[?(@.id=== "b")]');  // deliberately uneven spacing around operator
        assert.sameDeepMembers(actual, [sample_data.panels[1]]);

        // Also allows filter expressions to use single or double-quoted strings
        actual = query(sample_data, "$.panels[?(@.id=== 'b')]");  // deliberately uneven spacing around operator
        assert.sameDeepMembers(actual, [sample_data.panels[1]], 'Works with single quoted strings');
    });

    it('does not accept arbitrary JS expressions', function () {
        assert.throws(
            () => query(sample_data, '$.panels[@.id !== "a" && @.id === "b"]'),
            /Cannot parse/,
            'Warns on expression'
        );
    });

    it('does not accept numeric array indices', function () {
        assert.throws(
            () => query(sample_data, '$.panels[1]'),
            /Cannot parse/,
            "Numeric indices are not allowed, because the whole point of this syntax is to write queries that won't break if the order of panels changes later"
        );
    });
});
