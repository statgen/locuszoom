/* global LocusZoom,Q */
/* eslint-env browser */
/* eslint-disable no-console */

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

LocusZoom.Data = LocusZoom.Data ||  {};


LocusZoom.Data.Requester = function(sources) {

    function split_requests(fields) {
        var requests = {};
        fields.forEach(function(field) {
            var parts = field.split(/\:(.*)/);
            if (parts.length==1) {
                if (typeof requests["base"] == "undefined") {
                    requests.base = {names:[], fields:[]};
                }
                requests.base.names.push(field);
                requests.base.fields.push(field);
            } else {
                if (typeof requests[parts[0]] =="undefined") {
                    requests[parts[0]] = {names:[], fields:[]};
                }
                requests[parts[0]].names.push(field);
                requests[parts[0]].fields.push(parts[1]);
            }
        });
        return requests;
    }
    
    this.getData = function(state, fields) {
        var requests = split_requests(fields);
        var promises = Object.keys(requests).map(function(key) {
            if (!sources.getSource(key)) {
                throw("Datasource for namespace " + key + " not found");
            }
            return sources.getSource(key).getData(state, requests[key].fields, requests[key].names);
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

LocusZoom.Data.AssociationSource = function(init) {
    if (typeof init === "string") {
        this.url = init;
        this.params = {};
    } else {
        this.url = init.url;
        this.params = init.params || {};
    }
    if (!this.url) {
        throw("AssociationSource not initialized with required URL");
    }
    
    this.getData = function(state, fields, outnames) {
        ["id","position"].forEach(function(x) {
            if (fields.indexOf(x)==-1) {
                fields.unshift(x);
                outnames.unshift(x);
            }
        });
        return function (chain) {
            var analysis = state.analysis || chain.header.analysis || this.params.analysis || 3;
            var requrl = this.url + "results/?filter=analysis in " + analysis  +
                " and chromosome in  '" + state.chr + "'" + 
                " and position ge " + state.start + 
                " and position le " + state.end;
            return LocusZoom.createCORSPromise("GET",requrl).then(function(x) {
                x = x.data;
                var records = [];
                fields.forEach(function(f) {
                    if (!(f in x)) {throw "field " + f + " not found in response";}
                });
                for(var i = 0; i < x.position.length; i++) {
                    var record = {};
                    for(var j=0; j<fields.length; j++) {
                        record[outnames[j]] = x[fields[j]][i];
                    }
                    records.push(record);
                }
                var res = {header: chain.header || {}, body: records};
                return res;
            });
        }.bind(this);
    };
};
LocusZoom.Data.AssociationSource.SOURCE_NAME = "AssociationLZ";

LocusZoom.Data.LDSource = function(init) {
    if (typeof init === "string") {
        this.url = init;
        this.params = {};
    } else {
        this.url = init.url;
        this.params = init.params || {};
    }
    if (!this.url) {
        throw("LDSource not initialized with required URL");
    }

    var findSmallestPvalue = function(x, pval) {
        pval = pval || "pvalue";
        var smVal = x[0][pval], smIdx=0;
        for(var i=1; i<x.length; i++) {
            if (x[i][pval] < smVal) {
                smVal = x[i][pval];
                smIdx = i;
            }
        }
        return smIdx;
    };

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

    this.getData = function(state, fields, outnames) {
        if (fields.length>1) {
            throw("LD currently only supports one field");
        }
        return function (chain) {
            var refSource = state.ldrefsource || chain.header.ldrefsource || 1;
            var refVar = fields[0];
            if (refVar == "state") {
                refVar = state.ldrefvar || chain.header.ldrefvar || "best";
            }
            if ( refVar=="best") {
                if (!chain.body) {
                    throw("No association data found to find best pvalue");
                }
                refVar = chain.body[findSmallestPvalue(chain.body)].id;
            }
            var requrl = this.url + "results/?filter=reference eq " + refSource + 
                " and chromosome2 eq '" + state.chr + "'" + 
                " and position2 ge " + state.start + 
                " and position2 le " + state.end + 
                " and variant1 eq '" + refVar + "'" + 
                "&fields=chr,pos,rsquare";
            return LocusZoom.createCORSPromise("GET",requrl).then(function(x) {
                if (!chain.header) {chain.header = {};}
                chain.header.ldrefvar = refVar;
                leftJoin(chain.body, x.data, outnames[0], "rsquare");
                return chain;   
            });
        }.bind(this);
    };
};
LocusZoom.Data.LDSource.SOURCE_NAME = "LDLZ";

LocusZoom.Data.GeneSource = function(init) {
    if (typeof init === "string") {
        this.url = init;
        this.params = {};
    } else {
        this.url = init.url;
        this.params = init.params || {};
    }
    if (!this.url) {
        throw("GeneSource not initialized with required URL");
    }

    this.getData = function(state, fields, outnames) {
        return function (chain) {
            var requrl = this.url + "?filter=source in 1" + 
                " and chrom eq '" + state.chr + "'" + 
                " and start le " + state.end +
                " and end ge " + state.start;
            return LocusZoom.createCORSPromise("GET",requrl).then(function(x) {
                return {header: chain.header, body: x.data};
            }, function(err) {
                console.log(err);
            });
        }.bind(this);
    };
};
LocusZoom.Data.GeneSource.SOURCE_NAME = "GeneLZ";

LocusZoom.createResolvedPromise = function() {
    var response = Q.defer();
    response.resolve(Array.prototype.slice.call(arguments));
    return response.promise;
};

LocusZoom.KnownDataSources = [
    LocusZoom.Data.AssociationSource,
    LocusZoom.Data.LDSource,
    LocusZoom.Data.GeneSource];


