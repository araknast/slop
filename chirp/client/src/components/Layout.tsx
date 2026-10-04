import { motion } from 'framer-motion';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Avatar from './Avatar';

export default function Layout() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const logout = async () => { await api.logout(); setUser(null); nav('/'); };
  return (
    <div className="shell">
      <aside className="rail glass">
        <div className="brand"><span className="brand-dot" />Chirp</div>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to={`/u/${user.username}`}>Profile</NavLink>
        </nav>
        <div className="rail-user">
          <Avatar user={user} size={38} />
          <div className="rail-user-text">
            <b>{user.displayName}</b>
            <span>@{user.username}</span>
          </div>
        </div>
        <button className="btn ghost" onClick={logout}>Log out</button>
      </aside>
      <motion.main className="column" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <Outlet />
      </motion.main>
    </div>
  );
}
