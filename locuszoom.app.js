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
    version: "0.3.1"
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
        selector = ".lz-instance";
    }
    if (typeof layout === "undefined"){
        layout = JSON.parse(JSON.stringify(LocusZoom.DefaultLayout));
    }
    if (typeof state === "undefined"){
        state = JSON.parse(JSON.stringify(LocusZoom.DefaultState));
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
    if (base < 1){
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
    var i;
    if (range[0] <= unit){
        i = 0;
    } else {
        i = parseFloat( (Math.floor(range[0]/unit)*unit).toFixed(base_toFixed) );
    }
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
                    class: "ScatterDataLayer",
                    point_shape: "circle",
                    point_size: 32,
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
                        scale_function: "numerical_cut",
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
                    class: "GenesDataLayer",
                    fields: ["gene:gene"],
                    track_height: 40,
                    label_font_size: 12,
                    track_vertical_spacing: 8,
                    label_vertical_spacing: 4,
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
    return this.url + "?filter=source in 1" + 
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
    LocusZoom.Data.GeneSource];

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
    this.layout = layout || JSON.parse(JSON.stringify(LocusZoom.DefaultLayout));
    
    // The state property stores any instance-wide parameters subject to change via user input
    this.state = state || JSON.parse(JSON.stringify(LocusZoom.DefaultState));
    
    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);

    // Initialize the layout
    this.initializeLayout();

    return this;
  
};

