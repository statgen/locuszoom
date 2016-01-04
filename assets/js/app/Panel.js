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
    if (this.axes.x.render){
        this.state.x_scale = d3.scale.linear().domain([0,1]).range([0, this.view.cliparea.width]);
        this.state.x_axis  = d3.svg.axis().scale(this.state.x_scale).orient("bottom");
        this.svg.append("g")
            .attr("class", "lz-x lz-axis")
            .attr("transform", "translate(" + this.view.margin.left + "," + (this.view.height - this.view.margin.bottom) + ")")
            .call(this.state.x_axis);
    }
    if (this.axes.y1.render){
        this.state.y1_scale = d3.scale.linear().domain([0,1]).range([this.view.cliparea.height, 0]).nice();
        this.state.y1_axis  = d3.svg.axis().scale(this.state.y1_scale).orient("left");
        this.svg.append("g")
            .attr("class", "lz-y lz-y1 lz-axis")
            .attr("transform", "translate(" + this.view.margin.left + "," + this.view.margin.top + ")")
            .call(this.state.y1_axis);
    }
    if (this.axes.y2.render){
        this.state.y2_scale = d3.scale.linear().domain([0,1]).range([this.view.cliparea.height, 0]).nice();
        this.state.y2_axis  = d3.svg.axis().scale(this.state.y2_scale).orient("right");
        this.svg.append("g")
            .attr("class", "lz-y lz-y2 lz-axis")
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

    // Generate extents and scales.
    if (typeof this.xExtent == "function"){
        this.state.x_extent = this.xExtent();
        this.axes.x.ticks = LocusZoom.prettyTicks(this.state.x_extent, this.view.cliparea.width/120, true);
        this.state.x_scale = d3.scale.linear()
            .domain([this.state.x_extent[0], this.state.x_extent[1]])
            .range([0, this.view.cliparea.width]);
    }
    // Pad out y scales for pretty ticks, regardless of axis rendering
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
            .orient("bottom")
            .tickValues(this.axes.x.ticks)
            .tickFormat(function(d) { return LocusZoom.formatMegabase(d); });
        this.svg.selectAll("g .lz-x.lz-axis").call(this.state.x_axis);
        if (this.axes.x.label != null){
            var x_label = this.axes.x.label;
            if (typeof this.axes.x.label == "function"){
                x_label = this.axes.x.label();
            }
            if (this.svg.select("text.lz-x.lz-axis.lz-label")[0][0] == null){
                this.svg.select("g .lz-x.lz-axis").append("text")
                    .attr("class", "lz-x lz-axis lz-label")
                    .attr("text-anchor", "middle")
                    .attr("x", this.view.cliparea.width / 2)
                    .attr("y", 33);
            }
            this.svg.select("text.lz-x.lz-axis.lz-label").text(x_label);
        }
    }

    if (this.axes.y1.render){
        this.state.y1_axis = d3.svg.axis().scale(this.state.y1_scale)
            .orient("left").tickValues(this.axes.y1.ticks);
        this.svg.selectAll("g .lz-y.lz-y1.lz-axis").call(this.state.y1_axis);
        if (this.axes.y1.label != null){
            var y1_label = this.axes.y1.label;
            if (typeof this.axes.y1.label == "function"){
                y1_label = this.axes.y1.label();
            }
            if (this.svg.select("text.lz-y1.lz-axis.lz-label")[0][0] == null){
                this.svg.select("g .lz-y1.lz-axis").append("text")
                    .attr("class", "lz-y1 lz-axis lz-label")
                    .attr("text-anchor", "middle")
                    .attr("transform", "rotate(-90 " + -28 + "," + (this.view.cliparea.height / 2) + ")")
                    .attr("x", -28)
                    .attr("y", this.view.cliparea.height / 2);
            }
            this.svg.select("text.lz-y1.lz-axis.lz-label").text(y1_label);
        }
    }

    if (this.axes.y2.render){
        this.state.y2_axis  = d3.svg.axis().scale(this.state.y2_scale)
            .orient("left").tickValues(this.axes.y2.ticks);
        this.svg.selectAll("g .lz-y.lz-y2.lz-axis").call(this.state.y2_axis);
    }
    
    // Render data layers by z-index
    for (var z_index in this.data_layer_ids_by_z_index){
        this._data_layers[this.data_layer_ids_by_z_index[z_index]].prerender().render();
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

    this.xExtent = function(){
        return d3.extent([this.parent.state.start, this.parent.state.end]);
    };
  
    return this;
};

LocusZoom.GenesPanel.prototype = new LocusZoom.Panel();
