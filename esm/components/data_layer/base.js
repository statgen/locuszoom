/** @module */
import * as d3 from 'd3';

import {STATUSES} from '../constants';
import Field from '../../data/field';
import {parseFields} from '../../helpers/display';
import {merge} from '../../helpers/layouts';
import scalable from '../../registry/scalable';


/**
 * A basic description of keys expected in a layout. Not intended to be directly used or modified by an end user.
 * @protected
 * @type {{type: string, fields: Array, x_axis: {}, y_axis: {}}}
 */
const default_layout = {
    type: '',
    fields: [],
    x_axis: {},
    y_axis: {},
    // Not every layer allows this attribute, but it is available for the default implementation
    tooltip_positioning: 'horizontal',
};


/**
 * A data layer is an abstract class representing a data set and its graphical representation within a panel
 * @public
 * @param {Object} layout A JSON-serializable object describing the layout for this layer
 * @param {Panel|null} parent Where this layout is used
*/
class BaseDataLayer {
    constructor(layout, parent) {
        /** @member {Boolean} */
        this.initialized = false;
        /** @member {Number} */
        this.layout_idx = null;

        /** @member {String} */
        this.id     = null;
        /** @member {Panel} */
        this.parent = parent || null;
        /**
         * @member {{group: d3.selection, container: d3.selection, clipRect: d3.selection}}
         */
        this.svg    = {};

        /** @member {LocusZoom.Plot} */
        this.parent_plot = null;
        if (parent) {
            this.parent_plot = parent.parent;
        }

        /** @member {Object} */
        this.layout = merge(layout || {}, default_layout);
        if (this.layout.id) {
            this.id = this.layout.id;
        }

        // Ensure any axes defined in the layout have an explicit axis number (default: 1)
        if (this.layout.x_axis !== {} && typeof this.layout.x_axis.axis !== 'number') {
            this.layout.x_axis.axis = 1;
        }
        if (this.layout.y_axis !== {} && typeof this.layout.y_axis.axis !== 'number') {
            this.layout.y_axis.axis = 1;
        }

        /**
         * Values in the layout object may change during rendering etc. Retain a copy of the original data layer state
         * @member {Object}
         */
        this._base_layout = JSON.parse(JSON.stringify(this.layout));

        /** @member {Object} */
        this.state = {};
        /** @member {String} */
        this.state_id = null;

        /** @member {Object} */
        this.layer_state = null;
        // Create a default state (and set any references to the parent as appropriate)
        this._setDefaultState();

        // Initialize parameters for storing data and tool tips
        /** @member {Array} */
        this.data = [];
        if (this.layout.tooltip) {
            /** @member {Object} */
            this.tooltips = {};
        }

        // Initialize flags for tracking global statuses
        this.global_statuses = {
            'highlighted': false,
            'selected': false,
            'faded': false,
            'hidden': false
        };
    }

    /**
     * Instruct this datalayer to begin tracking additional fields from data sources (does not guarantee that such a field actually exists)
     *
     * Custom plots can use this to dynamically extend datalayer functionality after the plot is drawn
     *
     *  (since removing core fields may break layer functionality, there is presently no hook for the inverse behavior)
     * @param fieldName
     * @param namespace
     * @param {String|String[]} transformations The name (or array of names) of transformations to apply to this field
     * @returns {String} The raw string added to the fields array
     */
    addField (fieldName, namespace, transformations) {
        if (!fieldName || !namespace) {
            throw new Error('Must specify field name and namespace to use when adding field');
        }
        let fieldString = `${namespace}:${fieldName}`;
        if (transformations) {
            fieldString += '|';
            if (typeof transformations === 'string') {
                fieldString += transformations;
            } else if (Array.isArray(transformations)) {
                fieldString += transformations.join('|');
            } else {
                throw new Error('Must provide transformations as either a string or array of strings');
            }
        }
        const fields = this.layout.fields;
        if (!fields.includes(fieldString)) {
            fields.push(fieldString);
        }
        return fieldString;
    }

    /**
     * Define default state that should get tracked during the lifetime of this layer.
     *
     * In some special custom usages, it may be useful to completely reset a panel (eg "click for
     *   genome region" links), plotting new data that invalidates any previously tracked state.  This hook makes it
     *   possible to reset without destroying the panel entirely. It is used by `Plot.clearPanelData`.
     */
    _setDefaultState() {
        // Each datalayer tracks two kinds of status: flags for internal state (highlighted, selected, tooltip),
        //  and "extra fields" (annotations like "show a tooltip" that are not determined by the server, but need to
        //  persist across re-render)
        const layer_state = { status_flags: {}, extra_fields: {} };
        const status_flags = layer_state.status_flags;
        STATUSES.adjectives.forEach((status) => {
            status_flags[status] = status_flags[status] || [];
        });
        // Also initialize "internal-only" state fields (things that are tracked, but not set directly by external events)
        status_flags['has_tooltip'] = status_flags['has_tooltip'] || [];

        if (this.parent) {
            // If layer has a parent, store a reference in the overarching plot.state object
            this.state_id = `${this.parent.id}.${this.id}`;
            this.state = this.parent.state;
            this.state[this.state_id] = layer_state;
        }
        this.layer_state = layer_state;
    }

    /**
     * Get the fully qualified identifier for the data layer, prefixed by any parent or container elements
     *
     * @returns {string} A dot-delimited string of the format <plot>.<panel>.<data_layer>
     */
    getBaseId () {
        if (this.parent) {
            return `${this.parent_plot.id}.${this.parent.id}.${this.id}`;
        } else {
            return '';
        }
    }

    /**
     * Determine the pixel height of data-bound objects represented inside this data layer. (excluding elements such as axes)
     *
     * May be used by operations that resize the data layer to fit available data
     *
     * @public
     * @returns {number}
     */
    getAbsoluteDataHeight() {
        const dataBCR = this.svg.group.node().getBoundingClientRect();
        return dataBCR.height;
    }

