import { app } from './app'
import { render } from './map'

import * as Colyseus from "colyseus.js";

// Simulation room stuff
var host = window.document.location.host.replace(/:.*/, '');
var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
client.joinOrCreate("simulation").then(room => {
    console.log("joined");
    room.onStateChange.once(function (state) {
        console.log("initial room state:", state);
        render(state);
    });
    // new room state
    room.onStateChange(function (state) {
        console.log("state change: ", state);
        render(state);
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
