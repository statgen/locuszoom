import { assert } from 'chai';

import {AssociationLZ, StaticSource} from '../../../esm/data/adapters';
import { ADAPTERS } from '../../../esm/registry';

describe('Data adapters registry', function () {
    it('Knows about dynamically registered sources', function () {
        assert.equal(ADAPTERS.get('AssociationLZ'), AssociationLZ);
    });

    it('has legacy aliases for backwards compatibility', function () {
        assert.equal(ADAPTERS.get('StaticJSON'), StaticSource);
    });
});
