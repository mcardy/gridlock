const path = require("path");
const webpack = require("webpack");

var config = {};

config.mode = "development";
config.entry = path.join(__dirname, "src", "main.js");
config.output = {
    path: path.join(__dirname, "public"),
    filename: "bundle.js"
};

module.exports = config;