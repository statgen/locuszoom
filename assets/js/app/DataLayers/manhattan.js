/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Manhattan Data Layer
  Implements a manhattan plot data
*/

LocusZoom.DataLayers.add("manhattan", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        point_size: 18,
        point_shape: "circle",
        tooltip_positioning: "horizontal",
        color: "#888888",
        y_axis: {
            axis: 1
        },
        id_field: "id"
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Implement the main render function
    this.render = function(){

        var data_layer = this;
        var x_scale = "x_scale";
        var y_scale = "y"+this.layout.y_axis.axis+"_scale";
            
        debugger;
    };

    return this;

});
