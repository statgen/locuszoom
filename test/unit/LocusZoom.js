'use strict';

/**
  LocusZoom.js Core Test Suite
  Test composition of the LocusZoom object and its base classes
*/
describe('LocusZoom Core', function() {
    // Tests
    it('creates an object for its name space', function() {
        should.exist(LocusZoom);
    });

    describe('LocusZoom Core', function() {

        beforeEach(function() {
            d3.select('body').append('div').attr('id', 'plot_id');
        });

        afterEach(function() {
            d3.select('body').selectAll('*').remove();
        });

        it('should have a version number', function() {
            LocusZoom.should.have.property('version').which.is.a.String;
        });

        it('should have a method for converting an integer position to a string', function() {
            LocusZoom.positionIntToString.should.be.a.Function;
            assert.equal(LocusZoom.positionIntToString(1, 6),          '0.000001');
            assert.equal(LocusZoom.positionIntToString(1000, 6),       '0.001');
            assert.equal(LocusZoom.positionIntToString(4567, 6),       '0.005');
            assert.equal(LocusZoom.positionIntToString(1000000, 6),    '1.00');
            assert.equal(LocusZoom.positionIntToString(23423456, 6),   '23.42');
            assert.equal(LocusZoom.positionIntToString(1896335235, 6), '1896.34');
            assert.equal(LocusZoom.positionIntToString(8, 3),          '0.008');
            assert.equal(LocusZoom.positionIntToString(4567, 3),       '4.57');
            assert.equal(LocusZoom.positionIntToString(23423456, 3),   '23423.46');
            assert.equal(LocusZoom.positionIntToString(8, 9),          '0.000000008');
            assert.equal(LocusZoom.positionIntToString(4567, 9),       '0.000005');
            assert.equal(LocusZoom.positionIntToString(23423456, 9),   '0.02');
            assert.equal(LocusZoom.positionIntToString(8, 0),          '8');
            assert.equal(LocusZoom.positionIntToString(4567, 0),       '4567');
            assert.equal(LocusZoom.positionIntToString(23423456, 0),   '23423456');
            assert.equal(LocusZoom.positionIntToString(209, null, true),        '209 b');
            assert.equal(LocusZoom.positionIntToString(52667, null, true),      '52.67 Kb');
            assert.equal(LocusZoom.positionIntToString(290344350, null, true),  '290.34 Mb');
            assert.equal(LocusZoom.positionIntToString(1026911427, null, true), '1.03 Gb');
        });

        it('should have a method for converting a string position to an integer', function() {
            LocusZoom.positionStringToInt.should.be.a.Function;
            assert.equal(LocusZoom.positionStringToInt('5Mb'), 5000000);
            assert.equal(LocusZoom.positionStringToInt('1.4Kb'), 1400);
            assert.equal(LocusZoom.positionStringToInt('26.420Mb'), 26420000);
            assert.equal(LocusZoom.positionStringToInt('13'), 13);
            assert.equal(LocusZoom.positionStringToInt('73,054,882'), 73054882);
        });

        it('should have a method for generating pretty ticks', function() {
            LocusZoom.prettyTicks.should.be.a.Function;
            assert.deepEqual(LocusZoom.prettyTicks([0, 10]), [0, 2, 4, 6, 8, 10]);
            assert.deepEqual(LocusZoom.prettyTicks([14, 67]), [10, 20, 30, 40, 50, 60, 70]);
            assert.deepEqual(LocusZoom.prettyTicks([0.01, 0.23]), [0, 0.05, 0.10, 0.15, 0.20, 0.25]);
            assert.deepEqual(LocusZoom.prettyTicks([1, 21], 'low', 10), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
            assert.deepEqual(LocusZoom.prettyTicks([1, 9], 'high'), [0, 2, 4, 6, 8]);
            assert.deepEqual(LocusZoom.prettyTicks([-18, 76]), [-20, 0, 20, 40, 60, 80]);
            assert.deepEqual(LocusZoom.prettyTicks([-187, 762]), [-200, 0, 200, 400, 600, 800]);
        });

        it('should have a method for populating a single element with a LocusZoom plot', function() {
            LocusZoom.populate.should.be.a.Function;
            var plot = LocusZoom.populate('#plot_id', {});
            plot.should.be.an.Object;
            plot.id.should.be.exactly('plot_id');
            var svg_selector = d3.select('div#plot_id svg');
            svg_selector.should.be.an.Object;
            svg_selector.size().should.be.exactly(1);
            plot.svg.should.be.an.Object;
            assert.equal(plot.svg.html(), svg_selector.html());
        });

        it('should have a method for populating arbitrarily many elements with LocusZoom plots', function() {
            d3.select('body').append('div').attr('id', 'populated_plot_1').attr('class', 'lz');
            d3.select('body').append('div').attr('id', 'populated_plot_2').attr('class', 'lz');
            LocusZoom.populateAll.should.be.a.Function;
            var plots = LocusZoom.populateAll('div.lz');
            d3.selectAll('div.lz').each(function(d, i) {
                var div_selector = d3.select(this);
                var svg_selector = div_selector.select('svg');
                svg_selector.should.be.an.Object;
                svg_selector.size().should.be.exactly(1);
                plots[i].svg.should.be.an.Object;
                assert.equal(plots[i].svg.html(), svg_selector.html());
            });
        });

        it('should allow for populating an element with a predefined layout that parses any included state', function() {
            var layout = {
                foo: 'bar',
                state: { chr: 10 }
            };
            var plot = LocusZoom.populate('#plot_id', {}, layout);
            plot.layout.foo.should.be.exactly('bar');
            plot.layout.state.chr.should.be.exactly(10);
            assert.deepEqual(plot.state, plot.layout.state);
        });

        describe('Position Queries', function() {
            it('should have a parsePositionQuery function', function() {
                LocusZoom.parsePositionQuery.should.be.a.Function;
            });
            it('should parse chr:start-end', function() {
                var test = LocusZoom.parsePositionQuery('10:45000-65000');
                test.should.have.property('chr','10');
                test.should.have.property('start',45000);
                test.should.have.property('end',65000);
            });
            it('should parse chr:start+end', function() {
                var test = LocusZoom.parsePositionQuery('10:45000+5000');
                test.should.have.property('chr','10');
                test.should.have.property('start',40000);
                test.should.have.property('end',50000);
            });
            it('should parse kb/mb units', function() {
                var test = LocusZoom.parsePositionQuery('10:5.5Mb+2k');
                test.should.have.property('chr','10');
                test.should.have.property('start',5.5e6 - 2e3);
                test.should.have.property('end',5.5e6 + 2e3);
            });
            it('should prase chr:pos', function() {
                var test = LocusZoom.parsePositionQuery('2:5500');
                test.should.have.property('chr','2');
                test.should.have.property('position',5500);
            });
        });

        it('should have a method for creating a CORS promise', function() {
            LocusZoom.createCORSPromise.should.be.a.Function;
        });

        describe('Parse Fields', function() {
            beforeEach(function() {
                LocusZoom.TransformationFunctions.add('herp', function(x) { return x.toString() + 'herp'; });
                LocusZoom.TransformationFunctions.add('derp', function(x) { return x.toString() + 'derp'; });
            });
            afterEach(function() {
                LocusZoom.TransformationFunctions.set('herp');
                LocusZoom.TransformationFunctions.set('derp');
            });
            it('should have a parseFields function', function() {
                LocusZoom.parseFields.should.be.a.Function;
            });
            it('should require that data be present and be an object', function() {
                assert.throws(function() {
                    LocusZoom.parseFields('foo', 'html');
                });
                assert.throws(function() {
                    LocusZoom.parseFields(123, 'html');
                });
            });
            it('should require that html be present and be a string', function() {
                assert.throws(function() {
                    LocusZoom.parseFields({}, {});
                });
                assert.throws(function() {
                    LocusZoom.parseFields({}, 123);
                });
                assert.throws(function() {
                    LocusZoom.parseFields({}, null);
                });
            });
            it('should return html untouched if passed a null or empty data object', function() {
                assert.equal(LocusZoom.parseFields(null, 'foo'), 'foo');
                assert.equal(LocusZoom.parseFields({}, 'foo'), 'foo');
            });
            it('should parse every matching scalar field from a data object into the html string', function() {
                var data, html, expected_value;
                data = { field1: 123, field2: 'foo' };
                html = '<strong>{{field1}} and {{field2}}</strong>';
                expected_value = '<strong>123 and foo</strong>';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
                html = '<strong>{{field1}} and {{field2}} or {{field1}}{{field1}}</strong>';
                expected_value = '<strong>123 and foo or 123123</strong>';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
            });
            it('should skip parsing of non-scalar fields but not throw an error', function() {
                var data, html, expected_value;
                data = { field1: 123, field2: 'foo', field3: { foo: 'bar' }, field4: [ 4, 5, 6 ], field5: true, field6: NaN };
                html = '<strong>{{field1}}, {{field2}}, {{field3}}, {{field4}}, {{field5}}, {{field6}}</strong>';
                expected_value = '<strong>123, foo, {{field3}}, {{field4}}, true, NaN</strong>';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
            });
            it('should parse all fields that match the general field pattern whether explicitly present in the data object or not', function() {
                var data = {
                    'foo:field_1': 123,
                    'bar:field2': 'foo'
                };
                var html = '<strong>{{foo:field_1}} and {{bar:field2}}, {{bar:field2|herp|derp}}; {{field3}}</strong>';
                var expected_value = '<strong>123 and foo, fooherpderp; </strong>';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
            });
            it('should hide non-existant fields but show broken ones', function() {
                var data = {
                    'foo:field_1': 12345,
                    'bar:field2': 'foo'
                };
                var html = '{{bar:field2||nope|}}{{wat}}{{bar:field2|herp||derp}}';
                var expected_value = '{{bar:field2||nope|}}{{bar:field2|herp||derp}}';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
            });
            it('should handle conditional blocks', function() {
                var data = {
                    'foo:field_1': 1234,
                    'bar:field2': 'foo'
                };
                var html = '{{#if foo:field_1}}<strong>{{foo:field_1}}'
                         + '{{#if bar:field2}} and {{bar:field2}}{{/if}}, '
                         + '{{#if nope}}wat{{/if}}'
                         + '{{bar:field2|herp|derp}}; {{field3}}</strong>{{/if}}';
                var expected_value = '<strong>1234 and foo, fooherpderp; </strong>';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
                var data2 = {
                    'fieldA': '',
                    'fieldB': ''
                };
                var html2 = '{{#if fieldA}}A1<br>{{/if}}'
                          + '{{#if fieldA|derp}}A2<br>{{/if}}'
                          + '{{#if foo:fieldB}}B1<br>{{/if}}'
                          + '{{#if foo:fieldB|derp}}B2<br>{{/if}}';
                var expected_value2 = 'A2<br>B2<br>';
                assert.equal(LocusZoom.parseFields(data2, html2), expected_value2);
            });
            it('should treat 0 as truthy in conditions', function() {
                var data = {
                    'foo': 0
                };
                var html = 'a{{#if foo}}{{foo}}{{/if}}';
                var expected_value = 'a0';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
            });
            it('should treat broken/non-existant conditions as false', function() {
                var data = {
                    'foo:field_1': 12345,
                    'bar:field2': 'foo'
                };
                var html = 'a{{#if foo:field_3}}b{{/if}}c';
                var expected_value = 'ac';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
                var html2 = 'a{{#if foo:field_1|nope}}b{{/if}}c';
                assert.equal(LocusZoom.parseFields(data, html2), expected_value);
            });
            it('should handle nasty input', function() {
                var data = {
                    'foo:field_1': 12345,
                    'bar:field2': 'foo'
                };
                var html = '{{#iff foo:field_1}}<strong>{{{{foo:field_1}}}}'
                         + '{{#if bar:field2}} and {{bar:field2||nope|}}{{/if}}{{/if}}{{/if}}, '
                         + '{{#if {{wat}}}}'
                         + '{{#if nope}}.{{#if unclosed}}. {{field3}}';
                var expected_value = '{{#iff foo:field_1}}<strong>{{12345}}'
                                   + ' and {{bar:field2||nope|}}, '
                                   + '{{#if }}';
                assert.equal(LocusZoom.parseFields(data, html), expected_value);
            });
        });

        describe('Validate State', function() {
            it('should have a validateState function', function() {
                LocusZoom.validateState.should.be.a.Function;
            });
            it('should do nothing if passed a state with no predicted rules / structure', function() {
                var state = { foo: 'bar' };
                state = LocusZoom.validateState(state);
                state.foo.should.be.exactly('bar');
                var stateB = { start: 'foo', end: 'bar' };
                stateB = LocusZoom.validateState(stateB);
                stateB.start.should.be.exactly('foo');
                stateB.end.should.be.exactly('bar');
            });
            it('should enforce no zeros for start and end (if present with chr)', function() {
                var stateA = { chr: 1, start: 0, end: 123 };
                stateA = LocusZoom.validateState(stateA);
                stateA.start.should.be.exactly(1);
                stateA.end.should.be.exactly(123);
                var stateB = { chr: 1, start: 1, end: 0 };
                stateB = LocusZoom.validateState(stateB);
                stateB.start.should.be.exactly(1);
                stateB.end.should.be.exactly(1);
            });
            it('should enforce no negative values for start and end (if present with chr)', function() {
                var stateA = { chr: 1, start: -235, end: 123 };
                stateA = LocusZoom.validateState(stateA);
                stateA.start.should.be.exactly(1);
                stateA.end.should.be.exactly(123);
                var stateB = { chr: 1, start: 1, end: -436 };
                stateB = LocusZoom.validateState(stateB);
                stateB.start.should.be.exactly(1);
                stateB.end.should.be.exactly(1);
            });
            it('should enforce no non-integer values for start and end (if present with chr)', function() {
                var stateA = { chr: 1, start: 1234.4, end: 4567.8 };
                stateA = LocusZoom.validateState(stateA);
                stateA.start.should.be.exactly(1234);
                stateA.end.should.be.exactly(4567);
            });
            it('should enforce no non-numeric values for start and end (if present with chr)', function() {
                var stateA = { chr: 1, start: 'foo', end: 324523 };
                stateA = LocusZoom.validateState(stateA);
                stateA.start.should.be.exactly(324523);
                stateA.end.should.be.exactly(324523);
                var stateB = { chr: 1, start: 68756, end: 'foo' };
                stateB = LocusZoom.validateState(stateB);
                stateB.start.should.be.exactly(68756);
                stateB.end.should.be.exactly(68756);
                var stateC = { chr: 1, start: 'foo', end: 'bar' };
                stateC = LocusZoom.validateState(stateC);
                stateC.start.should.be.exactly(1);
                stateC.end.should.be.exactly(1);
            });
        });

        describe('Subclassing', function () {
            it('performs argument type checking and provides defaults', function() {
                assert.equal(
                    typeof LocusZoom.subclass(function() {}),
                    'function'
                );
                assert.throws(
                    LocusZoom.subclass.bind(null, {}, {}),
                    /Parent must be a callable constructor/
                );
            });
            it('will use a custom constructor function if provided', function() {
                var Parent = function() {this.name = 'parent';};
                var Child = LocusZoom.subclass(Parent, {
                    constructor: function() {this.name = 'child';}
                });
                var instance = new Child();
                assert.equal(instance.name, 'child');
            });
            it('will defer to the parent constructor if a custom one is not provided', function() {
                var Parent = function() {this.name = 'parent';};
                var Child = LocusZoom.subclass(Parent, { isChild: true });
                var instance = new Child();
                assert.equal(instance.name, 'parent');
                assert.equal(instance.isChild, true);
            });
            it('properly handles a child constructor with different args length from parent', function () {
                var Parent = function(one, two) {
                    this.one = one;
                    this.two = two;
                    this.name = 'parent';
                };
                var Child = LocusZoom.subclass(
                    Parent,
                    {
                        constructor: function(one, two, three) {
                            Parent.apply(this, arguments);
                            this.three = three;
                        },
                        isChild: true
                    });
                var instance = new Child('one', 'two', 'three');
                assert.equal(instance.name, 'parent');
                assert.equal(instance.isChild, true);
                assert.equal(instance.one, 'one');
                assert.equal(instance.two, 'two');
                assert.equal(instance.three, 'three');
            });
            it('adds behaviors from constructors and/or overrides as appropriate', function() {
                var Parent = function() {
                    this.classname = 'parent1';
                    this.parentprop = 'parent2';
                };
                Parent.prototype.someMethod = function() {return 'parent3';};
                Parent.prototype.overrideMe = function() {return 'parent4';};

                var Child = LocusZoom.subclass(
                    Parent,
                    {
                        constructor: function() {
                            // Implementer must manage super calls when overriding the constructor
                            Parent.apply(this, arguments);
                            this.classname = 'special';
                        },
                        field: 'child1',
                        overrideMe: function() {return 'child2';}
                    });
                var instance = new Child();

                assert.equal(instance.parentprop, 'parent2');
                assert.equal(instance.field, 'child1');
                assert.equal(instance.classname, 'special');
                assert.equal(instance.someMethod(), 'parent3');
                assert.equal(instance.overrideMe(), 'child2');

            });
            it('will recognize instance fields before prototype ones', function() {
                var Parent = function() {this.name = 'parent';};
                var Child = LocusZoom.subclass(Parent, {name: 'child'});
                var instance = new Child();
                assert.equal(instance.name, 'parent');
            });
        });
    });
});
