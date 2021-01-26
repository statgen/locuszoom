/**
 * Optional LocusZoom extension: must be included separately, and after LocusZoom has been loaded
 *
 * This plugin exports helper functions, but does not modify the global registry. It does not require `LocusZoom.use`.
 *
 * Demonstrates a mechanism by which the plot can be loaded to a specific initial state based on the URL query string
 *  (and, optionally, to update the URL bar when the plot state changes, with back button support)
 *
 * This makes it possible to create "direct links" to a particular plot of interest (and go back to a previous state
 *  as the user interacts with the page). Optionally, there is support for custom callbacks to connect the URL to
 *  arbitrarily complex plot behaviors.
 *
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN:
 * ```
 * <script src="https://cdn.jsdelivr.net/npm/locuszoom@INSERT_VERSION_HERE/dist/ext/lz-dynamic-urls.min.js" type="application/javascript"></script>
 * ```
 *
 * To use with ES6 modules, import the helper functions and use them with your layout:
 *
 * ```
 * import LzDynamicUrls from 'locuszoom/esm/ext/lz-dynamic-urls';
 * ```
 *
 * After loading, bind the plot and URL as follows:
 * ```
 * // Declares which fields in plot.state will be mapped to and from the URL, eg `plot.state.chr` -> `example.com?chrom=X`
 * const stateUrlMapping = {chr: "chrom", start: "start", end: "end"};
 * // Fetch initial position from the URL, or use some defaults
 * let initialState = LzDynamicUrls.paramsFromUrl(stateUrlMapping);
 * if (!Object.keys(initialState).length) {
 *     initialState = {chr: 10, start: 114550452, end: 115067678};
 * }
 * layout = LocusZoom.Layouts.get("plot", "standard_association", {state: initialState});
 * const plot = LocusZoom.populate("#lz-plot", data_sources, layout);
 * // Once the plot has been created, we can bind it to the URL as follows. This will cause the URL to change whenever
 * //  the plot region changes, or, clicking the back button in your browser will reload the last region viewed
 * LzDynamicUrls.plotUpdatesUrl(plot, stateUrlMapping);
 * LzDynamicUrls.plotWatchesUrl(plot, stateUrlMapping);
 *
 * // NOTE: If you are building a page that adds/removes plots on the fly, event listeners will be cleaned up when
 * //   the destructor `plot.destroy()` is called
 * ```
 *
 *  @module
 */

function _serializeQueryParams(paramsObj) {
    // Serialize an object of parameter values into a query string
    // TODO: Improve support for array values v[]=1&v[]=2
    return `?${
        Object.keys(paramsObj).map(function(key) {
            return `${encodeURIComponent(key)}=${encodeURIComponent(paramsObj[key])}`;
        }).join('&')}`;
}

function _parseQueryParams(queryString) {
    // Parse a query string into an object of parameter values.
    //   Does not attempt any type coercion; all values are, therefore, strings.
    // TODO future: Support arrays / params that specify more than one value
    const query = {};
    if (queryString) {
        const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i].split('=');
            query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }
    }
    return query;
}

// A useful helper function for serializing values from a provided object
function _extractValues(data, mapping, reverse) {
    // Use the mapping to convert between {stateField: urlParam} (or the reverse). Any fields not referenced in
    //  the "key" side of the mapping will be omitted from the return value.
    // Likewise, will omit any requested keys that the source side of the mapping has no information for
    reverse = reverse || false;

    const ret = {};
    let newMapping = mapping;
    if (reverse) {
        newMapping = {};
        Object.keys(mapping).forEach(function(k) {
            newMapping[mapping[k]] = k;
        });
    }

    Object.keys(newMapping).forEach(function(k) {
        const asName = newMapping[k];
        if (Object.prototype.hasOwnProperty.call(data, k)) {
            ret[asName] = data[k];
        }

    });
    return ret;
}

function _setStateFromUrlHandler(plot, stateData) {
    // A default way to deal with URL changes: push all the params as state into plot and rerender
    // More complex handlers are possible- example, URL parameters could be used to add or remove data layers
    plot.applyState(stateData);
}

