import { OleadasEngine } from './oleadasEngine.js';
import { Renderer, spritesListos } from './renderer.js';
import { Enemigo, EnemigoMago } from './entidad.js';
import { Cofre } from './objetos.js';
import oleadasConfig from './oleadasConfig.js';
import * as Sonido from './sonido.js';

let engine = null;
let renderer = null;
let gameLoop = null;
let rafId = null;
let onVolverCallback = null;
let placementMode = null; // 'muro' | 'torre' | 'mejoraTorre' | null
let listeners = []; // para limpiar al destruir
let autoOleadaTimer = null;
let fastEnemyLoop = null;
let runtimeConfig = null; // config de partida (overrides aplicados)
let claseSeleccionada = null;

// ==================== Tienda items ====================

function _buildTiendaItems(cfg) {
    return [
        { seccion: 'MEJORAS JUGADOR' },
        { tipo: 'mejoraVida', nombre: 'Vida +30%', desc: 'Aumenta vida máxima' },
        { tipo: 'mejoraDanio', nombre: 'Daño +40%', desc: 'Aumenta daño total' },
        { tipo: 'mejoraVelAtaque', nombre: 'Vel. Ataque', desc: 'Cooldown -15%' },
        { seccion: 'OBJETOS' },
        { tipo: 'pocion', nombre: 'Poci\u00F3n', desc: `Cura ${cfg.curacionPocion} HP` },
        { tipo: 'escudo', nombre: 'Escudo +50', desc: 'Absorbe da\u00F1o' },
        { tipo: 'estrella', nombre: 'Estrella', desc: `Invencible ${cfg.turnosEstrella}t` },
        { seccion: 'DEFENSAS' },
        { tipo: 'muro', nombre: 'Muro', desc: `${cfg.vidaMuro} HP \u2014 click para colocar`, placement: true },
        { tipo: 'torre', nombre: 'Torre', desc: 'Ataca enemigos \u2014 click para colocar', placement: true },
        { tipo: 'mejoraTorre', nombre: 'Mejorar Torre', desc: 'Click en torre existente', placement: true },
    ];
}

let TIENDA_ITEMS = _buildTiendaItems(oleadasConfig);

// ==================== Inicializar ====================

export function iniciarOleadas(onVolver) {
    onVolverCallback = onVolver;

    const layout = document.getElementById('layoutOleadas');
    layout.style.display = 'flex';

    // Ocultar area de juego inicialmente
    document.getElementById('oleadasGameArea').style.display = 'none';

    // Mostrar menu de clases
    const menuClases = document.getElementById('menuClasesOleadas');
    menuClases.style.display = 'flex';

    _construirMenuClases();

    // Evento volver atras desde selección
    const btnVolverMenuDesdeClases = document.getElementById('btnVolverMenuDesdeClases');
    btnVolverMenuDesdeClases.onclick = () => {
        layout.style.display = 'none';
        if (onVolverCallback) onVolverCallback();
    };
}

function _iniciarPartidaReal(idClase) {
    document.getElementById('menuClasesOleadas').style.display = 'none';
    document.getElementById('menuConfigOleadas').style.display = 'none';
    document.getElementById('oleadasGameArea').style.display = 'flex';
    document.getElementById('tienda').style.display = '';

    const cfg = runtimeConfig || oleadasConfig;

    const canvas = document.getElementById('oleadasCanvas');
    const hudDiv = document.getElementById('hudOleadas');

    // Tamanio canvas — llenar todo el contenedor
    const { filas, columnas } = cfg;
    const container = document.getElementById('oleadasCanvasContainer');
    const ancho = container.clientWidth;
    const cellSize = ancho / columnas;
    canvas.width = ancho;
    canvas.height = Math.round(cellSize * filas);

    renderer = new Renderer(canvas, hudDiv, null);

    engine = new OleadasEngine(cfg);
    // Pasamos la clase seleccionada
    engine.inicializar(idClase);

    placementMode = null;

    TIENDA_ITEMS = _buildTiendaItems(cfg);
    _construirTienda();
    _bindInput();
    _actualizarTienda();

    spritesListos.then(() => {
        _startRaf();
        _startLoop();
        renderer.updateHUDOleadas(engine);
        Sonido.playMusica('musicaJuego');
    });
}

function _construirMenuClases() {
    const container = document.querySelector('.clases-container');
    container.innerHTML = '';

    const clases = oleadasConfig.clases;
    for (const [id, config] of Object.entries(clases)) {
        const card = document.createElement('div');
        card.className = 'clase-card';
        const icono = config.icono || '⚔️';
        card.innerHTML = `
            <div class="clase-icono">${icono}</div>
            <div class="clase-titulo">${config.nombre}</div>
            <div class="clase-desc">${config.desc}</div>
            <div class="clase-stats">
                <div class="clase-stat"><span class="clase-stat-label">Vida</span><span class="clase-stat-value">${config.vida}</span></div>
                <div class="clase-stat"><span class="clase-stat-label">Daño</span><span class="clase-stat-value">${config.danio}</span></div>
                <div class="clase-stat"><span class="clase-stat-label">Arma</span><span class="clase-stat-value">${config.arma.toUpperCase()}</span></div>
            </div>
        `;
        card.onclick = () => {
            _mostrarConfigMenu(id);
        };
        container.appendChild(card);
    }
}

// ==================== Menú Configuración ====================

const DIFICULTAD_PRESETS = {
    facil:   { multVida: 0.5, multDanio: 0.5, escalaVida: 1.06 },
    normal:  { multVida: 1,   multDanio: 1,   escalaVida: 1.12 },
    dificil: { multVida: 2,   multDanio: 1.5, escalaVida: 1.20 },
};

const TAMANO_PRESETS = {
    pequeno: { filas: 13, columnas: 23 },
    mediano: { filas: 19, columnas: 35 },
    grande:  { filas: 25, columnas: 45 },
    enorme:  { filas: 31, columnas: 55 },
};

const VELOCIDAD_PRESETS = { lenta: 300, normal: 200, rapida: 120 };
const ORO_PRESETS = { nada: 0, poco: 50, normal: 100, mucho: 300 };
const DROPS_PRESETS = { pocos: 0.05, normal: 0.15, muchos: 0.30 };

