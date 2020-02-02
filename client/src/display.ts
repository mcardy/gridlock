import * as PIXI from 'pixi.js'
import { Point2D, BezierCurve } from '../../common/math'
import Colours from './util/style';

class Display {
    PixiApp: PIXI.Application;

    private map;

    private selectedEdge: { sourceId: number, destId: number };
    private selectedVertex: { id: number }

    private edgeCallback: (source: number, dest: number) => void;
    private vertexCallback: (id: number) => void;

    constructor() {
        this.PixiApp = new PIXI.Application({
            width: 800,
            height: 600,
            antialias: true,
            transparent: false,
            resolution: 1,
            autoStart: false
        });

        this.PixiApp.renderer.view.style.position = "absolute";
        this.PixiApp.renderer.view.style.display = "block";

        this.PixiApp.renderer.backgroundColor = Colours.bgDark;

        this.PixiApp.renderer.resize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.PixiApp.view);
    }

    drawMap(map): void {
        this.map = map;
        this.PixiApp.stage.removeChildren(); // Clear the screen
        var screenWidth = this.PixiApp.screen.width;
        var screenHeight = this.PixiApp.screen.height;
        var width = map.width;
        var height = map.height;
        var scaler = Math.min(screenWidth / width, screenHeight / height);

        var vertices = map.vertices;
        var edges = map.edges;
        for (let vertex of vertices) {
            this.drawVertex(vertex.id, vertex.location.x, vertex.location.y, scaler);
        }
        for (let edge of edges) {
            if (edge.source != NaN && edge.dest != NaN) {
                var invert = "invert" in edge ? edge.invert : false;
                var priority = "currentPriority" in edge ? edge.currentPriority : 1;
                var source, dest;
                source = vertices.find((v) => v.id == edge.source);
                dest = vertices.find((v) => v.id == edge.dest);
                if (source == undefined || dest == undefined) return;
                this.drawCurve(source, dest, invert, priority == 0, scaler, (edge.ctrlX == undefined || edge.ctrlY == undefined) ? undefined : new Point2D({ x: edge.ctrlX, y: edge.ctrlY }));
            }
        }
        if (map.agents) {
            var agents = map.agents;
            for (let agent of agents) {
                this.drawAgent(agent.location.x, agent.location.y, scaler)
            }
        }

        let overlay = new PIXI.Graphics();
        overlay.interactive = true;
        overlay.hitArea = new PIXI.Rectangle(0, 0, screenWidth, screenHeight);
        overlay.on('click', e => {
            var previousEdge = this.selectedEdge;
            var previousVertex = this.selectedVertex;
            var click = new Point2D(this.PixiApp.renderer.plugins.interaction.mouse.global);
            for (var child of this.PixiApp.stage.children) {
                if (child.hitArea != undefined) {
                    if (child.hitArea.contains(click.x, click.y)) {
                        var listener = child.listeners('customclick')[0];
                        if (listener && listener()) {
                            break;
                        }
                    }
                }
            }
            var redraw = false;
            if (this.selectedEdge != undefined) {
                if (this.selectedEdge == previousEdge) {
                    this.selectedEdge = undefined;
                } else if (this.edgeCallback != undefined) {
                    this.edgeCallback(this.selectedEdge.sourceId, this.selectedEdge.destId);
                }
                redraw = true;
            }
            if (this.selectedVertex != undefined) {
                if (this.selectedVertex == previousVertex) {
                    this.selectedVertex = undefined;
                } else if (this.vertexCallback != undefined) {
                    this.vertexCallback(this.selectedVertex.id);
                }
                redraw = true;
            }
            if (redraw) {
                this.drawMap(this.map);
            }
        })
        this.PixiApp.stage.addChild(overlay);

        this.PixiApp.render(); // Draw
    }

    public setEdgeSelectCallback(fn: (source: number, dest: number) => void) {
        this.edgeCallback = fn;
    }

    public setVertexSelectCallback(fn: (id: number) => void) {
        this.vertexCallback = fn;
    }

    private isSelectedEdge(source: number, dest: number): boolean {
        return this.selectedEdge != undefined && this.selectedEdge.sourceId == source && this.selectedEdge.destId == dest;
    }

    private setSelectedEdge(source: number, dest: number): void {
        this.selectedEdge = { sourceId: source, destId: dest };
    }

    private isSelectedVertex(id: number): boolean {
        return this.selectedVertex != undefined && this.selectedVertex.id == id;
    }

    private setSelectedVertex(id: number): void {
        this.selectedVertex = { id: id };
    }

    private drawCurve(source, dest, invert = false, disabled = false, scaler = 1, origin = undefined) {
        var l1 = source.location;
        var l2 = dest.location;
        let curve = new PIXI.Graphics();
        curve.lineStyle(4, !disabled ? 0xFFFFFF : 0xFF0000, this.isSelectedEdge(source.id, dest.id) ? 1 : 0.5);
        curve.moveTo(l1.x * scaler, l1.y * scaler);
        if (l1.x == l2.x || l1.y == l2.y) {
            curve.lineTo(l2.x * scaler, l2.y * scaler);
            curve.hitArea = curve.getBounds();
            curve.on('customclick', () => {
                this.setSelectedEdge(source.id, dest.id);
                return true;
            });
        } else {
            var path = new BezierCurve(new Point2D(l1), new Point2D(l2), invert, origin);
            var p2 = path.getStartControlPoint();
            var p3 = path.getEndControlPoint();
            curve.bezierCurveTo(p2.x * scaler, p2.y * scaler, p3.x * scaler, p3.y * scaler, l2.x * scaler, l2.y * scaler);
            curve.hitArea = curve.getBounds();
            curve.on('customclick', () => {
                var click = new Point2D(this.PixiApp.renderer.plugins.interaction.mouse.global).times(1 / scaler);
                for (var t = 0; t <= 1; t += 0.01) {
                    if (click.distance(path.evaluate(t)) < 2) {
                        this.setSelectedEdge(source.id, dest.id);
                        return true;
                    }
                }
                return false;
            });
        }

        this.PixiApp.stage.addChild(curve);
    }

    private drawVertex(id, x, y, scaler = 1) {
        let circle = new PIXI.Graphics();
        circle.beginFill(this.isSelectedVertex(id) ? 0x99aaff : 0x9966FF);
        circle.drawCircle(0, 0, 4 * scaler);
        circle.endFill();
        circle.x = x * scaler;
        circle.y = y * scaler;
        circle.hitArea = new PIXI.Circle(circle.x, circle.y, 4 * scaler);
        circle.on('customclick', () => {
            this.setSelectedVertex(id);
            return true;
        })
        this.PixiApp.stage.addChild(circle);
    }

    private drawAgent(x, y, scaler = 1) {
        let circle = new PIXI.Graphics();
        circle.beginFill(Colours.danger);
        circle.drawCircle(0, 0, 4 * scaler);
        circle.endFill();
        circle.x = x * scaler;
        circle.y = y * scaler;
        this.PixiApp.stage.addChild(circle);
    }

}

var display = new Display();

export { Display as Display, display as display };