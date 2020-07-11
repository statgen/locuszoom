# API Reference

## Creating a Plot - Overview

Creating a LocusZoom plot requires two pieces of information:

* [Data Sources](data-sources.md)
* [Layout](layouts.md)

Once defined these values can be passed to the `populate()` method along with a selector to identify a div, like so:

```javascript
var plot = LocusZoom.populate(selector, data_sources, layout); 
```

Note that the return value from the `populate()` method, the **plot**, is saved out to a variable. It is advisable to do this wherever LocusZoom.js is deployed as the plot variable can be used after being populated to do all kinds of things.

## LocusZoom Structure

### [Plot](plot.md)

A [Plot](plot.md) is an instance of LocusZoom, returned by the `populate()` method. A plot has a layout and various supported methods.

### [Panel](panel.md)

A [Panel](panel.md) is a subdivided area of a plot. Panels contain graph features such as titles and axes, but not actual data. Panels occupy the full width the of the plot and are stacked vertically along the y-axis in the order they are added unless directed differently by their layouts.

### [Data Layer](data-layer.md)

A [Data Layer](data-layer.md) is a layer within a panel for representing data. Data layers are stacked depth-wise along the z-axis in the other they are added unless directed differently by their layouts.

### [Dashboard](dashboard.md)

A [Dashboard](dashboard.md) is an HTML element that can contain information or user interface components relevant to a plot. Dashboards can be attached to the plot as a whole or to individual panels. They are described with their own layouts nested within the layouts of the parent plot or panel.

### [Legend](legend.md)

A [Legend](legend.md) is an SVG element belonging to a panel that annotated categories of data shown on the underlying data layers. Legends are described in general terms as a part of a panel's layout and the specific elements to appear in the legend are described by each of the panel's data layers.

## Top-level Library Methods

Locuszoom.js creates an global object namespace called `LocusZoom`. This object has the following methods:

* **`LocusZoom.populate(selector, datasource, [layout])`**  
  
  Populate a single DOM element with a LocusZoom plot.  
  * `selector` *string, required* - DOM query selector string.  
  * `datasource` *object, required* - A valid [Data Sources](data-sources.md) object that defines the namespaces and methods for retrieving data.  
  * `layout` *object, optional* - A valid [Layout](layouts.md) object that defines the geometry and behaviors of the plot. If not provided the standard association plot layout will be used.  

* **`LocusZoom.populate(selector, datasource, [layout])`**  
  
  Identical to `LocusZoom.populate()` but will generate plot in *all* elements that match the DOM query selector string, not just the first found.  

* **`LocusZoom.positionIntToString(pos, exp, suffix)`**  
  
  Convert an integer position to a string (e.g. `23423456` => `"23.42 (Mb)"`)  
  * `pos` *integer, required* - Position value.  
  * `exp` *integer, optional* - Exponent of the returned string's base (e.g. 3 for Kb, 6 for Mb, regardless of the value of `pos`). If not provided returned string will select smallest base divisible by 3 for a whole number value.   
  * `suffix` *boolean, optional* - Whether or not to append a suffix (e.g. "Mb") to the end of the returned string. Defaults to `false`.  

* **`LocusZoom.positionStringToInt(pos)`**  
  
  Convert a string position to an integer (e.g. `"5.8 Mb"` => `58000000`)
  * `pos` *integer, required* - Position value.  

* **`LocusZoom.getToolTipData(node)`**  

  Method for use in custom javascript within a tooltip's custom HTML to gain access to the data that generated the tooltip. Works recursively to locate the parent tooltip element regardless of how nested an element is in the custom HTML. For example, this custom button element in a tooltip would log the tooltip's underlying data to the console:  
  
  `<button onclick="console.log(LocusZoom.getToolTipData(this);">Click Me</button>`  

* **`LocusZoom.getToolTipDataLayer(node)`**  

  Method for use in custom javascript within a tooltip's custom HTML to gain access to the data layer containing the element that generated the tooltip. Works recursively to locate the parent tooltip element regardless of how nested an element is in the custom HTML. For example, this custom button element in a tooltip would log the data layer containing the element that generated the tooltip to the console:  
  
  `<button onclick="console.log(LocusZoom.getToolTipDataLayer(this);">Click Me</button>`  

* **`LocusZoom.getToolTipPanel(node)`**  

  Method for use in custom javascript within a tooltip's custom HTML to gain access to the panel containing the data layer and element that generated the tooltip. Works recursively to locate the parent tooltip element regardless of how nested an element is in the custom HTML. For example, this custom button element in a tooltip would log the tooltip's parent panel to the console:  
  
  `<button onclick="console.log(LocusZoom.getToolTipPanel(this);">Click Me</button>`  

* **`LocusZoom.getToolTipPlot(node)`**  

  Method for use in custom javascript within a tooltip's custom HTML to gain access to the parent plot that generated the tooltip. Works recursively to locate the parent tooltip element regardless of how nested an element is in the custom HTML. For example, this custom button element in a tooltip would log the tooltip's parent plot to the console:  
  
  `<button onclick="console.log(LocusZoom.getToolTipPanel(this);">Click Me</button>`  
