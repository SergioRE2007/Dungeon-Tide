import { GameBoard } from './gameboard.js';
import { resetContadorId, Enemigo, EnemigoTanque, EnemigoRapido, EnemigoMago, Muro, esEnemigo } from './entidad.js';
import { Escudo, Pocion, Cofre } from './objetos.js';
import { Jugador } from './jugador.js';
import mazmorraConfig from './mazmorraConfig.js';
import * as Rng from './rng.js';

const DIRS = [
    { dr: -1, dc: 0, nombre: 'N' },
    { dr: 1,  dc: 0, nombre: 'S' },
    { dr: 0,  dc: -1, nombre: 'W' },
    { dr: 0,  dc: 1,  nombre: 'E' },
];
const DIR_OPUESTO = { N: 'S', S: 'N', W: 'E', E: 'W' };

export class MazmorraEngine {
    constructor(config = null) {
        this.config = config || mazmorraConfig;
        this.board = null;          // board activo (habitación actual)
        this.jugador = null;
        this.piso = 0;
        this.gameOver = false;
        this.turno = 0;
        this.dinero = 0;
        this.totalKills = 0;
        this.totalDanioInfligido = 0;
        this.totalBossesKilled = 0;
        this.totalCofresAbiertos = 0;
        this.totalOroGanado = 0;
        this.totalHabitacionesLimpiadas = 0;
        this.compras = {};
        this.damageEvents = [];
        this.killsDelTick = 0;
        this.bossKilledThisTick = false;

        // Dungeon state
        this.mapaGrid = null;       // 2D array [r][c] → room descriptor or null
        this.gridSize = 0;
        this.habitacionActual = null; // {r, c}
        this.boards = {};           // "r,c" → GameBoard (cache)
        this.habitaciones = {};     // "r,c" → {tipo, limpiada, visitada, conexiones: {N,S,E,W}}
        this.bossPos = null;        // {r, c} of boss room
        this.pisoCompletado = false;
    }

    inicializar(idClaseSeleccionada = 'guerrero') {
        resetContadorId();
        Rng.setSeed(-1);

        this.piso = 0;
        this.turno = 0;
        this.dinero = this.config.dineroInicial ?? 50;
        this.gameOver = false;
        this.totalKills = 0;
        this.totalDanioInfligido = 0;
        this.totalBossesKilled = 0;
        this.totalCofresAbiertos = 0;
        this.totalOroGanado = 0;
        this.totalHabitacionesLimpiadas = 0;
        this.tiempoInicio = Date.now();
        // Compatibilidad con HUD del renderer (espera oleadaActual)
        this._waveForceEnd = 0;
        this.oleadaEnCurso = true;
        this.enemigosVivos = 0;

        // Crear jugador
        const filas = this.config.filasHabitacion;
        const cols = this.config.columnasHabitacion;
        const cf = Math.floor(filas / 2);
        const cc = Math.floor(cols / 2);

        this.jugador = new Jugador(cf, cc, idClaseSeleccionada, this.config.clases);
        this.jugador.x = cc + 0.5;
        this.jugador.y = cf + 0.5;
        this.jugador.hitboxRadius = this.config.hitboxJugador || 0.25;
        // Config de stamina y XP
        this.jugador.staminaMax = this.config.staminaMax || 100;
        this.jugador.stamina = this.jugador.staminaMax;
        this.jugador._staminaCoste = this.config.staminaCoste || 30;
        this.jugador._staminaRegen = this.config.staminaRegen || 20;
        this.jugador._sprintMultiplier = this.config.sprintMultiplier || 0.30;
        this.jugador._xpEscala = this.config.xpEscala || 1.18;
        this.jugador._mejoraVidaPct = this.config.mejoraVidaNivelPct || 0.30;
        this.jugador._mejoraDanioPct = this.config.mejoraDanioNivelPct || 0.30;
        this.jugador._mejoraVelAtaquePct = this.config.mejoraVelAtaqueNivelPct || 0.22;
        this.jugador._bonusAutoVida = this.config.bonusAutoVida || 0.07;
        this.jugador._bonusAutoDanio = this.config.bonusAutoDanio || 0.07;
        this.jugador.xpParaSiguienteNivel = this.config.xpBase || 80;
        this.jugador.dinero = this.dinero;

        this.generarPiso();
    }

    // ==================== Floor Generation ====================

