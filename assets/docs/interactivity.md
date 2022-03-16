---
title: Mechanisms for Interactivity
toc: true
toc-title: Table of Contents
---
Traditionally, LocusZoom visualizations are designed to serve as artifacts for publication. These tend to be static images, in which information is conveyed via visual qualities such as color, size, shape, and position.

With the advent of LocusZoom.js in the web browser, an additional dimension was added: *time*. Interactivity allows the user to toggle between two different views, and very quickly see how results are changed (eg different LD populations, before/after a calculation, etc). Responding to user-initiated events in real time also makes it possible to filter which results are shown, based on user-provided criteria ("significant pvalues") or matching behavior ("find similar items in other panels").

Another benefit of working in the web browser is that data can be dynamically connected to other representations: for example, an HTML table can be updated to always use the same data shown in the plot.

> *WARNING:* This guide covers some of the most advanced mechanisms in LocusZoom, and assumes a strong knowledge of other features such as  layouts, namespaces, and data adapters.

# Communication with the outside world
## Who controls the data? (push vs pull)
A LocusZoom.js plot allows the user to pan and zoom to new regions. In order to update in response to user events, the plot must be able to ask for (pull) the data it needs, rather than render whatever it was given initially (push). 

This is a common sticking point when adding LocusZoom to a page with other interactive widgets that share the same data: each widget makes assumptions about the shape of the data, and it can be frustrating to cede control of data requests to any one piece of the page. Trying to force-feed data from outside of the plot (push) often leads to bugs, because the external page and LocusZoom may not agree on what data is to be shown.

Fortunately, there are ways for widgets to cooperate! In the pull-oriented data retrieval model used by LocusZoom, data fetches are represented as a discrete event. Thus it is possible to recognize when the plot changes, and broadcast updates to other widgets accordingly. We provide several mechanisms (such as `plot.subscribeToData`) to make this possible.

### What is remembered?
Each time the plot is re-rendered, LocusZoom.js determines what data should be shown. Client-side features like filters and matching apply after the network request is complete: thus the data is recalculated even if the user is viewing the same region.

Because LocusZoom pulls in its data, very little state is preserved within the rendering layer when the plot is redrawn. Outside of a few selected mechanisms (eg display annotations), changes to data (like calculated fields) should be added in the data adapter, not in the rendering layer.

> Tip: *Do not* try to force display changes by mutating `data_layer.data` directly: the changes would be overwritten on the next re-render. 
> 
> The best way to create a bug free page is to use mechanisms that cooperate with the data flow, rather than trying to impose a different model imperatively from the outside.

*See also*:
 
* Adding custom fields while fetching data: `BaseApiAdapter.annotateData`
* Adding interactive rendering hints such as "show a label for this point": `BaseDataLayer.setElementAnnotation`

## Using external commands to update the plot
There are many times when it would be advantageous to alter the plot in response to external events. For example: the user might define aggregation tests based on a set of variants, then update the plot with the results of the calculation.

The most common mechanism for this to happen is to provide the new information as parameters in global *state* : `plot.applyState({option1: value1})`. The *state* is accessible to all data adapters, and can thus be used to modify the data requested. At the end of `applyState`, the plot is automatically re-rendered to reflect the new information.

This is a surprisingly common operation. For example, to change the  genetic region shown in the plot, we often write the following code:
`plot.applyState({chr:'1', start: 100, end: 500})`

It is also possible to call `plot.applyState()` without arguments, and the plot will still re-render as needed. This is used with techniques like layout mutations (below): something about the plot is changed, and then the plot is re-rendered.

### Not all data operations happen on the server
Although *state*  can be used to influence how a network request is performed, this is by no means the only option. For example, a data source could be written to perform a calculation (rather than a network request), and the state parameters could contain inputs that affect how the calculation is run.

## Maintaining consistency
When using a LocusZoom plot to communicate with other parts of the page, it is a good idea to practice separation of concerns. This means allowing LocusZoom to handle its own internals, and using the provided mechanisms (like events) to understand when changes occur.

