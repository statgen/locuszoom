'use strict';

/**
  Singletons.js Tests
  Test composition of various LocusZoom singleton objects
*/
describe('LocusZoom Singletons', function() {



    describe('KnownDataSources', function() {
        describe('KnownDatasources.extend', function () {
            it('should fail when asked to extend a source type that does not exist', function () {
                assert.throws(
                    function() {
                        LocusZoom.KnownDataSources.extend('nonexistent');
                    },
                    /Attempted to subclass an unknown or unregistered data source/
                );
            });

            it('should validate arguments', function() {
                assert.throws(
                    function() { LocusZoom.KnownDataSources.extend('StaticJSON'); },
                    /Must provide a name for the new data source/
                );

                assert.throws(
                    function() { LocusZoom.KnownDataSources.extend('StaticJSON', 'validname'); },
                    /Must specify an object of properties and methods/,
                    'Must provide overrides'
                );
                assert.throws(
                    function() { LocusZoom.KnownDataSources.extend('StaticJSON', 'validname', 12); },
                    /Must specify an object of properties and methods/,
                    'Overrides should be an object'
                );
                // Last example should work with no error
                assert.doesNotThrow(function() { LocusZoom.KnownDataSources.extend('StaticJSON', 'validname', {}); });
            });

            it('should return a valid subclass that extends methods from the parent', function() {
                var custom_source_class = LocusZoom.KnownDataSources.extend(
                    'StaticJSON',
                    'HasExtraMethod',
                    { customMethod: function() { return 12; } }
                );
                var source = new custom_source_class('Input data');
                assert.equal(source.customMethod({}), 12, 'Should be able to call custom method');
                assert.equal(custom_source_class.SOURCE_NAME, 'HasExtraMethod', 'Source name should be set correctly');
                // Last assertion depends on testing a promise (async method) but should instantly resolve
                return source.getRequest().then(function(result) {
                    assert.equal(result, 'Input data', 'Uses parent method when child does not override');
                });
            });
        });
    });
});
