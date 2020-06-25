/*
 * Define functions used by Scalable Layout Directives.
 *
 * These "scaling functions" are used during rendering to return output (eg color) based on input value
 */

import * as d3 from 'd3';

/**
 * Basic conditional function to evaluate the value of the input field and return based on equality.
 * @param {Object} parameters
 * @param {*} parameters.field_value The value against which to test the input value.
 * @param {*} parameters.then The value to return if the input value matches the field value
 * @param {*} parameters.else  The value to return if the input value does not match the field value. Optional. If not
 *   defined this scale function will return null (or value of null_value parameter, if defined) when input value fails
 *   to match field_value.
 * @param {*} input value
 */
const if_value = (parameters, input) => {
    if (typeof input == 'undefined' || parameters.field_value !== input) {
        if (typeof parameters.else != 'undefined') {
            return parameters.else;
        } else {
            return null;
        }
    } else {
        return parameters.then;
    }
};

/**
 * Function to sort numerical values into bins based on numerical break points. Will only operate on numbers and
 *   return null (or value of null_value parameter, if defined) if provided a non-numeric input value. Parameters:
 * @function numerical_bin
 * @param {Object} parameters
 * @param {Number[]} parameters.breaks  Array of numerical break points against which to evaluate the input value.
 *   Must be of equal length to values parameter. If the input value is greater than or equal to break n and less than
 *   or equal to break n+1 (or break n+1 doesn't exist) then returned value is the nth entry in the values parameter.
 * @param {Array} parameters.values  Array of values to return given evaluations against break points. Must be of
 *   equal length to breaks parameter. Each entry n represents the value to return if the input value is greater than
 *   or equal to break n and less than or equal to break n+1 (or break n+1 doesn't exist).
 * @param {*} parameters.null_value
 * @param {*} input value
 * @returns
 */
const numerical_bin = (parameters, input) => {
    const breaks = parameters.breaks || [];
    const values = parameters.values || [];
    if (typeof input == 'undefined' || input === null || isNaN(+input)) {
        return (parameters.null_value ? parameters.null_value : null);
    }
    const threshold = breaks.reduce(function (prev, curr) {
        if (+input < prev || (+input >= prev && +input < curr)) {
            return prev;
        } else {
            return curr;
        }
    });
    return values[breaks.indexOf(threshold)];
};

/**
 * Function to sort values of any type into bins based on direct equality testing with a list of categories.
 *   Will return null if provided an input value that does not match to a listed category.
 * @function categorical_bin
 * @param {Object} parameters
 * @param {Array} parameters.categories  Array of values against which to evaluate the input value. Must be of equal
 *   length to values parameter. If the input value is equal to category n then returned value is the nth entry in the
 *   values parameter.
 * @param {Array} parameters.values  Array of values to return given evaluations against categories. Must be of equal
 *   length to categories parameter. Each entry n represents the value to return if the input value is equal to the nth
 *   value in the categories parameter.
 * @param {*} parameters.null_value  Value to return if the input value fails to match to any categories. Optional.
 */
const categorical_bin = (parameters, value) => {
    if (typeof value == 'undefined' || !parameters.categories.includes(value)) {
        return (parameters.null_value ? parameters.null_value : null);
    } else {
        return parameters.values[parameters.categories.indexOf(value)];
    }
};
/**
 * Cycle through a set of options, so that the each element in a set of data receives a value different than the
 *  element before it. For example: "use this palette of 10 colors to visually distinguish 100 adjacent items"
 *  @param {Object} parameters
 *  @param {Array} parameters.values A list of option values
 * @return {*}
 */
const ordinal_cycle = (parameters, value, index) => {
    var options = parameters.values;
    return options[index % options.length];
};
/**
 * Function for continuous interpolation of numerical values along a gradient with arbitrarily many break points.
 * @function interpolate
 * @parameters {Object} parameters
 * @parameters {Number[]} parameters.breaks  Array of numerical break points against which to evaluate the input value.
 *   Must be of equal length to values parameter and contain at least two elements. Input value will be evaluated for
 *   relative position between two break points n and n+1 and the returned value will be interpolated at a relative
 *   position between values n and n+1.
 * @parameters {*[]} parameters.values  Array of values to interpolate and return given evaluations against break
 *   points. Must be of equal length to breaks parameter and contain at least two elements. Each entry n represents
 *   the value to return if the input value matches the nth entry in breaks exactly. Note that this scale function
 *   uses d3.interpolate to provide for effective interpolation of many different value types, including numbers,
 *   colors, shapes, etc.
 * @parameters {*} parameters.null_value
 */
const interpolate = (parameters, input) => {
    var breaks = parameters.breaks || [];
    var values = parameters.values || [];
    var nullval = (parameters.null_value ? parameters.null_value : null);
    if (breaks.length < 2 || breaks.length !== values.length) {
        return nullval;
    }
    if (typeof input == 'undefined' || input === null || isNaN(+input)) {
        return nullval;
    }
    if (+input <= parameters.breaks[0]) {
        return values[0];
    } else if (+input >= parameters.breaks[parameters.breaks.length - 1]) {
        return values[breaks.length - 1];
    } else {
        var upper_idx = null;
        breaks.forEach(function (brk, idx) {
            if (!idx) {
                return;
            }
            if (breaks[idx - 1] <= +input && breaks[idx] >= +input) {
                upper_idx = idx;
            }
        });
        if (upper_idx === null) {
            return nullval;
        }
        const normalized_input = (+input - breaks[upper_idx - 1]) / (breaks[upper_idx] - breaks[upper_idx - 1]);
        if (!isFinite(normalized_input)) {
            return nullval;
        }
        return d3.interpolate(values[upper_idx - 1], values[upper_idx])(normalized_input);
    }
};


export { categorical_bin, if_value, interpolate, numerical_bin, ordinal_cycle };
