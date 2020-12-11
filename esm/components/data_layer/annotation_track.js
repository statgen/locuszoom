/** @module */
import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';

const default_layout = {
    color: '#000000',
    filters: null,
    tooltip_positioning: 'vertical', // Allowed values: top, middle, bottom
    hitarea_width: 8,
};

/**
 * Create a single continuous 2D track that provides information about each datapoint
 *
 * For example, this can be used to color by membership in a group, alongside information in other panels
 *
 */
class AnnotationTrack extends BaseDataLayer {
    /*
     * @param {Object} layout
     * @param {Object|String} [layout.color]
     * @param {Object[]} layout.filters An array of filter entries specifying which points to draw annotations for.
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

        // Draw hitareas under real data elements, so that real data elements always take precedence
        hit_areas_selection.enter()
            .append('rect')
            .attr('class', `lz-data_layer-${this.layout.type}`)
            // Update the set of elements to reflect new data
            .merge(hit_areas_selection)
            .attr('id', (d) => this.getElementId(d))
            .attr('height', this.parent.layout.height)
            .attr('opacity', 0)
            .attr('x', (d) => this.parent['x_scale'](d[this.layout.x_axis.field]) - this.layout.hitarea_width / 2)
            .attr('width', (d, i) => this.layout.hitarea_width);

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
