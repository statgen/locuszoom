import { assert } from 'chai';
import LAYOUTS, {_LayoutRegistry} from '../../esm/registry/layouts';
import {deepCopy, merge} from '../../esm/helpers/layouts';

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
            assert.deepEqual(lookup.get('test', 'test', mods), expected_layout);
        });

        it('Allows for namespacing arbitrary keys and values at all nesting levels', function() {
            const lookup = new _LayoutRegistry();
            const base_layout = {
                scalar_0: 123,
                '{{namespace}}scalar_1': 'aardvark',
                '{{namespace[dingo]}}scalar_2': '{{namespace[1]}}albacore',
                namespace_scalar: '{{namespace}}badger',
                namespace_0_scalar: '{{namespace[0]}}crocodile',
                namespace_dingo_scalar: '{{namespace[dingo]}}emu',
                namespace_1_scalar: '{{namespace[1]}}ferret',
                array_of_scalars: [ 4, 5, 6 ],
                nested_object: {
                    property_0: {
                        scalar_0: 0,
                        scalar_1: 'grackle',
                        namespace_scalar: '{{{{namespace}}hog}} and {{{{namespace[1]}}yak}} and {{{{namespace[jackal]}}zebu}}',
                        namespace_0_scalar: '{{namespace[0]}}iguana',
                        namespace_jackal_scalar: '{{namespace[jackal]}}kangaroo',
                        namespace_dingo_scalar: '{{namespace[dingo]}}lemur',
                        namespace_1_scalar: '{{namespace[1]}}moose',
                        array: ['nematoad', '{{namespace}}oryx', '{{namespace[1]}}pigeon', '{{namespace[jackal]}}quail'],
                        object: {
                            scalar: 'rhea',
                            array: ['serpent', '{{namespace[0]}}tortoise', '{{namespace[upapa]}}vulture', '{{namespace}}xerus'],
                        },
                    },
                    property_1: false,
                    property_2: true,
                },
            };

            lookup.add('test', 'test', base_layout);
            // Explicit directive to NOT apply namespaces: no changes
            const unnamespaced_layout = lookup.get('test', 'test', { unnamespaced: true });
            assert.deepEqual(unnamespaced_layout, base_layout);

            // No defined namespaces: drop all namespaces
            const no_namespace_layout = lookup.get('test', 'test');
            assert.equal(no_namespace_layout['scalar_1'], 'aardvark');
            assert.equal(no_namespace_layout['scalar_2'], 'albacore');
            assert.equal(no_namespace_layout.namespace_scalar, 'badger');
            assert.equal(no_namespace_layout.namespace_0_scalar, 'crocodile');
            assert.equal(no_namespace_layout.namespace_dingo_scalar, 'emu');
            assert.equal(no_namespace_layout.namespace_1_scalar, 'ferret');
            assert.equal(no_namespace_layout.nested_object.property_0.namespace_scalar, '{{hog}} and {{yak}} and {{zebu}}');
            assert.equal(no_namespace_layout.nested_object.property_0.namespace_0_scalar, 'iguana');
            assert.equal(no_namespace_layout.nested_object.property_0.namespace_jackal_scalar, 'kangaroo');
            assert.equal(no_namespace_layout.nested_object.property_0.namespace_dingo_scalar, 'lemur');
            assert.equal(no_namespace_layout.nested_object.property_0.namespace_1_scalar, 'moose');
            assert.equal(no_namespace_layout.nested_object.property_0.array[1], 'oryx');
            assert.equal(no_namespace_layout.nested_object.property_0.array[2], 'pigeon');
            assert.equal(no_namespace_layout.nested_object.property_0.array[3], 'quail');
            assert.equal(no_namespace_layout.nested_object.property_0.object.array[1], 'tortoise');
            assert.equal(no_namespace_layout.nested_object.property_0.object.array[2], 'vulture');
            assert.equal(no_namespace_layout.nested_object.property_0.object.array[3], 'xerus');

            // Single namespace string: use in place of all namespace placeholders
            const single_namespace_layout = lookup.get('test', 'test', { namespace: 'ns' });
            assert.equal(single_namespace_layout['ns:scalar_1'], 'aardvark');
            assert.equal(single_namespace_layout['ns:scalar_2'], 'ns:albacore');
            assert.equal(single_namespace_layout.namespace_scalar, 'ns:badger');
            assert.equal(single_namespace_layout.namespace_0_scalar, 'ns:crocodile');
            assert.equal(single_namespace_layout.namespace_dingo_scalar, 'ns:emu');
            assert.equal(single_namespace_layout.namespace_1_scalar, 'ns:ferret');
            assert.equal(single_namespace_layout.nested_object.property_0.namespace_scalar, '{{ns:hog}} and {{ns:yak}} and {{ns:zebu}}');
            assert.equal(single_namespace_layout.nested_object.property_0.namespace_0_scalar, 'ns:iguana');
            assert.equal(single_namespace_layout.nested_object.property_0.namespace_jackal_scalar, 'ns:kangaroo');
            assert.equal(single_namespace_layout.nested_object.property_0.namespace_dingo_scalar, 'ns:lemur');
            assert.equal(single_namespace_layout.nested_object.property_0.namespace_1_scalar, 'ns:moose');
            assert.equal(single_namespace_layout.nested_object.property_0.array[1], 'ns:oryx');
            assert.equal(single_namespace_layout.nested_object.property_0.array[2], 'ns:pigeon');
            assert.equal(single_namespace_layout.nested_object.property_0.array[3], 'ns:quail');
            assert.equal(single_namespace_layout.nested_object.property_0.object.array[1], 'ns:tortoise');
            assert.equal(single_namespace_layout.nested_object.property_0.object.array[2], 'ns:vulture');
            assert.equal(single_namespace_layout.nested_object.property_0.object.array[3], 'ns:xerus');

            // Array of namespaces: replace number-indexed namespace holders,
            // resolve {{namespace}} and any named namespaces to {{namespace[0]}}.
            const array_namespace_layout = lookup.get('test', 'test', { namespace: ['ns_0', 'ns_1'] });
            assert.equal(array_namespace_layout['ns_0:scalar_1'], 'aardvark');
            assert.equal(array_namespace_layout['ns_0:scalar_2'], 'ns_1:albacore');
            assert.equal(array_namespace_layout.namespace_scalar, 'ns_0:badger');
            assert.equal(array_namespace_layout.namespace_0_scalar, 'ns_0:crocodile');
            assert.equal(array_namespace_layout.namespace_dingo_scalar, 'ns_0:emu');
            assert.equal(array_namespace_layout.namespace_1_scalar, 'ns_1:ferret');
            assert.equal(array_namespace_layout.nested_object.property_0.namespace_scalar, '{{ns_0:hog}} and {{ns_1:yak}} and {{ns_0:zebu}}');
            assert.equal(array_namespace_layout.nested_object.property_0.namespace_0_scalar, 'ns_0:iguana');
            assert.equal(array_namespace_layout.nested_object.property_0.namespace_jackal_scalar, 'ns_0:kangaroo');
            assert.equal(array_namespace_layout.nested_object.property_0.namespace_dingo_scalar, 'ns_0:lemur');
            assert.equal(array_namespace_layout.nested_object.property_0.namespace_1_scalar, 'ns_1:moose');
            assert.equal(array_namespace_layout.nested_object.property_0.array[1], 'ns_0:oryx');
            assert.equal(array_namespace_layout.nested_object.property_0.array[2], 'ns_1:pigeon');
            assert.equal(array_namespace_layout.nested_object.property_0.array[3], 'ns_0:quail');
            assert.equal(array_namespace_layout.nested_object.property_0.object.array[1], 'ns_0:tortoise');
            assert.equal(array_namespace_layout.nested_object.property_0.object.array[2], 'ns_0:vulture');
            assert.equal(array_namespace_layout.nested_object.property_0.object.array[3], 'ns_0:xerus');
            // first defined key to any non-matching namespaces.
            const object_namespace_layout = lookup.get('test', 'test', {
                namespace: {
                    dingo: 'ns_dingo',
                    jackal: 'ns_jackal',
                    1: 'ns_1',
                    'default': 'ns_default',
                },
            });
            assert.equal(object_namespace_layout['ns_default:scalar_1'], 'aardvark');
            assert.equal(object_namespace_layout['ns_dingo:scalar_2'], 'ns_1:albacore');
            assert.equal(object_namespace_layout.namespace_scalar, 'ns_default:badger');
            assert.equal(object_namespace_layout.namespace_0_scalar, 'ns_default:crocodile');
            assert.equal(object_namespace_layout.namespace_dingo_scalar, 'ns_dingo:emu');
            assert.equal(object_namespace_layout.namespace_1_scalar, 'ns_1:ferret');
            assert.equal(object_namespace_layout.nested_object.property_0.namespace_scalar, '{{ns_default:hog}} and {{ns_1:yak}} and {{ns_jackal:zebu}}');
            assert.equal(object_namespace_layout.nested_object.property_0.namespace_0_scalar, 'ns_default:iguana');
            assert.equal(object_namespace_layout.nested_object.property_0.namespace_jackal_scalar, 'ns_jackal:kangaroo');
            assert.equal(object_namespace_layout.nested_object.property_0.namespace_dingo_scalar, 'ns_dingo:lemur');
            assert.equal(object_namespace_layout.nested_object.property_0.namespace_1_scalar, 'ns_1:moose');
            assert.equal(object_namespace_layout.nested_object.property_0.array[1], 'ns_default:oryx');
            assert.equal(object_namespace_layout.nested_object.property_0.array[2], 'ns_1:pigeon');
            assert.equal(object_namespace_layout.nested_object.property_0.array[3], 'ns_jackal:quail');
            assert.equal(object_namespace_layout.nested_object.property_0.object.array[1], 'ns_default:tortoise');
            assert.equal(object_namespace_layout.nested_object.property_0.object.array[2], 'ns_default:vulture');
            assert.equal(object_namespace_layout.nested_object.property_0.object.array[3], 'ns_default:xerus');
        });

        it('Allows for inheriting namespaces', function() {
            const lookup = new _LayoutRegistry();

            const layout_0 = {
                namespace: { dingo: 'ns_dingo', jackal: 'ns_jackal', default: 'ns_0' },
                '{{namespace[dingo]}}scalar_1': 'aardvark',
                '{{namespace[dingo]}}scalar_2': '{{namespace[jackal]}}albacore',
                scalar_3: '{{namespace}}badger',
            };
            lookup.add('test', 'layout_0', layout_0);

            const layout_1 = {
                namespace: { ferret: 'ns_ferret', default: 'ns_1' },
                '{{namespace}}scalar_1': 'emu',
                '{{namespace[ferret]}}scalar_2': '{{namespace}}kangaroo',
                nested_layout: lookup.get('test', 'layout_0', { unnamespaced: true }),
            };
            lookup.add('test', 'layout_1', layout_1);
            const ns_layout_1 = lookup.get('test', 'layout_1', {
                namespace: {
                    dingo: 'ns_dingo_mod',
                    default: 'ns_mod',
                },
            });
            assert.equal(ns_layout_1['ns_mod:scalar_1'], 'emu');
            assert.equal(ns_layout_1['ns_ferret:scalar_2'], 'ns_mod:kangaroo');
            assert.equal(ns_layout_1.nested_layout['ns_dingo_mod:scalar_1'], 'aardvark');
            assert.equal(ns_layout_1.nested_layout['ns_dingo_mod:scalar_2'], 'ns_jackal:albacore');
            assert.equal(ns_layout_1.nested_layout.scalar_3, 'ns_mod:badger');
        });
    });
});

