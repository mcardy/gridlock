import { Acceleration } from '../server/agent';
import assert from 'assert';

describe('acceleration', function () {

    var testCases = [{ start: 5, end: 2 }, { start: -1, end: 2 }];
    for (var test of testCases) {
        it('endpoints', function () {
            var acc = new Acceleration(test.start, test.end, 0.1);
            assert.equal(acc.evaluate(0), test.start);
            assert.equal(acc.evaluate(1), test.end);
        })
        it('reverse', function () {
            var acc = new Acceleration(test.start, test.end, 0.1);
            for (var t = 0; t < 1; t += acc.rate) {
                var point = acc.evaluate(t);
                assert.equal(Math.abs(acc.lookup(point) - t) <= 0.00000001, true);
            }
        })
        it('interval', function () {
            var acc = new Acceleration(test.start, test.end, 0.1);
            for (var t = 0; t <= 1; t += acc.rate) {
                var point = acc.evaluate(t);
                assert.equal(point >= test.start && point <= test.end, true);
            }
        })
    }

});