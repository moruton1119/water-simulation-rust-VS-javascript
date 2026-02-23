import './style.css';
import Fluid from './fluid_js.js';
import { WebGLRenderer } from './renderer/webgl-renderer.js';

class FluidSimulator {
    constructor() {
        this.N = 256;
        this.activeMode = 'water';
        this.viewMode = 'dual';
        this.waterAmount = 300;

        this.jsFluid = new Fluid(this.N, 0, 0.00000001, 0.1);
        this.wasmFluid = new Fluid(this.N, 0, 0.00000001, 0.1);
        this.wasmAvailable = false;

        this.initCanvas();
        this.initRenderers();
        this.initControls();
        this.initEventListeners();
        this.startLoop();
    }

    initCanvas() {
        this.jsCanvas = document.getElementById('canvas-js');
        this.wasmCanvas = document.getElementById('canvas-wasm');

        this.resizeCanvases();
        window.addEventListener('resize', () => {
            this.resizeCanvases();
            if (this.jsRenderer) this.jsRenderer.resize(this.jsCanvas.width, this.jsCanvas.height);
            if (this.wasmRenderer) this.wasmRenderer.resize(this.wasmCanvas.width, this.wasmCanvas.height);
        });
    }

    resizeCanvases() {
        const panels = document.querySelectorAll('.canvas-panel');
        panels.forEach(panel => {
            const canvas = panel.querySelector('canvas');
            if (canvas) {
                canvas.width = panel.clientWidth;
                canvas.height = panel.clientHeight - 40;
            }
        });
    }

    initRenderers() {
        this.jsRenderer = new WebGLRenderer(this.jsCanvas);
        this.wasmRenderer = new WebGLRenderer(this.wasmCanvas);

        if (this.jsRenderer.gl) {
            this.jsRenderer.resize(this.jsCanvas.width, this.jsCanvas.height);
        }
        if (this.wasmRenderer.gl) {
            this.wasmRenderer.resize(this.wasmCanvas.width, this.wasmCanvas.height);
        }
    }

    initControls() {
        this.fpsJsEl = document.querySelector('#fps-js .fps-value');
        this.fpsWasmEl = document.querySelector('#fps-wasm .fps-value');
        this.resSlider = document.getElementById('range-resolution');
        this.resValue = document.getElementById('val-resolution');
        this.currentRes = document.getElementById('current-resolution');
        this.obstaclesSlider = document.getElementById('range-obstacles');
        this.obstaclesValue = document.getElementById('val-obstacles');
        this.statusJs = document.getElementById('status-js');
        this.statusWasm = document.getElementById('status-wasm');

        this.statusJs.textContent = 'WebGL Active';
        this.statusJs.className = 'engine-status active';
        this.statusWasm.textContent = 'Loading WASM...';
        this.statusWasm.className = 'engine-status loading';

        this.waterAmountSlider = document.getElementById('range-water-amount');
        this.waterAmountValue = document.getElementById('val-water-amount');

        if (this.waterAmountSlider) {
            this.waterAmountSlider.addEventListener('input', (e) => {
                this.waterAmount = parseInt(e.target.value);
                this.waterAmountValue.textContent = this.waterAmount;
            });
        }
    }

    initEventListeners() {
        this.initModeButtons();
        this.initViewModeButtons();
        this.initResolutionSlider();
        this.initObstaclesSlider();
        this.initActionButtons();
        this.initMouseEvents();
    }

    initModeButtons() {
        const btnWater = document.getElementById('btn-mode-water');
        const btnStone = document.getElementById('btn-mode-stone');
        const btnSource = document.getElementById('btn-mode-source');
        const buttons = [btnWater, btnStone, btnSource];

        const setActive = (mode, activeBtn) => {
            this.activeMode = mode;
            buttons.forEach(b => b.classList.remove('active'));
            activeBtn.classList.add('active');
        };

        btnWater.addEventListener('click', () => setActive('water', btnWater));
        btnStone.addEventListener('click', () => setActive('stone', btnStone));
        btnSource.addEventListener('click', () => setActive('source', btnSource));
    }

