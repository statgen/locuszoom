import {assert} from 'chai';
import d3 from 'd3';

import DataSources from '../../../esm/data';
import {populate} from '../../../esm/helpers/display';
import {plugins} from '../../../esm/registry';
import * as dashboard_addons from '../../../esm/ext/lz-dashboard-addons';

// Register the plugin
plugins.use(dashboard_addons);

describe('Toolbar addons', function () {
    describe('Covariates Model Component', function () {
        beforeEach(function () {
            const datasources = new DataSources();
            const layout = {
                dashboard: {
                    components: [
                        { type: 'covariates_model' }
                    ]
                }
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
        });

        afterEach(function () {
            d3.select('#plot').remove();
            this.plot = null;
        });

        it('Should have initialized a state object for model covariates', function () {
            assert.isObject(this.plot.state.model);
            assert.isArray(this.plot.state.model.covariates);
            assert.equal(this.plot.state.model.covariates.length, 0);
        });

        it('Should have initialized a plot object for interfacing with model covariates', function () {
            assert.isObject(this.plot.CovariatesModel);
        });

        it('Should have a method for adding arbitrary elements to covariates model', function () {
            assert.equal(this.plot.state.model.covariates.length, 0);

            this.plot.CovariatesModel.add('foo');
            assert.equal(this.plot.state.model.covariates.length, 1);
            assert.equal(this.plot.state.model.covariates[0], 'foo');
        });

        it('Should not allow for adding the same element to covariates model more than once', function () {
            assert.equal(this.plot.state.model.covariates.length, 0);

            this.plot.CovariatesModel.add('foo');
            assert.equal(this.plot.state.model.covariates.length, 1);
            assert.equal(this.plot.state.model.covariates[0], 'foo');

            this.plot.CovariatesModel.add('bar');
            assert.equal(this.plot.state.model.covariates.length, 2);
            assert.equal(this.plot.state.model.covariates[1], 'bar');

            this.plot.CovariatesModel.add('foo');
            assert.equal(this.plot.state.model.covariates.length, 2);

            const obj1 = {
                foo: 'bar', baz: function () {
                    return 'baz';
                }
            };
            const obj2 = {
                foo: 'asdf', baz: function () {
                    return 'baz';
                }
            };
            this.plot.CovariatesModel.add(obj1);
            assert.equal(this.plot.state.model.covariates.length, 3);

            this.plot.CovariatesModel.add(obj2);
            assert.equal(this.plot.state.model.covariates.length, 4);

            this.plot.CovariatesModel.add(obj1);
            assert.equal(this.plot.state.model.covariates.length, 4);
        });

        it('Should have a method for removing covariates in model via their index in the array', function () {
            this.plot.CovariatesModel
                .add('foo').CovariatesModel
                .add('bar').CovariatesModel
                .add('baz');
            assert.equal(this.plot.state.model.covariates.length, 3);

            this.plot.CovariatesModel.removeByIdx(1);
            assert.equal(this.plot.state.model.covariates.length, 2);
            assert.equal(this.plot.state.model.covariates[0], 'foo');
            assert.equal(this.plot.state.model.covariates[1], 'baz');
            assert.throws(() => {
                this.plot.CovariatesModel.removeByIdx(9);
            });
            assert.throws(() => {
                this.plot.CovariatesModel.removeByIdx(-1);
            });
            assert.throws(() => {
                this.plot.CovariatesModel.removeByIdx('foo');
            });
        });

        it('Should have a method for removing all covariates in model', function () {
            this.plot.CovariatesModel.add('foo').CovariatesModel.add('bar').CovariatesModel.add('baz');
            assert.equal(this.plot.state.model.covariates.length, 3);

            this.plot.CovariatesModel.removeAll();
            assert.equal(this.plot.state.model.covariates.length, 0);
        });
    });
});
