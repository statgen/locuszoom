/** @module */
import * as d3 from 'd3';

import {positionIntToString} from '../../helpers/display';
import {applyStyles} from '../../helpers/common';
import {deepCopy} from '../../helpers/layouts';

// FIXME: Button creation should occur in the constructors, not in update functions

/**
 *
 * A widget is an empty div rendered on a toolbar that can display custom
 * html of user interface elements.
 * @param {Object} layout A JSON-serializable object of layout configuration parameters
 * @param {('left'|'right')} [layout.position='left']  Whether to float the widget left or right.
 * @param {('start'|'middle'|'end')} [layout.group_position] Buttons can optionally be gathered into a visually
 *  distinctive group whose elements are closer together. If a button is identified as the start or end of a group,
 *  it will be drawn with rounded corners and an extra margin of spacing from any button not part of the group.
 *  For example, the region_nav_plot toolbar is a defined as a group.
 * @param {('gray'|'red'|'orange'|'yellow'|'green'|'blue'|'purple')} [layout.color='gray']  Color scheme for the
 *   widget. Applies to buttons and menus.
 * @param {Toolbar} parent The toolbar that contains this widget
 */
class BaseWidget {
    constructor(layout, parent) {
        /** @member {Object} */
        this.layout = layout || {};
        if (!this.layout.color) {
            this.layout.color = 'gray';
        }

        /** @member {Toolbar|*} */
        this.parent = parent || null;
        /**
         * Some widgets are attached to a panel, rather than directly to a plot
         * @member {Panel|null}
         */
        this.parent_panel = null;
        /** @member {Plot} */
        this.parent_plot = null;
        /**
         * This is a reference to either the panel or the plot, depending on what the toolbar is
         *   tied to. Useful when absolutely positioning toolbar widgets relative to their SVG anchor.
         * @member {Plot|Panel}
         */
        this.parent_svg = null;
        if (this.parent) {
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
         * If this is an interactive widget, it will contain a button or menu instance that handles the interactivity.
         *   There is a 1-to-1 relationship of toolbar widget to button
         * @member {null|Button}
         */
        this.button = null;
        /**
         * If any single widget is marked persistent, it will bubble up to prevent automatic hide behavior on a
         *   widget's parent toolbar. Check via `shouldPersist`
         * @protected
         * @member {Boolean}
         */
        this.persist = false;
        if (!this.layout.position) {
            this.layout.position = 'left';
        }
    }

    /**
     * Perform all rendering of widget, including toggling visibility to true. Will initialize and create SVG element
     *   if necessary, as well as updating with new data and performing layout actions.
     */
    show() {
        if (!this.parent || !this.parent.selector) {
            return;
        }
        if (!this.selector) {
            const group_position = (['start', 'middle', 'end'].includes(this.layout.group_position) ? ` lz-toolbar-group-${this.layout.group_position}` : '');
            this.selector = this.parent.selector.append('div')
                .attr('class', `lz-toolbar-${this.layout.position}${group_position}`);
            if (this.layout.style) {
                applyStyles(this.selector, this.layout.style);
            }
            if (typeof this.initialize == 'function') {
                this.initialize();
            }
        }
        if (this.button && this.button.status === 'highlighted') {
            this.button.menu.show();
        }
        this.selector.style('visibility', 'visible');
        this.update();
        return this.position();
    }

    /**
     * Update the toolbar widget with any new data or plot state as appropriate. This method performs all
     *  necessary rendering steps.
     */
    update() { /* stub */
    }

    /**
     * Place the widget correctly in the plot
     * @returns {BaseWidget}
     */
    position() {
        if (this.button) {
            this.button.menu.position();
        }
        return this;
    }

    /**
     * Determine whether the widget should persist (will bubble up to parent toolbar)
     * @returns {boolean}
     */
    shouldPersist() {
        if (this.persist) {
            return true;
        }
        return !!(this.button && this.button.persist);
    }

    /**
     * Toggle visibility to hidden, unless marked as persistent
     * @returns {BaseWidget}
     */
    hide() {
        if (!this.selector || this.shouldPersist()) {
            return this;
        }
        if (this.button) {
            this.button.menu.hide();
        }
        this.selector.style('visibility', 'hidden');
        return this;
    }

    /**
     * Completely remove widget and button. (may be overridden by persistence settings)
     * @param {Boolean} [force=false] If true, will ignore persistence settings and always destroy the toolbar
     * @returns {Toolbar}
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
        if (this.button && this.button.menu) {
            this.button.menu.destroy();
        }
        this.selector.remove();
        this.selector = null;
        this.button = null;
        return this;
    }
}

/**
 * Plots and panels may have a "toolbar" element suited for showing HTML widgets that may be interactive.
 *   When widgets need to incorporate a generic button, or additionally a button that generates a menu, this
 *   class provides much of the necessary framework.
 * @param {BaseWidget} parent
 */
class Button {
    constructor(parent) {
        if (!(parent instanceof BaseWidget)) {
            throw new Error('Unable to create toolbar widget button, invalid parent');
        }
        /** @member {BaseWidget} */
        this.parent = parent;
        /** @member {Panel} */
        this.parent_panel = this.parent.parent_panel;
        /** @member {Plot} */
        this.parent_plot = this.parent.parent_plot;
        /** @member {Plot|Panel} */
        this.parent_svg = this.parent.parent_svg;

        /** @member {Toolbar|null|*} */
        this.parent_toolbar = this.parent.parent;
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
         * Mouseover title text for the button to show
         * @protected
         * @member {String}
         */
        this.title = '';

        /**
         * Color of the button
         * @member {String}
         */
        this.color = 'gray';

        /**
         * Hash of arbitrary button styles to apply as {name: value} entries
         * @protected
         * @member {Object}
         */
        this.style = {};

        // Permanence
        /**
         * Track internal state on whether to keep showing the button/ menu contents at the moment
         * @protected
         * @member {Boolean}
         */
        this.persist = false;
        /**
         * Configuration when defining a button: track whether this widget should be allowed to keep open
         *   menu/button contents in response to certain events
         * @protected
         * @member {Boolean}
         */
        this.permanent = false;

        /**
         * Button status (highlighted / disabled/ etc)
         * @protected
         * @member {String}
         */
        this.status = '';

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
            show: () => {
                if (!this.menu.outer_selector) {
                    this.menu.outer_selector = d3.select(this.parent_plot.svg.node().parentNode).append('div')
                        .attr('class', `lz-toolbar-menu lz-toolbar-menu-${this.color}`)
                        .attr('id', `${this.parent_svg.getBaseId()}.toolbar.menu`);
                    this.menu.inner_selector = this.menu.outer_selector.append('div')
                        .attr('class', 'lz-toolbar-menu-content');
                    this.menu.inner_selector.on('scroll', () => {
                        this.menu.scroll_position = this.menu.inner_selector.node().scrollTop;
                    });
                }
                this.menu.outer_selector.style('visibility', 'visible');
                this.menu.hidden = false;
                return this.menu.update();
            },
            /**
             * Update the rendering of the menu
             */
            update: () => {
                if (!this.menu.outer_selector) {
                    return this.menu;
                }
                this.menu.populate(); // This function is stubbed for all buttons by default and custom implemented in widget definition
                if (this.menu.inner_selector) {
                    this.menu.inner_selector.node().scrollTop = this.menu.scroll_position;
                }
                return this.menu.position();
            },
            position: () => {
                if (!this.menu.outer_selector) {
                    return this.menu;
                }
                // Unset any explicitly defined outer selector height so that menus dynamically shrink if content is removed
                this.menu.outer_selector.style('height', null);
                const padding = 3;
                const scrollbar_padding = 20;
                const menu_height_padding = 14; // 14: 2x 6px padding, 2x 1px border
                const page_origin = this.parent_svg.getPageOrigin();
                const page_scroll_top = document.documentElement.scrollTop || document.body.scrollTop;
                const container_offset = this.parent_plot.getContainerOffset();
                const toolbar_client_rect = this.parent_toolbar.selector.node().getBoundingClientRect();
                const button_client_rect = this.selector.node().getBoundingClientRect();
                const menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
                const total_content_height = this.menu.inner_selector.node().scrollHeight;
                let top;
                let left;
                if (this.parent_toolbar.type === 'panel') {
                    top = (page_origin.y + toolbar_client_rect.height + (2 * padding));
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
                this.menu.outer_selector
                    .style('top', `${top.toString()}px`)
                    .style('left', `${left.toString()}px`)
                    .style('max-width', `${container_max_width.toString()}px`)
                    .style('max-height', `${base_max_height.toString()}px`)
                    .style('height', `${height.toString()}px`);
                this.menu.inner_selector
                    .style('max-width', `${content_max_width.toString()}px`);
                this.menu.inner_selector.node().scrollTop = this.menu.scroll_position;
                return this.menu;
            },
            hide: () => {
                if (!this.menu.outer_selector) {
                    return this.menu;
                }
                this.menu.outer_selector.style('visibility', 'hidden');
                this.menu.hidden = true;
                return this.menu;
            },
            destroy: () => {
                if (!this.menu.outer_selector) {
                    return this.menu;
                }
                this.menu.inner_selector.remove();
                this.menu.outer_selector.remove();
                this.menu.inner_selector = null;
                this.menu.outer_selector = null;
                return this.menu;
            },
            /**
             * Internal method definition
             * By convention populate() does nothing and should be reimplemented with each toolbar button definition
             *   Reimplement by way of Toolbar.BaseWidget.Button.menu.setPopulate to define the populate method and hook
             *   up standard menu click-toggle behavior prototype.
             * @protected
             */
            populate: () => {
                throw new Error('Method must be implemented');
            },
            /**
             * Define how the menu is populated with items, and set up click and display properties as appropriate
             * @public
             */
            setPopulate: (menu_populate_function) => {
                if (typeof menu_populate_function == 'function') {
                    this.menu.populate = menu_populate_function;
                    this.setOnclick(() => {
                        if (this.menu.hidden) {
                            this.menu.show();
                            this.highlight().update();
                            this.persist = true;
                        } else {
                            this.menu.hide();
                            this.highlight(false).update();
                            if (!this.permanent) {
                                this.persist = false;
                            }
                        }
                    });
                } else {
                    this.setOnclick();
                }
                return this;
            }
        };
    }

    /**
     * Set the color associated with this button
     * @param {('gray'|'red'|'orange'|'yellow'|'green'|'blue'|'purple')} color Any selection not in the preset list
     *   will be replaced with gray.
     * @returns {Button}
     */
    setColor (color) {
        if (typeof color != 'undefined') {
            if (['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'].includes(color)) {
                this.color = color;
            } else {
                this.color = 'gray';
            }
        }
        return this;
    }


    /**
     * Allow code to change whether the button is allowed to be `permanent`
     * @param {boolean} bool
     * @returns {Button}
     */
    setPermanent (bool) {
        if (typeof bool == 'undefined') {
            bool = true;
        } else {
            bool = Boolean(bool);
        }
        this.permanent = bool;
        if (this.permanent) {
            this.persist = true;
        }
        return this;
    }
    /**
     * Determine whether the button/menu contents should persist in response to a specific event
     * @returns {Boolean}
     */
    shouldPersist () {
        return this.permanent || this.persist;
    }

    /**
 * Set a collection of custom styles to be used by the button
 * @param {Object} style Hash of {name:value} entries
 * @returns {Button}
 */
    setStyle (style) {
        if (typeof style != 'undefined') {
            this.style = style;
        }
        return this;
    }

    //
    /**
     * Method to generate a CSS class string
     * @returns {string}
     */
    getClass () {
        const group_position = (['start', 'middle', 'end'].includes(this.parent.layout.group_position) ? ` lz-toolbar-button-group-${this.parent.layout.group_position}` : '');
        return `lz-toolbar-button lz-toolbar-button-${this.color}${this.status ? `-${this.status}` : ''}${group_position}`;
    }


    /**
     * Change button state
     * @param {('highlighted'|'disabled'|'')} status
     */
    setStatus  (status) {
        if (typeof status != 'undefined' && ['', 'highlighted', 'disabled'].includes(status)) {
            this.status = status;
        }
        return this.update();
    }

    /**
     * Toggle whether the button is highlighted
     * @param {boolean} bool If provided, explicitly set highlighted state
     * @returns {Button}
     */
    highlight (bool) {
        if (typeof bool == 'undefined') {
            bool = true;
        } else {
            bool = Boolean(bool);
        }
        if (bool) {
            return this.setStatus('highlighted');
        } else if (this.status === 'highlighted') {
            return this.setStatus('');
        }
        return this;
    }

    /**
     * Toggle whether the button is disabled
     * @param {boolean} bool If provided, explicitly set disabled state
     * @returns {Button}
     */
    disable (bool) {
        if (typeof bool == 'undefined') {
            bool = true;
        } else {
            bool = Boolean(bool);
        }
        if (bool) {
            return this.setStatus('disabled');
        } else if (this.status === 'disabled') {
            return this.setStatus('');
        }
        return this;
    }

    // Mouse events
    /** @member {function} */
    onmouseover () {
    }
    setOnMouseover (onmouseover) {
        if (typeof onmouseover == 'function') {
            this.onmouseover = onmouseover;
        } else {
            this.onmouseover = function () {};
        }
        return this;
    }
    /** @member {function} */
    onmouseout () {
    }
    setOnMouseout (onmouseout) {
        if (typeof onmouseout == 'function') {
            this.onmouseout = onmouseout;
        } else {
            this.onmouseout = function () {};
        }
        return this;
    }
    /** @member {function} */
    onclick () {
    }
    setOnclick (onclick) {
        if (typeof onclick == 'function') {
            this.onclick = onclick;
        } else {
            this.onclick = function () {};
        }
        return this;
    }

    /**
     * Set the mouseover title text for the button (if any)
     * @param {String} title Simple text to display
     * @returns {Button}
     */
    setTitle(title) {
        if (typeof title != 'undefined') {
            this.title = title.toString();
        }
        return this;
    }

    /**
     * Specify the HTML content of this button.
     * WARNING: The string provided will be inserted into the document as raw markup; XSS mitigation is the
     *   responsibility of each button implementation.
     * @param {String} html
     * @returns {Button}
     */
    setHtml(html) {
        if (typeof html != 'undefined') {
            this.html = html.toString();
        }
        return this;
    }

    // Primary behavior functions
    /**
     * Show the button, including creating DOM elements if necessary for first render
     */
    show () {
        if (!this.parent) {
            return;
        }
        if (!this.selector) {
            this.selector = this.parent.selector.append(this.tag)
                .attr('class', this.getClass());
        }
        return this.update();
    }

    /**
     * Hook for any actions or state cleanup to be performed before rerendering
     * @returns {Button}
     */
    preUpdate () {
        return this;
    }

    /**
     * Update button state and contents, and fully rerender
     * @returns {Button}
     */
    update () {
        if (!this.selector) {
            return this;
        }
        this.preUpdate();
        this.selector
            .attr('class', this.getClass())
            .attr('title', this.title)
            .on('mouseover', (this.status === 'disabled') ? null : this.onmouseover)
            .on('mouseout', (this.status === 'disabled') ? null : this.onmouseout)
            .on('click', (this.status === 'disabled') ? null : this.onclick)
            .html(this.html)
            .call(applyStyles, this.style);

        this.menu.update();
        this.postUpdate();
        return this;
    }

    /**
     * Hook for any behavior to be added/changed after the button has been re-rendered
     * @returns {Button}
     */
    postUpdate () {
        return this;
    }

    /**
     * Hide the button by removing it from the DOM (may be overridden by current persistence setting)
     * @returns {Button}
     */
    hide() {
        if (this.selector && !this.shouldPersist()) {
            this.selector.remove();
            this.selector = null;
        }
        return this;
    }

}

/**
 * Renders arbitrary text with title formatting
 * @param {object} layout
 * @param {string} layout.title Text to render
 */
class Title extends BaseWidget {
    show() {
        if (!this.div_selector) {
            this.div_selector = this.parent.selector.append('div')
                .attr('class', `lz-toolbar-title lz-toolbar-${this.layout.position}`);
            this.title_selector = this.div_selector.append('h3');
        }
        return this.update();
    }

    update() {
        let title = this.layout.title.toString();
        if (this.layout.subtitle) {
            title += ` <small>${this.layout.subtitle}</small>`;
        }
        this.title_selector.html(title);
        return this;
    }
}

/**
 * Renders text to display the current dimensions of the plot. Automatically updated as plot dimensions change
 */
class Dimensions extends BaseWidget {
    update() {
        const display_width = !this.parent_plot.layout.width.toString().includes('.') ? this.parent_plot.layout.width : this.parent_plot.layout.width.toFixed(2);
        const display_height = !this.parent_plot.layout.height.toString().includes('.') ? this.parent_plot.layout.height : this.parent_plot.layout.height.toFixed(2);
        this.selector.html(`${display_width}px × ${display_height}px`);
        if (this.layout.class) {
            this.selector.attr('class', this.layout.class);
        }
        if (this.layout.style) {
            applyStyles(this.selector, this.layout.style);
        }
        return this;
    }
}

/**
 * Display the current scale of the genome region displayed in the plot, as defined by the difference between
 *  `state.end` and `state.start`.
 */
class RegionScale extends BaseWidget {
    update() {
        if (!isNaN(this.parent_plot.state.start) && !isNaN(this.parent_plot.state.end)
            && this.parent_plot.state.start !== null && this.parent_plot.state.end !== null) {
            this.selector.style('display', null);
            this.selector.html(positionIntToString(this.parent_plot.state.end - this.parent_plot.state.start, null, true));
        } else {
            this.selector.style('display', 'none');
        }
        if (this.layout.class) {
            this.selector.attr('class', this.layout.class);
        }
        if (this.layout.style) {
            applyStyles(this.selector, this.layout.style);
        }
        return this;
    }
}

/**
 * Button to export current plot to an SVG image
 * @param {string} [layout.button_html="Download Image"]
 * @param {string} [layout.button_title="Download image of the current plot as locuszoom.svg"]
 * @param {string} [layout.filename="locuszoom.svg"] The default filename to use when saving the image
 */
class DownloadSVG extends BaseWidget {
    constructor(layout, parent) {
        super(layout, parent);
        this.css_string = '';
        for (let stylesheet in Object.keys(document.styleSheets)) {
            if ( document.styleSheets[stylesheet].href !== null
                 && document.styleSheets[stylesheet].href.includes('locuszoom.css')) {
                // FIXME: "Download image" button will render the image incorrectly if the stylesheet has been renamed or concatenated
                fetch(document.styleSheets[stylesheet].href).then((response) => {
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }
                    return response.text();
                }).then((response) => {
                    this.css_string = response.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ');
                    if (this.css_string.includes('/* ! LocusZoom HTML Styles */')) {
                        this.css_string = this.css_string.substring(0, this.css_string.indexOf('/* ! LocusZoom HTML Styles */'));
                    }
                });
                // Found stylesheet we want, stop checking others
                break;
            }
        }
    }

    update() {
        if (this.button) {
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html || 'Download Image')
            .setTitle(this.layout.button_title || 'Download image of the current plot as locuszoom.svg')
            .setOnMouseover(() => {
                this.button.selector
                    .classed('lz-toolbar-button-gray-disabled', true)
                    .html('Preparing Image');
                this.getBlobUrl().then((url) => {
                    const old = this.button.selector.attr('href');
                    if (old) {
                        // Clean up old url instance to prevent memory leaks
                        URL.revokeObjectURL(old);
                    }
                    this.button.selector
                        .attr('href', url)
                        .classed('lz-toolbar-button-gray-disabled', false)
                        .classed('lz-toolbar-button-gray-highlighted', true)
                        .html(this.layout.button_html || 'Download Image');
                });
            })
            .setOnMouseout(() => {
                this.button.selector.classed('lz-toolbar-button-gray-highlighted', false);
            });
        this.button.show();
        this.button.selector
            .attr('href-lang', 'image/svg+xml')
            .attr('download', this.layout.filename || 'locuszoom.svg');
        return this;
    }

    generateSVG () {
        return new Promise((resolve) => {
            // Insert a hidden div, clone the node into that so we can modify it with d3
            let copy = this.parent_plot.svg.node().cloneNode(true);
            copy.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
            copy = d3.select(copy);

            // Remove unnecessary elements
            copy.selectAll('g.lz-curtain').remove();
            copy.selectAll('g.lz-mouse_guide').remove();
            // Convert units on axis tick dy attributes from ems to pixels
            copy.selectAll('g.tick text').each(function() {
                const dy = +(d3.select(this).attr('dy').substring(-2).slice(0, -2)) * 10;
                d3.select(this).attr('dy', dy);
            });
            // Pull the svg into a string and add the contents of the locuszoom stylesheet
            // Don't add this with d3 because it will escape the CDATA declaration incorrectly
            const serializer = new XMLSerializer();
            let initial_html = serializer.serializeToString(copy.node());
            const style_def = `<style type="text/css"><![CDATA[ ${this.css_string} ]]></style>`;
            const insert_at = initial_html.indexOf('>') + 1;
            initial_html = initial_html.slice(0, insert_at) + style_def + initial_html.slice(insert_at);
            // Create an object URL based on the rendered markup
            resolve(initial_html);
        });
    }

    /**
     * Converts the SVG string into a downloadable binary object
     */
    getBlobUrl() {
        this.generateSVG()
            .then((markup) => {
                const blob = new Blob([markup], { type: 'image/svg+xml' });
                return URL.createObjectURL(blob);
            });
    }
}

/**
 * Button to remove panel from plot.
 *   NOTE: Will only work on panel widgets.
 * @param {Boolean} [layout.suppress_confirm=false] If true, removes the panel without prompting user for confirmation
 */
class RemovePanel extends BaseWidget {
    update() {
        if (this.button) {
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml('×')
            .setTitle('Remove panel')
            .setOnclick(() => {
                if (!this.layout.suppress_confirm && !confirm('Are you sure you want to remove this panel? This cannot be undone!')) {
                    return false;
                }
                const panel = this.parent_panel;
                panel.toolbar.hide(true);
                d3.select(panel.parent.svg.node().parentNode).on(`mouseover.${panel.getBaseId()}.toolbar`, null);
                d3.select(panel.parent.svg.node().parentNode).on(`mouseout.${panel.getBaseId()}.toolbar`, null);
                return panel.parent.removePanel(panel.id);
            });
        this.button.show();
        return this;
    }
}

/**
 * Button to move panel up relative to other panels (in terms of y-index on the page)
 *   NOTE: Will only work on panel widgets.
 */
class MovePanelUp extends BaseWidget {
    update () {
        if (this.button) {
            const is_at_top = (this.parent_panel.layout.y_index === 0);
            this.button.disable(is_at_top);
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml('▴')
            .setTitle('Move panel up')
            .setOnclick(() => {
                this.parent_panel.moveUp();
                this.update();
            });
        this.button.show();
        return this.update();
    }
}

/**
 * Button to move panel down relative to other panels (in terms of y-index on the page)
 *   NOTE: Will only work on panel widgets.
 */
class MovePanelDown extends BaseWidget {
    update () {
        if (this.button) {
            const is_at_bottom = (this.parent_panel.layout.y_index === this.parent_plot.panel_ids_by_y_index.length - 1);
            this.button.disable(is_at_bottom);
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml('▾')
            .setTitle('Move panel down')
            .setOnclick(() => {
                this.parent_panel.moveDown();
                this.update();
            });
        this.button.show();
        return this.update();
    }
}

/**
 * Button to shift plot region forwards or back by a `step` increment provided in the layout
 * @param {object} layout
 * @param {number} [layout.step=50000] The stepsize to change the region by
 * @param {string} [layout.button_html]
 * @param {string} [layout.button_title]
 */
class ShiftRegion extends BaseWidget {
    constructor(layout, parent) {
        if (isNaN(layout.step) || layout.step === 0) {
            layout.step = 50000;
        }
        if (typeof layout.button_html !== 'string') {
            layout.button_html = layout.step > 0 ? '>' : '<';
        }

        if (typeof layout.button_title !== 'string') {
            layout.button_title = `Shift region by ${layout.step > 0 ? '+' : '-'}${positionIntToString(Math.abs(layout.step), null, true)}`;
        }
        super(layout, parent);
        if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)) {
            throw new Error('Unable to add shift_region toolbar widget: plot state does not have region bounds');
        }


    }

