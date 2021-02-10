---
title: Getting started with LocusZoom.js
toc: true
toc-title: Table of Contents
---

LocusZoom.js provides many powerful options for visualizing genetic data in biological context. Our goal is to make the most common tasks easy, while providing advanced options for custom visualization and interactivity. For an overview of capabilities (and places where it is used), see our preprint: ["LocusZoom.js: Interactive and embeddable visualization of genetic association study results"](https://www.biorxiv.org/content/10.1101/2021.01.01.423803v1)

## Creating your first plot
Creating a LocusZoom plot requires three pieces of information:

* Where to render the plot (eg, the unique ID of an HTML element on the page)
* Where to find data (see: [Working with data](data_tutorial.html))
* How to render the data (see: [Layouts and visualization options](layout_tutorial.html))

Once defined, these values can be passed to the populate() method along with a selector to identify a div, like so:
`const plot = LocusZoom.populate(selector_id, data_sources, layout);` 

The "classic" LocusZoom plot consists of two panels: a GWAS scatter plot on top, and a view of nearby genes in the region on bottom. See [simple GWAS template](simplest_template.html) for the code you will need to get started.

## What does LocusZoom.js provide?
LocusZoom-style visualizations are widely used throughout the field of genetics, and this is by no means the only tool available for creating them. However, many existing tools only create a static image. LocusZoom.js was designed to power large data-exploration hubs such as PheWeb or the HuGeAMP family of knowledge portals: it can be used by websites that want to take full advantage of what the web browser has to offer.

* A public [REST API](https://portaldev.sph.umich.edu/docs/api/v1/#introduction) with "standard" datasets that are useful for any LocusZoom plot (genes, recombination rate, etc), and an associated [LDServer](https://portaldev.sph.umich.edu/playground) to calculate on-the-fly Linkage Disequilibrium for 1000G
* Data Adapters that support fetching your data from a variety of sources, such as dynamic REST APIs, static blobs, or tabix-indexed files on a static web host. 
* Visualization types for several common types of data (including scatter plot, genes, PheWAS, and chromatin coaccessibility)
* Interactive features allow the user to change the region that is displayed, form connections between the data shown on related tracks, or filter out data elements to focus on the most interesting parts of your data   
* A toolkit for building advanced, interactive plots that connect to other data on the page
  * Toolbar buttons that perform calculations or change what is displayed
  * Tables that can update whenever data changes
  * Plugins to update the page URL and create bookmarkable views for interesting regions 

## Structure and organization
LocusZoom.js defines reusable, highly configurable building blocks that can be combined to create many kinds of visualization. This approach grants enormous flexibility, but it also means that the configuration (*layout*) can be very overwhelming at first. Understanding the basic structure and terminology can be very helpful in knowing where to look for more information. 

The key pieces are:

* A Plot is an instance of LocusZoom, and it is almost always created by the `LocusZoom.populate(...)` method. A plot is defined in terms of a layout. The visualization can be controlled programmatically by the initialized `plot` instance, with various [options and supported methods](../api/Plot.html)  
* A Panel is a subdivided area of a plot. Panels contain graph features such as titles, axes, and toolbar buttons, but they are not responsible for actual data. Panels occupy the full width the of the plot and are stacked vertically along the y-axis (typically in the order they are added). They are usually created through [layout configuration options](../api/Panel.html) rather than custom code.
* A Data Layer is a layer within a panel that is responsible for rendering data. Data layers are stacked depth-wise along the z-axis, typically in the order they are added. They are usually created via layout configuration objects rather than custom mode. There are several [rendering types](../api/module-LocusZoom_DataLayers.html) available, each with their own set of pre-defined behaviors.
* A Toolbar is an area above the plot and/or individual panels. It can show title text or user interface widgets that control how data is shown, or simply provide additional information for context. They are described with their own configuration rules, and a range of [interactive widgets](../api/module-LocusZoom_Widgets.html) are available.
* A Legend provides information needed to interpret the visualization. To show a legend, configuration must be provided in two places: the panel describes the legend position, and each specific data layer describes which elements should appear in the legend. Most data layers require the legend to be defined manually, to reflect the specific options of color/size/shape that are most relevant to the view.

![Each plot can have several sections (panels), each with several types of data stacked as layers](../svg_architecture.svg)

## Resources
### See it in action
LocusZoom.js has many advanced features. Some are implemented in code, and others are available as configuration options. We provide a range of examples for how to use it. Many of the examples below are open source.

* [LocusZoom.js example gallery](https://statgen.github.io/locuszoom) - Demonstrates how to use LocusZoom.js for common visualization types, with minor customization and interactivity. A focus on built-in features and layouts, with some introductory text.
* [my.locuszoom.org](https://my.locuszoom.org) - Plot your own data without having to write JavaScript. Built on [LocalZoom](https://statgen.github.io/localzoom/), an [open-source](https://github.com/statgen/localzoom) tool that shows how to use LocusZoom.js with modern javascript frameworks like vue.js.
* [PheWeb](https://github.com/statgen/pheweb) - A tool to build multi-phenotype GWAS browsers. Used by dozens of research groups worldwide. ([paper](https://doi.org/10.1038/s41588-020-0622-5))
* [HuGeAMP](https://hugeamp.org/) - Knowledge Portals that bring together genetic, epigenomic, and computational results for multiple diseases and traits.
* [FIVEx](https://eqtl.pheweb.org/) - An interactive multi-tissue eQTL browser. ([preprint](https://www.biorxiv.org/content/10.1101/2021.01.22.426874v1))
* [CROCPOT](https://www.crocpot.org/crocpot/) - ChROmatin-based Collection of Predicted Target genes. A repository and genome browser of data linking pairs of genomic loci for example from 3D chromatin interaction, single cell chromatin accessibility and CRISPRi screen assays
* ...and others! Let us know if you have a tool you would like to share.

### Documentation
LocusZoom provides a lot of functionality, but getting the most of it does requires some help. We provide prose guides on the following topics:

* Where to find data (see: [Working with data](data_tutorial.html))
* How to render the data (see: [Layouts and visualization options](layout_tutorial.html))
* Advanced interactive features (see: [Mechanisms for Interactivity](interactivity_tutorial.html))
* Extending LocusZoom.js with custom features (see: [Using and creating plugins](plugins_tutorial.html))

If you are ready to go deeper, see the [detailed API documentation](../api/), describing all the configuration options, plugins, and visualization types available.
