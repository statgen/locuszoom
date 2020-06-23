import d3 from 'd3';

import {merge} from '../helpers/layouts';
import Requester from '../data/requester';
import Toolbar from './toolbar';
import Panel from './panel';
import {generateCurtain, generateLoader} from '../helpers/common';

/**
 * Default/ expected configuration parameters for basic plotting; most plots will override
 *
 * @protected
 * @static
 * @type {Object}
 */
const default_layout = {
    state: {},
    width: 1,
    height: 1,
    min_width: 1,
    min_height: 1,
    responsive_resize: false, // Allowed values: false, "width_only", "both" (synonym for true)
    aspect_ratio: 1,
    panels: [],
    toolbar: {
        widgets: []
    },
    panel_boundaries: true,
    mouse_guide: true
};

/**
 * Check that position fields (chr, start, end) are provided where appropriate, and ensure that the plot fits within
 *  any constraints specified by the layout
 *
 * This function has side effects; it mutates the proposed state in order to meet certain bounds checks etc.
 * @param {Object} new_state
 * @param {Number} new_state.chr
 * @param {Number} new_state.start
 * @param {Number} new_state.end
 * @param {Object} layout
 * @returns {*|{}}
 */
function _updateStatePosition(new_state, layout) {

    new_state = new_state || {};
    layout = layout || {};

    // If a "chr", "start", and "end" are present then resolve start and end
    // to numeric values that are not decimal, negative, or flipped
    let validated_region = false;
    if (typeof new_state.chr != 'undefined' && typeof new_state.start != 'undefined' && typeof new_state.end != 'undefined') {
        // Determine a numeric scale and midpoint for the attempted region,
        var attempted_midpoint = null; var attempted_scale;
        new_state.start = Math.max(parseInt(new_state.start), 1);
        new_state.end = Math.max(parseInt(new_state.end), 1);
        if (isNaN(new_state.start) && isNaN(new_state.end)) {
            new_state.start = 1;
            new_state.end = 1;
            attempted_midpoint = 0.5;
            attempted_scale = 0;
        } else if (isNaN(new_state.start) || isNaN(new_state.end)) {
            attempted_midpoint = new_state.start || new_state.end;
            attempted_scale = 0;
            new_state.start = (isNaN(new_state.start) ? new_state.end : new_state.start);
            new_state.end = (isNaN(new_state.end) ? new_state.start : new_state.end);
        } else {
            attempted_midpoint = Math.round((new_state.start + new_state.end) / 2);
            attempted_scale = new_state.end - new_state.start;
            if (attempted_scale < 0) {
                const temp = new_state.start;
                new_state.end = new_state.start;
                new_state.start = temp;
                attempted_scale = new_state.end - new_state.start;
            }
            if (attempted_midpoint < 0) {
                new_state.start = 1;
                new_state.end = 1;
                attempted_scale = 0;
            }
        }
        validated_region = true;
    }

    // Constrain w/r/t layout-defined minimum region scale
    if (!isNaN(layout.min_region_scale) && validated_region && attempted_scale < layout.min_region_scale) {
        new_state.start = Math.max(attempted_midpoint - Math.floor(layout.min_region_scale / 2), 1);
        new_state.end = new_state.start + layout.min_region_scale;
    }

    // Constrain w/r/t layout-defined maximum region scale
    if (!isNaN(layout.max_region_scale) && validated_region && attempted_scale > layout.max_region_scale) {
        new_state.start = Math.max(attempted_midpoint - Math.floor(layout.max_region_scale / 2), 1);
        new_state.end = new_state.start + layout.max_region_scale;
    }

    return new_state;
}


class Plot {
    /**
     * An independent LocusZoom object that renders a unique set of data and subpanels.
     * Many such LocusZoom objects can exist simultaneously on a single page, each having its own layout.
     *
     * This creates a new plot instance, but does not immediately render it. For practical use, it may be more convenient
     * to use the `LocusZoom.populate` helper method.
     *
     * @param {String} id The ID of the plot. Often corresponds to the ID of the container element on the page
     *   where the plot is rendered..
     * @param {DataSources} datasource Ensemble of data providers used by the plot
     * @param {Object} layout A JSON-serializable object of layout configuration parameters
    */
    constructor(id, datasource, layout) {
        /** @member Boolean} */
        this.initialized = false;
        // TODO: This makes sense for all other locuszoom elements to have; determine whether this is interface boilerplate or something that can be removed
        this.parent_plot = this;

        /** @member {String} */
        this.id = id;

        /** @member {Element} */
        this.container = null;
        /**
         * Selector for a node that will contain the plot. (set externally by populate methods)
         * @member {d3.selection}
         */
        this.svg = null;

        /** @member {Object.<String, Number>} */
        this.panels = {};
        /**
         * TODO: This is currently used by external classes that manipulate the parent and may indicate room for a helper method in the api to coordinate boilerplate
         * @protected
         * @member {String[]}
         */
        this.panel_ids_by_y_index = [];

        /**
         * Track update operations (reMap) performed on all child panels, and notify the parent plot when complete
         * TODO: Reconsider whether we need to be tracking this as global state outside of context of specific operations
         * @protected
         * @member {Promise[]}
         */
        this.remap_promises = [];


        this.layout = layout;
        merge(this.layout, default_layout); // TODO: evaluate how the default layout is applied

        /**
         * Values in the layout object may change during rendering etc. Retain a copy of the original plot state
         * @member {Object}
         */
        this._base_layout = JSON.parse(JSON.stringify(this.layout));

        /**
         * Create a shortcut to the state in the layout on the Plot. Tracking in the layout allows the plot to be created
         *   with initial state/setup.
         *
         * Tracks state of the plot, eg start and end position
         * @member {Object}
         */
        this.state = this.layout.state;

        /** @member {Requester} */
        this.lzd = new Requester(datasource);

        /**
         * Window.onresize listener (responsive layouts only)
         * TODO: .on appears to return a selection, not a listener? Check logic here
         * https://github.com/d3/d3-selection/blob/00b904b9bcec4dfaf154ae0bbc777b1fc1d7bc08/test/selection/on-test.js#L11
         * @deprecated
         * @member {d3.selection}
         */
        this.window_onresize = null;

        /**
         * Known event hooks that the panel can respond to
         * @protected
         * @member {Object}
         */
        this.event_hooks = {
            'layout_changed': [],
            'data_requested': [],
            'data_rendered': [],
            'element_clicked': [], // Select or unselect
            'element_selection': [], // Element becomes active (only)
            'match_requested': [], // A data layer is attempting to highlight matching points (internal use only)
            'panel_removed': [],
            'state_changed': []  // Only triggered when a state change causes rerender
        };

        /**
         * @callback eventCallback
         * @param {object} eventData A description of the event
         * @param {String|null} eventData.sourceID The unique identifier (eg plot or parent name) of the element that
         *  triggered the event. Will be automatically filled in if not explicitly provided.
         * @param {Object|null} eventData.context Any additional information to be passed to the callback, eg the data
         *   associated with a clicked plot element
         */

        //
        /**
         * Event information describing interaction (e.g. panning and zooming) is stored on the plot
         * TODO: Add/ document details of interaction structure as we expand
         * @member {{panel_id: String, linked_panel_ids: Array, x_linked: *, dragging: *, zooming: *}}
         * @returns {Plot}
         */
        this.interaction = {};

        // Initialize the layout
        this.initializeLayout();
    }

