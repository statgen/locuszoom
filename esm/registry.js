/*
 * Base class for all registries
 *
 * LocusZoom is plugin-extensible, and layouts are string-based and JSON serializable. This is achieved through the use
 *  of a central registry that holds a reference to each possible feature.
 */
class RegistryBase {
    constructor() {
        this._sources = new Map();
    }

    /**
     * Return the registry member. If the registry stores classes, this returns the class, not the instance.
     * @param {String} name
     * @returns {Function}
     */
    get(name) {
        if (!(name in this._sources)) {
            throw new Error(`Could not locate the requested registry item: ${name}`);
        }
        return this._sources.get(name);
    }

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

    add(name, item) {}

    /**
     * Remove a datasource from the registry (if present)
     * @param {String} name
     * @returns {boolean}
     */
    remove(name) {
        return this._sources.delete(name);
    }

    /**
     * Check whether the specified item is registered
     * @param {String} name
     * @returns {boolean}
     */
    has(name) {
        return this._sources.has(name);
    }

    /**
     * Names of each allowed
     * @returns {String[]}
     */
    list() {
        return Array.from(this._sources.keys());
    }
}


/**
 * Create and coordinate an ensemble of (namespaced) data source instances
 * This is the mechanism by which users create data sources for a specific plot, and should be considered part of the
 *  public interface for LocusZoom
 * @public
 */
class DataSources extends RegistryBase {
    /**
     * @param {RegistryBase} [registry] Primarily used for unit testing. When creating sources by name, specify where to
     *  find the registry of known sources.
     */
    constructor(registry) {
        super();
        this._registry = registry;
    }

    /**
     *
     * @param {String} namespace Uniquely identify this datasource
     * @param {Source|Array} item An instantiated datasource, or an array of arguments that can be used to
     *   create a known datasource type.
     */
    add(namespace, item) {
        if (this._sources.has(namespace)) {
            throw new Error(`The namespace ${namespace} is already in use by another source`);
        }

        if (namespace.match(/[^A-Za-z0-9_]/)) {
            throw new Error(`Data source namespace names can contain alphanumeric characters or underscores`);
        }
        if (Array.isArray(item)) {
            const [type, options] = item;
            item = this._registry.create(type, options);
        }
        // Each datasource in the chain should be aware of its assigned namespace
        item.source_id = namespace;

        super.add(name, item);
    }
}

export default RegistryBase;