    generarPiso() {
        this.piso++;
        this.pisoCompletado = false;
        this.boards = {};
        this.habitaciones = {};
        this.bossPos = null;

        const cfg = this.config;
        this.gridSize = cfg.tamanoGridPiso || 9;
        const gs = this.gridSize;
        this.mapaGrid = Array.from({ length: gs }, () => new Array(gs).fill(null));

        // Number of rooms for this floor
        const numTarget = Math.min(
            cfg.maxHabitaciones,
            cfg.minHabitaciones + (this.piso - 1) * cfg.incrementoHabitaciones
        );

        // Start room at center
        const centro = Math.floor(gs / 2);
        const startPos = { r: centro, c: centro };
        this.mapaGrid[centro][centro] = 'inicio';
        const placed = [startPos];

        // Random walk to place rooms
        let intentos = 0;
        while (placed.length < numTarget && intentos < 500) {
            intentos++;
            const base = placed[Rng.nextInt(placed.length)];
            const dir = DIRS[Rng.nextInt(4)];
            const nr = base.r + dir.dr;
            const nc = base.c + dir.dc;

            if (nr < 0 || nr >= gs || nc < 0 || nc >= gs) continue;
            if (this.mapaGrid[nr][nc] !== null) continue;

            // Limit neighbors to max 3 to avoid clumping
            let vecinos = 0;
            for (const d of DIRS) {
                const rr = nr + d.dr;
                const cc = nc + d.dc;
                if (rr >= 0 && rr < gs && cc >= 0 && cc < gs && this.mapaGrid[rr][cc] !== null) vecinos++;
            }
            if (vecinos > 2) continue;

            this.mapaGrid[nr][nc] = 'enemigos'; // default type, assigned later
            placed.push({ r: nr, c: nc });
        }

        // Assign room types
        // Boss = farthest room from start (BFS)
        const distancias = this._bfs(startPos, placed);
        let maxDist = 0;
        let bossRoom = null;
        for (const pos of placed) {
            const key = `${pos.r},${pos.c}`;
            if (key === `${centro},${centro}`) continue;
            if (distancias[key] > maxDist) {
                maxDist = distancias[key];
                bossRoom = pos;
            }
        }
        if (bossRoom) {
            this.mapaGrid[bossRoom.r][bossRoom.c] = 'boss';
            this.bossPos = bossRoom;
        }

        // Treasure and shop rooms (choose from non-start, non-boss rooms)
        const candidates = placed.filter(p => {
            const tipo = this.mapaGrid[p.r][p.c];
            return tipo !== 'inicio' && tipo !== 'boss';
        });
        // Shuffle candidates
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Rng.nextInt(i + 1);
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        let tesoroColocados = 0;
        let tiendaColocados = 0;
        for (const pos of candidates) {
            if (tesoroColocados < (cfg.habitacionesTesoro || 1)) {
                this.mapaGrid[pos.r][pos.c] = 'tesoro';
                tesoroColocados++;
            } else if (tiendaColocados < (cfg.habitacionesTienda || 1)) {
                this.mapaGrid[pos.r][pos.c] = 'tienda';
                tiendaColocados++;
            } else {
                break;
            }
        }

        // Build connections and room descriptors
        for (const pos of placed) {
            const tipo = this.mapaGrid[pos.r][pos.c];
            const conexiones = {};
            for (const d of DIRS) {
                const rr = pos.r + d.dr;
                const cc = pos.c + d.dc;
                if (rr >= 0 && rr < gs && cc >= 0 && cc < gs && this.mapaGrid[rr][cc] !== null) {
                    conexiones[d.nombre] = true;
                }
            }
            this.habitaciones[`${pos.r},${pos.c}`] = {
                tipo,
                limpiada: tipo === 'inicio' || tipo === 'tienda',
                visitada: false,
                conexiones,
            };
        }

        // Enter start room
        this.habitacionActual = { ...startPos };
        this._entrarHabitacion(startPos.r, startPos.c, true);
    }

