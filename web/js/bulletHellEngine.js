import { GameBoard } from './gameboard.js';
import { resetContadorId, Proyectil } from './entidad.js';
import { Jugador } from './jugador.js';
import dificultades from './bulletHellConfig.js';
import * as Rng from './rng.js';

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

        // Mago que orbita el mapa y dispara patrones internos
        this.mago = null;

        // Para interfaz compatible con drawBoardOleadas
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
        // NO poner jugador en grid — es off-grid
        this.board.jugadorRef = this.jugador;

        this.gameOver = false;
        this.tiempoInicio = Date.now();
        this.ultimoHitTime = Date.now();
        this.turno = 0;
        this._anguloEspiral = 0;

        // Mago: aparece a los 20s, orbita el mapa
        this.mago = {
            fila: 2,
            columna: 2,
            activo: false,
            anguloOrbita: 0,
            tiempoSpawn: 20, // aparece a los 20s
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

        // Jugador actua (decrementa buffs)
        if (this.jugador.estaVivo()) {
            this.jugador.actuar(this.board);
        }

        // Mover mago
        this._moverMago();

        // Procesar proyectiles (colision con jugador)
        this.board.procesarProyectiles();

        // Detectar si recibio daño para invencibilidad + reset timer curacion
        if (this.jugador.vida < vidaAntes) {
            this.ultimoHitTime = Date.now();
            this.jugador.turnosInvencible = this.config.turnosInvencibleHit;
        }

        // Curacion: si lleva 30s sin recibir daño, curar 1 corazon
        if (this.jugador.estaVivo() && this.jugador.vida < this.jugador.vidaMax) {
            const sinDanio = (Date.now() - this.ultimoHitTime) / 1000;
            if (sinDanio >= this.config.tiempoCuracionSeg) {
                this.jugador.curar(1);
                this.ultimoHitTime = Date.now();
            }
        }

        // Limpiar proyectiles fuera del mapa
        this.board.proyectiles = this.board.proyectiles.filter(p => {
            const f = Math.round(p.fila);
            const c = Math.round(p.columna);
            return f >= -5 && f < this.board.filas + 5
                && c >= -5 && c < this.board.columnas + 5;
        });

        // Game over
        if (!this.jugador.estaVivo()) {
            this.gameOver = true;
            this.tiempoFinal = Date.now();
        }
    }

    // ==================== Mago ====================

    _moverMago() {
        const t = this.getTiempoSegundos();
        if (t < this.mago.tiempoSpawn) {
            this.mago.activo = false;
            return;
        }
        this.mago.activo = true;

        // Orbita eliptica por el interior del mapa
        const { filas, columnas } = this.board;
        const centroF = filas / 2;
        const centroC = columnas / 2;
        const radioF = filas * 0.35;
        const radioC = columnas * 0.35;

        // Velocidad de orbita aumenta con el tiempo
        const vel = 0.008 + t * 0.00005;
        this.mago.anguloOrbita += vel;

        this.mago.fila = centroF + Math.sin(this.mago.anguloOrbita) * radioF;
        this.mago.columna = centroC + Math.cos(this.mago.anguloOrbita * 0.7) * radioC;
    }

    // ==================== Spawn ====================

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

        // Patrones de borde (siempre disponibles, escalan con tiempo)
        const patronesBorde = t < 10 ? 5 : 7;
        const patron = Rng.nextInt(patronesBorde);

        switch (patron) {
            case 0: this._spawnEspiral(n, danio, filas, columnas, jugF, jugC); break;
            case 1: this._spawnCortina(n, danio, filas, columnas); break;
            case 2: this._spawnCruz(n, danio, filas, columnas, jugF, jugC); break;
            case 3: this._spawnOndaSinusoidal(n, danio, filas, columnas); break;
            case 4: this._spawnEmbudoConvergente(n, danio, filas, columnas, jugF, jugC); break;
            case 5: this._spawnDobleEspiralBorde(n, danio, filas, columnas, jugF, jugC); break;
            case 6: this._spawnTijerasBorde(n, danio, filas, columnas); break;
        }
    }

    // Spawn de patrones del mago (llamado desde su propio timer)
    spawnMago() {
        if (this.gameOver || !this.mago.activo) return;

        const n = this.getBalasPerSpawn();
        const danio = this.getDanioBala();
        const { filas, columnas } = this.board;
        const mF = Math.round(this.mago.fila);
        const mC = Math.round(this.mago.columna);
        const t = this.getTiempoSegundos();

        const patronesMago = t < 40 ? 3 : 4;
        const patron = Rng.nextInt(patronesMago);

        switch (patron) {
            case 0: this._spawnAnilloMago(n, danio, filas, columnas, mF, mC); break;
            case 1: this._spawnEstrellaMago(n, danio, filas, columnas, mF, mC); break;
            case 2: this._spawnRafagaMago(n, danio, filas, columnas, mF, mC); break;
            case 3: this._spawnEspiralMago(n, danio, filas, columnas, mF, mC); break;
        }
    }

    // ==================== Patrones de borde ====================

    // Espiral convergente desde fuera hacia el jugador
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

    // Cortina de balas paralelas con hueco
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
                const p = new Proyectil(origenF, c, destF, c, danio, null, false, 0);
                this.board.agregarProyectil(p);
            }
        } else {
            const fromLeft = Rng.nextDouble() < 0.5;
            const origenC = fromLeft ? -1 : columnas;
            const destC = fromLeft ? columnas + 10 : -10;
            for (let f = 0; f < filas; f += 2) {
                if (f >= huecoPos && f < huecoPos + hueco) continue;
                const p = new Proyectil(f, origenC, f, destC, danio, null, false, 0);
                this.board.agregarProyectil(p);
            }
        }
    }

    // Cruz rotatoria de 4 brazos desde bordes
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

    // Onda sinusoidal cruzando el mapa
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
                const p = new Proyectil(ondaF, origenC, ondaF, destC, danio, null, false, 0);
                this.board.agregarProyectil(p);
            }
        } else {
            const baseC = Math.floor(columnas / 2);
            for (let f = 0; f < filas; f += 2) {
                const ondaC = baseC + Math.round(amplitud * Math.sin(frecuencia * f + fase));
                const origenF = fromStart ? -1 - f : filas + f;
                const destF = fromStart ? filas + 10 : -10;
                const p = new Proyectil(origenF, ondaC, destF, ondaC, danio, null, false, 0);
                this.board.agregarProyectil(p);
            }
        }
    }

    // Embudo convergente desde un borde completo
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

    // Dos espirales desde bordes opuestos convergiendo al jugador
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

    // Tijeras: dos cortinas cruzadas desde bordes perpendiculares
    _spawnTijerasBorde(n, danio, filas, columnas) {
        const hueco1 = 2 + Rng.nextInt(3);
        const hueco2 = 2 + Rng.nextInt(3);
        const huecoPos1 = 1 + Rng.nextInt(columnas - 4);
        const huecoPos2 = 1 + Rng.nextInt(filas - 4);

        // Cortina horizontal
        const fromTop = Rng.nextDouble() < 0.5;
        const origenF = fromTop ? -1 : filas;
        const destF = fromTop ? filas + 10 : -10;
        for (let c = 0; c < columnas; c += 3) {
            if (c >= huecoPos1 && c < huecoPos1 + hueco1) continue;
            const p = new Proyectil(origenF, c, destF, c, danio, null, false, 0);
            this.board.agregarProyectil(p);
        }

        // Cortina vertical
        const fromLeft = Rng.nextDouble() < 0.5;
        const origenC = fromLeft ? -1 : columnas;
        const destC = fromLeft ? columnas + 10 : -10;
        for (let f = 0; f < filas; f += 3) {
            if (f >= huecoPos2 && f < huecoPos2 + hueco2) continue;
            const p = new Proyectil(f, origenC, f, destC, danio, null, false, 0);
            this.board.agregarProyectil(p);
        }
    }

    // ==================== Patrones del mago ====================

    // Anillo expandiendose desde el mago
    _spawnAnilloMago(n, danio, filas, columnas, mF, mC) {
        const numBalas = Math.max(n, 12);
        const dist = Math.max(filas, columnas) * 2;

        for (let i = 0; i < numBalas; i++) {
            const angulo = (i * 2 * Math.PI) / numBalas;
            const destF = mF + Math.round(Math.sin(angulo) * dist);
            const destC = mC + Math.round(Math.cos(angulo) * dist);
            const p = new Proyectil(mF, mC, destF, destC, danio, null, false, 0);
            this.board.agregarProyectil(p);
        }
    }

    // Estrella de puntas desde el mago
    _spawnEstrellaMago(n, danio, filas, columnas, mF, mC) {
        const puntas = 5 + Rng.nextInt(4);
        const balasPerPunta = Math.max(Math.floor(n / puntas), 2);
        const rotacion = this._anguloEspiral;

        for (let p = 0; p < puntas; p++) {
            const anguloPunta = rotacion + (p * 2 * Math.PI / puntas);
            for (let i = 0; i < balasPerPunta; i++) {
                const offsetAng = (i - balasPerPunta / 2) * 0.08;
                const angulo = anguloPunta + offsetAng;
                const dist = Math.max(filas, columnas) * 2;
                const destF = mF + Math.round(Math.sin(angulo) * dist);
                const destC = mC + Math.round(Math.cos(angulo) * dist);
                const proj = new Proyectil(mF, mC, destF, destC, danio, null, false, 0);
                this.board.agregarProyectil(proj);
            }
        }
        this._anguloEspiral += 0.15;
    }

    // Rafaga dirigida al jugador desde el mago
    _spawnRafagaMago(n, danio, filas, columnas, mF, mC) {
        const jugF = Math.round(this.jugador.y);
        const jugC = Math.round(this.jugador.x);
        const numBalas = Math.max(n, 5);
        const anguloBase = Math.atan2(jugF - mF, jugC - mC);
        const apertura = Math.PI * 0.4;

        for (let i = 0; i < numBalas; i++) {
            const t = numBalas === 1 ? 0 : (i / (numBalas - 1)) - 0.5;
            const angulo = anguloBase + t * apertura;
            const dist = Math.max(filas, columnas) * 2;
            const destF = mF + Math.round(Math.sin(angulo) * dist);
            const destC = mC + Math.round(Math.cos(angulo) * dist);
            const p = new Proyectil(mF, mC, destF, destC, danio, null, false, 0);
            this.board.agregarProyectil(p);
        }
    }

    // Espiral continua saliendo del mago
    _spawnEspiralMago(n, danio, filas, columnas, mF, mC) {
        const numBalas = Math.max(n, 10);
        const dist = Math.max(filas, columnas) * 2;

        for (let i = 0; i < numBalas; i++) {
            const angulo = this._anguloEspiral + (i * 2 * Math.PI / numBalas);
            const destF = mF + Math.round(Math.sin(angulo) * dist);
            const destC = mC + Math.round(Math.cos(angulo) * dist);
            const p = new Proyectil(mF, mC, destF, destC, danio, null, false, 0);
            this.board.agregarProyectil(p);
        }
        this._anguloEspiral += 0.35;
    }

    // ==================== Utilidades ====================

    _crearBala(origenF, origenC, destF, destC, danio, filas, columnas) {
        const df = destF - origenF;
        const dc = destC - origenC;
        const dist = Math.max(Math.abs(df), Math.abs(dc)) || 1;
        const maxDist = Math.max(filas, columnas) * 2;
        const extF = origenF + Math.round(df / dist * maxDist);
        const extC = origenC + Math.round(dc / dist * maxDist);
        const p = new Proyectil(origenF, origenC, extF, extC, danio, null, false, 0);
        this.board.agregarProyectil(p);
    }
}
