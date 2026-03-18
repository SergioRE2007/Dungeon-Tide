import { MazmorraEngine } from './mazmorraEngine.js';
import { Renderer, spritesListos } from './renderer.js';
import { Enemigo, EnemigoTanque, EnemigoRapido, EnemigoMago } from './entidad.js';
import { Cofre } from './objetos.js';
import mazmorraConfig from './mazmorraConfig.js';
import * as Sonido from './sonido.js';
import * as TouchControls from './touchControls.js';

let engine = null;
let renderer = null;
let gameLoop = null;
let rafId = null;
let onVolverCallback = null;
let listeners = [];
let fastEnemyLoop = null;
let canvasResizeObserver = null;
let pausado = false;
let _levelUpShowing = false;
let _perkNivelCalculado = 0;
let _sprintDustTimer = 0;
let _transicionActiva = false;

// ==================== Perks por clase (mismo que oleadas) ====================

const PERKS_POR_CLASE = {
    guerrero: [
        [
            { id: 'tajoAmplio', nombre: 'Tajo Amplio', desc: 'El ataque cubre 5 celdas en vez de 3.', icono: '🗡️' },
            { id: 'golpeBrutal', nombre: 'Golpe Brutal', desc: '25% de prob. de golpe crítico (×2 daño).', icono: '💥' },
        ],
        [
            { id: 'sangrado', nombre: 'Sangrado', desc: 'Tus ataques causan sangrado (15% daño / 3 turnos).', icono: '🩸' },
            { id: 'defensaFerrea', nombre: 'Defensa Férrea', desc: 'Reduces un 25% el daño recibido.', icono: '🛡️' },
        ],
        [
            { id: 'sedDeSangre', nombre: 'Sed de Sangre', desc: 'Curas 8% de tu vida máx. por cada kill.', icono: '❤️‍🔥' },
        ],
    ],
    arquero: [
        [
            { id: 'dobleFlecha', nombre: 'Doble Flecha', desc: 'Disparas 2 flechas a la vez (±15°).', icono: '🏹' },
            { id: 'flechaPerforante', nombre: 'Flecha Perforante', desc: 'Las flechas atraviesan al primer enemigo.', icono: '🎯' },
        ],
        [
            { id: 'flechasExplosivas', nombre: 'Flechas Explosivas', desc: 'Las flechas explotan en área 3×3 al impactar.', icono: '💣' },
            { id: 'disparoRapido', nombre: 'Disparo Rápido', desc: 'Cooldown de ataque reducido un 30% extra.', icono: '⚡' },
        ],
        [
            { id: 'tripleFlecha', nombre: 'Triple Flecha', desc: 'Disparas 3 flechas a la vez.', icono: '🏹' },
        ],
    ],
    necromancer: [
        [
            { id: 'dobleProyectil', nombre: 'Doble Proyectil', desc: 'Lanzas 2 proyectiles a la vez (±15°).', icono: '💀' },
            { id: 'explosionMayor', nombre: 'Explosión Mayor', desc: 'Radio de explosión aumentado (5×5).', icono: '💥' },
        ],
        [
            { id: 'horda', nombre: 'Horda', desc: 'Invocas 5 aliados en vez de 3.', icono: '💀' },
            { id: 'drenaje', nombre: 'Drenaje', desc: 'Tus ataques roban 8% de vida.', icono: '🧛' },
        ],
        [
            { id: 'tripleProyectil', nombre: 'Triple Proyectil', desc: 'Lanzas 3 proyectiles a la vez.', icono: '☠️' },
        ],
    ],
};

// ==================== Inicializar ====================

export function iniciarMazmorra(onVolver) {
    onVolverCallback = onVolver;

    const layout = document.getElementById('layoutMazmorra');
    layout.style.display = 'flex';

    document.getElementById('mazmorraGameArea').style.display = 'none';
    const menuClases = document.getElementById('menuClasesMazmorra');
    menuClases.style.display = 'flex';

    _construirMenuClases();

    document.getElementById('btnVolverMenuDesdeMazmorra').onclick = () => {
        layout.style.display = 'none';
        if (onVolverCallback) onVolverCallback();
    };
}

// Sprite base por clase
const CLASE_SPRITE = {
    guerrero:    '0x72_DungeonTilesetII_v1.7/frames/knight_f_idle_anim_f',
    arquero:     '0x72_DungeonTilesetII_v1.7/frames/elf_m_idle_anim_f',
    necromancer: '0x72_DungeonTilesetII_v1.7/frames/wizzard_f_idle_anim_f',
};
const CLASE_SPRITE_FRAMES = 4;
const CLASE_SPRITE_MS = 150;

