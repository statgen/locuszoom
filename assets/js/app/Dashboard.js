/* global d3,Q,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**
 * A Dashboard is an HTML element used for presenting arbitrary user interface components. Dashboards are anchored
 *   to either the entire Plot or to individual Panels.
 *
 * Each dashboard is an HTML-based (read: not SVG) collection of components used to display information or provide
 *   user interface. Dashboards can exist on entire plots, where their visibility is permanent and vertically adjacent
 *   to the plot, or on individual panels, where their visibility is tied to a behavior (e.g. a mouseover) and is as
 *   an overlay.
 * @class
 */
LocusZoom.Dashboard = function(parent){
    // parent must be a locuszoom plot or panel
    if (!(parent instanceof LocusZoom.Plot) && !(parent instanceof LocusZoom.Panel)){
        throw "Unable to create dashboard, parent must be a locuszoom plot or panel";
    }
    /** @member {LocusZoom.Plot|LocusZoom.Panel} */
    this.parent = parent;
    /** @member {String} */
    this.id = this.parent.getBaseId() + ".dashboard";
    /** @member {('plot'|'panel')} */
    this.type = (this.parent instanceof LocusZoom.Plot) ? "plot" : "panel";
    /** @member {LocusZoom.Plot} */
    this.parent_plot = this.type === "plot" ? this.parent : this.parent.parent;

    /** @member {d3.selection} */
    this.selector = null;
    /** @member {LocusZoom.Dashboard.Component[]} */
    this.components = [];
    /**
     * The timer identifier as returned by setTimeout
     * @member {Number}
     */
    this.hide_timeout = null;
    /**
     * Whether to hide the dashboard. Can be overridden by a child component. Check via `shouldPersist`
     * @protected
     * @member {Boolean}
     */
    this.persist = false;

    // TODO: Return value from constructor function?
    return this.initialize();
};

/**
 * Prepare the dashboard for first use: generate all component instances for this dashboard, based on the provided
 *   layout of the parent. Connects event listeners and shows/hides as appropriate.
 * @returns {LocusZoom.Dashboard}
 */
LocusZoom.Dashboard.prototype.initialize = function() {
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
    if (this.type === "panel"){
        d3.select(this.parent.parent.svg.node().parentNode).on("mouseover." + this.id, function(){
            clearTimeout(this.hide_timeout);
            if (!this.selector || this.selector.style("visibility") === "hidden"){ this.show(); }
        }.bind(this));
        d3.select(this.parent.parent.svg.node().parentNode).on("mouseout." + this.id, function(){
            clearTimeout(this.hide_timeout);
            this.hide_timeout = setTimeout(function(){ this.hide(); }.bind(this), 300);
        }.bind(this));
    }

    return this;

};

/**
 * Whether to persist the dashboard. Returns true if at least one component should persist, or if the panel is engaged
 *   in an active drag event.
 * @returns {boolean}
 */
LocusZoom.Dashboard.prototype.shouldPersist = function(){
    if (this.persist){ return true; }
    var persist = false;
    // Persist if at least one component should also persist
    this.components.forEach(function(component){
        persist = persist || component.shouldPersist();
    });
    // Persist if in a parent drag event
    persist = persist || (this.parent_plot.panel_boundaries.dragging || this.parent_plot.interaction.dragging);
    return !!persist;
};

/**
 * Make the dashboard appear. If it doesn't exist yet create it, including creating/positioning all components within,
 *   and make sure it is set to be visible.
 */
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

/**
 * Update the dashboard and rerender all child components. This can be called whenever plot state changes.
 * @returns {LocusZoom.Dashboard}
 */
LocusZoom.Dashboard.prototype.update = function(){
    if (!this.selector){ return this; }
    this.components.forEach(function(component){ component.update(); });
    return this.position();
};

/**
 * Position the dashboard (and child components) within the panel
 * @returns {LocusZoom.Dashboard}
 */
LocusZoom.Dashboard.prototype.position = function(){
    if (!this.selector){ return this; }
    // Position the dashboard itself (panel only)
    if (this.type === "panel"){
        var page_origin = this.parent.getPageOrigin();
        var top = (page_origin.y + 3.5).toString() + "px";
        var left = page_origin.x.toString() + "px";
        var width = (this.parent.layout.width - 4).toString() + "px";
        this.selector.style({ position: "absolute", top: top, left: left, width: width });
    }
    // Recursively position components
    this.components.forEach(function(component){ component.position(); });
    return this;
};

/**
 * Hide the dashboard (make invisible but do not destroy). Will do nothing if `shouldPersist` returns true.
 *
 * @returns {LocusZoom.Dashboard}
 */
LocusZoom.Dashboard.prototype.hide = function(){
    if (!this.selector || this.shouldPersist()){ return this; }
    this.components.forEach(function(component){ component.hide(); });
    this.selector.style({ visibility: "hidden" });
    return this;
};

/**
 * Completely remove dashboard and all child components. (may be overridden by persistence settings)
 * @param {Boolean} [force=false] If true, will ignore persistence settings and always destroy the dashboard
 * @returns {LocusZoom.Dashboard}
 */
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

