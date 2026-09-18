import { UserAvatar } from './DashboardLayout';
import ProfilePhotoEditor from './ProfilePhotoEditor';

const ProfilePage = ({ user, onUpdated }) => (
  <div className="space-y-8">
    <div className="dashboard-heading mb-5 border-b border-slate-200/80 pb-4">
      <p className="dashboard-eyebrow">Account settings</p>
      <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">Profile</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Manage your personal profile photo.</p>
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
      <ProfilePhotoEditor user={user} onUpdated={onUpdated} selfOnly />
    </section>
  </div>
);

export default ProfilePage;