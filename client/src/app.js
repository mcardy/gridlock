import * as PIXI from 'pixi.js'

let app = new PIXI.Application({
    width: 800,
    height: 600,
    antialias: true,
    transparent: false,
    resolution: 1,
    autoStart: false
});

app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";
app.renderer.autoResize = true;
app.renderer.resize(window.innerWidth, window.innerHeight);

app.renderer.backgroundColor = 0x061639;

document.body.appendChild(app.view);

export { app as app }