import {RegistryBase} from './base';

/**
 * Plugin registry: allows adding LZ functionality for arbitrary new elements
 */
class Plugins extends RegistryBase {
    /**
     * Bulk-add an entire extension that may include many features.
     * @param {Object.<Array.<*>>} extensions  Each key is a type of feature to register (layout, data
     *  adapter, etc), and each value is an array of options to add to the corresponding internal registry.
     *  These are in the (name, options) format passed directly to registry.add() for that feature.
     *  Example: { adapters: [ ['name1', Source1] ], scalable: [ ['s1', func1] ], layouts: [['plot', 'myname', config]] }
     * @return {*}
     */
    use(extensions) {
        for (let[type, items] of Object.entries(extensions)) {
            for (let item of items) {
                this.get(type).add(...item);
            }
        }
    }
}

const registry = new Plugins();


export default registry;
export { Plugins as _PluginRegistry };
