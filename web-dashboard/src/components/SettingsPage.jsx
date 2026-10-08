import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTranslate } from '../utils/language';
import { defaultUserPreferences, getUserPreferences, setAppearanceTheme, saveUserPreferences, useAppearanceTheme } from '../utils/appearance';
import ProfilePage from './ProfilePage';
import { SystemSettingsPage } from './AdminPages';
import api from '../services/api';

const Section = ({ title, description, children }) => (
  <section className="dashboard-panel space-y-4 border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
    <div>
      <h3 className="text-lg font-black text-[#0b1f3a]">{title}</h3>
      {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
    </div>
    {children}
  </section>
);

const Preference = ({ label, description, checked, onChange, disabled = false }) => (
  <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
    <input className="mt-1 h-4 w-4 accent-sky-700" type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
    <span>
      <span className="block text-sm font-bold text-slate-800">{label}</span>
      {description && <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>}
    </span>
  </label>
);

const adminLinks = [
  ['System Management', '/settings'],
  ['User Management', '/users'],
  ['Security Officers', '/officers'],
  ['SMS Notifications', '/sms'],
  ['Notifications', '/notifications'],
  ['Reports & Analytics', '/analytics'],
  ['Content Management', '/content'],
  ['Audit Logs', '/audit-logs'],
  ['Campus Locations', '/locations'],
  ['Zone Management', '/zones'],
];

const roleSettings = {
  admin: {
    title: 'Administrator',
    description: 'Operational settings for keeping the dashboard current and easy to scan.',
    options: [
      ['autoRefreshSeconds', 'Dashboard refresh interval', [['off', 'Off'], ['30', 'Every 30 seconds'], ['60', 'Every minute'], ['300', 'Every 5 minutes']]],
      ['mapDefault', 'Default map style', [['standard', 'Standard'], ['satellite', 'Satellite']]],
      ['tableDensity', 'Table density', [['comfortable', 'Comfortable'], ['compact', 'Compact']]],
      ['textSize', 'Display text size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]],
    ],
    toggles: [
      ['confirmBeforeClear', 'Confirm before clearing history', 'Keep a confirmation step before permanent history deletion.'],
    ],
  },
  security: {
    title: 'Security Officer',
    description: 'Response-focused settings for incident awareness and campus operations.',
    options: [
      ['autoRefreshSeconds', 'Dashboard refresh interval', [['off', 'Off'], ['30', 'Every 30 seconds'], ['60', 'Every minute'], ['300', 'Every 5 minutes']]],
      ['mapDefault', 'Default map style', [['standard', 'Standard'], ['satellite', 'Satellite']]],
      ['officerAvailability', 'Preferred officer availability', [['all', 'All statuses'], ['available', 'Available'], ['responding', 'Responding'], ['busy', 'Busy']]],
      ['textSize', 'Display text size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]],
    ],
    toggles: [
      ['responseNotifications', 'Response notifications', 'Keep assignment and response updates enabled in your notification preferences.'],
    ],
  },
  student: {
    title: 'Student',
    description: 'Privacy and accessibility preferences for campus alerts.',
    options: [
      ['textSize', 'Display text size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]],
    ],
    toggles: [
      ['shareLocation', 'Share location by default', 'Location sharing is optional; incident reporting remains available when this is off.'],
      ['confirmSOS', 'Confirm before sending SOS', 'Show an additional confirmation before an SOS action.'],
    ],
  },
  faculty: {
    title: 'Faculty / Staff',
    description: 'Privacy and accessibility preferences for campus safety updates.',
    options: [
      ['textSize', 'Display text size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]],
    ],
    toggles: [
      ['shareLocation', 'Share location by default', 'Location sharing is optional; incident reporting remains available when this is off.'],
      ['confirmSOS', 'Confirm before sending SOS', 'Show an additional confirmation before an SOS action.'],
    ],
  },
  default: {
    title: 'Campus member',
    description: 'Notification and accessibility preferences for your account.',
    options: [
      ['textSize', 'Display text size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]],
    ],
    toggles: [],
  },
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

const formatSecurityDate = (value) => (value ? new Date(value).toLocaleString() : 'Unknown');

function SecuritySettings({ user, isAdmin, onUpdated, onLogout }) {
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user?.mfa_enabled));
  const [setupUrl, setSetupUrl] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await api.get('/security/sessions');
      setSessions(response.data?.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load active sessions.');
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    setMfaEnabled(Boolean(user?.mfa_enabled));
    loadSessions();
  }, [user?.user_id, user?.mfa_enabled]);

  const finish = (nextUser) => {
    onUpdated?.(nextUser);
    setError('');
    setBusy('');
  };

  const beginMfaSetup = async () => {
    setBusy('setup'); setError(''); setMessage('');
    try {
      const response = await api.post('/security/mfa/setup');
      setSetupUrl(response.data?.data?.otpauthUrl || '');
      setMessage('Scan the QR code with your authenticator app, then enter the six-digit code below.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to start MFA setup.');
    } finally { setBusy(''); }
  };

  const enableMfa = async (event) => {
    event.preventDefault();
    setBusy('enable'); setError(''); setMessage('');
    try {
      const response = await api.post('/security/mfa/enable', { code: mfaCode });
      setMfaEnabled(true);
      setRecoveryCodes(response.data?.data?.recoveryCodes || []);
      setSetupUrl(''); setMfaCode('');
      finish({ ...user, mfa_enabled: true });
      setMessage('MFA is enabled for this account.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to verify the MFA code.');
      setBusy('');
    }
  };

  const disableMfa = async () => {
    const code = window.prompt('Enter your current authenticator code to disable MFA.');
    if (code === null) return;
    setBusy('disable'); setError(''); setMessage('');
    try {
      await api.post('/security/mfa/disable', { code });
      setMfaEnabled(false); setRecoveryCodes(null);
      finish({ ...user, mfa_enabled: false });
      setMessage('MFA is disabled for this account.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to disable MFA.');
      setBusy('');
    }
  };

  const revokeSession = async (session) => {
    if (!window.confirm(`Revoke the session on ${session.device_label || 'this device'}?`)) return;
    setBusy(`revoke-${session.session_id}`); setError('');
    try {
      await api.delete(`/security/sessions/${session.session_id}`);
      await loadSessions();
      setMessage('Session revoked.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to revoke the session.');
    } finally { setBusy(''); }
  };

  const revokeAll = async () => {
    if (!window.confirm('Log out all sessions, including this one? You will be returned to the sign-in screen.')) return;
    setBusy('all'); setError('');
    try {
      await api.post('/security/sessions/revoke-all');
      onLogout();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to log out all sessions.');
      setBusy('');
    }
  };

  return (
    <Section title="Security" description="Protect your account and manage where it is signed in.">
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Security overview">
        <div className="rounded-xl border border-slate-200 p-4"><span className="block text-xs font-bold uppercase tracking-wide text-slate-500">MFA</span><strong className="text-slate-900">{mfaEnabled ? 'Enabled' : 'Disabled'}</strong></div>
        <div className="rounded-xl border border-slate-200 p-4"><span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Active sessions</span><strong className="text-slate-900">{sessions.length}</strong></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><span className="block text-xs font-bold uppercase tracking-wide text-emerald-700">Protection</span><strong className="text-emerald-800">{mfaEnabled ? 'Enhanced' : 'Password only'}</strong></div>
      </div>
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div><h4 className="font-black text-slate-900">Multi-factor authentication</h4><p className="mt-1 text-sm leading-6 text-slate-500">MFA adds a time-based code from an authenticator app when you sign in.</p></div>
        {!mfaEnabled && !setupUrl && <button type="button" className="dashboard-button primary" onClick={beginMfaSetup} disabled={busy === 'setup'}>{busy === 'setup' ? 'Starting setup...' : 'Enable MFA'}</button>}
        {mfaEnabled && <button type="button" className="dashboard-button" onClick={disableMfa} disabled={busy === 'disable'}>{busy === 'disable' ? 'Disabling...' : 'Disable MFA'}</button>}
        {setupUrl && <form className="grid gap-4 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:grid-cols-[auto_1fr]" onSubmit={enableMfa}><div className="flex justify-center"><QRCodeSVG value={setupUrl} size={160} includeMargin aria-label="Authenticator setup QR code" /></div><div className="space-y-3"><p className="text-sm leading-6 text-slate-700">Authenticator App: scan this code in a compatible authenticator application. The setup URI is shown only while setup is in progress.</p><label className="form-field"><span>Authenticator setup URI</span><textarea readOnly value={setupUrl} rows={3} aria-label="Authenticator setup URI" /></label><label className="form-field"><span>Current six-digit code</span><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></label><button type="submit" className="dashboard-button primary" disabled={busy === 'enable'}>{busy === 'enable' ? 'Verifying...' : 'Verify and enable MFA'}</button></div></form>}
      </div>
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div><h4 className="font-black text-slate-900">Recovery codes</h4><p className="mt-1 text-sm leading-6 text-slate-500">Recovery codes can be used once if you cannot access your authenticator app.</p></div>
        {recoveryCodes ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert"><p className="font-bold text-amber-900">Store these codes securely. They will not be shown again.</p><code className="mt-3 grid grid-cols-2 gap-2 text-sm text-amber-950 sm:grid-cols-4">{recoveryCodes.map((code) => <span key={code}>{code}</span>)}</code><button type="button" className="dashboard-button mt-4" onClick={() => setRecoveryCodes(null)}>Hide recovery codes</button></div> : <p className="text-sm text-slate-600">{mfaEnabled ? 'Recovery codes are configured for this account.' : 'Recovery codes become available after MFA is enabled.'}</p>}
      </div>
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div><h4 className="font-black text-slate-900">Active sessions</h4><p className="mt-1 text-sm leading-6 text-slate-500">Review and revoke refresh sessions. Tokens are never displayed.</p></div>
        {loadingSessions ? <p className="text-sm text-slate-500">Loading sessions...</p> : sessions.length === 0 ? <p className="text-sm text-slate-500">No active sessions found.</p> : <div className="space-y-2">{sessions.map((session) => <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between" key={session.session_id}><div className="text-sm text-slate-700"><strong className="block text-slate-900">{session.device_label || 'Unknown device'}</strong><span>Created {formatSecurityDate(session.created_at)}</span><span className="block">Last active {formatSecurityDate(session.last_active_at)} · Expires {formatSecurityDate(session.expires_at)}</span></div><button type="button" className="dashboard-button" onClick={() => revokeSession(session)} disabled={busy === `revoke-${session.session_id}`}>{busy === `revoke-${session.session_id}` ? 'Revoking...' : 'Revoke session'}</button></div>)}</div>}
        <button type="button" className="dashboard-button" onClick={revokeAll} disabled={busy === 'all'}>{busy === 'all' ? 'Signing out...' : 'Logout All Sessions'}</button>
      </div>
      {isAdmin && <div className="space-y-2 border-t border-slate-200 pt-4"><h4 className="font-black text-slate-900">Security audit</h4><p className="text-sm leading-6 text-slate-500">Review administrator-authorized security events without exposing secrets or tokens.</p><Link className="dashboard-button" to="/audit-logs">Open Audit Logs</Link></div>}
      {message && <p className="text-sm font-bold text-emerald-700" role="status">{message}</p>}
      {error && <p className="text-sm font-bold text-red-700" role="alert">{error}</p>}
    </Section>
  );
}

function PreferenceSelect({ label, value, options, onChange }) {
  return (
    <label className="dashboard-setting-select">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={onChange}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

export default function SettingsPage({ user, onUpdated, onLogout }) {
  const [language, setLanguage] = useLanguage();
  const t = useTranslate();
  const theme = useAppearanceTheme(user?.user_id);
  const [preferences, setPreferences] = useState(() => ({
    ...defaultUserPreferences,
    ...getUserPreferences(user?.user_id),
  }));
  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin' || role === 'administrator';
  const settingsProfile = role === 'security' || role === 'security officer'
    ? roleSettings.security
    : role === 'faculty' || role === 'staff'
      ? roleSettings.faculty
      : roleSettings[role] || roleSettings.default;

  const updatePreference = (key) => (event) => {
    const nextPreferences = { ...preferences, [key]: event.target.checked };
    setPreferences(nextPreferences);
    saveUserPreferences(user?.user_id, nextPreferences);
  };

  const updatePreferenceValue = (key) => (event) => {
    const nextPreferences = { ...preferences, [key]: event.target.value };
    setPreferences(nextPreferences);
    saveUserPreferences(user?.user_id, nextPreferences);
  };

  const resetSettings = () => {
    const nextPreferences = { ...defaultUserPreferences };
    setPreferences(nextPreferences);
    saveUserPreferences(user?.user_id, nextPreferences);
    setAppearanceTheme(user?.user_id, 'light');
  };

  return (
    <div className="space-y-6">
      <div className="dashboard-heading border-b border-slate-200/80 pb-4">
        <p className="dashboard-eyebrow">Personalize your workspace</p>
        <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">{t('Settings')}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Manage your account, appearance, language, and notification preferences. Options are tailored to your role.
        </p>
      </div>

      <Section title="Account" description="Your account details and profile tools.">
        <ProfilePage user={user} onUpdated={onUpdated} />
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <Link className="dashboard-button" to="/forgot-password">Change password</Link>
          <button type="button" className="dashboard-button" onClick={onLogout}>Log out</button>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Update your profile photo here. Name, email, and password updates are not available through an authenticated self-service API.
          Use password recovery to reset a forgotten password.
        </p>
      </Section>

      <Section title="Appearance" description="Choose the theme used by the dashboard.">
        <div className="flex flex-wrap gap-3" role="group" aria-label="Theme">
          {['light', 'dark'].map((value) => (
            <button
              key={value}
              type="button"
              className={`dashboard-button ${theme === value ? 'primary' : ''}`}
              aria-pressed={theme === value}
              onClick={() => setAppearanceTheme(user?.user_id, value)}
            >
              {value === 'light' ? 'Light theme' : 'Dark theme'}
            </button>
          ))}
        </div>
        <p className="text-xs leading-5 text-slate-500">Theme choice is saved in this browser for your account.</p>
      </Section>

      <Section title="Language" description="Use a language already supported by dashboard translations.">
        <label className="form-field max-w-sm">
          <span>Application language</span>
          <select aria-label="Application language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="am">አማርኛ</option>
          </select>
        </label>
      </Section>

      <Section title={`Recommended for ${settingsProfile.title}`} description={settingsProfile.description}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Preference label="In-app notifications" description="Show live notifications in the dashboard header." checked={preferences.inAppNotifications} onChange={updatePreference('inAppNotifications')} />
          <Preference label="Incident notifications" description="Show new incident reports." checked={preferences.incidentNotifications} onChange={updatePreference('incidentNotifications')} />
          <Preference label="Alert notifications" description="Show non-SOS alerts." checked={preferences.alertNotifications} onChange={updatePreference('alertNotifications')} />
          <Preference label="SOS / emergency notifications" description="Enabled by default. Disabling affects only the optional in-app card; emergency processing remains active." checked={preferences.sosNotifications} onChange={updatePreference('sosNotifications')} />
          {settingsProfile.toggles.map(([key, label, description]) => (
            <Preference key={key} label={label} description={description} checked={preferences[key]} onChange={updatePreference(key)} />
          ))}
        </div>
        {settingsProfile.options.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {settingsProfile.options.map(([key, label, options]) => (
              <PreferenceSelect key={key} label={label} value={preferences[key]} options={options} onChange={updatePreferenceValue(key)} />
            ))}
          </div>
        )}
        <p className="text-xs leading-5 text-slate-500">
          Preferences are saved in this browser for your account. Notification choices only affect in-app cards; they do not disable emergency processing or change SMS, email, or push delivery.
        </p>
      </Section>

      <Section title="Privacy & Security" description="Manage the account security actions currently available in the dashboard.">
        <div className="flex flex-wrap items-center gap-3">
          <Link className="dashboard-button" to="/forgot-password">Reset password</Link>
          <button type="button" className="dashboard-button" onClick={onLogout}>Sign out of this session</button>
          <button type="button" className="dashboard-button" onClick={resetSettings}>Reset settings</button>
        </div>
        <p className="text-xs leading-5 text-slate-500">Settings return to their defaults for this account. Detailed account protection and session controls are available below.</p>
      </Section>

      <SecuritySettings user={user} isAdmin={isAdmin} onUpdated={onUpdated} onLogout={onLogout} />

      {isAdmin && (
        <>
          <Section title="Admin features" description="Administrative destinations available to administrators only. Existing access controls continue to apply.">
            <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Admin features">
              {adminLinks.map(([label, path]) => <Link className="dashboard-button justify-start" key={path} to={path}>{label}</Link>)}
            </nav>
            <p className="text-xs leading-5 text-slate-500">Zone Management and existing zone operations are unchanged.</p>
          </Section>
          <Section title="System Management" description="Administrator-only operational configuration and application availability.">
            <SystemSettingsPage />
          </Section>
        </>
      )}
    </div>
  );
}
