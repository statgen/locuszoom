'use strict';
/**
 * Loop Data Layer
 * Implements a data layer that will render chromatin accessibility tracks. Require start(peak1), start(peak2) and accessibility score
 * @class LocusZoom.DataLayers.accessibility
 * @augments LocusZoom.DataLayer
 */
LocusZoom.DataLayers.add('arc', function(layout) {
    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        start_field: 'peak1',
        end_field: 'peak2',
        score_field: 'score'
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);
    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);
    this.assignTracks = function() {
        this.data.map(function(d, i) {
            // Stash a parent reference
            this.data[i].parent = this;
            // Determine display range start and end
            // bounded by what we can see (range: values in terms of pixels on the screen)
            if (d[this.layout.start_field] < d[this.layout.end_field]) {
                this.data[i].display_range = {
                    start: this.parent.x_scale(Math.max(d[this.layout.start_field], this.state.start)),
                    end:   this.parent.x_scale(Math.min(d[this.layout.end_field], this.state.end))
                };
            }
            else {
                this.data[i].display_range = {
                    start: this.parent.x_scale(Math.min(d[this.layout.end_field], this.state.end)),
                    end: this.parent.x_scale(Math.max(d[this.layout.start_field], this.state.start))
                };
            }
            this.data[i].display_range.width = this.data[i].display_range.end - this.data[i].display_range.start;
            // Convert and stash display range values into domain values
            // (domain: values in terms of the data set, e.g. megabases)
            this.data[i].display_domain = {
                start: this.parent.x_scale.invert(this.data[i].display_range.start),
                end:   this.parent.x_scale.invert(this.data[i].display_range.end)
            };
            this.data[i].display_domain.width = this.data[i].display_domain.end - this.data[i].display_domain.start;
        }.bind(this));
        return this;

    };
    // Implement the main render function
    this.render = function() {
        this.assignTracks();
        this.svg.group.selectAll('g.lz-data_layer-intervals').remove();
        this.svg.group.selectAll('lz-data_layer-intervals').remove();
        // Render interval groups
        var selection = this.svg.group.selectAll('g.lz-data_layer-intervals')
            .data(this.data, function(d) { return d[this.layout.id_field]; }.bind(this));
        selection.enter().append('g')
            .attr('class', 'lz-data_layer-intervals');
        selection.attr('id', function(d) { return this.getElementId(d); }.bind(this))
            .each(function(interval) {
                var data_layer = interval.parent;
                var interpolate = d3.interpolateNumber(150,0);
                var base_val = 148;
                // Render primary interval rects
                var rects = d3.select(this).selectAll('rect.lz-data_layer-intervals.lz-interval_rect')
                    .data([interval]);
                rects.enter().append('polyline')
                    .attr('class', 'lz-data_layer-intervals lz-interval_rect');
                rects
                    .style('stroke', 'green')
                    .style('fill', 'none')
                    .style('stroke-width', 2)
                    .attr('points', function(d) {return[d.display_range.start, base_val, d.display_range.start + (d.display_range.width / 2), interpolate(d[data_layer.layout.score_field]), d.display_range.end, base_val].join(',');});
                rects.exit().remove();
            });
        // Remove old elements as needed
        selection.exit().remove();
        return this;

    };
    return this;

});
