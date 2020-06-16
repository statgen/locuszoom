/* eslint-env node */
const path = require('path');
const webpack = require('webpack');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const PACKAGE = require('./package.json');

const srcPath = path.resolve(__dirname, 'esm');
const outputPath = path.resolve(__dirname, 'dist');


module.exports = {
    context: __dirname,
    entry: {
        'locuszoom.app': path.resolve(srcPath, 'index.js'),
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
                use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env'] } }
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
        filename: '[name].min.js',
        library: 'LocusZoom'
    },
    externals: ['d3']
};
