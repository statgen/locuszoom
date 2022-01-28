/**
 * Perform a series of requests, respecting order of operations
 * @private
 */

import {Sorter} from '@hapi/topo';


function _parse_declaration(spec) {
    // Parse a dependency declaration like `assoc` or `ld(assoc)` or `join(assoc, ld)`. Return node and edges that can be used to build a graph.
    const parsed = /^(?<name_alone>\w+)$|((?<name_deps>\w+)+\(\s*(?<deps>[^)]+?)\s*\))/.exec(spec);
    if (!parsed) {
        throw new Error(`Unable to parse dependency specification: ${spec}`);
    }

    let {name_alone, name_deps, deps} = parsed.groups;
    if (name_alone) {
        return [name_alone, []];
    }

    deps = deps.split(/\s*,\s*/);
    return [name_deps, deps];
}

/**
 * Perform a request for data from a set of providers, taking into account dependencies between requests.
 *  This can be a mix of network requests or other actions (like join tasks), provided that the provider be some
 *  object that implements a method `instance.getData`
 *
 * Each data layer in LocusZoom will translate the internal configuration into a format used by this function.
 *  This function is never called directly in custom user code. In locuszoom, Requester Handles You
 *
 * TODO Future: It would be great to add a warning if the final element in the DAG does not reference all dependencies. This is a limitation of the current toposort library we use.
 *
 * @param {object} shared_options Options passed globally to all requests. In LocusZoom, this is often a copy of "plot.state"
 * @param {Map} entities A lookup of named entities that implement the method `instance.getData -> Promise`
 * @param {String[]} dependencies A description of how to fetch entities, and what they depend on, like `['assoc', 'ld(assoc)']`.
 *   **Order will be determined by a DAG and the last item in the DAG is all that is returned.**
 * @param {boolean} [consolidate=true] Whether to return all results (almost never used), or just the last item in the resolved DAG.
 *   This can be a pitfall in common usage: if you forget a "join/consolidate" task, the last result may appear to be missing some data.
 * @returns {Promise<Object[]>}
 */
function getLinkedData(shared_options, entities, dependencies, consolidate = true) {
    if (!dependencies.length) {
        return [];
    }

    const parsed = dependencies.map((spec) => _parse_declaration(spec));
    const dag = new Map(parsed);

    // Define the order to perform requests in, based on a DAG
    const toposort = new Sorter();
    for (let [name, deps] of dag.entries()) {
        try {
            toposort.add(name, {after: deps, group: name});
        } catch (e) {
            throw new Error(`Invalid or possible circular dependency specification for: ${name}`);
        }
    }
    const order = toposort.nodes;

    // Verify that all requested entities exist by name!
    const responses = new Map();
    for (let name of order) {
        const provider = entities.get(name);
        if (!provider) {
            throw new Error(`Data has been requested from source '${name}', but no matching source was provided`);
        }

        // Each promise should only be triggered when the things it depends on have been resolved
        const depends_on = dag.get(name) || [];
        const prereq_promises = Promise.all(depends_on.map((name) => responses.get(name)));

        const this_result = prereq_promises.then((prior_results) => {
            // Each request will be told the name of the provider that requested it. This can be used during post-processing,
            //   eg to use the same endpoint adapter twice and label where the fields came from (assoc.id, assoc2.id)
            // This has a secondary effect: it ensures that any changes made to "shared" options in one adapter will
            //  not leak out to others via a mutable shared object reference.
            const options = Object.assign({_provider_name: name}, shared_options);
            return provider.getData(options, ...prior_results);
        });
        responses.set(name, this_result);
    }
    return Promise.all([...responses.values()])
        .then((all_results) => {
            if (consolidate) {
                // Some usages- eg fetch + data join tasks- will only require the last response in the sequence
                // Consolidate mode is the common use case, since returning a list of responses is not so helpful (depends on order of request, not order specified)
                return all_results[all_results.length - 1];
            }
            return all_results;
        });
}


export {getLinkedData};

// For testing only
export {_parse_declaration};
