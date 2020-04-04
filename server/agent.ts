import { Schema, type } from '@colyseus/schema';
import { Point2D, BezierCurve } from '../common/math'
import { Vertex, Edge, EdgeIntersect, PathSegment, EdgePathSegment, LaneChangePathSegment, Map, Lane } from './map'
import { Simulation } from './rooms/simulation'
import { Decider, Behaviour } from './util/behaviour'

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
    public static nextID: number = 0;

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
    path: PathSegment[]
    edge: PathSegment
    map: Map
    intersect: EdgeIntersect

    destDistance: number

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
        this.speed = this.edge.getEphemeralEdge().speed * speedModifier;

        this.destDistance = this.edge.getEphemeralEdge().length;

        this.decider = new Decider<Acceleration, Agent>(
            (a, b) => a.getTotalDistanceTravelled(a.lookup(this.speed)) - b.getTotalDistanceTravelled(b.lookup(this.speed)),
            [
                new LaneChangeBehaviour(0),
                new LaneChangeGiveSpaceBehaviour(1),
                new LaneChangeYeildBehaviour(1),
                new CutOffBehaviour(1),
                new IntersectionBehaviour(1),
                new IntersectionEnterBehaviour(1),
                new YieldBehaviour(2),
                new YieldCutOffBehaviour(2),
                new FollowingBehaviour(3),
                new RedLightRightTurnBehaviour(4, speedModifier),
                new SpeedLimitBehaviour(5, speedModifier),
                new StopBehaviour(9, speedModifier),
                new GoBehaviour(10, speedModifier)
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
        var l1 = this.edge.getEphemeralEdge().sourceVertex.location;
        var l2 = this.edge.getEphemeralEdge().destVertex.location;
        this.t = this.edge.getEphemeralEdge().curve.next(this.t, this.speed / (Simulation.TICK_RATE));
        if (this.t <= 1) {
            this.location = this.edge.getEphemeralEdge().curve.evaluate(this.t);
        } else { // Move on to the next vertex
            this.location.x = l2.x;
            this.location.y = l2.y;
        }
        if (this.location.x == this.edge.getEphemeralEdge().destVertex.location.x && this.location.y == this.edge.getEphemeralEdge().destVertex.location.y) {
            this.t = 0;
            if (this.edge instanceof LaneChangePathSegment) {
                this.t = (this.edge as LaneChangePathSegment).exitPoint;
            }
            this.edge = this.path.pop();
        }

        if (this.edge != undefined) {
            this.destDistance = this.location.distance(this.edge.getEphemeralEdge().destVertex.location);
        } else {
            this.destDistance = 0;
        }
    }

    public toString = (): string => {
        return this.id.toString();
    }
}

export abstract class AbstractAgentBehaviour extends Behaviour<Acceleration, Agent> {

    constructor(priority: number) {
        super(priority);
    }

    protected getIntersection(agent: Agent, other: Agent): EdgeIntersect {
        return agent.edge.getEphemeralEdge().intersectsWith(other.edge.getEphemeralEdge()) ||
            (other.path.length != 0 ? agent.edge.getEphemeralEdge().intersectsWith(other.path[other.path.length - 1].getEphemeralEdge()) : undefined) ||
            (agent.path.length != 0 ? agent.path[agent.path.length - 1].getEphemeralEdge().intersectsWith(other.edge.getEphemeralEdge()) : undefined) ||
            (agent.path.length != 0 && other.path.length != 0 ? agent.path[agent.path.length - 1].getEphemeralEdge().intersectsWith(other.path[other.path.length - 1].getEphemeralEdge()) : undefined);
    }

    /**
     * For yield behaviour
     * @param first 
     * @param second 
     */
    protected doSegmentsConjoin(first: PathSegment, second: PathSegment): boolean {
        if (first instanceof EdgePathSegment && second instanceof EdgePathSegment) {
            return first.getEphemeralEdge().destVertex == second.getEphemeralEdge().destVertex && first.getEphemeralEdge() != second.getEphemeralEdge();
        }
        return false;
    }