/**
 *
 * A dashboard component is an empty div rendered on a dashboard that can display custom
 * html of user interface elements. LocusZoom.Dashboard.Components is a singleton used to
 * define and manage an extendable collection of dashboard components.
 * (e.g. by LocusZoom.Dashboard.Components.add())
 * @class
 * @param {Object} layout A JSON-serializable object of layout configuration parameters
 * @param {('left'|'right')} [layout.position='left']  Whether to float the component left or right.
 * @param {('gray'|'red'|'orange'|'yellow'|'green'|'blue'|'purple'} [layout.color='gray']  Color scheme for the
 *   component. Applies to buttons and menus.
 * @param {LocusZoom.Dashboard} parent The dashboard that contains this component
*/
LocusZoom.Dashboard.Component = function(layout, parent) {
    /** @member {Object} */
    this.layout = layout || {};
    if (!this.layout.color){ this.layout.color = "gray"; }

    /** @member {LocusZoom.Dashboard|*} */
    this.parent = parent || null;
    /**
     * Some dashboards are attached to a panel, rather than directly to a plot
     * @member {LocusZoom.Panel|null}
     */
    this.parent_panel = null;
    /** @member {LocusZoom.Plot} */
    this.parent_plot = null;
    /**
     * This is a reference to either the panel or the plot, depending on what the dashboard is
     *   tied to. Useful when absolutely positioning dashboard components relative to their SVG anchor.
     * @member {LocusZoom.Plot|LocusZoom.Panel}
     */
    this.parent_svg = null;
    if (this.parent instanceof LocusZoom.Dashboard){
        // TODO: when is the immediate parent *not* a dashboard?
        if (this.parent.type === "panel"){
            this.parent_panel = this.parent.parent;
            this.parent_plot = this.parent.parent.parent;
            this.parent_svg = this.parent_panel;
        } else {
            this.parent_plot = this.parent.parent;
            this.parent_svg = this.parent_plot;
        }
    }
    /** @member {d3.selection} */
    this.selector = null;
    /**
     * If this is an interactive component, it will contain a button or menu instance that handles the interactivity.
     *   There is a 1-to-1 relationship of dashboard component to button
     * @member {null|LocusZoom.Dashboard.Component.Button}
     */
    this.button  = null;
    /**
     * If any single component is marked persistent, it will bubble up to prevent automatic hide behavior on a
     *   component's parent dashboard. Check via `shouldPersist`
     * @protected
     * @member {Boolean}
     */
    this.persist = false;
    if (!this.layout.position){ this.layout.position = "left"; }

    // TODO: Return value in constructor
    return this;
};
/**
 * Perform all rendering of component, including toggling visibility to true. Will initialize and create SVG element
 *   if necessary, as well as updating with new data and performing layout actions.
 */
LocusZoom.Dashboard.Component.prototype.show = function(){
    if (!this.parent || !this.parent.selector){ return; }
    if (!this.selector){
        var group_position = (["start","middle","end"].indexOf(this.layout.group_position) !== -1 ? " lz-dashboard-group-" + this.layout.group_position : "");
        this.selector = this.parent.selector.append("div")
            .attr("class", "lz-dashboard-" + this.layout.position + group_position);
        if (this.layout.style){ this.selector.style(this.layout.style); }
        if (typeof this.initialize == "function"){ this.initialize(); }
    }
    if (this.button && this.button.status === "highlighted"){ this.button.menu.show(); }
    this.selector.style({ visibility: "visible" });
    this.update();
    return this.position();
};
/**
 * Update the dashboard component with any new data or plot state as appropriate
 */
LocusZoom.Dashboard.Component.prototype.update = function(){ /* stub */ };
/**
 * Place the component correctly in the plot
 * @returns {LocusZoom.Dashboard.Component}
 */
LocusZoom.Dashboard.Component.prototype.position = function(){
    if (this.button){ this.button.menu.position(); }
    return this;
};
/**
 * Determine whether the component should persist (will bubble up to parent dashboard)
 * @returns {boolean}
 */
LocusZoom.Dashboard.Component.prototype.shouldPersist = function(){
    if (this.persist){ return true; }
    if (this.button && this.button.persist){ return true; }
    return false;
};
/**
 * Toggle visibility to hidden, unless marked as persistent
 * @returns {LocusZoom.Dashboard.Component}
 */
LocusZoom.Dashboard.Component.prototype.hide = function(){
    if (!this.selector || this.shouldPersist()){ return this; }
    if (this.button){ this.button.menu.hide(); }
    this.selector.style({ visibility: "hidden" });
    return this;
};
/**
 * Completely remove component and button. (may be overridden by persistence settings)
 * @param {Boolean} [force=false] If true, will ignore persistence settings and always destroy the dashboard
 * @returns {LocusZoom.Dashboard}
 */
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

/**
 * Singleton registry of all known components
 * @class
 * @static
 */
LocusZoom.Dashboard.Components = (function() {
    /** @lends LocusZoom.Dashboard.Components */
    var obj = {};
    var components = {};

    /**
     * Create a new component instance by name
     * @param {String} name The string identifier of the desired component
     * @param {Object} layout The layout to use to create the component
     * @param {LocusZoom.Dashboard} parent The containing dashboard to use when creating the component
     * @returns {LocusZoom.Dashboard.Component}
     */
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
    /**
     * Add a new component constructor to the registry and ensure that it extends the correct parent class
     * @protected
     * @param name
     * @param component
     */
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

    /**
     * Register a new component constructor by name
     * @param {String} name
     * @param {function} component The component constructor
     */
    obj.add = function(name, component) {
        if (components[name]) {
            throw("dashboard component already exists with name: " + name);
        } else {
            obj.set(name, component);
        }
    };

    /**
     * List the names of all registered components
     * @returns {String[]}
     */
    obj.list = function() {
        return Object.keys(components);
    };

    return obj;
})();

