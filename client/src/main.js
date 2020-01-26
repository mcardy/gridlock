import { app } from './app'
import { render } from './map'

import { map_schema } from '../../common/map_schema'

import * as Colyseus from "colyseus.js";
import JSONEditor from 'jsoneditor';

const defaultMap = {
    seed: 11234071749817,
    width: 600,
    height: 400,
    vertices: [
        // Sources
        { id: 1, location: { x: 100, y: 0 }, source: true },
        { id: 3, location: { x: 250, y: 100 }, source: true },
        { id: 5, location: { x: 150, y: 250 }, source: true },
        { id: 7, location: { x: 0, y: 150 }, source: true },
        // Destinations
        { id: 2, location: { x: 150, y: 0 }, dest: true },
        { id: 4, location: { x: 250, y: 150 }, dest: true },
        { id: 6, location: { x: 100, y: 250 }, dest: true },
        { id: 8, location: { x: 0, y: 100 }, dest: true },
        // Intersection items
        { id: 9, location: { x: 100, y: 75 } },
        { id: 10, location: { x: 150, y: 75 } },
        { id: 11, location: { x: 175, y: 100 } },
        { id: 12, location: { x: 175, y: 150 } },
        { id: 13, location: { x: 150, y: 175 } },
        { id: 14, location: { x: 100, y: 175 } },
        { id: 15, location: { x: 75, y: 150 } },
        { id: 16, location: { x: 75, y: 100 } }
    ],
    edges: [
        { source: 1, dest: 9 },
        { source: 10, dest: 2 },
        { source: 3, dest: 11 },
        { source: 12, dest: 4 },
        { source: 5, dest: 13 },
        { source: 14, dest: 6 },
        { source: 7, dest: 15 },
        { source: 16, dest: 8 },

        // Intersection below
        { source: 9, dest: 12, invert: true, priorities: [0, 0, 0.5, 0] },
        { source: 9, dest: 14, invert: true, priorities: [0, 0, 1, 0] },
        { source: 9, dest: 16, invert: true, priorities: [0, 0, 0.5, 0] },

        { source: 11, dest: 10, priorities: [0.5, 0, 0, 0] },
        { source: 11, dest: 14, priorities: [0.5, 0, 0, 0] },
        { source: 11, dest: 16, priorities: [1, 0, 0, 0] },

        { source: 13, dest: 10, invert: true, priorities: [0, 0, 1, 0] },
        { source: 13, dest: 12, invert: true, priorities: [0, 0, 0.5, 0] },
        { source: 13, dest: 16, invert: true, priorities: [0, 0, 0.5, 0] },

        { source: 15, dest: 10, priorities: [0.5, 0, 0, 0] },
        { source: 15, dest: 12, priorities: [1, 0, 0, 0] },
        { source: 15, dest: 14, priorities: [0.5, 0, 0, 0] }

    ],
    intersections: [
        { vertexIds: [9, 10, 11, 12, 13, 14, 15, 16], timings: [5, 1, 5, 1] }
    ]
}

if (window.location.pathname == "/") {
    runSimulation();
} else if (/^\/map\/?$/.test(window.location.pathname)) {
    runMapEditor();
}

function runSimulation() {
    app.init(window.innerWidth, window.innerHeight);
    var host = window.document.location.host.replace(/:.*/, '');
    var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
    client.joinOrCreate("simulation").then(room => {
        console.log("joined");
        room.onStateChange.once(function (state) {
            console.log("initial room state:", state);
            render(state.map);
        });
        // new room state
        room.onStateChange(function (state) {
            console.log("state change: ", state);
            render(state.map);
            // this signal is triggered on each patch
        });
        // listen to patches coming from the server
        room.onMessage(function (message) {
            //console.log(message)
        });
        // send message to room on submit

        // send data to room
        room.send({ message: "This is only a test" });
    });
}

function runMapEditor() {
    app.init(window.innerWidth / 2, window.innerHeight);
    var buttonHeight = 60;
    var jsonEditorContainer = document.createElement("DIV");
    jsonEditorContainer.style.position = "absolute";
    jsonEditorContainer.style.left = window.innerWidth / 2;
    jsonEditorContainer.style.top = 0;
    jsonEditorContainer.style.width = window.innerWidth / 2;
    jsonEditorContainer.style.height = window.innerHeight - buttonHeight;
    document.body.appendChild(jsonEditorContainer);

    var templates = [
        { text: "Vertex", title: "Insert a Vertex", value: { "id": "", "location": { "x": 0, "y": 0 }, "source": false, "dest": false } },
        { text: "Edge", title: "Insert an Edge", value: { "source": "", "dest": "", "invert": false } }
    ];

    var jsonEditor = new JSONEditor(jsonEditorContainer, { templates: templates, schema: map_schema });
    jsonEditor.set(defaultMap);

    var renderButton = document.createElement("BUTTON");
    renderButton.setAttribute("class", "btn btn-primary")
    renderButton.addEventListener("click", function (event) {
        var jsonMap = jsonEditor.get();
        render(jsonMap);
    });
    renderButton.style.height = buttonHeight;
    renderButton.style.width = window.innerWidth / 4;
    renderButton.style.position = "absolute";
    renderButton.style.top = window.innerHeight - buttonHeight;
    renderButton.style.left = window.innerWidth / 2;
    renderButton.style.borderRadius = 0;
    renderButton.innerHTML = "Show Map";
    document.body.appendChild(renderButton);

    var saveButton = document.createElement("BUTTON");
    saveButton.setAttribute("class", "btn btn-secondary")
    saveButton.addEventListener("click", function (event) {
        var jsonMap = jsonEditor.get();
        var download = document.createElement('a');
        download.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonMap, null, 2)));
        download.setAttribute("download", "map.json");
        download.style.display = "none";
        document.body.appendChild(download);
        download.click();
        document.body.removeChild(download);
    });
    saveButton.style.height = buttonHeight;
    saveButton.style.width = window.innerWidth / 8;
    saveButton.style.position = "absolute";
    saveButton.style.top = window.innerHeight - buttonHeight;
    saveButton.style.left = window.innerWidth * 3 / 4;
    saveButton.style.borderRadius = 0;
    saveButton.innerHTML = "Save Map";
    document.body.appendChild(saveButton);

    var loadButton = document.createElement("BUTTON");
    loadButton.setAttribute("class", "btn btn-warning");
    loadButton.addEventListener("click", function (event) {
        var upload = document.createElement('INPUT');
        upload.setAttribute("type", "file");
        upload.style.display = "none";
        upload.addEventListener("change", function (e) {
            var reader = new FileReader();
            reader.onload = function (event) {
                var json = JSON.parse(event.target.result);
                jsonEditor.set(json);
                renderButton.click();
            }
            reader.readAsText(e.target.files[0]);
            document.body.removeChild(e.target);
        })
        document.body.appendChild(upload);
        upload.click();
    });
    loadButton.style.height = buttonHeight;
    loadButton.style.width = window.innerWidth / 8;
    loadButton.style.position = "absolute";
    loadButton.style.top = window.innerHeight - buttonHeight;
    loadButton.style.left = window.innerWidth * 7 / 8;
    loadButton.style.borderRadius = 0;
    loadButton.innerHTML = "Load Map";
    document.body.appendChild(loadButton);
}