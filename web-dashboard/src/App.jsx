import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ActionConfirmation from './components/ActionConfirmation';
import { ForgotPasswordScreen, LoginScreen, OAuthCallbackScreen, ResetPasswordScreen } from './components/AuthScreens';
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

function SystemStatusMessage({ unavailable, onLogout }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fafd] p-6">
      <section className="dashboard-panel w-full max-w-xl border-slate-200/80 bg-white text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <p className="dashboard-eyebrow">System Management</p>
        <h1 className="mt-2 text-2xl font-black text-[#0b1f3a]">
          {unavailable ? 'System status unavailable' : 'System temporarily unavailable'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600" role="status">
          {unavailable
            ? 'We could not verify whether the campus security system is active. Please try again later.'
            : 'The campus security system has been deactivated for maintenance. Please check back later.'}
        </p>
        {onLogout && <button type="button" className="dashboard-button mt-5" onClick={onLogout}>Sign out</button>}
      </section>
    </main>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    const loadSystemStatus = async () => {
      try {
        const response = await api.get('/system/status');
        const active = response.data?.data?.active;
        if (typeof active !== 'boolean') throw new Error('System status response is invalid');
        if (!cancelled) setSystemStatus(active ? 'active' : 'deactivated');
      } catch {
        if (!cancelled) setSystemStatus('unavailable');
      }
    };

    loadSystemStatus();
    const refreshInterval = window.setInterval(loadSystemStatus, 15000);
    const handleSystemStatus = (event) => {
      setSystemStatus(event.detail?.active === false ? 'deactivated' : 'unavailable');
    };
    window.addEventListener('campus-security:system-status', handleSystemStatus);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener('campus-security:system-status', handleSystemStatus);
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
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
    const refreshToken = localStorage.getItem('refreshToken');
    api.post('/auth/logout', refreshToken ? { refreshToken } : {}).catch(() => undefined).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      if (location.pathname !== '/login') navigate('/login', { replace: true });
    });
  };

  if (loading) return <div className="app-loading">Loading Campus Security...</div>;
  const isAdmin = String(user?.role || '').trim().toLowerCase() === 'admin';
  if (user && !isAdmin && systemStatus === 'loading') return <div className="app-loading">Checking system availability...</div>;
  if (user && !isAdmin && systemStatus !== 'active') {
    return <SystemStatusMessage unavailable={systemStatus === 'unavailable'} onLogout={handleLogout} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicSite user={user} onLogout={handleLogout} />} />
        <Route path="/about" element={<PublicSite user={user} onLogout={handleLogout} page="about" />} />
        <Route path="/features" element={<PublicSite user={user} onLogout={handleLogout} page="features" />} />
        <Route path="/contact" element={<PublicSite user={user} onLogout={handleLogout} page="contact" />} />
        <Route path="/login" element={<LoginScreen onLogin={setUser} />} />
        <Route path="/register" element={<AuthPage mode="register" onLogin={setUser} />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/oauth/callback" element={<OAuthCallbackScreen onLogin={setUser} />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>}
        />
        <Route path="/settings" element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>} />
        {['/incidents/active', '/incidents/history', '/incidents/:incidentId', '/map', '/sos', '/emergency', '/evidence', '/officers', '/analytics', '/responses', '/alerts', '/zones', '/ml', '/announcements'].map((path) => (
          <Route key={path} path={path} element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>} />
        ))}
        <Route path="/notifications" element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>} />
        <Route path="/sms" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        <Route path="/locations" element={<ProtectedRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></ProtectedRoute>} />
        {['/users', '/audit-logs', '/content'].map((path) => (
          <Route key={path} path={path} element={<AdminRoute user={user}><Dashboard user={user} onLogout={handleLogout} onUserUpdated={(updatedUser) => { setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); }} /></AdminRoute>} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ActionConfirmation />
    </>
  );
}

export default App;
