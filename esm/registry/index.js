/**
 * Registries that track all registered features available to LocusZoom (including active plugins)
 * @module
 * @public
 */
import ADAPTERS from './adapters';
import DATA_LAYERS from './data_layers';
import FILTERS from './filters';
import LAYOUTS from './layouts';
import SCALABLE from './scalable';
import TRANSFORMS from './transforms';
import WIDGETS from './widgets';

export {
    // Base classes and reusable components
    ADAPTERS, DATA_LAYERS, LAYOUTS, WIDGETS,
    // User defined functions for injecting custom behavior into layout directives
    // TODO: Implement "match" functions
    SCALABLE, FILTERS, TRANSFORMS,
};
