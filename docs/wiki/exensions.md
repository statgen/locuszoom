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
- `plotWatchesUrl(plot, mapping, [callback])`: Re-render the plot whenever the URL changes. This extension allows the browser "back" button to switch between plot views- a user can pan and zoom, and always be able to revert exactly to where they started. By default, the listener puts the URL parameters directly into `plot.state`, but a custom function can be passed to transform the plot in arbitrary ways.
