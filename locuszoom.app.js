(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(["postal"], function(d3, Q){
            return (root.LocusZoom = factory(d3, Q));
        });
    } else if(typeof module === "object" && module.exports) {
        module.exports = (root.LocusZoom = factory(require("d3"), require("Q")));
    } else {
        root.LocusZoom = factory(root.d3, root.Q);
    }
}(this, function(d3, Q) {

    var semanticVersionIsOk = function(minimum_version, current_version){
        // handle the trivial case
        if (current_version == minimum_version){ return true; }
        // compare semantic versions by component as integers
        var minimum_version_array = minimum_version.split(".");
        var current_version_array = current_version.split(".");
        var version_is_ok = false;
        minimum_version_array.forEach(function(d, i){
            if (!version_is_ok && +current_version_array[i] > +minimum_version_array[i]){
                version_is_ok = true;
            }
        });
        return version_is_ok;
    };

    try {

        // Verify dependency: d3.js
        var minimum_d3_version = "3.5.6";
        if (typeof d3 != "object"){
            throw("d3 dependency not met. Library missing.");
        }
        if (!semanticVersionIsOk(minimum_d3_version, d3.version)){
            throw("d3 dependency not met. Outdated version detected.\nRequired d3 version: " + minimum_d3_version + " or higher (found: " + d3.version + ").");
        }
        
        // Verify dependency: Q.js
        if (typeof Q != "function"){
            throw("Q dependency not met. Library missing.");
        }

        /* global d3,Q */
/* eslint-env browser */
/* eslint-disable no-console */

var LocusZoom = {
    version: "0.5.4"
};
    
// Populate a single element with a LocusZoom plot.
// selector can be a string for a DOM Query or a d3 selector.
LocusZoom.populate = function(selector, datasource, layout) {
    if (typeof selector == "undefined"){
        throw ("LocusZoom.populate selector not defined");
    }
    // Empty the selector of any existing content
    d3.select(selector).html("");
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
        plot.container = this.node();
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
            .attr("id", plot.id + "_svg").attr("class", "lz-locuszoom")
            .style(plot.layout.style);
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
// using a common datasource and layout
LocusZoom.populateAll = function(selector, datasource, layout) {
    var plots = [];
    d3.selectAll(selector).each(function(d,i) {
        plots[i] = LocusZoom.populate(this, datasource, layout);
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
    // Match all things that look like fields in the HTML
    var matches = html.match(/{{[A-Za-z0-9_:|]+}}/g);
    if (matches){
        // Remove duplicates
        matches.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
        // Replace matches with resolved values from the data object
        matches.forEach(function(match){
            var field = new LocusZoom.Data.Field(match.substring(2, match.length-2));
            var value = field.resolve(data);
            if (["string","number","boolean"].indexOf(typeof value) != -1){
                html = html.replace(match, value);
            } else if (value == null){
                html = html.replace(match, "");
            }
        });
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

// Shortcut method for getting a reference to the data layer that generated a tool tip.
// Accepts the node object for any element contained within the tool tip.
LocusZoom.getToolTipDataLayer = function(node){
    var data = LocusZoom.getToolTipData(node);
    if (data.getDataLayer){ return data.getDataLayer(); }
    return null;
};

// Shortcut method for getting a reference to the panel that generated a tool tip.
// Accepts the node object for any element contained within the tool tip.
LocusZoom.getToolTipPanel = function(node){
    var data_layer = LocusZoom.getToolTipDataLayer(node);
    if (data_layer){ return data_layer.parent; }
    return null;
};

// Shortcut method for getting a reference to the plot that generated a tool tip.
// Accepts the node object for any element contained within the tool tip.
LocusZoom.getToolTipPlot = function(node){
    var panel = LocusZoom.getToolTipPanel(node);
    if (panel){ return panel.parent; }
    return null;
};

// Generate a curtain object for a plot, panel, or any other subdivision of a layout
LocusZoom.generateCurtain = function(){
    var curtain = {
        showing: false,
        selector: null,
        content_selector: null,
        hide_delay: null,
        show: function(content, css){
            // Generate curtain
            if (!this.curtain.showing){
                this.curtain.selector = d3.select(this.parent_plot.svg.node().parentNode).insert("div")
                    .attr("class", "lz-curtain").attr("id", this.id + ".curtain");
                this.curtain.content_selector = this.curtain.selector.append("div").attr("class", "lz-curtain-content");
                this.curtain.selector.append("div").attr("class", "lz-curtain-dismiss").html("Dismiss")
                    .on("click", function(){
                        this.curtain.hide();
                    }.bind(this));
                this.curtain.showing = true;
            }
            return this.curtain.update(content, css);
        }.bind(this),
        update: function(content, css){
            if (!this.curtain.showing){ return this.curtain; }
            clearTimeout(this.curtain.hide_delay);
            // Apply CSS if provided
            if (typeof css == "object"){
                this.curtain.selector.style(css);
            }
            // Update size and position
            var page_origin = this.getPageOrigin();
            this.curtain.selector.style({
                top: page_origin.y + "px",
                left: page_origin.x + "px",
                width: this.layout.width + "px",
                height: this.layout.height + "px"
            });
            this.curtain.content_selector.style({
                "max-width": (this.layout.width - 40) + "px",
                "max-height": (this.layout.height - 40) + "px"
            });
            // Apply content if provided
            if (typeof content == "string"){
                this.curtain.content_selector.html(content);
            }
            return this.curtain;
        }.bind(this),
        hide: function(delay){
            if (!this.curtain.showing){ return this.curtain; }
            // If a delay was passed then defer to a timeout
            if (typeof delay == "number"){
                clearTimeout(this.curtain.hide_delay);
                this.curtain.hide_delay = setTimeout(this.curtain.hide, delay);
                return this.curtain;
            }
            // Remove curtain
            this.curtain.selector.remove();
            this.curtain.selector = null;
            this.curtain.content_selector = null;
            this.curtain.showing = false;
            return this.curtain;
        }.bind(this)
    };
    return curtain;
};

// Generate a loader object for a plot, panel, or any other subdivision of a layout
LocusZoom.generateLoader = function(){
    var loader = {
        showing: false,
        selector: null,
        content_selector: null,
        progress_selector: null,
        cancel_selector: null,
        show: function(content){
            // Generate loader
            if (!this.loader.showing){
                this.loader.selector = d3.select(this.parent_plot.svg.node().parentNode).insert("div")
                    .attr("class", "lz-loader").attr("id", this.id + ".loader");
                this.loader.content_selector = this.loader.selector.append("div")
                    .attr("class", "lz-loader-content");
                this.loader.progress_selector = this.loader.selector
                    .append("div").attr("class", "lz-loader-progress-container")
                    .append("div").attr("class", "lz-loader-progress");
                /* TODO: figure out how to make this cancel button work
                this.loader.cancel_selector = this.loader.selector.append("div")
                    .attr("class", "lz-loader-cancel").html("Cancel")
                    .on("click", function(){
                        this.loader.hide();
                    }.bind(this));
                */
                this.loader.showing = true;
                if (typeof content == "undefined"){ content = "Loading..."; }
            }
            return this.loader.update(content);
        }.bind(this),
        update: function(content, percent){
            if (!this.loader.showing){ return this.loader; }
            clearTimeout(this.loader.hide_delay);
            // Apply content if provided
            if (typeof content == "string"){
                this.loader.content_selector.html(content);
            }
            // Update size and position
            var padding = 6; // is there a better place to store/define this?
            var page_origin = this.getPageOrigin();
            var loader_boundrect = this.loader.selector.node().getBoundingClientRect();
            this.loader.selector.style({
                top: (page_origin.y + this.layout.height - loader_boundrect.height - padding) + "px",
                left: (page_origin.x + padding) + "px"
            });
            /* Uncomment this code when a functional cancel button can be shown
            var cancel_boundrect = this.loader.cancel_selector.node().getBoundingClientRect();
            this.loader.content_selector.style({
                "padding-right": (cancel_boundrect.width + padding) + "px"
            });
            */
            // Apply percent if provided
            if (typeof percent == "number"){
                this.loader.progress_selector.style({
                    width: (Math.min(Math.max(percent, 1), 100)) + "%"
                });
            }
            return this.loader;
        }.bind(this),
        animate: function(){
            // For when it is impossible to update with percent checkpoints - animate the loader in perpetual motion
            this.loader.progress_selector.classed("lz-loader-progress-animated", true);
            return this.loader;
        }.bind(this),
        setPercentCompleted: function(percent){
            this.loader.progress_selector.classed("lz-loader-progress-animated", false);
            return this.loader.update(null, percent);
        }.bind(this),
        hide: function(delay){
            if (!this.loader.showing){ return this.loader; }
            // If a delay was passed then defer to a timeout
            if (typeof delay == "number"){
                clearTimeout(this.loader.hide_delay);
                this.loader.hide_delay = setTimeout(this.loader.hide, delay);
                return this.loader;
            }
            // Remove loader
            this.loader.selector.remove();
            this.loader.selector = null;
            this.loader.content_selector = null;
            this.loader.progress_selector = null;
            this.loader.cancel_selector = null;
            this.loader.showing = false;
            return this.loader;
        }.bind(this)
    };
    return loader;
};

/* global LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

LocusZoom.Layouts = (function() {
    var obj = {};
    var layouts = {
        "plot": {},
        "panel": {},
        "data_layer": {},
        "dashboard": {},
        "tooltip": {}
    };

    obj.get = function(type, name, modifications) {
        if (typeof type != "string" || typeof name != "string") {
            throw("invalid arguments passed to LocusZoom.Layouts.get, requires string (layout type) and string (layout name)");
        } else if (layouts[type][name]) {
            // Get the base layout
            var layout = LocusZoom.Layouts.merge(modifications || {}, layouts[type][name]);
            // If "unnamespaced" is true then strike that from the layout and retutn the layout without namespacing
            if (layout.unnamespaced){
                delete layout.unnamespaced;
                return JSON.parse(JSON.stringify(layout));
            }
            // Determine the default namespace for namespaced values
            var default_namespace = "";
            if (typeof layout.namespace == "string"){
                default_namespace = layout.namespace;
            } else if (typeof layout.namespace == "object" && Object.keys(layout.namespace).length){
                if (typeof layout.namespace.default != "undefined"){
                    default_namespace = layout.namespace.default;
                } else {
                    default_namespace = layout.namespace[Object.keys(layout.namespace)[0]].toString();
                }
            }
            default_namespace += default_namespace.length ? ":" : "";
            // Apply namespaces to layout, recursively
            var applyNamespaces = function(element, namespace){
                if (namespace){
                    if (typeof namespace == "string"){
                        namespace = { default: namespace }; 
                    }
                } else {
                    namespace = { default: "" };
                }
                if (typeof element == "string"){
                    var re = /\{\{namespace(\[[A-Za-z_0-9]+\]|)\}\}/g;
                    var match, base, key, resolved_namespace;
                    var replace = [];
                    while ((match = re.exec(element)) !== null){
                        base = match[0];
                        key  = match[1].length ? match[1].replace(/(\[|\])/g,"") : null;
                        resolved_namespace = default_namespace;
                        if (namespace != null && typeof namespace == "object" && typeof namespace[key] != "undefined"){
                            resolved_namespace = namespace[key] + (namespace[key].length ? ":" : "");
                        }
                        replace.push({ base: base, namespace: resolved_namespace });
                    }
                    for (var r in replace){
                        element = element.replace(replace[r].base, replace[r].namespace);
                    }
                } else if (typeof element == "object" && element != null){
                    if (typeof element.namespace != "undefined"){
                        var merge_namespace = (typeof element.namespace == "string") ? { default: element.namespace } : element.namespace;
                        namespace = LocusZoom.Layouts.merge(namespace, merge_namespace);
                    }
                    var namespaced_element, namespaced_property;
                    for (var property in element) {
                        if (property == "namespace"){ continue; }
                        namespaced_element = applyNamespaces(element[property], namespace);
                        namespaced_property = applyNamespaces(property, namespace);
                        if (property != namespaced_property){
                            delete element[property];
                        }
                        element[namespaced_property] = namespaced_element;
                    }
                }
                return element;
            };
            layout = applyNamespaces(layout, layout.namespace);
            // Return the layout as valid JSON only
            return JSON.parse(JSON.stringify(layout));
        } else {
            throw("layout type [" + type + "] name [" + name + "] not found");
        }
    };

    obj.set = function(type, name, layout) {
        if (typeof type != "string" || typeof name != "string" || typeof layout != "object"){
            throw ("unable to set new layout; bad arguments passed to set()");
        }
        if (!layouts[type]){
            layouts[type] = {};
        }
        if (layout){
            return (layouts[type][name] = JSON.parse(JSON.stringify(layout)));
        } else {
            delete layouts[type][name];
            return null;
        }
    };

    obj.add = function(type, name, layout) {
        return obj.set(type, name, layout);
    };

    obj.list = function(type) {
        if (!layouts[type]){
            var list = {};
            Object.keys(layouts).forEach(function(type){
                list[type] =  Object.keys(layouts[type]);
            });
            return list;
        } else {
            return Object.keys(layouts[type]);
        }
    };

    // Merge any two layout objects
    // Primarily used to merge values from the second argument (the "default" layout) into the first (the "custom" layout)
    // Ensures that all values defined in the second layout are at least present in the first
    // Favors values defined in the first layout if values are defined in both but different
    obj.merge = function (custom_layout, default_layout) {
        if (typeof custom_layout != "object" || typeof default_layout != "object"){
            throw("LocusZoom.Layouts.merge only accepts two layout objects; " + (typeof custom_layout) + ", " + (typeof default_layout) + " given");
        }
        for (var property in default_layout) {
            if (!default_layout.hasOwnProperty(property)){ continue; }
            // Get types for comparison. Treat nulls in the custom layout as undefined for simplicity.
            // (javascript treats nulls as "object" when we just want to overwrite them as if they're undefined)
            // Also separate arrays from objects as a discrete type.
            var custom_type  = custom_layout[property] == null ? "undefined" : typeof custom_layout[property];
            var default_type = typeof default_layout[property];
            if (custom_type == "object" && Array.isArray(custom_layout[property])){ custom_type = "array"; }
            if (default_type == "object" && Array.isArray(default_layout[property])){ default_type = "array"; }
            // Unsupported property types: throw an exception
            if (custom_type == "function" || default_type == "function"){
                throw("LocusZoom.Layouts.merge encountered an unsupported property type");
            }
            // Undefined custom value: pull the default value
            if (custom_type == "undefined"){
                custom_layout[property] = JSON.parse(JSON.stringify(default_layout[property]));
                continue;
            }
            // Both values are objects: merge recursively
            if (custom_type == "object" && default_type == "object"){
                custom_layout[property] = LocusZoom.Layouts.merge(custom_layout[property], default_layout[property]);
                continue;
            }
        }
        return custom_layout;
    };

    return obj;
})();


/**
 Tooltip Layouts
*/

LocusZoom.Layouts.add("tooltip", "standard_association", {
    namespace: { "assoc": "assoc" },
    closable: true,
    show: { or: ["highlighted", "selected"] },
    hide: { and: ["unhighlighted", "unselected"] },
    html: "<strong>{{{{namespace[assoc]}}variant}}</strong><br>"
        + "P Value: <strong>{{{{namespace[assoc]}}log_pvalue|logtoscinotation}}</strong><br>"
        + "Ref. Allele: <strong>{{{{namespace[assoc]}}ref_allele}}</strong><br>"
        + "<a href=\"javascript:void(0);\" onclick=\"LocusZoom.getToolTipDataLayer(this).makeLDReference(LocusZoom.getToolTipData(this));\">Make LD Reference</a><br>"
});

var covariates_model_association = LocusZoom.Layouts.get("tooltip", "standard_association", { unnamespaced: true });
covariates_model_association.html += "<a href=\"javascript:void(0);\" onclick=\"LocusZoom.getToolTipPlot(this).CovariatesModel.add(LocusZoom.getToolTipData(this));\">Condition on Variant</a><br>";
LocusZoom.Layouts.add("tooltip", "covariates_model_association", covariates_model_association);

LocusZoom.Layouts.add("tooltip", "standard_genes", {
    closable: true,
    show: { or: ["highlighted", "selected"] },
    hide: { and: ["unhighlighted", "unselected"] },
    html: "<h4><strong><i>{{gene_name}}</i></strong></h4>"
        + "<div style=\"float: left;\">Gene ID: <strong>{{gene_id}}</strong></div>"
        + "<div style=\"float: right;\">Transcript ID: <strong>{{transcript_id}}</strong></div>"
        + "<div style=\"clear: both;\"></div>"
        + "<table>"
        + "<tr><th>Constraint</th><th>Expected variants</th><th>Observed variants</th><th>Const. Metric</th></tr>"
        + "<tr><td>Synonymous</td><td>{{exp_syn}}</td><td>{{n_syn}}</td><td>z = {{syn_z}}</td></tr>"
        + "<tr><td>Missense</td><td>{{exp_mis}}</td><td>{{n_mis}}</td><td>z = {{mis_z}}</td></tr>"
        + "<tr><td>LoF</td><td>{{exp_lof}}</td><td>{{n_lof}}</td><td>pLI = {{pLI}}</td></tr>"
        + "</table>"
        + "<a href=\"http://exac.broadinstitute.org/gene/{{gene_id}}\" target=\"_new\">More data on ExAC</a>"
});

LocusZoom.Layouts.add("tooltip", "standard_intervals", {
    namespace: { "intervals": "intervals" },
    closable: false,
    show: { or: ["highlighted", "selected"] },
    hide: { and: ["unhighlighted", "unselected"] },
    html: "{{{{namespace[intervals]}}state_name}}<br>{{{{namespace[intervals]}}start}}-{{{{namespace[intervals]}}end}}"
});

/**
 Data Layer Layouts
*/

LocusZoom.Layouts.add("data_layer", "significance", {
    id: "significance",
    type: "orthogonal_line",
    orientation: "horizontal",
    offset: 4.522
});

LocusZoom.Layouts.add("data_layer", "recomb_rate", {
    namespace: { "recomb": "recomb" },
    id: "recombrate",
    type: "line",
    fields: ["{{namespace[recomb]}}position", "{{namespace[recomb]}}recomb_rate"],
    z_index: 1,
    style: {
        "stroke": "#0000FF",
        "stroke-width": "1.5px"
    },
    x_axis: {
        field: "{{namespace[recomb]}}position"
    },
    y_axis: {
        axis: 2,
        field: "{{namespace[recomb]}}recomb_rate",
        floor: 0,
        ceiling: 100
    }
});

LocusZoom.Layouts.add("data_layer", "association_pvalues", {
    namespace: { "assoc": "assoc", "ld": "ld" },
    id: "associationpvalues",
    type: "scatter",
    point_shape: {
        scale_function: "if",
        field: "{{namespace[ld]}}isrefvar",
        parameters: {
            field_value: 1,
            then: "diamond",
            else: "circle"
        }
    },
    point_size: {
        scale_function: "if",
        field: "{{namespace[ld]}}isrefvar",
        parameters: {
            field_value: 1,
            then: 80,
            else: 40
        }
    },
    color: [
        {
            scale_function: "if",
            field: "{{namespace[ld]}}isrefvar",
            parameters: {
                field_value: 1,
                then: "#9632b8"
            }
        },
        {
            scale_function: "numerical_bin",
            field: "{{namespace[ld]}}state",
            parameters: {
                breaks: [0, 0.2, 0.4, 0.6, 0.8],
                values: ["#357ebd","#46b8da","#5cb85c","#eea236","#d43f3a"]
            }
        },
        "#B8B8B8"
    ],
    legend: [
        { shape: "diamond", color: "#9632b8", size: 40, label: "LD Ref Var", class: "lz-data_layer-scatter" },
        { shape: "circle", color: "#d43f3a", size: 40, label: "1.0 > r² ≥ 0.8", class: "lz-data_layer-scatter" },
        { shape: "circle", color: "#eea236", size: 40, label: "0.8 > r² ≥ 0.6", class: "lz-data_layer-scatter" },
        { shape: "circle", color: "#5cb85c", size: 40, label: "0.6 > r² ≥ 0.4", class: "lz-data_layer-scatter" },
        { shape: "circle", color: "#46b8da", size: 40, label: "0.4 > r² ≥ 0.2", class: "lz-data_layer-scatter" },
        { shape: "circle", color: "#357ebd", size: 40, label: "0.2 > r² ≥ 0.0", class: "lz-data_layer-scatter" },
        { shape: "circle", color: "#B8B8B8", size: 40, label: "no r² data", class: "lz-data_layer-scatter" }
    ],
    fields: ["{{namespace[assoc]}}variant", "{{namespace[assoc]}}position", "{{namespace[assoc]}}log_pvalue", "{{namespace[assoc]}}log_pvalue|logtoscinotation", "{{namespace[assoc]}}ref_allele", "{{namespace[ld]}}state", "{{namespace[ld]}}isrefvar"],
    id_field: "{{namespace[assoc]}}variant",
    z_index: 2,
    x_axis: {
        field: "{{namespace[assoc]}}position"
    },
    y_axis: {
        axis: 1,
        field: "{{namespace[assoc]}}log_pvalue",
        floor: 0,
        upper_buffer: 0.10,
        min_extent: [ 0, 10 ]
    },
    behaviors: {
        onmouseover: [
            { action: "set", status: "highlighted" }
        ],
        onmouseout: [
            { action: "unset", status: "highlighted" }
        ],
        onclick: [
            { action: "toggle", status: "selected", exclusive: true }
        ],
        onshiftclick: [
            { action: "toggle", status: "selected" }
        ]
    },
    tooltip: LocusZoom.Layouts.get("tooltip", "standard_association", { unnamespaced: true })
});

LocusZoom.Layouts.add("data_layer", "phewas_pvalues", {
    id: "phewaspvalues",
    type: "scatter",
    point_shape: "circle",
    point_size: 70,
    id_field: "{{namespace}}id",
    fields: ["{{namespace}}phewas"],
    /*
    id_field: "{{namespace}}id",
    fields: ["{{namespace}}id", "{{namespace}}x", "{{namespace}}category_name", "{{namespace}}num_cases", "{{namespace}}num_controls", "{{namespace}}phewas_string", "{{namespace}}phewas_code", "{{namespace}}pval|scinotation", "{{namespace}}pval|neglog10"],
    */
    x_axis: {
        field: "{{namespace}}x"
    },
    y_axis: {
        axis: 1,
        field: "{{namespace}}pval|neglog10",
        floor: 0,
        upper_buffer: 0.1
    },
    color: {
        field: "{{namespace}}category_name",
        scale_function: "categorical_bin",
        parameters: {
            categories: ["infectious diseases", "neoplasms", "endocrine/metabolic", "hematopoietic", "mental disorders", "neurological", "sense organs", "circulatory system", "respiratory", "digestive", "genitourinary", "pregnancy complications", "dermatologic", "musculoskeletal", "congenital anomalies", "symptoms", "injuries & poisonings"],
            values: ["rgb(57,59,121)", "rgb(82,84,163)", "rgb(107,110,207)", "rgb(156,158,222)", "rgb(99,121,57)", "rgb(140,162,82)", "rgb(181,207,107)", "rgb(140,109,49)", "rgb(189,158,57)", "rgb(231,186,82)", "rgb(132,60,57)", "rgb(173,73,74)", "rgb(214,97,107)", "rgb(231,150,156)", "rgb(123,65,115)", "rgb(165,81,148)", "rgb(206,109,189)", "rgb(222,158,214)"],
            null_value: "#B8B8B8"
        }
    },
    fill_opacity: 0.7,
    tooltip: {
        closable: true,
        show: { or: ["highlighted", "selected"] },
        hide: { and: ["unhighlighted", "unselected"] },
        html: "<div><strong>{{{{namespace}}phewas_string}}</strong></div><div>P Value: <strong>{{{{namespace}}pval|scinotation}}</strong></div>"
    },
    behaviors: {
        onmouseover: [
            { action: "set", status: "highlighted" }
        ],
        onmouseout: [
            { action: "unset", status: "highlighted" }
        ],
        onclick: [
            { action: "toggle", status: "selected", exclusive: true }
        ],
        onshiftclick: [
            { action: "toggle", status: "selected" }
        ]
    },
    label: {
        text: "{{{{namespace}}phewas_string}}",
        spacing: 6,
        lines: {
            style: {
                "stroke-width": "2px",
                "stroke": "#333333",
                "stroke-dasharray": "2px 2px"
            }
        },
        filters: [
            {
                field: "{{namespace}}pval|neglog10",
                operator: ">=",
                value: 5
            }
        ],
        style: {
            "font-size": "14px",
            "font-weight": "bold",
            "fill": "#333333"
        }
    }
});

LocusZoom.Layouts.add("data_layer", "genes", {
    namespace: { "gene": "gene", "constraint": "constraint" },
    id: "genes",
    type: "genes",
    fields: ["{{namespace[gene]}}gene", "{{namespace[constraint]}}constraint"],
    id_field: "gene_id",
    behaviors: {
        onmouseover: [
            { action: "set", status: "highlighted" }
        ],
        onmouseout: [
            { action: "unset", status: "highlighted" }
        ],
        onclick: [
            { action: "toggle", status: "selected", exclusive: true }
        ],
        onshiftclick: [
            { action: "toggle", status: "selected" }
        ]
    },
    tooltip: LocusZoom.Layouts.get("tooltip", "standard_genes", { unnamespaced: true })
});

LocusZoom.Layouts.add("data_layer", "genome_legend", {
    namespace: { "genome": "genome" },
    id: "genome_legend",
    type: "genome_legend",
    fields: ["{{namespace[genome]}}chr", "{{namespace[genome]}}base_pairs"],
    x_axis: {
        floor: 0,
        ceiling: 2881033286
    }
});

LocusZoom.Layouts.add("data_layer", "intervals", {
    namespace: { "intervals": "intervals" },
    id: "intervals",
    type: "intervals",
    fields: ["{{namespace[intervals]}}start","{{namespace[intervals]}}end","{{namespace[intervals]}}state_id","{{namespace[intervals]}}state_name"],
    id_field: "{{namespace[intervals]}}start",
    start_field: "{{namespace[intervals]}}start",
    end_field: "{{namespace[intervals]}}end",
    track_split_field: "{{namespace[intervals]}}state_id",
    split_tracks: true,
    always_hide_legend: false,
    color: {
        field: "{{namespace[intervals]}}state_id",
        scale_function: "categorical_bin",
        parameters: {
            categories: [1,2,3,4,5,6,7,8,9,10,11,12,13],
            values: ["rgb(212,63,58)", "rgb(250,120,105)", "rgb(252,168,139)", "rgb(240,189,66)", "rgb(250,224,105)", "rgb(240,238,84)", "rgb(244,252,23)", "rgb(23,232,252)", "rgb(32,191,17)", "rgb(23,166,77)", "rgb(32,191,17)", "rgb(162,133,166)", "rgb(212,212,212)"],
            null_value: "#B8B8B8"
        }
    },
    legend: [
        { shape: "rect", color: "rgb(212,63,58)", width: 9, label: "Active Promoter", "{{namespace[intervals]}}state_id": 1 },
        { shape: "rect", color: "rgb(250,120,105)", width: 9, label: "Weak Promoter", "{{namespace[intervals]}}state_id": 2 },
        { shape: "rect", color: "rgb(252,168,139)", width: 9, label: "Poised Promoter", "{{namespace[intervals]}}state_id": 3 },
        { shape: "rect", color: "rgb(240,189,66)", width: 9, label: "Strong enhancer", "{{namespace[intervals]}}state_id": 4 },
        { shape: "rect", color: "rgb(250,224,105)", width: 9, label: "Strong enhancer", "{{namespace[intervals]}}state_id": 5 },
        { shape: "rect", color: "rgb(240,238,84)", width: 9, label: "Weak enhancer", "{{namespace[intervals]}}state_id": 6 },
        { shape: "rect", color: "rgb(244,252,23)", width: 9, label: "Weak enhancer", "{{namespace[intervals]}}state_id": 7 },
        { shape: "rect", color: "rgb(23,232,252)", width: 9, label: "Insulator", "{{namespace[intervals]}}state_id": 8 },
        { shape: "rect", color: "rgb(32,191,17)", width: 9, label: "Transcriptional transition", "{{namespace[intervals]}}state_id": 9 },
        { shape: "rect", color: "rgb(23,166,77)", width: 9, label: "Transcriptional elongation", "{{namespace[intervals]}}state_id": 10 },
        { shape: "rect", color: "rgb(136,240,129)", width: 9, label: "Weak transcribed", "{{namespace[intervals]}}state_id": 11 },
        { shape: "rect", color: "rgb(162,133,166)", width: 9, label: "Polycomb-repressed", "{{namespace[intervals]}}state_id": 12 },
        { shape: "rect", color: "rgb(212,212,212)", width: 9, label: "Heterochromatin / low signal", "{{namespace[intervals]}}state_id": 13 }
    ],
    behaviors: {
        onmouseover: [
            { action: "set", status: "highlighted" }
        ],
        onmouseout: [
            { action: "unset", status: "highlighted" }
        ],
        onclick: [
            { action: "toggle", status: "selected", exclusive: true }
        ],
        onshiftclick: [
            { action: "toggle", status: "selected" }
        ]
    },
    tooltip: LocusZoom.Layouts.get("tooltip", "standard_intervals", { unnamespaced: true })
});


/**
 Dashboard Layouts
*/

LocusZoom.Layouts.add("dashboard", "standard_panel", {
    components: [
        {
            type: "remove_panel",
            position: "right",
            color: "red",
            group_position: "end"
        },
        {
            type: "move_panel_up",
            position: "right",
            group_position: "middle"
        },
        {
            type: "move_panel_down",
            position: "right",
            group_position: "start",
            style: { "margin-left": "0.75em" }
        }
    ]
});                 

LocusZoom.Layouts.add("dashboard", "standard_plot", {
    components: [
        {
            type: "title",
            title: "LocusZoom",
            subtitle: "<a href=\"https://statgen.github.io/locuszoom/\" target=\"_blank\">v" + LocusZoom.version + "</a>",
            position: "left"
        },
        {
            type: "dimensions",
            position: "right"
        },
        {
            type: "region_scale",
            position: "right"
        },
        {
            type: "download",
            position: "right"
        }
    ]
});

var covariates_model_plot_dashboard = LocusZoom.Layouts.get("dashboard", "standard_plot");
covariates_model_plot_dashboard.components.push({
    type: "covariates_model",
    button_html: "Model",
    button_title: "Show and edit covariates currently in model",
    position: "left"
});
LocusZoom.Layouts.add("dashboard", "covariates_model_plot", covariates_model_plot_dashboard);

var region_nav_plot_dashboard = LocusZoom.Layouts.get("dashboard", "standard_plot");
region_nav_plot_dashboard.components.push({
    type: "shift_region",
    step: 500000,
    button_html: ">>",
    position: "right",
    group_position: "end"
});
region_nav_plot_dashboard.components.push({
    type: "shift_region",
    step: 50000,
    button_html: ">",
    position: "right",
    group_position: "middle"
});
region_nav_plot_dashboard.components.push({
    type: "zoom_region",
    step: 0.2,
    position: "right",
    group_position: "middle"
});
region_nav_plot_dashboard.components.push({
    type: "zoom_region",
    step: -0.2,
    position: "right",
    group_position: "middle"
});
region_nav_plot_dashboard.components.push({
    type: "shift_region",
    step: -50000,
    button_html: "<",
    position: "right",
    group_position: "middle"
});
region_nav_plot_dashboard.components.push({
    type: "shift_region",
    step: -500000,
    button_html: "<<",
    position: "right",
    group_position: "start"
});
LocusZoom.Layouts.add("dashboard", "region_nav_plot", region_nav_plot_dashboard);

/**
 Panel Layouts
*/

LocusZoom.Layouts.add("panel", "association", {
    id: "association",
    width: 800,
    height: 225,
    min_width:  400,
    min_height: 200,
    proportional_width: 1,
    margin: { top: 35, right: 50, bottom: 40, left: 50 },
    inner_border: "rgb(210, 210, 210)",
    dashboard: (function(){
        var l = LocusZoom.Layouts.get("dashboard", "standard_panel", { unnamespaced: true });
        l.components.push({
            type: "toggle_legend",
            position: "right"
        });
        return l;
    })(),
    axes: {
        x: {
            label: "Chromosome {{chr}} (Mb)",
            label_offset: 32,
            tick_format: "region",
            extent: "state"
        },
        y1: {
            label: "-log10 p-value",
            label_offset: 28
        },
        y2: {
            label: "Recombination Rate (cM/Mb)",
            label_offset: 40
        }
    },
    legend: {
        orientation: "vertical",
        origin: { x: 55, y: 40 },
        hidden: true
    },
    interaction: {
        drag_background_to_pan: true,
        drag_x_ticks_to_scale: true,
        drag_y1_ticks_to_scale: true,
        drag_y2_ticks_to_scale: true,
        scroll_to_zoom: true,
        x_linked: true
    },
    data_layers: [
        LocusZoom.Layouts.get("data_layer", "significance", { unnamespaced: true }),
        LocusZoom.Layouts.get("data_layer", "recomb_rate", { unnamespaced: true }),
        LocusZoom.Layouts.get("data_layer", "association_pvalues", { unnamespaced: true })
    ]
});

LocusZoom.Layouts.add("panel", "genes", {
    id: "genes",
    width: 800,
    height: 225,
    min_width: 400,
    min_height: 112.5,
    proportional_width: 1,
    margin: { top: 20, right: 50, bottom: 20, left: 50 },
    axes: {},
    interaction: {
        drag_background_to_pan: true,
        scroll_to_zoom: true,
        x_linked: true
    },
    dashboard: (function(){
        var l = LocusZoom.Layouts.get("dashboard", "standard_panel", { unnamespaced: true });
        l.components.push({
            type: "resize_to_data",
            position: "right"
        });
        return l;
    })(),   
    data_layers: [
        LocusZoom.Layouts.get("data_layer", "genes", { unnamespaced: true })
    ]
});

LocusZoom.Layouts.add("panel", "phewas", {
    id: "phewas",
    width: 800,
    height: 300,
    min_width:  800,
    min_height: 300,
    proportional_width: 1,
    margin: { top: 20, right: 50, bottom: 120, left: 50 },
    inner_border: "rgb(210, 210, 210)",
    axes: {
        x: {
            ticks: [
                {
                    x: 0,
                    text: "Infectious Disease",
                    style: {
                        "fill": "#393b79",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 44,
                    text: "Neoplasms",
                    style: {
                        "fill": "#5254a3",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 174,
                    text: "Endocrine/Metabolic",
                    style: {
                        "fill": "#6b6ecf",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 288,
                    text: "Hematopoietic",
                    style: {
                        "fill": "#9c9ede",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 325,
                    text: "Mental Disorders",
                    style: {
                        "fill": "#637939",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 384,
                    text: "Neurological",
                    style: {
                        "fill": "#8ca252",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 451,
                    text: "Sense Organs",
                    style: {
                        "fill": "#b5cf6b",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 558,
                    text: "Circulatory System",
                    style: {
                        "fill": "#8c6d31",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 705,
                    text: "Respiratory",
                    style: {
                        "fill": "#bd9e39",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 778,
                    text: "Digestive",
                    style: {
                        "fill": "#e7ba52",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 922,
                    text: "Genitourinary",
                    style: {
                        "fill": "#843c39",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 1073,
                    text: "Pregnancy Complications",
                    style: {
                        "fill": "#ad494a",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 1097,
                    text: "Dermatologic",
                    style: {
                        "fill": "#d6616b",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 1170,
                    text: "Musculoskeletal",
                    style: {
                        "fill": "#e7969c",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 1282,
                    text: "Congenital Anomalies",
                    style: {
                        "fill": "#7b4173",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 1323,
                    text: "Symptoms",
                    style: {
                        "fill": "#a55194",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                },
                {
                    x: 1361,
                    text: "Injuries & Poisonings",
                    style: {
                        "fill": "#ce6dbd",
                        "font-weight": "bold",
                        "font-size": "11px",
                        "text-anchor": "start"
                    },
                    transform: "translate(15, 0) rotate(50)"
                }
            ]
        },
        y1: {
            label: "-log10 p-value",
            label_offset: 28
        }
    },
    data_layers: [
        LocusZoom.Layouts.get("data_layer", "significance", { unnamespaced: true }),
        LocusZoom.Layouts.get("data_layer", "phewas_pvalues", { unnamespaced: true })
    ]
});

LocusZoom.Layouts.add("panel", "genome_legend", {
    id: "genome_legend",
    width: 800,
    height: 50,
    origin: { x: 0, y: 300 },
    min_width:  800,
    min_height: 50,
    proportional_width: 1,
    margin: { top: 0, right: 50, bottom: 35, left: 50 },
    axes: {
        x: {
            label: "Genomic Position (number denotes chromosome)",
            label_offset: 35,
            ticks: [
                {
                    x: 124625310,
                    text: "1",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 370850307,
                    text: "2",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 591461209,
                    text: "3",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 786049562,
                    text: "4",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 972084330,
                    text: "5",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 1148099493,
                    text: "6",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 1313226358,
                    text: "7",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 1465977701,
                    text: "8",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 1609766427,
                    text: "9",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 1748140516,
                    text: "10",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 1883411148,
                    text: "11",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2017840353,
                    text: "12",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2142351240,
                    text: "13",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2253610949,
                    text: "14",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2358551415,
                    text: "15",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2454994487,
                    text: "16",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2540769469,
                    text: "17",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2620405698,
                    text: "18",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2689008813,
                    text: "19",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2750086065,
                    text: "20",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2805663772,
                    text: "21",
                    style: {
                        "fill": "rgb(120, 120, 186)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                },
                {
                    x: 2855381003,
                    text: "22",
                    style: {
                        "fill": "rgb(0, 0, 66)",
                        "text-anchor": "center",
                        "font-size": "13px",
                        "font-weight": "bold"
                    },
                    transform: "translate(0, 2)"
                }
            ]
        }
    },
    data_layers: [
        LocusZoom.Layouts.get("data_layer", "genome_legend", { unnamespaced: true })
    ]
});

LocusZoom.Layouts.add("panel", "intervals", {
    id: "intervals",
    width: 1000,
    height: 50,
    min_width: 500,
    min_height: 50,
    margin: { top: 25, right: 150, bottom: 5, left: 50 },
    dashboard: (function(){
        var l = LocusZoom.Layouts.get("dashboard", "standard_panel", { unnamespaced: true });
        l.components.push({
            type: "toggle_split_tracks",
            data_layer_id: "intervals",
            position: "right"
        });
        return l;
    })(),
    axes: {},
    interaction: {
        drag_background_to_pan: true,
        scroll_to_zoom: true,
        x_linked: true
    },
    legend: {
        hidden: true,
        orientation: "horizontal",
        origin: { x: 50, y: 0 },
        pad_from_bottom: 5
    },
    data_layers: [
        LocusZoom.Layouts.get("data_layer", "intervals", { unnamespaced: true })
    ]
});


/**
 Plot Layouts
*/

LocusZoom.Layouts.add("plot", "standard_association", {
    state: {},
    width: 800,
    height: 450,
    responsive_resize: true,
    min_region_scale: 20000,
    max_region_scale: 1000000,
    dashboard: LocusZoom.Layouts.get("dashboard", "standard_plot", { unnamespaced: true }),
    panels: [
        LocusZoom.Layouts.get("panel", "association", { unnamespaced: true, proportional_height: 0.5 }),
        LocusZoom.Layouts.get("panel", "genes", { unnamespaced: true, proportional_height: 0.5 })
    ]
});

// Shortcut to "StandardLayout" for backward compatibility
LocusZoom.StandardLayout = LocusZoom.Layouts.get("plot", "standard_association");

LocusZoom.Layouts.add("plot", "standard_phewas", {
    width: 800,
    height: 600,
    min_width: 800,
    min_height: 600,
    responsive_resize: true,
    dashboard: LocusZoom.Layouts.get("dashboard", "standard_plot", { unnamespaced: true } ),
    panels: [
        LocusZoom.Layouts.get("panel", "phewas", { unnamespaced: true, proportional_height: 0.45 }),
        LocusZoom.Layouts.get("panel", "genome_legend", { unnamespaced: true, proportional_height: 0.1 }),
        LocusZoom.Layouts.get("panel", "genes", {
            unnamespaced: true, proportional_height: 0.45,
            margin: { bottom: 40 },
            axes: {
                x: {
                    label: "Chromosome {{chr}} (Mb)",
                    label_offset: 32,
                    tick_format: "region",
                    extent: "state"
                }
            }
        })
    ]
});

LocusZoom.Layouts.add("plot", "interval_association", {
    state: {},
    width: 800,
    height: 550,
    responsive_resize: true,
    min_region_scale: 20000,
    max_region_scale: 1000000,
    dashboard: LocusZoom.Layouts.get("dashboard", "standard_plot", { unnamespaced: true }),
    panels: [
        LocusZoom.Layouts.get("panel", "association", { unnamespaced: true, width: 800, proportional_height: (225/570) }),
        LocusZoom.Layouts.get("panel", "intervals", { unnamespaced: true, proportional_height: (120/570) }),
        LocusZoom.Layouts.get("panel", "genes", { unnamespaced: true, width: 800, proportional_height: (225/570) })
    ]
});

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Data Layer Class

  A data layer is an abstract class representing a data set and its
  graphical representation within a panel

*/

LocusZoom.DataLayer = function(layout, parent) {

    this.initialized = false;
    this.layout_idx = null;

    this.id     = null;
    this.parent = parent || null;
    this.svg    = {};

    this.parent_plot = null;
    if (typeof parent != "undefined" && parent instanceof LocusZoom.Panel){ this.parent_plot = parent.parent; }

    this.layout = LocusZoom.Layouts.merge(layout || {}, LocusZoom.DataLayer.DefaultLayout);
    if (this.layout.id){ this.id = this.layout.id; }

    // Ensure any axes defined in the layout have an explicit axis number (default: 1)
    if (this.layout.x_axis != {} && typeof this.layout.x_axis.axis != "number"){ this.layout.x_axis.axis = 1; }
    if (this.layout.y_axis != {} && typeof this.layout.y_axis.axis != "number"){ this.layout.y_axis.axis = 1; }

    // Define state parameters specific to this data layer
    if (this.parent){
        this.state = this.parent.state;
        this.state_id = this.parent.id + "." + this.id;
        this.state[this.state_id] = this.state[this.state_id] || {};
        LocusZoom.DataLayer.Statuses.adjectives.forEach(function(status){
            this.state[this.state_id][status] = this.state[this.state_id][status] || [];
        }.bind(this));
    } else {
        this.state = {};
        this.state_id = null;
    }

    // Initialize parameters for storing data and tool tips
    this.data = [];
    if (this.layout.tooltip){
        this.tooltips = {};
    }

    // Initialize flags for tracking global statuses
    this.global_statuses = {
        "highlighted": false,
        "selected": false,
        "faded": false,
        "hidden": false
    };
    
    return this;

};

LocusZoom.DataLayer.DefaultLayout = {
    type: "",
    fields: [],
    x_axis: {},
    y_axis: {}
};

// Available statuses that individual elements can have. Each status is described by
// a verb/antiverb and an adjective. Verbs and antiverbs are used to generate data layer
// methods for updating the status on one or more elements. Adjectives are used in class
// names and applied or removed from elements to have a visual representation of the status,
// as well as used as keys in the state for tracking which elements are in which status(es)
LocusZoom.DataLayer.Statuses = {
    verbs: ["highlight", "select", "fade", "hide"],
    adjectives: ["highlighted", "selected", "faded", "hidden"],
    menu_antiverbs: ["unhighlight", "deselect", "unfade", "show"]
};

LocusZoom.DataLayer.prototype.getBaseId = function(){
    return this.parent_plot.id + "." + this.parent.id + "." + this.id;
};

LocusZoom.DataLayer.prototype.getAbsoluteDataHeight = function(){
    var dataBCR = this.svg.group.node().getBoundingClientRect();
    return dataBCR.height;
};

LocusZoom.DataLayer.prototype.canTransition = function(){
    if (!this.layout.transition){ return false; }
    return !(this.parent_plot.panel_boundaries.dragging || this.parent_plot.interaction.panel_id);
};

LocusZoom.DataLayer.prototype.getElementId = function(element){
    var element_id = "element";
    if (typeof element == "string"){
        element_id = element;
    } else if (typeof element == "object"){
        var id_field = this.layout.id_field || "id";
        if (typeof element[id_field] == "undefined"){
            throw("Unable to generate element ID");
        }
        element_id = element[id_field].toString().replace(/\W/g,"");
    }
    return (this.getBaseId() + "-" + element_id).replace(/(:|\.|\[|\]|,)/g, "_");
};

LocusZoom.DataLayer.prototype.getElementById = function(id){
    var selector = d3.select("#" + id.replace(/(:|\.|\[|\]|,)/g, "\\$1"));
    if (!selector.empty() && selector.data() && selector.data().length){
        return selector.data()[0];
    } else {
        return null;
    }
};

// Basic method to apply arbitrary methods and properties to data elements.
// This is called on all data immediately after being fetched.
LocusZoom.DataLayer.prototype.applyDataMethods = function(){
    this.data.forEach(function(d, i){
        // Basic toHTML() method - return the stringified value in the id_field, if defined.
        this.data[i].toHTML = function(){
            var id_field = this.layout.id_field || "id";
            var html = "";
            if (this.data[i][id_field]){ html = this.data[i][id_field].toString(); }
            return html;
        }.bind(this);
        // getDataLayer() method - return a reference to the data layer
        this.data[i].getDataLayer = function(){
            return this;
        }.bind(this);
        // deselect() method - shortcut method to deselect the element
        this.data[i].deselect = function(){
            var data_layer = this.getDataLayer();
            data_layer.unselectElement(this);
        };
    }.bind(this));
    this.applyCustomDataMethods();
    return this;
};

// Arbitrarily advanced method to apply methods and properties to data elements.
// May be implemented by data layer classes as needed to do special things.
LocusZoom.DataLayer.prototype.applyCustomDataMethods = function(){
    return this;
};

// Initialize a data layer
LocusZoom.DataLayer.prototype.initialize = function(){

    // Append a container group element to house the main data layer group element and the clip path
    this.svg.container = this.parent.svg.group.append("g")
        .attr("class", "lz-data_layer-container")
        .attr("id", this.getBaseId() + ".data_layer_container");
        
    // Append clip path to the container element
    this.svg.clipRect = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip")
        .append("rect");
    
    // Append svg group for rendering all data layer elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".data_layer")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    return this;

};

// Move a data layer up relative to others by z-index
LocusZoom.DataLayer.prototype.moveUp = function(){
    if (this.parent.data_layer_ids_by_z_index[this.layout.z_index + 1]){
        this.parent.data_layer_ids_by_z_index[this.layout.z_index] = this.parent.data_layer_ids_by_z_index[this.layout.z_index + 1];
        this.parent.data_layer_ids_by_z_index[this.layout.z_index + 1] = this.id;
        this.parent.resortDataLayers();
    }
    return this;
};

// Move a data layer down relative to others by z-index
LocusZoom.DataLayer.prototype.moveDown = function(){
    if (this.parent.data_layer_ids_by_z_index[this.layout.z_index - 1]){
        this.parent.data_layer_ids_by_z_index[this.layout.z_index] = this.parent.data_layer_ids_by_z_index[this.layout.z_index - 1];
        this.parent.data_layer_ids_by_z_index[this.layout.z_index - 1] = this.id;
        this.parent.resortDataLayers();
    }
    return this;
};

// Resolve a scalable parameter for an element into a single value based on its layout and the element's data
LocusZoom.DataLayer.prototype.resolveScalableParameter = function(layout, data){
    var ret = null;
    if (Array.isArray(layout)){
        var idx = 0;
        while (ret == null && idx < layout.length){
            ret = this.resolveScalableParameter(layout[idx], data);
            idx++;
        }
    } else {
        switch (typeof layout){
        case "number":
        case "string":
            ret = layout;
            break;
        case "object":
            if (layout.scale_function && layout.field) {
                var f = new LocusZoom.Data.Field(layout.field);
                ret = LocusZoom.ScaleFunctions.get(layout.scale_function, layout.parameters || {}, f.resolve(data));
            }
            break;
        }
    }
    return ret;
};

// Generate dimension extent function based on layout parameters
LocusZoom.DataLayer.prototype.getAxisExtent = function(dimension){

    if (["x", "y"].indexOf(dimension) == -1){
        throw("Invalid dimension identifier passed to LocusZoom.DataLayer.getAxisExtent()");
    }

    var axis = dimension + "_axis";

    // If a floor AND a ceiling are explicitly defined then just return that extent and be done
    if (!isNaN(this.layout[axis].floor) && !isNaN(this.layout[axis].ceiling)){
        return [+this.layout[axis].floor, +this.layout[axis].ceiling];
    }

    // If a field is defined for the axis and the data layer has data then generate the extent from the data set
    if (this.layout[axis].field && this.data && this.data.length){

        var extent = d3.extent(this.data, function(d) {
            var f = new LocusZoom.Data.Field(this.layout[axis].field);
            return +f.resolve(d);
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

    }

    // If this is for the x axis and no extent could be generated yet but state has a defined start and end
    // then default to using the state-defined region as the extent
    if (dimension == "x" && !isNaN(this.state.start) && !isNaN(this.state.end)) {
        return [this.state.start, this.state.end];
    }

    // No conditions met for generating a valid extent, return an empty array
    return [];

};

// Generate a tool tip for a given element
LocusZoom.DataLayer.prototype.createTooltip = function(d, id){
    if (typeof this.layout.tooltip != "object"){
        throw ("DataLayer [" + this.id + "] layout does not define a tooltip");
    }
    if (typeof id == "undefined"){ id = this.getElementId(d); }
    if (this.tooltips[id]){
        this.positionTooltip(id);
        return;
    }
    this.tooltips[id] = {
        data: d,
        arrow: null,
        selector: d3.select(this.parent_plot.svg.node().parentNode).append("div")
            .attr("class", "lz-data_layer-tooltip")
            .attr("id", id + "-tooltip")
    };
    this.updateTooltip(d);
    return this;
};

// Update a tool tip (generate its inner HTML)
LocusZoom.DataLayer.prototype.updateTooltip = function(d, id){
    if (typeof id == "undefined"){ id = this.getElementId(d); }
    // Empty the tooltip of all HTML (including its arrow!)
    this.tooltips[id].selector.html("");
    this.tooltips[id].arrow = null;
    // Set the new HTML
    if (this.layout.tooltip.html){
        this.tooltips[id].selector.html(LocusZoom.parseFields(d, this.layout.tooltip.html));
    }
    // If the layout allows tool tips on this data layer to be closable then add the close button
    // and add padding to the tooltip to accomodate it
    if (this.layout.tooltip.closable){
        this.tooltips[id].selector.style("padding-right", "24px");
        this.tooltips[id].selector.append("button")
            .attr("class", "lz-tooltip-close-button")
            .attr("title", "Close")
            .text("×")
            .on("click", function(){
                this.destroyTooltip(id);
            }.bind(this));
    }
    // Apply data directly to the tool tip for easier retrieval by custom UI elements inside the tool tip
    this.tooltips[id].selector.data([d]);
    // Reposition and draw a new arrow
    this.positionTooltip(id);
    return this;
};

// Destroy tool tip - remove the tool tip element from the DOM and delete the tool tip's record on the data layer
LocusZoom.DataLayer.prototype.destroyTooltip = function(d, id){
    if (typeof d == "string"){
        id = d;
    } else if (typeof id == "undefined"){
        id = this.getElementId(d);
    }
    if (this.tooltips[id]){
        if (typeof this.tooltips[id].selector == "object"){
            this.tooltips[id].selector.remove();
        }
        delete this.tooltips[id];
    }
    return this;
};

// Loop through and destroy all tool tips on this data layer
LocusZoom.DataLayer.prototype.destroyAllTooltips = function(){
    for (var id in this.tooltips){
        this.destroyTooltip(id);
    }
    return this;
};

// Position tool tip - naïve function to place a tool tip to the lower right of the current mouse element
// Most data layers reimplement this method to position tool tips specifically for the data they display
LocusZoom.DataLayer.prototype.positionTooltip = function(id){
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
    return this;
};

// Loop through and position all tool tips on this data layer
LocusZoom.DataLayer.prototype.positionAllTooltips = function(){
    for (var id in this.tooltips){
        this.positionTooltip(id);
    }
    return this;
};

// Show or hide a tool tip by ID depending on directives in the layout and state values relative to the ID
LocusZoom.DataLayer.prototype.showOrHideTooltip = function(element){
    
    if (typeof this.layout.tooltip != "object"){ return; }
    var id = this.getElementId(element);

    var resolveStatus = function(statuses, directive, operator){
        var status = null;
        if (typeof statuses != "object" || statuses == null){ return null; }
        if (Array.isArray(directive)){
            if (typeof operator == "undefined"){ operator = "and"; }
            if (directive.length == 1){
                status = statuses[directive[0]];
            } else {
                status = directive.reduce(function(previousValue, currentValue) {
                    if (operator == "and"){
                        return statuses[previousValue] && statuses[currentValue];
                    } else if (operator == "or"){
                        return statuses[previousValue] || statuses[currentValue];
                    }
                    return null;
                });
            }
        } else if (typeof directive == "object"){
            var sub_status;
            for (var sub_operator in directive){
                sub_status = resolveStatus(statuses, directive[sub_operator], sub_operator);
                if (status == null){
                    status = sub_status;
                } else if (operator == "and"){
                    status = status && sub_status;
                } else if (operator == "or"){
                    status = status || sub_status;
                }
            }
        }
        return status;
    };

    var show_directive = {};
    if (typeof this.layout.tooltip.show == "string"){
        show_directive = { and: [ this.layout.tooltip.show ] };
    } else if (typeof this.layout.tooltip.show == "object"){
        show_directive = this.layout.tooltip.show;
    }

    var hide_directive = {};
    if (typeof this.layout.tooltip.hide == "string"){
        hide_directive = { and: [ this.layout.tooltip.hide ] };
    } else if (typeof this.layout.tooltip.hide == "object"){
        hide_directive = this.layout.tooltip.hide;
    }

    var statuses = {};
    LocusZoom.DataLayer.Statuses.adjectives.forEach(function(status){
        var antistatus = "un" + status;
        statuses[status] = this.state[this.state_id][status].indexOf(id) != -1;
        statuses[antistatus] = !statuses[status];
    }.bind(this));

    var show_resolved = resolveStatus(statuses, show_directive);
    var hide_resolved = resolveStatus(statuses, hide_directive);

    // Only show tooltip if the resolved logic explicitly shows and explicitly not hides the tool tip
    // Otherwise ensure tooltip does not exist
    if (show_resolved && !hide_resolved){
        this.createTooltip(element);
    } else {
        this.destroyTooltip(element);
    }

    return this;
    
};

// Get an array of element indexes matching a set of filters
// Filters should be of the form [field, value] (for equivalence testing) or [field, operator, value]
// Return type can be "indexes" or "elements" and determines whether the returned array contains
// indexes of matching elements in the data layer's data set or references to the matching elements
LocusZoom.DataLayer.prototype.filter = function(filters, return_type){
    if (typeof return_type == "undefined" || ["indexes","elements"].indexOf(return_type) == -1){
        return_type = "indexes";
    }
    if (!Array.isArray(filters)){ return []; }
    var test = function(element, filter){
        var operators = {
            "=": function(a,b){ return a == b; },
            "<": function(a,b){ return a < b; },
            "<=": function(a,b){ return a <= b; },
            ">": function(a,b){ return a > b; },
            ">=": function(a,b){ return a >= b; },
            "%": function(a,b){ return a % b; }
        };
        if (!Array.isArray(filter)){ return false; }
        if (filter.length == 2){
            return element[filter[0]] == filter[1];
        } else if (filter.length == 3 && operators[filter[1]]){
            return operators[filter[1]](element[filter[0]], filter[2]);
        } else {
            return false;
        }
    };
    var matches = [];
    this.data.forEach(function(element, idx){
        var match = true;
        filters.forEach(function(filter){
            if (!test(element, filter)){ match = false; }
        });
        if (match){ matches.push(return_type == "indexes" ? idx : element); }
    });
    return matches;
};
LocusZoom.DataLayer.prototype.filterIndexes = function(filters){ return this.filter(filters, "indexes"); };
LocusZoom.DataLayer.prototype.filterElements = function(filters){ return this.filter(filters, "elements"); };

LocusZoom.DataLayer.Statuses.verbs.forEach(function(verb, idx){
    var adjective = LocusZoom.DataLayer.Statuses.adjectives[idx];
    var antiverb = "un" + verb;
    // Set/unset a single element's status
    LocusZoom.DataLayer.prototype[verb + "Element"] = function(element, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        this.setElementStatus(adjective, element, true, exclusive);
        return this;
    };
    LocusZoom.DataLayer.prototype[antiverb + "Element"] = function(element, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        this.setElementStatus(adjective, element, false, exclusive);
        return this;
    };
    // Set/unset status for arbitrarily many elements given a set of filters
    LocusZoom.DataLayer.prototype[verb + "ElementsByFilters"] = function(filters, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        return this.setElementStatusByFilters(adjective, true, filters, exclusive);
    };
    LocusZoom.DataLayer.prototype[antiverb + "ElementsByFilters"] = function(filters, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        return this.setElementStatusByFilters(adjective, false, filters, exclusive);
    };
    // Set/unset status for all elements
    LocusZoom.DataLayer.prototype[verb + "AllElements"] = function(){
        this.setAllElementStatus(adjective, true);
        return this;
    };
    LocusZoom.DataLayer.prototype[antiverb + "AllElements"] = function(){
        this.setAllElementStatus(adjective, false);
        return this;
    };
});

// Toggle a status (e.g. highlighted, selected, identified) on an element
LocusZoom.DataLayer.prototype.setElementStatus = function(status, element, toggle, exclusive){
    
    // Sanity checks
    if (typeof status == "undefined" || LocusZoom.DataLayer.Statuses.adjectives.indexOf(status) == -1){
        throw("Invalid status passed to DataLayer.setElementStatus()");
    }
    if (typeof element == "undefined"){
        throw("Invalid element passed to DataLayer.setElementStatus()");
    }
    if (typeof toggle == "undefined"){
        toggle = true;
    }

    // Get an ID for the elment or return having changed nothing
    try {
        var element_id = this.getElementId(element);
    } catch (get_element_id_error){
        return this;
    }

    // Enforce exlcusivity (force all elements to have the opposite of toggle first)
    if (exclusive){
        this.setAllElementStatus(status, !toggle);
    }
    
    // Set/unset the proper status class on the appropriate DOM element(s)
    d3.select("#" + element_id).classed("lz-data_layer-" + this.layout.type + "-" + status, toggle);
    if (this.layout.hover_element){
        var hover_element_class = "lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + "-" + status;
        var selector = d3.select("#" + element_id + "_" + this.layout.hover_element);
        if (this.layout.group_hover_elements_on_field){
            selector = this.group_hover_elements[element[this.layout.group_hover_elements_on_field]];
        }
        selector.classed(hover_element_class, toggle);
    }
    
    // Track element ID in the proper status state array
    var element_status_idx = this.state[this.state_id][status].indexOf(element_id);
    if (toggle && element_status_idx == -1){
        this.state[this.state_id][status].push(element_id);
    }
    if (!toggle && element_status_idx != -1){
        this.state[this.state_id][status].splice(element_status_idx, 1);
    }
    
    // Trigger tool tip show/hide logic
    this.showOrHideTooltip(element);

    // Trigger layout changed event hook
    this.parent.emit("layout_changed");
    this.parent_plot.emit("layout_changed");

    return this;
    
};

// Toggle a status on elements in the data layer based on a set of filters
LocusZoom.DataLayer.prototype.setElementStatusByFilters = function(status, toggle, filters, exclusive){
    
    // Sanity check
    if (typeof status == "undefined" || LocusZoom.DataLayer.Statuses.adjectives.indexOf(status) == -1){
        throw("Invalid status passed to DataLayer.setElementStatusByFilters()");
    }
    if (typeof this.state[this.state_id][status] == "undefined"){ return this; }
    if (typeof toggle == "undefined"){ toggle = true; } else { toggle = !!toggle; }
    if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
    if (!Array.isArray(filters)){ filters = []; }

    // Enforce exlcusivity (force all elements to have the opposite of toggle first)
    if (exclusive){
        this.setAllElementStatus(status, !toggle);
    }
    
    // Apply statuses
    this.filterElements(filters).forEach(function(element){
        this.setElementStatus(status, element, toggle);
    }.bind(this));
    
    return this;
};

// Toggle a status on all elements in the data layer
LocusZoom.DataLayer.prototype.setAllElementStatus = function(status, toggle){
    
    // Sanity check
    if (typeof status == "undefined" || LocusZoom.DataLayer.Statuses.adjectives.indexOf(status) == -1){
        throw("Invalid status passed to DataLayer.setAllElementStatus()");
    }
    if (typeof this.state[this.state_id][status] == "undefined"){ return this; }
    if (typeof toggle == "undefined"){ toggle = true; }

    // Apply statuses
    if (toggle){
        this.data.forEach(function(element){
            this.setElementStatus(status, element, true);
        }.bind(this));
    } else {
        var status_ids = this.state[this.state_id][status].slice();
        status_ids.forEach(function(id){
            var element = this.getElementById(id);
            if (typeof element == "object" && element != null){
                this.setElementStatus(status, element, false);
            }
        }.bind(this));
        this.state[this.state_id][status] = [];
    }

    // Update global status flag
    this.global_statuses[status] = toggle;

    return this;
};

// Apply all layout-defined behaviors to a selection of elements with event handlers
LocusZoom.DataLayer.prototype.applyBehaviors = function(selection){
    if (typeof this.layout.behaviors != "object"){ return; }
    Object.keys(this.layout.behaviors).forEach(function(directive){
        var event_match = /(click|mouseover|mouseout)/.exec(directive);
        if (!event_match){ return; }
        selection.on(event_match[0] + "." + directive, this.executeBehaviors(directive, this.layout.behaviors[directive]));
    }.bind(this));
};

// Generate a function that executes the an arbitrary list of behaviors on an element during an event
LocusZoom.DataLayer.prototype.executeBehaviors = function(directive, behaviors) {

    // Determine the required state of control and shift keys during the event
    var requiredKeyStates = {
        "ctrl": (directive.indexOf("ctrl") != -1),
        "shift": (directive.indexOf("shift") != -1)
    };

    // Return a function that handles the event in context with the behavior and the element
    return function(element){

        // Do nothing if the required control and shift key presses (or lack thereof) doesn't match the event
        if (requiredKeyStates.ctrl != !!d3.event.ctrlKey || requiredKeyStates.shift != !!d3.event.shiftKey){ return; }

        // Loop through behaviors making each one go in succession
        behaviors.forEach(function(behavior){
            
            // Route first by the action, if defined
            if (typeof behavior != "object" || behavior == null){ return; }
            
            switch (behavior.action){
                
            // Set a status (set to true regardless of current status, optionally with exclusivity)
            case "set":
                this.setElementStatus(behavior.status, element, true, behavior.exclusive);
                break;
                
            // Unset a status (set to false regardless of current status, optionally with exclusivity)
            case "unset":
                this.setElementStatus(behavior.status, element, false, behavior.exclusive);
                break;
                
            // Toggle a status
            case "toggle":
                var current_status_boolean = (this.state[this.state_id][behavior.status].indexOf(this.getElementId(element)) != -1);
                var exclusive = behavior.exclusive && !current_status_boolean;
                this.setElementStatus(behavior.status, element, !current_status_boolean, exclusive);
                break;
                
            // Link to a dynamic URL
            case "link":
                if (typeof behavior.href == "string"){
                    var url = LocusZoom.parseFields(element, behavior.href);
                    if (typeof behavior.target == "string"){
                        window.open(url, behavior.target);
                    } else {
                        window.location.href = url;
                    }
                }
                break;
                
            // Action not defined, just return
            default:
                break;
                
            }
            
            return;
            
        }.bind(this));

    }.bind(this);

};

// Get an object with the x and y coordinates of the panel's origin in terms of the entire page
// Necessary for positioning any HTML elements over the panel
LocusZoom.DataLayer.prototype.getPageOrigin = function(){
    var panel_origin = this.parent.getPageOrigin();
    return {
        x: panel_origin.x + this.parent.layout.margin.left,
        y: panel_origin.y + this.parent.layout.margin.top
    };
};

// Get a data layer's current underlying data in a standard format (e.g. JSON or CSV)
LocusZoom.DataLayer.prototype.exportData = function(format){
    var default_format = "json";
    format = format || default_format;
    format = (typeof format == "string" ? format.toLowerCase() : default_format);
    if (["json","csv","tsv"].indexOf(format) == -1){ format = default_format; }
    var ret;
    switch (format){
    case "json":
        try {
            ret = JSON.stringify(this.data);
        } catch (e){
            ret = null;
            console.error("Unable to export JSON data from data layer: " + this.getBaseId() + ";", e);
        }
        break;
    case "tsv":
    case "csv":
        try {
            var jsonified = JSON.parse(JSON.stringify(this.data));
            if (typeof jsonified != "object"){
                ret = jsonified.toString();
            } else if (!Array.isArray(jsonified)){
                ret = "Object";
            } else {
                var delimiter = (format == "tsv") ? "\t" : ",";
                var header = this.layout.fields.map(function(header){
                    return JSON.stringify(header);
                }).join(delimiter) + "\n";
                ret = header + jsonified.map(function(record){
                    return this.layout.fields.map(function(field){
                        if (typeof record[field] == "undefined"){
                            return JSON.stringify(null);
                        } else if (typeof record[field] == "object" && record[field] != null){
                            return Array.isArray(record[field]) ? "\"[Array(" + record[field].length + ")]\"" : "\"[Object]\"";
                        } else {
                            return JSON.stringify(record[field]);
                        }
                    }).join(delimiter);
                }.bind(this)).join("\n");
            }
        } catch (e){
            ret = null;
            console.error("Unable to export CSV data from data layer: " + this.getBaseId() + ";", e);
        }
        break;
    }
    return ret;
};

LocusZoom.DataLayer.prototype.draw = function(){
    this.svg.container.attr("transform", "translate(" + this.parent.layout.cliparea.origin.x +  "," + this.parent.layout.cliparea.origin.y + ")");
    this.svg.clipRect
        .attr("width", this.parent.layout.cliparea.width)
        .attr("height", this.parent.layout.cliparea.height);
    this.positionAllTooltips();
    return this;
};

// Re-Map a data layer to new positions according to the parent panel's parent plot's state
LocusZoom.DataLayer.prototype.reMap = function(){

    this.destroyAllTooltips(); // hack - only non-visible tooltips should be destroyed
                               // and then recreated if returning to visibility

    // Fetch new data
    var promise = this.parent_plot.lzd.getData(this.state, this.layout.fields); //,"ld:best"
    promise.then(function(new_data){
        this.data = new_data.body;
        this.applyDataMethods();
        this.initialized = true;
    }.bind(this));

    return promise;

};


/************
  Data Layers

  Object for storing data layer definitions. Because data layer definitions tend
  to be lengthy they are stored in individual files instead of below this collection definition.
*/

LocusZoom.DataLayers = (function() {
    var obj = {};
    var datalayers = {};

    obj.get = function(name, layout, parent) {
        if (!name) {
            return null;
        } else if (datalayers[name]) {
            if (typeof layout != "object"){
                throw("invalid layout argument for data layer [" + name + "]");
            } else {
                return new datalayers[name](layout, parent);
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

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Scatter Data Layer
  Implements a standard scatter plot
*/

LocusZoom.DataLayers.add("scatter", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        point_size: 40,
        point_shape: "circle",
        color: "#888888",
        fill_opacity: 1,
        y_axis: {
            axis: 1
        },
        id_field: "id"
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

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
        var point_size = this.resolveScalableParameter(this.layout.point_size, tooltip.data);
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        var y_scale  = "y"+this.layout.y_axis.axis+"_scale";
        var y_center = this.parent[y_scale](tooltip.data[this.layout.y_axis.field]);
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        // Position horizontally on the left or the right depending on which side of the plot the point is on
        var offset = Math.sqrt(point_size / Math.PI);
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
    // Both to keep labels from running outside the data layer and  also as a first
    // pass on recursive separation
    this.flip_labels = function(){
        var data_layer = this;
        var point_size = data_layer.resolveScalableParameter(data_layer.layout.point_size, {});
        var spacing = data_layer.layout.label.spacing;
        var handle_lines = Boolean(data_layer.layout.label.lines);
        var min_x = 2 * spacing;
        var max_x = data_layer.parent.layout.width - data_layer.parent.layout.margin.left - data_layer.parent.layout.margin.right - (2 * spacing);
        var flip = function(dn, dnl){
            var dnx = +dn.attr("x");
            var text_swing = (2 * spacing) + (2 * Math.sqrt(point_size));
            if (handle_lines){
                var dnlx2 = +dnl.attr("x2");
                var line_swing = spacing + (2 * Math.sqrt(point_size));
            }
            if (dn.style("text-anchor") == "start"){
                dn.style("text-anchor", "end");
                dn.attr("x", dnx - text_swing);
                if (handle_lines){ dnl.attr("x2", dnlx2 - line_swing); }
            } else {
                dn.style("text-anchor", "start");
                dn.attr("x", dnx + text_swing);
                if (handle_lines){ dnl.attr("x2", dnlx2 + line_swing); }
            }
        };
        // Flip any going over the right edge from the right side to the left side
        // (all labels start on the right side)
        data_layer.label_texts.each(function (d, i) {
            var a = this;
            var da = d3.select(a);
            var dax = +da.attr("x");
            var abound = da.node().getBoundingClientRect();
            if (dax + abound.width + spacing > max_x){
                var dal = handle_lines ? d3.select(data_layer.label_lines[0][i]) : null;
                flip(da, dal);
            }
        });
        // Second pass to flip any others that haven't flipped yet if they collide with another label
        data_layer.label_texts.each(function (d, i) {
            var a = this;
            var da = d3.select(a);
            if (da.style("text-anchor") == "end") return;
            var dax = +da.attr("x");
            var abound = da.node().getBoundingClientRect();
            var dal = handle_lines ? d3.select(data_layer.label_lines[0][i]) : null;
            data_layer.label_texts.each(function () {
                var b = this;
                var db = d3.select(b);
                var bbound = db.node().getBoundingClientRect();
                var collision = abound.left < bbound.left + bbound.width + (2*spacing) &&
                    abound.left + abound.width + (2*spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2*spacing) &&
                    abound.height + abound.top + (2*spacing) > bbound.top;
                if (collision){
                    flip(da, dal);
                    // Double check that this flip didn't push the label past min_x. If it did, immediately flip back.
                    dax = +da.attr("x");
                    if (dax - abound.width - spacing < min_x){
                        flip(da, dal);
                    }
                }
                return;
            });
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
        data_layer.label_texts.each(function () {
            var a = this;
            var da = d3.select(a);
            var y1 = da.attr("y");
            data_layer.label_texts.each(function () {
                var b = this;
                // a & b are the same element and don't collide.
                if (a == b) return;
                var db = d3.select(b);
                // a & b are on opposite sides of the chart and
                // don't collide
                if (da.attr("text-anchor") != db.attr("text-anchor")) return;
                // Determine if the  bounding rects for the two text elements collide
                var abound = da.node().getBoundingClientRect();
                var bbound = db.node().getBoundingClientRect();
                var collision = abound.left < bbound.left + bbound.width + (2*spacing) &&
                    abound.left + abound.width + (2*spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2*spacing) &&
                    abound.height + abound.top + (2*spacing) > bbound.top;
                if (!collision) return;
                again = true;
                // If the labels collide, we'll push each
                // of the two labels up and down a little bit.
                var y2 = db.attr("y");
                var sign = abound.top < bbound.top ? 1 : -1;
                var adjust = sign * alpha;
                var new_a_y = +y1 - adjust;
                var new_b_y = +y2 + adjust;
                // Keep new values from extending outside the data layer
                var min_y = 2 * spacing;
                var max_y = data_layer.parent.layout.height - data_layer.parent.layout.margin.top - data_layer.parent.layout.margin.bottom - (2 * spacing);
                var delta;
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
            // After ~150 iterations we're probably beyond diminising returns, so stop recursing
            if (this.seperate_iterations < 150){
                setTimeout(function(){
                    this.separate_labels();
                }.bind(this), 1);
            }
        }
    };

    // Implement the main render function
    this.render = function(){

        var data_layer = this;
        var x_scale = "x_scale";
        var y_scale = "y"+this.layout.y_axis.axis+"_scale";

        // Generate labels first (if defined)
        if (this.layout.label){
            // Apply filters to generate a filtered data set
            var filtered_data = this.data.filter(function(d){
                if (!data_layer.layout.label.filters){
                    return true;
                } else {
                    // Start by assuming a match, run through all filters to test if not a match on any one
                    var match = true;
                    data_layer.layout.label.filters.forEach(function(filter){
                        if (isNaN(d[filter.field])){
                            match = false;
                        } else {
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
                        }
                    });
                    return match;
                }
            });
            // Render label groups
            this.label_groups = this.svg.group
                .selectAll("g.lz-data_layer-scatter-label")
                .data(filtered_data, function(d){ return d.id + "_label"; });
            this.label_groups.enter()
                .append("g")
                .attr("class", "lz-data_layer-scatter-label");
            // Render label texts
            if (this.label_texts){ this.label_texts.remove(); }
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
                              + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                              + data_layer.layout.label.spacing;
                        if (isNaN(x)){ x = -1000; }
                        return x;
                    },
                    "y": function(d){
                        var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                        if (isNaN(y)){ y = -1000; }
                        return y;
                    },
                    "text-anchor": function(){
                        return "start";
                    }
                });
            // Render label lines
            if (data_layer.layout.label.lines){
                if (this.label_lines){ this.label_lines.remove(); }
                this.label_lines = this.label_groups.append("line")
                    .attr("class", "lz-data_layer-scatter-label");
                this.label_lines
                    .style(data_layer.layout.label.lines.style || {})
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
                                  + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                                  + (data_layer.layout.label.spacing/2);
                            if (isNaN(x)){ x = -1000; }
                            return x;
                        },
                        "y2": function(d){
                            var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                            if (isNaN(y)){ y = -1000; }
                            return y;
                        }
                    });
            }
            // Remove labels when they're no longer in the filtered data set
            this.label_groups.exit().remove();
        }
            
        // Generate main scatter data elements
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-scatter")
            .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));

        // Create elements, apply class, ID, and initial position
        var initial_y = isNaN(this.parent.layout.height) ? 0 : this.parent.layout.height;
        selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-scatter")
            .attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .attr("transform", "translate(0," + initial_y + ")");

        // Generate new values (or functions for them) for position, color, size, and shape
        var transform = function(d) {
            var x = this.parent[x_scale](d[this.layout.x_axis.field]);
            var y = this.parent[y_scale](d[this.layout.y_axis.field]);
            if (isNaN(x)){ x = -1000; }
            if (isNaN(y)){ y = -1000; }
            return "translate(" + x + "," + y + ")";
        }.bind(this);

        var fill = function(d){ return this.resolveScalableParameter(this.layout.color, d); }.bind(this);
        var fill_opacity = function(d){ return this.resolveScalableParameter(this.layout.fill_opacity, d); }.bind(this);

        var shape = d3.svg.symbol()
            .size(function(d){ return this.resolveScalableParameter(this.layout.point_size, d); }.bind(this))
            .type(function(d){ return this.resolveScalableParameter(this.layout.point_shape, d); }.bind(this));

        // Apply position and color, using a transition if necessary

        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("fill-opacity", fill_opacity)
                .attr("d", shape);
        } else {
            selection
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("fill-opacity", fill_opacity)
                .attr("d", shape);
        }

        // Remove old elements as needed
        selection.exit().remove();

        // Apply default event emitters to selection
        selection.on("click.event_emitter", function(element){
            this.parent.emit("element_clicked", element);
            this.parent_plot.emit("element_clicked", element);
        }.bind(this));
       
        // Apply mouse behaviors
        this.applyBehaviors(selection);
        
        // Apply method to keep labels from overlapping each other
        if (this.layout.label){
            this.flip_labels();
            this.seperate_iterations = 0;
            this.separate_labels();
            // Extend mouse behaviors to labels
            this.applyBehaviors(this.label_texts);
        }
        
    };

    // Method to set a passed element as the LD reference in the plot-level state
    this.makeLDReference = function(element){
        var ref = null;
        if (typeof element == "undefined"){
            throw("makeLDReference requires one argument of any type");
        } else if (typeof element == "object"){
            if (this.layout.id_field && typeof element[this.layout.id_field] != "undefined"){
                ref = element[this.layout.id_field].toString();
            } else if (typeof element["id"] != "undefined"){
                ref = element["id"].toString();
            } else {
                ref = element.toString();
            }
        } else {
            ref = element.toString();
        }
        this.parent_plot.applyState({ ldrefvar: ref });
    };
 
    return this;

});

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Line Data Layer
  Implements a standard line plot
*/

LocusZoom.DataLayers.add("line", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        style: {
            fill: "none",
            "stroke-width": "2px"
        },
        interpolate: "linear",
        x_axis: { field: "x" },
        y_axis: { field: "y", axis: 1 },
        hitarea_width: 5
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Var for storing mouse events for use in tool tip positioning
    this.mouse_event = null;

    // Var for storing the generated line function itself
    this.line = null;

    this.tooltip_timeout = null;

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Helper function to get display and data objects representing
    // the x/y coordinates of the current mouse event with respect to the line in terms of the display
    // and the interpolated values of the x/y fields with respect to the line
    this.getMouseDisplayAndData = function(){
        var ret = {
            display: {
                x: d3.mouse(this.mouse_event)[0],
                y: null
            },
            data: {},
            slope: null
        };
        var x_field = this.layout.x_axis.field;
        var y_field = this.layout.y_axis.field;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";
        ret.data[x_field] = this.parent[x_scale].invert(ret.display.x);
        var bisect = d3.bisector(function(datum) { return +datum[x_field]; }).left;
        var index = bisect(this.data, ret.data[x_field]) - 1;
        var startDatum = this.data[index];
        var endDatum = this.data[index + 1];
        var interpolate = d3.interpolateNumber(+startDatum[y_field], +endDatum[y_field]);
        var range = +endDatum[x_field] - +startDatum[x_field];
        ret.data[y_field] = interpolate((ret.data[x_field] % range) / range);
        ret.display.y = this.parent[y_scale](ret.data[y_field]);
        if (this.layout.tooltip.x_precision){
            ret.data[x_field] = ret.data[x_field].toPrecision(this.layout.tooltip.x_precision);
        }
        if (this.layout.tooltip.y_precision){
            ret.data[y_field] = ret.data[y_field].toPrecision(this.layout.tooltip.y_precision);
        }
        ret.slope = (this.parent[y_scale](endDatum[y_field]) - this.parent[y_scale](startDatum[y_field]))
                  / (this.parent[x_scale](endDatum[x_field]) - this.parent[x_scale](startDatum[x_field]));
        return ret;
    };

    // Reimplement the positionTooltip() method to be line-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var arrow_width = 7; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var stroke_width = parseFloat(this.layout.style["stroke-width"]) || 1;
        var page_origin = this.getPageOrigin();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        var top, left, arrow_top, arrow_left, arrow_type;

        // Determine x/y coordinates for display and data
        var dd = this.getMouseDisplayAndData();

        // If the absolute value of the slope of the line at this point is above 1 (including Infinity)
        // then position the tool tip left/right. Otherwise position top/bottom.
        if (Math.abs(dd.slope) > 1){

            // Position horizontally on the left or the right depending on which side of the plot the point is on
            if (dd.display.x <= this.parent.layout.width / 2){
                left = page_origin.x + dd.display.x + stroke_width + arrow_width + stroke_width;
                arrow_type = "left";
                arrow_left = -1 * (arrow_width + stroke_width);
            } else {
                left = page_origin.x + dd.display.x - tooltip_box.width - stroke_width - arrow_width - stroke_width;
                arrow_type = "right";
                arrow_left = tooltip_box.width - stroke_width;
            }
            // Position vertically centered unless we're at the top or bottom of the plot
            if (dd.display.y - (tooltip_box.height / 2) <= 0){ // Too close to the top, push it down
                top = page_origin.y + dd.display.y - (1.5 * arrow_width) - border_radius;
                arrow_top = border_radius;
            } else if (dd.display.y + (tooltip_box.height / 2) >= data_layer_height){ // Too close to the bottom, pull it up
                top = page_origin.y + dd.display.y + arrow_width + border_radius - tooltip_box.height;
                arrow_top = tooltip_box.height - (2 * arrow_width) - border_radius;
            } else { // vertically centered
                top = page_origin.y + dd.display.y - (tooltip_box.height / 2);
                arrow_top = (tooltip_box.height / 2) - arrow_width;
            }

        } else {

            // Position horizontally: attempt to center on the mouse's x coordinate
            // pad to either side if bumping up against the edge of the data layer
            var offset_right = Math.max((tooltip_box.width / 2) - dd.display.x, 0);
            var offset_left = Math.max((tooltip_box.width / 2) + dd.display.x - data_layer_width, 0);
            left = page_origin.x + dd.display.x - (tooltip_box.width / 2) - offset_left + offset_right;
            var min_arrow_left = arrow_width / 2;
            var max_arrow_left = tooltip_box.width - (2.5 * arrow_width);
            arrow_left = (tooltip_box.width / 2) - arrow_width + offset_left - offset_right;
            arrow_left = Math.min(Math.max(arrow_left, min_arrow_left), max_arrow_left);

            // Position vertically above the line unless there's insufficient space
            if (tooltip_box.height + stroke_width + arrow_width > dd.display.y){
                top = page_origin.y + dd.display.y + stroke_width + arrow_width;
                arrow_type = "up";
                arrow_top = 0 - stroke_width - arrow_width;
            } else {
                top = page_origin.y + dd.display.y - (tooltip_box.height + stroke_width + arrow_width);
                arrow_type = "down";
                arrow_top = tooltip_box.height - stroke_width;
            }
        }

        // Apply positions to the main div
        tooltip.selector.style({ left: left + "px", top: top + "px" });
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style({ "left": arrow_left + "px", top: arrow_top + "px" });

    };


    // Implement the main render function
    this.render = function(){

        // Several vars needed to be in scope
        var data_layer = this;
        var panel = this.parent;
        var x_field = this.layout.x_axis.field;
        var y_field = this.layout.y_axis.field;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";

        // Join data to the line selection
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-line")
            .data([this.data]);

        // Create path element, apply class
        this.path = selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-line");

        // Generate the line
        this.line = d3.svg.line()
            .x(function(d) { return parseFloat(panel[x_scale](d[x_field])); })
            .y(function(d) { return parseFloat(panel[y_scale](d[y_field])); })
            .interpolate(this.layout.interpolate);

        // Apply line and style
        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("d", this.line)
                .style(this.layout.style);
        } else {
            selection
                .attr("d", this.line)
                .style(this.layout.style);
        }

        // Apply tooltip, etc
        if (this.layout.tooltip){
            // Generate an overlaying transparent "hit area" line for more intuitive mouse events
            var hitarea_width = parseFloat(this.layout.hitarea_width).toString() + "px";
            var hitarea = this.svg.group
                .selectAll("path.lz-data_layer-line-hitarea")
                .data([this.data]);
            hitarea.enter()
                .append("path")
                .attr("class", "lz-data_layer-line-hitarea")
                .style("stroke-width", hitarea_width);
            var hitarea_line = d3.svg.line()
                .x(function(d) { return parseFloat(panel[x_scale](d[x_field])); })
                .y(function(d) { return parseFloat(panel[y_scale](d[y_field])); })
                .interpolate(this.layout.interpolate);
            hitarea
                .attr("d", hitarea_line)
                .on("mouseover", function(){
                    clearTimeout(data_layer.tooltip_timeout);
                    data_layer.mouse_event = this;
                    var dd = data_layer.getMouseDisplayAndData();
                    data_layer.createTooltip(dd.data);
                })
                .on("mousemove", function(){
                    clearTimeout(data_layer.tooltip_timeout);
                    data_layer.mouse_event = this;
                    var dd = data_layer.getMouseDisplayAndData();
                    data_layer.updateTooltip(dd.data);
                    data_layer.positionTooltip(data_layer.getElementId());
                })
                .on("mouseout", function(){
                    data_layer.tooltip_timeout = setTimeout(function(){
                        data_layer.mouse_event = null;
                        data_layer.destroyTooltip(data_layer.getElementId());
                    }, 300);
                });
            hitarea.exit().remove();
        }

        // Remove old elements as needed
        selection.exit().remove();
        
    };

    // Redefine setElementStatus family of methods as line data layers will only ever have a single path element
    this.setElementStatus = function(status, element, toggle){
        return this.setAllElementStatus(status, toggle);
    };
    this.setElementStatusByFilters = function(status, toggle){
        return this.setAllElementStatus(status, toggle);
    };
    this.setAllElementStatus = function(status, toggle){
        // Sanity check
        if (typeof status == "undefined" || LocusZoom.DataLayer.Statuses.adjectives.indexOf(status) == -1){
            throw("Invalid status passed to DataLayer.setAllElementStatus()");
        }
        if (typeof this.state[this.state_id][status] == "undefined"){ return this; }
        if (typeof toggle == "undefined"){ toggle = true; }

        // Update global status flag
        this.global_statuses[status] = toggle;

        // Apply class to path based on global status flags
        var path_class = "lz-data_layer-line";
        Object.keys(this.global_statuses).forEach(function(global_status){
            if (this.global_statuses[global_status]){ path_class += " lz-data_layer-line-" + global_status; }
        }.bind(this));
        this.path.attr("class", path_class);

        // Trigger layout changed event hook
        this.parent.emit("layout_changed");
        this.parent_plot.emit("layout_changed");
        
        return this;
    };

    return this;

});


/***************************
  Orthogonal Line Data Layer
  Implements a horizontal or vertical line given an orientation and an offset in the layout
  Does not require a data source
*/

LocusZoom.DataLayers.add("orthogonal_line", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        style: {
            "stroke": "#D3D3D3",
            "stroke-width": "3px",
            "stroke-dasharray": "10px 10px"
        },
        orientation: "horizontal",
        x_axis: {
            axis: 1,
            decoupled: true
        },
        y_axis: {
            axis: 1,
            decoupled: true
        },
        offset: 0
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Require that orientation be "horizontal" or "vertical" only
    if (["horizontal","vertical"].indexOf(layout.orientation) == -1){
        layout.orientation = "horizontal";
    }

    // Vars for storing the data generated line
    this.data = [];
    this.line = null;

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Implement the main render function
    this.render = function(){

        // Several vars needed to be in scope
        var data_layer = this;
        var panel = this.parent;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";
        var x_extent = "x_extent";
        var y_extent = "y" + this.layout.y_axis.axis + "_extent";
        var x_range = "x_range";
        var y_range = "y" + this.layout.y_axis.axis + "_range";

        // Generate data using extents depending on orientation
        if (this.layout.orientation == "horizontal"){
            this.data = [
                { x: panel[x_extent][0], y: this.layout.offset },
                { x: panel[x_extent][1], y: this.layout.offset }
            ];
        } else {
            this.data = [
                { x: this.layout.offset, y: panel[y_extent][0] },
                { x: this.layout.offset, y: panel[y_extent][1] }
            ];
        }

        // Join data to the line selection
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-line")
            .data([this.data]);

        // Create path element, apply class
        this.path = selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-line");

        // Generate the line
        this.line = d3.svg.line()
            .x(function(d, i) {
                var x = parseFloat(panel[x_scale](d["x"]));
                return isNaN(x) ? panel[x_range][i] : x;
            })
            .y(function(d, i) {
                var y = parseFloat(panel[y_scale](d["y"]));
                return isNaN(y) ? panel[y_range][i] : y;
            })
            .interpolate("linear");

        // Apply line and style
        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("d", this.line)
                .style(this.layout.style);
        } else {
            selection
                .attr("d", this.line)
                .style(this.layout.style);
        }

        // Remove old elements as needed
        selection.exit().remove();
        
    };

    return this;

});

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Genes Data Layer
  Implements a data layer that will render gene tracks
*/

LocusZoom.DataLayers.add("genes", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        label_font_size: 12,
        label_exon_spacing: 4,
        exon_height: 16,
        bounding_box_padding: 6,
        track_vertical_spacing: 10,
        hover_element: "bounding_box"
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

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
            try {
                var temp_text = this.svg.group.append("text")
                    .attr("x", 0).attr("y", 0).attr("class", "lz-data_layer-genes lz-label")
                    .style("font-size", font_size)
                    .text(gene_name + "→");
                var label_width = temp_text.node().getBBox().width;
                temp_text.remove();
                return label_width;
            } catch (e){
                return 0;
            }
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

        var width, height, x, y;

        // Render gene groups
        var selection = this.svg.group.selectAll("g.lz-data_layer-genes")
            .data(this.data, function(d){ return d.gene_name; });

        selection.enter().append("g")
            .attr("class", "lz-data_layer-genes");
        
        selection.attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .each(function(gene){

                var data_layer = gene.parent;

                // Render gene bounding box
                var bboxes = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-data_layer-genes-bounding_box")
                    .data([gene], function(d){ return d.gene_name + "_bbox"; });

                bboxes.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-data_layer-genes-bounding_box");
                
                bboxes
                    .attr("id", function(d){
                        return data_layer.getElementId(d) + "_bounding_box";
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                width = function(d){
                    return d.display_range.width;
                };
                height = function(){
                    return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                };
                x = function(d){
                    return d.display_range.start;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight());
                };
                if (data_layer.canTransition()){
                    bboxes
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    bboxes
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                bboxes.exit().remove();

                // Render gene boundaries
                var boundaries = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-boundary")
                    .data([gene], function(d){ return d.gene_name + "_boundary"; });

                boundaries.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-boundary");

                width = function(d){
                    return data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start);
                };
                height = function(){
                    return 1; // TODO: scale dynamically?
                };
                x = function(d){
                    return data_layer.parent.x_scale(d.start);
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding
                        + data_layer.layout.label_font_size
                        + data_layer.layout.label_exon_spacing
                        + (Math.max(data_layer.layout.exon_height, 3) / 2);
                };
                if (data_layer.canTransition()){
                    boundaries
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    boundaries
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }
                
                boundaries.exit().remove();

                // Render gene labels
                var labels = d3.select(this).selectAll("text.lz-data_layer-genes.lz-label")
                    .data([gene], function(d){ return d.gene_name + "_label"; });

                labels.enter().append("text")
                    .attr("class", "lz-data_layer-genes lz-label");

                labels
                    .attr("text-anchor", function(d){
                        return d.display_range.text_anchor;
                    })
                    .text(function(d){
                        return (d.strand == "+") ? d.gene_name + "→" : "←" + d.gene_name;
                    })
                    .style("font-size", gene.parent.layout.label_font_size);

                x = function(d){
                    if (d.display_range.text_anchor == "middle"){
                        return d.display_range.start + (d.display_range.width / 2);
                    } else if (d.display_range.text_anchor == "start"){
                        return d.display_range.start + data_layer.layout.bounding_box_padding;
                    } else if (d.display_range.text_anchor == "end"){
                        return d.display_range.end - data_layer.layout.bounding_box_padding;
                    }
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding
                        + data_layer.layout.label_font_size;
                };
                if (data_layer.canTransition()){
                    labels
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("x", x).attr("y", y);
                } else {
                    labels
                        .attr("x", x).attr("y", y);
                }

                labels.exit().remove();

                // Render exon rects (first transcript only, for now)
                var exons = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-exon")
                    .data(gene.transcripts[gene.parent.transcript_idx].exons, function(d){ return d.exon_id; });
                        
                exons.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-exon");
                        
                width = function(d){
                    return data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start);
                };
                height = function(){
                    return data_layer.layout.exon_height;
                };
                x = function(d){
                    return data_layer.parent.x_scale(d.start);
                };
                y = function(){
                    return ((gene.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding
                        + data_layer.layout.label_font_size
                        + data_layer.layout.label_exon_spacing;
                };
                if (data_layer.canTransition()){
                    exons
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    exons
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                exons.exit().remove();

                // Render gene click area
                var clickareas = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-clickarea")
                    .data([gene], function(d){ return d.gene_name + "_clickarea"; });

                clickareas.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-clickarea");

                clickareas
                    .attr("id", function(d){
                        return data_layer.getElementId(d) + "_clickarea";
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                width = function(d){
                    return d.display_range.width;
                };
                height = function(){
                    return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                };
                x = function(d){
                    return d.display_range.start;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight());
                };
                if (data_layer.canTransition()){
                    clickareas
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    clickareas
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                // Remove old clickareas as needed
                clickareas.exit().remove();

                // Apply default event emitters to clickareas
                clickareas.on("click.event_emitter", function(element){
                    element.parent.parent.emit("element_clicked", element);
                    element.parent.parent_plot.emit("element_clicked", element);
                });

                // Apply mouse behaviors to clickareas
                data_layer.applyBehaviors(clickareas);

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
        var gene_bbox_id = this.getElementId(tooltip.data) + "_bounding_box";
        var gene_bbox = d3.select("#" + gene_bbox_id).node().getBBox();
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

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Intervals Data Layer
  Implements a data layer that will render interval annotation tracks
*/

LocusZoom.DataLayers.add("intervals", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        start_field: "start",
        end_field: "end",
        track_split_field: "state_id",
        track_split_order: "DESC",
        track_split_legend_to_y_axis: 2,
        split_tracks: true,
        track_height: 15,
        track_vertical_spacing: 3,
        bounding_box_padding: 2,
        hover_element: "bounding_box",
        group_hover_elements_on_field: null,
        always_hide_legend: false,
        color: "#B8B8B8",
        fill_opacity: 1
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);
    
    // Helper function to sum layout values to derive total height for a single interval track
    this.getTrackHeight = function(){
        return this.layout.track_height
            + this.layout.track_vertical_spacing
            + (2 * this.layout.bounding_box_padding);
    };

    this.tracks = 1;
    this.previous_tracks = 1;
    this.group_hover_elements = {};
    
    // track-number-indexed object with arrays of interval indexes in the dataset
    this.interval_track_index = { 1: [] };

    // After we've loaded interval data interpret it to assign
    // each to a track so that they do not overlap in the view
    this.assignTracks = function(){

        // Reinitialize some metadata
        this.previous_tracks = this.tracks;
        this.tracks = 0;
        this.interval_track_index = { 1: [] };
        this.track_split_field_index = {};
        
        // If splitting tracks by a field's value then do a first pass determine
        // a value/track mapping that preserves the order of possible values
        if (this.layout.track_split_field && this.layout.split_tracks){
            this.data.map(function(d){
                this.track_split_field_index[d[this.layout.track_split_field]] = null;
            }.bind(this));
            var index = Object.keys(this.track_split_field_index);
            if (this.layout.track_split_order == "DESC"){ index.reverse(); }
            index.forEach(function(val){
                this.track_split_field_index[val] = this.tracks + 1;
                this.interval_track_index[this.tracks + 1] = [];
                this.tracks++;
            }.bind(this));
        }

        this.data.map(function(d, i){

            // Stash a parent reference on the interval
            this.data[i].parent = this;

            // Determine display range start and end, based on minimum allowable interval display width,
            // bounded by what we can see (range: values in terms of pixels on the screen)
            this.data[i].display_range = {
                start: this.parent.x_scale(Math.max(d[this.layout.start_field], this.state.start)),
                end:   this.parent.x_scale(Math.min(d[this.layout.end_field], this.state.end))
            };
            this.data[i].display_range.width = this.data[i].display_range.end - this.data[i].display_range.start;
            
            // Convert and stash display range values into domain values
            // (domain: values in terms of the data set, e.g. megabases)
            this.data[i].display_domain = {
                start: this.parent.x_scale.invert(this.data[i].display_range.start),
                end:   this.parent.x_scale.invert(this.data[i].display_range.end)
            };
            this.data[i].display_domain.width = this.data[i].display_domain.end - this.data[i].display_domain.start;

            // If splitting to tracks based on the value of the designated track split field
            // then don't bother with collision detection (intervals will be grouped on tracks
            // solely by the value of track_split_field)
            if (this.layout.track_split_field && this.layout.split_tracks){
                var val = this.data[i][this.layout.track_split_field];
                this.data[i].track = this.track_split_field_index[val];
                this.interval_track_index[this.data[i].track].push(i);
            } else {
                // If not splitting to tracks based on a field value then do so based on collision
                // detection (as how it's done for genes). Use display range/domain data generated
                // above and cast each interval to tracks such that none overlap
                this.tracks = 1;
                this.data[i].track = null;
                var potential_track = 1;
                while (this.data[i].track == null){
                    var collision_on_potential_track = false;
                    this.interval_track_index[potential_track].map(function(placed_interval){
                        if (!collision_on_potential_track){
                            var min_start = Math.min(placed_interval.display_range.start, this.display_range.start);
                            var max_end = Math.max(placed_interval.display_range.end, this.display_range.end);
                            if ((max_end - min_start) < (placed_interval.display_range.width + this.display_range.width)){
                                collision_on_potential_track = true;
                            }
                        }
                    }.bind(this.data[i]));
                    if (!collision_on_potential_track){
                        this.data[i].track = potential_track;
                        this.interval_track_index[potential_track].push(this.data[i]);
                    } else {
                        potential_track++;
                        if (potential_track > this.tracks){
                            this.tracks = potential_track;
                            this.interval_track_index[potential_track] = [];
                        }
                    }
                }

            }

        }.bind(this));

        return this;
    };

    // Implement the main render function
    this.render = function(){

        this.assignTracks();

        // First: render or remove group bounding boxes based on whether we're track split
        if (this.layout.split_tracks){
            Object.keys(this.group_hover_elements).forEach(function(key){
                if (!this.track_split_field_index[key]){ this.group_hover_elements[key].remove(); }
            }.bind(this));
            Object.keys(this.track_split_field_index).forEach(function(key){
                if (!this.group_hover_elements[key]){
                    this.group_hover_elements[key] = this.svg.group.insert("rect", ":first-child")
                        .attr("class", "lz-data_layer-intervals lz-data_layer-intervals-bounding_box");
                }
                this.group_hover_elements[key]
                    .attr("rx", this.layout.bounding_box_padding).attr("ry", this.layout.bounding_box_padding)
                    .attr("width", this.parent.layout.cliparea.width)
                    .attr("height", this.getTrackHeight() - this.layout.track_vertical_spacing)
                    .attr("x", 0)
                    .attr("y", (this.track_split_field_index[key]-1) * this.getTrackHeight());
            }.bind(this));
        } else {
            Object.keys(this.group_hover_elements).forEach(function(key){
                this.group_hover_elements[key].remove();
            }.bind(this));
            this.group_hover_elements = {};
        }

        var width, height, x, y, fill;
            
        // Render interval groups
        var selection = this.svg.group.selectAll("g.lz-data_layer-intervals")
            .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));

        selection.enter().append("g")
            .attr("class", "lz-data_layer-intervals");
        
        selection.attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .each(function(interval){

                var data_layer = interval.parent;

                // Render interval bounding box (displayed behind intervals to show highlight
                // without needing to modify interval display element(s)) if not in split view
                var bboxes = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-data_layer-intervals-bounding_box")
                    .data([interval], function(d){ return d[data_layer.layout.id_field] + "_bbox"; });
                if (data_layer.layout.split_tracks){
                    bboxes.remove();
                } else {                    
                    bboxes.enter().append("rect")
                        .attr("class", "lz-data_layer-intervals lz-data_layer-intervals-bounding_box");
                    
                    bboxes
                        .attr("id", function(d){
                            return data_layer.getElementId(d) + "_bounding_box";
                        })
                        .attr("rx", function(){
                            return data_layer.layout.bounding_box_padding;
                        })
                        .attr("ry", function(){
                            return data_layer.layout.bounding_box_padding;
                        });
                    
                    width = function(d){
                        return d.display_range.width + (2 * data_layer.layout.bounding_box_padding);
                    };
                    height = function(){
                        return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                    };
                    x = function(d){
                        return d.display_range.start - data_layer.layout.bounding_box_padding;
                    };
                    y = function(d){
                        return ((d.track-1) * data_layer.getTrackHeight());
                    };
                    if (data_layer.canTransition()){
                        bboxes
                            .transition()
                            .duration(data_layer.layout.transition.duration || 0)
                            .ease(data_layer.layout.transition.ease || "cubic-in-out")
                            .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                    } else {
                        bboxes
                            .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                    }
                    
                    bboxes.exit().remove();
                }

                // Render primary interval rects
                var rects = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-interval_rect")
                    .data([interval], function(d){ return d[data_layer.layout.id_field] + "_interval_rect"; });

                rects.enter().append("rect")
                    .attr("class", "lz-data_layer-intervals lz-interval_rect");

                height = data_layer.layout.track_height;
                width = function(d){
                    return d.display_range.width;
                };
                x = function(d){
                    return d.display_range.start;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding;
                };
                fill = function(d){
                    return data_layer.resolveScalableParameter(data_layer.layout.color, d);
                };
                fill_opacity = function(d){
                    return data_layer.resolveScalableParameter(data_layer.layout.fill_opacity, d);
                };
                
                
                if (data_layer.canTransition()){
                    rects
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height)
                        .attr("x", x).attr("y", y)
                        .attr("fill", fill)
                        .attr("fill-opacity", fill_opacity);
                } else {
                    rects
                        .attr("width", width).attr("height", height)
                        .attr("x", x).attr("y", y)
                        .attr("fill", fill)
                        .attr("fill-opacity", fill_opacity);
                }
                
                rects.exit().remove();

                // Render interval click areas
                var clickareas = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-clickarea")
                    .data([interval], function(d){ return d.interval_name + "_clickarea"; });

                clickareas.enter().append("rect")
                    .attr("class", "lz-data_layer-intervals lz-clickarea");

                clickareas
                    .attr("id", function(d){
                        return data_layer.getElementId(d) + "_clickarea";
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                width = function(d){
                    return d.display_range.width;
                };
                height = function(){
                    return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                };
                x = function(d){
                    return d.display_range.start;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight());
                };
                if (data_layer.canTransition()){
                    clickareas
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    clickareas
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                // Remove old clickareas as needed
                clickareas.exit().remove();

                // Apply default event emitters to clickareas
                clickareas.on("click", function(element){
                    element.parent.parent.emit("element_clicked", element);
                    element.parent.parent_plot.emit("element_clicked", element);
                }.bind(this));

                // Apply mouse behaviors to clickareas
                data_layer.applyBehaviors(clickareas);

            });

        // Remove old elements as needed
        selection.exit().remove();

        // Update the legend axis if the number of ticks changed
        if (this.previous_tracks != this.tracks){
            this.updateSplitTrackAxis();
        }

        return this;

    };
    
    // Reimplement the positionTooltip() method to be interval-specific
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
        var interval_bbox;
        if (this.layout.split_tracks){
            interval_bbox = d3.select("#" + this.getElementId(tooltip.data)).node().getBBox();
        } else {
            interval_bbox = d3.select("#" + this.getElementId(tooltip.data) + "_bounding_box").node().getBBox();
        }
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        // Position horizontally: attempt to center on the portion of the interval that's visible,
        // pad to either side if bumping up against the edge of the data layer
        var interval_center_x = ((tooltip.data.display_range.start + tooltip.data.display_range.end) / 2) - (this.layout.bounding_box_padding / 2);
        var offset_right = Math.max((tooltip_box.width / 2) - interval_center_x, 0);
        var offset_left = Math.max((tooltip_box.width / 2) + interval_center_x - data_layer_width, 0);
        var left = page_origin.x + interval_center_x - (tooltip_box.width / 2) - offset_left + offset_right;
        var arrow_left = (tooltip_box.width / 2) - (arrow_width / 2) + offset_left - offset_right;
        // Position vertically below the interval unless there's insufficient space
        var top, arrow_type, arrow_top;
        if (tooltip_box.height + stroke_width + arrow_width > data_layer_height - (interval_bbox.y + interval_bbox.height)){
            top = page_origin.y + interval_bbox.y - (tooltip_box.height + stroke_width + arrow_width);
            arrow_type = "down";
            arrow_top = tooltip_box.height - stroke_width;
        } else {
            top = page_origin.y + interval_bbox.y + interval_bbox.height + stroke_width + arrow_width;
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

    // Redraw split track axis or hide it, and show/hide the legend, as determined
    // by current layout parameters and data
    this.updateSplitTrackAxis = function(){
        var legend_axis = this.layout.track_split_legend_to_y_axis ? "y" + this.layout.track_split_legend_to_y_axis : false;
        if (this.layout.split_tracks){
            var tracks = +this.tracks || 0;
            var track_height = +this.layout.track_height || 0;
            var track_spacing =  2 * (+this.layout.bounding_box_padding || 0) + (+this.layout.track_vertical_spacing || 0);
            var target_height = (tracks * track_height) + ((tracks - 1) * track_spacing);
            this.parent.scaleHeightToData(target_height);
            if (legend_axis && this.parent.legend){
                this.parent.legend.hide();                            
                this.parent.layout.axes[legend_axis] = {
                    render: true,
                    ticks: [],
                    range: {
                        start: (target_height - (this.layout.track_height/2)),
                        end: (this.layout.track_height/2)
                    }
                };
                this.layout.legend.forEach(function(element){
                    var key = element[this.layout.track_split_field];
                    var track = this.track_split_field_index[key];
                    if (track){
                        if (this.layout.track_split_order == "DESC"){
                            track = Math.abs(track - tracks - 1);
                        }
                        this.parent.layout.axes[legend_axis].ticks.push({
                            y: track,
                            text: element.label
                        });
                    }
                }.bind(this));
                this.layout.y_axis = {
                    axis: this.layout.track_split_legend_to_y_axis,
                    floor: 1,
                    ceiling: tracks
                };
                this.parent.render();
            }
            this.parent_plot.positionPanels();
        } else {
            if (legend_axis && this.parent.legend){
                if (!this.layout.always_hide_legend){ this.parent.legend.show(); }
                this.parent.layout.axes[legend_axis] = { render: false };
                this.parent.render();
            }
        }
        return this;
    };

    // Method to not only toggle the split tracks boolean but also update
    // necessary display values to animate a complete merge/split
    this.toggleSplitTracks = function(){
        this.layout.split_tracks = !this.layout.split_tracks;
        this.layout.group_hover_elements_on_field = this.layout.split_tracks ? this.layout.track_split_field : null;
        if (this.parent.legend && !this.layout.always_hide_legend){
            this.parent.layout.margin.bottom = 5 + (this.layout.split_tracks ? 0 : this.parent.legend.layout.height + 5);
        }
        this.render();
        this.updateSplitTrackAxis();
        return this;
    };
       
    return this;

});

/* global LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Genome Legend Data Layer
  Implements a data layer that will render a genome legend
*/

// Build a custom data layer for a genome legend
LocusZoom.DataLayers.add("genome_legend", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        chromosome_fill_colors: {
            light: "rgb(155, 155, 188)",
            dark: "rgb(95, 95, 128)"
        },
        chromosome_label_colors: {
            light: "rgb(120, 120, 186)",
            dark: "rgb(0, 0, 66)"
        }
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Implement the main render function
    this.render = function(){

        // Iterate over data to generate genome-wide start/end values for each chromosome
        var position = 0;
        this.data.forEach(function(d, i){
            this.data[i].genome_start = position;
            this.data[i].genome_end = position + d["genome:base_pairs"];
            position += d["genome:base_pairs"];
        }.bind(this));

        var chromosomes = this.svg.group
            .selectAll("rect.lz-data_layer-genome_legend")
            .data(this.data, function(d){ return d["genome:chr"]; });

        // Create chromosome elements, apply class
        chromosomes.enter()
            .append("rect")
            .attr("class", "lz-data_layer-genome_legend");

        // Position and fill chromosome rects
        var data_layer = this;
        var panel = this.parent;

        chromosomes
            .attr("fill", function(d){ return (d["genome:chr"] % 2 ? data_layer.layout.chromosome_fill_colors.light : data_layer.layout.chromosome_fill_colors.dark); })
            .attr("x", function(d){ return panel.x_scale(d.genome_start); })
            .attr("y", 0)
            .attr("width", function(d){ return panel.x_scale(d["genome:base_pairs"]); })
            .attr("height", panel.layout.cliparea.height);

        // Remove old elements as needed
        chromosomes.exit().remove();

        // Parse current state variant into a position
        var split = this.state.variant.split("_");
        var chr = split[0];
        var offset = split[1];
        position = +this.data[chr-1].genome_start + +offset;

        // Render the position
        var region = this.svg.group
            .selectAll("rect.lz-data_layer-genome_legend-marker")
            .data([{ start: position, end: position + 1 }]);

        region.enter()
            .append("rect")
            .attr("class", "lz-data_layer-genome_legend-marker");

        region
            .transition()
            .duration(500)
            .style({
                "fill": "rgba(255, 250, 50, 0.8)",
                "stroke": "rgba(255, 250, 50, 0.8)",
                "stroke-width": "3px"
            })
            .attr("x", function(d){ return panel.x_scale(d.start); })
            .attr("y", 0)
            .attr("width", function(d){ return panel.x_scale(d.end - d.start); })
            .attr("height", panel.layout.cliparea.height);

        region.exit().remove();
        
    };
       
    return this;

});

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Forest Data Layer
  Implements a standard forest plot
*/

LocusZoom.DataLayers.add("forest", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        point_size: 40,
        point_shape: "square",
        color: "#888888",
        fill_opacity: 1,
        y_axis: {
            axis: 2
        },
        id_field: "id",
        confidence_intervals: {
            start_field: "ci_start",
            end_field: "ci_end"
        },
        show_no_significance_line: true
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Reimplement the positionTooltip() method to be forest-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var point_size = this.resolveScalableParameter(this.layout.point_size, tooltip.data);
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        var y_scale  = "y"+this.layout.y_axis.axis+"_scale";
        var y_center = this.parent[y_scale](tooltip.data[this.layout.y_axis.field]);
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        // Position horizontally on the left or the right depending on which side of the plot the point is on
        var offset = Math.sqrt(point_size / Math.PI);
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

    // Implement the main render function
    this.render = function(){

        var x_scale = "x_scale";
        var y_scale = "y"+this.layout.y_axis.axis+"_scale";

        // Generate confidence interval paths if fields are defined
        if (this.layout.confidence_intervals
            && this.layout.fields.indexOf(this.layout.confidence_intervals.start_field) != -1
            && this.layout.fields.indexOf(this.layout.confidence_intervals.end_field) != -1){
            // Generate a selection for all forest plot confidence intervals
            var ci_selection = this.svg.group
                .selectAll("rect.lz-data_layer-forest.lz-data_layer-forest-ci")
                .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));
            // Create confidence interval rect elements
            ci_selection.enter()
                .append("rect")
                .attr("class", "lz-data_layer-forest lz-data_layer-forest-ci")
                .attr("id", function(d){ return this.getElementId(d) + "_ci"; }.bind(this))
                .attr("transform", "translate(0," + (isNaN(this.parent.layout.height) ? 0 : this.parent.layout.height) + ")");
            // Apply position and size parameters using transition if necessary
            var ci_transform = function(d) {
                var x = this.parent[x_scale](d[this.layout.confidence_intervals.start_field]);
                var y = this.parent[y_scale](d[this.layout.y_axis.field]);
                if (isNaN(x)){ x = -1000; }
                if (isNaN(y)){ y = -1000; }
                return "translate(" + x + "," + y + ")";
            }.bind(this);
            var ci_width = function(d){
                return this.parent[x_scale](d[this.layout.confidence_intervals.end_field])
                     - this.parent[x_scale](d[this.layout.confidence_intervals.start_field]);
            }.bind(this);
            var ci_height = 1;
            if (this.canTransition()){
                ci_selection
                    .transition()
                    .duration(this.layout.transition.duration || 0)
                    .ease(this.layout.transition.ease || "cubic-in-out")
                    .attr("transform", ci_transform)
                    .attr("width", ci_width).attr("height", ci_height);
            } else {
                ci_selection
                    .attr("transform", ci_transform)
                    .attr("width", ci_width).attr("height", ci_height);
            }
            // Remove old elements as needed
            ci_selection.exit().remove();
        }
            
        // Generate a selection for all forest plot points
        var points_selection = this.svg.group
            .selectAll("path.lz-data_layer-forest.lz-data_layer-forest-point")
            .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));

        // Create elements, apply class, ID, and initial position
        var initial_y = isNaN(this.parent.layout.height) ? 0 : this.parent.layout.height;
        points_selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-forest lz-data_layer-forest-point")
            .attr("id", function(d){ return this.getElementId(d) + "_point"; }.bind(this))
            .attr("transform", "translate(0," + initial_y + ")");

        // Generate new values (or functions for them) for position, color, size, and shape
        var transform = function(d) {
            var x = this.parent[x_scale](d[this.layout.x_axis.field]);
            var y = this.parent[y_scale](d[this.layout.y_axis.field]);
            if (isNaN(x)){ x = -1000; }
            if (isNaN(y)){ y = -1000; }
            return "translate(" + x + "," + y + ")";
        }.bind(this);

        var fill = function(d){ return this.resolveScalableParameter(this.layout.color, d); }.bind(this);
        var fill_opacity = function(d){ return this.resolveScalableParameter(this.layout.fill_opacity, d); }.bind(this);

        var shape = d3.svg.symbol()
            .size(function(d){ return this.resolveScalableParameter(this.layout.point_size, d); }.bind(this))
            .type(function(d){ return this.resolveScalableParameter(this.layout.point_shape, d); }.bind(this));

        // Apply position and color, using a transition if necessary
        if (this.canTransition()){
            points_selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("fill-opacity", fill_opacity)
                .attr("d", shape);
        } else {
            points_selection
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("fill-opacity", fill_opacity)
                .attr("d", shape);
        }

        // Remove old elements as needed
        points_selection.exit().remove();

        // Apply default event emitters to selection
        points_selection.on("click.event_emitter", function(element){
            this.parent.emit("element_clicked", element);
            this.parent_plot.emit("element_clicked", element);
        }.bind(this));
       
        // Apply behaviors to points
        this.applyBehaviors(points_selection);
        
    };
 
    return this;

});

/* global LocusZoom,d3 */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Singletons

  LocusZoom has various singleton objects that are used for registering functions or classes.
  These objects provide safe, standard methods to redefine or delete existing functions/classes
  as well as define new custom functions/classes to be used in a plot.

*/


/* The Collection of "Known" Data Source Endpoints */

LocusZoom.KnownDataSources = (function() {
    var obj = {};
    var sources = [];

    var findSourceByName = function(x) {
        for(var i=0; i<sources.length; i++) {
            if (!sources[i].SOURCE_NAME) {
                throw("KnownDataSources at position " + i + " does not have a 'SOURCE_NAME' static property");
            }
            if (sources[i].SOURCE_NAME == x) {
                return sources[i];
            }
        }
        return null;
    };

    obj.get = function(name) {
        return findSourceByName(name);
    };

    obj.add = function(source) {
        if (!source.SOURCE_NAME) {
            console.warn("Data source added does not have a SOURCE_NAME");
        }
        sources.push(source);
    };

    obj.push = function(source) {
        console.warn("Warning: KnownDataSources.push() is depricated. Use .add() instead");
        obj.add(source);
    };

    obj.list = function() {
        return sources.map(function(x) {return x.SOURCE_NAME;});
    };

    obj.create = function(name) {
        //create new object (pass additional parameters to constructor)
        var newObj = findSourceByName(name);
        if (newObj) {
            var params = arguments;
            params[0] = null;
            return new (Function.prototype.bind.apply(newObj, params));
        } else {
            throw("Unable to find data source for name: " + name); 
        }
    };

    //getAll, setAll and clear really should only be used by tests
    obj.getAll = function() {
        return sources;
    };
    
    obj.setAll = function(x) {
        sources = x;
    };

    obj.clear = function() {
        sources = [];
    };

    return obj;
})();

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
    if (isNaN(x) || x <= 0){ return null; }
    return -Math.log(x) / Math.LN10;
});

LocusZoom.TransformationFunctions.add("logtoscinotation", function(x) {
    if (isNaN(x)){ return "NaN"; }
    if (x == 0){ return "1"; }
    var exp = Math.ceil(x);
    var diff = exp - x;
    var base = Math.pow(10, diff);
    if (exp == 1){
        return (base / 10).toFixed(4);
    } else if (exp == 2){
        return (base / 100).toFixed(3);
    } else {
        return base.toFixed(2) + " × 10^-" + exp;
    }
});

LocusZoom.TransformationFunctions.add("scinotation", function(x) {
    if (isNaN(x)){ return "NaN"; }
    if (x == 0){ return "0"; }
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

LocusZoom.TransformationFunctions.add("urlencode", function(str) {
    return encodeURIComponent(str);
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

// Boolean scale function: bin a dataset numerically by matching against an array of distinct values
LocusZoom.ScaleFunctions.add("if", function(parameters, input){
    if (typeof input == "undefined" || parameters.field_value != input){
        if (typeof parameters.else != "undefined"){
            return parameters.else;
        } else {
            return null;
        }
    } else {
        return parameters.then;
    }
});

// Numerical Bin scale function: bin a dataset numerically by an array of breakpoints
LocusZoom.ScaleFunctions.add("numerical_bin", function(parameters, input){
    var breaks = parameters.breaks || [];
    var values = parameters.values || [];
    if (typeof input == "undefined" || input == null || isNaN(+input)){
        return (parameters.null_value ? parameters.null_value : null);
    }
    var threshold = breaks.reduce(function(prev, curr){
        if (+input < prev || (+input >= prev && +input < curr)){
            return prev;
        } else {
            return curr;
        }
    });
    return values[breaks.indexOf(threshold)];
});

// Categorical Bin scale function: bin a dataset numerically by matching against an array of distinct values
LocusZoom.ScaleFunctions.add("categorical_bin", function(parameters, value){
    if (typeof value == "undefined" || parameters.categories.indexOf(value) == -1){
        return (parameters.null_value ? parameters.null_value : null); 
    } else {
        return parameters.values[parameters.categories.indexOf(value)];
    }
});

// Interpolate scale function
LocusZoom.ScaleFunctions.add("interpolate", function(parameters, input){
    var breaks = parameters.breaks || [];
    var values = parameters.values || [];
    var nullval = (parameters.null_value ? parameters.null_value : null);
    if (breaks.length < 2 || breaks.length != values.length){ return nullval; }
    if (typeof input == "undefined" || input == null || isNaN(+input)){ return nullval; }
    if (+input <= parameters.breaks[0]){
        return values[0];
    } else if (+input >= parameters.breaks[parameters.breaks.length-1]){
        return values[breaks.length-1];
    } else {
        var upper_idx = null;
        breaks.forEach(function(brk, idx){
            if (!idx){ return; }
            if (breaks[idx-1] <= +input && breaks[idx] >= +input){ upper_idx = idx; }
        });
        if (upper_idx == null){ return nullval; }
        var normalized_input = (+input - breaks[upper_idx-1]) / (breaks[upper_idx] - breaks[upper_idx-1]);
        if (!isFinite(normalized_input)){ return nullval; }
        return d3.interpolate(values[upper_idx-1], values[upper_idx])(normalized_input);
    }
});

/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Dashboard

  A dashboard is an HTML-based (read: not SVG-based) collection of components used to
  display information or provide user interface. Dashboards can exist on entire plots,
  where their visiblity is permanent and vertically adjacent to the plot, or on individual
  panels, where their visiblity is tied to a behavior (e.g. a mouseover) and is as an overlay.

*/

LocusZoom.Dashboard = function(parent){

    // parent must be a locuszoom plot or panel
    if (!(parent instanceof LocusZoom.Plot) && !(parent instanceof LocusZoom.Panel)){
        throw "Unable to create dashboard, parent must be a locuszoom plot or panel";
    }
    this.parent = parent;
    this.id = this.parent.getBaseId() + ".dashboard";
    this.type = (this.parent instanceof LocusZoom.Plot) ? "plot" : "panel";
    this.parent_plot = this.type == "plot" ? this.parent : this.parent.parent;

    this.selector = null;
    this.components = [];
    this.hide_timeout = null;
    this.persist = false;

    return this.initialize();

};

LocusZoom.Dashboard.prototype.initialize = function(){

    // Parse layout to generate component instances
    if (Array.isArray(this.parent.layout.dashboard.components)){
        this.parent.layout.dashboard.components.forEach(function(layout){
            try {
                var component = LocusZoom.Dashboard.Components.get(layout.type, layout, this);
                this.components.push(component);
            } catch (e) {
                console.warn(e);
            }
        }.bind(this));
    }

    // Add mouseover event handlers to show/hide panel dashboard
    if (this.type == "panel"){
        d3.select(this.parent.parent.svg.node().parentNode).on("mouseover." + this.id, function(){
            clearTimeout(this.hide_timeout);
            if (!this.selector || this.selector.style("visibility") == "hidden"){ this.show(); }
        }.bind(this));
        d3.select(this.parent.parent.svg.node().parentNode).on("mouseout." + this.id, function(){
            clearTimeout(this.hide_timeout);
            this.hide_timeout = setTimeout(function(){ this.hide(); }.bind(this), 300);
        }.bind(this));
    }

    return this;

};

LocusZoom.Dashboard.prototype.shouldPersist = function(){
    if (this.persist){ return true; }
    var persist = false;
    // Persist if at least one component should also persist
    this.components.forEach(function(component){
        persist = persist || component.shouldPersist();
    });
    // Persist if in a parent drag event
    persist = persist || (!!this.parent_plot.panel_boundaries.dragging || !!this.parent_plot.interaction.dragging);
    return persist;
};

// Populate selector and display dashboard, recursively show components
LocusZoom.Dashboard.prototype.show = function(){
    if (!this.selector){
        switch (this.type){
        case "plot":
            this.selector = d3.select(this.parent.svg.node().parentNode)
                .insert("div",":first-child");
            break;
        case "panel":
            this.selector = d3.select(this.parent.parent.svg.node().parentNode)
                .insert("div", ".lz-data_layer-tooltip, .lz-dashboard-menu, .lz-curtain").classed("lz-panel-dashboard", true);
            break;
        }
        this.selector.classed("lz-dashboard", true).classed("lz-"+this.type+"-dashboard", true).attr("id", this.id);
    }
    this.components.forEach(function(component){ component.show(); });
    this.selector.style({ visibility: "visible" });
    return this.update();
};

// Update self and all components
LocusZoom.Dashboard.prototype.update = function(){
    if (!this.selector){ return this; }
    this.components.forEach(function(component){ component.update(); });
    return this.position();
};

// Position self
LocusZoom.Dashboard.prototype.position = function(){
    if (!this.selector){ return this; }
    // Position the dashboard itself (panel only)
    if (this.type == "panel"){
        var page_origin = this.parent.getPageOrigin();
        var top = (page_origin.y + 3.5).toString() + "px";
        var left = page_origin.x.toString() + "px";
        var width = (this.parent.layout.width - 4).toString() + "px";
        this.selector.style({ position: "absolute", top: top, left: left, width: width });
    }
    // Recursively position components
    this.components.forEach(function(component){ component.position(); });
    return this;
};

// Hide self - make invisible but do not destroy
// Exempt when dashboard should persist
LocusZoom.Dashboard.prototype.hide = function(){
    if (!this.selector || this.shouldPersist()){ return this; }
    this.components.forEach(function(component){ component.hide(); });
    this.selector.style({ visibility: "hidden" });
    return this;
};

// Completely remove dashboard
LocusZoom.Dashboard.prototype.destroy = function(force){
    if (typeof force == "undefined"){ force = false; }
    if (!this.selector){ return this; }
    if (this.shouldPersist() && !force){ return this; }
    this.components.forEach(function(component){ component.destroy(true); });
    this.components = [];
    this.selector.remove();
    this.selector = null;
    return this;

};


/************************
  Dashboard Components

  A dashboard component is an empty div rendered on a dashboard that can display custom
  text of user interface elements. LocusZoom.Dashboard.Components is a singleton used to
  define and manage an extendable collection of dashboard components.
  (e.g. by LocusZoom.Dashboard.Components.add())

*/

LocusZoom.Dashboard.Component = function(layout, parent) {

    this.layout = layout || {};
    if (!this.layout.color){ this.layout.color = "gray"; }

    this.parent = parent || null;
    this.parent_panel = null;
    this.parent_plot = null;
    this.parent_svg = null; // This is a reference to either the panel or the plot, depending on what the dashboard is
                            // tied to. Useful when absolutely positioning dashboard components relative to their SVG anchor.
    if (this.parent instanceof LocusZoom.Dashboard){
        if (this.parent.type == "panel"){
            this.parent_panel = this.parent.parent;
            this.parent_plot = this.parent.parent.parent;
            this.parent_svg = this.parent_panel;
        } else {
            this.parent_plot = this.parent.parent;
            this.parent_svg = this.parent_plot;
        }
    }

    this.selector = null;
    this.button  = null;  // There is a 1-to-1 relationship of dashboard component to button
    this.persist = false; // Persist booleans will bubble up to prevent any automatic
                          // hide behavior on a component's parent dashboard
    if (!this.layout.position){ this.layout.position = "left"; }

    return this;
};
LocusZoom.Dashboard.Component.prototype.show = function(){
    if (!this.parent || !this.parent.selector){ return; }
    if (!this.selector){
        var group_position = (["start","middle","end"].indexOf(this.layout.group_position) != -1 ? " lz-dashboard-group-" + this.layout.group_position : "");
        this.selector = this.parent.selector.append("div")
            .attr("class", "lz-dashboard-" + this.layout.position + group_position);
        if (this.layout.style){ this.selector.style(this.layout.style); }
        if (typeof this.initialize == "function"){ this.initialize(); }
    }
    if (this.button && this.button.status == "highlighted"){ this.button.menu.show(); }
    this.selector.style({ visibility: "visible" });
    this.update();
    return this.position();
};
LocusZoom.Dashboard.Component.prototype.update = function(){ /* stub */ };
LocusZoom.Dashboard.Component.prototype.position = function(){
    if (this.button){ this.button.menu.position(); }
    return this;
};
LocusZoom.Dashboard.Component.prototype.shouldPersist = function(){
    if (this.persist){ return true; }
    if (this.button && this.button.persist){ return true; }
    return false;
};
LocusZoom.Dashboard.Component.prototype.hide = function(){
    if (!this.selector || this.shouldPersist()){ return this; }
    if (this.button){ this.button.menu.hide(); }
    this.selector.style({ visibility: "hidden" });
    return this;
};
LocusZoom.Dashboard.Component.prototype.destroy = function(force){
    if (typeof force == "undefined"){ force = false; }
    if (!this.selector){ return this; }
    if (this.shouldPersist() && !force){ return this; }
    if (this.button && this.button.menu){ this.button.menu.destroy(); }
    this.selector.remove();
    this.selector = null;
    this.button = null;
    return this;
};

LocusZoom.Dashboard.Components = (function() {
    var obj = {};
    var components = {};

    obj.get = function(name, layout, parent) {
        if (!name) {
            return null;
        } else if (components[name]) {
            if (typeof layout != "object"){
                throw("invalid layout argument for dashboard component [" + name + "]");
            } else {
                return new components[name](layout, parent);
            }
        } else {
            throw("dashboard component [" + name + "] not found");
        }
    };

    obj.set = function(name, component) {
        if (component) {
            if (typeof component != "function"){
                throw("unable to set dashboard component [" + name + "], argument provided is not a function");
            } else {
                components[name] = component;
                components[name].prototype = new LocusZoom.Dashboard.Component();
            }
        } else {
            delete components[name];
        }
    };

    obj.add = function(name, component) {
        if (components[name]) {
            throw("dashboard component already exists with name: " + name);
        } else {
            obj.set(name, component);
        }
    };

    obj.list = function() {
        return Object.keys(components);
    };

    return obj;
})();

/**

  LocusZoom.Dashboard.Component.Button Class

  Plots and panels may have a "dashboard" element suited for showing HTML components that may be interactive.
  When components need to incoroprate a generic button, or additionally a button that generates a menu, this
  class provides much of the necessary framework.

*/

LocusZoom.Dashboard.Component.Button = function(parent) {   
    
    if (!(parent instanceof LocusZoom.Dashboard.Component)){
        throw "Unable to create dashboard component button, invalid parent";
    }
    this.parent = parent;
    this.parent_panel = this.parent.parent_panel;
    this.parent_plot = this.parent.parent_plot;
    this.parent_svg = this.parent.parent_svg;
    this.parent_dashboard = this.parent.parent;

    this.selector = null;

    // Tag to use for the button (default: a)
    this.tag = "a";
    this.setTag = function(tag){
        if (typeof tag != "undefined"){ this.tag = tag.toString(); }
        return this;
    };

    // Text for the button to show
    this.text = "";
    this.setText = function(text){
        if (typeof text != "undefined"){ this.text = text.toString(); }
        return this;
    };

    // Title for the button to show
    this.title = "";
    this.setTitle = function(title){
        if (typeof title != "undefined"){ this.title = title.toString(); }
        return this;
    };

    // Color of the button
    this.color = "gray";
    this.setColor = function(color){
        if (typeof color != "undefined"){
            if (["gray", "red", "orange", "yellow", "green", "blue", "purple"].indexOf(color) !== -1){ this.color = color; }
            else { this.color = "gray"; }
        }
        return this;
    };

    // Arbitrary button styles
    this.style = {};
    this.setStyle = function(style){
        if (typeof style != "undefined"){ this.style = style; }
        return this;
    };

    // Method to generate a class string
    this.getClass = function(){
        var group_position = (["start","middle","end"].indexOf(this.parent.layout.group_position) != -1 ? " lz-dashboard-button-group-" + this.parent.layout.group_position : "");
        return "lz-dashboard-button lz-dashboard-button-" + this.color + (this.status ? "-" + this.status : "") + group_position;
    };

    // Permanance
    this.persist = false;
    this.permanent = false;
    this.setPermanent = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        this.permanent = bool;
        if (this.permanent){ this.persist = true; }
        return this;
    };
    this.shouldPersist = function(){
        return this.permanent || this.persist;
    };

    // Button status (highlighted / disabled)
    this.status = "";
    this.setStatus = function(status){
        if (typeof status != "undefined" && ["", "highlighted", "disabled"].indexOf(status) !== -1){ this.status = status; }
        return this.update();
    };
    this.highlight = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("highlighted"); }
        else if (this.status == "highlighted"){ return this.setStatus(""); }
        return this;
    };
    this.disable = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("disabled"); }
        else if (this.status == "disabled"){ return this.setStatus(""); }
        return this;
    };

    // Mouse events
    this.onmouseover = function(){};
    this.setOnMouseover = function(onmouseover){
        if (typeof onmouseover == "function"){ this.onmouseover = onmouseover; }
        else { this.onmouseover = function(){}; }
        return this;
    };
    this.onmouseout = function(){};
    this.setOnMouseout = function(onmouseout){
        if (typeof onmouseout == "function"){ this.onmouseout = onmouseout; }
        else { this.onmouseout = function(){}; }
        return this;
    };
    this.onclick = function(){};
    this.setOnclick = function(onclick){
        if (typeof onclick == "function"){ this.onclick = onclick; }
        else { this.onclick = function(){}; }
        return this;
    };
    
    // Primary behavior functions
    this.show = function(){
        if (!this.parent){ return; }
        if (!this.selector){
            this.selector = this.parent.selector.append(this.tag).attr("class", this.getClass());
        }
        return this.update();
    };
    this.preUpdate = function(){ return this; };
    this.update = function(){
        if (!this.selector){ return this; }
        this.preUpdate();
        this.selector
            .attr("class", this.getClass())
            .attr("title", this.title).style(this.style)
            .on("mouseover", (this.status == "disabled") ? null : this.onmouseover)
            .on("mouseout", (this.status == "disabled") ? null : this.onmouseout)
            .on("click", (this.status == "disabled") ? null : this.onclick)
            .text(this.text);
        this.menu.update();
        this.postUpdate();
        return this;
    };
    this.postUpdate = function(){ return this; };
    this.hide = function(){
        if (this.selector && !this.shouldPersist()){
            this.selector.remove();
            this.selector = null;
        }
        return this;
    };    

    // Button Menu Object
    // The menu is an HTML overlay that can appear below a button. It can contain arbitrary HTML and
    // has logic to be automatically positioned and sized to behave more or less like a dropdown menu.
    this.menu = {
        outer_selector: null,
        inner_selector: null,
        scroll_position: 0,
        hidden: true,
        show: function(){
            if (!this.menu.outer_selector){
                this.menu.outer_selector = d3.select(this.parent_plot.svg.node().parentNode).append("div")
                    .attr("class", "lz-dashboard-menu lz-dashboard-menu-" + this.color)
                    .attr("id", this.parent_svg.getBaseId() + ".dashboard.menu");
                this.menu.inner_selector = this.menu.outer_selector.append("div")
                    .attr("class", "lz-dashboard-menu-content");
                this.menu.inner_selector.on("scroll", function(){
                    this.menu.scroll_position = this.menu.inner_selector.node().scrollTop;
                }.bind(this));
            }
            this.menu.outer_selector.style({ visibility: "visible" });
            this.menu.hidden = false;
            return this.menu.update();
        }.bind(this),
        update: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.populate(); // This function is stubbed for all buttons by default and custom implemented in component definition
            if (this.menu.inner_selector){ this.menu.inner_selector.node().scrollTop = this.menu.scroll_position; }
            return this.menu.position();
        }.bind(this),
        position: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            // Unset any explicitly defined outer selector height so that menus dynamically shrink if content is removed
            this.menu.outer_selector.style({ height: null });
            var padding = 3;
            var scrollbar_padding = 20;
            var menu_height_padding = 14; // 14: 2x 6px padding, 2x 1px border
            var page_origin = this.parent_svg.getPageOrigin();
            var page_scroll_top = document.documentElement.scrollTop || document.body.scrollTop;
            var container_offset = this.parent_plot.getContainerOffset();
            var dashboard_client_rect = this.parent_dashboard.selector.node().getBoundingClientRect();
            var button_client_rect = this.selector.node().getBoundingClientRect();
            var menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
            var total_content_height = this.menu.inner_selector.node().scrollHeight;
            var top = 0; var left = 0;
            if (this.parent_dashboard.type == "panel"){
                top = (page_origin.y + dashboard_client_rect.height + (2 * padding));
                left = Math.max(page_origin.x + this.parent_svg.layout.width - menu_client_rect.width - padding, page_origin.x + padding);
            } else {
                top = button_client_rect.bottom + page_scroll_top + padding - container_offset.top;
                left = Math.max(button_client_rect.left + button_client_rect.width - menu_client_rect.width - container_offset.left, page_origin.x + padding);
            }
            var base_max_width = Math.max(this.parent_svg.layout.width - (2 * padding) - scrollbar_padding, scrollbar_padding);
            var container_max_width = base_max_width;
            var content_max_width = (base_max_width - (4 * padding));
            var base_max_height = Math.max(this.parent_svg.layout.height - (10 * padding) - menu_height_padding, menu_height_padding);
            var height = Math.min(total_content_height, base_max_height);
            var max_height = base_max_height;
            this.menu.outer_selector.style({
                "top": top.toString() + "px",
                "left": left.toString() + "px",
                "max-width": container_max_width.toString() + "px",
                "max-height": max_height.toString() + "px",
                "height": height.toString() + "px"
            });
            this.menu.inner_selector.style({ "max-width": content_max_width.toString() + "px" });
            this.menu.inner_selector.node().scrollTop = this.menu.scroll_position;
            return this.menu;
        }.bind(this),
        hide: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.outer_selector.style({ visibility: "hidden" });
            this.menu.hidden = true;
            return this.menu;
        }.bind(this),
        destroy: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.inner_selector.remove();
            this.menu.outer_selector.remove();
            this.menu.inner_selector = null;
            this.menu.outer_selector = null;
            return this.menu;
        }.bind(this),
        // By convention populate() does nothing and should be reimplemented with each dashboard button definition
        // Reimplement by way of Dashboard.Component.Button.menu.setPopulate to define the populate method and hook up standard menu
        // click-toggle behaviorprototype.
        populate: function(){ /* stub */ }.bind(this),
        setPopulate: function(menu_populate_function){
            if (typeof menu_populate_function == "function"){
                this.menu.populate = menu_populate_function;
                this.setOnclick(function(){
                    if (this.menu.hidden){
                        this.menu.show();
                        this.highlight().update();
                        this.persist = true;
                    } else {
                        this.menu.hide();
                        this.highlight(false).update();
                        if (!this.permanent){ this.persist = false; }
                    }
                }.bind(this));
            } else {
                this.setOnclick();
            }
            return this;
        }.bind(this)
    };

};

// Title component - show a generic title
LocusZoom.Dashboard.Components.add("title", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.show = function(){
        this.div_selector = this.parent.selector.append("div")
            .attr("class", "lz-dashboard-title lz-dashboard-" + this.layout.position);
        this.title_selector = this.div_selector.append("h3");
        return this.update();
    };
    this.update = function(){
        var title = layout.title.toString();
        if (this.layout.subtitle){ title += " <small>" + this.layout.subtitle + "</small>"; }
        this.title_selector.html(title);
        return this;
    };
});

// Dimensions component - show current dimensions of the plot
LocusZoom.Dashboard.Components.add("dimensions", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        var display_width = this.parent_plot.layout.width.toString().indexOf(".") == -1 ? this.parent_plot.layout.width : this.parent_plot.layout.width.toFixed(2);
        var display_height = this.parent_plot.layout.height.toString().indexOf(".") == -1 ? this.parent_plot.layout.height : this.parent_plot.layout.height.toFixed(2);
        this.selector.text(display_width + "px × " + display_height + "px");
        if (layout.class){ this.selector.attr("class", layout.class); }
        if (layout.style){ this.selector.style(layout.style); }
        return this;
    };
});

// Region Scale component - show the size of the region in state
LocusZoom.Dashboard.Components.add("region_scale", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (!isNaN(this.parent_plot.state.start) && !isNaN(this.parent_plot.state.end)
            && this.parent_plot.state.start != null && this.parent_plot.state.end != null){
            this.selector.style("display", null);
            this.selector.text(LocusZoom.positionIntToString(this.parent_plot.state.end - this.parent_plot.state.start, null, true));
        } else {
            this.selector.style("display", "none");
        }
        if (layout.class){ this.selector.attr("class", layout.class); }
        if (layout.style){ this.selector.style(layout.style); }
        return this;
    };
});

// Download component - button to export current plot to an SVG image
LocusZoom.Dashboard.Components.add("download", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("Download Image").setTitle("Download image of the current plot as locuszoom.svg")
            .setOnMouseover(function() {
                this.button.selector
                    .classed("lz-dashboard-button-gray-disabled", true)
                    .text("Preparing Image");
                this.generateBase64SVG().then(function(base64_string){
                    this.button.selector
                        .attr("href", "data:image/svg+xml;base64,\n" + base64_string)
                        .classed("lz-dashboard-button-gray-disabled", false)
                        .classed("lz-dashboard-button-gray-highlighted", true)
                        .text("Download Image");
                }.bind(this));
            }.bind(this))
            .setOnMouseout(function() {
                this.button.selector.classed("lz-dashboard-button-gray-highlighted", false);
            }.bind(this));
        this.button.show();
        this.button.selector.attr("href-lang", "image/svg+xml").attr("download", "locuszoom.svg");
        return this;
    };
    this.css_string = "";
    for (var stylesheet in Object.keys(document.styleSheets)){
        if ( document.styleSheets[stylesheet].href != null
             && document.styleSheets[stylesheet].href.indexOf("locuszoom.css") != -1){
            LocusZoom.createCORSPromise("GET", document.styleSheets[stylesheet].href)
                .then(function(response){
                    this.css_string = response.replace(/[\r\n]/g," ").replace(/\s+/g," ");
                    if (this.css_string.indexOf("/* ! LocusZoom HTML Styles */")){
                        this.css_string = this.css_string.substring(0, this.css_string.indexOf("/* ! LocusZoom HTML Styles */"));
                    }
                }.bind(this));
            break;
        }
    } 
    this.generateBase64SVG = function(){
        return Q.fcall(function () {
            // Insert a hidden div, clone the node into that so we can modify it with d3
            var container = this.parent.selector.append("div").style("display", "none")
                .html(this.parent_plot.svg.node().outerHTML);
            // Remove unnecessary elements
            container.selectAll("g.lz-curtain").remove();
            container.selectAll("g.lz-mouse_guide").remove();
            // Convert units on axis tick dy attributes from ems to pixels
            container.selectAll("g.tick text").each(function(){
                var dy = +(d3.select(this).attr("dy").substring(-2).slice(0,-2))*10;
                d3.select(this).attr("dy", dy);
            });
            // Pull the svg into a string and add the contents of the locuszoom stylesheet
            // Don't add this with d3 because it will escape the CDATA declaration incorrectly
            var initial_html = d3.select(container.select("svg").node().parentNode).html();
            var style_def = "<style type=\"text/css\"><![CDATA[ " + this.css_string + " ]]></style>";
            var insert_at = initial_html.indexOf(">") + 1;
            initial_html = initial_html.slice(0,insert_at) + style_def + initial_html.slice(insert_at);
            // Delete the container node
            container.remove();
            // Base64-encode the string and return it
            return btoa(encodeURIComponent(initial_html).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                return String.fromCharCode("0x" + p1);
            }));
        }.bind(this));
    };
});

// Remove Panel component - button to remove panel from plot
LocusZoom.Dashboard.Components.add("remove_panel", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("×").setTitle("Remove panel")
            .setOnclick(function(){
                if (confirm("Are you sure you want to remove this panel? This cannot be undone!")){
                    var panel = this.parent_panel;
                    panel.dashboard.hide(true);
                    d3.select(panel.parent.svg.node().parentNode).on("mouseover." + panel.getBaseId() + ".dashboard", null);
                    d3.select(panel.parent.svg.node().parentNode).on("mouseout." + panel.getBaseId() + ".dashboard", null);
                    return panel.parent.removePanel(panel.id);
                }
                return false;
            }.bind(this));
        this.button.show();
        return this;
    };
});

// Move Panel Up
LocusZoom.Dashboard.Components.add("move_panel_up", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){
            var is_at_top = (this.parent_panel.layout.y_index == 0);
            this.button.disable(is_at_top);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("▴").setTitle("Move panel up")
            .setOnclick(function(){
                this.parent_panel.moveUp();
                this.update();
            }.bind(this));
        this.button.show();
        return this.update();
    };
});

// Move Panel Down
LocusZoom.Dashboard.Components.add("move_panel_down", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){
            var is_at_bottom = (this.parent_panel.layout.y_index == this.parent_plot.panel_ids_by_y_index.length-1);
            this.button.disable(is_at_bottom);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("▾").setTitle("Move panel down")
            .setOnclick(function(){
                this.parent_panel.moveDown();
                this.update();
            }.bind(this));
        this.button.show();
        return this.update();
    };
});

// Shift Region
LocusZoom.Dashboard.Components.add("shift_region", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)){
        this.update = function(){ return; };
        console.warn("Unable to add shift_region dashboard component: plot state does not have region bounds");
        return;
    }
    if (isNaN(layout.step) || layout.step == 0){ layout.step = 50000; }
    if (typeof layout.button_html != "string"){ layout.button_html = layout.step > 0 ? ">" : "<"; }
    if (typeof layout.button_title != "string"){
        layout.button_title = "Shift region by " + (layout.step > 0 ? "+" : "-") + LocusZoom.positionIntToString(Math.abs(layout.step),null,true);
    }
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start + layout.step, 1),
                    end: this.parent_plot.state.end + layout.step
                });
            }.bind(this));
        this.button.show();
        return this;
    };
});

