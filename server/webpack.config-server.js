//@ts-check

'use strict';

const path = require('path'); // eslint-disable-line @typescript-eslint/no-var-requires

/**@type {import('webpack').Configuration}*/
const config = {
    context: path.resolve(__dirname),
    entry: './src/server.ts',
    mode: 'production',
    target: 'node',
    devtool: 'source-map',
    output: {
        filename: 'server.bundle.js',
        path: path.resolve(__dirname, '../dist/server'),
    },
    optimization: {
        usedExports: true,
    },
    resolve: {
        modules: [path.resolve(__dirname, '.'), 'node_modules'],
        extensions: ['.js', '.ts'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    configFile: 'tsconfig.json',
                },
            },
            {
                test: /\.node$/,
                use: 'node-loader',
            },
        ],
    },
    node: {
        fs: 'empty',
        __dirname: false,
        __filename: false,
    },
};

module.exports = config;
