/* global d3,Q,LocusZoom */
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
    if (!(parent instanceof LocusZoom.Plot) && !(parent instanceof LocusZoom.Panel)){
        throw "Unable to create dashboard, parent must be a locuszoom plot or panel";
    }
    this.parent = parent;
    this.id = this.parent.getBaseId() + ".dashboard";

    this.type = (this.parent instanceof LocusZoom.Plot) ? "plot" : "panel";

    this.selector = null;
    this.components = [];
    this.hide_timeout = null;
    this.persist = false;

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

LocusZoom.Dashboard.prototype.shouldPersist = function(){
    if (this.persist){ return true; }
    var persist = false;
    // Persist if at least one component should also persist
    this.components.forEach(function(component){
        persist = persist || component.shouldPersist();
    });
    // Persist if in a parent drag event
    if (this.type == "plot"){
        persist = persist || this.parent.panel_boundaries.dragging;
    } else {
        persist = persist || (!!this.parent.parent.panel_boundaries.dragging || !!this.parent.interactions.dragging);
    }
    return persist;
};

// Populate selector and display dashboard, recursively show components
LocusZoom.Dashboard.prototype.show = function(){
    if (!this.selector){
        switch (this.type){
        case "plot":
            this.selector = d3.select(this.parent.svg.node().parentNode)
                .insert("div",":first-child");
            break;
        case "panel":
            this.selector = d3.select(this.parent.parent.svg.node().parentNode)
                .insert("div", ".lz-data_layer-tooltip, .lz-dashboard-menu, .lz-curtain").classed("lz-panel-dashboard", true);
            break;
        }
        this.selector.classed("lz-dashboard", true).classed("lz-"+this.type+"-dashboard", true).attr("id", this.id);
    }
    this.components.forEach(function(component){ component.show(); });
    this.selector.style({ visibility: "visible" });
    return this.update();
};

// Update self and all components
LocusZoom.Dashboard.prototype.update = function(){
    if (!this.selector){ return this; }
    this.components.forEach(function(component){ component.update(); });
    return this.position();
};

// Position self
LocusZoom.Dashboard.prototype.position = function(){
    if (!this.selector){ return this; }
    // Position the dashboard itself (panel only)
    if (this.type == "panel"){
        var page_origin = this.parent.getPageOrigin();
        var client_rect = this.selector.node().getBoundingClientRect();
        var top = (page_origin.y + 3).toString() + "px";
        var left = (page_origin.x + this.parent.layout.width - client_rect.width).toString() + "px";
        this.selector.style({ position: "absolute", top: top, left: left });
    }
    // Recursively position components
    this.components.forEach(function(component){ component.position(); });
    return this;
};

// Hide self - make invisible but do not destroy
// Exempt when dashboard should persist
LocusZoom.Dashboard.prototype.hide = function(){
    if (!this.selector || this.shouldPersist()){ return this; }
    this.components.forEach(function(component){ component.hide(); });
    this.selector.style({ visibility: "hidden" });
    return this;
};

// Completely remove dashboard
LocusZoom.Dashboard.prototype.destroy = function(force){
    if (typeof force == "undefined"){ force = false; }
    if (!this.selector){ return this; }
    if (this.shouldPersist() && !force){ return this; }
    this.components.forEach(function(component){ component.destroy(true); });
    this.components = [];
    this.selector.remove();
    this.selector = null;
    return this;

};


/************************
  Dashboard Components

  A dashboard component is an empty div rendered on a dashboard that can display custom
  text of user interface elements. LocusZoom.Dashboard.Components is a singleton used to
  define and manage an extendable collection of dashboard components.
  (e.g. by LocusZoom.Dashboard.Components.add())

*/

