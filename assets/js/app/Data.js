/* global LocusZoom */
"use strict";

/**
 * LocusZoom functionality used for data parsing and retrieval
 * @namespace
 * @public
 */
LocusZoom.Data = LocusZoom.Data ||  {};

/**
 * Create and coordinate an ensemble of (namespaced) data source instances
 * @public
 * @class
 */
LocusZoom.DataSources = function() {
    /** @member {Object.<string, LocusZoom.Data.Source>} */
    this.sources = {};
};

/** @deprecated */
LocusZoom.DataSources.prototype.addSource = function(ns, x) {
    console.warn("Warning: .addSource() is deprecated. Use .add() instead");
    return this.add(ns, x);
};

/**
 * Add a (namespaced) datasource to the plot
 * @public
 * @param {String} ns A namespace used for fields from this data source
 * @param {LocusZoom.Data.Source|Array|null} x An instantiated datasource, or an array of arguments that can be used to
 *   create a known datasource type.
 */
LocusZoom.DataSources.prototype.add = function(ns, x) {
    return this.set(ns, x);
};

/** @protected */
LocusZoom.DataSources.prototype.set = function(ns, x) {
    if (Array.isArray(x)) {
        // If passed array of source name and options, make the source
        var dsobj = LocusZoom.KnownDataSources.create.apply(null, x);
        // Each datasource in the chain should be aware of its assigned namespace
        dsobj.source_id = ns;
        this.sources[ns] = dsobj;
    } else {
        // If passed the already-created source object
        if (x !== null) {
            x.source_id = ns;
            this.sources[ns] = x;
        } else {
            delete this.sources[ns];
        }
    }
    return this;
};

/** @deprecated */
LocusZoom.DataSources.prototype.getSource = function(ns) {
    console.warn("Warning: .getSource() is deprecated. Use .get() instead");
    return this.get(ns);
};

/**
 * Return the datasource associated with a given namespace
 * @public
 * @param {String} ns Namespace
 * @returns {LocusZoom.Data.Source}
 */
LocusZoom.DataSources.prototype.get = function(ns) {
    return this.sources[ns];
};

/** @deprecated */
LocusZoom.DataSources.prototype.removeSource = function(ns) {
    console.warn("Warning: .removeSource() is deprecated. Use .remove() instead");
    return this.remove(ns);
};

/**
 * Remove the datasource associated with a given namespace
 * @public
 * @param {String} ns Namespace
 */
LocusZoom.DataSources.prototype.remove = function(ns) {
    return this.set(ns, null);
};

/**
 * Populate a list of datasources specified as a JSON object
 * @public
 * @param {String|Object} x An object or JSON representation containing {ns: configArray} entries
 * @returns {LocusZoom.DataSources}
 */
LocusZoom.DataSources.prototype.fromJSON = function(x) {
    if (typeof x === "string") {
        x = JSON.parse(x);
    }
    var ds = this;
    Object.keys(x).forEach(function(ns) {
        ds.set(ns, x[ns]);
    });
    return ds;
};

/**
 * Return the names of all currently recognized datasources
 * @public
 * @returns {Array}
 */
LocusZoom.DataSources.prototype.keys = function() {
    return Object.keys(this.sources);
};

/**
 * Datasources can be instantiated from a JSON object instead of code. This represents existing sources in that format.
 *   For example, this can be helpful when sharing plots, or to share settings with others when debugging
 * @public
 */
LocusZoom.DataSources.prototype.toJSON = function() {
    return this.sources;
};

/**
 * Represents an addressable unit of data from a namespaced datasource, subject to specified value transformations.
 *
 * When used by a data layer, fields will automatically be re-fetched from the appropriate data source whenever the
 *   state of a plot fetches, eg pan or zoom operations that would affect what data is displayed.
 *
 * @public
 * @class
 * @param {String} field A string representing the namespace of the datasource, the name of the desired field to fetch
 *   from that datasource, and arbitrarily many transformations to apply to the value. The namespace and
 *   transformation(s) are optional and information is delimited according to the general syntax
 *   `[namespace:]name[|transformation][|transformation]`. For example, `association:pvalue|neglog10`
 */
