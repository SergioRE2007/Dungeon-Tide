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
        intervaloSpawnMs: 2200,
        intervaloReduccionPct: 0.02,
        intervaloMinMs: 900,
        balasPerSpawn: 6,
        balasMaxPerSpawn: 22,
        balasIncrementoCadaSeg: 0.08,
        magoSpawnSeg: 30,
        magoDuracionSeg: 20,
        magoPausaSeg: 20,
        magoBalasAnillo: 14,
        magoBalasAnilloMax: 24,
        tiempoCuracionSeg: 10,
        turnosInvencibleHit: 10,
        clases: _makeClase(5, 70, 10),
    },
    normal: {
        ...baseConfig,
        vidaJugador: 3,
        velocidadMoverMs: 80,
        hitboxJugador: 0.4,
        intervaloSpawnMs: 1800,
        intervaloReduccionPct: 0.03,
        intervaloMinMs: 700,
        balasPerSpawn: 8,
        balasMaxPerSpawn: 30,
        balasIncrementoCadaSeg: 0.12,
        magoSpawnSeg: 20,
        magoDuracionSeg: 18,
        magoPausaSeg: 15,
        magoBalasAnillo: 16,
        magoBalasAnilloMax: 28,
        tiempoCuracionSeg: 20,
        turnosInvencibleHit: 10,
        clases: _makeClase(3, 80, 9),
    },
    dificil: {
        ...baseConfig,
        vidaJugador: 2,
        velocidadMoverMs: 80,
        hitboxJugador: 0.3,
        intervaloSpawnMs: 1400,
        intervaloReduccionPct: 0.04,
        intervaloMinMs: 500,
        balasPerSpawn: 10,
        balasMaxPerSpawn: 35,
        balasIncrementoCadaSeg: 0.15,
        magoSpawnSeg: 15,
        magoDuracionSeg: 18,
        magoPausaSeg: 12,
        magoBalasAnillo: 18,
        magoBalasAnilloMax: 32,
        tiempoCuracionSeg: 30,
        turnosInvencibleHit: 10,
        clases: _makeClase(2, 80, 9),
    },
    custom: {
        ...baseConfig,
        vidaJugador: 99,
        velocidadMoverMs: 70,
        hitboxJugador: 0.4,
        intervaloSpawnMs: 99999,
        intervaloReduccionPct: 0,
        intervaloMinMs: 99999,
        balasPerSpawn: 10,
        balasMaxPerSpawn: 30,
        balasIncrementoCadaSeg: 0,
        magoSpawnSeg: 99999,
        magoDuracionSeg: 99999,
        magoPausaSeg: 99999,
        magoBalasAnillo: 16,
        magoBalasAnilloMax: 28,
        tiempoCuracionSeg: 5,
        turnosInvencibleHit: 10,
        clases: _makeClase(99, 70, 10),
    },
};

export default dificultades;
