import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import PublicSite, { AuthPage } from './components/PublicSite';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return <div className="app-loading">Loading Campus Security...</div>;

  return (
    <Routes>
      <Route path="/" element={<PublicSite user={user} onLogout={handleLogout} />} />
      <Route path="/about" element={<PublicSite user={user} onLogout={handleLogout} page="about" />} />
      <Route path="/features" element={<PublicSite user={user} onLogout={handleLogout} page="features" />} />
      <Route path="/contact" element={<PublicSite user={user} onLogout={handleLogout} page="contact" />} />
      <Route path="/login" element={<AuthPage mode="login" onLogin={setUser} />} />
      <Route path="/register" element={<AuthPage mode="register" onLogin={setUser} />} />
      <Route
        path="/dashboard"
        element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
