import { GameBoard } from './gameboard.js';
import { resetContadorId, Proyectil } from './entidad.js';
import { Jugador } from './jugador.js';
import dificultades from './bulletHellConfig.js';
import * as Rng from './rng.js';


// ==================== Object Pool ====================


const _pool = [];
const POOL_MAX = 800;


function _getProyectil(oF, oC, dF, dC, danio) {
    if (_pool.length > 0) {
        const p = _pool.pop();
        p.reiniciar(oF, oC, dF, dC, danio);
        return p;
    }
    return new Proyectil(oF, oC, dF, dC, danio, null, false, 0);
}


function _reciclar(p) {
    if (_pool.length < POOL_MAX) _pool.push(p);
}


// ==================== Constantes ====================


const STEP = Math.PI / 24;
const PATRON_DURACION_SEG = 5;
const PAUSA_ENTRE_PATRONES_SEG = 1.2;
const TOTAL_PATRONES = 9;


export const NOMBRES_PATRONES_BORDE = [
    'Espiral', 'Cortina', 'Embudo',
    'Doble Espiral', 'Tijeras', 'Diagonal', 'Cascada',
];

export const NOMBRES_PATRONES_MAGO = [
    'Espiral', 'Pendular', 'Doble Pend.', 'Caotica',
    'Acelerada', 'Cruz Pend.', 'Cruz Altern.', 'Cruz Rafagas', 'Inversa',
];


// ==================== Engine ====================


export class BulletHellEngine {
    constructor(config = null) {
        this.config = config || dificultades.normal;
        this.board = null;
        this.jugador = null;
        this.gameOver = false;
        this.magoManual = false;
        this._magoManualDisparando = false;
        this.tiempoInicio = 0;
        this.tiempoFinal = null;
        this.turno = 0;
        this.ultimoHitTime = 0;
        this._anguloEspiral = 0;
        this._ultimoPatronBorde = -1;
        this._cascadaOffset = 0;
        this._cascadaProxima = 0;  // timestamp: cuando toca la siguiente cascada
        this._cascadaState = null; // estado activo de la cascada en curso
        this._bordeState = null;   // estado activo del patron de borde multi-iteracion
        this._patronHasta = 0;     // timestamp: ningun patron ni mago hasta este momento

        this.mago = null;
        this._magoState = null;

        this.oleadaActual = 0;
        this.dinero = 0;
        this.spawners = [];
        this.torres = [];
        this.oleadaEnCurso = true;
    }


    inicializar() {
        resetContadorId();
        Rng.setSeed(-1);

        const { filas, columnas } = this.config;
        this.board = new GameBoard(filas, columnas);

        const cf = Math.floor(filas / 2);
        const cc = Math.floor(columnas / 2);

        this.jugador = new Jugador(cf, cc, 'bullethell', this.config.clases);
        this.jugador.x = cc + 0.5;
        this.jugador.y = cf + 0.5;
        this.jugador.hitboxRadius = this.config.hitboxJugador || 0.2;
        this.board.jugadorRef = this.jugador;

        this.gameOver = false;
        this.tiempoInicio = Date.now();
        this.ultimoHitTime = Date.now();
        this.turno = 0;
        this._anguloEspiral = Math.random() * Math.PI * 2;
        this._ultimoPatronBorde = -1;
        this._cascadaOffset = Math.random() * Math.PI * 2;
        this._cascadaHasta = 0;

        // Sistema de fases: 4 borde -> 2 mago -> repetir
        this._faseConfig = { bordesPorCiclo: 4, magosPorCiclo: 2 }; // configurable
        this._fase = 'borde';
        this._bordeCompletados = 0;
        this._magoCompletados = 0;
        
        this.mago = {
            fila: cf,
            columna: cc,
            activo: false,
            anguloOrbita: 0,
            apariciones: 0,
        };

        this._magoState = {
            patronIdx: Rng.nextInt(TOTAL_PATRONES),
            patronTick: 0,
            angulo: 0,
            direccion: 1,
            velocidad: 1,
            enPausa: false,
            pausaTick: 0,
        };
    }


    getTiempoSegundos() {
        const fin = this.tiempoFinal || Date.now();
        return (fin - this.tiempoInicio) / 1000;
    }


