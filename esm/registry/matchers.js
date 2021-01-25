/**
 * "Match" test functions used to compare two values for filtering (what to render) and matching
 *  (comparison and finding related points across data layers)
 *
 * All "matcher" functions have the call signature (item_value, target_value) => {boolean}
 * Both filtering and matching depend on asking "is this field interesting to me", which is inherently a problem of
 *  making comparisons. The registry allows any arbitrary function (with a field value as the first argument), but that
 *  function doesn't have to use either argument.
 *
 */
import {RegistryBase} from './base';

const registry = new RegistryBase();

// Most of the filter syntax uses things that are JS reserved operators. Instead of exporting symbols from another
//  module, just define and register them here.

registry.add('=', (a, b) => a === b);
// eslint-disable-next-line eqeqeq
registry.add('!=', (a, b) => a != b); // For absence of a value, deliberately allow weak comparisons (eg undefined/null)
registry.add('<', (a, b) => a < b);
registry.add('<=', (a, b) => a <= b);
registry.add('>', (a, b) => a > b);
registry.add('>=', (a, b) => a >= b);
registry.add('%', (a, b) => a % b);
registry.add('in', (a, b) => b && b.includes(a)); // works for strings or arrays: "item value for gene type is one of the allowed categories of interest"
registry.add('match', (a, b) => a && a.includes(b)); // useful for text search: "find all gene names that contain the user-entered value HLA"


export default registry;
