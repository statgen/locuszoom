/**
Interval annotation track that groups annotations by enrichment value (a fixed y-axis) rather than by merged/split tracks.

This is not part of the core LocusZoom library, but can be included as a standalone file.

The page must incorporate and load all libraries before this file can be used, including:
 - Vendor assets
 - LocusZoom
 @module
*/

// Coordinates (start, end) are cached to facilitate rendering
const XCS = Symbol.for('lzXCS');
const YCS = Symbol.for('lzYCS');
const XCE = Symbol.for('lzXCE');
const YCE = Symbol.for('lzYCE');


function install (LocusZoom) {
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
        track_height: 10,
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
    class LzIntervalsEnrichment extends BaseLayer {
        constructor(layout) {
            LocusZoom.Layouts.merge(layout, default_layout);
            super(...arguments);
        }

        // Helper function to sum layout values to derive total height for a single interval track
        getTrackHeight() {
            return this.layout.track_height
                + this.layout.track_vertical_spacing
                + (2 * this.layout.bounding_box_padding);
        }

        render() {
            // Determine the appropriate layout for tracks. Store the previous categories (y axis ticks) to decide
            //   whether the axis needs to be re-rendered.

            // Apply filters to only render a specified set of points. Hidden fields will still be given space to render, but not shown.
            const track_data = this._applyFilters(this.data);

            const {start_field, end_field, bounding_box_padding, track_height} = this.layout;
            const y_field = this.layout.y_axis.field;
            const y_axis_name = `y${this.layout.y_axis.axis}_scale`;
            const {x_scale, [y_axis_name]: y_scale} = this.parent;

            // Calculate coordinates for each point
            track_data.forEach((item) => {
                item[XCS] = x_scale(item[start_field]);
                item[XCE] = x_scale(item[end_field]);
                item[YCS] = y_scale(item[y_field]) - this.getTrackHeight() / 2 + bounding_box_padding;
                item[YCE] = item[YCS] + track_height;
            });

            track_data.sort((a, b) => {
                // Simplistic layout algorithm that adds wide rectangles to the DOM first, so that small rectangles
                //  in the same space are clickable (SVG element order determines z-index)
                const aspan = a[XCE] - a[XCS];
                const bspan = b[XCE] - b[XCS];
                return bspan - aspan;
            });

            const selection = this.svg.group.selectAll('rect')
                .data(track_data);

            selection.enter()
                .append('rect')
                .merge(selection)
                .attr('id', (d) => this.getElementId(d))
                .attr('x', (d) => d[XCS])
                .attr('y', (d) => d[YCS])
                .attr('width', (d) => d[XCE] - d[XCS])
                .attr('height', this.layout.track_height)
                .attr('fill', (d, i) => this.resolveScalableParameter(this.layout.color, d, i))
                .attr('fill-opacity', (d, i) => this.resolveScalableParameter(this.layout.fill_opacity, d, i));

            selection.exit()
                .remove();

            this.svg.group
                .call(this.applyBehaviors.bind(this));
        }

        _getTooltipPosition(tooltip) {
            return {
                x_min: tooltip.data[XCS],
                x_max: tooltip.data[XCE],
                y_min: tooltip.data[YCS],
                y_max: tooltip.data[YCE],
            };
        }
    }

    const intervals_tooltip_layout = {
        namespace: { 'intervals': 'intervals' },
        closable: true,
        show: { or: ['highlighted', 'selected'] },
        hide: { and: ['unhighlighted', 'unselected'] },
        html: `<b>Tissue</b>: {{{{namespace[intervals]}}tissueId|htmlescape}}<br>
               <b>Range</b>: {{{{namespace[intervals]}}chromosome|htmlescape}}: {{{{namespace[intervals]}}start|htmlescape}}-{{{{namespace[intervals]}}end|htmlescape}}<br>
               <b>-log10 p</b>: {{{{namespace[intervals]}}pValue|neglog10|scinotation|htmlescape}}<br>
               <b>Enrichment (n-fold)</b>: {{{{namespace[intervals]}}fold|scinotation|htmlescape}}`,
    };

    const intervals_layer_layout =  {
        namespace: { 'intervals': 'intervals' },
        id: 'intervals_enrichment',
        type: 'intervals_enrichment',
        fields: ['{{namespace[intervals]}}chromosome', '{{namespace[intervals]}}start', '{{namespace[intervals]}}end', '{{namespace[intervals]}}pValue', '{{namespace[intervals]}}fold', '{{namespace[intervals]}}tissueId', '{{namespace[intervals]}}ancestry'],
        id_field: '{{namespace[intervals]}}start', // not a good ID field for overlapping intervals
        start_field: '{{namespace[intervals]}}start',
        end_field: '{{namespace[intervals]}}end',
        filters: [
            {field: '{{namespace[intervals]}}ancestry', operator: '=', value: 'EU'},
        ],
        y_axis: {
            axis: 1,
            field: '{{namespace[intervals]}}fold', // is this used for other than extent generation?
            floor: 0,
            upper_buffer: 0.10,
            min_extent: [0, 10],
        },
        fill_opacity: 0.5, // Many intervals overlap: show all, even if the ones below can't be clicked
        color: [
            {
                field: '{{namespace[intervals]}}tissueId',
                scale_function: 'stable_choice',
                parameters: {
                    values: ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'],
                },
            },
        ],
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

    const intervals_panel_layout = {
        id: 'intervals_enrichment',
        min_height: 250,
        height: 250,
        margin: { top: 35, right: 50, bottom: 40, left: 50 },
        inner_border: 'rgb(210, 210, 210)',
        axes: {
            x: {
                label: 'Chromosome {{chr}} (Mb)',
                label_offset: 32,
                tick_format: 'region',
                extent: 'state',
            },
            y1: {
                label: 'enrichment (n-fold)',
                label_offset: 28,
            },
        },
        interaction: {
            drag_background_to_pan: true,
            drag_x_ticks_to_scale: true,
            drag_y1_ticks_to_scale: true,
            scroll_to_zoom: true,
            x_linked: true,
        },
        data_layers: [intervals_layer_layout],
    };

    const intervals_plot_layout = {
        state: {},
        width: 800,
        responsive_resize: true,
        min_region_scale: 20000,
        max_region_scale: 1000000,
        toolbar: LocusZoom.Layouts.get('toolbar', 'standard_association', { unnamespaced: true }),
        panels: [
            LocusZoom.Layouts.get('panel', 'association'),
            intervals_panel_layout,
            LocusZoom.Layouts.get('panel', 'genes'),
        ],
    };

    LocusZoom.DataLayers.add('intervals_enrichment', LzIntervalsEnrichment);

    LocusZoom.Layouts.add('tooltip', 'intervals_enrichment', intervals_tooltip_layout);
    LocusZoom.Layouts.add('data_layer', 'intervals_enrichment', intervals_layer_layout);
    LocusZoom.Layouts.add('panel', 'intervals_enrichment', intervals_panel_layout);
    LocusZoom.Layouts.add('plot', 'intervals_association_enrichment', intervals_plot_layout);
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;
