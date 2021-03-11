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

function install(LocusZoom) {
    const assoc_pvalues_multi_ld_layer = LocusZoom.Layouts.get('data_layer', 'association_pvalues', {
        unnamespaced:true,
        legend: [
            {
                shape: 'ribbon',
                label: 'One SNP',
                width: 30,
                height: 5,
                color_stops: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
                tick_labels: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
                label_size: 10,
            },
            {
                shape: 'ribbon',
                label: 'SNP Blue',
                width: 30,
                height: 5,
                // color_stops: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
                color_stops: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
                tick_labels: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
                label_size: 10,
            },
            {
                shape: 'ribbon',
                label: 'SNP Green',
                width: 30,
                height: 5,
                color_stops: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
                label_size: 10,
            },
            {
                shape: 'ribbon',
                label: 'SNP Red',
                width: 30,
                height: 5,
                color_stops: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
                label_size: 10,
            },
            {
                shape: 'ribbon',
                label: 'SNP Purple',
                width: 30,
                height: 5,
                color_stops: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
                label_size: 10,
            },
            { shape: 'diamond', color: '#9632b8', size: 40, label: 'LD Ref Var', label_size: 10, class: 'lz-data_layer-scatter' },
            { shape: 'circle', color: '#B8B8B8', size: 40, label: 'no r² data', label_size: 10, class: 'lz-data_layer-scatter' },
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

    LocusZoom.Layouts.add('data_layer', 'assoc_pvalues_multi_ld', assoc_pvalues_multi_ld_layer);
    LocusZoom.Layouts.add('panel', 'association_multi_ld', assoc_pvalues_multi_ld_panel);
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;

