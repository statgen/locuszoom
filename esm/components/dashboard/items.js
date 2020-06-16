import d3 from 'd3';

import { Component, Button } from './base';
import { positionIntToString } from '../../helpers/display';

// FIXME: Button creation should occur in the constructors, not in update functions

/**
 * Renders arbitrary text with title formatting
 * @param {object} layout
 * @param {string} layout.title Text to render
 */
class Title extends Component {
    show() {
        if (!this.div_selector) {
            this.div_selector = this.parent.selector.append('div')
                .attr('class', 'lz-dashboard-title lz-dashboard-' + this.layout.position);
            this.title_selector = this.div_selector.append('h3');
        }
        return this.update();
    }

    update() {
        let title = this.layout.title.toString();
        if (this.layout.subtitle) {
            title += ' <small>' + this.layout.subtitle + '</small>';
        }
        this.title_selector.html(title);
        return this;
    }
}

/**
 * Renders text to display the current dimensions of the plot. Automatically updated as plot dimensions change
 */
class Dimensions extends Component {
    update() {
        const display_width = this.parent_plot.layout.width.toString().indexOf('.') === -1 ? this.parent_plot.layout.width : this.parent_plot.layout.width.toFixed(2);
        const display_height = this.parent_plot.layout.height.toString().indexOf('.') === -1 ? this.parent_plot.layout.height : this.parent_plot.layout.height.toFixed(2);
        this.selector.html(display_width + 'px × ' + display_height + 'px');
        if (this.layout.class) { this.selector.attr('class', this.layout.class); }
        if (this.layout.style) { this.selector.style(this.layout.style); }
        return this;
    }
}

/**
 * Display the current scale of the genome region displayed in the plot, as defined by the difference between
 *  `state.end` and `state.start`.
 */
class RegionScale extends Component {
    update() {
        if (!isNaN(this.parent_plot.state.start) && !isNaN(this.parent_plot.state.end)
            && this.parent_plot.state.start !== null && this.parent_plot.state.end !== null) {
            this.selector.style('display', null);
            this.selector.html(positionIntToString(this.parent_plot.state.end - this.parent_plot.state.start, null, true));
        } else {
            this.selector.style('display', 'none');
        }
        if (this.layout.class) { this.selector.attr('class', this.layout.class); }
        if (this.layout.style) { this.selector.style(this.layout.style); }
        return this;
    }
}

/**
 * Button to export current plot to an SVG image
 * @param {string} [layout.button_html="Download Image"]
 * @param {string} [layout.button_title="Download image of the current plot as locuszoom.svg"]
 * @param {string} [layout.filename="locuszoom.svg"] The default filename to use when saving the image
 */
class Download extends Component {
    constructor(layout, parent) {
        super(layout, parent);
        this.css_string = '';
        for (let stylesheet in Object.keys(document.styleSheets)) {
            if ( document.styleSheets[stylesheet].href !== null
                 && document.styleSheets[stylesheet].href.indexOf('locuszoom.css') !== -1) {
                // FIXME: "Download image" button will render the image incorrectly if the stylesheet has been renamed or concatenated
                fetch(document.styleSheets[stylesheet].href).then(response => {
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }
                    return response.text();
                }).then((response) => {
                    this.css_string = response.replace(/[\r\n]/g,' ').replace(/\s+/g,' ');
                    if (this.css_string.indexOf('/* ! LocusZoom HTML Styles */')) {
                        this.css_string = this.css_string.substring(0, this.css_string.indexOf('/* ! LocusZoom HTML Styles */'));
                    }
                });
                // Found stylesheet we want, stop checking others
                break;
            }
        }
    }

    update() {
        if (this.button) { return this; }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html || 'Download Image')
            .setTitle(this.layout.button_title || 'Download image of the current plot as locuszoom.svg')
            .setOnMouseover(() => {
                this.button.selector
                    .classed('lz-dashboard-button-gray-disabled', true)
                    .html('Preparing Image');
                this.generateBase64SVG().then((url) => {
                    const old = this.button.selector.attr('href');
                    if (old) { URL.revokeObjectURL(old); }  // Clean up old url instance to prevent memory leaks
                    this.button.selector
                        .attr('href', url)
                        .classed('lz-dashboard-button-gray-disabled', false)
                        .classed('lz-dashboard-button-gray-highlighted', true)
                        .html(this.layout.button_html || 'Download Image');
                });
            })
            .setOnMouseout(() => {
                this.button.selector.classed('lz-dashboard-button-gray-highlighted', false);
            });
        this.button.show();
        this.button.selector.attr('href-lang', 'image/svg+xml').attr('download', this.layout.filename || 'locuszoom.svg');
        return this;
    }

    generateBase64SVG () {
        return new Promise((resolve) => {
            // Insert a hidden div, clone the node into that so we can modify it with d3
            const container = this.parent.selector.append('div').style('display', 'none')
                .html(this.parent_plot.svg.node().outerHTML);
            // Remove unnecessary elements
            container.selectAll('g.lz-curtain').remove();
            container.selectAll('g.lz-mouse_guide').remove();
            // Convert units on axis tick dy attributes from ems to pixels
            container.selectAll('g.tick text').each(function() {
                const dy = +(d3.select(this).attr('dy').substring(-2).slice(0, -2)) * 10;
                d3.select(this).attr('dy', dy);
            });
            // Pull the svg into a string and add the contents of the locuszoom stylesheet
            // Don't add this with d3 because it will escape the CDATA declaration incorrectly
            let initial_html = d3.select(container.select('svg').node().parentNode).html();
            const style_def = '<style type="text/css"><![CDATA[ ' + this.css_string + ' ]]></style>';
            const insert_at = initial_html.indexOf('>') + 1;
            initial_html = initial_html.slice(0,insert_at) + style_def + initial_html.slice(insert_at);
            // Delete the container node
            container.remove();
            // Create an object URL based on the rendered markup
            const content = new Blob([initial_html], { type: 'image/svg+xml' });
            resolve(URL.createObjectURL(content));
        });
    }
}