    tick() {
        if (this.gameOver) return;
        this.turno++;

        const vidaAntes = this.jugador.vida;

        if (this.jugador.estaVivo()) {
            this.jugador.actuar(this.board);
        }

        // Sistema de fases (4 borde -> 2 mago -> repetir)
        this._gestionarFases();

        if (this._fase === 'mago' && this.mago.activo) {
            this._magoDisparar();
        }

        // Modo manual: mago controlado a mano
        if (this.magoManual && this.mago.activo && this._magoManualDisparando) {
            this._magoDisparar();
        }

        // Patron de borde multi-iteracion
        this._tickBorde();

        // Cascada: dispara una oleada por tick mientras esta activa
        this._tickCascada();

        this.board.procesarProyectiles();

        if (this.jugador.vida < vidaAntes) {
            this.ultimoHitTime = Date.now();
            this.jugador.turnosInvencible = this.config.turnosInvencibleHit;
        }

        if (this.jugador.estaVivo() && this.jugador.vida < this.jugador.vidaMax) {
            const sinDanio = (Date.now() - this.ultimoHitTime) / 1000;
            if (sinDanio >= this.config.tiempoCuracionSeg) {
                this.jugador.curar(1);
                this.ultimoHitTime = Date.now();
            }
        }

        const proys = this.board.proyectiles;
        const margen = 5;
        const maxF = this.board.filas + margen;
        const maxC = this.board.columnas + margen;
        let w = 0;
        for (let i = 0; i < proys.length; i++) {
            const p = proys[i];
            const f = p.fila;
            const c = p.columna;
            if (f >= -margen && f < maxF && c >= -margen && c < maxC) {
                proys[w++] = p;
            } else {
                _reciclar(p);
            }
        }
        proys.length = w;

        if (!this.jugador.estaVivo()) {
            this.gameOver = true;
            this.tiempoFinal = Date.now();
        }
    }


    // ==================== Gestion de fases (4 borde -> 2 mago) ====================


    _gestionarFases() {
        if (this.magoManual) return;
    
        const { bordesPorCiclo, magosPorCiclo } = this._faseConfig;
        const cooldownActivo = this._patronHasta > 0 && Date.now() < this._patronHasta;
    
        if (this._fase === 'borde') {
            if (this._bordeCompletados >= bordesPorCiclo
                && !this._bordeState && !this._cascadaState && !cooldownActivo) {
    
                this._fase = 'mago';
                this._magoCompletados = 0;
    
                const mago = this.mago;
                mago.activo = true;
                mago.apariciones++;
    
                const { filas, columnas } = this.board;
                mago.fila = filas / 2;
                mago.columna = columnas / 2;
    
                const st = this._magoState;
                st.patronIdx = Rng.nextInt(TOTAL_PATRONES);
                st.patronTick = 0;
                st.angulo = 0;
                st.direccion = 1;
                st.velocidad = 1;
                st.enPausa = false;   // ← asegura que dispara sin pausa inicial
                st.pausaTick = 0;
            }
        } else if (this._fase === 'mago') {
            const t = this.getTiempoSegundos();
            const { filas, columnas } = this.board;
            this.mago.fila = filas / 2 + Math.sin(t * 0.5) * 2;
            this.mago.columna = columnas / 2 + Math.cos(t * 0.35) * 3;
    
            if (this._magoCompletados >= magosPorCiclo) {
                this._fase = 'borde';
                this._bordeCompletados = 0;
                this.mago.activo = false;
            }
        }
    }
    


    // ==================== Mago disparo ====================


    _getBalasAnillo() {
        const base = this.config.magoBalasAnillo;
        const max = this.config.magoBalasAnilloMax;
        const extra = (this.mago.apariciones - 1) * 2;
        return Math.min(max, base + extra);
    }


