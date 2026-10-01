import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../services/api';
import { translateDashboardText, useLanguage } from '../utils/language';

const oauthExchangeRequests = new Map();

const clearOAuthCallbackUrl = () => {
  try {
    window.history.replaceState({}, '', window.location.pathname + (window.location.hash || ''));
  } catch {
    // Ignore unsupported history replacement in non-browser test runners.
  }
};

const AuthShell = ({ eyebrow, title, children }) => {
  const [language] = useLanguage();
  const t = (text) => translateDashboardText(text, language);
  return (
    <div className="auth-page" lang={language}>
      <div className="auth-aside">
        <Link to="/" className="brand">Campus<span>Secure</span></Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{t('Secure access for authorized campus members.')}</p>
        </div>
      </div>
      <div className="auth-content">
        <Link className="back-home" to="/">{t('Back to CampusSecure')}</Link>
        <div className="auth-form-wrap">{children}</div>
      </div>
    </div>
  );
};

const PasswordInput = ({ label, value, onChange, name = 'password', autoComplete, minLength }) => {
  const [visible, setVisible] = useState(false);
  const [language] = useLanguage();
  const t = (text) => translateDashboardText(text, language);

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
          aria-label={t(visible ? 'Hide password' : 'Show password')}
          title={t(visible ? 'Hide password' : 'Show password')}
        >
          {visible ? <VisibilityOff size={18} /> : <Visibility size={18} />}
        </button>
      </span>
    </label>
  );
};