    /**
     * For following behaviour
     * @param first 
     * @param second 
     */
    protected doSegmentsConnect(first: PathSegment, second: PathSegment, firstT: number, secondT: number): boolean {
        if (first instanceof EdgePathSegment && second instanceof EdgePathSegment) {
            return (first.getEphemeralEdge() == second.getEphemeralEdge() && firstT <= secondT) || first.getEphemeralEdge().dest == second.getEphemeralEdge().source;
        } else if (first instanceof EdgePathSegment && second instanceof LaneChangePathSegment) {
            return first.edge == second.entryEdge && firstT < second.entryPoint;
        } else if (first instanceof LaneChangePathSegment && second instanceof EdgePathSegment) {
            return (first.exitEdge == second.edge && first.exitPoint <= secondT) || first.exitEdge.dest == second.edge.source;
        }
        return false;
    }

}

export class LaneChangeYeildBehaviour extends AbstractAgentBehaviour {
    public evaluate(agent: Agent) {
        if (agent.edge instanceof LaneChangePathSegment && agent.t < 0.10) {
            for (var other of agent.map.agents) {
                if (other.edge == undefined) continue;
                if (other.edge instanceof EdgePathSegment) {
                    // Moving toward the same point and they have the right of way
                    if ((other.edge.getEphemeralEdge() == agent.edge.exitEdge && other.t < agent.edge.exitPoint) ||
                        (other.edge.getEphemeralEdge().dest == agent.edge.exitEdge.source)) {
                        var theirDistance = other.location.distance(agent.edge.getEphemeralEdge().destVertex.location);
                        var theirSafeDistance = 10 + 10 * other.speed / Simulation.TICK_RATE;
                        if (theirDistance > theirSafeDistance) continue;
                        // They have right of way
                        // Adjust acceleration
                        return new Acceleration(agent.speed, 0, 1);
                    }
                } else if (other.edge instanceof LaneChangePathSegment) {
                    if (other.edge.exitEdge == agent.edge.entryEdge &&
                        agent.edge.exitPoint > other.edge.entryPoint &&
                        other.edge.exitPoint > agent.edge.entryPoint) { // Merging into eachothers lanes...
                        if ((agent.edge.entryPoint <= other.edge.entryPoint && agent.id < other.id) || other.t >= 0.10) {
                            return new Acceleration(agent.speed, 0, 1);
                        }
                    }
                }
            }
        }
        return undefined;
    }
}

export class LaneChangeGiveSpaceBehaviour extends AbstractAgentBehaviour {
    public evaluate(agent: Agent) {
        if (agent.edge instanceof EdgePathSegment) {
            for (var other of agent.map.agents) {
                if (other.edge == undefined) continue;
                if (other.edge instanceof LaneChangePathSegment && other.edge.exitEdge == agent.edge.edge && agent.t < other.edge.exitPoint) {
                    var myDistance = agent.location.distance(other.edge.getEphemeralEdge().destVertex.location);
                    var adjustedDistance = myDistance - 10 * agent.speed / Simulation.TICK_RATE;
                    if (adjustedDistance > 10 && other.t > 0.10) {
                        var denom = adjustedDistance;
                        if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                            return new Acceleration(agent.speed, agent.speed / 4, 1 / denom);
                        } else {
                            return new Acceleration(agent.acceleration.start, agent.speed / 4, 1 / denom);
                        }
                    }
                }
            }
        }
        return undefined;
    }
}

export class LaneChangeBehaviour extends AbstractAgentBehaviour {
    public evaluate(agent: Agent) {
        if (agent.path.length > 0 && agent.path[agent.path.length - 1] instanceof LaneChangePathSegment) {
            var laneChange: LaneChangePathSegment = agent.path[agent.path.length - 1] as LaneChangePathSegment;
            var nextT = laneChange.exitEdge.curve.next(agent.t, 20 * agent.speed / Simulation.TICK_RATE)
            var location = laneChange.exitEdge.curve.evaluate(nextT);
            var safeDistance = 20 + 10 * agent.speed / Simulation.TICK_RATE;
            var isSafe = true;
            for (var other of agent.map.agents) {
                if (other.edge == undefined) continue;
                if ((other.t < laneChange.exitPoint && other.edge.getEphemeralEdge() == laneChange.exitEdge) ||
                    other.edge.getEphemeralEdge().dest == laneChange.exitEdge.source) {
                    var distance = other.location.distance(location);
                    if (distance < safeDistance) {
                        isSafe = false;
                    }
                } else if (other.edge.getEphemeralEdge().source == laneChange.exitEdge.source &&
                    laneChange.exitEdge.sourceVertex.location.distance(laneChange.getEphemeralEdge().destVertex.location) < 15 &&
                    other.location.distance(laneChange.exitEdge.sourceVertex.location) < 15) {
                    isSafe = false;
                }
            }
            if (isSafe || agent.destDistance < 15) {
                agent.path.pop();
                laneChange.setPoints(agent.t, nextT < 1 ? nextT : 1);
                agent.edge = laneChange;
                agent.t = 0;
            }
        }
        return undefined;
    }
}