    _magoDisparar() {
        const st = this._magoState;
        const ticksPorPatron = Math.round(PATRON_DURACION_SEG * 1000 / this.config.velocidadMs);
        const ticksPausa = Math.round(PAUSA_ENTRE_PATRONES_SEG * 1000 / this.config.velocidadMs);

        if (st.enPausa) {
            st.pausaTick++;
            if (st.pausaTick >= ticksPausa) {
                st.enPausa = false;
                st.pausaTick = 0;
            }
            return;
        }

        st.patronTick++;

        if (st.patronTick > ticksPorPatron) {
            if (this.magoManual) {
                // En modo manual, parar al terminar el patron
                this._magoManualDisparando = false;
                st.enPausa = true;
                st.pausaTick = 0;
                return;
            }

            // Contar patron completado
            this._magoCompletados++;

            // Si ya completo los 2 patrones, no iniciar otro
            if (this._magoCompletados >= 2) return;

            let nuevo;
            do { nuevo = Rng.nextInt(TOTAL_PATRONES); } while (nuevo === st.patronIdx);
            st.patronIdx = nuevo;
            st.patronTick = 0;
            st.angulo = 0;
            st.direccion = 1;
            st.velocidad = 1;
            st.enPausa = true;
            st.pausaTick = 0;
            return;
        }

        const danio = this.getDanioBala();
        const mF = this.mago.fila;
        const mC = this.mago.columna;
        const dist = Math.max(this.board.filas, this.board.columnas) + 5;
        const n = this._getBalasAnillo();

        // ~50% de balas para espirales — más manejable visualmente
        const nEspiral = Math.max(Math.floor(n * 0.5), 6);

        switch (st.patronIdx) {
            case 0: this._patronEspiralSimple(st, mF, mC, dist, danio, nEspiral); break;
            case 1: this._patronEspiralPendular(st, mF, mC, dist, danio, nEspiral); break;
            case 2: this._patronEspiralPendularDoble(st, mF, mC, dist, danio, nEspiral); break;
            case 3: this._patronEspiralCaotica(st, mF, mC, dist, danio, nEspiral); break;
            case 4: this._patronEspiralAceleradaPendular(st, mF, mC, dist, danio, nEspiral); break;
            case 5: this._patronCruzPendular(st, mF, mC, dist, danio, n); break;
            case 6: this._patronCruzAlternanteBrusca(st, mF, mC, dist, danio, n); break;
            case 7: this._patronCruzRafagas3(st, mF, mC, dist, danio, n); break;
            case 8: this._patronEspiralInversa(st, mF, mC, dist, danio, nEspiral); break;
        }
    }


    // ==================== Patrones del mago ====================


    // 0: Espiral simple
    _patronEspiralSimple(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += STEP;
    }


    // 1: Espiral pendular
    _patronEspiralPendular(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += st.direccion * STEP;
        if (st.angulo >= Math.PI || st.angulo <= 0) st.direccion *= -1;
    }


    // 2: Espiral pendular doble
    _patronEspiralPendularDoble(st, mF, mC, dist, danio, n) {
        const half = Math.max(Math.floor(n / 2), 4);
        for (let i = 0; i < half; i++) {
            const base = (i * 2 * Math.PI / half);
            this._disparar(mF, mC, st.angulo + base, dist, danio);
            this._disparar(mF, mC, st.angulo + base + Math.PI, dist, danio);
        }
        st.angulo += st.direccion * STEP;
        if (st.angulo >= Math.PI || st.angulo <= 0) st.direccion *= -1;
    }


    // 3: Espiral caótica
    _patronEspiralCaotica(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += st.direccion * STEP;
        if (Rng.nextInt(12) === 0) st.direccion *= -1;
    }


    // 4: Espiral acelerada pendular
    _patronEspiralAceleradaPendular(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += st.direccion * STEP * st.velocidad;
        if (st.angulo >= Math.PI || st.angulo <= 0) {
            st.direccion *= -1;
            if (st.angulo <= 0) st.velocidad = 1;
        }
        st.velocidad += 0.06;
    }


    // 5: Cruz pendular
    _patronCruzPendular(st, mF, mC, dist, danio, n) {
        const balasPerBrazo = Math.max(Math.floor(n / 4), 3);
        const sweep = Math.sin(st.patronTick * 0.15) * (Math.PI / 8);
        const spreadTotal = 0.12;
        const divisor = balasPerBrazo > 1 ? balasPerBrazo - 1 : 1;

        for (let b = 0; b < 4; b++) {
            const anguloBase = b * (Math.PI / 2) + sweep;
            for (let i = 0; i < balasPerBrazo; i++) {
                const offset = (i / divisor - 0.5) * spreadTotal;
                this._disparar(mF, mC, anguloBase + offset, dist, danio);
            }
        }
    }


