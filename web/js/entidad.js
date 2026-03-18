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

// Helpers de tipo — eliminan cadenas de || repetidas en todo el código
const TIPOS_ALIADO = new Set(['ALIADO', 'GUERRERO', 'ARQUERO', 'ESQUELETO']);
const TIPOS_ENEMIGO = new Set(['ENEMIGO', 'ENEMIGO_TANQUE', 'ENEMIGO_RAPIDO', 'ENEMIGO_MAGO']);

export function esAliado(tipo) { return TIPOS_ALIADO.has(tipo); }
export function esEnemigo(tipo) { return TIPOS_ENEMIGO.has(tipo); }

// Genera trayectoria interpolada entre dos puntos (Chebyshev)
export function generarTrayectoria(origenF, origenC, destinoF, destinoC) {
    const trayectoria = [];
    const pasos = Math.max(Math.abs(destinoF - origenF), Math.abs(destinoC - origenC));
    for (let i = 1; i <= pasos; i++) {
        const t = i / pasos;
        trayectoria.push({
            f: Math.round(origenF + (destinoF - origenF) * t),
            c: Math.round(origenC + (destinoC - origenC) * t)
        });
    }
    return trayectoria;
}

// ==================== Entidad base ====================

export class Entidad {
    constructor(fila, columna, simbolo, vida, tipo = 'ENTIDAD') {
        this.id = contadorId++;
        this.fila = fila;
        this.columna = columna;
        this.simbolo = simbolo;
        this.vida = vida;
        this.vidaMax = vida;
        this.danioInfligido = 0;
        this.danioRecibido = 0;
        this.kills = 0;
        this.tipo = tipo; // Tipo para evitar instanceof checks

        // Coordenadas continuas (centro de la celda)
        this.x = columna + 0.5;
        this.y = fila + 0.5;
        this.hitboxRadius = 0.4;

        // Interpolación de movimiento
        this.filaAnterior = fila;
        this.colAnterior = columna;
        this.moveTimestamp = 0;
        this.hitTimestamp = 0;

        // Historial circular con Set (O(1) lookups)
        this._historialSet = new Set();
    }

    static colisionaCirculos(x1, y1, r1, x2, y2, r2) {
        return Math.hypot(x1 - x2, y1 - y2) < r1 + r2;
    }

    recibirDanio(danio) {
        this.vida -= danio;
        this.hitTimestamp = performance.now();
        this.ultimoDanio = danio;
        if (this.vida < 0) this.vida = 0;
    }

    estaVivo() {
        return this.vida > 0;
    }

    addDanioRecibido(cantidad) {
        this.danioRecibido += cantidad;
    }

    actuar(board) {
        // Override en subclases
    }

    distancia(f1, c1, f2, c2) {
        return Math.abs(f1 - f2) + Math.abs(c1 - c2);
    }

