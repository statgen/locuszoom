/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Data Layer Class

  A data layer is an abstract class representing a data set and its
  graphical representation within a panel

*/

LocusZoom.DataLayer = function(layout, parent) {

    this.initialized = false;
    this.layout_idx = null;

    this.id     = null;
    this.parent = parent || null;
    this.svg    = {};

    this.parent_plot = null;
    if (typeof parent != "undefined" && parent instanceof LocusZoom.Panel){ this.parent_plot = parent.parent; }

    this.layout = LocusZoom.Layouts.merge(layout || {}, LocusZoom.DataLayer.DefaultLayout);
    if (this.layout.id){ this.id = this.layout.id; }

    // Ensure any axes defined in the layout have an explicit axis number (default: 1)
    if (this.layout.x_axis != {} && typeof this.layout.x_axis.axis != "number"){ this.layout.x_axis.axis = 1; }
    if (this.layout.y_axis != {} && typeof this.layout.y_axis.axis != "number"){ this.layout.y_axis.axis = 1; }

    // Define state parameters specific to this data layer
    if (this.parent){
        this.state = this.parent.state;
        this.state_id = this.parent.id + "." + this.id;
        this.state[this.state_id] = this.state[this.state_id] || {};
        if (typeof this.layout.highlighted == "object"){
            this.state[this.state_id].highlighted = this.state[this.state_id].highlighted || [];
        }
        if (typeof this.layout.selected == "object"){
            this.state[this.state_id].selected = this.state[this.state_id].selected || [];
        }
    } else {
        this.state = {};
        this.state_id = null;
    }

    // Initialize parameters for storing data and tool tips
    this.data = [];
    if (this.layout.tooltip){
        this.tooltips = {};
    }
    
    return this;

};

LocusZoom.DataLayer.DefaultLayout = {
    type: "",
    fields: [],
    x_axis: {},
    y_axis: {}
};

LocusZoom.DataLayer.prototype.getBaseId = function(){
    return this.parent_plot.id + "." + this.parent.id + "." + this.id;
};

LocusZoom.DataLayer.prototype.getAbsoluteDataHeight = function(){
    var dataBCR = this.svg.group.node().getBoundingClientRect();
    return dataBCR.height;
};

LocusZoom.DataLayer.prototype.canTransition = function(){
    if (!this.layout.transition){ return false; }
    return !(this.parent_plot.panel_boundaries.dragging || this.parent.interactions.dragging || this.parent.interactions.zooming);
};

LocusZoom.DataLayer.prototype.getElementId = function(element){
    var element_id = "element";
    if (typeof element == "string"){
        element_id = element;
    } else if (typeof element == "object"){
        var id_field = this.layout.id_field || "id";
        if (typeof element[id_field] == "undefined"){
            throw("Unable to generate element ID");
        }
        element_id = element[id_field].toString().replace(/\W/g,"");
    }
    return (this.getBaseId() + "-" + element_id).replace(/(:|\.|\[|\]|,)/g, "_");
};

LocusZoom.DataLayer.prototype.getElementById = function(id){
    var selector = d3.select("#" + id.replace(/(:|\.|\[|\]|,)/g, "\\$1"));
    if (!selector.empty() && selector.data() && selector.data().length){
        return selector.data()[0];
    } else {
        return null;
    }
};

// Basic method to apply arbitrary methods and properties to data elements.
// This is called on all data immediately after being fetched.
LocusZoom.DataLayer.prototype.applyDataMethods = function(){
    this.data.forEach(function(d, i){
        // Basic toHTML() method - return the stringified value in the id_field, if defined.
        this.data[i].toHTML = function(){
            var id_field = this.layout.id_field || "id";
            var html = "";
            if (this.data[i][id_field]){ html = this.data[i][id_field].toString(); }
            return html;
        }.bind(this);
        // getDataLayer() method - return a reference to the data layer
        this.data[i].getDataLayer = function(){
            return this;
        }.bind(this);
        // deselect() method - shortcut method to deselect the element
        this.data[i].deselect = function(){
            var data_layer = this.getDataLayer();
            data_layer.unselectElement(this);
        };
    }.bind(this));
    this.applyCustomDataMethods();
    return this;
};

