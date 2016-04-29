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
    version: "0.3.7"
};
    
// Populate a single element with a LocusZoom instance.
// selector can be a string for a DOM Query or a d3 selector.
LocusZoom.populate = function(selector, datasource, layout, state) {
    if (typeof selector == "undefined"){
        throw ("LocusZoom.populate selector not defined");
    }
    // Empty the selector of any existing content
    d3.select(selector).html("");
    // If state was passed as a fourth argument then merge it with layout (for backward compatibility)
    if (typeof state != "undefined"){
        console.warn("Warning: state passed to LocusZoom.populate as fourth argument. This behavior is deprecated. Please include state as a parameter of layout");
        var stateful_layout = { state: state };
        var base_layout = layout || {};
        layout = LocusZoom.mergeLayouts(stateful_layout, base_layout);
    }
    var instance;
    d3.select(selector).call(function(){
        // Require each containing element have an ID. If one isn't present, create one.
        if (typeof this.node().id == "undefined"){
            var iterator = 0;
            while (!d3.select("#lz-" + iterator).empty()){ iterator++; }
            this.attr("id", "#lz-" + iterator);
        }
        // Create the instance
        instance = new LocusZoom.Instance(this.node().id, datasource, layout);
        // Detect data-region and fill in state values if present
        if (typeof this.node().dataset !== "undefined" && typeof this.node().dataset.region !== "undefined"){
            var parsed_state = LocusZoom.parsePositionQuery(this.node().dataset.region);
            Object.keys(parsed_state).forEach(function(key){
                instance.state[key] = parsed_state[key];
            });
        }
        // Add an SVG to the div and set its dimensions
        instance.svg = d3.select("div#" + instance.id)
            .append("svg")
            .attr("version", "1.1")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("id", instance.id + "_svg").attr("class", "lz-locuszoom");
        instance.setDimensions();
        // Initialize the instance
        instance.initialize();
        // If the instance has defined data sources then trigger its first mapping based on state values
        if (typeof datasource == "object" && Object.keys(datasource).length){
            instance.refresh();
        }
    });
    return instance;
};

