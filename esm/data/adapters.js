/**
 * Define standard data adapters used to retrieve data (usually from REST APIs)
 * @module LocusZoom_Adapters
 */

function validateBuildSource(class_name, build, source) {
    // Build OR Source, not both
    if ((build && source) || !(build || source)) {
        throw new Error(`${class_name} must provide a parameter specifying either "build" or "source". It should not specify both.`);
    }
    // If the build isn't recognized, our APIs can't transparently select a source to match
    if (build && !['GRCh37', 'GRCh38'].includes(build)) {
        throw new Error(`${class_name} must specify a valid genome build number`);
    }
}


// NOTE: Custom adapaters are annotated with `see` instead of `extend` throughout this file, to avoid clutter in the developer API docs.
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
         * Whether this source should enable caching (true for most data sources)
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
         * Whether this data source type is dependent on previous requests- for example, the LD source cannot annotate
         *  association data if no data was found for that region.
         * @private
         * @member {boolean}
         */
        this.__dependentSource = false;

        // Parse configuration options
        this.parseInit(config);
    }

    /**
     * Parse configuration used to create the data source. Many custom sources will override this method to suit their
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

        // Some data source rely on values set in chain.header during the getURL call. (eg, the LD source uses
        //  this to find the LD refvar) Calling this method is a backwards-compatible way of ensuring that value is set,
        //  even on a cache hit in which getURL otherwise wouldn't be called.
        // Some of the data sources that rely on this behavior are user-defined, hence compatibility hack
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
     * May be overridden by data sources that inherently return more complex payloads, or that exist to annotate other
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
     * Fetch the data from the specified data source, and apply transformations requested by an external consumer.
     * This is the public-facing datasource method that will most be called by the plot, but custom data sources will
     *  almost never want to override this method directly- more specific hooks are provided to control individual pieces
     *  of the request lifecycle.
     *
     * @private
     * @param {Object} state The current "state" of the plot, such as chromosome and start/end positions
     * @param {String[]} fields Array of field names that the plot has requested from this data source. (without the "namespace" prefix)
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
 * Base source for LocusZoom data sources that receive their data over the web. Adds default config parameters
 *  (and potentially other behavior) that are relevant to URL-based requests.
 * @extends module:LocusZoom_Adapters~BaseAdapter
 * @param {object} config
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
 * Data Source for Association Data from the LocusZoom/ Portaldev API (or compatible). Defines how to make a request
 *  to a specific REST API.
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {object} config Configuration options
 * @param {string} config.url The base URL for the remote data.
 * @param {object} [config.params]
 * @param [config.params.sort=false] Whether to sort the association data (by an assumed field named "position"). This
 *   is primarily a site-specific workaround for a particular LZ usage; we encourage apis to sort by position before returning
 *   data to the browser.
 * @param [config.params.source] The ID of the GWAS dataset to use for this request, as matching the API backend
 */
class AssociationLZ extends BaseApiAdapter {
    preGetData (state, fields, outnames, trans) {
        // TODO: Modify internals to see if we can go without this method
        const id_field = this.params.id_field || 'id';
        [id_field, 'position'].forEach(function(x) {
            if (!fields.includes(x)) {
                fields.unshift(x);
                outnames.unshift(x);
                trans.unshift(null);
            }
        });
        return {fields: fields, outnames:outnames, trans:trans};
    }

    /**
     * Add query parameters to the URL to construct a query for the specified region
     */
    getURL (state, chain, fields) {
        const analysis = chain.header.analysis || this.params.source || this.params.analysis;  // Old usages called this param "analysis"
        if (typeof analysis == 'undefined') {
            throw new Error('Association source must specify an analysis ID to plot');
        }
        return `${this.url}results/?filter=analysis in ${analysis} and chromosome in  '${state.chr}' and position ge ${state.start} and position le ${state.end}`;
    }

    /**
     * Some association sources do not sort their data in a predictable order, which makes it hard to reliably
     *   align with other sources (such as LD). For performance reasons, sorting is an opt-in argument.
     *   TODO: Consider more fine grained sorting control in the future. This was added as a very specific
     *    workaround for the original T2D portal.
     * @protected
     * @param data
     * @return {Object}
     */
    normalizeResponse (data) {
        data = super.normalizeResponse(data);
        if (this.params && this.params.sort && data.length && data[0]['position']) {
            data.sort(function (a, b) {
                return a['position'] - b['position'];
            });
        }
        return data;
    }
}

