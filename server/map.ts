import { Schema, ArraySchema, type } from '@colyseus/schema';
import { Point2D, BezierCurve } from '../common/math';
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
    readonly invert: boolean = false
    @type(['number'])
    readonly priorities: number[]
    @type('number')
    readonly ctrlX: number = undefined;
    @type('number')
    readonly ctrlY: number = undefined;

    @type('number')
    readonly speed: number = 60;

    readonly sourceVertex: Vertex
    readonly destVertex: Vertex

    readonly curve: BezierCurve

    // Derived/mutable parameters
    @type('number')
    length: number = 0
    @type('number')
    currentPriority: number = 1;

    lastPriority: number = 0;

    // Server side properties
    intersectPoints: EdgeIntersect[]

    public constructor(source: Vertex, dest: Vertex, invert: boolean, priorities?: number[], ctrlX?: number, ctrlY?: number, speed?: number) {
        super();
        this.source = source.id;
        this.dest = dest.id;
        this.sourceVertex = source;
        this.destVertex = dest;
        this.invert = invert;
        if (speed != undefined)
            this.speed = speed;
        this.length = this.calculateLength();
        if (priorities !== undefined && priorities.length > 0) {
            this.priorities = priorities;
            this.currentPriority = priorities[0];
        }
        this.intersectPoints = [];
        this.ctrlX = ctrlX;
        this.ctrlY = ctrlY;
        this.curve = new BezierCurve(this.sourceVertex.location, this.destVertex.location, this.invert, this.ctrlX != undefined && this.ctrlY != undefined ?
            new Point2D({ x: this.ctrlX, y: this.ctrlY }) : undefined);
    }

    public intersectsWith(edge: Edge): EdgeIntersect {
        // Currently, the approximation is using linear segments, will expand to bezier curves in the future
        return this.intersectPoints.find(function (ei) { return ei.edge == edge; });
    }

    public connectsWith(edge: Edge): boolean {
        if (edge == undefined) return false;
        return this == edge || this.dest == edge.source;// || this.source == edge.source;
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
                    // TODO more refined iteration end
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
                    //console.log("HAVE NOT YET IMPLEMENTED BEZIER CURVE INTERSECTIONS");
                    return undefined;
                }
            }
        }
    }

    private calculateLength(): number { // TODO expand to 3d bezier curve
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
                let edge: Edge;
                for (edge of adjacencyList[current.id]) {
                    next.push(edge.destVertex);
                }
            }
        }
        return destinations;
    }

    /**
     * Returns a path in stack order from source to destination
     * For example, if source is 1 and dest is 3 and they are linked by vertex 2, the
     * resulting array will be [3,2,1], ie. the last item will be the source.
     * @param source 
     * @param dest 
     */
    public getBestPath(source: Vertex, dest: Vertex): Edge[] {
        type TraceableVertex = { parent: TraceableVertex, edge: Edge, node: Vertex };
        var adjacencyList = this.getAdjacencyList();
        var bestPath: Edge[] = null;
        var visited: Vertex[] = [];
        var next: TraceableVertex[] = [{ parent: null, edge: null, node: source }];
        while (next.length != 0) {
            var current = next.splice(0, 1)[0];
            if (visited.indexOf(current.node) >= 0) continue;
            visited.push(current.node);
            if (current.node == dest) {
                var path: Edge[] = new ArraySchema<Edge>();
                var parent: TraceableVertex = current;
                while (parent.parent != null) {
                    path.push(parent.edge);
                    parent = parent.parent;
                }
                if (bestPath == null || path.length < bestPath.length) {
                    bestPath = path;
                }
            }
            if (current.node.id in adjacencyList) {
                let edge: Edge;
                for (edge of adjacencyList[current.node.id]) {
                    next.push({ parent: current, edge: edge, node: edge.destVertex });
                }
            }
        }
        return bestPath;
    }

    public getAdjacencyList(): Record<number, Edge[]> {
        const adjacencyList: Record<number, Edge[]> = {};
        for (const edge of this.edges) {
            if (edge.sourceVertex.id in adjacencyList) {
                adjacencyList[edge.sourceVertex.id].push(edge);
            } else {
                adjacencyList[edge.sourceVertex.id] = [edge];
            }
        }
        return adjacencyList;
    }
}