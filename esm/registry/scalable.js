import {RegistryBase} from './base';
import * as scalable from '../helpers/scalable';

const registry = new RegistryBase();
for (let [name, type] of Object.entries(scalable)) {
    registry.add(name, type);
}

// Alias for the "if_value" function (can't export reserved language keywords directly)
registry.add('if', scalable.if_value);

export default registry;