// Zoom Region
LocusZoom.Dashboard.Components.add("zoom_region", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)){
        this.update = function(){ return; };
        console.warn("Unable to add zoom_region dashboard component: plot state does not have region bounds");
        return;
    }
    if (isNaN(layout.step) || layout.step == 0){ layout.step = 0.2; }
    if (typeof layout.button_html != "string"){ layout.button_html = layout.step > 0 ? "z–" : "z+"; }
    if (typeof layout.button_title != "string"){
        layout.button_title = "Zoom region " + (layout.step > 0 ? "out" : "in") + " by " + (Math.abs(layout.step)*100).toFixed(1) + "%";
    }
    this.update = function(){
        if (this.button){
            var can_zoom = true;
            var current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
            if (layout.step > 0 && !isNaN(this.parent_plot.layout.max_region_scale) && current_region_scale >= this.parent_plot.layout.max_region_scale){
                can_zoom = false;
            }
            if (layout.step < 0 && !isNaN(this.parent_plot.layout.min_region_scale) && current_region_scale <= this.parent_plot.layout.min_region_scale){
                can_zoom = false;
            }
            this.button.disable(!can_zoom);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                var current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
                var zoom_factor = 1 + layout.step;
                var new_region_scale = current_region_scale * zoom_factor;
                if (!isNaN(this.parent_plot.layout.max_region_scale)){
                    new_region_scale = Math.min(new_region_scale, this.parent_plot.layout.max_region_scale);
                }
                if (!isNaN(this.parent_plot.layout.min_region_scale)){
                    new_region_scale = Math.max(new_region_scale, this.parent_plot.layout.min_region_scale);
                }
                var delta = Math.floor((new_region_scale - current_region_scale) / 2);
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start - delta, 1),
                    end: this.parent_plot.state.end + delta
                });
            }.bind(this));
        this.button.show();
        return this;
    };
});

