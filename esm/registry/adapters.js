/**
 * A registry of known data sources. Can be used to find sources by name, either from predefined
 *  classes, or plugins.
 *  @module
 *  @private
 */
import {ClassRegistry} from './base';

import * as adapters from '../data/adapters';


// KnownDataSources is a basic registry with no special behavior.
/**
 * A plugin registry that allows plots to use both pre-defined and user-provided data adapters.
 * @see {module:LocusZoom_Adapters}
 * @alias module:LocusZoom~Adapters
 * @type {module:registry/base~ClassRegistry}
 */
const registry = new ClassRegistry();

for (let [name, type] of Object.entries(adapters)) {
    registry.add(name, type);
}

// Add some hard-coded aliases for backwards compatibility

/**
 * Backwards-compatible alias for StaticSource
 * @public
 * @name module:LocusZoom_Adapters~StaticJSON
 * @see module:LocusZoom_Adapters~StaticSource
 */
registry.add('StaticJSON', adapters.StaticSource);

/**
 * Backwards-compatible alias for LDServer
 * @public
 * @name module:LocusZoom_Adapters~LDLZ2
 * @see module:LocusZoom_Adapters~LDServer
 */
registry.add('LDLZ2', adapters.LDServer);


export default registry;
