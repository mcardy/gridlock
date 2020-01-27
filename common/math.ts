import { Schema, type } from '@colyseus/schema';

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

export class BezierCurve {

    origin: Point2D;
    p1: Point2D;
    p2: Point2D;
    p3: Point2D;
    p4: Point2D;
    length: number;

    constructor(start: Point2D, end: Point2D, invert?: boolean, origin?: Point2D) {
        this.origin = origin != undefined ? origin : new Point2D({ x: invert ? end.x : start.x, y: invert ? start.y : end.y });
        this.p1 = new Point2D(start).minus(this.origin);
        this.p4 = new Point2D(end).minus(this.origin);
        var theta = Math.atan2(this.p1.x * this.p4.y - this.p1.y * this.p4.x, this.p1.x * this.p4.x + this.p1.y * this.p4.y);
        var L = Math.abs(4 * Math.tan(theta / 4) / 3);
        var positive = theta > 0;
        this.p2 = new Point2D({ x: (positive ? -1 : 1) * this.p1.y, y: (positive ? 1 : -1) * this.p1.x }).times(L).plus(this.p1);
        this.p3 = new Point2D({ x: (positive ? 1 : -1) * this.p4.y, y: (positive ? -1 : 1) * this.p4.x }).times(L).plus(this.p4);
    }

    public startPoint(): Point2D {
        return this.p1.plus(this.origin);
    }

    public startCtrl(): Point2D {
        return this.p2.plus(this.origin);
    }

    public endCtrl(): Point2D {
        return this.p3.plus(this.origin);
    }

    public endPoint(): Point2D {
        return this.p4.plus(this.origin);
    }



}