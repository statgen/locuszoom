import TRANSFORMS from '../registry/transforms';

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
        // Two scenarios: we are requesting a field by full name, OR there are transforms to apply
        // `fieldname` or `namespace:fieldname` followed by `|filter1|filterN`
        const field_pattern = /^(?:\w+:\w+|^\w+)(?:\|\w+)*$/;
        if (!field_pattern.test(field)) {
            throw new Error(`Invalid field specifier: '${field}'`);
        }

        const [name, ...transforms] = field.split('|');

        this.full_name = field; // fieldname + transforms
        this.field_name = name; // just fieldname
        this.transformations = transforms.map((name) => TRANSFORMS.get(name));
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
        // Four resolutions: a) This is cached, b) this can be calculated from a known field, c) this is a known annotation rather than from an API, d) This field doesn't exist and returns as null
        if (typeof data[this.full_name] == 'undefined') { // Check for cached result
            let val = null;
            if (data[this.field_name] !== undefined) { // Fallback: value sans transforms
                val = data[this.field_name];
            } else if (extra && extra[this.field_name] !== undefined) { // Fallback: check annotations
                val = extra[this.field_name];
            } // Don't warn if no value found, because sometimes only certain rows will have a specific field (esp happens with annotations)
            data[this.full_name] = this._applyTransformations(val);
        }
        return data[this.full_name];
    }
}

export {Field as default};
