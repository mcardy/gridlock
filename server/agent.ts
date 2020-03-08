import { Schema, type } from '@colyseus/schema';
import { Point2D, BezierCurve } from '../common/math'
import { Vertex, Edge, EdgeIntersect, Map } from './map'
import { Simulation } from './rooms/simulation'

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
    speed: number = 60

    @type(Acceleration)
    acceleration: Acceleration = undefined;

    @type('number')
    id: number

    @type('string')
    activeBehaviour: string = "None";

    // The following are server-side only as they don't transmit well with colyseus due to cyclic dependencies
    t: number
    source: Vertex
    dest: Vertex
    path: Edge[]
    edge: Edge
    map: Map
    intersect: EdgeIntersect

    decider: Decider<Acceleration, Agent>

    constructor(source: Vertex, dest: Vertex, map: Map, speedModifier: number) {
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
        this.speed = this.edge.speed * speedModifier;

        this.decider = new Decider<Acceleration, Agent>(
            (a, b) => a.getTotalDistanceTravelled(a.lookup(this.speed)) - b.getTotalDistanceTravelled(b.lookup(this.speed)),
            [
                new CutOffBehaviour(0),
                new IntersectionBehaviour(1),
                new YeildBehaviour(1),
                new FollowingBehaviour(0),
                new StopBehaviour(9, speedModifier),
                new GoBehaviour(10, speedModifier),
                new IntersectionEnterBehaviour(2),
                new SpeedLimitBehaviour(3, speedModifier)
            ])
    }

    public shouldDespawn(): boolean {
        return this.edge == undefined || (this.location.x == this.dest.location.x && this.location.y == this.dest.location.y);
    }

    public update(): void {
        // NOOP when we don't have an existing edge
        if (this.edge == undefined) return;

        // Get a new acceleration and update speed accordingly
        var newAcceleration = this.decider.evaluate(this);
        if (newAcceleration != undefined) {
            this.acceleration = newAcceleration.t;
            this.activeBehaviour = newAcceleration.name;
        } else {
            this.acceleration = undefined;
            this.activeBehaviour = "None";
        }
        if (this.acceleration != undefined) {
            var newSpeed = this.acceleration.evaluate(this.acceleration.lookup(this.speed) + this.acceleration.rate);
            this.speed = newSpeed;
            if ((this.acceleration.start < this.acceleration.end && this.speed >= this.acceleration.end) ||
                (this.acceleration.start > this.acceleration.end && this.speed <= this.acceleration.end)) {
                this.acceleration = undefined;
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
        this.t = this.edge.curve.next(this.t, this.speed / (Simulation.TICK_RATE));
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

    public evaluate(entity: E): { t: T, name: string } {
        var priorities = this.behaviours.map((behaviour) => behaviour.getPriority()).sort((a, b) => a - b);

        for (var priority of priorities) {
            var results: { t: T, name: string }[] = [];
            for (var behaviour of this.behaviours) {
                if (priority == behaviour.getPriority()) {
                    var t = behaviour.evaluate(entity);
                    if (t != undefined) {
                        results.push({ t: t, name: behaviour.constructor.name });
                    }
                }
            }
            var result: { t: T, name: string } = undefined;
            for (var r of results) {
                if (result == undefined || this.comparitor(result.t, r.t) >= 0) result = r;
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

    private speedModifier: number

    constructor(priority: number, speedModifier: number) {
        super(priority);
        this.speedModifier = speedModifier;
    }

    public evaluate(agent: Agent): Acceleration {
        return new Acceleration(0, this.speedModifier * agent.edge.speed, 0.1);
    }

}

export class IntersectionEnterBehaviour extends Behaviour<Acceleration, Agent> {

    constructor(priority: number) {
        super(priority);
    }

    public evaluate(agent: Agent): Acceleration {
        var myDistance = agent.location.distance(agent.edge.destVertex.location);
        if (agent.path.length > 0 && myDistance < 10) {
            var nextEdge = agent.path[agent.path.length - 1];
            if (nextEdge.priorities != undefined && nextEdge.priorities.length > 1) {
                // If there is someone stopped in the intersection, we should not enter.
                for (var other of agent.map.agents) {
                    if (other != undefined && other.edge != undefined && other.edge == nextEdge && other.speed == 0) {
                        var denom = myDistance;
                        denom *= 2
                        if (denom <= 1) denom = 1;
                        if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                            return new Acceleration(agent.speed, 0, 1 / denom);
                        } else {
                            return new Acceleration(agent.acceleration.start, 0, agent.activeBehaviour == this.constructor.name ? agent.acceleration.rate : 1 / denom);
                        }
                    }
                }
                if (agent.path.length > 1) {
                    var subsequentEdge = agent.path[agent.path.length - 2];
                    var existsAgentOnNextEdge = 0;
                    for (var other of agent.map.agents) {
                        if (other != undefined && other.edge != undefined && (other.edge == nextEdge || other.edge.dest == nextEdge.dest || other.edge == subsequentEdge && other.speed != 0)) {
                            existsAgentOnNextEdge++;
                        }
                    }
                    for (var other of agent.map.agents) {
                        if (other.edge == subsequentEdge && other.speed == 0 && other.location.distance(subsequentEdge.sourceVertex.location) < 15 * (existsAgentOnNextEdge + 1)) {
                            var denom = myDistance;
                            denom *= 2
                            if (denom <= 1) denom = 1;
                            if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                                return new Acceleration(agent.speed, 0, 1 / denom);
                            } else {
                                return new Acceleration(agent.acceleration.start, 0, agent.activeBehaviour == this.constructor.name ? agent.acceleration.rate : 1 / denom);
                            }
                        }
                    }
                }
            }
        }
        return undefined;
    }

}

export class StopBehaviour extends Behaviour<Acceleration, Agent> {

    private speedModifier: number

    constructor(priority: number, speedModifier: number) {
        super(priority);
        this.speedModifier = speedModifier;
    }

    public evaluate(agent: Agent): Acceleration {
        if (agent.location.distance(agent.edge.destVertex.location) <= 10 * agent.speed / Simulation.TICK_RATE + 0.5 && agent.path.length > 0 && agent.path[agent.path.length - 1].currentPriority == 0) {
            return new Acceleration(this.speedModifier * agent.edge.speed, 0, 0.05);
        } else if (agent.edge.currentPriority == 0 && agent.location.distance(agent.edge.sourceVertex.location) <= 1) {
            return new Acceleration(agent.speed, 0, 1);
        }
        return undefined;
    }

}

export class SpeedLimitBehaviour extends Behaviour<Acceleration, Agent> {
    private speedModifier: number

    constructor(priority: number, speedModifier: number) {
        super(priority);
        this.speedModifier = speedModifier;
    }

    public evaluate(agent: Agent): Acceleration {
        if (agent.path.length > 0 &&
            agent.edge.speed > agent.path[agent.path.length - 1].speed &&
            agent.location.distance(agent.edge.destVertex.location) < agent.edge.speed - agent.path[agent.path.length - 1].speed) { // We should slow down
            return new Acceleration(agent.edge.speed, agent.path[agent.path.length - 1].speed, 1 / (agent.edge.speed - agent.path[agent.path.length - 1].speed));
        }
        return undefined;
    }
}

export class CutOffBehaviour extends Behaviour<Acceleration, Agent> {
    private getIntersection(agent: Agent, other: Agent): EdgeIntersect {
        return agent.edge.intersectsWith(other.edge) ||
            (other.path.length != 0 ? agent.edge.intersectsWith(other.path[other.path.length - 1]) : undefined) ||
            (agent.path.length != 0 ? agent.path[agent.path.length - 1].intersectsWith(other.edge) : undefined) ||
            (agent.path.length != 0 && other.path.length != 0 ? agent.path[agent.path.length - 1].intersectsWith(other.path[other.path.length - 1]) : undefined);
    }

    public evaluate(agent: Agent): Acceleration {
        var intersection: EdgeIntersect;
        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            if ((intersection = this.getIntersection(agent, other)) != undefined && intersection.sourceEdge.currentPriority > intersection.edge.currentPriority) {
                var myDistance = agent.location.distance(intersection.point);
                var theirDistance = other.location.distance(intersection.point);
                if (myDistance < 15 && other.speed != 0 && theirDistance < 10) { // They've committed to the turn, we should slow down.
                    var denom = myDistance - 10;
                    denom *= 2
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

export class IntersectionBehaviour extends Behaviour<Acceleration, Agent> {

    private getIntersection(agent: Agent, other: Agent): EdgeIntersect {
        return agent.edge.intersectsWith(other.edge) ||
            (other.path.length != 0 ? agent.edge.intersectsWith(other.path[other.path.length - 1]) : undefined) ||
            (agent.path.length != 0 ? agent.path[agent.path.length - 1].intersectsWith(other.edge) : undefined) ||
            (agent.path.length != 0 && other.path.length != 0 ? agent.path[agent.path.length - 1].intersectsWith(other.path[other.path.length - 1]) : undefined);
    }

    public evaluate(agent: Agent): Acceleration {
        if (agent.edge.currentPriority == 0) return undefined;

        var xIncreasing = agent.edge.sourceVertex.location.x <= agent.edge.destVertex.location.x;
        var yIncreasing = agent.edge.sourceVertex.location.y <= agent.edge.destVertex.location.y;

        var intersection: EdgeIntersect;
        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            if ((intersection = this.getIntersection(agent, other)) != undefined && intersection.sourceEdge.currentPriority < intersection.edge.currentPriority) { // Moving toward an intersection
                var myDistance = agent.location.distance(intersection.point);
                var mySafeDistance = 30;
                var theirDistance = other.location.distance(intersection.point);
                var theirSafeDistance = 18 + myDistance;
                if (other.speed == 0 && theirDistance > 10) continue;
                if (myDistance > mySafeDistance || theirDistance > theirSafeDistance) continue;
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
                    denom *= 2
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
        //if (agent.edge.currentPriority == 0) return undefined;

        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            // Moving toward the same point and they have the right of way
            if (agent.edge.destVertex == other.edge.destVertex && agent.edge != other.edge) {
                var safeDistance = Math.max(10 * agent.speed / (Simulation.TICK_RATE), 35);
                var myDistance = agent.location.distance(agent.edge.destVertex.location);
                var theirDistance = other.location.distance(agent.edge.destVertex.location);
                // They have right of way
                if ((agent.edge.currentPriority != 0 && agent.edge.currentPriority < other.edge.currentPriority) ||
                    (agent.edge.currentPriority != 0 && other.edge.currentPriority == 0) ||
                    // The light just turned red
                    (agent.edge.currentPriority == 0 && other.edge.currentPriority == 0 && agent.edge.lastPriority < other.edge.lastPriority) ||
                    // They are committed to the turn
                    (theirDistance < 15)) {
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
        }
        return undefined;
    }

}

export class FollowingBehaviour extends Behaviour<Acceleration, Agent> {

    public evaluate(agent: Agent): Acceleration {
        var minDistance = Infinity;

        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            if (agent.edge.connectsWith(other.edge)) { // Moving toward another agent
                var safeDistance = 10 * agent.speed / Simulation.TICK_RATE + 10; // Start slowing down when within 20 units of another agent
                var distance = agent.location.distance(other.location);
                if (distance < safeDistance && !(agent.location.x == other.location.x && agent.location.y == other.location.y) &&
                    (agent.edge != other.edge ||
                        (agent.location.distance(agent.edge.destVertex.location) > other.location.distance(other.edge.destVertex.location)))) {
                    // Adjust acceleration
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                }
            }
        }

        if (minDistance != Infinity) {
            var denom = minDistance - 10;
            denom = 2 * denom;
            if (denom <= 1) denom = 1;
            var targetRate = 1 / denom;
            //var targetSpeed = Math.max(agent.speed - (safeDistance - distance) / safeDistance, 0);
            if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                return new Acceleration(agent.speed, 0, targetRate);
            } else {
                return new Acceleration(agent.acceleration.start, 0, targetRate > agent.acceleration.rate ? targetRate : agent.acceleration.rate);
            }
        }


        return undefined;
    }

}

