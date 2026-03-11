import { GameBoard } from './gameboard.js';
import { resetContadorId, Enemigo, EnemigoTanque, EnemigoRapido, EnemigoMago, Aliado, Muro, esEnemigo } from './entidad.js';
import { Escudo, Arma, Estrella, Velocidad, Pocion } from './objetos.js';
import { Jugador } from './jugador.js';
import { Torre } from './torre.js';
import oleadasConfig from './oleadasConfig.js';
import * as Rng from './rng.js';

export class OleadasEngine {
    constructor(config = null) {
        this.config = config || oleadasConfig;
        this.board = null;
        this.jugador = null;
        this.torres = [];
        this.oleadaActual = 0;
        this.enemigosVivos = 0;
        this.turno = 0;
        this.dinero = 0;
        this.gameOver = false;
        this.oleadaEnCurso = false;
        this.spawners = []; // posiciones de los 4 spawners
        this.totalKills = 0;
        this.totalDanioInfligido = 0;
        this.compras = {}; // conteo de compras por tipo para escalado
        this.bossKilledThisTick = false;
    }

    inicializar(idClaseSeleccionada = 'guerrero') {
        resetContadorId();
        Rng.setSeed(-1); // random

        const { filas, columnas } = this.config;
        this.board = new GameBoard(filas, columnas);

        // No bordes — mapa abierto
        // Crear zonas de vacio (abismos decorativos)
        this._generarVacios();

        // Spawners en las 4 esquinas (dentro del mapa)
        this.spawners = [
            { f: 1, c: 1 },
            { f: 1, c: columnas - 2 },
            { f: filas - 2, c: 1 },
            { f: filas - 2, c: columnas - 2 },
        ];

        // Jugador en el centro
        const cf = Math.floor(filas / 2);
        const cc = Math.floor(columnas / 2);
        
        this.jugador = new Jugador(cf, cc, idClaseSeleccionada, this.config.clases);
        
        this.board.setEntidad(cf, cc, this.jugador);

        this.oleadaActual = 0;
        this.turno = 0;
        this.dinero = this.config.dineroInicial ?? 100; // dinero inicial
        this.jugador.dinero = this.dinero;
        this.gameOver = false;
        this.oleadaEnCurso = false;
        this.torres = [];
        this.totalKills = 0;
        this.totalDanioInfligido = 0;
        this.compras = {};
        this.enemigosVivos = 0;
        this.tiempoInicio = Date.now();
    }

    _generarVacios() {
        const { filas, columnas } = this.config;
        // Generar algunos parches de vacio aleatorios (abismos)
        const numParches = 3 + Rng.nextInt(3);
        for (let p = 0; p < numParches; p++) {
            const cf = 3 + Rng.nextInt(filas - 6);
            const cc = 3 + Rng.nextInt(columnas - 6);
            const tamano = 2 + Rng.nextInt(2);

            for (let df = 0; df < tamano; df++) {
                for (let dc = 0; dc < tamano; dc++) {
                    const f = cf + df;
                    const c = cc + dc;
                    if (f > 0 && f < filas - 1 && c > 0 && c < columnas - 1) {
                        // No poner vacio en zona central ni en esquinas (spawners)
                        const distCentro = Math.abs(f - Math.floor(filas / 2)) + Math.abs(c - Math.floor(columnas / 2));
                        const esEsquina = (f <= 2 && c <= 2) || (f <= 2 && c >= columnas - 3) ||
                                          (f >= filas - 3 && c <= 2) || (f >= filas - 3 && c >= columnas - 3);
                        if (distCentro > 3 && !esEsquina) {
                            this.board.setVacio(f, c, true);
                        }
                    }
                }
            }
        }
    }

    iniciarOleada() {
        if (this.oleadaEnCurso || this.gameOver) return;
        this.oleadaActual++;
        this.oleadaEnCurso = true;
        this._spawnOleada(this.oleadaActual);
    }

