import { Schema, ArraySchema, type } from '@colyseus/schema';
import { Point2D, BezierCurve, EvaluatablePath, StraightLine } from '../common/math';
import { Agent } from './agent'

export class Vertex extends Schema {
    @type(Point2D)
    readonly location: Point2D
    @type('number')
    readonly id: number
    @type('boolean')
    readonly source: boolean
    @type('boolean')
    readonly dest: boolean

    public constructor(init?: Partial<Vertex>) {
        super();
        Object.assign(this, init);
    }
}

export class EdgeIntersect {
    // The edge that the intersect was returned from
    sourceEdge: Edge
    // the edge that sourceEdge intersects with
    edge: Edge
    // The point of intersection
    point: Point2D

    public constructor(init?: Partial<EdgeIntersect>) {
        Object.assign(this, init);
    }
}

export class Edge extends Schema {
    @type('number')
    readonly source: number;
    @type('number')
    readonly dest: number;

    @type('boolean')
    readonly invert: boolean = false;
    @type(['number'])
    readonly priorities: number[]
    @type('number')
    readonly ctrlX: number = undefined;
    @type('number')
    readonly ctrlY: number = undefined;

    @type('number')
    readonly speed: number = 60;
    @type('boolean')
    readonly stopOnRed: boolean = true;

    readonly sourceVertex: Vertex
    readonly destVertex: Vertex

    curve: EvaluatablePath

    // Derived/mutable parameters
    @type('number')
    length: number = 0
    @type('number')
    currentPriority: number = 1;

    lastPriority: number = 0;

    // Server side properties
    intersectPoints: EdgeIntersect[]

    lane: Lane

    public constructor(source: Vertex, dest: Vertex, invert: boolean, priorities?: number[], ctrlX?: number, ctrlY?: number, speed?: number, stopOnRed?: boolean) {
        super();
        this.source = source.id;
        this.dest = dest.id;
        this.sourceVertex = source;
        this.destVertex = dest;
        this.invert = invert;
        if (speed != undefined)
            this.speed = speed;
        if (stopOnRed != undefined) {
            this.stopOnRed = stopOnRed;
        }
        this.length = this.calculateLength();
        if (priorities !== undefined && priorities.length > 0) {
            this.priorities = priorities;
            this.currentPriority = priorities[0];
        }
        this.intersectPoints = [];
        this.ctrlX = ctrlX;
        this.ctrlY = ctrlY;
        if (this.sourceVertex.location.x == this.destVertex.location.x || this.sourceVertex.location.y == this.destVertex.location.y) {
            this.curve = new StraightLine(this.sourceVertex.location, this.destVertex.location);
        } else {
            this.curve = new BezierCurve(this.sourceVertex.location, this.destVertex.location, this.invert, this.ctrlX != undefined && this.ctrlY != undefined ?
                new Point2D({ x: this.ctrlX, y: this.ctrlY }) : undefined);
        }
    }

    public intersectsWith(edge: Edge): EdgeIntersect {
        // Currently, the approximation is using linear segments, will expand to bezier curves in the future
        return this.intersectPoints.find(function (ei) { return ei.edge == edge; });
    }

    public getControlPoint(): Point2D {
        return this.ctrlX != undefined && this.ctrlY != undefined ? new Point2D({ x: this.ctrlX, y: this.ctrlY }) : undefined;
    }

