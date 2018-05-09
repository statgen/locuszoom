/**
 Custom code used to demonstrate interactive page widget features in the burden test visualization example
 */
"use strict";

/* global $, raremetal */
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
        {
            scale_function: "if",
            field: "burden_best_pvalue",
            parameters: {
                field_value: null,
                then: "#B8B8B8"
            }
        },
        {
            scale_function: "numerical_bin",
            field: "burden_best_pvalue",
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

/**
 * A minimal method of defining burden tests in the absence of a UI framework. Proof of concept, ONLY- not intended
 *   for production use. (generating HTML via jquery is rather ugly, but it keeps the examples highly framework-neutral)
 * @class
 * @param {string|object} selector A jquery selector or element name specifying where to draw the widget
 * @param {String[]} mask_names What masks are allowed
 * @param {String[]} [burden_names] What tests are recognized.
 */
var BurdenTestBuilder = LocusZoom.subclass(function() {}, {
    constructor: function(selector, mask_names, burden_names) {
        // Store the options used to populate the dropdown
        this._mask_names = mask_names;
        this._burden_types = burden_names  || [  // Defaults (correspond to hard-coded serialization logic)
            ["zegginiBurden", "Zeggini Burden test"],
            ["skatDavies", "SKAT (Davies method)"],
            ["skatLiu", "SKAT (Liu method)"]
        ];

        if (typeof selector === "string") {
            selector = $(selector);
        }
        this._container = selector;
        this._burden_spec_list_container = $("<div></div>").appendTo(selector);

        this._status_div = $("<div></div>").css("color", "red;").appendTo(selector);

        // Build these fragments once and reuse
        this._mask_dropdown = this.__render_dropdown("mask_choice", this._mask_names);  // Assume this comes from an API / remote source
        this._burden_dropdown = this.__render_dropdown("burden_choice", this._burden_types);

        // Make sure that at least one set of test-description input elements appears on first render
        this.addTest();
        this._addControls();
    },

    _addControls: function() {
        // Render helper: add controls to widget
        var addButton = $("<button></button>").text("Add another")
            .addClass("button-primary")
            .on("click", this.addTest.bind(this));

        this._container.append(addButton);
    },

    /** @return {Number} */
    getTestCount: function () {
        return this._burden_spec_list_container.children().length;
    },

    addTest: function() {
        var rowNumber= this.getTestCount();
        var element = $("<div></div>", { id: "test-" + rowNumber })
            .addClass("row")
            .appendTo(this._burden_spec_list_container);

        var test_label = $("<input>", { name: "label", type: "text", placeholder: "Label (required)" });

        var removeButton = $("<button></button>").text("x")
            .css({ color: "white", "background-color": "#d9534f" })
            .on("click", this.removeTest.bind(this, element));

        element.append(test_label);
        element.append(this._mask_dropdown.clone());
        element.append(this._burden_dropdown.clone());

        if (rowNumber > 0) {  // Do not allow the user to remove the first row
            element.append(removeButton);
        }
    },

    removeTest: function(test_id) {
        // Remove the DOM element (and data) associated with a given test, so long as one row remains
        if (this.getTestCount() <= 1 || !test_id) {
            return;
        }
        this._burden_spec_list_container.find(test_id).remove();
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
     * @param {string} empty An option specification corresponding to "none selected"
     * @private
     */
    __render_dropdown: function (name, options, empty) {
        empty = empty || ["", "Select an option"];
        var htmlescape = LocusZoom.TransformationFunctions.get("htmlescape");
        var element = $("<select></select>", { name: name });

        options = options.slice();
        options.unshift(empty);

        options.forEach(function(option) {
            var value;
            var displayName;
            if (Array.isArray(option)) {  // Optionally specify both a code and human readable value
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
     * Identify whether a given element specifies a valid test
     * @param {object} data
     * @returns {boolean}
     */
    _validateOneTest: function(data) {
        // Make sure every key has a non-empty value
        return Object.keys(data).map(function(k) { return data[k]; }).every(function(v) { return !!v; });
    },

    /**
     * @param {Object[]} test_json Array with the JSON representation of each individual test
     * @returns {boolean}
     */
    validateTests: function(test_json) {
        // all test names unique across tests + all fields filled in
        test_json = test_json || this._getAllTestJson();
        var names = test_json.reduce(function(hash, item) { hash[item.label] = 1; return hash; }, {});

        var allUnique = Object.keys(names).length === test_json.length;
        var allComplete = test_json.every(this._validateOneTest.bind(this));
        return allUnique && allComplete;
    },

    /** Serialize a single test to a format that rm.js can understand */
    _getOneTestJson: function(element) {
        // Assume that all form elements have a name attribute, and serialize accordingly
        // TODO: clarify code here. Spec: label, mask_choice, burden_choice
        var res = {};
        $(element).children("[name]").each(function() {
            var label = this.attributes.name.value;
            var value = this.value;

            // FIXME: Hardcoded serialization mechanism- this is very dependent on rm.js internals. Improve.
            if(label === "burden_choice") {
                switch(value) {
                case "zegginiBurden":
                    value = raremetal.stats.testBurden;
                    break;
                case "skatLiu":
                    value = {
                        test: function (u, v, w) { return raremetal.stats.testSkat(u, v, w, "liu"); },
                        weights: raremetal.stats.calcSkatWeights
                    };
                    break;
                case "skatDavies":
                    value = {
                        test: function (u, v, w) { return raremetal.stats.testSkat(u, v, w, "davies"); },
                        weights: raremetal.stats.calcSkatWeights
                    };
                    break;
                default:
                    value = null;
                }
            }
            res[label] = value;
        });
        return res;
    },

    _getAllTestJson: function() {
        var self = this;
        return this._burden_spec_list_container.children()
            .map(function(i, el) { return self._getOneTestJson(el); })
            .get();
    },

    /**
     * Get a description of tests to run, in a format suitable for use with Raremetal.js
    */
    getTests: function() {
        // TODO: At this step, it should filter the array of masks down to those that a user is actually interested in using
        var allTests = this._getAllTestJson();
        var res = {};
        allTests.forEach(function(test) {
            res[test.label] = test.burden_choice;
        });
        return res;
    }
});

