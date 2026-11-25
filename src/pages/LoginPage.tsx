import { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { SchoolCrest } from '../components/SchoolCrest';
import { apiRequest } from '../lib/api';
import type { AuthUser } from '../types';

interface LoginPageProps {
  needsBootstrap: boolean;
  onAuthenticated: (token: string, user: AuthUser) => void;
  onBootstrapComplete: () => void;
}

export function LoginPage({
  needsBootstrap,
  onAuthenticated,
  onBootstrapComplete,
}: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Bootstrap state
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminFullName, setAdminFullName] = useState('System Administrator');
  const [adminEmail, setAdminEmail] = useState('admin@alliancevocational.ac.ug');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');

  // Forgot password state
  const [resetUsername, setResetUsername] = useState('');
  const [resetNote, setResetNote] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (adminPassword.length < 8) {
      setError('Administrator password must be at least 8 characters.');
      return;
    }
    if (adminPassword !== adminConfirm) {
      setError('Password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>(
        '/api/auth/bootstrap',
        {
          method: 'POST',
          body: JSON.stringify({
            username: adminUsername,
            full_name: adminFullName,
            email: adminEmail,
            password: adminPassword,
          }),
        }
      );
      onBootstrapComplete();
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete administrator setup.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ username: resetUsername, note: resetNote }),
      });
      setResetSuccess(res.message);
      setResetUsername('');
      setResetNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit recovery request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Institutional Showcase */}
        <div className="relative lg:col-span-6 bg-[#0B1F3A] text-white flex flex-col justify-between min-h-[280px] lg:min-h-[600px]">
          <img
            src="/src/assets/images/avs_campus_banner_1795601297193.jpg"
            alt="Alliance Vocational School Ibanda Campus"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A] via-[#0B1F3A]/80 to-[#0B1F3A]/65" />

          <div className="relative z-10 p-8 md:p-10 flex items-center gap-3.5">
            <SchoolCrest className="h-12 w-12 shrink-0" />
            <div>
              <p className="text-xs font-semibold tracking-wider text-blue-200">
                IBANDA MUNICIPALITY, UGANDA
              </p>
              <h1 className="text-lg font-bold tracking-tight text-white">
                ALLIANCE VOCATIONAL SCHOOL – IBANDA
              </h1>
            </div>
          </div>

          <div className="relative z-10 p-8 md:p-10 space-y-5">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight text-balance">
              UVTAB Student Registration Management System
            </h2>
            <p className="text-sm leading-relaxed text-slate-200 max-w-md">
              Centralized institutional registry for managing candidate biodata, trade courses,
              UVTAB examination sessions, fee tracking in UGX, and official registration reports.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/15 text-xs text-slate-200">
              <div>
                <p className="font-semibold text-white">Role-Based Security</p>
                <p className="mt-0.5 text-slate-300">
                  Administrator, Registration Officer &amp; Staff controls
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">Audit &amp; Reporting</p>
                <p className="mt-0.5 text-slate-300">
                  PDF, Excel, Print &amp; MySQL-compatible backups
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-6 p-8 md:p-10 flex flex-col justify-center bg-white">
          {needsBootstrap ? (
            <div className="mx-auto w-full max-w-sm space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 mb-2">
                  <ShieldCheck className="h-4 w-4" />
                  Initial System Setup
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Claim Administrator Account
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  Create the primary System Administrator credentials to initialize Alliance Vocational School&apos;s registry.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleBootstrap} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Administrator Username
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Institutional Email
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Set Administrator Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={adminConfirm}
                    onChange={(e) => setAdminConfirm(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#13345E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Initializing System...' : 'Create Administrator & Sign In'}
                </button>
              </form>
            </div>
          ) : mode === 'login' ? (
            <div className="mx-auto w-full max-w-sm space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#13345E] mb-2">
                  <Lock className="h-4 w-4" />
                  Authorized Staff Portal
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  Enter your staff username and password to access UVTAB registration records.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="Enter username"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setResetSuccess('');
                        setMode('forgot');
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#13345E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50 transition-colors"
                >
                  <UserCheck className="h-4 w-4" />
                  {loading ? 'Signing In...' : 'Sign In to Registry'}
                </button>
              </form>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-sm space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMode('login');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-3"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#13345E] mb-1">
                  <KeyRound className="h-4 w-4" />
                  Administrator-Managed Recovery
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Request Password Reset
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  Submit your username below. The System Administrator will review and issue a temporary password.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {resetSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {resetSuccess}
                </div>
              )}

              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Staff Username
                  </label>
                  <input
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. registrar1"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Reason / Verification Note
                  </label>
                  <textarea
                    rows={3}
                    value={resetNote}
                    onChange={(e) => setResetNote(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. Office terminal password forgotten"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#13345E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50"
                >
                  {loading ? 'Submitting Request...' : 'Submit Recovery Request'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
