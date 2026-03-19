// demoFondo.js — Partida de fondo animada para el menú principal

import { GameEngine, avanzarEntidades } from './engine.js';
import { Renderer, spritesListos } from './renderer.js';

const CELL_SIZE = 32;

// Config especial para la demo: muchas unidades variadas, modo libre, mapa arena
const DEMO_CONFIG = {
    semilla: 42,
    velocidadMs: 150,
    filas: 16,
    columnas: 28,
    tipoMapa: 'arena',
    numMuro: 40,
    probPegarMuro: 70,

    numAliado: 6,
    vidaAliado: 200,
    danioBaseAliadoMin: 10,
    danioBaseAliadoMax: 25,
    visionAliado: 6,

    numGuerrero: 2,
    vidaGuerrero: 400,
    danioGuerreroMin: 20,
    danioGuerreroMax: 40,
    visionGuerrero: 8,

    numArquero: 2,
    vidaArquero: 180,
    danioArqueroMin: 12,
    danioArqueroMax: 20,
    visionArquero: 10,
    rangoArquero: 5,

    numEnemigo: 6,
    vidaEnemigo: 200,
    danioEnemigoMin: 15,
    danioEnemigoMax: 35,
    visionEnemigo: 6,

    numEnemigoTanque: 1,
    vidaTanque: 2000,
    danioTanqueMin: 60,
    danioTanqueMax: 120,
    visionTanque: 10,

    numEnemigoRapido: 2,
    vidaRapido: 150,
    danioRapidoMin: 30,
    danioRapidoMax: 50,
    visionRapido: 10,

    numEnemigoMago: 1,
    vidaMago: 120,
    danioMagoMin: 15,
    danioMagoMax: 30,
    visionMago: 8,
    rangoMago: 5,

    numTrampa: 8,
    danioTrampa: 40,

    turnosSpawnObjeto: 5,
    numEscudo: 3,
    numArma: 2,
    numEstrella: 1,
    numVelocidad: 2,
    numPocion: 3,
    valorEscudo: 50,
    valorArma: 20,
    turnosEstrella: 30,
    duracionVelocidad: 30,
    curacionPocion: 50,

    modoLibre: true,
};

let container = null;
let canvas = null;
let renderer = null;
let engine = null;
let tickInterval = null;
let rafId = null;
let activo = false;
let semillaActual = 42;

function _ensureDOM() {
    if (container) return;
    container = document.createElement('div');
    container.id = 'demoFondoContainer';
    canvas = document.createElement('canvas');
    canvas.id = 'demoFondoCanvas';
    container.appendChild(canvas);
    // Insertar al principio del body, detrás de todo
    document.body.prepend(container);
}

function _iniciarPartida() {
    // Cambiar semilla para que cada vez sea una partida diferente
    semillaActual = Math.floor(Math.random() * 100000);
    const cfg = { ...DEMO_CONFIG, semilla: semillaActual };

    engine = new GameEngine(cfg);
    engine.inicializar();

    canvas.width = cfg.columnas * CELL_SIZE;
    canvas.height = cfg.filas * CELL_SIZE;

    if (!renderer) {
        // Renderer sin HUD ni stats (pasamos divs nulos)
        renderer = new Renderer(canvas, null, null);
    }
}

function _tick() {
    if (!engine || !activo) return;
    engine.tick();

    // Si se acabó la partida (todos de un bando muertos), reiniciar
    if (engine.haTerminado() || engine.board.entidadesActivas.length < 3) {
        _iniciarPartida();
    }
}

let _lastRafTime = 0;

function _render(now) {
    if (!activo || !engine || !renderer) return;
    if (!now) now = performance.now();
    const dt = Math.min((now - _lastRafTime) / 1000, 0.05);
    _lastRafTime = now;
    if (engine.board) avanzarEntidades(dt, engine.board);
    renderer.drawBoard(engine.board, engine.turno);
    rafId = requestAnimationFrame(_render);
}

export async function iniciar() {
    if (activo) return;
    _ensureDOM();
    await spritesListos;

    _iniciarPartida();
    activo = true;

    // Tick de la simulación
    tickInterval = setInterval(_tick, DEMO_CONFIG.velocidadMs);

    // Render loop
    _lastRafTime = performance.now();
    rafId = requestAnimationFrame(_render);
}

export function detener() {
    activo = false;
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

export function mostrar() {
    if (container) container.style.display = '';
    document.body.classList.add('demo-activo');
}

export function ocultar() {
    if (container) container.style.display = 'none';
    document.body.classList.remove('demo-activo');
}