/**
 * Plots and panels may have a "dashboard" element suited for showing HTML components that may be interactive.
 *   When components need to incorporate a generic button, or additionally a button that generates a menu, this
 *   class provides much of the necessary framework.
 * @class
 * @param {LocusZoom.Dashboard.Component} parent
 */
LocusZoom.Dashboard.Component.Button = function(parent) {   
    
    if (!(parent instanceof LocusZoom.Dashboard.Component)){
        throw "Unable to create dashboard component button, invalid parent";
    }
    /** @member {LocusZoom.Dashboard.Component} */
    this.parent = parent;
    /** @member {LocusZoom.Dashboard.Panel} */
    this.parent_panel = this.parent.parent_panel;
    /** @member {LocusZoom.Dashboard.Plot} */
    this.parent_plot = this.parent.parent_plot;
    /** @member {LocusZoom.Plot|LocusZoom.Panel} */
    this.parent_svg = this.parent.parent_svg;

    /** @member {LocusZoom.Dashboard|null|*} */
    this.parent_dashboard = this.parent.parent;
    /** @member {d3.selection} */
    this.selector = null;

    /**
     * Tag to use for the button (default: a)
     * @member {String}
     */
    this.tag = "a";

    /**
     * TODO This method does not appear to be used anywhere
     * @param {String} tag
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.setTag = function(tag){
        if (typeof tag != "undefined"){ this.tag = tag.toString(); }
        return this;
    };

    /**
     * HTML for the button to show.
     * @protected
     * @member {String}
     */
    this.html = "";
    /**
     * Specify the HTML content of this button.
     * WARNING: The string provided will be inserted into the document as raw markup; XSS mitigation is the
     *   responsibility of each button implementation.
     * @param {String} html
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.setHtml = function(html){
        if (typeof html != "undefined"){ this.html = html.toString(); }
        return this;
    };
    /**
     * @deprecated since 0.5.6; use setHTML instead
     */
    this.setText = this.setHTML;

    /**
     * Mouseover title text for the button to show
     * @protected
     * @member {String}
     */
    this.title = "";
    /**
     * Set the mouseover title text for the button (if any)
     * @param {String} title Simple text to display
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.setTitle = function(title){
        if (typeof title != "undefined"){ this.title = title.toString(); }
        return this;
    };

    /**
     * Color of the button
     * @member {String}
     */
    this.color = "gray";

    /**
     * Set the color associated with this button
     * @param {('gray'|'red'|'orange'|'yellow'|'green'|'blue'|'purple')} color Any selection not in the preset list
     *   will be replaced with gray.
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.setColor = function(color){
        if (typeof color != "undefined"){
            if (["gray", "red", "orange", "yellow", "green", "blue", "purple"].indexOf(color) !== -1){ this.color = color; }
            else { this.color = "gray"; }
        }
        return this;
    };

    /**
     * Hash of arbitrary button styles to apply as {name: value} entries
     * @protected
     * @member {Object}
     */
    this.style = {};
    /**
     * Set a collection of custom styles to be used by the button
     * @param {Object} style Hash of {name:value} entries
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.setStyle = function(style){
        if (typeof style != "undefined"){ this.style = style; }
        return this;
    };

    //
    /**
     * Method to generate a CSS class string
     * @returns {string}
     */
    this.getClass = function(){
        var group_position = (["start","middle","end"].indexOf(this.parent.layout.group_position) !== -1 ? " lz-dashboard-button-group-" + this.parent.layout.group_position : "");
        return "lz-dashboard-button lz-dashboard-button-" + this.color + (this.status ? "-" + this.status : "") + group_position;
    };

    // Permanence
    /**
     * Track internal state on whether to keep showing the button/ menu contents at the moment
     * @protected
     * @member {Boolean}
     */
    this.persist = false;
    /**
     * Configuration when defining a button: track whether this component should be allowed to keep open
     *   menu/button contents in response to certain events
     * @protected
     * @member {Boolean}
     */
    this.permanent = false;
    /**
     * Allow code to change whether the button is allowed to be `permanent`
     * @param {boolean} bool
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.setPermanent = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        this.permanent = bool;
        if (this.permanent){ this.persist = true; }
        return this;
    };
    /**
     * Determine whether the button/menu contents should persist in response to a specific event
     * @returns {Boolean}
     */
    this.shouldPersist = function(){
        return this.permanent || this.persist;
    };

    /**
     * Button status (highlighted / disabled/ etc)
     * @protected
     * @member {String}
     */
    this.status = "";
    /**
     * Change button state
     * @param {('highlighted'|'disabled'|'')} status
     */
    this.setStatus = function(status){
        if (typeof status != "undefined" && ["", "highlighted", "disabled"].indexOf(status) !== -1){ this.status = status; }
        return this.update();
    };
    /**
     * Toggle whether the button is highlighted
     * @param {boolean} bool If provided, explicitly set highlighted state
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.highlight = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("highlighted"); }
        else if (this.status === "highlighted"){ return this.setStatus(""); }
        return this;
    };
    /**
     * Toggle whether the button is disabled
     * @param {boolean} bool If provided, explicitly set disabled state
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.disable = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("disabled"); }
        else if (this.status === "disabled"){ return this.setStatus(""); }
        return this;
    };

    // Mouse events
    /** @member {function} */
    this.onmouseover = function(){};
    this.setOnMouseover = function(onmouseover){
        if (typeof onmouseover == "function"){ this.onmouseover = onmouseover; }
        else { this.onmouseover = function(){}; }
        return this;
    };
    /** @member {function} */
    this.onmouseout = function(){};
    this.setOnMouseout = function(onmouseout){
        if (typeof onmouseout == "function"){ this.onmouseout = onmouseout; }
        else { this.onmouseout = function(){}; }
        return this;
    };
    /** @member {function} */
    this.onclick = function(){};
    this.setOnclick = function(onclick){
        if (typeof onclick == "function"){ this.onclick = onclick; }
        else { this.onclick = function(){}; }
        return this;
    };
    
    // Primary behavior functions
    /**
     * Show the button, including creating DOM elements if necessary for first render
     */
    this.show = function(){
        if (!this.parent){ return; }
        if (!this.selector){
            this.selector = this.parent.selector.append(this.tag).attr("class", this.getClass());
        }
        return this.update();
    };
    /**
     * Hook for any actions or state cleanup to be performed before rerendering
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.preUpdate = function(){ return this; };
    /**
     * Update button state and contents, and fully rerender
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.update = function(){
        if (!this.selector){ return this; }
        this.preUpdate();
        this.selector
            .attr("class", this.getClass())
            .attr("title", this.title).style(this.style)
            .on("mouseover", (this.status === "disabled") ? null : this.onmouseover)
            .on("mouseout", (this.status === "disabled") ? null : this.onmouseout)
            .on("click", (this.status === "disabled") ? null : this.onclick)
            .html(this.html);
        this.menu.update();
        this.postUpdate();
        return this;
    };
    /**
     * Hook for any behavior to be added/changed after the button has been re-rendered
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.postUpdate = function(){ return this; };
    /**
     * Hide the button by removing it from the DOM (may be overridden by current persistence setting)
     * @returns {LocusZoom.Dashboard.Component.Button}
     */
    this.hide = function(){
        if (this.selector && !this.shouldPersist()){
            this.selector.remove();
            this.selector = null;
        }
        return this;
    };    

    /**
     * Button Menu Object
     * The menu is an HTML overlay that can appear below a button. It can contain arbitrary HTML and
     *   has logic to be automatically positioned and sized to behave more or less like a dropdown menu.
     * @member {Object}
     */
    this.menu = {
        outer_selector: null,
        inner_selector: null,
        scroll_position: 0,
        hidden: true,
        /**
         * Show the button menu, including setting up any DOM elements needed for first rendering
         */
        show: function(){
            if (!this.menu.outer_selector){
                this.menu.outer_selector = d3.select(this.parent_plot.svg.node().parentNode).append("div")
                    .attr("class", "lz-dashboard-menu lz-dashboard-menu-" + this.color)
                    .attr("id", this.parent_svg.getBaseId() + ".dashboard.menu");
                this.menu.inner_selector = this.menu.outer_selector.append("div")
                    .attr("class", "lz-dashboard-menu-content");
                this.menu.inner_selector.on("scroll", function(){
                    this.menu.scroll_position = this.menu.inner_selector.node().scrollTop;
                }.bind(this));
            }
            this.menu.outer_selector.style({ visibility: "visible" });
            this.menu.hidden = false;
            return this.menu.update();
        }.bind(this),
        /**
         * Update the rendering of the menu
         */
        update: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.populate(); // This function is stubbed for all buttons by default and custom implemented in component definition
            if (this.menu.inner_selector){ this.menu.inner_selector.node().scrollTop = this.menu.scroll_position; }
            return this.menu.position();
        }.bind(this),
        position: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            // Unset any explicitly defined outer selector height so that menus dynamically shrink if content is removed
            this.menu.outer_selector.style({ height: null });
            var padding = 3;
            var scrollbar_padding = 20;
            var menu_height_padding = 14; // 14: 2x 6px padding, 2x 1px border
            var page_origin = this.parent_svg.getPageOrigin();
            var page_scroll_top = document.documentElement.scrollTop || document.body.scrollTop;
            var container_offset = this.parent_plot.getContainerOffset();
            var dashboard_client_rect = this.parent_dashboard.selector.node().getBoundingClientRect();
            var button_client_rect = this.selector.node().getBoundingClientRect();
            var menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
            var total_content_height = this.menu.inner_selector.node().scrollHeight;
            var top = 0; var left = 0;
            if (this.parent_dashboard.type === "panel"){
                top = (page_origin.y + dashboard_client_rect.height + (2 * padding));
                left = Math.max(page_origin.x + this.parent_svg.layout.width - menu_client_rect.width - padding, page_origin.x + padding);
            } else {
                top = button_client_rect.bottom + page_scroll_top + padding - container_offset.top;
                left = Math.max(button_client_rect.left + button_client_rect.width - menu_client_rect.width - container_offset.left, page_origin.x + padding);
            }
            var base_max_width = Math.max(this.parent_svg.layout.width - (2 * padding) - scrollbar_padding, scrollbar_padding);
            var container_max_width = base_max_width;
            var content_max_width = (base_max_width - (4 * padding));
            var base_max_height = Math.max(this.parent_svg.layout.height - (10 * padding) - menu_height_padding, menu_height_padding);
            var height = Math.min(total_content_height, base_max_height);
            var max_height = base_max_height;
            this.menu.outer_selector.style({
                "top": top.toString() + "px",
                "left": left.toString() + "px",
                "max-width": container_max_width.toString() + "px",
                "max-height": max_height.toString() + "px",
                "height": height.toString() + "px"
            });
            this.menu.inner_selector.style({ "max-width": content_max_width.toString() + "px" });
            this.menu.inner_selector.node().scrollTop = this.menu.scroll_position;
            return this.menu;
        }.bind(this),
        hide: function(){
            if (!this.menu.outer_selector){ return this.menu; }
            this.menu.outer_selector.style({ visibility: "hidden" });
            this.menu.hidden = true;
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
        /**
         * Internal method definition
         * By convention populate() does nothing and should be reimplemented with each dashboard button definition
         *   Reimplement by way of Dashboard.Component.Button.menu.setPopulate to define the populate method and hook
         *   up standard menu click-toggle behavior prototype.
         * @protected
         */
        populate: function(){ /* stub */ }.bind(this),
        /**
         * Define how the menu is populated with items, and set up click and display properties as appropriate
         * @public
         */
        setPopulate: function(menu_populate_function){
            if (typeof menu_populate_function == "function"){
                this.menu.populate = menu_populate_function;
                this.setOnclick(function(){
                    if (this.menu.hidden){
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

/**
 * Renders arbitrary text with title formatting
 * @class LocusZoom.Dashboard.Components.title
 * @augments LocusZoom.Dashboard.Component
 * @param {object} layout
 * @param {string} layout.title Text to render
 */
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

/**
 * Renders text to display the current dimensions of the plot. Automatically updated as plot dimensions change
 * @class LocusZoom.Dashboard.Components.dimensions
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("dimensions", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        var display_width = this.parent_plot.layout.width.toString().indexOf(".") === -1 ? this.parent_plot.layout.width : this.parent_plot.layout.width.toFixed(2);
        var display_height = this.parent_plot.layout.height.toString().indexOf(".") === -1 ? this.parent_plot.layout.height : this.parent_plot.layout.height.toFixed(2);
        this.selector.html(display_width + "px × " + display_height + "px");
        if (layout.class){ this.selector.attr("class", layout.class); }
        if (layout.style){ this.selector.style(layout.style); }
        return this;
    };
});

/**
 * Display the current scale of the genome region displayed in the plot, as defined by the difference between
 *  `state.end` and `state.start`.
 * @class LocusZoom.Dashboard.Components.region_scale
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("region_scale", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (!isNaN(this.parent_plot.state.start) && !isNaN(this.parent_plot.state.end)
            && this.parent_plot.state.start !== null && this.parent_plot.state.end !== null){
            this.selector.style("display", null);
            this.selector.html(LocusZoom.positionIntToString(this.parent_plot.state.end - this.parent_plot.state.start, null, true));
        } else {
            this.selector.style("display", "none");
        }
        if (layout.class){ this.selector.attr("class", layout.class); }
        if (layout.style){ this.selector.style(layout.style); }
        return this;
    };
});

/**
 * Button to export current plot to an SVG image
 * @class LocusZoom.Dashboard.Components.download
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("download", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml("Download Image").setTitle("Download image of the current plot as locuszoom.svg")
            .setOnMouseover(function() {
                this.button.selector
                    .classed("lz-dashboard-button-gray-disabled", true)
                    .html("Preparing Image");
                this.generateBase64SVG().then(function(base64_string){
                    this.button.selector
                        .attr("href", "data:image/svg+xml;base64,\n" + base64_string)
                        .classed("lz-dashboard-button-gray-disabled", false)
                        .classed("lz-dashboard-button-gray-highlighted", true)
                        .html("Download Image");
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
        if ( document.styleSheets[stylesheet].href !== null
             && document.styleSheets[stylesheet].href.indexOf("locuszoom.css") !== -1){
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

/**
 * Button to remove panel from plot.
 *   NOTE: Will only work on panel dashboards.
 * @class LocusZoom.Dashboard.Components.remove_panel
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("remove_panel", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml("×").setTitle("Remove panel")
            .setOnclick(function(){
                if (confirm("Are you sure you want to remove this panel? This cannot be undone!")){
                    var panel = this.parent_panel;
                    panel.dashboard.hide(true);
                    d3.select(panel.parent.svg.node().parentNode).on("mouseover." + panel.getBaseId() + ".dashboard", null);
                    d3.select(panel.parent.svg.node().parentNode).on("mouseout." + panel.getBaseId() + ".dashboard", null);
                    return panel.parent.removePanel(panel.id);
                }
                return false;
            }.bind(this));
        this.button.show();
        return this;
    };
});

/**
 * Button to move panel up relative to other panels (in terms of y-index on the page)
 *   NOTE: Will only work on panel dashboards.
 * @class LocusZoom.Dashboard.Components.move_panel_up
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("move_panel_up", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){
            var is_at_top = (this.parent_panel.layout.y_index === 0);
            this.button.disable(is_at_top);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml("▴").setTitle("Move panel up")
            .setOnclick(function(){
                this.parent_panel.moveUp();
                this.update();
            }.bind(this));
        this.button.show();
        return this.update();
    };
});

/**
 * Button to move panel down relative to other panels (in terms of y-index on the page)
 *   NOTE: Will only work on panel dashboards.
 * @class LocusZoom.Dashboard.Components.move_panel_down
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("move_panel_down", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){
            var is_at_bottom = (this.parent_panel.layout.y_index === this.parent_plot.panel_ids_by_y_index.length-1);
            this.button.disable(is_at_bottom);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml("▾").setTitle("Move panel down")
            .setOnclick(function(){
                this.parent_panel.moveDown();
                this.update();
            }.bind(this));
        this.button.show();
        return this.update();
    };
});

/**
 * Button to shift plot region forwards or back by a `step` increment provided in the layout
 * @class LocusZoom.Dashboard.Components.shift_region
 * @augments LocusZoom.Dashboard.Component
 * @param {object} layout
 * @param {number} [layout.step=50000] The stepsize to change the region by
 * @param {string} [layout.button_html]
 * @param {string} [layout.button_title]
 */
LocusZoom.Dashboard.Components.add("shift_region", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)){
        this.update = function(){};
        console.warn("Unable to add shift_region dashboard component: plot state does not have region bounds");
        return;
    }
    if (isNaN(layout.step) || layout.step === 0){ layout.step = 50000; }
    if (typeof layout.button_html !== "string"){ layout.button_html = layout.step > 0 ? ">" : "<"; }
    if (typeof layout.button_title !== "string"){
        layout.button_title = "Shift region by " + (layout.step > 0 ? "+" : "-") + LocusZoom.positionIntToString(Math.abs(layout.step),null,true);
    }
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start + layout.step, 1),
                    end: this.parent_plot.state.end + layout.step
                });
            }.bind(this));
        this.button.show();
        return this;
    };
});

