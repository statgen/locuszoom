import {ClassRegistry} from './base';
import * as widgets from '../components/toolbar/widgets';

const registry = new ClassRegistry();

for (let [name, type] of Object.entries(widgets)) {
    registry.add(name, type);
}


export default registry;
