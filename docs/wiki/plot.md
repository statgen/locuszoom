> [[API Reference|Home]] ▸ **Plot**

# Plot

A Plot is a complete LocusZoom instance. It is the value returned from `LocusZoom.populate()`.

## Plot Methods

Once a plot has been created (e.g. the value returned from `LocusZoom.populate()`) there are various supported methods for interacting with it:

* **`plot.addPanel(layout)`**  
  Add a new panel with the panel layout (*object*) provided. Will automatically update the dimensions of the plot to accommodate the new panel.  

* **`plot.removePanel(id)`**  
  Remove a panel by ID (*string*). Will automatically update the dimensions of the plot to account for the panel's removal.  

* **`plot.clearPanelData([id, mode])`**
  Clear all state, tooltips, and other persisted data associated with one (or all) panel(s) in the plot. Clears only one panel if an ID (*string*) is passed, otherwise clears all panels. This semi-public method can be useful if your custom plot displays a totally new data region on an existing panel (eg via links on the page to interesting regions). In that case, call with `mode` = `"reset"`.  (`plot.clearPanelData(panelID, "reset")`)

* **`plot.setDimensions([width, height])`**  
  Set the total dimensions for the plot. If passed with no arguments will calculate optimal size based on layout directives and the available area on the page. If passed discrete width (*number*) and height (*number*) will attempt to resize the plot to them, but may be limited by minimum dimensions defined on the plot or panels.  

* **`plot.applyState(state)`**  
  Accepts a state (*object*) to be applied to the plot's layout. Properties of the state argument are merged with the existing [[State]] on the plot. This triggers requests to get new data for the updated state values across all panels and emits a `data_requested` event.  

* **`plot.subscribeToData(fields, success_callback, opts)`**: Using the same mechanisms as an LZ data layer, let arbitrary parts of the page listen for new data. When data is received, calls `success_callback` with the resulting payload. This can be used to do things like draw tables or companion visualizations on the page, and have them automatically update to stay in sync as the user clicks or pans across the plot. Allowed options are `onerror` (an error handler callback) and `discrete` (returns the separate responses from each source rather than combining: eg _chain.discrete_ instead of _chain.body_).

* **`plot.refresh()`**  
  Shortcut to apply an empty state object with `applyState`. In other words this triggers a call to request all data for the plot using all existing state values, essentially re-requesting and re-rendering all existing data.  

## Plot Widgets

Plots have a few widgets for various special use cases.

#### Plot Curtain

The plot curtain is an HTML overlay that obscures the entire plot. It can be styled arbitrarily and display arbitrary messages. It is useful for reporting error messages visually to an end user when the error renders the plot unusable.

Use the curtain by invoking the following methods:

* **`plot.curtain.show([content[, css]])`**  
  Generate the curtain. Any content (*string*) argument passed will be displayed in the curtain as raw HTML. CSS (*object*) can be passed which will apply styles to the curtain and its content.  

* **`plot.curtain.update([content[, css]])`**  
  Update the content and css of the curtain that's currently being shown. This method also adjusts the size and positioning of the curtain to ensure it still covers the entire plot with no overlap.  

* **`plot.curtain.hide()`**  
  Remove the curtain.  

#### Plot Loader

The plot loader is a small HTML overlay that appears in the lower left corner of the plot. It cannot be styled arbitrarily but can show a custom message and show a minimalist loading bar that can be updated to specific completion percentages or be animated.

Use the loader by invoking the following methods:

* **`plot.loader.show([content]])`**  
  Generate the loader. Any content (*string*) argument passed will be displayed in the string as raw HTML. If no content is supplied the message in the loader will default to `"Loading..."`  

* **`plot.loader.update([content[, percent]])`**  
  Update the content (*string*) and, optionally, the percent (*number*) complete of the loader that's currently being shown. This method also adjusts the positioning of the loader to ensure it still appears in the lower left corner. Percents will automatically be limited to a range of 1 to 100 and, if passed, will stop all animations in progress.  

