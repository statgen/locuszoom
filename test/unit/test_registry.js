import {assert} from 'chai';
import {ClassRegistry, RegistryBase} from '../../esm/registry/base';
import { _TransformationFunctions } from '../../esm/registry/transforms';


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
            const fake = class {
                constructor(a) {
                    this.a = a;
                }
            };
            registry.add('fake', fake);
            const instance = registry.create('fake', 12);
            assert.equal(instance.a, 12);
        });

        it('.extend shortcut for quasi-subclassing', function () {
            const registry = new ClassRegistry();
            const fake = class {
                constructor(a) {
                    this.a = a;
                }

                b() {
                    return this.a + 1;
                }
            };
            registry.add('fake', fake);

            const NewChild = registry.extend('fake', 'new_child', { b() {
                return this.a + 2;
            }});
            const child = new NewChild(12);
            assert.equal(child.a, 12, 'Inherits constructor');
            assert.equal(child.b(), 14, 'Subclass overrides parent method');
            assert.ok(registry.get('new_child'));
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
