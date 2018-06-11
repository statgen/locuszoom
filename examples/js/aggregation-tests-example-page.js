/**
 Custom code used to demonstrate interactive page widget features in the aggregation test visualization example
 */
"use strict";

/* global $ */
/* eslint-disable no-unused-vars */

// Quick hack observable: a() to get value, a(val) to set, a.subscribe() to add handlers
var Observable = function () { // Allow UI elements to monitor changes in a variable
    var _subscribers = [];
    var current_value;
    var handle_value = function (value) {
        if (value === undefined) { return current_value; }
        if(current_value !== value) {
            current_value = value;
            _subscribers.forEach(function(handler) {
                try {
                    handler(value);
                } catch (error) {
                    console.error(error);
                }
            });
        }
    };
    handle_value.subscribe = function (handler) { _subscribers.push(handler); };
    return handle_value;
};

// Make a custom layout object
function customizePlotLayout (layout) {
    // Customize an existing plot layout with the data for aggregation tests
    // Customize layout: genes layer must pull from the aggregation source + the aggregation_genes connector if we want to color
    //  the gene track by aggregation test results
    var genesLayout = layout.panels[1].data_layers[0];
    genesLayout.namespace["aggregation"] = "aggregation";
    genesLayout.namespace["aggregation_genes"] = "aggregation_genes";
    genesLayout.fields.push("aggregation:all", "aggregation_genes:all");
    var colorConfig = [
        {
            scale_function: "if",
            field: "aggregation_best_pvalue",
            parameters: {
                field_value: null,
                then: "#B8B8B8"
            }
        },
        {
            scale_function: "numerical_bin",
            field: "aggregation_best_pvalue",
            parameters: { // Default significance threshold is based on 20k human protein coding genes
                breaks: [0, 0.05 / 20000],
                values: ["#d43f3a", "#357ebd"]
            }
        }
    ];
    genesLayout.color = colorConfig;
    genesLayout.stroke = colorConfig;

    // The demo does not have real covariance data, and therefore only works on a narrow plot region. Lock all panels
    //   to prevent scrolling
    layout.panels.forEach(function(panel_layout) {
        panel_layout.interaction = {
            drag_background_to_pan: false,
            drag_x_ticks_to_scale: false,
            drag_y1_ticks_to_scale: false,
            drag_y2_ticks_to_scale: false,
            scroll_to_zoom: false,
            x_linked: false
        };
    });
    return layout;
}

function _formatSciNotation (cell, params) {
    // Tabulator cell formatter using sci notation
    var value = cell.getValue();
    return LocusZoom.TransformationFunctions.get("scinotation")(value);
}

// Controllers for page widgets
var GenericTabulatorTableController = LocusZoom.subclass(function() {}, {
    /**
     *
     * @param {string|Object} selector A selector string for the table container
     * @param {object} table_config An object specifying the tabulator layout for this table
     * @param {LocusZoom.Plot} plot A reference to the LZ plot object. Required for two way communication
     */
    constructor: function(selector, table_config, plot) {
        if (typeof selector === "string") {
            selector = $(selector);
        }
        this.selector = selector;
        this._table_config = table_config;
        this.plot = plot;

        this.selector.tabulator(this._table_config);
        this.addPlotListeners(plot);
    },

    /**
     * Define basic event listeners required for the table to synchronize with the plot
     * @param plot
     */
    addPlotListeners: function (plot) {},

    /**
     * Callback that takes in data and renders an HTML table to a hardcoded document location
     * @param {object} data
     */
    tableUpdateData: function (data) {
        this.selector.tabulator("setData", data);
    },

    prepareData: function (data) { return data; },  // Stub

    renderData: function(data) {
        data = this.prepareData(data);
        this.tableUpdateData(data);
    },

    /**
     * Scroll the table to a particular row, and highlight the value. The index must be a row number, or a field
     *  value that matches the table's predefined index field.
     * @param {String|Number} index A unique identifier that tabulator uses to locate a matching row
     */
    tableScrollToData: function (index) {
        this.selector.tabulator("deselectRow");
        this.selector.tabulator("scrollToRow", index);
        this.selector.tabulator("selectRow", index);
    },

    tableSetFilter: function (column, value) {
        this.selector.tabulator("setFilter", column, "=", value);
    },

    tableClearFilter: function (column, value) {
        if (typeof value !== "undefined") {
            this.selector.tabulator("removeFilter", column, "=", value);
        } else {
            this.selector.tabulator("clearFilter");
        }

    },

    tableDownloadData: function(filename, format) {
        format = format || "csv";
        this.selector.tabulator("download", format, filename);
    }
});