// Menu component - button to display a menu showing arbitrary HTML
LocusZoom.Dashboard.Components.add("menu", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title);
        this.button.menu.setPopulate(function(){
            this.button.menu.inner_selector.html(layout.menu_html);
        }.bind(this));
        this.button.show();
        return this;
    };
});

// Model covariates component - special button/menu to allow model building by individual covariants
LocusZoom.Dashboard.Components.add("covariates_model", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);

    this.initialize = function(){
        // Initialize state.model.covariates
        this.parent_plot.state.model = this.parent_plot.state.model || {};
        this.parent_plot.state.model.covariates = this.parent_plot.state.model.covariates || [];
        // Create an object at the plot level for easy access to interface methods in custom client-side JS
        this.parent_plot.CovariatesModel = {
            button: this,
            add: function(element_reference){
                // Generate element json from passed reference to evaluate against / add to state
                var element = JSON.parse(JSON.stringify(element_reference));
                if (typeof element_reference == "object" && typeof element.html != "string"){
                    element.html = ( (typeof element_reference.toHTML == "function") ? element_reference.toHTML() : element_reference.toString());
                }
                // Check if the element is already in the model covariates array and return if it is.
                for (var i = 0; i < this.state.model.covariates.length; i++) {
                    if (JSON.stringify(this.state.model.covariates[i]) === JSON.stringify(element)) {
                        return this;
                    }
                }
                this.state.model.covariates.push(element);
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            removeByIdx: function(idx){
                if (typeof this.state.model.covariates[idx] == "undefined"){
                    throw("Unable to remove model covariate, invalid index: " + idx.toString());
                }
                this.state.model.covariates.splice(idx, 1);
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            removeAll: function(){
                this.state.model.covariates = [];
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            updateComponent: function(){
                this.button.update();
                this.button.menu.update();
            }.bind(this)
        };
    }.bind(this);

    this.update = function(){

        if (this.button){ return this; }

        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.button.menu.populate();
            }.bind(this));

        this.button.menu.setPopulate(function(){
            var selector = this.button.menu.inner_selector;
            selector.html("");
            // General model HTML representation
            if (typeof this.parent_plot.state.model.html != "undefined"){
                selector.append("div").html(this.parent_plot.state.model.html);
            }
            // Model covariates table
            if (!this.parent_plot.state.model.covariates.length){
                selector.append("i").text("no covariates in model");
            } else {
                selector.append("h5").html("Model Covariates (" + this.parent_plot.state.model.covariates.length + ")");
                var table = selector.append("table");
                this.parent_plot.state.model.covariates.forEach(function(covariate, idx){
                    var html = ( (typeof covariate == "object" && typeof covariate.html == "string") ? covariate.html : covariate.toString() );
                    var row = table.append("tr");
                    row.append("td").append("button")
                        .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.layout.color)
                        .style({ "margin-left": "0em" })
                        .on("click", function(){
                            this.parent_plot.CovariatesModel.removeByIdx(idx);
                        }.bind(this))
                        .text("×");
                    row.append("td").html(html);
                }.bind(this));
                selector.append("button")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.layout.color)
                    .style({ "margin-left": "4px" }).html("× Remove All Covariates")
                    .on("click", function(){
                        this.parent_plot.CovariatesModel.removeAll();
                    }.bind(this));
            }
        }.bind(this));

        this.button.preUpdate = function(){
            var text = "Model";
            if (this.parent_plot.state.model.covariates.length){
                var cov = this.parent_plot.state.model.covariates.length > 1 ? "covariates" : "covariate";
                text += " (" + this.parent_plot.state.model.covariates.length + " " + cov + ")";
            }
            this.button.setText(text).disable(false);
        }.bind(this);

        this.button.show();

        return this;
    };
});

