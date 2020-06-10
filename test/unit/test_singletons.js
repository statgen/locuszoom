'use strict';

/**
  Singletons.js Tests
  Test composition of various LocusZoom singleton objects
*/
describe('LocusZoom Singletons', function() {
    describe('Transformation Functions', function() {
        it('LocusZoom should have a TransformationFunctions singleton', function() {
            LocusZoom.should.have.property('TransformationFunctions').which.is.an.Object;
        });
        it('should have a method to list available label functions', function() {
            LocusZoom.TransformationFunctions.should.have.property('list').which.is.a.Function;
            LocusZoom.TransformationFunctions.list().should.be.an.Array;
            LocusZoom.TransformationFunctions.list().should.containEql('scinotation');
            LocusZoom.TransformationFunctions.list().should.containEql('neglog10');
        });
        it('should have a general method to get a function or execute it for a result', function() {
            LocusZoom.TransformationFunctions.should.have.property('get').which.is.a.Function;
            LocusZoom.TransformationFunctions.get('neglog10').should.be.a.Function;
        });
        it('should have a method to add a transformation function', function() {
            LocusZoom.TransformationFunctions.should.have.property('add').which.is.a.Function;
            var foo = function(x) { return x + 1; };
            LocusZoom.TransformationFunctions.add('foo', foo);
            LocusZoom.TransformationFunctions.list().should.containEql('foo');
            var returned_value = LocusZoom.TransformationFunctions.get('foo')(2);
            var expected_value = 3;
            assert.equal(returned_value, expected_value);
        });
        it('should have a method to change or delete existing transformation functions', function() {
            LocusZoom.TransformationFunctions.should.have.property('set').which.is.a.Function;
            var foo_new = function(x) { return x * 2; };
            LocusZoom.TransformationFunctions.set('foo', foo_new);
            LocusZoom.TransformationFunctions.list().should.containEql('foo');
            var returned_value = LocusZoom.TransformationFunctions.get('foo')(4);
            var expected_value = 8;
            assert.equal(returned_value, expected_value);
            LocusZoom.TransformationFunctions.set('foo');
            LocusZoom.TransformationFunctions.list().should.not.containEql('foo');
        });
        it('should throw an exception if asked to get a function that has not been defined', function() {
            assert.throws(function() {
                LocusZoom.TransformationFunctions.get('nonexistent');
            });
        });
        it('should throw an exception when adding a new transformation function with an already in use name', function() {
            assert.throws(function() {
                var foo = function(x) { return x / 4; };
                LocusZoom.TransformationFunctions.add('neglog10', foo);
            });
        });
        describe('neglog10', function() {
            var tests = [
                { arg: 0,         expected: null },
                { arg: -0.001,    expected: null },
                { arg: 'foo',     expected: null },
                { arg: 1,         expected: 0 },
                { arg: 10,        expected: -1 },
                { arg: 0.001,     expected: 2.9999999999999996 },
                { arg: 0.0000324, expected: 4.489454989793387 }
            ];
            tests.forEach(function(test) {
                it('should return correct negative log 10 for ' + test.arg, function() {
                    assert.equal(LocusZoom.TransformationFunctions.get('neglog10')(test.arg), test.expected);
                });
            });
        });
        describe('scinotation', function() {
            var tests = [
                { arg: -14000,          expected: '-1.40 × 10^4' },
                { arg: -5.50105,            expected: '-5.501' },
                { arg: 0,               expected: '0' },
                { arg: 1,               expected: '1.000' },
                { arg: 0.0562435,       expected: '0.056' },
                { arg: 14000,           expected: '1.40 × 10^4' },
                { arg: 0.0000002436246, expected: '2.44 × 10^-7' },
                { arg: 'foo',           expected: 'NaN' }
            ];
            tests.forEach(function(test) {
                it('should return correct scientific notation for ' + test.arg, function() {
                    assert.equal(LocusZoom.TransformationFunctions.get('scinotation')(test.arg), test.expected);
                });
            });
        });

        describe('htmlescape', function() {
            it('should escape characters with special meaning in xml, and ignore others', function() {
                assert.equal(
                    LocusZoom.TransformationFunctions.get('htmlescape')("<script type=\"application/javascript\">alert('yo & ' + `I`)</script>"),
                    '&lt;script type=&quot;application/javascript&quot;&gt;alert(&#039;yo &amp; &#039; + &#x60;I&#x60;)&lt;/script&gt;'
                );
            });
        });
    });



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
