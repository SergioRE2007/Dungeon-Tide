import * as Rng from './rng.js';
import { Muro, Aliado, Enemigo, EnemigoTanque, EnemigoRapido } from './entidad.js';
import { Escudo, Arma, Estrella, Velocidad, Pocion, Trampa } from './objetos.js';

export class GameBoard {
    constructor(filas, columnas) {
        this.filas = filas;
        this.columnas = columnas;
        this.entidades = Array.from({ length: filas }, () => new Array(columnas).fill(null));
        this.objetos = Array.from({ length: filas }, () => new Array(columnas).fill(null));
        this.trampas = Array.from({ length: filas }, () => new Array(columnas).fill(null));
        this.vacio = Array.from({ length: filas }, () => new Array(columnas).fill(false));
    }

    esVacio(f, c) { return this.vacio[f][c]; }
    setVacio(f, c, v) { this.vacio[f][c] = v; }

    getEntidad(f, c) { return this.entidades[f][c]; }
    setEntidad(f, c, e) { this.entidades[f][c] = e; }

    getObjeto(f, c) { return this.objetos[f][c]; }
    setObjeto(f, c, o) { this.objetos[f][c] = o; }

    getTrampa(f, c) { return this.trampas[f][c]; }
    setTrampa(f, c, t) { this.trampas[f][c] = t; }

    // ==================== Bordes ====================

    colocarBordes() {
        for (let c = 0; c < this.columnas; c++) {
            this.entidades[0][c] = new Muro(0, c);
            this.entidades[this.filas - 1][c] = new Muro(this.filas - 1, c);
        }
        for (let f = 1; f < this.filas - 1; f++) {
            this.entidades[f][0] = new Muro(f, 0);
            this.entidades[f][this.columnas - 1] = new Muro(f, this.columnas - 1);
        }
    }

    // ==================== Generacion de mapa ====================

    generarMapa(config) {
        switch (config.tipoMapa) {
            case "abierto":
                this._generarMuros(config.numMuro, config.probPegarMuro);
                break;
            case "salas":
                this._generarMapaSalas(config.numMuro);
                break;
            case "laberinto":
                this._generarMapaLaberinto();
                break;
            case "arena":
                this._generarMapaArena();
                break;
            case "vacio":
                // Solo bordes, nada mas
                break;
            default:
                this._generarMuros(config.numMuro, config.probPegarMuro);
                break;
        }
    }

    _generarMuros(numMuros, probPegarPct) {
        const probPegar = probPegarPct / 100.0;
        const probCambioDir = 0.20;
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        let ultimaFila = -1, ultimaCol = -1;
        let dirActual = 0;
        let colocados = 0;

        while (colocados < numMuros) {
            if (ultimaFila !== -1 && Rng.nextDouble() < probPegar) {
                if (Rng.nextDouble() < probCambioDir) {
                    dirActual = Rng.nextInt(4);
                }
                const fila = ultimaFila + dirs[dirActual][0];
                const col = ultimaCol + dirs[dirActual][1];
                if (fila > 0 && fila < this.filas - 1 && col > 0 && col < this.columnas - 1
                    && this.entidades[fila][col] === null) {
                    this.entidades[fila][col] = new Muro(fila, col);
                    ultimaFila = fila;
                    ultimaCol = col;
                    colocados++;
                } else {
                    dirActual = Rng.nextInt(4);
                }
            } else {
                const f = 1 + Rng.nextInt(this.filas - 2);
                const c = 1 + Rng.nextInt(this.columnas - 2);
                if (this.entidades[f][c] === null) {
                    this.entidades[f][c] = new Muro(f, c);
                    ultimaFila = f;
                    ultimaCol = c;
                    dirActual = Rng.nextInt(4);
                    colocados++;
                }
            }
        }
    }

    _generarMapaSalas(topeMuros) {
        let murosColocados = 0;
        const numSalas = 3 + Rng.nextInt(4);

        for (let s = 0; s < numSalas && murosColocados < topeMuros; s++) {
            const anchoSala = 3 + Rng.nextInt(5);
            const altoSala = 3 + Rng.nextInt(5);
            const inicioF = 1 + Rng.nextInt(this.filas - 2 - altoSala);
            const inicioC = 1 + Rng.nextInt(this.columnas - 2 - anchoSala);

            const numPuertas = 1 + Rng.nextInt(2);
            const puertas = [];
            for (let p = 0; p < numPuertas; p++) {
                const lado = Rng.nextInt(4);
                switch (lado) {
                    case 0:
                        puertas.push([inicioF, inicioC + 1 + Rng.nextInt(anchoSala - 2)]);
                        break;
                    case 1:
                        puertas.push([inicioF + altoSala - 1, inicioC + 1 + Rng.nextInt(anchoSala - 2)]);
                        break;
                    case 2:
                        puertas.push([inicioF + 1 + Rng.nextInt(altoSala - 2), inicioC]);
                        break;
                    case 3:
                        puertas.push([inicioF + 1 + Rng.nextInt(altoSala - 2), inicioC + anchoSala - 1]);
                        break;
                }
            }

            for (let f = inicioF; f < inicioF + altoSala && f < this.filas - 1; f++) {
                for (let c = inicioC; c < inicioC + anchoSala && c < this.columnas - 1; c++) {
                    const esBorde = (f === inicioF || f === inicioF + altoSala - 1 || c === inicioC || c === inicioC + anchoSala - 1);
                    if (!esBorde) continue;

                    let esPuerta = false;
                    for (const puerta of puertas) {
                        if (f === puerta[0] && c === puerta[1]) {
                            esPuerta = true;
                            break;
                        }
                    }
                    if (esPuerta) continue;

                    if (this.entidades[f][c] === null && murosColocados < topeMuros) {
                        this.entidades[f][c] = new Muro(f, c);
                        murosColocados++;
                    }
                }
            }
        }
    }

