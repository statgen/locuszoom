/* global LocusZoom,Q */
/* eslint-env browser */
/* eslint-disable no-unused-vars */

"use strict";

/* A named collection of data sources used to draw a plot*/
LocusZoom.DataSources = function() {
    this.sources = {};
};

LocusZoom.DataSources.prototype.addSource = function(ns, x) {
    function findKnownSource(x) {
        if (!LocusZoom.KnownDataSources) {return null;}
        for(var i=0; i<LocusZoom.KnownDataSources.length; i++) {
            if (!LocusZoom.KnownDataSources[i].SOURCE_NAME) {
                throw("KnownDataSource at position " + i + " does not have a 'SOURCE_NAME' static property");
            }
            if (LocusZoom.KnownDataSources[i].SOURCE_NAME == x) {
                return LocusZoom.KnownDataSources[i];
            }
        }
        return null;
    }

    if (Array.isArray(x)) {
        var dsclass = findKnownSource(x[0]);
        if (dsclass) {
            this.sources[ns] = new dsclass(x[1]);
        } else {
            throw("Unable to resolve " + x[0] + " data source");
        }
    } else {
        this.sources[ns] = x;
    }
    return this;
};

LocusZoom.DataSources.prototype.getSource = function(ns) {
    return this.sources[ns];
};

LocusZoom.DataSources.prototype.setSources = function(x) {
    if (typeof x === "string") {
        x = JSON.parse(x);
    }
    var ds = this;
    Object.keys(x).forEach(function(ns) {
        ds.addSource(ns, x[ns]);
    });
    return ds;
};

LocusZoom.DataSources.prototype.keys = function() {
    return Object.keys(this.sources);
};

LocusZoom.DataSources.prototype.toJSON = function() {
    return this.sources;
};

LocusZoom.Data = LocusZoom.Data ||  {};


