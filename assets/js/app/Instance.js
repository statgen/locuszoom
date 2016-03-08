/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Instance Class

  An Instance is an independent LocusZoom object. Many such LocusZoom objects can exist simultaneously
  on a single page, each having its own layout, data sources, and state.

*/

LocusZoom.Instance = function(id, datasource, layout, state) {

    this.initialized = false;

    this.id = id;
    
    this.svg = null;

    // The panels property stores child panel instances
    this.panels = {};
    this.remap_promises = [];

    // The layout is a serializable object used to describe the composition of the instance
    this.layout = layout || JSON.parse(JSON.stringify(LocusZoom.DefaultLayout));
    
    // The state property stores any instance-wide parameters subject to change via user input
    this.state = state || JSON.parse(JSON.stringify(LocusZoom.DefaultState));
    
    // Boolean to set whether or not to show controls area
    this.show_controls = false;

    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);

    // Initialize the layout
    this.initializeLayout();

    return this;
  
};

LocusZoom.Instance.prototype.initializeLayout = function(){

    // Set instance dimensions or fall back to default values
    this.layout.width      = this.layout.width      || LocusZoom.DefaultLayout.width;
    this.layout.height     = this.layout.height     || LocusZoom.DefaultLayout.height;
    this.layout.min_width  = this.layout.min_width  || LocusZoom.DefaultLayout.min_width;
    this.layout.min_height = this.layout.min_height || LocusZoom.DefaultLayout.min_height;
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
    if (!isNaN(width) && width >= 0){
        this.layout.width = Math.max(Math.round(+width), this.layout.min_width);
    }
    if (!isNaN(height) && height >= 0){
        this.layout.height = Math.max(Math.round(+height), this.layout.min_height);
    }
    if (this.svg != null){
        this.svg.attr("width", this.layout.width).attr("height", this.layout.height);
    }
    if (this.initialized){
        this.ui.render();
        if (this.show_controls){
            this.controls.render();
        }
        this.stackPanels();
    }
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
    var panel = new LocusZoom.Panel(id, layout);
    panel.parent = this;
    this.panels[panel.id] = panel;
    this.stackPanels();
    return this.panels[panel.id];
};

// Automatically position panels based on panel positioning rules and values
// Default behavior: position panels vertically with equally proportioned heights
// In all cases: bubble minimum panel dimensions up from panels to enforce minimum instance dimensions
LocusZoom.Instance.prototype.stackPanels = function(){

    var id;

    // First set/enforce minimum instance dimensions based on current panels
    var panel_min_widths = [];
    var panel_min_heights = [];
    for (id in this.panels){
        panel_min_widths.push(this.panels[id].layout.min_width);
        panel_min_heights.push(this.panels[id].layout.min_height);
    }
    if (panel_min_widths.length){
        this.layout.min_width = Math.max.apply(null, panel_min_widths);
    }
    if (panel_min_heights.length){
        this.layout.min_height = panel_min_heights.reduce(function(a,b){ return a+b; });
    }
    if (this.layout.width < this.layout.min_width || this.layout.height < this.layout.min_height){
        this.setDimensions(Math.max(this.layout.width, this.layout.min_width),
                           Math.max(this.layout.height, this.layout.min_height));
        return;
    }

    // Next set proportional and discrete heights of panels
    var proportional_height = 1 / Object.keys(this.panels).length;
    var discrete_height = this.layout.height * proportional_height;
    var panel_idx = 0;
    for (id in this.panels){
        this.panels[id].layout.proportional_height = proportional_height;
        this.panels[id].setOrigin(0, panel_idx * discrete_height);
        this.panels[id].setDimensions(this.layout.width, discrete_height);
        panel_idx++;
    }

};

// Create all instance-level objects, initialize all child panels
LocusZoom.Instance.prototype.initialize = function(){

    // Create required layers
    this.createMouseGuidesLayer();
    this.createUILayer();
    this.createCurtainLayer();

    // Create optional layers and elements
    if (this.show_controls){
        this.createControls();
    }

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

// Create a "controls" area adjacent to the SVG in the DOM for instance-level HTML control elements
LocusZoom.Instance.prototype.createControls = function(){
    var controls_div = d3.select(this.svg.node().parentNode).append("div")
        .attr("class", "lz-locuszoom-controls").attr("id", this.id + ".controls");
    this.controls = {
        div: controls_div,
        parent: this,
        svg_changed: true,
        initialize: function(){
            // Links
            this.links = this.div.append("div")
                .attr("id", this.parent.id + ".controls.links")
                .style("float", "left");
            // Download SVG button
            this.download_svg_button = this.links.append("a")
                .attr("class", "lz-controls-button")
                .attr("href-lang", "image/svg+xml")
                .attr("title", "Download SVG as locuszoom.svg")
                .attr("download", "locuszoom.svg")
                .text("Download SVG")
                .on("mouseover", function() {
                    if (this.svg_changed){
                        this.download_svg_button
                            .attr("class", "lz-controls-button-disabled")
                            .text("Preparing SVG");
                        this.generateBase64SVG().then(function(base64_string){
                            this.download_svg_button.attr("href", "data:image/svg+xml;base64,\n" + base64_string);
                            this.download_svg_button
                                .attr("class", "lz-controls-button")
                                .text("Download SVG");
                            this.svg_changed = false;
                        }.bind(this));
                    }
                }.bind(this));
            // Dimensions
            this.dimensions = this.div.append("div")
                .attr("class", "lz-controls-info")
                .attr("id", this.parent.id + ".controls.dimensions")
                .style("float", "right");
            // Clear
            this.clear = this.div.append("div")
                .attr("id", this.parent.id + ".controls.clear")
                .style("clear", "both");
            // Cache the contents of the LocusZoom stylesheet in a string for use in updating download links
            this.css_string = "";
            for (var stylesheet in Object.keys(document.styleSheets)){
                if (   document.styleSheets[stylesheet].cssRules.length
                    && document.styleSheets[stylesheet].cssRules[0].cssText != "undefined"
                    && document.styleSheets[stylesheet].cssRules[0].cssText.indexOf(".lz-locuszoom") == 0){
                    for (var rule in document.styleSheets[stylesheet].cssRules){
                        if (typeof document.styleSheets[stylesheet].cssRules[rule].cssText != "undefined"){
                            this.css_string += document.styleSheets[stylesheet].cssRules[rule].cssText + " ";
                        }
                    }
                    break;
                }
            }
            // Render all controls elements
            this.render();
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
        },
        render: function(){
            this.div.attr("width", this.parent.view.width);
            this.dimensions.text(this.parent.view.width + "px × " + this.parent.view.height + "px");
        }
    };
    this.controls.initialize();
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
            // Render all UI elements
            this.render();
        },
        render: function(){
            this.resize_handle
                .attr("transform", "translate(" + (this.parent.layout.width - 17) + ", " + (this.parent.layout.height - 17) + ")");
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
    for (var id in this.panels){
        this.remap_promises.push(this.panels[id].reMap());
    }

    // When all finished update download SVG link
    Q.all(this.remap_promises).then(function(){
        if (this.parent.show_controls){
            this.controls.setBase64SVG();
        }
    }.bind(this), function(error){
        console.log(error);
        this.curtain.drop(error);
    }.bind(this));

    return this;
    
};

// Refresh an instance's data from sources without changing position
LocusZoom.Instance.prototype.refresh = function(){
    this.mapTo(this.state.chr, this.state.start, this.state.end);
};
