import * as PIXI from 'pixi.js'
import { Point2D, BezierCurve } from '../../common/math'
import Colours from './util/style';

class Display {
    PixiApp: PIXI.Application;

    private map;

    private selectedEdges: { sourceId: number, destId: number }[] = [];
    private selectedVertices: number[] = [];
    private selectedAgents: number[] = [];

    public edgeCallback: (source: number, dest: number) => void;
    public vertexCallback: (id: number) => void;
    public agentCallback: (id: number) => void;

    private clickables: PIXI.DisplayObject[];

    private edgeContainer: PIXI.Container;
    private vertexContainer: PIXI.Container;
    private agentContainer: PIXI.Container;

    private uiContainer: PIXI.Container;

    private scaler: number;

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
        this.scaler = Math.min(this.PixiApp.screen.width / map.width, this.PixiApp.screen.height / map.height);
        var clickables: PIXI.DisplayObject[] = [];

        var vertices = map.vertices;
        var edges = map.edges;
        var lanes = map.lanes != undefined ? map.lanes : [];

        this.vertexContainer.removeChildren();
        this.edgeContainer.removeChildren();
        this.agentContainer.removeChildren();
        this.uiContainer.removeChildren();

        for (let vertex of vertices) {
            let child = this.drawVertex(vertex);
            this.edgeContainer.addChild(child);
            clickables.push(child);
        }
        for (let lane of lanes) {
            for (let sourceAndDest of lane.entries) {
                var edge = edges.find(e => e.source == sourceAndDest.source && e.dest == sourceAndDest.dest);
                this.edgeContainer.addChild(this.drawLane(edge));
            }
        }
        for (let edge of edges) {
            if (edge.source != NaN && edge.dest != NaN) {
                let child = this.drawCurve(edge);
                this.edgeContainer.addChild(child);
                clickables.push(child);
            }
        }
        clickables.reverse();
        if (map.agents) {
            var agents = map.agents;
            for (let agent of agents) {
                let child = this.drawAgent(agent);
                this.agentContainer.addChild(child);
                clickables.push(child);
            }
        }
        clickables.reverse();

        this.clickables = clickables;

