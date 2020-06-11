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
     * Create an instance of the specified class from the registry
     * @param {String} name
     * @param {*} args Any additional arguments to be passed to the constructor
     * @returns {*}
     */
    create(name, ...args) {
        // TODO: Some subclasses will use this, but for others it may not make sense or lead to undefined behavior
        const base = this.get(name);
        return new base(...args);
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
 * Create and coordinate an ensemble of (namespaced) data source instances
 * This is the mechanism by which users create data sources for a specific plot, and should be considered part of the
 *  public interface for LocusZoom.
 *
 * This is a standard registry, with some minor syntactical sugar for creating objects from config.
 * @public
 */
class DataSources extends RegistryBase {
    /**
     * @param {RegistryBase} [registry] Primarily used for unit testing. When creating sources by name, specify where to
     *  find the registry of known sources.
     */
    constructor(registry) {
        super();
        if (registry) {
            this._items = registry();
        }
    }

    /**
     * For data sources, there is a special behavior of "create item from config, then add"
     * @param {String} namespace Uniquely identify this datasource
     * @param {BaseSource|Array} item An instantiated datasource, or an array of arguments that can be used to
     *   create a known datasource type.
     * @param [override=false] Whether to allow existing sources to be redefined
     */
    add(namespace, item, override = false) {
        if (this._registry.has(namespace)) {
            throw new Error(`The namespace ${namespace} is already in use by another source`);
        }

        if (namespace.match(/[^A-Za-z0-9_]/)) {
            throw new Error(`Data source namespace names can contain alphanumeric characters or underscores`);
        }
        if (Array.isArray(item)) {
            const [type, options] = item;
            // This *does* break the separation of concerns slightly, but we are explicitly retaining backwards
            // compatibility with the old public interface of LocusZoom.DataSources.
            item = this._registry.create(type, options);
        }
        // Each datasource in the chain should be aware of its assigned namespace
        item.source_id = namespace;

        return super.add(name, item, override);
    }
}

/**
 * Transformation functions that may be applied to template values
 */
class TransformationFunctions extends RegistryBase {
    _collectTransforms(template_string) {
        // Helper function that turns a sequence of function names into a single callable
        const funcs = template_string
            .match(/\|([^|]+)/g)
            .map(item => super.get(item.substring(1)));

        return (value) => {
            return funcs.reduce(
                (acc, func) => func(acc),
                value
            );
        };
    }

    /**
     * In templates, we often use a single concatenated string to ask for several transformation functions at once:
     *  `value|func1|func2`
     * This class offers syntactical sugar to retrieve the entire sequence of transformations as a single callable
     * @param name
     */
    get(name) {
        if (!name) {
            // This function is sometimes called with no value, and the expected behavior is to return null instead of
            //  a callable
            return null;
        }
        if (name.substring(0,1) === '|') {
            // Legacy artifact of how this function is called- if a pipe is present, this is the template string
            //  (`|func1|func2...`), rather than any one single transformation function.
            // A sequence of transformation functions is expected
            return this._collectTransforms(name);
        } else {
            // If not a template string, then user is asking for an item by name directly
            return super.get(name);
        }
    }
}


export default RegistryBase;
export { DataSources, TransformationFunctions };
