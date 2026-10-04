import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Fixed, multi-layer parallax backdrop. Every layer moves via transform only
 * (scroll depth + pointer offset), so it stays on the compositor/GPU.
 */
export default function Aurora() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 18, mass: 0.8 });
  const sy = useSpring(my, { stiffness: 40, damping: 18, mass: 0.8 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduce, mx, my]);

  // Depth: farther layers move less on scroll and pointer.
  const y1 = useTransform(scrollY, [0, 3000], [0, -120]);
  const y2 = useTransform(scrollY, [0, 3000], [0, -320]);
  const y3 = useTransform(scrollY, [0, 3000], [0, -620]);
  const x1 = useTransform(sx, [-0.5, 0.5], [-14, 14]);
  const x2 = useTransform(sx, [-0.5, 0.5], [-40, 40]);
  const x3 = useTransform(sx, [-0.5, 0.5], [-80, 80]);
  const gy = useTransform(scrollY, [0, 3000], [0, -200]);

  const still = reduce ? { x: 0, y: 0 } : undefined;
  return (
    <div className="aurora" aria-hidden>
      <motion.div className="layer" style={still ?? { x: x1, y: y1 }}>
        <div className="blob b1" />
        <div className="blob b2" />
      </motion.div>
      <motion.div className="layer" style={still ?? { x: x2, y: y2 }}>
        <div className="blob b3" />
        <div className="blob b4" />
      </motion.div>
      <motion.div className="grid" style={still ?? { y: gy }} />
      <motion.div className="layer" style={still ?? { x: x3, y: y3 }}>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="mote" style={{ left: `${(i * 73) % 100}%`, top: `${(i * 41) % 130}%`, animationDelay: `${(i % 7) * -1.3}s`, scale: String(0.5 + (i % 4) * 0.35) }} />
        ))}
      </motion.div>
      <div className="noise" />
      <div className="vignette" />
    </div>
  );
}
