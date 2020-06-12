import RegistryBase from './base';
import * as layers from '../components/data_layer';

// FIXME: Convert usages of registry.get(...args) to registry.create()
const registry = new RegistryBase();
for (let [name, type] of Object.entries(layers)) {
    registry.add(name, type);
}

export default registry;
