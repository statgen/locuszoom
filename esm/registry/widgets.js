import {ClassRegistry} from './base';
import * as widgets from '../components/toolbar/widgets';

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided data rendering types (data layers).
 * @see {module:LocusZoom_Widgets}
 * @alias module:LocusZoom~Widgets
 * @type {module:registry/base~ClassRegistry}
 */
const registry = new ClassRegistry();

for (let [name, type] of Object.entries(widgets)) {
    registry.add(name, type);
}


export default registry;