describe('Layout helpers', function () {
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

        it('should throw an exception if either argument is not an object', function() {
            assert.throws(() => {
                merge();
            });
            assert.throws(() => {
                merge({});
            });
            assert.throws(() => {
                merge({}, '');
            });
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
                ['retrieves a list of scale function names', 'panels[?(@.tag === "association")]..scale_function', [ 'if', 'if', 'if', 'numerical_bin' ]],
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
            const base_layer = LAYOUTS.get('data_layer', 'association_pvalues');

            const scenarios = [
                ['set single value to a constant', '$.panels[?(@.tag === "association")].id', 'one', ['one']],
                ['toggle a boolean false to true', '$.fake_field', true, [true]],
                ['set many values to a constant', '$..id', 'all', ['all', 'all', 'all', 'all', 'all', 'all']],
                ['add items to an array', '$..data_layers[?(@.tag === "association")].fields', (old_value) => old_value.concat(['field1', 'field2']), [base_layer.fields.concat(['field1', 'field2'])]],
                // Two subtly different cases for nested objects (direct query, and as part of filtered list)
                ['mutate an object inside an object', '$..panels[?(@.tag === "association")].margin', (old_config) => (old_config.new_field = 10) && old_config, [{bottom: 40, left: 50, right: 50, top: 35, new_field: 10}]],
                ['mutate an object inside a list', '$..panels[?(@.tag === "association")]', (old_config) => (old_config.margin.new_field = 10) && old_config, [Object.assign(base_panel, {margin: {bottom: 40, left: 50, right: 50, top: 35, new_field: 10}})]],
            ];

            for (let [label, selector, mutator, expected] of scenarios) {
                const base = LAYOUTS.get('plot', 'standard_association');
                base.fake_field = false;
                assert.deepEqual(LAYOUTS.mutate_attrs(base, selector, mutator), expected, `Scenario '${label}' passed`);
            }
        });
    });
});