    _bfs(start, rooms) {
        const distancias = {};
        const key = (r, c) => `${r},${c}`;
        const roomSet = new Set(rooms.map(p => key(p.r, p.c)));
        const cola = [{ r: start.r, c: start.c, dist: 0 }];
        const visitado = new Set();
        visitado.add(key(start.r, start.c));
        distancias[key(start.r, start.c)] = 0;

        while (cola.length > 0) {
            const { r, c, dist } = cola.shift();
            for (const d of DIRS) {
                const nr = r + d.dr;
                const nc = c + d.dc;
                const k = key(nr, nc);
                if (!visitado.has(k) && roomSet.has(k)) {
                    visitado.add(k);
                    distancias[k] = dist + 1;
                    cola.push({ r: nr, c: nc, dist: dist + 1 });
                }
            }
        }
        return distancias;
    }

    // ==================== Room Creation ====================

    _entrarHabitacion(r, c, esInicio = false) {
        const key = `${r},${c}`;
        const hab = this.habitaciones[key];
        if (!hab) return;

        hab.visitada = true;
        this.habitacionActual = { r, c };

        // Get or create board
        if (!this.boards[key]) {
            this.boards[key] = this._crearBoard(r, c, hab);
        }
        this.board = this.boards[key];
        this.board.jugadorRef = this.jugador;

        // Position player
        if (esInicio) {
            const filas = this.config.filasHabitacion;
            const cols = this.config.columnasHabitacion;
            this.jugador.x = Math.floor(cols / 2) + 0.5;
            this.jugador.y = Math.floor(filas / 2) + 0.5;
        }
    }

    _crearBoard(r, c, hab) {
        const cfg = this.config;
        const filas = cfg.filasHabitacion;
        const cols = cfg.columnasHabitacion;
        const board = new GameBoard(filas, cols);

        // Place walls on all 4 borders
        for (let f = 0; f < filas; f++) {
            for (let cc = 0; cc < cols; cc++) {
                if (f === 0 || f === filas - 1 || cc === 0 || cc === cols - 1) {
                    const muro = new Muro(f, cc, 999);
                    board.setEntidad(f, cc, muro);
                }
            }
        }

        // Carve door openings
        const anchoPuerta = cfg.anchoPuerta || 3;
        for (const [dirNombre, existe] of Object.entries(hab.conexiones)) {
            if (!existe) continue;
            this._carvarPuerta(board, dirNombre, filas, cols, anchoPuerta);
        }

        // Populate room based on type
        switch (hab.tipo) {
            case 'enemigos':
                this._poblarEnemigos(board, filas, cols);
                break;
            case 'boss':
                this._poblarBoss(board, filas, cols);
                break;
            case 'tesoro':
                this._poblarTesoro(board, filas, cols);
                break;
            case 'tienda':
                // Shop is handled by the UI layer
                break;
            case 'inicio':
                // Empty room
                break;
        }

        return board;
    }

    _carvarPuerta(board, dir, filas, cols, ancho) {
        const halfAncho = Math.floor(ancho / 2);
        switch (dir) {
            case 'N': { // top wall
                const cc = Math.floor(cols / 2);
                for (let dc = -halfAncho; dc <= halfAncho; dc++) {
                    const c = cc + dc;
                    if (c > 0 && c < cols - 1) board.setEntidad(0, c, null);
                }
                break;
            }
            case 'S': { // bottom wall
                const cc = Math.floor(cols / 2);
                for (let dc = -halfAncho; dc <= halfAncho; dc++) {
                    const c = cc + dc;
                    if (c > 0 && c < cols - 1) board.setEntidad(filas - 1, c, null);
                }
                break;
            }
            case 'W': { // left wall
                const cf = Math.floor(filas / 2);
                for (let df = -halfAncho; df <= halfAncho; df++) {
                    const f = cf + df;
                    if (f > 0 && f < filas - 1) board.setEntidad(f, 0, null);
                }
                break;
            }
            case 'E': { // right wall
                const cf = Math.floor(filas / 2);
                for (let df = -halfAncho; df <= halfAncho; df++) {
                    const f = cf + df;
                    if (f > 0 && f < filas - 1) board.setEntidad(f, cols - 1, null);
                }
                break;
            }
        }
    }

