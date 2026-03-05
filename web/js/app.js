import { iniciarSandbox, destruirSandbox } from './sandbox.js';

const menu = document.getElementById('menuPrincipal');
const btnSandbox = document.getElementById('btnSandbox');
const btnOleadas = document.getElementById('btnOleadas');

let oleadasModule = null;

function mostrarMenu() {
    menu.style.display = 'flex';
    document.getElementById('layout').style.display = 'none';
    document.getElementById('layoutOleadas').style.display = 'none';
}

btnSandbox.addEventListener('click', () => {
    menu.style.display = 'none';
    iniciarSandbox(mostrarMenu);
});

btnOleadas.addEventListener('click', async () => {
    menu.style.display = 'none';
    if (!oleadasModule) {
        oleadasModule = await import('./oleadas.js');
    }
    oleadasModule.iniciarOleadas(mostrarMenu);
});

mostrarMenu();
