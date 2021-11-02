/**
 * @module
 * @private
 */
import {getLinkedData} from 'undercomplicate';

import { DATA_OPS } from '../registry';


class DataOperation {
    /**
     * Perform a data operation (such as a join)
     * @param {String} join_type
     * @param initiator The entity that initiated the request for data. Usually, this is the data layer. This argument exists so that a data_operation could do things like auto-define axis labels/ color scheme in response to dynamic data. It has potential for side effects if misused, so use sparingly!
     * @param params Optional user/layout parameters to be passed to the data function
     */
    constructor(join_type, initiator, params) {
        this._callable = DATA_OPS.get(join_type);
        this._initiator = initiator;
        this._params = params || [];
    }

    getData(plot_state, ...dependent_recordsets) {
        // Most operations are joins: they receive two pieces of data (eg left + right)
        //   Other ops are possible, like consolidating just one set of records to best value per key
        // Hence all dependencies are passed as first arg: [dep1, dep2, dep3...]

        // Every data operation receives plot_state, reference to the data layer that called it, the input data, & any additional options
        const context = {plot_state, data_layer: this._initiator};
        return Promise.resolve(this._callable(context, dependent_recordsets, ...this._params));
    }
}


/**
 * The Requester manages fetching of data across multiple data sources. It is used internally by LocusZoom data layers.
 *   It passes plot.state information to each adapter, and ensures that a series of requests can be performed in a
 *   designated order.
 *
 * Each data layer calls the requester object directly, and as such, each data layer has a private view of data: it can
 *   perform its own calculations, filter results, and apply transforms without influencing other layers.
 *  (while still respecting a shared cache where appropriate)
 *
 * This object is not part of the public interface. It should almost **never** be replaced or modified directly.
 *
 * @param {DataSources} sources A set of data sources used specifically by this plot instance
 * @private
 */
class Requester {
    constructor(sources) {
        this._sources = sources;
    }

    /**
     * Parse the data layer configuration when a layer is first created.
     *  Validate config, and return entities and dependencies in a format usable for data retrieval.
     *  This is used by data layers, and also other data-retrieval functions (like subscribeToDate).
     *
     *  Inherent assumptions:
     *  1. A data layer will always know its data up front, and layout mutations will only affect what is displayed.
     *  2. People will be able to add new data adapters (tracks), but if they are removed, the accompanying layers will be
     *      removed at the same time. Otherwise, the pre-parsed data fetching logic could could preserve a reference to the
     *      removed adapter.
     * @param {Object} namespace_options
     * @param {Array} data_operations
     * @param {Object|null} initiator The entity that initiated the request (the data layer). Passed to data operations, but not adapters.
     * @returns {Array} Map of entities and list of dependencies
     */
    config_to_sources(namespace_options = {}, data_operations = [], initiator) {
        const entities = new Map();
        const namespace_local_names = Object.keys(namespace_options);

        // 1. Specify how to coordinate data. Precedence:
        //   a) EXPLICIT fetch logic,
        //   b) IMPLICIT auto-generate fetch order if there is only one NS,
        //   c) Throw "spec required" error if > 1, because 2 adapters may need to be fetched in a sequence
        let dependency_order = data_operations.find((item) => item.type === 'fetch');  // explicit spec: {fetch, from}
        if (!dependency_order) {
            dependency_order = { type: 'fetch', from: namespace_local_names };
            data_operations.unshift(dependency_order);
        }

        // Validate that all NS items are available to the root requester in DataSources. All layers recognize a
        //  default value, eg people copying the examples tend to have defined a datasource called "assoc"
        const ns_pattern = /^\w+$/;
        for (let [local_name, global_name] of Object.entries(namespace_options)) {
            if (!ns_pattern.test(local_name)) {
                throw new Error(`Invalid namespace name: '${local_name}'. Must contain only alphanumeric characters`);
            }

            const source = this._sources.get(global_name);
            if (!source) {
                throw new Error(`A data layer has requested an item not found in DataSources: data type '${local_name}' from ${global_name}`);
            }
            entities.set(local_name, source);

            // Note: Dependency spec checker will consider "ld(assoc)" to match a namespace called "ld"
            if (!dependency_order.from.find((dep_spec) => dep_spec.split('(')[0] === local_name)) {
                // Sometimes, a new piece of data (namespace) will be added to a layer. Often this doesn't have any dependencies, other than adding a new join.
                //  To make it easier to EXTEND existing layers, by default, we'll push any unknown namespaces to data_ops.fetch
                // Thus the default behavior is "fetch all namespaces as though they don't depend on anything.
                //  If they depend on something, only then does "data_ops[@type=fetch].from" need to be mutated
                dependency_order.from.push(local_name);
            }
        }

        let dependencies = Array.from(dependency_order.from);

        // Now check all joins. Are namespaces valid? Are they requesting known data?
        for (let config of data_operations) {
            let {type, name, requires, params} = config;
            if (type !== 'fetch') {
                let namecount = 0;
                if (!name) {
                    name = config.name = `join${namecount}`;
                    namecount += 1;
                }

                if (entities.has(name)) {
                    throw new Error(`Configuration error: within a layer, join name '${name}' must be unique`);
                }
                requires.forEach((require_name) => {
                    if (!entities.has(require_name)) {
                        throw new Error(`Data operation cannot operate on unknown provider '${require_name}'`);
                    }
                });

                const task = new DataOperation(type, initiator, params);
                entities.set(name, task);
                dependencies.push(`${name}(${requires.join(', ')})`); // Dependency resolver uses the form item(depA, depB)
            }
        }
        return [entities, dependencies];
    }

    /**
     *
     * @param {Object} context
     * @param {Object} context.state Plot state, which will be passed to every adapter. Includes view extent (chr, start, end)
     * @param {Object|null} context.data_layer A reference to the data layer that initiated the request (if applicable).
     *   Data operations (but NOT adapters) are passed this property; it can be used to do things like auto-generate
     *   axis tick marks or panel legends after all dynamic data has been received. This is an advanced usage and should be handled with care!
     * @param {Map} entities A list of adapter and join tasks. This is created internally from data layer layouts.
     *  Keys are layer-local namespaces for data types (like assoc), and values are adapter or join task instances
     *  (things that implement a method getData).
     * @param {String[]} dependencies Instructions on what adapters to fetch from, in what order
     * @returns {Promise}
     */
    getData({ plot_state, data_layer }, entities, dependencies) {
        if (!dependencies.length) {
            return Promise.resolve([]);
        }
        // The last dependency (usually the last join operation) determines the last thing returned.
        return getLinkedData(plot_state, entities, dependencies, true);
    }
}


export default Requester;

export {DataOperation as _JoinTask};