    // 6: Cruz alternante brusca
    _patronCruzAlternanteBrusca(st, mF, mC, dist, danio, n) {
        const balasPerBrazo = Math.max(Math.floor(n / 4), 3);
        const ticksPerSeg = Math.round(1000 / this.config.velocidadMs);
        const esX = (Math.floor(st.patronTick / ticksPerSeg) % 2) === 1;
        const offsetCruz = esX ? Math.PI / 4 : 0;
        const spreadTotal = 0.1;
        const divisor = balasPerBrazo > 1 ? balasPerBrazo - 1 : 1;

        for (let b = 0; b < 4; b++) {
            const anguloBase = b * (Math.PI / 2) + offsetCruz;
            for (let i = 0; i < balasPerBrazo; i++) {
                const offset = (i / divisor - 0.5) * spreadTotal;
                this._disparar(mF, mC, anguloBase + offset, dist, danio);
            }
        }
    }


    // 7: Cruz con ráfagas de 3
    _patronCruzRafagas3(st, mF, mC, dist, danio, n) {
        const ciclo = st.patronTick % 7;
        if (ciclo < 3) {
            const balasPerBrazo = Math.max(Math.floor(n / 4), 3);
            const spreadTotal = 0.15;
            const divisor = balasPerBrazo > 1 ? balasPerBrazo - 1 : 1;
            for (let b = 0; b < 4; b++) {
                const anguloBase = st.angulo + b * (Math.PI / 2);
                for (let i = 0; i < balasPerBrazo; i++) {
                    const offset = (i / divisor - 0.5) * spreadTotal;
                    this._disparar(mF, mC, anguloBase + offset, dist, danio);
                }
            }
        }
        st.angulo += STEP * 0.5;
    }


    // 8: Espiral inversa
    _patronEspiralInversa(st, mF, mC, dist, danio, n) {
        const half = Math.max(Math.floor(n / 2), 4);
        for (let i = 0; i < half; i++) {
            const base = (i * 2 * Math.PI / half);
            this._disparar(mF, mC, st.angulo + base, dist, danio);
            this._disparar(mF, mC, -st.angulo + base, dist, danio);
        }
        st.angulo += STEP;
    }


    // ==================== Disparar bala (pool) ====================


    _disparar(mF, mC, angulo, dist, danio) {
        const oF = Math.round(mF);
        const oC = Math.round(mC);
        const destF = oF + Math.round(Math.sin(angulo) * dist);
        const destC = oC + Math.round(Math.cos(angulo) * dist);
        const p = _getProyectil(oF, oC, destF, destC, danio);
        this.board.agregarProyectil(p);
    }


    // ==================== Balas de borde ====================


    getDanioBala() {
        return this.config.danioBala;
    }


    getBalasPerSpawn() {
        const t = this.getTiempoSegundos();
        const base = Math.min(
            this.config.balasMaxPerSpawn,
            Math.floor(this.config.balasPerSpawn + t * this.config.balasIncrementoCadaSeg)
        );
        // ±25% variacion aleatoria
        const variacion = Math.max(1, Math.floor(base * 0.25));
        return base + Rng.nextInt(variacion * 2 + 1) - variacion;
    }


    getIntervaloSpawn() {
        const t = this.getTiempoSegundos();
        const ciclos = t / 5;
        const base = this.config.intervaloSpawnMs *
            Math.pow(1 - this.config.intervaloReduccionPct, ciclos);
        const intervalo = Math.max(this.config.intervaloMinMs, base);
        // ±30% variacion aleatoria en el timing
        const factor = 0.7 + Math.random() * 0.6;
        return Math.round(intervalo * factor);
    }


    spawnBalas() {
        if (this.gameOver) return;

        // Solo spawnear borde durante fase borde
        if (this._fase !== 'borde') return;

        // Cooldown del patron actual: no lanzar nada hasta que termine
        if (this._patronHasta > 0 && Date.now() < this._patronHasta) return;

        // Patron de borde o cascada en curso bloquean nuevos spawns
        if (this._bordeState) return;
        if (this._cascadaState) return;

        const n = this.getBalasPerSpawn();
        const danio = this.getDanioBala();
        const { filas, columnas } = this.board;
        const jugF = Math.round(this.jugador.y);
        const jugC = Math.round(this.jugador.x);
        const t = this.getTiempoSegundos();

        this._lanzarPatronBorde(n, danio, filas, columnas, jugF, jugC, t);
    }


