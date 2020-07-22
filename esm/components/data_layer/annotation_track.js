/** @module */
import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';

const default_layout = {
    color: '#000000',
    filters: [],
    tooltip_positioning: 'vertical', // Allowed values: top, middle, bottom
    hitarea_width: 8,
};

/**
 * Create a single continuous 2D track that provides information about each datapoint
 *
 * For example, this can be used to color by membership in a group, alongside information in other panels
 *
 * @param {Object} layout
 * @param {Object|String} [layout.color]
 * @param {Array[]} An array of filter entries specifying which points to draw annotations for.
 *  See `BaseDataLayer.filter` for details
 */

class AnnotationTrack extends BaseDataLayer {
    constructor(layout) {
        if (!Array.isArray(layout.filters)) {
            throw new Error('Annotation track must specify array of filters for selecting points to annotate');
        }
        merge(layout, default_layout);
        super(...arguments);
    }

    render() {
        // Apply filters to only render a specified set of points
        const track_data = this._applyFilters();

        // Put the <g> containing visible lines before the one containing hit areas, so that the hit areas will be on top.
        let visible_lines_group = this.svg.group.select(`g.lz-data_layer-${this.layout.type}-visible_lines`);
        if (visible_lines_group.size() === 0) {
            visible_lines_group = this.svg.group.append('g')
                .attr('class', `lz-data_layer-${this.layout.type}-visible_lines`);
        }
        const selection = visible_lines_group.selectAll(`rect.lz-data_layer-${this.layout.type}`)
            .data(track_data, (d) => d[this.layout.id_field]);

        const width = 1;
        // Draw rectangles (visual and tooltip positioning)
        selection.enter()
            .append('rect')
            .attr('class', `lz-data_layer-${this.layout.type}`)
            .attr('id', (d) => this.getElementId(d))
            .merge(selection)
            .attr('x', (d) => this.parent['x_scale'](d[this.layout.x_axis.field]) - width / 2)
            .attr('width', width)
            .attr('height', this.parent.layout.height)
            .attr('fill', (d, i) => this.resolveScalableParameter(this.layout.color, d, i));

        // Remove unused elements
        selection.exit()
            .remove();

        let hit_areas_group = this.svg.group.select(`g.lz-data_layer-${this.layout.type}-hit_areas`);
        if (hit_areas_group.size() === 0) {
            hit_areas_group = this.svg.group.append('g')
                .attr('class', `lz-data_layer-${this.layout.type}-hit_areas`);
        }
        const hit_areas_selection = hit_areas_group.selectAll(`rect.lz-data_layer-${this.layout.type}`)
            .data(track_data, (d) => d[this.layout.id_field]);

        const _getX = (d, i) => { // Helper for position calcs below
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

        // Add new elements as needed
        hit_areas_selection.enter()
            .append('rect')
            .attr('class', `lz-data_layer-${this.layout.type}`)
            .attr('id', (d) => this.getElementId(d))
            // Update the set of elements to reflect new data
            .merge(hit_areas_selection)
            .attr('height', this.parent.layout.height)
            .attr('opacity', 0)
            .attr('x', (d, i) => {
                const crds = _getX(d, i);
                return crds[0];
            }).attr('width', (d, i) => {
                const crds = _getX(d, i);
                return (crds[1] - crds[0]) + this.layout.hitarea_width / 2;
            })
            // Set up tooltips and mouse interaction
            .call(this.applyBehaviors.bind(this));

        // Remove unused elements
        hit_areas_selection.exit()
            .remove();
    }

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