// Toggle Split Tracks
LocusZoom.Dashboard.Components.add("toggle_split_tracks", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    if (!layout.data_layer_id){ layout.data_layer_id = "intervals"; }
    if (!this.parent_panel.data_layers[layout.data_layer_id]){
        throw ("Dashboard toggle split tracks component missing valid data layer ID");
    }
    this.update = function(){
        var data_layer = this.parent_panel.data_layers[layout.data_layer_id];
        var text = data_layer.layout.split_tracks ? "Merge Tracks" : "Split Tracks";
        if (this.button){
            this.button.setText(text);
            this.button.show();
            this.parent.position();
            return this;
        } else {
            this.button = new LocusZoom.Dashboard.Component.Button(this)
                .setColor(layout.color).setText(text)
                .setTitle("Toggle whether tracks are split apart or merged together")
                .setOnclick(function(){
                    data_layer.toggleSplitTracks();
                    if (this.scale_timeout){ clearTimeout(this.scale_timeout); }
                    var timeout = data_layer.layout.transition ? +data_layer.layout.transition.duration || 0 : 0;
                    this.scale_timeout = setTimeout(function(){
                        this.parent_panel.scaleHeightToData();
                        this.parent_plot.positionPanels();
                    }.bind(this), timeout);
                    this.update();
                }.bind(this));
            return this.update();
        }
    };
});

