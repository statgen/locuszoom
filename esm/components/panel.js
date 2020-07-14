/** @module */
import * as d3 from 'd3';

import {STATUSES} from './constants';
import Toolbar from './toolbar';
import {applyStyles, generateCurtain, generateLoader} from '../helpers/common';
import {parseFields, positionIntToString, prettyTicks} from '../helpers/display';
import {merge} from '../helpers/layouts';
import Legend from './legend';
import data_layers from '../registry/data_layers';


/**
 * Default panel layout
 * @static
 * @type {Object}
 */
const default_layout = {
    title: { text: '', style: {}, x: 10, y: 22 },
    y_index: null,
    width:  0,
    height: 0,
    origin: { x: 0, y: null },
    min_width: 1,
    min_height: 1,
    proportional_width: null,
    proportional_height: null,
    proportional_origin: { x: 0, y: null },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    background_click: 'clear_selections',
    toolbar: {
        widgets: [],
    },
    cliparea: {
        height: 0,
        width: 0,
        origin: { x: 0, y: 0 },
    },
    axes: {  // These are the only axes supported!!
        x:  {},
        y1: {},
        y2: {},
    },
    legend: null,
    interaction: {
        drag_background_to_pan: false,
        drag_x_ticks_to_scale: false,
        drag_y1_ticks_to_scale: false,
        drag_y2_ticks_to_scale: false,
        scroll_to_zoom: false,
        x_linked: false,
        y1_linked: false,
        y2_linked: false,
    },
    data_layers: [],
};

/**
 * A panel is an abstract class representing a subdivision of the LocusZoom stage
 *   to display a distinct data representation as a collection of data layers.
 */
class Panel {
    /**
     * @param {Object} layout
     * @param {Plot|null} parent
    */
    constructor(layout, parent) {
        if (typeof layout !== 'object') {
            throw new Error('Unable to create panel, invalid layout');
        }

        /**
         * @protected
         * @member {Plot|null}
         */
        this.parent = parent || null;
        /**
         *  @protected
         *  @member {Plot|null}
         */
        this.parent_plot = parent;

        // Ensure a valid ID is present. If there is no valid ID then generate one
        if (typeof layout.id !== 'string' || !layout.id.length) {
            if (!this.parent) {
                layout.id = `p${Math.floor(Math.random() * Math.pow(10, 8))}`;
            } else {
                const generateID = () => {
                    let id = `p${Math.floor(Math.random() * Math.pow(10, 8))}`;
                    if (id === null || typeof this.parent.panels[id] != 'undefined') {
                        id = generateID();
                    }
                    return id;
                };
                layout.id = generateID();
            }
        } else if (this.parent) {
            if (typeof this.parent.panels[layout.id] !== 'undefined') {
                throw new Error(`Cannot create panel with id [${layout.id}]; panel with that id already exists`);
            }
        }
        /**
         * @public
         * @member {String}
         */
        this.id = layout.id;

        /**
         * @private
         * @member {Boolean}
         */
        this.initialized = false;
        /**
         * The index of this panel in the parent plot's `layout.panels`
         * @private
         * @member {number}
         * */
        this.layout_idx = null;
        /**
         * @private
         * @member {Object}
         */
        this.svg = {};

        /**
         * A JSON-serializable object used to describe the composition of the Panel
         * @public
         * @member {Object}
         */
        this.layout = merge(layout || {}, default_layout);

        // Define state parameters specific to this panel
        if (this.parent) {
            /**
             * @private
             * @member {Object}
             */
            this.state = this.parent.state;

            /**
             *  @private
             *  @member {String}
             */
            this.state_id = this.id;
            this.state[this.state_id] = this.state[this.state_id] || {};
        } else {
            this.state = null;
            this.state_id = null;
        }

        /**
         * @protected
         * @member {Object}
         */
        this.data_layers = {};
        /**
         * @private
         * @member {String[]}
         */
        this.data_layer_ids_by_z_index = [];

        /**
         * Track data requests in progress
         * @member {Promise[]}
         * @private
         */
        this.data_promises = [];

        /**
         * @private
         * @member {d3.scale}
         */
        this.x_scale  = null;
        /**
         * @private
         * @member {d3.scale}
         */
        this.y1_scale = null;
        /**
         *  @private
         *  @member {d3.scale}
         */
        this.y2_scale = null;

        /**
         * @private
         * @member {d3.extent}
         */
        this.x_extent  = null;
        /**
         *  @private
         *  @member {d3.extent}
         */
        this.y1_extent = null;
        /**
         *  @private
         *  @member {d3.extent}
         */
        this.y2_extent = null;

        /**
         * @private
         * @member {Number[]}
         */
        this.x_ticks  = [];
        /**
         *  @private
         *  @member {Number[]}
         */
        this.y1_ticks = [];
        /**
         * @private
         * @member {Number[]}
         */
        this.y2_ticks = [];

        /**
         * A timeout ID as returned by setTimeout
         * @private
         * @member {number}
         */
        this.zoom_timeout = null;

        /**
         * Known event hooks that the panel can respond to
         * @protected
         * @member {Object}
         */
        this.event_hooks = {
            'layout_changed': [],
            'data_requested': [],
            'data_rendered': [],
            'element_clicked': [],
            'element_selection': [],
            'match_requested': [], // A data layer is attempting to highlight matching points (internal use only)
        };

        // Initialize the layout
        this.initializeLayout();
    }

    /******* Public methods: intended for direct external manipulation of panel internals */

    /**
     * There are several events that a LocusZoom panel can "emit" when appropriate, and LocusZoom supports registering
     *   "hooks" for these events which are essentially custom functions intended to fire at certain times.
     *
     * The following panel-level events are currently supported:
     *   - `layout_changed` - context: panel - Any aspect of the panel's layout (including dimensions or state) has changed.
     *   - `data_requested` - context: panel - A request for new data from any data source used in the panel has been made.
     *   - `data_rendered` - context: panel - Data from a request has been received and rendered in the panel.
     *   - `element_clicked` - context: panel - A data element in any of the panel's data layers has been clicked.
     *   - `element_selection` - context: panel - Triggered when an element changes "selection" status, and identifies
     *        whether the element is being selected or deselected.
     *
     * To register a hook for any of these events use `panel.on('event_name', function() {})`.
     *
     * There can be arbitrarily many functions registered to the same event. They will be executed in the order they
     *   were registered. The this context bound to each event hook function is dependent on the type of event, as
     *   denoted above. For example, when data_requested is emitted the context for this in the event hook will be the
     *   panel itself, but when element_clicked is emitted the context for this in the event hook will be the element
     *   that was clicked.
     *
     * @public
     * @param {String} event The name of the event (as defined in `event_hooks`)
     * @param {function} hook
     * @returns {function} The registered event listener
     */
    on(event, hook) {
        // TODO: Dry plot and panel event code into a shared mixin
        if (typeof 'event' != 'string' || !Array.isArray(this.event_hooks[event])) {
            throw new Error(`Unable to register event hook, invalid event: ${event.toString()}`);
        }
        if (typeof hook != 'function') {
            throw new Error('Unable to register event hook, invalid hook function passed');
        }
        this.event_hooks[event].push(hook);
        return hook;
    }

