!function() {
    try {

        // Verify that the two third-party dependencies are met: d3 and Q
        var minimum_d3_version = "3.5.6";
        if (typeof d3 != "object"){
            throw("LocusZoom unable to load: d3 dependency not met. Library missing.");
        } else if (d3.version < minimum_d3_version){
            throw("LocusZoom unable to load: d3 dependency not met. Outdated version detected.\nRequired d3 version: " + minimum_d3_version + " or higher (found: " + d3.version + ").");
        }
        if (typeof Q != "function"){
            throw("LocusZoom unable to load: Q dependency not met. Library missing.");
        }
        
        /* global d3,Q */
/* eslint-env browser */
/* eslint-disable no-console */

var LocusZoom = {
    version: "0.3.2"
};

// Create a new instance by instance class and attach it to a div by ID
// NOTE: if no InstanceClass is passed then the instance will use the Intance base class.
//       The DefaultInstance class must be passed explicitly just as any other class that extends Instance.
LocusZoom.addInstanceToDivById = function(id, datasource, layout, state){

    // Initialize a new Instance
    var inst = new LocusZoom.Instance(id, datasource, layout, state);

    // Add an SVG to the div and set its dimensions
    inst.svg = d3.select("div#" + id)
        .append("svg")
        .attr("version", "1.1")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        //.attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("id", id + "_svg").attr("class", "lz-locuszoom");
    inst.setDimensions();
    // Initialize all panels
    inst.initialize();
    // Detect data-region and map to it if necessary
    if (typeof inst.svg.node().parentNode.dataset !== "undefined"
        && typeof inst.svg.node().parentNode.dataset.region !== "undefined"){
        var region = inst.svg.node().parentNode.dataset.region.split(/\D/);
        inst.mapTo(+region[0], +region[1], +region[2]);
    }
    return inst;
};
    
// Automatically detect divs by class and populate them with default LocusZoom instances
LocusZoom.populate = function(selector, datasource, layout, state) {
    if (typeof selector === "undefined"){
        throw ("LocusZoom.populate selector not defined");
    }
    var instance;
    d3.select(selector).each(function(){
        instance = LocusZoom.addInstanceToDivById(this.id, datasource, layout, state);
    });
    return instance;
};

LocusZoom.populateAll = function(selector, datasource, layout, state) {
    var instances = [];
    d3.selectAll(selector).each(function(d,i) {
        instances[i] = LocusZoom.populate(this, datasource, layout, state);
    });
    return instances;
};

// Convert an integer position to a string (e.g. 23423456 => "23.42" (Mb))
LocusZoom.positionIntToString = function(p){
    var places = Math.min(Math.max(6 - Math.floor((Math.log(p) / Math.LN10).toFixed(9)), 2), 12);
    return "" + (p / Math.pow(10, 6)).toFixed(places);
};

// Convert a string position to an integer (e.g. "5.8 Mb" => 58000000)
LocusZoom.positionStringToInt = function(p) {
    var val = p.toUpperCase();
    val = val.replace(/,/g, "");
    var suffixre = /([KMG])[B]*$/;
    var suffix = suffixre.exec(val);
    var mult = 1;
    if (suffix) {
        if (suffix[1]=="M") {
            mult = 1e6;
        } else if (suffix[1]=="G") {
            mult = 1e9;
        } else {
            mult = 1e3; //K
        }
        val = val.replace(suffixre,"");
    }
    val = Number(val) * mult;
    return val;
};

// Parse region queries that look like
// chr:start-end
// chr:center+offset
// chr:pos
// TODO: handle genes (or send off to API)
LocusZoom.parsePositionQuery = function(x) {
    var chrposoff = /^(\w+):([\d,.]+[kmgbKMGB]*)([-+])([\d,.]+[kmgbKMGB]*)$/;
    var chrpos = /^(\w+):([\d,.]+[kmgbKMGB]*)$/;
    var match = chrposoff.exec(x);
    if (match) {
        if (match[3] == "+") {
            var center = LocusZoom.positionStringToInt(match[2]);
            var offset = LocusZoom.positionStringToInt(match[4]);
            return {chr:match[1], start:center-offset, end:center+offset};
        } else {
            return {chr:match[1], start:LocusZoom.positionStringToInt(match[2]), end:LocusZoom.positionStringToInt(match[4])};
        }
    }
    match = chrpos.exec(x);
    if (match) {
        return {chr:match[1], position:LocusZoom.positionStringToInt(match[2])};
    }
    return null;
};

// Generate a "pretty" set of ticks (multiples of 1, 2, or 5 on the same order of magnitude for the range)
// Based on R's "pretty" function: https://github.com/wch/r-source/blob/b156e3a711967f58131e23c1b1dc1ea90e2f0c43/src/appl/pretty.c
//
// clip_range - string, optional - default "neither"
// First and last generated ticks may extend beyond the range. Set this to "low", "high", "both", or
// "neither" to clip the first (low) or last (high) tick to be inside the range or allow them to extend beyond.
// e.g. "low" will clip the first (low) tick if it extends beyond the low end of the range but allow the
// last (high) tick to extend beyond the range. "both" clips both ends, "neither" allows both to extend beyond.
//
// target_tick_count - integer, optional - default 5
// Specify a "target" number of ticks. Will not necessarily be the number of ticks you get, but should be
// pretty close. Defaults to 5.

LocusZoom.prettyTicks = function(range, clip_range, target_tick_count){
    if (typeof target_tick_count == "undefined" || isNaN(parseInt(target_tick_count))){
        target_tick_count = 5;
    }
    target_tick_count = parseInt(target_tick_count);
    
    var min_n = target_tick_count / 3;
    var shrink_sml = 0.75;
    var high_u_bias = 1.5;
    var u5_bias = 0.5 + 1.5 * high_u_bias;
    
    var d = Math.abs(range[0] - range[1]);
    var c = d / target_tick_count;
    if ((Math.log(d) / Math.LN10) < -2){
        c = (Math.max(Math.abs(d)) * shrink_sml) / min_n;
    }
    
    var base = Math.pow(10, Math.floor(Math.log(c)/Math.LN10));
    var base_toFixed = 0;
    if (base < 1 && base != 0){
        base_toFixed = Math.abs(Math.round(Math.log(base)/Math.LN10));
    }
    
    var unit = base;
    if ( ((2 * base) - c) < (high_u_bias * (c - unit)) ){
        unit = 2 * base;
        if ( ((5 * base) - c) < (u5_bias * (c - unit)) ){
            unit = 5 * base;
            if ( ((10 * base) - c) < (high_u_bias * (c - unit)) ){
                unit = 10 * base;
            }
        }
    }
    
    var ticks = [];
    var i = parseFloat( (Math.floor(range[0]/unit)*unit).toFixed(base_toFixed) );
    while (i < range[1]){
        ticks.push(i);
        i += unit;
        if (base_toFixed > 0){
            i = parseFloat(i.toFixed(base_toFixed));
        }
    }
    ticks.push(i);
    
    if (typeof clip_range == "undefined" || ["low", "high", "both", "neither"].indexOf(clip_range) == -1){
        clip_range = "neither";
    }
    if (clip_range == "low" || clip_range == "both"){
        if (ticks[0] < range[0]){ ticks = ticks.slice(1); }
    }
    if (clip_range == "high" || clip_range == "both"){
        if (ticks[ticks.length-1] > range[1]){ ticks.pop(); }
    }
    
    return ticks;
};

// From http://www.html5rocks.com/en/tutorials/cors/
// and with promises from https://gist.github.com/kriskowal/593076
LocusZoom.createCORSPromise = function (method, url, body, timeout) {
    var response = Q.defer();
    var xhr = new XMLHttpRequest();
    if ("withCredentials" in xhr) {
        // Check if the XMLHttpRequest object has a "withCredentials" property.
        // "withCredentials" only exists on XMLHTTPRequest2 objects.
        xhr.open(method, url, true);
    } else if (typeof XDomainRequest != "undefined") {
        // Otherwise, check if XDomainRequest.
        // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
        xhr = new XDomainRequest();
        xhr.open(method, url);
    } else {
        // Otherwise, CORS is not supported by the browser.
        xhr = null;
    }
    if (xhr) {
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0 ) {
                    response.resolve(JSON.parse(xhr.responseText));
                } else {
                    response.reject("HTTP " + xhr.status + " for " + url);
                }
            }
        };
        timeout && setTimeout(response.reject, timeout);
        body = typeof body !== "undefined" ? body : "";
        xhr.send(body);
    } 
    return response.promise;
};

// Merge two layout objects
// Primarily used to merge values from the second argument (the "default" layout) into the first (the "custom" layout)
// Ensures that all values defined in the second layout are at least present in the first
// Favors values defined in the first layout if values are defined in both but different
LocusZoom.mergeLayouts = function (custom_layout, default_layout) {
    if (typeof custom_layout != "object" || typeof default_layout != "object"){
        throw("LocusZoom.mergeLayouts only accepts two layout objects; " + (typeof custom_layout) + ", " + (typeof default_layout) + " given");
    }
    for (var property in default_layout) {
        if (!default_layout.hasOwnProperty(property)){ continue; }
        // Get types for comparison. Treat nulls in the custom layout as undefined for simplicity
        // (javascript treats nulls as "object" when we just want to overwrite them as if they're undefined)
        var custom_type  = custom_layout[property] == null ? "undefined" : typeof custom_layout[property];
        var default_type = typeof default_layout[property];
        // Unsupported property types: throw an exception
        if (custom_type == "function" || default_type == "function"){
            throw("LocusZoom.mergeLayouts encountered an unsupported property type");
        }
        // Undefined custom value: pull the default value
        if (custom_type == "undefined"){
            custom_layout[property] = JSON.parse(JSON.stringify(default_layout[property]));
            continue;
        }
        // Both values are objects: merge recursively
        if (custom_type == "object" && default_type == "object"){
            custom_layout[property] = LocusZoom.mergeLayouts(custom_layout[property], default_layout[property]);
            continue;
        }
    }
    return custom_layout;
};

// Default State
LocusZoom.DefaultState = {
    chr: 0,
    start: 0,
    end: 0
};

// Default Layout
LocusZoom.DefaultLayout = {
    width: 700,
    height: 700,
    min_width: 300,
    min_height: 400,
    panels: {
        positions: {
            origin: { x: 0, y: 0 },
            width:      700,
            height:     350,
            min_width:  300,
            min_height: 200,
            proportional_width: 1,
            proportional_height: 0.5,
            margin: { top: 20, right: 20, bottom: 35, left: 50 },
            axes: {
                x: {
                    label_function: "chromosome"
                },
                y1: {
                    label: "-log10 p-value"
                }
            },
            data_layers: {
                positions: {
                    type: "scatter",
                    point_shape: "circle",
                    point_size: 40,
                    point_label_field: "id",
                    fields: ["id", "position", "pvalue|neglog10", "refAllele", "ld:state"],
                    x_axis: {
                        field: "position"
                    },
                    y_axis: {
                        axis: 1,
                        field: "pvalue|neglog10",
                        floor: 0,
                        upper_buffer: 0.05
                    },
                    color: {
                        field: "ld:state",
                        scale_function: "numerical_bin",
                        parameters: {
                            breaks: [0, 0.2, 0.4, 0.6, 0.8],
                            values: ["#357ebd","#46b8da","#5cb85c","#eea236","#d43f3a"],
                            null_value: "#B8B8B8"
                        }
                    }
                }
            }
        },
        genes: {
            origin: { x: 0, y: 350 },
            width:      700,
            height:     350,
            min_width:  300,
            min_height: 200,
            proportional_width: 1,
            proportional_height: 0.5,
            margin: { top: 20, right: 20, bottom: 20, left: 50 },
            data_layers: {
                genes: {
                    type: "genes",
                    fields: ["gene:gene"]
                }
            }
        }
    }
};

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
    var N_X = [];
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
        var p = LocusZoom.Stats.pchisq(T*T,1,0,0);
        if (trans && trans[0]) {
            chain.body[i][outnames[0]] = trans[0](p);
        } else {
            chain.body[i][outnames[0]] = p;
        }
        //chain.body[i].condScoreTestStat = T;
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