// Arbitrarily advanced method to apply methods and properties to data elements.
// May be implemented by data layer classes as needed to do special things.
LocusZoom.DataLayer.prototype.applyCustomDataMethods = function(){
    return this;
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

    // If a floor AND a ceiling are explicitly defined then just return that extent and be done
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

// Generate a tool tip for a given element
LocusZoom.DataLayer.prototype.createTooltip = function(d, id){
    if (typeof this.layout.tooltip != "object"){
        throw ("DataLayer [" + this.id + "] layout does not define a tooltip");
    }
    if (typeof id == "undefined"){ id = this.getElementId(d); }
    if (this.tooltips[id]){
        this.positionTooltip(id);
        return;
    }
    this.tooltips[id] = {
        data: d,
        arrow: null,
        selector: d3.select(this.parent_plot.svg.node().parentNode).append("div")
            .attr("class", "lz-data_layer-tooltip")
            .attr("id", id + "-tooltip")
    };
    this.updateTooltip(d);
    return this;
};

// Update a tool tip (generate its inner HTML)
LocusZoom.DataLayer.prototype.updateTooltip = function(d, id){
    if (typeof id == "undefined"){ id = this.getElementId(d); }
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
        this.tooltips[id].selector.append("button")
            .attr("class", "lz-tooltip-close-button")
            .attr("title", "Close")
            .text("×")
            .on("click", function(){
                this.destroyTooltip(id);
            }.bind(this));
    }
    // Apply data directly to the tool tip for easier retrieval by custom UI elements inside the tool tip
    this.tooltips[id].selector.data([d]);
    // Reposition and draw a new arrow
    this.positionTooltip(id);
    return this;
};

// Destroy tool tip - remove the tool tip element from the DOM and delete the tool tip's record on the data layer
LocusZoom.DataLayer.prototype.destroyTooltip = function(d, id){
    if (typeof d == "string"){
        id = d;
    } else if (typeof id == "undefined"){
        id = this.getElementId(d);
    }
    if (this.tooltips[id]){
        if (typeof this.tooltips[id].selector == "object"){
            this.tooltips[id].selector.remove();
        }
        delete this.tooltips[id];
    }
    return this;
};

// Loop through and destroy all tool tips on this data layer
LocusZoom.DataLayer.prototype.destroyAllTooltips = function(){
    for (var id in this.tooltips){
        this.destroyTooltip(id);
    }
    return this;
};

// Position tool tip - naïve function to place a tool tip to the lower right of the current mouse element
// Most data layers reimplement this method to position tool tips specifically for the data they display
LocusZoom.DataLayer.prototype.positionTooltip = function(id){
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
    return this;
};

// Loop through and position all tool tips on this data layer
LocusZoom.DataLayer.prototype.positionAllTooltips = function(){
    for (var id in this.tooltips){
        this.positionTooltip(id);
    }
    return this;
};

