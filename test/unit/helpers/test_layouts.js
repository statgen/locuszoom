import {assert} from 'chai';
import sinon from 'sinon';

import {renameField} from '../../../esm/helpers/layouts';

describe('Layout helper functions', function () {
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
