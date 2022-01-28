/**
 * The LocusZoom data retrieval library was originally created as a standalone library, mainly for LZ usage.
 * It is inlined into the LocusZoom source code, because there are no other places it is really used, and JSDoc references are much easier
 *  to generate with a package in the same repo.
 *
 * See individual adapter classes (and their documentation) for helpful guides on what methods are available, and common customizations for LocusZoom use.
 * @see module:LocusZoom_Adapters~BaseLZAdapter
 *
 * @module undercomplicate
 * @public
 */
export { BaseAdapter, BaseUrlAdapter } from './adapter';
export {LRUCache} from './lru_cache';
export {getLinkedData} from './requests';

import * as joins from './joins';
export {joins};
