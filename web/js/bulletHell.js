import { BulletHellEngine, NOMBRES_PATRONES_BORDE, NOMBRES_PATRONES_MAGO } from './bulletHellEngine.js';
import { Renderer, spritesListos } from './renderer.js';
import * as Sonido from './sonido.js';
import dificultades from './bulletHellConfig.js';
import * as TouchControls from './touchControls.js';

let engine = null;
let renderer = null;
let rafId = null;
let tickLoop = null;
let spawnLoop = null;
let onVolverCallback = null;
let listeners = [];
let canvasResizeObserver = null;
let _dificultadActual = 'normal';
let _habilidadesActuales = [];
let _gameOverOverlayShown = false;
let pausado = false;

// Estado previo para detectar cambios y disparar sonidos
let _prevVida = 0;
let _prevMagoActivo = false;
let _prevPatronIdx = -1;
let _prevGameOver = false;
let _prevPausaTemporal = false;

// Sprites de corazones
const heartFull = new Image();
const heartEmpty = new Image();
heartFull.src = '0x72_DungeonTilesetII_v1.7/frames/ui_heart_full.png';
heartEmpty.src = '0x72_DungeonTilesetII_v1.7/frames/ui_heart_empty.png';

// Sprite del mago
const magoSprite = new Image();
magoSprite.src = '0x72_DungeonTilesetII_v1.7/frames/wizzard_m_idle_anim_f0.png';

// Mapa de habilidad → sonido
const _sonidoHab = {
    teletransporte: 'bhTeletransporte',
    pausaTemporal: 'bhPausaTemporal',
    invulnerabilidad: 'bhInvulnerabilidad',
    ondaRepulsora: 'bhOndaRepulsora',
    ralentizar: 'bhRalentizar',
};

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
    if (!engine.gameOver && !pausado && engine.jugador.estaVivo()) {
        let dx = 0, dy = 0;
        if (keysDown.has('a')) dx -= 1;
        if (keysDown.has('d')) dx += 1;
        if (keysDown.has('w')) dy -= 1;
        if (keysDown.has('s')) dy += 1;
        // Merge touch joystick
        const joy = TouchControls.getJoystickDirection();
        if (joy.dx !== 0 || joy.dy !== 0) {
            dx = joy.dx;
            dy = joy.dy;
        }
        if (dx !== 0 || dy !== 0) {
            engine.jugador.moverContinuo(dx, dy, dt, engine.board);
        }
        // Comprobar colisiones jugador-proyectil cada frame (salvo invulnerabilidad)
        if (!engine.invulnerabilidadActiva) {
            if (engine.board.comprobarColisionesJugador()) {
                engine.ultimoHitTime = Date.now();
                engine.jugador.turnosInvencible = engine.config.turnosInvencibleHit;
            }
        }
    }

    renderer.drawBoardOleadas(engine.board, engine);
    _drawMago();
    _drawEfectosHabilidades();
    _drawHUD();

    // Detectar cambios de estado para sonidos
    const vida = engine.jugador.vida;
    if (vida < _prevVida) Sonido.play('danioRecibido');
    if (vida > _prevVida && _prevVida > 0) Sonido.play('bhCurar');
    if (engine.gameOver && !_prevGameOver) Sonido.play('bhMuerte');
    if (engine.mago.activo && !_prevMagoActivo) Sonido.play('bhMagoAparece');
    if (engine.mago.activo && _prevMagoActivo && engine._magoState && engine._magoState.patronIdx !== _prevPatronIdx) Sonido.play('bhMagoCambioPatron');
    if (engine.pausaTemporalActiva && !_prevPausaTemporal) Sonido.setMusicaRate(0.25, 400);
    if (!engine.pausaTemporalActiva && _prevPausaTemporal) Sonido.setMusicaRate(1, 300);
    _prevVida = vida;
    _prevMagoActivo = engine.mago.activo;
    _prevPatronIdx = engine._magoState ? engine._magoState.patronIdx : -1;
    _prevGameOver = engine.gameOver;
    _prevPausaTemporal = engine.pausaTemporalActiva;

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