/**
 * Fetch linkage disequilibrium information from a UMich LDServer-compatible API, relative to a reference variant.
 *  If no `plot.state.ldrefvar` is explicitly provided, this source will attempt to find the most significant GWAS
 *  variant (smallest pvalue or largest neg_log_pvalue) and yse that as the LD reference variant.
 *
 * This source is designed to connect its results to association data, and therefore depends on association data having
 *  been loaded by a previous request in the data chain. For custom association APIs, some additional options might
 *  need to be be specified in order to locate the most significant SNP. Variant IDs of the form `chrom:pos_ref/alt`
 *  are preferred, but this source will attempt to harmonize other common data formats into something that the LD
 *  server can understand.
 *
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 */
class LDServer extends BaseApiAdapter {
    /**
     * @param {object} config Configuration options
     * @param {string} config.url The base URL for the remote data.
     * @param {object} config.params
     * @param [config.params.build='GRCh37'] The genome build to use when calculating LD relative to a specified reference variant.
     *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
     * @param [config.params.source='1000G'] The name of the reference panel to use, as specified in the LD server instance.
     *  May be overridden by a global parameter `plot.state.ld_source` to implement widgets that alter LD display.
     * @param [config.params.population='ALL'] The sample population used to calculate LD for a specified source;
     *  population names vary depending on the reference panel and how the server was populated wth data.
     *  May be overridden by a global parameter `plot.state.ld_pop` to implement widgets that alter LD display.
     * @param [config.params.method='rsquare'] The metric used to calculate LD
     * @param [config.params.id_field] The association data field that contains variant identifier information. The preferred
     *   format of LD server is `chrom:pos_ref/alt` and this source will attempt to normalize other common formats.
     *   This source can auto-detect possible matches for field names containing "variant" or "id"
     * @param [config.params.position_field] The association data field that contains variant position information.
     *   This source can auto-detect possible matches for field names containing "position" or "pos"
     * @param [config.params.pvalue_field] The association data field that contains pvalue information.
     *   This source can auto-detect possible matches for field names containing "pvalue" or "log_pvalue".
     *   The suggested LD refvar will be the smallest pvalue, or the largest log_pvalue: this source will auto-detect
     *   the word "log" in order to determine the sign of the comparison.
     */
    constructor(config) {
        super(config);
        this.__dependentSource = true;
    }

    preGetData(state, fields) {
        if (fields.length > 1) {
            if (fields.length !== 2 || !fields.includes('isrefvar')) {
                throw new Error(`LD does not know how to get all fields: ${fields.join(', ')}`);
            }
        }
    }

    findMergeFields(chain) {
        // Find the fields (as provided by a previous step in the chain, like an association source) that will be needed to
        //  combine LD data with existing information

        // Since LD information may be shared across multiple assoc sources with different namespaces,
        //   we use regex to find columns to join on, rather than requiring exact matches
        const exactMatch = function (arr) {
            return function () {
                const regexes = arguments;
                for (let i = 0; i < regexes.length; i++) {
                    const regex = regexes[i];
                    const m = arr.filter(function (x) {
                        return x.match(regex);
                    });
                    if (m.length) {
                        return m[0];
                    }
                }
                return null;
            };
        };
        let dataFields = {
            id: this.params.id_field,
            position: this.params.position_field,
            pvalue: this.params.pvalue_field,
            _names_:null,
        };
        if (chain && chain.body && chain.body.length > 0) {
            const names = Object.keys(chain.body[0]);
            const nameMatch = exactMatch(names);
            // Internally, fields are generally prefixed with the name of the source they come from.
            // If the user provides an id_field (like `variant`), it should work across data sources( `assoc1:variant`,
            //  assoc2:variant), but not match fragments of other field names (assoc1:variant_thing)
            // Note: these lookups hard-code a couple of common fields that will work based on known APIs in the wild
            const id_match = dataFields.id && nameMatch(new RegExp(`${dataFields.id}\\b`));
            dataFields.id = id_match || nameMatch(/\bvariant\b/) || nameMatch(/\bid\b/);
            dataFields.position = dataFields.position || nameMatch(/\bposition\b/i, /\bpos\b/i);
            dataFields.pvalue = dataFields.pvalue || nameMatch(/\bpvalue\b/i, /\blog_pvalue\b/i);
            dataFields._names_ = names;
        }
        return dataFields;
    }

