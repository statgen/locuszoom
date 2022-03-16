/**
 * Very simple client-side data joins. Useful for aligning records from two datasets based on a common key.
 */
import { clone } from './util';


/**
 * Simple grouping function, used to identify sets of records for joining.
 *
 * Used internally by join helpers, exported mainly for unit testing
 * @memberOf module:undercomplicate
 * @param {object[]} records
 * @param {string} group_key
 * @returns {Map<any, any>}
 */
function groupBy(records, group_key) {
    const result = new Map();
    for (let item of records) {
        const item_group = item[group_key];

        if (typeof item_group === 'undefined') {
            throw new Error(`All records must specify a value for the field "${group_key}"`);
        }
        if (typeof item_group === 'object') {
            // If we can't group this item, then don't (exclude object, array, map, null, etc from grouping keys)
            throw new Error('Attempted to group on a field with non-primitive values');
        }

        let group = result.get(item_group);
        if (!group) {
            group = [];
            result.set(item_group, group);
        }
        group.push(item);
    }
    return result;
}


function _any_match(type, left, right, left_key, right_key) {
    // Helper that consolidates logic for all three join types
    const right_index = groupBy(right, right_key);
    const results = [];
    for (let item of left) {
        const left_match_value = item[left_key];
        const right_matches = right_index.get(left_match_value) || [];
        if (right_matches.length) {
            // Record appears on both left and right; equiv to an inner join
            results.push(...right_matches.map((right_item) => Object.assign({}, clone(right_item), clone(item))));
        } else if (type !== 'inner') {
            // Record appears on left but not right
            results.push(clone(item));
        }
    }

    if (type === 'outer') {
        // Outer join part! We've already added all left-only and left-right matches; all that's left is the items that only appear on right side
        const left_index = groupBy(left, left_key);
        for (let item of right) {
            const right_match_value = item[right_key];
            const left_matches = left_index.get(right_match_value) || [];
            if (!left_matches.length) {
                results.push(clone(item));
            }
        }
    }
    return results;
}

/**
 * Equivalent to LEFT OUTER JOIN in SQL. Return all left records, joined to matching right data where appropriate.
 * @memberOf module:undercomplicate
 * @param {Object[]} left The left side recordset
 * @param {Object[]} right The right side recordset
 * @param {string} left_key The join field in left records
 * @param {string} right_key The join field in right records
 * @returns {Object[]}
 */
function left_match(left, right, left_key, right_key) {
    return _any_match('left', ...arguments);
}

/**
 * Equivalent to INNER JOIN in SQL. Only return record joins if the key field has a match on both left and right.
 * @memberOf module:undercomplicate
 * @param {object[]} left The left side recordset
 * @param {object[]} right The right side recordset
 * @param {string} left_key The join field in left records
 * @param {string} right_key The join field in right records
 * @returns {Object[]}
 */
function inner_match(left, right, left_key, right_key) {
    return _any_match('inner', ...arguments);
}

/**
 * Equivalent to FULL OUTER JOIN in SQL. Return records in either recordset, joined where appropriate.
 * @memberOf module:undercomplicate
 * @param {object[]} left The left side recordset
 * @param  {object[]} right The right side recordset
 * @param {string} left_key The join field in left records
 * @param {string} right_key The join field in right records
 * @returns {Object[]}
 */
function full_outer_match(left, right, left_key, right_key) {
    return _any_match('outer', ...arguments);
}

export {left_match, inner_match, full_outer_match, groupBy};