    /**
     * Fetch the fully qualified ID to be associated with a specific visual element, based on the data to which that
     *   element is bound. In general this element ID will be unique, allowing it to be addressed directly via selectors.
     * @param {String|Object} element
     * @returns {String}
     */
    getElementId (element) {
        let element_id = 'element';
        if (typeof element == 'string') {
            element_id = element;
        } else if (typeof element == 'object') {
            const id_field = this.layout.id_field || 'id';
            if (typeof element[id_field] == 'undefined') {
                throw new Error('Unable to generate element ID');
            }
            element_id = element[id_field].toString().replace(/\W/g,'');
        }
        return (`${this.getBaseId()}-${element_id}`).replace(/([:.[\],])/g, '_');
    }

    /**
     * Fetch an ID that may bind a data element to a separate visual node for displaying status
     * Examples of this might be seperate visual nodes to show select/highlight statuses, or
     * even a common/shared node to show status across many elements in a set.
     * Abstract method. It should be overridden by data layers that implement seperate status
     * nodes specifically to the use case of the data layer type.
     * @param {String|Object} element
     * @returns {String|null}
     */
    getElementStatusNodeId (element) {
        return null;
    }

    /**
     * Returns a reference to the underlying data associated with a single visual element in the data layer, as
     *   referenced by the unique identifier for the element

     * @param {String} id The unique identifier for the element, as defined by `getElementId`
     * @returns {Object|null} The data bound to that element
     */
    getElementById(id) {
        const selector = d3.select(`#${id.replace(/([:.[\],])/g, '\\$1')}`); // escape special characters
        if (!selector.empty() && selector.data() && selector.data().length) {
            return selector.data()[0];
        } else {
            return null;
        }
    }

    /**
     * Basic method to apply arbitrary methods and properties to data elements.
     *   This is called on all data immediately after being fetched.
     * @returns {BaseDataLayer}
     */
    applyDataMethods() {
        const field_to_match = (this.layout.match && this.layout.match.receive);
        const broadcast_value = this.parent_plot.state.lz_match_value;

        this.data.forEach((item, i) => {
            // Basic toHTML() method - return the stringified value in the id_field, if defined.

            // When this layer receives data, mark whether points match (via a synthetic boolean field)
            //   Any field-based layout directives (color, size, shape) can then be used to control display
            if (field_to_match && broadcast_value !== null && broadcast_value !== undefined) {
                item.lz_highlight_match = (item[field_to_match] === broadcast_value);
            }

            item.toHTML = () => {
                const id_field = this.layout.id_field || 'id';
                let html = '';
                if (item[id_field]) {
                    html = item[id_field].toString();
                }
                return html;
            };
            // Helper methods - return a reference to various plot levels. Useful for interactive tooltips.
            item.getDataLayer = () => this;
            item.getPanel = () => this.parent || null;
            item.getPlot = () => {
                // For unit testing etc, this layer may be created without a parent.
                const panel = this.parent;
                return panel ? panel.parent : null;
            };
            // deselect() method - shortcut method to deselect the element
            item.deselect = () => {
                const data_layer = this.getDataLayer();
                data_layer.unselectElement(this); // dynamically generated method name. It exists, honest.
            };
        });
        this.applyCustomDataMethods();
        return this;
    }

    /**
     * Hook that allows custom datalayers to apply additional methods and properties to data elements as needed
     * @returns {BaseDataLayer}
     */
    applyCustomDataMethods() {
        return this;
    }

    /**
     * Initialize a data layer
     * @returns {BaseDataLayer}
     */
    initialize() {

        // Append a container group element to house the main data layer group element and the clip path
        const base_id = this.getBaseId();
        this.svg.container = this.parent.svg.group.append('g')
            .attr('class', 'lz-data_layer-container')
            .attr('id', `${base_id}.data_layer_container`);

        // Append clip path to the container element
        this.svg.clipRect = this.svg.container.append('clipPath')
            .attr('id', `${base_id}.clip`)
            .append('rect');

        // Append svg group for rendering all data layer elements, clipped by the clip path
        this.svg.group = this.svg.container.append('g')
            .attr('id', `${base_id}.data_layer`)
            .attr('clip-path', `url(#${base_id}.clip)`);

        return this;

    }

    /**
     * Move a data layer up relative to others by z-index
     * @returns {BaseDataLayer}
     */
    moveUp() {
        if (this.parent.data_layer_ids_by_z_index[this.layout.z_index + 1]) {
            this.parent.data_layer_ids_by_z_index[this.layout.z_index] = this.parent.data_layer_ids_by_z_index[this.layout.z_index + 1];
            this.parent.data_layer_ids_by_z_index[this.layout.z_index + 1] = this.id;
            this.parent.resortDataLayers();
        }
        return this;
    }

    /**
     * Move a data layer down relative to others by z-index
     * @returns {BaseDataLayer}
     */
    moveDown() {
        if (this.parent.data_layer_ids_by_z_index[this.layout.z_index - 1]) {
            this.parent.data_layer_ids_by_z_index[this.layout.z_index] = this.parent.data_layer_ids_by_z_index[this.layout.z_index - 1];
            this.parent.data_layer_ids_by_z_index[this.layout.z_index - 1] = this.id;
            this.parent.resortDataLayers();
        }
        return this;
    }

