---
title: Working with data
toc: true
toc-title: Table of Contents
---
# Overview
LocusZoom.js aims to provide reusable and highly customizable visualizations. Towards this goal, a separation of concerns is enforced between data adapters (data) and data layers (presentation).

# Your first plot: defining how to retrieve data
All data retrieval is performed by *adapters*: special objects whose job is to fetch the information required to render a plot. A major strength of LocusZoom.js is that it can connect several kinds of annotation from different places into a single view: the act of organizing data requests together is managed by an object called `LocusZoom.DataSources`.  Below is an example creating a "classic" LocusZoom plot, in which GWAS, LD, and recombination rate are overlaid on a scatter plot, with genes and gnomAD constraint information on another track below. In total, five API endpoints are used to create this plot; four standard datasets, and one user-provided summary statistics file.

```javascript
const apiBase = 'https://portaldev.sph.umich.edu/api/v1/';
const data_sources = new LocusZoom.DataSources()
    .add('assoc', ['AssociationLZ', {url: apiBase + 'statistic/single/', params: { source: 45, id_field: 'variant' }}])
    .add('ld', ['LDServer', { url: 'https://portaldev.sph.umich.edu/ld/', source: '1000G', population: 'ALL', build: 'GRCh37' }])
    .add('recomb', ['RecombLZ', { url: apiBase + 'annotation/recomb/results/', build: 'GRCh37' }])
    .add('gene', ['GeneLZ', { url: apiBase + 'annotation/genes/', build: 'GRCh37' }])
    .add('constraint', ['GeneConstraintLZ', { url: 'https://gnomad.broadinstitute.org/api/', build: 'GRCh37' }]);
```

Of course, defining datasets is only half the problem; see the [Getting Started Guide](index.html) for how to define rendering instructions (layout) and combine these pieces together to create the LocusZoom plot.

## Understanding the example
In the example above, a new data source is added via a line of code such as the following:

```javascript
data_sources.add('assoc', ['AssociationLZ', {url: apiBase + 'statistic/single/', params: { source: 45, id_field: 'variant' }}]);
```

A lot is going on in this line!

* `data_sources.add` defines a piece of information that *could* be used by the plot. (if no layout asks for data from this source, then no API request will ever be made)
* The first argument to the function is a *namespace name*. It is an arbitrary reference to this particular piece of data. For example, you might want to plot three association studies together in the same window, and they could be defined as `.add('mystudy', ...)`, `.add('somephenotype', ...)`, `.add('founditinthegwascatalog', ...)`
  * In the [layouts guide](rendering_layouts.html), we will see how `data_layer.fields` uses these namespaces to identify what data to render.
* The second argument to the function is a list of values: the name of a [predefined adapter](../api/module-LocusZoom_Adapters.html) that defines how to retrieve this data, followed by an object of  configuration options (like url and params) that control which data will be fetched. Each type of data has its own options; see the documentation for a guide to available choices.
  * You are not limited to the types of data retrieval built into LocusZoom.js. See "creating your own adapter" for more information.

## What should the data look like?
In theory, LocusZoom.js can display whatever data it is given: layouts allow any individual layout to specify what fields should be used for the x and y axes.

