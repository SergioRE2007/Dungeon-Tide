// ==================== Sistema de Audio ====================
// Gestor centralizado de sonidos y música.
// Para añadir un sonido: colocar el archivo en web/sounds/ y
// actualizar la ruta correspondiente en SONIDOS.

const SONIDOS = {
    // --- Ataques jugador ---
    espada:             'sounds/espada.mp3',
    arco:               'sounds/arco.mp3',
    baston:             'sounds/baston.mp3',
    habilidad:          'sounds/habilidad.mp3',

    // --- Jugador ---
    danioRecibido:      'sounds/danio_recibido1.wav',
    danioRecibido2:     'sounds/danio_recibido2.wav',
    danioRecibido3:     'sounds/danio_recibido3.wav',
    curar:              'sounds/curar.mp3',
    escudo:             'sounds/escudo.mp3',
    recogerObjeto:      'sounds/recoger_objeto.mp3',
    recogerPocionDanio: 'sounds/recoger_Pocion_de_daño.wav',
    recogerPocionEscudo:'sounds/recoger_Pocion_de_escudo.wav',
    muerte:             'sounds/muerte.mp3',

    // --- Enemigos ---
    enemigoMuere:       'sounds/enemigo_muere.mp3',
    bossDerrotado:      'sounds/boss_derrotado.mp3',

    // --- Eventos de juego ---
    oleadaInicio:       'sounds/oleada_inicio.mp3',
    oleadaFin:          'sounds/oleada_fin.mp3',
    comprar:            'sounds/comprar_mejora.wav',
    comprarCuracion:    'sounds/comprar_curacion_tienda.wav',
    colocar:            'sounds/colocar.mp3',
    gameOver:           'sounds/game_over.mp3',
    recompensa:         'sounds/recompensa.mp3',

    // --- Música de fondo ---
    musicaMenu:         'sounds/musica_menu.mp3',
    musicaJuego:        'sounds/musica_juego.mp3',
    musicaBoss:         'sounds/musica_boss.mp3',
    musicaBulletHell:   'sounds/musica_bullethell.ogg',
};

// Volúmenes por defecto para cada categoría
const VOLUMEN = {
    sfx:    0.5,
    musica: 0.3,
};

// Multiplicadores de volumen individuales (1 = normal, 0.5 = mitad, etc.)
const VOLUMEN_INDIVIDUAL = {
    // --- Ataques jugador ---
    espada:             0.2,
    arco:               0.2,
    baston:             1,
    habilidad:          1,
    // --- Jugador ---
    danioRecibido:      0.5,
    danioRecibido2:     0.5,
    danioRecibido3:     0.5,
    curar:              0.5,
    escudo:             0.5,
    recogerObjeto:      1,
    recogerPocionDanio: 0.5,
    recogerPocionEscudo:0.5,
    muerte:             1,
    // --- Enemigos ---
    enemigoMuere:       0.3,
    bossDerrotado:      1,
    // --- Eventos de juego ---
    oleadaInicio:       1,
    oleadaFin:          1,
    comprar:            1,
    comprarCuracion:    1,
    colocar:            1,
    gameOver:           1,
    recompensa:         1,
    // --- Bullet Hell ---
    bhTeletransporte:   0.7,
    bhPausaTemporal:    0.6,
    bhInvulnerabilidad: 0.6,
    bhOndaRepulsora:    0.8,
    bhRalentizar:       0.5,
    bhMagoAparece:      0.7,
    bhMagoCambioPatron: 0.3,
    bhCurar:            0.5,
    bhMuerte:           0.8,
};

// IDs con variantes aleatorias: al llamar play(id) se elige una al azar
const VARIANTES = {
    danioRecibido: ['danioRecibido', 'danioRecibido2', 'danioRecibido3'],
};

// Qué sonidos son música (loopean)
const ES_MUSICA = new Set(['musicaMenu', 'musicaJuego', 'musicaBoss', 'musicaBulletHell']);

// Cache de Audio elements para evitar recargar
const _cache = {};

// Música actualmente sonando
let _musicaActual = null;
let _musicaId = null;

