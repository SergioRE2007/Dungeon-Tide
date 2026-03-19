import { iniciarSandbox, destruirSandbox } from './sandbox.js';
import { transicionar } from './transicion.js';
import * as DemoFondo from './demoFondo.js';

const menu = document.getElementById('menuPrincipal');
const menuBH = document.getElementById('menuBulletHell');
const btnSandbox = document.getElementById('btnSandbox');
const btnOleadas = document.getElementById('btnOleadas');
const btnBulletHell = document.getElementById('btnBulletHell');
const btnMazmorra = document.getElementById('btnMazmorra');
const btnVolverBHMenu = document.getElementById('btnVolverBHMenu');

let oleadasModule = null;
let bulletHellModule = null;
let mazmorraModule = null;
let _bhDificultadPendiente = null;
let _bhHabilidadesSeleccionadas = [];

// Helper: re-trigger entrada animation on an element
function _animarEntrada(el) {
    el.classList.remove('pantalla-entrar');
    void el.offsetWidth; // force reflow
    el.classList.add('pantalla-entrar');
}

function _ocultarTodo() {
    document.body.classList.remove('in-game');
    menu.style.display = 'none';
    menuBH.style.display = 'none';
    document.getElementById('layout').style.display = 'none';
    document.getElementById('layoutOleadas').style.display = 'none';
    document.getElementById('layoutMazmorra').style.display = 'none';
    document.getElementById('layoutBulletHell').style.display = 'none';
    // Restaurar submenu BH para la proxima vez
    document.getElementById('bhSeleccionHabilidades').style.display = 'none';
    document.querySelector('#menuBulletHell .menu-botones').style.display = 'flex';
    const subtit = document.querySelector('#menuBulletHell .menu-subtitulo');
    if (subtit) subtit.style.display = '';
}

// Ocultar todo Y detener demo — para entrar en un modo de juego real
function _entrarEnJuego() {
    _ocultarTodo();
    _detenerDemo();
    document.body.classList.add('in-game');
}

function _iniciarDemo() {
    DemoFondo.mostrar();
    DemoFondo.iniciar();
}

function _detenerDemo() {
    DemoFondo.detener();
    DemoFondo.ocultar();
}

function mostrarMenu() {
    _ocultarTodo();
    menu.style.display = 'flex';
    _animarEntrada(menu);
    _iniciarDemo();
}

// Versión con transición del guerrero — usada al volver desde un modo de juego
function mostrarMenuConTransicion() {
    transicionar(() => {
        _ocultarTodo();
        menu.style.display = 'flex';
        _animarEntrada(menu);
        _iniciarDemo();
    });
}

// ==================== Loading spinner ====================

function _mostrarLoading() {
    if (document.querySelector('.loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-texto">CARGANDO</div>';
    document.body.appendChild(overlay);
}

function _ocultarLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (!overlay) return;
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 400);
}

// ==================== Navegación ====================

btnSandbox.addEventListener('click', () => {
    transicionar(() => {
        _entrarEnJuego();
        iniciarSandbox(mostrarMenuConTransicion);
    });
});

btnOleadas.addEventListener('click', async () => {
    if (!oleadasModule) {
        _mostrarLoading();
        oleadasModule = await import('./oleadas.js');
        _ocultarLoading();
    }
    transicionar(() => {
        _entrarEnJuego();
        oleadasModule.iniciarOleadas(mostrarMenuConTransicion);
    });
});

btnMazmorra.addEventListener('click', async () => {
    if (!mazmorraModule) {
        _mostrarLoading();
        mazmorraModule = await import('./mazmorra.js');
        _ocultarLoading();
    }
    transicionar(() => {
        _entrarEnJuego();
        mazmorraModule.iniciarMazmorra(mostrarMenuConTransicion);
    });
});

// Bullet Hell: mostrar menu de dificultad
btnBulletHell.addEventListener('click', () => {
    transicionar(() => {
        _ocultarTodo();
        menuBH.style.display = 'flex';
        _animarEntrada(menuBH);
    });
});

btnVolverBHMenu.addEventListener('click', () => {
    const selDiv = document.getElementById('bhSeleccionHabilidades');
    // Si estamos en la pantalla de habilidades, volver a dificultad (transición suave sin guerrero)
    if (selDiv.style.display !== 'none') {
        selDiv.style.display = 'none';
        document.querySelector('#menuBulletHell .menu-botones').style.display = 'flex';
        document.querySelector('#menuBulletHell .menu-subtitulo').style.display = '';
        _animarEntrada(menuBH);
        return;
    }
    // Volver al menú principal con transición
    transicionar(() => {
        _ocultarTodo();
        menu.style.display = 'flex';
        _animarEntrada(menu);
        _iniciarDemo();
    });
});

