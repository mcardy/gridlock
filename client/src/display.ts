import * as PIXI from 'pixi.js'
import { Point2D, BezierCurve } from '../../common/math'
import Colours from './util/style';

class Display {
    PixiApp: PIXI.Application;

    private map;

    private selectedEdge: { sourceId: number, destId: number };
    private selectedVertex: { id: number }
    private selectedAgent: { id: number }

    public edgeCallback: (source: number, dest: number) => void;
    public vertexCallback: (id: number) => void;
    public agentCallback: (id: number) => void;

    private clickables: PIXI.DisplayObject[];

    private edgeContainer: PIXI.Container;
    private vertexContainer: PIXI.Container;
    private agentContainer: PIXI.Container;

    private uiContainer: PIXI.Container;

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

        this.edgeContainer = new PIXI.Container();
        this.vertexContainer = new PIXI.Container();
        this.agentContainer = new PIXI.Container();
        this.uiContainer = new PIXI.Container();

        this.PixiApp.stage.addChild(this.edgeContainer, this.vertexContainer, this.agentContainer, this.uiContainer);

        let overlay = new PIXI.Graphics();
        overlay.interactive = true;
        overlay.hitArea = new PIXI.Rectangle(0, 0, this.PixiApp.screen.width, this.PixiApp.screen.height);
        overlay.on('click', this.onClick.bind(this));
        this.PixiApp.stage.addChild(overlay);
    }

    public drawMap(map): void {
        this.map = map;
        var screenWidth = this.PixiApp.screen.width;
        var screenHeight = this.PixiApp.screen.height;
        var width = map.width;
        var height = map.height;
        var scaler = Math.min(screenWidth / width, screenHeight / height);
        var clickables: PIXI.DisplayObject[] = [];

        var vertices = map.vertices;
        var edges = map.edges;

        this.vertexContainer.removeChildren();
        this.edgeContainer.removeChildren();
        this.agentContainer.removeChildren();
        this.uiContainer.removeChildren();

        for (let vertex of vertices) {
            let child = this.drawVertex(vertex.id, vertex.location.x, vertex.location.y, scaler);
            this.edgeContainer.addChild(child);
            clickables.push(child);
        }
        for (let edge of edges) {
            if (edge.source != NaN && edge.dest != NaN) {
                var invert = "invert" in edge ? edge.invert : false;
                var priority = "currentPriority" in edge ? edge.currentPriority : 1;
                var source, dest;
                source = vertices.find((v) => v.id == edge.source);
                dest = vertices.find((v) => v.id == edge.dest);
                if (source == undefined || dest == undefined) return;
                let child = this.drawCurve(source, dest, invert, priority == 0 ? 0xFF0000 : (edge.priorities != undefined && edge.priorities.length > 1 ? 0x00FF00 : 0xFFFFFF), scaler, (edge.ctrlX == undefined || edge.ctrlY == undefined) ? undefined : new Point2D({ x: edge.ctrlX, y: edge.ctrlY }));
                this.edgeContainer.addChild(child);
                clickables.push(child);
            }
        }
        clickables.reverse();
        if (map.agents) {
            var agents = map.agents;
            for (let agent of agents) {
                let child = this.drawAgent(agent.id, agent.location.x, agent.location.y, agent.sourceId, agent.destId, agent.speed, scaler);
                this.agentContainer.addChild(child);
                clickables.push(child);
            }
        }
        clickables.reverse();

        this.clickables = clickables;

        this.PixiApp.render(); // Draw
    }

    private onClick(event) {
        var previousEdge = this.selectedEdge;
        var previousVertex = this.selectedVertex;
        var previousAgent = this.selectedAgent;
        var click = new Point2D(this.PixiApp.renderer.plugins.interaction.mouse.global);
        for (var child of this.clickables) {
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
                this.callEdgeCallback(undefined, undefined);
            } else if (this.edgeCallback != undefined) {
                this.callEdgeCallback(this.selectedEdge.sourceId, this.selectedEdge.destId);
            }
            redraw = true;
        }
        if (this.selectedVertex != undefined) {
            if (this.selectedVertex == previousVertex) {
                this.selectedVertex = undefined;
                this.callVertexCallback(undefined);
            } else if (this.vertexCallback != undefined) {
                this.callVertexCallback(this.selectedVertex.id);
            }
            redraw = true;
        }
        if (this.selectedAgent != undefined) {
            if (this.selectedAgent == previousAgent) {
                this.selectedAgent = undefined;
                this.callAgentCallback(undefined);
            } else if (this.agentCallback != undefined) {
                this.callAgentCallback(this.selectedAgent.id);
            }
            redraw = true;
        }
        if (redraw) {
            this.drawMap(this.map);
        }
    }

    public callVertexCallback(id: number) {
        if (this.vertexCallback != undefined)
            this.vertexCallback(id);
    }

    public callEdgeCallback(source: number, dest: number) {
        if (this.edgeCallback != undefined)
            this.edgeCallback(source, dest);
    }

    public callAgentCallback(id: number) {
        if (this.agentCallback != undefined)
            this.agentCallback(id);
    }

    public setEdgeSelectCallback(fn: (source: number, dest: number) => void): void {
        this.edgeCallback = fn;
    }

    public setVertexSelectCallback(fn: (id: number) => void): void {
        this.vertexCallback = fn;
    }

    public setAgentSelectCallback(fn: (id: number) => void): void {
        this.agentCallback = fn;
    }

    public getSelectedEdge(): { sourceId: number, destId: number } {
        return this.selectedEdge;
    }

    public getSelectedVertex(): { id: number } {
        return this.selectedVertex;
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

    private isSelectedAgent(id: number) {
        return this.selectedAgent != undefined && this.selectedAgent.id == id;
    }

    private setSelectedAgent(id: number): void {
        this.selectedAgent = { id: id };
    }

    private drawCurve(source, dest, invert = false, color = 0xFFFFFF, scaler = 1, origin = undefined): PIXI.DisplayObject {
        var l1 = source.location;
        var l2 = dest.location;
        let curve = new PIXI.Graphics();
        curve.lineStyle(4, color, this.isSelectedEdge(source.id, dest.id) ? 1 : 0.5);
        curve.moveTo(l1.x * scaler, l1.y * scaler);
        if ((l1.x == l2.x || l1.y == l2.y) && origin == undefined) {
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
        return curve;
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
        if (this.isSelectedVertex(id)) {
            this.drawUI(x, y, "[" + id + "] x: " + x + ", y: " + y, scaler);
        }
        return circle;
    }

    private drawAgent(id, x, y, source, dest, speed, scaler = 1) {
        let circle = new PIXI.Graphics();
        circle.beginFill(this.isSelectedAgent(id) ? 0xFFFFFF : Colours.danger);
        circle.drawCircle(0, 0, 4 * scaler);
        circle.endFill();
        circle.x = x * scaler;
        circle.y = y * scaler;
        circle.hitArea = new PIXI.Circle(circle.x, circle.y, 4 * scaler);
        circle.on('customclick', () => {
            this.setSelectedAgent(id);
            return true;
        })
        if (this.isSelectedAgent(id)) {
            this.drawUI(x, y, "[" + id + "] source: " + source + ", dest: " + dest + ", speed: " + speed, scaler);
        }
        return circle;
    }

    private drawUI(x: number, y: number, msg: string, scaler: number) {
        let container = new PIXI.Container();
        var borderWidth = 4;
        var xOffset = 6 * scaler;
        var yOffset = -4 * scaler - borderWidth;
        let text = new PIXI.Text(msg);
        text.style = { fill: "black", font: "8pt Arial" };
        var originalHeight = text.height;
        text.height = 8 * scaler;
        text.width = text.width * (text.height / originalHeight);
        if (scaler * x + xOffset + text.width + borderWidth > this.PixiApp.view.width) {
            xOffset = -xOffset - text.width - 2 * borderWidth;
        } else if (scaler * y + yOffset + text.height + borderWidth > this.PixiApp.view.height) {
            yOffset = yOffset - text.height;
            xOffset = - text.width / 2 - 2 * borderWidth;
        } else if (scaler * y + yOffset <= 0) {
            yOffset = yOffset + text.height + 2 * borderWidth;
            xOffset = - text.width / 2 - borderWidth;
        }
        text.position.x = scaler * x + xOffset + borderWidth;
        text.position.y = scaler * y + yOffset + borderWidth;
        let rect = new PIXI.Graphics();
        rect.beginFill(Colours.bgLight);
        rect.drawRoundedRect(scaler * x + xOffset, scaler * y + yOffset, text.width + 2 * borderWidth, text.height + 2 * borderWidth, borderWidth);
        container.addChild(rect);
        container.addChild(text);
        this.uiContainer.addChild(container);
    }

}

var display = new Display();

export { Display as Display, display as display };