import { Vertex, Map, Edge, Intersection, EdgeIntersect } from '../map';
import { Agent } from '../agent'
import { Point2D, BezierCurve } from '../../common/math';
import { Room, Delayed, Client } from 'colyseus';
import { Random, MersenneTwister19937 } from 'random-js';
import { Schema, ArraySchema, type } from '@colyseus/schema';

class Metrics extends Schema {
    @type('number')
    throughput: number = 0;
    @type('number')
    totalTicks: number = 0;
    @type('number')
    spawned: number = 0;
    @type('number')
    throughputPerUnitTime: number = 0;
    @type('number')
    averageTripLength: number = 0;
    @type('number')
    averageSpeed: number = 0;
}

class SimulationState extends Schema {
    @type(Map)
    map: Map;
    @type('boolean')
    paused: boolean = true;
    @type('number')
    simulationSpeed: number = 0.25;
    @type(Metrics)
    metrics: Metrics;
    @type('number')
    tickTarget: number;
}

export class Simulation extends Room<SimulationState> {
    random: Random; // Random created for each map, server side property
    spawnRate: number;
    rawMap: any;

    // Constant tick rate of 100 per unit time
    static readonly TICK_RATE: number = 100;


    onCreate(options) {
        console.log("Simulation room created!", options);
        this.setState(new SimulationState());
        //this.processMap(JSON.stringify(testMap4));
        this.setSimulationInterval((delta) => this.update(delta), 1000 / (this.state.simulationSpeed * Simulation.TICK_RATE));
    }

    resetMap() {
        this.state.paused = true;
        Agent.nextID = 0;
        this.random = new Random(MersenneTwister19937.seed(this.rawMap.seed))
        this.state.metrics = new Metrics();
        this.spawnRate = "spawn_rate" in this.rawMap ? this.rawMap.spawn_rate : 5;
        this.state.map.agents = new ArraySchema<Agent>();
    }

    processMap(map) {
        // Load new map
        var mapObject = JSON.parse(map)
        this.rawMap = mapObject;

        // Load map into state
        this.state.map = new Map();
        this.state.map.width = mapObject.width;
        this.state.map.height = mapObject.height;
        for (let vertexObject of mapObject["vertices"]) {
            if (vertexObject["source"] == true) {
                this.state.map.sources.push(vertexObject["id"]);
            } else if (vertexObject["dest"] == true) {
                this.state.map.destinations.push(vertexObject["id"]);
            }
            this.state.map.vertices.push(new Vertex({
                dest: vertexObject["dest"] == true,
                source: vertexObject["source"] == true,
                location: new Point2D({
                    x: +vertexObject["location"]["x"],
                    y: +vertexObject["location"]["y"]
                }),
                id: +vertexObject["id"]
            }));
        }
        for (let edgeObject of mapObject["edges"]) {
            var priorities = undefined;
            if ('priorities' in edgeObject) {
                priorities = new ArraySchema<number>();
                for (var priority of edgeObject.priorities) {
                    priorities.push(priority);
                }
            }
            var edge = new Edge(
                this.state.map.findVertexById(+edgeObject["source"]),
                this.state.map.findVertexById(+edgeObject["dest"]),
                'invert' in edgeObject && edgeObject.invert == true,
                priorities,
                edgeObject["ctrlX"],
                edgeObject["ctrlY"],
                edgeObject["speed"]
            );
            this.state.map.edges.push(edge);
        }
        for (let i = 0; i < this.state.map.edges.length; i++) {
            var e1 = this.state.map.edges[i];
            for (let j = i + 1; j < this.state.map.edges.length; j++) {
                var e2 = this.state.map.edges[j];

                var ip = e1.calculateIntersection(e2);
                if (ip != undefined) {
                    e1.intersectPoints.push(new EdgeIntersect({ edge: e2, sourceEdge: e1, point: ip }));
                    e2.intersectPoints.push(new EdgeIntersect({ edge: e1, sourceEdge: e2, point: ip }));
                }
            }
        }
        for (const intersectionObject of mapObject["intersections"]) {
            var intersection = new Intersection();
            for (var id of intersectionObject.vertexIds) {
                intersection.vertexIds.push(id);
                intersection.vertices.push(this.state.map.findVertexById(id));
            }
            for (let timing of intersectionObject["timings"]) {
                intersection.timings.push(+timing);
            }
            for (var i: number = 0; i < this.state.map.edges.length; i++) {
                var edge = this.state.map.edges[i];
                if (intersection.vertexIds.indexOf(edge.sourceVertex.id) >= 0 && intersection.vertexIds.indexOf(edge.destVertex.id) >= 0) {
                    intersection.edges.push(edge);
                    if (edge.priorities == undefined)
                        throw new Error("No priorities defined for edge as part of intersection...");
                    if (edge.priorities.length != intersection.timings.length)
                        throw new Error("Priorities list was not expected length on edge...")
                    edge.currentPriority = edge.priorities[0];
                }
            }
            this.state.map.intersections.push(intersection);
        }

        this.resetMap(); // Reset map
    }