// Show or hide a tool tip by ID depending on directives in the layout and state values relative to the ID
LocusZoom.DataLayer.prototype.showOrHideTooltip = function(element){
    
    if (typeof this.layout.tooltip != "object"){ return; }
    var id = this.getElementId(element);

    var resolveStatus = function(statuses, directive, operator){
        var status = null;
        if (typeof statuses != "object" || statuses == null){ return null; }
        if (Array.isArray(directive)){
            if (typeof operator == "undefined"){ operator = "and"; }
            if (directive.length == 1){
                status = statuses[directive[0]];
            } else {
                status = directive.reduce(function(previousValue, currentValue) {
                    if (operator == "and"){
                        return statuses[previousValue] && statuses[currentValue];
                    } else if (operator == "or"){
                        return statuses[previousValue] || statuses[currentValue];
                    }
                    return null;
                });
            }
        } else if (typeof directive == "object"){
            var sub_status;
            for (var sub_operator in directive){
                sub_status = resolveStatus(statuses, directive[sub_operator], sub_operator);
                if (status == null){
                    status = sub_status;
                } else if (operator == "and"){
                    status = status && sub_status;
                } else if (operator == "or"){
                    status = status || sub_status;
                }
            }
        }
        return status;
    };

    var show_directive = {};
    if (typeof this.layout.tooltip.show == "string"){
        show_directive = { and: [ this.layout.tooltip.show ] };
    } else if (typeof this.layout.tooltip.show == "object"){
        show_directive = this.layout.tooltip.show;
    }

    var hide_directive = {};
    if (typeof this.layout.tooltip.hide == "string"){
        hide_directive = { and: [ this.layout.tooltip.hide ] };
    } else if (typeof this.layout.tooltip.hide == "object"){
        hide_directive = this.layout.tooltip.hide;
    }

    var statuses = {};
    statuses.highlighted = this.state[this.state_id].highlighted.indexOf(id) != -1;
    statuses.unhighlighted = !statuses.highlighted;
    statuses.selected = this.state[this.state_id].selected.indexOf(id) != -1;
    statuses.unselected = !statuses.selected;

    var show_resolved = resolveStatus(statuses, show_directive);
    var hide_resolved = resolveStatus(statuses, hide_directive);

    // Only show tooltip if the resolved logic explicitly shows and explicitly not hides the tool tip
    // Otherwise ensure tooltip does not exist
    if (show_resolved && !hide_resolved){
        this.createTooltip(element);
    } else {
        this.destroyTooltip(element);
    }

    return this;
    
};

// Toggle the highlighted status of an element
LocusZoom.DataLayer.prototype.highlightElement = function(element){
    this.setElementStatus("highlighted", element, true);
    return this;
};
LocusZoom.DataLayer.prototype.unhighlightElement = function(element){
    this.setElementStatus("highlighted", element, false);
    return this;
};

// Toggle the highlighted status of all elements
LocusZoom.DataLayer.prototype.highlightAllElements = function(){
    this.setAllElementStatus("highlighted", true);
    return this;
};
LocusZoom.DataLayer.prototype.unhighlightAllElements = function(){
    this.setAllElementStatus("highlighted", false);
    return this;
};

// Toggle the selected status of an element
LocusZoom.DataLayer.prototype.selectElement = function(element){
    this.setElementStatus("selected", element, true);
    return this;
};
LocusZoom.DataLayer.prototype.unselectElement = function(element){
    this.setElementStatus("selected", element, false);
    return this;
};

// Toggle the selected status of all elements
LocusZoom.DataLayer.prototype.selectAllElements = function(){
    this.setAllElementStatus("selected", true);
    return this;
};
LocusZoom.DataLayer.prototype.unselectAllElements = function(){
    this.setAllElementStatus("selected", false);
    return this;
};

// Toggle a status (e.g. highlighted, selected) on an element
LocusZoom.DataLayer.prototype.setElementStatus = function(status, element, toggle){
    
    // Sanity checks
    if (typeof status == "undefined" || ["highlighted","selected"].indexOf(status) == -1){
        throw("Invalid status passed to setElementStatus()");
    }
    if (typeof element == "undefined"){
        throw("Invalid element passed to setElementStatus()");
    }
    if (typeof toggle == "undefined"){
        toggle = true;
    }

    var element_id = this.getElementId(element);
    
    // Set/unset the proper status class on the appropriate DOM element
    var selector = d3.select("#" + element_id);
    var attr_class = "lz-data_layer-" + this.layout.type + "-" + status;
    if (this.layout.hover_element){
        if (this.layout.group_hover_elements_on_field){
            selector = this.group_hover_elements[element[this.layout.group_hover_elements_on_field]];
        } else {
            selector = d3.select("#" + element_id + "_" + this.layout.hover_element);
        }
        attr_class = "lz-data_layer-" + this.layout.type + "-" + this.layout.hover_element + "-" + status;
    }
    if (selector && !selector.empty()){
        selector.classed(attr_class, toggle);
    }
    
    // Track element ID in the proper status state array
    var element_status_idx = this.state[this.state_id][status].indexOf(element_id);
    if (toggle && element_status_idx == -1){
        this.state[this.state_id][status].push(element_id);
    }
    if (!toggle && element_status_idx != -1){
        this.state[this.state_id][status].splice(element_status_idx, 1);
    }
    
    // Trigger tool tip show/hide logic
    this.showOrHideTooltip(element);

    // Trigger layout changed event hook
    this.parent.emit("layout_changed");
    this.parent_plot.emit("layout_changed");

    return this;
    
};

