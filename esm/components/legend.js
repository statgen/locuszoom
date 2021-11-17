/**
 * @module
 * @private
 */
import * as d3 from 'd3';
import {applyStyles} from '../helpers/common';
import {merge, nameToSymbol} from '../helpers/layouts';

// FIXME: Document legend options
/**
 * The default layout used by legends (used internally)
 * @protected
 * @member {Object}
 */
const default_layout = {
    orientation: 'vertical',
    origin: { x: 0, y: 0 },
    width: 10,
    height: 10,
    padding: 5,
    label_size: 12,
    hidden: false,
};

/**
 * An SVG object used to display contextual information about a panel.
 * Panel layouts determine basic features of a legend - its position in the panel, orientation, title, etc.
 * Layouts of child data layers of the panel determine the actual content of the legend.
 *
 * @param {Panel} parent
*/
class Legend {
    constructor(parent) {
        // if (!(parent instanceof LocusZoom.Panel)) {
        //     throw new Error('Unable to create legend, parent must be a locuszoom panel');
        // }
        /** @member {Panel} */
        this.parent = parent;
        /** @member {String} */
        this.id = `${this.parent.getBaseId()}.legend`;

        this.parent.layout.legend = merge(this.parent.layout.legend || {}, default_layout);
        /** @member {Object} */
        this.layout = this.parent.layout.legend;

        /** @member {d3.selection} */
        this.selector = null;
        /** @member {d3.selection} */
        this.background_rect = null;
        /** @member {d3.selection[]} */
        this.elements = [];
        /**
         * SVG selector for the group containing all elements in the legend
         * @protected
         * @member {d3.selection|null}
         */
        this.elements_group = null;

        /**
         * TODO: Not sure if this property is used; the external-facing methods are setting `layout.hidden` instead. Tentatively mark deprecated.
         * @deprecated
         * @protected
         * @member {Boolean}
         */
        this.hidden = false;

        return this.render();
    }

