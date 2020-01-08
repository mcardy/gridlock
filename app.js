const config = require("./config");
const express = require("express");

var PORT = config.port;
var HOST = config.host;

var app = express();
app.use("/public", express.static(__dirname + "/client/public"));

app.get('/', (request, response) => {
  response.sendFile(__dirname + "/client/public/index.html")
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`)
