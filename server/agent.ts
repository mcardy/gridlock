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
        if (velocity <= (this.start < this.end ? this.start : this.end)) return this.start < this.end ? 0 : 1;
        if (velocity >= (this.start < this.end ? this.end : this.start)) return this.start < this.end ? 1 : 0;
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

    decider: Decider<Acceleration, Agent>

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

        this.decider = new Decider<Acceleration, Agent>(
            (a, b) => a.getTotalDistanceTravelled(a.lookup(this.speed)) - b.getTotalDistanceTravelled(b.lookup(this.speed)),
            [
                new IntersectionBehaviour(0),
                new YeildBehaviour(0),
                new FollowingBehaviour(0),
                new StopBehaviour(9),
                new GoBehaviour(10)
            ])
    }

    public shouldDespawn(): boolean {
        return this.edge == undefined || (this.location.x == this.dest.location.x && this.location.y == this.dest.location.y);
    }

    public update(): void {
        // NOOP when we don't have an existing edge
        if (this.edge == undefined) return;

        // Get a new acceleration and update speed accordingly
        this.acceleration = this.decider.evaluate(this);
        if (this.acceleration != undefined) {
            if (this.speed == this.acceleration.end) {
                this.acceleration = undefined;
            } else {
                var newSpeed = this.acceleration.evaluate(this.acceleration.lookup(this.speed) + this.acceleration.rate);
                this.speed = newSpeed;
            }
        }

        // Check for cases when speed is NaN
        if (Number.isNaN(this.speed) || this.speed == undefined) {
            throw new Error("Speed may not be NaN");
        }

        // If we are barely moving, exit.
        if (this.speed <= 0.01) return;

        // Determine new location with bezier path
        var l1 = this.edge.sourceVertex.location;
        var l2 = this.edge.destVertex.location;
        // TODO cache bezierPath
        this.t = this.edge.curve.next(this.t, this.speed);
        if (this.t <= 1) {
            this.location = this.edge.curve.evaluate(this.t);
        } else { // Move on to the next vertex
            this.location.x = l2.x;
            this.location.y = l2.y;
        }
        if (this.location.x == this.edge.destVertex.location.x && this.location.y == this.edge.destVertex.location.y) {
            this.edge = this.path.pop();
            this.t = 0;
        }
    }

    public toString = (): string => {
        return this.id.toString();
    }
}

export class Decider<T, E> {

    private comparitor: (a: T, b: T) => number;
    private behaviours: Behaviour<T, E>[];

    constructor(comparitor: (a: T, b: T) => number, behaviours: Behaviour<T, E>[]) {
        this.comparitor = comparitor;
        this.behaviours = behaviours;
    }

    public evaluate(entity: E): T {
        var priorities = this.behaviours.map((behaviour) => behaviour.getPriority()).sort((a, b) => a - b);

        for (var priority of priorities) {
            var results: T[] = [];
            for (var behaviour of this.behaviours) {
                if (priority == behaviour.getPriority()) {
                    var result = behaviour.evaluate(entity);
                    if (result != undefined) {
                        results.push(result);
                    }
                }
            }
            var result: T = undefined;
            for (var r of results) {
                if (result == undefined || this.comparitor(result, r) >= 0) result = r;
            }
            if (result != undefined) return result;
        }
        return undefined;
    }

}

export abstract class Behaviour<T, E> {

    private priority: number;

    constructor(priority: number) {
        this.priority = priority;
    }

    public getPriority(): number {
        return this.priority;
    }

    public abstract evaluate(entity: E): T;

}

export class GoBehaviour extends Behaviour<Acceleration, Agent> {

    public evaluate(agnet: Agent): Acceleration {
        return new Acceleration(0, 1, 0.2);
    }

}

export class StopBehaviour extends Behaviour<Acceleration, Agent> {

    public evaluate(agent: Agent): Acceleration {
        if (agent.location.distance(agent.edge.destVertex.location) <= 10 && agent.path.length > 0 && agent.path[agent.path.length - 1].currentPriority == 0) {
            return new Acceleration(agent.speed, 0, 0.05);
        } else if (agent.edge.currentPriority == 0 && agent.location.distance(agent.edge.sourceVertex.location) <= 1) {
            return new Acceleration(agent.speed, 0, 1);
        }
        return undefined;
    }

}

export class IntersectionBehaviour extends Behaviour<Acceleration, Agent> {

