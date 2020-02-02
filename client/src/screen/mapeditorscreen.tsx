import { display, Display } from './../display';
import { map_schema } from '../../../common/map_schema';
import uploadFile from '../util/upload';

import * as React from "react";
import * as ReactDOM from "react-dom";

import $ from "jquery";

import { JsonEditor } from 'jsoneditor-react';
import Ajv from 'ajv';

import ace from 'brace';

import LoadingOverlay from './components/loadingoverlay';
import MapSelect from './components/mapselect';

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

class MapEditor extends React.Component<{ app: Display }, { json: any, loading: boolean, mapSelectModal: boolean, mapName: string }> {

    editorReference: { jsonEditor: JSONEditor };

    constructor(props) {
        super(props);
        this.state = { json: {}, loading: false, mapSelectModal: false, mapName: undefined };
        display.setEdgeSelectCallback((source, dest) => {
            var json = this.editorReference.jsonEditor.get();
            if (!("edges" in json)) return;
            var index = -1;
            for (var i = 0; i < json.edges.length; i++) {
                if (json.edges[i].source == source && json.edges[i].dest == dest) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                var path = { path: ["edges", index] };
                this.editorReference.jsonEditor.setSelection(path, path);
            }
        });
        display.setVertexSelectCallback((id) => {
            var json = this.editorReference.jsonEditor.get();
            if (!("vertices" in json)) return;
            var index = -1;
            for (var i = 0; i < json.vertices.length; i++) {
                if (json.vertices[i].id == id) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                var path = { path: ["vertices", index] };
                this.editorReference.jsonEditor.setSelection(path, path);
            }
        });
    }

    renderMap() {
        display.drawMap(this.state.json);
    }

    saveMap() {
        if (this.state.mapName != undefined) {
            this.setState({ loading: true });
            var that = this;
            $.ajax({
                type: "POST",
                url: "/maps/" + that.state.mapName,
                data: JSON.stringify(that.editorReference.jsonEditor.get()),
                contentType: "application/json",
                success: function (response) {
                    that.setState({ loading: false });
                },
                error: function (err) {
                    console.log(err);
                    that.setState({ loading: false });
                    alert("Error saving map: " + err.statusText);
                }
            })
        } else {
            alert("Saving a new file is not implemented yet...");
        }
    }

    loadMap(data: any, name: string) {
        this.setState({ json: data });
        this.editorReference.jsonEditor.set(data);
        this.renderMap();
        this.setState({ loading: false, mapName: name });
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
        //this.editorReference.jsonEditor.set(jsonData);
    }

    setEditorReference(instance) {
        this.editorReference = instance;
    }

    render() {
        const buttonHeight = 60;
        const topPositioning = window.innerHeight - buttonHeight;
        return (
            <div>
                <div style={{ position: "absolute", left: window.innerWidth / 2, top: 0, width: window.innerWidth / 2, height: window.innerHeight - buttonHeight }}>
                    <JsonEditor schema={map_schema} ajv={new Ajv()} value={this.state.json} allowedModes={["tree", "text", "code"]} ace={ace}
                        ref={this.setEditorReference.bind(this)} onChange={this.handleEditorChange.bind(this)}></JsonEditor>
                </div>
                <MapEditorButton onClick={this.renderMap.bind(this)} height={buttonHeight} width={window.innerWidth / 4} top={topPositioning} left={window.innerWidth / 2} text="Show Map" type="primary" />
                <MapEditorButton onClick={this.saveMap.bind(this)} height={buttonHeight} width={window.innerWidth / 8} top={topPositioning} left={3 * window.innerWidth / 4} text="Save Map" type="secondary" />
                <MapEditorButton onClick={() => this.setState({ mapSelectModal: !this.state.mapSelectModal })} height={buttonHeight} width={window.innerWidth / 8} top={topPositioning} left={7 * window.innerWidth / 8} text="Load Map" type="warning" />
                <MapSelect show={this.state.mapSelectModal} toggleShow={() => this.setState({ mapSelectModal: !this.state.mapSelectModal })} processMap={this.loadMap.bind(this)}></MapSelect>
                <LoadingOverlay enabled={this.state.loading}></LoadingOverlay>
            </div>
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