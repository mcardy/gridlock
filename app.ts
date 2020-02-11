import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import { Server } from 'colyseus';
import Config from './config';
import { Simulation } from './server/rooms/simulation';

import maps from './server/api/maps';

var PORT = Config.port;
var HOST = Config.host;

var app = express();

app.use(bodyParser.json({ limit: '50mb' }))

app.use("/dist", express.static(__dirname + "/client/dist"));
app.use("/img", express.static(__dirname + "/client/img"))
app.use("/maps", maps);

// Serve the display
var paths = ["/", "/map-editor/"]
app.get(paths, (request, response) => {
  response.sendFile(__dirname + "/client/html/index.html")
});


var server = new Server({
  server: http.createServer(app),
  express: app
});
server.define('simulation', Simulation);
server.listen(+PORT);

console.log(`Running on http://${HOST}:${PORT}`)