/**
 * Zoom in or out on the plot, centered on the middle of the plot region, by the specified amount
 * @class LocusZoom.Dashboard.Components.zoom_region
 * @augments LocusZoom.Dashboard.Component
 * @param {object} layout
 * @param {number} [layout.step=0.2] The amount to zoom in by (where 1 indicates 100%)
 */
LocusZoom.Dashboard.Components.add("zoom_region", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)){
        this.update = function(){};
        console.warn("Unable to add zoom_region dashboard component: plot state does not have region bounds");
        return;
    }
    if (isNaN(layout.step) || layout.step === 0){ layout.step = 0.2; }
    if (typeof layout.button_html != "string"){ layout.button_html = layout.step > 0 ? "z–" : "z+"; }
    if (typeof layout.button_title != "string"){
        layout.button_title = "Zoom region " + (layout.step > 0 ? "out" : "in") + " by " + (Math.abs(layout.step)*100).toFixed(1) + "%";
    }
    this.update = function(){
        if (this.button){
            var can_zoom = true;
            var current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
            if (layout.step > 0 && !isNaN(this.parent_plot.layout.max_region_scale) && current_region_scale >= this.parent_plot.layout.max_region_scale){
                can_zoom = false;
            }
            if (layout.step < 0 && !isNaN(this.parent_plot.layout.min_region_scale) && current_region_scale <= this.parent_plot.layout.min_region_scale){
                can_zoom = false;
            }
            this.button.disable(!can_zoom);
            return this;
        }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                var current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
                var zoom_factor = 1 + layout.step;
                var new_region_scale = current_region_scale * zoom_factor;
                if (!isNaN(this.parent_plot.layout.max_region_scale)){
                    new_region_scale = Math.min(new_region_scale, this.parent_plot.layout.max_region_scale);
                }
                if (!isNaN(this.parent_plot.layout.min_region_scale)){
                    new_region_scale = Math.max(new_region_scale, this.parent_plot.layout.min_region_scale);
                }
                var delta = Math.floor((new_region_scale - current_region_scale) / 2);
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start - delta, 1),
                    end: this.parent_plot.state.end + delta
                });
            }.bind(this));
        this.button.show();
        return this;
    };
});

