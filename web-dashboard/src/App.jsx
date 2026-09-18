import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ForgotPasswordScreen, LoginScreen, ResetPasswordScreen } from './components/AuthScreens';
import Dashboard from './components/Dashboard';
import PublicSite, { AuthPage } from './components/PublicSite';
import api from './services/api';

function ProtectedRoute({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      if (location.pathname !== '/login') navigate('/login', { replace: true });
    };

    window.addEventListener('campus-security:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('campus-security:unauthorized', handleUnauthorized);
  }, [location.pathname, navigate]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    let cancelled = false;

    const restoreSession = async () => {
      if (!token || !savedUser) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const response = await api.get('/users/profile');
        if (!cancelled) {
          setUser(response.data.data);
          localStorage.setItem('user', JSON.stringify(response.data.data));
        }
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (!cancelled) setUser(null);
        } else if (!cancelled) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    if (location.pathname !== '/login') navigate('/login', { replace: true });
  };

  if (loading) return <div className="app-loading">Loading Campus Security...</div>;

  return (
    <Routes>
      <Route path="/" element={<PublicSite user={user} onLogout={handleLogout} />} />
      <Route path="/about" element={<PublicSite user={user} onLogout={handleLogout} page="about" />} />
      <Route path="/features" element={<PublicSite user={user} onLogout={handleLogout} page="features" />} />
      <Route path="/contact" element={<PublicSite user={user} onLogout={handleLogout} page="contact" />} />
      <Route path="/login" element={<LoginScreen onLogin={setUser} />} />
      <Route path="/register" element={<AuthPage mode="register" onLogin={setUser} />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      <Route
        path="/dashboard"
        element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>}
      />
      <Route path="/profile" element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>} />
      {['/incidents/active', '/incidents/history', '/incidents/:incidentId', '/map', '/sos', '/emergency', '/evidence', '/officers', '/analytics', '/responses', '/alerts', '/zones'].map((path) => (
        <Route key={path} path={path} element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>} />
      ))}
      {['/users', '/announcements', '/sms', '/locations', '/notifications', '/audit-logs', '/content', '/settings'].map((path) => (
        <Route key={path} path={path} element={<AdminRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></AdminRoute>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
