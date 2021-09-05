/**
 * Define standard data adapters used to retrieve data (usually from REST APIs)
 *
 * ## Adapters are responsible for retrieving data
 * In LocusZoom, the act of fetching data (from API, JSON file, or Tabix) is separate from the act of rendering data.
 * Adapters are used to handle retrieving from different sources, and can provide various advanced functionality such
 *  as caching, data harmonization, and annotating API responses with calculated fields. They can also be used to join
 *  two data sources, such as annotating association summary statistics with LD information.
 *
 * Most of LocusZoom's builtin layouts and adapters are written for the field names and data formats of the
 *  UMich [PortalDev API](https://portaldev.sph.umich.edu/docs/api/v1/#introduction):
 *  if your data is in a different format, an adapter can be used to coerce or rename fields.
 *  Although it is possible to change every part of a rendering layout to expect different fields, this is often much
 *  more work than providing data in the expected format.
 *
 * ## Creating data adapters
 * The documentation in this section describes the available data types and adapters. Real LocusZoom usage almost never
 *  creates these classes directly: rather, they are defined from configuration objects that ask for a source by name.
 *
 * The below example creates an object responsible for fetching two different GWAS summary statistics datasets from two different API endpoints, for any data
 *  layer that asks for fields from `trait1:fieldname` or `trait2:fieldname`.
 *
 *  ```
 *  const data_sources = new LocusZoom.DataSources();
 *  data_sources.add("trait1", ["AssociationLZ", {url: "http://server.com/api/single/", params: {source: 1}}]);
 *  data_sources.add("trait2", ["AssociationLZ", {url: "http://server.com/api/single/", params: {source: 2}}]);
 *  ```
 *
 *  These data sources are then passed to the plot when data is to be rendered:
 *  `const plot = LocusZoom.populate("#lz-plot", data_sources, layout);`
 *
 * @module LocusZoom_Adapters
 */

import {BaseUrlAdapter} from 'undercomplicate';


const REGEX_MARKER = /^(?:chr)?([a-zA-Z0-9]+?)[_:-](\d+)[_:|-]?(\w+)?[/_:|-]?([^_]+)?_?(.*)?/;


class BaseLZAdapter extends BaseUrlAdapter {
    constructor(config) {
        super(config);

        this._validate_fields = true;
        // Prefix the namespace for this source to all fieldnames: id -> assoc.id
        // This is useful for almost all layers because the layout object says where to find every field, exactly.
        // For some very complex data structure- mainly the Genes API payload- the datalayer might want to operate on
        //   that complex set of fields directly. Disable _prefix_namespace to get field names as they appear
        //   in the response. (gene_name instead of genes.gene_name)
        const {prefix_namespace} = config;
        this._prefix_namespace = (typeof prefix_namespace === 'boolean') ? prefix_namespace : true;
    }

    _getCacheKey(options) {
        // Most LZ adapters are fetching REGION data, and it makes sense to treat zooming as a cache hit by default
        let {chr, start, end} = options;  // Current view: plot.state

        // Does a prior cache hit qualify as a superset of the ROI?
        const superset = this._cache.find(({metadata: md}) => chr === md.chr && start >= md.start && end <= md.end);
        if (superset) {
            ({ chr, start, end } = superset.metadata);
        }

        // The default cache key is region-based, and this method only returns the region-based part of the cache hit
        //  That way, methods that override the key can extend the base value and still get the benefits of region-overlap-check
        options._cache_meta = { chr, start, end };
        return `${chr}_${start}_${end}`;
    }

    /**
     * Note: since namespacing is the last thing we usually want to do, calculations will want to call super AFTER their own code.
     * @param records
     * @param options
     * @returns {*}
     * @private
     */
    _postProcessResponse(records, options) {
        if (!this._prefix_namespace) {
            return records;
        }

        // Transform fieldnames to include the namespace name as a prefix. For example, a data layer that asks for
        //   assoc data might see "variant" as "assoc.variant"
        return records.map((row) => {
            return Object.entries(row).reduce(
                (acc, [label, value]) => {
                    acc[`${options._provider_name}.${label}`] = value;
                    return acc;
                },
                {}
            );
        });
    }