/**
 * Button to remove panel from plot.
 *   NOTE: Will only work on panel dashboards.
 * @param {Boolean} [layout.suppress_confirm=false] If true, removes the panel without prompting user for confirmation
 */
class RemovePanel extends Component {
    update() {
        if (this.button) { return this; }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml('×')
            .setTitle('Remove panel')
            .setOnclick(() => {
                if (!this.layout.suppress_confirm && !confirm('Are you sure you want to remove this panel? This cannot be undone!')) {
                    return false;
                }
                const panel = this.parent_panel;
                panel.dashboard.hide(true);
                d3.select(panel.parent.svg.node().parentNode).on('mouseover.' + panel.getBaseId() + '.dashboard', null);
                d3.select(panel.parent.svg.node().parentNode).on('mouseout.' + panel.getBaseId() + '.dashboard', null);
                return panel.parent.removePanel(panel.id);
            });
        this.button.show();
        return this;
    }
}

/**
 * Button to move panel up relative to other panels (in terms of y-index on the page)
 *   NOTE: Will only work on panel dashboards.
 */
class MovePanelUp extends Component {
    update () {
        if (this.button) {
            const is_at_top = (this.parent_panel.layout.y_index === 0);
            this.button.disable(is_at_top);
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml('▴')
            .setTitle('Move panel up')
            .setOnclick(() => {
                this.parent_panel.moveUp();
                this.update();
            });
        this.button.show();
        return this.update();
    }
}

/**
 * Button to move panel down relative to other panels (in terms of y-index on the page)
 *   NOTE: Will only work on panel dashboards.
 */
class MovePanelDown extends Component {
    update () {
        if (this.button) {
            const is_at_bottom = (this.parent_panel.layout.y_index === this.parent_plot.panel_ids_by_y_index.length - 1);
            this.button.disable(is_at_bottom);
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml('▾')
            .setTitle('Move panel down')
            .setOnclick(() => {
                this.parent_panel.moveDown();
                this.update();
            });
        this.button.show();
        return this.update();
    }
}

/**
 * Button to shift plot region forwards or back by a `step` increment provided in the layout
 * @param {object} layout
 * @param {number} [layout.step=50000] The stepsize to change the region by
 * @param {string} [layout.button_html]
 * @param {string} [layout.button_title]
 */
class ShiftRegion extends Component {
    constructor(layout, parent) {
        if (isNaN(layout.step) || layout.step === 0) {
            layout.step = 50000;
        }
        if (typeof layout.button_html !== 'string') {
            layout.button_html = layout.step > 0 ? '>' : '<';
        }

        if (typeof layout.button_title !== 'string') {
            layout.button_title = 'Shift region by ' + (layout.step > 0 ? '+' : '-') + positionIntToString(Math.abs(layout.step),null,true);
        }
        super(layout, parent);
        if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)) {
            throw new Error('Unable to add shift_region dashboard component: plot state does not have region bounds');
        }


    }

