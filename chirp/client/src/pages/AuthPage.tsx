import { useRef, useState, type FormEvent } from 'react';
import { m as motion, useScroll, useTransform } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Tilt from '../components/Tilt';

export default function AuthPage() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [f, setF] = useState({ username: '', displayName: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -120]);
  const heroO = useTransform(scrollY, [0, 400], [1, 0.2]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const { user } = mode === 'login' ? await api.login({ username: f.username, password: f.password }) : await api.register(f);
      setUser(user);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <motion.div ref={ref} className="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="hero" style={{ y: heroY, opacity: heroO }}>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          Say it <span className="grad">brilliantly.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}>
          Short thoughts, big conversations. Join Chirp and join the flow.
        </motion.p>
      </motion.section>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
        <Tilt max={5} className="auth glass">
          <div className="tabs">
            {(['register', 'login'] as const).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setErr(''); }} type="button">
                {m === 'register' ? 'Sign up' : 'Log in'}
                {mode === m && <motion.i layoutId="tab" className="tab-ind" />}
              </button>
            ))}
          </div>
          <form onSubmit={submit}>
            <input placeholder="Username" value={f.username} onChange={set('username')} autoComplete="username" required />
            {mode === 'register' && <input placeholder="Display name" value={f.displayName} onChange={set('displayName')} required />}
            <input placeholder="Password (8+ characters)" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : 1} />
            {err && <p className="error">{err}</p>}
            <motion.button whileTap={{ scale: 0.97 }} className="btn primary wide" disabled={busy}>{busy ? '…' : mode === 'register' ? 'Create account' : 'Log in'}</motion.button>
          </form>
        </Tilt>
      </motion.div>
    </motion.div>
  );
}
