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
