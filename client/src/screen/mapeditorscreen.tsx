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

/**
 * Main map editor controls react component
 */
class MapEditor extends React.Component<{ app: Display }, {
    json: any, loading: boolean, mapSelectModal: boolean, mapName: string,
    saveAsModal: boolean, addEdgeModal: boolean, sourceVertex?: number, destVertex?: number, resizing: boolean, resizingStartingX?: number,
    toolsWidth: number, locationEditor: boolean, locationEditorX: number, locationEditorY: number, priorityEditor: boolean, priorityEditorValue: string
}> {

    editorReference: { jsonEditor: JSONEditor };

    constructor(props) {
        super(props);
        this.state = {
            json: { width: 600, height: 400, vertices: [], edges: [] }, loading: false,
            mapSelectModal: false, mapName: undefined, saveAsModal: false, addEdgeModal: false,
            resizing: false, toolsWidth: window.innerWidth / 3, locationEditor: false,
            locationEditorX: 0, locationEditorY: 0, priorityEditor: false, priorityEditorValue: ""
        };
        display.setEdgeSelectCallback(this.selectEdge.bind(this));
        display.setVertexSelectCallback(this.selectVertex.bind(this));
        window.addEventListener("keydown", (event) => {
            if (event.altKey && event.keyCode == 69) {
                event.preventDefault();
                event.stopPropagation();
                this.addEdge();
            } else if (event.altKey && event.keyCode == 86) {
                event.preventDefault();
                event.stopPropagation();
                this.addVertex();
            } else if (display.getSelectedVertices().length > 0) {
                this.vertexKeyBinding(event);
            } else if (display.getSelectedEdges().length > 0) {
                this.edgeKeyBinding(event);
            }
        });

        window.addEventListener("mousemove", this.resizeMouseMove.bind(this));
        window.addEventListener("mouseup", this.resizeMouseUp.bind(this));
        this.renderMap();
    }

    vertexKeyBinding(event: KeyboardEvent) {
        var json = this.editorReference.jsonEditor.get();
        if (event.altKey && event.keyCode == 76) {
            event.preventDefault();
            event.stopPropagation();
            if (display.getSelectedVertices().length != 1)
                return;
            var id = display.getSelectedVertices()[0];
            var vertex = this.findVertex(id);
            if (vertex.index < 0) return;
            this.setState({ locationEditor: true, locationEditorX: +vertex.value.location.x, locationEditorY: +vertex.value.location.y })
        } else if (event.altKey && (event.keyCode == 83 || event.keyCode == 68)) {
            event.preventDefault();
            event.stopPropagation();
            for (var vid of display.getSelectedVertices()) {
                var vertex = this.findVertex(vid);
                var index = vertex.index;
                var value = vertex.value;
                if (event.keyCode == 83) {
                    if (!("source" in value)) value.source = false;
                    value.source = !value.source;
                } else if (event.keyCode == 68) {
                    if (!("dest" in value)) value.dest = false;
                    value.dest = !value.dest;
                }
                json.vertices[index] = value;
            }
            this.updateJson(json);
        } else {
            switch (event.key) {
                case "ArrowDown":
                case "ArrowLeft":
                case "ArrowRight":
                case "ArrowUp":
                    var offsets = { "ArrowDown": [0, 1], "ArrowLeft": [-1, 0], "ArrowRight": [1, 0], "ArrowUp": [0, -1] }[event.key];
                    for (var vid of display.getSelectedVertices()) {
                        var v = this.findVertex(vid);
                        v.value.location.x += offsets[0];
                        v.value.location.y += offsets[1];
                        json.vertices[v.index] = v.value;
                    }
                    this.updateJson(json);
                    this.selectVertex(id);
                    break;
                case "Delete":
                    var toRemove = [];
                    for (var i = 0; i < json.edges.length; i++) {
                        if (display.getSelectedVertices().indexOf(json.edges[i].source) >= 0 || display.getSelectedVertices().indexOf(json.edges[i].dest) >= 0) {
                            toRemove.push(i);
                        }
                    }
                    toRemove.sort();
                    for (var i = 0; i < toRemove.length; i++) {
                        json.edges.splice(toRemove[i] - i, 1);
                    }
                    toRemove = []
                    for (var vid of display.getSelectedVertices()) {
                        var vertex = this.findVertex(vid);
                        if (vertex.index < 0) continue;
                        toRemove.push(vertex.index);
                    }
                    toRemove.sort();
                    for (var i = 0; i < toRemove.length; i++) {
                        json.vertices.splice(toRemove[i] - i, 1);
                    }
                    this.updateJson(json);
                    break;
                default:
                    break;
            }
        }
    }

    edgeKeyBinding(event: KeyboardEvent) {
        var json = this.editorReference.jsonEditor.get();
        if (event.altKey && event.keyCode == 73) {
            event.preventDefault();
            event.stopPropagation();
            for (var selected of display.getSelectedEdges()) {
                var edge = this.findEdge(selected.sourceId, selected.destId);
                var index = edge.index;
                var value = edge.value;
                if (!("invert" in value)) value.invert = false;
                value.invert = !value.invert;
                json.edges[index] = value;
            }
            this.updateJson(json);
        } else if (event.altKey && event.keyCode == 80) {
            event.preventDefault();
            event.stopPropagation();
            if (display.getSelectedEdges().length != 1)
                return;
            var edge = this.findEdge(display.getSelectedEdges()[0].sourceId, display.getSelectedEdges()[0].destId);
            if (!("priorities" in edge.value)) edge.value.priorities = [];
            this.setState({ priorityEditor: true, priorityEditorValue: edge.value.priorities.join(",") });
        } else {
            switch (event.key) {
                case "Delete":
                    var toRemove = [];
                    for (var selected of display.getSelectedEdges()) {
                        var edge = this.findEdge(selected.sourceId, selected.destId);
                        if (edge.index < 0) continue;
                        toRemove.push(edge.index);
                    }
                    toRemove.sort();
                    for (var i = 0; i < toRemove.length; i++) {
                        json.edges.splice(toRemove[i] - i, 1);
                    }
                    this.updateJson(json);
                    break;
            }
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
        display.setSelectedVertices([id]);
    }

    addEdge() {
        var sourceVertex = undefined;
        var destVertex = undefined;
        if (display.getSelectedVertices().length > 0) {
            sourceVertex = display.getSelectedVertices()[0];
        }
        if (display.getSelectedVertices().length > 1) {
            destVertex = display.getSelectedVertices()[1];
        }
        this.setState({ addEdgeModal: true, sourceVertex: sourceVertex, destVertex: destVertex });
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

    addIntersection() {
        var json = this.state.json;
        var selectedVertices = display.getSelectedVertices();
        var timings = [5, 1, 5, 1];
        var intersection = { vertexIds: selectedVertices, timings: timings };
        for (var i = 0; i < json.edges.length; i++) {
            if (selectedVertices.indexOf(json.edges[i].source) >= 0 && selectedVertices.indexOf(json.edges[i].dest) >= 0) {
                json.edges[i].priorities = json.edges[i].priorities == undefined ? [] : json.edges[i].priorities;
                for (var j = json.edges[i].priorities.length; j < timings.length; j++) {
                    json.edges[i].priorities.push(0);
                }
            }
        }
        json.intersections = json.intersections != undefined ? json.intersections : [];
        json.intersections.push(intersection);
        this.updateJson(json);
        var path = { path: ["intersections", json.intersections.length - 1] };
        this.editorReference.jsonEditor.setSelection(path, path);
    }

    addLane() {
        var json = this.state.json;
        var selectedEdges = display.getSelectedEdges();
        var entries = [];
        for (var edge of selectedEdges) {
            entries.push({ source: edge.sourceId, dest: edge.destId });
        }
        json.lanes = json.lanes != undefined ? json.lanes : [];
        json.lanes.push({ entries: entries });
        this.updateJson(json);
        var path = { path: ["lanes", json.lanes.length - 1] };
        this.editorReference.jsonEditor.setSelection(path, path);
    }

    closeAddEdge() {
        this.setState({ addEdgeModal: false });
    }

    resizeMouseDown(event) {
        this.setState({ resizing: true, resizingStartingX: event.pageX });
        event.stopPropagation();
        event.preventDefault();
    }

    resizeMouseUp(event) {
        if (this.state.resizing) {
            this.setState({ resizing: false });
            event.stopPropagation();
            event.preventDefault();
        }
    }

    resizeMouseMove(event) {
        if (this.state.resizing) {
            var newWidth = Math.max(this.state.toolsWidth + this.state.resizingStartingX - event.pageX, 450);
            this.setState({ toolsWidth: newWidth, resizingStartingX: newWidth != this.state.toolsWidth ? event.pageX : this.state.resizingStartingX })
            event.stopPropagation();
            event.preventDefault();
        }
    }

    closeLocationModal() {
        this.setState({ locationEditor: false, locationEditorX: 0, locationEditorY: 0 });
    }

    setLocation() {
        if (display.getSelectedVertices().length != 1)
            return;
        var json = this.state.json;
        var id = display.getSelectedVertices()[0];
        var vertex = this.findVertex(id);
        if (vertex.index < 0) return;
        vertex.value.location.x = this.state.locationEditorX;
        vertex.value.location.y = this.state.locationEditorY;
        json.vertices[vertex.index] = vertex.value;
        this.updateJson(json);
        this.closeLocationModal();
    }

    setPriorities(value: string) {
        value = value.replace(" ", "");
        var priorityStrings = value.split(",");
        var priorities = [];
        for (var priority of priorityStrings) {
            priorities.push(+priority);
        }
        if (display.getSelectedEdges().length != 1)
            return;
        var json = this.state.json;
        var edge = this.findEdge(display.getSelectedEdges()[0].sourceId, display.getSelectedEdges()[0].destId);
        if (edge.index < 0) return;
        edge.value.priorities = priorities;
        json.edges[edge.index] = edge.value;
        this.updateJson(json);
        this.closeLocationModal();
    }

    render() {
        const buttonHeight = 60;
        const resizeWidth = 3;
        const topPositioning = window.innerHeight - buttonHeight;
        const toolsWidth = this.state.toolsWidth - resizeWidth;
        const toolsLeft = window.innerWidth - toolsWidth;

        display.PixiApp.renderer.resize(window.innerWidth - toolsWidth, window.innerHeight);
        display.redrawMap();

        var vertices = [];
        if (this.state.addEdgeModal) {
            for (let vertex of this.state.json.vertices) {
                vertices.push((<option key={vertex.id}>{vertex.id}</option>))
            }
        }

        return (
            <div>
                <div style={{ position: "absolute", left: toolsLeft - resizeWidth, top: 0, width: resizeWidth, height: window.innerHeight, cursor: "e-resize", backgroundColor: "black" }} onMouseDown={this.resizeMouseDown.bind(this)}></div>
                <div style={{ position: "absolute", left: toolsLeft, top: 0, width: toolsWidth, height: window.innerHeight - (1.8 * buttonHeight) }}>
                    <JsonEditor schema={map_schema} ajv={new Ajv()} value={this.state.json} allowedModes={["tree", "text", "code"]} ace={ace} history={true}
                        ref={this.setEditorReference.bind(this)} onChange={this.handleEditorChange.bind(this)}></JsonEditor>
                </div>
                <MapEditorButton onClick={this.addVertex.bind(this)} height={buttonHeight * 0.8} width={toolsWidth / 4} top={topPositioning - buttonHeight * 0.8} left={toolsLeft} text="Add Vertex" type="primary"></MapEditorButton>
                <MapEditorButton onClick={this.addEdge.bind(this)} height={buttonHeight * 0.8} width={toolsWidth / 4} top={topPositioning - buttonHeight * 0.8} left={toolsLeft + toolsWidth / 4} text="Add Edge" type="primary"></MapEditorButton>
                <MapEditorButton onClick={this.addIntersection.bind(this)} height={buttonHeight * 0.8} width={toolsWidth / 4} top={topPositioning - buttonHeight * 0.8} left={toolsLeft + 2 * toolsWidth / 4} text="Add Intersection" type="primary"></MapEditorButton>
                <MapEditorButton onClick={this.addLane.bind(this)} height={buttonHeight * 0.8} width={toolsWidth / 4} top={topPositioning - buttonHeight * 0.8} left={toolsLeft + 3 * toolsWidth / 4} text="Add Lanes" type="primary"></MapEditorButton>
                <MapEditorButton onClick={this.saveMap.bind(this)} height={buttonHeight} width={toolsWidth / 2} top={topPositioning} left={toolsLeft} text="Save" type="success" />
                <MapEditorButton onClick={this.saveAs.bind(this)} height={buttonHeight} width={toolsWidth / 4} top={topPositioning} left={toolsLeft + toolsWidth / 2} text="Save As" type="danger" />
                <MapEditorButton onClick={() => this.setState({ mapSelectModal: !this.state.mapSelectModal })} height={buttonHeight} width={toolsWidth / 4} top={topPositioning} left={toolsLeft + 3 * toolsWidth / 4} text="Load Map" type="warning" />
                <MapSelect show={this.state.mapSelectModal} toggleShow={() => this.setState({ mapSelectModal: !this.state.mapSelectModal })} processMap={this.loadMap.bind(this)}></MapSelect>
                <GetStringModal title="Save As" show={this.state.saveAsModal} toggleShow={() => this.setState({ saveAsModal: !this.state.saveAsModal })} callback={(name) => this.saveFile(name)} placeholder="Filename..." doneText="Save"></GetStringModal>
                <LoadingOverlay enabled={this.state.loading}></LoadingOverlay>

                <GetStringModal title="Priority Editor" description="Comma separated list of priorities for an intersection" show={this.state.priorityEditor} toggleShow={() => this.setState({ priorityEditor: !this.state.priorityEditor })}
                    callback={this.setPriorities.bind(this)} placeholder="Priorities..." doneText="Set Priorities" initialValue={this.state.priorityEditorValue}></GetStringModal>


                <Modal show={this.state.locationEditor} onHide={() => this.setState({ locationEditor: false })}>
                    <Modal.Header closeButton>
                        <Modal.Title>Set Location</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        Set the location
                        <label>X Coordinate</label>
                        <input className="form-control" placeholder="X" value={this.state.locationEditorX} onChange={e => this.setState({ locationEditorX: +e.target.value })}></input>
                        <label>Y Coordinate</label>
                        <input className="form-control" placeholder="Y" value={this.state.locationEditorY} onChange={e => this.setState({ locationEditorY: +e.target.value })}></input>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={this.closeLocationModal.bind(this)}>Close</Button>
                        <Button variant="primary" onClick={this.setLocation.bind(this)}>Set Location</Button>
                    </Modal.Footer>
                </Modal>

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

/**
 * Setup and run the map editor. Consists of adding the map editor to the screen
 */
export default function runMapEditor() {
    ReactDOM.render(
        <MapEditor app={display}></MapEditor>,
        document.getElementById("root")
    );
}