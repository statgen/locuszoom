/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Scatter Data Layer
  Implements a standard scatter plot
*/

LocusZoom.DataLayers.add("scatter", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        point_size: 40,
        point_shape: "circle",
        tooltip_positioning: "horizontal",
        color: "#888888",
        fill_opacity: 1,
        y_axis: {
            axis: 1
        },
        id_field: "id"
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Extra default for layout spacing
    // Not in default layout since that would make the label attribute always present
    if (layout.label && isNaN(layout.label.spacing)){
        layout.label.spacing = 4;
    }

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Reimplement the positionTooltip() method to be scatter-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var top, left, arrow_type, arrow_top, arrow_left;
        var tooltip = this.tooltips[id];
        var point_size = this.resolveScalableParameter(this.layout.point_size, tooltip.data);
        var offset = Math.sqrt(point_size / Math.PI);
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        var y_scale  = "y"+this.layout.y_axis.axis+"_scale";
        var y_center = this.parent[y_scale](tooltip.data[this.layout.y_axis.field]);
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        if (this.layout.tooltip_positioning == "vertical"){
            // Position horizontally centered above the point
            var offset_right = Math.max((tooltip_box.width / 2) - x_center, 0);
            var offset_left = Math.max((tooltip_box.width / 2) + x_center - data_layer_width, 0);
            var left = page_origin.x + x_center - (tooltip_box.width / 2) - offset_left + offset_right;
            var arrow_left = (tooltip_box.width / 2) - (arrow_width / 2) + offset_left - offset_right - offset;
            // Position vertically above the point unless there's insufficient space, then go below
            if (tooltip_box.height + stroke_width + arrow_width > data_layer_height - (y_center + offset)){
                top = page_origin.y + y_center - (offset + tooltip_box.height + stroke_width + arrow_width);
                arrow_type = "down";
                arrow_top = tooltip_box.height - stroke_width;
            } else {
                top = page_origin.y + y_center + offset + stroke_width + arrow_width;
                arrow_type = "up";
                arrow_top = 0 - stroke_width - arrow_width;
            }
        } else {
            // Position horizontally on the left or the right depending on which side of the plot the point is on
            if (x_center <= this.parent.layout.width / 2){
                left = page_origin.x + x_center + offset + arrow_width + stroke_width;
                arrow_type = "left";
                arrow_left = -1 * (arrow_width + stroke_width);
            } else {
                left = page_origin.x + x_center - tooltip_box.width - offset - arrow_width - stroke_width;
                arrow_type = "right";
                arrow_left = tooltip_box.width - stroke_width;
            }
            // Position vertically centered unless we're at the top or bottom of the plot
            var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
            var top, arrow_top;
            if (y_center - (tooltip_box.height / 2) <= 0){ // Too close to the top, push it down
                top = page_origin.y + y_center - (1.5 * arrow_width) - border_radius;
                arrow_top = border_radius;
            } else if (y_center + (tooltip_box.height / 2) >= data_layer_height){ // Too close to the bottom, pull it up
                top = page_origin.y + y_center + arrow_width + border_radius - tooltip_box.height;
                arrow_top = tooltip_box.height - (2 * arrow_width) - border_radius;
            } else { // vertically centered
                top = page_origin.y + y_center - (tooltip_box.height / 2);
                arrow_top = (tooltip_box.height / 2) - arrow_width;
            }
        }
        // Apply positions to the main div
        tooltip.selector.style("left", left + "px").style("top", top + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style("left", arrow_left + "px")
            .style("top", arrow_top + "px");
    };

    // Function to flip labels from being anchored at the start of the text to the end
    // Both to keep labels from running outside the data layer and  also as a first
    // pass on recursive separation
    this.flip_labels = function(){
        var data_layer = this;
        var point_size = data_layer.resolveScalableParameter(data_layer.layout.point_size, {});
        var spacing = data_layer.layout.label.spacing;
        var handle_lines = Boolean(data_layer.layout.label.lines);
        var min_x = 2 * spacing;
        var max_x = data_layer.parent.layout.width - data_layer.parent.layout.margin.left - data_layer.parent.layout.margin.right - (2 * spacing);
        var flip = function(dn, dnl){
            var dnx = +dn.attr("x");
            var text_swing = (2 * spacing) + (2 * Math.sqrt(point_size));
            if (handle_lines){
                var dnlx2 = +dnl.attr("x2");
                var line_swing = spacing + (2 * Math.sqrt(point_size));
            }
            if (dn.style("text-anchor") == "start"){
                dn.style("text-anchor", "end");
                dn.attr("x", dnx - text_swing);
                if (handle_lines){ dnl.attr("x2", dnlx2 - line_swing); }
            } else {
                dn.style("text-anchor", "start");
                dn.attr("x", dnx + text_swing);
                if (handle_lines){ dnl.attr("x2", dnlx2 + line_swing); }
            }
        };
        // Flip any going over the right edge from the right side to the left side
        // (all labels start on the right side)
        data_layer.label_texts.each(function (d, i) {
            var a = this;
            var da = d3.select(a);
            var dax = +da.attr("x");
            var abound = da.node().getBoundingClientRect();
            if (dax + abound.width + spacing > max_x){
                var dal = handle_lines ? d3.select(data_layer.label_lines[0][i]) : null;
                flip(da, dal);
            }
        });
        // Second pass to flip any others that haven't flipped yet if they collide with another label
        data_layer.label_texts.each(function (d, i) {
            var a = this;
            var da = d3.select(a);
            if (da.style("text-anchor") == "end") return;
            var dax = +da.attr("x");
            var abound = da.node().getBoundingClientRect();
            var dal = handle_lines ? d3.select(data_layer.label_lines[0][i]) : null;
            data_layer.label_texts.each(function () {
                var b = this;
                var db = d3.select(b);
                var bbound = db.node().getBoundingClientRect();
                var collision = abound.left < bbound.left + bbound.width + (2*spacing) &&
                    abound.left + abound.width + (2*spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2*spacing) &&
                    abound.height + abound.top + (2*spacing) > bbound.top;
                if (collision){
                    flip(da, dal);
                    // Double check that this flip didn't push the label past min_x. If it did, immediately flip back.
                    dax = +da.attr("x");
                    if (dax - abound.width - spacing < min_x){
                        flip(da, dal);
                    }
                }
                return;
            });
        });
    };

    // Recursive function to space labels apart immediately after initial render
    // Adapted from thudfactor's fiddle here: https://jsfiddle.net/thudfactor/HdwTH/
    // TODO: Make labels also aware of data elements
    this.separate_labels = function(){
        this.seperate_iterations++;
        var data_layer = this;
        var alpha = 0.5;
        var spacing = this.layout.label.spacing;
        var again = false;
        data_layer.label_texts.each(function () {
            var a = this;
            var da = d3.select(a);
            var y1 = da.attr("y");
            data_layer.label_texts.each(function () {
                var b = this;
                // a & b are the same element and don't collide.
                if (a == b) return;
                var db = d3.select(b);
                // a & b are on opposite sides of the chart and
                // don't collide
                if (da.attr("text-anchor") != db.attr("text-anchor")) return;
                // Determine if the  bounding rects for the two text elements collide
                var abound = da.node().getBoundingClientRect();
                var bbound = db.node().getBoundingClientRect();
                var collision = abound.left < bbound.left + bbound.width + (2*spacing) &&
                    abound.left + abound.width + (2*spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2*spacing) &&
                    abound.height + abound.top + (2*spacing) > bbound.top;
                if (!collision) return;
                again = true;
                // If the labels collide, we'll push each
                // of the two labels up and down a little bit.
                var y2 = db.attr("y");
                var sign = abound.top < bbound.top ? 1 : -1;
                var adjust = sign * alpha;
                var new_a_y = +y1 - adjust;
                var new_b_y = +y2 + adjust;
                // Keep new values from extending outside the data layer
                var min_y = 2 * spacing;
                var max_y = data_layer.parent.layout.height - data_layer.parent.layout.margin.top - data_layer.parent.layout.margin.bottom - (2 * spacing);
                var delta;
                if (new_a_y - (abound.height/2) < min_y){
                    delta = +y1 - new_a_y;
                    new_a_y = +y1;
                    new_b_y += delta;
                } else if (new_b_y - (bbound.height/2) < min_y){
                    delta = +y2 - new_b_y;
                    new_b_y = +y2;
                    new_a_y += delta;
                }
                if (new_a_y + (abound.height/2) > max_y){
                    delta = new_a_y - +y1;
                    new_a_y = +y1;
                    new_b_y -= delta;
                } else if (new_b_y + (bbound.height/2) > max_y){
                    delta = new_b_y - +y2;
                    new_b_y = +y2;
                    new_a_y -= delta;
                }
                da.attr("y",new_a_y);
                db.attr("y",new_b_y);
            });
        });
        if (again) {
            // Adjust lines to follow the labels
            if (data_layer.layout.label.lines){
                var label_elements = data_layer.label_texts[0];
                data_layer.label_lines.attr("y2",function(d,i) {
                    var label_line = d3.select(label_elements[i]);
                    return label_line.attr("y");
                });
            }
            // After ~150 iterations we're probably beyond diminising returns, so stop recursing
            if (this.seperate_iterations < 150){
                setTimeout(function(){
                    this.separate_labels();
                }.bind(this), 1);
            }
        }
    };

    // Implement the main render function
    this.render = function(){

        var data_layer = this;
        var x_scale = "x_scale";
        var y_scale = "y"+this.layout.y_axis.axis+"_scale";

        // Generate labels first (if defined)
        if (this.layout.label){
            // Apply filters to generate a filtered data set
            var filtered_data = this.data.filter(function(d){
                if (!data_layer.layout.label.filters){
                    return true;
                } else {
                    // Start by assuming a match, run through all filters to test if not a match on any one
                    var match = true;
                    data_layer.layout.label.filters.forEach(function(filter){
                        var field_value = (new LocusZoom.Data.Field(filter.field)).resolve(d);
                        if (isNaN(field_value)){
                            match = false;
                        } else {
                            switch (filter.operator){
                            case "<":
                                if (!(field_value < filter.value)){ match = false; }
                                break;
                            case "<=":
                                if (!(field_value <= filter.value)){ match = false; }
                                break;
                            case ">":
                                if (!(field_value > filter.value)){ match = false; }
                                break;
                            case ">=":
                                if (!(field_value >= filter.value)){ match = false; }
                                break;
                            case "=":
                                if (!(field_value == filter.value)){ match = false; }
                                break;
                            default:
                                // If we got here the operator is not valid, so the filter should fail
                                match = false;
                                break;
                            }
                        }
                    });
                    return match;
                }
            });
            // Render label groups
            this.label_groups = this.svg.group
                .selectAll("g.lz-data_layer-scatter-label")
                .data(filtered_data, function(d){ return d.id + "_label"; });
            this.label_groups.enter()
                .append("g")
                .attr("class", "lz-data_layer-scatter-label");
            // Render label texts
            if (this.label_texts){ this.label_texts.remove(); }
            this.label_texts = this.label_groups.append("text")
                .attr("class", "lz-data_layer-scatter-label");
            this.label_texts
                .text(function(d){
                    return LocusZoom.parseFields(d, data_layer.layout.label.text || "");
                })
                .style(data_layer.layout.label.style || {})
                .attr({
                    "x": function(d){
                        var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field])
                              + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                              + data_layer.layout.label.spacing;
                        if (isNaN(x)){ x = -1000; }
                        return x;
                    },
                    "y": function(d){
                        var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                        if (isNaN(y)){ y = -1000; }
                        return y;
                    },
                    "text-anchor": function(){
                        return "start";
                    }
                });
            // Render label lines
            if (data_layer.layout.label.lines){
                if (this.label_lines){ this.label_lines.remove(); }
                this.label_lines = this.label_groups.append("line")
                    .attr("class", "lz-data_layer-scatter-label");
                this.label_lines
                    .style(data_layer.layout.label.lines.style || {})
                    .attr({
                        "x1": function(d){
                            var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field]);
                            if (isNaN(x)){ x = -1000; }
                            return x;
                        },
                        "y1": function(d){
                            var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                            if (isNaN(y)){ y = -1000; }
                            return y;
                        },
                        "x2": function(d){
                            var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field])
                                  + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                                  + (data_layer.layout.label.spacing/2);
                            if (isNaN(x)){ x = -1000; }
                            return x;
                        },
                        "y2": function(d){
                            var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                            if (isNaN(y)){ y = -1000; }
                            return y;
                        }
                    });
            }
            // Remove labels when they're no longer in the filtered data set
            this.label_groups.exit().remove();
        }
            
        // Generate main scatter data elements
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-scatter")
            .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));

        // Create elements, apply class, ID, and initial position
        var initial_y = isNaN(this.parent.layout.height) ? 0 : this.parent.layout.height;
        selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-scatter")
            .attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .attr("transform", "translate(0," + initial_y + ")");

        // Generate new values (or functions for them) for position, color, size, and shape
        var transform = function(d) {
            var x = this.parent[x_scale](d[this.layout.x_axis.field]);
            var y = this.parent[y_scale](d[this.layout.y_axis.field]);
            if (isNaN(x)){ x = -1000; }
            if (isNaN(y)){ y = -1000; }
            return "translate(" + x + "," + y + ")";
        }.bind(this);

        var fill = function(d){ return this.resolveScalableParameter(this.layout.color, d); }.bind(this);
        var fill_opacity = function(d){ return this.resolveScalableParameter(this.layout.fill_opacity, d); }.bind(this);

        var shape = d3.svg.symbol()
            .size(function(d){ return this.resolveScalableParameter(this.layout.point_size, d); }.bind(this))
            .type(function(d){ return this.resolveScalableParameter(this.layout.point_shape, d); }.bind(this));

        // Apply position and color, using a transition if necessary

        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("fill-opacity", fill_opacity)
                .attr("d", shape);
        } else {
            selection
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("fill-opacity", fill_opacity)
                .attr("d", shape);
        }

        // Remove old elements as needed
        selection.exit().remove();

        // Apply default event emitters to selection
        selection.on("click.event_emitter", function(element){
            this.parent.emit("element_clicked", element);
            this.parent_plot.emit("element_clicked", element);
        }.bind(this));
       
        // Apply mouse behaviors
        this.applyBehaviors(selection);
        
        // Apply method to keep labels from overlapping each other
        if (this.layout.label){
            this.flip_labels();
            this.seperate_iterations = 0;
            this.separate_labels();
            // Extend mouse behaviors to labels
            this.applyBehaviors(this.label_texts);
        }
        
    };

    // Method to set a passed element as the LD reference in the plot-level state
    this.makeLDReference = function(element){
        var ref = null;
        if (typeof element == "undefined"){
            throw("makeLDReference requires one argument of any type");
        } else if (typeof element == "object"){
            if (this.layout.id_field && typeof element[this.layout.id_field] != "undefined"){
                ref = element[this.layout.id_field].toString();
            } else if (typeof element["id"] != "undefined"){
                ref = element["id"].toString();
            } else {
                ref = element.toString();
            }
        } else {
            ref = element.toString();
        }
        this.parent_plot.applyState({ ldrefvar: ref });
    };
 
    return this;

});
