import RegistryBase from './base';
import * as dashboard from '../components/dashboard/items';

// FIXME: Old usages of the registry used .get(...args) syntax to create an instance, will need to migrate internal usages towards .create
const registry = new RegistryBase();
for (let [name, type] of Object.entries(dashboard)) {
    registry.add(name, type);
}

export default registry;