        this.PixiApp.render(); // Draw
    }

    private onClick(event) {
        var controlClick = event.data.originalEvent.ctrlKey;
        var click = new Point2D(this.PixiApp.renderer.plugins.interaction.mouse.global);
        var clicked = false;
        for (var child of this.clickables) {
            if (child.hitArea != undefined) {
                if (child.hitArea.contains(click.x, click.y)) {
                    var listener = child.listeners('customclick')[0];
                    if (listener && listener(controlClick)) {
                        clicked = true;
                        break;
                    }
                }
            }
        }
        if (!clicked) {
            if (this.selectedAgents.length > 0)
                this.callAgentCallback(undefined);
            this.selectedAgents = [];
            if (this.selectedEdges.length > 0)
                this.callEdgeCallback(undefined, undefined);
            this.selectedEdges = [];
            if (this.selectedVertices.length > 0)
                this.callVertexCallback(undefined);
            this.selectedVertices = [];
        }

        this.redrawMap();
    }

    public redrawMap() {
        if (this.map != undefined) {
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

    public getSelectedEdges(): { sourceId: number, destId: number }[] {
        return this.selectedEdges;
    }

    public getSelectedVertices(): number[] {
        return this.selectedVertices;
    }

    public setSelectedVertices(vertices: number[]): void {
        this.selectedAgents = [];
        this.selectedEdges = [];
        this.selectedVertices = vertices;
        this.redrawMap();
    }

    private isSelectedEdge(source: number, dest: number): boolean {
        for (var edge of this.selectedEdges) {
            if (edge.sourceId == source && edge.destId == dest) {
                return true;
            }
        }
        return false;
    }

    private setSelectedEdge(source: number, dest: number, ctrlClick: boolean): void {
        this.selectedVertices = [];
        this.selectedAgents = [];
        if (!ctrlClick) {
            this.selectedEdges = [];
        }
        this.selectedEdges.push({ sourceId: source, destId: dest });
        this.callEdgeCallback(source, dest);
    }

    private isSelectedVertex(id: number): boolean {
        return this.selectedVertices.indexOf(id) >= 0;
    }

    private setSelectedVertex(id: number, ctrlClick: boolean): void {
        this.selectedAgents = [];
        this.selectedEdges = [];
        if (!ctrlClick) {
            this.selectedVertices = [];
        }
        this.selectedVertices.push(id);
        this.callVertexCallback(id);
    }

    private isSelectedAgent(id: number) {
        return this.selectedAgents.indexOf(id) >= 0;
    }

    private setSelectedAgent(id: number, ctrlClick: boolean): void {
        this.selectedVertices = [];
        this.selectedEdges = [];
        if (!ctrlClick) {
            this.selectedAgents = [];
        }
        this.selectedAgents.push(id);
        this.callAgentCallback(id);
    }

    /**
     * @param edge Edge to draw lane around
     * @param offset 0 => move down half the width, 1 => move up half the width, 0.5 => normal
     * @param width The width to draw
     */
    private drawLane(edge, offset = 0.5, width = 8): PIXI.DisplayObject {
        var color = 0xFFFFFF;
        var invert = "invert" in edge ? edge.invert : false;
        var source, dest;
        source = this.map.vertices.find((v) => v.id == edge.source);
        dest = this.map.vertices.find((v) => v.id == edge.dest);
        if (source == undefined || dest == undefined) return;
        var origin = (edge.ctrlX == undefined || edge.ctrlY == undefined) ? undefined : new Point2D({ x: edge.ctrlX, y: edge.ctrlY });
        var l1 = source.location;
        var l2 = dest.location;
        let curve = new PIXI.Graphics();
        curve.lineStyle(width * this.scaler, color, 0.125, offset);
        curve.moveTo(l1.x * this.scaler, l1.y * this.scaler);
        if ((l1.x == l2.x || l1.y == l2.y) && origin == undefined) {
            curve.lineTo(l2.x * this.scaler, l2.y * this.scaler);
        } else {
            var path = new BezierCurve(new Point2D(l1), new Point2D(l2), invert, origin);
            var p2 = path.getStartControlPoint();
            var p3 = path.getEndControlPoint();
            curve.bezierCurveTo(p2.x * this.scaler, p2.y * this.scaler, p3.x * this.scaler, p3.y * this.scaler, l2.x * this.scaler, l2.y * this.scaler);
        }
        return curve;
    }

    private drawCurve(edge): PIXI.DisplayObject {
        var priority = "currentPriority" in edge ? edge.currentPriority : 1;
        var color = priority == 0 ? 0xFF0000 : (edge.priorities != undefined && edge.priorities.length > 1 ? 0x00FF00 : 0xFFFFFF)
        var invert = "invert" in edge ? edge.invert : false;
        var source, dest;
        source = this.map.vertices.find((v) => v.id == edge.source);
        dest = this.map.vertices.find((v) => v.id == edge.dest);
        if (source == undefined || dest == undefined) return;
        var origin = (edge.ctrlX == undefined || edge.ctrlY == undefined) ? undefined : new Point2D({ x: edge.ctrlX, y: edge.ctrlY });
        var l1 = source.location;
        var l2 = dest.location;
        var labelLocation: Point2D = undefined;
        let curve = new PIXI.Graphics();
        curve.lineStyle(2 * this.scaler, color, this.isSelectedEdge(source.id, dest.id) ? 1 : 0.5);
        curve.moveTo(l1.x * this.scaler, l1.y * this.scaler);
        if ((l1.x == l2.x || l1.y == l2.y) && origin == undefined) {
            curve.lineTo(l2.x * this.scaler, l2.y * this.scaler);
            curve.hitArea = curve.getBounds();
            curve.on('customclick', (ctrlClick: boolean) => {
                this.setSelectedEdge(source.id, dest.id, ctrlClick);
                return true;
            });
            labelLocation = new Point2D({ x: Math.min(l1.x, l2.x), y: (l1.y + l2.y) / 2 + (l1.y == l2.y ? 10 : 0) });
        } else {
            var path = new BezierCurve(new Point2D(l1), new Point2D(l2), invert, origin);
            var p2 = path.getStartControlPoint();
            var p3 = path.getEndControlPoint();
            curve.bezierCurveTo(p2.x * this.scaler, p2.y * this.scaler, p3.x * this.scaler, p3.y * this.scaler, l2.x * this.scaler, l2.y * this.scaler);
            curve.hitArea = curve.getBounds();
            curve.on('customclick', (ctrlClick: boolean) => {
                var click = new Point2D(this.PixiApp.renderer.plugins.interaction.mouse.global).times(1 / this.scaler);
                for (var t = 0; t <= 1; t += 0.01) {
                    if (click.distance(path.evaluate(t)) < 2) {
                        this.setSelectedEdge(source.id, dest.id, ctrlClick);
                        return true;
                    }
                }
                return false;
            });
            labelLocation = path.evaluate(0.5);
        }
        if (this.isSelectedEdge(source.id, dest.id)) {
            var text = ["Source: " + source.id + ", Destination: " + dest.id, "Speed Limit: " + edge.speed];
            if ("priorities" in edge) {
                if (edge.priorities.length == 1) {
                    text.push("Priority: " + edge.priorities[0]);
                } else {
                    text.push("Priorities: " + edge.priorities.join(","));
                }
            }
            this.drawUI(labelLocation.x, labelLocation.y, text);
        }
        return curve;
    }

    private drawVertex(vertex) {
        let circle = new PIXI.Graphics();
        circle.beginFill(this.isSelectedVertex(vertex.id) ? 0x99aaff : 0x9966FF);
        circle.drawCircle(0, 0, 4 * this.scaler);
        circle.endFill();
        circle.x = vertex.location.x * this.scaler;
        circle.y = vertex.location.y * this.scaler;
        circle.hitArea = new PIXI.Circle(circle.x, circle.y, 4 * this.scaler);
        circle.on('customclick', (ctrlClick: boolean) => {
            this.setSelectedVertex(vertex.id, ctrlClick);
            return true;
        })
        if (this.isSelectedVertex(vertex.id)) {
            this.drawUI(vertex.location.x, vertex.location.y, ["[" + vertex.id + "] x: " + vertex.location.x + ", y: " + vertex.location.y, "Source: " + vertex.source + ", " + "Dest: " + vertex.dest]);
        }
        return circle;
    }

    private drawAgent(agent) {
        let circle = new PIXI.Graphics();
        circle.beginFill(this.isSelectedAgent(agent.id) ? 0xFFFFFF : Colours.danger);
        circle.drawCircle(0, 0, 4 * this.scaler);
        circle.endFill();
        circle.x = agent.location.x * this.scaler;
        circle.y = agent.location.y * this.scaler;
        circle.hitArea = new PIXI.Circle(circle.x, circle.y, 4 * this.scaler);
        circle.on('customclick', (ctrlClick: boolean) => {
            this.setSelectedAgent(agent.id, ctrlClick);
            return true;
        })
        if (this.isSelectedAgent(agent.id)) {
            this.drawUI(agent.location.x, agent.location.y, ["ID: " + agent.id, "Source: " + agent.sourceId + ", Dest: " + agent.destId + ", Speed: " + agent.speed, "Active Behaviour: " + agent.activeBehaviour]);
        }
        return circle;
    }

    private drawUI(x: number, y: number, msg: string[]) {
        let container = new PIXI.Container();
        var borderWidth = 4;
        var xOffset = 6 * this.scaler;
        var yOffset = -4 * this.scaler - borderWidth;
        let text = new PIXI.Text(msg.join('\n'));
        text.style = { fill: "black", font: "8pt Arial" };
        var originalHeight = text.height;
        text.height = 8 * this.scaler * msg.length;
        text.width = text.width * (text.height / originalHeight);
        if (this.scaler * x + xOffset + text.width + borderWidth > this.PixiApp.view.width) {
            xOffset = -xOffset - text.width - 2 * borderWidth;
        } else if (this.scaler * y + yOffset + text.height + borderWidth > this.PixiApp.view.height) {
            yOffset = yOffset - text.height;
            xOffset = - text.width / 2 - 2 * borderWidth;
        } else if (this.scaler * y + yOffset <= 0) {
            yOffset = yOffset + text.height + 2 * borderWidth;
            xOffset = - text.width / 2 - borderWidth;
        }
        text.position.x = this.scaler * x + xOffset + borderWidth;
        text.position.y = this.scaler * y + yOffset + borderWidth;
        let rect = new PIXI.Graphics();
        rect.beginFill(Colours.bgLight, 0.8);
        rect.drawRoundedRect(this.scaler * x + xOffset, this.scaler * y + yOffset, text.width + 2 * borderWidth, text.height + 2 * borderWidth, borderWidth);
        container.addChild(rect);
        container.addChild(text);
        this.uiContainer.addChild(container);
    }

}

var display = new Display();

export { Display as Display, display as display };