const oleadasConfig = {
    // Mapa
    filas: 19,
    columnas: 35,

    // Jugador
    vidaJugador: 200,
    danioJugador: 30,
    visionJugador: 8,
    cooldownEspada: 3,
    cooldownArco: 5,
    rangoArco: 5,

    // Clases Jugador
    clases: {
        guerrero: {
            nombre: 'Guerrero',
            desc: 'Alta vida y da\\u00F1o cuerpo a cuerpo. Movimiento lento.',
            vida: 300,
            danio: 40,
            cooldownAtaque: 3,
            arma: 'espada',
            velocidadMoverMs: 150, // Más lento
        },
        arquero: {
            nombre: 'Arquero',
            desc: 'Poca vida pero ataca a distancia. Movimiento r\\u00E1pido.',
            vida: 120,
            danio: 20, // Daño base de flecha
            cooldownAtaque: 0, // Arco no usa CD tradicional
            rango: 6,
            arma: 'arco',
            velocidadMoverMs: 80, // Más rápido
        }
    },

    // Oleadas
    enemigosBase: 5,
    enemigosIncremento: 2,
    oleadaTanques: 3,
    oleadaRapidos: 5,
    escalaVidaOleada: 1.15,

    // Enemigos base
    vidaEnemigo: 80,
    danioEnemigo: 15,
    visionEnemigo: 8,

    vidaTanque: 250,
    danioTanque: 40,
    visionTanque: 10,

    vidaRapido: 50,
    danioRapido: 25,
    visionRapido: 10,

    // Recompensas
    recompensaEnemigo: 10,
    recompensaTanque: 30,
    recompensaRapido: 15,

    // Tienda — precios base
    precioMuro: 5,
    precioTorre: 50,
    precioMejoraVida: 20,
    precioMejoraDanio: 15,
    precioMejoraVelAtaque: 25,
    precioPocion: 10,
    precioEscudo: 15,
    precioEstrella: 40,
    precioMejoraTorre: 30,

    // Tienda — valores
    vidaMuro: 100,
    vidaTorre: 150,
    danioTorre: 20,
    rangoTorre: 4,
    cooldownTorre: 4,
    mejoraVidaCantidad: 50,
    mejoraDanioCantidad: 10,
    escudoCantidad: 50,
    turnosEstrella: 30,
    curacionPocion: 80,

    // Escalado precios
    escalaPrecio: 1.5,

    // Velocidad simulacion
    velocidadMs: 200,

    // Boss
    oleadaBoss: 5,
    bossMultiplicadorVida: 3,
    bossMultiplicadorDanio: 2,

    // Drops
    probDrop: 0.15,
};

export default oleadasConfig;
