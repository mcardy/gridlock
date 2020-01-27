const path = require("path");
const webpack = require("webpack");

var config = {};

config.mode = "development";
config.entry = path.join(__dirname, "src", "main.ts");
config.output = {
    path: path.join(__dirname, "public"),
    filename: "bundle.js"
};
config.module = {
    rules: [
        {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        },
    ],
}
config.resolve = {
    extensions: [".ts", ".js"]
}

module.exports = config;