'use strict';

/**
 * Create a single continuous 2D track that provides information about each datapoint
 *
 * For example, this can be used to color by membership in a group, alongside information in other panels
 *
 * @class LocusZoom.DataLayers.annotation_track
 * @augments LocusZoom.DataLayer
 * @param {Object} layout
 * @param {Object|String} [layout.color]
 * @param {Array[]} An array of filter entries specifying which points to draw annotations for.
 *  See `LocusZoom.DataLayer.filter` for details
 */
LocusZoom.DataLayers.add('annotation_track', function(layout) {
    // In the future we may add additional options for controlling marker size/ shape, based on user feedback
    this.DefaultLayout = {
        color: '#000000',
        filters: [],
        tooltip_positioning: 'middle', // Allowed values: top, middle, bottom
        hitarea_width: 8,
    };

    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    if (!Array.isArray(layout.filters)) {
        throw new Error('Annotation track must specify array of filters for selecting points to annotate');
    }

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    this.render = function() {
        var self = this;
        // Only render points that currently satisfy all provided filter conditions.
        var trackData = this.filter(this.layout.filters, 'elements');

        // Put the <g> containing visible lines before the one containing hit areas, so that the hit areas will be on top.
        var visible_lines_group = this.svg.group.select('g.lz-data_layer-' + self.layout.type + '-visible_lines');
        if (visible_lines_group.size() === 0) {
            visible_lines_group = this.svg.group.append('g').attr('class', 'lz-data_layer-' + self.layout.type + '-visible_lines');
        }
        var selection = visible_lines_group.selectAll('rect.lz-data_layer-' + self.layout.type)
            .data(trackData, function (d) { return d[self.layout.id_field]; });

        // Draw rectangles (visual and tooltip positioning)
        selection.enter()
            .append('rect')
            .attr('class', 'lz-data_layer-' + this.layout.type)
            .attr('id', function (d) { return self.getElementId(d); });

        var width = 1;
        selection
            .attr('x', function (d) {return self.parent['x_scale'](d[self.layout.x_axis.field]) - width / 2; })
            .attr('width', width)
            .attr('height', self.parent.layout.height)
            .attr('fill', function(d, i) { return self.resolveScalableParameter(self.layout.color, d, i); });

        // Remove unused elements
        selection.exit()
            .remove();

        var hit_areas_group = this.svg.group.select('g.lz-data_layer-' + self.layout.type + '-hit_areas');
        if (hit_areas_group.size() === 0) {
            hit_areas_group = this.svg.group.append('g').attr('class', 'lz-data_layer-' + self.layout.type + '-hit_areas');
        }
        var hit_areas_selection = hit_areas_group.selectAll('rect.lz-data_layer-' + self.layout.type)
            .data(trackData, function (d) { return d[self.layout.id_field]; });

        // Add new elements as needed
        hit_areas_selection.enter()
            .append('rect')
            .attr('class', 'lz-data_layer-' + this.layout.type)
            .attr('id', function (d) { return self.getElementId(d); });

        // Update the set of elements to reflect new data

        var _getX = function (d, i) { // Helper for position calcs below
            var x_center = self.parent['x_scale'](d[self.layout.x_axis.field]);
            var x_left = x_center - self.layout.hitarea_width / 2;
            if (i >= 1) {
                // This assumes that the data are in sorted order.
                var left_node = trackData[i - 1];
                var left_node_x_center = self.parent['x_scale'](left_node[self.layout.x_axis.field]);
                x_left = Math.max(x_left, (x_center + left_node_x_center) / 2);
            }
            return [x_left, x_center];
        };
        hit_areas_selection
            .attr('height', self.parent.layout.height)
            .attr('opacity', 0)
            .attr('x', function (d, i) {
                var crds = _getX(d,i);
                return crds[0];
            }).attr('width', function (d, i) {
                var crds = _getX(d,i);
                return (crds[1] - crds[0]) + self.layout.hit_area_width / 2;
            });

        // Remove unused elements
        hit_areas_selection.exit().remove();

        // Set up tooltips and mouse interaction
        this.applyBehaviors(hit_areas_selection);
    };

    // Reimplement the positionTooltip() method to be annotation-specific
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

        var x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        var y_center = data_layer_height / 2;

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
            var position = d3.mouse(this.svg.container.node());
            // Position the tooltip so that it does not overlap the mouse pointer
            top_offset = y_center;
            if (position[1] > (data_layer_height / 2)) {
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

    return this;
});
