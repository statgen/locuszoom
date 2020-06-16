/**
 * Compatibility layer: expose symbols via UMD module to match the old LocusZoom API
 */

import {plugins} from './registry';

// TODO: Package existing extensions
// TODO: Handle SCSS build step
export {version} from '../package.json';

export {default as DataSources} from './data';
export { populate } from './helpers/display';
export {
    adapters as KnownDataSources,
    data_layers as DataLayers,
    layouts as Layouts,
    scalable as ScaleFunctions,
    transforms as TransformationFunctions,
} from './registry';

export const use = (extension) => plugins.use(extension);