LocusZoom.Data.Field = function(field){
    
    var parts = /^(?:([^:]+):)?([^:|]*)(\|.+)*$/.exec(field);
    /** @member {String} */
    this.full_name = field;
    /** @member {String} */
    this.namespace = parts[1] || null;
    /** @member {String} */
    this.name = parts[2] || null;
    /** @member {Array} */
    this.transformations = [];
    
    if (typeof parts[3] == "string" && parts[3].length > 1){
        this.transformations = parts[3].substring(1).split("|");
        this.transformations.forEach(function(transform, i){
            this.transformations[i] = LocusZoom.TransformationFunctions.get(transform);
        }.bind(this));
    }

    this.applyTransformations = function(val){
        this.transformations.forEach(function(transform){
            val = transform(val);
        });
        return val;
    };

    // Resolve the field for a given data element.
    // First look for a full match with transformations already applied by the data requester.
    // Otherwise prefer a namespace match and fall back to just a name match, applying transformations on the fly.
    this.resolve = function(d){
        if (typeof d[this.full_name] == "undefined"){
            var val = null;
            if (typeof (d[this.namespace+":"+this.name]) != "undefined"){ val = d[this.namespace+":"+this.name]; }
            else if (typeof d[this.name] != "undefined"){ val = d[this.name]; }
            d[this.full_name] = this.applyTransformations(val);
        }
        return d[this.full_name];
    };
    
};

/**
 * The Requester manages fetching of data across multiple data sources. It is used internally by LocusZoom data layers.
 *   It passes state information and ensures that data is formatted in the manner expected by the plot.
 *
 * It is also responsible for constructing a "chain" of dependent requests, by requesting each datasource
 *   sequentially in the order specified in the datalayer `fields` array. Data sources are only chained within a
 *   data layer, and only if that layer requests more than one kind of data source.
 * @param {LocusZoom.DataSources} sources An object of {ns: LocusZoom.Data.Source} instances
 * @class
 */
