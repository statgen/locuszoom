/**
 * @namespace
 */
var LocusZoom = {
    version: '0.11.0-beta.1'
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
 * @returns {DataLayer}
 */
LocusZoom.getToolTipDataLayer = function(node) {
    var data = LocusZoom.getToolTipData(node);
    if (data.getDataLayer) { return data.getDataLayer(); }
    return null;
};

/**
 * Shortcut method for getting a reference to the panel that generated a tool tip.
 * @param {Element} node The element associated with the tooltip, or any element contained inside the tooltip
 * @returns {Panel}
 */
LocusZoom.getToolTipPanel = function(node) {
    var data_layer = LocusZoom.getToolTipDataLayer(node);
    if (data_layer) { return data_layer.parent; }
    return null;
};

/**
 * Shortcut method for getting a reference to the plot that generated a tool tip.
 * @param {Element} node The element associated with the tooltip, or any element contained inside the tooltip
 * @returns {Plot}
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
