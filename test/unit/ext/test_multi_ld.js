import {assert} from 'chai';

import LocusZoom from 'locuszoom';
import {SCALABLE} from '../../../esm/registry';

import ld_plugin from '../../../esm/ext/lz-multi-ld';

LocusZoom.use(ld_plugin);

describe('Multi LD plugin', function () {
    describe('ld_multi_bin scale function', function () {
        it('assigns LD by category', function () {
            const options = {
                categories: ['a', 'b', 'c'],
                breaks: [1, 2, 3],
                values: [
                    ['a', 'aa', 'aaa'],
                    ['b', 'bb', 'bbb'],
                    ['c', 'cc', 'ccc'],
                ],
            };

            const func = SCALABLE.get('ld_multi_bin');
            assert.equal(func(options, ['b', 2.2]), 'bb', 'Finds a value based on matching category');
            assert.equal(func(options, ['squid', 2.2]), null, 'Returns null if category is not a match');
            assert.equal(func(options, [null, 2.2]), null, 'Returns null if category is not provided');
        });
    });
});
