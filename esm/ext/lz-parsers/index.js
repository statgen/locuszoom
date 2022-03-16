/**
 * Optional LocusZoom extension: must be included separately, and after LocusZoom has been loaded
 *
 * This plugin exports helper function, as well as a few optional extra helpers for rendering the plot. The GWAS parsers can be used without registering the plugin.
 *
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN (after any dependencies):
 * ```
 * <script src="https://cdn.jsdelivr.net/npm/locuszoom@INSERT_VERSION_HERE/dist/ext/lz-parsers.min.js" type="application/javascript"></script>
 * ```
 *
 * To use with ES6 modules, import the helper functions and use them with your layout:
 *
 * ```
 * import { install, makeGWASParser, makeBed12Parser, makePlinkLDParser } from 'locuszoom/esm/ext/lz-parsers';
 * LocusZoom.use(install);
 * ```
 *
 * ### Features provided
 * * {@link module:LocusZoom_Adapters~UserTabixLD} (if the {@link module:ext/lz-tabix-source} extension is loaded first)
 *
 * @module ext/lz-parsers
 */

import { makeBed12Parser } from './bed';
import { makeGWASParser } from './gwas/parsers';
import { guessGWAS } from './gwas/sniffers';
import { makePlinkLdParser } from './ld';


// Most of this plugin consists of standalone functions. But we can add a few simple custom classes to the registry that help to use parsed output
function install(LocusZoom) {
    if (LocusZoom.Adapters.has('TabixUrlSource')) {
        // Custom Tabix adapter depends on another extension being loaded first
        const TabixUrlSource = LocusZoom.Adapters.get('TabixUrlSource');
        const LDServer = LocusZoom.Adapters.get('LDServer');

        /**
         * Load user-provided LD from a tabix file, and filter the returned set of records based on a reference variant. (will attempt to choose a reference variant based on the most significant association variant, if no state.ldrefvar is specified)
         * @public
         * @alias module:LocusZoom_Adapters~UserTabixLD
         * @extends module:LocusZoom_Adapters~TabixUrlSource
         * @see {@link module:ext/lz-tabix-source} for required extension and installation instructions
         * @see {@link module:ext/lz-parsers} for required extension and installation instructions
         */
        class UserTabixLD extends TabixUrlSource {
            constructor(config) {
                if (!config.limit_fields) {
                    config.limit_fields = ['variant2', 'position2', 'correlation'];
                }
                super(config);
            }

            _buildRequestOptions(state, assoc_data) {
                if (!assoc_data) {
                    throw new Error('LD request must depend on association data');
                }
                // If no state refvar is provided, find the most significant variant in any provided assoc data.
                //   Assumes that assoc satisfies the "assoc" fields contract, eg has fields variant and log_pvalue
                const base = super._buildRequestOptions(...arguments);
                if (!assoc_data.length) {
                    base._skip_request = true;
                    return base;
                }

                // NOTE: Reuses a method from another adapter to mix in functionality
                base.ld_refvar = LDServer.prototype.__find_ld_refvar(state, assoc_data);
                return base;
            }

            _performRequest(options) {
                // Skip request if this one depends on other data, and we are in a region with no data
                if (options._skip_request) {
                    return Promise.resolve([]);
                }
                return super._performRequest(options);
            }

            _annotateRecords(records, options) {
                // A single PLINK LD file could contain several reference variants (SNP_A) in the same region.
                //   Only show LD relative to the user-selected refvar in this plot.
                return records.filter((item) => item['variant1'] === options.ld_refvar);
            }
        }


        LocusZoom.Adapters.add('UserTabixLD', UserTabixLD);
    }
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}

// Support UMD (single symbol export)
const all = { install, makeBed12Parser, makeGWASParser, guessGWAS, makePlinkLdParser };

export default all;

export { install, makeBed12Parser, makeGWASParser, guessGWAS, makePlinkLdParser };
