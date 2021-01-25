# Panel

A Panel is a region of a plot, typically occupying the full plot width but only a portion of the vertical space, stacked along the y-axis with other panels.

## Panel Methods

Panel objects can be accessed through a plot object by id within the `panels` object. For instance, a panel with an id of "foo" could be accessed from the plot object by `plot.panels.foo`. Supported panel methods are:

* **`panel.addDataLayer(layout)`**  
  Add a new data layer with the data layer layout (*object*) provided. Will automatically add at the top (depth/z-index) of the panel unless explicitly directed differently in the layout provided.  

* **`panel.setDimensions([width, height])`**  
  Set the dimensions for the panel. If passed with no arguments will calculate optimal size based on layout directives and the available area within the plot. If passed discrete width (*number*) and height (*number*) will attempt to resize the panel to them, but may be limited by minimum dimensions defined on the plot or panel.  

* **`panel.setTitle(title)`**  
  Set the title for the panel. Accepts a string or a title object (see [title layout directive](#title) for details on title objects structure). If passed a string will apply the argument as the text for title, maintaining its current position and style. If passed an object will merge the object with the existing title layout object, allowing for changing all or only some of the title layout object's parameters. If passed `null`, `false`, or an empty string the title DOM element will be set to `display: none`.  

* **`panel.addBasicLoader(show_immediately)`**  
  Attach an animated loader to the panel that appears whenever data is requested and clears whenever new data is rendered. Accepts the argument `show_immediately` (*boolean*, defaults to true) which determines whether the animated loader should be shown right away. Being the most common use case for a loader this is merely a shortcut that effectively does this:  

```javascript
if (show_immediately){ panel.loader.show("Loading...").animate(); }
panel.on("data_requested", function(){ panel.loader.show("Loading...").animate(); }.bind(panel));
panel.on("data_rendered", function(){ panel.loader.hide(); }.bind(panel));
```

  For finer-grain control over loaders for a given panel see [Panel Loader](Panel#panel-loader) and [Panel Events and Hooks](Panel#panel-events-and-hooks).  

## Panel Widgets

Panels have a few widgets for various special use cases.

#### Panel Curtain

The panel curtain, like the plot curtain is an HTML overlay that obscures the entire panel. It can be styled arbitrarily and display arbitrary messages. It is useful for reporting error messages visually to an end user when the error renders the panel unusable.

Use the curtain by invoking the following methods:

* **`panel.curtain.show([content[, css]])`**  
  Generate the curtain. Any content (*string*) argument passed will be displayed in the curtain as raw HTML. CSS (*object*) can be passed which will apply styles to the curtain and its content.  

* **`panel.curtain.update([content[, css]])`**  
  Update the content and css of the curtain that's currently being shown. This method also adjusts the size and positioning of the curtain to ensure it still covers the entire panel with no overlap.  

* **`panel.curtain.hide()`**  
  Remove the curtain.  

#### Panel Loader

The panel loader is a small HTML overlay that appears in the lower left corner of the panel. It cannot be styled arbitrarily but can show a custom message and show a minimalist loading bar that can be updated to specific completion percentages or be animated.

Use the loader by invoking the following methods:

* **`panel.loader.show([content]])`**  
  Generate the loader. Any content (*string*) argument passed will be displayed in the string as raw HTML. If no content is supplied the message in the loader will default to `"Loading..."`  

* **`panel.loader.update([content[, percent]])`**  
  Update the content (*string*) and, optionally, the percent (*number*) complete of the loader that's currently being shown. This method also adjusts the positioning of the loader to ensure it still appears in the lower left corner of the panel. Percents will automatically be limited to a range of 1 to 100 and, if passed, will stop all animations in progress.  

* **`panel.loader.setPercentCompleted(percent)`**  
  Sets the loading bar in the loader to precentage width equal to the percent (*number*) value passed. Percents will automatically be limited to a range of 1 to 100. Will stop all animations in progress.  

* **`panel.loader.animate()`**  
  Adds a class to the loading bar that makes it loop infinitely in a loading animation.  

* **`panel.loader.hide()`**  
  Remove the loader.

## Panel Events and Hooks

There are several events that a LocusZoom panel can "emit" when appropriate and LocusZoom supports registering "hooks" for these events which are essentially custom functions intended to fire at certain times.

The following panel-level events are currently supported:

* `layout_changed`
  Any aspect of the panel's layout (including dimensions or state) has changed.  

* `data_requested`
  A request for new data from any data source used in the panel has been made.  

* `data_rendered`
  Data from a request has been received and rendered in the panel.  

* `element_clicked` - receives the `data` associated with the element.
  A data element in any of the panel's data layers has been clicked.

* `element_selection` - receives several pieces of `data` associated with the element: `{ element: element_data, active: toggle }`
  A selectable data element in any of the panel's data layers has changed selection status (eg a gene has been clicked to show tooltip). The event identifies whether the element is being selected or deselected.

To register a hook for any of these events use the panel's **`on()`** method like so:

```javascript
var plot = LocusZoom.populate(selector, data_sources, layout);
var panel = plot.addPanel(panel_layout);
panel.on("data_requested", function(){
  console.log("data requested for LocusZoom panel" + this.id);
});
panel.on("data_rendered", function(){
  console.log("data rendered for LocusZoom panel" + this.id);
});
```

In the above example we log to the console a message containing the panel's ID whenever data is requested and subsequently rendered.

There can be arbitrarily many functions registered to the same event. They will be executed in the order they were registered. The `this` context bound to each event hook function is the panel where the listener was attached. Each event listener function can accept a single argument of the format `{sourceID: panel_name_str, data: eventData}`, where the data is specified per type of event.

## Panel Layout

A panel's **layout** is a serializable object that describes every customizable feature of the panel with nested values. It should only ever contain scalar values, arrays, and objects - no functions!

Example:

```javascript
var panel_layout = {
  id: "panel1",
  width: 100,
  height: 100,
  data_layers: [
    ...
  ],
  ...
}
```

### Supported Layout Directives

#### General

* **`y_index`** - *Number*  
  An integer ranging from `0` to `n-1` denoting the panel's position relative to other `n` panels in a vertical orientation in the plot. If not defined this value will be automatically assigned in the order the panel is added to the plot.  

* **`inner_border`** - *String*  
  A string denoting the color (hex value, rgb, rgba, hsl, etc.) for a border to be rendered showing the clip area of the data layers for the panel. Any axes that are rendered will effectively represent this border, but for the edges where an axis may not be rendered it may still be preferable to bound the data region with a line. If not defined then the inner border will not be rendered.  

#### Dimensions and Geometry

* **`width`** - *Number*  
  Discrete width, in pixels, of the panel. Subject to being limited by **`panel.min_width`**.  

* **`height`** - *Number*  
  Discrete height, in pixels, of the panel.

* **`origin`** - *Object*  
  An object that defines where the panel will be positioned in the plot (by the panel's top left corner) expressed as discrete pixel coordinates.  

  * **`origin.x`** - *Number*  
    X-offset, in pixels, for the top-left corner of the panel (relative to the LocusZoom plot).  

  * **`origin.y`** - *Number*  
    Y-offset, in pixels, for the top-left corner of the panel (relative to the LocusZoom plot).  
    **NOTE:** SVG y values go from the top down, so the SVG origin of (0,0) is in the top left corner.  

* **`margin`** - *Object*  
  An object that defines the margins between a panel's boundaries and its content.  

  * **`margin.top`** - *Number*  
    Margin, in pixels, from the top edge of a panel to its content  

  * **`margin.right`** - *Number*  
    Margin, in pixels, from the right edge of a panel to its content  

  * **`margin.bottom`** - *Number*  
    Margin, in pixels, of the bottom edge of a panel to its content  

  * **`margin.left`** - *Number*  
    Margin, in pixels, of the left edge of a panel to its content  

### Title

* **`title`** - *Object*  
  Object describing a text element to appear in the panel at an arbitrary position with arbitrary styles (by default: font-size 18px and font-weight 600). If defined as a string in a panel layout when panel is initialized (first added to a plot) then string will be interpreted as text for the title and layout title directive will be automatically inflated to an object with all required parameters.

  * **`title.text`** - *String*  
    Text for the title. Note that titles are rendered as SVG `text` elements so HTML and newlines will **not** be rendered.  

  * **`title.x`** - *Number*  
    X-offset, in pixels, for the title's text anchor (default left) relative to the top-left corner of the panel.  

  * **`title.y`** - *Number*  
    Y-offset, in pixels, for the title's text anchor (default left) relative to the top-left corner of the panel.  
    **NOTE:** SVG y values go from the top down, so the SVG origin of (0,0) is in the top left corner.  

  * **`title.style`** - *Object*  
    CSS styles object to be applied to the title's DOM element.  

#### Axes

* **`axes`** - *Object*  
  An object that defines axes for a panel, by axis ID. **Supported axis IDs are *only* `x`, `y1`, and `y2`**.

  Example:

```javascript
panel {
  axes:
    x: { ... },
    y1: { ... },
    y2: { ... }
  }
}
```

  * **`axes.{x|y1|y2}.label`** - *String*  
    Static label to appear on the axis.

  * **`axes.{x|y1|y2}.label_offset`** - *Number*  
    Distance, in pixels, to shift the axis label away from its axis. This value is interpreted differently for each axis ID (e.g. for the `x` axis this value shift the label downward, for `y1` it shifts the label to the left, and for `y2` it shifts the label to the right).  

  * **`axes.{x|y1|y2}.tick_format`** - *String*  
    If defined and set to "region" then the values on the axis will be interpreted as region/position values and formatted accordingly.  

  * **`axes.{x|y1|y2}.ticks`** - *Array*  
    An array of discrete ticks to apply to the axis. If not provided then ticks will be automatically generated. The `ticks` array can be a simple list of discrete numbers, like so:  

```javascript
x: { 
  ticks: [ 0, 10, 20, 30, 40 ]
}
```

  Or the `ticks` array can be an array of objects for finer control over how each tick is rendered. For example:  

```javascript
x: { 
  ticks: [ 
    {
      x: 10,
      text: "infectious diseases",
      style: { color: "#FF0000", "text-anchor": "start" },
      transform: "rotate(45)"
    },
    {
      x: 200,
      text: "mental disorders",
      style: { color: "#00DD00", "text-anchor": "start" },
      transform: "rotate(45)"
    },
    ...
  ]
}
```

  Supported values for tick objects:

  * **`axes.{x|y1|y2}.ticks[t].x`** - *Number*  
    X value (in terms of the data set, *not* pixels on the plot) for which the tick should be rendered.  

  * **`axes.{x|y1|y2}.ticks[t].text`** - *String*  
    Text to use the visible label for the tick.  

  * **`axes.{x|y1|y2}.ticks[t].style`** - *Object*  
    Object describing styles for the tick label. Conforms to the [d3 standard style object specification](https://github.com/mbostock/d3/wiki/Selections#style).  

  * **`axes.{x|y1|y2}.ticks[t].transform`** - *String*  
    Transformation string to apply to the tick label. See [SVG transform documentation](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform) for supported syntax.  

#### Interaction

* **`interaction`** - *Object*  
  An object that defines which interaction behaviors (e.g. panning and zooming) are enabled and how those interactions are linked between panels.  

  * **`interaction.drag_background_to_pan`** - *Boolean*  
    Whether clicking and dragging the panel's background should move (pan) the panel horizontally along the x axis  

  * **`interaction.scroll_to_zoom`** - *Boolean*  
    Whether scrolling the mouse wheel when hovering over the panel should zoom the panel relative to the x axis (scroll up to zoom in, scroll down to zoom out). Note that as of v0.5.1 scrolling requires also holding the  `[SHIFT]` key (and a message reminding the user of this appears on scroll-to-zoom panels when scrolling without holding shift).  

  * **`interaction.drag_x_ticks_to_scale`** - *Boolean*  
    Whether ticks on the x axis should have drag enabled on them to allow moving (panning) along the x axis with click+drag or scaling the x axis with shift+click+drag  

  * **`interaction.drag_y1_ticks_to_scale`** - *Boolean*  
    Whether ticks on the y1 axis should have drag enabled on them to allow moving (panning) along the y1 axis with click+drag or scaling the y1 axis with shift+click+drag  

  * **`interaction.drag_y2_ticks_to_scale`** - *Boolean*  
    Whether ticks on the y2 axis should have drag enabled on them to allow moving (panning) along the y2 axis with click+drag or scaling the y2 axis with shift+click+drag  

  * **`interaction.x_linked`** - *Boolean*  
    Whether any interactions on this panel that affect the x axis should be broadcast to other x-linked panels  

  * **`interaction.y1_linked`** - *Boolean*  
    Whether any interactions on this panel that affect the y1 axis should be broadcast to other y1-linked panels  

  * **`interaction.y2_linked`** - *Boolean*  
    Whether any interactions on this panel that affect the y2 axis should be broadcast to other y2-linked panels  

### Complex Object Layout Directives

* **`dashboard`** - *Object*  
  A [Dashboard layout](dashboard.md#dashboard-layout) object. Will be automatically displayed as a mouse-enabled overlay along the top of the panel if defined with components.

* **`legend`** - *Object*  
  A [Legend Layout](legend.md#legend-panel-layout) object. Will be automatically rendered as an SVG object similar to how axes are rendered for a given panel.

* **`data_layers`** - *Array*  
  An array of [Data Layer layout](data-layer.md#data-layer-layout) objects. Will automatically be rendered bottom-to-top (in terms of page depth) in the order defined here excepting where data layer layout defines a `z_index` value.
