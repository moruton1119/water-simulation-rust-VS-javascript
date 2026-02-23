use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Fluid {
    size: usize,
    dt: f32,
    diff: f32,
    visc: f32,
    s: Vec<f32>,
    density: Vec<f32>,
    vx: Vec<f32>,
    vy: Vec<f32>,
    vx0: Vec<f32>,
    vy0: Vec<f32>,
    obstacles: Vec<u8>,
    sources: Vec<u8>,
}

#[wasm_bindgen]
impl Fluid {
    pub fn new(size: usize, diffusion: f32, viscosity: f32, dt: f32) -> Fluid {
        let n = size * size;
        Fluid {
            size,
            dt,
            diff: diffusion,
            visc: viscosity,
            s: vec![0.0; n],
            density: vec![0.0; n],
            vx: vec![0.0; n],
            vy: vec![0.0; n],
            vx0: vec![0.0; n],
            vy0: vec![0.0; n],
            obstacles: vec![0; n],
            sources: vec![0; n],
        }
    }

    pub fn step(&mut self) {
        self.apply_sources();
        self.add_gravity();

        let visc = self.visc;
        let diff = self.diff;
        let dt = self.dt;
        let n = self.size;

        self.diffuse(1, &mut self.vx0, &self.vx, visc, dt);
        self.diffuse(2, &mut self.vy0, &self.vy, visc, dt);

        self.project(&self.vx0.clone(), &self.vy0.clone(), &mut self.vx, &mut self.vy);

        let vx0 = self.vx0.clone();
        let vy0 = self.vy0.clone();
        self.advect(1, &mut self.vx, &vx0, &vx0, &vy0, dt);
        self.advect(2, &mut self.vy, &vy0, &vx0, &vy0, dt);

        self.project(&self.vx.clone(), &self.vy.clone(), &mut self.vx0, &mut self.vy0);

        let s = self.s.clone();
        self.diffuse(0, &mut self.s, &self.density, diff, dt);
        let s = self.s.clone();
        self.advect(0, &mut self.density, &s, &self.vx, &self.vy, dt);

        self.handle_obstacles();
    }

    pub fn add_density(&mut self, x: usize, y: usize, amount: f32) {
        let idx = x + y * self.size;
        if idx < self.density.len() && self.obstacles[idx] == 0 {
            self.density[idx] += amount;
        }
    }

    pub fn add_velocity(&mut self, x: usize, y: usize, amount_x: f32, amount_y: f32) {
        let idx = x + y * self.size;
        if idx < self.vx.len() && self.obstacles[idx] == 0 {
            self.vx[idx] += amount_x;
            self.vy[idx] += amount_y;
        }
    }

    pub fn set_obstacle(&mut self, x: usize, y: usize, active: bool) {
        if x < 1 || x >= self.size - 1 || y < 1 || y >= self.size - 1 {
            return;
        }
        let idx = x + y * self.size;
        self.obstacles[idx] = if active { 1 } else { 0 };
    }

    pub fn set_source(&mut self, x: usize, y: usize, active: bool) {
        if x < 1 || x >= self.size - 1 || y < 1 || y >= self.size - 1 {
            return;
        }
        let idx = x + y * self.size;
        self.sources[idx] = if active { 1 } else { 0 };
        if active {
            self.obstacles[idx] = 0;
        }
    }

    pub fn get_density_ptr(&self) -> *const f32 {
        self.density.as_ptr()
    }

    pub fn get_obstacles_ptr(&self) -> *const u8 {
        self.obstacles.as_ptr()
    }

    pub fn get_sources_ptr(&self) -> *const u8 {
        self.sources.as_ptr()
    }

    pub fn get_vx_ptr(&self) -> *const f32 {
        self.vx.as_ptr()
    }

    pub fn get_vy_ptr(&self) -> *const f32 {
        self.vy.as_ptr()
    }

    pub fn get_size(&self) -> usize {
        self.size
    }

