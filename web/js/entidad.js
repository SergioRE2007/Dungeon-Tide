import * as Rng from './rng.js';

const HISTORIAL_MAX = 5;
const MOVIMIENTOS = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
];

let contadorId = 0;

export function resetContadorId() {
    contadorId = 0;
}

// ==================== Entidad base ====================

export class Entidad {
    constructor(fila, columna, simbolo, vida) {
        this.id = contadorId++;
        this.fila = fila;
        this.columna = columna;
        this.simbolo = simbolo;
        this.vida = vida;
        this.vidaMax = vida;
        this.danioInfligido = 0;
        this.danioRecibido = 0;
        this.kills = 0;

        // Interpolación de movimiento
        this.filaAnterior = fila;
        this.colAnterior = columna;
        this.moveTimestamp = 0;
        this.hitTimestamp = 0;

        // Historial circular
        this._historialFilas = new Array(HISTORIAL_MAX).fill(0);
        this._historialCols = new Array(HISTORIAL_MAX).fill(0);
        this._historialSize = 0;
        this._historialIdx = 0;
    }

    recibirDanio(danio) {
        this.vida -= danio;
        this.hitTimestamp = performance.now();
        if (this.vida < 0) this.vida = 0;
    }

    estaVivo() {
        return this.vida > 0;
    }

    addDanioRecibido(cantidad) {
        this.danioRecibido += cantidad;
    }

    actuar(board) {
        // Override
    }

    distancia(f1, c1, f2, c2) {
        return Math.abs(f1 - f2) + Math.abs(c1 - c2);
    }

