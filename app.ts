import express from 'express';
import http from 'http';
import { Server } from 'colyseus';
import { config } from './config';

import { Simulation } from './server/rooms/simulation';

var PORT = config.port;
var HOST = config.host;

var app = express();
app.use("/public", express.static(__dirname + "/client/public"));
app.use("/css/jsoneditor", express.static(__dirname + "/node_modules/jsoneditor/dist"));

app.get('/', (request, response) => {
  response.sendFile(__dirname + "/client/html/index.html")
});

app.get('/map/', (request, response) => {
  response.sendFile(__dirname + "/client/html/index.html")
});

var server = new Server({
  server: http.createServer(app),
  express: app
});
server.define('simulation', Simulation);
server.listen(+PORT);

console.log(`Running on http://${HOST}:${PORT}`)