// Estado global
let _muteSfx = false;
let _muteMusica = false;

// Throttle: evitar spam del mismo sonido
const _lastPlayTime = {};

function _getAudio(id) {
    if (_cache[id]) return _cache[id];
    const ruta = SONIDOS[id];
    if (!ruta) return null;
    const audio = new Audio(ruta);
    audio.preload = 'auto';
    _cache[id] = audio;
    return audio;
}

/** Reproduce un efecto de sonido (no bloquea, falla silenciosamente si el archivo no existe). */
export function play(id) {
    if (_muteSfx) return;
    // Resolver variante aleatoria si existe
    const variantes = VARIANTES[id];
    const resolvedId = variantes ? variantes[Math.floor(Math.random() * variantes.length)] : id;

    // Throttle: no repetir el mismo sonido en <100ms
    const ahora = performance.now();
    if (_lastPlayTime[resolvedId] && ahora - _lastPlayTime[resolvedId] < 100) return;
    _lastPlayTime[resolvedId] = ahora;

    // Síntesis primero
    const synthFn = SYNTH_MAP[resolvedId];
    if (synthFn) {
        try {
            const ac = _getAC();
            const vol = VOLUMEN.sfx * (VOLUMEN_INDIVIDUAL[resolvedId] ?? 1);
            synthFn(ac, ac.currentTime + 0.02, vol);
        } catch (e) {}
        return;
    }

    // Archivo de audio (fallback)
    const ruta = SONIDOS[resolvedId];
    if (!ruta) return;
    const audio = new Audio(ruta);
    audio.volume = VOLUMEN.sfx * (VOLUMEN_INDIVIDUAL[resolvedId] ?? 1);
    audio.play().catch(() => {});
}

/** Inicia música de fondo (loop). Si ya suena la misma, no reinicia. */
export function playMusica(id) {
    if (_musicaId === id && _musicaActual && !_musicaActual.paused) return;

    stopMusica();
    const audio = _getAudio(id);
    if (!audio) return;
    audio.loop = true;
    audio.volume = _muteMusica ? 0 : VOLUMEN.musica;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    _musicaActual = audio;
    _musicaId = id;
}

/** Para la música de fondo actual. */
export function stopMusica() {
    if (_musicaActual) {
        _musicaActual.pause();
        _musicaActual.currentTime = 0;
        _musicaActual = null;
        _musicaId = null;
    }
}

/** Cambia el volumen de SFX (0-1). */
export function setVolumenSfx(v) {
    VOLUMEN.sfx = Math.max(0, Math.min(1, v));
}

/** Cambia el volumen de música (0-1). */
export function setVolumenMusica(v) {
    VOLUMEN.musica = Math.max(0, Math.min(1, v));
    if (_musicaActual) _musicaActual.volume = _muteMusica ? 0 : VOLUMEN.musica;
}

/** Silencia/activa SFX. */
export function toggleMuteSfx() {
    _muteSfx = !_muteSfx;
    return _muteSfx;
}

/** Silencia/activa música. */
export function toggleMuteMusica() {
    _muteMusica = !_muteMusica;
    if (_musicaActual) _musicaActual.volume = _muteMusica ? 0 : VOLUMEN.musica;
    return _muteMusica;
}

export function isMuteSfx() { return _muteSfx; }
export function isMuteMusica() { return _muteMusica; }

let _musicaRateTween = null;

/** Cambia el playbackRate de la música con transición suave. */
export function setMusicaRate(rate, duracionMs = 300) {
    if (!_musicaActual) return;
    if (_musicaRateTween) cancelAnimationFrame(_musicaRateTween);
    const from = _musicaActual.playbackRate;
    const start = performance.now();
    const animar = (now) => {
        if (!_musicaActual) return;
        const t = Math.min(1, (now - start) / duracionMs);
        _musicaActual.playbackRate = from + (rate - from) * t;
        if (t < 1) _musicaRateTween = requestAnimationFrame(animar);
        else _musicaRateTween = null;
    };
    _musicaRateTween = requestAnimationFrame(animar);
}

