import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './context/AuthContext';
import Loader from './components/Loader';
import Login from './pages/Login';
import Register from './pages/Register';
import Messenger from './pages/Messenger';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

function Guard({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loader full label="Проверяем вход" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loader full label="Проверяем вход" />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader full label="Проверяем доступ" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <Register />
          </GuestOnly>
        }
      />

      <Route
        path="/"
        element={
          <Guard>
            <Messenger />
          </Guard>
        }
      />
      {/* Открытый разговор в адресе: ссылку на чат можно оставить в закладке
          и вернуться сразу в него. */}
      <Route
        path="/chat/:conversationId"
        element={
          <Guard>
            <Messenger />
          </Guard>
        }
      />
      <Route
        path="/profile"
        element={
          <Guard>
            <Profile />
          </Guard>
        }
      />
      <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
