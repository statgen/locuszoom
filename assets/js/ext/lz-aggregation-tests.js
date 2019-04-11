'use strict';
/*
 * LocusZoom extensions used to calculate and render aggregation test results. Because these calculations depend on an
 *   external library, the special data sources are defined here, rather than in LocusZoom core code.
 *
 *     The page must incorporate and load all libraries before this file can be used, including:
 *    - Vendor assets
 *    - LocusZoom
 *    - raremetal.js (available via NPM or a related CDN)
 */
// This is defined as a UMD module, to work with multiple different module systems / bundlers
// Arcane build note: everything defined here gets registered globally. This is not a "pure" module, and some build
//  systems may require being told that this file has side effects.
/* global define, module, require */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['locuszoom', 'raremetal.js', 'q'] , function(LocusZoom, raremetal, Q) {  // amd
            return factory(LocusZoom, raremetal, Q);
        });
    } else if(typeof module === 'object' && module.exports) {  // commonJS
        module.exports = factory(require('locuszoom'), require('raremetal.js'), require('q'));
    } else {  // globals
        if (!root.LocusZoom.ext.Data) {
            root.LocusZoom.ext.Data = {};
        }
        var sources = factory(root.LocusZoom, root.raremetal, root.Q);
        Object.keys(sources).forEach(function(key) {
            root.LocusZoom.ext.Data[key] = sources[key];
        });
    }
}(this, function(LocusZoom, raremetal, Q) {
    /**
     * Data Source that calculates gene or region-based tests based on provided data
     *   It will rarely be used by itself, but rather using a connector that attaches the results to data from
     *   another source (like genes). Using a separate connector allows us to add caching and run this front-end
     *   calculation only once, while using it in many different places
     * @public
     * @class
     * @augments LocusZoom.Data.Source
     */
    var AggregationTestSource = LocusZoom.Data.Source.extend(function (init) {
        this.parseInit(init);
    }, 'AggregationTestSourceLZ');

    AggregationTestSource.prototype.getURL = function (state, chain, fields) {
        // Unlike most sources, calculations may require access to plot state data even after the initial request
        // This example source REQUIRES that the external UI widget would store the needed test definitions in a plot state
        //  field called `aggregation_tests` (an object {masks: [], calcs: {})
        var required_info = state.aggregation_tests || {};

        if (!chain.header) {
            chain.header = {};
        }
        // All of these fields are required in order to use this datasource. TODO: Add validation?
        chain.header.aggregation_genoset_id = required_info.genoset_id || null; // Number
        chain.header.aggregation_genoset_build = required_info.genoset_build || null; // String
        chain.header.aggregation_phenoset_id = required_info.phenoset_id || null;  // Number
        chain.header.aggregation_pheno = required_info.pheno || null; // String
        chain.header.aggregation_calcs = required_info.calcs || {};  // String[]
        var mask_data = required_info.masks || [];
        chain.header.aggregation_masks = mask_data;  // {name:desc}[]
        chain.header.aggregation_mask_ids = mask_data.map(function(item) { return item.name; }); // Number[]
        return this.url;
    };

    AggregationTestSource.prototype.getCacheKey = function (state, chain, fields) {
        this.getURL(state, chain, fields);  // TODO: This just sets the chain.header fields
        return JSON.stringify({
            chrom: state.chr,
            start: state.start,
            stop: state.end,
            genotypeDataset: chain.header.aggregation_genoset_id,
            phenotypeDataset: chain.header.aggregation_phenoset_id,
            phenotype: chain.header.aggregation_pheno,
            samples: 'ALL',
            genomeBuild: chain.header.aggregation_genoset_build,
            masks: chain.header.aggregation_mask_ids,
        });
    };


    AggregationTestSource.prototype.fetchRequest = function (state, chain, fields) {
        var url = this.getURL(state, chain, fields);
        var body = this.getCacheKey(state, chain, fields);
        var headers = {
            'Content-Type': 'application/json'
        };
        return LocusZoom.createCORSPromise('POST', url, body, headers);
    };

    AggregationTestSource.prototype.annotateData = function (records, chain) {
        // Operate on the calculated results. The result of this method will be added to chain.discrete

        // In a page using live API data, the UI would only request the masks it needs from the API.
        // But in our demos, sometimes boilerplate JSON has more masks than the UI asked for. Limit what calcs we run (by
        //  type, and to the set of groups requested by the user)

        // The Raremetal-server API has a quirk: it returns a different payload structure if no groups are defined
        //  for the request region. Detect when that happens and end the calculation immediately in that case
        if (!records.groups) {
            return { groups: [], variants: [] };
        }

        records.groups = records.groups.filter(function (item) {
            return item.groupType === 'GENE';
        });

        var parsed = raremetal.helpers.parsePortalJSON(records);
        var groups = parsed[0];
        var variants = parsed[1];
        // Some APIs may return more data than we want (eg simple sites that are just serving up premade scorecov json files).
        //  Filter the response to just what the user has chosen to analyze.
        groups = groups.byMask(chain.header.aggregation_mask_ids);

        // Determine what calculations to run
        var calcs = chain.header.aggregation_calcs;
        if (!calcs || Object.keys(calcs).length === 0) {
            // If no calcs have been requested, then return a dummy placeholder immediately
            return { variants: [], groups: [], results: [] };
        }
        var runner = new raremetal.helpers.PortalTestRunner(groups, variants, calcs);
        try {
            var res = runner.toJSON();
        } catch (e) {
            console.error(e);
            throw new Error('Failed to calculate aggregation test results');
        }

        // Internally, raremetal helpers track how the calculation is done, but not any display-friendly values
        // We will annotate each mask name (id) with a human-friendly description for later use
        var mask_id_to_desc  = chain.header.aggregation_masks.reduce(function(acc, val) {
            acc[val.name] = val.description;
            return acc;
        }, {});
        res.data.groups.forEach(function(group)  {
            group.mask_name = mask_id_to_desc[group.mask];
        });

        return res.data;
    };

    AggregationTestSource.prototype.normalizeResponse = function (data) {
        return data;
    };

    AggregationTestSource.prototype.combineChainBody = function (records, chain) {
        // aggregation tests are a bit unique, in that the data is rarely used directly- instead it is used to annotate many
        //  other layers in different ways. The calculated result has been added to `chain.discrete`, but will not be returned
        //  as part of the response body built up by the chain
        return chain.body;
    };


    /**
     * A custom data source that reformats existing association data, rather than requesting new data from the server.
     *  In this case, aggregation test calculations have already made data about variants available, and that data only
     *  needs to be reformatted to work with the association data layer.
     *
     * @public
     * @class
     * @augments LocusZoom.Data.Source
     */
    var AssocFromAggregationLZ = LocusZoom.KnownDataSources.extend('AssociationLZ', 'AssocFromAggregationLZ', {
        parseInit: function (init) {
            if (!init || !init.from) {
                throw 'Must specify the name of the source that contains association data';
            }
            this.params = init.params || {};
            this._from = init.from;
        },

        getRequest: function (state, chain, fields) {
            // Does not actually make a request. Just pick off the specific bundle of data from a known payload structure.
            if (chain.discrete && !chain.discrete[this._from]) {
                throw self.constructor.SOURCE_NAME + ' cannot be used before loading required data for: ' + this._from;
            }
            // Copy the data so that mutations (like sorting) don't affect the original
            return Q.when(JSON.parse(JSON.stringify(chain.discrete[this._from]['variants'])));
        },

        normalizeResponse: function (data) {
            // The payload structure of the association source is slightly different than the one required by association
            //   plots. For example, we need to parse variant names and convert to log_pvalue
            var REGEX_EPACTS = new RegExp('(?:chr)?(.+):(\\d+)_?(\\w+)?/?([^_]+)?_?(.*)?');  // match API variant strings
            return data.map(function (one_variant) {
                var match = one_variant.variant.match(REGEX_EPACTS);
                return {
                    variant: one_variant.variant,
                    chromosome: match[1],
                    position: +match[2],
                    ref_allele: match[3],
                    ref_allele_freq: 1 - one_variant.altFreq,
                    log_pvalue: -Math.log10(one_variant.pvalue)
                };
            }).sort(function (a, b) {
                a = a.variant;
                b = b.variant;
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                } else {
                    // names must be equal
                    return 0;
                }
            });
        }
    });


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
    var GeneAggregationConnectorLZ = LocusZoom.KnownDataSources.extend('ConnectorSource', 'GeneAggregationConnectorLZ', {
        REQUIRED_SOURCES: ['gene_ns', 'aggregation_ns'],
        combineChainBody: function (data, chain) {
            // The genes layer receives all results, and displays only the best pvalue for each gene

            // Tie the calculated group-test results to genes with a matching name
            var aggregation_source_id = this._source_name_mapping['aggregation_ns'];
            var gene_source_id = this._source_name_mapping['gene_ns'];
            // This connector assumes that genes are the main body of records from the chain, and that aggregation tests are
            //   a standalone source that has not acted on genes data yet
            var aggregationData = chain.discrete[aggregation_source_id];
            var genesData = chain.discrete[gene_source_id];

            var groupedAggregation = {};  // Group together all tests done on that gene- any mask, any test

            aggregationData.groups.forEach(function (result) {
                if (!groupedAggregation.hasOwnProperty(result.group)) {
                    groupedAggregation[result.group] = [];
                }
                groupedAggregation[result.group].push(result.pvalue);
            });

            // Annotate any genes that have test results
            genesData.forEach(function (gene) {
                var gene_id = gene.gene_name;
                var tests = groupedAggregation[gene_id];
                if (tests) {
                    gene.aggregation_best_pvalue = Math.min.apply(null, tests);
                }
            });
            return genesData;
        }
    });


    // Public interface for this extension; since everything is registered w/LocusZoom, this is rarely used directly.
    return {
        AggregationTestSource: AggregationTestSource,
        AssocFromAggregationLZ: AssocFromAggregationLZ,
        GeneAggregationConnectorLZ: GeneAggregationConnectorLZ
    };
}));
