/* eslint-disable */
const fs = require('fs');
const path = require('path');
const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

// Load config.json if it exists
const configFilePath = path.resolve(__dirname, '../config.json');
let config= {};
if(fs.existsSync(configFilePath)) {
    config = require(configFilePath);
} else {
    console.log('[Chrome-49] config.json not found. Fallback to "dist/" folder.');
}

module.exports = (env, argv) => {
    return {
        entry: config.url ? path.resolve(config.url, './assets/app.js') : path.resolve('./dist/assets/app.js'),
        plugins: [
            new SimpleProgressWebpackPlugin({
                format: 'expanded'
            })
        ],
        output: {
            path: config.url ? path.resolve(config.url, './assets/') : path.resolve('./dist/assets/'),
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
