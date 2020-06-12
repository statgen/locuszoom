import d3 from 'd3';

import {dashboards} from '../../registry';

/**
 * A Dashboard is an HTML element used for presenting arbitrary user interface components. Dashboards are anchored
 *   to either the entire Plot or to individual Panels.
 *
 * Each dashboard is an HTML-based (read: not SVG) collection of components used to display information or provide
 *   user interface. Dashboards can exist on entire plots, where their visibility is permanent and vertically adjacent
 *   to the plot, or on individual panels, where their visibility is tied to a behavior (e.g. a mouseover) and is as
 *   an overlay.
 *
 * This class is used internally for rendering, and is not part of the public interface
 * @private
 */
class Dashboard {
    constructor(parent) {
        // parent must be a locuszoom plot or panel
        if (!(parent instanceof LocusZoom.Plot) && !(parent instanceof LocusZoom.Panel)) {
            throw new Error('Unable to create dashboard, parent must be a locuszoom plot or panel');
        }
        /** @member {Plot|Panel} */
        this.parent = parent;
        /** @member {String} */
        this.id = this.parent.getBaseId() + '.dashboard';
        /** @member {('plot'|'panel')} */
        this.type = (this.parent instanceof LocusZoom.Plot) ? 'plot' : 'panel';
        /** @member {Plot} */
        this.parent_plot = this.type === 'plot' ? this.parent : this.parent.parent;

        /** @member {d3.selection} */
        this.selector = null;
        /** @member {Component[]} */
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
    }

    /**
     * Prepare the dashboard for first use: generate all component instances for this dashboard, based on the provided
     *   layout of the parent. Connects event listeners and shows/hides as appropriate.
     * @returns {Dashboard}
     */
    initialize() {
        // Parse layout to generate component instances
        if (Array.isArray(this.parent.layout.dashboard.components)) {
            this.parent.layout.dashboard.components.forEach(function(layout) {
                try {
                    const component = dashboards.get(layout.type, layout, this);
                    this.components.push(component);
                } catch (e) {
                    console.warn(e);
                }
            }.bind(this));
        }

        // Add mouseover event handlers to show/hide panel dashboard
        if (this.type === 'panel') {
            d3.select(this.parent.parent.svg.node().parentNode).on('mouseover.' + this.id, function() {
                clearTimeout(this.hide_timeout);
                if (!this.selector || this.selector.style('visibility') === 'hidden') { this.show(); }
            }.bind(this));
            d3.select(this.parent.parent.svg.node().parentNode).on('mouseout.' + this.id, function() {
                clearTimeout(this.hide_timeout);
                this.hide_timeout = setTimeout(function() { this.hide(); }.bind(this), 300);
            }.bind(this));
        }

        return this;
    }

    /**
     * Whether to persist the dashboard. Returns true if at least one component should persist, or if the panel is engaged
     *   in an active drag event.
     * @returns {boolean}
     */
    shouldPersist() {
        if (this.persist) { return true; }
        let persist = false;
        // Persist if at least one component should also persist
        this.components.forEach(function(component) {
            persist = persist || component.shouldPersist();
        });
        // Persist if in a parent drag event
        persist = persist || (this.parent_plot.panel_boundaries.dragging || this.parent_plot.interaction.dragging);
        return !!persist;
    }

    /**
     * Make the dashboard appear. If it doesn't exist yet create it, including creating/positioning all components within,
     *   and make sure it is set to be visible.
     */
    show() {
        if (!this.selector) {
            switch (this.type) {
            case 'plot':
                this.selector = d3.select(this.parent.svg.node().parentNode)
                    .insert('div',':first-child');
                break;
            case 'panel':
                this.selector = d3.select(this.parent.parent.svg.node().parentNode)
                    .insert('div', '.lz-data_layer-tooltip, .lz-dashboard-menu, .lz-curtain').classed('lz-panel-dashboard', true);
                break;
            }
            this.selector.classed('lz-dashboard', true).classed('lz-' + this.type + '-dashboard', true).attr('id', this.id);
        }
        this.components.forEach(function(component) { component.show(); });
        this.selector.style({ visibility: 'visible' });
        return this.update();
    }


    /**
     * Update the dashboard and rerender all child components. This can be called whenever plot state changes.
     * @returns {Dashboard}
     */
    update() {
        if (!this.selector) { return this; }
        this.components.forEach(function(component) { component.update(); });
        return this.position();
    }


