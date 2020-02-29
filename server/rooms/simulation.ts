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
}

export class Simulation extends Room<SimulationState> {
    random: Random; // Random created for each map, server side property
    spawnRate: number;

    // Constant tick rate
    static readonly TICK_RATE: number = 100;


    onCreate(options) {
        console.log("Simulation room created!", options);
        this.setState(new SimulationState());
        //this.processMap(JSON.stringify(testMap4));
        this.setSimulationInterval((delta) => this.update(delta), 1000 / (this.state.simulationSpeed * Simulation.TICK_RATE));
    }

    processMap(map) {
        this.state.paused = true;
        var mapObject = JSON.parse(map)

        this.random = new Random(MersenneTwister19937.seed(mapObject.seed))
        this.state.metrics = new Metrics();
        this.spawnRate = "spawn_rate" in mapObject ? mapObject.spawn_rate : 5;

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
                    e1.intersectPoints.push(new EdgeIntersect({ edge: e2, point: ip }));
                    e2.intersectPoints.push(new EdgeIntersect({ edge: e1, point: ip }));
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
        //this.state.paused = false;
    }

    update(delta) {
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
                            edge.currentPriority = +edge.priorities[nextIndex];
                        }
                    }
                }
            }
            if (this.spawnRate != 0 && this.state.metrics.totalTicks % Math.round(Simulation.TICK_RATE / this.spawnRate) == 0) {
                var sourceId = this.state.map.sources[this.random.integer(0, this.state.map.sources.length - 1)];
                var source = this.state.map.findVertexById(sourceId);
                var destinations = this.state.map.getAssignableDestinations(source);
                var dest = destinations[this.random.integer(0, destinations.length - 1)];

                var agent = new Agent(source, dest, this.state.map, this.random.real(0.9, 1.1));
                this.state.metrics.spawned = this.state.metrics.spawned + 1;
                this.state.map.agents.push(agent);
            }
            this.state.map.agents.forEach(function (agent) {
                agent.update();
            });
            for (agent of this.state.map.agents.filter(function (agent) { return agent.shouldDespawn() })) {
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
        } else if (data.command = 'setSimulationSpeed') {
            this.state.simulationSpeed = +data.speed;
            this.setSimulationInterval((delta) => this.update(delta), 1000 / (this.state.simulationSpeed * Simulation.TICK_RATE));
        }
    }

    onDispose() {
        console.log("Simulation room destroyed");
    }
}


