/**
 * Optional LocusZoom extension: must be included separately, and after LocusZoom has been loaded
 *
 * This contains (reusable) code to power some (rarely used) demo features:
 *  - The "covariates model" demo, in which an LZ toolbar widget is populated
 *    with information by selecting points on the plot (see "covariates model" demo)
 *  - The "data layers" button, which allows fine control over multiple data layers shown in the same panel
 *    (show/hide, fade, change order, etc). This is powerful, but rarely used because showing many datasets in a small
 *    space makes data hard to see. (see "multiple phenotypes layered" demo)
 *
 * ### Loading and usage
 * The page must incorporate and load all libraries before this file can be used, including:
 * - LocusZoom
 *
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN (after any dependencies):
 *
 * ```javascript
 * <script src="https://cdn.jsdelivr.net/npm/locuszoom@INSERT_VERSION_HERE/dist/ext/lz-widget-addons.min.js" type="application/javascript"></script>
 * ```
 *
 * To use with ES6 modules, the plugin must be loaded and registered explicitly before use:
 * ```javascript
 * import LocusZoom from 'locuszoom';
 * import WidgetAddons from 'locuszoom/esm/ext/lz-widget-addons';
 * LocusZoom.use(WidgetAddons);
 * ```
 *
 * Then use the features made available by this extension. (see demos and documentation for guidance)
 *
 * @module
 */
import {deepCopy} from '../helpers/layouts';

