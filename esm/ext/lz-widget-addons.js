/**
 * Optional LocusZoom extension: must be included separately, and after LocusZoom has been loaded
 *
 * This contains (reusable) code to power some (rarely used) demo features:
 *  - The "covariates model" demo, in which an LZ toolbar widget is populated
 *    with information by selecting points on the plot (see "covariates model" demo)
 *  - The "data layers" button, which allows fine control over multiple data layers shown in the same panel
 *    (show/hide, fade, change order, etc). This is powerful, but rarely used because showing many datasets in a small
 *    space is hard to read. (see "multiple phenotypes layered" demo)
 * @module
 */

const STATUS_VERBS = ['highlight', 'select', 'fade', 'hide'];
const STATUS_ADJECTIVES = ['highlighted', 'selected', 'faded', 'hidden'];
const STATUS_ANTIVERBS = ['unhighlight', 'deselect', 'unfade', 'show'];


// LocusZoom plugins work by exporting a function that receives the `LocusZoom` object
// This allows them to work in many contexts (including script tags and ES6 imports)
function install(LocusZoom) {
    const _Button = LocusZoom.Widgets.get('_Button');
    const _BaseWidget = LocusZoom.Widgets.get('BaseWidget');


    /**
     * Special button/menu to allow model building by tracking individual covariants. Will track a list of covariate
     *   objects and store them in the special `model.covariates` field of plot `state`.
     *
     * Note: will only work on `panel` toolbars, and must be associated with a specific data layer to function.
     *
     * @param {object} layout
     * @param {string} layout.button_html The HTML to render inside the button
     * @param {string} layout.button_title Text to display as a tooltip when hovering over the button
     */
    class CovariatesModel extends _BaseWidget {
        // What info is needed to control this button?
        // - data_layer (for two way communication, so that rendering and menu can stay in sync)
        // - variant_field (so we know which variant ID to report to the LD server when asking for covariance data).
        //   Defaults to data_layer.id_field, on the assumption that it's easiest if the two things stay in sync.

        // FIXME: Bad button positioning- dropdown is detached from button location, fix
        // FIXME: implement add custom add covariate logic + display options for results + lock scroll once model building starts + "suggest best" option
        constructor(layout, parent) {
            super(layout, parent);
            this._covariates = []; // List of variant IDs (in a format compatible with the LD server)

            if (!this.parent_panel) {
                throw new Error('Covariates model can only be used on panel toolbars');
            }

            this._data_layer = this.parent_panel.data_layers[layout.data_layer];
            if (!this._data_layer) {
                throw new Error('Covariates model must specify where to find the association results');
            }

            this._variant_field = layout.variant_field || this._data_layer.layout.id_field;
            if (!this._variant_field) {
                throw new Error('Must specify how to find the variant ID that will be used for calculations');
            }
        }

        initialize() {
            // Add a panel event listener that will be responsible for reading the list of covariates
            this.parent_panel.on('element_annotation', (event) => {
                const {element, field, value} = event.data;
                if (field !== 'lz_is_covariate') {
                    // Only respond to a specific kind of annotation
                    return;
                }

                const variant_id = element[this._variant_field];
                // For `lz_is_covariate`, we know there are two values: true (add) and false (remove) an annotation
                // All changes will be initiated via a data layer annotation, and the internal state will only be
                //  mutated in response to external events. This one way data flow helps to avoid the button updating
                //  in response to events it initiated
                if (value) {
                    this._covariates.push(variant_id);
                } else {
                    // We are removing an annotation. Mutate in place to remove the item.
                    this._covariates.splice(this._covariates.indexOf(variant_id), 1);
                }
                // Re-render the widget after receiving new values
                this.updateWidget();
            });
        }

        updateWidget() {
            this.button.update();
            this.button.menu.update();
        }

        removeAll() {
            this._covariates = [];
            this.parent_plot.applyState();
            this.updateWidget();
        }

        update() {
            if (this.button) {
                return this;
            }

            this.button = new _Button(this)
                .setColor(this.layout.color)
                .setHtml(this.layout.button_html)
                .setTitle(this.layout.button_title)
                .setOnclick(() => {
                    this.button.menu.populate();
                });

            this.button.menu.setPopulate(() => {
                const selector = this.button.menu.inner_selector;
                // Reset content on every render
                selector.html('');
                // Model covariates table
                if (!this._covariates.length) {
                    selector.append('i')
                        .text('no covariates in model');
                } else {
                    selector.append('h5')
                        .text(`Model Covariates (${this._covariates.length})`);
                    const table = selector.append('table');
                    this._covariates.forEach((covariate_id) => {
                        const row = table.append('tr');
                        row.append('td').append('button')
                            .attr('class', `lz-toolbar-button lz-toolbar-button-${this.layout.color}`)
                            .style('margin-left', '0em')
                            // TODO : The display name is not the same as the element id- make _covariates a list of data instead of strings
                            .on('click', () => this._data_layer.setElementAnnotation('lz_is_covariate', covariate_id, false))
                            .text('×');
                        row.append('td')
                            .text(covariate_id);
                    });
                    selector.append('button')
                        .attr('class', `lz-toolbar-button lz-toolbar-button-${this.layout.color}`)
                        .style('margin-left', '4px')
                        .html('× Remove All Covariates')
                        .on('click', () => {
                            this._covariates = [];
                            this.updateWidget();
                        });
                }
            });

            this.button.preUpdate = () => {
                let html = 'Model';
                const count = this._covariates.length;
                if (count) {
                    const noun = count > 1 ? 'covariates' : 'covariate';
                    html += ` (${count} ${noun})`;
                }
                this.button.setHtml(html).disable(false);
            };

            this.button.show();

            return this;
        }
    }


    /**
     * Menu for manipulating multiple data layers in a single panel: show/hide, change order, etc.
     */
    class DataLayersWidget extends _BaseWidget {
        update() {

            if (typeof this.layout.button_html != 'string') {
                this.layout.button_html = 'Data Layers';
            }
            if (typeof this.layout.button_title != 'string') {
                this.layout.button_title = 'Manipulate Data Layers (sort, dim, show/hide, etc.)';
            }

            if (this.button) {
                return this;
            }

            this.button = new _Button(this)
                .setColor(this.layout.color)
                .setHtml(this.layout.button_html)
                .setTitle(this.layout.button_title)
                .setOnclick(() => {
                    this.button.menu.populate();
                });

            this.button.menu.setPopulate(() => {
                this.button.menu.inner_selector.html('');
                const table = this.button.menu.inner_selector.append('table');
                this.parent_panel.data_layer_ids_by_z_index.slice().reverse().forEach((id, idx) => {
                    const data_layer = this.parent_panel.data_layers[id];
                    const name = (typeof data_layer.layout.name != 'string') ? data_layer.id : data_layer.layout.name;
                    const row = table.append('tr');
                    // Layer name
                    row.append('td').html(name);
                    // Status toggle buttons
                    this.layout.statuses.forEach((status_adj) => {
                        const status_idx = STATUS_ADJECTIVES.indexOf(status_adj);
                        const status_verb = STATUS_VERBS[status_idx];
                        let html, onclick, highlight;
                        if (data_layer.global_statuses[status_adj]) {
                            html = STATUS_ANTIVERBS[status_idx];
                            onclick = `un${status_verb}AllElements`;
                            highlight = '-highlighted';
                        } else {
                            html = STATUS_VERBS[status_idx];
                            onclick = `${status_verb}AllElements`;
                            highlight = '';
                        }
                        row.append('td').append('a')
                            .attr('class', `lz-toolbar-button lz-toolbar-button-${this.layout.color}${highlight}`)
                            .style('margin-left', '0em')
                            .on('click', () => {
                                data_layer[onclick]();
                                this.button.menu.populate();
                            })
                            .html(html);
                    });
                    // Sort layer buttons
                    const at_top = (idx === 0);
                    const at_bottom = (idx === (this.parent_panel.data_layer_ids_by_z_index.length - 1));
                    const td = row.append('td');
                    td.append('a')
                        .attr('class', `lz-toolbar-button lz-toolbar-button-group-start lz-toolbar-button-${this.layout.color}${at_bottom ? '-disabled' : ''}`)
                        .style('margin-left', '0em')
                        .on('click', () => {
                            data_layer.moveBack(); this.button.menu.populate();
                        })
                        .html('▾')
                        .attr('title', 'Move layer down (further back)');
                    td.append('a')
                        .attr('class', `lz-toolbar-button lz-toolbar-button-group-middle lz-toolbar-button-${this.layout.color}${at_top ? '-disabled' : ''}`)
                        .style('margin-left', '0em')
                        .on('click', () => {
                            data_layer.moveForward(); this.button.menu.populate();
                        })
                        .html('▴')
                        .attr('title', 'Move layer up (further front)');
                    td.append('a')
                        .attr('class', 'lz-toolbar-button lz-toolbar-button-group-end lz-toolbar-button-red')
                        .style('margin-left', '0em')
                        .on('click', () => {
                            if (confirm(`Are you sure you want to remove the ${name} layer? This cannot be undone.`)) {
                                data_layer.parent.removeDataLayer(id);
                            }
                            return this.button.menu.populate();
                        })
                        .html('×')
                        .attr('title', 'Remove layer');
                });
                return this;
            });

            this.button.show();

            return this;
        }
    }

    const covariates_model_tooltip = function () {
        const covariates_model_association = LocusZoom.Layouts.get('tooltip', 'standard_association', { unnamespaced: true });
        covariates_model_association.html += `<br><a href="javascript:void(0);" 
                                              onclick="var item = this.parentNode.__data__, layer = item.getDataLayer(); 
                                              var current = layer.getElementAnnotation(item, 'lz_is_covariate');
                                              layer.setElementAnnotation(item, 'lz_is_covariate', !current );
                                              plot.applyState();">Add/remove covariate</a><br>`;
        return covariates_model_association;
    }();

    const covariates_model_toolbar = function () {
        const base = LocusZoom.Layouts.get('panel', 'association', { unnamespaced: true });
        const base_toolbar = base.toolbar;
        base_toolbar.widgets.unshift({
            type: 'covariates_model',
            button_html: 'Model',
            button_title: 'Use this feature to interactively build a model using variants from the data set',
            position: 'left',
            data_layer: 'associationpvalues',
        });
        return base_toolbar;
    }();

    const covariates_model_plot = function () {
        // Throughout the covariates plot, actions and display are coordinated by adding a special value
        //  `lz_is_covariate` to each datum. This is communicated to an external widget (like the dropdown menu) via
        //  the `element_annotation` event. The plot handles display, and the external widget handles what to do with
        //  the list of covariates.

        // Create a new JSON object based on a standard association plot
        const base = LocusZoom.Layouts.get('plot', 'standard_association', { unnamespaced: true });
        const assoc_panel = base.panels[0];
        assoc_panel.toolbar = covariates_model_toolbar;
        const assoc_layer = assoc_panel.data_layers[2];

        // If a point is tagged as a covariate, make it larger, with a special symbol
        assoc_layer.point_shape = [
            {
                scale_function: 'if',
                field: 'lz_is_covariate',
                parameters: {
                    field_value: true,
                    then: 'cross',
                },
            },
            {
                scale_function: 'if',
                field: '{{namespace[ld]}}isrefvar',
                parameters: {
                    field_value: 1,
                    then: 'diamond',
                    else: 'circle',
                },
            },
        ];
        assoc_layer.point_size = [
            {
                scale_function: 'if',
                field: 'lz_is_covariate',
                parameters: {
                    field_value: true,
                    then: '70',
                },
            },
            {
                scale_function: 'if',
                field: '{{namespace[ld]}}isrefvar',
                parameters: {
                    field_value: 1,
                    then: 80,
                    else: 40,
                },
            },
        ];
        // Add an action link to control whether this point is a covariate
        assoc_layer.tooltip = covariates_model_tooltip;
        return base;
    }();

    LocusZoom.Widgets.add('covariates_model', CovariatesModel);
    LocusZoom.Widgets.add('data_layers', DataLayersWidget);

    LocusZoom.Layouts.add('tooltip', 'covariates_model_association', covariates_model_tooltip);
    LocusZoom.Layouts.add('toolbar', 'covariates_model_toolbar', covariates_model_toolbar);

    LocusZoom.Layouts.add('plot', 'covariates_association', covariates_model_plot);
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;