* **`plot.loader.setPercentCompleted(percent)`**  
  Sets the loading bar in the loader to precentage width equal to the percent (*number*) value passed. Percents will automatically be limited to a range of 1 to 100. Will stop all animations in progress.  

* **`plot.loader.animate()`**  
  Adds a class to the loading bar that makes it loop infinitely in a loading animation.  

* **`plot.loader.hide()`**  
  Remove the loader.

## Plot Events and Hooks

There are several events that a LocusZoom plot can "emit" when appropriate and LocusZoom supports registering "hooks" for these events which are essentially custom functions intended to fire at certain times.

The following plot-level events are currently supported:

* `layout_changed` - context: plot  
  Any aspect of the plot's layout (including dimensions or state) has changed.  

* `data_requested`
  A request for new data from any data source anywhere in the plot has been made.  

* `data_rendered`
  Data from a request has been received and rendered.  

* `element_clicked` - receives the `data` associated with the element.
  A data element in any of the plots panels has been clicked.

* `element_selection` - receives several pieces of `data` associated with the element: `{ element: element_data, active: toggle }`
  A selectable data element in any of the plot's data layers has changed selection status (eg a gene has been clicked to show tooltip). The event identifies whether the element is being selected or deselected.

To register a hook for any of these events use the plot's **`on()`** method like so:

```javascript
var plot = LocusZoom.populate(selector, data_sources, layout);
plot.on("data_requested", function(){
  console.log("data requested for LocusZoom plot" + this.id);
});
plot.on("data_rendered", function(){
  console.log("data rendered for LocusZoom plot" + this.id);
});
```

In the above example we log to the console a message containing the plot's ID whenever data is requested and subsequently rendered.

There can be arbitrarily many functions registered to the same event. They will be executed in the order they were registered. The `this` context bound to each event hook function is the plot where the listener was attached. Because events can be bubbled up from panels, the plot is a convenient single place to listen to all events from the plot.

Each event listener function can accept a single argument of the format `{sourceID: panel_name_str, data: eventData}`, where the data is specified per type of event. The `sourceID` is useful for event hooks that want to filter for a particular kind of data- eg "the element that was clicked was in one of the association panels, rather than one of the interval tracks".

## Plot Layout

A plot's **layout** is a serializable object that describes every customizable feature of a LocusZoom plot with nested values. It should only ever contain scalar values, arrays, and objects - no functions!

Example:

```javascript
var layout = {
  width: 500,
  height: 500,
  panels: [
    {
      id: "panel_1",
      origin: { x: 0, y: 0 },
      width: 500,
      height: 250,
      data_layers: [
        {
          id: "data_layer_1",
          type: "scatter",
          ...
        }
      ]
    },
    ...
  ]
};
```

### Supported Layout Directives

* **`width`** - *Number*  
  Discrete width, in pixels, of the LocusZoom plot. Must be non-zero. Subject to being limited by **`min_width`**.  

* **`height`** - *Number*  
  Discrete height, in pixels, of the LocusZoom plot. Must be non-zero. Subject to being limited by **`min_height`**. 

* **`aspect_ratio`** - *Number*  
  Aspect ratio for the LocusZoom plot expressed as the evaluation of the plot's width divided by it's height (e.g. an aspect ratio of 8:5 would be `1.6`). Must be non-zero, but can be left undefined (to be automatically generated from dimensions).  

* **`min_width`** - *Number*  
  Minimum discrete width, in pixels, allowable for the LocusZoom plot. May automatically increase to the greatest **`panels.{$panel_id}.min_width`** for each **`$panel_id`**.  

* **`min_height`** - *Number*  
  Minimum discrete height, in pixels, allowable for the LocusZoom plot. May automatically increase based on **`panels.{$panel_id}.min_height`** and **`panels.{$panel_id}.proportional_height`** for each **`$panel_id`**.  