    /**
     * Convenience method, manually called in LZ sources that deal with dependent data.
     *
     * In the last step of fetching data, LZ adds a prefix to each field name.
     * This means that operations like "build query based on prior data" can't just ask for "log_pvalue" because
     *  they are receiving "assoc.log_pvalue" or some such unknown prefix.
     *
     * This lets use easily use dependent data
     *
     * @private
     */
    _findPrefixedKey(a_record, fieldname) {
        const suffixer = new RegExp(`\\.${fieldname}$`);
        const match = Object.keys(a_record).find((key) => suffixer.test(key));
        if (!match) {
            throw new Error(`Could not locate the required key name: ${fieldname} in dependent data`);
        }
        return match;
    }
}


class BaseUMAdapter extends BaseLZAdapter {
    constructor(config) {
        super(config);
        // The UM portaldev API accepts an (optional) parameter "genome_build"
        this._genome_build = config.genome_build;
    }

    _validateBuildSource(build, source) {
        // Build OR Source, not both
        if ((build && source) || !(build || source)) {
            throw new Error(`${this.constructor.name} must provide a parameter specifying either "build" or "source". It should not specify both.`);
        }
        // If the build isn't recognized, our APIs can't transparently select a source to match
        if (build && !['GRCh37', 'GRCh38'].includes(build)) {
            throw new Error(`${this.constructor.name} must specify a valid 'genome_build'`);
        }
    }

    // Special behavior for the UM portaldev API: col -> row format normalization
    _normalizeResponse(response_text, options) {
        let data = super._normalizeResponse(...arguments);
        // Most portaldev endpoints (though not all) store the desired response in just one specific part of the payload
        data = data.data || data;

        if (Array.isArray(data)) {
            // Already in the desired form
            return data;
        }
        // Otherwise, assume the server response is an object representing columns of data.
        // Each array should have the same length (verify), and a given array index corresponds to a single row.
        const keys = Object.keys(data);
        const N = data[keys[0]].length;
        const sameLength = keys.every(function (key) {
            const item = data[key];
            return item.length === N;
        });
        if (!sameLength) {
            throw new Error(`${this.constructor.name} expects a response in which all arrays of data are the same length`);
        }

        // Go down the columns, and create an object for each row record
        const records = [];
        const fields = Object.keys(data);
        for (let i = 0; i < N; i++) {
            const record = {};
            for (let j = 0; j < fields.length; j++) {
                record[fields[j]] = data[fields[j]][i];
            }
            records.push(record);
        }
        return records;
    }
}


class AssociationLZ extends BaseUMAdapter {
    constructor(config) {
        // Minimum adapter contract hard-codes fields contract based on UM PortalDev API
        // For layers that require more functionality, pass extra_fields to source options
        config.fields = ['variant', 'position', 'log_pvalue', 'ref_allele'];

        super(config);

        const { source } = config;
        if (!source) {
            throw new Error('Association adapter must specify dataset ID via "source" option');
        }
        this._source_id = source;
    }

    _getURL (state) {
        const {chr, start, end} = state;
        return `${this._url}results/?filter=analysis in ${this._source_id} and chromosome in  '${chr}' and position ge ${start} and position le ${end}`;
    }
}




class LDServer extends BaseUMAdapter {
    constructor(config) {
        // item1 = refvar, item2 = othervar
        config.fields = ['chromosome2', 'position2', 'variant2', 'correlation'];
        super(config);
    }

    _getURL(request_options) {
        const method = this._config.method || 'rsquare';
        const {
            chr, start, end,
            ld_refvar,
            genome_build, ld_source, ld_population,
        } = request_options;

        return  [
            this._url, 'genome_builds/', genome_build, '/references/', ld_source, '/populations/', ld_population, '/variants',
            '?correlation=', method,
            '&variant=', encodeURIComponent(ld_refvar),
            '&chrom=', encodeURIComponent(chr),
            '&start=', encodeURIComponent(start),
            '&stop=', encodeURIComponent(end),
        ].join('');
    }

