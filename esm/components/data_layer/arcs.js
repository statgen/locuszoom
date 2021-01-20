/**
 * @module LocusZoom_DataLayers
 */
import * as d3 from 'd3';

import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';
import {applyStyles} from '../../helpers/common';

const default_layout = {
    color: 'seagreen',
    hitarea_width: '10px',
    style: {
        fill: 'none',
        'stroke-width': '1px',
        'stroke-opacity': '100%',
    },
    tooltip_positioning: 'top',
};

/**
 * Arc Data Layer
 * Implements a data layer that will render chromatin accessibility tracks.
 * This layer draws arcs (one per datapoint) that connect two endpoints (x.field1 and x.field2) by means of an arc,
 *  with a height determined by y.field.
 */
class Arcs extends BaseDataLayer {
    constructor(layout) {
        layout = merge(layout, default_layout);
        super(...arguments);
    }

    // Implement the main render function
    render() {
        const self = this;
        const layout = self.layout;
        const x_scale = self.parent['x_scale'];
        const y_scale = self.parent[`y${layout.y_axis.axis}_scale`];

        // Apply filters to only render a specified set of points
        const track_data = this._applyFilters();

        // Helper: Each individual data point describes a path composed of 3 points, with a spline to smooth the line
        function _make_line(d) {
            const x1 = d[layout.x_axis.field1];
            const x2 = d[layout.x_axis.field2];
            const xmid = (x1 + x2) / 2;
            const coords = [
                [x_scale(x1), y_scale(0)],
                [x_scale(xmid), y_scale(d[layout.y_axis.field])],
                [x_scale(x2), y_scale(0)],
            ];
            // Smoothing options: https://bl.ocks.org/emmasaunders/f7178ed715a601c5b2c458a2c7093f78
            const line = d3.line()
                .x((d) => d[0])
                .y((d) => d[1])
                .curve(d3.curveNatural);
            return line(coords);
        }

        // Draw real lines, and also invisible hitareas for easier mouse events
        const hitareas = this.svg.group
            .selectAll('path.lz-data_layer-arcs-hitarea')
            .data(track_data, (d) => this.getElementId(d));

        const selection = this.svg.group
            .selectAll('path.lz-data_layer-arcs')
            .data(track_data, (d) => this.getElementId(d));

        this.svg.group
            .call(applyStyles, layout.style);

        hitareas
            .enter()
            .append('path')
            .attr('class', 'lz-data_layer-arcs-hitarea')
            .merge(hitareas)
            .attr('id', (d) => this.getElementId(d))
            .style('fill', 'none')
            .style('stroke-width', layout.hitarea_width)
            .style('stroke-opacity', 0)
            .style('stroke', 'transparent')
            .attr('d', (d) => _make_line(d));

        // Add new points as necessary
        selection
            .enter()
            .append('path')
            .attr('class', 'lz-data_layer-arcs')
            .merge(selection)
            .attr('id', (d) => this.getElementId(d))
            .attr('stroke', (d, i) => this.resolveScalableParameter(this.layout.color, d, i))
            .attr('d', (d, i) => _make_line(d));

        // Remove old elements as needed
        selection.exit()
            .remove();

        hitareas.exit()
            .remove();

        // Apply mouse behaviors to arcs
        this.svg.group
            .call(this.applyBehaviors.bind(this));

        return this;
    }

    _getTooltipPosition(tooltip) {
        // Center the tooltip arrow at the apex of the arc. Sometimes, only part of an arc shows on the screen, so we
        //  clean up these values to ensure that the tooltip will appear within the window.
        const panel = this.parent;
        const layout = this.layout;

        const x1 = tooltip.data[layout.x_axis.field1];
        const x2 = tooltip.data[layout.x_axis.field2];

        const y_scale = panel[`y${layout.y_axis.axis}_scale`];

        return {
            x_min: panel.x_scale(Math.min(x1, x2)),
            x_max: panel.x_scale(Math.max(x1, x2)),
            y_min: y_scale(tooltip.data[layout.y_axis.field]),
            y_max: y_scale(0),
        };
    }

}

export {Arcs as default};
