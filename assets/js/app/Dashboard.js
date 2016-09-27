/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Dashboard

  A dashboard is an HTML-based (read: not SVG-based) collection of components used to
  display information or provide user interface. Dashboards can exist on entire plots,
  where their visiblity is permanent and vertically adjacent to the plot, or on individual
  panels, where their visiblity is tied to a behavior (e.g. a mouseover) and is as an overlay.

*/

LocusZoom.Dashboard = function(parent){

    // parent must be a locuszoom plot or panel
    if (!(parent instanceof LocusZoom.Instance) && !(parent instanceof LocusZoom.Panel)){
        throw "Unable to create dashboard, parent must be a locuszoom plot or panel";
    }
    this.parent = parent;
    this.id = this.parent.getBaseId() + ".dashboard";

    this.type = (this.parent instanceof LocusZoom.Instance) ? "plot" : "panel";

    this.selector = null;
    this.components = [];
    this.hide_timeout = null;

    return this.initialize();

};

LocusZoom.Dashboard.prototype.initialize = function(){

    // Parse layout to generate component instances
    if (Array.isArray(this.parent.layout.dashboard.components)){
        this.parent.layout.dashboard.components.forEach(function(layout){
            try {
                var component = LocusZoom.Dashboard.Components.get(layout.type, layout, this);
                this.components.push(component);
            } catch (e) {
                console.warn(e);
            }
        }.bind(this));
    }

    // Add mouseover event handlers to show/hide panel dashboard
    if (this.type == "panel"){
        d3.select(this.parent.parent.svg.node().parentNode).on("mouseover." + this.id, function(){
            clearTimeout(this.hide_timeout);
            this.show();
        }.bind(this));
        d3.select(this.parent.parent.svg.node().parentNode).on("mouseout." + this.id, function(){
            this.hide_timeout = setTimeout(function(){
                this.hide();
            }.bind(this), 300);
        }.bind(this));
    }

    return this;

};

// Return a boolean describing whether the dashboard has anything to display or not
LocusZoom.Dashboard.prototype.isEmpty = function(){
    return Boolean(this.components.length);
};

// Populate selector and display dashboard, recursively show components
LocusZoom.Dashboard.prototype.show = function(){

    if (this.selector){ return this.update(); }

    switch (this.type){
    case "plot":
        this.selector = d3.select(this.parent.svg.node().parentNode)
            .insert("div",":first-child");
        break;
    case "panel":
        this.selector = d3.select(this.parent.parent.svg.node().parentNode)
            .insert("div", ".lz-data_layer-tooltip").classed("lz-panel-dashboard", true);
        break;
    }

    this.selector.classed("lz-dashboard", true).classed("lz-"+this.type+"-dashboard", true).attr("id", this.id);
    this.components.forEach(function(component){ component.show(); });

    return this.update();
};

// Update self and all components
LocusZoom.Dashboard.prototype.update = function(){
    if (!this.selector){ return this; }
    this.components.forEach(function(component){ component.update(); });
    return this.position();
};

// Position self (panel only)
LocusZoom.Dashboard.prototype.position = function(){
    if (!this.selector || this.type == "plot"){ return this; }
    var page_origin = this.parent.getPageOrigin();
    var client_rect = this.selector.node().getBoundingClientRect();
    var top = page_origin.y.toString() + "px";
    var left = (page_origin.x + this.parent.layout.width - client_rect.width).toString() + "px";
    this.selector.style({ position: "absolute", top: top, left: left });
    return this;
};

// Hide self
LocusZoom.Dashboard.prototype.hide = function(){
    if (!this.selector){ return this; }

    /*
    // Do not hide if any components are in a persistive state
    var persist = false;
    this.components.forEach(function(component){
        persist = persist || component.persist;
    });
    if (persist){ return this; }
    */

    // Do not hide if actively in an instance-level drag event
    if (this.parent.parent.ui.dragging || this.parent.parent.panel_boundaries.dragging){ return this; }
    // Hide all components
    this.components.forEach(function(component){ component.hide(); });
    // Remove the dashboard element from the DOM
    this.selector.remove();
    this.selector = null;
    return this;

};


