/**
 * Interval annotation track (for chromatin state, etc). Useful for BED file data with non-overlapping intervals.
 *  This is not part of the core LocusZoom library, but can be included as a standalone file.
 *
 * ### Features provided
 * * {@link module:LocusZoom_Adapters~IntervalLZ}
 * * {@link module:LocusZoom_Widgets~toggle_split_tracks}
 * * {@link module:LocusZoom_ScaleFunctions~to_rgb}
 * * {@link module:LocusZoom_DataLayers~intervals}
 * * {@link module:LocusZoom_Layouts~standard_intervals}
 * * {@link module:LocusZoom_Layouts~intervals_layer}
 * * {@link module:LocusZoom_Layouts~intervals}
 * * {@link module:LocusZoom_Layouts~interval_association}
 *
 * ### Loading and usage
 * The page must incorporate and load all libraries before this file can be used, including:
 * - LocusZoom
 *
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN (after any dependencies):
 * ```
 * <script src="https://cdn.jsdelivr.net/npm/locuszoom@INSERT_VERSION_HERE/dist/ext/lz-intervals-track.min.js" type="application/javascript"></script>
 * ```
 *
 * To use with ES6 modules, the plugin must be loaded and registered explicitly before use:
 * ```
 * import LocusZoom from 'locuszoom';
 * import IntervalsTrack from 'locuszoom/esm/ext/lz-intervals-track';
 * LocusZoom.use(IntervalsTrack);
 * ```
 *
 * Then use the features made available by this extension. (see demos and documentation for guidance)
 * @module
 */

import * as d3 from 'd3';


// Coordinates (start, end) are cached to facilitate rendering
const XCS = Symbol.for('lzXCS');
const YCS = Symbol.for('lzYCS');
const XCE = Symbol.for('lzXCE');
const YCE = Symbol.for('lzYCE');


