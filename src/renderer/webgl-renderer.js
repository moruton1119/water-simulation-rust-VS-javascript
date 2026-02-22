export class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    render(fluid) {
        const ctx = this.ctx;
        const size = fluid.size;
        const canvas = this.canvas;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tempCtx = tempCanvas.getContext('2d');
        const imageData = tempCtx.createImageData(size, size);
        const data = imageData.data;

        for (let j = 0; j < size; j++) {
            for (let i = 0; i < size; i++) {
                const idx = (i + j * size) * 4;
                const fluidIdx = i + j * size;

                if (fluid.obstacles[fluidIdx]) {
                    data[idx] = 80;
                    data[idx + 1] = 85;
                    data[idx + 2] = 90;
                    data[idx + 3] = 255;
                } else {
                    const d = fluid.density[fluidIdx];
                    const vx = fluid.Vx[fluidIdx];
                    const vy = fluid.Vy[fluidIdx];
                    const speed = Math.sqrt(vx * vx + vy * vy);

                    const val = Math.min(1, d);
                    const speedVal = Math.min(1, speed * 3);

                    const h = 0.55 - val * 0.08;
                    const s = 0.75 + speedVal * 0.25;
                    const l = 0.12 + val * 0.55;

                    const rgb = this.hslToRgb(h, s, l);

                    data[idx] = rgb[0];
                    data[idx + 1] = rgb[1];
                    data[idx + 2] = rgb[2];
                    data[idx + 3] = 255;
                }
            }
        }

        tempCtx.putImageData(imageData, 0, 0);

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
}