    _buildRequestOptions(state, assoc_data) {
        if (!assoc_data) {
            throw new Error('LD request must depend on association data');
        }

        // If no state refvar is provided, find the most significant variant in any provided assoc data.
        //   Assumes that assoc satisfies the "assoc" fields contract, eg has fields variant and log_pvalue
        const base = super._buildRequestOptions(...arguments);
        if (!assoc_data.length) {
            base._skip_request = true;
            return base;
        }

        const assoc_variant_name = this._findPrefixedKey(assoc_data[0], 'variant');
        const assoc_logp_name = this._findPrefixedKey(assoc_data[0], 'log_pvalue');

        // Determine the reference variant (via user selected OR automatic-per-track)
        let refvar;
        let best_hit = {};
        if (state.ldrefvar) {
            // State/ldrefvar would store the variant in the format used by assoc data, so no need to clean up to match in data
            refvar = state.ldrefvar;
            best_hit = assoc_data.find((item) => item[assoc_variant_name] === refvar) || {};
        } else {
            // find highest log-value and associated var spec
            let best_logp = 0;
            for (let item of assoc_data) {
                const { [assoc_variant_name]: variant, [assoc_logp_name]: log_pvalue} = item;
                if (log_pvalue > best_logp) {
                    best_logp = log_pvalue;
                    refvar = variant;
                    best_hit = item;
                }
            }
        }

        // Add a special field that is not part of the assoc or LD data from the server, but has significance for plotting.
        //  Since we already know the best hit, it's easier to do this here rather than in annotate or join phase.
        best_hit.lz_is_ld_refvar = true;

        // Above, we compared the ldrefvar to the assoc data. But for talking to the LD server,
        //   the variant fields must be normalized to a specific format. All later LD operations will use that format.
        const match = refvar && refvar.match(REGEX_MARKER);
        if (!match) {
            throw new Error('Could not request LD for a missing or incomplete marker format');
        }

        const [_, chrom, pos, ref, alt] = match;
        // Currently, the LD server only accepts full variant specs; it won't return LD w/o ref+alt. Allowing
        //  a partial match at most leaves room for potential future features.
        refvar = `${chrom}:${pos}`; // FIXME: is this a server request that we can skip?
        if (ref && alt) {
            refvar += `_${ref}/${alt}`;
        }

        base.ld_refvar = refvar;

        // The LD source/pop can be overridden from plot.state, so that user choices can override initial source config
        const genome_build = state.genome_build || this._config.build || 'GRCh37'; // This isn't expected to change after the data is plotted.
        let ld_source = state.ld_source || this._config.source || '1000G';
        const ld_population = state.ld_pop || this._config.population || 'ALL';  // LDServer panels will always have an ALL

        if (ld_source === '1000G' && genome_build === 'GRCh38') {
            // For build 38 (only), there is a newer/improved 1000G LD panel available that uses WGS data. Auto upgrade by default.
            ld_source = '1000G-FRZ09';
        }

        this._validateBuildSource(genome_build, null);  // LD doesn't need to validate `source` option
        return Object.assign({}, base, { genome_build, ld_source, ld_population });
    }

    _getCacheKey(options) {
        // LD is keyed by more than just region; append other parameters to the base cache key
        const base = super._getCacheKey(options);
        const { ld_refvar, ld_source, ld_population } = options;
        return `${base}_${ld_refvar}_${ld_source}_${ld_population}`;
    }

    _performRequest(options) {
        // Skip request if this one depends on other data, in a region with no data
        if (options._skip_request) {
            return Promise.resolve([]);
        }
        // The UM LDServer uses API pagination; fetch all data by chaining requests when pages are detected
        const url = this._getURL(options);

        let combined = { data: {} };
        let chainRequests = function (url) {
            return fetch(url).then().then((response) => {
                if (!response.ok) {
                    throw new Error(response.statusText);
                }
                return response.text();
            }).then(function(payload) {
                payload = JSON.parse(payload);
                Object.keys(payload.data).forEach(function (key) {
                    combined.data[key] = (combined.data[key] || []).concat(payload.data[key]);
                });
                if (payload.next) {
                    return chainRequests(payload.next);
                }
                return combined;
            });
        };
        return chainRequests(url)
            .then((response) => JSON.stringify(response));
    }
}


// NOTE: Custom adapters are annotated with `see` instead of `extend` throughout this file, to avoid clutter in the developer API docs.
//  Most people using LZ data sources will never instantiate a class directly and certainly won't be calling internal
//  methods, except when implementing a subclass. For most LZ users, it's usually enough to acknowledge that the
//  private API methods exist in the base class.

/**
 * Base class for LocusZoom data sources (any). See also: BaseApiAdapter for requests from a remote URL.
 * @public
 */
class BaseAdapter {
    /**
     * @param {object} config Configuration options
     */
    constructor(config) {
        /**
         * Whether to enable caching (true for most data adapters)
         * @private
         * @member {Boolean}
         */
        this._enableCache = true;
        this._cachedKey = null;

        // Almost all LZ sources are "region based". Cache the region requested and use it to determine whether
        //   the cache would satisfy the request.
        this._cache_pos_start = null;
        this._cache_pos_end = null;

        /**
         * Whether this adapter type is dependent on previous requests- for example, the LD source cannot annotate
         *  association data if no data was found for that region.
         * @private
         * @member {boolean}
         */
        this.__dependentSource = false;

        // Parse configuration options
        this.parseInit(config);
    }