/**
 * Renders button with arbitrary text that, when clicked, shows a dropdown containing arbitrary HTML
 *  NOTE: Trusts content exactly as given. XSS prevention is the responsibility of the implementer.
 * @class LocusZoom.Dashboard.Components.menu
 * @augments LocusZoom.Dashboard.Component
 * @param {object} layout
 * @param {string} layout.button_html The HTML to render inside the button
 * @param {string} layout.button_title Text to display as a tooltip when hovering over the button
 * @param {string} layout.menu_html The HTML content of the dropdown menu
 */
LocusZoom.Dashboard.Components.add("menu", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml(layout.button_html).setTitle(layout.button_title);
        this.button.menu.setPopulate(function(){
            this.button.menu.inner_selector.html(layout.menu_html);
        }.bind(this));
        this.button.show();
        return this;
    };
});

/**
 * Special button/menu to allow model building by tracking individual covariants. Will track a list of covariate
 *   objects and store them in the special `model.covariates` field of plot `state`.
 * @class LocusZoom.Dashboard.Components.covariates_model
 * @augments LocusZoom.Dashboard.Component
 * @param {object} layout
 * @param {string} layout.button_html The HTML to render inside the button
 * @param {string} layout.button_title Text to display as a tooltip when hovering over the button
 */