    buscarCercano(tipo, vision, board) {
        let mejor = null;
        let distMin = Infinity;
        for (let df = -vision; df <= vision; df++) {
            for (let dc = -vision; dc <= vision; dc++) {
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f >= 0 && f < board.filas && c >= 0 && c < board.columnas) {
                    const e = board.getEntidad(f, c);
                    if (e !== null && e instanceof tipo) {
                        const dist = this.distancia(this.fila, this.columna, e.fila, e.columna);
                        if (dist < distMin) {
                            distMin = dist;
                            mejor = e;
                        }
                    }
                }
            }
        }
        return mejor;
    }

    moverHacia(destF, destC, board) {
        const movs = this._copiarMovimientos();
        this._ordenarPorDistancia(movs, destF, destC, true);
        this._intentarMovimientos(movs, board);
    }

    moverLejos(enemigoF, enemigoC, board) {
        const movs = this._copiarMovimientos();
        this._ordenarPorDistancia(movs, enemigoF, enemigoC, false);
        this._intentarMovimientos(movs, board);
    }

    moverRandom(board) {
        const movs = this._copiarMovimientos();
        // Fisher-Yates shuffle
        for (let i = movs.length - 1; i > 0; i--) {
            const j = Rng.nextInt(i + 1);
            const tmp = movs[i];
            movs[i] = movs[j];
            movs[j] = tmp;
        }
        this._intentarMovimientos(movs, board);
    }

    _copiarMovimientos() {
        return MOVIMIENTOS.map(m => [m[0], m[1]]);
    }

    _ordenarPorDistancia(movs, objF, objC, ascendente) {
        // Selection sort — port exacto del Java
        for (let i = 0; i < movs.length - 1; i++) {
            let mejorIdx = i;
            let mejorDist = this.distancia(this.fila + movs[i][0], this.columna + movs[i][1], objF, objC);
            for (let j = i + 1; j < movs.length; j++) {
                const dist = this.distancia(this.fila + movs[j][0], this.columna + movs[j][1], objF, objC);
                if (ascendente ? dist < mejorDist : dist > mejorDist) {
                    mejorDist = dist;
                    mejorIdx = j;
                }
            }
            const tmp = movs[i];
            movs[i] = movs[mejorIdx];
            movs[mejorIdx] = tmp;
        }
    }

    _estaEnHistorial(fila, col) {
        for (let i = 0; i < this._historialSize; i++) {
            if (this._historialFilas[i] === fila && this._historialCols[i] === col) return true;
        }
        return false;
    }

    _intentarMovimientos(movs, board) {
        // Primer paso: intentar todo excepto posiciones del historial
        for (const mov of movs) {
            const nf = this.fila + mov[0];
            const nc = this.columna + mov[1];
            if (this._estaEnHistorial(nf, nc)) continue;
            if (this._moverSiPosible(nf, nc, board)) return true;
        }
        // Fallback: permitir volver a posiciones del historial
        for (const mov of movs) {
            const nf = this.fila + mov[0];
            const nc = this.columna + mov[1];
            if (this._estaEnHistorial(nf, nc)) {
                if (this._moverSiPosible(nf, nc, board)) return true;
            }
        }
        return false;
    }

    _moverSiPosible(nuevaFila, nuevaCol, board) {
        if (nuevaFila < 0 || nuevaFila >= board.filas || nuevaCol < 0 || nuevaCol >= board.columnas) {
            return false;
        }

        // Celdas vacias (abismo) son intransitables
        if (board.esVacio && board.esVacio(nuevaFila, nuevaCol)) {
            return false;
        }

        // Aliados detectan trampas y las esquivan
        if (this instanceof Aliado && board.getTrampa(nuevaFila, nuevaCol) !== null) {
            return false;
        }

        const destino = board.getEntidad(nuevaFila, nuevaCol);

        // Enemigo ataca Muro destructible (vida < 9999)
        if (this instanceof Enemigo && destino instanceof Muro && destino.vida < 9999) {
            const danioMuro = this.getDanio();
            this.danioInfligido += danioMuro;
            destino.recibirDanio(danioMuro);
            if (!destino.estaVivo()) {
                board.setEntidad(nuevaFila, nuevaCol, null);
            }
            return false; // no se mueve, solo ataca
        }

        // Enemigo ataca Torre (importada dinámicamente para evitar circular)
        if (this instanceof Enemigo && destino !== null && destino.simbolo === 'R') {
            const danioTorre = this.getDanio();
            this.danioInfligido += danioTorre;
            destino.recibirDanio(danioTorre);
            if (!destino.estaVivo()) {
                board.setEntidad(nuevaFila, nuevaCol, null);
            }
            return false;
        }

        // Enemigo ataca Aliado
        if (this instanceof Enemigo && destino instanceof Aliado) {
            const aliado = destino;
            if (aliado.turnosInvencible > 0) {
                // Aliado invencible: el enemigo muere
                aliado.danioInfligido += this.vida;
                this.danioRecibido += this.vida;
                aliado.kills++;
                this.recibirDanio(this.vida);
                board.setEntidad(this.fila, this.columna, null);
                return false;
            }
            const danioEnemigo = this.getDanio();
            this.danioInfligido += danioEnemigo;
            aliado.danioRecibido += danioEnemigo;
            aliado.recibirDanio(danioEnemigo);
            // Contraataque
            const contraataque = aliado.danioBaseMin + Rng.nextInt(aliado.danioBaseMax - aliado.danioBaseMin + 1) + aliado.danioExtra;
            aliado.danioInfligido += contraataque;
            this.danioRecibido += contraataque;
            this.recibirDanio(contraataque);
            if (!this.estaVivo()) {
                aliado.kills++;
                board.setEntidad(this.fila, this.columna, null);
                return false;
            }
            if (aliado.estaVivo()) {
                return false;
            }
            this.kills++;
            board.setEntidad(nuevaFila, nuevaCol, null);
        }

        // Aliado con estrella ataca Enemigo
        if (this instanceof Aliado && destino instanceof Enemigo) {
            const aliado = this;
            if (aliado.turnosInvencible > 0) {
                aliado.danioInfligido += destino.vida;
                destino.danioRecibido += destino.vida;
                aliado.kills++;
                destino.recibirDanio(destino.vida);
                board.setEntidad(nuevaFila, nuevaCol, null);
            }
        }

        if (board.getEntidad(nuevaFila, nuevaCol) !== null) {
            return false;
        }

        this.filaAnterior = this.fila;
        this.colAnterior = this.columna;
        this.moveTimestamp = performance.now();

        const filaVieja = this.fila;
        const colVieja = this.columna;
        board.setEntidad(filaVieja, colVieja, null);
        this.fila = nuevaFila;
        this.columna = nuevaCol;
        board.setEntidad(nuevaFila, nuevaCol, this);

        // Anadir posicion vieja al historial (circular)
        this._historialFilas[this._historialIdx] = filaVieja;
        this._historialCols[this._historialIdx] = colVieja;
        this._historialIdx = (this._historialIdx + 1) % HISTORIAL_MAX;
        if (this._historialSize < HISTORIAL_MAX) this._historialSize++;
        return true;
    }
}

// ==================== Aliado ====================

export class Aliado extends Entidad {
    constructor(fila, columna, vida, danioBaseMin, danioBaseMax, vision) {
        super(fila, columna, 'A', vida);
        this.vision = vision;
        this.danioBaseMin = danioBaseMin;
        this.danioBaseMax = danioBaseMax;
        this.escudo = 0;
        this.danioExtra = 0;
        this.turnosInvencible = 0;
        this.turnosVelocidad = 0;
        this.objetosRecogidosPersonal = 0;
    }

    addEscudo(cantidad) { this.escudo += cantidad; }
    addDanioExtra(cantidad) { this.danioExtra += cantidad; }
    setTurnosInvencible(turnos) { this.turnosInvencible = turnos; }
    setTurnosVelocidad(turnos) { this.turnosVelocidad = turnos; }
    incrementarObjetosRecogidos() { this.objetosRecogidosPersonal++; }