    update () {
        if (this.button) { return this; }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html)
            .setTitle(this.layout.button_title)
            .setOnclick(() => {
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start + this.layout.step, 1),
                    end: this.parent_plot.state.end + this.layout.step
                });
            });
        this.button.show();
        return this;
    }
}

/**
 * Zoom in or out on the plot, centered on the middle of the plot region, by the specified amount
 * @param {object} layout
 * @param {number} [layout.step=0.2] The amount to zoom in by (where 1 indicates 100%)
 */
class ZoomRegion extends Component {
    constructor(layout, parent) {
        if (isNaN(layout.step) || layout.step === 0) {
            layout.step = 0.2;
        }
        if (typeof layout.button_html != 'string') {
            layout.button_html = layout.step > 0 ? 'z–' : 'z+';
        }
        if (typeof layout.button_title != 'string') {
            layout.button_title = 'Zoom region ' + (layout.step > 0 ? 'out' : 'in') + ' by ' + (Math.abs(layout.step) * 100).toFixed(1) + '%';
        }

        super(layout, parent);
        if (isNaN(this.parent_plot.state.start) || isNaN(this.parent_plot.state.end)) {
            throw new Error('Unable to add zoom_region dashboard component: plot state does not have region bounds');
        }
    }

    update () {
        if (this.button) {
            let can_zoom = true;
            const current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
            if (this.layout.step > 0 && !isNaN(this.parent_plot.layout.max_region_scale) && current_region_scale >= this.parent_plot.layout.max_region_scale) {
                can_zoom = false;
            }
            if (this.layout.step < 0 && !isNaN(this.parent_plot.layout.min_region_scale) && current_region_scale <= this.parent_plot.layout.min_region_scale) {
                can_zoom = false;
            }
            this.button.disable(!can_zoom);
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html)
            .setTitle(this.layout.button_title)
            .setOnclick(() => {
                const current_region_scale = this.parent_plot.state.end - this.parent_plot.state.start;
                const zoom_factor = 1 + this.layout.step;
                let new_region_scale = current_region_scale * zoom_factor;
                if (!isNaN(this.parent_plot.layout.max_region_scale)) {
                    new_region_scale = Math.min(new_region_scale, this.parent_plot.layout.max_region_scale);
                }
                if (!isNaN(this.parent_plot.layout.min_region_scale)) {
                    new_region_scale = Math.max(new_region_scale, this.parent_plot.layout.min_region_scale);
                }
                const delta = Math.floor((new_region_scale - current_region_scale) / 2);
                this.parent_plot.applyState({
                    start: Math.max(this.parent_plot.state.start - delta, 1),
                    end: this.parent_plot.state.end + delta
                });
            });
        this.button.show();
        return this;
    }
}

/**
 * Renders button with arbitrary text that, when clicked, shows a dropdown containing arbitrary HTML
 *  NOTE: Trusts content exactly as given. XSS prevention is the responsibility of the implementer.
 * @param {object} layout
 * @param {string} layout.button_html The HTML to render inside the button
 * @param {string} layout.button_title Text to display as a tooltip when hovering over the button
 * @param {string} layout.menu_html The HTML content of the dropdown menu
 */
class Menu extends Component {
    update() {
        if (this.button) { return this; }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html)
            .setTitle(this.layout.button_title);
        this.button.menu.setPopulate(() => {
            this.button.menu.inner_selector.html(this.layout.menu_html);
        });
        this.button.show();
        return this;
    }
}

/**
 * Button to resize panel height to fit available data (eg when showing a list of tracks)
 * @param {string} [layout.button_html="Resize to Data"]
 * @param {string} [layout.button_title]
 */
class ResizeToData extends Component {
    update() {
        if (this.button) { return this; }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setHtml(this.layout.button_html || 'Resize to Data')
            .setTitle(this.layout.button_title || 'Automatically resize this panel to show all data available')
            .setOnclick(() => {
                this.parent_panel.scaleHeightToData();
                this.update();
            });
        this.button.show();
        return this;
    }
}

/**
 * Button to toggle legend
 */
class ToggleLegend extends Component {
    update() {
        const html = this.parent_panel.legend.layout.hidden ? 'Show Legend' : 'Hide Legend';
        if (this.button) {
            this.button.setHtml(html).show();
            this.parent.position();
            return this;
        }
        this.button = new Button(this)
            .setColor(this.layout.color)
            .setTitle('Show or hide the legend for this panel')
            .setOnclick(() => {
                this.parent_panel.legend.layout.hidden = !this.parent_panel.legend.layout.hidden;
                this.parent_panel.legend.render();
                this.update();
            });
        return this.update();
    }
}

