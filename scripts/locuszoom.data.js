/* global LocusZoom,Q */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

LocusZoom.Data = LocusZoom.Data ||  {};

LocusZoom.Data.Requester = function(sources) {

    function split_requests(fields) {
        var requests = {};
        fields.forEach(function(field) {
            var parts = field.split(/\:(.*)/);
            if (parts.length==1) {
                if (typeof requests["base"] == "undefined") {
                    requests.base = [];
                }
                requests.base.push(field);
            } else {
                if (typeof requests[parts[0]] =="undefined") {
                    requests[parts[0]] = [];
                }
                requests[parts[0]].push(parts[1]);
            }
        });
        return requests;
    }
    
    this.getData = function(state, fields) {
        var requests = split_requests(fields);
        var promises = Object.keys(requests).map(function(key) {
            return sources[key].getData(state, requests[key]);
        });
        //assume the are requested in dependent order
        //TODO: better manage dependencies
        var ret = Q.when({});
        for(var i=0; i < promises.length; i++) {
            ret = ret.then(promises[i]);
        }
        return ret;
    };
};

LocusZoom.Data.AssociationSource = function(url) {
    this.url = url;

    this.getData = function(state, fields) {
        ["id","position"].forEach(function(x) {
            if (fields.indexOf(x)==-1) {
                fields.unshift(x);
            }
        });
        return function (chain) {
            var requrl = url + "results/?filter=analysis in 1 " + 
                "and chromosome in  '" + state.chr + "'" + 
                " and position ge " + state.start + 
                " and position le " + state.end;
            return LocusZoom.createCORSPromise("GET",requrl).then(function(x) {
                var records = [];
                fields.forEach(function(f) {
                    if (!(f in x)) {throw "field " + f + " not found in response";}
                });
                for(var i = 0; i < x.position.length; i++) {
                    var record = {};
                    fields.forEach(function(f) {
                        record[f] = x[f][i];
                    });
                    records.push(record);
                }
                var res = {header: chain.header || {}, body: records};
                return res;
            });
        };
    };
};

LocusZoom.Data.LDSource = function(url) {
    this.url = url;

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

    this.getData = function(state, fields) {
        return function (chain) {
            var refVar = state.ldrefvar || chain.header.ldrefvar;
            if (!refVar) {
                refVar = chain.body[findSmallestPvalue(chain.body)].id;
            }
            var requrl = url + "results/?filter=reference eq 2" + 
                " and chromosome2 eq '" + state.chr + "'" + 
                " and position2 ge " + state.start + 
                " and position2 le " + state.end + 
                " and variant1 eq '" + refVar + "'" + 
                "&fields=chr,pos,rsquare";
            return LocusZoom.createCORSPromise("GET",requrl).then(function(x) {
                chain.header.ldrefvar = refVar;
                console.log(x);
                return chain;   
            });
        };
    };
};

LocusZoom.Data.GeneSource = function(url) {
    this.url = url;

    this.getData = function(state, fields) {
        return function (chain) {
            var requrl = url + "?filter=source in 1" + 
                " and chrom eq '" + state.chr + "'" + 
                " and start ge " + state.start + 
                " and end le " + state.end;
            return LocusZoom.createCORSPromise("GET",requrl).then(function(x) {
                return {header: chain.header, body: x.data};
            }, function(err) {
                console.log(err);
            });
        };
    };
};

LocusZoom.createResolvedPromise = function() {
    var response = Q.defer();
    response.resolve(Array.prototype.slice.call(arguments));
    return response.promise;
};

LocusZoom.DefaultDataSources = {
    base: new LocusZoom.Data.AssociationSource("/api/v1/single/"),
    ld: new LocusZoom.Data.LDSource("/api/v1/pair/LD/"),
    gene: new LocusZoom.Data.GeneSource("/api/v1/annotation/genes/")
};

var lzd = new LocusZoom.Data.Requester(LocusZoom.DefaultDataSources);
