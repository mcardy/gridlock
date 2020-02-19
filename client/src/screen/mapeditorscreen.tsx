import { display, Display } from './../display';
import { map_schema } from '../../../common/map_schema';

import * as React from "react";
import * as ReactDOM from "react-dom";

import $ from "jquery";

import { JsonEditor } from 'jsoneditor-react';
import Ajv from 'ajv';

import ace from 'brace';

import LoadingOverlay from './components/loadingoverlay';
import MapSelect from './components/mapselect';
import GetStringModal from './components/getstring';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

import JSONEditor from 'jsoneditor';

class MapEditorButtonProperties {
    type: string;
    height: number;
    width: number;
    top: number;
    left: number;
    text: string;
    onClick: (event?: any) => void
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
            onClick={this.props.onClick} > {this.props.text} </button>);
    }
}

class MapEditor extends React.Component<{ app: Display }, { json: any, loading: boolean, mapSelectModal: boolean, mapName: string, saveAsModal: boolean, addEdgeModal: boolean, sourceVertex?: number, destVertex?: number }> {

    editorReference: { jsonEditor: JSONEditor };

    constructor(props) {
        super(props);
        this.state = { json: { width: 600, height: 400, vertices: [], edges: [] }, loading: false, mapSelectModal: false, mapName: undefined, saveAsModal: false, addEdgeModal: false };
        display.setEdgeSelectCallback(this.selectEdge.bind(this));
        display.setVertexSelectCallback(this.selectVertex.bind(this));
        window.addEventListener("keydown", (event) => {

            if (display.getSelectedVertex() != undefined) {
                this.vertexKeyBinding(event);
            } else if (display.getSelectedEdge() != undefined) {
                this.edgeKeyBinding(event);
            }
        });
        this.renderMap();
    }

    vertexKeyBinding(event: KeyboardEvent) {
        var id = display.getSelectedVertex().id;
        var vertex = this.findVertex(id);
        if (vertex.index < 0) return;
        var json = this.editorReference.jsonEditor.get();
        switch (event.key) {
            case "ArrowDown":
            case "ArrowLeft":
            case "ArrowRight":
            case "ArrowUp":
                var offsets = { "ArrowDown": [0, 1], "ArrowLeft": [-1, 0], "ArrowRight": [1, 0], "ArrowUp": [0, -1] }[event.key];
                vertex.value.location.x += offsets[0];
                vertex.value.location.y += offsets[1];
                json.vertices[vertex.index] = vertex.value;
                this.updateJson(json);
                this.selectVertex(id);
                break;
            case "Delete":
                var toRemove = [];
                for (var i = 0; i < json.edges.length; i++) {
                    if (json.edges[i].source == id || json.edges[i].dest == id) {
                        toRemove.push(i);
                    }
                }
                for (var i = 0; i < toRemove.length; i++) {
                    json.edges.splice(toRemove[i] - i, 1);
                }
                json.vertices.splice(vertex.index, 1);
                this.updateJson(json);
                break;
        }
    }

    edgeKeyBinding(event: KeyboardEvent) {
        var selected = display.getSelectedEdge();
        var edge = this.findEdge(selected.sourceId, selected.destId);
        if (edge.index < 0) return;
        var json = this.editorReference.jsonEditor.get();
        switch (event.key) {
            case "Delete":
                json.edges.splice(edge.index, 1);
                this.updateJson(json);
                break;
        }
    }

    selectVertex(id: number) {
        if (id == undefined) return;
        var vertex = this.findVertex(id);
        if (vertex.index >= 0) {
            var path = { path: ["vertices", vertex.index] };
            this.editorReference.jsonEditor.setSelection(path, path);
        }
    }

    findVertex(id: number): { index: number, value: any } {
        var json = this.editorReference.jsonEditor.get();
        if (!("vertices" in json)) return;
        for (var i = 0; i < json.vertices.length; i++) {
            if (json.vertices[i].id == id) {
                return { index: i, value: json.vertices[i] };
            }
        }
        return { index: -1, value: undefined };
    }

    selectEdge(source: number, dest: number) {
        if (source == undefined || dest == undefined) return;
        var edge = this.findEdge(source, dest);
        if (edge.index >= 0) {
            var path = { path: ["edges", edge.index] };
            this.editorReference.jsonEditor.setSelection(path, path);
        }
    }

    findEdge(source: number, dest: number): { index: number, value: any } {
        var json = this.editorReference.jsonEditor.get();
        if (!("edges" in json)) return;
        for (var i = 0; i < json.edges.length; i++) {
            if (json.edges[i].source == source && json.edges[i].dest == dest) {
                return { index: i, value: json.edges[i] };
            }
        }
        return { index: -1, value: undefined };
    }

    renderMap() {
        display.drawMap(this.state.json);
    }

    saveMap() {
        if (this.state.mapName != undefined) {
            this.saveFile(this.state.mapName);
        } else {
            this.saveAs();
        }
    }

    saveAs() {
        this.setState({ saveAsModal: true })
    }

    saveFile(filename: string) {
        this.setState({ loading: true });
        var that = this;
        $.ajax({
            type: "POST",
            url: "/maps/" + filename,
            data: JSON.stringify(that.editorReference.jsonEditor.get()),
            contentType: "application/json",
            success: function (response) {
                that.setState({ loading: false, mapName: filename });
            },
            error: function (err) {
                console.log(err);
                that.setState({ loading: false });
                alert("Error saving map: " + err.statusText);
            }
        })
    }

