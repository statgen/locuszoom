/* global LocusZoom */
'use strict';

/**
 *
 * LocusZoom has various singleton objects that are used for registering functions or classes.
 * These objects provide safe, standard methods to redefine or delete existing functions/classes
 * as well as define new custom functions/classes to be used in a plot.
 *
 * @namespace Singletons
 */


/**************************
 * Transformation Functions
 *
 * Singleton for formatting or transforming a single input, for instance turning raw p values into negative log10 form
 * Transformation functions are chainable with a pipe on a field name, like so: "pvalue|neglog10"
 *
 * NOTE: Because these functions are chainable the FUNCTION is returned by get(), not the result of that function.
 *
 * All transformation functions must accept an object of parameters and a value to process.
 * @class
 */
LocusZoom.TransformationFunctions = (function() {
    /** @lends LocusZoom.TransformationFunctions */
    var obj = {};
    var transformations = {};

    var getTrans = function(name) {
        if (!name) {
            return null;
        }
        var fun = transformations[name];
        if (fun)  {
            return fun;
        } else {
            throw new Error('transformation ' + name + ' not found');
        }
    };

    //a single transformation with any parameters
    //(parameters not currently supported)
    var parseTrans = function(name) {
        return getTrans(name);
    };

    //a "raw" transformation string with a leading pipe
    //and one or more transformations
    var parseTransString = function(x) {
        var funs = [];
        var re = /\|([^|]+)/g;
        var result;
        while((result = re.exec(x)) !== null) {
            funs.push(result[1]);
        }
        if (funs.length === 1) {
            return parseTrans(funs[0]);
        } else if (funs.length > 1) {
            return function(x) {
                var val = x;
                for(var i = 0; i < funs.length; i++) {
                    val = parseTrans(funs[i])(val);
                }
                return val;
            };
        }
        return null;
    };

    /**
     * Retrieve a transformation function by name
     * @param {String} name The name of the transformation function to retrieve. May optionally be prefixed with a
     *   pipe (`|`) when chaining multiple transformation functions.
     * @returns {function} The constructor for the transformation function
     */
    obj.get = function(name) {
        if (name && name.substring(0,1) === '|') {
            return parseTransString(name);
        } else {
            return parseTrans(name);
        }
    };
    /**
     * Internal logic that registers a transformation function
     * @protected
     * @param {String} name
     * @param {function} fn
     */
    obj.set = function(name, fn) {
        if (name.substring(0,1) === '|') {
            throw new Error('transformation name should not start with a pipe');
        } else {
            if (fn) {
                transformations[name] = fn;
            } else {
                delete transformations[name];
            }
        }
    };

    /**
     * Register a transformation function
     * @param {String} name
     * @param {function} fn A transformation function (should accept one argument with the value)
     */
    obj.add = function(name, fn) {
        if (transformations[name]) {
            throw new Error('transformation already exists with name: ' + name);
        } else {
            obj.set(name, fn);
        }
    };
    /**
     * List the names of all registered transformation functions
     * @returns {String[]}
     */
    obj.list = function() {
        return Object.keys(transformations);
    };

    return obj;
})();

/**
 * Return the -log (base 10)
 * @function neglog10
 */
LocusZoom.TransformationFunctions.add('neglog10', function(x) {
    if (isNaN(x) || x <= 0) { return null; }
    return -Math.log(x) / Math.LN10;
});

/**
 * Convert a number from logarithm to scientific notation. Useful for, eg, a datasource that returns -log(p) by default
 * @function logtoscinotation
 */
LocusZoom.TransformationFunctions.add('logtoscinotation', function(x) {
    if (isNaN(x)) { return 'NaN'; }
    if (x === 0) { return '1'; }
    var exp = Math.ceil(x);
    var diff = exp - x;
    var base = Math.pow(10, diff);
    if (exp === 1) {
        return (base / 10).toFixed(4);
    } else if (exp === 2) {
        return (base / 100).toFixed(3);
    } else {
        return base.toFixed(2) + ' × 10^-' + exp;
    }
});

/**
 * Represent a number in scientific notation
 * @function scinotation
 * @param {Number} x
 * @returns {String}
 */
LocusZoom.TransformationFunctions.add('scinotation', function(x) {
    if (isNaN(x)) { return 'NaN'; }
    if (x === 0) { return '0'; }

    var abs = Math.abs(x);
    var log;
    if (abs > 1) {
        log = Math.ceil(Math.log(abs) / Math.LN10);
    } else {  // 0...1
        log = Math.floor(Math.log(abs) / Math.LN10);
    }
    if (Math.abs(log) <= 3) {
        return x.toFixed(3);
    } else {
        return x.toExponential(2).replace('+', '').replace('e', ' × 10^');
    }
});

/**
 * URL-encode the provided text, eg for constructing hyperlinks
 * @function urlencode
 * @param {String} str
 */
LocusZoom.TransformationFunctions.add('urlencode', function(str) {
    return encodeURIComponent(str);
});

/**
 * HTML-escape user entered values for use in constructed HTML fragments
 *
 * For example, this filter can be used on tooltips with custom HTML display
 * @function htmlescape
 * @param {String} str HTML-escape the provided value
 */
LocusZoom.TransformationFunctions.add('htmlescape', function(str) {
    if ( !str ) {
        return '';
    }
    str = str + '';

    return str.replace( /['"<>&`]/g, function( s ) {
        switch ( s ) {
        case "'":
            return '&#039;';
        case '"':
            return '&quot;';
        case '<':
            return '&lt;';
        case '>':
            return '&gt;';
        case '&':
            return '&amp;';
        case '`':
            return '&#x60;';
        }
    });
});
