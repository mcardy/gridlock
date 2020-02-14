import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import { Server } from 'colyseus';
import Config from './config';
import { Simulation } from './rooms/simulation';

import maps from './api/maps';

var PORT = Config.port;
var HOST = Config.host;

var app = express();

app.use(bodyParser.json({ limit: '50mb' }))

app.use("/dist", express.static(Config.rootDirectory + "/client/dist"));
app.use("/img", express.static(Config.rootDirectory + "/client/img"))
app.use("/maps", maps);

// Serve the display
var paths = ["/", "/map-editor/"]
app.get(paths, (request, response) => {
  response.sendFile(Config.rootDirectory + "/client/html/index.html")
});


var server = new Server({
  server: http.createServer(app),
  express: app
});
server.define('simulation', Simulation);
server.listen(+PORT);

console.log(`Running on http://${HOST}:${PORT}`)