    /**
     * Position the dashboard (and child components) within the panel
     * @returns {Dashboard}
     */
    position() {
        if (!this.selector) { return this; }
        // Position the dashboard itself (panel only)
        if (this.type === 'panel') {
            const page_origin = this.parent.getPageOrigin();
            const top = (page_origin.y + 3.5).toString() + 'px';
            const left = page_origin.x.toString() + 'px';
            const width = (this.parent.layout.width - 4).toString() + 'px';
            this.selector.style({ position: 'absolute', top: top, left: left, width: width });
        }
        // Recursively position components
        this.components.forEach(function(component) { component.position(); });
        return this;
    }

    /**
     * Hide the dashboard (make invisible but do not destroy). Will do nothing if `shouldPersist` returns true.
     *
     * @returns {Dashboard}
     */
    hide() {
        if (!this.selector || this.shouldPersist()) { return this; }
        this.components.forEach(function(component) { component.hide(); });
        this.selector.style({ visibility: 'hidden' });
        return this;
    }

    /**
     * Completely remove dashboard and all child components. (may be overridden by persistence settings)
     * @param {Boolean} [force=false] If true, will ignore persistence settings and always destroy the dashboard
     * @returns {Dashboard}
     */
    destroy(force) {
        if (typeof force == 'undefined') { force = false; }
        if (!this.selector) { return this; }
        if (this.shouldPersist() && !force) { return this; }
        this.components.forEach(function(component) { component.destroy(true); });
        this.components = [];
        this.selector.remove();
        this.selector = null;
        return this;
    }
}


