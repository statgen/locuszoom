/* global d3,Q */
/* eslint-env browser */
/* eslint-disable no-console */

var LocusZoom = {
    version: "0.4.7"
};
    
// Populate a single element with a LocusZoom plot.
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
        layout = LocusZoom.Layouts.merge(stateful_layout, base_layout);
    }
    var plot;
    d3.select(selector).call(function(){
        // Require each containing element have an ID. If one isn't present, create one.
        if (typeof this.node().id == "undefined"){
            var iterator = 0;
            while (!d3.select("#lz-" + iterator).empty()){ iterator++; }
            this.attr("id", "#lz-" + iterator);
        }
        // Create the plot
        plot = new LocusZoom.Plot(this.node().id, datasource, layout);
        // Detect data-region and fill in state values if present
        if (typeof this.node().dataset !== "undefined" && typeof this.node().dataset.region !== "undefined"){
            var parsed_state = LocusZoom.parsePositionQuery(this.node().dataset.region);
            Object.keys(parsed_state).forEach(function(key){
                plot.state[key] = parsed_state[key];
            });
        }
        // Add an SVG to the div and set its dimensions
        plot.svg = d3.select("div#" + plot.id)
            .append("svg")
            .attr("version", "1.1")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("id", plot.id + "_svg").attr("class", "lz-locuszoom");
        plot.setDimensions();
        plot.positionPanels();
        // Initialize the plot
        plot.initialize();
        // If the plot has defined data sources then trigger its first mapping based on state values
        if (typeof datasource == "object" && Object.keys(datasource).length){
            plot.refresh();
        }
    });
    return plot;
};

// Populate arbitrarily many elements each with a LocusZoom plot
// using a common datasource, layout, and/or state
LocusZoom.populateAll = function(selector, datasource, layout, state) {
    var plots = [];
    d3.selectAll(selector).each(function(d,i) {
        plots[i] = LocusZoom.populate(this, datasource, layout, state);
    });
    return plots;
};

// Convert an integer position to a string (e.g. 23423456 => "23.42" (Mb))
// pos    - Position value (integer, required)
// exp    - Exponent of the returned string's base. E.g. 6 => Mb, regardless of pos. (integer, optional)
//          If not provided returned string will select smallest base divisible by 3 for a whole number value
// suffix - Whether or not to append a sufix (e.g. "Mb") to the end of the returned string (boolean, optional)
LocusZoom.positionIntToString = function(pos, exp, suffix){
    var exp_symbols = { 0: "", 3: "K", 6: "M", 9: "G" };
    suffix = suffix || false;
    if (isNaN(exp) || exp == null){
        var log = Math.log(pos) / Math.LN10;
        exp = Math.min(Math.max(log - (log % 3), 0), 9);
    }
    var places_exp = exp - Math.floor((Math.log(pos) / Math.LN10).toFixed(exp + 3));
    var min_exp = Math.min(Math.max(exp, 0), 2);
    var places = Math.min(Math.max(places_exp, min_exp), 12);
    var ret = "" + (pos / Math.pow(10, exp)).toFixed(places);
    if (suffix && typeof exp_symbols[exp] !== "undefined"){
        ret += " " + exp_symbols[exp] + "b";
    }
    return ret;
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
LocusZoom.createCORSPromise = function (method, url, body, headers, timeout) {
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
                    response.resolve(xhr.response);
                } else {
                    response.reject("HTTP " + xhr.status + " for " + url);
                }
            }
        };
        timeout && setTimeout(response.reject, timeout);
        body = typeof body !== "undefined" ? body : "";
        if (typeof headers !== "undefined"){
            for (var header in headers){
                xhr.setRequestHeader(header, headers[header]);
            }
        }
        // Send the request
        xhr.send(body);
    } 
    return response.promise;
};

// Validate a (presumed complete) state object against internal rules for consistency
// as well as any layout-defined constraints
LocusZoom.validateState = function(new_state, layout){

    new_state = new_state || {};
    layout = layout || {};

    // If a "chr", "start", and "end" are present then resolve start and end
    // to numeric values that are not decimal, negative, or flipped
    var validated_region = false;
    if (typeof new_state.chr != "undefined" && typeof new_state.start != "undefined" && typeof new_state.end != "undefined"){
        // Determine a numeric scale and midpoint for the attempted region,
        var attempted_midpoint = null; var attempted_scale;
        new_state.start = Math.max(parseInt(new_state.start), 1);
        new_state.end = Math.max(parseInt(new_state.end), 1);
        if (isNaN(new_state.start) && isNaN(new_state.end)){
            new_state.start = 1;
            new_state.end = 1;
            attempted_midpoint = 0.5;
            attempted_scale = 0;
        } else if (isNaN(new_state.start) || isNaN(new_state.end)){
            attempted_midpoint = new_state.start || new_state.end;
            attempted_scale = 0;
            new_state.start = (isNaN(new_state.start) ? new_state.end : new_state.start);
            new_state.end = (isNaN(new_state.end) ? new_state.start : new_state.end);
        } else {
            attempted_midpoint = Math.round((new_state.start + new_state.end) / 2);
            attempted_scale = new_state.end - new_state.start;
            if (attempted_scale < 0){
                var temp = new_state.start;
                new_state.end = new_state.start;
                new_state.start = temp;
                attempted_scale = new_state.end - new_state.start;
            }
            if (attempted_midpoint < 0){
                new_state.start = 1;
                new_state.end = 1;
                attempted_scale = 0;
            }
        }
        validated_region = true;
    }

    // Constrain w/r/t layout-defined mininum region scale
    if (!isNaN(layout.min_region_scale) && validated_region && attempted_scale < layout.min_region_scale){
        new_state.start = Math.max(attempted_midpoint - Math.floor(layout.min_region_scale / 2), 1);
        new_state.end = new_state.start + layout.min_region_scale;
    }

    // Constrain w/r/t layout-defined maximum region scale
    if (!isNaN(layout.max_region_scale) && validated_region && attempted_scale > layout.max_region_scale){
        new_state.start = Math.max(attempted_midpoint - Math.floor(layout.max_region_scale / 2), 1);
        new_state.end = new_state.start + layout.max_region_scale;
    }

    return new_state;
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
    var regex, replace;
    for (var field in data) {
        if (!data.hasOwnProperty(field)){ continue; }
        if (typeof data[field] != "string" && typeof data[field] != "number" && typeof data[field] != "boolean" && data[field] != null){ continue; }
        regex = new RegExp("\\{\\{" + field.replace("|","\\|").replace(":","\\:") + "\\}\\}","g");
        replace = (data[field] == null ? "" : data[field]);
        html = html.replace(regex, replace);
    }
    return html;
};

// Shortcut method for getting the data bound to a tool tip.
// Accepts the node object for any element contained within the tool tip.
LocusZoom.getToolTipData = function(node){
    if (typeof node != "object" || typeof node.parentNode == "undefined"){
        throw("Invalid node object");
    }
    // If this node is a locuszoom tool tip then return its data
    var selector = d3.select(node);
    if (selector.classed("lz-data_layer-tooltip") && typeof selector.data()[0] != "undefined"){
        return selector.data()[0];
    } else {
        return LocusZoom.getToolTipData(node.parentNode);
    }
};
