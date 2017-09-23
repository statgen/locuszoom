/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Manhattan Data Layer
  Implements a manhattan plot data
*/

LocusZoom.DataLayers.add("manhattan", function(layout) {

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        point_radius: 2.3,
        tooltip_positioning: "horizontal",
        color: "#888888",
        y_axis: {
            axis: 1,
            floor: 0,
            upper_buffer: 0.10,
            min_extent: [ 0, 10 ]
        },
        x_axis: {
            floor: 0,
            group_padding: 0
        },
        id_field: "id"
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Implement the main render function
    this.render = function() {

        var data_layer = this;
        var x_scale = "x_scale";
        var y_scale = "y"+this.layout.y_axis.axis+"_scale";
        var chromosomes = this.data.chromosomes || {};
        var chromosome_padding = 0;
        if (this.layout.x_axis.ticks){ chromosome_padding = this.layout.x_axis.ticks.group_padding || 0; }

        // Binned variants
        var bins_selection = this.svg.group
            .selectAll("g.lz-data_layer-manhattan")
            .data(this.data.variant_bins, function(d){ return d.chrom + d.pos.toString(); });
        bins_selection.enter()
            .append("g")
            .attr("class", "lz-data_layer-manhattan");

        bins_selection.each(function(bin){
            var group = this;
            if (!chromosomes[bin.chrom]) { return; }
            var offset_position = bin.pos + (chromosomes[bin.chrom].index * chromosome_padding) + chromosomes[bin.chrom].start_position;
            var x = data_layer.parent[x_scale](offset_position);
            if (isNaN(x)) { return; }
            var color = LocusZoom.resolveScalableParameter(data_layer.layout.color, bin, chromosomes);
            bin.neglog10_pval_extents.forEach(function(bin_extent){
                var y1 = data_layer.parent[y_scale](bin_extent[0]);
                var y2 = data_layer.parent[y_scale](bin_extent[1]);
                if (isNaN(y1) || isNaN(y2)) { return; }
                d3.select(group).append("line")
                    .attr("x1", x).attr("x2", x)
                    .attr("y1", y1).attr("y2", y2)
                    .attr("stroke", color)
                    .attr("stroke-width", data_layer.layout.point_radius * 2);
            });
            bin.neglog10_pvals.forEach(function(bin_variant){
                var y = data_layer.parent[y_scale](bin_variant[0]);
                if (isNaN(y)) { return; }
                d3.select(group).append("circle")
                    .attr("cx", x).attr("cy", y).attr("fill", color)
                    .attr("r", data_layer.layout.point_radius);
            });
        });
        bins_selection.exit().remove();

        // Unbinned variants
        var variants_selection = this.svg.group
            .selectAll("circle.lz-data_layer-manhattan")
            .data(this.data.unbinned_variants, function(d){ return d[this.layout.id_field]; }.bind(this));
        var fill = function(d){
            return LocusZoom.resolveScalableParameter(this.layout.color, d, chromosomes);
        }.bind(this);
        var cx = function(d){
            var offset_position = d.pos + (chromosomes[d.chrom].index * chromosome_padding) + chromosomes[d.chrom].start_position;
            return data_layer.parent[x_scale](offset_position);
        };
        var cy = function(d){
            return data_layer.parent[y_scale](d["pval|neglog10"]);
        };
        variants_selection.enter()
            .append("circle")
            .attr("cx", cx) 
            .attr("cy", cy)
            .attr("r", data_layer.layout.point_radius)
            .attr("fill", fill)
            .attr("class", "lz-data_layer-manhattan");
        variants_selection.exit().remove();

        // Apply mouse behaviors only to unbinned variants
        this.applyBehaviors(variants_selection);
    };

    return this;

});
