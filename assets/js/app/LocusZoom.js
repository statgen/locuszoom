/* global d3,Q */
/* eslint-env browser */
/* eslint-disable no-console */

var LocusZoom = {
    version: "0.3.3"
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
    resizable: "manual",
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
