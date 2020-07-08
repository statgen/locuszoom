> [[API Reference|Home]] ▸ **Data Sources**

# Data Sources

LocusZoom is designed to pull together data from different data sources and merge it together before plotting. LocusZoom is initialized with a `DataSources` object which contains a collection of `DataSource` objects with a unique namespace string. These `DataSource` objects are typically pulled from the `KnownDataSources` collection. Data retrieval is managed by the `DataRequestor` object internally within the LocusZoom object.

## Known Data Sources

LocusZoom comes with objects that are set up to handle data that conform to our [data sharing API](http://portaldev.sph.umich.edu/docs/api/v1/). For the different endpoints described  in the documentation, we have create objects that will take care of forming request and parsing the response data. These objects are managed by the `LocusZoom.KnownDataSources` object.

| Class Name | Short Name |
| ---- | ---- |
| LocusZoom.Data.AssociationSource | "AssociationLZ" |
| LocusZoom.Data.LDSource | "LDLZ" |
| LocusZoom.Data.LDSource2 | "LDLZ2" |
| LocusZoom.Data.GeneSource | "GeneLZ" |
| LocusZoom.Data.RecombinationRateSource | "RecombLZ" |
| LocusZoom.Data.IntervalSource | "IntervalLZ" |
| LocusZoom.Data.StaticSource | "StaticJSON" |
| LocusZoom.Data.PheWASSource | "PheWASLZ" |

You can either create objects using the full class name

	# use "new" here
    var ds = new LocusZoom.Data.AssociationSource("http://url.com")
	
or you can create them from the `LocusZoom.KnownDataSources` object using the short name

	# these will produce the same results
    var ds = LocusZoom.KnownDataSources.create("AssociationLZ", "http://url.com")
	# or, using "new"
	var ds = new (LocusZoom.KnownDataSources.get("AssociationLZ"))("http://url.com")

You may notice that there are two choices for LD source. This is because the original API has been replaced with the Michigan [LDServer](https://github.com/statgen/LDServer). The old source was preserved for backwards compatibility, but the `LDLZ2` source is compatible with the new API (including standalone LDServer installations).
	
We discuss how to create your own data sources below.

## Specifying Data Sources For Your Plot

LocusZoom requires you to define a collection of data sources so it knows where to retrieve your data from. Those data sources are stored in a `LocusZoom.DataSources` collection. You can create such a collection

    var data_sources = new LocusZoom.DataSources();

These data source collections are designed to associate a data "namespace" to a data source object. This namespace will be used to identify which data source different fields should be retrieved from.

You can either add an initialized data source object or you can pass in an array of values which will be passed to `LocusZoom.KnownDataSources.create` to initialize the object for you. For example, where will initialize two different sources using each of the different methods.

    data_sources.add("trait1", ["AssociationLZ", {url: "http://server.com/api/single/", params: {analysis: 1}}]);
    data_sources.add("trait2", new  LocusZoom.Data.AssociationSource({url: "http://server.com/api/single/", params: {analysis: 2}}]));

Here we've supplied a different "namespace" for each data source. When you specify a field from these data source when building a plot, you will use "namespace:field". For example, if these data sources provide a "pvalue" field, you would specify either "trait1:pvalue" or "trait2:pvalue" to access data from each of those sources. 

See the documentation for the existing data source objects to see what parameters and properties they have.

## Understanding the Data Chain

When you retrieve data for your data layers, you can combine data from different data sources. The data source objects are responsible for adding their data to the data that was retrieved before. Data is passed to different data sources in the order in which the namespaces appear in the request. For example, if you make a call to the `DataRequestor` that looks like

	var data_sources = new LocusZoom.DataSources();
    data_sources.add("trait", ["AssociationLZ", "http://server.com/api/single/"]);
	data_sources.add("ld", ["LDLZ2", { url: "https://server.com/ld/", params: { source: '1000G', build: 'GRCh37', population: 'ALL' } }]);
    var requestor = new LocusZoom.DataRequestor(data_sources);
	requestor.getData(state, ["trait:position","trait:id", "trait:pvalue","ld:best"]);
	
Here the data will be first requested from the "trait" data source. Then, after that data has been processed, the response from the first source will be passed to the "ld" source, and that information can be used to make a request for more data. In the case of "ld:best", the data source can look at the p-values returned by the association source, find the most significant p-value, and then calculate the LD between that variant and the rest of the variants. This passing of data is called the "chain". It's just an object with a header and body. Each data source is responsible for updating the chain object with data requested from it.

### Advanced usage: Connectors and chain.discrete
In most cases, because the second source (LD) is responsible for building the combined response, it would need to know something about the source that preceded it. For endpoints that are only ever used together, this works well.

If you need to write a single data source that is used in many different ways (like annotating two different kinds of data layer, or drawing a table), this is possible, if a bit complex. After each source is parsed, the response that would be returned by just that source will be stored in `chain.discrete`. If a chain requests three sources, the third source can manipulate all of the data from both sources by reading from `chain.discrete`. By comparison, `chain.body` would only contain the information that the second source chose to return.

Data layers only ever see the combined response body, and do not receive a copy of `chain.discrete`.

If you expect a particular data source to be reused often, you can keep it independent of other data using `ConnectorSource`s. This is a source that does not have data of its own, but uses the `combineChainBody` method to specify how to combine arbitrary sources. This is the strategy used by aggregation tests.

Because Connectors are also a data source, the fields array would need to specify the connector as a final data source, after making requests from each of its dependencies. For example, `['source1:pvalue', 'source2:ld', 'connector:all']`.

## Creating Your Own Data Source

It is relatively straight forward to create your own `DataSource` object or to customize the behavior of an existing `DataSource` object. To do this, you will need to use the `LocusZoom.Data.Source.extend()` method. For example

    var mysource = LocusZoom.Data.Source.extend();
	
By default, sources are set to work with GET requests and will understand data returned as an array of objects or a named object with arrays of values. If your API end point satisfied these requirements, you just need to tell your data source where to pull the data from by customizing the `getURL` method

    mysource.prototype.getURL = function(state, chain, fields) {
		return "http://server.com/api/" + state.chromosome
	}
	
You have access to the [[State]] of the plot. This keeps track of things like the current chromosome and position ranges. You also have access to any data from previously executed data sources in the `chain` object. And finally you have access to the list of fields requested from your data source.

The `extend()` method can take three parameters

    LocusZoom.Data.Source.extend(constructorFun, shortName, base)
	
You can pass in a constructor function that you would like to be called on initialization. You can optionally pass in a `shortName` if you would like to register your data source with the `KnownDataSources`. This will allow you to use the short name when creating your `DataSources` collection. And finally you can specify a base class. By default you inherit from the default `Data.Source` class. If you would like to have acess to the prototype methods for a different class, you can specify that class by either passing in an instantiated object, or by passing in a short name of an existing data source as string.

Sometimes, however, more customization will be required than just creating a `getURL` method. The basic data source object has many more methods that you can customize for your own data end points. Most of the work happens in the `getData` function. Here is a list of functions that are called by default in the `getData` method


    getData(state, fields, outnames, transformations)
        getRequest(state, chain, fields)
		    getCacheKey(state, chain, fields)
			    getURL(state, chain, fields)
			fetchRequest(state, chain, fields)
			    getURL(state, chain, fields)
        parseResponse(resp, chain, fields, outnames, transformations)
		normalizeResponse(data)
		annotateData(data, chain)
		extractFields(data, fields, outnames, trans)
		combineChainBody(data, chain, fields, outnames)


You can choose to re-implement any of these default behaviors. Or you can just write your own `getData` function. The only requirement is that this function return another function which takes a `chain` as a parameter and returns a `chain`.

The parameters passed to `getData` are
* `state` - this is the current "state" of the plot. This is where values like the chromosome and start/end positions are chared
* `fields` - this is an array of field names that have been requested from this data source. Note that the "namespace:" part of the name has been removed in this array
* `outnames` - this is an array with length equal to `fields` with the original requested field name. This value contains the data source namespace. The data output for each field should be given the name in this array.
* `transformations` - this is an array with length equal to `fields` with the collection of transformations functions specified by the user to be run on the returned field.

As mentioned before, instead of just returning data, we are adding it to the data "chain." The `chain` is an object with a `header` and `body`. Metadata or important parameters about the request go in the header and the data used for plotting should go in the body.

The requesting and parsing of responses should always return `Promise` objects in order to coordinate interactions between sources. 

The default `parseResponse` logic assumes that the server response is a JSON-serialized payload. To help you re-use code, the parsing process is broken into 4 steps with hooks to control each piece separately. Each method can return either a value or a promise.

- `normalizeResponse(data)`: Converts the server response into a standard format: an array with one object per datapoint.
- `annotateData(data, chain)`: Modify the content of the fields returned. This can be used to perform calculations (to add information not present in the server response) or do minor cleanup on individual values.
- `extractFields(data, fields, outnames, trans)`: Creates the final set of information that would be returned by just this source, including applying any transformation functions (eg `logtoscinotation`).
- `combineChainBody(data, chain, fields, outnames)`: Combine the information from this source with previous sources to create a single combined response. This method is used by sources like LD and connectors.

## Using Local Files as Data Sources

A simple approach to consuming data from local files is to use a local file path as the `url` parameter in any data source. For an example of this refer to this block in [index.html](https://github.com/statgen/locuszoom/blob/v0.5.6/index.html#L194-L200):

```javascript
apiBase = window.location.origin + window.location.pathname.substr(0, window.location.pathname.length - "demo.html".length) + "staticdata/";
data_sources = new LocusZoom.DataSources()
    .add("assoc", ["AssociationLZ", {url: apiBase + "assoc_10_114550452-115067678.json?", params: {analysis: 3, id_field: "variant"}}])
    .add("ld", ["LDLZ", { url: apiBase + "ld_10_114550452-115067678.json?" }])
    .add("gene", ["GeneLZ", { url: apiBase + "genes_10_114550452-115067678.json?" }])
    .add("recomb", ["RecombLZ", { url: apiBase + "recomb_10_114550452-115067678.json?" }])
    .add("constraint", ["GeneConstraintLZ", {  url: apiBase + "constraint_10_114550452-115067678.json?" }]);
```

Here the data for five different data sources of different types are loaded from [static JSON files](https://github.com/statgen/locuszoom/tree/v0.5.6/staticdata) in the repo. This example can be seen in practice one of two ways:

1. Clone this repo and navigate to `index.html` locally (e.g. `file:///path/to/locuszoom/index.html` or `http://localhost/locuszoom/index.html`)
2. See [http://statgen.github.io/locuszoom/index.html?offline=1](http://statgen.github.io/locuszoom/index.html?offline=1) (a hosted version of the full repo)

