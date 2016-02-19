/* global LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Instance Class

  An instance is an independent LocusZoom object. Many instances can exist simultaneously
  on a single page, each having its own data caching, configuration, and state.

*/

LocusZoom.Instance = function(id, datasource, layout, state) {

    this.initialized = false;

    this.id = id;
    this.parent = LocusZoom;
    
    this.svg = null;

    // The _panels property stores child panel instances
    this._panels = {};
    this.remap_promises = [];
    
    // The state property stores any instance-wide parameters subject to change via user input
    this.state = state || {
        chr: 0,
        start: 0,
        end: 0
    };
    
    // The view property contains parameters that define the physical space of the entire LocusZoom object
    this.view = {
        width: 0,
        height: 0,
        min_width: 0,
        min_height: 0
    };

    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);
    
    return this;
  
};

// Set the view dimensions for this instance. If an SVG exists, update its dimensions
LocusZoom.Instance.prototype.setDimensions = function(width, height){
    if (!isNaN(width) && width >= 0){
        this.view.width = Math.max(Math.round(+width), this.view.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.view.height = Math.max(Math.round(+height), this.view.min_height);
    }
    if (this.svg != null){
        this.svg.attr("width", this.view.width).attr("height", this.view.height);
    }
    if (this.initialized){
        this.ui.render();
        this.stackPanels();
    }
    return this;
};

// Create a new panel by panel class
// Optionally take an id string (use base ID on panel class if not provided)
// Ensure panel has a unique ID as it is added.
LocusZoom.Instance.prototype.addPanel = function(PanelClass, id){
    if (typeof PanelClass !== "function"){
        throw "Invalid PanelClass passed to LocusZoom.Instance.prototype.addPanel()";
    }
    var panel = new PanelClass();
    panel.parent = this;
    if (typeof id !== "string"){
        panel.id = panel.base_id;
    } else {
        panel.base_id = id;
        panel.id = id;
    }
    if (typeof this._panels[panel.id] == "object"){
        var inc = 0;
        while (typeof this._panels[panel.base_id + "_" + inc] == "object"){
            inc++;
        }
        panel.id = panel.base_id + "_" + inc;
    }
    this._panels[panel.id] = panel;
    this.stackPanels();
    return this._panels[panel.id];
};

// Automatically position panels based on panel positioning rules and values
// Default behavior: position panels vertically with equally proportioned heights
// In all cases: bubble minimum panel dimensions up from panels to enforce minimum instance dimensions
LocusZoom.Instance.prototype.stackPanels = function(){

    // First set/enforce minimum instance dimensions based on current panels
    var panel_min_widths = [];
    var panel_min_heights = [];
    for (var id in this._panels){
        panel_min_widths.push(this._panels[id].view.min_width);
        panel_min_heights.push(this._panels[id].view.min_height);
    }
    this.view.min_width = Math.max.apply(null, panel_min_widths);
    this.view.min_height = panel_min_heights.reduce(function(a,b){ return a+b; });
    if (this.view.width < this.view.min_width || this.view.height < this.view.min_height){
        this.setDimensions(Math.max(this.view.width, this.view.min_width),
                           Math.max(this.view.height, this.view.min_height));
        return;
    }

    // Next set proportional and discrete heights of panels
    var proportional_height = 1 / Object.keys(this._panels).length;
    var discrete_height = this.view.height * proportional_height;
    var panel_idx = 0;
    for (var id in this._panels){
        this._panels[id].view.proportional_height = proportional_height;
        this._panels[id].setOrigin(0, panel_idx * discrete_height);
        this._panels[id].setDimensions(this.view.width, discrete_height);
        panel_idx++;
    }

};

// Create all instance-level objects, initialize all child panels
LocusZoom.Instance.prototype.initialize = function(){

    // Create an element/layer for containing mouse guides
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

    // Create an element/layer for containing various UI items
    var ui_svg = this.svg.append("g")
        .attr("class", "lz-ui").attr("id", this.id + ".ui")
        .style("display", "none");
    this.ui = {
        svg: ui_svg,
        parent: this,
        is_resize_dragging: false,
        show: function(){
            this.svg.style("display", null);
        },
        hide: function(){
            this.svg.style("display", "none");
        },
        initialize: function(){
            // Resize handle
            this.resize_handle = this.svg.append("g")
                .attr("id", this.parent.id + ".ui.resize_handle")
            this.resize_handle.append("path")
                .attr("class", "lz-ui-resize_handle")
                .attr("d", "M 0,16, L 16,0, L 16,16 Z");
            var resize_drag = d3.behavior.drag();
            //resize_drag.origin(function() { return this; });
            resize_drag.on("dragstart", function(){
                this.resize_handle.select("path").attr("class", "lz-ui-resize_handle_dragging");
                this.is_resize_dragging = true;
            }.bind(this));
            resize_drag.on("dragend", function(){
                this.resize_handle.select("path").attr("class", "lz-ui-resize_handle");
                this.is_resize_dragging = false;
            }.bind(this));
            resize_drag.on("drag", function(){
                this.setDimensions(this.view.width + d3.event.dx, this.view.height + d3.event.dy);
            }.bind(this.parent));
            this.resize_handle.call(resize_drag);
            // Render all UI elements
            this.render();
        },
        render: function(){
            this.resize_handle
                .attr("transform", "translate(" + (this.parent.view.width - 17) + ", " + (this.parent.view.height - 17) + ")");
        }
    };
    this.ui.initialize();

    // Create the curtain object with svg element and drop/raise methods
    var curtain_svg = this.svg.append("g")
        .attr("class", "lz-curtain").style("display", "none")
        .attr("id", this.id + ".curtain");
    this.curtain = {
        svg: curtain_svg,
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

    // Initialize all panels
    for (var id in this._panels){
        this._panels[id].initialize();
    }

    // Define instance/svg level mouse events
    this.svg.on("mouseover", function(){
        if (!this.ui.is_resize_dragging){
            this.ui.show();
        }
    }.bind(this));
    this.svg.on("mouseout", function(){
        if (!this.ui.is_resize_dragging){
            this.ui.hide();
        }
        this.mouse_guide.vertical.attr("x", -1);
        this.mouse_guide.horizontal.attr("y", -1);
    }.bind(this));
    this.svg.on("mousemove", function(){
        var coords = d3.mouse(this.svg.node());
        this.mouse_guide.vertical.attr("x", coords[0]);
        this.mouse_guide.horizontal.attr("y", coords[1]);
    }.bind(this));
    
    // Flip the "initialized" bit
    this.initialized = true;

    return this;

};

// Map an entire LocusZoom Instance to a new region
LocusZoom.Instance.prototype.mapTo = function(chr, start, end){

    // Apply new state values
    // TODO: preserve existing state until new state is completely loaded+rendered or aborted?
    this.state.chr   = +chr;
    this.state.start = +start;
    this.state.end   = +end;

    this.remap_promises = [];
    // Trigger reMap on each Panel Layer
    for (var id in this._panels){
        this.remap_promises.push(this._panels[id].reMap());
    }

    // When all finished update download SVG link
    Q.all(this.remap_promises).then(function(){
        this.controls.setBase64SVG();
    }.bind(this), function(error){
        console.log(error);
        this.curtain.drop(error);
    }.bind(this));

    return this;
    
};

// Refresh an instance's data from sources without changing position
LocusZoom.Instance.prototype.refresh = function(){
    this.mapTo(this.state.chr, this.state.start, this.state.end);
}

/******************
  Default Instance
  - During alpha development this class definition can serve as a functional draft of the API
  - The default instance should therefore have/do "one of everything" (however possible)
  - Ultimately the default instance should stand up the most commonly configured LZ use case
*/

LocusZoom.DefaultInstance = function(){

    LocusZoom.Instance.apply(this, arguments);

    this.setDimensions(700,700);
  
    this.addPanel(LocusZoom.PositionsPanel)
        .setMargin(20, 20, 35, 50);
    this._panels.positions.addDataLayer(LocusZoom.PositionsDataLayer).attachToYAxis(1);
    //this._panels.positions.addDataLayer(LocusZoom.RecombinationRateDataLayer).attachToYAxis(2);

    this.addPanel(LocusZoom.GenesPanel)
        .setMargin(20, 20, 20, 50);
    this._panels.genes.addDataLayer(LocusZoom.GenesDataLayer);
  
    return this;
  
};

LocusZoom.DefaultInstance.prototype = new LocusZoom.Instance();

