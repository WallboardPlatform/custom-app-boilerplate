/* eslint-disable */
const path = require('path');
const TerserJSPlugin = require('terser-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (env, argv) => {
    return {
        entry: path.resolve('./dist/assets/app.js'),
        output: {
            path: path.resolve('./dist/assets/'),
            filename: 'app-chrome-49.js',
            environment: {
                arrowFunction: false
            }
        },
        externals: {
            './pdf.worker.js': 'commonjs ./pdf.worker.js'
        },
        resolve: {
            extensions: ['.js'],
            plugins: [new TsconfigPathsPlugin({ baseUrl: './' })],
            fallback: {
                fs: false,
                http: false,
                https: false,
                'node-ensure': false,
                url: false,
                zlib: false
            }
        },
        optimization: {
            minimize: true,
            minimizer: [
                new TerserJSPlugin({
                    terserOptions: {
                        output: {
                            comments: false
                        },
                        mangle: {
                            reserved: ['$']
                        }
                    },
                    extractComments: false
                })
            ]
        },
        module: {
            parser: {
                javascript: {
                    // Vite already emitted and named runtime assets. Preserve those URLs instead of rebundling assets.
                    url: false
                }
            },
            rules: [
                {
                    test: /\.js$/,
                    include: [/dist/],
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    [
                                        '@babel/preset-env',
                                        {
                                            debug: true,
                                            targets: {
                                                chrome: '49'
                                            },
                                            modules: false,
                                            useBuiltIns: 'usage',
                                            corejs: { version: "3.33", proposals: true },
                                            loose: true
                                        }
                                    ]
                                ],
                                plugins: ["@babel/plugin-transform-spread", "@babel/plugin-transform-classes"]
                            }
                        }
                    ]
                },
            ]
        }
    };
};
