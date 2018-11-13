/*
  Global boilerplate used across all test files, including root-level mocha hooks and one-time setup
 */
var jsdom = require('mocha-jsdom');
var fs = require('fs');

var files = require('../../files.js');

global.assert = require('assert');
global.should = require('should');
global.sinon = require('sinon');

before(function() {
    var src = files.test_include.map(function(file) { return fs.readFileSync(file); });
    jsdom({ src: src, url: 'https://locuszoom.org' });
});

// Reset DOM after each test (but keep the JS we loaded in)
afterEach(function() {
    d3.select('body').selectAll('*').remove();
});
