/* global module */

"use strict";

/**

 files.js

 This file is a single place to keep ordered lists of files
 for use in automated tasks (e.g. running tests and builds)

*/

// Test suites. Should be able to be executed in any order.
var test_suite = [
    "./test/LocusZoom.js",
    "./test/Layouts.js",
    "./test/DataLayer.js",
    "./test/Singletons.js",
    "./test/Dashboard.js",
    "./test/Data.js",
    "./test/Plot.js",
    "./test/Panel.js"
];

// App, vendor, and helper files to be included at the top of each test suite
// NOTE: Order of inclusion is important!
var test_include = [
    "./assets/js/vendor/should.min.js",
    "./assets/js/vendor/d3.min.js",
    "./assets/js/vendor/q.min.js",
    "./assets/js/app/LocusZoom.js",
    "./assets/js/app/Layouts.js",
    "./assets/js/app/DataLayer.js",
    "./assets/js/app/DataLayers/scatter.js",
    "./assets/js/app/DataLayers/line.js",
    "./assets/js/app/DataLayers/genes.js",
    "./assets/js/app/DataLayers/intervals.js",
    "./assets/js/app/DataLayers/genome_legend.js",
    "./assets/js/app/DataLayers/forest.js",
    "./assets/js/app/Singletons.js",
    "./assets/js/app/Dashboard.js",
    "./assets/js/app/Legend.js",
    "./assets/js/app/Data.js",
    "./assets/js/app/Plot.js",
    "./assets/js/app/Panel.js"
];

// App-specific JS files to be used in the main build
// NOTE: Order of inclusion is important!
var app_build = [
    "./assets/js/app/LocusZoom.js",
    "./assets/js/app/Layouts.js",
    "./assets/js/app/DataLayer.js",
    "./assets/js/app/DataLayers/scatter.js",
    "./assets/js/app/DataLayers/line.js",
    "./assets/js/app/DataLayers/genes.js",
    "./assets/js/app/DataLayers/intervals.js",
    "./assets/js/app/DataLayers/genome_legend.js",
    "./assets/js/app/DataLayers/forest.js",
    "./assets/js/app/Singletons.js",
    "./assets/js/app/Dashboard.js",
    "./assets/js/app/Legend.js",
    "./assets/js/app/Data.js",
    "./assets/js/app/Plot.js",
    "./assets/js/app/Panel.js"
];

// Vendor libraries. These are *only* libraries necessary for implementing the plugin.
// Any vendor libraries needed solely for testing should not appear in this list.
var vendor_build = [
    "./assets/js/vendor/d3.min.js",
    "./assets/js/vendor/q.min.js"
];

module.exports = {
    test_suite: test_suite,
    test_include: test_include,
    app_build: app_build,
    vendor_build: vendor_build
};
