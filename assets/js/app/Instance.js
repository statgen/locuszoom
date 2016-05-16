/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Instance Class

  An Instance is an independent LocusZoom object. Many such LocusZoom objects can exist simultaneously
  on a single page, each having its own layout.

*/

LocusZoom.Instance = function(id, datasource, layout) {

    this.initialized = false;

    this.id = id;
    
    this.svg = null;

    this.panels = {};
    this.panel_ids_by_y_index = [];

    this.remap_promises = [];

    // The layout is a serializable object used to describe the composition of the instance
    // If no layout was passed, use the Standard Layout
    // Otherwise merge whatever was passed with the Default Layout
    if (typeof layout == "undefined"){
        this.layout = LocusZoom.mergeLayouts(LocusZoom.StandardLayout, LocusZoom.Instance.DefaultLayout);
    } else {
        this.layout = LocusZoom.mergeLayouts(layout, LocusZoom.Instance.DefaultLayout);
    }

    // Create a shortcut to the state in the layout on the instance
    this.state = this.layout.state;
    
    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);

    // Window.onresize listener (responsive layouts only)
    this.window_onresize = null;

    // Array of functions to call when the plot is updated
    this.onUpdateFunctions = [];

    // Initialize the layout
    this.initializeLayout();

    return this;
  
};

// Default Layout
LocusZoom.Instance.DefaultLayout = {
    state: {},
    width: 1,
    height: 1,
    min_width: 1,
    min_height: 1,
    resizable: false,
    aspect_ratio: 1,
    panels: {},
    controls: {
        show: "onmouseover",
        hide_delay: 500
    }
};

// Helper method to sum the proportional dimensions of panels, a value that's checked often as panels are added/removed
LocusZoom.Instance.prototype.sumProportional = function(dimension){
    if (dimension != "height" && dimension != "width"){
        throw ("Bad dimension value passed to LocusZoom.Instance.prototype.sumProportional");
    }
    var total = 0;
    for (var id in this.panels){
        // Ensure every panel contributing to the sum has a non-zero proportional dimension
        if (!this.panels[id].layout["proportional_" + dimension]){
            this.panels[id].layout["proportional_" + dimension] = 1 / Object.keys(this.panels).length;
        }
        total += this.panels[id].layout["proportional_" + dimension];
    }
    return total;
};


LocusZoom.Instance.prototype.onUpdate = function(func){
    if (typeof func == "undefined"){
        for (func in this.onUpdateFunctions){
            this.onUpdateFunctions[func]();
        }
    } else if (typeof func == "function") {
        this.onUpdateFunctions.push(func);
    }
};

