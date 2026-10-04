import { useEffect, useRef } from 'react';
import type { ReactNode, PointerEvent } from 'react';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 3D pointer tilt with a moving specular highlight. transform/opacity only.
 * Plain DOM + one rAF loop that exists only while the pointer is over the card
 * (spring: stiffness 220, damping 20), so idle cards cost nothing: no motion
 * values, no layers, no JS.
 */
export default function Tilt({ children, max = 6, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLElement>(null);
  const s = useRef({ rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0, cx: 0, cy: 0, hover: false, raf: 0, last: 0 });

  const tick = (now: number) => {
    const st = s.current;
    st.raf = 0;
    const node = el.current;
    if (!node) return;
    const dt = Math.min(0.05, (now - (st.last || now)) / 1000);
    st.last = now;
    if (st.hover) {
      const r = node.getBoundingClientRect();
      const px = (st.cx - r.left) / r.width;
      const py = (st.cy - r.top) / r.height;
      st.ty = (px - 0.5) * max * 2;
      st.tx = (0.5 - py) * max * 2;
      dot.current!.style.transform = `translate3d(${st.cx - r.left}px,${st.cy - r.top}px,0)`;
    }
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      st.vx += (-220 * (st.rx - st.tx) - 20 * st.vx) * h;
      st.vy += (-220 * (st.ry - st.ty) - 20 * st.vy) * h;
      st.rx += st.vx * h;
      st.ry += st.vy * h;
    }
    const still = !st.hover && Math.abs(st.rx) < 0.01 && Math.abs(st.ry) < 0.01 && Math.abs(st.vx) < 0.01 && Math.abs(st.vy) < 0.01;
    if (still) {
      st.rx = st.ry = st.vx = st.vy = 0;
      node.style.transform = '';
      node.classList.remove('live');
      st.last = 0;
      return;
    }
    node.style.transform = `perspective(900px) rotateX(${st.rx}deg) rotateY(${st.ry}deg)`;
    st.raf = requestAnimationFrame(tick);
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced() || e.pointerType === 'touch') return;
    const st = s.current;
    st.hover = true;
    st.cx = e.clientX;
    st.cy = e.clientY;
    if (max === 0) { dot.current!.style.transform = `translate3d(${e.clientX - e.currentTarget.getBoundingClientRect().left}px,${e.clientY - e.currentTarget.getBoundingClientRect().top}px,0)`; return; }
    el.current!.classList.add('live');
    if (!st.raf) st.raf = requestAnimationFrame(tick);
  };
  const leave = () => {
    const st = s.current;
    st.hover = false;
    st.tx = st.ty = 0;
    if (max !== 0 && !st.raf && el.current?.classList.contains('live')) st.raf = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(s.current.raf), []);

  return (
    <div ref={el} className={`tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>
      {children}
      <div className="tilt-glow"><i ref={dot} /></div>
    </div>
  );
}