    /**
     * Remove one or more previously defined event listeners
     * @public
     * @param {String} event The name of an event (as defined in `event_hooks`)
     * @param {eventCallback} [hook] The callback to deregister
     * @returns {Panel}
     */
    off(event, hook) {
        const theseHooks = this.event_hooks[event];
        if (typeof 'event' != 'string' || !Array.isArray(theseHooks)) {
            throw new Error(`Unable to remove event hook, invalid event: ${event.toString()}`);
        }
        if (hook === undefined) {
            // Deregistering all hooks for this event may break basic functionality, and should only be used during
            //  cleanup operations (eg to prevent memory leaks)
            this.event_hooks[event] = [];
        } else {
            const hookMatch = theseHooks.indexOf(hook);
            if (hookMatch !== -1) {
                theseHooks.splice(hookMatch, 1);
            } else {
                throw new Error('The specified event listener is not registered and therefore cannot be removed');
            }
        }
        return this;
    }

    /**
     * Handle running of event hooks when an event is emitted
     *
     * There is a shorter overloaded form of this method: if the event does not have any data, the second
     *   argument can be a boolean to control bubbling
     *
     * @public
     * @param {string} event A known event name
     * @param {*} [eventData] Data or event description that will be passed to the event listener
     * @param {boolean} [bubble=false] Whether to bubble the event to the parent
     * @returns {Panel}
     */
    emit(event, eventData, bubble)  {
        bubble = bubble || false;

        // TODO: DRY this with the parent plot implementation. Ensure interfaces remain compatible.
        // TODO: Improve documentation for overloaded method signature (JSDoc may have trouble here)
        if (typeof 'event' != 'string' || !Array.isArray(this.event_hooks[event])) {
            throw new Error(`LocusZoom attempted to throw an invalid event: ${event.toString()}`);
        }
        if (typeof eventData === 'boolean' && arguments.length === 2) {
            // Overloaded method signature: emit(event, bubble)
            bubble = eventData;
            eventData = null;
        }
        const sourceID = this.getBaseId();
        const eventContext = { sourceID: sourceID, data: eventData || null };
        this.event_hooks[event].forEach((hookToRun) => {
            // By default, any handlers fired here will see the panel as the value of `this`. If a bound function is
            // registered as a handler, the previously bound `this` will override anything provided to `call` below.
            hookToRun.call(this, eventContext);
        });
        if (bubble && this.parent) {
            this.parent.emit(event, eventContext);
        }
        return this;
    }

    /**
     * Set the title for the panel. If passed an object, will merge the object with the existing layout configuration, so
     *   that all or only some of the title layout object's parameters can be customized. If passed null, false, or an empty
     *   string, the title DOM element will be set to display: none.
     *
     * @public
     * @param {string|object|null} title The title text, or an object with additional configuration
     * @param {string} title.text Text to display. Since titles are rendered as SVG text, HTML and newlines will not be rendered.
     * @param {number} title.x X-offset, in pixels, for the title's text anchor (default left) relative to the top-left corner of the panel.
     * @param {number} title.y Y-offset, in pixels, for the title's text anchor (default left) relative to the top-left corner of the panel.
        NOTE: SVG y values go from the top down, so the SVG origin of (0,0) is in the top left corner.
     * @param {object} title.style CSS styles object to be applied to the title's DOM element.
     * @returns {Panel}
     */
    setTitle(title) {
        if (typeof this.layout.title == 'string') {
            const text = this.layout.title;
            this.layout.title = { text: text, x: 0, y: 0, style: {} };
        }
        if (typeof title == 'string') {
            this.layout.title.text = title;
        } else if (typeof title == 'object' && title !== null) {
            this.layout.title = merge(title, this.layout.title);
        }
        if (this.layout.title.text.length) {
            this.title
                .attr('display', null)
                .attr('x', parseFloat(this.layout.title.x))
                .attr('y', parseFloat(this.layout.title.y))
                .text(this.layout.title.text)
                .call(applyStyles, this.layout.title.style);

        } else {
            this.title.attr('display', 'none');
        }
        return this;
    }

    /**
     * Create a new data layer from a provided layout object. Should have the keys specified in `DefaultLayout`
     * Will automatically add at the top (depth/z-index) of the panel unless explicitly directed differently
     *   in the layout provided.
     * @public
     * @param {object} layout
     * @returns {*}
     */
    addDataLayer(layout) {

        // Sanity checks
        if (typeof layout !== 'object' || typeof layout.id !== 'string' || !layout.id.length) {
            throw new Error('Invalid data layer layout');
        }
        if (typeof this.data_layers[layout.id] !== 'undefined') {
            throw new Error(`Cannot create data_layer with id [${layout.id}]; data layer with that id already exists in the panel`);
        }
        if (typeof layout.type !== 'string') {
            throw new Error('Invalid data layer type');
        }

        // If the layout defines a y axis make sure the axis number is set and is 1 or 2 (default to 1)
        if (typeof layout.y_axis == 'object' && (typeof layout.y_axis.axis == 'undefined' || ![1, 2].includes(layout.y_axis.axis))) {
            layout.y_axis.axis = 1;
        }

        // Create the Data Layer
        const data_layer = data_layers.create(layout.type, layout, this);

        // Store the Data Layer on the Panel
        this.data_layers[data_layer.id] = data_layer;

        // If a discrete z_index was set in the layout then adjust other data layer z_index values to accommodate this one
        if (data_layer.layout.z_index !== null && !isNaN(data_layer.layout.z_index)
            && this.data_layer_ids_by_z_index.length > 0) {
            // Negative z_index values should count backwards from the end, so convert negatives to appropriate values here
            if (data_layer.layout.z_index < 0) {
                data_layer.layout.z_index = Math.max(this.data_layer_ids_by_z_index.length + data_layer.layout.z_index, 0);
            }
            this.data_layer_ids_by_z_index.splice(data_layer.layout.z_index, 0, data_layer.id);
            this.data_layer_ids_by_z_index.forEach((dlid, idx) => {
                this.data_layers[dlid].layout.z_index = idx;
            });
        } else {
            const length = this.data_layer_ids_by_z_index.push(data_layer.id);
            this.data_layers[data_layer.id].layout.z_index = length - 1;
        }

        // Determine if this data layer was already in the layout.data_layers array.
        // If it wasn't, add it. Either way store the layout.data_layers array index on the data_layer.
        let layout_idx = null;
        this.layout.data_layers.forEach((data_layer_layout, idx) => {
            if (data_layer_layout.id === data_layer.id) {
                layout_idx = idx;
            }
        });
        if (layout_idx === null) {
            layout_idx = this.layout.data_layers.push(this.data_layers[data_layer.id].layout) - 1;
        }
        this.data_layers[data_layer.id].layout_idx = layout_idx;

        return this.data_layers[data_layer.id];
    }