LocusZoom.Instance.prototype.initializeLayout = function(){

    // Set instance dimensions or fall back to default values
    this.layout.width      = this.layout.width      || LocusZoom.DefaultLayout.width;
    this.layout.height     = this.layout.height     || LocusZoom.DefaultLayout.height;
    this.layout.min_width  = this.layout.min_width  || LocusZoom.DefaultLayout.min_width;
    this.layout.min_height = this.layout.min_height || LocusZoom.DefaultLayout.min_height;
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

    // When all finished update download SVG link
    Q.all(this.remap_promises).then(function(){
        this.controls.setBase64SVG();
    }.bind(this), function(error){
        console.log(error);
        this.curtain.drop(error);
    }.bind(this));

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

    this.layout = layout || {
        width:  0,
        height: 0,
        min_width: 0,
        min_height: 0,
        proportional_width: 1,
        proportional_height: 1,
        origin: { x: 0, y: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
    };
    this.layout.cliparea = this.layout.cliparea || {};
    this.layout.cliparea.origin = this.layout.cliparea.origin || {};

    this.state = {};
    
    this.data_layers = {};
    this.data_layer_ids_by_z_index = [];
    this.data_promises = [];

    this.xExtent  = null;
    this.y1Extent = null;
    this.y2Extent = null;
    
    this.renderData = function(){};

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };

    // Initialize the layout
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.prototype.initializeLayout = function(){

    // Set panel dimensions, origin, and margin or fall back to default values
    this.layout.width      = this.layout.width      || 0;
    this.layout.height     = this.layout.height     || 0;
    this.layout.min_width  = this.layout.min_width  || 0;
    this.layout.min_height = this.layout.min_height || 0;
    this.layout.proportional_width = this.layout.proportional_width || 1;
    this.layout.proportional_height = this.layout.proportional_height || 1;
    if (typeof this.layout.origin != "object"){ this.layout.origin = { x: 0, y: 0 }; }
    if (typeof this.layout.margin != "object"){ this.layout.margin = { top: 0, right: 0, bottom: 0, left: 0 }; }
    this.layout.margin.top    = this.layout.margin.top    || 0;
    this.layout.margin.right  = this.layout.margin.right  || 0;
    this.layout.margin.bottom = this.layout.margin.bottom || 0;
    this.layout.margin.left   = this.layout.margin.left   || 0;
    this.setDimensions();
    this.setOrigin();
    this.setMargin();

    // Set panel axes
    if (typeof this.layout.axes !== "object"){ this.layout.axes = {}; }
    ["x", "y1", "y2"].forEach(function(axis){
        if (!this.layout.axes[axis]){
            this.layout.axes[axis] = {
                render: false,
                ticks:  [],
                label:  null,
                label_function: null,
                data_layer_id: null
            };
        } else {
            this.layout.axes[axis].render = true;
            this.layout.axes[axis].ticks = this.layout.axes[axis].ticks || [];
            this.layout.axes[axis].label = this.layout.axes[axis].label || null;
            this.layout.axes[axis].label_function = this.layout.axes[axis].label_function || null;
            this.layout.axes[axis].data_layer_id = this.layout.axes[axis].data_layer_id || null;
        }
    }.bind(this));

    // x extent (todo: make this definable from the layout object somehow?)
    this.xExtent = function(){
        return d3.extent([this.parent.state.start, this.parent.state.end]);
    };

    // Add data layers (which define y extents)
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
    if (typeof layout.class !== "string" || typeof LocusZoom[layout.class] !== "function"){
        throw "Invalid data layer class in layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    var data_layer = new LocusZoom[layout.class](id, layout);
    data_layer.parent = this;
    this.data_layers[data_layer.id] = data_layer;
    this.data_layer_ids_by_z_index.push(data_layer.id);

    // If the layout specifies a y axis then generate y axis extent function for the appropriate axis (default to y1)
    if (layout.y_axis){
        var y_axis_name = "y" + (layout.y_axis.axis == 1 || layout.y_axis.axis == 2 ? layout.y_axis.axis : 1);
        this[y_axis_name + "Extent"] = this.data_layers[data_layer.id].getYExtent();
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
    return Q.all(this.data_promises).then(function(){
        this.render();
    }.bind(this), function(error){
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
        this.state.x_extent = this.xExtent();
        this.layout.axes.x.ticks = LocusZoom.prettyTicks(this.state.x_extent, "both", this.layout.cliparea.width/120);
        this.state.x_scale = d3.scale.linear()
            .domain([this.state.x_extent[0], this.state.x_extent[1]])
            .range([0, this.layout.cliparea.width]);
    }
    if (typeof this.y1Extent == "function"){
        this.state.y1_extent = this.y1Extent();
        this.layout.axes.y1.ticks = LocusZoom.prettyTicks(this.state.y1_extent, clip_range(this.layout, "y1"));
        this.state.y1_scale = d3.scale.linear()
            .domain([this.layout.axes.y1.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y1.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }
    if (typeof this.y2Extent == "function"){
        this.state.y2_extent = this.y2Extent();
        this.layout.axes.y2.ticks = LocusZoom.prettyTicks(this.state.y2_extent, clip_range(this.layout, "y2"));
        this.state.y2_scale = d3.scale.linear()
            .domain([this.layout.axes.y2.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y2.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }

    // Render axes and labels
    var canRenderAxis = function(axis){
        return (typeof this.state[axis + "_scale"] == "function" && !isNaN(this.state[axis + "_scale"](0)));
    }.bind(this);
    
    if (this.layout.axes.x.render && canRenderAxis("x")){
        this.state.x_axis = d3.svg.axis()
            .scale(this.state.x_scale)
            .orient("bottom").tickValues(this.layout.axes.x.ticks)
            .tickFormat(function(d) { return LocusZoom.positionIntToString(d); });
        this.svg.x_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + (this.layout.height - this.layout.margin.bottom) + ")")
            .call(this.state.x_axis);
        if (this.layout.axes.x.label_function){
            this.layout.axes.x.label = LocusZoom.Panel.LabelFunctions.get(this.layout.axes.x.label_function, this.parent.state);
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
        this.state.y1_axis = d3.svg.axis().scale(this.state.y1_scale)
            .orient("left").tickValues(this.layout.axes.y1.ticks);
        this.svg.y1_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + this.layout.margin.top + ")")
            .call(this.state.y1_axis);
        if (this.layout.axes.y1.label_function){
            this.layout.axes.y1.label = LocusZoom.Panel.LabelFunctions.get(this.layout.axes.y1.label_function, this.parent.state);
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
        this.state.y2_axis  = d3.svg.axis().scale(this.state.y2_scale)
            .orient("left").tickValues(this.layout.axes.y2.ticks);
        this.svg.y2_axis
            .attr("transform", "translate(" + (this.layout.width - this.layout.margin.right) + "," + this.layout.margin.top + ")")
            .call(this.state.y2_axis);
        if (this.layout.axes.y2.label_function){
            this.layout.axes.y2.label = LocusZoom.Panel.LabelFunctions.get(this.layout.axes.y2.label_function, this.parent.state);
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

/****************
  Label Functions
  Singleton for defining axis label functions with respect to a panel's state
*/

LocusZoom.Panel.LabelFunctions = (function() {
    var obj = {};
    var functions = {
        "chromosome": function(state) {
            if (!isNaN(+state.chr)){ 
                return "Chromosome " + state.chr + " (Mb)";
            } else {
                return "Chromosome (Mb)";
            }
        }
    };

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
        if (functions.name) {
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

    this.layout = layout || {
        class: "DataLayer",
        fields: []
    };

    this.data = [];
    this.metadata = {};

    this.getBaseId = function(){
        return this.parent.parent.id + "." + this.parent.id + "." + this.id;
    };
    
    return this;

};

// Generate a y-axis extent functions based on the layout
LocusZoom.DataLayer.prototype.getYExtent = function(){
    return function(){
        var extent = d3.extent(this.data, function(d) {
            return +d[this.layout.y_axis.field];
        }.bind(this));
        // Apply upper/lower buffers, if applicable
        if (!isNaN(this.layout.y_axis.lower_buffer)){ extent[0] *= 1 - this.layout.y_axis.lower_buffer; }
        if (!isNaN(this.layout.y_axis.upper_buffer)){ extent[1] *= 1 + this.layout.y_axis.upper_buffer; }
        // Apply floor/ceiling, if applicable
        if (!isNaN(this.layout.y_axis.floor)){ extent[0] = Math.max(extent[0], this.layout.y_axis.floor); }
        if (!isNaN(this.layout.y_axis.ceiling)){ extent[1] = Math.min(extent[1], this.layout.y_axis.ceiling); }
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

/****************
  Scale Functions
  Singleton for accessing/storing functions that will convert arbitrary data points to values in a given scale
  Useful for anything that needs to scale discretely with data (e.g. color, point size, etc.)
*/

LocusZoom.DataLayer.ScaleFunctions = (function() {
    var obj = {};
    var functions = {
        "numerical_cut": function(parameters, value){
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
        },
        "categorical_cut": function(parameters, value){
            if (parameters.categories.indexOf(value) != -1){
                return parameters.values[parameters.categories.indexOf(value)];
            } else {
                return (parameters.null_value ? parameters.null_value : parameters.values[0]); 
            }
        }
    };

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
            throw("color function [" + name + "] not found");
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
        if (functions.name) {
            throw("color function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();


/*********************
  Scatter Data Layer
  Implements a standard scatter plot
*/

LocusZoom.ScatterDataLayer = function(id, layout){

    LocusZoom.DataLayer.apply(this, arguments);
    this.layout = layout;

    // Apply defaults to the layout where missing
    this.layout.point_size == this.layout.point_size || 4;
    this.layout.point_shape == this.layout.point_shape || "circle";
    this.layout.color == this.layout.color || "#888888";
    if (this.layout.y_axis && this.layout.y_axis.axis != 1 && this.layout.y_axis.axis != 2){
        this.layout.y_axis.axis = 1;
    }

    // Implement the main render function
    this.render = function(){
        this.svg.group.selectAll("*").remove(); // should this happen at all, or happen at the panel level?
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-scatter")
            .data(this.data)
            .enter().append("path")
            .attr("class", "lz-data_layer-scatter")
            .attr("transform", function(d) {
                var x = this.parent.state.x_scale(d[this.layout.x_axis.field]);
                var y_scale = "y"+this.layout.y_axis.axis+"_scale";
                var y = this.parent.state[y_scale](d[this.layout.y_axis.field]);
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
                            return LocusZoom.DataLayer.ScaleFunctions.get(this.layout.color.scale_function,
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
};

LocusZoom.ScatterDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  Genes Data Layer
  Implements a data layer that will render gene tracks
*/

LocusZoom.GenesDataLayer = function(id, layout){

    LocusZoom.DataLayer.apply(this, arguments);
    this.layout = layout;

    // Apply defaults to the layout where missing
    this.layout.track_height = this.layout.track_height || 40;
    this.layout.label_font_size = this.layout.label_font_size || 12;
    this.layout.track_vertical_spacing = this.layout.track_vertical_spacing || 8;
    this.layout.label_vertical_spacing = this.layout.label_vertical_spacing || 4;
    
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
                start: this.parent.state.x_scale(Math.max(d.start, this.parent.parent.state.start)),
                end:   this.parent.state.x_scale(Math.min(d.end, this.parent.parent.state.end))
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
                    if ((this.data[g].display_range.start - centered_margin) < this.parent.state.x_scale(this.parent.parent.state.start)){
                        this.data[g].display_range.start = this.parent.state.x_scale(this.parent.parent.state.start);
                        this.data[g].display_range.end = this.data[g].display_range.start + this.data[g].display_range.label_width;
                        this.data[g].display_range.text_anchor = "start";
                    } else if ((this.data[g].display_range.end + centered_margin) > this.parent.state.x_scale(this.parent.parent.state.end)) {
                        this.data[g].display_range.end = this.parent.state.x_scale(this.parent.parent.state.end);
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
                start: this.parent.state.x_scale.invert(this.data[g].display_range.start),
                end:   this.parent.state.x_scale.invert(this.data[g].display_range.end)
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
                    .attr("x", function(d){ return this.parent.state.x_scale(d.start); }.bind(gene.parent))
                    .attr("y", function(d){
                        var exon_height = this.parent.layout.track_height
                            - this.parent.layout.track_vertical_spacing
                            - this.parent.layout.label_font_size
                            - this.parent.layout.label_vertical_spacing;
                        return ((d.track-1) * this.parent.layout.track_height)
                            + (this.parent.layout.track_vertical_spacing / 2)
                            + this.parent.layout.label_font_size
                            + this.parent.layout.label_vertical_spacing
                            + (Math.max(exon_height, 3) / 2);
                    }.bind(gene)) // Arbitrary track height; should be dynamic
                    .attr("width", function(d){ return this.parent.state.x_scale(d.end) - this.parent.state.x_scale(d.start); }.bind(gene.parent))
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
                        return ((d.track-1) * this.parent.layout.track_height)
                            + (this.parent.layout.track_vertical_spacing / 2)
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
                            .attr("x", function(d){ return this.parent.state.x_scale(d.start); }.bind(gene.parent))
                            .attr("y", function(){
                                return ((this.track-1) * this.parent.layout.track_height)
                                    + (this.parent.layout.track_vertical_spacing / 2)
                                    + this.parent.layout.label_font_size
                                    + this.parent.layout.label_vertical_spacing;
                            }.bind(gene))
                            .attr("width", function(d){
                                return this.parent.state.x_scale(d.end) - this.parent.state.x_scale(d.start);
                            }.bind(gene.parent))
                            .attr("height", function(d){
                                return this.parent.layout.track_height
                                    - this.parent.layout.track_vertical_spacing
                                    - this.parent.layout.label_font_size
                                    - this.parent.layout.label_vertical_spacing;
                            }.bind(gene))
                            .attr("fill", "#000099")
                            .style({ cursor: "pointer" });

                    });

            });
        
    };
       
    return this;
};

LocusZoom.GenesDataLayer.prototype = new LocusZoom.DataLayer();


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