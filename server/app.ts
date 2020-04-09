/**
 * Main entrypoint for the server side application
 */

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

// Allow for files uploaded to reach 50mb, needed for map uplaods
app.use(bodyParser.json({ limit: '50mb' }))

// Expose a few entrypoints
app.use("/dist", express.static(Config.rootDirectory + "/client/dist"));
app.use("/img", express.static(Config.rootDirectory + "/client/img"))

// Expose the map REST endpoints
app.use("/maps", maps);

// Serve the display
var paths = ["/", "/map-editor/"]
app.get(paths, (request, response) => {
  response.sendFile(Config.rootDirectory + "/client/html/index.html")
});

// Create the Colyseus websocket server and adding in the express webserver
var server = new Server({
  server: http.createServer(app),
  express: app
});
// Add the simulation room
server.define('simulation', Simulation);
server.listen(+PORT);
console.log(`Running on http://${HOST}:${PORT}`)