/**
 * Dropdown menu allowing the user to choose between different display options for a single specific data layer
 *  within a panel.
 *
 * This allows controlling how points on a datalayer can be displayed- any display options supported via the layout for the target datalayer. This includes point
 *  size/shape, coloring, etc.
 *
 * This button intentionally limits display options it can control to those available on common plot types.
 *   Although the list of options it sets can be overridden (to control very special custom plot types), this
 *   capability should be used sparingly if at all.
 *
 * @param {object} layout
 * @param {String} [layout.button_html="Display options..."] Text to display on the toolbar button
 * @param {String} [layout.button_title="Control how plot items are displayed"] Hover text for the toolbar button
 * @param {string} layout.layer_name Specify the datalayer that this button should affect
 * @param {string} [layout.default_config_display_name] Store the default configuration for this datalayer
 *  configuration, and show a button to revert to the "default" (listing the human-readable display name provided)
 * @param {Array} [layout.fields_whitelist='see code'] The list of presentation fields that this button can control.
 *  This can be overridden if this button needs to be used on a custom layer type with special options.
 * @typedef {{display_name: string, display: Object}} DisplayOptionsButtonConfigField
 * @param {DisplayOptionsButtonConfigField[]} layout.options Specify a label and set of layout directives associated
 *  with this `display` option. Display field should include all changes to datalayer presentation options.
 */
class DisplayOptions extends Component {
    constructor(layout, parent) {
        if (typeof layout.button_html != 'string') {
            layout.button_html = 'Display options...';
        }
        if (typeof layout.button_title != 'string') {
            layout.button_title = 'Control how plot items are displayed';
        }
        super(layout, parent);

        // List of layout fields that this button is allowed to control. This ensures that we don't override any other
        //  information (like plot height etc) while changing point rendering
        const allowed_fields = layout.fields_whitelist || ['color', 'fill_opacity', 'label', 'legend',
            'point_shape', 'point_size', 'tooltip', 'tooltip_positioning'];

        const dataLayer = this.parent_panel.data_layers[layout.layer_name];
        if (!dataLayer) {
            throw new Error("Display options could not locate the specified layer_name: '" + layout.layer_name + "'");
        }
        const dataLayerLayout = dataLayer.layout;

        // Store default configuration for the layer as a clean deep copy, so we may revert later
        const defaultConfig = {};
        allowed_fields.forEach(function(name) {
            const configSlot = dataLayerLayout[name];
            if (configSlot !== undefined) {
                defaultConfig[name] = JSON.parse(JSON.stringify(configSlot));
            }
        });

        /**
         * Which item in the menu is currently selected. (track for rerendering menu)
         * @member {String}
         * @private
         */
        this._selected_item = 'default';

        // Define the button + menu that provides the real functionality for this dashboard component

        this.button = new Button(this)
            .setColor(layout.color)
            .setHtml(layout.button_html)
            .setTitle(layout.button_title)
            .setOnclick(function () {
                this.button.menu.populate();
            });
        this.button.menu.setPopulate(() => {
            // Multiple copies of this button might be used on a single LZ page; append unique IDs where needed
            const uniqueID = Math.floor(Math.random() * 1e4).toString();

            this.button.menu.inner_selector.html('');
            const table = this.button.menu.inner_selector.append('table');

            const menuLayout = this.layout;

            const renderRow = function (display_name, display_options, row_id) { // Helper method
                const row = table.append('tr');
                const radioId = '' + uniqueID + row_id;
                row.append('td')
                    .append('input')
                    .attr({ id: radioId, type: 'radio', name: 'display-option-' + uniqueID, value: row_id })
                    .style('margin', 0) // Override css libraries (eg skeleton) that style form inputs
                    .property('checked', (row_id === this._selected_item))
                    .on('click', () => {
                        // If an option is not specified in these display options, use the original defaults
                        allowed_fields.forEach(function (field_name) {
                            dataLayer.layout[field_name] = display_options[field_name] || defaultConfig[field_name];
                        });

                        this._selected_item = row_id;
                        this.parent_panel.render();
                        const legend = this.parent_panel.legend;
                        if (legend) {
                            legend.render();
                        }
                    });
                row.append('td').append('label')
                    .style('font-weight', 'normal')
                    .attr('for', radioId)
                    .text(display_name);
            };
            // Render the "display options" menu: default and special custom options
            const defaultName = menuLayout.default_config_display_name || 'Default style';
            renderRow(defaultName, defaultConfig, 'default');
            menuLayout.options.forEach(function (item, index) {
                renderRow(item.display_name, item.display, index);
            });
            return this;
        });
    }

