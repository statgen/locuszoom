import { assert } from 'chai';

import {AssociationLZ, StaticSource} from '../../../esm/data/adapters';
import { adapters } from '../../../esm/registry';

describe('Data adapters registry', function () {
    it('Knows about dynamically registered sources', function () {
        assert.equal(adapters.get('AssociationLZ'), AssociationLZ);
    });

    it('has legacy aliases for backwards compatibility', function () {
        assert.equal(adapters.get('StaticJSON'), StaticSource);
    });
});
