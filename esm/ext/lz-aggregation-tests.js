/**
 * LocusZoom extensions used to calculate and render aggregation test results. Because these calculations depend on an
 *   external library, the special data adapters are defined here, rather than in LocusZoom core code.
 *
 * This extension provides a number of features that are closely tied to the aggregation tests demo,
 *  and thus the specific UI and data operations are less of a drop-in generic addon than most other extensions.
 *  This tool also depends on a calculation tool (like RAREMETAL-server) with access to sample specific genotypes.
 *
 * ### Loading and usage
 * The page must incorporate and load all libraries before this file can be used, including:
 *    - LocusZoom
 *    - raremetal.js (available via NPM or a related CDN)
 *
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN (after any dependencies):
 * ```
 * <script src="https://cdn.jsdelivr.net/npm/locuszoom@INSERT_VERSION_HERE/dist/ext/lz-aggregation-tests.min.js" type="application/javascript"></script>
 * ```
 *
 * To use with ES6 modules, the plugin must be loaded and registered explicitly before use:
 * ```
 * import LocusZoom from 'locuszoom';
 * import aggTests from 'locuszoom/esm/ext/lz-aggregation-tests';
 * LocusZoom.use(aggTests);
 * ```
 *
 * Then use the layouts and data adapters made available by this extension. (see demos and documentation for guidance)
 * @private
 * @module
 */
// This is defined as a UMD module, to work with multiple different module systems / bundlers
// Arcane build note: everything defined here gets registered globally. This is not a "pure" module, and some build
//  systems may require being told that this file has side effects.

import {helpers} from 'raremetal.js';

