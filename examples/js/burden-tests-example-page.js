/**
 Custom code used to demonstrate interactive page widget features in the burden test visualization example
 */
'use strict';


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
      { // TODO: Convert this to a gradient
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
    return layout;
}

/**
 * Create a table of GWAS results
 */
function createAssociationTable(selector, row_click_callback) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator({
        height: 440,
        layout: "fitColumns",
        index: "assoc:variant",
        rowClick: row_click_callback,
        columns: [
            { title: "Variant", field: "assoc:variant" },
            { title: "-log10(pvalue)", field: "assoc:log_pvalue", bottomCalc: "max" }
        ],
        placeholder:"No Data Available"
    });
}

/**
 * Create a table showing only data from the Burden Test datasource
 *
 */
function createBurdenTestTable(selector) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator({
        index: "id",
        layout: "fitColumns",
        columns: [
            { title: "Gene", field: "group" },
            { title: "Mask", field: "mask" },
            { title: "# Variants", field: "variant_count" },
            { title: "Test type", field: "calc_type" },
            { title: "P-value", field: "pvalue" }
        ],
        placeholder:"No Data Available"
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
