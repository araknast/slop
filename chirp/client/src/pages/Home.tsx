import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import Composer from '../components/Composer';
import Feed from '../components/Feed';

export default function Home() {
  const q = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => api.feed(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  return (
    <>
      <header className="topbar glass"><h2>Home</h2></header>
      <Composer />
      <Feed q={q} empty="Nothing here yet. Be the first to post!" />
    </>
  );
}
