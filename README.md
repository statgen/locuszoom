# LocusZoom

LocusZoom is a Javascript/d3 embeddable plugin for interactively visualizing statistical genetic data from customizable sources.


For more information, see our paper:

*Boughton, A. P. et al. LocusZoom.js: interactive and embeddable visualization of genetic association study results. Bioinformatics (2021) [doi:10.1093/bioinformatics/btab186](https://doi.org/10.1093/bioinformatics/btab186).*

**This is a low level library aimed at developers who want to customize their own data sharing/visualization tools. If you are a genetics researcher who just wants to make a fast visualization of your research results, try our user-friendly plot-your-own data services built on LocusZoom.js: [my.locuszoom.org](https://my.locuszoom.org/) and [LocalZoom](https://statgen.github.io/localzoom/)**.


![Build Status](https://github.com/statgen/locuszoom/workflows/Unit%20tests/badge.svg?branch=develop)

See [https://statgen.github.io/locuszoom/docs/](https://statgen.github.io/locuszoom/docs/) for full documentation and API reference.

To see functional examples of plots generated with LocusZoom.js see [statgen.github.io/locuszoom](http://statgen.github.io/locuszoom/) and [statgen.github.io/locuszoom/#examples](http://statgen.github.io/locuszoom/#examples).

![LocusZoom.js Standard Association Plot](examples/locuszoom_standard_association_example.png)

## Making a LocusZoom Plot: Quickstart tutorial

### 1. Include Necessary JavaScript and CSS

The page you build that embeds the LocusZoom plugin must include the following resources, found in the `dist` directory (or preferably loaded via CDN):

* `d3.js`  
  [D3.js](https://d3js.org/) v5.16.0 is used to draw graphics in LocusZoom plots. It may be loaded [via a CDN](https://cdn.jsdelivr.net/npm/d3@^5.16.0). It must be present before LocusZoom is loaded.

* `locuszoom.app.min.js`  
  This is the primary application logic. It should only be included *after* the vendor dependencies have been included.  

* `locuszoom.css`  
  This is the primary stylesheet. It is namespaced so as not to conflict with any other styles defined on the same page.

Instead of copying the files to your project, **we recommend using CDN links are for these resources** (see [statgen.github.io/locuszoom/](http://statgen.github.io/locuszoom/)).

*The above instructions describe using LocusZoom with pure JS and HTML. If you are using a module build system, LocusZoom supports usage via ES6 imports, eg:* 

```javascript
import LocusZoom from 'locuszoom';
import 'locuszoom/dist/locuszoom.css';
```

### 2. Define Data Sources

**Data Sources** is an object representing a collection of arbitrarily many sources from which data for the plot can be requested. When adding sources to the collection they must be namespaced so that retrieving specific fields can be done with respect to specific data sources.

Here's an example of defining a data sources object for a remote API:

```javascript
var data_sources = new LocusZoom.DataSources();
data_sources.add("assoc", ["AssociationLZ", { url: "http://server.com/api/", source: 1 }]);
```

The above example adds an "AssociationLZ" data source (a predefined data source designed to make requests for association data) with a defined URL. The namespace for this data source is "assoc".

Data sources can also be local files:

```javascript
data_sources = new LocusZoom.DataSources();
data_sources.add("assoc", ["AssociationLZ", { url: "file:///path/to/data.json" }]);
```

Refer to the [Working with data guide](https://statgen.github.io/locuszoom/docs/guides/data_retrieval.html) for more information on using predefined data sources or extending/creating custom data sources.

### 3. Define a Layout

**Layout** is a serializable object that describes the configuration of the LocusZoom plot, including what data will be pulled from the data sources and displayed in what way, along with visual characteristics like color and geometry.

A layout definition may look something like this (simplified example; consult docs for details):

```javascript
var layout = {
  width: 500,
  height: 500,
  panels: [
    {
      id: "association",
      data_layers: [
         {
           id: "association",
           type: "scatter",
           x_axis: { field: "assoc:position" },
           y_axis: { field: "assoc:pvalue" }
         }
      ]
    }
  ]
};
```

The above example defines a basic plot that is 500 pixels on a side and has one panel with one scatter plot data layer that pulls in position and pvalue from the "trait" data source, mapping position to the x axis and pvalue to the y axis.

The LocusZoom.js library provides several pre-defined layouts for entire plots and subdivisions of plots such as panels, data layers, tool tips, etc. Refer to the [Layouts and visualization options guide](https://statgen.github.io/locuszoom/guides/rendering_layouts.html) for more information.

### 4. Put it Together with `LocusZoom.populate()`

With includes included, data sources defined, and a layout defined, `LocusZoom.populate()` will accept a CSS selector string to populate the first matching element with a plot.

A basic example may then look like this:

```html
<html>
  <head>
    <script src="dist/locuszoom.app.min.js" type="text/javascript"></script>
    <link rel="stylesheet" type="text/css" href="dist/locuszoom.css"/>
  </head>
  <body>
    <div id="lz-plot"></div>
    <script type="text/javascript">
      const data_sources = new LocusZoom.DataSources();
      data_sources.add("assoc", ["AssociationLZ", { url: "https://server.com/api/single/", source: 1 }]);
      const layout = {
        width: 800,
        panels: [
          {
            id : "association",
            height: 300,
            data_layers: [
              {
                id: "association",
                type: "scatter",
                x_axis: { field: "assoc:position" },
                y_axis: { field: "assoc:log_pvalue" }
              }
            ]
          }
        ]
      };
      const plot = LocusZoom.populate("#lz-plot", data_sources, layout);
    </script>
  </body>
</html>
```

### Other Ways To Make a LocusZoom Plot

#### Use a Predefined Layout

The core LocusZoom library comes equipped with several predefined layouts, organized by type ("plot", "panel", "data_layer", and "toolbar"). You can see what layouts are predefined by reading the [documentation](https://statgen.github.io/locuszoom/docs/api/module-LocusZoom_Layouts.html) or introspecting in the browser by entering `LocusZoom.Layouts.list()` (or to list one specific type, like "data_layer": `LocusZoom.Layouts.list(type)`).

Get any predefined layout by type and name using `LocusZoom.Layouts.get(type, name)`.

If your data matches the field names and formats of the [UMich PortalDev API](https://portaldev.sph.umich.edu/docs/api/v1/#overview-of-api-endpoints), these layouts will provide a quick way to get started. If your data obeys different format rules, customization may be necessary. (for example, some LocusZoom features assume the presence of a field called `log_pvalue`)
  
See the [guide to working with layouts](https://statgen.github.io/locuszoom/docs/guides/rendering_layouts.html) for further details.

#### Build a Layout Using Some Predefined Pieces

`LocusZoom.Layouts.get(type, name)` can also be used to pull predefined layouts of smaller pieces, like data layers or 
toolbars, into a custom layout:

```javascript
const layout = {
  width: 1000,
  height: 500,
  panels: [
    LocusZoom.Layouts.get("panel", "association"),
    {
      id: "custom_panel",
      ...options
    },
    LocusZoom.Layouts.get("panel", "genes")
  ],
  ...
};
```

#### Modify a Predefined Layout

The `get()` function also accepts a partial layout to be merged with the predefined layout as a third argument, providing the ability to use predefined layouts as starting points for custom layouts with only minor differences. Example:

```javascript
const overrides = { label_font_size: 20 };
LocusZoom.Layouts.get("data_layer", "genes", overrides);
```

#### Predefining State by Building a State Object

**State** is JSON-serializable object containing information that can affect the entire plot (including all data retrieval requests). State can be set before or after the plot is initialized. For example, the following special-named fields will cause the plot to be loaded to a specific region of interest on first render:

```javascript
const layout = LocusZoom.Layouts.get('plot', 'standard_association', { state: { chr: 6, start: 20379709, end: 20979709 } })
```

#### Alternate: setting the initial view via `data-region`

You can also describe the locususing a `data-region` attribute of the containing element before populating it, like so:

```html
<div id="lz-plot" data-region="10:114550452-115067678"></div>
```

When `LocusZoom.populate()` is executed on the element defined above it will automatically parse any `data-region` parameter to convert those values into the initial state.

## Development Setup
### Dependencies

LocusZoom is an entirely client-side library designed to plug into arbitrary data sets, be they local files, APIs, or something else entirely. It has the following external dependencies:

* [d3](http://d3js.org/) for data visualization

### Build System and Automated Testing

LocusZoom is bundled using Webpack. To install all necessary dependencies for a development environment, run:

```bash
$ npm install
```

We recommend using node.js v12 or greater to build the library and run tests.

Once complete run `npm run build` from the top of the application directory to run all tests and build the LocusZoom library bundle.

This build process will also write sourcemaps, to help with debugging code even in production environments.

#### Other supported build commands:

* `npm run test` - Run unit tests (optional: `npm run test:coverage` to output a code coverage report)
* `npm run dev` - Automatically rebuild the library whenever code changes (development mode)
* `npm run build` - Run tests, and if they pass, build the library for release
* `npm run css` - Rebuild the CSS using SASS (CSS rarely changes, so this doesn't get done automatically in dev mode)
* `npm run docs` - Build just the library documentation
* `npm run format` - Format the JavaScript code using ESLint


#### Automated Testing

LocusZoom uses [Mocha](https://mochajs.org/) for unit testing. Tests are located in the `test` subdirectory. Use `npm run test`.

### Static analysis and code style
LocusZoom runs code quality checks via [ESLint](http://eslint.org/), the rules for which can be found in `.eslintrc`. This will run automatically as part of all new code commits, and during every build. 

## Help and Support

Full API documentation and prose guides are available at: [https://statgen.github.io/locuszoom/docs/](https://statgen.github.io/locuszoom/docs/)

A LocusZoom discussion forum is available here: [https://groups.google.com/forum/#!forum/locuszoom](https://groups.google.com/forum/#!forum/locuszoom). 
For the most effective help, please specify that your question  is about "LocusZoom.js".

If you have questions or feedback please file an issue on the [LocusZoom.js GitHub repository](https://github.com/statgen/locuszoom/issues) or post at the discussion forum referenced above.