    buscarCercano(tipo, vision, board) {
        let mejor = null;
        let distMin = Infinity;

        // Si hay jugador off-grid y buscamos aliados, considerarlo como candidato
        if (board.jugadorRef && board.jugadorRef.estaVivo() && board.jugadorRef instanceof tipo) {
            const dist = this.distancia(this.fila, this.columna,
                Math.floor(board.jugadorRef.y), Math.floor(board.jugadorRef.x));
            if (dist <= vision && dist < distMin) {
                distMin = dist;
                mejor = board.jugadorRef;
            }
        }

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


        if (Rng.nextDouble() < 0.3) {
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
    }

    _copiarMovimientos() {
        return MOVIMIENTOS.map(m => [m[0], m[1]]);
    }

    _ordenarPorDistancia(movs, objF, objC, ascendente) {
        movs.sort((m1, m2) => {
            const dist1 = this.distancia(this.fila + m1[0], this.columna + m1[1], objF, objC);
            const dist2 = this.distancia(this.fila + m2[0], this.columna + m2[1], objF, objC);
            return ascendente ? dist1 - dist2 : dist2 - dist1;
        });
    }

    _estaEnHistorial(fila, col) {
        return this._historialSet.has(`${fila},${col}`);
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
        if (esAliado(this.tipo) && board.getTrampa(nuevaFila, nuevaCol) !== null) {
            return false;
        }

        const destino = board.getEntidad(nuevaFila, nuevaCol);
        const esEnem = esEnemigo(this.tipo);

        // Enemigo ataca Muro destructible (vida < 9999)
        if (esEnem && destino?.tipo === 'MURO' && destino.vida < 9999) {
            const danioMuro = this.getDanio();
            this.danioInfligido += danioMuro;
            destino.recibirDanio(danioMuro);
            // No eliminar aquí, dejar que tick() se encargue
            return false; // no se mueve, solo ataca
        }

        // Enemigo ataca Torre (importada dinámicamente para evitar circular)
        if (esEnem && destino !== null && destino.simbolo === 'R') {
            const danioTorre = this.getDanio();
            this.danioInfligido += danioTorre;
            destino.recibirDanio(danioTorre);
            // No eliminar aquí, dejar que tick() se encargue
            return false;
        }

        // Enemigo ataca Aliado (incluye esqueletos invocados)
        if (esEnem && esAliado(destino?.tipo)) {
            const aliado = destino;
            if (aliado.turnosInvencible > 0) {
                // Aliado invencible: el enemigo muere
                aliado.danioInfligido += this.vida;
                this.danioRecibido += this.vida;
                aliado.kills++;
                this.recibirDanio(this.vida);
                return false; // Eliminar será manejado en tick()
            }
            const danioEnemigo = this.getDanio();
            this.danioInfligido += danioEnemigo;
            aliado.danioRecibido += danioEnemigo;
            aliado.recibirDanio(danioEnemigo);
            // Contraataque
            const contraataque = aliado.getDanio();
            aliado.danioInfligido += contraataque;
            this.danioRecibido += contraataque;
            this.recibirDanio(contraataque);
            if (!this.estaVivo()) {
                aliado.kills++;
                return false; // Eliminar será manejado en tick()
            }
            if (aliado.estaVivo()) {
                return false;
            }
            this.kills++;
            return false; // Enemigo no se mueve, se queda peleando. Eliminar aliado será manejado en tick()
        }

        // Aliado ataca Enemigo (incluye esqueletos invocados)
        if (esAliado(this.tipo) && esEnemigo(destino?.tipo)) {
            const aliado = this;
            if (aliado.turnosInvencible > 0) {
                // Invencible: mata instantaneamente
                aliado.danioInfligido += destino.vida;
                destino.danioRecibido += destino.vida;
                aliado.kills++;
                destino.recibirDanio(destino.vida);
                return false; // Eliminar será manejado en tick()
            } else {
                // Combate normal: aliado golpea, enemigo contraataca
                const danioAliado = aliado.getDanio();
                aliado.danioInfligido += danioAliado;
                destino.danioRecibido += danioAliado;
                destino.recibirDanio(danioAliado);
                // Contraataque del enemigo
                const contraataque = destino.getDanio();
                destino.danioInfligido += contraataque;
                aliado.danioRecibido += contraataque;
                aliado.recibirDanio(contraataque);
                // No eliminar aquí, dejar que tick() se encargue
                return false; // no se mueve, se queda peleando
            }
        }

        if (board.getEntidad(nuevaFila, nuevaCol) !== null) {
            return false;
        }

        // Guardar posición anterior para interpolación suave
        this.filaAnterior = this.fila;
        this.colAnterior = this.columna;
        this.moveTimestamp = performance.now();

        const filaVieja = this.fila;
        const colVieja = this.columna;
        board.setEntidad(filaVieja, colVieja, null);
        this.fila = nuevaFila;
        this.columna = nuevaCol;
        this.x = nuevaCol + 0.5;
        this.y = nuevaFila + 0.5;
        board.setEntidad(nuevaFila, nuevaCol, this);

        // Agregar posicion vieja al historial (Set)
        this._historialSet.add(`${filaVieja},${colVieja}`);
        if (this._historialSet.size > HISTORIAL_MAX) {
            const arr = Array.from(this._historialSet);
            this._historialSet = new Set(arr.slice(-HISTORIAL_MAX));
        }
        return true;
    }
}

// ==================== Aliado ====================

export class Aliado extends Entidad {
    constructor(fila, columna, vida, danioBaseMin, danioBaseMax, vision) {
        super(fila, columna, 'A', vida, 'ALIADO');
        this.vision = vision;
        this.danioBaseMin = danioBaseMin;
        this.danioBaseMax = danioBaseMax;
        this.escudo = 0;
        this.danioExtra = 0;
        this.turnosInvencible = 0;
        this.turnosVelocidad = 0;
        this.objetosRecogidosPersonal = 0;
    }