    /**
     * Apply scaling functions to an element as needed, based on the layout rules governing display + the element's data
     * If the layout parameter is already a primitive type, simply return the value as given
     *
     * In the future this may be further expanded, so that scaling functions can operate similar to mappers
     *  (item, index, array). Additional arguments would be added as the need arose.
     * @param {Array|Number|String|Object} layout Either a scalar ("color is red") or a configuration object
     *  ("rules for how to choose color based on item value")
     * @param {*} element_data The value to be used with the filter. May be a primitive value, or a data object for a single item
     * @param {Number} data_index The array index for the data element
     * @returns {*} The transformed value
     */
    resolveScalableParameter (layout, element_data, data_index) {
        let ret = null;
        if (Array.isArray(layout)) {
            let idx = 0;
            while (ret === null && idx < layout.length) {
                ret = this.resolveScalableParameter(layout[idx], element_data, data_index);
                idx++;
            }
        } else {
            switch (typeof layout) {
            case 'number':
            case 'string':
                ret = layout;
                break;
            case 'object':
                if (layout.scale_function) {
                    const func = scalable.get(layout.scale_function);
                    if (layout.field) {
                        const f = new Field(layout.field);
                        let extra;
                        try {
                            extra = this.layer_state && this.layer_state.extra_fields[this.getElementId(element_data)];
                        } catch (e) {
                            extra = null;
                        }
                        ret = func(layout.parameters || {}, f.resolve(element_data, extra), data_index);
                    } else {
                        ret = func(layout.parameters || {}, element_data, data_index);
                    }
                }
                break;
            }
        }
        return ret;
    }

    /**
     * Implementation hook for fetching the min and max values of available data. Used to determine axis range, if no other
     *   explicit axis settings override. Useful for data layers where the data extent depends on more than one field.
     *   (eg confidence intervals in a forest plot)
     * @param data
     * @param axis_config The configuration object for the specified axis.
     * @returns {Array} [min, max] without any padding applied
     * @private
     */
    _getDataExtent (data, axis_config) {
        data = data || this.data;
        // By default this depends only on a single field.
        return d3.extent(data, (d) => {
            const f = new Field(axis_config.field);
            return +f.resolve(d);
        });
    }

    /**
     * Generate dimension extent function based on layout parameters
     * @param {('x'|'y')} dimension
     */
    getAxisExtent (dimension) {

        if (!['x', 'y'].includes(dimension)) {
            throw new Error('Invalid dimension identifier');
        }

        const axis_name = `${dimension}_axis`;
        const axis_layout = this.layout[axis_name];

        // If a floor AND a ceiling are explicitly defined then just return that extent and be done
        if (!isNaN(axis_layout.floor) && !isNaN(axis_layout.ceiling)) {
            return [+axis_layout.floor, +axis_layout.ceiling];
        }

        // If a field is defined for the axis and the data layer has data then generate the extent from the data set
        let data_extent = [];
        if (axis_layout.field && this.data) {
            if (!this.data.length) {
                // If data has been fetched (but no points in region), enforce the min_extent (with no buffers,
                //  because we don't need padding around an empty screen)
                data_extent = axis_layout.min_extent || [];
                return data_extent;
            } else {
                data_extent = this._getDataExtent(this.data, axis_layout);

                // Apply upper/lower buffers, if applicable
                const original_extent_span = data_extent[1] - data_extent[0];
                if (!isNaN(axis_layout.lower_buffer)) {
                    data_extent[0] -= original_extent_span * axis_layout.lower_buffer;
                }
                if (!isNaN(axis_layout.upper_buffer)) {
                    data_extent[1] += original_extent_span * axis_layout.upper_buffer;
                }

                if (typeof axis_layout.min_extent == 'object') {
                    // The data should span at least the range specified by min_extent, an array with [low, high]
                    const range_min = axis_layout.min_extent[0];
                    const range_max = axis_layout.min_extent[1];
                    if (!isNaN(range_min) && !isNaN(range_max)) {
                        data_extent[0] = Math.min(data_extent[0], range_min);
                    }
                    if (!isNaN(range_max)) {
                        data_extent[1] = Math.max(data_extent[1], range_max);
                    }
                }
                // If specified, floor and ceiling will override the actual data range
                return [
                    isNaN(axis_layout.floor) ? data_extent[0] : axis_layout.floor,
                    isNaN(axis_layout.ceiling) ? data_extent[1] : axis_layout.ceiling
                ];
            }
        }

        // If this is for the x axis and no extent could be generated yet but state has a defined start and end
        // then default to using the state-defined region as the extent
        if (dimension === 'x' && !isNaN(this.state.start) && !isNaN(this.state.end)) {
            return [this.state.start, this.state.end];
        }

        // No conditions met for generating a valid extent, return an empty array
        return [];

    }

    /**
     * Allow this data layer to tell the panel what axis ticks it thinks it will require. The panel may choose whether
     *   to use some, all, or none of these when rendering, either alone or in conjunction with other data layers.
     *
     *   This method is a stub and should be overridden in data layers that need to specify custom behavior.
     *
     * @param {('x'|'y1'|'y2')} dimension
     * @param {Object} [config] Additional parameters for the panel to specify how it wants ticks to be drawn. The names
     *   and meanings of these parameters may vary between different data layers.
     * @returns {Object[]}
     *   An array of objects: each object must have an 'x' attribute to position the tick.
     *   Other supported object keys:
     *     * text: string to render for a given tick
     *     * style: d3-compatible CSS style object
     *     * transform: SVG transform attribute string
     *     * color: string or LocusZoom scalable parameter object
     */
    getTicks (dimension, config) {
        if (!['x', 'y1', 'y2'].includes(dimension)) {
            throw new Error(`Invalid dimension identifier ${dimension}`);
        }
        return [];
    }

    /**
     * Generate a tool tip for a given element
     * @param {String|Object} data Data for the element associated with the tooltip
     */
    createTooltip (data) {
        if (typeof this.layout.tooltip != 'object') {
            throw new Error(`DataLayer [${this.id}] layout does not define a tooltip`);
        }
        const id = this.getElementId(data);
        if (this.tooltips[id]) {
            this.positionTooltip(id);
            return;
        }
        this.tooltips[id] = {
            data: data,
            arrow: null,
            selector: d3.select(this.parent_plot.svg.node().parentNode).append('div')
                .attr('class', 'lz-data_layer-tooltip')
                .attr('id', `${id}-tooltip`)
        };
        this.layer_state.status_flags['has_tooltip'].push(id);
        this.updateTooltip(data);
        return this;
    }

