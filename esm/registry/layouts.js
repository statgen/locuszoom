import {RegistryBase} from './base';
import {applyNamespaces, deepCopy, mutate_attrs, merge, query_attrs, renameField} from '../helpers/layouts';
import * as layouts from '../layouts';

/**
 * Helper for working with predefined layouts
 *
 * This is part of the public interface with LocusZoom and a major way that users interact to configure plots.
 *
 * Each layout object that is added or retrieved here is a deep copy and totally independent from any other object
 * @public
 * @extends module:registry/base:RegistryBase
 * @inheritDoc
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
            return deepCopy(base);
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
     * @param {String} type The type of layout to add (plot, panel, data_layer, toolbar, toolbar_widgets, or tooltip)
     * @param {String} name The name of the layout object to add
     * @param {Object} item The layout object describing parameters
     * @param {boolean} override Whether to replace an existing item by that name
     * @return {*}
     */
    add(type, name, item, override = false) {
        if (!(type && name && item)) {
            throw new Error('To add a layout, type, name, and item must all be specified');
        }
        if (!(typeof item === 'object')) {
            throw new Error('The configuration to be added must be an object');
        }

        if (!this.has(type)) {
            super.add(type, new RegistryBase());
        }
        // Ensure that each use of a layout can be modified, by returning a copy is independent
        const copy = deepCopy(item);
        return super.get(type).add(name, copy, override);
    }

    /**
     * List all available types of layout (eg toolbar, panel, etc). If a specific type name is provided, list the
     *  layouts for that type of element ("just predefined panels").
     * @param {String} [type] The type of layout (eg toolbar, panel, etc)
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

    /**
     * Static alias to a helper method. Preserved for backwards compatibility, so that UMD users can access this method.
     * @static
     * @private
     */
    merge(custom_layout, default_layout) {
        return merge(custom_layout, default_layout);
    }

    /**
     * Static alias to a helper method. Allows renaming fields
     * @static
     * @private
     */
    renameField() {
        return renameField(...arguments);
    }

    /**
     * Static alias to a helper method. Allows mutating nested layout attributes
     * @static
     * @private
     */
    mutate_attrs() {
        return mutate_attrs(...arguments);
    }

    /**
     * Static alias to a helper method. Allows mutating nested layout attributes
     * @static
     * @private
     */
    query_attrs() {
        return query_attrs(...arguments);
    }
}

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided data adapters.
 * @alias module:LocusZoom~Layouts
 * @type {LayoutRegistry}
 */
const registry = new LayoutRegistry();

for (let [type, entries] of Object.entries(layouts)) {
    for (let [name, config] of Object.entries(entries)) {
        registry.add(type, name, config);
    }
}


export default registry;

// Export base class for unit testing
export {LayoutRegistry as _LayoutRegistry};
