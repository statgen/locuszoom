# LocusZoom

(snappy project overview goes here)

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