    _spawnOleada(num) {
        const cfg = this.config;
        const numEnemigos = cfg.enemigosBase + cfg.enemigosIncremento * (num - 1);
        const escalaVida = Math.pow(cfg.escalaVidaOleada, num - 1);

        // Boss cada N oleadas
        const esBoss = num % cfg.oleadaBoss === 0;

        let spawned = 0;
        for (let i = 0; i < numEnemigos; i++) {
            const spawner = this.spawners[i % this.spawners.length];

            // Buscar celda libre cerca del spawner
            const pos = this._buscarCeldaLibreCerca(spawner.f, spawner.c, 3);
            if (!pos) continue;

            let enemigo;
            if (esBoss && i === 0) {
                // Boss: tanque con stats multiplicados
                enemigo = new EnemigoTanque(pos.f, pos.c,
                    Math.floor(cfg.vidaTanque * escalaVida * cfg.bossMultiplicadorVida),
                    Math.floor(cfg.danioTanque * cfg.bossMultiplicadorDanio),
                    Math.floor(cfg.danioTanque * cfg.bossMultiplicadorDanio),
                    cfg.visionTanque
                );
                enemigo.esBoss = true;
            } else if (num >= cfg.oleadaTanques && Rng.nextDouble() < 0.2) {
                enemigo = new EnemigoTanque(pos.f, pos.c,
                    Math.floor(cfg.vidaTanque * escalaVida),
                    cfg.danioTanque, cfg.danioTanque,
                    cfg.visionTanque
                );
            } else if (num >= cfg.oleadaRapidos && Rng.nextDouble() < 0.25) {
                enemigo = new EnemigoRapido(pos.f, pos.c,
                    Math.floor(cfg.vidaRapido * escalaVida),
                    cfg.danioRapido, cfg.danioRapido,
                    cfg.visionRapido
                );
            } else if (num >= cfg.oleadaMagos && Rng.nextDouble() < 0.2) {
                enemigo = new EnemigoMago(pos.f, pos.c,
                    Math.floor(cfg.vidaMago * escalaVida),
                    cfg.danioMago, cfg.danioMago,
                    cfg.visionMago, cfg.rangoMago
                );
            } else {
                enemigo = new Enemigo(pos.f, pos.c,
                    Math.floor(cfg.vidaEnemigo * escalaVida),
                    cfg.danioEnemigo, cfg.danioEnemigo,
                    cfg.visionEnemigo
                );
            }

            this.board.setEntidad(pos.f, pos.c, enemigo);
            spawned++;
        }
        this.enemigosVivos = spawned;
    }

    _buscarCeldaLibreCerca(f, c, radio) {
        // Espiral simple buscando celda libre
        for (let r = 0; r <= radio; r++) {
            for (let df = -r; df <= r; df++) {
                for (let dc = -r; dc <= r; dc++) {
                    if (Math.abs(df) !== r && Math.abs(dc) !== r) continue;
                    const nf = f + df;
                    const nc = c + dc;
                    if (nf >= 0 && nf < this.board.filas && nc >= 0 && nc < this.board.columnas
                        && !this.board.esVacio(nf, nc)
                        && this.board.getEntidad(nf, nc) === null) {
                        return { f: nf, c: nc };
                    }
                }
            }
        }
        // Fallback: buscar cualquier celda libre
        for (let intentos = 0; intentos < 50; intentos++) {
            const nf = Rng.nextInt(this.board.filas);
            const nc = Rng.nextInt(this.board.columnas);
            if (!this.board.esVacio(nf, nc) && this.board.getEntidad(nf, nc) === null) {
                return { f: nf, c: nc };
            }
        }
        return null;
    }

