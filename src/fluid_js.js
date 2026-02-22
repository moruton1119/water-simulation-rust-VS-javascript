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

        this.obstacles = new Uint8Array(size * size); // 1 = obstacle, 0 = fluid
    }

    step() {
        let visc = this.visc;
        let diff = this.diff;
        let dt = this.dt;
        let Vx = this.Vx;
        let Vy = this.Vy;
        let Vx0 = this.Vx0;
        let Vy0 = this.Vy0;
        let s = this.s;
        let density = this.density;

        this.diffuse(1, Vx0, Vx, visc, dt);
        this.diffuse(2, Vy0, Vy, visc, dt);

        this.project(Vx0, Vy0, Vx, Vy);

        this.advect(1, Vx, Vx0, Vx0, Vy0, dt);
        this.advect(2, Vy, Vy0, Vx0, Vy0, dt);

        this.project(Vx, Vy, Vx0, Vy0);

        this.diffuse(0, s, density, diff, dt);
        this.advect(0, density, s, Vx, Vy, dt);

        this.applyObstacles();
    }

    applyObstacles() {
        for (let i = 0; i < this.size * this.size; i++) {
            if (this.obstacles[i]) {
                this.density[i] = 0;
                this.Vx[i] = 0;
                this.Vy[i] = 0;
                this.Vx0[i] = 0;
                this.Vy0[i] = 0;
            }
        }
    }

    setObstacle(x, y, active) {
        if (x < 1 || x >= this.size - 1 || y < 1 || y >= this.size - 1) return;
        this.obstacles[x + y * this.size] = active ? 1 : 0;
    }

    addDensity(x, y, amount) {
        let index = x + y * this.size;
        this.density[index] += amount;
    }

    addVelocity(x, y, amountX, amountY) {
        let index = x + y * this.size;
        this.Vx[index] += amountX;
        this.Vy[index] += amountY;
    }

    diffuse(b, x, x0, diff, dt) {
        let a = dt * diff * (this.size - 2) * (this.size - 2);
        this.lin_solve(b, x, x0, a, 1 + 6 * a);
    }

    lin_solve(b, x, x0, a, c) {
        let cRecip = 1.0 / c;
        for (let k = 0; k < 40; k++) {
            for (let j = 1; j < this.size - 1; j++) {
                for (let i = 1; i < this.size - 1; i++) {
                    const idx = i + j * this.size;
                    if (this.obstacles[idx]) continue;

                    x[idx] =
                        (x0[idx] +
                            a *
                            (x[idx + 1] +
                                x[idx - 1] +
                                x[idx + this.size] +
                                x[idx - this.size])) *
                        cRecip;
                }
            }
            this.set_bnd(b, x);
            this.set_custom_bnd(b, x);
        }
    }

    set_custom_bnd(b, x) {
        const N = this.size;
        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                const idx = i + j * N;
                if (this.obstacles[idx]) {
                    if (b === 1) {
                        // Reflect X. If surrounded by stones, zero out.
                        let left = this.obstacles[idx - 1] === 0 ? x[idx - 1] : 0;
                        let right = this.obstacles[idx + 1] === 0 ? x[idx + 1] : 0;
                        x[idx] = -0.5 * (left + right);
                    } else if (b === 2) {
                        // Reflect Y
                        let up = this.obstacles[idx - N] === 0 ? x[idx - N] : 0;
                        let down = this.obstacles[idx + N] === 0 ? x[idx + N] : 0;
                        x[idx] = -0.5 * (up + down);
                    } else {
                        // Clear density inside stone
                        x[idx] = 0;
                    }
                }
            }
        }
    }

    project(velocX, velocY, p, div) {
        for (let j = 1; j < this.size - 1; j++) {
            for (let i = 1; i < this.size - 1; i++) {
                div[i + j * this.size] =
                    -0.5 *
                    (velocX[i + 1 + j * this.size] -
                        velocX[i - 1 + j * this.size] +
                        velocY[i + (j + 1) * this.size] -
                        velocY[i + (j - 1) * this.size]) /
                    this.size;
                p[i + j * this.size] = 0;
            }
        }
        this.set_bnd(0, div);
        this.set_bnd(0, p);
        this.lin_solve(0, p, div, 1, 6);

        for (let j = 1; j < this.size - 1; j++) {
            for (let i = 1; i < this.size - 1; i++) {
                velocX[i + j * this.size] -=
                    0.5 * (p[i + 1 + j * this.size] - p[i - 1 + j * this.size]) * this.size;
                velocY[i + j * this.size] -=
                    0.5 * (p[i + (j + 1) * this.size] - p[i + (j - 1) * this.size]) * this.size;
            }
        }
        this.set_bnd(1, velocX);
        this.set_bnd(2, velocY);
    }

    advect(b, d, d0, velocX, velocY, dt) {
        let i0, i1, j0, j1;

        let dtx = dt * (this.size - 2);
        let dty = dt * (this.size - 2);

        let s0, s1, t0, t1;
        let tmp1, tmp2, x, y;

        let Nfloat = this.size - 2;
        let ifloat, jfloat;
        let i, j;

        for (j = 1, jfloat = 1; j < this.size - 1; j++, jfloat++) {
            for (i = 1, ifloat = 1; i < this.size - 1; i++, ifloat++) {
                tmp1 = dtx * velocX[i + j * this.size];
                tmp2 = dty * velocY[i + j * this.size];
                x = ifloat - tmp1;
                y = jfloat - tmp2;

                if (x < 0.5) x = 0.5;
                if (x > Nfloat + 0.5) x = Nfloat + 0.5;
                i0 = Math.floor(x);
                i1 = i0 + 1.0;
                if (y < 0.5) y = 0.5;
                if (y > Nfloat + 0.5) y = Nfloat + 0.5;
                j0 = Math.floor(y);
                j1 = j0 + 1.0;

                s1 = x - i0;
                s0 = 1.0 - s1;
                t1 = y - j0;
                t0 = 1.0 - t1;

                let i0i = Math.floor(i0);
                let i1i = i0i + 1;
                let j0i = Math.floor(j0);
                let j1i = j0i + 1;

                d[i + j * this.size] =
                    s0 * (t0 * d0[i0i + j0i * this.size] + t1 * d0[i0i + j1i * this.size]) +
                    s1 * (t0 * d0[i1i + j0i * this.size] + t1 * d0[i1i + j1i * this.size]);
            }
        }
        this.set_bnd(b, d);
    }

    set_bnd(b, x) {
        for (let i = 1; i < this.size - 1; i++) {
            x[i + 0 * this.size] = b == 2 ? -x[i + 1 * this.size] : x[i + 1 * this.size];
            x[i + (this.size - 1) * this.size] =
                b == 2 ? -x[i + (this.size - 2) * this.size] : x[i + (this.size - 2) * this.size];
        }
        for (let j = 1; j < this.size - 1; j++) {
            x[0 + j * this.size] = b == 1 ? -x[1 + j * this.size] : x[1 + j * this.size];
            x[(this.size - 1) + j * this.size] =
                b == 1 ? -x[(this.size - 2) + j * this.size] : x[(this.size - 2) + j * this.size];
        }

        x[0 + 0 * this.size] = 0.33 * (x[1 + 0 * this.size] + x[0 + 1 * this.size]);
        x[0 + (this.size - 1) * this.size] =
            0.33 * (x[1 + (this.size - 1) * this.size] + x[0 + (this.size - 2) * this.size]);
        x[(this.size - 1) + 0 * this.size] =
            0.33 * (x[(this.size - 2) + 0 * this.size] + x[(this.size - 1) + 1 * this.size]);
        x[(this.size - 1) + (this.size - 1) * this.size] =
            0.33 *
            (x[(this.size - 2) + (this.size - 1) * this.size] +
                x[(this.size - 1) + (this.size - 2) * this.size]);
    }
}

export default Fluid;
