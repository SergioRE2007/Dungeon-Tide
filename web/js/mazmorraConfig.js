const mazmorraConfig = {
    // Habitación (Room)
    filasHabitacion: 14,
    columnasHabitacion: 22,

    // Piso (Floor) layout
    minHabitaciones: 7,        // min rooms per floor
    maxHabitaciones: 14,       // max rooms per floor
    incrementoHabitaciones: 1, // extra rooms per floor
    tamanoGridPiso: 9,         // grid size for room placement (9x9)

    // Room type distribution
    habitacionesTesoro: 1,     // treasure rooms per floor
    habitacionesTienda: 1,     // shop rooms per floor

    // Jugador (Player) - reuse oleadas classes
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

    // Hitboxes
    hitboxJugador: 0.25,
    hitboxEnemigo: 0.4,
    hitboxTanque: 0.5,
    hitboxRapido: 0.35,
    hitboxMago: 0.4,
    meleeRange: 0.9,

    // Enemigos base (per room, floor 1)
    enemigosBaseHabitacion: 4,  // enemies in a normal room
    enemigosBossExtra: 3,       // extra minions in boss room
    vidaEnemigo: 120,
    danioEnemigo: 18,
    visionEnemigo: 10,

    vidaTanque: 400,
    danioTanque: 50,
    visionTanque: 30,

    vidaRapido: 70,
    danioRapido: 30,
    visionRapido: 30,

    vidaMago: 90,
    danioMago: 25,
    visionMago: 30,
    rangoMago: 5,

    // Enemy type unlock (floor number)
    pisoTanques: 2,
    pisoRapidos: 3,
    pisoMagos: 4,

    // Floor scaling
    escalaVidaPiso: 1.25,       // enemy HP multiplier per floor
    escalaDanioPiso: 1.15,      // enemy damage multiplier per floor
    incrementoEnemigosPiso: 1,  // extra enemies per room per floor
    maxEnemigosPorHabitacion: 12,

    // Boss
    bossMultiplicadorVida: 4,
    bossMultiplicadorDanio: 2.5,

    // Recompensas (gold)
    recompensaEnemigo: 15,
    recompensaTanque: 45,
    recompensaRapido: 20,
    recompensaMago: 30,
    escalaOroOleada: 1.15,      // gold scaling per floor

    // Tienda - precios
    precioPocion: 10,
    precioEscudo: 15,
    precioMuro: 5,

    // Tienda - valores
    vidaMuro: 100,
    escudoCantidad: 50,
    curacionPocion: 80,

    // Escalado precios
    escalaPrecio: 1.5,

    // Drops
    probDrop: 0.20,             // higher than oleadas since less enemies per room

    // Cofres (gacha)
    probCofreEnemigo: 0.03,
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
    dineroInicial: 50,

    // Stamina (sprint)
    staminaMax: 100,
    staminaCoste: 30,
    staminaRegen: 20,
    sprintMultiplier: 0.30,

    // XP / Niveles
    xpBase: 80,
    xpEscala: 1.18,
    xpEnemigo: 25,
    xpTanque: 60,
    xpRapido: 30,
    xpMago: 40,
    xpBoss: 250,
    xpEscalaPiso: 0.15,            // +15% XP per floor
    xpBonusHabitacion: 20,         // XP bonus for clearing a room
    xpBonusPiso: 100,              // XP bonus for clearing a floor (killing boss)
    mejoraVidaNivelPct: 0.30,
    mejoraDanioNivelPct: 0.30,
    mejoraVelAtaqueNivelPct: 0.22,
    bonusAutoVida: 0.07,
    bonusAutoDanio: 0.07,
    nivelPerk: 7,

    // Velocidad simulacion
    velocidadMs: 200,

    // Puertas (doors)
    anchoPuerta: 3,                // door width in cells

    // Recompensa al completar piso
    curacionPisoPct: 0.50,         // heal 50% of max HP when clearing a floor
};

export default mazmorraConfig;
