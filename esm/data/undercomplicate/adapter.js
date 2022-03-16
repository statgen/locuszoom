import {LRUCache} from './lru_cache';
import {clone} from './util';

/**
 * @param {boolean} [config.cache_enabled=true] Whether to enable the LRU cache, and store a copy of the normalized and parsed response data.
 *  Turned on by default for most remote requests; turn off if you are using another datastore (like Vuex) or if the response body uses too much memory.
 * @param {number} [config.cache_size=3] How many requests to cache. Track-dependent annotations like LD might benefit
 *   from caching more items, while very large payloads (like, um, TOPMED LD) might benefit from a smaller cache size.
 *   For most LocusZoom usages, the cache is "region aware": zooming in will use cached data, not a separate request
 * @inheritDoc
 * @memberOf module:undercomplicate
 */
class BaseAdapter {
    constructor(config = {}) {
        this._config = config;
        const {
            // Cache control
            cache_enabled = true,
            cache_size = 3,
        } = config;
        this._enable_cache = cache_enabled;
        this._cache = new LRUCache(cache_size);
    }

    /**
     * Build an object with options that control the request. This can take into account both explicit options, and prior data.
     * @param {Object} options Any global options passed in via `getData`. Eg, in locuszoom, every request is passed a copy of `plot.state` as the options object, in which case every adapter would expect certain basic information like `chr, start, end` to be available.
     * @param {Object[]} dependent_data If the source is called with dependencies, this function will receive one argument with the fully parsed response data from each other source it depends on. Eg, `ld(assoc)` means that the LD adapter would be called with the data from an association request as a function argument. Each dependency is its own argument: there can be 0, 1, 2, ...N arguments.
     * @returns {*} An options object containing initial options, plus any calculated values relevant to the request.
     * @public
     */
    _buildRequestOptions(options, dependent_data) {
        // Perform any pre-processing required that may influence the request. Receives an array with the payloads
        //  for each request that preceded this one in the dependency chain
        // This method may optionally take dependent data into account. For many simple adapters, there won't be any dependent data!
        return Object.assign({}, options);
    }

    /**
     * Determine how this request is uniquely identified in cache. Usually this is an exact match for the same key, but it doesn't have to be.
     * The LRU cache implements a `find` method, which means that a cache item can optionally be identified by its node
     * `metadata` (instead of exact key match).
     *  This is useful for situations where the user zooms in to a smaller region and wants the original request to
     *  count as a cache hit. See subclasses for example.
     * @param {object} options Request options from `_buildRequestOptions`
     * @returns {*} This is often a string concatenating unique values for a compound cache key, like `chr_start_end`. If null, it is treated as a cache miss.
     * @public
     */
    _getCacheKey(options) {
        /* istanbul ignore next */
        if (this._enable_cache) {
            throw new Error('Method not implemented');
        }
        return null;
    }

    /**
     * Perform the act of data retrieval (eg from a URL, blob, or JSON entity)
     * @param {object} options Request options from `_buildRequestOptions`
     * @returns {Promise}
     * @public
     */
    _performRequest(options) {
        /* istanbul ignore next */
        throw new Error('Not implemented');
    }

    /**
     * Convert the response format into a list of objects, one per datapoint. Eg split lines of a text file, or parse a blob of json.
     * @param {*} response_text The raw response from performRequest, be it text, binary, etc. For most web based APIs, it is assumed to be text, and often JSON.
     * @param {Object} options Request options. These are not typically used when normalizing a response, but the object is available.
     * @returns {*} A list of objects, each object representing one row of data `{column_name: value_for_row}`
     * @public
     */
    _normalizeResponse(response_text, options) {
        return response_text;
    }

    /**
     * Perform custom client-side operations on the retrieved data. For example, add calculated fields or
     *  perform rapid client-side filtering on cached data. Annotations are applied after cache, which means
     *  that the same network request can be dynamically annotated/filtered in different ways in response to user interactions.
     *
     * This result is currently not cached, but it may become so in the future as responsibility for dynamic UI
     *   behavior moves to other layers of the application.
     * @param {Object[]} records
     * @param {Object} options
     * @returns {*}
     * @public
     */
    _annotateRecords(records, options) {
        return records;
    }

