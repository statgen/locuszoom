/**
 * Registries that track all registered features available to LocusZoom (including active plugins)
 */
import ADAPTERS from './adapters';
import DATA_LAYERS from './data_layers';
import LAYOUTS from './layouts';
import MATCHERS from './matchers';
import SCALABLE from './scalable';
import TRANSFORMS from './transforms';
import WIDGETS from './widgets';

export {
    // Base classes and reusable components
    ADAPTERS, DATA_LAYERS, LAYOUTS, WIDGETS,
    // User defined functions for injecting custom behavior into layout directives
    MATCHERS, SCALABLE, TRANSFORMS,
};
