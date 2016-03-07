# LocusZoom

LocusZoom is a Javascript/d3 embeddable plugin for interactively visualizing statistical genetic data from customizable sources.

[![Build Status](https://api.travis-ci.org/statgen/locuszoom.svg?branch=master)](https://api.travis-ci.org/statgen/locuszoom)

## Usage

### JavaScript / CSS Includes

The page you build that embeds the LocusZoom plugin must include the following resources:

* `locuszoom.vendor.min.js`  
  This file contains the concatenated vendor libraries. You can alternatively include [d3](http://d3js.org/) and [Q](https://github.com/kriskowal/q) from other sources, so long as they are included **before including LocusZoom files**.  

* `locuszoom.app.js` OR `locuszoom.app.min.js`  
  This is the primary application logic. It should only be included after the vendor dependencies have been included.  

* `locuszoom.css`  
  This is the primary stylesheet. It is namespaced so as not to conflict with any other styles defined on the same page.

### Initialization Values

LocusZoom requires three distinct initialization values:

#### Data Sources

LocusZoom is a tool for visualizing data, so data sources must be defined. Defining a data source can be done as follows:

```javascript
var ds = (new LocusZoom.DataSources()).addSource("base",["AssociationLZ", "http://myapi.com/"]);
LocusZoom.populate("#foo", ds);
```

Presently only HTTP/S endpoints are supported for data sources. See [Issue #38](https://github.com/statgen/locuszoom/issues/38) for discussion on adding support for local file data sources.

#### Layout

A layout is a serializable JSON object that describes the makeup of a LocusZoom plot. This includes pixel dimensions, definitions of which panels and nested data layers to include and their relative orientations, etc. If not supplied, a built-in `DefaultLayout` will be used.

#### State

The state object describes the current query against the data sources. Only supply this when wanting to jump to a specific spot in data when a LocusZoom plot is initialized, otherwise the built-in `DefaultState` will be used.

### Putting it together in a basic example

With includes included and data sources defined `LocusZoom.populate()` will accept a selector to populate a matching element with a plot.

This basic example, with functioning data sources, would generate a page with the default LocusZoom layout:

```html
<html>
  <head>
    <script src="locuszoom.vendor.min.js" type="text/javascript"></script>
    <script src="locuszoom.app.js" type="text/javascript"></script>
    <link rel="stylesheet" type="text/css" href="locuszoom.css"/>
  </head>
  <body>
    <div id="plot"></div>
    <script type="text/javascript">
      var datasource = (new LocusZoom.DataSources()).addSource("base",["AssociationLZ", "http://myapi.com/"]);
      var plot = LocusZoom.populate("#plot", datasource); 
    </script>
  </body>
</html>
```

Refer to `demo.html` to see a more sophisticated example of how to embed LocusZoom into a page, including adding other HTML elements to provide interactivity.

#### Predefining state with the div's `data-region`

You can optionally specify the state (data query) for LocusZoom by setting a `data-region` attribute of the div before populating it, like so:

```html
<div id="foo" data-region="10:114550452-115067678"></div>
```

### Populating arbitrarily many divs with LocusZoom plots at once

`LocusZoom.populate()` will only populate the first matching HTML element for the provided selector. If you instead ant to populate arbitrarily many elements that all match to a single selector that can be done using `LocusZoom.populateAll()` like so:

```html
<div class="plot" id="plot_1"></div>
<div class="plot" id="plot_2"></div>
<div class="plot" id="plot_3"></div>
<script type="text/javascript">
  var datasource = (new LocusZoom.DataSources()).addSource("base",["AssociationLZ", "http://myapi.com/"]);
  var lz[] = LocusZoom.populateAll(".plot", datasource); 
</script>
```

## Development Setup

### Dependencies

LocusZoom is an entirely client-side application designed to plug into arbitrary data sets, be they local files, APIs, or something else entirely. It has the following vendor dependencies:

* [d3](http://d3js.org/) for a data visualization framework
* [Q](https://github.com/kriskowal/q) for a promises framework

**NOTE:** `should.min.js` appears in the vendor source directory along with source files for `d3` and `Q`, but `should` is only required in this way for the automated testing suite. It is not included in the final build.

### Build System and Automated Testing

The application is built using [Gulp](http://gulpjs.com/). Gulp and all necessary Gulp plug-ins can be installed for this project using npm and the following commands:

```
$ npm install gulp gulp-util gulp-watch gulp-concat gulp-uglify gulp-mocha gulp-sass gulp-wrap yargs
$ npm install mocha should jsdom mocha-jsdom
```

Once complete run or `gulp` from the top of the application directory to run all tests and build the following files:

* `locuszoom.app.js` - A concatenated app file suitable for use in development
* `locuszoom.app.min.js` - A concatenated and minified app file suitable for use in production
* `locuszoom.vendor.min.js` - A concatenated vendor file suitable for use as a single vendor include in either development or production (contains d3 and Q)
* `locuszoom.css` - A generated CSS file for all LocusZoom styles

#### Other supported gulp commands:

* `gulp watch` - Watch for any changes to app .js, .scss, or test source files to trigger another full build
* `gulp test` - Just run the tests
* `gulp js` - Build app and vendor js files (runs tests and aborts if tests fail)
* `gulp app_js` - Build app js files (runs tests and aborts if tests fail)
* `gulp vendor_js` - Build vendor js file
* `gulp css` - Build CSS file

#### The `--force` Flag

Append `--force` to the end of any gulp command that runs the automated testing suite to force the creation of `locuszoom.app.js` and `locuszoom.app.min.js` **even when the tests fail**. This can be useful during active development as sometimes debugging can be led from either the output of automated tests or inspection of an active plugin.

This flag is particularly useful with the watch command:

`$ gulp watch --force`

The above command with enter forced-watch-mode, which will detect any changes to app .js or .scss files, as well as test files, and run a new build. If errors are encountered in the tests they will be reported, but `locuszoom.app.js` and `locuszoom.app.min.js` will still be generated and gulp will not exit but return to watch mode. **This is an effective way to have automatic continuous builds while developing both the application and its tests.**

#### Automated Testing

LocusZoom uses [Mocha](https://mochajs.org/) for unit testing. Tests are located in the `test` subdirectory, with a one-to-one mapping of test files to app files.

**Note that the plugins used by gulp in this project require Node.js version 4.x or higher.**

### Linting and Strict Mode

All app-specific javascript files should be developed in **strict mode**. LocusZoom is also linted using [ESLint](http://eslint.org/), the rules for which can be found in `.eslintrc`.