// Resize to data
LocusZoom.Dashboard.Components.add("resize_to_data", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("Resize to Data")
            .setTitle("Automatically resize this panel to fit the data its currently showing")
            .setOnclick(function(){
                this.parent_panel.scaleHeightToData();
                this.update();
            }.bind(this));
        this.button.show();
        return this;
    };
});

// Toggle legend
LocusZoom.Dashboard.Components.add("toggle_legend", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        var text = this.parent_panel.legend.layout.hidden ? "Show Legend" : "Hide Legend";
        if (this.button){
            this.button.setText(text).show();
            this.parent.position();
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color)
            .setTitle("Show or hide the legend for this panel")
            .setOnclick(function(){
                this.parent_panel.legend.layout.hidden = !this.parent_panel.legend.layout.hidden;
                this.parent_panel.legend.render();
                this.update();
            }.bind(this));
        return this.update();
    };
});

// Data Layers - menu for manipulating data layers in a panel
LocusZoom.Dashboard.Components.add("data_layers", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);

    this.update = function(){

        if (typeof layout.button_html != "string"){ layout.button_html = "Data Layers"; }
        if (typeof layout.button_title != "string"){ layout.button_title = "Manipulate Data Layers (sort, dim, show/hide, etc.)"; }

        if (this.button){ return this; }

        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.button.menu.populate();
            }.bind(this));

        this.button.menu.setPopulate(function(){
            this.button.menu.inner_selector.html("");
            var table = this.button.menu.inner_selector.append("table");
            this.parent_panel.data_layer_ids_by_z_index.slice().reverse().forEach(function(id, idx){
                var data_layer = this.parent_panel.data_layers[id];
                var name = (typeof data_layer.layout.name != "string") ? data_layer.id : data_layer.layout.name;
                var row = table.append("tr");
                // Layer name
                row.append("td").html(name);
                // Status toggle buttons
                layout.statuses.forEach(function(status_adj){
                    var status_idx = LocusZoom.DataLayer.Statuses.adjectives.indexOf(status_adj);
                    var status_verb = LocusZoom.DataLayer.Statuses.verbs[status_idx];
                    var text, onclick, highlight;
                    if (data_layer.global_statuses[status_adj]){
                        text = LocusZoom.DataLayer.Statuses.menu_antiverbs[status_idx];
                        onclick = "un" + status_verb + "AllElements";
                        highlight = "-highlighted";
                    } else {
                        text = LocusZoom.DataLayer.Statuses.verbs[status_idx];
                        onclick = status_verb + "AllElements";
                        highlight = "";
                    }
                    row.append("td").append("a")
                        .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.layout.color + highlight)
                        .style({ "margin-left": "0em" })
                        .on("click", function(){ data_layer[onclick](); this.button.menu.populate(); }.bind(this))
                        .text(text);
                }.bind(this));
                // Sort layer buttons
                var at_top = (idx == 0);
                var at_bottom = (idx == (this.parent_panel.data_layer_ids_by_z_index.length - 1));
                var td = row.append("td");
                td.append("a")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-group-start lz-dashboard-button-" + this.layout.color + (at_bottom ? "-disabled" : ""))
                    .style({ "margin-left": "0em" })
                    .on("click", function(){ data_layer.moveDown(); this.button.menu.populate(); }.bind(this))
                    .text("▾").attr("title", "Move layer down (further back)");
                td.append("a")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-group-middle lz-dashboard-button-" + this.layout.color + (at_top ? "-disabled" : ""))
                    .style({ "margin-left": "0em" })
                    .on("click", function(){ data_layer.moveUp(); this.button.menu.populate(); }.bind(this))
                    .text("▴").attr("title", "Move layer up (further front)");
                td.append("a")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-group-end lz-dashboard-button-red")
                    .style({ "margin-left": "0em" })
                    .on("click", function(){
                        if (confirm("Are you sure you want to remove the " + name + " layer? This cannot be undone!")){
                            data_layer.parent.removeDataLayer(id);
                        }
                        return this.button.menu.populate();
                    }.bind(this))
                    .text("×").attr("title", "Remove layer");
            }.bind(this));
            return this;
        }.bind(this));

        this.button.show();

        return this;
    };
});

