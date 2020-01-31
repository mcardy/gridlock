
import { PixiApp, drawMap, Colours } from '../display';
import * as Colyseus from "colyseus.js";

import * as React from "react";
import * as ReactDOM from "react-dom";

import Button from 'react-bootstrap/Button';

import uploadFile from '../util/upload';

const menuWidth = 40;
const menuWidthOpen = 400;

class RightMenu extends React.Component<{ room: Colyseus.Room }, { open: boolean, simulationSpeed: number }> {
    constructor(props) {
        super(props);
        console.log(this.props.room.state.simulationSpeed);
        this.state = { open: false, simulationSpeed: this.props.room.state.simulationSpeed };
    }

    toggle() {
        this.setState({ open: !this.state.open });
    }

    uploadMap() {
        uploadFile((result) => {
            this.props.room.send({ command: "setmap", map: result })
        })
    }

    pause() {
        this.props.room.send({ command: this.props.room.state.paused ? "unpause" : "pause" })
    }

    setSpeed(event) {
        var speed = +event.target.value;
        this.setState({ simulationSpeed: +speed });
        this.props.room.send({ command: "setSimulationSpeed", speed: speed })
    }

    render() {
        return (
            <div className={"sidebar-menu" + (this.state.open ? " open" : "")}>
                <div className="sidebar-menu-bar">
                    <button className="sidebar-menu-toggle" onClick={this.toggle.bind(this)}>&#9776;</button>
                </div>
                <div className="sidebar-menu-content">
                    <Button variant="secondary" block onClick={this.uploadMap.bind(this)}>Upload Map</Button>
                    <Button variant="secondary" block onClick={this.pause.bind(this)}>Pause/Unpause</Button>
                    <hr></hr>
                    <div className="form-group">
                        <label>Set Simulation Speed</label>
                        <input type="range" className="custom-range" min="0.125" max="4" step="0.125" value={this.state.simulationSpeed} onChange={this.setSpeed.bind(this)} />
                    </div>

                    <a className="btn btn-secondary" role="button" href="/map-editor/" target="_blank" style={{ position: "absolute", bottom: 10, width: "calc(100% - 20px)" }}>Open Map Editor</a>
                </div>
            </div>
        );
    }
}

export default function runSimulation() {
    PixiApp.renderer.resize(window.innerWidth - menuWidth, window.innerHeight);
    var host = window.document.location.host.replace(/:.*/, '');
    var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
    client.joinOrCreate("simulation").then(room => {

        room.onStateChange.once(function (state: any) {
            console.log("initial room state:", state);
            ReactDOM.render(<RightMenu room={room}></RightMenu>, document.getElementById("root"))
            if (state.map.width) drawMap(state.map);
        });

        room.onStateChange(function (state: any) {
            if (state.map.width) drawMap(state.map);
        });

        room.onMessage(function (message) {
        });

    });
}