LocusZoom.Dashboard.Component = function(layout, parent) {

    this.layout = layout || {};
    if (!this.layout.color){ this.layout.color = "gray"; }

    this.parent = parent || null;
    this.parent_panel = null;
    this.parent_plot = null;
    this.parent_svg = null; // This is a reference to either the panel or the plot, depending on what the dashboard is
                            // tied to. Useful when absolutely positioning dashboard components relative to their SVG anchor.
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
    this.button  = null;  // There is a 1-to-1 relationship of dashboard component to button
    this.persist = false; // Persist booleans will bubble up to prevent any automatic
                          // hide behavior on a component's parent dashboard
    if (!this.layout.position){ this.layout.position = "left"; }

    return this;
};
LocusZoom.Dashboard.Component.prototype.show = function(){
    if (!this.parent || !this.parent.selector){ return; }
    if (!this.selector){
        this.selector = this.parent.selector.append("div")
            .attr("class", "lz-dashboard-" + this.layout.position);
        if (typeof this.initialize == "function"){ this.initialize(); }
    }
    if (this.button && this.button.status == "highlighted"){ this.button.menu.show(); }
    this.selector.style({ visibility: "visible" });
    this.update();
    return this.position();
};
LocusZoom.Dashboard.Component.prototype.update = function(){ /* stub */ };
LocusZoom.Dashboard.Component.prototype.position = function(){
    if (this.button){ this.button.menu.position(); }
    return this;
};
LocusZoom.Dashboard.Component.prototype.shouldPersist = function(){
    if (this.persist){ return true; }
    if (this.button && this.button.persist){ return true; }
    return false;
};
LocusZoom.Dashboard.Component.prototype.hide = function(){
    if (!this.selector || this.shouldPersist()){ return this; }
    if (this.button){ this.button.menu.hide(); }
    this.selector.style({ visibility: "hidden" });
    return this;
};
LocusZoom.Dashboard.Component.prototype.destroy = function(force){
    if (typeof force == "undefined"){ force = false; }
    if (!this.selector){ return this; }
    if (this.shouldPersist() && !force){ return this; }
    if (this.button && this.button.menu){ this.button.menu.destroy(); }
    this.selector.remove();
    this.selector = null;
    this.button = null;
    return this;
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

    this.selector = null;

    // Tag to use for the button (default: a)
    this.tag = "a";
    this.setTag = function(tag){
        if (typeof tag != "undefined"){ this.tag = tag.toString(); }
        return this;
    };

    // Text for the button to show
    this.text = "";
    this.setText = function(text){
        if (typeof text != "undefined"){ this.text = text.toString(); }
        return this;
    };

    // Title for the button to show
    this.title = "";
    this.setTitle = function(title){
        if (typeof title != "undefined"){ this.title = title.toString(); }
        return this;
    };

    // Color of the button
    this.color = "gray";
    this.setColor = function(color){
        if (typeof color != "undefined"){
            if (["gray", "red", "orange", "yellow", "green", "blue", "purple"].indexOf(color) !== -1){ this.color = color; }
            else { this.color = "gray"; }
        }
        return this;
    };

    // Arbitrary button styles
    this.style = {};
    this.setStyle = function(style){
        if (typeof style != "undefined"){ this.style = style; }
        return this;
    };

    // Permanance
    this.persist = false;
    this.permanent = false;
    this.setPermanent = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        this.permanent = bool;
        if (this.permanent){ this.persist = true; }
        return this;
    };
    this.shouldPersist = function(){
        return this.permanent || this.persist;
    };

    // Button status (highlighted / disabled)
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

    // Mouse events
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
        if (!this.selector){
            this.selector = this.parent.selector.append(this.tag)
                .attr("class", "lz-dashboard-button");
        }
        return this.update();
    };
    this.preUpdate = function(){ return this; };
    this.update = function(){
        if (!this.selector){ return this; }
        this.preUpdate();
        this.selector
            .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.color + (this.status ? "-" + this.status : ""))
            .attr("title", this.title).style(this.style)
            .on("mouseover", (this.status == "disabled") ? null : this.onmouseover)
            .on("mouseout", (this.status == "disabled") ? null : this.onmouseout)
            .on("click", (this.status == "disabled") ? null : this.onclick)
            .text(this.text);
        this.menu.update();
        this.postUpdate();
        return this;
    };
    this.postUpdate = function(){ return this; };
    this.hide = function(){
        if (this.selector && !this.shouldPersist()){
            this.selector.remove();
            this.selector = null;
        }
        return this;
    };    

    // Button Menu Object
    // The menu is an HTML overlay that can appear below a button. It can contain arbitrary HTML and
    // has logic to be automatically positioned and sized to behave more or less like a dropdown menu.
    this.menu = {
        outer_selector: null,
        inner_selector: null,
        show: function(){
            if (!this.menu.outer_selector){
                this.menu.outer_selector = d3.select(this.parent_plot.svg.node().parentNode).append("div")
                    .attr("class", "lz-dashboard-menu lz-dashboard-menu-" + this.color)
                    .attr("id", this.parent_svg.getBaseId() + ".dashboard.menu");
                this.menu.inner_selector = this.menu.outer_selector.append("div")
                    .attr("class", "lz-dashboard-menu-content");
            }
            this.menu.outer_selector.style({ visibility: "visible" });
            return this.menu.update();
        }.bind(this),
        update: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.populate(); // This function is stubbed for all buttons by default and custom implemented in component definition
            return this.menu.position();
        }.bind(this),
        position: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            var padding = 3;
            var scrollbar_padding = 20;
            var page_origin = this.parent_svg.getPageOrigin();
            var dashboard_client_rect = this.parent_dashboard.selector.node().getBoundingClientRect();
            var button_client_rect = this.selector.node().getBoundingClientRect();
            var menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
            var total_content_height = this.menu.inner_selector.node().scrollHeight;
            var top = 0; var left = 0;
            if (this.parent_dashboard.type == "panel"){
                top = (page_origin.y + dashboard_client_rect.height + (3 * padding)).toString() + "px";
                left = Math.max(page_origin.x + this.parent_svg.layout.width - menu_client_rect.width - padding, page_origin.x + padding).toString() + "px";
            } else {
                top = (button_client_rect.bottom + padding).toString() + "px";
                left = Math.max(page_origin.x + this.parent_svg.layout.width - menu_client_rect.width, page_origin.x + padding).toString() + "px";
            }
            var base_max_width = Math.max(this.parent_svg.layout.width - (2 * padding) - scrollbar_padding, scrollbar_padding);
            var container_max_width = base_max_width.toString() + "px";
            var content_max_width = (base_max_width - (4 * padding)).toString() + "px";
            var base_max_height = (this.parent_svg.layout.height - (7 * padding));
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
        }.bind(this),
        hide: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.outer_selector.style({ visibility: "hidden" });
            return this.menu;
        }.bind(this),
        destroy: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.inner_selector.remove();
            this.menu.outer_selector.remove();
            this.menu.inner_selector = null;
            this.menu.outer_selector = null;
            return this.menu;
        }.bind(this),
        // By convention populate() does nothing and should be reimplemented with each dashboard button definition
        // Reimplement by way of Dashboard.Component.Button.menu.setPopulate to define the populate method and hook up standard menu
        // click-toggle behaviorprototype.
        populate: function(){ /* stub */ }.bind(this),
        setPopulate: function(menu_populate_function){
            if (typeof menu_populate_function == "function"){
                this.menu.populate = menu_populate_function;
                this.setOnclick(function(){
                    if (!this.menu.outer_selector){
                        this.menu.show();
                        this.highlight().update();
                        this.persist = true;
                    } else {
                        this.menu.hide();
                        this.highlight(false).update();
                        if (!this.permanent){ this.persist = false; }
                    }
                }.bind(this));
            } else {
                this.setOnclick();
            }
            return this;
        }.bind(this)
    };

};

