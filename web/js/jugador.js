import { Aliado, Enemigo, Muro } from './entidad.js';

const DIRS_WASD = {
    w: [-1, 0],
    s: [1, 0],
    a: [0, -1],
    d: [0, 1],
};

export class Jugador extends Aliado {
    constructor(fila, columna, idClase, configClases) {
        const statsBase = configClases[idClase] || configClases['guerrero']; // fallback
        super(fila, columna, statsBase.vida, statsBase.danio, statsBase.danio, 8); // vision 8 (hardcode o configBase)
        
        this.simbolo = 'J';
        this.dinero = 0;
        this.idClase = idClase;
        
        // Asignar stats base
        this.armaActual = statsBase.arma;
        this.cooldownEspada = statsBase.arma === 'espada' ? statsBase.cooldownAtaque : 99;
        this.cooldownArco = 0;
        this.danioArco = statsBase.arma === 'arco' ? statsBase.danio : 3;
        this.rangoArco = statsBase.arma === 'arco' ? statsBase.rango : 5;
        this.velocidadMoverMs = statsBase.velocidadMoverMs || 100;
        
        this.cooldownAtaque = 0;
        this.direccion = [0, 1]; // ultima dir WASD (default: derecha)
    }

    // Override — el jugador no tiene IA, solo decrementa cooldowns
    actuar(board) {
        if (this.turnosInvencible > 0) this.turnosInvencible--;
        if (this.turnosVelocidad > 0) this.turnosVelocidad--;
        if (this.cooldownAtaque > 0) this.cooldownAtaque--;
    }

    moverWASD(tecla, board) {
        const dir = DIRS_WASD[tecla];
        if (!dir) return false;
        this.direccion = dir;
        const nf = this.fila + dir[0];
        const nc = this.columna + dir[1];
        return this._moverSiPosible(nf, nc, board);
    }

    moverDir(df, dc, board) {
        if (df === 0 && dc === 0) return false;
        // Normalizar a -1/0/1
        const ndf = Math.sign(df);
        const ndc = Math.sign(dc);
        this.direccion = [ndf, ndc];
        const nf = this.fila + ndf;
        const nc = this.columna + ndc;
        return this._moverSiPosible(nf, nc, board);
    }

