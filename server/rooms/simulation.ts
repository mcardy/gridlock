import { Room, Delayed, Client } from 'colyseus';
import { Schema, ArraySchema, type } from '@colyseus/schema';
import { Random, MersenneTwister19937 } from 'random-js';

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

class Location extends Schema {
    @type('number')
    x: number
    @type('number')
    y: number

    public constructor(init?: Partial<Location>) {
        super();
        Object.assign(this, init);
    }
}

class Vertex extends Schema {
    @type(Location)
    location: Location
    @type('number')
    id: number
    @type('boolean')
    source: boolean
    @type('boolean')
    dest: boolean

    public constructor(init?: Partial<Vertex>) {
        super();
        Object.assign(this, init);
    }
}

class Edge extends Schema {
    @type(Vertex)
    source: Vertex
    @type(Vertex)
    dest: Vertex
    @type('boolean')
    invert: boolean = false

    // This will eventually contain priorities and timings

    public constructor(init?: Partial<Edge>) {
        super();
        Object.assign(this, init);
    }
}

class Intersection extends Schema {
    @type([Vertex])
    vertices: Vertex[] = new ArraySchema<Vertex>()
    @type(['number'])
    timings: number[] = new ArraySchema<number>()
}

class Map extends Schema {
    @type('number')
    width: number
    @type('number')
    height: number
    @type([Vertex])
    vertices: Vertex[] = new ArraySchema<Vertex>()
    @type([Edge])
    edges: Edge[] = new ArraySchema<Edge>()
    @type([Intersection])
    intersections: Intersection[] = new ArraySchema<Intersection>()

    public findVertexById(id: number): Vertex {
        for (const vertex of this.vertices) {
            if (vertex.id == id) {
                return vertex;
            }
        }
        return null;
    }
}

class Agent extends Schema {
    @type(Location)
    location: Location
    @type("number")
    edge: number
}

class SimulationState extends Schema {
    @type(Map)
    map: Map;
    @type(["number"])
    sources: number[] = new ArraySchema<number>();
    @type(["number"])
    destinations: number[] = new ArraySchema<number>();
    @type([Agent])
    agents: Agent[] = new ArraySchema<Agent>();
    @type('boolean')
    paused: boolean;
}

export class Simulation extends Room<SimulationState> {
    random: Random;
    //map: object;
    spawnCounter: number;

    onCreate(options) {
        this.setState(new SimulationState());
        console.log("BasicRoom created!", options);

        // Seed the random with a seed
        var seed = 11234071749817;
        this.random = new Random(MersenneTwister19937.seed(11234071749817))
        this.spawnCounter = 0;

        this.processMap(testMap);
        this.clock.setInterval(updateAgents, 50, this);
    }

    processMap(map) {
        var mapObject = JSON.parse(map)
        this.state.map = new Map();
        this.state.map.width = mapObject.width;
        this.state.map.height = mapObject.height;
        for (let vertexObject of mapObject["vertices"]) {
            if (vertexObject["source"] == true) {
                this.state.sources.push(vertexObject["id"]);
            } else if (vertexObject["dest"] == true) {
                this.state.destinations.push(vertexObject["id"]);
            }
            this.state.map.vertices.push(new Vertex({
                dest: vertexObject["dest"] == true,
                source: vertexObject["source"] == true,
                location: new Location({
                    x: +vertexObject["location"]["x"],
                    y: +vertexObject["location"]["y"]
                }),
                id: +vertexObject["id"]
            }));
        }
        for (let edgeObject of mapObject["edges"]) {
            this.state.map.edges.push(new Edge({
                source: this.state.map.findVertexById(+edgeObject["source"]),
                dest: this.state.map.findVertexById(+edgeObject["dest"])
            }));
        }
        for (const intersectionObject of mapObject["intersections"]) {
            var intersection = new Intersection();
            for (var i: number = 0; i < this.state.map.vertices.length; i++) {
                var vertex = this.state.map.vertices[i];
                if (intersectionObject["vertices"].indexOf(vertex.id) >= 0) {
                    intersection.vertices.push(vertex);
                }
            }
            for (let timing of intersectionObject["timings"]) {
                intersection.timings.push(+timing);
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
        }
        //console.log("BasicRoom received message from", client.sessionId, ":", data);
        //this.broadcast(`(${client.sessionId}) ${data.message}`);
    }

    onDispose() {
        console.log("Dispose BasicRoom");
    }
}

function updateAgents(that: Simulation) {
    if (!that.state.paused) {
        if (that.spawnCounter == 40) {
            that.spawnCounter = 0;
            var sourceId = that.state.sources[that.random.integer(0, that.state.sources.length - 1)];
            var source = that.state.map["vertices"].find(function (vertex) { return vertex["id"] == sourceId; });

            var location = new Location();
            location.x = source["location"]["x"];
            location.y = source["location"]["y"];

            var agent = new Agent();
            agent.location = location;

            that.state.agents.push(agent);
        }
        that.state.agents.forEach(function (agent) {
            agent.location.x = agent.location.x + 1;
        })
        that.spawnCounter = that.spawnCounter + 1;
    }
}
