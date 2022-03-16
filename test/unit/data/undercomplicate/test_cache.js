import {assert} from 'chai';

import {LRUCache} from '../../../../esm/data/undercomplicate';

describe('LRU cache', function () {
    it('restricts max size by evicting old items', function () {
        const cache = new LRUCache(3);
        ['a', 'b', 'c', 'd', 'e'].forEach((item, index) => cache.add(item, index));

        assert.equal(cache._cur_size, 3, 'Wrong number of cache entries');
        assert.sameOrderedMembers([...cache._store.keys()], ['c', 'd', 'e'], 'Incorrect cache members');
    });

    it('does not cache if max size is 0', function () {
        const cache = new LRUCache(0);
        ['a', 'b', 'c', 'd', 'e'].forEach((item, index) => cache.add(item, index));

        assert.equal(cache._cur_size, 0, 'No items cached');
        assert.isNull(cache._head, 'No head node');
        assert.isNull(cache._tail, 'No tail node');
    });

    it('does not support "negative number for infinite cache"', function () {
        assert.throws(
            () => new LRUCache(-12),
            /must be >= 0/,
        );
    });

    it('promotes cache entries by most recently read', function () {
        const cache = new LRUCache(3);
        ['a', 'b', 'c', 'a'].forEach((item, index) => cache.add(item, index));

        assert.equal(cache._cur_size, 3, 'Wrong number of cache entries');
        assert.equal(cache._head.key, 'a', 'Last item accessed is at head');
        assert.equal(cache._tail.key, 'b', 'LRU is at tail');

        cache.get('b');
        assert.equal(cache._head.key, 'b', 'Accessing another item updates head');

        cache.get('nothing');
        assert.equal(cache._head.key, 'b', 'Uncached values will not affect the LRU order');
    });

    it('can remove an item by key name', function () {
        const cache = new LRUCache(3);
        cache.add('some_key', 12);

        let result = cache.remove('some_key');
        assert.ok(result, 'Removing a known item returns true');
        assert.equal(cache._cur_size, 0, 'Item removed from cache');

        result = cache.remove('never_there');
        assert.notOk(result, 'Removing unknown item returns false');
        assert.equal(cache._cur_size, 0, 'Cache still has zero items');

    });

    it('stores metadata along with cache entries', function () {
        const cache = new LRUCache(3);

        const meta = {chr: '1', start: 1, end: 100};
        cache.add('something', 12, meta);

        assert.deepEqual(cache._head.metadata, meta);
    });

    it('can search for an item', function () {
        const cache = new LRUCache(3);

        cache.add('akey', 12, {chr: '2', start: 15, end: 30});
        cache.add('bkey', 18, {chr: '1', start: 10, end: 20});

        let found = cache.find((node) => node.value < 10);
        assert.equal(found, null, 'Return null when no match found');

        found = cache.find((node) => node.value > 10);
        assert.equal(found.key, 'bkey', 'Return the first match (ordered by most newest cache entry)');

        found = cache.find(({ metadata}) => metadata.chr === '2' && 16 >= metadata.start &&  18 <= metadata.end);
        assert.deepEqual(found.key, 'akey', 'A more interesting example: region overlap tested via metadata');
    });
});
