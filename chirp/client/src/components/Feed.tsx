import { useEffect, useRef } from 'react';
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import type { Page } from '../api/client';
import PostCard from './PostCard';

export default function Feed({ q, empty }: { q: UseInfiniteQueryResult<InfiniteData<Page>>; empty: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (q.isLoading) return <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton glass" />)}</div>;
  if (q.error) return <p className="error center">{(q.error as Error).message}</p>;
  const posts = q.data?.pages.flatMap((p) => p.posts) ?? [];
  if (!posts.length) return <p className="muted center pad">{empty}</p>;
  return (
    <div className="stack">
      {posts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
      <div ref={sentinel} style={{ height: 1 }} />
      {isFetchingNextPage && <div className="skeleton glass" />}
    </div>
  );
}
