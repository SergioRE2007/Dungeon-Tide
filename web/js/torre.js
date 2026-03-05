import { Entidad, Enemigo } from './entidad.js';

export class Torre extends Entidad {
    constructor(fila, columna, vida, danio, rango, cooldown) {
        super(fila, columna, 'R', vida); // R de torRe
        this.danio = danio;
        this.rango = rango;
        this.cooldownMax = cooldown;
        this.cooldownActual = 0;
        this.nivel = 1;
    }

    actuar(board) {
        if (this.cooldownActual > 0) {
            this.cooldownActual--;
            return null;
        }

        const objetivo = this.buscarCercano(Enemigo, this.rango, board);
        if (objetivo) {
            this.cooldownActual = this.cooldownMax;
            this.danioInfligido += this.danio;
            objetivo.recibirDanio(this.danio);
            objetivo.danioRecibido += this.danio;
            if (!objetivo.estaVivo()) {
                this.kills++;
                board.setEntidad(objetivo.fila, objetivo.columna, null);
            }
            return objetivo;
        }
        return null;
    }

    mejorar() {
        this.nivel++;
        this.danio = Math.floor(this.danio * 1.4);
        this.rango += 1;
        this.vidaMax = Math.floor(this.vidaMax * 1.3);
        this.vida = this.vidaMax;
    }
}
