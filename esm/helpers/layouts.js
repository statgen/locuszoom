/**
 * Utilities for modifying or working with layout objects
 * @module
 * @private
 */
import * as d3 from 'd3';

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
 * A helper method used for merging two objects. If a key is present in both, takes the value from the first object
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

export { applyNamespaces, deepCopy, merge, nameToSymbol };