function _construirMenuClases() {
    const container = document.getElementById('mazmorraClasesContainer');
    container.innerHTML = '';

    const clases = mazmorraConfig.clases;
    for (const [id, config] of Object.entries(clases)) {
        const card = document.createElement('div');
        card.className = 'clase-card';
        card.innerHTML = `
            <div class="clase-icono"><canvas class="clase-sprite-canvas" width="64" height="64"></canvas></div>
            <div class="clase-titulo">${config.nombre}</div>
            <div class="clase-desc">${config.desc}</div>
            <div class="clase-stats">
                <div class="clase-stat"><span class="clase-stat-label">Vida</span><span class="clase-stat-value">${config.vida}</span></div>
                <div class="clase-stat"><span class="clase-stat-label">Daño</span><span class="clase-stat-value">${config.danio}</span></div>
                <div class="clase-stat"><span class="clase-stat-label">Arma</span><span class="clase-stat-value">${config.arma.toUpperCase()}</span></div>
            </div>
        `;
        card.onclick = () => _iniciarPartidaReal(id);
        container.appendChild(card);

        // Animate sprite
        const canvas = card.querySelector('.clase-sprite-canvas');
        const ctx = canvas.getContext('2d');
        const baseUrl = CLASE_SPRITE[id];
        if (baseUrl) {
            const imgs = Array.from({ length: CLASE_SPRITE_FRAMES }, (_, i) => {
                const img = new Image();
                img.src = `${baseUrl}${i}.png`;
                return img;
            });
            imgs[0].onload = () => {
                const scale = 4;
                canvas.width = imgs[0].naturalWidth * scale;
                canvas.height = imgs[0].naturalHeight * scale;
                canvas.style.width = canvas.width + 'px';
                canvas.style.height = canvas.height + 'px';
            };
            let frame = 0;
            let lastTime = 0;
            function animarSprite(now) {
                if (now - lastTime >= CLASE_SPRITE_MS) {
                    const img = imgs[frame];
                    if (img.complete && canvas.width > 0) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    }
                    frame = (frame + 1) % CLASE_SPRITE_FRAMES;
                    lastTime = now;
                }
                requestAnimationFrame(animarSprite);
            }
            requestAnimationFrame(animarSprite);
        }
    }
}

// ==================== Iniciar partida ====================

function _iniciarPartidaReal(idClase) {
    document.getElementById('menuClasesMazmorra').style.display = 'none';
    document.getElementById('mazmorraGameArea').style.display = 'flex';

    const canvas = document.getElementById('mazmorraCanvas');
    document.body.classList.add('mazmorra-active');

    renderer = new Renderer(canvas, null, null);

    engine = new MazmorraEngine(mazmorraConfig);
    engine.inicializar(idClase);

    _iniciarResizeCanvas(canvas);
    _bindInput();
    _bindPauseButtons();

    pausado = false;
    _levelUpShowing = false;
    _perkNivelCalculado = 0;
    _transicionActiva = false;
    document.getElementById('mazmorraPasseOverlay').style.display = 'none';

    spritesListos.then(() => {
        _startRaf();
        _startLoop();
        renderer.updateHUDOleadas(engine);
        Sonido.playMusica('musicaJuego');
        _mostrarTutorialSiNecesario();
    });
}

function _redimensionarCanvas(canvas) {
    const container = document.getElementById('mazmorraCanvasContainer');
    if (!container) return;
    const w = container.clientWidth - 6;
    const h = container.clientHeight - 6;
    if (w <= 0 || h <= 0) return;
    canvas.width = w;
    canvas.height = h;
}

function _iniciarResizeCanvas(canvas) {
    const container = document.getElementById('mazmorraCanvasContainer');
    if (!container) return;
    canvasResizeObserver = new ResizeObserver(() => _redimensionarCanvas(canvas));
    canvasResizeObserver.observe(container);
    requestAnimationFrame(() => _redimensionarCanvas(canvas));
}

// ==================== Game Loop ====================

function _procesarAnimaciones(board, rend) {
    for (const exp of board.ultimasExplosiones) {
        rend.iniciarExplosion(exp.f, exp.c, exp.radio || 0);
    }
    for (const e of board.entidadesActivas) {
        if (e.pendingAnim) {
            rend.setAnimState(e.id, e.pendingAnim);
            e.pendingAnim = null;
        }
    }
    board.ultimasExplosiones = [];
}

function _startLoop() {
    if (gameLoop) return;
    gameLoop = setInterval(() => {
        if (!engine.gameOver) {
            const vidaAntes = engine.jugador.vida;
            engine.jugador.actuar(engine.board);
            engine.tick();
            _procesarDamageEventsDelEngine();
            if (engine.jugador.vida < vidaAntes) Sonido.play('danioRecibido');
            if (engine.killsDelTick > 0) Sonido.play('enemigoMuere');

            _procesarAnimaciones(engine.board, renderer);

            // Boss killed = floor complete
            if (engine.pisoCompletado) {
                _stopLoop();
                Sonido.play('levelUp');
                renderer.flash('rgba(251,191,36,0.3)', 600);
                renderer.shake(6, 400);
                _mostrarPisoCompletado();
                return;
            }

            _comprobarLevelUp();
        }

        renderer.updateHUDOleadas(engine);

        if (engine.gameOver) {
            _stopLoop();
            _stopRaf();
            Sonido.play('muerte');
            Sonido.stopMusica();
            _mostrarGameOver();
        }
    }, mazmorraConfig.velocidadMs);

    if (!fastEnemyLoop) {
        fastEnemyLoop = setInterval(() => {
            if (!engine || engine.gameOver) return;
            engine.tickRapidos(performance.now());
        }, 160);
    }
}