// Toggle a status on all elements in the data layer
LocusZoom.DataLayer.prototype.setAllElementStatus = function(status, toggle){
    
    // Sanity check
    if (typeof status == "undefined" || ["highlighted","selected"].indexOf(status) == -1){
        throw("Invalid status passed to setAllElementStatus()");
    }
    if (typeof this.state[this.state_id][status] == "undefined"){ return this; }
    if (typeof toggle == "undefined"){ toggle = true; }

    // Apply statuses
    if (toggle){
        this.data.forEach(function(element){
            if (this.state[this.state_id][status].indexOf(this.getElementId(element)) == -1){
                this.setElementStatus(status, element, true);
            }
        }.bind(this));
    } else {
        var status_ids = this.state[this.state_id][status].slice();
        status_ids.forEach(function(id){
            var element = this.getElementById(id);
            if (typeof element == "object" && element != null){
                this.setElementStatus(status, element, false);
            }
        }.bind(this));
    }
    
    return this;
};

// Apply mouse event bindings to create status-related behavior (e.g. highlighted, selected)
LocusZoom.DataLayer.prototype.applyStatusBehavior = function(status, selection){

    // Glossary for this function:
    // status - an element property that can be tied to mouse behavior (e.g. highighted, selected)
    // event - a mouse event that can be bound to a watch function (e.g. "mouseover", "click")
    // action - a more verbose locuszoom-layout-specific form of an event (e.g. "onmouseover", "onshiftclick")

    // Sanity checks
    if (typeof status == "undefined" || ["highlighted","selected"].indexOf(status) == -1){ return; }
    if (typeof selection != "object"){ return; }
    if (typeof this.layout[status] != "object" || !this.layout[status]){ return; }

    // Map of supported d3 events and the locuszoom layout events they map to
    var event_directive_map = {
        "mouseover": ["onmouseover", "onctrlmouseover", "onshiftmouseover", "onctrlshiftmouseover"],
        "mouseout": ["onmouseout"],
        "click": ["onclick", "onctrlclick", "onshiftclick", "onctrlshiftclick"]
    };

    // General function to process mouse events and layout directives into discrete element status update calls
    var handleElementStatusEvent = function(status, event, element){
        var status_boolean = null;
        var ctrl = d3.event.ctrlKey;
        var shift = d3.event.shiftKey;
        if (!event_directive_map[event]){ return; }
        // Determine the directive by building the action string to use. Default down to basic actions
        // if more precise actions are not defined (e.g. if onclick is defined and onshiftclick is not,
        // but this click event happened with the shift key pressed, just treat it as a regular click)
        var base_action = "on" + event;
        var precise_action = "on" + (ctrl ? "ctrl" : "") + (shift ? "shift" : "") + event;
        var directive = this.layout[status][precise_action] || this.layout[status][base_action] || null;
        if (!directive){ return; }
        // Resolve the value of the status boolean from the directive and the element's current status
        switch (directive){
        case "on":
            status_boolean = true;
            break;
        case "off":
            status_boolean = false;
            break;
        case "toggle":
        case "toggle_exclusive":
            status_boolean = (this.state[this.state_id][status].indexOf(this.getElementId(element)) == -1);
            break;
        }
        if (status_boolean == null){ return; }
        // Special handling for toggle_exclusive - if the new status_boolean is true then first set the
        // status to off for all other elements
        if (status_boolean && directive == "toggle_exclusive"){
            this.setAllElementStatus(status, false);
        }
        // Apply the new status
        this.setElementStatus(status, element, status_boolean);
        // Trigger event emitters as needed
        if (event == "click"){
            this.parent.emit("element_clicked", element);
            this.parent_plot.emit("element_clicked", element);
        }
    }.bind(this);
    
    // Determine which bindings to set up
    var events_to_bind = {};
    Object.keys(event_directive_map).forEach(function(event){ events_to_bind[event] = false; });
    Object.keys(this.layout[status]).forEach(function(action){
        Object.keys(event_directive_map).forEach(function(event){
            if (event_directive_map[event].indexOf(action) != -1){ events_to_bind[event] = true; }
        });
    });

    // Set up the bindings
    Object.keys(events_to_bind).forEach(function(event){
        if (!events_to_bind[event]){ return; }
        selection.on(event, function(element){
            handleElementStatusEvent(status, event, element);
        }.bind(this));
    }.bind(this));

    return this;
                    
};