    _generarMapaLaberinto() {
        for (let f = 1; f < this.filas - 1; f++) {
            for (let c = 1; c < this.columnas - 1; c++) {
                if (this.entidades[f][c] === null) {
                    this.entidades[f][c] = new Muro(f, c);
                }
            }
        }

        const celdasF = Math.floor((this.filas - 2) / 2);
        const celdasC = Math.floor((this.columnas - 2) / 2);
        const visitado = Array.from({ length: celdasF }, () => new Array(celdasC).fill(false));
        const pila = [];

        visitado[0][0] = true;
        pila.push([0, 0]);
        const realF = 1 + 0 * 2;
        const realC = 1 + 0 * 2;
        this.entidades[realF][realC] = null;

        const dirsCelda = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        while (pila.length > 0) {
            const actual = pila[pila.length - 1];
            const cf = actual[0], cc = actual[1];

            const vecinos = [];
            for (const d of dirsCelda) {
                const nf = cf + d[0], nc = cc + d[1];
                if (nf >= 0 && nf < celdasF && nc >= 0 && nc < celdasC && !visitado[nf][nc]) {
                    vecinos.push([nf, nc]);
                }
            }

            if (vecinos.length === 0) {
                pila.pop();
            } else {
                const idx = Rng.nextInt(vecinos.length);
                const [nf, nc] = vecinos[idx];
                visitado[nf][nc] = true;

                const destF = 1 + nf * 2;
                const destC = 1 + nc * 2;
                this.entidades[destF][destC] = null;

                const paredF = 1 + cf * 2 + (nf - cf);
                const paredC = 1 + cc * 2 + (nc - cc);
                if (paredF > 0 && paredF < this.filas - 1 && paredC > 0 && paredC < this.columnas - 1) {
                    this.entidades[paredF][paredC] = null;
                }

                pila.push([nf, nc]);
            }
        }

        // Eliminar 30% de muros aleatoriamente
        for (let f = 1; f < this.filas - 1; f++) {
            for (let c = 1; c < this.columnas - 1; c++) {
                if (this.entidades[f][c] instanceof Muro && Rng.nextDouble() < 0.30) {
                    this.entidades[f][c] = null;
                }
            }
        }
    }

    _generarMapaArena() {
        const altoArena = Math.floor(this.filas * 0.6);
        const anchoArena = Math.floor(this.columnas * 0.6);
        const inicioF = Math.floor((this.filas - altoArena) / 2);
        const inicioC = Math.floor((this.columnas - anchoArena) / 2);
        const finF = inicioF + altoArena - 1;
        const finC = inicioC + anchoArena - 1;

        const entradaArriba = Math.floor((inicioC + finC) / 2);
        const entradaAbajo = Math.floor((inicioC + finC) / 2);
        const entradaIzq = Math.floor((inicioF + finF) / 2);
        const entradaDer = Math.floor((inicioF + finF) / 2);

        for (let f = inicioF; f <= finF; f++) {
            for (let c = inicioC; c <= finC; c++) {
                const esBorde = (f === inicioF || f === finF || c === inicioC || c === finC);
                if (!esBorde) continue;
                if (f < 1 || f >= this.filas - 1 || c < 1 || c >= this.columnas - 1) continue;

                if (f === inicioF && c >= entradaArriba - 1 && c <= entradaArriba + 1) continue;
                if (f === finF && c >= entradaAbajo - 1 && c <= entradaAbajo + 1) continue;
                if (c === inicioC && f >= entradaIzq - 1 && f <= entradaIzq + 1) continue;
                if (c === finC && f >= entradaDer - 1 && f <= entradaDer + 1) continue;

                if (this.entidades[f][c] === null) {
                    this.entidades[f][c] = new Muro(f, c);
                }
            }
        }

        const murosExtra = Math.floor((this.filas + this.columnas) / 2);
        let colocados = 0;
        while (colocados < murosExtra) {
            const f = 1 + Rng.nextInt(this.filas - 2);
            const c = 1 + Rng.nextInt(this.columnas - 2);
            if (this.entidades[f][c] === null) {
                this.entidades[f][c] = new Muro(f, c);
                colocados++;
            }
        }
    }