export function OAuthButtons({
  continueLabel = 'Continue with Google',
  connectingLabel = 'Connecting...',
  dividerLabel = 'OR',
  className = ''
}) {
  const [loadingProvider, setLoadingProvider] = useState('');
  const [error, setError] = useState('');

  const beginOAuth = async (provider) => {
    setLoadingProvider(provider);
    setError('');
    const baseUrl = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
    try {
      await api.get(`/auth/oauth/${provider}/status`);
      window.location.assign(`${baseUrl}/auth/oauth/${provider}/start`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `${provider[0].toUpperCase()}${provider.slice(1)} sign-in is not configured.`);
      setLoadingProvider('');
    }
  };

  return (
    <div className={`oauth-options ${className}`.trim()}>
      <div className="oauth-divider"><span>{dividerLabel}</span></div>
      <button type="button" className="button oauth-button" aria-label={continueLabel} disabled={Boolean(loadingProvider)} onClick={() => beginOAuth('google')}>
        {loadingProvider === 'google' ? connectingLabel : (
          <>
            <span className="oauth-icon" aria-hidden="true">
              {/* Google "G" mark as inline SVG */}
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.26 1.53 8.14 2.82l6.01-6.01C35.99 3.08 30.38 1 24 1 14.73 1 6.92 6.73 3.41 14.91l7.3 5.66C12.98 14.2 17.9 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.5 24c0-1.6-.14-2.78-.44-4.01H24v7.58h12.9c-.56 3.02-2.26 5.6-4.86 7.32l7.41 5.77C44.86 36.54 46.5 30.71 46.5 24z"/>
                <path fill="#4A90E2" d="M10.71 29.57A14.99 14.99 0 0 1 9.5 24c0-1.56.25-3.06.71-4.47L3 13.87A23.99 23.99 0 0 0 1 24c0 3.85.92 7.49 2.56 10.78l7.15-5.21z"/>
                <path fill="#FBBC05" d="M24 46.5c6.38 0 11.99-2.08 16.15-5.64l-7.41-5.77C30.26 36.6 27.54 38 24 38c-6.1 0-11.02-4.7-13.29-11.3l-7.3 5.66C6.92 41.77 14.73 46.5 24 46.5z"/>
              </svg>
            </span>
            <span>{continueLabel}</span>
          </>
        )}
      </button>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}

export function LoginScreen({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [language] = useLanguage();
  const t = (text) => translateDashboardText(text, language);
  const [form, setForm] = useState({ email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Show a transient success message passed via navigation state (e.g., after reset password)
    const passed = location.state?.message;
    if (typeof passed === 'string' && passed.trim()) {
      setSuccessMessage(passed);
      const t = setTimeout(() => setSuccessMessage(''), 5000); // auto-dismiss after 5s
      return () => clearTimeout(t);
    }
    return undefined;
  }, [location.state]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
    // Send only the required credentials to the existing login API to avoid
    // changing backend behavior if phone number is not supported server-side.
    const payload = { email: form.email, password: form.password };
    const response = await api.post('/auth/login', payload);
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
    <AuthShell eyebrow={t('Welcome back')} title={language === 'am' ? <>የግቢዎን ደህንነት<br /><em>ይቆጣጠሩ።</em></> : <>Keep your campus<br /><em>within reach.</em></>}>
      <p className="eyebrow">{t('Secure sign in')}</p>
      <div className="login-logo-wrap">
        <span className="brand-mark"><img src="/images/logo.png" alt="CampusSecure logo" /></span>
      </div>
      <h2>{language === 'am' ? 'እንኳን ደህና መጡ።' : 'Welcome back.'}</h2>
      <p className="auth-description">{t('Use your campus account to continue.')}</p>
      {successMessage && (
        <div className="form-success" role="status" aria-live="polite">
          <span>{successMessage}</span>
          <button type="button" className="dismiss-success" onClick={() => setSuccessMessage('')} aria-label="Dismiss">×</button>
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <label>{t('Campus email')}<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
        <label>{t('Phone Number')}<input name="phone" type="tel" placeholder={t('Enter your phone number')} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <PasswordInput label={t('Password')} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" />
        <Link className="auth-help-link" to="/forgot-password">{t('Forgot Password?')}</Link>
        <button className="button button-primary auth-submit" disabled={loading}>{loading ? t('Please wait...') : t('Sign in to dashboard')}</button>
      </form>
      <OAuthButtons continueLabel={t('Continue with Google')} connectingLabel={t('Connecting...')} dividerLabel={t('OR')} />
      <p className="auth-switch">{t('New to CampusSecure?')} <Link to="/register">{t('Create an account')}</Link></p>
    </AuthShell>
  );
}

export function OAuthCallbackScreen({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const providerError = searchParams.get('error');
    if (providerError) {
      setError(providerError);
      return undefined;
    }

    const extractTicket = () => {
      const ticketFromQuery = searchParams.get('ticket');
      if (typeof ticketFromQuery === 'string' && ticketFromQuery.trim()) {
        return decodeURIComponent(ticketFromQuery);
      }

      const hash = window.location.hash || '';
      const match = hash.match(/[#&]?ticket=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }

      return '';
    };

    const ticket = extractTicket();
    if (!ticket) {
      setError('The provider sign-in response was incomplete. Please try again.');
      return undefined;
    }

    if (oauthExchangeRequests.has(ticket)) {
      return undefined;
    }

    const exchangeRequest = api.post('/auth/oauth/exchange', { ticket })
      .then((response) => {
        const { user, accessToken } = response.data.data;
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(user));
        onLogin(user);
        clearOAuthCallbackUrl();
        navigate('/dashboard', { replace: true });
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Unable to complete provider sign-in. Please try again.');
      })
      .finally(() => {
        oauthExchangeRequests.delete(ticket);
        if (window.location.search.includes('ticket=')) {
          clearOAuthCallbackUrl();
        }
      });

    oauthExchangeRequests.set(ticket, exchangeRequest);
    return undefined;
  }, [navigate, onLogin, searchParams]);

  return (
    <AuthShell eyebrow="Secure sign in" title={<>Connecting your<br /><em>campus account.</em></>}>
      <p className="eyebrow">Provider sign in</p>
      <h2>{error ? 'Sign-in could not be completed.' : 'Completing sign-in...'}</h2>
      {error && <div className="form-error" role="alert">{error}</div>}
      {error && <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>}
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
            // Redirect to the existing login page and pass a one-time success message via navigation state
            navigate('/login', { replace: true, state: { message: 'Password changed successfully. You can now log in.' } });
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
