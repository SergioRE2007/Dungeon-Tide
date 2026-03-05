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
    }

    aplicar(aliado) {
        aliado.addEscudo(this.cantidad);
    }
}

export class Arma extends Objeto {
    constructor(fila, columna, cantidad) {
        super(fila, columna, 'W');
        this.cantidad = cantidad;
    }

    aplicar(aliado) {
        aliado.addDanioExtra(this.cantidad);
    }
}

export class Estrella extends Objeto {
    constructor(fila, columna, turnos) {
        super(fila, columna, '*');
        this.turnos = turnos;
    }

    aplicar(aliado) {
        aliado.setTurnosInvencible(this.turnos);
    }
}

export class Velocidad extends Objeto {
    constructor(fila, columna, duracion) {
        super(fila, columna, 'V');
        this.duracion = duracion;
    }

    aplicar(aliado) {
        aliado.setTurnosVelocidad(this.duracion);
    }
}

export class Pocion extends Objeto {
    constructor(fila, columna, curacion) {
        super(fila, columna, '+');
        this.curacion = curacion;
    }

    aplicar(aliado) {
        aliado.curar(this.curacion);
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
