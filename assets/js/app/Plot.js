/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Plot Class

  An Plot is an independent LocusZoom object. Many such LocusZoom objects can exist simultaneously
  on a single page, each having its own layout.

*/

LocusZoom.Plot = function(id, datasource, layout) {

    this.initialized = false;

    this.id = id;
    
    this.svg = null;

    this.panels = {};
    this.panel_ids_by_y_index = [];
    this.applyPanelYIndexesToPanelLayouts = function(){
        this.panel_ids_by_y_index.forEach(function(pid, idx){
            this.panels[pid].layout.y_index = idx;
        }.bind(this));
    };

    this.getBaseId = function(){
        return this.id;
    };

    this.remap_promises = [];

    // The layout is a serializable object used to describe the composition of the Plot
    // If no layout was passed, use the Standard Layout
    // Otherwise merge whatever was passed with the Default Layout
    if (typeof layout == "undefined"){
        this.layout = LocusZoom.mergeLayouts({}, LocusZoom.StandardLayout);
    } else {
        this.layout = layout;
    }
    LocusZoom.mergeLayouts(this.layout, LocusZoom.Plot.DefaultLayout);

    // Create a shortcut to the state in the layout on the Plot
    this.state = this.layout.state;
    
    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);

    // Window.onresize listener (responsive layouts only)
    this.window_onresize = null;

    // Event hooks
    this.event_hooks = {
        "layout_changed": [],
        "data_requested": [],
        "data_rendered": [],
        "element_clicked": []
    };
    this.on = function(event, hook){
        if (typeof "event" != "string" || !Array.isArray(this.event_hooks[event])){
            throw("Unable to register event hook, invalid event: " + event.toString());
        }
        if (typeof hook != "function"){
            throw("Unable to register event hook, invalid hook function passed");
        }
        this.event_hooks[event].push(hook);
        return this;
    };
    this.emit = function(event, context){
        if (typeof "event" != "string" || !Array.isArray(this.event_hooks[event])){
            throw("LocusZoom attempted to throw an invalid event: " + event.toString());
        }
        context = context || this;
        this.event_hooks[event].forEach(function(hookToRun) {
            hookToRun.call(context);
        });
        return this;
    };

    // Get an object with the x and y coordinates of the Plot's origin in terms of the entire page
    // Necessary for positioning any HTML elements over the plot
    this.getPageOrigin = function(){
        var bounding_client_rect = this.svg.node().getBoundingClientRect();
        var x_offset = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y_offset = document.documentElement.scrollTop || document.body.scrollTop;
        var container = this.svg.node();
        while (container.parentNode != null){
            container = container.parentNode;
            if (container != document && d3.select(container).style("position") != "static"){
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
    };

    // Initialize the layout
    this.initializeLayout();

    return this;
  
};

// Default Layout
LocusZoom.Plot.DefaultLayout = {
    state: {},
    width: 1,
    height: 1,
    min_width: 1,
    min_height: 1,
    responsive_resize: false,
    aspect_ratio: 1,
    panels: [],
    dashboard: {
        components: []
    },
    panel_boundaries: true
};

// Helper method to sum the proportional dimensions of panels, a value that's checked often as panels are added/removed
LocusZoom.Plot.prototype.sumProportional = function(dimension){
    if (dimension != "height" && dimension != "width"){
        throw ("Bad dimension value passed to LocusZoom.Plot.prototype.sumProportional");
    }
    var total = 0;
    for (var id in this.panels){
        // Ensure every panel contributing to the sum has a non-zero proportional dimension
        if (!this.panels[id].layout["proportional_" + dimension]){
            this.panels[id].layout["proportional_" + dimension] = 1 / Object.keys(this.panels).length;
        }
        total += this.panels[id].layout["proportional_" + dimension];
    }
    return total;
};

LocusZoom.Plot.prototype.rescaleSVG = function(){
    var clientRect = this.svg.node().parentNode.getBoundingClientRect();
    this.setDimensions(clientRect.width, clientRect.height);
    return this;
};

LocusZoom.Plot.prototype.initializeLayout = function(){

    // Sanity check layout values
    // TODO: Find a way to generally abstract this, maybe into an object that models allowed layout values?
    if (isNaN(this.layout.width) || this.layout.width <= 0){
        throw ("Plot layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.height) || this.layout.height <= 0){
        throw ("Plot layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.aspect_ratio) || this.layout.aspect_ratio <= 0){
        throw ("Plot layout parameter `aspect_ratio` must be a positive number");
    }

    // If this is a responsive layout then set a namespaced/unique onresize event listener on the window
    if (this.layout.responsive_resize){
        this.window_onresize = d3.select(window).on("resize.lz-"+this.id, function(){
            this.rescaleSVG();
        }.bind(this));
        // Forcing one additional setDimensions() call after the page is loaded clears up
        // any disagreements between the initial layout and the loaded responsive container's size
        d3.select(window).on("load.lz-"+this.id, function(){ this.setDimensions(); }.bind(this));
    }

    // Add panels
    this.layout.panels.forEach(function(panel_layout){
        this.addPanel(panel_layout);
    }.bind(this));

    return this;
};

/**
  Set the dimensions for an plot.
  This function works in two different ways:
  1. If passed a discrete width and height:
     * Adjust the plot to match those exact values (lower-bounded by minimum panel dimensions)
     * Resize panels within the plot proportionally to match the new plot dimensions
  2. If NOT passed discrete width and height:
     * Assume panels within are sized and positioned correctly
     * Calculate appropriate plot dimesions from panels contained within and update plot
*/
LocusZoom.Plot.prototype.setDimensions = function(width, height){
    
    var id;

    // Update minimum allowable width and height by aggregating minimums from panels.
    var min_width = null;
    var min_height = null;
    for (id in this.panels){
        min_width = Math.max(min_width, this.panels[id].layout.min_width);
        min_height = Math.max(min_height, (this.panels[id].layout.min_height / this.panels[id].layout.proportional_height));
    }
    this.layout.min_width = Math.max(min_width, 1);
    this.layout.min_height = Math.max(min_height, 1);

    // If width and height arguments were passed then adjust them against plot minimums if necessary.
    // Then resize the plot and proportionally resize panels to fit inside the new plot dimensions.
    if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
        // Override discrete values if resizing responsively
        if (this.layout.responsive_resize){
            if (this.svg){
                this.layout.width = Math.max(this.svg.node().parentNode.getBoundingClientRect().width, this.layout.min_width);
            }
            this.layout.height = this.layout.width / this.layout.aspect_ratio;
            if (this.layout.height < this.layout.min_height){
                this.layout.height = this.layout.min_height;
                this.layout.width  = this.layout.height * this.layout.aspect_ratio;
            }
        }
        // Resize/reposition panels to fit, update proportional origins if necessary
        var y_offset = 0;
        this.panel_ids_by_y_index.forEach(function(panel_id){
            var panel_width = this.layout.width;
            var panel_height = this.panels[panel_id].layout.proportional_height * this.layout.height;
            this.panels[panel_id].setDimensions(panel_width, panel_height);
            this.panels[panel_id].setOrigin(0, y_offset);
            this.panels[panel_id].layout.proportional_origin.x = 0;
            this.panels[panel_id].layout.proportional_origin.y = y_offset / this.layout.height;
            y_offset += panel_height;
            this.panels[panel_id].dashboard.update();
        }.bind(this));
    }

    // If width and height arguments were NOT passed (and panels exist) then determine the plot dimensions
    // by making it conform to panel dimensions, assuming panels are already positioned correctly.
    else if (Object.keys(this.panels).length) {
        this.layout.width = 0;
        this.layout.height = 0;
        for (id in this.panels){
            this.layout.width = Math.max(this.panels[id].layout.width, this.layout.width);
            this.layout.height += this.panels[id].layout.height;
        }
        this.layout.width = Math.max(this.layout.width, this.layout.min_width);
        this.layout.height = Math.max(this.layout.height, this.layout.min_height);
    }

    // Keep aspect ratio in agreement with dimensions
    this.layout.aspect_ratio = this.layout.width / this.layout.height;

    // Apply layout width and height as discrete values or viewbox values
    if (this.svg != null){
        if (this.layout.responsive_resize){
            this.svg
                .attr("viewBox", "0 0 " + this.layout.width + " " + this.layout.height)
                .attr("preserveAspectRatio", "xMinYMin meet");
        } else {
            this.svg.attr("width", this.layout.width).attr("height", this.layout.height);
        }
    }

    // If the plot has been initialized then trigger some necessary render functions
    if (this.initialized){
        this.panel_boundaries.position();
        this.dashboard.update();
        this.curtain.update();
        this.loader.update();
    }

    return this.emit("layout_changed");
};

// Create a new panel from a layout
LocusZoom.Plot.prototype.addPanel = function(layout){

    // Sanity checks
    if (typeof layout !== "object"){
        throw "Invalid panel layout passed to LocusZoom.Plot.prototype.addPanel()";
    }

    // Create the Panel and set its parent
    var panel = new LocusZoom.Panel(layout, this);
    
    // Store the Panel on the Plot
    this.panels[panel.id] = panel;

    // If a discrete y_index was set in the layout then adjust other panel y_index values to accomodate this one
    if (panel.layout.y_index != null && !isNaN(panel.layout.y_index)
        && this.panel_ids_by_y_index.length > 0){
        // Negative y_index values should count backwards from the end, so convert negatives to appropriate values here
        if (panel.layout.y_index < 0){
            panel.layout.y_index = Math.max(this.panel_ids_by_y_index.length + panel.layout.y_index, 0);
        }
        this.panel_ids_by_y_index.splice(panel.layout.y_index, 0, panel.id);
        this.applyPanelYIndexesToPanelLayouts();
    } else {
        var length = this.panel_ids_by_y_index.push(panel.id);
        this.panels[panel.id].layout.y_index = length - 1;
    }

    // Determine if this panel was already in the layout.panels array.
    // If it wasn't, add it. Either way store the layout.panels array index on the panel.
    var layout_idx = null;
    this.layout.panels.forEach(function(panel_layout, idx){
        if (panel_layout.id == panel.id){ layout_idx = idx; }
    });
    if (layout_idx == null){
        layout_idx = this.layout.panels.push(this.panels[panel.id].layout) - 1;
    }
    this.panels[panel.id].layout_idx = layout_idx;

    // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
    if (this.initialized){
        this.positionPanels();
        // Initialize and load data into the new panel
        this.panels[panel.id].initialize();
        this.panels[panel.id].reMap();
        // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
        // positioning. TODO: make this additional call unnecessary.
        this.setDimensions(this.layout.width, this.layout.height);
    }

    return this.panels[panel.id];
};

// Remove panel by id
LocusZoom.Plot.prototype.removePanel = function(id){
    if (!this.panels[id]){
        throw ("Unable to remove panel, ID not found: " + id);
    }

    // Hide all panel boundaries
    this.panel_boundaries.hide();

    // Destroy all tooltips and state vars for all data layers on the panel
    this.panels[id].data_layer_ids_by_z_index.forEach(function(dlid){
        this.panels[id].data_layers[dlid].destroyAllTooltips();
        delete this.layout.state[id + "." + dlid];
    }.bind(this));

    // Remove all panel-level HTML overlay elements
    this.panels[id].loader.hide();
    this.panels[id].dashboard.destroy(true);
    this.panels[id].curtain.hide();

    // Remove the svg container for the panel if it exists
    if (this.panels[id].svg.container){
        this.panels[id].svg.container.remove();
    }

    // Delete the panel and its presence in the plot layout and state
    this.layout.panels.splice(this.panels[id].layout_idx, 1);
    delete this.panels[id];
    delete this.layout.state[id];

    // Update layout_idx values for all remaining panels
    this.layout.panels.forEach(function(panel_layout, idx){
        this.panels[panel_layout.id].layout_idx = idx;
    }.bind(this));

    // Remove the panel id from the y_index array
    this.panel_ids_by_y_index.splice(this.panel_ids_by_y_index.indexOf(id), 1);

    // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
    if (this.initialized){
        this.positionPanels();
        // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
        // positioning. TODO: make this additional call unnecessary.
        this.setDimensions(this.layout.width, this.layout.height);
    }

    return this;
};


/**
 Automatically position panels based on panel positioning rules and values.
 Keep panels from overlapping vertically by adjusting origins, and keep the sum of proportional heights at 1.

 TODO: This logic currently only supports dynamic positioning of panels to prevent overlap in a VERTICAL orientation.
       Some framework exists for positioning panels in horizontal orientations as well (width, proportional_width, origin.x, etc.)
       but the logic for keeping these user-defineable values straight approaches the complexity of a 2D box-packing algorithm.
       That's complexity we don't need right now, and may not ever need, so it's on hiatus until a use case materializes.
*/
LocusZoom.Plot.prototype.positionPanels = function(){

    var id;

    // Proportional heights for newly added panels default to null unless explcitly set, so determine appropriate
    // proportional heights for all panels with a null value from discretely set dimensions.
    // Likewise handle defaul nulls for proportional widths, but instead just force a value of 1 (full width)
    for (id in this.panels){
        if (this.panels[id].layout.proportional_height == null){
            this.panels[id].layout.proportional_height = this.panels[id].layout.height / this.layout.height;
        }
        if (this.panels[id].layout.proportional_width == null){
            this.panels[id].layout.proportional_width = 1;
        }
    }

    // Sum the proportional heights and then adjust all proportionally so that the sum is exactly 1
    var total_proportional_height = this.sumProportional("height");
    if (!total_proportional_height){
        return this;
    }
    var proportional_adjustment = 1 / total_proportional_height;
    for (id in this.panels){
        this.panels[id].layout.proportional_height *= proportional_adjustment;
    }

    // Update origins on all panels without changing plot-level dimensions yet
    var y_offset = 0;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].setOrigin(0, y_offset);
        this.panels[panel_id].layout.proportional_origin.x = 0;
        y_offset += this.panels[panel_id].layout.height;
    }.bind(this));
    var calculated_plot_height = y_offset;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].layout.proportional_origin.y = this.panels[panel_id].layout.origin.y / calculated_plot_height;
    }.bind(this));

    // Update dimensions on the plot to accomodate repositioned panels
    this.setDimensions();

    // Set dimensions on all panels using newly set plot-level dimensions and panel-level proportional dimensions
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].setDimensions(this.layout.width * this.panels[panel_id].layout.proportional_width,
                                            this.layout.height * this.panels[panel_id].layout.proportional_height);
    }.bind(this));

    return this;
    
};

