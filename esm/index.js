/**
 * Compatibility layer: expose symbols via UMD module to match the old LocusZoom API
 */

// TODO: expose registries + plugin system, and implement a subclass function that works in Es5.
// TODO: Handle SCSS build step
// TODO: Package extensions
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
