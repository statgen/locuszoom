import { assert } from 'chai';
import LAYOUTS, {_LayoutRegistry} from '../../esm/registry/layouts';
import {applyNamespaces, deepCopy, merge} from '../../esm/helpers/layouts';


describe('_LayoutRegistry', function() {
    describe('Provides a method to list current layouts by type', function() {
        it ('No argument: returns an object, keys are layout types and values are arrays of layout names', function() {
            const list = LAYOUTS.list();
            assert.isObject(list);
            assert.hasAllKeys(list, ['plot', 'panel', 'data_layer', 'toolbar', 'toolbar_widgets', 'tooltip']);
            Object.values(list).forEach((listing) => {
                assert.isString(listing[0]);
            });
        });

        it ('Passed a valid type: returns array of layout names matching that type', function() {
            const all = LAYOUTS.list();
            const just_plots = LAYOUTS.list('plot');

            assert.isArray(just_plots);
            assert.deepEqual(just_plots, all.plot);
        });
    });

    describe('Provides a method to add new layouts', function() {
        it ('Requires arguments as (string, string, object) or throws an exception', function() {
            assert.throws(() => {
                LAYOUTS.add();
            }, /must all/);
            assert.throws(() => {
                LAYOUTS.add('type_only');
            }, /must all/, 'Only type provided');
            assert.throws(() => {
                LAYOUTS.add('type', 'name');
            }, /must all/, 'Type and name provided, but no item');
        });

        it ('Adds a new type and stores the item', function() {
            const lookup = new _LayoutRegistry();
            const to_add = { id: 1 };
            lookup.add('new_type', 'walrus', to_add);

            const found = lookup.get('new_type', 'walrus');
            assert.deepEqual(found, to_add, 'Finds the expected item in the registry');

            to_add.id = 2;
            assert.deepEqual(found.id, 1, 'Registry stores a copy: mutating the source object later does not propagate changes');
        });

        it('annotates every new registry item with a best guess of what fields are requested from external providers', function() {
            const lookup = new _LayoutRegistry();

            const base_panel = { id: 'a_panel', red_herring: 'looks_like:a_field' };
            lookup.add('panel', 'not_modified', base_panel);
            let actual = lookup.get('panel', 'not_modified');
            assert.deepEqual(actual, base_panel, 'Panel layouts are unchanged');

            const base_layer = {
                id: 'a_layer',
                namespace: { assoc: 'assoc', ld: 'ld' },
                x_field: 'assoc:something',
                y_field: 'ld:correlation',
                red_herring: 'unknown_ns:means_not_field',
                label: 'chromosome {{chr}}',
            };
            lookup.add('data_layer', 'adds_autofields', base_layer);
            actual = lookup.get('data_layer', 'adds_autofields');
            assert.deepEqual(actual._auto_fields, ['assoc:something', 'ld:correlation'], 'Data layers in registry receive an added magic property called _auto_fields');
        });
    });

    // get()
    describe('Provides a method to get layout objects', function() {
        it('Must specify both type and name of the layout desired', function() {
            assert.throws(() => {
                LAYOUTS.get('plot');
            }, /Must specify/, 'Only type specified');

            assert.throws(() => {
                LAYOUTS.get('plot', 'nonexistent');
            }, /not found/, 'Unrecognized type specified');
        });

        it('Returns layout object when type and name match', function() {
            const result = LAYOUTS.get('panel', 'association');
            assert.equal(result.id, 'association');
        });

        it('Accepts an overrides option to alter the returned layout', function() {
            const lookup = new _LayoutRegistry();
            const base_layout = {
                scalar_1: 123,
                scalar_2: 'foo',
                array_of_scalars: [ 4, 5, 6 ],
                nested_object: {
                    property_1: {
                        alpha: 0,
                        bravo: 'foo',
                        charlie: ['delta', 'echo'],
                        foxtrot: {
                            golf: 'bar',
                            hotel: ['india', 'juliet', 'kilo'],
                        },
                    },
                    property_2: false,
                    property_3: true,
                },
            };
            const mods = {
                scalar_1: 456,
                array_of_scalars: [ 1, 2, 3 ],
                nested_object: {
                    property_1: {
                        foxtrot: {
                            golf: 789,
                            new_value: 'foo',
                        },
                    },
                    property_3: false,
                    new_value: 'bar',
                },
                new_value: 'baz',
            };
            const expected_layout = {
                scalar_1: 456,
                scalar_2: 'foo',
                array_of_scalars: [ 1, 2, 3 ],
                nested_object: {
                    property_1: {
                        alpha: 0,
                        bravo: 'foo',
                        charlie: ['delta', 'echo'],
                        foxtrot: {
                            golf: 789,
                            hotel: ['india', 'juliet', 'kilo'],
                            new_value: 'foo',
                        },
                    },
                    property_2: false,
                    property_3: false,
                    new_value: 'bar',
                },
                new_value: 'baz',
            };

            lookup.add('test', 'test', base_layout);
            const actual = lookup.get('test', 'test', mods);
            assert.deepEqual(actual, expected_layout);

            assert.notDeepEqual(actual, base_layout, 'Overriding the layout does not change the original');
        });

        it('Allows for overriding namespaces', function() {
            const lookup = new _LayoutRegistry();
            const layout = {
                width: 400,
                panels: [
                    {
                        data_layers: [
                            {id: 'assoc1', namespace: {assoc: 'assoc', ld: 'ld' }},
                            {id: 'assoc2', namespace: {assoc: 'assoc', catalog: 'catalog' }},
                        ],
                    },
                ],
            };
            lookup.add('plot', 'testfixture', layout);
            const modified = lookup.get('plot', 'testfixture', {
                namespace: { assoc: 'assoc12', catalog: 'ebi_cat' },
                width: 800, // Add a property during overrides
                new_prop: true,
            });
            const expected = {
                width: 800,
                new_prop: true,
                panels: [
                    {
                        data_layers: [
                            {id: 'assoc1', namespace: {assoc: 'assoc12', ld: 'ld' }},
                            {id: 'assoc2', namespace: {assoc: 'assoc12', catalog: 'ebi_cat' }},
                        ],
                    },
                ],
            };

            assert.deepEqual(modified, expected, 'Namespaces are applied to children as part of overrides');
        });
    });
});

