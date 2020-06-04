/*
    Interval annotation track (for chromatin state, etc). Useful for BED file data with non-overlapping intervals.
    This is not part of the core LocusZoom library, but can be included as a standalone file.

    The page must incorporate and load all libraries before this file can be used, including:
     - Vendor assets
     - LocusZoom
*/
'use strict';

// This is defined as a UMD module, to work with multiple different module systems / bundlers
// Arcane build note: everything defined here gets registered globally. This is not a "pure" module, and some build
//  systems may require being told that this file has side effects.
/* global define, module, require */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['locuszoom', 'd3'] , function(LocusZoom, d3) {  // amd
            return factory(LocusZoom, d3);
        });
    } else if(typeof module === 'object' && module.exports) {  // commonJS
        module.exports = factory(require('locuszoom'), require('d3'));
    } else {  // globals
        if (!root.LocusZoom.ext.Data) {
            root.LocusZoom.ext.Data = {};
        }
        var exported = factory(root.LocusZoom, root.d3);
        root.LocusZoom.ext.Data.IntervalLZ = exported.IntervalLZ;
    }
}(this, function(LocusZoom, d3) {
    /**
     * Data Source for Interval Annotation Data (e.g. BED Tracks), as fetched from the LocusZoom API server (or compatible)
     * @public
     * @class
     * @augments LocusZoom.Data.Source
     */
    var IntervalSource = LocusZoom.Data.Source.extend(function(init) {
        this.parseInit(init);
    }, 'IntervalLZ');

    IntervalSource.prototype.getURL = function(state, chain, fields) {
        var source = chain.header.bedtracksource || this.params.source;
        return this.url + '?filter=id in ' + source +
            " and chromosome eq '" + state.chr + "'" +
            ' and start le ' + state.end +
            ' and end ge ' + state.start;
    };

    /**
     * Button to toggle split tracks
     * @class LocusZoom.Dashboard.Components.toggle_split_tracks
     * @augments LocusZoom.Dashboard.Component
     */
    LocusZoom.Dashboard.Components.add('toggle_split_tracks', function(layout) {
        LocusZoom.Dashboard.Component.apply(this, arguments);
        if (!layout.data_layer_id) { layout.data_layer_id = 'intervals'; }
        if (!this.parent_panel.data_layers[layout.data_layer_id]) {
            throw new Error('Dashboard toggle split tracks component missing valid data layer ID');
        }
        this.update = function() {
            var data_layer = this.parent_panel.data_layers[layout.data_layer_id];
            var html = data_layer.layout.split_tracks ? 'Merge Tracks' : 'Split Tracks';
            if (this.button) {
                this.button.setHtml(html);
                this.button.show();
                this.parent.position();
                return this;
            } else {
                this.button = new LocusZoom.Dashboard.Component.Button(this)
                    .setColor(layout.color)
                    .setHtml(html)
                    .setTitle('Toggle whether tracks are split apart or merged together')
                    .setOnclick(function() {
                        data_layer.toggleSplitTracks();
                        if (this.scale_timeout) { clearTimeout(this.scale_timeout); }
                        this.scale_timeout = setTimeout(function() {
                            this.parent_panel.scaleHeightToData();
                            this.parent_plot.positionPanels();
                        }.bind(this), 0);
                        this.update();
                    }.bind(this));
                return this.update();
            }
        };
    });

    /**
     * Convert a value ""rr,gg,bb" (if given) to a css-friendly color string: "rgb(rr,gg,bb)".
     * This is tailored specifically to the color specification format embraced by the BED file standard.
     * @function to_rgb
     * @param {Object} parameters This function has no defined configuration options
     * @param {String|null} value The value to convert to rgb
     */
    LocusZoom.ScaleFunctions.add('to_rgb', function(parameters, value) {
        if (value) {
            return 'rgb(' + value + ')';
        }
        return null;
    });

    /**
     * Intervals Data Layer
     * Implements a data layer that will render interval annotation tracks (intervals must provide start and end values)
     * @class LocusZoom.DataLayers.intervals
     * @augments LocusZoom.DataLayer
     */
    LocusZoom.DataLayers.add('intervals', function(layout) {
        // Define a default layout for this DataLayer type and merge it with the passed argument
        this.DefaultLayout = {
            start_field: 'start',
            end_field: 'end',
            track_label_field: 'state_name', // Used to label items on the y-axis
            // Used to uniquely identify tracks for coloring. This tends to lead to more stable coloring/sorting
            //  than using the label field- eg, state_ids allow us to set global colors across the entire dataset,
            //  not just choose unique colors within a particular narrow region. (where changing region might lead to more
            //  categories and different colors)
            track_split_field: 'state_id',
            track_split_order: 'DESC',
            track_split_legend_to_y_axis: 2,
            split_tracks: true,
            track_height: 15,
            track_vertical_spacing: 3,
            bounding_box_padding: 2,
            always_hide_legend: false,
            color: '#B8B8B8',
            fill_opacity: 1,
            tooltip_positioning: 'vertical',
        };
        layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

        // Apply the arguments to set LocusZoom.DataLayer as the prototype
        LocusZoom.DataLayer.apply(this, arguments);

        /**
         * To define shared highlighting on the track split field define the status node id override
         * to generate an ID common to the track when we're actively splitting data out to separate tracks
         * @override
         * @returns {String}
         */
        this.getElementStatusNodeId = function(element) {
            if (this.layout.split_tracks) {
                return (this.getBaseId() + '-statusnode-' + element[this.layout.track_split_field]).replace(/[^\w]/g, '_');
            }
            return this.getElementId(element) + '-statusnode';
        }.bind(this);

        // Helper function to sum layout values to derive total height for a single interval track
        this.getTrackHeight = function() {
            return this.layout.track_height
                + this.layout.track_vertical_spacing
                + (2 * this.layout.bounding_box_padding);
        };

        this.tracks = 1;
        this.previous_tracks = 1;

        // track-number-indexed object with arrays of interval indexes in the dataset
        this.interval_track_index = { 1: [] };

        // Modify the layout as necessary to ensure that appropriate color, label, and legend options are available
        // Even when not displayed, the legend is used to generate the y-axis ticks
        this._applyLayoutOptions = function () {
            var self = this;
            var base_layout = this._base_layout;
            var render_layout = this.layout;
            var base_color_scale = base_layout.color.find(function (item) {
                return item.scale_function && item.scale_function === 'categorical_bin';
            });
            var color_scale = render_layout.color.find(function (item) {
                return item.scale_function && item.scale_function === 'categorical_bin';
            });
            if (!base_color_scale) {
                // This can be a placeholder (empty categories & values), but it needs to be there
                throw new Error('Interval tracks must define a `categorical_bin` color scale');
            }

            var has_colors = base_color_scale.parameters.categories.length && base_color_scale.parameters.values.length;
            var has_legend = base_layout.legend && base_layout.legend.length;

            if (!!has_colors ^ !!has_legend) {
                // Don't allow color OR legend to be set manually. It must be both, or neither.
                throw new Error('To use a manually specified color scheme, both color and legend options must be set.');
            }

            // Harvest any information about an explicit color field that should be considered when generating colors
            var rgb_option = base_layout.color.find(function (item) {
                return item.scale_function && item.scale_function === 'to_rgb';
            });
            var rgb_field = rgb_option && rgb_option.field;

            // Auto-generate legend based on data
            var known_categories = this._generateCategoriesFromData(this.data, rgb_field); // [id, label, itemRgb] items

            if (!has_colors && !has_legend) {
                // If no color scheme pre-defined, then make a color scheme that is appropriate and apply to the plot
                // The legend must match the color scheme. If we generate one, then we must generate both.

                var colors = this._makeColorScheme(known_categories);
                color_scale.parameters.categories = known_categories.map(function (item) { return item[0]; });
                color_scale.parameters.values = colors;

                this.layout.legend = known_categories.map(function (pair, index) {
                    var id = pair[0];
                    var label = pair[1];
                    var item_color = color_scale.parameters.values[index];
                    var item = { shape: 'rect', width: 9, label: label, color:  item_color };
                    item[self.layout.track_split_field] = id;
                    return item;
                });
            }
        }.bind(this);

        // After we've loaded interval data interpret it to assign
        // each to a track so that they do not overlap in the view
        this.assignTracks = function() {
            // Autogenerate layout options if not provided
            this._applyLayoutOptions();

            // Reinitialize some metadata
            this.previous_tracks = this.tracks;
            this.tracks = 0;
            this.interval_track_index = { 1: [] };
            // This maps unique values of track_split_field to unique y indices. It controls the ordering of separate tracks.
            this.track_split_field_index = {};

            // If splitting tracks by a field's value then determine how to order them. There are two options here:
            // a) numeric IDs get sorted in numeric order (JS quirk: int object keys act like array indices), or
            // b) text labels get sorted based on order in the source data (hash preserves insertion order)
            if (this.layout.track_split_field && this.layout.split_tracks) {
                this.data.forEach(function(d) {
                    this.track_split_field_index[d[this.layout.track_split_field]] = null;
                }.bind(this));
                var index = Object.keys(this.track_split_field_index);
                if (this.layout.track_split_order === 'DESC') { index.reverse(); }
                index.forEach(function(val) {
                    this.track_split_field_index[val] = this.tracks + 1;
                    this.interval_track_index[this.tracks + 1] = [];
                    this.tracks++;
                }.bind(this));
            }

            this.data.forEach(function(d, i) {

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
                if (this.layout.track_split_field && this.layout.split_tracks) {
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
                    while (this.data[i].track === null) {
                        var collision_on_potential_track = false;
                        this.interval_track_index[potential_track].map(function(placed_interval) {
                            if (!collision_on_potential_track) {
                                var min_start = Math.min(placed_interval.display_range.start, this.display_range.start);
                                var max_end = Math.max(placed_interval.display_range.end, this.display_range.end);
                                if ((max_end - min_start) < (placed_interval.display_range.width + this.display_range.width)) {
                                    collision_on_potential_track = true;
                                }
                            }
                        }.bind(this.data[i]));
                        if (!collision_on_potential_track) {
                            this.data[i].track = potential_track;
                            this.interval_track_index[potential_track].push(this.data[i]);
                        } else {
                            potential_track++;
                            if (potential_track > this.tracks) {
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
        this.render = function() {
            this.assignTracks();

            // Remove any shared highlight nodes and re-render them if we're splitting on tracks
            // At most there will only be dozen or so nodes here (one per track) and each time
            // we render data we may have new tracks, so wiping/redrawing all is reasonable.
            this.svg.group.selectAll('.lz-data_layer-intervals-statusnode.lz-data_layer-intervals-shared').remove();
            Object.keys(this.track_split_field_index).forEach(function(key) {
                // Make a psuedo-element so that we can generate an id for the shared node
                var pseudoElement = {};
                pseudoElement[this.layout.track_split_field] = key;
                // Insert the shared node
                var sharedstatusnode_style = {display: (this.layout.split_tracks ? null : 'none')};
                this.svg.group.insert('rect', ':first-child')
                    .attr('id', this.getElementStatusNodeId(pseudoElement))
                    .attr('class', 'lz-data_layer-intervals lz-data_layer-intervals-statusnode lz-data_layer-intervals-shared')
                    .attr('rx', this.layout.bounding_box_padding).attr('ry', this.layout.bounding_box_padding)
                    .attr('width', this.parent.layout.cliparea.width)
                    .attr('height', this.getTrackHeight() - this.layout.track_vertical_spacing)
                    .attr('x', 0)
                    .attr('y', (this.track_split_field_index[key] - 1) * this.getTrackHeight())
                    .style(sharedstatusnode_style);
            }.bind(this));

            var width, height, x, y, fill, fill_opacity;

            // Render interval groups
            var selection = this.svg.group.selectAll('g.lz-data_layer-intervals')
                .data(this.data, function(d) { return d[this.layout.id_field]; }.bind(this));

            selection.enter().append('g')
                .attr('class', 'lz-data_layer-intervals');

            selection.attr('id', function(d) { return this.getElementId(d); }.bind(this))
                .each(function(interval) {

                    var data_layer = interval.parent;

                    // Render interval status nodes (displayed behind intervals to show highlight
                    // without needing to modify interval display element(s))
                    var statusnode_style = {display: (data_layer.layout.split_tracks ? 'none' : null)};
                    var statusnodes = d3.select(this).selectAll('rect.lz-data_layer-intervals.lz-data_layer-intervals-statusnode.lz-data_layer-intervals-statusnode-discrete')
                        .data([interval], function(d) { return data_layer.getElementId(d) + '-statusnode'; });
                    statusnodes.enter().insert('rect', ':first-child')
                        .attr('class', 'lz-data_layer-intervals lz-data_layer-intervals-statusnode lz-data_layer-intervals-statusnode-discrete');
                    statusnodes
                        .attr('id', function(d) {
                            return data_layer.getElementId(d) + '-statusnode';
                        })
                        .attr('rx', function() {
                            return data_layer.layout.bounding_box_padding;
                        })
                        .attr('ry', function() {
                            return data_layer.layout.bounding_box_padding;
                        })
                        .style(statusnode_style);
                    width = function(d) {
                        return d.display_range.width + (2 * data_layer.layout.bounding_box_padding);
                    };
                    height = function() {
                        return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                    };
                    x = function(d) {
                        return d.display_range.start - data_layer.layout.bounding_box_padding;
                    };
                    y = function(d) {
                        return ((d.track - 1) * data_layer.getTrackHeight());
                    };

                    statusnodes
                        .attr('width', width).attr('height', height).attr('x', x).attr('y', y);

                    statusnodes.exit().remove();

                    // Render primary interval rects
                    var rects = d3.select(this).selectAll('rect.lz-data_layer-intervals.lz-interval_rect')
                        .data([interval], function(d) { return d[data_layer.layout.id_field] + '_interval_rect'; });

                    rects.enter().append('rect')
                        .attr('class', 'lz-data_layer-intervals lz-interval_rect');

                    height = data_layer.layout.track_height;
                    width = function(d) {
                        return d.display_range.width;
                    };
                    x = function(d) {
                        return d.display_range.start;
                    };
                    y = function(d) {
                        return ((d.track - 1) * data_layer.getTrackHeight())
                            + data_layer.layout.bounding_box_padding;
                    };
                    fill = function(d, i) {
                        return data_layer.resolveScalableParameter(data_layer.layout.color, d, i);
                    };
                    fill_opacity = function(d, i) {
                        return data_layer.resolveScalableParameter(data_layer.layout.fill_opacity, d, i);
                    };

                    rects
                        .attr('width', width).attr('height', height)
                        .attr('x', x).attr('y', y)
                        .attr('fill', fill)
                        .attr('fill-opacity', fill_opacity);

                    rects.exit().remove();

                    // Render interval click areas
                    var clickareas = d3.select(this).selectAll('rect.lz-data_layer-intervals.lz-clickarea')
                        .data([interval], function(d) { return d.interval_name + '_clickarea'; });

                    clickareas.enter().append('rect')
                        .attr('class', 'lz-data_layer-intervals lz-clickarea');

                    clickareas
                        .attr('id', function(d) {
                            return data_layer.getElementId(d) + '_clickarea';
                        })
                        .attr('rx', function() {
                            return data_layer.layout.bounding_box_padding;
                        })
                        .attr('ry', function() {
                            return data_layer.layout.bounding_box_padding;
                        });

                    width = function(d) {
                        return d.display_range.width;
                    };
                    height = function() {
                        return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                    };
                    x = function(d) {
                        return d.display_range.start;
                    };
                    y = function(d) {
                        return ((d.track - 1) * data_layer.getTrackHeight());
                    };

                    clickareas
                        .attr('width', width).attr('height', height).attr('x', x).attr('y', y);

                    // Remove old clickareas as needed
                    clickareas.exit().remove();

                    // Apply default event emitters to clickareas
                    clickareas.on('click', function(element_data) {
                        element_data.parent.parent.emit('element_clicked', element_data, true);
                    }.bind(this));

                    // Apply mouse behaviors to clickareas
                    data_layer.applyBehaviors(clickareas);

                });

            // Remove old elements as needed
            selection.exit().remove();

            // Update the legend axis if the number of ticks changed
            if (this.previous_tracks !== this.tracks) {
                this.updateSplitTrackAxis();
            }

            // The intervals track allows legends to be dynamically generated, in which case space can only be
            //  allocated after the panel has been rendered.
            if (this.parent && this.parent.legend) {
                this.parent.legend.render();
            }

            return this;
        };

        this._getTooltipPosition = function (tooltip) {
            var interval_bbox = d3.select('#' + this.getElementStatusNodeId(tooltip.data)).node().getBBox();
            return {
                x_min: tooltip.data.display_range.start,
                x_max: tooltip.data.display_range.end,
                y_min: interval_bbox.y,
                y_max: interval_bbox.y + interval_bbox.height
            };
        };

        // Redraw split track axis or hide it, and show/hide the legend, as determined
        // by current layout parameters and data
        this.updateSplitTrackAxis = function() {
            var legend_axis = this.layout.track_split_legend_to_y_axis ? 'y' + this.layout.track_split_legend_to_y_axis : false;
            if (this.layout.split_tracks) {
                var tracks = +this.tracks || 0;
                var track_height = +this.layout.track_height || 0;
                var track_spacing =  2 * (+this.layout.bounding_box_padding || 0) + (+this.layout.track_vertical_spacing || 0);
                var target_height = (tracks * track_height) + ((tracks - 1) * track_spacing);
                this.parent.scaleHeightToData(target_height);
                if (legend_axis && this.parent.legend) {
                    this.parent.legend.hide();
                    this.parent.layout.axes[legend_axis] = {
                        render: true,
                        ticks: [],
                        range: {
                            start: (target_height - (this.layout.track_height / 2)),
                            end: (this.layout.track_height / 2)
                        }
                    };
                    // There is a very tight coupling between the display directives: each legend item must identify a key
                    //  field for unique tracks. (Typically this is `state_id`, the same key field used to assign unique colors)
                    // The list of unique keys corresponds to the order along the y-axis
                    this.layout.legend.forEach(function(element) {
                        var key = element[this.layout.track_split_field];
                        var track = this.track_split_field_index[key];
                        if (track) {
                            if (this.layout.track_split_order === 'DESC') {
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
                if (legend_axis && this.parent.legend) {
                    if (!this.layout.always_hide_legend) { this.parent.legend.show(); }
                    this.parent.layout.axes[legend_axis] = { render: false };
                    this.parent.render();
                }
            }
            return this;
        };

        // Method to not only toggle the split tracks boolean but also update
        // necessary display values to animate a complete merge/split
        this.toggleSplitTracks = function() {
            this.layout.split_tracks = !this.layout.split_tracks;
            if (this.parent.legend && !this.layout.always_hide_legend) {
                this.parent.layout.margin.bottom = 5 + (this.layout.split_tracks ? 0 : this.parent.legend.layout.height + 5);
            }
            this.render();
            this.updateSplitTrackAxis();
            return this;
        };

        // Choose an appropriate color scheme based on the number of items in the track, and whether or not we are
        //  using explicitly provided itemRgb information
        this._makeColorScheme = function(category_info) {
            // If at least one element has an explicit itemRgb, assume the entire dataset has colors
            var has_explicit_colors = category_info.find(function (item) { return item[2]; });
            if (has_explicit_colors) {
                return category_info.map(function (item) { return item[2]; });
            }

            // Use a set of color schemes for common 15, 18, or 25 state models, as specified from:
            //  https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html
            // These are actually reversed so that dim colors come first, on the premise that usually these are the
            //  most common states
            var n_categories = category_info.length;
            if (n_categories <= 15) {
                return ['rgb(212,212,212)', 'rgb(192,192,192)', 'rgb(128,128,128)', 'rgb(189,183,107)', 'rgb(233,150,122)', 'rgb(205,92,92)', 'rgb(138,145,208)', 'rgb(102,205,170)', 'rgb(255,255,0)', 'rgb(194,225,5)', 'rgb(0,100,0)', 'rgb(0,128,0)', 'rgb(50,205,50)', 'rgb(255,69,0)', 'rgb(255,0,0)'];
            } else if (n_categories <= 18) {
                return ['rgb(212,212,212)', 'rgb(192,192,192)', 'rgb(128,128,128)', 'rgb(189,183,107)', 'rgb(205,92,92)', 'rgb(138,145,208)', 'rgb(102,205,170)', 'rgb(255,255,0)', 'rgb(255,195,77)', 'rgb(255,195,77)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(0,100,0)', 'rgb(0,128,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,0,0)'];
            } else {
                // If there are more than 25 categories, the interval layer will fall back to the 'null value' option
                return ['rgb(212,212,212)', 'rgb(128,128,128)', 'rgb(112,48,160)', 'rgb(230,184,183)', 'rgb(138,145,208)', 'rgb(102,205,170)', 'rgb(255,255,102)', 'rgb(255,255,0)', 'rgb(255,255,0)', 'rgb(255,255,0)', 'rgb(255,195,77)', 'rgb(255,195,77)', 'rgb(255,195,77)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(0,150,0)', 'rgb(0,128,0)', 'rgb(0,128,0)', 'rgb(0,128,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,0,0)'];
            }
        };

        /**
         * Find all of the unique tracks (a combination of name and ID information)
         * @param data
         * @private
         * @returns {Array} All [unique_id, label, color] pairs in data. The unique_id is the thing used to define groupings
         *  most unambiguously.
         */
        this._generateCategoriesFromData = function (data, rgb_field) {
            var self = this;
            // Use the hard-coded legend if available (ignoring any mods on re-render)
            var legend = this._base_layout.legend;
            if (legend && legend.length) {
                return legend.map(function (item) {
                    return [item[self.layout.track_split_field], item.label, item.color];
                });
            }

            // Generate options from data, if no preset legend exists
            var unique_ids = {}; // make categories unique
            var categories = [];

            data.forEach(function (item, idx) {
                var id = item[self.layout.track_split_field];
                if (!unique_ids.hasOwnProperty(id)) {
                    unique_ids[id] = null;
                    // If rgbfield is null, then the last entry is undefined/null as well
                    categories.push([id, item[self.layout.track_label_field], item[rgb_field]]);
                }
            });
            return categories;
        }.bind(this);

        return this;

    });

    LocusZoom.Layouts.add('tooltip', 'standard_intervals', {
        namespace: { 'intervals': 'intervals' },
        closable: false,
        show: { or: ['highlighted', 'selected'] },
        hide: { and: ['unhighlighted', 'unselected'] },
        html: '{{{{namespace[intervals]}}state_name|htmlescape}}<br>{{{{namespace[intervals]}}start|htmlescape}}-{{{{namespace[intervals]}}end|htmlescape}}'
    });

    LocusZoom.Layouts.add('data_layer', 'intervals', {
        namespace: { 'intervals': 'intervals' },
        id: 'intervals',
        type: 'intervals',
        fields: ['{{namespace[intervals]}}start', '{{namespace[intervals]}}end', '{{namespace[intervals]}}state_id', '{{namespace[intervals]}}state_name', '{{namespace[intervals]}}itemRgb'],
        id_field: '{{namespace[intervals]}}start',
        start_field: '{{namespace[intervals]}}start',
        end_field: '{{namespace[intervals]}}end',
        track_split_field: '{{namespace[intervals]}}state_name',
        track_label_field: '{{namespace[intervals]}}state_name',
        split_tracks: false,
        always_hide_legend: true,
        color: [
            {
                // If present, an explicit color field will override any other option (and be used to auto-generate legend)
                field: '{{namespace[intervals]}}itemRgb',
                scale_function: 'to_rgb'
            },
            {
                field: '{{namespace[intervals]}}state_name',
                scale_function: 'categorical_bin',
                parameters: {
                    // Placeholder. Empty categories and values will automatically be filled in when new data loads.
                    categories: [],
                    values: [],
                    null_value: '#B8B8B8'
                }
            }
        ],
        legend: [], // Placeholder; auto-filled when data loads.
        behaviors: {
            onmouseover: [
                { action: 'set', status: 'highlighted' }
            ],
            onmouseout: [
                { action: 'unset', status: 'highlighted' }
            ],
            onclick: [
                { action: 'toggle', status: 'selected', exclusive: true }
            ],
            onshiftclick: [
                { action: 'toggle', status: 'selected' }
            ]
        },
        tooltip: LocusZoom.Layouts.get('tooltip', 'standard_intervals', { unnamespaced: true })
    });

    LocusZoom.Layouts.add('panel', 'intervals', {
        id: 'intervals',
        width: 1000,
        height: 50,
        min_width: 500,
        min_height: 50,
        margin: { top: 25, right: 150, bottom: 5, left: 50 },
        dashboard: (function () {
            var l = LocusZoom.Layouts.get('dashboard', 'standard_panel', { unnamespaced: true });
            l.components.push({
                type: 'toggle_split_tracks',
                data_layer_id: 'intervals',
                position: 'right'
            });
            return l;
        })(),
        axes: {},
        interaction: {
            drag_background_to_pan: true,
            scroll_to_zoom: true,
            x_linked: true
        },
        legend: {
            hidden: true,
            orientation: 'horizontal',
            origin: { x: 50, y: 0 },
            pad_from_bottom: 5
        },
        data_layers: [
            LocusZoom.Layouts.get('data_layer', 'intervals', { unnamespaced: true })
        ]
    });

    LocusZoom.Layouts.add('plot', 'interval_association', {
        state: {},
        width: 800,
        height: 550,
        responsive_resize: 'both',
        min_region_scale: 20000,
        max_region_scale: 1000000,
        dashboard: LocusZoom.Layouts.get('dashboard', 'standard_plot', { unnamespaced: true }),
        panels: [
            LocusZoom.Layouts.get('panel', 'association', {
                unnamespaced: true,
                width: 800,
                proportional_height: (225 / 570)
            }),
            LocusZoom.Layouts.get('panel', 'intervals', { unnamespaced: true, proportional_height: (120 / 570) }),
            LocusZoom.Layouts.get('panel', 'genes', { unnamespaced: true, width: 800, proportional_height: (225 / 570) })
        ]
    });

    // Public interface for this extension; since everything is registered w/LocusZoom, this is rarely used directly.
    return { IntervalLZ: IntervalSource };
}));
