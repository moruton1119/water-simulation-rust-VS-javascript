use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Fluid {
    size: usize,
    dt: f32,
    diff: f32,
    visc: f32,
    density: Vec<f32>,
    s: Vec<f32>,
    vx: Vec<f32>,
    vy: Vec<f32>,
    vx0: Vec<f32>,
    vy0: Vec<f32>,
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
            density: vec![0.0; n],
            s: vec![0.0; n],
            vx: vec![0.0; n],
            vy: vec![0.0; n],
            vx0: vec![0.0; n],
            vy0: vec![0.0; n],
        }
    }

    pub fn step(&mut self) {
        let size = self.size;
        let visc = self.visc;
        let diff = self.diff;
        let dt = self.dt;

        self.diffuse(1, 1, visc, dt); // vx
        self.diffuse(2, 2, visc, dt); // vy

        self.project(1, 2, 3, 4); // Use vx0, vy0 for scratch

        self.advect(1, 1, 3, 4, dt); // vx
        self.advect(2, 2, 3, 4, dt); // vy

        self.project(1, 2, 3, 4);

        self.diffuse(0, 5, diff, dt); // density
        self.advect(0, 5, 1, 2, dt); // density with current vx, vy
    }

    pub fn add_density(&mut self, x: usize, y: usize, amount: f32) {
        let index = x + y * self.size;
        if index < self.density.len() {
            self.density[index] += amount;
        }
    }

    pub fn add_velocity(&mut self, x: usize, y: usize, amount_x: f32, amount_y: f32) {
        let index = x + y * self.size;
        if index < self.vx.len() {
            self.vx[index] += amount_x;
            self.vy[index] += amount_y;
        }
    }

    pub fn get_density_ptr(&self) -> *const f32 {
        self.density.as_ptr()
    }

    // Indices for internal buffers:
    // 1: vx, 2: vy, 3: vx0, 4: vy0, 5: density, 6: s
    fn get_buffer_mut(&mut self, id: u8) -> &mut [f32] {
        match id {
            1 => &mut self.vx,
            2 => &mut self.vy,
            3 => &mut self.vx0,
            4 => &mut self.vy0,
            5 => &mut self.density,
            _ => &mut self.s,
        }
    }

    fn get_buffer(&self, id: u8) -> &[f32] {
        match id {
            1 => &self.vx,
            2 => &self.vy,
            3 => &self.vx0,
            4 => &self.vy0,
            5 => &self.density,
            _ => &self.s,
        }
    }

    fn diffuse(&mut self, b: i32, x_id: u8, diff: f32, dt: f32) {
        let a = dt * diff * (self.size as f32 - 2.0) * (self.size as f32 - 2.0);
        self.lin_solve(b, x_id, x_id, a, 1.0 + 6.0 * a);
    }

    fn lin_solve(&mut self, b: i32, x_id: u8, x0_id: u8, a: f32, c: f32) {
        let c_recip = 1.0 / c;
        let size = self.size;
        
        for _ in 0..20 {
            for j in 1..size - 1 {
                for i in 1..size - 1 {
                    let idx = i + j * size;
                    // Note: This is an approximation of the Gauss-Seidel method.
                    // In a simpler Rust implementation, we avoid borrowing issues by cloning or indexing carefully.
                    // To stay efficient, we access values directly.
                    let val = (self.get_buffer(x0_id)[idx] +
                        a * (self.get_buffer(x_id)[idx + 1] +
                             self.get_buffer(x_id)[idx - 1] +
                             self.get_buffer(x_id)[idx + size] +
                             self.get_buffer(x_id)[idx - size])) * c_recip;
                    self.get_buffer_mut(x_id)[idx] = val;
                }
            }
            self.set_bnd(b, x_id);
        }
    }

    fn project(&mut self, vx_id: u8, vy_id: u8, p_id: u8, div_id: u8) {
        let size = self.size;
        for j in 1..size - 1 {
            for i in 1..size - 1 {
                let idx = i + j * size;
                self.get_buffer_mut(div_id)[idx] = -0.5 * (
                    self.get_buffer(vx_id)[idx + 1] - self.get_buffer(vx_id)[idx - 1] +
                    self.get_buffer(vy_id)[idx + size] - self.get_buffer(vy_id)[idx - size]
                ) / size as f32;
                self.get_buffer_mut(p_id)[idx] = 0.0;
            }
        }
        self.set_bnd(0, div_id);
        self.set_bnd(0, p_id);
        self.lin_solve(0, p_id, div_id, 1.0, 6.0);

        for j in 1..size - 1 {
            for i in 1..size - 1 {
                let idx = i + j * size;
                self.get_buffer_mut(vx_id)[idx] -= 0.5 * (self.get_buffer(p_id)[idx + 1] - self.get_buffer(p_id)[idx - 1]) * size as f32;
                self.get_buffer_mut(vy_id)[idx] -= 0.5 * (self.get_buffer(p_id)[idx + size] - self.get_buffer(p_id)[idx - size]) * size as f32;
            }
        }
        self.set_bnd(1, vx_id);
        self.set_bnd(2, vy_id);
    }

    fn advect(&mut self, b: i32, d_id: u8, vx_id: u8, vy_id: u8, dt: f32) {
        let size = self.size;
        let dtx = dt * (size as f32 - 2.0);
        let dty = dt * (size as f32 - 2.0);
        let n_float = size as f32 - 2.0;

        // Clone current state for reading during advection to avoid double updates
        let d0 = self.get_buffer(d_id).to_vec();
        let vx = self.get_buffer(vx_id).to_vec();
        let vy = self.get_buffer(vy_id).to_vec();

        for j in 1..size - 1 {
            for i in 1..size - 1 {
                let idx = i + j * size;
                let mut x = i as f32 - dtx * vx[idx];
                let mut y = j as f32 - dty * vy[idx];

                if x < 0.5 { x = 0.5; }
                if x > n_float + 0.5 { x = n_float + 0.5; }
                let i0 = x.floor();
                let i1 = i0 + 1.0;

                if y < 0.5 { y = 0.5; }
                if y > n_float + 0.5 { y = n_float + 0.5; }
                let j0 = y.floor();
                let j1 = j0 + 1.0;

                let s1 = x - i0;
                let s0 = 1.0 - s1;
                let t1 = y - j0;
                let t0 = 1.0 - t1;

                let i0i = i0 as usize;
                let i1i = i1 as usize;
                let j0i = j0 as usize;
                let j1i = j1 as usize;

                self.get_buffer_mut(d_id)[idx] = 
                    s0 * (t0 * d0[i0i + j0i * size] + t1 * d0[i0i + j1i * size]) +
                    s1 * (t0 * d0[i1i + j0i * size] + t1 * d0[i1i + j1i * size]);
            }
        }
        self.set_bnd(b, d_id);
    }

    fn set_bnd(&mut self, b: i32, x_id: u8) {
        let size = self.size;
        let x = self.get_buffer_mut(x_id);
        
        for i in 1..size - 1 {
            x[i + 0 * size] = if b == 2 { -x[i + 1 * size] } else { x[i + 1 * size] };
            x[i + (size - 1) * size] = if b == 2 { -x[i + (size - 2) * size] } else { x[i + (size - 2) * size] };
        }
        for j in 1..size - 1 {
            x[0 + j * size] = if b == 1 { -x[1 + j * size] } else { x[1 + j * size] };
            x[(size - 1) + j * size] = if b == 1 { -x[(size - 2) + j * size] } else { x[(size - 2) + j * size] };
        }

        x[0 + 0 * size] = 0.33 * (x[1 + 0 * size] + x[0 + 1 * size]);
        x[0 + (size - 1) * size] = 0.33 * (x[1 + (size - 1) * size] + x[0 + (size - 2) * size]);
        x[(size - 1) + 0 * size] = 0.33 * (x[(size - 2) + 0 * size] + x[(size - 1) + 1 * size]);
        x[(size - 1) + (size - 1) * size] = 0.33 * (x[(size - 2) + (size - 1) * size] + x[(size - 1) + (size - 2) * size]);
    }
}
