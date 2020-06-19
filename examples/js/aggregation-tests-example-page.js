/**
 Custom code used to demonstrate interactive page widget features in the aggregation test visualization example
 */
'use strict';

/* global $, raremetal, Vue, LzDynamicUrls */
/* eslint-disable no-unused-vars */


const Observable = function () { // Allow UI elements to monitor changes in a variable
    // Very simplified observable: a() to get value, a(val) to set, a.subscribe(fn) to add handlers
    const _subscribers = [];
    let current_value;
    const handle_value = function (value) {
        if (value === undefined) {
            return current_value;
        }
        if (current_value !== value) {
            current_value = value;
            _subscribers.forEach(function (handler) {
                try {
                    handler(value);
                } catch (error) {
                    console.error(error);
                }
            });
        }
    };
    handle_value.subscribe = function (handler) {
        _subscribers.push(handler);
    };
    return handle_value;
};

// Make a custom layout object
function customizePlotLayout(layout) {
    // Customize an existing plot layout with the data for aggregation tests
    // Customize layout:
    // 1. The association panel must pull from aggregation tests in order to draw on that data
    // 2. Genes layer must pull from the aggregation source + the aggregation_genes connector if we want to color
    //  the gene track by aggregation test results

    // Allow users to select custom LD population. This button isn't part of the builtin LocusZoom layouts because not
    //  everyone uses the UM 1000G LDServer (LDLZ2 datasource)
    layout.dashboard.components.push(LocusZoom.Layouts.get('dashboard_components', 'ldlz2_pop_selector'));

    const assocLayout = layout.panels[0].data_layers[2];
    assocLayout.fields.unshift('aggregation: all');

    const genesLayout = layout.panels[1].data_layers[0];
    genesLayout.namespace['aggregation'] = 'aggregation';
    genesLayout.namespace['aggregation_genes'] = 'aggregation_genes';
    genesLayout.fields.push('aggregation:all', 'aggregation_genes:all');
    const colorConfig = [
        {
            scale_function: 'if',
            field: 'aggregation_best_pvalue',
            parameters: {
                field_value: null,
                then: '#B8B8B8'
            }
        },
        {
            scale_function: 'numerical_bin',
            field: 'aggregation_best_pvalue',
            // This UI is for gene-based tests, hence Default significance threshold is based on 20k human protein coding genes
            parameters: {
                breaks: [0, 0.05 / 20000],
                values: ['#d43f3a', '#357ebd']
            }
        }
    ];
    genesLayout.color = colorConfig;
    genesLayout.stroke = colorConfig;
    return layout;
}

function _formatSciNotation(cell, params) {
    // Tabulator cell formatter using sci notation
    const value = cell.getValue();
    return LocusZoom.TransformationFunctions.get('scinotation')(value);
}

function jumpToRegion(plot, input_selector, error_selector) {
    const input = document.getElementById(input_selector);
    const error = document.getElementById(error_selector);
    error.style.display = 'none';
    const target = input.value || input.placeholder || '';

    const match = target.match(/^([0-9XY]+):(\d+)-(\d+)/);
    if (!match) {
        error.style.display = '';
    } else {
        plot.applyState({
            chr: match[1],
            start: +match[2],
            end: +match[3]
        });
    }
}

// Controllers for page widgets
/**
 * Define shared functionality for all tables, providing helper methods to control the tabulator
 *  table library
 * @class
 */
class GenericTabulatorTableController {
    /**
     *
     * @param {string|Object} selector A selector string for the table container
     * @param {object} table_config An object specifying the tabulator layout for this table
     */
    constructor(selector, table_config) {
        if (typeof selector === 'string') {
            selector = $(selector);
        }
        this.selector = selector;
        this._table_config = table_config;

        this.selector.tabulator(this._table_config);
    }

    /**
     * Callback that takes in data and renders an HTML table to a hardcoded document location
     * @param {object} data
     */
    _tableUpdateData(data) {
        this.selector.tabulator('setData', data);
    }

    /**
     * Stub. Override this method to transform the data in ways specific to this table.
     * @param data
     * @returns {*}
     */
    prepareData(data) {
        return data;
    }

    renderData(data) {
        data = this.prepareData(data);
        this._tableUpdateData(data);
    }