LocusZoom.Dashboard.Components.add("covariates_model", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);

    this.initialize = function(){
        // Initialize state.model.covariates
        this.parent_plot.state.model = this.parent_plot.state.model || {};
        this.parent_plot.state.model.covariates = this.parent_plot.state.model.covariates || [];
        // Create an object at the plot level for easy access to interface methods in custom client-side JS
        /**
         * When a covariates model dashboard element is present, create (one) object at the plot level that exposes
         *   component data and state for custom interactions with other plot elements.
         * @class LocusZoom.Plot.CovariatesModel
         */
        this.parent_plot.CovariatesModel = {
            /** @member {LocusZoom.Dashboard.Component.Button} */
            button: this,
            /**
             * Add an element to the model and show a representation of it in the dashboard component menu. If the
             *   element is already part of the model, do nothing (to avoid adding duplicates).
             * When plot state is changed, this will automatically trigger requests for new data accordingly.
             * @param {string|object} element_reference Can be any value that can be put through JSON.stringify()
             *   to create a serialized representation of itself.
             */
            add: function(element_reference){
                var element = JSON.parse(JSON.stringify(element_reference));
                if (typeof element_reference == "object" && typeof element.html != "string"){
                    element.html = ( (typeof element_reference.toHTML == "function") ? element_reference.toHTML() : element_reference.toString());
                }
                // Check if the element is already in the model covariates array and return if it is.
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
            /**
             * Remove an element from `state.model.covariates` (and from the dashboard component menu's
             *  representation of the state model). When plot state is changed, this will automatically trigger
             *  requests for new data accordingly.
             * @param {number} idx Array index of the element, in the `state.model.covariates array`.
             */
            removeByIdx: function(idx){
                if (typeof this.state.model.covariates[idx] == "undefined"){
                    throw("Unable to remove model covariate, invalid index: " + idx.toString());
                }
                this.state.model.covariates.splice(idx, 1);
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            /**
             * Empty the `state.model.covariates` array (and dashboard component menu representation thereof) of all
             *  elements. When plot state is changed, this will automatically trigger requests for new data accordingly
             */
            removeAll: function(){
                this.state.model.covariates = [];
                this.applyState();
                this.CovariatesModel.updateComponent();
                return this;
            }.bind(this.parent_plot),
            /**
             * Manually trigger the update methods on the dashboard component's button and menu elements to force
             *   display of most up-to-date content. Can be used to force the dashboard to reflect changes made, eg if
             *   modifying `state.model.covariates` directly instead of via `plot.CovariatesModel`
             */
            updateComponent: function(){
                this.button.update();
                this.button.menu.update();
            }.bind(this)
        };
    }.bind(this);

    this.update = function(){

        if (this.button){ return this; }

        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml(layout.button_html).setTitle(layout.button_title)
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
                selector.append("i").html("no covariates in model");
            } else {
                selector.append("h5").html("Model Covariates (" + this.parent_plot.state.model.covariates.length + ")");
                var table = selector.append("table");
                this.parent_plot.state.model.covariates.forEach(function(covariate, idx){
                    var html = ( (typeof covariate == "object" && typeof covariate.html == "string") ? covariate.html : covariate.toString() );
                    var row = table.append("tr");
                    row.append("td").append("button")
                        .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.layout.color)
                        .style({ "margin-left": "0em" })
                        .on("click", function(){
                            this.parent_plot.CovariatesModel.removeByIdx(idx);
                        }.bind(this))
                        .html("×");
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
            var html = "Model";
            if (this.parent_plot.state.model.covariates.length){
                var cov = this.parent_plot.state.model.covariates.length > 1 ? "covariates" : "covariate";
                html += " (" + this.parent_plot.state.model.covariates.length + " " + cov + ")";
            }
            this.button.setHtml(html).disable(false);
        }.bind(this);

        this.button.show();

        return this;
    };
});

