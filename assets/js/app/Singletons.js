/* global LocusZoom,d3 */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Singletons

  LocusZoom has various singleton objects that are used for registering functions or classes.
  These objects provide safe, standard methods to redefine or delete existing functions/classes
  as well as define new custom functions/classes to be used in a plot.

*/


/* The Collection of "Known" Data Source Endpoints */

LocusZoom.KnownDataSources = (function() {
    var obj = {};
    var sources = [];

    var findSourceByName = function(x) {
        for(var i=0; i<sources.length; i++) {
            if (!sources[i].SOURCE_NAME) {
                throw("KnownDataSources at position " + i + " does not have a 'SOURCE_NAME' static property");
            }
            if (sources[i].SOURCE_NAME == x) {
                return sources[i];
            }
        }
        return null;
    };

    obj.get = function(name) {
        return findSourceByName(name);
    };

    obj.add = function(source) {
        if (!source.SOURCE_NAME) {
            console.warn("Data source added does not have a SOURCE_NAME");
        }
        sources.push(source);
    };

    obj.push = function(source) {
        console.warn("Warning: KnownDataSources.push() is deprecated. Use .add() instead");
        obj.add(source);
    };

    obj.list = function() {
        return sources.map(function(x) {return x.SOURCE_NAME;});
    };

    obj.create = function(name) {
        //create new object (pass additional parameters to constructor)
        var newObj = findSourceByName(name);
        if (newObj) {
            var params = arguments;
            params[0] = null;
            return new (Function.prototype.bind.apply(newObj, params));
        } else {
            throw("Unable to find data source for name: " + name); 
        }
    };

    //getAll, setAll and clear really should only be used by tests
    obj.getAll = function() {
        return sources;
    };
    
    obj.setAll = function(x) {
        sources = x;
    };

    obj.clear = function() {
        sources = [];
    };

    return obj;
})();

