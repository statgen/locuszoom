/**
 Custom code used for burden test visualization examples
 */
'use strict';

/**
 * Call once when page is first loaded
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
