/**
 * "Highlight regions with rectangle" data layer
 *
 * This has several useful modes:
 * 1. Draw one or more specified rectangles as provided from:
 *      A. Hard-coded layout
 *      B. Data fetched from a source (like intervals with start and end coordinates)
 * 2. Fetch data from an external source, and only render the intervals that match criteria
 * @module */
import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';

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
};

/**
 * Create a single continuous 2D track that provides information about each datapoint
 *
 * For example, this can be used to color by membership in a group, alongside information in other panels
 *
 */
class HighlightRegions extends BaseDataLayer {
    /*
     * @param {Object} layout
     * @param {Object[]|String} [layout.color]
     * @param {Array|String} [layout.fill_opacity]
     * @param {Object[]} layout.filters An array of filter entries specifying which points to draw annotations for.
     * @param {Object[]]} [layout.regions] A hard-coded list of regions. If provided, takes precedence over data fetched from an external source.
     * @param {String} [layout.start_field='start'] The field to use for rectangle start coordinate
     * @param {String} [layout.end_field='end'] The field to use for rectangle end coordinate
     */
    constructor(layout) {
        merge(layout, default_layout);
        super(...arguments);
    }
    render() {
        const { x_scale } = this.parent;
        // Apply filters to only render a specified set of points
        let track_data = this.layout.regions.length ? this.layout.regions : this.data;
        track_data.forEach((d, i) => d.id || (d.id = i));
        track_data = this._applyFilters();
        // TODO: Crude synthetic id hack to appease getElementId; can we do better?

        // FIXME: evaluate barriers to merging this with the annotation track. Can it become a highlight region tool?
        const selection = this.svg.group.selectAll(`rect.lz-data_layer-${this.layout.type}`)
            .data(track_data);
        // Draw rectangles (visual and tooltip positioning)
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

        // TODO: What tooltips/ behaviors would be appropriate, if any?
        // // Set up tooltips and mouse interaction
        // this.svg.group
        //     .call(this.applyBehaviors.bind(this));

        // Remove unused elements
    }

    _getTooltipPosition(tooltip) {
        throw new Error('This layer does not support tooltips');
    }
}

export {HighlightRegions as default};
