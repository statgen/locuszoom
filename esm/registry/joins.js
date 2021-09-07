/**
 * "Join" functions
 *
 * Connect two sets of records together according to predefined rules.
 *
 * @module LocusZoom_JoinFunctions
 */
import {joins} from 'undercomplicate';

import {RegistryBase} from './base';

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided "data join" functions.
 * @alias module:LocusZoom~JoinFunctions
 * @type {module:registry/base~RegistryBase}
 */
const registry = new RegistryBase();

registry.add('left_match', joins.left_match);

registry.add('inner_match', joins.inner_match);

registry.add('full_outer_match', joins.full_outer_match);

// Highly specialized join: connect assoc data to GWAS catalog data. This isn't a simple left join, because it tries to
//  pick the most significant claim in the catalog for a variant, rather than joining every possible match.
// This is specifically intended for sources that obey the ASSOC and CATALOG fields contracts.
registry.add('assoc_to_gwas_catalog', (assoc_data, catalog_data, assoc_key, catalog_key, catalog_logp_name) => {
    if (!assoc_data.length) {
        return assoc_data;
    }

    // Prepare the genes catalog: group the data by variant, create simplified dataset with top hit for each
    const catalog_by_variant = joins.groupBy(catalog_data, catalog_key);

    const catalog_flat = [];  // Store only the top significant claim for each catalog variant entry
    for (let claims of catalog_by_variant.values()) {
        // Find max item within this set of claims, push that to catalog_
        let best = 0;
        let best_variant;
        for (let item of claims) {
            const val = item[catalog_logp_name];
            if ( val >= best) {
                best_variant = item;
                best = val;
            }
        }
        best_variant.n_catalog_matches = claims.length;
        catalog_flat.push(best_variant);
    }
    return joins.left_match(assoc_data, catalog_flat, assoc_key, catalog_key);
});

// Highly specialized join: connect gnomAD constraint data to genes data. These are two very nonstandard payloads and need a special function to connect them.
registry.add('genes_to_gnomad_constraint', (genes_data, constraint_data) => {
    genes_data.forEach(function(gene) {
        // Find payload keys that match gene names in this response
        const alias = `_${gene.gene_name.replace(/[^A-Za-z0-9_]/g, '_')}`;  // aliases are modified gene names
        const constraint = constraint_data[alias] && constraint_data[alias]['gnomad_constraint']; // gnomad API has two ways of specifying missing data for a requested gene
        if (constraint) {
            // Add all fields from constraint data- do not override fields present in the gene source
            Object.keys(constraint).forEach(function (key) {
                let val = constraint[key];
                if (typeof gene[key] === 'undefined') {
                    if (typeof val == 'number' && val.toString().includes('.')) {
                        val = parseFloat(val.toFixed(2));
                    }
                    gene[key] = val;   // These two sources are both designed to bypass namespacing
                }
            });
        }
    });
    return genes_data;
});

export default registry;
