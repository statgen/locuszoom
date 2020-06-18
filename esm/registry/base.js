/*
 * Base class for all registries
 *
 * LocusZoom is plugin-extensible, and layouts are string-based and JSON serializable. This is achieved through the use
 *  of a central registry that holds a reference to each possible feature.
 *
 * Each registry has some syntactical sugar, with common elements are defined in a base class
 */
class RegistryBase {
    constructor() {
        this._items = new Map();
    }

    /**
     * Return the registry member. If the registry stores classes, this returns the class, not the instance.
     * @param {String} name
     * @returns {Function}
     */
    get(name) {
        if (!this._items.has(name)) {
            throw new Error(`Item not found: ${name}`);
        }
        return this._items.get(name);
    }

    /**
     * Add a new item to the registry
     * @param {String} name The name of the item to add to the registry
     * @param {*} item The item to be added (constructor, value, etc)
     * @param {boolean} override Allow redefining an existing item?
     * @return {*} The actual object as added to the registry
     */
    add(name, item, override = false) {
        if (!override && this._items.has(name)) {
            throw new Error(`Item ${name} is already defined`);
        }
        this._items.set(name, item);
        return item;
    }

    /**
     * Remove a datasource from the registry (if present)
     * @param {String} name
     * @returns {boolean} True if item removed, false if item was never present
     */
    remove(name) {
        return this._items.delete(name);
    }

    /**
     * Check whether the specified item is registered
     * @param {String} name
     * @returns {boolean}
     */
    has(name) {
        return this._items.has(name);
    }

    /**
     * Names of each allowed
     * @returns {String[]}
     */
    list() {
        return Array.from(this._items.keys());
    }
}

/**
 * A specialized registry whose members are class constructors. Contains helper methods for creating instances
 *  and subclasses.
 */
class ClassRegistry extends RegistryBase {
    /**
     * Create an instance of the specified class from the registry
     * @param {String} name
     * @param {*} args Any additional arguments to be passed to the constructor
     * @returns {*}
     */
    create(name, ...args) {
        const base = this.get(name);
        return new base(...args);
    }
}


export default RegistryBase;
export {RegistryBase, ClassRegistry};
