import { OleadasEngine } from './oleadasEngine.js';
import { Renderer, spritesListos } from './renderer.js';
import oleadasConfig from './oleadasConfig.js';

let engine = null;
let renderer = null;
let gameLoop = null;
let rafId = null;
let onVolverCallback = null;
let placementMode = null; // 'muro' | 'torre' | 'mejoraTorre' | null
let pausado = false;
let listeners = []; // para limpiar al destruir

// ==================== Tienda items ====================

const TIENDA_ITEMS = [
    { seccion: 'MEJORAS JUGADOR' },
    { tipo: 'mejoraVida', nombre: 'Vida +50', desc: 'Aumenta vida m\u00E1xima' },
    { tipo: 'mejoraDanio', nombre: 'Da\u00F1o +10', desc: 'Aumenta da\u00F1o base' },
    { tipo: 'mejoraVelAtaque', nombre: 'Vel. Ataque', desc: 'Reduce cooldown' },
    { seccion: 'OBJETOS' },
    { tipo: 'pocion', nombre: 'Poci\u00F3n', desc: `Cura ${oleadasConfig.curacionPocion} HP` },
    { tipo: 'escudo', nombre: 'Escudo +50', desc: 'Absorbe da\u00F1o' },
    { tipo: 'estrella', nombre: 'Estrella', desc: `Invencible ${oleadasConfig.turnosEstrella}t` },
    { seccion: 'DEFENSAS' },
    { tipo: 'muro', nombre: 'Muro', desc: `${oleadasConfig.vidaMuro} HP \u2014 click para colocar`, placement: true },
    { tipo: 'torre', nombre: 'Torre', desc: 'Ataca enemigos \u2014 click para colocar', placement: true },
    { tipo: 'mejoraTorre', nombre: 'Mejorar Torre', desc: 'Click en torre existente', placement: true },
];

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
    document.getElementById('oleadasGameArea').style.display = 'flex';

    const canvas = document.getElementById('oleadasCanvas');
    const hudDiv = document.getElementById('hudOleadas');

    // Tamanio canvas — llenar todo el contenedor
    const { filas, columnas } = oleadasConfig;
    const container = document.getElementById('oleadasCanvasContainer');
    const ancho = container.clientWidth;
    const cellSize = ancho / columnas;
    canvas.width = ancho;
    canvas.height = Math.round(cellSize * filas);

    renderer = new Renderer(canvas, hudDiv, null);

    engine = new OleadasEngine();
    // Pasamos la clase seleccionada
    engine.inicializar(idClase);

    placementMode = null;
    pausado = false;

    _construirTienda();
    _bindInput();
    _actualizarTienda();

    spritesListos.then(() => {
        _startRaf();
        _startLoop();
        renderer.updateHUDOleadas(engine);
    });
}

function _construirMenuClases() {
    const container = document.querySelector('.clases-container');
    container.innerHTML = '';
    
    const clases = oleadasConfig.clases;
    for (const [id, config] of Object.entries(clases)) {
        const card = document.createElement('div');
        card.className = 'clase-card';
        card.innerHTML = `
            <div class="clase-titulo">${config.nombre}</div>
            <div class="clase-desc">${config.desc}</div>
            <dl class="clase-stats">
                <dt>Vida Máx</dt><dd>${config.vida}</dd>
                <dt>Daño</dt><dd>${config.danio}</dd>
                <dt>Arma</dt><dd>${config.arma.toUpperCase()}</dd>
            </dl>
        `;
        card.onclick = () => {
            _iniciarPartidaReal(id);
        };
        container.appendChild(card);
    }
}

export function destruirOleadas() {
    _stopLoop();
    _stopRaf();
    _unbindInput();
    placementMode = null;

    // Reset botones
    const btnOleada = document.getElementById('btnIniciarOleada');
    const btnPausa = document.getElementById('btnPausaOleadas');
    if (btnOleada) btnOleada.style.display = '';
    if (btnPausa) { btnPausa.style.display = 'none'; btnPausa.textContent = 'PAUSAR'; }

    const layout = document.getElementById('layoutOleadas');
    layout.style.display = 'none';

    engine = null;
    renderer = null;
}

// ==================== Game Loop ====================

