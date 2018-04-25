"use strict";
/*
 * LocusZoom extensions used to calculate and render burden test results
 *
 * 1. A Burden test data source based on an external library (eventually accommodate multiple calculation types)
 * 2. A connector that annotates gene data with burden test results
 */


var getMaskKey = function(group_id, mask_id) { return group_id + "_" + mask_id; };

/**
 * Data Source that calculates gene or region-based tests based on provided data
 *   It will rarely be used by itself, but rather using a connector that attaches the results to data from
 *   another source (like genes). Using a separate connector allows us to add caching and run this front-end
 *   calculation only once, while using it in many different places
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.GeneTestSource = LocusZoom.Data.Source.extend(function (init) {
    //TODO: Use the URL to fetch a covariance matrix that will power the live calculation data
    this.parseInit(init);
}, "GeneTestSourceLZ");

LocusZoom.Data.GeneTestSource.prototype.getURL = function () {
    // TODO: customize calculation once covar matrices exist
    return this.url;
};

LocusZoom.Data.GeneTestSource.prototype.parseData = function (response, fields, outnames, trans) {
    return raremetal.helpers._example("data/burdentest_raw_hail_22_21576208-22089932.json").then(function(data) {
        // For the purpose of initial integration, the rm.js output is missing certain data for which a source is not obvious
        // TODO: Remove this "fake data" generation for production and just `return data['data']`!!
        data = data["data"];

        // Mocking and fake data added below
        data.results = data.results.map(function(res) {
            // TODO: The spec calls for multiple kinds of interval, but here, assume every group is a gene
            res.type = res.type || "gene";
            return res;
        });
        return data;
    });
};

LocusZoom.Data.GeneTestSource.prototype.prepareData = function (records, chain) {
    // Burden tests are a bit unique, in that the data is rarely used directly- instead it is used to annotate many
    //  other layers in different ways. The calculated result has been added to `chain.raw`, but will not be returned
    //  as part of the response body built up by the chain
    return chain.body;
};


/**
 * A sample connector that aligns calculated burden test data with corresponding gene information. Returns a body
 *   suitable for use with the genes datalayer.
 *
 *  To use this source, one must specify a fields array that calls first the genes source, then a dummy field from
 *      this source. The output will be to transparently add several new fields to the genes data.
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.KnownDataSources.extend("ConnectorSource", "GeneBurdenConnectorLZ", {
    parseInit: function (init) {
        // Validate that this source has been told how to find the required information
        var specified_ids = Object.keys(init.from);
        var required_sources = ["gene_ns", "burden_ns"];
        required_sources.forEach(function (k) {
            if (specified_ids.indexOf(k) === -1) {
                throw "Configuration for " + this.constructor.SOURCE_NAME + " must specify a source ID corresponding to " + k;
            }
        });
    },

    prepareData: function (records, chain) {
        // Tie the calculated group-test results to genes with a matching name
        var burden_source_id = this._source_name_mapping["burden_ns"];
        // This connector assumes that genes are the main body of records from the chain, and that burden tests are
        //   a standalone source that has not acted on genes data yet
        var burdenData = chain.raw[burden_source_id];

        var genesData = records; // chain.raw[this_required_sources["gene_ns"];  TODO: Why broken?
        var groupedBurden = {};  // Group together all tests done on that gene- any mask, any test
        burdenData.results.forEach(function(res) {
            if (!groupedBurden.hasOwnProperty(res.group)) {
                groupedBurden[res.group] = [];
            }
            if (res.type === "gene") {
                // Don't look at interval groups- this is a genes layer connector
                groupedBurden[res.group].push(res);
            }
        });

        // Annotate any genes that have test results
        genesData.forEach(function (gene) {
            var tests = groupedBurden[gene.gene_name];
            if (tests) {
                gene.burden_best_pvalue = Math.min.apply(null, tests.map(function(item) {return item.pvalue;}));
            }
        });
        return genesData;
    }
});


/**
 * A sample connector that is useful when all you want are burden test results, eg as rows of a standalone table
 * This can be used to parse burden test data from multiple sources (eg fetched from a server or calculated
 *  live client-side)
 */
LocusZoom.KnownDataSources.extend("ConnectorSource", "BurdenParserConnectorLZ", {
    parseInit: function (init) {
        // TODO: DRY parseInit into base connector class
        // Validate that this source has been told how to find the required information
        var specified_ids = Object.keys(init.from); // TODO: rename from to sources for clarity?
        var required_sources = ["burden_ns"];
        required_sources.forEach(function (k) {
            if (specified_ids.indexOf(k) === -1) {
                throw "Configuration for " + this.constructor.SOURCE_NAME + " must specify a source ID corresponding to " + k;
            }
        });
    },
    prepareData: function (records, chain) {
        // TODO: NAMESPACING would be nice for consistency with other sources. Currently this is one of our slowly growing set of "all or nothing" sources which ignore specific field requests
        var rows = [];

        var burden_source_id = this._source_name_mapping["burden_ns"];
        var burden_data = chain.raw[burden_source_id];

        var bt_results = burden_data.results;
        var bt_masks = burden_data.masks;

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
