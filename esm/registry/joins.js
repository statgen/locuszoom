/**
 * "Join" functions
 *
 * Connect two sets of records together according to predefined rules.
 *
 * @module LocusZoom_JoinFunctions
 */
import {joins} from 'undercomplicate';

import {RegistryBase} from './base';

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided "data join" functions.
 * @alias module:LocusZoom~JoinFunctions
 * @type {module:registry/base~RegistryBase}
 */
const registry = new RegistryBase();

registry.add('left_match', joins.left_match);

registry.add('inner_match', joins.inner_match);

registry.add('full_outer_match', joins.full_outer_match);

export default registry;
