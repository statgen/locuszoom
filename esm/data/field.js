import transforms from '../registry/transforms';

/**
 * Represents an addressable unit of data from a namespaced datasource, subject to specified value transformations.
 *
 * When used by a data layer, fields will automatically be re-fetched from the appropriate data source whenever the
 *   state of a plot fetches, eg pan or zoom operations that would affect what data is displayed.
 *
 * @private
 * @class
 * @param {String} field A string representing the namespace of the datasource, the name of the desired field to fetch
 *   from that datasource, and arbitrarily many transformations to apply to the value. The namespace and
 *   transformation(s) are optional and information is delimited according to the general syntax
 *   `[namespace:]name[|transformation][|transformation]`. For example, `association:pvalue|neglog10`
 */
class Field {
    constructor(field) {
        const parts = /^(?:([^:]+):)?([^:|]*)(\|.+)*$/.exec(field);
        /** @member {String} */
        this.full_name = field;
        /** @member {String} */
        this.namespace = parts[1] || null;
        /** @member {String} */
        this.name = parts[2] || null;
        /** @member {Array} */
        this.transformations = [];

        if (typeof parts[3] == 'string' && parts[3].length > 1) {
            this.transformations = parts[3].substring(1).split('|');
            this.transformations.forEach((transform, i) => this.transformations[i] = transforms.get(transform));
        }
    }

    _applyTransformations(val) {
        this.transformations.forEach(function(transform) {
            val = transform(val);
        });
        return val;
    }

    /**
     * Resolve the field for a given data element.
     *   First look for a full match with transformations already applied by the data requester.
     *   Otherwise prefer a namespace match and fall back to just a name match, applying transformations on the fly.
     * @param {Object} data Returned data/fields into for this element
     * @param {Object} [extra] User-applied annotations for this point (info not provided by the server that we want
     *  to preserve across re-renders). Example usage: "should_show_label"
     * @returns {*}
     */
    resolve(data, extra) {
        if (typeof data[this.full_name] == 'undefined') { // Check for cached result
            let val = null;
            if (typeof (data[this.namespace + ':' + this.name]) != 'undefined') { // Fallback: value sans transforms
                val = data[this.namespace + ':' + this.name];
            } else if (typeof data[this.name] != 'undefined') { // Fallback: value present without namespace
                val = data[this.name];
            } else if (extra && typeof extra[this.full_name] != 'undefined') { // Fallback: check annotations
                val = extra[this.full_name];
            } // We should really warn if no value found, but many bad layouts exist and this could break compatibility
            data[this.full_name] = this._applyTransformations(val);
        }
        return data[this.full_name];
    }
}

export default Field;
