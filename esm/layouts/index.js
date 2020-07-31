/**
 * Predefined base layouts used to populate the LZ registry
 * @module
 * @private
 */

import { version } from '../../package.json';
import {deepCopy, merge} from '../helpers/layouts';

const LZ_SIG_THRESHOLD_LOGP = 7.301; // -log10(.05/1e6)

/**
 * Tooltip Layouts
 */
const standard_association_tooltip = {
    namespace: { 'assoc': 'assoc' },
    closable: true,
    show: { or: ['highlighted', 'selected'] },
    hide: { and: ['unhighlighted', 'unselected'] },
    html: `<strong>{{{{namespace[assoc]}}variant|htmlescape}}</strong><br>
        P Value: <strong>{{{{namespace[assoc]}}log_pvalue|logtoscinotation|htmlescape}}</strong><br>
        Ref. Allele: <strong>{{{{namespace[assoc]}}ref_allele|htmlescape}}</strong><br>
        <a href="javascript:void(0);" 
        onclick="var data = this.parentNode.__data__;
                 data.getDataLayer().makeLDReference(data);"
                 >Make LD Reference</a><br>`,
};

const standard_association_tooltip_with_label = function() {
    // Add a special "toggle label" button to the base tooltip. This must be used in tandem with a custom layout
    //   directive (label.filters should check a boolean annotation field called "lz_show_label").
    const base = deepCopy(standard_association_tooltip);
    base.html += `<a href="javascript:void(0);" 
                  onclick="var item = this.parentNode.__data__, layer = item.getDataLayer(); 
                  var current = layer.getElementAnnotation(item, 'lz_show_label'); 
                  layer.setElementAnnotation(item, 'lz_show_label', !current );
                  layer.parent_plot.applyState();">Toggle label</a>`;
    return base;
}();

const standard_genes_tooltip = {
    closable: true,
    show: { or: ['highlighted', 'selected'] },
    hide: { and: ['unhighlighted', 'unselected'] },
    html: '<h4><strong><i>{{gene_name|htmlescape}}</i></strong></h4>'
        + 'Gene ID: <a href="https://useast.ensembl.org/homo_sapiens/Gene/Summary?g={{gene_id|htmlescape}}&db=core" target="_blank" rel="noopener">{{gene_id|htmlescape}}</a><br>'
        + 'Transcript ID: <strong>{{transcript_id|htmlescape}}</strong><br>'
        + '{{#if pLI}}<table>'
        + '<tr><th>Constraint</th><th>Expected variants</th><th>Observed variants</th><th>Const. Metric</th></tr>'
        + '<tr><td>Synonymous</td><td>{{exp_syn}}</td><td>{{obs_syn}}</td><td>z = {{syn_z}}<br>o/e = {{oe_syn}} ({{oe_syn_lower}} - {{oe_syn_upper}})</td></tr>'
        + '<tr><td>Missense</td><td>{{exp_mis}}</td><td>{{obs_mis}}</td><td>z = {{mis_z}}<br>o/e = {{oe_mis}} ({{oe_mis_lower}} - {{oe_mis_upper}})</td></tr>'
        + '<tr><td>pLoF</td><td>{{exp_lof}}</td><td>{{obs_lof}}</td><td>pLI = {{pLI}}<br>o/e = {{oe_lof}} ({{oe_lof_lower}} - {{oe_lof_upper}})</td></tr>'
        + '</table><br>{{/if}}'
        + '<a href="https://gnomad.broadinstitute.org/gene/{{gene_id|htmlescape}}" target="_blank" rel="noopener">More data on gnomAD</a>',
};