function _drawEfectosHabilidades() {
    if (!engine || !renderer) return;
    const ctx = renderer.canvas.getContext('2d');
    const w = renderer.canvas.width;
    const h = renderer.canvas.height;
    const cellW = w / engine.board.columnas;
    const cellH = h / engine.board.filas;
    const ahora = Date.now();

    // Pausa temporal: overlay gris-azulado + barra duracion
    if (engine.pausaTemporalActiva) {
        ctx.save();
        ctx.fillStyle = 'rgba(148,163,184, 0.15)';
        ctx.fillRect(0, 0, w, h);
        const prog = Math.max(0, (engine._pausaTemporalHasta - ahora) / 3000);
        const barW = w * 0.3;
        const barH = 6;
        const barX = w / 2 - barW / 2;
        const barY = h - 50;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(barX, barY, barW * prog, barH);
        ctx.restore();
    }

    // Invulnerabilidad: circulo dorado pulsante
    if (engine.invulnerabilidadActiva) {
        ctx.save();
        const jx = engine.jugador.x * cellW;
        const jy = engine.jugador.y * cellH;
        const pulse = 0.8 + 0.2 * Math.sin(ahora * 0.01);
        const r = cellW * 1.2 * pulse;
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(jx, jy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Ralentizar: overlay cyan + barra
    if (engine.ralentizarActivo) {
        ctx.save();
        ctx.fillStyle = 'rgba(34,211,238, 0.08)';
        ctx.fillRect(0, 0, w, h);
        const prog = Math.max(0, (engine._ralentizarHasta - ahora) / 4000);
        const barW = w * 0.3;
        const barH = 6;
        const barX = w / 2 - barW / 2;
        const barY = h - 40;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(barX, barY, barW * prog, barH);
        ctx.restore();
    }

    // Teleport flash: circulos azules desvaneciendose
    if (engine._teleportFlash) {
        ctx.save();
        const tf = engine._teleportFlash;
        const prog = Math.max(0, (tf.hasta - ahora) / 300);
        ctx.globalAlpha = prog * 0.6;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        // Origen
        ctx.beginPath();
        ctx.arc(tf.fromX * cellW, tf.fromY * cellH, cellW * (1 + (1 - prog) * 2), 0, Math.PI * 2);
        ctx.stroke();
        // Destino
        ctx.beginPath();
        ctx.arc(tf.toX * cellW, tf.toY * cellH, cellW * (1 - prog) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Onda repulsora: aro naranja expandiendose
    if (engine._ondaFlash) {
        ctx.save();
        const of_ = engine._ondaFlash;
        const prog = Math.max(0, (of_.hasta - ahora) / 400);
        const expansion = (1 - prog) * of_.radio * cellW;
        ctx.globalAlpha = prog * 0.7;
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(of_.x * cellW, of_.y * cellH, expansion, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
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

    // HUD de habilidades (esquina inferior izquierda)
    const habs = engine.getHabilidades();
    const habKeys = Object.keys(habs);
    if (habKeys.length > 0) {
        const slotSize = 48;
        const slotGap = 8;
        const slotY = renderer.canvas.height - slotSize - 12;
        let slotX = 12;
        const ahora = Date.now();

        for (const key of habKeys) {
            const h = habs[key];
            const def = h.def;

            // Fondo del slot
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(slotX, slotY, slotSize, slotSize);
            ctx.strokeStyle = '#5c4a2a';
            ctx.lineWidth = 2;
            ctx.strokeRect(slotX, slotY, slotSize, slotSize);

            // Icono
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = def.color;
            ctx.fillText(def.icono, slotX + slotSize / 2, slotY + slotSize / 2 - 4);

            // Tecla
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#9a8a6a';
            const teclaLabel = def.tecla === 'click' ? 'CLICK' : def.tecla.toUpperCase();
            ctx.fillText(teclaLabel, slotX + slotSize / 2, slotY + slotSize - 2);

            // Cooldown overlay
            const cdRestante = h.listaEn - ahora;
            if (cdRestante > 0) {
                const cdProg = cdRestante / def.cooldownMs;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.fillRect(slotX, slotY, slotSize, slotSize * cdProg);
                // Segundos restantes
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff';
                ctx.fillText(Math.ceil(cdRestante / 1000).toString(), slotX + slotSize / 2, slotY + slotSize / 2);
            }

            // Borde activo (efecto en curso)
            if (h.activaHasta > ahora) {
                ctx.strokeStyle = def.color;
                ctx.lineWidth = 2;
                ctx.shadowColor = def.color;
                ctx.shadowBlur = 8;
                ctx.strokeRect(slotX, slotY, slotSize, slotSize);
                ctx.shadowBlur = 0;
            }

            slotX += slotSize + slotGap;
        }
    }

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

        if (!_gameOverOverlayShown && TouchControls.isTouchDevice()) {
            _gameOverOverlayShown = true;
            _mostrarGameOverOverlay(timeStr);
        }
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
        if (!engine || engine.gameOver || pausado) return;
        engine.tick();
    }, engine.config.velocidadMs);
}

function _startSpawnLoop() {
    const spawn = () => {
        if (!engine || engine.gameOver) return;
        // Pausa temporal: saltar spawn y reintentar en 200ms
        if (engine.pausaTemporalActiva) {
            spawnLoop = setTimeout(spawn, 200);
            return;
        }
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

        // Habilidades por tecla
        if (engine && !engine.gameOver) {
            const habs = engine.getHabilidades();
            for (const id in habs) {
                if (habs[id].def.tecla === key) {
                    e.preventDefault();
                    if (engine.activarHabilidad(id)) {
                        const sfx = _sonidoHab[id];
                        if (sfx) Sonido.play(sfx);
                    }
                    break;
                }
            }
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

    // Click del raton: teletransporte
    const canvas = document.getElementById('bulletHellCanvas');
    const clickHandler = (e) => {
        if (!engine || engine.gameOver) return;
        const habs = engine.getHabilidades();
        if (!habs['teletransporte']) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = engine.board.columnas / canvas.width;
        const scaleY = engine.board.filas / canvas.height;
        const x = (e.clientX - rect.left) * (canvas.width / rect.width) * scaleX;
        const y = (e.clientY - rect.top) * (canvas.height / rect.height) * scaleY;
        if (engine.activarHabilidad('teletransporte', { x, y })) {
            Sonido.play('bhTeletransporte');
        }
    };
    canvas.addEventListener('mousedown', clickHandler);
    listeners.push(['mousedown', clickHandler, canvas]);

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
    _limpiarGameOverOverlay();
    _limpiarPauseOverlay();
    const cb = onVolverCallback;
    const dif = _dificultadActual;
    const habs = _habilidadesActuales;
    destruirBulletHell();
    iniciarBulletHell(cb, dif, habs);
}

function _volver() {
    destruirBulletHell();
    if (onVolverCallback) onVolverCallback();
}

// ==================== Touch ====================

function _initTouch(container) {
    TouchControls.initTouchControls(container, {
        onAbility: () => {
            if (!engine || engine.gameOver) return;
            const habs = engine.getHabilidades();
            for (const id in habs) {
                if (habs[id].def.tecla === 'e') {
                    if (engine.activarHabilidad(id)) {
                        const sfx = _sonidoHab[id];
                        if (sfx) Sonido.play(sfx);
                    }
                    break;
                }
            }
        },
        onCanvasTouch: (clientX, clientY, e) => {
            if (!engine || engine.gameOver) return;
            const habs = engine.getHabilidades();
            if (!habs['teletransporte']) return;
            const canvas = document.getElementById('bulletHellCanvas');
            const rect = canvas.getBoundingClientRect();
            const scaleX = engine.board.columnas / canvas.width;
            const scaleY = engine.board.filas / canvas.height;
            const x = (clientX - rect.left) * (canvas.width / rect.width) * scaleX;
            const y = (clientY - rect.top) * (canvas.height / rect.height) * scaleY;
            if (engine.activarHabilidad('teletransporte', { x, y })) {
                Sonido.play('bhTeletransporte');
            }
        },
        onPause: () => _togglePause(),
    }, {
        noAimJoystick: true,
        noActionButtons: true,
        abilityOnly: true,
        noTienda: true,
        noPause: false,
    });
}

// ==================== Game Over Overlay (mobile) ====================

function _mostrarGameOverOverlay(timeStr) {
    const layout = document.getElementById('layoutBulletHell');
    const overlay = document.createElement('div');
    overlay.className = 'gameover-overlay';
    overlay.innerHTML = `
        <div class="gameover-titulo">GAME OVER</div>
        <div class="gameover-stats">
            <div class="gameover-linea" style="text-align:center;font-size:1.2rem;color:#c9a84c;">
                Tiempo: ${timeStr}
            </div>
        </div>
        <button class="gameover-btn" id="bhGameOverRestart">REINICIAR</button>
        <button class="gameover-btn" id="bhGameOverMenu">VOLVER AL MENU</button>
    `;
    layout.appendChild(overlay);
    document.getElementById('bhGameOverRestart').onclick = () => _reiniciar();
    document.getElementById('bhGameOverMenu').onclick = () => _volver();
}

function _limpiarGameOverOverlay() {
    const layout = document.getElementById('layoutBulletHell');
    if (!layout) return;
    // Remove all gameover overlays except the pause overlay
    layout.querySelectorAll('.gameover-overlay:not(#bhPauseOverlay)').forEach(el => el.remove());
    _gameOverOverlayShown = false;
}

// ==================== Pause (mobile) ====================

function _togglePause() {
    pausado = !pausado;
    if (pausado) {
        _stopLoop();
        _mostrarPauseOverlay();
    } else {
        _limpiarPauseOverlay();
        _startLoop();
        _startSpawnLoop();
    }
}

function _mostrarPauseOverlay() {
    const layout = document.getElementById('layoutBulletHell');
    const overlay = document.createElement('div');
    overlay.className = 'gameover-overlay';
    overlay.id = 'bhPauseOverlay';
    overlay.innerHTML = `
        <div class="gameover-titulo" style="color:#c9a84c;">PAUSA</div>
        <button class="gameover-btn" id="bhPauseResume">REANUDAR</button>
        <button class="gameover-btn" id="bhPauseQuit">SALIR AL MENU</button>
    `;
    layout.appendChild(overlay);
    document.getElementById('bhPauseResume').onclick = () => _togglePause();
    document.getElementById('bhPauseQuit').onclick = () => _volver();
}

function _limpiarPauseOverlay() {
    const overlay = document.getElementById('bhPauseOverlay');
    if (overlay) overlay.remove();
}

// ==================== API Publica ====================

export function iniciarBulletHell(onVolver, dificultad = 'normal', habilidades = []) {
    onVolverCallback = onVolver;
    _dificultadActual = dificultad;
    _habilidadesActuales = habilidades;

    const layout = document.getElementById('layoutBulletHell');
    layout.style.display = 'flex';
    document.body.classList.add('bullethell-active');

    const canvas = document.getElementById('bulletHellCanvas');
    const hudDiv = document.getElementById('hudBulletHell');

    let config = dificultades[dificultad] || dificultades.normal;
    if (TouchControls.isTouchDevice()) {
        config = { ...config, filas: 15, columnas: 27 };
    }
    renderer = new Renderer(canvas, hudDiv, null);
    engine = new BulletHellEngine(config);
    engine.inicializar(habilidades);

    _prevVida = engine.jugador.vida;
    _prevMagoActivo = false;
    _prevPatronIdx = -1;
    _prevGameOver = false;
    _prevPausaTemporal = false;
    _gameOverOverlayShown = false;
    pausado = false;

    _iniciarResizeCanvas(canvas);
    _bindInput();

    // Touch controls for mobile
    if (TouchControls.isTouchDevice()) {
        _initTouch(layout);
    }

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
    _limpiarGameOverOverlay();
    _limpiarPauseOverlay();
    pausado = false;
    TouchControls.destroyTouchControls();
    document.body.classList.remove('bullethell-active');
    if (canvasResizeObserver) { canvasResizeObserver.disconnect(); canvasResizeObserver = null; }

    const layout = document.getElementById('layoutBulletHell');
    if (layout) layout.style.display = 'none';

    engine = null;
    renderer = null;
}