export class RedLightRightTurnBehaviour extends AbstractAgentBehaviour {

    private speedModifier: number
    private ticksStopped: number

    constructor(priority: number, speedModifier: number) {
        super(priority);
        this.speedModifier = speedModifier;
    }

    public evaluate(agent: Agent) {
        if (agent.path.length > 0 && agent.destDistance < 10 * agent.speed / Simulation.TICK_RATE) {
            var edge = agent.path[agent.path.length - 1].getEphemeralEdge();
            if (edge.stopOnRed && edge.currentPriority > 0 && edge.currentPriority < 1) {
                var source = agent.path[agent.path.length - 1].getEphemeralEdge().sourceVertex;
                var count = 0;
                var prioritySum = 0;
                for (var e of agent.map.edges) {
                    if (e.sourceVertex == source && e != edge) {
                        count++;
                        prioritySum += e.currentPriority;
                    }
                }
                if (count != 0 && prioritySum == 0) {
                    if (this.ticksStopped >= 2) return undefined;
                    if (agent.speed <= 0.01) this.ticksStopped++;
                    return new Acceleration(this.speedModifier * agent.edge.getEphemeralEdge().speed, 0, agent.destDistance > 1 ? 0.05 : 1);
                }
            }
        }
        this.ticksStopped = 0;
        return undefined;
    }
}

export class GoBehaviour extends AbstractAgentBehaviour {

    private speedModifier: number

    constructor(priority: number, speedModifier: number) {
        super(priority);
        this.speedModifier = speedModifier;
    }

    public evaluate(agent: Agent): Acceleration {
        var targetSpeed = this.speedModifier * agent.edge.getEphemeralEdge().speed;
        if (agent.speed == targetSpeed) return undefined;
        return new Acceleration(0, targetSpeed, 0.1);
    }

}

export class IntersectionEnterBehaviour extends AbstractAgentBehaviour {

    constructor(priority: number) {
        super(priority);
    }