var AggregationTableController = LocusZoom.subclass(GenericTabulatorTableController, {
    prepareData: function (data) {
        return data.groups.data; // Render function only needs a part of the "computed results" JSON it is given. It does not need the helper object- it can render entirely from the list of json objects
    },
    addPlotListeners: function(plot) { // TODO consider moving this into the main page, "click events" section
        plot.on("element_selection", function(eventData) {
            // Trigger the aggregation test table to filter (or unfilter) on a particular value
            if (eventData["sourceID"] !== "plot.genes") {
                return;
            }

            // Programmatic filters are set separately from column filters
            var gene_column_name = "group";
            var selected_gene = eventData["data"]["element"]["gene_id"];
            selected_gene = selected_gene.split(".")[0]; // Ignore ensemble version on gene ids

            // TODO: Hard-coded selectors
            if (eventData["data"]["active"]) {
                this.tableSetFilter(gene_column_name, selected_gene);
                $("#label-no-group-selected").hide();
                $("#label-current-group-selected").show().text(selected_gene);
            } else {
                $("#label-no-group-selected").show();
                $("#label-current-group-selected").hide();
                this.tableClearFilter(gene_column_name, selected_gene);
            }
        }.bind(this));
    }
});

var VariantsTableController = LocusZoom.subclass(GenericTabulatorTableController, {});

/**
 * A minimal method of defining aggregation tests in the absence of a UI framework. Proof of concept, ONLY- not intended
 *   for production use. (generating HTML via jquery is rather ugly, but it keeps the examples highly framework-neutral)
 * @class
 * @param {string|object} selector A jquery selector or element name specifying where to draw the widget
 * @param {String[]} mask_names What masks are allowed
 * @param {String[]} [aggregation_names] What tests are recognized.
 */
var AggregationTestBuilder = LocusZoom.subclass(function() {}, {
    constructor: function(selector, mask_names, aggregation_names) {
        // Store the options used to populate the dropdown
        this._mask_names = mask_names;
        this._aggregation_types = aggregation_names  || [  // Defaults (correspond to hard-coded serialization logic)
            ["burden", "Burden"],
            ["skat", "SKAT"]
        ];

        if (typeof selector === "string") {
            selector = $(selector);
        }

        selector.html("");
        this._container = selector;
        this._aggregation_spec_list_container = $("<div></div>").appendTo(selector);

        // Make sure that at least one set of test-description input elements appears on first render
        this.addControls();
        this._status_div = $("<div></div>").css("color", "red;").appendTo(selector);
    },

    addControls: function() {
        // Build these fragments once and reuse
        var _mask_dropdown = this.__render_selection("mask_choice", this._mask_names);  // Assume this comes from an API / remote source
        var _aggregation_dropdown = this.__render_selection("calc_choice", this._aggregation_types);
        this._aggregation_spec_list_container.append(_mask_dropdown);
        this._aggregation_spec_list_container.append(_aggregation_dropdown);
    },

    // Display a (styled) status message to the user. Default styling is an error message.
    setStatus: function (message, css) {
        css = css || { color: "red" };
        this._status_div
            .text(message || "")
            .css(css);
    },

    /**
     *
     * @param {String} name The name of the select menu
     * @param {String|String[]} options An array where each element specifies [value, displayName]
     * @private
     */
    __render_selection: function (name, options) {
        var htmlescape = LocusZoom.TransformationFunctions.get("htmlescape");
        var element = $("<select></select>", { name: name, size: 5 }).prop("multiple", true).css("height", "auto");

        options = options.slice();

        options.forEach(function(option) {
            var value;
            var displayName;
            if (Array.isArray(option)) {  // Optionally specify a second, human readable name
                value = option[0];
                displayName = option[1];
            } else {
                value = displayName = option;
            }
            var choice = $("<option></option>"  , { value: htmlescape(value) }).text(displayName);
            element.append(choice);
        });
        return element;
    },

    /**
     * Must select at least one item from each box
     * @returns {boolean}
     */
    validate: function(calcs, masks) {
        // all test names unique across tests + all fields filled in
        calcs = calcs || this.getCalcs();
        masks = masks || this.getMasks();
        return calcs.length && masks.length;
    },

    getMasks: function() {
        var masks = this._aggregation_spec_list_container.children("[name='mask_choice']").find(":selected");
        return masks.map(function() { return this.value; }).get();
    },

    getCalcs: function() {
        var masks = this._aggregation_spec_list_container.children("[name='calc_choice']").find(":selected");
        return masks.map(function() { return this.value; }).get();
    }
});

