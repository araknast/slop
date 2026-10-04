export const SIGMA = 70; // px; matches the blur(70px) the blobs used to carry
export const BLOBS = [
  { cls: 'b1', size: 55, color: [109, 40, 217], r0: 0.65, opacity: 0.55 },
  { cls: 'b2', size: 45, color: [8, 145, 178], r0: 0.65, opacity: 0.55 },
  { cls: 'b3', size: 40, color: [190, 24, 93], r0: 0.65, opacity: 0.4 },
  { cls: 'b4', size: 35, color: [5, 150, 105], r0: 0.65, opacity: 0.35 },
];

/** Scaled modified Bessel I0(x)·e^-|x| (Abramowitz & Stegun 9.8.1/9.8.2). */
function i0e(x: number) {
  const a = Math.abs(x);
  if (a < 3.75) {
    const t = (a / 3.75) ** 2;
    return Math.exp(-a) * (1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813))))));
  }
  const t = 3.75 / a;
  return (0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))))) / Math.sqrt(a);
}

/**
 * Radial profile of a Gaussian-blurred (σ) linear-falloff disc, sampled at `n+1` radii in [0, reach].
 * The angular integral of a 2D Gaussian has the closed form exp(-(r-ρ)²/2σ²)·I0e(rρ/σ²)/σ²,
 * so the old `filter: blur(70px)` becomes plain gradient stops and needs no filter pass.
 */
function profile(R0: number, reach: number, n: number) {
  const out: number[] = [];
  const M = 96;
  const s2 = SIGMA * SIGMA;
  for (let k = 0; k <= n; k++) {
    const rad = (reach * k) / n;
    let sum = 0;
    for (let j = 0; j < M; j++) {
      const rho = ((j + 0.5) / M) * R0;
      sum += (1 - rho / R0) * (rho / s2) * Math.exp(-((rad - rho) ** 2) / (2 * s2)) * i0e((rad * rho) / s2);
    }
    out.push(Math.min(1, sum * (R0 / M)));
  }
  return out;
}

/** Blob as CSS gradient stops, cut off where its contribution rounds to 0 in 8-bit (smaller quad to composite). */
export function blobGradient(size: number, r0Frac: number, [r, g, b]: number[], opacity: number) {
  const R0 = r0Frac * (size / 2) * Math.SQRT2;
  const full = R0 + 3 * SIGMA;
  const N = 40;
  const prof = profile(R0, full, N);
  let last = N;
  const cmax = Math.max(r, g, b);
  while (last > 1 && prof[last] * opacity * cmax < 0.5) last--;
  const reach = (full * last) / N;
  const pts = prof.slice(0, last + 1).map((a, k) => `rgba(${r},${g},${b},${a.toFixed(4)}) ${((full * k) / N).toFixed(1)}px`);
  pts.push(`rgba(${r},${g},${b},0) ${reach.toFixed(1)}px`);
  return { css: `radial-gradient(circle, ${pts.join(',')})`, pad: reach - size / 2 };
}