/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Instance Class

  An Instance is an independent LocusZoom object. Many such LocusZoom objects can exist simultaneously
  on a single page, each having its own layout, data sources, and state.

*/

LocusZoom.Instance = function(id, datasource, layout, state) {

    this.initialized = false;

    this.id = id;
    
    this.svg = null;

    // The panels property stores child panel instances
    this.panels = {};
    this.remap_promises = [];

    // The layout is a serializable object used to describe the composition of the instance
    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.DefaultLayout);
    
    // The state property stores any instance-wide parameters subject to change via user input
    this.state = state || JSON.parse(JSON.stringify(LocusZoom.DefaultState));
    
    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);

    // Initialize the layout
    this.initializeLayout();

    return this;
  
};

LocusZoom.Instance.prototype.initializeLayout = function(){

    // Set instance dimensions
    this.setDimensions();

    // Add panels
    var panel_id;
    for (panel_id in this.layout.panels){
        this.addPanel(panel_id, this.layout.panels[panel_id]);
    }

};

// Set the layout dimensions for this instance. If an SVG exists, update its dimensions.
// If any arguments are missing, use values stored in the layout. Keep everything in agreement.
LocusZoom.Instance.prototype.setDimensions = function(width, height){
    if (!isNaN(width) && width >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
    }
    if (this.svg != null){
        this.svg.attr("width", this.layout.width).attr("height", this.layout.height);
    }
    if (this.initialized){
        this.ui.render();
        this.stackPanels();
    }
    return this;
};

// Create a new panel by id and panel class
LocusZoom.Instance.prototype.addPanel = function(id, layout){
    if (typeof id !== "string"){
        throw "Invalid panel id passed to LocusZoom.Instance.prototype.addPanel()";
    }
    if (typeof this.panels[id] !== "undefined"){
        throw "Cannot create panel with id [" + id + "]; panel with that id already exists";
    }
    if (typeof layout !== "object"){
        throw "Invalid panel layout passed to LocusZoom.Instance.prototype.addPanel()";
    }
    var panel = new LocusZoom.Panel(id, layout);
    panel.parent = this;
    this.panels[panel.id] = panel;
    this.stackPanels();
    return this.panels[panel.id];
};

// Automatically position panels based on panel positioning rules and values
// Default behavior: position panels vertically with equally proportioned heights
// In all cases: bubble minimum panel dimensions up from panels to enforce minimum instance dimensions
LocusZoom.Instance.prototype.stackPanels = function(){

    var id;

    // First set/enforce minimum instance dimensions based on current panels
    var panel_min_widths = [];
    var panel_min_heights = [];
    for (id in this.panels){
        panel_min_widths.push(this.panels[id].layout.min_width);
        panel_min_heights.push(this.panels[id].layout.min_height);
    }
    if (panel_min_widths.length){
        this.layout.min_width = Math.max.apply(null, panel_min_widths);
    }
    if (panel_min_heights.length){
        this.layout.min_height = panel_min_heights.reduce(function(a,b){ return a+b; });
    }
    if (this.layout.width < this.layout.min_width || this.layout.height < this.layout.min_height){
        this.setDimensions(Math.max(this.layout.width, this.layout.min_width),
                           Math.max(this.layout.height, this.layout.min_height));
        return;
    }

    // Next set proportional and discrete heights of panels
    var proportional_height = 1 / Object.keys(this.panels).length;
    var discrete_height = this.layout.height * proportional_height;
    var panel_idx = 0;
    for (id in this.panels){
        this.panels[id].layout.proportional_height = proportional_height;
        this.panels[id].setOrigin(0, panel_idx * discrete_height);
        this.panels[id].setDimensions(this.layout.width, discrete_height);
        panel_idx++;
    }

};

