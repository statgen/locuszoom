/*
 * A registry of known data sources. Can be used to find sources by name, either from predefined
 *  classes, or plugins.
 */
import RegistryBase from './base';

import * as adapters from '../data/adapters';

// KnownDataSources is a basic registry with no special behavior.
const registry = new RegistryBase();

for (let [name, type] of Object.entries(adapters)) {
    registry.add(name, type);
}

// Add some hard-coded aliases for backwards compatibility
registry.add('StaticJSON', adapters.StaticSource);
registry.add('LDLZ2', adapters.LDLZ);

export default registry;
