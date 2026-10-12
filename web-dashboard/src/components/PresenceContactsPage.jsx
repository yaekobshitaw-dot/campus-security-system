import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import webSocket from '../services/socket';
import { UserAvatar } from './DashboardLayout';

const filters = ['All', 'Online', 'Offline'];

function formatLastSeen(value) {
  if (!value) return 'Last seen unavailable';
  const lastSeen = new Date(value);
  if (!Number.isFinite(lastSeen.getTime())) return 'Last seen unavailable';
  return `Last seen ${formatDistanceToNow(lastSeen, { addSuffix: true })}`;
}

export default function PresenceContactsPage() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    let loaded = false;
    let snapshotOnlineIds = null;
    const queuedUpdates = new Map();

    const applyPresence = (currentUsers, update) => currentUsers.map((user) => (
      String(user.user_id) === String(update.user_id)
        ? {
          ...user,
          is_online: update.is_online,
          last_seen_at: update.is_online ? null : update.last_seen_at,
        }
        : user
    ));

    const handlePresenceUpdate = (update) => {
      if (!update || typeof update.user_id !== 'string' || typeof update.is_online !== 'boolean') return;
      if (!loaded) {
        queuedUpdates.set(update.user_id, update);
        return;
      }
      setUsers((currentUsers) => applyPresence(currentUsers, update));
    };

    const handlePresenceSnapshot = (snapshot) => {
      if (!Array.isArray(snapshot?.online_user_ids)) return;
      snapshotOnlineIds = new Set(snapshot.online_user_ids.map(String));
      if (!loaded) return;
      setUsers((currentUsers) => currentUsers.map((user) => {
        const isOnline = snapshotOnlineIds.has(String(user.user_id));
        return { ...user, is_online: isOnline, last_seen_at: isOnline ? null : user.last_seen_at };
      }));
    };

    webSocket.on('presence-updated', handlePresenceUpdate);
    webSocket.on('presence-snapshot', handlePresenceSnapshot);

    setLoading(true);
    setError('');
    api.get('/users/presence')
      .then((response) => {
        if (!active) return;
        let nextUsers = Array.isArray(response.data?.data) ? response.data.data : [];
        if (snapshotOnlineIds) {
          nextUsers = nextUsers.map((user) => {
            const isOnline = snapshotOnlineIds.has(String(user.user_id));
            return { ...user, is_online: isOnline, last_seen_at: isOnline ? null : user.last_seen_at };
          });
        }
        queuedUpdates.forEach((update) => {
          nextUsers = applyPresence(nextUsers, update);
        });
        loaded = true;
        setUsers(nextUsers);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        loaded = true;
        setError(requestError.response?.data?.message || 'Unable to load user presence.');
        setLoading(false);
      });

    return () => {
      active = false;
      webSocket.off('presence-updated', handlePresenceUpdate);
      webSocket.off('presence-snapshot', handlePresenceSnapshot);
    };
  }, [reloadKey]);

  const onlineCount = users.filter((user) => user.is_online).length;
  const visibleUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesFilter = filter === 'All'
        || (filter === 'Online' ? user.is_online : !user.is_online);
      const matchesSearch = !normalizedSearch || String(user.name || '').toLocaleLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, users]);

  return (
    <section className="mx-auto w-full max-w-360 space-y-6" aria-labelledby="contacts-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dashboard-eyebrow">Campus directory</p>
          <h2 id="contacts-title" className="mt-1 text-2xl font-black text-[#0b1f3a]">Users &amp; Contacts</h2>
          <p className="mt-2 text-sm text-slate-600">Current availability for active campus accounts.</p>
        </div>
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800" aria-live="polite">
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {onlineCount} online
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <SearchOutlined className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search users by name"
            placeholder="Search users"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <div className="flex w-full gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 sm:w-auto" role="group" aria-label="Filter users by presence">
          {filters.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={`min-h-9 flex-1 rounded-md px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 sm:flex-none ${filter === option ? 'bg-white text-[#0b1f3a] shadow-sm' : 'text-slate-600 hover:text-[#0b1f3a]'}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600" role="status">Loading contacts...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button type="button" className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200 hover:bg-red-100" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
        </div>
      ) : visibleUsers.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Campus users">
          {visibleUsers.map((user) => (
            <li key={user.user_id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={user} size="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-[#0b1f3a]">{user.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600" role="status">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${user.is_online ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
                    {user.is_online ? 'Online' : 'Offline'}
                  </p>
                  {!user.is_online && <p className="mt-1 truncate text-xs text-slate-500">{formatLastSeen(user.last_seen_at)}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600" role="status">
          {users.length ? 'No users match these filters.' : 'No active campus users found.'}
        </p>
      )}
    </section>
  );
}