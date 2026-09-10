import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ForgotPasswordScreen, LoginScreen, ResetPasswordScreen } from './components/AuthScreens';
import Dashboard from './components/Dashboard';
import PublicSite, { AuthPage } from './components/PublicSite';
import api from './services/api';

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
        setLoading(false);
        return;
      }

      try {
        setUser(JSON.parse(savedUser));
        const response = await api.get('/users/profile');
        if (!cancelled) {
          setUser(response.data.data);
          localStorage.setItem('user', JSON.stringify(response.data.data));
        }
      } catch (error) {
        if (error.response?.status !== 401 && !cancelled) setLoading(false);
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
        element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
      <Route path="/incidents/active" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/incidents/history" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/incidents/:incidentId" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/map" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/sos" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/emergency" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/evidence" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/officers" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/users" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/analytics" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/responses" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/alerts" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/announcements" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="/zones" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
