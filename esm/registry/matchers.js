/**
 * "Match" test functions used to compare two values for filtering (what to render) and matching
 *  (comparison and finding related points across data layers)
 *
 * All "matcher" functions have the call signature (item_value, target_value) => {boolean}
 * Both filtering and matching depend on asking "is this field interesting to me", which is inherently a problem of
 *  making comparisons. The registry allows any arbitrary function (with a field value as the first argument), but that
 *  function doesn't have to use either argument.
 * @module LocusZoom_MatchFunctions
 */
import {RegistryBase} from './base';

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided "match" functions, used by filtering and matching behavior.
 * @see {module:LocusZoom_MatchFunctions}
 * @alias module:LocusZoom~MatchFunctions
 * @type {module:registry/base~RegistryBase}
 */
const registry = new RegistryBase();

// Most of the filter syntax uses things that are JS reserved operators. Instead of exporting symbols from another
//  module, just define and register them here.

/**
 * Check if two values are (strictly) equal
 * @function
 * @name '='
 * @param a
 * @param b
 */
registry.add('=', (a, b) => a === b);

/**
 * Check if two values are not equal. This allows weak comparisons (eg undefined/null), so it can also be used to test for the absence of a value
 * @function
 * @name '!='
 * @param a
 * @param b
 */
// eslint-disable-next-line eqeqeq
registry.add('!=', (a, b) => a != b); // For absence of a value, deliberately allow weak comparisons (eg undefined/null)

/**
 * Less-than comparison
 * @function
 * @name '<'
 * @param {Number} a
 * @param {Number} b
 */
registry.add('<', (a, b) => a < b);

/**
 * Less than or equals to comparison
 * @function
 * @name '<='
 * @param {Number} a
 * @param {Number} b
 */
registry.add('<=', (a, b) => a <= b);

/**
 * Greater-than comparison
 * @function
 * @name '>'
 * @param {Number} a
 * @param {Number} b
 */
registry.add('>', (a, b) => a > b);

/**
 * Greater than or equals to comparison
 * @function
 * @name '>='
 * @param {Number} a
 * @param {Number} b
 */
registry.add('>=', (a, b) => a >= b);

/**
 * Modulo: tests for whether the remainder a % b is nonzero
 * @function
 * @name '%'
 * @param {Number} a
 * @param {Number} b
 */
registry.add('%', (a, b) => a % b);

/**
 * Check whether the provided value (a) is in the string or array of values (b)
 *
 * This can be used to check if a field value is one of a set of predefined choices
 *  Eg, `gene_type` is one of the allowed types of interest
 * @function
 * @name 'in'
 * @param a A scalar value
 * @param {String|Array} b A container that implements the `includes` method
 */
registry.add('in', (a, b) => b && b.includes(a));

/**
 * Partial-match function. Can be used for free text search ("find all gene names that contain the user-entered string 'TCF'")
 * @function
 * @name 'match'
 * @param {String|Array} a A container (like a string) that implements the `includes` method
 * @param b A scalar value, like a string
 */
registry.add('match', (a, b) => a && a.includes(b)); // useful for text search: "find all gene names that contain the user-entered value HLA"


export default registry;