    // Modo custom: forzar un patron de borde especifico
    forzarPatronBorde(idx) {
        const n = this.getBalasPerSpawn();
        const danio = this.getDanioBala();
        const { filas, columnas } = this.board;

        // Cascada (idx 6) usa su propio sistema
        if (idx === 6) {
            this._spawnCascada(danio, filas, columnas);
            return;
        }

        const cooldownSeg = [7, 7, 7, 7, 7, 5];
        this._patronHasta = Date.now() + (cooldownSeg[idx] || 7) * 1000;

        const iterBase = [15, 15, 20, 15, 15, 15];
        const base = iterBase[idx] || 15;
        const variacion = Math.floor(base * 0.4);
        const iter = base + Rng.nextInt(variacion * 2 + 1) - variacion;
        this._bordeState = {
            patronIdx: idx,
            iteracionesTotal: iter,
            iteracionActual: 0,
            n, danio, filas, columnas,
        };
    }


    // Modo custom: forzar un patron del mago (continuo hasta que termine)
    forzarPatronMago(idx) {
        if (!this.mago.activo) {
            this.mago.activo = true;
            this.mago.fila = this.board.filas / 2;
            this.mago.columna = this.board.columnas / 2;
        }

        const st = this._magoState;
        st.patronIdx = idx;
        st.patronTick = 0;
        st.angulo = 0;
        st.direccion = 1;
        st.velocidad = 1;
        st.enPausa = false;
        st.pausaTick = 0;
        this._magoManualDisparando = true;
    }


    _lanzarPatronBorde(n, danio, filas, columnas, jugF, jugC, t) {
        // Cascada: evento especial periodico
        if (this._cascadaProxima === 0) {
            // Primera cascada entre 20-35s (randomizado)
            this._cascadaProxima = this.tiempoInicio + (20 + Rng.nextInt(15)) * 1000;
        }
        if (this._cascadaProxima > 0 && Date.now() >= this._cascadaProxima) {
            this._spawnCascada(danio, filas, columnas);
            return;
        }

        // Todos los 6 patrones de borde disponibles desde el inicio
        const patronesBorde = 6;

        // Patrones de lluvia/pared: no pueden salir dos seguidos
        const patronesLluvia = new Set([1, 4, 5]);

        let patron;
        let intentos = 0;
        do {
            patron = Rng.nextInt(patronesBorde);
            intentos++;
        } while (
            intentos < 10 &&
            patronesLluvia.has(patron) &&
            patronesLluvia.has(this._ultimoPatronBorde)
        );
        this._ultimoPatronBorde = patron;

        // Cooldown: tiempo en pantalla por patron (segundos)
        const cooldownSeg = [7, 7, 7, 7, 7, 5];
        this._patronHasta = Date.now() + cooldownSeg[patron] * 1000;

        // Iteraciones base por patron + variacion aleatoria (±40%)
        const iterBase = [15, 15, 20, 15, 15, 15];
        const base = iterBase[patron];
        const variacion = Math.floor(base * 0.4);
        const iter = base + Rng.nextInt(variacion * 2 + 1) - variacion;
        this._bordeState = {
            patronIdx: patron,
            iteracionesTotal: iter,
            iteracionActual: 0,
            n, danio, filas, columnas,
        };
    }


    // ==================== Tick patron de borde (multi-iteracion) ====================


    _tickBorde() {
        const st = this._bordeState;
        if (!st) return;

        if (st.iteracionActual >= st.iteracionesTotal) {
            this._bordeState = null;
            this._bordeCompletados++;
            return;
        }

        const jugF = Math.round(this.jugador.y);
        const jugC = Math.round(this.jugador.x);

        switch (st.patronIdx) {
            case 0: this._spawnEspiral(st.n, st.danio, st.filas, st.columnas, jugF, jugC); break;
            case 1: this._spawnCortina(st.n, st.danio, st.filas, st.columnas); break;
            case 2: this._spawnEmbudoConvergente(st.n, st.danio, st.filas, st.columnas, jugF, jugC); break;
            case 3: this._spawnDobleEspiralBorde(st.n, st.danio, st.filas, st.columnas, jugF, jugC); break;
            case 4: this._spawnTijerasBorde(st.n, st.danio, st.filas, st.columnas); break;
            case 5: this._spawnLluviaDiagonal(st.n, st.danio, st.filas, st.columnas); break;
        }

        st.iteracionActual++;
    }