    fn apply_sources(&mut self) {
        let n = self.size;
        let flow_rate = 150.0;
        let velocity = 1.5;

        for i in 0..n * n {
            if self.sources[i] != 0 && self.obstacles[i] == 0 {
                self.density[i] += flow_rate;
                self.vy[i] += velocity;
            }
        }
    }

    fn add_gravity(&mut self) {
        let n = self.size;
        let gravity = 0.2;

        for i in 0..n * n {
            if self.obstacles[i] == 0 && self.density[i] > 0.01 {
                self.vy[i] += gravity * self.density[i].min(1.0);
            }
        }
    }

    fn handle_obstacles(&mut self) {
        let n = self.size;

        for j in 1..n - 1 {
            for i in 1..n - 1 {
                let idx = i + j * n;

                if self.obstacles[idx] != 0 {
                    self.density[idx] = 0.0;
                    self.vx[idx] = 0.0;
                    self.vy[idx] = 0.0;
                    self.vx0[idx] = 0.0;
                    self.vy0[idx] = 0.0;
                    continue;
                }

                let has_left = self.obstacles[idx - 1] != 0;
                let has_right = self.obstacles[idx + 1] != 0;
                let has_down = self.obstacles[idx + n] != 0;

                if has_down && self.vy[idx] > 0.0 {
                    let spread = self.vy[idx] * 0.5;
                    self.vy[idx] *= 0.1;

                    if !has_left {
                        self.vx[idx - 1] += spread * 0.5;
                    }
                    if !has_right {
                        self.vx[idx + 1] -= spread * 0.5;
                    }
                }
            }
        }
    }

    fn diffuse(&mut self, b: i32, x: &mut Vec<f32>, x0: &Vec<f32>, diff: f32, dt: f32) {
        let n = self.size;
        let a = dt * diff * ((n - 2) as f32) * ((n - 2) as f32);
        self.lin_solve(b, x, x0, a, 1.0 + 6.0 * a);
    }

    fn lin_solve(&mut self, b: i32, x: &mut Vec<f32>, x0: &Vec<f32>, a: f32, c: f32) {
        let c_recip = 1.0 / c;
        let n = self.size;

        for _ in 0..20 {
            for j in 1..n - 1 {
                for i in 1..n - 1 {
                    let idx = i + j * n;
                    if self.obstacles[idx] != 0 {
                        continue;
                    }

                    let x_left = if self.obstacles[idx - 1] != 0 { x[idx] } else { x[idx - 1] };
                    let x_right = if self.obstacles[idx + 1] != 0 { x[idx] } else { x[idx + 1] };
                    let x_up = if self.obstacles[idx - n] != 0 { x[idx] } else { x[idx - n] };
                    let x_down = if self.obstacles[idx + n] != 0 { x[idx] } else { x[idx + n] };

                    x[idx] = (x0[idx] + a * (x_left + x_right + x_up + x_down)) * c_recip;
                }
            }
            self.set_bnd(b, x);
        }
    }

    fn project(&mut self, veloc_x: &Vec<f32>, veloc_y: &Vec<f32>, p: &mut Vec<f32>, div: &mut Vec<f32>) {
        let n = self.size;

        for j in 1..n - 1 {
            for i in 1..n - 1 {
                let idx = i + j * n;

                if self.obstacles[idx] != 0 {
                    div[idx] = 0.0;
                    p[idx] = 0.0;
                    continue;
                }

                let vx_right = if self.obstacles[idx + 1] != 0 { veloc_x[idx] } else { veloc_x[idx + 1] };
                let vx_left = if self.obstacles[idx - 1] != 0 { veloc_x[idx] } else { veloc_x[idx - 1] };
                let vy_down = if self.obstacles[idx + n] != 0 { veloc_y[idx] } else { veloc_y[idx + n] };
                let vy_up = if self.obstacles[idx - n] != 0 { veloc_y[idx] } else { veloc_y[idx - n] };

                div[idx] = -0.5 * (vx_right - vx_left + vy_down - vy_up) / (n as f32);
                p[idx] = 0.0;
            }
        }
        self.set_bnd(0, div);
        self.set_bnd(0, p);

        self.lin_solve(0, p, div, 1.0, 4.0);

        for j in 1..n - 1 {
            for i in 1..n - 1 {
                let idx = i + j * n;

                if self.obstacles[idx] != 0 {
                    continue;
                }

                let p_right = if self.obstacles[idx + 1] != 0 { p[idx] } else { p[idx + 1] };
                let p_left = if self.obstacles[idx - 1] != 0 { p[idx] } else { p[idx - 1] };
                let p_down = if self.obstacles[idx + n] != 0 { p[idx] } else { p[idx + n] };
                let p_up = if self.obstacles[idx - n] != 0 { p[idx] } else { p[idx - n] };

                self.vx[idx] -= 0.5 * (p_right - p_left) * (n as f32);
                self.vy[idx] -= 0.5 * (p_down - p_up) * (n as f32);
            }
        }
        self.set_bnd(1, &mut self.vx);
        self.set_bnd(2, &mut self.vy);
    }