    findRequestedFields (fields, outnames) {
        // Assumption: all usages of this source will only ever ask for "isrefvar" or "state". This maps to output names.
        let obj = {};
        for (let i = 0; i < fields.length; i++) {
            if (fields[i] === 'isrefvar') {
                obj.isrefvarin = fields[i];
                obj.isrefvarout = outnames && outnames[i];
            } else {
                obj.ldin = fields[i];
                obj.ldout = outnames && outnames[i];
            }
        }
        return obj;
    }

    /**
     * The LD API payload does not obey standard format conventions; do not try to transform it.
     */
    normalizeResponse (data) {
        return data;
    }

    /**
     * Get the LD reference variant, which by default will be the most significant hit in the assoc results
     *   This will be used in making the original query to the LD server for pairwise LD information.
     *
     * This is meant to join a single LD request to any number of association results, and to work with many kinds of API.
     *   To do this, the datasource looks for fields with special known names such as pvalue, log_pvalue, etc.
     *   If your API uses different nomenclature, an option must be specified.
     *
     * @protected
     * @returns {String[]} Two strings: 1) the marker id (expected to be in `chr:pos_ref/alt` format) of the reference
     *  variant, and 2) the marker ID as it appears in the original dataset that we are joining to, so that the exact
     *  refvar can be marked when plotting the data..
     */
    getRefvar(state, chain, fields) {
        let findExtremeValue = function(records, pval_field) {
            // Finds the most significant hit (smallest pvalue, or largest -log10p). Will try to auto-detect the appropriate comparison.
            pval_field = pval_field || 'log_pvalue';  // The official LZ API returns log_pvalue
            const is_log = /log/.test(pval_field);
            let cmp;
            if (is_log) {
                cmp = function(a, b) {
                    return a > b;
                };
            } else {
                cmp = function(a, b) {
                    return a < b;
                };
            }
            let extremeVal = records[0][pval_field], extremeIdx = 0;
            for (let i = 1; i < records.length; i++) {
                if (cmp(records[i][pval_field], extremeVal)) {
                    extremeVal = records[i][pval_field];
                    extremeIdx = i;
                }
            }
            return extremeIdx;
        };

        let reqFields = this.findRequestedFields(fields);
        let refVar = reqFields.ldin;
        if (refVar === 'state') {
            refVar = state.ldrefvar || chain.header.ldrefvar || 'best';
        }
        if (refVar === 'best') {
            if (!chain.body) {
                throw new Error('No association data found to find best pvalue');
            }
            let keys = this.findMergeFields(chain);
            if (!keys.pvalue || !keys.id) {
                let columns = '';
                if (!keys.id) {
                    columns += `${columns.length ? ', ' : ''}id`;
                }
                if (!keys.pvalue) {
                    columns += `${columns.length ? ', ' : ''}pvalue`;
                }
                throw new Error(`Unable to find necessary column(s) for merge: ${columns} (available: ${keys._names_})`);
            }
            refVar = chain.body[findExtremeValue(chain.body, keys.pvalue)][keys.id];
        }
        // Some datasets, notably the Portal, use a different marker format.
        //  Coerce it into one that will work with the LDServer API. (CHROM:POS_REF/ALT)
        const REGEX_MARKER = /^(?:chr)?([a-zA-Z0-9]+?)[_:-](\d+)[_:|-]?(\w+)?[/_:|-]?([^_]+)?_?(.*)?/;
        const match = refVar && refVar.match(REGEX_MARKER);

        if (!match) {
            throw new Error('Could not request LD for a missing or incomplete marker format');
        }
        const [original, chrom, pos, ref, alt] = match;
        // Currently, the LD server only accepts full variant specs; it won't return LD w/o ref+alt. Allowing
        //  a partial match at most leaves room for potential future features.
        let refVar_formatted = `${chrom}:${pos}`;
        if (ref && alt) {
            refVar_formatted += `_${ref}/${alt}`;
        }

        return [refVar_formatted, original];
    }