    /**
     * Parse configuration used to create the instance. Many custom sources will override this method to suit their
     *  needs (eg specific config options, or for sources that do not retrieve data from a URL)
     * @protected
     * @param {String|Object} config Basic configuration- either a url, or a config object
     * @param {String} [config.url] The datasource URL
     * @param {String} [config.params] Initial config params for the datasource
     */
    parseInit(config) {
        /**
         * @private
         * @member {Object}
         */
        this.params = config.params || {};
    }

    /**
     * A unique identifier that indicates whether cached data is valid for this request. For most sources using GET
     *  requests to a REST API, this is usually the region requested. Some sources will append additional params to define the request.
     *
     *  This means that to change caching behavior, both the URL and the cache key may need to be updated. However,
     *      it allows most datasources to skip an extra network request when zooming in.
     * @protected
     * @param {Object} state Information available in plot.state (chr, start, end). Sometimes used to inject globally
     *  available information that influences the request being made.
     * @param {Object} chain The data chain from previous requests made in a sequence.
     * @param fields
     * @returns {String}
     */
    getCacheKey(state, chain, fields) {
        // Most region sources, by default, will cache the largest region that satisfies the request: zooming in
        //  should be satisfied via the cache, but pan or region change operations will cause a network request

        // Some adapters rely on values set in chain.header during the getURL call. (eg, the LD source uses
        //  this to find the LD refvar) Calling this method is a backwards-compatible way of ensuring that value is set,
        //  even on a cache hit in which getURL otherwise wouldn't be called.
        // Some of the adapters that rely on this behavior are user-defined, hence compatibility hack
        this.getURL(state, chain, fields);

        const cache_pos_chr = state.chr;
        const {_cache_pos_start, _cache_pos_end} = this;
        if (_cache_pos_start && state.start >= _cache_pos_start && _cache_pos_end && state.end <= _cache_pos_end ) {
            return `${cache_pos_chr}_${_cache_pos_start}_${_cache_pos_end}`;
        } else {
            return `${state.chr}_${state.start}_${state.end}`;
        }
    }

    /**
     * Stub: build the URL for any requests made by this source.
     * @protected
     */
    getURL(state, chain, fields) {
        return this.url;
    }

