---
title: Working with data
toc: true
toc-title: Table of Contents
---
# Overview
LocusZoom.js aims to provide reusable and highly customizable visualizations. Towards this goal, a separation of concerns is enforced between data adapters (data) and data layers (presentation).

# Your first plot: defining how to retrieve data
All data retrieval is performed by *adapters*: special objects whose job is to fetch the information required to render a plot. A major strength of LocusZoom.js is that it can connect several kinds of annotation from different places into a single view: the act of organizing data requests together is managed by an object called `LocusZoom.DataSources`.  

Below is an example that defines how to retrieve the data for a "classic" LocusZoom plot, in which GWAS, LD, and recombination rate are overlaid on a scatter plot, with genes and gnomAD constraint information on another track below. In total, five REST API endpoints are used to create this plot: four standard datasets, and one user-provided summary statistics file.

```javascript
const apiBase = 'https://portaldev.sph.umich.edu/api/v1/';
const data_sources = new LocusZoom.DataSources()
    .add('assoc', ['AssociationLZ', {url: apiBase + 'statistic/single/', source: 45, id_field: 'variant' }])
    .add('ld', ['LDServer', { url: 'https://portaldev.sph.umich.edu/ld/', source: '1000G', population: 'ALL', build: 'GRCh37' }])
    .add('recomb', ['RecombLZ', { url: apiBase + 'annotation/recomb/results/', build: 'GRCh37' }])
    .add('gene', ['GeneLZ', { url: apiBase + 'annotation/genes/', build: 'GRCh37' }])
    .add('constraint', ['GeneConstraintLZ', { url: 'https://gnomad.broadinstitute.org/api/', build: 'GRCh37' }]);
```

Of course, defining datasets is only half of the process; see the [Getting Started Guide](index.html) for how to define rendering instructions (layout) and combine these pieces together to create the LocusZoom plot.

## Understanding the example
In the example above, a new data source is added via a line of code such as the following:

```javascript
data_sources.add('assoc', ['AssociationLZ', {url: apiBase + 'statistic/single/', source: 45, id_field: 'variant' }]);
```

A lot is going on in this line!

* `data_sources.add` defines a piece of information that *could* be used by the plot. (if no data layer asks for data from this source, then no API request will ever be made)
* The first argument to the function is a *namespace name*. It is an arbitrary reference to this particular piece of data. For example, you might want to plot three association studies together in the same window, and they could be defined as `.add('mystudy', ...)`, `.add('somephenotype', ...)`, `.add('founditinthegwascatalog', ...)`
  * In the [layouts guide](rendering_layouts.html), we will see how **data layers** use these namespaces.
* The second argument to the function is a list of values: the name of a [predefined adapter](../api/module-LocusZoom_Adapters.html) that defines how to retrieve this data, followed by an object of  configuration options (like url and source) that control which data will be fetched. Each type of data has its own options; see the documentation for a guide to available choices.
  * You are not limited to the types of data retrieval built into LocusZoom.js. See "creating your own adapter" for more information.

## The importance of genome build
You may notice that in the example above, many of the datasets specify `build: 'GRCh37`. For "standard" datasets that are widely used (LD, genes, recombination, and GWAS catalog), the UMich APIs will automatically try to fetch the most up-to-date list of genes and GWAS catalog entries for the specified genome build. We currently support build `GRCh37` and `GRCh38`. Be sure to use the genome build that matches your dataset.

We periodically update our API server. If you think new information is missing, please let us know.

## What should the data look like?
In theory, LocusZoom.js can display whatever data it is given: layouts allow any individual layer to specify what fields should be used for the x and y axes.