LocusZoom.Instance.prototype.initializeLayout = function(){

    // Sanity check layout values
    // TODO: Find a way to generally abstract this, maybe into an object that models allowed layout values?
    if (isNaN(this.layout.width) || this.layout.width <= 0){
        throw ("Instance layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.height) || this.layout.height <= 0){
        throw ("Instance layout parameter `width` must be a positive number");
    }
    if (isNaN(this.layout.aspect_ratio) || this.layout.aspect_ratio <= 0){
        throw ("Instance layout parameter `aspect_ratio` must be a positive number");
    }

    // If this is a responsive layout then set a namespaced/unique onresize event listener on the window
    if (this.layout.resizable == "responsive"){
        this.window_onresize = d3.select(window).on("resize.lz-"+this.id, function(){
            var clientRect = this.svg.node().parentNode.getBoundingClientRect();
            this.setDimensions(clientRect.width, clientRect.height);
        }.bind(this));
        // Forcing one additional setDimensions() call after the page is loaded clears up
        // any disagreements between the initial layout and the loaded responsive container's size
        d3.select(window).on("load.lz-"+this.id, function(){ this.setDimensions(); }.bind(this));
    }

    // Add panels
    var panel_id;
    for (panel_id in this.layout.panels){
        this.addPanel(panel_id, this.layout.panels[panel_id]);
    }

};

/**
  Set the dimensions for an instance.
  This function works in two different ways:
  1. If passed a discrete width and height:
     * Adjust the instance to match those exact values (lower-bounded by minimum panel dimensions)
     * Resize panels within the instance proportionally to match the new instance dimensions
  2. If NOT passed discrete width and height:
     * Assume panels within are sized and positioned correctly
     * Calculate appropriate instance dimesions from panels contained within and update instance
*/
LocusZoom.Instance.prototype.setDimensions = function(width, height){

    // Update minimum allowable width and height by aggregating minimums from panels.
    var min_width = null;
    var min_height = null;
    for (var id in this.panels){
        min_width = Math.max(min_width, this.panels[id].layout.min_width);
        min_height = Math.max(min_height, (this.panels[id].layout.min_height / this.panels[id].layout.proportional_height));
    }
    this.layout.min_width = Math.max(min_width, 1);
    this.layout.min_height = Math.max(min_height, 1);

    // If width and height arguments were passed then adjust them against instance minimums if necessary.
    // Then resize the instance and proportionally resize panels to fit inside the new instance dimensions.
    if (!isNaN(width) && width >= 0 && !isNaN(height) && height >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
        // Override discrete values if resizing responsively
        if (this.layout.resizable == "responsive"){
            if (this.svg){
                this.layout.width = Math.max(this.svg.node().parentNode.getBoundingClientRect().width, this.layout.min_width);
            }
            this.layout.height = this.layout.width / this.layout.aspect_ratio;
            if (this.layout.height < this.layout.min_height){
                this.layout.height = this.layout.min_height;
                this.layout.width  = this.layout.height * this.layout.aspect_ratio;
            }
        }
        // Resize/reposition panels to fit, update proportional origins if necessary
        var y_offset = 0;
        this.panel_ids_by_y_index.forEach(function(panel_id){
            var panel_width = this.layout.width;
            var panel_height = this.panels[panel_id].layout.proportional_height * this.layout.height;
            this.panels[panel_id].setDimensions(panel_width, panel_height);
            this.panels[panel_id].setOrigin(0, y_offset);
            this.panels[panel_id].layout.proportional_origin.x = 0;
            this.panels[panel_id].layout.proportional_origin.y = y_offset / this.layout.height;
            y_offset += panel_height;
        }.bind(this));
    }

    // If width and height arguments were NOT passed (and panels exist) then determine the instance dimensions
    // by making it conform to panel dimensions, assuming panels are already positioned correctly.
    else if (Object.keys(this.panels).length) {
        this.layout.width = 0;
        this.layout.height = 0;
        for (var id in this.panels){
            this.layout.width = Math.max(this.panels[id].layout.width, this.layout.width);
            this.layout.height += this.panels[id].layout.height;
        }
        this.layout.width = Math.max(this.layout.width, this.layout.min_width);
        this.layout.height = Math.max(this.layout.height, this.layout.min_height);
    }

    // Keep aspect ratio in agreement with dimensions
    this.layout.aspect_ratio = this.layout.width / this.layout.height;

    // Apply layout width and height as discrete values or viewbox values
    if (this.svg != null){
        if (this.layout.resizable == "responsive"){
            this.svg
                .attr("viewBox", "0 0 " + this.layout.width + " " + this.layout.height)
                .attr("preserveAspectRatio", "xMinYMin meet");
        } else {
            this.svg.attr("width", this.layout.width).attr("height", this.layout.height);
        }
    }

    // If the instance has been initialized then trigger some necessary render functions
    if (this.initialized){
        this.ui.render();
    }

    this.onUpdate();
    return this;
};

// Create a new panel by id and layout
LocusZoom.Instance.prototype.addPanel = function(id, layout){
    if (typeof id !== "string"){
        throw "Invalid panel id passed to LocusZoom.Instance.prototype.addPanel()";
    }
    if (typeof this.panels[id] !== "undefined"){
        throw "Cannot create panel with id [" + id + "]; panel with that id already exists";
    }
    if (typeof layout !== "object"){
        throw "Invalid panel layout passed to LocusZoom.Instance.prototype.addPanel()";
    }

    // Create the Panel and set its parent
    var panel = new LocusZoom.Panel(id, layout, this);
    
    // Store the Panel on the Instance
    this.panels[panel.id] = panel;

    // If a discrete y_index was set in the layout then adjust other panel y_index values to accomodate this one
    if (panel.layout.y_index != null && !isNaN(panel.layout.y_index)
        && this.panel_ids_by_y_index.length > 0){
        this.panel_ids_by_y_index.splice(panel.layout.y_index, 0, panel.id);
        this.panel_ids_by_y_index.forEach(function(pid, idx){
            this.panels[pid].layout.y_index = idx;
        }.bind(this));
    } else {
        var length = this.panel_ids_by_y_index.push(panel.id);
        this.panels[panel.id].layout.y_index = length - 1;
    }

    // If not present, store the panel layout in the plot layout
    if (typeof this.layout.panels[panel.id] == "undefined"){
        this.layout.panels[panel.id] = this.panels[panel.id].layout;
    }

    // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
    if (this.initialized){
        this.positionPanels();
        // Initialize and load data into the new panel
        this.panels[panel.id].initialize();
        this.panels[panel.id].reMap();
        // An extra call to setDimensions with existing discrete dimensions fixes some rounding errors with tooltip
        // positioning. TODO: make this additional call unnecessary.
        this.setDimensions(this.layout.width, this.layout.height);
    }

    return this.panels[panel.id];
};

// Remove panel by id
LocusZoom.Instance.prototype.removePanel = function(id){
    if (!this.panels[id]){
        throw ("Unable to remove panel, ID not found: " + id);
    }

    // Remove the svg container for the panel if it exists
    if (this.panels[id].svg.container){
        this.panels[id].svg.container.remove();
    }

    // Delete the panel and its presence in the layout
    delete this.panels[id];
    delete this.layout.panels[id];

    // Remove the panel id from the y_index array
    this.panel_ids_by_y_index.splice(this.panel_ids_by_y_index.indexOf(id), 1);

    // Call positionPanels() to keep panels from overlapping and ensure filling all available vertical space
    if (this.initialized){
        this.positionPanels();
    }

    return this;
};


/**
 Automatically position panels based on panel positioning rules and values.
 Keep panels from overlapping vertically by adjusting origins, and keep the sum of proportional heights at 1.

 TODO: This logic currently only supports dynamic positioning of panels to prevent overlap in a VERTICAL orientation.
       Some framework exists for positioning panels in horizontal orientations as well (width, proportional_width, origin.x, etc.)
       but the logic for keeping these user-defineable values straight approaches the complexity of a 2D box-packing algorithm.
       That's complexity we don't need right now, and may not ever need, so it's on hiatus until a use case materializes.
*/
LocusZoom.Instance.prototype.positionPanels = function(){

    // Proportional heights for newly added panels default to null unless explcitly set, so determine appropriate
    // proportional heights for all panels with a null value from discretely set dimensions.
    // Likewise handle defaul nulls for proportional widths, but instead just force a value of 1 (full width)
    for (var id in this.panels){
        if (this.panels[id].layout.proportional_height == null){
            this.panels[id].layout.proportional_height = this.panels[id].layout.height / this.layout.height;
        }
        if (this.panels[id].layout.proportional_width == null){
            this.panels[id].layout.proportional_width = 1;
        }
    }

    // Sum the proportional heights and then adjust all proportionally so that the sum is exactly 1
    var total_proportional_height = this.sumProportional("height");
    if (!total_proportional_height){
        return this;
    }
    var proportional_adjustment = 1 / total_proportional_height;
    for (var id in this.panels){
        this.panels[id].layout.proportional_height *= proportional_adjustment;
    }

    // Update origins on all panels without changing instance-level dimensions yet
    var y_offset = 0;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].setOrigin(0, y_offset);
        this.panels[panel_id].layout.proportional_origin.x = 0;
        y_offset += this.panels[panel_id].layout.height;
    }.bind(this));
    var calculated_instance_height = y_offset;
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].layout.proportional_origin.y = this.panels[panel_id].layout.origin.y / calculated_instance_height;
    }.bind(this));

    // Update dimensions on the instance to accomodate repositioned panels
    this.setDimensions();

    // Set dimensions on all panels using newly set instance-level dimensions and panel-level proportional dimensions
    this.panel_ids_by_y_index.forEach(function(panel_id){
        this.panels[panel_id].setDimensions(this.layout.width * this.panels[panel_id].layout.proportional_width,
                                            this.layout.height * this.panels[panel_id].layout.proportional_height);
    }.bind(this));
    
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
            // Initialize resize handle
            if (this.parent.layout.resizable == "manual"){
                this.resize_handle = this.svg.append("g")
                    .attr("id", this.parent.id + ".ui.resize_handle");
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
                    this.setDimensions(this.layout.width + d3.event.dx, this.layout.height + d3.event.dy);
                }.bind(this.parent));
                this.resize_handle.call(resize_drag);
            }
            // Render all UI elements
            this.render();
        },
        render: function(){
            // Position resize handle
            if (this.parent.layout.resizable == "manual"){
                this.resize_handle
                    .attr("transform", "translate(" + (this.parent.layout.width - 17) + ", " + (this.parent.layout.height - 17) + ")");
            }
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
                try {
                    this.svg.select("text").selectAll("tspan").remove();
                    message.split("\n").forEach(function(line){
                        this.svg.select("text").append("tspan")
                            .attr("x", "1em").attr("dy", "1.5em").text(line);
                    }.bind(this));
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "2.5em")
                        .attr("class", "dismiss").text("Dismiss")
                        .on("click", function(){
                            this.raise();
                        }.bind(this));
                } catch (e){
                    console.error("LocusZoom tried to render an error message but it's not a string:", message);
                }
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect").attr("width", "100%").attr("height", "100%");
    this.curtain.svg.append("text")
        .attr("id", this.id + ".curtain_text")
        .attr("x", "1em").attr("y", "0em");

    // Create the controls object with show/update/hide methods
    var css_string = "";
    for (var stylesheet in Object.keys(document.styleSheets)){
        if (   document.styleSheets[stylesheet].href != null
               && document.styleSheets[stylesheet].href.indexOf("locuszoom.css") != -1){
            for (var rule in document.styleSheets[stylesheet].cssRules){
                if (typeof document.styleSheets[stylesheet].cssRules[rule].cssText != "undefined"){
                    css_string += document.styleSheets[stylesheet].cssRules[rule].cssText + " ";
                }
            }
            break;
        }
    }
    this.controls = {
        parent: this,
        showing: false,
        css_string: css_string,
        show: function(){
            if (!this.showing){
                this.div = d3.select(this.parent.svg.node().parentNode).append("div")
                    .attr("class", "lz-locuszoom-controls").attr("id", this.id + ".controls");
                this.links = this.div.append("div")
                    .attr("id", this.parent.id + ".controls.links")
                    .style("float", "left");
                // Download SVG Button
                this.download_svg_button = this.links.append("a")
                    .attr("class", "lz-controls-button")
                    .attr("href-lang", "image/svg+xml")
                    .attr("title", "Download SVG as locuszoom.svg")
                    .attr("download", "locuszoom.svg")
                    .text("Download SVG")
                    .on("mouseover", function() {
                        this.download_svg_button
                            .attr("class", "lz-controls-button-disabled")
                            .text("Preparing SVG");
                        this.generateBase64SVG().then(function(base64_string){
                            this.download_svg_button.attr("href", "data:image/svg+xml;base64,\n" + base64_string);
                            this.download_svg_button
                                .attr("class", "lz-controls-button")
                                .text("Download SVG");
                        }.bind(this));
                    }.bind(this));
                // Dimensions
                this.dimensions = this.div.append("div")
                    .attr("class", "lz-controls-info")
                    .attr("id", this.parent.id + ".controls.dimensions")
                    .style("float", "right");
                // Clear Element
                this.clear = this.div.append("div")
                    .attr("id", this.parent.id + ".controls.clear")
                    .style("clear", "both");
                // Update tracking boolean
                this.showing = true;
            }
            // Update all control element values
            this.update();
        },
        update: function(){
            this.div.attr("width", this.parent.layout.width);
            var display_width = this.parent.layout.width.toString().indexOf(".") == -1 ? this.parent.layout.width : this.parent.layout.width.toFixed(2);
            var display_height = this.parent.layout.height.toString().indexOf(".") == -1 ? this.parent.layout.height : this.parent.layout.height.toFixed(2);
            this.dimensions.text(display_width + "px × " + display_height + "px");
        },
        hide: function(){
            this.div.remove();
            this.showing = false;
        },
        generateBase64SVG: function(){
            return Q.fcall(function () {
                // Insert a hidden div, clone the node into that so we can modify it with d3
                var container = this.div.append("div").style("display", "none")
                    .html(this.parent.svg.node().outerHTML);
                // Remove unnecessary elements
                container.selectAll("g.lz-curtain").remove();
                container.selectAll("g.lz-ui").remove();
                container.selectAll("g.lz-mouse_guide").remove();
                // Pull the svg into a string and add the contents of the locuszoom stylesheet
                // Don't add this with d3 because it will escape the CDATA declaration incorrectly
                var initial_html = d3.select(container.select("svg").node().parentNode).html();
                var style_def = "<style type=\"text/css\"><![CDATA[ " + this.css_string + " ]]></style>";
                var insert_at = initial_html.indexOf(">") + 1;
                initial_html = initial_html.slice(0,insert_at) + style_def + initial_html.slice(insert_at);
                // Delete the container node
                container.remove();
                // Base64-encode the string and return it
                return btoa(encodeURIComponent(initial_html).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                    return String.fromCharCode("0x" + p1);
                }));
            }.bind(this));
        }
    };

    // Show controls once or with mouse events as stipulated by the layout
    if (this.layout.controls.show == "always"){
        this.controls.show();
    } else if (this.layout.controls.show == "onmouseover"){
        d3.select(this.svg.node().parentNode).on("mouseover", function(){
            clearTimeout(this.controls.hide_timeout);
            this.controls.show();
        }.bind(this));
        d3.select(this.svg.node().parentNode).on("mouseout", function(){
            this.controls.hide_timeout = setTimeout(function(){
                this.controls.hide();
            }.bind(this), this.layout.controls.hide_delay);
        }.bind(this));
    }

    // Initialize all panels
    for (var id in this.panels){
        this.panels[id].initialize();
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
        if (["onmouseover","always"].indexOf(this.layout.controls.show) != -1){
            this.controls.update();
        }
    }.bind(this));

    this.initialized = true;
    
    return this;

};