// Create all instance-level objects, initialize all child panels
LocusZoom.Instance.prototype.initialize = function(){

    // Create an element/layer for containing mouse guides
    var mouse_guide_svg = this.svg.append("g")
        .attr("class", "lz-mouse_guide").attr("id", this.id + ".mouse_guide");
    var mouse_guide_vertical_svg = mouse_guide_svg.append("rect")
        .attr("class", "lz-mouse_guide-vertical").attr("x",-1);
    var mouse_guide_horizontal_svg = mouse_guide_svg.append("rect")
        .attr("class", "lz-mouse_guide-horizontal").attr("y",-1);
    this.mouse_guide = {
        svg: mouse_guide_svg,
        vertical: mouse_guide_vertical_svg,
        horizontal: mouse_guide_horizontal_svg
    };

    // Create an element/layer for containing various UI items
    var ui_svg = this.svg.append("g")
        .attr("class", "lz-ui").attr("id", this.id + ".ui")
        .style("display", "none");
    this.ui = {
        svg: ui_svg,
        parent: this,
        is_resize_dragging: false,
        show: function(){
            this.svg.style("display", null);
        },
        hide: function(){
            this.svg.style("display", "none");
        },
        initialize: function(){
            // Resize handle
            this.resize_handle = this.svg.append("g")
                .attr("id", this.parent.id + ".ui.resize_handle");
            this.resize_handle.append("path")
                .attr("class", "lz-ui-resize_handle")
                .attr("d", "M 0,16, L 16,0, L 16,16 Z");
            var resize_drag = d3.behavior.drag();
            //resize_drag.origin(function() { return this; });
            resize_drag.on("dragstart", function(){
                this.resize_handle.select("path").attr("class", "lz-ui-resize_handle_dragging");
                this.is_resize_dragging = true;
            }.bind(this));
            resize_drag.on("dragend", function(){
                this.resize_handle.select("path").attr("class", "lz-ui-resize_handle");
                this.is_resize_dragging = false;
            }.bind(this));
            resize_drag.on("drag", function(){
                this.setDimensions(this.layout.width + d3.event.dx, this.layout.height + d3.event.dy);
            }.bind(this.parent));
            this.resize_handle.call(resize_drag);
            // Render all UI elements
            this.render();
        },
        render: function(){
            this.resize_handle
                .attr("transform", "translate(" + (this.parent.layout.width - 17) + ", " + (this.parent.layout.height - 17) + ")");
        }
    };
    this.ui.initialize();

    // Create the curtain object with svg element and drop/raise methods
    var curtain_svg = this.svg.append("g")
        .attr("class", "lz-curtain").style("display", "none")
        .attr("id", this.id + ".curtain");
    this.curtain = {
        svg: curtain_svg,
        drop: function(message){
            this.svg.style("display", null);
            if (typeof message != "undefined"){
                this.svg.select("text").selectAll("tspan").remove();
                message.split("\n").forEach(function(line){
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "1.5em").text(line);
                }.bind(this));
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect");
    this.curtain.svg.append("text")
        .attr("id", this.id + ".curtain_text")
        .attr("x", "1em").attr("y", "0em");

    // Initialize all panels
    for (var id in this.panels){
        this.panels[id].initialize();
    }

    // Define instance/svg level mouse events
    this.svg.on("mouseover", function(){
        if (!this.ui.is_resize_dragging){
            this.ui.show();
        }
    }.bind(this));
    this.svg.on("mouseout", function(){
        if (!this.ui.is_resize_dragging){
            this.ui.hide();
        }
        this.mouse_guide.vertical.attr("x", -1);
        this.mouse_guide.horizontal.attr("y", -1);
    }.bind(this));
    this.svg.on("mousemove", function(){
        var coords = d3.mouse(this.svg.node());
        this.mouse_guide.vertical.attr("x", coords[0]);
        this.mouse_guide.horizontal.attr("y", coords[1]);
    }.bind(this));
    
    // Flip the "initialized" bit
    this.initialized = true;

    return this;

};

// Map an entire LocusZoom Instance to a new region
LocusZoom.Instance.prototype.mapTo = function(chr, start, end){

    // Apply new state values
    // TODO: preserve existing state until new state is completely loaded+rendered or aborted?
    this.state.chr   = +chr;
    this.state.start = +start;
    this.state.end   = +end;

    this.remap_promises = [];
    // Trigger reMap on each Panel Layer
    for (var id in this.panels){
        this.remap_promises.push(this.panels[id].reMap());
    }

    Q.all(this.remap_promises)
        .catch(function(error){
            console.log(error);
            this.curtain.drop(error);
        }.bind(this))
        .done();

    return this;
    
};

// Refresh an instance's data from sources without changing position
LocusZoom.Instance.prototype.refresh = function(){
    this.mapTo(this.state.chr, this.state.start, this.state.end);
};

/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Panel Class

  A panel is an abstract class representing a subdivision of the LocusZoom stage
  to display a distinct data representation

*/

LocusZoom.Panel = function(id, layout) { 

    this.initialized = false;
    
    this.id     = id;
    this.parent = null;
    this.svg    = {};

    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.Panel.DefaultLayout);
    
    this.data_layers = {};
    this.data_layer_ids_by_z_index = [];
    this.data_promises = [];

    this.xExtent  = null;
    this.y1Extent = null;
    this.y2Extent = null;

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };

    // Initialize the layout
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.DefaultLayout = {
    width:  0,
    height: 0,
    min_width: 0,
    min_height: 0,
    proportional_width: 1,
    proportional_height: 1,
    origin: { x: 0, y: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    cliparea: {
        height: 0,
        width: 0,
        origin: { x: 0, y: 0 }
    },
    axes: {
        x:  {},
        y1: {},
        y2: {}
    }            
};

LocusZoom.Panel.prototype.initializeLayout = function(){

    // Set panel dimensions, origin, and margin
    this.setDimensions();
    this.setOrigin();
    this.setMargin();

    // Initialize panel axes
    ["x", "y1", "y2"].forEach(function(axis){
        if (JSON.stringify(this.layout.axes[axis]) == JSON.stringify({})){
            // The default layout sets the axis to an empty object, so set its render boolean here
            this.layout.axes[axis].render = false;
        } else {
            this.layout.axes[axis].render = true;
            this.layout.axes[axis].ticks = this.layout.axes[axis].ticks || [];
            this.layout.axes[axis].label = this.layout.axes[axis].label || null;
            this.layout.axes[axis].label_function = this.layout.axes[axis].label_function || null;
            this.layout.axes[axis].data_layer_id = this.layout.axes[axis].data_layer_id || null;
        }
    }.bind(this));

    // Add data layers (which define x and y extents)
    if (typeof this.layout.data_layers == "object"){
        var data_layer_id;
        for (data_layer_id in this.layout.data_layers){
            this.addDataLayer(data_layer_id, this.layout.data_layers[data_layer_id]);
        }
    }

};

LocusZoom.Panel.prototype.setDimensions = function(width, height){
    if (!isNaN(width) && width >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
    }
    this.layout.cliparea.width = this.layout.width - (this.layout.margin.left + this.layout.margin.right);
    this.layout.cliparea.height = this.layout.height - (this.layout.margin.top + this.layout.margin.bottom);    
    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setOrigin = function(x, y){
    if (!isNaN(x) && x >= 0){ this.layout.origin.x = Math.min(Math.max(Math.round(+x), 0), this.parent.layout.width); }
    if (!isNaN(y) && y >= 0){ this.layout.origin.y = Math.min(Math.max(Math.round(+y), 0), this.parent.layout.height); }
    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setMargin = function(top, right, bottom, left){
    var extra;
    if (!isNaN(top)    && top    >= 0){ this.layout.margin.top    = Math.max(Math.round(+top),    0); }
    if (!isNaN(right)  && right  >= 0){ this.layout.margin.right  = Math.max(Math.round(+right),  0); }
    if (!isNaN(bottom) && bottom >= 0){ this.layout.margin.bottom = Math.max(Math.round(+bottom), 0); }
    if (!isNaN(left)   && left   >= 0){ this.layout.margin.left   = Math.max(Math.round(+left),   0); }
    if (this.layout.margin.top + this.layout.margin.bottom > this.layout.height){
        extra = Math.floor(((this.layout.margin.top + this.layout.margin.bottom) - this.layout.height) / 2);
        this.layout.margin.top -= extra;
        this.layout.margin.bottom -= extra;
    }
    if (this.layout.margin.left + this.layout.margin.right > this.layout.width){
        extra = Math.floor(((this.layout.margin.left + this.layout.margin.right) - this.layout.width) / 2);
        this.layout.margin.left -= extra;
        this.layout.margin.right -= extra;
    }
    this.layout.cliparea.width = this.layout.width - (this.layout.margin.left + this.layout.margin.right);
    this.layout.cliparea.height = this.layout.height - (this.layout.margin.top + this.layout.margin.bottom);
    this.layout.cliparea.origin.x = this.layout.margin.left;
    this.layout.cliparea.origin.y = this.layout.margin.top;

    //console.log(this.layout);

    if (this.initialized){ this.render(); }
    return this;
};

// Initialize a panel
LocusZoom.Panel.prototype.initialize = function(){

    // Append a container group element to house the main panel group element and the clip path
    this.svg.container = this.parent.svg.insert("svg:g", "#" + this.parent.id + "\\.ui")
        .attr("id", this.getBaseId() + ".panel_container");
        
    // Append clip path to the parent svg element
    var clipPath = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip");
    this.svg.clipRect = clipPath.append("rect");
    
    // Append svg group for rendering all panel child elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".panel")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Append a curtain element with svg element and drop/raise methods
    var panel_curtain_svg = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".curtain")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)")
        .attr("class", "lz-curtain").style("display", "none");
    this.curtain = {
        svg: panel_curtain_svg,
        drop: function(message){
            this.svg.style("display", null);
            if (typeof message != "undefined"){
                this.svg.select("text").selectAll("tspan").remove();
                message.split("\n").forEach(function(line){
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "1.5em").text(line);
                }.bind(this));
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect");
    this.curtain.svg.append("text")
        .attr("id", this.id + ".curtain_text")
        .attr("x", "1em").attr("y", "0em");

    // Initialize Axes
    this.svg.x_axis = this.svg.group.append("g").attr("class", "lz-x lz-axis");
    if (this.layout.axes.x.render){
        this.svg.x_axis_label = this.svg.x_axis.append("text")
            .attr("class", "lz-x lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y1_axis = this.svg.group.append("g").attr("class", "lz-y lz-y1 lz-axis");
    if (this.layout.axes.y1.render){
        this.svg.y1_axis_label = this.svg.y1_axis.append("text")
            .attr("class", "lz-y1 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y2_axis = this.svg.group.append("g").attr("class", "lz-y lz-y2 lz-axis");
    if (this.layout.axes.y2.render){
        this.svg.y2_axis_label = this.svg.y2_axis.append("text")
            .attr("class", "lz-y2 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }

    // Initialize child Data Layers
    for (var id in this.data_layers){
        this.data_layers[id].initialize();
    }

    // Flip the "initialized" bit
    this.initialized = true;

    return this;
    
};


// Create a new data layer by layout object
LocusZoom.Panel.prototype.addDataLayer = function(id, layout){
    if (typeof id !== "string"){
        throw "Invalid data layer id passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof layout !== "object"){
        throw "Invalid data layer layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof this.data_layers[layout.id] !== "undefined"){
        throw "Cannot create data layer with id [" + id + "]; data layer with that id already exists";
    }
    if (typeof layout.type !== "string"){
        throw "Invalid data layer type in layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    var data_layer = LocusZoom.DataLayers.get(layout.type, id, layout);
    data_layer.parent = this;
    this.data_layers[data_layer.id] = data_layer;
    this.data_layer_ids_by_z_index.push(data_layer.id);

    // Generate xExtent function (defaults to the state range defined by "start" and "end")
    if (layout.x_axis){
        this.xExtent = this.data_layers[data_layer.id].getAxisExtent("x");
    } else {
        this.xExtent = function(){
            return d3.extent([this.parent.state.start, this.parent.state.end]);
        };
    }
    // Generate the yExtent function
    if (layout.y_axis){
        var y_axis_name = "y" + (layout.y_axis.axis == 1 || layout.y_axis.axis == 2 ? layout.y_axis.axis : 1);
        this[y_axis_name + "Extent"] = this.data_layers[data_layer.id].getAxisExtent("y");
        this.layout.axes[y_axis_name].data_layer_id = data_layer.id;
    }

    return this.data_layers[data_layer.id];
};


// Re-Map a panel to new positions according to the parent instance's state
LocusZoom.Panel.prototype.reMap = function(){
    this.data_promises = [];
    // Trigger reMap on each Data Layer
    for (var id in this.data_layers){
        this.data_promises.push(this.data_layers[id].reMap());
    }
    // When all finished trigger a render
    return Q.all(this.data_promises)
        .then(function(){
            this.render();
        }.bind(this))
        .catch(function(error){
            console.log(error);
            this.curtain.drop(error);
        }.bind(this));
};


// Render a given panel
LocusZoom.Panel.prototype.render = function(){

    // Using the associated data layer axis layout declaration for floor, ceiling, upper, and lower buffer
    // determine the correct clip_range value to pass to prettyTicks (e.g. "low", "high", "both", or "neither")
    var clip_range = function(layout, axis){
        var clip_value = "neither";
        if (layout.axes[axis].data_layer_id){
            var axis_layout = layout.data_layers[layout.axes[axis].data_layer_id].y_axis;
            if (typeof axis_layout.floor == "number"){ clip_value = "low"; }
            if (typeof axis_layout.ceiling == "number"){ clip_value = "high"; }
            if (typeof axis_layout.floor == "number" && typeof axis_layout.ceiling == "number"){ clip_value = "both"; }
        }
        return clip_value;
    };

    // Position the panel container
    this.svg.container.attr("transform", "translate(" + this.layout.origin.x +  "," + this.layout.origin.y + ")");

    // Set size on the clip rect
    this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);

    // Generate discrete extents and scales
    if (typeof this.xExtent == "function"){
        this.x_extent = this.xExtent();
        this.layout.axes.x.ticks = LocusZoom.prettyTicks(this.x_extent, "both", this.layout.cliparea.width/120);
        this.x_scale = d3.scale.linear()
            .domain([this.x_extent[0], this.x_extent[1]])
            .range([0, this.layout.cliparea.width]);
    }
    if (typeof this.y1Extent == "function"){
        this.y1_extent = this.y1Extent();
        this.layout.axes.y1.ticks = LocusZoom.prettyTicks(this.y1_extent, clip_range(this.layout, "y1"));
        this.y1_scale = d3.scale.linear()
            .domain([this.layout.axes.y1.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y1.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }
    if (typeof this.y2Extent == "function"){
        this.y2_extent = this.y2Extent();
        this.layout.axes.y2.ticks = LocusZoom.prettyTicks(this.y2_extent, clip_range(this.layout, "y2"));
        this.y2_scale = d3.scale.linear()
            .domain([this.layout.axes.y2.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y2.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }

    // Render axes and labels
    var canRenderAxis = function(axis){
        return (typeof this[axis + "_scale"] == "function" && !isNaN(this[axis + "_scale"](0)));
    }.bind(this);
    
    if (this.layout.axes.x.render && canRenderAxis("x")){
        this.x_axis = d3.svg.axis()
            .scale(this.x_scale)
            .orient("bottom").tickValues(this.layout.axes.x.ticks)
            .tickFormat(function(d) { return LocusZoom.positionIntToString(d); });
        this.svg.x_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + (this.layout.height - this.layout.margin.bottom) + ")")
            .call(this.x_axis);
        if (this.layout.axes.x.label_function){
            this.layout.axes.x.label = LocusZoom.LabelFunctions.get(this.layout.axes.x.label_function, this.parent.state);
        }
        if (this.layout.axes.x.label != null){
            var x_label = this.layout.axes.x.label;
            if (typeof this.layout.axes.x.label == "function"){ x_label = this.layout.axes.x.label(); }
            this.svg.x_axis_label
                .attr("x", this.layout.cliparea.width / 2)
                .attr("y", this.layout.margin.bottom * 0.95)
                .text(x_label);
        }
    }

    if (this.layout.axes.y1.render && canRenderAxis("y1")){
        this.y1_axis = d3.svg.axis().scale(this.y1_scale)
            .orient("left").tickValues(this.layout.axes.y1.ticks);
        this.svg.y1_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + this.layout.margin.top + ")")
            .call(this.y1_axis);
        if (this.layout.axes.y1.label_function){
            this.layout.axes.y1.label = LocusZoom.LabelFunctions.get(this.layout.axes.y1.label_function, this.parent.state);
        }
        if (this.layout.axes.y1.label != null){
            var y1_label = this.layout.axes.y1.label;
            if (typeof this.layout.axes.y1.label == "function"){ y1_label = this.layout.axes.y1.label(); }
            var y1_label_x = this.layout.margin.left * -0.55;
            var y1_label_y = this.layout.cliparea.height / 2;
            this.svg.y1_axis_label
                .attr("transform", "rotate(-90 " + y1_label_x + "," + y1_label_y + ")")
                .attr("x", y1_label_x).attr("y", y1_label_y)
                .text(y1_label);
        }
    }

    if (this.layout.axes.y2.render && canRenderAxis("y2")){
        this.y2_axis  = d3.svg.axis().scale(this.y2_scale)
            .orient("left").tickValues(this.layout.axes.y2.ticks);
        this.svg.y2_axis
            .attr("transform", "translate(" + (this.layout.width - this.layout.margin.right) + "," + this.layout.margin.top + ")")
            .call(this.y2_axis);
        if (this.layout.axes.y2.label_function){
            this.layout.axes.y2.label = LocusZoom.LabelFunctions.get(this.layout.axes.y2.label_function, this.parent.state);
        }
        if (this.layout.axes.y2.label != null){
            var y2_label = this.layout.axes.y2.label;
            if (typeof this.layout.axes.y2.label == "function"){ y2_label = this.layout.axes.y2.label(); }
            var y2_label_x = this.layout.margin.right * 0.55;
            var y2_label_y = this.layout.cliparea.height / 2;
            this.svg.y2_axis_label
                .attr("transform", "rotate(-90 " + y2_label_x + "," + y2_label_y + ")")
                .attr("x", y2_label_x).attr("y", y2_label_y)
                .text(y2_label);
        }
    }

    // Render data layers in order by z-index
    this.data_layer_ids_by_z_index.forEach(function(data_layer_id){
        this.data_layers[data_layer_id].draw().render();
    }.bind(this));

    return this;
    
};

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Data Layer Class

  A data layer is an abstract class representing a data set and its
  graphical representation within a panel

*/

LocusZoom.DataLayer = function(id, layout) {

    this.initialized = false;

    this.id     = id;
    this.parent = null;
    this.svg    = {};

    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.DataLayer.DefaultLayout);

    this.data = [];
    this.metadata = {};

    this.getBaseId = function(){
        return this.parent.parent.id + "." + this.parent.id + "." + this.id;
    };
    
    return this;

};

LocusZoom.DataLayer.DefaultLayout = {
    type: "",
    fields: []
};

// Generate a y-axis extent functions based on the layout
LocusZoom.DataLayer.prototype.getAxisExtent = function(dimension){
    var axis = dimension + "_axis";
    return function(){
        var extent = d3.extent(this.data, function(d) {
            return +d[this.layout[axis].field];
        }.bind(this));
        // Apply upper/lower buffers, if applicable
        var original_extent_span = extent[1] - extent[0];
        if (!isNaN(this.layout[axis].lower_buffer)){ extent[0] -= original_extent_span * this.layout[axis].lower_buffer; }
        if (!isNaN(this.layout[axis].upper_buffer)){ extent[1] += original_extent_span * this.layout[axis].upper_buffer; }
        // Apply floor/ceiling, if applicable
        if (!isNaN(this.layout[axis].floor)){ extent[0] = Math.max(extent[0], this.layout[axis].floor); }
        if (!isNaN(this.layout[axis].ceiling)){ extent[1] = Math.min(extent[1], this.layout[axis].ceiling); }
        return extent;
    }.bind(this);
};

// Initialize a data layer
LocusZoom.DataLayer.prototype.initialize = function(){

    // Append a container group element to house the main data layer group element and the clip path
    this.svg.container = this.parent.svg.group.append("g")
        .attr("id", this.getBaseId() + ".data_layer_container");
        
    // Append clip path to the container element
    this.svg.clipRect = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip")
        .append("rect");
    
    // Append svg group for rendering all data layer elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".data_layer")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Flip the "initialized" bit
    this.initialized = true;

    return this;

};

LocusZoom.DataLayer.prototype.draw = function(){
    this.svg.container.attr("transform", "translate(" + this.parent.layout.cliparea.origin.x +  "," + this.parent.layout.cliparea.origin.y + ")");
    this.svg.clipRect
        .attr("width", this.parent.layout.cliparea.width)
        .attr("height", this.parent.layout.cliparea.height);
    return this;
};

// Re-Map a data layer to new positions according to the parent panel's parent instance's state
LocusZoom.DataLayer.prototype.reMap = function(){
    var promise = this.parent.parent.lzd.getData(this.parent.parent.state, this.layout.fields); //,"ld:best"
    promise.then(function(new_data){
        this.data = new_data.body;
    }.bind(this));
    return promise;
};

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Singletons

  LocusZoom has various singleton objects that are used for registering functions or classes.
  These objects provide safe, standard methods to redefine or delete existing functions/classes
  as well as define new custom functions/classes to be used in a plot.

*/


/****************
  Label Functions

  These functions will generate a string based on a provided state object. Useful for dynamic axis labels.
*/

LocusZoom.LabelFunctions = (function() {
    var obj = {};
    var functions = {};

    obj.get = function(name, state) {
        if (!name) {
            return null;
        } else if (functions[name]) {
            if (typeof state == "undefined"){
                return functions[name];
            } else {
                return functions[name](state);
            }
        } else {
            throw("label function [" + name + "] not found");
        }
    };

    obj.set = function(name, fn) {
        if (fn) {
            functions[name] = fn;
        } else {
            delete functions[name];
        }
    };

    obj.add = function(name, fn) {
        if (functions[name]) {
            throw("label function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();

// Label function for "Chromosome # (Mb)" where # comes from state
LocusZoom.LabelFunctions.add("chromosome", function(state){
    if (!isNaN(+state.chr)){ 
        return "Chromosome " + state.chr + " (Mb)";
    } else {
        return "Chromosome (Mb)";
    }
});


/****************
  Scale Functions

  Singleton for accessing/storing functions that will convert arbitrary data points to values in a given scale
  Useful for anything that needs to scale discretely with data (e.g. color, point size, etc.)

  All scale functions must accept an object of parameters and a value to process.
*/

LocusZoom.ScaleFunctions = (function() {
    var obj = {};
    var functions = {};

    obj.get = function(name, parameters, value) {
        if (!name) {
            return null;
        } else if (functions[name]) {
            if (typeof parameters == "undefined" && typeof value == "undefined"){
                return functions[name];
            } else {
                return functions[name](parameters, value);
            }
        } else {
            throw("scale function [" + name + "] not found");
        }
    };

    obj.set = function(name, fn) {
        if (fn) {
            functions[name] = fn;
        } else {
            delete functions[name];
        }
    };

    obj.add = function(name, fn) {
        if (functions[name]) {
            throw("scale function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();

// Numerical Bin scale function: bin a dataset numerically by an array of breakpoints
LocusZoom.ScaleFunctions.add("numerical_bin", function(parameters, value){
    var breaks = parameters.breaks;
    var values = parameters.values;
    if (value == null || isNaN(+value)){
        return (parameters.null_value ? parameters.null_value : values[0]);
    }
    var threshold = breaks.reduce(function(prev, curr){
        if (+value < prev || (+value >= prev && +value < curr)){
            return prev;
        } else {
            return curr;
        }
    });
    return values[breaks.indexOf(threshold)];
});

// Categorical Bin scale function: bin a dataset numerically by matching against an array of distinct values
LocusZoom.ScaleFunctions.add("categorical_bin", function(parameters, value){
    if (parameters.categories.indexOf(value) != -1){
        return parameters.values[parameters.categories.indexOf(value)];
    } else {
        return (parameters.null_value ? parameters.null_value : parameters.values[0]); 
    }
});


/************************
  Data Layer Subclasses

  The abstract Data Layer class has general methods and properties that apply universally to all Data Layers
  Specific data layer subclasses (e.g. a scatter plot, a line plot, gene visualization, etc.) must be defined
  and registered with this singleton to be accessible.

  All new Data Layer subclasses must be defined by accepting an id string and a layout object.
  Singleton for storing available Data Layer classes as well as updating existing and/or registering new ones
*/

LocusZoom.DataLayers = (function() {
    var obj = {};
    var datalayers = {};

    obj.get = function(name, id, layout) {
        if (!name) {
            return null;
        } else if (datalayers[name]) {
            if (typeof id == "undefined" || typeof layout == "undefined"){
                throw("id or layout argument missing for data layer [" + name + "]");
            } else {
                return new datalayers[name](id, layout);
            }
        } else {
            throw("data layer [" + name + "] not found");
        }
    };

    obj.set = function(name, datalayer) {
        if (datalayer) {
            if (typeof datalayer != "function"){
                throw("unable to set data layer [" + name + "], argument provided is not a function");
            } else {
                datalayers[name] = datalayer;
                datalayers[name].prototype = new LocusZoom.DataLayer();
            }
        } else {
            delete datalayers[name];
        }
    };

    obj.add = function(name, datalayer) {
        if (datalayers[name]) {
            throw("data layer already exists with name: " + name);
        } else {
            obj.set(name, datalayer);
        }
    };

    obj.list = function() {
        return Object.keys(datalayers);
    };

    return obj;
})();



/*********************
  Scatter Data Layer
  Implements a standard scatter plot
*/

LocusZoom.DataLayers.add("scatter", function(id, layout){

    LocusZoom.DataLayer.apply(this, arguments);

    this.DefaultLayout = {
        point_size: 40,
        point_shape: "circle",
        color: "#888888",
        y_axis: {
            axis: 1
        }
    };

    this.layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);

    // Implement the main render function
    this.render = function(){
        this.svg.group.selectAll("*").remove(); // should this happen at all, or happen at the panel level?
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-scatter")
            .data(this.data)
            .enter().append("path")
            .attr("class", "lz-data_layer-scatter")
            .attr("transform", function(d) {
                var x = this.parent.x_scale(d[this.layout.x_axis.field]);
                var y_scale = "y"+this.layout.y_axis.axis+"_scale";
                var y = this.parent[y_scale](d[this.layout.y_axis.field]);
                return "translate(" + x + "," + y + ")";
            }.bind(this))
            .attr("d", d3.svg.symbol().size(this.layout.point_size).type(this.layout.point_shape))
            .style({ cursor: "pointer" });
        // Apply id (if included in fields)
        if (this.layout.fields.indexOf("id") != -1){
            selection.attr("id", function(d){ return d.id; });
        }
        // Apply color
        if (this.layout.color){
            switch (typeof this.layout.color){
            case "string":
                selection.attr("fill", this.layout.color);
                break;
            case "object":
                if (this.layout.color.scale_function && this.layout.color.field) {
                    selection.attr("fill", function(d){
                        return LocusZoom.ScaleFunctions.get(this.layout.color.scale_function,
                                                            this.layout.color.parameters || {},
                                                            d[this.layout.color.field]);
                    }.bind(this));
                }
                break;
            }
        }
        // Apply title (basic mouseover label)
        if (this.layout.point_label_field){
            selection.append("svg:title")
                .text(function(d) { return d[this.layout.point_label_field]; }.bind(this));
        }
    };
       
    return this;
});

/*********************
  Genes Data Layer
  Implements a data layer that will render gene tracks
*/

LocusZoom.DataLayers.add("genes", function(id, layout){

    LocusZoom.DataLayer.apply(this, arguments);

    this.DefaultLayout = {
        label_font_size: 12,
        label_exon_spacing: 4,
        exon_height: 16,
        track_vertical_spacing: 10
    };
    
    // Helper function to sum layout values to derive total height for a single gene track
    this.getTrackHeight = function(){
        return this.layout.label_font_size
            + this.layout.label_exon_spacing
            + this.layout.exon_height
            + this.layout.track_vertical_spacing;
    };

    this.layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);
    
    this.metadata.tracks = 1;
    this.metadata.gene_track_index = { 1: [] }; // track-number-indexed object with arrays of gene indexes in the dataset
    this.metadata.horizontal_padding = 4; // pixels to pad on either side of a gene or label when determining collisions

    // After we've loaded the genes interpret them to assign
    // each to a track so that they do not overlap in the view
    this.assignTracks = function(){

        // Function to get the width in pixels of a label given the text and layout attributes
        this.getLabelWidth = function(gene_name, font_size){
            var temp_text = this.svg.group.append("text")
                .attr("x", 0).attr("y", 0).attr("class", "lz-gene lz-label")
                .style("font-size", font_size)
                .text(gene_name + "→");
            var label_width = temp_text.node().getBBox().width;
            temp_text.node().remove();
            return label_width;
        };

        // Reinitialize metadata
        this.metadata.tracks = 1;
        this.metadata.gene_track_index = { 1: [] };

        this.data.map(function(d, g){

            // Determine display range start and end, based on minimum allowable gene display width, bounded by what we can see
            // (range: values in terms of pixels on the screen)
            this.data[g].display_range = {
                start: this.parent.x_scale(Math.max(d.start, this.parent.parent.state.start)),
                end:   this.parent.x_scale(Math.min(d.end, this.parent.parent.state.end))
            };
            this.data[g].display_range.label_width = this.getLabelWidth(this.data[g].gene_name, this.layout.label_font_size);
            this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            this.data[g].display_range.text_anchor = "middle";
            if (this.data[g].display_range.width < this.data[g].display_range.label_width){
                if (d.start < this.parent.parent.state.start){
                    this.data[g].display_range.end = this.data[g].display_range.start
                        + this.data[g].display_range.label_width
                        + this.metadata.horizontal_padding;
                    this.data[g].display_range.text_anchor = "start";
                } else if (d.end > this.parent.parent.state.end){
                    this.data[g].display_range.start = this.data[g].display_range.end
                        - this.data[g].display_range.label_width
                        - this.metadata.horizontal_padding;
                    this.data[g].display_range.text_anchor = "end";
                } else {
                    var centered_margin = ((this.data[g].display_range.label_width - this.data[g].display_range.width) / 2)
                        + this.metadata.horizontal_padding;
                    if ((this.data[g].display_range.start - centered_margin) < this.parent.x_scale(this.parent.parent.state.start)){
                        this.data[g].display_range.start = this.parent.x_scale(this.parent.parent.state.start);
                        this.data[g].display_range.end = this.data[g].display_range.start + this.data[g].display_range.label_width;
                        this.data[g].display_range.text_anchor = "start";
                    } else if ((this.data[g].display_range.end + centered_margin) > this.parent.x_scale(this.parent.parent.state.end)) {
                        this.data[g].display_range.end = this.parent.x_scale(this.parent.parent.state.end);
                        this.data[g].display_range.start = this.data[g].display_range.end - this.data[g].display_range.label_width;
                        this.data[g].display_range.text_anchor = "end";
                    } else {
                        this.data[g].display_range.start -= centered_margin;
                        this.data[g].display_range.end += centered_margin;
                    }
                }
                this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            }
            // Convert and stash display range values into domain values
            // (domain: values in terms of the data set, e.g. megabases)
            this.data[g].display_domain = {
                start: this.parent.x_scale.invert(this.data[g].display_range.start),
                end:   this.parent.x_scale.invert(this.data[g].display_range.end)
            };
            this.data[g].display_domain.width = this.data[g].display_domain.end - this.data[g].display_domain.start;

            // Using display range/domain data generated above cast each gene to tracks such that none overlap
            this.data[g].track = null;
            var potential_track = 1;
            while (this.data[g].track == null){
                var collision_on_potential_track = false;
                this.metadata.gene_track_index[potential_track].map(function(placed_gene){
                    if (!collision_on_potential_track){
                        var min_start = Math.min(placed_gene.display_range.start, this.display_range.start);
                        var max_end = Math.max(placed_gene.display_range.end, this.display_range.end);
                        if ((max_end - min_start) < (placed_gene.display_range.width + this.display_range.width)){
                            collision_on_potential_track = true;
                        }
                    }
                }.bind(this.data[g]));
                if (!collision_on_potential_track){
                    this.data[g].track = potential_track;
                    this.metadata.gene_track_index[potential_track].push(this.data[g]);
                } else {
                    potential_track++;
                    if (potential_track > this.metadata.tracks){
                        this.metadata.tracks = potential_track;
                        this.metadata.gene_track_index[potential_track] = [];
                    }
                }
            }

            // Stash parent references on all genes, trascripts, and exons
            this.data[g].parent = this;
            this.data[g].transcripts.map(function(d, t){
                this.data[g].transcripts[t].parent = this.data[g];
                this.data[g].transcripts[t].exons.map(function(d, e){
                    this.data[g].transcripts[t].exons[e].parent = this.data[g].transcripts[t];
                }.bind(this));
            }.bind(this));

        }.bind(this));
        return this;
    };

    // Implement the main render function
    this.render = function(){

        this.assignTracks();

        this.svg.group.selectAll("*").remove();

        // Render gene groups
        this.svg.group.selectAll("g.lz-gene").data(this.data).enter()
            .append("g")
            .attr("class", "lz-gene")
            .attr("id", function(d){ return d.gene_name; })
            .each(function(gene){

                // Render gene boundaries
                d3.select(this).selectAll("rect.lz-gene").filter(".lz-boundary")
                    .data([gene]).enter().append("rect")
                    .attr("class", "lz-gene lz-boundary")
                    .attr("id", function(d){ return d.gene_name; })
                    .attr("x", function(d){ return this.parent.x_scale(d.start); }.bind(gene.parent))
                    .attr("y", function(d){
                        return ((d.track-1) * this.parent.getTrackHeight())
                            + this.parent.layout.label_font_size
                            + this.parent.layout.label_exon_spacing
                            + (Math.max(this.parent.layout.exon_height, 3) / 2);
                    }.bind(gene)) // Arbitrary track height; should be dynamic
                    .attr("width", function(d){ return this.parent.x_scale(d.end) - this.parent.x_scale(d.start); }.bind(gene.parent))
                    .attr("height", 1) // This should be scaled dynamically somehow
                    .attr("fill", "#000099")
                    .style({ cursor: "pointer" })
                    .append("svg:title")
                    .text(function(d) { return d.gene_name; });

                // Render gene labels
                d3.select(this).selectAll("text.lz-gene")
                    .data([gene]).enter().append("text")
                    .attr("class", "lz-gene lz-label")
                    .attr("x", function(d){
                        if (d.display_range.text_anchor == "middle"){
                            return d.display_range.start + (d.display_range.width / 2);
                        } else if (d.display_range.text_anchor == "start"){
                            return d.display_range.start;
                        } else if (d.display_range.text_anchor == "end"){
                            return d.display_range.end;
                        }
                    })
                    .attr("y", function(d){
                        return ((d.track-1) * this.parent.getTrackHeight())
                            + this.parent.layout.label_font_size;
                    }.bind(gene))
                    .attr("text-anchor", function(d){ return d.display_range.text_anchor; })
                    .style("font-size", gene.parent.layout.label_font_size)
                    .text(function(d){ return (d.strand == "+") ? d.gene_name + "→" : "←" + d.gene_name; });

                // Render exons (first transcript only, for now)
                d3.select(this).selectAll("g.lz-gene").filter(".lz-exons")
                    .data([gene]).enter().append("g")
                    .attr("class", "lz-gene lz-exons")
                    .each(function(gene){

                        d3.select(this).selectAll("rect.lz-gene").filter(".lz-exon")
                            .data(gene.transcripts[0].exons).enter().append("rect")
                            .attr("class", "lz-gene lz-exon")
                            .attr("id", function(d){ return d.exon_id; })
                            .attr("x", function(d){ return this.parent.x_scale(d.start); }.bind(gene.parent))
                            .attr("y", function(){
                                return ((this.track-1) * this.parent.getTrackHeight())
                                    + this.parent.layout.label_font_size
                                    + this.parent.layout.label_exon_spacing;
                            }.bind(gene))
                            .attr("width", function(d){
                                return this.parent.x_scale(d.end) - this.parent.x_scale(d.start);
                            }.bind(gene.parent))
                            .attr("height", function(){
                                return this.parent.layout.exon_height;
                            }.bind(gene))
                            .attr("fill", "#000099")
                            .style({ cursor: "pointer" });

                    });

            });
        
    };
       
    return this;
});

/* global LocusZoom*/

LocusZoom = LocusZoom || {};
LocusZoom.Stats = (function() {
    //Javascript port of R math library functions

    //CONSTANTS -------

    var DBL_EPSILON = 2.2204460492503130808472633361816e-16;
    var DBL_MIN = 2.2250738585072014e-308;
    var DBL_MAX_EXP = 1020; //this is a guess
    var DBL_MAX = Number.MAX_VALUE;
    var SCALE_FACTOR = 1.157920892373162e+77;
    var EULERS_CONST = 0.5772156649015328606065120900824024;
    var TOL_LOGCF = 1e-14;
    var LGAMMA_C = 0.2273736845824652515226821577978691e-12;

    var DXREL =  1.490116119384765625e-8;

    var M_LN2 = Math.LN2; //0.693147180559945309417232121458;
    var M_PI = Math.PI;
    var M_2PI = 2*M_PI;
    var M_LN_SQRT_2PI = Math.log(Math.sqrt(M_2PI));
    var M_SQRT_32 = 5.656854249492380195206754896838;
    var M_1_SQRT_2PI = 0.398942280401432677939946059934;
    var M_CUTOFF = M_LN2 * DBL_MAX_EXP / DBL_EPSILON;

    var S0 = 0.083333333333333333333;       /* 1/12 */
    var S1 = 0.00277777777777777777778;     /* 1/360 */
    var S2 = 0.00079365079365079365079365;  /* 1/1260 */
    var S3 = 0.000595238095238095238095238; /* 1/1680 */
    var S4 = 0.0008417508417508417508417508;/* 1/1188 */

    var SFERR_HALVES = [
        0.0, /* n=0 - wrong, place holder only */
        0.1534264097200273452913848,  /* 0.5 */
        0.0810614667953272582196702,  /* 1.0 */
        0.0548141210519176538961390,  /* 1.5 */
        0.0413406959554092940938221,  /* 2.0 */
        0.03316287351993628748511048, /* 2.5 */
        0.02767792568499833914878929, /* 3.0 */
        0.02374616365629749597132920, /* 3.5 */
        0.02079067210376509311152277, /* 4.0 */
        0.01848845053267318523077934, /* 4.5 */
        0.01664469118982119216319487, /* 5.0 */
        0.01513497322191737887351255, /* 5.5 */
        0.01387612882307074799874573, /* 6.0 */
        0.01281046524292022692424986, /* 6.5 */
        0.01189670994589177009505572, /* 7.0 */
        0.01110455975820691732662991, /* 7.5 */
        0.010411265261972096497478567, /* 8.0 */
        0.009799416126158803298389475, /* 8.5 */
        0.009255462182712732917728637, /* 9.0 */
        0.008768700134139385462952823, /* 9.5 */
        0.008330563433362871256469318, /* 10.0 */
        0.007934114564314020547248100, /* 10.5 */
        0.007573675487951840794972024, /* 11.0 */
        0.007244554301320383179543912, /* 11.5 */
        0.006942840107209529865664152, /* 12.0 */
        0.006665247032707682442354394, /* 12.5 */
        0.006408994188004207068439631, /* 13.0 */
        0.006171712263039457647532867, /* 13.5 */
        0.005951370112758847735624416, /* 14.0 */
        0.005746216513010115682023589, /* 14.5 */
        0.005554733551962801371038690  /* 15.0 */
    ];

    var LGAMMA_COEFS =  [0.3224670334241132182362075833230126e-0,
        0.6735230105319809513324605383715000e-1,/* = (zeta(3)-1)/3 */
        0.2058080842778454787900092413529198e-1,
        0.7385551028673985266273097291406834e-2,
        0.2890510330741523285752988298486755e-2,
        0.1192753911703260977113935692828109e-2,
        0.5096695247430424223356548135815582e-3,
        0.2231547584535793797614188036013401e-3,
        0.9945751278180853371459589003190170e-4,
        0.4492623673813314170020750240635786e-4,
        0.2050721277567069155316650397830591e-4,
        0.9439488275268395903987425104415055e-5,
        0.4374866789907487804181793223952411e-5,
        0.2039215753801366236781900709670839e-5,
        0.9551412130407419832857179772951265e-6,
        0.4492469198764566043294290331193655e-6,
        0.2120718480555466586923135901077628e-6,
        0.1004322482396809960872083050053344e-6,
        0.4769810169363980565760193417246730e-7,
        0.2271109460894316491031998116062124e-7,
        0.1083865921489695409107491757968159e-7,
        0.5183475041970046655121248647057669e-8,
        0.2483674543802478317185008663991718e-8,
        0.1192140140586091207442548202774640e-8,
        0.5731367241678862013330194857961011e-9,
        0.2759522885124233145178149692816341e-9,
        0.1330476437424448948149715720858008e-9,
        0.6422964563838100022082448087644648e-10,
        0.3104424774732227276239215783404066e-10,
        0.1502138408075414217093301048780668e-10,
        0.7275974480239079662504549924814047e-11,
        0.3527742476575915083615072228655483e-11,
        0.1711991790559617908601084114443031e-11,
        0.8315385841420284819798357793954418e-12,
        0.4042200525289440065536008957032895e-12,
        0.1966475631096616490411045679010286e-12,
        0.9573630387838555763782200936508615e-13,
        0.4664076026428374224576492565974577e-13,
        0.2273736960065972320633279596737272e-13,
        0.1109139947083452201658320007192334e-13/* = (zeta(40+1)-1)/(40+1) */
    ]; 
    var POIS_COEFS_A = [
        -1e99, /* placeholder used for 1-indexing */
        2/3.,
        -4/135.,
        8/2835.,
        16/8505.,
        -8992/12629925.,
        -334144/492567075.,
        698752/1477701225.
    ];
    var POIS_COEFS_B = [
        -1e99, /* placeholder */
        1/12.,
        1/288.,
        -139/51840.,
        -571/2488320.,
        163879/209018880.,
        5246819/75246796800.,
        -534703531/902961561600.
    ];
    var GAMCS = [
        +.8571195590989331421920062399942e-2,
        +.4415381324841006757191315771652e-2,
        +.5685043681599363378632664588789e-1,
        -.4219835396418560501012500186624e-2,
        +.1326808181212460220584006796352e-2,
        -.1893024529798880432523947023886e-3,
        +.3606925327441245256578082217225e-4,
        -.6056761904460864218485548290365e-5,
        +.1055829546302283344731823509093e-5,
        -.1811967365542384048291855891166e-6,
        +.3117724964715322277790254593169e-7,
        -.5354219639019687140874081024347e-8,
        +.9193275519859588946887786825940e-9,
        -.1577941280288339761767423273953e-9,
        +.2707980622934954543266540433089e-10,
        -.4646818653825730144081661058933e-11,
        +.7973350192007419656460767175359e-12,
        -.1368078209830916025799499172309e-12,
        +.2347319486563800657233471771688e-13,
        -.4027432614949066932766570534699e-14,
        +.6910051747372100912138336975257e-15,
        -.1185584500221992907052387126192e-15,
        +.2034148542496373955201026051932e-16,
        -.3490054341717405849274012949108e-17,
        +.5987993856485305567135051066026e-18,
        -.1027378057872228074490069778431e-18,
        +.1762702816060529824942759660748e-19,
        -.3024320653735306260958772112042e-20,
        +.5188914660218397839717833550506e-21,
        -.8902770842456576692449251601066e-22,
        +.1527474068493342602274596891306e-22,
        -.2620731256187362900257328332799e-23,
        +.4496464047830538670331046570666e-24,
        -.7714712731336877911703901525333e-25,
        +.1323635453126044036486572714666e-25,
        -.2270999412942928816702313813333e-26,
        +.3896418998003991449320816639999e-27,
        -.6685198115125953327792127999999e-28,
        +.1146998663140024384347613866666e-28,
        -.1967938586345134677295103999999e-29,
        +.3376448816585338090334890666666e-30,
        -.5793070335782135784625493333333e-31
    ];

    var ALGMCS = [
        +.1666389480451863247205729650822e+0,
        -.1384948176067563840732986059135e-4,
        +.9810825646924729426157171547487e-8,
        -.1809129475572494194263306266719e-10,
        +.6221098041892605227126015543416e-13,
        -.3399615005417721944303330599666e-15,
        +.2683181998482698748957538846666e-17,
        -.2868042435334643284144622399999e-19,
        +.3962837061046434803679306666666e-21,
        -.6831888753985766870111999999999e-23,
        +.1429227355942498147573333333333e-24,
        -.3547598158101070547199999999999e-26,
        +.1025680058010470912000000000000e-27,
        -.3401102254316748799999999999999e-29,
        +.1276642195630062933333333333333e-30
    ];

    var PNORM_A = [
        2.2352520354606839287,
        161.02823106855587881,
        1067.6894854603709582,
        18154.981253343561249,
        0.065682337918207449113
    ];
    var PNORM_B = [
        47.20258190468824187,
        976.09855173777669322,
        10260.932208618978205,
        45507.789335026729956
    ];
    var PNORM_C = [
        0.39894151208813466764,
        8.8831497943883759412,
        93.506656132177855979,
        597.27027639480026226,
        2494.5375852903726711,
        6848.1904505362823326,
        11602.651437647350124,
        9842.7148383839780218,
        1.0765576773720192317e-8
    ];
    var PNORM_D = [
        22.266688044328115691,
        235.38790178262499861,
        1519.377599407554805,
        6485.558298266760755,
        18615.571640885098091,
        34900.952721145977266,
        38912.003286093271411,
        19685.429676859990727
    ];
    var PNORM_P = [
        0.21589853405795699,
        0.1274011611602473639,
        0.022235277870649807,
        0.001421619193227893466,
        2.9112874951168792e-5,
        0.02307344176494017303
    ];
    var PNORM_Q = [
        1.28426009614491121,
        0.468238212480865118,
        0.0659881378689285515,
        0.00378239633202758244,
        7.29751555083966205e-5
    ];

    function R_Log1_Exp(x) {
        return ((x) > -M_LN2 ? Math.log(-Math.expm1(x)) : Math.log1p(-Math.exp(x)));
    }

    function R_D_exp(x, log_p) {
        return log_p ? x : Math.exp(x);
    }

    function R_D_fexp(f, x, give_log) {
        return give_log ? -0.5 * Math.log(f) + x : Math.exp(x)/Math.sqrt(f);
    }

    function sinpi(x) {
        if (isNaN(x)) {
            return x;
        }
        if (!Number.isFinite(x)) {
            return NaN;
        }
        x = x % 2;
        if (x <= -1) {
            x += 2.0;
        } else if (x > 1.0) {
            x -= 2.0;
        }
        if (x == 0.0 || x == 1.0) {
            return 0.0;
        }
        if (x==0.5) { 
            return 1.0;
        }
        if (x==-0.5) {
            return -1.0;
        }
        return Math.sin(M_PI * x);
    }

    function chebyshev_eval(x, a, n) {
        var b0, b1, b2, twox, i;

        if (n < 1 || n > 1000) {
            return NaN;
        }
        if (x < -1.1 || x > 1.1) {
            return NaN;
        }
        twox = x * 2;
        b2 = b1 = 0;
        b0 = 0;
        for (i = 1; i <= n; i++) {
            b2 = b1;
            b1 = b0;
            b0 = twox * b1 - b2 + a[n-i];
        }
        return (b0 - b2) * 0.5;
    }

    function lgammacor(x) {
        var tmp;
        var nalgm = 5;
        var xbig = 94906265.62425156;
        var xmax = 3.745194030963158e306;

        if (x < 10) {
            return NaN;
        } else if (x > xmax) {
            throw ("lgammacor underflow");
        } else if (x < xbig) {
            tmp = 10 / x;
            return chebyshev_eval(tmp * tmp * 2 - 1, ALGMCS, nalgm) / x;
        }
        return 1 / (x * 12);
    }

    function gammafn(x) {
        var i, n, y, sinpiy, value;

        var ngam = 22;
        var xmin = -170.5674972726612;
        var xmax = 171.61447887182298;
        var xsml = 2.2474362225598545e-308;

        if (isNaN(x)) {
            return(x);
        }

        if (x==0 || (x < 0 && x == Math.round(x))) {
            return NaN;
        }

        y = Math.abs(x);
        if (y <= 10) {
            n = parseInt(x, 10);
            if (x < 0) {
                n--;
            }
            y = x - n;
            n--;
            value = chebyshev_eval(y * 2 - 1, GAMCS, ngam) + .9375;
            if (n == 0) {
                return value;
            }
            if (n < 0) {
                if (x < -0.5 && Math.abs(x - parseInt(x-0.5,10)/x) < DXREL) {
                    throw("gammafn precision error");
                }
                if (x < xsml) {
                    return (x > 0 ) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
                }

                n = -n;

                for (i=0; i<n; i++) {
                    value /= (x+i);
                }
                return value;
            } else {
                for(i=1; i<=n; i++) {
                    value *= (y+i);
                }
                return value;
            }
        } else {
            if (x > xmax) {
                return Number.POSITIVE_INFINITY;
            }
            if (x < xmin) {
                return 0;
            }
            if (y <= 50 && y == parseInt(y, 10)) {
                value = 1;
                for (i=2; i<y; i++) {
                    value *= i;
                }
            } else {
                value = Math.exp((y-0.5) * Math.log(y) - y - M_LN_SQRT_2PI+
                    ((2 * y == parseInt(2*y,10)) ? stirlerr(y) : lgammacor(y)));
            }
            if (x > 0) {
                return value;
            }
            if (Math.abs(x-parseInt(x-0.5,10)/x) < DXREL) {
                throw("gammafn precision error");
            }
            sinpiy = sinpi(y);
            if(sinpiy ==0) {
                return Number.POSITIVE_INFINITY;
            }
            return -M_PI / (y * sinpiy * value);
        }
    }

    function lgammafn_sign(x) { //, sgn) {
        //we are going to ignore sgn (it's a reference in the orig)
        var ans, y, sinpiy;
        //sgn = 1;
        var xmax = 2.5327372760800758e+305;
        
        if (isNaN(x)) {
            return x;
        }

        if (x < 0 && Math.floor(-x) % 2 == 0) {
            //sgn = -1;
        }
        if (x <=0 && x == Math.trunc(x)) {
            return Number.POSITIVE_INFINITY;
        }

        y = Math.abs(x);
        if (y < 1e-306) return -Math.log(y);
        if (y <= 10) return Math.log(Math.abs(gammafn(x)));

        if (y > xmax) {
            return Number.POSITIVE_INFINITY;
        }
        if (x > 0) {
            if (x > 1e17) {
                return x * (Math.log(x)-1);
            } else if (x > 4934720.) {
                return M_LN_SQRT_2PI + (x - 0.5) * Math.log(x) - x;
            } else {
                return M_LN_SQRT_2PI + (x - 0.5) * Math.log(x) - x + lgammacor(x);
            }
        }
        sinpiy = Math.abs(sinpi(y));

        if (sinpiy == 0) {
            return NaN;
        }

        if (Math.abs((x-Math.trunc(x - 0.5)) * ans / x) < DXREL) {
            throw("lgamma precision error");
        }
        return ans;
    }

    function lgammafn(x) {
        return lgammafn_sign(x, null);
    }

    function stirlerr(n) {
        var nn;
        if (n <= 15) {
            nn = n + n;
            if (nn == Math.floor(nn)) {
                return SFERR_HALVES[Math.floor(nn)];
            }
            return lgammafn(n + 1.0) - (n + 0.5) * Math.log(n) + n - M_LN_SQRT_2PI;
        }

        nn = n*n;
        if (n > 500) {
            return (S0-S1/nn)/n;
        }
        if (n > 80 ) {
            return (S0-(S1-S2/nn)/nn)/n;
        }
        if (n > 35 ) {
            return (S0-(S1-(S2-S3/nn)/nn)/nn)/n;
        }
        return (S0-(S1-(S2-(S3-S4/nn)/nn)/nn)/nn)/n;
    }

    function bd0(x, np) {
        var ej, s, s1, v, j;

        if (!Number.isFinite(x) || !Number.isFinite(np) || np==0) {
            return NaN;
        }
        if (Math.abs(x-np) < 0.1 * (x+np)) {
            v = (x - np)/(x + np);
            s = (x - np) * v;
            if (Math.abs(s) < DBL_MIN) {
                return s;
            }
            ej = 2 * x * v;
            v = v * v;
            for (j=1; j < 1000; j++) {
                ej *= v;
                s1 = s + ej/((j*2)+1);
                if(s1 == s) {
                    return s1;
                }
                s = s1;
            }
        }
        return x * Math.log(x/np) + np - x;
    }

    function dpois_raw(x, lambda, give_log) {
        if (lambda == 0) {
            return (x==1) ? R_D(1,give_log) : R_D(0, give_log);
        }
        if(!Number.isFinite(lambda)) {
            return R_D(0, give_log);
        }
        if (x < 0) {
            return R_D(0, give_log);
        }
        if (x <= lambda * DBL_MIN) {
            return R_D_exp(-lambda, give_log);
        }
        if (lambda < x * DBL_MIN) {
            return R_D_exp(-lambda + x * Math.log(lambda) - lgammafn(x+1), give_log);
        }
        return R_D_fexp(M_2PI *x,-stirlerr(x)-bd0(x, lambda), give_log);
    }

    function logcf(x, i, d, eps) {
        var c1 = 2 * d;
        var c2 = i + d;
        var c3;
        var c4 = c2 + d;
        var a1 = c2;
        var b1 = i * (c2 - i * x);
        var b2 = d * d * x;
        var a2 = c4 * c2 - b2;

        b2 = c4 * b1 - i * b2;
        while(Math.abs(a2 * b1 - a1 * b2) > Math.abs(eps * b1 * b2)) {
            c3 = c2 * c2 * x;
            c2 += d;
            c4 += d;
            a1 = c4 * a2 - c3 * a1;
            b1 = c4 * b2 - c3 * b1;

            c3 = c1 * c1 * x;
            c1 += d;
            c4 += d;
            a2 = c4 * a1 - c3 * a2;
            b2 = c4 * b1 - c3 * b2;

            if (Math.abs(b2) > SCALE_FACTOR) {
                a1 /= SCALE_FACTOR;
                a2 /= SCALE_FACTOR;
                b1 /= SCALE_FACTOR;
                b2 /= SCALE_FACTOR;
            } else if (Math.abs(b2) < 1/SCALE_FACTOR) {
                a1 *= SCALE_FACTOR;
                a2 *= SCALE_FACTOR;
                b1 *= SCALE_FACTOR;
                b2 *= SCALE_FACTOR;
            }
        }
        return a2 / b2;
    }

    function log1pmx(x) {
        var minLog1Value = -0.79149064;
        if (x > 1 || x < minLog1Value) {
            return Math.log1p(x) - x;
        } else {
            var r = x / (2 + x);
            var y = r * r;
            if (Math.abs(x) < 1e-2) {
                return r * ((((2/9 * y + 2/7) * y + 2/5) * y + 2/3) * y - x);
            } else {
                return r * (2 * y * logcf(y, 3, 2, TOL_LOGCF) - x);
            }
        }
    }

    function lgamma1p (a) {
        if (Math.abs(a) >= 0.5) {
            return lgammafn(a + 1);
        }
        var lgam, i;
        lgam = LGAMMA_C * logcf(-a/2, LGAMMA_COEFS.length+2, 1, TOL_LOGCF);
        for(i=LGAMMA_COEFS.length-1; i >= 0; i--) {
            lgam = LGAMMA_COEFS[i] - a * lgam;
        }

        return (a * lgam - EULERS_CONST) * a - log1pmx(a);
    }

    function logspace_add(logx, logy) {
        return ((logx>logy) ? logx : logy) + Math.log1p(Math.exp(-Math.abs(logx-logy)));
    }

    function logspace_sub(logx, logy) {
        return logx + R_Log1_Exp(logy - logx);
    }

    function logspace_sum(logx, n) {
        if (n==0) {return Number.NEGATIVE_INFINITY;}
        if (n==1) {return logx[0];}
        if (n==2) {return logspace_add(logx[0] + logx[1]);}
        var i;
        var Mx = logx[0];
        for(i=1; i<n; i++) {
            if( Mx < logx[i] ) {
                Mx = logx[i];
            }
        }
        var s = 0;
        for(i=0; i<n; i++) {
            s += Math.exp(logx[i] - Mx);
        }
        return Mx + Math.log(s);
    }

    function dpois_wrap(x_plus_1, lambda, give_log) {
        if (!isFinite(lambda)) {
            return R_D(0, give_log);
        }
        if (x_plus_1 > 1) {
            return dpois_raw(x_plus_1-1, lambda, give_log);
        }
        if (lambda > Math.abs(x_plus_1 - 1)*M_CUTOFF) {
            return R_D_exp(-lambda - lgammafn(x_plus_1), give_log);
        } else {
            var d = dpois_raw(x_plus_1, lambda, give_log);
            return (give_log) ? d+Math.log(x_plus_1/lambda): d*(x_plus_1/lambda);
        }
    }

    function R_D(i, log_p) {
        if ( i===0 ) {
            return (log_p) ? Number.NEGATIVE_INFINITY : 0;
        } else {
            return (log_p) ? 0 : 1;
        }
    }

    function R_DT(i, lower_tail, log_p) {
        if ( i===0 ) {
            return (lower_tail) ? R_D(0, log_p) : R_D(1, log_p);
        } else {
            return (lower_tail) ? R_D(1, log_p) : R_D(0, log_p);
        }
    }

    function pgamma_smallx(x, alph, lower_tail, log_p) {
        var sum=0, c=alph, n=0, term;
        do {
            n++;
            c *= -x/n;
            term = c / (alph + n);
            sum += term;
        } while (Math.abs(term) > DBL_EPSILON * Math.abs(sum));

        if (lower_tail) {
            var f1 = (log_p) ? Math.log1p(sum) : 1 + sum;
            var f2;
            if (alph > 1) {
                f2 = dpois_raw(alph, x, log_p);
                f2 = (log_p) ? f2 + x : f2 * Math.exp(x);
            } else if (log_p) {
                f2 = alph * Math.log(x) - lgamma1p(alph);
            } else {
                f2 = Math.pow(x, alph) / Math.exp(lgamma1p(alph));
            }
            return (log_p) ? f1 + f2 : f1 * f2;
        } else {
            var lf2 = alph * Math.log(x) - lgamma1p(alph);
            if (log_p) {
                return R_Log1_Exp(Math.log1p(sum) + lf2);
            } else {
                var f1m1 = sum;
                var f2m1 = Math.expm1(lf2);
                return -(f1m1 + f2m1 + f1m1 * f2m1);
            }
        }

    }

    function pd_upper_series(x, y, log_p) {
        var term = x/y;
        var sum = term;
        do {
            y++;
            term *= x/y;
            sum += term;
        } while (term > sum * DBL_EPSILON);
        return (log_p) ? Math.log(sum) : sum;
    }

    function pd_lower_cf(y, d){
        var f=0, of, f0;
        var i, c2, c3, c4, a1, b1, a2, b2;

        if (y==0) {
            return 0;
        }
        f0 = y/d;
        if(Math.abs(y-1) < Math.abs(d) * DBL_EPSILON) {
            return f0;
        }

        if(f0 > 1.0) {
            f0 = 1.0;
        }
        c2 = y;
        c4 = d;

        a1 = 0; b1 = 1;
        a2 = y; b2 = d;

        while (b2 > SCALE_FACTOR) {
            a1 /= SCALE_FACTOR;
            b1 /= SCALE_FACTOR;
            a2 /= SCALE_FACTOR;
            b2 /= SCALE_FACTOR;
        }

        i=0;
        of = -1;
        while ( i < 200000 ) {
            i++;    c2--;   c3 = i *c2; c4 += 2;
            a1 = c4 * a2 + c3 * a1;
            b1 = c4 * b2 + c3 * b1;

            i++;    c2--;   c3 = i *c2; c4 += 2;
            a2 = c4 * a1 + c3 * a2;
            b2 = c4 * b1 + c3 * b2;

            if (b2 > SCALE_FACTOR) {
                a1 /= SCALE_FACTOR;
                b1 /= SCALE_FACTOR;
                a2 /= SCALE_FACTOR;
                b2 /= SCALE_FACTOR;
            }

            if (b2 != 0) {
                f = a2 / b2;
                if (Math.abs(f - of) <= DBL_EPSILON * ((Math.abs(f) > f0) ? Math.abs(f) : f0)) {
                    return f;
                }
                of = f;
            }
        }
        //WARNING - NON CONVERGENCE
        return f;
    }

    function pd_lower_series(lambda, y) {
        var term=1, sum=0;
        while(y <= 1 && term > sum * DBL_EPSILON) {
            term *= y / lambda;
            sum += term;
            y--;
        }
        if (y != Math.floor(y)) {
            var f = pd_lower_cf (y, lambda+1-y);
            sum += term * f;
        }
        return sum;
    }

    function dpnorm(x, lower_tail, lp) {
        if (x < 0) {
            x = -x;
            lower_tail = !lower_tail;
        }

        if (x > 10 && !lower_tail) {
            var term = 1/x,
                sum = term,
                x2 = x * x,
                i=1;
            do {
                term *= -i / x2;
                sum += term;
                i += 2;
            } while (Math.abs(term) > DBL_EPSILON * sum);

            return 1/sum;
        } else {
            var d = dnorm(x, 0.0, 1.0, false);
            return d/Math.exp(lp);
        }
    }

    function ppois_asymp(x, lambda, lower_tail, log_p) {
        var coefs_a = POIS_COEFS_A, coefs_b = POIS_COEFS_B;
        var elfb, elfb_term;
        var res12, res1_term, res1_ig, res2_term, res2_ig;
        var dfm, pt_, s2pt, f, np;
        var i;

        dfm = lambda - x;
        pt_ = - log1pmx(dfm / x);
        s2pt = Math.sqrt(2 * x * pt_);
        if (dfm < 0) {
            s2pt = -s2pt;
        }

        res12 = 0;
        res1_ig = res1_term = Math.sqrt(x);
        res2_ig = res2_term = s2pt;
        for(i=1; i<8; i++) {
            res12 += res1_ig * coefs_a[i];
            res12 += res2_ig * coefs_b[i];
            res1_term *= pt_ / i;
            res2_term *= 2 * pt_ / (2 * i +1);
            res1_ig = res1_ig / x + res1_term;
            res2_ig = res2_ig / x + res2_term;
        }

        elfb = x;
        elfb_term = 1;
        for(i=1; i<8; i++) {
            elfb += elfb_term * coefs_b[i];
            elfb_term /= x;
        }

        if (!lower_tail) {
            elfb = -elfb;
        }
        f = res12 / elfb;
        np = pnorm(s2pt, 0.0, 1.0, !lower_tail, log_p);
        if (log_p) {
            var n_d_over_p = dpnorm(s2pt, !lower_tail, np);
            return np + Math.log1p(f * n_d_over_p);
        } else {
            var nd = dnorm(s2pt, 0.0, 1.0, log_p);
            return np + f * nd;
        }
    }

    function pgamma_raw(x, alph, lower_tail, log_p) {
        var res, d, sum;
        if (x<1) {
            res = pgamma_smallx(x, alph, lower_tail, log_p);
        } else if (x <= alph - 1 && x < 0.8 * (alph + 50)) {
            // incl large alph compared to x
            sum = pd_upper_series (x, alph, log_p);
            d = dpois_wrap(alph, x, log_p);
            if (!lower_tail) {
                res = (log_p) ? R_Log1_Exp(d + sum) : 1 - d * sum;
            } else {
                res = (log_p) ? sum + d : sum * d;
            }
        } else if ( alph - 1 < x && alph < 0.8 * (x+50)) {
            // incl large x compared to alph
            d = dpois_wrap(alph, x, log_p);
            if ( alph < 1 ) {
                if ( x * DBL_EPSILON > 1 - alph ) {
                    sum = R_D(0, log_p);
                } else {
                    var f = pd_lower_cf(alph, x - (alph - 1)) * x / alph;
                    sum = (log_p) ? Math.log(f) : f;
                }
            } else {
                sum = pd_lower_series(x, alph - 1);
                sum = (log_p) ? Math.log1p(sum) : 1 + sum;
            }
            if (!lower_tail) {
                res = (log_p) ? sum + d : sum * d;
            } else {
                res = (log_p) ? R_Log1_Exp(d + sum) : 1- d*sum;
            }
        } else {
            //x >=1 and x near alph
            res = ppois_asymp(alph-1, x, !lower_tail, log_p);
        }

        if (!log_p && res < DBL_MIN / DBL_EPSILON) {
            return Math.exp(pgamma_raw(x, alph, lower_tail, true));
        } else {
            return res;
        }
    }

    function dpois(x, lambda, give_log) {
        if (lambda < 0) {
            return NaN;
        }
        if (x % 1 !=0) {
            return NaN;
        }
        if (x < 0 || !Number.isFinite(x)) {
            return R_D(0,give_log);
        }
        return dpois_raw(x, lambda, give_log);

    }

    function pgamma(x, alph, scale, lower_tail, log_p) {
        if ( isNaN(x) || alph < 0 || scale < 0 ) {
            return NaN;
        }
        x /= scale;
        if (alph == 0) {
            return (x<=0) ? R_DT(0, lower_tail, log_p): R_DT(1, lower_tail, log_p);
        }
        return pgamma_raw(x, alph, lower_tail, log_p);
    }

    function pchisq(x, df, lower_tail, log_p) {
        return pgamma(x, df/2.0, 2.0, lower_tail, log_p);
    }

    function pnorm_both(x, i_tail, log_p) {
        var cum, ccum;
        var xden, xnum, temp, del, eps, xsq, y;
        var i, lower, upper;
        var a = PNORM_A, b=PNORM_B, c=PNORM_C,
            d = PNORM_D, p=PNORM_P, q=PNORM_Q;

        if (isNaN(x)) {
            return {cum: NaN, ccum: NaN};
        }

        eps = DBL_EPSILON * 0.5;
        lower = i_tail != 1;
        upper = i_tail != 0;

        y = Math.abs(x);
        if (y <= 0.67448975) {
            if (y > eps) {
                xsq = x * x;
                xnum = a[4] * xsq;
                xden = xsq;
                for(i=0; i<3; ++i) {
                    xnum = (xnum + a[i]) * xsq;
                    xden = (xden + b[i]) * xsq;
                }
            }  else {
                xnum = xden = 0.0;
            }
            temp = x * ( xnum + a[3]) / (xden + b[3]);
            if (lower) {
                cum = 0.5 + temp;
            }
            if (upper) {
                ccum = 0.5 - temp;
            }
            if (log_p) {
                if (lower) {cum = Math.log(cum);}
                if (upper) {ccum = Math.log(ccum);}
            }
        } else if (y <= M_SQRT_32) {
            xnum = c[8] * y;
            xden = y;
            for (i=0; i<7; ++i) {
                xnum = (xnum + c[i]) * y;
                xden = (xden + d[i]) * y;
            }
            temp = (xnum + c[7]) / (xden + d[7]);
            //do del (x)
            xsq = Math.trunc(y * 16)/16;
            del = (y - xsq) * (y + xsq);
            if (log_p) {
                cum = (-xsq * xsq * 0.5) + (-del * 0.5) + Math.log(temp);
                if ((lower && x > 0.0) || (upper && x <= 0.0)) {
                    ccum = Math.log1p(-Math.exp(-xsq * xsq * 0.5) *
                        Math.exp(-del * 0.5) * temp);
                } 
            } else {
                cum = Math.exp(-xsq * xsq * 0.5) * 
                    Math.exp(-del * 0.5) * temp;
                ccum = 1.0 - cum;
            }
            //swap tail
            if (x > 0.) {
                temp = cum;
                if (lower) {cum=ccum;}
                ccum = temp;
            }
        } else if ((log_p && y < 1e170) || 
            (lower && -37.5193 < x && x < 8.2924) ||
            (upper && -8.2924 && x < 37.5193)) {

            xsq = 1.0 / (x * x);
            xnum = p[5] * xsq;
            xden = xsq;
            for(i=0; i<4; ++i) {
                xnum = (xnum + p[i]) * xsq;
                xden = (xden + q[i]) * xsq;
            }
            temp = xsq * (xnum + p[4]) / (xden + q[4]);
            temp = (M_1_SQRT_2PI -temp) / y;
            //do del(x)
            xsq = Math.trunc(x * 16)/16;
            del = (x - xsq) * (x + xsq);
            if (log_p) {
                cum = (-xsq * xsq * 0.5) + (-del * 0.5) + Math.log(temp);
                if ((lower && x > 0.0) || (upper && x <= 0.0)) {
                    ccum = Math.log1p(-Math.exp(-xsq * xsq * 0.5) *
                        Math.exp(-del * 0.5) * temp);
                } 
            } else {
                cum = Math.exp(-xsq * xsq * 0.5) * 
                    Math.exp(-del * 0.5) * temp;
                ccum = 1.0 - cum;
            }
            //swap tail
            if (x > 0.) {
                temp = cum;
                if (lower) {cum=ccum;}
                ccum = temp;
            }
        } else {
            if (x>0) {
                cum = R_D(1,log_p);
                ccum = R_D(0, log_p);
            } else {
                cum = R_D(0,log_p);
                ccum = R_D(1,log_p);
            }

        }

        //TODO left off here
        return {cum : cum, ccum: ccum};
    }

    function pnorm(x, mu, sigma, lower_tail, log_p) {
        var p;
        if (isNaN(x) || isNaN(mu) || isNaN(sigma)) {
            return NaN;
        }
        if (!Number.isFinite(x) && mu == x) {
            return NaN;
        }
        if (sigma <=0) {
            if (sigma <0) { return NaN; }
            return (x < mu) ? R_DT(0,lower_tail,log_p) : R_DT(1,lower_tail,log_p);
        }
        p = (x-mu) / sigma;
        if(!Number.isFinite(p)) {
            return (x < mu) ? R_DT(0,lower_tail,log_p) : R_DT(1,lower_tail,log_p);
        }
        x = p;

        var r = pnorm_both(x, (lower_tail)? 0:1 , log_p);
        return (lower_tail) ? r.cum : r.ccum;
    }

    function dnorm(x, mu, sigma, give_log) {
        if (isNaN(x) || isNaN(mu) || isNaN(sigma)) {
            return x + mu + sigma;
        }
        if (!Number.isFinite(sigma)) {return R_D(0, give_log);}
        if (!Number.isFinite(x) && mu == x) {return NaN;}
        if (sigma <=0 ) {
            if (sigma <0) {return NaN;}
            return (x==mu) ? Number.POSITIVE_INFINITY : R_D(0, give_log);
        }
        x = (x-mu) / sigma;
        if (!Number.isFinite(x)) {
            return R_D(0, give_log);
        }
        x = Math.abs(x);
        if (x >= 2 * Math.sqrt(DBL_MAX)) {
            return R_D(0, give_log);
        }
        if (give_log) {
            return -(M_LN_SQRT_2PI + 0.5 * x * x + Math.log(sigma));
        }
        //fast version
        return M_1_SQRT_2PI * Math.exp(-0.5 * x * x) / sigma;
    }

    function parseNumeric(x, default_value) {
        if (typeof(x)==="undefined") {
            return default_value;
        }
        return +x;
    }
    function parseBoolean(x, default_value) {
        if (typeof(x)==="undefined") {
            return default_value;
        }
        return !!((x || "false")!="false");
    }

    return {
        dnorm: function(x, mu, sigma, give_log) {
            x = +x;
            mu = parseNumeric(mu, 0);
            sigma = parseNumeric(sigma, 1);
            give_log = parseBoolean(give_log, false);
            return dnorm(x, mu, sigma, give_log);
        },
        pnorm: function (x, mu, sigma, lower_tail, give_log) {
            x = parseNumeric(x); 
            mu = parseNumeric(mu, 0);
            sigma = parseNumeric(sigma, 1);
            lower_tail =  parseBoolean(lower_tail, true);
            give_log =  parseBoolean(give_log, false)
            return pnorm(x, mu, sigma, lower_tail, give_log);
        },
        pchisq: function (x, df, lower_tail, give_log) {
            x = parseNumeric(x); 
            df = parseNumeric(df);
            lower_tail =  parseBoolean(lower_tail, true);
            give_log =  parseBoolean(give_log, false);
            return pchisq(x, df, lower_tail, give_log);
        },
        pgamma: function(q, shape, scale, lower_tail, give_log) {
            q = parseNumeric(q);
            shape = parseNumeric(shape);
            scale = parseNumeric(scale, 1);
            lower_tail =  parseBoolean(lower_tail, true);
            give_log = parseBoolean(give_log, false);
            return pgamma(q, shape, scale, lower_tail, give_log);
        },
        dpois: function(x, lambda, log) {
            x = parseNumeric(x);
            lambda = parseNumeric(lambda);
            log = parseBoolean(log, false);
            return dpois(x, lambda, log);
        }
    };

})();


        if (typeof define === "function" && define.amd){
            this.LocusZoom = LocusZoom, define(LocusZoom);
        } else if (typeof module === "object" && module.exports) {
            module.exports = LocusZoom;
        } else {
            this.LocusZoom = LocusZoom;
        }

    } catch (plugin_loading_error){
        console.log("LocusZoom Plugin error: " + plugin_loading_error);
    }

}();