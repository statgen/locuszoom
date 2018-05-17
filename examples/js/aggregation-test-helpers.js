"use strict";
/* global raremetal */

/*
 * LocusZoom extensions used to calculate and render aggregation test results
 *
 * 1. An aggregation test data source based on an external library (eventually accommodate multiple calculation types)
 * 2. A connector that annotates gene data with aggregation test results
 */


var getMaskKey = function(group_id, mask_id) { return mask_id + "," + group_id; };

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
    // TODO: In the future, getURL will need to account for the specific masks selected by an external widget
    var required_info = state.aggregation_tests || {};

    this._aggregation_calcs = required_info.calcs;
    this._aggregation_masks = required_info.masks;
    return this.url;
};

LocusZoom.Data.AggregationTestSource.prototype.getData = function (state, fields, outnames, trans) {
    var self = this;
    return function(chain) {

        return self.getRequest(state, chain, fields)
            .then(function (resp) { return self.parseResponse(resp, chain, fields, outnames, trans); });
    };
};

LocusZoom.Data.AggregationTestSource.prototype.parseData = function (response, fields, outnames, trans) {
    // Whatever comes out of `parseData` gets added to `chain.discrete`; this is the method we override when we want to remix the calculated results

    // Ugly hack because chain source gives us `response.data`, and rmjs assumes it's given `response`
    var scoreCov = raremetal.helpers.parsePortalJson({data: response});
    var calcs = this._aggregation_calcs;

    if (!calcs || Object.keys(calcs).length === 0) {
        // If no calcs have been requested, then return a dummy placeholder immediately
        return { masks: [], results: [], scorecov: {} };
    }

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

LocusZoom.Data.AggregationTestSource.prototype.annotateData = function (records, chain) {
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
    parseInit: function (init) {
        // Validate that this source has been told how to find the required information
        var specified_ids = Object.keys(init.from);
        var required_sources = ["gene_ns", "aggregation_ns"];
        required_sources.forEach(function (k) {
            if (specified_ids.indexOf(k) === -1) {
                throw "Configuration for " + this.constructor.SOURCE_NAME + " must specify a source ID corresponding to " + k;
            }
        });
    },

    annotateData: function (records, chain) {
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
            var gene_id = gene.gene_id.split(".")[0];
            var tests = groupedAggregation[gene_id];
            if (tests) {
                gene.aggregation_best_pvalue = Math.min.apply(null, tests.map(function(item) {return item.pvalue;}));
            }
        });
        return genesData;
    }
});


/**
 * A sample connector that is useful when all you want are aggregation test results, eg as rows of a standalone table
 * This can be used to parse aggregation test data from multiple sources (eg fetched from a server or calculated
 *  live client-side)
 *
 * This is necessary because the Gente annotation data source does not return a body at all. If we want to get data out
 *  of the chain, we need to manipulate it as part of the chain.
 */
LocusZoom.KnownDataSources.extend("ConnectorSource", "AggregationParserConnectorLZ", {
    parseInit: function (init) {
        // TODO: DRY parseInit into base connector class
        // Validate that this source has been told how to find the required information
        var specified_ids = Object.keys(init.from); // TODO: rename from to sources for clarity?
        var required_sources = ["aggregation_ns"];
        required_sources.forEach(function (k) {
            if (specified_ids.indexOf(k) === -1) {
                throw "Configuration for " + this.constructor.SOURCE_NAME + " must specify a source ID corresponding to " + k;
            }
        });
    },
    annotateData: function (records, chain) {
        var rows = [];

        var aggregation_source_id = this._source_name_mapping["aggregation_ns"];
        var aggregation_data = chain.discrete[aggregation_source_id];

        var bt_results = aggregation_data.results;
        var bt_masks = aggregation_data.masks;

        // Convert masks to a hash to facilitate quickly aligning result with the data for one specific group+mask
        var mask_lookup = {};

        bt_masks.forEach(function (mask) {
            mask.groups.forEach(function (group_variants, group_id) { // mask.groups is an es6 hash
                // Combine the group and mask data into a single concise representation of the mask with a unique key
                var unique = getMaskKey(group_id, mask.id);
                mask_lookup[unique] = {
                    id: unique,
                    mask: mask.id,
                    group: group_id,
                    mask_desc: mask.label,
                    variants: group_variants,
                    variant_count: group_variants.length
                };
            });
        });

        bt_results.forEach(function (one_result) {
            var group_key = getMaskKey(one_result.group, one_result.mask);
            var row_data = JSON.parse(JSON.stringify(mask_lookup[group_key]));

            row_data.calc_type = one_result.test;
            row_data.pvalue = one_result.pvalue;

            rows.push(row_data);

        });
        return rows;
    }
});

/**
 * A sample connector that extracts variant data for all mask/group combinations in the dataset
 */
LocusZoom.KnownDataSources.extend("ConnectorSource", "AggregationVariantsConnectorLZ", {
    parseInit: function (init) {
        // TODO: DRY parseInit into base connector class
        // Validate that this source has been told how to find the required information
        var specified_ids = Object.keys(init.from); // TODO: rename from to sources for clarity?
        var required_sources = ["aggregation_ns"];
        required_sources.forEach(function (k) {
            if (specified_ids.indexOf(k) === -1) {
                throw "Configuration for " + this.constructor.SOURCE_NAME + " must specify a source ID corresponding to " + k;
            }
        });
    },

    annotateData: function (records, chain) {
        var rows = [];

        var aggregation_source_id = this._source_name_mapping["aggregation_ns"];
        var aggregation_data = chain.discrete[aggregation_source_id];

        var mask_map = aggregation_data.scorecov;

        Object.keys(mask_map).forEach(function (key) {
            var data = mask_map[key];
            for (var i=0; i < data.scores.variants.length; i++) {
                rows.push({
                    id: key,
                    variant: data.scores.variants[i],
                    score: data.scores.u[i],
                    alt_allele_freq: data.scores.altFreq[i]
                });
            }
        });
        return rows;
    }
});
