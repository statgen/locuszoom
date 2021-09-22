/**
 * Widgets and layouts for showing LD relative to more than one variant
 *
 *
 * ### Features provided
 * * TODO: Write this
 *
 * ### Loading and usage
 * The page must incorporate and load all libraries before this file can be used, including:
 * - Vendor assets
 * - LocusZoom
 *
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN (after any dependencies):
 * ```
 * <script src="https://cdn.jsdelivr.net/npm/locuszoom@INSERT_VERSION_HERE/dist/ext/lz-multi-ld.min.js" type="application/javascript"></script>
 * ```
 *
 * To use with ES6 modules, the plugin must be loaded and registered explicitly before use:
 * ```
 * import LocusZoom from 'locuszoom';
 * import LzMultiLD from 'locuszoom/esm/ext/lz-multi-ld';
 * LocusZoom.use(LzMultiLD);
 * ```
 *
 * Then use the widgets and layouts provided by this extension
 *
 * @module
 */

import * as d3 from 'd3';


function install(LocusZoom) {


    /**
     * (**extension**) Color an LD reference variant based on two fields: LD refvar, and correlation value
     *
     * @alias module:LocusZoom_ScaleFunctions~multi_ld_bins
     * @param {Object} parameters This function has no defined configuration options
     * @param {Array} parameters.categories  Array of possible category names, eg "variant1, variant2"
     *   Each category has its own set of possible output `values`
     * @param {Number[]} parameters.breaks Array of numerical breakpoints against which to evaluate the input value
     *    Must be of equal length as each possible set of options in values (eg, values[0].length)
     * @param {Array} parameters.values  Array of possible sets of return values: each category has its own set of values.
     *   Once category is determined, the set of options is evaluated relative to breakpoints.
     *   "Values" must be a nested array with the same number of entries as `categories`, and each array in values should be an array with the same number of entries as `breaks`.
     *   Each entry n represents the value to return if the input value is greater than
     *   or equal to break n and less than or equal to break n+1 (or break n+1 doesn't exist).
     *
     * @param {Array} item_data An array containing two field values that will be resolved into an output: [category_name, numerical_value]
     * @see {@link module:ext/lz-multi-ld} for required extension and installation instructions
     */
    const ld_multi_bin = function (parameters, item_data) {
        const [category_field, value_field] = item_data;
        if (!category_field) {
            // In multi-LD, some variants won't have LD info, and thus they won't match any category
            return null;
        }

        const categories = parameters.categories;
        const breaks = parameters.breaks;
        const category_to_use = categories.indexOf(category_field);
        if (category_to_use === -1) {
            return null;
        }
        const values = parameters.values[category_to_use];

        if (typeof value_field == 'undefined' || value_field === null || isNaN(+value_field)) {
            return null;
        }
        const threshold = breaks.reduce(function (prev, curr) {
            if (+value_field < prev || (+value_field >= prev && +value_field < curr)) {
                return prev;
            } else {
                return curr;
            }
        });
        return values[breaks.indexOf(threshold)];
    };

    const assoc_pvalues_multi_ld_layer = LocusZoom.Layouts.get('data_layer', 'association_pvalues', {
        unnamespaced:true,
        legend: [
            // {
            //     shape: 'ribbon',
            //     label: 'One SNP',
            //     width: 30,
            //     height: 5,
            //     color_stops: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
            //     tick_labels: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
            //     label_size: 10,
            // },
            {
                shape: 'ribbon',
                label: 'SNP Blue',
                width: 30,
                height: 5,
                // color_stops: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
                color_stops: d3.schemeBlues[9].slice(2, 7),
                tick_labels: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
                label_size: 10,
            },
            {
                shape: 'ribbon',
                label: 'SNP Green',
                width: 30,
                height: 5,
                color_stops: d3.schemeGreens[9].slice(2, 7),
                label_size: 10,
            },
            {
                shape: 'ribbon',
                label: 'SNP Red',
                width: 30,
                height: 5,
                color_stops: d3.schemeOranges[9].slice(2, 7),
                label_size: 10,
            },
            {
                shape: 'ribbon',
                label: 'SNP Purple',
                width: 30,
                height: 5,
                color_stops: d3.schemePurples[9].slice(2, 7),
                label_size: 10,
            },
            { shape: 'diamond', color: '#9632b8', size: 40, label: 'LD Ref Var', label_size: 10, class: 'lz-data_layer-scatter' },
            { shape: 'circle', color: '#B8B8B8', size: 40, label: 'no r² data', label_size: 10, class: 'lz-data_layer-scatter' },
        ],
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
                scale_function: 'ld_multi_bin',
                field: ['{{namespace[ld]}}refvarname', '{{namespace[ld]}}state'],
                parameters: {
                    categories: ['10:114734096_A/G', '10:114758349_C/T', '10:114788436_C/T', '10:114861304_A/G'],
                    breaks: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
                    values: [
                        d3.schemeBlues[9].slice(2, 7),
                        d3.schemeGreens[9].slice(2, 7),
                        d3.schemeOranges[9].slice(2, 7),
                        d3.schemePurples[9].slice(2, 7),
                    ],
                },
            },
            '#B8B8B8',
        ],
    });

    const assoc_pvalues_multi_ld_panel = function () {
        const base = LocusZoom.Layouts.get('panel', 'association', {
            height: 300,
            legend: { padding: 4, hidden: false },
        });
        // Replace standard assoc panel with multi LD version.
        base.data_layers[2] = assoc_pvalues_multi_ld_layer;
        return base;
    }();

    LocusZoom.ScaleFunctions.add('ld_multi_bin', ld_multi_bin);
    LocusZoom.Layouts.add('data_layer', 'assoc_pvalues_multi_ld', assoc_pvalues_multi_ld_layer);
    LocusZoom.Layouts.add('panel', 'association_multi_ld', assoc_pvalues_multi_ld_panel);
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;

