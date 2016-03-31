/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Panel Class

  A panel is an abstract class representing a subdivision of the LocusZoom stage
  to display a distinct data representation

*/

LocusZoom.Panel = function(id, layout, state) { 

    this.initialized = false;
    
    this.id     = id;
    this.parent = null;
    this.svg    = {};

    // The layout is a serializable object used to describe the composition of the Panel
    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.Panel.DefaultLayout);

    // The state property stores any parameters subject to change via user input
    this.state = LocusZoom.mergeLayouts(state || {}, LocusZoom.Panel.DefaultState);
    
    this.data_layers = {};
    this.data_layer_ids_by_z_index = [];
    this.data_promises = [];

    this.xExtent  = null;
    this.y1Extent = null;
    this.y2Extent = null;

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };

    // Initialize the layout
    this.initializeLayout();
    
    return this;
    
};

LocusZoom.Panel.DefaultState = {
    data_layers: {}   
};

LocusZoom.Panel.DefaultLayout = {
    width:  0,
    height: 0,
    origin: { x: 0, y: 0 },
    min_width: 0,
    min_height: 0,
    proportional_width: 1,
    proportional_height: 1,
    proportional_origin: { x: 0, y: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    cliparea: {
        height: 0,
        width: 0,
        origin: { x: 0, y: 0 }
    },
    axes: {
        x:  {},
        y1: {},
        y2: {}
    }            
};

LocusZoom.Panel.prototype.initializeLayout = function(){

    // Set panel dimensions, origin, and margin
    this.setDimensions();
    this.setOrigin();
    this.setMargin();

    // Initialize panel axes
    ["x", "y1", "y2"].forEach(function(axis){
        if (JSON.stringify(this.layout.axes[axis]) == JSON.stringify({})){
            // The default layout sets the axis to an empty object, so set its render boolean here
            this.layout.axes[axis].render = false;
        } else {
            this.layout.axes[axis].render = true;
            this.layout.axes[axis].ticks = this.layout.axes[axis].ticks || [];
            this.layout.axes[axis].label = this.layout.axes[axis].label || null;
            this.layout.axes[axis].label_function = this.layout.axes[axis].label_function || null;
            this.layout.axes[axis].data_layer_id = this.layout.axes[axis].data_layer_id || null;
        }
    }.bind(this));

    // Add data layers (which define x and y extents)
    if (typeof this.layout.data_layers == "object"){
        var data_layer_id;
        for (data_layer_id in this.layout.data_layers){
            this.addDataLayer(data_layer_id, this.layout.data_layers[data_layer_id], this.state.data_layers[data_layer_id]);
        }
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
    this.layout.cliparea.width = this.layout.width - (this.layout.margin.left + this.layout.margin.right);
    this.layout.cliparea.height = this.layout.height - (this.layout.margin.top + this.layout.margin.bottom);
    this.layout.cliparea.origin.x = this.layout.margin.left;
    this.layout.cliparea.origin.y = this.layout.margin.top;

    //console.log(this.layout);

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
                try {
                    this.svg.select("text").selectAll("tspan").remove();
                    message.split("\n").forEach(function(line){
                        this.svg.select("text").append("tspan")
                            .attr("x", "1em").attr("dy", "1.5em").text(line);
                    }.bind(this));
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "2.5em")
                        .attr("class", "dismiss").text("Dismiss")
                        .on("click", function(){
                            this.raise();
                        }.bind(this));
                } catch (e){
                    console.warn("LocusZoom tried to render an error message but it's not a string:", message);
                }
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect").attr("width", "100%").attr("height", "100%");
    this.curtain.svg.append("text")
        .attr("id", this.getBaseId() + ".curtain_text")
        .attr("x", "1em").attr("y", "0em");

    // If the layout defines an inner border render it before rendering axes
    if (this.layout.inner_border){
        this.inner_border = this.svg.group.append("rect");
    }

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
LocusZoom.Panel.prototype.addDataLayer = function(id, layout, state){
    if (typeof id !== "string"){
        throw "Invalid data layer id passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof layout !== "object"){
        throw "Invalid data layer layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }
    if (typeof this.data_layers[layout.id] !== "undefined"){
        throw "Cannot create data layer with id [" + id + "]; data layer with that id already exists";
    }
    if (typeof layout.type !== "string"){
        throw "Invalid data layer type in layout passed to LocusZoom.Panel.prototype.addDataLayer()";
    }

    // Create the Data Layer and set its parent 
    var data_layer = LocusZoom.DataLayers.get(layout.type, id, layout, state);
    data_layer.parent = this;

    // Apply the Data Layer's state to the parent's state
    data_layer.parent.state.data_layers[data_layer.id] = data_layer.state;

    // Store the Data Layer on the Panel
    this.data_layers[data_layer.id] = data_layer;
    this.data_layer_ids_by_z_index.push(data_layer.id);

    // Generate xExtent function (defaults to the state range defined by "start" and "end")
    if (layout.x_axis){
        this.xExtent = this.data_layers[data_layer.id].getAxisExtent("x");
    } else {
        this.xExtent = function(){
            return d3.extent([this.parent.state.start, this.parent.state.end]);
        };
    }
    // Generate the yExtent function
    if (layout.y_axis){
        var y_axis_name = "y" + (layout.y_axis.axis == 1 || layout.y_axis.axis == 2 ? layout.y_axis.axis : 1);
        this[y_axis_name + "Extent"] = this.data_layers[data_layer.id].getAxisExtent("y");
        this.layout.axes[y_axis_name].data_layer_id = data_layer.id;
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
    return Q.all(this.data_promises)
        .then(function(){
            this.render();
        }.bind(this))
        .catch(function(error){
            console.log(error);
            this.curtain.drop(error);
        }.bind(this));
};


// Render a given panel
LocusZoom.Panel.prototype.render = function(){

    // Using the associated data layer axis layout declaration for floor, ceiling, upper, and lower buffer
    // determine the correct clip_range value to pass to prettyTicks (e.g. "low", "high", "both", or "neither")
    var clip_range = function(layout, axis){
        var clip_value = "neither";
        if (layout.axes[axis].data_layer_id){
            var axis_layout = layout.data_layers[layout.axes[axis].data_layer_id].y_axis;
            if (typeof axis_layout.floor == "number"){ clip_value = "low"; }
            if (typeof axis_layout.ceiling == "number"){ clip_value = "high"; }
            if (typeof axis_layout.floor == "number" && typeof axis_layout.ceiling == "number"){ clip_value = "both"; }
        }
        return clip_value;
    };

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
            .style({ "fill": "transparent",
                     "stroke-width": 1,
                     "stroke": this.layout.inner_border });
    }

    // Generate discrete extents and scales
    if (typeof this.xExtent == "function"){
        this.x_extent = this.xExtent();
        this.layout.axes.x.ticks = LocusZoom.prettyTicks(this.x_extent, "both", this.layout.cliparea.width/120);
        this.x_scale = d3.scale.linear()
            .domain([this.x_extent[0], this.x_extent[1]])
            .range([0, this.layout.cliparea.width]);
    }
    if (typeof this.y1Extent == "function"){
        this.y1_extent = this.y1Extent();
        this.layout.axes.y1.ticks = LocusZoom.prettyTicks(this.y1_extent, clip_range(this.layout, "y1"));
        this.y1_scale = d3.scale.linear()
            .domain([this.layout.axes.y1.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y1.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }
    if (typeof this.y2Extent == "function"){
        this.y2_extent = this.y2Extent();
        this.layout.axes.y2.ticks = LocusZoom.prettyTicks(this.y2_extent, clip_range(this.layout, "y2"));
        this.y2_scale = d3.scale.linear()
            .domain([this.layout.axes.y2.ticks[0], this.layout.axes.y1.ticks[this.layout.axes.y2.ticks.length-1]])
            .range([this.layout.cliparea.height, 0]);
    }

    // Render axes and labels
    var canRenderAxis = function(axis){
        return (typeof this[axis + "_scale"] == "function" && !isNaN(this[axis + "_scale"](0)));
    }.bind(this);
    
    if (this.layout.axes.x.render && canRenderAxis("x")){
        this.x_axis = d3.svg.axis()
            .scale(this.x_scale)
            .orient("bottom").tickValues(this.layout.axes.x.ticks)
            .tickFormat(function(d) { return LocusZoom.positionIntToString(d); });
        this.svg.x_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + (this.layout.height - this.layout.margin.bottom) + ")")
            .call(this.x_axis);
        if (this.layout.axes.x.label_function){
            this.layout.axes.x.label = LocusZoom.LabelFunctions.get(this.layout.axes.x.label_function, this.parent.state);
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
        this.y1_axis = d3.svg.axis().scale(this.y1_scale)
            .orient("left").tickValues(this.layout.axes.y1.ticks);
        this.svg.y1_axis
            .attr("transform", "translate(" + this.layout.margin.left + "," + this.layout.margin.top + ")")
            .call(this.y1_axis);
        if (this.layout.axes.y1.label_function){
            this.layout.axes.y1.label = LocusZoom.LabelFunctions.get(this.layout.axes.y1.label_function, this.parent.state);
        }
        if (this.layout.axes.y1.label != null){
            var y1_label = this.layout.axes.y1.label;
            if (typeof this.layout.axes.y1.label == "function"){ y1_label = this.layout.axes.y1.label(); }
            var y1_label_x = this.layout.margin.left * -0.55;
            var y1_label_y = this.layout.cliparea.height / 2;
            this.svg.y1_axis_label
                .attr("transform", "rotate(-90 " + y1_label_x + "," + y1_label_y + ")")
                .attr("x", y1_label_x).attr("y", y1_label_y)
                .text(y1_label);
        }
    }

    if (this.layout.axes.y2.render && canRenderAxis("y2")){
        this.y2_axis  = d3.svg.axis().scale(this.y2_scale)
            .orient("left").tickValues(this.layout.axes.y2.ticks);
        this.svg.y2_axis
            .attr("transform", "translate(" + (this.layout.width - this.layout.margin.right) + "," + this.layout.margin.top + ")")
            .call(this.y2_axis);
        if (this.layout.axes.y2.label_function){
            this.layout.axes.y2.label = LocusZoom.LabelFunctions.get(this.layout.axes.y2.label_function, this.parent.state);
        }
        if (this.layout.axes.y2.label != null){
            var y2_label = this.layout.axes.y2.label;
            if (typeof this.layout.axes.y2.label == "function"){ y2_label = this.layout.axes.y2.label(); }
            var y2_label_x = this.layout.margin.right * 0.55;
            var y2_label_y = this.layout.cliparea.height / 2;
            this.svg.y2_axis_label
                .attr("transform", "rotate(-90 " + y2_label_x + "," + y2_label_y + ")")
                .attr("x", y2_label_x).attr("y", y2_label_y)
                .text(y2_label);
        }
    }

    // Render data layers in order by z-index
    this.data_layer_ids_by_z_index.forEach(function(data_layer_id){
        this.data_layers[data_layer_id].draw().render();
    }.bind(this));

    return this;
    
};