const catalog_variant_tooltip = {
    namespace: { 'assoc': 'assoc', 'catalog': 'catalog' },
    closable: true,
    show: { or: ['highlighted', 'selected'] },
    hide: { and: ['unhighlighted', 'unselected'] },
    html: '<strong>{{{{namespace[catalog]}}variant|htmlescape}}</strong><br>'
        + 'Catalog entries: <strong>{{n_catalog_matches|htmlescape}}</strong><br>'
        + 'Top Trait: <strong>{{{{namespace[catalog]}}trait|htmlescape}}</strong><br>'
        + 'Top P Value: <strong>{{{{namespace[catalog]}}log_pvalue|logtoscinotation}}</strong><br>'
        // User note: if a different catalog is used, the tooltip will need to be replaced with a different link URL
        + 'More: <a href="https://www.ebi.ac.uk/gwas/search?query={{{{namespace[catalog]}}rsid|htmlescape}}" target="_blank" rel="noopener">GWAS catalog</a> / <a href="https://www.ncbi.nlm.nih.gov/snp/{{{{namespace[catalog]}}rsid|htmlescape}}" target="_blank" rel="noopener">dbSNP</a>',
};

const coaccessibility_tooltip = {
    namespace: { 'access': 'access' },
    closable: true,
    show: { or: ['highlighted', 'selected'] },
    hide: { and: ['unhighlighted', 'unselected'] },
    // TODO: Is there a more generic terminology? (eg not every technique is in terms of cis-regulatory element)
    html: '<strong>Regulatory element</strong><br>' +
        '{{{{namespace[access]}}start1|htmlescape}}-{{{{namespace[access]}}end1|htmlescape}}<br>' +
        '<strong>Promoter</strong><br>' +
        '{{{{namespace[access]}}start2|htmlescape}}-{{{{namespace[access]}}end2|htmlescape}}<br>' +
        '{{#if {{namespace[access]}}target}}<strong>Target</strong>: {{{{namespace[access]}}target|htmlescape}}<br>{{/if}}' +
        '<strong>Score</strong>: {{{{namespace[access]}}score|htmlescape}}',
};

/**
 * Data Layer Layouts: represent specific information from a data source
 */

const significance_layer = {
    id: 'significance',
    type: 'orthogonal_line',
    orientation: 'horizontal',
    offset: LZ_SIG_THRESHOLD_LOGP,
};

const recomb_rate_layer = {
    namespace: { 'recomb': 'recomb' },
    id: 'recombrate',
    type: 'line',
    fields: ['{{namespace[recomb]}}position', '{{namespace[recomb]}}recomb_rate'],
    z_index: 1,
    style: {
        'stroke': '#0000FF',
        'stroke-width': '1.5px',
    },
    x_axis: {
        field: '{{namespace[recomb]}}position',
    },
    y_axis: {
        axis: 2,
        field: '{{namespace[recomb]}}recomb_rate',
        floor: 0,
        ceiling: 100,
    },
};