    /**
     * Update a tool tip (generate its inner HTML)
     * @param {String|Object} d The element associated with the tooltip
     * @param {String} [id] An identifier to the tooltip
     */
    updateTooltip(d, id) {
        if (typeof id == 'undefined') {
            id = this.getElementId(d);
        }
        // Empty the tooltip of all HTML (including its arrow!)
        this.tooltips[id].selector.html('');
        this.tooltips[id].arrow = null;
        // Set the new HTML
        if (this.layout.tooltip.html) {
            this.tooltips[id].selector.html(parseFields(d, this.layout.tooltip.html));
        }
        // If the layout allows tool tips on this data layer to be closable then add the close button
        // and add padding to the tooltip to accommodate it
        if (this.layout.tooltip.closable) {
            this.tooltips[id].selector.insert('button', ':first-child')
                .attr('class', 'lz-tooltip-close-button')
                .attr('title', 'Close')
                .text('×')
                .on('click', () => {
                    this.destroyTooltip(id);
                });
        }
        // Apply data directly to the tool tip for easier retrieval by custom UI elements inside the tool tip
        this.tooltips[id].selector.data([d]);
        // Reposition and draw a new arrow
        this.positionTooltip(id);
        return this;
    }

    /**
     * Destroy tool tip - remove the tool tip element from the DOM and delete the tool tip's record on the data layer
     * @param {String|Object} element_or_id The element (or id) associated with the tooltip
     * @param {boolean} [temporary=false] Whether this is temporary (not to be tracked in state). Differentiates
     *  "recreate tooltips on re-render" (which is temporary) from "user has closed this tooltip" (permanent)
     * @returns {BaseDataLayer}
     */
    destroyTooltip(element_or_id, temporary) {
        let id;
        if (typeof element_or_id == 'string') {
            id = element_or_id;
        } else {
            id = this.getElementId(element_or_id);
        }
        if (this.tooltips[id]) {
            if (typeof this.tooltips[id].selector == 'object') {
                this.tooltips[id].selector.remove();
            }
            delete this.tooltips[id];
        }
        // When a tooltip is removed, also remove the reference from the state
        if (!temporary) {
            const state = this.layer_state.status_flags['has_tooltip'];
            const label_mark_position = state.indexOf(id);
            state.splice(label_mark_position, 1);
        }
        return this;
    }

    /**
     * Loop through and destroy all tool tips on this data layer
     * @returns {BaseDataLayer}
     */
    destroyAllTooltips() {
        for (let id in this.tooltips) {
            this.destroyTooltip(id, true);
        }
        return this;
    }

    /**
     * Position and then redraw tool tip - naïve function to place a tool tip in the data layer. By default, positions wrt
     *   the top-left corner of the data layer.
     *
     * Each layer type may have more specific logic. Consider overriding the provided hooks `_getTooltipPosition` or
     *  `_drawTooltip` as appropriate
     *
     * @param {String} id The identifier of the tooltip to position
     * @returns {BaseDataLayer}
     */
    positionTooltip(id) {
        if (typeof id != 'string') {
            throw new Error('Unable to position tooltip: id is not a string');
        }
        if (!this.tooltips[id]) {
            throw new Error('Unable to position tooltip: id does not point to a valid tooltip');
        }
        const tooltip = this.tooltips[id];
        const coords = this._getTooltipPosition(tooltip);

        if (!coords) {
            // Special cutout: normally, tooltips are positioned based on the datum element. Some, like lines/curves,
            //  work better if based on a mouse event. Since not every redraw contains a mouse event, we can just skip
            //  calculating position when no position information is available.
            return null;
        }
        this._drawTooltip(tooltip, this.layout.tooltip_positioning, coords.x_min, coords.x_max, coords.y_min, coords.y_max);
    }

    /**
     * Determine the coordinates for where to point the tooltip at. Typically, this is the center of a datum element (eg,
     *  the middle of a scatter plot point). Also provide an offset if the tooltip should not be at that center (most
     *  elements are not single points, eg a scatter plot point has a radius and a gene is a rectangle).
     *  The default implementation is quite naive: it places the tooltip at the origin for that layer. Individual layers
     *    should override this method to position relative to the chosen data element or mouse event.
     * @param {Object} tooltip A tooltip object (including attribute tooltip.data)
     * @returns {Object} as {x_min, x_max, y_min, y_max} in px, representing bounding box of a rectangle around the data pt
     *  Note that these pixels are in the SVG coordinate system
     */
    _getTooltipPosition(tooltip) {
        const panel = this.parent;

        const y_scale = panel[`y${this.layout.y_axis.axis}_scale`];
        const y_extent = panel[`y${this.layout.y_axis.axis}_extent`];

        const x = panel.x_scale(panel.x_extent[0]);
        const y = y_scale(y_extent[0]);

        return { x_min: x, x_max: x, y_min: y, y_max: y };
    }

