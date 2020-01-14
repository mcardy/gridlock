import * as PIXI from 'pixi.js'
import { app } from './app'

function render(state) {
    app.stage.removeChildren();
    renderMap(state.map);
    state.agents.forEach(function (agent) {
        renderAgent(agent.location.x, agent.location.y)
    });
    app.render();
}

function renderMap(map) {
    var vertices = map.vertices;
    var edges = map.edges;
    vertices.forEach(function (vertex) {
        drawVertex(vertex.location.x, vertex.location.y);
    });

    edges.forEach(function (edge) {
        if (edge.source != NaN && edge.dest != NaN) {
            var invert = edge.invert;
            drawCurve(edge.source.location, edge.dest.location, invert);
        }
    });
}

function drawCurve(l1, l2, invert = false) {
    let curve = new PIXI.Graphics();
    curve.lineStyle(4, 0xFFFFFF, 0.5);
    curve.moveTo(l1.x, l1.y);
    if (l1.x == l2.x || l1.y == l2.y) {
        curve.lineTo(l2.x, l2.y);
    } else {
        var ctrlX = invert ? l1.x : l2.x;
        var ctrlY = invert ? l2.y : l1.y;
        curve.quadraticCurveTo(ctrlX, ctrlY, l2.x, l2.y);
    }

    app.stage.addChild(curve);
}

function drawVertex(x, y) {
    let circle = new PIXI.Graphics();
    circle.beginFill(0x9966FF);
    circle.drawCircle(0, 0, 4);
    circle.endFill();
    circle.x = x
    circle.y = y;
    app.stage.addChild(circle);
}

function renderAgent(x, y) {
    let circle = new PIXI.Graphics();
    circle.beginFill(0xab385f);
    circle.drawCircle(0, 0, 4);
    circle.endFill();
    circle.x = x
    circle.y = y;
    app.stage.addChild(circle);
}

export { render as render }