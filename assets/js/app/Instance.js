"use strict"

/**

  LocusZoom.Instance Class

  An instance is an independent LocusZoom object. Many instances can exist simultaneously
  on a single page, each having its own data caching, configuration, and state.

*/

// Initialize the Instance and its div container
LocusZoom.Instance = function(div_id) {

  this.id = div_id;

  this.defaults = {
    view: { width: 700, height: 600 },
    panels: [ "Positions", "Genes" ]
  }

  // Select the div, append an SVG element, store the selector for said SVG element
  this.svg = d3.select("div#" + div_id)
    .append("svg")
    .attr("id", div_id + "_svg")
    .attr("style", "background-color: #FFFFFF; cursor: move; border: 1px solid black;"); // hard-coded styles for dev only

  // The panels property stores child panel instances
  this.panels = {};

  // TODO: move into datalayers within panels!
  this.data = [];

  // The state property stores any instance-wide parameters subject to change via user input
  this.state = {
    chromosome: 0,
    position: { start: 0, stop: 0 }
  };

  // The view property contains parameters that define the physical space of the entire LocusZoom object
  this.view = {
    width: 0,
    height: 0,
  };

  // Method to set dimensions on the SVG DOM element
  this.setDimensions = function(width, height){
    if (typeof width === 'undefined') {
      this.view.width = this.defaults.view.width;
    } else {
      this.view.width = +width;
    }
    if (typeof height === 'undefined') {
      this.view.height = this.defaults.view.height;
    } else {
      this.view.height = +height;
    }
    this.svg.attr("width", this.view.width).attr("height", this.view.height);
    return this;
  };

  // Set default dimensions
  this.setDimensions();

  // Set default panels (needs to be toggled off somehow)
  for (var p in this.defaults.panels){
    this.addPanel(this.defaults.panels[p]).init();
  }

  return this;
}

// Initialize and store a new panel object
LocusZoom.Instance.prototype.addPanel = function(panel_name){
  var panel_class = panel_name + "Panel";
  if (typeof LocusZoom[panel_class] === "function"){
    var panel = new LocusZoom[panel_class];
    panel.setParent(this);
    this.panels[panel.id] = panel;
    return this.panels[panel.id];
  } else {
    console.log("Invalid panel name: " + panel_name);
  }
}

//////////////////////////////////////////////////////////

// Map an entire LocusZoom Instance (all Panels) to a new region
LocusZoom.Instance.prototype.mapTo = function(chromosome, new_start, new_stop){

  // TODO: data requests need to pushed down into data layers

  var promises = [];
  
  // Prepend region
  if (new_start < this.state.position.start){
    var prepend = { start: new_start, stop: Math.min(new_stop, this.state.position.start) };
    var lzd = new LZD();
    var prepend_promise = lzd.getData({start: prepend.start, stop: prepend.stop},
                                      ['id','position','pvalue','refAllele']);
    prepend_promise.then(function(new_data){
      this.data = new_data.body.concat(this.data);
    }.bind(this));
    promises.push(prepend_promise);
  }

  // Append region
  else if (new_stop > this.state.position.stop){
    var append = { start: Math.max(this.state.position.stop, new_start), stop: new_stop };
    var lzd = new LZD();
    var append_promise = lzd.getData({start: append.start, stop: append.stop},
                                     ['id','position','pvalue','refAllele']);
    append_promise.then(function(new_data){
      this.data = this.data.concat(new_data.body);
    }.bind(this));
    promises.push(append_promise);
  }

  // When all finished: update Instance state and render
  Promise.all(promises).then(function(){
    this.state.chromosome     = chromosome;
    this.state.position.start = new_start;
    this.state.position.stop  = new_stop;
    this.render();
  }.bind(this));
  
}

// Draw (or redraw) axes and data for all panels
LocusZoom.Instance.prototype.render = function(){

  for (var panel_id in this.panels){
    this.panels[panel_id].render();
  }
  
}
