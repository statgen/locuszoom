/**
 Custom code used to demonstrate interactive page widget features in the burden test visualization example
 */
"use strict";

/* global $ */
/* eslint-disable no-unused-vars */


function _formatSciNotation(cell, params) {
    // Tabulator cell formatter using sci notation
    var value = cell.getValue();
    return LocusZoom.TransformationFunctions.get("scinotation")(value);
}

/**
 * Modify the plot layout to show information about burden tests
 */
function customizePlotLayout(layout) {
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

/**
 * Create a table of GWAS results
 */
function createAssociationTable(selector, row_click_callback) {
    // TODO: Rewrite ideas to use rm.js burden table output as a data source
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator({
        height: 440,
        layout: "fitColumns",
        index: "assoc:variant",
        rowClick: row_click_callback,
        columns: [
            { title: "Variant", field: "assoc:variant" },
            { title: "-log10(pvalue)", field: "assoc:log_pvalue", formatter: _formatSciNotation },
            // TODO: This will not necessarily be the disease causing allele, or even the rare one
            // TODO: Find a better source for allele freq- the association study may not include the rare variants at all, and those are the ones where we really want freq info to appear
            { title: "Ref allele", field: "assoc:ref_allele" },
            { title: "Ref allele freq", field: "assoc:ref_allele_freq" }
        ],
        placeholder: "No Data Available"
    });
}

/**
 * Create a table showing only data from the Burden Test datasource
 *
 */
function createBurdenTestTable(selector, row_click_callback) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator({
        index: "id",
        layout: "fitColumns",
        rowClick: row_click_callback,
        columns: [
            { title: "Gene", field: "group" },
            { title: "Mask", field: "mask", headerFilter: true },
            { title: "# Variants", field: "variant_count" },
            { title: "Test type", field: "calc_type", headerFilter: true },
            { title: "p-value", field: "pvalue", formatter: _formatSciNotation }
        ],
        placeholder: "No Data Available",
        initialSort: [
            { column: "pvalue", dir: "asc" }
        ]
    });
}

//////////
// Methods for generic table behavior

/**
 * Callback that takes in data and renders an HTML table to a hardcoded document location
 * @param {string} selector A selector string for the table container
 * @param {object} data
 */
function updateTableData(selector, data) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator("setData", data);
}

/**
 * Scroll the table to a particular row, and highlight the value. The index must be a row number, or a field
 *  value that matches the table's predefined index field.
 * @param {String} selector
 * @param {String|Number} index A unique identifier that tabulator uses to locate a matching row
 */
function scrollTableToData(selector, index) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator("scrollToRow", index);
    tableSelectorTarget.tabulator("deselectRow");
    tableSelectorTarget.tabulator("selectRow", index);
}

function setTableFilter(selector, column, value) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator("setFilter", column, "=", value);
}

function clearTableFilter(selector, column, value) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator("removeFilter", column, "=", value);
}
