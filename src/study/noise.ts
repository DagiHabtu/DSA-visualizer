/**
 * THROWAWAY (aesthetic study only) — gradient noise + curl.
 *
 * Everything organic in the study comes from here: the wandering of the specks,
 * the wobble on the form's boundary, the wobble on hand-drawn line work, and the
 * blotching of the paper. Random walks look like static; curl noise looks like air.
 */

/** Small, fast, seedable PRNG. Deterministic so a look can be reproduced. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD3: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Classic Perlin gradient noise, 3D. Output is roughly [-1, 1]. */
export class Noise {
  private readonly perm: Uint8Array;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private dot(hash: number, x: number, y: number, z: number): number {
    const g = GRAD3[hash % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  }

  noise3(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    const x1 = lerp(this.dot(p[AA], xf, yf, zf), this.dot(p[BA], xf - 1, yf, zf), u);
    const x2 = lerp(this.dot(p[AB], xf, yf - 1, zf), this.dot(p[BB], xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);

    const x3 = lerp(this.dot(p[AA + 1], xf, yf, zf - 1), this.dot(p[BA + 1], xf - 1, yf, zf - 1), u);
    const x4 = lerp(
      this.dot(p[AB + 1], xf, yf - 1, zf - 1),
      this.dot(p[BB + 1], xf - 1, yf - 1, zf - 1),
      u,
    );
    const y2 = lerp(x3, x4, v);

    return lerp(y1, y2, w) * 1.08;
  }

  /** 2D slice, offset off the integer lattice plane where gradients vanish. */
  noise2(x: number, y: number): number {
    return this.noise3(x, y, 0.371);
  }

  /** Fractal sum — used for the paper's large-scale blotching. */
  fbm2(x: number, y: number, octaves: number): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.07;
    }
    return sum / norm;
  }
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Divergence-free flow: v = (dpsi/dy, -dpsi/dx) of a scalar noise potential.
 * Divergence-free is the whole point — specks swirl and shear past each other
 * instead of piling into sources and draining into sinks. That is what reads
 * as a flock rather than as particles.
 *
 * Writes into `out` to keep the per-frame allocation count at zero.
 */
export function curl(n: Noise, x: number, y: number, z: number, eps: number, out: Vec2): void {
  const n1 = n.noise3(x, y + eps, z);
  const n2 = n.noise3(x, y - eps, z);
  const n3 = n.noise3(x + eps, y, z);
  const n4 = n.noise3(x - eps, y, z);
  const inv = 1 / (2 * eps);
  out.x = (n1 - n2) * inv;
  out.y = -(n3 - n4) * inv;
}
