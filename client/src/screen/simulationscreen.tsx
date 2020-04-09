
import { display } from '../display';
import * as Colyseus from "colyseus.js";
import $ from "jquery";

import * as React from "react";
import * as ReactDOM from "react-dom";

import Button from 'react-bootstrap/Button';
import ListGroup from 'react-bootstrap/ListGroup';

import LoadingOverlay from './components/loadingoverlay';
import MapSelect from './components/mapselect';

const menuWidth = 40;

/**
 * The menu containing the controls for the simulation
 */
class SimulationMenu extends React.Component<{ room: Colyseus.Room }, {
    open: boolean, simulationSpeed: number, showSelectMapModal: boolean,
    loading: boolean, agent: number, vertex: number,
    edge: { source: number, dest: number },
    metrics: any, mapName: string, tickTarget: string
    seed: string
}> {
    constructor(props) {
        super(props);
        display.setEdgeSelectCallback(this.selectEdge.bind(this));
        display.setVertexSelectCallback(this.selectVertex.bind(this));
        display.setAgentSelectCallback(this.selectAgent.bind(this));
        this.state = { open: false, simulationSpeed: this.props.room.state.simulationSpeed, showSelectMapModal: false, loading: false, agent: undefined, edge: undefined, vertex: undefined, metrics: undefined, mapName: undefined, tickTarget: undefined, seed: undefined };
        this.props.room.onStateChange(function (state: any) {
            var metrics = state.metrics;
            metrics.agents = state.map.agents != undefined ? state.map.agents.length : 0
            this.setState({
                metrics: metrics
            })
        }.bind(this));
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

    setMap(data: any, name: string) {
        this.props.room.state.map = undefined;
        this.props.room.send({ command: "setmap", map: JSON.stringify(data) });
        this.setLoading(false);
        this.setState({ mapName: name, seed: data.seed });
    }

    setSimulationSpeed(event) {
        var speed = +event.target.value;
        this.setState({ simulationSpeed: +speed });
        this.props.room.send({ command: "setSimulationSpeed", speed: speed })
    }

    setTickTarget(event) {
        this.setState({ tickTarget: event.target.value });
    }

    sendTickTarget(event) {
        this.props.room.send({ command: "setTickTarget", tickTarget: this.state.tickTarget });
        this.setState({ tickTarget: undefined });
    }

    setSeed(event) {
        this.setState({ seed: event.target.value });
    }

    sendSeed(event) {
        this.props.room.send({ command: "setSeed", seed: this.state.seed });
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

    saveMetrics() {
        if (this.state.metrics != undefined && this.state.mapName != undefined) {
            var download = document.createElement('a');
            var content = "time";
            var keys: string[] = [];
            for (var key of Object.keys(this.state.metrics).sort()) {
                if (key == "agents") continue;
                keys.push(key);
                content += "," + key;
            }
            for (var i = 0; i <= this.props.room.state.metricsOverTime.length; i++) {
                content += "\n" + i;
                var metric = i != this.props.room.state.metricsOverTime.length ? this.props.room.state.metricsOverTime[i] : this.state.metrics;
                for (var key of keys) {
                    content += "," + metric[key];
                }
            }
            download.setAttribute("href", "data:text/plain;charset=utf-8," + content);
            download.setAttribute("download", this.state.mapName + "_metrics.csv");
            download.style.display = "none";
            document.body.appendChild(download);
            download.click();
            document.body.removeChild(download);
        }
    }

    reset() {
        this.props.room.send({ command: "reset" });
    }

    /**
     * Main render function
     */
    render() {
        var metrics = undefined;
        if (this.state.metrics != undefined) {
            metrics = (<div><hr></hr><h4 className="text-dark text-center">Metrics</h4>
                <ListGroup>
                    <ListGroup.Item>Tick Count: {this.state.metrics.totalTicks}</ListGroup.Item>
                    <ListGroup.Item>Throughput: {this.state.metrics.throughput}</ListGroup.Item>
                    <ListGroup.Item>Throughput per Tick: {this.state.metrics.throughputPerUnitTime}</ListGroup.Item>
                    <ListGroup.Item>Spawn Count: {this.state.metrics.spawned}</ListGroup.Item>
                    <ListGroup.Item>Existing Agents: {this.state.metrics.agents}</ListGroup.Item>
                    <ListGroup.Item>Average Trip Length: {this.state.metrics.averageTripLength}</ListGroup.Item>
                    <ListGroup.Item>Average Speed: {this.state.metrics.averageSpeed}</ListGroup.Item>
                    <Button variant="primary" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }} onClick={this.saveMetrics.bind(this)} disabled={this.state.mapName == undefined}>Save Metrics</Button>
                </ListGroup></div>);
        }
        return (
            <div className={"sidebar-menu" + (this.state.open ? " open" : "")}>
                <div className="sidebar-menu-bar">
                    <button className="sidebar-menu-toggle" onClick={this.toggleMenu.bind(this)}>&#9776;</button>
                </div>
                <div className="sidebar-menu-content">
                    <Button variant="secondary" block onClick={this.toggleSelectedMapModal.bind(this)}>Select Map</Button>
                    <Button variant="secondary" block onClick={this.toggleSimulationRunning.bind(this)} disabled={this.state.mapName == undefined}>
                        {(this.props.room.state.metrics.totalTicks == 0 || this.props.room.state.metrics.totalTicks == undefined) ? "Start" : (this.props.room.state.paused ? "Unpause" : "Pause")}</Button>
                    <Button variant="secondary" block onClick={this.reset.bind(this)} disabled={this.state.mapName == undefined}>Reset</Button>
                    <hr></hr>
                    <div className="form-group">
                        <label>Set Simulation Speed</label>
                        <input type="range" className="custom-range" min="0.125" max="12" step="0.125" value={this.state.simulationSpeed} onChange={this.setSimulationSpeed.bind(this)} />
                    </div>
                    <div className="form-row align-items-center mb-1">
                        <div className="col-8" style={{ paddingRight: 0 }}>
                            <input className="form-control" type="number" placeholder="Tick count..." style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                value={this.state.tickTarget != undefined ? this.state.tickTarget : ""} onChange={this.setTickTarget.bind(this)}></input>
                        </div>
                        <div className="col-4" style={{ paddingLeft: 0 }}>
                            <Button block variant="secondary" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} onClick={this.sendTickTarget.bind(this)}>Set Target</Button>
                        </div>
                        {this.props.room.state.tickTarget != undefined ? (<span className="text-muted text-center w-100">Current Target: {this.props.room.state.tickTarget}</span>) : undefined}
                    </div>
                    <div className="form-row align-items-center">
                        <div className="col-8" style={{ paddingRight: 0 }}>
                            <input className="form-control" type="number" placeholder="Seed..." style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                value={this.state.seed != undefined ? this.state.seed : ""} onChange={this.setSeed.bind(this)}></input>
                        </div>
                        <div className="col-4" style={{ paddingLeft: 0 }}>
                            <Button block variant="secondary" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} onClick={this.sendSeed.bind(this)}>Set Seed</Button>
                        </div>
                    </div>
                    {metrics}
                    <a className="btn btn-secondary" role="button" href="/map-editor/" target="_blank" style={{ position: "absolute", bottom: 10, width: "calc(100% - 20px)" }}>Open Map Editor</a>
                </div>
                <MapSelect show={this.state.showSelectMapModal} toggleShow={this.toggleSelectedMapModal.bind(this)} processMap={this.setMap.bind(this)}></MapSelect>
                <LoadingOverlay enabled={this.state.loading}></LoadingOverlay>
            </div >
        );
    }
}

/**
 * Run the setup for a simulation. Creates the menu and a connection to the server over http/https
 */
export default function runSimulation() {
    var resize = () => {
        display.PixiApp.renderer.resize(window.innerWidth - menuWidth, window.innerHeight);
        display.redrawMap();
    }
    window.addEventListener("resize", resize);
    resize();
    var host = window.document.location.host.replace(/:.*/, '');
    var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
    client.joinOrCreate("simulation").then(room => {

        // On startup, add the menu and draw the map (if present)
        room.onStateChange.once(function (state: any) {
            console.log("initial room state:", state);
            if (state.map.width) display.drawMap(state.map);

            ReactDOM.render(<SimulationMenu room={room}></SimulationMenu>, document.getElementById("root"))
        });

        // On subsequent updates, refresh the map
        room.onStateChange(function (state: any) {
            if (state.map.width) display.drawMap(state.map);
        });

        // Any messages sent from the server will be received here.
        room.onMessage(function (message) {
        });

    });
}