    getDanio() {
        return this.danioBaseMin + Rng.nextInt(this.danioBaseMax - this.danioBaseMin + 1) + this.danioExtra;
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
        }

        // Perseguir enemigos (con o sin estrella)
        const enemigoCerca = this.buscarCercano(Enemigo, this.vision, board);
        const objetoCerca = this._buscarObjetoCercano(board, this.vision);

        if (enemigoCerca !== null) {
            // Hay enemigo: ir a por el (el combate ocurre en _moverSiPosible)
            this.moverHacia(enemigoCerca.fila, enemigoCerca.columna, board);
        } else if (objetoCerca !== null) {
            this.moverHacia(objetoCerca.fila, objetoCerca.columna, board);
        } else {
            this.moverRandom(board);
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
        super(fila, columna, 'X', vida, 'ENEMIGO');
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
        } else {
            this.moverRandom(board);
        }
    }
}

// ==================== EnemigoTanque ====================

export class EnemigoTanque extends Enemigo {
    constructor(fila, columna, vida, danioMin, danioMax, vision) {
        super(fila, columna, vida, danioMin, danioMax, vision);
        this.tipo = 'ENEMIGO_TANQUE';
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
        this.tipo = 'ENEMIGO_RAPIDO';
        this.simbolo = 'R';
    }

    actuar(board) {
        super.actuar(board);
    }
}

// ==================== EnemigoMago ====================

export class EnemigoMago extends Enemigo {
    constructor(fila, columna, vida, danioMin, danioMax, vision, rango) {
        super(fila, columna, vida, danioMin, danioMax, vision);
        this.tipo = 'ENEMIGO_MAGO';
        this.simbolo = 'W'; // W de Wizard
        this.rango = rango || 5;
        this.cooldownMax = 3;
        this.cooldownActual = 0;
        this.ultimoObjetivo = null;
        this.pendingAnim = null;
    }

    actuar(board) {
        if (this.cooldownActual > 0) this.cooldownActual--;

        const masCercano = this.buscarCercano(Aliado, this.vision, board);

        if (masCercano !== null) {
            const dist = this.distancia(this.fila, this.columna, masCercano.fila, masCercano.columna);
            this.ultimoObjetivo = masCercano;

            // Disparar si esta en rango
            if (dist <= this.rango && this.cooldownActual === 0) {
                this._dispararA(masCercano, board);
            }

            // Mantener distancia: alejarse si muy cerca, acercarse si muy lejos
            if (dist <= 2) {
                this.moverLejos(masCercano.fila, masCercano.columna, board);
            } else if (dist > this.rango) {
                this.moverHacia(masCercano.fila, masCercano.columna, board);
            }
        } else {
            this.ultimoObjetivo = null;
            this.moverRandom(board);
        }
    }

    _dispararA(objetivo, board) {
        this.cooldownActual = this.cooldownMax;
        const danio = this.getDanio();

        const proyectil = new Proyectil(
            this.fila, this.columna,
            objetivo.fila, objetivo.columna,
            danio, this,
            false, // buscaEnemigos = false (ataca aliados)
            1      // radioExplosion = 1 → explota en área 3x3
        );
        board.agregarProyectil(proyectil);
        // Visual: se renderiza via _dibujarProyectiles (no pendingAnim)
    }
}

// ==================== AliadoGuerrero ====================

export class AliadoGuerrero extends Aliado {
    constructor(fila, columna, vida, danioMin, danioMax, vision) {
        super(fila, columna, vida, danioMin, danioMax, vision);
        this.tipo = 'GUERRERO';
        this.simbolo = 'G';
        this.cooldownEspada = 3;
        this.cooldownAtaque = 0;
        this.ultimoObjetivo = null; // para calcular angulo del arma
        this.pendingAnim = null; // animacion pendiente para el renderer
    }