const association_pvalues_layer = {
    namespace: { 'assoc': 'assoc', 'ld': 'ld' },
    id: 'associationpvalues',
    type: 'scatter',
    point_shape: {
        scale_function: 'if',
        field: '{{namespace[ld]}}isrefvar',
        parameters: {
            field_value: 1,
            then: 'diamond',
            else: 'circle',
        },
    },
    point_size: {
        scale_function: 'if',
        field: '{{namespace[ld]}}isrefvar',
        parameters: {
            field_value: 1,
            then: 80,
            else: 40,
        },
    },
    color: [
        {
            scale_function: 'if',
            field: '{{namespace[ld]}}isrefvar',
            parameters: {
                field_value: 1,
                then: '#9632b8',
            },
        },
        {
            scale_function: 'numerical_bin',
            field: '{{namespace[ld]}}state',
            parameters: {
                breaks: [0, 0.2, 0.4, 0.6, 0.8],
                values: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
            },
        },
        '#B8B8B8',
    ],
    legend: [
        { shape: 'diamond', color: '#9632b8', size: 40, label: 'LD Ref Var', class: 'lz-data_layer-scatter' },
        { shape: 'circle', color: '#d43f3a', size: 40, label: '1.0 > r² ≥ 0.8', class: 'lz-data_layer-scatter' },
        { shape: 'circle', color: '#eea236', size: 40, label: '0.8 > r² ≥ 0.6', class: 'lz-data_layer-scatter' },
        { shape: 'circle', color: '#5cb85c', size: 40, label: '0.6 > r² ≥ 0.4', class: 'lz-data_layer-scatter' },
        { shape: 'circle', color: '#46b8da', size: 40, label: '0.4 > r² ≥ 0.2', class: 'lz-data_layer-scatter' },
        { shape: 'circle', color: '#357ebd', size: 40, label: '0.2 > r² ≥ 0.0', class: 'lz-data_layer-scatter' },
        { shape: 'circle', color: '#B8B8B8', size: 40, label: 'no r² data', class: 'lz-data_layer-scatter' },
    ],
    label: null,
    fields: ['{{namespace[assoc]}}variant', '{{namespace[assoc]}}position', '{{namespace[assoc]}}log_pvalue', '{{namespace[assoc]}}log_pvalue|logtoscinotation', '{{namespace[assoc]}}ref_allele', '{{namespace[ld]}}state', '{{namespace[ld]}}isrefvar'],
    id_field: '{{namespace[assoc]}}variant',
    z_index: 2,
    x_axis: {
        field: '{{namespace[assoc]}}position',
    },
    y_axis: {
        axis: 1,
        field: '{{namespace[assoc]}}log_pvalue',
        floor: 0,
        upper_buffer: 0.10,
        min_extent: [0, 10],
    },
    behaviors: {
        onmouseover: [
            { action: 'set', status: 'highlighted' },
        ],
        onmouseout: [
            { action: 'unset', status: 'highlighted' },
        ],
        onclick: [
            { action: 'toggle', status: 'selected', exclusive: true },
        ],
        onshiftclick: [
            { action: 'toggle', status: 'selected' },
        ],
    },
    tooltip: deepCopy(standard_association_tooltip),
};

const coaccessibility_layer = {
    namespace: { 'access': 'access' },
    id: 'coaccessibility',
    type: 'arcs',
    fields: ['{{namespace[access]}}start1', '{{namespace[access]}}end1', '{{namespace[access]}}start2', '{{namespace[access]}}end2', '{{namespace[access]}}id', '{{namespace[access]}}target', '{{namespace[access]}}score'],
    match: { send: '{{namespace[access]}}target', receive: '{{namespace[access]}}target' },
    id_field: '{{namespace[access]}}id',
    filters: [
        { field: '{{namespace[access]}}score', operator: '!=', value: null },
    ],
    color: [
        {
            field: 'lz_highlight_match', // Special field name whose presence triggers custom rendering
            scale_function: 'if',
            parameters: {
                field_value: true,
                then: '#ff0000',
            },
        },
        {
            field: 'lz_highlight_match', // Special field name whose presence triggers custom rendering
            scale_function: 'if',
            parameters: {
                field_value: false,
                then: '#EAE6E6',
            },
        },
        {
            scale_function: 'ordinal_cycle',
            parameters: {
                values: ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'], // Drawn from d3v3 "category20"
            },
        },
    ],
    x_axis: {
        field1: '{{namespace[access]}}start1',
        field2: '{{namespace[access]}}start2',
    },
    y_axis: {
        axis: 1,
        field: '{{namespace[access]}}score',
        upper_buffer: 0.1,
        min_extent: [0, 1],
    },
    behaviors: {
        onmouseover: [
            { action: 'set', status: 'highlighted' },
        ],
        onmouseout: [
            { action: 'unset', status: 'highlighted' },
        ],
        onclick: [
            { action: 'toggle', status: 'selected', exclusive: true },
        ],
        onshiftclick: [
            { action: 'toggle', status: 'selected' },
        ],
    },
    tooltip: deepCopy(coaccessibility_tooltip),
};