    update() {
        this.button.show();
        return this;
    }
}

/**
 * Dropdown menu allowing the user to set the value of a specific `state_field` in plot.state
 * This is useful for things (like datasources) that allow dynamic configuration based on global information in state
 *
 * For example, the LDLZ2 data source can use it to change LD reference population (for all panels) after render
 *
 * @param {object} layout
 * @param {String} [layout.button_html="Set option..."] Text to display on the toolbar button
 * @param {String} [layout.button_title="Choose an option to customize the plot"] Hover text for the toolbar button
 * @param {bool} [layout.show_selected=false] Whether to append the selected value to the button label
 * @param {string} [layout.state_field] The name of the field in plot.state that will be set by this button
 * @typedef {{display_name: string, value: *}} SetStateOptionsConfigField
 * @param {SetStateOptionsConfigField[]} layout.options Specify human labels and associated values for the dropdown menu
 */
class SetState extends Component {
    constructor(layout, parent) {
        if (typeof layout.button_html != 'string') {
            layout.button_html = 'Set option...';
        }
        if (typeof layout.button_title != 'string') {
            layout.button_title = 'Choose an option to customize the plot';
        }

        super(layout, parent);

        if (this.parent_panel) {
            throw new Error('This widget is designed to set global options, so it can only be used at the top (plot) level');
        }
        if (!layout.state_field) {
            throw new Error('Must specify the `state_field` that this widget controls');
        }

        /**
         * Which item in the menu is currently selected. (track for rerendering menu)
         * @member {String}
         * @private
         */
        // The first option listed is automatically assumed to be the default, unless a value exists in plot.state
        this._selected_item = this.parent_plot.state[layout.state_field] || layout.options[0].value;
        if (!layout.options.find((item) => { return item.value === this._selected_item; })) {
            // Check only gets run at widget creation, but generally this widget is assumed to be an exclusive list of options
            throw new Error('There is an existing state value that does not match the known values in this widget');
        }

        // Define the button + menu that provides the real functionality for this dashboard component
        this.button = new Button(this)
            .setColor(layout.color)
            .setHtml(layout.button_html + (layout.show_selected ? this._selected_item : ''))
            .setTitle(layout.button_title)
            .setOnclick(() => {
                this.button.menu.populate();
            });
        this.button.menu.setPopulate(() => {
            // Multiple copies of this button might be used on a single LZ page; append unique IDs where needed
            const uniqueID = Math.floor(Math.random() * 1e4).toString();

            this.button.menu.inner_selector.html('');
            const table = this.button.menu.inner_selector.append('table');

            const renderRow = (display_name, value, row_id) => { // Helper method
                const row = table.append('tr');
                const radioId = '' + uniqueID + row_id;
                row.append('td')
                    .append('input')
                    .attr({ id: radioId, type: 'radio', name: 'set-state-' + uniqueID, value: row_id })
                    .style('margin', 0) // Override css libraries (eg skeleton) that style form inputs
                    .property('checked', (value === this._selected_item))
                    .on('click', () => {
                        const new_state = {};
                        new_state[layout.state_field] = value;
                        this._selected_item = value;
                        this.parent_plot.applyState(new_state);
                        this.button.setHtml(layout.button_html + (layout.show_selected ? this._selected_item : ''));
                    });
                row.append('td').append('label')
                    .style('font-weight', 'normal')
                    .attr('for', radioId)
                    .text(display_name);
            };
            layout.options.forEach(function (item, index) {
                renderRow(item.display_name, item.value, index);
            });
            return this;
        });
    }

    update() {
        this.button.show();
        return this;
    }
}

export {
    Dimensions as dimensions,
    DisplayOptions as display_options,
    Download as download,
    Menu as menu,
    MovePanelDown as move_panel_down,
    MovePanelUp as move_panel_up,
    RegionScale as region_scale,
    ResizeToData as resize_to_data,
    SetState as set_state,
    ShiftRegion as shift_region,
    RemovePanel as remove_panel,
    Title as title,
    ToggleLegend as toggle_legend,
    ZoomRegion as zoom_region,
};