In practice, it is much more convenient to use pre-existing layouts that solve a common problem well out of the box: the set of options needed to control point size, shape, color, and labels is rather verbose, and highly custom behaviors entail a degree of complexity that is not always beginner friendly. For basic LocusZoom.js visualizations, our default layouts assume that you use the field names and format conventions defined in the [UM PortalDev API docs](https://portaldev.sph.umich.edu/docs/api/v1/). This is the quickest way to get started. Most layouts in the provided `LocusZoom.Layouts` registry will tell you what fields are expected (via the `_auto_fields` property), and most plots will log a console error message if the response is missing expected information.

Most users will only need to implement their own way of retrieving GWAS summary statistics; the other annotations are standard datasets and can be freely used from our public API. For complex plots (like annotations of new data), see our [example gallery](https://statgen.github.io/locuszoom).

# How data gets to the plot
If you are building a custom tool for exploring data, it is common to show the same data in several ways (eg, a LocusZoom plot next to a table of results). The user will have a better experience if the two widgets are synchronized to always show the same data, which raises a question: which widget is responsible for making the API request?

In LocusZoom.js, the user is allowed to change the information shown via mouse interaction (drag or zoom to change region, change LD calculations by clicking a button... etc). This means that LocusZoom must always be able to ask for the data it needs, and initiate a new request to the repository if the required data is not available locally: a *pull* approach. This contrasts with static plotting libraries like matplotlib or excel that render whatever data they are given initially (a *push* approach).

The act of contacting an external data repository, and fetching the information needed, is coordinated by *Adapters*. It is possible to share data with other widgets on the page via event callbacks, so that those widgets retrieve the newest data whenever the plot is updated (see `subscribeToData` in the [guide to interactivity](interactivity.html) for details).

## Not every web page requires an API
LocusZoom.js is designed to work well with REST APIs, but you do not need to create an entire web server just to render a single interactive plot. As long as the inputs can be transformed into a recognized format, they should work with the plot.

Some examples of other data retrieval mechanisms used in the wild are:

* Loading the data from a static JSON file (this can be as simple as giving the URL of the JSON file, instead of the URL of an API server!). Many bioinformaticians are comfortable converting between text files, so this is a low-effort way to get started... but static files always return the same data, and they return all of it at once. This can be limiting for big datasets or "jump to region" style interactivity.
* Fetching the data from a Tabix-indexed file in an Amazon S3 bucket (see the [lz-tabix-source plugin example](../api/module-ext_lz-tabix-source.html); you will need to write your own function that parses each line into the required data format). This is exactly how our chromatin coaccessibility demo works!
* Loading the data into a "shared global store" that acts as a middle layer for API calls, and asking LocusZoom to query the store instead of contacting a REST API directly. (example: Vuex for a reactive single-page application) This is relatively advanced, but it can be useful if many page widgets need to share a lot of data that frequently changes in response to user interaction. (such as performing an analysis after selecting a list of variants from a table)

### Example: Loading data from static JSON files
One way to make a LocusZoom plot quickly is to load the data for your region in a static file, formatted as JSON objects to look like the payload from our standard REST API. The key concept below is that instead of a server, the URL points to the static file. This demonstration is subject to the limits described above, but it can be a way to get started. 

```javascript
data_sources = new LocusZoom.DataSources()
    .add("assoc", ["AssociationLZ", {url: "assoc_10_114550452-115067678.json", params: {source: null}}])
    .add("ld", ["LDLZ", { url: "ld_10_114550452-115067678.json" }])
    .add("gene", ["GeneLZ", { url: "genes_10_114550452-115067678.json" }])
    .add("recomb", ["RecombLZ", { url: "recomb_10_114550452-115067678.json" }])
    .add("constraint", ["GeneConstraintLZ", {  url: "constraint_10_114550452-115067678.json" }]);
```

## Mix and match
Each data adapter in the chain is largely independent, and it is entirely normal to mix data from several sources: for example, GWAS data from a tabix file alongside genes data from the UMich API server.

If a single data layer needs to combine two kinds of data (eg association and LD), you will achieve the best results if the sources have some common assumptions about data format. Adapters are highly modular, but because they do not enforce a specific contract of field names or payload structure, you are responsible for ensuring that the resulting data works with the assumptions of your layout. 

## Every layer has its own, private, view of the data
Each data layer in LocusZoom is intended to be independent of others. Thus, each layer must individually specify its own way to connect data together.

Likewise, each layer defines a "local" way of identifying where to find the data it needs. For example, consider a layer layout as follows:

```javascript
{
  namespace: {'assoc': 'mystudy'},
  id_field: 'assoc:variant'
}
```

The `namespace` is specified as a key-value pair of *local_name: global_data_source_name*. This instruction says: "whenever this layer asks for something from assoc, make a request to an item named mystudy". Every field in the layout refers to the local_name. This layer of indirection allows a layout to be used many times to plot different datasets, and only the namespace needs to be changed.

Any changes made to the data within one layer should not affect copies of the same data in other places. This property makes it easier to display the same data in two different ways, without having to make a duplicate network request.

## What if my data doesn't fit the expected format?
The built-in adapters are designed to work with a specific set of known REST APIs and fetch data over the web, but we provide mechanisms to customize every aspect of the data retrieval process, including how to construct the query sent to the server and how to modify the fields returned. See the guidance on "custom adapters" below.

In general, the more similar that your field names are to those used in premade layouts, the easier it will be to get started with common tasks. Certain features require additional assumptions about field format, and these sorts of differences may cause behavioral (instead of cosmetic) issues. For example:

* In order to fetch LD information relative to a specific variant, the data in the summary statistics must provide the variant name as a single string that combines chromosome, position, reference, and alt allele, like `1:12_A/C`. Our builtin LD adapter tries to handle the common marker formats from various programs and normalize them into a format that the LD server will understand, but we cannot guess everything. Following the order of values and using a known format will ensure best results.
* JavaScript is not able to accurately represent very small pvalues (numbers smaller than ~ 5e-324), and will truncate them to 0, changing the meaning of your data. For this reason, we recommend sending your data to the web page already transformed to -log pvalue format; this is much less susceptible to problems with numerical underflow.

If the only difference is field names, you can customize the layout to tell it where to find the required information. (see: [guide to layouts and rendering](rendering_layouts.html) for details) [Transformation functions](../api/module-LocusZoom_TransformationFunctions.html) (like `neglog10`) can then be used to ensure that custom data is formatted in a way suitable for rendering and plotting.

## Combining two kinds of data in one place
Sometimes, a single data layer will depend on information from two different sources (like an association plot colored by LD information).

### Data operations (layout directive)
The act of combining two pieces of data is performed by *data operations*. In order to let the same piece of data be rendered in different ways, these instructions are placed within each data layer layout. *The decision on how to combine two pieces of information is specified at the point where the data is used*.

A sample layout directive for data operations would be as follows:

```javascript
{
    namespace: { 'assoc': 'mystudy', 'ld': 'some_ld' },
    data_operations: [
        {
            type: 'fetch',
            from: ['assoc', 'ld(assoc)'],
        },
        {
            type: 'left_match',
            name: 'assoc_plus_ld',
            requires: ['assoc', 'ld'],
            // Tell the join function which field names to be used for the join. Each join function has its own possible parameters.
            params: ['assoc:position', 'ld:position2'], 
        },
    ]
}
```

#### Dependencies
The first instruction in the example above specifies how to retrieve the data: `{type: 'fetch', from: ['assoc', 'ld(assoc)'}` 

A single "fetch" operation is used to specify all of the data retrieval. This specifies what information a data layer should retrieve. It refers to the "local" namespace name (like "assoc"), and tells locuszoom to make a request to the global datasource named "mystudy".

Some adapters can not begin to define their request until they see the data from another adapter: eg LD information is retrieved relative to the most significant association variant in the region. This is a *dependency*, and one (or more) dependencies can be specified using the syntax `some_request(first_dependency, nth_dependency)`. LocusZoom will automatically reorder and parallelize requests based on the dependencies given. If several requests each have no dependencies, they will be performed in parallel.

Each individual adapter will receive data it depends on as a function argument to `getData`. The string syntax reflects how the data is connected internally!  In the example above, "ld" is only retrieved after a request to "assoc" is complete, and the LD adapter received the assoc data to help define the next request.

> NOTE: Sometimes it is useful to extend an existing layout to fetch additional kinds of data. It can be annoying to extend a "list" field like fetch.from, so LocusZoom has some magic to help out: if an item is specified as a source of data for this layer (eg `namespace: {'assoc': 'assoc'}`), it will automatically be added to the `fetch.from` instruction. This means that **everything listed in `data_layer.namespace` will trigger a data retrieval request**. You only need to modify the contents of `fetch.from` if you want to specify that the new item depends on something else, eg "don't fetch LD until assoc data is ready: `ld(assoc)`". All of the built in LZ layouts are verbose and explicit, in an effort to reduce the amount of "magic" and make the examples easier to understand.

#### Joins ("Data functions")
The second instruction in the example above is a *join*. It specifies how to compare multiple sets of data into one list of records ("one record per data point on the plot").

Any function defined in `LocusZoom.DataFunctions` can be referenced. Several builtin joins are provided (including `left_match`, `inner_match`, and `full_outer_match`). Any arbitrary join function can be added to the `LocusZoom.DataFunctions` registry, with the call signature `({plot_state, data_layer}}, [recordsetA, recordsetB...], ...params) => combined_results`.

Data operations are synchronous; they are used for data formatting and cleanup. Use adapters for asynchronous operations like network requests.

The plot will receive the last item in the dependency graph (taking into account both adapters and joins). If something looks strange, make sure that you have specified how to join all your data sources together.

> TIP: Because data functions are given access to plot.state and the data layer instance that initiated the request, they are able to do surprisingly powerful things, like filtering the returned data in response to a global plot_state parameter or auto-defining a layout (`data_layer.layout`) in response to dynamic data (axis labels, color scheme, etc). This is a very advanced usage and has the potential for side effects; use sparingly! See the LocusZoom unit tests for a few examples of what is possible.

# Creating your own custom adapter
## Can I reuse existing code?
The built-in LocusZoom adapters can be used as-is in many cases, so long as the returned payload matches the expected format. You may need to write your own custom code (adapter subclass) in the following scenarios:

1. If an expression must be evaluated in order to retrieve data (eg constructing URLs based on query parameters, or LD requests where the reference variant is auto-selected from the most significant hit in a GWAS)
2. If the actual headers, body, or request method must be customized in order to carry out the request. This happens when data is retrieved from a particular technology (REST vs GraphQL vs Tabix), or if the request must incorporate some form of authentication credentials.
3. If some of the fields in your custom API format need to be transformed or renamed in order to match expectations in LZ code. For example, the LD adapter may try to suggest an LD reference variant by looking for the GWAS variant with the largest `log_pvalue`. (over time, built-in LZ adapters trend towards being more strict about field names; it is easier to write reliable code when not having to deal with unpredictable data!)

## Re-using code via subclasses
Most custom sites will only need to change very small things to work with their data. For example, if your REST API uses the same payload format as the UM PortalDev API, but a different way of constructing queries, you can change just one function and define a new data adapter:

```javascript
const AssociationLZ = LocusZoom.Adapters.get('AssociationLZ');
class CustomAssociation extends AssociationLZ {
    _getURL(request_options) {
        // Every adapter receives the info from plot.state, plus any additional request options calculated/added in the function `_buildRequestOptions`
      // The inputs to the function can be used to influence what query is constructed. Eg, since the current view region is stored in `plot.state`:
        const {chr, start, end} = request_options;
        // Fetch the region of interest from a hypothetical REST API that uses query parameters to define the region query, for a given study URL such as `data.example/gwas/<id>/?chr=_&start=_&end=_`
        return `${this._url}/${this.source}/?chr=${encodeURIComponent(chr)}&start=${encodeURIComponent(start)}&end${encodeURIComponent(end)}`
  }
}
// A custom adapter should be added to the registry before using it
LocusZoom.Adapters.add('CustomAssociation', CustomAssociation);

// From there, it can be used anywhere throughout LocusZoom, in the same way as any built-in adapter
data_sources.add('mystudy', ['CustomAssociation', {url: 'https://data.example/gwas', source: 42 }]);
```

In the above example, an HTTP GET request will be sent to the server every time that new data is requested. If further control is required (like sending a POST request with custom body), you may need to override additional methods such as [fetchRequest](../api/module-LocusZoom_Adapters-BaseLZAdapter.html#_performRequest). See below for more information, then consult the detailed developer documentation for details.

Common types of data retrieval that are most often customized:

* GWAS summary statistics
  * This fetches the data directly with minor cleanup. You can customize the built-in association adapter, or swap in another way of fetching the data (like tabix). You may want to ensure that a field called `log_pvalue` is present, and possibly customize other fields as well.
* PheWAS results (not every server returns PheWAS results in the same format)

## What happens during a data request?
The adapter performs many functions related to data retrieval: constructing the query, caching to avoid unnecessary network traffic, and parsing the data into a transformed representation suitable for use in rendering.

 Methods are provided to override all or part of the process, called in roughly the order below:

```javascript
getData(plot_state, ...dependent_data)
    _buildRequestOptions(plot_state, ...dependent_data)
    _getCacheKey(request_options)
    _performRequest(request_options)
        _getURL(request_options)
    // Parse JSON, convert columnar data to rows, etc
    _normalizeResponse(raw_response, options)
        cache.add(records)
    // User-specified cleanup of the parsed response fields. Can be used for things like field renaming, record filtering, or adding new calculated fields on the fly
    _annotateRecords(records, options)
    // Usually not overridden: this method can be used to apply prefixes (assoc:id, catalog:id, etc) and to simplify down verbose responses to just a few `limit_fields` of interest
    _postProcessResponse(records, options)
```

The parameters passed to getData are as follows:

* `plot_state`: Every adapter request contains a copy of `plot.state`, which stores global information (like view region chr/start/end) that can be used to customize the request.
* `...dependent_data`: If the adapter depends on prior requests, the parsed records from each prior request will be passed to this function (each function argument would be one dependent request, represented as an array of row-based record objects: `[{'assoc:variant': '1:23_A/C', 'assoc:log_pvalue': 75 }]`)

This function will return row-format data representing the response for just that request. It will use a cached response if feasible. By default, LocusZoom will apply certain transformation to the returned response so that it is easier to use with a data layer (see adapter documentation for details). All fields in the original response will be returned as given.

### Step 1: Fetching data from a remote server and converting to records
The first step of the process is to retrieve the data from an external location. `_buildRequestOptions` can be used to store any parameters that customize the request, including information from `plot.state`. If the response is cached, the cache value will be returned; otherwise, a request will be initiated. Once the request is complete, the result will be parsed and cached for future use.

At the conclusion of this step, we typically have an array of records, one object per row of data. The field names and contents are very close to what was returned by the API.

Most custom data sources will focus on customizing two things:

* `_getURL` (how to ask the external source for data)
* `_getCacheKey` (decide whether the request can be satisfied by local data)
  * By default this returns a string based on the region in view: `'${state.chr}_${state.start}_${state.end}'`
  * You may need to customize this if your source has other inputs required to uniquely define the query (like LD reference variant, or calculation parameters for credible set annotation). 
  
### Step 2: Transforming data into a form usable by LocusZoom
In a prior step, the records were normalized, but kept in a form that is usually close to what the API returned. In this step, records are modified for use in the plot:

* `_normalizeResponse` - Converts any data source response into a standard format. This can be used when you want to take advantage of existing data handling functionality of a particular adapter (like performing an interesting calculation), but your data comes from something like a tabix file that needs to be adjusted to match the expected format.
  * Internally, most data layer rendering types assume that data is an array, with each datum element represented by an object: `[{a_field: 1, other_field: 1}]`
  * Some sources, such as the UM PortalDev API, represent the data in a column-oriented format instead. (`{a_field: [1], other_field: [1]}`) The default adapter will attempt to detect this and automatically transform those columns into the row-based one-record-per-datum format.
* `_annotateRecords` - This can be used to modify the data returned in many useful ways: filtering, renaming fields, or adding new calculated fields. Example scenarios:
  * A field called `pValue` can be transformed into one called `log_pvalue`
  * If a tabix file returns two categories of data at once, then the adapter could decide which to show according to a user-selected option stored in `plot.state` (So long as both datasets are not too big, this trick works well with the `set_state` toolbar widget: it provides a cheap way to toggle between datasets, without requiring an extra trip to the server!)
  * Adding custom calculated fields to the data. For example, if your data source does not provide a variant marker field, one can be generated in javascript (by concatenating chromosome:position_ref/alt), without having to modify the web server.
* `_postProcessResponse`: Most people don't customize this method. After all calculations are done, this is used to transform the data into a format useful by LocusZoom. Eg, field names are prefixed to reflect where the data came from, like `assoc:log_pvalue`. This happens last, so most custom code that modifies returned records doesn't have to deal with it. 
  * Most of the behaviors in this method can be overridden using adapter options, without writing custom code. (see documentation for details)
  

# See also
* LocusZoom.js is able to share its data with external widgets on the page, via event listeners that allow those widgets to update whenever the user interacts with the plot (eg panning or zooming to change the region in view). See `subscribeToData` in the [guide to interactivity](interactivity.html) for more information.  
* If you are ready to go deeper, see the [detailed API documentation](../api/), describing all the data adapters and configuration options available.