// Apply all supported status behaviors to a selection of objects
LocusZoom.DataLayer.prototype.applyAllStatusBehaviors = function(selection){
    var supported_statuses = ["highlighted","selected"];
    supported_statuses.forEach(function(status){
        this.applyStatusBehavior(status, selection);
    }.bind(this));
    return this;
};

// Get an object with the x and y coordinates of the panel's origin in terms of the entire page
// Necessary for positioning any HTML elements over the panel
LocusZoom.DataLayer.prototype.getPageOrigin = function(){
    var panel_origin = this.parent.getPageOrigin();
    return {
        x: panel_origin.x + this.parent.layout.margin.left,
        y: panel_origin.y + this.parent.layout.margin.top
    };
};


LocusZoom.DataLayer.prototype.draw = function(){
    this.svg.container.attr("transform", "translate(" + this.parent.layout.cliparea.origin.x +  "," + this.parent.layout.cliparea.origin.y + ")");
    this.svg.clipRect
        .attr("width", this.parent.layout.cliparea.width)
        .attr("height", this.parent.layout.cliparea.height);
    this.positionAllTooltips();
    return this;
};

// Re-Map a data layer to new positions according to the parent panel's parent plot's state
LocusZoom.DataLayer.prototype.reMap = function(){

    this.destroyAllTooltips(); // hack - only non-visible tooltips should be destroyed
                               // and then recreated if returning to visibility

    // Fetch new data
    var promise = this.parent_plot.lzd.getData(this.state, this.layout.fields); //,"ld:best"
    promise.then(function(new_data){
        this.data = new_data.body;
        this.applyDataMethods();
        this.initialized = true;
    }.bind(this));

    return promise;

};


/************
  Data Layers

  Object for storing data layer definitions. Because data layer definitions tend
  to be lengthy they are stored in individual files instead of below this collection definition.
*/

LocusZoom.DataLayers = (function() {
    var obj = {};
    var datalayers = {};

    obj.get = function(name, layout, parent) {
        if (!name) {
            return null;
        } else if (datalayers[name]) {
            if (typeof layout != "object"){
                throw("invalid layout argument for data layer [" + name + "]");
            } else {
                return new datalayers[name](layout, parent);
            }
        } else {
            throw("data layer [" + name + "] not found");
        }
    };

    obj.set = function(name, datalayer) {
        if (datalayer) {
            if (typeof datalayer != "function"){
                throw("unable to set data layer [" + name + "], argument provided is not a function");
            } else {
                datalayers[name] = datalayer;
                datalayers[name].prototype = new LocusZoom.DataLayer();
            }
        } else {
            delete datalayers[name];
        }
    };

    obj.add = function(name, datalayer) {
        if (datalayers[name]) {
            throw("data layer already exists with name: " + name);
        } else {
            obj.set(name, datalayer);
        }
    };

    obj.list = function() {
        return Object.keys(datalayers);
    };

    return obj;
})();
