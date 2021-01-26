import {ClassRegistry} from './base';
import * as widgets from '../components/toolbar/widgets';

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided toolbar widgets: interactive buttons
 *  and menus that control plot display, modify data, or show additional information as context.
 * @alias module:LocusZoom~Widgets
 * @type {module:registry/base~ClassRegistry}
 */
const registry = new ClassRegistry();

for (let [name, type] of Object.entries(widgets)) {
    registry.add(name, type);
}


export default registry;
