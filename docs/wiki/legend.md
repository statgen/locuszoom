> [[API Reference|Home]] ▸ **Legend**

# Legend

A Legend is an SVG element rendered on a given panel (on top of data layers in terms of z-index) to provide data layer context, such as the meanings behind variations in colors, shapes, or lines.

## Legend Layout

A legend's **layout** is a serializable object that describes general settings and individual elements of a legend. **NOTE:** legend layouts are defined in general terms (position, orientation, etc.) on the panel level and individual elements that appear in a legend are defined on the layouts of child data layers of that panel. For example:

```javascript
var panel_layout = {
  id: "panel_1",
  legend: {
    origin: { x: 10, y: 10 },
    orientation: "vertical"
  },
  data_layers: [
    {
      id: "data_layer_1",
      legend: [
        { shape: "circle", color: "#ff0000", size: 40, label: "red circles" },
        { shape: "circle", color: "#00ff00", size: 40, label: "green circles" }
      ]
    }
  ]
}
```

### Legend Panel Layout

On the panel level, Legend layouts only define parameters that apply to the entire rendered legend for the panel, not to individual elements inside the legend.

* **`orientation`** - *String*  
  Orientation with which elements in the legend should be arranged. Presently only `"vertical"` and `"horizontal"` are supported values. When using the horizontal orientation elements will automatically drop to a new line if the width of the legend would exceed the right edge of the containing panel. Defaults to `"vertical"`.  

* **`origin`** - *Object*  
  An object that defines where the legend will be positioned in the panel (by the legend's top left corner, relative to the top left corner of the panel) expressed as discrete pixel coordinates.  

  * **`origin.x`** - *Number*  
    X-offset, in pixels, for the top-left corner of the legend (relative to the top left corner of the panel).  

  * **`origin.y`** - *Number*  
    Y-offset, in pixels, for the top-left corner of the legend (relative to the top left corner of the panel).  
    **NOTE:** SVG y values go from the top down, so the SVG origin of (0,0) is in the top left corner.  

* **`padding`** - *Number*  
  Value in pixels to pad between the legend's outer border and the elements within the legend. This value is also used for spacing between elements in the legend on different lines (e.g. in a vertical orientation) and spacing between element shapes and labels, as well as between elements in a horizontal orientation, are defined as a function of this value. Defaults to `5`.  

* **`label_size`** - *Number*  
  Font size for element labels in the legend (loosely analogous to the height of full-height letters, in pixels). Defaults to `12`.  

* **`hidden`** - *Boolean*  
  Value for whether the legend should appear or not. This flag is useful for making a legend that may be large and potentially obscure data go away such that the layout defining the legend is not modified and the legend can therefore be restored as needed. Defaults to `false`.  

### Legend Data Layer Layout

Individual elements to appear in a legend may come from various data layers to be aggregated together at the panel level. As such, legend layouts on data layers are arrays of objects where each object describes an element to appear in the legend, like so:

```javascript
var data_layer_layout = {
  id: "data_layer_1",
  legend: [
    { shape: "circle", color: "#ff0000", size: 40, label: "red circles" },
    { shape: "circle", color: "#00ff00", size: 40, label: "green circles" }
  ]
}
```

* **`shape`** - *String*  
  Shape for the graphical portion of the legend element. This is optional (e.g. a legend element could just be a textual label). Supported values are the standard [d3 3.x symbol types](https://github.com/mbostock/d3/wiki/SVG-Shapes#symbol_type) (i.e. `"circle"`, `"cross"`, `"diamond"`, `"square"`, `"triangle-down"`, and `"triangle-up"`), as well as `"rect"` for an arbitrary square/rectangle or `line` for a path.  

* **`color`** - *String*  
  Fill color (or, in the case of lines, stroke color) to apply to the graphical portion of the legend element (requires a valid `shape` parameter to be defined).  

* **`size`** - *Number*  
  Size, in square pixels, for the graphical portion of the legend element if the value of the `shape` parameter is a [d3 symbol](https://github.com/mbostock/d3/wiki/SVG-Shapes#symbol_type). For example, a circle with a `size` of 40 will occupy roughly 40 square pixels, thus having a diameter of ~7.14 pixels.  

* **`length`** - *Number*  
  Length (in pixels) for the path rendered as the graphical portion of the legend element if the value of the `shape` parameter is `"line"`.  

* **`width`** - *Number*  
  Width (in pixels) for the rect rendered as the graphical portion of the legend element if the value of the `shape` parameter is `"rect"`.  

* **`height`** - *Number*  
  Height (in pixels) for the rect rendered as the graphical portion of the legend element if the value of the `shape` parameter is `"rect"`.  

* **`class`** - *String*  
  CSS class string to be applied to the DOM element representing the graphical portion of the legend element.  

* **`style`** - *Object*  
  CSS styles object to be applied to the DOM element representing the graphical portion of the legend element.  

* **`label`** - *String*  
  Label portion of the legend element to be displayed to the right of the graphical portion.  
