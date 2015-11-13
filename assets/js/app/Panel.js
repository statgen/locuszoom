"use strict";

/**

  LocusZoom.Panel Class

  A panel is an abstract class representing a subdivision of the LocusZoom stage
  to display a distinct data representation

*/

LocusZoom.Panel = function() { 
    
    this.id     = null;
    this.parent = null;
    this.svg    = null;
    
    this.view = {
        width:  null,
        height: null,
        origin: { x: null, y: null },
        margin: { top: null, right: null, bottom: null, left: null },
        defaults: {
            width:  0,
            height: 0,
            origin: { x: 0, y: 0 },
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        }
    };

    this.state = {};
    
    this.data_layers = {};

    this.axes = {
        y1_data_layer_id: null,
        y2_data_layer_id: null
    };
    
    this.applyDefaults = function(){
        return null;
    };

    this.xExtent = function(){
        return null;
    };

    this.yExtent = function(){
        return null;
    };
    
    this.renderData = function(){};
    
    return this;
    
};

LocusZoom.Panel.prototype.setParent = function(parent){
    this.parent = parent;
    return this;
};

LocusZoom.Panel.prototype.setDimensions = function(width, height){
    if (typeof width === "undefined") { this.view.width = this.view.defaults.width; } else { this.view.width = +width; }
    if (typeof height === "undefined") { this.view.height = this.view.defaults.height; } else { this.view.height = +height; }
    return this;
};

LocusZoom.Panel.prototype.setOrigin = function(x, y){
    if (typeof x === "undefined") { this.view.origin.x = this.view.defaults.origin.x; } else { this.view.origin.x = +x; }
    if (typeof y === "undefined") { this.view.origin.y = this.view.defaults.origin.y; } else { this.view.origin.y = +y; }
    return this;
};

LocusZoom.Panel.prototype.setMargin = function(top, right, bottom, left){
    if (typeof top === "undefined")   { this.view.margin.top     = this.view.defaults.margin.top;    }
    else { this.view.margin.top = +top; }
    if (typeof right === "undefined") { this.view.margin.right   = this.view.defaults.margin.right;  }
    else { this.view.margin.right = +right; }
    if (typeof bottom === "undefined") { this.view.margin.bottom = this.view.defaults.margin.bottom; }
    else { this.view.margin.bottom = +bottom; }
    if (typeof left === "undefined")   { this.view.margin.left   = this.view.defaults.margin.left;   }
    else { this.view.margin.left = +left; }
    return this;
};

// Initialize a panel
LocusZoom.Panel.prototype.init = function(){
    
    // Ensure dimensions, origin, and margin are set
    if (this.view.width == null || this.view.height == null){ this.setDimensions(); }
    if (this.view.origin.x == null || this.view.origin.y == null){ this.setOrigin(); }
    if (this.view.margin.top == null || this.view.margin.right == null || this.view.margin.bottom == null || this.view.margin.left == null){ this.setMargin(); }
    
    // Append clip path to the SVG
    this.parent.svg.append("clipPath")
        .append("rect")
        .attr("id", this.id + "_clip")
        .attr("x", this.view.origin.x)
        .attr("y", this.view.origin.y)
        .attr("width", this.view.width)
        .attr("height", this.view.height);
    
    // Append svg group for rendering all panel elements, clipped by the clip path
    this.svg = this.parent.svg.append("g")
        .attr("id", this.id + "_panel")
        .attr("transform", "translate(" + this.view.origin.x +  "," + this.view.origin.y + ")")
        .attr("clip-path", "url(rect#" + this.id + "_clip)");
    
    // Initialize axes
    var display_width  = this.view.width - (this.view.margin.left + this.view.margin.right);
    var display_height = this.view.height - (this.view.margin.top + this.view.margin.bottom);
    this.state.x_scale = d3.scale.linear().domain([0,1]).range([0, display_width]);
    this.state.x_axis  = d3.svg.axis().scale(this.state.x_scale).orient("bottom");
    this.state.y_scale = d3.scale.linear().domain([0,1]).range([display_height, 0]).nice();
    this.state.y_axis  = d3.svg.axis().scale(this.state.y_scale).orient("left");
    
    // Append axes
    this.svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + this.view.margin.left + "," + this.view.margin.top + ")")
        .call(this.state.y_axis);
    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(" + this.view.margin.left + "," + (this.view.height - this.view.margin.bottom) + ")")
        .call(this.state.x_axis);
    
};

