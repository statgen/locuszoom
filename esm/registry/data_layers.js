import {ClassRegistry} from './base';
import * as layers from '../components/data_layer';

const registry = new ClassRegistry();
for (let [name, type] of Object.entries(layers)) {
    registry.add(name, type);
}


export default registry;