    // ==================== Colocacion de entidades ====================

    colocarEntidades(config) {
        this._colocarEntidadesTipo("enemigo", config.numEnemigo, config.vidaEnemigo,
            config.danioEnemigoMin, config.danioEnemigoMax, config.visionEnemigo);
        this._colocarEntidadesTipo("tanque", config.numEnemigoTanque, config.vidaTanque,
            config.danioTanqueMin, config.danioTanqueMax, config.visionTanque);
        this._colocarEntidadesTipo("rapido", config.numEnemigoRapido, config.vidaRapido,
            config.danioRapidoMin, config.danioRapidoMax, config.visionRapido);
        this._colocarEntidadesTipo("aliado", config.numAliado, config.vidaAliado,
            config.danioBaseAliadoMin, config.danioBaseAliadoMax, config.visionAliado);
    }

    _colocarEntidadesTipo(tipo, num, vida, danioMin, danioMax, vision) {
        for (let i = 0; i < num; i++) {
            let colocado = false;
            while (!colocado) {
                const f = Rng.nextInt(this.filas);
                const c = Rng.nextInt(this.columnas);
                if (this.entidades[f][c] === null) {
                    switch (tipo) {
                        case "enemigo":
                            this.entidades[f][c] = new Enemigo(f, c, vida, danioMin, danioMax, vision);
                            break;
                        case "tanque":
                            this.entidades[f][c] = new EnemigoTanque(f, c, vida, danioMin, danioMax, vision);
                            break;
                        case "rapido":
                            this.entidades[f][c] = new EnemigoRapido(f, c, vida, danioMin, danioMax, vision);
                            break;
                        case "aliado":
                            this.entidades[f][c] = new Aliado(f, c, vida, danioMin, danioMax, vision);
                            break;
                    }
                    colocado = true;
                }
            }
        }
    }

    // ==================== Objetos ====================

    generarObjetos(config) {
        this._colocarObjetosTipo(config.numEscudo, "escudo", config);
        this._colocarObjetosTipo(config.numArma, "arma", config);
        this._colocarObjetosTipo(config.numEstrella, "estrella", config);
        this._colocarObjetosTipo(config.numVelocidad, "velocidad", config);
        this._colocarObjetosTipo(config.numPocion, "pocion", config);
    }

    _colocarObjetosTipo(cantidad, tipo, config) {
        let colocados = 0;
        while (colocados < cantidad) {
            const f = Rng.nextInt(this.filas);
            const c = Rng.nextInt(this.columnas);
            if (this.entidades[f][c] === null && this.objetos[f][c] === null) {
                this.objetos[f][c] = this._crearObjeto(tipo, f, c, config);
                colocados++;
            }
        }
    }

    _crearObjeto(tipo, f, c, config) {
        switch (tipo) {
            case "escudo": return new Escudo(f, c, config.valorEscudo);
            case "arma": return new Arma(f, c, config.valorArma);
            case "estrella": return new Estrella(f, c, config.turnosEstrella);
            case "velocidad": return new Velocidad(f, c, config.duracionVelocidad);
            case "pocion": return new Pocion(f, c, config.curacionPocion);
            default: return new Escudo(f, c, config.valorEscudo);
        }
    }

    spawnObjetoRandom(config) {
        let intentos = 0;
        while (intentos < 100) {
            const f = Rng.nextInt(this.filas);
            const c = Rng.nextInt(this.columnas);
            if (this.entidades[f][c] === null && this.objetos[f][c] === null) {
                const r = Rng.nextDouble();
                if (r < 0.30) {
                    this.objetos[f][c] = new Escudo(f, c, config.valorEscudo);
                } else if (r < 0.50) {
                    this.objetos[f][c] = new Arma(f, c, config.valorArma);
                } else if (r < 0.70) {
                    this.objetos[f][c] = new Velocidad(f, c, config.duracionVelocidad);
                } else if (r < 0.85) {
                    this.objetos[f][c] = new Pocion(f, c, config.curacionPocion);
                } else {
                    this.objetos[f][c] = new Estrella(f, c, config.turnosEstrella);
                }
                return;
            }
            intentos++;
        }
    }

    // ==================== Trampas ====================

    generarTrampas(num, danio) {
        let colocadas = 0;
        while (colocadas < num) {
            const f = 1 + Rng.nextInt(this.filas - 2);
            const c = 1 + Rng.nextInt(this.columnas - 2);
            if (this.entidades[f][c] === null && this.objetos[f][c] === null && this.trampas[f][c] === null) {
                this.trampas[f][c] = new Trampa(f, c, danio);
                colocadas++;
            }
        }
    }
}
