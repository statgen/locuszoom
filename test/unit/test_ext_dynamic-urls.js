'use strict';

/**
 * LocusZoom.ext.DynamicUrls : Extension functionality
 */
describe('LocusZoom.ext.DynamicUrls', function() {
    beforeEach(function() {
        this.extension = LocusZoom.ext.DynamicUrls;
    });

    // Tests
    it('registers itself as a LocusZoom extension with a well-defined public interface', function () {
        var extension = this.extension;
        should.exist(extension, 'Extension should be registered');

        var publicMethods = ['paramsFromUrl', 'plotWatchesUrl', 'plotUpdatesUrl', 'extractValues'];
        assert.equal(Object.keys(extension).length, publicMethods.length, 'Some methods do not match the expected public interface');
        publicMethods.forEach(function(name) {
            assert.ok(extension.hasOwnProperty(name), 'Interface is missing an expected method: ' + name);
        });
    });

    describe('paramsFromUrl', function() {
        it('can use different names in the query string vs output', function() {
            var func = this.extension.paramsFromUrl;
            var query = '?urlParamName=avalue';
            var plotData = func({plotFieldName: 'urlParamName' }, query);

            assert.deepEqual(plotData, {plotFieldName: 'avalue'});

        });
        it('handles value decoding', function() {
            var func = this.extension.paramsFromUrl;
            var query = '?param=soda%20bunny';
            var plotData = func({param: 'param'}, query);

            assert.deepEqual(plotData, {param: 'soda bunny'});
        });
        it('ignores parameters not specified in the mapping', function() {
            var func = this.extension.paramsFromUrl;
            var query = '?first=value&second=ignored';
            var plotData = func({one: 'first'}, query);

            assert.deepEqual(plotData, {one: 'value'});
        });

        it('does not perform type coercion when deserializing', function() {
            // TODO: We may wish to change type handling, but for now capture the expected behavior
            var func = this.extension.paramsFromUrl;
            var query = '?numeric=1&boolean=false&short_boolean=0&no_value';
            var plotData = func(
                {numeric: 'numeric', boolean: 'boolean', short_boolean: 'short_boolean', no_value: 'no_value'},
                query
            );

            // Hack: deepStrictEqual behaving oddly in various scenarios; compare types separately
            assert.deepEqual(
                plotData,
                {numeric: '1', boolean: 'false', short_boolean: '0', no_value: ''},
                'Numeric value deserialized as string'
            );

            assert.ok(typeof plotData['numeric'] === 'string', 'Numeric field represented as string');
            assert.ok(typeof plotData['boolean'] === 'string', 'Boolean field represented as string');
            assert.ok(typeof plotData['short_boolean'] === 'string', 'Empty numeric type represented as string');
            assert.ok(plotData['no_value'] === '', 'Valueless params are empty string');


            assert.ok(plotData['boolean'], 'Non-empty strings are truthy');
            assert.ok(plotData['short_boolean'], 'Numerals are strings, and therefore always truthy');
            assert.ok(!plotData['no_value'], 'But a parameter with no value at all is still falsy');
        });
    });

    describe('plotUpdateUrl', function() {
        beforeEach(function() {
            this.plot = new LocusZoom.Plot('plot', null, {state: { chr: 1, start: 1000, end: 5000 }});
            // jsdom doesn't fully implement navigation, so we will check the act of changing URL instead of the result
            this.historySpy = sinon.stub(history, 'replaceState'); // We can't set init query string, else this would spy on pushState
        });

        it('returns a handle to the newly created event listener', function () {
            var handle = this.extension.plotUpdatesUrl(this.plot, {});
            assert.ok(typeof handle === 'function');
        });

        it('calls a custom serialization callback if provided', function() {
            var spy = sinon.spy(function() { return {}; });
            var stateUrlMapping = { chr: 'chrom', start: 'start', end: 'end' };
            this.extension.plotUpdatesUrl(this.plot, stateUrlMapping, spy);

            this.plot.emit('state_changed');

            assert.ok(spy.called);
        });

        it('changes the URL with new information from plot state with specified mapping', function() {
            // Note: in a real case, the event gets triggered in the natural course of updating the plot.
            //   We fire the event directly to bypass unnecessary code for efficiency.
            var stateUrlMapping = { chr: 'chrom' };
            this.extension.plotUpdatesUrl(this.plot, stateUrlMapping);

            this.plot.state.chr = 7;
            this.plot.emit('state_changed');

            assert.ok(this.historySpy.called, 'replaceState was called');
            assert.ok(this.historySpy.calledWith({}, '', '?chrom=7'), 'History URL params updated with the expected values');
        });

        it('does not update the URL if plot state changes contain the same data as the URL', function() {
            var stateUrlMapping = { chr: 'chrom' };
            // Sinon + jsdom has trouble stubbing globals like window.location, so instead test not calling if "no old data" = "no new data"
            this.plot.state = {};
            this.extension.plotUpdatesUrl(this.plot, stateUrlMapping);

            this.plot.emit('state_changed');
            assert.ok(!this.historySpy.called);
        });

        it.skip('does not update the URL if the parameters that change are not in the mapping', function() {
            // In the absence of a good way to set window.location.search initially, this is difficult to test
            // TODO: Revisit if jsdom navigation support improves in the future
        });

        afterEach(function() {
            d3.select('#plot').remove();
            delete this.plot;

            // Remove all sinon stubs used for this test
            sinon.restore();
        });
    });

    describe('plotWatchesUrl', function() {
        // Because jsdom has trouble setting url before tests, coverage in this section will be low
        beforeEach(function() {
            this.plot = new LocusZoom.Plot('plot', null, {state: { chr: 1, start: 1000, end: 5000 }});

            // jsdom doesn't fully implement navigation, so we will check the act of changing URL instead of the result
        });

        it('calls a custom deserialization callback when appropriate', function() {
            var stateUrlMapping = { chr: 'chrom', start: 'start', end: 'end' };
            var plot = this.plot;
            var spy = sinon.spy(function(plot, data) {
                // jsdom has trouble mutating window.location, so data will be blank. The callback can perform
                //   arbitrary operations on the plot as evidence the watcher has worked.
                plot.state.newField = 1;
            });

            this.extension.plotWatchesUrl(this.plot, stateUrlMapping, spy);

            // Inform jsdom of a navigation event that should trigger the callback
            var anEvent = document.createEvent('Event');
            anEvent.initEvent('popstate', true, true);
            window.dispatchEvent(anEvent);

            assert.ok(spy.called, 'Custom callback was called');
            assert.equal(plot.state.newField, 1, 'Callback successfully mutated the plot');
        });

        it('uses new information from the url to alter the plot state', function() {
            var stateUrlMapping = { chr: 'chrom', start: 'start', end: 'end' };
            var spy = sinon.spy();

            this.extension.plotWatchesUrl(this.plot, stateUrlMapping, spy);

            // Inform jsdom of a navigation event that should trigger the callback
            var anEvent = document.createEvent('Event');
            anEvent.initEvent('popstate', true, true);
            window.dispatchEvent(anEvent);

            assert.ok(spy.called);
        });

        afterEach(function() {
            d3.select('#plot').remove();
            delete this.plot;

            // Remove all sinon stubs used for this test
            sinon.restore();
        });
    });

});
