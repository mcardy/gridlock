import { Schema, ArraySchema, type } from '@colyseus/schema';
import { Mutex } from './mutex';

export class Point2D extends Schema {
    @type('number')
    x: number
    @type('number')
    y: number

    public constructor(init?: Partial<Point2D>) {
        super();
        Object.assign(this, init);
    }

    public plus(p: Point2D): Point2D {
        return new Point2D({ x: this.x + p.x, y: this.y + p.y });
    }

    public minus(p: Point2D): Point2D {
        return new Point2D({ x: this.x - p.x, y: this.y - p.y });
    }

    public cross(p: Point2D): number {
        return this.x * p.y - this.y * p.x;
    }

    public times(k: number): Point2D {
        return new Point2D({ x: this.x * k, y: this.y * k });
    }

    public distance(p: Point2D): number {
        return Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2));
    }
}

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
    edge: Edge
    point: Point2D
    lock: Mutex<Agent>

    public constructor(init?: Partial<EdgeIntersect>) {
        Object.assign(this, init);
    }
}

export class Edge extends Schema {
    @type(Vertex)
    readonly source: Vertex
    @type(Vertex)
    readonly dest: Vertex
    @type('boolean')
    readonly invert: boolean = false
    @type(['number'])
    readonly priorities: number[]

    // Derived/mutable parameters
    @type('number')
    length: number = 0
    @type('number')
    currentPriority: number = 1;

    // Server side properties
    intersectPoints: EdgeIntersect[]

    public constructor(source: Vertex, dest: Vertex, invert: boolean, priorities: number[] = undefined) {
        super();
        this.source = source;
        this.dest = dest;
        this.invert = invert;
        this.length = this.calculateLength();
        if (priorities !== undefined && priorities.length > 0) {
            this.priorities = priorities;
            this.currentPriority = priorities[0];
        }
        this.intersectPoints = [];
    }

    public intersectsWith(edge: Edge): EdgeIntersect {
        // Currently, the approximation is using linear segments, will expand to bezier curves in the future
        return this.intersectPoints.find(function (ei) { return ei.edge == edge; });
    }

    public connectsWith(edge: Edge): boolean {
        if (edge == undefined) return false;
        return this == edge || this.dest == edge.source;
    }

