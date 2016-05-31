/* global LocusZoom,Q */
/* eslint-env browser */
/* eslint-disable no-unused-vars */

"use strict";

LocusZoom.Data = LocusZoom.Data ||  {};

/* A named collection of data sources used to draw a plot*/

LocusZoom.DataSources = function() {
    this.sources = {};
};

LocusZoom.DataSources.prototype.addSource = function(ns, x) {
    console.warn("Warning: .addSource() is depricated. Use .add() instead");
    return this.add(ns, x);
};

LocusZoom.DataSources.prototype.add = function(ns, x) {
    return this.set(ns, x);
};

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

LocusZoom.DataSources.prototype.getSource = function(ns) {
    console.warn("Warning: .getSource() is depricated. Use .get() instead");
    return this.get(ns);
};

LocusZoom.DataSources.prototype.get = function(ns) {
    return this.sources[ns];
};

LocusZoom.DataSources.prototype.removeSource = function(ns) {
    console.warn("Warning: .removeSource() is depricated. Use .remove() instead");
    return this.remove(ns);
};

LocusZoom.DataSources.prototype.remove = function(ns) {
    return this.set(ns, null);
};

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

LocusZoom.DataSources.prototype.keys = function() {
    return Object.keys(this.sources);
};

LocusZoom.DataSources.prototype.toJSON = function() {
    return this.sources;
};

/* The Requester passes state information to data sources to pull data */

LocusZoom.Data.Requester = function(sources) {

    function split_requests(fields) {
        var requests = {};
        // Regular expressopn finds namespace:field|trans
        var re = /^(?:([^:]+):)?([^:\|]*)(\|.+)*$/;
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
    
    this.getData = function(state, fields) {
        var requests = split_requests(fields);
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
            ret = ret.then(promises[i]);
        }
        return ret;
    };
};

/**
  Base Data Source Class
  This can be extended with .extend() to create custom data sources
*/
LocusZoom.Data.Source = function() {
    this.enableCache = true;
};

LocusZoom.Data.Source.prototype.parseInit = function(init) {
    if (typeof init === "string") {
        this.url = init;
        this.params = {};
    } else {
        this.url = init.url;
        this.params = init.params || {};
    }
    if (!this.url) {
        throw("Source not initialized with required URL");
    }

};

LocusZoom.Data.Source.prototype.getCacheKey = function(state, chain, fields) {
    var url = this.getURL && this.getURL(state, chain, fields);
    return url;
};

LocusZoom.Data.Source.prototype.fetchRequest = function(state, chain, fields) {
    var url = this.getURL(state, chain, fields);
    return LocusZoom.createCORSPromise("GET", url); 
};

LocusZoom.Data.Source.prototype.getRequest = function(state, chain, fields) {
    var req;
    var cacheKey = this.getCacheKey(state, chain, fields);
    if (this.enableCache && typeof(cacheKey) !== "undefined" && cacheKey == this._cachedKey) {
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


LocusZoom.Data.Source.prototype.parseResponse  = function(x, chain, fields, outnames, trans) {
    var records = this.parseData(x.data || x, fields, outnames, trans);
    var res = {header: chain.header || {}, body: records};
    return res;
};

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

LocusZoom.Data.Source.prototype.parseData = function(x, fields, outnames, trans) {
    if (Array.isArray(x)) { 
        return this.parseObjectsToObjects(x, fields, outnames, trans);
    } else {
        return this.parseArraysToObjects(x, fields, outnames, trans);
    }
};

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
        constructorFun.SOURCE_NAME = uniqueName;
        LocusZoom.KnownDataSources.add(constructorFun);
    }
    return constructorFun;
};

LocusZoom.Data.Source.prototype.toJSON = function() {
    return [Object.getPrototypeOf(this).constructor.SOURCE_NAME, 
        {url:this.url, params:this.params}];
};

/**
  Known Data Source for Association Data
*/
LocusZoom.Data.AssociationSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "AssociationLZ");

LocusZoom.Data.AssociationSource.prototype.preGetData = function(state, fields, outnames, trans) {
    ["id", "position"].forEach(function(x) {
        if (fields.indexOf(x)==-1) {
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
  Known Data Source for LD Data
*/
LocusZoom.Data.LDSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "LDLZ");

LocusZoom.Data.LDSource.prototype.preGetData = function(state, fields) {
    if (fields.length>1) {
        throw("LD currently only supports one field");
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
            if (m.length==1) {
                return m[0];
            }
        }
        return null;
    };};
    var dataFields = {id: this.params.id_field, position: this.params.position_field, 
        pvalue: this.params.pvalue_field, _names_:null};
    if (chain && chain.body && chain.body.length>0) {
        var names = Object.keys(chain.body[0]);
        var nameMatch = exactMatch(names);
        dataFields.id = dataFields.id || nameMatch(/\bid\b/);
        dataFields.position = dataFields.position || nameMatch(/\bposition\b/i, /\bpos\b/i);
        dataFields.pvalue = dataFields.pvalue || nameMatch(/\bpvalue\|neglog10\b/i);
        dataFields._names_ = names;
    }
    return dataFields;
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
    var refVar = fields[0];
    if (refVar == "state") {
        refVar = state.ldrefvar || chain.header.ldrefvar || "best";
    }
    if (refVar == "best") {
        if (!chain.body) {
            throw("No association data found to find best pvalue");
        }
        var keys = this.findMergeFields(chain);
        if(!keys.pvalue || !keys.id) {
            throw("Unable to find columns for both pvalue and id for merge: " + keys._names_);
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
    var keys = this.findMergeFields(chain);
    if (!keys.position) {
        throw("Unable to find position field for merge: " + keys._names_);
    }
    var leftJoin = function(left, right, lfield, rfield) {
        var i=0, j=0;
        while (i < left.length && j < right.position2.length) {
            if (left[i][keys.position] == right.position2[j]) {
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
    leftJoin(chain.body, resp.data, outnames[0], "rsquare");
    return chain;   
};

/**
  Known Data Source for Gene Data
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
    return {header: chain.header, body: resp.data};
};

/**
  Known Data Source for Recombination Rate Data
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
  Known Data Source for Annotation Track (BED Track) Data
*/

LocusZoom.Data.BEDTrackSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "BEDLZ");

LocusZoom.Data.BEDTrackSource.prototype.getURL = function(state, chain, fields) {
    var source = state.bedtracksource || chain.header.bedtracksource || this.params.source || 16;
    return this.url + "?filter=id in " + source + 
        " and chromosome eq '" + state.chr + "'" + 
        " and start le " + state.end +
        " and end ge " + state.start;
};

/**
  Known Data Source for Static JSON Data
*/
LocusZoom.Data.StaticSource = LocusZoom.Data.Source.extend(function(data) {
    this._data = data;
},"StaticJSON");

LocusZoom.Data.StaticSource.prototype.getRequest = function(state, chain, fields) {
    return Q.fcall(function() {return this._data;}.bind(this));
};

LocusZoom.Data.StaticSource.prototype.toJSON = function() {
    return [Object.getPrototypeOf(this).constructor.SOURCE_NAME,
        this._data];
};


