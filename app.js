const config = require("./config");
const express = require("express");

var PORT = config.port;
var HOST = config.host;

var app = express();
app.get('/', (request, response) => {
  response.send("Hello World");
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`)