    /**
     * Perform a network request to fetch data for this source. This is usually the method that is used to override
     *  when defining how to retrieve data.
     * @protected
     * @param {Object} state The state of the parent plot
     * @param chain
     * @param fields
     * @returns {Promise}
     */
    fetchRequest(state, chain, fields) {
        const url = this.getURL(state, chain, fields);
        return fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            return response.text();
        });
    }

    /**
     * Gets the data for just this source, typically via a network request (but using cache where possible)
     *
     * For most use cases, it is better to override `fetchRequest` instead, to avoid bypassing the cache mechanism
     * by accident.
     * @protected
     * @return {Promise}
     */
    getRequest(state, chain, fields) {
        let req;
        const cacheKey = this.getCacheKey(state, chain, fields);

        if (this._enableCache && typeof(cacheKey) !== 'undefined' && cacheKey === this._cachedKey) {
            req = Promise.resolve(this._cachedResponse);  // Resolve to the value of the current promise
        } else {
            req = this.fetchRequest(state, chain, fields);
            if (this._enableCache) {
                this._cachedKey = cacheKey;
                this._cache_pos_start = state.start;
                this._cache_pos_end = state.end;
                this._cachedResponse = req;
            }
        }
        return req;
    }

    /**
     * Ensure the server response is in a canonical form, an array of one object per record. [ {field: oneval} ].
     * If the server response contains columns, reformats the response from {column1: [], column2: []} to the above.
     *
     * Does not apply namespacing, transformations, or field extraction.
     *
     * May be overridden by data adapters that inherently return more complex payloads, or that exist to annotate other
     *  sources (eg, if the payload provides extra data rather than a series of records).
     * @protected
     * @param {Object[]|Object} data The original parsed server response
     */
    normalizeResponse(data) {
        if (Array.isArray(data)) {
            // Already in the desired form
            return data;
        }
        // Otherwise, assume the server response is an object representing columns of data.
        // Each array should have the same length (verify), and a given array index corresponds to a single row.
        const keys = Object.keys(data);
        const N = data[keys[0]].length;
        const sameLength = keys.every(function (key) {
            const item = data[key];
            return item.length === N;
        });
        if (!sameLength) {
            throw new Error(`${this.constructor.name} expects a response in which all arrays of data are the same length`);
        }

        // Go down the rows, and create an object for each record
        const records = [];
        const fields = Object.keys(data);
        for (let i = 0; i < N; i++) {
            const record = {};
            for (let j = 0; j < fields.length; j++) {
                record[fields[j]] = data[fields[j]][i];
            }
            records.push(record);
        }
        return records;
    }

    /**
     * Hook to post-process the data returned by this source with new, additional behavior.
     *   (eg cleaning up API values or performing complex calculations on the returned data)
     *
     * @protected
     * @param {Object[]} records The parsed data from the source (eg standardized api response)
     * @param {Object} chain The data chain object. For example, chain.headers may provide useful annotation metadata
     * @returns {Object[]|Promise} The modified set of records
     */
    annotateData(records, chain) {
        // Default behavior: no transformations
        return records;
    }

    /**
     * Clean up the server records for use by datalayers: extract only certain fields, with the specified names.
     *   Apply per-field transformations as appropriate.
     *
     * This hook can be overridden, eg to create a source that always returns all records and ignores the "fields" array.
     *  This is particularly common for sources at the end of a chain- many "dependent" sources do not allow
     *  cherry-picking individual fields, in which case by **convention** the fields array specifies "last_source_name:all"
     *
     * @protected
     * @param {Object[]} data One record object per element
     * @param {String[]} fields The names of fields to extract (as named in the source data). Eg "afield"
     * @param {String[]} outnames How to represent the source fields in the output. Eg "namespace:afield|atransform"
     * @param {function[]} trans An array of transformation functions (if any). One function per data element, or null.
     * @protected
     */
    extractFields (data, fields, outnames, trans) {
        //intended for an array of objects
        //  [ {"id":1, "val":5}, {"id":2, "val":10}]
        // Since a number of sources exist that do not obey this format, we will provide a convenient pass-through
        if (!Array.isArray(data)) {
            return data;
        }

        if (!data.length) {
            // Sometimes there are regions that just don't have data- this should not trigger a missing field error message!
            return data;
        }

        const fieldFound = [];
        for (let k = 0; k < fields.length; k++) {
            fieldFound[k] = 0;
        }

        const records = data.map(function (item) {
            const output_record = {};
            for (let j = 0; j < fields.length; j++) {
                let val = item[fields[j]];
                if (typeof val != 'undefined') {
                    fieldFound[j] = 1;
                }
                if (trans && trans[j]) {
                    val = trans[j](val);
                }
                output_record[outnames[j]] = val;
            }
            return output_record;
        });
        fieldFound.forEach(function(v, i) {
            if (!v) {
                throw new Error(`field ${fields[i]} not found in response for ${outnames[i]}`);
            }
        });
        return records;
    }

    /**
     * Combine records from this source with others in the chain to yield final chain body.
     *   Handles merging this data with other sources (if applicable).
     *
     * @protected
     * @param {Object[]} data The data That would be returned from this source alone
     * @param {Object} chain The data chain built up during previous requests
     * @param {String[]} fields
     * @param {String[]} outnames
     * @param {String[]} trans
     * @return {Promise|Object[]} The new chain body
     */
    combineChainBody(data, chain, fields, outnames, trans) {
        return data;
    }

    /**
     * Coordinates the work of parsing a response and returning records. This is broken into 4 steps, which may be
     *  overridden separately for fine-grained control. Each step can return either raw data or a promise.
     *
     * @see {module:LocusZoom_Adapters~BaseAdapter#normalizeResponse}
     * @see {module:LocusZoom_Adapters~BaseAdapter#annotateData}
     * @see {module:LocusZoom_Adapters~BaseAdapter#extractFields}
     * @see {module:LocusZoom_Adapters~BaseAdapter#combineChainBody}
     * @protected
     *
     * @param {String|Object} resp The raw data associated with the response
     * @param {Object} chain The combined parsed response data from this and all other requests made in the chain
     * @param {String[]} fields Array of requested field names (as they would appear in the response payload)
     * @param {String[]} outnames  Array of field names as they will be represented in the data returned by this source,
     *  including the namespace. This must be an array with the same length as `fields`
     * @param {Function[]} trans The collection of transformation functions to be run on selected fields.
     *     This must be an array with the same length as `fields`
     * @returns {Promise} A promise that resolves to an object containing
     *   request metadata (`headers: {}`), the consolidated data for plotting (`body: []`), and the individual responses that would be
     *   returned by each source in the chain in isolation (`discrete: {}`)
     */
    parseResponse (resp, chain, fields, outnames, trans) {
        const source_id = this.source_id || this.constructor.name;
        if (!chain.discrete) {
            chain.discrete = {};
        }

        const json = typeof resp == 'string' ? JSON.parse(resp) : resp;

        // Perform the 4 steps of parsing the payload and return a combined chain object
        return Promise.resolve(this.normalizeResponse(json.data || json))
            .then((standardized) => {
                // Perform calculations on the data from just this source
                return Promise.resolve(this.annotateData(standardized, chain));
            }).then((data) => {
                return Promise.resolve(this.extractFields(data, fields, outnames, trans));
            }).then((one_source_body) => {
                // Store a copy of the data that would be returned by parsing this source in isolation (and taking the
                //   fields array into account). This is useful when we want to re-use the source output in many ways.
                chain.discrete[source_id] = one_source_body;
                return Promise.resolve(this.combineChainBody(one_source_body, chain, fields, outnames, trans));
            }).then((new_body) => {
                return { header: chain.header || {}, discrete: chain.discrete, body: new_body };
            });
    }

    /**
     * Fetch the data from the specified data adapter, and apply transformations requested by an external consumer.
     * This is the public-facing datasource method that will most be called by the plot, but custom data adapters will
     *  almost never want to override this method directly- more specific hooks are provided to control individual pieces
     *  of the request lifecycle.
     *
     * @private
     * @param {Object} state The current "state" of the plot, such as chromosome and start/end positions
     * @param {String[]} fields Array of field names that the plot has requested from this data adapter. (without the "namespace" prefix)
     * @param {String[]} outnames  Array describing how the output data should refer to this field. This represents the
     *     originally requested field name, including the namespace. This must be an array with the same length as `fields`
     * @param {Function[]} trans The collection of transformation functions to be run on selected fields.
     *     This must be an array with the same length as `fields`
     * @returns {function} A callable operation that can be used as part of the data chain
     */
    getData(state, fields, outnames, trans) {
        if (this.preGetData) { // TODO try to remove this method if at all possible
            const pre = this.preGetData(state, fields, outnames, trans);
            if (this.pre) {
                state = pre.state || state;
                fields = pre.fields || fields;
                outnames = pre.outnames || outnames;
                trans = pre.trans || trans;
            }
        }

        return (chain) => {
            if (this.__dependentSource && chain && chain.body && !chain.body.length) {
                // A "dependent" source should not attempt to fire a request if there is no data for it to act on.
                // Therefore, it should simply return the previous data chain.
                return Promise.resolve(chain);
            }

            return this.getRequest(state, chain, fields).then((resp) => {
                return this.parseResponse(resp, chain, fields, outnames, trans);
            });
        };
    }
}

