import { BulletHellEngine, NOMBRES_PATRONES_BORDE, NOMBRES_PATRONES_MAGO } from './bulletHellEngine.js';
import { Renderer, spritesListos } from './renderer.js';
import * as Sonido from './sonido.js';
import dificultades from './bulletHellConfig.js';

let engine = null;
let renderer = null;
let rafId = null;
let tickLoop = null;
let spawnLoop = null;
let onVolverCallback = null;
let listeners = [];
let canvasResizeObserver = null;
let _dificultadActual = 'normal';

// Sprites de corazones
const heartFull = new Image();
const heartEmpty = new Image();
heartFull.src = '0x72_DungeonTilesetII_v1.7/frames/ui_heart_full.png';
heartEmpty.src = '0x72_DungeonTilesetII_v1.7/frames/ui_heart_empty.png';

// Sprite del mago
const magoSprite = new Image();
magoSprite.src = '0x72_DungeonTilesetII_v1.7/frames/wizzard_m_idle_anim_f0.png';

// ==================== Input ====================

const keysDown = new Set();

// ==================== Render ====================

let _lastRafTimeBH = 0;

function _render(now) {
    if (!engine || !renderer) return;
    if (!now) now = performance.now();

    const dt = Math.min((now - _lastRafTimeBH) / 1000, 0.05);
    _lastRafTimeBH = now;

    // Movimiento continuo del jugador + colisión con balas cada frame
    if (!engine.gameOver && engine.jugador.estaVivo()) {
        let dx = 0, dy = 0;
        if (keysDown.has('a')) dx -= 1;
        if (keysDown.has('d')) dx += 1;
        if (keysDown.has('w')) dy -= 1;
        if (keysDown.has('s')) dy += 1;
        if (dx !== 0 || dy !== 0) {
            engine.jugador.moverContinuo(dx, dy, dt, engine.board);
        }
        // Comprobar colisiones jugador-proyectil cada frame
        if (engine.board.comprobarColisionesJugador()) {
            engine.ultimoHitTime = Date.now();
            engine.jugador.turnosInvencible = engine.config.turnosInvencibleHit;
        }
    }

    renderer.drawBoardOleadas(engine.board, engine);
    _drawMago();
    _drawHUD();
    rafId = requestAnimationFrame(_render);
}

