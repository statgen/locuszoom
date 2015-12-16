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

Running `gulp` from the repo's root directory will do all of the above and keep running in *watch* mode, such that any changes to app js source files will immediately regenerate concatenated/minified app files for testing.

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

## Architecture

### LocusZoom Singleton

All LocusZoom assets are defined within a singleton object called `LocusZoom`. This object behaves like a namespace.

### Instances

A single LocusZoom manifestation, with independent display parameters and state, is an `Instance`.

The `LocusZoom` singleton may have arbitrarily many `Instance` objects. Instance objects are stored in the `LocusZoom.instances` property.

An Instance must have a globally unique `id`, which should correspond to the `id` property of the containing `<div>` tag for that instance. `LocusZoom.instances` is a key/value object where keys are Instance ids and values are Instance objects.

### Panels

A given Instance may have arbitrarily many `Panels`. A Panel is a physical subdivision of an instance intended to show a single type of graph, data representation, or collection of UI elements.

A Panel must have an `id` property that is unique within the scope of the instance. A Panel must also be defined by a class that extends the Panel prototype.

## API Reference

### `LocusZoom`

Singleton object defining the namespace for all LocusZoom instance(s) on a page

#### `LocusZoom.instances`

Key/value object for storing `Instance` objects by `id`.

#### `LocusZoom.addInstance(id)`

`id` - String

Creates a new `Instance`, binds to `<div>` element by `id` (globally unique id for the instance object *and* id parameter of the `<div>` tag to contain the Instance)

#### `LocusZoom.populate(class_name)`

`class_name` - String

Detects all `<div>` tags containing `class_name` as a class and initializes them as LocusZoom Instances

### `LocusZoom.Instance`

...

### `LocusZoom.Panel`

...