    /**
     * Remove a data layer by id
     * @public
     * @param {string} id
     * @returns {Panel}
     */
    removeDataLayer(id) {
        if (!this.data_layers[id]) {
            throw new Error(`Unable to remove data layer, ID not found: ${id}`);
        }

        // Destroy all tooltips for the data layer
        this.data_layers[id].destroyAllTooltips();

        // Remove the svg container for the data layer if it exists
        if (this.data_layers[id].svg.container) {
            this.data_layers[id].svg.container.remove();
        }

        // Delete the data layer and its presence in the panel layout and state
        this.layout.data_layers.splice(this.data_layers[id].layout_idx, 1);
        delete this.state[this.data_layers[id].state_id];
        delete this.data_layers[id];

        // Remove the data_layer id from the z_index array
        this.data_layer_ids_by_z_index.splice(this.data_layer_ids_by_z_index.indexOf(id), 1);

        // Update layout_idx and layout.z_index values for all remaining data_layers
        this.applyDataLayerZIndexesToDataLayerLayouts();
        this.layout.data_layers.forEach((data_layer_layout, idx) => {
            this.data_layers[data_layer_layout.id].layout_idx = idx;
        });

        return this;
    }

    /**
     * Clear all selections on all data layers
     * @public
     * @returns {Panel}
     */
    clearSelections() {
        this.data_layer_ids_by_z_index.forEach((id) => {
            this.data_layers[id].setAllElementStatus('selected', false);
        });
        return this;
    }