    // ==================== Patrones de borde ====================


    _spawnEspiral(n, danio, filas, columnas, jugF, jugC) {
        const numBalas = Math.max(n, 8);
        const radio = Math.floor(Math.max(filas, columnas) / 2) + 3;
        for (let i = 0; i < numBalas; i++) {
            const angulo = this._anguloEspiral + (i * 2 * Math.PI / numBalas);
            const origenF = jugF + Math.round(Math.sin(angulo) * radio);
            const origenC = jugC + Math.round(Math.cos(angulo) * radio);
            const offsetAngulo = angulo + Math.PI + 0.15;
            const destF = jugF + Math.round(Math.sin(offsetAngulo) * 2);
            const destC = jugC + Math.round(Math.cos(offsetAngulo) * 2);
            this._crearBala(origenF, origenC, destF, destC, danio, filas, columnas);
        }
        this._anguloEspiral += 0.3;
    }


    _spawnCortina(n, danio, filas, columnas) {
        const horizontal = Rng.nextDouble() < 0.5;
        const hueco = 2 + Rng.nextInt(3);
        const maxPos = horizontal ? columnas : filas;
        const huecoPos1 = 1 + Rng.nextInt(maxPos - 4);
        const huecoPos2 = 1 + Rng.nextInt(maxPos - 4);
        if (horizontal) {
            for (let c = 0; c < columnas; c += 2) {
                if (c >= huecoPos1 && c < huecoPos1 + hueco) continue;
                this._agregarBalaPool(-1, c, filas + 10, c, danio);
            }
            for (let c = 0; c < columnas; c += 2) {
                if (c >= huecoPos2 && c < huecoPos2 + hueco) continue;
                this._agregarBalaPool(filas, c, -10, c, danio);
            }
        } else {
            for (let f = 0; f < filas; f += 2) {
                if (f >= huecoPos1 && f < huecoPos1 + hueco) continue;
                this._agregarBalaPool(f, -1, f, columnas + 10, danio);
            }
            for (let f = 0; f < filas; f += 2) {
                if (f >= huecoPos2 && f < huecoPos2 + hueco) continue;
                this._agregarBalaPool(f, columnas, f, -10, danio);
            }
        }
    }


    _spawnEmbudoConvergente(n, danio, filas, columnas, jugF, jugC) {
        const edge = Rng.nextInt(4);
        const numBalas = Math.max(n, 10);
        for (let i = 0; i < numBalas; i++) {
            let origenF, origenC;
            const t = (i + 1) / (numBalas + 1);
            switch (edge) {
                case 0: origenF = -1; origenC = Math.floor(columnas * t); break;
                case 1: origenF = filas; origenC = Math.floor(columnas * t); break;
                case 2: origenF = Math.floor(filas * t); origenC = -1; break;
                case 3: origenF = Math.floor(filas * t); origenC = columnas; break;
            }
            const spread = 2;
            const destF = jugF + Rng.nextInt(spread * 2 + 1) - spread;
            const destC = jugC + Rng.nextInt(spread * 2 + 1) - spread;
            this._crearBala(origenF, origenC, destF, destC, danio, filas, columnas);
        }
    }


    _spawnDobleEspiralBorde(n, danio, filas, columnas, jugF, jugC) {
        const numBalas = Math.max(n, 6);
        const radio = Math.floor(Math.max(filas, columnas) / 2) + 3;
        for (let s = 0; s < 2; s++) {
            const offset = s * Math.PI;
            for (let i = 0; i < numBalas; i++) {
                const angulo = this._anguloEspiral + offset + (i * 2 * Math.PI / numBalas);
                const origenF = jugF + Math.round(Math.sin(angulo) * radio);
                const origenC = jugC + Math.round(Math.cos(angulo) * radio);
                this._crearBala(origenF, origenC, jugF, jugC, danio, filas, columnas);
            }
        }
        this._anguloEspiral += 0.25;
    }


