/**
 * @module
 * @private
 */
import {ClassRegistry} from './base';
import * as layers from '../components/data_layer';

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided data rendering types (data layers).
 * @see {module:LocusZoom_DataLayers}
 * @alias module:LocusZoom~DataLayers
 * @type {module:registry/base~ClassRegistry}
 */
const registry = new ClassRegistry();
for (let [name, type] of Object.entries(layers)) {
    registry.add(name, type);
}


export default registry;
