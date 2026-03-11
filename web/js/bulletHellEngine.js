import { GameBoard } from './gameboard.js';
import { resetContadorId, Proyectil } from './entidad.js';
import { Jugador } from './jugador.js';
import bulletHellConfig from './bulletHellConfig.js';
import * as Rng from './rng.js';

export class BulletHellEngine {
    constructor(config = null) {
        this.config = config || bulletHellConfig;
        this.board = null;
        this.jugador = null;
        this.gameOver = false;
        this.tiempoInicio = 0;
        this.tiempoFinal = null;
        this.turno = 0;

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

        // Mapa completamente limpio — sin vacios, sin bordes
        // (las balas aparecen desde fuera)

        // Jugador en el centro
        const cf = Math.floor(filas / 2);
        const cc = Math.floor(columnas / 2);

        this.jugador = new Jugador(cf, cc, 'bullethell', this.config.clases);
        this.board.setEntidad(cf, cc, this.jugador);

        this.gameOver = false;
        this.tiempoInicio = Date.now();
        this.turno = 0;
    }

    getTiempoSegundos() {
        const fin = this.tiempoFinal || Date.now();
        return (fin - this.tiempoInicio) / 1000;
    }

    tick() {
        if (this.gameOver) return;
        this.turno++;

        // Jugador actua (decrementa buffs)
        if (this.jugador.estaVivo()) {
            this.jugador.actuar(this.board);
        }

        // Procesar proyectiles (colision con jugador)
        this.board.procesarProyectiles();

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

    getDanioBala() {
        const t = this.getTiempoSegundos();
        return Math.floor(this.config.danioBala + t * this.config.danioIncrementoCadaSeg);
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
        const ciclos = t / 5; // cada 5 segundos reduce
        const intervalo = this.config.intervaloSpawnMs *
            Math.pow(1 - this.config.intervaloReduccionPct, ciclos);
        return Math.max(this.config.intervaloMinMs, intervalo);
    }

    spawnBalas() {
        if (this.gameOver) return;

        const n = this.getBalasPerSpawn();
        const danio = this.getDanioBala();
        const { filas, columnas } = this.board;
        const jugF = this.jugador.fila;
        const jugC = this.jugador.columna;

        // Elegir patron aleatorio
        const patron = Rng.nextInt(4);

        switch (patron) {
            case 0: this._spawnBordes(n, danio, filas, columnas, jugF, jugC); break;
            case 1: this._spawnRafaga(n, danio, filas, columnas, jugF, jugC); break;
            case 2: this._spawnAbanico(n, danio, filas, columnas, jugF, jugC); break;
            case 3: this._spawnLinea(n, danio, filas, columnas); break;
        }
    }

    // Balas aleatorias desde bordes apuntando al jugador
    _spawnBordes(n, danio, filas, columnas, jugF, jugC) {
        for (let i = 0; i < n; i++) {
            const { f, c } = this._posicionBorde(filas, columnas);
            // Apuntar al jugador con offset aleatorio
            const offsetF = Rng.nextInt(5) - 2;
            const offsetC = Rng.nextInt(5) - 2;
            const destF = jugF + offsetF;
            const destC = jugC + offsetC;
            this._crearBala(f, c, destF, destC, danio, filas, columnas);
        }
    }

    // Ráfaga desde un borde en línea
    _spawnRafaga(n, danio, filas, columnas, jugF, jugC) {
        const edge = Rng.nextInt(4);
        for (let i = 0; i < n; i++) {
            let origenF, origenC;
            switch (edge) {
                case 0: origenF = 0; origenC = Math.floor(columnas * (i + 1) / (n + 1)); break;
                case 1: origenF = filas - 1; origenC = Math.floor(columnas * (i + 1) / (n + 1)); break;
                case 2: origenF = Math.floor(filas * (i + 1) / (n + 1)); origenC = 0; break;
                case 3: origenF = Math.floor(filas * (i + 1) / (n + 1)); origenC = columnas - 1; break;
            }
            this._crearBala(origenF, origenC, jugF, jugC, danio, filas, columnas);
        }
    }

    // Abanico desde un punto
    _spawnAbanico(n, danio, filas, columnas, jugF, jugC) {
        const { f: origenF, c: origenC } = this._posicionBorde(filas, columnas);
        const anguloBase = Math.atan2(jugF - origenF, jugC - origenC);
        const apertura = Math.PI * 0.6; // 108 grados

        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0 : (i / (n - 1)) - 0.5;
            const angulo = anguloBase + t * apertura;
            const dist = Math.max(filas, columnas) * 2;
            const destF = Math.round(origenF + Math.sin(angulo) * dist);
            const destC = Math.round(origenC + Math.cos(angulo) * dist);
            const p = new Proyectil(origenF, origenC, destF, destC, danio, null, false, 0);
            this.board.agregarProyectil(p);
        }
    }

    // Línea horizontal o vertical cruzando el mapa
    _spawnLinea(n, danio, filas, columnas) {
        const horizontal = Rng.nextDouble() < 0.5;
        if (horizontal) {
            const f = 1 + Rng.nextInt(filas - 2);
            const fromLeft = Rng.nextDouble() < 0.5;
            for (let i = 0; i < n; i++) {
                const c = fromLeft ? -i * 2 : columnas + i * 2;
                const destC = fromLeft ? columnas + 10 : -10;
                const p = new Proyectil(f, c, f, destC, danio, null, false, 0);
                this.board.agregarProyectil(p);
            }
        } else {
            const c = 1 + Rng.nextInt(columnas - 2);
            const fromTop = Rng.nextDouble() < 0.5;
            for (let i = 0; i < n; i++) {
                const f = fromTop ? -i * 2 : filas + i * 2;
                const destF = fromTop ? filas + 10 : -10;
                const p = new Proyectil(f, c, destF, c, danio, null, false, 0);
                this.board.agregarProyectil(p);
            }
        }
    }

    _posicionBorde(filas, columnas) {
        const edge = Rng.nextInt(4);
        switch (edge) {
            case 0: return { f: 0, c: Rng.nextInt(columnas) };
            case 1: return { f: filas - 1, c: Rng.nextInt(columnas) };
            case 2: return { f: Rng.nextInt(filas), c: 0 };
            case 3: return { f: Rng.nextInt(filas), c: columnas - 1 };
        }
    }

    _crearBala(origenF, origenC, destF, destC, danio, filas, columnas) {
        // Extender destino para que la bala cruce todo el mapa
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
