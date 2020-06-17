import {RegistryBase} from './base';
import {applyNamespaces, deepCopy, merge} from '../helpers/layouts';
import * as layouts from '../layouts';

/**
 * Helper for working with predefined layouts
 *
 * This is part of the public interface with LocusZoom and a major way that users interact to configure plots.
 *
 * Each layout object that is added or retrieved here is a deep copy and totally independent from any other object
 * @public
 */
class LayoutRegistry extends RegistryBase {
    // Implemented as a "registry of registries"- one lookup each for panels, plots, etc...
    get(type, name, overrides = {}) {
        if (!(type && name)) {
            throw new Error('Must specify both the type and name for the layout desired. See .list() for available options');
        }
        // This is a registry of registries. Fetching an item may apply additional custom behaviors, such as
        //  applying overrides or using namespaces to convert an abstract layout into a concrete one.
        let base = super.get(type).get(name);
        base = merge(overrides, base);
        if (base.unnamespaced) {
            delete base.unnamespaced;
            return JSON.parse(JSON.stringify(base));
        }
        let default_namespace = '';
        if (typeof base.namespace == 'string') {
            default_namespace = base.namespace;
        } else if (typeof base.namespace == 'object' && Object.keys(base.namespace).length) {
            if (typeof base.namespace.default != 'undefined') {
                default_namespace = base.namespace.default;
            } else {
                default_namespace = base.namespace[Object.keys(base.namespace)[0]].toString();
            }
        }
        default_namespace += default_namespace.length ? ':' : '';
        const result = applyNamespaces(base, base.namespace, default_namespace);

        return deepCopy(result);
    }

    /**
     * Add a type of layout to the registry
     * @param {String} type
     * @param {String} name
     * @param {Object} item
     * @param {boolean} override
     * @return {*}
     */
    add(type, name, item, override = false) {
        if (!(type && name && item)) {
            throw new Error('To add a layout, type, name, and item must all be specified');
        }
        if(!(typeof item === 'object')) {
            throw new Error('The configuration to be added must be an object');
        }

        if (!this.has(type)) {
            super.add(type, new RegistryBase());
        }
        // Ensure that each use of a layout can be modified, by returning a copy is independent
        const copy = JSON.parse(JSON.stringify(item));
        return super.get(type).add(name, copy, override);
    }

    /**
     * List all available types of layout (eg dashboard, panel, etc). If a specific type name is provided, list the
     *  layouts for that component type.
     * @param {String} [type] The type of layout (eg dashboard, panel, etc)
     * @return {String[]|Object}
     */
    list(type) {
        if (!type) {
            let result = {};
            for (let [type, contents] of this._items) {
                result[type] = contents.list();
            }
            return result;
        }
        return super.get(type).list();
    }
}

const registry = new LayoutRegistry();

for (let [type, entries] of Object.entries(layouts)) {
    for (let [name, config] of Object.entries(entries)) {
        registry.add(type, name, config);
    }
}

export default registry;

// Export base class for unit testing
export {LayoutRegistry as _LayoutRegistry};
