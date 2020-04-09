/**
 * Provides a set of RESTful endpoints to manage maps from files
 */

import * as fs from 'fs';
import express from 'express';
import Config from '../config';

var router = express.Router();

/**
 * Get a list of maps
 */
router.get('/', (req, resp) => {
    fs.readdir(Config.mapsDirectory, function (err, items) {
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

/**
 * Get a specific map's contents
 */
router.get('/:mapName', (req, resp) => {
    fs.readFile(Config.mapsDirectory + "/" + req.params.mapName + ".json", (err, data) => {
        if (err) {
            resp.status(500).send(err);
        } else {
            resp.status(200).contentType('application/json').send(data);
        }
    })
});

/**
 * Deletes a specific map
 */
router.delete('/:mapName', (req, resp) => {
    fs.unlink(Config.mapsDirectory + "/" + req.params.mapName + ".json", (err) => {
        if (err) {
            resp.status(500).send(err);
        } else {
            resp.sendStatus(200);
        }
    });
});

/**
 * Creates a new map by a given name
 */
router.post('/:mapName', (req, resp) => {
    fs.writeFile(Config.mapsDirectory + "/" + req.params.mapName + ".json", JSON.stringify(req.body), { flag: "w+" }, (err) => {
        if (err) {
            resp.status(500).send(err);
        } else {
            resp.sendStatus(200);
        }
    });
});

/**
 * Updates a map with a given name
 */
router.put('/:mapName', (req, resp) => {
    fs.readFile(Config.mapsDirectory + "/" + req.params.mapName + ".json", (err, data) => {
        if (err) {
            resp.status(500).send(err);
        } else {
            fs.writeFile(Config.mapsDirectory + "/" + req.params.mapName + ".json", JSON.stringify({ ...JSON.parse(data.toString()), ...req.body }), { flag: "w+" }, (err) => {
                if (err) {
                    resp.status(500).send(err);
                } else {
                    resp.sendStatus(200);
                }
            });
        }
    })
});

// Return the router containing the endpoints
export default router;