import './style.css';
import Fluid from './fluid_js.js';

const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');
const fpsCounter = document.getElementById('fps-counter');
const resSlider = document.getElementById('range-resolution');
const resValue = document.getElementById('val-resolution');
const btnClearFluid = document.getElementById('btn-clear-fluid');
const btnClearObstacles = document.getElementById('btn-clear-obstacles');
btnModeStone.addEventListener('click', () => {
    activeMode = 'stone';
    btnModeStone.classList.add('active');
    btnModeWater.classList.remove('active');
});

let N = parseInt(resSlider.value);
// Use smaller diffusion for sharper flow
let fluid = new Fluid(N, 0.000001, 0.0000001, 0.1);

// Reuse offscreen canvas for performance
const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d');
offscreenCanvas.width = N;
offscreenCanvas.height = N;
let imageData = offCtx.createImageData(N, N);

log('Simulation initialized');

let lastTime = performance.now();
let frames = 0;
let fps = 0;

// Add a few initial stones to PROVE they are visible
function addInitialStones() {
    log(`Placing large stones at N=${N}`);
    const mid = Math.floor(N / 2);
    const top = Math.floor(N / 3);
    // Large 9x9 block
    for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
            fluid.setObstacle(mid + i, top + j, true);
        }
    }
}
addInitialStones();

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Mouse interaction
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * (N - 2)) + 1;
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * (N - 2)) + 1;

    if (activeMode === 'stone' || e.shiftKey) {
        // Place a larger stone
        for (let i = -3; i <= 3; i++) {
            for (let j = -3; j <= 2; j++) {
                fluid.setObstacle(x + i, y + j, true);
            }
        }
    } else {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        fluid.addDensity(x, y, 200);
        fluid.addVelocity(x, y, dx * 0.5, dy * 0.5);
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * (N - 2)) + 1;
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * (N - 2)) + 1;

    if (activeMode === 'stone' || e.shiftKey) {
        const currentState = fluid.obstacles[x + y * fluid.size];
        for (let i = -4; i <= 4; i++) {
            for (let j = -3; j <= 3; j++) {
                fluid.setObstacle(x + i, y + j, !currentState);
            }
        }
    } else {
        fluid.addDensity(x, y, 1500);
    }
});

// Prevent context menu
canvas.oncontextmenu = (e) => e.preventDefault();

// Resolution change
resSlider.addEventListener('input', (e) => {
    N = parseInt(e.target.value);
    resValue.textContent = N;
    // Keep parameters consistent with initial state
    fluid = new Fluid(N, 0.000001, 0.0000001, 0.1);

    // Resize offscreen canvas
    offscreenCanvas.width = N;
    offscreenCanvas.height = N;
    // Update the image data variable used by draw()
    imageData = offCtx.createImageData(N, N);
    addInitialStones();
});

btnClearFluid.addEventListener('click', () => {
    fluid.density.fill(0);
    fluid.Vx.fill(0);
    fluid.Vy.fill(0);
});

btnClearObstacles.addEventListener('click', () => {
    fluid.obstacles.fill(0);
});

function draw() {
    const density = fluid.density;
    const data = imageData.data;
    const size = fluid.size;

    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            const idx = (i + j * size) * 4;

            if (fluid.obstacles[i + j * size]) {
                // Natural Dark Gray/Stone color
                data[idx] = 45;      // R
                data[idx + 1] = 45;    // G
                data[idx + 2] = 50;    // B
                data[idx + 3] = 255;
            } else {
                const d = density[i + j * size];
                const val = Math.max(0, Math.min(255, d * 255)); // Clamp to 0-255

                // Solid background interpolation
                // Background is ~ #0a0a0a (10, 10, 10)
                data[idx] = 10 + val * 0.3;     // R
                data[idx + 1] = 10 + val * 0.8; // G
                data[idx + 2] = 10 + val * 1.0; // B
                data[idx + 3] = 255;            // solid alpha
            }
        }
    }

    offCtx.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);

    // Sanity check: draw a small neon dot in the corner
    ctx.fillStyle = '#00f2ff';
    ctx.fillRect(10, 10, 5, 5);
}

function loop(time) {
    const dt = time - lastTime;

    if (dt >= 1000) {
        fps = frames;
        fpsCounter.textContent = fps;
        frames = 0;
        lastTime = time;
    }

    frames++;

    // River Flow: Inject constant density and downward velocity at the top
    // For N=256, we need more "push" to overcome numerical dissipation
    const injectionAmount = 5.0 * (N / 128);
    const velocityAmount = 15.0 * (N / 128);

    for (let i = 1; i < N - 1; i++) {
        fluid.addDensity(i, 1, injectionAmount);
        fluid.addVelocity(i, 1, 0, velocityAmount);
    }

    fluid.step();
    draw();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
