import * as Rng from './rng.js';
import { resetContadorId, Aliado, Enemigo, Muro } from './entidad.js';
import { GameBoard } from './gameboard.js';

export class GameEngine {
    constructor(config) {
        this.config = config;
        this.board = null;
        this.turno = 0;
        this.enemigosEliminados = 0;
        this.objetosRecogidos = 0;
        this.numAliados = 0;
        this.numEnemigos = 0;
        this.numAliadosInicial = 0;
        this.numEnemigosInicial = 0;
        this.tiempoInicio = 0;
        this.resultado = null;
        this.todasEntidades = [];
    }

    inicializar() {
        resetContadorId();
        Rng.setSeed(this.config.semilla);

        this.board = new GameBoard(this.config.filas, this.config.columnas);
        this.board.colocarBordes();
        this.board.generarMapa(this.config);
        this.board.colocarEntidades(this.config);
        this.board.generarObjetos(this.config);
        this.board.generarTrampas(this.config.numTrampa, this.config.danioTrampa);

        this.turno = 0;
        this.enemigosEliminados = 0;
        this.objetosRecogidos = 0;
        this.tiempoInicio = Date.now();

        // Guardar referencia a todas las entidades para stats post-partida
        this.todasEntidades = [];
        this.numAliadosInicial = 0;
        this.numEnemigosInicial = 0;
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const e = this.board.getEntidad(f, c);
                if (e instanceof Aliado) {
                    this.todasEntidades.push(e);
                    this.numAliadosInicial++;
                } else if (e instanceof Enemigo) {
                    this.todasEntidades.push(e);
                    this.numEnemigosInicial++;
                }
            }
        }
    }

    tick() {
        this.turno++;

        // Recoger todas las entidades ANTES de moverlas
        const entidades = [];
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const e = this.board.getEntidad(f, c);
                if (e instanceof Enemigo || e instanceof Aliado) {
                    entidades.push(e);
                }
            }
        }

        for (const e of entidades) {
            if (this.board.getEntidad(e.fila, e.columna) !== e) continue;
            e.actuar(this.board);
        }

        // Dano por trampas
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const eTrampa = this.board.getEntidad(f, c);
                if (eTrampa !== null && this.board.getTrampa(f, c) !== null
                    && !(eTrampa instanceof Muro)) {
                    const danioTrampa = this.board.getTrampa(f, c).getDanio();
                    eTrampa.addDanioRecibido(danioTrampa);
                    eTrampa.recibirDanio(danioTrampa);
                }
            }
        }

        // Recogida de objetos por aliados
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                if (this.board.getEntidad(f, c) instanceof Aliado && this.board.getObjeto(f, c) !== null) {
                    const aliadoObj = this.board.getEntidad(f, c);
                    this.board.getObjeto(f, c).aplicar(aliadoObj);
                    this.board.setObjeto(f, c, null);
                    aliadoObj.incrementarObjetosRecogidos();
                    this.objetosRecogidos++;
                }
            }
        }

        // Eliminar entidades muertas del tablero
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const e = this.board.getEntidad(f, c);
                if (e !== null && !e.estaVivo() && !(e instanceof Muro)) {
                    if (e instanceof Enemigo) this.enemigosEliminados++;
                    this.board.setEntidad(f, c, null);
                }
            }
        }

        // Spawn de objeto aleatorio cada N turnos (0 = desactivado)
        if (this.config.turnosSpawnObjeto > 0 && this.turno % this.config.turnosSpawnObjeto === 0) {
            this.board.spawnObjetoRandom(this.config);
        }

        // Contar entidades
        this.numAliados = 0;
        this.numEnemigos = 0;
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const e = this.board.getEntidad(f, c);
                if (e instanceof Aliado) this.numAliados++;
                else if (e instanceof Enemigo) this.numEnemigos++;
            }
        }

        // Comprobar fin de partida (solo si no es modo libre)
        if (!this.config.modoLibre) {
            if (this.numAliados === 0 && this.numEnemigos === 0) {
                this.resultado = "empate";
            } else if (this.numAliados === 0) {
                this.resultado = "enemigos";
            } else if (this.numEnemigos === 0) {
                this.resultado = "aliados";
            }
        }
    }

    haTerminado() {
        return this.resultado !== null;
    }
}