/** Pre-carga todos los sonidos (opcional, mejora latencia). */
export function precargar() {
    for (const id of Object.keys(SONIDOS)) {
        _getAudio(id);
    }
}

// ==================== SFX — Síntesis Web Audio API ====================

function _noiseFiltered(ac, start, dur, vol, freq, Q) {
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = Q || 1;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.start(start); src.stop(start + dur + 0.05);
}

const SYNTH_MAP = {
    // === Oleadas — Sonidos sin archivo ===

    baston(ac, t, vol) {
        _osc(ac, 'sawtooth', 100, t, 400, 0.15, vol * 0.3);
        _osc(ac, 'sine', 300, t, 600, 0.1, vol * 0.25);
        _noiseFiltered(ac, t, 0.12, vol * 0.15, 2000, 1.5);
    },
    habilidad(ac, t, vol) {
        _osc(ac, 'sine', 523, t, null, 0.2, vol * 0.25);
        _osc(ac, 'sine', 659, t + 0.04, null, 0.2, vol * 0.22);
        _osc(ac, 'sine', 784, t + 0.08, null, 0.2, vol * 0.2);
    },
    curar(ac, t, vol) {
        const notas = [523, 659, 784, 988, 1175];
        notas.forEach((f, i) => {
            _osc(ac, 'sine', f, t + i * 0.06, null, 0.25, vol * 0.2);
        });
        _shimmer(ac, 784, t + 0.3, 4, vol * 0.06);
    },
    escudo(ac, t, vol) {
        _osc(ac, 'triangle', 1200, t, 800, 0.15, vol * 0.25);
        _osc(ac, 'sine', 600, t, 500, 0.12, vol * 0.2);
        _noiseFiltered(ac, t, 0.06, vol * 0.1, 3000, 2);
    },
    recogerObjeto(ac, t, vol) {
        _osc(ac, 'sine', 440, t, 660, 0.07, vol * 0.25);
        _osc(ac, 'sine', 660, t + 0.07, 880, 0.08, vol * 0.22);
    },
    muerte(ac, t, vol) {
        _osc(ac, 'sawtooth', 200, t, 60, 0.5, vol * 0.25);
        _noiseFiltered(ac, t, 0.4, vol * 0.15, 800, 0.5);
        _osc(ac, 'sine', 80, t + 0.1, 40, 0.4, vol * 0.3);
    },
    oleadaInicio(ac, t, vol) {
        const notas = [262, 330, 392, 523];
        notas.forEach((f, i) => {
            _osc(ac, 'square', f, t + i * 0.08, null, 0.2, vol * 0.12);
        });
    },
    oleadaFin(ac, t, vol) {
        const notas = [523, 659, 784, 1047];
        notas.forEach((f, i) => {
            _osc(ac, 'sine', f, t + i * 0.1, null, 0.3, vol * 0.2);
        });
        _shimmer(ac, 1047, t + 0.4, 4, vol * 0.06);
    },
    colocar(ac, t, vol) {
        _osc(ac, 'sine', 120, t, 80, 0.1, vol * 0.3);
        _noiseFiltered(ac, t, 0.06, vol * 0.15, 600, 0.8);
    },
    gameOver(ac, t, vol) {
        _osc(ac, 'square', 392, t, null, 0.3, vol * 0.15);
        _osc(ac, 'square', 330, t + 0.3, null, 0.3, vol * 0.15);
        _osc(ac, 'square', 262, t + 0.6, null, 0.4, vol * 0.15);
        _osc(ac, 'sine', 60, t + 0.6, 40, 0.5, vol * 0.3);
    },
    recompensa(ac, t, vol) {
        const notas = [784, 988, 1175, 1319, 1568];
        notas.forEach((f, i) => {
            _osc(ac, 'sine', f, t + i * 0.05, null, 0.2, vol * 0.18);
        });
        _shimmer(ac, 1175, t + 0.25, 5, vol * 0.05);
    },

    // === Bullet Hell — Sonidos nuevos ===

    bhTeletransporte(ac, t, vol) {
        _noiseFiltered(ac, t, 0.15, vol * 0.2, 1500, 2);
        _osc(ac, 'sine', 200, t, 2000, 0.12, vol * 0.25);
        _osc(ac, 'sine', 2000, t + 0.12, 200, 0.13, vol * 0.2);
    },
    bhPausaTemporal(ac, t, vol) {
        for (let i = 0; i < 4; i++) {
            _osc(ac, 'sine', 2000 + i * 500, t, 1000 + i * 200, 0.4, vol * 0.1);
        }
    },
    bhInvulnerabilidad(ac, t, vol) {
        _osc(ac, 'sine', 262, t, null, 0.35, vol * 0.2);
        _osc(ac, 'sine', 330, t, null, 0.35, vol * 0.18);
        _osc(ac, 'sine', 392, t, null, 0.35, vol * 0.16);
        _osc(ac, 'triangle', 784, t + 0.05, null, 0.25, vol * 0.1);
    },
    bhOndaRepulsora(ac, t, vol) {
        _osc(ac, 'sawtooth', 500, t, 80, 0.25, vol * 0.2);
        _noiseFiltered(ac, t, 0.2, vol * 0.2, 1000, 1);
        _osc(ac, 'sine', 60, t + 0.05, 40, 0.3, vol * 0.3);
    },
    bhRalentizar(ac, t, vol) {
        _osc(ac, 'sine', 300, t, 150, 0.5, vol * 0.2);
        _osc(ac, 'sine', 305, t, 152, 0.5, vol * 0.2);
    },
    bhMagoAparece(ac, t, vol) {
        _osc(ac, 'sawtooth', 60, t, 200, 0.6, vol * 0.15);
        _osc(ac, 'sine', 370, t + 0.2, null, 0.5, vol * 0.12);
        _osc(ac, 'sine', 523, t + 0.2, null, 0.5, vol * 0.1);
        _noiseFiltered(ac, t + 0.4, 0.3, vol * 0.08, 600, 0.5);
    },
    bhMagoCambioPatron(ac, t, vol) {
        _noiseFiltered(ac, t, 0.08, vol * 0.15, 2000, 2);
        _osc(ac, 'sine', 600, t + 0.05, 400, 0.15, vol * 0.2);
    },
    bhCurar(ac, t, vol) {
        _osc(ac, 'sine', 659, t, null, 0.15, vol * 0.2);
        _osc(ac, 'sine', 784, t + 0.05, null, 0.15, vol * 0.18);
        _osc(ac, 'sine', 988, t + 0.1, null, 0.15, vol * 0.16);
    },
    bhMuerte(ac, t, vol) {
        // Reutiliza receta de muerte
        SYNTH_MAP.muerte(ac, t, vol);
    },
};

