/*
 * LocusZoom extensions used to calculate and render burden test results
 *
 * 1. A Burden test data source based on an external library (eventually accommodate multiple calculation types)
 * 2. A connector that annotates gene data with burden test results
 */

// TODO: Move burden tests into core code once implementation finalized

/**
 * Data Source that calculates gene or region-based tests based on provided data
 *   It will rarely be used by itself, but rather using a connector that attaches the results to data from
 *   another source (like genes).
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
    // Return a raw burden test payload
    return response;
};


/**
 * A sample connector that uses the existing burden test calculation machinery, and maps it to data from a previous
 *  data source in the chain (in this case, Genes data)
 *
 *  To use this source, one must specify a fields array that calls first the genes source, then a dummy field from
 *      this source. The output will be to transparently add several new fields to the genes data.
 * @public
 * @class
 * @augments LocusZoom.Data.Source
 */
LocusZoom.KnownDataSources.extend("GeneTestSourceLZ", "GeneBurdenConnectorLZ", {
    prepareData: function (records, chain) {
        // Tie the calculated group-test results (records) to genes with a matching name
        var genesData = chain.body;
        var consolidatedBurden = {};  // Boil down all possible test results to "best per gene"
        records.results.forEach(function(burdenResult) {
            if (burdenResult.type !== 'gene') {
                return;
            }
            consolidatedBurden[burdenResult.id] = Math.min.apply(null, burdenResult.tests.map(function(item) {return item.pvalue;}));
        });
        // Annotate any genes that have test results
        // TODO: Add more data to power advanced tables and layers
        genesData.forEach(function(gene) {
            if (consolidatedBurden.hasOwnProperty(gene.gene_name)) {
                gene.burden_best_pvalue = consolidatedBurden[gene.gene_name];
            }
        });
        return genesData;
    }
});