    /**
     * Identify (or guess) the LD reference variant, then add query parameters to the URL to construct a query for the specified region
     */
    getURL(state, chain, fields) {
        // The LD source/pop can be overridden from plot.state for dynamic layouts
        const build = state.genome_build || this.params.build || 'GRCh37'; // This isn't expected to change after the data is plotted.
        let source = state.ld_source || this.params.source || '1000G';
        const population = state.ld_pop || this.params.population || 'ALL';  // LDServer panels will always have an ALL
        const method = this.params.method || 'rsquare';

        if (source === '1000G' && build === 'GRCh38') {
            // For build 38 (only), there is a newer/improved 1000G LD panel available that uses WGS data. Auto upgrade by default.
            source = '1000G-FRZ09';
        }

        validateBuildSource(this.constructor.name, build, null);  // LD doesn't need to validate `source` option

        const [refVar_formatted, refVar_raw] = this.getRefvar(state, chain, fields);

        // Preserve the user-provided variant spec for use when matching to assoc data
        chain.header.ldrefvar = refVar_raw;

        return  [
            this.url, 'genome_builds/', build, '/references/', source, '/populations/', population, '/variants',
            '?correlation=', method,
            '&variant=', encodeURIComponent(refVar_formatted),
            '&chrom=', encodeURIComponent(state.chr),
            '&start=', encodeURIComponent(state.start),
            '&stop=', encodeURIComponent(state.end),
        ].join('');
    }

    /**
     * The LD adapter caches based on region, reference panel, and population name
     * @param state
     * @param chain
     * @param fields
     * @return {string}
     */
    getCacheKey(state, chain, fields) {
        const base = super.getCacheKey(state, chain, fields);
        let source = state.ld_source || this.params.source || '1000G';
        const population = state.ld_pop || this.params.population || 'ALL';  // LDServer panels will always have an ALL
        const [refVar, _] = this.getRefvar(state, chain, fields);
        return `${base}_${refVar}_${source}_${population}`;
    }

    /**
     * The LD adapter attempts to intelligently match retrieved LD information to a request for association data earlier in the data chain.
     * Since each layer only asks for the data needed for that layer, one LD call is sufficient to annotate many separate association tracks.
     */
    combineChainBody(data, chain, fields, outnames, trans) {
        let keys = this.findMergeFields(chain);
        let reqFields = this.findRequestedFields(fields, outnames);
        if (!keys.position) {
            throw new Error(`Unable to find position field for merge: ${keys._names_}`);
        }
        const leftJoin = function (left, right, lfield, rfield) {
            let i = 0, j = 0;
            while (i < left.length && j < right.position2.length) {
                if (left[i][keys.position] === right.position2[j]) {
                    left[i][lfield] = right[rfield][j];
                    i++;
                    j++;
                } else if (left[i][keys.position] < right.position2[j]) {
                    i++;
                } else {
                    j++;
                }
            }
        };
        const tagRefVariant = function (data, refvar, idfield, outrefname, outldname) {
            for (let i = 0; i < data.length; i++) {
                if (data[i][idfield] && data[i][idfield] === refvar) {
                    data[i][outrefname] = 1;
                    data[i][outldname] = 1; // For label/filter purposes, implicitly mark the ref var as LD=1 to itself
                } else {
                    data[i][outrefname] = 0;
                }
            }
        };

        // LD servers vary slightly. Some report corr as "rsquare", others as "correlation"
        let corrField = data.rsquare ? 'rsquare' : 'correlation';
        leftJoin(chain.body, data, reqFields.ldout, corrField);
        if (reqFields.isrefvarin && chain.header.ldrefvar) {
            tagRefVariant(chain.body, chain.header.ldrefvar, keys.id, reqFields.isrefvarout, reqFields.ldout);
        }
        return chain.body;
    }