    update () {
        if (this.button) {
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html)
            .setTitle(this.layout.button_title)
            .setOnclick(() => {
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start + this.layout.step, 1),
                    end: this.parent_plot.state.end + this.layout.step
                });
            });
        this.button.show();
        return this;
    }
}

/**
 * Zoom in or out on the plot, centered on the middle of the plot region, by the specified amount
 * @param {object} layout
 * @param {number} [layout.step=0.2] The amount to zoom in by (where 1 indicates 100%)
 */
class ZoomRegion extends BaseWidget {
    constructor(layout, parent) {
        if (isNaN(layout.step) || layout.step === 0) {
            layout.step = 0.2;
        }
        if (typeof layout.button_html != 'string') {
            layout.button_html = layout.step > 0 ? 'z–' : 'z+';
        }
        if (typeof layout.button_title != 'string') {
            layout.button_title = `Zoom region ${layout.step > 0 ? 'out' : 'in'} by ${(Math.abs(layout.step) * 100).toFixed(1)}%`;
        }

        super(layout, parent);
        if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)) {
            throw new Error('Unable to add zoom_region toolbar widget: plot state does not have region bounds');
        }
    }

    update () {
        if (this.button) {
            let can_zoom = true;
            const current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
            if (this.layout.step > 0 && !isNaN(this.parent_plot.layout.max_region_scale) && current_region_scale >= this.parent_plot.layout.max_region_scale) {
                can_zoom = false;
            }
            if (this.layout.step < 0 && !isNaN(this.parent_plot.layout.min_region_scale) && current_region_scale <= this.parent_plot.layout.min_region_scale) {
                can_zoom = false;
            }
            this.button.disable(!can_zoom);
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html)
            .setTitle(this.layout.button_title)
            .setOnclick(() => {
                const current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
                const zoom_factor = 1 + this.layout.step;
                let new_region_scale = current_region_scale * zoom_factor;
                if (!isNaN(this.parent_plot.layout.max_region_scale)) {
                    new_region_scale = Math.min(new_region_scale, this.parent_plot.layout.max_region_scale);
                }
                if (!isNaN(this.parent_plot.layout.min_region_scale)) {
                    new_region_scale = Math.max(new_region_scale, this.parent_plot.layout.min_region_scale);
                }
                const delta = Math.floor((new_region_scale - current_region_scale) / 2);
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start - delta, 1),
                    end: this.parent_plot.state.end + delta
                });
            });
        this.button.show();
        return this;
    }
}