/**
 * Button to toggle split tracks
 * @class LocusZoom.Dashboard.Components.toggle_split_tracks
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("toggle_split_tracks", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    if (!layout.data_layer_id){ layout.data_layer_id = "intervals"; }
    if (!this.parent_panel.data_layers[layout.data_layer_id]){
        throw ("Dashboard toggle split tracks component missing valid data layer ID");
    }
    this.update = function(){
        var data_layer = this.parent_panel.data_layers[layout.data_layer_id];
        var html = data_layer.layout.split_tracks ? "Merge Tracks" : "Split Tracks";
        if (this.button){
            this.button.setHtml(html);
            this.button.show();
            this.parent.position();
            return this;
        } else {
            this.button = new LocusZoom.Dashboard.Component.Button(this)
                .setColor(layout.color).setHtml(html)
                .setTitle("Toggle whether tracks are split apart or merged together")
                .setOnclick(function(){
                    data_layer.toggleSplitTracks();
                    if (this.scale_timeout){ clearTimeout(this.scale_timeout); }
                    var timeout = data_layer.layout.transition ? +data_layer.layout.transition.duration || 0 : 0;
                    this.scale_timeout = setTimeout(function(){
                        this.parent_panel.scaleHeightToData();
                        this.parent_plot.positionPanels();
                    }.bind(this), timeout);
                    this.update();
                }.bind(this));
            return this.update();
        }
    };
});

/**
 * Button to resize panel height to fit available data (eg when showing a list of tracks)
 * @class LocusZoom.Dashboard.Components.resize_to_data
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("resize_to_data", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        if (this.button){ return this; }
        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml("Resize to Data")
            .setTitle("Automatically resize this panel to fit the data its currently showing")
            .setOnclick(function(){
                this.parent_panel.scaleHeightToData();
                this.update();
            }.bind(this));
        this.button.show();
        return this;
    };
});

/**
 * Button to toggle legend
 * @class LocusZoom.Dashboard.Components.toggle_legend
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("toggle_legend", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);
    this.update = function(){
        var html = this.parent_panel.legend.layout.hidden ? "Show Legend" : "Hide Legend";
        if (this.button){
            this.button.setHtml(html).show();
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

/**
 * Menu for manipulating multiple data layers in a single panel: show/hide, change order, etc.
 * @class LocusZoom.Dashboard.Components.data_layers
 * @augments LocusZoom.Dashboard.Component
 */
