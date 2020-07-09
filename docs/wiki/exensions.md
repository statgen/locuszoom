# Extensions

LocusZoom provides some companion functionality to serve common needs, but that is not part of the core LocusZoom bundle. 

Each extension must be included separately into your site, after LocusZoom.js has been loaded.

## Dynamic URLs

### Description
The Dynamic URLs extension makes it possible to create easy sharing links to a plot. It provides a way to load the page at a specific view based on URL query params, and to update that URL as the user interacts with the plot. Clicking the back and forward buttons causes the plot to jump back to a previous view, enabling interactive experiences.

This works best with standard plots and common state parameters like chrom, start, and end. It is possible to serialize more complex behavior, but highly customized views (like dynamically adding panels) might not be a good fit for this extension. Some LocusZoom examples demonstrate how to use this extension.

### API
This extension is exposed as `LocusZoom.ext.DynamicUrls`, and contains three functions. In the most common case, this extension does the job of _serializing_ parameters to and from plot state, and updating the URL to match. All three functions accept a parameter **mapping**, which consists of `{plotFieldName: urlParamName}` entries. (both key and value should be unique) Any URL parameters not mentioned in the mapping will be ignored by LocusZoom.

For example, a mapping like `{chr: "chrom", start: "start", end: "end"}` would pull the corresponding parameters from `plot.state` to create a url like `?chrom=1&start=900&end=1000`.

- `paramsFromUrl(stateUrlMapping)`: This is useful when first loading a page. The result of this function can be used as the initial `plot.state` in order to load the page at a particular plot region.
- `plotUpdatesUrl(plot, mapping, [callback])`: Update the URL whenever the plot is re-rendered. By default, it only draws information from `plot.state`, but an optional third argument (a serialization function) can be passed to reflect additional information in the URL.
- `plotWatchesUrl(plot, mapping, [callback])`: Re-render the plot whenever the URL changes. This extension allows the browser "back" button to switch between plot views- a user can pan and zoom, and always be able to revert exactly to where they started. By default, the listener puts the URL parameters directly into `plot.state`, but a custom function can be passed to transform the plot in arbitrary ways. Extension

## Dashboard Addons Extension
### Description
This extension provides a number of toolbar widgets that are useful for demonstration purposes, but not actively in use by most standard LocusZoom deployments. These addons are provided as an extension file which must be loaded separately.

### Widgets provided
#### Covariates Model

