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
    this.parent_plot = this;

    this.id = id;
    
    this.container = null;
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
    // If no layout was passed, use the Standard Association Layout
    // Otherwise merge whatever was passed with the Default Layout
    if (typeof layout == "undefined"){
        this.layout = LocusZoom.Layouts.merge({}, LocusZoom.Layouts.get("plot", "standard_association"));
    } else {
        this.layout = layout;
    }
    LocusZoom.Layouts.merge(this.layout, LocusZoom.Plot.DefaultLayout);

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

    // Get the top and left offset values for the plot's container element (the div that was populated)
    this.getContainerOffset = function(){
        var offset = { top: 0, left: 0 };
        var container = this.container.offsetParent || null;
        while (container != null){
            offset.top += container.offsetTop;
            offset.left += container.offsetLeft;
            container = container.offsetParent || null;
        }
        return offset;
    };

    // Event information describing interaction (e.g. panning and zooming) is stored on the plot
    this.interaction = {};
    this.canInteract = function(panel_id){
        panel_id = panel_id || null;
        if (panel_id){
            return ((typeof this.interaction.panel_id == "undefined" || this.interaction.panel_id == panel_id) && !this.loading_data);
        } else {
            return !(this.interaction.dragging || this.interaction.zooming || this.loading_data);
        }
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
    panel_boundaries: true,
    mouse_guide: true
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
    var clientRect = this.svg.node().getBoundingClientRect();
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
        d3.select(window).on("load.lz-"+this.id, function(){ 
            this.setDimensions();
        }.bind(this));
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
     * Calculate appropriate plot dimensions from panels contained within and update plot
*/
LocusZoom.Plot.prototype.setDimensions = function(width, height){
    
    var id;

    // Update minimum allowable width and height by aggregating minimums from panels, then apply minimums to containing element.
    var min_width = parseFloat(this.layout.min_width) || 0;
    var min_height = parseFloat(this.layout.min_height) || 0;
    for (id in this.panels){
        min_width = Math.max(min_width, this.panels[id].layout.min_width);
        if (parseFloat(this.panels[id].layout.min_height) > 0 && parseFloat(this.panels[id].layout.proportional_height) > 0){
            min_height = Math.max(min_height, (this.panels[id].layout.min_height / this.panels[id].layout.proportional_height));
        }
    }
    this.layout.min_width = Math.max(min_width, 1);
    this.layout.min_height = Math.max(min_height, 1);
    d3.select(this.svg.node().parentNode).style({
        "min-width": this.layout.min_width + "px",
        "min-height": this.layout.min_height + "px"
    });

    // If width and height arguments were passed then adjust them against plot minimums if necessary.
    // Then resize the plot and proportionally resize panels to fit inside the new plot dimensions.
    if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
        this.layout.aspect_ratio = this.layout.width / this.layout.height;
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

    // If a discrete y_index was set in the layout then adjust other panel y_index values to accommodate this one
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
    this.applyPanelYIndexesToPanelLayouts();

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
       but the logic for keeping these user-definable values straight approaches the complexity of a 2D box-packing algorithm.
       That's complexity we don't need right now, and may not ever need, so it's on hiatus until a use case materializes.
*/
LocusZoom.Plot.prototype.positionPanels = function(){

    var id;

    // We want to enforce that all x-linked panels have consistent horizontal margins
    // (to ensure that aligned items stay aligned despite inconsistent initial layout parameters)
    // NOTE: This assumes panels have consistent widths already. That should probably be enforced too!
    var x_linked_margins = { left: 0, right: 0 };

    // Proportional heights for newly added panels default to null unless explicitly set, so determine appropriate
    // proportional heights for all panels with a null value from discretely set dimensions.
    // Likewise handle default nulls for proportional widths, but instead just force a value of 1 (full width)
    for (id in this.panels){
        if (this.panels[id].layout.proportional_height == null){
            this.panels[id].layout.proportional_height = this.panels[id].layout.height / this.layout.height;
        }
        if (this.panels[id].layout.proportional_width == null){
            this.panels[id].layout.proportional_width = 1;
        }
        if (this.panels[id].layout.interaction.x_linked){
            x_linked_margins.left = Math.max(x_linked_margins.left, this.panels[id].layout.margin.left);
            x_linked_margins.right = Math.max(x_linked_margins.right, this.panels[id].layout.margin.right);
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
    // Also apply x-linked margins to x-linked panels, updating widths as needed
    var y_offset = 0;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].setOrigin(0, y_offset);
        this.panels[panel_id].layout.proportional_origin.x = 0;
        y_offset += this.panels[panel_id].layout.height;
        if (this.panels[panel_id].layout.interaction.x_linked){
            var delta = Math.max(x_linked_margins.left - this.panels[panel_id].layout.margin.left, 0)
                      + Math.max(x_linked_margins.right - this.panels[panel_id].layout.margin.right, 0);
            this.panels[panel_id].layout.width += delta;
            this.panels[panel_id].layout.margin.left = x_linked_margins.left;
            this.panels[panel_id].layout.margin.right = x_linked_margins.right;
            this.panels[panel_id].layout.cliparea.origin.x = x_linked_margins.left;
        }
    }.bind(this));
    var calculated_plot_height = y_offset;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].layout.proportional_origin.y = this.panels[panel_id].layout.origin.y / calculated_plot_height;
    }.bind(this));    

    // Update dimensions on the plot to accommodate repositioned panels
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

    // Ensure proper responsive class is present on the containing node if called for
    if (this.layout.responsive_resize){
        d3.select(this.container).classed("lz-container-responsive", true);
    }
    
    // Create an element/layer for containing mouse guides
    if (this.layout.mouse_guide) {
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
    }

    // Add curtain and loader prototpyes to the plot
    this.curtain = LocusZoom.generateCurtain.call(this);
    this.loader = LocusZoom.generateLoader.call(this);

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
    var namespace = "." + this.id;
    if (this.layout.mouse_guide) {
        var mouseout_mouse_guide = function(){
            this.mouse_guide.vertical.attr("x", -1);
            this.mouse_guide.horizontal.attr("y", -1);
        }.bind(this);
        var mousemove_mouse_guide = function(){
            var coords = d3.mouse(this.svg.node());
            this.mouse_guide.vertical.attr("x", coords[0]);
            this.mouse_guide.horizontal.attr("y", coords[1]);
        }.bind(this);
        this.svg
            .on("mouseout" + namespace + "-mouse_guide", mouseout_mouse_guide)
            .on("touchleave" + namespace + "-mouse_guide", mouseout_mouse_guide)
            .on("mousemove" + namespace + "-mouse_guide", mousemove_mouse_guide);
    }
    var mouseup = function(){
        this.stopDrag();
    }.bind(this);
    var mousemove = function(){
        if (this.interaction.dragging){
            var coords = d3.mouse(this.svg.node());
            if (d3.event){ d3.event.preventDefault(); }
            this.interaction.dragging.dragged_x = coords[0] - this.interaction.dragging.start_x;
            this.interaction.dragging.dragged_y = coords[1] - this.interaction.dragging.start_y;
            this.panels[this.interaction.panel_id].render();
            this.interaction.linked_panel_ids.forEach(function(panel_id){
                this.panels[panel_id].render();
            }.bind(this));
        }
    }.bind(this);
    this.svg
        .on("mouseup" + namespace, mouseup)
        .on("touchend" + namespace, mouseup)
        .on("mousemove" + namespace, mousemove)
        .on("touchmove" + namespace, mousemove);
    
    // Add an extra namespaced mouseup handler to the containing body, if there is one
    // This helps to stop interaction events gracefully when dragging outside of the plot element
    if (!d3.select("body").empty()){
        d3.select("body")
            .on("mouseup" + namespace, mouseup)
            .on("touchend" + namespace, mouseup);
    }

    this.initialized = true;

    // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
    // positioning. TODO: make this additional call unnecessary.
    var client_rect = this.svg.node().getBoundingClientRect();
    var width = client_rect.width ? client_rect.width : this.layout.width;
    var height = client_rect.height ? client_rect.height : this.layout.height;
    this.setDimensions(width, height);
    
    return this;

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
    
    // First make a copy of the current (old) state to work with
    var new_state = JSON.parse(JSON.stringify(this.state));

    // Apply changes by top-level property to the new state
    for (var property in state_changes) {
        new_state[property] = state_changes[property];
    }

    // Validate the new state (may do nothing, may do a lot, depends on how the user has things set up)
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
            console.error(error);
            this.curtain.drop(error);
            this.loading_data = false;
        }.bind(this))
        .then(function(){

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

LocusZoom.Plot.prototype.startDrag = function(panel, method){

    panel = panel || null;
    method = method || null;

    var axis = null;
    switch (method){
    case "background":
    case "x_tick":
        axis = "x";
        break;
    case "y1_tick":
        axis = "y1";
        break;
    case "y2_tick":
        axis = "y2";
        break;
    }

    if (!(panel instanceof LocusZoom.Panel) || !axis || !this.canInteract()){ return this.stopDrag(); }

    var coords = d3.mouse(this.svg.node());
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

    this.svg.style("cursor", "all-scroll");

    return this;

};

LocusZoom.Plot.prototype.stopDrag = function(){

    if (!this.interaction.dragging){ return this; }

    if (typeof this.panels[this.interaction.panel_id] != "object"){
        this.interaction = {};
        return this;
    }
    var panel = this.panels[this.interaction.panel_id];

    // Helper function to find the appropriate axis layouts on child data layers
    // Once found, apply the extent as floor/ceiling and remove all other directives
    // This forces all associated axes to conform to the extent generated by a drag action
    var overrideAxisLayout = function(axis, axis_number, extent){
        panel.data_layer_ids_by_z_index.forEach(function(id){
            if (panel.data_layers[id].layout[axis+"_axis"].axis == axis_number){
                panel.data_layers[id].layout[axis+"_axis"].floor = extent[0];
                panel.data_layers[id].layout[axis+"_axis"].ceiling = extent[1];
                delete panel.data_layers[id].layout[axis+"_axis"].lower_buffer;
                delete panel.data_layers[id].layout[axis+"_axis"].upper_buffer;
                delete panel.data_layers[id].layout[axis+"_axis"].min_extent;
                delete panel.data_layers[id].layout[axis+"_axis"].ticks;
            }
        });
    };

    switch(this.interaction.dragging.method){
    case "background":
    case "x_tick":
        if (this.interaction.dragging.dragged_x != 0){
            overrideAxisLayout("x", 1, panel.x_extent);
            this.applyState({ start: panel.x_extent[0], end: panel.x_extent[1] });
        }
        break;
    case "y1_tick":
    case "y2_tick":
        if (this.interaction.dragging.dragged_y != 0){
            var y_axis_number = this.interaction.dragging.method[1];
            overrideAxisLayout("y", y_axis_number, panel["y"+y_axis_number+"_extent"]);
        }
        break;
    }
    
    this.interaction = {};
    this.svg.style("cursor", null);

    return this;

};
