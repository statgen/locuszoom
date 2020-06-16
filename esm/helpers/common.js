// FIXME: A place for code that used to live under the `LocusZoom` namespace
// Eventually this should be moved into classes or some other mechanism for code sharing. No external uses should
//  depend on any items in this module.

import d3 from 'd3';

/**
 * Generate a curtain object for a plot, panel, or any other subdivision of a layout
 * The panel curtain, like the plot curtain is an HTML overlay that obscures the entire panel. It can be styled
 *   arbitrarily and display arbitrary messages. It is useful for reporting error messages visually to an end user
 *   when the error renders the panel unusable.
 *   TODO: Improve type doc here
 * @returns {object}
 */
function generateCurtain() {
    const curtain = {
        showing: false,
        selector: null,
        content_selector: null,
        hide_delay: null,

        /**
         * Generate the curtain. Any content (string) argument passed will be displayed in the curtain as raw HTML.
         *   CSS (object) can be passed which will apply styles to the curtain and its content.
         * @param {string} content Content to be displayed on the curtain (as raw HTML)
         * @param {object} css Apply the specified styles to the curtain and its contents
         */
        show: (content, css) => {
            if (!this.curtain.showing) {
                this.curtain.selector = d3.select(this.parent_plot.svg.node().parentNode).insert('div')
                    .attr('class', 'lz-curtain').attr('id', this.id + '.curtain');
                this.curtain.content_selector = this.curtain.selector.append('div').attr('class', 'lz-curtain-content');
                this.curtain.selector.append('div').attr('class', 'lz-curtain-dismiss').html('Dismiss')
                    .on('click', () => this.curtain.hide());
                this.curtain.showing = true;
            }
            return this.curtain.update(content, css);
        },

        /**
         * Update the content and css of the curtain that's currently being shown. This method also adjusts the size
         *   and positioning of the curtain to ensure it still covers the entire panel with no overlap.
         * @param {string} content Content to be displayed on the curtain (as raw HTML)
         * @param {object} css Apply the specified styles to the curtain and its contents
         */
        update: (content, css) => {
            if (!this.curtain.showing) {
                return this.curtain;
            }
            clearTimeout(this.curtain.hide_delay);
            // Apply CSS if provided
            if (typeof css == 'object') {
                this.curtain.selector.style(css);
            }
            // Update size and position
            const page_origin = this.getPageOrigin();
            this.curtain.selector.style({
                top: page_origin.y + 'px',
                left: page_origin.x + 'px',
                width: this.layout.width + 'px',
                height: this.layout.height + 'px'
            });
            this.curtain.content_selector.style({
                'max-width': (this.layout.width - 40) + 'px',
                'max-height': (this.layout.height - 40) + 'px'
            });
            // Apply content if provided
            if (typeof content == 'string') {
                this.curtain.content_selector.html(content);
            }
            return this.curtain;
        },

        /**
         * Remove the curtain
         * @param {number} delay Time to wait (in ms)
         */
        hide: (delay) => {
            if (!this.curtain.showing) {
                return this.curtain;
            }
            // If a delay was passed then defer to a timeout
            if (typeof delay == 'number') {
                clearTimeout(this.curtain.hide_delay);
                this.curtain.hide_delay = setTimeout(this.curtain.hide, delay);
                return this.curtain;
            }
            // Remove curtain
            this.curtain.selector.remove();
            this.curtain.selector = null;
            this.curtain.content_selector = null;
            this.curtain.showing = false;
            return this.curtain;
        }
    };
    return curtain;
}

/**
 * Generate a loader object for a plot, panel, or any other subdivision of a layout
 *
 * The panel loader is a small HTML overlay that appears in the lower left corner of the panel. It cannot be styled
 *   arbitrarily, but can show a custom message and show a minimalist loading bar that can be updated to specific
 *   completion percentages or be animated.
 * TODO Improve type documentation
 * @returns {object}
 */
