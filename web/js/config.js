const config = {
    // General
    semilla: -1,
    velocidadMs: 100,

    // Mapa
    filas: 20,
    columnas: 37,
    tipoMapa: "arena",
    numMuro: 60,
    probPegarMuro: 70,

    // Aliados
    numAliado: 10,
    vidaAliado: 100,
    danioBaseAliadoMin: 10,
    danioBaseAliadoMax: 30,
    visionAliado: 5,

    // Enemigo Normal
    numEnemigo: 10,
    vidaEnemigo: 100,
    danioEnemigoMin: 20,
    danioEnemigoMax: 50,
    visionEnemigo: 5,

    // Enemigo Tanque
    numEnemigoTanque: 1,
    vidaTanque: 3000,
    danioTanqueMin: 100,
    danioTanqueMax: 200,
    visionTanque: 10,

    // Enemigo Rapido
    numEnemigoRapido: 2,
    vidaRapido: 200,
    danioRapidoMin: 100,
    danioRapidoMax: 100,
    visionRapido: 10,

    // Trampas
    numTrampa: 15,
    danioTrampa: 80,

    // Objetos
    turnosSpawnObjeto: 1,
    numEscudo: 5,
    numArma: 3,
    numEstrella: 0,
    numVelocidad: 3,
    numPocion: 3,

    // Valores de objetos
    valorEscudo: 50,
    valorArma: 20,
    turnosEstrella: 30,
    duracionVelocidad: 30,
    curacionPocion: 50,

    // Modo libre: la partida no termina sola, solo al pulsar Finalizar
    modoLibre: false,
};

export default config;
