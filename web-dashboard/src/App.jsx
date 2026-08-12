import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;

  if (user) {
    return <Dashboard user={user} onLogout={() => {
      localStorage.clear();
      setUser(null);
    }} />;
  }

  return <Login onLogin={setUser} />;
}

export default App;