const association_pvalues_catalog_layer = function () {
    // Slightly modify an existing layout
    let base = deepCopy(association_pvalues_layer);
    base = merge({ id: 'associationpvaluescatalog', fill_opacity: 0.7}, base);
    base.tooltip.html += '{{#if {{namespace[catalog]}}rsid}}<br><a href="https://www.ebi.ac.uk/gwas/search?query={{{{namespace[catalog]}}rsid|htmlescape}}" target="_blank" rel="noopener">See hits in GWAS catalog</a>{{/if}}';
    base.namespace.catalog = 'catalog';
    base.fields.push('{{namespace[catalog]}}rsid', '{{namespace[catalog]}}trait', '{{namespace[catalog]}}log_pvalue');
    return base;
}();

const phewas_pvalues_layer = {
    namespace: { 'phewas': 'phewas' },
    id: 'phewaspvalues',
    type: 'category_scatter',
    point_shape: 'circle',
    point_size: 70,
    tooltip_positioning: 'vertical',
    id_field: '{{namespace[phewas]}}id',
    fields: ['{{namespace[phewas]}}id', '{{namespace[phewas]}}log_pvalue', '{{namespace[phewas]}}trait_group', '{{namespace[phewas]}}trait_label'],
    x_axis: {
        field: '{{namespace[phewas]}}x',  // Synthetic/derived field added by `category_scatter` layer
        category_field: '{{namespace[phewas]}}trait_group',
        lower_buffer: 0.025,
        upper_buffer: 0.025,
    },
    y_axis: {
        axis: 1,
        field: '{{namespace[phewas]}}log_pvalue',
        floor: 0,
        upper_buffer: 0.15,
    },
    color: [{
        field: '{{namespace[phewas]}}trait_group',
        scale_function: 'categorical_bin',
        parameters: {
            categories: [],
            values: [],
            null_value: '#B8B8B8',
        },
    }],
    fill_opacity: 0.7,
    tooltip: {
        closable: true,
        show: { or: ['highlighted', 'selected'] },
        hide: { and: ['unhighlighted', 'unselected'] },
        html: [
            '<strong>Trait:</strong> {{{{namespace[phewas]}}trait_label|htmlescape}}<br>',
            '<strong>Trait Category:</strong> {{{{namespace[phewas]}}trait_group|htmlescape}}<br>',
            '<strong>P-value:</strong> {{{{namespace[phewas]}}log_pvalue|logtoscinotation|htmlescape}}<br>',
        ].join(''),
    },
    behaviors: {
        onmouseover: [
            { action: 'set', status: 'highlighted' },
        ],
        onmouseout: [
            { action: 'unset', status: 'highlighted' },
        ],
        onclick: [
            { action: 'toggle', status: 'selected', exclusive: true },
        ],
        onshiftclick: [
            { action: 'toggle', status: 'selected' },
        ],
    },
    label: {
        text: '{{{{namespace[phewas]}}trait_label|htmlescape}}',
        spacing: 6,
        lines: {
            style: {
                'stroke-width': '2px',
                'stroke': '#333333',
                'stroke-dasharray': '2px 2px',
            },
        },
        filters: [
            {
                field: '{{namespace[phewas]}}log_pvalue',
                operator: '>=',
                value: 20,
            },
        ],
        style: {
            'font-size': '14px',
            'font-weight': 'bold',
            'fill': '#333333',
        },
    },
};

const genes_layer = {
    namespace: { 'gene': 'gene', 'constraint': 'constraint' },
    id: 'genes',
    type: 'genes',
    fields: ['{{namespace[gene]}}all', '{{namespace[constraint]}}all'],
    id_field: 'gene_id',
    behaviors: {
        onmouseover: [
            { action: 'set', status: 'highlighted' },
        ],
        onmouseout: [
            { action: 'unset', status: 'highlighted' },
        ],
        onclick: [
            { action: 'toggle', status: 'selected', exclusive: true },
        ],
        onshiftclick: [
            { action: 'toggle', status: 'selected' },
        ],
    },
    tooltip: deepCopy(standard_genes_tooltip),
};

