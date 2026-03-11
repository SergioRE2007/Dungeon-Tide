import { BulletHellEngine } from './bulletHellEngine.js';
import { Renderer, spritesListos } from './renderer.js';
import * as Sonido from './sonido.js';

let engine = null;
let renderer = null;
let rafId = null;
let tickLoop = null;
let spawnLoop = null;
let onVolverCallback = null;
let listeners = [];
let canvasResizeObserver = null;

// ==================== Input ====================

const keysDown = new Set();
let moveTimer = null;

function _procesarMovimiento() {
    if (!engine || engine.gameOver || !engine.jugador.estaVivo()) return;
    let df = 0, dc = 0;
    if (keysDown.has('w')) df -= 1;
    if (keysDown.has('s')) df += 1;
    if (keysDown.has('a')) dc -= 1;
    if (keysDown.has('d')) dc += 1;
    if (df === 0 && dc === 0) return;
    engine.jugador.moverDir(df, dc, engine.board);
}

function _loopMovimiento() {
    if (!keysDown.has('w') && !keysDown.has('s') && !keysDown.has('a') && !keysDown.has('d')) {
        moveTimer = null;
        return;
    }
    _procesarMovimiento();
    const delay = engine.config.velocidadMoverMs;
    moveTimer = setTimeout(_loopMovimiento, delay);
}

function _startMoveTimer() {
    if (moveTimer) return;
    _procesarMovimiento();
    moveTimer = setTimeout(_loopMovimiento, engine.config.velocidadMoverMs);
}

function _stopMoveTimer() {
    if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
}

// ==================== Render ====================

function _render() {
    if (!engine || !renderer) return;
    renderer.drawBoardOleadas(engine.board, engine);
    _drawHUD();
    rafId = requestAnimationFrame(_render);
}

