/**
 Custom code used to demonstrate interactive page widget features in the burden test visualization example
 */
"use strict";

/* global $ */
/* eslint-disable no-unused-vars */



// Make a custom layout object
function customizePlotLayout (layout) {
    // Customize an existing plot layout with the data for burden tests
    // Customize layout: genes layer must pull from the burden source + the burden_genes connector if we want to color
    //  the gene track by burden test results
    var genesLayout = layout.panels[1].data_layers[0];
    genesLayout.namespace["burdentest"] = "burdentest";
    genesLayout.namespace["burden_genes"] = "burden_genes";
    genesLayout.fields.push("burdentest:all", "burden_genes:all");
    var colorConfig = [
        { // TODO: Convert this to a gradient. Is there a standard cutoff?
            scale_function: "if",
            field: "burden_best_pvalue",
            parameters: {
                field_value: null,
                then: "#B8B8B8",
                else: "#FF0000"
            }
        },
        "#B8B8B8"
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

    /**
     * Scroll the table to a particular row, and highlight the value. The index must be a row number, or a field
     *  value that matches the table's predefined index field.
     * @param {String|Number} index A unique identifier that tabulator uses to locate a matching row
     */
    tableScrollToData: function (index) {
        this.selector.tabulator("scrollToRow", index);
        this.selector.tabulator("deselectRow");
        this.selector.tabulator("selectRow", index);
    },

    tableSetFilter: function (column, value) {
        this.selector.tabulator("setFilter", column, "=", value);
    },

    tableClearFilter: function (column, value) {
        this.selector.tabulator("removeFilter", column, "=", value);
    },

    tableDownloadData: function(filename, format) {
        format = format || "csv";
        this.selector.tabulator("download", format, filename);
    }
});

var BurdenTableController = LocusZoom.subclass(GenericTabulatorTableController, {
    addPlotListeners: function(plot) {
        plot.subscribeToData(
            // FIXME: These fields are hard-coded references to specific namespaced sources
            ["burdentest:all", "burden_rows:all"],
            this.tableUpdateData.bind(this)
        );

        plot.on("element_selection", function(eventData) {
            // Trigger the burden test table to filter (or unfilter) on a particular value
            if (eventData["sourceID"] !== "plot.genes") {
                return;
            }

            // Programmatic filters are set separately from column filters
            var gene_column_name = "group";
            var selected_gene = eventData["data"]["element"]["gene_name"];

            // FIXME: Hard-coded selectors
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

var VariantsTableController = LocusZoom.subclass(GenericTabulatorTableController, {
    addPlotListeners: function (plot) {
        plot.subscribeToData(
            // FIXME: These fields are hard-coded references to specific namespaced sources
            ["assoc:variant", "assoc:position", "assoc:log_pvalue", "assoc:log_pvalue|logtoscinotation", "assoc:ref_allele", "assoc:ref_allele_freq", "ld:state", "ld:isrefvar"],
            this.tableUpdateData.bind(this)
        );

        plot.on("element_clicked", function (eventData) {
            // This listener will fire on any clickable element in any data layer, and we can filter the events
            // by source ID
            if (eventData["sourceID"] !== "plot.association") {
                return;
            }
            var selectedItem = eventData["data"]["assoc:variant"];
            if (selectedItem) {
                // TODO: rework this so it is driven by burden test table/masks, instead of the plot
                // (or else handle variants that are not in both plot AND mask)
                this.tableScrollToData(selectedItem);
            }
        }.bind(this));
    }
});