// ==================== Gacha — Audio sintetizado (Web Audio API) ====================

let _ac = null;
let _rollingGain = null; // GainNode para cortar el rolling al skip

function _getAC() {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
}

function _osc(ac, type, freq, start, freqEnd, dur, vol, dest) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(dest || ac.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.start(start);
    o.stop(start + dur + 0.05);
}

function _noise(ac, start, dur, vol) {
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.5;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.start(start); src.stop(start + dur + 0.05);
}

function _shimmer(ac, baseFreq, t, numPartials, vol) {
    for (let i = 1; i <= numPartials; i++) {
        _osc(ac, 'sine', baseFreq * i, t + i * 0.045, null, 0.5 + i * 0.05, vol / i);
    }
}

// --- Sonido de rolling (ticks que desaceleran, ~4s) ---
function _gachaRolling(ac, t, duracion) {
    // Crear GainNode dedicado para poder cortarlo al skip
    _rollingGain = ac.createGain();
    _rollingGain.connect(ac.destination);
    const dest = _rollingGain;

    const numTicks = 50;
    let tiempo = 0;
    for (let i = 0; i < numTicks; i++) {
        const progreso = i / numTicks;
        const intervalo = 0.03 + Math.pow(progreso, 3) * 0.35;
        if (tiempo > duracion) break;
        const freq = 800 + Math.sin(i * 0.7) * 200;
        _osc(ac, 'sine', freq, t + tiempo, freq * 0.95, 0.04, 0.12 * (1 - progreso * 0.5), dest);
        _osc(ac, 'triangle', freq * 0.5, t + tiempo, null, 0.03, 0.06 * (1 - progreso * 0.4), dest);
        tiempo += intervalo;
    }
    _osc(ac, 'sawtooth', 120, t + duracion * 0.6, 300, duracion * 0.35, 0.04, dest);
}