// Create all plot-level objects, initialize all child panels
LocusZoom.Plot.prototype.initialize = function(){

    // Create an element/layer for containing mouse guides
    var mouse_guide_svg = this.svg.append("g")
        .attr("class", "lz-mouse_guide").attr("id", this.id + ".mouse_guide");
    var mouse_guide_vertical_svg = mouse_guide_svg.append("rect")
        .attr("class", "lz-mouse_guide-vertical").attr("x",-1);
    var mouse_guide_horizontal_svg = mouse_guide_svg.append("rect")
        .attr("class", "lz-mouse_guide-horizontal").attr("y",-1);
    this.mouse_guide = {
        svg: mouse_guide_svg,
        vertical: mouse_guide_vertical_svg,
        horizontal: mouse_guide_horizontal_svg
    };

    // Create the curtain object with show/update/hide methods
    this.curtain = {
        showing: false,
        selector: null,
        content_selector: null,
        show: function(content, css){
            // Generate curtain
            if (!this.curtain.showing){
                this.curtain.selector = d3.select(this.svg.node().parentNode).insert("div")
                    .attr("class", "lz-curtain").attr("id", this.id + ".curtain");
                this.curtain.content_selector = this.curtain.selector.append("div").attr("class", "lz-curtain-content");
                this.curtain.selector.append("div").attr("class", "lz-curtain-dismiss").html("Dismiss")
                    .on("click", function(){
                        this.curtain.hide();
                    }.bind(this));
                this.curtain.showing = true;
            }
            return this.curtain.update(content, css);
        }.bind(this),
        update: function(content, css){
            if (!this.curtain.showing){ return this.curtain; }
            // Apply CSS if provided
            if (typeof css == "object" && css != null){
                this.curtain.selector.style(css);
            }
            // Update size and position
            var plot_page_origin = this.getPageOrigin();
            this.curtain.selector.style({
                top: plot_page_origin.y + "px",
                left: plot_page_origin.x + "px",
                width: this.layout.width + "px",
                height: this.layout.height + "px"
            });
            this.curtain.content_selector.style({
                "max-width": (this.layout.width - 40) + "px",
                "max-height": (this.layout.height - 40) + "px"
            });
            // Apply content if provided
            if (typeof content == "string"){
                this.curtain.content_selector.html(content);
            }
            return this.curtain;
        }.bind(this),
        hide: function(){
            if (!this.curtain.showing){ return this.curtain; }
            // Remove curtain
            this.curtain.selector.remove();
            this.curtain.selector = null;
            this.curtain.content_selector = null;
            this.curtain.showing = false;
            return this.curtain;
        }.bind(this)
    };

    // Create the loader object with show/update/animate/setPercentCompleted/hide methods
    this.loader = {
        showing: false,
        selector: null,
        content_selector: null,
        progress_selector: null,
        cancel_selector: null,
        show: function(content){
            // Generate loader
            if (!this.loader.showing){
                this.loader.selector = d3.select(this.svg.node().parentNode).insert("div")
                    .attr("class", "lz-loader").attr("id", this.id + ".loader");
                this.loader.content_selector = this.loader.selector.append("div")
                    .attr("class", "lz-loader-content");
                this.loader.progress_selector = this.loader.selector
                    .append("div").attr("class", "lz-loader-progress-container")
                    .append("div").attr("class", "lz-loader-progress");
                /* TODO: figure out how to make this cancel button work
                this.loader.cancel_selector = this.loader.selector.append("div")
                    .attr("class", "lz-loader-cancel").html("Cancel")
                    .on("click", function(){
                        this.loader.hide();
                    }.bind(this));
                */
                this.loader.showing = true;
                if (typeof content == "undefined"){ content = "Loading..."; }
            }
            return this.loader.update(content);
        }.bind(this),
        update: function(content, percent){
            if (!this.loader.showing){ return this.loader; }
            // Apply content if provided
            if (typeof content == "string"){
                this.loader.content_selector.html(content);
            }
            // Update size and position
            var padding = 6; // is there a better place to store/define this?
            var plot_page_origin = this.getPageOrigin();
            var loader_boundrect = this.loader.selector.node().getBoundingClientRect();
            this.loader.selector.style({
                top: (plot_page_origin.y + this.layout.height - loader_boundrect.height - padding) + "px",
                left: (plot_page_origin.x + padding) + "px"
            });
            /* Uncomment this code when a functional cancel button can be shown
            var cancel_boundrect = this.loader.cancel_selector.node().getBoundingClientRect();
            this.loader.content_selector.style({
                "padding-right": (cancel_boundrect.width + padding) + "px"
            });
            */
            // Apply percent if provided
            if (typeof percent == "number"){
                this.loader.progress_selector.style({
                    width: (Math.min(Math.max(percent, 1), 100)) + "%"
                });
            }
            return this.loader;
        }.bind(this),
        animate: function(){
            // For when it is impossible to update with percent checkpoints - animate the loader in perpetual motion
            this.loader.progress_selector.classed("lz-loader-progress-animated", true);
            return this.loader;
        }.bind(this),
        setPercentCompleted: function(percent){
            this.loader.progress_selector.classed("lz-loader-progress-animated", false);
            return this.loader.update(null, percent);
        }.bind(this),
        hide: function(){
            if (!this.loader.showing){ return this.loader; }
            // Remove loader
            this.loader.selector.remove();
            this.loader.selector = null;
            this.loader.content_selector = null;
            this.loader.progress_selector = null;
            this.loader.cancel_selector = null;
            this.loader.showing = false;
            return this.loader;
        }.bind(this)
    };

    // Create the panel_boundaries object with show/position/hide methods
    this.panel_boundaries = {
        parent: this,
        hide_timeout: null,
        showing: false,
        dragging: false,
        selectors: [],
        corner_selector: null,
        show: function(){
            // Generate panel boundaries
            if (!this.showing && !this.parent.curtain.showing){
                this.showing = true;
                // Loop through all panels to create a horizontal boundary for each
                this.parent.panel_ids_by_y_index.forEach(function(panel_id, panel_idx){
                    var selector = d3.select(this.parent.svg.node().parentNode).insert("div", ".lz-data_layer-tooltip")
                        .attr("class", "lz-panel-boundary")
                        .attr("title", "Resize panel");
                    selector.append("span");
                    var panel_resize_drag = d3.behavior.drag();
                    panel_resize_drag.on("dragstart", function(){ this.dragging = true; }.bind(this));
                    panel_resize_drag.on("dragend", function(){ this.dragging = false; }.bind(this));
                    panel_resize_drag.on("drag", function(){
                        // First set the dimensions on the panel we're resizing
                        var this_panel = this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]];
                        var original_panel_height = this_panel.layout.height;
                        this_panel.setDimensions(this_panel.layout.width, this_panel.layout.height + d3.event.dy);
                        var panel_height_change = this_panel.layout.height - original_panel_height;
                        var new_calculated_plot_height = this.parent.layout.height + panel_height_change;
                        // Next loop through all panels.
                        // Update proportional dimensions for all panels including the one we've resized using discrete heights.
                        // Reposition panels with a greater y-index than this panel to their appropriate new origin.
                        this.parent.panel_ids_by_y_index.forEach(function(loop_panel_id, loop_panel_idx){
                            var loop_panel = this.parent.panels[this.parent.panel_ids_by_y_index[loop_panel_idx]];
                            loop_panel.layout.proportional_height = loop_panel.layout.height / new_calculated_plot_height;
                            if (loop_panel_idx > panel_idx){
                                loop_panel.setOrigin(loop_panel.layout.origin.x, loop_panel.layout.origin.y + panel_height_change);
                                loop_panel.dashboard.position();
                            }
                        }.bind(this));
                        // Reset dimensions on the entire plot and reposition panel boundaries
                        this.parent.positionPanels();
                        this.position();
                    }.bind(this));
                    selector.call(panel_resize_drag);
                    this.parent.panel_boundaries.selectors.push(selector);
                }.bind(this));
                // Create a corner boundary / resize element on the bottom-most panel that resizes the entire plot
                var corner_selector = d3.select(this.parent.svg.node().parentNode).insert("div", ".lz-data_layer-tooltip")
                    .attr("class", "lz-panel-corner-boundary")
                    .attr("title", "Resize plot");
                corner_selector.append("span").attr("class", "lz-panel-corner-boundary-outer");
                corner_selector.append("span").attr("class", "lz-panel-corner-boundary-inner");
                var corner_drag = d3.behavior.drag();
                corner_drag.on("dragstart", function(){ this.dragging = true; }.bind(this));
                corner_drag.on("dragend", function(){ this.dragging = false; }.bind(this));
                corner_drag.on("drag", function(){
                    this.setDimensions(this.layout.width + d3.event.dx, this.layout.height + d3.event.dy);
                }.bind(this.parent));
                corner_selector.call(corner_drag);
                this.parent.panel_boundaries.corner_selector = corner_selector;
            }
            return this.position();
        },
        position: function(){
            if (!this.showing){ return this; }
            // Position panel boundaries
            var plot_page_origin = this.parent.getPageOrigin();
            this.selectors.forEach(function(selector, panel_idx){
                var panel_page_origin = this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]].getPageOrigin();
                var left = plot_page_origin.x;
                var top = panel_page_origin.y + this.parent.panels[this.parent.panel_ids_by_y_index[panel_idx]].layout.height - 12;
                var width = this.parent.layout.width - 1;
                selector.style({
                    top: top + "px",
                    left: left + "px",
                    width: width + "px"
                });
                selector.select("span").style({
                    width: width + "px"
                });
            }.bind(this));
            // Position corner selector
            var corner_padding = 10;
            var corner_size = 16;
            this.corner_selector.style({
                top: (plot_page_origin.y + this.parent.layout.height - corner_padding - corner_size) + "px",
                left: (plot_page_origin.x + this.parent.layout.width - corner_padding - corner_size) + "px"
            });
            return this;
        },
        hide: function(){
            if (!this.showing){ return this; }
            this.showing = false;
            // Remove panel boundaries
            this.selectors.forEach(function(selector){ selector.remove(); });
            this.selectors = [];
            // Remove corner boundary
            this.corner_selector.remove();
            this.corner_selector = null;
            return this;
        }
    };

    // Show panel boundaries stipulated by the layout (basic toggle, only show on mouse over plot)
    if (this.layout.panel_boundaries){
        d3.select(this.svg.node().parentNode).on("mouseover." + this.id + ".panel_boundaries", function(){
            clearTimeout(this.panel_boundaries.hide_timeout);
            this.panel_boundaries.show();
        }.bind(this));
        d3.select(this.svg.node().parentNode).on("mouseout." + this.id + ".panel_boundaries", function(){
            this.panel_boundaries.hide_timeout = setTimeout(function(){
                this.panel_boundaries.hide();
            }.bind(this), 300);
        }.bind(this));
    }

    // Create the dashboard object and immediately show it
    this.dashboard = new LocusZoom.Dashboard(this).show();

    // Initialize all panels
    for (var id in this.panels){
        this.panels[id].initialize();
    }

    // Define plot-level mouse events
    this.svg.on("mouseout", function(){
        this.mouse_guide.vertical.attr("x", -1);
        this.mouse_guide.horizontal.attr("y", -1);
    }.bind(this));
    this.svg.on("mousemove", function(){
        var coords = d3.mouse(this.svg.node());
        this.mouse_guide.vertical.attr("x", coords[0]);
        this.mouse_guide.horizontal.attr("y", coords[1]);
        this.dashboard.update();
    }.bind(this));

    this.initialized = true;

    // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
    // positioning. TODO: make this additional call unnecessary.
    this.setDimensions(this.layout.width, this.layout.height);
    
    return this;

};

