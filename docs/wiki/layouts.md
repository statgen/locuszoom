> [[API Reference|Home]] ▸ **Layouts**

# Layouts

A Layout is a JSON object that is used to describe the composition and behavior of an entire LocusZoom plot *or* a component therein. As true JSON layouts cannot contain functions or special JavaScript literals such as `NaN` or `Infinity`.

Layouts are LocusZoom's "structure", and any subdivision of a LocusZoom plot is therefore described with a layout. For example, a data layer may be described with a layout and that data layer may be included in the layout of its containing panel, which in turn may be included in the layout of its containing plot. Any time a JSON object is used to describe the composition of a piece of a LocusZoom plot, that object is referred to as a layout.

In this documentation the individual elements in a layout are called **directives**. Depending on what the layout will be consumed to create there may be different directives that do different things. For example, supported directives for a data layer may differ from those used for a legend, or from a panel.

Refer to the following pages for specific documentation of supported directives by layout type:

* [[Plot layouts|Plot#plot-layout]]
* [[Panel layouts|Panel#panel-layout]]
* [[Data Layer layouts|Data-Layer#data-layer-layout]]
* [[Dashboard layouts|Dashboard#dashboard-layout]]

## User-Defined Layouts

Since any layout is just a JSON object it is always possible to build a new layout from scratch. For example, defining a layout for populating a new plot:

```javascript
var layout = {
  width: 100,
  height: 100,
  panels: [
    {
      id: "panel_1",
      /* more panel layout directives here... */
    }
  ]
}
var plot = LocusZoom.populate("#element", datasources, layout);
```

## Using Pre-Defined / Stored Layouts

The LocusZoom library comes with a variety of pre-defined layouts that can serve as completed plug-and-play layouts or as partial layouts to be modified as a jumping-off point.

These are accessed via the *`Layouts`* object.

### List Stored Layouts with `LocusZoom.Layouts.list()`

Stored layouts have a type and a name (a string identifier). List all available layouts by type like so:

```javascript
> LocusZoom.Layouts.list()
Object {plot: Array[3], panel: Array[5], data_layer: Array[7], dashboard: Array[2]}
```

And list the names of stored layouts of a given type by passing a type as the only argument:

```javascript
> LocusZoom.Layouts.list("plot")
["standard_association", "standard_phewas", "interval_association"]
```

### Get a Stored Layout with `LocusZoom.Layouts.get()`

To get a stored layout pass a type and a name to `LocusZoom.Layouts.get()` like so:

```javascript
> var layout = LocusZoom.Layouts.get("plot", "standard_association");
Object {width: 800, height: 450, resizable: "responsive", min_region_scale: 20000...}
```

An object detailing modifications to a layout can be passed in as a second argument. This will cause the returned layout to have the modifications automatically merged in:

```javascript
> var layout = LocusZoom.Layouts.get("plot", "standard_association", { width: 1000 });
Object {width: 1000, height: 450, resizable: "responsive", min_region_scale: 20000...}
```

The `get()` method can also be used when building custom layouts to pull in stored layouts as pieces:

```javascript
var plot_layout = {
  width: 1000,
  height: 1000,
  panels: [
    LocusZoom.Layouts.get("panel", "phewas", { width: 1000 })
  ]
}
```

### Store New Layouts with `LocusZoom.Layouts.add()`

LocusZoom's Layout storage can be used to store custom layouts at run-time. Pass a type and a name to the `add()` method to register the layout:

```javascript
LocusZoom.Layouts.add("plot", "my_custom_plot", { width: 1000, height: 1000... });
```

Note that this may be useful any time a layout may be reused and modified in the process. This is because of JavaScript's assign-by-reference behavior with respect to objects... Assigning a layout to a variable and then "copying" that object by assigning to another variable doesn't *actually* make a copy; both variables are references to the same object in memory and editing one will edit the other. When getting a layout via the `LocusZoom.Layouts` object, however, completely new objects that are not shared among other reference variables are returned, ensuring the layout can be edited without creating conflicts or strange behavior.

It also worth noting that there is no restriction on layout types when adding layouts. Pass a new type as the first argument and a new "bucket" for stored layouts of that type will be automatically created.

### Merge Two Layouts with `LocusZoom.Layouts.merge()`

If there are two layout objects each representing pretty much the same thing, one being a "baseline" layout (e.g. default values) and the other being a "customizations" layout (new values to overwrite defaults) then the merge method will cleanly combine them and return a new object with no shared references. Use like so:

```javascript
var baseline = {
  width: 800, min_width: 400
};
var customizations = {
  width: 1000, height: 1000
};
var new_layout = LocusZoom.Layouts.merge(customizations, baseline);
...
Object {width: 1000, min_width: 400, height: 1000}
```

Note that the same method is used internally when using `LocusZoom.Layouts.get()` and passing a modifications object (the stored layout being the baseline and the modifications being the customizations to apply).

## Advanced features
### Dynamic Namespacing
As described in [[Data Sources]], individual data sources must be *namespaced* if more than one are in use in a single plot. This usually manifests at the lowest levels in layout directives where field names are defined. For instance, when using a [[scatter data layer|Data-Layer#scatter]] it's necessary to set the `id_field` directive on the data layer layout to the field coming back from the data source to be interpreted as the unique identifier for the datum, but if the data source going into the scatter data layer is namespaced then that namespace must present on this directive, as well as all values defined in the `fields` array.

The Layouts object provides a shortcut for doing this in an automated way when getting stored layouts. To begin, it's possible to see which elements of a stored layout are namespaced and how by passing `unnamespaced: true` in the modifications object:

```javascript
> LocusZoom.Layouts.get("data_layer", "signifigance");
Object {
  namespace: { "sig": "sig" },
  id: "significance",
  type: "line",
  fields: ["sig:x", "sig:y"],
  x_axis: {
    field: "sig:x",
    decoupled: true
  },
  y_axis: {
      axis: 1,
      field: "sig:y"
  }
}

> LocusZoom.Layouts.get("data_layer", "signifigance", { unnamespaced: true });
Object {
  namespace: { "sig": "sig" },
  id: "significance",
  type: "line",
  fields: ["{{namespace[sig]}}x", "{{namespace[sig]}}y"],
  x_axis: {
    field: "{{namespace[sig]}}x",
    decoupled: true
  },
  y_axis: {
      axis: 1,
      field: "{{namespace[sig]}}y"
  }
}
```

Note the directives in the second example that look like `{{namespace[sig]}}x`, as well as the `namespace` directive. When a layout is request via the `get()` method all double-curly namespace strings are replaced using a best guess as to what the namespace should be. Passing a new `namespace` directive in the modifications argument will ensure that all namespaced fields are namespaced using the values provided, as follows:

```javascript
> LocusZoom.Layouts.get("data_layer", "signifigance", { namespace: "foo" });
Object {
  namespace: { "sig": "foo" },
  id: "significance",
  type: "line",
  fields: ["foo:x", "foo:y"],
  x_axis: {
    field: "foo:x",
    decoupled: true
  },
  y_axis: {
      axis: 1,
      field: "foo:y"
  }
}
```

Stored layouts may support arbitrarily many namespaces.

There is also a "special" namespace key of `default`. If no matching namespace key can be found but a default namespace is defined then the default namespace will be used. For example:

```javascript
> LocusZoom.Layouts.get("test", "example", { unnamespaced: true });
Object {
  namespace: { "default": "", "ns1": "foo", "ns2": "bar" },
  fields: ["{{namespace}}:x", "{{namespace[ns1]}}:y", "{{namespace[ns2]}}:z"],
}

> LocusZoom.Layouts.get("test", "example");
Object {
  namespace: { "default": "", "ns1": "foo", "ns2": "bar" },
  fields: ["x", "foo:y", "bar:z"],
}
```

### Conditional expressions
Sometimes, it is useful to only show a value when certain conditions are met. For example, a tooltip might have an additional field that is only displayed for certain datapoints.

`{{#if field_name}} Conditional text {{/if}}` will insert the contents of the tag only if the value exists. Since this only checks that a value exists for that datapoint at all, **variables with a value of 0 will be evaluated as true**. This can be used with namespaced values such as `{{#if assoc:field}}`.

Any dynamic namespacing will be applied when the layout is first retrieved- in the original layout, the dynamic namespace would be defined as `{{#if {{namespace[assoc]}}field}}`.
