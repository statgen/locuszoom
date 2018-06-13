/**
 Custom code used to demonstrate interactive page widget features in the aggregation test visualization example
 */
"use strict";

/* global $, raremetal */
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

/**
 * A minimal method of defining aggregation tests in the absence of a UI framework. Proof of concept, ONLY- not intended
 *   for production use. (generating HTML via jquery is rather ugly, but it keeps the examples relatively portable)
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

/**
 * Define shared functionality for all tables, providing helper methods to control the tabulator
 *  table library
 * @class
 */
var GenericTabulatorTableController = LocusZoom.subclass(function() {}, {
    /**
     *
     * @param {string|Object} selector A selector string for the table container
     * @param {object} table_config An object specifying the tabulator layout for this table
     */
    constructor: function(selector, table_config) {
        if (typeof selector === "string") {
            selector = $(selector);
        }
        this.selector = selector;
        this._table_config = table_config;

        this.selector.tabulator(this._table_config);
    },

    /**
     * Callback that takes in data and renders an HTML table to a hardcoded document location
     * @param {object} data
     */
    _tableUpdateData: function (data) {
        this.selector.tabulator("setData", data);
    },

    /**
     * Stub. Override this method to transform the data in ways specific to this table.
     * @param data
     * @returns {*}
     */
    prepareData: function (data) { return data; },

    renderData: function(data) {
        data = this.prepareData(data);
        this._tableUpdateData(data);
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
    }
});

var VariantsTableController = LocusZoom.subclass(GenericTabulatorTableController, {});

/**
 * Creates the plot and tables
 * @param {Observable|function} label_store Observer to label the selected group
 * @param {Object} [context=window] A reference to the widgets will be added here, allowing them to be accessed
 *  outside the function later (eg for debugging purposes)
 */
