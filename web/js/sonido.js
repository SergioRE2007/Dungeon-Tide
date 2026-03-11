// ==================== Sistema de Audio ====================
// Gestor centralizado de sonidos y música.
// Para añadir un sonido: colocar el archivo en web/sounds/ y
// actualizar la ruta correspondiente en SONIDOS.

const SONIDOS = {
    // --- Ataques jugador ---
    espada:         'sounds/espada.mp3',
    arco:           'sounds/arco.mp3',
    baston:         'sounds/baston.mp3',
    habilidad:      'sounds/habilidad.mp3',

    // --- Jugador ---
    danioRecibido:  'sounds/danio_recibido.mp3',
    curar:          'sounds/curar.mp3',
    escudo:         'sounds/escudo.mp3',
    recogerObjeto:  'sounds/recoger_objeto.mp3',
    muerte:         'sounds/muerte.mp3',

    // --- Enemigos ---
    enemigoMuere:   'sounds/enemigo_muere.mp3',
    bossDerrotado:  'sounds/boss_derrotado.mp3',

    // --- Eventos de juego ---
    oleadaInicio:   'sounds/oleada_inicio.mp3',
    oleadaFin:      'sounds/oleada_fin.mp3',
    comprar:        'sounds/comprar.mp3',
    colocar:        'sounds/colocar.mp3',
    gameOver:       'sounds/game_over.mp3',
    recompensa:     'sounds/recompensa.mp3',

    // --- Música de fondo ---
    musicaMenu:     'sounds/musica_menu.mp3',
    musicaJuego:    'sounds/musica_juego.mp3',
    musicaBoss:     'sounds/musica_boss.mp3',
};

// Volúmenes por defecto para cada categoría
const VOLUMEN = {
    sfx:    0.5,
    musica: 0.3,
};

// Qué sonidos son música (loopean)
const ES_MUSICA = new Set(['musicaMenu', 'musicaJuego', 'musicaBoss']);

// Cache de Audio elements para evitar recargar
const _cache = {};

// Música actualmente sonando
let _musicaActual = null;
let _musicaId = null;

// Estado global
let _muteSfx = false;
let _muteMusica = false;

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
    const ruta = SONIDOS[id];
    if (!ruta) return;

    // Para SFX usamos clones para permitir solapamiento
    const audio = new Audio(ruta);
    audio.volume = VOLUMEN.sfx;
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

/** Pre-carga todos los sonidos (opcional, mejora latencia). */
export function precargar() {
    for (const id of Object.keys(SONIDOS)) {
        _getAudio(id);
    }
}
