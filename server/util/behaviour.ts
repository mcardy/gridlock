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