function _stopLoop() {
    if (gameLoop) { clearInterval(gameLoop); gameLoop = null; }
    if (fastEnemyLoop) { clearInterval(fastEnemyLoop); fastEnemyLoop = null; }
}

let _lastRafTime = 0;

function _startRaf() {
    if (rafId) return;
    const canvas = document.getElementById('mazmorraCanvas');
    _lastRafTime = performance.now();
    function loop(now) {
        const dt = Math.min((now - _lastRafTime) / 1000, 0.05);
        _lastRafTime = now;

        if (engine && !engine.gameOver && !pausado && engine.jugador.estaVivo() && !_transicionActiva) {
            let dx = 0, dy = 0;
            if (keysDown.has('a')) dx -= 1;
            if (keysDown.has('d')) dx += 1;
            if (keysDown.has('w')) dy -= 1;
            if (keysDown.has('s')) dy += 1;
            const joy = TouchControls.getJoystickDirection();
            if (joy.dx !== 0 || joy.dy !== 0) { dx = joy.dx; dy = joy.dy; }

            // Sprint / Stamina
            const wantsSprint = keysDown.has('shift') && (dx !== 0 || dy !== 0);
            engine.jugador.actualizarStamina(dt, wantsSprint);

            // Sprint dust particles
            if (engine.jugador.isSprinting && renderer) {
                _sprintDustTimer += dt;
                if (_sprintDustTimer > 0.08) {
                    _sprintDustTimer = 0;
                    renderer.addParticleBurst(engine.jugador.x, engine.jugador.y + 0.4, 2, '#a8866a', 0.6);
                }
            } else {
                _sprintDustTimer = 0;
            }

            if (dx !== 0 || dy !== 0) {
                engine.jugador.moverContinuo(dx, dy, dt, engine.board);
            }
            engine.board.comprobarColisionesJugador();

            // Room transition check
            const trans = engine.intentarTransicion();
            if (trans && trans !== 'locked') {
                _realizarTransicion();
            }

            _comprobarLevelUp();

            // Pick up objects
            _recogerObjetoEnPosicion();
        }

        if (mouseHeld && canvas && !pausado && !_transicionActiva) _procesarAtaqueClick(canvas);
        _render();
        rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
}

function _stopRaf() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// ==================== Room Transition ====================

function _realizarTransicion() {
    _transicionActiva = true;
    // Brief screen flash for transition
    if (renderer) renderer.flash('rgba(0,0,0,0.8)', 200);
    Sonido.play('comprar');
    // Short delay then resume
    setTimeout(() => {
        _transicionActiva = false;
    }, 150);
}

// ==================== Render ====================

function _render() {
    if (!renderer || !engine || !engine.board) return;

    // Update mouse angle for renderer
    if (engine.jugador) {
        if (TouchControls.isAiming()) {
            renderer.mouseAngulo = TouchControls.getAimAngle();
        } else {
            const canvas = document.getElementById('mazmorraCanvas');
            const rect = canvas.getBoundingClientRect();
            const cellW = canvas.width / engine.board.columnas;
            const cellH = canvas.height / engine.board.filas;
            const jugX = engine.jugador.x * cellW;
            const jugY = engine.jugador.y * cellH;
            const mouseX = (lastMousePos.x - rect.left) * (canvas.width / rect.width);
            const mouseY = (lastMousePos.y - rect.top) * (canvas.height / rect.height);
            renderer.mouseAngulo = Math.atan2(mouseY - jugY, mouseX - jugX);
        }
    }

    renderer.drawBoardOleadas(engine.board, engine);

    // Draw minimap on top
    _dibujarMinimapa();

    // Draw door indicators
    _dibujarPuertas();
}

function _dibujarMinimapa() {
    if (!engine || !renderer) return;
    const canvas = document.getElementById('mazmorraCanvas');
    const ctx = canvas.getContext('2d');
    const data = engine.getMinimapaData();

    const tamCelda = 14;
    const padding = 10;
    const gs = data.gridSize;

    // Find bounds of rooms to minimize minimap size
    let minR = gs, maxR = 0, minC = gs, maxC = 0;
    for (const key of Object.keys(data.habitaciones)) {
        const [r, c] = key.split(',').map(Number);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    }

    const anchoMini = (maxC - minC + 1) * tamCelda;
    const altoMini = (maxR - minR + 1) * tamCelda;
    const x0 = canvas.width - anchoMini - padding - 8;
    const y0 = padding;

    // Background
    ctx.save();
    ctx.fillStyle = 'rgba(15, 10, 4, 0.75)';
    ctx.strokeStyle = '#5c4a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0 - 4, y0 - 4, anchoMini + 8, altoMini + 8 + 16, 4);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#9a8a6a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`PISO ${engine.piso}`, x0 + anchoMini / 2, y0 + altoMini + 12);

    // Draw rooms
    for (const [key, hab] of Object.entries(data.habitaciones)) {
        const [r, c] = key.split(',').map(Number);
        const rx = x0 + (c - minC) * tamCelda;
        const ry = y0 + (r - minR) * tamCelda;

        if (!hab.visitada) {
            // Unvisited: show as dim outline if adjacent to visited
            ctx.fillStyle = 'rgba(92, 74, 42, 0.3)';
            ctx.fillRect(rx + 1, ry + 1, tamCelda - 2, tamCelda - 2);
            continue;
        }

        // Color by type
        let color = '#4a5568'; // default gray
        if (key === `${data.actual.r},${data.actual.c}`) {
            color = '#fff'; // current room
        } else if (hab.tipo === 'boss') {
            color = hab.limpiada ? '#22c55e' : '#ef4444';
        } else if (hab.tipo === 'tesoro') {
            color = '#eab308';
        } else if (hab.tipo === 'tienda') {
            color = '#3b82f6';
        } else if (hab.tipo === 'inicio') {
            color = '#22c55e';
        } else if (hab.limpiada) {
            color = '#6b7280';
        } else {
            color = '#9a8a6a';
        }

        ctx.fillStyle = color;
        ctx.fillRect(rx + 1, ry + 1, tamCelda - 2, tamCelda - 2);

        // Draw connections
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (const [dir, existe] of Object.entries(hab.conexiones)) {
            if (!existe) continue;
            const cx = rx + tamCelda / 2;
            const cy = ry + tamCelda / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            switch (dir) {
                case 'N': ctx.lineTo(cx, ry); break;
                case 'S': ctx.lineTo(cx, ry + tamCelda); break;
                case 'W': ctx.lineTo(rx, cy); break;
                case 'E': ctx.lineTo(rx + tamCelda, cy); break;
            }
            ctx.stroke();
        }

        // Room type icon (small)
        if (hab.tipo === 'boss' && !hab.limpiada) {
            ctx.fillStyle = '#000';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('B', rx + tamCelda / 2, ry + tamCelda / 2 + 3);
        } else if (hab.tipo === 'tesoro') {
            ctx.fillStyle = '#000';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('T', rx + tamCelda / 2, ry + tamCelda / 2 + 3);
        } else if (hab.tipo === 'tienda') {
            ctx.fillStyle = '#000';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('$', rx + tamCelda / 2, ry + tamCelda / 2 + 3);
        }
    }

    ctx.restore();
}

function _dibujarPuertas() {
    if (!engine || !renderer) return;
    const canvas = document.getElementById('mazmorraCanvas');
    const ctx = canvas.getContext('2d');
    const hab = engine.habitaciones[`${engine.habitacionActual.r},${engine.habitacionActual.c}`];
    if (!hab) return;

    const filas = engine.config.filasHabitacion;
    const cols = engine.config.columnasHabitacion;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / filas;
    const ancho = engine.config.anchoPuerta || 3;
    const halfAncho = Math.floor(ancho / 2);
    const estaLimpia = hab.limpiada;

    ctx.save();
    for (const [dir, existe] of Object.entries(hab.conexiones)) {
        if (!existe) continue;

        // Door color: green if room cleared, red if locked
        ctx.fillStyle = estaLimpia ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)';
        ctx.strokeStyle = estaLimpia ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2;

        switch (dir) {
            case 'N': {
                const cx = Math.floor(cols / 2);
                const x = (cx - halfAncho) * cellW;
                ctx.fillRect(x, 0, ancho * cellW, cellH);
                ctx.strokeRect(x, 0, ancho * cellW, cellH);
                break;
            }
            case 'S': {
                const cx = Math.floor(cols / 2);
                const x = (cx - halfAncho) * cellW;
                ctx.fillRect(x, (filas - 1) * cellH, ancho * cellW, cellH);
                ctx.strokeRect(x, (filas - 1) * cellH, ancho * cellW, cellH);
                break;
            }
            case 'W': {
                const cy = Math.floor(filas / 2);
                const y = (cy - halfAncho) * cellH;
                ctx.fillRect(0, y, cellW, ancho * cellH);
                ctx.strokeRect(0, y, cellW, ancho * cellH);
                break;
            }
            case 'E': {
                const cy = Math.floor(filas / 2);
                const y = (cy - halfAncho) * cellH;
                ctx.fillRect((cols - 1) * cellW, y, cellW, ancho * cellH);
                ctx.strokeRect((cols - 1) * cellW, y, cellW, ancho * cellH);
                break;
            }
        }
    }
    ctx.restore();
}

