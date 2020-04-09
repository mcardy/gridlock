/**
 * Webpack is used to create a single minified javascript file containing all required javascript code
 * 
 * Typescript is also compiled to javascript as defined by this configuration. 
 * This is automatically picked up when the webpack utility is targeted at this directory.
 */

const path = require("path");
const webpack = require("webpack");

var config = {};

config.devtool = "source-map";
config.mode = "development";
config.entry = {
    main: path.join(__dirname, "src", "main.tsx")
}
config.output = {
    publicPath: "/dist/",
    path: path.join(__dirname, "dist"),
    filename: "bundle.js"
};
config.module = {
    rules: [
        {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        },
        {
            test: /\.(s*)css$/,
            use: ['style-loader', 'css-loader', 'sass-loader']
        },
        {
            test: /\.svg(\?.+)?$/,
            use: 'file-loader'
        }
    ],
}
config.resolve = {
    extensions: [".ts", ".js", ".tsx"]
}

module.exports = config;