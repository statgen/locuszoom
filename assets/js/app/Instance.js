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
    .attr("style", "background-color: #FFFFFF; cursor: move; border: 1px solid black;"); // hard-coded styles for dev only

  // The panels property stores child panel instances
  this.panels = {};

  // The state property stores any instance-wide parameters subject to change via user input
  this.state = {
    position: { chromosome: 0, start: 0, stop: 0 }
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
    this.addPanel(this.defaults.panels[p]);
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