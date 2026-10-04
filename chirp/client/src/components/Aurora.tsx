import { useEffect, useLayoutEffect, useRef } from 'react';
import { BLOBS, blobGradient } from './auroraMath';

/**
 * Fixed, multi-layer parallax backdrop, built to keep the compositor's work small and the main thread idle:
 *  - blobs are Gaussian-baked gradients (no blur filter), cut to their visible extent;
 *  - the masked grid is a pre-rendered canvas (no mask render surface);
 *  - film grain + vignette are ONE static black-alpha canvas. The old overlay-blended grain
 *    scaled dark pixels by f = 1 + .05·α(2s-1), so we darken by f/fmax and pre-scale the base by
 *    fmax instead: same result, normal blending, no isolated blend group;
 *  - drift, twinkle and scroll parallax are CSS animations (scroll-driven where supported): they run on
 *    the compositor with zero main-thread work. (Ticking them from JS at 15Hz was tried: it saves
 *    compositor frames but costs ~7ms of main thread per tick, a bad trade on a slow CPU.) JS only runs
 *    the pointer spring while the pointer moves, plus a scroll handler fallback for browsers without
 *    scroll timelines.
 */

const NOISE_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
const MOTES = 14;
const BG = [7, 7, 13];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasScrollTimeline = () => typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('animation-timeline: scroll()');

