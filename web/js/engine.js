import * as Rng from './rng.js';
import { resetContadorId, Aliado, Enemigo, EnemigoMago, Muro, AliadoGuerrero, AliadoArquero } from './entidad.js';
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
        this.todasEntidades = this.board.entidadesActivas.slice();
        this.numAliadosInicial = this.todasEntidades.filter(e =>
            e.tipo === 'ALIADO' || e.tipo === 'GUERRERO' || e.tipo === 'ARQUERO'
        ).length;
        this.numEnemigosInicial = this.todasEntidades.filter(e =>
            e.tipo === 'ENEMIGO' || e.tipo === 'ENEMIGO_MAGO' || e.tipo === 'ENEMIGO_TANQUE' || e.tipo === 'ENEMIGO_RAPIDO'
        ).length;
    }

    tick() {
        this.turno++;

        // Usar lista de entidades activas (O(n) en lugar de O(n²))
        const entidades = this.board.entidadesActivas.slice();

        for (const e of entidades) {
            if (this.board.getEntidad(e.fila, e.columna) !== e) continue;
            e.actuar(this.board);
        }

        // Dano por trampas
        for (const e of entidades) {
            const trampa = this.board.getTrampa(e.fila, e.columna);
            if (trampa !== null && e.tipo !== 'MURO') {
                const danioTrampa = trampa.getDanio();
                e.addDanioRecibido(danioTrampa);
                e.recibirDanio(danioTrampa);
            }
        }

        // Recogida de objetos por aliados
        for (const e of entidades) {
            if ((e.tipo === 'ALIADO' || e.tipo === 'GUERRERO' || e.tipo === 'ARQUERO') && e.estaVivo()) {
                const objeto = this.board.getObjeto(e.fila, e.columna);
                if (objeto !== null) {
                    objeto.aplicar(e);
                    this.board.setObjeto(e.fila, e.columna, null);
                    e.incrementarObjetosRecogidos();
                    this.objetosRecogidos++;
                }
            }
        }

        // Eliminar entidades muertas del tablero
        const entidasMuertas = [];
        for (const e of entidades) {
            if (!e.estaVivo() && e.tipo !== 'MURO') {
                if (e.tipo === 'ENEMIGO' || e.tipo === 'ENEMIGO_MAGO' || e.tipo === 'ENEMIGO_TANQUE' || e.tipo === 'ENEMIGO_RAPIDO') {
                    this.enemigosEliminados++;
                }
                this.board.setEntidad(e.fila, e.columna, null);
                entidasMuertas.push(e);
            }
        }
        // Remover entidades muertas de la lista activa
        for (const e of entidasMuertas) {
            this.board.removeEntidadActiva(e);
        }

        // Spawn de objeto aleatorio cada N turnos (0 = desactivado)
        if (this.config.turnosSpawnObjeto > 0 && this.turno % this.config.turnosSpawnObjeto === 0) {
            this.board.spawnObjetoRandom(this.config);
        }

        // Contar entidades
        this.numAliados = 0;
        this.numEnemigos = 0;
        for (const e of this.board.entidadesActivas) {
            if (e.tipo === 'ALIADO' || e.tipo === 'GUERRERO' || e.tipo === 'ARQUERO') {
                this.numAliados++;
            } else if (e.tipo === 'ENEMIGO' || e.tipo === 'ENEMIGO_MAGO' || e.tipo === 'ENEMIGO_TANQUE' || e.tipo === 'ENEMIGO_RAPIDO') {
                this.numEnemigos++;
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