    _spawnTijerasBorde(n, danio, filas, columnas) {
        const hueco1 = 2 + Rng.nextInt(3);
        const hueco2 = 2 + Rng.nextInt(3);
        const huecoPos1 = 1 + Rng.nextInt(columnas - 4);
        const huecoPos2 = 1 + Rng.nextInt(filas - 4);
        for (let c = 0; c < columnas; c += 2) {
            if (c >= huecoPos1 && c < huecoPos1 + hueco1) continue;
            this._agregarBalaPool(-1, c, filas + 10, c, danio);
        }
        for (let f = 0; f < filas; f += 2) {
            if (f >= huecoPos2 && f < huecoPos2 + hueco2) continue;
            this._agregarBalaPool(f, -1, f, columnas + 10, danio);
        }
    }


    _spawnLluviaDiagonal(n, danio, filas, columnas) {
        const esquina = Rng.nextInt(4);
        const numBalas = Math.max(n, 12);
        const spread = 1.5;
        for (let i = 0; i < numBalas; i++) {
            let origenF, origenC, destF, destC;
            const offset = Rng.nextDouble() * spread - spread / 2;
            switch (esquina) {
                case 0:
                    origenF = -1 - Rng.nextInt(3); origenC = -1 + Math.floor(i * columnas / numBalas);
                    destF = filas + 10; destC = origenC + filas + Math.round(offset * 3); break;
                case 1:
                    origenF = -1 - Rng.nextInt(3); origenC = columnas + 1 - Math.floor(i * columnas / numBalas);
                    destF = filas + 10; destC = origenC - filas + Math.round(offset * 3); break;
                case 2:
                    origenF = filas + Rng.nextInt(3); origenC = -1 + Math.floor(i * columnas / numBalas);
                    destF = -10; destC = origenC + filas + Math.round(offset * 3); break;
                case 3:
                    origenF = filas + Rng.nextInt(3); origenC = columnas + 1 - Math.floor(i * columnas / numBalas);
                    destF = -10; destC = origenC - filas + Math.round(offset * 3); break;
            }
            this._crearBala(origenF, origenC, destF, destC, danio, filas, columnas);
        }
    }


    // Cascada: inicia el estado, luego _tickCascada dispara 1 oleada por tick
    _spawnCascada(danio, filas, columnas) {
        this._patronHasta = Date.now() + 10 * 1000;
        this._cascadaState = {
            danio,
            filas,
            columnas,
            numHuecos: 5,
            oleadasTotal: 50,
            oleadaActual: 0,
            amplitud: (columnas - 5) / 2 - 2,
            anguloBase: this._cascadaOffset,
        };
    }


    _tickCascada() {
        const st = this._cascadaState;
        if (!st) return;

        if (st.oleadaActual >= st.oleadasTotal) {
            // Cascada terminada, programar la siguiente
            this._cascadaState = null;
            this._cascadaOffset += 2.0;
            this._cascadaProxima = Date.now() + (25 + Rng.nextInt(10)) * 1000;
            this._bordeCompletados++;
            return;
        }

        const o = st.oleadaActual;
        const ang = st.anguloBase + o * 0.08;
        const centro = st.columnas / 2 + Math.sin(ang) * st.amplitud;
        const huecoInicio = Math.round(centro - st.numHuecos / 2);
        const huecoFin = huecoInicio + st.numHuecos;
        const destF = st.filas + 10;

        for (let c = 0; c < st.columnas; c++) {
            if (c >= huecoInicio && c < huecoFin) continue;
            this._agregarBalaPool(-1, c, destF, c, st.danio);
        }

        st.oleadaActual++;
    }


    // ==================== Utilidades ====================


    _crearBala(origenF, origenC, destF, destC, danio, filas, columnas) {
        const df = destF - origenF;
        const dc = destC - origenC;
        const dist = Math.max(Math.abs(df), Math.abs(dc)) || 1;
        const maxDist = Math.max(filas, columnas) + 5;
        const extF = origenF + Math.round(df / dist * maxDist);
        const extC = origenC + Math.round(dc / dist * maxDist);
        const p = _getProyectil(origenF, origenC, extF, extC, danio);
        this.board.agregarProyectil(p);
    }


    _agregarBalaPool(oF, oC, dF, dC, danio) {
        const p = _getProyectil(oF, oC, dF, dC, danio);
        this.board.agregarProyectil(p);
    }
}