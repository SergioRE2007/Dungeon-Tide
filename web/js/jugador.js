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
        this.velocidadContinua = statsBase.velocidadContinua || 5; // cells/segundo

        this.direccion = [0, 1]; // ultima dir WASD (default: derecha)

        // Buffs de cofres (gacha)
        this.buffs = { roboVida: 0, gananciaOro: 0, velocidadExtra: 0, reduccionCooldownHab: 0 };
        this.suerte = 1; // multiplicador de suerte para cofres
        this.buffsHistorial = []; // { tipo, rareza, valor, color }

        // Habilidad especial (E)
        this.habilidadConfig = statsBase.habilidad || null;
        this.habilidadListaEn = 0; // timestamp cuando estara lista (0 = lista)

        // Stamina (sprint)
        this.staminaMax = 100;
        this.stamina = 100;
        this.isSprinting = false;

        // Nivel / XP
        this.nivel = 1;
        this.xp = 0;
        this.xpParaSiguienteNivel = 50;
        this.nivelesSubidosPendientes = 0; // cola de level-ups pendientes
        this.perksPendientes = 0;          // perks especiales por elegir

        // Perks activos (flags)
        this.perks = {};
    }

    // Override — el jugador no tiene IA, solo decrementa cooldowns
    actuar(board) {
        if (this.turnosInvencible > 0) this.turnosInvencible--;
        if (this.turnosVelocidad > 0) this.turnosVelocidad--;
    }

    recibirDanio(danio) {
        // Perk: Defensa Férrea — reduce daño recibido
        if (this.buffs.reduccionDanio > 0) {
            danio = Math.floor(danio * (1 - this.buffs.reduccionDanio));
        }
        super.recibirDanio(danio);
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

    actualizarStamina(dt, wantsSprint) {
        if (wantsSprint && this.stamina > 0) {
            this.isSprinting = true;
            this.stamina = Math.max(0, this.stamina - (this._staminaCoste || 30) * dt);
            if (this.stamina <= 0) this.isSprinting = false;
        } else {
            this.isSprinting = false;
            this.stamina = Math.min(this.staminaMax, this.stamina + (this._staminaRegen || 20) * dt);
        }
    }

    ganarXP(cantidad) {
        this.xp += cantidad;
        while (this.xp >= this.xpParaSiguienteNivel) {
            this.xp -= this.xpParaSiguienteNivel;
            this.nivel++;
            this.nivelesSubidosPendientes++;
            // Escalar XP necesaria
            this.xpParaSiguienteNivel = Math.floor(this.xpParaSiguienteNivel * (this._xpEscala || 1.12));
            // Auto-bonus pasivo cada nivel (vida + daño)
            const autoVida = this._bonusAutoVida || 0.03;
            const autoDanio = this._bonusAutoDanio || 0.03;
            const bonusHP = Math.max(3, Math.floor(this.vidaMax * autoVida));
            this.vidaMax += bonusHP;
            this.vida += bonusHP;
            const bonusDmg = Math.max(1, Math.floor((this.danioBaseMin + this.danioExtra) * autoDanio));
            this.danioExtra += bonusDmg;
            if (this.armaActual === 'arco' || this.armaActual === 'baston') {
                this.danioArco += bonusDmg;
            }
        }
    }

    aplicarMejoraNivel(tipo) {
        if (this.nivelesSubidosPendientes <= 0) return;
        this.nivelesSubidosPendientes--;

        switch (tipo) {
            case 'vida': {
                const bonus = Math.max(5, Math.floor(this.vidaMax * (this._mejoraVidaPct || 0.12)));
                this.vidaMax += bonus;
                this.vida += bonus; // curar la parte añadida
                break;
            }
            case 'danio': {
                const danioTotal = this.danioBaseMin + this.danioExtra;
                const bonus = Math.max(1, Math.floor(danioTotal * (this._mejoraDanioPct || 0.12)));
                this.danioExtra += bonus;
                // Actualizar daño arco/bastón también
                if (this.armaActual === 'arco' || this.armaActual === 'baston') {
                    this.danioArco += bonus;
                }
                break;
            }
            case 'velAtaque': {
                this.cooldownAtaqueMs = Math.max(
                    100,
                    Math.floor(this.cooldownAtaqueMs * (1 - (this._mejoraVelAtaquePct || 0.10)))
                );
                break;
            }
        }
    }

    aplicarPerk(perkId) {
        this.perks[perkId] = (this.perks[perkId] || 0) + 1;
        this.perksPendientes = Math.max(0, this.perksPendientes - 1);

        // Aplicar efectos pasivos inmediatos
        switch (perkId) {
            case 'defensaFerrea':
                this.buffs.reduccionDanio = (this.buffs.reduccionDanio || 0) + 0.20;
                break;
            case 'sedDeSangre':
                this.buffs.roboVidaKill = (this.buffs.roboVidaKill || 0) + 0.10;
                break;
            case 'horda':
                if (this.habilidadConfig) this.habilidadConfig.numInvocaciones = (this.habilidadConfig.numInvocaciones || 3) + 2;
                break;
            case 'necromanciaSuprema':
                // Esqueletos 3x más fuertes (se aplica en _habilidadInvocar)
                break;
        }
    }

    moverContinuo(dx, dy, dt, board) {
        if (dx === 0 && dy === 0) return;
        // Normalizar dirección
        const len = Math.hypot(dx, dy);
        const ndx = dx / len;
        const ndy = dy / len;
        this.direccion = [Math.sign(dy), Math.sign(dx)];

        const speedMult = 1 + Math.min(this.buffs?.velocidadExtra || 0, 0.6);
        const sprintMult = this.isSprinting ? (1 + (this._sprintMultiplier || 0.30)) : 1;
        const dist = this.velocidadContinua * speedMult * sprintMult * dt;
        const newX = this.x + ndx * dist;
        const newY = this.y + ndy * dist;

        // Intentar diagonal completa
        if (this._esTransitable(newX, newY, this.hitboxRadius, board)) {
            this.x = newX;
            this.y = newY;
        } else {
            // Sliding: intentar cada eje por separado
            const slideX = this.x + ndx * dist;
            const slideY = this.y + ndy * dist;
            let moved = false;
            if (ndx !== 0 && this._esTransitable(slideX, this.y, this.hitboxRadius, board)) {
                this.x = slideX;
                moved = true;
            }
            if (ndy !== 0 && this._esTransitable(this.x, slideY, this.hitboxRadius, board)) {
                this.y = slideY;
                moved = true;
            }
            if (!moved) return;
        }

        // Marcar como moviéndose (para animación run)
        this.moveTimestamp = performance.now();

        // Sincronizar grid coords
        const nuevaFila = Math.floor(this.y);
        const nuevaCol = Math.floor(this.x);
        if (nuevaFila !== this.fila || nuevaCol !== this.columna) {
            this.filaAnterior = this.fila;
            this.colAnterior = this.columna;
            this.fila = nuevaFila;
            this.columna = nuevaCol;
        }
    }

    _esTransitable(px, py, r, board) {
        // Comprobar bordes del mapa
        if (px - r < 0 || py - r < 0 || px + r > board.columnas || py + r > board.filas) return false;

        // Comprobar celdas que el hitbox toca
        const minF = Math.floor(py - r);
        const maxF = Math.floor(py + r - 0.001);
        const minC = Math.floor(px - r);
        const maxC = Math.floor(px + r - 0.001);

        for (let f = minF; f <= maxF; f++) {
            for (let c = minC; c <= maxC; c++) {
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) return false;
                if (board.esVacio(f, c)) return false;
                const e = board.getEntidad(f, c);
                if (e instanceof Muro) return false;
            }
        }
        return true;
    }

    atacarEspada(board) {
        if (performance.now() < this.ataqueListoEn) return [];
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs;

        const kills = [];
        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);
        for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = cf + df;
                const c = cc + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                const e = board.getEntidad(f, c);
                if (e && esEnemigo(e.tipo)) {
                    let danio = this.getDanio();
                    let esCritico = false;
                    if (this.perks.golpeBrutal && Rng.nextDouble() < 0.25) { danio *= 2; esCritico = true; }
                    this.danioInfligido += danio;
                    if (this.buffs.roboVida > 0) this.curar(Math.floor(danio * this.buffs.roboVida));
                    e._fueGolpeCritico = esCritico;
                    e.recibirDanio(danio);
                    if (this.perks.sangrado && e.estaVivo()) {
                        e.sangrado = { danio: Math.floor(danio * 0.15), turnos: 3 };
                    }
                    if (!e.estaVivo()) {
                        this.kills++;
                        if (this.buffs.roboVidaKill > 0) this.curar(Math.floor(this.vidaMax * this.buffs.roboVidaKill));
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

        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);

        // Las 8 celdas adyacentes con su ángulo respecto al jugador
        const adyacentes = [];
        for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = cf + df;
                const c = cc + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                const angCelda = Math.atan2(df, dc);
                // Diferencia angular normalizada a [-PI, PI]
                let diff = angCelda - angulo;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                adyacentes.push({ f, c, df, dc, diff: Math.abs(diff) });
            }
        }

        // Ordenar por cercanía angular y tomar las N más cercanas
        adyacentes.sort((a, b) => a.diff - b.diff);
        const arcoCeldas = this.perks.tajoAmplio ? 5 : 3;
        const seleccionadas = adyacentes.slice(0, arcoCeldas);

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
                let danio = this.getDanio();
                let esCritico = false;
                if (this.perks.golpeBrutal && Rng.nextDouble() < 0.25) { danio *= 2; esCritico = true; }
                this.danioInfligido += danio;
                if (this.buffs.roboVida > 0) this.curar(Math.floor(danio * this.buffs.roboVida));
                e._fueGolpeCritico = esCritico;
                e.recibirDanio(danio);
                // Perk: Sangrado — DoT
                if (this.perks.sangrado && e.estaVivo()) {
                    e.sangrado = { danio: Math.floor(danio * 0.15), turnos: 3 };
                }
                if (!e.estaVivo()) {
                    this.kills++;
                    if (this.buffs.roboVidaKill > 0) this.curar(Math.floor(this.vidaMax * this.buffs.roboVidaKill));
                    board.setEntidad(celda.f, celda.c, null);
                    kills.push(e);
                }
            }
        }

        return { kills, celdasAfectadas };
    }

    atacarArco(board, angulo) {
        if (performance.now() < this.ataqueListoEn) return { kills: [], trayectoria: [], trayectoriasExtra: [] };
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs;

        // Perk: Disparo Rápido — cada 3er disparo no tiene cooldown
        if (this.perks.disparoRapido) {
            this._contadorDisparos = (this._contadorDisparos || 0) + 1;
            if (this._contadorDisparos % 3 === 0) this.ataqueListoEn = performance.now();
        }

        // Determinar número de flechas
        let numFlechas = 1;
        if (this.perks.tripleFlecha) numFlechas = 3;
        else if (this.perks.dobleFlecha) numFlechas = 2;

        const allKills = [];
        const allTrayectorias = [];

        const spreadAngle = 0.15; // ~8.5 grados de separación
        const angulos = [angulo];
        if (numFlechas >= 2) { angulos.push(angulo - spreadAngle); angulos.push(angulo + spreadAngle); }
        if (numFlechas >= 3 && angulos.length < 3) angulos.push(angulo); // safety

        for (let flecha = 0; flecha < numFlechas; flecha++) {
            const anguloFlecha = angulos[flecha] ?? angulo;
            const { kills, trayectoria } = this._dispararFlecha(board, anguloFlecha);
            allKills.push(...kills);
            allTrayectorias.push(trayectoria);
        }

        return { kills: allKills, trayectoria: allTrayectorias[0] || [], trayectoriasExtra: allTrayectorias.slice(1) };
    }

    _dispararFlecha(board, angulo) {
        const kills = [];
        const trayectoria = [];
        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);
        const perforante = !!this.perks.flechaPerforante;
        const explosiva = !!this.perks.flechasExplosivas;

        // Generar lista de celdas a recorrer
        let celdas;
        if (angulo !== undefined) {
            const sf = Math.sin(angulo);
            const sc = Math.cos(angulo);
            celdas = this._trazarLineaRecta(cf, cc, sf, sc, this.rangoArco + 2);
        } else {
            const [df, dc] = this.direccion;
            celdas = [];
            for (let i = 1; i <= this.rangoArco; i++) {
                celdas.push([cf + df * i, cc + dc * i]);
            }
        }

        let hitCount = 0;
        let impactoF = null, impactoC = null;

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
                if (this.buffs.roboVida > 0) this.curar(Math.floor(danio * this.buffs.roboVida));
                e.recibirDanio(danio);
                if (!e.estaVivo()) {
                    this.kills++;
                    if (this.buffs.roboVidaKill > 0) this.curar(Math.floor(this.vidaMax * this.buffs.roboVidaKill));
                    board.setEntidad(f, c, null);
                    kills.push(e);
                }
                hitCount++;
                impactoF = f; impactoC = c;
                // Perforante pasa a través del primer enemigo
                if (!perforante || hitCount >= 2) {
                    if (!explosiva) break;
                    else break; // explosiva: parar y explotar
                }
            }
        }

        // Perk: Flechas Explosivas — 3x3 en punto de impacto
        if (explosiva && impactoF !== null) {
            for (let df = -1; df <= 1; df++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (df === 0 && dc === 0) continue;
                    const af = impactoF + df;
                    const ac = impactoC + dc;
                    if (af < 0 || af >= board.filas || ac < 0 || ac >= board.columnas) continue;
                    const e = board.getEntidad(af, ac);
                    if (e && esEnemigo(e.tipo)) {
                        const danio = Math.floor((this.danioArco + this.danioExtra) * 0.5);
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

    atacarCircular(board) {
        if (performance.now() < this.ataqueListoEn) return null;
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs * 1.5;

        const kills = [];
        const celdas = [];
        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);

        for (let df = -1; df <= 1; df++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = cf + df;
                const c = cc + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                celdas.push({ f, c });
                const e = board.getEntidad(f, c);
                if (e && esEnemigo(e.tipo)) {
                    let danio = this.getDanio();
                    let esCritico = false;
                    if (this.perks.golpeBrutal && Rng.nextDouble() < 0.25) { danio *= 2; esCritico = true; }
                    this.danioInfligido += danio;
                    if (this.buffs.roboVida > 0) this.curar(Math.floor(danio * this.buffs.roboVida));
                    e._fueGolpeCritico = esCritico;
                    e.recibirDanio(danio);
                    if (this.perks.sangrado && e.estaVivo()) {
                        e.sangrado = { danio: Math.floor(danio * 0.15), turnos: 3 };
                    }
                    if (!e.estaVivo()) {
                        this.kills++;
                        if (this.buffs.roboVidaKill > 0) this.curar(Math.floor(this.vidaMax * this.buffs.roboVidaKill));
                        board.setEntidad(f, c, null);
                        kills.push(e);
                    }
                }
            }
        }
        return { kills, celdas };
    }

    atacar(board) {
        if (this.armaActual === 'espada') {
            return this.atacarEspada(board);
        } else {
            return this.atacarArco(board);
        }
    }

    atacarBaston(board, angulo) {
        if (performance.now() < this.ataqueListoEn) return { kills: [], trayectoria: [], celdasAfectadas: [], trayectoriasExtra: [] };
        this.ataqueListoEn = performance.now() + this.cooldownAtaqueMs;

        // Multi-proyectil perks
        let numProyectiles = 1;
        if (this.perks.tripleProyectil) numProyectiles = 3;
        else if (this.perks.dobleProyectil) numProyectiles = 2;

        if (numProyectiles > 1) {
            const allKills = [];
            const allTray = [];
            const allCeldas = [];
            const spread = 0.2;
            const angulos = [angulo];
            if (numProyectiles >= 2) { angulos.push(angulo - spread); angulos.push(angulo + spread); }

            for (let i = 0; i < numProyectiles; i++) {
                const r = this._dispararBaston(board, angulos[i] ?? angulo);
                allKills.push(...r.kills);
                allTray.push(r.trayectoria);
                allCeldas.push(...(r.celdasAfectadas || []));
            }
            return { kills: allKills, trayectoria: allTray[0] || [], trayectoriasExtra: allTray.slice(1), celdasAfectadas: allCeldas, impacto: null };
        }

        const r = this._dispararBaston(board, angulo);
        return { ...r, trayectoriasExtra: [] };
    }

    _dispararBaston(board, angulo) {
        const kills = [];
        const trayectoria = [];
        // Perk: Explosión Mayor — radio 2 (5x5) en vez de 1 (3x3)
        const radioExplosion = this.perks.explosionMayor ? 2 : 1;
        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);

        // Generar lista de celdas a recorrer
        let celdas;
        if (angulo !== undefined) {
            const sf = Math.sin(angulo);
            const sc = Math.cos(angulo);
            celdas = this._trazarLineaRecta(cf, cc, sf, sc, this.rangoArco + 2);
        } else {
            const [df, dc] = this.direccion;
            celdas = [];
            for (let i = 1; i <= this.rangoArco; i++) {
                celdas.push([cf + df * i, cc + dc * i]);
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
                        if (this.buffs.roboVida > 0) this.curar(Math.floor(danio * this.buffs.roboVida));
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
        const cdReduc = Math.min(this.buffs?.reduccionCooldownHab || 0, 0.7);
        this.habilidadListaEn = performance.now() + this.habilidadConfig.cooldownMs * (1 - cdReduc);

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
        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);

        for (let df = -radio; df <= radio; df++) {
            for (let dc = -radio; dc <= radio; dc++) {
                if (df === 0 && dc === 0) continue;
                if (Math.abs(df) + Math.abs(dc) > radio + 1) continue; // forma diamante
                const f = cf + df;
                const c = cc + dc;
                if (f < 0 || f >= board.filas || c < 0 || c >= board.columnas) continue;
                if (board.esVacio && board.esVacio(f, c)) continue;

                celdasAfectadas.push({ f, c });
                const e = board.getEntidad(f, c);
                if (e && esEnemigo(e.tipo)) {
                    const danio = this.getDanio() * mult;
                    this.danioInfligido += danio;
                    if (this.buffs.roboVida > 0) this.curar(Math.floor(danio * this.buffs.roboVida));
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
        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);

        // Trazar linea central
        const sf = Math.sin(angulo);
        const sc = Math.cos(angulo);
        const celdasCentro = this._trazarLineaRecta(cf, cc, sf, sc, rango + 2);

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
                    if (this.buffs.roboVida > 0) this.curar(Math.floor(danio * this.buffs.roboVida));
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
        const cf = Math.floor(this.y);
        const cc = Math.floor(this.x);

        // Buscar celdas libres alrededor del jugador (radio 2)
        const candidatas = [];
        for (let df = -2; df <= 2; df++) {
            for (let dc = -2; dc <= 2; dc++) {
                if (df === 0 && dc === 0) continue;
                const f = cf + df;
                const c = cc + dc;
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
        const multEsq = this.perks.necromanciaSuprema ? 3 : 1;
        const vidaEsq = this.vidaMax * multEsq;
        const danioEsq = (this.danioArco + this.danioExtra) * 2 * multEsq;

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
            board.addEntidadActiva(aliado);
            invocados.push(pos);
        }

        return { tipo: 'invocar', invocados, kills: [] };
    }
}
