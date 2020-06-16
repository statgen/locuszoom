import {assert} from 'chai';
import {ClassRegistry, RegistryBase} from '../../esm/registry/base';
import { _TransformationFunctions } from '../../esm/registry/transforms';
import {_PluginRegistry} from '../../esm/registry/plugins';
import {_LayoutRegistry} from '../../esm/registry/layouts';
import {BaseSource} from '../../esm/data';
import {AssociationLZ} from '../../esm/data/adapters';

describe('Registries', function() {
    describe('Registry Base Behaviors', function () {
        before(function() {
            this.registry = new RegistryBase();
            this.registry.add('first', 'alice');
            this.registry.add('second', 'bob');
            this.registry.add('third', 'eve');
        });

        it('finds an item by name', function () {
            assert.equal(this.registry.get('first'), 'alice');
        });

        it('throws an error if item not present', function () {
            assert.throws(() => {
                this.registry.get('fourth');
            }, /not found/);
        });

        it('fails to add an item if the name is already used', function () {
            assert.throws(() => {
                this.registry.add('first');
            }, /already defined/);

            this.registry.add('first', 'eve', true);
            assert.equal(this.registry.get('first'), 'eve', 'Override is allowed with a specific flag');
        });

        it('removes an item from the registry', function () {
            this.registry.add('redshirt', 12);
            let result = this.registry.remove('redshirt');
            assert.isTrue(result, 'item removed');
            assert.isNotTrue(this.registry.has('redshirt'), 'item no longer present');


            result = this.registry.remove('redshirt');
            assert.isNotTrue(result, 'item was already removed');
        });

        it('lists the names of available items', function() {
            const items = this.registry.list();
            assert.sameMembers(items, ['first', 'second', 'third']);
        });
    });

    describe('ClassRegistry special behaviors', function () {
        it('can create an instance of a class from the registry', function() {
            const registry = new ClassRegistry();
            const fake = class { constructor(a) { this.a = a; } };
            registry.add('fake', fake);
            const instance = registry.create('fake', 12);
            assert.equal(instance.a, 12);
        });
    });

    describe('Plugin registry can bulk-add features', function () {
        beforeEach(function () {
            // The plugin registry proxies to several subtypes with special behavior. Ensure that individual semantics
            //  are obeyed.
            const fixture = new _PluginRegistry();
            fixture.add('layouts', new _LayoutRegistry());
            fixture.add('adapters', new ClassRegistry());
            fixture.add('scalable', new RegistryBase());

            this.fixture = fixture;
        });
        it('throws an error if adding an unexpected feature type', function () {
            assert.throws(() => this.fixture.use({ squids: ['giant', 'cuttlefish'] }), /Item not found/);
        });
        it('allows bulk registering extension types', function () {
            const additions = {
                layouts: [ ['plot', 'myplot', { foo: 12 }] ],
                adapters: [
                    ['a1', BaseSource],
                    ['a2', AssociationLZ]
                ],
                scalable: [
                    ['scalename', (v) => 12],
                    ['a2', (v) => v], // names must only be unique per registry
                ],
            };
            this.fixture.use(additions);

            // Inspect the internal members to ensure that all plugin members were added correctly
            assert.equal(
                this.fixture.get('layouts').get('plot', 'myplot').foo,
                12
            );
            assert.equal(this.fixture.get('adapters').get('a2'), AssociationLZ);
            assert.equal(this.fixture.get('scalable').get('a2')(1), 1);
        });
    });

    describe('Transformation registry special behaviors', function() {
        before(function() {
            this.registry = new _TransformationFunctions();
            this.registry.add('func1', (v) => v + 1);
            this.registry.add('func2', (v) => v + 2);
        });

        it('fetches a single function by name', function () {
            const item = this.registry.get('func1');
            assert.equal(item(1), 2);
        });

        it('converts a template string into a rollup of several functions', function () {
            const item = this.registry.get('|func1|func2');
            assert.equal(item(1), 4);
        });

        it('returns null if no function requested', function () {
            // Special requirement for transformations due to how templates are processed
            const result = this.registry.get(null);
            assert.isNull(result);
        });
    });
});
