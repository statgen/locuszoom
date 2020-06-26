/**
Interval annotation track (for chromatin state, etc). Useful for BED file data with non-overlapping intervals.
This is not part of the core LocusZoom library, but can be included as a standalone file.

The page must incorporate and load all libraries before this file can be used, including:
 - Vendor assets
 - LocusZoom
 @module
*/

import * as d3 from 'd3';


function install (LocusZoom) {
    const RemoteAdapter = LocusZoom.Adapters.get('RemoteAdapter');
    const _Button = LocusZoom.Widgets.get('_Button');
    const _BaseWidget = LocusZoom.Widgets.get('BaseWidget');

    /**
     * Data Source for Interval Annotation Data (e.g. BED Tracks), as fetched from the LocusZoom API server (or compatible)
     * @public
     */
    class IntervalLZ extends RemoteAdapter {
        getURL(state, chain, fields) {
            const source = chain.header.bedtracksource || this.params.source;
            const query = `?filter=id in ${source} and chromosome eq '${state.chr}' and start le ${state.end} and end ge ${state.start}`;
            return `${this.url}${query}`;
        }
    }

    /**
     * Button to toggle split tracks
     */
    class ToggleSplitTracks extends _BaseWidget {
        constructor(layout) {
            super(...arguments);
            if (!layout.data_layer_id) {
                layout.data_layer_id = 'intervals';
            }
            if (!this.parent_panel.data_layers[layout.data_layer_id]) {
                throw new Error('Toggle split tracks widget specifies an invalid data layer ID');
            }
        }

        update() {
            const data_layer = this.parent_panel.data_layers[this.layout.data_layer_id];
            const html = data_layer.layout.split_tracks ? 'Merge Tracks' : 'Split Tracks';
            if (this.button) {
                this.button.setHtml(html);
                this.button.show();
                this.parent.position();
                return this;
            } else {
                this.button = new _Button(this)
                    .setColor(this.layout.color)
                    .setHtml(html)
                    .setTitle('Toggle whether tracks are split apart or merged together')
                    .setOnclick(() => {
                        data_layer.toggleSplitTracks();
                        if (this.scale_timeout) {
                            clearTimeout(this.scale_timeout);
                        }
                        this.scale_timeout = setTimeout(() => {
                            this.parent_panel.scaleHeightToData();
                            this.parent_plot.positionPanels();
                        }, 0);
                        this.update();
                    });
                return this.update();
            }
        }
    }


    /**
     * Convert a value ""rr,gg,bb" (if given) to a css-friendly color string: "rgb(rr,gg,bb)".
     * This is tailored specifically to the color specification format embraced by the BED file standard.
     * @function to_rgb
     * @param {Object} parameters This function has no defined configuration options
     * @param {String|null} value The value to convert to rgb
     */
    function to_rgb(parameters, value) {
        return value ? `rgb(${value})` : null;
    }

    const default_layout = {
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


    /**
     * Intervals Data Layer
     * Implements a data layer that will render interval annotation tracks (intervals must provide start and end values)
     */
    const BaseLayer = LocusZoom.DataLayers.get('BaseDataLayer');
    class LzIntervalsTrack extends BaseLayer {
        constructor(layout) {
            LocusZoom.Layouts.merge(layout, default_layout);
            super(...arguments);
            this.tracks = 1;
            this.previous_tracks = 1;

            // track-number-indexed object with arrays of interval indexes in the dataset
            this.interval_track_index = { 1: [] };
        }

        /**
         * To define shared highlighting on the track split field define the status node id override
         * to generate an ID common to the track when we're actively splitting data out to separate tracks
         * @override
         * @returns {String}
         */
        getElementStatusNodeId(element) {
            if (this.layout.split_tracks) {
                return (`${this.getBaseId()}-statusnode-${element[this.layout.track_split_field]}`).replace(/[^\w]/g, '_');
            }
            return `${this.getElementId(element)}-statusnode`;
        }

        // Helper function to sum layout values to derive total height for a single interval track
        getTrackHeight() {
            return this.layout.track_height
                + this.layout.track_vertical_spacing
                + (2 * this.layout.bounding_box_padding);
        }

        // Modify the layout as necessary to ensure that appropriate color, label, and legend options are available
        // Even when not displayed, the legend is used to generate the y-axis ticks
        _applyLayoutOptions() {
            const self = this;
            const base_layout = this._base_layout;
            const render_layout = this.layout;
            const base_color_scale = base_layout.color.find(function (item) {
                return item.scale_function && item.scale_function === 'categorical_bin';
            });
            const color_scale = render_layout.color.find(function (item) {
                return item.scale_function && item.scale_function === 'categorical_bin';
            });
            if (!base_color_scale) {
                // This can be a placeholder (empty categories & values), but it needs to be there
                throw new Error('Interval tracks must define a `categorical_bin` color scale');
            }

            const has_colors = base_color_scale.parameters.categories.length && base_color_scale.parameters.values.length;
            const has_legend = base_layout.legend && base_layout.legend.length;

            if (!!has_colors ^ !!has_legend) {
                // Don't allow color OR legend to be set manually. It must be both, or neither.
                throw new Error('To use a manually specified color scheme, both color and legend options must be set.');
            }

            // Harvest any information about an explicit color field that should be considered when generating colors
            const rgb_option = base_layout.color.find(function (item) {
                return item.scale_function && item.scale_function === 'to_rgb';
            });
            const rgb_field = rgb_option && rgb_option.field;

            // Auto-generate legend based on data
            const known_categories = this._generateCategoriesFromData(this.data, rgb_field); // [id, label, itemRgb] items

            if (!has_colors && !has_legend) {
                // If no color scheme pre-defined, then make a color scheme that is appropriate and apply to the plot
                // The legend must match the color scheme. If we generate one, then we must generate both.

                const colors = this._makeColorScheme(known_categories);
                color_scale.parameters.categories = known_categories.map(function (item) {
                    return item[0];
                });
                color_scale.parameters.values = colors;

                this.layout.legend = known_categories.map(function (pair, index) {
                    const id = pair[0];
                    const label = pair[1];
                    const item_color = color_scale.parameters.values[index];
                    const item = { shape: 'rect', width: 9, label: label, color: item_color };
                    item[self.layout.track_split_field] = id;
                    return item;
                });
            }
        }


        // After we've loaded interval data interpret it to assign
        // each to a track so that they do not overlap in the view
        assignTracks() {
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
                this.data.forEach((d) => {
                    this.track_split_field_index[d[this.layout.track_split_field]] = null;
                });
                const index = Object.keys(this.track_split_field_index);
                if (this.layout.track_split_order === 'DESC') {
                    index.reverse();
                }
                index.forEach((val) => {
                    this.track_split_field_index[val] = this.tracks + 1;
                    this.interval_track_index[this.tracks + 1] = [];
                    this.tracks++;
                });
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
                    const val = this.data[i][this.layout.track_split_field];
                    this.data[i].track = this.track_split_field_index[val];
                    this.interval_track_index[this.data[i].track].push(i);
                } else {
                    // If not splitting to tracks based on a field value then do so based on collision
                    // detection (as how it's done for genes). Use display range/domain data generated
                    // above and cast each interval to tracks such that none overlap
                    this.tracks = 1;
                    this.data[i].track = null;
                    let potential_track = 1;
                    while (this.data[i].track === null) {
                        let collision_on_potential_track = false;
                        this.interval_track_index[potential_track].map(function(placed_interval) {
                            if (!collision_on_potential_track) {
                                const min_start = Math.min(placed_interval.display_range.start, this.display_range.start);
                                const max_end = Math.max(placed_interval.display_range.end, this.display_range.end);
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
        }

        // Implement the main render function
        render() {
            this.assignTracks();

            // Remove any shared highlight nodes and re-render them if we're splitting on tracks
            // At most there will only be dozen or so nodes here (one per track) and each time
            // we render data we may have new tracks, so wiping/redrawing all is reasonable.
            this.svg.group.selectAll('.lz-data_layer-intervals-statusnode.lz-data_layer-intervals-shared').remove();
            Object.keys(this.track_split_field_index).forEach((key) => {
                // Make a psuedo-element so that we can generate an id for the shared node
                const pseudoElement = {};
                pseudoElement[this.layout.track_split_field] = key;
                // Insert the shared node
                this.svg.group.insert('rect', ':first-child')
                    .attr('id', this.getElementStatusNodeId(pseudoElement))
                    .attr('class', 'lz-data_layer-intervals lz-data_layer-intervals-statusnode lz-data_layer-intervals-shared')
                    .attr('rx', this.layout.bounding_box_padding)
                    .attr('ry', this.layout.bounding_box_padding)
                    .attr('width', this.parent.layout.cliparea.width)
                    .attr('height', this.getTrackHeight() - this.layout.track_vertical_spacing)
                    .attr('x', 0)
                    .attr('y', (this.track_split_field_index[key] - 1) * this.getTrackHeight())
                    .style('display', (this.layout.split_tracks ? null : 'none'));
            });

            // Render interval groups
            const selection = this.svg.group.selectAll('g.lz-data_layer-intervals')
                .data(this.data, (d) => {
                    return d[this.layout.id_field];
                });

            selection.enter()
                .append('g')
                .attr('class', 'lz-data_layer-intervals')
                .merge(selection)
                .attr('id', (d) => this.getElementId(d))
                .each(function(interval) {
                    const data_layer = interval.parent;
                    // Render interval status nodes (displayed behind intervals to show highlight
                    // without needing to modify interval display element(s))
                    const statusnodes = d3.select(this).selectAll('rect.lz-data_layer-intervals.lz-data_layer-intervals-statusnode.lz-data_layer-intervals-statusnode-discrete')
                        .data([interval], (d) => `${data_layer.getElementId(d)}-statusnode`);
                    statusnodes.enter()
                        .insert('rect', ':first-child')
                        .attr('class', 'lz-data_layer-intervals lz-data_layer-intervals-statusnode lz-data_layer-intervals-statusnode-discrete')
                        .merge(statusnodes)
                        .attr('id', (d) => `${data_layer.getElementId(d)}-statusnode`)
                        .attr('rx', data_layer.layout.bounding_box_padding)
                        .attr('ry', data_layer.layout.bounding_box_padding)
                        .style('display', data_layer.layout.split_tracks ? 'none' : null)
                        .attr('width', (d) => d.display_range.width + (2 * data_layer.layout.bounding_box_padding))
                        .attr('height', data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing)
                        .attr('x', (d) => d.display_range.start - data_layer.layout.bounding_box_padding)
                        .attr('y', (d) => ((d.track - 1) * data_layer.getTrackHeight()));

                    statusnodes.exit()
                        .remove();

                    // Render primary interval rects
                    const rects = d3.select(this).selectAll('rect.lz-data_layer-intervals.lz-interval_rect')
                        .data([interval], (d) => `${d[data_layer.layout.id_field]}_interval_rect`);

                    rects.enter()
                        .append('rect')
                        .attr('class', 'lz-data_layer-intervals lz-interval_rect')
                        .merge(rects)
                        .attr('width', (d) => d.display_range.width)
                        .attr('height', data_layer.layout.track_height)
                        .attr('x', (d) => d.display_range.start)
                        .attr('y', (d) => ((d.track - 1) * data_layer.getTrackHeight()) + data_layer.layout.bounding_box_padding)
                        .attr('fill', (d, i) => data_layer.resolveScalableParameter(data_layer.layout.color, d, i))
                        .attr('fill-opacity', (d, i) => data_layer.resolveScalableParameter(data_layer.layout.fill_opacity, d, i));

                    rects.exit()
                        .remove();

                    // Render interval click areas
                    const clickareas = d3.select(this).selectAll('rect.lz-data_layer-intervals.lz-clickarea')
                        .data([interval], (d) => `${d.interval_name}_clickarea`);

                    clickareas.enter()
                        .append('rect')
                        .attr('class', 'lz-data_layer-intervals lz-clickarea')
                        .merge(clickareas)
                        .attr('id', (d) => `${data_layer.getElementId(d)}_clickarea`)
                        .attr('rx', data_layer.layout.bounding_box_padding)
                        .attr('ry', data_layer.layout.bounding_box_padding)
                        .attr('width', (d) => d.display_range.width)
                        .attr('height', data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing)
                        .attr('x', (d) => d.display_range.start)
                        .attr('y', (d) => ((d.track - 1) * data_layer.getTrackHeight()));

                    // Remove old clickareas as needed
                    clickareas.exit()
                        .remove();

                    // Apply default event emitters to clickareas
                    clickareas.on('click', (element_data) => {
                        element_data.parent.parent.emit('element_clicked', element_data, true);
                    });

                    // Apply mouse behaviors to clickareas
                    data_layer.applyBehaviors(clickareas);
                });

            // Remove old elements as needed
            selection.exit()
                .remove();

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
        }

        _getTooltipPosition(tooltip) {
            const interval_bbox = d3.select(`#${this.getElementStatusNodeId(tooltip.data)}`).node().getBBox();
            return {
                x_min: tooltip.data.display_range.start,
                x_max: tooltip.data.display_range.end,
                y_min: interval_bbox.y,
                y_max: interval_bbox.y + interval_bbox.height
            };
        }

        // Redraw split track axis or hide it, and show/hide the legend, as determined
        // by current layout parameters and data
        updateSplitTrackAxis() {
            const legend_axis = this.layout.track_split_legend_to_y_axis ? `y${this.layout.track_split_legend_to_y_axis}` : false;
            if (this.layout.split_tracks) {
                const tracks = +this.tracks || 0;
                const track_height = +this.layout.track_height || 0;
                const track_spacing = 2 * (+this.layout.bounding_box_padding || 0) + (+this.layout.track_vertical_spacing || 0);
                const target_height = (tracks * track_height) + ((tracks - 1) * track_spacing);
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
                    this.layout.legend.forEach((element) => {
                        const key = element[this.layout.track_split_field];
                        let track = this.track_split_field_index[key];
                        if (track) {
                            if (this.layout.track_split_order === 'DESC') {
                                track = Math.abs(track - tracks - 1);
                            }
                            this.parent.layout.axes[legend_axis].ticks.push({
                                y: track,
                                text: element.label
                            });
                        }
                    });
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
                    if (!this.layout.always_hide_legend) {
                        this.parent.legend.show();
                    }
                    this.parent.layout.axes[legend_axis] = { render: false };
                    this.parent.render();
                }
            }
            return this;
        }

        // Method to not only toggle the split tracks boolean but also update
        // necessary display values to animate a complete merge/split
        toggleSplitTracks() {
            this.layout.split_tracks = !this.layout.split_tracks;
            if (this.parent.legend && !this.layout.always_hide_legend) {
                this.parent.layout.margin.bottom = 5 + (this.layout.split_tracks ? 0 : this.parent.legend.layout.height + 5);
            }
            this.render();
            this.updateSplitTrackAxis();
            return this;
        }

        // Choose an appropriate color scheme based on the number of items in the track, and whether or not we are
        //  using explicitly provided itemRgb information
        _makeColorScheme(category_info) {
            // If at least one element has an explicit itemRgb, assume the entire dataset has colors
            const has_explicit_colors = category_info.find((item) => item[2]);
            if (has_explicit_colors) {
                return category_info.map((item) => item[2]);
            }

            // Use a set of color schemes for common 15, 18, or 25 state models, as specified from:
            //  https://egg2.wustl.edu/roadmap/web_portal/chr_state_learning.html
            // These are actually reversed so that dim colors come first, on the premise that usually these are the
            //  most common states
            const n_categories = category_info.length;
            if (n_categories <= 15) {
                return ['rgb(212,212,212)', 'rgb(192,192,192)', 'rgb(128,128,128)', 'rgb(189,183,107)', 'rgb(233,150,122)', 'rgb(205,92,92)', 'rgb(138,145,208)', 'rgb(102,205,170)', 'rgb(255,255,0)', 'rgb(194,225,5)', 'rgb(0,100,0)', 'rgb(0,128,0)', 'rgb(50,205,50)', 'rgb(255,69,0)', 'rgb(255,0,0)'];
            } else if (n_categories <= 18) {
                return ['rgb(212,212,212)', 'rgb(192,192,192)', 'rgb(128,128,128)', 'rgb(189,183,107)', 'rgb(205,92,92)', 'rgb(138,145,208)', 'rgb(102,205,170)', 'rgb(255,255,0)', 'rgb(255,195,77)', 'rgb(255,195,77)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(0,100,0)', 'rgb(0,128,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,0,0)'];
            } else {
                // If there are more than 25 categories, the interval layer will fall back to the 'null value' option
                return ['rgb(212,212,212)', 'rgb(128,128,128)', 'rgb(112,48,160)', 'rgb(230,184,183)', 'rgb(138,145,208)', 'rgb(102,205,170)', 'rgb(255,255,102)', 'rgb(255,255,0)', 'rgb(255,255,0)', 'rgb(255,255,0)', 'rgb(255,195,77)', 'rgb(255,195,77)', 'rgb(255,195,77)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(194,225,5)', 'rgb(0,150,0)', 'rgb(0,128,0)', 'rgb(0,128,0)', 'rgb(0,128,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,69,0)', 'rgb(255,0,0)'];
            }
        }

        /**
         * Find all of the unique tracks (a combination of name and ID information)
         * @param {Object} data
         * @param {String} [rgb_field] A field that contains an RGB value. Aimed at BED files with an itemRgb column
         * @private
         * @returns {Array} All [unique_id, label, color] pairs in data. The unique_id is the thing used to define groupings
         *  most unambiguously.
         */
        _generateCategoriesFromData(data, rgb_field) {
            const self = this;
            // Use the hard-coded legend if available (ignoring any mods on re-render)
            const legend = this._base_layout.legend;
            if (legend && legend.length) {
                return legend.map((item) => [item[this.layout.track_split_field], item.label, item.color]);
            }

            // Generate options from data, if no preset legend exists
            const unique_ids = {}; // make categories unique
            const categories = [];

            data.forEach((item) => {
                const id = item[self.layout.track_split_field];
                if (!Object.prototype.hasOwnProperty.call(unique_ids, id)) {
                    unique_ids[id] = null;
                    // If rgbfield is null, then the last entry is undefined/null as well
                    categories.push([id, item[this.layout.track_label_field], item[rgb_field]]);
                }
            });
            return categories;
        }
    }

    const intervals_tooltip_layout = {
        namespace: { 'intervals': 'intervals' },
        closable: false,
        show: { or: ['highlighted', 'selected'] },
        hide: { and: ['unhighlighted', 'unselected'] },
        html: '{{{{namespace[intervals]}}state_name|htmlescape}}<br>{{{{namespace[intervals]}}start|htmlescape}}-{{{{namespace[intervals]}}end|htmlescape}}'
    };

    const intervals_layer_layout =  {
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
        tooltip: intervals_tooltip_layout
    };

    const intervals_panel_layout = {
        id: 'intervals',
        width: 1000,
        height: 50,
        min_width: 500,
        min_height: 50,
        margin: { top: 25, right: 150, bottom: 5, left: 50 },
        toolbar: (function () {
            const l = LocusZoom.Layouts.get('toolbar', 'standard_panel', { unnamespaced: true });
            l.widgets.push({
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
        data_layers: [intervals_layer_layout]
    };

    const intervals_plot_layout = {
        state: {},
        width: 800,
        height: 550,
        responsive_resize: 'both',
        min_region_scale: 20000,
        max_region_scale: 1000000,
        toolbar: LocusZoom.Layouts.get('toolbar', 'region_nav_plot', { unnamespaced: true }),
        panels: [
            LocusZoom.Layouts.get('panel', 'association', {
                unnamespaced: true,
                width: 800,
                proportional_height: (225 / 570)
            }),
            Object.assign(
                { unnamespaced: true, proportional_height: (120 / 570) },
                intervals_panel_layout
            ),
            LocusZoom.Layouts.get('panel', 'genes', { unnamespaced: true, width: 800, proportional_height: (225 / 570) })
        ]
    };

    LocusZoom.Adapters.add('IntervalLZ', IntervalLZ);
    LocusZoom.DataLayers.add('intervals', LzIntervalsTrack);

    LocusZoom.Layouts.add('tooltip', 'standard_intervals', intervals_tooltip_layout);
    LocusZoom.Layouts.add('data_layer', 'intervals', intervals_layer_layout);
    LocusZoom.Layouts.add('panel', 'intervals', intervals_panel_layout);
    LocusZoom.Layouts.add('plot', 'interval_association', intervals_plot_layout);

    LocusZoom.ScaleFunctions.add('to_rgb', to_rgb);

    LocusZoom.Widgets.add('toggle_split_tracks', ToggleSplitTracks);
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;
