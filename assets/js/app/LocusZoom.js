/* global d3,Q */
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
        this._instances[id].initializePanels();
        // Detect data-region and map to it if necessary
        if (typeof this._instances[id].svg.node().parentNode.dataset.region !== "undefined"){
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
    
    // Format positional tick values in terms of kilo/mega/giga bases
    exports.formatPosition = function(p){
        var log10 = (Math.log(p) / Math.LN10).toFixed(12);
        var SIpre = { 0: "", 3: "K", 6: "M", 9: "G" };
        var scale = 9;
        var label = "";
        while (scale >= 0){
            if (log10 >= scale){
                label = (p / Math.pow(10,scale)).toFixed(2) + " " + SIpre[scale] + "b";
                break;
            } else {
                scale -= 3;
            }
        }
        return label;
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

