/* global d3,Q */
/* eslint-env browser */
/* eslint-disable no-console */

var LocusZoom = {
    version: "0.3.10"
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
        instance.positionPanels();
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
        // Get types for comparison. Treat nulls in the custom layout as undefined for simplicity.
        // (javascript treats nulls as "object" when we just want to overwrite them as if they're undefined)
        // Also separate arrays from objects as a discrete type.
        var custom_type  = custom_layout[property] == null ? "undefined" : typeof custom_layout[property];
        var default_type = typeof default_layout[property];
        if (custom_type == "object" && Array.isArray(custom_layout[property])){ custom_type = "array"; }
        if (default_type == "object" && Array.isArray(default_layout[property])){ default_type = "array"; }
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

// Standard Layout
LocusZoom.StandardLayout = {
    state: {},
    width: 800,
    height: 450,
    resizable: "responsive",
    aspect_ratio: (16/9),
    panels: {
        positions: {
            title: "Analysis ID: 3",
            description: "<b>Lorem ipsum</b> dolor sit amet, consectetur adipiscing elit.",
            width: 800,
            height: 225,
            origin: { x: 0, y: 0 },
            min_width:  400,
            min_height: 200,
            proportional_width: 1,
            proportional_height: 0.5,
            proportional_origin: { x: 0, y: 0 },
            margin: { top: 35, right: 50, bottom: 40, left: 50 },
            inner_border: "rgba(210, 210, 210, 0.85)",
            axes: {
                x: {
                    label_function: "chromosome",
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
            data_layers: {
                significance: {
                    type: "line",
                    fields: ["sig:x", "sig:y"],
                    z_index: 0,
                    style: {
                        "stroke": "#D3D3D3",
                        "stroke-width": "3px",
                        "stroke-dasharray": "10px 10px"
                    },
                    x_axis: {
                        field: "sig:x",
                        decoupled: true
                    },
                    y_axis: {
                        axis: 1,
                        field: "sig:y"
                    },
                    tooltip: {
                        html: "Significance Threshold: 3 × 10^-5"
                    }
                },
                recomb: {
                    type: "line",
                    fields: ["recomb:position", "recomb:recomb_rate"],
                    z_index: 1,
                    style: {
                        "stroke": "#0000FF",
                        "stroke-width": "1.5px"
                    },
                    x_axis: {
                        field: "recomb:position"
                    },
                    y_axis: {
                        axis: 2,
                        field: "recomb:recomb_rate",
                        floor: 0,
                        ceiling: 100
                    }
                },
                positions: {
                    type: "scatter",
                    point_shape: "circle",
                    point_size: {
                        scale_function: "if",
                        field: "ld:isrefvar",
                        parameters: {
                            field_value: 1,
                            then: 80,
                            else: 40
                        }
                    },
                    color: [
                        {
                            scale_function: "if",
                            field: "ld:isrefvar",
                            parameters: {
                                field_value: 1,
                                then: "#9632b8"
                            }
                        },
                        {
                            scale_function: "numerical_bin",
                            field: "ld:state",
                            parameters: {
                                breaks: [0, 0.2, 0.4, 0.6, 0.8],
                                values: ["#357ebd","#46b8da","#5cb85c","#eea236","#d43f3a"]
                            }
                        },
                        "#B8B8B8"
                    ],
                    fields: ["id", "position", "pvalue|scinotation", "pvalue|neglog10", "refAllele", "ld:state", "ld:isrefvar"],
                    z_index: 2,
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
                    highlighted: {
                        onmouseover: "on",
                        onmouseout: "off"
                    },
                    selected: {
                        onclick: "toggle_exclusive",
                        onshiftclick: "toggle"
                    },
                    tooltip: {
                        closable: true,
                        show: { or: ["highlighted", "selected"] },
                        hide: { and: ["unhighlighted", "unselected"] },
                        html: "<strong>{{id}}</strong><br>"
                            + "P Value: <strong>{{pvalue|scinotation}}</strong><br>"
                            + "Ref. Allele: <strong>{{refAllele}}</strong>"
                    }
                }
            }
        },
        genes: {
            width: 800,
            height: 225,
            origin: { x: 0, y: 225 },
            min_width: 400,
            min_height: 112.5,
            proportional_width: 1,
            proportional_height: 0.5,
            proportional_origin: { x: 0, y: 0.5 },
            margin: { top: 20, right: 50, bottom: 20, left: 50 },
            axes: {},
            data_layers: {
                genes: {
                    type: "genes",
                    fields: ["gene:gene", "constraint:constraint"],
                    id_field: "gene_id",
                    highlighted: {
                        onmouseover: "on",
                        onmouseout: "off"
                    },
                    selected: {
                        onclick: "toggle_exclusive",
                        onshiftclick: "toggle"
                    },
                    tooltip: {
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
                            + "<div style=\"width: 100%; text-align: right;\"><a href=\"http://exac.broadinstitute.org/gene/{{gene_id}}\" target=\"_new\">More data on ExAC</a></div>"
                    }
                }
            }
        }
    }
};
