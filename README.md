# LocusZoom

LocusZoom is a Javascript/d3 embeddable plugin for interactively visualizing statistical genetic data from customizable sources.

[![Build Status](https://api.travis-ci.org/statgen/locuszoom.svg?branch=master)](https://api.travis-ci.org/statgen/locuszoom)

See [API Reference](https://github.com/statgen/locuszoom/wiki/API-Reference) if already up and running or the introduction below.

## Making a LocusZoom Plot

### 1. Include Necessary JavaScript and CSS

The page you build that embeds the LocusZoom plugin must include the following resources:

* `locuszoom.vendor.min.js`  
  This file contains the concatenated vendor libraries. You can alternatively include [d3](http://d3js.org/) and [Q](https://github.com/kriskowal/q) from other sources, so long as they are included **before including LocusZoom files**.  

* `locuszoom.app.js` OR `locuszoom.app.min.js`  
  This is the primary application logic. It should only be included *after* the vendor dependencies have been included.  

* `locuszoom.css`  
  This is the primary stylesheet. It is namespaced so as not to conflict with any other styles defined on the same page.

### 2. Define Data Sources

**Data Sources** is an object representing a collection of arbitrarily many sources from which data for the plot can be requested. When adding sources to the collection they can be namespaced so that retrieving specific fields can be done with respect to specific data sources.

Here's an example of defining a data sources object:

```javascript
var data_sources = new LocusZoom.DataSources();
data_sources.add("trait", ["AssociationLZ", { url: "http://server.com/api/single/" }]);
```

The above example adds an "AssociationLZ" data source (a predefined data source designed to make requests for association data) with a defined URL. The namespace for this data source is "trait".

Refer to the [Data Sources Documentation](https://github.com/statgen/locuszoom/wiki/Data-Sources) for more information on using predefined data sources or extending/creating custom data sources.

### 3. Define a Layout

**Layout** is a serializable object that describes the configuration of the LocusZoom plot, including what data will be pulled from the data sources and displayed in what way, along with visual characteristics like color and geometry.

A layout definition may look something like this:

```javascript
var layout = {
  width: 500,
  height: 500,
  panels: {
    association: {
      data_layers: {
         association:
           type: "scatter",
           fields: ["trait:position", "trait:pvalue"]
           x_axis: { field: "trait:position" },
           y_axis: { field: "trait:pvalue" }
         }
      }
    }
  }
};
```

The above example defines a basic plot that is 500 pixels on a side and has one panel with one scatter plot data layer that pulls in position and pvalue from the "trait" data source, mapping position to the x axis and pvalue to the y axis.

Refer to the [Layout Documentation](https://github.com/statgen/locuszoom/wiki/Layout) for more information on all supported layout parameters.

### 4. Put it Together with `LocusZoom.populate()`

With includes included, data sources defined, and a layout defined, `LocusZoom.populate()` will accept a CSS selector string to populate the first matching element with a plot.

A basic example may then look like this:

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
      var data_sources = new LocusZoom.DataSources();
      data_sources.add("trait", ["AssociationLZ", { url: "http://server.com/api/single/" }]);
      var layout = {
        width: 500,
        height: 500,
        panels: {
          association: {
            data_layers: {
              association:
                type: "scatter",
                fields: ["trait:position", "trait:pvalue"]
                x_axis: { field: "trait:position" },
                y_axis: { field: "trait:pvalue" }
              }
            }
          }
        }
      };
      var plot = LocusZoom.populate("#plot", datasource, layout); 
    </script>
  </body>
</html>
```

### Other Ways To Make a LocusZoom Plot

#### Using the Standard Layout

The core LocusZoom library comes equipped with a standard layout. See what its contents are by inspecting `LocusZoom.StandardLayout`.

If no layout is passed to `LocusZoom.populate()` the standard layout is used (requiring appropriate data sources to be configured).

If your use case is similar to the standard layout with only minor changes, use `LocusZoom.mergeLayouts()` to define your layout (rather than editing `LocusZoom.StandardLayout`). This method takes two arguments in order - the first is your customizations, and the second is your "base" or default layout. So, to simply change the width of the standard layout it might look like this:

```javascript
var layout = LocusZoom.mergeLayouts({ width: 1000 }, LocusZoom.StandardLayout);
```

#### Predefining State by Building a State Object

**State** is a serializable JSON object that describes orientation to specific data from data sources, and specific interactions with the layout. This can include a specific query against various data sources or pre-selecting specific elements. Essentially, the state object is what tracks these types of user input under the hood in LocusZoom, and it can be predefined at initialization as a top-level parameter in the layout. For example:

```javascript
var layout = LocusZoom.mergeLayouts({ state: { chr: 6, start: 20379709, end: 20979709 } }, LocusZoom.StandardLayout);
```

#### Predefining State With `data-region`

You can also describe the locus query aspect of the State (chromosome, start, and end position) using a `data-region` attribute of the continaing element before populating it, like so:

```html
<div id="foo" data-region="10:114550452-115067678"></div>
```

When `LocusZoom.populate()` is executed on the element defined above it will automatically parse any `data-region` parameter to convert those values into the initial state.

#### Making Many LocusZoom Plots at Once

`LocusZoom.populate()` will only populate the first matching HTML element for the provided selector string. To populate all matching elements for a single selector string use `LocusZoom.populateAll()` like so:

```html
<div class="plot" id="plot_1"></div>
<div class="plot" id="plot_2"></div>
<div class="plot" id="plot_3"></div>
<script type="text/javascript">
  var plots[] = LocusZoom.populateAll(".plot", data_source, layout);
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


