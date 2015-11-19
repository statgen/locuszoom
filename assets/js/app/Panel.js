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
        width:  0,
        height: 0,
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
        render_x: false,
        render_y1: false,
        render_y2: false,
        y1_data_layer_id: null,
        y2_data_layer_id: null
    };

    this.xExtent = function(){
        return null;
    };

    this.y1Extent = function(){
        return null;
    };

    this.y2Extent = function(){
        return null;
    };
    
    this.renderData = function(){};

    this.getBaseId = function(){
        return this.parent.id + "." + this.id;
    }
    
    return this;
    
};

LocusZoom.Panel.prototype.setDimensions = function(width, height){
    if (typeof width  !== "undefined"){ this.view.width  = +width;  }
    if (typeof height !== "undefined"){ this.view.height = +height; }
    this.view.cliparea.width = this.view.width - (this.view.margin.left + this.view.margin.right);
    this.view.cliparea.height = this.view.height - (this.view.margin.top + this.view.margin.bottom);
    return this;
};

LocusZoom.Panel.prototype.setOrigin = function(x, y){
    if (typeof x !== "undefined"){ this.view.origin.x = +x; }
    if (typeof y !== "undefined"){ this.view.origin.y = +y; }
    return this;
};

LocusZoom.Panel.prototype.setMargin = function(top, right, bottom, left){
    if (typeof top    !== "undefined"){ this.view.margin.top    = +top;    }
    if (typeof right  !== "undefined"){ this.view.margin.right  = +right;  }
    if (typeof bottom !== "undefined"){ this.view.margin.bottom = +bottom; }
    if (typeof left   !== "undefined"){ this.view.margin.left   = +left;   }
    this.view.cliparea.width = this.view.width - (this.view.margin.left + this.view.margin.right);
    this.view.cliparea.height = this.view.height - (this.view.margin.top + this.view.margin.bottom);
    this.view.cliparea.origin.x = this.view.margin.left;
    this.view.cliparea.origin.y = this.view.margin.top;
    return this;
};

// Initialize a panel
LocusZoom.Panel.prototype.initialize = function(){

    // Append a container group element to house the main panel group element and the clip path
    var container = this.parent.svg.append("g")
        .attr("id", this.getBaseId() + ".panel_container")
        .attr("transform", "translate(" + this.view.origin.x +  "," + this.view.origin.y + ")");
        
    // Append clip path to the parent svg element
    container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip")
        .append("rect")
        .attr("width", this.view.width)
        .attr("height", this.view.height);
    
    // Append svg group for rendering all panel child elements, clipped by the clip path
    this.svg = container.append("g")
        .attr("id", this.getBaseId() + ".panel")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Initialize child Data Layers
    for (var id in this._data_layers){
        this._data_layers[id].initialize();
    }

    // Initialize Axes
    if (this.axes.render_x){
        this.state.x_scale = d3.scale.linear().domain([0,1]).range([0, this.view.cliparea.width]);
        this.state.x_axis  = d3.svg.axis().scale(this.state.x_scale).orient("bottom");
        this.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(" + this.view.margin.left + "," + (this.view.height - this.view.margin.bottom) + ")")
            .call(this.state.x_axis);
    }
    if (this.axes.render_y1){
        this.state.y1_scale = d3.scale.linear().domain([0,1]).range([this.view.cliparea.height, 0]).nice();
        this.state.y1_axis  = d3.svg.axis().scale(this.state.y1_scale).orient("left");
        this.svg.append("g")
            .attr("class", "y y1 axis")
            .attr("transform", "translate(" + this.view.margin.left + "," + this.view.margin.top + ")")
            .call(this.state.y1_axis);
    }
    if (this.axes.render_y2){
        this.state.y2_scale = d3.scale.linear().domain([0,1]).range([this.view.cliparea.height, 0]).nice();
        this.state.y2_axis  = d3.svg.axis().scale(this.state.y2_scale).orient("right");
        this.svg.append("g")
            .attr("class", "y y2 axis")
            .attr("transform", "translate(" + (this.view.width - this.view.margin.right) + "," + this.view.margin.top + ")")
            .call(this.state.y2_axis);
    }

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
    Promise.all(this.data_promises).then(function(){
        this.render();
    }.bind(this));
    return this;
};


// Render a given panel
LocusZoom.Panel.prototype.render = function(){
    
    // Render axes  
    if (this.axes.render_x){
        this.state.x_extent = this.xExtent();
        this.state.x_scale = d3.scale.linear()
            .domain([this.state.x_extent[0], this.state.x_extent[1]])
            .range([0, this.view.cliparea.width]);
        this.state.x_axis = d3.svg.axis().scale(this.state.x_scale).orient("bottom")
            .tickValues(d3.range(this.state.x_extent[0], this.state.x_extent[1], (this.state.x_extent[1] - this.state.x_extent[0]) / 10))
            .tickFormat(function(d) { return LocusZoom.formatPosition(d); });
        this.svg.selectAll("g .x.axis").call(this.state.x_axis);
    }
    if (this.axes.render_y1){
        this.state.y1_extent = this.y1Extent();
        this.state.y1_scale = d3.scale.linear()
            .domain([0, this.state.y1_extent[1]])
            .range([this.view.cliparea.height, 0]);
        this.state.y1_axis  = d3.svg.axis().scale(this.state.y1_scale).orient("left")
            .tickValues(d3.range(this.state.y1_extent[0], this.state.y1_extent[1], (this.state.y1_extent[1] - this.state.y1_extent[0]) / 4));
        this.svg.selectAll("g .y.y1.axis").call(this.state.y1_axis);
    }
    if (this.axes.render_y2){
        this.state.y2_extent = this.y2Extent();
        this.state.y2_scale = d3.scale.linear()
            .domain([0, this.state.y2_extent[1]])
            .range([this.view.cliparea.height, 0]);
        this.state.y2_axis  = d3.svg.axis().scale(this.state.y2_scale).orient("left")
            .tickValues(d3.range(this.state.y2_extent[0], this.state.y2_extent[1], (this.state.y2_extent[1] - this.state.y2_extent[0]) / 4));
        this.svg.selectAll("g .y.y2.axis").call(this.state.y2_axis);
    }
    
    // Render data layers by z-index
    for (var z_index in this.data_layer_ids_by_z_index){
        this._data_layers[this.data_layer_ids_by_z_index[z_index]].render();
    }

    return this;
    
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

    this.axes.render_x = true;
    this.axes.render_y1 = true;
    //this.axes.render_y2 = true;
    
    this.xExtent = function(){
        return d3.extent(this._data_layers.positions.data, function(d) { return +d.position; } );
    };
    
    this.y1Extent = function(){
        return d3.extent(this._data_layers.positions.data, function(d) { return +d.log10pval * 1.05; } );
    };

    /*
    this.y2Extent = function(){
        return d3.extent(this._data_layers.ld.data, function(d) { return +d.foo; } );
    };
    */
    
    return this;
};

LocusZoom.PositionsPanel.prototype = new LocusZoom.Panel();


/*************
  Genes Panel
*/

LocusZoom.GenesPanel = function(){
    
    LocusZoom.Panel.apply(this, arguments);
    this.id = "genes";

    this.axes.render_x = true;

    this.xExtent = function(){
        return d3.extent([this.parent.state.start, this.parent.state.end]);
    };
  
    return this;
};

LocusZoom.GenesPanel.prototype = new LocusZoom.Panel();
