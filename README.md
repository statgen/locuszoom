# LocusZoom

(snappy project overview goes here)

## Development Setup

### Dependencies

LocusZoom is an entirely client-side application designed to plug into arbitrary data sets, be they local files, APIs, or something else entirely. It has the following vendor dependencies:

* [d3](http://d3js.org/) for a data visualization framework
* [Q](https://github.com/kriskowal/q) for a promises framework

### Build System

The application is built using [Gulp](http://gulpjs.com/). Gulp and all necessary Gulp plug-ins can be installed for this project using npm and the following commands:

```
$ npm install gulp gulp-util gulp-watch gulp-notify gulp-concat gulp-uglify gulp-mocha
```

Once complete run or `gulp js` from the top of the application directory to build the following files:

* `assets/js/locuszoom.app.js` - A concatenated app file suitable for use in development
* `assets/js/locuszoom.app.min.js` - A concatenated and minified app file suitable for use in production
* `assets/js/locuszoom.vendor.min.js` - A concatenated vendor file suitable for use as a single vendor include in either development or production

Running `gulp` from the repo's root directory will do all of the above. Running `gulp watch` will put gulp in *watch* mode, such that any changes to app js source files will immediately regenerate concatenated/minified app files for testing.

**Note that the plugins used by gulp in this project require Node.js version 4.x or higher.**

### Linting and Strict Mode

All app-specific javascript files should be developed in **strict mode**. LocusZoom is also linted using [ESLint](http://eslint.org/), the rules for which can be found in `.eslintrc`.

### Unit Tests

LocusZoom uses [Mocha](https://mochajs.org/) for unit testing. Install Mocha and with npm, along with a few modules employed by the testing suite:

```
$ npm install mocha requirejs should jsdom
```

Tests are currently located in the `test` subdirectory, with a one-to-one mapping of test files to app files. Gulp is configured to run all tests as the first step in the build process and will abort a build if any tests fail.

Run tests manually from the root application directory at any time like so:

```
$ mocha
```

## Using the LocusZoom Plugin

Refer to `demo.html` to see an example of how to embed LocusZoom into a page. In general, a given web page must include the following resources:

* `assets/js/locuszoom.vendor.min.js` (concatenated minified vender files)
* `assets/js/locuszoom.app.js` OR `assets/js/locuszoom.app.min.js` (concatenated+minified application logic)
* `assets/css/locuszoom.css` (stylesheet)

LocusZoom only needs an empty `<div>` tag to create a new instance. The tag may optionally specify a starting region, like so:

```html
<div id="foo" data-region="10:114550452-115067678"></div>
```

To populate this `<div>` with a LocusZoom instance:

```javascript
LocusZoom.addInstanceToDivById(LocusZoom.DefaultInstance, "foo");
```

Alternatively, one or more `<div>` tags can share a common class name, and this class can be used to populate multiple LocusZoom instances at once like so:

```html
<div id="lz-1" class="lz-instance"></div>
<div id="lz-2" class="lz-instance"></div>
...
```

```javascript
LocusZoom.populate("lz-instance");
```

Also note that the default LocusZoom instance is `lz-instance`, so in the above example calling just `LocusZoom.populate()` would also work.
