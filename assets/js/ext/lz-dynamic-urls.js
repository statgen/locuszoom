/**
 * Optional LocusZoom extension: must be included separately, and after LocusZoom has been loaded
 *
 * Demonstrates a mechanism by which the plot can be loaded to a specific initial state based on the URL query string
 *  (and, optionally, to update the URL bar when the plot state changes, with back button support)
 *
 * This makes it possible to create "direct links" to a particular plot of interest (and go back to a previous state
 *  as the user interacts with the page). Optionally, there is support for custom callbacks to connect the URL to
 *  arbitrarily complex plot behaviors.
 */
'use strict';

// This is defined as a UMD module, to work with multiple different module systems / bundlers
/* global define, module, require */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['locuszoom'], function(LocusZoom) {  // amd
            return factory(LocusZoom);
        });
    } else if(typeof module === 'object' && module.exports) {  // commonJS
        module.exports = factory(require('locuszoom'));
    } else {  // globals
        root.LocusZoom.ext.DynamicUrls = factory(root.LocusZoom);
    }
}(this, function(LocusZoom) {
    function _serializeQueryParams(paramsObj) {
        // Serialize an object of parameter values into a query string
        // TODO: Improve support for array values v[]=1&v[]=2
        return '?' +
            Object.keys(paramsObj).map(function(key) {
                return encodeURIComponent(key) + '=' +
                    encodeURIComponent(paramsObj[key]);
            }).join('&');
    }

    function _parseQueryParams(queryString) {
        // Parse a query string into an object of parameter values.
        //   Does not attempt any type coercion; all values are, therefore, strings.
        // TODO future: Support arrays / params that specify more than one value
        var query = {};
        if (queryString) {
            var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split('=');
                query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
            }
        }
        return query;
    }

    function _extractValues(data, mapping, reverse) {
        // Use the mapping to convert between {stateField: urlParam} (or the reverse). Any fields not referenced in
        //  the "key" side of the mapping will be omitted from the return value.
        // Likewise, will omit any requested keys that the source side of the mapping has no information for
        reverse = reverse || false;

        var ret = {};
        var newMapping = mapping;
        if (reverse) {
            newMapping = {};
            Object.keys(mapping).forEach(function(k) { newMapping[mapping[k]] = k; });
        }

        Object.keys(newMapping).forEach(function(k) {
            var asName = newMapping[k];
            if (data.hasOwnProperty(k)) {
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

    function paramsFromUrl(mapping, queryString) {
        // Internal helper function: second argument only used for unit testing
        queryString = queryString || window.location.search;
        var queryParams = _parseQueryParams(queryString);
        return _extractValues(queryParams, mapping, true);
    }

    // Public interface for this extension
    return {
        /**
         * Extract plot parameters from the URL query string. Very useful for setting up the plot on initial page load.
         * @param {object} mapping How to map elements of plot state to URL param fields. Hash of
         *      {plotFieldName: urlParamName} entries (both values should be unique)
         * @param {string} [queryString='window.location.search'] The query string to parse
         * @returns {object} Plot parameter values
         */
        paramsFromUrl: paramsFromUrl,

        /**
         * Allows the plot to monitor changes in the URL and take action when the URL changes.
         *
         * For example, this enables using the browser back button to jump to a previous plot after user interaction.
         *
         * @param {LocusZoom.Plot} plot A reference to the LZ plot
         * @param {object} mapping How to map elements of plot state to URL param fields. Hash of
         *      {plotFieldName: urlParamName} entries (both values should be unique)
         * @param {function} [callback] Specify how the plot acts on information read in from query params.
         *   The default behavior is to push the data into `plot.state`
         *   Signature is function(plot, plotDataFromQueryString)
         * @returns {function} The function handle for the new listener (allows cleanup if plot is removed later)
         */
        plotWatchesUrl: function(plot, mapping, callback) {
            callback = callback || _setStateFromUrlHandler;

            var listener = function(event) {
                var urlData = paramsFromUrl(mapping);
                // Tell the plot what to do with the params extracted from the URL
                callback(plot, urlData);
            };
            window.addEventListener('popstate', listener);
            return listener;
        },
        /**
         * Update the URL whenever the plot state changes
         * @param {LocusZoom.Plot} plot A reference to the LZ plot
         * @param {object} mapping How to map elements of plot state to URL param fields. Hash of
         *      {plotFieldName: urlParamName} entries (both values should be unique)
         * @param {function} [callback] Specify how plot data will be serialized into query params
         *   The default behavior is to extract all the URL params from plot.state as the only source.
         *   Signature is function(plot, mapping, eventContext)
         * @returns {function} The function handle for the new listener (allows cleanup if plot is removed later)
         */
        plotUpdatesUrl: function(plot, mapping, callback) {
            callback = callback || _setUrlFromStateHandler;
            // Note: this event only fires when applyState receives *new* information that would trigger a rerender.
            // Plot state is sometimes changed without the event being fired.
            var listener = function(eventContext) {
                var oldParams = _parseQueryParams(window.location.search);
                // Apply custom serialization to convert plot data to URL params
                var serializedPlotData = callback(plot, mapping, eventContext);
                var newParams = Object.assign({}, oldParams, serializedPlotData);

                // Not every state change would affect the URL. Allow type coercion since query is a string.
                // eslint-disable-next-line eqeqeq
                var update = Object.keys(newParams).some(function(k) { return (oldParams[k] != newParams[k]); });
                if (update) {
                    var queryString = _serializeQueryParams(newParams);

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
        },
        // A useful helper function for serializing values from a provided object
        extractValues: _extractValues
    };
}));
