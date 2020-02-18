
import { display } from '../display';
import * as Colyseus from "colyseus.js";
import $ from "jquery";

import * as React from "react";
import * as ReactDOM from "react-dom";

import Button from 'react-bootstrap/Button';

import LoadingOverlay from './components/loadingoverlay';
import MapSelect from './components/mapselect';

const menuWidth = 40;

class SimulationMenu extends React.Component<{ room: Colyseus.Room }, { open: boolean, simulationSpeed: number, showSelectMapModal: boolean, loading: boolean, agent: number, vertex: number, edge: { source: number, dest: number } }> {
    constructor(props) {
        super(props);
        display.setEdgeSelectCallback(this.selectEdge.bind(this));
        display.setVertexSelectCallback(this.selectVertex.bind(this));
        display.setAgentSelectCallback(this.selectAgent.bind(this));
        this.state = { open: false, simulationSpeed: this.props.room.state.simulationSpeed, showSelectMapModal: false, loading: false, agent: undefined, edge: undefined, vertex: undefined };
    }

    toggleMenu() {
        this.setState({ open: !this.state.open });
    }

    toggleSelectedMapModal() {
        this.setState({ showSelectMapModal: !this.state.showSelectMapModal })
    }

    toggleSimulationRunning() {
        this.props.room.send({ command: this.props.room.state.paused ? "unpause" : "pause" })
    }

    setLoading(value: boolean) {
        this.setState({ loading: value });
    }

    setMap(data) {
        this.props.room.send({ command: "setmap", map: JSON.stringify(data) });
        this.setLoading(false);
    }

    setSimulationSpeed(event) {
        var speed = +event.target.value;
        this.setState({ simulationSpeed: +speed });
        this.props.room.send({ command: "setSimulationSpeed", speed: speed })
    }

    selectAgent(id: number) {
        this.setState({ agent: id });
    }

    selectEdge(source: number, dest: number) {
        this.setState({ edge: { source: source, dest: dest } });
    }

    selectVertex(id: number) {
        this.setState({ vertex: id });
    }

    render() {
        var agent = undefined;
        if (this.state.agent != undefined) {
            var selectedAgent = undefined;
            if (this.props.room.state.map != undefined && this.props.room.state.map.agents != undefined) {
                for (var a of this.props.room.state.map.agents) {
                    if (a.id == this.state.agent) {
                        selectedAgent = a;
                        break;
                    }
                }
            }
            agent = (<p>Selected Agent: {this.state.agent}, {a.sourceId} -> {a.destId}</p>);
        }
        var edge = this.state.edge != undefined && this.state.edge.source != undefined ? (<p>Selected Edge: {this.state.edge.source} -> {this.state.edge.dest}</p>) : undefined;
        var vertex = this.state.vertex != undefined ? (<p>Selected Vertex: {this.state.vertex}</p>) : undefined;
        return (
            <div className={"sidebar-menu" + (this.state.open ? " open" : "")}>
                <div className="sidebar-menu-bar">
                    <button className="sidebar-menu-toggle" onClick={this.toggleMenu.bind(this)}>&#9776;</button>
                </div>
                <div className="sidebar-menu-content">
                    <Button variant="secondary" block onClick={this.toggleSelectedMapModal.bind(this)}>Select Map</Button>
                    <Button variant="secondary" block onClick={this.toggleSimulationRunning.bind(this)}>Pause/Unpause</Button>
                    <hr></hr>
                    <div className="form-group">
                        <label>Set Simulation Speed</label>
                        <input type="range" className="custom-range" min="0.125" max="4" step="0.125" value={this.state.simulationSpeed} onChange={this.setSimulationSpeed.bind(this)} />
                    </div>
                    {agent}
                    {edge}
                    {vertex}
                    <a className="btn btn-secondary" role="button" href="/map-editor/" target="_blank" style={{ position: "absolute", bottom: 10, width: "calc(100% - 20px)" }}>Open Map Editor</a>
                </div>
                <MapSelect show={this.state.showSelectMapModal} toggleShow={this.toggleSelectedMapModal.bind(this)} processMap={this.setMap.bind(this)}></MapSelect>
                <LoadingOverlay enabled={this.state.loading}></LoadingOverlay>
            </div >
        );
    }
}

export default function runSimulation() {
    display.PixiApp.renderer.resize(window.innerWidth - menuWidth, window.innerHeight);
    var host = window.document.location.host.replace(/:.*/, '');
    var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
    client.joinOrCreate("simulation").then(room => {

        room.onStateChange.once(function (state: any) {
            console.log("initial room state:", state);
            if (state.map.width) display.drawMap(state.map);

            ReactDOM.render(<SimulationMenu room={room}></SimulationMenu>, document.getElementById("root"))
        });

        room.onStateChange(function (state: any) {
            if (state.map.width) display.drawMap(state.map);
        });

        room.onMessage(function (message) {
        });

    });
}