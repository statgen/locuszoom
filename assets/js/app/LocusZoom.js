/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

(function(exports){

    "use strict";

    // Version number
    exports.version = "0.1";

    // Object for storing key-indexed Instance objects
    exports._instances = {};

    // Create a new instance by instance class and attach it to a div by ID
    // NOTE: if no InstanceClass is passed then the instance will use the Intance base class.
    //       The DefaultInstance class must be passed explicitly just as any other class that extends Instance.
    exports.addInstanceToDivById = function(InstanceClass, id){
        // Initialize a new Instance
        if (typeof InstanceClass === "undefined"){
            InstanceClass = LocusZoom.Instance;
        }
        this._instances[id] = new InstanceClass(id);
        // Add an SVG to the div and set its dimensions
        this._instances[id].svg = d3.select("div#" + id)
            .append("svg").attr("id", id + "_svg").attr("class", "locuszoom");
        this._instances[id].setDimensions();
        // Initialize all panels
        this._instances[id].initialize();
        // Detect data-region and map to it if necessary
        if (typeof this._instances[id].svg.node().parentNode.dataset !== "undefined"
            && typeof this._instances[id].svg.node().parentNode.dataset.region !== "undefined"){
            var region = this._instances[id].svg.node().parentNode.dataset.region.split(/\D/);
            this._instances[id].mapTo(+region[0], +region[1], +region[2]);
        }
        return this._instances[id];
    };
    
    // Automatically detect divs by class and populate them with default LocusZoom instances
    exports.populate = function(class_name){
        if (typeof class_name === "undefined"){
            class_name = "lz-instance";
        }
        d3.selectAll("div." + class_name).each(function(){
            LocusZoom.addInstanceToDivById(LocusZoom.DefaultInstance, this.id);
        });
    };
    
    // Format a number as a Megabase value, limiting to two decimal places unless sufficiently small
    exports.formatMegabase = function(p){
        var places = Math.max(6 - Math.floor((Math.log(p) / Math.LN10).toFixed(9)), 2);
        return "" + (p / Math.pow(10, 6)).toFixed(places);
    };

    // Generate a "pretty" set of ticks (multiples of 1, 2, or 5 on the same order of magnitude for the range)
    // Based on R's "pretty" function: https://github.com/wch/r-source/blob/b156e3a711967f58131e23c1b1dc1ea90e2f0c43/src/appl/pretty.c
    // Optionally specify n for a "target" number of ticks. Will not necessarily be the number of ticks you get! Defaults to 5.
    exports.prettyTicks = function(range, n, internal_only){
        if (typeof n == "undefined" || isNaN(parseInt(n))){
  	        n = 5;
        }
        n = parseInt(n);
        if (typeof internal_only == "undefined"){
            internal_only = false;
        }

        var min_n = n / 3;
        var shrink_sml = 0.75;
        var high_u_bias = 1.5;
        var u5_bias = 0.5 + 1.5 * high_u_bias;
  
        var d = Math.abs(range[0] - range[1]);
        var c = d / n;
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
        if (range[0] <= unit){
            var i = 0;
        } else {
            var i = Math.floor(range[0]/unit)*unit;
            i = parseFloat(i.toFixed(base_toFixed));
        }
        while (i < range[1]){
            ticks.push(i);
            i += unit;
            if (base_toFixed > 0){
                i = parseFloat(i.toFixed(base_toFixed));
            }
        }
        ticks.push(i);

        if (internal_only){
            if (ticks[0] < range[0]){ ticks = ticks.slice(1); }
            if (ticks[ticks.length-1] > range[1]){ ticks.pop(); }
        }

        console.log(range, ticks);

        return ticks;
    };
    
    // From http://www.html5rocks.com/en/tutorials/cors/
    // and with promises from https://gist.github.com/kriskowal/593076
    exports.createCORSPromise = function (method, url, body, timeout) {
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
                        response.reject("HTTP" + xhr.status + " for " + url);
                    }
                }
            };
            timeout && setTimeout(response.reject, timeout);
            body = typeof body !== "undefined" ? body : "";
            xhr.send(body);
        } 
        return response.promise;
    };

})(this.LocusZoom = {});