// ==================== Damage Events ====================

function _procesarDamageEventsDelEngine() {
    if (!engine || !renderer) return;
    for (const evt of engine.damageEvents) {
        if (evt.type === 'playerHit') {
            renderer.addFloatingText(evt.x, evt.y - 0.5, `-${evt.amount}`, '#ef4444', 1.1);
            renderer.addParticleBurst(evt.x, evt.y, 6, '#ef4444', 1.5);
            renderer.shake(3 + Math.min(evt.amount / 30, 5), 200);
        } else if (evt.type === 'gold') {
            renderer.addFloatingText(evt.x, evt.y - 0.3, `+${evt.amount}`, '#c9a84c', 0.9);
            renderer.addParticleBurst(evt.x, evt.y, 12, '#ef4444');
        } else if (evt.type === 'bleed') {
            renderer.addFloatingText(evt.x, evt.y - 0.3, `-${evt.amount}`, '#dc2626', 0.7);
        } else if (evt.type === 'xp') {
            renderer.addFloatingText(evt.x, evt.y, `+${evt.amount} XP`, '#a78bfa', 1.2, { glow: true });
        }
    }
}

// ==================== Attack ====================

function _procesarAtaqueClick(canvas) {
    if (!engine || !engine.jugador || !engine.jugador.estaVivo()) return;
    if (_levelUpShowing || pausado || _transicionActiva) return;

    const jug = engine.jugador;
    const arma = jug.armaActual;
    const now = performance.now();

    if (arma === 'espada') {
        const result = jug.atacarEspadaArco(engine.board, renderer.mouseAngulo);
        if (result) {
            Sonido.play('ataqueMelee');
            _procesarKillsDirectos(result.kills);
            _mostrarDanioEnCeldas(result.celdas);
        }
    } else if (arma === 'arco') {
        const result = jug.atacarArco(engine.board, renderer.mouseAngulo);
        if (result) {
            Sonido.play('ataqueArco');
            if (result.kills && result.kills.length > 0) _procesarKillsDirectos(result.kills);
        }
    } else if (arma === 'baston') {
        const result = jug.atacarBaston(engine.board, renderer.mouseAngulo);
        if (result) {
            Sonido.play('ataqueArco');
        }
    }
}