    tableSetFilter(column, value) {
        this.selector.tabulator('setFilter', column, '=', value);
    }

    tableClearFilter(column, value) {
        if (typeof value !== 'undefined') {
            this.selector.tabulator('removeFilter', column, '=', value);
        } else {
            this.selector.tabulator('clearFilter');
        }

    }

    tableDownloadData(filename, format) {
        format = format || 'csv';
        this.selector.tabulator('download', format, filename);
    }
}


class AggregationTableController extends GenericTabulatorTableController {
    prepareData(data) {
        return data.groups.data; // Render function only needs a part of the "computed results" JSON it is given
    }
}


class VariantsTableController extends GenericTabulatorTableController {}


/**
 * Creates the plot and tables. This function contains references to specific DOM elements on one HTML page.
 * @param {Observable|function} label_store Observable used to label the selected group
 * @param {Object} [context=window] A reference to the widgets will be added here, allowing them to be accessed
 *  outside the function later (eg for debugging purposes)
 */
function createDisplayWidgets(label_store, context) {
    // eslint-disable-next-line no-undef
    context = context || window;

    // Determine if we're online, based on browser state or presence of an optional query parameter
    // eslint-disable-next-line no-undef
    let online = !(typeof navigator !== 'undefined' && !navigator.onLine);
    // eslint-disable-next-line no-undef
    if (window.location.search.indexOf('offline') !== -1) {
        online = false;
    }

    // Specify the data sources to use, then build the plot
    const apiBase = '//portaldev.sph.umich.edu/api/v1/';
    const data_sources = new LocusZoom.DataSources()
        .add('aggregation', ['AggregationTestSourceLZ', { url: 'https://portaldev.sph.umich.edu/raremetal/v1/aggregation/covariance' }])
        .add('assoc', ['AssocFromAggregationLZ', {  // Use a special source that restructures already-fetched data
            from: 'aggregation',
            params: { id_field: 'variant' }
        }])
        .add('ld', ['LDLZ2', {
            url: 'https://portaldev.sph.umich.edu/ld/',
            params: { source: '1000G', build: 'GRCh37', population: 'ALL' }
        }])
        .add('gene', ['GeneLZ', { url: apiBase + 'annotation/genes/', params: { build: 'GRCh37' } }])
        .add('aggregation_genes', ['GeneAggregationConnectorLZ', {
            sources: {
                aggregation_ns: 'aggregation',
                gene_ns: 'gene'
            }
        }])
        .add('recomb', ['RecombLZ', { url: apiBase + 'annotation/recomb/results/', params: { build: 'GRCh37' } }])
        .add('constraint', ['GeneConstraintLZ', {
            url: 'https://gnomad.broadinstitute.org/api',
            params: { build: 'GRCh37' }
        }]);

    const stateUrlMapping = { chr: 'chrom', start: 'start', end: 'end' };
    let initialState = LzDynamicUrls.paramsFromUrl(stateUrlMapping);
    if (!Object.keys(initialState).length) {
        initialState = { chr: '19', start: 45312079, end: 45512079 };
    }

    let layout = LocusZoom.Layouts.get('plot', 'standard_association', { state: initialState });
    layout = customizePlotLayout(layout);

    const plot = LocusZoom.populate('#lz-plot', data_sources, layout);
    // Add a basic loader to each panel (one that shows when data is requested and hides when one rendering)
    plot.layout.panels.forEach(function(panel) {
        plot.panels[panel.id].addBasicLoader();
    });

    // Changes in the plot can be reflected in the URL, and vice versa (eg browser back button can go back to
    //   a previously viewed region)
    LzDynamicUrls.plotUpdatesUrl(plot, stateUrlMapping);
    LzDynamicUrls.plotWatchesUrl(plot, stateUrlMapping);

    const TABLE_SELECTOR_AGGREGATION = '#results-table-aggregation';
    const TABLE_SELECTOR_VARIANTS = '#results-table-variants';

    const aggregationTable = new AggregationTableController(TABLE_SELECTOR_AGGREGATION, {
        index: 'id',
        height: 300,
        layout: 'fitColumns',
        layoutColumnsOnNewData: true,
        rowSelected: function (row) {
            label_store(row.row.data); // Tabulator doesn't allow changing options after creation
        },
        rowDeselected: function () {
            label_store(null);
        },
        columns: [
            {
                title: 'Gene', field: 'group', formatter: 'link', widthGrow: 3,
                // TODO: exac gives timeouts if we use https
                formatterParams: { urlPrefix: 'http://exac.broadinstitute.org/gene/', labelField: 'group_display_name' }
            },
            { title: 'Mask', field: 'mask_name', headerFilter: true, widthGrow: 8 },
            { title: '# Variants', field: 'variant_count', widthGrow: 2 },
            { title: 'Test type', field: 'test', headerFilter: true, widthGrow: 2 },
            { title: 'p-value', field: 'pvalue', formatter: _formatSciNotation, sorter: 'number', widthGrow: 2 },
            {
                title: 'Statistic',
                field: 'stat',
                formatter: _formatSciNotation,
                sorter: 'number',
                visible: false,
                widthGrow: 2
            }
        ],
        placeholder: 'No Data Available',
        initialSort: [
            { column: 'pvalue', dir: 'asc' }
        ],
        selectable: 1,
        selectablePersistence: false
    });

    const variantsTable = new VariantsTableController(TABLE_SELECTOR_VARIANTS, {
        height: 300,
        layout: 'fitColumns',
        layoutColumnsOnNewData: true,
        index: 'id',
        columns: [
            { title: 'Variant', field: 'variant' },
            { title: 'p-value', field: 'pvalue', formatter: _formatSciNotation, sorter: 'number' },
            { title: 'Alt allele frequency', field: 'altFreq', formatter: _formatSciNotation, sorter: 'number' }
        ],
        placeholder: 'No Data Available',
        initialSort: [
            { column: 'variant', dir: 'asc' }
        ]
    });

    ////////////////////////////////
    // Make certain symbols available later in outer scope, eg for debugging
    context.data_sources = data_sources;
    context.plot = plot;

    context.aggregationTable = aggregationTable;
    context.variantsTable = variantsTable;
}

