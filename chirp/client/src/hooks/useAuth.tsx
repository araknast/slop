import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type User } from '../api/client';

interface AuthCtx { user: User | null; loading: boolean; setUser: (u: User | null) => void }
const Ctx = createContext<AuthCtx>({ user: null, loading: true, setUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try { return (await api.me()).user; }
      catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
    },
    staleTime: Infinity,
    retry: false,
  });
  const setUser = useCallback((u: User | null) => {
    qc.setQueryData(['me'], u);
    qc.invalidateQueries({ queryKey: ['feed'] });
  }, [qc]);
  const value = useMemo(() => ({ user: data ?? null, loading: isLoading, setUser }), [data, isLoading, setUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
