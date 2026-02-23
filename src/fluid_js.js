// Stable Fluids implementation in JS
// Based on Jos Stam's "Real-Time Fluid Dynamics for Games"

class Fluid {
    constructor(size, diffusion, viscosity, dt) {
        this.size = size;
        this.dt = dt;
        this.diff = diffusion;
        this.visc = viscosity;

        this.s = new Float32Array(size * size);
        this.density = new Float32Array(size * size);

        this.Vx = new Float32Array(size * size);
        this.Vy = new Float32Array(size * size);

        this.Vx0 = new Float32Array(size * size);
        this.Vy0 = new Float32Array(size * size);

        this.obstacles = new Uint8Array(size * size);
    }

    step() {
        const visc = this.visc;
        const diff = this.diff;
        const dt = this.dt;
        const Vx = this.Vx;
        const Vy = this.Vy;
        const Vx0 = this.Vx0;
        const Vy0 = this.Vy0;
        const s = this.s;
        const density = this.density;

        this.addGravity();

        this.diffuse(1, Vx0, Vx, visc, dt);
        this.diffuse(2, Vy0, Vy, visc, dt);

        this.project(Vx0, Vy0, Vx, Vy);

        this.advect(1, Vx, Vx0, Vx0, Vy0, dt);
        this.advect(2, Vy, Vy0, Vx0, Vy0, dt);

        this.project(Vx, Vy, Vx0, Vy0);

        this.diffuse(0, s, density, diff, dt);
        this.advect(0, density, s, Vx, Vy, dt);

        this.handleObstacles();
    }

    addGravity() {
        const N = this.size;
        const gravity = 0.15;

        for (let i = 0; i < N * N; i++) {
            if (!this.obstacles[i] && this.density[i] > 0.001) {
                this.Vy[i] += gravity * Math.min(this.density[i], 1);
            }
        }
    }

