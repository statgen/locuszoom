!function() {
    try {

        // Verify that the two prime dependencies - d3 and Q - are already met
        /*
        var minimum_d3_version = "3.5.6";
        if (typeof d3 != "object" || d3.version < minimum_d3_version){
            throw("LocusZoom unable to load: d3 dependency not met. Missing or outdated version detected.\nRequired d3 version: " + minimum_d3_version + " or higher.");
        }
        if (typeof Q != "function"){
            throw("LocusZoom unable to load: Q dependency not met. Library missing.");
        }
        */

        <%= contents %>

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
