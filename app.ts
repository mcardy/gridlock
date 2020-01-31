import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import { Server } from 'colyseus';
import { config } from './config';
import * as fs from 'fs';

import { Simulation } from './server/rooms/simulation';

var PORT = config.port;
var HOST = config.host;

var app = express();

app.use(bodyParser.json({ limit: '50mb' }))

app.use("/dist", express.static(__dirname + "/client/dist"));

// Serve the display
var paths = ["/", "/map-editor/"]
app.get(paths, (request, response) => {
  response.sendFile(__dirname + "/client/html/index.html")
});

// Restful endpoints for maps
app.get('/maps', (req, resp) => {
  fs.readdir(__dirname + "/maps", function (err, items) {
    if (err) {
      resp.status(500).send(err);
    } else {
      var data = [];
      for (var item of items) {
        if (item.endsWith(".json")) {
          data.push(item.substr(0, item.length - 5));
        }
      }
      resp.status(200).contentType('application/json').send(data);
    }
  });
});

app.get('/maps/:mapName', (req, resp) => {
  fs.readFile(__dirname + "/maps/" + req.params.mapName + ".json", (err, data) => {
    if (err) {
      resp.status(500).send(err);
    } else {
      resp.status(200).contentType('application/json').send(data);
    }
  })
});

app.delete('/maps/:mapName', (req, resp) => {
  fs.unlink(__dirname + "/maps/" + req.params.mapName + ".json", (err) => {
    if (err) {
      resp.status(500).send(err);
    } else {
      resp.sendStatus(200);
    }
  });
});

app.post('/maps/:mapName', (req, resp) => {
  // TODO validate schema of saved map
  fs.writeFile(__dirname + "/maps/" + req.params.mapName + ".json", JSON.stringify(req.body), { flag: "w+" }, (err) => {
    if (err) {
      resp.status(500).send(err);
    } else {
      resp.sendStatus(200);
    }
  });
});

app.put('/maps/:mapName', (req, resp) => {
  fs.readFile(__dirname + "/maps/" + req.params.mapName + ".json", (err, data) => {
    if (err) {
      resp.status(500).send(err);
    } else {
      fs.writeFile(__dirname + "/maps/" + req.params.mapName + ".json", JSON.stringify({ ...JSON.parse(data.toString()), ...req.body }), { flag: "w+" }, (err) => {
        if (err) {
          resp.status(500).send(err);
        } else {
          resp.sendStatus(200);
        }
      });
    }
  })
});

var server = new Server({
  server: http.createServer(app),
  express: app
});
server.define('simulation', Simulation);
server.listen(+PORT);

console.log(`Running on http://${HOST}:${PORT}`)
