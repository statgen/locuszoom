/**
 * Implement an LRU Cache
 */


class LLNode {
    /**
     * A single node in the linked list. Users will only need to deal with this class if using "approximate match" (`cache.find()`)
     * @memberOf module:undercomplicate
     * @param {string} key
     * @param {*} value
     * @param {object} metadata
     * @param {LLNode} prev
     * @param {LLNode} next
     */
    constructor(key, value, metadata = {}, prev = null, next = null) {
        this.key = key;
        this.value = value;
        this.metadata = metadata;
        this.prev = prev;
        this.next = next;
    }
}

class LRUCache {
    /**
     * Least-recently used cache implementation, with "approximate match" semantics
     * @memberOf module:undercomplicate
     * @param {number} [max_size=3]
     */
    constructor(max_size = 3) {
        this._max_size = max_size;
        this._cur_size = 0; // replace with map.size so we aren't managing manually?
        this._store = new Map();

        // Track LRU state
        this._head = null;
        this._tail = null;

        // Validate options
        if (max_size === null || max_size < 0) {
            throw new Error('Cache "max_size" must be >= 0');
        }
    }

    /**
     * Check key membership without updating LRU
     * @param key
     * @returns {boolean}
     */
    has(key) {
        return this._store.has(key);
    }

    /**
     * Retrieve value from cache (if present) and update LRU cache to say an item was recently used
     * @param key
     * @returns {null|*}
     */
    get(key) {
        const cached = this._store.get(key);
        if (!cached) {
            return null;
        }
        if (this._head !== cached) {
            // Rewrite the cached value to ensure it is head of the list
            this.add(key, cached.value);
        }
        return cached.value;
    }

    /**
     * Add an item. Forcibly replaces the existing cached value for the same key.
     * @param key
     * @param value
     * @param {Object} [metadata={}) Metadata associated with an item. Metadata can be used for lookups (`cache.find`) to test for a cache hit based on non-exact match
     */
    add(key, value, metadata = {}) {
        if (this._max_size === 0) {
            // Don't cache items if cache has 0 size.
            return;
        }

        const prior = this._store.get(key);
        if (prior) {
            this._remove(prior);
        }

        const node = new LLNode(key, value, metadata, null, this._head);

        if (this._head) {
            this._head.prev = node;
        } else {
            this._tail = node;
        }

        this._head = node;
        this._store.set(key, node);

        if (this._max_size >= 0 && this._cur_size >= this._max_size) {
            const old = this._tail;
            this._tail = this._tail.prev;
            this._remove(old);
        }
        this._cur_size += 1;
    }


    // Cache manipulation methods
    clear() {
        this._head = null;
        this._tail = null;
        this._cur_size = 0;
        this._store = new Map();
    }

    // Public method, remove by key
    remove(key) {
        const cached = this._store.get(key);
        if (!cached) {
            return false;
        }
        this._remove(cached);
        return true;
    }

    // Internal implementation, useful when working on list
    _remove(node) {
        if (node.prev !== null) {
            node.prev.next = node.next;
        } else {
            this._head = node.next;
        }

        if (node.next !== null) {
            node.next.prev = node.prev;
        } else {
            this._tail = node.prev;
        }
        this._store.delete(node.key);
        this._cur_size -= 1;
    }

    /**
     * Find a matching item in the cache, or return null. This is useful for "approximate match" semantics,
     *  to check if something qualifies as a cache hit despite not having the exact same key.
     *  (Example: zooming into a region, where the smaller region is a subset of something already cached)
     * @param {function} match_callback A function to be used to test the node as a possible match (returns true or false)
     * @returns {null|LLNode}
     */
    find(match_callback) {
        let node = this._head;
        while (node) {
            const next = node.next;
            if (match_callback(node)) {
                return node;
            }
            node = next;
        }
    }
}

export { LRUCache };