/************************
  Dashboard Components

  ...
*/

LocusZoom.Dashboard.Component = function(layout, parent) {
    this.layout = layout || {};
    this.parent = parent || null;
    this.parent_panel = null;
    this.parent_plot = null;
    this.parent_svg = null;
    if (this.parent instanceof LocusZoom.Dashboard){
        if (this.parent.type == "panel"){
            this.parent_panel = this.parent.parent;
            this.parent_plot = this.parent.parent.parent;
            this.parent_svg = this.parent_panel;
        } else {
            this.parent_plot = this.parent.parent;
            this.parent_svg = this.parent_plot;
        }
    }
    this.selector = null;
    this.button = null;
    if (!this.layout.position){ this.layout.position = "left"; }
    return this;
};
LocusZoom.Dashboard.Component.prototype.show = function(){
    if (!this.parent || !this.parent.selector){ return; }
    this.selector = this.parent.selector.append("div")
        .attr("class", "lz-dashboard-" + this.layout.position);
    return this.update();
};
LocusZoom.Dashboard.Component.prototype.update = function(){ return this; };
LocusZoom.Dashboard.Component.prototype.persist = function(){ return false; };
LocusZoom.Dashboard.Component.prototype.hide = function(){
    if (!this.persist()){
        this.button = null;
        this.selector.remove();
        this.selector = null;
    }
};

LocusZoom.Dashboard.Components = (function() {
    var obj = {};
    var components = {};

    obj.get = function(name, layout, parent) {
        if (!name) {
            return null;
        } else if (components[name]) {
            if (typeof layout != "object"){
                throw("invalid layout argument for dashboard component [" + name + "]");
            } else {
                return new components[name](layout, parent);
            }
        } else {
            throw("dashboard component [" + name + "] not found");
        }
    };

    obj.set = function(name, component) {
        if (component) {
            if (typeof component != "function"){
                throw("unable to set dashboard component [" + name + "], argument provided is not a function");
            } else {
                components[name] = component;
                components[name].prototype = new LocusZoom.Dashboard.Component();
            }
        } else {
            delete components[name];
        }
    };

    obj.add = function(name, component) {
        if (components[name]) {
            throw("dashboard component already exists with name: " + name);
        } else {
            obj.set(name, component);
        }
    };

    obj.list = function() {
        return Object.keys(components);
    };

    return obj;
})();

/**

  LocusZoom.Dashboard.Component.Button Class

  Plots and panels may have a "dashboard" element suited for showing HTML components that may be interactive.
  When components need to incoroprate a generic button, or additionally a button that generates a menu, this
  class provides much of the necessary framework.

*/

