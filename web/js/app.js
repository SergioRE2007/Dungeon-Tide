import { iniciarSandbox, destruirSandbox } from './sandbox.js';

const menu = document.getElementById('menuPrincipal');
const btnSandbox = document.getElementById('btnSandbox');
const btnOleadas = document.getElementById('btnOleadas');
const btnBulletHell = document.getElementById('btnBulletHell');

let oleadasModule = null;
let bulletHellModule = null;

function mostrarMenu() {
    document.body.classList.remove('in-game');
    menu.style.display = 'flex';
    document.getElementById('layout').style.display = 'none';
    document.getElementById('layoutOleadas').style.display = 'none';
    document.getElementById('layoutBulletHell').style.display = 'none';
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

btnBulletHell.addEventListener('click', async () => {
    document.body.classList.add('in-game');
    menu.style.display = 'none';
    if (!bulletHellModule) {
        bulletHellModule = await import('./bulletHell.js');
    }
    bulletHellModule.iniciarBulletHell(mostrarMenu);
});

mostrarMenu();