function install (LocusZoom) {
    const BaseUMAdapter = LocusZoom.Adapters.get('BaseUMAdapter');
    const _Button = LocusZoom.Widgets.get('_Button');
    const _BaseWidget = LocusZoom.Widgets.get('BaseWidget');

    /**
     * (**extension**) Retrieve Interval Annotation Data (e.g. BED Tracks), as fetched from the LocusZoom API server (or compatible)
     * @public
     * @alias module:LocusZoom_Adapters~IntervalLZ
     * @see module:LocusZoom_Adapters~BaseApiAdapter
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
     * @param {number} config.params.source The numeric ID for a specific dataset as assigned by the API server
     */
    class IntervalLZ extends BaseUMAdapter {
        _getURL(request_options) {
            const source = this._config.source;
            const query = `?filter=id in ${source} and chromosome eq '${request_options.chr}' and start le ${request_options.end} and end ge ${request_options.start}`;

            const base = super._getURL(request_options);
            return `${base}${query}`;
        }
    }

    /**
     * (**extension**) Button to toggle split tracks mode in an intervals track. This button only works as a panel-level toolbar
     *   and when used with an intervals data layer from this extension.
     * @alias module:LocusZoom_Widgets~toggle_split_tracks
     * @see module:LocusZoom_Widgets~BaseWidget
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
     */
    class ToggleSplitTracks extends _BaseWidget {
        /**
         * @param {string} layout.data_layer_id The ID of the data layer that this button is intended to control.
         */
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
                        // FIXME: the timeout calls to scale and position (below) cause full ~5 additional re-renders
                        //  If we can remove these it will greatly speed up re-rendering.
                        // The key problem here is that the height is apparently not known in advance and is determined after re-render.
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
     * (**extension**) Convert a value ""rr,gg,bb" (if given) to a css-friendly color string: "rgb(rr,gg,bb)".
     * This is tailored specifically to the color specification format embraced by the BED file standard.
     * @alias module:LocusZoom_ScaleFunctions~to_rgb
     * @param {Object} parameters This function has no defined configuration options
     * @param {String|null} value The value to convert to rgb
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
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

    const BaseLayer = LocusZoom.DataLayers.get('BaseDataLayer');

    /**
     * (**extension**) Implements a data layer that will render interval annotation tracks (intervals must provide start and end values)
     * Each interval (such as from a BED file) will be rendered as a rectangle. All spans can be rendered on the same
     *  row, or each (auto-detected) category can be rendered as one row per category.
     *
     * This layer is intended to work with a variety of datasets with special requirements. As such, it has a lot
     *  of configuration options devoted to identifying how to fill in missing information (such as color)
     *
     * @alias module:LocusZoom_DataLayers~intervals
     * @see module:LocusZoom_DataLayers~BaseDataLayer
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
     */
    class LzIntervalsTrack extends BaseLayer {
        /**
         * @param {string} [layout.start_field='start'] The field that defines interval start position
         * @param {string} [layout.end_field='end'] The field that defines interval end position
         * @param {string} [layout.track_label_field='state_name'] Used to label items on the y-axis
         * @param {string} [layout.track_split_field='state_id'] Used to define categories on the y-axis. It is usually most convenient to use
         *  the same value for state_field and label_field (eg 1:1 correspondence).
         * @param {*|'DESC'} [layout.track_split_order='DESC'] When in split tracks mode, should categories be shown in
         *  the order given, or descending order
         * @param {number} [layout.track_split_legend_to_y_axis=2]
         * @param {boolean} [layout.split_tracks=true] Whether to show tracks as merged (one row) or split (many rows)
         *  on initial render.
         * @param {number} [layout.track_height=15] The height of each interval rectangle, in px
         * @param {number} [layout.track_vertical_spacing=3]
         * @param {number} [layout.bounding_box_padding=2]
         * @param {boolean} [layout.always_hide_legend=false] Normally the legend is shown in merged mode and hidden
         *  in split mode. For datasets with a very large number of categories, it may make sense to hide the legend at all times.
         * @param {string|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.color='#B8B8B8'] The color of each datum rectangle
         * @param {number|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.fill_opacity=1]
         * @param {string} [layout.tooltip_positioning='vertical']
         */
        constructor(layout) {
            LocusZoom.Layouts.merge(layout, default_layout);
            super(...arguments);
            this._previous_categories = [];
            this._categories = [];
        }

        initialize() {
            super.initialize();
            this._statusnodes_group = this.svg.group.append('g')
                .attr('class', 'lz-data-layer-intervals lz-data-layer-intervals-statusnode');
            this._datanodes_group = this.svg.group.append('g')
                .attr('class', 'lz-data_layer-intervals');
        }

        /**
         * Split data into tracks such that anything with a common grouping field is in the same track
         * @param data
         * @return {unknown[]}
         * @private
         */
        _arrangeTrackSplit(data) {
            const {track_split_field} = this.layout;
            const result = {};
            data.forEach((item) => {
                const item_key = item[track_split_field];
                if (!Object.prototype.hasOwnProperty.call(result, item_key)) {
                    result[item_key] = [];
                }
                result[item_key].push(item);
            });
            return result;
        }

        /**
         * Split data into rows using a simple greedy algorithm such that no two items overlap (share same interval)
         * Assumes that the data are sorted so item1.start always <= item2.start.
         *
         * This function can also simply return all data on a single row. This functionality may become configurable
         *  in the future but for now reflects a lack of clarity in the requirements/spec. The code to split
         *  overlapping items is present but may not see direct use.
         */
        _arrangeTracksLinear(data, allow_overlap = true) {
            if (allow_overlap) {
                // If overlap is allowed, then all the data can live on a single row
                return [data];
            }

            // ASSUMPTION: Data is given to us already sorted by start position to facilitate grouping.
            // We do not sort here because JS "sort" is not stable- if there are many intervals that overlap, then we
            //   can get different layouts (number/order of rows) on each call to "render".
            //
            // At present, we decide how to update the y-axis based on whether current and former number of rows are
            //  the same. An unstable sort leads to layout thrashing/too many re-renders. FIXME: don't rely on counts
            const {start_field, end_field} = this.layout;

            const grouped_data = [[]]; // Prevent two items from colliding by rendering them to different rows, like genes
            data.forEach((item, index) => {
                for (let i = 0; i < grouped_data.length; i++) {
                    // Iterate over all rows of the
                    const row_to_test = grouped_data[i];
                    const last_item = row_to_test[row_to_test.length - 1];
                    // Some programs report open intervals, eg 0-1,1-2,2-3; these points are not considered to overlap (hence the test isn't "<=")
                    const has_overlap = last_item && (item[start_field] < last_item[end_field]) && (last_item[start_field] < item[end_field]);
                    if (!has_overlap) {
                        // If there is no overlap, add item to current row, and move on to the next item
                        row_to_test.push(item);
                        return;
                    }
                }
                // If this item would collide on all existing rows, create a new row
                grouped_data.push([item]);
            });
            return grouped_data;
        }

        /**
         * Annotate each item with the track number, and return.
         * @param {Object[]}data
         * @private
         * @return [String[], Object[]] Return the categories and the data array
         */
        _assignTracks(data) {
            // Flatten the grouped data.
            const {x_scale} = this.parent;
            const {start_field, end_field, bounding_box_padding, track_height} = this.layout;

            const grouped_data = this.layout.split_tracks ? this._arrangeTrackSplit(data) : this._arrangeTracksLinear(data, true);
            const categories = Object.keys(grouped_data);
            if (this.layout.track_split_order === 'DESC') {
                categories.reverse();
            }

            categories.forEach((key, row_index) => {
                const row = grouped_data[key];
                row.forEach((item) => {
                    item[XCS] = x_scale(item[start_field]);
                    item[XCE] = x_scale(item[end_field]);
                    item[YCS] = row_index * this.getTrackHeight() + bounding_box_padding;
                    item[YCE] = item[YCS] + track_height;
                    // Store the row ID, so that clicking on a point can find the right status node (big highlight box)
                    item.track = row_index;
                });
            });
            // We're mutating elements of the original data array as a side effect: the return value here is
            //  interchangeable with `this.data` for subsequent usages
            // TODO: Can replace this with array.flat once polyfill support improves
            return [categories, Object.values(grouped_data).reduce((acc, val) => acc.concat(val), [])];
        }

        /**
         * When we are in "split tracks mode", it's convenient to wrap all individual annotations with a shared
         *  highlight box that wraps everything on that row.
         *
         * This is done automatically by the "setElementStatus" code, if this function returns a non-null value
         *
         * To define shared highlighting on the track split field define the status node id override
         * to generate an ID common to the track when we're actively splitting data out to separate tracks
         * @override
         * @returns {String}
         */
        getElementStatusNodeId(element) {
            if (this.layout.split_tracks) {
                // Data nodes are bound to data objects, but the "status_nodes" selection is bound to numeric row IDs
                const track = typeof element === 'object' ? element.track : element;
                const base = `${this.getBaseId()}-statusnode-${track}`;
                return base.replace(/[^\w]/g, '_');
            }
            // In merged tracks mode, there is no separate status node
            return null;
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

        // Implement the main render function
        render() {
            //// Autogenerate layout options if not provided
            this._applyLayoutOptions();

            // Determine the appropriate layout for tracks. Store the previous categories (y axis ticks) to decide
            //   whether the axis needs to be re-rendered.
            this._previous_categories = this._categories;
            const [categories, assigned_data] = this._assignTracks(this.data);
            this._categories = categories;
            // Update the legend axis if the number of ticks changed
            const labels_changed = !categories.every( (item, index) => item === this._previous_categories[index]);
            if (labels_changed) {
                this.updateSplitTrackAxis(categories);
                return;
            }

            // Apply filters to only render a specified set of points. Hidden fields will still be given space to render, but not shown.
            const track_data = this._applyFilters(assigned_data);

            // Clear before every render so that, eg, highlighting doesn't persist if we load a region with different
            //  categories (row 2 might be a different category and it's confusing if the row stays highlighted but changes meaning)
            // Highlighting will automatically get added back if it actually makes sense, courtesy of setElementStatus,
            //  if a selected item is still in view after the new region loads.
            this._statusnodes_group.selectAll('rect')
                .remove();

            // Reselect in order to add new data
            const status_nodes = this._statusnodes_group.selectAll('rect')
                .data(d3.range(categories.length));

            if (this.layout.split_tracks) {
                // Status nodes: a big highlight box around all items of the same type. Used in split tracks mode,
                //  because everything on the same row is the same category and a group makes sense
                // There are no status nodes in merged mode, because the same row contains many kinds of things

                // Status nodes are 1 per row, so "data" can just be a dummy list of possible row IDs
                // Each status node is a box that runs the length of the panel and receives a special "colored box" css
                //  style when selected
                const height = this.getTrackHeight();
                status_nodes.enter()
                    .append('rect')
                    .attr('class', 'lz-data_layer-intervals lz-data_layer-intervals-statusnode lz-data_layer-intervals-shared')
                    .attr('rx', this.layout.bounding_box_padding)
                    .attr('ry', this.layout.bounding_box_padding)
                    .merge(status_nodes)
                    .attr('id', (d) => this.getElementStatusNodeId(d))
                    .attr('x', 0)
                    .attr('y', (d) => (d * height))
                    .attr('width', this.parent.layout.cliparea.width)
                    .attr('height', height - this.layout.track_vertical_spacing);
            }
            status_nodes.exit()
                .remove();

            // Draw rectangles for the data (intervals)
            const data_nodes = this._datanodes_group.selectAll('rect')
                .data(track_data, (d) => d[this.layout.id_field]);

            data_nodes.enter()
                .append('rect')
                .merge(data_nodes)
                .attr('id', (d) => this.getElementId(d))
                .attr('x', (d) => d[XCS])
                .attr('y', (d) => d[YCS])
                .attr('width', (d) => d[XCE] - d[XCS])
                .attr('height', this.layout.track_height)
                .attr('fill', (d, i) => this.resolveScalableParameter(this.layout.color, d, i))
                .attr('fill-opacity', (d, i) => this.resolveScalableParameter(this.layout.fill_opacity, d, i));

            data_nodes.exit()
                .remove();

            this._datanodes_group
                .call(this.applyBehaviors.bind(this));

            // The intervals track allows legends to be dynamically generated, in which case space can only be
            //  allocated after the panel has been rendered.
            if (this.parent && this.parent.legend) {
                this.parent.legend.render();
            }
        }

        _getTooltipPosition(tooltip) {
            return {
                x_min: tooltip.data[XCS],
                x_max: tooltip.data[XCE],
                y_min: tooltip.data[YCS],
                y_max: tooltip.data[YCE],
            };
        }

        // Redraw split track axis or hide it, and show/hide the legend, as determined
        // by current layout parameters and data
        updateSplitTrackAxis(categories) {
            const legend_axis = this.layout.track_split_legend_to_y_axis ? `y${this.layout.track_split_legend_to_y_axis}` : false;
            if (this.layout.split_tracks) {
                const tracks = +categories.length || 0;
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
                            end: (this.layout.track_height / 2),
                        },
                    };
                    // There is a very tight coupling between the display directives: each legend item must identify a key
                    //  field for unique tracks. (Typically this is `state_id`, the same key field used to assign unique colors)
                    // The list of unique keys corresponds to the order along the y-axis
                    this.layout.legend.forEach((element) => {
                        const key = element[this.layout.track_split_field];
                        let track = categories.findIndex((item) => item === key);
                        if (track !== -1) {
                            if (this.layout.track_split_order === 'DESC') {
                                track = Math.abs(track - tracks - 1);
                            }
                            this.parent.layout.axes[legend_axis].ticks.push({
                                y: track - 1,
                                text: element.label,
                            });
                        }
                    });
                    this.layout.y_axis = {
                        axis: this.layout.track_split_legend_to_y_axis,
                        floor: 1,
                        ceiling: tracks,
                    };
                }
                // This will trigger a re-render
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

    /**
     * (**extension**) A basic tooltip with information to be shown over an intervals datum
     * @alias module:LocusZoom_Layouts~standard_intervals
     * @type tooltip
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
     */
    const intervals_tooltip_layout = {
        namespace: { 'intervals': 'intervals' },
        closable: false,
        show: { or: ['highlighted', 'selected'] },
        hide: { and: ['unhighlighted', 'unselected'] },
        html: '{{intervals.state_name|htmlescape}}<br>{{intervals.start|htmlescape}}-{{intervals.end|htmlescape}}',
    };

    /**
     * (**extension**) A data layer with some preconfigured options for intervals display. This example was designed for chromHMM output,
     *   in which various states are assigned numeric state IDs and (<= as many) text state names
     * @alias module:LocusZoom_Layouts~intervals_layer
     * @type data_layer
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
     */
    const intervals_layer_layout =  {
        namespace: { 'intervals': 'intervals' },
        id: 'intervals',
        type: 'intervals',
        tag: 'intervals',
        fields: ['intervals.start', 'intervals.end', 'intervals.state_id', 'intervals.state_name', 'intervals.itemRgb'],
        id_field: 'intervals.start',  // FIXME: This is not a good D3 "are these datums redundant" ID for datasets with multiple intervals heavily overlapping
        start_field: 'intervals.start',
        end_field: 'intervals.end',
        track_split_field: 'intervals.state_name',
        track_label_field: 'intervals.state_name',
        split_tracks: false,
        always_hide_legend: true,
        color: [
            {
                // If present, an explicit color field will override any other option (and be used to auto-generate legend)
                field: 'intervals.itemRgb',
                scale_function: 'to_rgb',
            },
            {
                // TODO: Consider changing this to stable_choice in the future, for more stable coloring
                field: 'intervals.state_name',
                scale_function: 'categorical_bin',
                parameters: {
                    // Placeholder. Empty categories and values will automatically be filled in when new data loads.
                    categories: [],
                    values: [],
                    null_value: '#B8B8B8',
                },
            },
        ],
        legend: [], // Placeholder; auto-filled when data loads.
        behaviors: {
            onmouseover: [
                { action: 'set', status: 'highlighted' },
            ],
            onmouseout: [
                { action: 'unset', status: 'highlighted' },
            ],
            onclick: [
                { action: 'toggle', status: 'selected', exclusive: true },
            ],
            onshiftclick: [
                { action: 'toggle', status: 'selected' },
            ],
        },
        tooltip: intervals_tooltip_layout,
    };

    /**
     * (**extension**) A panel containing an intervals data layer, eg for BED tracks
     * @alias module:LocusZoom_Layouts~intervals
     * @type panel
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
     */
    const intervals_panel_layout = {
        id: 'intervals',
        tag: 'intervals',
        min_height: 50,
        height: 50,
        margin: { top: 25, right: 150, bottom: 5, left: 50 },
        toolbar: (function () {
            const l = LocusZoom.Layouts.get('toolbar', 'standard_panel', { unnamespaced: true });
            l.widgets.push({
                type: 'toggle_split_tracks',
                data_layer_id: 'intervals',
                position: 'right',
            });
            return l;
        })(),
        axes: {},
        interaction: {
            drag_background_to_pan: true,
            scroll_to_zoom: true,
            x_linked: true,
        },
        legend: {
            hidden: true,
            orientation: 'horizontal',
            origin: { x: 50, y: 0 },
            pad_from_bottom: 5,
        },
        data_layers: [intervals_layer_layout],
    };

    /**
     * (**extension**) A plot layout that shows association summary statistics, genes, and interval data. This example assumes
     *  chromHMM data. (see panel layout)
     * @alias module:LocusZoom_Layouts~interval_association
     * @type plot
     * @see {@link module:ext/lz-intervals-track} for required extension and installation instructions
     */
    const intervals_plot_layout = {
        state: {},
        width: 800,
        responsive_resize: true,
        min_region_scale: 20000,
        max_region_scale: 1000000,
        toolbar: LocusZoom.Layouts.get('toolbar', 'standard_association', { unnamespaced: true }),
        panels: [
            LocusZoom.Layouts.get('panel', 'association'),
            LocusZoom.Layouts.merge({ unnamespaced: true, min_height: 120, height: 120 }, intervals_panel_layout),
            LocusZoom.Layouts.get('panel', 'genes'),
        ],
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
