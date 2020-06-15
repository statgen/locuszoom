import d3 from 'd3';
import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';
import Field from '../../data/field';

const default_layout = {
    point_size: 40,
    point_shape: 'square',
    color: '#888888',
    fill_opacity: 1,
    y_axis: {
        axis: 2
    },
    id_field: 'id',
    confidence_intervals: {
        start_field: 'ci_start',
        end_field: 'ci_end'
    },
    show_no_significance_line: true
};

/**
 * Forest Data Layer
 * Implements a standard forest plot. In order to space out points, any layout using this must specify axis ticks
 *  and extent in advance.
 *
 * If you are using dynamically fetched data, consider using `category_forest` instead.
 *
 */
class Forest extends BaseDataLayer {
    constructor(layout) {
        layout = merge(layout, default_layout);
        super(...arguments);
    }

    _getTooltipPosition(tooltip) {
        const x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        const y_scale = 'y' + this.layout.y_axis.axis + '_scale';
        const y_center = this.parent[y_scale](tooltip.data[this.layout.y_axis.field]);

        const point_size = this.resolveScalableParameter(this.layout.point_size, tooltip.data);
        const offset = Math.sqrt(point_size / Math.PI);
        return {
            x_min: x_center - offset,
            x_max: x_center + offset,
            y_min: y_center - offset,
            y_max: y_center + offset
        };
    }

    // Implement the main render function
    render() {

        const x_scale = 'x_scale';
        const y_scale = 'y' + this.layout.y_axis.axis + '_scale';

        // Generate confidence interval paths if fields are defined
        if (this.layout.confidence_intervals
            && this.layout.fields.indexOf(this.layout.confidence_intervals.start_field) !== -1
            && this.layout.fields.indexOf(this.layout.confidence_intervals.end_field) !== -1) {
            // Generate a selection for all forest plot confidence intervals
            const ci_selection = this.svg.group
                .selectAll('rect.lz-data_layer-forest.lz-data_layer-forest-ci')
                .data(this.data, function (d) {
                    return d[this.layout.id_field];
                }.bind(this));
            // Create confidence interval rect elements
            ci_selection.enter()
                .append('rect')
                .attr('class', 'lz-data_layer-forest lz-data_layer-forest-ci')
                .attr('id', function(d) { return this.getElementId(d) + '_ci'; }.bind(this))
                .attr('transform', 'translate(0,' + (isNaN(this.parent.layout.height) ? 0 : this.parent.layout.height) + ')');
            // Apply position and size parameters
            const ci_transform = function (d) {
                let x = this.parent[x_scale](d[this.layout.confidence_intervals.start_field]);
                let y = this.parent[y_scale](d[this.layout.y_axis.field]);
                if (isNaN(x)) {
                    x = -1000;
                }
                if (isNaN(y)) {
                    y = -1000;
                }
                return 'translate(' + x + ',' + y + ')';
            }.bind(this);
            const ci_width = function (d) {
                return this.parent[x_scale](d[this.layout.confidence_intervals.end_field])
                    - this.parent[x_scale](d[this.layout.confidence_intervals.start_field]);
            }.bind(this);
            const ci_height = 1;

            ci_selection
                .attr('transform', ci_transform)
                .attr('width', ci_width).attr('height', ci_height);

            // Remove old elements as needed
            ci_selection.exit().remove();
        }

        // Generate a selection for all forest plot points
        const points_selection = this.svg.group
            .selectAll('path.lz-data_layer-forest.lz-data_layer-forest-point')
            .data(this.data, function (d) {
                return d[this.layout.id_field];
            }.bind(this));

        // Create elements, apply class, ID, and initial position
        const initial_y = isNaN(this.parent.layout.height) ? 0 : this.parent.layout.height;
        points_selection.enter()
            .append('path')
            .attr('class', 'lz-data_layer-forest lz-data_layer-forest-point')
            .attr('id', function(d) { return this.getElementId(d); }.bind(this))
            .attr('transform', 'translate(0,' + initial_y + ')');

        // Generate new values (or functions for them) for position, color, size, and shape
        const transform = function (d) {
            let x = this.parent[x_scale](d[this.layout.x_axis.field]);
            let y = this.parent[y_scale](d[this.layout.y_axis.field]);
            if (isNaN(x)) {
                x = -1000;
            }
            if (isNaN(y)) {
                y = -1000;
            }
            return 'translate(' + x + ',' + y + ')';
        }.bind(this);

        const fill = function (d, i) {
            return this.resolveScalableParameter(this.layout.color, d, i);
        }.bind(this);
        const fill_opacity = function (d, i) {
            return this.resolveScalableParameter(this.layout.fill_opacity, d, i);
        }.bind(this);

        const shape = d3.svg.symbol()
            .size(function (d, i) {
                return this.resolveScalableParameter(this.layout.point_size, d, i);
            }.bind(this))
            .type(function (d, i) {
                return this.resolveScalableParameter(this.layout.point_shape, d, i);
            }.bind(this));

        // Apply position and color
        points_selection
            .attr('transform', transform)
            .attr('fill', fill)
            .attr('fill-opacity', fill_opacity)
            .attr('d', shape);

        // Remove old elements as needed
        points_selection.exit().remove();

        // Apply default event emitters to selection
        points_selection.on('click.event_emitter', function(element_data) {
            this.parent.emit('element_clicked', element_data, true);
        }.bind(this));

        // Apply behaviors to points
        this.applyBehaviors(points_selection);
    }
}


