import * as PIXI from 'pixi.js'

function start() {
    let app = new PIXI.Application({
        width: 800,
        height: 600,
        antialias: true,
        transparent: false,
        resolution: 1
    });

    app.renderer.view.style.position = "absolute";
    app.renderer.view.style.display = "block";
    app.renderer.autoResize = true;
    app.renderer.resize(window.innerWidth, window.innerHeight);

    app.renderer.backgroundColor = 0x061639;

    document.body.appendChild(app.view);
}

start();