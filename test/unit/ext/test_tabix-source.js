import {assert} from 'chai';
import sinon from 'sinon';

import LocusZoom from 'locuszoom';
import {ADAPTERS} from '../../../esm/registry';
import tabix_plugin from '../../../esm/ext/lz-tabix-source';

describe('TabixUrlSource', function () {
    before(function () {
        LocusZoom.use(tabix_plugin);
    });

    function _mock_reader() {
        const mock_reader = { fetch: (chr, start, end, callback) => callback(['1\t2', '3\t4']) };
        const spy = sinon.spy(mock_reader, 'fetch');
        return [mock_reader, spy];
    }

    function _line_parser(line) {
        const [A, B] = line.split('\t');
        return { A, B };
    }

    it('requires a parser function', function () {
        assert.throws(
            () => ADAPTERS.create('TabixUrlSource', { url_data: 'ok.tbi' }),
            /missing required configuration/
        );
    });

    it('Checks that overfetch is provided as a fraction', function () {
        assert.throws(
            () => ADAPTERS.create('TabixUrlSource', { url_data: 'ok.tbi', parser_func: () => 12, overfetch: 99 }),
            /fraction/
        );
    });

    it('accepts a pre-configured external reader instance', function () {
        const [reader, _] = _mock_reader();

        const source = ADAPTERS.create('TabixUrlSource', {
            parser_func: _line_parser,
            reader: reader,
        });

        assert.ok(source);
    });

    it('overfetches data by the specified fraction', function () {
        const [reader, spy] = _mock_reader();
        const source = ADAPTERS.create('TabixUrlSource', {
            parser_func: _line_parser,
            reader: reader,
            overfetch: 0.2,
        });

        return source.getData({ chr: 'X', start: 100, end: 200}).then(() => {
            assert.ok(spy.calledWith('X', 80, 220), 'Tabix reader was queried for a wider region of data than the plot view');
        });
    });

    it('normalizes lines of text and returns parsed results', function () {
        const [reader, _] = _mock_reader();
        const source = ADAPTERS.create('TabixUrlSource', {
            prefix_namespace: false,
            parser_func: _line_parser,
            reader: reader,
        });

        return source.getData({ chr: 'X', start: 100, end: 200}).then((records) => {
            const expected = [
                { A: '1', B: '2' },
                { A: '3', B: '4' },
            ];
            assert.deepEqual(records, expected, 'Data was retrieved and parsed');
        });
    });
});
