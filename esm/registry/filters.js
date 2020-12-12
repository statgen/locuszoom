/**
 * Filter functions that govern whether to render a particular point. Most datalayers support filter syntax.
 *
 * All filter functions have the call signature (item_value, target_value) => {boolean}
 * This call signature reflects the heritage of many filters as simple comparison operators, but the registry allows
 *  any arbitrary function (with a field value as the first argument)
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