/**
 * Base class for LocusZoom data adapters that receive their data over the web. Adds default config parameters
 *  (and potentially other behavior) that are relevant to URL-based requests.
 * @extends module:LocusZoom_Adapters~BaseAdapter
 * @param {string} config.url The URL for the remote dataset. By default, most adapters perform a GET request.
 * @inheritDoc
 */
class BaseApiAdapter extends BaseAdapter {
    parseInit(config) {
        super.parseInit(config);

        /**
         * @private
         * @member {String}
         */
        this.url = config.url;
        if (!this.url) {
            throw new Error('Source not initialized with required URL');
        }
    }
}


/**
 * Fetch GWAS catalog data for a list of known variants, and align the data with previously fetched association data.
 * There can be more than one claim per variant; this adapter is written to support a visualization in which each
 * association variant is labeled with the single most significant hit in the GWAS catalog. (and enough information to link to the external catalog for more information)
 *
 * Sometimes the GWAS catalog uses rsIDs that could refer to more than one variant (eg multiple alt alleles are
 *  possible for the same rsID). To avoid missing possible hits due to ambiguous meaning, we connect the assoc
 *  and catalog data via the position field, not the full variant specifier. This source will auto-detect the matching
 *  field in association data by looking for the field name `position` or `pos`.
 *
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 */
class GwasCatalogLZ extends BaseUMAdapter {
    /**
     * @param {string} config.url The base URL for the remote data.
     * @param {Object} config.params
     * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
     *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
     * @param {Number} [config.params.source] The ID of the chosen catalog. Most usages should omit this parameter and
     *  let LocusZoom choose the newest available dataset to use based on the genome build: defaults to recent EBI GWAS catalog, GRCh37.
     */
    constructor(config) {
        config.fields = ['rsid', 'trait', 'log_pvalue'];
        super(config);
    }

