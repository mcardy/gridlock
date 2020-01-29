
import { PixiApp, drawMap, Colours } from '../display';
import * as Colyseus from "colyseus.js";

import * as React from "react";
import * as ReactDOM from "react-dom";

import uploadFile from '../util/upload';

const menuWidth = 40;
const menuWidthOpen = 400;

class RightMenu extends React.Component<{ room: Colyseus.Room }, { open: boolean }> {
    constructor(props) {
        super(props);
        this.state = { open: false };
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

    render() {
        var transform = "rotate(" + (this.state.open ? 90 : 0) + "deg)";
        return (
            <div style={{
                position: "absolute", right: 0, width: (this.state.open ? menuWidthOpen : menuWidth) + "px", top: 0, height: "100%",
                backgroundColor: "#" + Colours.secondary.toString(16), transition: "0.3s", overflow: "hidden"
            }}>
                <div style={{ height: "100%", backgroundColor: "#" + Colours.tertiary.toString(16), width: menuWidth }}>
                    <button style={{
                        color: "#" + Colours.accent.toString(16), backgroundColor: "transparent", border: "none", fontSize: (menuWidth - 10) + "px", transition: "0.3s",
                        transform: transform, WebkitTransform: transform, MozTransformOrigin: transform, OTransform: transform, msTransform: transform,
                        outline: "none"
                    }}
                        onClick={this.toggle.bind(this)}>&#9776;</button>
                </div>

                <div style={{ position: "relative", left: menuWidth, top: "-" + window.innerHeight + "px", width: menuWidthOpen - menuWidth, padding: "10px" }}>
                    <button className="btn btn-secondary btn-block" onClick={this.uploadMap.bind(this)}>Upload Map</button>
                    <button className="btn btn-secondary btn-block" onClick={this.pause.bind(this)}>Pause/Unpause</button>
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

        room.onStateChange.once(function (state) {
            console.log("initial room state:", state);
            drawMap(state["map"]);
        });

        room.onStateChange(function (state) {
            drawMap(state["map"]);
        });

        room.onMessage(function (message) {
        });

        ReactDOM.render(<RightMenu room={room}></RightMenu>, document.getElementById("root"))
    });
}