/**
 *
 * A dashboard component is an empty div rendered on a dashboard that can display custom
 * html of user interface elements.
 * @param {Object} layout A JSON-serializable object of layout configuration parameters
 * @param {('left'|'right')} [layout.position='left']  Whether to float the component left or right.
 * @param {('start'|'middle'|'end')} [layout.group_position] Buttons can optionally be gathered into a visually
 *  distinctive group whose elements are closer together. If a button is identified as the start or end of a group,
 *  it will be drawn with rounded corners and an extra margin of spacing from any button not part of the group.
 *  For example, the region_nav_plot dashboard is a defined as a group.
 * @param {('gray'|'red'|'orange'|'yellow'|'green'|'blue'|'purple'} [layout.color='gray']  Color scheme for the
 *   component. Applies to buttons and menus.
 * @param {Dashboard} parent The dashboard that contains this component
*/
class Component {
    constructor(layout, parent) {
        /** @member {Object} */
        this.layout = layout || {};
        if (!this.layout.color) { this.layout.color = 'gray'; }

        /** @member {Dashboard|*} */
        this.parent = parent || null;
        /**
         * Some dashboards are attached to a panel, rather than directly to a plot
         * @member {Panel|null}
         */
        this.parent_panel = null;
        /** @member {Plot} */
        this.parent_plot = null;
        /**
         * This is a reference to either the panel or the plot, depending on what the dashboard is
         *   tied to. Useful when absolutely positioning dashboard components relative to their SVG anchor.
         * @member {Plot|Panel}
         */
        this.parent_svg = null;
        if (this.parent instanceof Dashboard) {
            if (this.parent.type === 'panel') {
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
         * @member {null|Button}
         */
        this.button  = null;
        /**
         * If any single component is marked persistent, it will bubble up to prevent automatic hide behavior on a
         *   component's parent dashboard. Check via `shouldPersist`
         * @protected
         * @member {Boolean}
         */
        this.persist = false;
        if (!this.layout.position) { this.layout.position = 'left'; }
    }

    /**
     * Perform all rendering of component, including toggling visibility to true. Will initialize and create SVG element
     *   if necessary, as well as updating with new data and performing layout actions.
     */
    show() {
        if (!this.parent || !this.parent.selector) { return; }
        if (!this.selector) {
            const group_position = (['start', 'middle', 'end'].indexOf(this.layout.group_position) !== -1 ? ' lz-dashboard-group-' + this.layout.group_position : '');
            this.selector = this.parent.selector.append('div')
                .attr('class', 'lz-dashboard-' + this.layout.position + group_position);
            if (this.layout.style) { this.selector.style(this.layout.style); }
            if (typeof this.initialize == 'function') { this.initialize(); }
        }
        if (this.button && this.button.status === 'highlighted') { this.button.menu.show(); }
        this.selector.style({ visibility: 'visible' });
        this.update();
        return this.position();
    }

    /**
     * Update the dashboard component with any new data or plot state as appropriate. This method performs all
     *  necessary rendering steps.
     */
    update() { /* stub */ }

    /**
     * Place the component correctly in the plot
     * @returns {Component}
     */
    position() {
        if (this.button) { this.button.menu.position(); }
        return this;
    }

    /**
     * Determine whether the component should persist (will bubble up to parent dashboard)
     * @returns {boolean}
     */
    shouldPersist() {
        if (this.persist) { return true; }
        return !!(this.button && this.button.persist);
    }

    /**
     * Toggle visibility to hidden, unless marked as persistent
     * @returns {Component}
     */
    hide() {
        if (!this.selector || this.shouldPersist()) { return this; }
        if (this.button) { this.button.menu.hide(); }
        this.selector.style({ visibility: 'hidden' });
        return this;
    }

    /**
     * Completely remove component and button. (may be overridden by persistence settings)
     * @param {Boolean} [force=false] If true, will ignore persistence settings and always destroy the dashboard
     * @returns {Dashboard}
     */
    destroy (force) {
        if (typeof force == 'undefined') { force = false; }
        if (!this.selector) { return this; }
        if (this.shouldPersist() && !force) { return this; }
        if (this.button && this.button.menu) { this.button.menu.destroy(); }
        this.selector.remove();
        this.selector = null;
        this.button = null;
        return this;
    }
}

/**
 * Plots and panels may have a "dashboard" element suited for showing HTML components that may be interactive.
 *   When components need to incorporate a generic button, or additionally a button that generates a menu, this
 *   class provides much of the necessary framework.
 *
 *   TODO: Improve the base class to support subclassing etc.
 * @param {Component} parent
 */
class Button {
    constructor(parent) {
        if (!(parent instanceof Component)) {
            throw new Error('Unable to create dashboard component button, invalid parent');
        }
        /** @member {Component} */
        this.parent = parent;
        /** @member {Panel} */
        this.parent_panel = this.parent.parent_panel;
        /** @member {Plot} */
        this.parent_plot = this.parent.parent_plot;
        /** @member {Plot|Panel} */
        this.parent_svg = this.parent.parent_svg;

        /** @member {Dashboard|null|*} */
        this.parent_dashboard = this.parent.parent;
        /** @member {d3.selection} */
        this.selector = null;

        /**
         * Tag to use for the button (default: a)
         * @member {String}
         */
        this.tag = 'a';

        /**
         * HTML for the button to show.
         * @protected
         * @member {String}
         */
        this.html = '';
        /**
         * Specify the HTML content of this button.
         * WARNING: The string provided will be inserted into the document as raw markup; XSS mitigation is the
         *   responsibility of each button implementation.
         * @param {String} html
         * @returns {Button}
         */
        this.setHtml = function(html) {
            if (typeof html != 'undefined') { this.html = html.toString(); }
            return this;
        };

        /**
         * Mouseover title text for the button to show
         * @protected
         * @member {String}
         */
        this.title = '';
        /**
         * Set the mouseover title text for the button (if any)
         * @param {String} title Simple text to display
         * @returns {Button}
         */
        this.setTitle = function(title) {
            if (typeof title != 'undefined') { this.title = title.toString(); }
            return this;
        };

        /**
         * Color of the button
         * @member {String}
         */
        this.color = 'gray';

        /**
         * Set the color associated with this button
         * @param {('gray'|'red'|'orange'|'yellow'|'green'|'blue'|'purple')} color Any selection not in the preset list
         *   will be replaced with gray.
         * @returns {Button}
         */
        this.setColor = function(color) {
            if (typeof color != 'undefined') {
                if (['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'].indexOf(color) !== -1) { this.color = color; }
                else { this.color = 'gray'; }
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
         * @returns {Button}
         */
        this.setStyle = function(style) {
            if (typeof style != 'undefined') { this.style = style; }
            return this;
        };

        //
        /**
         * Method to generate a CSS class string
         * @returns {string}
         */
        this.getClass = function() {
            const group_position = (['start', 'middle', 'end'].indexOf(this.parent.layout.group_position) !== -1 ? ' lz-dashboard-button-group-' + this.parent.layout.group_position : '');
            return 'lz-dashboard-button lz-dashboard-button-' + this.color + (this.status ? '-' + this.status : '') + group_position;
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
         * @returns {Button}
         */
        this.setPermanent = function(bool) {
            if (typeof bool == 'undefined') { bool = true; } else { bool = Boolean(bool); }
            this.permanent = bool;
            if (this.permanent) { this.persist = true; }
            return this;
        };
        /**
         * Determine whether the button/menu contents should persist in response to a specific event
         * @returns {Boolean}
         */
        this.shouldPersist = function() {
            return this.permanent || this.persist;
        };

        /**
         * Button status (highlighted / disabled/ etc)
         * @protected
         * @member {String}
         */
        this.status = '';
        /**
         * Change button state
         * @param {('highlighted'|'disabled'|'')} status
         */
        this.setStatus = function(status) {
            if (typeof status != 'undefined' && ['', 'highlighted', 'disabled'].indexOf(status) !== -1) { this.status = status; }
            return this.update();
        };
        /**
         * Toggle whether the button is highlighted
         * @param {boolean} bool If provided, explicitly set highlighted state
         * @returns {Button}
         */
        this.highlight = function(bool) {
            if (typeof bool == 'undefined') { bool = true; } else { bool = Boolean(bool); }
            if (bool) { return this.setStatus('highlighted'); }
            else if (this.status === 'highlighted') { return this.setStatus(''); }
            return this;
        };
        /**
         * Toggle whether the button is disabled
         * @param {boolean} bool If provided, explicitly set disabled state
         * @returns {Button}
         */
        this.disable = function(bool) {
            if (typeof bool == 'undefined') { bool = true; } else { bool = Boolean(bool); }
            if (bool) { return this.setStatus('disabled'); }
            else if (this.status === 'disabled') { return this.setStatus(''); }
            return this;
        };

        // Mouse events
        /** @member {function} */
        this.onmouseover = function() {};
        this.setOnMouseover = function(onmouseover) {
            if (typeof onmouseover == 'function') { this.onmouseover = onmouseover; }
            else { this.onmouseover = function() {}; }
            return this;
        };
        /** @member {function} */
        this.onmouseout = function() {};
        this.setOnMouseout = function(onmouseout) {
            if (typeof onmouseout == 'function') { this.onmouseout = onmouseout; }
            else { this.onmouseout = function() {}; }
            return this;
        };
        /** @member {function} */
        this.onclick = function() {};
        this.setOnclick = function(onclick) {
            if (typeof onclick == 'function') { this.onclick = onclick; }
            else { this.onclick = function() {}; }
            return this;
        };

        // Primary behavior functions
        /**
         * Show the button, including creating DOM elements if necessary for first render
         */
        this.show = function() {
            if (!this.parent) { return; }
            if (!this.selector) {
                this.selector = this.parent.selector.append(this.tag).attr('class', this.getClass());
            }
            return this.update();
        };
        /**
         * Hook for any actions or state cleanup to be performed before rerendering
         * @returns {Button}
         */
        this.preUpdate = function() { return this; };
        /**
         * Update button state and contents, and fully rerender
         * @returns {Button}
         */
        this.update = function() {
            if (!this.selector) { return this; }
            this.preUpdate();
            this.selector
                .attr('class', this.getClass())
                .attr('title', this.title).style(this.style)
                .on('mouseover', (this.status === 'disabled') ? null : this.onmouseover)
                .on('mouseout', (this.status === 'disabled') ? null : this.onmouseout)
                .on('click', (this.status === 'disabled') ? null : this.onclick)
                .html(this.html);
            this.menu.update();
            this.postUpdate();
            return this;
        };
        /**
         * Hook for any behavior to be added/changed after the button has been re-rendered
         * @returns {Button}
         */
        this.postUpdate = function() { return this; };
        /**
         * Hide the button by removing it from the DOM (may be overridden by current persistence setting)
         * @returns {Button}
         */
        this.hide = function() {
            if (this.selector && !this.shouldPersist()) {
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
            show: function() {
                if (!this.menu.outer_selector) {
                    this.menu.outer_selector = d3.select(this.parent_plot.svg.node().parentNode).append('div')
                        .attr('class', 'lz-dashboard-menu lz-dashboard-menu-' + this.color)
                        .attr('id', this.parent_svg.getBaseId() + '.dashboard.menu');
                    this.menu.inner_selector = this.menu.outer_selector.append('div')
                        .attr('class', 'lz-dashboard-menu-content');
                    this.menu.inner_selector.on('scroll', function() {
                        this.menu.scroll_position = this.menu.inner_selector.node().scrollTop;
                    }.bind(this));
                }
                this.menu.outer_selector.style({ visibility: 'visible' });
                this.menu.hidden = false;
                return this.menu.update();
            }.bind(this),
            /**
             * Update the rendering of the menu
             */
            update: function() {
                if (!this.menu.outer_selector) { return this.menu; }
                this.menu.populate(); // This function is stubbed for all buttons by default and custom implemented in component definition
                if (this.menu.inner_selector) { this.menu.inner_selector.node().scrollTop = this.menu.scroll_position; }
                return this.menu.position();
            }.bind(this),
            position: function() {
                if (!this.menu.outer_selector) { return this.menu; }
                // Unset any explicitly defined outer selector height so that menus dynamically shrink if content is removed
                this.menu.outer_selector.style({ height: null });
                const padding = 3;
                const scrollbar_padding = 20;
                const menu_height_padding = 14; // 14: 2x 6px padding, 2x 1px border
                const page_origin = this.parent_svg.getPageOrigin();
                const page_scroll_top = document.documentElement.scrollTop || document.body.scrollTop;
                const container_offset = this.parent_plot.getContainerOffset();
                const dashboard_client_rect = this.parent_dashboard.selector.node().getBoundingClientRect();
                const button_client_rect = this.selector.node().getBoundingClientRect();
                const menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
                const total_content_height = this.menu.inner_selector.node().scrollHeight;
                let top ;
                let left;
                if (this.parent_dashboard.type === 'panel') {
                    top = (page_origin.y + dashboard_client_rect.height + (2 * padding));
                    left = Math.max(page_origin.x + this.parent_svg.layout.width - menu_client_rect.width - padding, page_origin.x + padding);
                } else {
                    top = button_client_rect.bottom + page_scroll_top + padding - container_offset.top;
                    left = Math.max(button_client_rect.left + button_client_rect.width - menu_client_rect.width - container_offset.left, page_origin.x + padding);
                }
                const base_max_width = Math.max(this.parent_svg.layout.width - (2 * padding) - scrollbar_padding, scrollbar_padding);
                const container_max_width = base_max_width;
                const content_max_width = (base_max_width - (4 * padding));
                const base_max_height = Math.max(this.parent_svg.layout.height - (10 * padding) - menu_height_padding, menu_height_padding);
                const height = Math.min(total_content_height, base_max_height);
                this.menu.outer_selector.style({
                    'top': top.toString() + 'px',
                    'left': left.toString() + 'px',
                    'max-width': container_max_width.toString() + 'px',
                    'max-height': base_max_height.toString() + 'px',
                    'height': height.toString() + 'px'
                });
                this.menu.inner_selector.style({ 'max-width': content_max_width.toString() + 'px' });
                this.menu.inner_selector.node().scrollTop = this.menu.scroll_position;
                return this.menu;
            }.bind(this),
            hide: function() {
                if (!this.menu.outer_selector) { return this.menu; }
                this.menu.outer_selector.style({ visibility: 'hidden' });
                this.menu.hidden = true;
                return this.menu;
            }.bind(this),
            destroy: function() {
                if (!this.menu.outer_selector) { return this.menu; }
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
            populate: function() { /* stub */ }.bind(this),
            /**
             * Define how the menu is populated with items, and set up click and display properties as appropriate
             * @public
             */
            setPopulate: function(menu_populate_function) {
                if (typeof menu_populate_function == 'function') {
                    this.menu.populate = menu_populate_function;
                    this.setOnclick(function() {
                        if (this.menu.hidden) {
                            this.menu.show();
                            this.highlight().update();
                            this.persist = true;
                        } else {
                            this.menu.hide();
                            this.highlight(false).update();
                            if (!this.permanent) { this.persist = false; }
                        }
                    }.bind(this));
                } else {
                    this.setOnclick();
                }
                return this;
            }.bind(this)
        };

    }

}


export { Dashboard as _Dashboard, Component, Button };
