// src/components/Login.jsx - Clean version with NO inline CSS
import React, { useState } from 'react';
import api from '../services/api';

function Login({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken } = response.data.data;
      
      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.backgroundImage}>
        <div style={styles.overlay}></div>
        <div style={styles.overlayGradient}></div>
        
        <div style={styles.floatingShape1}></div>
        <div style={styles.floatingShape2}></div>
        <div style={styles.floatingShape3}></div>
        
        <div style={styles.heroContent}>
          <div style={styles.heroIcon}>🏛️</div>
          <h2 style={styles.heroTitle}>Safe Campus</h2>
          <p style={styles.heroSubtitle}>24/7 Security & Emergency Response</p>
          <div style={styles.heroStats}>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNumber}>24/7</span>
              <span style={styles.heroStatLabel}>Security</span>
            </div>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNumber}>100+</span>
              <span style={styles.heroStatLabel}>Incidents Resolved</span>
            </div>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNumber}>5min</span>
              <span style={styles.heroStatLabel}>Average Response</span>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.cardContainer}>
        <div style={styles.card}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>🛡️</div>
            <h1 style={styles.title}>Campus Security</h1>
          </div>
          
          <div style={styles.subtitleContainer}>
            <span style={styles.subtitle}>Emergency Response System</span>
            <span style={styles.badge}>🔴 LIVE</span>
          </div>
          
          {error && <div style={styles.error}>{error}</div>}
          
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>📧 Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>🔑 Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            
            <button
              type="submit"
              style={styles.button}
              disabled={loading}
            >
              {loading ? '⏳ Logging in...' : '🔐 Login to Dashboard'}
            </button>
          </form>
          
          <div style={styles.demoInfo}>
            <p style={styles.demoTitle}>🎯 Demo Credentials</p>
            <div style={styles.demoRow}>
              <span style={styles.demoLabel}>📧 Email:</span>
              <span style={styles.demoValue}>test@test.com</span>
            </div>
            <div style={styles.demoRow}>
              <span style={styles.demoLabel}>🔑 Password:</span>
              <span style={styles.demoValue}>Password123</span>
            </div>
          </div>
          
          <div style={styles.registerContainer}>
            <p style={styles.registerText}>Don't have an account?</p>
            <button onClick={onSwitchToRegister} style={styles.registerButton}>
              🚀 Register here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden'
  },
  backgroundImage: {
    flex: 1,
    backgroundImage: 'url("https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1920&q=80")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(15, 12, 41, 0.85) 0%, rgba(48, 43, 99, 0.75) 50%, rgba(36, 36, 62, 0.85) 100%)'
  },
  overlayGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(ellipse at 30% 50%, rgba(79, 195, 247, 0.15) 0%, transparent 70%)'
  },
  floatingShape1: {
    position: 'absolute',
    top: '10%',
    right: '15%',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(79, 195, 247, 0.1) 0%, transparent 70%)'
  },
  floatingShape2: {
    position: 'absolute',
    bottom: '20%',
    left: '10%',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255, 23, 68, 0.08) 0%, transparent 70%)'
  },
  floatingShape3: {
    position: 'absolute',
    top: '40%',
    left: '40%',
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(76, 175, 80, 0.06) 0%, transparent 70%)'
  },
  heroContent: {
    position: 'relative',
    zIndex: 2,
    color: 'white',
    textAlign: 'center',
    padding: '40px',
    maxWidth: '500px'
  },
  heroIcon: {
    fontSize: '72px',
    marginBottom: '20px',
    opacity: 0.9
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: '700',
    marginBottom: '12px',
    textShadow: '0 4px 20px rgba(0,0,0,0.3)'
  },
  heroSubtitle: {
    fontSize: '20px',
    opacity: 0.8,
    marginBottom: '30px',
    textShadow: '0 2px 10px rgba(0,0,0,0.2)'
  },
  heroStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
    marginTop: '20px'
  },
  heroStat: {
    textAlign: 'center'
  },
  heroStatNumber: {
    display: 'block',
    fontSize: '28px',
    fontWeight: '700',
    color: '#4FC3F7'
  },
  heroStatLabel: {
    fontSize: '14px',
    opacity: 0.7
  },
  cardContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    minWidth: '400px'
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    padding: '40px',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '5px'
  },
  logoIcon: {
    fontSize: '36px',
    background: 'linear-gradient(135deg, #2196F3, #00BCD4)',
    width: '60px',
    height: '60px',
    borderRadius: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 15px rgba(33, 150, 243, 0.3)'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #2196F3, #00BCD4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0
  },
  subtitleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '25px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500'
  },
  badge: {
    backgroundColor: '#FF1744',
    color: 'white',
    padding: '2px 10px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 'bold',
    letterSpacing: '0.5px'
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid #ffcdd2'
  },
  form: {
    display: 'flex',
    flexDirection: 'column'
  },
  inputGroup: {
    marginBottom: '18px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    color: '#333',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    fontSize: '15px',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    outline: 'none',
    backgroundColor: '#f8f9fa'
  },
  button: {
    backgroundColor: '#2196F3',
    color: 'white',
    padding: '16px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '5px',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(33, 150, 243, 0.3)'
  },
  demoInfo: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#e3f2fd',
    borderRadius: '10px',
    border: '1px solid #bbdefb'
  },
  demoTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: '8px'
  },
  demoRow: {
    display: 'flex',
    gap: '8px',
    fontSize: '13px',
    padding: '2px 0'
  },
  demoLabel: {
    color: '#666',
    fontWeight: '500'
  },
  demoValue: {
    color: '#1565C0',
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  registerContainer: {
    marginTop: '20px',
    textAlign: 'center',
    paddingTop: '18px',
    borderTop: '1px solid #e0e0e0'
  },
  registerText: {
    color: '#666',
    fontSize: '14px',
    marginBottom: '6px'
  },
  registerButton: {
    background: 'none',
    border: 'none',
    color: '#2196F3',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    textDecoration: 'underline',
    transition: 'color 0.3s ease'
  }
};

export default Login;