    public calculateIntersection(edge: Edge): Point2D {
        if (edge.sourceVertex == this.destVertex || edge.destVertex == this.sourceVertex || edge.sourceVertex == this.sourceVertex || edge.destVertex == this.destVertex) return undefined;
        var p: Point2D = new Point2D(this.sourceVertex.location);
        var r: Point2D = this.destVertex.location.minus(p);
        var q: Point2D = new Point2D(edge.sourceVertex.location);
        var s: Point2D = edge.destVertex.location.minus(q);
        // TODO find a better aproximation for intersections such as convex hull
        if (r.cross(s) != 0) {
            var t = q.minus(p).cross(s) / r.cross(s);
            var u = q.minus(p).cross(r) / r.cross(s);
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                // Edge intersects linearly
                if (this.isLinear() && edge.isLinear()) {
                    return p.plus(r.times(t));
                } else if (this.isLinear() || edge.isLinear()) {
                    var linearEdge = this.isLinear() ? this : edge;
                    var bezierEdge = linearEdge == this ? edge : this;
                    var bezierPath = new BezierCurve(new Point2D(bezierEdge.sourceVertex.location), new Point2D(bezierEdge.destVertex.location), bezierEdge.invert, bezierEdge.getControlPoint());
                    var bezierInterval = 0.5;
                    var p = new Point2D(linearEdge.sourceVertex.location);
                    var r = new Point2D(linearEdge.destVertex.location.minus(p));
                    var p1 = new Point2D(bezierEdge.sourceVertex.location);
                    var p2 = new Point2D(bezierEdge.destVertex.location);
                    for (var k = 2; k < 40; k++) {
                        var midpoint = bezierPath.evaluate(bezierInterval);
                        var s1 = midpoint.minus(p1);
                        var s2 = midpoint.minus(p2);
                        // Calculate intersection points
                        var t1 = p1.minus(p).cross(s1) / r.cross(s1);
                        var u1 = p1.minus(p).cross(r) / r.cross(s1);
                        // Two lines
                        var t2 = p2.minus(p).cross(s2) / r.cross(s2);
                        var u2 = p2.minus(p).cross(r) / r.cross(s2);
                        //console.log(t1 + " " + u1 + "  -  " + t2 + " " + u2);
                        if (r.cross(s1) != 0 && t1 >= 0 && t1 <= 1 && u1 >= 0 && u1 <= 1) {
                            bezierInterval -= 1 / Math.pow(2, k);
                            p2 = midpoint;
                        } else if (r.cross(s2) != 0 && t2 >= 0 && t2 <= 1 && u2 >= 0 && u2 <= 1) {
                            bezierInterval += 1 / Math.pow(2, k);
                            p1 = midpoint;
                        } else {
                            throw new Error("Failed to find intersection point on two edges " + JSON.stringify(linearEdge) + " and " + JSON.stringify(bezierEdge));
                        }
                    }
                    var ip = bezierPath.evaluate(bezierInterval);
                    return ip;
                } else {
                    return undefined;
                }
            }
        }
    }

    private calculateLength(): number {
        var source: Point2D = new Point2D(this.sourceVertex.location);
        var dest: Point2D = new Point2D(this.destVertex.location);
        if ((source.x == dest.x || source.y == dest.y) && this.getControlPoint() == undefined) {
            return source.distance(dest);
        } else {
            var step = 0.01;
            var distance = 0;
            var bezierCurve = new BezierCurve(source, dest, this.invert, this.getControlPoint());
            var lastPoint = source;
            for (var t = step; t <= 1; t += step) {
                var nextPoint = bezierCurve.evaluate(t);
                distance += lastPoint.distance(nextPoint);
                lastPoint = nextPoint;
            }
            return distance;
        }
    }

    public isLinear(): boolean {
        return this.sourceVertex.location.x == this.destVertex.location.x || this.sourceVertex.location.y == this.destVertex.location.y;
    }
}

export class Intersection extends Schema {
    @type(['number'])
    vertexIds: number[] = new ArraySchema<number>()
    @type(['number'])
    timings: number[] = new ArraySchema<number>()

    // Derived/mutable properties
    @type('number')
    currentIndex: number = 0;
    @type('number')
    currentTime: number = 0;

    vertices: Vertex[] = new ArraySchema<Vertex>()
    edges: Edge[] = new ArraySchema<Edge>()
}

export class LaneEntry extends Schema {
    @type('number')
    source: number
    @type('number')
    dest: number

    edge: Edge
}

export class Lane extends Schema {
    @type([LaneEntry])
    entries: LaneEntry[] = new ArraySchema<LaneEntry>();
}

export interface PathSegment {
    getEphemeralEdge(): Edge;
}

export class LaneChangePathSegment implements PathSegment {
    entryEdge: Edge;
    exitEdge: Edge;
    entryPoint: number;
    exitPoint: number;

    private ephemeralEdge = undefined;

    constructor(entryEdge: Edge, exitEdge: Edge) {
        this.entryEdge = entryEdge;
        this.exitEdge = exitEdge;
        this.entryPoint = 0.9;
        this.exitPoint = 1;
    }

    setPoints(entryPoint: number, exitPoint: number) {
        this.entryPoint = entryPoint;
        this.exitPoint = exitPoint;
        this.setEphemeralEdge();
    }

    getEphemeralEdge(): Edge {
        if (this.ephemeralEdge == undefined) {
            this.setEphemeralEdge();
        }
        return this.ephemeralEdge;
    }

    private setEphemeralEdge() {
        this.ephemeralEdge = new Edge(new Vertex({ location: this.entryEdge.curve.evaluate(this.entryPoint) }),
            new Vertex({ location: this.exitEdge.curve.evaluate(this.exitPoint) }), false, [0.1], undefined, undefined, this.exitEdge.speed);
        this.ephemeralEdge.curve = new StraightLine(this.ephemeralEdge.sourceVertex.location, this.ephemeralEdge.destVertex.location);
    }

}

export class EdgePathSegment implements PathSegment {
    edge: Edge;

    constructor(edge: Edge) {
        this.edge = edge;
    }

    getEphemeralEdge(): Edge {
        return this.edge;
    }
}

export class Map extends Schema {
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
    @type([Agent])
    agents: Agent[] = new ArraySchema<Agent>();
    @type([Lane])
    lanes: Lane[] = new ArraySchema<Lane>();

    sources: number[] = new ArraySchema<number>();
    destinations: number[] = new ArraySchema<number>();

    public findVertexById(id: number): Vertex {
        return this.vertices.find(function (vertex) { return vertex.id == id });
    }

