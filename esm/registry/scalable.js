import RegistryBase from './base';
import * as scalable from '../helpers/scalable';

const registry = new RegistryBase();
for (let [name, type] of Object.entries(scalable)) {
    registry.add(name, type);
}

export default registry;