LocusZoom.Dashboard.Component.Button = function(parent) {   
    
    if (!(parent instanceof LocusZoom.Dashboard.Component)){
        throw "Unable to create dashboard component button, invalid parent";
    }
    this.parent = parent;
    this.parent_panel = this.parent.parent_panel;
    this.parent_plot = this.parent.parent_plot;
    this.parent_svg = this.parent.parent_svg;
    this.parent_dashboard = this.parent.parent;

    this.showing = false;
    this.persist = false;
    this.selector = null;

    // Tag dashboard
    this.tag = "button";
    this.setTag = function(tag){
        if (typeof tag != "undefined"){ this.tag = tag.toString(); }
        return this;
    };

    // HTML dashboard
    this.text = "";
    this.setText = function(text){
        if (typeof text != "undefined"){ this.text = text.toString(); }
        return this;
    };

    // Title dashboard (HTML built-in tool tip)
    this.title = "";
    this.setTitle = function(title){
        if (typeof title != "undefined"){ this.title = title.toString(); }
        return this;
    };

    // Color dashboard (using predefined CSS classes as opposed to styles)
    this.color = "gray";
    this.setColor = function(color){
        if (typeof color != "undefined"){
            if (["gray", "red", "orange", "yellow", "blue", "purple"].indexOf(color) !== -1){ this.color = color; }
            else { this.color = "gray"; }
        }
        return this;
    };

    // Style dashboard
    this.style = {};
    this.setStyle = function(style){
        if (typeof style != "undefined"){ this.style = style; }
        return this;
    };

    // Permanance dashboard
    this.permanent = false;
    this.setPermanent = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        this.permanent = bool;
        if (this.permanent){ this.persist = true; }
        return this;
    };

    // Status dashboard (highlighted / disabled)
    this.status = "";
    this.setStatus = function(status){
        if (typeof status != "undefined" && ["", "highlighted", "disabled"].indexOf(status) !== -1){ this.status = status; }
        return this.update();
    };
    this.highlight = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("highlighted"); }
        else if (this.status == "highlighted"){ return this.setStatus(""); }
        return this;
    };
    this.disable = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("disabled"); }
        else if (this.status == "disabled"){ return this.setStatus(""); }
        return this;
    };

    // Mouse event dashboard
    this.onmouseover = function(){};
    this.setOnMouseover = function(onmouseover){
        if (typeof onmouseover == "function"){ this.onmouseover = onmouseover; }
        else { this.onmouseover = function(){}; }
        return this;
    };
    this.onmouseout = function(){};
    this.setOnMouseout = function(onmouseout){
        if (typeof onmouseout == "function"){ this.onmouseout = onmouseout; }
        else { this.onmouseout = function(){}; }
        return this;
    };
    this.onclick = function(){};
    this.setOnclick = function(onclick){
        if (typeof onclick == "function"){ this.onclick = onclick; }
        else { this.onclick = function(){}; }
        return this;
    };
    
    // Primary behavior functions
    this.show = function(){
        if (!this.parent){ return; }
        if (!this.showing){
            this.selector = this.parent.selector.append(this.tag)
                .attr("class", "lz-dashboard-button");
            this.showing = true;
        }
        return this.update();
    };
    this.preUpdate = function(){ return this; };
    this.update = function(){
        if (!this.showing){ return this; }
        this.preUpdate();
        this.selector
            .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.color + (this.status ? "-" + this.status : ""))
            .attr("title", this.title).style(this.style)
            .on("mouseover", (this.status == "disabled") ? null : this.onmouseover)
            .on("mouseout", (this.status == "disabled") ? null : this.onmouseout)
            .on("click", (this.status == "disabled") ? null : this.onclick)
            .text(this.text);
        if (this.menu.enabled){ this.menu.update(); }
        this.postUpdate();
        return this;
    };
    this.postUpdate = function(){ return this; };
    this.hide = function(){
        if (this.showing && !this.persist){
            this.selector.remove();
            this.selector = null;
            this.showing = false;
        }
        return this;
    };    

    // Menu object and dashboard
    this.menu = {
        outer_selector: null,
        inner_selector: null,
        showing: false,
        enabled: false
    };
    this.menu.show = function(){
        if (this.menu.showing){ return this; }
        this.menu.outer_selector = d3.select(this.parent_plot.svg.node().parentNode).append("div")
            .attr("class", "lz-dashboard-menu lz-dashboard-menu-" + this.color)
            .attr("id", this.parent_svg.getBaseId() + ".dashboard.menu");
        this.menu.inner_selector = this.menu.outer_selector.append("div")
            .attr("class", "lz-dashboard-menu-content");
        this.menu.showing = true;
        return this.menu.update();
    }.bind(this);
    this.menu.update = function(){
        if (!this.menu.showing){ return this.menu; }
        this.menu.populate(); // This is the custom part
        return this.menu.position();
    }.bind(this);
    this.menu.position = function(){
        if (!this.menu.showing){ return this.menu; }
        var padding = 3;
        var scrollbar_padding = 20;
        var page_origin = this.parent_svg.getPageOrigin();
        var dashboard_client_rect = this.parent_dashboard.selector.node().getBoundingClientRect();
        var menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
        var total_content_height = this.menu.inner_selector.node().scrollHeight;
        var top = (page_origin.y + dashboard_client_rect.height + padding).toString() + "px";
        var left = Math.max(page_origin.x + this.parent_svg.layout.width - menu_client_rect.width - padding, page_origin.x + padding).toString() + "px";
        var base_max_width = Math.max(this.parent_svg.layout.width - (2 * padding) - scrollbar_padding, scrollbar_padding);
        var container_max_width = base_max_width.toString() + "px";
        var content_max_width = (base_max_width - (4 * padding)).toString() + "px";
        var base_max_height = (this.parent_svg.layout.height - (7 * padding) - dashboard_client_rect.height);
        var height = Math.min(total_content_height, base_max_height).toString() + "px";
        var max_height = base_max_height.toString() + "px";
        this.menu.outer_selector.style({
            top: top, left: left,
            "max-width": container_max_width,
            "max-height": max_height,
            height: height
        });
        this.menu.inner_selector.style({ "max-width": content_max_width });        
        return this.menu;
    }.bind(this);
    this.menu.hide = function(){
        if (!this.menu.showing){ return this.menu; }
        this.menu.inner_selector.remove();
        this.menu.outer_selector.remove();
        this.menu.inner_selector = null;
        this.menu.outer_selector = null;
        this.menu.showing = false;
        return this.menu;
    }.bind(this);
    // By convention populate() does nothing and should be reimplemented with each dashboard button definition
    // Reimplement by way of Dashboard.Component.Button.setMenuPopulate to define the populate method and hook up standard menu
    // click-toggle behaviorprototype.
    this.menu.populate = function(){
        this.menu.inner_selector.html("...");
    }.bind(this);
    this.setMenuPopulate = function(menu_populate_function){
        if (typeof menu_populate_function == "function"){
            this.menu.populate = menu_populate_function;
            this.setOnclick(function(){
                if (!this.menu.showing){
                    this.menu.show();
                    this.highlight().update();
                    this.persist = true;
                } else {
                    this.menu.hide();
                    this.highlight(false).update();
                    if (!this.permanent){
                        this.persist = false;
                    }
                }
            }.bind(this));
            this.menu.enabled = true;
        } else {
            this.setOnclick();
            this.menu.enabled = false;
        }
        return this;
    };

};