    /**
     * There are several events that a LocusZoom plot can "emit" when appropriate, and LocusZoom supports registering
     *   "hooks" for these events which are essentially custom functions intended to fire at certain times.
     *
     * The following plot-level events are currently supported:
     *   - `layout_changed` - context: plot - Any aspect of the plot's layout (including dimensions or state) has changed.
     *   - `data_requested` - context: plot - A request for new data from any data source used in the plot has been made.
     *   - `data_rendered` - context: plot - Data from a request has been received and rendered in the plot.
     *   - `element_clicked` - context: plot - A data element in any of the plot's data layers has been clicked.
     *   - `element_selection` - context: plot - Triggered when an element changes "selection" status, and identifies
     *        whether the element is being selected or deselected.
     *
     * To register a hook for any of these events use `plot.on('event_name', function() {})`.
     *
     * There can be arbitrarily many functions registered to the same event. They will be executed in the order they
     *   were registered. The this context bound to each event hook function is dependent on the type of event, as
     *   denoted above. For example, when data_requested is emitted the context for this in the event hook will be the
     *   plot itself, but when element_clicked is emitted the context for this in the event hook will be the element
     *   that was clicked.
     *
     * @param {String} event The name of an event (as defined in `event_hooks`)
     * @param {eventCallback} hook
     * @returns {function} The registered event listener
     */
    on(event, hook) {
        if (typeof 'event' != 'string' || !Array.isArray(this.event_hooks[event])) {
            throw new Error('Unable to register event hook, invalid event: ' + event.toString());
        }
        if (typeof hook != 'function') {
            throw new Error('Unable to register event hook, invalid hook function passed');
        }
        this.event_hooks[event].push(hook);
        return hook;
    }
    /**
     * Remove one or more previously defined event listeners
     * @param {String} event The name of an event (as defined in `event_hooks`)
     * @param {eventCallback} [hook] The callback to deregister
     * @returns {Plot}
     */
    off(event, hook) {
        const theseHooks = this.event_hooks[event];
        if (typeof 'event' != 'string' || !Array.isArray(theseHooks)) {
            throw new Error('Unable to remove event hook, invalid event: ' + event.toString());
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
     * @param {string} event A known event name
     * @param {*} eventData Data or event description that will be passed to the event listener
     * @returns {Plot}
     */
    emit(event, eventData) {
        // TODO: there are small differences between the emit implementation between plots and panels. In the future,
        //  DRY this code via mixins, and make sure to keep the interfaces compatible when refactoring.
        if (typeof 'event' != 'string' || !Array.isArray(this.event_hooks[event])) {
            throw new Error('LocusZoom attempted to throw an invalid event: ' + event.toString());
        }
        const sourceID = this.getBaseId();
        const self = this;
        this.event_hooks[event].forEach(function(hookToRun) {
            let eventContext;
            if (eventData && eventData.sourceID) {
                // If we detect that an event originated elsewhere (via bubbling or externally), preserve the context
                //  when re-emitting the event to plot-level listeners
                eventContext = eventData;
            } else {
                eventContext = {sourceID: sourceID, data: eventData || null};
            }
            // By default, any handlers fired here (either directly, or bubbled) will see the plot as the
            //  value of `this`. If a bound function is registered as a handler, the previously bound `this` will
            //  override anything provided to `call` below.
            hookToRun.call(self, eventContext);
        });
        return this;
    }

    /**
     * Track whether the target panel can respond to mouse interaction events
     * @param {String} panel_id
     * @returns {boolean}
     */
    canInteract(panel_id) {
        panel_id = panel_id || null;
        if (panel_id) {
            return ((typeof this.interaction.panel_id == 'undefined' || this.interaction.panel_id === panel_id) && !this.loading_data);
        } else {
            return !(this.interaction.dragging || this.interaction.zooming || this.loading_data);
        }
    }

    /**
     * Get an object with the x and y coordinates of the plot's origin in terms of the entire page
     *  This returns a result with absolute position relative to the page, regardless of current scrolling
     * Necessary for positioning any HTML elements over the plot
     * @returns {{x: Number, y: Number, width: Number, height: Number}}
     */
    getPageOrigin() {
        const bounding_client_rect = this.svg.node().getBoundingClientRect();
        let x_offset = document.documentElement.scrollLeft || document.body.scrollLeft;
        let y_offset = document.documentElement.scrollTop || document.body.scrollTop;
        let container = this.svg.node();
        while (container.parentNode !== null) {
            // TODO: Recursively seeks offsets for highest non-static parent node. This can lead to incorrect
            //   calculations of, for example, x coordinate relative to the page. Revisit this logic.
            container = container.parentNode;
            if (container !== document && d3.select(container).style('position') !== 'static') {
                x_offset = -1 * container.getBoundingClientRect().left;
                y_offset = -1 * container.getBoundingClientRect().top;
                break;
            }
        }
        return {
            x: x_offset + bounding_client_rect.left,
            y: y_offset + bounding_client_rect.top,
            width: bounding_client_rect.width,
            height: bounding_client_rect.height
        };
    }

    /**
     * Get the top and left offset values for the plot's container element (the div that was populated)
     * @returns {{top: number, left: number}}
     */
    getContainerOffset() {
        const offset = { top: 0, left: 0 };
        let container = this.container.offsetParent || null;
        while (container !== null) {
            offset.top += container.offsetTop;
            offset.left += container.offsetLeft;
            container = container.offsetParent || null;
        }
        return offset;
    }

    /**
     * Notify each child panel of the plot of changes in panel ordering/ arrangement
     */
    applyPanelYIndexesToPanelLayouts () {
        this.panel_ids_by_y_index.forEach((pid, idx) => {
            this.panels[pid].layout.y_index = idx;
        });
    }

    /**
     * Get the qualified ID pathname for the plot
     * @returns {String}
     */
    getBaseId () {
        return this.id;
    }

    /**
     * Helper method to sum the proportional dimensions of panels, a value that's checked often as panels are added/removed
     * @param {('Height'|'Width')} dimension
     * @returns {number}
     */
    sumProportional(dimension) {
        if (dimension !== 'height' && dimension !== 'width') {
            throw new Error('Bad dimension value passed to sumProportional');
        }
        let total = 0;
        for (let id in this.panels) {
            // Ensure every panel contributing to the sum has a non-zero proportional dimension
            if (!this.panels[id].layout['proportional_' + dimension]) {
                this.panels[id].layout['proportional_' + dimension] = 1 / Object.keys(this.panels).length;
            }
            total += this.panels[id].layout['proportional_' + dimension];
        }
        return total;
    }

    /**
     * Resize the plot to fit the bounding container
     * @returns {Plot}
     */
    rescaleSVG() {
        const clientRect = this.svg.node().getBoundingClientRect();
        this.setDimensions(clientRect.width, clientRect.height);
        return this;
    }

    /**
     * Prepare the plot for first use by performing parameter validation, setting up panels, and calculating dimensions
     * @returns {Plot}
     */
    initializeLayout() {

        // Sanity check layout values
        if (isNaN(this.layout.width) || this.layout.width <= 0) {
            throw new Error('Plot layout parameter `width` must be a positive number');
        }
        if (isNaN(this.layout.height) || this.layout.height <= 0) {
            throw new Error('Plot layout parameter `width` must be a positive number');
        }
        if (isNaN(this.layout.aspect_ratio) || this.layout.aspect_ratio <= 0) {
            throw new Error('Plot layout parameter `aspect_ratio` must be a positive number');
        }
        if (this.layout.responsive_resize === true) {
            // Backwards compatible support
            console.warn('LocusZoom "responsive_resize" specifies a deprecated value. The new value should be "both". Please update your layout.');
            this.layout.responsive_resize = 'both';
        }
        const RESIZE_MODES = [false, 'both', 'width_only'];
        if (RESIZE_MODES.indexOf(this.layout.responsive_resize) === -1) {
            throw new Error('LocusZoom option "responsive_resize" should specify one of the following modes: ' + RESIZE_MODES.join(', '));
        }

        // If this is a responsive layout then set a namespaced/unique onresize event listener on the window
        if (this.layout.responsive_resize) {
            this.window_onresize = d3.select(window).on('resize.lz-' + this.id, () => {
                this.rescaleSVG();
            });
            // Forcing one additional setDimensions() call after the page is loaded clears up
            // any disagreements between the initial layout and the loaded responsive container's size
            d3.select(window).on('load.lz-' + this.id, () => {
                this.setDimensions();
            });
        }

        // Add panels
        this.layout.panels.forEach((panel_layout) => {
            this.addPanel(panel_layout);
        });

        return this;
    }

    /**
     * Set the dimensions for a plot, and ensure that panels are sized and positioned correctly.
     *
     * If dimensions are provided, resizes each panel proportionally to match the new plot dimensions. Otherwise,
     *   calculates the appropriate plot dimensions based on all panels.
     * @param {Number} [width] If provided and larger than minimum size, set plot to this width
     * @param {Number} [height] If provided and larger than minimum size, set plot to this height
     * @returns {Plot}
     */
    setDimensions(width, height) {

        let id;

        // Update minimum allowable width and height by aggregating minimums from panels, then apply minimums to containing element.
        let min_width = parseFloat(this.layout.min_width) || 0;
        let min_height = parseFloat(this.layout.min_height) || 0;
        for (id in this.panels) {
            min_width = Math.max(min_width, this.panels[id].layout.min_width);
            if (parseFloat(this.panels[id].layout.min_height) > 0 && parseFloat(this.panels[id].layout.proportional_height) > 0) {
                min_height = Math.max(min_height, (this.panels[id].layout.min_height / this.panels[id].layout.proportional_height));
            }
        }
        this.layout.min_width = Math.max(min_width, 1);
        this.layout.min_height = Math.max(min_height, 1);
        d3.select(this.svg.node().parentNode).style({
            'min-width': this.layout.min_width + 'px',
            'min-height': this.layout.min_height + 'px'
        });

        // If width and height arguments were passed then adjust them against plot minimums if necessary.
        // Then resize the plot and proportionally resize panels to fit inside the new plot dimensions.
        if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0) {
            this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
            this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
            this.layout.aspect_ratio = this.layout.width / this.layout.height;
            // Override discrete values if resizing responsively
            if (this.layout.responsive_resize) {
                // All resize modes will affect width
                if (this.svg) {
                    this.layout.width = Math.max(this.svg.node().parentNode.getBoundingClientRect().width, this.layout.min_width);
                }

                if (this.layout.responsive_resize === 'both') { // Then also change the height
                    this.layout.height = this.layout.width / this.layout.aspect_ratio;
                    if (this.layout.height < this.layout.min_height) {
                        this.layout.height = this.layout.min_height;
                        this.layout.width  = this.layout.height * this.layout.aspect_ratio;
                    }
                }
            }
            // Resize/reposition panels to fit, update proportional origins if necessary
            let y_offset = 0;
            this.panel_ids_by_y_index.forEach((panel_id) => {
                const panel_width = this.layout.width;
                const panel_height = this.panels[panel_id].layout.proportional_height * this.layout.height;
                this.panels[panel_id].setDimensions(panel_width, panel_height);
                this.panels[panel_id].setOrigin(0, y_offset);
                this.panels[panel_id].layout.proportional_origin.x = 0;
                this.panels[panel_id].layout.proportional_origin.y = y_offset / this.layout.height;
                y_offset += panel_height;
                this.panels[panel_id].toolbar.update();
            });
        }

        // If width and height arguments were NOT passed (and panels exist) then determine the plot dimensions
        // by making it conform to panel dimensions, assuming panels are already positioned correctly.
        else if (Object.keys(this.panels).length) {
            this.layout.width = 0;
            this.layout.height = 0;
            for (id in this.panels) {
                this.layout.width = Math.max(this.panels[id].layout.width, this.layout.width);
                this.layout.height += this.panels[id].layout.height;
            }
            this.layout.width = Math.max(this.layout.width, this.layout.min_width);
            this.layout.height = Math.max(this.layout.height, this.layout.min_height);
        }

        // Keep aspect ratio in agreement with dimensions
        this.layout.aspect_ratio = this.layout.width / this.layout.height;

        // Apply layout width and height as discrete values or viewbox values
        if (this.svg !== null) {
            if (this.layout.responsive_resize === 'both') {
                this.svg
                    .attr('viewBox', '0 0 ' + this.layout.width + ' ' + this.layout.height)
                    .attr('preserveAspectRatio', 'xMinYMin meet');
            } else {
                this.svg.attr('width', this.layout.width).attr('height', this.layout.height);
            }
        }

        // If the plot has been initialized then trigger some necessary render functions
        if (this.initialized) {
            this.panel_boundaries.position();
            this.toolbar.update();
            this.curtain.update();
            this.loader.update();
        }

        return this.emit('layout_changed');
    }

    /**
     * Create a new panel from a layout, and handle the work of initializing and placing the panel on the plot
     * @param {Object} layout
     * @returns {Panel}
     */
    addPanel(layout) {

        // Sanity checks
        if (typeof layout !== 'object') {
            throw new Error('Invalid panel layout passed to addPanel()');
        }

        // Create the Panel and set its parent
        const panel = new Panel(layout, this);

        // Store the Panel on the Plot
        this.panels[panel.id] = panel;

        // If a discrete y_index was set in the layout then adjust other panel y_index values to accommodate this one
        if (panel.layout.y_index !== null && !isNaN(panel.layout.y_index)
            && this.panel_ids_by_y_index.length > 0) {
            // Negative y_index values should count backwards from the end, so convert negatives to appropriate values here
            if (panel.layout.y_index < 0) {
                panel.layout.y_index = Math.max(this.panel_ids_by_y_index.length + panel.layout.y_index, 0);
            }
            this.panel_ids_by_y_index.splice(panel.layout.y_index, 0, panel.id);
            this.applyPanelYIndexesToPanelLayouts();
        } else {
            const length = this.panel_ids_by_y_index.push(panel.id);
            this.panels[panel.id].layout.y_index = length - 1;
        }

        // Determine if this panel was already in the layout.panels array.
        // If it wasn't, add it. Either way store the layout.panels array index on the panel.
        let layout_idx = null;
        this.layout.panels.forEach(function(panel_layout, idx) {
            if (panel_layout.id === panel.id) { layout_idx = idx; }
        });
        if (layout_idx === null) {
            layout_idx = this.layout.panels.push(this.panels[panel.id].layout) - 1;
        }
        this.panels[panel.id].layout_idx = layout_idx;

        // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
        if (this.initialized) {
            this.positionPanels();
            // Initialize and load data into the new panel
            this.panels[panel.id].initialize();
            this.panels[panel.id].reMap();
            // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
            // positioning. TODO: make this additional call unnecessary.
            this.setDimensions(this.layout.width, this.layout.height);
        }

        return this.panels[panel.id];
    }


    /**
     * Clear all state, tooltips, and other persisted data associated with one (or all) panel(s) in the plot
     *
     * This is useful when reloading an existing plot with new data, eg "click for genome region" links.
     *   This is a utility method for custom usage. It is not fired automatically during normal rerender of existing panels
     *   @param {String} [panelId] If provided, clear state for only this panel. Otherwise, clear state for all panels.
     *   @param {('wipe'|'reset')} [mode='wipe'] Optionally specify how state should be cleared. `wipe` deletes all data
     *     and is useful for when the panel is being removed; `reset` is best when the panel will be reused in place.
     * @returns {Plot}
     */
    clearPanelData(panelId, mode) {
        mode = mode || 'wipe';

        // TODO: Add unit tests for this method
        let panelsList;
        if (panelId) {
            panelsList = [panelId];
        } else {
            panelsList = Object.keys(this.panels);
        }
        const self = this;
        panelsList.forEach(function(pid) {
            self.panels[pid].data_layer_ids_by_z_index.forEach(function(dlid) {
                const layer = self.panels[pid].data_layers[dlid];
                layer.destroyAllTooltips();

                delete layer.layer_state;
                delete self.layout.state[layer.state_id];
                if(mode === 'reset') {
                    layer._setDefaultState();
                }
            });
        });
        return this;
    }

    /**
     * Remove the panel from the plot, and clear any state, tooltips, or other visual elements belonging to nested content
     * @param {String} id
     * @returns {Plot}
     */
    removePanel(id) {
        if (!this.panels[id]) {
            throw new Error('Unable to remove panel, ID not found: ' + id);
        }

        // Hide all panel boundaries
        this.panel_boundaries.hide();

        // Destroy all tooltips and state vars for all data layers on the panel
        this.clearPanelData(id);

        // Remove all panel-level HTML overlay elements
        this.panels[id].loader.hide();
        this.panels[id].toolbar.destroy(true);
        this.panels[id].curtain.hide();

        // Remove the svg container for the panel if it exists
        if (this.panels[id].svg.container) {
            this.panels[id].svg.container.remove();
        }

        // Delete the panel and its presence in the plot layout and state
        this.layout.panels.splice(this.panels[id].layout_idx, 1);
        delete this.panels[id];
        delete this.layout.state[id];

        // Update layout_idx values for all remaining panels
        this.layout.panels.forEach((panel_layout, idx) => {
            this.panels[panel_layout.id].layout_idx = idx;
        });

        // Remove the panel id from the y_index array
        this.panel_ids_by_y_index.splice(this.panel_ids_by_y_index.indexOf(id), 1);
        this.applyPanelYIndexesToPanelLayouts();

        // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
        if (this.initialized) {
            // Allow the plot to shrink when panels are removed, by forcing it to recalculate min dimensions from scratch
            this.layout.min_height = this._base_layout.min_height;
            this.layout.min_width = this._base_layout.min_width;

            this.positionPanels();
            // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
            // positioning. TODO: make this additional call unnecessary.
            this.setDimensions(this.layout.width, this.layout.height);
        }

        this.emit('panel_removed', id);

        return this;
    }


    /**
     * Automatically position panels based on panel positioning rules and values.
     * Keep panels from overlapping vertically by adjusting origins, and keep the sum of proportional heights at 1.
     *
     * TODO: This logic currently only supports dynamic positioning of panels to prevent overlap in a VERTICAL orientation.
     *      Some framework exists for positioning panels in horizontal orientations as well (width, proportional_width, origin.x, etc.)
     *      but the logic for keeping these user-definable values straight approaches the complexity of a 2D box-packing algorithm.
     *      That's complexity we don't need right now, and may not ever need, so it's on hiatus until a use case materializes.
     */
    positionPanels() {

        let id;

        // We want to enforce that all x-linked panels have consistent horizontal margins
        // (to ensure that aligned items stay aligned despite inconsistent initial layout parameters)
        // NOTE: This assumes panels have consistent widths already. That should probably be enforced too!
        const x_linked_margins = { left: 0, right: 0 };

        // Proportional heights for newly added panels default to null unless explicitly set, so determine appropriate
        // proportional heights for all panels with a null value from discretely set dimensions.
        // Likewise handle default nulls for proportional widths, but instead just force a value of 1 (full width)
        for (id in this.panels) {
            if (this.panels[id].layout.proportional_height === null) {
                this.panels[id].layout.proportional_height = this.panels[id].layout.height / this.layout.height;
            }
            if (this.panels[id].layout.proportional_width === null) {
                this.panels[id].layout.proportional_width = 1;
            }
            if (this.panels[id].layout.interaction.x_linked) {
                x_linked_margins.left = Math.max(x_linked_margins.left, this.panels[id].layout.margin.left);
                x_linked_margins.right = Math.max(x_linked_margins.right, this.panels[id].layout.margin.right);
            }
        }

        // Sum the proportional heights and then adjust all proportionally so that the sum is exactly 1
        const total_proportional_height = this.sumProportional('height');
        if (!total_proportional_height) {
            return this;
        }
        const proportional_adjustment = 1 / total_proportional_height;
        for (id in this.panels) {
            this.panels[id].layout.proportional_height *= proportional_adjustment;
        }

        // Update origins on all panels without changing plot-level dimensions yet
        // Also apply x-linked margins to x-linked panels, updating widths as needed
        let y_offset = 0;
        this.panel_ids_by_y_index.forEach((panel_id) => {
            this.panels[panel_id].setOrigin(0, y_offset);
            this.panels[panel_id].layout.proportional_origin.x = 0;
            y_offset += this.panels[panel_id].layout.height;
            if (this.panels[panel_id].layout.interaction.x_linked) {
                const delta = Math.max(x_linked_margins.left - this.panels[panel_id].layout.margin.left, 0)
                    + Math.max(x_linked_margins.right - this.panels[panel_id].layout.margin.right, 0);
                this.panels[panel_id].layout.width += delta;
                this.panels[panel_id].layout.margin.left = x_linked_margins.left;
                this.panels[panel_id].layout.margin.right = x_linked_margins.right;
                this.panels[panel_id].layout.cliparea.origin.x = x_linked_margins.left;
            }
        });
        const calculated_plot_height = y_offset;
        this.panel_ids_by_y_index.forEach((panel_id) => {
            this.panels[panel_id].layout.proportional_origin.y = this.panels[panel_id].layout.origin.y / calculated_plot_height;
        });

        // Update dimensions on the plot to accommodate repositioned panels
        this.setDimensions();

        // Set dimensions on all panels using newly set plot-level dimensions and panel-level proportional dimensions
        this.panel_ids_by_y_index.forEach((panel_id) => {
            this.panels[panel_id].setDimensions(this.layout.width * this.panels[panel_id].layout.proportional_width,
                                                this.layout.height * this.panels[panel_id].layout.proportional_height);
        });

        return this;

    }

    /**
     * Prepare the first rendering of the plot. This includes initializing the individual panels, but also creates shared
     *   elements such as mouse events, panel guides/boundaries, and loader/curtain.
     *
     * @returns {Plot}
     */
    initialize() {

        // Ensure proper responsive class is present on the containing node if called for
        if (this.layout.responsive_resize) {
            d3.select(this.container).classed('lz-container-responsive', true);
        }

        // Create an element/layer for containing mouse guides
        if (this.layout.mouse_guide) {
            const mouse_guide_svg = this.svg.append('g')
                .attr('class', 'lz-mouse_guide').attr('id', this.id + '.mouse_guide');
            const mouse_guide_vertical_svg = mouse_guide_svg.append('rect')
                .attr('class', 'lz-mouse_guide-vertical').attr('x', -1);
            const mouse_guide_horizontal_svg = mouse_guide_svg.append('rect')
                .attr('class', 'lz-mouse_guide-horizontal').attr('y', -1);
            this.mouse_guide = {
                svg: mouse_guide_svg,
                vertical: mouse_guide_vertical_svg,
                horizontal: mouse_guide_horizontal_svg
            };
        }

        // Add curtain and loader prototpyes to the plot
        this.curtain = generateCurtain.call(this);
        this.loader = generateLoader.call(this);

        // Create the panel_boundaries object with show/position/hide methods
        this.panel_boundaries = {
            parent: this,
            hide_timeout: null,
            showing: false,
            dragging: false,
            selectors: [],
            corner_selector: null,
            show: function() {
                // Generate panel boundaries
                if (!this.showing && !this.parent.curtain.showing) {
                    this.showing = true;
                    // Loop through all panels to create a horizontal boundary for each
                    this.parent.panel_ids_by_y_index.forEach((panel_id, panel_idx) => {
                        const selector = d3.select(this.parent.svg.node().parentNode).insert('div', '.lz-data_layer-tooltip')
                            .attr('class', 'lz-panel-boundary')
                            .attr('title', 'Resize panel');
                        selector.append('span');
                        const panel_resize_drag = d3.behavior.drag();
                        panel_resize_drag.on('dragstart', () => {
                            this.dragging = true;
                        });
                        panel_resize_drag.on('dragend', () => {
                            this.dragging = false;
                        });
                        panel_resize_drag.on('drag', () => {
                            // First set the dimensions on the panel we're resizing
                            const this_panel = this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]];
                            const original_panel_height = this_panel.layout.height;
                            this_panel.setDimensions(this_panel.layout.width, this_panel.layout.height + d3.event.dy);
                            const panel_height_change = this_panel.layout.height - original_panel_height;
                            const new_calculated_plot_height = this.parent.layout.height + panel_height_change;
                            // Next loop through all panels.
                            // Update proportional dimensions for all panels including the one we've resized using discrete heights.
                            // Reposition panels with a greater y-index than this panel to their appropriate new origin.
                            this.parent.panel_ids_by_y_index.forEach((loop_panel_id, loop_panel_idx) => {
                                const loop_panel = this.parent.panels[this.parent.panel_ids_by_y_index[loop_panel_idx]];
                                loop_panel.layout.proportional_height = loop_panel.layout.height / new_calculated_plot_height;
                                if (loop_panel_idx > panel_idx) {
                                    loop_panel.setOrigin(loop_panel.layout.origin.x, loop_panel.layout.origin.y + panel_height_change);
                                    loop_panel.toolbar.position();
                                }
                            });
                            // Reset dimensions on the entire plot and reposition panel boundaries
                            this.parent.positionPanels();
                            this.position();
                        });
                        selector.call(panel_resize_drag);
                        this.parent.panel_boundaries.selectors.push(selector);
                    });
                    // Create a corner boundary / resize element on the bottom-most panel that resizes the entire plot
                    const corner_selector = d3.select(this.parent.svg.node().parentNode).insert('div', '.lz-data_layer-tooltip')
                        .attr('class', 'lz-panel-corner-boundary')
                        .attr('title', 'Resize plot');
                    corner_selector.append('span').attr('class', 'lz-panel-corner-boundary-outer');
                    corner_selector.append('span').attr('class', 'lz-panel-corner-boundary-inner');
                    const corner_drag = d3.behavior.drag();
                    corner_drag.on('dragstart', () => {
                        this.dragging = true;
                    });
                    corner_drag.on('dragend', () => {
                        this.dragging = false;
                    });
                    corner_drag.on('drag', () => {
                        this.parent.setDimensions(this.layout.width + d3.event.dx, this.layout.height + d3.event.dy);
                    });
                    corner_selector.call(corner_drag);
                    this.parent.panel_boundaries.corner_selector = corner_selector;
                }
                return this.position();
            },
            position: function() {
                if (!this.showing) { return this; }
                // Position panel boundaries
                const plot_page_origin = this.parent.getPageOrigin();
                this.selectors.forEach((selector, panel_idx) => {
                    const panel_page_origin = this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]].getPageOrigin();
                    const left = plot_page_origin.x;
                    const top = panel_page_origin.y + this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]].layout.height - 12;
                    const width = this.parent.layout.width - 1;
                    selector.style({
                        top: top + 'px',
                        left: left + 'px',
                        width: width + 'px'
                    });
                    selector.select('span').style({
                        width: width + 'px'
                    });
                });
                // Position corner selector
                const corner_padding = 10;
                const corner_size = 16;
                this.corner_selector.style({
                    top: (plot_page_origin.y + this.parent.layout.height - corner_padding - corner_size) + 'px',
                    left: (plot_page_origin.x + this.parent.layout.width - corner_padding - corner_size) + 'px'
                });
                return this;
            },
            hide: function() {
                if (!this.showing) { return this; }
                this.showing = false;
                // Remove panel boundaries
                this.selectors.forEach(function(selector) { selector.remove(); });
                this.selectors = [];
                // Remove corner boundary
                this.corner_selector.remove();
                this.corner_selector = null;
                return this;
            }
        };

        // Show panel boundaries stipulated by the layout (basic toggle, only show on mouse over plot)
        if (this.layout.panel_boundaries) {
            d3.select(this.svg.node().parentNode).on('mouseover.' + this.id + '.panel_boundaries', () => {
                clearTimeout(this.panel_boundaries.hide_timeout);
                this.panel_boundaries.show();
            });
            d3.select(this.svg.node().parentNode).on('mouseout.' + this.id + '.panel_boundaries', () => {
                this.panel_boundaries.hide_timeout = setTimeout(() => {
                    this.panel_boundaries.hide();
                }, 300);
            });
        }

        // Create the toolbar object and immediately show it
        this.toolbar = new Toolbar(this).show();

        // Initialize all panels
        for (let id in this.panels) {
            this.panels[id].initialize();
        }

        // Define plot-level mouse events
        const namespace = '.' + this.id;
        if (this.layout.mouse_guide) {
            const mouseout_mouse_guide = () => {
                this.mouse_guide.vertical.attr('x', -1);
                this.mouse_guide.horizontal.attr('y', -1);
            };
            const mousemove_mouse_guide = () => {
                const coords = d3.mouse(this.svg.node());
                this.mouse_guide.vertical.attr('x', coords[0]);
                this.mouse_guide.horizontal.attr('y', coords[1]);
            };
            this.svg
                .on('mouseout' + namespace + '-mouse_guide', mouseout_mouse_guide)
                .on('touchleave' + namespace + '-mouse_guide', mouseout_mouse_guide)
                .on('mousemove' + namespace + '-mouse_guide', mousemove_mouse_guide);
        }
        const mouseup = () => {
            this.stopDrag();
        };
        const mousemove = () => {
            if (this.interaction.dragging) {
                const coords = d3.mouse(this.svg.node());
                if (d3.event) {
                    d3.event.preventDefault();
                }
                this.interaction.dragging.dragged_x = coords[0] - this.interaction.dragging.start_x;
                this.interaction.dragging.dragged_y = coords[1] - this.interaction.dragging.start_y;
                this.panels[this.interaction.panel_id].render();
                this.interaction.linked_panel_ids.forEach((panel_id) => {
                    this.panels[panel_id].render();
                });
            }
        };
        this.svg
            .on('mouseup' + namespace, mouseup)
            .on('touchend' + namespace, mouseup)
            .on('mousemove' + namespace, mousemove)
            .on('touchmove' + namespace, mousemove);

        // Add an extra namespaced mouseup handler to the containing body, if there is one
        // This helps to stop interaction events gracefully when dragging outside of the plot element
        if (!d3.select('body').empty()) {
            d3.select('body')
                .on('mouseup' + namespace, mouseup)
                .on('touchend' + namespace, mouseup);
        }

        this.on('match_requested', (eventData) => {
            // Layers can broadcast that a specific point has been selected, and the plot will tell every other layer
            //  to look for that value. Whenever a point is de-selected, it clears the match.
            const data = eventData.data;
            const to_send = (data.active ? data.value : null);
            this.applyState({ lz_match_value: to_send });
        });

        this.initialized = true;

        // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
        // positioning. TODO: make this additional call unnecessary.
        const client_rect = this.svg.node().getBoundingClientRect();
        var width = client_rect.width ? client_rect.width : this.layout.width;
        const height = client_rect.height ? client_rect.height : this.layout.height;
        this.setDimensions(width, height);

        return this;

    }

    /**
     * Refresh (or fetch) a plot's data from sources, regardless of whether position or state has changed
     * @returns {Promise}
     */
    refresh() {
        return this.applyState();
    }


    /**
     * A user-defined callback function that can receive (and potentially act on) new plot data.
     * @callback externalDataCallback
     * @param {Object} new_data The body resulting from a data request. This represents the same information that would be passed to
     *  a data layer making an equivalent request.
     */

    /**
     * A user-defined callback function that can respond to errors received during a previous operation
     * @callback externalErrorCallback
     * @param err A representation of the error that occurred
     */

    /**
     * Allow newly fetched data to be made available outside the LocusZoom plot. For example, a callback could be
     *  registered to draw an HTML table of top GWAS hits, and update that table whenever the plot region changes.
     *
     * This is a convenience method for external hooks. It registers an event listener and returns parsed data,
     *  using the same fields syntax and underlying methods as data layers.
     *
     * @param {String[]} fields An array of field names and transforms, in the same syntax used by a data layer.
     *  Different data sources should be prefixed by the source name.
     * @param {externalDataCallback} success_callback Used defined function that is automatically called any time that
     *  new data is received by the plot.
     * @param {Object} [opts] Options
     * @param {externalErrorCallback} [opts.onerror] User defined function that is automatically called if a problem
     *  occurs during the data request or subsequent callback operations
     * @param {boolean} [opts.discrete=false] Normally the callback will subscribe to the combined body from the chain,
     *  which may not be in a format that matches what the external callback wants to do. If discrete=true, returns the
     *  uncombined record info
     *  @return {function} The newly created event listener, to allow for later cleanup/removal
     */
    subscribeToData(fields, success_callback, opts) {
        opts = opts || {};

        // Register an event listener that is notified whenever new data has been rendered
        const error_callback = opts.onerror || function (err) {
            console.log('An error occurred while acting on an external callback', err);
        };
        const self = this;

        const listener = function () {
            try {
                self.lzd.getData(self.state, fields)
                    .then(function (new_data) {
                        success_callback(opts.discrete ? new_data.discrete : new_data.body);
                    }).catch(error_callback);
            } catch (error) {
                // In certain cases, errors are thrown before a promise can be generated, and LZ error display seems to rely on these errors bubbling up
                error_callback(error);
            }
        };
        this.on('data_rendered', listener);
        return listener;
    }

    /**
     * Update state values and trigger a pull for fresh data on all data sources for all data layers
     * @param state_changes
     * @returns {Promise} A promise that resolves when all data fetch and update operations are complete
     */
    applyState(state_changes) {
        state_changes = state_changes || {};
        if (typeof state_changes != 'object') {
            throw new Error('applyState only accepts an object; ' + (typeof state_changes) + ' given');
        }

        // Track what parameters will be modified. For bounds checking, we must take some preset values into account.
        let mods = { chr: this.state.chr, start: this.state.start, end: this.state.end };
        for (var property in state_changes) {
            mods[property] = state_changes[property];
        }
        mods = _updateStatePosition(mods, this.layout);

        // Apply new state to the actual state
        for (property in mods) {
            this.state[property] = mods[property];
        }

        // Generate requests for all panels given new state
        this.emit('data_requested');
        this.remap_promises = [];
        this.loading_data = true;
        for (let id in this.panels) {
            this.remap_promises.push(this.panels[id].reMap());
        }

        return Promise.all(this.remap_promises)
            .catch((error) => {
                console.error(error);
                this.curtain.show(error.message || error);
                this.loading_data = false;
            })
            .then(() => {
                // Update toolbar / widgets
                this.toolbar.update();

                // Apply panel-level state values
                this.panel_ids_by_y_index.forEach((panel_id) => {
                    const panel = this.panels[panel_id];
                    panel.toolbar.update();
                    // Apply data-layer-level state values
                    panel.data_layer_ids_by_z_index.forEach((data_layer_id) => {
                        panel.data_layers[data_layer_id].applyAllElementStatus();
                    });
                });

                // Emit events
                this.emit('layout_changed');
                this.emit('data_rendered');
                this.emit('state_changed', state_changes);

                this.loading_data = false;

            });
    }

    /**
     * Register interactions along the specified axis, provided that the target panel allows interaction.
     *
     * @param {Panel} panel
     * @param {('x_tick'|'y1_tick'|'y2_tick')} method The direction (axis) along which dragging is being performed.
     * @returns {Plot}
     */
    startDrag(panel, method) {
        panel = panel || null;
        method = method || null;

        let axis = null;
        switch (method) {
        case 'background':
        case 'x_tick':
            axis = 'x';
            break;
        case 'y1_tick':
            axis = 'y1';
            break;
        case 'y2_tick':
            axis = 'y2';
            break;
        }

        if (!(panel instanceof Panel) || !axis || !this.canInteract()) {
            return this.stopDrag();
        }

        const coords = d3.mouse(this.svg.node());
        this.interaction = {
            panel_id: panel.id,
            linked_panel_ids: panel.getLinkedPanelIds(axis),
            dragging: {
                method: method,
                start_x: coords[0],
                start_y: coords[1],
                dragged_x: 0,
                dragged_y: 0,
                axis: axis
            }
        };

        this.svg.style('cursor', 'all-scroll');

        return this;
    }

    /**
     * Process drag interactions across the target panel and synchronize plot state across other panels in sync;
     *   clear the event when complete
     * @returns {Plot}
     */
    stopDrag() {

        if (!this.interaction.dragging) { return this; }

        if (typeof this.panels[this.interaction.panel_id] != 'object') {
            this.interaction = {};
            return this;
        }
        const panel = this.panels[this.interaction.panel_id];

        // Helper function to find the appropriate axis layouts on child data layers
        // Once found, apply the extent as floor/ceiling and remove all other directives
        // This forces all associated axes to conform to the extent generated by a drag action
        const overrideAxisLayout = function (axis, axis_number, extent) {
            panel.data_layer_ids_by_z_index.forEach(function (id) {
                if (panel.data_layers[id].layout[axis + '_axis'].axis === axis_number) {
                    panel.data_layers[id].layout[axis + '_axis'].floor = extent[0];
                    panel.data_layers[id].layout[axis + '_axis'].ceiling = extent[1];
                    delete panel.data_layers[id].layout[axis + '_axis'].lower_buffer;
                    delete panel.data_layers[id].layout[axis + '_axis'].upper_buffer;
                    delete panel.data_layers[id].layout[axis + '_axis'].min_extent;
                    delete panel.data_layers[id].layout[axis + '_axis'].ticks;
                }
            });
        };

        switch(this.interaction.dragging.method) {
        case 'background':
        case 'x_tick':
            if (this.interaction.dragging.dragged_x !== 0) {
                overrideAxisLayout('x', 1, panel.x_extent);
                this.applyState({ start: panel.x_extent[0], end: panel.x_extent[1] });
            }
            break;
        case 'y1_tick':
        case 'y2_tick':
            if (this.interaction.dragging.dragged_y !== 0) {
                // TODO: Hardcoded assumption of only two possible axes with single-digit #s (switch/case)
                const y_axis_number = parseInt(this.interaction.dragging.method[1]);
                overrideAxisLayout('y', y_axis_number, panel['y' + y_axis_number + '_extent']);
            }
            break;
        }

        this.interaction = {};
        this.svg.style('cursor', null);

        return this;

    }
}

export {Plot as default};

// Only for testing
export { _updateStatePosition };