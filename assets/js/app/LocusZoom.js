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
    function addInstanceToDivById(InstanceClass, id){
        // Initialize a new Instance
        var inst = exports._instances[id] = new InstanceClass(id);
        // Add an SVG to the div and set its dimensions
        inst.svg = d3.select("div#" + id)
            .append("svg").attr("id", id + "_svg").attr("class", "locuszoom");
        inst.setDimensions();
        // Initialize all panels
        inst.initialize();
        // Detect data-region and map to it if necessary
        if (typeof inst.svg.node().parentNode.dataset !== "undefined"
            && typeof inst.svg.node().parentNode.dataset.region !== "undefined"){
            var region = inst.svg.node().parentNode.dataset.region.split(/\D/);
            this._instances[id].mapTo(+region[0], +region[1], +region[2]);
        }
        return inst;
    };
    
    // Automatically detect divs by class and populate them with default LocusZoom instances
    exports.populate = function(selector, datasource, plotdef, state) {
        if (typeof selector  === "undefined"){
            selector = ".lz-instance";
        }
        if (typeof plotdef  === "undefined"){
            plotdef = LocusZoom.DefaultInstance;
        }
        if (typeof state  === "undefined"){
            state = {};
        }
        var instance;
        d3.select(selector).each(function(){
            instance = addInstanceToDivById(plotdef, this.id);
        });
        return instance;
    };

    exports.populateAll = function(selector, datasource, plotdef, state) {
        var instances = [];
        d3.selectAll(selector).each(function(d,i) {
            instances[i] = exports.populate(this, datasource, plotdef, state)
        });
        return instances;
    }
    
    // Format a number as a Megabase value, limiting to two decimal places unless sufficiently small
    exports.formatMegabase = function(p){
        var places = Math.max(6 - Math.floor((Math.log(p) / Math.LN10).toFixed(9)), 2);
        return "" + (p / Math.pow(10, 6)).toFixed(places);
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