In practice, it is much more convenient to use pre-existing layouts that solve a common problem well out of the box: the set of options needed to control point size, shape, color, and labels is rather verbose, and highly custom behaviors entail a degree of complexity that is not always beginner friendly. For basic LocusZoom.js visualizations, our default layouts assume that you use the field names and format conventions defined in the [UM PortalDev API docs](https://portaldev.sph.umich.edu/docs/api/v1/). This is the quickest way to get started.

Most users will only need to implement their own way of retrieving GWAS summary statistics; the other annotations are standard datasets and can be freely used from our public API. For complex plots (like annotations of new data), see our [example gallery](https://statgen.github.io/locuszoom).

# How data gets to the plot
If you are building a custom tool for exploring data, it is common to show the same data in several ways (eg, a LocusZoom plot next to a table of results). The user will have a better experience if the two widgets are synchronized to always show the same data, which raises a question: which widget is responsible for making the API request?

In LocusZoom.js, the user is allowed to change the information shown via mouse interaction (drag or zoom to change region, change LD calculations by clicking a button... etc). This means that LocusZoom must always be able to ask for the data it needs, and initiate a new API request if necessary: a *pull* model. This contrasts with static plotting libraries like R which show whatever data they are given (a *push* approach).

The act of contacting an external data repository, and fetching the information needed, is coordinated by *Adapters*. It is possible to share data with other widgets on the page via event callbacks, so that those widgets retrieve the newest data whenever the plot is updated (see `subscribeToData` in the [guide to interactivity](interactivity.html) for details).

## Not every web page requires an API
LocusZoom.js is designed to work well with REST APIs, but you do not need to create an entire web server just to render a single interactive plot. As long as the inputs can be transformed into a recognized format, they should work with the plot.

Some examples of other data retrieval mechanisms used in the wild are:

* Loading the data from a static JSON file (this can be as simple as giving the URL of the JSON file, instead of the URL of an API server!). Many bioinformaticians are comfortable converting between text files, so this is a low-effort way to get started... but static files always return the same data, and they return all of it at once. This can be limiting for big datasets or "jump to region" style interactivity.
* Fetching the data from a Tabix-indexed file in an Amazon S3 bucket (via the [lz-tabix-source](../api/module-ext_lz-tabix-source.html) plugin; you will need to write your own function that parses each line into the required data format). This is exactly how our chromatin coaccessibility demo works!
* Loading the data into a "shared global store" that acts as a middle layer for API calls, and asking LocusZoom to query the store instead of contacting a REST API directly. (example: Vuex for a reactive single-page application) This is relatively advanced, but it can be useful if many page widgets need to coordinate and share a lot of data that frequently changes.

## Example: Loading data from static JSON files
One way to make a LocusZoom plot quickly is to load the data for your region in a static file, formatted as JSON objects to look like the payload from our standard REST API. The key concept below is that instead of a server, the URL points to the static file. This demonstration is subject to the limits described above, but it can be a way to get started. 

```javascript
data_sources = new LocusZoom.DataSources()
    .add("assoc", ["AssociationLZ", {url: "assoc_10_114550452-115067678.json", params: {source: null}}])
    .add("ld", ["LDLZ", { url: "ld_10_114550452-115067678.json" }])
    .add("gene", ["GeneLZ", { url: "genes_10_114550452-115067678.json" }])
    .add("recomb", ["RecombLZ", { url: "recomb_10_114550452-115067678.json" }])
    .add("constraint", ["GeneConstraintLZ", {  url: "constraint_10_114550452-115067678.json" }]);
```

## What if my data doesn't fit the expected format?
The built-in adapters are designed to work with a specific set of known REST APIs and fetch data over the web, but we provide mechanisms to customize every aspect of the data retrieval process, including how to construct the query sent to the server and how to modify the fields returned. See the guidance on "custom adapters" below.

In general, the more similar that your field names are to those used in premade layouts, the easier it will be to get started with common tasks. Certain features require additional assumptions about field format, and these sorts of differences may cause behavioral (instead of cosmetic) issues. For example:

* In order to fetch LD information relative to a specific variant, the data in the summary statistics must provide the variant name as a single string that combines chromosome, position, reference, and alt allele, like `1:12_A/C`. Our builtin LD adapter tries to handle the common marker formats from various programs and normalize them into a format that the LD server will understand, but we cannot guess everything. Following the order of values and using a known format will ensure best results.
* JavaScript is not able to accurately represent very small pvalues (numbers smaller than ~ 5e-324), and will truncate them to 0, changing the meaning of your data. For this reason, we recommend sending your data to the web page already transformed to -log pvalue format; this is much less susceptible to problems with numerical underflow.

# Creating your own custom adapter
## Re-using code via subclasses
Most custom sites will only need to change very small things to work with their data. For example, if your REST API uses the same payload format as the UM PortalDev API, but a different way of constructing queries, you can change just one function and define a new data adapter:

```javascript
const AssociationLZ = LocusZoom.Adapters.get('AssociationLZ');
class CustomAssociation extends AssociationLZ {
    getURL(state, chain, fields) {
        // The inputs to the function can be used to influence what query is constructed. Eg, the current view region is stored in `plot.state`.
        const {chr, start, end} = state;
        // Fetch the region of interest from a hypothetical REST API that uses query parameters to define the region query, for a given study URL `/gwas/<id>/`
        return `${this.url}/${this.params.study_id}/?chr=${encodeURIComponent(chr)}&start=${encodeURIComponent(start)}&end${encodeURIComponent(end)}`
  }
}
// A custom adapter should be added to the registry before using it
LocusZoom.Adapters.add('TabixAssociationLZ', TabixAssociationLZ);

// From there, it can be used anywhere throughout LocusZoom, in the same way as any built-in adapter
data_sources.add('mystudy', ['CustomAssociation', {url: 'https://data.example/gwas', params: { study_id: 42 }}]);
```

In the above source, an HTTP GET request will be sent to the server every time that new data is requested. If further control is required (like sending a POST request with custom body), you may need to override additional methods such as [fetchRequest](../api/module-LocusZoom_Adapters-BaseAdapter.html#fetchRequest). See below for more information, then consult the detailed developer documentation for details.

Common types of data retrieval that are most often customized:

* GWAS summary statistics
  * This fetches the data directly with minor cleanup. You can customize the built-in association adapter, or swap in another way of fetching the data (like tabix).
* User-provided linkage disequilibrium (LD)
  * This contains special logic used to combine association data (from a previous request) with LD information. To ensure that the matching code works properly, we recommend matching the payload format of the public LDServer, but you can customize the `getURL` method to control where the data comes from.
* PheWAS results

## What happens during a data request?
The adapter performs many functions related to data retrieval: constructing the query, caching to avoid unnecessary network traffic, and parsing the data into a transformed representation suitable for use in rendering.

 Methods are provided to override all or part of the process, called in roughly the order below:

```javascript
getData(state, fields, outnames, transformations)
    getRequest(state, chain, fields)
	    getCacheKey(state, chain, fields)
		fetchRequest(state, chain, fields)
		    getURL(state, chain, fields)
    parseResponse(resp, chain, fields, outnames, transformations)
	    normalizeResponse(data)
    	annotateData(data, chain)
	    extractFields(data, fields, outnames, trans)
	    combineChainBody(data, chain, fields, outnames)
```

The parameters passed to getData are as follows:

* state - this is the current "state" of the plot. This contains information about the current region in view (`chr`, `start`, and `end`), which is often valuable in querying a remote data source for the data in a given region.
* fields - this is an array of field names that have been requested from this data source. Note that the "namespace:" part of the name has been removed in this array. Note: **most data adapters will return *only* the fields that are requested by a data layer**. Each data layer can request a different set of fields, and thus **different parts of the plot may have a different view of the same data.**
* outnames - this is an array with length equal to fields with the original requested field name. This value contains the data source namespace. The data output for each field should be given the name in this array. This is rarely used directly.
* transformations - this is an array with length equal to fields with the collection of value transformations functions specified by the user to be run on the returned field. This is rarely used directly.

### Step 1: Fetching data from a remote server
The first step of the process is to retrieve the data from an external location. `getRequest` is responsible for deciding whether the query can be satisfied by a previously cached request, and if not, sending the response to the server. At the conclusion of this step, we typically have a large unparsed string: eg REST APIs generally return JSON-formatted text, and tabix sources return lines of text for records in the region of interest.

Most custom data sources will focus on customizing two things:

* getURL (how to ask the external source for data)
* getCacheKey (decide whether the request can be satisfied by local data)
  * By default this returns a string based on the region in view: `'${state.chr}_${state.start}_${state.end}'`
  * You may need to customize this if your source has other inputs required to uniquely define the query (like LD reference variant, or calculation parameters for credible set annotation). 
  
### Step 2: Formatting and parsing the data
The `parseResponse` sequence handles the job of parsing the data. It can be used to convert many different API formats into a single standard form. There are four steps to the process:

* `normalizeResponse` - Converts any data source response into a standard format. This can be used when you want to take advantage of existing data transformation functionality of a particular adapter (like performing an interesting calculation), but your data comes from something like a tabix file that needs to be transformed first.
  * Internally, most data layer rendering types assume that data is an array, with each data element represented by an object: `[{a_field: 1, other_field: 1}]`
  * Some sources, such as the UM PortalDev API, represent the data in a column-oriented format instead. (`{a_field: [1], other_field: [1]}`) The default adapter will attempt to detect this and transform those columns into the row-based one-record-per-datum format.
* `annotateData` - This can be used to add custom calculated fields to the data. For example, if your data source does not provide a variant marker field, one can be generated in javascript (by concatenating chromosome:position_ref/alt), without having to modify the web server.
* `extractFields` - Each data layer receives only the fields it asks for, and the data is  reformatted in a way that clearly identifies where they come from (the namespace is prefixed onto each field name, eg `{'mynamespace:a_field': 1}`).
  * The most common reason to override this method is if the data uses an extremely complex payload format (like genes), and a custom data layer expects to receive that entire structure as-is. If you are working with layouts, the most common sign of an adapter that does this is that the data layer asks for a nonexistent field (`genes:all`: a synthetic field because data is only retrieved if at least one field is used)
* `combineChainBody`: If a single data layer asks for data from more than one source, this function is responsible for combining several different pieces of information together. For example, in order to show an association plot with points colored by LD, the LD adapter implements custom code that annotations the association data with matching LD information. At the end of this function, the data layer will receive a single combined record per visualized data element. 

#### Working with the data "chain"
Each data layer is able to request data from multiple different sources. Internally, this process is referred to as the "chain" of linked data requested. LocusZoom.js assumes that every data layer is independent and decoupled: it follows that each data layer has its own chain of requests and its own parsing process.  

This chain defines how to share information between different adapters. It contains of two key pieces:

* `body`: the actual consolidated payload. Each subsequent link in the chain receives all the data from the previous step as `chain.body`
* `headers`: this is a "meta" section used to store information used during the consolidation process. For example, the LD adapter needs to find the most significant variant from the previous step in the chain (association data) in order to query the API for LD. The name of that variant can be stored for subsequent use during the data retrieval process.

Only `chain.body` is sent to the data layer. All other parts of the chain are discarded at the end of the data retrieval process.

# See also
LocusZoom.js is able to share its data with external widgets on the page, via event listeners that allow those widgets to update whenever the user interacts with the plot (eg panning or zooming to change the region in view). See `subscribeToData` in the [guide to interactivity](interactivity.html) for more information.  
