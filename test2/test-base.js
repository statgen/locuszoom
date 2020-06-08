import { assert } from 'chai';

import LocusZoom from '../esm';

describe('A test runs', function () {
    it('runs a test', function() {
        assert.equal(LocusZoom(), 12);
    });
});