    /**
     * Add query parameters to the URL to construct a query for the specified region
     */
    _getURL(request_options) {
        const build = request_options.genome_build || this._config.build;
        const source = this._config.source;
        this._validateBuildSource(build, source);

        // If a build name is provided, it takes precedence (the API will attempt to auto-select newest dataset based on the requested genome build).
        //  Build and source are mutually exclusive, because hard-coded source IDs tend to be out of date
        const source_query = build ? `&build=${build}` : ` and id eq ${source}`;
        return `${this._url  }?format=objects&sort=pos&filter=chrom eq '${request_options.chr}' and pos ge ${request_options.start} and pos le ${request_options.end}${source_query}`;
    }
}

/**
 * Retrieve Gene Data, as fetched from the LocusZoom/Portaldev API server (or compatible format)
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {string} config.url The base URL for the remote data
 * @param {Object} config.params
 * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
 *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
 * @param {Number} [config.params.source] The ID of the chosen gene dataset. Most usages should omit this parameter and
 *  let LocusZoom choose the newest available dataset to use based on the genome build: defaults to recent GENCODE data, GRCh37.
 */
class GeneLZ extends BaseUMAdapter {
    constructor(config) {
        super(config);

        // The UM Genes API has a very complex internal format and the genes layer is written to work with it exactly as given.
        //  We will avoid transforming or modifying the payload.
        this._validate_fields = false;
        this._prefix_namespace = false;
    }

    /**
     * Add query parameters to the URL to construct a query for the specified region
     */
    _getURL(request_options) {
        const build = request_options.genome_build || this._config.build;
        let source = this._config.source;
        this._validateBuildSource(build, source);

        // If a build name is provided, it takes precedence (the API will attempt to auto-select newest dataset based on the requested genome build).
        //  Build and source are mutually exclusive, because hard-coded source IDs tend to be out of date
        const source_query = build ? `&build=${build}` : ` and source in ${source}`;
        return `${this._url}?filter=chrom eq '${request_options.chr}' and start le ${request_options.end} and end ge ${request_options.start}${source_query}`;
    }
}

/**
 * Retrieve Gene Constraint Data, as fetched from the gnomAD server (or compatible graphQL api endpoint)
 *
 * This is intended to be the second request in a chain, with special logic that connects it to Genes data
 *  already fetched. It assumes that the genes data is returned from the UM API, and thus the logic involves
 *  matching on specific assumptions about `gene_name` format.
 *
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 */
class GeneConstraintLZ extends BaseLZAdapter {
    /**
     * @param {string} config.url The base URL for the remote data
     * @param {Object} config.params
     * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
     *   May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
     */
    constructor(config) {
        super(config);
        this._validate_fields = false;
        this._prefix_namespace = false;
    }

    _buildRequestOptions(options, genes_data) {
        const build = options.genome_build || this._config.build;
        if (!build) {
            throw new Error(`Adapter ${this.constructor.name} must specify a 'genome_build' option`);
        }

        const unique_gene_names = new Set();
        for (let gene of genes_data) {
            // In rare cases, the same gene symbol may appear at multiple positions. (issue #179) We de-duplicate the
            //  gene names to avoid issuing a malformed GraphQL query.
            unique_gene_names.add(gene.gene_name);
        }

        options.query = [...unique_gene_names.values()].map(function (gene_name) {
            // GraphQL alias names must match a specific set of allowed characters: https://stackoverflow.com/a/45757065/1422268
            const alias = `_${gene_name.replace(/[^A-Za-z0-9_]/g, '_')}`;
            // Each gene symbol is a separate graphQL query, grouped into one request using aliases
            return `${alias}: gene(gene_symbol: "${gene_name}", reference_genome: ${build}) { gnomad_constraint { exp_syn obs_syn syn_z oe_syn oe_syn_lower oe_syn_upper exp_mis obs_mis mis_z oe_mis oe_mis_lower oe_mis_upper exp_lof obs_lof pLI oe_lof oe_lof_lower oe_lof_upper } } `;
        });
        options.build = build;
        return Object.assign({}, options);
    }

    /**
     * The gnomAD API has a very complex internal data format. Bypass any record parsing or transform steps.
     */
    _normalizeResponse(response_text) {
        const data = JSON.parse(response_text);
        return data.data;
    }

