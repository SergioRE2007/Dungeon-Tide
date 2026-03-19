// ==================== Stats & Logros (localStorage) ====================

const STORAGE_KEY = 'dungeonTide_stats';
const LOGROS_KEY = 'dungeonTide_logros';

function _cargar(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function _guardar(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ==================== Stats ====================

const STATS_DEFAULT = {
    mejorOleada: 0,
    totalKills: 0,
    totalPartidas: 0,
    totalOroGanado: 0,
    totalTiempoMs: 0,
    mejorKillsPartida: 0,
    mejorDanioPartida: 0,
    bossesKilled: 0,
    cofresAbiertos: 0,
};

export function getStats() {
    return { ...STATS_DEFAULT, ..._cargar(STORAGE_KEY, {}) };
}

export function registrarPartida({ oleada, kills, danio, oro, tiempoMs, bossesKilled, cofresAbiertos }) {
    const stats = getStats();
    stats.totalPartidas++;
    stats.totalKills += kills;
    stats.totalOroGanado += oro;
    stats.totalTiempoMs += tiempoMs;
    stats.bossesKilled += bossesKilled || 0;
    stats.cofresAbiertos += cofresAbiertos || 0;
    if (oleada > stats.mejorOleada) stats.mejorOleada = oleada;
    if (kills > stats.mejorKillsPartida) stats.mejorKillsPartida = kills;
    if (danio > stats.mejorDanioPartida) stats.mejorDanioPartida = danio;
    _guardar(STORAGE_KEY, stats);
    _evaluarLogros(stats);
    return stats;
}

// ==================== Logros ====================

const LOGROS_DEF = [
    { id: 'primeraSangre',   nombre: 'Primera Sangre',   desc: 'Mata a tu primer enemigo',          icono: '🗡️', check: s => s.totalKills >= 1 },
    { id: 'oleada5',         nombre: 'Superviviente',     desc: 'Alcanza la oleada 5',               icono: '🛡️', check: s => s.mejorOleada >= 5 },
    { id: 'oleada10',        nombre: 'Veterano',          desc: 'Alcanza la oleada 10',              icono: '⚔️', check: s => s.mejorOleada >= 10 },
    { id: 'oleada20',        nombre: 'Leyenda',           desc: 'Alcanza la oleada 20',              icono: '👑', check: s => s.mejorOleada >= 20 },
    { id: 'exterminador',    nombre: 'Exterminador',      desc: 'Mata 100 enemigos en total',        icono: '💀', check: s => s.totalKills >= 100 },
    { id: 'masacre',         nombre: 'Masacre',           desc: 'Mata 500 enemigos en total',        icono: '🔥', check: s => s.totalKills >= 500 },
    { id: 'cazaBosses',      nombre: 'Cazador de Jefes',  desc: 'Derrota a un jefe',                 icono: '🐉', check: s => s.bossesKilled >= 1 },
    { id: 'cazafortunas',    nombre: 'Cazafortunas',      desc: 'Abre 10 cofres',                    icono: '🎁', check: s => s.cofresAbiertos >= 10 },
    { id: 'dedicado',        nombre: 'Dedicado',          desc: 'Juega 10 partidas',                 icono: '🎮', check: s => s.totalPartidas >= 10 },
    { id: 'millonario',      nombre: 'Millonario',        desc: 'Gana 5000 de oro en total',         icono: '💰', check: s => s.totalOroGanado >= 5000 },
    { id: 'rampage',         nombre: 'Rampage',           desc: 'Mata 50 enemigos en una partida',   icono: '⚡', check: s => s.mejorKillsPartida >= 50 },
];

export function getLogros() {
    return _cargar(LOGROS_KEY, []);
}

export function getLogrosDef() {
    return LOGROS_DEF;
}

function _evaluarLogros(stats) {
    const desbloqueados = new Set(getLogros());
    const nuevos = [];
    for (const logro of LOGROS_DEF) {
        if (!desbloqueados.has(logro.id) && logro.check(stats)) {
            desbloqueados.add(logro.id);
            nuevos.push(logro);
        }
    }
    if (nuevos.length > 0) {
        _guardar(LOGROS_KEY, [...desbloqueados]);
        // Mostrar toast para cada logro nuevo
        nuevos.forEach((logro, i) => {
            setTimeout(() => mostrarLogroToast(logro), i * 600);
        });
    }
    return nuevos;
}

/**
 * Muestra un toast animado cuando se desbloquea un logro.
 */
let _toastCount = 0;

export function mostrarLogroToast(logro) {
    const idx = _toastCount++;
    const toast = document.createElement('div');
    toast.className = 'logro-toast';
    toast.style.top = `${20 + idx * 80}px`;
    toast.innerHTML = `
        <span class="logro-toast-icono">${logro.icono}</span>
        <div class="logro-toast-texto">
            <span class="logro-toast-label">LOGRO DESBLOQUEADO</span>
            <span class="logro-toast-nombre">${logro.nombre}</span>
            <span class="logro-toast-desc">${logro.desc}</span>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); _toastCount = Math.max(0, _toastCount - 1); }, 4200);
}

export function getLogrosNuevos(stats) {
    const desbloqueados = new Set(getLogros());
    const nuevos = [];
    for (const logro of LOGROS_DEF) {
        if (!desbloqueados.has(logro.id) && logro.check(stats)) {
            nuevos.push(logro);
        }
    }
    return nuevos;
}

export function resetStats() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOGROS_KEY);
}
