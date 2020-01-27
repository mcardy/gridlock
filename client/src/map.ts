import * as PIXI from 'pixi.js'
import { app } from './app'
import { Point2D, BezierCurve } from '../../common/math'

function render(map) {
    app.stage.removeChildren();
    renderMap(map);
    app.render();
}

function renderMap(map) {
    var screenWidth = app.screen.width;
    var screenHeight = app.screen.height;
    var width = map.width;
    var height = map.height;
    var scaler = Math.min(screenWidth / width, screenHeight / height);

    var vertices = map.vertices;
    var edges = map.edges;
    vertices.forEach(function (vertex) {
        drawVertex(vertex.location.x, vertex.location.y, scaler);
    });
    edges.forEach(function (edge) {
        if (edge.source != NaN && edge.dest != NaN) {
            var invert = "invert" in edge ? edge.invert : false;
            var priority = "currentPriority" in edge ? edge.currentPriority : 1;
            var source, dest;
            if (typeof edge.source == "number") {
                source = vertices.find((v) => v.id == edge.source);
                dest = vertices.find((v) => v.id == edge.dest);
            } else {
                source = edge.source;
                dest = edge.dest;
            }
            if (source == "undefined" || dest == "undefined") return;
            drawCurve(source.location, dest.location, invert, priority == 0, scaler, (edge.ctrlX == undefined || edge.ctrlY == undefined) ? undefined : new Point2D({ x: edge.ctrlX, y: edge.ctrlY }));
        }
    });
    if (map.agents) {
        var agents = map.agents;
        agents.forEach(function (agent) {
            renderAgent(agent.location.x, agent.location.y, scaler)
        });
    }
}

function drawCurve(l1, l2, invert = false, disabled = false, scaler = 1, origin = undefined) {
    let curve = new PIXI.Graphics();
    curve.lineStyle(4, !disabled ? 0xFFFFFF : 0xFF0000, 0.5);
    curve.moveTo(l1.x * scaler, l1.y * scaler);
    if (l1.x == l2.x || l1.y == l2.y) {
        curve.lineTo(l2.x * scaler, l2.y * scaler);
    } else {
        var path = new BezierCurve(new Point2D(l1), new Point2D(l2), invert, origin);
        var p2 = path.startCtrl();
        var p3 = path.endCtrl();
        curve.bezierCurveTo(p2.x * scaler, p2.y * scaler, p3.x * scaler, p3.y * scaler, l2.x * scaler, l2.y * scaler);
    }

    app.stage.addChild(curve);
}

function drawVertex(x, y, scaler = 1) {
    let circle = new PIXI.Graphics();
    circle.beginFill(0x9966FF);
    circle.drawCircle(0, 0, 4 * scaler);
    circle.endFill();
    circle.x = x * scaler;
    circle.y = y * scaler;
    app.stage.addChild(circle);
}

function renderAgent(x, y, scaler = 1) {
    let circle = new PIXI.Graphics();
    circle.beginFill(0xab385f);
    circle.drawCircle(0, 0, 4 * scaler);
    circle.endFill();
    circle.x = x * scaler;
    circle.y = y * scaler;
    app.stage.addChild(circle);
}

export { render as render }