/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Legend

  A legend is an SVG object used to display contextual information about a panel.
  Panel layouts determine basic features of a legend - its position in the panel,
  its orientation, title, etc. Layouts of child data layers of the panel determine
  a legend's actual content.

*/

LocusZoom.Legend = function(parent){

    // parent must be a locuszoom panel
    if (!parent instanceof LocusZoom.Panel){
        throw "Unable to create legend, parent must be a locuszoom panel";
    }
    this.parent = parent;
    this.id = this.parent.getBaseId() + ".legend";

    this.parent.layout.legend = LocusZoom.Layouts.merge(this.parent.layout.legend || {}, LocusZoom.Legend.DefaultLayout);
    this.layout = this.parent.layout.legend;

    this.selector = null;
    this.background_rect = null;
    this.elements = [];
    this.hidden = false;

    return this.render();

};

LocusZoom.Legend.DefaultLayout = {
    orientation: "vertical",
    origin: { x: 0, y: 0 },
    width: 10,
    height: 10,
    padding: 5,
    label_size: 12,
    hidden: false
};

LocusZoom.Legend.prototype.render = function(){

    // Get a legend group selector if not yet defined
    if (!this.selector){
        this.selector = this.parent.svg.group.append("g")
            .attr("id", this.parent.getBaseId() + ".legend").attr("class", "lz-legend");
    }

    // Get a legend background rect selector if not yet defined
    if (!this.background_rect){
        this.background_rect = this.selector.append("rect")
            .attr("width", 100).attr("height", 100).attr("class", "lz-legend-background");
    }

    // Get a legend elements group selector if not yet defined
    if (!this.elements_group){
        this.elements_group = this.selector.append("g");
    }

    // Remove all elements
    this.elements.forEach(function(element){
        element.remove();
    });
    this.elements = [];

    // Gather all elements from data layers in order (top to bottom) and render them
    var padding = +this.layout.padding || 1;
    var x = padding;
    var y = padding;
    var line_height = 0;
    this.parent.data_layer_ids_by_z_index.slice().reverse().forEach(function(id){
        if (Array.isArray(this.parent.data_layers[id].layout.legend)){
            this.parent.data_layers[id].layout.legend.forEach(function(element){
                var selector = this.elements_group.append("g")
                    .attr("transform", "translate(" + x + "," + y + ")");
                var label_size = +element.label_size || +this.layout.label_size || 12;
                var label_x = 0;
                var label_y = (label_size/2) + (padding/2);
                line_height = Math.max(line_height, label_size + padding);
                // Draw the legend element symbol (line, rect, shape, etc)
                if (element.shape == "line"){
                    // Line symbol
                    var length = +element.length || 16;
                    var path_y = (label_size/4) + (padding/2);
                    selector.append("path").attr("class", element.class || "")
                        .attr("d", "M0," + path_y + "L" + length + "," + path_y)
                        .style(element.style || {});
                    label_x = length + padding;
                } else if (element.shape == "rect"){
                    // Rect symbol
                    var width = +element.width || 16;
                    var height = +element.height || width;
                    selector.append("rect").attr("class", element.class || "")
                        .attr("width", width).attr("height", height)
                        .attr("fill", element.color || {})
                        .style(element.style || {});
                    label_x = width + padding;
                    line_height = Math.max(line_height, height + padding);
                } else if (d3.svg.symbolTypes.indexOf(element.shape) != -1) {
                    // Shape symbol (circle, diamond, etc.)
                    var size = +element.size || 40;
                    var radius = Math.ceil(Math.sqrt(size/Math.PI));
                    selector.append("path").attr("class", element.class || "")
                        .attr("d", d3.svg.symbol().size(size).type(element.shape))
                        .attr("transform", "translate(" + radius + "," + (radius+(padding/2)) + ")")
                        .attr("fill", element.color || {})
                        .style(element.style || {});
                    label_x = (2*radius) + padding;
                    label_y = Math.max((2*radius)+(padding/2), label_y);
                    line_height = Math.max(line_height, (2*radius) + padding);
                }
                // Draw the legend element label
                selector.append("text").attr("text-anchor", "left").attr("class", "lz-label")
                    .attr("x", label_x).attr("y", label_y).style({"font-size": label_size}).text(element.label);
                // Position the legend element group based on legend layout orientation
                var bcr = selector.node().getBoundingClientRect();
                if (this.layout.orientation == "vertical"){
                    y += bcr.height + padding;
                    line_height = 0;
                } else {
                    // Ensure this element does not exceed the panel width
                    // (E.g. drop to the next line if it does, but only if it's not the only element on this line)
                    var right_x = this.layout.origin.x + x + bcr.width;
                    if (x > padding && right_x > this.parent.layout.width){
                        y += line_height;
                        x = padding;
                        selector.attr("transform", "translate(" + x + "," + y + ")");
                    }
                    x += bcr.width + (3*padding);
                }
                // Store the element
                this.elements.push(selector);
            }.bind(this));
        }
    }.bind(this));

    // Scale the background rect to the elements in the legend
    var bcr = this.elements_group.node().getBoundingClientRect();
    this.layout.width = bcr.width + (2*this.layout.padding);
    this.layout.height = bcr.height + (2*this.layout.padding);
    this.background_rect
        .attr("width", this.layout.width)
        .attr("height", this.layout.height);

    // Set the visibility on the legend from the "hidden" flag
    this.selector.style({ visibility: this.layout.hidden ? "hidden" : "visible" });
    
    return this.position();
    
};

LocusZoom.Legend.prototype.position = function(){
    if (!this.selector){ return this; }
    var bcr = this.selector.node().getBoundingClientRect();
    if (!isNaN(+this.layout.pad_from_bottom)){
        this.layout.origin.y = this.parent.layout.height - bcr.height - +this.layout.pad_from_bottom;
    }
    if (!isNaN(+this.layout.pad_from_right)){
        this.layout.origin.x = this.parent.layout.width - bcr.width - +this.layout.pad_from_right;
    }
    this.selector.attr("transform", "translate(" + this.layout.origin.x + "," + this.layout.origin.y + ")");
};

LocusZoom.Legend.prototype.hide = function(){
    this.layout.hidden = true;
    this.render();
};

LocusZoom.Legend.prototype.show = function(){
    this.layout.hidden = false;
    this.render();
};

/* global LocusZoom,Q */
/* eslint-env browser */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */

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

LocusZoom.Data.Field = function(field){
    
    var parts = /^(?:([^:]+):)?([^:\|]*)(\|.+)*$/.exec(field);

    this.full_name = field;
    
    this.namespace = parts[1] || null;
    this.name = parts[2] || null;
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
        if (typeof d[this.full_name] != "undefined"){
            return d[this.full_name];
        } else {
            var val = null;
            if (typeof d[this.namespace+":"+this.name] != "undefined"){ val = d[this.namespace+":"+this.name]; }
            else if (typeof d[this.name] != "undefined"){ val = d[this.name]; }
            d[this.full_name] = this.applyTransformations(val);
            return d[this.full_name];
        }
    };
    
};

/* The Requester passes state information to data sources to pull data */