// In order to work in a UMD context, this module imports the top-level LocusZoom symbol

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
     * This is a prototype widget for building a conditional analysis model, but it performs no calculation
     *  functionality beyond building a list of items.
     * @alias module:ext/lz-widget-addons~covariates_model
     * @see module:LocusZoom_Widgets~BaseWidget
     * @param {object} layout
     * @param {string} layout.button_html The HTML to render inside the button
     * @param {string} layout.button_title Text to display as a tooltip when hovering over the button
     */
    class CovariatesModel extends _BaseWidget {
        initialize() {
            // Initialize state.model.covariates
            this.parent_plot.state.model = this.parent_plot.state.model || {};
            this.parent_plot.state.model.covariates = this.parent_plot.state.model.covariates || [];
            // Create an object at the plot level for easy access to interface methods in custom client-side JS
            /**
             * When a covariates model toolbar element is present, create (one) object at the plot level that exposes
             *   widget data and state for custom interactions with other plot elements.
             */
            this.parent_plot.CovariatesModel = {
                /** @member {Button} */
                button: this,
                /**
                 * Add an element to the model and show a representation of it in the toolbar widget menu. If the
                 *   element is already part of the model, do nothing (to avoid adding duplicates).
                 * When plot state is changed, this will automatically trigger requests for new data accordingly.
                 * @param {string|object} element_reference Can be any value that can be put through JSON.stringify()
                 *   to create a serialized representation of itself.
                 */
                add: (element_reference) => {
                    const plot = this.parent_plot;
                    const element = deepCopy(element_reference);
                    if (typeof element_reference == 'object' && typeof element.html != 'string') {
                        element.html = ( (typeof element_reference.toHTML == 'function') ? element_reference.toHTML() : element_reference.toString());
                    }
                    // Check if the element is already in the model covariates array and return if it is.
                    for (let i = 0; i < plot.state.model.covariates.length; i++) {
                        if (JSON.stringify(plot.state.model.covariates[i]) === JSON.stringify(element)) {
                            return plot;
                        }
                    }
                    plot.state.model.covariates.push(element);
                    plot.applyState();
                    plot.CovariatesModel.updateWidget();
                    return plot;
                },
                /**
                 * Remove an element from `state.model.covariates` (and from the toolbar widget menu's
                 *  representation of the state model). When plot state is changed, this will automatically trigger
                 *  requests for new data accordingly.
                 * @param {number} idx Array index of the element, in the `state.model.covariates array`.
                 */
                removeByIdx: (idx) => {
                    const plot = this.parent_plot;
                    if (typeof plot.state.model.covariates[idx] == 'undefined') {
                        throw new Error(`Unable to remove model covariate, invalid index: ${idx.toString()}`);
                    }
                    plot.state.model.covariates.splice(idx, 1);
                    plot.applyState();
                    plot.CovariatesModel.updateWidget();
                    return plot;
                },
                /**
                 * Empty the `state.model.covariates` array (and toolbar widget menu representation thereof) of all
                 *  elements. When plot state is changed, this will automatically trigger requests for new data accordingly
                 */
                removeAll: () => {
                    const plot = this.parent_plot;
                    plot.state.model.covariates = [];
                    plot.applyState();
                    plot.CovariatesModel.updateWidget();
                    return plot;
                },
                /**
                 * Manually trigger the update methods on the toolbar widget's button and menu elements to force
                 *   display of most up-to-date content. Can be used to force the toolbar to reflect changes made, eg if
                 *   modifying `state.model.covariates` directly instead of via `plot.CovariatesModel`
                 */
                updateWidget: () => {
                    this.button.update();
                    this.button.menu.update();
                },
            };
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
                selector.html('');
                // General model HTML representation
                if (typeof this.parent_plot.state.model.html != 'undefined') {
                    selector.append('div').html(this.parent_plot.state.model.html);
                }
                // Model covariates table
                if (!this.parent_plot.state.model.covariates.length) {
                    selector.append('i').html('no covariates in model');
                } else {
                    selector.append('h5').html(`Model Covariates (${this.parent_plot.state.model.covariates.length})`);
                    const table = selector.append('table');
                    this.parent_plot.state.model.covariates.forEach((covariate, idx) => {
                        const html = ((typeof covariate == 'object' && typeof covariate.html == 'string') ? covariate.html : covariate.toString());
                        const row = table.append('tr');
                        row.append('td').append('button')
                            .attr('class', `lz-toolbar-button lz-toolbar-button-${this.layout.color}`)
                            .style('margin-left', '0em')
                            .on('click', () => this.parent_plot.CovariatesModel.removeByIdx(idx))
                            .html('×');
                        row.append('td')
                            .html(html);
                    });
                    selector.append('button')
                        .attr('class', `lz-toolbar-button lz-toolbar-button-${this.layout.color}`)
                        .style('margin-left', '4px')
                        .html('× Remove All Covariates')
                        .on('click', () => this.parent_plot.CovariatesModel.removeAll());
                }
            });

            this.button.preUpdate = () => {
                let html = 'Model';
                const count = this.parent_plot.state.model.covariates.length;
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
     * @alias module:ext/lz-widget-addons~data_layers
     * @see module:LocusZoom_Widgets~BaseWidget
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
                this.parent_panel._data_layer_ids_by_z_index.slice().reverse().forEach((id, idx) => {
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
                        if (data_layer._global_statuses[status_adj]) {
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
                    const at_bottom = (idx === (this.parent_panel._data_layer_ids_by_z_index.length - 1));
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
        covariates_model_association.html += '<a href="javascript:void(0);" onclick="LocusZoom.getToolTipPlot(this).CovariatesModel.add(LocusZoom.getToolTipData(this));">Condition on Variant</a><br>';
        return covariates_model_association;
    }();

    const covariates_model_plot = function () {
        const covariates_model_plot_toolbar = LocusZoom.Layouts.get('toolbar', 'standard_association', { unnamespaced: true });
        covariates_model_plot_toolbar.widgets.push({
            type: 'covariates_model',
            button_html: 'Model',
            button_title: 'Show and edit covariates currently in model',
            position: 'left',
        });
        return covariates_model_plot_toolbar;
    }();

    LocusZoom.Widgets.add('covariates_model', CovariatesModel);
    LocusZoom.Widgets.add('data_layers', DataLayersWidget);

    LocusZoom.Layouts.add('tooltip', 'covariates_model_association', covariates_model_tooltip);
    LocusZoom.Layouts.add('toolbar', 'covariates_model_plot', covariates_model_plot);
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;
