var config = {
    host: process.env.HOST || "0.0.0.0",
    port: process.env.PORT || 80,
    rootDirectory: __dirname,
    mapsDirectory: __dirname + "/maps"
}

export default config;