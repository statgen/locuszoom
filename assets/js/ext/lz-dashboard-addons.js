/**
 * Optional LocusZoom extension: must be included separately, and after LocusZoom has been loaded
 *
 * This contains (reusable) code to power some (rarely used) demo features:
 *  - The "covariates model" demo, in which an LZ dashboard widget is populated
 *    with information by selecting points on the plot (see "covariates model" demo)
 *  - The "data layers" button, which allows fine control over multiple data layers shown in the same panel
 *    (show/hide, fade, change order, etc). This is powerful, but rarely used because showing many datasets in a small
 *    space is hard to read. (see "multiple phenotypes layered" demo)
 */
'use strict';

// This is defined as a UMD module, to work with multiple different module systems / bundlers
/* global define, module, require */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['locuszoom'], function(LocusZoom) {  // amd
            return factory(LocusZoom);
        });
    } else if(typeof module === 'object' && module.exports) {  // commonJS
        module.exports = factory(require('locuszoom'));
    } else {  // globals
        factory(root.LocusZoom);
    }
}(this, function(LocusZoom) {
    /**
     * Special button/menu to allow model building by tracking individual covariants. Will track a list of covariate
     *   objects and store them in the special `model.covariates` field of plot `state`.
     * @class LocusZoom.Dashboard.Components.covariates_model
     * @augments LocusZoom.Dashboard.Component
     * @param {object} layout
     * @param {string} layout.button_html The HTML to render inside the button
     * @param {string} layout.button_title Text to display as a tooltip when hovering over the button
     */
    LocusZoom.Dashboard.Components.add('covariates_model', function(layout) {
        LocusZoom.Dashboard.Component.apply(this, arguments);

        this.initialize = function() {
            // Initialize state.model.covariates
            this.parent_plot.state.model = this.parent_plot.state.model || {};
            this.parent_plot.state.model.covariates = this.parent_plot.state.model.covariates || [];
            // Create an object at the plot level for easy access to interface methods in custom client-side JS
            /**
             * When a covariates model dashboard element is present, create (one) object at the plot level that exposes
             *   component data and state for custom interactions with other plot elements.
             * @class LocusZoom.Plot.CovariatesModel
             */
            this.parent_plot.CovariatesModel = {
                /** @member {LocusZoom.Dashboard.Component.Button} */
                button: this,
                /**
                 * Add an element to the model and show a representation of it in the dashboard component menu. If the
                 *   element is already part of the model, do nothing (to avoid adding duplicates).
                 * When plot state is changed, this will automatically trigger requests for new data accordingly.
                 * @param {string|object} element_reference Can be any value that can be put through JSON.stringify()
                 *   to create a serialized representation of itself.
                 */
                add: function(element_reference) {
                    var element = JSON.parse(JSON.stringify(element_reference));
                    if (typeof element_reference == 'object' && typeof element.html != 'string') {
                        element.html = ( (typeof element_reference.toHTML == 'function') ? element_reference.toHTML() : element_reference.toString());
                    }
                    // Check if the element is already in the model covariates array and return if it is.
                    for (var i = 0; i < this.state.model.covariates.length; i++) {
                        if (JSON.stringify(this.state.model.covariates[i]) === JSON.stringify(element)) {
                            return this;
                        }
                    }
                    this.state.model.covariates.push(element);
                    this.applyState();
                    this.CovariatesModel.updateComponent();
                    return this;
                }.bind(this.parent_plot),
                /**
                 * Remove an element from `state.model.covariates` (and from the dashboard component menu's
                 *  representation of the state model). When plot state is changed, this will automatically trigger
                 *  requests for new data accordingly.
                 * @param {number} idx Array index of the element, in the `state.model.covariates array`.
                 */
                removeByIdx: function(idx) {
                    if (typeof this.state.model.covariates[idx] == 'undefined') {
                        throw new Error('Unable to remove model covariate, invalid index: ' + idx.toString());
                    }
                    this.state.model.covariates.splice(idx, 1);
                    this.applyState();
                    this.CovariatesModel.updateComponent();
                    return this;
                }.bind(this.parent_plot),
                /**
                 * Empty the `state.model.covariates` array (and dashboard component menu representation thereof) of all
                 *  elements. When plot state is changed, this will automatically trigger requests for new data accordingly
                 */
                removeAll: function() {
                    this.state.model.covariates = [];
                    this.applyState();
                    this.CovariatesModel.updateComponent();
                    return this;
                }.bind(this.parent_plot),
                /**
                 * Manually trigger the update methods on the dashboard component's button and menu elements to force
                 *   display of most up-to-date content. Can be used to force the dashboard to reflect changes made, eg if
                 *   modifying `state.model.covariates` directly instead of via `plot.CovariatesModel`
                 */
                updateComponent: function() {
                    this.button.update();
                    this.button.menu.update();
                }.bind(this)
            };
        }.bind(this);

        this.update = function() {

            if (this.button) { return this; }

            this.button = new LocusZoom.Dashboard.Component.Button(this)
                .setColor(layout.color)
                .setHtml(layout.button_html)
                .setTitle(layout.button_title)
                .setOnclick(function() {
                    this.button.menu.populate();
                }.bind(this));

            this.button.menu.setPopulate(function() {
                var selector = this.button.menu.inner_selector;
                selector.html('');
                // General model HTML representation
                if (typeof this.parent_plot.state.model.html != 'undefined') {
                    selector.append('div').html(this.parent_plot.state.model.html);
                }
                // Model covariates table
                if (!this.parent_plot.state.model.covariates.length) {
                    selector.append('i').html('no covariates in model');
                } else {
                    selector.append('h5').html('Model Covariates (' + this.parent_plot.state.model.covariates.length + ')');
                    var table = selector.append('table');
                    this.parent_plot.state.model.covariates.forEach(function(covariate, idx) {
                        var html = ( (typeof covariate == 'object' && typeof covariate.html == 'string') ? covariate.html : covariate.toString() );
                        var row = table.append('tr');
                        row.append('td').append('button')
                            .attr('class', 'lz-dashboard-button lz-dashboard-button-' + this.layout.color)
                            .style({ 'margin-left': '0em' })
                            .on('click', function() {
                                this.parent_plot.CovariatesModel.removeByIdx(idx);
                            }.bind(this))
                            .html('×');
                        row.append('td').html(html);
                    }.bind(this));
                    selector.append('button')
                        .attr('class', 'lz-dashboard-button lz-dashboard-button-' + this.layout.color)
                        .style({ 'margin-left': '4px' }).html('× Remove All Covariates')
                        .on('click', function() {
                            this.parent_plot.CovariatesModel.removeAll();
                        }.bind(this));
                }
            }.bind(this));

            this.button.preUpdate = function() {
                var html = 'Model';
                if (this.parent_plot.state.model.covariates.length) {
                    var cov = this.parent_plot.state.model.covariates.length > 1 ? 'covariates' : 'covariate';
                    html += ' (' + this.parent_plot.state.model.covariates.length + ' ' + cov + ')';
                }
                this.button.setHtml(html).disable(false);
            }.bind(this);

            this.button.show();

            return this;
        };
    });

    /**
     * Menu for manipulating multiple data layers in a single panel: show/hide, change order, etc.
     * @class LocusZoom.Dashboard.Components.data_layers
     * @augments LocusZoom.Dashboard.Component
     */
    LocusZoom.Dashboard.Components.add('data_layers', function(layout) {
        LocusZoom.Dashboard.Component.apply(this, arguments);

        this.update = function() {

            if (typeof layout.button_html != 'string') { layout.button_html = 'Data Layers'; }
            if (typeof layout.button_title != 'string') { layout.button_title = 'Manipulate Data Layers (sort, dim, show/hide, etc.)'; }

            if (this.button) { return this; }

            this.button = new LocusZoom.Dashboard.Component.Button(this)
                .setColor(layout.color)
                .setHtml(layout.button_html)
                .setTitle(layout.button_title)
                .setOnclick(function() {
                    this.button.menu.populate();
                }.bind(this));

            this.button.menu.setPopulate(function() {
                this.button.menu.inner_selector.html('');
                var table = this.button.menu.inner_selector.append('table');
                this.parent_panel.data_layer_ids_by_z_index.slice().reverse().forEach(function(id, idx) {
                    var data_layer = this.parent_panel.data_layers[id];
                    var name = (typeof data_layer.layout.name != 'string') ? data_layer.id : data_layer.layout.name;
                    var row = table.append('tr');
                    // Layer name
                    row.append('td').html(name);
                    // Status toggle buttons
                    layout.statuses.forEach(function(status_adj) {
                        var status_idx = LocusZoom.DataLayer.Statuses.adjectives.indexOf(status_adj);
                        var status_verb = LocusZoom.DataLayer.Statuses.verbs[status_idx];
                        var html, onclick, highlight;
                        if (data_layer.global_statuses[status_adj]) {
                            html = LocusZoom.DataLayer.Statuses.menu_antiverbs[status_idx];
                            onclick = 'un' + status_verb + 'AllElements';
                            highlight = '-highlighted';
                        } else {
                            html = LocusZoom.DataLayer.Statuses.verbs[status_idx];
                            onclick = status_verb + 'AllElements';
                            highlight = '';
                        }
                        row.append('td').append('a')
                            .attr('class', 'lz-dashboard-button lz-dashboard-button-' + this.layout.color + highlight)
                            .style({ 'margin-left': '0em' })
                            .on('click', function() { data_layer[onclick](); this.button.menu.populate(); }.bind(this))
                            .html(html);
                    }.bind(this));
                    // Sort layer buttons
                    var at_top = (idx === 0);
                    var at_bottom = (idx === (this.parent_panel.data_layer_ids_by_z_index.length - 1));
                    var td = row.append('td');
                    td.append('a')
                        .attr('class', 'lz-dashboard-button lz-dashboard-button-group-start lz-dashboard-button-' + this.layout.color + (at_bottom ? '-disabled' : ''))
                        .style({ 'margin-left': '0em' })
                        .on('click', function() { data_layer.moveDown(); this.button.menu.populate(); }.bind(this))
                        .html('▾').attr('title', 'Move layer down (further back)');
                    td.append('a')
                        .attr('class', 'lz-dashboard-button lz-dashboard-button-group-middle lz-dashboard-button-' + this.layout.color + (at_top ? '-disabled' : ''))
                        .style({ 'margin-left': '0em' })
                        .on('click', function() { data_layer.moveUp(); this.button.menu.populate(); }.bind(this))
                        .html('▴').attr('title', 'Move layer up (further front)');
                    td.append('a')
                        .attr('class', 'lz-dashboard-button lz-dashboard-button-group-end lz-dashboard-button-red')
                        .style({ 'margin-left': '0em' })
                        .on('click', function() {
                            if (confirm('Are you sure you want to remove the ' + name + ' layer? This cannot be undone!')) {
                                data_layer.parent.removeDataLayer(id);
                            }
                            return this.button.menu.populate();
                        }.bind(this))
                        .html('×').attr('title', 'Remove layer');
                }.bind(this));
                return this;
            }.bind(this));

            this.button.show();

            return this;
        };
    });

    LocusZoom.Layouts.add('tooltip', 'covariates_model_association', function () {
        var covariates_model_association = LocusZoom.Layouts.get('tooltip', 'standard_association', { unnamespaced: true });
        covariates_model_association.html += '<a href="javascript:void(0);" onclick="LocusZoom.getToolTipPlot(this).CovariatesModel.add(LocusZoom.getToolTipData(this));">Condition on Variant</a><br>';
        return covariates_model_association;
    }());

    LocusZoom.Layouts.add('dashboard', 'covariates_model_plot', function () {
        var covariates_model_plot_dashboard = LocusZoom.Layouts.get('dashboard', 'standard_plot', { unnamespaced: true });
        covariates_model_plot_dashboard.components.push({
            type: 'covariates_model',
            button_html: 'Model',
            button_title: 'Show and edit covariates currently in model',
            position: 'left'
        });
        return covariates_model_plot_dashboard;
    }());

    // Public interface for this extension
    return {};
}));
