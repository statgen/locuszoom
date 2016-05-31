/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Data Layer Class

  A data layer is an abstract class representing a data set and its
  graphical representation within a panel

*/

LocusZoom.DataLayer = function(id, layout, parent) {

    this.initialized = false;

    this.id     = id;
    this.parent = parent || null;
    this.svg    = {};

    this.layout = LocusZoom.mergeLayouts(layout || {}, LocusZoom.DataLayer.DefaultLayout);

    // Define state parameters specific to this data layer
    if (this.parent){
        this.state = this.parent.state;
        this.state_id = this.parent.id + "." + this.id;
        this.state[this.state_id] = this.state[this.state_id] || {};
        if (this.layout.selectable){
            this.state[this.state_id].selected = this.state[this.state_id].selected || [];
        }
    } else {
        this.state = {};
        this.state_id = null;
    }

    this.data = [];

    this.getBaseId = function(){
        return this.parent.parent.id + "." + this.parent.id + "." + this.id;
    };

    this.onUpdate = function(){
        this.parent.onUpdate();
    };

    // Tooltip methods
    this.tooltips = {};
    this.createTooltip = function(d, id){
        if (typeof this.layout.tooltip != "object"){
            throw ("DataLayer [" + this.id + "] layout does not define a tooltip");
        }
        if (typeof id != "string"){
            throw ("Unable to create tooltip: id is not a string");
        }
        if (this.tooltips[id]){
            this.positionTooltip(id);
            return;
        }
        this.tooltips[id] = {
            data: d,
            arrow: null,
            closed: false,
            selector: d3.select(this.parent.parent.svg.node().parentNode).append("div")
                .attr("class", "lz-data_layer-tooltip")
                .attr("id", this.getBaseId() + ".tooltip." + id)
        };
        this.updateTooltip(d, id);
    };
    this.updateTooltip = function(d, id){
        // Empty the tooltip of all HTML (including its arrow!)
        this.tooltips[id].selector.html("");
        this.tooltips[id].arrow = null;
        // Set the new HTML
        if (this.layout.tooltip.html){
            this.tooltips[id].selector.html(LocusZoom.parseFields(d, this.layout.tooltip.html));
        }
        // If the layout allows tool tips on this data layer to be closable then add the close button
        // and add padding to the tooltip to accomodate it
        if (this.layout.tooltip.closable){
            this.tooltips[id].selector.style("padding-right", "24px");
            this.tooltips[id].selector.append("a")
                .attr("class", "lz-tooltip-close-button")
                .attr("title", "Close")
                .html("×")
                .on("click", function(){
                    this.closeTooltip(id);
                }.bind(this));
        }
        // Reposition and draw a new arrow
        this.positionTooltip(id);
    };
    // Close tool tip - hide the tool tip element and flag it as closed, but don't destroy it
    this.closeTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to close tooltip: id is not a string");
        }
        if (this.tooltips[id]){
            if (typeof this.tooltips[id].selector == "object"){
                this.tooltips[id].selector.style("display", "none");
            }
            this.tooltips[id].closed = true;
        }
    };
    // Unclose tool tip - reveal and position a previously closed tool tip (rather than creating it anew)
    this.uncloseTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to unclose tooltip: id is not a string");
        }
        if (this.tooltips[id] && this.tooltips[id].closed){
            if (typeof this.tooltips[id].selector == "object"){
                this.tooltips[id].selector.style("display", null);
            }
            this.positionTooltip(id);
            this.tooltips[id].closed = false;
        }
    };
    // Destroy tool tip - remove the tool tip element from the DOM and delete the tool tip's record on the data layer
    this.destroyTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to destroy tooltip: id is not a string");
        }
        if (this.tooltips[id]){
            if (typeof this.tooltips[id].selector == "object"){
                this.tooltips[id].selector.remove();
            }
            delete this.tooltips[id];
        }
    };
    this.destroyAllTooltips = function(){
        var id;
        for (id in this.tooltips){
            this.destroyTooltip(id);
        }
    };
    // Position tool tip - naive function to place a tool tip to the lower right of the current mouse element
    // Most data layers reimplement this method to position tool tips specifically for the data they display
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        // Position the div itself
        this.tooltips[id].selector
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY) + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!this.tooltips[id].arrow){
            this.tooltips[id].arrow = this.tooltips[id].selector.append("div")
                .style("position", "absolute")
                .attr("class", "lz-data_layer-tooltip-arrow_top_left");
        }
        this.tooltips[id].arrow
            .style("left", "-1px")
            .style("top", "-1px");
    };
    this.positionAllTooltips = function(){
        var id;
        for (id in this.tooltips){
            this.positionTooltip(id);
        }
    };

    // Standard approach to applying unit-based selectability and general tooltip behavior (one and/or multiple)
    // on a selection of data elements
    this.enableTooltips = function(selection){
        
        if (typeof selection != "object"){ return; }
        if (!this.layout.id_field){
            console.warn("Data layer " + this.id + " tried to enable tooltips but does not have a valid id_field defined in the layout");
            return;
        }
        
        // Enable mouseover/mouseout tooltip show/hide behavior
        selection.on("mouseover", function(d){
            var id = this.parent.id + "_" + d[this.layout.id_field].replace(/\W/g,"");
            var select_id = id;
            var attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-hovered";
            if (this.layout.hover_element){
                select_id += "_" + this.layout.hover_element;
                attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + "-hovered";
            }
            if (this.state[this.state_id].selected.indexOf(id) == -1){
                d3.select("#" + select_id).attr("class", attr_class);
                if (this.layout.tooltip){ this.createTooltip(d, id); }
            }
        }.bind(this))
        .on("mouseout", function(d){
            var id = this.parent.id + "_" + d[this.layout.id_field].replace(/\W/g,"");
            var select_id = id;
            var attr_class = "lz-data_layer-" + this.layout.type;
            if (this.layout.hover_element){
                select_id += "_" + this.layout.hover_element;
                attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element;
            }
            if (this.state[this.state_id].selected.indexOf(id) == -1){
                d3.select("#" + select_id).attr("class", attr_class);
                if (this.layout.tooltip){ this.destroyTooltip(id); }
            }
        }.bind(this));
        
        if (this.layout.selectable){
            
            // Enable selectability
            selection.on("click", function(d){
                var id = this.parent.id + "_" + d[this.layout.id_field].replace(/\W/g,"");
                var selected_idx = this.state[this.state_id].selected.indexOf(id);
                // If this element IS currently selected...
                if (selected_idx != -1){
                    // If in selectable:multiple mode and this tooltip was closed then unclose it and be done
                    if (this.layout.selectable == "multiple" && this.tooltips[id] && this.tooltips[id].closed){
                        this.uncloseTooltip(id);
                    // Otherwise unselect the element but leave the tool tip in place (to be destroyed on mouse out)
                    } else {
                        this.state[this.state_id].selected.splice(selected_idx, 1);
                        var select_id = id;
                        var attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-hovered";
                        if (this.layout.hover_element){
                            select_id += "_" + this.layout.hover_element;
                            attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + "-hovered";
                        }
                        d3.select("#" + select_id).attr("class", attr_class);
                    }

                // If this element IS NOT currently selected...
                } else {
                    // If in selectable:one mode then deselect any current selection
                    if (this.layout.selectable == "one" && this.state[this.state_id].selected.length){
                        this.destroyTooltip(this.state[this.state_id].selected[0]);
                        var select_id = this.state[this.state_id].selected[0];
                        var attr_class = "lz-data_layer-" + this.layout.type;
                        if (this.layout.hover_element){
                            select_id += "_" + this.layout.hover_element;
                            attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element;
                        }
                        d3.select("#" + select_id).attr("class", attr_class);
                        this.state[this.state_id].selected = [];
                    }
                    // Select the clicked element    
                    this.state[this.state_id].selected.push(id);
                    var select_id = id;
                    var attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-selected";
                    if (this.layout.hover_element){
                        select_id += "_" + this.layout.hover_element;
                        attr_class = "lz-data_layer-" + this.layout.type + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + " lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + "-selected";
                    }
                    d3.select("#" + select_id).attr("class", attr_class);
                }
                this.onUpdate();
            }.bind(this));

            // Apply existing elements from state
            if (Array.isArray(this.state[this.state_id].selected) && this.state[this.state_id].selected.length){
                this.state[this.state_id].selected.forEach(function(selected_id, idx){
                    if (d3.select("#" + selected_id).empty()){
                        console.warn("State elements for " + this.state_id + " contains an ID that is not or is no longer present on the plot: " + selected_id);
                        this.state[this.state_id].selected.splice(idx, 1);
                    } else {
                        if (this.tooltips[selected_id] && !this.tooltips[selected_id].closed){
                            this.positionTooltip(selected_id);
                        } else {
                            this.state[this.state_id].selected.splice(idx, 1);
                            var d = d3.select("#" + selected_id).datum();
                            d3.select("#" + selected_id).on("mouseover")(d);
                            d3.select("#" + selected_id).on("click")(d);
                        }
                    }
                }.bind(this));
            }
            
        }
    };

    // Get an object with the x and y coordinates of the panel's origin in terms of the entire page
    // Necessary for positioning any HTML elements over the panel
    this.getPageOrigin = function(){
        var panel_origin = this.parent.getPageOrigin();
        return {
            x: panel_origin.x + this.parent.layout.margin.left,
            y: panel_origin.y + this.parent.layout.margin.top
        };
    };
    
    return this;

};