LocusZoom.Data.Requester = function(sources) {

    function split_requests(fields) {
        var requests = {};
        // Regular expression finds namespace:field|trans
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


LocusZoom.Data.Source.prototype.parseResponse = function(resp, chain, fields, outnames, trans) {
    var json = typeof resp == "string" ? JSON.parse(resp) : resp;
    var records = this.parseData(json.data || json, fields, outnames, trans);
    return {header: chain.header || {}, body: records};
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
  Data Source for Association Data
*/
LocusZoom.Data.AssociationSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "AssociationLZ");

LocusZoom.Data.AssociationSource.prototype.preGetData = function(state, fields, outnames, trans) {
    var id_field = this.params.id_field || "id";
    [id_field, "position"].forEach(function(x) {
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
  Data Source for LD Data
*/
LocusZoom.Data.LDSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "LDLZ");

LocusZoom.Data.LDSource.prototype.preGetData = function(state, fields) {
    if (fields.length>1) {
        if (fields.length!=2 || fields.indexOf("isrefvar")==-1) {
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
    var dataFields = {id: this.params.id_field, position: this.params.position_field, 
                      pvalue: this.params.pvalue_field, _names_:null};
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
        if(fields[i]=="isrefvar") {
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
    if (refVar == "state") {
        refVar = state.ldrefvar || chain.header.ldrefvar || "best";
    }
    if (refVar == "best") {
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
  Data Source for Gene Data
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
  Data Source for Gene Constraint Data
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
    var data = JSON.parse(resp);
    // Loop through the array of genes in the body and match each to a result from the contraints request
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
                if (typeof val == "number" && val.toString().indexOf(".") != -1){
                    val = parseFloat(val.toFixed(2));
                }
                chain.body[i][field] = val;
            } else {
                // If the gene did not come back in the response then set the same field with a null values
                chain.body[i][field] = null;
            }
        });
    });
    return {header: chain.header, body: chain.body};
};

/**
  Data Source for Recombination Rate Data
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
  Data Source for Interval Annotation Data (e.g. BED Tracks)
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
  Data Source for Static JSON Data
*/
LocusZoom.Data.StaticSource = LocusZoom.Data.Source.extend(function(data) {
    this._data = data;
},"StaticJSON");

LocusZoom.Data.StaticSource.prototype.getRequest = function(state, chain, fields) {
    return Q.fcall(function() {return this._data;}.bind(this));
};

LocusZoom.Data.StaticSource.prototype.toJSON = function() {
    return [Object.getPrototypeOf(this).constructor.SOURCE_NAME, this._data];
};

/**
  Data source for PheWAS data served from JSON files
*/
LocusZoom.Data.PheWASSource = LocusZoom.Data.Source.extend(function(init) {
    this.parseInit(init);
}, "PheWASLZ");
LocusZoom.Data.PheWASSource.prototype.getURL = function(state, chain, fields) {
    return this.url + state.variant + ".json";
};
LocusZoom.Data.PheWASSource.prototype.parseResponse = function(resp, chain, fields, outnames, trans) {
    var data = JSON.parse(resp);
    data.forEach(function(d, i){
        data[i].x = i;
        data[i].id = i.toString();
    });
    return {header: chain.header, body: data};
};

/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Plot Class

  An Plot is an independent LocusZoom object. Many such LocusZoom objects can exist simultaneously
  on a single page, each having its own layout.

*/

LocusZoom.Plot = function(id, datasource, layout) {

    this.initialized = false;
    this.parent_plot = this;

    this.id = id;
    
    this.container = null;
    this.svg = null;

    this.panels = {};
    this.panel_ids_by_y_index = [];
    this.applyPanelYIndexesToPanelLayouts = function(){
        this.panel_ids_by_y_index.forEach(function(pid, idx){
            this.panels[pid].layout.y_index = idx;
        }.bind(this));
    };

    this.getBaseId = function(){
        return this.id;
    };

    this.remap_promises = [];

    // The layout is a serializable object used to describe the composition of the Plot
    // If no layout was passed, use the Standard Association Layout
    // Otherwise merge whatever was passed with the Default Layout
    if (typeof layout == "undefined"){
        this.layout = LocusZoom.Layouts.merge({}, LocusZoom.Layouts.get("plot", "standard_association"));
    } else {
        this.layout = layout;
    }
    LocusZoom.Layouts.merge(this.layout, LocusZoom.Plot.DefaultLayout);

    // Create a shortcut to the state in the layout on the Plot
    this.state = this.layout.state;
    
    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);

    // Window.onresize listener (responsive layouts only)
    this.window_onresize = null;

    // Event hooks
    this.event_hooks = {
        "layout_changed": [],
        "data_requested": [],
        "data_rendered": [],
        "element_clicked": []
    };
    this.on = function(event, hook){
        if (typeof "event" != "string" || !Array.isArray(this.event_hooks[event])){
            throw("Unable to register event hook, invalid event: " + event.toString());
        }
        if (typeof hook != "function"){
            throw("Unable to register event hook, invalid hook function passed");
        }
        this.event_hooks[event].push(hook);
        return this;
    };
    this.emit = function(event, context){
        if (typeof "event" != "string" || !Array.isArray(this.event_hooks[event])){
            throw("LocusZoom attempted to throw an invalid event: " + event.toString());
        }
        context = context || this;
        this.event_hooks[event].forEach(function(hookToRun) {
            hookToRun.call(context);
        });
        return this;
    };

    // Get an object with the x and y coordinates of the Plot's origin in terms of the entire page
    // Necessary for positioning any HTML elements over the plot
    this.getPageOrigin = function(){
        var bounding_client_rect = this.svg.node().getBoundingClientRect();
        var x_offset = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y_offset = document.documentElement.scrollTop || document.body.scrollTop;
        var container = this.svg.node();
        while (container.parentNode != null){
            container = container.parentNode;
            if (container != document && d3.select(container).style("position") != "static"){
                x_offset = -1 * container.getBoundingClientRect().left;
                y_offset = -1 * container.getBoundingClientRect().top;
                break;
            }
        }
        return {
            x: x_offset + bounding_client_rect.left,
            y: y_offset + bounding_client_rect.top,
            width: bounding_client_rect.width,
            height: bounding_client_rect.height
        };
    };

    // Get the top and left offset values for the plot's container element (the div that was populated)
    this.getContainerOffset = function(){
        var offset = { top: 0, left: 0 };
        var container = this.container.offsetParent || null;
        while (container != null){
            offset.top += container.offsetTop;
            offset.left += container.offsetLeft;
            container = container.offsetParent || null;
        }
        return offset;
    };

    // Event information describing interaction (e.g. panning and zooming) is stored on the plot
    this.interaction = {};
    this.canInteract = function(panel_id){
        panel_id = panel_id || null;
        if (panel_id){
            return ((typeof this.interaction.panel_id == "undefined" || this.interaction.panel_id == panel_id) && !this.loading_data);
        } else {
            return !(this.interaction.dragging || this.interaction.zooming || this.loading_data);
        }
    };

    // Initialize the layout
    this.initializeLayout();

    return this;
  
};

// Default Layout
LocusZoom.Plot.DefaultLayout = {
    state: {},
    width: 1,
    height: 1,
    min_width: 1,
    min_height: 1,
    responsive_resize: false,
    aspect_ratio: 1,
    panels: [],
    dashboard: {
        components: []
    },
    panel_boundaries: true
};

// Helper method to sum the proportional dimensions of panels, a value that's checked often as panels are added/removed
LocusZoom.Plot.prototype.sumProportional = function(dimension){
    if (dimension != "height" && dimension != "width"){
        throw ("Bad dimension value passed to LocusZoom.Plot.prototype.sumProportional");
    }
    var total = 0;
    for (var id in this.panels){
        // Ensure every panel contributing to the sum has a non-zero proportional dimension
        if (!this.panels[id].layout["proportional_" + dimension]){
            this.panels[id].layout["proportional_" + dimension] = 1 / Object.keys(this.panels).length;
        }
        total += this.panels[id].layout["proportional_" + dimension];
    }
    return total;
};

LocusZoom.Plot.prototype.rescaleSVG = function(){
    var clientRect = this.svg.node().getBoundingClientRect();
    this.setDimensions(clientRect.width, clientRect.height);
    return this;
};

LocusZoom.Plot.prototype.initializeLayout = function(){

    // Sanity check layout values
    // TODO: Find a way to generally abstract this, maybe into an object that models allowed layout values?
    if (isNaN(this.layout.width) || this.layout.width <= 0){
        throw ("Plot layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.height) || this.layout.height <= 0){
        throw ("Plot layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.aspect_ratio) || this.layout.aspect_ratio <= 0){
        throw ("Plot layout parameter `aspect_ratio` must be a positive number");
    }

    // If this is a responsive layout then set a namespaced/unique onresize event listener on the window
    if (this.layout.responsive_resize){
        this.window_onresize = d3.select(window).on("resize.lz-"+this.id, function(){
            this.rescaleSVG();
        }.bind(this));
        // Forcing one additional setDimensions() call after the page is loaded clears up
        // any disagreements between the initial layout and the loaded responsive container's size
        d3.select(window).on("load.lz-"+this.id, function(){ 
            this.setDimensions();
        }.bind(this));
    }

    // Add panels
    this.layout.panels.forEach(function(panel_layout){
        this.addPanel(panel_layout);
    }.bind(this));

    return this;
};

/**
  Set the dimensions for an plot.
  This function works in two different ways:
  1. If passed a discrete width and height:
     * Adjust the plot to match those exact values (lower-bounded by minimum panel dimensions)
     * Resize panels within the plot proportionally to match the new plot dimensions
  2. If NOT passed discrete width and height:
     * Assume panels within are sized and positioned correctly
     * Calculate appropriate plot dimesions from panels contained within and update plot
*/
LocusZoom.Plot.prototype.setDimensions = function(width, height){
    
    var id;

    // Update minimum allowable width and height by aggregating minimums from panels, then apply minimums to containing element.
    var min_width = parseFloat(this.layout.min_width) || 0;
    var min_height = parseFloat(this.layout.min_height) || 0;
    for (id in this.panels){
        min_width = Math.max(min_width, this.panels[id].layout.min_width);
        if (parseFloat(this.panels[id].layout.min_height) > 0 && parseFloat(this.panels[id].layout.proportional_height) > 0){
            min_height = Math.max(min_height, (this.panels[id].layout.min_height / this.panels[id].layout.proportional_height));
        }
    }
    this.layout.min_width = Math.max(min_width, 1);
    this.layout.min_height = Math.max(min_height, 1);
    d3.select(this.svg.node().parentNode).style({
        "min-width": this.layout.min_width + "px",
        "min-height": this.layout.min_height + "px"
    });

    // If width and height arguments were passed then adjust them against plot minimums if necessary.
    // Then resize the plot and proportionally resize panels to fit inside the new plot dimensions.
    if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
        this.layout.aspect_ratio = this.layout.width / this.layout.height;
        // Override discrete values if resizing responsively
        if (this.layout.responsive_resize){
            if (this.svg){
                this.layout.width = Math.max(this.svg.node().parentNode.getBoundingClientRect().width, this.layout.min_width);
            }
            this.layout.height = this.layout.width / this.layout.aspect_ratio;
            if (this.layout.height < this.layout.min_height){
                this.layout.height = this.layout.min_height;
                this.layout.width  = this.layout.height * this.layout.aspect_ratio;
            }
        }
        // Resize/reposition panels to fit, update proportional origins if necessary
        var y_offset = 0;
        this.panel_ids_by_y_index.forEach(function(panel_id){
            var panel_width = this.layout.width;
            var panel_height = this.panels[panel_id].layout.proportional_height * this.layout.height;
            this.panels[panel_id].setDimensions(panel_width, panel_height);
            this.panels[panel_id].setOrigin(0, y_offset);
            this.panels[panel_id].layout.proportional_origin.x = 0;
            this.panels[panel_id].layout.proportional_origin.y = y_offset / this.layout.height;
            y_offset += panel_height;
            this.panels[panel_id].dashboard.update();
        }.bind(this));
    }

    // If width and height arguments were NOT passed (and panels exist) then determine the plot dimensions
    // by making it conform to panel dimensions, assuming panels are already positioned correctly.
    else if (Object.keys(this.panels).length) {
        this.layout.width = 0;
        this.layout.height = 0;
        for (id in this.panels){
            this.layout.width = Math.max(this.panels[id].layout.width, this.layout.width);
            this.layout.height += this.panels[id].layout.height;
        }
        this.layout.width = Math.max(this.layout.width, this.layout.min_width);
        this.layout.height = Math.max(this.layout.height, this.layout.min_height);
    }

    // Keep aspect ratio in agreement with dimensions
    this.layout.aspect_ratio = this.layout.width / this.layout.height;

    // Apply layout width and height as discrete values or viewbox values
    if (this.svg != null){
        if (this.layout.responsive_resize){
            this.svg
                .attr("viewBox", "0 0 " + this.layout.width + " " + this.layout.height)
                .attr("preserveAspectRatio", "xMinYMin meet");
        } else {
            this.svg.attr("width", this.layout.width).attr("height", this.layout.height);
        }
    }

    // If the plot has been initialized then trigger some necessary render functions
    if (this.initialized){
        this.panel_boundaries.position();
        this.dashboard.update();
        this.curtain.update();
        this.loader.update();
    }

    return this.emit("layout_changed");
};

// Create a new panel from a layout
LocusZoom.Plot.prototype.addPanel = function(layout){

    // Sanity checks
    if (typeof layout !== "object"){
        throw "Invalid panel layout passed to LocusZoom.Plot.prototype.addPanel()";
    }

    // Create the Panel and set its parent
    var panel = new LocusZoom.Panel(layout, this);
    
    // Store the Panel on the Plot
    this.panels[panel.id] = panel;

    // If a discrete y_index was set in the layout then adjust other panel y_index values to accomodate this one
    if (panel.layout.y_index != null && !isNaN(panel.layout.y_index)
        && this.panel_ids_by_y_index.length > 0){
        // Negative y_index values should count backwards from the end, so convert negatives to appropriate values here
        if (panel.layout.y_index < 0){
            panel.layout.y_index = Math.max(this.panel_ids_by_y_index.length + panel.layout.y_index, 0);
        }
        this.panel_ids_by_y_index.splice(panel.layout.y_index, 0, panel.id);
        this.applyPanelYIndexesToPanelLayouts();
    } else {
        var length = this.panel_ids_by_y_index.push(panel.id);
        this.panels[panel.id].layout.y_index = length - 1;
    }

    // Determine if this panel was already in the layout.panels array.
    // If it wasn't, add it. Either way store the layout.panels array index on the panel.
    var layout_idx = null;
    this.layout.panels.forEach(function(panel_layout, idx){
        if (panel_layout.id == panel.id){ layout_idx = idx; }
    });
    if (layout_idx == null){
        layout_idx = this.layout.panels.push(this.panels[panel.id].layout) - 1;
    }
    this.panels[panel.id].layout_idx = layout_idx;

    // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
    if (this.initialized){
        this.positionPanels();
        // Initialize and load data into the new panel
        this.panels[panel.id].initialize();
        this.panels[panel.id].reMap();
        // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
        // positioning. TODO: make this additional call unnecessary.
        this.setDimensions(this.layout.width, this.layout.height);
    }

    return this.panels[panel.id];
};

// Remove panel by id
LocusZoom.Plot.prototype.removePanel = function(id){
    if (!this.panels[id]){
        throw ("Unable to remove panel, ID not found: " + id);
    }

    // Hide all panel boundaries
    this.panel_boundaries.hide();

    // Destroy all tooltips and state vars for all data layers on the panel
    this.panels[id].data_layer_ids_by_z_index.forEach(function(dlid){
        this.panels[id].data_layers[dlid].destroyAllTooltips();
        delete this.layout.state[id + "." + dlid];
    }.bind(this));

    // Remove all panel-level HTML overlay elements
    this.panels[id].loader.hide();
    this.panels[id].dashboard.destroy(true);
    this.panels[id].curtain.hide();

    // Remove the svg container for the panel if it exists
    if (this.panels[id].svg.container){
        this.panels[id].svg.container.remove();
    }

    // Delete the panel and its presence in the plot layout and state
    this.layout.panels.splice(this.panels[id].layout_idx, 1);
    delete this.panels[id];
    delete this.layout.state[id];

    // Update layout_idx values for all remaining panels
    this.layout.panels.forEach(function(panel_layout, idx){
        this.panels[panel_layout.id].layout_idx = idx;
    }.bind(this));

    // Remove the panel id from the y_index array
    this.panel_ids_by_y_index.splice(this.panel_ids_by_y_index.indexOf(id), 1);
    this.applyPanelYIndexesToPanelLayouts();

    // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
    if (this.initialized){
        this.positionPanels();
        // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
        // positioning. TODO: make this additional call unnecessary.
        this.setDimensions(this.layout.width, this.layout.height);
    }

    return this;
};


/**
 Automatically position panels based on panel positioning rules and values.
 Keep panels from overlapping vertically by adjusting origins, and keep the sum of proportional heights at 1.

 TODO: This logic currently only supports dynamic positioning of panels to prevent overlap in a VERTICAL orientation.
       Some framework exists for positioning panels in horizontal orientations as well (width, proportional_width, origin.x, etc.)
       but the logic for keeping these user-defineable values straight approaches the complexity of a 2D box-packing algorithm.
       That's complexity we don't need right now, and may not ever need, so it's on hiatus until a use case materializes.
*/
LocusZoom.Plot.prototype.positionPanels = function(){

    var id;

    // We want to enforce that all x-linked panels have consistent horizontal margins
    // (to ensure that aligned items stay aligned despite inconsistent initial layout parameters)
    // NOTE: This assumes panels have consistent widths already. That should probably be enforced too!
    var x_linked_margins = { left: 0, right: 0 };

    // Proportional heights for newly added panels default to null unless explcitly set, so determine appropriate
    // proportional heights for all panels with a null value from discretely set dimensions.
    // Likewise handle defaul nulls for proportional widths, but instead just force a value of 1 (full width)
    for (id in this.panels){
        if (this.panels[id].layout.proportional_height == null){
            this.panels[id].layout.proportional_height = this.panels[id].layout.height / this.layout.height;
        }
        if (this.panels[id].layout.proportional_width == null){
            this.panels[id].layout.proportional_width = 1;
        }
        if (this.panels[id].layout.interaction.x_linked){
            x_linked_margins.left = Math.max(x_linked_margins.left, this.panels[id].layout.margin.left);
            x_linked_margins.right = Math.max(x_linked_margins.right, this.panels[id].layout.margin.right);
        }
    }

    // Sum the proportional heights and then adjust all proportionally so that the sum is exactly 1
    var total_proportional_height = this.sumProportional("height");
    if (!total_proportional_height){
        return this;
    }
    var proportional_adjustment = 1 / total_proportional_height;
    for (id in this.panels){
        this.panels[id].layout.proportional_height *= proportional_adjustment;
    }

    // Update origins on all panels without changing plot-level dimensions yet
    // Also apply x-linked margins to x-linked panels, updating widths as needed
    var y_offset = 0;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].setOrigin(0, y_offset);
        this.panels[panel_id].layout.proportional_origin.x = 0;
        y_offset += this.panels[panel_id].layout.height;
        if (this.panels[panel_id].layout.interaction.x_linked){
            var delta = Math.max(x_linked_margins.left - this.panels[panel_id].layout.margin.left, 0)
                      + Math.max(x_linked_margins.right - this.panels[panel_id].layout.margin.right, 0);
            this.panels[panel_id].layout.width += delta;
            this.panels[panel_id].layout.margin.left = x_linked_margins.left;
            this.panels[panel_id].layout.margin.right = x_linked_margins.right;
            this.panels[panel_id].layout.cliparea.origin.x = x_linked_margins.left;
        }
    }.bind(this));
    var calculated_plot_height = y_offset;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].layout.proportional_origin.y = this.panels[panel_id].layout.origin.y / calculated_plot_height;
    }.bind(this));    

    // Update dimensions on the plot to accomodate repositioned panels
    this.setDimensions();

    // Set dimensions on all panels using newly set plot-level dimensions and panel-level proportional dimensions
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].setDimensions(this.layout.width * this.panels[panel_id].layout.proportional_width,
                                            this.layout.height * this.panels[panel_id].layout.proportional_height);
    }.bind(this));

    return this;
    
};

// Create all plot-level objects, initialize all child panels
LocusZoom.Plot.prototype.initialize = function(){

    // Ensure proper responsive class is present on the containing node if called for
    if (this.layout.responsive_resize){
        d3.select(this.container).classed("lz-container-responsive", true);
    }
    
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

    // Add curtain and loader prototpyes to the plot
    this.curtain = LocusZoom.generateCurtain.call(this);
    this.loader = LocusZoom.generateLoader.call(this);

    // Create the panel_boundaries object with show/position/hide methods
    this.panel_boundaries = {
        parent: this,
        hide_timeout: null,
        showing: false,
        dragging: false,
        selectors: [],
        corner_selector: null,
        show: function(){
            // Generate panel boundaries
            if (!this.showing && !this.parent.curtain.showing){
                this.showing = true;
                // Loop through all panels to create a horizontal boundary for each
                this.parent.panel_ids_by_y_index.forEach(function(panel_id, panel_idx){
                    var selector = d3.select(this.parent.svg.node().parentNode).insert("div", ".lz-data_layer-tooltip")
                        .attr("class", "lz-panel-boundary")
                        .attr("title", "Resize panel");
                    selector.append("span");
                    var panel_resize_drag = d3.behavior.drag();
                    panel_resize_drag.on("dragstart", function(){ this.dragging = true; }.bind(this));
                    panel_resize_drag.on("dragend", function(){ this.dragging = false; }.bind(this));
                    panel_resize_drag.on("drag", function(){
                        // First set the dimensions on the panel we're resizing
                        var this_panel = this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]];
                        var original_panel_height = this_panel.layout.height;
                        this_panel.setDimensions(this_panel.layout.width, this_panel.layout.height + d3.event.dy);
                        var panel_height_change = this_panel.layout.height - original_panel_height;
                        var new_calculated_plot_height = this.parent.layout.height + panel_height_change;
                        // Next loop through all panels.
                        // Update proportional dimensions for all panels including the one we've resized using discrete heights.
                        // Reposition panels with a greater y-index than this panel to their appropriate new origin.
                        this.parent.panel_ids_by_y_index.forEach(function(loop_panel_id, loop_panel_idx){
                            var loop_panel = this.parent.panels[this.parent.panel_ids_by_y_index[loop_panel_idx]];
                            loop_panel.layout.proportional_height = loop_panel.layout.height / new_calculated_plot_height;
                            if (loop_panel_idx > panel_idx){
                                loop_panel.setOrigin(loop_panel.layout.origin.x, loop_panel.layout.origin.y + panel_height_change);
                                loop_panel.dashboard.position();
                            }
                        }.bind(this));
                        // Reset dimensions on the entire plot and reposition panel boundaries
                        this.parent.positionPanels();
                        this.position();
                    }.bind(this));
                    selector.call(panel_resize_drag);
                    this.parent.panel_boundaries.selectors.push(selector);
                }.bind(this));
                // Create a corner boundary / resize element on the bottom-most panel that resizes the entire plot
                var corner_selector = d3.select(this.parent.svg.node().parentNode).insert("div", ".lz-data_layer-tooltip")
                    .attr("class", "lz-panel-corner-boundary")
                    .attr("title", "Resize plot");
                corner_selector.append("span").attr("class", "lz-panel-corner-boundary-outer");
                corner_selector.append("span").attr("class", "lz-panel-corner-boundary-inner");
                var corner_drag = d3.behavior.drag();
                corner_drag.on("dragstart", function(){ this.dragging = true; }.bind(this));
                corner_drag.on("dragend", function(){ this.dragging = false; }.bind(this));
                corner_drag.on("drag", function(){
                    this.setDimensions(this.layout.width + d3.event.dx, this.layout.height + d3.event.dy);
                }.bind(this.parent));
                corner_selector.call(corner_drag);
                this.parent.panel_boundaries.corner_selector = corner_selector;
            }
            return this.position();
        },
        position: function(){
            if (!this.showing){ return this; }
            // Position panel boundaries
            var plot_page_origin = this.parent.getPageOrigin();
            this.selectors.forEach(function(selector, panel_idx){
                var panel_page_origin = this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]].getPageOrigin();
                var left = plot_page_origin.x;
                var top = panel_page_origin.y + this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]].layout.height - 12;
                var width = this.parent.layout.width - 1;
                selector.style({
                    top: top + "px",
                    left: left + "px",
                    width: width + "px"
                });
                selector.select("span").style({
                    width: width + "px"
                });
            }.bind(this));
            // Position corner selector
            var corner_padding = 10;
            var corner_size = 16;
            this.corner_selector.style({
                top: (plot_page_origin.y + this.parent.layout.height - corner_padding - corner_size) + "px",
                left: (plot_page_origin.x + this.parent.layout.width - corner_padding - corner_size) + "px"
            });
            return this;
        },
        hide: function(){
            if (!this.showing){ return this; }
            this.showing = false;
            // Remove panel boundaries
            this.selectors.forEach(function(selector){ selector.remove(); });
            this.selectors = [];
            // Remove corner boundary
            this.corner_selector.remove();
            this.corner_selector = null;
            return this;
        }
    };

    // Show panel boundaries stipulated by the layout (basic toggle, only show on mouse over plot)
    if (this.layout.panel_boundaries){
        d3.select(this.svg.node().parentNode).on("mouseover." + this.id + ".panel_boundaries", function(){
            clearTimeout(this.panel_boundaries.hide_timeout);
            this.panel_boundaries.show();
        }.bind(this));
        d3.select(this.svg.node().parentNode).on("mouseout." + this.id + ".panel_boundaries", function(){
            this.panel_boundaries.hide_timeout = setTimeout(function(){
                this.panel_boundaries.hide();
            }.bind(this), 300);
        }.bind(this));
    }

    // Create the dashboard object and immediately show it
    this.dashboard = new LocusZoom.Dashboard(this).show();

    // Initialize all panels
    for (var id in this.panels){
        this.panels[id].initialize();
    }

    // Define plot-level mouse events
    var namespace = "." + this.id;
    var mouseout = function(){
        this.mouse_guide.vertical.attr("x", -1);
        this.mouse_guide.horizontal.attr("y", -1);
    }.bind(this);
    var mouseup = function(){
        this.stopDrag();
    }.bind(this);
    var mousemove = function(){
        var coords = d3.mouse(this.svg.node());
        this.mouse_guide.vertical.attr("x", coords[0]);
        this.mouse_guide.horizontal.attr("y", coords[1]);
        if (this.interaction.dragging){
            if (d3.event){ d3.event.preventDefault(); }
            this.interaction.dragging.dragged_x = coords[0] - this.interaction.dragging.start_x;
            this.interaction.dragging.dragged_y = coords[1] - this.interaction.dragging.start_y;
            this.panels[this.interaction.panel_id].render();
            this.interaction.linked_panel_ids.forEach(function(panel_id){
                this.panels[panel_id].render();
            }.bind(this));
        }
    }.bind(this);
    this.svg
        .on("mouseout" + namespace, mouseout)
        .on("touchleave" + namespace, mouseout)
        .on("mouseup" + namespace, mouseup)
        .on("touchend" + namespace, mouseup)
        .on("mousemove" + namespace, mousemove)
        .on("touchmove" + namespace, mousemove);
    
    // Add an extra namespaced mouseup handler to the containing body, if there is one
    // This helps to stop interaction events gracefully when dragging outside of the plot element
    if (!d3.select("body").empty()){
        d3.select("body")
            .on("mouseup" + namespace, mouseup)
            .on("touchend" + namespace, mouseup);
    }

    this.initialized = true;

    // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
    // positioning. TODO: make this additional call unnecessary.
    var client_rect = this.svg.node().getBoundingClientRect();
    var width = client_rect.width ? client_rect.width : this.layout.width;
    var height = client_rect.height ? client_rect.height : this.layout.height;
    this.setDimensions(width, height);
    
    return this;

};

// Refresh an plot's data from sources without changing position
LocusZoom.Plot.prototype.refresh = function(){
    return this.applyState();
};

// Update state values and trigger a pull for fresh data on all data sources for all data layers
LocusZoom.Plot.prototype.applyState = function(state_changes){

    state_changes = state_changes || {};
    if (typeof state_changes != "object"){
        throw("LocusZoom.applyState only accepts an object; " + (typeof state_changes) + " given");
    }
    
    // First make a copy of the current (old) state to work with
    var new_state = JSON.parse(JSON.stringify(this.state));

    // Apply changes by top-level property to the new state
    for (var property in state_changes) {
        new_state[property] = state_changes[property];
    }

    // Validate the new state (may do nothing, may do a lot, depends on how the user has thigns set up)
    new_state = LocusZoom.validateState(new_state, this.layout);

    // Apply new state to the actual state
    for (property in new_state) {
        this.state[property] = new_state[property];
    }

    // Generate requests for all panels given new state
    this.emit("data_requested");
    this.remap_promises = [];
    this.loading_data = true;
    for (var id in this.panels){
        this.remap_promises.push(this.panels[id].reMap());
    }

    return Q.all(this.remap_promises)
        .catch(function(error){
            console.error(error);
            this.curtain.drop(error);
            this.loading_data = false;
        }.bind(this))
        .then(function(){

            // Update dashboard / components
            this.dashboard.update();
                
            // Apply panel-level state values
            this.panel_ids_by_y_index.forEach(function(panel_id){
                var panel = this.panels[panel_id];
                panel.dashboard.update();
                // Apply data-layer-level state values
                panel.data_layer_ids_by_z_index.forEach(function(data_layer_id){
                    var data_layer = this.data_layers[data_layer_id];
                    var state_id = panel_id + "." + data_layer_id;
                    for (var property in this.state[state_id]){
                        if (!this.state[state_id].hasOwnProperty(property)){ continue; }
                        if (Array.isArray(this.state[state_id][property])){
                            this.state[state_id][property].forEach(function(element_id){
                                try {
                                    this.setElementStatus(property, this.getElementById(element_id), true);
                                } catch (e){
                                    console.error("Unable to apply state: " + state_id + ", " + property);
                                }
                            }.bind(data_layer));
                        }
                    }
                }.bind(panel));
            }.bind(this));
            
            // Emit events
            this.emit("layout_changed");
            this.emit("data_rendered");

            this.loading_data = false;
            
        }.bind(this));
};

LocusZoom.Plot.prototype.startDrag = function(panel, method){

    panel = panel || null;
    method = method || null;

    var axis = null;
    switch (method){
    case "background":
    case "x_tick":
        axis = "x";
        break;
    case "y1_tick":
        axis = "y1";
        break;
    case "y2_tick":
        axis = "y2";
        break;
    }

    if (!(panel instanceof LocusZoom.Panel) || !axis || !this.canInteract()){ return this.stopDrag(); }

    var coords = d3.mouse(this.svg.node());
    this.interaction = {
        panel_id: panel.id,
        linked_panel_ids: panel.getLinkedPanelIds(axis),
        dragging: {
            method: method,
            start_x: coords[0],
            start_y: coords[1],
            dragged_x: 0,
            dragged_y: 0,
            axis: axis
        }
    };

    this.svg.style("cursor", "all-scroll");

    return this;

};

LocusZoom.Plot.prototype.stopDrag = function(){

    if (!this.interaction.dragging){ return this; }

    if (typeof this.panels[this.interaction.panel_id] != "object"){
        this.interaction = {};
        return this;
    }
    var panel = this.panels[this.interaction.panel_id];

    // Helper function to find the appropriate axis layouts on child data layers
    // Once found, apply the extent as floor/ceiling and remove all other directives
    // This forces all associated axes to conform to the extent generated by a drag action
    var overrideAxisLayout = function(axis, axis_number, extent){
        panel.data_layer_ids_by_z_index.forEach(function(id){
            if (panel.data_layers[id].layout[axis+"_axis"].axis == axis_number){
                panel.data_layers[id].layout[axis+"_axis"].floor = extent[0];
                panel.data_layers[id].layout[axis+"_axis"].ceiling = extent[1];
                delete panel.data_layers[id].layout[axis+"_axis"].lower_buffer;
                delete panel.data_layers[id].layout[axis+"_axis"].upper_buffer;
                delete panel.data_layers[id].layout[axis+"_axis"].min_extent;
                delete panel.data_layers[id].layout[axis+"_axis"].ticks;
            }
        });
    };

    switch(this.interaction.dragging.method){
    case "background":
    case "x_tick":
        if (this.interaction.dragging.dragged_x != 0){
            overrideAxisLayout("x", 1, panel.x_extent);
            this.applyState({ start: panel.x_extent[0], end: panel.x_extent[1] });
        }
        break;
    case "y1_tick":
    case "y2_tick":
        if (this.interaction.dragging.dragged_y != 0){
            var y_axis_number = this.interaction.dragging.method[1];
            overrideAxisLayout("y", y_axis_number, panel["y"+y_axis_number+"_extent"]);
        }
        break;
    }
    
    this.interaction = {};
    this.svg.style("cursor", null);

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

LocusZoom.Panel = function(layout, parent) { 

    if (typeof layout !== "object"){
        throw "Unable to create panel, invalid layout";
    }

    this.parent = parent || null;
    this.parent_plot = parent;

    // Ensure a valid ID is present. If there is no valid ID then generate one
    if (typeof layout.id !== "string" || !layout.id.length){
        if (!this.parent){
            layout.id = "p" + Math.floor(Math.random()*Math.pow(10,8));
        } else {
            var id = null;
            var generateID = function(){
                id = "p" + Math.floor(Math.random()*Math.pow(10,8));
                if (id == null || typeof this.parent.panels[id] != "undefined"){
                    id = generateID();
                }
            }.bind(this);
            layout.id = id;
        }
    } else if (this.parent) {
        if (typeof this.parent.panels[layout.id] !== "undefined"){
            throw "Cannot create panel with id [" + layout.id + "]; panel with that id already exists";
        }
    }
    this.id = layout.id;

    this.initialized = false;
    this.layout_idx = null;
    this.svg = {};

    // The layout is a serializable object used to describe the composition of the Panel
    this.layout = LocusZoom.Layouts.merge(layout || {}, LocusZoom.Panel.DefaultLayout);

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
    this.applyDataLayerZIndexesToDataLayerLayouts = function(){
        this.data_layer_ids_by_z_index.forEach(function(dlid, idx){
            this.data_layers[dlid].layout.z_index = idx;
        }.bind(this));
    }.bind(this);
    this.data_promises = [];

    this.x_scale  = null;
    this.y1_scale = null;
    this.y2_scale = null;

    this.x_extent  = null;
    this.y1_extent = null;
    this.y2_extent = null;

    this.x_ticks  = [];
    this.y1_ticks = [];
    this.y2_ticks = [];

    this.zoom_timeout = null;

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };

    // Event hooks
    this.event_hooks = {
        "layout_changed": [],
        "data_requested": [],
        "data_rendered": [],
        "element_clicked": []
    };
    this.on = function(event, hook){
        if (typeof "event" != "string" || !Array.isArray(this.event_hooks[event])){
            throw("Unable to register event hook, invalid event: " + event.toString());
        }
        if (typeof hook != "function"){
            throw("Unable to register event hook, invalid hook function passed");
        }
        this.event_hooks[event].push(hook);
        return this;
    };
    this.emit = function(event, context){
        if (typeof "event" != "string" || !Array.isArray(this.event_hooks[event])){
            throw("LocusZoom attempted to throw an invalid event: " + event.toString());
        }
        context = context || this;
        this.event_hooks[event].forEach(function(hookToRun) {
            hookToRun.call(context);
        });
        return this;
    };
    
    // Get an object with the x and y coordinates of the panel's origin in terms of the entire page
    // Necessary for positioning any HTML elements over the panel
    this.getPageOrigin = function(){
        var plot_origin = this.parent.getPageOrigin();
        return {
            x: plot_origin.x + this.layout.origin.x,
            y: plot_origin.y + this.layout.origin.y
        };
    };        

    // Initialize the layout
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.DefaultLayout = {
    title: { text: "", style: {}, x: 10, y: 22 },
    y_index: null,
    width:  0,
    height: 0,
    origin: { x: 0, y: null },
    min_width: 1,
    min_height: 1,
    proportional_width: null,
    proportional_height: null,
    proportional_origin: { x: 0, y: null },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    background_click: "clear_selections",
    dashboard: {
        components: []
    },
    cliparea: {
        height: 0,
        width: 0,
        origin: { x: 0, y: 0 }
    },
    axes: {
        x:  {},
        y1: {},
        y2: {}
    },
    legend: null,
    interaction: {
        drag_background_to_pan: false,
        drag_x_ticks_to_scale: false,
        drag_y1_ticks_to_scale: false,
        drag_y2_ticks_to_scale: false,
        scroll_to_zoom: false,
        x_linked: false,
        y1_linked: false,
        y2_linked: false
    },
    data_layers: []
};

LocusZoom.Panel.prototype.initializeLayout = function(){

    // If the layout is missing BOTH width and proportional width then set the proportional width to 1.
    // This will default the panel to taking up the full width of the plot.
    if (this.layout.width == 0 && this.layout.proportional_width == null){
        this.layout.proportional_width = 1;
    }

    // If the layout is missing BOTH height and proportional height then set the proportional height to
    // an equal share of the plot's current height.
    if (this.layout.height == 0 && this.layout.proportional_height == null){
        var panel_count = Object.keys(this.parent.panels).length;
        if (panel_count > 0){
            this.layout.proportional_height = (1 / panel_count);
        } else {
            this.layout.proportional_height = 1;
        }
    }

    // Set panel dimensions, origin, and margin
    this.setDimensions();
    this.setOrigin();
    this.setMargin();

    // Set ranges
    this.x_range = [0, this.layout.cliparea.width];
    this.y1_range = [this.layout.cliparea.height, 0];
    this.y2_range = [this.layout.cliparea.height, 0];

    // Initialize panel axes
    ["x", "y1", "y2"].forEach(function(axis){
        if (!Object.keys(this.layout.axes[axis]).length || this.layout.axes[axis].render ===false){
            // The default layout sets the axis to an empty object, so set its render boolean here
            this.layout.axes[axis].render = false;
        } else {
            this.layout.axes[axis].render = true;
            this.layout.axes[axis].label = this.layout.axes[axis].label || null;
            this.layout.axes[axis].label_function = this.layout.axes[axis].label_function || null;
        }
    }.bind(this));

    // Add data layers (which define x and y extents)
    this.layout.data_layers.forEach(function(data_layer_layout){
        this.addDataLayer(data_layer_layout);
    }.bind(this));

    return this;

};

LocusZoom.Panel.prototype.setDimensions = function(width, height){
    if (typeof width != "undefined" && typeof height != "undefined"){
        if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0){
            this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
            this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
        }
    } else {
        if (this.layout.proportional_width != null){
            this.layout.width = Math.max(this.layout.proportional_width * this.parent.layout.width, this.layout.min_width);
        }
        if (this.layout.proportional_height != null){
            this.layout.height = Math.max(this.layout.proportional_height * this.parent.layout.height, this.layout.min_height);
        }
    }
    this.layout.cliparea.width = Math.max(this.layout.width - (this.layout.margin.left + this.layout.margin.right), 0);
    this.layout.cliparea.height = Math.max(this.layout.height - (this.layout.margin.top + this.layout.margin.bottom), 0);
    if (this.svg.clipRect){
        this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);
    }
    if (this.initialized){
        this.render();
        this.curtain.update();
        this.loader.update();
        this.dashboard.update();
        if (this.legend){ this.legend.position(); }
    }
    return this;
};