function generateLoader() {
    return {
        showing: false,
        selector: null,
        content_selector: null,
        progress_selector: null,
        cancel_selector: null,

        /**
         * Show a loading indicator
         * @param {string} [content='Loading...'] Loading message (displayed as raw HTML)
         */
        show: (content) => {
            // Generate loader
            if (!this.loader.showing) {
                this.loader.selector = d3.select(this.parent_plot.svg.node().parentNode).insert('div')
                    .attr('class', 'lz-loader').attr('id', this.id + '.loader');
                this.loader.content_selector = this.loader.selector.append('div')
                    .attr('class', 'lz-loader-content');
                this.loader.progress_selector = this.loader.selector
                    .append('div').attr('class', 'lz-loader-progress-container')
                    .append('div').attr('class', 'lz-loader-progress');

                this.loader.showing = true;
                if (typeof content == 'undefined') {
                    content = 'Loading...';
                }
            }
            return this.loader.update(content);
        },

        /**
         * Update the currently displayed loader and ensure the new content is positioned correctly.
         * @param {string} content The text to display (as raw HTML). If not a string, will be ignored.
         * @param {number} [percent] A number from 1-100. If a value is specified, it will stop all animations
         *   in progress.
         */
        update: (content, percent) => {
            if (!this.loader.showing) {
                return this.loader;
            }
            clearTimeout(this.loader.hide_delay);
            // Apply content if provided
            if (typeof content == 'string') {
                this.loader.content_selector.html(content);
            }
            // Update size and position
            const padding = 6; // is there a better place to store/define this?
            const page_origin = this.getPageOrigin();
            const loader_boundrect = this.loader.selector.node().getBoundingClientRect();
            this.loader.selector.style({
                top: (page_origin.y + this.layout.height - loader_boundrect.height - padding) + 'px',
                left: (page_origin.x + padding) + 'px'
            });
            /* Uncomment this code when a functional cancel button can be shown
            var cancel_boundrect = this.loader.cancel_selector.node().getBoundingClientRect();
            this.loader.content_selector.style({
                "padding-right": (cancel_boundrect.width + padding) + "px"
            });
            */
            // Apply percent if provided
            if (typeof percent == 'number') {
                this.loader.progress_selector.style({
                    width: (Math.min(Math.max(percent, 1), 100)) + '%'
                });
            }
            return this.loader;
        },

        /**
         * Adds a class to the loading bar that makes it loop infinitely in a loading animation. Useful when exact
         *   percent progress is not available.
         */
        animate: () => {
            this.loader.progress_selector.classed('lz-loader-progress-animated', true);
            return this.loader;
        },

        /**
         *  Sets the loading bar in the loader to percentage width equal to the percent (number) value passed. Percents
         *    will automatically be limited to a range of 1 to 100. Will stop all animations in progress.
         */
        setPercentCompleted: (percent) => {
            this.loader.progress_selector.classed('lz-loader-progress-animated', false);
            return this.loader.update(null, percent);
        },

        /**
         * Remove the loader
         * @param {number} delay Time to wait (in ms)
         */
        hide: (delay) => {
            if (!this.loader.showing) {
                return this.loader;
            }
            // If a delay was passed then defer to a timeout
            if (typeof delay == 'number') {
                clearTimeout(this.loader.hide_delay);
                this.loader.hide_delay = setTimeout(this.loader.hide, delay);
                return this.loader;
            }
            // Remove loader
            this.loader.selector.remove();
            this.loader.selector = null;
            this.loader.content_selector = null;
            this.loader.progress_selector = null;
            this.loader.cancel_selector = null;
            this.loader.showing = false;
            return this.loader;
        }
    };
}

/**
 * Create a new subclass following classical inheritance patterns.
 *
 * ES6 users should prefer an explicit `class ... extends` syntax. This exists to allow users without special tooling
 *   to generate custom data sources and layers.
 *
 * @param {Function} parent A parent class constructor that will be extended by the child class
 * @param {Object} extra An object of additional properties and methods to add/override behavior for the child class.
 *   The special "constructor" property can be used to specify a custom constructor, or it will call parent by default.
 *   Implementer must manage super calls when overriding the constructor.
 * @returns {Function} The constructor for the new child class
 */
function subclass(parent, extra) {
    if (typeof parent !== 'function' ) {
        throw new Error('Parent must be a callable constructor');
    }

    extra = extra || {};

    const Sub = Object.prototype.hasOwnProperty.call(extra, 'constructor') ? extra.constructor : function () {
        parent.apply(this, arguments);
    };

    Sub.prototype = Object.create(parent.prototype);
    Object.keys(extra).forEach(function(k) {
        Sub.prototype[k] = extra[k];
    });
    return Sub;
}

export { generateCurtain, generateLoader, subclass };