// Map an entire LocusZoom Plot to a new region
// DEPRECATED: This method is specific to only accepting chromosome, start, and end.
// LocusZoom.Plot.prototype.applyState() takes a single object, covering far more use cases.
LocusZoom.Plot.prototype.mapTo = function(chr, start, end){
    console.warn("Warning: use of LocusZoom.Plot.mapTo() is deprecated. Use LocusZoom.Plot.applyState() instead.");
    return this.applyState({ chr: chr, start: start, end: end });
};

// Refresh an plot's data from sources without changing position
LocusZoom.Plot.prototype.refresh = function(){
    return this.applyState();
};

// Update state values and trigger a pull for fresh data on all data sources for all data layers
LocusZoom.Plot.prototype.applyState = function(state_changes){

    state_changes = state_changes || {};
    if (typeof state_changes != "object"){
        throw("LocusZoom.applyState only accepts an object; " + (typeof state_changes) + " given");
    }
    
    // First make a copies of the current (old) state to work with
    var current_state = JSON.parse(JSON.stringify(this.state));
    var new_state = JSON.parse(JSON.stringify(this.state));

    // Apply changes by top-level property to the new state
    for (var property in state_changes) {
        new_state[property] = state_changes[property];
    }

    // Validate the new state (may do nothing, may do a lot, depends on how the user has thigns set up)
    new_state = LocusZoom.validateState(new_state, this.layout);

    // Apply new state to the actual state
    for (property in new_state) {
        this.state[property] = new_state[property];
    }

    // Generate requests for all panels given new state
    this.emit("data_requested");
    this.remap_promises = [];
    this.loading_data = true;
    for (var id in this.panels){
        this.remap_promises.push(this.panels[id].reMap());
    }

    return Q.all(this.remap_promises)
        .catch(function(error){
            console.log(error);
            this.curtain.drop(error);
            this.loading_data = false;
        }.bind(this))
        .done(function(){

            // Update dashboard / components
            this.dashboard.update();
                
            // Apply panel-level state values
            this.panel_ids_by_y_index.forEach(function(panel_id){
                var panel = this.panels[panel_id];
                panel.dashboard.update();
                // Apply data-layer-level state values
                panel.data_layer_ids_by_z_index.forEach(function(data_layer_id){
                    var data_layer = this.data_layers[data_layer_id];
                    var state_id = panel_id + "." + data_layer_id;
                    for (var property in this.state[state_id]){
                        if (!this.state[state_id].hasOwnProperty(property)){ continue; }
                        if (Array.isArray(this.state[state_id][property])){
                            this.state[state_id][property].forEach(function(element_id){
                                try {
                                    this.setElementStatus(property, this.getElementById(element_id), true);
                                } catch (e){
                                    console.error("Unable to apply state: " + state_id + ", " + property);
                                }
                            }.bind(data_layer));
                        }
                    }
                }.bind(panel));
            }.bind(this));
            
            // Emit events
            this.emit("layout_changed");
            this.emit("data_rendered");

            this.loading_data = false;
            
        }.bind(this));
    
};