const annotation_catalog_layer = {
    // Identify GWAS hits that are present in the GWAS catalog
    namespace: { 'assoc': 'assoc', 'catalog': 'catalog' },
    id: 'annotation_catalog',
    type: 'annotation_track',
    id_field: '{{namespace[assoc]}}variant',
    x_axis: {
        field: '{{namespace[assoc]}}position',
    },
    color: '#0000CC',
    fields: [
        '{{namespace[assoc]}}variant', '{{namespace[assoc]}}chromosome', '{{namespace[assoc]}}position',
        '{{namespace[catalog]}}variant', '{{namespace[catalog]}}rsid', '{{namespace[catalog]}}trait',
        '{{namespace[catalog]}}log_pvalue', '{{namespace[catalog]}}pos',
    ],
    filters: [
        // Specify which points to show on the track. Any selection must satisfy ALL filters
        { field: '{{namespace[catalog]}}rsid', operator: '!=', value: null },
        { field: '{{namespace[catalog]}}log_pvalue', operator: '>', value: LZ_SIG_THRESHOLD_LOGP },
    ],
    behaviors: {
        onmouseover: [
            { action: 'set', status: 'highlighted' },
        ],
        onmouseout: [
            { action: 'unset', status: 'highlighted' },
        ],
        onclick: [
            { action: 'toggle', status: 'selected', exclusive: true },
        ],
        onshiftclick: [
            { action: 'toggle', status: 'selected' },
        ],
    },
    tooltip: deepCopy(catalog_variant_tooltip),
    tooltip_positioning: 'top',
};

/**
 * Individual toolbar buttons
 */
const ldlz2_pop_selector_menu = {
    // **Note**: this widget is aimed at the LDServer datasource, and the UM 1000G LDServer
    type: 'set_state',
    position: 'right',
    color: 'blue',
    button_html: 'LD Population: ',
    show_selected: true,
    button_title: 'Select LD Population: ',
    state_field: 'ld_pop',
    // This list below is hardcoded to work with the UMich LDServer, default 1000G populations
    //  It can be customized to work with other LD servers that specify population differently
    // https://portaldev.sph.umich.edu/ld/genome_builds/GRCh37/references/1000G/populations
    options: [
        { display_name: 'ALL (default)', value: 'ALL' },
        { display_name: 'AFR', value: 'AFR' },
        { display_name: 'AMR', value: 'AMR' },
        { display_name: 'EAS', value: 'EAS' },
        { display_name: 'EUR', value: 'EUR' },
        { display_name: 'SAS', value: 'SAS' },
    ],
};

/**
 * Toolbar Layouts: Collections of toolbar buttons etc
 */
const standard_panel_toolbar = {
    widgets: [
        {
            type: 'remove_panel',
            position: 'right',
            color: 'red',
            group_position: 'end',
        },
        {
            type: 'move_panel_up',
            position: 'right',
            group_position: 'middle',
        },
        {
            type: 'move_panel_down',
            position: 'right',
            group_position: 'start',
            style: { 'margin-left': '0.75em' },
        },
    ],
};

const standard_plot_toolbar = {
    // Suitable for most any type of plot drawn with LZ
    widgets: [
        {
            type: 'title',
            title: 'LocusZoom',
            subtitle: `<a href="https://statgen.github.io/locuszoom/" target="_blank" rel="noopener">v${version}</a>`,
            position: 'left',
        },
        {
            type: 'download',
            position: 'right',
        },
        {
            type: 'download_png',
            position: 'right',
        },
    ],
};