    /**
     * Render the legend in the parent panel
     */
    render() {
        // Get a legend group selector if not yet defined
        if (!this.selector) {
            this.selector = this.parent.svg.group.append('g')
                .attr('id', `${this.parent.getBaseId()}.legend`).attr('class', 'lz-legend');
        }

        // Get a legend background rect selector if not yet defined
        if (!this.background_rect) {
            this.background_rect = this.selector.append('rect')
                .attr('width', 100)
                .attr('height', 100)
                .attr('class', 'lz-legend-background');
        }

        // Get a legend elements group selector if not yet defined
        if (!this.elements_group) {
            this.elements_group = this.selector.append('g');
        }

        // Remove all elements from the document and re-render from scratch
        this.elements.forEach((element) => element.remove());
        this.elements = [];

        // Gather all elements from data layers in order (top to bottom) and render them
        const padding = +this.layout.padding || 1;
        let x = padding;
        let y = padding;
        let line_height = 0;
        this.parent._data_layer_ids_by_z_index.slice().reverse().forEach((id) => {
            const layer_legend = this.parent.data_layers[id].layout.legend;
            if (Array.isArray(layer_legend)) {
                layer_legend.forEach((element) => {
                    const selector = this.elements_group.append('g')
                        .attr('transform', `translate(${x}, ${y})`);
                    const label_size = +element.label_size || +this.layout.label_size || 12;
                    let label_x = 0;
                    let label_y = (label_size / 2) + (padding / 2);
                    line_height = Math.max(line_height, label_size + padding);
                    // Draw the legend element symbol (line, rect, shape, etc)
                    const shape = element.shape || '';
                    const shape_factory = nameToSymbol(shape);
                    if (shape === 'line') {
                        // Line symbol
                        const length = +element.length || 16;
                        const path_y = (label_size / 4) + (padding / 2);
                        selector
                            .append('path')
                            .attr('class', element.class || '')
                            .attr('d', `M0,${path_y}L${length},${path_y}`)
                            .call(applyStyles, element.style || {});
                        label_x = length + padding;
                    } else if (shape === 'rect') {
                        // Rect symbol
                        const width = +element.width || 16;
                        const height = +element.height || width;
                        selector
                            .append('rect')
                            .attr('class', element.class || '')
                            .attr('width', width)
                            .attr('height', height)
                            .attr('fill', element.color || {})
                            .call(applyStyles, element.style || {});

                        label_x = width + padding;
                        line_height = Math.max(line_height, height + padding);
                    } else if (shape === 'ribbon') {
                        // Color ribbons describe a series of color stops: small boxes of color across a continuous
                        //  scale. Drawn horizontally, or vertically, like:
                        //      [red | orange | yellow | green ] label
                        // For example, this can be used with the numerical-bin color scale to describe LD color stops in a compact way.
                        const width = +element.width || 25;
                        const height = +element.height || width;
                        const is_horizontal = (element.orientation || 'vertical') === 'horizontal';
                        let color_stops = element.color_stops;

                        const all_elements = selector.append('g');
                        const ribbon_group = all_elements.append('g');
                        const axis_group = all_elements.append('g');
                        let axis_offset = 0;
                        if (element.tick_labels) {
                            let range;
                            if (is_horizontal) {
                                range = [0, width * color_stops.length - 1];  // 1 px offset to align tick with inner borders
                            } else {
                                range = [height * color_stops.length - 1, 0];
                            }
                            const scale = d3.scaleLinear()
                                .domain(d3.extent(element.tick_labels)) // Assumes tick labels are always numeric in this mode
                                .range(range);
                            const axis = (is_horizontal ? d3.axisTop : d3.axisRight)(scale)
                                .tickSize(3)
                                .tickValues(element.tick_labels)
                                .tickFormat((v) => v);
                            axis_group.call(axis);
                            let bcr = axis_group.node().getBoundingClientRect();
                            axis_offset = bcr.height;
                        }
                        if (is_horizontal) {
                            // Shift axis down (so that tick marks aren't above the origin)
                            axis_group
                                .attr('transform', `translate(0, ${axis_offset})`);
                            // Ribbon appears below axis
                            ribbon_group
                                .attr('transform', `translate(0, ${axis_offset})`);
                        } else {
                            // Vertical mode: Shift axis ticks to the right of the ribbon
                            all_elements.attr('transform', 'translate(5, 0)');
                            axis_group
                                .attr('transform', `translate(${width}, 0)`);
                        }

                        if (!is_horizontal) {
                            //  Vertical mode: renders top -> bottom but scale is usually specified low..high
                            color_stops = color_stops.slice();
                            color_stops.reverse();
                        }
                        for (let i = 0; i < color_stops.length; i++) {
                            const color = color_stops[i];
                            const to_next_marking = is_horizontal ? `translate(${width * i}, 0)` : `translate(0, ${height * i})`;
                            ribbon_group
                                .append('rect')
                                .attr('class', element.class || '')
                                .attr('stroke', 'black')
                                .attr('transform', to_next_marking)
                                .attr('stroke-width', 0.5)
                                .attr('width', width)
                                .attr('height', height)
                                .attr('fill', color)
                                .call(applyStyles, element.style || {});
                        }

                        // Note: In vertical mode, it's usually easier to put the label above the legend as a separate marker
                        //  This is because the legend element label is drawn last (can't use it's size to position the ribbon, which is drawn first)
                        if (!is_horizontal && element.label) {
                            throw new Error('Legend labels not supported for vertical ribbons (use a separate legend item as text instead)');
                        }
                        // This only makes sense for horizontal labels.
                        label_x = (width * color_stops.length + padding);
                        label_y += axis_offset;
                    } else if (shape_factory) {
                        // Shape symbol is a recognized d3 type, so we can draw it in the legend (circle, diamond, etc.)
                        const size = +element.size || 40;
                        const radius = Math.ceil(Math.sqrt(size / Math.PI));
                        selector
                            .append('path')
                            .attr('class', element.class || '')
                            .attr('d', d3.symbol().size(size).type(shape_factory))
                            .attr('transform', `translate(${radius}, ${radius + (padding / 2)})`)
                            .attr('fill', element.color || {})
                            .call(applyStyles, element.style || {});

                        label_x = (2 * radius) + padding;
                        label_y = Math.max((2 * radius) + (padding / 2), label_y);
                        line_height = Math.max(line_height, (2 * radius) + padding);
                    }
                    // Draw the legend element label
                    selector
                        .append('text')
                        .attr('text-anchor', 'left')
                        .attr('class', 'lz-label')
                        .attr('x', label_x)
                        .attr('y', label_y)
                        .style('font-size', label_size)
                        .text(element.label);

                    // Position the legend element group based on legend layout orientation
                    const bcr = selector.node().getBoundingClientRect();
                    if (this.layout.orientation === 'vertical') {
                        y += bcr.height + padding;
                        line_height = 0;
                    } else {
                        // Ensure this element does not exceed the panel width
                        // (E.g. drop to the next line if it does, but only if it's not the only element on this line)
                        const right_x = this.layout.origin.x + x + bcr.width;
                        if (x > padding && right_x > this.parent.parent.layout.width) {
                            y += line_height;
                            x = padding;
                            selector.attr('transform', `translate(${x}, ${y})`);
                        }
                        x += bcr.width + (3 * padding);
                    }
                    // Store the element
                    this.elements.push(selector);
                });
            }
        });

        // Scale the background rect to the elements in the legend
        const bcr = this.elements_group.node().getBoundingClientRect();
        this.layout.width = bcr.width + (2 * this.layout.padding);
        this.layout.height = bcr.height + (2 * this.layout.padding);
        this.background_rect
            .attr('width', this.layout.width)
            .attr('height', this.layout.height);

        // Set the visibility on the legend from the "hidden" flag
        // TODO: `show()` and `hide()` call a full rerender; might be able to make this more lightweight?
        this.selector
            .style('visibility', this.layout.hidden ? 'hidden' : 'visible');

        return this.position();
    }

    /**
     * Place the legend in position relative to the panel, as specified in the layout configuration
     * @returns {Legend | null}
     * TODO: should this always be chainable?
     */
    position() {
        if (!this.selector) {
            return this;
        }
        const bcr = this.selector.node().getBoundingClientRect();
        if (!isNaN(+this.layout.pad_from_bottom)) {
            this.layout.origin.y = this.parent.layout.height - bcr.height - +this.layout.pad_from_bottom;
        }
        if (!isNaN(+this.layout.pad_from_right)) {
            this.layout.origin.x = this.parent.parent.layout.width - bcr.width - +this.layout.pad_from_right;
        }
        this.selector.attr('transform', `translate(${this.layout.origin.x}, ${this.layout.origin.y})`);
    }

    /**
     * Hide the legend (triggers a re-render)
     * @public
     */
    hide() {
        this.layout.hidden = true;
        this.render();
    }

    /**
     * Show the legend (triggers a re-render)
     * @public
     */
    show() {
        this.layout.hidden = false;
        this.render();
    }
}

export {Legend as default};