function install (LocusZoom) {
    const BaseUrlAdapter = LocusZoom.Adapters.get('BaseLZAdapter');

    /**
     * Calculates gene or region-based tests based on provided data, using the raremetal.js library.
     *   It will rarely be used by itself, but rather using a connector that attaches the results to data from
     *   another source (like genes). Using a separate connector allows us to add caching and run this front-end
     *   calculation only once, while using it in many different places.
     * @see module:ext/lz-aggregation-tests
     * @private
     */
    class AggregationTestSourceLZ extends BaseUrlAdapter {
        constructor(config) {
            config.prefix_namespace = false;
            super(config);
        }

        _buildRequestOptions(state) {
            const { aggregation_tests = {} } = state;
            const {
                // eslint-disable-next-line no-unused-vars
                genoset_id = null, genoset_build = null, phenoset_build = null, pheno = null, calcs = {}, masks = [],
            } = aggregation_tests;

            aggregation_tests.mask_ids = masks.map((item) => item.name);
            // Many of these params will be undefined if no tests defined
            state.aggregation_tests = aggregation_tests;
            return state;
        }

        _getURL(options) {
            // Unlike most sources, calculations may require access to plot state data even after the initial request
            // This example source REQUIRES that the external UI widget would store the needed test definitions in a plot state
            //  field called `aggregation_tests` (an object {masks: [], calcs: {})
            return this._url;
        }

        _getCacheKey(options) {
            const { chr, start, end, aggregation_tests } = options;
            const { genoset_id = null, genoset_build = null, phenoset_id = null, pheno = null, mask_ids } = aggregation_tests;

            return JSON.stringify({
                chrom: chr,
                start: start,
                stop: end,
                genotypeDataset: genoset_id,
                phenotypeDataset: phenoset_id,
                phenotype: pheno,
                samples: 'ALL',
                genomeBuild: genoset_build,
                masks: mask_ids,
            });
        }

        _performRequest(options) {
            const url = this._getURL(options);
            const body = this._getCacheKey(options);  // cache key doubles as request body
            const headers = {
                'Content-Type': 'application/json',
            };

            return fetch(url, {method: 'POST', body: body, headers: headers})
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }
                    return response.text();
                }).then((resp) => {
                    const json = typeof resp == 'string' ? JSON.parse(resp) : resp;
                    if (json.error) {
                        // RAREMETAL-server quirk: The API sometimes returns a 200 status code for failed requests,
                        //    with a human-readable error description as a key
                        // For now, this should be treated strictly as an error
                        throw new Error(json.error);
                    }
                    return json.data;
                });
        }

        _annotateRecords(records, options) {
            // The server response gives covariance for a set of masks, but the actual calculations are done separately.
            //   Eg, several types of aggtests might use the same covariance matrix.

            // TODO In practice, the test calculations are slow. Investigate caching full results (returning all from performRequest), not just covmat.
            // This code is largely for demonstration purposes and does not reflect modern best practices possible in LocusZoom (eg sources + dependencies to link together requests)
            const { aggregation_tests } = options;
            const { calcs = [], mask_ids = [], masks = [] } = aggregation_tests;

            // In a page using live API data, the UI would only request the masks it needs from the API.
            // But in our demos, sometimes boilerplate JSON has more masks than the UI asked for. Limit what calcs we run (by
            //  type, and to the set of groups requested by the user)

            // The Raremetal-server API has a quirk: it returns a different payload structure if no groups are defined
            //  for the request region. Detect when that happens and end the calculation immediately in that case
            if (!records.groups) {
                return { groups: [], variants: [] };
            }

            records.groups = records.groups.filter((item) => item.groupType === 'GENE');

            const parsed = helpers.parsePortalJSON(records);
            let groups = parsed[0];
            const variants = parsed[1];
            // Some APIs may return more data than we want (eg simple sites that are just serving up premade scorecov json files).
            //  Filter the response to just what the user has chosen to analyze.
            groups = groups.byMask(mask_ids);

            // Determine what calculations to run
            if (!calcs || Object.keys(calcs).length === 0) {
                // If no calcs have been requested, then return a dummy placeholder immediately
                return { variants: [], groups: [], results: [] };
            }
            const runner = new helpers.PortalTestRunner(groups, variants, calcs);

            return runner.toJSON()
                .then(function (res) {
                    // Internally, raremetal helpers track how the calculation is done, but not any display-friendly values
                    // We will annotate each mask name (id) with a human-friendly description for later use
                    const mask_id_to_desc = masks.reduce((acc, val) => {
                        acc[val.name] = val.description;
                        return acc;
                    }, {});
                    res.data.groups.forEach((group) => {
                        group.mask_name = mask_id_to_desc[group.mask];
                    });
                    return res.data;
                })
                .catch(function (e) {
                    console.error(e);
                    throw new Error('Failed to calculate aggregation test results');
                });
        }
    }

    /**
     * Restructure RAREMETAL-SERVER data used to calculate aggregation tests into a format that can be used to
     *  display a GWAS scatter plot.
     * @see module:ext/lz-aggregation-tests
     * @see module:LocusZoom_Adapters
     * @private
     */
    class AssocFromAggregationLZ extends BaseUrlAdapter {
        _buildRequestOptions(state, agg_results) {
            // This adapter just reformats an existing payload from cache (maybe this is better as a data_operation instead of an adapter nowadays?)
            if (!agg_results) {
                throw new Error('Aggregation test results must be provided');
            }
            state._agg_results = agg_results;
            return state;
        }

        _performRequest(options) {
            return Promise.resolve(options._agg_results['variants']);
        }

        _normalizeResponse(data) {
            // The payload structure of the association source is slightly different than the one required by association
            //   plots. For example, we need to parse variant names and convert to log_pvalue
            const REGEX_EPACTS = new RegExp('(?:chr)?(.+):(\\d+)_?(\\w+)?/?([^_]+)?_?(.*)?');  // match API variant strings
            return data.map((item) => {
                const { variant, altFreq, pvalue } = item;
                const match = variant.match(REGEX_EPACTS);
                const [_, chromosome, position, ref_allele] = match;
                return {
                    variant: variant,
                    chromosome,
                    position: +position,
                    ref_allele,
                    ref_allele_freq: 1 - altFreq,
                    log_pvalue: -Math.log10(pvalue),
                };
            }).sort((a, b) => {
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
    }

    const genes_plus_aggregation = (state, [genes_data, aggregation_data]) => {
        // Used to highlight genes with significant aggtest results. Unlike a basic left join, it chooses one specific aggtest with the most significant results

        // Tie the calculated group-test results to genes with a matching name
        const groupedAggregation = {};  // Group together all tests done on that gene- any mask, any test

        aggregation_data.groups.forEach(function (result) {
            if (!Object.prototype.hasOwnProperty.call(groupedAggregation, result.group)) {
                groupedAggregation[result.group] = [];
            }
            groupedAggregation[result.group].push(result.pvalue);
        });

        // Annotate any genes that have test results
        genes_data.forEach((gene) => {
            const gene_id = gene.gene_name;
            const tests = groupedAggregation[gene_id];
            if (tests) {
                gene.aggregation_best_pvalue = Math.min.apply(null, tests);
            }
        });
        return genes_data;
    };
    LocusZoom.DataFunctions.add('gene_plus_aggregation', genes_plus_aggregation);

    LocusZoom.Adapters.add('AggregationTestSourceLZ', AggregationTestSourceLZ);
    LocusZoom.Adapters.add('AssocFromAggregationLZ', AssocFromAggregationLZ);
}


if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;
