/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Intervals Data Layer
  Implements a data layer that will render gene tracks
*/

LocusZoom.DataLayers.add("intervals", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        start_field: "start",
        end_field: "end",
        track_split_field: "state_id",
        split_tracks: false,
        interval_height: 15,
        track_vertical_spacing: 5,
        bounding_box_padding: 4,
        hover_element: "bounding_box"
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);
    
    // Helper function to sum layout values to derive total height for a single interval track
    this.getTrackHeight = function(){
        return this.layout.interval_height
            + this.layout.track_vertical_spacing
            + (2 * this.layout.bounding_box_padding);
    };

    this.tracks = 1;
    
    // track-number-indexed object with arrays of interval indexes in the dataset
    this.interval_track_index = { 1: [] };

    // After we've loaded interval data interpret it to assign
    // each to a track so that they do not overlap in the view
    this.assignTracks = function(){

        // Reinitialize some metadata
        this.tracks = 0;
        this.interval_track_index = { 1: [] };
        this.track_split_field_index = {};

        this.data.map(function(d, i){

            // Stash a parent reference on the interval
            this.data[i].parent = this;

            // Determine display range start and end, based on minimum allowable interval display width,
            // bounded by what we can see (range: values in terms of pixels on the screen)
            this.data[i].display_range = {
                start: this.parent.x_scale(Math.max(d[this.layout.start_field], this.state.start)),
                end:   this.parent.x_scale(Math.min(d[this.layout.end_field], this.state.end))
            };
            this.data[i].display_range.width = this.data[i].display_range.end - this.data[i].display_range.start;
            
            // Convert and stash display range values into domain values
            // (domain: values in terms of the data set, e.g. megabases)
            this.data[i].display_domain = {
                start: this.parent.x_scale.invert(this.data[i].display_range.start),
                end:   this.parent.x_scale.invert(this.data[i].display_range.end)
            };
            this.data[i].display_domain.width = this.data[i].display_domain.end - this.data[i].display_domain.start;

            // If splitting to tracks based on the value of the designated track spliy field
            // then don't bother with collision detection (intervals will be grouped on tracks
            // solely by the value of track_split_field)
            if (this.layout.track_split_field && this.layout.split_tracks){
                var val = this.data[i][this.layout.track_split_field];
                if (!this.track_split_field_index[val]){
                    this.tracks++;
                    this.track_split_field_index[val] = this.tracks;
                }
                this.data[i].track = this.track_split_field_index[val];
            } else {
                // If not splitting to tracks based on a field value then do so based on collision
                // detection (as how it's done for genes). Use display range/domain data generated
                // above and cast each interval to tracks such that none overlap
                this.tracks = 1;
                this.data[i].track = null;
                var potential_track = 1;
                while (this.data[i].track == null){
                    var collision_on_potential_track = false;
                    this.interval_track_index[potential_track].map(function(placed_interval){
                        if (!collision_on_potential_track){
                            var min_start = Math.min(placed_interval.display_range.start, this.display_range.start);
                            var max_end = Math.max(placed_interval.display_range.end, this.display_range.end);
                            if ((max_end - min_start) < (placed_interval.display_range.width + this.display_range.width)){
                                collision_on_potential_track = true;
                            }
                        }
                    }.bind(this.data[i]));
                    if (!collision_on_potential_track){
                        this.data[i].track = potential_track;
                        this.interval_track_index[potential_track].push(this.data[i]);
                    } else {
                        potential_track++;
                        if (potential_track > this.tracks){
                            this.tracks = potential_track;
                            this.interval_track_index[potential_track] = [];
                        }
                    }
                }

            }

        }.bind(this));
        return this;
    };

    // Implement the main render function
    this.render = function(){

        this.assignTracks();

        var width, height, x, y, fill;

        // Render interval groups
        var selection = this.svg.group.selectAll("g.lz-data_layer-intervals")
            .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));

        selection.enter().append("g")
            .attr("class", "lz-data_layer-intervals");
        
        selection.attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .each(function(interval){

                var data_layer = interval.parent;

                // Render interval bounding box (displayed behind intervals to show highlight
                // without needing to modify interval display element(s))
                var bboxes = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-data_layer-intervals-bounding_box")
                    .data([interval], function(d){ return d[data_layer.layout.id_field] + "_bbox"; });

                bboxes.enter().append("rect")
                    .attr("class", "lz-data_layer-intervals lz-data_layer-intervals-bounding_box");
                
                bboxes
                    .attr("id", function(d){
                        return data_layer.getElementId(d) + "_bounding_box";
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                width = function(d){
                    return d.display_range.width + (2 * data_layer.layout.bounding_box_padding);
                };
                height = function(){
                    return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                };
                x = function(d){
                    return d.display_range.start - data_layer.layout.bounding_box_padding;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight());
                };
                if (data_layer.canTransition()){
                    bboxes
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    bboxes
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                bboxes.exit().remove();

                // Render primary interval rects
                var rects = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-interval_rect")
                    .data([interval], function(d){ return d[data_layer.layout.id_field] + "_interval_rect"; });

                rects.enter().append("rect")
                    .attr("class", "lz-data_layer-intervals lz-interval_rect");

                height = data_layer.layout.interval_height;
                width = function(d){
                    return d.display_range.width;
                };
                x = function(d){
                    return d.display_range.start;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding;
                };
                fill = function(d){
                    return data_layer.resolveScalableParameter(data_layer.layout.color, d);
                };                
                
                if (data_layer.canTransition()){
                    rects
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height)
                        .attr("x", x).attr("y", y)
                        .attr("fill", fill);
                } else {
                    rects
                        .attr("width", width).attr("height", height)
                        .attr("x", x).attr("y", y)
                        .attr("fill", fill);
                }
                
                rects.exit().remove();

                // Render interval click areas
                var clickareas = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-clickarea")
                    .data([interval], function(d){ return d.interval_name + "_clickarea"; });

                clickareas.enter().append("rect")
                    .attr("class", "lz-data_layer-intervals lz-clickarea");

                clickareas
                    .attr("id", function(d){
                        return data_layer.getElementId(d) + "_clickarea";
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                width = function(d){
                    return d.display_range.width;
                };
                height = function(){
                    return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                };
                x = function(d){
                    return d.display_range.start;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight());
                };
                if (data_layer.canTransition()){
                    clickareas
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    clickareas
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                // Remove old clickareas as needed
                clickareas.exit().remove();

                // Apply default event emitters to clickareas
                clickareas.on("click", function(element){
                    this.parent.emit("element_clicked", element);
                    this.parent_plot.emit("element_clicked", element);
                }.bind(this));

                // Apply selectable, tooltip, etc to clickareas
                data_layer.applyAllStatusBehaviors(clickareas);

            });

        // Remove old elements as needed
        selection.exit().remove();

    };
    
    // Reimplement the positionTooltip() method to be interval-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var interval_bbox_id = this.getElementId(tooltip.data) + "_bounding_box";
        var interval_bbox = d3.select("#" + interval_bbox_id).node().getBBox();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        // Position horizontally: attempt to center on the portion of the interval that's visible,
        // pad to either side if bumping up against the edge of the data layer
        var interval_center_x = ((tooltip.data.display_range.start + tooltip.data.display_range.end) / 2) - (this.layout.bounding_box_padding / 2);
        var offset_right = Math.max((tooltip_box.width / 2) - interval_center_x, 0);
        var offset_left = Math.max((tooltip_box.width / 2) + interval_center_x - data_layer_width, 0);
        var left = page_origin.x + interval_center_x - (tooltip_box.width / 2) - offset_left + offset_right;
        var arrow_left = (tooltip_box.width / 2) - (arrow_width / 2) + offset_left - offset_right;
        // Position vertically below the interval unless there's insufficient space
        var top, arrow_type, arrow_top;
        if (tooltip_box.height + stroke_width + arrow_width > data_layer_height - (interval_bbox.y + interval_bbox.height)){
            top = page_origin.y + interval_bbox.y - (tooltip_box.height + stroke_width + arrow_width);
            arrow_type = "down";
            arrow_top = tooltip_box.height - stroke_width;
        } else {
            top = page_origin.y + interval_bbox.y + interval_bbox.height + stroke_width + arrow_width;
            arrow_type = "up";
            arrow_top = 0 - stroke_width - arrow_width;
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
       
    return this;

});
