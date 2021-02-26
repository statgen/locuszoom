import {RegistryBase} from './base';
import * as transforms from '../helpers/transforms';

/**
 * Registry of transformation functions that may be applied to template values to control how values are rendered.
 * Provides syntactic sugar atop a standard registry.
 * @public
 * @extends module:registry/base:RegistryBase
 * @inheritDoc
 */
class TransformationFunctionsRegistry extends RegistryBase {
    /**
     * Helper function that turns a sequence of function names into a single callable
     * @param template_string
     * @return {function(*=): *}
     * @private
     */
    _collectTransforms(template_string) {
        const funcs = template_string
            .match(/\|([^|]+)/g)
            .map((item) => super.get(item.substring(1)));

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
        if (name.substring(0, 1) === '|') {
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


/**
 * A plugin registry that allows plots to use both pre-defined and user-provided transformation functions, which
 *  can be used to modify a value in the input data in a predefined way. For example, these can be used to let APIs
 *  that return p_values work with plots that display -log10(p)
 * @alias module:LocusZoom~TransformationFunctions
 * @type {TransformationFunctionsRegistry}
 */
const registry = new TransformationFunctionsRegistry();
for (let [name, type] of Object.entries(transforms)) {
    registry.add(name, type);
}


export default registry;
// Export helper class for unit testing
export { TransformationFunctionsRegistry as _TransformationFunctions };