LocusZoom.Dashboard.Components.add("data_layers", function(layout){
    LocusZoom.Dashboard.Component.apply(this, arguments);

    this.update = function(){

        if (typeof layout.button_html != "string"){ layout.button_html = "Data Layers"; }
        if (typeof layout.button_title != "string"){ layout.button_title = "Manipulate Data Layers (sort, dim, show/hide, etc.)"; }

        if (this.button){ return this; }

        this.button = new LocusZoom.Dashboard.Component.Button(this)
            .setColor(layout.color).setHtml(layout.button_html).setTitle(layout.button_title)
            .setOnclick(function(){
                this.button.menu.populate();
            }.bind(this));

        this.button.menu.setPopulate(function(){
            this.button.menu.inner_selector.html("");
            var table = this.button.menu.inner_selector.append("table");
            this.parent_panel.data_layer_ids_by_z_index.slice().reverse().forEach(function(id, idx){
                var data_layer = this.parent_panel.data_layers[id];
                var name = (typeof data_layer.layout.name != "string") ? data_layer.id : data_layer.layout.name;
                var row = table.append("tr");
                // Layer name
                row.append("td").html(name);
                // Status toggle buttons
                layout.statuses.forEach(function(status_adj){
                    var status_idx = LocusZoom.DataLayer.Statuses.adjectives.indexOf(status_adj);
                    var status_verb = LocusZoom.DataLayer.Statuses.verbs[status_idx];
                    var html, onclick, highlight;
                    if (data_layer.global_statuses[status_adj]){
                        html = LocusZoom.DataLayer.Statuses.menu_antiverbs[status_idx];
                        onclick = "un" + status_verb + "AllElements";
                        highlight = "-highlighted";
                    } else {
                        html = LocusZoom.DataLayer.Statuses.verbs[status_idx];
                        onclick = status_verb + "AllElements";
                        highlight = "";
                    }
                    row.append("td").append("a")
                        .attr("class", "lz-dashboard-button lz-dashboard-button-" + this.layout.color + highlight)
                        .style({ "margin-left": "0em" })
                        .on("click", function(){ data_layer[onclick](); this.button.menu.populate(); }.bind(this))
                        .html(html);
                }.bind(this));
                // Sort layer buttons
                var at_top = (idx === 0);
                var at_bottom = (idx === (this.parent_panel.data_layer_ids_by_z_index.length - 1));
                var td = row.append("td");
                td.append("a")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-group-start lz-dashboard-button-" + this.layout.color + (at_bottom ? "-disabled" : ""))
                    .style({ "margin-left": "0em" })
                    .on("click", function(){ data_layer.moveDown(); this.button.menu.populate(); }.bind(this))
                    .html("▾").attr("title", "Move layer down (further back)");
                td.append("a")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-group-middle lz-dashboard-button-" + this.layout.color + (at_top ? "-disabled" : ""))
                    .style({ "margin-left": "0em" })
                    .on("click", function(){ data_layer.moveUp(); this.button.menu.populate(); }.bind(this))
                    .html("▴").attr("title", "Move layer up (further front)");
                td.append("a")
                    .attr("class", "lz-dashboard-button lz-dashboard-button-group-end lz-dashboard-button-red")
                    .style({ "margin-left": "0em" })
                    .on("click", function(){
                        if (confirm("Are you sure you want to remove the " + name + " layer? This cannot be undone!")){
                            data_layer.parent.removeDataLayer(id);
                        }
                        return this.button.menu.populate();
                    }.bind(this))
                    .html("×").attr("title", "Remove layer");
            }.bind(this));
            return this;
        }.bind(this));

        this.button.show();

        return this;
    };
});
