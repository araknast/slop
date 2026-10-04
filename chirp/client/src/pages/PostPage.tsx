import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Composer from '../components/Composer';
import PostCard from '../components/PostCard';

export default function PostPage() {
  const id = Number(useParams().id);
  const { data, isLoading, error } = useQuery({ queryKey: ['post', id], queryFn: () => api.post(id) });
  return (
    <>
      <header className="topbar glass"><Link to="/" className="back">←</Link><h2>Post</h2></header>
      {isLoading && <div className="skeleton glass" />}
      {error && <p className="error center">{(error as Error).message}</p>}
      {data && (
        <div className="stack">
          <PostCard post={data.post} detail />
          <Composer parentId={id} placeholder="Post your reply" />
          {data.replies.map((r, i) => <PostCard key={r.id} post={r} index={i} />)}
        </div>
      )}
    </>
  );
}
