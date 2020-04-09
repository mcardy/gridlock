/**
 * Generic class for a decider returning a type T on an entity E
 */
export class Decider<T, E> {

    private comparitor: (a: T, b: T) => number;
    private behaviours: Behaviour<T, E>[];

    /**
     * Create a new decider with a comparitor to break ties and a set of behaviours
     * Behaviours are evaluated in priority order from 0 to n
     */
    constructor(comparitor: (a: T, b: T) => number, behaviours: Behaviour<T, E>[]) {
        this.comparitor = comparitor;
        this.behaviours = behaviours;
    }

    /**
     * Evaluate this decider on an entity E, returns a type T and the name of the prevaling behaviour
     */
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

/**
 * A behaviour with priority that can be evaluated to return a type T on an entity E
 */
export abstract class Behaviour<T, E> {

    private priority: number;

    /**
     * Instantiate a new behaviour with a priority (lower number = higher priority)
     */
    constructor(priority: number) {
        this.priority = priority;
    }

    /**
     * Returns the priority of the behaviour
     */
    public getPriority(): number {
        return this.priority;
    }

    /**
     * Evaluate the behaviour on a given entity 
     */
    public abstract evaluate(entity: E): T;

}