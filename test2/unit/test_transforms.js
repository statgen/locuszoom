import {assert} from 'chai';
import {htmlescape, neglog10, scinotation} from '../../esm/helpers/transforms';

describe('Transformation Functions', function() {

    describe('neglog10', function() {
        const tests = [
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
                assert.equal(neglog10(test.arg), test.expected);
            });
        });
    });

    describe('scinotation', function() {
        const tests = [
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
                assert.equal(scinotation(test.arg), test.expected);
            });
        });
    });

    describe('htmlescape', function() {
        it('should escape characters with special meaning in xml, and ignore others', function() {
            assert.equal(
                htmlescape("<script type=\"application/javascript\">alert('yo & ' + `I`)</script>"),
                '&lt;script type=&quot;application/javascript&quot;&gt;alert(&#039;yo &amp; &#039; + &#x60;I&#x60;)&lt;/script&gt;'
            );
        });
    });
});