/**
 * Renders button with arbitrary text that, when clicked, shows a dropdown containing arbitrary HTML
 *  NOTE: Trusts content exactly as given. XSS prevention is the responsibility of the implementer.
 * @param {object} layout
 * @param {string} layout.button_html The HTML to render inside the button
 * @param {string} layout.button_title Text to display as a tooltip when hovering over the button
 * @param {string} layout.menu_html The HTML content of the dropdown menu
 */
class Menu extends BaseWidget {
    update() {
        if (this.button) {
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html)
            .setTitle(this.layout.button_title);
        this.button.menu.setPopulate(() => {
            this.button.menu.inner_selector.html(this.layout.menu_html);
        });
        this.button.show();
        return this;
    }
}

/**
 * Button to resize panel height to fit available data (eg when showing a list of tracks)
 * @param {string} [layout.button_html="Resize to Data"]
 * @param {string} [layout.button_title]
 */
class ResizeToData extends BaseWidget {
    update() {
        if (this.button) {
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html || 'Resize to Data')
            .setTitle(this.layout.button_title || 'Automatically resize this panel to show all data available')
            .setOnclick(() => {
                this.parent_panel.scaleHeightToData();
                this.update();
            });
        this.button.show();
        return this;
    }
}

/**
 * Button to toggle legend
 */