export default function Aurora() {
  const root = useRef<HTMLDivElement>(null);
  const fmaxRef = useRef(1); // base brightness pre-scale (see header); set once the grain tile has loaded

  // Static pieces that depend on the viewport: blob gradients, grid canvas, grain+vignette canvas.
  useLayoutEffect(() => {
    const el = root.current!;
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    let alive = true;
    let tile: { f: Float32Array; n: number; fmax: number } | null = null;

    const fit = () => {
      const W = innerWidth, H = innerHeight, vmax = Math.max(W, H) / 100;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const k = tile?.fmax ?? 1;
      fmaxRef.current = k;
      el.style.background = `rgb(${BG.map((c) => c * k).join(',')})`;
      el.style.setProperty('--k', String(k));
      BLOBS.forEach((b) => {
        const node = q(`.${b.cls}`);
        const size = b.size * vmax;
        const { css, pad } = blobGradient(size, b.r0, b.color.map((c) => c * k), b.opacity);
        const p = Math.max(0, Math.ceil(pad));
        node.style.background = css;
        node.style.margin = `-${p}px`;
        node.style.width = node.style.height = `${size + 2 * p}px`;
      });

      // grid: lines every 64px of the (1.2W x 1.4H) layer box, 4.5% white, masked by an ellipse
      const gc = q<HTMLCanvasElement>('.grid');
      const gh = H + 200; // parallax travels at most 200px
      gc.width = Math.round(W * dpr);
      gc.height = Math.round(gh * dpr);
      const g = gc.getContext('2d')!;
      g.scale(dpr, dpr);
      const lw = 1.2 * W, lh = 1.4 * H, ox = 0.1 * W, oy = 0.2 * H; // canvas origin in layer coords
      g.fillStyle = 'rgba(255,255,255,0.045)';
      for (let x = Math.ceil((ox - 64) / 64) * 64; x < ox + W; x += 64) g.fillRect(x - ox, 0, 1, gh);
      for (let y = Math.ceil((oy - 64) / 64) * 64; y < oy + gh; y += 64) g.fillRect(0, y - oy, W, 1);
      g.globalCompositeOperation = 'destination-in';
      g.translate(0.5 * lw - ox, 0.3 * lh - oy);
      g.scale(0.5 * lw * Math.SQRT2, 0.7 * lh * Math.SQRT2);
      const mask = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      mask.addColorStop(0.1, 'rgba(0,0,0,1)');
      mask.addColorStop(0.7, 'rgba(0,0,0,0)');
      g.fillStyle = mask;
      g.fillRect(-lw, -lh, 2 * lw, 2 * lh);

      // grain + vignette: black with alpha A = 1 - (1 - vignette)(grain factor / fmax)
      const oc = q<HTMLCanvasElement>('.shade');
      const w = Math.round(W * dpr), h = Math.round(H * dpr);
      oc.width = w; oc.height = h;
      const o = oc.getContext('2d')!;
      const img = o.createImageData(w, h);
      const d = img.data;
      const rx = (W / 2) * Math.SQRT2, ry = (H / 2) * Math.SQRT2;
      for (let y = 0; y < h; y++) {
        const dy = ((y + 0.5) / dpr - H / 2) / ry;
        for (let x = 0; x < w; x++) {
          const dx = ((x + 0.5) / dpr - W / 2) / rx;
          let keep = 1 - 0.55 * clamp01((Math.sqrt(dx * dx + dy * dy) - 0.4) / 0.6);
          if (tile) keep *= tile.f[(y % tile.n) * tile.n + (x % tile.n)] / tile.fmax;
          d[(y * w + x) * 4 + 3] = Math.round((1 - keep) * 255);
        }
      }
      o.putImageData(img, 0, 0);
    };

    // Grain tile: the same feTurbulence SVG the CSS used, rasterised at device resolution.
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const n = Math.round(160 * dpr);
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const cx = c.getContext('2d')!;
      cx.drawImage(img, 0, 0, n, n);
      const px = cx.getImageData(0, 0, n, n).data;
      const f = new Float32Array(n * n);
      let fmax = 0;
      for (let i = 0; i < n * n; i++) {
        const a = px[i * 4 + 3] / 255;
        // overlay on dark pixels: 1 + 5%·α·(2s-1), averaged over channels (un-premultiply first)
        const s = a > 0 ? (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3 / 255 / a : 0.5;
        f[i] = 1 + 0.05 * a * (2 * Math.min(1, s) - 1);
        if (f[i] > fmax) fmax = f[i];
      }
      tile = { f, n, fmax };
      fit();
    };
    img.src = NOISE_SVG;

    fit();
    let t = 0;
    const onResize = () => { clearTimeout(t); t = window.setTimeout(fit, 150); };
    addEventListener('resize', onResize);
    return () => { alive = false; removeEventListener('resize', onResize); clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (reducedMotion()) return;
    const el = root.current!;
    const l1 = el.querySelector<HTMLElement>('.l1')!;
    const l2 = el.querySelector<HTMLElement>('.l2')!;
    const grid = el.querySelector<HTMLElement>('.grid')!;
    const l3 = el.querySelector<HTMLElement>('.l3')!;

    // pointer spring (stiffness 40, damping 18, mass 0.8) -> `translate`, composed with the CSS scroll `transform`
    let target = 0, pos = 0, vel = 0, raf = 0, last = 0;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const steps = Math.max(1, Math.ceil(dt / 0.008));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) { vel += ((-40 * (pos - target) - 18 * vel) / 0.8) * h; pos += vel * h; }
      const moving = Math.abs(target - pos) > 1e-4 || Math.abs(vel) > 1e-4;
      if (!moving) { pos = target; vel = 0; }
      const x = pos * 2; // -1..1
      l1.style.translate = `${14 * x}px 0`;
      l2.style.translate = `${40 * x}px 0`;
      l3.style.translate = `${80 * x}px 0`;
      if (moving) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const onMove = (e: PointerEvent) => { target = e.clientX / innerWidth - 0.5; if (!raf) raf = requestAnimationFrame(frame); };
    addEventListener('pointermove', onMove, { passive: true });

    // Fallback parallax for browsers without CSS scroll-driven animations.
    let onScroll: (() => void) | undefined;
    if (!hasScrollTimeline()) {
      let pending = 0;
      const write = () => {
        pending = 0;
        const s = clamp01(scrollY / 3000);
        l1.style.transform = `translate3d(0,${-120 * s}px,0)`;
        l2.style.transform = `translate3d(0,${-320 * s}px,0)`;
        grid.style.transform = `translate3d(0,${-200 * s}px,0)`;
        l3.style.transform = `translate3d(0,${-620 * s}px,0)`;
      };
      onScroll = () => { if (!pending) pending = requestAnimationFrame(write); };
      addEventListener('scroll', onScroll, { passive: true });
      write();
    }
    return () => {
      removeEventListener('pointermove', onMove);
      if (onScroll) removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="aurora" aria-hidden ref={root}>
      <div className="layer l1">
        <div className="blob b1" />
        <div className="blob b2" />
      </div>
      <div className="layer l2">
        <div className="blob b3" />
        <div className="blob b4" />
      </div>
      <canvas className="grid" />
      <div className="layer l3">
        {Array.from({ length: MOTES }, (_, i) => (
          <span key={i} className="mote" style={{ left: `${(i * 73) % 100}%`, top: `${(i * 41) % 130}%`, animationDelay: `${(i % 7) * -1.3}s`, scale: String(0.5 + (i % 4) * 0.35) }} />
        ))}
      </div>
      <canvas className="shade" />
    </div>
  );
}