For example, consider a LocusZoom plot that shows two datasets as stacked panels, on a page with an external "dataset picker" that showed which tracks were added. A user could remove one track by clicking either the "dataset picker" (outside LocusZoom) or the "remove panel" button (inside LocusZoom): either way, the dataset picker should always accurately reflect whether or not the panel is really being shown.

Rather than tracking the list of shown panels in two places, use provided LocusZoom events (like `panel_removed`) to respond to events that could be initiated from within the plot. Thus, LocusZoom can communicate changes to the outside world, and both widgets can accurately reflect what the user sees.

> Currently, there is no `panel_added` event in LocusZoom, because at present this action cannot be initiated from a user action within the plot. The list of events is not exhaustive, but efforts are made to reflect scenarios where communication is useful.

# Primitives: Underlying mechanisms
In order to allow interactivity, LocusZoom.js provides a few common mechanisms for operating on data. These mechanisms can be combined into more powerful forms. 

## Layout mutations change what gets rendered
Each LocusZoom rendering is controlled by a declarative set of layout options. In practice, this means that a clever developer can change key options (eg point color, or what field is shown on the y-axis) simply by modifying (mutating) the layout, then re-rendering.

In practice, this is the key idea behind the `display_options` widget, a built-in feature that handles such mutations in a controlled fashion. If you are doing this using your own code, the following "gotchas" apply:

* LocusZoom layouts are nested and hierarchical (plot --> panels[] --> data_layers[]). See the helper functions below for advice on how to write mutations that are more readable and maintainable.
* Be conservative in how many fields you allow to be changed. Layouts allow almost any aspect of the plot to be customized, but it can be difficult to test every possible combination. It's generally easier to code and maintain controlled options (like a list of preset views).

After re-defining the layout, be sure to call `plot.applyState()` (also known as `plot.refresh()`) to trigger a re-render, so that the changes to the layout take effect. 

### Helper functions for modifying nested layouts
The "building block" style of layouts makes it easy to reuse pieces, but customizing part of a layout after rendering can be very clunky (example: `layout.panels[0].data_layers[1]`). In particular, if the order of elements in the layout ever changed (like adding a new panel or toolbar button), then code that accessed items by array position would break in ways that are very hard to debug. This is a maintainability headache.