class ToggleLegend extends BaseWidget {
    update() {
        const html = this.parent_panel.legend.layout.hidden ? 'Show Legend' : 'Hide Legend';
        if (this.button) {
            this.button.setHtml(html).show();
            this.parent.position();
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setTitle('Show or hide the legend for this panel')
            .setOnclick(() => {
                this.parent_panel.legend.layout.hidden = !this.parent_panel.legend.layout.hidden;
                this.parent_panel.legend.render();
                this.update();
            });
        return this.update();
    }
}

/**
 * Dropdown menu allowing the user to choose between different display options for a single specific data layer
 *  within a panel.
 *
 * This allows controlling how points on a datalayer can be displayed- any display options supported via the layout for the target datalayer. This includes point
 *  size/shape, coloring, etc.
 *
 * This button intentionally limits display options it can control to those available on common plot types.
 *   Although the list of options it sets can be overridden (to control very special custom plot types), this
 *   capability should be used sparingly if at all.
 *
 * @param {object} layout
 * @param {String} [layout.button_html="Display options..."] Text to display on the toolbar button
 * @param {String} [layout.button_title="Control how plot items are displayed"] Hover text for the toolbar button
 * @param {string} layout.layer_name Specify the datalayer that this button should affect
 * @param {string} [layout.default_config_display_name] Store the default configuration for this datalayer
 *  configuration, and show a button to revert to the "default" (listing the human-readable display name provided)
 * @param {Array} [layout.fields_whitelist='see code'] The list of presentation fields that this button can control.
 *  This can be overridden if this button needs to be used on a custom layer type with special options.
 * @typedef {{display_name: string, display: Object}} DisplayOptionsButtonConfigField
 * @param {DisplayOptionsButtonConfigField[]} layout.options Specify a label and set of layout directives associated
 *  with this `display` option. Display field should include all changes to datalayer presentation options.
 */
class DisplayOptions extends BaseWidget {
    constructor(layout, parent) {
        if (typeof layout.button_html != 'string') {
            layout.button_html = 'Display options...';
        }
        if (typeof layout.button_title != 'string') {
            layout.button_title = 'Control how plot items are displayed';
        }
        super(...arguments);

        // List of layout fields that this button is allowed to control. This ensures that we don't override any other
        //  information (like plot height etc) while changing point rendering
        const allowed_fields = layout.fields_whitelist || ['color', 'fill_opacity', 'label', 'legend',
            'point_shape', 'point_size', 'tooltip', 'tooltip_positioning'];

        const dataLayer = this.parent_panel.data_layers[layout.layer_name];
        if (!dataLayer) {
            throw new Error(`Display options could not locate the specified layer_name: '${layout.layer_name}'`);
        }
        const dataLayerLayout = dataLayer.layout;

        // Store default configuration for the layer as a clean deep copy, so we may revert later
        const defaultConfig = {};
        allowed_fields.forEach((name) => {
            const configSlot = dataLayerLayout[name];
            if (configSlot !== undefined) {
                defaultConfig[name] =  deepCopy(configSlot);
            }
        });

        /**
         * Which item in the menu is currently selected. (track for rerendering menu)
         * @member {String}
         * @private
         */
        this._selected_item = 'default';

        // Define the button + menu that provides the real functionality for this toolbar widget

        this.button = new Button(this)
            .setColor(layout.color)
            .setHtml(layout.button_html)
            .setTitle(layout.button_title)
            .setOnclick(() => {
                this.button.menu.populate();
            });
        this.button.menu.setPopulate(() => {
            // Multiple copies of this button might be used on a single LZ page; append unique IDs where needed
            const uniqueID = Math.floor(Math.random() * 1e4).toString();

            this.button.menu.inner_selector.html('');
            const table = this.button.menu.inner_selector.append('table');

            const menuLayout = this.layout;

            const renderRow = (display_name, display_options, row_id) => { // Helper method
                const row = table.append('tr');
                const radioId = `${uniqueID}${row_id}`;
                row.append('td')
                    .append('input')
                    .attr('id', radioId)
                    .attr('type', 'radio')
                    .attr('name', `display-option-${uniqueID}`)
                    .attr('value', row_id)
                    .style('margin', 0) // Override css libraries (eg skeleton) that style form inputs
                    .property('checked', (row_id === this._selected_item))
                    .on('click', () => {
                        // If an option is not specified in these display options, use the original defaults
                        allowed_fields.forEach((field_name) => {
                            dataLayer.layout[field_name] = display_options[field_name] || defaultConfig[field_name];
                        });

                        this._selected_item = row_id;
                        this.parent_panel.render();
                        const legend = this.parent_panel.legend;
                        if (legend) {
                            legend.render();
                        }
                    });
                row.append('td').append('label')
                    .style('font-weight', 'normal')
                    .attr('for', radioId)
                    .text(display_name);
            };
            // Render the "display options" menu: default and special custom options
            const defaultName = menuLayout.default_config_display_name || 'Default style';
            renderRow(defaultName, defaultConfig, 'default');
            menuLayout.options.forEach((item, index) => renderRow(item.display_name, item.display, index));
            return this;
        });
    }

