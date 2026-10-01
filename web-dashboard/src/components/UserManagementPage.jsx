import { useEffect, useState } from 'react';
import api from '../services/api';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import { UserAvatar } from './DashboardLayout';

const roles = [
  { value: 'student', label: 'Student / User' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'staff', label: 'Staff' },
  { value: 'security', label: 'Security Officer' },
  { value: 'security_officer', label: 'Security Officer (legacy)' },
  { value: 'admin', label: 'Admin' },
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  role: 'student',
  password: '',
  confirmPassword: '',
  is_active: true,
};

const titleCase = (value) => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function UserManagementPage({ users, setUsers, onRefresh, currentUser, onUserUpdated }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [statusLoading, setStatusLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const adminCount = users.filter((account) => account.role === 'admin').length;
  const adminLimitReached = adminCount >= 3;
  const displayedUserIds = users.map((account) => account.user_id);
  const displayedUserIdSet = new Set(displayedUserIds);
  const selectedDisplayedUserIds = selectedUserIds.filter((userId) => displayedUserIdSet.has(userId));
  const allUsersSelected = displayedUserIds.length > 0
    && selectedDisplayedUserIds.length === displayedUserIds.length;

  useEffect(() => {
    const currentDisplayedIds = new Set(users.map((account) => account.user_id));
    setSelectedUserIds((current) => current.filter((userId) => currentDisplayedIds.has(userId)));
  }, [users]);

  const openCreateForm = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setError('');
    setFormOpen(true);
  };

  const openUpdateForm = (account) => {
    setEditingUser(account);
    setForm({
      ...emptyForm,
      name: account.name || '',
      email: account.email || '',
      phone: account.phone || '',
      role: account.role || 'student',
      is_active: account.is_active !== false,
    });
    setError('');
    setFormOpen(true);
  };

  const submitUser = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!editingUser && !form.password) {
      setError('Password is required.');
      return;
    }
    if (form.role === 'admin' && !editingUser && adminLimitReached) {
      setError('The maximum number of Admin accounts is 3.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      is_active: form.is_active,
      ...(form.password ? { password: form.password } : {}),
    };
    setSaving(true);
    try {
      const response = editingUser
        ? await api.patch(`/users/${editingUser.user_id}`, payload)
        : await api.post('/auth/admin/create-user', payload);
      const savedUser = editingUser ? response.data?.data : response.data?.data?.user;
      if (!savedUser) throw new Error('The server response did not include the saved user.');

      setUsers((current) => editingUser
        ? current.map((account) => account.user_id === savedUser.user_id ? savedUser : account)
        : [savedUser, ...current.filter((account) => account.user_id !== savedUser.user_id)]);
      setSelectedUser((current) => current?.user_id === savedUser.user_id ? savedUser : current);
      if (savedUser.user_id === currentUser?.user_id) onUserUpdated(savedUser);
      setMessage(editingUser ? 'User updated successfully.' : 'User created successfully.');
      setFormOpen(false);
      setEditingUser(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (account) => {
    if (!window.confirm(`Delete ${account.name} (${account.email})? This cannot be undone.`)) return;
    setError('');
    try {
      await api.delete(`/users/${account.user_id}`);
      setUsers((current) => current.filter((user) => user.user_id !== account.user_id));
      setSelectedUser((current) => current?.user_id === account.user_id ? null : current);
      setMessage(`${account.name} was deleted.`);
    } catch (requestError) {
      const status = requestError.response?.status;
      setError(requestError.response?.data?.message
        || (status === 404
          ? 'The delete endpoint was not found or this user no longer exists. Refresh the user list and check the backend version.'
          : 'Unable to delete user.'));
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((current) => current.includes(userId)
      ? current.filter((selectedId) => selectedId !== userId)
      : [...current, userId]);
  };

  const toggleAllUsers = () => {
    setSelectedUserIds(allUsersSelected ? [] : displayedUserIds);
  };

  const deleteSelectedUsers = async () => {
    const selectedAccounts = users.filter((account) => selectedDisplayedUserIds.includes(account.user_id));
    if (!selectedAccounts.length) return;
    const count = selectedAccounts.length;
    if (!window.confirm(`Delete ${count} selected user${count === 1 ? '' : 's'}? This cannot be undone.`)) return;

    setError('');
    setMessage('');
    setBulkDeleting(true);
    try {
      const response = await api.delete('/users/bulk', {
        data: { userIds: selectedAccounts.map((account) => account.user_id) }
      });
      const deletedIds = response.data?.data?.deleted;
      const failures = response.data?.data?.failures;
      const requestedIds = new Set(selectedAccounts.map((account) => account.user_id));
      if (!Array.isArray(deletedIds) || !Array.isArray(failures)
        || deletedIds.some((userId) => !requestedIds.has(userId))) {
        throw new Error('The server response did not include bulk deletion results.');
      }
      const deletedSet = new Set(deletedIds);
      setUsers((current) => current.filter((user) => !deletedSet.has(user.user_id)));
      setSelectedUserIds((current) => current.filter((userId) => !deletedSet.has(userId)));
      setSelectedUser((current) => current && deletedSet.has(current.user_id) ? null : current);

      if (failures.length) {
        const failureDetails = failures.map((failure) => {
          const failedUser = selectedAccounts.find((account) => account.user_id === failure.user_id);
          return `${failedUser?.name || failure.user_id}: ${failure.message || 'Unable to delete user.'}`;
        }).join(' ');
        setError(`${deletedIds.length} user${deletedIds.length === 1 ? '' : 's'} deleted. ${failureDetails}`);
      } else {
        setMessage(`${deletedIds.length} user${deletedIds.length === 1 ? '' : 's'} deleted.`);
      }
    } catch (requestError) {
      const backendMessage = requestError.response?.data?.message;
      setError(backendMessage || requestError.message || 'Unable to delete selected users.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleStatus = async (account) => {
    setStatusLoading(account.user_id);
    setError('');
    try {
      const response = await api.patch(`/users/${account.user_id}/status`, { is_active: !account.is_active });
      const updatedUser = response.data?.data;
      if (!updatedUser) throw new Error('The server response did not include the updated user.');
      setUsers((current) => current.map((user) => user.user_id === updatedUser.user_id ? updatedUser : user));
      setSelectedUser((current) => current?.user_id === updatedUser.user_id ? updatedUser : current);
      setMessage(`${account.name} was ${updatedUser.is_active ? 'activated' : 'deactivated'}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update user status.');
    } finally {
      setStatusLoading('');
    }
  };

  const updatePhoto = (updatedUser) => {
    setUsers((current) => current.map((account) => account.user_id === updatedUser.user_id ? updatedUser : account));
    setSelectedUser(updatedUser);
    if (updatedUser.user_id === currentUser?.user_id) onUserUpdated(updatedUser);
  };

  return (
    <div className="space-y-8">
      <div className="dashboard-heading mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="dashboard-eyebrow">Access and people</p>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">User management</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Campus accounts returned by the security service.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dashboard-button primary" onClick={openCreateForm}>Create User</button>
          <button type="button" className="dashboard-button" onClick={onRefresh}>Refresh</button>
        </div>
      </div>

      {adminLimitReached && <p className="dashboard-error" role="alert">The maximum number of Admin accounts is 3.</p>}
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" role="status">{message}</p>}

      {users.length ? (
        <>
          <section className="dashboard-panel user-profile-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]" aria-label="Selected user profile">
            {selectedUser ? (
              <>
                <div className="flex flex-wrap items-start gap-4">
                  <UserAvatar user={selectedUser} size="h-20 w-20 sm:h-24 sm:w-24" />
                  <div className="min-w-0 flex-1">
                    <p className="dashboard-eyebrow">User profile</p>
                    <h3 className="mt-1 text-xl font-black text-[#0b1f3a]">{selectedUser.name}</h3>
                    <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <div><dt className="font-bold text-slate-500">Email</dt><dd className="break-all text-slate-800">{selectedUser.email}</dd></div>
                      <div><dt className="font-bold text-slate-500">Phone</dt><dd className="text-slate-800">{selectedUser.phone || 'Not provided'}</dd></div>
                      <div><dt className="font-bold text-slate-500">Role</dt><dd className="text-slate-800">{titleCase(selectedUser.role)}</dd></div>
                      <div><dt className="font-bold text-slate-500">Status</dt><dd className="text-slate-800">{selectedUser.is_active ? 'Active' : 'Inactive'}</dd></div>
                      <div><dt className="font-bold text-slate-500">User ID</dt><dd className="break-all text-slate-800">{selectedUser.user_id}</dd></div>
                    </dl>
                  </div>
                  <div className="user-management-actions">
                    <button type="button" className="table-action" onClick={() => openUpdateForm(selectedUser)}>Update</button>
                    <button type="button" className="table-action" onClick={() => setSelectedUser(null)}>Close</button>
                  </div>
                </div>
                <ProfilePhotoEditor user={selectedUser} onUpdated={updatePhoto} />
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a user to view profile.</p>
            )}
          </section>

          <div className="user-management-toolbar">
            <p className="text-sm font-semibold text-slate-600" aria-live="polite">
              {selectedDisplayedUserIds.length} user{selectedDisplayedUserIds.length === 1 ? '' : 's'} selected
            </p>
            <button
              type="button"
              className="dashboard-button danger user-management-bulk-delete"
              onClick={deleteSelectedUsers}
              disabled={!selectedDisplayedUserIds.length || bulkDeleting}
            >
              {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>

          <div className="dashboard-panel dashboard-table-scroll border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <table className="dashboard-table user-table">
              <thead><tr>
                <th className="user-selection-cell">
                  <input
                    type="checkbox"
                    aria-label="Select all users"
                    checked={allUsersSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = selectedDisplayedUserIds.length > 0 && !allUsersSelected;
                    }}
                    onChange={toggleAllUsers}
                  />
                </th>
                <th>Profile</th><th>Email</th><th>Role</th><th className="status-cell">Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {users.map((account) => (
                  <tr key={account.user_id}>
                    <td className="user-selection-cell"><input type="checkbox" aria-label={`Select ${account.name}`} checked={selectedDisplayedUserIds.includes(account.user_id)} onChange={() => toggleUserSelection(account.user_id)} /></td>
                    <td><div className="flex items-center gap-3"><UserAvatar user={account} size="h-10 w-10" /><button type="button" className="text-left font-bold text-[#0b1f3a]" onClick={() => setSelectedUser(account)}>{account.name}</button></div></td>
                    <td>{account.email}</td>
                    <td>{titleCase(account.role)}</td>
                    <td className="status-cell"><span className={`status-badge ${account.is_active ? 'resolved' : ''}`}>{account.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="action-cell"><div className="user-management-actions">
                      <button type="button" className="table-action" onClick={() => openUpdateForm(account)} aria-label={`Edit ${account.name}`}>Update</button>
                      <button type="button" className="table-action" onClick={() => deleteUser(account)} aria-label={`Delete ${account.name}`}>Delete</button>
                      <button type="button" className="table-action" onClick={() => toggleStatus(account)} disabled={statusLoading === account.user_id}>{statusLoading === account.user_id ? 'Updating...' : account.is_active ? 'Deactivate' : 'Activate'}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">No users returned.</div>}

      {formOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="presentation">
        <section className="my-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><p className="dashboard-eyebrow">{editingUser ? 'Update account' : 'New account'}</p><h3 id="user-form-title" className="mt-1 text-xl font-black text-[#0b1f3a]">{editingUser ? 'Update User' : 'Create User'}</h3></div>
            <button type="button" className="table-action" onClick={() => setFormOpen(false)}>Close</button>
          </div>
          {error && <p className="dashboard-error" role="alert">{error}</p>}
          {adminLimitReached && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800" role="status">The maximum number of Admin accounts is 3.</p>}
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitUser}>
            <label className="form-field"><span>Full name</span><input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength="255" /></label>
            <label className="form-field"><span>Email</span><input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength="255" /></label>
            <label className="form-field"><span>Phone</span><input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength="32" /></label>
            <label className="form-field"><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roles.map((role) => <option key={role.value} value={role.value} disabled={role.value === 'admin' && adminLimitReached && (!editingUser || editingUser.role !== 'admin')}>{role.label}</option>)}</select></label>
            <label className="form-field"><span>{editingUser ? 'New password (optional)' : 'Password'}</span><input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingUser} minLength="8" /></label>
            <label className="form-field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required={!editingUser || Boolean(form.password)} minLength="8" /></label>
            <label className="form-field sm:col-span-2"><span>Status</span><select value={String(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button type="button" className="dashboard-button" onClick={() => setFormOpen(false)}>Cancel</button>
              <button type="submit" className="dashboard-button primary" disabled={saving}>{saving ? 'Saving...' : editingUser ? 'Save changes' : 'Create User'}</button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}