LocusZoom.DataLayer.DefaultLayout = {
    type: "",
    fields: [],
    x_axis: {},
    y_axis: {}
};

// Resolve a scalable parameter for an element into a single value based on its layout and the element's data
LocusZoom.DataLayer.prototype.resolveScalableParameter = function(layout, data){
    var ret = null;
    if (Array.isArray(layout)){
        var idx = 0;
        while (ret == null && idx < layout.length){
            ret = this.resolveScalableParameter(layout[idx], data);
            idx++;
        }
    } else {
        switch (typeof layout){
        case "number":
        case "string":
            ret = layout;
            break;
        case "object":
            if (layout.scale_function && layout.field) {
                ret = LocusZoom.ScaleFunctions.get(layout.scale_function, layout.parameters || {}, data[layout.field]);
            }
            break;
        }
    }
    return ret;
};

// Generate dimension extent function based on layout parameters
LocusZoom.DataLayer.prototype.getAxisExtent = function(dimension){

    if (["x", "y"].indexOf(dimension) == -1){
        throw("Invalid dimension identifier passed to LocusZoom.DataLayer.getAxisExtent()");
    }

    var axis = dimension + "_axis";

    // If a floor AND a ceiling are explicitly defined then jsut return that extent and be done
    if (!isNaN(this.layout[axis].floor) && !isNaN(this.layout[axis].ceiling)){
        return [+this.layout[axis].floor, +this.layout[axis].ceiling];
    }

    // If a field is defined for the axis and the data layer has data then generate the extent from the data set
    if (this.layout[axis].field && this.data && this.data.length){

        var extent = d3.extent(this.data, function(d) {
            return +d[this.layout[axis].field];
        }.bind(this));

        // Apply upper/lower buffers, if applicable
        var original_extent_span = extent[1] - extent[0];
        if (!isNaN(this.layout[axis].lower_buffer)){ extent.push(extent[0] - (original_extent_span * this.layout[axis].lower_buffer)); }
        if (!isNaN(this.layout[axis].upper_buffer)){ extent.push(extent[1] + (original_extent_span * this.layout[axis].upper_buffer)); }

        // Apply minimum extent
        if (typeof this.layout[axis].min_extent == "object" && !isNaN(this.layout[axis].min_extent[0]) && !isNaN(this.layout[axis].min_extent[1])){
            extent.push(this.layout[axis].min_extent[0], this.layout[axis].min_extent[1]);
        }

        // Generate a new base extent
        extent = d3.extent(extent);
        
        // Apply floor/ceiling, if applicable
        if (!isNaN(this.layout[axis].floor)){ extent[0] = this.layout[axis].floor; }
        if (!isNaN(this.layout[axis].ceiling)){ extent[1] = this.layout[axis].ceiling; }

        return extent;

    }

    // If this is for the x axis and no extent could be generated yet but state has a defined start and end
    // then default to using the state-defined region as the extent
    if (dimension == "x" && !isNaN(this.state.start) && !isNaN(this.state.end)) {
        return [this.state.start, this.state.end];
    }

    // No conditions met for generating a valid extent, return an empty array
    return [];

};

