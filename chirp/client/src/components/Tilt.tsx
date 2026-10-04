import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import type { ReactNode, PointerEvent } from 'react';

/** 3D pointer tilt with a moving specular highlight. transform/opacity only. */
export default function Tilt({ children, max = 6, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });
  const hx = useMotionValue(50);
  const hy = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(420px circle at ${hx}% ${hy}%, rgba(255,255,255,0.09), transparent 60%)`;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * max * 2);
    rx.set((0.5 - py) * max * 2);
    hx.set(px * 100);
    hy.set(py * 100);
  };
  const leave = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div className={`tilt ${className}`} style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }} onPointerMove={move} onPointerLeave={leave}>
      {children}
      <motion.div className="tilt-glow" style={{ background: glow }} />
    </motion.div>
  );
}
