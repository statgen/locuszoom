/**
 Custom code used for burden test visualization examples
 */
'use strict';

/**
 * Call once when page is first loaded
 */
function createAssociationTable(selector) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator({
        height: 440,
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
 * @param {string} selector A selector string for the table container
 * @param {object} data
 */
function renderAssociationTable(selector, data) {
    var tableSelectorTarget = $(selector);
    tableSelectorTarget.tabulator("setData", data);
}
