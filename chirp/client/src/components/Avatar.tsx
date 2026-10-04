import type { User } from '../api/client';

const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export default function Avatar({ user, size = 44 }: { user: Pick<User, 'username' | 'displayName' | 'avatarUrl'>; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (user.avatarUrl) return <img className="avatar" style={style} src={user.avatarUrl} alt="" loading="lazy" />;
  const h = hue(user.username);
  return (
    <div className="avatar" style={{ ...style, background: `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 60) % 360} 80% 55%))` }}>
      {user.displayName.slice(0, 1).toUpperCase()}
    </div>
  );
}