// Title component - show a generic title
LocusZoom.Dashboard.Components.add("title", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.show = function(){
        this.selector = this.parent.selector.append("div")
            .attr("class", "lz-dashboard-title lz-dashboard-" + this.layout.position);
        return this.update();
    };
    this.update = function(){
        this.selector.text(layout.title);
        return this;
    };
});

// Dimensions component - show current dimensions of the plot
LocusZoom.Dashboard.Components.add("dimensions", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        var display_width = this.parent_plot.layout.width.toString().indexOf(".") == -1 ? this.parent_plot.layout.width : this.parent_plot.layout.width.toFixed(2);
        var display_height = this.parent_plot.layout.height.toString().indexOf(".") == -1 ? this.parent_plot.layout.height : this.parent_plot.layout.height.toFixed(2);
        this.selector.text(display_width + "px × " + display_height + "px");
        return this;
    };
});

// Region Scale component - show the size of the region in state
LocusZoom.Dashboard.Components.add("region_scale", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (!isNaN(this.parent_plot.state.start) && !isNaN(this.parent_plot.state.end)
            && this.parent_plot.state.start != null && this.parent_plot.state.end != null){
            this.selector.style("display", null);
            this.selector.text(LocusZoom.positionIntToString(this.parent_plot.state.end - this.parent_plot.state.start, null, true));
        } else {
            this.selector.style("display", "none");
        }
        return this;
    };
});

