/**
 * "Data operation" functions, with call signature (state, [recordsetA, recordsetB...], ...params) => combined_results
 *
 * These usually operate on two recordsets (joins), but can operate on one recordset (eg grouping) or > 2 (hopefully rare)
 *
 * Pieces of code designed to transform or connect well structured data, usually as returned from an API
 *
 * Most of these are `joins`: intended to combine two recordsets (like assoc + ld) to a single final source of truth
 *
 * In a few cases, the rules of how to combine datasets are very specific to those two types of data. Some,
 *   particularly for advanced features, may carry assumptions about field names/ formatting.
 *   (example: log_pvalue instead of pvalue, or variant specifier formats)
 *
 * @module LocusZoom_DataFunctions
 */
import {joins} from 'undercomplicate';

import {RegistryBase} from './base';

/**
 * A plugin registry that allows plots to use both pre-defined and user-provided "data join" functions.
 * @alias module:LocusZoom~DataFunctions
 * @type {module:registry/base~RegistryBase}
 */
const registry = new RegistryBase();

function _wrap_join(handle) {
    // Validate number of arguments and convert call signature from (plot_state, deps, ...params) to (left, right, ...params).
    // Must data operations are joins, so this wrapper is common shared code.
    return (plot_state, deps, ...params) => {
        if (deps.length !== 2) {
            throw new Error('Join functions must receive exactly two recordsets');
        }
        return handle(...deps, ...params);
    };
}

// Highly specialized join: connect assoc data to GWAS catalog data. This isn't a simple left join, because it tries to
//  pick the most significant claim in the catalog for a variant, rather than joining every possible match.
// This is specifically intended for sources that obey the ASSOC and CATALOG fields contracts.
function assoc_to_gwas_catalog(assoc_data, catalog_data, assoc_key, catalog_key, catalog_logp_name) {
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
}

// Highly specialized join: connect gnomAD constraint data to genes data. These are two very nonstandard payloads and need a special function to connect them.
function genes_to_gnomad_constraint(genes_data, constraint_data) {
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
}


/**
 * Perform a left outer join, based on records where the field values at `left_key` and `right_key` are identical
 *
 * By analogy with SQL, the result will include all values in the left recordset, annotated (where applicable) with all keys from matching records in the right recordset
 *
 * @function
 * @name left_match
 * @param {Object} plot_state
 * @param {Array[]} recordsets
 * @param {String} left_key
 * @params {String} right_key
 */
registry.add('left_match', _wrap_join(joins.left_match));

/**
 * Perform an inner join, based on records where the field values at `left_key` and `right_key` are identical
 *
 * By analogy with SQL, the result will include all fields from both recordsets, but only for records where both the left and right keys are defined, and equal. If a record is not in one or both recordsets, it will be excluded from the result.
 *
 * @function
 * @name inner_match
 * @param {Object} plot_state
 * @param {Array[]} recordsets
 * @param {String} left_key
 * @params {String} right_key
 */
registry.add('inner_match', _wrap_join(joins.inner_match));

/**
 * Perform a full outer join, based on records where the field values at `left_key` and `right_key` are identical
 *
 * By analogy with SQL, the result will include all records from both the left and right recordsets. If there are matching records, then the relevant items will include fields from both records combined into one.
 *
 * @function
 * @name full_outer_match
 * @param {Object} plot_state
 * @param {Array[]} recordsets
 * @param {String} left_key
 * @params {String} right_key
 */
registry.add('full_outer_match', _wrap_join(joins.full_outer_match));

/**
 * A single purpose join function that combines GWAS data with best claim from the EBI GWAS catalog. Essentially this is a left join modified to make further decisions about which records to use.
 *
 * @function
 * @name assoc_to_gwas_catalog
 * @param {Object} plot_state
 * @param {Array[]} recordsets An array with two items: assoc records, then catalog records
 * @param {String} assoc_key The name of the key field in association data, eg variant ID
 * @param {String} catalog_key The name of the key field in gwas catalog data, eg variant ID
 * @param {String} catalog_log_p_name The name of the "log_pvalue" field in gwas catalog data, used to choose the most significant claim for a given variant
 */
registry.add('assoc_to_gwas_catalog', _wrap_join(assoc_to_gwas_catalog));

/**
 * A single purpose join function that combines gene data (UM Portaldev API format) with gene constraint data (gnomAD api format).
 *
 * This acts as a left join that has to perform custom operations to parse two very unusual recordset formats.
 *
 * @function
 * @name genes_to_gnomad_constraint
 * @param {Object} plot_state
 * @param {Array[]} recordsets An array with two items: UM Portaldev API gene records, then gnomAD gene constraint data
 */
registry.add('genes_to_gnomad_constraint', _wrap_join(genes_to_gnomad_constraint));

export default registry;
