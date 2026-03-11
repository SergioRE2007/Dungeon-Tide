import { Aliado, Enemigo, Muro, AliadoGuerrero, AliadoEsqueleto, esEnemigo } from './entidad.js';
import * as Rng from './rng.js';

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
        this.cooldownAtaqueMs = statsBase.cooldownAtaque; // en ms (ej: 600)
        this.ataqueListoEn = 0; // timestamp performance.now()
        this.danioArco = (statsBase.arma === 'arco' || statsBase.arma === 'baston') ? statsBase.danio : 3;
        this.rangoArco = (statsBase.arma === 'arco' || statsBase.arma === 'baston') ? statsBase.rango : 5;
        this.velocidadMoverMs = statsBase.velocidadMoverMs || 100;

        this.direccion = [0, 1]; // ultima dir WASD (default: derecha)

        // Habilidad especial (E)
        this.habilidadConfig = statsBase.habilidad || null;
        this.habilidadListaEn = 0; // timestamp cuando estara lista (0 = lista)
    }

    // Override — el jugador no tiene IA, solo decrementa cooldowns
    actuar(board) {
        if (this.turnosInvencible > 0) this.turnosInvencible--;
        if (this.turnosVelocidad > 0) this.turnosVelocidad--;
    }

    moverWASD(tecla, board) {
        const dir = DIRS_WASD[tecla];
        if (!dir) return false;
        this.direccion = dir;
        const nf = this.fila + dir[0];
        const nc = this.columna + dir[1];
        this._primerMovTurno = true; // para interpolación suave (igual que enemigos)
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
        this._primerMovTurno = true; // para interpolación suave (igual que enemigos)
        return this._moverSiPosible(nf, nc, board);
    }

    atacarEspada(board) {
        if (performance.now() < this.ataqueListoEn) return [];
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs;

        const kills = [];
        for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                const e = board.getEntidad(f, c);
                if (e && esEnemigo(e.tipo)) {
                    const danio = this.getDanio();
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
        if (performance.now() < this.ataqueListoEn) return { kills: [], celdasAfectadas: [] };
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs;

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
            if (e && esEnemigo(e.tipo)) {
                const danio = this.getDanio();
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
        if (performance.now() < this.ataqueListoEn) return { kills: [], trayectoria: [] };
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs;

        const kills = [];
        const trayectoria = [];

        // Generar lista de celdas a recorrer
        let celdas;
        if (angulo !== undefined) {
            const sf = Math.sin(angulo);
            const sc = Math.cos(angulo);
            celdas = this._trazarLineaRecta(this.fila, this.columna, sf, sc, this.rangoArco + 2);
        } else {
            const [df, dc] = this.direccion;
            celdas = [];
            for (let i = 1; i <= this.rangoArco; i++) {
                celdas.push([this.fila + df * i, this.columna + dc * i]);
            }
        }

        // Recorrer celdas e infligir daño
        for (const [f, c] of celdas) {
            if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) break;
            if (trayectoria.length >= this.rangoArco) break;
            if (board.esVacio && board.esVacio(f, c)) { if (angulo !== undefined) continue; else break; }

            trayectoria.push({ f, c });

            const e = board.getEntidad(f, c);
            if (e instanceof Muro) break;

            if (e && esEnemigo(e.tipo)) {
                const danio = this.danioArco + this.danioExtra;
                this.danioInfligido += danio;
                e.recibirDanio(danio);
                if (!e.estaVivo()) {
                    this.kills++;
                    board.setEntidad(f, c, null);
                    kills.push(e);
                }
            }
        }
        return { kills, trayectoria };
    }

    // Traza línea recta sobremuestreada: devuelve TODAS las celdas que la línea visual atraviesa
    _trazarLineaRecta(f0, c0, sf, sc, maxCeldas) {
        const celdas = [];
        const visited = new Set();
        const pasos = (maxCeldas + 1) * 4;
        for (let i = 1; i <= pasos; i++) {
            const dist = i * 0.25;
            const f = Math.round(f0 + sf * dist);
            const c = Math.round(c0 + sc * dist);
            const key = f * 10000 + c;
            if (!visited.has(key) && !(f === f0 && c === c0)) {
                visited.add(key);
                celdas.push([f, c]);
            }
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

    atacarBaston(board, angulo) {
        if (performance.now() < this.ataqueListoEn) return { kills: [], trayectoria: [], celdasAfectadas: [] };
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs;

        // Resolución instantánea (como el arco) pero para en el primer enemigo y explota en área
        const kills = [];
        const trayectoria = [];
        const radioExplosion = 1; // 3x3

        // Generar lista de celdas a recorrer
        let celdas;
        if (angulo !== undefined) {
            const sf = Math.sin(angulo);
            const sc = Math.cos(angulo);
            celdas = this._trazarLineaRecta(this.fila, this.columna, sf, sc, this.rangoArco + 2);
        } else {
            const [df, dc] = this.direccion;
            celdas = [];
            for (let i = 1; i <= this.rangoArco; i++) {
                celdas.push([this.fila + df * i, this.columna + dc * i]);
            }
        }

        // Buscar punto de impacto: primer enemigo o muro
        let impactoF = null, impactoC = null;
        for (const [f, c] of celdas) {
            if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) break;
            if (trayectoria.length >= this.rangoArco) break;
            if (board.esVacio && board.esVacio(f, c)) { if (angulo !== undefined) continue; else break; }

            trayectoria.push({ f, c });

            const e = board.getEntidad(f, c);
            if (e instanceof Muro) { impactoF = f; impactoC = c; break; }

            if (e && esEnemigo(e.tipo)) {
                impactoF = f;
                impactoC = c;
                break; // Para en el primer enemigo
            }
        }

        // Si no impactó nada, explotar al final de la trayectoria
        if (impactoF === null && trayectoria.length > 0) {
            const ultima = trayectoria[trayectoria.length - 1];
            impactoF = ultima.f;
            impactoC = ultima.c;
        }

        // Aplicar daño en área alrededor del punto de impacto
        if (impactoF !== null) {
            const danio = this.danioArco + this.danioExtra;
            const celdasAfectadas = [];
            for (let df = -radioExplosion; df <= radioExplosion; df++) {
                for (let dc = -radioExplosion; dc <= radioExplosion; dc++) {
                    const af = impactoF + df;
                    const ac = impactoC + dc;
                    if (af < 0 || af >= board.filas || ac < 0 || ac >= board.columnas) continue;
                    celdasAfectadas.push({ f: af, c: ac });
                    const e = board.getEntidad(af, ac);
                    if (e && esEnemigo(e.tipo)) {
                        this.danioInfligido += danio;
                        e.recibirDanio(danio);
                        if (!e.estaVivo()) {
                            this.kills++;
                            board.setEntidad(af, ac, null);
                            kills.push(e);
                        }
                    }
                }
            }
            return { kills, trayectoria, impacto: { f: impactoF, c: impactoC }, celdasAfectadas };
        }

        return { kills, trayectoria, celdasAfectadas: [] };
    }

    habilidadLista() {
        return this.habilidadConfig && performance.now() >= this.habilidadListaEn;
    }

    habilidadCooldownRestante() {
        if (!this.habilidadConfig) return 0;
        return Math.max(0, this.habilidadListaEn - performance.now());
    }

    usarHabilidad(board, angulo) {
        if (!this.habilidadConfig || !this.habilidadLista()) return null;
        this.habilidadListaEn = performance.now() + this.habilidadConfig.cooldownMs;

        if (this.armaActual === 'espada') {
            return this._habilidadGolpeSismico(board);
        } else if (this.armaActual === 'baston') {
            return this._habilidadInvocar(board);
        } else {
            return this._habilidadFlechaColosal(board, angulo);
        }
    }

    _habilidadGolpeSismico(board) {
        const radio = this.habilidadConfig.radio;
        const mult = this.habilidadConfig.multiplicadorDanio;
        const kills = [];
        const celdasAfectadas = [];

        for (let df = -radio; df <= radio; df++) {
            for (let dc = -radio; dc <= radio; dc++) {
                if (df === 0 && dc === 0) continue;
                if (Math.abs(df) + Math.abs(dc) > radio + 1) continue; // forma diamante
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                if (board.esVacio && board.esVacio(f, c)) continue;

                celdasAfectadas.push({ f, c });
                const e = board.getEntidad(f, c);
                if (e && esEnemigo(e.tipo)) {
                    const danio = this.getDanio() * mult;
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
        return { tipo: 'sismico', kills, celdasAfectadas };
    }

    _habilidadFlechaColosal(board, angulo) {
        const mult = this.habilidadConfig.multiplicadorDanio;
        const rango = this.habilidadConfig.rango;
        const ancho = this.habilidadConfig.ancho;
        const kills = [];
        const trayectoria = [];

        // Trazar linea central
        const sf = Math.sin(angulo);
        const sc = Math.cos(angulo);
        const celdasCentro = this._trazarLineaRecta(this.fila, this.columna, sf, sc, rango + 2);

        // Direccion perpendicular para el ancho
        const perpF = -sc;
        const perpC = sf;

        const visited = new Set();
        const trayectoriaSet = [];

        for (const [f, c] of celdasCentro) {
            if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) break;
            if (trayectoriaSet.length >= rango) break;

            // Centro + celdas a los lados
            for (let w = -ancho; w <= ancho; w++) {
                const af = Math.round(f + perpF * w);
                const ac = Math.round(c + perpC * w);
                if (af < 0 || af >= board.filas || ac < 0 || ac >= board.columnas) continue;
                const key = af * 10000 + ac;
                if (visited.has(key)) continue;
                visited.add(key);

                trayectoria.push({ f: af, c: ac });

                if (board.esVacio && board.esVacio(af, ac)) continue;
                const e = board.getEntidad(af, ac);
                if (e && esEnemigo(e.tipo)) {
                    const danio = (this.danioArco + this.danioExtra) * mult;
                    this.danioInfligido += danio;
                    e.recibirDanio(danio);
                    if (!e.estaVivo()) {
                        this.kills++;
                        board.setEntidad(af, ac, null);
                        kills.push(e);
                    }
                }
            }

            trayectoriaSet.push({ f, c });

            // Parar en muros (solo la linea central)
            if (board.esVacio && board.esVacio(f, c)) continue;
            const eCentro = board.getEntidad(f, c);
            if (eCentro instanceof Muro) break;
        }

        return { tipo: 'colosal', kills, trayectoria, trayectoriaCentro: trayectoriaSet };
    }

    _habilidadInvocar(board) {
        const cfg = this.habilidadConfig;
        const num = cfg.numInvocaciones || 3;
        const invocados = [];

        // Buscar celdas libres alrededor del jugador (radio 2)
        const candidatas = [];
        for (let df = -2; df <= 2; df++) {
            for (let dc = -2; dc <= 2; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = this.fila + df;
                const c = this.columna + dc;
                if (f >= 0 && f < board.filas && c >= 0 && c < board.columnas
                    && !board.esVacio(f, c)
                    && board.getEntidad(f, c) === null) {
                    candidatas.push({ f, c });
                }
            }
        }

        // Fisher-Yates shuffle con Rng (determinista)
        for (let i = candidatas.length - 1; i > 0; i--) {
            const j = Rng.nextInt(i + 1);
            [candidatas[i], candidatas[j]] = [candidatas[j], candidatas[i]];
        }

        // Esqueletos escalan con stats del necromancer (100% vida, 200% daño)
        const vidaEsq = this.vidaMax;
        const danioEsq = (this.danioArco + this.danioExtra) * 2;

        for (let i = 0; i < Math.min(num, candidatas.length); i++) {
            const pos = candidatas[i];
            // Si es Necromancer, crear esqueletos; si no, aliados normales
            const esNecromancer = this.idClase === 'necromancer';
            const aliado = esNecromancer
                ? new AliadoEsqueleto(pos.f, pos.c,
                    vidaEsq,
                    danioEsq, danioEsq,
                    cfg.visionInvocado || 8
                )
                : new Aliado(pos.f, pos.c,
                    cfg.vidaInvocado || 80,
                    cfg.danioInvocado || 10, cfg.danioInvocado || 10,
                    cfg.visionInvocado || 8
                );
            board.setEntidad(pos.f, pos.c, aliado);
            invocados.push(pos);
        }

        return { tipo: 'invocar', invocados, kills: [] };
    }
}
