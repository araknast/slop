import { useEffect, useLayoutEffect, useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import type { Page } from '../api/client';
import PostCard from './PostCard';

/**
 * Windowed feed: only the cards near the viewport are mounted, so the DOM and the number of composited
 * layers stay constant however far you scroll. Cards stay in normal flow (flex gap, with spacers above and
 * below) so their positions are exactly the un-windowed layout.
 */
export default function Feed({ q, empty }: { q: UseInfiniteQueryResult<InfiniteData<Page>>; empty: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const known = useRef(new Set<number>()); // posts that have already arrived; only newly arrived, mounted cards animate in
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = q.data?.pages.flatMap((p) => p.posts) ?? [];
  const v = useWindowVirtualizer({
    count: posts.length,
    estimateSize: () => 130, // typical card height; real heights replace it as cards are measured
    gap: 14,
    overscan: 5,
    scrollMargin: list.current ? list.current.getBoundingClientRect().top + window.scrollY : 0,
  });
  const fresh = known.current;
  const isNew = posts.map((p) => !fresh.has(p.id));
  useLayoutEffect(() => { posts.forEach((p) => fresh.add(p.id)); });

  if (q.isLoading) return <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton glass" />)}</div>;
  if (q.error) return <p className="error center">{(q.error as Error).message}</p>;
  if (!posts.length) return <p className="muted center pad">{empty}</p>;
  const items = v.getVirtualItems();
  const top = items.length ? items[0].start - v.options.scrollMargin : 0;
  const bottom = items.length ? v.getTotalSize() - items[items.length - 1].end : 0;
  return (
    <div className="stack">
      <div ref={list} className="stack" style={{ paddingTop: top, paddingBottom: bottom }}>
        {items.map((it) => (
          <div key={posts[it.index].id} data-index={it.index} ref={v.measureElement}>
            <PostCard post={posts[it.index]} index={it.index} animate={isNew[it.index]} />
          </div>
        ))}
      </div>
      <div ref={sentinel} style={{ height: 1 }} />
      {isFetchingNextPage && <div className="skeleton glass" />}
    </div>
  );
}