function _drawHUD() {
    const ctx = renderer.canvas.getContext('2d');
    const w = renderer.canvas.width;
    const t = engine.getTiempoSegundos();

    // Tiempo
    const min = Math.floor(t / 60);
    const seg = Math.floor(t % 60);
    const timeStr = `${min}:${seg.toString().padStart(2, '0')}`;

    ctx.save();
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(timeStr, w / 2 + 2, 12);
    ctx.fillStyle = '#c9a84c';
    ctx.fillText(timeStr, w / 2, 10);

    // Vida
    const j = engine.jugador;
    const barW = 200, barH = 16;
    const barX = w / 2 - barW / 2;
    const barY = 44;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    const pct = Math.max(0, j.vida / j.vidaMax);
    const color = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${j.vida} / ${j.vidaMax}`, w / 2, barY + barH / 2);

    // Balas activas
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#888';
    ctx.fillText(`Balas: ${engine.board.proyectiles.length}`, w - 10, 10);

    // Game Over overlay
    if (engine.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, w, renderer.canvas.height);

        ctx.font = 'bold 48px MedievalSharp, cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('GAME OVER', w / 2, renderer.canvas.height / 2 - 40);

        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#c9a84c';
        ctx.fillText(`Tiempo: ${timeStr}`, w / 2, renderer.canvas.height / 2 + 20);

        ctx.font = '18px monospace';
        ctx.fillStyle = '#888';
        ctx.fillText('Pulsa ESC para volver', w / 2, renderer.canvas.height / 2 + 60);
    }

    ctx.restore();
}

// ==================== Game Loop ====================

function _startLoop() {
    tickLoop = setInterval(() => {
        if (!engine || engine.gameOver) return;
        engine.tick();
    }, engine.config.velocidadMs);
}

function _startSpawnLoop() {
    const spawn = () => {
        if (!engine || engine.gameOver) return;
        engine.spawnBalas();
        const next = engine.getIntervaloSpawn();
        spawnLoop = setTimeout(spawn, next);
    };
    spawnLoop = setTimeout(spawn, engine.config.intervaloSpawnMs);
}

function _stopLoop() {
    if (tickLoop) { clearInterval(tickLoop); tickLoop = null; }
    if (spawnLoop) { clearTimeout(spawnLoop); spawnLoop = null; }
}

function _startRaf() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(_render);
}

function _stopRaf() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// ==================== Canvas Resize ====================

function _redimensionarCanvas(canvas) {
    const container = document.getElementById('bulletHellCanvasContainer');
    if (!container) return;
    const w = container.clientWidth - 6;
    const h = container.clientHeight - 6;
    if (w <= 0 || h <= 0) return;
    canvas.width = w;
    canvas.height = h;
}

function _iniciarResizeCanvas(canvas) {
    const container = document.getElementById('bulletHellCanvasContainer');
    if (!container) return;
    canvasResizeObserver = new ResizeObserver(() => _redimensionarCanvas(canvas));
    canvasResizeObserver.observe(container);
    requestAnimationFrame(() => _redimensionarCanvas(canvas));
}

// ==================== Bind / Unbind Input ====================

function _bindInput() {
    const keydownHandler = (e) => {
        const key = e.key.toLowerCase();

        if (key === 'escape') {
            e.preventDefault();
            _volver();
            return;
        }

        if ('wasd'.includes(key) && key.length === 1) {
            e.preventDefault();
            if (!keysDown.has(key)) {
                keysDown.add(key);
                _startMoveTimer();
            }
        }
    };
    document.addEventListener('keydown', keydownHandler);
    listeners.push(['keydown', keydownHandler, document]);

    const keyupHandler = (e) => {
        const key = e.key.toLowerCase();
        keysDown.delete(key);
        const hayWASD = keysDown.has('w') || keysDown.has('a') || keysDown.has('s') || keysDown.has('d');
        if (!hayWASD) _stopMoveTimer();
    };
    document.addEventListener('keyup', keyupHandler);
    listeners.push(['keyup', keyupHandler, document]);

    const blurHandler = () => { keysDown.clear(); _stopMoveTimer(); };
    window.addEventListener('blur', blurHandler);
    listeners.push(['blur', blurHandler, window]);

    // Boton volver
    const btnVolver = document.getElementById('btnVolverBH');
    const volverHandler = () => _volver();
    btnVolver.addEventListener('click', volverHandler);
    listeners.push(['click', volverHandler, btnVolver]);
}

function _unbindInput() {
    keysDown.clear();
    _stopMoveTimer();
    for (const [type, handler, target] of listeners) {
        (target || document).removeEventListener(type, handler);
    }
    listeners = [];
}

// ==================== Volver ====================

function _volver() {
    destruirBulletHell();
    if (onVolverCallback) onVolverCallback();
}

// ==================== API Publica ====================

export function iniciarBulletHell(onVolver) {
    onVolverCallback = onVolver;

    const layout = document.getElementById('layoutBulletHell');
    layout.style.display = 'flex';
    document.body.classList.add('bullethell-active');

    const canvas = document.getElementById('bulletHellCanvas');
    const hudDiv = document.getElementById('hudBulletHell');

    renderer = new Renderer(canvas, hudDiv, null);
    engine = new BulletHellEngine();
    engine.inicializar();

    _iniciarResizeCanvas(canvas);
    _bindInput();

    Sonido.playMusica('musicaJuego');

    spritesListos.then(() => {
        _startRaf();
        _startLoop();
        _startSpawnLoop();
    });
}

export function destruirBulletHell() {
    Sonido.stopMusica();
    _stopLoop();
    _stopRaf();
    _unbindInput();
    document.body.classList.remove('bullethell-active');
    if (canvasResizeObserver) { canvasResizeObserver.disconnect(); canvasResizeObserver = null; }

    const layout = document.getElementById('layoutBulletHell');
    if (layout) layout.style.display = 'none';

    engine = null;
    renderer = null;
}