// Title component - show a generic title
LocusZoom.Dashboard.Components.add("title", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.show = function(){
        this.div_selector = this.parent.selector.append("div")
            .attr("class", "lz-dashboard-title lz-dashboard-" + this.layout.position);
        this.title_selector = this.div_selector.append("h3");
        return this.update();
    };
    this.update = function(){
        var title = layout.title.toString();
        if (this.layout.subtitle){ title += " <small>" + this.layout.subtitle + "</small>"; }
        this.title_selector.html(title);
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

// Download component - button to export current plot to an SVG image
LocusZoom.Dashboard.Components.add("download", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("Download Image").setTitle("Download image of the current plot as locuszoom.svg")
            .setOnMouseover(function() {
                this.button.selector
                    .classed("lz-dashboard-button-gray-disabled", true)
                    .text("Preparing Image");
                this.generateBase64SVG().then(function(base64_string){
                    this.button.selector
                        .attr("href", "data:image/svg+xml;base64,\n" + base64_string)
                        .classed("lz-dashboard-button-gray-disabled", false)
                        .classed("lz-dashboard-button-gray-highlighted", true)
                        .text("Download Image");
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
                    this.css_string = response.replace(/[\r\n]/g," ").replace(/\s+/g," ");
                    if (this.css_string.indexOf("/* ! LocusZoom HTML Styles */")){
                        this.css_string = this.css_string.substring(0, this.css_string.indexOf("/* ! LocusZoom HTML Styles */"));
                    }
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
            container.selectAll("g.lz-mouse_guide").remove();
            // Convert units on axis tick dy attributes from ems to pixels
            container.selectAll("g.tick text").each(function(){
                var dy = +(d3.select(this).attr("dy").substring(-2).slice(0,-2))*10;
                d3.select(this).attr("dy", dy);
            });
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
    };
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
                this.parent_panel.moveUp();
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
                this.parent_panel.moveDown();
                this.update();
            }.bind(this));
        this.button.show();
        return this.update();
    };
});

// Menu component - button to display a menu showing arbitrary HTML
LocusZoom.Dashboard.Components.add("menu", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.button.menu.populate();
            }.bind(this));
        this.button.menu.setPopulate(function(){
            this.button.menu.inner_selector.html(layout.menu_html);
        }.bind(this));
        this.button.show();
        return this;
    };
});

