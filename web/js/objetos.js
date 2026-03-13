// Clase base Objeto
export class Objeto {
    constructor(fila, columna, simbolo) {
        this.fila = fila;
        this.columna = columna;
        this.simbolo = simbolo;
    }

    aplicar(aliado) {
        // Override en subclases
    }
}

export class Escudo extends Objeto {
    constructor(fila, columna, cantidad) {
        super(fila, columna, 'S');
        this.cantidad = cantidad;
        this.nombre = 'Escudo';
    }

    aplicar(aliado) {
        aliado.addEscudo(Math.floor(aliado.vidaMax * 0.5));
    }
}

export class Arma extends Objeto {
    constructor(fila, columna, cantidad) {
        super(fila, columna, 'W');
        this.cantidad = cantidad;
        this.nombre = '+50% Daño (20s)';
    }

    aplicar(aliado) {
        const bonus = Math.floor((aliado.danioBaseMax + aliado.danioExtra) * 0.5);
        aliado.addDanioExtra(bonus);
        aliado._armaTempBonus = (aliado._armaTempBonus || 0) + bonus;
        setTimeout(() => {
            aliado.danioExtra = Math.max(0, aliado.danioExtra - bonus);
            aliado._armaTempBonus = Math.max(0, (aliado._armaTempBonus || 0) - bonus);
        }, 20000);
    }
}

export class Estrella extends Objeto {
    constructor(fila, columna, turnos) {
        super(fila, columna, '*');
        this.turnos = turnos;
        this.nombre = 'Invencible';
    }

    aplicar(aliado) {
        aliado.setTurnosInvencible(this.turnos);
    }
}

export class Velocidad extends Objeto {
    constructor(fila, columna, duracion) {
        super(fila, columna, 'V');
        this.duracion = duracion;
        this.nombre = 'Velocidad';
    }

    aplicar(aliado) {
        aliado.setTurnosVelocidad(this.duracion);
    }
}

export class Pocion extends Objeto {
    constructor(fila, columna, curacion) {
        super(fila, columna, '+');
        this.curacion = curacion;
        this.nombre = 'Pocion +50%';
    }

    aplicar(aliado) {
        aliado.curar(Math.floor(aliado.vidaMax * 0.5));
    }
}

// Cofre — no se recoge automáticamente, requiere interacción del jugador
export class Cofre extends Objeto {
    constructor(fila, columna, costoBase, oleada) {
        super(fila, columna, 'C');
        this.costoAbrir = Math.floor(costoBase * (1 + oleada * 0.15));
        this.nombre = 'Cofre';
    }

    aplicar(_aliado) {
        // No-op: el cofre no se recoge automáticamente
    }
}

// Trampa — almacenada en array separado
export class Trampa {
    constructor(fila, columna, danio) {
        this.fila = fila;
        this.columna = columna;
        this.danio = danio;
        this.simbolo = '^';
    }

    getDanio() {
        return this.danio;
    }
}