    fn advect(&mut self, b: i32, d: &mut Vec<f32>, d0: &Vec<f32>, veloc_x: &Vec<f32>, veloc_y: &Vec<f32>, dt: f32) {
        let n = self.size;
        let dtx = dt * ((n - 2) as f32);
        let dty = dt * ((n - 2) as f32);
        let n_float = (n - 2) as f32;

        for j in 1..n - 1 {
            for i in 1..n - 1 {
                let idx = i + j * n;

                if self.obstacles[idx] != 0 {
                    d[idx] = 0.0;
                    continue;
                }

                let tmp1 = dtx * veloc_x[idx];
                let tmp2 = dty * veloc_y[idx];

                let mut x = (i as f32) - tmp1;
                let mut y = (j as f32) - tmp2;

                if x < 0.5 { x = 0.5; }
                if x > n_float + 0.5 { x = n_float + 0.5; }
                let i0 = x.floor() as usize;
                let i1 = i0 + 1;

                if y < 0.5 { y = 0.5; }
                if y > n_float + 0.5 { y = n_float + 0.5; }
                let j0 = y.floor() as usize;
                let j1 = j0 + 1;

                let s1 = x - (i0 as f32);
                let s0 = 1.0 - s1;
                let t1 = y - (j0 as f32);
                let t0 = 1.0 - t1;

                let idx00 = i0 + j0 * n;
                let idx01 = i0 + j1 * n;
                let idx10 = i1 + j0 * n;
                let idx11 = i1 + j1 * n;

                let val00 = d0[idx00];
                let val01 = d0[idx01];
                let val10 = d0[idx10];
                let val11 = d0[idx11];

                d[idx] = s0 * (t0 * val00 + t1 * val01) + s1 * (t0 * val10 + t1 * val11);
            }
        }
        self.set_bnd(b, d);
    }

    fn set_bnd(&mut self, b: i32, x: &mut Vec<f32>) {
        let n = self.size;

        for i in 1..n - 1 {
            x[i] = if b == 2 { -x[i + n] } else { x[i + n] };
            x[i + (n - 1) * n] = if b == 2 { -x[i + (n - 2) * n] } else { x[i + (n - 2) * n] };
        }
        for j in 1..n - 1 {
            x[j * n] = if b == 1 { -x[1 + j * n] } else { x[1 + j * n] };
            x[(n - 1) + j * n] = if b == 1 { -x[(n - 2) + j * n] } else { x[(n - 2) + j * n] };
        }

        x[0] = 0.33 * (x[1] + x[n]);
        x[(n - 1) * n] = 0.33 * (x[1 + (n - 1) * n] + x[(n - 2) * n]);
        x[n - 1] = 0.33 * (x[n - 2] + x[2 * n - 1]);
        x[n * n - 1] = 0.33 * (x[(n - 2) * n + n - 1] + x[(n - 1) * n + n - 2]);
    }
}

#[wasm_bindgen]
pub fn get_memory() -> JsValue {
    wasm_bindgen::memory()
}
