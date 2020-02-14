import { Schema, type } from '@colyseus/schema';
import { Point2D, BezierCurve } from '../common/math'
import { Vertex, Edge, EdgeIntersect, Map } from './map'

export class Acceleration extends Schema {
    @type('number')
    start: number;
    @type('number')
    end: number
    @type('number')
    rate: number

    constructor(start: number, end: number, rate: number) {
        super();
        this.start = start;
        this.end = end;
        this.rate = rate;
    }

    evaluate(t: number): number {
        if (t > 1) t = 1;
        if (t < 0) t = 0;
        // (b-a)(sin(pi*(x-0.5))+1)/2+a
        return (this.end - this.start) * ((Math.sin(Math.PI * (t - 0.5)) + 1) / 2) + this.start;
    }

    /**
     * Gets the distance travelled over the course of this acceleration/deceleration.
     * @param t_0 The starting point for the t value used in distance calculations (usually t_0=0)
     */
    getTotalDistanceTravelled(t_0: number = 0): number {
        // antiderivative of (b-a)(sin(pi*(x-0.5))+1)/2+a
        // var integral = (x: number) => (this.end - this.start) * (x - ((Math.cos(Math.PI * (x - 0.5))) / Math.PI) + 2 * this.start * x) / 2
        // return integral(1) - integral(0);
        // Didn't need the above...
        var distance = 0;
        for (let t: number = t_0; t <= 1; t += this.rate) {
            distance += this.evaluate(t);
        }
        return distance;
    }
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

    @type(Acceleration)
    acceleration: Acceleration = undefined;

    // The following are server-side only as they don't transmit well with colyseus due to cyclic dependencies
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
        if (this.edge.currentPriority == 0 && this.location.x == this.edge.sourceVertex.location.x && this.location.y == this.edge.sourceVertex.location.y) return;
        var positiveX = this.edge.sourceVertex.location.x <= this.edge.destVertex.location.x;
        var positiveY = this.edge.sourceVertex.location.y <= this.edge.destVertex.location.y;
        for (var agent of this.map.agents) {
            if (agent != this) {
                if (agent.edge == undefined) continue;
                if (this.edge.connectsWith(agent.edge)) { // Following distance
                    var distance = this.location.distance(agent.location);
                    var tolerance = 10;
                    if (distance < tolerance && !(this.location.x == agent.location.x && this.location.y == agent.location.y) && (
                        (positiveX == this.location.x <= agent.location.x) && (positiveY == this.location.y <= agent.location.y)))
                        return;
                } else if (this.edge.destVertex == agent.edge.destVertex) { // Yield
                    if (this.edge.currentPriority >= agent.edge.currentPriority) continue;
                    var dA = this.location.distance(this.edge.destVertex.location);
                    var dB = agent.location.distance(this.edge.destVertex.location);
                    if (dB <= 30 && dA <= 20 && dA >= 10) return;
                } else { // Crossing traffic
                    if (this.edge.currentPriority >= agent.edge.currentPriority) continue;
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
                        var tolerance = 30;
                        if (dA > 20 || dB > tolerance) continue; // Some tolerance we don't care about
                        if (dA > 10 && dA <= 20) {
                            // We stop a certain distance away from the intersection
                            if (positiveX == this.location.x <= edgeIntersect.point.x && positiveY == this.location.y <= edgeIntersect.point.y
                                && (agent.edge.sourceVertex.location.x == agent.edge.destVertex.location.x ||
                                    agent.edge.sourceVertex.location.x < agent.edge.destVertex.location.x == agent.location.x <= edgeIntersect.point.x)
                                && (agent.edge.sourceVertex.location.y == agent.edge.destVertex.location.y ||
                                    agent.edge.sourceVertex.location.y < agent.edge.destVertex.location.y == agent.location.y <= edgeIntersect.point.y)) {
                                // They are both moving TOWARD the intersection
                                //console.log(this.edge.currentPriority + " " + agent.edge.currentPriority);
                                return;
                            }
                        }
                    }
                }
            }
        }

        var l1 = this.edge.sourceVertex.location;
        var l2 = this.edge.destVertex.location;
        // TODO cache bezierPath
        var bezierPath = new BezierCurve(this.edge.sourceVertex.location, this.edge.destVertex.location, this.edge.invert, this.edge.ctrlX != undefined && this.edge.ctrlY != undefined ?
            new Point2D({ x: this.edge.ctrlX, y: this.edge.ctrlY }) : undefined);
        this.t = bezierPath.next(this.t, this.speed);
        if (this.t <= 1) {
            this.location = bezierPath.evaluate(this.t);
        } else {
            this.location.x = l2.x;
            this.location.y = l2.y;
        }
        if (this.location.x == this.edge.destVertex.location.x && this.location.y == this.edge.destVertex.location.y) {
            for (var intersect of this.edge.intersectPoints)
                intersect.lock.release(this);
            this.edge = this.path.pop();
            this.t = 0;
        }
    }
}