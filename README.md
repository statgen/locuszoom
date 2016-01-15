# LocusZoom

LocusZoom is a Javascript/d3 embeddable plugin for interactively visualizing statistical genetic data from customizable sources.

[![Build Status](https://api.travis-ci.org/statgen/locuszoom.svg?branch=master)](https://api.travis-ci.org/statgen/locuszoom)

## Development Setup

### Dependencies

LocusZoom is an entirely client-side application designed to plug into arbitrary data sets, be they local files, APIs, or something else entirely. It has the following vendor dependencies:

* [d3](http://d3js.org/) for a data visualization framework
* [Q](https://github.com/kriskowal/q) for a promises framework

**NOTE:** `should.min.js` appears in the vendor source directory along with source files for `d3` and `Q`, but `should` is only required in this way for the automated testing suite. It is not included in the final build.

### Build System

The application is built using [Gulp](http://gulpjs.com/). Gulp and all necessary Gulp plug-ins can be installed for this project using npm and the following commands:

```
$ npm install gulp gulp-util gulp-watch gulp-concat gulp-uglify gulp-mocha gulp-sass gulp-wrap
```

Once complete run or `gulp` from the top of the application directory to run all tests and build the following files:

* `assets/js/locuszoom.app.js` - A concatenated app file suitable for use in development
* `assets/js/locuszoom.app.min.js` - A concatenated and minified app file suitable for use in production
* `assets/js/locuszoom.vendor.min.js` - A concatenated vendor file suitable for use as a single vendor include in either development or production (contains d3 and Q)
* `assets/css/locuszoom.css` - A generated CSS file for all LocusZoom styles

Running `gulp watch` will put gulp in *watch* mode, such that any changes to app *.js or *.scss source files will immediately regenerate app files for testing.

**Note that the plugins used by gulp in this project require Node.js version 4.x or higher.**

### Linting and Strict Mode

All app-specific javascript files should be developed in **strict mode**. LocusZoom is also linted using [ESLint](http://eslint.org/), the rules for which can be found in `.eslintrc`.

### Automated Testing

LocusZoom uses [Mocha](https://mochajs.org/) for unit testing. Install Mocha and with npm, along with a few modules employed by the testing suite:

```
$ npm install mocha should jsdom mocha-jsdom
```

Tests are currently located in the `test` subdirectory, with a one-to-one mapping of test files to app files. Gulp is configured to run all tests as the first step in the build process and will abort a build if any tests fail.

Run tests manually from the root application directory at any time like so:

```
$ gulp test
```

## Using the LocusZoom Plugin

Refer to `demo.html` to see an example of how to embed LocusZoom into a page. In general, a given web page must include the following resources:

* `assets/js/locuszoom.vendor.min.js` (concatenated minified vender files)
* `assets/js/locuszoom.app.js` OR `assets/js/locuszoom.app.min.js` (concatenated+minified application logic)
* `assets/css/locuszoom.css` (stylesheet)

LocusZoom only needs an empty HTML element to create a new instance. (This tag should have an ID defined. This ID will be used as a prfix to construct child elements.) The tag may optionally specify a starting region, like so:

```html
<div id="foo" data-region="10:114550452-115067678"></div>
```

You can then bring the element to life with either the `populate()` method (for a single element) or `populateAll` method (for potentially multiple elements). They are defined as

```javascript
var lz = LocusZoom.populate(selector, datasource, layout, state)
var lz[] = LocusZoom.populateAll(selector, datasource, layout, state)
```

The `populate()` method will return the new LocusZoom instance for the first matching element and the `populateAll()` method will always return an array containting instances for each of the matched elements.

Here `selector` is either a reference to a DOM element (eg `document.getElementById("foo")`) or it is string that is a valid [D3 compatiable selector](http://www.w3.org/TR/selectors-api/) (eg `"#foo"`). 

The `datasource` parameter must be a `LocusZoom.DataSources()` object.

The `layout` paramter is not yet implemented.

The `state` parameter is not yet implemented.

We can initialize our sample element with

```javascript
var ds = (new LocusZoom.DataSources()).addSource("base",["AssociationLZ", "http://myapi.com/"]);
LocusZoom.populate("#foo", ds);
```

