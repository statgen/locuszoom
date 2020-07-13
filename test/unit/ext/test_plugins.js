import {assert} from 'chai';
import LocusZoom from '../../../esm';

// This line is here to show that plugins aren't registered as a side effect in ESM mode; must be explicitly registered
// eslint-disable-next-line no-unused-vars
import intervals_plugin from '../../../esm/ext/lz-intervals-track';

describe('Plugin/ extension system', function () {
    it.skip('requires the plugin to be explicitly registered', function () {
        // Note: other test files have already loaded the plugin; this will require a separate fixture for testing
        // Though imported via ESM, it's not registered as a side effect.
        assert.throws(() => {
            LocusZoom.Layouts.get('plot', 'interval_association');
        }, /not found/);
    });

    it('finds items once the plugin is registered', function () {
        const aplugin = function(LocusZoom) {
            LocusZoom.Adapters.add('testing', {});
        };
        LocusZoom.use(aplugin);
        assert.ok(LocusZoom.Adapters.get('testing'));

        // Cleanup
        LocusZoom.Adapters.remove('testing');
    });

    it('silently prevents double-registration', function() {
        const aplugin = function(LocusZoom) {
            LocusZoom.Adapters.add('test2', {});
        };
        LocusZoom.use(aplugin);
        assert.ok(LocusZoom.Adapters.get('test2'));

        // Second registration will have no effect- won't err and features still present
        LocusZoom.use(aplugin);
        assert.ok(LocusZoom.Adapters.get('test2'));

        // Cleanup
        LocusZoom.Adapters.remove('test2');
    });

    it('registers plugins defined via an object `install` property', function() {
        const aplugin = {
            install: function(LocusZoom) {
                LocusZoom.Adapters.add('test3', {});
            },
        };
        LocusZoom.use(aplugin);
        assert.ok(LocusZoom.Adapters.get('test3'));

        // Cleanup
        LocusZoom.Adapters.remove('test3');
    });

    it('allows arguments to be passed to the plugin during registration', function () {
        const aplugin = function(LocusZoom, thingname) {
            LocusZoom.Adapters.add(thingname, {});
        };
        const thing = 'test4';
        LocusZoom.use(aplugin, thing);
        assert.ok(LocusZoom.Adapters.get(thing));

        // Cleanup
        LocusZoom.Adapters.remove(thing);
    });
});
