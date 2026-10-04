import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { m as motion, useScroll, useTransform } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Avatar from '../components/Avatar';
import Feed from '../components/Feed';
import { useAuth } from '../hooks/useAuth';

export default function ProfilePage() {
  const { username = '' } = useParams();
  const { user: me, setUser } = useAuth();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['profile', username], queryFn: () => api.user(username) });
  const posts = useInfiniteQuery({
    queryKey: ['userPosts', username],
    queryFn: ({ pageParam }) => api.userPosts(username, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const { scrollY } = useScroll();
  const bannerY = useTransform(scrollY, [0, 400], [0, 120]);
  const bannerScale = useTransform(scrollY, [0, 400], [1.1, 1.3]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', bio: '' });
  const save = useMutation({
    mutationFn: () => api.updateProfile(draft),
    onSuccess: ({ user }) => { setEditing(false); setUser(user); qc.invalidateQueries({ queryKey: ['profile'] }); qc.invalidateQueries(); },
  });

  if (error) return <p className="error center pad">{(error as Error).message}</p>;
  const u = data?.user;
  if (!u) return <div className="skeleton glass" />;
  const mine = me?.id === u.id;
  return (
    <>
      <header className="topbar glass"><Link to="/" className="back">←</Link><h2>{u.displayName}</h2></header>
      <section className="profile glass">
        <div className="banner">
          <motion.div className="banner-art" style={{ y: bannerY, scale: bannerScale }} />
        </div>
        <div className="profile-body">
          <div className="profile-avatar"><Avatar user={u} size={96} /></div>
          {mine && !editing && <button className="btn ghost edit" onClick={() => { setDraft({ displayName: u.displayName, bio: u.bio }); setEditing(true); }}>Edit profile</button>}
          {editing ? (
            <div className="edit-form">
              <input value={draft.displayName} maxLength={50} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
              <textarea value={draft.bio} maxLength={160} rows={3} placeholder="Bio" onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
              <div className="row">
                <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn primary" disabled={!draft.displayName.trim() || save.isPending} onClick={() => save.mutate()}>Save</button>
              </div>
            </div>
          ) : (
            <>
              <h1>{u.displayName}</h1>
              <p className="muted">@{u.username}</p>
              {u.bio && <p className="bio">{u.bio}</p>}
              <p className="muted small">Joined {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
            </>
          )}
        </div>
      </section>
      <Feed q={posts} empty="No posts yet." />
    </>
  );
}
