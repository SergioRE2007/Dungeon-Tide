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
            desc: 'Alta vida y daño cuerpo a cuerpo. Movimiento lento.',
            icono: '⚔️',
            vida: 300,
            danio: 40,
            cooldownAtaque: 2000,
            arma: 'espada',
            velocidadMoverMs: 150,
            habilidad: {
                nombre: 'Golpe Sísmico',
                cooldownMs: 10000,
                radio: 5,
                multiplicadorDanio: 3,
            },
        },
        arquero: {
            nombre: 'Arquero',
            desc: 'Poca vida pero ataca a distancia. Movimiento rápido.',
            icono: '🏹',
            vida: 120,
            danio: 20,
            cooldownAtaque: 800,
            rango: 6,
            arma: 'arco',
            velocidadMoverMs: 120,
            habilidad: {
                nombre: 'Flecha Colosal',
                cooldownMs: 8000,
                rango: 12,
                ancho: 1,
                multiplicadorDanio: 3,
            },
        },
        necromancer: {
            nombre: 'Necromancer',
            desc: 'Ataca a distancia e invoca aliados con su habilidad.',
            icono: '💀',
            vida: 100,
            danio: 15,
            cooldownAtaque: 1000,
            rango: 5,
            arma: 'baston',
            velocidadMoverMs: 130,
            habilidad: {
                nombre: 'Invocar Aliados',
                cooldownMs: 12000,
                numInvocaciones: 3,
                vidaInvocado: 80,
                danioInvocado: 10,
                visionInvocado: 8,
            },
        }
    },

    // Oleadas
    enemigosBase: 5,
    enemigosIncremento: 2,
    oleadaTanques: 3,
    oleadaRapidos: 5,
    escalaVidaOleada: 1.12,

    // Enemigos base
    vidaEnemigo: 80,
    danioEnemigo: 15,
    visionEnemigo: 10,

    vidaTanque: 250,
    danioTanque: 40,
    visionTanque: 30,

    vidaRapido: 50,
    danioRapido: 25,
    visionRapido: 30,

    // Enemigo Mago
    oleadaMagos: 4,
    vidaMago: 60,
    danioMago: 20,
    visionMago: 30,
    rangoMago: 5,

    // Recompensas
    recompensaEnemigo: 10,
    recompensaTanque: 30,
    recompensaRapido: 15,
    recompensaMago: 20,

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
    mejoraVidaPct: 0.30,           // +30% vida máxima por compra
    mejoraDanioPct: 0.40,          // +40% daño total por compra
    mejoraVelAtaquePct: 0.15,      // -15% cooldown por compra
    cooldownAtaqueMinMs: 0,
    escudoCantidad: 50,
    turnosEstrella: 30,
    curacionPocion: 80,

    // Escalado precios
    escalaPrecio: 1.35,
    escalaPrecioVelAtaque: 2,

    // Velocidad simulacion
    velocidadMs: 200,

    // Auto-oleadas
    descansoBaseMs: 2000,       // 2s de descanso inicial entre oleadas
    descansoMinMs: 500,         // mínimo 0.5s
    descansoReduccionPct: 0.10, // reduce 10% cada oleada

    // Boss
    oleadaBoss: 5,
    bossMultiplicadorVida: 3,
    bossMultiplicadorDanio: 2,

    // Drops
    probDrop: 0.15,

    // Dinero inicial
    dineroInicial: 100,
};

export default oleadasConfig;
