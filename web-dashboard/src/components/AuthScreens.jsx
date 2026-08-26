import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './public.css';

const AuthShell = ({ eyebrow, title, children }) => (
  <div className="auth-page">
    <div className="auth-aside">
      <Link to="/" className="brand">Campus<span>Secure</span></Link>
      <div className="auth-aside-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>Secure access for authorized campus members.</p>
      </div>
    </div>
    <div className="auth-content">
      <Link className="back-home" to="/">Back to CampusSecure</Link>
      <div className="auth-form-wrap">{children}</div>
    </div>
  </div>
);

const PasswordInput = ({ label, value, onChange, name = 'password', autoComplete, minLength }) => {
  const [visible, setVisible] = useState(false);

  return (
    <label className="password-field">
      {label}
      <span className="password-input-wrap">
        <input
          name={name}
          required
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={minLength}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <VisibilityOff size={18} /> : <Visibility size={18} />}
        </button>
      </span>
    </label>
  );
};

export function LoginScreen({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', form);
      const { user, accessToken } = response.data.data;
      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Welcome back" title={<>Keep your campus<br /><em>within reach.</em></>}>
      <p className="eyebrow">Secure sign in</p>
      <h2>Welcome back.</h2>
      <p className="auth-description">Use your campus account to continue.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <label>Campus email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
        <PasswordInput label="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" />
        <Link className="auth-help-link" to="/forgot-password">Forgot Password?</Link>
        <button className="button button-primary auth-submit" disabled={loading}>{loading ? 'Please wait...' : 'Sign in to dashboard'}</button>
      </form>
      <p className="auth-switch">New to CampusSecure? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to process the request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Account recovery" title={<>A secure way<br /><em>back in.</em></>}>
      <p className="eyebrow">Forgot password</p>
      <h2>Reset your password.</h2>
      <p className="auth-description">Enter your account email. If it exists, we will send reset instructions.</p>
      {message && <div className="form-success" role="status">{message}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <label>Campus email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <button className="button button-primary auth-submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset instructions'}</button>
      </form>
      <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: searchParams.get('token'), password });
      navigate('/login', { replace: true, state: { message: 'Password reset successful. Please sign in.' } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'This reset link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Account recovery" title={<>Choose a new<br /><em>password.</em></>}>
      <p className="eyebrow">Set a new password</p>
      <h2>Create a new password.</h2>
      <p className="auth-description">Your reset link is single-use and expires after 15 minutes.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <PasswordInput label="New password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} />
        <PasswordInput label="Confirm new password" name="confirmPassword" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} />
        <button className="button button-primary auth-submit" disabled={loading}>{loading ? 'Updating...' : 'Update password'}</button>
      </form>
    </AuthShell>
  );
}
