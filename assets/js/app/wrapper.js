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

        <%= contents %>

    } catch (plugin_loading_error){
        console.error("LocusZoom Plugin error: " + plugin_loading_error);
    }

    return LocusZoom;

}));
