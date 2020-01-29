import { Vertex, Map, Edge, Intersection, EdgeIntersect } from '../map';
import { Agent } from '../agent'
import { Point2D, BezierCurve } from '../../common/math';
import { Mutex } from '../mutex';
import { Room, Delayed, Client } from 'colyseus';
import { Random, MersenneTwister19937 } from 'random-js';
import { Schema, ArraySchema, type } from '@colyseus/schema';

const testMap = '{"seed":11234071749817,"width":400,"height":400,\
"vertices":[{"id":1,"location":{"x":100,"y":100}},{"id":2,"location":{"x":200,"y":100}},\
            {"id":3,"location":{"x":150,"y":50}},{"id":4,"location":{"x":150,"y":150}},\
            {"id":5,"location":{"x":0,"y":100},"source":true},{"id":6,"location":{"x":150,"y":0},"source":true},\
            {"id":7,"location":{"x":400,"y":100},"dest":true},{"id":8,"location":{"x":150,"y":400},"dest":true}],\
"edges":[{"source":1,"dest":2},{"source":3,"dest":4},{"source":5,"dest":1},{"source":6,"dest":3},{"source":2,"dest":7},{"source":4,"dest":8}],\
"intersections":[{"vertices":[1,2,3,4],"timings":[5,1]}]\
}';

const testMap2 = '{"seed":11234071749817,"width":400,"height":400,\
"vertices":[{"id":1,"location":{"x":100,"y":100}},{"id":4,"location":{"x":150,"y":150}},\
            {"id":5,"location":{"x":0,"y":100},"source":true},{"id":8,"location":{"x":150,"y":400},"dest":true}],\
"edges":[{"source":5,"dest":1},{"source":1,"dest":4},{"source":4,"dest":8}],\
"intersections":[{"vertices":[1,2,3,4],"timings":[5,1]}]\
}';

const testMap3 = '{"seed":11234071749817,"width":400,"height":400,\
"vertices":[{"id":1,"location":{"x":100,"y":100}},{"id":2,"location":{"x":200,"y":100}},\
            {"id":5,"location":{"x":0,"y":100},"source":true},\
            {"id":7,"location":{"x":400,"y":100},"dest":true}],\
"edges":[{"source":1,"dest":2},{"source":5,"dest":1},{"source":2,"dest":7}],\
"intersections":[{"vertices":[1,2,3,4],"timings":[5,1]}]\
}';

const testMap4 = {
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

class SimulationState extends Schema {
    @type(Map)
    map: Map;
    @type('boolean')
    paused: boolean = true;
}

export class Simulation extends Room<SimulationState> {
    random: Random;
    tickCounter: number;
    spawnRate: number = 5;
    tickRate: number = 100;
    simulationSpeed: number = 0.25;


    onCreate(options) {
        console.log("Simulation room created!", options);
        this.processMap(JSON.stringify(testMap4));
        this.setSimulationInterval((delta) => this.update(delta), 1000 / (this.simulationSpeed * this.tickRate))
    }

    processMap(map) {
        this.setState(new SimulationState());
        var mapObject = JSON.parse(map)

        this.random = new Random(MersenneTwister19937.seed(mapObject.seed))
        this.tickCounter = 0;

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
                edgeObject["ctrlY"]
            );
            this.state.map.edges.push(edge);
        }
        for (let i = 0; i < this.state.map.edges.length; i++) {
            var e1 = this.state.map.edges[i];
            for (let j = i + 1; j < this.state.map.edges.length; j++) {
                var e2 = this.state.map.edges[j];

                var ip = e1.calculateIntersection(e2);
                if (intersection != undefined) {
                    var mutex = new Mutex<Agent>(); // The two intersection points share a mutex, this will change...
                    e1.intersectPoints.push(new EdgeIntersect({ edge: e2, point: ip, lock: mutex }));
                    e2.intersectPoints.push(new EdgeIntersect({ edge: e1, point: ip, lock: mutex }));
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
        this.state.paused = false;
    }

    update(delta) {
        if (!this.state.paused) {
            this.tickCounter = this.tickCounter + 1;
            if (this.tickCounter % this.tickRate == 0) {
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
            if (this.spawnRate != 0 && this.tickCounter % Math.round(this.tickRate / this.spawnRate) == 0) {
                var sourceId = this.state.map.sources[this.random.integer(0, this.state.map.sources.length - 1)];
                var source = this.state.map.findVertexById(sourceId);
                var destinations = this.state.map.getAssignableDestinations(source);
                var dest = destinations[this.random.integer(0, destinations.length - 1)];

                var agent = new Agent(source, dest, this.state.map);
                this.state.map.agents.push(agent);
            }
            this.state.map.agents.forEach(function (agent) {
                agent.update();
            });
            for (agent of this.state.map.agents.filter(function (agent) { return agent.shouldDespawn() })) {
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
        if (data.command == 'pause') {
            this.state.paused = true;
        } else if (data.command == 'unpause') {
            this.state.paused = false;
        } else if (data.command == 'setmap') {
            this.processMap(data.map);
        }
        //console.log("BasicRoom received message from", client.sessionId, ":", data);
        //this.broadcast(`(${client.sessionId}) ${data.message}`);
    }

    onDispose() {
        console.log("Simulation room destroyed");
    }
}


