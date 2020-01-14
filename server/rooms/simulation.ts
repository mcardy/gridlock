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
    @type('number')
    length: number = 0

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
        return this.vertices.find(function (vertex) { return vertex.id == id });
    }

    public findOutgoingEdge(vertex: Vertex): Edge {
        return this.edges.find(function (edge) { return edge.source == vertex });
    }
}

class Agent extends Schema {
    @type(Vertex)
    source: Vertex
    @type(Vertex)
    dest: Vertex
    @type(Location)
    location: Location
    @type(Edge)
    edge: Edge
    @type('number')
    t: number
    @type('number')
    speed: number = 1

    public shouldDespawn(): boolean {
        return this.edge == undefined || (this.location.x == this.dest.location.x && this.location.y == this.dest.location.y);
    }
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

        this.processMap(testMap2);
        this.clock.setInterval(updateAgents, 20, this);
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
            var edge = new Edge({
                source: this.state.map.findVertexById(+edgeObject["source"]),
                dest: this.state.map.findVertexById(+edgeObject["dest"])
            });
            this.state.map.edges.push(edge);
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
            var source = that.state.map.findVertexById(sourceId);
            var destId = that.state.destinations[that.random.integer(0, that.state.destinations.length - 1)];
            var dest = that.state.map.findVertexById(destId);

            var location = new Location();
            location.x = source.location.x;
            location.y = source.location.y;

            var agent = new Agent();
            agent.location = location;
            agent.edge = that.state.map.findOutgoingEdge(source);
            agent.source = source;
            agent.dest = dest;

            that.state.agents.push(agent);
        }
        that.state.agents.forEach(function (agent) {
            if (agent.edge == undefined) return;
            var l1 = agent.edge.source.location;
            var l2 = agent.edge.dest.location;
            if (l1.x == l2.x) {
                // Linear in x
                agent.location.y += (l1.y < l2.y ? 1 : -1) * agent.speed;
            } else if (l1.y == l2.y) {
                // Linear in y
                agent.location.x += (l1.x < l2.x ? 1 : -1) * agent.speed;
            } else {
                // Quadratic Bezier Curve, calculate differences in each direction normalized to the origin
                /*var tx = agent.location.x - l1.x;
                var ty = agent.location.y - l2.x;
                var xctl = agent.edge.invert ? l1.x : l2.x;
                var yctl = agent.edge.invert ? l2.y : l1.y;
                var ux = 2 * l1.x - 4 * xctl + 2 * l2.x;
                var uy = 2 * l1.y - 4 * yctl + 2 * l2.y;
                var vx = 2 * xctl - 2 * l1.x;
                var vy = 2 * yctl - 2 * l1.y;
                var wx = tx * ux + vx;
                var wy = ty * uy + vy;
                var lx = 100 / wx;
                var ly = 100 / wy;
                console.log(lx, ly);
                agent.location.x += lx;
                agent.location.y += ly;*/
                var xctl = agent.edge.invert ? l1.x : l2.x;
                var yctl = agent.edge.invert ? l2.y : l1.y;

                // TODO move based on constant distance travelled rather than constant 'speed' and from a position rather than with 't'
                agent.t += agent.speed;
                var len = curveLength(l1, new Location({ x: xctl, y: yctl }), l2);
                var t = agent.t / len;
                var x, y;
                if (t >= 1) {
                    x = l2.x;
                    y = l2.y;
                } else {
                    x = (1 - t) * (1 - t) * l1.x + 2 * (1 - t) * t * xctl + t * t * l2.x;
                    y = (1 - t) * (1 - t) * l1.y + 2 * (1 - t) * t * yctl + t * t * l2.y;
                }
                agent.location.x = x;
                agent.location.y = y;
            }
            if (agent.location.x == agent.edge.dest.location.x && agent.location.y == agent.edge.dest.location.y) {
                agent.edge = that.state.map.findOutgoingEdge(agent.edge.dest);
                agent.t = 0;
            }
        });
        that.spawnCounter = that.spawnCounter + 1;
        for (agent of that.state.agents.filter(function (agent) { return agent.shouldDespawn() })) {
            that.state.agents.splice(that.state.agents.indexOf(agent), 1);
        }
    }
}

function curveLength(p0, p1, p2) {
    var a = new Location();
    var b = new Location();
    a.x = p0.x - 2 * p1.x + p2.x;
    a.y = p0.y - 2 * p1.y + p2.y;
    b.x = 2 * p1.x - 2 * p0.x;
    b.y = 2 * p1.y - 2 * p0.y;
    var A = 4 * (a.x * a.x + a.y * a.y);
    var B = 4 * (a.x * b.x + a.y * b.y);
    var C = b.x * b.x + b.y * b.y;

    var Sabc = 2 * Math.sqrt(A + B + C);
    var A_2 = Math.sqrt(A);
    var A_32 = 2 * A * A_2;
    var C_2 = 2 * Math.sqrt(C);
    var BA = B / A_2;

    return (A_32 * Sabc +
        A_2 * B * (Sabc - C_2) +
        (4 * C * A - B * B) * Math.log((2 * A_2 + BA + Sabc) / (BA + C_2))
    ) / (4 * A_32);
}