describe('Layout helpers', function () {
    describe('applyNamespaces', function () {
        it('warns if layout or namespace-overrides are not objects', function () {
            assert.throws(
                () => applyNamespaces(null, {}),
                /as objects/,
            );
            assert.throws(
                () => applyNamespaces({}, 42),
                /as objects/,
            );
            assert.ok(applyNamespaces({}), 'If no namespaced provided, default value is used');
        });

        it('Can override namespaces referenced in both a layout and global object', function () {
            const base = {
                id: 'a_layer',
                namespace: { assoc: 'assoc', ld: 'ld', catalog: 'catalog' },
                x_field: 'assoc:position',
                y_field: 'ld:correlation',
            };

            const expected = {
                id: 'a_layer',
                namespace: { assoc: 'assoc22', ld: 'ld5', catalog: 'catalog' },
                x_field: 'assoc:position',
                y_field: 'ld:correlation',
            };


            // Note: a namespace is ONLY copied over if it is relevant to that data layer (other_anno should not appear anywhere)
            const actual = applyNamespaces(base, { assoc: 'assoc22', ld: 'ld5', other_anno: 'mything' });
            assert.deepEqual(actual, expected, 'Overrides as appropriate');
        });

        it('Can override namespaces in all child objects', function () {
            const base = {
                panels: [{
                    data_layers: [
                        { id: 'a', x_field: 'assoc:variant', namespace: { assoc: 'assoc', catalog: 'catalog' }},
                        { id: 'b', x_field: 'someanno:afield', namespace: { catalog: 'catalog', ld: 'ld', other_thing: 'unused' }},
                    ],
                }],
            };

            const expected = {
                panels: [{
                    data_layers: [
                        { id: 'a', x_field: 'assoc:variant', namespace: { assoc: 'myassoc', catalog: 'mycat' }},
                        { id: 'b', x_field: 'someanno:afield', namespace: { catalog: 'mycat', ld: 'ld5', other_thing: 'unused' }},
                    ],
                }],
            };

            const actual = applyNamespaces(base, { assoc: 'myassoc', ld: 'ld5', catalog: 'mycat' });
            assert.deepEqual(actual, expected, 'Selectively applies overrides to nested objects');
        });
    });

    describe('Provides a method to merge layout objects', function() {
        beforeEach(function() {
            this.default_layout = {
                scalar_1: 123,
                scalar_2: 'foo',
                array_of_scalars: [ 4, 5, 6 ],
                nested_object: {
                    property_1: {
                        alpha: 0,
                        bravo: 'foo',
                        charlie: ['delta', 'echo'],
                        foxtrot: {
                            golf: 'bar',
                            hotel: ['india', 'juliet', 'kilo'],
                        },
                    },
                    property_2: false,
                    property_3: true,
                },
            };
        });

        it('should return the passed default layout if provided an empty layout', function() {
            const returned_layout = merge({}, this.default_layout);
            assert.deepEqual(returned_layout, this.default_layout);
        });

        it('should copy top-level values', function() {
            const custom_layout = { custom_property: 'foo' };
            const expected_layout = deepCopy(this.default_layout);
            expected_layout.custom_property = 'foo';
            const returned_layout = merge(custom_layout, this.default_layout);
            assert.deepEqual(returned_layout, expected_layout);
        });

        it('should copy deeply-nested values', function() {
            const custom_layout = { nested_object: { property_1: { foxtrot: { sierra: 'tango' } } } };
            const expected_layout = JSON.parse(JSON.stringify(this.default_layout));
            expected_layout.nested_object.property_1.foxtrot.sierra = 'tango';
            const returned_layout = merge(custom_layout, this.default_layout);
            assert.deepEqual(returned_layout, expected_layout);
        });

        it('should not overwrite array values in the first with any values from the second', function() {
            const custom_layout = {
                array_of_scalars: [4, 6],
                nested_object: {
                    property_1: {
                        charlie: ['whiskey', 'xray'],
                    },
                    property_2: true,
                },
            };
            const expected_layout = JSON.parse(JSON.stringify(this.default_layout));
            expected_layout.array_of_scalars = [ 4, 6 ];
            expected_layout.nested_object.property_1.charlie = ['whiskey', 'xray'];
            expected_layout.nested_object.property_2 = true;
            const returned_layout = merge(custom_layout, this.default_layout);
            assert.deepEqual(returned_layout, expected_layout);
        });

        it('should allow for the first layout to override any value in the second regardless of type', function() {
            const custom_layout = {
                array_of_scalars: 'number',
                nested_object: {
                    property_1: {
                        foxtrot: false,
                    },
                    property_3: {
                        nested: {
                            something: ['foo'],
                        },
                    },
                },
            };
            const expected_layout = JSON.parse(JSON.stringify(this.default_layout));
            expected_layout.array_of_scalars = 'number';
            expected_layout.nested_object.property_1.foxtrot = false;
            expected_layout.nested_object.property_3 = { nested: { something: [ 'foo' ] } };
            const returned_layout = merge(custom_layout, this.default_layout);
            assert.deepEqual(returned_layout, expected_layout);
        });
    });

    describe('Provides a method to query specific attributes', function () {
        it('can query a set of values based on a jsonpath selector', function () {
            const base = LAYOUTS.get('plot', 'standard_association');
            base.extra_field = false;

            const scenarios = [
                ['predicate_filters retrieve only list items where a specific condition is met', '$..color[?(@.scale_function === "if")].field', ['lz_is_ld_refvar']],
                ['retrieves a list of scale function names', 'panels[?(@.tag === "association")]..scale_function', [ 'if', 'numerical_bin', 'if', 'effect_direction', 'if' ]],
                ['fetches dotted field path - one specific axis label', 'panels[?(@.tag === "association")].axes.x.label', [ 'Chromosome {{chr}} (Mb)' ]],
                ['is able to query and return falsy values', '$.extra_field', [false]],
                ['returns an empty list if no matches are found', '$.nonexistent', []],
            ];

            for (let [label, selector, expected] of scenarios) {
                assert.sameDeepMembers(LAYOUTS.query_attrs(base, selector), expected, `Scenario '${label}' passed`);
            }
        });

        it('can mutate a set of values based on a jsonpath selector', function () {
            const base_panel = LAYOUTS.get('panel', 'association');
            const scenarios = [
                ['set single value to a constant', '$.panels[?(@.tag === "association")].id', 'one', ['one']],
                ['toggle a boolean false to true', '$.fake_field', true, [true]],
                ['set many values to a constant', '$..id', 'all', ['all', 'all', 'all', 'all', 'all', 'all']],
                ['add items to an array', '$.some_list', (old_value) => old_value.concat(['field1', 'field2']), [['field0', 'field1', 'field2']]],
                // Two subtly different cases for nested objects (direct query, and as part of filtered list)
                ['mutate an object inside an object', '$..panels[?(@.tag === "association")].margin', (old_config) => (old_config.new_field = 10) && old_config, [{bottom: 40, left: 70, right: 55, top: 35, new_field: 10}]],
                ['mutate an object inside a list', '$..panels[?(@.tag === "association")]', (old_config) => (old_config.margin.new_field = 10) && old_config, [Object.assign(base_panel, {margin: {bottom: 40, left: 70, right: 55, top: 35, new_field: 10}})]],
            ];

            for (let [label, selector, mutator, expected] of scenarios) {
                const base = LAYOUTS.get('plot', 'standard_association');
                base.fake_field = false;
                base.some_list = ['field0'];
                assert.deepEqual(LAYOUTS.mutate_attrs(base, selector, mutator), expected, `Scenario '${label}' passed`);
            }
        });
    });
});