LocusZoom.Panel.prototype.setOrigin = function(x, y){
    if (!isNaN(x) && x >= 0){ this.layout.origin.x = Math.max(Math.round(+x), 0); }
    if (!isNaN(y) && y >= 0){ this.layout.origin.y = Math.max(Math.round(+y), 0); }
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
    ["top", "right", "bottom", "left"].forEach(function(m){
        this.layout.margin[m] = Math.max(this.layout.margin[m], 0);
    }.bind(this));
    this.layout.cliparea.width = Math.max(this.layout.width - (this.layout.margin.left + this.layout.margin.right), 0);
    this.layout.cliparea.height = Math.max(this.layout.height - (this.layout.margin.top + this.layout.margin.bottom), 0);
    this.layout.cliparea.origin.x = this.layout.margin.left;
    this.layout.cliparea.origin.y = this.layout.margin.top;

    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setTitle = function(title){
    if (typeof this.layout.title == "string"){
        var text = this.layout.title;
        this.layout.title = { text: text, x: 0, y: 0, style: {} };
    }
    if (typeof title == "string"){
        this.layout.title.text = title;
    } else if (typeof title == "object" && title != null){
        this.layout.title = LocusZoom.Layouts.merge(title, this.layout.title);
    }
    if (this.layout.title.text.length){
        this.title.attr("display", null)
            .attr("x", parseFloat(this.layout.title.x))
            .attr("y", parseFloat(this.layout.title.y))
            .style(this.layout.title.style)
            .text(this.layout.title.text);
    } else {
        this.title.attr("display", "none");
    }
    return this;
};

// Initialize a panel
LocusZoom.Panel.prototype.initialize = function(){

    // Append a container group element to house the main panel group element and the clip path
    // Position with initial layout parameters
    this.svg.container = this.parent.svg.append("g")
        .attr("id", this.getBaseId() + ".panel_container")
        .attr("transform", "translate(" + (this.layout.origin.x || 0) + "," + (this.layout.origin.y || 0) + ")");

    // Append clip path to the parent svg element, size with initial layout parameters
    var clipPath = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip");
    this.svg.clipRect = clipPath.append("rect")
        .attr("width", this.layout.width).attr("height", this.layout.height);
    
    // Append svg group for rendering all panel child elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".panel")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Add curtain and loader prototpyes to the panel
    this.curtain = LocusZoom.generateCurtain.call(this);
    this.loader = LocusZoom.generateLoader.call(this);

    // Create the dashboard object and hang components on it as defined by panel layout
    this.dashboard = new LocusZoom.Dashboard(this);

    // Inner border
    this.inner_border = this.svg.group.append("rect")
        .attr("class", "lz-panel-background")
        .on("click", function(){
            if (this.layout.background_click == "clear_selections"){ this.clearSelections(); }
        }.bind(this));

    // Add the title
    this.title = this.svg.group.append("text").attr("class", "lz-panel-title");
    if (typeof this.layout.title != "undefined"){ this.setTitle(); }

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
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].initialize();
    }.bind(this));

    // Create the legend object as defined by panel layout and child data layer layouts
    this.legend = null;
    if (this.layout.legend){
        this.legend = new LocusZoom.Legend(this);
    }

    // Establish panel background drag interaction mousedown event handler (on the panel background)
    if (this.layout.interaction.drag_background_to_pan){
        var namespace = "." + this.parent.id + "." + this.id + ".interaction.drag";
        var mousedown = function(){
            this.parent.startDrag(this, "background");
        }.bind(this);
        this.svg.container.select(".lz-panel-background")
            .on("mousedown" + namespace + ".background", mousedown)
            .on("touchstart" + namespace + ".background", mousedown);
    }

    return this;
    
};

// Refresh the sort order of all data layers (called by data layer moveUp and moveDown methods)
LocusZoom.Panel.prototype.resortDataLayers = function(){
    var sort = [];
    this.data_layer_ids_by_z_index.forEach(function(id){
        sort.push(this.data_layers[id].layout.z_index);
    }.bind(this));
    this.svg.group.selectAll("g.lz-data_layer-container").data(sort).sort(d3.ascending);
    this.applyDataLayerZIndexesToDataLayerLayouts();
};

// Get an array of panel IDs that are axis-linked to this panel
LocusZoom.Panel.prototype.getLinkedPanelIds = function(axis){
    axis = axis || null;
    var linked_panel_ids = [];
    if (["x","y1","y2"].indexOf(axis) == -1){ return linked_panel_ids; }
    if (!this.layout.interaction[axis + "_linked"]){ return linked_panel_ids; }
    this.parent.panel_ids_by_y_index.forEach(function(panel_id){
        if (panel_id != this.id && this.parent.panels[panel_id].layout.interaction[axis + "_linked"]){
            linked_panel_ids.push(panel_id);
        }
    }.bind(this));
    return linked_panel_ids;
};

// Move a panel up relative to others by y-index
LocusZoom.Panel.prototype.moveUp = function(){
    if (this.parent.panel_ids_by_y_index[this.layout.y_index - 1]){
        this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index - 1];
        this.parent.panel_ids_by_y_index[this.layout.y_index - 1] = this.id;
        this.parent.applyPanelYIndexesToPanelLayouts();
        this.parent.positionPanels();
    }
    return this;
};

// Move a panel down relative to others by y-index
LocusZoom.Panel.prototype.moveDown = function(){
    if (this.parent.panel_ids_by_y_index[this.layout.y_index + 1]){
        this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index + 1];
        this.parent.panel_ids_by_y_index[this.layout.y_index + 1] = this.id;
        this.parent.applyPanelYIndexesToPanelLayouts();
        this.parent.positionPanels();
    }
    return this;
};

// Create a new data layer by layout object
LocusZoom.Panel.prototype.addDataLayer = function(layout){

    // Sanity checks
    if (typeof layout !== "object" || typeof layout.id !== "string" || !layout.id.length){
        throw "Invalid data layer layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof this.data_layers[layout.id] !== "undefined"){
        throw "Cannot create data_layer with id [" + layout.id + "]; data layer with that id already exists in the panel";
    }
    if (typeof layout.type !== "string"){
        throw "Invalid data layer type in layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }

    // If the layout defines a y axis make sure the axis number is set and is 1 or 2 (default to 1)
    if (typeof layout.y_axis == "object" && (typeof layout.y_axis.axis == "undefined" || [1,2].indexOf(layout.y_axis.axis) == -1)){
        layout.y_axis.axis = 1;
    }

    // Create the Data Layer
    var data_layer = LocusZoom.DataLayers.get(layout.type, layout, this);

    // Store the Data Layer on the Panel
    this.data_layers[data_layer.id] = data_layer;

    // If a discrete z_index was set in the layout then adjust other data layer z_index values to accomodate this one
    if (data_layer.layout.z_index != null && !isNaN(data_layer.layout.z_index)
        && this.data_layer_ids_by_z_index.length > 0){
        // Negative z_index values should count backwards from the end, so convert negatives to appropriate values here
        if (data_layer.layout.z_index < 0){
            data_layer.layout.z_index = Math.max(this.data_layer_ids_by_z_index.length + data_layer.layout.z_index, 0);
        }
        this.data_layer_ids_by_z_index.splice(data_layer.layout.z_index, 0, data_layer.id);
        this.data_layer_ids_by_z_index.forEach(function(dlid, idx){
            this.data_layers[dlid].layout.z_index = idx;
        }.bind(this));
    } else {
        var length = this.data_layer_ids_by_z_index.push(data_layer.id);
        this.data_layers[data_layer.id].layout.z_index = length - 1;
    }

    // Determine if this data layer was already in the layout.data_layers array.
    // If it wasn't, add it. Either way store the layout.data_layers array index on the data_layer.
    var layout_idx = null;
    this.layout.data_layers.forEach(function(data_layer_layout, idx){
        if (data_layer_layout.id == data_layer.id){ layout_idx = idx; }
    });
    if (layout_idx == null){
        layout_idx = this.layout.data_layers.push(this.data_layers[data_layer.id].layout) - 1;
    }
    this.data_layers[data_layer.id].layout_idx = layout_idx;

    return this.data_layers[data_layer.id];
};

// Remove a data layer by id
LocusZoom.Panel.prototype.removeDataLayer = function(id){
    if (!this.data_layers[id]){
        throw ("Unable to remove data layer, ID not found: " + id);
    }

    // Destroy all tooltips for the data layer
    this.data_layers[id].destroyAllTooltips();

    // Remove the svg container for the data layer if it exists
    if (this.data_layers[id].svg.container){
        this.data_layers[id].svg.container.remove();
    }

    // Delete the data layer and its presence in the panel layout and state
    this.layout.data_layers.splice(this.data_layers[id].layout_idx, 1);
    delete this.state[this.data_layers[id].state_id];
    delete this.data_layers[id];

    // Remove the data_layer id from the z_index array
    this.data_layer_ids_by_z_index.splice(this.data_layer_ids_by_z_index.indexOf(id), 1);

    // Update layout_idx and layout.z_index values for all remaining data_layers
    this.applyDataLayerZIndexesToDataLayerLayouts();
    this.layout.data_layers.forEach(function(data_layer_layout, idx){
        this.data_layers[data_layer_layout.id].layout_idx = idx;
    }.bind(this));

    return this;
};

// Clear all selections on all data layers
LocusZoom.Panel.prototype.clearSelections = function(){
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].setAllElementStatus("selected", false);
    }.bind(this));
    return this;
};

// Re-Map a panel to new positions according to the parent plot's state
LocusZoom.Panel.prototype.reMap = function(){
    this.emit("data_requested");
    this.data_promises = [];
    // Trigger reMap on each Data Layer
    for (var id in this.data_layers){
        try {
            this.data_promises.push(this.data_layers[id].reMap());
        } catch (error) {
            console.warn(error);
            this.curtain.show(error);
        }
    }
    // When all finished trigger a render
    return Q.all(this.data_promises)
        .then(function(){
            this.initialized = true;
            this.render();
            this.emit("layout_changed");
            this.parent.emit("layout_changed");
            this.emit("data_rendered");
        }.bind(this))
        .catch(function(error){
            console.warn(error);
            this.curtain.show(error);
        }.bind(this));
};

// Iterate over data layers to generate panel axis extents
LocusZoom.Panel.prototype.generateExtents = function(){

    // Reset extents
    ["x", "y1", "y2"].forEach(function(axis){
        this[axis + "_extent"] = null;
    }.bind(this));

    // Loop through the data layers
    for (var id in this.data_layers){

        var data_layer = this.data_layers[id];

        // If defined and not decoupled, merge the x extent of the data layer with the panel's x extent
        if (data_layer.layout.x_axis && !data_layer.layout.x_axis.decoupled){
            this.x_extent = d3.extent((this.x_extent || []).concat(data_layer.getAxisExtent("x")));
        }

        // If defined and not decoupled, merge the y extent of the data layer with the panel's appropriate y extent
        if (data_layer.layout.y_axis && !data_layer.layout.y_axis.decoupled){
            var y_axis = "y" + data_layer.layout.y_axis.axis;
            this[y_axis+"_extent"] = d3.extent((this[y_axis+"_extent"] || []).concat(data_layer.getAxisExtent("y")));
        }
        
    }

    // Override x_extent from state if explicitly defined to do so
    if (this.layout.axes.x && this.layout.axes.x.extent == "state"){
        this.x_extent = [ this.state.start, this.state.end ];
    }

    return this;

};

// Render a given panel
LocusZoom.Panel.prototype.render = function(){

    // Position the panel container
    this.svg.container.attr("transform", "translate(" + this.layout.origin.x +  "," + this.layout.origin.y + ")");

    // Set size on the clip rect
    this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);

    // Set and position the inner border, style if necessary
    this.inner_border
        .attr("x", this.layout.margin.left).attr("y", this.layout.margin.top)
        .attr("width", this.layout.width - (this.layout.margin.left + this.layout.margin.right))
        .attr("height", this.layout.height - (this.layout.margin.top + this.layout.margin.bottom));
    if (this.layout.inner_border){
        this.inner_border.style({ "stroke-width": 1, "stroke": this.layout.inner_border });
    }

    // Set/update panel title if necessary
    this.setTitle();

    // Regenerate all extents
    this.generateExtents();

    // Helper function to constrain any procedurally generated vectors (e.g. ranges, extents)
    // Constraints applied here keep vectors from going to infinity or beyond a definable power of ten
    var constrain = function(value, limit_exponent){
        var neg_min = Math.pow(-10, limit_exponent);
        var neg_max = Math.pow(-10, -limit_exponent);
        var pos_min = Math.pow(10, -limit_exponent);
        var pos_max = Math.pow(10, limit_exponent);
        if (value == Infinity){ value = pos_max; }
        if (value == -Infinity){ value = neg_min; }
        if (value == 0){ value = pos_min; }
        if (value > 0){ value = Math.max(Math.min(value, pos_max), pos_min); }
        if (value < 0){ value = Math.max(Math.min(value, neg_max), neg_min); }
        return value;
    };

    // Define default and shifted ranges for all axes
    var ranges = {};
    if (this.x_extent){
        var base_x_range = { start: 0, end: this.layout.cliparea.width };
        if (this.layout.axes.x.range){
            base_x_range.start = this.layout.axes.x.range.start || base_x_range.start;
            base_x_range.end = this.layout.axes.x.range.end || base_x_range.end;
        }
        ranges.x = [base_x_range.start, base_x_range.end];
        ranges.x_shifted = [base_x_range.start, base_x_range.end];
    }
    if (this.y1_extent){
        var base_y1_range = { start: this.layout.cliparea.height, end: 0 };
        if (this.layout.axes.y1.range){
            base_y1_range.start = this.layout.axes.y1.range.start || base_y1_range.start;
            base_y1_range.end = this.layout.axes.y1.range.end || base_y1_range.end;
        }
        ranges.y1 = [base_y1_range.start, base_y1_range.end];
        ranges.y1_shifted = [base_y1_range.start, base_y1_range.end];
    }
    if (this.y2_extent){
        var base_y2_range = { start: this.layout.cliparea.height, end: 0 };
        if (this.layout.axes.y2.range){
            base_y2_range.start = this.layout.axes.y2.range.start || base_y2_range.start;
            base_y2_range.end = this.layout.axes.y2.range.end || base_y2_range.end;
        }
        ranges.y2 = [base_y2_range.start, base_y2_range.end];
        ranges.y2_shifted = [base_y2_range.start, base_y2_range.end];
    }

    // Shift ranges based on any drag or zoom interactions currently underway
    if (this.parent.interaction.panel_id && (this.parent.interaction.panel_id == this.id || this.parent.interaction.linked_panel_ids.indexOf(this.id) != -1)){
        var anchor, scalar = null;
        if (this.parent.interaction.zooming && typeof this.x_scale == "function"){
            var current_extent_size = Math.abs(this.x_extent[1] - this.x_extent[0]);
            var current_scaled_extent_size = Math.round(this.x_scale.invert(ranges.x_shifted[1])) - Math.round(this.x_scale.invert(ranges.x_shifted[0]));
            var zoom_factor = this.parent.interaction.zooming.scale;
            var potential_extent_size = Math.floor(current_scaled_extent_size * (1 / zoom_factor));
            if (zoom_factor < 1 && !isNaN(this.parent.layout.max_region_scale)){
                zoom_factor = 1 /(Math.min(potential_extent_size, this.parent.layout.max_region_scale) / current_scaled_extent_size);
            } else if (zoom_factor > 1 && !isNaN(this.parent.layout.min_region_scale)){
                zoom_factor = 1 / (Math.max(potential_extent_size, this.parent.layout.min_region_scale) / current_scaled_extent_size);
            }
            var new_extent_size = Math.floor(current_extent_size * zoom_factor);
            anchor = this.parent.interaction.zooming.center - this.layout.margin.left - this.layout.origin.x;
            var offset_ratio = anchor / this.layout.cliparea.width;
            var new_x_extent_start = Math.max(Math.floor(this.x_scale.invert(ranges.x_shifted[0]) - ((new_extent_size - current_scaled_extent_size) * offset_ratio)), 1);
            ranges.x_shifted = [ this.x_scale(new_x_extent_start), this.x_scale(new_x_extent_start + new_extent_size) ];
        } else if (this.parent.interaction.dragging){
            switch (this.parent.interaction.dragging.method){
            case "background":
                ranges.x_shifted[0] = 0 + this.parent.interaction.dragging.dragged_x;
                ranges.x_shifted[1] = this.layout.cliparea.width + this.parent.interaction.dragging.dragged_x;
                break;
            case "x_tick":
                if (d3.event && d3.event.shiftKey){
                    ranges.x_shifted[0] = 0 + this.parent.interaction.dragging.dragged_x;
                    ranges.x_shifted[1] = this.layout.cliparea.width + this.parent.interaction.dragging.dragged_x;
                } else {
                    anchor = this.parent.interaction.dragging.start_x - this.layout.margin.left - this.layout.origin.x;
                    scalar = constrain(anchor / (anchor + this.parent.interaction.dragging.dragged_x), 3);
                    ranges.x_shifted[0] = 0;
                    ranges.x_shifted[1] = Math.max(this.layout.cliparea.width * (1 / scalar), 1);
                }
                break;
            case "y1_tick":
            case "y2_tick":
                var y_shifted = "y" + this.parent.interaction.dragging.method[1] + "_shifted";
                if (d3.event && d3.event.shiftKey){
                    ranges[y_shifted][0] = this.layout.cliparea.height + this.parent.interaction.dragging.dragged_y;
                    ranges[y_shifted][1] = 0 + this.parent.interaction.dragging.dragged_y;
                } else {
                    anchor = this.layout.cliparea.height - (this.parent.interaction.dragging.start_y - this.layout.margin.top - this.layout.origin.y);
                    scalar = constrain(anchor / (anchor - this.parent.interaction.dragging.dragged_y), 3);
                    ranges[y_shifted][0] = this.layout.cliparea.height;
                    ranges[y_shifted][1] = this.layout.cliparea.height - (this.layout.cliparea.height * (1 / scalar));
                }
            }
        }
    }

    // Generate scales and ticks for all axes, then render them
    ["x", "y1", "y2"].forEach(function(axis){
        if (!this[axis + "_extent"]){ return; }

        // Base Scale
        this[axis + "_scale"] = d3.scale.linear()
            .domain(this[axis + "_extent"])
            .range(ranges[axis + "_shifted"]);

        // Shift the extent
        this[axis + "_extent"] = [ this[axis + "_scale"].invert(ranges[axis][0]),
                                   this[axis + "_scale"].invert(ranges[axis][1]) ];

        // Finalize Scale
        this[axis + "_scale"] = d3.scale.linear()
                .domain(this[axis + "_extent"]).range(ranges[axis]);
        // Ticks
        if (this.layout.axes[axis].ticks){
            this[axis + "_ticks"] = this.layout.axes[axis].ticks;
        } else {
            this[axis + "_ticks"] = LocusZoom.prettyTicks(this[axis + "_extent"], "both");
        }

        // Render
        this.renderAxis(axis);
    }.bind(this));

    // Establish mousewheel zoom event handers on the panel (namespacing not passed through by d3, so not used here)
    if (this.layout.interaction.scroll_to_zoom){
        var zoom_handler = function(){
            // Look for a shift key press while scrolling to execute.
            // If not present, gracefully raise a notification and allow conventional scrolling
            if (!d3.event.shiftKey){
                if (this.parent.canInteract(this.id)){
                    this.loader.show("Press <tt>[SHIFT]</tt> while scrolling to zoom").hide(1000);
                }
                return;
            }
            d3.event.preventDefault();
            if (!this.parent.canInteract(this.id)){ return; }
            var coords = d3.mouse(this.svg.container.node());
            var delta = Math.max(-1, Math.min(1, (d3.event.wheelDelta || -d3.event.detail || -d3.event.deltaY)));
            if (delta == 0){ return; }
            this.parent.interaction = {
                panel_id: this.id,
                linked_panel_ids: this.getLinkedPanelIds("x"),
                zooming: {
                    scale: (delta < 1) ? 0.9 : 1.1,
                    center: coords[0]
                }
            };
            this.render();
            this.parent.interaction.linked_panel_ids.forEach(function(panel_id){
                this.parent.panels[panel_id].render();
            }.bind(this));
            if (this.zoom_timeout != null){ clearTimeout(this.zoom_timeout); }
            this.zoom_timeout = setTimeout(function(){
                this.parent.interaction = {};
                this.parent.applyState({ start: this.x_extent[0], end: this.x_extent[1] });
            }.bind(this), 500);
        }.bind(this);
        this.zoom_listener = d3.behavior.zoom();
        this.svg.container.call(this.zoom_listener)
            .on("wheel.zoom", zoom_handler)
            .on("mousewheel.zoom", zoom_handler)
            .on("DOMMouseScroll.zoom", zoom_handler);
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

    var canRender = this.layout.axes[axis].render
        && typeof this[axis + "_scale"] == "function"
        && !isNaN(this[axis + "_scale"](0));

    // If the axis has already been rendered then check if we can/can't render it
    // Make sure the axis element is shown/hidden to suit
    if (this[axis+"_axis"]){
        this.svg.container.select("g.lz-axis.lz-"+axis).style("display", canRender ? null : "none");
    }

    if (!canRender){ return this; }

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
    this[axis+"_axis"] = d3.svg.axis().scale(this[axis+"_scale"]).orient(axis_params[axis].orientation).tickPadding(3);

    // Set tick values and format
    if (ticksAreAllNumbers){
        this[axis+"_axis"].tickValues(this[axis+"_ticks"]);
        if (this.layout.axes[axis].tick_format == "region"){
            this[axis+"_axis"].tickFormat(function(d) { return LocusZoom.positionIntToString(d, 6); });
        }
    } else {
        var ticks = this[axis+"_ticks"].map(function(t){
            return(t[axis.substr(0,1)]);
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
    if (label != null){
        this.svg[axis+"_axis_label"]
            .attr("x", axis_params[axis].label_x).attr("y", axis_params[axis].label_y)
            .text(LocusZoom.parseFields(this.state, label));
        if (axis_params[axis].label_rotate != null){
            this.svg[axis+"_axis_label"]
                .attr("transform", "rotate(" + axis_params[axis].label_rotate + " " + axis_params[axis].label_x + "," + axis_params[axis].label_y + ")");
        }
    }

    // Attach interactive handlers to ticks as needed
    ["x", "y1", "y2"].forEach(function(axis){
        if (this.layout.interaction["drag_" + axis + "_ticks_to_scale"]){
            var namespace = "." + this.parent.id + "." + this.id + ".interaction.drag";
            var tick_mouseover = function(){
                if (typeof d3.select(this).node().focus == "function"){ d3.select(this).node().focus(); }
                var cursor = (axis == "x") ? "ew-resize" : "ns-resize";
                if (d3.event && d3.event.shiftKey){ cursor = "move"; }
                d3.select(this)
                    .style({"font-weight": "bold", "cursor": cursor})
                    .on("keydown" + namespace, tick_mouseover)
                    .on("keyup" + namespace, tick_mouseover);
            };
            this.svg.container.selectAll(".lz-axis.lz-" + axis + " .tick text")
                .attr("tabindex", 0) // necessary to make the tick focusable so keypress events can be captured
                .on("mouseover" + namespace, tick_mouseover)
                .on("mouseout" + namespace,  function(){
                    d3.select(this).style({"font-weight": "normal"});
                    d3.select(this).on("keydown" + namespace, null).on("keyup" + namespace, null);
                })
                .on("mousedown" + namespace, function(){
                    this.parent.startDrag(this, axis + "_tick");
                }.bind(this));
        }
    }.bind(this));

    return this;

};

// Force the height of this panel to the largest absolute height of the data in
// all child data layers (if not null for any child data layers)
// May optionally take an arbitrary target height (useful for when data layers are transitioning
// and the ending target height can be pre-calculated)
LocusZoom.Panel.prototype.scaleHeightToData = function(target_height){
    target_height = +target_height || null;
    if (target_height == null){
        this.data_layer_ids_by_z_index.forEach(function(id){
            var dh = this.data_layers[id].getAbsoluteDataHeight();
            if (+dh){
                if (target_height == null){ target_height = +dh; }
                else { target_height = Math.max(target_height, +dh); }
            }
        }.bind(this));
    }
    if (+target_height){
        target_height += +this.layout.margin.top + +this.layout.margin.bottom;
        this.setDimensions(this.layout.width, target_height);
        this.parent.setDimensions();
        this.parent.panel_ids_by_y_index.forEach(function(id){
            this.parent.panels[id].layout.proportional_height = null;
        }.bind(this));
        this.parent.positionPanels();
    }
};

// Methods to set/unset element statuses across all data layers
LocusZoom.Panel.prototype.setElementStatusByFilters = function(status, toggle, filters, exclusive){
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].setElementStatusByFilters(status, toggle, filters, exclusive);
    }.bind(this));
};
LocusZoom.Panel.prototype.setAllElementStatus = function(status, toggle){
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].setAllElementStatus(status, toggle);
    }.bind(this));
};
LocusZoom.DataLayer.Statuses.verbs.forEach(function(verb, idx){
    var adjective = LocusZoom.DataLayer.Statuses.adjectives[idx];
    var antiverb = "un" + verb;
    // Set/unset status for arbitrarily many elements given a set of filters
    LocusZoom.Panel.prototype[verb + "ElementsByFilters"] = function(filters, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        return this.setElementStatusByFilters(adjective, true, filters, exclusive);
    };
    LocusZoom.Panel.prototype[antiverb + "ElementsByFilters"] = function(filters, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        return this.setElementStatusByFilters(adjective, false, filters, exclusive);
    };
    // Set/unset status for all elements
    LocusZoom.Panel.prototype[verb + "AllElements"] = function(){
        this.setAllElementStatus(adjective, true);
        return this;
    };
    LocusZoom.Panel.prototype[antiverb + "AllElements"] = function(){
        this.setAllElementStatus(adjective, false);
        return this;
    };
});

// Add a "basic" loader to a panel
// This method is jsut a shortcut for adding the most commonly used type of loader
// which appears when data is requested, animates (e.g. shows an infinitely cycling
// progress bar as opposed to one that loads from 0-100% based on actual load progress),
// and disappears when new data is loaded and rendered.
LocusZoom.Panel.prototype.addBasicLoader = function(show_immediately){
    if (typeof show_immediately != "undefined"){ show_immediately = true; }
    if (show_immediately){
        this.loader.show("Loading...").animate();
    }
    this.on("data_requested", function(){
        this.loader.show("Loading...").animate();
    }.bind(this));
    this.on("data_rendered", function(){
        this.loader.hide();
    }.bind(this));
    return this;
};


    } catch (plugin_loading_error){
        console.error("LocusZoom Plugin error: " + plugin_loading_error);
    }

    return LocusZoom;

}));