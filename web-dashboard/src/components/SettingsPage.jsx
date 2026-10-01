import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTranslate } from '../utils/language';
import { defaultUserPreferences, getUserPreferences, setAppearanceTheme, saveUserPreferences, useAppearanceTheme } from '../utils/appearance';
import ProfilePage from './ProfilePage';
import { SystemSettingsPage } from './AdminPages';

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
        <p className="text-xs leading-5 text-slate-500">Settings return to their defaults for this account. The application does not currently provide a self-service active-session list or revoke-other-sessions action.</p>
      </Section>

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
