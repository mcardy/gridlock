import { Point2D } from "../common/math";
import assert from 'assert';

describe('point', function () {

    var additionTests = [
        { a: new Point2D({ x: 1, y: 1 }), b: new Point2D({ x: 1, y: 1 }), c: new Point2D({ x: 2, y: 2 }) },
        { a: new Point2D({ x: 1, y: 1 }), b: new Point2D({ x: 0, y: 0 }), c: new Point2D({ x: 1, y: 1 }) },
        { a: new Point2D({ x: -1, y: -2 }), b: new Point2D({ x: 3, y: 4 }), c: new Point2D({ x: 2, y: 2 }) }
    ];

    additionTests.forEach((test) => {
        it('addition', function () {
            assert.deepStrictEqual(test.a.plus(test.b), test.c);
        })
    });


})