// Botones de dificultad
document.querySelectorAll('.bh-diff-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const dificultad = btn.dataset.diff;

        // Custom mode: saltar seleccion de habilidades
        if (dificultad === 'custom') {
            if (!bulletHellModule) {
                _mostrarLoading();
                bulletHellModule = await import('./bulletHell.js');
                _ocultarLoading();
            }
            transicionar(() => {
                _entrarEnJuego();
                bulletHellModule.iniciarBulletHell(mostrarMenuConTransicion, dificultad);
            });
            return;
        }

        // Guardar dificultad y mostrar seleccion de habilidades
        _bhDificultadPendiente = dificultad;
        _bhHabilidadesSeleccionadas = [];

        // Ocultar botones de dificultad, mostrar seleccion (sin transición de guerrero)
        document.querySelector('#menuBulletHell .menu-botones').style.display = 'none';
        document.querySelector('#menuBulletHell .menu-subtitulo').style.display = 'none';
        const selDiv = document.getElementById('bhSeleccionHabilidades');
        selDiv.style.display = 'flex';
        _animarEntrada(selDiv);

        _generarBotonesHabilidades();
    });
});

async function _generarBotonesHabilidades() {
    const { HABILIDADES_BH, MAX_HABILIDADES } = await import('./bulletHellConfig.js');
    const grid = document.getElementById('bhHabilidadesGrid');
    grid.innerHTML = '';

    for (const hab of HABILIDADES_BH) {
        const btn = document.createElement('button');
        btn.className = 'bh-hab-btn';
        btn.dataset.habId = hab.id;
        btn.innerHTML = `<span class="bh-hab-icono" style="color:${hab.color}">${hab.icono}</span>`
            + `<span class="bh-hab-nombre">${hab.nombre}</span>`
            + `<span class="bh-hab-tecla">${hab.tecla === 'click' ? 'CLICK' : hab.tecla.toUpperCase()}</span>`
            + `<span class="bh-hab-desc">${hab.descripcion}</span>`;

        btn.addEventListener('click', () => {
            const yaSeleccionada = _bhHabilidadesSeleccionadas.indexOf(hab) >= 0;
            // Deseleccionar todas
            _bhHabilidadesSeleccionadas.length = 0;
            grid.querySelectorAll('.bh-hab-btn').forEach(b => b.classList.remove('selected'));
            // Si no era la misma, seleccionar la nueva
            if (!yaSeleccionada) {
                _bhHabilidadesSeleccionadas.push(hab);
                btn.classList.add('selected');
            }
        });
        grid.appendChild(btn);
    }
}

document.getElementById('btnJugarBH').addEventListener('click', async () => {
    if (!bulletHellModule) {
        _mostrarLoading();
        bulletHellModule = await import('./bulletHell.js');
        _ocultarLoading();
    }
    transicionar(() => {
        _entrarEnJuego();
        // Restaurar botones para la proxima vez
        document.querySelector('#menuBulletHell .menu-botones').style.display = 'flex';
        document.querySelector('#menuBulletHell .menu-subtitulo').style.display = '';
        document.getElementById('bhSeleccionHabilidades').style.display = 'none';
        bulletHellModule.iniciarBulletHell(mostrarMenuConTransicion, _bhDificultadPendiente, _bhHabilidadesSeleccionadas);
    });
});

mostrarMenu();

// ==================== Parallax fondo menú ====================

let _parallaxActive = false;

function _iniciarParallax() {
    if (_parallaxActive) return;
    _parallaxActive = true;
}

function _detenerParallax() {
    if (!_parallaxActive) return;
    _parallaxActive = false;
    document.body.style.backgroundPosition = '';
}

document.addEventListener('mousemove', (e) => {
    if (!_parallaxActive) return;
    const mx = (e.clientX / window.innerWidth - 0.5) * 30;
    const my = (e.clientY / window.innerHeight - 0.5) * 20;
    document.body.style.backgroundPosition = `calc(50% + ${mx}px) calc(50% + ${my}px)`;
});

// Observar visibilidad del menú para activar/desactivar parallax
const _menuObserver = new MutationObserver(() => {
    if (menu.style.display !== 'none' && menu.style.display !== '') {
        _iniciarParallax();
    } else {
        _detenerParallax();
    }
});
_menuObserver.observe(menu, { attributes: true, attributeFilter: ['style'] });
if (menu.style.display !== 'none') _iniciarParallax();

// ==================== Pantalla completa ====================

const btnFS = document.getElementById('btnFullscreen');
const hintFS = document.getElementById('fullscreenHint');
const btnHintGo = document.getElementById('btnFullscreenHintGo');
const btnHintClose = document.getElementById('btnFullscreenHintClose');

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

btnFS.addEventListener('click', toggleFullscreen);
btnHintGo.addEventListener('click', () => {
    toggleFullscreen();
    hintFS.style.display = 'none';
});
btnHintClose.addEventListener('click', () => {
    hintFS.style.display = 'none';
    sessionStorage.setItem('fsHintDismissed', '1');
});

document.addEventListener('fullscreenchange', () => {
    btnFS.textContent = document.fullscreenElement ? '\u2716' : '\u26F6';
    if (document.fullscreenElement) {
        hintFS.style.display = 'none';
    }
});

// Mostrar recomendación al entrar en un modo de juego (si no está en fullscreen)
function mostrarHintFullscreen() {
    if (!document.fullscreenElement && !sessionStorage.getItem('fsHintDismissed')) {
        hintFS.style.display = 'flex';
    }
}

// Escuchar clics en los botones de modo para mostrar la recomendación
[btnSandbox, btnOleadas, btnBulletHell, btnMazmorra].forEach(btn => {
    btn.addEventListener('click', () => setTimeout(mostrarHintFullscreen, 300));
});
