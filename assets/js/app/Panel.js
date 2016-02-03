/* global LocusZoom,d3 */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Panel Class

  A panel is an abstract class representing a subdivision of the LocusZoom stage
  to display a distinct data representation

*/

LocusZoom.Panel = function() { 

    this.initialized = false;
    
    this.id     = null;
    this.parent = null;
    this.svg    = {};
    
    this.view = {
        width:  0,
        height: 0,
        min_width: 0,
        min_height: 0,
        proportional_width: 1,
        proportional_height: 1,
        origin: { x: 0, y: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        cliparea: {
            width: 0,
            height: 0,
            origin: { x: 0, y: 0 }
        }
    };

    this.state = {};
    
    this._data_layers = {};
    this.data_layer_ids_by_z_index = [];
    this.data_promises = [];

    this.axes = {
        x:  { render:        false,
              ticks:         [],
              label:         null },
        y1: { render:        false,
              data_layer_id: null,
              ticks:         [],
              label:         null },
        y2: { render:        false,
              data_layer_id: null,
              ticks:         [],
              label:         null }
    };

    this.xExtent  = null;
    this.y1Extent = null;
    this.y2Extent = null;
    
    this.renderData = function(){};

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    };
    
    return this;
    
};

LocusZoom.Panel.prototype.setDimensions = function(width, height){
    if (!isNaN(width) && width >= 0){
        this.view.width = Math.max(Math.round(+width), this.view.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.view.height = Math.max(Math.round(+height), this.view.min_height);
    }
    this.view.cliparea.width = this.view.width - (this.view.margin.left + this.view.margin.right);
    this.view.cliparea.height = this.view.height - (this.view.margin.top + this.view.margin.bottom);
    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setOrigin = function(x, y){
    if (!isNaN(x) && x >= 0){ this.view.origin.x = Math.min(Math.max(Math.round(+x), 0), this.parent.view.width); }
    if (!isNaN(y) && y >= 0){ this.view.origin.y = Math.min(Math.max(Math.round(+y), 0), this.parent.view.height); }
    if (this.initialized){ this.render(); }
    return this;
};

LocusZoom.Panel.prototype.setMargin = function(top, right, bottom, left){
    if (!isNaN(top)    && top    >= 0){ this.view.margin.top    = Math.max(Math.round(+top),    0); }
    if (!isNaN(right)  && right  >= 0){ this.view.margin.right  = Math.max(Math.round(+right),  0); }
    if (!isNaN(bottom) && bottom >= 0){ this.view.margin.bottom = Math.max(Math.round(+bottom), 0); }
    if (!isNaN(left)   && left   >= 0){ this.view.margin.left   = Math.max(Math.round(+left),   0); }
    if (this.view.margin.top + this.view.margin.bottom > this.view.height){
        var extra = Math.floor(((this.view.margin.top + this.view.margin.bottom) - this.view.height) / 2);
        this.view.margin.top -= extra;
        this.view.margin.bottom -= extra;
    }
    if (this.view.margin.left + this.view.margin.right > this.view.width){
        var extra = Math.floor(((this.view.margin.left + this.view.margin.right) - this.view.width) / 2);
        this.view.margin.left -= extra;
        this.view.margin.right -= extra;
    }
    this.view.cliparea.width = this.view.width - (this.view.margin.left + this.view.margin.right);
    this.view.cliparea.height = this.view.height - (this.view.margin.top + this.view.margin.bottom);
    this.view.cliparea.origin.x = this.view.margin.left;
    this.view.cliparea.origin.y = this.view.margin.top;
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
    if (this.axes.x.render){
        this.svg.x_axis_label = this.svg.x_axis.append("text")
            .attr("class", "lz-x lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y1_axis = this.svg.group.append("g").attr("class", "lz-y lz-y1 lz-axis");
    if (this.axes.y1.render){
        this.svg.y1_axis_label = this.svg.y1_axis.append("text")
            .attr("class", "lz-y1 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }
    this.svg.y2_axis = this.svg.group.append("g").attr("class", "lz-y lz-y2 lz-axis");
    if (this.axes.y2.render){
        this.svg.y2_axis_label = this.svg.y2_axis.append("text")
            .attr("class", "lz-y2 lz-axis lz-label")
            .attr("text-anchor", "middle");
    }

    // Initialize child Data Layers
    for (var id in this._data_layers){
        this._data_layers[id].initialize();
    }

    // Flip the "initialized" bit
    this.initialized = true;

    return this;
    
};


// Create a new data layer by data layer class
LocusZoom.Panel.prototype.addDataLayer = function(DataLayerClass){
    if (typeof DataLayerClass !== "function"){
        return false;
    }
    var data_layer = new DataLayerClass();
    data_layer.parent = this;
    this._data_layers[data_layer.id] = data_layer;
    this.data_layer_ids_by_z_index.push(data_layer.id);
    return this._data_layers[data_layer.id];
};


// Re-Map a panel to new positions according to the parent instance's state
LocusZoom.Panel.prototype.reMap = function(){
    this.data_promises = [];
    // Trigger reMap on each Data Layer
    for (var id in this._data_layers){
        this.data_promises.push(this._data_layers[id].reMap());
    }
    // When all finished trigger a render
    Q.all(this.data_promises).then(function(){
        this.render();
    }.bind(this), function(error){
        console.log(error);
        this.curtain.drop(error);
    }.bind(this));
    return this;
};


// Render a given panel
LocusZoom.Panel.prototype.render = function(){

    // Position the panel container
    this.svg.container.attr("transform", "translate(" + this.view.origin.x +  "," + this.view.origin.y + ")");

    // Set size on the clip rect
    this.svg.clipRect.attr("width", this.view.width).attr("height", this.view.height);

    // Generate extents and scales
    if (typeof this.xExtent == "function"){
        this.state.x_extent = this.xExtent();
        this.axes.x.ticks = LocusZoom.prettyTicks(this.state.x_extent, this.view.cliparea.width/120, true);
        this.state.x_scale = d3.scale.linear()
            .domain([this.state.x_extent[0], this.state.x_extent[1]])
            .range([0, this.view.cliparea.width]);
    }
    if (typeof this.y1Extent == "function"){
        this.state.y1_extent = this.y1Extent();
        this.axes.y1.ticks = LocusZoom.prettyTicks(this.state.y1_extent);
        this.state.y1_scale = d3.scale.linear()
            .domain([this.axes.y1.ticks[0], this.axes.y1.ticks[this.axes.y1.ticks.length-1]])
            .range([this.view.cliparea.height, 0]);
    }
    if (typeof this.y2Extent == "function"){
        this.state.y2_extent = this.y2Extent();
        this.axes.y2.ticks = LocusZoom.prettyTicks(this.state.y2_extent);
        this.state.y2_scale = d3.scale.linear()
            .domain([this.axes.y2.ticks[0], this.axes.y1.ticks[this.axes.y2.ticks.length-1]])
            .range([this.view.cliparea.height, 0]);
    }

    // Render axes and labels
    if (this.axes.x.render){
        this.state.x_axis = d3.svg.axis()
            .scale(this.state.x_scale)
            .orient("bottom").tickValues(this.axes.x.ticks)
            .tickFormat(function(d) { return LocusZoom.positionIntToString(d); });
        this.svg.x_axis
            .attr("transform", "translate(" + this.view.margin.left + "," + (this.view.height - this.view.margin.bottom) + ")")
            .call(this.state.x_axis);
        if (this.axes.x.label != null){
            
            var x_label = this.axes.x.label;
            if (typeof this.axes.x.label == "function"){ x_label = this.axes.x.label(); }
            this.svg.x_axis_label
                .attr("x", this.view.cliparea.width / 2)
                .attr("y", this.view.margin.bottom * 0.95)
                .text(x_label);
        }
    }

    if (this.axes.y1.render){
        this.state.y1_axis = d3.svg.axis().scale(this.state.y1_scale)
            .orient("left").tickValues(this.axes.y1.ticks);
        this.svg.y1_axis
            .attr("transform", "translate(" + this.view.margin.left + "," + this.view.margin.top + ")")
            .call(this.state.y1_axis);
        if (this.axes.y1.label != null){
            var y1_label = this.axes.y1.label;
            if (typeof this.axes.y1.label == "function"){ y1_label = this.axes.y1.label(); }
            var x = this.view.margin.left * -0.55;
            var y = this.view.cliparea.height / 2;
            this.svg.y1_axis_label
                .attr("transform", "rotate(-90 " + x + "," + y + ")")
                .attr("x", x).attr("y", y)
                .text(y1_label);
        }
    }

    if (this.axes.y2.render){
        this.state.y2_axis  = d3.svg.axis().scale(this.state.y2_scale)
            .orient("left").tickValues(this.axes.y2.ticks);
        this.svg.y2_axis
            .attr("transform", "translate(" + (this.view.width - this.view.margin.right) + "," + this.view.margin.top + ")")
            .call(this.state.y2_axis);
        if (this.axes.y2.label != null){
            var y2_label = this.axes.y2.label;
            if (typeof this.axes.y2.label == "function"){ y2_label = this.axes.y2.label(); }
            var x = this.view.margin.right * 0.55;
            var y = this.view.cliparea.height / 2;
            this.svg.y2_axis_label
                .attr("transform", "rotate(-90 " + x + "," + y + ")")
                .attr("x", x).attr("y", y)
                .text(y2_label);
        }
    }
    
    // Render data layers by z-index
    for (var z_index in this.data_layer_ids_by_z_index){
        if (this.data_layer_ids_by_z_index.hasOwnProperty(z_index)){
            this._data_layers[this.data_layer_ids_by_z_index[z_index]].draw().prerender().render();
        }
    }

    return this;
    
};


/*****************
  Positions Panel
*/

LocusZoom.PositionsPanel = function(){
  
    LocusZoom.Panel.apply(this, arguments);   

    this.id = "positions";
    this.view.min_width = 300;
    this.view.min_height = 200;

    this.axes.x.render = true;
    this.axes.x.label = function(){
        return "Chromosome " + this.parent.state.chr + " (Mb)";
    }.bind(this);

    this.axes.y1.render = true;
    this.axes.y1.label = "-log10 p-value";
    
    this.xExtent = function(){
        return d3.extent(this._data_layers.positions.data, function(d) { return +d.position; } );
    };
    
    this.y1Extent = function(){
        return d3.extent(this._data_layers.positions.data, function(d) { return +d.log10pval * 1.05; } );
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
    this.view.min_width = 300;
    this.view.min_height = 200;

    this.xExtent = function(){
        return d3.extent([this.parent.state.start, this.parent.state.end]);
    };
  
    return this;
};

LocusZoom.GenesPanel.prototype = new LocusZoom.Panel();
