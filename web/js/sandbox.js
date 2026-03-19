import config from './config.js';
import { GameEngine, avanzarEntidades } from './engine.js';
import { Renderer, spritesListos } from './renderer.js';
import { Aliado, Enemigo, EnemigoTanque, EnemigoRapido, EnemigoMago, Muro, AliadoGuerrero, AliadoArquero, esAliado, esEnemigo } from './entidad.js';
import { Escudo, Arma, Estrella, Velocidad, Pocion, Trampa } from './objetos.js';

let canvas, canvasContainer, hudDiv, statsDiv;
let btnIniciar, btnPausa, btnFinalizar;
let btnZoomIn, btnZoomOut, btnZoomFit, zoomLevelSpan;

const engine = new GameEngine(config);
let renderer = null;
let intervalId = null;
let rafId = null;
let pausado = false;
let enSetup = true;
let zoomScale = 1;

const CLAVES_GENERACION = new Set([
    'semilla', 'filas', 'columnas', 'tipoMapa', 'numMuro', 'probPegarMuro',
    'numAliado', 'vidaAliado', 'danioBaseAliadoMin', 'danioBaseAliadoMax', 'visionAliado',
    'numEnemigo', 'vidaEnemigo', 'danioEnemigoMin', 'danioEnemigoMax', 'visionEnemigo',
    'numEnemigoTanque', 'vidaTanque', 'danioTanqueMin', 'danioTanqueMax', 'visionTanque',
    'numEnemigoRapido', 'vidaRapido', 'danioRapidoMin', 'danioRapidoMax', 'visionRapido',
    'numEnemigoMago', 'vidaMago', 'danioMagoMin', 'danioMagoMax', 'visionMago', 'rangoMago',
    'numGuerrero', 'vidaGuerrero', 'danioGuerreroMin', 'danioGuerreroMax', 'visionGuerrero',
    'numArquero', 'vidaArquero', 'danioArqueroMin', 'danioArqueroMax', 'visionArquero', 'rangoArquero',
    'numTrampa', 'danioTrampa',
    'numEscudo', 'numArma', 'numEstrella', 'numVelocidad', 'numPocion',
    'valorEscudo', 'valorArma', 'turnosEstrella', 'duracionVelocidad', 'curacionPocion',
]);

const CELL_SIZE = 32;

// ==================== Panel de ajustes ====================

function syncPanelToConfig() {
    document.querySelectorAll('#panel [data-key]').forEach(el => {
        if (el.type === 'checkbox') {
            el.checked = config[el.dataset.key];
        } else {
            el.value = config[el.dataset.key];
        }
    });
}

function onPanelChange(e) {
    const el = e.target;
    const key = el.dataset.key;
    if (!key) return;
    if (el.type === 'checkbox') {
        config[key] = el.checked;
    } else {
        config[key] = el.tagName === 'SELECT' ? el.value : Number(el.value);
    }

    if (key === 'velocidadMs' && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = setInterval(tickLoop, config.velocidadMs);
    }

    if (key === 'tipoMapa' && config.tipoMapa === 'vacio') {
        const clavesACero = [
            'numAliado', 'numEnemigo', 'numEnemigoTanque', 'numEnemigoRapido', 'numEnemigoMago',
            'numGuerrero', 'numArquero',
            'numMuro', 'numTrampa',
            'numEscudo', 'numArma', 'numEstrella', 'numVelocidad', 'numPocion',
            'turnosSpawnObjeto',
        ];
        for (const k of clavesACero) {
            config[k] = 0;
        }
        config.modoLibre = true;
        syncPanelToConfig();
    }

    if (enSetup && CLAVES_GENERACION.has(key)) {
        generarPartida();
    }
}

// ==================== Canvas y Zoom ====================

function resizeCanvas() {
    canvas.width = config.columnas * CELL_SIZE;
    canvas.height = config.filas * CELL_SIZE;
    // Defer fit until layout has settled
    requestAnimationFrame(() => resetZoom());
}

function resetZoom() {
    // Ajustar el canvas al contenedor disponible
    const containerW = canvasContainer.clientWidth;
    const containerH = canvasContainer.clientHeight || window.innerHeight * 0.75;
    const scaleW = containerW / canvas.width;
    const scaleH = containerH / canvas.height;
    zoomScale = Math.min(scaleW, scaleH);
    if (zoomScale < 0.1 || !isFinite(zoomScale)) zoomScale = 1; // fallback
    applyZoom();
    canvasContainer.scrollLeft = 0;
    canvasContainer.scrollTop = 0;
}