// Map advanced keys to their related simple toggle
const ADV_TO_SIMPLE = {
    escalaVidaOleada: 'dificultad',
    enemigosBase: null,
    enemigosIncremento: null,
    oleadaTanques: null,
    oleadaRapidos: null,
    oleadaMagos: null,
    oleadaBoss: null,
    descansoBaseMs: null,
};

function _mostrarConfigMenu(idClase) {
    claseSeleccionada = idClase;
    document.getElementById('menuClasesOleadas').style.display = 'none';
    const menuConfig = document.getElementById('menuConfigOleadas');
    menuConfig.style.display = 'flex';

    // Show class summary
    const claseInfo = oleadasConfig.clases[idClase];
    const resumen = document.getElementById('configClaseResumen');
    resumen.textContent = `${claseInfo.icono || ''} ${claseInfo.nombre}`;

    // Reset all toggles to defaults
    _resetConfigToggles();

    // Reset advanced inputs to defaults
    const _tierPeso = (id) => oleadasConfig.cofreTiers.find(t => t.id === id)?.peso;
    const COFRE_ADV_DEFAULTS = {
        probCofreEnemigo: oleadasConfig.probCofreEnemigo * 100,
        costoCofreBase: oleadasConfig.costoCofreBase,
        cofreRoboVida: oleadasConfig.cofreValoresBase.roboVida * 100,
        cofreGananciaOro: oleadasConfig.cofreValoresBase.gananciaOro * 100,
        cofreVelocidad: oleadasConfig.cofreValoresBase.velocidadExtra * 100,
        pesoNormal: _tierPeso('normal'),
        pesoRaro: _tierPeso('raro'),
        pesoEpico: _tierPeso('epico'),
        pesoLegendario: _tierPeso('legendario'),
    };
    const advInputs = menuConfig.querySelectorAll('[data-adv]');
    for (const input of advInputs) {
        const key = input.dataset.adv;
        input.value = COFRE_ADV_DEFAULTS[key] !== undefined ? COFRE_ADV_DEFAULTS[key] : oleadasConfig[key];
    }

    // Bind toggle clicks
    const rows = menuConfig.querySelectorAll('.config-toggle-row');
    for (const row of rows) {
        const btns = row.querySelectorAll('.config-toggle-btn');
        for (const btn of btns) {
            btn.onclick = () => {
                // Deselect siblings
                for (const b of btns) b.classList.remove('active');
                btn.classList.add('active');

                // If dificultad changed, update escalaVidaOleada advanced input
                if (row.dataset.config === 'dificultad') {
                    const preset = DIFICULTAD_PRESETS[btn.dataset.value];
                    if (preset) {
                        const escalaInput = menuConfig.querySelector('[data-adv="escalaVidaOleada"]');
                        if (escalaInput) escalaInput.value = preset.escalaVida;
                    }
                }
            };
        }
    }

    // Bind advanced inputs — deselect related simple toggle on change
    for (const input of advInputs) {
        input.oninput = () => {
            const key = input.dataset.adv;
            if (key === 'escalaVidaOleada') {
                // Check if value matches any dificultad preset
                const val = parseFloat(input.value);
                const row = menuConfig.querySelector('[data-config="dificultad"]');
                const btns = row.querySelectorAll('.config-toggle-btn');
                let matched = false;
                for (const btn of btns) {
                    const preset = DIFICULTAD_PRESETS[btn.dataset.value];
                    if (preset && Math.abs(preset.escalaVida - val) < 0.001) {
                        for (const b of btns) b.classList.remove('active');
                        btn.classList.add('active');
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    for (const b of btns) b.classList.remove('active');
                }
            }
        };
    }

    // Back button
    document.getElementById('btnConfigAtras').onclick = () => {
        menuConfig.style.display = 'none';
        document.getElementById('menuClasesOleadas').style.display = 'flex';
    };

    // Start button
    document.getElementById('btnConfigComenzar').onclick = () => {
        runtimeConfig = _leerConfigUI();
        _iniciarPartidaReal(claseSeleccionada);
    };
}

function _resetConfigToggles() {
    const menuConfig = document.getElementById('menuConfigOleadas');
    const rows = menuConfig.querySelectorAll('.config-toggle-row');
    for (const row of rows) {
        const btns = row.querySelectorAll('.config-toggle-btn');
        for (const btn of btns) {
            // Default values have data-value containing "normal" or "mediano"
            const isDefault = btn.dataset.value === 'normal' || btn.dataset.value === 'mediano';
            btn.classList.toggle('active', isDefault);
        }
    }
}

function _getActiveToggle(configName) {
    const row = document.querySelector(`[data-config="${configName}"]`);
    if (!row) return null;
    const active = row.querySelector('.config-toggle-btn.active');
    return active ? active.dataset.value : null;
}

function _leerConfigUI() {
    // Start with a copy of base config
    const cfg = { ...oleadasConfig };

    // Dificultad
    const dif = _getActiveToggle('dificultad');
    const difPreset = dif ? DIFICULTAD_PRESETS[dif] : null;
    if (difPreset) {
        cfg.vidaEnemigo = Math.floor(oleadasConfig.vidaEnemigo * difPreset.multVida);
        cfg.danioEnemigo = Math.floor(oleadasConfig.danioEnemigo * difPreset.multDanio);
        cfg.vidaTanque = Math.floor(oleadasConfig.vidaTanque * difPreset.multVida);
        cfg.danioTanque = Math.floor(oleadasConfig.danioTanque * difPreset.multDanio);
        cfg.vidaRapido = Math.floor(oleadasConfig.vidaRapido * difPreset.multVida);
        cfg.danioRapido = Math.floor(oleadasConfig.danioRapido * difPreset.multDanio);
        cfg.vidaMago = Math.floor(oleadasConfig.vidaMago * difPreset.multVida);
        cfg.danioMago = Math.floor(oleadasConfig.danioMago * difPreset.multDanio);
        cfg.escalaVidaOleada = difPreset.escalaVida;
    } else {
        // Custom — read escalaVidaOleada from advanced input
        const escalaInput = document.querySelector('[data-adv="escalaVidaOleada"]');
        if (escalaInput) cfg.escalaVidaOleada = parseFloat(escalaInput.value) || oleadasConfig.escalaVidaOleada;
    }

    // Tamaño
    const tam = _getActiveToggle('tamano');
    if (tam && TAMANO_PRESETS[tam]) {
        cfg.filas = TAMANO_PRESETS[tam].filas;
        cfg.columnas = TAMANO_PRESETS[tam].columnas;
    }

    // Velocidad
    const vel = _getActiveToggle('velocidad');
    if (vel && VELOCIDAD_PRESETS[vel] !== undefined) {
        cfg.velocidadMs = VELOCIDAD_PRESETS[vel];
    }

    // Oro inicial
    const oro = _getActiveToggle('oro');
    if (oro && ORO_PRESETS[oro] !== undefined) {
        cfg.dineroInicial = ORO_PRESETS[oro];
    }

    // Drops
    const drops = _getActiveToggle('drops');
    if (drops && DROPS_PRESETS[drops] !== undefined) {
        cfg.probDrop = DROPS_PRESETS[drops];
    }

    // Advanced overrides (these take priority)
    const COFRE_ADV_KEYS = new Set(['probCofreEnemigo', 'costoCofreBase', 'cofreRoboVida', 'cofreGananciaOro', 'cofreVelocidad', 'pesoNormal', 'pesoRaro', 'pesoEpico', 'pesoLegendario']);
    const advInputs = document.querySelectorAll('[data-adv]');
    for (const input of advInputs) {
        const key = input.dataset.adv;
        const val = parseFloat(input.value);
        if (!isNaN(val) && key !== 'escalaVidaOleada' && !COFRE_ADV_KEYS.has(key)) {
            cfg[key] = val;
        }
        // escalaVidaOleada already handled by dificultad or custom above
    }

    // Cofre advanced overrides (% → decimal, sub-object)
    const _advVal = (k) => { const el = document.querySelector(`[data-adv="${k}"]`); return el ? parseFloat(el.value) : NaN; };
    const probCofre = _advVal('probCofreEnemigo');
    if (!isNaN(probCofre)) cfg.probCofreEnemigo = probCofre / 100;
    const costoCofre = _advVal('costoCofreBase');
    if (!isNaN(costoCofre)) cfg.costoCofreBase = costoCofre;
    cfg.cofreValoresBase = { ...oleadasConfig.cofreValoresBase };
    const rv = _advVal('cofreRoboVida');
    if (!isNaN(rv)) cfg.cofreValoresBase.roboVida = rv / 100;
    const go = _advVal('cofreGananciaOro');
    if (!isNaN(go)) cfg.cofreValoresBase.gananciaOro = go / 100;
    const ve = _advVal('cofreVelocidad');
    if (!isNaN(ve)) cfg.cofreValoresBase.velocidadExtra = ve / 100;

    // Pesos de rareza de cofres
    cfg.cofreTiers = oleadasConfig.cofreTiers.map(t => ({ ...t }));
    const pesoMap = { normal: 'pesoNormal', raro: 'pesoRaro', epico: 'pesoEpico', legendario: 'pesoLegendario' };
    for (const tier of cfg.cofreTiers) {
        const v = _advVal(pesoMap[tier.id]);
        if (!isNaN(v)) tier.peso = v;
    }

    // If no dificultad preset selected, also read escalaVidaOleada from advanced
    if (!dif) {
        const escalaInput = document.querySelector('[data-adv="escalaVidaOleada"]');
        if (escalaInput) cfg.escalaVidaOleada = parseFloat(escalaInput.value) || oleadasConfig.escalaVidaOleada;
    }

    // Copy clases reference (not overridden)
    cfg.clases = oleadasConfig.clases;

    return cfg;
}

export function destruirOleadas() {
    Sonido.stopMusica();
    _stopLoop();
    _stopRaf();
    _cancelarAutoOleada();
    _unbindInput();
    placementMode = null;

    // Reset botones
    const btnOleada = document.getElementById('btnIniciarOleada');
    if (btnOleada) btnOleada.style.display = '';

    const layout = document.getElementById('layoutOleadas');
    layout.style.display = 'none';
    document.getElementById('menuConfigOleadas').style.display = 'none';
    document.getElementById('tienda').style.display = 'none';

    engine = null;
    renderer = null;
    runtimeConfig = null;
    claseSeleccionada = null;
}

// ==================== Game Loop ====================

function _procesarAnimaciones(board, rend) {
    for (const exp of board.ultimasExplosiones) {
        rend.iniciarExplosion(exp.f, exp.c, exp.radio || 0);
    }
    for (const e of board.entidadesActivas) {
        if (e.pendingAnim) {
            const anim = e.pendingAnim;
            if (anim.tipo === 'swing') rend.iniciarSwing(anim.celdas, anim.angulo);
            else if (anim.tipo === 'flecha') rend.iniciarFlecha(anim.origen, anim.trayectoria);
            else if (anim.tipo === 'magia') rend.iniciarMagia(anim.origen, anim.trayectoria);
            e.pendingAnim = null;
        }
    }
}

function _startLoop() {
    if (gameLoop) return;
    gameLoop = setInterval(() => {
        // Solo corremos la lógica de monstruos si la oleada está en curso (y el jugador vivo)
        if (engine.oleadaEnCurso && !engine.gameOver) {
            const vidaAntes = engine.jugador.vida;
            engine.jugador.actuar(engine.board);
            engine.tick();
            if (engine.jugador.vida < vidaAntes) Sonido.play('danioRecibido');

            _procesarAnimaciones(engine.board, renderer);

            if (engine.bossKilledThisTick) {
                _stopLoop();
                _mostrarRecompensaBoss();
                return;
            }
        }

        renderer.updateHUDOleadas(engine);
        _actualizarTienda();

        if (engine.gameOver) {
            _stopLoop();
            _stopRaf();
            Sonido.play('muerte');
            Sonido.stopMusica();
            _mostrarGameOver();
        }

        // Auto-iniciar siguiente oleada si terminaron todos los enemigos
        if (!engine.oleadaEnCurso && !engine.gameOver) {
            // Pausa inter-oleada: no auto-start, el jugador decide
        }
    }, (runtimeConfig || oleadasConfig).velocidadMs);

    // Timer aparte para enemigos rápidos (el doble de frecuencia)
    if (!fastEnemyLoop) {
        const velRapidos = 120;
        fastEnemyLoop = setInterval(() => {
            if (!engine || engine.gameOver || !engine.oleadaEnCurso) return;
            engine.tickRapidos();
        }, velRapidos);
    }
}

function _stopLoop() {
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
    if (fastEnemyLoop) {
        clearInterval(fastEnemyLoop);
        fastEnemyLoop = null;
    }
    // RAF sigue activo para render visual (arma, placement, etc.)
    // Se para en destruirOleadas o gameOver
}

function _startRaf() {
    if (rafId) return;
    const canvas = document.getElementById('oleadasCanvas');
    function loop() {
        if (mouseHeld && canvas) _procesarAtaqueClick(canvas);
        _render();
        rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
}

function _stopRaf() {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

function _render() {
    // Actualizar ángulo del mouse para el renderer (usando posición interpolada)
    if (renderer && engine && engine.jugador) {
        const canvas = document.getElementById('oleadasCanvas');
        const rect = canvas.getBoundingClientRect();
        const cellW = canvas.width / engine.board.columnas;
        const cellH = canvas.height / engine.board.filas;
        const jpos = renderer._getPosInterpolada(engine.jugador, cellW, cellH);
        const jugX = jpos.x + cellW / 2;
        const jugY = jpos.y + cellH / 2;
        const mouseX = (lastMousePos.x - rect.left) * (canvas.width / rect.width);
        const mouseY = (lastMousePos.y - rect.top) * (canvas.height / rect.height);
        renderer.mouseAngulo = Math.atan2(mouseY - jugY, mouseX - jugX);
    }
    renderer.drawBoardOleadas(engine.board, engine);
}

// ==================== Input ====================

const keysDown = new Set();
let moveTimer = null;
let mouseHeld = false;
let lastMousePos = { x: 0, y: 0 }; // posición actual del mouse en pantalla

function _procesarMovimiento() {
    if (!engine || engine.gameOver || !engine.jugador.estaVivo()) return;

    let df = 0, dc = 0;
    if (keysDown.has('w')) df -= 1;
    if (keysDown.has('s')) df += 1;
    if (keysDown.has('a')) dc -= 1;
    if (keysDown.has('d')) dc += 1;

    if (df === 0 && dc === 0) return;

    engine.jugador.moverDir(df, dc, engine.board);

    // Recoger objeto tras moverse (excluir cofres)
    const obj = engine.board.getObjeto(engine.jugador.fila, engine.jugador.columna);
    if (obj !== null && !(obj instanceof Cofre)) {
        const vidaAntes = engine.jugador.vida;
        obj.aplicar(engine.jugador);
        engine.board.setObjeto(engine.jugador.fila, engine.jugador.columna, null);
        if (engine.jugador.vida > vidaAntes) Sonido.play('curar');
        else Sonido.play('recogerObjeto');
    }
    renderer.updateHUDOleadas(engine);
}

function _loopMovimiento() {
    if (!keysDown.has('w') && !keysDown.has('s') && !keysDown.has('a') && !keysDown.has('d')) {
        moveTimer = null;
        return;
    }
    _procesarMovimiento();
    const delay = _getMovDelay();
    moveTimer = setTimeout(_loopMovimiento, delay);
}

function _getMovDelay() {
    if (!engine || !engine.jugador) return 100;
    const baseDelay = engine.jugador.velocidadMoverMs || 100;
    const speedMult = 1 - Math.min(engine.jugador.buffs?.velocidadExtra || 0, 0.6);
    return Math.max(50, Math.floor(baseDelay * speedMult));
}

function _startMoveTimer() {
    if (moveTimer) return;
    _procesarMovimiento(); // movimiento inmediato
    const delay = _getMovDelay();
    moveTimer = setTimeout(_loopMovimiento, delay);
}

function _stopMoveTimer() {
    if (moveTimer) {
        clearTimeout(moveTimer);
        moveTimer = null;
    }
}

function _procesarKills(kills) {
    const cfg = runtimeConfig || oleadasConfig;
    engine.totalKills += kills.length;
    for (const k of kills) {
        let r = cfg.recompensaEnemigo;
        if (k.simbolo === 'T') r = cfg.recompensaTanque;
        else if (k.simbolo === 'R') r = cfg.recompensaRapido;
        else if (k.simbolo === 'W') r = cfg.recompensaMago;
        const bonusOro = 1 + (engine.jugador.buffs?.gananciaOro || 0);
        engine.dinero += Math.floor(r * bonusOro);
        engine.jugador.dinero = engine.dinero;

        // Cofre drop (boss siempre, normales 8%) — kills del jugador no pasan por engine.tick
        if (k.esBoss || Math.random() < (cfg.probCofreEnemigo || 0)) {
            engine._dropCofre(k.fila, k.columna);
        }

        if (k.esBoss) {
            engine.bossKilledThisTick = true;
            Sonido.play('bossDerrotado');
            _stopLoop();
            _mostrarRecompensaBoss();
        } else {
            Sonido.play('enemigoMuere');
        }
    }
}

let _canvasClickHandler = null;

function _calcularAnguloMouse(canvas) {
    const rect = canvas.getBoundingClientRect();
    const cellW = canvas.width / engine.board.columnas;
    const cellH = canvas.height / engine.board.filas;
    const jugX = engine.jugador.columna * cellW + cellW / 2;
    const jugY = engine.jugador.fila * cellH + cellH / 2;
    const mouseX = (lastMousePos.x - rect.left) * (canvas.width / rect.width);
    const mouseY = (lastMousePos.y - rect.top) * (canvas.height / rect.height);
    return Math.atan2(mouseY - jugY, mouseX - jugX);
}

function _procesarAtaqueClick(canvas) {
    if (!engine || engine.gameOver || !engine.jugador.estaVivo()) return;
    if (placementMode) return;

    const angulo = _calcularAnguloMouse(canvas);

    if (engine.jugador.armaActual === 'espada') {
        const resultado = engine.jugador.atacarEspadaArco(angulo, engine.board);
        if (resultado.celdasAfectadas.length > 0) Sonido.play('espada');
        _procesarKills(resultado.kills);
        if (resultado.celdasAfectadas.length > 0) {
            renderer.iniciarSwing(resultado.celdasAfectadas, angulo);
        }
    } else {
        const esBaston = engine.jugador.armaActual === 'baston';
        const resultado = esBaston
            ? engine.jugador.atacarBaston(engine.board, angulo)
            : engine.jugador.atacarArco(engine.board, angulo);
        _procesarKills(resultado.kills);
        if (resultado.trayectoria && resultado.trayectoria.length > 0) {
            Sonido.play(esBaston ? 'baston' : 'arco');
            const origen = { f: engine.jugador.fila, c: engine.jugador.columna };
            if (esBaston) {
                renderer.iniciarMagia(origen, resultado.trayectoria, resultado.celdasAfectadas);
            } else {
                renderer.iniciarFlecha(origen, resultado.trayectoria);
            }
        }
    }
    renderer.updateHUDOleadas(engine);
    _actualizarTienda();
}

function _stopAttackTimer() {
    mouseHeld = false;
}

function _getDescansoMs() {
    const cfg = runtimeConfig || oleadasConfig;
    const oleada = engine ? engine.oleadaActual : 0;
    const descanso = cfg.descansoBaseMs * Math.pow(1 - cfg.descansoReduccionPct, oleada);
    return Math.max(cfg.descansoMinMs, Math.floor(descanso));
}

function _programarAutoOleada() {
    if (autoOleadaTimer) return;
    if (!engine || engine.gameOver) return;

    const descansoMs = _getDescansoMs();
    const btnOleada = document.getElementById('btnIniciarOleada');
    if (btnOleada) btnOleada.style.display = 'none';

    autoOleadaTimer = setTimeout(() => {
        autoOleadaTimer = null;
        if (!engine || engine.gameOver || engine.oleadaEnCurso) return;
        _mostrarOverlayOleada(engine.oleadaActual + 1);
        setTimeout(() => {
            if (!engine || engine.gameOver) return;
            engine.iniciarOleada();
            _startLoop();
            renderer.updateHUDOleadas(engine);
        }, 1500);
    }, descansoMs);
}

function _cancelarAutoOleada() {
    if (autoOleadaTimer) {
        clearTimeout(autoOleadaTimer);
        autoOleadaTimer = null;
    }
}

function _bindInput() {
    const canvas = document.getElementById('oleadasCanvas');
    const btnVolver = document.getElementById('btnVolverOleadas');
    const btnOleada = document.getElementById('btnIniciarOleada');

    // Keydown — registrar tecla pulsada
    const keydownHandler = (e) => {
        if (engine.gameOver) return;
        const key = e.key.toLowerCase();

        if ('wasd'.includes(key) && key.length === 1) {
            e.preventDefault();
            if (!keysDown.has(key)) {
                keysDown.add(key);
                _startMoveTimer();
            }
        }

        // Atacar con espacio (8 celdas espada / dirección WASD arco)
        if (key === ' ') {
            e.preventDefault();
            if (engine.jugador.estaVivo()) {
                if (engine.jugador.armaActual === 'espada') {
                    const kills = engine.jugador.atacarEspada(engine.board);
                    if (kills.length > 0) Sonido.play('espada');
                    _procesarKills(kills);
                } else {
                    const esBaston = engine.jugador.armaActual === 'baston';
                    const resultado = esBaston
                        ? engine.jugador.atacarBaston(engine.board)
                        : engine.jugador.atacarArco(engine.board);
                    _procesarKills(resultado.kills);
                    if (resultado.trayectoria && resultado.trayectoria.length > 0) {
                        Sonido.play(esBaston ? 'baston' : 'arco');
                        const origen = { f: engine.jugador.fila, c: engine.jugador.columna };
                        if (esBaston) {
                            renderer.iniciarMagia(origen, resultado.trayectoria, resultado.celdasAfectadas);
                        } else {
                            renderer.iniciarFlecha(origen, resultado.trayectoria);
                        }
                    }
                }
                renderer.updateHUDOleadas(engine);
                _actualizarTienda();
            }
        }

        // Habilidad especial (E)
        if (key === 'e') {
            e.preventDefault();
            if (engine.jugador.estaVivo() && engine.jugador.habilidadLista()) {
                const canvas = document.getElementById('oleadasCanvas');
                const rect = canvas.getBoundingClientRect();
                const cellW = canvas.width / engine.board.columnas;
                const cellH = canvas.height / engine.board.filas;
                const jpos = renderer._getPosInterpolada(engine.jugador, cellW, cellH);
                const jugX = jpos.x + cellW / 2;
                const jugY = jpos.y + cellH / 2;
                const mouseX = (lastMousePos.x - rect.left) * (canvas.width / rect.width);
                const mouseY = (lastMousePos.y - rect.top) * (canvas.height / rect.height);
                const angulo = Math.atan2(mouseY - jugY, mouseX - jugX);

                const resultado = engine.jugador.usarHabilidad(engine.board, angulo);
                if (resultado) {
                    Sonido.play('habilidad');
                    _procesarKills(resultado.kills);
                    if (resultado.tipo === 'sismico') {
                        renderer.iniciarSwing(resultado.celdasAfectadas, angulo);
                    } else if (resultado.tipo === 'colosal') {
                        renderer.iniciarFlechaColosal(
                            { f: engine.jugador.fila, c: engine.jugador.columna },
                            resultado.trayectoriaCentro,
                            resultado.trayectoria
                        );
                    } else if (resultado.tipo === 'invocar') {
                        // Flash visual en celdas donde aparecieron aliados
                        if (resultado.invocados.length > 0) {
                            renderer.iniciarSwing(resultado.invocados, 0);
                        }
                    }
                    renderer.updateHUDOleadas(engine);
                    _actualizarTienda();
                }
            }
        }

        // Abrir cofre (F)
        if (key === 'f') {
            e.preventDefault();
            _intentarAbrirCofre();
        }

        // ESC cancela placement
        if (key === 'escape') {
            placementMode = null;
            _actualizarTienda();
        }
    };
    document.addEventListener('keydown', keydownHandler);
    listeners.push(['keydown', keydownHandler, document]);

    // Keyup — soltar tecla
    const keyupHandler = (e) => {
        const key = e.key.toLowerCase();
        keysDown.delete(key);
        // Si ya no hay teclas WASD pulsadas, parar timer
        const hayWASD = keysDown.has('w') || keysDown.has('a') || keysDown.has('s') || keysDown.has('d');
        if (!hayWASD) _stopMoveTimer();
    };
    document.addEventListener('keyup', keyupHandler);
    listeners.push(['keyup', keyupHandler, document]);

    // Limpiar teclas si la ventana pierde foco
    const blurHandler = () => { keysDown.clear(); _stopMoveTimer(); _stopAttackTimer(); };
    window.addEventListener('blur', blurHandler);
    listeners.push(['blur', blurHandler, window]);

    // Mousemove — rastrear posición del mouse (RAF loop se encarga del render)
    const mousemoveHandler = (e) => {
        lastMousePos.x = e.clientX;
        lastMousePos.y = e.clientY;
        // Si no hay RAF activo (pre-oleada), render manual para arma visual
        if (!rafId && engine && !engine.gameOver) _render();
    };
    canvas.addEventListener('mousemove', mousemoveHandler);
    listeners.push(['mousemove', mousemoveHandler, canvas]);

    // Mousedown en canvas (placement = click único, ataque = hold)
    const mousedownHandler = (e) => {
        if (e.button !== 0) return; // solo click izquierdo
        if (engine.gameOver) return;
        lastMousePos.x = e.clientX;
        lastMousePos.y = e.clientY;

        const rect = canvas.getBoundingClientRect();
        const cellW = canvas.width / engine.board.columnas;
        const cellH = canvas.height / engine.board.filas;
        const c = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / cellW);
        const f = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / cellH);

        if (f < 0 || f >= engine.board.filas || c < 0 || c >= engine.board.columnas) return;

        // Placement mode — click único
        if (placementMode) {
            const acciones = { muro: 'colocarMuro', torre: 'colocarTorre', mejoraTorre: 'mejorarTorre' };
            const metodo = acciones[placementMode];
            if (metodo && engine[metodo](f, c)) {
                Sonido.play('colocar');
                _render();
                _actualizarTienda();
                renderer.updateHUDOleadas(engine);
            }
            return;
        }

        // Ataque — iniciar hold (se procesa en el RAF loop)
        mouseHeld = true;
        _procesarAtaqueClick(canvas); // ataque inmediato al primer click
    };
    canvas.addEventListener('mousedown', mousedownHandler);
    listeners.push(['mousedown', mousedownHandler, canvas]);

    // Mouseup — soltar ataque
    const mouseupHandler = (e) => {
        if (e.button !== 0) return;
        _stopAttackTimer();
    };
    document.addEventListener('mouseup', mouseupHandler);
    listeners.push(['mouseup', mouseupHandler, document]);

    // Boton volver
    const volverHandler = () => {
        destruirOleadas();
        if (onVolverCallback) onVolverCallback();
    };
    btnVolver.addEventListener('click', volverHandler);
    listeners.push(['click', volverHandler, btnVolver]);

    // Boton iniciar oleada (solo para la primera, después es automático)
    const oleadaHandler = () => {
        if (engine.gameOver) return;
        if (engine.oleadaEnCurso) return;
        _cancelarAutoOleada();

        _mostrarOverlayOleada(engine.oleadaActual + 1);

        setTimeout(() => {
            engine.iniciarOleada();
            _startLoop();
            btnOleada.style.display = 'none';
            renderer.updateHUDOleadas(engine);
        }, 1500);
    };
    btnOleada.addEventListener('click', oleadaHandler);
    listeners.push(['click', oleadaHandler, btnOleada]);

    // Chequeo periodico fin de oleada → auto-iniciar siguiente
    const _checkOleadaFin = setInterval(() => {
        if (!engine || engine.gameOver) {
            clearInterval(_checkOleadaFin);
            return;
        }
        if (!engine.oleadaEnCurso && gameLoop) {
            Sonido.play('oleadaFin');
            _stopLoop();
            _programarAutoOleada();
        }
    }, 500);
    listeners.push(['_interval', _checkOleadaFin, null]);
}

function _unbindInput() {
    _stopMoveTimer();
    _stopAttackTimer();
    keysDown.clear();
    for (const [type, handler, target] of listeners) {
        if (type === '_interval') {
            clearInterval(handler);
        } else {
            target.removeEventListener(type, handler);
        }
    }
    listeners = [];
}

// ==================== Tienda ====================

function _construirTienda() {
    const contenido = document.getElementById('tiendaContenido');
    contenido.innerHTML = '';

    for (const item of TIENDA_ITEMS) {
        if (item.seccion) {
            const sec = document.createElement('div');
            sec.className = 'tienda-seccion';
            sec.textContent = item.seccion;
            contenido.appendChild(sec);
            continue;
        }

        const div = document.createElement('div');
        div.className = 'tienda-item';
        div.dataset.tipo = item.tipo;

        div.innerHTML = `
            <div>
                <span class="tienda-item-nombre">${item.nombre}</span>
                <span class="tienda-item-desc">${item.desc}</span>
            </div>
            <span class="tienda-item-precio"></span>
        `;

        div.addEventListener('click', () => {
            if (engine.gameOver) return;

            if (item.placement) {
                // Toggle placement mode
                if (placementMode === item.tipo) {
                    placementMode = null;
                } else {
                    placementMode = item.tipo;
                }
                _actualizarTienda();
            } else {
                // Compra directa
                if (engine.comprar(item.tipo)) {
                    Sonido.play(item.tipo === 'pocion' ? 'curar' : 'comprar');
                    _render();
                    renderer.updateHUDOleadas(engine);
                    _actualizarTienda();
                }
            }
        });

        contenido.appendChild(div);
    }
}

function _actualizarTienda() {
    if (!engine) return;
    const items = document.querySelectorAll('.tienda-item');
    for (const div of items) {
        const tipo = div.dataset.tipo;
        if (!tipo) continue;

        const precio = engine.getPrecio(tipo);
        const precioSpan = div.querySelector('.tienda-item-precio');
        precioSpan.textContent = `${precio}$`;

        const puedePagar = engine.dinero >= precio;
        div.classList.toggle('disabled', !puedePagar);
        div.classList.toggle('placement-mode', placementMode === tipo);
    }
    _actualizarBuffsUI();
}

// ==================== Overlays ====================

function _mostrarOverlayOleada(num) {
    Sonido.play('oleadaInicio');
    const container = document.getElementById('oleadasCanvasContainer');
    const overlay = document.createElement('div');
    overlay.className = 'oleada-overlay';
    overlay.textContent = `OLEADA ${num}`;
    container.style.position = 'relative';
    container.appendChild(overlay);

    setTimeout(() => {
        overlay.remove();
    }, 2000);
}

const BOSS_REWARDS = [
    {
        nombre: 'Daño x2',
        desc: 'Duplica tu daño actual',
        icono: '⚔️',
        aplicar: (jugador) => {
            jugador.danioBaseMin *= 2;
            jugador.danioBaseMax *= 2;
            jugador.danioExtra *= 2;
        }
    },
    {
        nombre: 'Vida x2',
        desc: 'Duplica tu vida máxima',
        icono: '❤️',
        aplicar: (jugador) => {
            const vidaAntes = jugador.vidaMax;
            jugador.vidaMax *= 2;
            jugador.vida += vidaAntes;
        }
    },
    {
        nombre: 'Vel. Ataque x1.4',
        desc: 'Ataca mucho más rápido',
        icono: '⚡',
        aplicar: (jugador) => {
            jugador.cooldownAtaqueMs = Math.floor(jugador.cooldownAtaqueMs / 1.4);
        }
    },
];

function _mostrarRecompensaBoss() {
    const overlay = document.createElement('div');
    overlay.className = 'boss-reward-overlay';

    const titulo = document.createElement('div');
    titulo.className = 'boss-reward-titulo';
    titulo.textContent = 'JEFE DERROTADO';
    overlay.appendChild(titulo);

    const subtitulo = document.createElement('div');
    subtitulo.className = 'boss-reward-subtitulo';
    subtitulo.textContent = 'Elige una recompensa';
    overlay.appendChild(subtitulo);

    const opciones = document.createElement('div');
    opciones.className = 'boss-reward-opciones';

    for (const reward of BOSS_REWARDS) {
        const card = document.createElement('div');
        card.className = 'boss-reward-card';
        card.innerHTML = `
            <div class="boss-reward-icono">${reward.icono}</div>
            <div class="boss-reward-nombre">${reward.nombre}</div>
            <div class="boss-reward-desc">${reward.desc}</div>
        `;
        card.addEventListener('click', () => {
            Sonido.play('recompensa');
            reward.aplicar(engine.jugador);
            overlay.remove();
            renderer.updateHUDOleadas(engine);
            _actualizarTienda();
            _startLoop();
        });
        opciones.appendChild(card);
    }

    overlay.appendChild(opciones);
    document.body.appendChild(overlay);
}

// ==================== Cofres / Gacha ====================

function _intentarAbrirCofre() {
    if (!engine || engine.gameOver || !engine.jugador.estaVivo()) return;

    const jf = engine.jugador.fila;
    const jc = engine.jugador.columna;
    let mejorCofre = null;
    let mejorDist = Infinity;
    let mejorF = 0, mejorC = 0;

    for (let df = -1; df <= 1; df++) {
        for (let dc = -1; dc <= 1; dc++) {
            const f = jf + df;
            const c = jc + dc;
            if (f < 0 || f >= engine.board.filas || c < 0 || c >= engine.board.columnas) continue;
            const obj = engine.board.getObjeto(f, c);
            if (obj instanceof Cofre) {
                const dist = Math.max(Math.abs(df), Math.abs(dc));
                if (dist < mejorDist) {
                    mejorDist = dist;
                    mejorCofre = obj;
                    mejorF = f;
                    mejorC = c;
                }
            }
        }
    }

    if (!mejorCofre) return;
    if (engine.dinero < mejorCofre.costoAbrir) return;

    // Descontar oro y eliminar cofre
    engine.dinero -= mejorCofre.costoAbrir;
    engine.jugador.dinero = engine.dinero;
    engine.board.setObjeto(mejorF, mejorC, null);

    _stopLoop();
    _mostrarGachaCofre();
}

function _seleccionarTier(config) {
    const tiers = config.cofreTiers;
    const pesoTotal = tiers.reduce((s, t) => s + t.peso, 0);
    let r = Math.random() * pesoTotal;
    for (const tier of tiers) {
        r -= tier.peso;
        if (r <= 0) return tier;
    }
    return tiers[0];
}

const BUFF_INFO = {
    roboVida:       { nombre: 'Robo de Vida',    icono: '❤️' },
    gananciaOro:    { nombre: 'Ganancia de Oro',  icono: '🪙' },
    velocidadExtra: { nombre: 'Velocidad',        icono: '🐌' },
};

function _mostrarGachaCofre() {
    const cfg = runtimeConfig || oleadasConfig;

    // Pre-determinar resultado
    const tipos = Object.keys(cfg.cofreValoresBase);
    const tipoGanador = tipos[Math.floor(Math.random() * tipos.length)];
    const tierGanador = _seleccionarTier(cfg);
    const valorBase = cfg.cofreValoresBase[tipoGanador];
    const valorFinal = +(valorBase * tierGanador.mult).toFixed(4);

    // Generar strip de items
    const NUM_ITEMS = 40;
    const POS_GANADOR = 35;
    const items = [];
    for (let i = 0; i < NUM_ITEMS; i++) {
        if (i === POS_GANADOR) {
            items.push({ tipo: tipoGanador, tier: tierGanador });
        } else {
            const t = tipos[Math.floor(Math.random() * tipos.length)];
            const tier = _seleccionarTier(cfg);
            items.push({ tipo: t, tier });
        }
    }

    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'cofre-gacha-overlay';

    const titulo = document.createElement('div');
    titulo.className = 'boss-reward-titulo';
    titulo.textContent = 'COFRE ENCONTRADO';
    titulo.style.marginBottom = '16px';
    overlay.appendChild(titulo);

    // Marcador central (triángulo)
    const marcador = document.createElement('div');
    marcador.className = 'gacha-marcador';
    overlay.appendChild(marcador);

    // Viewport
    const viewport = document.createElement('div');
    viewport.className = 'gacha-viewport';

    const strip = document.createElement('div');
    strip.className = 'gacha-strip';

    const ITEM_W = 90;
    const ITEM_GAP = 6;
    const ITEM_TOTAL = ITEM_W + ITEM_GAP;

    for (const item of items) {
        const div = document.createElement('div');
        div.className = 'gacha-item';
        div.style.borderColor = item.tier.color;
        div.style.minWidth = ITEM_W + 'px';
        div.style.maxWidth = ITEM_W + 'px';
        const info = BUFF_INFO[item.tipo];
        div.innerHTML = `<div class="gacha-item-icono">${info.icono}</div>
            <div class="gacha-item-nombre" style="color:${item.tier.color}">${item.tier.id.toUpperCase()}</div>`;
        strip.appendChild(div);
    }

    viewport.appendChild(strip);
    overlay.appendChild(viewport);

    // Panel resultado (oculto inicialmente)
    const resultado = document.createElement('div');
    resultado.className = 'gacha-resultado';
    resultado.style.display = 'none';
    overlay.appendChild(resultado);

    // Botón skip
    const btnSkip = document.createElement('button');
    btnSkip.className = 'gameover-btn gacha-btn-skip';
    btnSkip.textContent = 'SKIP';
    overlay.appendChild(btnSkip);

    document.body.appendChild(overlay);

    // Animación
    const viewportW = 500;
    const targetOffset = POS_GANADOR * ITEM_TOTAL - viewportW / 2 + ITEM_W / 2;
    const duracion = 4000;
    const inicio = performance.now();
    let skipped = false;

    function _mostrarResultado() {
        btnSkip.style.display = 'none';
        strip.style.transform = `translateX(-${targetOffset}px)`;
        const info = BUFF_INFO[tipoGanador];
        const pct = Math.round(valorFinal * 100);
        resultado.innerHTML = `
            <div class="gacha-resultado-icono">${info.icono}</div>
            <div class="gacha-resultado-nombre" style="color:${tierGanador.color}">${tierGanador.id.toUpperCase()}</div>
            <div class="gacha-resultado-desc">${info.nombre}: +${pct}%</div>
            <button class="gameover-btn gacha-btn-recoger">RECOGER</button>
        `;
        resultado.style.display = '';
        resultado.querySelector('.gacha-btn-recoger').addEventListener('click', () => {
            engine.jugador.buffs[tipoGanador] += valorFinal;
            engine.jugador.buffsHistorial.push({
                tipo: tipoGanador,
                rareza: tierGanador.id,
                valor: valorFinal,
                color: tierGanador.color,
            });
            overlay.remove();
            _actualizarBuffsUI();
            renderer.updateHUDOleadas(engine);
            _actualizarTienda();
            _startLoop();
        });
    }

    btnSkip.addEventListener('click', () => {
        skipped = true;
        _mostrarResultado();
    });

    function animar(now) {
        if (skipped) return;
        const elapsed = now - inicio;
        const t = Math.min(elapsed / duracion, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        const offset = eased * targetOffset;
        strip.style.transform = `translateX(-${offset}px)`;

        if (t < 1) {
            requestAnimationFrame(animar);
        } else {
            _mostrarResultado();
        }
    }
    requestAnimationFrame(animar);
}

// ==================== Buffs UI ====================

// Color del buff según valor total acumulado
function _getBuffColor(valor) {
    // Umbrales basados en los valores base * multiplicadores de rareza acumulados
    if (valor >= 0.40) return '#eab308'; // legendario (dorado)
    if (valor >= 0.20) return '#a855f7'; // épico (morado)
    if (valor >= 0.08) return '#3b82f6'; // raro (azul)
    return '#9ca3af';                     // normal (gris)
}

function _actualizarBuffsUI() {
    const container = document.getElementById('buffsActivos');
    if (!container || !engine) return;

    const buffs = engine.jugador.buffs;
    const tieneAlguno = buffs.roboVida > 0 || buffs.gananciaOro > 0 || buffs.velocidadExtra > 0;
    if (!tieneAlguno) {
        container.style.display = 'none';
        return;
    }

    container.style.display = '';
    container.innerHTML = '<div class="tienda-seccion" style="margin-top:8px;">BUFFS ACTIVOS</div>';

    for (const [key, valor] of Object.entries(buffs)) {
        if (valor <= 0) continue;
        const info = BUFF_INFO[key];
        const color = _getBuffColor(valor);
        const pct = Math.round(valor * 100);
        const div = document.createElement('div');
        div.className = 'buff-item';
        div.style.borderColor = color;
        div.innerHTML = `<span>${info.icono} ${info.nombre}</span><span style="color:${color}">+${pct}%</span>`;
        container.appendChild(div);
    }
}

function _mostrarGameOver() {
    Sonido.play('gameOver');
    const overlay = document.createElement('div');
    overlay.className = 'gameover-overlay';

    const j = engine.jugador;
    overlay.innerHTML = `
        <div class="gameover-titulo">GAME OVER</div>
        <div class="gameover-stats">
            <div class="gameover-linea"><strong>Oleada alcanzada:</strong> ${engine.oleadaActual}</div>
            <div class="gameover-linea"><strong>Turnos sobrevividos:</strong> ${engine.turno}</div>
            <div class="gameover-linea"><strong>Kills totales:</strong> ${engine.totalKills}</div>
            <div class="gameover-linea"><strong>Da\u00F1o infligido:</strong> ${j.danioInfligido}</div>
            <div class="gameover-linea"><strong>Dinero total ganado:</strong> ${engine.totalKills * (runtimeConfig || oleadasConfig).recompensaEnemigo}$</div>
            <div class="gameover-linea"><strong>Torres construidas:</strong> ${engine.compras['torre'] || 0}</div>
            <div class="gameover-linea"><strong>Muros construidos:</strong> ${engine.compras['muro'] || 0}</div>
        </div>
        <button class="gameover-btn" id="btnGameOverVolver">VOLVER AL MEN\u00DA</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btnGameOverVolver').addEventListener('click', () => {
        overlay.remove();
        destruirOleadas();
        if (onVolverCallback) onVolverCallback();
    });
}
