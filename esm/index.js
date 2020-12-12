/**
 * Compatibility layer: expose symbols via UMD module to match the old LocusZoom API
 * A library using this file will need to load `locuszoom.css` separately.
 */
import version from './version';

import {default as DataSources} from './data';
import { populate } from './helpers/display';

import {
    ADAPTERS as Adapters,
    DATA_LAYERS as DataLayers,
    WIDGETS as Widgets,
    LAYOUTS as Layouts,
    FILTERS as FilterFunctions,
    SCALABLE as ScaleFunctions,
    TRANSFORMS as TransformationFunctions,
} from './registry';


const LocusZoom = {
    version,
    // Helpers for creating plots- the main public interface for most use cases
    populate,
    DataSources,
    // Registries for plugin system
    Adapters,
    DataLayers,
    Layouts,
    FilterFunctions,
    ScaleFunctions,
    TransformationFunctions,
    Widgets,

    get KnownDataSources() { // Backwards- compatibility alias
        console.warn('Deprecation warning: KnownDataSources has been renamed to "Adapters"');
        return Adapters;
    },
};


/**
 * @callback pluginCallback
 * @param {Object} LocusZoom The global LocusZoom object
 */


const INSTALLED_PLUGINS = [];

/**
 *
 * @param {pluginCallback} plugin The plugin should be a module that exports the function as either the default export,
 *  or as a member named "install"
 * @param args Additional options to be passed when creating the plugin
 */
LocusZoom.use = function(plugin, ...args) {
    // Deliberately similar implementation to Vue.js .use() plugin system
    if (INSTALLED_PLUGINS.includes(plugin)) {
        // Avoid double-installation of a plugin
        return;
    }

    args.unshift(LocusZoom); // All plugins are passed a reference to LocusZoom object
    if (typeof plugin.install === 'function') {
        plugin.install.apply(plugin, args);
    } else if (typeof plugin === 'function') {
        plugin.apply(null, args);
    } else {
        throw new Error('Plugin must export a function that receives the LocusZoom object as an argument');
    }
    INSTALLED_PLUGINS.push(plugin);
};


export default LocusZoom;