LocusZoom.Data.Requester = function(sources) {

    function split_requests(fields) {
        // Given a fields array, return an object specifying what datasource names the data layer should make requests
        //  to, and how to handle the returned data
        var requests = {};
        // Regular expression finds namespace:field|trans
        var re = /^(?:([^:]+):)?([^:|]*)(\|.+)*$/;
        fields.forEach(function(raw) {
            var parts = re.exec(raw);
            var ns = parts[1] || "base";
            var field = parts[2];
            var trans = LocusZoom.TransformationFunctions.get(parts[3]);
            if (typeof requests[ns] =="undefined") {
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
    this.getData = function(state, fields) {
        var requests = split_requests(fields);
        // Create an array of functions that, when called, will trigger the request to the specified datasource
        var request_handles = Object.keys(requests).map(function(key) {
            if (!sources.get(key)) {
                throw("Datasource for namespace " + key + " not found");
            }
            return sources.get(key).getData(state, requests[key].fields, 
                                            requests[key].outnames, requests[key].trans);
        });
        //assume the fields are requested in dependent order
        //TODO: better manage dependencies
        var ret = Q.when({header:{}, body:{}, discrete: {}});
        for(var i=0; i < request_handles.length; i++) {
            // If a single datalayer uses multiple sources, perform the next request when the previous one completes
            ret = ret.then(request_handles[i]);
        }
        return ret;
    };
};

/**
 * Base class for LocusZoom data sources
 * This can be extended with .extend() to create custom data sources
 * @class
 * @public
 */
LocusZoom.Data.Source = function() {
    /**
     * Whether this source should enable caching
     * @member {Boolean}
     */
    this.enableCache = true;
    /**
     * Whether this data source type is dependent on previous requests- for example, the LD source cannot annotate
     *  association data if no data was found for that region.
     * @member {boolean}
     */
    this.dependentSource = false;
};

/**
 * A default constructor that can be used when creating new data sources
 * @param {String|Object} init Basic configuration- either a url, or a config object
 * @param {String} [init.url] The datasource URL
 * @param {String} [init.params] Initial config params for the datasource
 */
LocusZoom.Data.Source.prototype.parseInit = function(init) {
    if (typeof init === "string") {
        /** @member {String} */
        this.url = init;
        /** @member {String} */
        this.params = {};
    } else {
        this.url = init.url;
        this.params = init.params || {};
    }
    if (!this.url) {
        throw("Source not initialized with required URL");
    }

};

/**
 * A unique identifier that indicates whether cached data is valid for this request
 * @protected
 * @param state
 * @param chain
 * @param fields
 * @returns {String|undefined}
 */
LocusZoom.Data.Source.prototype.getCacheKey = function(state, chain, fields) {
    return this.getURL && this.getURL(state, chain, fields);
};

/**
 * Stub: build the URL for any requests made by this source.
 */
LocusZoom.Data.Source.prototype.getURL = function(state, chain, fields) { return this.url; };

/**
 * Perform a network request to fetch data for this source
 * @protected
 * @param {Object} state The state of the parent plot
 * @param chain
 * @param fields
 */
LocusZoom.Data.Source.prototype.fetchRequest = function(state, chain, fields) {
    var url = this.getURL(state, chain, fields);
    return LocusZoom.createCORSPromise("GET", url); 
};

/**
 * Gets the data for just this source, typically via a network request (caching where possible)
 * @protected
 */
LocusZoom.Data.Source.prototype.getRequest = function(state, chain, fields) {
    var req;
    var cacheKey = this.getCacheKey(state, chain, fields);
    if (this.enableCache && typeof(cacheKey) !== "undefined" && cacheKey === this._cachedKey) {
        req = Q.when(this._cachedResponse);
    } else {
        req = this.fetchRequest(state, chain, fields);
        if (this.enableCache) {
            req = req.then(function(x) {
                this._cachedKey = cacheKey;
                return this._cachedResponse = x;
            }.bind(this));
        }
    }
    return req;
};

/**
 * Fetch the data from the specified data source, and format it in a way that can be used by the consuming plot
 *  This is the external-facing methgod that should be called in most scenarios
 *
 * @param {Object} state The current "state" of the plot, such as chromosome and start/end positions
 * @param {String[]} fields Array of field names that the plot has requested from this data source. (without the "namespace" prefix)
 * @param {String[]} outnames  Array describing how the output data should refer to this field. This represents the
 *     originally requested field name, including the namespace. This must be an array with the same length as `fields`
 * @param {Function[]} trans The collection of transformation functions to be run on selected fields.
 *     This must be an array with the same length as `fields`
 * @returns {function} A callable operation that can be used as part of the data chain
 */
LocusZoom.Data.Source.prototype.getData = function(state, fields, outnames, trans) {
    if (this.preGetData) {
        var pre = this.preGetData(state, fields, outnames, trans);
        if(this.pre) {
            state = pre.state || state;
            fields = pre.fields || fields;
            outnames = pre.outnames || outnames;
            trans = pre.trans || trans;
        }
    }

    var self = this;
    return function (chain) {
        if (self.dependentSource && chain && chain.body && !chain.body.length) {
            // A "dependent" source should not attempt to fire a request if there is no data for it to act on.
            // Therefore, it should simply return the previous data chain.
            return Q.when(chain);
        }

        return self.getRequest(state, chain, fields).then(function(resp) {
            return self.parseResponse(resp, chain, fields, outnames, trans);
        });
    };
};

/**
 * Ensure the server response is in a canonical form, an array of one object per record. [ {field: oneval} ].
 * If the server response contains columns, reformats the response from {column1: [], column2: []} to the above.
 *
 * Does not apply namespacing or transformations.
 * @param {Object[]|Object} data The data in one of two forms: [ {field:val} ]
 * @protected
 */
LocusZoom.Data.Source.prototype.formatRawResponse = function (data) {
    if (Array.isArray(data)) {
        // Already in the desired form
        return data;
    }

    // Otherwise, assume the server response is an object representing columns of data.
    // Each array should have the same length, and a given array index corresponds to a single row.
    // Safeguard: check that arrays are of same length
    var keys = Object.keys(data);
    var N = data[keys[0]].length;
    var sameLength = keys.every(function(key) {
        var item = data[key];
        return item.length === N;
    });
    if (!sameLength) {
        throw this.constructor.SOURCE_NAME + " expects a response in which all arrays of data are the same length";
    }

    // Go down the rows, and create an object for each record
    var records = [];
    var fields = Object.keys(data);
    for(var i = 0; i < N; i++) {
        var record = {};
        for(var j = 0; j < fields.length; j++) {
            record[fields[j]] = data[fields[j]][i];
        }
        records.push(record);
    }
    return records;
};

/** @deprecated */
LocusZoom.Data.Source.prototype.prepareData = function (records) {
    console.warn("Warning: .prepareData() is deprecated. Use .annotateData() instead");
    return this.annotateData(records);
};
/**
 * Hook to post-process the data returned by this source with new, user-specified behavior.
 *   (eg cleaning up API values or adding complex new calculated fields)
 *
 * @param {Object[]} records The parsed data from the source (eg standardized api response)
 * @returns {Object[]|Promise} The modified set of records
 */
LocusZoom.Data.Source.prototype.annotateData = function(records) {
    // Default behavior: no transformations
    return records;
};

/**
 * Clean up the server records for use by datalayers: extract only certain fields, with the specified names.
 *   Apply transformations as appropriate.
 *
 * This hook can be overridden, eg to create a source that always returns all records and ignores the "fields" array.
 *  This is particularly common for sources at the end of a chain- many "dependent" sources do not allow
 *  cherry-picking individual fields, and by convention the fields array simply asks for "last_source_name:all"
 *
 * @param {Object[]} data One record object per element
 * @param {String[]} fields The names of fields to extract (as named in the source data). Eg "afield"
 * @param {String[]} outnames How to represent the source fields in the output. Eg "namespace:afield|atransform"
 * @param {function[]} trans An array of transformation functions (if any). One function per data element, or null.
 * @protected
 */
LocusZoom.Data.Source.prototype.selectFields = function (data, fields, outnames, trans) {
    //intended for an array of objects
    // [ {"id":1, "val":5}, {"id":2, "val":10}]

    // Since a number of sources exist that do not obey this format, we will provide a convenient pass-through
    if (!Array.isArray(data)) {
        return data;
    }

    var fieldFound = [];
    for (var k=0; k<fields.length; k++) {
        fieldFound[k] = 0;
    }

    var records = data.map(function (item) {
        var output_record = {};
        for (var j=0; j < fields.length; j++) {
            var val = item[fields[j]];
            if (typeof val != "undefined") {
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
        if (!v) {throw "field " + fields[i] + " not found in response for " + outnames[i];}
    });
    return records;
};

/**
 * Combine records from this source with others in the chain to yield final chain body.
 *   Handles merging this data with other sources (if applicable)
 *
 * @param {Object[]} data The data That would be returned from this source alone
 * @param {Object} chain The data chain built up during previous requests
 * @param {String[]} fields
 * @param {String[]} outnames
 * @return {Promise|Object[]} The new chain body
 * @protected
 */
LocusZoom.Data.Source.prototype.combineChainBody = function (data, chain, fields, outnames) {
    return data;
};

/**
 * Coordinates the work of parsing a response and returning records. This is broken into 4 steps, which may be
 *  overridden separately for fine-grained control. Each step can return either raw data or a promise.
 *
 * @public
 * @param {String|Object} resp The raw data associated with the response
 * @param {Object} chain The combined parsed response data from this and all other requests made in the chain
 * @param {String[]} fields Array of requested field names (as they would appear in the response payload)
 * @param {String[]} outnames  Array of field names as they will be represented in the data returned by this source,
 *  including the namespace. This must be an array with the same length as `fields`
 * @param {Function[]} trans The collection of transformation functions to be run on selected fields.
 *     This must be an array with the same length as `fields`
 * @returns {Promise|{header: ({}|*), discrete: {}, body: []}} A promise that resolves to an object containing
 *   request metadata (headers), the consolidated data for plotting (body), and the individual responses that would be
 *   returned by each source in the chain in isolation (discrete)
 */
LocusZoom.Data.Source.prototype.parseResponse = function(resp, chain, fields, outnames, trans) {
    var source_id = this.source_id || this.constructor.SOURCE_NAME;
    if (!chain.discrete) {
        chain.discrete = {};
    }

    var json = typeof resp == "string" ? JSON.parse(resp) : resp;

    var self = this;
    // Perform the 4 steps of parsing the payload and return a combined chain object
    return Q.when(self.formatRawResponse(json.data || json))
        .then(function(standardized) {
            // Perform calculations on the data from just this source
            return Q.when(self.annotateData(standardized));
        }).then(function (data) {
            return Q.when(self.selectFields(data, fields, outnames, trans));
        }).then(function (one_source_body) {
            // Store a copy of the data that would be returned by parsing this source in isolation (and taking the
            //   fields array into account). This is useful when we want to re-use the source output in many ways.
            chain.discrete[source_id] = one_source_body;
            return Q.when(self.combineChainBody(one_source_body, chain, fields, outnames));
        }).then(function (new_body) {
            return { header: chain.header || {}, discrete: chain.discrete, body: new_body };
        });
};

/** @deprecated */
LocusZoom.Data.Source.prototype.parseArraysToObjects = function(data, fields, outnames, trans) {
    console.warn("Warning: .parseArraysToObjects() is no longer used. A stub is provided for legacy use");
    var standard = this.formatRawResponse(data);
    return this.selectFields(standard, fields, outnames, trans);
};

/** @deprecated */
LocusZoom.Data.Source.prototype.parseObjectsToObjects = function(data, fields, outnames, trans) {
    console.warn("Warning: .parseObjectsToObjects() is deprecated. Use .selectFields() instead");
    return this.selectFields(data, fields, outnames, trans);
};

/** @deprecated */
LocusZoom.Data.Source.prototype.parseData = function(data, fields, outnames, trans) {
    console.warn("Warning: .parseData() is no longer used. A stub is provided for legacy use");
    var standard = this.formatRawResponse(data);
    return this.selectFields(standard, fields, outnames, trans);
};

/**
 * Method to define new custom datasources based on a provided constructor. (does not allow registering any additional methods)
 * @public
 * @param {Function} constructorFun Constructor function that is used to create the specified class
 * @param {String} [uniqueName] The name by which the class should be listed in `KnownDataSources`
 * @param {String|Function} [base=LocusZoomData.Source] The name or constructor of a base class to use
 * @returns {*|Function}
 */
LocusZoom.Data.Source.extend = function(constructorFun, uniqueName, base) {
    if (base) {
        if (Array.isArray(base)) {
            base = LocusZoom.KnownDataSources.create.apply(null, base);
        } else if (typeof base === "string") {
            base = LocusZoom.KnownDataSources.get(base).prototype;
        } else if (typeof base === "function") {
            base = base.prototype;
        }
    } else {
        base =  new LocusZoom.Data.Source();
    }
    constructorFun = constructorFun || function() {};
    constructorFun.prototype = base;
    constructorFun.prototype.constructor = constructorFun;
    if (uniqueName) {
        /** @member {String} LocusZoom.Data.Source.SOURCENAME */
        constructorFun.SOURCE_NAME = uniqueName;
        LocusZoom.KnownDataSources.add(constructorFun);
    }
    return constructorFun;
};

/**
 * Datasources can be instantiated from a JSON object instead of code. This represents an existing source in that data format.
 *   For example, this can be helpful when sharing plots, or to share settings with others when debugging
 * @public
 * @returns {Object}
 */
LocusZoom.Data.Source.prototype.toJSON = function() {
    return [Object.getPrototypeOf(this).constructor.SOURCE_NAME, 
        {url:this.url, params:this.params}];
};

/**
 * Data Source for Association Data, as fetched from the LocusZoom API server (or compatible)
 * @class
 * @public
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.AssociationSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "AssociationLZ");

LocusZoom.Data.AssociationSource.prototype.preGetData = function(state, fields, outnames, trans) {
    var id_field = this.params.id_field || "id";
    [id_field, "position"].forEach(function(x) {
        if (fields.indexOf(x)===-1) {
            fields.unshift(x);
            outnames.unshift(x);
            trans.unshift(null);
        }
    });
    return {fields: fields, outnames:outnames, trans:trans};
};

LocusZoom.Data.AssociationSource.prototype.getURL = function(state, chain, fields) {
    var analysis = state.analysis || chain.header.analysis || this.params.analysis || 3;
    return this.url + "results/?filter=analysis in " + analysis  +
        " and chromosome in  '" + state.chr + "'" +
        " and position ge " + state.start +
        " and position le " + state.end;
};

/**
 * Data Source for LD Data, as fetched from the LocusZoom API server (or compatible)
 * This source is designed to connect its results to association data, and therefore depends on association data having
 *  been loaded by a previous request in the data chain.
 * @class
 * @public
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.LDSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
    this.dependentSource = true;
}, "LDLZ");

LocusZoom.Data.LDSource.prototype.preGetData = function(state, fields) {
    if (fields.length>1) {
        if (fields.length!==2 || fields.indexOf("isrefvar")===-1) {
            throw("LD does not know how to get all fields: " + fields.join(", "));
        }
    }
};

LocusZoom.Data.LDSource.prototype.findMergeFields = function(chain) {
    // since LD may be shared across sources with different namespaces
    // we use regex to find columns to join on rather than 
    // requiring exact matches
    var exactMatch = function(arr) {return function() {
        var regexes = arguments;
        for(var i=0; i<regexes.length; i++) {
            var regex = regexes[i];
            var m = arr.filter(function(x) {return x.match(regex);});
            if (m.length){
                return m[0];
            }
        }
        return null;
    };};
    var dataFields = {
        id: this.params.id_field,
        position: this.params.position_field,
        pvalue: this.params.pvalue_field,
        _names_:null
    };
    if (chain && chain.body && chain.body.length>0) {
        var names = Object.keys(chain.body[0]);
        var nameMatch = exactMatch(names);
        dataFields.id = dataFields.id || nameMatch(/\bvariant\b/) || nameMatch(/\bid\b/);
        dataFields.position = dataFields.position || nameMatch(/\bposition\b/i, /\bpos\b/i);
        dataFields.pvalue = dataFields.pvalue || nameMatch(/\bpvalue\b/i, /\blog_pvalue\b/i);
        dataFields._names_ = names;
    }
    return dataFields;
};

LocusZoom.Data.LDSource.prototype.findRequestedFields = function(fields, outnames) {
    var obj = {};
    for(var i=0; i<fields.length; i++) {
        if(fields[i]==="isrefvar") {
            obj.isrefvarin = fields[i];
            obj.isrefvarout = outnames && outnames[i];
        } else {
            obj.ldin = fields[i];
            obj.ldout = outnames && outnames[i];
        }
    }
    return obj;
};

LocusZoom.Data.LDSource.prototype.formatRawResponse = function (data) { return data; };

LocusZoom.Data.LDSource.prototype.getURL = function(state, chain, fields) {
    var findExtremeValue = function(x, pval, sign) {
        pval = pval || "pvalue";
        sign = sign || 1;
        var extremeVal = x[0][pval], extremeIdx=0;
        for(var i=1; i<x.length; i++) {
            if (x[i][pval] * sign > extremeVal) {
                extremeVal = x[i][pval] * sign;
                extremeIdx = i;
            }
        }
        return extremeIdx;
    };

    var refSource = state.ldrefsource || chain.header.ldrefsource || 1;
    var reqFields = this.findRequestedFields(fields);
    var refVar = reqFields.ldin;
    if (refVar === "state") {
        refVar = state.ldrefvar || chain.header.ldrefvar || "best";
    }
    if (refVar === "best") {
        if (!chain.body) {
            throw("No association data found to find best pvalue");
        }
        var keys = this.findMergeFields(chain);
        if (!keys.pvalue || !keys.id) {
            var columns = "";
            if (!keys.id){ columns += (columns.length ? ", " : "") + "id"; }
            if (!keys.pvalue){ columns += (columns.length ? ", " : "") + "pvalue"; }
            throw("Unable to find necessary column(s) for merge: " + columns + " (available: " + keys._names_ + ")");
        }
        refVar = chain.body[findExtremeValue(chain.body, keys.pvalue)][keys.id];
    }
    if (!chain.header) {chain.header = {};}
    chain.header.ldrefvar = refVar;
    return this.url + "results/?filter=reference eq " + refSource + 
        " and chromosome2 eq '" + state.chr + "'" + 
        " and position2 ge " + state.start + 
        " and position2 le " + state.end + 
        " and variant1 eq '" + refVar + "'" + 
        "&fields=chr,pos,rsquare";
};

LocusZoom.Data.LDSource.prototype.combineChainBody = function (data, chain, fields, outnames) {
    var keys = this.findMergeFields(chain);
    var reqFields = this.findRequestedFields(fields, outnames);
    if (!keys.position) {
        throw("Unable to find position field for merge: " + keys._names_);
    }
    var leftJoin = function(left, right, lfield, rfield) {
        var i=0, j=0;
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
    var tagRefVariant = function(data, refvar, idfield, outname) {
        for(var i=0; i<data.length; i++) {
            if (data[i][idfield] && data[i][idfield]===refvar) {
                data[i][outname] = 1;
            } else {
                data[i][outname] = 0;
            }
        }
    };
    leftJoin(chain.body, data, reqFields.ldout, "rsquare");
    if(reqFields.isrefvarin && chain.header.ldrefvar) {
        tagRefVariant(chain.body, chain.header.ldrefvar, keys.id, reqFields.isrefvarout);
    }
    return chain.body;
};


/**
 * Data Source for Gene Data, as fetched from the LocusZoom API server (or compatible)
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.GeneSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "GeneLZ");

LocusZoom.Data.GeneSource.prototype.getURL = function(state, chain, fields) {
    var source = state.source || chain.header.source || this.params.source || 2;
    return this.url + "?filter=source in " + source +
        " and chrom eq '" + state.chr + "'" + 
        " and start le " + state.end +
        " and end ge " + state.start;
};

// Genes have a very complex internal data format. Bypass any record parsing, and provide the data layer with the
// exact information returned by the API. (ignoring the fields array in the layout)
LocusZoom.Data.GeneSource.prototype.formatRawResponse = function (data) { return data; };
LocusZoom.Data.GeneSource.prototype.selectFields = function (data, fields, outnames, trans) { return data; };

/**
 * Data Source for Gene Constraint Data, as fetched from the LocusZoom API server (or compatible)
 * @public
 * @class
 * @augments LocusZoom.Data.Source
*/
LocusZoom.Data.GeneConstraintSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "GeneConstraintLZ");

LocusZoom.Data.GeneConstraintSource.prototype.getURL = function() {
    return this.url;
};

LocusZoom.Data.GeneConstraintSource.prototype.formatRawResponse = function (data) { return data; };

LocusZoom.Data.GeneConstraintSource.prototype.getCacheKey = function(state, chain, fields) {
    return this.url + JSON.stringify(state);
};

LocusZoom.Data.GeneConstraintSource.prototype.fetchRequest = function(state, chain, fields) {
    var geneids = [];
    chain.body.forEach(function(gene){
        var gene_id = gene.gene_id;
        if (gene_id.indexOf(".")){
            gene_id = gene_id.substr(0, gene_id.indexOf("."));
        }
        geneids.push(gene_id);
    });
    var url = this.getURL(state, chain, fields);
    var body = "geneids=" + encodeURIComponent(JSON.stringify(geneids));
    var headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    };
    return LocusZoom.createCORSPromise("POST", url, body, headers);
};

LocusZoom.Data.GeneConstraintSource.prototype.combineChainBody = function (data, chain, fields, outnames) {
    if (!data) {
        return chain;
    }
    var constraint_fields = ["bp", "exp_lof", "exp_mis", "exp_syn", "lof_z", "mis_z", "mu_lof", "mu_mis","mu_syn", "n_exons", "n_lof", "n_mis", "n_syn", "pLI", "syn_z"];
    chain.body.forEach(function(gene, i){
        var gene_id = gene.gene_id;
        if (gene_id.indexOf(".")){
            gene_id = gene_id.substr(0, gene_id.indexOf("."));
        }
        constraint_fields.forEach(function(field){
            // Do not overwrite any fields defined in the original gene source
            if (typeof chain.body[i][field] != "undefined"){ return; }
            if (data[gene_id]){
                var val = data[gene_id][field];
                if (typeof val == "number" && val.toString().indexOf(".") !== -1){
                    val = parseFloat(val.toFixed(2));
                }
                chain.body[i][field] = val;
            } else {
                // If the gene did not come back in the response then set the same field with a null values
                chain.body[i][field] = null;
            }
        });
    });
    return chain.body;
};

/**
 * Data Source for Recombination Rate Data, as fetched from the LocusZoom API server (or compatible)
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.RecombinationRateSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "RecombLZ");

LocusZoom.Data.RecombinationRateSource.prototype.getURL = function(state, chain, fields) {
    var source = state.recombsource || chain.header.recombsource || this.params.source || 15;
    return this.url + "?filter=id in " + source +
        " and chromosome eq '" + state.chr + "'" +
        " and position le " + state.end +
        " and position ge " + state.start;
};

/**
 * Data Source for Interval Annotation Data (e.g. BED Tracks), as fetched from the LocusZoom API server (or compatible)
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.IntervalSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "IntervalLZ");

LocusZoom.Data.IntervalSource.prototype.getURL = function(state, chain, fields) {
    var source = state.bedtracksource || chain.header.bedtracksource || this.params.source || 16;
    return this.url + "?filter=id in " + source + 
        " and chromosome eq '" + state.chr + "'" + 
        " and start le " + state.end +
        " and end ge " + state.start;
};

/**
 * Data Source for static blobs of JSON Data. This does not perform additional parsing, and therefore it is the
 * responsibility of the user to pass information in a format that can be read and understood by the chosen plot.
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.StaticSource = LocusZoom.Data.Source.extend(function(data) {
    /** @member {Object} */
    this._data = data;
},"StaticJSON");

LocusZoom.Data.StaticSource.prototype.getRequest = function(state, chain, fields) {
    return Q.fcall(function() {return this._data;}.bind(this));
};

LocusZoom.Data.StaticSource.prototype.toJSON = function() {
    return [Object.getPrototypeOf(this).constructor.SOURCE_NAME, this._data];
};

/**
 * Data source for PheWAS data served from external JSON files
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 * @param {String[]} init.build This datasource expects to be provided the name of the genome build that will be used to
 *   provide pheWAS results for this position. Note positions may not translate between builds.
 */
LocusZoom.Data.PheWASSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "PheWASLZ");
LocusZoom.Data.PheWASSource.prototype.getURL = function(state, chain, fields) {
    var build = this.params.build;
    if (!build || !Array.isArray(build) || !build.length) {
        throw ["Data source", this.constructor.SOURCE_NAME, "requires that you specify array of one or more desired genome build names"].join(" ");
    }
    var url = [
        this.url,
        "?filter=variant eq '", encodeURIComponent(state.variant), "'&format=objects&",
        build.map(function(item) {return "build=" + encodeURIComponent(item);}).join("&")
    ];
    return url.join("");
};

/**
 * Base class for "connectors"- this is meant to be subclassed, rather than used directly.
 *
 * A connector is a source that makes no server requests and caches no data of its own. Instead, it decides how to
 *  combine data from other sources in the chain. Connectors are useful when we want to request (or calculate) some
 *  useful piece of information once, but apply it to many different kinds of record types.
 *
 * Typically, a subclass will implement the field merging logic in `combineChainBody`.
 *
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 * @param {Object} init Configuration for this source
 * @param {Object} init.from Specify how the hard-coded logic should find the data it relies on in the chain,
 *  as {internal_name: chain_source_id} pairs. This allows writing a reusable connector that does not need to make
 *  assumptions about what namespaces a source is using.
 * @type {*|Function}
 */
LocusZoom.Data.ConnectorSource = LocusZoom.Data.Source.extend(function(init) {
    if (!init || !init.from) {
        throw "Connectors must specify the data they require as init.from = {internal_name: chain_source_id}} pairs";
    }

    /**
     * Tells the connector how to find the data it relies on
     *
     * For example, a connector that applies burden test information to the genes layer might specify:
     *  {gene_ns: "gene", burden_ns: "burdentest"}
     *
     * @member {Object}
     */
    this._source_name_mapping = init.from;

    this.parseInit(init);
}, "ConnectorSource");

LocusZoom.Data.ConnectorSource.prototype.parseInit = function(init) {
    // The exact requirements for `init` are up to each individual connector source
    // TODO: Add common validation based on usage experience
};

LocusZoom.Data.ConnectorSource.prototype.getRequest = function(state, chain, fields) {
    // Connectors do not have their own data by definition, but they *do* depend on other sources having been loaded
    //  first. This method performs basic validation, and preserves the accumulated body from the chain so far.
    var self = this;
    Object.keys(this._source_name_mapping).forEach(function(ns) {
        var chain_source_id = self._source_name_mapping[ns];
        if (chain.discrete && !chain.discrete[chain_source_id]) {
            throw self.constructor.SOURCE_NAME + " cannot be used before loading required data for: " + chain_source_id;
        }
    });
    return Q.when(chain.body || []);
};

LocusZoom.Data.ConnectorSource.prototype.parseResponse = function(data, chain, fields, outnames) {
    // A connector source does not update chain.discrete, but it may use it. It bypasses data formatting
    //  and field selection (because it has no data of its own)
    // Typically connectors are called with `connector_name:all` in the fields array. Since they are only responsible
    //  for joining two sources, the final fields array is already limited by whatever came in.
    return Q.when(this.combineChainBody(data, chain, fields, outnames))
        .then(function(new_body) {
            return {header: chain.header || {}, discrete: chain.discrete || {}, body: new_body};
        });
};

LocusZoom.Data.ConnectorSource.prototype.combineChainBody = function(records, chain) {
    // Stub method: specifies how to combine the data
    throw "This method must be implemented in a subclass";
};
