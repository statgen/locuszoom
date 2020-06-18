/**
 * Compatibility layer: expose symbols via UMD module to match the old LocusZoom API
 */
import '../css/locuszoom.scss'; // Trigger CSS to be automatically built to the dist folder
// import {BaseWidget, _Button} from './components/toolbar/widgets';
import {BaseAdapter, RemoteAdapter} from './data';

import {plugins} from './registry';

// Allow UMD users to directly access base classes, so they can register their own custom data or display code.
// ES6 modules will generally import these symbols directly from their correct path
const BaseClasses = {
    BaseAdapter, RemoteAdapter, // Create custom adapters

    // _Button, BaseWidget, // Create custom toolbar widgets
};


export {version} from '../package.json';
export { BaseClasses };  // UMD-friendly access to internals.
export {default as DataSources} from './data';
export { populate } from './helpers/display';
export {
    adapters as KnownDataSources,
    data_layers as DataLayers,
    widgets as Widgets,
    layouts as Layouts,
    scalable as ScaleFunctions,
    transforms as TransformationFunctions,
} from './registry';

export const use = (extension) => plugins.use(extension);