    /**
     * Draw a tooltip on the data layer pointed at the specified coordinates, in the specified orientation.
     *  Tooltip will be drawn on the edge of the major axis, and centered along the minor axis- see diagram.
     *   v
     * > o <
     *   ^
     *
     * @param tooltip {Object} The object representing all data for the tooltip to be drawn
     * @param {'vertical'|'horizontal'|'top'|'bottom'|'left'|'right'} position Where to draw the tooltip relative to
     *  the data
     * @param {Number} x_min The min x-coordinate for the bounding box of the data element
     * @param {Number} x_max The max x-coordinate for the bounding box of the data element
     * @param {Number} y_min The min y-coordinate for the bounding box of the data element
     * @param {Number} y_max The max y-coordinate for the bounding box of the data element
     * @private
     */
    _drawTooltip(tooltip, position, x_min, x_max, y_min, y_max) {
        const panel_layout = this.parent.layout;
        const layer_layout = this.layout;

        // Tooltip position params: as defined in the default stylesheet, used in calculations
        const arrow_size = 7;
        const stroke_width = 1;
        const arrow_total = arrow_size + stroke_width;  // Tooltip pos should account for how much space the arrow takes up

        const tooltip_padding = 6;  // bbox size must account for any internal padding applied between data and border

        const page_origin = this.getPageOrigin();
        const tooltip_box = tooltip.selector.node().getBoundingClientRect();
        const data_layer_height = panel_layout.height - (panel_layout.margin.top + panel_layout.margin.bottom);
        const data_layer_width = panel_layout.width - (panel_layout.margin.left + panel_layout.margin.right);

        // Clip the edges of the datum to the available plot area
        x_min = Math.max(x_min, 0);
        x_max = Math.min(x_max, data_layer_width);
        y_min = Math.max(y_min, 0);
        y_max = Math.min(y_max, data_layer_height);

        const x_center = (x_min + x_max) / 2;
        const y_center = (y_min + y_max) / 2;
        // Default offsets are the far edge of the datum bounding box
        let x_offset = x_max - x_center;
        let y_offset = y_max - y_center;
        let placement = layer_layout.tooltip_positioning;

        // Coordinate system note: the tooltip is positioned relative to the plot/page; the arrow is positioned relative to
        //  the tooltip boundaries
        let tooltip_top, tooltip_left, arrow_type, arrow_top, arrow_left;

        // The user can specify a generic orientation, and LocusZoom will autoselect whether to place the tooltip above or below
        if (placement === 'vertical') {
            // Auto-select whether to position above the item, or below
            x_offset = 0;
            if (tooltip_box.height + arrow_total > data_layer_height - (y_center + y_offset)) {
                placement = 'top';
            } else {
                placement = 'bottom';
            }
        } else if (placement === 'horizontal') {
            // Auto select whether to position to the left of the item, or to the right
            y_offset = 0;
            if (x_center <= panel_layout.width / 2) {
                placement = 'left';
            } else {
                placement = 'right';
            }
        }

        if (placement === 'top' || placement === 'bottom') {
            // Position horizontally centered above the point
            const offset_right = Math.max((tooltip_box.width / 2) - x_center, 0);
            const offset_left = Math.max((tooltip_box.width / 2) + x_center - data_layer_width, 0);
            tooltip_left = page_origin.x + x_center - (tooltip_box.width / 2) - offset_left + offset_right;
            arrow_left =  page_origin.x + x_center - tooltip_left - arrow_size;  // Arrow should be centered over the data
            // Position vertically above the point unless there's insufficient space, then go below
            if (placement === 'top') {
                tooltip_top = page_origin.y + y_center - (y_offset + tooltip_box.height + arrow_total);
                arrow_type = 'down';
                arrow_top = tooltip_box.height - stroke_width;
            } else {
                tooltip_top = page_origin.y + y_center + y_offset + arrow_total;
                arrow_type = 'up';
                arrow_top = 0 - arrow_total;
            }
        } else if (placement === 'left' || placement === 'right') {
            // Position tooltip horizontally on the left or the right depending on which side of the plot the point is on
            if (placement === 'left') {
                tooltip_left = page_origin.x + x_center + x_offset + arrow_total;
                arrow_type = 'left';
                arrow_left = -1 * (arrow_size + stroke_width);
            } else {
                tooltip_left = page_origin.x + x_center - tooltip_box.width - x_offset - arrow_total;
                arrow_type = 'right';
                arrow_left = tooltip_box.width - stroke_width;
            }
            // Position with arrow vertically centered along tooltip edge unless we're at the top or bottom of the plot
            if (y_center - (tooltip_box.height / 2) <= 0) { // Too close to the top, push it down
                tooltip_top = page_origin.y + y_center - (1.5 * arrow_size) - tooltip_padding;
                arrow_top = tooltip_padding;
            } else if (y_center + (tooltip_box.height / 2) >= data_layer_height) { // Too close to the bottom, pull it up
                tooltip_top = page_origin.y + y_center + arrow_size + tooltip_padding - tooltip_box.height;
                arrow_top = tooltip_box.height - (2 * arrow_size) - tooltip_padding;
            } else { // vertically centered
                tooltip_top = page_origin.y + y_center - (tooltip_box.height / 2);
                arrow_top = (tooltip_box.height / 2) - arrow_size;
            }
        } else {
            throw new Error('Unrecognized placement value');
        }

        // Position the div itself, relative to the layer origin
        tooltip.selector
            .style('left', `${tooltip_left}px`)
            .style('top', `${tooltip_top}px`);
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow) {
            tooltip.arrow = tooltip.selector.append('div')
                .style('position', 'absolute');
        }
        tooltip.arrow
            .attr('class', `lz-data_layer-tooltip-arrow_${arrow_type}`)
            .style('left', `${arrow_left}px`)
            .style('top', `${arrow_top}px`);
        return this;
    }

    /**
     * Loop through and position all tool tips on this data layer
     * @returns {BaseDataLayer}
     */
    positionAllTooltips() {
        for (let id in this.tooltips) {
            this.positionTooltip(id);
        }
        return this;
    }

    /**
     * Show or hide a tool tip by ID depending on directives in the layout and state values relative to the ID
     * @param {String|Object} element The element associated with the tooltip
     * @param {boolean} first_time Because panels can re-render, the rules for showing a tooltip
     *  depend on whether this is the first time a status change affecting display has been applied.
     * @returns {BaseDataLayer}
     */
    showOrHideTooltip(element, first_time) {
        if (typeof this.layout.tooltip != 'object') {
            return this;
        }
        const id = this.getElementId(element);

        /**
         * Apply rules and decide whether to show or hide the tooltip
         * @param {Object} statuses All statuses that apply to an element
         * @param {String[]|object} directive A layout directive object
         * @param operator
         * @returns {null|bool}
         */
        const resolveStatus = (statuses, directive, operator) => {
            let status = null;
            if (typeof statuses != 'object' || statuses === null) {
                return null;
            }
            if (Array.isArray(directive)) {
                // This happens when the function is called on the inner part of the directive
                operator = operator || 'and';
                if (directive.length === 1) {
                    status = statuses[directive[0]];
                } else {
                    status = directive.reduce((previousValue, currentValue) => {
                        if (operator === 'and') {
                            return statuses[previousValue] && statuses[currentValue];
                        } else if (operator === 'or') {
                            return statuses[previousValue] || statuses[currentValue];
                        }
                        return null;
                    });
                }
            } else if (typeof directive == 'object') {
                let sub_status;
                for (let sub_operator in directive) {
                    sub_status = resolveStatus(statuses, directive[sub_operator], sub_operator);
                    if (status === null) {
                        status = sub_status;
                    } else if (operator === 'and') {
                        status = status && sub_status;
                    } else if (operator === 'or') {
                        status = status || sub_status;
                    }
                }
            } else {
                return false;
            }
            return status;
        };

        let show_directive = {};
        if (typeof this.layout.tooltip.show == 'string') {
            show_directive = { and: [ this.layout.tooltip.show ] };
        } else if (typeof this.layout.tooltip.show == 'object') {
            show_directive = this.layout.tooltip.show;
        }

        let hide_directive = {};
        if (typeof this.layout.tooltip.hide == 'string') {
            hide_directive = { and: [ this.layout.tooltip.hide ] };
        } else if (typeof this.layout.tooltip.hide == 'object') {
            hide_directive = this.layout.tooltip.hide;
        }

        // Find all the statuses that apply to just this single element
        const layer_state = this.layer_state;
        var status_flags = {};  // {status_name: bool}
        STATUSES.adjectives.forEach((status) => {
            const antistatus = `un${status}`;
            status_flags[status] = (layer_state.status_flags[status].includes(id));
            status_flags[antistatus] = !status_flags[status];
        });

        // Decide whether to show/hide the tooltip based solely on the underlying element
        const show_resolved = resolveStatus(status_flags, show_directive);
        const hide_resolved = resolveStatus(status_flags, hide_directive);

        // Most of the tooltip display logic depends on behavior layouts: was point (un)selected, (un)highlighted, etc.
        // But sometimes, a point is selected, and the user then closes the tooltip. If the panel is re-rendered for
        //  some outside reason (like state change), we must track this in the create/destroy events as tooltip state.
        const has_tooltip = (layer_state.status_flags['has_tooltip'].includes(id));
        const tooltip_was_closed = first_time ? false : !has_tooltip;
        if (show_resolved && !tooltip_was_closed && !hide_resolved) {
            this.createTooltip(element);
        } else {
            this.destroyTooltip(element);
        }

        return this;
    }


    //TODO: Continue converting here
    /**
     * Find the elements (or indices) that match any of a set of provided filters
     * @protected
     * @param {Array[]} filters A list of filter entries: [field, value] (for equivalence testing) or
     *   [field, operator, value] for other operators
     * @param {('indexes'|'elements')} [return_type='indexes'] Specify whether to return either the indices of the matching
     *   elements, or references to the elements themselves
     * @returns {Array}
     */
    filter(filters, return_type) {
        if (typeof return_type == 'undefined' || !['indexes','elements'].includes(return_type)) {
            return_type = 'indexes';
        }
        if (!Array.isArray(filters)) {
            return [];
        }
        const test = (element, filter) => {
            const operators = {
                '=': (a, b) => a === b,
                // eslint-disable-next-line eqeqeq
                '!=': (a, b) => a != b, // For absence of a value, deliberately allow weak comparisons (eg undefined/null)
                '<': (a, b) => a < b,
                '<=': (a, b) => a <= b,
                '>': (a, b) => a > b,
                '>=': (a, b) => a >= b,
                '%': (a, b) => a % b
            };

            if (!Array.isArray(filter)) {
                return false;
            }
            if (filter.length === 2) {
                return element[filter[0]] === filter[1];
            } else if (filter.length === 3 && operators[filter[1]]) {
                return operators[filter[1]](element[filter[0]], filter[2]);
            } else {
                return false;
            }
        };
        const matches = [];
        this.data.forEach((element, idx) => {
            let match = true;
            filters.forEach((filter) => {
                if (!test(element, filter)) {
                    match = false;
                }
            });
            if (match) {
                matches.push(return_type === 'indexes' ? idx : element);
            }
        });
        return matches;
    }

    /**
     * @param filters
     * @returns {Array}
     */
    filterIndexes(filters) {
        return this.filter(filters, 'indexes');
    }
    /**
     * @param filters
     * @returns {Array}
     */
    filterElements(filters) {
        return this.filter(filters, 'elements');
    }

    /**
     * Toggle a status (e.g. highlighted, selected, identified) on an element
     * @param {String} status The name of a recognized status to be added/removed on an appropriate element
     * @param {String|Object} element The data bound to the element of interest
     * @param {Boolean} active True to add the status (and associated CSS styles); false to remove it
     * @param {Boolean} exclusive Whether to only allow a state for a single element at a time
     * @returns {BaseDataLayer}
     */
    setElementStatus(status, element, active, exclusive) {
        if (status === 'has_tooltip') {
            // This is a special adjective that exists solely to track tooltip state. It has no CSS and never gets set
            //  directly. It is invisible to the official enums.
            return this;
        }
        if (typeof active == 'undefined') {
            active = true;
        }

        // Get an ID for the element or return having changed nothing
        let element_id;
        try {
            element_id = this.getElementId(element);
        } catch (get_element_id_error) {
            return this;
        }

        // Enforce exclusivity (force all elements to have the opposite of toggle first)
        if (exclusive) {
            this.setAllElementStatus(status, !active);
        }

        // Set/unset the proper status class on the appropriate DOM element(s)
        d3.select(`#${element_id}`).classed(`lz-data_layer-${this.layout.type}-${status}`, active);
        const element_status_node_id = this.getElementStatusNodeId(element);
        if (element_status_node_id !== null) {
            d3.select(`#${element_status_node_id}`).classed(`lz-data_layer-${this.layout.type}-statusnode-${status}`, active);
        }

        // Track element ID in the proper status state array
        const element_status_idx = this.layer_state.status_flags[status].indexOf(element_id);
        const added_status = (element_status_idx === -1);  // On a re-render, existing statuses will be reapplied.
        if (active && added_status) {
            this.layer_state.status_flags[status].push(element_id);
        }
        if (!active && !added_status) {
            this.layer_state.status_flags[status].splice(element_status_idx, 1);
        }

        // Trigger tool tip show/hide logic
        this.showOrHideTooltip(element, added_status);

        // Trigger layout changed event hook
        if (added_status) {
            this.parent.emit('layout_changed', true);
        }

        const is_selected = (status === 'selected');
        if (is_selected && (added_status || !active)) {
            // Notify parents that an element has changed selection status (either active, or inactive)
            this.parent.emit('element_selection', { element: element, active: active }, true);
        }

        const value_to_broadcast = (this.layout.match && this.layout.match.send);
        if (is_selected && value_to_broadcast && (added_status || !active)) {
            this.parent.emit(
                'match_requested',
                { value: element[value_to_broadcast], active: active },
                true
            );
        }
        return this;
    }

    /**
     * Toggle a status on elements in the data layer based on a set of filters
     * @param {String} status
     * @param {Boolean} toggle
     * @param {Array} filters
     * @param {Boolean} exclusive
     * @returns {BaseDataLayer}
     */
    setElementStatusByFilters(status, toggle, filters, exclusive) {

        // Sanity check
        if (typeof status == 'undefined' || !STATUSES.adjectives.includes(status)) {
            throw new Error('Invalid status');
        }
        if (typeof this.layer_state.status_flags[status] == 'undefined') {
            return this;
        }
        if (typeof toggle == 'undefined') {
            toggle = true;
        } else {
            toggle = !!toggle;
        }
        if (typeof exclusive == 'undefined') {
            exclusive = false;
        } else {
            exclusive = !!exclusive;
        }
        if (!Array.isArray(filters)) {
            filters = [];
        }

        // Enforce exclusivity (force all elements to have the opposite of toggle first)
        if (exclusive) {
            this.setAllElementStatus(status, !toggle);
        }

        // Apply statuses
        this.filterElements(filters).forEach((element) => {
            this.setElementStatus(status, element, toggle);
        });

        return this;
    }

    /**
     * Toggle a status on all elements in the data layer
     * @param {String} status
     * @param {Boolean} toggle
     * @returns {BaseDataLayer}
     */
    setAllElementStatus(status, toggle) {

        // Sanity check
        if (typeof status == 'undefined' || !STATUSES.adjectives.includes(status)) {
            throw new Error('Invalid status');
        }
        if (typeof this.layer_state.status_flags[status] == 'undefined') {
            return this;
        }
        if (typeof toggle == 'undefined') {
            toggle = true;
        }

        // Apply statuses
        if (toggle) {
            this.data.forEach((element) => this.setElementStatus(status, element, true));
        } else {
            const status_ids = this.layer_state.status_flags[status].slice();
            status_ids.forEach((id) => {
                const element = this.getElementById(id);
                if (typeof element == 'object' && element !== null) {
                    this.setElementStatus(status, element, false);
                }
            });
            this.layer_state.status_flags[status] = [];
        }

        // Update global status flag
        this.global_statuses[status] = toggle;

        return this;
    }

    /**
     * Annotations provide a way to save user-driven additions and have them persist across render. They can be referenced
     *  as a named pseudo-field in any filters and scalable parameters. (template support may be added in the future)
     * Sample use case: user clicks a tooltip to "label this specific point". (or change any other display property)
     * @param {String|Object} element The data object or ID string for the element
     * @param {String} key The name of the annotation to track
     * @param {*} value The value of the marked field
     */
    setElementAnnotation (element, key, value) {
        const id = this.getElementId(element);
        if (!this.layer_state.extra_fields[id]) {
            this.layer_state.extra_fields[id] = {};
        }
        this.layer_state.extra_fields[id][key] = value;
        return this;
    }

    getElementAnnotation (element, key) {
        const id = this.getElementId(element);
        const extra = this.layer_state.extra_fields[id];
        return extra && extra[key];
    }

    /**
     * Apply all layout-defined behaviors (DOM event handlers) to a selection of elements
     * @param {d3.selection} selection
     */
    applyBehaviors(selection) {
        if (typeof this.layout.behaviors != 'object') {
            return;
        }
        Object.keys(this.layout.behaviors).forEach((directive) => {
            const event_match = /(click|mouseover|mouseout)/.exec(directive);
            if (!event_match) {
                return;
            }
            selection.on(`${event_match[0]}.${directive}`, this.executeBehaviors(directive, this.layout.behaviors[directive]));
        });
    }

    /**
     * Generate a function that executes an arbitrary list of behaviors on an element during an event
     * @param {String} directive The name of the event, as described in layout.behaviors for this datalayer
     * @param {Object[]} behaviors An object describing the behavior to attach to this single element
     * @param {string} behaviors.action The name of the action that would trigger this behavior (eg click, mouseover, etc)
     * @param {string} behaviors.status What status to apply to the element when this behavior is triggered (highlighted,
     *  selected, etc)
     * @param {boolean} [behaviors.exclusive] Whether triggering the event for this element should unset the relevant status
     *   for all other elements. Useful for, eg, click events that exclusively highlight one thing.
     * @returns {function(this:BaseDataLayer)} Return a function that handles the event in context with the behavior
     *   and the element- can be attached as an event listener
     */
    executeBehaviors(directive, behaviors) {

        // Determine the required state of control and shift keys during the event
        const requiredKeyStates = {
            'ctrl': (directive.includes('ctrl')),
            'shift': (directive.includes('shift'))
        };
        const self = this;
        return function(element) {

            // Do nothing if the required control and shift key presses (or lack thereof) doesn't match the event
            if (requiredKeyStates.ctrl !== !!d3.event.ctrlKey || requiredKeyStates.shift !== !!d3.event.shiftKey) {
                return;
            }

            // Loop through behaviors making each one go in succession
            behaviors.forEach((behavior) => {

                // Route first by the action, if defined
                if (typeof behavior != 'object' || behavior === null) {
                    return;
                }

                const current_status_boolean = (self.layer_state.status_flags[behavior.status].includes(self.getElementId(element)));
                const exclusive = behavior.exclusive && !current_status_boolean;

                switch (behavior.action) {

                // Set a status (set to true regardless of current status, optionally with exclusivity)
                case 'set':
                    self.setElementStatus(behavior.status, element, true, behavior.exclusive);
                    break;

                // Unset a status (set to false regardless of current status, optionally with exclusivity)
                case 'unset':
                    self.setElementStatus(behavior.status, element, false, behavior.exclusive);
                    break;

                // Toggle a status
                case 'toggle':
                    self.setElementStatus(behavior.status, element, !current_status_boolean, exclusive);
                    break;

                // Link to a dynamic URL
                case 'link':
                    if (typeof behavior.href == 'string') {
                        const url = parseFields(element, behavior.href);
                        if (typeof behavior.target == 'string') {
                            window.open(url, behavior.target);
                        } else {
                            window.location.href = url;
                        }
                    }
                    break;

                // Action not defined, just return
                default:
                    break;
                }
            });
        };
    }

    /**
     * Get an object with the x and y coordinates of the panel's origin in terms of the entire page
     *   Necessary for positioning any HTML elements over the panel
     * @returns {{x: Number, y: Number}}
     */
    getPageOrigin() {
        const panel_origin = this.parent.getPageOrigin();
        return {
            x: panel_origin.x + this.parent.layout.margin.left,
            y: panel_origin.y + this.parent.layout.margin.top
        };
    }

    /**
     * Apply all tracked element statuses. This is primarily intended for re-rendering the plot, in order to preserve
     *  behaviors when items are updated.
     */
    applyAllElementStatus () {
        const status_flags = this.layer_state.status_flags;
        const self = this;
        for (let property in status_flags) {
            if (!Object.prototype.hasOwnProperty.call(status_flags, property)) {
                continue;
            }
            if (Array.isArray(status_flags[property])) {
                status_flags[property].forEach((element_id) => {
                    try {
                        this.setElementStatus(property, this.getElementById(element_id), true);
                    } catch (e) {
                        console.warn(`Unable to apply state: ${self.state_id}, ${property}`);
                        console.error(e);
                    }
                });
            }
        }
    }

    /**
     * Position the datalayer and all tooltips
     * @returns {BaseDataLayer}
     */
    draw() {
        this.svg.container
            .attr('transform', `translate(${this.parent.layout.cliparea.origin.x}, ${this.parent.layout.cliparea.origin.y})`);
        this.svg.clipRect
            .attr('width', this.parent.layout.cliparea.width)
            .attr('height', this.parent.layout.cliparea.height);
        this.positionAllTooltips();
        return this;
    }


    /**
     * Re-Map a data layer to reflect changes in the state of a plot (such as viewing region/ chromosome range)
     * @return {Promise}
     */
    reMap() {
        this.destroyAllTooltips(); // hack - only non-visible tooltips should be destroyed
        // and then recreated if returning to visibility

        // Fetch new data. Datalayers are only given access to the final consolidated data from the chain (not headers or raw payloads)
        const promise = this.parent_plot.lzd.getData(this.state, this.layout.fields);
        promise.then((new_data) => {
            this.data = new_data.body;
            this.applyDataMethods();
            this.initialized = true;
        });

        return promise;
    }
}

