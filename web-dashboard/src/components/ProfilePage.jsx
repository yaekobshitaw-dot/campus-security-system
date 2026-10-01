import { useState } from 'react';
import { UserAvatar } from './DashboardLayout';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import userService from '../services/user';

const ProfilePage = ({ user, onUpdated }) => {
  const [status, setStatus] = useState(user?.availability_status || 'offline');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async (e) => {
    const next = e.target.value;
    setStatus(next);
    setError('');
    setLoading(true);
    try {
      const resp = await userService.updateMyAvailability(next);
      if (onUpdated) onUpdated(resp.data?.data || {});
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="dashboard-heading mb-5 border-b border-slate-200/80 pb-4">
        <p className="dashboard-eyebrow">Account settings</p>
        <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">Profile</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Manage your personal profile photo and availability status.</p>
      </div>
      <section className="dashboard-panel border-slate-200/80 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar user={user} size="h-28 w-28" />
          <div>
            <h3 className="text-xl font-black text-[#0b1f3a]">{user?.name || 'Campus member'}</h3>
            <p className="mt-1 text-sm text-slate-500">{user?.email || ''}</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{user?.role || 'Unknown role'}</p>
          </div>
        </div>

        <div className="mt-6">
          {['security', 'security_officer'].includes(String(user?.role || '').toLowerCase()) ? (
            <div className="max-w-md">
              <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
              <select value={status} onChange={handleChange} disabled={loading} className="w-full rounded-md border px-3 py-2">
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Account role: {user?.role || 'Unknown'}</p>
          )}
        </div>

        <ProfilePhotoEditor user={user} onUpdated={onUpdated} selfOnly />
      </section>
    </div>
  );
};

export default ProfilePage;