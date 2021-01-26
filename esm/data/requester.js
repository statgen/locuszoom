import { TRANSFORMS } from '../registry';

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

    __split_requests(fields) {
        // Given a fields array, return an object specifying what datasource names the data layer should make requests
        //  to, and how to handle the returned data
        var requests = {};
        // Regular expression finds namespace:field|trans
        var re = /^(?:([^:]+):)?([^:|]*)(\|.+)*$/;
        fields.forEach(function(raw) {
            var parts = re.exec(raw);
            var ns = parts[1] || 'base';
            var field = parts[2];
            var trans = TRANSFORMS.get(parts[3]);
            if (typeof requests[ns] == 'undefined') {
                requests[ns] = {outnames:[], fields:[], trans:[]};
            }
            requests[ns].outnames.push(raw);
            requests[ns].fields.push(field);
            requests[ns].trans.push(trans);
        });
        return requests;
    }

    /**
     * Fetch data, and create a chain that only connects two data sources if they depend on each other
     * @param {Object} state The current "state" of the plot, such as chromosome and start/end positions
     * @param {String[]} fields The list of data fields specified in the `layout` for a specific data layer
     * @returns {Promise}
     */
    getData(state, fields) {
        var requests = this.__split_requests(fields);
        // Create an array of functions that, when called, will trigger the request to the specified datasource
        var request_handles = Object.keys(requests).map((key) => {
            if (!this._sources.get(key)) {
                throw new Error(`Datasource for namespace ${key} not found`);
            }
            return this._sources.get(key).getData(
                state,
                requests[key].fields,
                requests[key].outnames,
                requests[key].trans
            );
        });
        //assume the fields are requested in dependent order
        //TODO: better manage dependencies
        var ret = Promise.resolve({header:{}, body: [], discrete: {}});
        for (var i = 0; i < request_handles.length; i++) {
            // If a single datalayer uses multiple sources, perform the next request when the previous one completes
            ret = ret.then(request_handles[i]);
        }
        return ret;
    }
}


export default Requester;