// Populate arbitrarily many elements each with a LocusZoom instance
// using a common datasource, layout, and/or state
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
            return {
                chr:match[1],
                start: center - offset,
                end: center + offset
            };
        } else {
            return {
                chr: match[1],
                start: LocusZoom.positionStringToInt(match[2]),
                end: LocusZoom.positionStringToInt(match[4])
            };
        }
    }
    match = chrpos.exec(x);
    if (match) {
        return {
            chr:match[1],
            position: LocusZoom.positionStringToInt(match[2])
        };
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

// Replace placeholders in an html string with field values defined in a data object
// Only works on scalar values! Will ignore non-scalars.
LocusZoom.parseFields = function (data, html) {
    if (typeof data != "object"){
        throw ("LocusZoom.parseFields invalid arguments: data is not an object");
    }
    if (typeof html != "string"){
        throw ("LocusZoom.parseFields invalid arguments: html is not a string");
    }
    var re;
    for (var field in data) {
        if (!data.hasOwnProperty(field)){ continue; }
        if (typeof data[field] != "string" && typeof data[field] != "number" && typeof data[field] != "boolean"){ continue; }
        re = new RegExp("\\{\\{" + field.replace("|","\\|").replace(":","\\:") + "\\}\\}","g");
        html = html.replace(re, data[field]);
    }
    return html;
};

// Standard Layout
LocusZoom.StandardLayout = {
    state: {},
    width: 800,
    height: 450,
    min_width: 400,
    min_height: 225,
    resizable: "responsive",
    aspect_ratio: (16/9),
    panels: {
        positions: {
            width: 800,
            height: 225,
            origin: { x: 0, y: 0 },
            min_width:  400,
            min_height: 112.5,
            proportional_width: 1,
            proportional_height: 0.5,
            proportional_origin: { x: 0, y: 0 },
            margin: { top: 20, right: 20, bottom: 35, left: 50 },
            inner_border: "rgba(210, 210, 210, 0.85)",
            axes: {
                x: {
                    label_function: "chromosome",
                    label_offset: 32,
                    tick_format: "region"
                },
                y1: {
                    label: "-log10 p-value",
                    label_offset: 28
                }
            },
            data_layers: {
                positions: {
                    type: "scatter",
                    point_shape: "circle",
                    point_size: 40,
                    fields: ["id", "position", "pvalue|scinotation", "pvalue|neglog10", "refAllele", "ld:state"],
                    x_axis: {
                        field: "position"
                    },
                    y_axis: {
                        axis: 1,
                        field: "pvalue|neglog10",
                        floor: 0,
                        upper_buffer: 0.05,
                        min_extent: [ 0, 10 ]
                    },
                    color: {
                        field: "ld:state",
                        scale_function: "numerical_bin",
                        parameters: {
                            breaks: [0, 0.2, 0.4, 0.6, 0.8],
                            values: ["#357ebd","#46b8da","#5cb85c","#eea236","#d43f3a"],
                            null_value: "#B8B8B8"
                        }
                    },
                    tooltip: {
                        divs: [
                            { html: "<strong>{{id}}</strong>" },
                            { html: "P Value: <strong>{{pvalue|scinotation}}</strong>" },
                            { html: "Ref. Allele: <strong>{{refAllele}}</strong>" }
                        ]
                    },
                    label: {
                        text: "{{id}}",
                        spacing: 4,
                        lines: true,
                        filters: [
                            {
                                field: "pvalue|neglog10",
                                operator: ">=",
                                value: 50
                            }
                        ],
                        style: {
                            "font_size": "10px",
                            "fill": "#666666"
                        }
                    }
                }
            }
        },
        genes: {
            width: 800,
            height: 225,
            origin: { x: 0, y: 350 },
            min_width: 400,
            min_height: 112.5,
            proportional_width: 1,
            proportional_height: 0.5,
            proportional_origin: { x: 0, y: 0.5 },
            margin: { top: 20, right: 20, bottom: 20, left: 50 },
            axes: {},
            data_layers: {
                genes: {
                    type: "genes",
                    fields: ["gene:gene"],
                    tooltip: {
                        divs: [
                            { html: "<strong><i>{{gene_name}}</i></strong>" },
                            { html: "Gene ID: <strong>{{gene_id}}</strong>" },
                            { html: "Transcript ID: <strong>{{transcript_id}}</strong>" },
                            { html: "<a href=\"http://exac.broadinstitute.org/gene/{{gene_id}}\" target=\"_new\">ExAC Page</a>" }
                        ]
                    }
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
    var source = state.source || chain.header.source || this.params.source || 2;
    return this.url + "?filter=source in " + source +
        " and chrom eq '" + state.chr + "'" + 
        " and start le " + state.end +
        " and end ge " + state.start;
};
LocusZoom.Data.GeneSource.prototype.parseResponse = function(resp, chain, fields, outnames) {
    return {header: chain.header, body: resp.data};
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
    LocusZoom.Data.GeneSource
];

/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Instance Class

  An Instance is an independent LocusZoom object. Many such LocusZoom objects can exist simultaneously
  on a single page, each having its own layout.

*/

LocusZoom.Instance = function(id, datasource, layout) {

    this.initialized = false;

    this.id = id;
    
    this.svg = null;

    // The panels property stores child panel instances
    this.panels = {};
    this.remap_promises = [];

    // The layout is a serializable object used to describe the composition of the instance
    // If no layout was passed, use the Standard Layout
    // Otherwise merge whatever was passed with the Default Layout
    if (typeof layout == "undefined"){
        this.layout = LocusZoom.mergeLayouts(LocusZoom.StandardLayout, LocusZoom.Instance.DefaultLayout);
    } else {
        this.layout = LocusZoom.mergeLayouts(layout, LocusZoom.Instance.DefaultLayout);
    }

    // Create a shortcut to the state in the layout on the instance
    this.state = this.layout.state;
    
    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);

    // Window.onresize listener (responsive layouts only)
    this.window_onresize = null;

    // onUpdate - user defineable function that can be triggered whenever the layout or state are updated
    this.onUpdate = null;
    this.triggerOnUpdate = function(){
        if (typeof this.onUpdate == "function"){
            this.onUpdate();
        }
    };

    // Initialize the layout
    this.initializeLayout();

    return this;
  
};

// Default Layout
LocusZoom.Instance.DefaultLayout = {
    state: {},
    width: 1,
    height: 1,
    min_width: 1,
    min_height: 1,
    resizable: false,
    aspect_ratio: 1,
    panels: {}
};

LocusZoom.Instance.prototype.initializeLayout = function(){

    // Sanity check layout values
    // TODO: Find a way to generally abstract this, maybe into an object that models allowed layout values?
    if (isNaN(this.layout.width) || this.layout.width <= 0){
        throw ("Instance layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.height) || this.layout.height <= 0){
        throw ("Instance layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.aspect_ratio) || this.layout.aspect_ratio <= 0){
        throw ("Instance layout parameter `aspect_ratio` must be a positive number");
    }

    // If this is a responsive layout then set a namespaced/unique onresize event listener on the window
    if (this.layout.resizable == "responsive"){
        this.window_onresize = d3.select(window).on("resize.lz-"+this.id, function(){
            var clientRect = this.svg.node().parentNode.getBoundingClientRect();
            this.setDimensions(clientRect.width, clientRect.height);
        }.bind(this));
        // Forcing one additional setDimensions() call after the page is loaded clears up
        // any disagreements between the initial layout and the loaded responsive container's size
        d3.select(window).on("load.lz-"+this.id, function(){ this.setDimensions(); }.bind(this));
    }

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
    // Set discrete layout dimensions based on arguments
    if (!isNaN(width) && width >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
    }
    // Override discrete values if resizing responsively
    if (this.layout.resizable == "responsive"){
        if (this.svg){
            this.layout.width = Math.max(this.svg.node().parentNode.getBoundingClientRect().width, this.layout.min_width);
        }
        this.layout.height = this.layout.width / this.layout.aspect_ratio;
        if (this.layout.height < this.layout.min_height){
            this.layout.height = this.layout.min_height;
            this.layout.width  = this.layout.height * this.layout.aspect_ratio;
        }
    }
    // Keep aspect ratio in agreement with dimensions
    this.layout.aspect_ratio = this.layout.width / this.layout.height;
    // Apply layout width and height as discrete values or viewbox values
    if (this.svg != null){
        if (this.layout.resizable == "responsive"){
            this.svg
                .attr("viewBox", "0 0 " + this.layout.width + " " + this.layout.height)
                .attr("preserveAspectRatio", "xMinYMin meet");
        } else {
            this.svg.attr("width", this.layout.width).attr("height", this.layout.height);
        }
    }
    // Reposition all panels
    this.positionPanels();
    // If the instance has been initialized then trigger some necessary render functions
    if (this.initialized){
        this.ui.render();
    }
    this.triggerOnUpdate();
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

    // Create the Panel and set its parent
    var panel = new LocusZoom.Panel(id, layout, this);
    
    // Store the Panel on the Instance
    this.panels[panel.id] = panel;

    // Update minimum instance dimensions based on the minimum dimensions of all panels
    // TODO: This logic assumes panels are always stacked vertically. More sophisticated
    //       logic to handle arbitrary panel geometries needs to be supported.
    var panel_min_widths = [];
    var panel_min_heights = [];
    for (id in this.panels){
        panel_min_widths.push(this.panels[id].layout.min_width);
        panel_min_heights.push(this.panels[id].layout.min_height);
    }
    this.layout.min_width = Math.max.apply(null, panel_min_widths);
    this.layout.min_height = panel_min_heights.reduce(function(a,b){ return a+b; });

    // Call setDimensions() in case updated minimums need to be applied, which also calls positionPanels()
    this.setDimensions();

    return this.panels[panel.id];
};

// Automatically position panels based on panel positioning rules and values
// If the plot is resizable then recalculate dimensions and position from proportional values
LocusZoom.Instance.prototype.positionPanels = function(){
    var id;
    for (id in this.panels){
        if (this.layout.resizable){
            this.panels[id].layout.width = this.panels[id].layout.proportional_width * this.layout.width;
            this.panels[id].layout.height = this.panels[id].layout.proportional_height * this.layout.height;
            this.panels[id].layout.origin.x = this.panels[id].layout.proportional_origin.x * this.layout.width;
            this.panels[id].layout.origin.y = this.panels[id].layout.proportional_origin.y * this.layout.height;
        }
        this.panels[id].setOrigin();
        this.panels[id].setDimensions();
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
            if (this.parent.layout.resizable == "manual"){
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
            }
            // Render all UI elements
            this.render();
        },
        render: function(){
            if (this.parent.layout.resizable == "manual"){
                this.resize_handle
                    .attr("transform", "translate(" + (this.parent.layout.width - 17) + ", " + (this.parent.layout.height - 17) + ")");
            }
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
                try {
                    this.svg.select("text").selectAll("tspan").remove();
                    message.split("\n").forEach(function(line){
                        this.svg.select("text").append("tspan")
                            .attr("x", "1em").attr("dy", "1.5em").text(line);
                    }.bind(this));
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "2.5em")
                        .attr("class", "dismiss").text("Dismiss")
                        .on("click", function(){
                            this.raise();
                        }.bind(this));
                } catch (e){
                    console.error("LocusZoom tried to render an error message but it's not a string:", message);
                }
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect").attr("width", "100%").attr("height", "100%");
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
// DEPRECATED: This method is specific to only accepting chromosome, start, and end.
// LocusZoom.Instance.prototype.applyState() takes a single object, covering far more use cases.
LocusZoom.Instance.prototype.mapTo = function(chr, start, end){

    console.warn("Warning: use of LocusZoom.Instance.mapTo() is deprecated. Use LocusZoom.Instance.applyState() instead.");

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
        .done(function(){
            this.triggerOnUpdate();
        }.bind(this));

    return this;
    
};

// Refresh an instance's data from sources without changing position
LocusZoom.Instance.prototype.refresh = function(){
    this.applyState({});
};

// Update state values and trigger a pull for fresh data on all data sources for all data layers
LocusZoom.Instance.prototype.applyState = function(new_state){

    if (typeof new_state != "object"){
        throw("LocusZoom.applyState only accepts an object; " + (typeof new_state) + " given");
    }

    for (var property in new_state) {
        this.state[property] = new_state[property];
    }

    this.remap_promises = [];
    for (var id in this.panels){
        this.remap_promises.push(this.panels[id].reMap());
    }

    Q.all(this.remap_promises)
        .catch(function(error){
            console.log(error);
            this.curtain.drop(error);
        }.bind(this))
        .done(function(){
            this.triggerOnUpdate();
        }.bind(this));

    return this;
    
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

LocusZoom.Panel = function(id, layout, parent) { 

    this.initialized = false;
    
    this.id     = id;
    this.parent = parent || null;
    this.svg    = {};

    // The layout is a serializable object used to describe the composition of the Panel
    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.Panel.DefaultLayout);

    // Define state parameters specific to this panel
    if (this.parent){
        this.state = this.parent.state;
        this.state_id = this.id;
        this.state[this.state_id] = this.state[this.state_id] || {};
    } else {
        this.state = null;
        this.state_id = null;
    }
    
    this.data_layers = {};
    this.data_layer_ids_by_z_index = [];
    this.data_promises = [];

    this.xExtent  = null;
    this.y1Extent = null;
    this.y2Extent = null;

    this.x_ticks  = [];
    this.y1_ticks = [];
    this.y2_ticks = [];

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };

    this.triggerOnUpdate = function(){
        this.parent.triggerOnUpdate();
    };

    // Initialize the layout
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.DefaultLayout = {
    width:  0,
    height: 0,
    origin: { x: 0, y: 0 },
    min_width: 0,
    min_height: 0,
    proportional_width: 1,
    proportional_height: 1,
    proportional_origin: { x: 0, y: 0 },
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
        if (!Object.keys(this.layout.axes[axis]).length || this.layout.axes[axis].render === false){
            // The default layout sets the axis to an empty object, so set its render boolean here
            this.layout.axes[axis].render = false;
        } else {
            this.layout.axes[axis].render = true;
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
                try {
                    this.svg.select("text").selectAll("tspan").remove();
                    message.split("\n").forEach(function(line){
                        this.svg.select("text").append("tspan")
                            .attr("x", "1em").attr("dy", "1.5em").text(line);
                    }.bind(this));
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "2.5em")
                        .attr("class", "dismiss").text("Dismiss")
                        .on("click", function(){
                            this.raise();
                        }.bind(this));
                } catch (e){
                    console.error("LocusZoom tried to render an error message but it's not a string:", message);
                }
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect").attr("width", "100%").attr("height", "100%");
    this.curtain.svg.append("text")
        .attr("id", this.getBaseId() + ".curtain_text")
        .attr("x", "1em").attr("y", "0em");

    // If the layout defines an inner border render it before rendering axes
    if (this.layout.inner_border){
        this.inner_border = this.svg.group.append("rect");
    }

    // Initialize Axes
    this.svg.x_axis = this.svg.group.append("g")
        .attr("id", this.getBaseId() + ".x_axis").attr("class", "lz-x lz-axis");
    if (this.layout.axes.x.render){
        this.svg.x_axis_label = this.svg.x_axis.append("text")
            .attr("class", "lz-x lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y1_axis = this.svg.group.append("g")
        .attr("id", this.getBaseId() + ".y1_axis").attr("class", "lz-y lz-y1 lz-axis");
    if (this.layout.axes.y1.render){
        this.svg.y1_axis_label = this.svg.y1_axis.append("text")
            .attr("class", "lz-y1 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y2_axis = this.svg.group.append("g")
        .attr("id", this.getBaseId() + ".y2_axis").attr("class", "lz-y lz-y2 lz-axis");
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

    // Create the Data Layer
    var data_layer = LocusZoom.DataLayers.get(layout.type, id, layout, this);

    // Store the Data Layer on the Panel
    this.data_layers[data_layer.id] = data_layer;
    this.data_layer_ids_by_z_index.push(data_layer.id);

    // Generate xExtent function (defaults to the state range defined by "start" and "end")
    if (layout.x_axis && typeof layout.x_axis.field == "string"){
        this.xExtent = this.data_layers[data_layer.id].getAxisExtent("x");
    } else {
        this.xExtent = function(){
            return d3.extent([this.state.start, this.state.end]);
        };
    }
    // Generate the yExtent function
    if (layout.y_axis && typeof layout.y_axis.field == "string"){
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

    // Position the panel container
    this.svg.container.attr("transform", "translate(" + this.layout.origin.x +  "," + this.layout.origin.y + ")");

    // Set size on the clip rect
    this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);

    // Set and position the inner border, if necessary
    if (this.layout.inner_border){
        this.inner_border
            .attr("x", this.layout.margin.left).attr("y", this.layout.margin.top)
            .attr("width", this.layout.width - (this.layout.margin.left + this.layout.margin.right))
            .attr("height", this.layout.height - (this.layout.margin.top + this.layout.margin.bottom))
            .style({ "fill": "transparent",
                     "stroke-width": 1,
                     "stroke": this.layout.inner_border });
    }

    // Generate discrete extents, ticks, and scales
    if (typeof this.xExtent == "function"){
        this.x_extent = this.xExtent();
        if (this.layout.axes.x.ticks){
            this.x_ticks = this.layout.axes.x.ticks;
        } else {
            this.x_ticks = LocusZoom.prettyTicks(this.x_extent, "both", this.layout.cliparea.width/120);
        }
        this.x_scale = d3.scale.linear()
            .domain([this.x_extent[0], this.x_extent[1]])
            .range([0, this.layout.cliparea.width]);
    }
    if (typeof this.y1Extent == "function"){
        this.y1_extent = this.y1Extent();
        if (this.layout.axes.y1.ticks){
            this.y1_ticks = this.layout.axes.y1.ticks;
        } else {
            this.y1_ticks = LocusZoom.prettyTicks(this.y1_extent);
        }
        this.y1_extent = d3.extent(this.y1_extent.concat(this.y1_ticks));
        this.y1_scale = d3.scale.linear()
            .domain([this.y1_extent[0], this.y1_extent[1]])
            .range([this.layout.cliparea.height, 0]);
    }
    if (typeof this.y2Extent == "function"){
        this.y2_extent = this.y2Extent();
        if (this.layout.axes.y2.ticks){
            this.y2_ticks = this.layout.axes.y2.ticks;
        } else {
            this.y2_ticks = LocusZoom.prettyTicks(this.y2_extent);
        }
        this.y2_extent = d3.extent(this.y2_extent.concat(this.y2_ticks));
        this.y2_scale = d3.scale.linear()
            .domain([this.y2_extent[0], this.y2_extent[1]])
            .range([this.layout.cliparea.height, 0]);
    }

    // Render axes and labels
    var canRenderAxis = function(axis){
        return (typeof this[axis + "_scale"] == "function" && !isNaN(this[axis + "_scale"](0)));
    }.bind(this);
    
    if (this.layout.axes.x.render && canRenderAxis("x")){
        this.renderAxis("x");
    }

    if (this.layout.axes.y1.render && canRenderAxis("y1")){
        this.renderAxis("y1");
    }

    if (this.layout.axes.y2.render && canRenderAxis("y2")){
        this.renderAxis("y2");
    }

    // Render data layers in order by z-index
    this.data_layer_ids_by_z_index.forEach(function(data_layer_id){
        this.data_layers[data_layer_id].draw().render();
    }.bind(this));

    return this;
    
};


// Render ticks for a particular axis
LocusZoom.Panel.prototype.renderAxis = function(axis){

    if (["x", "y1", "y2"].indexOf(axis) == -1){
        throw("Unable to render axis; invalid axis identifier: " + axis);
    }

    // Axis-specific values to plug in where needed
    var axis_params = {
        x: {
            position: "translate(" + this.layout.margin.left + "," + (this.layout.height - this.layout.margin.bottom) + ")",
            orientation: "bottom",
            label_x: this.layout.cliparea.width / 2,
            label_y: (this.layout.axes[axis].label_offset || 0),
            label_rotate: null
        },
        y1: {
            position: "translate(" + this.layout.margin.left + "," + this.layout.margin.top + ")",
            orientation: "left",
            label_x: -1 * (this.layout.axes[axis].label_offset || 0),
            label_y: this.layout.cliparea.height / 2,
            label_rotate: -90
        },
        y2: {
            position: "translate(" + (this.layout.width - this.layout.margin.right) + "," + this.layout.margin.top + ")",
            orientation: "right",
            label_x: (this.layout.axes[axis].label_offset || 0),
            label_y: this.layout.cliparea.height / 2,
            label_rotate: -90
        }
    };

    // Determine if the ticks are all numbers (d3-automated tick rendering) or not (manual tick rendering)
    var ticksAreAllNumbers = (function(ticks){
        for (var i = 0; i < ticks.length; i++){
            if (isNaN(ticks[i])){
                return false;
            }
        }
        return true;
    })(this[axis+"_ticks"]);

    // Initialize the axis; set scale and orientation
    this[axis+"_axis"] = d3.svg.axis()
        .scale(this[axis+"_scale"]).orient(axis_params[axis].orientation);

    // Set tick values and format
    if (ticksAreAllNumbers){
        this[axis+"_axis"].tickValues(this[axis+"_ticks"]);
        if (this.layout.axes[axis].tick_format == "region"){
            this[axis+"_axis"].tickFormat(function(d) { return LocusZoom.positionIntToString(d); });
        }
    } else {
        var ticks = this[axis+"_ticks"].map(function(t){
            return(t.x);
        });
        this[axis+"_axis"].tickValues(ticks)
            .tickFormat(function(t, i) { return this[axis+"_ticks"][i].text; }.bind(this));
    }

    // Position the axis in the SVG and apply the axis construct
    this.svg[axis+"_axis"]
        .attr("transform", axis_params[axis].position)
        .call(this[axis+"_axis"]);

    // If necessary manually apply styles and transforms to ticks as specified by the layout
    if (!ticksAreAllNumbers){
        var tick_selector = d3.selectAll("g#" + this.getBaseId().replace(".","\\.") + "\\." + axis + "_axis g.tick");
        var panel = this;
        tick_selector.each(function(d, i){
            var selector = d3.select(this).select("text");
            if (panel[axis+"_ticks"][i].style){
                selector.style(panel[axis+"_ticks"][i].style);
            }
            if (panel[axis+"_ticks"][i].transform){
                selector.attr("transform", panel[axis+"_ticks"][i].transform);
            }
        });
    }

    // Render the axis label if necessary
    var label = this.layout.axes[axis].label || null;
    if (this.layout.axes[axis].label_function){
        label = LocusZoom.LabelFunctions.get(this.layout.axes[axis].label_function, this.state);
    }
    if (label != null){
        this.svg[axis+"_axis_label"]
            .attr("x", axis_params[axis].label_x).attr("y", axis_params[axis].label_y)
            .text(label);
        if (axis_params[axis].label_rotate != null){
            this.svg[axis+"_axis_label"]
                .attr("transform", "rotate(" + axis_params[axis].label_rotate + " " + axis_params[axis].label_x + "," + axis_params[axis].label_y + ")");
        }
    }

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

LocusZoom.DataLayer = function(id, layout, parent) {

    this.initialized = false;

    this.id     = id;
    this.parent = parent || null;
    this.svg    = {};

    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.DataLayer.DefaultLayout);

    // Define state parameters specific to this data layer
    if (this.parent){
        this.state = this.parent.state;
        this.state_id = this.parent.id + "." + this.id;
        this.state[this.state_id] = this.state[this.state_id] || {};
        if (this.layout.selectable){
            this.state[this.state_id].selected = this.state[this.state_id].selected || null;
        }
    } else {
        this.state = {};
        this.state_id = null;
    }

    this.data = [];

    this.getBaseId = function(){
        return this.parent.parent.id + "." + this.parent.id + "." + this.id;
    };

    this.triggerOnUpdate = function(){
        this.parent.triggerOnUpdate();
    };

    // Tooltip methods
    this.tooltips = {};
    this.createTooltip = function(d, id){
        if (typeof this.layout.tooltip != "object"){
            throw ("DataLayer [" + this.id + "] layout does not define a tooltip");
        }
        if (typeof id != "string"){
            throw ("Unable to create tooltip: id is not a string");
        }
        this.tooltips[id] = {
            data: d,
            arrow: null,
            selector: d3.select(this.parent.parent.svg.node().parentNode).append("div")
                .attr("class", "lz-data_layer-tooltip")
                .attr("id", this.getBaseId() + ".tooltip." + id)
        };
        if (this.layout.tooltip.html){
            this.tooltips[id].selector.html(LocusZoom.parseFields(d, this.layout.tooltip.html));
        } else if (this.layout.tooltip.divs){
            var i, div, selection;
            for (i in this.layout.tooltip.divs){
                div = this.layout.tooltip.divs[i];
                selection = this.tooltips[id].selector.append("div");
                if (div.id){ selection.attr("id", div.id); }
                if (div.class){ selection.attr("class", div.class); }
                if (div.style){ selection.style(div.style); }
                if (div.html){ selection.html(LocusZoom.parseFields(d, div.html)); }
            }
        }
        this.positionTooltip(id);
    };
    this.destroyTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to destroy tooltip: id is not a string");
        }
        if (this.tooltips[id]){
            if (typeof this.tooltips[id].selector == "object"){
                this.tooltips[id].selector.remove();
            }
            delete this.tooltips[id];
        }
    };
    this.destroyAllTooltips = function(){
        var id;
        for (id in this.tooltips){
            this.destroyTooltip(id);
        }
    };
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        // Position the div itself
        this.tooltips[id].selector
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY) + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!this.tooltips[id].arrow){
            this.tooltips[id].arrow = this.tooltips[id].selector.append("div")
                .style("position", "absolute")
                .attr("class", "lz-data_layer-tooltip-arrow_top_left");
        }
        this.tooltips[id].arrow
            .style("left", "-1px")
            .style("top", "-1px");
    };
    this.positionAllTooltips = function(){
        var id;
        for (id in this.tooltips){
            this.positionTooltip(id);
        }
    };

    // Get an object with the x and y coordinates of this data layer's origin in terms of the entire page
    // (useful for custom reimplementations this.positionTooltip())
    this.getPageOrigin = function(){
        var bounding_client_rect = this.parent.parent.svg.node().getBoundingClientRect();
        var x_offset = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y_offset = document.documentElement.scrollTop || document.body.scrollTop;
        var container = this.parent.parent.svg.node();
        while (container.parentNode != null){
            container = container.parentNode;
            if (container != document && d3.select(container).style("position") != "static"){
                x_offset = -1 * container.getBoundingClientRect().left;
                y_offset = -1 * container.getBoundingClientRect().top;
                break;
            }
        }
        return {
            x: x_offset + bounding_client_rect.left + this.parent.layout.origin.x + this.parent.layout.margin.left,
            y: y_offset + bounding_client_rect.top + this.parent.layout.origin.y + this.parent.layout.margin.top
        };
    };
    
    return this;

};

LocusZoom.DataLayer.DefaultLayout = {
    type: "",
    fields: [],
    x_axis: {},
    y_axis: {}
};

// Generate dimension extent function based on layout parameters
LocusZoom.DataLayer.prototype.getAxisExtent = function(dimension){

    if (["x", "y"].indexOf(dimension) == -1){
        throw("Invalid dimension identifier passed to LocusZoom.DataLayer.getAxisExtent()");
    }

    var axis = dimension + "_axis";
    return function(){
        var extent = d3.extent(this.data, function(d) {
            return +d[this.layout[axis].field];
        }.bind(this));

        // Apply upper/lower buffers, if applicable
        var original_extent_span = extent[1] - extent[0];
        if (!isNaN(this.layout[axis].lower_buffer)){ extent.push(extent[0] - (original_extent_span * this.layout[axis].lower_buffer)); }
        if (!isNaN(this.layout[axis].upper_buffer)){ extent.push(extent[1] + (original_extent_span * this.layout[axis].upper_buffer)); }

        // Apply minimum extent
        if (typeof this.layout[axis].min_extent == "object" && !isNaN(this.layout[axis].min_extent[0]) && !isNaN(this.layout[axis].min_extent[1])){
            extent.push(this.layout[axis].min_extent[0], this.layout[axis].min_extent[1]);
        }

        // Generate a new base extent
        extent = d3.extent(extent);

        // Apply floor/ceiling, if applicable
        if (!isNaN(this.layout[axis].floor)){ extent[0] = this.layout[axis].floor; }
        if (!isNaN(this.layout[axis].ceiling)){ extent[1] = this.layout[axis].ceiling; }
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
    this.positionAllTooltips();
    return this;
};

// Re-Map a data layer to new positions according to the parent panel's parent instance's state
LocusZoom.DataLayer.prototype.reMap = function(){
    this.destroyAllTooltips(); // hack - only non-visible tooltips should be destroyed
                               // and then recreated if returning to visibility
    var promise = this.parent.parent.lzd.getData(this.state, this.layout.fields); //,"ld:best"
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


/**************************
  Transformation Functions

  Singleton for formatting or transforming a single input, for instance turning raw p values into negeative log10 form
  Transformation functions are chainable with a pipe on a field name, like so: "pvalue|neglog10"

  NOTE: Because these functions are chainable the FUNCTION is returned by get(), not the result of that function.

  All transformation functions must accept an object of parameters and a value to process.
*/
LocusZoom.TransformationFunctions = (function() {
    var obj = {};
    var transformations = {};

    var getTrans = function(name) {
        if (!name) {
            return null;
        }
        var fun = transformations[name];
        if (fun)  {
            return fun;
        } else {
            throw("transformation " + name + " not found");
        }
    };

    //a single transformation with any parameters
    //(parameters not currently supported)
    var parseTrans = function(name) {
        return getTrans(name);
    };

    //a "raw" transformation string with a leading pipe
    //and one or more transformations
    var parseTransString = function(x) {
        var funs = [];
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
    obj.get = function(name) {
        if (name && name.substring(0,1)=="|") {
            return parseTransString(name);
        } else {
            return parseTrans(name);
        }
    };

    obj.set = function(name, fn) {
        if (name.substring(0,1)=="|") {
            throw("transformation name should not start with a pipe");
        } else {
            if (fn) {
                transformations[name] = fn;
            } else {
                delete transformations[name];
            }
        }
    };

    obj.add = function(name, fn) {
        if (transformations[name]) {
            throw("transformation already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(transformations);
    };

    return obj;
})();

LocusZoom.TransformationFunctions.add("neglog10", function(x) {
    return -Math.log(x) / Math.LN10;
});

LocusZoom.TransformationFunctions.add("scinotation", function(x) {
    var log;
    if (Math.abs(x) > 1){
        log = Math.ceil(Math.log(x) / Math.LN10);
    } else {
        log = Math.floor(Math.log(x) / Math.LN10);
    }
    if (Math.abs(log) <= 3){
        return x.toFixed(3);
    } else {
        return x.toExponential(2).replace("+", "").replace("e", " × 10^");
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

    obj.get = function(name, id, layout, parent) {
        if (!name) {
            return null;
        } else if (datalayers[name]) {
            if (typeof id == "undefined" || typeof layout == "undefined"){
                throw("id or layout argument missing for data layer [" + name + "]");
            } else {
                return new datalayers[name](id, layout, parent);
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

LocusZoom.DataLayers.add("scatter", function(id, layout, parent){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        point_size: 40,
        point_shape: "circle",
        color: "#888888",
        y_axis: {
            axis: 1
        },
        selectable: true
    };
    layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);

    // Extra default for layout spacing
    // Not in default layout since that would make the label attribute always present
    if (layout.label && isNaN(layout.label.spacing)){
        layout.label.spacing = 4;
    }

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Reimplement the positionTooltip() method to be scatter-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        var y_scale  = "y"+this.layout.y_axis.axis+"_scale";
        var y_center = this.parent[y_scale](tooltip.data[this.layout.y_axis.field]);
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        // Position horizontally on the left or the right depending on which side of the plot the point is on
        var offset = Math.sqrt(this.layout.point_size / Math.PI);
        var left, arrow_type, arrow_left;
        if (x_center <= this.parent.layout.width / 2){
            left = page_origin.x + x_center + offset + arrow_width + stroke_width;
            arrow_type = "left";
            arrow_left = -1 * (arrow_width + stroke_width);
        } else {
            left = page_origin.x + x_center - tooltip_box.width - offset - arrow_width - stroke_width;
            arrow_type = "right";
            arrow_left = tooltip_box.width - stroke_width;
        }
        // Position vertically centered unless we're at the top or bottom of the plot
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var top, arrow_top;
        if (y_center - (tooltip_box.height / 2) <= 0){ // Too close to the top, push it down
            top = page_origin.y + y_center - (1.5 * arrow_width) - border_radius;
            arrow_top = border_radius;
        } else if (y_center + (tooltip_box.height / 2) >= data_layer_height){ // Too close to the bottom, pull it up
            top = page_origin.y + y_center + arrow_width + border_radius - tooltip_box.height;
            arrow_top = tooltip_box.height - (2 * arrow_width) - border_radius;
        } else { // vertically centered
            top = page_origin.y + y_center - (tooltip_box.height / 2);
            arrow_top = (tooltip_box.height / 2) - arrow_width;
        }        
        // Apply positions to the main div
        tooltip.selector.style("left", left + "px").style("top", top + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style("left", arrow_left + "px")
            .style("top", arrow_top + "px");
    };

    // Function to flip labels from being anchored at the start of the text to the end
    // Both to keep labels from running outside the data layer and
    // also as a first pass on recursive separation
    this.flip_labels = function(){
        var data_layer = this;
        var spacing = this.layout.label.spacing;
        var min_x = 2 * spacing;
        var max_x = data_layer.parent.layout.width - data_layer.parent.layout.margin.left - data_layer.parent.layout.margin.right - (2 * spacing);
        data_layer.label_texts.each(function (d, i) {
            a = this;
            da = d3.select(a);
            dax = +da.attr("x");
            abound = da.node().getBoundingClientRect();
            if (dax + abound.width + spacing > max_x){
                da.style("text-anchor", "end");
                da.attr("x", dax - (2 * spacing) - (2 * Math.sqrt(data_layer.layout.point_size)));
                var dl = d3.select(data_layer.label_lines[0][i]);
                var dlx2 = +dl.attr("x2");
                dlx2 -= spacing + (2 * Math.sqrt(data_layer.layout.point_size));
                dl.attr("x2", dlx2);
            }
        });
    };

    // Recursive function to space labels apart immediately after initial render
    // Adapted from thudfactor's fiddle here: https://jsfiddle.net/thudfactor/HdwTH/
    // TODO: Make labels also aware of data elements
    this.separate_labels = function(){
        this.seperate_iterations++;
        var data_layer = this;
        var alpha = 0.5;
        var spacing = this.layout.label.spacing;
        var again = false;
        data_layer.label_texts.each(function (d, i) {
            a = this;
            da = d3.select(a);
            y1 = da.attr("y");
            data_layer.label_texts.each(function (d, j) {
                b = this;
                // a & b are the same element and don't collide.
                if (a == b) return;
                db = d3.select(b);
                // a & b are on opposite sides of the chart and
                // don't collide
                if (da.attr("text-anchor") != db.attr("text-anchor")) return;
                // Determine if the  bounding rects for the two text elements collide
                abound = da.node().getBoundingClientRect();
                bbound = db.node().getBoundingClientRect();
                var collision = abound.left < bbound.left + bbound.width + (2*spacing) &&
                    abound.left + abound.width + (2*spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2*spacing) &&
                    abound.height + abound.top + (2*spacing) > bbound.top;
                if (!collision) return;
                again = true;                
                // If the labels collide, we'll push each
                // of the two labels up and down a little bit.
                y2 = db.attr("y");
                sign = abound.top < bbound.top ? 1 : -1;
                adjust = sign * alpha;
                new_a_y = +y1 - adjust;
                new_b_y = +y2 + adjust;
                // Keep new values from extending outside the data layer
                var min_y = 2 * spacing;
                var max_y = data_layer.parent.layout.height - data_layer.parent.layout.margin.top - data_layer.parent.layout.margin.bottom - (2 * spacing);
                if (new_a_y - (abound.height/2) < min_y){
                    delta = +y1 - new_a_y;
                    new_a_y = +y1;
                    new_b_y += delta;
                } else if (new_b_y - (bbound.height/2) < min_y){
                    delta = +y2 - new_b_y;
                    new_b_y = +y2;
                    new_a_y += delta;
                }
                if (new_a_y + (abound.height/2) > max_y){
                    delta = new_a_y - +y1;
                    new_a_y = +y1;
                    new_b_y -= delta;
                } else if (new_b_y + (bbound.height/2) > max_y){
                    delta = new_b_y - +y2;
                    new_b_y = +y2;
                    new_a_y -= delta;
                }
                da.attr("y",new_a_y);
                db.attr("y",new_b_y);
            });
        });
        if (again) {
            // Adjust lines to follow the labels
            if (data_layer.layout.label.lines){
                var label_elements = data_layer.label_texts[0];
                data_layer.label_lines.attr("y2",function(d,i) {
                    var label_line = d3.select(label_elements[i]);
                    return label_line.attr("y");
                });
            }
            // Recurse
            setTimeout(function(){
                this.separate_labels();
            }.bind(this), 1);
        }
    };

    // Implement the main render function
    this.render = function(){

        var data_layer = this;
        var x_scale = "x_scale";
        var y_scale = "y"+this.layout.y_axis.axis+"_scale";

        // Generate labels first (if defined)
        if (this.layout.label){
            var min_x = this.parent.layout.margin.left + this.layout.label.spacing;
            var max_x = this.parent.layout.width - this.parent.layout.margin.left - this.parent.layout.margin.right - this.layout.label.spacing;
            var filtered_data = this.data.filter(function(d){
                if (!data_layer.layout.label.filters){
                    return true;
                } else {
                    // Start by assuming a match, run through all filters to test if not a match
                    var match = true;
                    data_layer.layout.label.filters.forEach(function(filter){
                        switch (filter.operator){
                        case "<":
                            if (!(d[filter.field] < filter.value)){ match = false; }
                            break;
                        case "<=":
                            if (!(d[filter.field] <= filter.value)){ match = false; }
                            break;
                        case ">":
                            if (!(d[filter.field] > filter.value)){ match = false; }
                            break;
                        case ">=":
                            if (!(d[filter.field] >= filter.value)){ match = false; }
                            break;
                        case "=":
                            if (!(d[filter.field] == filter.value)){ match = false; }
                            break;
                        default:
                            // If we got here the operator is not valid, so the filter should fail
                            match = false;
                            break;
                        }
                    });
                    return match;
                }
            });
            this.label_groups = this.svg.group
                .selectAll("g.lz-data_layer-scatter-label")
                .data(filtered_data, function(d){ return d.id + "_label"; });
            this.label_groups.enter()
                .append("g")
                .attr("class", "lz-data_layer-scatter-label");

            // Render label text
            this.label_texts = this.label_groups.append("text")
                .attr("class", "lz-data_layer-scatter-label");
            this.label_texts
                .text(function(d){
                    return LocusZoom.parseFields(d, data_layer.layout.label.text || "");
                })
                .style(data_layer.layout.label.style || {})
                .attr({
                    "x": function(d){
                        var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field])
                              + Math.sqrt(data_layer.layout.point_size) + data_layer.layout.label.spacing
                        if (isNaN(x)){ x = -1000; }
                        return x;
                    },
                    "y": function(d){
                        var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                        if (isNaN(y)){ y = -1000; }
                        return y;
                    },
                    "text-anchor": function(d){
                        return "start";
                    }
                });
            // Render label lines
            if (data_layer.layout.label.lines){
                this.label_lines = this.label_groups.append("line")
                    .attr("class", "lz-data_layer-scatter-label");
                this.label_lines
                    .attr({
                        "x1": function(d){
                            var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field]);
                            if (isNaN(x)){ x = -1000; }
                            return x;
                        },
                        "y1": function(d){
                            var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                            if (isNaN(y)){ y = -1000; }
                            return y;
                        },
                        "x2": function(d){
                            var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field])
                                  + Math.sqrt(data_layer.layout.point_size) + (data_layer.layout.label.spacing/2)
                            if (isNaN(x)){ x = -1000; }
                            return x;
                        },
                        "y2": function(d){
                            var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                            if (isNaN(y)){ y = -1000; }
                            return y;
                        },
                    });
            }
            this.label_groups.exit().remove();
        }
            
        // Generate main scatter data elements
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-scatter")
            .data(this.data, function(d){ return d.id; });

        // Create elements, apply class and ID
        selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-scatter")
            .attr("id", function(d){ return "s" + d.id.replace(/\W/g,""); });

        // Generate new values (or functions for them) for position, color, and shape
        var transform = function(d) {
            var x = this.parent[x_scale](d[this.layout.x_axis.field]);
            var y = this.parent[y_scale](d[this.layout.y_axis.field]);
            if (isNaN(x)){ x = -1000; }
            if (isNaN(y)){ y = -1000; }
            return "translate(" + x + "," + y + ")";
        }.bind(this);
        var fill;
        if (this.layout.color){
            switch (typeof this.layout.color){
            case "string":
                fill = this.layout.color;
                break;
            case "object":
                if (this.layout.color.scale_function && this.layout.color.field) {
                    fill = function(d){
                        return LocusZoom.ScaleFunctions.get(this.layout.color.scale_function,
                                                            this.layout.color.parameters || {},
                                                            d[this.layout.color.field]);
                    }.bind(this);
                }
                break;
            }
        }
        var shape = d3.svg.symbol().size(this.layout.point_size).type(this.layout.point_shape);

        // Apply position and color, using a transition if necessary
        if (this.layout.transition){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("d", shape);
        } else {
            selection
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("d", shape);
        }

        // Apply selectable, tooltip, etc
        if (this.layout.selectable && (this.layout.fields.indexOf("id") != -1)){
            selection.on("mouseover", function(d){
                var id = "s" + d.id.replace(/\W/g,"");
                if (this.state[this.state_id].selected != id){
                    d3.select("#" + id).attr("class", "lz-data_layer-scatter lz-data_layer-scatter-hovered");
                    if (this.layout.tooltip){ this.createTooltip(d, id); }
                }
            }.bind(this))
            .on("mouseout", function(d){
                var id = "s" + d.id.replace(/\W/g,"");
                if (this.state[this.state_id].selected != id){
                    d3.select("#" + id).attr("class", "lz-data_layer-scatter");
                    if (this.layout.tooltip){ this.destroyTooltip(id); }
                }
            }.bind(this))
            .on("click", function(d){
                var id = "s" + d.id.replace(/\W/g,"");
                if (this.state[this.state_id].selected == id){
                    this.state[this.state_id].selected = null;
                    d3.select("#" + id).attr("class", "lz-data_layer-scatter lz-data_layer-scatter-hovered");
                } else {
                    if (this.state[this.state_id].selected != null){
                        d3.select("#" + this.state[this.state_id].selected).attr("class", "lz-data_layer-scatter");
                        if (this.layout.tooltip){ this.destroyTooltip(this.state[this.state_id].selected); }
                    }
                    this.state[this.state_id].selected = id;
                    d3.select("#" + id).attr("class", "lz-data_layer-scatter lz-data_layer-scatter-selected");
                }
                this.triggerOnUpdate();
            }.bind(this));

            // Apply existing elements from state
            if (this.state[this.state_id].selected != null){
                var selected_id = this.state[this.state_id].selected;
                if (d3.select("#" + selected_id).empty()){
                    console.warn("State elements for " + this.state_id + " contains an ID that is not or is no longer present on the plot: " + this.state[this.state_id].selected);
                    this.state[this.state_id].selected = null;
                } else {
                    if (this.tooltips[this.state[this.state_id].selected]){
                        this.positionTooltip(this.state[this.state_id].selected);
                    } else {
                        this.state[this.state_id].selected = null;
                        var d = d3.select("#" + selected_id).datum();
                        d3.select("#" + selected_id).on("mouseover")(d);
                        d3.select("#" + selected_id).on("click")(d);
                    }
                }
            }
        }

        // Remove old elements as needed
        selection.exit().remove();

        // Apply method to keep labels from overlapping each other
        if (this.layout.label){
            this.flip_labels();
            this.seperate_iterations = 0;
            this.separate_labels();
        }
        
    };
       
    return this;
});

/*********************
  Genes Data Layer
  Implements a data layer that will render gene tracks
*/

LocusZoom.DataLayers.add("genes", function(id, layout, parent){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        label_font_size: 12,
        label_exon_spacing: 4,
        exon_height: 16,
        bounding_box_padding: 6,
        track_vertical_spacing: 10,
        selectable: true
    };
    layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);
    
    // Helper function to sum layout values to derive total height for a single gene track
    this.getTrackHeight = function(){
        return 2 * this.layout.bounding_box_padding
            + this.layout.label_font_size
            + this.layout.label_exon_spacing
            + this.layout.exon_height
            + this.layout.track_vertical_spacing;
    };

    // A gene may have arbitrarily many transcripts, but this data layer isn't set up to render them yet.
    // Stash a transcript_idx to point to the first transcript and use that for all transcript refs.
    this.transcript_idx = 0;
    
    this.tracks = 1;
    this.gene_track_index = { 1: [] }; // track-number-indexed object with arrays of gene indexes in the dataset

    // After we've loaded the genes interpret them to assign
    // each to a track so that they do not overlap in the view
    this.assignTracks = function(){

        // Function to get the width in pixels of a label given the text and layout attributes
        this.getLabelWidth = function(gene_name, font_size){
            var temp_text = this.svg.group.append("text")
                .attr("x", 0).attr("y", 0).attr("class", "lz-data_layer-gene lz-label")
                .style("font-size", font_size)
                .text(gene_name + "→");
            var label_width = temp_text.node().getBBox().width;
            temp_text.node().remove();
            return label_width;
        };

        // Reinitialize some metadata
        this.tracks = 1;
        this.gene_track_index = { 1: [] };

        this.data.map(function(d, g){

            // If necessary, split combined gene id / version fields into discrete fields.
            // NOTE: this may be an issue with CSG's genes data source that may eventually be solved upstream.
            if (this.data[g].gene_id && this.data[g].gene_id.indexOf(".")){
                var split = this.data[g].gene_id.split(".");
                this.data[g].gene_id = split[0];
                this.data[g].gene_version = split[1];
            }

            // Stash the transcript ID on the parent gene
            this.data[g].transcript_id = this.data[g].transcripts[this.transcript_idx].transcript_id;

            // Determine display range start and end, based on minimum allowable gene display width, bounded by what we can see
            // (range: values in terms of pixels on the screen)
            this.data[g].display_range = {
                start: this.parent.x_scale(Math.max(d.start, this.state.start)),
                end:   this.parent.x_scale(Math.min(d.end, this.state.end))
            };
            this.data[g].display_range.label_width = this.getLabelWidth(this.data[g].gene_name, this.layout.label_font_size);
            this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            // Determine label text anchor (default to middle)
            this.data[g].display_range.text_anchor = "middle";
            if (this.data[g].display_range.width < this.data[g].display_range.label_width){
                if (d.start < this.state.start){
                    this.data[g].display_range.end = this.data[g].display_range.start
                        + this.data[g].display_range.label_width
                        + this.layout.label_font_size;
                    this.data[g].display_range.text_anchor = "start";
                } else if (d.end > this.state.end){
                    this.data[g].display_range.start = this.data[g].display_range.end
                        - this.data[g].display_range.label_width
                        - this.layout.label_font_size;
                    this.data[g].display_range.text_anchor = "end";
                } else {
                    var centered_margin = ((this.data[g].display_range.label_width - this.data[g].display_range.width) / 2)
                        + this.layout.label_font_size;
                    if ((this.data[g].display_range.start - centered_margin) < this.parent.x_scale(this.state.start)){
                        this.data[g].display_range.start = this.parent.x_scale(this.state.start);
                        this.data[g].display_range.end = this.data[g].display_range.start + this.data[g].display_range.label_width;
                        this.data[g].display_range.text_anchor = "start";
                    } else if ((this.data[g].display_range.end + centered_margin) > this.parent.x_scale(this.state.end)) {
                        this.data[g].display_range.end = this.parent.x_scale(this.state.end);
                        this.data[g].display_range.start = this.data[g].display_range.end - this.data[g].display_range.label_width;
                        this.data[g].display_range.text_anchor = "end";
                    } else {
                        this.data[g].display_range.start -= centered_margin;
                        this.data[g].display_range.end += centered_margin;
                    }
                }
                this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            }
            // Add bounding box padding to the calculated display range start, end, and width
            this.data[g].display_range.start -= this.layout.bounding_box_padding;
            this.data[g].display_range.end   += this.layout.bounding_box_padding;
            this.data[g].display_range.width += 2 * this.layout.bounding_box_padding;
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
                this.gene_track_index[potential_track].map(function(placed_gene){
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
                    this.gene_track_index[potential_track].push(this.data[g]);
                } else {
                    potential_track++;
                    if (potential_track > this.tracks){
                        this.tracks = potential_track;
                        this.gene_track_index[potential_track] = [];
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

        // Render gene groups
        var selection = this.svg.group.selectAll("g.lz-data_layer-gene")
            .data(this.data, function(d){ return d.gene_name; });

        selection.enter().append("g")
            .attr("class", "lz-data_layer-gene");

        selection.attr("id", function(d){ return "g" + d.gene_name.replace(/\W/g,""); })
            .each(function(gene){

                var data_layer = gene.parent;

                // Render gene bounding box
                var bboxes = d3.select(this).selectAll("rect.lz-data_layer-gene.lz-bounding_box")
                    .data([gene], function(d){ return d.gene_name + "_bbox"; });

                bboxes.enter().append("rect")
                    .attr("class", "lz-data_layer-gene lz-bounding_box");

                bboxes
                    .attr("id", function(d){
                        return "g" + d.gene_name.replace(/\W/g,"") + "_bounding_box";
                    })
                    .attr("x", function(d){
                        return d.display_range.start;
                    })
                    .attr("y", function(d){
                        return ((d.track-1) * data_layer.getTrackHeight());
                    })
                    .attr("width", function(d){
                        return d.display_range.width;
                    })
                    .attr("height", function(){
                        return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                bboxes.exit().remove();

                // Render gene boundaries
                var boundaries = d3.select(this).selectAll("rect.lz-data_layer-gene.lz-boundary")
                    .data([gene], function(d){ return d.gene_name + "_boundary"; });

                boundaries.enter().append("rect")
                    .attr("class", "lz-data_layer-gene lz-boundary");

                boundaries
                    .attr("x", function(d){
                        return data_layer.parent.x_scale(d.start);
                    })
                    .attr("y", function(d){
                        return ((d.track-1) * data_layer.getTrackHeight())
                            + data_layer.layout.bounding_box_padding
                            + data_layer.layout.label_font_size
                            + data_layer.layout.label_exon_spacing
                            + (Math.max(data_layer.layout.exon_height, 3) / 2);
                    })
                    .attr("width", function(d){
                        return data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start);
                    })
                    .attr("height", 1); // This should be scaled dynamically somehow

                boundaries.exit().remove();

                // Render gene labels
                var labels = d3.select(this).selectAll("text.lz-data_layer-gene.lz-label")
                    .data([gene], function(d){ return d.gene_name + "_label"; });

                labels.enter().append("text")
                    .attr("class", "lz-data_layer-gene lz-label");

                labels
                    .attr("x", function(d){
                        if (d.display_range.text_anchor == "middle"){
                            return d.display_range.start + (d.display_range.width / 2);
                        } else if (d.display_range.text_anchor == "start"){
                            return d.display_range.start + data_layer.layout.bounding_box_padding;
                        } else if (d.display_range.text_anchor == "end"){
                            return d.display_range.end - data_layer.layout.bounding_box_padding;
                        }
                    })
                    .attr("y", function(d){
                        return ((d.track-1) * data_layer.getTrackHeight())
                            + data_layer.layout.bounding_box_padding
                            + data_layer.layout.label_font_size;
                    })
                    .attr("text-anchor", function(d){
                        return d.display_range.text_anchor;
                    })
                    .text(function(d){
                        return (d.strand == "+") ? d.gene_name + "→" : "←" + d.gene_name;
                    })
                    .style("font-size", gene.parent.layout.label_font_size);

                labels.exit().remove();

                // Render exon rects (first transcript only, for now)
                var exons = d3.select(this).selectAll("rect.lz-data_layer-gene.lz-exon")
                    .data(gene.transcripts[gene.parent.transcript_idx].exons, function(d){ return d.exon_id; });
                        
                exons.enter().append("rect")
                    .attr("class", "lz-data_layer-gene lz-exon");
                        
                exons
                    .attr("x", function(d){
                        return data_layer.parent.x_scale(d.start);
                    })
                    .attr("y", function(){
                        return ((gene.track-1) * data_layer.getTrackHeight())
                            + data_layer.layout.bounding_box_padding
                            + data_layer.layout.label_font_size
                            + data_layer.layout.label_exon_spacing;
                    })
                    .attr("width", function(d){
                        return data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start);
                    })
                    .attr("height", function(){
                        return data_layer.layout.exon_height;
                    });

                exons.exit().remove();

                // Render gene click area
                var clickareas = d3.select(this).selectAll("rect.lz-data_layer-gene.lz-clickarea")
                    .data([gene], function(d){ return d.gene_name + "_clickarea"; });

                clickareas.enter().append("rect")
                    .attr("class", "lz-data_layer-gene lz-clickarea");

                clickareas
                    .attr("id", function(d){
                        return "g" + d.gene_name.replace(/\W/g,"") + "_clickarea";
                    })
                    .attr("x", function(d){
                        return d.display_range.start;
                    })
                    .attr("y", function(d){
                        return ((d.track-1) * data_layer.getTrackHeight());
                    })
                    .attr("width", function(d){
                        return d.display_range.width;
                    })
                    .attr("height", function(){
                        return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                // Remove old clickareas as needed
                clickareas.exit().remove();

                // Apply selectable, tooltip, etc. to clickareas
                if (gene.parent.layout.selectable){
                    clickareas
                        .on("mouseover", function(d){
                            var id = "g" + d.gene_name.replace(/\W/g,"");
                            if (data_layer.state[data_layer.state_id].selected != id){
                                d3.select("#" + id + "_bounding_box").attr("class", "lz-data_layer-gene lz-bounding_box lz-bounding_box-hovered");
                                if (data_layer.layout.tooltip){ data_layer.createTooltip(d, id); }
                            }
                        })
                        .on("mouseout", function(d){
                            var id = "g" + d.gene_name.replace(/\W/g,"");
                            if (data_layer.state[data_layer.state_id].selected != id){
                                d3.select("#" + id + "_bounding_box").attr("class", "lz-data_layer-gene lz-bounding_box");
                                if (data_layer.layout.tooltip){ data_layer.destroyTooltip(id); }
                            }
                        })
                        .on("click", function(d){
                            var id = "g" + d.gene_name.replace(/\W/g,"");
                            if (data_layer.state[data_layer.state_id].selected == id){
                                data_layer.state[data_layer.state_id].selected = null;
                                d3.select("#" + id + "_bounding_box").attr("class", "lz-data_layer-gene lz-bounding_box lz-bounding_box-hovered");
                            } else {
                                if (data_layer.state[data_layer.state_id].selected != null){
                                    d3.select("#" + data_layer.state[data_layer.state_id].selected + "_bounding_box").attr("class", "lz-data_layer-gene lz-bounding_box");
                                    if (data_layer.layout.tooltip){ data_layer.destroyTooltip(data_layer.state[data_layer.state_id].selected); }
                                }
                                data_layer.state[data_layer.state_id].selected = id;
                                d3.select("#" + id + "_bounding_box").attr("class", "lz-data_layer-gene lz-bounding_box lz-bounding_box-selected");
                            }
                            data_layer.triggerOnUpdate();
                        });
                    // Apply existing selection from state
                    if (gene.parent.state[gene.parent.state_id].selected != null){
                        var selected_id = gene.parent.state[gene.parent.state_id].selected + "_clickarea";
                        if (d3.select("#" + selected_id).empty()){
                            console.warn("Pre-defined state selection for " + gene.parent.state_id + " contains an ID that is not or is no longer present on the plot: " + gene.parent.state[gene.parent.state_id].selected);
                            gene.parent.state[gene.parent.state_id].selected = null;
                        } else {
                            if (gene.parent.tooltips[gene.parent.state[gene.parent.state_id].selected]){
                                gene.parent.positionTooltip(gene.parent.state[gene.parent.state_id].selected);
                            } else {
                                gene.parent.state[gene.parent.state_id].selected = null;
                                var d = d3.select("#" + selected_id).datum();
                                d3.select("#" + selected_id).on("mouseover")(d);
                                d3.select("#" + selected_id).on("click")(d);
                            }
                        }
                    }
                }

            });

        // Remove old elements as needed
        selection.exit().remove();

    };

    // Reimplement the positionTooltip() method to be gene-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var gene_bbox = d3.select("#g" + tooltip.data.gene_name.replace(/\W/g,"")).node().getBBox();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        // Position horizontally: attempt to center on the portion of the gene that's visible,
        // pad to either side if bumping up against the edge of the data layer
        var gene_center_x = ((tooltip.data.display_range.start + tooltip.data.display_range.end) / 2) - (this.layout.bounding_box_padding / 2);
        var offset_right = Math.max((tooltip_box.width / 2) - gene_center_x, 0);
        var offset_left = Math.max((tooltip_box.width / 2) + gene_center_x - data_layer_width, 0);
        var left = page_origin.x + gene_center_x - (tooltip_box.width / 2) - offset_left + offset_right;
        var arrow_left = (tooltip_box.width / 2) - (arrow_width / 2) + offset_left - offset_right;
        // Position vertically below the gene unless there's insufficient space
        var top, arrow_type, arrow_top;
        if (tooltip_box.height + stroke_width + arrow_width > data_layer_height - (gene_bbox.y + gene_bbox.height)){
            top = page_origin.y + gene_bbox.y - (tooltip_box.height + stroke_width + arrow_width);
            arrow_type = "down";
            arrow_top = tooltip_box.height - stroke_width;
        } else {
            top = page_origin.y + gene_bbox.y + gene_bbox.height + stroke_width + arrow_width;
            arrow_type = "up";
            arrow_top = 0 - stroke_width - arrow_width;
        }
        // Apply positions to the main div
        tooltip.selector.style("left", left + "px").style("top", top + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style("left", arrow_left + "px")
            .style("top", arrow_top + "px");
    };
       
    return this;
});


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