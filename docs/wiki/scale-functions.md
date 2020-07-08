# Scale Functions

A Scale Function can be thought of as a modifier to a layout directive that adds extra logic to how a piece of data can be resolved to a value.

For a clear example, consider the classic association p-values plot:

![Traditional LocusZoom association data panel](http://statgen.github.io/locuszoom/wiki_images/locuszoom_panel_association.png)

The layout for the association data layer needs to specify shapes, colors, and sizes for all points on the scatter plot. Scale Functions are what allows LocusZoom layouts to express how to vary values like those depending on the data for each given point, as shown in this corresponding snippet of the layout behind the image above:

```javascript
{
  "type": "scatter",
  "point_shape": {
    "scale_function": "if",
    "field": "ld:isrefvar",
    "parameters": {
      "field_value": 1,
      "then": "diamond",
      "else": "circle"
    }
  },
  "point_size": {
    "scale_function": "if",
    "field": "ld:isrefvar",
    "parameters": {
      "field_value": 1,
      "then": 80,
      "else": 40
    }
  },
  "color": [
    {
      "scale_function": "if",
      "field": "ld:isrefvar",
      "parameters": {
        "field_value": 1,
        "then": "#9632b8"
      }
    },
    {
      "scale_function": "numerical_bin",
      "field": "ld:state",
      "parameters": {
        "breaks": [0,0.2,0.4,0.6,0.8],
        "values": ["#357ebd","#46b8da","#5cb85c","#eea236","#d43f3a"]
      }
    },
    "#B8B8B8"
  ],
  ...
```

As defined above:

* The `point_shape` directive uses the `if` scale function to evaluate the value of `ld:isrefvar` for each element in the data layer, resolving to `"diamond"` if `ld:isrefvar` is `1`, otherwise resolving to `"circle"`.  

* The `point_size` directive uses the `if` scale function to evaluate the value of `ld:isrefvar` for each element in the data layer, resolving to `80` if `ld:isrefvar` is `1`, otherwise resolving to `40`.  

* The `color` directive uses two scale functions *and* a scalar value *in order*: first evaluating `if` the value of `ld:isrefvar` is `1` and then resolving to `"#9632b8"` (purple). If not resolved it proceeds to the next scale function of `numerical_bin` to evaluate the value of `ld_state` for the element, resolving to a color mapping to breakpoints if the value is numeric. Otherwise, if none of the scale functions have resolved to a value, the scalar value of `"#B8B8B8"` (grey) is used as the color for the element.

These definitions for the shape, size, and color of elements on the plot allow for rendering the LD reference variant as a larger purple diamond and appropriately coloring all other elements (rendered as smaller circles) based on their numeric LD value (or grey if no LD value is present).

Any time the documentation for a layout directive denotes that parameter as *Scalable* that means arbitrarily many Scale Functions may be used to create logic that operates on a field value as shown here.

## Layout Structure

Scale functions can appear in a layout (data layer, panel... any part of a layout that is explicitly documented as *Scalable*).

If a scale function is intended to operate on a single field then the field name must be explicitly defined in the layout along with the function's name and additional parameters:

```javascript
{
  scale_function: "name",  // the name of the scale function
  field: "field",          // name of the field to supply as input to the scale function
  paramters: { ... }       // parameters object to supply as controls to the scale function
}
```

However some scale functions may instead operate on more than one field, in which case a field value should not be defined:

```javascript
{
  scale_function: "name",  // the name of the scale function
  paramters: { ... }       // parameters object to supply as controls to the scale function
}
```

In this form the input to the scale function is the entire data element. As of this writing all built-in scale functions (documented below) take a single field and have relatively simple operation. If more complex operation is needed, including any operation involving more than one field on the data element, define a custom scale function and invoke it without specifying a field name in order for the entire data element to be the input.

## Built-in Scale Functions

LocusZoom.js provides the following scale functions as a part of the core library:

### if

Basic conditional function to evaluate the value of the input field and return based on equality. Parameters:

* **`field_value`** - *Any Type*  
  The value against which to test the input value.  

* **`then`** - *Any Type*  
  The value to return if the input value matches the field value.  

* **`else`** - *Any Type*  
  The value to return if the input value **does not match** the field value. Optional. If not defined this scale function will return `null` (or value of `null_value` parameter, if defined) when input value fails to match `field_value`.  

### numerical_bin

Function to sort numerical values into bins based on numerical break points. Will only operate on numbers and return `null` (or value of `null_value` parameter, if defined) if provided a non-numeric input value. Parameters:

* **`breaks`** - *Array*  
  Array of numerical break points against which to evaluate the input value. Must be of equal length to `values` parameter. If the input value is greater than or equal to break *n* and less than or equal to break *n+1* (or break *n+1* doesn't exist) then returned value is the *nth* entry in the `values` parameter.  

* **`values`** - *Array*  
  Array of values to return given evaluations against break points. Must be of equal length to `breaks` parameter. Each entry *n* represents the value to return if the input value is greater than or equal to break *n* and less than or equal to break *n+1* (or break *n+1* doesn't exist).  

* **`null_value`** - *Any Type*  
  Value to return if the input value is non-numeric or fails to match to any break points (e.g. by being less than the first break). Optional.  

### categorical_bin

Function to sort values of any type into bins based on direct equality testing with a list of categories. Will return `null` if provided an input value that does not match to a listed category. Parameters:

* **`categories`** - *Array*  
  Array of values against which to evaluate the input value. Must be of equal length to `values` parameter. If the input value is equal to category *n* then returned value is the *nth* entry in the `values` parameter.  

* **`values`** - *Array*  
  Array of values to return given evaluations against categories. Must be of equal length to `categories` parameter. Each entry *n* represents the value to return if the input value is equal to the *nth* value in the `categories` parameter.  

* **`null_value`** - *Any Type*  
  Value to return if the input value fails to match to any categories. Optional.  

### interpolate

Function for continuous interpolation of numerical values along a gradient with arbitrarily many break points. Parameters:

* **`breaks`** - *Array*  
  Array of numerical break points against which to evaluate the input value. Must be of equal length to `values` parameter and contain at least two elements. Input value will be evaluated for relative position between two break points *n* and *n+1* and the returned value will be interpolated at a relative position between values *n* and *n+1*.  

* **`values`** - *Array*  
  Array of values to interpolate and return given evaluations against break points. Must be of equal length to `breaks` parameter and contain at least two elements. Each entry *n* represents the value to return if the input value matches the *nth* entry in `breaks` *exactly*. Note that this scale function uses [d3.interpolate](https://github.com/d3/d3-3.x-api-reference/blob/master/Transitions.md#d3_interpolate) to provide for effective interpolation of many different value types, including numbers, colors, shapes, etc.  

* **`null_value`** - *Any Type*  
  Value to return if the input value is non-numeric. Optional.  

## Chaining Scale Functions

As shown in the example above for color Scale Functions may be defined as an array of objects that operate on data in a specific order. The layout interpreter will interpret a `null` value returned from a scale function as a cue to advance to the next scale function in the layout, if there is one. As such, order is important. However scale functions appearing in the same chain are all atomic and do not have to operate on the same data field(s).

A value may appear at the end of a list of scale functions as a "default" value if all the scale functions return null, as also shown in the example above for color.

## Defining Custom Scale Functions

Scale Functions are kept and accessed through a singleton at `LocusZoom.ScaleFunctions`. Custom scale functions can be added as needed like so:

```javascript
LocusZoom.ScaleFunctions.add("function_name", function(parameters, input){
    /* process parameters and input to return a value */
});
```

When executing a scale function LocusZoom passes the parameters directly from the layout where the scale function is invoked and the input is passed as the value of the field defined in the layout for the given element. If a custom scale function cannot resolve a value and should defer to the next scale function or default value it should return `null`.