/**
 * Connect a very specific set of widgets together to drive the user experience for this page.
 *
 * Because many things are clickable, this consists of several small pieces. The key concepts are:
 * 1. Allow the plot to tell us when aggregation test results are available.
 * 2. Take that data and update a table
 * 3. If something important gets clicked, update parts of the view that depend on it
 * 4. Have a well-defined way to coordinate many widgets that depend on a common value
 * @param plot
 * @param aggregationTable
 * @param variantsTable
 * @param {Observable} resultStorage Observable that holds calculation results
 * @param {Observable} labelStorage Observable used to label the selected group
 */
function setupWidgetListeners(plot, aggregationTable, variantsTable, resultStorage, labelStorage) {
    plot.on('element_selection', function (eventData) {
        // Trigger the aggregation test table to filter (or unfilter) if a specific gene on the genes panel is clicked
        if (eventData['sourceID'] !== 'lz-plot.genes') {
            return;
        }

        const gene_column_name = 'group';
        const selected_gene = eventData['data']['element']['gene_name'];

        if (eventData['data']['active']) {
            aggregationTable.tableSetFilter(gene_column_name, selected_gene);
            $('#label-no-group-selected').hide();
            $('#label-current-group-selected').show().text(selected_gene);
        } else {
            $('#label-no-group-selected').show();
            $('#label-current-group-selected').hide();
            aggregationTable.tableClearFilter(gene_column_name, selected_gene);
        }
    }.bind(this));

    plot.subscribeToData(
        ['aggregation:all', 'gene:all'],
        function (data) {
            // chain.discrete provides distinct data from each source
            const gene_source_data = data.gene;
            const agg_source_data = data.aggregation;

            const results = agg_source_data.results;

            // Aggregation calcs return very complex data. Parse it here, once, into reusable helper objects.
            const parsed = raremetal.helpers.parsePortalJSON(agg_source_data);
            const groups = parsed[0];
            const variants = parsed[1];

            /////////
            // Post-process this data with any annotations required by data tables on this page

            // The aggregation results use the unique ENSEMBL ID for a gene. The gene source tells us how to connect
            //  that to a human-friendly gene name (as displayed in the LZ plot)
            const _genes_lookup = {};
            gene_source_data.forEach(function (gene) {
                const gene_id = gene.gene_id.split('.')[0]; // Ignore ensembl version on gene ids
                _genes_lookup[gene_id] = gene.gene_name;
            });
            groups.data.forEach(function (one_result) {
                const this_group = groups.getOne(one_result.mask, one_result.group);
                // Add synthetic fields that are not part of the raw calculation results
                one_result.group_display_name = _genes_lookup[one_result.group] || one_result.group;
                one_result.variant_count = this_group.variants.length;
            });

            // When new data has been received (and post-processed), pass it on to any UI elements that use that data
            resultStorage({
                groups: groups,
                variants: variants
            });
        },
        { discrete: true }
    );

    // When results are updated, make sure we are not "drilling down" into a calculation that no longer exists
    resultStorage.subscribe(aggregationTable.renderData.bind(aggregationTable));
    resultStorage.subscribe(labelStorage.bind(null, null)); // just wipe the labels
    plot.on('element_selection', labelStorage.bind(null, null));

    // The UI is based on "drilling down" to explore results. If a user selects a group, display stuff
    labelStorage.subscribe(function (data) {  // User-friendly label
        let text = '';
        if (data) {
            text = data.mask_name + ' / ' + data.group_display_name;
        }
        $('#label-mask-selected').text(text);
    });
    labelStorage.subscribe(function (data) { // Update the "show me what variants are in a selected group" table
        const calcs = resultStorage();
        if (!data || !calcs) { // If no analysis is selected, no analysis should be shown
            variantsTable.renderData([]);
            return;
        }
        // When a group is selected, draw a variants table with information about that group.
        const one_group = calcs.groups.getOne(data.mask, data.group);
        const variant_data = calcs.variants.getGroupVariants(one_group.variants);
        variantsTable.renderData(variant_data);
    });

    //////////////////////////////////////////////////////////////
    // Generic UI controls: what to do when buttons are clicked
    $('#download-aggregation').on('click', function () {
        aggregationTable.tableDownloadData('aggregation-data.csv', 'csv');
    });

    $('#download-variants').on('click', function () {
        variantsTable.tableDownloadData('variants-data.csv', 'csv');
    });
}