* **`min_region_scale`** - *Number*  
  Minimum allowable domain, in bases, for the x dimension of any panels whose x dimension resembles a genomic region (e.g. connected to `state.start` and `state.end`). Enforced by all actions that can reduce the x domain of a child panel, including zoom interactions. Effective default is 1.  

* **`max_region_scale`** - *Number*  
  Maximum allowable domain, in bases, for the x dimension of any panels whose x dimension resembles a genomic region (e.g. connected to `state.start` and `state.end`). Enforced by all actions that can expand the x domain of a child panel, including zoom interactions. Effective default is infinity.  

* **`panel_boundaries`** - *Boolean*  
  Whether or not to show draggable boundary elements between panels (when the mouse is near a boundary between panels or the bottom of the plot) that allow for a user to adjust the heights of panels on an individual basis. Also shows a plot-level resize handle in the lower right corner of the plot when the mouse is in that area. Defaults to `true`.  

* **`responsive_resize`** - *String* | *Boolean*  
  Whether and the LocusZoom plot should automatically resize itself to fill the width of its containing element while maintaining its aspect ratio. When set to `'both'` (or the legacy synonym `true`), as the containing element of a plot changes size (e.g. when the browser window is resized, mobile device is flipped portrait/landscape, etc.) the plot will, in most browser environments, automatically detect the change and redraw the plot to fill the newly available width while maintaining the existing plot aspect ratio (within the bounds set by the layout minimums). Optionally, you may use `'width_only'` to resize only the width of the container (without preserving the aspect ratio). This can prevent issues that occur if the container is resized frequently, such as if the plot is shown in a tabbed UI. Defaults to `false`.
  **Note:** apply the class `lz-container-responsive` to the containing element for best results.  

* **`mouse_guide`** - *Boolean*
  Whether to always show horizontal and vertical dotted lines that intersect at the current location of the mouse pointer.  Defaults to `true`.

#### Complex Object Layout Directives

The following layout directives may be arbitrarily complex so have been broken out to their own pages.

* **`state`** - *Object*  
  The [[State]] object. The state contains information describing the current parameters used to query/filter data and current selections and/or customizations by the end user.

* **`dashboard`** - *Object*  
  A [[Dashboard]] layout object. Will be automatically displayed permanently above the plot if defined with components. 

* **`panels`** - *Array*  
  An array of [[Panel]] objects. Will automatically be rendered vertically in the order defined here excepting where panel layout defines a `y_index` value.

### Using a Pre-Defined Layout

The LocusZoom library comes with several pre-defined layouts for plots (as well as for panels, data layers, and dashboards). See a list of available plot layouts like so:

```javascript
LocusZoom.Layouts.list("plot");
> ["standard_association", "standard_phewas"]
```

To get a layout for use use the `get()` method, providing the layout type and ID like so:

```javascript
var layout = LocusZoom.Layouts.get("plot", "standard_association");
```

Inspect the object that is returned or read how it is defined in [Layout.js](https://github.com/statgen/locuszoom/blob/master/assets/js/app/Layouts.js) to see its composition. The `get()` method returns layouts by value, *not* by reference, so you can customize the returned layout without affecting the original copy. For example:

```javascript
var layout = LocusZoom.Layouts.get("plot", "standard_association");
layout.id = "foo";
```

Additionally, the `get()` method supports taking an object for the third argument that represents changes to be merged into the layout. For example, the above after-the-fact change to the layout can be done in one step like so:

```javascript
var layout = LocusZoom.Layouts.get("plot", "standard_association", { id: "foo" });
```

Lastly, since a layout is any JSON object that means that any nested object within a layout is, itself, also a layout. For example, when defining panels in a plot layout the `panels` parameter is defined as an array of objects, each object representing a distinct panel - those objects are panel layouts. Pre-defined layouts are organized by type and can be used as modular pieces of a larger layout using the `get()` function. For example:

```javascript
var layout = {
  width: 500,
  height: 500,
  panels: [
    LocusZoom.Layouts.get("panel", "association", { id: "foo_panel" }),
    ...
  ]
};
```
