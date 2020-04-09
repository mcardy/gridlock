import 'jsoneditor/dist/jsoneditor.min.css';
import './../css/app.scss';
import 'popper.js';
import 'bootstrap';

import $ from "jquery";

import runSimulation from './screen/simulationscreen';
import runMapEditor from './screen/mapeditorscreen';

/**
 * This is the main entrypoint of the system and decides, based on the path, whether to run simulation setup or map editor setup
 */
function start() {
    if (window.location.pathname == "/") {
        runSimulation();
    } else if (/^\/map-editor\/?$/.test(window.location.pathname)) {
        runMapEditor();
    }
}

$(document).ready(start);