    _poblarEnemigos(board, filas, cols) {
        const cfg = this.config;
        const numBase = cfg.enemigosBaseHabitacion + (this.piso - 1) * (cfg.incrementoEnemigosPiso || 1);
        const num = Math.min(numBase, cfg.maxEnemigosPorHabitacion || 12);
        const escalaVida = Math.pow(cfg.escalaVidaPiso || 1.25, this.piso - 1);
        const escalaDanio = Math.pow(cfg.escalaDanioPiso || 1.15, this.piso - 1);

        for (let i = 0; i < num; i++) {
            const pos = this._buscarCeldaLibre(board, filas, cols);
            if (!pos) continue;

            let enemigo;
            if (this.piso >= (cfg.pisoMagos || 4) && Rng.nextDouble() < 0.15) {
                const d = Math.floor(cfg.danioMago * escalaDanio);
                enemigo = new EnemigoMago(pos.f, pos.c,
                    Math.floor(cfg.vidaMago * escalaVida), d, d,
                    cfg.visionMago, cfg.rangoMago);
            } else if (this.piso >= (cfg.pisoRapidos || 3) && Rng.nextDouble() < 0.2) {
                const d = Math.floor(cfg.danioRapido * escalaDanio);
                enemigo = new EnemigoRapido(pos.f, pos.c,
                    Math.floor(cfg.vidaRapido * escalaVida), d, d,
                    cfg.visionRapido);
            } else if (this.piso >= (cfg.pisoTanques || 2) && Rng.nextDouble() < 0.2) {
                const d = Math.floor(cfg.danioTanque * escalaDanio);
                enemigo = new EnemigoTanque(pos.f, pos.c,
                    Math.floor(cfg.vidaTanque * escalaVida), d, d,
                    cfg.visionTanque);
            } else {
                const d = Math.floor(cfg.danioEnemigo * escalaDanio);
                enemigo = new Enemigo(pos.f, pos.c,
                    Math.floor(cfg.vidaEnemigo * escalaVida), d, d,
                    cfg.visionEnemigo);
            }
            enemigo.x = pos.c + 0.5;
            enemigo.y = pos.f + 0.5;
            board.setEntidad(pos.f, pos.c, enemigo);
            board.addEntidadActiva(enemigo);
        }
    }

    _poblarBoss(board, filas, cols) {
        const cfg = this.config;
        const escalaVida = Math.pow(cfg.escalaVidaPiso || 1.25, this.piso - 1);
        const escalaDanio = Math.pow(cfg.escalaDanioPiso || 1.15, this.piso - 1);

        // Boss in center
        const cf = Math.floor(filas / 2);
        const cc = Math.floor(cols / 2);
        const dBoss = Math.floor(cfg.danioTanque * escalaDanio * cfg.bossMultiplicadorDanio);
        const boss = new EnemigoTanque(cf, cc,
            Math.floor(cfg.vidaTanque * escalaVida * cfg.bossMultiplicadorVida),
            dBoss, dBoss, cfg.visionTanque);
        boss.esBoss = true;
        boss.x = cc + 0.5;
        boss.y = cf + 0.5;
        board.setEntidad(cf, cc, boss);
        board.addEntidadActiva(boss);

        // Extra minions
        const numExtra = cfg.enemigosBossExtra || 3;
        for (let i = 0; i < numExtra; i++) {
            const pos = this._buscarCeldaLibre(board, filas, cols);
            if (!pos) continue;
            const d = Math.floor(cfg.danioEnemigo * escalaDanio);
            const minion = new Enemigo(pos.f, pos.c,
                Math.floor(cfg.vidaEnemigo * escalaVida), d, d,
                cfg.visionEnemigo);
            minion.x = pos.c + 0.5;
            minion.y = pos.f + 0.5;
            board.setEntidad(pos.f, pos.c, minion);
            board.addEntidadActiva(minion);
        }
    }

    _poblarTesoro(board, filas, cols) {
        // Place 1-2 cofres in center area
        const cf = Math.floor(filas / 2);
        const cc = Math.floor(cols / 2);
        const cofre = new Cofre(cf, cc);
        board.setObjeto(cf, cc, cofre);
        // Second cofre nearby
        if (Rng.nextDouble() < 0.5) {
            const pos = this._buscarCeldaLibre(board, filas, cols);
            if (pos) board.setObjeto(pos.f, pos.c, new Cofre(pos.f, pos.c));
        }
    }

    _buscarCeldaLibre(board, filas, cols) {
        // Avoid borders (2 cells from edge) and center (3 cells from center)
        const cf = Math.floor(filas / 2);
        const cc = Math.floor(cols / 2);
        for (let intento = 0; intento < 50; intento++) {
            const f = 2 + Rng.nextInt(filas - 4);
            const c = 2 + Rng.nextInt(cols - 4);
            if (board.getEntidad(f, c)) continue;
            if (board.getObjeto(f, c)) continue;
            // Not too close to center (player spawn area)
            if (Math.abs(f - cf) <= 2 && Math.abs(c - cc) <= 2) continue;
            return { f, c };
        }
        return null;
    }

