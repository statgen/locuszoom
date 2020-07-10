# Data Layer

A data layer is a layer in terms of depth of z-index within a panel for displaying data. It is clipped by the panel's defined clip area and can be one of any supported type. Depending on the type of the data layer it will be able to display different data and support different layout directives.

## Data Layer Layout

A data layer's **layout** is a serializable object that describes every customizable feature of a LocusZoom plot with nested values. It should only ever contain scalar values, arrays, and objects - no functions!

### Scalable Layout Directives

Several directives supported by data layers may be **scalable**, and will be denoted as such. Scalable directives are those that can be defined statically as a scalar value (string or number), one or more [Scale Functions](scale-functions.md), or a combination thereof.

### Supported Layout Directives - All/Most Data Layer Types

These directives are commonly implemented across several or all data layer types. Refer to the documentation of each individual data layer type to check for support.

* **`type`** - *String*  
  The name of a defined `DataLayer` class. LocusZoom Core comes pre-supplied with several types of Data Layers already defined and provides an API to create custom Data Layers as needed. See [Data Layer Types](#data-layer-types) for more details.  

* **`fields`** - *Array*  
  An array of strings that map to valid fields in the [Data Sources](data-sources.md).  These values will be processed during every request for data so that every data object stored in the Data Layer has each of these values as a named property.  

* **`color`** - *String _or_ Object, Scalable*  
  A string representing a uniform color for data represented by a data layer _or_ an object describing a dynamic coloring scheme. Note that while most browsers support support four-dimensional color definitions (e.g. RGBA/HSLA) standards-compliant SVG does not. This means if you define any colors using `rgba` or `hsla` they may appear to function correctly in a browser but downloaded SVGs will render such colors as flat black. When working with transparency and requiring SVG download support it's recommended to stick to three-dimensional color declarations (`rgb`/`hsl`) and define opacity for elements separately using the `fill_opacity` directive.  

* **`match`** - *Object*  
  (advanced interactive feature) If present, this feature allows different data layers to communicate when a point is clicked. For example, a user can click a point in one layer (an association plot), and see matching points for the same variant change color in other panels/data layers (eg annotation tracks, or other association studies plotted alongside for comparison). When a point is clicked, one part of the plot "broadcasts" a specified field value from that point (a field name in `match.send`), and every other layer looks for points with a matching field value (the field name in `match.receive` for each layer). For performance reasons, currently it is only possible to match one value at a time across all layers in the plot. This feature may change based on user feedback. If a given `match` directive is omitted, the layer will not `send` or `receive` match events.
  * The match directive only asks whether a match exists. It works by marking matching points with a custom synthetic field `lz_highlight_match`. You can change the display of matching items in any data layer, by using whatever existing layout directives that layer supports: eg "if field value is true, then color is red". `color: { field: 'lz_highlight_match', scale_function: 'if', parameters: { field_value: true, then: '#FFf000' } }`

* **`fill_opacity`** - *Number _or_ Object, Scalable*  
  A number representing the opacity level to apply to the fills of objects for elements created in the data layer. Opacity numbers range from `0` for transparent to `1` for opaque. Defaults to `1` for most data layers that support this directive.  

* **`z_index`** - *Number*  
  An integer representing the order in which a data layer should be rendered relative to other data layers. Data layers with higher z_index values are rendered *above* those with lower values. This value will be automatically assigned to a data layer as it is added through the normal parsing of a layout object during initialization, and any value defined here may be overridden to ensure that all data layers for a panel have a meaningful integer z_index beginning at 0.  

#### Axes

* **`(x|y)_axis`** - *Object*  
  An object that attaches a data field to an axis and sets limits on the range of the data displayed.  

  For a panel with axes, both axes (**`data_layer.x_axis`** and **`data_layer.y_axis`**) should be defined as objects with at least a field defined on each for a data layer to render properly.  Not all panels and data layers have axes in the traditional sense. If a panel / data layer does not define an **`x_axis`**, for example, then the x_axis (shown or not) is assumed to be genetic position and the range of the axis shown assumed to be bounded by the **`start`** and **`end`** values defined in the [State](state.md).  

  * **`(x|y)_axis.field`** - *String*  
    Name of the field to map to the axis. The field name used here should also be present in **`data_layer.fields`**.  

  * **`x_axis.extent`** - *String* 
    This accepts a single special value, *`state`*, which causes the extent to be determined from the value specified in the plot state (`start` and `end` parameters). This is useful for drawing a set of panels to reflect a particular genomic region. This value only works for the x-axis.

  * **`y_axis.axis`** - *Number: 1 or 2*  
    Number signifying which of the two available y axes to bind this data layer. **Only values `1` (left y-axis) and `2` (right y-axis) are valid.** If not set, or set to any value other than `1` or `2`, this value will default to `1`.  

  * **`(x|y)_axis.floor`** - *Number*  
    Discrete minimum value for data points on the axis. By default the lower limit on the axis will be the lower limit of the extent of the data set mapped to the axis. This value can override that automatic limit by forcing a specific minimum value.  

  * **`(x|y)_axis.ceiling`** - *Number*  
    Discrete maximum value for data points on the axis. By default the upper limit on the axis will be the upper limit of the extent of the data set mapped to the axis. This value can override that automatic limit by forcing a specific maximum value.  

  * **`(x|y)_axis.lower_buffer`** - *Number*  
    Amount to expand to the lower end of an axis as a proportion of the extent of the data. For instance, if data ranges from 20 to 60 and the lower buffer is set to `0.25` then the lower end of the axis will be expanded by 25% of the extent of the data (60 - 20 = 40 units), or 10 units, dropping the lower end of the axis to 10.  If a `ceiling` is defined, it will affect the extent before `lower_buffer`.  For instance, with data ranging from 20 to 60, a `ceiling` of 100, and `lower_buffer` of 0.25, the final extent would be from 0 to 100 (because 0 = 20 - 0.25 * (100-20).  Any buffer defined here will be overridden if a `floor` is also defined.  

  * **`(x|y)_axis.upper_buffer`** - *Number*     
    Amount to expand to the upper end of an axis as a proportion of the extent of the data. For instance, if a data ranges from 0 to 50 and the upper buffer is set to `0.1` then the upper end of the axis will be expanded by 10% of the extent of the data (50 - 0 = 50 units), or 5 units, expanding the upper end of the axis to 55.  If a `floor` is defined, it will affect the extent before `upper_buffer`.  For instance, with data ranging from -50 to 50, a `floor` of 0, and `upper_buffer` of 0.1, the final extent would be from 0 to 55 (because 55 = 50 + 0.1 * (50-0).  Any buffer defined here will be overridden if a `ceiling` is also defined.  

  * **`(x|y)_axis.min_extent`** - *Array*  
    A discrete extent to behave as the minimum low and high for the axis. This should be array of exactly two numbers. For example, a min_extent of `[ 0, 10 ]` will ensure that the axis will *at least* range from 0 to 10 regardless of the data mapped to it. If the data or the data combined with `lower_buffer` and/or `upper_buffer` expands beyond the minimum extent in either direction then the axis will expand beyond the minimum extent to follow suit. Either value in the `min_extent` array may be overridden by a discrete `floor` or `ceiling` value.  

#### Behaviors and Element Statuses

LocusZoom data layers support the binding of mouse events to one or more layout-definable *behaviors*. Some examples of behaviors include highlighting an element on mouseover, or linking to a dynamic URL on click, etc.

Defining behaviors starts by defining a `behaviors` object in the data layer layout. Each element in `behaviors` should have a specific event identifier for a key with an array of arbitrarily many behavior objects for its value. Here's an example of the most common `behaviors` object featured in many predefined data layer layouts:

```javascript
behaviors: {
    onmouseover: [
        { action: "set", status: "highlighted" }
    ],
    onmouseout: [
        { action: "unset", status: "highlighted" }
    ],
    onclick: [
        { action: "toggle", status: "selected", exclusive: true }
    ],
    onshiftclick: [
        { action: "toggle", status: "selected" }
    ]
}
```

In the above example the mouseover and mouseout events set and unset the `highlighted` status on a given element, respectively. A click action will exclusively toggle the `selected` status on an element (toggle meaning it will flip the status boolean, and exclusive meaning if the new status is true it will unselect all other elements). The shift-click action illustrates the difference the `exclusive` parameter makes as, with that parameter not set, shift-clicking elements will cause them to be selected in addition to any other selected elements.

The basic structure of a valid behavior is as follows:

```javascript
behaviors: {
    {EVENT}: [
        { action: "{ACTION}", {MORE PARAMETERS} }
    ]
}
```

The following behavior **events** are currently supported:

* `onmouseover`, `onshiftmouseover`, `onctrlmouseover`, `onctrlshiftmouseover`
* `onmouseout`, `onshiftmouseout`, `onctrlmouseout`, `onctrlshiftmouseout`
* `onclick`, `onshiftclick`, `onctrlclick`, `onctrlshiftclick`

Note that the shift/ctrl keypresses are an absolute match. This means that a click event that fires while the shift key is pressed, for example, will *only* register as a shift-click event (not also a regular click event).

The following behavior **actions** are currently supported:

* **`set`** - Set an element's status to true regardless of current value
* **`unset`** - Set an element's status to false regardless of current value
* **`toggle`** - Set an element's status to true if currently false and false if currently true
* **`link`** - Load a URL (see details below)

In the case of `set`, `unset`, and `toggle` the behavior is in reference to one (and only one) status. A status is a flag on an individual element that affects how that element appears and whether a tooltip should be showing for that element. The [State](state.md) object keeps arrays of element IDs for all statuses on each data layer to be used for further interaction logic.

The following element **statuses** are currently supported:

* **`highlighted`** - Minor visual outline on a given element
* **`selected`** - Major visual outline or change to a given element
* **`faded`** - Set an element to partial opacity
* **`hidden`** - Make an element invisible

To create a behavior that links to another page (e.g. when clicking an element) follow this pattern:

```javascript
behaviors: {
    onclick: [
        {
            action: "link",
            href: "http://locuszoom.org/{{element_parameter}}.html",
            target: "_blank"
        }
    ]
}
```

The **`href`** parameter should be a valid URL that may contain namespaced element parameters (the parsing logic is identical to that used to parse tool tip HTML). The **`target`** parameter is optional; if not defined the URL will be loaded in the same page that triggered the event, otherwise the value will be used for the name of the new tab/window that's opened.

If a specific event in the `behaviors` object has more than one valid behavior defined in its array then all will be executed in the order defined.

#### Tool Tips

* **`tooltip`** - *Object*  
  An object that defines the content and behavior of a tool tip to be displayed when interacting with elements in the data layer. All data layers render tool tips visually the same way, but each data layer has custom logic to position a tool tip relative to an element.  

* **`tooltip.(show|hide)`** - *String or Object*  
  This parameter encodes the logic for whether a tool tip should be shown or hidden for an element depending on its highlighted and/or selected statuses. Define logic in terms of the strings `"highlighted"`, `"unhighlighted"`, `"selected"`, and `"unselected"`. As a simple example:  
  
  `tooltip: { show: "highlighted", hide: "unhighlighted" }`  
  
  This will show (create) the tool tip when the element is highlighted and hide (destroy) the tool tip when the element is unhighlighted, a status defined by the **`behaviors`** parameter of the data layer.  
  
  More complex boolean combinations of the four available statuses can be done with an object/array syntax. For example:  
  
  `tooltip: { show: { or: ["highlighted", "selected"] }, hide: { and: ["unhighlighted","unselected] } }`  
  
  This will ensure that a tool tip is should on any element that is highlighted or selected or both, and ensure that tool tips are not shown for elements that are neither highlighted nor selected. When the internal logic is triggered to interpret these directives relative to an element's status a tool tip will only be shown if its `show` logic resolves to true *and* its `hide` logic resolves to false (e.g. if both `show` and `hide` resolve to true, no tool tip will be shown).  

* **`tooltip.closable`** - *Boolean*  
  Whether a tool tip should render a "close" button in the upper right corner. When clicked the tool tip will be destroyed. Subsequent mouse events on an element that would cause a tool tip to be shown will recreate the tool tip. By default this is not defined, and therefore close buttons will not be rendered.  

* **`tooltip.html`** - *String*  
  HTML to render inside the tool tip. Any data fields that are present in the data layer's `fields` directive can be resolved to element-specific values inside a tool tip by using double-curly-bracket notation. For example: `"Species: {{animal}}"` will attempt to resolve `{{animal}}` to the value of the `animal` field on the data bound to the element when the tool tip is rendered. Such field declarations must match the elements in the `fields` array *exactly*, so should include namespaces and/or transformations if present in the `fields` array definition. Conditional tags are also supported using the format: `{{#if animal}}foo{{/if}}` wherein the string "foo" will only appear in the parsed HTML if the variable `animal` is defined (Note that since this is just an existence check, variables with a value of `0` will be evaluated as true in a conditional tag test).

#### Legend

* **`legend`** - *Array*  
  A [Legend data layer layout](legend.md#legend-data-layer-layout) array. The contents of the array should be objects describing individual elements to be shown in the legend, which the parent panel will aggregate together with legend elements from sibling data layers.  

#### Transitions

* **`transition`** - *Object*  
  An object that defines how data in the data layer should transition when updated. If defined then all data layer types that support transitions will transition updates to data. By default transitions are not defined for any data layer type.  

* **`transition.duration`** - *Number*  
  Number of milliseconds for the transition to take place. If a transition object is defined in the layout, but this value is not defined, then this will default to `0`.  

* **`transition.ease`** - *String*  
  Easing method for the transition. See [d3.ease documentation](https://github.com/d3/d3/wiki/Transitions#d3_ease) for information on building easing method strings. If a transition object is defined in the layout, but this value is not defined, then this will default to `"cubic-in-out"`.  

#### Labels

* **`label`** - *Object*  
  An object that defines simple dynamic text labels for elements on a data layer. Labels differ from tool tips in that they are rendered as SVG elements (and thus are a part of the image that persists when downloading the SVG) and that they will render or not independent of any mouse interaction with the element. Labels may also be implemented with logic to attempt to keep adjacent labels from overlapping one another.  

* **`label.text`** - *String*  
  Text to render for the label. Any data fields that are present in the data layer's `fields` directive can be resolved to element-specific values inside a label by using double-curly-bracket notation. For example: `"Species: {{animal}}"` will attempt to resolve `{{animal}}` to the value of the `animal` field on the data bound to the element when the tool tip is rendered. Such field declarations must match the elements in the `fields` array *exactly*, so should include namespaces and/or transformations if present in the `fields` array definition.  

* **`label.spacing`** - *Number*  
  Number of pixels to attempt to fit between labels that are very close to one another. Used when labels are rendered and iterative logic executes to push labels apart that may be overlapping.  

* **`label.filters`** - *Array*  
  Array of objects that each represent a filter to determine whether a label should render for the element or not. For example:

```javascript
filters: [
  {
    field: "height",
    operator: ">=",
    value: 50
  },
  {
    field: "weight",
    operator: "<",
    value: 200
  }
]
```

  In this example each element is evaluated first on its `height` parameter and then on its `weight` parameter. Only elements with a `height` >= 50 _and_ a `weight` < 200 will have a label rendered.  

* **`label.style`** - *Object*  
  Object describing styles for the label's text element. Conforms to the [d3 standard style object specification](https://github.com/mbostock/d3/wiki/Selections#style).  

* **`label.lines.style`** - *Object*  
  Object describing styles for lines connecting labels to their parent data elements. Conforms to the [d3 standard style object specification](https://github.com/mbostock/d3/wiki/Selections#style).  

### Data Layer Types

LocusZoom has the following Data Layer types defined in the core:

# [Arcs](#arcs)
* [Forest](#forest)
* [Genes](#genes)
* [Line](#line)
* [Annotation track](#annotation-track)
* [Orthogonal Line](#orthogonal-line)
* [Scatter](#scatter)
* [Category scatter](#category-scatter)

#### Arcs
##### Arc-specific directives
Arcs are symmetric, defined by two endpoints (two x-fields). The `y_axis.field` determines the height of the arc, which peaks at the center point between the two x endpoints. The *color* field is scalable, allowing 
 
- **`x_axis`** - Object 
  - `field1` - *String* - The name of a field containing one endpoint of the arc
  - `field2` - *String* - The name of a field containing the second endpoint of the arc

#### Forest

The **`forest`** Data Layer type implements a standard forest plot, including support for display of confidence intervals

##### Forest-Specific Directives

* **`color`** - *See general definition above, Scalable*  
  Defaults to `"#888888"`.  

* **`fill_opacity`** - *See general definition above, Scalable*  
  Defaults to `1`.  

* **`id_field`** - *String*  
  Which field, as defined in the `fields` array, is to be used as a unique identifier for individual scatter points. Defaults to `id`.  

* **`point_size`** - *Number, Scalable*  
  Size, in square pixels, to render each point in the scatter plot. For example, a square point with a `point_size` of 64 will be an 8x8 square. Defaults to `40`.  

* **`point_shape`** - *String, Scalable*  
  Shape of each point on the data layer as represented by a string. Supported values map to the [d3 SVG Symbol Types](https://github.com/mbostock/d3/wiki/SVG-Shapes#symbol_type) (i.e.: "circle", "cross", "diamond", "square", "triangle-down", and "triangle-up"). Defaults to "circle".  

* **`confidence_interval`** - *Object*  
  Object defining the fields define the start and end of confidence intervals for each data point. Leave undefined or set to `false` to prevent confidence interval data from being rendered.  

  * **`start_field`** - *String*  
    Which field to interpret as the start value for the confidence interval. Defaults to "ci_start".  For every data point, the value in this field must always be smaller than the value of `end_field`.

  * **`end_field`** - *String*  
    Which field to interpret as the end value for the confidence interval. Defaults to "ci_end".

* **`show_no_significance_line`** - *Boolean*  
  Whether to show a line of no significance. Defaults to `true`.  

#### Genes

The **`genes`** Data Layer type implements a visualization of gene/transcript/exon information. It implements a custom tool tip rendering function to position tool tips (if defined) above or below genes depending on where there is available space (relative to the panel).

##### Genes-Specific Directives

* **`bounding_box_padding`** - *Number*  
  Single value in pixels to be used as top, bottom, left, and right padding from data displayed to represent a given gene to its bounding box. The bounding box is directly displayed when a gene is selected but is otherwise invisible, however it represents the "footprint" of a gene in the data layer when the data layer's render function positions genes on tracks such that none overlap. Thus, a larger `bounding_box_padding` will give genes more space during automatic positioning. Defaults to `6`.  

* **`exon_height`** - *Number*  
  Height, in pixels, of each exon in each gene. Defaults to `16`.  

* **`label_exon_spacing`** - *Number*  
  Spacing in pixels between the baseline of each gene's label and the top of exons for that gene. Defaults to `4`.  

* **`label_font_size`** - *Number*  
  Font size (letter height) in pixels for each gene's label. Defaults to `12`.  

* **`track_vertical_spacing`** - *Number*  
  Vertical space between gene tracks, in pixels, in which nothing will be rendered. Defaults to `10`.  

#### Annotation track
The **`annotation_track`** layer implements a track that identifies specific points of interest. This can be used to help show more types of information than can be conveyed by color or shape alone- for example, it can be used to annotate the members of a credible set alongside a plot that is colored by LD value. Common configuration options such as `fields`, `color`, and `tooltip` are supported.

##### Annotation-specific directives
* **`x_axis.field`** - *String* 
  Specify the field (such as position) used to position the point along the track

* **`filters`** - *Array*
  Specify the criteria used to select which points are drawn for annotations. All of the specified criteria must be satisfied for the data element to be drawn on the annotation track. Each element of the array is an array of strings, such as `[filename, value]` to test for equality, or `[fieldname, comparison_operator, value]` for richer operations (`<, <=, =, >=, >, %`).

#### Line

The **`line`** Data Layer type implements a standard line plot. It implements a custom tool tip rendering function to position a tool tip (if defined) that updates with new values as the mouse moves along the rendered line.

This layer can also be used to draw filled curves, using custom layout directives.

##### Line-Specific Directives

* **`hitarea_width`** - *Number*  
  Stroke width (in pixels) to apply to invisible hit area rendered over the line. This hit area is used to detect mouse interaction with the line (instead of the line itself to allow for intuitive mouse behavior when working with a thin or dotted line). Note that a wider hit area may decrease the accuracy of the mouse event's position relative to the line. Defaults to `5`.  

* **`interpolate`** - *String*  
  Interpolation mode for the line to be applied to the line directly using d3's `interpolate()` method (documentation [here](https://github.com/d3/d3/wiki/SVG-Shapes#line_interpolate)). Defaults to `linear`.  

* **`style`** - *Object*  
  CSS styles built as an object to be applied to the line directly using d3's `style()` method (documentation [here](https://github.com/d3/d3/wiki/Selections#style)).

  Defaults to:

```javascript
{
  "fill": "transparent",
  "stroke-width": "2px"
}
```

If a `fill` color is specified, this will be drawn as a filled curve.

#### Orthogonal Line

The **`orthogonal_line`** Data Layer type implements a straight line that is orthogonal to the axes - that is, vertical or horizontal. standard line plot. It implements a custom tool tip rendering function to position a tool tip (if defined) that updates with new values as the mouse moves along the rendered line.

##### Orthogonal-Line-Specific Directives

* **`orientation`** - *String: "horizontal" or "vertical"*
  Whether to render the line horizontally or vertically. Defaults to `"horizontal"`.

* **`offset`** - *Number*  
  Offset from the axis (i.e. where the line should be positioned, relative to the data). For horizontal lines this will be relative to the data tied to the selected x-axis, and for vertical lines this will be relative to the data tied to the specified y-axis (e.g. `1` or `2`, as defined in the data layer layout `x_axis` or `y_axis` object). Defaults to `0`.

* **`style`** - *Object*  
  CSS styles built as an object to be applied to the line directly using d3's `style()` method (documentation [here](https://github.com/d3/d3/wiki/Selections#style)).

  Defaults to:

```javascript
{
  "stroke": "#D3D3D3",
  "stroke-width": "3px",
  "stroke-dasharray": "10px 10px"
}
```

#### Scatter

The **`scatter`** Data Layer type implements a standard scatter plot. It implements a custom tool tip rendering function to position tool tips (if defined) to the left or right of points depending on where there is available space (relative to the panel).

##### Scatter-Specific Directives

* **`color`** - *See general definition above, Scalable*  
  Defaults to `"#888888"`.  

* **`fill_opacity`** - *See general definition above, Scalable*  
  Defaults to `1`.  

* **`id_field`** - *String*  
  Which field, as defined in the `fields` array, is to be used as a unique identifier for individual scatter points. Defaults to `id`.  

* **`point_size`** - *Number, Scalable*  
  Size, in square pixels, to render each point in the scatter plot. For example, a square point with a `point_size` of 64 will be an 8x8 square. Defaults to `40`.  

* **`point_shape`** - *String, Scalable*  
  Shape of each point on the data layer as represented by a string. Supported values map to the [d3 SVG Symbol Types](https://github.com/mbostock/d3/wiki/SVG-Shapes#symbol_type) (i.e.: "circle", "cross", "diamond", "square", "triangle-down", and "triangle-up"). Defaults to "circle".  

#### Category scatter
The **`category_scatter`** data layer type is a special type of scatter plot, which inherits all the configuration and settings of a traditional `scatter` layer. This type of plot is used when you have an array of records, and would like to arrange them into nicely labeled groups based on a common field (see [PheWAS scatter example](http://statgen.github.io/locuszoom/examples/phewas_scatter.html).

##### Unique directives
Used properly, you will not need to specify explicit tick marks or group names; the `category_scatter` layer will calculate this all for you automatically. However, this does require some special configuration:

* **`x_axis.category_field`** - *String*
  Which field, as defined in the `fields` array, is to be used in forming the groups. Must be provided for the data layer to work.

##### Special interactions with parent panels
The `category_scatter` layer has the ability to identify groups, and to inform the parent panel what axis labels/ ticks it will need. This does introduces a small bit of added complexity, as the datalayer has the unique feature of respecting certain configuration that gets provided by the *parent panel*.

* **`<panel>.axes.<axis>.ticks`** - *Object* Normally, a panel provides an array of ticks, each with their own configuration. If the parent panel passes an object of configuration parameters, this will represent a single set of default styles applied to every tick mark produced by the data layer. Ultimately, the panel is responsible for drawing the axis, and so any tick display settings specified by the panel will override default display choices suggested by the datalayer.

  * **`...ticks.position`** - *String* ('left'|'center'|'right') The panel can tell the datalayer where it wants ticks to appear- either aligned with one edge of the category region, or centered in the range. (if no option is specified, defaults to "left") 

## Adding custom methods and functionality
We make every effort to provide a range of configurable plot types as part of core LocusZoom. Should you need to modify or extend part of a DataLayer in code, these additional helpers might be useful.

### Registering a new kind of datalayer
- **`LocusZoom.DataLayers.add(name, constructor)`**
  Register a new datalayer of the specified name (*String*), with the specified constructor (*function*). This layer will automatically inherit all properties and methods from the base `DataLayer` class.

- **`LocusZoom.DataLayers.extend(parent_name, name, overrides)`** 
  Useful when adding custom code to slightly modify an existing layer type. This method will create a new type of datalayer that builds on functionality of a premade type, as specified by parent_name (*String*). It will create and register a new layer with the provided name (*String*), and add all methods and properties in overrides (*object*) to the prototype of the newly created DataLayer class.

### Communicating with plot elements outside the datalayer
- **`DataLayer.getTicks(config)`
  In some cases, a datalayer may need to customize the positions or display of tick marks in the parent panel. It can do so by implementing `getTicks`, and returning an array of objects with tick configuration parameters. The panel will generally use these suggestions, unless they are overridden with explicit tick marks in the panel layout object.
