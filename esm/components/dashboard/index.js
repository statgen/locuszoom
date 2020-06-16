import {dashboards} from '../../registry';
import d3 from 'd3';

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
        // if (!(parent instanceof LocusZoom.Plot) && !(parent instanceof LocusZoom.Panel)) {
        //     throw new Error('Unable to create dashboard, parent must be a locuszoom plot or panel');
        // }
        /** @member {Plot|Panel} */
        this.parent = parent;
        /** @member {String} */
        this.id = this.parent.getBaseId() + '.dashboard';
        /** @member {('plot'|'panel')} */
        // FIXME: checking constructor name fails, because minified file renames constructor (sigh)
        this.type = this.parent.constructor.name.toLowerCase();
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
            this.parent.layout.dashboard.components.forEach((layout) => {
                try {
                    const component = dashboards.create(layout.type, layout, this);
                    this.components.push(component);
                } catch (e) {
                    console.warn(e);
                }
            });
        }

        // Add mouseover event handlers to show/hide panel dashboard
        if (this.type === 'panel') {
            d3.select(this.parent.parent.svg.node().parentNode).on('mouseover.' + this.id, () => {
                clearTimeout(this.hide_timeout);
                if (!this.selector || this.selector.style('visibility') === 'hidden') {
                    this.show();
                }
            });
            d3.select(this.parent.parent.svg.node().parentNode).on('mouseout.' + this.id, () => {
                clearTimeout(this.hide_timeout);
                this.hide_timeout = setTimeout(() => {
                    this.hide();
                }, 300);
            });
        }

        return this;
    }

    /**
     * Whether to persist the dashboard. Returns true if at least one component should persist, or if the panel is engaged
     *   in an active drag event.
     * @returns {boolean}
     */
    shouldPersist() {
        if (this.persist) {
            return true;
        }
        let persist = false;
        // Persist if at least one component should also persist
        this.components.forEach(function (component) {
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
                    .insert('div', ':first-child');
                break;
            case 'panel':
                this.selector = d3.select(this.parent.parent.svg.node().parentNode)
                    .insert('div', '.lz-data_layer-tooltip, .lz-dashboard-menu, .lz-curtain').classed('lz-panel-dashboard', true);
                break;
            default:
                throw new Error(`Dashboard cannot be a child of ${this.type}`);
            }

            this.selector.classed('lz-dashboard', true).classed('lz-' + this.type + '-dashboard', true).attr('id', this.id);
        }
        this.components.forEach(function (component) {
            component.show();
        });
        this.selector.style({ visibility: 'visible' });
        return this.update();
    }


    /**
     * Update the dashboard and rerender all child components. This can be called whenever plot state changes.
     * @returns {Dashboard}
     */
    update() {
        if (!this.selector) {
            return this;
        }
        this.components.forEach(function (component) {
            component.update();
        });
        return this.position();
    }


    /**
     * Position the dashboard (and child components) within the panel
     * @returns {Dashboard}
     */
    position() {
        if (!this.selector) {
            return this;
        }
        // Position the dashboard itself (panel only)
        if (this.type === 'panel') {
            const page_origin = this.parent.getPageOrigin();
            const top = (page_origin.y + 3.5).toString() + 'px';
            const left = page_origin.x.toString() + 'px';
            const width = (this.parent.layout.width - 4).toString() + 'px';
            this.selector.style({ position: 'absolute', top: top, left: left, width: width });
        }
        // Recursively position components
        this.components.forEach(function (component) {
            component.position();
        });
        return this;
    }

    /**
     * Hide the dashboard (make invisible but do not destroy). Will do nothing if `shouldPersist` returns true.
     *
     * @returns {Dashboard}
     */
    hide() {
        if (!this.selector || this.shouldPersist()) {
            return this;
        }
        this.components.forEach(function (component) {
            component.hide();
        });
        this.selector.style({ visibility: 'hidden' });
        return this;
    }

    /**
     * Completely remove dashboard and all child components. (may be overridden by persistence settings)
     * @param {Boolean} [force=false] If true, will ignore persistence settings and always destroy the dashboard
     * @returns {Dashboard}
     */
    destroy(force) {
        if (typeof force == 'undefined') {
            force = false;
        }
        if (!this.selector) {
            return this;
        }
        if (this.shouldPersist() && !force) {
            return this;
        }
        this.components.forEach(function (component) {
            component.destroy(true);
        });
        this.components = [];
        this.selector.remove();
        this.selector = null;
        return this;
    }
}

export default Dashboard;
