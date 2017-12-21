"use strict";

/**
 * Create a single continuous 2D track that provides information about each datapoint
 *
 * For example, this can be used to color by membership in a group, alongside information in other panels
 *
 * @class LocusZoom.DataLayers.annotation_track
 * @augments LocusZoom.DataLayer
 * @param {Object} layout
 * @param {Object|String} [layout.color]
 * @param {Array[]} An array of filter entries specifying which points to draw annotations for.
 *  See `LocusZoom.DataLayer.filter` for details
 */
LocusZoom.DataLayers.add("annotation_track", function(layout) {
    // In the future we may add additional options for controlling marker size/ shape, based on user feedback
    this.DefaultLayout = {
        color: "#000000",
        filters: []
    };

    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    if (!Array.isArray(layout.filters)) {
        throw "Annotation track must specify array of filters for selecting points to annotate";
    }

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    this.render = function() {
        var self = this;
        // Only render points that currently satisfy all provided filter conditions.
        var trackData = this.filter(this.layout.filters, "elements");

        var selection = this.svg.group
            .selectAll("rect.lz-data_layer-" + self.layout.type)
            .data(trackData, function(d) { return d[self.layout.id_field]; });

        // Add new elements as needed
        selection.enter()
            .append("rect")
            .attr("class", "lz-data_layer-" + this.layout.type)
            .attr("id", function (d){ return self.getElementId(d); });
        // Update the set of elements to reflect new data
        selection
            .attr("x", function (d) { return self.parent["x_scale"](d[self.layout.x_axis.field]); })
            .attr("width", 1)  // TODO autocalc width of track? Based on datarange / pixel width presumably
            .attr("height", self.parent.layout.height)
            .attr("fill", function(d){ return self.resolveScalableParameter(self.layout.color, d); });
        // Remove unused elements
        selection.exit().remove();

        // Set up tooltips and mouse interaction
        this.applyBehaviors(selection);
    };

    // Reimplement the positionTooltip() method to be annotation-specific
    this.positionTooltip = function(id) {
        if (typeof id != "string") {
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]) {
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var top, left, arrow_type, arrow_top, arrow_left;
        var tooltip = this.tooltips[id];
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var offset = stroke_width / 2;
        var page_origin = this.getPageOrigin();

        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);

        var x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        var y_center = data_layer_height / 2;

        // Tooltip should be horizontally centered above the point to be annotated. (or below if space is limited)
        var offset_right = Math.max((tooltip_box.width / 2) - x_center, 0);
        var offset_left = Math.max((tooltip_box.width / 2) + x_center - data_layer_width, 0);
        left = page_origin.x + x_center - (tooltip_box.width / 2) - offset_left + offset_right;
        arrow_left = (tooltip_box.width / 2) - (arrow_width) + offset_left - offset_right - offset;
        if (tooltip_box.height + stroke_width + arrow_width > data_layer_height - y_center) {
            top = page_origin.y + y_center - (tooltip_box.height + stroke_width + arrow_width);
            arrow_type = "down";
            arrow_top = tooltip_box.height - stroke_width;
        } else {
            top = page_origin.y + y_center + stroke_width + arrow_width;
            arrow_type = "up";
            arrow_top = 0 - stroke_width - arrow_width;
        }
        // Apply positions to the main div
        tooltip.selector.style("left", left + "px").style("top", top + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow) {
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style("left", arrow_left + "px")
            .style("top", arrow_top + "px");
    };

    return this;
});
