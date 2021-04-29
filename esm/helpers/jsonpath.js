/**
 * Simplified JSONPath implementation
 *
 * This is designed to make it easier to modify part of a LocusZoom layout, using a syntax based on intent
 *   ("modify association panels") rather than hard-coded assumptions ("modify the first button, and gosh I hope the order doesn't change")
 *
 * This DOES NOT support the full JSONPath specification. Notable limitations:
 * - Arrays can only be indexed by filter expression, not by number (can't ask for "array item 1")
 * - Filter expressions support only exact match, `field === value`. There is no support for "and" statements or
 *  arbitrary JS expressions beyond a single exact comparison. (the parser may be improved in the future if use cases emerge)
 */

const ATTR_REGEX = /^(\*|[\w]+)/; // attribute names can be wildcard or valid variable names
const EXPR_REGEX = /^\[\?\(@((?:\.[\w]+)+) *===? *([0-9.eE-]+|"[^"]*"|'[^']*')\)\]/;  // Arrays can be indexed using filter expressions like `[?(@.id === value)]` where value is a number or a single-or-double quoted string

function get_next_token(q) {
    // This just grabs everything that looks good.
    // The caller should check that the remaining query is valid.
    if (q.substr(0, 2) === '..') {
        if (q[2] === '[') {
            return {
                text: '..',
                attr: '*',
                depth: '..',
            };
        }
        const m = ATTR_REGEX.exec(q.substr(2));
        if (!m) {
            throw `Cannot parse ${JSON.stringify(q)} as dotdot_attr.`;
        }
        return {
            text: `..${m[0]}`,
            attr: m[1],
            depth: '..',
        };
    } else if (q[0] === '.') {
        const m = ATTR_REGEX.exec(q.substr(1));
        if (!m) {
            throw `Cannot parse ${JSON.stringify(q)} as dot_attr.`;
        }
        return {
            text: `.${m[0]}`,
            attr: m[1],
            depth: '.',
        };
    } else if (q[0] === '[') {
        const m = EXPR_REGEX.exec(q);
        if (!m) {
            throw `Cannot parse ${JSON.stringify(q)} as expr.`;
        }
        let value;
        try {
            // Parse strings and numbers
            value = JSON.parse(m[2]);
        } catch (e) {
            // Handle single-quoted strings
            value = JSON.parse(m[2].replace(/^'|'$/g, '"'));
        }

        return {
            text: m[0],
            attrs: m[1].substr(1).split('.'),
            value,
        };
    } else {
        throw `The query ${JSON.stringify(q)} doesn't look valid.`;
    }
}

function normalize_query(q) {
    // Normalize the start of the query so that it's just a bunch of selectors one-after-another.
    // Otherwise the first selector is a little different than the others.
    if (!q) {
        return '';
    }
    if (!['$', '['].includes(q[0])) {
        q = `$.${  q}`;
    } // It starts with a dotless attr, so prepend the implied `$.`.
    if (q[0] === '$') {
        q = q.substr(1);
    }  // strip the leading $
    return q;
}

function tokenize (q) {
    q = normalize_query(q);
    let selectors = [];
    while (q.length) {
        const selector = get_next_token(q);
        q = q.substr(selector.text.length);
        selectors.push(selector);
    }
    return selectors;
}

/**
 * Fetch the attribute from a dotted path inside a nested object, eg `extract_path({k:['a','b']}, ['k', 1])` would retrieve `'b'`
 *
 * This function returns a three item array `[parent, key, object]`. This is done to support mutating the value, which requires access to the parent.
 *
 * @param obj
 * @param path
 * @returns {*[]}
 */
function get_item_at_deep_path(obj, path) {
    let parent;
    for (let key of path) {
        parent = obj;
        obj = obj[key];
    }
    return [parent, path[path.length - 1], obj];
}

function tokens_to_keys(data, selectors) {
    // Resolve the jsonpath query into full path specifier keys in the object, eg
    //  `$..data_layers[?(@.tag === 'association)].color
    //  would become
    // ["panels", 0, "data_layers", 1, "color"]
    if (!selectors.length) {
        return [[]];
    }
    const sel = selectors[0];
    const remaining_selectors = selectors.slice(1);
    let paths = [];

    if (sel.attr && sel.depth === '.' && sel.attr !== '*') { // .attr
        const d = data[sel.attr];
        if (selectors.length === 1) {
            if (d !== undefined) {
                paths.push([sel.attr]);
            }
        } else {
            paths.push(...tokens_to_keys(d, remaining_selectors).map((p) => [sel.attr].concat(p)));
        }
    } else if (sel.attr && sel.depth === '.' && sel.attr === '*') { // .*
        for (let [k, d] of Object.entries(data)) {
            paths.push(...tokens_to_keys(d, remaining_selectors).map((p) => [k].concat(p)));
        }
    } else if (sel.attr && sel.depth === '..') { // ..
        // If `sel.attr` matches, recurse with that match.
        // And also recurse on every value using unchanged selectors.
        // I bet `..*..*` duplicates results, so don't do it please.
        if (typeof data === 'object' && data !== null) {
            if (sel.attr !== '*' && sel.attr in data) { // Exact match!
                paths.push(...tokens_to_keys(data[sel.attr], remaining_selectors).map((p) => [sel.attr].concat(p)));
            }
            for (let [k, d] of Object.entries(data)) {
                paths.push(...tokens_to_keys(d, selectors).map((p) => [k].concat(p))); // No match, just recurse
                if (sel.attr === '*') { // Wildcard match
                    paths.push(...tokens_to_keys(d, remaining_selectors).map((p) => [k].concat(p)));
                }
            }
        }
    } else if (sel.attrs) { // [?(@.attr===value)]
        for (let [k, d] of Object.entries(data)) {
            const [_, __, subject] = get_item_at_deep_path(d, sel.attrs);
            if (subject === sel.value) {
                paths.push(...tokens_to_keys(d, remaining_selectors).map((p) => [k].concat(p)));
            }
        }
    }

    const uniqPaths = uniqBy(paths, JSON.stringify); // dedup
    uniqPaths.sort((a, b) => b.length - a.length || JSON.stringify(a).localeCompare(JSON.stringify(b))); // sort longest-to-shortest, breaking ties lexicographically
    return uniqPaths;
}

function uniqBy(arr, key) {
    // Sometimes, the process of resolving paths to selectors returns duplicate results. This returns only the unique paths.
    return [...new Map(arr.map((elem) => [key(elem), elem])).values()];
}

function get_items_from_tokens(data, selectors) {
    let items = [];
    for (let path of tokens_to_keys(data, selectors)) {
        items.push(get_item_at_deep_path(data, path));
    }
    return items;
}

/**
 * Perform a query, and return the item + its parent context
 * @param data
 * @param query
 * @returns {*[]}
 * @private
 */
function _query(data, query) {
    const tokens = tokenize(query);

    const matches = get_items_from_tokens(data, tokens);
    if (!matches.length) {
        console.warn('No items matched the specified query');
    }
    return matches;
}

/**
 * Fetch the value(s) for each possible match for a given query. Returns only the item values.
 * @param {object} data The data object to query
 * @param {string} query A JSONPath-compliant query string
 * @returns {Array}
 */
function query(data, query) {
    return _query(data, query).map((item) => item[2]);
}

/**
 * Modify the value(s) for each possible match for a given jsonpath query. Returns the new item values.
 * @param {object} data The data object to query
 * @param {string} query A JSONPath-compliant query string
 * @param {function|*} value_or_callback The new value for the specified field. Mutations will only be applied
 *  after the keys are resolved; this prevents infinite recursion, but could invalidate some matches
 *  (if the mutation removed the expected key).
 */
function mutate(data, query, value_or_callback) {
    const matches_in_context = _query(data, query);
    return matches_in_context.map(([parent, key, old_value]) => {
        const new_value = (typeof value_or_callback === 'function') ? value_or_callback(old_value) : value_or_callback;
        parent[key] = new_value;
        return new_value;
    });
}

export {mutate, query};
