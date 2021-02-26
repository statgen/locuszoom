/**
 * Whether imported (ES6 modules) or loaded via script tag (UMD), this module represents
 *  the "public interface" via which core LocusZoom features and plugins are exposed for programmatic usage.
 *
 * A library using this file will need to load `locuszoom.css` separately in order for styles to appear.
 *
 * @module LocusZoom
 */
import version from './version';

import {default as DataSources} from './data';
import { populate } from './helpers/display';

import {
    ADAPTERS as Adapters,
    DATA_LAYERS as DataLayers,
    WIDGETS as Widgets,
    LAYOUTS as Layouts,
    MATCHERS as MatchFunctions,
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
    MatchFunctions,
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
 * @param args Any additional arguments passed to LocusZoom.use will be passed to the function when the plugin is loaded
 */


const INSTALLED_PLUGINS = [];

/**
 * @alias module:LocusZoom.use
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