    tick() {
        if (this.gameOver) return;
        this.bossKilledThisTick = false;
        this.turno++;

        // 0. Jugador actua
        if (this.jugador.estaVivo()) {
            this.jugador.actuar(this.board);
        }

        // 1. Torres actuan
        for (const torre of this.torres) {
            if (torre.estaVivo()) torre.actuar(this.board);
        }

        // 2. Escaneo único del tablero: recoger enemigos, aliados, trampas, objetos
        const enemigos = [];
        const aliados = [];
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const e = this.board.getEntidad(f, c);
                if (!e) continue;
                if (e instanceof Enemigo) enemigos.push(e);
                else if (e instanceof Aliado && e !== this.jugador) aliados.push(e);
            }
        }

        // 2a. Enemigos actuan (rápidos usan su propio timer en oleadas.js)
        for (const e of enemigos) {
            if (e instanceof EnemigoRapido) continue;
            if (this.board.getEntidad(e.fila, e.columna) !== e || !e.estaVivo()) continue;
            e._primerMovTurno = true;
            if (this.jugador.estaVivo()) e.actuar(this.board);
            else e.moverRandom(this.board);
        }

        // 2b. Aliados invocados actuan
        for (const e of aliados) {
            if (this.board.getEntidad(e.fila, e.columna) !== e || !e.estaVivo()) continue;
            e._primerMovTurno = true;
            e.actuar(this.board);
        }

        // 2c. Procesar proyectiles
        this.board.procesarProyectiles();

        // 3-4-5. Segundo escaneo: trampas, objetos, muertos, conteo
        let killsEsteTurno = 0;
        this.enemigosVivos = 0;

        // Recogida objetos por jugador
        if (this.jugador.estaVivo()) {
            const obj = this.board.getObjeto(this.jugador.fila, this.jugador.columna);
            if (obj !== null) {
                obj.aplicar(this.jugador);
                this.board.setObjeto(this.jugador.fila, this.jugador.columna, null);
            }
        }

        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const e = this.board.getEntidad(f, c);
                if (!e) continue;

                // Trampas
                const trampa = this.board.getTrampa(f, c);
                if (trampa && !(e instanceof Muro) && !(e instanceof Torre)) {
                    const danio = trampa.getDanio();
                    e.recibirDanio(danio);
                    e.danioRecibido += danio;
                }

                // Objetos para aliados invocados
                const obj = this.board.getObjeto(f, c);
                if (e instanceof Aliado && e !== this.jugador && obj !== null) {
                    obj.aplicar(e);
                    this.board.setObjeto(f, c, null);
                }

                // Muertos
                if (!e.estaVivo()) {
                    if (e instanceof Enemigo) {
                        let recompensa = this.config.recompensaEnemigo;
                        if (e instanceof EnemigoTanque) recompensa = this.config.recompensaTanque;
                        else if (e instanceof EnemigoRapido) recompensa = this.config.recompensaRapido;
                        else if (e instanceof EnemigoMago) recompensa = this.config.recompensaMago;
                        this.dinero += recompensa;
                        this.jugador.dinero = this.dinero;
                        killsEsteTurno++;
                        if (e.esBoss) this.bossKilledThisTick = true;
                        if (Rng.nextDouble() < this.config.probDrop) this._dropObjeto(f, c);
                        this.board.setEntidad(f, c, null);
                    } else if (e instanceof Torre) {
                        this.torres = this.torres.filter(t => t !== e);
                        this.board.setEntidad(f, c, null);
                    } else if (e instanceof Muro) {
                        this.board.setEntidad(f, c, null);
                    } else if (e instanceof Aliado && e !== this.jugador) {
                        this.board.setEntidad(f, c, null);
                    }
                } else if (e instanceof Enemigo) {
                    this.enemigosVivos++;
                }
            }
        }
        this.totalKills += killsEsteTurno;

        // Oleada limpiada
        if (this.oleadaEnCurso && this.enemigosVivos === 0) {
            this.oleadaEnCurso = false;
        }

        // Game over
        if (!this.jugador.estaVivo()) {
            this.gameOver = true;
        }
    }

    _dropObjeto(f, c) {
        if (this.board.getObjeto(f, c) !== null) return;
        const r = Rng.nextDouble();
        if (r < 0.35) {
            this.board.setObjeto(f, c, new Pocion(f, c, this.config.curacionPocion));
        } else if (r < 0.6) {
            this.board.setObjeto(f, c, new Escudo(f, c, this.config.escudoCantidad));
        } else if (r < 0.8) {
            this.board.setObjeto(f, c, new Arma(f, c, 5));
        } else {
            this.board.setObjeto(f, c, new Velocidad(f, c, 15));
        }
    }

    getPrecio(tipo) {
        const base = this.config['precio' + tipo.charAt(0).toUpperCase() + tipo.slice(1)];
        const veces = this.compras[tipo] || 0;
        // Solo escalan mejoras de jugador
        const escala = ['mejoraVida', 'mejoraDanio', 'mejoraVelAtaque'].includes(tipo);
        const factor = tipo === 'mejoraVelAtaque' ? this.config.escalaPrecioVelAtaque : this.config.escalaPrecio;
        return Math.floor(base * (escala ? Math.pow(factor, veces) : 1));
    }

    comprar(tipo) {
        const precio = this.getPrecio(tipo);
        if (this.dinero < precio) return false;

        this.dinero -= precio;
        this.jugador.dinero = this.dinero;
        this.compras[tipo] = (this.compras[tipo] || 0) + 1;

        switch (tipo) {
            case 'mejoraVida': {
                const bonus = Math.floor(this.jugador.vidaMax * this.config.mejoraVidaPct);
                this.jugador.vidaMax += bonus;
                this.jugador.vida += bonus;
                break;
            }
            case 'mejoraDanio': {
                const danioTotal = this.jugador.danioBaseMin + this.jugador.danioExtra;
                const bonus = Math.max(1, Math.floor(danioTotal * this.config.mejoraDanioPct));
                this.jugador.danioExtra += bonus;
                break;
            }
            case 'mejoraVelAtaque':
                this.jugador.cooldownAtaqueMs = Math.max(
                    this.config.cooldownAtaqueMinMs,
                    Math.floor(this.jugador.cooldownAtaqueMs * (1 - this.config.mejoraVelAtaquePct))
                );
                break;
            case 'pocion':
                this.jugador.curar(this.config.curacionPocion);
                break;
            case 'escudo':
                this.jugador.addEscudo(this.config.escudoCantidad);
                break;
            case 'estrella':
                this.jugador.setTurnosInvencible(this.config.turnosEstrella);
                break;
            default:
                // muro y torre se manejan con placement
                break;
        }
        return true;
    }

    _comprarYColocar(tipo, f, c) {
        const precio = this.getPrecio(tipo);
        if (this.dinero < precio) return false;
        if (this.board.getEntidad(f, c) !== null || this.board.esVacio(f, c)) return false;
        this.dinero -= precio;
        this.jugador.dinero = this.dinero;
        this.compras[tipo] = (this.compras[tipo] || 0) + 1;
        return true;
    }

    colocarMuro(f, c) {
        if (!this._comprarYColocar('muro', f, c)) return false;
        this.board.setEntidad(f, c, new Muro(f, c, this.config.vidaMuro));
        return true;
    }

    colocarTorre(f, c) {
        if (!this._comprarYColocar('torre', f, c)) return false;
        const torre = new Torre(f, c,
            this.config.vidaTorre, this.config.danioTorre,
            this.config.rangoTorre, this.config.cooldownTorre
        );
        this.board.setEntidad(f, c, torre);
        this.torres.push(torre);
        return true;
    }

    mejorarTorre(f, c) {
        const precio = this.getPrecio('mejoraTorre');
        if (this.dinero < precio) return false;
        const e = this.board.getEntidad(f, c);
        if (!(e instanceof Torre)) return false;

        this.dinero -= precio;
        this.jugador.dinero = this.dinero;
        this.compras['mejoraTorre'] = (this.compras['mejoraTorre'] || 0) + 1;

        e.mejorar();
        return true;
    }

    tickRapidos() {
        if (this.gameOver) return;
        for (let f = 0; f < this.board.filas; f++) {
            for (let c = 0; c < this.board.columnas; c++) {
                const e = this.board.getEntidad(f, c);
                if (!(e instanceof EnemigoRapido) || !e.estaVivo()) continue;
                e._primerMovTurno = true;
                if (this.jugador.estaVivo()) e.actuar(this.board);
                else e.moverRandom(this.board);
            }
        }
    }
}