/**************************
  Transformation Functions

  Singleton for formatting or transforming a single input, for instance turning raw p values into negative log10 form
  Transformation functions are chainable with a pipe on a field name, like so: "pvalue|neglog10"

  NOTE: Because these functions are chainable the FUNCTION is returned by get(), not the result of that function.

  All transformation functions must accept an object of parameters and a value to process.
*/
LocusZoom.TransformationFunctions = (function() {
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
            throw("transformation " + name + " not found");
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
        var re = /\|([^\|]+)/g;
        var result;
        while((result = re.exec(x))!=null) {
            funs.push(result[1]);
        }
        if (funs.length==1) {
            return parseTrans(funs[0]);
        } else if (funs.length > 1) {
            return function(x) {
                var val = x;
                for(var i = 0; i<funs.length; i++) {
                    val = parseTrans(funs[i])(val);
                }
                return val;
            };
        }
        return null;
    };

    //accept both "|name" and "name"
    obj.get = function(name) {
        if (name && name.substring(0,1)=="|") {
            return parseTransString(name);
        } else {
            return parseTrans(name);
        }
    };

    obj.set = function(name, fn) {
        if (name.substring(0,1)=="|") {
            throw("transformation name should not start with a pipe");
        } else {
            if (fn) {
                transformations[name] = fn;
            } else {
                delete transformations[name];
            }
        }
    };

    obj.add = function(name, fn) {
        if (transformations[name]) {
            throw("transformation already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(transformations);
    };

    return obj;
})();

LocusZoom.TransformationFunctions.add("neglog10", function(x) {
    if (isNaN(x) || x <= 0){ return null; }
    return -Math.log(x) / Math.LN10;
});

LocusZoom.TransformationFunctions.add("logtoscinotation", function(x) {
    if (isNaN(x)){ return "NaN"; }
    if (x == 0){ return "1"; }
    var exp = Math.ceil(x);
    var diff = exp - x;
    var base = Math.pow(10, diff);
    if (exp == 1){
        return (base / 10).toFixed(4);
    } else if (exp == 2){
        return (base / 100).toFixed(3);
    } else {
        return base.toFixed(2) + " × 10^-" + exp;
    }
});

LocusZoom.TransformationFunctions.add("scinotation", function(x) {
    if (isNaN(x)){ return "NaN"; }
    if (x == 0){ return "0"; }
    var log;
    if (Math.abs(x) > 1){
        log = Math.ceil(Math.log(x) / Math.LN10);
    } else {
        log = Math.floor(Math.log(x) / Math.LN10);
    }
    if (Math.abs(log) <= 3){
        return x.toFixed(3);
    } else {
        return x.toExponential(2).replace("+", "").replace("e", " × 10^");
    }
});

LocusZoom.TransformationFunctions.add("urlencode", function(str) {
    return encodeURIComponent(str);
});


/****************
  Scale Functions

  Singleton for accessing/storing functions that will convert arbitrary data points to values in a given scale
  Useful for anything that needs to scale discretely with data (e.g. color, point size, etc.)

  All scale functions must accept an object of parameters and a value to process.
*/

LocusZoom.ScaleFunctions = (function() {
    var obj = {};
    var functions = {};

    obj.get = function(name, parameters, value) {
        if (!name) {
            return null;
        } else if (functions[name]) {
            if (typeof parameters == "undefined" && typeof value == "undefined"){
                return functions[name];
            } else {
                return functions[name](parameters, value);
            }
        } else {
            throw("scale function [" + name + "] not found");
        }
    };

    obj.set = function(name, fn) {
        if (fn) {
            functions[name] = fn;
        } else {
            delete functions[name];
        }
    };

    obj.add = function(name, fn) {
        if (functions[name]) {
            throw("scale function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();

// If scale function: apply a boolean conditional to a single field
LocusZoom.ScaleFunctions.add("if", function(parameters, input){
    if (typeof input == "undefined" || parameters.field_value != input){
        if (typeof parameters.else != "undefined"){
            return parameters.else;
        } else {
            return null;
        }
    } else {
        return parameters.then;
    }
});

// Numerical Bin scale function: bin a dataset numerically by an array of breakpoints
LocusZoom.ScaleFunctions.add("numerical_bin", function(parameters, input){
    var breaks = parameters.breaks || [];
    var values = parameters.values || [];
    if (typeof input == "undefined" || input == null || isNaN(+input)){
        return (parameters.null_value ? parameters.null_value : null);
    }
    var threshold = breaks.reduce(function(prev, curr){
        if (+input < prev || (+input >= prev && +input < curr)){
            return prev;
        } else {
            return curr;
        }
    });
    return values[breaks.indexOf(threshold)];
});

// Categorical Bin scale function: bin a dataset numerically by matching against an array of distinct values
LocusZoom.ScaleFunctions.add("categorical_bin", function(parameters, value){
    if (typeof value == "undefined" || parameters.categories.indexOf(value) == -1){
        return (parameters.null_value ? parameters.null_value : null); 
    } else {
        return parameters.values[parameters.categories.indexOf(value)];
    }
});

// Interpolate scale function
LocusZoom.ScaleFunctions.add("interpolate", function(parameters, input){
    var breaks = parameters.breaks || [];
    var values = parameters.values || [];
    var nullval = (parameters.null_value ? parameters.null_value : null);
    if (breaks.length < 2 || breaks.length != values.length){ return nullval; }
    if (typeof input == "undefined" || input == null || isNaN(+input)){ return nullval; }
    if (+input <= parameters.breaks[0]){
        return values[0];
    } else if (+input >= parameters.breaks[parameters.breaks.length-1]){
        return values[breaks.length-1];
    } else {
        var upper_idx = null;
        breaks.forEach(function(brk, idx){
            if (!idx){ return; }
            if (breaks[idx-1] <= +input && breaks[idx] >= +input){ upper_idx = idx; }
        });
        if (upper_idx == null){ return nullval; }
        var normalized_input = (+input - breaks[upper_idx-1]) / (breaks[upper_idx] - breaks[upper_idx-1]);
        if (!isFinite(normalized_input)){ return nullval; }
        return d3.interpolate(values[upper_idx-1], values[upper_idx])(normalized_input);
    }
});