function _procesarKillsDirectos(kills) {
    if (!kills || kills.length === 0) return;
    const cfg = engine.config;
    for (const k of kills) {
        let recompensa = cfg.recompensaEnemigo;
        if (k instanceof EnemigoTanque) recompensa = cfg.recompensaTanque;
        else if (k instanceof EnemigoRapido) recompensa = cfg.recompensaRapido;
        else if (k instanceof EnemigoMago) recompensa = cfg.recompensaMago;
        const escalaOro = Math.pow(cfg.escalaOroOleada || 1, engine.piso - 1);
        const bonusOro = 1 + (engine.jugador.buffs?.gananciaOro || 0);
        const oroGanado = Math.floor(recompensa * escalaOro * bonusOro);
        engine.dinero += oroGanado;
        engine.totalOroGanado += oroGanado;
        engine.jugador.dinero = engine.dinero;

        // XP
        let xp = cfg.xpEnemigo || 25;
        if (k instanceof EnemigoTanque) xp = cfg.xpTanque || 60;
        else if (k instanceof EnemigoRapido) xp = cfg.xpRapido || 30;
        else if (k instanceof EnemigoMago) xp = cfg.xpMago || 40;
        if (k.esBoss) xp = cfg.xpBoss || 250;
        const escalaXP = 1 + (cfg.xpEscalaPiso || 0.15) * (engine.piso - 1);
        xp = Math.floor(xp * escalaXP);
        engine.jugador.ganarXP(xp);
        engine.totalKills++;

        if (k.esBoss) {
            engine.bossKilledThisTick = true;
            engine.totalBossesKilled++;
            engine.pisoCompletado = true;
        }

        if (renderer) {
            renderer.addFloatingText(k.x || k.columna + 0.5, k.y || k.fila, `+${oroGanado}`, '#c9a84c', 0.9);
            renderer.addFloatingText(k.x || k.columna + 0.5, (k.y || k.fila) - 0.5, `+${xp} XP`, '#a78bfa', 1.0, { glow: true });
            let particleColor = '#ef4444';
            if (k instanceof EnemigoTanque) particleColor = '#ff6600';
            else if (k instanceof EnemigoRapido) particleColor = '#eab308';
            else if (k instanceof EnemigoMago) particleColor = '#a855f7';
            renderer.addParticleBurst(k.x || k.columna + 0.5, k.y || k.fila + 0.5, 12, particleColor);
        }
        Sonido.play('enemigoMuere');

        // Drop
        if (k.esBoss || Math.random() < (cfg.probCofreEnemigo || 0)) {
            engine._dropCofre(k.fila, k.columna);
        }
        if (Math.random() < cfg.probDrop) engine._dropObjeto(k.fila, k.columna);
        engine.board.setEntidad(k.fila, k.columna, null);
    }
}

// ==================== Damage display ====================

function _mostrarDanioEnCeldas(celdas) {
    if (!renderer || !engine || !celdas) return;
    for (const celda of celdas) {
        const e = engine.board.getEntidad(celda.f, celda.c);
        if (e && e.ultimoDanio > 0 && (performance.now() - e.hitTimestamp) < 50) {
            const esCrit = e._fueGolpeCritico;
            if (esCrit) {
                renderer.addFloatingText(celda.c + 0.5, celda.f, `-${e.ultimoDanio}`, '#fbbf24', 1.3, { crit: true });
                renderer.addParticleBurst(celda.c + 0.5, celda.f + 0.5, 10, '#fbbf24', 2);
                renderer.shake(4, 150);
                Sonido.play('critico');
                e._fueGolpeCritico = false;
            } else {
                renderer.addFloatingText(celda.c + 0.5, celda.f, `-${e.ultimoDanio}`, '#fff', 0.8);
                renderer.addParticleBurst(celda.c + 0.5, celda.f + 0.5, 4, '#fbbf24', 1);
            }
        }
    }
}

