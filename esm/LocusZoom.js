/**
 * @namespace
 */
var LocusZoom = {
    version: '0.11.0-beta.1'
};

/**
 * Populate a single element with a LocusZoom plot.
 * selector can be a string for a DOM Query or a d3 selector.
 * @param {String} selector CSS selector for the container element where the plot will be mounted. Any pre-existing
 *   content in the container will be completely replaced.
 * @param {LocusZoom.DataSources} datasource Ensemble of data providers used by the plot
 * @param {Object} layout A JSON-serializable object of layout configuration parameters
 * @returns {LocusZoom.Plot} The newly created plot instance
 */
LocusZoom.populate = function(selector, datasource, layout) {
    if (typeof selector == 'undefined') {
        throw new Error('LocusZoom.populate selector not defined');
    }
    // Empty the selector of any existing content
    d3.select(selector).html('');
    var plot;
    d3.select(selector).call(function() {
        // Require each containing element have an ID. If one isn't present, create one.
        if (typeof this.node().id == 'undefined') {
            var iterator = 0;
            while (!d3.select('#lz-' + iterator).empty()) { iterator++; }
            this.attr('id', '#lz-' + iterator);
        }
        // Create the plot
        plot = new LocusZoom.Plot(this.node().id, datasource, layout);
        plot.container = this.node();
        // Detect data-region and fill in state values if present
        if (typeof this.node().dataset !== 'undefined' && typeof this.node().dataset.region !== 'undefined') {
            var parsed_state = LocusZoom.parsePositionQuery(this.node().dataset.region);
            Object.keys(parsed_state).forEach(function(key) {
                plot.state[key] = parsed_state[key];
            });
        }
        // Add an SVG to the div and set its dimensions
        plot.svg = d3.select('div#' + plot.id)
            .append('svg')
            .attr('version', '1.1')
            .attr('xmlns', 'http://www.w3.org/2000/svg')
            .attr('id', plot.id + '_svg').attr('class', 'lz-locuszoom')
            .style(plot.layout.style);
        plot.setDimensions();
        plot.positionPanels();
        // Initialize the plot
        plot.initialize();
        // If the plot has defined data sources then trigger its first mapping based on state values
        if (typeof datasource == 'object' && Object.keys(datasource).length) {
            plot.refresh();
        }
    });
    return plot;
};

/**
 * Shortcut method for getting the data bound to a tool tip.
 * @param {Element} node
 * @returns {*} The first element of data bound to the tooltip
 */
LocusZoom.getToolTipData = function(node) {
    if (typeof node != 'object' || typeof node.parentNode == 'undefined') {
        throw new Error('Invalid node object');
    }
    // If this node is a locuszoom tool tip then return its data
    var selector = d3.select(node);
    if (selector.classed('lz-data_layer-tooltip') && typeof selector.data()[0] != 'undefined') {
        return selector.data()[0];
    } else {
        return LocusZoom.getToolTipData(node.parentNode);
    }
};

/**
 * Shortcut method for getting a reference to the data layer that generated a tool tip.
 * @param {Element} node The element associated with the tooltip, or any element contained inside the tooltip
 * @returns {LocusZoom.DataLayer}
 */
LocusZoom.getToolTipDataLayer = function(node) {
    var data = LocusZoom.getToolTipData(node);
    if (data.getDataLayer) { return data.getDataLayer(); }
    return null;
};

/**
 * Shortcut method for getting a reference to the panel that generated a tool tip.
 * @param {Element} node The element associated with the tooltip, or any element contained inside the tooltip
 * @returns {LocusZoom.Panel}
 */
LocusZoom.getToolTipPanel = function(node) {
    var data_layer = LocusZoom.getToolTipDataLayer(node);
    if (data_layer) { return data_layer.parent; }
    return null;
};

/**
 * Shortcut method for getting a reference to the plot that generated a tool tip.
 * @param {Element} node The element associated with the tooltip, or any element contained inside the tooltip
 * @returns {LocusZoom.Plot}
 */
LocusZoom.getToolTipPlot = function(node) {
    var panel = LocusZoom.getToolTipPanel(node);
    if (panel) { return panel.parent; }
    return null;
};

/**
 * LocusZoom optional extensions will live under this namespace.
 *
 * Extension code is not part of the core LocusZoom app.js bundle.
 * @namespace
 * @public
 */
LocusZoom.ext = {};
