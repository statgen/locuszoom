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
        this.controls.render();
        this.stackPanels();
    }
    return this;
};

// Create a new panel by panel class
LocusZoom.Instance.prototype.addPanel = function(PanelClass){
    if (typeof PanelClass !== "function"){
        return false;
    }
    var panel = new PanelClass();
    panel.parent = this;
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
                this.parent.controls.setBase64SVG();
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

    // Create an HTML div for top-level instance controls below the instance (adjacent in the DOM)
    var controls_div = d3.select(this.svg.node().parentNode).append("div")
        .attr("class", "lz-locuszoom-controls").attr("id", this.id + ".controls");
    this.controls = {
        div: controls_div,
        parent: this,
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
                .text("Download SVG");
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
        setBase64SVG: function(){
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
            var insert_at = initial_html.indexOf('>') + 1;
            initial_html = initial_html.slice(0,insert_at) + style_def + initial_html.slice(insert_at);
            // Delete the container node
            container.remove();      
            // Base64-encode the string
            var base64_svg = btoa(encodeURIComponent(initial_html).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
            // Apply Base64-encoded string to the download button's href
            this.download_svg_button.attr("href", "data:image/svg+xml;base64,\n" + base64_svg);
        },
        render: function(){
            this.div.attr("width", this.parent.view.width);
            this.dimensions.text(this.parent.view.width + "px × " + this.parent.view.height + "px");
        }
    };
    this.controls.initialize();

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