// Model covariates component - special button/menu to allow model building by individual covariants
LocusZoom.Dashboard.Components.add("covariates_model", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);

    this.initialize = function(){
        // Initialize state.model.covariates
        this.parent_plot.state.model = this.parent_plot.state.model || {};
        this.parent_plot.state.model.covariates = this.parent_plot.state.model.covariates || [];
        // Create an object at the plot level for easy access to interface methods in custom client-side JS
        this.parent_plot.CovariatesModel = {
            button: this,
            add: function(element){
                // Check if the element is already in the model covariates array. Do this with JSON.stringify since elements
                // may have functions that would trip up more basic equality checking
                for (var i = 0; i < this.state.model.covariates.length; i++) {
                    if (JSON.stringify(this.state.model.covariates[i]) === JSON.stringify(element)) {
                        return this;
                    }
                }
                this.state.model.covariates.push(element);
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            removeByIdx: function(idx){
                if (typeof this.state.model.covariates[idx] == "undefined"){
                    throw("Unable to remove model covariate, invalid index: " + idx.toString());
                }
                this.state.model.covariates.splice(idx, 1);
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            removeAll: function(){
                this.state.model.covariates = [];
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            updateComponent: function(){
                this.button.update();
                this.button.menu.update();
            }.bind(this)
        };
    }.bind(this);

    this.update = function(){

        if (this.button){ return this; }

        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.button.menu.populate();
            }.bind(this));

        this.button.menu.setPopulate(function(){
            var selector = this.button.menu.inner_selector;
            selector.html("");
            // General model HTML representation
            if (typeof this.parent_plot.state.model.html != "undefined"){
                selector.append("div").html(this.parent_plot.state.model.html);
            }
            // Model covariates table
            if (!this.parent_plot.state.model.covariates.length){
                selector.append("i").text("no covariates in model");
            } else {
                selector.append("h5").html("Model Covariates (" + this.parent_plot.state.model.covariates.length + ")");
                var table = selector.append("table");
                this.parent_plot.state.model.covariates.forEach(function(covariate, idx){
                    var html = covariate.toString();
                    if (typeof covariate == "object" && typeof covariate.toHTML == "function"){
                        html = covariate.toHTML();
                    }
                    var row = table.append("tr");
                    row.append("td").append("button")
                        .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.layout.color)
                        .style({ "margin-left": "0em" })
                        .on("click", function(){
                            this.parent_plot.CovariatesModel.removeByIdx(idx);
                        }.bind(this))
                        .text("×");
                    row.append("td").html(html);
                }.bind(this));
                selector.append("button")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.layout.color)
                    .style({ "margin-left": "4px" }).html("× Remove All Covariates")
                    .on("click", function(){
                        this.parent_plot.CovariatesModel.removeAll();
                    }.bind(this));
            }
        }.bind(this));

        this.button.preUpdate = function(){
            var text = "Model";
            if (this.parent_plot.state.model.covariates.length){
                var cov = this.parent_plot.state.model.covariates.length > 1 ? "covariates" : "covariate";
                text += " (" + this.parent_plot.state.model.covariates.length + " " + cov + ")";
            }
            this.button.setText(text).disable(false);
        }.bind(this);

        this.button.show();

        return this;
    };
});