    _performRequest(options) {
        let {query, build} = options;
        if (!query.length || query.length > 25 || build === 'GRCh38') {
            // Skip the API request when it would make no sense:
            // - Build 38 (gnomAD supports build GRCh37 only; don't hit server when invalid. This isn't future proof, but we try to be good neighbors.)
            // - Too many genes (gnomAD appears to set max cost ~25 genes)
            // - No genes in region (hence no constraint info)
            return Promise.resolve([]);
        }
        query = `{${query.join(' ')} }`; // GraphQL isn't quite JSON; items are separated by spaces but not commas

        const url = this._getURL(options);

        // See: https://graphql.org/learn/serving-over-http/
        const body = JSON.stringify({ query: query });
        const headers = { 'Content-Type': 'application/json' };

        // Note: The gnomAD API sometimes fails randomly.
        // If request blocked, return  a fake "no data" signal so the genes track can still render w/o constraint info
        return fetch(url, { method: 'POST', body, headers }).then((response) => {
            if (!response.ok) {
                return [];
            }
            return response.text();
        }).catch((err) => []);
    }
}

/**
 * Retrieve Recombination Rate Data, as fetched from the LocusZoom API server (or compatible)
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {string} config.url The base URL for the remote data
 * @param {Object} config.params
 * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
 *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
 * @param {Number} [config.params.source] The ID of the chosen dataset. Most usages should omit this parameter and
 *  let LocusZoom choose the newest available dataset to use based on the genome build: defaults to recent HAPMAP recombination rate, GRCh37.
 */
class RecombLZ extends BaseUMAdapter {
    /**
     * Add query parameters to the URL to construct a query for the specified region
     */
    _getURL(request_options) {
        const build = request_options.genome_build || this._config.build;
        let source = this._config.source;
        this._validateBuildSource(build, source);

        // If a build name is provided, it takes precedence (the API will attempt to auto-select newest dataset based on the requested genome build).
        //  Build and source are mutually exclusive, because hard-coded source IDs tend to be out of date
        const source_query = build ? `&build=${build}` : ` and id in ${source}`;
        return `${this._url}?filter=chromosome eq '${request_options.chr}' and position le ${request_options.end} and position ge ${request_options.start}${source_query}`;
    }
}

/**
 * Retrieve static blobs of data as raw JS objects. This does not perform additional parsing, which is required
 *  for some sources (eg it does not know how to join together LD and association data).
 *
 * Therefore it is the responsibility of the user to pass information in a format that can be read and
 * understood by the chosen plot- a StaticJSON source is rarely a drop-in replacement for existing layouts.
 *
 * This source is largely here for legacy reasons. More often, a convenient way to serve static data is as separate
 *  JSON files to an existing source (with the JSON url in place of an API).
 *
 *  Note: The name is a bit misleading. It receives JS objects, not strings serialized as "json".
 * @public
 * @see module:LocusZoom_Adapters~BaseAdapter
 * @param {object} data The data to be returned by this source (subject to namespacing rules)
 */
class StaticSource extends BaseLZAdapter {
    constructor(config) {
        // Does not receive any config; the only argument is the raw data, embedded when source is created
        super(...arguments);
        this._data = config.data;
    }

    _performRequest(options) {
        return Promise.resolve(this._data);
    }
}

/**
 * Retrieve PheWAS data retrieved from a LocusZoom/PortalDev compatible API
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {string} config.url The base URL for the remote data
 * @param {Object} config.params
 * @param {String[]} config.params.build This datasource expects to be provided the name of the genome build that will
 *   be used to provide pheWAS results for this position. Note positions may not translate between builds.
 */
class PheWASLZ extends BaseUMAdapter {
    _getURL(request_options) {
        const build = (request_options.genome_build ? [request_options.genome_build] : null) || this._config.build;
        if (!build || !Array.isArray(build) || !build.length) {
            throw new Error(['Adapter', this.constructor.name, 'requires that you specify array of one or more desired genome build names'].join(' '));
        }
        const url = [
            this._url,
            "?filter=variant eq '", encodeURIComponent(request_options.variant), "'&format=objects&",
            build.map(function (item) {
                return `build=${encodeURIComponent(item)}`;
            }).join('&'),
        ];
        return url.join('');
    }

    _getCacheKey(options) {
        // Not a region based source; don't do anything smart for cache check
        return this._getURL(options);
    }
}

export { BaseAdapter, BaseApiAdapter, BaseLZAdapter, BaseUMAdapter };

export {
    AssociationLZ,
    GeneConstraintLZ,
    GeneLZ,
    GwasCatalogLZ,
    LDServer,
    PheWASLZ,
    RecombLZ,
    StaticSource,
};
