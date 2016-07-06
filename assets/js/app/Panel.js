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
    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.Panel.DefaultLayout);

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

    this.x_extent  = null;
    this.y1_extent = null;
    this.y2_extent = null;

    this.x_ticks  = [];
    this.y1_ticks = [];
    this.y2_ticks = [];

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
    };
    this.emit = function(event, context){
        if (typeof "event" != "string" || !Array.isArray(this.event_hooks[event])){
            throw("LocusZoom attempted to throw an invalid event: " + event.toString());
        }
        context = context || this;
        this.event_hooks[event].forEach(function(hookToRun) {
            hookToRun.call(context);
        });
    };
    
    // Get an object with the x and y coordinates of the panel's origin in terms of the entire page
    // Necessary for positioning any HTML elements over the panel
    this.getPageOrigin = function(){
        var instance_origin = this.parent.getPageOrigin();
        return {
            x: instance_origin.x + this.layout.origin.x,
            y: instance_origin.y + this.layout.origin.y
        };
    };

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
    origin: { x: 0, y: 0 },
    min_width: 1,
    min_height: 1,
    proportional_width: null,
    proportional_height: null,
    proportional_origin: { x: 0, y: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    controls: {
        reposition: true,
        remove: true,
        description: false,
        conditions: false
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

    // Initialize panel axes
    ["x", "y1", "y2"].forEach(function(axis){
        if (!Object.keys(this.layout.axes[axis]).length || this.layout.axes[axis].render === false){
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
        this.controls.update();
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
    this.svg.container = this.parent.svg.insert("svg:g", "#" + this.parent.id + "\\.ui")
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

    // Initialize controls element
    this.controls = {
        selector: null,
        hide_timeout: null,
        showing: false,
        buttons: {}
    };
    // Show controls: insert controls div after all tooltips (to show above them)
    this.controls.show = function(){
        if (this.controls.showing === true){ return this.controls; }
        if (!this.controls.showing){
            this.controls.selector = d3.select(this.parent.svg.node().parentNode)
                .insert("div", ".lz-data_layer-tooltip")
                .classed("lz-panel-controls", true)
                .attr("id", this.getBaseId() + ".controls");
        }
        this.controls.showing = true;
        return this.controls.update();
    }.bind(this);
    // Update controls: add/remove buttons as needed from controls
    this.controls.update = function(){
        if (!this.controls.showing){
            if (this.state.conditions.length){
                return this.controls.show();
            } else {
                return this.controls;
            }
        }
        for (var button_id in this.controls.buttons){
            this.controls.buttons[button_id].show();
        }
        return this.controls.position();
    }.bind(this);
    // Position controls: position in top right corner of panel (after update so that size is known)
    this.controls.position = function(){
        var page_origin = this.getPageOrigin();
        var client_rect = this.controls.selector.node().getBoundingClientRect();
        var top = page_origin.y.toString() + "px";
        var left = (page_origin.x + this.layout.width - client_rect.width).toString() + "px";
        this.controls.selector.style({ position: "absolute", top: top, left: left });
        return this.controls;
    }.bind(this);
    // Hide controls: attempt destroy controls element (do not destroy if any buttons within are marked to persist)
    this.controls.hide = function(force){
        force = force || false;
        if (!this.controls.showing){ return this.controls; }
        // Do not hide anything if actively in a drag event
        if (this.parent.ui.dragging || this.parent.panel_boundaries.dragging){ return this.controls; }
        // Loop through all buttons and destroy any that are not persisting
        var persisted_button_ids = [];
        for (var button_id in this.controls.buttons){
            if (this.controls.buttons[button_id].persist && !force){
                persisted_button_ids.push(button_id);
                continue;
            } else {
                this.controls.buttons[button_id].hide();
            }
        }
        // If any buttons persisted then update them now (to trigger repositioning of menus where applicable)
        // If no buttons persisted then destroy the controls element
        if (persisted_button_ids.length){
            this.controls.position();
            persisted_button_ids.forEach(function(button_id){
                this.controls.buttons[button_id].update();
            }.bind(this));
            this.controls.showing = "persisted";
        } else {
            this.controls.selector.remove();
            this.controls.selector = null;
            this.controls.showing = false;
        }
        return this.controls;
    }.bind(this);

    // If controls are defined add mouseover controls to the plot container to show/hide them
    if (this.layout.controls){
        d3.select(this.parent.svg.node().parentNode).on("mouseover." + this.getBaseId() + ".controls", function(){
            clearTimeout(this.controls.hide_timeout);
            this.controls.show();
        }.bind(this));
        d3.select(this.parent.svg.node().parentNode).on("mouseout." + this.getBaseId() + ".controls", function(){
            this.controls.hide_timeout = setTimeout(function(){
                this.controls.hide();
            }.bind(this), 300);
        }.bind(this));
    }

    // Controls button: Conditions
    if (this.layout.controls.conditions){
        this.controls.buttons.conditions = new LocusZoom.PanelControlsButton("conditions", this)
            .setColor("purple").setText("not conditioning").setTitle("Conditional Analysis")
            .menuPopulate(function(){
                var selector = this.controls.buttons.conditions.menu.inner_selector;
                selector.html("");
                selector.append("h3").html("Conditional Analysis");
                var table = selector.append("table");
                this.state.conditions.forEach(function(condition, idx){
                    var html = condition.toString();
                    if (typeof condition == "object" && typeof condition.toHTML == "function"){
                        html = condition.toHTML();
                    }
                    var row = table.append("tr");
                    row.append("td").append("button")
                        .attr("class", "lz-panel-controls-button lz-panel-controls-button-purple")
                        .style({ "margin-left": "0em" })
                        .on("click", function(){
                            this.parent.removeConditionByIdx(idx);
                        }.bind(this))
                        .text("×");
                    row.append("td").html(html);
                }.bind(this));
                selector.append("button")
                    .attr("class", "lz-panel-controls-button lz-panel-controls-button-purple")
                    .style({ "margin-left": "4px" }).html("× Remove All Conditions")
                    .on("click", function(){
                        this.parent.removeAllConditions();
                    }.bind(this));
            }.bind(this));
        this.controls.buttons.conditions.preUpdate = function(){
            if (this.parent.state.conditions.length){
                this.setText("Conditioning").setStyle({"font-weight": "bold"}).disable(false);
            } else {
                this.setText("not conditioning").setStyle({"font-weight": "normal"}).disable();
                this.menu.hide();
            }
        };
    }

    // Controls button: description
    if (this.layout.controls.description){
        this.controls.buttons.description = new LocusZoom.PanelControlsButton("description", this)
            .setColor("yellow").setText("Info").setTitle("Panel information")
            .menuPopulate(function(){
                this.controls.buttons.description.menu.inner_selector.html(this.layout.description);
            }.bind(this));
    }

    // Controls button: reposition (two buttons: down and up)
    if (this.layout.controls.reposition){
        this.controls.buttons.reposition_down = new LocusZoom.PanelControlsButton("reposition_down", this)
            .setColor("gray").setText("▾").setTitle("Move panel down")
            .onClick(function(){
                if (this.parent.panel_ids_by_y_index[this.layout.y_index + 1]){
                    this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index + 1];
                    this.parent.panel_ids_by_y_index[this.layout.y_index + 1] = this.id;
                    this.parent.applyPanelYIndexesToPanelLayouts();
                    this.parent.positionPanels();
                }
            }.bind(this));
        this.controls.buttons.reposition_down.preUpdate = function(){
            this.status = (this.parent.layout.y_index == this.parent.parent.panel_ids_by_y_index.length - 1) ? "disabled" : "";
        };
        this.controls.buttons.reposition_up = new LocusZoom.PanelControlsButton("reposition_up", this)
            .setColor("gray").setText("▴").setTitle("Move panel up").setStyle({"margin-left": "0em"})
            .onClick(function(){
                if (this.parent.panel_ids_by_y_index[this.layout.y_index - 1]){
                    this.parent.panel_ids_by_y_index[this.layout.y_index] = this.parent.panel_ids_by_y_index[this.layout.y_index - 1];
                    this.parent.panel_ids_by_y_index[this.layout.y_index - 1] = this.id;
                    this.parent.applyPanelYIndexesToPanelLayouts();
                    this.parent.positionPanels();
                }
            }.bind(this));
        this.controls.buttons.reposition_up.preUpdate = function(){
            this.status = (this.parent.layout.y_index == 0) ? "disabled" : "";
        };
    }

    // Controls button: remove
    if (this.layout.controls.remove){
        this.controls.buttons.remove = new LocusZoom.PanelControlsButton("remove", this)
            .setColor("gray").setText("×").setTitle("Remove panel")
            .onClick(function(){
                this.controls.hide(true);
                d3.select(this.parent.svg.node().parentNode).on("mouseover." + this.getBaseId() + ".controls", null);
                d3.select(this.parent.svg.node().parentNode).on("mouseout." + this.getBaseId() + ".controls", null);
                this.parent.removePanel(this.id);
            }.bind(this));
        if (this.layout.controls.reposition){
            this.controls.buttons.remove.setStyle({"margin-left": "0em" });
        }
    }

    // If the layout defines an inner border render it before rendering axes
    if (this.layout.inner_border){
        this.inner_border = this.svg.group.append("rect");
    }

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


// Re-Map a panel to new positions according to the parent instance's state
LocusZoom.Panel.prototype.reMap = function(){
    this.data_promises = [];
    // Trigger reMap on each Data Layer
    for (var id in this.data_layers){
        try {
            this.data_promises.push(this.data_layers[id].reMap());
        } catch (error) {
            console.log(error);
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
            console.log(error);
            this.curtain.show(error);
        }.bind(this));
};

// Iterate over data layers to generate panel axis extents
LocusZoom.Panel.prototype.generateExtents = function(){

    // Reset extents
    this.x_extent = null;
    this.y1_extent = null;
    this.y2_extent = null;

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

};


// Render a given panel
LocusZoom.Panel.prototype.render = function(){

    // Position the panel container
    this.svg.container.attr("transform", "translate(" + this.layout.origin.x +  "," + this.layout.origin.y + ")");

    // Set size on the clip rect
    this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);

    // Set and position the inner border, if necessary
    if (this.layout.inner_border){
        this.inner_border
            .attr("x", this.layout.margin.left).attr("y", this.layout.margin.top)
            .attr("width", this.layout.width - (this.layout.margin.left + this.layout.margin.right))
            .attr("height", this.layout.height - (this.layout.margin.top + this.layout.margin.bottom))
            .style({ "fill": "none",
                     "stroke-width": 1,
                     "stroke": this.layout.inner_border });
    }

    // Regenerate all extents
    this.generateExtents();

    // Generate ticks and scales using generated extents
    if (this.x_extent){
        if (this.layout.axes.x.ticks){
            this.x_ticks = this.layout.axes.x.ticks;
        } else {
            this.x_ticks = LocusZoom.prettyTicks(this.x_extent, "both", this.layout.cliparea.width/120);
        }
        this.x_scale = d3.scale.linear()
            .domain([this.x_extent[0], this.x_extent[1]])
            .range([0, this.layout.cliparea.width]);
    }
    if (this.y1_extent){
        if (this.layout.axes.y1.ticks){
            this.y1_ticks = this.layout.axes.y1.ticks;
        } else {
            this.y1_ticks = LocusZoom.prettyTicks(this.y1_extent);
        }
        this.y1_extent = d3.extent(this.y1_extent.concat(this.y1_ticks));
        this.y1_scale = d3.scale.linear()
            .domain([this.y1_extent[0], this.y1_extent[1]])
            .range([this.layout.cliparea.height, 0]);
    }
    if (this.y2_extent){
        if (this.layout.axes.y2.ticks){
            this.y2_ticks = this.layout.axes.y2.ticks;
        } else {
            this.y2_ticks = LocusZoom.prettyTicks(this.y2_extent);
        }
        this.y2_extent = d3.extent(this.y2_extent.concat(this.y2_ticks));
        this.y2_scale = d3.scale.linear()
            .domain([this.y2_extent[0], this.y2_extent[1]])
            .range([this.layout.cliparea.height, 0]);
    }

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
    this[axis+"_axis"] = d3.svg.axis()
        .scale(this[axis+"_scale"]).orient(axis_params[axis].orientation);

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

};


/**

  LocusZoom.PanelControlsButton Class

  Panels have a "controls" element that appears at the top right to display interactive HTML overlays.
  Each of these individual overlays is a Panel Controls Button. It can have a click action and call up
  a companion overlay called a menu for displaying static information or dynamic/interactive elements.

*/

LocusZoom.PanelControlsButton = function(id, parent) {   

    if (!parent || !parent.controls || !parent.controls.buttons){
        throw "Unable to create panel controls button, invalid parent";
    }
    this.parent = parent;

    if (typeof id !== "string" || typeof this.parent.controls.buttons[id] !== "undefined"){
        throw "Cannot create panel controls button, id invalid or already in use";
    }
    this.id = id;

    this.showing = false;
    this.persist = false;
    this.selector = null;

    // HTML controls
    this.text = "";
    this.setText = function(text){
        this.text = text;
        return this;
    };

    // Title controls (HTML built-in tool tip)
    this.title = "";
    this.setTitle = function(title){
        this.title = title;
        return this;
    };

    // Color controls (using predefined CSS classes as opposed to styles)
    this.color = "gray";
    this.setColor = function(color){
        if (["gray", "red", "orange", "yellow", "blue", "purple"].indexOf(color) !== -1){ this.color = color; }
        return this;
    };

    // Style controls
    this.style = {};
    this.setStyle = function(style){
        this.style = style;
        return this;
    };

    // Status controls (highlighted / disabled)
    this.status = "";
    this.setStatus = function(status){
        if (["", "highlighted", "disabled"].indexOf(status) !== -1){ this.status = status; }
        return this;
    };
    this.highlight = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("highlighted"); }
        else if (this.status == "highlighted"){ return this.setStatus(""); }
        return this;
    };
    this.disable = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("disabled"); }
        else if (this.status == "disabled"){ return this.setStatus(""); }
        return this;
    };

    // OnClick controls
    this.onclick_function = function(){};
    this.onClick = function(onclick_function){
        if (typeof onclick_function == "function"){ this.onclick_function = onclick_function; }
        return this;
    };
    
    // Primary behavior functions
    this.show = function(){
        if (!this.showing){
            this.selector = this.parent.controls.selector.append("button")
                .attr("class", "lz-panel-controls-button");
            this.showing = true;
        }
        return this.update();
    };
    this.preUpdate = function(){ return this; };
    this.update = function(){
        if (!this.showing){ return this; }
        this.preUpdate();
        this.selector
            .attr("class", "lz-panel-controls-button lz-panel-controls-button-" + this.color + (this.status ? "-" + this.status : ""))
            .attr("title", this.title).style(this.style)
            .on("click", (this.status == "disabled") ? null : this.onclick_function)
            .text(this.text);
        if (this.menu.enabled){ this.menu.update(); }
        this.postUpdate();
        return this;
    };
    this.postUpdate = function(){ return this; };
    this.hide = function(){
        if (this.showing && !this.persist){
            this.selector.remove();
            this.showing = false;
        }
        return this;
    };    

    // Menu object and controls
    this.menu = {
        outer_selector: null,
        inner_selector: null,
        showing: false,
        enabled: false
    };
    this.menu.show = function(){
        if (this.menu.showing){ return this; }
        this.menu.outer_selector = d3.select(this.parent.parent.svg.node().parentNode).append("div")
            .attr("class", "lz-panel-controls lz-panel-controls-menu lz-panel-controls-menu-" + this.color)
            .attr("id", this.parent.getBaseId() + ".controls." + this.id + ".menu");
        this.menu.inner_selector = this.menu.outer_selector.append("div")
            .attr("class", "lz-panel-controls-menu-content");
        this.menu.showing = true;
        return this.menu.update();
    }.bind(this);
    this.menu.update = function(){
        if (!this.menu.showing){ return this.menu; }
        this.menu.populate(); // This is the custom part
        return this.menu.position();
    }.bind(this);
    this.menu.position = function(){
        if (!this.menu.showing){ return this.menu; }
        var padding = 3;
        var page_origin = this.parent.getPageOrigin();
        var controls_client_rect = this.parent.controls.selector.node().getBoundingClientRect();
        var menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
        var total_content_height = this.menu.inner_selector.node().scrollHeight;
        var top = (page_origin.y + controls_client_rect.height + padding).toString() + "px";
        var left = Math.max(page_origin.x + this.parent.layout.width - menu_client_rect.width - padding, page_origin.x + padding).toString() + "px";
        var base_max_width = (this.parent.layout.width - (2 * padding));
        var container_max_width = base_max_width.toString() + "px";
        var content_max_width = (base_max_width - (4 * padding)).toString() + "px";
        var base_max_height = (this.parent.layout.height - (7 * padding) - controls_client_rect.height);
        var height = Math.min(total_content_height, base_max_height).toString() + "px";
        var max_height = base_max_height.toString() + "px";
        this.menu.outer_selector.style({
            top: top, left: left,
            "max-width": container_max_width,
            "max-height": max_height,
            height: height
        });
        this.menu.inner_selector.style({ "max-width": content_max_width });        
        return this.menu;
    }.bind(this);
    this.menu.hide = function(){
        if (!this.menu.showing){ return this.menu; }
        this.menu.inner_selector.remove();
        this.menu.outer_selector.remove();
        this.menu.inner_selector = null;
        this.menu.outer_selector = null;
        this.menu.showing = false;
        return this.menu;
    }.bind(this);
    // By convention populate() does nothing and should be reimplemented with each panel controls button definition
    // Reimplement by way of PanelControlsButton.menuPopulate to define the populate method and hook up standard menu
    // click-toggle behavior
    this.menu.populate = function(){
        this.menu.inner_selector.html("...");
    }.bind(this);
    this.menuPopulate = function(menu_populate_function){
        if (typeof menu_populate_function == "function"){
            this.menu.populate = menu_populate_function;
            this.onclick_function = function(){
                if (!this.menu.showing){
                    this.menu.show();
                    this.highlight().update();
                    this.persist = true;
                } else {
                    this.menu.hide();
                    this.highlight(false).update();
                    this.persist = false;
                }
            }.bind(this);
            this.menu.enabled = true;
        } else {
            this.onclick_function = function(){};
            this.menu.enabled = false;
        }
        return this;
    };

};