function _drawMago() {
    const mago = engine.mago;
    if (!mago || !mago.activo) return;
    if (!magoSprite.complete || magoSprite.naturalWidth === 0) return;

    const ctx = renderer.canvas.getContext('2d');
    const cellW = renderer.canvas.width / engine.board.columnas;
    const cellH = renderer.canvas.height / engine.board.filas;

    // Mantener proporcion del sprite (16x28)
    const aspectRatio = magoSprite.naturalWidth / magoSprite.naturalHeight;
    const drawH = cellH * 1.8;
    const drawW = drawH * aspectRatio;

    const cx = mago.columna * cellW + cellW / 2;
    const y = mago.fila * cellH + cellH - drawH;

    ctx.save();

    // Aura morada
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 15;
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(performance.now() * 0.003);

    // Flotar ligeramente
    const floatY = Math.sin(performance.now() * 0.002) * 3;

    ctx.drawImage(magoSprite, cx - drawW / 2, y + floatY, drawW, drawH);

    ctx.restore();
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

    // Corazones
    const j = engine.jugador;
    const heartSize = 32;
    const heartGap = 6;
    const totalW = j.vidaMax * heartSize + (j.vidaMax - 1) * heartGap;
    const heartX = w / 2 - totalW / 2;
    const heartY = 44;

    for (let i = 0; i < j.vidaMax; i++) {
        const x = heartX + i * (heartSize + heartGap);
        const img = i < j.vida ? heartFull : heartEmpty;
        if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x, heartY, heartSize, heartSize);
        } else {
            ctx.fillStyle = i < j.vida ? '#ef4444' : '#333';
            ctx.beginPath();
            const cx = x + heartSize / 2;
            const cy = heartY + heartSize / 2;
            const s = heartSize * 0.4;
            ctx.moveTo(cx, cy + s * 0.8);
            ctx.bezierCurveTo(cx - s * 1.2, cy, cx - s * 0.6, cy - s, cx, cy - s * 0.4);
            ctx.bezierCurveTo(cx + s * 0.6, cy - s, cx + s * 1.2, cy, cx, cy + s * 0.8);
            ctx.fill();
        }
    }

    // Indicador de curacion
    if (j.vida < j.vidaMax && j.vida > 0) {
        const sinDanio = (Date.now() - engine.ultimoHitTime) / 1000;
        const tiempoCura = engine.config.tiempoCuracionSeg;
        if (sinDanio > tiempoCura * 0.5) {
            const progreso = Math.min(1, sinDanio / tiempoCura);
            const barW = totalW;
            const barH = 4;
            const barY2 = heartY + heartSize + 4;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(heartX, barY2, barW, barH);
            ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + progreso * 0.6})`;
            ctx.fillRect(heartX, barY2, barW * progreso, barH);
        }
    }

    // Efecto parpadeo al recibir daño
    if (j.turnosInvencible > 0) {
        const flash = Math.sin(performance.now() * 0.02) > 0;
        if (flash) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.fillRect(0, 0, w, renderer.canvas.height);
        }
    }

    // Aviso de mago: mostrar cuando faltan pocos patrones de borde para que aparezca
    if (engine._fase === 'borde' && engine._bordeCompletados >= 3) {
        const restantes = 4 - engine._bordeCompletados;
        ctx.font = 'bold 20px MedievalSharp, cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const alpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.fillText(`El mago aparece en ${restantes} ataque${restantes > 1 ? 's' : ''}...`, w / 2, heartY + heartSize + 14);
    }

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

        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#c9a84c';
        ctx.fillText('Pulsa R para reiniciar', w / 2, renderer.canvas.height / 2 + 60);

        ctx.font = '16px monospace';
        ctx.fillStyle = '#888';
        ctx.fillText('ESC para volver al menú', w / 2, renderer.canvas.height / 2 + 90);
    }

    ctx.restore();
}

// ==================== Modo Custom ====================

let _magoCustomActivo = false;

function _buildCustomBar() {
    const bar = document.getElementById('bhCustomBar');
    if (!bar) return;
    bar.style.display = 'flex';
    bar.innerHTML = '';

    _magoCustomActivo = false;
    _renderCustomButtons(bar);
}

function _renderCustomButtons(bar) {
    bar.innerHTML = '';

    const nombres = _magoCustomActivo ? NOMBRES_PATRONES_MAGO : NOMBRES_PATRONES_BORDE;
    const label = _magoCustomActivo ? 'MAGO' : 'BORDE';

    // Label
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'color:#888;font-size:0.7rem;font-family:monospace;margin-right:2px';
    bar.appendChild(lbl);

    // Botones de patrones
    nombres.forEach((nombre, idx) => {
        const btn = document.createElement('button');
        btn.textContent = `${idx}: ${nombre}`;
        btn.addEventListener('click', () => {
            if (!engine) return;
            if (_magoCustomActivo) {
                engine.forzarPatronMago(idx);
            } else {
                engine.forzarPatronBorde(idx);
            }
        });
        bar.appendChild(btn);
    });

    // Separador
    const sep = document.createElement('div');
    sep.className = 'bh-custom-sep';
    bar.appendChild(sep);

    // Boton toggle mago
    const btnMago = document.createElement('button');
    btnMago.textContent = _magoCustomActivo ? 'Desactivar Mago' : 'Invocar Mago';
    if (_magoCustomActivo) btnMago.classList.add('bh-custom-active');
    btnMago.addEventListener('click', () => {
        _magoCustomActivo = !_magoCustomActivo;
        if (_magoCustomActivo) {
            if (engine) {
                engine.magoManual = true;
                engine.mago.activo = true;
                engine.mago.fila = engine.board.filas / 2;
                engine.mago.columna = engine.board.columnas / 2;
                engine.mago.apariciones = 1;
            }
        } else {
            if (engine) {
                engine.magoManual = false;
                engine.mago.activo = false;
                engine._magoState.enPausa = true;
                engine._magoState.pausaTick = -99999;
            }
        }
        _renderCustomButtons(bar);
    });
    bar.appendChild(btnMago);
}

function _destroyCustomBar() {
    const bar = document.getElementById('bhCustomBar');
    if (bar) {
        bar.style.display = 'none';
        bar.innerHTML = '';
    }
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
        // Mientras el mago esta activo, no spawnear desde paredes pero seguir comprobando
        if (engine.mago && engine.mago.activo) {
            spawnLoop = setTimeout(spawn, 500);
            return;
        }
        engine.spawnBalas();
        const next = engine.getIntervaloSpawn();
        spawnLoop = setTimeout(spawn, next);
    };
    // Disparar inmediatamente la primera vez
    spawn();
}

function _stopLoop() {
    if (tickLoop) { clearInterval(tickLoop); tickLoop = null; }
    if (spawnLoop) { clearTimeout(spawnLoop); spawnLoop = null; }
}

function _startRaf() {
    if (rafId) cancelAnimationFrame(rafId);
    _lastRafTimeBH = performance.now();
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

        if (key === 'r' && engine && engine.gameOver) {
            e.preventDefault();
            _reiniciar();
            return;
        }

        if ('wasd'.includes(key) && key.length === 1) {
            e.preventDefault();
            keysDown.add(key);
        }
    };
    document.addEventListener('keydown', keydownHandler);
    listeners.push(['keydown', keydownHandler, document]);

    const keyupHandler = (e) => {
        const key = e.key.toLowerCase();
        keysDown.delete(key);
    };
    document.addEventListener('keyup', keyupHandler);
    listeners.push(['keyup', keyupHandler, document]);

    const blurHandler = () => { keysDown.clear(); };
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
    for (const [type, handler, target] of listeners) {
        (target || document).removeEventListener(type, handler);
    }
    listeners = [];
}

// ==================== Reiniciar / Volver ====================

function _reiniciar() {
    if (!engine) return;
    const cb = onVolverCallback;
    const dif = _dificultadActual;
    destruirBulletHell();
    iniciarBulletHell(cb, dif);
}

function _volver() {
    destruirBulletHell();
    if (onVolverCallback) onVolverCallback();
}

// ==================== API Publica ====================

export function iniciarBulletHell(onVolver, dificultad = 'normal') {
    onVolverCallback = onVolver;
    _dificultadActual = dificultad;

    const layout = document.getElementById('layoutBulletHell');
    layout.style.display = 'flex';
    document.body.classList.add('bullethell-active');

    const canvas = document.getElementById('bulletHellCanvas');
    const hudDiv = document.getElementById('hudBulletHell');

    const config = dificultades[dificultad] || dificultades.normal;
    renderer = new Renderer(canvas, hudDiv, null);
    engine = new BulletHellEngine(config);
    engine.inicializar();

    _iniciarResizeCanvas(canvas);
    _bindInput();

    Sonido.playMusica('musicaBulletHell');

    const isCustom = dificultad === 'custom';

    spritesListos.then(() => {
        _startRaf();
        _startLoop();
        if (!isCustom) {
            _startSpawnLoop();
        } else {
            _buildCustomBar();
        }
    });
}

export function destruirBulletHell() {
    Sonido.stopMusica();
    _stopLoop();
    _stopRaf();
    _unbindInput();
    _destroyCustomBar();
    document.body.classList.remove('bullethell-active');
    if (canvasResizeObserver) { canvasResizeObserver.disconnect(); canvasResizeObserver = null; }

    const layout = document.getElementById('layoutBulletHell');
    if (layout) layout.style.display = 'none';

    engine = null;
    renderer = null;
}