    /**
     * The LDServer API is paginated, but we need all of the data to render a plot. Depaginate and combine where appropriate.
     */
    fetchRequest(state, chain, fields) {
        let url = this.getURL(state, chain, fields);
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
        return chainRequests(url);
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
 * @param {object} config Configuration options
 * @param {string} config.url The base URL for the remote data.
 * @param {Object} [config.params] Optional parameters
 * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
 *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
 * @param {Number} [config.params.source=6] The ID of the chosen catalog. Most usages should omit this parameter and
 *  let LocusZoom choose the newest available dataset to use based on the genome build: defaults to recent EBI GWAS catalog, GRCh37.
 */
class GwasCatalogLZ extends BaseApiAdapter {
    constructor(config) {
        super(config);
        this.__dependentSource = true;
    }

    /**
     * Add query parameters to the URL to construct a query for the specified region
     */
    getURL(state, chain, fields) {
        // This is intended to be aligned with another source- we will assume they are always ordered by position, asc
        //  (regardless of the actual match field)
        const build_option = state.genome_build || this.params.build;
        validateBuildSource(this.constructor.name, build_option, null); // Source can override build- not mutually exclusive

        // Most of our annotations will respect genome build before any other option.
        //   But there can be more than one GWAS catalog version available in the same API, for the same build- an
        //   explicit config option will always take
        //   precedence.
        // See: http://portaldev.sph.umich.edu/api/v1/annotation/gwascatalog/?format=objects
        const default_source = (build_option === 'GRCh38') ? 5 : 6;  // EBI GWAS catalog
        const source = this.params.source || default_source;
        return `${this.url  }?format=objects&sort=pos&filter=id eq ${source} and chrom eq '${state.chr}' and pos ge ${state.start} and pos le ${state.end}`;
    }

    findMergeFields(records) {
        // Data from previous sources is already namespaced. Find the alignment field by matching.
        const knownFields = Object.keys(records);
        // Note: All API endoints involved only give results for 1 chromosome at a time; match is implied
        const posMatch = knownFields.find(function (item) {
            return item.match(/\b(position|pos)\b/i);
        });

        if (!posMatch) {
            throw new Error('Could not find data to align with GWAS catalog results');
        }
        return { 'pos': posMatch };
    }

    extractFields (data, fields, outnames, trans) {
        // Skip the "individual field extraction" step; extraction will be handled when building chain body instead
        return data;
    }

    /**
     * Intelligently combine the LD data with the association data used for this data layer. See class description
     *  for a summary of how this works.
     */
    combineChainBody(data, chain, fields, outnames, trans) {
        if (!data.length) {
            return chain.body;
        }

        //  TODO: Better reuse options in the future. This source is very specifically tied to the UM PortalDev API, where
        //   the field name is always "log_pvalue". Relatively few sites will write their own gwas-catalog endpoint.
        const decider = 'log_pvalue';
        const decider_out = outnames[fields.indexOf(decider)];

        function leftJoin(left, right, fields, outnames, trans) { // Add `fields` from `right` to `left`
            // Add a synthetic, un-namespaced field to all matching records
            const n_matches = left['n_catalog_matches'] || 0;
            left['n_catalog_matches'] = n_matches + 1;
            if (decider && left[decider_out] && left[decider_out] > right[decider]) {
                // There may be more than one GWAS catalog entry for the same SNP. This source is intended for a 1:1
                //  annotation scenario, so for now it only joins the catalog entry that has the best -log10 pvalue
                return;
            }

            for (let j = 0; j < fields.length; j++) {
                const fn = fields[j];
                const outn = outnames[j];

                let val = right[fn];
                if (trans && trans[j]) {
                    val = trans[j](val);
                }
                left[outn] = val;
            }
        }

        const chainNames = this.findMergeFields(chain.body[0]);
        const catNames = this.findMergeFields(data[0]);

        var i = 0, j = 0;
        while (i < chain.body.length && j < data.length) {
            var left = chain.body[i];
            var right = data[j];

            if (left[chainNames.pos] === right[catNames.pos]) {
                // There may be multiple catalog entries for each matching SNP; evaluate match one at a time
                leftJoin(left, right, fields, outnames, trans);
                j += 1;
            } else if (left[chainNames.pos] < right[catNames.pos]) {
                i += 1;
            } else {
                j += 1;
            }
        }
        return chain.body;
    }
}

/**
 * Data Source for Gene Data, as fetched from the LocusZoom/Portaldev API server (or compatible format)
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {object} Configuration options
 * @param {string} config.url The base URL for the remote data
 * @param {Object} [config.params] Optional parameters
 * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
 *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
 * @param {Number} [config.params.source=5] The ID of the chosen gene dataset. Most usages should omit this parameter and
 *  let LocusZoom choose the newest available dataset to use based on the genome build: defaults to recent GENCODE data, GRCh37.
 */
class GeneLZ extends BaseApiAdapter {
    /**
     * Add query parameters to the URL to construct a query for the specified region
     */
    getURL(state, chain, fields) {
        const build = state.genome_build || this.params.build;
        let source = this.params.source;
        validateBuildSource(this.constructor.name, build, source);

        if (build) {
            // If build specified, we auto-select the best current portaldev API dataset for that build
            // If build is not specified, we use the exact source ID provided by the user.
            // See: https://portaldev.sph.umich.edu/api/v1/annotation/genes/sources/?format=objects
            source = (build === 'GRCh38') ? 4 : 5;
        }
        return `${this.url}?filter=source in ${source} and chrom eq '${state.chr}' and start le ${state.end} and end ge ${state.start}`;
    }

    /**
     * The UM genes API has a very complex internal data format. Bypass any record parsing, and provide the data layer with
     *  the exact information returned by the API. (ignoring the fields array in the layout)
     * @param data
     * @return {Object[]|Object}
     */
    normalizeResponse(data) {
        return data;
    }

    /**
     * Does not attempt to namespace or modify the fields from the API payload; the payload format is very complex and
     *  quite coupled with the data rendering implementation.
     * Typically, requests to this adapter specify a single dummy field sufficient to trigger the request: `fields:[ 'gene:all' ]`
     */
    extractFields(data, fields, outnames, trans) {
        return data;
    }
}

/**
 * Data Source for Gene Constraint Data, as fetched from the gnomAD server (or compatible graphQL api endpoint)
 *
 * This is intended to be the second request in a chain, with special logic that connects it to Genes data
 *  already fetched. It assumes that the genes data is returned from the UM API, and thus the logic involves
 *  matching on specific assumptions about `gene_name` format.
 *
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {object} Configuration options
 * @param {string} config.url The base URL for the remote data
 * @param {Object} [config.params] Optional parameters
 * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
 *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
 */
class GeneConstraintLZ extends BaseApiAdapter {
    constructor(config) {
        super(config);
        this.__dependentSource = true;
    }

    /**
     * GraphQL API: request details are encoded in the body, not the URL
     */
    getURL() {
        return this.url;
    }

    /**
     * The gnomAD API has a very complex internal data format. Bypass any record parsing, and provide the data layer with
     *  the exact information returned by the API.
     */
    normalizeResponse(data) {
        return data;
    }

    fetchRequest(state, chain, fields) {
        const build = state.genome_build || this.params.build;
        if (!build) {
            throw new Error(`Data source ${this.constructor.name} must specify a 'genome_build' option`);
        }

        const unique_gene_names = chain.body.reduce(
            // In rare cases, the same gene symbol may appear at multiple positions. (issue #179) We de-duplicate the
            //  gene names to avoid issuing a malformed GraphQL query.
            function (acc, gene) {
                acc[gene.gene_name] = null;
                return acc;
            },
            {}
        );
        let query = Object.keys(unique_gene_names).map(function (gene_name) {
            // GraphQL alias names must match a specific set of allowed characters: https://stackoverflow.com/a/45757065/1422268
            const alias = `_${gene_name.replace(/[^A-Za-z0-9_]/g, '_')}`;
            // Each gene symbol is a separate graphQL query, grouped into one request using aliases
            return `${alias}: gene(gene_symbol: "${gene_name}", reference_genome: ${build}) { gnomad_constraint { exp_syn obs_syn syn_z oe_syn oe_syn_lower oe_syn_upper exp_mis obs_mis mis_z oe_mis oe_mis_lower oe_mis_upper exp_lof obs_lof pLI oe_lof oe_lof_lower oe_lof_upper } } `;
        });

        if (!query.length) {
            // If there are no genes, skip the network request
            return Promise.resolve({ data: null });
        }

        query = `{${query.join(' ')} }`; // GraphQL isn't quite JSON; items are separated by spaces but not commas
        const url = this.getURL(state, chain, fields);
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

    /**
     * Annotate GENCODE data (from a previous request to the genes adapter) with additional gene constraint data from
     *   the gnomAD API. See class description for a summary of how this works.
     */
    combineChainBody(data, chain, fields, outnames, trans) {
        if (!data) {
            return chain;
        }

        chain.body.forEach(function(gene) {
            // Find payload keys that match gene names in this response
            const alias = `_${gene.gene_name.replace(/[^A-Za-z0-9_]/g, '_')}`;  // aliases are modified gene names
            const constraint = data[alias] && data[alias]['gnomad_constraint']; // gnomad API has two ways of specifying missing data for a requested gene
            if (constraint) {
                // Add all fields from constraint data- do not override fields present in the gene source
                Object.keys(constraint).forEach(function (key) {
                    let val = constraint[key];
                    if (typeof gene[key] === 'undefined') {
                        if (typeof val == 'number' && val.toString().includes('.')) {
                            val = parseFloat(val.toFixed(2));
                        }
                        gene[key] = val;   // These two sources are both designed to bypass namespacing
                    }
                });
            }
        });
        return chain.body;
    }
}

/**
 * Data Source for Recombination Rate Data, as fetched from the LocusZoom API server (or compatible)
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {object} Configuration options
 * @param {string} config.url The base URL for the remote data
 * @param {Object} [config.params] Optional parameters
 * @param [config.params.build] The genome build to use when calculating LD relative to a specified reference variant.
 *  May be overridden by a global parameter `plot.state.genome_build` so that all datasets can be fetched for the appropriate build in a consistent way.
 * @param {Number} [config.params.source=15] The ID of the chosen dataset. Most usages should omit this parameter and
 *  let LocusZoom choose the newest available dataset to use based on the genome build: defaults to recent HAPMAP recombination rate, GRCh37.
 */
class RecombLZ extends BaseApiAdapter {
    /**
     * Add query parameters to the URL to construct a query for the specified region
     */
    getURL(state, chain, fields) {
        const build = state.genome_build || this.params.build;
        let source = this.params.source;
        validateBuildSource(this.constructor.SOURCE_NAME, build, source);

        if (build) { // If build specified, choose a known Portal API dataset IDs (build 37/38)
            source = (build === 'GRCh38') ? 16 : 15;
        }
        return `${this.url}?filter=id in ${source} and chromosome eq '${state.chr}' and position le ${state.end} and position ge ${state.start}`;
    }
}

/**
 * Data Source for static blobs of data as raw JS objects. This does not perform additional parsing, which is required
 *  for some sources (eg it does not know how to join together LD and association data).
 *
 * Therefore it is the responsibility of the user to pass information in a format that can be read and
 * understood by the chosen plot- a StaticJSON source is rarely a drop-in replacement for existing layouts.
 *
 * This source is largely here for legacy reasons. More often, a convenient way to serve static data is as separate
 *  JSON files to an existing source (with the JSON url in place of an API).
 * @public
 * @see module:LocusZoom_Adapters~BaseAdapter
 * @param {object} data The data to be returned by this source (subject to namespacing rules)
 */
class StaticSource extends BaseAdapter {
    parseInit(data) {
        // Does not receive any config; the only argument is the raw data, embedded when source is created
        this._data = data;
    }

    getRequest(state, chain, fields) {
        return Promise.resolve(this._data);
    }
}


/**
 * Data source for PheWAS data retrieved from a LocusZoom/PortalDev compatible API
 * @public
 * @see module:LocusZoom_Adapters~BaseApiAdapter
 * @param {object} Configuration options
 * @param {string} config.url The base URL for the remote data
 * @param {Object} [config.params] Optional parameters
 * @param {String[]} config.params.build This datasource expects to be provided the name of the genome build that will
 *   be used to provide pheWAS results for this position. Note positions may not translate between builds.
 */
class PheWASLZ extends BaseApiAdapter {
    getURL(state, chain, fields) {
        const build = (state.genome_build ? [state.genome_build] : null) || this.params.build;
        if (!build || !Array.isArray(build) || !build.length) {
            throw new Error(['Data source', this.constructor.SOURCE_NAME, 'requires that you specify array of one or more desired genome build names'].join(' '));
        }
        const url = [
            this.url,
            "?filter=variant eq '", encodeURIComponent(state.variant), "'&format=objects&",
            build.map(function (item) {
                return `build=${encodeURIComponent(item)}`;
            }).join('&'),
        ];
        return url.join('');
    }

    getCacheKey(state, chain, fields) {
        // This is not a region-based source; it doesn't make sense to cache by a region
        return this.getURL(state, chain, fields);
    }
}


/**
 * Base class for "connectors"- this is a highly specialized kind of adapter that is rarely used in most LocusZoom
 *  deployments. This is meant to be subclassed, rather than used directly.
 *
 * A connector is a data adapter that makes no server requests and caches no data of its own. Instead, it decides how to
 *  combine data from other sources in the chain. Connectors are useful when we want to request (or calculate) some
 *  useful piece of information once, but apply it to many different kinds of record types.
 *
 * Typically, a subclass will implement the field merging logic in `combineChainBody`.
 *
 * @public
 * @see module:LocusZoom_Adapters~BaseAdapter
 */
class ConnectorSource extends BaseAdapter {
    /**
     * @param {Object} config Configuration for this source
     * @param {Object} [config.params] Optional parameters
     * @param {Object} config.params.sources Specify how the hard-coded logic should find the data it relies on in the chain,
     *  as {internal_name: chain_source_id} pairs. This allows writing a reusable connector that does not need to make
     *  assumptions about what namespaces a source is using.     *
     */
    constructor(config) {
        super(config);

        if (!config || !config.sources) {
            throw new Error('Connectors must specify the data they require as config.sources = {internal_name: chain_source_id}} pairs');
        }

        /**
         * Tells the connector how to find the data it relies on
         *
         * For example, a connector that applies burden test information to the genes layer might specify:
         *  {gene_ns: "gene", aggregation_ns: "aggregation"}
         *
         * @member {Object}
         * @private
         */
        this._source_name_mapping = config.sources;

        // Validate that this source has been told how to find the required information
        const specified_ids = Object.keys(config.sources);
        /** @property {String[]} Specifies the sources that must be provided in the original config object */

        this._getRequiredSources().forEach((k) => {
            if (!specified_ids.includes(k)) {
                // TODO: Fix constructor.name usage in minified bundles
                throw new Error(`Configuration for ${this.constructor.name} must specify a source ID corresponding to ${k}`);
            }
        });
    }

    // Stub- connectors don't have their own url or data, so the defaults don't make sense
    parseInit() {}

    getRequest(state, chain, fields) {
        // Connectors do not request their own data by definition, but they *do* depend on other sources having been loaded
        //  first. This method performs basic validation, and preserves the accumulated body from the chain so far.
        Object.keys(this._source_name_mapping).forEach((ns) => {
            const chain_source_id = this._source_name_mapping[ns];
            if (chain.discrete && !chain.discrete[chain_source_id]) {
                throw new Error(`${this.constructor.name} cannot be used before loading required data for: ${chain_source_id}`);
            }
        });
        return Promise.resolve(chain.body || []);
    }

    parseResponse(data, chain, fields, outnames, trans) {
        // A connector source does not update chain.discrete, but it may use it. It bypasses data formatting
        //  and field selection (both are assumed to have been done already, by the previous sources this draws from)

        // Because of how the chain works, connectors are not very good at applying new transformations or namespacing.
        // Typically connectors are called with `connector_name:all` in the fields array.
        return Promise.resolve(this.combineChainBody(data, chain, fields, outnames, trans))
            .then(function(new_body) {
                return {header: chain.header || {}, discrete: chain.discrete || {}, body: new_body};
            });
    }

    combineChainBody(records, chain) {
        // Stub method: specifies how to combine the data
        throw new Error('This method must be implemented in a subclass');
    }

    /**
     * Helper method since ES6 doesn't support class fields
     * @private
     */
    _getRequiredSources() {
        throw new Error('Must specify an array that identifes the kind of data required by this source');
    }
}

export { BaseAdapter, BaseApiAdapter };

export {
    AssociationLZ,
    ConnectorSource,
    GeneConstraintLZ,
    GeneLZ,
    GwasCatalogLZ,
    LDServer,
    PheWASLZ,
    RecombLZ,
    StaticSource,
};
