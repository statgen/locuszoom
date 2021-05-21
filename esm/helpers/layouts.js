/**
 * Utilities for modifying or working with layout objects
 * @module
 * @private
 */
import * as d3 from 'd3';

import {mutate, query} from './jsonpath';

const sqrt3 = Math.sqrt(3);
// D3 v5 does not provide a triangle down symbol shape, but it is very useful for showing direction of effect.
//  Modified from https://github.com/d3/d3-shape/blob/master/src/symbol/triangle.js
const triangledown = {
    draw(context, size) {
        const y = -Math.sqrt(size / (sqrt3 * 3));
        context.moveTo(0, -y * 2);
        context.lineTo(-sqrt3 * y, y);
        context.lineTo(sqrt3 * y, y);
        context.closePath();
    },
};

/**
 * Apply namespaces to layout, recursively
 * @private
  */
function applyNamespaces(element, namespace, default_namespace) {
    if (namespace) {
        if (typeof namespace == 'string') {
            namespace = { default: namespace };
        }
    } else {
        namespace = { default: '' };
    }
    if (typeof element == 'string') {
        const re = /\{\{namespace(\[[A-Za-z_0-9]+\]|)\}\}/g;
        let match, base, key, resolved_namespace;
        const replace = [];
        while ((match = re.exec(element)) !== null) {
            base = match[0];
            key = match[1].length ? match[1].replace(/(\[|\])/g, '') : null;
            resolved_namespace = default_namespace;
            if (namespace != null && typeof namespace == 'object' && typeof namespace[key] != 'undefined') {
                resolved_namespace = namespace[key] + (namespace[key].length ? ':' : '');
            }
            replace.push({ base: base, namespace: resolved_namespace });
        }
        for (let r in replace) {
            element = element.replace(replace[r].base, replace[r].namespace);
        }
    } else if (typeof element == 'object' && element != null) {
        if (typeof element.namespace != 'undefined') {
            const merge_namespace = (typeof element.namespace == 'string') ? { default: element.namespace } : element.namespace;
            namespace = merge(namespace, merge_namespace);
        }
        let namespaced_element, namespaced_property;
        for (let property in element) {
            if (property === 'namespace') {
                continue;
            }
            namespaced_element = applyNamespaces(element[property], namespace, default_namespace);
            namespaced_property = applyNamespaces(property, namespace, default_namespace);
            if (property !== namespaced_property) {
                delete element[property];
            }
            element[namespaced_property] = namespaced_element;
        }
    }
    return element;
}

/**
 * A helper method used for merging two objects. If a key is present in both, takes the value from the first object.
 *   Values from `default_layout` will be cleanly copied over, ensuring no references or shared state.
 *
 * Frequently used for preparing custom layouts. Both objects should be JSON-serializable.
 *
 * @alias LayoutRegistry.merge
 * @param {object} custom_layout An object containing configuration parameters that override or add to defaults
 * @param {object} default_layout An object containing default settings.
 * @returns {object} The custom layout is modified in place and also returned from this method.
 */
function merge(custom_layout, default_layout) {
    if (typeof custom_layout !== 'object' || typeof default_layout !== 'object') {
        throw new Error(`LocusZoom.Layouts.merge only accepts two layout objects; ${typeof custom_layout}, ${typeof default_layout} given`);
    }
    for (let property in default_layout) {
        if (!Object.prototype.hasOwnProperty.call(default_layout, property)) {
            continue;
        }
        // Get types for comparison. Treat nulls in the custom layout as undefined for simplicity.
        // (javascript treats nulls as "object" when we just want to overwrite them as if they're undefined)
        // Also separate arrays from objects as a discrete type.
        let custom_type = custom_layout[property] === null ? 'undefined' : typeof custom_layout[property];
        let default_type = typeof default_layout[property];
        if (custom_type === 'object' && Array.isArray(custom_layout[property])) {
            custom_type = 'array';
        }
        if (default_type === 'object' && Array.isArray(default_layout[property])) {
            default_type = 'array';
        }
        // Unsupported property types: throw an exception
        if (custom_type === 'function' || default_type === 'function') {
            throw new Error('LocusZoom.Layouts.merge encountered an unsupported property type');
        }
        // Undefined custom value: pull the default value
        if (custom_type === 'undefined') {
            custom_layout[property] = deepCopy(default_layout[property]);
            continue;
        }
        // Both values are objects: merge recursively
        if (custom_type === 'object' && default_type === 'object') {
            custom_layout[property] = merge(custom_layout[property], default_layout[property]);
            continue;
        }
    }
    return custom_layout;
}