    atacarEspada(board) {
        if (this.cooldownAtaque > 0) return [];
        this.cooldownAtaque = this.cooldownEspada;

        const kills = [];
        // 8 celdas adyacentes
        for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                const e = board.getEntidad(f, c);
                if (e instanceof Enemigo) {
                    const danio = this.danioBaseMin + Math.floor(Math.random() * (this.danioBaseMax - this.danioBaseMin + 1)) + this.danioExtra;
                    this.danioInfligido += danio;
                    e.recibirDanio(danio);
                    if (!e.estaVivo()) {
                        this.kills++;
                        board.setEntidad(f, c, null);
                        kills.push(e);
                    }
                }
            }
        }
        return kills;
    }

    // Ataque en arco de 3 celdas hacia la dirección del mouse
    atacarEspadaArco(angulo, board) {
        if (this.cooldownAtaque > 0) return { kills: [], celdasAfectadas: [] };
        this.cooldownAtaque = this.cooldownEspada;

        // Las 8 celdas adyacentes con su ángulo respecto al jugador
        const adyacentes = [];
        for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                const angCelda = Math.atan2(df, dc);
                // Diferencia angular normalizada a [-PI, PI]
                let diff = angCelda - angulo;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                adyacentes.push({ f, c, df, dc, diff: Math.abs(diff) });
            }
        }

        // Ordenar por cercanía angular y tomar las 3 más cercanas
        adyacentes.sort((a, b) => a.diff - b.diff);
        const seleccionadas = adyacentes.slice(0, 3);

        // Dirección central del arco (la celda más alineada con el mouse)
        const dirF = seleccionadas[0].df;
        const dirC = seleccionadas[0].dc;

        // Extender cada celda 1 casilla más en la dirección central
        const extensiones = [];
        for (const celda of seleccionadas) {
            const fExt = celda.f + dirF;
            const cExt = celda.c + dirC;
            if (fExt >= 0 && fExt < board.filas && cExt >= 0 && cExt < board.columnas) {
                extensiones.push({ f: fExt, c: cExt });
            }
        }
        for (const ext of extensiones) seleccionadas.push(ext);

        const kills = [];
        const celdasAfectadas = [];

        for (const celda of seleccionadas) {
            celdasAfectadas.push({ f: celda.f, c: celda.c });
            const e = board.getEntidad(celda.f, celda.c);
            if (e instanceof Enemigo) {
                const danio = this.danioBaseMin + Math.floor(Math.random() * (this.danioBaseMax - this.danioBaseMin + 1)) + this.danioExtra;
                this.danioInfligido += danio;
                e.recibirDanio(danio);
                if (!e.estaVivo()) {
                    this.kills++;
                    board.setEntidad(celda.f, celda.c, null);
                    kills.push(e);
                }
            }
        }

        return { kills, celdasAfectadas };
    }

    atacarArco(board, angulo) {
        // Arco no usa cooldown — dispara tan rápido como el jugador clicke

        // Bresenham: trazar línea desde el jugador en cualquier ángulo
        const kills = [];
        const trayectoria = [];

        if (angulo !== undefined) {
            // Punto destino lejano en la dirección del ángulo
            const destF = this.fila + Math.sin(angulo) * (this.rangoArco + 1);
            const destC = this.columna + Math.cos(angulo) * (this.rangoArco + 1);
            const celdas = this._bresenham(this.fila, this.columna, Math.round(destF), Math.round(destC));

            for (const [f, c] of celdas) {
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) break;
                if (board.esVacio && board.esVacio(f, c)) break;
                if (trayectoria.length >= this.rangoArco) break;

                trayectoria.push({ f, c });

                const e = board.getEntidad(f, c);
                if (e instanceof Muro) break;

                if (e instanceof Enemigo) {
                    const danio = this.danioArco + this.danioExtra;
                    this.danioInfligido += danio;
                    e.recibirDanio(danio);
                    if (!e.estaVivo()) {
                        this.kills++;
                        board.setEntidad(f, c, null);
                        kills.push(e);
                    }
                    // No hacemos `break` para que la flecha atraviese y siga golpeando
                }
            }
        } else {
            // Fallback: dirección WASD (8 dirs)
            const [df, dc] = this.direccion;
            for (let i = 1; i <= this.rangoArco; i++) {
                const f = this.fila + df * i;
                const c = this.columna + dc * i;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) break;
                if (board.esVacio && board.esVacio(f, c)) break;

                trayectoria.push({ f, c });

                const e = board.getEntidad(f, c);
                if (e instanceof Muro) break;

                if (e instanceof Enemigo) {
                    const danio = this.danioArco + this.danioExtra;
                    this.danioInfligido += danio;
                    e.recibirDanio(danio);
                    if (!e.estaVivo()) {
                        this.kills++;
                        board.setEntidad(f, c, null);
                        kills.push(e);
                    }
                    // Sin `break` aquí tampoco
                }
            }
        }
        return { kills, trayectoria };
    }

    // Bresenham line: devuelve celdas entre (f0,c0) y (f1,c1), excluyendo origen
    _bresenham(f0, c0, f1, c1) {
        const celdas = [];
        let df = Math.abs(f1 - f0);
        let dc = Math.abs(c1 - c0);
        const sf = f0 < f1 ? 1 : -1;
        const sc = c0 < c1 ? 1 : -1;
        let err = df - dc;
        let f = f0, c = c0;

        while (true) {
            const e2 = 2 * err;
            if (e2 > -dc) { err -= dc; f += sf; }
            if (e2 < df) { err += df; c += sc; }
            if (f === f0 && c === c0) continue; // saltar origen
            celdas.push([f, c]);
            if (f === f1 && c === c1) break;
            if (celdas.length > 20) break; // safety
        }
        return celdas;
    }

    atacar(board) {
        if (this.armaActual === 'espada') {
            return this.atacarEspada(board);
        } else {
            return this.atacarArco(board);
        }
    }

    cambiarArma() {
        // Bloqueado temporalmente o definitivamente por sistema de clases
        // this.armaActual = this.armaActual === 'espada' ? 'arco' : 'espada';
    }
}