// Toggle Split Tracks
LocusZoom.Dashboard.Components.add("toggle_split_tracks", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    if (!layout.data_layer_id){ layout.data_layer_id = "intervals"; }
    if (!this.parent_panel.data_layers[layout.data_layer_id]){
        throw ("Dashboard toggle split tracks component missing valid data layer ID");
    }
    this.update = function(){
        var data_layer = this.parent_panel.data_layers[layout.data_layer_id];
        var text = data_layer.layout.split_tracks ? "Merge Tracks" : "Split Tracks";
        if (this.button){
            this.button.setText(text);
            this.button.show();
            this.parent.position();
            return this;
        } else {
            this.button = new LocusZoom.Dashboard.Component.Button(this)
                .setColor(layout.color).setText(text)
                .setTitle("Toggle whether tracks are split apart or merged together")
                .setOnclick(function(){
                    data_layer.toggleSplitTracks();
                    if (this.scale_timeout){ clearTimeout(this.scale_timeout); }
                    this.scale_timeout = setTimeout(function(){
                        if (!data_layer.layout.split_tracks){ this.parent_panel.scaleHeightToData(); }
                    }.bind(this), +data_layer.layout.transition.duration || 0);
                    this.update();
                }.bind(this));
            return this.update();
        }
    };
});

// Resize to data
LocusZoom.Dashboard.Components.add("resize_to_data", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setText("Resize to Data")
            .setTitle("Automatically resize this panel to fit the data its currently showing")
            .setOnclick(function(){
                this.parent_panel.scaleHeightToData();
                this.update();
            }.bind(this));
        this.button.show();
        return this;
    };
});

// Toggle legend
LocusZoom.Dashboard.Components.add("toggle_legend", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        var text = this.parent_panel.legend.layout.hidden ? "Show Legend" : "Hide Legend";
        if (this.button){
            this.button.setText(text).show();
            this.parent.position();
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color)
            .setTitle("Show or hide the legend for this panel")
            .setOnclick(function(){
                this.parent_panel.legend.layout.hidden = !this.parent_panel.legend.layout.hidden;
                this.parent_panel.legend.render();
                this.update();
            }.bind(this));
        return this.update();
    };
});
