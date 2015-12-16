## Architecture

### LocusZoom Singleton

All LocusZoom assets are defined within a singleton object called `LocusZoom`. This object behaves like a namespace.

### Instances

A single LocusZoom manifestation, with independent display parameters and state, is an `Instance`.

The `LocusZoom` singleton may have arbitrarily many `Instance` objects. Instance objects are stored in the `LocusZoom._instances` property.

An Instance must have a globally unique `id`, which should correspond to the `id` property of the containing `<div>` tag for that instance. `LocusZoom._instances` is a key/value object where keys are Instance ids and values are Instance objects.

### Panels

A given Instance may have arbitrarily many `Panels`. A Panel is a physical subdivision of an instance intended to show a single type of graph, data representation, or collection of UI elements.

A Panel must have an `id` property that is unique within the scope of the instance. A Panel must also be defined by a class that extends the Panel prototype.
