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

    lookup(velocity: number): number {
        if (velocity <= this.start) return 0;
        if (velocity => this.end) return 1;
        return Math.asin((2 * (velocity - this.start)) / (this.end - this.start) - 1) / Math.PI + 0.5;
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
    private static nextID: number = 0;

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

    @type('number')
    id: number

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
        this.id = Agent.nextID++;
        this.location = new Point2D({ x: source.location.x, y: source.location.y });
        this.path = this.map.getBestPath(source, dest);
        this.edge = this.path.pop();
        this.t = 0;
    }

    public shouldDespawn(): boolean {
        return this.edge == undefined || (this.location.x == this.dest.location.x && this.location.y == this.dest.location.y);
    }

    private getIntersection(agent: Agent): EdgeIntersect {
        return this.edge.intersectsWith(agent.edge) ||
            agent.path.length != 0 ? this.edge.intersectsWith(agent.path[agent.path.length - 1]) : undefined ||
                this.path.length != 0 ? this.path[this.path.length - 1].intersectsWith(agent.edge) : undefined ||
                    this.path.length != 0 && agent.path.length != 0 ? this.path[this.path.length - 1].intersectsWith(agent.path[agent.path.length - 1]) : undefined;
    }

    public update(): void {
        if (this.edge == undefined) return; // NOOP when we don't have an existing edge

        var xIncreasing = this.edge.sourceVertex.location.x <= this.edge.destVertex.location.x;
        var yIncreasing = this.edge.sourceVertex.location.y <= this.edge.destVertex.location.y;

        var deltaD = this.acceleration != undefined ? this.acceleration.getTotalDistanceTravelled(this.acceleration.lookup(this.speed)) : undefined;
        var accelerations = [];

        if (this.location.distance(this.edge.destVertex.location) <= 10 && this.path.length > 0 && this.path[this.path.length - 1].currentPriority == 0) {
            accelerations.push(new Acceleration(this.speed, 0, 0.2));
        }

        if (this.edge.currentPriority == 0 && this.location.distance(this.edge.sourceVertex.location) <= 1) {
            accelerations.push(new Acceleration(this.speed, 0, 1));
        }

        for (var agent of this.map.agents) {
            if (agent == undefined || agent.edge == undefined || agent == this) continue;
            // First consider agents with right of way (yeilds)
            var intersection: EdgeIntersect;
            if (this.edge.connectsWith(agent.edge)) { // Moving toward another agent
                var safeDistance = Math.max(10 * this.speed, 15);
                var distance = this.location.distance(agent.location);
                if (distance < safeDistance && !(this.location.x == agent.location.x && this.location.y == agent.location.y) &&
                    (this.edge != agent.edge ||
                        ((xIncreasing == this.location.x <= agent.location.x) && (yIncreasing == this.location.y <= agent.location.y)))) {
                    // Adjust acceleration
                    var denom = distance - 10;
                    if (denom <= 0) denom = 1;
                    var targetRate = denom == 1 ? 1 : this.speed / denom;
                    var targetSpeed = Math.max(agent.speed - (safeDistance - distance) / safeDistance, 0);
                    if (this.acceleration == undefined || this.acceleration.start <= this.speed) {
                        accelerations.push(new Acceleration(this.speed, targetSpeed, targetRate));
                    } else {
                        accelerations.push(new Acceleration(this.acceleration.start, targetSpeed, targetRate));
                    }
                }
            } else if ((intersection = this.getIntersection(agent)) != undefined) { // Moving toward an intersection
                var safeDistance = 30;
                var myDistance = this.location.distance(intersection.point);
                var theirDistance = agent.location.distance(intersection.point);
                if (myDistance > safeDistance || theirDistance > safeDistance) continue;
                if (myDistance <= 10) continue; // We are committed to the turn
                // First, are we moving toward the intersection
                if (xIncreasing == this.location.x <= intersection.point.x && yIncreasing == this.location.y <= intersection.point.y
                    // And are they moving toward the intersection?
                    && (agent.edge.sourceVertex.location.x == agent.edge.destVertex.location.x ||
                        agent.edge.sourceVertex.location.x < agent.edge.destVertex.location.x == agent.location.x <= intersection.point.x)
                    && (agent.edge.sourceVertex.location.y == agent.edge.destVertex.location.y ||
                        agent.edge.sourceVertex.location.y < agent.edge.destVertex.location.y == agent.location.y <= intersection.point.y)) {
                    // Adjust acceleration to slow down 10 units away
                    if (this.acceleration == undefined || this.acceleration.start <= this.speed) {
                        accelerations.push(new Acceleration(this.speed, 0, this.speed / (myDistance - 10)));
                    } else {
                        accelerations.push(new Acceleration(this.acceleration.start, 0, this.acceleration.start / (myDistance - 10)));
                    }
                }
            } else if (this.edge.destVertex == agent.edge.destVertex && this.edge.currentPriority < agent.edge.currentPriority) { // Moving toward the same point and they have the right of way
                var safeDistance = Math.max(10 * this.speed, 35);
                var myDistance = this.location.distance(this.edge.destVertex.location);
                var theirDistance = agent.location.distance(this.edge.destVertex.location);
                // If either of us are far away from the destination, we needn't worry
                if (myDistance > safeDistance || theirDistance > safeDistance) continue;
                if (myDistance <= 20) continue; // Committed to turn
                // Adjust acceleration
                if (this.acceleration == undefined || this.acceleration.start <= this.speed) {
                    accelerations.push(new Acceleration(this.speed, 0, this.speed / (myDistance - 20)));
                } else {
                    accelerations.push(new Acceleration(this.acceleration.start,
                        0, this.acceleration.start / (myDistance - 20)));
                }
            }
            // Then consider agents on collision paths (intersections)
            // Then consider agents on same path
        }

        if (accelerations.length == 0 && this.edge.currentPriority != 0) {
            this.acceleration = new Acceleration(this.speed, 1, 0.2);
        } else if (this.speed != 0) {
            var min = this.acceleration;
            var minValue = deltaD != undefined ? deltaD : 1000;
            for (var acc of accelerations) {
                if (acc.rate <= 0) continue;
                var val = acc.getTotalDistanceTravelled(acc.lookup(this.speed));
                if (val < minValue) {
                    minValue = val;
                    min = acc;
                }
            }
            this.acceleration = min;
        }

        if (this.acceleration != undefined) {
            if (this.speed == this.acceleration.end) {
                this.acceleration = undefined;
            } else {
                this.speed = this.acceleration.evaluate(this.acceleration.lookup(this.speed) + this.acceleration.rate);
            }
        }

        if (Number.isNaN(this.speed) || this.speed == undefined) throw new Error("Speed may not be NaN");

        /*
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
        }*/

        if (this.speed <= 0.001) return;

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
            this.edge = this.path.pop();
            this.t = 0;
        }
    }
}