// Map an entire LocusZoom Instance to a new region
// DEPRECATED: This method is specific to only accepting chromosome, start, and end.
// LocusZoom.Instance.prototype.applyState() takes a single object, covering far more use cases.
LocusZoom.Instance.prototype.mapTo = function(chr, start, end){

    console.warn("Warning: use of LocusZoom.Instance.mapTo() is deprecated. Use LocusZoom.Instance.applyState() instead.");

    // Apply new state values
    // TODO: preserve existing state until new state is completely loaded+rendered or aborted?
    this.state.chr   = +chr;
    this.state.start = +start;
    this.state.end   = +end;

    this.remap_promises = [];
    // Trigger reMap on each Panel Layer
    for (var id in this.panels){
        this.remap_promises.push(this.panels[id].reMap());
    }

    Q.all(this.remap_promises)
        .catch(function(error){
            console.log(error);
            this.curtain.drop(error);
        }.bind(this))
        .done(function(){
            this.onUpdate();
        }.bind(this));

    return this;
    
};

// Refresh an instance's data from sources without changing position
LocusZoom.Instance.prototype.refresh = function(){
    this.applyState({});
};

// Update state values and trigger a pull for fresh data on all data sources for all data layers
LocusZoom.Instance.prototype.applyState = function(new_state){

    if (typeof new_state != "object"){
        throw("LocusZoom.applyState only accepts an object; " + (typeof new_state) + " given");
    }

    for (var property in new_state) {
        this.state[property] = new_state[property];
    }

    this.remap_promises = [];
    for (var id in this.panels){
        this.remap_promises.push(this.panels[id].reMap());
    }

    Q.all(this.remap_promises)
        .catch(function(error){
            console.log(error);
            this.curtain.drop(error);
        }.bind(this))
        .done(function(){
            this.onUpdate();
        }.bind(this));

    return this;
    
};
