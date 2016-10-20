/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Panel Class

  A panel is an abstract class representing a subdivision of the LocusZoom stage
  to display a distinct data representation

*/

LocusZoom.Panel = function(layout, parent) { 

    if (typeof layout !== "object"){
        throw "Unable to create panel, invalid layout";
    }

    this.parent = parent || null;

    // Ensure a valid ID is present. If there is no valid ID then generate one
    if (typeof layout.id !== "string" || !layout.id.length){
        if (!this.parent){
            layout.id = "p" + Math.floor(Math.random()*Math.pow(10,8));
        } else {
            var id = null;
            var generateID = function(){
                id = "p" + Math.floor(Math.random()*Math.pow(10,8));
                if (id == null || typeof this.parent.panels[id] != "undefined"){
                    id = generateID();
                }
            }.bind(this);
            layout.id = id;
        }
    } else if (this.parent) {
        if (typeof this.parent.panels[layout.id] !== "undefined"){
            throw "Cannot create panel with id [" + layout.id + "]; panel with that id already exists";
        }
    }
    this.id = layout.id;

    this.initialized = false;
    this.layout_idx = null;
    this.svg = {};

    // The layout is a serializable object used to describe the composition of the Panel
    this.layout = LocusZoom.Layouts.merge(layout || {}, LocusZoom.Panel.DefaultLayout);

    // Define state parameters specific to this panel
    if (this.parent){
        this.state = this.parent.state;
        this.state_id = this.id;
        this.state[this.state_id] = this.state[this.state_id] || {};
    } else {
        this.state = null;
        this.state_id = null;
    }
    
    this.data_layers = {};
    this.data_layer_ids_by_z_index = [];
    this.data_promises = [];

    this.x_scale  = null;
    this.y1_scale = null;
    this.y2_scale = null;

    this.x_extent  = null;
    this.y1_extent = null;
    this.y2_extent = null;

    this.x_ticks  = [];
    this.y1_ticks = [];
    this.y2_ticks = [];

    this.zoom_timeout = null;

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };

    this.canInteract = function(){
        return !(this.interactions.dragging || this.interactions.zooming || this.parent.loading_data);
    };

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
    
    // Get an object with the x and y coordinates of the panel's origin in terms of the entire page
    // Necessary for positioning any HTML elements over the panel
    this.getPageOrigin = function(){
        var plot_origin = this.parent.getPageOrigin();
        return {
            x: plot_origin.x + this.layout.origin.x,
            y: plot_origin.y + this.layout.origin.y
        };
    };

    // Object for storing in-progress mouse interactions
    this.interactions = {};

    // Initialize the layout
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.DefaultLayout = {
    title: null,
    description: null,
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
    background_click: "clear_selections",
    dashboard: {
        components: []
    },
    cliparea: {
        height: 0,
        width: 0,
        origin: { x: 0, y: 0 }
    },
    axes: {
        x:  {},
        y1: {},
        y2: {}
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
        y2_linked: false
    },
    data_layers: []
};

LocusZoom.Panel.prototype.initializeLayout = function(){

    // If the layout is missing BOTH width and proportional width then set the proportional width to 1.
    // This will default the panel to taking up the full width of the plot.
    if (this.layout.width == 0 && this.layout.proportional_width == null){
        this.layout.proportional_width = 1;
    }

    // If the layout is missing BOTH height and proportional height then set the proportional height to
    // an equal share of the plot's current height.
    if (this.layout.height == 0 && this.layout.proportional_height == null){
        var panel_count = Object.keys(this.parent.panels).length;
        if (panel_count > 0){
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
    this.x_range = [0, this.layout.cliparea.width];
    this.y1_range = [this.layout.cliparea.height, 0];
    this.y2_range = [this.layout.cliparea.height, 0];

    // Initialize panel axes
    ["x", "y1", "y2"].forEach(function(axis){
        if (!Object.keys(this.layout.axes[axis]).length || this.layout.axes[axis].render ===false){
            // The default layout sets the axis to an empty object, so set its render boolean here
            this.layout.axes[axis].render = false;
        } else {
            this.layout.axes[axis].render = true;
            this.layout.axes[axis].label = this.layout.axes[axis].label || null;
            this.layout.axes[axis].label_function = this.layout.axes[axis].label_function || null;
        }
    }.bind(this));

    // Add data layers (which define x and y extents)
    this.layout.data_layers.forEach(function(data_layer_layout){
        this.addDataLayer(data_layer_layout);
    }.bind(this));

    return this;

};

LocusZoom.Panel.prototype.setDimensions = function(width, height){
    if (typeof width != "undefined" && typeof height != "undefined"){
        if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0){
            this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
            this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
        }
    } else {
        if (this.layout.proportional_width != null){
            this.layout.width = Math.max(this.layout.proportional_width * this.parent.layout.width, this.layout.min_width);
        }
        if (this.layout.proportional_height != null){
            this.layout.height = Math.max(this.layout.proportional_height * this.parent.layout.height, this.layout.min_height);
        }
    }
    this.layout.cliparea.width = Math.max(this.layout.width - (this.layout.margin.left + this.layout.margin.right), 0);
    this.layout.cliparea.height = Math.max(this.layout.height - (this.layout.margin.top + this.layout.margin.bottom), 0);
    if (this.svg.clipRect){
        this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);
    }
    if (this.initialized){
        this.render();
        this.curtain.update();
        this.loader.update();
        this.dashboard.update();
        if (this.legend){ this.legend.position(); }
    }
    return this;
};