    update(delta) {
        if (this.state.tickTarget != undefined && this.state.metrics.totalTicks >= this.state.tickTarget) {
            this.state.tickTarget = undefined;
            this.state.paused = true;
        }
        if (!this.state.paused) {
            this.state.metrics.totalTicks = this.state.metrics.totalTicks + 1;
            this.state.metrics.throughputPerUnitTime = this.state.metrics.throughput / this.state.metrics.totalTicks;
            if (this.state.metrics.totalTicks % Simulation.TICK_RATE == 0) {
                for (var intersection of this.state.map.intersections) {
                    intersection.currentTime++;
                    if (intersection.currentTime == intersection.timings[intersection.currentIndex]) {
                        intersection.currentTime = 0;
                        var nextIndex = (intersection.currentIndex + 1) % intersection.timings.length;
                        intersection.currentIndex = nextIndex;
                        for (var edge of intersection.edges) {
                            edge.lastPriority = edge.currentPriority;
                            edge.currentPriority = +edge.priorities[nextIndex];
                        }
                    }
                }
            }
            if (this.spawnRate != 0 && this.state.metrics.totalTicks % Math.round(Simulation.TICK_RATE / this.spawnRate) == 0) {
                var sourceId = this.state.map.sources[this.random.integer(0, this.state.map.sources.length - 1)];
                var source = this.state.map.findVertexById(sourceId);
                var destinations = [];
                for (var d of this.state.map.getAssignableDestinations(source)) {
                    if (d.location.distance(source.location) > 20) {
                        destinations.push(d);
                    }
                }

                var dest = destinations[this.random.integer(0, destinations.length - 1)];

                var agent = new Agent(source, dest, this.state.map, this.random.real(0.9, 1.1));
                this.state.metrics.spawned = this.state.metrics.spawned + 1;
                this.state.map.agents.push(agent);
            }
            var speed = 0;
            for (var agent of this.state.map.agents) {
                agent.update();
                speed += agent.speed;
            }
            if (this.state.map.agents.length != 0)
                speed = speed / this.state.map.agents.length;
            this.state.metrics.averageSpeed = ((this.state.metrics.totalTicks - 1) * this.state.metrics.averageSpeed + speed) / (this.state.metrics.totalTicks);

            for (var agent of this.state.map.agents.filter(function (agent) { return agent.shouldDespawn() })) {
                var tripLength = this.state.metrics.totalTicks - agent.id * Math.round(Simulation.TICK_RATE / this.spawnRate);
                this.state.metrics.averageTripLength = (this.state.metrics.throughput * this.state.metrics.averageTripLength + tripLength) / (this.state.metrics.throughput + 1);
                this.state.metrics.throughput = this.state.metrics.throughput + 1;
                this.state.map.agents.splice(this.state.map.agents.indexOf(agent), 1);
            }
        }
    }

    onJoin(client) {
        //this.sendState(client)

        //this.send(client, testMap);
        //this.broadcast(`${client.sessionId} joined.`);
    }

    onLeave(client) {
        this.broadcast(`${client.sessionId} left.`);
    }

    onMessage(client, data) {
        if (data.command == 'pause' && !this.state.paused) {
            this.state.paused = true && this.state.map != undefined && this.state.map.agents != undefined;
        } else if (data.command == 'unpause' && this.state.paused) {
            this.state.paused = !(this.state.map != undefined && this.state.map.agents != undefined);
        } else if (data.command == 'setmap') {
            this.processMap(data.map);
        } else if (data.command == 'setSimulationSpeed') {
            this.state.simulationSpeed = +data.speed;
            this.setSimulationInterval((delta) => this.update(delta), 1000 / (this.state.simulationSpeed * Simulation.TICK_RATE));
        } else if (data.command == 'setTickTarget') {
            this.state.tickTarget = data.tickTarget != undefined && data.tickTarget != "" ? +data.tickTarget : undefined;
        } else if (data.command == 'setSeed') {
            this.rawMap.seed = +data.seed;
            this.resetMap();
        } else if (data.command == 'reset') {
            this.resetMap();
        }
    }

    onDispose() {
        console.log("Simulation room destroyed");
    }
}


