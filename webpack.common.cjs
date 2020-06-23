/* eslint-env node */
const path = require('path');
const webpack = require('webpack');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const PACKAGE = require('./package.json');

const srcPath = path.resolve(__dirname, 'esm');
const outputPath = path.resolve(__dirname, 'dist');

const FILENAMES = {
    // For legacy reasons, the filenames that people expect are different than the "library" name
    LocusZoom: 'locuszoom.app.min.js',
    LzDynamicUrls: 'ext/lz-dynamic-urls.min.js',
    LzWidgetAddons: 'ext/lz-widget-addons.min.js',
    LzIntervalsTrack: 'ext/lz-intervals-track.min.js',
    LzCredibleSets: 'ext/lz-credible-sets.min.js',
    LzTabix: 'ext/lz-tabix-source.min.js',
    LzAggregationTests: 'ext/lz-aggregation-tests.min.js',
};

module.exports = {
    context: __dirname,
    entry: {
        // When a <script> is included in the page, entrypoint name = variable with content
        LocusZoom: path.resolve(srcPath, 'index.js'),
        LzDynamicUrls: path.resolve(srcPath, 'ext', 'lz-dynamic-urls.js'),
        LzWidgetAddons: path.resolve(srcPath, 'ext', 'lz-widget-addons.js'),
        LzIntervalsTrack: path.resolve(srcPath, 'ext', 'lz-intervals-track.js'),
        LzCredibleSets: path.resolve(srcPath, 'ext', 'lz-credible-sets.js'),
        LzTabix: path.resolve(srcPath, 'ext', 'lz-tabix-source.js'),
        LzAggregationTests: path.resolve(srcPath, 'ext', 'lz-aggregation-tests.js'),
    },
    plugins: [
        new CleanWebpackPlugin({
            // To simplify tooling, we will assume that (S)CSS changes rarely, and build it outside of webpack
            cleanOnceBeforeBuildPatterns: ['**/*', '!locuszoom.css*'],
        }),
        new webpack.BannerPlugin(`Locuszoom ${PACKAGE.version}`), // add after uglify step
        new FriendlyErrorsWebpackPlugin(),
    ],
    resolve: {
        modules: [
            'node_modules'
        ],
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: file => (/node_modules/.test(file)),
                use: [
                    { loader: 'babel-loader', options: { presets: ['@babel/preset-env'] } },
                    'eslint-loader'
                ]
            },
            {
                test: /\.js$/,
                use: ['source-map-loader'],
                enforce: 'pre',
            },
        ]
    },
    output: {
        path: outputPath,
        filename: (data) => {
            // For backwards compatibility, the filename is different than the chunk name.
            const match = FILENAMES[data.chunk.name];
            if(!match) {
                const msg = `Must provide a filename for this chunk: ${data.chunk.name}`;
                console.error(msg);
                throw new Error(msg);
            }
            return match;
        },
        library: '[name]',
        libraryExport: 'default',
    },
    externals: {
        d3: 'd3' ,
        locuszoom: 'LocusZoom',
        'gwas-credible-sets': 'gwasCredibleSets',
        'tabix-reader': 'tabix',
        'raremetal.js': 'raremetal',
    }
};
