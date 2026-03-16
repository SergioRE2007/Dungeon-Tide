import { iniciarSandbox, destruirSandbox } from './sandbox.js';

const menu = document.getElementById('menuPrincipal');
const menuBH = document.getElementById('menuBulletHell');
const btnSandbox = document.getElementById('btnSandbox');
const btnOleadas = document.getElementById('btnOleadas');
const btnBulletHell = document.getElementById('btnBulletHell');
const btnVolverBHMenu = document.getElementById('btnVolverBHMenu');

let oleadasModule = null;
let bulletHellModule = null;
let _bhDificultadPendiente = null;
let _bhHabilidadesSeleccionadas = [];

function mostrarMenu() {
    document.body.classList.remove('in-game');
    menu.style.display = 'flex';
    menuBH.style.display = 'none';
    document.getElementById('layout').style.display = 'none';
    document.getElementById('layoutOleadas').style.display = 'none';
    document.getElementById('layoutBulletHell').style.display = 'none';
    // Restaurar submenu BH para la proxima vez
    document.getElementById('bhSeleccionHabilidades').style.display = 'none';
    document.querySelector('#menuBulletHell .menu-botones').style.display = 'flex';
    const subtit = document.querySelector('#menuBulletHell .menu-subtitulo');
    if (subtit) subtit.style.display = '';
}

btnSandbox.addEventListener('click', () => {
    document.body.classList.add('in-game');
    menu.style.display = 'none';
    iniciarSandbox(mostrarMenu);
});

btnOleadas.addEventListener('click', async () => {
    document.body.classList.add('in-game');
    menu.style.display = 'none';
    if (!oleadasModule) {
        oleadasModule = await import('./oleadas.js');
    }
    oleadasModule.iniciarOleadas(mostrarMenu);
});

// Bullet Hell: mostrar menu de dificultad
btnBulletHell.addEventListener('click', () => {
    menu.style.display = 'none';
    menuBH.style.display = 'flex';
});

btnVolverBHMenu.addEventListener('click', () => {
    const selDiv = document.getElementById('bhSeleccionHabilidades');
    // Si estamos en la pantalla de habilidades, volver a dificultad
    if (selDiv.style.display !== 'none') {
        selDiv.style.display = 'none';
        document.querySelector('#menuBulletHell .menu-botones').style.display = 'flex';
        document.querySelector('#menuBulletHell .menu-subtitulo').style.display = '';
        return;
    }
    menuBH.style.display = 'none';
    menu.style.display = 'flex';
});

// Botones de dificultad
document.querySelectorAll('.bh-diff-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const dificultad = btn.dataset.diff;

        // Custom mode: saltar seleccion de habilidades
        if (dificultad === 'custom') {
            document.body.classList.add('in-game');
            menuBH.style.display = 'none';
            if (!bulletHellModule) {
                bulletHellModule = await import('./bulletHell.js');
            }
            bulletHellModule.iniciarBulletHell(mostrarMenu, dificultad);
            return;
        }

        // Guardar dificultad y mostrar seleccion de habilidades
        _bhDificultadPendiente = dificultad;
        _bhHabilidadesSeleccionadas = [];

        // Ocultar botones de dificultad, mostrar seleccion
        document.querySelector('#menuBulletHell .menu-botones').style.display = 'none';
        document.querySelector('#menuBulletHell .menu-subtitulo').style.display = 'none';
        const selDiv = document.getElementById('bhSeleccionHabilidades');
        selDiv.style.display = 'flex';

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
    document.body.classList.add('in-game');
    menuBH.style.display = 'none';
    // Restaurar botones para la proxima vez
    document.querySelector('#menuBulletHell .menu-botones').style.display = 'flex';
    document.querySelector('#menuBulletHell .menu-subtitulo').style.display = '';
    document.getElementById('bhSeleccionHabilidades').style.display = 'none';

    if (!bulletHellModule) {
        bulletHellModule = await import('./bulletHell.js');
    }
    bulletHellModule.iniciarBulletHell(mostrarMenu, _bhDificultadPendiente, _bhHabilidadesSeleccionadas);
});

mostrarMenu();

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
[btnSandbox, btnOleadas, btnBulletHell].forEach(btn => {
    btn.addEventListener('click', () => setTimeout(mostrarHintFullscreen, 300));
});
