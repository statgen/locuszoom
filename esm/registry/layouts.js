import {RegistryBase} from './base';
import {applyNamespaces, deepCopy, mutate_attrs, merge, query_attrs, renameField, findFields} from '../helpers/layouts';
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
        //  applying overrides or applying namespaces.
        let base = super.get(type).get(name);

        // Most keys are merged directly. Namespaces are handled a little differently, as they act like global overrides.
        //  (eg ask for plot layout, and modify multiple nested data layers where a particular namespace is referenced)
        const custom_namespaces = overrides.namespace;
        if (!base.namespace) {
            // Iff namespaces are a top level key, we'll allow them to be merged directly with the base layout
            // NOTE: The "merge namespace" behavior means that data layers can add new data easily, but this method
            //   can't be used to remove namespaces when extending something. (you'll need to layout.namespaces = {} separately).
            delete overrides.namespace;
        }
        let result = merge(overrides, base);

        if (custom_namespaces) {
            result = applyNamespaces(result, custom_namespaces);
        }
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

        // Special behavior for datalayers: all registry data layers will attempt to identify the fields requested
        //   from external sources. This is purely a hint, because not every layout is generated through the registry.
        if (type === 'data_layer' && copy.namespace) {
            copy._auto_fields = [...findFields(copy, Object.keys(copy.namespace))];
        }

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