function createDisplayWidgets(label_store, context) {
    context = context || window;

    //   Determine if we're online, based on browser state or presence of an optional query parameter
    var online = !(typeof navigator !== "undefined" && !navigator.onLine);
    if (window.location.search.indexOf("offline") !== -1) {
        online = false;
    }

    // Specify the data sources to use, then build the plot
    var apiBase = "//portaldev.sph.umich.edu/api/v1/";
    var data_sources =  new LocusZoom.DataSources()
        .add("assoc", ["AssociationLZ", {  // TODO: Can we 100% drive this with aggregation source?
            url: apiBase + "statistic/single/",
            params: { analysis: 42, id_field: "variant" }
        }])
        .add("ld", ["LDLZ", {url: apiBase + "pair/LD/"}])
        .add("gene", ["GeneLZ", {url: apiBase + "annotation/genes/", params: {source: 2}}])
        .add("aggregation", ["AggregationTestSourceLZ", {url: "data/scorecov.json"}])
        .add("aggregation_genes", ["GeneAggregationConnectorLZ", {sources: {aggregation_ns: "aggregation", gene_ns: "gene"}}])
        .add("recomb", ["RecombLZ", {url: apiBase + "annotation/recomb/results/", params: {source: 15}}])
        .add("constraint", ["GeneConstraintLZ", {url: "//exac.broadinstitute.org/api/constraint"}]);

    // Generate the LocusZoom plot, and reflect the initial plot state in url
    var stateUrlMapping = {chr: "chrom", start: "start", end: "end"};
    // Fetch initial position from the URL, or use some defaults particular to this demo
    var initialState = LocusZoom.ext.DynamicUrls.paramsFromUrl(stateUrlMapping);
    if (!Object.keys(initialState).length) {
        initialState = {chr: 22, start: 21552103, end: 22052103};
    }

    var layout = LocusZoom.Layouts.get("plot", "standard_association", {state: initialState});
    layout = customizePlotLayout(layout);

    var plot = LocusZoom.populate("#lz-plot", data_sources, layout);

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Changes in the plot can be reflected in the URL, and vice versa (eg browser back button can go back to
    //   a previously viewed region)
    LocusZoom.ext.DynamicUrls.plotUpdatesUrl(plot, stateUrlMapping);
    LocusZoom.ext.DynamicUrls.plotWatchesUrl(plot, stateUrlMapping);

    var TABLE_SELECTOR_AGGREGATION = "#results-table-aggregation";
    var TABLE_SELECTOR_VARIANTS = "#results-table-variants";

    var aggregationTable = new AggregationTableController(TABLE_SELECTOR_AGGREGATION, {
        index: "id",
        height: 300,
        layout: "fitColumns",
        layoutColumnsOnNewData: true,
        rowSelected: function(row) {
            label_store(row.row.data); // FIXME: Tabulator doesn't allow changing options after creation, so one variable from the outer scope has to be baked into the layout. (awkwardly less-reusable)
        },
        rowDeselected: function () {
            label_store(null);
        },
        columns: [
            {
                title: "Gene", field: "group", formatter: "link",
                // TODO: exac times out with https
                formatterParams: { urlPrefix: "http://exac.broadinstitute.org/gene/", labelField: "group_display_name" }
            },
            { title: "Mask", field: "mask", headerFilter: true },
            { title: "# Variants", field: "variant_count" },
            { title: "Test type", field: "test", headerFilter: true },
            { title: "p-value", field: "pvalue", formatter: _formatSciNotation, sorter: "number" },
            { title: "Statistic", field: "stat", formatter: _formatSciNotation, sorter: "number", visible: false }
        ],
        placeholder: "No Data Available",
        initialSort: [
            { column: "pvalue", dir: "asc" }
        ],
        selectable: 1,
        selectablePersistence: false
    });

    var variantsTable = new VariantsTableController(TABLE_SELECTOR_VARIANTS, {
        height: 300,
        layout: "fitColumns",
        layoutColumnsOnNewData: true,
        index: "id",
        columns: [
            { title: "Variant", field: "variant" },
            { title: "p-value", field: "pvalue", formatter: _formatSciNotation, sorter: "number" },
            { title: "Alt allele frequency", field: "altFreq", formatter: _formatSciNotation, sorter: "number" }
        ],
        placeholder: "No Data Available",
        initialSort: [
            { column: "variant", dir: "asc" }
        ]
    });

    ////////////////////////////////
    // Make certain symbols available later, eg for debugging
    context.data_sources = data_sources;
    context.plot = plot;

    context.aggregationTable = aggregationTable;
    context.variantsTable = variantsTable;

    return context;
}

/**
 * Connect a very specific set of widgets together to drive the user experience for this page.
 *
 * Because many things are clickable, this looks like more code than it is. The key concepts are:
 * 1. Allow the plot to tell us when aggregation test results are available.
 * 2. Take that data and update a table
 * 3. If something important gets clicked, update parts of the view that depend on it
 * 4. Have a well-defined way to coordinate many widgets that depend on a common value
 * @param plot
 * @param aggregation_table
 * @param variants_table
 * @param {Observable} result_store Observer for calculation results
 * @param {Observable} label_store Observer to label the selected group
 */
function setupWidgetListeners(plot, aggregation_table, variants_table, result_store, label_store) {
    plot.on("element_selection", function(eventData) {
        // Trigger the aggregation test table to filter (or unfilter) on a particular value
        if (eventData["sourceID"] !== "lz-plot.genes") {
            return;
        }

        var gene_column_name = "group";
        var selected_gene = eventData["data"]["element"]["gene_id"];
        selected_gene = selected_gene.split(".")[0]; // Ignore ensemble version on gene ids

        if (eventData["data"]["active"]) {
            aggregation_table.tableSetFilter(gene_column_name, selected_gene);
            $("#label-no-group-selected").hide();
            $("#label-current-group-selected").show().text(selected_gene);
        } else {
            $("#label-no-group-selected").show();
            $("#label-current-group-selected").hide();
            aggregation_table.tableClearFilter(gene_column_name, selected_gene);
        }
    }.bind(this));

    plot.subscribeToData(
        ["aggregation:all", "gene:all"],
        function (data) {
            // chain.discrete provides distinct data from each source
            var gene_data = data.gene;
            var agg_data = data.aggregation;

            var results = agg_data.results;

            // Aggregation calcs return very complex data. Parse it here, once, into reusable helper objects.
            var parsed = raremetal.helpers.parsePortalJSON(agg_data);
            var groups = parsed[0];
            var variants = parsed[1];

            /////////
            // Post-process this data with any annotations required by data tables on this page

            // The aggregation results use the unique ENSEMBL ID for a gene. The gene source tells us how to connect
            //  that to a human-friendly gene name (as displayed in the LZ plot)
            var _genes_lookup = {};
            gene_data.forEach(function(gene) {
                var gene_id = gene.gene_id.split(".")[0]; // Ignore ensembl version on gene ids
                _genes_lookup[gene_id] = gene.gene_name;
            });
            groups.data.forEach(function(one_result) {
                var this_group = groups.getOne(one_result.mask, one_result.group);
                // Add synthetic fields that are not part of the raw calculation results
                one_result.group_display_name = _genes_lookup[one_result.group] || one_result.group;
                one_result.variant_count = this_group.variants.length;
            });

            // When new data has been received (and post-processed), pass it on to any UI elements that use that data
            result_store({
                groups: groups,
                variants: variants
            });
        },
        { discrete: true }
    );

    // When results are updated, make sure we are not "drilling down" into a calculation that no longer exists
    result_store.subscribe(aggregation_table.renderData.bind(aggregation_table));
    result_store.subscribe(label_store.bind(null, null)); // just wipe the labels
    plot.on("element_selection", label_store.bind(null, null));

    // The UI is based on "drilling down" to explore results. If a user selects a group, display stuff
    label_store.subscribe(function (data) {  // User-friendly label
        var text = "";
        if (data) {
            text = data.mask + " / " + data.group;
        }
        $("#label-mask-selected").text(text);
    });
    label_store.subscribe(function (data) { // "Show me what variants are in a selected group" table
        var calcs = result_store();
        if (!data || !calcs) { // If no analysis is selected, no analysis should be shown
            variants_table.renderData([]);
            return;
        }
        // When a group is selected, draw a variants table with information about that group
        var one_group = calcs.groups.getOne(data.mask, data.group);
        var variant_data = calcs.variants.getGroupVariants(one_group.variants);
        variants_table.renderData(variant_data);
    });

    //////////////////////////////////////////////////////////////
    // Generic UI controls: what to do when buttons are clicked
    $("#download-aggregation").on("click", function() {
        aggregation_table.tableDownloadData("aggregation-data.csv", "csv");
    });
}
