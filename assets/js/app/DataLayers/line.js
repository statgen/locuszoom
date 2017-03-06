/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Line Data Layer
  Implements a standard line plot
*/

LocusZoom.DataLayers.add("line", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        style: {
            fill: "none",
            "stroke-width": "2px"
        },
        interpolate: "linear",
        x_axis: { field: "x" },
        y_axis: { field: "y", axis: 1 },
        hitarea_width: 5
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Var for storing mouse events for use in tool tip positioning
    this.mouse_event = null;

    // Var for storing the generated line function itself
    this.line = null;

    this.tooltip_timeout = null;

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Helper function to get display and data objects representing
    // the x/y coordinates of the current mouse event with respect to the line in terms of the display
    // and the interpolated values of the x/y fields with respect to the line
    this.getMouseDisplayAndData = function(){
        var ret = {
            display: {
                x: d3.mouse(this.mouse_event)[0],
                y: null
            },
            data: {},
            slope: null
        };
        var x_field = this.layout.x_axis.field;
        var y_field = this.layout.y_axis.field;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";
        ret.data[x_field] = this.parent[x_scale].invert(ret.display.x);
        var bisect = d3.bisector(function(datum) { return +datum[x_field]; }).left;
        var index = bisect(this.data, ret.data[x_field]) - 1;
        var startDatum = this.data[index];
        var endDatum = this.data[index + 1];
        var interpolate = d3.interpolateNumber(+startDatum[y_field], +endDatum[y_field]);
        var range = +endDatum[x_field] - +startDatum[x_field];
        ret.data[y_field] = interpolate((ret.data[x_field] % range) / range);
        ret.display.y = this.parent[y_scale](ret.data[y_field]);
        if (this.layout.tooltip.x_precision){
            ret.data[x_field] = ret.data[x_field].toPrecision(this.layout.tooltip.x_precision);
        }
        if (this.layout.tooltip.y_precision){
            ret.data[y_field] = ret.data[y_field].toPrecision(this.layout.tooltip.y_precision);
        }
        ret.slope = (this.parent[y_scale](endDatum[y_field]) - this.parent[y_scale](startDatum[y_field]))
                  / (this.parent[x_scale](endDatum[x_field]) - this.parent[x_scale](startDatum[x_field]));
        return ret;
    };

    // Reimplement the positionTooltip() method to be line-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var arrow_width = 7; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var stroke_width = parseFloat(this.layout.style["stroke-width"]) || 1;
        var page_origin = this.getPageOrigin();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        var top, left, arrow_top, arrow_left, arrow_type;

        // Determine x/y coordinates for display and data
        var dd = this.getMouseDisplayAndData();

        // If the absolute value of the slope of the line at this point is above 1 (including Infinity)
        // then position the tool tip left/right. Otherwise position top/bottom.
        if (Math.abs(dd.slope) > 1){

            // Position horizontally on the left or the right depending on which side of the plot the point is on
            if (dd.display.x <= this.parent.layout.width / 2){
                left = page_origin.x + dd.display.x + stroke_width + arrow_width + stroke_width;
                arrow_type = "left";
                arrow_left = -1 * (arrow_width + stroke_width);
            } else {
                left = page_origin.x + dd.display.x - tooltip_box.width - stroke_width - arrow_width - stroke_width;
                arrow_type = "right";
                arrow_left = tooltip_box.width - stroke_width;
            }
            // Position vertically centered unless we're at the top or bottom of the plot
            if (dd.display.y - (tooltip_box.height / 2) <= 0){ // Too close to the top, push it down
                top = page_origin.y + dd.display.y - (1.5 * arrow_width) - border_radius;
                arrow_top = border_radius;
            } else if (dd.display.y + (tooltip_box.height / 2) >= data_layer_height){ // Too close to the bottom, pull it up
                top = page_origin.y + dd.display.y + arrow_width + border_radius - tooltip_box.height;
                arrow_top = tooltip_box.height - (2 * arrow_width) - border_radius;
            } else { // vertically centered
                top = page_origin.y + dd.display.y - (tooltip_box.height / 2);
                arrow_top = (tooltip_box.height / 2) - arrow_width;
            }

        } else {

            // Position horizontally: attempt to center on the mouse's x coordinate
            // pad to either side if bumping up against the edge of the data layer
            var offset_right = Math.max((tooltip_box.width / 2) - dd.display.x, 0);
            var offset_left = Math.max((tooltip_box.width / 2) + dd.display.x - data_layer_width, 0);
            left = page_origin.x + dd.display.x - (tooltip_box.width / 2) - offset_left + offset_right;
            var min_arrow_left = arrow_width / 2;
            var max_arrow_left = tooltip_box.width - (2.5 * arrow_width);
            arrow_left = (tooltip_box.width / 2) - arrow_width + offset_left - offset_right;
            arrow_left = Math.min(Math.max(arrow_left, min_arrow_left), max_arrow_left);

            // Position vertically above the line unless there's insufficient space
            if (tooltip_box.height + stroke_width + arrow_width > dd.display.y){
                top = page_origin.y + dd.display.y + stroke_width + arrow_width;
                arrow_type = "up";
                arrow_top = 0 - stroke_width - arrow_width;
            } else {
                top = page_origin.y + dd.display.y - (tooltip_box.height + stroke_width + arrow_width);
                arrow_type = "down";
                arrow_top = tooltip_box.height - stroke_width;
            }
        }

        // Apply positions to the main div
        tooltip.selector.style({ left: left + "px", top: top + "px" });
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style({ "left": arrow_left + "px", top: arrow_top + "px" });

    };


    // Implement the main render function
    this.render = function(){

        // Several vars needed to be in scope
        var data_layer = this;
        var panel = this.parent;
        var x_field = this.layout.x_axis.field;
        var y_field = this.layout.y_axis.field;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";

        // Join data to the line selection
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-line")
            .data([this.data]);

        // Create path element, apply class
        this.path = selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-line");

        // Generate the line
        this.line = d3.svg.line()
            .x(function(d) { return parseFloat(panel[x_scale](d[x_field])); })
            .y(function(d) { return parseFloat(panel[y_scale](d[y_field])); })
            .interpolate(this.layout.interpolate);

        // Apply line and style
        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("d", this.line)
                .style(this.layout.style);
        } else {
            selection
                .attr("d", this.line)
                .style(this.layout.style);
        }

        // Apply tooltip, etc
        if (this.layout.tooltip){
            // Generate an overlaying transparent "hit area" line for more intuitive mouse events
            var hitarea_width = parseFloat(this.layout.hitarea_width).toString() + "px";
            var hitarea = this.svg.group
                .selectAll("path.lz-data_layer-line-hitarea")
                .data([this.data]);
            hitarea.enter()
                .append("path")
                .attr("class", "lz-data_layer-line-hitarea")
                .style("stroke-width", hitarea_width);
            var hitarea_line = d3.svg.line()
                .x(function(d) { return parseFloat(panel[x_scale](d[x_field])); })
                .y(function(d) { return parseFloat(panel[y_scale](d[y_field])); })
                .interpolate(this.layout.interpolate);
            hitarea
                .attr("d", hitarea_line)
                .on("mouseover", function(){
                    clearTimeout(data_layer.tooltip_timeout);
                    data_layer.mouse_event = this;
                    var dd = data_layer.getMouseDisplayAndData();
                    data_layer.createTooltip(dd.data);
                })
                .on("mousemove", function(){
                    clearTimeout(data_layer.tooltip_timeout);
                    data_layer.mouse_event = this;
                    var dd = data_layer.getMouseDisplayAndData();
                    data_layer.updateTooltip(dd.data);
                    data_layer.positionTooltip(data_layer.getElementId());
                })
                .on("mouseout", function(){
                    data_layer.tooltip_timeout = setTimeout(function(){
                        data_layer.mouse_event = null;
                        data_layer.destroyTooltip(data_layer.getElementId());
                    }, 300);
                });
            hitarea.exit().remove();
        }

        // Remove old elements as needed
        selection.exit().remove();
        
    };

    // Redefine setElementStatus family of methods as line data layers will only ever have a single path element
    this.setElementStatus = function(status, element, toggle){
        return this.setAllElementStatus(status, toggle);
    };
    this.setElementStatusByFilters = function(status, toggle){
        return this.setAllElementStatus(status, toggle);
    };
    this.setAllElementStatus = function(status, toggle){
        // Sanity check
        if (typeof status == "undefined" || LocusZoom.DataLayer.Statuses.adjectives.indexOf(status) == -1){
            throw("Invalid status passed to DataLayer.setAllElementStatus()");
        }
        if (typeof this.state[this.state_id][status] == "undefined"){ return this; }
        if (typeof toggle == "undefined"){ toggle = true; }

        // Update global status flag
        this.global_statuses[status] = toggle;

        // Apply class to path based on global status flags
        var path_class = "lz-data_layer-line";
        Object.keys(this.global_statuses).forEach(function(global_status){
            if (this.global_statuses[global_status]){ path_class += " lz-data_layer-line-" + global_status; }
        }.bind(this));
        this.path.attr("class", path_class);

        // Trigger layout changed event hook
        this.parent.emit("layout_changed");
        this.parent_plot.emit("layout_changed");
        
        return this;
    };

    return this;

});