LocusZoom.Data.Requester = function(sources) {

    function split_requests(fields) {
        var requests = {};
        // Regular expressopn finds namespace:field|trans
        var re = /^(?:([^:]+):)?([^\|]*)(\|.+)*$/;
        fields.forEach(function(raw) {
            var parts = re.exec(raw);
            var ns = parts[1] || "base";
            var field = parts[2];
            var trans = LocusZoom.Data.Transformations.get(parts[3]);
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
            if (!sources.getSource(key)) {
                throw("Datasource for namespace " + key + " not found");
            }
            return sources.getSource(key).getData(state, requests[key].fields, 
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

LocusZoom.Data.Source = function() {};
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
LocusZoom.Data.Source.prototype.getRequest = function(state, chain, fields) {
    return LocusZoom.createCORSPromise("GET", this.getURL(state, chain, fields));
};
LocusZoom.Data.Source.prototype.getData = function(state, fields, outnames, trans) {
    return function (chain) {
        return this.getRequest(state, chain, fields).then(function(resp) {
            return this.parseResponse(resp, chain, fields, outnames, trans);
        }.bind(this));
    }.bind(this);
};
LocusZoom.Data.Source.prototype.toJSON = function() {
    return [Object.getPrototypeOf(this).constructor.SOURCE_NAME, 
        {url:this.url, params:this.params}];
};

LocusZoom.Data.AssociationSource = function(init) {
    this.parseInit(init);
    
    this.getData = function(state, fields, outnames, trans) {
        ["id","position"].forEach(function(x) {
            if (fields.indexOf(x)==-1) {
                fields.unshift(x);
                outnames.unshift(x);
                trans.unshift(null);
            }
        });
        return function (chain) {
            return this.getRequest(state, chain).then(function(resp) {
                return this.parseResponse(resp, chain, fields, outnames, trans);
            }.bind(this));
        }.bind(this);
    };
};
LocusZoom.Data.AssociationSource.prototype = Object.create(LocusZoom.Data.Source.prototype);
LocusZoom.Data.AssociationSource.prototype.constructor = LocusZoom.Data.AssociationSource;
LocusZoom.Data.AssociationSource.prototype.getURL = function(state, chain, fields) {
    var analysis = state.analysis || chain.header.analysis || this.params.analysis || 3;
    return this.url + "results/?filter=analysis in " + analysis  +
        " and chromosome in  '" + state.chr + "'" +
        " and position ge " + state.start +
        " and position le " + state.end;
};
LocusZoom.Data.AssociationSource.prototype.parseResponse = function(resp, chain, fields, outnames, trans) {
    var x = resp.data;
    var records = [];
    fields.forEach(function(f) {
        if (!(f in x)) {throw "field " + f + " not found in response";}
    });
    for(var i = 0; i < x.position.length; i++) {
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
    var res = {header: chain.header || {}, body: records};
    return res;
};
LocusZoom.Data.AssociationSource.SOURCE_NAME = "AssociationLZ";

// Linkage Disequilibrium (LD) Data Source ----------------------------

LocusZoom.Data.LDSource = function(init) {
    this.parseInit(init);
    if (!this.params.pvaluefield) {
        this.params.pvaluefield = "pvalue|neglog10";
    }

    this.getData = function(state, fields, outnames, trans) {
        if (fields.length>1) {
            throw("LD currently only supports one field");
        }
        return function (chain) {
            return this.getRequest(state, chain, fields).then(function(resp) {
                return this.parseResponse(resp, chain, fields, outnames, trans);
            }.bind(this));
        }.bind(this);
    };
};
LocusZoom.Data.LDSource.prototype = Object.create(LocusZoom.Data.Source.prototype);
LocusZoom.Data.LDSource.prototype.constructor = LocusZoom.Data.LDSource;
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
    if ( refVar == "state" ) {
        refVar = state.ldrefvar || chain.header.ldrefvar || "best";
    }
    if ( refVar=="best" ) {
        if ( !chain.body ) {
            throw("No association data found to find best pvalue");
        }
        refVar = chain.body[findExtremeValue(chain.body, this.params.pvaluefield)].id;
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
    var leftJoin  = function(left, right, lfield, rfield) {
        var i=0, j=0;
        while (i < left.length && j < right.position2.length) {
            if (left[i].position == right.position2[j]) {
                left[i][lfield] = right[rfield][j];
                i++;
                j++;
            } else if (left[i].position < right.position2[j]) {
                i++;
            } else {
                j++;
            }
        }
    };

    leftJoin(chain.body, resp.data, outnames[0], "rsquare");
    return chain;   
};
LocusZoom.Data.LDSource.SOURCE_NAME = "LDLZ";

//Gene Data Source --------------------------

LocusZoom.Data.GeneSource = function(init) {
    this.parseInit(init);

    this.getData = function(state, fields, outnames, trans) {
        return function (chain) {
            return this.getRequest(state, chain, fields).then(function(resp) {
                return this.parseResponse(resp, chain, fields, outnames, trans);
            }.bind(this));
        }.bind(this);
    };
};
LocusZoom.Data.GeneSource.prototype = Object.create(LocusZoom.Data.Source.prototype);
LocusZoom.Data.GeneSource.prototype.constructor = LocusZoom.Data.GeneSource;
LocusZoom.Data.GeneSource.prototype.getURL = function(state, chain, fields) {
    return this.url + "?filter=source in 1" + 
        " and chrom eq '" + state.chr + "'" + 
        " and start le " + state.end +
        " and end ge " + state.start;
};
LocusZoom.Data.GeneSource.prototype.parseResponse = function(resp, chain, fields, outnames) {
    return {header: chain.header, body: resp.data};
};
LocusZoom.Data.GeneSource.SOURCE_NAME = "GeneLZ";

// Conditinal P-Value Data Source --------------------------

LocusZoom.Data.ConditionalSource = function(init) {
    this.parseInit(init);
    this.params.teststat = "scoreTestStat";
    this.params.Nstat = "N";
    this.params.defaultN = 9994; //TODO: Remove 9994
};
LocusZoom.Data.ConditionalSource.prototype = Object.create(LocusZoom.Data.Source.prototype);
LocusZoom.Data.ConditionalSource.prototype.constructor = LocusZoom.Data.ConditionalSource;
LocusZoom.Data.ConditionalSource.SOURCE_NAME = "ConditionalLZ";

LocusZoom.Data.ConditionalSource.prototype.getURL = function(state, chain, fields) {
    var analysis = state.analysis || chain.header.analysis || this.params.analysis || 4;
    var condVar = fields[0];
    if ( condVar == "state" ) {
        condVar = state.condvar || chain.header.condvar || this.params.condvar;
    }
    if (!chain.header) {chain.header = {};}
    chain.header.condvar = condVar;
    return this.url + "results/?filter=analysis in " + analysis  + 
        " and chromosome2 in '" + state.chr + "'" + 
        " and position2 ge " + state.start + 
        " and position2 le " + state.end + 
        " and chromosome1 in '" + state.chr + "'" + 
        " and position1 ge " + state.start + 
        " and position1 le " + state.end;  
};
LocusZoom.Data.ConditionalSource.prototype.parseResponse = function(resp, chain, fields, outnames, trans) {
    var V_XX = [];
    var V_XZ = [];
    var N_x = [];
    var V_ZZ = 0;
    var U_Z = 0;
    var N_z = 0;
    var i=0, j=0, k=0;
    var condIdx = -1;

    //extract relevant score statistics
    //assumes that response is sorted by pos1, pos2 
    //assumes that chain sorted by position
    //assumes no duplicated positions
    while (i < chain.body.length && j < resp.data.position2.length) {
        if (chain.body[i].position === resp.data.position1[j]) {
            if (resp.data.variant_name1[j] === resp.data.variant_name2[j]) {
                V_XX[i] = resp.data.statistic[j];
                N_X[i] = chain.body[i][this.params.NStat] || this.params.defaultN;
                if (resp.data.variant_name1[j] === chain.header.condvar) {
                    V_ZZ = resp.data.statistic[j];
                    U_Z = chain.body[i][this.params.teststat];
                    N_Z = N_X[i];
                    condIdx = i;
                }
            }
            if (resp.data.variant_name2[j] == chain.header.condvar) {
                V_XZ[i] = resp.data.statistic[j];
            } else if (resp.data.variant_name1[j] === chain.header.condvar) {
                while (chain.body[i+k].position < resp.data.position2[j]) {
                    k++;
                }
                if (chain.body[i+k].position === resp.data.position2[j]) {
                    V_XZ[i+k] = resp.data.statistic[j];
                }
            }
            j++;
        } else if (chain.body[i].position < resp.data.position1[j]) {
            i++;
        } else {
            j++;
        }
    }

    //calculate conditional score statistic
    for(i = 0; i< chain.body.length; i++) {
        var U_x = chain.body[i][this.params.teststat];
        var U_XgZ = U_x - V_XZ[i] / V_ZZ * U_Z;
        //assumes that both Y~X and Y~Z have same N
        var V_XgZ = N_X[i] * (V_XX[i] - V_XZ[i] / V_ZZ * V_XZ[i]);
        var T = U_XgZ / Math.sqrt(V_XgZ);
        var p = 2*LocusZoom.jStat.normalCDF(-Math.abs(T),0,1);
        if (trans && trans[0]) {
            chain.body[i][outnames[0]] = trans[0](p);
        } else {
            chain.body[i][outnames[0]] = p;
        }
        chain.body[i].condScoreTestStat = T;
        chain.header.condindex = condIdx;
    }

    return chain;   
};

LocusZoom.createResolvedPromise = function() {
    var response = Q.defer();
    response.resolve(Array.prototype.slice.call(arguments));
    return response.promise;
};

LocusZoom.KnownDataSources = [
    LocusZoom.Data.AssociationSource,
    LocusZoom.Data.LDSource,
    LocusZoom.Data.GeneSource,
    LocusZoom.Data.ConditionalSource];

// This class is a singleton designed to store and 
// retrieve transformations
// Field transformations are specified 
// in the form "|name1|name2" and returns a proper
// js function to perform the transformation
LocusZoom.Data.Transformations = (function() {
    var obj = {};
    var known = {
        "neglog10": function(x) {return -Math.log(x) / Math.LN10;} 
    };

    var getTrans = function(x) {
        if (!x) {
            return null;
        }
        var fun = known[x];
        if (fun)  {
            return fun;
        } else {
            throw("transformation " + x + " not found");
        }
    };

    //a single transformation with any parameters
    //(parameters not currently supported)
    var parseTrans = function(x) {
        return getTrans(x);
    };

    //a "raw" transformation string with a leading pipe
    //and one or more transformations
    var parseTransString = function(x) {
        var funs = [];
        var fun;
        var re = /\|([^\|]+)/g;
        var result;
        while((result = re.exec(x))!=null) {
            funs.push(result[1]);
        }
        if (funs.length==1) {
            return parseTrans(funs[0]);
        } else if (funs.length > 1) {
            return function(x) {
                var val = x;
                for(var i = 0; i<funs.length; i++) {
                    val = parseTrans(funs[i])(val);
                }
                return val;
            };
        }
        return null;
    };

    //accept both "|name" and "name"
    obj.get = function(x) {
        if (x && x.substring(0,1)=="|") {
            return parseTransString(x);
        } else {
            return parseTrans(x);
        }
    };

    obj.set = function(name, fn) {
        if (name.substring(0,1)=="|") {
            throw("transformation name should not start with a pipe");
        } else {
            if (fn) {
                known[name] = fn;
            } else {
                delete known[name];
            }
        }
    };

    obj.add = function(name, fn) {
        if (known.name) {
            throw("transformation already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(known);
    };

    return obj;
})();


// jStat functions originally from 
// https://github.com/jstat/jstat/tree/master/src
LocusZoom.jStat = {};

LocusZoom.jStat.normalCDF = function(x, mean, std) {
    return 0.5 * (1 + LocusZoom.jStat.erf((x - mean) / Math.sqrt(2 * std * std)));
};

LocusZoom.jStat.erf = function erf(x) {
    var cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
        -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
        4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
        1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
        6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
        -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
        -6.886027e-12, 8.94487e-13, 3.13092e-13,
        -1.12708e-13, 3.81e-16, 7.106e-15,
        -1.523e-15, -9.4e-17, 1.21e-16,
        -2.8e-17];
    var j = cof.length - 1;
    var isneg = false;
    var d = 0;
    var dd = 0;
    var t, ty, tmp, res;

    if (x < 0) {
        x = -x;
        isneg = true;
    }

    t = 2 / (2 + x);
    ty = 4 * t - 2;

    for(; j > 0; j--) {
        tmp = d;
        d = ty * d - dd + cof[j];
        dd = tmp;
    }

    res = t * Math.exp(-x * x + 0.5 * (cof[0] + ty * d) - dd);
    return isneg ? res - 1 : 1 - res;
};