    _realizarMovimiento(board) {
        if (this.turnosInvencible > 0) {
            this.turnosInvencible--;
        }
        if (this.cooldownAtaque > 0) this.cooldownAtaque--;

        const enemigoCerca = this.buscarCercano(Enemigo, this.vision, board);

        if (enemigoCerca !== null) {
            const dist = this.distancia(this.fila, this.columna, enemigoCerca.fila, enemigoCerca.columna);
            this.ultimoObjetivo = enemigoCerca;

            if (dist <= 2 && this.cooldownAtaque === 0) {
                // Ataque de espada: golpea las 8 celdas adyacentes
                this._atacarEspada(board, enemigoCerca);
            } else {
                // Moverse hacia el enemigo
                this.moverHacia(enemigoCerca.fila, enemigoCerca.columna, board);
            }
        } else {
            this.ultimoObjetivo = null;
            const objetoCerca = this._buscarObjetoCercano(board, this.vision);
            if (objetoCerca !== null) {
                this.moverHacia(objetoCerca.fila, objetoCerca.columna, board);
            } else {
                this.moverRandom(board);
            }
        }
    }

    _atacarEspada(board, objetivo) {
        this.cooldownAtaque = this.cooldownEspada;
        const angulo = Math.atan2(objetivo.fila - this.fila, objetivo.columna - this.columna);
        const celdasAfectadas = [];

        for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;

                celdasAfectadas.push({ f, c });
                const e = board.getEntidad(f, c);
                if (esEnemigo(e?.tipo)) {
                    const danio = this.getDanio();
                    this.danioInfligido += danio;
                    e.danioRecibido += danio;
                    e.recibirDanio(danio);
                    if (!e.estaVivo()) {
                        this.kills++;
                        board.setEntidad(f, c, null);
                    }
                }
            }
        }

        this.pendingAnim = { tipo: 'swing', celdas: celdasAfectadas, angulo };
    }
}

// ==================== AliadoArquero ====================

export class AliadoArquero extends Aliado {
    constructor(fila, columna, vida, danioMin, danioMax, vision, rango) {
        super(fila, columna, vida, danioMin, danioMax, vision);
        this.tipo = 'ARQUERO';
        this.simbolo = 'B'; // B de Bow
        this.rango = rango || 5;
        this.cooldownMax = 2;
        this.cooldownActual = 0;
        this.ultimoObjetivo = null; // para angulo del arma
        this.pendingAnim = null; // animacion pendiente para el renderer
    }

    _realizarMovimiento(board) {
        if (this.turnosInvencible > 0) {
            this.turnosInvencible--;
        }

        if (this.cooldownActual > 0) this.cooldownActual--;

        const enemigoCerca = this.buscarCercano(Enemigo, this.vision, board);

        if (enemigoCerca !== null) {
            const dist = this.distancia(this.fila, this.columna, enemigoCerca.fila, enemigoCerca.columna);
            this.ultimoObjetivo = enemigoCerca;

            // Intentar disparar si esta en rango
            if (dist <= this.rango && this.cooldownActual === 0) {
                this._dispararA(enemigoCerca, board);
            }

            // Si esta demasiado cerca, alejarse un poco; si esta lejos, acercarse
            if (dist <= 2) {
                this.moverLejos(enemigoCerca.fila, enemigoCerca.columna, board);
            } else if (dist > this.rango) {
                this.moverHacia(enemigoCerca.fila, enemigoCerca.columna, board);
            }
            // Si esta en rango optimo (3-rango), no se mueve
        } else {
            this.ultimoObjetivo = null;
            const objetoCerca = this._buscarObjetoCercano(board, this.vision);
            if (objetoCerca !== null) {
                this.moverHacia(objetoCerca.fila, objetoCerca.columna, board);
            } else {
                this.moverRandom(board);
            }
        }
    }

    _dispararA(objetivo, board) {
        this.cooldownActual = this.cooldownMax;
        const danio = this.getDanio();
        this.danioInfligido += danio;
        objetivo.danioRecibido += danio;
        objetivo.recibirDanio(danio);

        this.pendingAnim = {
            tipo: 'flecha',
            origen: { f: this.fila, c: this.columna },
            trayectoria: generarTrayectoria(this.fila, this.columna, objetivo.fila, objetivo.columna)
        };

        if (!objetivo.estaVivo()) {
            this.kills++;
            board.setEntidad(objetivo.fila, objetivo.columna, null);
        }
    }
}

// ==================== AliadoEsqueleto ====================