    private calculateLength(): number {
        var p0: Point2D = new Point2D(this.source.location);
        var p2: Point2D = new Point2D(this.dest.location);
        if (p0.x == p2.x) {
            return Math.abs(p0.y - p2.y);
        } else if (p0.y == p2.y) {
            return Math.abs(p0.x - p2.x);
        } else {
            var p1 = new Point2D({ x: this.invert ? p0.x : p2.x, y: this.invert ? p2.y : p0.y })
            var a = new Point2D();
            var b = new Point2D();
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


export class Agent extends Schema {
    // The following get transmitted to the client
    @type('number')
    sourceId: number
    @type('number')
    destId: number

    @type(Point2D)
    location: Point2D
    @type('number')
    speed: number = 1

    // The following are server-side only
    t: number
    source: Vertex
    dest: Vertex
    path: Edge[]
    edge: Edge
    map: Map
    intersect: EdgeIntersect

    constructor(source: Vertex, dest: Vertex, map: Map) {
        super();
        this.sourceId = source.id;
        this.destId = dest.id;
        this.source = source;
        this.dest = dest;
        this.map = map;
        this.location = new Point2D({ x: source.location.x, y: source.location.y });
        this.path = this.map.getBestPath(source, dest);
        this.edge = this.path.pop();
        this.t = 0;
    }

    public shouldDespawn(): boolean {
        return this.edge == undefined || (this.location.x == this.dest.location.x && this.location.y == this.dest.location.y);
    }

    public update(): void {
        if (this.edge == undefined) return;
        if (this.edge.currentPriority == 0 && this.location.x == this.edge.source.location.x && this.location.y == this.edge.source.location.y) return;
        var positiveX = this.edge.source.location.x <= this.edge.dest.location.x;
        var positiveY = this.edge.source.location.y <= this.edge.dest.location.y;
        if (this.intersect != undefined && this.location.distance(this.intersect.point) > 10 &&
            (this.location.x <= this.intersect.point.x != positiveX || this.location.y <= this.intersect.point.y != positiveY)) {
            this.intersect.lock.release(this);
            this.intersect = undefined;
        }
        for (var agent of this.map.agents) {
            if (agent != this) {
                // Should repeat the following with this's next edge as well
                if (this.edge.connectsWith(agent.edge)) {
                    var distance = this.location.distance(agent.location);
                    var tolerance = 10;
                    if (distance < tolerance && !(this.location.x == agent.location.x && this.location.y == agent.location.y) && (
                        (positiveX == this.location.x <= agent.location.x) && (positiveY == this.location.y <= agent.location.y)))
                        return;
                }
            }
        }

        /* TODO move to its own function
        var edgeIntersect = this.edge.intersectsWith(agent.edge);
        if (edgeIntersect == undefined && agent.path.length > 0)
            edgeIntersect = this.edge.intersectsWith(agent.path[agent.path.length - 1]);
        if (edgeIntersect == undefined && this.path.length > 0)
            edgeIntersect = this.path[this.path.length - 1].intersectsWith(agent.edge);
        if (edgeIntersect == undefined && this.path.length > 0 && agent.path.length > 0)
            edgeIntersect = this.path[this.path.length - 1].intersectsWith(agent.path[agent.path.length - 1]);
        if (edgeIntersect != undefined) {
            var dA = this.location.distance(edgeIntersect.point);
            var dB = agent.location.distance(edgeIntersect.point);
            if (dA > 20 || dB > 20) continue; // Some tolerance
            if (positiveX == this.location.x <= edgeIntersect.point.x && positiveY == this.location.y <= edgeIntersect.point.y
                && agent.edge.source.location.x <= agent.edge.dest.location.x == agent.location.x <= edgeIntersect.point.x
                && agent.edge.source.location.y <= agent.edge.dest.location.y == agent.location.y <= edgeIntersect.point.y) {
                // They are both moving TOWARD the lock
                if (edgeIntersect.lock.isLocked()) {
                    if (edgeIntersect.lock.isOwned(this)) {
                        continue;
                    } else if (edgeIntersect.lock.getOwner().edge == this.edge) {
                        if (dA > edgeIntersect.point.distance(edgeIntersect.lock.getOwner().location)) {
                            edgeIntersect.lock.release(edgeIntersect.lock.getOwner());
                            edgeIntersect.lock.acquire(this);
                            this.intersect = edgeIntersect;
                        }
                        continue;
                    } else {
                        return;
                    }
                } else {
                    if (dA / this.edge.currentPriority < dB / agent.edge.currentPriority) {
                        edgeIntersect.lock.acquire(this);
                        this.intersect = edgeIntersect;
                    }
                }
            }
        }
        */

        var l1 = this.edge.source.location;
        var l2 = this.edge.dest.location;
        if (l1.x == l2.x) {
            // Linear in x
            this.location.y += (l1.y < l2.y ? 1 : -1) * this.speed;
        } else if (l1.y == l2.y) {
            // Linear in y
            this.location.x += (l1.x < l2.x ? 1 : -1) * this.speed;
        } else {
            // Quadratic Bezier Curve, calculate differences in each direction normalized to the origin
            /*var tx = agent.Point2D.x - l1.x;
            var ty = agent.Point2D.y - l2.x;
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
            agent.Point2D.x += lx;
            agent.Point2D.y += ly;*/
            var xctl = this.edge.invert ? l1.x : l2.x;
            var yctl = this.edge.invert ? l2.y : l1.y;

            // TODO move based on constant distance travelled rather than constant 'speed' and from a position rather than with 't'
            this.t += this.speed;
            var len = this.edge.length;
            var t = this.t / len;
            var x, y;
            if (t >= 1) {
                x = l2.x;
                y = l2.y;
            } else {
                x = (1 - t) * (1 - t) * l1.x + 2 * (1 - t) * t * xctl + t * t * l2.x;
                y = (1 - t) * (1 - t) * l1.y + 2 * (1 - t) * t * yctl + t * t * l2.y;
            }
            this.location.x = x;
            this.location.y = y;
        }
        if (this.location.x == this.edge.dest.location.x && this.location.y == this.edge.dest.location.y) {
            for (var intersect of this.edge.intersectPoints)
                intersect.lock.release(this);
            this.edge = this.path.pop();
            this.t = 0;
        }
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

    sources: number[] = new ArraySchema<number>();
    destinations: number[] = new ArraySchema<number>();

    public findVertexById(id: number): Vertex {
        return this.vertices.find(function (vertex) { return vertex.id == id });
    }

    public findOutgoingEdge(vertex: Vertex): Edge {
        return this.edges.find(function (edge) { return edge.source == vertex });
    }

    public getAssignableDestinations(source: Vertex): Vertex[] {
        var destinations: Vertex[] = new ArraySchema<Vertex>();
        var adjacencyList = this.getAdjacencyList();
        var visited: Vertex[] = [];
        var next: Vertex[] = [source];
        while (next.length != 0) {
            var current = next.splice(0, 1)[0];
            if (visited.indexOf(current) >= 0) continue;
            if (current.dest) destinations.push(current);
            if (current.id in adjacencyList) {
                let edge: Edge;
                for (edge of adjacencyList[current.id]) {
                    next.push(edge.dest);
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
                    next.push({ parent: current, edge: edge, node: edge.dest });
                }
            }
        }
        return bestPath;
    }

    public getAdjacencyList(): Record<number, Edge[]> {
        const adjacencyList: Record<number, Edge[]> = {};
        for (const edge of this.edges) {
            if (edge.source.id in adjacencyList) {
                adjacencyList[edge.source.id].push(edge);
            } else {
                adjacencyList[edge.source.id] = [edge];
            }
        }
        return adjacencyList;
    }
}