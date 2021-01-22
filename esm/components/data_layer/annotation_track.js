import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';

/**
 * @memberof module:LocusZoom_DataLayers~annotation_track
 */
const default_layout = {
    color: '#000000',
    filters: null,
    tooltip_positioning: 'vertical',
    hitarea_width: 8,
};

/**
 * Create a single continuous 2D track that provides information about each datapoint
 *
 * For example, this can be used to mark items by membership in a group, alongside information in other panels
 * @alias module:LocusZoom_DataLayers~annotation_track
 * @see {@link module:LocusZoom_DataLayers~BaseDataLayer} for additional layout options
 */
class AnnotationTrack extends BaseDataLayer {
    /**
     * @param {Object} layout
     * @param {String|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.color] Specify how to choose the fill color for each tick mark
     * @param {number} [layout.hitarea_width=8] The width (in pixels) of hitareas. Annotation marks are typically 1 px wide,
     *   so a hit area of 4px on each side can make it much easier to select an item for a tooltip. Hitareas will not interfere
     *   with selecting adjacent points.
     * @param {'horizontal'|'vertical'|'top'|'bottom'|'left'|'right'} [layout.tooltip_positioning='vertical'] Where to draw the tooltip relative to the datum.
     */
    constructor(layout) {
        if (!Array.isArray(layout.filters)) {
            throw new Error('Annotation track must specify array of filters for selecting points to annotate');
        }
        merge(layout, default_layout);
        super(...arguments);
    }

    initialize() {
        super.initialize();
        this._hitareas_group = this.svg.group.append('g')
            .attr('class', `lz-data_layer-${this.layout.type}-hit_areas`);

        this._visible_lines_group = this.svg.group.append('g')
            .attr('class', `lz-data_layer-${this.layout.type}-visible_lines`);
    }

    render() {
        // Apply filters to only render a specified set of points
        const track_data = this._applyFilters();

        const hit_areas_selection = this._hitareas_group.selectAll(`rect.lz-data_layer-${this.layout.type}`)
            .data(track_data, (d) => d[this.layout.id_field]);


        const _getX = (d, i) => {
            // Helper for hitarea position calcs: ensures that a hitarea never overlaps the space allocated
            // for a real data element. Helps to avoid mouse jitter when selecting tooltips in crowded areas.
            const x_center = this.parent['x_scale'](d[this.layout.x_axis.field]);
            let x_left = x_center - this.layout.hitarea_width / 2;
            if (i >= 1) {
                // This assumes that the data are in sorted order.
                const left_node = track_data[i - 1];
                const left_node_x_center = this.parent['x_scale'](left_node[this.layout.x_axis.field]);
                x_left = Math.max(x_left, (x_center + left_node_x_center) / 2);
            }
            return [x_left, x_center];
        };

        // Draw hitareas under real data elements, so that real data elements always take precedence
        hit_areas_selection.enter()
            .append('rect')
            .attr('class', `lz-data_layer-${this.layout.type}`)
            // Update the set of elements to reflect new data
            .merge(hit_areas_selection)
            .attr('id', (d) => this.getElementId(d))
            .attr('height', this.parent.layout.height)
            .attr('opacity', 0)
            .attr('x', (d, i) => {
                const crds = _getX(d, i);
                return crds[0];
            })
            .attr('width', (d, i) => {
                const crds = _getX(d, i);
                return (crds[1] - crds[0]) + this.layout.hitarea_width / 2;
            });

        const width = 1;
        const selection = this._visible_lines_group.selectAll(`rect.lz-data_layer-${this.layout.type}`)
            .data(track_data, (d) => d[this.layout.id_field]);
        // Draw rectangles (visual and tooltip positioning)
        selection.enter()
            .append('rect')
            .attr('class', `lz-data_layer-${this.layout.type}`)
            .merge(selection)
            .attr('id', (d) => this.getElementId(d))
            .attr('x', (d) => this.parent['x_scale'](d[this.layout.x_axis.field]) - width / 2)
            .attr('width', width)
            .attr('height', this.parent.layout.height)
            .attr('fill', (d, i) => this.resolveScalableParameter(this.layout.color, d, i));

        // Remove unused elements
        selection.exit()
            .remove();

        // Set up tooltips and mouse interaction
        this.svg.group
            .call(this.applyBehaviors.bind(this));

        // Remove unused elements
        hit_areas_selection.exit()
            .remove();
    }

    /**
     * Render tooltip at the center of each tick mark
     * @param tooltip
     * @return {{y_min: number, x_max: *, y_max: *, x_min: number}}
     * @private
     */
    _getTooltipPosition(tooltip) {
        const panel = this.parent;
        const data_layer_height = panel.layout.height - (panel.layout.margin.top + panel.layout.margin.bottom);
        const stroke_width = 1; // as defined in the default stylesheet

        const x_center = panel.x_scale(tooltip.data[this.layout.x_axis.field]);
        const y_center = data_layer_height / 2;
        return {
            x_min: x_center - stroke_width,
            x_max: x_center + stroke_width,
            y_min: y_center - panel.layout.margin.top,
            y_max: y_center + panel.layout.margin.bottom,
        };
    }
}

export {AnnotationTrack as default};
