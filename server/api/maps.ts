import * as fs from 'fs';
import express from 'express';
import Config from '../config';

var router = express.Router();

// Restful endpoints for maps
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

router.get('/:mapName', (req, resp) => {
    fs.readFile(Config.mapsDirectory + "/" + req.params.mapName + ".json", (err, data) => {
        if (err) {
            resp.status(500).send(err);
        } else {
            resp.status(200).contentType('application/json').send(data);
        }
    })
});

router.delete('/:mapName', (req, resp) => {
    fs.unlink(Config.mapsDirectory + "/" + req.params.mapName + ".json", (err) => {
        if (err) {
            resp.status(500).send(err);
        } else {
            resp.sendStatus(200);
        }
    });
});

router.post('/:mapName', (req, resp) => {
    // TODO validate schema of saved map
    fs.writeFile(Config.mapsDirectory + "/" + req.params.mapName + ".json", JSON.stringify(req.body), { flag: "w+" }, (err) => {
        if (err) {
            resp.status(500).send(err);
        } else {
            resp.sendStatus(200);
        }
    });
});

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

export default router;