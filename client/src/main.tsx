import 'jsoneditor/dist/jsoneditor.min.css';
import './../css/app.scss';
import 'popper.js';
import 'bootstrap';

import $ from "jquery";

import runSimulation from './screen/simulationscreen';
import runMapEditor from './screen/mapeditorscreen';

function start() {
    if (window.location.pathname == "/") {
        runSimulation();
    } else if (/^\/map-editor\/?$/.test(window.location.pathname)) {
        runMapEditor();
    }
}

$(document).ready(start);