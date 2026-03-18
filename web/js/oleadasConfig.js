const oleadasConfig = {
    // Mapa
    filas: 20,
    columnas: 34,

    // Jugador
    vidaJugador: 200,
    danioJugador: 30,
    visionJugador: 8,
    cooldownEspada: 3,
    cooldownArco: 5,
    rangoArco: 5,

    // Hitboxes
    hitboxJugador: 0.25,
    hitboxEnemigo: 0.4,
    hitboxTanque: 0.5,
    hitboxRapido: 0.35,
    hitboxMago: 0.4,
    meleeRange: 0.9,

    // Clases Jugador
    clases: {
        guerrero: {
            nombre: 'Guerrero',
            desc: 'Alta vida y daño cuerpo a cuerpo. Movimiento lento.',
            icono: '⚔️',
            vida: 500,
            danio: 60,
            cooldownAtaque: 1800,
            arma: 'espada',
            velocidadMoverMs: 120,
            velocidadContinua: 7,
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
            vida: 200,
            danio: 35,
            cooldownAtaque: 700,
            rango: 7,
            arma: 'arco',
            velocidadMoverMs: 120,
            velocidadContinua: 9,
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
            vida: 160,
            danio: 25,
            cooldownAtaque: 900,
            rango: 6,
            arma: 'baston',
            velocidadMoverMs: 110,
            velocidadContinua: 8,
            habilidad: {
                nombre: 'Invocar Aliados',
                cooldownMs: 12000,
                numInvocaciones: 3,
                vidaInvocado: 120,
                danioInvocado: 15,
                visionInvocado: 8,
            },
        }
    },

    // Oleadas
    enemigosBase: 5,
    enemigosIncremento: 2,
    oleadaTanques: 3,
    oleadaRapidos: 5,
    escalaVidaOleada: 1.4,
    escalaDanioOleada: 1.4,
    escalaOroOleada: 1.3,

    // Enemigos base
    vidaEnemigo: 120,
    danioEnemigo: 18,
    visionEnemigo: 10,

    vidaTanque: 400,
    danioTanque: 50,
    visionTanque: 30,

    vidaRapido: 70,
    danioRapido: 30,
    visionRapido: 30,

    // Enemigo Mago
    oleadaMagos: 4,
    vidaMago: 90,
    danioMago: 25,
    visionMago: 30,
    rangoMago: 5,

    // Recompensas
    recompensaEnemigo: 15,
    recompensaTanque: 45,
    recompensaRapido: 20,
    recompensaMago: 30,

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
    mejoraDanioPct: 0.30,          // +40% daño total por compra
    mejoraVelAtaquePct: 0.15,      // -15% cooldown por compra
    cooldownAtaqueMinMs: 0,
    escudoCantidad: 50,
    turnosEstrella: 30,
    curacionPocion: 80,

    // Escalado precios
    escalaPrecio: 1.65,
    escalaPrecioVelAtaque: 2,

    // Velocidad simulacion
    velocidadMs: 200,

    // Auto-oleadas
    descansoBaseMs: 2000,       // 2s de descanso inicial entre oleadas
    descansoMinMs: 500,         // mínimo 0.5s
    descansoReduccionPct: 0.10, // reduce 10% cada oleada

    // Avance forzado (a partir de oleada N, la oleada acaba sola tras X segundos)
    oleadaForzadaDesde: 5,
    oleadaForzadaDuracionMs: 20000,   // 20s en la oleada 15
    oleadaForzadaReduccionPct: 0.08,  // -8% por cada oleada a partir de la 15
    oleadaForzadaMinMs: 4000,         // mínimo 4s

    // Refuerzos continuos (desactivados)
    oleadaRefuerzos: 99999,
    intervaloRefuerzos: 99999,

    // Boss
    oleadaBoss: 5,
    bossMultiplicadorVida: 3,
    bossMultiplicadorDanio: 2,

    // Drops
    probDrop: 0.15,

    // Cofres (gacha)
    probCofreEnemigo: 0.02,
    costoCofreBase: 30,
    cofreValoresBase: {
        roboVida: 0.03,
        gananciaOro: 0.10,
        velocidadExtra: 0.06,
        reduccionCooldownHab: 0.08,
    },
    cofreTiers: [
        { id: 'normal',     color: '#9ca3af', peso: 60, mult: 1.0 },
        { id: 'raro',       color: '#3b82f6', peso: 25, mult: 1.8 },
        { id: 'epico',      color: '#a855f7', peso: 12, mult: 3.0 },
        { id: 'legendario', color: '#eab308', peso: 3,  mult: 5.0 },
    ],

    // Dinero inicial
    dineroInicial: 100,

    // Stamina (sprint)
    staminaMax: 100,
    staminaCoste: 30,       // consumo por segundo al correr
    staminaRegen: 20,       // regeneración por segundo al no correr
    sprintMultiplier: 0.30, // +30% velocidad

    // XP / Niveles
    xpBase: 80,             // XP para nivel 2 (más lento, cada nivel importa)
    xpEscala: 1.18,         // factor exponencial por nivel (crece rápido)
    xpEnemigo: 20,
    xpTanque: 50,
    xpRapido: 25,
    xpMago: 35,
    xpBoss: 200,
    xpEscalaOleada: 0.15,          // +15% XP por oleada (escala con dificultad)
    xpBonusOleada: 40,             // bonus XP al completar oleada (×numOleada)
    mejoraVidaNivelPct: 0.30,      // +30% vida por nivel (elección)
    mejoraDanioNivelPct: 0.30,     // +30% daño por nivel (elección)
    mejoraVelAtaqueNivelPct: 0.22, // -22% cooldown por nivel (elección)
    bonusAutoVida: 0.07,           // +7% vida automático cada nivel
    bonusAutoDanio: 0.07,          // +7% daño automático cada nivel
    nivelPerk: 7,                  // cada 7 niveles, perk especial
};

export default oleadasConfig;
