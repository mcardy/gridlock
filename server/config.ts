import path from 'path';

var root = path.resolve("./");

/**
 * Some configuration options read from environment variables, directories
 */
var config = {
    host: process.env.HOST || "0.0.0.0",
    port: process.env.PORT || 80,
    rootDirectory: root,
    mapsDirectory: path.resolve(root, "maps")
}

export default config;