/***************************
  Orthogonal Line Data Layer
  Implements a horizontal or vertical line given an orientation and an offset in the layout
  Does not require a data source
*/

LocusZoom.DataLayers.add("orthogonal_line", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        style: {
            "stroke": "#D3D3D3",
            "stroke-width": "3px",
            "stroke-dasharray": "10px 10px"
        },
        orientation: "horizontal",
        x_axis: {
            axis: 1,
            decoupled: true
        },
        y_axis: {
            axis: 1,
            decoupled: true
        },
        offset: 0
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Require that orientation be "horizontal" or "vertical" only
    if (["horizontal","vertical"].indexOf(layout.orientation) == -1){
        layout.orientation = "horizontal";
    }

    // Vars for storing the data generated line
    this.data = [];
    this.line = null;

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Implement the main render function
    this.render = function(){

        // Several vars needed to be in scope
        var panel = this.parent;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";
        var x_extent = "x_extent";
        var y_extent = "y" + this.layout.y_axis.axis + "_extent";
        var x_range = "x_range";
        var y_range = "y" + this.layout.y_axis.axis + "_range";

        // Generate data using extents depending on orientation
        if (this.layout.orientation == "horizontal"){
            this.data = [
                { x: panel[x_extent][0], y: this.layout.offset },
                { x: panel[x_extent][1], y: this.layout.offset }
            ];
        } else {
            this.data = [
                { x: this.layout.offset, y: panel[y_extent][0] },
                { x: this.layout.offset, y: panel[y_extent][1] }
            ];
        }

        // Join data to the line selection
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-line")
            .data([this.data]);

        // Create path element, apply class
        this.path = selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-line");

        // Generate the line
        this.line = d3.svg.line()
            .x(function(d, i) {
                var x = parseFloat(panel[x_scale](d["x"]));
                return isNaN(x) ? panel[x_range][i] : x;
            })
            .y(function(d, i) {
                var y = parseFloat(panel[y_scale](d["y"]));
                return isNaN(y) ? panel[y_range][i] : y;
            })
            .interpolate("linear");

        // Apply line and style
        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("d", this.line)
                .style(this.layout.style);
        } else {
            selection
                .attr("d", this.line)
                .style(this.layout.style);
        }

        // Remove old elements as needed
        selection.exit().remove();
        
    };

    return this;

});
