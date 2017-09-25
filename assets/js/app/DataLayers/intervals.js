/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/*********************
  Intervals Data Layer
  Implements a data layer that will render interval annotation tracks
*/

LocusZoom.DataLayers.add("intervals", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        start_field: "start",
        end_field: "end",
        track_split_field: "state_id",
        track_split_order: "DESC",
        track_split_legend_to_y_axis: 2,
        split_tracks: true,
        track_height: 15,
        track_vertical_spacing: 3,
        bounding_box_padding: 2,
        hover_element: "bounding_box",
        group_hover_elements_on_field: null,
        always_hide_legend: false,
        color: "#B8B8B8",
        fill_opacity: 1
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);
    
    // Helper function to sum layout values to derive total height for a single interval track
    this.getTrackHeight = function(){
        return this.layout.track_height
            + this.layout.track_vertical_spacing
            + (2 * this.layout.bounding_box_padding);
    };

    this.tracks = 1;
    this.previous_tracks = 1;
    this.group_hover_elements = {};
    
    // track-number-indexed object with arrays of interval indexes in the dataset
    this.interval_track_index = { 1: [] };

    // After we've loaded interval data interpret it to assign
    // each to a track so that they do not overlap in the view
    this.assignTracks = function(){

        // Reinitialize some metadata
        this.previous_tracks = this.tracks;
        this.tracks = 0;
        this.interval_track_index = { 1: [] };
        this.track_split_field_index = {};
        
        // If splitting tracks by a field's value then do a first pass determine
        // a value/track mapping that preserves the order of possible values
        if (this.layout.track_split_field && this.layout.split_tracks){
            this.data.map(function(d){
                this.track_split_field_index[d[this.layout.track_split_field]] = null;
            }.bind(this));
            var index = Object.keys(this.track_split_field_index);
            if (this.layout.track_split_order === "DESC"){ index.reverse(); }
            index.forEach(function(val){
                this.track_split_field_index[val] = this.tracks + 1;
                this.interval_track_index[this.tracks + 1] = [];
                this.tracks++;
            }.bind(this));
        }

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

            // If splitting to tracks based on the value of the designated track split field
            // then don't bother with collision detection (intervals will be grouped on tracks
            // solely by the value of track_split_field)
            if (this.layout.track_split_field && this.layout.split_tracks){
                var val = this.data[i][this.layout.track_split_field];
                this.data[i].track = this.track_split_field_index[val];
                this.interval_track_index[this.data[i].track].push(i);
            } else {
                // If not splitting to tracks based on a field value then do so based on collision
                // detection (as how it's done for genes). Use display range/domain data generated
                // above and cast each interval to tracks such that none overlap
                this.tracks = 1;
                this.data[i].track = null;
                var potential_track = 1;
                while (this.data[i].track === null){
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

        // First: render or remove group bounding boxes based on whether we're track split
        if (this.layout.split_tracks){
            Object.keys(this.group_hover_elements).forEach(function(key){
                if (!this.track_split_field_index[key]){ this.group_hover_elements[key].remove(); }
            }.bind(this));
            Object.keys(this.track_split_field_index).forEach(function(key){
                if (!this.group_hover_elements[key]){
                    this.group_hover_elements[key] = this.svg.group.insert("rect", ":first-child")
                        .attr("class", "lz-data_layer-intervals lz-data_layer-intervals-bounding_box");
                }
                this.group_hover_elements[key]
                    .attr("rx", this.layout.bounding_box_padding).attr("ry", this.layout.bounding_box_padding)
                    .attr("width", this.parent.layout.cliparea.width)
                    .attr("height", this.getTrackHeight() - this.layout.track_vertical_spacing)
                    .attr("x", 0)
                    .attr("y", (this.track_split_field_index[key]-1) * this.getTrackHeight());
            }.bind(this));
        } else {
            Object.keys(this.group_hover_elements).forEach(function(key){
                this.group_hover_elements[key].remove();
            }.bind(this));
            this.group_hover_elements = {};
        }

        var width, height, x, y, fill, fill_opacity;
            
        // Render interval groups
        var selection = this.svg.group.selectAll("g.lz-data_layer-intervals")
            .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));

        selection.enter().append("g")
            .attr("class", "lz-data_layer-intervals");
        
        selection.attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .each(function(interval){

                var data_layer = interval.parent;

                // Render interval bounding box (displayed behind intervals to show highlight
                // without needing to modify interval display element(s)) if not in split view
                var bboxes = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-data_layer-intervals-bounding_box")
                    .data([interval], function(d){ return d[data_layer.layout.id_field] + "_bbox"; });
                if (data_layer.layout.split_tracks){
                    bboxes.remove();
                } else {                    
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
                }

                // Render primary interval rects
                var rects = d3.select(this).selectAll("rect.lz-data_layer-intervals.lz-interval_rect")
                    .data([interval], function(d){ return d[data_layer.layout.id_field] + "_interval_rect"; });

                rects.enter().append("rect")
                    .attr("class", "lz-data_layer-intervals lz-interval_rect");

                height = data_layer.layout.track_height;
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
                fill_opacity = function(d){
                    return data_layer.resolveScalableParameter(data_layer.layout.fill_opacity, d);
                };
                
                
                if (data_layer.canTransition()){
                    rects
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height)
                        .attr("x", x).attr("y", y)
                        .attr("fill", fill)
                        .attr("fill-opacity", fill_opacity);
                } else {
                    rects
                        .attr("width", width).attr("height", height)
                        .attr("x", x).attr("y", y)
                        .attr("fill", fill)
                        .attr("fill-opacity", fill_opacity);
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
                    element.parent.parent.emit("element_clicked", element);
                    element.parent.parent_plot.emit("element_clicked", element);
                }.bind(this));

                // Apply mouse behaviors to clickareas
                data_layer.applyBehaviors(clickareas);

            });

        // Remove old elements as needed
        selection.exit().remove();

        // Update the legend axis if the number of ticks changed
        if (this.previous_tracks !== this.tracks){
            this.updateSplitTrackAxis();
        }

        return this;

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
        var interval_bbox;
        if (this.layout.split_tracks){
            interval_bbox = d3.select("#" + this.getElementId(tooltip.data)).node().getBBox();
        } else {
            interval_bbox = d3.select("#" + this.getElementId(tooltip.data) + "_bounding_box").node().getBBox();
        }
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

    // Redraw split track axis or hide it, and show/hide the legend, as determined
    // by current layout parameters and data
    this.updateSplitTrackAxis = function(){
        var legend_axis = this.layout.track_split_legend_to_y_axis ? "y" + this.layout.track_split_legend_to_y_axis : false;
        if (this.layout.split_tracks){
            var tracks = +this.tracks || 0;
            var track_height = +this.layout.track_height || 0;
            var track_spacing =  2 * (+this.layout.bounding_box_padding || 0) + (+this.layout.track_vertical_spacing || 0);
            var target_height = (tracks * track_height) + ((tracks - 1) * track_spacing);
            this.parent.scaleHeightToData(target_height);
            if (legend_axis && this.parent.legend){
                this.parent.legend.hide();                            
                this.parent.layout.axes[legend_axis] = {
                    render: true,
                    ticks: [],
                    range: {
                        start: (target_height - (this.layout.track_height/2)),
                        end: (this.layout.track_height/2)
                    }
                };
                this.layout.legend.forEach(function(element){
                    var key = element[this.layout.track_split_field];
                    var track = this.track_split_field_index[key];
                    if (track){
                        if (this.layout.track_split_order === "DESC"){
                            track = Math.abs(track - tracks - 1);
                        }
                        this.parent.layout.axes[legend_axis].ticks.push({
                            y: track,
                            text: element.label
                        });
                    }
                }.bind(this));
                this.layout.y_axis = {
                    axis: this.layout.track_split_legend_to_y_axis,
                    floor: 1,
                    ceiling: tracks
                };
                this.parent.render();
            }
            this.parent_plot.positionPanels();
        } else {
            if (legend_axis && this.parent.legend){
                if (!this.layout.always_hide_legend){ this.parent.legend.show(); }
                this.parent.layout.axes[legend_axis] = { render: false };
                this.parent.render();
            }
        }
        return this;
    };

    // Method to not only toggle the split tracks boolean but also update
    // necessary display values to animate a complete merge/split
    this.toggleSplitTracks = function(){
        this.layout.split_tracks = !this.layout.split_tracks;
        this.layout.group_hover_elements_on_field = this.layout.split_tracks ? this.layout.track_split_field : null;
        if (this.parent.legend && !this.layout.always_hide_legend){
            this.parent.layout.margin.bottom = 5 + (this.layout.split_tracks ? 0 : this.parent.legend.layout.height + 5);
        }
        this.render();
        this.updateSplitTrackAxis();
        return this;
    };
       
    return this;

});
