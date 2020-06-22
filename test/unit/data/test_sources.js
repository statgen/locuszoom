import { assert } from 'chai';

import {RegistryBase} from '../../../esm/registry/base';
import {AssociationLZ} from '../../../esm/data/adapters';
import DataSources from '../../../esm/data/sources';


describe('DataSources object', function() {
    it('has access to an internal registry of known adapters', function () {
        const data_sources = new DataSources();
        assert.instanceOf(data_sources._registry, RegistryBase);
    });

    it('has a way to create instances from configuration', function () {
        const data_sources = new DataSources();
        const url = 'https://pheweb.org';
        data_sources
            .add('assoc', ['AssociationLZ', { url, params: {}}]);
        const source = data_sources.get('assoc');
        assert.instanceOf(source, AssociationLZ);
        assert.equal(url, source.url);
    });

    it('warns when trying to create a source of unknown type', function () {
        const data_sources = new DataSources();
        assert.throws(() => {
            data_sources.add('gibberish', ['DoesNotExist', {}]);
        });
    });

    it('can add source instances directly', function () {
        const instance = new AssociationLZ({ url: 'https://pheweb.org', params: {}});
        const data_sources = new DataSources();
        data_sources
            .add('assoc', instance);
        const result = data_sources.get('assoc');
        assert.equal(instance, result);
    });

    it('should allow chainable adding with a fluent API', function () {
        const instance1 = new AssociationLZ({ url: 1, params: {}});
        const instance2 = new AssociationLZ({ url: 2, params: {}});

        const data_sources = new DataSources();
        data_sources
            .add('assoc', instance1)
            .add('assoc2', instance2);

        assert.equal(data_sources.get('assoc').url, 1);
        assert.equal(data_sources.get('assoc2').url, 2);
    });

    it('should ensure that all sources are aware of their namespace', function () {
        const data_sources = new DataSources();
        const instance = new AssociationLZ({ url: 1, params: {}})
        data_sources
            .add('assoc', ['AssociationLZ', { url: 1, params: {}}])
            .add('assoc2', instance);

        assert.equal(data_sources.get('assoc').source_id, 'assoc');
        assert.equal(instance.source_id, 'assoc2');
    });
});
