/* eslint-env node */
const path = require('path');
const webpack = require('webpack');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const PACKAGE = require('./package.json');

const srcPath = path.resolve(__dirname, 'esm');
const outputPath = path.resolve(__dirname, 'dist');

const FILENAMES = {
    // For legacy reasons, the filenames that people expect are different than the "library" name
    LocusZoom: 'locuszoom.app.min.js',
    LzDynamicUrls: 'ext/lz-dynamic-urls.min.js',
    LzDashboardAddons: 'ext/lz-dashboard-addons.min.js',
    LzIntervalsTrack: 'ext/lz-intervals-track.min.js',
};

module.exports = {
    context: __dirname,
    entry: {
        // When a <script> is included in the page, entrypoint name = variable with content
        LocusZoom: path.resolve(srcPath, 'index.js'),
        LzDynamicUrls: path.resolve(srcPath, 'ext', 'lz-dynamic-urls.js'),
        LzDashboardAddons: path.resolve(srcPath, 'ext', 'lz-dashboard-addons.js'),
        LzIntervalsTrack: path.resolve(srcPath, 'ext', 'lz-intervals-track.js'),
    },
    plugins: [
        new CleanWebpackPlugin(),
        new webpack.BannerPlugin(`Locuszoom ${PACKAGE.version}`), // add after uglify step
        new FriendlyErrorsWebpackPlugin(),
        new MiniCssExtractPlugin({
            filename: 'locuszoom.css',
            chunkFilename: 'locuszoom.css',
        }),
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
            {
                test: /\.s[ac]ss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    'sass-loader',
                ],
            }
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
    externals: ['d3', 'locuszoom']
};
