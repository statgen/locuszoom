import {RegistryBase} from './base';
import * as transforms from '../helpers/transforms';

/**
 * Registry of transformation functions that may be applied to template values.
 * Provides syntactic sugar atop a standard registry.
 * @private
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


const registry = new TransformationFunctions();
for (let [name, type] of Object.entries(transforms)) {
    registry.add(name, type);
}

export default registry;
// Export helper class for unit testing
export { TransformationFunctions as _TransformationFunctions };