// TODO: Add stub documentation for dynamically generated methods
STATUSES.verbs.forEach((verb, idx) => {
    const adjective = STATUSES.adjectives[idx];
    const antiverb = `un${verb}`;
    // Set/unset a single element's status

    /** @function highlightElement */
    /** @function selectElement */
    /** @function fadeElement */
    /** @function hideElement */
    BaseDataLayer.prototype[`${verb}Element`] = function(element, exclusive) {
        if (typeof exclusive == 'undefined') {
            exclusive = false;
        } else {
            exclusive = !!exclusive;
        }
        this.setElementStatus(adjective, element, true, exclusive);
        return this;
    };

    /** @function unhighlightElement */
    /** @function unselectElement */
    /** @function unfadeElement */
    /** @function unhideElement */
    BaseDataLayer.prototype[`${antiverb}Element`] = function(element, exclusive) {
        if (typeof exclusive == 'undefined') {
            exclusive = false;
        } else {
            exclusive = !!exclusive;
        }
        this.setElementStatus(adjective, element, false, exclusive);
        return this;
    };


    /** @function highlightElementsByFilters */
    /** @function selectElementsByFilters */
    /** @function fadeElementsByFilters */
    /** @function hideElementsByFilters */
    // Set/unset status for arbitrarily many elements given a set of filters
    BaseDataLayer.prototype[`${verb}ElementsByFilters`] = function(filters, exclusive) {
        if (typeof exclusive == 'undefined') {
            exclusive = false;
        } else {
            exclusive = !!exclusive;
        }
        return this.setElementStatusByFilters(adjective, true, filters, exclusive);
    };

    /** @function unhighlightElementsByFilters */
    /** @function unselectElementsByFilters */
    /** @function unfadeElementsByFilters */
    /** @function unhideElementsByFilters */
    BaseDataLayer.prototype[`${antiverb}ElementsByFilters`] = function(filters, exclusive) {
        if (typeof exclusive == 'undefined') {
            exclusive = false;
        } else {
            exclusive = !!exclusive;
        }
        return this.setElementStatusByFilters(adjective, false, filters, exclusive);
    };

    /** @function highlightAllElements */
    /** @function selectAllElements */
    /** @function fadeAllElements */
    /** @function hideAllElements */
    // Set/unset status for all elements
    BaseDataLayer.prototype[`${verb}AllElements`] = function() {
        this.setAllElementStatus(adjective, true);
        return this;
    };

    /** @function unhighlightAllElements */
    /** @function unselectAllElements */
    /** @function unfadeAllElements */
    /** @function unhideAllElements */
    BaseDataLayer.prototype[`${antiverb}AllElements`] = function() {
        this.setAllElementStatus(adjective, false);
        return this;
    };
});

export {BaseDataLayer as default};
