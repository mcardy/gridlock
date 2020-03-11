import { Schema, type } from '@colyseus/schema';
import { uint32 } from 'random-js';

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

    public dot(p: Point2D): number {
        return this.x * p.x + this.y * p.y;
    }

    public times(k: number): Point2D {
        return new Point2D({ x: this.x * k, y: this.y * k });
    }

    public distance(p: Point2D): number {
        return Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2));
    }

    public len() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
}

export interface EvaluatablePath {
    next(t: number, l: number): number;
    evaluate(t: number): Point2D;
}

export class StraightLine implements EvaluatablePath {

    private start: Point2D;
    private end: Point2D;
    private slope: number;
    private length: number;

    constructor(start: Point2D, end: Point2D) {
        this.start = start;
        this.end = end;
        this.slope = (end.y - start.y) / (end.x - start.x);
        this.length = start.distance(end);
    }

    public next(t: number, l: number): number {
        return t + l / this.length;
    }

    public evaluate(t: number): Point2D {
        return new Point2D({ x: this.start.x + (this.end.x - this.start.x) * t, y: this.start.y + (this.end.y - this.start.y) * t })
    }

}

export class BezierCurve implements EvaluatablePath {

    private origin: Point2D;
    private p1: Point2D;
    private p2: Point2D;
    private p3: Point2D;
    private p4: Point2D;
    private length: number;

    private startPoint: Point2D;
    private startControlPoint: Point2D;
    private endControlPoint: Point2D;
    private endPoint: Point2D;

    constructor(start: Point2D, end: Point2D, invert?: boolean, origin?: Point2D) {
        this.origin = origin != undefined ? origin : new Point2D({ x: invert ? end.x : start.x, y: invert ? start.y : end.y });
        this.p1 = new Point2D(start).minus(this.origin);
        this.p4 = new Point2D(end).minus(this.origin);
        var theta = Math.atan2(this.p1.x * this.p4.y - this.p1.y * this.p4.x, this.p1.x * this.p4.x + this.p1.y * this.p4.y);
        var L = Math.abs(4 * Math.tan(theta / 4) / 3);
        var positive = theta > 0;
        this.p2 = new Point2D({ x: (positive ? -1 : 1) * this.p1.y, y: (positive ? 1 : -1) * this.p1.x }).times(L).plus(this.p1);
        this.p3 = new Point2D({ x: (positive ? 1 : -1) * this.p4.y, y: (positive ? -1 : 1) * this.p4.x }).times(L).plus(this.p4);
        this.startPoint = this.p1.plus(this.origin);
        this.startControlPoint = this.p2.plus(this.origin);
        this.endControlPoint = this.p3.plus(this.origin);
        this.endPoint = this.p4.plus(this.origin);
    }

    public getStartPoint(): Point2D {
        return this.startPoint;
    }

    public getStartControlPoint(): Point2D {
        return this.startControlPoint;
    }

    public getEndControlPoint(): Point2D {
        return this.endControlPoint;
    }

    public getEndPoint(): Point2D {
        return this.endPoint;
    }

    public getLength(): number {
        if (this.length == undefined) {
            var last = new Point2D(this.startPoint);
            this.length = 0;
            for (let t = 0; t < 1; t += 0.01) {
                var next = this.evaluate(t);
                this.length += last.distance(next);
                last = next;
            }
        }
        return this.length;
    }

    public evaluate(t: number): Point2D {
        var x = Math.pow(1 - t, 3) * this.startPoint.x + 3 * t * Math.pow(1 - t, 2) * this.startControlPoint.x + 3 * Math.pow(t, 2) * (1 - t) * this.endControlPoint.x + Math.pow(t, 3) * this.endPoint.x;
        var y = Math.pow(1 - t, 3) * this.startPoint.y + 3 * t * Math.pow(1 - t, 2) * this.startControlPoint.y + 3 * Math.pow(t, 2) * (1 - t) * this.endControlPoint.y + Math.pow(t, 3) * this.endPoint.y;
        return new Point2D({ x: x, y: y });
    }

    /**
     * Move l units the curve.
     * @param t The t value
     * @param l The length value
     * @param step The step size: a smaller step size will increase accuracy but also the computation steps
     * @param err The error size: a smaller error size will increase percision but also the computation steps
     */
    public next(t_0: number, l: number, step: number = 0.01, err: number = 0.0001): number {
        if (l == 0 || Number.isNaN(l) || !Number.isFinite(l) || l == undefined) return t_0;
        var t = t_0;
        var d = 0;
        var last = this.evaluate(t);
        while (d < l && (t = t + step) <= 1) {
            var next = this.evaluate(t);
            d += last.distance(next);
            last = next;
        }
        if (t >= 1) return 1; // Don't go beyond the end
        while ((Math.abs(d - l)) > err) {
            step = step / 2;
            t += (d > l ? -1 : 1) * step;
            var next = this.evaluate(t);
            d += (d > l ? -1 : 1) * last.distance(next);
            last = next;
        }
        return t;
    }

}