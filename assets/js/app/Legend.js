/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Legend

  A legend is an SVG object used to display contextual information about a panel.
  Panel layouts determine basic features of a legend - its position in the panel,
  its orientation, title, etc. Layouts of child data layers of the panel determine
  a legend's actual content.

*/

LocusZoom.Legend = function(parent){

    // parent must be a locuszoom panel
    if (!parent instanceof LocusZoom.Panel){
        throw "Unable to create legend, parent must be a locuszoom panel";
    }
    this.parent = parent;
    this.id = this.parent.getBaseId() + ".legend";

    this.parent.layout.legend = LocusZoom.Layouts.merge(this.parent.layout.legend || {}, LocusZoom.Legend.DefaultLayout);
    this.layout = this.parent.layout.legend;

    this.selector = null;
    this.background_rect = null;
    this.elements = [];
    this.hidden = false;

    return this.render();

};

LocusZoom.Legend.DefaultLayout = {
    orientation: "vertical",
    origin: { x: 0, y: 0 },
    padding: 5,
    label_size: 12,
    hidden: false
};

LocusZoom.Legend.prototype.render = function(){

    // Get a legend group selector if not yet defined
    if (!this.selector){
        this.selector = this.parent.svg.group.append("g")
            .attr("id", this.parent.getBaseId() + ".legend").attr("class", "lz-legend");
    }

    // Get a legend background rect selector if not yet defined
    if (!this.background_rect){
        this.background_rect = this.selector.append("rect")
            .attr("width", 100).attr("height", 100).attr("class", "lz-legend-background");
    }

    // Get a legend elements group selector if not yet defined
    if (!this.elements_group){
        this.elements_group = this.selector.append("g");
    }

    // Remove all elements
    this.elements.forEach(function(element){
        element.remove();
    });
    this.elements = [];

    // Gather all elements from data layers in order (top to bottom) and render them
    var padding = +this.layout.padding || 1;
    var x = padding;
    var y = padding;
    var line_height = 0;
    this.parent.data_layer_ids_by_z_index.slice().reverse().forEach(function(id){
        if (Array.isArray(this.parent.data_layers[id].layout.legend)){
            this.parent.data_layers[id].layout.legend.forEach(function(element){
                var selector = this.elements_group.append("g")
                    .attr("transform", "translate(" + x + "," + y + ")");
                var label_size = +element.label_size || +this.layout.label_size || 12;
                var label_x = 0;
                var label_y = (label_size/2) + (padding/2);
                line_height = Math.max(line_height, label_size + padding);
                // Draw the legend element symbol (line, rect, shape, etc)
                if (element.shape == "line"){
                    // Line symbol
                    var length = +element.length || 16;
                    var path_y = (label_size/4) + (padding/2);
                    selector.append("path").attr("class", element.class || "")
                        .attr("d", "M0," + path_y + "L" + length + "," + path_y)
                        .style(element.style || {});
                    label_x = length + padding;
                } else if (element.shape == "rect"){
                    // Rect symbol
                    var width = +element.width || 16;
                    var height = +element.height || width;
                    selector.append("rect").attr("class", element.class || "")
                        .attr("width", width).attr("height", height)
                        .attr("fill", element.color || {})
                        .style(element.style || {});
                    label_x = width + padding;
                    line_height = Math.max(line_height, height + padding);
                } else if (d3.svg.symbolTypes.indexOf(element.shape) != -1) {
                    // Shape symbol (circle, diamond, etc.)
                    var size = +element.size || 40;
                    var radius = Math.ceil(Math.sqrt(size/Math.PI));
                    selector.append("path").attr("class", element.class || "")
                        .attr("d", d3.svg.symbol().size(size).type(element.shape))
                        .attr("transform", "translate(" + radius + "," + (radius+(padding/2)) + ")")
                        .attr("fill", element.color || {})
                        .style(element.style || {});
                    label_x = (2*radius) + padding;
                    label_y = Math.max((2*radius)+(padding/2), label_y);
                    line_height = Math.max(line_height, (2*radius) + padding);
                }
                // Draw the legend element label
                selector.append("text").attr("text-anchor", "left").attr("class", "lz-label")
                    .attr("x", label_x).attr("y", label_y).style({"font-size": label_size}).text(element.label);
                // Position the legend element group based on legend layout orientation
                var bcr = selector.node().getBoundingClientRect();
                if (this.layout.orientation == "vertical"){
                    y += bcr.height + padding;
                    line_height = 0;
                } else {
                    // Ensure this element does not exceed the panel width (drop to the next line if it does)
                    var right_x = this.layout.origin.x + x + bcr.width;
                    if (right_x > this.parent.layout.width){
                        y += line_height;
                        x = padding;
                        selector.attr("transform", "translate(" + x + "," + y + ")");
                    }
                    x += bcr.width + (3*padding);
                }
                // Store the element
                this.elements.push(selector);
            }.bind(this));
        }
    }.bind(this));

    // Scale the background rect to the elements in the legend
    var bcr = this.elements_group.node().getBoundingClientRect();
    this.background_rect
        .attr("width", bcr.width + (2*this.layout.padding))
        .attr("height", bcr.height + (2*this.layout.padding));

    // Set the visibility on the legend from the "hidden" flag
    this.selector.style({ visibility: this.layout.hidden ? "hidden" : "visible" });
    
    return this.position();
    
};

LocusZoom.Legend.prototype.position = function(){
    if (!this.selector){ return this; }
    this.selector.attr("transform", "translate(" + this.layout.origin.x + "," + this.layout.origin.y + ")");
};
