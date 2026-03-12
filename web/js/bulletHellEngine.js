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

const STEP = Math.PI / 24;   // ~7.5° por tick — suave visualmente a 150ms/tick
const PATRON_DURACION_SEG = 5;
const TOTAL_PATRONES = 8;

// ==================== Engine ====================

export class BulletHellEngine {
    constructor(config = null) {
        this.config = config || dificultades.normal;
        this.board = null;
        this.jugador = null;
        this.gameOver = false;
        this.tiempoInicio = 0;
        this.tiempoFinal = null;
        this.turno = 0;
        this.ultimoHitTime = 0;
        this._anguloEspiral = 0;

        this.mago = null;
        this._magoState = null;

        // Interfaz compatible con drawBoardOleadas
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
        this._anguloEspiral = 0;

        this.mago = {
            fila: cf,
            columna: cc,
            activo: false,
            anguloOrbita: 0,
            tiempoSpawn: this.config.magoSpawnSeg,
            apariciones: 0,
        };

        this._magoState = {
            patronIdx: 0,
            patronTick: 0,
            angulo: 0,
            direccion: 1,
            velocidad: 1,
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

        // Ciclo del mago (aparece/desaparece)
        this._cicloMago();

        // Mago dispara cada tick cuando activo
        if (this.mago.activo) {
            this._magoDisparar();
        }

        this.board.procesarProyectiles();

        if (this.jugador.vida < vidaAntes) {
            this.ultimoHitTime = Date.now();
            this.jugador.turnosInvencible = this.config.turnosInvencibleHit;
        }

        // Curacion
        if (this.jugador.estaVivo() && this.jugador.vida < this.jugador.vidaMax) {
            const sinDanio = (Date.now() - this.ultimoHitTime) / 1000;
            if (sinDanio >= this.config.tiempoCuracionSeg) {
                this.jugador.curar(1);
                this.ultimoHitTime = Date.now();
            }
        }

        // Limpiar proyectiles fuera del mapa (devolver al pool)
        const viejos = this.board.proyectiles;
        const nuevos = [];
        for (let i = 0; i < viejos.length; i++) {
            const p = viejos[i];
            const f = Math.round(p.fila);
            const c = Math.round(p.columna);
            if (f >= -5 && f < this.board.filas + 5
                && c >= -5 && c < this.board.columnas + 5) {
                nuevos.push(p);
            } else {
                _reciclar(p);
            }
        }
        this.board.proyectiles = nuevos;

        if (!this.jugador.estaVivo()) {
            this.gameOver = true;
            this.tiempoFinal = Date.now();
        }
    }

    // ==================== Ciclo del mago ====================
    // Aparece en el centro, se queda un rato disparando, se va.
    // Cuando se va vuelven las balas de pared. Luego vuelve.

    _cicloMago() {
        const t = this.getTiempoSegundos();
        const mago = this.mago;

        if (t < mago.tiempoSpawn) {
            mago.activo = false;
            return;
        }

        const duracion = this.config.magoDuracionSeg;
        const pausa = this.config.magoPausaSeg;
        const cicloTotal = duracion + pausa;
        const tDesdeFirstSpawn = t - mago.tiempoSpawn;
        const tEnCiclo = tDesdeFirstSpawn % cicloTotal;
        const nuevaAparicion = Math.floor(tDesdeFirstSpawn / cicloTotal) + 1;

        const estabaActivo = mago.activo;

        if (tEnCiclo < duracion) {
            // Mago activo — en el centro con movimiento flotante suave
            mago.activo = true;
            mago.apariciones = nuevaAparicion;

            const { filas, columnas } = this.board;
            const centroF = filas / 2;
            const centroC = columnas / 2;
            // Flotacion suave alrededor del centro
            const floatF = Math.sin(t * 0.5) * 2;
            const floatC = Math.cos(t * 0.35) * 3;
            mago.fila = centroF + floatF;
            mago.columna = centroC + floatC;

            // Reset state al empezar nueva aparicion
            if (!estabaActivo) {
                this._magoState.patronIdx = 0;
                this._magoState.patronTick = 0;
                this._magoState.angulo = 0;
                this._magoState.direccion = 1;
                this._magoState.velocidad = 1;
            }
        } else {
            // Mago inactivo — vuelven las balas de pared
            mago.activo = false;
        }
    }

    // ==================== Mago disparo (cada tick) ====================

    _getBalasAnillo() {
        // Escala con apariciones del mago
        const base = this.config.magoBalasAnillo;
        const max = this.config.magoBalasAnilloMax;
        const extra = (this.mago.apariciones - 1) * 2;
        return Math.min(max, base + extra);
    }

    _magoDisparar() {
        const st = this._magoState;
        const ticksPorPatron = Math.round(PATRON_DURACION_SEG * 1000 / this.config.velocidadMs);

        st.patronTick++;

        if (st.patronTick > ticksPorPatron) {
            st.patronIdx = (st.patronIdx + 1) % TOTAL_PATRONES;
            st.patronTick = 0;
            st.angulo = 0;
            st.direccion = 1;
            st.velocidad = 1;
        }

        const danio = this.getDanioBala();
        const mF = Math.round(this.mago.fila);
        const mC = Math.round(this.mago.columna);
        const dist = Math.max(this.board.filas, this.board.columnas) * 2;
        const n = this._getBalasAnillo();

        switch (st.patronIdx) {
            case 0: this._patronEspiralSimple(st, mF, mC, dist, danio, n); break;
            case 1: this._patronEspiralPendular(st, mF, mC, dist, danio, n); break;
            case 2: this._patronEspiralPendularDoble(st, mF, mC, dist, danio, n); break;
            case 3: this._patronEspiralCaotica(st, mF, mC, dist, danio, n); break;
            case 4: this._patronEspiralAceleradaPendular(st, mF, mC, dist, danio, n); break;
            case 5: this._patronCruzPendular(st, mF, mC, dist, danio, n); break;
            case 6: this._patronCruzAlternanteBrusca(st, mF, mC, dist, danio, n); break;
            case 7: this._patronCruzRafagas3(st, mF, mC, dist, danio, n); break;
        }
    }

    // ==================== 8 Patrones del mago ====================

    // 0: Espiral simple — anillo completo que rota +15° por tick siempre
    _patronEspiralSimple(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += STEP;
    }

    // 1: Espiral pendular — anillo completo, rota +15° hasta 180° luego -15°
    _patronEspiralPendular(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += st.direccion * STEP;
        if (st.angulo >= Math.PI) { st.angulo = Math.PI; st.direccion = -1; }
        if (st.angulo <= 0) { st.angulo = 0; st.direccion = 1; }
    }

    // 2: Espiral pendular doble — 2 anillos desfasados 180° barriendo
    _patronEspiralPendularDoble(st, mF, mC, dist, danio, n) {
        const half = Math.max(Math.floor(n / 2), 8);
        for (let i = 0; i < half; i++) {
            const base = (i * 2 * Math.PI / half);
            this._disparar(mF, mC, st.angulo + base, dist, danio);
            this._disparar(mF, mC, st.angulo + base + Math.PI, dist, danio);
        }
        st.angulo += st.direccion * STEP;
        if (st.angulo >= Math.PI) { st.angulo = Math.PI; st.direccion = -1; }
        if (st.angulo <= 0) { st.angulo = 0; st.direccion = 1; }
    }

    // 3: Espiral caotica — anillo completo, invierte rotacion aleatoriamente
    _patronEspiralCaotica(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += st.direccion * STEP;
        if (Rng.nextInt(6) === 0) st.direccion *= -1;
    }

    // 4: Espiral acelerada pendular — barre cada vez mas rapido, reset al volver
    _patronEspiralAceleradaPendular(st, mF, mC, dist, danio, n) {
        for (let i = 0; i < n; i++) {
            const angulo = st.angulo + (i * 2 * Math.PI / n);
            this._disparar(mF, mC, angulo, dist, danio);
        }
        st.angulo += st.direccion * STEP * st.velocidad;
        if (st.angulo >= Math.PI) { st.angulo = Math.PI; st.direccion = -1; }
        if (st.angulo <= 0) { st.angulo = 0; st.direccion = 1; st.velocidad = 1; }
        st.velocidad += 0.06;
    }

    // 5: Cruz pendular — 4 brazos densos (+) barren ±22.5° oscilando
    _patronCruzPendular(st, mF, mC, dist, danio, n) {
        const balasPerBrazo = Math.max(Math.floor(n / 4), 3);
        const sweep = Math.sin(st.patronTick * 0.15) * (Math.PI / 8);
        const spreadTotal = 0.12; // spread angular por brazo

        for (let b = 0; b < 4; b++) {
            const anguloBase = b * (Math.PI / 2) + sweep;
            for (let i = 0; i < balasPerBrazo; i++) {
                const offset = (i / (balasPerBrazo - 1) - 0.5) * spreadTotal;
                this._disparar(mF, mC, anguloBase + offset, dist, danio);
            }
        }
    }

    // 6: Cruz alternante brusca — salta de + a X cada 1 segundo
    _patronCruzAlternanteBrusca(st, mF, mC, dist, danio, n) {
        const balasPerBrazo = Math.max(Math.floor(n / 4), 3);
        const ticksPerSeg = Math.round(1000 / this.config.velocidadMs);
        const esX = (Math.floor(st.patronTick / ticksPerSeg) % 2) === 1;
        const offsetCruz = esX ? Math.PI / 4 : 0;
        const spreadTotal = 0.1;

        for (let b = 0; b < 4; b++) {
            const anguloBase = b * (Math.PI / 2) + offsetCruz;
            for (let i = 0; i < balasPerBrazo; i++) {
                const offset = (i / (balasPerBrazo - 1) - 0.5) * spreadTotal;
                this._disparar(mF, mC, anguloBase + offset, dist, danio);
            }
        }
    }

    // 7: Cruz con rafagas de 3 — 3 ticks disparo denso, pausa, repite. Cruz rota lento.
    _patronCruzRafagas3(st, mF, mC, dist, danio, n) {
        const ciclo = st.patronTick % 7;
        if (ciclo < 3) {
            const balasPerBrazo = Math.max(Math.floor(n / 4), 3);
            const spreadTotal = 0.15;
            for (let b = 0; b < 4; b++) {
                const anguloBase = st.angulo + b * (Math.PI / 2);
                for (let i = 0; i < balasPerBrazo; i++) {
                    const offset = (i / (balasPerBrazo - 1) - 0.5) * spreadTotal;
                    this._disparar(mF, mC, anguloBase + offset, dist, danio);
                }
            }
        }
        st.angulo += STEP * 0.5;
    }

    // ==================== Disparar bala (pool) ====================

    _disparar(mF, mC, angulo, dist, danio) {
        const destF = mF + Math.round(Math.sin(angulo) * dist);
        const destC = mC + Math.round(Math.cos(angulo) * dist);
        const p = _getProyectil(mF, mC, destF, destC, danio);
        this.board.agregarProyectil(p);
    }

    // ==================== Balas de borde (pre-mago y pausas) ====================

    getDanioBala() {
        return this.config.danioBala;
    }

    getBalasPerSpawn() {
        const t = this.getTiempoSegundos();
        return Math.min(
            this.config.balasMaxPerSpawn,
            Math.floor(this.config.balasPerSpawn + t * this.config.balasIncrementoCadaSeg)
        );
    }

    getIntervaloSpawn() {
        const t = this.getTiempoSegundos();
        const ciclos = t / 5;
        const intervalo = this.config.intervaloSpawnMs *
            Math.pow(1 - this.config.intervaloReduccionPct, ciclos);
        return Math.max(this.config.intervaloMinMs, intervalo);
    }

    spawnBalas() {
        if (this.gameOver) return;

        const n = this.getBalasPerSpawn();
        const danio = this.getDanioBala();
        const { filas, columnas } = this.board;
        const jugF = Math.round(this.jugador.y);
        const jugC = Math.round(this.jugador.x);
        const t = this.getTiempoSegundos();

        const patronesBorde = t < 10 ? 6 : 10;
        const patron = Rng.nextInt(patronesBorde);

        switch (patron) {
            case 0: this._spawnEspiral(n, danio, filas, columnas, jugF, jugC); break;
            case 1: this._spawnCortina(n, danio, filas, columnas); break;
            case 2: this._spawnCruz(n, danio, filas, columnas, jugF, jugC); break;
            case 3: this._spawnOndaSinusoidal(n, danio, filas, columnas); break;
            case 4: this._spawnEmbudoConvergente(n, danio, filas, columnas, jugF, jugC); break;
            case 5: this._spawnDobleEspiralBorde(n, danio, filas, columnas, jugF, jugC); break;
            case 6: this._spawnTijerasBorde(n, danio, filas, columnas); break;
            case 7: this._spawnLluviaDiagonal(n, danio, filas, columnas); break;
            case 8: this._spawnCercoTotal(n, danio, filas, columnas, jugF, jugC); break;
            case 9: this._spawnZigzagBorde(n, danio, filas, columnas); break;
        }
    }

    // ==================== Patrones de borde ====================

    _spawnEspiral(n, danio, filas, columnas, jugF, jugC) {
        const numBalas = Math.max(n, 8);
        const radio = Math.max(filas, columnas);
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
        const huecoPos = horizontal
            ? 1 + Rng.nextInt(columnas - 4)
            : 1 + Rng.nextInt(filas - 4);
        if (horizontal) {
            const fromTop = Rng.nextDouble() < 0.5;
            const origenF = fromTop ? -1 : filas;
            const destF = fromTop ? filas + 10 : -10;
            for (let c = 0; c < columnas; c += 2) {
                if (c >= huecoPos && c < huecoPos + hueco) continue;
                this._agregarBalaPool(origenF, c, destF, c, danio);
            }
        } else {
            const fromLeft = Rng.nextDouble() < 0.5;
            const origenC = fromLeft ? -1 : columnas;
            const destC = fromLeft ? columnas + 10 : -10;
            for (let f = 0; f < filas; f += 2) {
                if (f >= huecoPos && f < huecoPos + hueco) continue;
                this._agregarBalaPool(f, origenC, f, destC, danio);
            }
        }
    }

    _spawnCruz(n, danio, filas, columnas, jugF, jugC) {
        const brazos = 4;
        const balasPerBrazo = Math.max(Math.floor(n / brazos), 3);
        const anguloBase = this._anguloEspiral * 0.5;
        for (let b = 0; b < brazos; b++) {
            const anguloBrazo = anguloBase + (b * Math.PI / 2);
            const radio = Math.max(filas, columnas);
            for (let i = 0; i < balasPerBrazo; i++) {
                const spread = (i - balasPerBrazo / 2) * 0.06;
                const ang = anguloBrazo + spread;
                const origenF = jugF + Math.round(Math.sin(ang) * radio);
                const origenC = jugC + Math.round(Math.cos(ang) * radio);
                this._crearBala(origenF, origenC, jugF, jugC, danio, filas, columnas);
            }
        }
        this._anguloEspiral += 0.2;
    }

    _spawnOndaSinusoidal(n, danio, filas, columnas) {
        const horizontal = Rng.nextDouble() < 0.5;
        const amplitud = 3 + Rng.nextInt(3);
        const frecuencia = 0.3 + Rng.nextDouble() * 0.4;
        const fase = Rng.nextDouble() * Math.PI * 2;
        const fromStart = Rng.nextDouble() < 0.5;
        if (horizontal) {
            const baseF = Math.floor(filas / 2);
            for (let c = 0; c < columnas; c += 2) {
                const ondaF = baseF + Math.round(amplitud * Math.sin(frecuencia * c + fase));
                const origenC = fromStart ? -1 - c : columnas + c;
                const destC = fromStart ? columnas + 10 : -10;
                this._agregarBalaPool(ondaF, origenC, ondaF, destC, danio);
            }
        } else {
            const baseC = Math.floor(columnas / 2);
            for (let f = 0; f < filas; f += 2) {
                const ondaC = baseC + Math.round(amplitud * Math.sin(frecuencia * f + fase));
                const origenF = fromStart ? -1 - f : filas + f;
                const destF = fromStart ? filas + 10 : -10;
                this._agregarBalaPool(origenF, ondaC, destF, ondaC, danio);
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
        const radio = Math.max(filas, columnas);
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
        const fromTop = Rng.nextDouble() < 0.5;
        const origenF = fromTop ? -1 : filas;
        const destF = fromTop ? filas + 10 : -10;
        for (let c = 0; c < columnas; c += 3) {
            if (c >= huecoPos1 && c < huecoPos1 + hueco1) continue;
            this._agregarBalaPool(origenF, c, destF, c, danio);
        }
        const fromLeft = Rng.nextDouble() < 0.5;
        const origenC = fromLeft ? -1 : columnas;
        const destC = fromLeft ? columnas + 10 : -10;
        for (let f = 0; f < filas; f += 3) {
            if (f >= huecoPos2 && f < huecoPos2 + hueco2) continue;
            this._agregarBalaPool(f, origenC, f, destC, danio);
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

    _spawnCercoTotal(n, danio, filas, columnas, jugF, jugC) {
        const huecoSize = 3;
        for (let c = 0; c < columnas; c += 2) {
            if (Math.abs(c - jugC) < huecoSize) continue;
            this._agregarBalaPool(-1, c, filas + 10, c, danio);
        }
        for (let c = 1; c < columnas; c += 2) {
            if (Math.abs(c - jugC) < huecoSize) continue;
            this._agregarBalaPool(filas, c, -10, c, danio);
        }
        for (let f = 0; f < filas; f += 2) {
            if (Math.abs(f - jugF) < huecoSize) continue;
            this._agregarBalaPool(f, -1, f, columnas + 10, danio);
        }
        for (let f = 1; f < filas; f += 2) {
            if (Math.abs(f - jugF) < huecoSize) continue;
            this._agregarBalaPool(f, columnas, f, -10, danio);
        }
    }

    _spawnZigzagBorde(n, danio, filas, columnas) {
        const horizontal = Rng.nextDouble() < 0.5;
        const numBalas = Math.max(n, 8);
        const fromStart = Rng.nextDouble() < 0.5;
        const amplitude = 4 + Rng.nextInt(4);
        if (horizontal) {
            for (let i = 0; i < numBalas; i++) {
                const baseF = Math.floor(filas * (i + 1) / (numBalas + 1));
                const zigzag = (i % 2 === 0) ? amplitude : -amplitude;
                const origenC = fromStart ? -1 : columnas;
                const destC = fromStart ? columnas + 10 : -10;
                this._agregarBalaPool(baseF - zigzag, origenC, baseF + zigzag, destC, danio);
            }
        } else {
            for (let i = 0; i < numBalas; i++) {
                const baseC = Math.floor(columnas * (i + 1) / (numBalas + 1));
                const zigzag = (i % 2 === 0) ? amplitude : -amplitude;
                const origenF = fromStart ? -1 : filas;
                const destF = fromStart ? filas + 10 : -10;
                this._agregarBalaPool(origenF, baseC - zigzag, destF, baseC + zigzag, danio);
            }
        }
    }

    // ==================== Utilidades ====================

    _crearBala(origenF, origenC, destF, destC, danio, filas, columnas) {
        const df = destF - origenF;
        const dc = destC - origenC;
        const dist = Math.max(Math.abs(df), Math.abs(dc)) || 1;
        const maxDist = Math.max(filas, columnas) * 2;
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
