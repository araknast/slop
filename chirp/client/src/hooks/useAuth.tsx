import { createContext, useContext, type ReactNode } from 'react';
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
  const setUser = (u: User | null) => {
    qc.setQueryData(['me'], u);
    qc.invalidateQueries({ queryKey: ['feed'] });
  };
  return <Ctx.Provider value={{ user: data ?? null, loading: isLoading, setUser }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