    private getIntersection(agent: Agent, other: Agent): EdgeIntersect {
        return agent.edge.intersectsWith(other.edge) ||
            (other.path.length != 0 ? agent.edge.intersectsWith(other.path[other.path.length - 1]) : undefined) ||
            (agent.path.length != 0 ? agent.path[agent.path.length - 1].intersectsWith(other.edge) : undefined) ||
            (agent.path.length != 0 && other.path.length != 0 ? agent.path[agent.path.length - 1].intersectsWith(other.path[other.path.length - 1]) : undefined);
    }

    public evaluate(agent: Agent): Acceleration {
        var xIncreasing = agent.edge.sourceVertex.location.x <= agent.edge.destVertex.location.x;
        var yIncreasing = agent.edge.sourceVertex.location.y <= agent.edge.destVertex.location.y;

        var intersection: EdgeIntersect;
        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            if ((intersection = this.getIntersection(agent, other)) != undefined && agent.edge.currentPriority < other.edge.currentPriority) { // Moving toward an intersection
                var safeDistance = 30;
                var myDistance = agent.location.distance(intersection.point);
                var theirDistance = other.location.distance(intersection.point);
                if (myDistance > safeDistance || theirDistance > safeDistance) continue;
                if (myDistance <= 15) continue; // We are committed to the turn
                // First, are we moving toward the intersection
                if (xIncreasing == agent.location.x <= intersection.point.x && yIncreasing == agent.location.y <= intersection.point.y
                    // And are they moving toward the intersection?
                    && (other.edge.sourceVertex.location.x == other.edge.destVertex.location.x ||
                        other.edge.sourceVertex.location.x < other.edge.destVertex.location.x == other.location.x <= intersection.point.x)
                    && (other.edge.sourceVertex.location.y == other.edge.destVertex.location.y ||
                        other.edge.sourceVertex.location.y < other.edge.destVertex.location.y == other.location.y <= intersection.point.y)) {
                    // Adjust acceleration to slow down 10 units away
                    var denom = myDistance - 15;
                    if (denom <= 1) denom = 1;
                    if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                        return new Acceleration(agent.speed, 0, 1 / denom);
                    } else {
                        return new Acceleration(agent.acceleration.start, 0, 1 / denom);
                    }
                }
            }
        }
        return undefined;
    }
}

export class YeildBehaviour extends Behaviour<Acceleration, Agent> {

    public evaluate(agent: Agent): Acceleration {
        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            // Moving toward the same point and they have the right of way
            if (agent.edge.destVertex == other.edge.destVertex && agent.edge.currentPriority < other.edge.currentPriority) {
                var safeDistance = Math.max(10 * agent.speed, 35);
                var myDistance = agent.location.distance(agent.edge.destVertex.location);
                var theirDistance = other.location.distance(agent.edge.destVertex.location);
                // If either of us are far away from the destination, we needn't worry
                if (myDistance > safeDistance || theirDistance > safeDistance) continue;
                if (myDistance <= 15) continue; // Committed to turn
                // Adjust acceleration
                var denom = myDistance - 15;
                if (denom <= 1) denom = 1;
                if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                    return new Acceleration(agent.speed, 0, 1 / denom);
                } else {
                    return new Acceleration(agent.acceleration.start, 0, 1 / denom);
                }
            }
        }
        return undefined;
    }

}

export class FollowingBehaviour extends Behaviour<Acceleration, Agent> {

    public evaluate(agent: Agent): Acceleration {
        var xIncreasing = agent.edge.sourceVertex.location.x <= agent.edge.destVertex.location.x;
        var yIncreasing = agent.edge.sourceVertex.location.y <= agent.edge.destVertex.location.y;

        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            if (agent.edge.connectsWith(other.edge)) { // Moving toward another agent
                var safeDistance = Math.max(10 * agent.speed, 15);
                var distance = agent.location.distance(other.location);
                if (distance < safeDistance && !(agent.location.x == other.location.x && agent.location.y == other.location.y) &&
                    (agent.edge != other.edge ||
                        ((xIncreasing == agent.location.x <= other.location.x) && (yIncreasing == agent.location.y <= other.location.y)))) {
                    // Adjust acceleration
                    var denom = distance - 10;
                    if (denom <= 1) denom = 1;
                    var targetRate = denom == 1 ? 1 : (agent.speed == 0 ? 1 : agent.speed) / denom;
                    var targetSpeed = Math.max(agent.speed - (safeDistance - distance) / safeDistance, 0);
                    if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                        return new Acceleration(agent.speed, 0, targetRate);
                    } else {
                        return new Acceleration(agent.acceleration.start, 0, targetRate);
                    }
                }
            }
        }
        return undefined;
    }

}

