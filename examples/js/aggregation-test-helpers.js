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
    // Operate on the calculated results. The result of this method will be added to chain.discrete

    // In a page using live API data, the UI would only request the masks it needs from the API.
    // But in our demos, sometimes boilerplate JSON has more masks than the UI asked for. Limit what calcs we run (by
    //  type, and to the set of groups requested by the user)
    records.groups = records.groups.filter(function(item) {return item.groupType === "gene"; });

    var parsed = raremetal.helpers.parsePortalJSON(records);
    var groups = parsed[0];
    var variants = parsed[1];


    groups = groups.byMask(chain.header.aggregation_masks);

    var calcs = chain.header.aggregation_calcs;

    if (!calcs || Object.keys(calcs).length === 0) {
        // If no calcs have been requested, then return a dummy placeholder immediately
        return { variants: [], groups: [], results: [] };
    }
    var runner = new raremetal.helpers.TestRunner(groups, variants, calcs);
    var res = runner.toJSON();
    return res.data;
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
        // The genes layer receives all results, and displays only the best pvalue for each gene

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
        });

        // Annotate any genes that have test results
        genesData.forEach(function (gene) {
            var gene_id = gene.gene_id.split(".")[0];
            var tests = groupedAggregation[gene_id];
            if (tests) {
                gene.aggregation_best_pvalue = Math.min.apply(null, tests);
            }
        });
        return genesData;
    }
});