function deepCopy(item) {
    return JSON.parse(JSON.stringify(item));
}

/**
 * Convert name to symbol
 * Layout objects accept symbol names as strings (circle, triangle, etc). Convert to symbol objects.
 * @return {object|null} An object that implements a draw method (eg d3-shape symbols or extra LZ items)
 */
function nameToSymbol(shape) {
    if (!shape) {
        return null;
    }
    if (shape === 'triangledown') {
        // D3 does not provide this symbol natively
        return triangledown;
    }
    // Legend shape names are strings; need to connect this to factory. Eg circle --> d3.symbolCircle
    const factory_name = `symbol${shape.charAt(0).toUpperCase() + shape.slice(1)}`;
    return d3[factory_name] || null;
}

/**
 * A utility helper for customizing one part of a pre-made layout. Whenever a primitive value is found (eg string),
 *  replaces *exact match*
 *
 * This method works by comparing whether strings are a match. As a result, the "old" and "new" names must match
 *  whatever namespacing is used in the input layout.
 * Note: this utility *can* replace values with filters, but will not do so by default.
 *
 * @alias LayoutRegistry.renameField
 *
 * @param {object} layout The layout object to be transformed.
 * @param {string} old_name The old field name that will be replaced
 * @param {string} new_name The new field name that will be substituted in
 * @param {boolean} [warn_transforms=true] Sometimes, a field name is used with transforms appended, eg `label|htmlescape`.
 *   In some cases a rename could change the meaning of the field, and by default this method will print a warning to
 *   the console, encouraging the developer to check the relevant usages. This warning can be silenced via an optional function argument.
 */
function renameField(layout, old_name, new_name, warn_transforms = true) {
    const this_type = typeof layout;
    // Handle nested types by recursion (in which case, `layout` may be something other than an object)
    if (Array.isArray(layout)) {
        return layout.map((item) => renameField(item, old_name, new_name, warn_transforms));
    } else if (this_type === 'object' && layout !== null) {
        return Object.keys(layout).reduce(
            (acc, key) => {
                acc[key] = renameField(layout[key], old_name, new_name, warn_transforms);
                return acc;
            }, {}
        );
    } else if (this_type !== 'string') {
        // Field names are always strings. If the value isn't a string, don't even try to change it.
        return layout;
    } else {
        // If we encounter a field we are trying to rename, then do so!
        // Rules:
        //  1. Try to avoid renaming part of a field, by checking token boundaries (field1 should not rename field1_displayvalue)
        //  2. Warn the user if filter functions are being used with the specified field, so they can audit for changes in meaning
        const escaped = old_name.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

        if (warn_transforms) {
            // Warn the user that they might be renaming, eg, `pvalue|neg_log` to `log_pvalue|neg_log`. Let them decide
            //   whether the new field name has a meaning that is compatible with the specified transforms.
            const filter_regex = new RegExp(`${escaped}\\|\\w+`, 'g');
            const filter_matches = (layout.match(filter_regex) || []);
            filter_matches.forEach((match_val) => console.warn(`renameFields is renaming a field that uses transform functions: was '${match_val}' . Verify that these transforms are still appropriate.`));
        }

        // Find and replace any substring, so long as it is at the end of a valid token
        const regex = new RegExp(`${escaped}(?!\\w+)`, 'g');
        return layout.replace(regex, new_name);
    }
}

/**
 * Modify any and all attributes at the specified path in the object
 * @param {object} layout The layout object to be mutated
 * @param {string} selector The JSONPath-compliant selector string specifying which field(s) to change.
 *   The callback will be applied to ALL matching selectors
 *  (see Interactivity guide for syntax and limitations)
 * @param {*|function} value_or_callable The new value, or a function that receives the old value and returns a new one
 * @returns {Array}
 * @alias LayoutRegistry.mutate_attrs
 */
function mutate_attrs(layout, selector, value_or_callable) {
    return mutate(
        layout,
        selector,
        value_or_callable
    );
}

/**
 * Query any and all attributes at the specified path in the object.
 *      This is mostly only useful for debugging, to verify that a particular selector matches the intended field.
 * @param {object} layout The layout object to be mutated
 * @param {string} selector The JSONPath-compliant selector string specifying which values to return. (see Interactivity guide for limits)
 * @returns {Array}
 * @alias LayoutRegistry.query_attrs
 */
function query_attrs(layout, selector) {
    return query(layout, selector);
}

export { applyNamespaces, deepCopy, merge, mutate_attrs, query_attrs, nameToSymbol, renameField };
