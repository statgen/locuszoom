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
        // TODO: Configurable options should include styles for lines: color (single, range, multiple, scaleFunction?); weights; fills
        style: {
            fill: 'none',
            'stroke': 'blue',
            'stroke-width': '2px',  // todo explore weighting options based on generated svg
        },
        // start_field: 'peak1',
        // end_field: 'peak2',
        // score_field: 'score'
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

        console.log(this.data, trackData);

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
            .attr('d', function (d,i, a) {
                console.log('data elem iteration', d,i,a);
                // Each individual data point describes a path composed of 3 points, with a spline to smooth the line
                var x1 = d[layout.x_axis.field1];
                var x2 = d[layout.x_axis.field2];
                var xmid = (x1 + x2) / 2;
                var coords = [
                    [x_scale(x1), y_scale(0)],
                    [x_scale(xmid), y_scale(d[layout.y_axis.field])],
                    [x_scale(x2), y_scale(0)]
                ];
                var line = d3.svg.line()
                    .interpolate('basis')
                    .x(function (d) {return d[0];})
                    .y(function (d) {return d[1];});
                return line(coords);
            });

        // Remove old elements as needed
        selection.exit().remove();
        return this;
    };
    return this;

});
