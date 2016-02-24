/* global LocusZoom,d3 */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Panel Class

  A panel is an abstract class representing a subdivision of the LocusZoom stage
  to display a distinct data representation

*/

LocusZoom.Panel = function(id, layout) { 

    this.initialized = false;
    
    this.id     = id;
    this.parent = null;
    this.svg    = {};

    this.layout = layout || {
        width:  0,
        height: 0,
        min_width: 0,
        min_height: 0,
        proportional_width: 1,
        proportional_height: 1,
        origin: { x: 0, y: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
    };
    this.layout.cliparea = this.layout.cliparea || {};
    this.layout.cliparea.origin = this.layout.cliparea.origin || {};

    this.state = {};
    
    this.data_layers = {};
    this.data_promises = [];

    this.xExtent  = null;
    this.y1Extent = null;
    this.y2Extent = null;
    
    this.renderData = function(){};

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };

    // Initialize the layout (should this happen in initialize()?)
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.prototype.initializeLayout = function(){

    // Set panel dimensions, origin, and margin or fall back to default values
    this.layout.width      = this.layout.width      || 0;
    this.layout.height     = this.layout.height     || 0;
    this.layout.min_width  = this.layout.min_width  || 0;
    this.layout.min_height = this.layout.min_height || 0;
    this.layout.proportional_width = this.layout.proportional_width || 1;
    this.layout.proportional_height = this.layout.proportional_height || 1;
    if (typeof this.layout.origin != "object"){ this.layout.origin = { x: 0, y: 0 }; }
    if (typeof this.layout.margin != "object"){ this.layout.margin = { top: 0, right: 0, bottom: 0, left: 0 }; }
    this.layout.margin.top    = this.layout.margin.top    || 0;
    this.layout.margin.right  = this.layout.margin.right  || 0;
    this.layout.margin.bottom = this.layout.margin.bottom || 0;
    this.layout.margin.left   = this.layout.margin.left   || 0;
    this.setDimensions();
    this.setOrigin();
    this.setMargin();

    // Set panel axes
    if (typeof this.layout.axes !== "object"){ this.layout.axes = {}; }
    ["x", "y1", "y2"].forEach(function(axis){
        if (!this.layout.axes[axis]){
            this.layout.axes[axis] = {
                render: false,
                ticks:  [],
                label:  null,
                label_function: null
            };
        } else {
            this.layout.axes[axis].render = true;
            this.layout.axes[axis].ticks = this.layout.axes[axis].ticks || [];
            this.layout.axes[axis].label = this.layout.axes[axis].label || null;
            this.layout.axes[axis].label_function = this.layout.axes[axis].label_function || null;
        }
    }.bind(this));

    // x extent (todo: make this definable from the layout object somehow?)
    this.xExtent = function(){
        return d3.extent([this.parent.state.start, this.parent.state.end]);
    };

    // Add data layers (which define y extents)
    if (typeof this.layout.data_layers == "object"){
        this.layout.data_layers.forEach(function(layout){
            this.addDataLayer(layout);
        }.bind(this));
    }

};

LocusZoom.Panel.prototype.setDimensions = function(width, height){
    if (!isNaN(width) && width >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
    }
    this.layout.cliparea.width = this.layout.width - (this.layout.margin.left + this.layout.margin.right);
    this.layout.cliparea.height = this.layout.height - (this.layout.margin.top + this.layout.margin.bottom);
    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setOrigin = function(x, y){
    if (!isNaN(x) && x >= 0){ this.layout.origin.x = Math.min(Math.max(Math.round(+x), 0), this.parent.layout.width); }
    if (!isNaN(y) && y >= 0){ this.layout.origin.y = Math.min(Math.max(Math.round(+y), 0), this.parent.layout.height); }
    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setMargin = function(top, right, bottom, left){
    if (!isNaN(top)    && top    >= 0){ this.layout.margin.top    = Math.max(Math.round(+top),    0); }
    if (!isNaN(right)  && right  >= 0){ this.layout.margin.right  = Math.max(Math.round(+right),  0); }
    if (!isNaN(bottom) && bottom >= 0){ this.layout.margin.bottom = Math.max(Math.round(+bottom), 0); }
    if (!isNaN(left)   && left   >= 0){ this.layout.margin.left   = Math.max(Math.round(+left),   0); }
    if (this.layout.margin.top + this.layout.margin.bottom > this.layout.height){
        var extra = Math.floor(((this.layout.margin.top + this.layout.margin.bottom) - this.layout.height) / 2);
        this.layout.margin.top -= extra;
        this.layout.margin.bottom -= extra;
    }
    if (this.layout.margin.left + this.layout.margin.right > this.layout.width){
        var extra = Math.floor(((this.layout.margin.left + this.layout.margin.right) - this.layout.width) / 2);
        this.layout.margin.left -= extra;
        this.layout.margin.right -= extra;
    }
    this.layout.cliparea.width = this.layout.width - (this.layout.margin.left + this.layout.margin.right);
    this.layout.cliparea.height = this.layout.height - (this.layout.margin.top + this.layout.margin.bottom);
    this.layout.cliparea.origin.x = this.layout.margin.left;
    this.layout.cliparea.origin.y = this.layout.margin.top;
    if (this.initialized){ this.render(); }
    return this;
};

// Initialize a panel
LocusZoom.Panel.prototype.initialize = function(){

    // Append a container group element to house the main panel group element and the clip path
    this.svg.container = this.parent.svg.insert("svg:g", "#" + this.parent.id + "\\.ui")
        .attr("id", this.getBaseId() + ".panel_container");
        
    // Append clip path to the parent svg element
    var clipPath = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip");
    this.svg.clipRect = clipPath.append("rect");
    
    // Append svg group for rendering all panel child elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".panel")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Append a curtain element with svg element and drop/raise methods
    var panel_curtain_svg = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".curtain")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)")
        .attr("class", "lz-curtain").style("display", "none");
    this.curtain = {
        svg: panel_curtain_svg,
        drop: function(message){
            this.svg.style("display", null);
            if (typeof message != "undefined"){
                this.svg.select("text").selectAll("tspan").remove();
                message.split("\n").forEach(function(line){
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "1.5em").text(line);
                }.bind(this));
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect");
    this.curtain.svg.append("text")
        .attr("id", this.id + ".curtain_text")
        .attr("x", "1em").attr("y", "0em");

    // Initialize Axes
    this.svg.x_axis = this.svg.group.append("g").attr("class", "lz-x lz-axis");
    if (this.layout.axes.x.render){
        this.svg.x_axis_label = this.svg.x_axis.append("text")
            .attr("class", "lz-x lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y1_axis = this.svg.group.append("g").attr("class", "lz-y lz-y1 lz-axis");
    if (this.layout.axes.y1.render){
        this.svg.y1_axis_label = this.svg.y1_axis.append("text")
            .attr("class", "lz-y1 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y2_axis = this.svg.group.append("g").attr("class", "lz-y lz-y2 lz-axis");
    if (this.layout.axes.y2.render){
        this.svg.y2_axis_label = this.svg.y2_axis.append("text")
            .attr("class", "lz-y2 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }

    // Initialize child Data Layers
    for (var id in this.data_layers){
        this.data_layers[id].initialize();
    }

    // Flip the "initialized" bit
    this.initialized = true;

    return this;
    
};


// Create a new data layer by layout object
LocusZoom.Panel.prototype.addDataLayer = function(layout){
    if (typeof layout !== "object"){
        throw "Invalid data layer layout passed to LocusZoom.Instance.prototype.addDataLayer()";
    }
    if (typeof layout.id !== "string"){
        throw "Invalid data layer id in layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof this.data_layers[layout.id] !== "undefined"){
        throw "Cannot create data layer with id [" + id + "]; data layer with that id already exists";
    }
    if (typeof LocusZoom[layout.class] !== "function"){
        throw "Invalid data layer class in layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    var data_layer = new LocusZoom[layout.class](layout);
    data_layer.parent = this;
    this.data_layers[data_layer.id] = data_layer;

    // If the layout specifies a y axis then generate y axis extent function for the appropriate axis (default to y1)
    if (layout.y_axis){
        var y_axis_name = "y" + (layout.y_axis.axis == 1 || layout.y_axis.axis == 2 ? layout.y_axis.axis : 1);
        this[y_axis_name + "Extent"] = this.data_layers[data_layer.id].getYExtent();
    }

    return this.data_layers[data_layer.id];
};


// Re-Map a panel to new positions according to the parent instance's state
LocusZoom.Panel.prototype.reMap = function(){
    this.data_promises = [];
    // Trigger reMap on each Data Layer
    for (var id in this.data_layers){
        this.data_promises.push(this.data_layers[id].reMap());
    }
    // When all finished trigger a render
    return Q.all(this.data_promises).then(function(){
        this.render();
    }.bind(this), function(error){
        console.log(error);
        this.curtain.drop(error);
    }.bind(this));
};


// Render a given panel
LocusZoom.Panel.prototype.render = function(){

    // Position the panel container
    this.svg.container.attr("transform", "translate(" + this.layout.origin.x +  "," + this.layout.origin.y + ")");

    // Set size on the clip rect
    this.svg.clipRect.attr("width", this.layout.width).attr("height", this.layout.height);

    // Generate discrete extents and scales
    if (typeof this.xExtent == "function"){
        this.state.x_extent = this.xExtent();
        this.layout.axes.x.ticks = LocusZoom.prettyTicks(this.state.x_extent, this.layout.cliparea.width/120, true);
        this.state.x_scale = d3.scale.linear()
            .domain([this.state.x_extent[0], this.state.x_extent[1]])
            .range([0, this.layout.cliparea.width]);
    }
    if (typeof this.y1Extent == "function"){
        this.state.y1_extent = this.y1Extent();
        this.layout.axes.y1.ticks = LocusZoom.prettyTicks(this.state.y1_extent);
        this.state.y1_scale = d3.scale.linear()
            .domain([this.layout.axes.y1.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y1.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }
    if (typeof this.y2Extent == "function"){
        this.state.y2_extent = this.y2Extent();
        this.layout.axes.y2.ticks = LocusZoom.prettyTicks(this.state.y2_extent);
        this.state.y2_scale = d3.scale.linear()
            .domain([this.layout.axes.y2.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y2.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }

    // Render axes and labels
    var canRenderAxis = function(axis){
        return (typeof this.state[axis + "_scale"] == "function" && !isNaN(this.state[axis + "_scale"](0)));
    }.bind(this);
    
    if (this.layout.axes.x.render && canRenderAxis("x")){
        this.state.x_axis = d3.svg.axis()
            .scale(this.state.x_scale)
            .orient("bottom").tickValues(this.layout.axes.x.ticks)
            .tickFormat(function(d) { return LocusZoom.positionIntToString(d); });
        this.svg.x_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + (this.layout.height - this.layout.margin.bottom) + ")")
            .call(this.state.x_axis);
        if (this.layout.axes.x.label_function){
            this.layout.axes.x.label = LocusZoom.Panel.LabelFunctions.get(this.layout.axes.x.label_function, this.parent.state);
        }
        if (this.layout.axes.x.label != null){
            var x_label = this.layout.axes.x.label;
            if (typeof this.layout.axes.x.label == "function"){ x_label = this.layout.axes.x.label(); }
            this.svg.x_axis_label
                .attr("x", this.layout.cliparea.width / 2)
                .attr("y", this.layout.margin.bottom * 0.95)
                .text(x_label);
        }
    }

    if (this.layout.axes.y1.render && canRenderAxis("y1")){
        this.state.y1_axis = d3.svg.axis().scale(this.state.y1_scale)
            .orient("left").tickValues(this.layout.axes.y1.ticks);
        this.svg.y1_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + this.layout.margin.top + ")")
            .call(this.state.y1_axis);
        if (this.layout.axes.y1.label_function){
            this.layout.axes.y1.label = LocusZoom.Panel.LabelFunctions.get(this.layout.axes.y1.label_function, this.parent.state);
        }
        if (this.layout.axes.y1.label != null){
            var y1_label = this.layout.axes.y1.label;
            if (typeof this.layout.axes.y1.label == "function"){ y1_label = this.layout.axes.y1.label(); }
            var x = this.layout.margin.left * -0.55;
            var y = this.layout.cliparea.height / 2;
            this.svg.y1_axis_label
                .attr("transform", "rotate(-90 " + x + "," + y + ")")
                .attr("x", x).attr("y", y)
                .text(y1_label);
        }
    }

    if (this.layout.axes.y2.render && canRenderAxis("y2")){
        this.state.y2_axis  = d3.svg.axis().scale(this.state.y2_scale)
            .orient("left").tickValues(this.layout.axes.y2.ticks);
        this.svg.y2_axis
            .attr("transform", "translate(" + (this.layout.width - this.layout.margin.right) + "," + this.layout.margin.top + ")")
            .call(this.state.y2_axis);
        if (this.layout.axes.y2.label_function){
            this.layout.axes.y2.label = LocusZoom.Panel.LabelFunctions.get(this.layout.axes.y2.label_function, this.parent.state);
        }
        if (this.layout.axes.y2.label != null){
            var y2_label = this.layout.axes.y2.label;
            if (typeof this.layout.axes.y2.label == "function"){ y2_label = this.layout.axes.y2.label(); }
            var x = this.layout.margin.right * 0.55;
            var y = this.layout.cliparea.height / 2;
            this.svg.y2_axis_label
                .attr("transform", "rotate(-90 " + x + "," + y + ")")
                .attr("x", x).attr("y", y)
                .text(y2_label);
        }
    }
    
    // Render data layers in order defined in the layout
    this.layout.data_layers.forEach(function(data_layer){
        this.data_layers[data_layer.id].draw().prerender().render();
    }.bind(this));

    return this;
    
};

/****************
  Label Functions
  Singleton for defining axis label functions with respect to a panel's state
*/

LocusZoom.Panel.LabelFunctions = (function() {
    var obj = {};
    var functions = {
        "chromosome": function(state) {
            if (!isNaN(+state.chr)){ 
                return "Chromosome " + state.chr + " (Mb)";
            } else {
                return "Chromosome (Mb)";
            }
        }
    };

    obj.get = function(name, state) {
        if (!name) {
            return null;
        } else if (functions[name]) {
            if (typeof state == "undefined"){
                return functions[name];
            } else {
                return functions[name](state);
            }
        } else {
            throw("label function [" + name + "] not found");
        }
    };

    obj.set = function(name, fn) {
        if (fn) {
            functions[name] = fn;
        } else {
            delete functions[name];
        }
    };

    obj.add = function(name, fn) {
        if (functions.name) {
            throw("label function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();