function _setUrlFromStateHandler(plot, mapping) {
    // Serialize and return basic query params based solely on information from plot.state
    // More complex handlers are possible- the serializer can extract any information desired because it is given
    //  a direct reference to the plot object

    // This default method does not use the eventContext data, because so many things change plot.state without
    //  officially triggering an event.
    return _extractValues(plot.state, mapping);
}

/**
 * Extract plot parameters from the URL query string. Very useful for setting up the plot on initial page load.
 * @param {object} mapping How to map elements of plot state to URL param fields. Hash of
 *      {plotFieldName: urlParamName} entries (both values should be unique)
 * @param {string} [queryString='window.location.search'] The query string to parse
 * @returns {object} Plot parameter values
 */
function paramsFromUrl(mapping, queryString) {
    // Internal helper function: second argument only used for unit testing
    queryString = queryString || window.location.search;
    const queryParams = _parseQueryParams(queryString);
    return _extractValues(queryParams, mapping, true);
}

/**
 * Allows the plot to monitor changes in the URL and take action when the URL changes.
 *
 * For example, this enables using the browser back button to jump to a previous plot after user interaction.
 *
 * @param {Plot} plot A reference to the LZ plot
 * @param {object} mapping How to map elements of plot state to URL param fields. Hash of
 *      {plotFieldName: urlParamName} entries (both values should be unique)
 * @param {function} [callback] Specify how the plot acts on information read in from query params.
 *   The default behavior is to push the data into `plot.state`
 *   Signature is function(plot, plotDataFromQueryString)
 * @returns {function} The function handle for the new listener (allows cleanup if plot is removed later)
 */
function plotWatchesUrl(plot, mapping, callback) {
    callback = callback || _setStateFromUrlHandler;

    const listener = function (event) {
        const urlData = paramsFromUrl(mapping);
        // Tell the plot what to do with the params extracted from the URL
        callback(plot, urlData);
    };
    window.addEventListener('popstate', listener);
    plot.trackExternalListener(window, 'popstate', listener);
    return listener;
}

/**
 * Update the URL whenever the plot state changes
 * @param {Plot} plot A reference to the LZ plot
 * @param {object} mapping How to map elements of plot state to URL param fields. Hash of
 *      {plotFieldName: urlParamName} entries (both values should be unique)
 * @param {function} [callback] Specify how plot data will be serialized into query params
 *   The default behavior is to extract all the URL params from plot.state as the only source.
 *   Signature is function(plot, mapping, eventContext)
 * @returns {function} The function handle for the new listener (allows cleanup if plot is removed later)
 * @listens event:state_changed
 */
function plotUpdatesUrl(plot, mapping, callback) {
    callback = callback || _setUrlFromStateHandler;
    // Note: this event only fires when applyState receives *new* information that would trigger a rerender.
    // Plot state is sometimes changed without the event being fired.
    const listener = function (eventContext) {
        const oldParams = _parseQueryParams(window.location.search);
        // Apply custom serialization to convert plot data to URL params
        const serializedPlotData = callback(plot, mapping, eventContext);
        const newParams = Object.assign({}, oldParams, serializedPlotData);

        const update = Object.keys(newParams).some(function (k) {
            // Not every state change would affect the URL. Allow type coercion since query is a string.
            // eslint-disable-next-line eqeqeq
            return (oldParams[k] != newParams[k]);
        });
        if (update) {
            const queryString = _serializeQueryParams(newParams);

            if (Object.keys(oldParams).length) {
                history.pushState({}, document.title, queryString);
            } else {
                // Prevent broken back behavior on first page load: the first time query params are set,
                //  we don't generate a separate history entry
                history.replaceState({}, document.title, queryString);
            }

        }
    };
    plot.on('state_changed', listener);
    return listener;
}

// Slight build quirk: we use a single webpack file for all modules, but `libraryTarget` expects the entire
//  module to be exported as `default` in <script> tag mode.
const all = {
    paramsFromUrl,
    extractValues: _extractValues,
    plotUpdatesUrl,
    plotWatchesUrl,
};

export default all;
export { paramsFromUrl, _extractValues as extractValues, plotUpdatesUrl, plotWatchesUrl };