// Initialize a data layer
LocusZoom.DataLayer.prototype.initialize = function(){

    // Append a container group element to house the main data layer group element and the clip path
    this.svg.container = this.parent.svg.group.append("g")
        .attr("id", this.getBaseId() + ".data_layer_container");
        
    // Append clip path to the container element
    this.svg.clipRect = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip")
        .append("rect");
    
    // Append svg group for rendering all data layer elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".data_layer")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    return this;

};

LocusZoom.DataLayer.prototype.draw = function(){
    this.svg.container.attr("transform", "translate(" + this.parent.layout.cliparea.origin.x +  "," + this.parent.layout.cliparea.origin.y + ")");
    this.svg.clipRect
        .attr("width", this.parent.layout.cliparea.width)
        .attr("height", this.parent.layout.cliparea.height);
    this.positionAllTooltips();
    return this;
};

// Re-Map a data layer to new positions according to the parent panel's parent instance's state
LocusZoom.DataLayer.prototype.reMap = function(){

    this.destroyAllTooltips(); // hack - only non-visible tooltips should be destroyed
                               // and then recreated if returning to visibility

    // Fetch new data
    var promise = this.parent.parent.lzd.getData(this.state, this.layout.fields); //,"ld:best"
    promise.then(function(new_data){
        this.data = new_data.body;
        this.initialized = true;
    }.bind(this));
    return promise;

};
