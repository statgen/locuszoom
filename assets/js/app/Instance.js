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

    // The panels property stores child panel instances
    this.panels = {};
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

    // Set instance dimensions
    this.setDimensions();

    // Add panels
    var panel_id;
    for (panel_id in this.layout.panels){
        this.addPanel(panel_id, this.layout.panels[panel_id]);
    }

};

// Set the layout dimensions for this instance. If an SVG exists, update its dimensions.
// If any arguments are missing, use values stored in the layout. Keep everything in agreement.
LocusZoom.Instance.prototype.setDimensions = function(width, height){
    // Set discrete layout dimensions based on arguments
    if (!isNaN(width) && width >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
    }
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
    // Reposition all panels
    this.positionPanels();
    // If the instance has been initialized then trigger some necessary render functions
    if (this.initialized){
        this.ui.render();
    }
    this.onUpdate();
    return this;
};

// Create a new panel by id and panel class
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

    // Update minimum instance dimensions based on the minimum dimensions of all panels
    // TODO: This logic assumes panels are always stacked vertically. More sophisticated
    //       logic to handle arbitrary panel geometries needs to be supported.
    var panel_min_widths = [];
    var panel_min_heights = [];
    for (id in this.panels){
        panel_min_widths.push(this.panels[id].layout.min_width);
        panel_min_heights.push(this.panels[id].layout.min_height);
    }
    this.layout.min_width = Math.max.apply(null, panel_min_widths);
    this.layout.min_height = panel_min_heights.reduce(function(a,b){ return a+b; });

    // Call setDimensions() in case updated minimums need to be applied, which also calls positionPanels()
    this.setDimensions();

    return this.panels[panel.id];
};

// Automatically position panels based on panel positioning rules and values
// If the plot is resizable then recalculate dimensions and position from proportional values
LocusZoom.Instance.prototype.positionPanels = function(){
    var id;
    for (id in this.panels){
        if (this.layout.resizable){
            this.panels[id].layout.width = this.panels[id].layout.proportional_width * this.layout.width;
            this.panels[id].layout.height = this.panels[id].layout.proportional_height * this.layout.height;
            this.panels[id].layout.origin.x = this.panels[id].layout.proportional_origin.x * this.layout.width;
            this.panels[id].layout.origin.y = this.panels[id].layout.proportional_origin.y * this.layout.height;
        }
        this.panels[id].setOrigin();
        this.panels[id].setDimensions();
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
            this.initialized = true;
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
            this.initialized = true;
            this.onUpdate();
        }.bind(this));

    return this;
    
};