    loadMap(data: any, name: string) {
        this.updateJson(data);
        this.setState({ loading: false, mapName: name });
    }

    updateJson(data: any) {
        this.setState({ json: data });
        this.editorReference.jsonEditor.update(data);
        this.renderMap();
    }

    downloadMap() {
        var download = document.createElement('a');
        download.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state.json, null, 2)));
        download.setAttribute("download", "map.json");
        download.style.display = "none";
        document.body.appendChild(download);
        download.click();
        document.body.removeChild(download);
    }

    handleEditorChange(jsonData) {
        this.setState({ json: jsonData });
        this.renderMap();
        //this.editorReference.jsonEditor.set(jsonData);
    }

    setEditorReference(instance) {
        this.editorReference = instance;
    }

    addVertex() {
        var id = 1;
        while (this.findVertex(id).index >= 0) id++;
        var newVertex = { id: id, location: { x: 10, y: 10 }, source: false, dest: false };
        var json = this.state.json;
        json.vertices.push(newVertex);
        this.updateJson(json);
        this.selectVertex(id);
    }

    addEdge() {
        this.setState({ addEdgeModal: true });
    }

    saveEdge() {
        if (this.state.sourceVertex == undefined || this.state.destVertex == undefined) {
            alert("You must set both a source and destination vertex...");
            return;
        }
        var edge = { source: this.state.sourceVertex, dest: this.state.destVertex, invert: false, priorities: [1] };
        var json = this.state.json;
        json.edges.push(edge);
        this.updateJson(json);
        this.setState({ sourceVertex: undefined, destVertex: undefined });
        this.selectEdge(this.state.sourceVertex, this.state.destVertex);
        this.closeAddEdge();
    }

    closeAddEdge() {
        this.setState({ addEdgeModal: false });
    }

    render() {
        const buttonHeight = 60;
        const topPositioning = window.innerHeight - buttonHeight;

        var vertices = [];
        if (this.state.addEdgeModal) {
            for (let vertex of this.state.json.vertices) {
                vertices.push((<option key={vertex.id}>{vertex.id}</option>))
            }
        }

        return (
            <div>
                <div style={{ position: "absolute", left: window.innerWidth / 2, top: 0, width: window.innerWidth / 2, height: window.innerHeight - (1.5 * buttonHeight) }}>
                    <JsonEditor schema={map_schema} ajv={new Ajv()} value={this.state.json} allowedModes={["tree", "text", "code"]} ace={ace} history={true}
                        ref={this.setEditorReference.bind(this)} onChange={this.handleEditorChange.bind(this)}></JsonEditor>
                </div>
                <MapEditorButton onClick={this.addVertex.bind(this)} height={buttonHeight / 2} width={window.innerWidth / 4} top={topPositioning - buttonHeight / 2} left={window.innerWidth / 2} text="Add Vertex" type="secondary"></MapEditorButton>
                <MapEditorButton onClick={this.addEdge.bind(this)} height={buttonHeight / 2} width={window.innerWidth / 4} top={topPositioning - buttonHeight / 2} left={3 * window.innerWidth / 4} text="Add Edge" type="secondary"></MapEditorButton>
                <MapEditorButton onClick={this.saveMap.bind(this)} height={buttonHeight} width={window.innerWidth / 4} top={topPositioning} left={window.innerWidth / 2} text="Save" type="primary" />
                <MapEditorButton onClick={this.saveAs.bind(this)} height={buttonHeight} width={window.innerWidth / 8} top={topPositioning} left={3 * window.innerWidth / 4} text="Save As" type="secondary" />
                <MapEditorButton onClick={() => this.setState({ mapSelectModal: !this.state.mapSelectModal })} height={buttonHeight} width={window.innerWidth / 8} top={topPositioning} left={7 * window.innerWidth / 8} text="Load Map" type="warning" />
                <MapSelect show={this.state.mapSelectModal} toggleShow={() => this.setState({ mapSelectModal: !this.state.mapSelectModal })} processMap={this.loadMap.bind(this)}></MapSelect>
                <GetStringModal title="Save As" show={this.state.saveAsModal} toggleShow={() => this.setState({ saveAsModal: !this.state.saveAsModal })} callback={(name) => this.saveFile(name)} placeholder="Filename..." doneText="Save"></GetStringModal>
                <LoadingOverlay enabled={this.state.loading}></LoadingOverlay>

                <Modal show={this.state.addEdgeModal} onHide={this.closeAddEdge.bind(this)}>
                    <Modal.Header closeButton>
                        <Modal.Title>Add Edge</Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        Select two vertices to connect
                        <label>Source</label>
                        <select className="form-control" value={this.state.sourceVertex} onChange={e => this.setState({ sourceVertex: +e.target.value })} >
                            {vertices}
                        </select>
                        <label>Destination</label>
                        <select className="form-control" value={this.state.destVertex} onChange={e => this.setState({ destVertex: +e.target.value })} >
                            {vertices}
                        </select>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button variant="secondary" onClick={this.closeAddEdge.bind(this)}>Close</Button>
                        <Button variant="primary" onClick={this.saveEdge.bind(this)}>Add Edge</Button>
                    </Modal.Footer>
                </Modal>

            </div >
        )
    }
}

export default function runMapEditor() {
    display.PixiApp.renderer.resize(window.innerWidth / 2, window.innerHeight);

    ReactDOM.render(
        <MapEditor app={display}></MapEditor>,
        document.getElementById("root")
    );
}