    handleObstacles() {
        const N = this.size;

        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                const idx = i + j * N;

                if (this.obstacles[idx]) {
                    this.density[idx] = 0;
                    this.Vx[idx] = 0;
                    this.Vy[idx] = 0;
                    this.Vx0[idx] = 0;
                    this.Vy0[idx] = 0;
                    continue;
                }

                const hasDown = this.obstacles[idx + N];

                if (hasDown && this.Vy[idx] > 0) {
                    const spread = this.Vy[idx] * 0.5;
                    this.Vy[idx] *= 0.3;

                    if (!this.obstacles[idx - 1]) {
                        this.Vx[idx - 1] += spread * 0.3;
                    }
                    if (!this.obstacles[idx + 1]) {
                        this.Vx[idx + 1] -= spread * 0.3;
                    }
                }
            }
        }
    }

    setObstacle(x, y, active) {
        if (x < 1 || x >= this.size - 1 || y < 1 || y >= this.size - 1) return;
        this.obstacles[x + y * this.size] = active ? 1 : 0;
    }

    addDensity(x, y, amount) {
        const index = x + y * this.size;
        if (index >= 0 && index < this.density.length && !this.obstacles[index]) {
            this.density[index] += amount;
        }
    }

    addVelocity(x, y, amountX, amountY) {
        const index = x + y * this.size;
        if (index >= 0 && index < this.Vx.length && !this.obstacles[index]) {
            this.Vx[index] += amountX;
            this.Vy[index] += amountY;
        }
    }

    diffuse(b, x, x0, diff, dt) {
        const a = dt * diff * (this.size - 2) * (this.size - 2);
        this.lin_solve(b, x, x0, a, 1 + 6 * a);
    }

    lin_solve(b, x, x0, a, c) {
        const cRecip = 1.0 / c;
        const N = this.size;

        for (let k = 0; k < 20; k++) {
            for (let j = 1; j < N - 1; j++) {
                for (let i = 1; i < N - 1; i++) {
                    const idx = i + j * N;
                    if (this.obstacles[idx]) continue;

                    x[idx] = (x0[idx] + a * (
                        (this.obstacles[idx - 1] ? x[idx] : x[idx - 1]) +
                        (this.obstacles[idx + 1] ? x[idx] : x[idx + 1]) +
                        (this.obstacles[idx - N] ? x[idx] : x[idx - N]) +
                        (this.obstacles[idx + N] ? x[idx] : x[idx + N])
                    )) * cRecip;
                }
            }
            this.set_bnd(b, x);
        }
    }

    project(velocX, velocY, p, div) {
        const N = this.size;

        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                const idx = i + j * N;

                if (this.obstacles[idx]) {
                    div[idx] = 0;
                    p[idx] = 0;
                    continue;
                }

                div[idx] = -0.5 * (
                    (this.obstacles[idx + 1] ? velocX[idx] : velocX[idx + 1]) -
                    (this.obstacles[idx - 1] ? velocX[idx] : velocX[idx - 1]) +
                    (this.obstacles[idx + N] ? velocY[idx] : velocY[idx + N]) -
                    (this.obstacles[idx - N] ? velocY[idx] : velocY[idx - N])
                ) / N;
                p[idx] = 0;
            }
        }
        this.set_bnd(0, div);
        this.set_bnd(0, p);
        this.lin_solve(0, p, div, 1, 4);

        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                const idx = i + j * N;

                if (this.obstacles[idx]) continue;

                velocX[idx] -= 0.5 * (
                    (this.obstacles[idx + 1] ? p[idx] : p[idx + 1]) -
                    (this.obstacles[idx - 1] ? p[idx] : p[idx - 1])
                ) * N;
                velocY[idx] -= 0.5 * (
                    (this.obstacles[idx + N] ? p[idx] : p[idx + N]) -
                    (this.obstacles[idx - N] ? p[idx] : p[idx - N])
                ) * N;
            }
        }
        this.set_bnd(1, velocX);
        this.set_bnd(2, velocY);
    }

    advect(b, d, d0, velocX, velocY, dt) {
        const N = this.size;
        const dtx = dt * (N - 2);
        const dty = dt * (N - 2);
        const Nfloat = N - 2;

        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                const idx = i + j * N;

                if (this.obstacles[idx]) {
                    d[idx] = 0;
                    continue;
                }

                const tmp1 = dtx * velocX[idx];
                const tmp2 = dty * velocY[idx];

                let x = i - tmp1;
                let y = j - tmp2;

                x = Math.max(0.5, Math.min(Nfloat + 0.5, x));
                y = Math.max(0.5, Math.min(Nfloat + 0.5, y));

                const i0 = Math.floor(x);
                const i1 = i0 + 1;
                const j0 = Math.floor(y);
                const j1 = j0 + 1;

                const s1 = x - i0;
                const s0 = 1.0 - s1;
                const t1 = y - j0;
                const t0 = 1.0 - t1;

                const idx00 = i0 + j0 * N;
                const idx01 = i0 + j1 * N;
                const idx10 = i1 + j0 * N;
                const idx11 = i1 + j1 * N;

                const val00 = d0[idx00];
                const val01 = d0[idx01];
                const val10 = d0[idx10];
                const val11 = d0[idx11];

                d[idx] = s0 * (t0 * val00 + t1 * val01) + s1 * (t0 * val10 + t1 * val11);
            }
        }
        this.set_bnd(b, d);
    }

    set_bnd(b, x) {
        const N = this.size;

        for (let i = 1; i < N - 1; i++) {
            x[i] = b === 2 ? -x[i + N] : x[i + N];
            x[i + (N - 1) * N] = b === 2 ? -x[i + (N - 2) * N] : x[i + (N - 2) * N];
        }
        for (let j = 1; j < N - 1; j++) {
            x[j * N] = b === 1 ? -x[1 + j * N] : x[1 + j * N];
            x[(N - 1) + j * N] = b === 1 ? -x[(N - 2) + j * N] : x[(N - 2) + j * N];
        }

        x[0] = 0.33 * (x[1] + x[N]);
        x[(N - 1) * N] = 0.33 * (x[1 + (N - 1) * N] + x[(N - 2) * N]);
        x[N - 1] = 0.33 * (x[N - 2] + x[2 * N - 1]);
        x[N * N - 1] = 0.33 * (x[(N - 2) * N + N - 1] + x[(N - 1) * N + N - 2]);
    }
}

export default Fluid;
