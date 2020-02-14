import { BezierCurve, Point2D } from "../common/math";
import assert from 'assert';

describe('bezier', function () {

    // Asserts that bezier curves with a central point are correctly calculated
    it('circular point', function () {
        var start = new Point2D({ x: 100, y: 0 });
        var end = new Point2D({ x: 0, y: 100 });
        var curve = new BezierCurve(start, end, true, new Point2D({ x: 0, y: 0 }))
        assert.deepStrictEqual(curve.evaluate(0.5), new Point2D({ x: 70.71067811865476, y: 70.71067811865476 }));
    })


    // Asserts that bezier lines are correctly calculated
    it('line', function () {
        var start = new Point2D({ x: 0, y: 0 });
        var end = new Point2D({ x: 100, y: 0 });
        var curve = new BezierCurve(start, end);
        var t = 0;
        var step = 0.001;
        var err = 0.0001;
        for (let i = 0; i <= 100; i += 10) {
            var point = curve.evaluate(t);
            assert.equal(Math.abs(point.x - i) < step, true);
            assert.equal(point.y, 0);
            t = curve.next(t, 10, step, err);
        }
    })

})