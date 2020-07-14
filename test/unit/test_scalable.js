import { assert } from 'chai';

import {categorical_bin, if_value, interpolate, numerical_bin, ordinal_cycle} from '../../esm/helpers/scalable';

describe('Scale Functions', function() {
    describe('if', function() {
        it('should match against an arbitrary value, return null if not matched', function() {
            const parameters = {
                field_value: 6,
                then: true,
            };
            assert.equal(if_value(parameters, 0), null);
            assert.equal(if_value(parameters, 'foo'), null);
            assert.equal(if_value(parameters, 6), true);
        });
        it('should optionally allow for defining an else', function() {
            const parameters = {
                field_value: 'kiwi',
                then: 'pineapple',
                else: 'watermelon',
            };
            assert.equal(if_value(parameters, 0), 'watermelon');
            assert.equal(if_value(parameters, 'foo'), 'watermelon');
            assert.equal(if_value(parameters, 'kiwi'), 'pineapple');
        });
    });
    describe('numerical_bin', function() {
        it('should work with arbitrarily many breaks/values', function() {
            const parameters = {
                breaks: [-167, -46, 15, 23, 76.8, 952],
                values: ['value-167', 'value-46', 'value15', 'value23', 'value76.8', 'value952'],
            };
            assert.equal(numerical_bin(parameters, -50000), 'value-167');
            assert.equal(numerical_bin(parameters, 0), 'value-46');
            assert.equal(numerical_bin(parameters, 76.799999999), 'value23');
            assert.equal(numerical_bin(parameters, 481329), 'value952');
            assert.equal(numerical_bin(parameters, 'foo'), null);
            assert.equal(numerical_bin(parameters, null), null);
        });
        it('should work with arbitrarily many breaks/values and an optional null_value parameter', function() {
            const parameters = {
                breaks: [0, 0.2, 0.4, 0.6, 0.8],
                values: ['value0', 'value0.2', 'value0.4', 'value0.6', 'value0.8'],
                null_value: 'null_value',
            };
            assert.equal(numerical_bin(parameters, 0), 'value0');
            assert.equal(numerical_bin(parameters, -12), 'value0');
            assert.equal(numerical_bin(parameters, 0.35), 'value0.2');
            assert.equal(numerical_bin(parameters, 0.79999999), 'value0.6');
            assert.equal(numerical_bin(parameters, 3246), 'value0.8');
            assert.equal(numerical_bin(parameters, 'foo'), 'null_value');
            assert.equal(numerical_bin(parameters, null), 'null_value');
        });
    });
    describe('categorical_bin', function() {
        it('should work with arbitrarily many categories/values', function() {
            const parameters = {
                categories: ['oxygen', 'fluorine', 'tungsten'],
                values: ['value-oxygen', 'value-fluorine', 'value-tungsten'],
            };
            assert.equal(categorical_bin(parameters, 'fluorine'), 'value-fluorine');
            assert.equal(categorical_bin(parameters, 'tungsten'), 'value-tungsten');
            assert.equal(categorical_bin(parameters, 135), null);
            assert.equal(categorical_bin(parameters, ['tungsten']), null);
            assert.equal(categorical_bin(parameters), null);
        });
        it('should work with arbitrarily many categories/values and an optional null_value parameter', function() {
            const parameters = {
                categories: ['dog', 'cat', 'hippo', 'marmoset'],
                values: ['value-dog', 'value-cat', 'value-hippo', 'value-marmoset'],
                null_value: 'null_value',
            };
            assert.equal(categorical_bin(parameters, 'dog'), 'value-dog');
            assert.equal(categorical_bin(parameters, 'hippo'), 'value-hippo');
            assert.equal(categorical_bin(parameters, 'CAT'), 'null_value');
            assert.equal(categorical_bin(parameters, 53), 'null_value');
            assert.equal(categorical_bin(parameters), 'null_value');
        });
    });
    describe('ordinal_cycle', function () {
        before(function () {
            this.options = { values: ['a', 'b', 'c'] };
        });
        it('should give adjacent points a different return value, even for same input', function () {
            const value = 'bob';
            assert.equal(ordinal_cycle(this.options, value, 0), 'a');
            assert.equal(ordinal_cycle(this.options, value, 1), 'b');
        });
        it('should be able to handle n_data > n_options', function () {
            const value = 'bob';
            assert.equal(ordinal_cycle(this.options, value, 0), 'a');
            assert.equal(ordinal_cycle(this.options, value, 3), 'a', 'Wraps around to start');
            assert.equal(ordinal_cycle(this.options, value, 4), 'b', 'Larger values continue to wrap');
        });
        after(function() {
            delete this.options;
        });
    });
    describe('interpolate', function() {
        it('should work with arbitrarily many breaks/values', function() {
            const parameters = {
                breaks: [-167, -45, 15, 23, 76.8, 952],
                values: [0, 10, 100, 1000, 10000, 100000],
                null_value: -1,
            };
            assert.equal(interpolate(parameters, -50000), 0);
            assert.equal(interpolate(parameters, 0), 77.5);
            assert.equal(interpolate(parameters, 76.799999999), 9999.999999832713);
            assert.equal(interpolate(parameters, 481329), 100000);
            assert.equal(interpolate(parameters, 'foo'), -1);
            assert.equal(interpolate(parameters), -1);
        });
        it('should interpolate colors', function() {
            const parameters = {
                breaks: [-100, -50, 0, 50, 100],
                values: ['#a6611a', '#dfc27d', '#f5f5f5', '#80cdc1', '#018571'],
                null_value: '#333333',
            };
            assert.equal(interpolate(parameters, 0), 'rgb(245, 245, 245)');
            assert.equal(interpolate(parameters, -12), 'rgb(240, 233, 216)');
            assert.equal(interpolate(parameters, 0.97), 'rgb(243, 244, 244)');
            assert.equal(interpolate(parameters, 74.1), 'rgb(67, 170, 154)');
            assert.equal(interpolate(parameters, 3246), '#018571');
            assert.equal(interpolate(parameters, 'foo'), '#333333');
            assert.equal(interpolate(parameters), '#333333');
        });
    });
});
