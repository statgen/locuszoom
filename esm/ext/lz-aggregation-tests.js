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
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN:
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
    const BaseAdapter = LocusZoom.Adapters.get('BaseAdapter');
    const BaseApiAdapter = LocusZoom.Adapters.get('BaseApiAdapter');
    const ConnectorSource = LocusZoom.Adapters.get('ConnectorSource');

    /**
     * Calculates gene or region-based tests based on provided data, using the raremetal.js library.
     *   It will rarely be used by itself, but rather using a connector that attaches the results to data from
     *   another source (like genes). Using a separate connector allows us to add caching and run this front-end
     *   calculation only once, while using it in many different places.
     * @see module:ext/lz-aggregation-tests
     * @private
     */
    class AggregationTestSourceLZ extends BaseApiAdapter {
        getURL(state, chain, fields) {
            // Unlike most sources, calculations may require access to plot state data even after the initial request
            // This example source REQUIRES that the external UI widget would store the needed test definitions in a plot state
            //  field called `aggregation_tests` (an object {masks: [], calcs: {})
            const required_info = state.aggregation_tests || {};

            if (!chain.header) {
                chain.header = {};
            }
            // All of these fields are required in order to use this datasource. TODO: Add validation?
            chain.header.aggregation_genoset_id = required_info.genoset_id || null; // Number
            chain.header.aggregation_genoset_build = required_info.genoset_build || null; // String
            chain.header.aggregation_phenoset_id = required_info.phenoset_id || null;  // Number
            chain.header.aggregation_pheno = required_info.pheno || null; // String
            chain.header.aggregation_calcs = required_info.calcs || {};  // String[]
            const mask_data = required_info.masks || [];
            chain.header.aggregation_masks = mask_data;  // {name:desc}[]
            chain.header.aggregation_mask_ids = mask_data.map(function (item) {
                return item.name;
            }); // Number[]
            return this.url;
        }

        getCacheKey(state, chain, fields) {
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
        }

        fetchRequest(state, chain, fields) {
            const url = this.getURL(state, chain, fields);
            const body = this.getCacheKey(state, chain, fields);
            const headers = {
                'Content-Type': 'application/json',
            };

            return fetch(url, {method: 'POST', body: body, headers: headers}).then((response) => {
                if (!response.ok) {
                    throw new Error(response.statusText);
                }
                return response.text();
            }).then(function (resp) {
                const json = typeof resp == 'string' ? JSON.parse(resp) : resp;
                if (json.error) {
                    // RAREMETAL-server quirk: The API sometimes returns a 200 status code for failed requests,
                    //    with a human-readable error description as a key
                    // For now, this should be treated strictly as an error
                    throw new Error(json.error);
                }
                return json;
            });
        }

        annotateData(records, chain) {
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

            const parsed = helpers.parsePortalJSON(records);
            let groups = parsed[0];
            const variants = parsed[1];
            // Some APIs may return more data than we want (eg simple sites that are just serving up premade scorecov json files).
            //  Filter the response to just what the user has chosen to analyze.
            groups = groups.byMask(chain.header.aggregation_mask_ids);

            // Determine what calculations to run
            const calcs = chain.header.aggregation_calcs;
            if (!calcs || Object.keys(calcs).length === 0) {
                // If no calcs have been requested, then return a dummy placeholder immediately
                return { variants: [], groups: [], results: [] };
            }
            const runner = new helpers.PortalTestRunner(groups, variants, calcs);

            return runner.toJSON()
                .then(function (res) {
                    // Internally, raremetal helpers track how the calculation is done, but not any display-friendly values
                    // We will annotate each mask name (id) with a human-friendly description for later use
                    const mask_id_to_desc = chain.header.aggregation_masks.reduce(function (acc, val) {
                        acc[val.name] = val.description;
                        return acc;
                    }, {});
                    res.data.groups.forEach(function (group) {
                        group.mask_name = mask_id_to_desc[group.mask];
                    });
                    return res.data;
                })
                .catch(function (e) {
                    console.error(e);
                    throw new Error('Failed to calculate aggregation test results');
                });
        }

        normalizeResponse(data) {
            return data;
        }

        combineChainBody(records, chain) {
            // aggregation tests are a bit unique, in that the data is rarely used directly- instead it is used to annotate many
            //  other layers in different ways. The calculated result has been added to `chain.discrete`, but will not be returned
            //  as part of the response body built up by the chain
            return chain.body;
        }

    }

    /**
     * Restructure RAREMETAL-SERVER data used to calculate aggregation tests into a format that can be used to
     *  display a GWAS scatter plot.
     * @see module:ext/lz-aggregation-tests
     * @see module:LocusZoom_Adapters
     * @private
     */
    class AssocFromAggregationLZ extends BaseAdapter {
        constructor(config) {
            if (!config || !config.from) {
                throw 'Must specify the name of the source that contains association data';
            }
            super(...arguments);
        }
        parseInit(config) {
            super.parseInit(config);
            this._from = config.from;
        }

        getRequest(state, chain, fields) {
            // Does not actually make a request. Just pick off the specific bundle of data from a known payload structure.
            if (chain.discrete && !chain.discrete[this._from]) {
                throw `${this.constructor.SOURCE_NAME} cannot be used before loading required data for: ${this._from}`;
            }
            // Copy the data so that mutations (like sorting) don't affect the original
            return Promise.resolve(JSON.parse(JSON.stringify(chain.discrete[this._from]['variants'])));
        }

        normalizeResponse(data) {
            // The payload structure of the association source is slightly different than the one required by association
            //   plots. For example, we need to parse variant names and convert to log_pvalue
            const REGEX_EPACTS = new RegExp('(?:chr)?(.+):(\\d+)_?(\\w+)?/?([^_]+)?_?(.*)?');  // match API variant strings
            return data.map((one_variant) => {
                const match = one_variant.variant.match(REGEX_EPACTS);
                return {
                    variant: one_variant.variant,
                    chromosome: match[1],
                    position: +match[2],
                    ref_allele: match[3],
                    ref_allele_freq: 1 - one_variant.altFreq,
                    log_pvalue: -Math.log10(one_variant.pvalue),
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

    /**
     * A sample connector that aligns calculated aggregation test data with corresponding gene information. Returns a body
     *   suitable for use with the genes datalayer.
     *
     *  To use this source, one must specify a fields array that calls first the genes source, then a dummy field from
     *      this source. The output will be to transparently add several new fields to the genes data.
     * @see module:ext/lz-aggregation-tests
     * @see module:LocusZoom_Adapters
     * @private
     */
    class GeneAggregationConnectorLZ extends ConnectorSource {
        _getRequiredSources() {
            return ['gene_ns', 'aggregation_ns'];
        }

        combineChainBody(data, chain) {
            // The genes layer receives all results, and displays only the best pvalue for each gene

            // Tie the calculated group-test results to genes with a matching name
            const aggregation_source_id = this._source_name_mapping['aggregation_ns'];
            const gene_source_id = this._source_name_mapping['gene_ns'];
            // This connector assumes that genes are the main body of records from the chain, and that aggregation tests are
            //   a standalone source that has not acted on genes data yet
            const aggregationData = chain.discrete[aggregation_source_id];
            const genesData = chain.discrete[gene_source_id];

            const groupedAggregation = {};  // Group together all tests done on that gene- any mask, any test

            aggregationData.groups.forEach(function (result) {
                if (!Object.prototype.hasOwnProperty.call(groupedAggregation, result.group)) {
                    groupedAggregation[result.group] = [];
                }
                groupedAggregation[result.group].push(result.pvalue);
            });

            // Annotate any genes that have test results
            genesData.forEach(function (gene) {
                const gene_id = gene.gene_name;
                const tests = groupedAggregation[gene_id];
                if (tests) {
                    gene.aggregation_best_pvalue = Math.min.apply(null, tests);
                }
            });
            return genesData;
        }
    }


    LocusZoom.Adapters.add('AggregationTestSourceLZ', AggregationTestSourceLZ);
    LocusZoom.Adapters.add('AssocFromAggregationLZ', AssocFromAggregationLZ);
    LocusZoom.Adapters.add('GeneAggregationConnectorLZ', GeneAggregationConnectorLZ);
}


if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;