function applyZoom() {
    canvas.style.width = (canvas.width * zoomScale) + 'px';
    canvas.style.height = (canvas.height * zoomScale) + 'px';
    zoomLevelSpan.textContent = Math.round(zoomScale * 100) + '%';
}

function setZoom(newScale, pivotX, pivotY) {
    const oldScale = zoomScale;
    zoomScale = Math.max(0.2, Math.min(10, newScale));
    applyZoom();

    if (pivotX !== undefined && pivotY !== undefined) {
        const canvasX = (canvasContainer.scrollLeft + pivotX) / oldScale;
        const canvasY = (canvasContainer.scrollTop + pivotY) / oldScale;
        canvasContainer.scrollLeft = canvasX * zoomScale - pivotX;
        canvasContainer.scrollTop = canvasY * zoomScale - pivotY;
    }
}

// ==================== Generar partida ====================

function generarPartida() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
    _stopRaf();

    resizeCanvas();
    engine.config = config;
    engine.resultado = null;
    engine.inicializar();

    if (!renderer) {
        renderer = new Renderer(canvas, hudDiv, statsDiv);
    }
    renderer.drawBoard(engine.board, engine.turno);
    renderer.updateHUD(engine);

    statsDiv.style.display = 'none';
    btnIniciar.textContent = 'INICIAR PARTIDA';
    btnIniciar.style.display = '';
    btnPausa.style.display = 'none';
    btnFinalizar.style.display = 'none';
    pausado = false;
    enSetup = true;
}

// ==================== Toolbox ====================

let toolSeleccionada = null;

function getCelda(e) {
    const rect = canvas.getBoundingClientRect();
    const cellVisualW = rect.width / config.columnas;
    const cellVisualH = rect.height / config.filas;
    const c = Math.floor((e.clientX - rect.left) / cellVisualW);
    const f = Math.floor((e.clientY - rect.top) / cellVisualH);
    if (f < 0 || f >= config.filas || c < 0 || c >= config.columnas) return null;
    return { f, c };
}

function colocarEnCelda(f, c) {
    const board = engine.board;

    if (toolSeleccionada === 'borrar') {
        board.setEntidad(f, c, null);
        board.setObjeto(f, c, null);
        board.setTrampa(f, c, null);
    } else if (toolSeleccionada === 'trampa') {
        board.setTrampa(f, c, new Trampa(f, c, config.danioTrampa));
    } else if (toolSeleccionada === 'escudo') {
        board.setEntidad(f, c, null);
        board.setObjeto(f, c, new Escudo(f, c, config.valorEscudo));
    } else if (toolSeleccionada === 'arma') {
        board.setEntidad(f, c, null);
        board.setObjeto(f, c, new Arma(f, c, config.valorArma));
    } else if (toolSeleccionada === 'estrella') {
        board.setEntidad(f, c, null);
        board.setObjeto(f, c, new Estrella(f, c, config.turnosEstrella));
    } else if (toolSeleccionada === 'velocidad') {
        board.setEntidad(f, c, null);
        board.setObjeto(f, c, new Velocidad(f, c, config.duracionVelocidad));
    } else if (toolSeleccionada === 'pocion') {
        board.setEntidad(f, c, null);
        board.setObjeto(f, c, new Pocion(f, c, config.curacionPocion));
    } else {
        board.setObjeto(f, c, null);
        board.setEntidad(f, c, null);

        let entidad;
        switch (toolSeleccionada) {
            case 'aliado':
                entidad = new Aliado(f, c, config.vidaAliado, config.danioBaseAliadoMin, config.danioBaseAliadoMax, config.visionAliado);
                break;
            case 'enemigo':
                entidad = new Enemigo(f, c, config.vidaEnemigo, config.danioEnemigoMin, config.danioEnemigoMax, config.visionEnemigo);
                break;
            case 'tanque':
                entidad = new EnemigoTanque(f, c, config.vidaTanque, config.danioTanqueMin, config.danioTanqueMax, config.visionTanque);
                break;
            case 'rapido':
                entidad = new EnemigoRapido(f, c, config.vidaRapido, config.danioRapidoMin, config.danioRapidoMax, config.visionRapido);
                break;
            case 'mago':
                entidad = new EnemigoMago(f, c, config.vidaMago, config.danioMagoMin, config.danioMagoMax, config.visionMago, config.rangoMago);
                break;
            case 'muro':
                entidad = new Muro(f, c);
                break;
            case 'guerrero':
                entidad = new AliadoGuerrero(f, c, config.vidaGuerrero, config.danioGuerreroMin, config.danioGuerreroMax, config.visionGuerrero);
                break;
            case 'arquero':
                entidad = new AliadoArquero(f, c, config.vidaArquero, config.danioArqueroMin, config.danioArqueroMax, config.visionArquero, config.rangoArquero);
                break;
        }
        if (entidad) {
            board.setEntidad(f, c, entidad);
            board.addEntidadActiva(entidad);
        }
    }

    renderer.drawBoard(board, engine.turno);
}