As an alternative, a helper function `LocusZoom.Layouts.mutate_attrs` can be used to modify all parts of a layout that match a selector, using a readable syntax based on the [JsonPath](https://goessner.net/articles/JsonPath/) query language. See the developer documentation for further details.

Examples:
```javascript
// Add a field to a data layer, taking into account what fields are already there. The third argument is a function that receives the old value and returns the new one 
> LocusZoom.Layouts.mutate_attrs(plot_layout, '$..data_layers[?(@.tag === "association")].fields', (old_value) => old_value.concat(['assoc:field1', 'assoc:field2']));

// When the user clicks a button on the page, change what field is used for the y-axis for all association scatter plots. In this syntax, all matches receive the same value (the last argument is a value, instead of a callable function).
> LocusZoom.Layouts.mutate_attrs(existing_plot.layout, '$..data_layers[?(@.tag === "association")].y_axis.field', 'assoc:pip_cluster');
> existing_plot.applyState();

// The mutation function is not limited to changing scalar values or lists. If the selector targets a compound object, the function can be used to modify several properties all at once. Make sure to return the resulting config object when done.
> LocusZoom.Layouts.mutate_attrs(existing_plot.layout, '$..data_layers[?(@.tag === "phewas")].color[?(@.scale_function === "categorical_bin")]', function(options) { options.field = 'newfield'; options.parameters.null_value = 'red' ; return options; });

// For debugging purposes, there is a read-only function that can be used to verify that a selector works as expected. It will return a list, one item per result.
> LocusZoom.Layouts.query_attrs(plot_layout, '$..id');
```

*Notes:*

We do not implement the entire JsonPath specification. The syntax used by LocusZoom: 

 - DOES support single child (`.`), deep nested (`..`), and wild-card (`*`) accessors
 - DOES support filtering arrays-of-config-objects to only items that match a simple single-attribute-exact-match predicate (`$.panels_array[?(@.akeyhasvalue === "targetvalue")]`)
 - DOES support queries that nest/combine operators (`$..data_layers[?(@.tag === 'association')].fields`)
 - DOES NOT support complex JS expressions in predicates (which would be a security issue), or indexing array items. (writing layouts based on item[0] is a maintainability anti-pattern, and we are actively trying to discourage doing that)
 - The end result of all selectors used should be to return a specific key inside an object. Lists can be filtered, but not indexed.

Most pre-made data layer and panel layouts now contain a `tag` field, which can be used to write semantically meaningful selectors, like, "modify all scatter plots that show GWAS association data".

> This helper function is aimed at making quick changes to one or two fields (before render), or more complex customizations (after render). If you are trying to make complex customizations to a layout when it is first defined, it is often better to build up in pieces so that you have more control of the result. For example, customizing a single data layer as part of a layout: `LocusZoom.Layouts.get('data_layer', 'association', { id: 'customoverridevalue' })`.

## Events communicate with the outside world
Each time that a LocusZoom plot is modified, it fires an *event* that notifies any listeners of the change.

An event listener can be connected as follows. (note that the listener can contain any arbitrary code):
```javascript
const listener = plot.on('element_selection', (event) => console.log(event)); 
```

And the same event listener can be unregistered using the function handle for that listener:
```javascript
plot.off('element_selection', listener);
```

Each time that an event callback is fired, it will receive one function argument, an object with the following keys:

* `sourceID`: where the event originated. It is the fully qualified ID string relative to the top level: eg `lz_plot.association_panel`
* `target` : the place where the event originated. This is a reference to either the `Plot` or `Panel` object.
* `data` : Each type of event may optionally provide additional information describing itself (such as "what point was clicked" or "was this point selected, or de-selected?"). The allowed fields are unique to each event type.

Below is a partial list of interesting events; consult the documentation for a full guide to events and the data they emit.

* `element_selection`
* `element_annotation`
* `panel_removed`
* `region_changed`
* `state_changed`

Custom widget or tooltip code can fire any event you want. For example, many widgets fire events to describe buttons that are clicked. Events are not limited to controlling the page- they can also be used in combination with page analytics to identify which options or features are being used the most.  

## Share data with other widgets via `subscribeToData`
Using the same mechanisms and syntax as an LZ data layer, let arbitrary parts of the page listen for new data by asking for the (namespaced) fields of interest. 

Sample usage: 
```javascript
// Receives exactly the same data as the specified datalayer ID (avoids having to duplicate namespace and data operations code)
const spec = { from_layer: 'panel1.layer1' };
const success_callback = (data) => console.log(data);
const opts = { onerror: (err) => console.log(err) };

plot.subscribeToData(spec, success_callback, opts);
```

When data is received, calls *success_callback* with the resulting data (an array of objects, with each object representing one datapoint). `subscribeToData` can be used to draw tables or companion visualizations on the page, separate from LocusZoom but automatically updating to stay in sync as the user clicks or pans across the plot. Specify *onerror* as an option to provide an error handling callback.

Sometimes you want exact control over what data is retrieved, rather than mirroring a data layer. In that case, replace `from_layer` with two options (`namespace` and `data_operations`) to manually specify how data is retrieved for this callback. See data layer documentation for syntax and usage.

### Advanced alternative
Sometimes, the existing page already has several widgets sharing data, and it would be difficult to rewrite things after the fact in a way that ceded control of data to LocusZoom. In this case, some compromise needs to be reached: how can LocusZoom fetch what it needs (possibly rendering only a subset of the data available), without duplicating API calls to the server that have already been made elsewhere?

Reactive rendering frameworks sometimes solve the problem of sharing mutable data via a shared local cache (store) that represents data from the server. LocusZoom can then make requests to that store, and the store is then responsible for deciding whether a new server request is needed. This allows the result of a single API request to power all widgets on the page without redundant network traffic. The store call can then return a promise representing either local data, or the result of a server request, as appropriate.

In this model, if the data changed due to an external event, LocusZoom might need to be notified that new data is available. This is best done using the standard methods used to trigger a re-render from outside the plot  (`plot.applyState()`).

If you are not using a store, this manual re-render can also be triggered by watching an observable value. (many frameworks provide a way to manually watch values for changes ([eg vue.js](https://vuejs.org/v2/guide/computed.html#Watchers)).

## Filters control what is shown
Filters can be used to control what elements are shown on a panel. This will hide elements, but preserve the space that those elements would have occupied: eg, the axis limits will reflect all of the data, not just what is currently shown.

Filters are specified in data layout layouts, and can be applied to most data layer types.
```javascript
{
  ...options,
  filters: [
    { field: '{{namespace[access]}}score', operator: '!=', value: null },
  ],
}
```

Scatter plots have an additional option to show labels for some or all data elements. This is controlled via adding a similar filter block inside *label*:
```javascript
{
  id: 'phewaspvalues',
  ...options,
  label: {
    text: '{{{{namespace[phewas]}}trait_label}}',
    filters: [
      {
        field: '{{namespace[phewas]}}log_pvalue',
        operator: '>=',
        value: 20,
      },
    ],
  }
}
```

The following filters are available:

* `=`: field value *exactly* matches the provided value
* `!=`: field value *loosely* does not match the provided value (can be used to filter out falsy values such as undefined, null, or false)
* Numerical comparisons: `<`, `<=`,  `>`, `>=`
* `in`: field value is present inside the provided value. The provided value can be a string, or, more commonly, an array: eg "gene type is one of the following".
* `match`: the provided value is present in the field value. Useful for partial text search, eg "show only genes whose name contains the user-provided filter string "HLA"

> *NOTE:* If a list of multiple filters is provided, then *all* filter conditions must be true for an item to be shown in the plot.

Filters can be modified interactively by the user after first render: see the `filter_field` widget for details.

### Adding your own custom filter
In some cases, a developer may wish to control the filter logic via a bit of custom code, if the built-in filters are too restrictive. Like many aspects of LocusZoom, the set of allowed filters can be extended via a plugin mechanism: you may use any filter operator defined in `LocusZoom.MatchFunctions.list()`.

To add your own comparison function, use: `LocusZoom.MatchFunctions.add('my_function', (item_value, target_value) => item_value === target_value)`. Custom filters can then be mixed and matched alongside the built-in filters.

A rarely used feature of filters is that it is possible to omit the `field` name, in which case the entire datum object of all fields is passed to the filter function: `{operator: 'my_other_function'}`. This is only useful with custom operators, because the built in `MatchFunctions` are all designed to operate on a single scalar value. Also, if used in this way, the custom filter function will need to know how to deal with namespacing in order to find the fields of interest.  (each datum element will look like `{'assoc:log_pvalue': 12, 'assoc:variant': '1:23_A/C'}`) Still, in some rare cases, it can be useful to have a single filter function that examines more than one field at once.

### Filters can transform the value before comparing
Sometimes, it is useful to transform a value before filtering. For example, many datasets store values in terms of `pvalue`, but you may wish to show significant hits in terms of `-log10 (pvalue)`. Filter syntax works with any transformation/template string function in LocusZoom:

```
{
  ...options,
  filters: [
    { field: '{{namespace[assoc]}}pvalue|neglog10', operator: '>=', value: 7.301 },
  ],
}
```

## Annotations preserve custom options across re-render
LocusZoom typically maintains a separation of concerns, in which data layers are responsible for rendering the data provided by an adapter. For the most part, the display layer is not responsible for changing data, and it does not preserve state across renderings

However, there are some situations where a user might wish to modify how the data is shown: eg "show a label for this one specific point".

The basic mechanism for this is called *annotations*:  
```javascript
// External code, or tooltips, may set a value
data_layer.setElementAnnotation(element_data, key, value);
data_layer.getElementAnnotation(item, key);
```

Essentially, a rendering annotation stores an additional field for a given data point, but that field is stored internally rather than being sent by the data adapter. It can be used in any layout directive that operates on fields: size, shape, color, labels, etc.

The value can be anything you wish. However, LocusZoom works best when field values are primitives (like strings or integers).

Typically this is used by tooltips, allowing the user to click a link and modify how a point is shown. See the example below:

```javascript
const tooltip = {
  // In this example, we take advantage of the fact that each tooltip is bound to the data for a specific point. Internally, D3 stores this information in a field called node.__data__, and we can use this to get the data for a tooltip.
  html: `<a href="javascript:void(0);" 
          onclick="var item = this.parentNode.__data__, layer = item.getDataLayer(); 
          var current = layer.getElementAnnotation(item, 'lz_show_label'); 
          layer.setElementAnnotation(item, 'lz_show_label', !current );
          layer.parent_plot.applyState();">Toggle label</a>`;`
}

// The annotation is an additional field, but it doesn't come from the datasource. It can be used in any layout directive that operates on fields: size, shape, color, labels, etc..
const scatter_layout = {
  ...options,
  label: {
    ...label_options,
    filters: [
      { field: 'lz_show_label', operator: '=', value: true }
    ],
  }
};
```


## Matching similar elements across panels
The primary benefit of LocusZoom is to show results in context, allowing the user to create connections between multiple sources of information.

When a lot of data is being shown at once, it can be hard to identify exactly which points line up across tracks- each one is quite small! Fortunately, there is a mechanism by which two panels can communicate to find related elements: *matching*.

It works as follows:

1. In the layout, a directive is specified to opt in to this behavior: `match: {send: field_to_be_broadcast , receive: field_to_be_checked }`
2. If a datalayer specifies `match.send`, then when any element is selected, the value of the specified field for that data element is broadcast to other layers. Eg if the user clicks on a scatter plot point, the variant ID for that point could be sent.
3. Whenever a match event is initiated, any data layer that specifies `match.receive` will examine each data point, and tag any point where the specified field value is the same as the broadcast value.
4. The special tag added to these points (`lz_is_match`) is treated as an extra field, and can be used in any scalable layout directive to control point size, shape, color, filters, etc. This field doesn't come from the API or data adapter- it is an internal value that is checked on every render.

Usage example:
```javascript
{
  ...options,
  // Note that a data layer can send AND receive. This means that it can respond to its own events: "when a match point is clicked, turn that point red"
  match: { send: '{{namespace[access]}}target', receive: '{{namespace[access]}}target' },
  color: [
    {
      field: 'lz_is_match', // When a match is detected, it is tagged with a special field name that can be used to trigger custom rendering
      scale_function: 'if',
      parameters: {
        field_value: true,
        then: '#ff0000',
      },
    },
}
```

> *TIP:* Matching builds on the primitives described above: it responds to a specific internal event (`match_requested`), and broadcasts a field to all layers via `plot.state.lz_match_value` . This means that outside code can also cause the plot to render matching elements, by initiating the rendering update manually:
> `plot.applyState({lz_match_value: your_value_here })`

> *NOTE:* For performance reasons, this feature is currently limited to simple rules. Only a single value may be broadcast across all data layers at one time, and only one field can be broadcast.

### Matching rules can be customized
Matching is not limited to exact value equality. Using a third parameter ("operator"), matching rules can use any of the comparison functions in `LocusZoom.MatchFunctions`. As described in the description of filtering rules above, match rules can also take into account transforms that modify the field value before it is broadcast, or, how the broadcast value is compared to a specific field. Custom logic (operators) can also be added via MatchFunctions and accessed via name.

```javascript
{
    ...options,
    match: { send: '{{namespace[access]}}target|htmlescape', receive: '{{namespace[access]}}target|htmlescape', operator: '!=' },
}
```

> NOTE: Remember that the template transforms are also extensible! Each `|templatefunction` refers to a function in `LocusZoom.TransformationFunctions`. Add your own via `LocusZoom.TransformationFunctions.add('my_function', (value) => othervalue)`. Custom plugins allow you to create very powerful custom presentations.

### You cannot be more clever than your underlying data
In order to draw connections between two datapoints in different tracks, the two points must have some information in common. 

This is easy enough when connecting similar kinds of data: two association datasets will both provide information about the variant ID, and it is very likely that the same variant will be identified the same way in both tracks.

For very different kinds of data, usually the API must be customized a bit to create commonality. For example, if you want to click on a gene and highlight association scatter points that are inside the gene, those scatter points would need to provide a `gene_id` field that used the same nomenclature as the one used by the genes track. 


# Built-in features to simplify interactivity
The above mechanisms are very powerful, but they require a deep knowledge of LocusZoom's internals to use effectively. We provide a number of low or no-code mechanisms to implement interactive plot features in controlled, well-tested ways.

## Tooltips
The first interactive feature that most LocusZoom users notice is the *tooltip*: a simple box that appears with more information when a user interacts with a point.

In addition to showing data associated with a field, tooltips can be customized with interactive action links that modify `plot.state` (eg setting the LD reference variant), or trigger annotations (like showing a label).

A tooltip is defined as an object describing when to display it, as well as the HTML template to render. It responds to the same LocusZoom template syntax supported elsewhere. For example, values can be embedded in the string with curly braces (`{{assoc:fieldname}}`) and a simple conditional syntax is supported to only render text if a value is defined: `{{#if sourcename:field_name}} Conditional text {{#else}} Optional else block {{/if}}`.

```javascript
{
  // Inherits namespaces from the layer that uses this tooltip
  namespace: { 'assoc': 'assoc' },
  closable: true,
  // Show/hide logic is defined by the "element status" for a given piece of data. See `behaviors` for how these statuses get applied.
  show: { or: ['highlighted', 'selected'] },
  hide: { and: ['unhighlighted', 'unselected'] },
  // The tooltip text is an HTML template with access to fields in the data. Be sure to apply HTML-escaping to any user-provided data.
  html: `<strong>{{{{namespace[assoc]}}variant|htmlescape}}</strong>`,
}
```

## Behaviors
By default, almost every LocusZoom data element shows a tooltip on mouseover, and keeps that tooltip open when the element is clicked. However, this can be customized.

See below for an example of a layer where clicking a point acts as a link to a new page.

```javascript
{
  ...layer_options,
  behaviors: {
    onmouseover: [
      // Most tooltips are configured to appear when the element is highlighted (along with applying any other display tweaks to the page). A guide to statuses is outside the scope of this tutorial, but the default "mouse move actions" are shown for the sake of completeness.
      { action: 'set', status: 'highlighted' },
    ],
    onmouseout: [
      { action: 'unset', status: 'highlighted' },
    ],
    onclick: [
		// The href parameter supports LocusZoom's template syntax, allowing data fields to be used in the URL
      { action: "link", href: "https://pheweb.org/pheno/{{{{namespace[phewas]}}phewas_code}}" }
    ],
  },
}
```


## Toolbar Widgets
### Toggle between render modes with display_options
The `display_options` widget renders a dropdown menu with several possible visualization settings. Each time an item is clicked, it will override the default properties.

To avoid duplication of code, the original display settings are automatically captured and shown as the "Default" option.  Other options in the dropdown menu are specified as a list of layout directives that will be merged into the data layer.

```javascript
const gene_selector_widget = {
  type: 'display_options',
  // Below: special config specific to this widget
  button_html: 'Filter...',
  button_title: 'Choose which genes to show',
  // If you are tracking website analytics, this widget can announce when it performs an action. Since this generic widget might be used in several different ways in the same plot, you can give each widget a custom event name to help tell the buttons apart.
  // This is totally optional- most sites will be fine just ignoring the event altogether!	
  custom_event_name: 'widget_gene_filter_choice',
  // Must specify the data layer id (within this panel) that will be controlled by the button
  layer_name: 'genes',
  default_config_display_name: 'Coding genes & rRNA',
  options: [
    // Specify how each item in the dropdown menu will work
    {
      display_name: 'All features',
      display: {
        filters: null,
      },
    },
  ],
}
```


> *NOTE:* The display options widget operates on a whitelist of layout directives: there are some things it cannot customize. This whitelist is expanded based on user requests. Rewriting (mutating) the entire layout is very powerful, and this gradual approach ensures that each new option is tested carefully before being added to a standard widget.
 
### Modify data retrieval via set_state
Some data adapters alter how they fetch information based on variables in `plot.state`.  For example, the LDServer can choose to fetch LD from a particular reference population.

The `set_state` widget provides a way to set a particular variable (`state_field` ) to the provided value. When an option is clicked, it will trigger a re-render, including any updated data.

```javascript
const ldlz2_pop_selector_menu = {
  // **Note**: this widget is aimed at the LDServer datasource, and the UM 1000G LDServer
  type: 'set_state',
  button_html: 'LD Population: ',
  show_selected: true,
  button_title: 'Select LD Population: ',
  state_field: 'ld_pop',
  // This list below is hardcoded to work with the UMich LDServer, default 1000G populations
  //  It can be customized to work with other LD servers that specify population differently
  // https://portaldev.sph.umich.edu/ld/genome_builds/GRCh37/references/1000G/populations
  options: [
    { display_name: 'ALL (default)', value: 'ALL' },
    { display_name: 'AFR', value: 'AFR' },
    { display_name: 'AMR', value: 'AMR' },
    { display_name: 'EAS', value: 'EAS' },
    { display_name: 'EUR', value: 'EUR' },
    { display_name: 'SAS', value: 'SAS' },
  ],
};
```

### Control what is shown with filter_field
Sometimes, a region plot has a lot of information, and the user wants to restrict what is shown. This can be helpful in coaccessibility tracks, for example, which have a very large number of loops.

This widget appears as a text box in panel toolbars. Options allow control over a specific filter, 

```javascript
{
  type: 'filter_field',
  // Must specify the data layer id relative to the panel in which this widget appears
  layer_name: 'coaccessibility',
  field: '{{namespace[access]}}score',
  field_display_html: 'Score',
  operator: '>=',
  // Optionally, the value entered into the text box can be coerced into a number.
  data_type: 'number',
}

```

## Extensions
### Create shareable region links with DynamicUrls
A major feature of LocusZoom is the ability to update the plot in response to user events. When a user finds an interesting view, they often wish to share that exact region with colleagues. 

We provide an optional LocusZoom extension to help with this. It can be added via a script tag (`dist/ext/lz-dynamic-urls.min.js`)

The plot region will appear in the URL as query parameters. For example, `https://statgen.github.io/locuszoom/?chrom=10&start=114550452&end=115067678`

```javascript
////// Before creating the plot, check the URL to see if a specific viewing region has requested. If so, make that the default when the plot is first rendered.

// The web site owner has control over how their URL looks. Here, the parameter "chr" appears in the URL as "chrom". Any top-level parameter in plot.state can be serialized into the URL. LocusZoom will only try to manage the parameters named here.
var stateUrlMapping = {chr: "chrom", start: "start", end: "end"};
var initialState = LzDynamicUrls.paramsFromUrl(stateUrlMapping);
if (!Object.keys(initialState).length) {
    initialState = {chr: 10, start: 114550452, end: 115067678};
}
// Draw the plot, providing the desired region to draw
const layout = LocusZoom.Layouts.get("plot", "standard_association", {state: initialState});
window.plot = LocusZoom.populate("#lz-plot", data_sources, layout);

// Set up event listeners: Changes in the plot can be reflected in the URL, and vice versa (eg browser back button can go back to
//   a previously viewed region)
LzDynamicUrls.plotUpdatesUrl(plot, stateUrlMapping);
LzDynamicUrls.plotWatchesUrl(plot, stateUrlMapping);
```

> *Note*: If your web site is a single page application (like vue-router), then another piece of javascript may already be controlling the page URL. DynamicUrls is mainly intended for web sites where the server returns the HTML for each page.

#### Advanced usage
Most usages of dynamic URLs are very simple, eg show a particular plot region.

In reality, some highly advanced sites may wish to copy other information into the URL that is not part of `plot.state`. Since a URL is a string, the task of sending information from the URL to the plot is essentially a problem of *serialization* (plot --> URL) or *deserialization* (url --> plot).  

The way that query parameter data can be found and applied to the plot can be completely controlled by passing a third argument (*callback*) to `plotWatchesUrl` and `plotUpdatesUrl`. See the source code for details.