    /**
     * Update rendering of this panel whenever an event triggers a redraw. Assumes that the panel has already been
     *   prepared the first time via `initialize`
     * @public
     * @returns {Panel}
     */
    render() {

        // Position the panel container
        this.svg.container.attr('transform', `translate(${this.layout.origin.x}, ${this.layout.origin.y})`);

        // Set size on the clip rect
        this.svg.clipRect
            .attr('width', this.layout.width)
            .attr('height', this.layout.height);

        // Set and position the inner border, style if necessary
        this.inner_border
            .attr('x', this.layout.margin.left)
            .attr('y', this.layout.margin.top)
            .attr('width', this.layout.width - (this.layout.margin.left + this.layout.margin.right))
            .attr('height', this.layout.height - (this.layout.margin.top + this.layout.margin.bottom));
        if (this.layout.inner_border) {
            this.inner_border
                .style('stroke-width', 1)
                .style('stroke', this.layout.inner_border);
        }

        // Set/update panel title if necessary
        this.setTitle();

        // Regenerate all extents
        this.generateExtents();

        // Helper function to constrain any procedurally generated vectors (e.g. ranges, extents)
        // Constraints applied here keep vectors from going to infinity or beyond a definable power of ten
        const constrain = function (value, limit_exponent) {
            const neg_min = Math.pow(-10, limit_exponent);
            const neg_max = Math.pow(-10, -limit_exponent);
            const pos_min = Math.pow(10, -limit_exponent);
            const pos_max = Math.pow(10, limit_exponent);
            if (value === Infinity) {
                value = pos_max;
            }
            if (value === -Infinity) {
                value = neg_min;
            }
            if (value === 0) {
                value = pos_min;
            }
            if (value > 0) {
                value = Math.max(Math.min(value, pos_max), pos_min);
            }
            if (value < 0) {
                value = Math.max(Math.min(value, neg_max), neg_min);
            }
            return value;
        };

        // Define default and shifted ranges for all axes
        const ranges = {};
        if (this.x_extent) {
            const base_x_range = { start: 0, end: this.layout.cliparea.width };
            if (this.layout.axes.x.range) {
                base_x_range.start = this.layout.axes.x.range.start || base_x_range.start;
                base_x_range.end = this.layout.axes.x.range.end || base_x_range.end;
            }
            ranges.x = [base_x_range.start, base_x_range.end];
            ranges.x_shifted = [base_x_range.start, base_x_range.end];
        }
        if (this.y1_extent) {
            const base_y1_range = { start: this.layout.cliparea.height, end: 0 };
            if (this.layout.axes.y1.range) {
                base_y1_range.start = this.layout.axes.y1.range.start || base_y1_range.start;
                base_y1_range.end = this.layout.axes.y1.range.end || base_y1_range.end;
            }
            ranges.y1 = [base_y1_range.start, base_y1_range.end];
            ranges.y1_shifted = [base_y1_range.start, base_y1_range.end];
        }
        if (this.y2_extent) {
            const base_y2_range = { start: this.layout.cliparea.height, end: 0 };
            if (this.layout.axes.y2.range) {
                base_y2_range.start = this.layout.axes.y2.range.start || base_y2_range.start;
                base_y2_range.end = this.layout.axes.y2.range.end || base_y2_range.end;
            }
            ranges.y2 = [base_y2_range.start, base_y2_range.end];
            ranges.y2_shifted = [base_y2_range.start, base_y2_range.end];
        }

        // Shift ranges based on any drag or zoom interactions currently underway
        if (this.parent.interaction.panel_id && (this.parent.interaction.panel_id === this.id || this.parent.interaction.linked_panel_ids.includes(this.id))) {
            let anchor, scalar = null;
            if (this.parent.interaction.zooming && typeof this.x_scale == 'function') {
                const current_extent_size = Math.abs(this.x_extent[1] - this.x_extent[0]);
                const current_scaled_extent_size = Math.round(this.x_scale.invert(ranges.x_shifted[1])) - Math.round(this.x_scale.invert(ranges.x_shifted[0]));
                let zoom_factor = this.parent.interaction.zooming.scale;
                const potential_extent_size = Math.floor(current_scaled_extent_size * (1 / zoom_factor));
                if (zoom_factor < 1 && !isNaN(this.parent.layout.max_region_scale)) {
                    zoom_factor = 1 / (Math.min(potential_extent_size, this.parent.layout.max_region_scale) / current_scaled_extent_size);
                } else if (zoom_factor > 1 && !isNaN(this.parent.layout.min_region_scale)) {
                    zoom_factor = 1 / (Math.max(potential_extent_size, this.parent.layout.min_region_scale) / current_scaled_extent_size);
                }
                const new_extent_size = Math.floor(current_extent_size * zoom_factor);
                anchor = this.parent.interaction.zooming.center - this.layout.margin.left - this.layout.origin.x;
                const offset_ratio = anchor / this.layout.cliparea.width;
                const new_x_extent_start = Math.max(Math.floor(this.x_scale.invert(ranges.x_shifted[0]) - ((new_extent_size - current_scaled_extent_size) * offset_ratio)), 1);
                ranges.x_shifted = [ this.x_scale(new_x_extent_start), this.x_scale(new_x_extent_start + new_extent_size) ];
            } else if (this.parent.interaction.dragging) {
                switch (this.parent.interaction.dragging.method) {
                case 'background':
                    ranges.x_shifted[0] = +this.parent.interaction.dragging.dragged_x;
                    ranges.x_shifted[1] = this.layout.cliparea.width + this.parent.interaction.dragging.dragged_x;
                    break;
                case 'x_tick':
                    if (d3.event && d3.event.shiftKey) {
                        ranges.x_shifted[0] = +this.parent.interaction.dragging.dragged_x;
                        ranges.x_shifted[1] = this.layout.cliparea.width + this.parent.interaction.dragging.dragged_x;
                    } else {
                        anchor = this.parent.interaction.dragging.start_x - this.layout.margin.left - this.layout.origin.x;
                        scalar = constrain(anchor / (anchor + this.parent.interaction.dragging.dragged_x), 3);
                        ranges.x_shifted[0] = 0;
                        ranges.x_shifted[1] = Math.max(this.layout.cliparea.width * (1 / scalar), 1);
                    }
                    break;
                case 'y1_tick':
                case 'y2_tick': {
                    const y_shifted = `y${this.parent.interaction.dragging.method[1]}_shifted`;
                    if (d3.event && d3.event.shiftKey) {
                        ranges[y_shifted][0] = this.layout.cliparea.height + this.parent.interaction.dragging.dragged_y;
                        ranges[y_shifted][1] = +this.parent.interaction.dragging.dragged_y;
                    } else {
                        anchor = this.layout.cliparea.height - (this.parent.interaction.dragging.start_y - this.layout.margin.top - this.layout.origin.y);
                        scalar = constrain(anchor / (anchor - this.parent.interaction.dragging.dragged_y), 3);
                        ranges[y_shifted][0] = this.layout.cliparea.height;
                        ranges[y_shifted][1] = this.layout.cliparea.height - (this.layout.cliparea.height * (1 / scalar));
                    }
                }
                }
            }
        }

        // Generate scales and ticks for all axes, then render them
        ['x', 'y1', 'y2'].forEach((axis) => {
            if (!this[`${axis}_extent`]) {
                return;
            }

            // Base Scale
            this[`${axis}_scale`] = d3.scaleLinear()
                .domain(this[`${axis}_extent`])
                .range(ranges[`${axis}_shifted`]);

            // Shift the extent
            this[`${axis}_extent`] = [
                this[`${axis}_scale`].invert(ranges[axis][0]),
                this[`${axis}_scale`].invert(ranges[axis][1]),
            ];

            // Finalize Scale
            this[`${axis}_scale`] = d3.scaleLinear()
                .domain(this[`${axis}_extent`]).range(ranges[axis]);

            // Render axis (and generate ticks as needed)
            this.renderAxis(axis);
        });

        // Establish mousewheel zoom event handers on the panel (namespacing not passed through by d3, so not used here)
        if (this.layout.interaction.scroll_to_zoom) {
            const zoom_handler = () => {
                // Look for a shift key press while scrolling to execute.
                // If not present, gracefully raise a notification and allow conventional scrolling
                if (!d3.event.shiftKey) {
                    if (this.parent._canInteract(this.id)) {
                        this.loader.show('Press <tt>[SHIFT]</tt> while scrolling to zoom').hide(1000);
                    }
                    return;
                }
                d3.event.preventDefault();
                if (!this.parent._canInteract(this.id)) {
                    return;
                }
                const coords = d3.mouse(this.svg.container.node());
                const delta = Math.max(-1, Math.min(1, (d3.event.wheelDelta || -d3.event.detail || -d3.event.deltaY)));
                if (delta === 0) {
                    return;
                }
                this.parent.interaction = {
                    panel_id: this.id,
                    linked_panel_ids: this.getLinkedPanelIds('x'),
                    zooming: {
                        scale: (delta < 1) ? 0.9 : 1.1,
                        center: coords[0],
                    },
                };
                this.render();
                this.parent.interaction.linked_panel_ids.forEach((panel_id) => {
                    this.parent.panels[panel_id].render();
                });
                if (this.zoom_timeout !== null) {
                    clearTimeout(this.zoom_timeout);
                }
                this.zoom_timeout = setTimeout(() => {
                    this.parent.interaction = {};
                    this.parent.applyState({ start: this.x_extent[0], end: this.x_extent[1] });
                }, 500);
            };
            this.zoom_listener = d3.zoom();
            this.svg.container.call(this.zoom_listener)
                .on('wheel.zoom', zoom_handler)
                .on('mousewheel.zoom', zoom_handler)
                .on('DOMMouseScroll.zoom', zoom_handler);
        }

        // Render data layers in order by z-index
        this.data_layer_ids_by_z_index.forEach((data_layer_id) => {
            this.data_layers[data_layer_id].draw().render();
        });

        return this;
    }

    /**
     * Add a "basic" loader to a panel
     * This method is just a shortcut for adding the most commonly used type of loading indicator, which appears when
     *   data is requested, animates (e.g. shows an infinitely cycling progress bar as opposed to one that loads from
     *   0-100% based on actual load progress), and disappears when new data is loaded and rendered.
     *
     * @public
     * @param {Boolean} show_immediately
     * @returns {Panel}
     */
    addBasicLoader(show_immediately) {
        if (typeof show_immediately != 'undefined') {
            show_immediately = true;
        }
        if (show_immediately) {
            this.loader.show('Loading...').animate();
        }
        this.on('data_requested', () => {
            this.loader.show('Loading...').animate();
        });
        this.on('data_rendered', () => {
            this.loader.hide();
        });
        return this;
    }

    /************* Private interface: only used internally */
    /** @private */
    applyDataLayerZIndexesToDataLayerLayouts () {
        this.data_layer_ids_by_z_index.forEach((dlid, idx) => {
            this.data_layers[dlid].layout.z_index = idx;
        });
    }

    /**
     * @private
     * @returns {string}
     */
    getBaseId () {
        return `${this.parent.id}.${this.id}`;
    }

    /**
     * Get an object with the x and y coordinates of the panel's origin in terms of the entire page
     * Necessary for positioning any HTML elements over the panel
     * @private
     * @returns {{x: Number, y: Number}}
     */
    _getPageOrigin() {
        const plot_origin = this.parent._getPageOrigin();
        return {
            x: plot_origin.x + this.layout.origin.x,
            y: plot_origin.y + this.layout.origin.y,
        };
    }

