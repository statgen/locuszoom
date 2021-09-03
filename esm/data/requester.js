import {getLinkedData} from 'undercomplicate';

import { JOINS } from '../registry';


class JoinTask {
    constructor(join_type, params) {
        this._callable = JOINS.get(join_type);
        this._params = params || [];
    }

    getData(options, left, right) {
        return Promise.resolve(this._callable(left, right, ...this._params));
    }
}


/**
 * The Requester manages fetching of data across multiple data sources. It is used internally by LocusZoom data layers.
 *   It passes state information and ensures that data is formatted in the manner expected by the plot.
 *
 * This object is not part of the public interface. It should almost **never** be replaced or modified directly.
 *
 * It is also responsible for constructing a "chain" of dependent requests, by requesting each datasource
 *   sequentially in the order specified in the datalayer `fields` array. Data sources are only chained within a
 *   data layer, and only if that layer requests more than one source of data.
 * @param {DataSources} sources A set of data sources used specifically by this plot instance
 * @private
 */
class Requester {
    constructor(sources) {
        this._sources = sources;
    }

    _config_to_sources(namespace_options, join_options) {
        // 1. Find the data sources needed for this request, and add in the joins for this layer
        // namespaces: { assoc: assoc, ld(assoc): ld }
        // TODO: Move this to the data layer creation step, along with contract validation
        // Dependencies are defined as raw data + joins
        const dependencies = [];
        // Create a list of sources unique to this layer, including both fetch and join operations
        const entities = new Map();
        Object.entries(namespace_options)
            .forEach(([label, source_name]) => {
                // In layout syntax, namespace names and dependencies are written together, like ld = ld(assoc). Convert.
                let match = label.match(/^(\w+)$|^(\w+)\(/);
                if (!match) {
                    throw new Error(`Invalid namespace name: '${label}'. Should be 'somename' or 'somename(somedep)'`);
                }
                const entity_label = match[1] || match[2];

                const source = this._sources.get(source_name);

                if (entities.has(entity_label)) {
                    throw new Error(`Configuration error: within a layer, namespace name '${label}' must be unique`);
                }

                entities.set(entity_label, source);
                dependencies.push(label);
            });

        join_options.forEach((config) => {
            const {type, name, requires, params} = config;
            if (entities.has(name)) {
                throw new Error(`Configuration error: within a layer, join name '${name}' must be unique`);
            }
            const task = new JoinTask(type, params);
            entities.set(name, task);
            dependencies.push(`${name}(${requires.join(', ')})`); // Dependency resolver uses the form item(depA, depB)
        });
        return [entities, dependencies];
    }

    getData(state, namespace_options, join_options) {
        const [entities, dependencies] = this._config_to_sources(namespace_options, join_options);
        if (!dependencies.length) {
            return Promise.resolve([]);
        }
        return getLinkedData(state, entities, dependencies, true);
    }
}


export default Requester;

export {JoinTask as _JoinTask};