// --- Reveals por rareza ---
function _revealNormal(ac, t) {
    _osc(ac, 'sine', 523, t, 659, 0.15, 0.18);
    _osc(ac, 'sine', 659, t + 0.15, 784, 0.15, 0.12);
    _noise(ac, t, 0.08, 0.05);
}

function _revealRaro(ac, t) {
    const penta = [523, 659, 784, 880, 1047, 1319];
    penta.forEach((f, i) => {
        _osc(ac, 'sine', f, t + 0.05 + i * 0.07, f, 0.35, 0.18 - i * 0.015);
    });
    _shimmer(ac, 659, t + 0.5, 5, 0.06);
    _noise(ac, t, 0.12, 0.04);
}

function _revealEpico(ac, t) {
    _osc(ac, 'sawtooth', 100, t, 600, 0.5, 0.1);
    const epic = [330, 415, 523, 659, 830, 1047, 1319, 1568];
    epic.forEach((f, i) => {
        _osc(ac, 'square', f, t + 0.1 + i * 0.06, f * 1.5, 0.45, 0.1 - i * 0.008);
        _osc(ac, 'sine', f, t + 0.1 + i * 0.06, f, 0.55, 0.12 - i * 0.01);
    });
    _shimmer(ac, 523, t + 0.65, 7, 0.07);
    _noise(ac, t + 0.1, 0.2, 0.06);
}

function _revealLegendario(ac, t) {
    // Timpani
    _osc(ac, 'sine', 60, t, 40, 0.3, 0.4);
    _osc(ac, 'sine', 80, t, 55, 0.3, 0.25);
    _noise(ac, t, 0.25, 0.1);
    // Trino
    for (let i = 0; i < 8; i++) {
        _osc(ac, 'triangle', i % 2 === 0 ? 880 : 988, t + 0.05 + i * 0.04, null, 0.06, 0.12);
    }
    // Arpegio ascendente
    const grand = [261, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093];
    grand.forEach((f, i) => {
        _osc(ac, 'sine', f, t + 0.35 + i * 0.055, f, 0.6, 0.22);
        _osc(ac, 'triangle', f * 2, t + 0.35 + i * 0.055, f * 2, 0.5, 0.1);
    });
    // Shimmer cascada
    _shimmer(ac, 523, t + 0.85, 8, 0.08);
    _shimmer(ac, 1047, t + 1.0, 6, 0.06);
    // Tono dorado sostenido
    _osc(ac, 'sine', 1047, t + 1.4, 1047, 1.2, 0.15);
    _osc(ac, 'sine', 1319, t + 1.5, 1319, 1.0, 0.1);
    _osc(ac, 'sine', 1568, t + 1.6, 1568, 0.8, 0.07);
}

const _REVEAL_MAP = {
    normal:     _revealNormal,
    raro:       _revealRaro,
    epico:      _revealEpico,
    legendario: _revealLegendario,
};

/** Reproduce el sonido de rolling del gacha (ticks que desaceleran). */
export function playGachaRolling(duracion = 4) {
    if (_muteSfx) return;
    const ac = _getAC();
    const t = ac.currentTime + 0.05;
    _gachaRolling(ac, t, duracion);
}

/** Corta el sonido de rolling inmediatamente. */
export function stopGachaRolling() {
    if (_rollingGain) {
        _rollingGain.gain.setValueAtTime(0, _getAC().currentTime);
        _rollingGain.disconnect();
        _rollingGain = null;
    }
}

/** Reproduce el sonido de reveal del gacha según la rareza del tier. */
export function playGachaReveal(tierId) {
    if (_muteSfx) return;
    const ac = _getAC();
    const t = ac.currentTime + 0.05;
    (_REVEAL_MAP[tierId] || _revealNormal)(ac, t);
}