    public evaluate(agent: Agent): Acceleration {
        if (agent.path.length == 0) return undefined;
        var nextEdge = agent.path[agent.path.length - 1].getEphemeralEdge();
        if (nextEdge.priorities != undefined && nextEdge.priorities.length > 1) {
            var myDistance = agent.destDistance
            if (myDistance < 10) {
                // If there is someone stopped in the intersection, we should not enter.
                for (var other of agent.map.agents) {
                    if (other != undefined && other.edge != undefined && other.edge.getEphemeralEdge() == nextEdge && other.speed == 0) {
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
                    var subsequentEdge = agent.path[agent.path.length - 2].getEphemeralEdge();
                    var existsAgentOnNextEdge = 0;
                    for (var other of agent.map.agents) {
                        if (other != undefined && other.edge != undefined && (other.edge.getEphemeralEdge() == nextEdge || other.edge.getEphemeralEdge().dest == nextEdge.dest || other.edge.getEphemeralEdge() == subsequentEdge && other.speed != 0)) {
                            existsAgentOnNextEdge++;
                        }
                    }
                    for (var other of agent.map.agents) {
                        if (other != undefined && other.edge != undefined && other.edge.getEphemeralEdge() == subsequentEdge && other.speed == 0 && other.location.distance(subsequentEdge.sourceVertex.location) < 15 * (existsAgentOnNextEdge) + 5) {
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

export class StopBehaviour extends AbstractAgentBehaviour {

    private speedModifier: number

    constructor(priority: number, speedModifier: number) {
        super(priority);
        this.speedModifier = speedModifier;
    }

    public evaluate(agent: Agent): Acceleration {
        if (agent.path.length > 0 && agent.path[agent.path.length - 1].getEphemeralEdge().currentPriority == 0 && agent.destDistance <= 10 * agent.speed / Simulation.TICK_RATE + 0.5) {
            return new Acceleration(this.speedModifier * agent.edge.getEphemeralEdge().speed, 0, 0.05);
        } else if (agent.edge.getEphemeralEdge().currentPriority == 0 && agent.location.distance(agent.edge.getEphemeralEdge().sourceVertex.location) <= 1) {
            return new Acceleration(agent.speed, 0, 1);
        }
        return undefined;
    }

}

export class SpeedLimitBehaviour extends AbstractAgentBehaviour {
    private speedModifier: number

    constructor(priority: number, speedModifier: number) {
        super(priority);
        this.speedModifier = speedModifier;
    }

    public evaluate(agent: Agent): Acceleration {
        if (agent.path.length > 0 &&
            agent.edge.getEphemeralEdge().speed > agent.path[agent.path.length - 1].getEphemeralEdge().speed &&
            agent.destDistance < agent.edge.getEphemeralEdge().speed - agent.path[agent.path.length - 1].getEphemeralEdge().speed) { // We should slow down
            return new Acceleration(this.speedModifier * agent.edge.getEphemeralEdge().speed, this.speedModifier * agent.path[agent.path.length - 1].getEphemeralEdge().speed, 1 / (agent.edge.getEphemeralEdge().speed - agent.path[agent.path.length - 1].getEphemeralEdge().speed));
        }
        return undefined;
    }
}

export class CutOffBehaviour extends AbstractAgentBehaviour {

    public evaluate(agent: Agent): Acceleration {
        if (agent.edge.getEphemeralEdge().intersectPoints.length == 0 && (agent.path.length == 0 || agent.path[agent.path.length - 1].getEphemeralEdge().intersectPoints.length == 0))
            return undefined;
        var xIncreasing = agent.edge.getEphemeralEdge().sourceVertex.location.x <= agent.edge.getEphemeralEdge().destVertex.location.x;
        var yIncreasing = agent.edge.getEphemeralEdge().sourceVertex.location.y <= agent.edge.getEphemeralEdge().destVertex.location.y;

        var intersection: EdgeIntersect;
        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            if ((intersection = this.getIntersection(agent, other)) != undefined && intersection.sourceEdge.currentPriority > intersection.edge.currentPriority &&
                xIncreasing == agent.location.x <= intersection.point.x && yIncreasing == agent.location.y <= intersection.point.y) {
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

export class IntersectionBehaviour extends AbstractAgentBehaviour {

    public evaluate(agent: Agent): Acceleration {
        if (agent.edge.getEphemeralEdge().currentPriority == 0) return undefined;
        if (agent.edge.getEphemeralEdge().intersectPoints.length == 0 && (agent.path.length == 0 || agent.path[agent.path.length - 1].getEphemeralEdge().intersectPoints.length == 0))
            return undefined;

        var xIncreasing = agent.edge.getEphemeralEdge().sourceVertex.location.x <= agent.edge.getEphemeralEdge().destVertex.location.x;
        var yIncreasing = agent.edge.getEphemeralEdge().sourceVertex.location.y <= agent.edge.getEphemeralEdge().destVertex.location.y;

        var intersection: EdgeIntersect;
        for (var intersection of agent.edge.getEphemeralEdge().intersectPoints) {
            if (intersection.sourceEdge.currentPriority >= intersection.edge.currentPriority) continue;
            var myDistance = agent.location.distance(intersection.point);
            var mySafeDistance = 30;
            if (myDistance <= 15 || myDistance > mySafeDistance) return undefined; // We are committed to the turn
            for (var other of agent.map.agents) {
                if (other.edge == undefined || other.edge.getEphemeralEdge() != intersection.edge) continue;
                if (xIncreasing == agent.location.x <= intersection.point.x && yIncreasing == agent.location.y <= intersection.point.y
                    // And are they moving toward the intersection?
                    && (other.edge.getEphemeralEdge().sourceVertex.location.x == other.edge.getEphemeralEdge().destVertex.location.x ||
                        other.edge.getEphemeralEdge().sourceVertex.location.x < other.edge.getEphemeralEdge().destVertex.location.x == other.location.x <= intersection.point.x)
                    && (other.edge.getEphemeralEdge().sourceVertex.location.y == other.edge.getEphemeralEdge().destVertex.location.y ||
                        other.edge.getEphemeralEdge().sourceVertex.location.y < other.edge.getEphemeralEdge().destVertex.location.y == other.location.y <= intersection.point.y)) {
                    // Do expensive calculations last
                    var theirDistance = other.location.distance(intersection.point);
                    var theirSafeDistance = 18 + myDistance;
                    if ((other.speed == 0 && theirDistance > 10) || theirDistance > theirSafeDistance) continue;

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

export class YieldBehaviour extends AbstractAgentBehaviour {

    public evaluate(agent: Agent): Acceleration {
        var safeDistance = 20 + 10 * agent.speed / Simulation.TICK_RATE;
        var myDistance = agent.destDistance
        if (myDistance > safeDistance)
            return undefined;
        if (myDistance <= 15)
            return undefined; // Committed to turn

        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            // Moving toward the same point and they have the right of way
            if (this.doSegmentsConjoin(agent.edge, other.edge)) {
                // They have right of way
                if ((agent.edge.getEphemeralEdge().currentPriority != 0 && agent.edge.getEphemeralEdge().currentPriority < other.edge.getEphemeralEdge().currentPriority) ||
                    (agent.edge.getEphemeralEdge().currentPriority != 0 && other.edge.getEphemeralEdge().currentPriority == 0) ||
                    // The light just turned red
                    (agent.edge.getEphemeralEdge().currentPriority == 0 && other.edge.getEphemeralEdge().currentPriority == 0 &&
                        agent.edge.getEphemeralEdge().lastPriority < other.edge.getEphemeralEdge().lastPriority)) {
                    // Do expensive calculations last
                    var theirDistance = other.destDistance;
                    var theirSafeDistance = 5 + myDistance + 12 * other.speed / Simulation.TICK_RATE;
                    if (theirDistance > theirSafeDistance) continue;
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

export class YieldCutOffBehaviour extends AbstractAgentBehaviour {

    public evaluate(agent: Agent): Acceleration {
        var safeDistance = 20 + 10 * agent.speed / Simulation.TICK_RATE;
        var myDistance = agent.destDistance;
        if (myDistance > safeDistance)
            return undefined;

        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            // Moving toward the same point and they have the right of way
            if (this.doSegmentsConjoin(agent.edge, other.edge)) {
                var theirDistance = other.destDistance;
                // They have committed to the turn
                if (theirDistance < 15 && theirDistance < myDistance) {
                    // Adjust acceleration
                    var denom = myDistance - theirDistance;
                    if (denom <= 1) denom = 1;
                    if (agent.acceleration == undefined || agent.acceleration.start <= agent.speed) {
                        return new Acceleration(agent.speed, other.speed, 1 / denom);
                    } else {
                        return new Acceleration(agent.acceleration.start, other.speed, 1 / denom);
                    }
                }
            }
        }
        return undefined;
    }

}

export class FollowingBehaviour extends AbstractAgentBehaviour {

    public evaluate(agent: Agent): Acceleration {
        var minDistance = Infinity;
        var distanceFromDest = agent.destDistance;
        var safeDistance = 10 * agent.speed / Simulation.TICK_RATE + 10; // Start slowing down when within 10 + 10 * speed/unit units of another agent

        for (var other of agent.map.agents) {
            if (other.edge == undefined) continue;
            if (this.doSegmentsConnect(agent.edge, other.edge, agent.t, other.t)) { // Moving toward another agent
                if (agent.edge.getEphemeralEdge() == other.edge.getEphemeralEdge() && agent.destDistance < other.destDistance) continue;
                if (agent.location.x == other.location.x && agent.location.y == other.location.y) // WE are in the same place, don't consider as part of this behaviour.
                    continue;
                var distance = agent.location.distance(other.location);
                if (distance < minDistance && distance < safeDistance && (agent.edge.getEphemeralEdge() != other.edge.getEphemeralEdge() || (distanceFromDest > other.location.distance(other.edge.getEphemeralEdge().destVertex.location)))) {
                    minDistance = distance; // We are the shortest valid distance!
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

