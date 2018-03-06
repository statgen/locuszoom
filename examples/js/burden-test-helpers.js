/*
 * LocusZoom extensions used to calculate and render burden test results
 *
 * 1. A Burden test data source based on an external library (eventually accommodate multiple calculation types)
 * 2. A connector that annotates gene data with burden test results
 */

// TODO: Move burden tests into core code once implementation finalized?

/**
 * Data Source that calculates gene or region-based tests based on provided data
 *   It will rarely be used by itself, but rather using a connector that attaches the results to data from
 *   another source (like genes). Using a separate connector allows us to add caching and run this front-end
 *   calculation only once, while using it in many different places
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.Data.GeneTestSource = LocusZoom.Data.Source.extend(function(init) {
    //TODO: Use the URL to fetch a covariance matrix that will power the live calculation data
    this.parseInit(init);
}, "GeneTestSourceLZ");

LocusZoom.Data.GeneTestSource.prototype.getURL = function() {
    // TODO: customize calculation once covar matrices exist
    return this.url;
};

LocusZoom.Data.GeneTestSource.prototype.parseData = function(response, fields, outnames, trans) {
    // The server request returns a covariance matrix that will be used to power the calculation
    // TODO: Calculation goes here
    // For now, return a raw burden test payload (since we have premade JSON in a file). It will automatically be added to chain.raw
    return response;
};

LocusZoom.Data.GeneTestSource.prototype.prepareData = function(records, chain) {
    // Burden tests are a bit unique, in that the data is rarely used directly- instead it is used to annotate many
    //  other layers in different ways. The calculated result will be added to `chain.raw`, but will not be returned
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
        required_sources.forEach(function(k) {
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

        var genesData = records;  // chain.raw[this_required_sources["gene_ns]]
        var consolidatedBurden = {};  // Boil down all possible test results to "best pvalue per gene"
        burdenData.results.forEach(function(burdenResult) {
            if (burdenResult.type !== "gene") {
                return;
            }
            consolidatedBurden[burdenResult.id] = Math.min.apply(null, burdenResult.tests.map(function(item) {return item.pvalue;}));
        });
        // Annotate any genes that have test results
        genesData.forEach(function(gene) {
            if (consolidatedBurden[gene.gene_name]) {
                gene.burden_best_pvalue = consolidatedBurden[gene.gene_name];
            }
        });
        return genesData;
    }
});


/**
 * A sample connector that is useful when all you want are burden test results
 * This can be used to parse burden test data from multiple sources (eg fetched from a server or calculated
 *  live client-side)
 */
LocusZoom.KnownDataSources.extend("ConnectorSource", "BurdenParserConnectorLZ", {
    parseInit: function (init) {
        // TODO: DRY parseInit into base class
        // Validate that this source has been told how to find the required information
        var specified_ids = Object.keys(init.from);
        var required_sources = ["burden_ns"];
        required_sources.forEach(function(k) {
            if (specified_ids.indexOf(k) === -1) {
                throw "Configuration for " + this.constructor.SOURCE_NAME + " must specify a source ID corresponding to " + k;
            }
        });
    },
    prepareData: function (records, chain) {
        // TODO: In the future we may want to move more of this parsing logic into the Burden test calculation source, or change the canonical record format to better align
        // TODO: NAMESPACING would be nice for consistrency with other sources. Currently this is one of our slowly growing set of "all or nothing" sources which ignore specific field requests
        var rows = [];

        var burden_source_id = this._source_name_mapping["burden_ns"];
        var burden_data = chain.raw[burden_source_id];

        var bt_results = burden_data.results;
        var bt_masks = burden_data.masks;

        // Convert masks to a hash to facilitate quickly aligning result + mask data
        var mask_lookup = {};
        bt_masks.forEach(function(mask) {
            mask_lookup[mask.id] = mask;
        });
        bt_results.forEach(function(group_data) {
            var group_id = group_data.id;
            group_data.tests.forEach(function(one_test) {
                var mask_id = one_test.mask;
                var mask = mask_lookup[mask_id];
                var mask_group = mask["groups"][group_id];

                rows.push({
                    id: group_id + "." + mask_id,
                    group: group_data.id,
                    mask: mask_id,
                    mask_desc: mask.label,
                    variants: mask_group.variants,
                    variant_count: mask_group.variants.length,
                    calc_type: one_test.test,
                    pvalue: one_test.pvalue
                })
            });
        });
        return rows;
    }
});