// Add a Data Layer to a Panel
// - data_layer (required): a DataLayer object
// - y_axis (optional): a number (1 or 2) specifying which y axis should represent the range of the data layer
// If no data layer is yet set to be the y1 axis then this data layer will be mapped to y1 by default
// (This can be overridden by adding a subsequent data layer and specifying y_axis = 1)
/*
LocusZoom.Panel.prototype.addDataLayer = function(data_layer, y_axis){
    this.data_layers[data_layer.id] = data_layer;
    if (y_axis === 1 || y_axis === 2){
        this.axes["y" + y_axis + "_data_layer_id"] = data_layer.id;
    } else if (this.axes.y1_data_layer_id == null){
        this.axes.y1_data_layer_id = data_layer.id;
    }
}
*/

// Create a new data layer by data layer class
// TODO: break out setting of y axis to a chainable function?
LocusZoom.Panel.prototype.addDataLayer = function(DataLayerClass, y_axis){
    if (typeof DataLayerClass !== "function"){
        return false
    }
    var data_layer = new DataLayerClass();
    this.data_layers[data_layer.id] = data_layer;
    if (y_axis === 1 || y_axis === 2){
        this.axes["y" + y_axis + "_data_layer_id"] = data_layer.id;
    } else if (this.axes.y1_data_layer_id == null){
        this.axes.y1_data_layer_id = data_layer.id;
    }
  return this.data_layers[data_layer.id];
};


// Re-Map a panel to new positions according to the parent instance's state
LocusZoom.Panel.prototype.reMap = function(){
    // ...
};

// Render a given panel
LocusZoom.Panel.prototype.render = function(){
    
    this.state.x_extent = this.xExtent();
    this.state.y_extent = this.yExtent();
    
    // Render axes
    var display_width  = this.view.width - (this.view.margin.left + this.view.margin.right);
    var display_height = this.view.height - (this.view.margin.top + this.view.margin.bottom);
    
    this.state.x_scale = d3.scale.linear()
        .domain([this.state.x_extent[0], this.state.x_extent[1]])
        .range([0, display_width]);
    this.state.x_axis = d3.svg.axis().scale(this.state.x_scale).orient("bottom")
        .tickValues(d3.range(this.state.x_extent[0], this.state.x_extent[1], (this.state.x_extent[1] - this.state.x_extent[0]) / 10));
    this.svg.selectAll("g .x.axis").call(this.state.x_axis);
    
    this.state.y_scale = d3.scale.linear()
        .domain([0, this.state.y_extent[1]])
        .range([display_height, 0]);
    this.state.y_axis  = d3.svg.axis().scale(this.state.y_scale).orient("left")
        .tickValues(d3.range(this.state.y_extent[0], this.state.y_extent[1], (this.state.y_extent[1] - this.state.y_extent[0]) / 4));
    this.svg.selectAll("g .y.axis").call(this.state.y_axis);
    
    // Render data
    this.renderData();
    
    // Set zoom
    /*
    this.view.zoom = d3.behavior.zoom()
        .scaleExtent([1, 1])
        .x(this.view.xscale)
        .on("zoom", function() {
            svg.select(".datum").attr("d", line)
            console.log("zooming");
        });
    this.svg.call(this.view.zoom);
    */
    
    // Set drag
    /*
    this.drag = d3.behavior.drag()
        .on("drag", function() {
            var stage = d3.select("#"+this.id+" g.stage");
            var transform = d3.transform(stage.attr("transform"));
            transform.translate[0] += d3.event.dx;
            stage.attr("transform", transform.toString());
        }).on("dragend", function() {
    // mapTo new values
    });
    this.svg.call(this.drag);
    */
    
};


/*****************
  Positions Panel
*/

LocusZoom.PositionsPanel = function(){
  
    LocusZoom.Panel.apply(this, arguments);   
    this.id = "positions";
    
    this.xExtent = function(){
        return d3.extent(this.parent.data, function(d) { return +d.position; } );
    };
    
    this.yExtent = function(){
        return d3.extent(this.parent.data, function(d) { return +d.log10pval; } );
    };
    
    this.renderData = function(){
        this.svg
            .selectAll("circle.datum")
            .data(this.parent.data)
            .enter().append("circle")
            .attr("class", "datum")
            .attr("id", function(d){ return d.id; })
            .attr("cx", function(d){ return this.view.margin.left + this.state.x_scale(d.position); }.bind(this))
            .attr("cy", function(d){ return this.view.margin.top + this.state.y_scale(d.log10pval); }.bind(this))
            .attr("fill", "red")
            .attr("stroke", "black")
            .attr("r", 4)
            .style({ cursor: "pointer" })
            .append("svg:title")
            .text(function(d) { return d.id; });

    };
    
    return this;
};

LocusZoom.PositionsPanel.prototype = new LocusZoom.Panel();


/*************
  Genes Panel
*/

LocusZoom.GenesPanel = function(){
    
    LocusZoom.Panel.apply(this, arguments);
    this.id = "genes";
  
    return this;
};

LocusZoom.GenesPanel.prototype = new LocusZoom.Panel();