    // ==================== Room Transition ====================

    /**
     * Check if player is at a door edge and transition if possible.
     * Returns: 'locked' if room not cleared, direction string if transitioning, null otherwise.
     */
    intentarTransicion() {
        if (!this.jugador || !this.jugador.estaVivo()) return null;
        const hab = this.habitaciones[`${this.habitacionActual.r},${this.habitacionActual.c}`];
        if (!hab) return null;

        const filas = this.config.filasHabitacion;
        const cols = this.config.columnasHabitacion;
        const jx = this.jugador.x;
        const jy = this.jugador.y;
        const margen = 0.6;
        const centroC = Math.floor(cols / 2);
        const centroF = Math.floor(filas / 2);
        const halfPuerta = Math.floor((this.config.anchoPuerta || 3) / 2) + 0.5;

        let dirTransicion = null;

        // Check each direction
        if (jy < margen && hab.conexiones.N && Math.abs(jx - centroC - 0.5) < halfPuerta) {
            dirTransicion = 'N';
        } else if (jy > filas - margen && hab.conexiones.S && Math.abs(jx - centroC - 0.5) < halfPuerta) {
            dirTransicion = 'S';
        } else if (jx < margen && hab.conexiones.W && Math.abs(jy - centroF - 0.5) < halfPuerta) {
            dirTransicion = 'W';
        } else if (jx > cols - margen && hab.conexiones.E && Math.abs(jy - centroF - 0.5) < halfPuerta) {
            dirTransicion = 'E';
        }

        if (!dirTransicion) return null;

        // Check if room is cleared
        if (!hab.limpiada) return 'locked';

        // Transition!
        const dir = DIRS.find(d => d.nombre === dirTransicion);
        const nr = this.habitacionActual.r + dir.dr;
        const nc = this.habitacionActual.c + dir.dc;

        this._entrarHabitacion(nr, nc);

        // Position player on opposite edge
        const filas2 = this.config.filasHabitacion;
        const cols2 = this.config.columnasHabitacion;
        switch (dirTransicion) {
            case 'N': this.jugador.y = filas2 - 1.5; break;
            case 'S': this.jugador.y = 1.5; break;
            case 'W': this.jugador.x = cols2 - 1.5; break;
            case 'E': this.jugador.x = 1.5; break;
        }

        return dirTransicion;
    }

    // ==================== Game Tick ====================