const region_nav_plot_toolbar = function () {
    // Useful for most region-based plots
    const region_nav_plot_toolbar = deepCopy(standard_plot_toolbar);
    region_nav_plot_toolbar.widgets.push(
        deepCopy(ldlz2_pop_selector_menu),
        {
            type: 'shift_region',
            step: 500000,
            button_html: '>>',
            position: 'right',
            group_position: 'end',
        }, {
            type: 'shift_region',
            step: 50000,
            button_html: '>',
            position: 'right',
            group_position: 'middle',
        },
        {
            type: 'zoom_region',
            step: 0.2,
            position: 'right',
            group_position: 'middle',
        },
        {
            type: 'zoom_region',
            step: -0.2,
            position: 'right',
            group_position: 'middle',
        },
        {
            type: 'shift_region',
            step: -50000,
            button_html: '<',
            position: 'right',
            group_position: 'middle',
        },
        {
            type: 'shift_region',
            step: -500000,
            button_html: '<<',
            position: 'right',
            group_position: 'start',
        }
    );
    return region_nav_plot_toolbar;
}();

/**
 * Panel Layouts
 */

const association_panel = {
    id: 'association',
    width: 800,
    height: 225,
    min_width: 400,
    min_height: 200,
    proportional_width: 1,
    margin: { top: 35, right: 50, bottom: 40, left: 50 },
    inner_border: 'rgb(210, 210, 210)',
    toolbar: (function () {
        const base = deepCopy(standard_panel_toolbar);
        base.widgets.push({
            type: 'toggle_legend',
            position: 'right',
        });
        return base;
    })(),
    axes: {
        x: {
            label: 'Chromosome {{chr}} (Mb)',
            label_offset: 32,
            tick_format: 'region',
            extent: 'state',
        },
        y1: {
            label: '-log10 p-value',
            label_offset: 28,
        },
        y2: {
            label: 'Recombination Rate (cM/Mb)',
            label_offset: 40,
        },
    },
    legend: {
        orientation: 'vertical',
        origin: { x: 55, y: 40 },
        hidden: true,
    },
    interaction: {
        drag_background_to_pan: true,
        drag_x_ticks_to_scale: true,
        drag_y1_ticks_to_scale: true,
        drag_y2_ticks_to_scale: true,
        scroll_to_zoom: true,
        x_linked: true,
    },
    data_layers: [
        deepCopy(significance_layer),
        deepCopy(recomb_rate_layer),
        deepCopy(association_pvalues_layer),
    ],
};

const coaccessibility_panel = {
    id: 'coaccessibility',
    width: 800,
    height: 225,
    min_width: 400,
    min_height: 100,
    proportional_width: 1,
    margin: { top: 35, right: 50, bottom: 40, left: 50 },
    inner_border: 'rgb(210, 210, 210)',
    toolbar: deepCopy(standard_panel_toolbar),
    axes: {
        x: {
            label: 'Chromosome {{chr}} (Mb)',
            label_offset: 32,
            tick_format: 'region',
            extent: 'state',
        },
        y1: {
            label: 'Score',
            label_offset: 28,
            render: false,  // We are mainly concerned with the relative magnitudes: hide y axis to avoid clutter.
        },
    },
    interaction: {
        drag_background_to_pan: true,
        drag_x_ticks_to_scale: true,
        drag_y1_ticks_to_scale: true,
        scroll_to_zoom: true,
        x_linked: true,
    },
    data_layers: [
        deepCopy(coaccessibility_layer),
    ],
};

