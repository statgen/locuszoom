/**
    Custom code used to power credible sets demonstration example. This is not part of the core LocusZoom library,
    but can be included as a standalone file.

    The page must incorporate and load all libraries before this file can be used, including:
     - Vendor assets
     - LocusZoom
     - gwas-credible-sets (available via NPM or a related CDN)
 @module
*/

import {marking, scoring} from 'gwas-credible-sets';

function install (LocusZoom) {
    const BaseAdapter = LocusZoom.Adapters.get('BaseAdapter');
    /**
     * Custom data source that calculates the 95% credible set based on provided data.
     * This source must be requested as the second step in a chain, after a previous step that returns fields required
     *  for the calculation.
     *
     * @param {Object} init.params
     * @param {Object} init.params.fields
     * @param {String} init.params.fields.log_pvalue The name of the field containing pvalue information
     * @param {Number} [init.params.threshold=0.95] The credible set threshold (eg 95%)
     *
     */
    class CredibleSetLZ extends BaseAdapter {
        constructor(config) {
            super(...arguments);
            this.dependentSource = true; // Don't do calcs for a region with no assoc data
        }

        parseInit(config) {
            super.parseInit(...arguments);
            if (!(this.params.fields && this.params.fields.log_pvalue)) {
                throw new Error(`Source config for ${this.constructor.SOURCE_NAME} must specify how to find 'fields.log_pvalue'`);
            }
            if (!this.params.threshold) {
                this.params.threshold = 0.95;
            }
        }

        getCacheKey (state, chain, fields) {
            const threshold = state.credible_set_threshold || this.params.threshold;
            return [threshold, state.chr, state.start, state.end].join('_');
        }

        fetchRequest(state, chain) {
            const self = this;
            // The threshold can be overridden dynamically via `plot.state`, or set when the source is created
            const threshold = state.credible_set_threshold || this.params.threshold;
            // Calculate raw bayes factors and posterior probabilities based on information returned from the API
            if (typeof chain.body[0][self.params.fields.log_pvalue] === 'undefined') {
                throw new Error('Credible set source could not locate the required fields from a previous request.');
            }
            const nlogpvals = chain.body.map(function (item) {
                return item[self.params.fields.log_pvalue];
            });
            const credset_data = [];
            try {
                const scores = scoring.bayesFactors(nlogpvals);
                const posteriorProbabilities = scoring.normalizeProbabilities(scores);

                // Use scores to mark the credible set in various ways (depending on your visualization preferences,
                //   some of these may not be needed)
                const credibleSet = marking.findCredibleSet(scores, threshold);
                const credSetScaled = marking.rescaleCredibleSet(credibleSet);
                const credSetBool = marking.markBoolean(credibleSet);

                // Annotate each response record based on credible set membership
                for (let i = 0; i < chain.body.length; i++) {
                    credset_data.push({
                        posterior_prob: posteriorProbabilities[i],
                        contrib_fraction: credSetScaled[i],
                        is_member: credSetBool[i]
                    });
                }
            } catch (e) {
                // If the calculation cannot be completed, return the data without annotation fields
                console.error(e);
            }
            return Promise.resolve(credset_data);
        }

        combineChainBody(data, chain, fields, outnames, trans) {
            // At this point namespacing has been applied; add the calculated fields for this source to the chain
            for (let i = 0; i < data.length; i++) {
                const src = data[i];
                const dest = chain.body[i];
                Object.keys(src).forEach(function (attr) {
                    dest[attr] = src[attr];
                });
            }
            return chain.body;
        }
    }


    LocusZoom.Adapters.add('CredibleSetLZ', CredibleSetLZ);

    // Add related layouts to the central global registry
    LocusZoom.Layouts.add('tooltip', 'association_credible_set', function () {
        // Extend a known tooltip with an extra row of info showing posterior probabilities
        const l = LocusZoom.Layouts.get('tooltip', 'standard_association', { unnamespaced: true });
        l.html += '<br>Posterior probability: <strong>{{{{namespace[credset]}}posterior_prob|scinotation|htmlescape}}</strong>';
        return l;
    }());

    LocusZoom.Layouts.add('tooltip', 'annotation_credible_set', {
        namespace: { 'assoc': 'assoc', 'credset': 'credset' },
        closable: true,
        show: { or: ['highlighted', 'selected'] },
        hide: { and: ['unhighlighted', 'unselected'] },
        html: '<strong>{{{{namespace[assoc]}}variant|htmlescape}}</strong><br>'
            + 'P Value: <strong>{{{{namespace[assoc]}}log_pvalue|logtoscinotation|htmlescape}}</strong><br>' +
            '<br>Posterior probability: <strong>{{{{namespace[credset]}}posterior_prob|scinotation|htmlescape}}</strong>'
    });

    LocusZoom.Layouts.add('data_layer', 'association_credible_set', function () {
        const base = LocusZoom.Layouts.get('data_layer', 'association_pvalues', {
            unnamespaced: true,
            id: 'associationcredibleset',
            namespace: { 'assoc': 'assoc', 'credset': 'credset', 'ld': 'ld' },
            fill_opacity: 0.7,
            tooltip: LocusZoom.Layouts.get('tooltip', 'association_credible_set', { unnamespaced: true }),
            fields: [
                '{{namespace[assoc]}}variant', '{{namespace[assoc]}}position',
                '{{namespace[assoc]}}log_pvalue', '{{namespace[assoc]}}log_pvalue|logtoscinotation',
                '{{namespace[assoc]}}ref_allele',
                '{{namespace[credset]}}posterior_prob', '{{namespace[credset]}}contrib_fraction',
                '{{namespace[credset]}}is_member',
                '{{namespace[ld]}}state', '{{namespace[ld]}}isrefvar'
            ],
            match: { send: '{{namespace[assoc]}}variant', receive: '{{namespace[assoc]}}variant' }
        });
        base.color.unshift({
            field: 'lz_highlight_match',  // Special field name whose presence triggers custom rendering
            scale_function: 'if',
            parameters: {
                field_value: true,
                then: '#FFf000'
            }
        });
        return base;
    }());

    LocusZoom.Layouts.add('data_layer', 'annotation_credible_set', {
        namespace: { 'assoc': 'assoc', 'credset': 'credset' },
        id: 'annotationcredibleset',
        type: 'annotation_track',
        id_field: '{{namespace[assoc]}}variant',
        x_axis: {
            field: '{{namespace[assoc]}}position'
        },
        color: [
            {
                field: 'lz_highlight_match',  // Special field name whose presence triggers custom rendering
                scale_function: 'if',
                parameters: {
                    field_value: true,
                    then: '#001cee'
                }
            },
            '#00CC00'
        ],
        fields: ['{{namespace[assoc]}}variant', '{{namespace[assoc]}}position', '{{namespace[assoc]}}log_pvalue', '{{namespace[credset]}}posterior_prob', '{{namespace[credset]}}contrib_fraction', '{{namespace[credset]}}is_member'],
        match: { send: '{{namespace[assoc]}}variant', receive: '{{namespace[assoc]}}variant' },
        filters: [
            // Specify which points to show on the track. Any selection must satisfy ALL filters
            ['{{namespace[credset]}}is_member', true]
        ],
        behaviors: {
            onmouseover: [
                { action: 'set', status: 'highlighted' }
            ],
            onmouseout: [
                { action: 'unset', status: 'highlighted' }
            ],
            onclick: [
                { action: 'toggle', status: 'selected', exclusive: true }
            ],
            onshiftclick: [
                { action: 'toggle', status: 'selected' }
            ]
        },
        tooltip: LocusZoom.Layouts.get('tooltip', 'annotation_credible_set', { unnamespaced: true }),
        tooltip_positioning: 'top'
    });

    LocusZoom.Layouts.add('panel', 'annotation_credible_set', {
        id: 'annotationcredibleset',
        title: { text: 'SNPs in 95% credible set', x: 50, style: { 'font-size': '14px' } },
        width: 800,
        height: 100,
        min_height: 100,
        proportional_width: 1,
        margin: { top: 35, right: 50, bottom: 40, left: 50 },
        inner_border: 'rgb(210, 210, 210)',
        toolbar: LocusZoom.Layouts.get('toolbar', 'standard_panel', { unnamespaced: true }),
        interaction: {
            drag_background_to_pan: true,
            scroll_to_zoom: true,
            x_linked: true
        },
        data_layers: [
            LocusZoom.Layouts.get('data_layer', 'annotation_credible_set', { unnamespaced: true })
        ]
    });

    LocusZoom.Layouts.add('panel', 'association_credible_set', function () {
        const l = LocusZoom.Layouts.get('panel', 'association', {
            unnamespaced: true,
            id: 'associationcrediblesets',
            namespace: { 'assoc': 'assoc', 'credset': 'credset' },
            data_layers: [
                LocusZoom.Layouts.get('data_layer', 'significance', { unnamespaced: true }),
                LocusZoom.Layouts.get('data_layer', 'recomb_rate', { unnamespaced: true }),
                LocusZoom.Layouts.get('data_layer', 'association_credible_set', { unnamespaced: true })
            ]
        });
        // Add "display options" button to control how credible set coloring is overlaid on the standard association plot
        l.toolbar.widgets.push(
            {
                type: 'display_options',
                position: 'right',
                color: 'blue',
                // Below: special config specific to this widget
                button_html: 'Display options...',
                button_title: 'Control how plot items are displayed',
                layer_name: 'associationcredibleset',
                default_config_display_name: 'Linkage Disequilibrium (default)', // display name for the default plot color option (allow user to revert to plot defaults)

                options: [
                    {
                        // First dropdown menu item
                        display_name: '95% credible set (boolean)',  // Human readable representation of field name
                        display: {  // Specify layout directives that control display of the plot for this option
                            point_shape: 'circle',
                            point_size: 40,
                            color: {
                                field: '{{namespace[credset]}}is_member',
                                scale_function: 'if',
                                parameters: {
                                    field_value: true,
                                    then: '#00CC00',
                                    else: '#CCCCCC'
                                }
                            },
                            legend: [ // Tells the legend how to represent this display option
                                {
                                    shape: 'circle',
                                    color: '#00CC00',
                                    size: 40,
                                    label: 'In credible set',
                                    class: 'lz-data_layer-scatter'
                                },
                                {
                                    shape: 'circle',
                                    color: '#CCCCCC',
                                    size: 40,
                                    label: 'Not in credible set',
                                    class: 'lz-data_layer-scatter'
                                }
                            ]
                        }
                    },
                    {
                        // Second option. The same plot- or even the same field- can be colored in more than one way.
                        display_name: '95% credible set (gradient by contribution)',
                        display: {
                            point_shape: 'circle',
                            point_size: 40,
                            color: [
                                {
                                    field: '{{namespace[credset]}}contrib_fraction',
                                    scale_function: 'if',
                                    parameters: {
                                        field_value: 0,
                                        then: '#777777'
                                    }
                                },
                                {
                                    scale_function: 'interpolate',
                                    field: '{{namespace[credset]}}contrib_fraction',
                                    parameters: {
                                        breaks: [0, 1],
                                        values: ['#fafe87', '#9c0000']
                                    }
                                }
                            ],
                            legend: [
                                {
                                    shape: 'circle',
                                    color: '#777777',
                                    size: 40,
                                    label: 'No contribution',
                                    class: 'lz-data_layer-scatter'
                                },
                                {
                                    shape: 'circle',
                                    color: '#fafe87',
                                    size: 40,
                                    label: 'Some contribution',
                                    class: 'lz-data_layer-scatter'
                                },
                                {
                                    shape: 'circle',
                                    color: '#9c0000',
                                    size: 40,
                                    label: 'Most contribution',
                                    class: 'lz-data_layer-scatter'
                                }
                            ]
                        }
                    }
                ]
            }
        );
        return l;
    }());

    LocusZoom.Layouts.add('plot', 'association_credible_set', {
        state: {},
        width: 800,
        height: 450,
        responsive_resize: true,
        min_region_scale: 20000,
        max_region_scale: 1000000,
        toolbar: LocusZoom.Layouts.get('toolbar', 'region_nav_plot', { unnamespaced: true }),
        panels: [
            LocusZoom.Layouts.get('panel', 'association_credible_set', { unnamespaced: true }),
            LocusZoom.Layouts.get('panel', 'annotation_credible_set', { unnamespaced: true }),
            LocusZoom.Layouts.get('panel', 'genes', { unnamespaced: true })
        ]
    });

}


if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;
