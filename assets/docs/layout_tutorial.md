---
title: Working with LocusZoom Layouts
toc: true
toc-title: Table of Contents
---
# Summary
LocusZoom provides a rich set of features for visualizing and comparing genetic data, including by comparing multiple
 datasets within the same plot. It does so by embracing a configuration-driven model that decouples content 
 ([data sources](https://github.com/statgen/locuszoom/wiki/Data-Sources)) 
 from presentation (data layers).
 
Although the individual pieces are [documented](https://github.com/statgen/locuszoom/wiki/) at a low level, many of 
 the most interesting features arise from combining those pieces together in new ways. This guide attempts to cover the 
 "glue" that connects pieces together, and serves as a companion to the many code examples we provide. 

# Overview of architecture
## Separation of concerns
Any LocusZoom plot has two basic pieces: the data to use ([data sources](https://github.com/statgen/locuszoom/wiki/Data-Sources)),
 and how to show it (the SVG [plot](https://github.com/statgen/locuszoom/wiki/Plot), [panels](https://github.com/statgen/locuszoom/wiki/Panel),
  and [data layers](https://github.com/statgen/locuszoom/wiki/Data-Layer)). 

For most simple datasets, fetching information is relatively straightforward. This guide is primarily focused on
 presentation aspects, which are described by **layouts**. 

## Composition of pieces
The key to rendering multiple kinds of data is *composition*. LocusZoom provides a broad set of reusable building
 blocks, which can be stacked on top of each other (data layers), or adjacent (panels). New developers often begin by 
 inspecting the entire layout at once (top-down), but breaking it into individual pieces (reading the layout "bottom-up")
  is much more effective (and less intimidating). Oftentimes, you can achieve the customizations you want by modifying 
  only a few options. 
 
Understanding the basic building blocks is key to customizing a rendering for your needs. 
See: [SVG architecture](https://github.com/statgen/locuszoom/wiki/SVG-Architecture) in the documentation for a useful
 visual reference, or skip to "how to read a layout" below.

## Configuration-driven
Each key in a layout object corresponds to a set of options supported by the thing that the configuration is intended 
to control. For example, scatter plots allow customizing simple options that obey exactly one rule (like what to show 
on the x-axis), but there are also *scalable* parameters like `point_size` and `point_shape`, in which case several 
rules can be tried in sequence until a matching condition is satisfied.

When reading a layout, keep in mind which directives are scalable, as these in turn represent their own mini-language 
of options. (eg, `scale_function`s take in a value, and return another value). This means that a given toolbar 
([dashboard](https://github.com/statgen/locuszoom/wiki/Dashboard)), [panel](https://github.com/statgen/locuszoom/wiki/Panel),
 or [data layer](https://github.com/statgen/locuszoom/wiki/Data-Layer) layout will often incorporate layout directives for 
[Scale functions](https://github.com/statgen/locuszoom/wiki/Scale-Functions) or
 [Transformation Functions](https://github.com/statgen/locuszoom/blob/develop/assets/js/app/Singletons.js#L146) as well.
 
If you cannot find a particular option documented as part of a data layer, it may be part of this nested context.

## Plugins via a central registry
LocusZoom supports plugins without additional installation code, via a central registry that tracks available features. 

A layout object does not define code or new features: layouts are simple JSON-serializable configuration objects that 
spell out how to use existing rendering types. Custom data sources, layers, or scale functions must be defined before use. 
The dependence on the central registry means that code features (like a particular type of data layer or scale function) 
are requested by name, as strings. 

In order to ensure that each rendering is totally isolated and de-coupled, all **layouts must be JSON-serializable**. 
Simple types like strings, objects, numbers, and lists are allowed, but a layout cannot contain code. At plot creation, 
LocusZoom will interpret the layout and locate the features you request by name.

# Working with layouts
## How to read a layout
A good way to practice reading layouts (as a combination of several pieces) is to look at the 
[source code](https://github.com/statgen/locuszoom/blob/develop/assets/js/app/Layouts.js) where standard layouts 
are defined. Consider the `standard_association` plot:

```js
LocusZoom.Layouts.add('plot', 'standard_association', {
    state: {},
    width: 800,
    height: 450,
    responsive_resize: true,
    min_region_scale: 20000,
    max_region_scale: 1000000,
    dashboard: LocusZoom.Layouts.get('dashboard', 'standard_plot', { unnamespaced: true }),
    panels: [
        LocusZoom.Layouts.get('panel', 'association', { unnamespaced: true, height: 225 }),
        LocusZoom.Layouts.get('panel', 'genes', { unnamespaced: true, height: 225 })
    ]
});
```

In this view, we have abstracted away all the details of what is plotted, and we can just see the basic pieces: this 
plot has two panels (association data and genes data) that are displayed separately on the same screen. At the plot level, 
we ask for 450 px in height, and each panel gets half that space (225 px). The actual details of what to 
render are defined as nested layouts (association and genes panels), and the registry also contains predefined options 
for this piece- `LocusZoom.Layouts.get(...)` returns a JSON object.  

Although the layout could be defined as a single giant object (top-down view of everything at once), defining it in 
terms of reusable building blocks (bottom up) makes it much easier to read and see boundaries. 

Note that this layout is defined using `LocusZoom.Layouts.add(...)`. We will cover this in "working with the registry", below.

### Will this layout work with my data?
LocusZoom has two pieces: content and presentation. By default, the default data layers are designed to work with the 
field names (and formats) used by the [UMich Portaldev API](https://portaldev.sph.umich.edu/docs/api/v1/#overview-of-api-endpoints).
If your data source returns a different payload format, field names, or notation conventions, you may need to modify a 
pre-existing layout in order to plot that data.

Consider this fragment of the standard association data layer, shown below: 

```js
LocusZoom.Layouts.add('data_layer', 'association_pvalues', {
    namespace: { 'assoc': 'assoc', 'ld': 'ld' },
    type: 'scatter',
    fields: ['{{namespace[assoc]}}variant', '{{namespace[assoc]}}position', '{{namespace[assoc]}}log_pvalue', '{{namespace[assoc]}}log_pvalue|logtoscinotation', '{{namespace[assoc]}}ref_allele', '{{namespace[ld]}}state', '{{namespace[ld]}}isrefvar'],
    id_field: '{{namespace[assoc]}}variant',
    x_axis: {
        field: '{{namespace[assoc]}}position'
    }
});
```

Key things to notice are:

1. The data layer will only see the fields requested by name. Even if a field is present in the API payload, it
    will not be visible in the data layer unless explicitly referenced in the `fields` array for that data layer.
2. This layout is generic: the use of namespaces means "given association data from somewhere". See "using namespaces" 
    below for more details on how to use an abstract layout with a specific dataset (via namespaces).
3. Other sections of the layout (such as `x_axis`) can reference the fields requested, using the same syntax. But the 
    field must always be requested in the `fields` array.

You will sometimes see fields referenced elsewhere with an additional syntax, like `{{namespace[assoc]}}variant|htmlescape`.
The `|htmlescape` is a *transform* that affects value display. The fields array only needs to specify the names of fields; 
transforms can be applied at any time later.

#### No system of notation survives contact with developers
There are some exceptions to this rule- it is difficult to support every possible combination of data sources from every possible set of API conventions.
 
One place where this breaks down is *dependent* sources- eg, LD information is requested relative to the most significant
 variant in the association data. Differences in field formatting or nomenclature can sometimes break the ability to
 find the relevant information that the second data source requires; efforts are made to handle common use cases.
  These sources gradually become more generic over time based on user feedback and needs. 
 
The other main exception to the `fields` mechanism involves API endpoints that return complex nested objects (eg the list
 of genes in a region, a standard dataset that few people will ever need to customize directly). By notation convention,
 the default LocusZoom layouts will indicate that special behavior is in effect via a dummy field called `all`, eg 
 
```js
{ 
  fields: ['{{namespace[gene]}}all', '{{namespace[constraint]}}all'] 
}
```

Explanation: a data layer will not fetch from a source unless the fields array references at least one piece
 of data from that source. Since the genes source bypasses explicit fields, it uses a dummy field to trigger the request.
  
Most standard data types use the system of exact field names. A more detailed guide is beyond the scope of this tutorial; 
 this behavior is governed by the `extractFields` method of `LocusZoom.Data.Source`.

## Working with the Registry
Typically, LocusZoom layouts are loaded via the registry, a set of pre-made reusable layouts. The act of fetching a 
layout converts it from the abstract definition to one that works with a specific dataset.  

Since the registry just returns JSON-serializable objects, you could create a plot or panel configuration by hand. 
But this is often tedious, and using the registry will save you from writing many lines of boilerplate code. 

### What pieces are available?

To see the list of pre-defined layouts (as well as any custom ones you have created):
```js
> LocusZoom.Layouts.list();
{plot: Array(4), panel: Array(7), data_layer: Array(9), dashboard: Array(4), dashboard_components: Array(1), tooltip: Array(5) }
```

This will return a top level representation of the available types, showing the available categories. Note that even 
data layers are composed of smaller building blocks. This lets you use individual parts of a representation (like 
association tooltips) without committing to the other design choices for a common piece (like the association layer). 

Asking for just the plots shows a list of specific options. Typically, we try to provide example pages that use (most) 
of the layouts that come with LocusZoom; see the [example gallery](http://statgen.github.io/locuszoom/) to preview how 
these layouts would look.
 
```js
> LocusZoom.Layouts.list('plot');
(4) ["standard_association", "association_catalog", "standard_phewas", "interval_association"]
```

You may find that the example gallery performs additional customizations on a layout, so this can be a source of ideas.
Typically, we try very hard to not make major changes in a layout that is widely in use. Any backwards-incompatible changes 
will usually be identified in the [release notes](https://github.com/statgen/locuszoom/releases).  

### Abstract vs concrete
When a layout is first loaded into the registry, it is defined to work in the abstract- given any data. This allows the
 same layout to be re-used on two different association datasets. The syntax used is `{{namespace[assoc]}}variant`,
  where namespaces are replaced by a specific datasource name later on.
 
```js
LocusZoom.Layouts.add('data_layer', 'association_pvalues', { // Define a new datalayer
    namespace: { 'assoc': 'assoc', 'ld': 'ld' },  // Provides default namespaces, eg look for "assoc" data in a source called "assoc"
    fields: ['{{namespace[assoc]}}variant', '{{namespace[assoc]}}position', '{{namespace[assoc]}}log_pvalue', '{{namespace[assoc]}}log_pvalue|logtoscinotation', '{{namespace[assoc]}}ref_allele', '{{namespace[ld]}}state', '{{namespace[ld]}}isrefvar'],
});
```

It is the act of fetching the layout from the registry that turns it into a concrete one- "find the association data 
from a particular source". There are three ways to fetch something, and each behaves in a unique way:

1. Fetch an existing layout, and tell it where to find the required data. (the third argument, "modifications", is given an explicit set of namespaces)

    ```js
    > LocusZoom.Layouts.get('data_layer', 'association_pvalues', { namespace: { assoc: 'my_dataset_1' } } );
    {
        fields: ["my_dataset_1:variant","my_dataset_1:position","my_dataset_1:log_pvalue","my_dataset_1:log_pvalue|logtoscinotation","my_dataset_1:ref_allele","ld:state","ld:isrefvar"]
    }
    ```
2. Fetch an existing layout, and use the "default" data sources. If you follow the examples very closely 
    (eg naming your data source "assoc" and "ld"), this will automatically find the right data.
    
    ```js
    > LocusZoom.Layouts.get('data_layer', 'association_pvalues');
    {
        fields: ["assoc:variant", "assoc:position", "assoc:log_pvalue", "assoc:log_pvalue|logtoscinotation", "assoc:ref_allele", "ld:state", "ld:isrefvar"] 
    }
    ```

3. Fetch an existing abstract layout for further modification, and keep it abstract. Note the special `unnamespaced: true` option, which causes
 the layout to be returned exactly as it appears in the registry (*abstract*). This option is used quite a lot in the LZ source code (`Layouts.js`), 
 because it makes it easy to build a reusable abstract layout (like a panel) out of smaller reusable pieces (like datalayers).
 
    ```js
    > LocusZoom.Layouts.get('data_layer', 'association_pvalues', { unnamespaced: true });
    {
        namespace: { assoc: 'assoc', ld: 'ld' },
        fields: ['{{namespace[assoc]}}variant', '{{namespace[assoc]}}position', '{{namespace[assoc]}}log_pvalue', '{{namespace[assoc]}}log_pvalue|logtoscinotation', '{{namespace[assoc]}}ref_allele', '{{namespace[ld]}}state', '{{namespace[ld]}}isrefvar'],
    }
    ```

### Modifying all (or part) of a layout
If you are building your own API aimed at use with LocusZoom, then the path of least resistance is to use the same field
 names as the pre-defined layouts.
 
The most straightforward way to modify a layout is to pass just a few overrides. This works will for simple values (like strings), or keys of nested objects:

Consider an association plot, where the only requested change is to use the right side y-axis (2) instead of the 
left side y-axis (1, the default). This can be accomplished by adding a key to the third argument of 
`LocusZoom.Layouts.get(...)`. Note how the other existing options are preserved.

```js
> LocusZoom.Layouts.get('data_layer', 'association_pvalues', { namespace: { assoc: 'my_dataset_1' }, y_axis: { axis: 2 } } );
{ 
  y_axis: { axis: 2, field: "my_dataset_1:log_pvalue", floor: 0, upper_buffer: 0.1, min_extent: [0, 10] }
}
```

The "modifications" object does not work as well for compound values, like a list, because this behavior is not well defined: 
 changing the 5th element of a list could mean replacement, removal, or minor additions to fields... etc. In practice, 
 this is quite often relevant... because panels and data layers are specified as lists. (order matters)
 
For complex scenarios like adding toolbar buttons or overriding the panels/data layers in a plot, then you can build 
your own layout using all or some of the pieces of the layouts registry. One commonly used trick is to modify just 
one part of an existing array field via *self-calling functions* that immediately 
return a new, modified object. Eg, for a toolbar (dashboard) that adds just one extra button to an existing layout:

```js
{
    dashboard: (function () {
        var base = LocusZoom.Layouts.get('dashboard', 'standard_panel', { unnamespaced: true });
        base.components.push({
            type: 'toggle_legend',
            position: 'right'
        });
        return base;
    })() // Function calls itself immediately, so "dashboard" is set to the return value
}
```

Currently, modifying every level of a deeply nested layout is not an ideal process. Although the above trick (combined 
with our efforts at backwards compatibility) makes the process possible without copying hundreds of lines of code, 
we are exploring other, more ergonomic ways to customize layouts in the future. 

## Where to find more information
Composition of smaller pieces is a powerful strategy- but it also means that no single documentation page can explain 
every feature (because important behavior emerges when two building blocks are combined). As such, examples are a key 
and explicit part of how LocusZoom usage is documented. 

We encourage you to look at the builtin layouts (via the JS console, or [source code](https://github.com/statgen/locuszoom/blob/develop/assets/js/app/Layouts.js)) 
as a guide to "what works", and the [example gallery](http://statgen.github.io/locuszoom/) (with  
[example code](https://github.com/statgen/locuszoom/tree/develop/examples)) to see what options look like in practice. 
The Layouts [documentation](https://github.com/statgen/locuszoom/wiki/Layouts) provides a more low-level overview.

Lastly: LocusZoom works with evolving datasets, and pieces were contributed by different authors. For every hard and 
fast "rule", there is always an exception! If you find gaps in the documentation, please contact the developers 
(or [mailing list](https://groups.google.com/forum/#!forum/locuszoom)) and we will make improvements. 

# Advanced use cases
## Plotting more than one study
It is often desirable to draw comparisons between two studies- eg, by plotting two association tracks (panels) 
 on the same page. This means that you will need to create two association panel layouts, and each one will need to know
 where to find the relevant data for that track.
 
In LocusZoom, this is accomplished via *namespaces*.

### Using namespaces
A namespaced layout (usually for panels and below) is one that identifies where to find the relevant data. Due to how 
  separation of concerns works, this requires coordination between the data sources (content) and the layout (presentation).

Consider the following example, which plots two association studies and a genes track:

```js
// Other standard sources (genes, LD) omitted for clarity
data_sources
  .add("assoc_study1", ["AssociationLZ", {url: "/api/association/", params: { source: 1 }}])
  .add("assoc_study2", ["AssociationLZ", {url: "/api/association/", params: { source: 2 }}]);
```

```js
// This outer call to Layouts.get() will ensure that namespaces are applied, and the returned result is a concrete 
//   layout ready for use in drawing a plot with specific data sets. 
const plot_layout = LocusZoom.Layouts.get('plot', 'standard_association', { // Override select fields of a pre-made layout 
    height: 1200, // The default plot was sized for two panels. Make sure to allocate enough room for the extra panel. 
    responsive_resize: true,
    panels: [
        LocusZoom.Layouts.get('panel', 'association', {
            namespace: { assoc: 'assoc_study1' }, // This is the key piece. It says "for this panel, and its child data layers, look for the association data in a datasource called "assoc_study1".
            proportional_height: 0.33,
            id: 'assoc_study1', // Give each panel a unique ID
            title: { text: 'Study 1' },
        }),
        LocusZoom.Layouts.get('panel', 'association', {
            namespace: { assoc: 'assoc_study2' },
            proportional_height: 0.33, // Modifies the default so that all three panels get enough space
            id: 'assoc_study2',
            title: { text: 'Study 2' },
        }),
        // Even though genes are part of the original "standard association plot" layout, overriding the panels array means replacing *all* of the panels.
        LocusZoom.Layouts.get('panel', 'genes', { unnamespaced: true, proportional_height: 0.33 })  // "unnamespaced" when using as a generic building block
    ]
});
```

Namespaces are not only external- they propagate through to how the layer actually sees its data internally. The field 
names inside the layer are a composite of `sourcename:fieldname`. For example, this allows the same data layer to work 
with two pieces of information (like summary stats and LD) even if both API endpoints provide a common field name like `id`. 
Namespacing ensures that duplicate field names do not collide.

From the example above, the second panel (which fetches association data from `assoc_study2`) converts a "generic"
 specification like `{{namespace[assoc]}}variant` into a "concrete" use of one dataset: `assoc_study2:variant`.
 
```js
> var layer_data = Object.keys(plot.panels['assoc_study2'].data_layers['associationpvalues'].data);
Object.keys(layer_data[0]); // See the field names used by the data for a single point
["assoc_study2:variant", "assoc_study2:position", "assoc_study2:log_pvalue", "assoc_study2:log_pvalue|logtoscinotation", "assoc_study2:ref_allele", "ld:state", "ld:isrefvar"]
```

### Adding panels
The above example demonstrates how to add multiple studies at the time of plot creation. However, sites like the T2D 
Portal have many datasets, and it can be helpful to let the user interactively choose which other panels to show after
 first render. New panels can be added dynamically! When doing so, the plot will grow to accommodate the new panel;
  dynamic panels do not require specifying `proportional_height` etc.

```js
// This creates a new configuration object
var extra_panel_layout = LocusZoom.Layouts.get('panel', 'association', {
    namespace: { assoc: 'assoc_study3' },
    id: 'assoc_study3',
    title: { text: 'Study 3' },
    y_index: -1 // Special option used by addPanel: inserts this study right before the genes track
});

// Must add both data sources and panels
existing_datasources
  .add("assoc_study3", ["AssociationLZ", {url: "/api/association/", params: { source: 3 }}]);

const new_panel = existing_plot.addPanel(extra_panel_layout); // Adds the panel and redraws plot
```

### Common issues
One of the most common issues in working with namespaced layouts is the difference between *abstract* and *concrete* 
layouts. For example, imagine if the page contained a button to toggle the display of labels on the plot. This button 
might work by changing the plot layout options, then triggering a re-render.

Here is how label options would be specified when defining a layout in the registry (abstract), so that labels were 
present on the very first re-render for any dataset that used this layout. Note that it identifies the key fields using 
a generic `namespace` reference:

```js
const generic_layout_with_special_labels = {
    // Other data layer fields omitted for clarity
    label: {
        text: '{{{{namespace[assoc]}}variant|htmlescape}}',
        filters: [ // Only label points if they are above significance threshold
            { field: '{{namespace[assoc]}}log_pvalue',  operator: '>', value: 7.301 },
        ],
        spacing: 6,
    }
};
```

However, once the final layout has been created and used to draw the plot, mutating the layout would require 
the actual field name (with namespace applied), specific to the panel being changed:
```js
plot.panels['assoc_study2'].data_layers['associationpvalues'].layout.label = {
    text: '{{assoc_study2:variant|htmlescape}}', // Extra outer curly braces around name = Value of field
    filters: [ // Only label points if they are above significance threshold
        { field: 'assoc_study2:log_pvalue',  operator: '>', value: 7.301 }, // No curly braces: specifies name of field
    ],
    spacing: 6,
};
plot.applyState(); // to re-render with labels
```

When you are not sure what notation convention to use, check the rest of your layout- the JS console is a very powerful
 tool, and development is much easier when you can introspect the actual behavior of your code.

## Where to find more information
 We also provide other tools (such as [LocalZoom](https://github.com/statgen/localzoom/blob/develop/src/util/lz-helpers.js)),
 which demonstrate higher-order concepts like adding multiple panels to the same plot. Note that this code base 
 is very heavily oriented around the idea of composition, with functions like `createStudyLayout`, 
 `createStudyTabixSources`, and `addPanels`. Instead of defining the entire layout, this structure is focused on 
 creating each piece required and combining them as appropriate. The same process is used to create layouts for
 the first study as for the fourth.