// ==================== Simulacion ====================

function iniciarSimulacion() {
    enSetup = false;
    btnIniciar.style.display = 'none';
    statsDiv.style.display = 'none';
    btnPausa.style.display = '';
    btnFinalizar.style.display = '';
    btnPausa.textContent = 'PAUSAR';
    pausado = false;

    engine.todasEntidades = engine.board.entidadesActivas.slice();
    engine.numAliadosInicial = engine.todasEntidades.filter(e => esAliado(e.tipo)).length;
    engine.numEnemigosInicial = engine.todasEntidades.filter(e => esEnemigo(e.tipo)).length;
    engine.tiempoInicio = Date.now();

    intervalId = setInterval(tickLoop, config.velocidadMs);
    _startRaf();
}

let _lastRafTime = 0;

function _startRaf() {
    if (rafId) return;
    _lastRafTime = performance.now();
    const loop = (now) => {
        const dt = Math.min((now - _lastRafTime) / 1000, 0.05);
        _lastRafTime = now;
        if (!pausado && engine.board) {
            avanzarEntidades(dt, engine.board);
        }
        renderer.drawBoard(engine.board, engine.turno);
        rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
}

function _stopRaf() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

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

function tickLoop() {
    if (pausado) return;
    engine.tick();

    // Actualizar lista de entidades con las vivas actuales
    engine.todasEntidades = engine.board.entidadesActivas.slice();

    _procesarAnimaciones(engine.board, renderer);

    renderer.updateHUD(engine);
    if (engine.haTerminado()) {
        finalizarPartida();
    }
}

function finalizarPartida() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
    _stopRaf();

    if (config.modoLibre && !engine.resultado) {
        let killsAliados = 0;
        let killsEnemigos = 0;
        for (const e of engine.todasEntidades) {
            if (esAliado(e.tipo)) killsAliados += e.kills;
            else if (esEnemigo(e.tipo)) killsEnemigos += e.kills;
        }
        if (killsAliados > killsEnemigos) {
            engine.resultado = "aliados";
        } else if (killsEnemigos > killsAliados) {
            engine.resultado = "enemigos";
        } else {
            engine.resultado = "empate";
        }
    }

    btnPausa.style.display = 'none';
    btnFinalizar.style.display = 'none';
    renderer.mostrarEstadisticas(engine);
    btnIniciar.textContent = 'NUEVA PARTIDA';
    btnIniciar.style.display = '';
}

// ==================== Event handlers almacenados para cleanup ====================

let _handlers = {};

function _onZoomIn() {
    const cx = canvasContainer.clientWidth / 2;
    const cy = canvasContainer.clientHeight / 2;
    setZoom(zoomScale * 1.25, cx, cy);
}

function _onZoomOut() {
    const cx = canvasContainer.clientWidth / 2;
    const cy = canvasContainer.clientHeight / 2;
    setZoom(zoomScale / 1.25, cx, cy);
}

let panning = false;
let panStartX = 0, panStartY = 0, panScrollX = 0, panScrollY = 0;
let pintando = false;
let ultimaCelda = null;
let _sandboxIniciado = false;

function _onWheel(e) {
    e.preventDefault();
    const rect = canvasContainer.getBoundingClientRect();
    const pivotX = e.clientX - rect.left;
    const pivotY = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.85 : 1.15;
    setZoom(zoomScale * factor, pivotX, pivotY);
}

function _onContainerMousedown(e) {
    if (e.button === 1 || (e.button === 2 && !toolSeleccionada)) {
        e.preventDefault();
        panning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollX = canvasContainer.scrollLeft;
        panScrollY = canvasContainer.scrollTop;
        canvasContainer.style.cursor = 'grabbing';
    }
}

function _onWindowMousemove(e) {
    if (panning) {
        canvasContainer.scrollLeft = panScrollX - (e.clientX - panStartX);
        canvasContainer.scrollTop = panScrollY - (e.clientY - panStartY);
    }
}

