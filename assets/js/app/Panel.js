"use strict"

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
    defaults: {
      width:  0,
      height: 0,
      origin: { x: 0, y: 0 }
    }
  }

  this.state = {};

  this.data_layers = {};

  return this;

}

LocusZoom.Panel.prototype.setParent = function(parent){
  this.parent = parent;
  return this;
}

LocusZoom.Panel.prototype.setDimensions = function(width, height){
  if (typeof width === 'undefined') { this.view.width = this.view.defaults.width; } else { this.view.width = +width; }
  if (typeof height === 'undefined') { this.view.height = this.view.defaults.height; } else { this.view.height = +height; }
  return this;
}

LocusZoom.Panel.prototype.setOrigin = function(x, y){
  if (typeof x === 'undefined') { this.view.origin.x = this.view.defaults.origin.x; } else { this.view.origin.x = +x; }
  if (typeof y === 'undefined') { this.view.origin.y = this.view.defaults.origin.y; } else { this.view.origin.y = +y; }
  return this;
}

// Initialize a panel
LocusZoom.Panel.prototype.init = function(){

  // Ensure dimensions and origin are set
  if (this.view.width == null || this.view.height == null){ this.setDimensions(); }
  if (this.view.origin.x == null || this.view.origin.y == null){ this.setOrigin(); }

  // Append clip path to the SVG
  this.parent.svg.append("clipPath")
    .append("rect")
    .attr("id", this.id + "_clip")
    .attr("x", this.view.origin.x)
    .attr("y", this.view.origin.y)
    .attr("width", this.view.width)
    .attr("height", this.view.height);

  // Append svg group for rendering all panel elements, clipped by the clip path
  this.parent.svg.append("g")
    .attr("id", this.id + "_g")
    .attr("transform", "translate(" + this.view.origin.x +  "," + this.view.origin.y + ")")
    .attr("clip-path", "url(#" + this.id + "_clip)");

  // Store a selector for the group in the .svg property
  this.svg = d3.select("#" + this.id + "_g");

}



/**
  Positions Panel
*/

LocusZoom.PositionsPanel = function(){

  this.id = 'positions';

  this.view.defaults = {
    width:  700,
    height: 350,
    origin: { x: 0, y: 0 }
  }

  return this;
};

LocusZoom.PositionsPanel.prototype = new LocusZoom.Panel();


/**
  Genes Panel
*/

LocusZoom.GenesPanel = function(){

  this.id = 'genes';

  this.view.defaults = {
    width:  700,
    height: 250,
    origin: { x: 0, y: 350 }
  }

  return this;
};

LocusZoom.GenesPanel.prototype = new LocusZoom.Panel();