    /**
     * A hook to transform the response after all operations are done. For example, this can be used to prefix fields
     *  with a namespace unique to the request, like `log_pvalue` -> `assoc:log_pvalue`. (by applying namespace prefixes to field names last,
     *  annotations and validation can happen on the actual API payload, without having to guess what the fields were renamed to).
     * @param records
     * @param options
     * @public
     */
    _postProcessResponse(records, options) {
        return records;
    }

    /**
     * All adapters must implement this method to asynchronously return data. All other methods are simply internal hooks to customize the actual request for data.
     * @param {object} options Shared options for this request. In LocusZoom, this is typically a copy of `plot.state`.
     * @param {Array[]} dependent_data Zero or more recordsets corresponding to each individual adapter that this one depends on.
     *  Can be used to build a request that takes into account prior data.
     * @returns {Promise<*>}
     */
    getData(options = {}, ...dependent_data) {
        // Public facing method to define, perform, and process the request
        options = this._buildRequestOptions(options, ...dependent_data);

        const cache_key = this._getCacheKey(options);

        // Then retrieval and parse steps: parse + normalize response, annotate
        let result;
        if (this._enable_cache && this._cache.has(cache_key)) {
            result = this._cache.get(cache_key);
        } else {
            // Cache the promise (to avoid race conditions in conditional fetch). If anything (like `_getCacheKey`)
            //  sets a special option value called `_cache_meta`, this will be used to annotate the cache entry
            // For example, this can be used to decide whether zooming into a view could be satisfied by a cache entry,
            //  even if the actual cache key wasn't an exact match. (see subclasses for an example; this class is generic)
            result = Promise.resolve(this._performRequest(options))
                // Note: we cache the normalized (parsed) response
                .then((text) => this._normalizeResponse(text, options));
            this._cache.add(cache_key, result, options._cache_meta);
            // We are caching a promise, which means we want to *un*cache a promise that rejects, eg a failed or interrupted request
            //  Otherwise, temporary failures couldn't be resolved by trying again in a moment
            // TODO: In the future, consider providing a way to skip requests (eg, a sentinel value to flag something
            //  as not cacheable, like "no dependent data means no request... but maybe in another place this is used, there will be different dependent data and a request would make sense")
            result.catch((e) => this._cache.remove(cache_key));
        }

        return result
            // Return a deep clone of the data, so that there are no shared mutable references to a parsed object in cache
            .then((data) => clone(data))
            .then((records) => this._annotateRecords(records, options))
            .then((records) => this._postProcessResponse(records, options));
    }
}


/**
 * Fetch data over the web, usually from a REST API that returns JSON
 * @param {string} config.url The URL to request
 * @extends module:undercomplicate.BaseAdapter
 * @inheritDoc
 * @memberOf module:undercomplicate
 */
class BaseUrlAdapter extends BaseAdapter {
    constructor(config = {}) {
        super(config);
        this._url = config.url;
    }


    /**
     * Default cache key is the URL for this request
     * @public
     */
    _getCacheKey(options) {
        return this._getURL(options);
    }

    /**
     * In many cases, the base url should be modified with query parameters based on request options.
     * @param options
     * @returns {*}
     * @private
     */
    _getURL(options) {
        return this._url;
    }

    _performRequest(options) {
        const url = this._getURL(options);
        // Many resources will modify the URL to add query or segment parameters. Base method provides option validation.
        //  (not validating in constructor allows URL adapter to be used as more generic parent class)
        if (!this._url) {
            throw new Error('Web based resources must specify a resource URL as option "url"');
        }
        return fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            return response.text();
        });
    }

    _normalizeResponse(response_text, options) {
        if (typeof response_text === 'string') {
            return JSON.parse(response_text);
        }
        // Some custom usages will return other datatypes. These would need to be handled by custom normalization logic in a subclass.
        return response_text;
    }
}

export { BaseAdapter, BaseUrlAdapter };