function makeUI(selector, geno_id, build, masks, phenotypes) {
    // The UI is written in Vue.js. Although modern tooling can be nice, this example can be reused via plain JS.
    return new Vue({
        el: selector,
        data: function () {
            return {
                // options passed in at creation
                masks: masks,
                phenotypes: phenotypes,  // { categoryID: {description: str, phenotypes: [str]} }
                calc_names: [
                    ['burden', 'Burden'],
                    ['skat', 'SKAT'],
                    ['vt', 'VT'],
                    ['skat-o', 'SKAT-O']
                ],
                // Tracking internal state
                status_css: { color: 'red' },
                status_message: null,

                // Track information that will be required to run the calculation
                genoset_id: geno_id,
                genome_build: build,

                // API supports one pheno/multiple masks/ multiple tests
                selected_phenotype: null,
                selected_masks: [],
                selected_tests: [],
            };
        },
        methods: {
            setStatus: function (message, success) {
                this.status_message = message;
                this.status_css.color = success ? 'green' : 'red';
            },
            isValid: function () {
                return this.selected_phenotype && this.selected_masks.length && this.selected_tests.length;
            },
            runTests: function () {
                const status = this.isValid();
                this.setStatus(status ? '' : 'Please select at least one option from each category', status);
                const by_cat = this.phenotypes;
                const selected = this.selected_phenotype;

                if (status) {
                    // Slightly inelegant demo UI : assumes phenonames are globally unique and we find the first match
                    let phenosetId;
                    for (let pId in by_cat) {
                        if (!Object.prototype.hasOwnProperty.call(by_cat, pId)) {
                            continue;
                        }
                        const pheno_list = this.phenotypes[pId].phenotypes;
                        if (pheno_list.find(function (element) {
                            return element.name === selected;
                        })) {
                            phenosetId = pId;
                            break;
                        }
                    }
                    this.$emit('run', {
                        genoset_id: this.genoset_id,
                        genoset_build: this.genome_build,
                        phenoset_id: +phenosetId,
                        pheno: selected,
                        calcs: this.selected_tests.slice(),
                        masks: this.selected_masks.slice(),
                    });
                }
            }
        },
    });
}
