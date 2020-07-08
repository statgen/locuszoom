# State

At any given time a plot (and subdivisions within the plot such as panels and data layers) have *state*. State can be thought of as a collection of fields and values that describe the current relationship between the [Layout](../Layouts), which describes the appearance/behavior of the plot in general terms, and the [Data Sources](data-sources.md), which describe how all available data can be requested.

## Example: Region Values

For any LocusZoom plot that shows a region of a genome (e.g. the standard association plot) state will contain three primary values:

* **`chr`** - *String*  
  The chromosome from which to select region-based results such as association p-values or genes (for the human genome: the numbers 1-22 and the strings "X" and "Y")  

* **`start`** - *Number*  
  The base number to start the selected region  

* **`end`** - *Number*  
  The base number to end the selected region  

Thus for a standard association plot (or similar) a state of `{ chr: 10, start: 16500000, end: 17300000 }` will signal the data sources to request their data (association p-values, genes, interval annotations, etc.) for an 800 kilobase region on chromosome 10 starting at base 16,500,000 and ending at base 17,300,000.

## Internal Structure

The `state` object is stored at the top level of the plot layout. It is also referenced directly on the plot object itself. For example:

```javascript
> plot.layout
Object{ state: Object, width: 800, height: 800 ... }

> plot
Object{ state: Object, id: "plot", svg: Array[1] ... }
```

Thus, being part of the layout, **state fields and values should always be complaint JSON**. State was defined as a part of the layout because the layout was designed to be serializable for storing, transferring, and reinflating. Since state tends to contain data that orients a general layout to specific data it makes sense to include state as a part of the layout.

Subdivisions of the plot, such as panels and data layers, often need to store state-like values or access the state values of their parent. To facilitate this references to the state object are automatically present on every panel and data layer (the actual objects themselves, not their layouts), as shown here:

```javascript
> plot.panels.association
Object{ state: Object, parent: LocusZoom.Plot, id: "association" ... }

> plot.panels.association.data_layers.associationpvalues
Object{ state: Object, parent: LocusZoom.Panel, id: "associationpvalues" ... }
```

Panels and data layers use a pattern to generate a unique `state_id` which state object in turn uses to create objects for storing panel-specific or data-layer-specific state values. Inspect the structure of the state object on a plot to see an example of this in action. 

## No Prescribed Fields

The example above only shows a pattern that all pre-defined layouts and data sources use to define genomic regions. **Ultimately there is no prescribed pattern for how state should be structured.** This is especially important to bear in mind when creating custom layouts and/or data sources.

State is an object for storing any relevant data that will help translate between layouts and data sources, or store persistent values that data sources may use for constraining data requests.
