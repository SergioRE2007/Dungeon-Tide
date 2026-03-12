const baseConfig = {
    // Mapa
    filas: 21,
    columnas: 39,

    // Balas
    danioBala: 1,
    velocidadBala: 1,

    // Escalado daño (no aplica, siempre 1)
    danioIncrementoCadaSeg: 0,

    // Velocidad simulacion (tick de proyectiles)
    velocidadMs: 150,
};

function _makeClase(vida, velocidadMoverMs, velocidadContinua) {
    return {
        bullethell: {
            nombre: 'Superviviente',
            vida,
            danio: 0,
            cooldownAtaque: 99999,
            arma: 'espada',
            velocidadMoverMs,
            velocidadContinua,
            habilidad: null,
        },
    };
}

const dificultades = {
    facil: {
        ...baseConfig,
        vidaJugador: 5,
        velocidadMoverMs: 70,
        hitboxJugador: 0.4,
        intervaloSpawnMs: 1800,
        intervaloReduccionPct: 0.03,
        intervaloMinMs: 400,
        balasPerSpawn: 6,
        balasMaxPerSpawn: 22,
        balasIncrementoCadaSeg: 0.10,
        magoSpawnSeg: 30,
        magoIntervaloMs: 3000,
        magoIntervaloMinMs: 1200,
        tiempoCuracionSeg: 10,
        turnosInvencibleHit: 14,
        clases: _makeClase(5, 70, 10),
    },
    normal: {
        ...baseConfig,
        vidaJugador: 3,
        velocidadMoverMs: 80,
        hitboxJugador: 0.4,
        intervaloSpawnMs: 1400,
        intervaloReduccionPct: 0.04,
        intervaloMinMs: 250,
        balasPerSpawn: 8,
        balasMaxPerSpawn: 30,
        balasIncrementoCadaSeg: 0.15,
        magoSpawnSeg: 20,
        magoIntervaloMs: 2500,
        magoIntervaloMinMs: 800,
        tiempoCuracionSeg: 20,
        turnosInvencibleHit: 10,
        clases: _makeClase(3, 80, 9),
    },
    dificil: {
        ...baseConfig,
        vidaJugador: 2,
        velocidadMoverMs: 80,
        hitboxJugador: 0.4,
        intervaloSpawnMs: 1000,
        intervaloReduccionPct: 0.05,
        intervaloMinMs: 200,
        balasPerSpawn: 10,
        balasMaxPerSpawn: 35,
        balasIncrementoCadaSeg: 0.20,
        magoSpawnSeg: 12,
        magoIntervaloMs: 2000,
        magoIntervaloMinMs: 600,
        tiempoCuracionSeg: 30,
        turnosInvencibleHit: 7,
        clases: _makeClase(2, 80, 9),
    },
};

export default dificultades;