const association_catalog_panel = function () {
    let base = deepCopy(association_panel);
    base = merge({
        id: 'associationcatalog',
        namespace: { 'assoc': 'assoc', 'ld': 'ld', 'catalog': 'catalog' }, // Required to resolve display options
    }, base);

    base.toolbar.widgets.push({
        type: 'display_options',
        position: 'right',
        color: 'blue',
        // Below: special config specific to this widget
        button_html: 'Display options...',
        button_title: 'Control how plot items are displayed',

        layer_name: 'associationpvaluescatalog',
        default_config_display_name: 'No catalog labels (default)', // display name for the default plot color option (allow user to revert to plot defaults)

        options: [
            {
                // First dropdown menu item
                display_name: 'Label catalog traits',  // Human readable representation of field name
                display: {  // Specify layout directives that control display of the plot for this option
                    label: {
                        text: '{{{{namespace[catalog]}}trait|htmlescape}}',
                        spacing: 6,
                        lines: {
                            style: {
                                'stroke-width': '2px',
                                'stroke': '#333333',
                                'stroke-dasharray': '2px 2px',
                            },
                        },
                        filters: [
                            // Only label points if they are significant for some trait in the catalog, AND in high LD
                            //  with the top hit of interest
                            { field: '{{namespace[catalog]}}trait', operator: '!=', value: null },
                            { field: '{{namespace[catalog]}}log_pvalue', operator: '>', value: LZ_SIG_THRESHOLD_LOGP },
                            { field: '{{namespace[ld]}}state', operator: '>', value: 0.4 },
                        ],
                        style: {
                            'font-size': '10px',
                            'font-weight': 'bold',
                            'fill': '#333333',
                        },
                    },
                },
            },
        ],
    });
    base.data_layers = [
        deepCopy(significance_layer),
        deepCopy(recomb_rate_layer),
        deepCopy(association_pvalues_catalog_layer),
    ];
    return base;
}();

const genes_panel = {
    id: 'genes',
    width: 800,
    height: 225,
    min_width: 400,
    min_height: 112.5,
    proportional_width: 1,
    margin: { top: 20, right: 50, bottom: 20, left: 50 },
    axes: {},
    interaction: {
        drag_background_to_pan: true,
        scroll_to_zoom: true,
        x_linked: true,
    },
    toolbar: (function () {
        const base = deepCopy(standard_panel_toolbar);
        base.widgets.push(
            {
                type: 'resize_to_data',
                position: 'right',
                button_html: 'Fit all genes',
            }
        );
        return base;
    })(),
    data_layers: [
        deepCopy(genes_layer),
    ],
};

const phewas_panel = {
    id: 'phewas',
    width: 800,
    height: 300,
    min_width: 800,
    min_height: 300,
    proportional_width: 1,
    margin: { top: 20, right: 50, bottom: 120, left: 50 },
    inner_border: 'rgb(210, 210, 210)',
    axes: {
        x: {
            ticks: {  // Object based config (shared defaults; allow layers to specify ticks)
                style: {
                    'font-weight': 'bold',
                    'font-size': '11px',
                    'text-anchor': 'start',
                },
                transform: 'rotate(50)',
                position: 'left',  // Special param recognized by `category_scatter` layers
            },
        },
        y1: {
            label: '-log10 p-value',
            label_offset: 28,
        },
    },
    data_layers: [
        deepCopy(significance_layer),
        deepCopy(phewas_pvalues_layer),
    ],
};

const annotation_catalog_panel = {
    id: 'annotationcatalog',
    width: 800,
    height: 45,
    min_height: 45,
    proportional_width: 1,
    margin: { top: 25, right: 50, bottom: 0, left: 50 },
    inner_border: 'rgb(210, 210, 210)',
    toolbar: deepCopy(standard_panel_toolbar),
    interaction: {
        drag_background_to_pan: true,
        scroll_to_zoom: true,
        x_linked: true,
    },
    data_layers: [
        deepCopy(annotation_catalog_layer),
    ],
};

/**
 * Plot Layouts
 */

const standard_association_plot = {
    state: {},
    width: 800,
    height: 450,
    responsive_resize: true,
    min_region_scale: 20000,
    max_region_scale: 1000000,
    toolbar: deepCopy(region_nav_plot_toolbar),
    panels: [
        merge({ proportional_height: 0.5}, deepCopy(association_panel)),
        merge({ proportional_height: 0.5}, deepCopy(genes_panel)),
    ],
};

