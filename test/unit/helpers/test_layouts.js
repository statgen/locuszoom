import {assert} from 'chai';
import sinon from 'sinon';

import {findFields, renameField} from '../../../esm/helpers/layouts';

describe('Layout helper functions', function () {
    describe('findFields', function () {
        it('does not try to find requested fields if there are no namespaces declared', function () {
            const layout = {
                x_field: 'assoc:position',
                y_field: 'ld:correlation',
                color: 'red',
            };

            const result = [...findFields(layout, [])];
            assert.equal(result.length, 0, 'No fields looked for or found');
        });

        it('finds simple primitive values', function () {
            const namespaces = ['assoc', 'ld'];
            const layout = {
                x_field: 'assoc:position',
                y_field: 'ld:correlation',
                label_field_with_filter: 'assoc:variant|htmlescape',
                redundant_field: 'assoc:variant',
                color: 'red',
                spurious: 'X:2500_A/C',
            };
            const result = [...findFields(layout, namespaces)];
            assert.sameMembers(result, ['assoc:position', 'assoc:variant', 'ld:correlation'], 'Finds all unique valid field names (and strips filter usages)');
        });

        it('finds values inside template syntax', function () {
            const namespaces = ['assoc'];
            const layout = {
                y_field: 'ld:correlation', // Not listed in namespace = not in fields contract
                text: '{{assoc:nearest_gene}} - {{#if assoc:rsid}} <a href="url.com/{{assoc:rsid|htmlescape}}" {/if}}',
                color: 'red',
                spurious: 'X:2500_A/C',
            };
            const result = [...findFields(layout, namespaces)];
            assert.sameMembers(
                result,
                ['assoc:nearest_gene', 'assoc:rsid'],
                'Finds all unique valid field names'
            );
        });

        it('searches for field names in compound objects', function () {
            const namespaces = ['phewas'];
            const layout = {
                color: [{
                    field: 'phewas:trait_group',
                    scale_function: 'categorical_bin',
                    parameters: {
                        categories: [],
                        values: [],
                        null_value: '#B8B8B8',
                    },
                }],
            };
            const result = [...findFields(layout, namespaces)];
            assert.sameMembers(
                result,
                ['phewas:trait_group'],
                'Finds nested field names'
            );
        });
    });

    describe('renameFields', function () {
        beforeEach(function() {
            this.warn_spy = sinon.spy(console, 'warn');
        });
        afterEach(function() {
            sinon.restore();
        });

        it('recursively renames the field across objects, arrays, and strings', function () {
            let base = {
                id: 'layout',
                x_axis: { field: 'old_name' },
                y_axis: { field: 'unrelated_thing' },
                category_field_name: 'old_name',
                fields: ['old_name'],
                no_value: null,
            };
            base = renameField(base, 'old_name', 'moon_unit');
            assert.deepEqual(base, {
                id: 'layout',
                x_axis: { field: 'moon_unit' },
                y_axis: { field: 'unrelated_thing' },
                category_field_name: 'moon_unit',
                fields: ['moon_unit'],
                no_value: null,
            });
        });

        it('will handle filters and partial fragments appropriately', function () {
            let base = {
                field1: 'old_name',
                field2: 'old_name|htmlescape',
                field3: 'old_name_truncated',
            };

            base = renameField(base, 'old_name', 'moon_unit');
            assert.deepEqual(base, {
                field1: 'moon_unit',
                field2: 'moon_unit|htmlescape',
                field3: 'old_name_truncated',
            });
        });

        it('warns when a value is used with filters', function () {
            let base = { field1: 'old_name|htmlescape' };

            base = renameField(base, 'old_name', 'moon_unit');
            assert.deepEqual(base, { field1: 'moon_unit|htmlescape' });
            assert.ok(this.warn_spy.calledOnce, 'console.warn was called');
            assert.match(this.warn_spy.firstCall.args[0], /old_name\|htmlescape/, 'Error message specifies the field and filter to check');

            base = renameField(base, 'old_name', 'moon_unit', false);
            assert.ok(this.warn_spy.calledOnce, 'console.warn output was suppressed on second function call');
        });

        it('handles field names embedded in template literals', function () {
            let base = {
                tooltip_template: '{{old_name}} likes music',
                label_template: 'Dweezil and {{old_name}} went out for ice cream; {{old_name}} paid the bill',
            };

            base = renameField(base, 'old_name', 'moon_unit');
            assert.deepEqual(base, {
                tooltip_template: '{{moon_unit}} likes music',
                label_template: 'Dweezil and {{moon_unit}} went out for ice cream; {{moon_unit}} paid the bill',
            });
        });

        it('works with abstract layouts and namespace syntax', function () {
            let base = {
                field: '{{namespace[family]}}old_name',
                template: '{{{{namespace[family]}}old_name}} was here',
            };
            base = renameField(base, '{{namespace[family]}}old_name', '{{namespace[family]}}moon_unit');
            assert.deepEqual(base, {
                field: '{{namespace[family]}}moon_unit',
                template: '{{{{namespace[family]}}moon_unit}} was here',
            });
        });

        it('can also be (ab)used to strip filters from an existing name', function () {
            let base = { field: 'old_name|afilter' };
            base = renameField(base, 'old_name|afilter', 'old_name');
            assert.deepEqual(base, { field: 'old_name' });
        });
    });
});
