'use strict';
/**
 * Loop Data Layer
 * Implements a data layer that will render chromatin accessibility tracks. Require start(peak1), start(peak2) and accessibility score
 * @class LocusZoom.DataLayers.accessibility
 * @augments LocusZoom.DataLayer
 */
LocusZoom.DataLayers.add('arcs', function(layout) {
    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        color: 'seagreen',
        style: {
            fill: 'none',
            'stroke-width': '2px',
            'stroke-opacity': '100%',
        },
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);
    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Implement the main render function
    this.render = function() {
        var self = this;
        var layout = self.layout;
        var x_scale = self.parent['x_scale'];
        var y_scale = self.parent['y' + layout.y_axis.axis + '_scale'];

        // Optionally restrict the data to a specific set of filters
        var filters = layout.filters || [];
        var trackData = this.filter(filters, 'elements');

        var selection = this.svg.group
            .selectAll('path.lz-data_layer-arcs')
            .data(trackData, function(d) {
                return self.getElementId(d);
            });
        // Add new points as necessary
        selection
            .enter()
            .append('path')
            .attr('class', 'lz-data_layer-arcs')
            .attr('id', function(d) { return self.getElementId(d); });

        // Update selection/set coordinates
        selection
            .style(layout.style) // TODO provide a way to configure item color, filters, other scalable directives
            .attr('stroke', function(d, i) {
                return self.resolveScalableParameter(self.layout.color, d, i);
            })
            .attr('d', function (d, i) {
                // Each individual data point describes a path composed of 3 points, with a spline to smooth the line
                var x1 = d[layout.x_axis.field1];
                var x2 = d[layout.x_axis.field2];
                var xmid = (x1 + x2) / 2;
                var coords = [
                    [x_scale(x1), y_scale(0)],
                    [x_scale(xmid), y_scale(d[layout.y_axis.field])],
                    [x_scale(x2), y_scale(0)]
                ];
                // Smoothing options: https://bl.ocks.org/emmasaunders/f7178ed715a601c5b2c458a2c7093f78
                var line = d3.svg.line()
                    .interpolate('monotone')
                    .x(function (d) {return d[0];})
                    .y(function (d) {return d[1];});
                return line(coords);
            });

        // Remove old elements as needed
        selection.exit().remove();

        // Apply default event emitters to selection
        selection.on('click.event_emitter', function(element) {
            this.parent.emit('element_clicked', element, true);
        }.bind(this));

        // Apply mouse behaviors
        this.applyBehaviors(selection);

        return this;
    };

    this.positionTooltip = function(id) {
        if (typeof id != 'string') {
            throw new Error('Unable to position tooltip: id is not a string');
        }
        if (!this.tooltips[id]) {
            throw new Error('Unable to position tooltip: id does not point to a valid tooltip');
        }
        var top, left, arrow_type, arrow_top, arrow_left;
        var tooltip = this.tooltips[id];
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var offset = stroke_width / 2;
        var page_origin = this.getPageOrigin();

        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);

        var xmid = (tooltip.data[this.layout.x_axis.field1] + tooltip.data[this.layout.x_axis.field2]) / 2;
        var y_scale = this.parent['y' + layout.y_axis.axis + '_scale'];

        var x_center = this.parent.x_scale(xmid);
        var y_center = y_scale(tooltip.data[this.layout.y_axis.field]);

        // Tooltip should be horizontally centered above the point to be annotated. (or below if space is limited)
        var offset_right = Math.max((tooltip_box.width / 2) - x_center, 0);
        var offset_left = Math.max((tooltip_box.width / 2) + x_center - data_layer_width, 0);
        left = page_origin.x + x_center - (tooltip_box.width / 2) - offset_left + offset_right;
        arrow_left = (tooltip_box.width / 2) - (arrow_width) + offset_left - offset_right - offset;

        var top_offset = 0;
        switch(this.layout.tooltip_positioning) {
        case 'top':
            arrow_type = 'down';
            break;
        case 'bottom':
            top_offset = data_layer_height;
            arrow_type = 'up';
            break;
        case 'middle':
        default:
            // var position = d3.mouse(this.svg.container.node());
            // Position the tooltip so that it does not overlap the mouse pointer
            top_offset = y_center;
            if (y_center > (data_layer_height / 2)) {
                arrow_type = 'down';
            } else {
                arrow_type = 'up';
            }
        }

        if (arrow_type === 'up') {
            top = page_origin.y + top_offset + stroke_width + arrow_width;
            arrow_top = 0 - stroke_width - arrow_width;
        } else if (arrow_type === 'down') {
            top = page_origin.y + top_offset - (tooltip_box.height + stroke_width + arrow_width);
            arrow_top = tooltip_box.height - stroke_width;
        }

        // Apply positions to the main div
        tooltip.selector.style('left', left + 'px').style('top', top + 'px');
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow) {
            tooltip.arrow = tooltip.selector.append('div').style('position', 'absolute');
        }
        tooltip.arrow
            .attr('class', 'lz-data_layer-tooltip-arrow_' + arrow_type)
            .style('left', arrow_left + 'px')
            .style('top', arrow_top + 'px');
    };
    // End constructor
    return this;
});