    update() {
        this.button.show();
        return this;
    }
}

/**
 * Dropdown menu allowing the user to set the value of a specific `state_field` in plot.state
 * This is useful for things (like datasources) that allow dynamic configuration based on global information in state
 *
 * For example, the LDServer data source can use it to change LD reference population (for all panels) after render
 *
 * @param {object} layout
 * @param {String} [layout.button_html="Set option..."] Text to display on the toolbar button
 * @param {String} [layout.button_title="Choose an option to customize the plot"] Hover text for the toolbar button
 * @param {bool} [layout.show_selected=false] Whether to append the selected value to the button label
 * @param {string} [layout.state_field] The name of the field in plot.state that will be set by this button
 * @typedef {{display_name: string, value: *}} SetStateOptionsConfigField
 * @param {SetStateOptionsConfigField[]} layout.options Specify human labels and associated values for the dropdown menu
 */
class SetState extends BaseWidget {
    constructor(layout, parent) {
        if (typeof layout.button_html != 'string') {
            layout.button_html = 'Set option...';
        }
        if (typeof layout.button_title != 'string') {
            layout.button_title = 'Choose an option to customize the plot';
        }

        super(layout, parent);

        if (this.parent_panel) {
            throw new Error('This widget is designed to set global options, so it can only be used at the top (plot) level');
        }
        if (!layout.state_field) {
            throw new Error('Must specify the `state_field` that this widget controls');
        }

        /**
         * Which item in the menu is currently selected. (track for rerendering menu)
         * @member {String}
         * @private
         */
        // The first option listed is automatically assumed to be the default, unless a value exists in plot.state
        this._selected_item = this.parent_plot.state[layout.state_field] || layout.options[0].value;
        if (!layout.options.find((item) => {
            return item.value === this._selected_item;
        })) {
            // Check only gets run at widget creation, but generally this widget is assumed to be an exclusive list of options
            throw new Error('There is an existing state value that does not match the known values in this widget');
        }

        // Define the button + menu that provides the real functionality for this toolbar widget
        this.button = new Button(this)
            .setColor(layout.color)
            .setHtml(layout.button_html + (layout.show_selected ? this._selected_item : ''))
            .setTitle(layout.button_title)
            .setOnclick(() => {
                this.button.menu.populate();
            });
        this.button.menu.setPopulate(() => {
            // Multiple copies of this button might be used on a single LZ page; append unique IDs where needed
            const uniqueID = Math.floor(Math.random() * 1e4).toString();

            this.button.menu.inner_selector.html('');
            const table = this.button.menu.inner_selector.append('table');

            const renderRow = (display_name, value, row_id) => { // Helper method
                const row = table.append('tr');
                const radioId = `${uniqueID}${row_id}`;
                row.append('td')
                    .append('input')
                    .attr('id', radioId)
                    .attr('type', 'radio')
                    .attr('name', `set-state-${uniqueID}`)
                    .attr('value', row_id)
                    .style('margin', 0) // Override css libraries (eg skeleton) that style form inputs
                    .property('checked', (value === this._selected_item))
                    .on('click', () => {
                        const new_state = {};
                        new_state[layout.state_field] = value;
                        this._selected_item = value;
                        this.parent_plot.applyState(new_state);
                        this.button.setHtml(layout.button_html + (layout.show_selected ? this._selected_item : ''));
                    });
                row.append('td').append('label')
                    .style('font-weight', 'normal')
                    .attr('for', radioId)
                    .text(display_name);
            };
            layout.options.forEach((item, index) => renderRow(item.display_name, item.value, index));
            return this;
        });
    }

    update() {
        this.button.show();
        return this;
    }
}


export {
    BaseWidget,  // This is used to create subclasses
    Button as _Button, // This is used to create Widgets that contain a button. It actually shouldn't be in the registry because it's not usable directly..
    Dimensions as dimensions,
    DisplayOptions as display_options,
    DownloadSVG as download,
    Menu as menu,
    MovePanelDown as move_panel_down,
    MovePanelUp as move_panel_up,
    RegionScale as region_scale,
    ResizeToData as resize_to_data,
    SetState as set_state,
    ShiftRegion as shift_region,
    RemovePanel as remove_panel,
    Title as title,
    ToggleLegend as toggle_legend,
    ZoomRegion as zoom_region,
};
