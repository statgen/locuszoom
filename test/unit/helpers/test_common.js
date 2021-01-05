import {assert} from 'chai';
import {memoize} from '../../../esm/helpers/common';

describe('Simple utility functions', function () {
    describe('memoization decorator', function () {
        it('remembers a function result from a previous call', function () {
            const test_func = memoize((a) => a + 1);

            assert.equal(test_func(11), 12, 'First calculation returns expected value');
            assert.hasAllKeys(test_func._cache, [11], 'Calculation result is cached');

            // To test that we're returning a cached value, we'll reach in and modify the cache
            test_func._cache[11] = 42;
            assert.equal(test_func(11), 42, 'Second calculation uses the cached result');
        });
        it('allows a custom resolver function, because the first argument is not always the best cache key', function () {
            const test_func = memoize(
                (a, b) => a * b,
                (...args) => args[1]
            );

            assert.equal(test_func(1, 2), 2, 'First calculation returns expected value');
            assert.hasAllKeys(test_func._cache, [2], 'Calculation result is cached according to the second argument');

            assert.equal(test_func(1, 3), 3, 'Changing the second argument yields a different result');
            assert.hasAllKeys(test_func._cache, [2, 3], 'Calculation result is cached according to the second argument');
        });
        it('allows setting a max cache size, after which all old keys are evicted', function () {
            const test_func = memoize(
                (a) => a + 1,
                null,
                2
            );

            test_func(1);
            test_func(2);
            assert.hasAllKeys(test_func._cache, [1, 2], 'First two calls are cached');

            test_func(3);
            assert.hasAllKeys(test_func._cache, [3], 'At third call, prior two keys are evicted.');

            test_func(4);
            assert.hasAllKeys(test_func._cache, [3, 4], 'Fourth call is added to cache');
        });
    });
});
