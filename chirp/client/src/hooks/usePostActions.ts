import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api, type Post } from '../api/client';

/** Walk every cached query shape (infinite pages, single post, reply lists) and patch matching posts. */
function patchAll(qc: ReturnType<typeof useQueryClient>, id: number, fn: (p: Post) => Post) {
  const patch = (p: Post): Post => {
    let out = p;
    if (p.id === id) out = fn(out);
    if (p.repostOf?.id === id) out = { ...out, ...mirror(fn(p.repostOf), p), repostOf: fn(p.repostOf) };
    return out;
  };
  const mirror = (orig: Post, p: Post) => ({ likedByMe: orig.likedByMe, repostedByMe: orig.repostedByMe, id: p.id });
  qc.setQueriesData({ queryKey: ['feed'] }, (d: any) => d && { ...d, pages: d.pages.map((pg: any) => ({ ...pg, posts: pg.posts.map(patch) })) });
  qc.setQueriesData({ queryKey: ['userPosts'] }, (d: any) => d && { ...d, pages: d.pages.map((pg: any) => ({ ...pg, posts: pg.posts.map(patch) })) });
  qc.setQueriesData({ queryKey: ['post'] }, (d: any) => d && { post: patch(d.post), replies: d.replies.map(patch) });
}

export function usePostActions(post: Post) {
  const qc = useQueryClient();
  const target = post.repostOf ?? post;
  const snapshot = (): [QueryKey, unknown][] => qc.getQueriesData({});
  const rollback = (s: [QueryKey, unknown][]) => s.forEach(([k, v]) => qc.setQueryData(k, v));

  const like = useMutation({
    mutationFn: (on: boolean) => api.like(target.id, on),
    onMutate: (on) => {
      const s = snapshot();
      patchAll(qc, target.id, (p) => ({ ...p, likedByMe: on, likeCount: Math.max(0, p.likeCount + (on ? 1 : -1)) }));
      return s;
    },
    onError: (_e, _v, s) => s && rollback(s),
  });
  const repost = useMutation({
    mutationFn: (on: boolean) => api.repost(target.id, on),
    onMutate: (on) => {
      const s = snapshot();
      patchAll(qc, target.id, (p) => ({ ...p, repostedByMe: on, repostCount: Math.max(0, p.repostCount + (on ? 1 : -1)) }));
      return s;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['feed'] }); qc.invalidateQueries({ queryKey: ['userPosts'] }); },
    onError: (_e, _v, s) => s && rollback(s),
  });
  const remove = useMutation({
    mutationFn: () => api.remove(post.id),
    onSuccess: () => qc.invalidateQueries(),
  });
  return { target, like, repost, remove };
}