export class AliadoEsqueleto extends Aliado {
    constructor(fila, columna, vida, danioMin, danioMax, vision) {
        super(fila, columna, vida, danioMin, danioMax, vision);
        this.tipo = 'ESQUELETO';
        this.simbolo = 'S';
    }

    _realizarMovimiento(board) {
        if (this.turnosInvencible > 0) this.turnosInvencible--;

        // Perseguir enemigos
        const enemigoCerca = this.buscarCercano(Enemigo, this.vision, board);
        if (enemigoCerca !== null) {
            this.moverHacia(enemigoCerca.fila, enemigoCerca.columna, board);
            return;
        }

        // No hay enemigos: seguir al jugador
        if (board.jugadorRef && board.jugadorRef.estaVivo()) {
            const jf = Math.floor(board.jugadorRef.y);
            const jc = Math.floor(board.jugadorRef.x);
            const dist = this.distancia(this.fila, this.columna, jf, jc);
            if (dist > 2) {
                this.moverHacia(jf, jc, board);
            }
            // Si ya está cerca (dist <= 2), quedarse quieto
            return;
        }

        this.moverRandom(board);
    }
}

// ==================== Muro ====================

export class Muro extends Entidad {
    constructor(fila, columna, vida = 9999) {
        super(fila, columna, 'M', vida, 'MURO');
    }

    actuar(board) {
        // Los muros no actuan
    }
}

// ==================== Proyectil ====================

export class Proyectil {
    constructor(origenF, origenC, destinoF, destinoC, danio, atacante = null, buscaEnemigos = false, radioExplosion = 0) {
        this.origenF = origenF;
        this.origenC = origenC;
        this.destinoF = destinoF;
        this.destinoC = destinoC;
        this.danio = danio;
        this.atacante = atacante;
        this.buscaEnemigos = buscaEnemigos;
        this.radioExplosion = radioExplosion; // 0 = daño directo, >0 = explota en área

        // Calcular trayectoria (como el arquero: distancia de Chebyshev)
        const pasos = Math.max(Math.abs(destinoF - origenF), Math.abs(destinoC - origenC));
        this.pasos = Math.max(pasos, 1);
        this.paso = 0; // paso actual (0 a pasos)
        this._pasoFrac = 0; // acumulador fraccionario para ralentización

        // Posición actual interpolada
        this.fila = origenF;
        this.columna = origenC;

        // Impactó con algo
        this.impactado = false;
        this.impactoF = null;
        this.impactoC = null;

        // Para interpolación visual suave
        this._prevTickTime = null;
        this._lastTickTime = performance.now();
    }

    actualizar(factor = 1) {
        this._pasoFrac += factor;
        if (this._pasoFrac < 1) return true; // aún no avanza un paso entero

        const avance = Math.floor(this._pasoFrac);
        this._pasoFrac -= avance;
        this.paso += avance;

        // Solo actualizar tick times cuando realmente avanza (para interpolación visual)
        this._prevTickTime = this._lastTickTime;
        this._lastTickTime = performance.now();

        if (this.paso > this.pasos) {
            return false;
        }

        const t = this.paso / this.pasos;
        this.fila = Math.round(this.origenF + (this.destinoF - this.origenF) * t);
        this.columna = Math.round(this.origenC + (this.destinoC - this.origenC) * t);

        return true;
    }

    registrarImpacto(f, c) {
        this.impactado = true;
        this.impactoF = f;
        this.impactoC = c;
    }

    haTerminado() {
        return this.paso > this.pasos || this.impactado;
    }

    reiniciar(origenF, origenC, destinoF, destinoC, danio) {
        this.origenF = origenF;
        this.origenC = origenC;
        this.destinoF = destinoF;
        this.destinoC = destinoC;
        this.danio = danio;
        this.atacante = null;
        this.buscaEnemigos = false;
        this.radioExplosion = 0;
        const pasos = Math.max(Math.abs(destinoF - origenF), Math.abs(destinoC - origenC));
        this.pasos = Math.max(pasos, 1);
        this.paso = 0;
        this._pasoFrac = 0;
        this.fila = origenF;
        this.columna = origenC;
        this.impactado = false;
        this.impactoF = null;
        this.impactoC = null;
        this._prevTickTime = null;
        this._lastTickTime = performance.now();
    }
}
