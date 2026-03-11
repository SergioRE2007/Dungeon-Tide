const bulletHellConfig = {
    // Mapa
    filas: 21,
    columnas: 39,

    // Jugador
    vidaJugador: 100,
    velocidadMoverMs: 80,

    // Balas
    danioBala: 10,
    velocidadBala: 1,           // celdas por tick

    // Spawn
    intervaloSpawnMs: 2000,     // ms entre oleadas de balas
    intervaloReduccionPct: 0.03,// reduce cada ciclo
    intervaloMinMs: 300,
    balasPerSpawn: 3,
    balasMaxPerSpawn: 20,
    balasIncrementoCadaSeg: 0.1,// +0.1 balas por segundo transcurrido

    // Escalado daño
    danioIncrementoCadaSeg: 0.5,// +0.5 daño por segundo

    // Velocidad simulacion (tick de proyectiles)
    velocidadMs: 150,

    // Clase pseudo-config (para Jugador)
    clases: {
        bullethell: {
            nombre: 'Superviviente',
            vida: 100,
            danio: 0,
            cooldownAtaque: 99999,
            arma: 'espada',
            velocidadMoverMs: 80,
            habilidad: null,
        },
    },
};

export default bulletHellConfig;