    /**
     * Prepare the panel for first use by performing parameter validation, creating axes, setting default dimensions,
     *   and preparing / positioning data layers as appropriate.
     * @private
     * @returns {Panel}
     */
    initializeLayout() {

        // If the layout is missing BOTH width and proportional width then set the proportional width to 1.
        // This will default the panel to taking up the full width of the plot.
        if (this.layout.width === 0 && this.layout.proportional_width === null) {
            this.layout.proportional_width = 1;
        }

        // If the layout is missing BOTH height and proportional height then set the proportional height to
        // an equal share of the plot's current height.
        if (this.layout.height === 0 && this.layout.proportional_height === null) {
            const panel_count = Object.keys(this.parent.panels).length;
            if (panel_count > 0) {
                this.layout.proportional_height = (1 / panel_count);
            } else {
                this.layout.proportional_height = 1;
            }
        }

        // Set panel dimensions, origin, and margin
        this.setDimensions();
        this.setOrigin();
        this.setMargin();

        // Set ranges
        // TODO: Define stub values in constructor
        this.x_range = [0, this.layout.cliparea.width];
        this.y1_range = [this.layout.cliparea.height, 0];
        this.y2_range = [this.layout.cliparea.height, 0];

        // Initialize panel axes
        ['x', 'y1', 'y2'].forEach((axis) => {
            if (!Object.keys(this.layout.axes[axis]).length || this.layout.axes[axis].render === false) {
                // The default layout sets the axis to an empty object, so set its render boolean here
                this.layout.axes[axis].render = false;
            } else {
                this.layout.axes[axis].render = true;
                this.layout.axes[axis].label = this.layout.axes[axis].label || null;
                this.layout.axes[axis].label_function = this.layout.axes[axis].label_function || null;
            }
        });

        // Add data layers (which define x and y extents)
        this.layout.data_layers.forEach((data_layer_layout) => {
            this.addDataLayer(data_layer_layout);
        });

        return this;
    }

