import {ClassRegistry} from './base';
import * as dashboard from '../components/dashboard/items';

const registry = new ClassRegistry();
for (let [name, type] of Object.entries(dashboard)) {
    registry.add(name, type);
}

export default registry;