function _startLoop() {
    if (gameLoop) return;
    gameLoop = setInterval(() => {
        if (pausado) return;

        engine.jugador.actuar(engine.board);
        engine.tick();
        renderer.updateHUDOleadas(engine);
        _actualizarTienda();

        if (engine.gameOver) {
            _stopLoop();
            _stopRaf();
            _mostrarGameOver();
        }

        // Auto-iniciar siguiente oleada si terminaron todos los enemigos
        if (!engine.oleadaEnCurso && !engine.gameOver) {
            // Pausa inter-oleada: no auto-start, el jugador decide
        }
    }, oleadasConfig.velocidadMs);
}

function _stopLoop() {
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
    // RAF sigue activo para render visual (arma, placement, etc.)
    // Se para en destruirOleadas o gameOver
}

function _startRaf() {
    if (rafId) return;
    function loop() {
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

const ATTACK_INTERVAL = 150; // ms entre ataques al mantener click
const keysDown = new Set();
let moveTimer = null;
let attackTimer = null;
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

    // Recoger objeto tras moverse
    const obj = engine.board.getObjeto(engine.jugador.fila, engine.jugador.columna);
    if (obj !== null) {
        obj.aplicar(engine.jugador);
        engine.board.setObjeto(engine.jugador.fila, engine.jugador.columna, null);
    }
    renderer.updateHUDOleadas(engine);
}

function _loopMovimiento() {
    if (!keysDown.has('w') && !keysDown.has('s') && !keysDown.has('a') && !keysDown.has('d')) {
        moveTimer = null;
        return;
    }
    _procesarMovimiento();
    const delay = engine && engine.jugador ? (engine.jugador.velocidadMoverMs || 100) : 100;
    moveTimer = setTimeout(_loopMovimiento, delay);
}

function _startMoveTimer() {
    if (moveTimer) return;
    _procesarMovimiento(); // movimiento inmediato
    const delay = engine && engine.jugador ? (engine.jugador.velocidadMoverMs || 100) : 100;
    moveTimer = setTimeout(_loopMovimiento, delay);
}

function _stopMoveTimer() {
    if (moveTimer) {
        clearTimeout(moveTimer);
        moveTimer = null;
    }
}

function _procesarKills(kills) {
    engine.totalKills += kills.length;
    for (const k of kills) {
        let r = oleadasConfig.recompensaEnemigo;
        if (k.simbolo === 'T') r = oleadasConfig.recompensaTanque;
        else if (k.simbolo === 'R') r = oleadasConfig.recompensaRapido;
        engine.dinero += r;
        engine.jugador.dinero = engine.dinero;
    }
}

let _canvasClickHandler = null;

function _procesarAtaqueClick(canvas) {
    if (!engine || engine.gameOver || !engine.jugador.estaVivo()) return;
    if (placementMode) return; // no auto-atacar en modo placement

    const rect = canvas.getBoundingClientRect();
    const cellW = canvas.width / engine.board.columnas;
    const cellH = canvas.height / engine.board.filas;

    if (engine.jugador.armaActual === 'espada') {
        const jugX = engine.jugador.columna * cellW + cellW / 2;
        const jugY = engine.jugador.fila * cellH + cellH / 2;
        const mouseX = (lastMousePos.x - rect.left) * (canvas.width / rect.width);
        const mouseY = (lastMousePos.y - rect.top) * (canvas.height / rect.height);
        const angulo = Math.atan2(mouseY - jugY, mouseX - jugX);

        const resultado = engine.jugador.atacarEspadaArco(angulo, engine.board);
        _procesarKills(resultado.kills);

        if (resultado.celdasAfectadas.length > 0) {
            renderer.iniciarSwing(resultado.celdasAfectadas, angulo);
        }
    } else {
        const jugX = engine.jugador.columna * cellW + cellW / 2;
        const jugY = engine.jugador.fila * cellH + cellH / 2;
        const mouseX = (lastMousePos.x - rect.left) * (canvas.width / rect.width);
        const mouseY = (lastMousePos.y - rect.top) * (canvas.height / rect.height);
        const angulo = Math.atan2(mouseY - jugY, mouseX - jugX);

        const resultado = engine.jugador.atacarArco(engine.board, angulo);
        _procesarKills(resultado.kills);
        if (resultado.trayectoria && resultado.trayectoria.length > 0) {
            renderer.iniciarFlecha({ f: engine.jugador.fila, c: engine.jugador.columna }, resultado.trayectoria);
        }
    }
    renderer.updateHUDOleadas(engine);
    _actualizarTienda();
}

function _startAttackTimer(canvas) {
    if (attackTimer) return;
    _procesarAtaqueClick(canvas); // ataque inmediato
    attackTimer = setInterval(() => _procesarAtaqueClick(canvas), ATTACK_INTERVAL);
}

function _stopAttackTimer() {
    if (attackTimer) {
        clearInterval(attackTimer);
        attackTimer = null;
    }
    mouseHeld = false;
}

function _bindInput() {
    const canvas = document.getElementById('oleadasCanvas');
    const btnVolver = document.getElementById('btnVolverOleadas');
    const btnOleada = document.getElementById('btnIniciarOleada');
    const btnPausa = document.getElementById('btnPausaOleadas');

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
                    _procesarKills(kills);
                } else {
                    const resultado = engine.jugador.atacarArco(engine.board);
                    _procesarKills(resultado.kills);
                    if (resultado.trayectoria && resultado.trayectoria.length > 0) {
                        renderer.iniciarFlecha({ f: engine.jugador.fila, c: engine.jugador.columna }, resultado.trayectoria);
                    }
                }
                renderer.updateHUDOleadas(engine);
                _actualizarTienda();
            }
        }

        // Cambiar arma
        // if (key === 'e' || key === 'q') {
        //     engine.jugador.cambiarArma();
        //     renderer.updateHUDOleadas(engine);
        // }

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
        if (placementMode === 'muro') {
            if (engine.colocarMuro(f, c)) {
                _render();
                _actualizarTienda();
                renderer.updateHUDOleadas(engine);
            }
            return;
        } else if (placementMode === 'torre') {
            if (engine.colocarTorre(f, c)) {
                _render();
                _actualizarTienda();
                renderer.updateHUDOleadas(engine);
            }
            return;
        } else if (placementMode === 'mejoraTorre') {
            if (engine.mejorarTorre(f, c)) {
                _render();
                _actualizarTienda();
                renderer.updateHUDOleadas(engine);
            }
            return;
        }

        // Ataque — iniciar hold
        mouseHeld = true;
        _startAttackTimer(canvas);
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

    // Boton iniciar oleada
    const oleadaHandler = () => {
        if (engine.gameOver) return;
        if (engine.oleadaEnCurso) return;

        // Overlay
        _mostrarOverlayOleada(engine.oleadaActual + 1);

        setTimeout(() => {
            engine.iniciarOleada();
            btnOleada.style.display = 'none';
            btnPausa.style.display = '';
            renderer.updateHUDOleadas(engine);
        }, 1500);
    };
    btnOleada.addEventListener('click', oleadaHandler);
    listeners.push(['click', oleadaHandler, btnOleada]);

    // Boton pausa
    const pausaHandler = () => {
        pausado = !pausado;
        btnPausa.textContent = pausado ? 'REANUDAR' : 'PAUSAR';

        // Si la oleada termino, parar loop y mostrar boton oleada
        if (!pausado && !engine.oleadaEnCurso && !engine.gameOver) {
            _stopLoop();
            btnOleada.style.display = '';
            btnPausa.style.display = 'none';
        }
    };
    btnPausa.addEventListener('click', pausaHandler);
    listeners.push(['click', pausaHandler, btnPausa]);

    // Chequeo periodico fin de oleada
    const _checkOleadaFin = setInterval(() => {
        if (!engine || engine.gameOver) {
            clearInterval(_checkOleadaFin);
            return;
        }
        if (!engine.oleadaEnCurso && gameLoop) {
            _stopLoop();
            btnOleada.style.display = '';
            btnPausa.style.display = 'none';
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
}

// ==================== Overlays ====================

function _mostrarOverlayOleada(num) {
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

function _mostrarGameOver() {
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
            <div class="gameover-linea"><strong>Dinero total ganado:</strong> ${engine.totalKills * oleadasConfig.recompensaEnemigo}$</div>
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