    initViewModeButtons() {
        const btnDual = document.getElementById('btn-mode-dual');
        const btnJs = document.getElementById('btn-mode-js');
        const btnWasm = document.getElementById('btn-mode-wasm');
        const panelJs = document.getElementById('panel-js');
        const panelWasm = document.getElementById('panel-wasm');

        const setViewMode = (mode) => {
            this.viewMode = mode;
            [btnDual, btnJs, btnWasm].forEach(b => b.classList.remove('active'));

            if (mode === 'dual') {
                btnDual.classList.add('active');
                panelJs.classList.remove('hidden', 'full-width');
                panelWasm.classList.remove('hidden', 'full-width');
            } else if (mode === 'js') {
                btnJs.classList.add('active');
                panelJs.classList.remove('hidden');
                panelJs.classList.add('full-width');
                panelWasm.classList.add('hidden');
            } else {
                btnWasm.classList.add('active');
                panelWasm.classList.remove('hidden');
                panelWasm.classList.add('full-width');
                panelJs.classList.add('hidden');
            }
            setTimeout(() => {
                this.resizeCanvases();
                if (this.jsRenderer) this.jsRenderer.resize(this.jsCanvas.width, this.jsCanvas.height);
                if (this.wasmRenderer) this.wasmRenderer.resize(this.wasmCanvas.width, this.wasmCanvas.height);
            }, 100);
        };

        btnDual.addEventListener('click', () => setViewMode('dual'));
        btnJs.addEventListener('click', () => setViewMode('js'));
        btnWasm.addEventListener('click', () => setViewMode('wasm'));
    }

    initResolutionSlider() {
        this.resSlider.addEventListener('input', (e) => {
            this.N = parseInt(e.target.value);
            this.resValue.textContent = this.N;
            this.currentRes.textContent = this.N;

            this.jsFluid = new Fluid(this.N, 0, 0.00000001, 0.05);
            this.wasmFluid = new Fluid(this.N, 0, 0.00000001, 0.05);
        });
    }

    initObstaclesSlider() {
        this.obstaclesSlider.addEventListener('input', (e) => {
            const count = parseInt(e.target.value);
            this.obstaclesValue.textContent = count;
            this.generateRandomObstacles(count);
        });
    }

