> [[API Reference|Home]] ▸ **Dashboard**

# Dashboard

A Dashboard is an HTML element used for presenting arbitrary user interface components. Dashboards are anchored to either the entire [[Plot]] or to individual [[Panels|Panel]].

## Dashboard Methods

Once a dashboard is created on a plot or panel it can be accessed by the attribute named `dashboard` and has the following methods:

* **`dashboard.show()`**  
  Make the dashboard appear. If it doesn't exist yet create it, including creating/positioning all components within, and make sure it is set to be visible.  

*other methods to be documented*

## Dashboard Layout

A dashboard's **layout** is a serializable object that describes general settings and individual components for the dashboard. For example:

```javascript
dashboard: {
  components: [
    {
      type: "title",
      title: "LocusZoom",
      position: "left"
    }
  ]
}
```

### Supported Layout Directives

* **`components`** - *Array*  
  Array of [[Component layout objects|Dashboard#dashboard-component-types]].

### Default Dashboard Component Layout Directives

All components are defined with their own layout objects (examples below). Many components support different layout directives to do different things. However, there are some component layout directives that may apply broadly to many components:

* **`position`** - *String*  
  Whether to float the component left or right. Can be `"left"` or `"right"`. Defaults to `"left"`.

* **`color`** - *String*  
  Color scheme for the component. Applies to buttons and menus. Possible values are `"gray"`, `"red"`, `"orange"`, `"yellow"`, `"green"`, `"blue"`, and `"purple"`. Defaults to `"gray"`.

### Dashboard Component Types

LocusZoom has the following Dashboard Components pre-defined:

* [Title](#title)
* [Dimensions](#dimensions)
* [Region Scale](#region-scale)
* [Download](#download)
* [Toggle Legend](#toggle-legend)
* [Remove Panel](#remove-panel)
* [Move Panel Up](#move-panel-up)
* [Move Panel Down](#move-panel-down)
* [Resize to Data](#resize-to-data)
* [Menu](#menu)
* [Covariates Model](#covariates-model)
* [Display options](#display-options)
* [Set state](#set-state)

#### Title

Renders arbitrary text with title formatting. Example:

```javascript
{
  type: "title",
  title: "LocusZoom",
  position: "left"
}
```

##### Title - Additional Layout Directives

* **`title`** - *String*  
  Text to render.  

#### Dimensions

Renders text to display the current dimensions of the plot that automatically updates as plot dimensions change. Example:

```javascript
{
  type: "dimensions",
  position: "left"
}
```

#### Region Scale

Renders text to display the current scale of the genome region displayed as defined by the difference between `state.start` and `state.end`. Example:

```javascript
{
  type: "region_scale",
  position: "left"
}
```

#### Download

Renders a button to allow for downloading the current plot as an SVG image. Example:

```javascript
{
  type: "download",
  color: "green",
  position: "left"
}
```
##### Unique directives
* **`button_html`** - *String*
  Text or HTML to display for the button caption
* **`button_title`** - *String*  
  Value of the title attribute for the button (shown by browsers automatically on hover, i.e. help text).
* **`filename`**- *String*
  The filename to use when saving the plot (default: locuszoom.svg)

### Toggle Legend
Renders a button that toggles display of the legend for the current panel. **Will only work on panel dashboards.**

```javascript
{
    type: "toggle_legend",
    position: "right"
}
```

#### Remove Panel

Renders a button that will remove the parent panel from the plot. **Will only work on panel dashboards.** Example:

```javascript
{
  type: "remove_panel",
  color: "red",
  position: "right"
}
```

#### Move Panel Up

Renders a button to allow for moving the panel up relative to other panels in terms of y-index. **Will only work on panel dashboards.** Example:

```javascript
{
  type: "move_panel_up",
  color: "blue",
  position: "right"
}
```

#### Move Panel Down

Renders a button to allow for moving the panel down relative to other panels in terms of y-index. **Will only work on panel dashboards.** Example:

```javascript
{
  type: "move_panel_down",
  color: "blue",
  position: "right"
}
```

#### Resize to data
Renders a button that resizes the panel to fit all available data. Useful for tracks such as genes, where an arbitrary amount of data may be shown in an initially fixed height. **Will only work on panel dashboards.**

```javascript
{
    type: "resize_to_data",
    position: "right"
}
```

##### Unique directives 
* **`button_html`** - *String*
  Text or HTML to display for the button caption
* **`button_title`** - *String*  
  Value of the title attribute for the button (shown by browsers automatically on hover, i.e. help text).

#### Menu

Renders button with arbitrary text that, when clicked, toggles the appearance of a menu with arbitrary HTML. Example:

```javascript
{
  type: "menu",
  button_html: "Click Me",
  button_title: "Description to show on mouse over",
  menu_html: "Lorem ipsum dolor sit amet",
  position: "left"
}
```

##### Menu - Additional Layout Directives

* **`button_html`** - *String*  
  HTML to render inside the button.  

* **`button_title`** - *String*  
  Value of the title attribute for the button (shown by browsers automatically on hover, i.e. help text).

* **`menu_html`** - *String*  
  HTML to render inside the menu object which can be toggled to appear below the button (sized to its content) as the button is clicked.  

#### Covariates Model

Special version of the generic [Menu](#menu) component used for managing a list of covariate objects stored in the state. Example:

```javascript
{
  type: "covariates_model",
  button_html: "Model",
  button_title: "Description to show on mouse over",
  position: "left"
}
```

##### Covariates Model - Additional Layout Directives

* **`button_html`** - *String*  
  HTML to render inside the button.  

* **`button_title`** - *String*  
  Value of the title attribute for the button (shown by browsers automatically on hover, i.e. help text).

##### Covariates Model - Behavior and Methods

Adding this dashboard component to a plot will automatically create a `model` object in the [[State]] that contains an empty array called `covariates`, like so:

```javascript
state: {
  model: {
    covariates: []
  },
  ...
}
```

The instantiation of this component will also create a `CovariatesModel` object on the parent plot object. This object provides several reference objects and methods for programmatically interfacing with the component menu and state representations of the model:

* **`plot.CovariatesModel.add(element)`**  
  Add an element to the model and show a representation of it in the dashboard component menu. The argument `element` can be any value that can be put through `JSON.stringify()` to create a serialized representation of itself. Will compare any passed `element` to the contents of `state.model.covariates` prior to adding to prevent duplicates. Will also automatically trigger requests for new data through the alteration of the state.

* **`plot.CovariatesModel.removeByIdx(idx)`**  
  Remove an element from `state.model.covariates` (and from the dashboard component menu's representation of the state model) by its index in the `state.model.covariates` array. Will also automatically trigger requests for new data through the alteration of the state.

* **`plot.CovariatesModel.removeAll()`**  
  Empty the `state.model.covariates` array and dashboard component menu representation thereof of all elements. Will also automatically trigger requests for new data through the alteration of the state.

* **`plot.CovariatesModel.updateComponent()`**  
  Manually trigger the update methods on the dashboard component's button and menu elements to force display of most up-to-date content. Useful when modifying `state.model.covariates` by some means outside of the methods provided in `plot.CovariatesModel` to force the dashboard component to reflect the changes.

* **`plot.CovariatesModel.button`**  
  Reference to the button object contained within the dashboard component. The button object contains the menu.  


#### Display Options
This panel-level dashboard widget creates a button that lets the user change between several different (pre-set) display options. For example, points can be colored based on different fields, or the same data can be drawn according to different size or coloring schemes. (solid color, gradient, etc)

```javascript
{
    type: 'display_options',
    position: 'right',
    color: 'blue',
    // Below: special config specific to this widget
    button_html: 'Display options...',
    button_title: 'Control how plot items are displayed',
    layer_name: 'associationpvaluescatalog',
    default_config_display_name: 'Basic plot (default)', // display name for the default plot color option (allow user to revert to plot defaults without duplicating here)
    options: [{
        display_name: "First option",
        display: {
            color: "#FF0000"
        }
    }]
```

##### Unique directives
* **`button_html`** - *String*
  Text or HTML to display for the button caption

* **`button_title`** - *String*
  Mouseover text for the button

* **`layer_name`** - *String*
  The name of the data layer that this button controls. A given set of display options will only control one data layer within the panel where the button lives.

* **`default_config_display_name`** - *String*
  The display options button automatically captures the original coloring configuration for the data layer, so as to avoid duplication. This option controls what name is used to refer to that coloring configuration on the dropdown with a list of display choices.

* **`fields_whitelist`** - *Array*, Optional
  By default, the display_options dropdown knows how to control some of the most common display settings used by data layers. If your data layer has custom configuration, you can override the list of known fields, and the button will then attempt to find (or set) layout keys with matching names. If this field is omitted, the default fields that can be controlled are:   `"color", "fill_opacity", "label", "legend", "point_shape", "point_size", "tooltip", "tooltip_positioning"`.

* **`options`** - *Array*
  Specify a series of ways that the plot can be drawn. Each option is an object with the keys specified below.

##### Options specification
* **`display_name`** - *String*
  The human-friendly label to show when referring to this option in the dropdown.

* **`display`** - *Object*
  Specify a set of standard layout directives for each data point, for the fields this button knows how to control (as set in `fields_whitelist`, above). Each key supports the full syntax and power available to these options in a data layer, including scalable parameters. For example: colors can be a gradient, and point size / shape can be controlled conditionally based on field value.

#### Set state
Set a particular field in `plot.state` to a specific value. Since some data sources and rendering options depend on the value of a field in `plot.state`, this can be used to modify requests dynamically- eg, to let users select a custom LD panel. (the built-in predefined dashboard button `ldlz2_pop_selector` is a special case of this widget)

Because this sets global options (plot.state), this button **will only work on plot dashboards**.

```javascript
{

    type: 'set_state',
    position: 'right',
    color: 'blue',
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
        { display_name: 'SAS', value: 'SAS' }
    ]
}
```
##### Unique directives 
* **`button_html`** - *String*
  Text or HTML to display for the button caption
* **`button_title`** - *String*  
  Value of the title attribute for the button (shown by browsers automatically on hover, i.e. help text).
* **`show_selected`** - *Boolean*
  Whether to show the selected value as part of the button label (default `false`)
* **`state_field`**- *String*
  The name of the field in `plot.state` that is controlled by this button
* **`options`**- *Array*
  An array of objects. Each option is an object that specifies `display_name` (shown in the UI) and `value` (saved in plot.state when the option is selected).
