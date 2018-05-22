"use strict";
/* global raremetal */

/*
 * LocusZoom extensions used to calculate and render aggregation test results
 *
 * 1. An aggregation test data source based on an external library (eventually accommodate multiple calculation types)
 * 2. A connector that annotates gene data with aggregation test results
 */

/**
 * Data Source that calculates gene or region-based tests based on provided data
 *   It will rarely be used by itself, but rather using a connector that attaches the results to data from
 *   another source (like genes). Using a separate connector allows us to add caching and run this front-end
 *   calculation only once, while using it in many different places
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.AggregationTestSource = LocusZoom.Data.Source.extend(function (init) {
    this.parseInit(init);
}, "AggregationTestSourceLZ");

LocusZoom.Data.AggregationTestSource.prototype.getURL = function (state, chain, fields) {
    // Unlike most sources, calculations may require access to plot state data even after the initial request
    // This example source REQUIRES that the external UI widget would store the needed test definitions in a plot state
    //  field called `aggregation_tests` (an object {masks: [], calcs: {})
    // TODO: In the future, getURL will need to account for the specific masks selected by an external widget (when requesting covar data)
    var required_info = state.aggregation_tests || {};

    if (!chain.header) {chain.header = {};}
    chain.header.aggregation_calcs = required_info.calcs || {};
    chain.header.aggregation_masks = required_info.masks || [];
    return this.url;
};

LocusZoom.Data.AggregationTestSource.prototype.annotateData = function (records, chain) {
    // Whatever comes out of `parseData` gets added to `chain.discrete`; this is the method we override when we want to remix the calculated results

    // In a page using live API data, the UI would only request the masks it needs from the API.
    // But in our demos, sometimes boilerplate JSON has more masks than the UI asked for. Limit what calcs we run.
    records.masks = records.masks.filter(function (mask) { return chain.header.aggregation_masks.indexOf(mask.id) !== -1; });
    records.scorecov = records.scorecov.filter(function (item) { return chain.header.aggregation_masks.indexOf(item.mask) !== -1; });

    // Ugly hack because chain source gives us `response.data`, and rmjs assumes it's given `response`

    var calcs = chain.header.aggregation_calcs;

    if (!calcs || Object.keys(calcs).length === 0) {
        // If no calcs have been requested, then return a dummy placeholder immediately
        return { masks: [], results: [], scorecov: {} };
    }

    var scoreCov = raremetal.helpers.parsePortalJson({data: records});
    var res = raremetal.helpers.runAggregationTests(calcs, scoreCov );
    var data = res["data"];

    // Mocking and fake data added below
    data.results = data.results.map(function(res) {
        // TODO: The second API response does not identify the grouping type of the mask. For now, assume that the UI took responsibility for filtering the masks to be genes (only)
        // TODO: should the final rmjs payload likewise carry forward the mask groupin types?
        res.grouping = res.grouping || "gene";
        return res;
    });

    // Combine the calculation results with the "mask descriptions" from the API response
    // TODO: This implies that a single "precalculated results" emdpoint would not contain all the information required to draw the page- it would never get the first"scorecov" dataset at all
    data.scorecov = scoreCov.scorecov;
    return data;
};

LocusZoom.Data.AggregationTestSource.prototype.normalizeResponse = function(data) { return data; };

LocusZoom.Data.AggregationTestSource.prototype.combineChainBody = function (records, chain) {
    // aggregation tests are a bit unique, in that the data is rarely used directly- instead it is used to annotate many
    //  other layers in different ways. The calculated result has been added to `chain.discrete`, but will not be returned
    //  as part of the response body built up by the chain
    return chain.body;
};


/**
 * A sample connector that aligns calculated aggregation test data with corresponding gene information. Returns a body
 *   suitable for use with the genes datalayer.
 *
 *  To use this source, one must specify a fields array that calls first the genes source, then a dummy field from
 *      this source. The output will be to transparently add several new fields to the genes data.
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.KnownDataSources.extend("ConnectorSource", "GeneAggregationConnectorLZ", {
    REQUIRED_SOURCES: ["gene_ns", "aggregation_ns"],
    combineChainBody: function (data, chain) {
        // Tie the calculated group-test results to genes with a matching name
        var aggregation_source_id = this._source_name_mapping["aggregation_ns"];
        var gene_source_id = this._source_name_mapping["gene_ns"];
        // This connector assumes that genes are the main body of records from the chain, and that aggregation tests are
        //   a standalone source that has not acted on genes data yet
        var aggregationData = chain.discrete[aggregation_source_id];
        var genesData = chain.discrete[gene_source_id];

        var groupedAggregation = {};  // Group together all tests done on that gene- any mask, any test
        aggregationData.results.forEach(function(res) {
            if (!groupedAggregation.hasOwnProperty(res.group)) {
                groupedAggregation[res.group] = [];
            }
            if (res.grouping === "gene") {
                // Don't look at interval groups- this is a genes layer connector
                groupedAggregation[res.group].push(res);
            }
        });

        // Annotate any genes that have test results
        genesData.forEach(function (gene) {
            // FIXME: Compensate for different variant ID format in genes vs agg output
            var gene_id = gene.gene_id.split(".")[0];
            var tests = groupedAggregation[gene_id];
            if (tests) {
                gene.aggregation_best_pvalue = Math.min.apply(null, tests.map(function(item) {return item.pvalue;}));
            }
        });
        return genesData;
    }
});

