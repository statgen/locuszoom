/* global LocusZoom,Q */
/* eslint-env browser */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */

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
        var dsobj = LocusZoom.KnownDataSources.create.apply(null, x);
        this.sources[ns] = dsobj;
    } else {
        if (x !== null) {
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
        var promises = Object.keys(requests).map(function(key) {
            if (!sources.get(key)) {
                throw("Datasource for namespace " + key + " not found");
            }
            return sources.get(key).getData(state, requests[key].fields, 
                                            requests[key].outnames, requests[key].trans);
        });
        //assume the fields are requested in dependent order
        //TODO: better manage dependencies
        var ret = Q.when({header:{}, body:{}});
        for(var i=0; i < promises.length; i++) {
            // If a single datalayer uses multiple sources, perform the next request when the previous one completes
            ret = ret.then(promises[i]);
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
    /** @member {Boolean} */
    this.enableCache = true;
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
 * Fetch the internal string used to represent this data when cache is used
 * @protected
 * @param state
 * @param chain
 * @param fields
 * @returns {String|undefined}
 */
LocusZoom.Data.Source.prototype.getCacheKey = function(state, chain, fields) {
    var url = this.getURL && this.getURL(state, chain, fields);
    return url;
};

/**
 * Fetch data from a remote location
 * @protected
 * @param {Object} state The state of the parent plot
 * @param chain
 * @param fields
 */
LocusZoom.Data.Source.prototype.fetchRequest = function(state, chain, fields) {
    var url = this.getURL(state, chain, fields);
    return LocusZoom.createCORSPromise("GET", url); 
};
// TODO: move this.getURL stub into parent class and add documentation; parent should not check for methods known only to children


/**
 * TODO Rename to handleRequest (to disambiguate from, say HTTP get requests) and update wiki docs and other references
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
 * @protected
 * @param {Object} state The current "state" of the plot, such as chromosome and start/end positions
 * @param {String[]} fields Array of field names that the plot has requested from this data source. (without the "namespace" prefix)  TODO: Clarify how this fieldname maps to raw datasource output, and how it differs from outnames
 * @param {String[]} outnames  Array describing how the output data should refer to this field. This represents the
 *     originally requested field name, including the namespace. This must be an array with the same length as `fields`
 * @param {Function[]} trans The collection of transformation functions to be run on selected fields.
 *     This must be an array with the same length as `fields`
 * @returns {function(this:LocusZoom.Data.Source)} A callable operation that can be used as part of the data chain
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

    return function (chain) {
        return this.getRequest(state, chain, fields).then(function(resp) {
            return this.parseResponse(resp, chain, fields, outnames, trans);
        }.bind(this));
    }.bind(this);
};

/**
 * Parse response data. Return an object containing "header" (metadata or request parameters) and "body"
 *   (data to be used for plotting). The response from this request is combined with responses from all other requests
 *   in the chain.
 * @public
 * @param {String|Object} resp The raw data associated with the response
 * @param {Object} chain The combined parsed response data from this and all other requests made in the chain
 * @param {String[]} fields Array of field names that the plot has requested from this data source. (without the "namespace" prefix)  TODO: Clarify how this fieldname maps to raw datasource output, and how it differs from outnames
 * @param {String[]} outnames  Array describing how the output data should refer to this field. This represents the
 *     originally requested field name, including the namespace. This must be an array with the same length as `fields`
 * @param {Function[]} trans The collection of transformation functions to be run on selected fields.
 *     This must be an array with the same length as `fields`
 * @returns {{header: ({}|*), body: {}}}
 */
LocusZoom.Data.Source.prototype.parseResponse = function(resp, chain, fields, outnames, trans) {
    var json = typeof resp == "string" ? JSON.parse(resp) : resp;
    var records = this.parseData(json.data || json, fields, outnames, trans);
    return {header: chain.header || {}, body: records};
};
/**
 * Some API endpoints return an object containing several arrays, representing columns of data. Each array should have
 *   the same length, and a given array index corresponds to a single row.
 *
 * This gathers column data into a single object representing al the data for a given record. See `parseData` for usage
 *
 * @protected
 * @param {Object} x A response payload object
 * @param {Array} fields
 * @param {Array} outnames
 * @param {Array} trans
 * @returns {Object[]}
 */
LocusZoom.Data.Source.prototype.parseArraysToObjects = function(x, fields, outnames, trans) {
    //intended for an object of arrays
    //{"id":[1,2], "val":[5,10]}
    var records = [];
    fields.forEach(function(f, i) {
        if (!(f in x)) {throw "field " + f + " not found in response for " + outnames[i];}
    });
    var N = x[Object.keys(x)[1]].length;
    for(var i = 0; i < N; i++) {
        var record = {};
        for(var j=0; j<fields.length; j++) {
            var val = x[fields[j]][i];
            if (trans && trans[j]) {
                val = trans[j](val);
            }
            record[outnames[j]] = val;
        }
        records.push(record);
    }
    return records;
};

/**
 *  Given an array response in which each record is represented as one coherent bundle of data (an object of
 *    {field:value} entries), perform any parsing or transformations required to represent the field in a form required
 *    by the datalayer. See `parseData` for usage.
 * @protected
 * @param {Object} x A response payload object
 * @param {Array} fields
 * @param {Array} outnames
 * @param {Array} trans
 * @returns {Object[]}
 */
LocusZoom.Data.Source.prototype.parseObjectsToObjects = function(x, fields, outnames, trans) {
    //intended for an array of objects
    // [ {"id":1, "val":5}, {"id":2, "val":10}]
    var records = [];
    var fieldFound = [];
    for (var k=0; k<fields.length; k++) { 
        fieldFound[k] = 0;
    }
    for (var i = 0; i < x.length; i++) {
        var record = {};
        for (var j=0; j<fields.length; j++) {
            var val = x[i][fields[j]];
            if (typeof val != "undefined") {
                fieldFound[j] = 1;
            }
            if (trans && trans[j]) {
                val = trans[j](val);
            }
            record[outnames[j]] = val;
        }
        records.push(record);
    }
    fieldFound.forEach(function(v, i) {
        if (!v) {throw "field " + fields[i] + " not found in response for " + outnames[i];}
    });
    return records;
};

/**
 * Parse the response data  TODO Hide private entries from user-facing api docs
 * @protected
 * @param {Object} x The raw response data to be parsed
 * @param {String[]} fields Array of field names that the plot has requested from this data source. (without the "namespace" prefix)  TODO: Clarify how this fieldname maps to raw datasource output, and how it differs from outnames
 * @param {String[]} outnames  Array describing how the output data should refer to this field. This represents the
 *     originally requested field name, including the namespace. This must be an array with the same length as `fields`
 * @param {Function[]} trans The collection of transformation functions to be run on selected fields.
 *     This must be an array with the same length as `fields`
 */
LocusZoom.Data.Source.prototype.parseData = function(x, fields, outnames, trans) {
    if (Array.isArray(x)) { 
        return this.parseObjectsToObjects(x, fields, outnames, trans);
    } else {
        return this.parseArraysToObjects(x, fields, outnames, trans);
    }
};

/**
 * Method to define new custom datasources
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
 * @class
 * @public
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.LDSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
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

LocusZoom.Data.LDSource.prototype.parseResponse = function(resp, chain, fields, outnames) {
    var json = JSON.parse(resp);
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
    leftJoin(chain.body, json.data, reqFields.ldout, "rsquare");
    if(reqFields.isrefvarin && chain.header.ldrefvar) {
        tagRefVariant(chain.body, chain.header.ldrefvar, keys.id, reqFields.isrefvarout);
    }
    return chain;   
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

LocusZoom.Data.GeneSource.prototype.parseResponse = function(resp, chain, fields, outnames) {
    var json = JSON.parse(resp);
    return {header: chain.header, body: json.data};
};

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
    return LocusZoom.createCORSPromise("POST", this.url, body, headers);
};

LocusZoom.Data.GeneConstraintSource.prototype.parseResponse = function(resp, chain, fields, outnames) {
    if (!resp){
        return { header: chain.header, body: chain.body };
    }
    var data = JSON.parse(resp);
    // Loop through the array of genes in the body and match each to a result from the constraints request
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
    return { header: chain.header, body: chain.body };
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
        throw ["Data source", this.SOURCE_NAME, "requires that you specify array of one or more desired genome build names"].join(" ");
    }
    var url = [
        this.url,
        "?filter=variant eq '", encodeURIComponent(state.variant), "'&format=objects&",
        build.map(function(item) {return "build=" + encodeURIComponent(item);}).join("&")
    ];
    return url.join("");
};