    tick() {
        if (this.gameOver || !this.board || !this.jugador) return;
        this.damageEvents = [];
        this.killsDelTick = 0;
        this.bossKilledThisTick = false;

        const board = this.board;
        const cfg = this.config;
        const hab = this.habitaciones[`${this.habitacionActual.r},${this.habitacionActual.c}`];

        // Process projectiles
        const proyectilesVivos = [];
        for (const p of board.proyectiles) {
            p._prevTickTime = p._lastTickTime;
            p._lastTickTime = performance.now();
            p.paso++;
            if (p.paso >= p.pasos) {
                // Projectile arrived
                const tf = Math.round(p.destinoF);
                const tc = Math.round(p.destinoC);
                if (p.radioExplosion && p.radioExplosion > 0) {
                    this._procesarExplosion(board, tf, tc, p);
                } else {
                    const target = board.getEntidad(tf, tc);
                    if (target && target.estaVivo()) {
                        target.recibirDanio(p.danio);
                        if (p.buscaEnemigos) {
                            this.jugador.danioInfligido += p.danio;
                        }
                    }
                }
            } else {
                proyectilesVivos.push(p);
            }
        }
        board.proyectiles = proyectilesVivos;

        // Process bleeding DoT
        for (const e of board.entidadesActivas) {
            if (e.sangrado && e.sangrado.turnos > 0 && e.estaVivo()) {
                e.recibirDanio(e.sangrado.danio);
                e.sangrado.turnos--;
                this.damageEvents.push({ x: e.x || e.columna + 0.5, y: e.y || e.fila, amount: e.sangrado.danio, type: 'bleed' });
                if (e.sangrado.turnos <= 0) e.sangrado = null;
            }
        }

        // Enemy actions
        const enemigos = board.entidadesActivas.filter(e => esEnemigo(e.tipo));
        for (const e of enemigos) {
            if (!e.estaVivo()) continue;
            // Simple AI: move toward player and attack
            e.actuar(board);

            // Melee damage to player
            if (this.jugador.estaVivo() && e.estaVivo()) {
                const dist = Math.hypot(
                    (e.x || e.columna + 0.5) - this.jugador.x,
                    (e.y || e.fila + 0.5) - this.jugador.y
                );
                const meleeRange = cfg.meleeRange || 0.9;
                const esMago = e instanceof EnemigoMago;

                if (!esMago && dist < meleeRange) {
                    const danio = e.getDanio();
                    e.danioInfligido += danio;
                    this.jugador.danioRecibido += danio;
                    this.jugador.recibirDanio(danio);
                    const jx = this.jugador.x;
                    const jy = this.jugador.y;
                    this.damageEvents.push({ x: jx, y: jy, amount: danio, type: 'playerHit' });
                }
            }
        }

        // Trap damage to player
        if (this.jugador.estaVivo()) {
            const jf = Math.floor(this.jugador.y);
            const jc = Math.floor(this.jugador.x);
            if (jf >= 0 && jf < board.filas && jc >= 0 && jc < board.columnas) {
                const trampa = board.getTrampa(jf, jc);
                if (trampa) {
                    const danio = trampa.getDanio();
                    this.jugador.recibirDanio(danio);
                    this.jugador.danioRecibido += danio;
                }
            }
        }

        // Process deaths
        let killsEsteTurno = 0;
        for (let i = board.entidadesActivas.length - 1; i >= 0; i--) {
            const e = board.entidadesActivas[i];
            if (!e.estaVivo()) {
                if (esEnemigo(e.tipo)) {
                    // Rewards
                    let recompensa = cfg.recompensaEnemigo;
                    if (e instanceof EnemigoTanque) recompensa = cfg.recompensaTanque;
                    else if (e instanceof EnemigoRapido) recompensa = cfg.recompensaRapido;
                    else if (e instanceof EnemigoMago) recompensa = cfg.recompensaMago;
                    const escalaOro = Math.pow(cfg.escalaOroOleada || 1, this.piso - 1);
                    const bonusOro = 1 + (this.jugador.buffs?.gananciaOro || 0);
                    const oroGanado = Math.floor(recompensa * escalaOro * bonusOro);
                    this.dinero += oroGanado;
                    this.totalOroGanado += oroGanado;
                    this.jugador.dinero = this.dinero;

                    // XP
                    let xpGanado = cfg.xpEnemigo || 25;
                    if (e instanceof EnemigoTanque) xpGanado = cfg.xpTanque || 60;
                    else if (e instanceof EnemigoRapido) xpGanado = cfg.xpRapido || 30;
                    else if (e instanceof EnemigoMago) xpGanado = cfg.xpMago || 40;
                    if (e.esBoss) xpGanado = cfg.xpBoss || 250;
                    const escalaXP = 1 + (cfg.xpEscalaPiso || 0.15) * (this.piso - 1);
                    xpGanado = Math.floor(xpGanado * escalaXP);
                    this.jugador.ganarXP(xpGanado);

                    killsEsteTurno++;
                    this.killsDelTick++;
                    this.totalKills++;

                    if (e.esBoss) {
                        this.bossKilledThisTick = true;
                        this.totalBossesKilled++;
                    }

                    this.damageEvents.push({ x: e.x, y: e.y, amount: oroGanado, type: 'gold' });
                    this.damageEvents.push({ x: e.x, y: e.y - 0.5, amount: xpGanado, type: 'xp' });

                    // Drop chance
                    if (e.esBoss || Rng.nextDouble() < (cfg.probCofreEnemigo || 0)) {
                        this._dropCofre(e.fila, e.columna);
                    }
                    if (Rng.nextDouble() < cfg.probDrop) this._dropObjeto(e.fila, e.columna);

                    board.setEntidad(e.fila, e.columna, null);
                }
                board.entidadesActivas.splice(i, 1);
            }
        }

        // Check if room is cleared
        if (hab && !hab.limpiada) {
            const enemigosVivos = board.entidadesActivas.filter(e => esEnemigo(e.tipo));
            if (enemigosVivos.length === 0) {
                hab.limpiada = true;
                this.totalHabitacionesLimpiadas++;
                // Room clear XP bonus
                const bonusXP = cfg.xpBonusHabitacion || 20;
                if (bonusXP > 0 && this.jugador.estaVivo()) {
                    this.jugador.ganarXP(bonusXP);
                    this.damageEvents.push({
                        x: this.jugador.x, y: this.jugador.y - 0.5,
                        amount: bonusXP, type: 'xp'
                    });
                }
            }
        }

        // Check if boss killed = floor complete
        if (this.bossKilledThisTick) {
            this.pisoCompletado = true;
            // Floor clear XP bonus
            const bonusXP = (cfg.xpBonusPiso || 100) * this.piso;
            if (bonusXP > 0 && this.jugador.estaVivo()) {
                this.jugador.ganarXP(bonusXP);
                this.damageEvents.push({
                    x: this.jugador.x, y: this.jugador.y - 0.8,
                    amount: bonusXP, type: 'xp'
                });
            }
        }

        // Game over check
        if (!this.jugador.estaVivo()) {
            this.gameOver = true;
        }

        this.turno++;
    }