// ==================== Object pickup ====================

function _recogerObjetoEnPosicion() {
    if (!engine || !engine.jugador) return;
    const jf = Math.floor(engine.jugador.y);
    const jc = Math.floor(engine.jugador.x);
    if (jf < 0 || jf >= engine.board.filas || jc < 0 || jc >= engine.board.columnas) return;
    const obj = engine.board.getObjeto(jf, jc);
    if (!obj) return;
    if (obj instanceof Cofre) return; // cofres se abren con F
    engine.jugador.recogerObjeto(obj);
    engine.board.setObjeto(jf, jc, null);
    Sonido.play('recogerObjeto');
    if (renderer) {
        renderer.addFloatingText(jc + 0.5, jf, obj.constructor.name, '#22c55e', 0.8);
    }
}

// ==================== Input ====================

const keysDown = new Set();
let mouseHeld = false;
let lastMousePos = { x: 0, y: 0 };

function _bindInput() {
    const canvas = document.getElementById('mazmorraCanvas');

    const onKeyDown = (e) => {
        if (_levelUpShowing) return;
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'e', 'f', ' '].includes(key) || key === 'shift') {
            e.preventDefault();
            keysDown.add(key === ' ' ? 'space' : key);
        }
        if (key === 'shift') keysDown.add('shift');
        if (key === 'escape') _togglePausa();

        // F to open cofre
        if (key === 'f') _intentarAbrirCofre();

        // E for ability
        if (key === 'e') _usarHabilidad();

        // Space for circular attack
        if (key === ' ') _ataqueCircular();
    };
    const onKeyUp = (e) => {
        const key = e.key.toLowerCase();
        keysDown.delete(key === ' ' ? 'space' : key);
        if (key === 'shift') keysDown.delete('shift');
    };
    const onMouseDown = (e) => {
        if (e.button === 0) mouseHeld = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = (e) => {
        if (e.button === 0) mouseHeld = false;
    };
    const onMouseMove = (e) => {
        lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('contextmenu', onContextMenu);

    listeners = [
        ['keydown', onKeyDown, window],
        ['keyup', onKeyUp, window],
        ['mousedown', onMouseDown, canvas],
        ['mouseup', onMouseUp, window],
        ['mousemove', onMouseMove, window],
        ['contextmenu', onContextMenu, canvas],
    ];
}

function _unbindInput() {
    for (const [evt, fn, target] of listeners) {
        target.removeEventListener(evt, fn);
    }
    listeners = [];
    keysDown.clear();
    mouseHeld = false;
}

// ==================== Abilities ====================

function _usarHabilidad() {
    if (!engine || !engine.jugador || !engine.jugador.estaVivo()) return;
    if (_levelUpShowing || pausado) return;
    const result = engine.jugador.usarHabilidad(engine.board);
    if (result) {
        Sonido.play('habilidadEspecial');
        if (result.kills) _procesarKillsDirectos(result.kills);
        if (result.celdas) _mostrarDanioEnCeldas(result.celdas);
        if (renderer) renderer.shake(5, 300);
    }
}

function _ataqueCircular() {
    if (!engine || !engine.jugador || !engine.jugador.estaVivo()) return;
    if (_levelUpShowing || pausado) return;
    const result = engine.jugador.atacarCircular(engine.board);
    if (result) {
        Sonido.play('ataqueMelee');
        if (result.kills) _procesarKillsDirectos(result.kills);
        if (result.celdas) _mostrarDanioEnCeldas(result.celdas);
    }
}

function _intentarAbrirCofre() {
    if (!engine || !engine.jugador || !engine.jugador.estaVivo()) return;
    const jf = Math.floor(engine.jugador.y);
    const jc = Math.floor(engine.jugador.x);
    // Check nearby cells for cofre
    for (let df = -1; df <= 1; df++) {
        for (let dc = -1; dc <= 1; dc++) {
            const f = jf + df;
            const c = jc + dc;
            if (f < 0 || f >= engine.board.filas || c < 0 || c >= engine.board.columnas) continue;
            const obj = engine.board.getObjeto(f, c);
            if (obj instanceof Cofre) {
                _abrirCofre(f, c, obj);
                return;
            }
        }
    }
}

function _abrirCofre(f, c, cofre) {
    const cfg = engine.config;
    const costoBase = cfg.costoCofreBase || 30;
    const costo = Math.floor(costoBase * (1 + engine.piso * 0.2));

    if (engine.dinero < costo) {
        if (renderer) renderer.addFloatingText(c + 0.5, f, 'Sin oro', '#ef4444', 0.8);
        return;
    }

    engine.dinero -= costo;
    engine.jugador.dinero = engine.dinero;
    engine.totalCofresAbiertos++;
    engine.board.setObjeto(f, c, null);

    // Roll rarity
    const tiers = cfg.cofreTiers || [];
    const pesoTotal = tiers.reduce((s, t) => s + t.peso, 0);
    let roll = Math.random() * pesoTotal;
    let tier = tiers[0];
    for (const t of tiers) {
        roll -= t.peso;
        if (roll <= 0) { tier = t; break; }
    }

    // Roll buff
    const vals = cfg.cofreValoresBase || {};
    const buffKeys = Object.keys(vals);
    const buffKey = buffKeys[Math.floor(Math.random() * buffKeys.length)];
    const valor = vals[buffKey] * tier.mult;

    // Apply buff
    const jug = engine.jugador;
    if (!jug.buffs) jug.buffs = {};
    jug.buffs[buffKey] = (jug.buffs[buffKey] || 0) + valor;

    const nombres = {
        roboVida: 'Robo Vida',
        gananciaOro: 'Oro Extra',
        velocidadExtra: 'Velocidad',
        reduccionCooldownHab: 'CD Habilidad',
    };

    Sonido.play('cofre');
    if (renderer) {
        renderer.addFloatingText(c + 0.5, f - 0.5, `${tier.id.toUpperCase()}`, tier.color, 1.3, { glow: true });
        renderer.addFloatingText(c + 0.5, f, `${nombres[buffKey] || buffKey} +${Math.round(valor * 100)}%`, '#d4c4a0', 0.9);
        renderer.addParticleBurst(c + 0.5, f + 0.5, 15, tier.color, 3);
    }
}

// ==================== Pause ====================

function _togglePausa() {
    if (_levelUpShowing) return;
    pausado = !pausado;
    const overlay = document.getElementById('mazmorraPasseOverlay');
    overlay.style.display = pausado ? 'flex' : 'none';
    if (pausado) {
        _stopLoop();
    } else {
        _startLoop();
    }
}

function _bindPauseButtons() {
    document.getElementById('btnMazmorraPauseResume').onclick = () => {
        if (pausado) _togglePausa();
    };
    document.getElementById('btnMazmorraPauseQuit').onclick = () => {
        destruirMazmorra();
        if (onVolverCallback) onVolverCallback();
    };
    document.getElementById('btnVolverMazmorraOverlay').onclick = () => {
        if (!pausado) _togglePausa();
    };
}

// ==================== Tutorial ====================

function _mostrarTutorialSiNecesario() {
    if (localStorage.getItem('mazmorraTutorialVisto')) return;
    const overlay = document.getElementById('mazmorraTutorialOverlay');
    overlay.style.display = 'flex';
    _stopLoop();
    document.getElementById('btnMazmorraTutorialCerrar').onclick = () => {
        overlay.style.display = 'none';
        localStorage.setItem('mazmorraTutorialVisto', '1');
        _startLoop();
    };
}

// ==================== Level Up / Perks ====================

function _comprobarLevelUp() {
    if (_levelUpShowing) return;
    if (!engine || !engine.jugador) return;
    const jug = engine.jugador;

    if (jug.nivelesSubidosPendientes > 0) {
        const cfg = engine.config;
        const nivelPerk = cfg.nivelPerk || 7;

        for (let n = _perkNivelCalculado + 1; n <= jug.nivel; n++) {
            if (n % nivelPerk === 0 && n > 0) {
                jug.perksPendientes++;
            }
        }
        _perkNivelCalculado = jug.nivel;

        _mostrarLevelUpUI();
    }
}

function _mostrarLevelUpUI() {
    if (_levelUpShowing) return;
    _levelUpShowing = true;
    _stopLoop();

    const jug = engine.jugador;

    // Effects
    Sonido.play('levelUp');
    if (renderer) {
        renderer.flash('rgba(255,215,0,0.25)', 400);
        renderer.addParticleBurst(jug.x, jug.y, 20, '#fbbf24', 3);
    }

    // Perk or stat?
    if (jug.perksPendientes > 0) {
        _mostrarPerkUI();
        return;
    }

    if (jug.nivelesSubidosPendientes <= 0) {
        _levelUpShowing = false;
        _startLoop();
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'boss-reward-overlay levelup-overlay';
    overlay.innerHTML = `
        <div class="boss-reward-titulo">NIVEL ${jug.nivel}</div>
        <div class="boss-reward-subtitulo">Elige una mejora</div>
    `;

    const opciones = document.createElement('div');
    opciones.className = 'boss-reward-opciones';

    const mejoras = [
        { tipo: 'vida', nombre: 'VIDA', desc: `+${Math.round((engine.config.mejoraVidaNivelPct || 0.30) * 100)}% vida máxima`, icono: '❤️', color: '#22c55e' },
        { tipo: 'danio', nombre: 'DAÑO', desc: `+${Math.round((engine.config.mejoraDanioNivelPct || 0.30) * 100)}% daño`, icono: '⚔️', color: '#ef4444' },
        { tipo: 'velAtaque', nombre: 'VEL. ATAQUE', desc: `-${Math.round((engine.config.mejoraVelAtaqueNivelPct || 0.22) * 100)}% cooldown`, icono: '⚡', color: '#3b82f6' },
    ];

    for (const mejora of mejoras) {
        const card = document.createElement('div');
        card.className = 'boss-reward-card';
        card.innerHTML = `
            <div class="boss-reward-icono">${mejora.icono}</div>
            <div class="boss-reward-nombre" style="color:${mejora.color}">${mejora.nombre}</div>
            <div class="boss-reward-desc">${mejora.desc}</div>
        `;
        card.addEventListener('click', () => {
            Sonido.play('recompensa');
            jug.aplicarMejoraNivel(mejora.tipo);
            overlay.remove();
            _levelUpShowing = false;
            renderer.updateHUDOleadas(engine);
            if (jug.nivelesSubidosPendientes > 0 || jug.perksPendientes > 0) {
                _mostrarLevelUpUI();
            } else {
                _startLoop();
            }
        });
        opciones.appendChild(card);
    }

    overlay.appendChild(opciones);
    document.body.appendChild(overlay);
}

function _mostrarPerkUI() {
    const jug = engine.jugador;
    const clase = jug.idClase;
    const perksClase = PERKS_POR_CLASE[clase];
    if (!perksClase) {
        jug.perksPendientes--;
        _levelUpShowing = false;
        _startLoop();
        return;
    }

    const perksTomados = Object.keys(jug.perks).filter(k => jug.perks[k]).length;
    const tier = Math.min(perksTomados, perksClase.length - 1);
    const opciones = perksClase[tier];
    if (!opciones || opciones.length === 0) {
        jug.perksPendientes--;
        _levelUpShowing = false;
        if (jug.nivelesSubidosPendientes > 0 || jug.perksPendientes > 0) {
            _mostrarLevelUpUI();
        } else {
            _startLoop();
        }
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'boss-reward-overlay levelup-overlay';
    overlay.innerHTML = `
        <div class="boss-reward-titulo" style="color:#a855f7">PERK DE CLASE</div>
        <div class="boss-reward-subtitulo">Nivel ${jug.nivel} — Elige un perk</div>
    `;

    const opcionesDiv = document.createElement('div');
    opcionesDiv.className = 'boss-reward-opciones';

    for (const perk of opciones) {
        if (jug.perks[perk.id]) continue;
        const card = document.createElement('div');
        card.className = 'boss-reward-card perk-card';
        card.innerHTML = `
            <div class="boss-reward-icono">${perk.icono}</div>
            <div class="boss-reward-nombre" style="color:#a855f7">${perk.nombre}</div>
            <div class="boss-reward-desc">${perk.desc}</div>
        `;
        card.addEventListener('click', () => {
            Sonido.play('perk');
            if (renderer) renderer.flash('rgba(168,85,247,0.3)', 500);
            jug.aplicarPerk(perk.id);
            if (perk.id === 'drenaje') jug.buffs.roboVida += 0.08;
            overlay.remove();
            _levelUpShowing = false;
            renderer.updateHUDOleadas(engine);
            if (jug.perksPendientes > 0 || jug.nivelesSubidosPendientes > 0) {
                _mostrarLevelUpUI();
            } else {
                _startLoop();
            }
        });
        opcionesDiv.appendChild(card);
    }

    overlay.appendChild(opcionesDiv);
    document.body.appendChild(overlay);
}

// ==================== Floor Complete ====================

function _mostrarPisoCompletado() {
    const overlay = document.createElement('div');
    overlay.className = 'mazmorra-piso-overlay';
    overlay.innerHTML = `
        <div class="piso-titulo">PISO ${engine.piso} COMPLETADO</div>
        <div class="piso-subtitulo">El jefe ha caído. Preparándose para el siguiente piso...</div>
        <button class="piso-btn">SIGUIENTE PISO</button>
    `;

    overlay.querySelector('.piso-btn').addEventListener('click', () => {
        overlay.remove();
        engine.avanzarPiso();
        renderer.updateHUDOleadas(engine);
        _startLoop();
    });

    document.body.appendChild(overlay);
}

// ==================== Game Over ====================

function _mostrarGameOver() {
    const overlay = document.createElement('div');
    overlay.className = 'boss-reward-overlay';
    overlay.innerHTML = `
        <div class="boss-reward-titulo" style="color:#ef4444">HAS MUERTO</div>
        <div class="boss-reward-subtitulo">Piso ${engine.piso} — Nivel ${engine.jugador.nivel}</div>
        <div style="color:#9a8a6a; text-align:center; line-height:1.8;">
            Kills: ${engine.totalKills}<br>
            Bosses: ${engine.totalBossesKilled}<br>
            Salas limpiadas: ${engine.totalHabitacionesLimpiadas}<br>
            Oro total: ${engine.totalOroGanado}
        </div>
        <button class="piso-btn" style="margin-top:16px">VOLVER AL MENÚ</button>
    `;

    overlay.querySelector('.piso-btn').addEventListener('click', () => {
        overlay.remove();
        destruirMazmorra();
        if (onVolverCallback) onVolverCallback();
    });

    document.body.appendChild(overlay);
}

// ==================== Cleanup ====================

export function destruirMazmorra() {
    Sonido.stopMusica();
    _stopLoop();
    _stopRaf();
    _unbindInput();
    document.body.classList.remove('mazmorra-active');
    if (canvasResizeObserver) { canvasResizeObserver.disconnect(); canvasResizeObserver = null; }

    const layout = document.getElementById('layoutMazmorra');
    layout.style.display = 'none';
    document.getElementById('mazmorraGameArea').style.display = 'none';

    pausado = false;
    _transicionActiva = false;
    TouchControls.destroyTouchControls();

    engine = null;
    renderer = null;
}
