import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Aurora from './components/Aurora';
import Layout from './components/Layout';
import { useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import Home from './pages/Home';
import PostPage from './pages/PostPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <><Aurora /><div className="boot"><div className="boot-orb" /></div></>;
  return (
    <>
      <Aurora />
        <Routes location={location}>
          {user ? (
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="post/:id" element={<PostPage />} />
              <Route path="u/:username" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          ) : (
            <>
              <Route path="/" element={<AuthPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
    </>
  );
}
