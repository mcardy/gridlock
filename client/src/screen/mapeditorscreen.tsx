import { PixiApp, drawMap } from './../display';
import { map_schema } from '../../../common/map_schema';
import uploadFile from '../util/upload';

import $ from "jquery";

import * as JSONEditor from 'jsoneditor';
import * as React from "react";
import * as ReactDOM from "react-dom";

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


class MapEditorButtonProperties {
    type: string;
    height: number;
    width: number;
    top: number;
    left: number;
    text: string;
    action: () => void
}

class MapEditorButton extends React.Component<MapEditorButtonProperties, {}> {
    render() {
        return (<button
            className={"btn btn-" + this.props.type}
            key={this.props.text}
            style={{
                height: this.props.height + "px",
                width: this.props.width + "px",
                position: "absolute", top: this.props.top + "px",
                left: this.props.left + "px",
                borderRadius: "0px"
            }
            }
            onClick={this.props.action} > {this.props.text} </button>);
    }
}

export default function runMapEditor() {
    PixiApp.renderer.resize(window.innerWidth / 2, window.innerHeight);

    var renderMap: () => void, saveMap: () => void, loadMap: () => void;
    var buttonHeight = 60;
    var topPositioning = window.innerHeight - buttonHeight;
    var jsonEditorContainer = (<div key="jsonEditor" id="jsonEditor" style={{
        position: "absolute", left: window.innerWidth / 2, top: 0, width: window.innerWidth / 2, height: window.innerHeight - buttonHeight
    }}> </div>);
    var showMapButton = <MapEditorButton action={() => renderMap()} height={buttonHeight} width={window.innerWidth / 4} top={topPositioning} left={window.innerWidth / 2} text="Show Map" type="primary" />;
    var saveMapButton = <MapEditorButton action={() => saveMap()} height={buttonHeight} width={window.innerWidth / 8} top={topPositioning} left={3 * window.innerWidth / 4} text="Save Map" type="secondary" />
    var loadMapButton = <MapEditorButton action={() => loadMap()} height={buttonHeight} width={window.innerWidth / 8} top={topPositioning} left={7 * window.innerWidth / 8} text="Load Map" type="warning" />

    ReactDOM.render(
        [jsonEditorContainer, showMapButton, saveMapButton, loadMapButton],
        document.getElementById("root")
    );

    var templates: JSONEditor.Template[] = [
        { text: "Vertex", title: "Insert a Vertex", field: "", value: { "id": "", "location": { "x": 0, "y": 0 }, "source": false, "dest": false } },
        { text: "Edge", title: "Insert an Edge", field: "", value: { "source": "", "dest": "", "invert": false } }
    ];
    var jsonEditor = new JSONEditor.default($("#jsonEditor").get(0), { templates: templates, schema: map_schema });
    jsonEditor.set(defaultMap);

    renderMap = () => {
        var jsonMap = jsonEditor.get();
        drawMap(jsonMap);
    }
    saveMap = () => {
        var jsonMap = jsonEditor.get();
        var download = document.createElement('a');
        download.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonMap, null, 2)));
        download.setAttribute("download", "map.json");
        download.style.display = "none";
        document.body.appendChild(download);
        download.click();
        document.body.removeChild(download);
    };
    loadMap = () => {
        uploadFile((result) => {
            var json = JSON.parse(result);
            jsonEditor.set(json);
            renderMap();
        })
    };
}