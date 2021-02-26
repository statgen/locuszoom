const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = merge(common, {
    mode: 'production',
    devtool: 'source-map',
    optimization: {
        // Omit creation of License.txt files (because our code doesn't put licenses in filename banners)
        minimizer: [new TerserPlugin({ extractComments: false })],
    },
});