    curar(cantidad) {
        this.vida = Math.min(this.vida + cantidad, this.vidaMax);
    }

    recibirDanio(danio) {
        if (this.turnosInvencible > 0) return;
        this.hitTimestamp = performance.now();
        if (this.escudo > 0) {
            if (danio <= this.escudo) {
                this.escudo -= danio;
                return;
            } else {
                danio -= this.escudo;
                this.escudo = 0;
            }
        }
        this.vida -= danio;
        if (this.vida < 0) this.vida = 0;
    }

    actuar(board) {
        if (this.turnosVelocidad > 0) this.turnosVelocidad--;

        const movimientos = this.turnosVelocidad > 0 ? 2 : 1;
        for (let m = 0; m < movimientos; m++) {
            if (!this.estaVivo()) break;
            this._realizarMovimiento(board);
        }
    }

    _realizarMovimiento(board) {
        if (this.turnosInvencible > 0) {
            this.turnosInvencible--;
            // Con estrella, perseguir enemigos
            const masCercano = this.buscarCercano(Enemigo, this.vision, board);
            if (masCercano !== null) {
                this.moverHacia(masCercano.fila, masCercano.columna, board);
            } else {
                this.moverRandom(board);
            }
            return;
        }

        const enemigoCerca = this.buscarCercano(Enemigo, this.vision, board);
        const objetoCerca = this._buscarObjetoCercano(board, this.vision);

        if (enemigoCerca === null) {
            if (objetoCerca !== null) {
                this.moverHacia(objetoCerca.fila, objetoCerca.columna, board);
            } else {
                this.moverRandom(board);
            }
        } else {
            // Hay enemigo cerca
            if (objetoCerca !== null && this.distancia(this.fila, this.columna, objetoCerca.fila, objetoCerca.columna) <= 2) {
                const distObjetoEnemigo = this.distancia(objetoCerca.fila, objetoCerca.columna, enemigoCerca.fila, enemigoCerca.columna);
                const distYoEnemigo = this.distancia(this.fila, this.columna, enemigoCerca.fila, enemigoCerca.columna);
                if (distObjetoEnemigo >= distYoEnemigo) {
                    this.moverHacia(objetoCerca.fila, objetoCerca.columna, board);
                } else {
                    this.moverLejos(enemigoCerca.fila, enemigoCerca.columna, board);
                }
            } else {
                this.moverLejos(enemigoCerca.fila, enemigoCerca.columna, board);
            }
        }
    }

    _buscarObjetoCercano(board, vision) {
        let mejor = null;
        let distMin = Infinity;
        for (let df = -vision; df <= vision; df++) {
            for (let dc = -vision; dc <= vision; dc++) {
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f >= 0 && f < board.filas && c >= 0 && c < board.columnas) {
                    if (board.getObjeto(f, c) !== null) {
                        const dist = this.distancia(this.fila, this.columna, f, c);
                        if (dist < distMin) {
                            distMin = dist;
                            mejor = { fila: f, columna: c };
                        }
                    }
                }
            }
        }
        return mejor;
    }
}

// ==================== Enemigo ====================

export class Enemigo extends Entidad {
    constructor(fila, columna, vida, danioMin, danioMax, vision) {
        super(fila, columna, 'X', vida);
        this.danioMin = danioMin;
        this.danioMax = danioMax;
        this.vision = vision;
    }

    getDanio() {
        return this.danioMin + Rng.nextInt(this.danioMax - this.danioMin + 1);
    }

    actuar(board) {
        const masCercano = this.buscarCercano(Aliado, this.vision, board);
        if (masCercano !== null) {
            this.moverHacia(masCercano.fila, masCercano.columna, board);
        } else if (Rng.nextDouble() < 0.3) {
            this.moverRandom(board);
        }
    }
}

// ==================== EnemigoTanque ====================

export class EnemigoTanque extends Enemigo {
    constructor(fila, columna, vida, danioMin, danioMax, vision) {
        super(fila, columna, vida, danioMin, danioMax, vision);
        this.simbolo = 'T';
        this.turnoInterno = 0;
    }

    actuar(board) {
        this.turnoInterno++;
        if (this.turnoInterno % 2 !== 0) return; // solo actua en turnos pares
        super.actuar(board);
    }
}

// ==================== EnemigoRapido ====================

export class EnemigoRapido extends Enemigo {
    constructor(fila, columna, vida, danioMin, danioMax, vision) {
        super(fila, columna, vida, danioMin, danioMax, vision);
        this.simbolo = 'R';
    }

    actuar(board) {
        super.actuar(board);
        if (this.estaVivo()) {
            super.actuar(board);
        }
    }
}

// ==================== Muro ====================

export class Muro extends Entidad {
    constructor(fila, columna, vida = 9999) {
        super(fila, columna, 'M', vida);
    }

    actuar(board) {
        // Los muros no actuan
    }
}