    public findOutgoingEdge(vertex: Vertex): Edge {
        return this.edges.find(function (edge) { return edge.sourceVertex == vertex });
    }

    public getAssignableDestinations(source: Vertex): Vertex[] {
        var destinations: Vertex[] = new ArraySchema<Vertex>();
        var adjacencyList = this.getAdjacencyList();
        var visited: Vertex[] = [];
        var next: Vertex[] = [source];
        while (next.length != 0) {
            var current = next.splice(0, 1)[0];
            if (visited.indexOf(current) >= 0) continue;
            visited.push(current);
            if (current.dest) destinations.push(current);
            if (current.id in adjacencyList) {
                for (var entry of adjacencyList[current.id]) {
                    var edge = entry.edge;
                    next.push(edge.destVertex);
                    if (edge.lane != undefined) {
                        for (var lane of edge.lane.entries) {
                            next.push(lane.edge.destVertex);
                        }
                    }
                }
            }
        }
        return destinations;
    }

    /**
     * Returns a path in stack order from source to destination
     * For example, if source is 1 and dest is 3 and they are linked by vertex 2, the
     * resulting array will be [3,2,1], ie. the last item will be the source.
     * 
     * Uses an adaptation of dijkstra's algorithm
     * @param source 
     * @param dest 
     */
    public getBestPath(source: Vertex, dest: Vertex): PathSegment[] {
        var adjacencyList = this.getAdjacencyList();

        // Initialization
        var queue: Vertex[] = [];
        var parent: { [id: number]: Vertex } = {};
        var distance: { [id: number]: number; } = {};
        for (var vertex of this.vertices) {
            queue.push(vertex);
            parent[vertex.id] = undefined;
            distance[vertex.id] = Infinity;
        }

        // Start with source
        distance[source.id] = 0;
        while (queue.length > 0) {
            // Find unvisited vertex with minimum weight
            var vertex: Vertex = undefined;
            for (var v of queue)
                if (vertex == undefined || distance[v.id] < distance[vertex.id]) vertex = v;

            if (vertex == dest) break; // If we have reached the destination, terminate dijkstra's algorithm

            queue.splice(queue.indexOf(vertex), 1); // Remove vertex from list
            if (!(vertex.id in adjacencyList)) continue; // Make sure we are part of adjacency list

            // Find the neighbours. Lane changes count as neighbours
            var neighbours: { id: number, weight: number }[] = [];
            for (var entry of adjacencyList[vertex.id]) {
                neighbours.push({ id: entry.edge.dest, weight: entry.weight });
                if (entry.edge.lane != undefined) {
                    for (let lane of entry.edge.lane.entries) {
                        if (lane.edge != entry.edge) {
                            // If lane change, set weight as minimum of the two edges
                            var otherWeight = adjacencyList[lane.edge.source].find(a => a.edge == lane.edge).weight;
                            neighbours.push({ id: lane.edge.dest, weight: Math.min(entry.weight, otherWeight) });
                        }
                    }
                }
            }

            // For each neighbour, update distances and parent if needed
            for (var neighbour of neighbours) {
                var d = distance[vertex.id] + neighbour.weight;
                if (d < distance[neighbour.id]) {
                    distance[neighbour.id] = d;
                    parent[neighbour.id] = vertex;
                }
            }
        }

        // Path in stack order
        var path: PathSegment[] = [];

        // From the destination to the source, build a path with path segments
        var current = dest;
        var p = undefined;
        while ((p = parent[current.id]) != undefined) {
            for (var entry of adjacencyList[p.id]) {
                // Find the edge(s) needed and add them to the path
                if (entry.edge.dest == current.id) {
                    path.push(new EdgePathSegment(entry.edge));
                    break;
                } else if (entry.edge.lane != undefined) {
                    for (var lane of entry.edge.lane.entries) {
                        if (lane.edge.dest == current.id) {
                            // Add the lane change
                            path.push(new EdgePathSegment(lane.edge));
                            path.push(new LaneChangePathSegment(entry.edge, lane.edge));
                            path.push(new EdgePathSegment(entry.edge));
                            break;
                        }
                    }
                    break;
                }
            }
            current = p;
        }

        return path;
    }

    /**
     * Returns an adjacency list of edges and weights for each edge
     */
    public getAdjacencyList(): Record<number, { edge: Edge, weight: number }[]> {
        const adjacencyList: Record<number, { edge: Edge, weight: number }[]> = {};
        for (const edge of this.edges) {
            var speed = edge.speed;
            var numAgents = 0;
            for (var agent of this.agents) {
                if (agent.edge.getEphemeralEdge() == edge) {
                    speed = Math.min(speed, agent.speed);
                    numAgents++;
                }
            }
            var weight = (edge.length + numAgents) / (speed + 1);
            if (edge.sourceVertex.id in adjacencyList) {
                adjacencyList[edge.sourceVertex.id].push({ edge: edge, weight: weight });
            } else {
                adjacencyList[edge.sourceVertex.id] = [{ edge: edge, weight: weight }];
            }
        }
        return adjacencyList;
    }
}