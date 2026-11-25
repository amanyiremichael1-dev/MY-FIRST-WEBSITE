import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Database,
  History,
  KeyRound,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { apiRequest, downloadAuthorizedFile } from '../lib/api';
import { formatDateShort } from '../lib/exports';
import type {
  PasswordResetRequest,
  SystemSettings,
  UserAccount,
  UserRole,
} from '../types';

interface AuditLogItem {
  log_id: number;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  log_time: string;
}

interface UsersSettingsPageProps {
  currentUserId: number;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function UsersSettingsPage({
  currentUserId,
  onNotify,
}: UsersSettingsPageProps) {
  const [tab, setTab] = useState<'users' | 'resets' | 'settings' | 'backup'>('users');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit user modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uFullName, setUFullName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uRole, setURole] = useState<UserRole>('Registration Officer');
  const [uPassword, setUPassword] = useState('');
  const [uActive, setUActive] = useState<number>(1);
  const [savingUser, setSavingUser] = useState(false);

  // Reset user password modal
  const [resetTargetUser, setResetTargetUser] = useState<UserAccount | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);

  // Resolve forgot-password request
  const [resolvingReq, setResolvingReq] = useState<PasswordResetRequest | null>(null);
  const [reqTempPassword, setReqTempPassword] = useState('');

  // Settings form
  const [instName, setInstName] = useState('');
  const [instLocation, setInstLocation] = useState('');
  const [programmesText, setProgrammesText] = useState('');
  const [levelsText, setLevelsText] = useState('');
  const [yearsText, setYearsText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState<UserAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, sRes, lRes] = await Promise.all([
        apiRequest<{ users: UserAccount[] }>('/api/users'),
        apiRequest<{ requests: PasswordResetRequest[] }>('/api/password-requests'),
        apiRequest<{ settings: SystemSettings }>('/api/settings'),
        apiRequest<{ logs: AuditLogItem[] }>('/api/audit-logs?limit=80'),
      ]);
      setUsers(uRes.users);
      setResetRequests(rRes.requests);
      setLogs(lRes.logs);

      setInstName(sRes.settings.institution_name || '');
      setInstLocation(sRes.settings.institution_location || '');
      setProgrammesText((sRes.settings.assessment_programmes || []).join('\n'));
      setLevelsText((sRes.settings.exam_levels || []).join('\n'));
      setYearsText((sRes.settings.academic_years || []).join('\n'));
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to load admin settings.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function openNewUser() {
    setEditingUser(null);
    setUUsername('');
    setUFullName('');
    setUEmail('');
    setURole('Registration Officer');
    setUPassword('');
    setUActive(1);
    setShowUserModal(true);
  }

  function openEditUser(u: UserAccount) {
    setEditingUser(u);
    setUUsername(u.username);
    setUFullName(u.full_name);
    setUEmail(u.email || '');
    setURole(u.role);
    setUActive(u.is_active);
    setShowUserModal(true);
  }

  async function handleSaveUser(e: FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    try {
      if (editingUser) {
        await apiRequest(`/api/users/${editingUser.user_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: uFullName.trim(),
            email: uEmail.trim(),
            role: uRole,
            is_active: uActive,
          }),
        });
        onNotify('success', `Updated user account "${editingUser.username}".`);
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            username: uUsername.trim(),
            full_name: uFullName.trim(),
            email: uEmail.trim(),
            role: uRole,
            password: uPassword,
          }),
        });
        onNotify('success', `Created staff account "${uUsername}".`);
      }
      setShowUserModal(false);
      loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save user.');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleAdminResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResettingPw(true);
    try {
      await apiRequest(`/api/users/${resetTargetUser.user_id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: tempPassword }),
      });
      onNotify(
        'success',
        `Temporary password set for ${resetTargetUser.username}. They will be prompted to change it on next login.`
      );
      setResetTargetUser(null);
      setTempPassword('');
      loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setResettingPw(false);
    }
  }

  async function handleResolveRequest(action: 'approve' | 'reject') {
    if (!resolvingReq) return;
    try {
      await apiRequest(`/api/password-requests/${resolvingReq.request_id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          tempPassword: reqTempPassword,
        }),
      });
      onNotify(
        'success',
        action === 'approve'
          ? `Password reset completed for ${resolvingReq.username}.`
          : `Request from ${resolvingReq.username} rejected.`
      );
      setResolvingReq(null);
      setReqTempPassword('');
      loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to resolve request.');
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const splitClean = (txt: string) =>
        txt
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            institution_name: instName.trim(),
            institution_location: instLocation.trim(),
            assessment_programmes: splitClean(programmesText),
            exam_levels: splitClean(levelsText),
            academic_years: splitClean(yearsText),
          },
        }),
      });
      onNotify('success', 'Configurable UVTAB system settings updated.');
      loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/users/${deleteUserTarget.user_id}`, {
        method: 'DELETE',
      });
      onNotify('success', `Deleted user "${deleteUserTarget.username}".`);
      setDeleteUserTarget(null);
      loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to delete user.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownloadSqlBackup() {
    try {
      await downloadAuthorizedFile(
        '/api/backup/sql',
        `alliance_uvtab_backup_${new Date().toISOString().slice(0, 10)}.sql`
      );
      onNotify('success', 'SQL database backup downloaded.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Backup download failed.');
    }
  }

  const pendingResetsCount = resetRequests.filter((r) => r.status === 'Pending').length;

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            tab === 'users'
              ? 'bg-[#13345E] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Shield className="h-4 w-4" />
          User Accounts &amp; Roles
        </button>
        <button
          type="button"
          onClick={() => setTab('resets')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            tab === 'resets'
              ? 'bg-[#13345E] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          Password Recovery ({pendingResetsCount})
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            tab === 'settings'
              ? 'bg-[#13345E] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Settings className="h-4 w-4" />
          UVTAB Configurable Fields
        </button>
        <button
          type="button"
          onClick={() => setTab('backup')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            tab === 'backup'
              ? 'bg-[#13345E] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Database className="h-4 w-4" />
          Audit Logs &amp; SQL Backup
        </button>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : tab === 'users' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Authorized Staff Accounts
              </h2>
              <p className="text-xs text-slate-500">
                Manage Administrators, Registration Officers, and read-only Staff users.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewUser}
              className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B1F3A] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Staff User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono-tabular text-xs font-bold text-slate-900">
                      {u.username}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{u.full_name}</div>
                      <div className="text-xs text-slate-500">{u.email || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{u.role}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {u.is_active === 1 ? (
                        <span className="text-emerald-700">Active</span>
                      ) : (
                        <span className="text-red-600">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-slate-600">
                      {u.last_login ? formatDateShort(u.last_login) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetUser(u);
                            setTempPassword('');
                          }}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        {u.user_id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => setDeleteUserTarget(u)}
                            className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'resets' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Administrator-Managed Password Recovery Queue
            </h2>
            <p className="text-xs text-slate-500">
              Review staff forgot-password requests and assign a one-time temporary password.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resetRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No password recovery requests submitted.
                    </td>
                  </tr>
                ) : (
                  resetRequests.map((req) => (
                    <tr key={req.request_id}>
                      <td className="px-4 py-3 font-mono-tabular text-xs font-bold text-slate-900">
                        {req.username}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {req.requested_by_note || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-slate-600">
                        {formatDateShort(req.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                        {req.status}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {req.status === 'Pending' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingReq(req);
                              setReqTempPassword('');
                            }}
                            className="rounded-md bg-[#13345E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B1F3A]"
                          >
                            Review &amp; Resolve
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'settings' ? (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Configurable UVTAB Registration Parameters
            </h2>
            <p className="text-xs text-slate-500">
              Customize assessment programmes, examination levels, and academic years (one entry per line) as official UVTAB circulars are updated.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Institution Name
              </label>
              <input
                type="text"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Location
              </label>
              <input
                type="text"
                value={instLocation}
                onChange={(e) => setInstLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Assessment Programmes (1 per line)
              </label>
              <textarea
                rows={6}
                value={programmesText}
                onChange={(e) => setProgrammesText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-relaxed focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Examination Levels (1 per line)
              </label>
              <textarea
                rows={6}
                value={levelsText}
                onChange={(e) => setLevelsText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-relaxed focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Academic Years (1 per line)
              </label>
              <textarea
                rows={6}
                value={yearsText}
                onChange={(e) => setYearsText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular leading-relaxed focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="rounded-lg bg-[#13345E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50"
            >
              {savingSettings ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Database Backup &amp; XAMPP MySQL Migration
              </h2>
              <p className="mt-1 text-xs text-slate-600 max-w-2xl">
                This live demonstration uses an embedded relational SQLite database on the Node.js server. Click below to download a live SQL dump of all current records, or deploy the bundled PHP/MySQL package in <code className="font-mono-tabular bg-slate-100 px-1.5 py-0.5 rounded">php_xampp_export/alliance_uvtab/</code> to XAMPP.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSqlBackup}
              className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0B1F3A] whitespace-nowrap shrink-0"
            >
              <Database className="h-4 w-4" />
              Download Live SQL Backup (.sql)
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
              <History className="h-4 w-4 text-[#13345E]" />
              <h3 className="text-base font-bold text-slate-900">
                System Security &amp; Activity Audit Trail
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[440px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Entity</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((l) => (
                    <tr key={l.log_id}>
                      <td className="px-4 py-2.5 font-mono-tabular text-slate-600 whitespace-nowrap">
                        {l.log_time}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">
                        {l.username}
                      </td>
                      <td className="px-4 py-2.5 text-slate-900">{l.action}</td>
                      <td className="px-4 py-2.5 font-mono-tabular text-slate-500">
                        {l.entity_type ? `${l.entity_type}:${l.entity_id || ''}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{l.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? `Edit User — ${editingUser.username}` : 'Add Staff Account'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {!editingUser && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    placeholder="e.g. registrar1"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Role *
                </label>
                <select
                  value={uRole}
                  onChange={(e) => setURole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Registration Officer">Registration Officer</option>
                  <option value="School Staff">School Staff (Read-Only)</option>
                </select>
              </div>

              {editingUser ? (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Account Status
                  </label>
                  <select
                    value={uActive}
                    onChange={(e) => setUActive(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Initial Temporary Password (min 8 chars) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="rounded-lg bg-[#13345E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50"
                >
                  {savingUser ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetTargetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                Reset Password for {resetTargetUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAdminResetPassword} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  New Temporary Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPw}
                  className="rounded-lg bg-[#13345E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B1F3A]"
                >
                  {resettingPw ? 'Resetting...' : 'Set Temporary Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Password Reset Request Modal */}
      {resolvingReq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#13345E]" />
                <h3 className="text-base font-bold text-slate-900">
                  Resolve Recovery — {resolvingReq.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingReq(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Note: {resolvingReq.requested_by_note || 'No note provided.'}
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Temporary Password (min 8 chars to approve)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={reqTempPassword}
                  onChange={(e) => setReqTempPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleResolveRequest('reject')}
                  className="rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Reject Request
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveRequest('approve')}
                  className="rounded-lg bg-[#13345E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B1F3A]"
                >
                  Approve &amp; Set Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteUserTarget)}
        title="Delete User Account"
        message={
          deleteUserTarget
            ? `Permanently remove staff account "${deleteUserTarget.username}" (${deleteUserTarget.full_name})?`
            : ''
        }
        isLoading={deleting}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </div>
  );
}
