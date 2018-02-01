/**
 Custom code used for burden test visualization examples
 */
'use strict';

// Hardcoded reference to the page element where the table will be rendered
var TABLE_SELECTOR = "#results-table";

/**
 * Call once when page is first loaded
 */
function createAssociationTable() {
    var tableSelectorTarget = $(TABLE_SELECTOR);
    tableSelectorTarget.tabulator({
        height: 250,
        layout: "fitColumns",
        columns: [
            { title: "Variant", field: "assoc:variant" },
            { title: "-log10(pvalue)", field: "assoc:log_pvalue", bottomCalc: "max" }
        ],
        placeholder:"No Data Available"
    });
}

/**
 * Callback that takes in data and renders an HTML table to a hardcoded document location
 * @param data
 */
function renderAssociationTable(data) {
    var tableSelectorTarget = $(TABLE_SELECTOR);
    tableSelectorTarget.tabulator("setData", data);
}
