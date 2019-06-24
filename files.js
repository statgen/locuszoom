"use strict";
/**
 files.js

 This file is a single place to keep ordered lists of files
 for use in automated tasks (e.g. running tests and builds)
*/
var glob = require("glob");

// Vendor libraries. These are *only* libraries necessary for implementing the plugin.
// Any vendor libraries needed solely for testing should not appear in this list.
var vendor_build = [
    "./node_modules/d3/d3.js"
];

// Test suites. Should be able to be executed in any order.
var test_suite = [
    "test/setup/node.js",
    "test/unit/**/*.js"
];

// App-specific JS files to be used in the main build
// NOTE: Order of inclusion is important!
var app_build = [
    "./assets/js/app/LocusZoom.js",
    "./assets/js/app/Layouts.js",
    "./assets/js/app/DataLayer.js",
    "./assets/js/app/DataLayers/**/*.js",
    "./assets/js/app/Singletons.js",
    "./assets/js/app/Dashboard.js",
    "./assets/js/app/Legend.js",
    "./assets/js/app/Data.js",
    "./assets/js/app/Plot.js",
    "./assets/js/app/Panel.js"
];

// LocusZoom extensions: not part of the default build, but we may want to bundle separately in the future
var extensions = ["assets/js/ext/**/*.js"];

// App, vendor, and helper files to be included at the top of each test suite
// NOTE: Order of inclusion is important!
var test_include = [
    "./node_modules/should/should.js",
    ...app_build,
    ...vendor_build,
    ...extensions
];
// Since this list gets read manually, resolve the globs first
test_include = test_include.reduce(function (acc, pattern) {
    return acc.concat(glob.sync(pattern));
}, []);

module.exports = {
    test_suite: test_suite,
    test_include: test_include,
    app_build: app_build,
    extensions: extensions,
    vendor_build: vendor_build
};