/**
 * A y-aligned forest plot in which the y-axis represents item labels, which are dynamically chosen when data is loaded.
 *   Each item is assumed to include both data and confidence intervals.
 *   This allows generating forest plots without defining the layout in advance.
 *
 */
class CategoryForest extends Forest {
    _getDataExtent(data, axis_config) {
        // In a forest plot, the data range is determined by *three* fields (beta + CI start/end)
        const ci_config = this.layout.confidence_intervals;
        if (ci_config
            && this.layout.fields.indexOf(ci_config.start_field) !== -1
            && this.layout.fields.indexOf(ci_config.end_field) !== -1) {
            const min = function (d) {
                const f = new Field(ci_config.start_field);
                return +f.resolve(d);
            };

            const max = function (d) {
                const f = new Field(ci_config.end_field);
                return +f.resolve(d);
            };

            return [d3.min(data, min), d3.max(data, max)];
        }

        // If there are no confidence intervals set, then range must depend only on a single field
        return super._getDataExtent.call(this, data, axis_config);
    }

    getTicks(dimension, config) { // Overrides parent method
        if (['x', 'y1', 'y2'].indexOf(dimension) === -1) {
            throw new Error('Invalid dimension identifier' + dimension);
        }

        // Design assumption: one axis (y1 or y2) has the ticks, and the layout says which to use
        // Also assumes that every tick gets assigned a unique matching label
        const axis_num = this.layout.y_axis.axis;
        if (dimension === ('y' + axis_num)) {
            const category_field = this.layout.y_axis.category_field;
            if (!category_field) {
                throw new Error('Layout for ' + this.layout.id + ' must specify category_field');
            }

            return this.data.map(function (item, index) {
                return {
                    y: index + 1,
                    text: item[category_field]
                };
            });
        } else {
            return [];
        }
    }

    applyCustomDataMethods () {
        // Add a synthetic yaxis field to ensure data is spread out on plot. Then, set axis floor and ceiling to
        //  correct extents.
        const field_to_add = this.layout.y_axis.field;
        if (!field_to_add) {
            throw new Error('Layout for ' + this.layout.id + ' must specify yaxis.field');
        }

        this.data = this.data.map(function (item, index) {
            item[field_to_add] = index + 1;
            return item;
        });
        // Update axis extents based on one label for every point (with a bit of padding above and below)
        this.layout.y_axis.floor = 0;
        this.layout.y_axis.ceiling = this.data.length + 1;
        return this;
    }
}

export { Forest as forest, CategoryForest as category_forest };