    _procesarExplosion(board, tf, tc, p) {
        const radio = p.radioExplosion || 1;
        board.ultimasExplosiones.push({ f: tf, c: tc, radio });
        for (let df = -radio; df <= radio; df++) {
            for (let dc = -radio; dc <= radio; dc++) {
                const f = tf + df;
                const c = tc + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                const target = board.getEntidad(f, c);
                if (target && target.estaVivo() && esEnemigo(target.tipo) === p.buscaEnemigos) {
                    target.recibirDanio(p.danio);
                    if (p.buscaEnemigos) {
                        this.jugador.danioInfligido += p.danio;
                    }
                }
            }
        }
    }

    tickRapidos(now) {
        if (!this.board || this.gameOver) return;
        for (const e of this.board.entidadesActivas) {
            if (e instanceof EnemigoRapido && e.estaVivo()) {
                e.actuar(this.board);
            }
        }
    }

    _dropObjeto(f, c) {
        if (!this.board) return;
        if (this.board.getObjeto(f, c)) return;
        const roll = Rng.nextDouble();
        let obj;
        if (roll < 0.4) obj = new Pocion(f, c);
        else if (roll < 0.7) obj = new Escudo(f, c);
        else obj = new Pocion(f, c);
        this.board.setObjeto(f, c, obj);
    }

    _dropCofre(f, c) {
        if (!this.board) return;
        if (this.board.getObjeto(f, c)) return;
        this.board.setObjeto(f, c, new Cofre(f, c));
    }

    // ==================== Shop ====================

    comprarPocion() {
        const cfg = this.config;
        const precio = this._precioActual(cfg.precioPocion, 'pocion');
        if (this.dinero < precio) return false;
        this.dinero -= precio;
        this.jugador.dinero = this.dinero;
        this.jugador.curar(this.jugador.vidaMax); // full heal
        this._registrarCompra('pocion');
        return true;
    }

    comprarEscudo() {
        const cfg = this.config;
        const precio = this._precioActual(cfg.precioEscudo, 'escudo');
        if (this.dinero < precio) return false;
        this.dinero -= precio;
        this.jugador.dinero = this.dinero;
        this.jugador.escudo += cfg.escudoCantidad || 50;
        this._registrarCompra('escudo');
        return true;
    }

    _precioActual(base, tipo) {
        const compras = this._getCompras(tipo);
        return Math.floor(base * Math.pow(this.config.escalaPrecio || 1.5, compras));
    }

    _getCompras(tipo) {
        return this.compras[tipo] || 0;
    }

    _registrarCompra(tipo) {
        this.compras[tipo] = (this.compras[tipo] || 0) + 1;
    }

    // ==================== Minimap Data ====================

    getMinimapaData() {
        return {
            habitaciones: this.habitaciones,
            actual: this.habitacionActual,
            gridSize: this.gridSize,
        };
    }

    // Alias para compatibilidad con HUD del renderer
    get oleadaActual() { return this.piso; }

    // ==================== Floor Progression ====================

    avanzarPiso() {
        // Heal player
        const curacion = Math.floor(this.jugador.vidaMax * (this.config.curacionPisoPct || 0.5));
        this.jugador.curar(curacion);
        // Generate next floor
        this.generarPiso();
    }
}
