import * as d3 from 'd3';

import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';

/**
 * @memberof module:LocusZoom_DataLayers~highlight_regions
 */
const default_layout = {
    color: '#CCCCCC',
    fill_opacity: 0.5,
    // By default, it will draw the regions shown.
    filters: null,
    // Most use cases will show a preset list of regions defined in the layout
    //  (if empty, AND layout.fields is not, it could fetch from a data source instead)
    regions: [],
    id_field: 'id',
    start_field: 'start',
    end_field: 'end',
    merge_field: null,
};

/**
 * "Highlight regions with rectangle" data layer.
 * Creates one (or more) continuous 2D rectangles that mark an entire interval, to the full height of the panel.
 *
 * Each individual rectangle can be shown in full, or overlapping ones can be merged (eg, based on same category).
 * The rectangles are generally drawn with partial transparency, and do not respond to mouse events: they are a
 *   useful highlight tool to draw attention to intervals that contain interesting variants.
 *
 * This layer has several useful modes:
 * 1. Draw one or more specified rectangles as provided from:
 *      A. Hard-coded layout (layout.regions)
 *      B. Data fetched from a source (like intervals with start and end coordinates)- as specified in layout.fields
 * 2. Fetch data from an external source, and only render the intervals that match criteria
 *
 * @alias module:LocusZoom_DataLayers~highlight_regions
 * @see {@link module:LocusZoom_DataLayers~BaseDataLayer} for additional layout options
 */
class HighlightRegions extends BaseDataLayer {
    /**
     * @param {String|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.color='#CCCCCC'] The fill color for each rectangle
     * @param {String|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.fill_opacity=0.5] The opacity (0-1). We recommend partial transparency so that
     *   rectangles do not hide or interfere with adjacent elements.
     * @param {Object[]} [layout.filters] An array of filter entries specifying which intervals to draw annotations for.
     * @param {Object[]} [layout.regions] A hard-coded list of regions. If provided, takes precedence over data fetched from an external source.
     * @param {String} [layout.start_field='start'] The field to use for rectangle start x coordinate
     * @param {String} [layout.end_field='end'] The field to use for rectangle end x coordinate
     * @param {String} [layout.merge_field] If two intervals overlap, they can be "merged" based on a field that
     *  identifies the category (eg, only rectangles of the same category will be merged).
     *  This field must be present in order to trigger merge behavior. This is applied after filters.
     */
    constructor(layout) {
        merge(layout, default_layout);
        if (layout.interaction || layout.behaviors) {
            throw new Error('highlight_regions layer does not support mouse events');
        }

        if (layout.regions && layout.regions.length && layout.fields && layout.fields.length) {
            throw new Error('highlight_regions layer can specify "regions" in layout, OR external data "fields", but not both');
        }
        super(...arguments);
    }

    /**
     * Helper method that combines two rectangles if they are the same type of data (category) and occupy the same
     *  area of the plot (will automatically sort the data prior to rendering)
     *
     * When two fields conflict, it will fill in the fields for the last of the items that overlap in that range.
     *   Thus, it is not recommended to use tooltips with this feature, because the tooltip won't reflect real data.
     * @param {Object[]} data
     * @return {Object[]}
     * @private
     */
    _mergeNodes(data) {
        const { end_field, merge_field, start_field } = this.layout;
        if (!merge_field) {
            return data;
        }

        // Ensure data is sorted by start field, with category as a tie breaker
        data.sort((a, b) => {
            // Ensure that data is sorted by category, then start field (ensures overlapping intervals are adjacent)
            return d3.ascending(a[merge_field], b[merge_field]) || d3.ascending(a[start_field], b[start_field]);
        });

        let track_data = [];
        data.forEach(function (cur_item, index) {
            const prev_item = track_data[track_data.length - 1] || cur_item;
            if (cur_item[merge_field] === prev_item[merge_field] && cur_item[start_field] <= prev_item[end_field]) {
                // If intervals overlap, merge the current item with the previous, and append only the merged interval
                const new_start = Math.min(prev_item[start_field], cur_item[start_field]);
                const new_end = Math.max(prev_item[end_field], cur_item[end_field]);
                cur_item = Object.assign({}, prev_item, cur_item, { [start_field]: new_start, [end_field]: new_end });
                track_data.pop();
            }
            track_data.push(cur_item);
        });
        return track_data;
    }

    render() {
        const { x_scale } = this.parent;
        // Apply filters to only render a specified set of points
        let track_data = this.layout.regions.length ? this.layout.regions : this.data;

        // Pseudo identifier for internal use only (regions have no semantic or transition meaning)
        track_data.forEach((d, i) => d.id || (d.id = i));
        track_data = this._applyFilters(track_data);
        track_data = this._mergeNodes(track_data);

        const selection = this.svg.group.selectAll(`rect.lz-data_layer-${this.layout.type}`)
            .data(track_data);

        // Draw rectangles
        selection.enter()
            .append('rect')
            .attr('class', `lz-data_layer-${this.layout.type}`)
            .merge(selection)
            .attr('id', (d) => this.getElementId(d))
            .attr('x', (d) => x_scale(d[this.layout.start_field]))
            .attr('width', (d) => x_scale(d[this.layout.end_field]) - x_scale(d[this.layout.start_field]))
            .attr('height', this.parent.layout.height)
            .attr('fill', (d, i) => this.resolveScalableParameter(this.layout.color, d, i))
            .attr('fill-opacity', (d, i) => this.resolveScalableParameter(this.layout.fill_opacity, d, i));

        // Remove unused elements
        selection.exit()
            .remove();

        // Note: This layer intentionally does not allow tooltips or mouse behaviors, and doesn't affect pan/zoom
        this.svg.group.style('pointer-events', 'none');
    }

    _getTooltipPosition(tooltip) {
        // This layer is for visual highlighting only; it does not allow mouse interaction, drag, or tooltips
        throw new Error('This layer does not support tooltips');
    }
}

export {HighlightRegions as default};