LocusZoom.Panel.prototype.setOrigin = function(x, y){
    if (!isNaN(x) && x >= 0){ this.layout.origin.x = Math.max(Math.round(+x), 0); }
    if (!isNaN(y) && y >= 0){ this.layout.origin.y = Math.max(Math.round(+y), 0); }
    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setMargin = function(top, right, bottom, left){
    var extra;
    if (!isNaN(top)    && top    >= 0){ this.layout.margin.top    = Math.max(Math.round(+top),    0); }
    if (!isNaN(right)  && right  >= 0){ this.layout.margin.right  = Math.max(Math.round(+right),  0); }
    if (!isNaN(bottom) && bottom >= 0){ this.layout.margin.bottom = Math.max(Math.round(+bottom), 0); }
    if (!isNaN(left)   && left   >= 0){ this.layout.margin.left   = Math.max(Math.round(+left),   0); }
    if (this.layout.margin.top + this.layout.margin.bottom > this.layout.height){
        extra = Math.floor(((this.layout.margin.top + this.layout.margin.bottom) - this.layout.height) / 2);
        this.layout.margin.top -= extra;
        this.layout.margin.bottom -= extra;
    }
    if (this.layout.margin.left + this.layout.margin.right > this.layout.width){
        extra = Math.floor(((this.layout.margin.left + this.layout.margin.right) - this.layout.width) / 2);
        this.layout.margin.left -= extra;
        this.layout.margin.right -= extra;
    }
    ["top", "right", "bottom", "left"].forEach(function(m){
        this.layout.margin[m] = Math.max(this.layout.margin[m], 0);
    }.bind(this));
    this.layout.cliparea.width = Math.max(this.layout.width - (this.layout.margin.left + this.layout.margin.right), 0);
    this.layout.cliparea.height = Math.max(this.layout.height - (this.layout.margin.top + this.layout.margin.bottom), 0);
    this.layout.cliparea.origin.x = this.layout.margin.left;
    this.layout.cliparea.origin.y = this.layout.margin.top;

    if (this.initialized){ this.render(); }
    return this;
};

// Initialize a panel
LocusZoom.Panel.prototype.initialize = function(){

    // Append a container group element to house the main panel group element and the clip path
    // Position with initial layout parameters
    this.svg.container = this.parent.svg.append("g")
        .attr("id", this.getBaseId() + ".panel_container")
        .attr("transform", "translate(" + this.layout.origin.x + "," + this.layout.origin.y + ")");

    // Append clip path to the parent svg element, size with initial layout parameters
    var clipPath = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip");
    this.svg.clipRect = clipPath.append("rect")
        .attr("width", this.layout.width).attr("height", this.layout.height);
    
    // Append svg group for rendering all panel child elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".panel")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Create the curtain object with show/update/hide methods
    this.curtain = {
        showing: false,
        selector: null,
        content_selector: null,
        show: function(content, css){
            // Generate curtain
            if (!this.curtain.showing){
                this.curtain.selector = d3.select(this.parent.svg.node().parentNode).insert("div")
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
            if (typeof css == "object"){
                this.curtain.selector.style(css);
            }
            // Update size and position
            var panel_page_origin = this.getPageOrigin();
            this.curtain.selector.style({
                top: panel_page_origin.y + "px",
                left: panel_page_origin.x + "px",
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
                this.loader.selector = d3.select(this.parent.svg.node().parentNode).insert("div")
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
            var panel_page_origin = this.getPageOrigin();
            var loader_boundrect = this.loader.selector.node().getBoundingClientRect();
            this.loader.selector.style({
                top: (panel_page_origin.y + this.layout.height - loader_boundrect.height - padding) + "px",
                left: (panel_page_origin.x + padding) + "px"
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

    // Create the dashboard object and hang components on it as defined by panel layout
    this.dashboard = new LocusZoom.Dashboard(this);

    // Inner border
    this.inner_border = this.svg.group.append("rect")
        .attr("class", "lz-panel-background")
        .on("click", function(){
            if (this.layout.background_click == "clear_selections"){ this.clearSelections(); }
        }.bind(this));

    // Add the title, if defined
    if (this.layout.title){
        var default_x = 10;
        var default_y = 22;
        if (typeof this.layout.title == "string"){
            this.layout.title = {
                text: this.layout.title,
                x: default_x,
                y: default_y
            };
        }
        this.svg.group.append("text")
            .attr("class", "lz-panel-title")
            .attr("x", parseFloat(this.layout.title.x) || default_x)
            .attr("y", parseFloat(this.layout.title.y) || default_y)
            .text(this.layout.title.text);
    }

    // Initialize Axes
    this.svg.x_axis = this.svg.group.append("g")
        .attr("id", this.getBaseId() + ".x_axis").attr("class", "lz-x lz-axis");
    if (this.layout.axes.x.render){
        this.svg.x_axis_label = this.svg.x_axis.append("text")
            .attr("class", "lz-x lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y1_axis = this.svg.group.append("g")
        .attr("id", this.getBaseId() + ".y1_axis").attr("class", "lz-y lz-y1 lz-axis");
    if (this.layout.axes.y1.render){
        this.svg.y1_axis_label = this.svg.y1_axis.append("text")
            .attr("class", "lz-y1 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y2_axis = this.svg.group.append("g")
        .attr("id", this.getBaseId() + ".y2_axis").attr("class", "lz-y lz-y2 lz-axis");
    if (this.layout.axes.y2.render){
        this.svg.y2_axis_label = this.svg.y2_axis.append("text")
            .attr("class", "lz-y2 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }

    // Initialize child Data Layers
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].initialize();
    }.bind(this));

    // Create the legend object as defined by panel layout and child data layer layouts
    this.legend = null;
    if (this.layout.legend){
        this.legend = new LocusZoom.Legend(this);
    }

    // Establish panel background drag interaction mousedown event handler (on the panel background)
    var namespace = "." + this.parent.id + "." + this.id + ".interaction.drag";
    if (this.layout.interaction.drag_background_to_pan){
        var panel = this;
        var mousedown = function(){ panel.toggleDragging("background"); };
        this.svg.container.select(".lz-panel-background")
            .on("mousedown" + namespace + ".background", mousedown)
            .on("touchstart" + namespace + ".background", mousedown);
    }

    // Establish panel mouse up and move handlers for any/all drag events for the plot (on the parent plot)
    if (this.layout.interaction.drag_background_to_pan || this.layout.interaction.drag_x_ticks_to_scale
        || this.layout.interaction.drag_y1_ticks_to_scale || this.layout.interaction.drag_y2_ticks_to_scale){
        var mouseup = function(){ this.toggleDragging(); }.bind(this);
        var mousemove = function(){
            if (!this.interactions.dragging){ return; }
            if (this.interactions.dragging.panel_id != this.id){ return; }
            if (d3.event){ d3.event.preventDefault(); }
            var coords = d3.mouse(this.svg.container.node());
            this.interactions.dragging.dragged_x = coords[0] - this.interactions.dragging.start_x;
            this.interactions.dragging.dragged_y = coords[1] - this.interactions.dragging.start_y;
            this.render();
        }.bind(this);
        this.parent.svg
            .on("mouseup" + namespace, mouseup)
            .on("touchend" + namespace, mouseup)
            .on("mousemove" + namespace, mousemove)
            .on("touchmove" + namespace, mousemove);
    }

    return this;
    
};


// Move a panel up relative to others by y-index
LocusZoom.Panel.prototype.moveUp = function(){
    if (this.parent.panel_ids_by_y_index[this.layout.y_index - 1]){
        this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index - 1];
        this.parent.panel_ids_by_y_index[this.layout.y_index - 1] = this.id;
        this.parent.applyPanelYIndexesToPanelLayouts();
        this.parent.positionPanels();
    }
    return this;
};


// Move a panel down relative to others by y-index
LocusZoom.Panel.prototype.moveDown = function(){
    if (this.parent.panel_ids_by_y_index[this.layout.y_index + 1]){
        this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index + 1];
        this.parent.panel_ids_by_y_index[this.layout.y_index + 1] = this.id;
        this.parent.applyPanelYIndexesToPanelLayouts();
        this.parent.positionPanels();
    }
    return this;
};


// Create a new data layer by layout object
LocusZoom.Panel.prototype.addDataLayer = function(layout){

    // Sanity checks
    if (typeof layout !== "object"){
        throw "Invalid data layer layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof layout.id !== "string" || !layout.id.length){
        throw "Invalid paneldata layer id passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof this.data_layers[layout.id] !== "undefined"){
        throw "Cannot create data_layer with id [" + layout.id + "]; data layer with that id already exists in the panel";
    }
    if (typeof layout.type !== "string"){
        throw "Invalid data layer type in layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }

    // If the layout defines a y axis make sure the axis number is set and is 1 or 2 (default to 1)
    if (typeof layout.y_axis == "object" && (typeof layout.y_axis.axis == "undefined" || [1,2].indexOf(layout.y_axis.axis) == -1)){
        layout.y_axis.axis = 1;
    }

    // Create the Data Layer
    var data_layer = LocusZoom.DataLayers.get(layout.type, layout, this);

    // Store the Data Layer on the Panel
    this.data_layers[data_layer.id] = data_layer;

    // If a discrete z_index was set in the layout then adjust other data layer z_index values to accomodate this one
    if (data_layer.layout.z_index != null && !isNaN(data_layer.layout.z_index)
        && this.data_layer_ids_by_z_index.length > 0){
        // Negative z_index values should count backwards from the end, so convert negatives to appropriate values here
        if (data_layer.layout.z_index < 0){
            data_layer.layout.z_index = Math.max(this.data_layer_ids_by_z_index.length + data_layer.layout.z_index, 0);
        }
        this.data_layer_ids_by_z_index.splice(data_layer.layout.z_index, 0, data_layer.id);
        this.data_layer_ids_by_z_index.forEach(function(dlid, idx){
            this.data_layers[dlid].layout.z_index = idx;
        }.bind(this));
    } else {
        var length = this.data_layer_ids_by_z_index.push(data_layer.id);
        this.data_layers[data_layer.id].layout.z_index = length - 1;
    }

    // Determine if this data layer was already in the layout.data_layers array.
    // If it wasn't, add it. Either way store the layout.data_layers array index on the data_layer.
    var layout_idx = null;
    this.layout.data_layers.forEach(function(data_layer_layout, idx){
        if (data_layer_layout.id == data_layer.id){ layout_idx = idx; }
    });
    if (layout_idx == null){
        layout_idx = this.layout.data_layers.push(this.data_layers[data_layer.id].layout) - 1;
    }
    this.data_layers[data_layer.id].layout_idx = layout_idx;

    return this.data_layers[data_layer.id];
};


// Clear all selections on all data layers
LocusZoom.Panel.prototype.clearSelections = function(){
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].setAllElementStatus("selected", false);
    }.bind(this));
    return this;
};


// Re-Map a panel to new positions according to the parent plot's state
LocusZoom.Panel.prototype.reMap = function(){
    this.emit("data_requested");
    this.data_promises = [];
    // Trigger reMap on each Data Layer
    for (var id in this.data_layers){
        try {
            this.data_promises.push(this.data_layers[id].reMap());
        } catch (error) {
            console.warn(error);
            this.curtain.show(error);
        }
    }
    // When all finished trigger a render
    return Q.all(this.data_promises)
        .then(function(){
            this.initialized = true;
            this.render();
            this.emit("layout_changed");
            this.parent.emit("layout_changed");
            this.emit("data_rendered");
        }.bind(this))
        .catch(function(error){
            console.warn(error);
            this.curtain.show(error);
        }.bind(this));
};

// Iterate over data layers to generate panel axis extents
LocusZoom.Panel.prototype.generateExtents = function(){

    // Reset extents
    ["x", "y1", "y2"].forEach(function(axis){
        this[axis + "_extent"] = null;
    }.bind(this));

    // Loop through the data layers
    for (var id in this.data_layers){

        var data_layer = this.data_layers[id];

        // If defined and not decoupled, merge the x extent of the data layer with the panel's x extent
        if (data_layer.layout.x_axis && !data_layer.layout.x_axis.decoupled){
            this.x_extent = d3.extent((this.x_extent || []).concat(data_layer.getAxisExtent("x")));
        }

        // If defined and not decoupled, merge the y extent of the data layer with the panel's appropriate y extent
        if (data_layer.layout.y_axis && !data_layer.layout.y_axis.decoupled){
            var y_axis = "y" + data_layer.layout.y_axis.axis;
            this[y_axis+"_extent"] = d3.extent((this[y_axis+"_extent"] || []).concat(data_layer.getAxisExtent("y")));
        }
        
    }

    // Override x_extent from state if explicitly defined to do so
    if (this.layout.axes.x && this.layout.axes.x.extent == "state"){
        this.x_extent = [ this.state.start, this.state.end ];
    }

    return this;

};

// Render a given panel
LocusZoom.Panel.prototype.render = function(called_from_broadcast){

    // Whether this function was called as a broadcast of another panel's rendering
    // (i.e. don't keep broadcasting, skip that step at the bottom of the render loop)
    if (typeof called_from_broadcast == "undefined"){ called_from_broadcast = false; }

    // Position the panel container
    this.svg.container.attr("transform", "translate(" + this.layout.origin.x +  "," + this.layout.origin.y + ")");

    // Set size on the clip rect
    this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);

    // Set and position the inner border, style if necessary
    this.inner_border
        .attr("x", this.layout.margin.left).attr("y", this.layout.margin.top)
        .attr("width", this.layout.width - (this.layout.margin.left + this.layout.margin.right))
        .attr("height", this.layout.height - (this.layout.margin.top + this.layout.margin.bottom));
    if (this.layout.inner_border){
        this.inner_border.style({ "stroke-width": 1, "stroke": this.layout.inner_border });
    }

    // Regenerate all extents
    this.generateExtents();

    // Helper function to constrain any procedurally generated vectors (e.g. ranges, extents)
    // Constraints applied here keep vectors from going to infinity or beyond a definable power of ten
    var constrain = function(value, limit_exponent){
        var neg_min = Math.pow(-10, limit_exponent);
        var neg_max = Math.pow(-10, -limit_exponent);
        var pos_min = Math.pow(10, -limit_exponent);
        var pos_max = Math.pow(10, limit_exponent);
        if (value == Infinity){ value = pos_max; }
        if (value == -Infinity){ value = neg_min; }
        if (value == 0){ value = pos_min; }
        if (value > 0){ value = Math.max(Math.min(value, pos_max), pos_min); }
        if (value < 0){ value = Math.max(Math.min(value, neg_max), neg_min); }
        return value;
    };

    // Define default and shifted ranges for all axes
    var ranges = {};
    if (this.x_extent){
        ranges.x = [0, this.layout.cliparea.width];
        ranges.x_shifted = [0, this.layout.cliparea.width];
    }
    if (this.y1_extent){
        ranges.y1 = [this.layout.cliparea.height, 0];
        ranges.y1_shifted = [this.layout.cliparea.height, 0];
    }
    if (this.y2_extent){
        ranges.y2 = [this.layout.cliparea.height, 0];
        ranges.y2_shifted = [this.layout.cliparea.height, 0];
    }

    // Shift ranges based on any drag or zoom interactions currently underway
    var anchor, scalar = null;
    if (this.interactions.zooming && typeof this.x_scale == "function"){
        var current_extent_size = Math.abs(this.x_extent[1] - this.x_extent[0]);
        var current_scaled_extent_size = Math.round(this.x_scale.invert(ranges.x_shifted[1])) - Math.round(this.x_scale.invert(ranges.x_shifted[0]));
        var zoom_factor = this.interactions.zooming.scale;
        var potential_extent_size = Math.floor(current_scaled_extent_size * (1 / zoom_factor));
        if (zoom_factor < 1 && !isNaN(this.parent.layout.max_region_scale)){
            zoom_factor = 1 /(Math.min(potential_extent_size, this.parent.layout.max_region_scale) / current_scaled_extent_size);
        } else if (zoom_factor > 1 && !isNaN(this.parent.layout.min_region_scale)){
            zoom_factor = 1 / (Math.max(potential_extent_size, this.parent.layout.min_region_scale) / current_scaled_extent_size);
        }
        var new_extent_size = Math.floor(current_extent_size * zoom_factor);
        anchor = this.interactions.zooming.center - this.layout.margin.left - this.layout.origin.x;
        var offset_ratio = anchor / this.layout.cliparea.width;
        var new_x_extent_start = Math.max(Math.floor(this.x_scale.invert(ranges.x_shifted[0]) - ((new_extent_size - current_scaled_extent_size) * offset_ratio)), 1);
        ranges.x_shifted = [ this.x_scale(new_x_extent_start), this.x_scale(new_x_extent_start + new_extent_size) ];
    } else if (this.interactions.dragging){
        switch (this.interactions.dragging.method){
        case "background":
            ranges.x_shifted[0] = 0 + this.interactions.dragging.dragged_x;
            ranges.x_shifted[1] = this.layout.cliparea.width + this.interactions.dragging.dragged_x;
            break;
        case "x_tick":
            if (d3.event && d3.event.shiftKey){
                ranges.x_shifted[0] = 0 + this.interactions.dragging.dragged_x;
                ranges.x_shifted[1] = this.layout.cliparea.width + this.interactions.dragging.dragged_x;
            } else {
                anchor = this.interactions.dragging.start_x - this.layout.margin.left - this.layout.origin.x;
                scalar = constrain(anchor / (anchor + this.interactions.dragging.dragged_x), 3);
                ranges.x_shifted[0] = 0;
                ranges.x_shifted[1] = Math.max(this.layout.cliparea.width * (1 / scalar), 1);
            }
            break;
        case "y1_tick":
        case "y2_tick":
            var y_shifted = "y" + this.interactions.dragging.method[1] + "_shifted";
            if (d3.event && d3.event.shiftKey){
                ranges[y_shifted][0] = this.layout.cliparea.height + this.interactions.dragging.dragged_y;
                ranges[y_shifted][1] = 0 + this.interactions.dragging.dragged_y;
            } else {
                anchor = this.layout.cliparea.height - (this.interactions.dragging.start_y - this.layout.margin.top - this.layout.origin.y);
                scalar = constrain(anchor / (anchor - this.interactions.dragging.dragged_y), 3);
                ranges[y_shifted][0] = this.layout.cliparea.height;
                ranges[y_shifted][1] = this.layout.cliparea.height - (this.layout.cliparea.height * (1 / scalar));
            }
        }
    }

    // Generate scales and ticks for all axes
    ["x", "y1", "y2"].forEach(function(axis){
        if (!this[axis + "_extent"]){ return; }
        // Base Scale
        this[axis + "_scale"] = d3.scale.linear()
            .domain(this[axis + "_extent"])
            .range(ranges[axis + "_shifted"]);
        // Shift the extent
        this[axis + "_extent"] = [ Math.round(this[axis + "_scale"].invert(ranges[axis][0])),
                                   Math.round(this[axis + "_scale"].invert(ranges[axis][1])) ];
        // Finalize Scale
        this[axis + "_scale"] = d3.scale.linear()
                .domain(this[axis + "_extent"]).range(ranges[axis]);
        // Ticks
        if (this.layout.axes[axis].ticks){
            this[axis + "_ticks"] = this.layout.axes[axis].ticks;
        } else {
            this[axis + "_ticks"] = LocusZoom.prettyTicks(this[axis + "_extent"], "both");
        }
    }.bind(this));

    // Render axes and labels
    var canRenderAxis = function(axis){
        return (typeof this[axis + "_scale"] == "function" && !isNaN(this[axis + "_scale"](0)));
    }.bind(this);
    
    if (this.layout.axes.x.render && canRenderAxis("x")){
        this.renderAxis("x");
    }

    if (this.layout.axes.y1.render && canRenderAxis("y1")){
        this.renderAxis("y1");
    }

    if (this.layout.axes.y2.render && canRenderAxis("y2")){
        this.renderAxis("y2");
    }

    // Establish mousewheel zoom event handers on the panel (namespacing not passed through by d3, so not used here)
    if (this.layout.interaction.scroll_to_zoom){
        var zoom_handler = function(){
            if (this.interactions.dragging || this.parent.loading_data){ return; }
            var coords = d3.mouse(this.svg.container.node());
            var delta = Math.max(-1, Math.min(1, (d3.event.wheelDelta || -d3.event.detail)));
            if (delta == 0){ return; }
            this.interactions.zooming = {
                scale: (delta < 1) ? 0.9 : 1.1,
                center: coords[0]
            };
            this.render();
            if (this.zoom_timeout != null){ clearTimeout(this.zoom_timeout); }
            this.zoom_timeout = setTimeout(function(){
                this.interactions.zooming = false;
                this.parent.applyState({ start: this.x_extent[0], end: this.x_extent[1] });
            }.bind(this), 500);
        }.bind(this);
        this.zoom_listener = d3.behavior.zoom();
        this.svg.container.call(this.zoom_listener)
            .on("wheel.zoom", zoom_handler)
            .on("mousewheel.zoom", zoom_handler)
            .on("DOMMouseScroll.zoom", zoom_handler);
    }

    // Render data layers in order by z-index
    this.data_layer_ids_by_z_index.forEach(function(data_layer_id){
        this.data_layers[data_layer_id].draw().render();
    }.bind(this));
    
    // Broadcast this panel's interaction, extent, and scale to other axis-linked panels, if necessary
    if (called_from_broadcast){ return this; }
    if (this.layout.interaction.x_linked || this.layout.interaction.y1_linked || this.layout.interaction.y2_linked){
        ["x", "y1", "y2"].forEach(function(axis){
            if (!this.layout.interaction[axis + "_linked"]){ return; }
            if (!(this.interactions.zooming || (this.interactions.dragging && this.interactions.dragging["on_" + axis]))){ return; }
            this.parent.panel_ids_by_y_index.forEach(function(panel_id){
                if (panel_id == this.id || !this.parent.panels[panel_id].layout.interaction[axis + "_linked"]){ return; }
                this.parent.panels[panel_id][axis + "_scale"] = this[axis + "_scale"];
                this.parent.panels[panel_id].interactions = this.interactions;
                this.parent.panels[panel_id].render(true);
            }.bind(this));
        }.bind(this));
    }

    return this;
    
};


// Render ticks for a particular axis
LocusZoom.Panel.prototype.renderAxis = function(axis){

    if (["x", "y1", "y2"].indexOf(axis) == -1){
        throw("Unable to render axis; invalid axis identifier: " + axis);
    }

    // Axis-specific values to plug in where needed
    var axis_params = {
        x: {
            position: "translate(" + this.layout.margin.left + "," + (this.layout.height - this.layout.margin.bottom) + ")",
            orientation: "bottom",
            label_x: this.layout.cliparea.width / 2,
            label_y: (this.layout.axes[axis].label_offset || 0),
            label_rotate: null
        },
        y1: {
            position: "translate(" + this.layout.margin.left + "," + this.layout.margin.top + ")",
            orientation: "left",
            label_x: -1 * (this.layout.axes[axis].label_offset || 0),
            label_y: this.layout.cliparea.height / 2,
            label_rotate: -90
        },
        y2: {
            position: "translate(" + (this.layout.width - this.layout.margin.right) + "," + this.layout.margin.top + ")",
            orientation: "right",
            label_x: (this.layout.axes[axis].label_offset || 0),
            label_y: this.layout.cliparea.height / 2,
            label_rotate: -90
        }
    };

    // Determine if the ticks are all numbers (d3-automated tick rendering) or not (manual tick rendering)
    var ticksAreAllNumbers = (function(ticks){
        for (var i = 0; i < ticks.length; i++){
            if (isNaN(ticks[i])){
                return false;
            }
        }
        return true;
    })(this[axis+"_ticks"]);

    // Initialize the axis; set scale and orientation
    this[axis+"_axis"] = d3.svg.axis().scale(this[axis+"_scale"]).orient(axis_params[axis].orientation).tickPadding(3);

    // Set tick values and format
    if (ticksAreAllNumbers){
        this[axis+"_axis"].tickValues(this[axis+"_ticks"]);
        if (this.layout.axes[axis].tick_format == "region"){
            this[axis+"_axis"].tickFormat(function(d) { return LocusZoom.positionIntToString(d, 6); });
        }
    } else {
        var ticks = this[axis+"_ticks"].map(function(t){
            return(t.x);
        });
        this[axis+"_axis"].tickValues(ticks)
            .tickFormat(function(t, i) { return this[axis+"_ticks"][i].text; }.bind(this));
    }

    // Position the axis in the SVG and apply the axis construct
    this.svg[axis+"_axis"]
        .attr("transform", axis_params[axis].position)
        .call(this[axis+"_axis"]);

    // If necessary manually apply styles and transforms to ticks as specified by the layout
    if (!ticksAreAllNumbers){
        var tick_selector = d3.selectAll("g#" + this.getBaseId().replace(".","\\.") + "\\." + axis + "_axis g.tick");
        var panel = this;
        tick_selector.each(function(d, i){
            var selector = d3.select(this).select("text");
            if (panel[axis+"_ticks"][i].style){
                selector.style(panel[axis+"_ticks"][i].style);
            }
            if (panel[axis+"_ticks"][i].transform){
                selector.attr("transform", panel[axis+"_ticks"][i].transform);
            }
        });
    }

    // Render the axis label if necessary
    var label = this.layout.axes[axis].label || null;
    if (this.layout.axes[axis].label_function){
        label = LocusZoom.LabelFunctions.get(this.layout.axes[axis].label_function, this.state);
    }
    if (label != null){
        this.svg[axis+"_axis_label"]
            .attr("x", axis_params[axis].label_x).attr("y", axis_params[axis].label_y)
            .text(label);
        if (axis_params[axis].label_rotate != null){
            this.svg[axis+"_axis_label"]
                .attr("transform", "rotate(" + axis_params[axis].label_rotate + " " + axis_params[axis].label_x + "," + axis_params[axis].label_y + ")");
        }
    }

    // Attach interactive handlers to ticks as needed
    ["x", "y1", "y2"].forEach(function(axis){
        var panel = this;
        var namespace = "." + this.parent.id + "." + this.id + ".interaction.drag";
        if (this.layout.interaction["drag_" + axis + "_ticks_to_scale"]){
            var tick_mouseover = function(){
                if (typeof d3.select(this).node().focus == "function"){ d3.select(this).node().focus(); }
                var cursor = (axis == "x") ? "ew-resize" : "ns-resize";
                if (d3.event && d3.event.shiftKey){ cursor = "move"; }
                d3.select(this)
                    .style({"font-weight": "bold", "cursor": cursor})
                    .on("keydown" + namespace, tick_mouseover)
                    .on("keyup" + namespace, tick_mouseover);
            };
            this.svg.container.selectAll(".lz-axis.lz-" + axis + " .tick text")
                .attr("tabindex", 0) // necessary to make the tick focusable so keypress events can be captured
                .on("mouseover" + namespace, tick_mouseover)
                .on("mouseout" + namespace,  function(){
                    d3.select(this).style({"font-weight": "normal"});
                    d3.select(this).on("keydown" + namespace, null).on("keyup" + namespace, null);
                })
                .on("mousedown" + namespace, function(){ panel.toggleDragging(axis + "_tick"); });
        }
    }.bind(this));

    return this;

};

// Toggle a drag event for the panel
// If passed a method will initialize dragging for that method
// If not passed a method will disable dragging for the current method
LocusZoom.Panel.prototype.toggleDragging = function(method){
    // Helper function to find the appropriate axis layouts on child data layers
    // Once found, apply the extent as floor/ceiling and remove all other directives
    // This forces all associated axes to conform to the extent generated by a drag action
    var overrideAxisLayout = function(axis, axis_number, extent){
        this.data_layer_ids_by_z_index.forEach(function(id){
            if (this.data_layers[id].layout[axis+"_axis"].axis == axis_number){
                this.data_layers[id].layout[axis+"_axis"].floor = extent[0];
                this.data_layers[id].layout[axis+"_axis"].ceiling = extent[1];
                delete this.data_layers[id].layout[axis+"_axis"].lower_buffer;
                delete this.data_layers[id].layout[axis+"_axis"].upper_buffer;
                delete this.data_layers[id].layout[axis+"_axis"].min_extent;
                delete this.data_layers[id].layout[axis+"_axis"].ticks;
            }
        }.bind(this));
    }.bind(this);
    method = method || null;

    // Stop a current drag event (stopping procedure varies by drag method)
    if (this.interactions.dragging){
        switch(this.interactions.dragging.method){
        case "background":
        case "x_tick":
            if (this.interactions.dragging.dragged_x != 0){
                overrideAxisLayout("x", 1, this.x_extent);
                this.parent.applyState({ start: this.x_extent[0], end: this.x_extent[1] });
            }
            break;
        case "y1_tick":
        case "y2_tick":
            if (this.interactions.dragging.dragged_y != 0){
                var y_axis_number = this.interactions.dragging.method[1];
                overrideAxisLayout("y", y_axis_number, this["y"+y_axis_number+"_extent"]);
            }
            break;
        }
        this.interactions.dragging = false;
        this.svg.container.style("cursor", null);
        return this;
    }

    // Start a drag event for the supplied method if currently allowed by the rules defined in this.canInteract()
    else if (this.canInteract()){
        var coords = d3.mouse(this.svg.container.node());
        this.interactions.dragging = {
            method: method,
            panel_id: this.id,
            start_x: coords[0],
            start_y: coords[1],
            dragged_x: 0,
            dragged_y: 0
        };
        if (method == "background" || method == "x_tick"){ this.interactions.dragging.on_x = true; }
        if (method == "y1_tick"){ this.interactions.dragging.on_y1 = true; }
        if (method == "y2_tick"){ this.interactions.dragging.on_y2 = true; }
        this.svg.container.style("cursor", "all-scroll");
        return this;
    }

    return this;
};

// Force the height of this panel to the largest absolute height of the data in
// all child data layers (if not null for any child data layers)
LocusZoom.Panel.prototype.scaleHeightToData = function(){
    var target_height = null;
    this.data_layer_ids_by_z_index.forEach(function(id){
        var dh = this.data_layers[id].getAbsoluteDataHeight();
        if (+dh){
            if (target_height == null){ target_height = +dh; }
            else { target_height = Math.max(target_height, +dh); }
        }
    }.bind(this));
    if (target_height != null){
        target_height += +this.layout.margin.top + +this.layout.margin.bottom;
        this.setDimensions(this.layout.width, target_height);
        this.parent.setDimensions();
        this.parent.panel_ids_by_y_index.forEach(function(id){
            this.parent.panels[id].layout.proportional_height = null;
        }.bind(this));
        this.parent.positionPanels();
    }
};

// Add a "basic" loader to a panel
// This method is jsut a shortcut for adding the most commonly used type of loader
// which appears when data is requested, animates (e.g. shows an infinitely cycling
// progress bar as opposed to one that loads from 0-100% based on actual load progress),
// and disappears when new data is loaded and rendered.
LocusZoom.Panel.prototype.addBasicLoader = function(show_immediately){
    if (typeof show_immediately != "undefined"){ show_immediately = true; }
    if (show_immediately){
        this.loader.show("Loading...").animate();
    }
    this.on("data_requested", function(){
        this.loader.show("Loading...").animate();
    }.bind(this));
    this.on("data_rendered", function(){
        this.loader.hide();
    }.bind(this));
    return this;
};