const association_catalog_plot = {
    state: {},
    width: 800,
    height: 500,
    responsive_resize: true,
    min_region_scale: 20000,
    max_region_scale: 1000000,
    toolbar: deepCopy(region_nav_plot_toolbar),
    panels: [
        deepCopy(annotation_catalog_panel),
        deepCopy(association_catalog_panel),
        deepCopy(genes_panel),
    ],
};

const standard_phewas_plot = {
    width: 800,
    height: 600,
    min_width: 800,
    min_height: 600,
    responsive_resize: true,
    toolbar: deepCopy(standard_plot_toolbar),
    panels: [
        merge({proportional_height: 0.5}, deepCopy(phewas_panel)),
        merge({
            proportional_height: 0.5,
            margin: { bottom: 40 },
            axes: {
                x: {
                    label: 'Chromosome {{chr}} (Mb)',
                    label_offset: 32,
                    tick_format: 'region',
                    extent: 'state',
                },
            },
        }, deepCopy(genes_panel)),
    ],
    mouse_guide: false,
};

const coaccessibility_plot = {
    state: {},
    width: 800,
    height: 450,
    responsive_resize: true,
    min_region_scale: 20000,
    max_region_scale: 1000000,
    toolbar: deepCopy(standard_plot_toolbar),
    panels: [
        Object.assign(
            { proportional_height: 0.4 },
            deepCopy(coaccessibility_panel)
        ),
        function () {
            // Take the default genes panel, and add a custom feature to highlight gene tracks based on short name
            // This is a companion to the "match" directive in the coaccessibility panel
            const base = Object.assign(
                { proportional_height: 0.6 },
                deepCopy(genes_panel)
            );
            const layer = base.data_layers[0];
            layer.match = { send: 'gene_name', receive: 'gene_name' };
            const color_config = [
                {
                    field: 'lz_highlight_match', // Special field name whose presence triggers custom rendering
                    scale_function: 'if',
                    parameters: {
                        field_value: true,
                        then: '#ff0000',
                    },
                },
                {
                    field: 'lz_highlight_match', // Special field name whose presence triggers custom rendering
                    scale_function: 'if',
                    parameters: {
                        field_value: false,
                        then: '#EAE6E6',
                    },
                },
                '#363696',
            ];
            layer.color = color_config;
            layer.stroke = color_config;
            return base;
        }(),
    ],
};


export const tooltip = {
    standard_association: standard_association_tooltip,
    standard_association_with_label: standard_association_tooltip_with_label,
    standard_genes: standard_genes_tooltip,
    catalog_variant: catalog_variant_tooltip,
    coaccessibility: coaccessibility_tooltip,
};

export const toolbar_widgets = {
    ldlz2_pop_selector: ldlz2_pop_selector_menu,
};

export const toolbar = {
    standard_panel: standard_panel_toolbar,
    standard_plot: standard_plot_toolbar,
    region_nav_plot: region_nav_plot_toolbar,
};

export const data_layer = {
    significance: significance_layer,
    recomb_rate: recomb_rate_layer,
    association_pvalues: association_pvalues_layer,
    coaccessibility: coaccessibility_layer,
    association_pvalues_catalog: association_pvalues_catalog_layer,
    phewas_pvalues: phewas_pvalues_layer,
    genes: genes_layer,
    annotation_catalog: annotation_catalog_layer,
};

export const panel = {
    association: association_panel,
    coaccessibility: coaccessibility_panel,
    association_catalog: association_catalog_panel,
    genes: genes_panel,
    phewas: phewas_panel,
    annotation_catalog: annotation_catalog_panel,
};

export const plot = {
    standard_association: standard_association_plot,
    association_catalog: association_catalog_plot,
    standard_phewas: standard_phewas_plot,
    coaccessibility: coaccessibility_plot,
};