// Download SVG component - button to export current plot to an SVG
LocusZoom.Dashboard.Components.add("download_svg", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setTag("a").setColor(layout.color).setText("Download SVG").setTitle("Download SVG as locuszoom.svg")
            .setOnMouseover(function() {
                this.button.selector
                    .classed("lz-dashboard-button-gray-disabled", true)
                    .text("Preparing SVG");
                this.generateBase64SVG().then(function(base64_string){
                    this.button.selector
                        .attr("href", "data:image/svg+xml;base64,\n" + base64_string)
                        .classed("lz-dashboard-button-gray-disabled", false)
                        .classed("lz-dashboard-button-gray-highlighted", true)
                        .text("Download SVG");
                }.bind(this));
            }.bind(this))
            .setOnMouseout(function() {
                this.button.selector.classed("lz-dashboard-button-gray-highlighted", false);
            }.bind(this));
        this.button.show();
        this.button.selector.attr("href-lang", "image/svg+xml").attr("download", "locuszoom.svg");
        return this;
    };
    this.css_string = "";
    for (var stylesheet in Object.keys(document.styleSheets)){
        if ( document.styleSheets[stylesheet].href != null
             && document.styleSheets[stylesheet].href.indexOf("locuszoom.css") != -1){
            LocusZoom.createCORSPromise("GET", document.styleSheets[stylesheet].href)
                .then(function(response){
                    this.css_string = response.replace(/[\r\n]/g," ");
                }.bind(this));
            break;
        }
    } 
    this.generateBase64SVG = function(){
        return Q.fcall(function () {
            // Insert a hidden div, clone the node into that so we can modify it with d3
            var container = this.parent.selector.append("div").style("display", "none")
                .html(this.parent_plot.svg.node().outerHTML);
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
});

// Remove Panel component - button to remove panel from plot
LocusZoom.Dashboard.Components.add("remove_panel", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("×").setTitle("Remove panel")
            .setOnclick(function(){
                var panel = this.parent_panel;
                panel.dashboard.hide(true);
                d3.select(panel.parent.svg.node().parentNode).on("mouseover." + panel.getBaseId() + ".dashboard", null);
                d3.select(panel.parent.svg.node().parentNode).on("mouseout." + panel.getBaseId() + ".dashboard", null);
                panel.parent.removePanel(panel.id);
            }.bind(this));
        this.button.show();
        return this;
    };
});

// Move Panel Up
LocusZoom.Dashboard.Components.add("move_panel_up", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){
            var is_at_top = (this.parent_panel.layout.y_index == 0);
            this.button.disable(is_at_top);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("▴").setTitle("Move panel up")
            .setOnclick(function(){
                var panel = this.parent.parent;
                var plot = this.parent.parent.parent;
                if (plot.panel_ids_by_y_index[panel.layout.y_index - 1]){
                    plot.panel_ids_by_y_index[panel.layout.y_index] = plot.panel_ids_by_y_index[panel.layout.y_index - 1];
                    plot.panel_ids_by_y_index[panel.layout.y_index - 1] = panel.id;
                    plot.applyPanelYIndexesToPanelLayouts();
                    plot.positionPanels();
                }
                this.update();
            }.bind(this));
        this.button.show();
        return this.update();
    };
});

// Move Panel Down
LocusZoom.Dashboard.Components.add("move_panel_down", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){
            var is_at_bottom = (this.parent_panel.layout.y_index == this.parent_plot.panel_ids_by_y_index.length-1);
            this.button.disable(is_at_bottom);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("▾").setTitle("Move panel down")
            .setOnclick(function(){
                var panel = this.parent.parent;
                var plot = this.parent.parent.parent;
                if (plot.panel_ids_by_y_index[panel.layout.y_index + 1]){
                    plot.panel_ids_by_y_index[panel.layout.y_index] = plot.panel_ids_by_y_index[panel.layout.y_index + 1];
                    plot.panel_ids_by_y_index[panel.layout.y_index + 1] = panel.id;
                    plot.applyPanelYIndexesToPanelLayouts();
                    plot.positionPanels();
                }
                this.update();
            }.bind(this));
        this.button.show();
        return this.update();
    };
});

// Remove Panel component - button to remove panel from plot
LocusZoom.Dashboard.Components.add("menu", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.button.menu.populate();
            }.bind(this));
        this.button.setMenuPopulate(function(){
            this.button.menu.inner_selector.html(layout.menu_html);
        }.bind(this));
        this.button.show();
        return this;
    };
});