    /**
     * Set the dimensions for the panel. If passed with no arguments will calculate optimal size based on layout
     *   directives and the available area within the plot. If passed discrete width (number) and height (number) will
     *   attempt to resize the panel to them, but may be limited by minimum dimensions defined on the plot or panel.
     *
     * @private
     * @param {number} [width]
     * @param {number} [height]
     * @returns {Panel}
     */
    setDimensions(width, height) {
        if (typeof width != 'undefined' && typeof height != 'undefined') {
            if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0) {
                this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
                this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
            }
        } else {
            if (this.layout.proportional_width !== null) {
                this.layout.width = Math.max(this.layout.proportional_width * this.parent.layout.width, this.layout.min_width);
            }
            if (this.layout.proportional_height !== null) {
                this.layout.height = Math.max(this.layout.proportional_height * this.parent.layout.height, this.layout.min_height);
            }
        }
        this.layout.cliparea.width = Math.max(this.layout.width - (this.layout.margin.left + this.layout.margin.right), 0);
        this.layout.cliparea.height = Math.max(this.layout.height - (this.layout.margin.top + this.layout.margin.bottom), 0);
        if (this.svg.clipRect) {
            this.svg.clipRect
                .attr('width', this.layout.width)
                .attr('height', this.layout.height);
        }
        if (this.initialized) {
            this.render();
            this.curtain.update();
            this.loader.update();
            this.toolbar.update();
            if (this.legend) {
                this.legend.position();
            }
        }
        return this;
    }

    /**
     * Set panel origin on the plot, and re-render as appropriate
     *
     * @private
     * @param {number} x
     * @param {number} y
     * @returns {Panel}
     */
    setOrigin(x, y) {
        if (!isNaN(x) && x >= 0) {
            this.layout.origin.x = Math.max(Math.round(+x), 0);
        }
        if (!isNaN(y) && y >= 0) {
            this.layout.origin.y = Math.max(Math.round(+y), 0);
        }
        if (this.initialized) {
            this.render();
        }
        return this;
    }

    /**
     * Set margins around this panel
     * @private
     * @param {number} top
     * @param {number} right
     * @param {number} bottom
     * @param {number} left
     * @returns {Panel}
     */
    setMargin(top, right, bottom, left) {
        let extra;
        if (!isNaN(top)    && top    >= 0) {
            this.layout.margin.top = Math.max(Math.round(+top), 0);
        }
        if (!isNaN(right)  && right  >= 0) {
            this.layout.margin.right = Math.max(Math.round(+right), 0);
        }
        if (!isNaN(bottom) && bottom >= 0) {
            this.layout.margin.bottom = Math.max(Math.round(+bottom), 0);
        }
        if (!isNaN(left)   && left   >= 0) {
            this.layout.margin.left = Math.max(Math.round(+left), 0);
        }
        if (this.layout.margin.top + this.layout.margin.bottom > this.layout.height) {
            extra = Math.floor(((this.layout.margin.top + this.layout.margin.bottom) - this.layout.height) / 2);
            this.layout.margin.top -= extra;
            this.layout.margin.bottom -= extra;
        }
        if (this.layout.margin.left + this.layout.margin.right > this.layout.width) {
            extra = Math.floor(((this.layout.margin.left + this.layout.margin.right) - this.layout.width) / 2);
            this.layout.margin.left -= extra;
            this.layout.margin.right -= extra;
        }
        ['top', 'right', 'bottom', 'left'].forEach((m) => {
            this.layout.margin[m] = Math.max(this.layout.margin[m], 0);
        });
        this.layout.cliparea.width = Math.max(this.layout.width - (this.layout.margin.left + this.layout.margin.right), 0);
        this.layout.cliparea.height = Math.max(this.layout.height - (this.layout.margin.top + this.layout.margin.bottom), 0);
        this.layout.cliparea.origin.x = this.layout.margin.left;
        this.layout.cliparea.origin.y = this.layout.margin.top;

        if (this.initialized) {
            this.render();
        }
        return this;
    }

    /**
     * Prepare the first rendering of the panel. This includes drawing the individual data layers, but also creates shared
     *   elements such as axes,  title, and loader/curtain.
     * @private
     * @returns {Panel}
     */
    initialize() {

        // Append a container group element to house the main panel group element and the clip path
        // Position with initial layout parameters
        const base_id = this.getBaseId();
        this.svg.container = this.parent.svg.append('g')
            .attr('id', `${base_id}.panel_container`)
            .attr('transform', `translate(${this.layout.origin.x || 0}, ${this.layout.origin.y || 0})`);

        // Append clip path to the parent svg element, size with initial layout parameters
        const clipPath = this.svg.container.append('clipPath')
            .attr('id', `${base_id}.clip`);
        this.svg.clipRect = clipPath.append('rect')
            .attr('width', this.layout.width)
            .attr('height', this.layout.height);

        // Append svg group for rendering all panel child elements, clipped by the clip path
        this.svg.group = this.svg.container.append('g')
            .attr('id', `${base_id}.panel`)
            .attr('clip-path', `url(#${base_id}.clip)`);

        // Add curtain and loader prototypes to the panel
        /** @member {Object} */
        this.curtain = generateCurtain.call(this);
        /** @member {Object} */
        this.loader = generateLoader.call(this);

        /**
         * Create the toolbar object and hang widgets on it as defined by panel layout
         * @member {Toolbar}
         */
        this.toolbar = new Toolbar(this);

        // Inner border
        this.inner_border = this.svg.group.append('rect')
            .attr('class', 'lz-panel-background')
            .on('click', () => {
                if (this.layout.background_click === 'clear_selections') {
                    this.clearSelections();
                }
            });

        // Add the title
        /** @member {Element} */
        this.title = this.svg.group.append('text').attr('class', 'lz-panel-title');
        if (typeof this.layout.title != 'undefined') {
            this.setTitle();
        }

        // Initialize Axes
        this.svg.x_axis = this.svg.group.append('g')
            .attr('id', `${base_id}.x_axis`)
            .attr('class', 'lz-x lz-axis');
        if (this.layout.axes.x.render) {
            this.svg.x_axis_label = this.svg.x_axis.append('text')
                .attr('class', 'lz-x lz-axis lz-label')
                .attr('text-anchor', 'middle');
        }
        this.svg.y1_axis = this.svg.group.append('g')
            .attr('id', `${base_id}.y1_axis`).attr('class', 'lz-y lz-y1 lz-axis');
        if (this.layout.axes.y1.render) {
            this.svg.y1_axis_label = this.svg.y1_axis.append('text')
                .attr('class', 'lz-y1 lz-axis lz-label')
                .attr('text-anchor', 'middle');
        }
        this.svg.y2_axis = this.svg.group.append('g')
            .attr('id', `${base_id}.y2_axis`)
            .attr('class', 'lz-y lz-y2 lz-axis');
        if (this.layout.axes.y2.render) {
            this.svg.y2_axis_label = this.svg.y2_axis.append('text')
                .attr('class', 'lz-y2 lz-axis lz-label')
                .attr('text-anchor', 'middle');
        }

        // Initialize child Data Layers
        this.data_layer_ids_by_z_index.forEach((id) => {
            this.data_layers[id].initialize();
        });

        /**
         * Legend object, as defined by panel layout and child data layer layouts
         * @member {Legend}
         * */
        this.legend = null;
        if (this.layout.legend) {
            this.legend = new Legend(this);
        }

        // Establish panel background drag interaction mousedown event handler (on the panel background)
        if (this.layout.interaction.drag_background_to_pan) {
            const namespace = `.${this.parent.id}.${this.id}.interaction.drag`;
            const mousedown = () => {
                this.parent.startDrag(this, 'background');
            };
            this.svg.container.select('.lz-panel-background')
                .on(`mousedown${namespace}.background`, mousedown)
                .on(`touchstart${namespace}.background`, mousedown);
        }

        return this;
    }

    /**
     * Refresh the sort order of all data layers (called by data layer moveUp and moveDown methods)
     * @private
     */
    resortDataLayers() {
        const sort = [];
        this.data_layer_ids_by_z_index.forEach((id) => {
            sort.push(this.data_layers[id].layout.z_index);
        });
        this.svg.group
            .selectAll('g.lz-data_layer-container')
            .data(sort)
            .sort(d3.ascending);
        this.applyDataLayerZIndexesToDataLayerLayouts();
    }

    /**
     * Get an array of panel IDs that are axis-linked to this panel
     * @private
     * @param {('x'|'y1'|'y2')} axis
     * @returns {Array}
     */
    getLinkedPanelIds(axis) {
        axis = axis || null;
        const linked_panel_ids = [];
        if (!['x', 'y1', 'y2'].includes(axis)) {
            return linked_panel_ids;
        }
        if (!this.layout.interaction[`${axis}_linked`]) {
            return linked_panel_ids;
        }
        this.parent.panel_ids_by_y_index.forEach((panel_id) => {
            if (panel_id !== this.id && this.parent.panels[panel_id].layout.interaction[`${axis}_linked`]) {
                linked_panel_ids.push(panel_id);
            }
        });
        return linked_panel_ids;
    }

    /**
     * Move a panel up relative to others by y-index
     * @private
     * @returns {Panel}
     */
    moveUp() {
        if (this.parent.panel_ids_by_y_index[this.layout.y_index - 1]) {
            this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index - 1];
            this.parent.panel_ids_by_y_index[this.layout.y_index - 1] = this.id;
            this.parent.applyPanelYIndexesToPanelLayouts();
            this.parent.positionPanels();
        }
        return this;
    }

    /**
     * Move a panel down (y-axis) relative to others in the plot
     * @private
     * @returns {Panel}
     */
    moveDown() {
        if (this.parent.panel_ids_by_y_index[this.layout.y_index + 1]) {
            this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index + 1];
            this.parent.panel_ids_by_y_index[this.layout.y_index + 1] = this.id;
            this.parent.applyPanelYIndexesToPanelLayouts();
            this.parent.positionPanels();
        }
        return this;
    }

    /**
     * When the parent plot changes state, adjust the panel accordingly. For example, this may include fetching new data
     *   from the API as the viewing region changes
     * @private
     * @returns {Promise}
     */
    reMap() {
        this.emit('data_requested');
        this.data_promises = [];

        // Remove any previous error messages before attempting to load new data
        this.curtain.hide();
        // Trigger reMap on each Data Layer
        for (let id in this.data_layers) {
            try {
                this.data_promises.push(this.data_layers[id].reMap());
            } catch (error) {
                console.error(error);
                this.curtain.show(error.message || error);
            }
        }
        // When all finished trigger a render
        return Promise.all(this.data_promises)
            .then(() => {
                this.initialized = true;
                this.render();
                this.emit('layout_changed', true);
                this.emit('data_rendered');
            })
            .catch((error) => {
                console.error(error);
                this.curtain.show(error.message || error);
            });
    }

    /**
     * Iterate over data layers to generate panel axis extents
     * @private
     * @returns {Panel}
     */
    generateExtents() {

        // Reset extents
        ['x', 'y1', 'y2'].forEach((axis) => {
            this[`${axis}_extent`] = null;
        });

        // Loop through the data layers
        for (let id in this.data_layers) {

            const data_layer = this.data_layers[id];

            // If defined and not decoupled, merge the x extent of the data layer with the panel's x extent
            if (data_layer.layout.x_axis && !data_layer.layout.x_axis.decoupled) {
                this.x_extent = d3.extent((this.x_extent || []).concat(data_layer.getAxisExtent('x')));
            }

            // If defined and not decoupled, merge the y extent of the data layer with the panel's appropriate y extent
            if (data_layer.layout.y_axis && !data_layer.layout.y_axis.decoupled) {
                const y_axis = `y${data_layer.layout.y_axis.axis}`;
                this[`${y_axis}_extent`] = d3.extent((this[`${y_axis}_extent`] || []).concat(data_layer.getAxisExtent('y')));
            }

        }

        // Override x_extent from state if explicitly defined to do so
        if (this.layout.axes.x && this.layout.axes.x.extent === 'state') {
            this.x_extent = [ this.state.start, this.state.end ];
        }

        return this;

    }

    /**
     * Generate an array of ticks for an axis. These ticks are generated in one of three ways (highest wins):
     *   1. An array of specific tick marks
     *   2. Query each data layer for what ticks are appropriate, and allow a panel-level tick configuration parameter
     *     object to override the layer's default presentation settings
     *   3. Generate generic tick marks based on the extent of the data
     *
     * @private
     * @param {('x'|'y1'|'y2')} axis The string identifier of the axis
     * @returns {Number[]|Object[]}  TODO: number format?
     *   An array of numbers: interpreted as an array of axis value offsets for positioning.
     *   An array of objects: each object must have an 'x' attribute to position the tick.
     *   Other supported object keys:
     *     * text: string to render for a given tick
     *     * style: d3-compatible CSS style object
     *     * transform: SVG transform attribute string
     *     * color: string or LocusZoom scalable parameter object
     */
    generateTicks(axis) {

        // Parse an explicit 'ticks' attribute in the axis layout
        if (this.layout.axes[axis].ticks) {
            const layout = this.layout.axes[axis];

            const baseTickConfig = layout.ticks;
            if (Array.isArray(baseTickConfig)) {
                // Array of specific ticks hard-coded into a panel will override any ticks that an individual layer might specify
                return baseTickConfig;
            }

            if (typeof baseTickConfig === 'object') {
                // If the layout specifies base configuration for ticks- but without specific positions- then ask each
                //   data layer to report the tick marks that it thinks it needs
                // TODO: Few layers currently need to specify custom ticks (which is ok!). But if it becomes common, consider adding mechanisms to deduplicate ticks across layers
                const self = this;

                // Pass any layer-specific customizations for how ticks are calculated. (styles are overridden separately)
                const config = { position: baseTickConfig.position };

                const combinedTicks = this.data_layer_ids_by_z_index.reduce((acc, data_layer_id) => {
                    const nextLayer = self.data_layers[data_layer_id];
                    return acc.concat(nextLayer.getTicks(axis, config));
                }, []);

                return combinedTicks.map((item) => {
                    // The layer makes suggestions, but tick configuration params specified on the panel take precedence
                    let itemConfig = {};
                    itemConfig = merge(itemConfig, baseTickConfig);
                    return merge(itemConfig, item);
                });
            }
        }

        // If no other configuration is provided, attempt to generate ticks from the extent
        if (this[`${axis}_extent`]) {
            return prettyTicks(this[`${axis}_extent`], 'both');
        }
        return [];
    }

    /**
     * Render ticks for a particular axis
     * @private
     * @param {('x'|'y1'|'y2')} axis The identifier of the axes
     * @returns {Panel}
     */
    renderAxis(axis) {

        if (!['x', 'y1', 'y2'].includes(axis)) {
            throw new Error(`Unable to render axis; invalid axis identifier: ${axis}`);
        }

        const canRender = this.layout.axes[axis].render
            && typeof this[`${axis}_scale`] == 'function'
            && !isNaN(this[`${axis}_scale`](0));

        // If the axis has already been rendered then check if we can/can't render it
        // Make sure the axis element is shown/hidden to suit
        if (this[`${axis}_axis`]) {
            this.svg.container.select(`g.lz-axis.lz-${axis}`)
                .style('display', canRender ? null : 'none');
        }

        if (!canRender) {
            return this;
        }

        // Axis-specific values to plug in where needed
        const axis_params = {
            x: {
                position: `translate(${this.layout.margin.left}, ${this.layout.height - this.layout.margin.bottom})`,
                orientation: 'bottom',
                label_x: this.layout.cliparea.width / 2,
                label_y: (this.layout.axes[axis].label_offset || 0),
                label_rotate: null,
            },
            y1: {
                position: `translate(${this.layout.margin.left}, ${this.layout.margin.top})`,
                orientation: 'left',
                label_x: -1 * (this.layout.axes[axis].label_offset || 0),
                label_y: this.layout.cliparea.height / 2,
                label_rotate: -90,
            },
            y2: {
                position: `translate(${this.layout.width - this.layout.margin.right}, ${this.layout.margin.top})`,
                orientation: 'right',
                label_x: (this.layout.axes[axis].label_offset || 0),
                label_y: this.layout.cliparea.height / 2,
                label_rotate: -90,
            },
        };

        // Generate Ticks
        this[`${axis}_ticks`] = this.generateTicks(axis);

        // Determine if the ticks are all numbers (d3-automated tick rendering) or not (manual tick rendering)
        const ticksAreAllNumbers = ((ticks) => {
            for (let i = 0; i < ticks.length; i++) {
                if (isNaN(ticks[i])) {
                    return false;
                }
            }
            return true;
        })(this[`${axis}_ticks`]);

        // Initialize the axis; set scale and orientation
        let axis_factory;
        switch (axis_params[axis].orientation) {
        case 'right':
            axis_factory = d3.axisRight;
            break;
        case 'left':
            axis_factory = d3.axisLeft;
            break;
        case 'bottom':
            axis_factory = d3.axisBottom;
            break;
        default:
            throw new Error('Unrecognized axis orientation');
        }

        this[`${axis}_axis`] = axis_factory(this[`${axis}_scale`])
            .tickPadding(3);

        // Set tick values and format
        if (ticksAreAllNumbers) {
            this[`${axis}_axis`].tickValues(this[`${axis}_ticks`]);
            if (this.layout.axes[axis].tick_format === 'region') {
                this[`${axis}_axis`].tickFormat((d) => positionIntToString(d, 6));
            }
        } else {
            let ticks = this[`${axis}_ticks`].map((t) => {
                return (t[axis.substr(0, 1)]);
            });
            this[`${axis}_axis`].tickValues(ticks)
                .tickFormat((t, i) => {
                    return this[`${axis}_ticks`][i].text;
                });
        }

        // Position the axis in the SVG and apply the axis construct
        this.svg[`${axis}_axis`]
            .attr('transform', axis_params[axis].position)
            .call(this[`${axis}_axis`]);

        // If necessary manually apply styles and transforms to ticks as specified by the layout
        if (!ticksAreAllNumbers) {
            const tick_selector = d3.selectAll(`g#${this.getBaseId().replace('.', '\\.')}\\.${axis}_axis g.tick`);
            const panel = this;
            tick_selector.each(function (d, i) {
                const selector = d3.select(this).select('text');
                if (panel[`${axis}_ticks`][i].style) {
                    applyStyles(selector, panel[`${axis}_ticks`][i].style);
                }
                if (panel[`${axis}_ticks`][i].transform) {
                    selector.attr('transform', panel[`${axis}_ticks`][i].transform);
                }
            });
        }

        // Render the axis label if necessary
        const label = this.layout.axes[axis].label || null;
        if (label !== null) {
            this.svg[`${axis}_axis_label`]
                .attr('x', axis_params[axis].label_x)
                .attr('y', axis_params[axis].label_y)
                .text(parseFields(this.state, label));
            if (axis_params[axis].label_rotate !== null) {
                this.svg[`${axis  }_axis_label`]
                    .attr('transform', `rotate(${axis_params[axis].label_rotate} ${axis_params[axis].label_x}, ${axis_params[axis].label_y})`);
            }
        }

        // Attach interactive handlers to ticks as needed
        ['x', 'y1', 'y2'].forEach((axis) => {
            if (this.layout.interaction[`drag_${axis}_ticks_to_scale`]) {
                const namespace = `.${this.parent.id}.${this.id}.interaction.drag`;
                const tick_mouseover = function() {
                    if (typeof d3.select(this).node().focus == 'function') {
                        d3.select(this).node().focus();
                    }
                    let cursor = (axis === 'x') ? 'ew-resize' : 'ns-resize';
                    if (d3.event && d3.event.shiftKey) {
                        cursor = 'move';
                    }
                    d3.select(this)
                        .style('font-weight', 'bold')
                        .style('cursor', cursor )
                        .on(`keydown${namespace}`, tick_mouseover)
                        .on(`keyup${namespace}`, tick_mouseover);
                };
                this.svg.container.selectAll(`.lz-axis.lz-${axis} .tick text`)
                    .attr('tabindex', 0) // necessary to make the tick focusable so keypress events can be captured
                    .on(`mouseover${namespace}`, tick_mouseover)
                    .on(`mouseout${namespace}`, function() {
                        d3.select(this).style('font-weight', 'normal');
                        d3.select(this).on(`keydown${namespace}`, null).on(`keyup${namespace}`, null);
                    })
                    .on(`mousedown${namespace}`, () => {
                        this.parent.startDrag(this, `${axis}_tick`);
                    });
            }
        });

        return this;
    }

    /**
     * Force the height of this panel to the largest absolute height of the data in
     *   all child data layers (if not null for any child data layers)
     * @private
     * @param {number|null} [target_height] A target height, which will be used in situations when the expected height can be
     *   pre-calculated (eg when the layers are transitioning)
     */
    scaleHeightToData(target_height) {
        target_height = +target_height || null;
        if (target_height === null) {
            this.data_layer_ids_by_z_index.forEach((id) => {
                const dh = this.data_layers[id].getAbsoluteDataHeight();
                if (+dh) {
                    if (target_height === null) {
                        target_height = +dh;
                    } else {
                        target_height = Math.max(target_height, +dh);
                    }
                }
            });
        }
        if (+target_height) {
            target_height += +this.layout.margin.top + +this.layout.margin.bottom;
            this.setDimensions(this.layout.width, target_height);
            this.parent.setDimensions();
            this.parent.panel_ids_by_y_index.forEach((id) => {
                this.parent.panels[id].layout.proportional_height = null;
            });
            this.parent.positionPanels();
        }
    }

    /**
     * Methods to set/unset element statuses across all data layers
     * @private
     * @param {String} status
     * @param {Boolean} toggle
     * @param {Array} filters
     * @param {Boolean} exclusive
     */
    setElementStatusByFilters(status, toggle, filters, exclusive) {
        this.data_layer_ids_by_z_index.forEach((id) => {
            this.data_layers[id].setElementStatusByFilters(status, toggle, filters, exclusive);
        });
    }

    /**
     * Set/unset element statuses across all data layers
     * @private
     * @param {String} status
     * @param {Boolean} toggle
     */
    setAllElementStatus(status, toggle) {
        this.data_layer_ids_by_z_index.forEach((id) => {
            this.data_layers[id].setAllElementStatus(status, toggle);
        });
    }
}

