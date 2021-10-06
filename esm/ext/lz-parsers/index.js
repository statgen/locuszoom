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
                base.ld_refvar = LDServer.prototype.__find_ld_refvar.bind(this)(state, assoc_data);
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