function _onWindowMouseup() {
    if (panning) {
        panning = false;
        canvasContainer.style.cursor = '';
    }
    pintando = false;
    ultimaCelda = null;
}

function _onContextmenu(e) {
    if (!toolSeleccionada) e.preventDefault();
}

function _onCanvasMousedown(e) {
    if (!toolSeleccionada || !engine.board) return;
    pintando = true;
    const celda = getCelda(e);
    if (celda) {
        ultimaCelda = `${celda.f},${celda.c}`;
        colocarEnCelda(celda.f, celda.c);
    }
}

function _onCanvasMousemove(e) {
    if (!pintando || !toolSeleccionada || !engine.board) return;
    const celda = getCelda(e);
    if (!celda) return;
    const clave = `${celda.f},${celda.c}`;
    if (clave === ultimaCelda) return;
    ultimaCelda = clave;
    colocarEnCelda(celda.f, celda.c);
}

// ==================== Iniciar / Destruir Sandbox ====================

export function iniciarSandbox(onVolver) {
    document.getElementById('layout').style.display = 'flex';

    canvas = document.getElementById('gameCanvas');
    canvasContainer = document.getElementById('canvasContainer');
    hudDiv = document.getElementById('hud');
    statsDiv = document.getElementById('stats');
    btnIniciar = document.getElementById('btnIniciar');
    btnPausa = document.getElementById('btnPausa');
    btnFinalizar = document.getElementById('btnFinalizar');
    btnZoomIn = document.getElementById('btnZoomIn');
    btnZoomOut = document.getElementById('btnZoomOut');
    btnZoomFit = document.getElementById('btnZoomFit');
    zoomLevelSpan = document.getElementById('zoomLevel');

    syncPanelToConfig();

    // Solo registrar event listeners la primera vez
    if (!_sandboxIniciado) {
        _sandboxIniciado = true;

        const panel = document.getElementById('panel');

        // Panel listeners
        _handlers.panelInput = onPanelChange;
        _handlers.panelChange = onPanelChange;
        panel.addEventListener('input', _handlers.panelInput);
        panel.addEventListener('change', _handlers.panelChange);

        // Zoom
        btnZoomIn.addEventListener('click', _onZoomIn);
        btnZoomOut.addEventListener('click', _onZoomOut);
        btnZoomFit.addEventListener('click', resetZoom);
        canvasContainer.addEventListener('wheel', _onWheel, { passive: false });

        // Pan
        canvasContainer.addEventListener('mousedown', _onContainerMousedown);
        canvasContainer.addEventListener('contextmenu', _onContextmenu);

        // Toolbox
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (toolSeleccionada === tool) {
                    toolSeleccionada = null;
                    btn.classList.remove('active');
                } else {
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    toolSeleccionada = tool;
                    btn.classList.add('active');
                }
                canvas.style.cursor = toolSeleccionada ? 'crosshair' : '';
            });
        });

        // Canvas paint
        canvas.addEventListener('mousedown', _onCanvasMousedown);
        canvas.addEventListener('mousemove', _onCanvasMousemove);

        // Botones
        btnIniciar.addEventListener('click', () => {
            if (enSetup) {
                iniciarSimulacion();
            } else {
                generarPartida();
            }
        });

        btnFinalizar.addEventListener('click', () => {
            finalizarPartida();
        });

        btnPausa.addEventListener('click', () => {
            pausado = !pausado;
            btnPausa.textContent = pausado ? 'REANUDAR' : 'PAUSAR';
        });

        // Boton volver
        const btnVolver = document.getElementById('btnVolverSandbox');
        if (btnVolver) {
            btnVolver.addEventListener('click', () => {
                destruirSandbox();
                onVolver();
            });
        }
    }

    // Re-registrar listeners globales (se eliminan en destruirSandbox)
    window.addEventListener('mousemove', _onWindowMousemove);
    window.addEventListener('mouseup', _onWindowMouseup);

    // Generar partida al cargar sprites
    spritesListos.then(() => generarPartida());
}

export function destruirSandbox() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
    _stopRaf();

    // Limpiar event listeners globales
    window.removeEventListener('mousemove', _onWindowMousemove);
    window.removeEventListener('mouseup', _onWindowMouseup);

    document.getElementById('layout').style.display = 'none';
    toolSeleccionada = null;
    pausado = false;
    enSetup = true;
    renderer = null;
}