STATUSES.verbs.forEach((verb, idx) => {
    const adjective = STATUSES.adjectives[idx];
    const antiverb = `un${verb}`;
    // Set/unset status for arbitrarily many elements given a set of filters

    /**
     * @private
     * @function highlightElementsByFilters
     */
    /**
     *  @private
     *  @function selectElementsByFilters
     */
    /**
     *  @private
     *  @function fadeElementsByFilters
     */
    /**
     *  @private
     *  @function hideElementsByFilters
     */
    Panel.prototype[`${verb}ElementsByFilters`] = function(filters, exclusive) {
        if (typeof exclusive == 'undefined') {
            exclusive = false;
        } else {
            exclusive = !!exclusive;
        }
        return this.setElementStatusByFilters(adjective, true, filters, exclusive);
    };

    /**
     * @private
     * @function unhighlightElementsByFilters
     */
    /**
     *  @private
     *  @function unselectElementsByFilters
     */
    /**
     *  @private
     *  @function unfadeElementsByFilters
     */
    /**
     *  @private
     *  @function unhideElementsByFilters
     */
    Panel.prototype[`${antiverb}ElementsByFilters`] = function(filters, exclusive) {
        if (typeof exclusive == 'undefined') {
            exclusive = false;
        } else {
            exclusive = !!exclusive;
        }
        return this.setElementStatusByFilters(adjective, false, filters, exclusive);
    };

    // Set/unset status for all elements
    /**
     * @private
     * @function highlightAllElements
     */
    /**
     *  @private
     *  @function selectAllElements
     */
    /**
     *  @private
     *  @function fadeAllElements
     */
    /**
     *  @private
     *  @function hideAllElements
     */
    Panel.prototype[`${verb}AllElements`] = function() {
        this.setAllElementStatus(adjective, true);
        return this;
    };

    /**
     * @private
     * @function unhighlightAllElements
     */
    /**
     *  @private
     *  @function unselectAllElements
     */
    /**
     * @private
     * @function unfadeAllElements
     */
    /**
     *  @private
     *  @function unhideAllElements
     */
    Panel.prototype[`${antiverb}AllElements`] = function() {
        this.setAllElementStatus(adjective, false);
        return this;
    };
});

export {Panel as default};
