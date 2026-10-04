import { AnimatePresence, m as motion } from 'framer-motion';
import { memo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Post } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { usePostActions } from '../hooks/usePostActions';
import Avatar from './Avatar';
import Tilt from './Tilt';

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const HEART = 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z';
const REPOST = 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3';
const REPLY = 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z';

/** `animate`: play the entrance animation. Read once at mount, so virtualised cards that remount while scrolling stay still. */
function PostCard({ post, index = 0, detail = false, animate = true }: { post: Post; index?: number; detail?: boolean; animate?: boolean }) {
  const rise = useRef(animate).current;
  const { user } = useAuth();
  const nav = useNavigate();
  const { target, like, repost, remove } = usePostActions(post);
  const liked = !!post.likedByMe;
  const reposted = !!post.repostedByMe;

  return (
    <article className={rise ? 'post-wrap rise' : 'post-wrap'} style={{ '--i': Math.min(index, 8) } as React.CSSProperties}>
      <Tilt max={detail ? 0 : 3} className="post glass">
        {post.repostOf && (
          <div className="repost-line"><Icon d={REPOST} /> <Link to={`/u/${post.author.username}`}>{post.author.displayName}</Link> reposted</div>
        )}
        <div className="post-body" onClick={() => nav(`/post/${target.id}`)}>
          <Link to={`/u/${target.author.username}`} onClick={(e) => e.stopPropagation()}><Avatar user={target.author} /></Link>
          <div className="post-main">
            <div className="post-head">
              <Link to={`/u/${target.author.username}`} onClick={(e) => e.stopPropagation()}><b>{target.author.displayName}</b></Link>
              <span className="muted">@{target.author.username} · {ago(target.createdAt)}</span>
              {user?.id === post.author.id && (
                <button className="icon-btn del" title="Delete" onClick={(e) => { e.stopPropagation(); remove.mutate(); }}>✕</button>
              )}
            </div>
            <p className={detail ? 'text big' : 'text'}>{target.body}</p>
            <div className="actions" onClick={(e) => e.stopPropagation()}>
              <button className="act" onClick={() => nav(`/post/${target.id}`)}><Icon d={REPLY} />{target.replyCount || ''}</button>
              <button className={`act green ${reposted ? 'on' : ''}`} disabled={!user} onClick={() => repost.mutate(!reposted)}><Icon d={REPOST} />{target.repostCount || ''}</button>
              <button className={`act pink ${liked ? 'on' : ''}`} disabled={!user} onClick={() => like.mutate(!liked)}>
                <motion.span key={String(liked)} initial={liked ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }} style={{ display: 'flex' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d={HEART} /></svg>
                </motion.span>
                {target.likeCount || ''}
                <AnimatePresence>
                  {liked && <motion.i className="burst" initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </Tilt>
    </article>
  );
}

export default memo(PostCard);
