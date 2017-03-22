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
    this.parent_plot = parent;

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
    this.applyDataLayerZIndexesToDataLayerLayouts = function(){
        this.data_layer_ids_by_z_index.forEach(function(dlid, idx){
            this.data_layers[dlid].layout.z_index = idx;
        }.bind(this));
    }.bind(this);
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

    // Initialize the layout
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.DefaultLayout = {
    title: { text: "", style: {}, x: 10, y: 22 },
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

LocusZoom.Panel.prototype.setTitle = function(title){
    if (typeof this.layout.title == "string"){
        var text = this.layout.title;
        this.layout.title = { text: text, x: 0, y: 0, style: {} };
    }
    if (typeof title == "string"){
        this.layout.title.text = title;
    } else if (typeof title == "object" && title != null){
        this.layout.title = LocusZoom.Layouts.merge(title, this.layout.title);
    }
    if (this.layout.title.text.length){
        this.title.attr("display", null)
            .attr("x", parseFloat(this.layout.title.x))
            .attr("y", parseFloat(this.layout.title.y))
            .style(this.layout.title.style)
            .text(this.layout.title.text);
    } else {
        this.title.attr("display", "none");
    }
    return this;
};

// Initialize a panel
LocusZoom.Panel.prototype.initialize = function(){

    // Append a container group element to house the main panel group element and the clip path
    // Position with initial layout parameters
    this.svg.container = this.parent.svg.append("g")
        .attr("id", this.getBaseId() + ".panel_container")
        .attr("transform", "translate(" + (this.layout.origin.x || 0) + "," + (this.layout.origin.y || 0) + ")");

    // Append clip path to the parent svg element, size with initial layout parameters
    var clipPath = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip");
    this.svg.clipRect = clipPath.append("rect")
        .attr("width", this.layout.width).attr("height", this.layout.height);
    
    // Append svg group for rendering all panel child elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".panel")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Add curtain and loader prototpyes to the panel
    this.curtain = LocusZoom.generateCurtain.call(this);
    this.loader = LocusZoom.generateLoader.call(this);

    // Create the dashboard object and hang components on it as defined by panel layout
    this.dashboard = new LocusZoom.Dashboard(this);

    // Inner border
    this.inner_border = this.svg.group.append("rect")
        .attr("class", "lz-panel-background")
        .on("click", function(){
            if (this.layout.background_click == "clear_selections"){ this.clearSelections(); }
        }.bind(this));

    // Add the title
    this.title = this.svg.group.append("text").attr("class", "lz-panel-title");
    if (typeof this.layout.title != "undefined"){ this.setTitle(); }

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
    if (this.layout.interaction.drag_background_to_pan){
        var namespace = "." + this.parent.id + "." + this.id + ".interaction.drag";
        var mousedown = function(){
            this.parent.startDrag(this, "background");
        }.bind(this);
        this.svg.container.select(".lz-panel-background")
            .on("mousedown" + namespace + ".background", mousedown)
            .on("touchstart" + namespace + ".background", mousedown);
    }

    return this;
    
};

// Refresh the sort order of all data layers (called by data layer moveUp and moveDown methods)
LocusZoom.Panel.prototype.resortDataLayers = function(){
    var sort = [];
    this.data_layer_ids_by_z_index.forEach(function(id){
        sort.push(this.data_layers[id].layout.z_index);
    }.bind(this));
    this.svg.group.selectAll("g.lz-data_layer-container").data(sort).sort(d3.ascending);
    this.applyDataLayerZIndexesToDataLayerLayouts();
};

// Get an array of panel IDs that are axis-linked to this panel
LocusZoom.Panel.prototype.getLinkedPanelIds = function(axis){
    axis = axis || null;
    var linked_panel_ids = [];
    if (["x","y1","y2"].indexOf(axis) == -1){ return linked_panel_ids; }
    if (!this.layout.interaction[axis + "_linked"]){ return linked_panel_ids; }
    this.parent.panel_ids_by_y_index.forEach(function(panel_id){
        if (panel_id != this.id && this.parent.panels[panel_id].layout.interaction[axis + "_linked"]){
            linked_panel_ids.push(panel_id);
        }
    }.bind(this));
    return linked_panel_ids;
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
    if (typeof layout !== "object" || typeof layout.id !== "string" || !layout.id.length){
        throw "Invalid data layer layout passed to LocusZoom.Panel.prototype.addDataLayer()";
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

    // If a discrete z_index was set in the layout then adjust other data layer z_index values to accommodate this one
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

// Remove a data layer by id
LocusZoom.Panel.prototype.removeDataLayer = function(id){
    if (!this.data_layers[id]){
        throw ("Unable to remove data layer, ID not found: " + id);
    }

    // Destroy all tooltips for the data layer
    this.data_layers[id].destroyAllTooltips();

    // Remove the svg container for the data layer if it exists
    if (this.data_layers[id].svg.container){
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
    this.layout.data_layers.forEach(function(data_layer_layout, idx){
        this.data_layers[data_layer_layout.id].layout_idx = idx;
    }.bind(this));

    return this;
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
LocusZoom.Panel.prototype.render = function(){

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

    // Set/update panel title if necessary
    this.setTitle();

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
        var base_x_range = { start: 0, end: this.layout.cliparea.width };
        if (this.layout.axes.x.range){
            base_x_range.start = this.layout.axes.x.range.start || base_x_range.start;
            base_x_range.end = this.layout.axes.x.range.end || base_x_range.end;
        }
        ranges.x = [base_x_range.start, base_x_range.end];
        ranges.x_shifted = [base_x_range.start, base_x_range.end];
    }
    if (this.y1_extent){
        var base_y1_range = { start: this.layout.cliparea.height, end: 0 };
        if (this.layout.axes.y1.range){
            base_y1_range.start = this.layout.axes.y1.range.start || base_y1_range.start;
            base_y1_range.end = this.layout.axes.y1.range.end || base_y1_range.end;
        }
        ranges.y1 = [base_y1_range.start, base_y1_range.end];
        ranges.y1_shifted = [base_y1_range.start, base_y1_range.end];
    }
    if (this.y2_extent){
        var base_y2_range = { start: this.layout.cliparea.height, end: 0 };
        if (this.layout.axes.y2.range){
            base_y2_range.start = this.layout.axes.y2.range.start || base_y2_range.start;
            base_y2_range.end = this.layout.axes.y2.range.end || base_y2_range.end;
        }
        ranges.y2 = [base_y2_range.start, base_y2_range.end];
        ranges.y2_shifted = [base_y2_range.start, base_y2_range.end];
    }

    // Shift ranges based on any drag or zoom interactions currently underway
    if (this.parent.interaction.panel_id && (this.parent.interaction.panel_id == this.id || this.parent.interaction.linked_panel_ids.indexOf(this.id) != -1)){
        var anchor, scalar = null;
        if (this.parent.interaction.zooming && typeof this.x_scale == "function"){
            var current_extent_size = Math.abs(this.x_extent[1] - this.x_extent[0]);
            var current_scaled_extent_size = Math.round(this.x_scale.invert(ranges.x_shifted[1])) - Math.round(this.x_scale.invert(ranges.x_shifted[0]));
            var zoom_factor = this.parent.interaction.zooming.scale;
            var potential_extent_size = Math.floor(current_scaled_extent_size * (1 / zoom_factor));
            if (zoom_factor < 1 && !isNaN(this.parent.layout.max_region_scale)){
                zoom_factor = 1 /(Math.min(potential_extent_size, this.parent.layout.max_region_scale) / current_scaled_extent_size);
            } else if (zoom_factor > 1 && !isNaN(this.parent.layout.min_region_scale)){
                zoom_factor = 1 / (Math.max(potential_extent_size, this.parent.layout.min_region_scale) / current_scaled_extent_size);
            }
            var new_extent_size = Math.floor(current_extent_size * zoom_factor);
            anchor = this.parent.interaction.zooming.center - this.layout.margin.left - this.layout.origin.x;
            var offset_ratio = anchor / this.layout.cliparea.width;
            var new_x_extent_start = Math.max(Math.floor(this.x_scale.invert(ranges.x_shifted[0]) - ((new_extent_size - current_scaled_extent_size) * offset_ratio)), 1);
            ranges.x_shifted = [ this.x_scale(new_x_extent_start), this.x_scale(new_x_extent_start + new_extent_size) ];
        } else if (this.parent.interaction.dragging){
            switch (this.parent.interaction.dragging.method){
            case "background":
                ranges.x_shifted[0] = 0 + this.parent.interaction.dragging.dragged_x;
                ranges.x_shifted[1] = this.layout.cliparea.width + this.parent.interaction.dragging.dragged_x;
                break;
            case "x_tick":
                if (d3.event && d3.event.shiftKey){
                    ranges.x_shifted[0] = 0 + this.parent.interaction.dragging.dragged_x;
                    ranges.x_shifted[1] = this.layout.cliparea.width + this.parent.interaction.dragging.dragged_x;
                } else {
                    anchor = this.parent.interaction.dragging.start_x - this.layout.margin.left - this.layout.origin.x;
                    scalar = constrain(anchor / (anchor + this.parent.interaction.dragging.dragged_x), 3);
                    ranges.x_shifted[0] = 0;
                    ranges.x_shifted[1] = Math.max(this.layout.cliparea.width * (1 / scalar), 1);
                }
                break;
            case "y1_tick":
            case "y2_tick":
                var y_shifted = "y" + this.parent.interaction.dragging.method[1] + "_shifted";
                if (d3.event && d3.event.shiftKey){
                    ranges[y_shifted][0] = this.layout.cliparea.height + this.parent.interaction.dragging.dragged_y;
                    ranges[y_shifted][1] = 0 + this.parent.interaction.dragging.dragged_y;
                } else {
                    anchor = this.layout.cliparea.height - (this.parent.interaction.dragging.start_y - this.layout.margin.top - this.layout.origin.y);
                    scalar = constrain(anchor / (anchor - this.parent.interaction.dragging.dragged_y), 3);
                    ranges[y_shifted][0] = this.layout.cliparea.height;
                    ranges[y_shifted][1] = this.layout.cliparea.height - (this.layout.cliparea.height * (1 / scalar));
                }
            }
        }
    }

    // Generate scales and ticks for all axes, then render them
    ["x", "y1", "y2"].forEach(function(axis){
        if (!this[axis + "_extent"]){ return; }

        // Base Scale
        this[axis + "_scale"] = d3.scale.linear()
            .domain(this[axis + "_extent"])
            .range(ranges[axis + "_shifted"]);

        // Shift the extent
        this[axis + "_extent"] = [ this[axis + "_scale"].invert(ranges[axis][0]),
                                   this[axis + "_scale"].invert(ranges[axis][1]) ];

        // Finalize Scale
        this[axis + "_scale"] = d3.scale.linear()
                .domain(this[axis + "_extent"]).range(ranges[axis]);
        // Ticks
        if (this.layout.axes[axis].ticks){
            this[axis + "_ticks"] = this.layout.axes[axis].ticks;
        } else {
            this[axis + "_ticks"] = LocusZoom.prettyTicks(this[axis + "_extent"], "both");
        }

        // Render
        this.renderAxis(axis);
    }.bind(this));

    // Establish mousewheel zoom event handers on the panel (namespacing not passed through by d3, so not used here)
    if (this.layout.interaction.scroll_to_zoom){
        var zoom_handler = function(){
            // Look for a shift key press while scrolling to execute.
            // If not present, gracefully raise a notification and allow conventional scrolling
            if (!d3.event.shiftKey){
                if (this.parent.canInteract(this.id)){
                    this.loader.show("Press <tt>[SHIFT]</tt> while scrolling to zoom").hide(1000);
                }
                return;
            }
            d3.event.preventDefault();
            if (!this.parent.canInteract(this.id)){ return; }
            var coords = d3.mouse(this.svg.container.node());
            var delta = Math.max(-1, Math.min(1, (d3.event.wheelDelta || -d3.event.detail || -d3.event.deltaY)));
            if (delta == 0){ return; }
            this.parent.interaction = {
                panel_id: this.id,
                linked_panel_ids: this.getLinkedPanelIds("x"),
                zooming: {
                    scale: (delta < 1) ? 0.9 : 1.1,
                    center: coords[0]
                }
            };
            this.render();
            this.parent.interaction.linked_panel_ids.forEach(function(panel_id){
                this.parent.panels[panel_id].render();
            }.bind(this));
            if (this.zoom_timeout != null){ clearTimeout(this.zoom_timeout); }
            this.zoom_timeout = setTimeout(function(){
                this.parent.interaction = {};
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

    return this;
    
};


// Render ticks for a particular axis
LocusZoom.Panel.prototype.renderAxis = function(axis){

    if (["x", "y1", "y2"].indexOf(axis) == -1){
        throw("Unable to render axis; invalid axis identifier: " + axis);
    }

    var canRender = this.layout.axes[axis].render
        && typeof this[axis + "_scale"] == "function"
        && !isNaN(this[axis + "_scale"](0));

    // If the axis has already been rendered then check if we can/can't render it
    // Make sure the axis element is shown/hidden to suit
    if (this[axis+"_axis"]){
        this.svg.container.select("g.lz-axis.lz-"+axis).style("display", canRender ? null : "none");
    }

    if (!canRender){ return this; }

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
            return(t[axis.substr(0,1)]);
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
    if (label != null){
        this.svg[axis+"_axis_label"]
            .attr("x", axis_params[axis].label_x).attr("y", axis_params[axis].label_y)
            .text(LocusZoom.parseFields(this.state, label));
        if (axis_params[axis].label_rotate != null){
            this.svg[axis+"_axis_label"]
                .attr("transform", "rotate(" + axis_params[axis].label_rotate + " " + axis_params[axis].label_x + "," + axis_params[axis].label_y + ")");
        }
    }

    // Attach interactive handlers to ticks as needed
    ["x", "y1", "y2"].forEach(function(axis){
        if (this.layout.interaction["drag_" + axis + "_ticks_to_scale"]){
            var namespace = "." + this.parent.id + "." + this.id + ".interaction.drag";
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
                .on("mousedown" + namespace, function(){
                    this.parent.startDrag(this, axis + "_tick");
                }.bind(this));
        }
    }.bind(this));

    return this;

};

// Force the height of this panel to the largest absolute height of the data in
// all child data layers (if not null for any child data layers)
// May optionally take an arbitrary target height (useful for when data layers are transitioning
// and the ending target height can be pre-calculated)
LocusZoom.Panel.prototype.scaleHeightToData = function(target_height){
    target_height = +target_height || null;
    if (target_height == null){
        this.data_layer_ids_by_z_index.forEach(function(id){
            var dh = this.data_layers[id].getAbsoluteDataHeight();
            if (+dh){
                if (target_height == null){ target_height = +dh; }
                else { target_height = Math.max(target_height, +dh); }
            }
        }.bind(this));
    }
    if (+target_height){
        target_height += +this.layout.margin.top + +this.layout.margin.bottom;
        this.setDimensions(this.layout.width, target_height);
        this.parent.setDimensions();
        this.parent.panel_ids_by_y_index.forEach(function(id){
            this.parent.panels[id].layout.proportional_height = null;
        }.bind(this));
        this.parent.positionPanels();
    }
};

// Methods to set/unset element statuses across all data layers
LocusZoom.Panel.prototype.setElementStatusByFilters = function(status, toggle, filters, exclusive){
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].setElementStatusByFilters(status, toggle, filters, exclusive);
    }.bind(this));
};
LocusZoom.Panel.prototype.setAllElementStatus = function(status, toggle){
    this.data_layer_ids_by_z_index.forEach(function(id){
        this.data_layers[id].setAllElementStatus(status, toggle);
    }.bind(this));
};
LocusZoom.DataLayer.Statuses.verbs.forEach(function(verb, idx){
    var adjective = LocusZoom.DataLayer.Statuses.adjectives[idx];
    var antiverb = "un" + verb;
    // Set/unset status for arbitrarily many elements given a set of filters
    LocusZoom.Panel.prototype[verb + "ElementsByFilters"] = function(filters, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        return this.setElementStatusByFilters(adjective, true, filters, exclusive);
    };
    LocusZoom.Panel.prototype[antiverb + "ElementsByFilters"] = function(filters, exclusive){
        if (typeof exclusive == "undefined"){ exclusive = false; } else { exclusive = !!exclusive; }
        return this.setElementStatusByFilters(adjective, false, filters, exclusive);
    };
    // Set/unset status for all elements
    LocusZoom.Panel.prototype[verb + "AllElements"] = function(){
        this.setAllElementStatus(adjective, true);
        return this;
    };
    LocusZoom.Panel.prototype[antiverb + "AllElements"] = function(){
        this.setAllElementStatus(adjective, false);
        return this;
    };
});

// Add a "basic" loader to a panel
// This method is just a shortcut for adding the most commonly used type of loader
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
