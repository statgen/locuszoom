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
        point_radius: 2.3,
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

        // Binned variants
        var bins_selection = this.svg.group
            .selectAll("g.lz-data_layer-manhattan")
            .data(this.data.variant_bins);
        bins_selection.enter()
            .append("g")
            .attr("class", "lz-data_layer-manhattan");

        bins_selection.each(function(bin){
            var group = this;
            var x = data_layer.parent[x_scale](bin.pos);
            debugger;
            if (isNaN(x)){ return; }
            bin.neglog10_pval_extents.forEach(function(bin_extent){
                var y1 = data_layer.parent[y_scale](bin_extent[0]);
                var y2 = data_layer.parent[y_scale](bin_extent[1]);
                if (isNaN(y1) || isNaN(y2)){ return; }
                d3.select(group).append("line")
                    .attr("x1", x).attr("x2", x)
                    .attr("y1", y1).attr("y2", y2)
                    .attr("stroke-width", data_layer.layout.point_radius * 2);
            });
            bin.neglog10_pvals.forEach(function(bin_variant){
                var y = data_layer.parent[y_scale](bin_variant[0]);
                if (isNaN(y)){ return; }
                d3.select(group).append("circle")
                    .attr("cx", x).attr("cy", y).attr("r", data_layer.layout.point_radius);
            });
        });

        bins_selection.exit().remove();
    };

    return this;

});
