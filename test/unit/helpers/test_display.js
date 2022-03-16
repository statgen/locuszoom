import {assert} from 'chai';
import * as d3 from 'd3';


import {TRANSFORMS} from '../../../esm/registry';
import {parseFields, parsePositionQuery, populate, positionIntToString, positionStringToInt, prettyTicks} from '../../../esm/helpers/display';


describe('Display and parsing helpers', function () {
    it('can convert integer position to a string', function() {
        assert.equal(positionIntToString(1, 6),          '0.000001');
        assert.equal(positionIntToString(1000, 6),       '0.001');
        assert.equal(positionIntToString(4567, 6),       '0.005');
        assert.equal(positionIntToString(1000000, 6),    '1.00');
        assert.equal(positionIntToString(23423456, 6),   '23.42');
        assert.equal(positionIntToString(1896335235, 6), '1896.34');
        assert.equal(positionIntToString(8, 3),          '0.008');
        assert.equal(positionIntToString(4567, 3),       '4.57');
        assert.equal(positionIntToString(23423456, 3),   '23423.46');
        assert.equal(positionIntToString(8, 9),          '0.000000008');
        assert.equal(positionIntToString(4567, 9),       '0.000005');
        assert.equal(positionIntToString(23423456, 9),   '0.02');
        assert.equal(positionIntToString(8, 0),          '8');
        assert.equal(positionIntToString(4567, 0),       '4567');
        assert.equal(positionIntToString(23423456, 0),   '23423456');
        assert.equal(positionIntToString(209, null, true),        '209 b');
        assert.equal(positionIntToString(52667, null, true),      '52.67 Kb');
        assert.equal(positionIntToString(290344350, null, true),  '290.34 Mb');
        assert.equal(positionIntToString(1026911427, null, true), '1.03 Gb');
    });

    it('can convert various string positions to an integer', function() {
        assert.equal(positionStringToInt('5Mb'), 5000000);
        assert.equal(positionStringToInt('1.4Kb'), 1400);
        assert.equal(positionStringToInt('26.420Mb'), 26420000);
        assert.equal(positionStringToInt('13'), 13);
        assert.equal(positionStringToInt('73,054,882'), 73054882);
    });

    it('should generate display friendly ticks', function() {
        assert.deepEqual(prettyTicks([0, 10]), [0, 2, 4, 6, 8, 10]);
        assert.deepEqual(prettyTicks([14, 67]), [10, 20, 30, 40, 50, 60, 70]);
        assert.deepEqual(prettyTicks([0.01, 0.23]), [0, 0.05, 0.10, 0.15, 0.20, 0.25]);
        assert.deepEqual(prettyTicks([1, 21], 'low', 10), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
        assert.deepEqual(prettyTicks([1, 9], 'high'), [0, 2, 4, 6, 8]);
        assert.deepEqual(prettyTicks([-18, 76]), [-20, 0, 20, 40, 60, 80]);
        assert.deepEqual(prettyTicks([-187, 762]), [-200, 0, 200, 400, 600, 800]);
    });

    describe('Position Queries', function() {
        it('should parse chr:start-end', function() {
            const test = parsePositionQuery('10:45000-65000');
            assert.deepEqual(test, {chr: '10', start: 45000, end: 65000});
            // test.should.have.property('chr','10');
            // test.should.have.property('start',45000);
            // test.should.have.property('end',65000);
        });
        it('should parse chr:start+end', function() {
            const test = parsePositionQuery('10:45000+5000');
            assert.deepEqual(test, {chr: '10', start: 40000, end: 50000});

            // test.should.have.property('chr','10');
            // test.should.have.property('start',40000);
            // test.should.have.property('end',50000);
        });
        it('should parse kb/mb units', function() {
            const test = parsePositionQuery('10:5.5Mb+2k');
            assert.deepEqual(test, {chr: '10', start: 5.5e6 - 2e3, end: 5.5e6 + 2e3});
            // test.should.have.property('chr','10');
            // test.should.have.property('start',5.5e6 - 2e3);
            // test.should.have.property('end',5.5e6 + 2e3);
        });
        it('should parse chr:pos', function() {
            const test = parsePositionQuery('2:5500');
            assert.deepEqual(test, {chr: '2', position: 5500});
            // test.should.have.property('chr','2');
            // test.should.have.property('position',5500);
        });
    });

    describe('Parse Fields', function() {
        before(function() {
            TRANSFORMS.add('herp', function(x) {
                return `${x.toString()  }herp`;
            });
            TRANSFORMS.add('derp', function(x) {
                return `${x.toString()  }derp`;
            });
        });
        after(function() {
            TRANSFORMS.remove('herp');
            TRANSFORMS.remove('derp');
        });
        it('should require that data be present and be an object', function() {
            assert.throws(function() {
                parseFields('html', 'foo');
            });
            assert.throws(function() {
                parseFields('html', 123);
            });
        });
        it('should require that html be present and be a string', function() {
            assert.throws(function() {
                parseFields({}, {});
            });
            assert.throws(function() {
                parseFields(123, {});
            });
            assert.throws(function() {
                parseFields(null, {});
            });
        });
        it('should return html untouched if passed a null or empty data object', function() {
            assert.equal(parseFields('foo', null), 'foo');
            assert.equal(parseFields('foo', {}), 'foo');
        });
        it('should parse every matching scalar field from a data object into the html string', function() {
            let data, html, expected_value;
            data = { field1: 123, field2: 'foo' };
            html = '<strong>{{field1}} and {{field2}}</strong>';
            expected_value = '<strong>123 and foo</strong>';
            assert.equal(parseFields(html, data), expected_value);
            html = '<strong>{{field1}} and {{field2}} or {{field1}}{{field1}}</strong>';
            expected_value = '<strong>123 and foo or 123123</strong>';
            assert.equal(parseFields(html, data), expected_value);
        });
        it('should consider fields in both data and annotations where appropriate', function() {
            const data = { field1: 123, field2: 'fire' };
            const annotations = { field3: 'squid' };

            const template = '<strong>{{field2}} {{field3}} {{no_match}}</strong>';
            const expected_value = '<strong>fire squid </strong>';
            assert.equal(parseFields(template, data, annotations), expected_value, 'Uses fields from annotations and hides nonexistent fields');
        });
        it('should skip parsing of non-scalar fields but not throw an error', function() {
            let data, html, expected_value;
            data = { field1: 123, field2: 'foo', field3: { foo: 'bar' }, field4: [ 4, 5, 6 ], field5: true, field6: NaN };
            html = '<strong>{{field1}}, {{field2}}, {{field3}}, {{field4}}, {{field5}}, {{field6}}</strong>';
            expected_value = '<strong>123, foo, {{field3}}, {{field4}}, true, NaN</strong>';
            assert.equal(parseFields(html, data), expected_value);
        });
        it('should parse all fields that match the general field pattern whether explicitly present in the data object or not', function() {
            const data = {
                'foo:field_1': 123,
                'bar:field2': 'foo',
            };
            const html = '<strong>{{foo:field_1}} and {{bar:field2}}, {{bar:field2|herp|derp}}; {{field3}}</strong>';
            const expected_value = '<strong>123 and foo, fooherpderp; </strong>';
            assert.equal(parseFields(html, data), expected_value);
        });
        it('should hide non-existent fields but show broken ones', function() {
            const data = {
                'foo:field_1': 12345,
                'bar:field2': 'foo',
            };
            const html = '{{bar:field2||nope|}}{{wat}}{{bar:field2|herp||derp}}';
            const expected_value = '{{bar:field2||nope|}}{{bar:field2|herp||derp}}';
            assert.equal(parseFields(html, data), expected_value);
        });
        it('should handle conditional blocks', function() {
            const data = {
                'foo:field_1': 1234,
                'bar:field2': 'foo',
            };
            const html = '{{#if foo:field_1}}<strong>{{foo:field_1}}'
                + '{{#if bar:field2}} and {{bar:field2}}{{/if}}, '
                + '{{#if nope}}wat{{/if}}'
                + '{{bar:field2|herp|derp}}; {{field3}}</strong>{{/if}}';
            const expected_value = '<strong>1234 and foo, fooherpderp; </strong>';
            assert.equal(parseFields(html, data), expected_value);
            const data2 = {
                'fieldA': '',
                'foo:fieldB': '',
            };
            const html2 = `{{#if fieldA}}A1<br>{{/if}}\
{{#if fieldA|derp}}A2<br>{{/if}}\
{{#if foo:fieldB}}B1<br>{{/if}}\
{{#if foo:fieldB|derp}}B2<br>{{/if}}`;
            const expected_value2 = 'A2<br>B2<br>';
            assert.equal(parseFields(html2, data2), expected_value2);
        });
        it('should handle else in conditions', function () {
            const data = {
                'foo:field_1': 1234,
                'bar:field2': 'foo',
            };
            const html = '{{#if foo:field_2}}{{foo:field_2}}{{#else}}{{bar:field2}}{{/if}}';
            const expected_value = 'foo';
            assert.equal(parseFields(html, data), expected_value, 'Else block is rendered');

            const html2 = `{{#if foo:field_x}}
{{foo:field_x}}{{#else}}{{#if foo:field_1}}bar{{/if}} extra_tokens {{bar:field2}}{{/if}}`;
            const expected_value2 = 'bar extra_tokens foo';
            assert.equal(parseFields(html2, data), expected_value2, 'Else blocks follow nesting rules and can contain arbitrary additional tokens');

            const html3 = '{{#if foo:field_x}}{{#else}}bare else{{/if}}';
            const expected_value3 = 'bare else';
            assert.equal(parseFields(html3, data), expected_value3, 'Else blocks work with empty if');
        });
        it('should allow filters on values, eg 0 is_numeric', function() {
            const data = {
                'foo': 0,
            };

            const html = 'a{{#if foo}}{{foo}}{{/if}}';
            const expected_value = 'a';
            assert.equal(parseFields(html, data), expected_value, '0 is falsy under normal circumstances');

            const html2 = 'a{{#if foo|is_numeric}}{{foo}}{{/if}}';
            const expected_value2 = 'a0';
            assert.equal(parseFields(html2, data), expected_value2, 'A filter can modify the value to be truthy');
        });
        it('should treat broken/non-existent conditions as false', function() {
            const data = {
                'foo:field_1': 12345,
                'bar:field2': 'foo',
            };
            const html = 'a{{#if foo:field_3}}b{{/if}}c';
            const expected_value = 'ac';
            assert.equal(parseFields(html, data), expected_value);
            const html2 = 'a{{#if foo:field_1|nope}}b{{/if}}c';
            assert.equal(parseFields(html2, data), expected_value);
        });
        it('should handle nasty input', function() {
            const data = {
                'foo:field_1': 12345,
                'bar:field2': 'foo',
            };
            const html = '{{#iff foo:field_1}}<strong>{{{{foo:field_1}}}}'
                + '{{#if bar:field2}} and {{bar:field2||nope|}}{{/if}}{{/if}}{{/if}}, '
                + '{{#if {{wat}}}}'
                + '{{#if nope}}.{{#if unclosed}}. {{field3}}';
            const expected_value = '{{#iff foo:field_1}}<strong>{{12345}}'
                + ' and {{bar:field2||nope|}}, '
                + '{{#if }}';
            assert.equal(parseFields(html, data), expected_value);
        });
    });

    describe('.populate() helper method for plot creation', function() {
        beforeEach(function() {
            d3.select('body').append('div').attr('id', 'plot_id');
        });

        afterEach(function() {
            d3.select('body').selectAll('*').remove();
        });

        it('should have a method for populating a single element with a LocusZoom plot', function() {
            const plot = populate('#plot_id', {}, {});
            assert.equal(plot.id, 'plot_id');
            const svg_selector = d3.select('div#plot_id svg');
            assert.equal(svg_selector.size(), 1);
            assert.equal(plot.svg.html(), svg_selector.html());
        });

        it('should allow for populating an element with a predefined layout that parses any included state', function() {
            const layout = {
                foo: 'bar',
                state: { chr: 10 },
            };
            const plot = populate('#plot_id', {}, layout);
            assert.equal(plot.layout.foo, 'bar');
            assert.equal(plot.layout.state.chr, 10);
            assert.deepEqual(plot.state, plot.layout.state);
        });
    });
});