Special version of the generic [Menu](#menu) component used for managing a list of covariate objects stored in the state. This provides a mechanism for capturing user click events, and persisting the results. (it does not perform calculations or make use of the selected covariates data) Example:

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

Adding this dashboard component to a plot will automatically create a `model` object in the [State](state.md) that contains an empty array called `covariates`, like so:

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

##### Supporting layouts
The Covariates model feature is designed to work with custom UI, in tandem with other features:

- Tooltip: `covariates_model_association` : A modified association-plot tooltip with an additional option to add this point to the covariates model

- Dashboard: `covariates_model_plot` : A custom dashboard layout that includes the covariates model button.

#### Data Layers (widget)
**Only for use in panel dashboards**
Controls the display of all data layers within a panel, with options to show/hide, change opacity,alter ordering, etc. This can be useful when layering many types of data, though in practice, the resulting visualization can be quite crowded; it is often simpler and cleaner to show datasets in separate stacked panels.

## Genome Legend Extension

The **`genome_legend`** Data Layer type implements a visualization of an entire human genome as a one-dimensional extent with alternating light/dark areas representing individual chromosomes (with proportional widths). This extension is no longer actively used in any examples, but has been preserved to support legacy usage.

### Custom display options

* **`chromosome_fill_colors`** - *Object*  
  Object with keys/values defining colors for `"light"` and `"dark"` for chromosome areas on the legend. Default value is `{ light: "rgb(155, 155, 188)", dark: "rgb(95, 95, 128)" }`.  

* **`chromosome_label_colors`** - *Object*  
  Object with keys/values defining colors for `"light"` and `"dark"` for chromosome area labels on the legend. Default value is `{ light: "rgb(120, 120, 186)", dark: "rgb(0, 0, 66)" }`.  

### Layouts provided
- Panel: `genome_legend`
- Data Layer: `genome_legend`

## Intervals Track Extension

The "genome intervals" track represents categorical [intervals](https://statgen.github.io/locuszoom/examples/interval_annotations.html). 
For example, it can be used to represent  such as chromatin state annotations derived from BED file data.

Intervals are rendered as simple positioned rectangles, colored by a key. They may be shown as a concise track 
(all intervals on one row) or in a split track mode (each interval separately). 

This extension provides a data layer, source, and sample layouts to work together. 

### Custom display options

* **`always_hide_legend`** - *Boolean*  
  Whether or not to always hide the conventional legend. By default (when this value is false), merging tracks together will hide any y-axis legend and show a conventional legend. Set this to true, however, to refrain from ever showing that conventional legend while still showing a y-axis-based legend in a split-track configuration. Defaults to `false`.  See notes below on how to specify the items in the legend.

* **`bounding_box_padding`** - *Number*  
  Single value in pixels to be used as top, bottom, left, and right padding from data displayed to represent a given gene to its bounding box. The bounding box is directly displayed when a gene is selected but is otherwise invisible, however it represents the "footprint" of a gene in the data layer when the data layer's render function positions genes on tracks such that none overlap. Thus, a larger `bounding_box_padding` will give genes more space during automatic positioning. Defaults to `2`.  

* **`color`** - *See general definition above, Scalable*  
  Defaults to `"#B8B8B8"`.  
  
* **`end_field`** - *String*  
  Field that represents an interval's end position..  

* **`fill_opacity`** - *See general definition above, Scalable*  
  Defaults to `1`.  

* **`split_tracks`** - *Boolean*  
  Whether to split tracks apart such that each category represented by the values of `track_split_field` for each interval datum gets its own track (true) or collapse all interval data to as few tracks as possible (false). Defaults to `true`.  

* **`start_field`** - *String*  
  Field (as defined in the `fields` array) that represents an interval's start position. Defaults to `"start"`.  

* **`track_height`** - *Number*  
  Height, in pixels, of each track when rendered. Defaults to `15`.  

* **`track_label_field`** - *String*  
  Field that represents the category in which a distinct interval falls into. This is used as the categorizing factor when splitting tracks by category. Defaults to `"state_name"`.  

* **`track_split_field`** - *String*  
  Field that represents the category in which a distinct interval falls into. This is used as the categorizing factor when splitting tracks by category. If the value is numeric, the categories will be arranged in numerical order. (otherwise, string values will be sorted lexicographically) Defaults to `"state_id"`.  

* **`track_split_legend_to_y_axis`** - *Number*  
  Y-axis number to use when splitting tracks and displaying a categorical legend as a y axis. Defaults to `2` (right side).  

* **`track_split_order`** - *String*  
  Direction to sort tracks when splitting them categorically - "ASC" for ascending and "DESC" for descending. Defaults to `"DESC"`.  

* **`track_vertical_spacing`** - *Number*  
  Vertical space between tracks, in pixels, in which nothing will be rendered. Defaults to `3`.  

### How to choose colors
This data layer is designed to select point colors in several ways, depending on what information is provided. In order of precedence, colors will be generated in one of three ways:

1. If all tracks are from the same source/ model, a hard-coded list of states can be provided, with a hard coded legend. This provides the best control over coloring because all datasets and regions are guaranteed to use the same color for the same concept. However, if your API uses data from many analyses, a single hard-coded list of options may not be suitable.
  - To use this option, a set of colors must be specified in both the `legend` and `color.categorical_bin` options for the layout. The syntax is a bit ungainly: in addition to normal legend options, an extra key must specify `track_label_field : "Label text"` for each legend item, eg:  `{shape: "rect", width: 9, label: "Heterochromatin / low signal", color: "rgb(212,212,212)", intervals:state_name: "Heterochromatin / low signal"}`

2. If a given track provides a BED-style `itemRgb` field with consistent color schemes, the plot will use these colors for the track. In that case, every point within that track is assumed to have a corresponding itemRgb value. This option provides stable coloring within a dataset, but comparisons may be fuzzier if a single source API compares data from multiple tools, because those tools may not have a shared standard color scheme.

3. If neither a legend, nor an itemRgb field, are present,then the plot will try to auto-generate a color scheme based on the source data given ("given 5 items, pick 5 corresponding colors").
Downside: it might select different colors for similar concepts across panels, or across chrom:start-end region displayed (eg panel A has 5 states in this span of data, panel B has 10...).

### Layouts provided
- Tooltip: *standard_intervals* : A simple description of start, end, and label.
- Data Layer: *intervals* : Draw an intervals track 
- Panel: *intervals* : A panel that shows the intervals track, plus "split tracks" toolbar button
- Plot: *intervals*: Display association data alongside interval annotations and gene information.

### Data sources provided
- *IntervalLZ* : A data source that fetches interval information according to the format of the [Portaldev API](https://portaldev.sph.umich.edu/docs/api/v1/#interval-annotations). Accepts url, and a single param (`source`).
* [Covariates Model](#covariates-model) 

## Tabix Source Extension
**Additional dependencies required**: [Tabix reader](https://www.npmjs.com/package/tabix-reader)

This extension provides a data source `TabixUrlSource` that loads data from a remote Tabix file, and parses each line using a user-provided function.
 
 This is useful for very simple user-provided datasets, where it might be desirable to use LocusZoom.js for simple region queries without needing to first write an entire REST API server. Note that the web server that hosts the files must be configured with proper CORS and Range header support- many providers (such as S3) do not do this by default.
 
A tabix-indexed dataset consists of two files: the data file (compressed with bgzip) and the tabix index. See the [tabix documentation](http://www.htslib.org/doc/tabix.html) for more information.

Data source config options:
- `parser_func`: **Function**
  A function that parses a single line of text and returns a structured object of data fields.
- `url_data`: **String**
  The URL for the data file, which must be bgzipped and tabix-indexed
- `url_tbi`: **String** (optional)
  The URL for the tabix index. If not provided, defaults to `url_data` + '.tbi'
- `params`: **Object**
  - overfetch: **Number** : Optionally fetch more data than is required to satisfy the region query. (specified as a fraction of the region size, 0-1) This can be useful for datasets that represent intervals, where one end of an interesting feature is slightly beyond the edge of the plot.