    generateRandomObstacles(count) {
        this.jsFluid.obstacles.fill(0);
        this.wasmFluid.obstacles.fill(0);

        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * (this.N - 4)) + 2;
            const y = Math.floor(Math.random() * (this.N - 4)) + 2;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    this.jsFluid.setObstacle(x + dx, y + dy, true);
                    this.wasmFluid.setObstacle(x + dx, y + dy, true);
                }
            }
        }
    }

    initActionButtons() {
        document.getElementById('btn-generate-obstacles').addEventListener('click', () => {
            const count = Math.floor(Math.random() * 30) + 10;
            this.obstaclesSlider.value = count;
            this.obstaclesValue.textContent = count;
            this.generateRandomObstacles(count);
        });

        document.getElementById('btn-clear-fluid').addEventListener('click', () => {
            this.jsFluid.density.fill(0);
            this.jsFluid.Vx.fill(0);
            this.jsFluid.Vy.fill(0);
            this.wasmFluid.density.fill(0);
            this.wasmFluid.Vx.fill(0);
            this.wasmFluid.Vy.fill(0);
        });

        document.getElementById('btn-clear-obstacles').addEventListener('click', () => {
            this.jsFluid.obstacles.fill(0);
            this.wasmFluid.obstacles.fill(0);
            this.obstaclesSlider.value = 0;
            this.obstaclesValue.textContent = '0';
        });

        document.getElementById('btn-clear-sources').addEventListener('click', () => {
            this.jsFluid.sources.fill(0);
            this.wasmFluid.sources.fill(0);
        });

        document.getElementById('btn-run-benchmark').addEventListener('click', () => {
            this.runBenchmark();
        });

        document.getElementById('btn-export-benchmark').addEventListener('click', () => {
            this.exportBenchmark();
        });
    }

    initMouseEvents() {
        let isMouseDown = false;
        let lastX = 0;
        let lastY = 0;
        let lastGridX = 0;
        let lastGridY = 0;
        let activeCanvas = null;

        const getGridPos = (e, canvas) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(((e.clientX - rect.left) / rect.width) * (this.N - 2)) + 1;
            const y = Math.floor(((e.clientY - rect.top) / rect.height) * (this.N - 2)) + 1;
            return { x: Math.max(1, Math.min(this.N - 2, x)), y: Math.max(1, Math.min(this.N - 2, y)) };
        };

        const drawLine = (x0, y0, x1, y1, callback) => {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1;
            const sy = y0 < y1 ? 1 : -1;
            let err = dx - dy;

            let x = x0;
            let y = y0;

            while (true) {
                callback(x, y);

                if (x === x1 && y === y1) break;

                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y += sy;
                }
            }
        };

        const handleInteraction = (e, canvas, isFirst = false) => {
            const { x, y } = getGridPos(e, canvas);

            if (this.activeMode === 'stone') {
                if (isFirst) {
                    for (let i = -1; i <= 1; i++) {
                        for (let j = -1; j <= 1; j++) {
                            this.jsFluid.setObstacle(x + i, y + j, true);
                            this.wasmFluid.setObstacle(x + i, y + j, true);
                        }
                    }
                } else {
                    drawLine(lastGridX, lastGridY, x, y, (px, py) => {
                        for (let i = -1; i <= 1; i++) {
                            for (let j = -1; j <= 1; j++) {
                                this.jsFluid.setObstacle(px + i, py + j, true);
                                this.wasmFluid.setObstacle(px + i, py + j, true);
                            }
                        }
                    });
                }
                lastGridX = x;
                lastGridY = y;
            } else if (this.activeMode === 'source') {
                this.jsFluid.setSource(x, y, true);
                this.wasmFluid.setSource(x, y, true);
                lastGridX = x;
                lastGridY = y;
            } else {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.jsFluid.addDensity(x, y, this.waterAmount);
                this.jsFluid.addVelocity(x, y, dx * 0.5, dy * 0.5);
                this.wasmFluid.addDensity(x, y, this.waterAmount);
                this.wasmFluid.addVelocity(x, y, dx * 0.5, dy * 0.5);
            }

            lastX = e.clientX;
            lastY = e.clientY;
        };

        [this.jsCanvas, this.wasmCanvas].forEach(canvas => {
            canvas.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                activeCanvas = canvas;
                lastX = e.clientX;
                lastY = e.clientY;
                const { x, y } = getGridPos(e, canvas);
                lastGridX = x;
                lastGridY = y;
                handleInteraction(e, canvas, true);
            });

            canvas.addEventListener('mousemove', (e) => {
                if (isMouseDown && activeCanvas === canvas) {
                    handleInteraction(e, canvas, false);
                }
            });

            canvas.addEventListener('click', (e) => {
                if (this.activeMode === 'stone') {
                    handleInteraction(e, canvas, true);
                }
            });

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        });

        window.addEventListener('mouseup', () => {
            isMouseDown = false;
            activeCanvas = null;
        });
    }

    updateFps(fpsJs, fpsWasm) {
        this.fpsJsEl.textContent = Math.round(fpsJs);
        this.fpsWasmEl.textContent = Math.round(fpsWasm);

        const jsOverlay = document.getElementById('fps-js');
        const wasmOverlay = document.getElementById('fps-wasm');

        jsOverlay.className = 'fps-overlay ' + (fpsJs < 30 ? 'slow' : fpsJs < 50 ? 'ok' : 'fast');
        wasmOverlay.className = 'fps-overlay ' + (fpsWasm < 30 ? 'slow' : fpsWasm < 50 ? 'ok' : 'fast');
    }

    startLoop() {
        let lastTime = performance.now();
        let framesJs = 0;
        let framesWasm = 0;
        let fpsJs = 0;
        let fpsWasm = 0;
        let lastFpsUpdate = lastTime;

        const loop = (time) => {
            const dt = time - lastTime;
            lastTime = time;

            if (time - lastFpsUpdate >= 1000) {
                fpsJs = framesJs;
                fpsWasm = framesWasm;
                this.updateFps(fpsJs, fpsWasm);
                framesJs = 0;
                framesWasm = 0;
                lastFpsUpdate = time;
            }

            this.jsFluid.step();
            this.wasmFluid.step();

            if (this.viewMode !== 'wasm') {
                this.jsRenderer.render(this.jsFluid);
                framesJs++;
            }

            if (this.viewMode !== 'js') {
                this.wasmRenderer.render(this.wasmFluid);
                framesWasm++;
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    async runBenchmark() {
        const btn = document.getElementById('btn-run-benchmark');
        btn.disabled = true;
        btn.textContent = 'Running...';

        const benchmarkSection = document.getElementById('benchmark-section');
        benchmarkSection.classList.add('visible');

        const resolutions = [128, 256, 384, 512];
        const results = { js: [], wasm: [] };

        for (const res of resolutions) {
            this.N = res;
            this.resSlider.value = res;
            this.resValue.textContent = res;
            this.currentRes.textContent = res;

            this.jsFluid = new Fluid(this.N, 0, 0.00000001, 0.05);
            this.wasmFluid = new Fluid(this.N, 0, 0.00000001, 0.05);

            await new Promise(resolve => setTimeout(resolve, 100));

            const measureFps = (fluid, renderer) => {
                return new Promise(resolve => {
                    let frames = 0;
                    const startTime = performance.now();
                    const duration = 2000;

                    const measure = () => {
                        const elapsed = performance.now() - startTime;
                        if (elapsed >= duration) {
                            resolve(Math.round(frames / (duration / 1000)));
                            return;
                        }

                        fluid.step();
                        renderer.render(fluid);
                        frames++;

                        requestAnimationFrame(measure);
                    };

                    measure();
                });
            };

            const jsFps = await measureFps(this.jsFluid, this.jsRenderer);
            const wasmFps = await measureFps(this.wasmFluid, this.wasmRenderer);

            results.js.push(jsFps);
            results.wasm.push(wasmFps);
        }

        this.benchmarkResults = { resolutions, results };
        this.drawBenchmarkGraph(resolutions, results);

        btn.disabled = false;
        btn.textContent = 'Run Benchmark';
    }

    drawBenchmarkGraph(resolutions, results) {
        const canvas = document.getElementById('graph-canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;

        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const width = canvas.width - padding.left - padding.right;
        const height = canvas.height - padding.top - padding.bottom;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const maxFps = Math.max(...results.js, ...results.wasm, 60);
        const barWidth = width / (resolutions.length * 2.5);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + height - (height * (i / 4));
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + width, y);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '10px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxFps * (i / 4)), padding.left - 10, y + 3);
        }

        resolutions.forEach((res, i) => {
            const x = padding.left + (width / resolutions.length) * (i + 0.5);

            const jsHeight = (results.js[i] / maxFps) * height;
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(x - barWidth - 2, padding.top + height - jsHeight, barWidth, jsHeight);

            const wasmHeight = (results.wasm[i] / maxFps) * height;
            ctx.fillStyle = '#10b981';
            ctx.fillRect(x + 2, padding.top + height - wasmHeight, barWidth, wasmHeight);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '11px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(res.toString(), x, canvas.height - 15);
        });
    }

    exportBenchmark() {
        if (!this.benchmarkResults) return;

        const canvas = document.getElementById('graph-canvas');
        const link = document.createElement('a');
        link.download = 'benchmark-results.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}

new FluidSimulator();
