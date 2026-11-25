import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Edit3, Plus, Trash2, Users, X } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { StatusLabel } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';
import { formatDateShort, formatUgx } from '../lib/exports';
import type {
  ExamSession,
  RegistrationStatus,
  SystemSettings,
  UserRole,
} from '../types';

interface SessionCandidate {
  reg_id: number;
  student_id: string;
  full_name: string;
  reg_number: string;
  gender: string;
  course_name: string;
  course_code: string;
  exam_level: string;
  reg_date: string;
  exam_fee_ugx: number;
  fee_paid_ugx: number;
  status: RegistrationStatus;
}

interface SessionsPageProps {
  userRole: UserRole;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function SessionsPage({ userRole, onNotify }: SessionsPageProps) {
  const isAdmin = userRole === 'Administrator';
  const canUpdateStatus = userRole === 'Administrator' || userRole === 'Registration Officer';

  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [programmes, setProgrammes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [programme, setProgramme] = useState('');
  const [assessmentYear, setAssessmentYear] = useState<number>(2026);
  const [examLevels, setExamLevels] = useState('Level 1 (Year 1), Level 2 (Year 2)');
  const [openingDate, setOpeningDate] = useState('2026-09-01');
  const [closingDate, setClosingDate] = useState('2026-11-30');
  const [status, setStatus] = useState<'Open' | 'Closed'>('Open');
  const [saving, setSaving] = useState(false);

  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [candidates, setCandidates] = useState<SessionCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ExamSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([
        apiRequest<{ sessions: ExamSession[] }>('/api/sessions'),
        apiRequest<{ settings: SystemSettings }>('/api/settings'),
      ]);
      setSessions(sRes.sessions);
      setProgrammes(stRes.settings.assessment_programmes || []);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to load exam sessions.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function loadCandidates(session: ExamSession) {
    setSelectedSession(session);
    setLoadingCandidates(true);
    try {
      const res = await apiRequest<{ students: SessionCandidate[] }>(
        `/api/sessions/${session.session_id}/students`
      );
      setCandidates(res.students);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to load candidates.');
    } finally {
      setLoadingCandidates(false);
    }
  }

  function openNewForm() {
    setEditingSession(null);
    setSessionName('');
    setProgramme(programmes[0] || 'UVTAB National Certificate (Full Assessment)');
    setAssessmentYear(new Date().getFullYear());
    setExamLevels('Level 1 (Year 1), Level 2 (Year 2), Modular Assessment');
    setOpeningDate(`${new Date().getFullYear()}-09-01`);
    setClosingDate(`${new Date().getFullYear()}-11-30`);
    setStatus('Open');
    setShowForm(true);
  }

  function openEditForm(s: ExamSession) {
    setEditingSession(s);
    setSessionName(s.session_name);
    setProgramme(s.assessment_programme);
    setAssessmentYear(s.assessment_year);
    setExamLevels(s.exam_levels);
    setOpeningDate(s.opening_date);
    setClosingDate(s.closing_date);
    setStatus(s.status);
    setShowForm(true);
  }

  async function handleSaveSession(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        session_name: sessionName.trim(),
        assessment_programme: programme.trim(),
        assessment_year: assessmentYear,
        exam_levels: examLevels.trim(),
        opening_date: openingDate,
        closing_date: closingDate,
        status,
      };
      if (editingSession) {
        await apiRequest(`/api/sessions/${editingSession.session_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Session "${sessionName}" updated.`);
      } else {
        await apiRequest('/api/sessions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Session "${sessionName}" created.`);
      }
      setShowForm(false);
      loadSessions();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save session.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusUpdate(regId: number, newStatus: RegistrationStatus) {
    try {
      await apiRequest(`/api/registrations/${regId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      onNotify('success', `Candidate status updated to ${newStatus}.`);
      if (selectedSession) {
        loadCandidates(selectedSession);
      }
      loadSessions();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update status.');
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/sessions/${deleteTarget.session_id}`, {
        method: 'DELETE',
      });
      onNotify('success', `Examination session "${deleteTarget.session_name}" deleted.`);
      setDeleteTarget(null);
      loadSessions();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to delete session.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            UVTAB Examination Sessions
          </h2>
          <p className="text-xs text-slate-500">
            Manage registration windows, assessment programmes, and monitor candidate readiness. Statuses represent internal school workflow only.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B1F3A] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Exam Session
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {sessions.map((s) => {
            const total = s.total_registered || 0;
            const finalized = (s.completed_count || 0) + (s.submitted_count || 0);
            const pct = total > 0 ? Math.round((finalized / total) * 100) : 0;

            return (
              <div
                key={s.session_id}
                className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                        <span>{s.assessment_year}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            s.status === 'Open'
                              ? 'font-semibold text-emerald-700'
                              : 'font-semibold text-slate-500'
                          }
                        >
                          {s.status}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-slate-900">
                        {s.session_name}
                      </h3>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditForm(s)}
                          className="rounded-md border border-slate-200 p-1.5 text-blue-700 hover:bg-blue-50"
                          title="Edit session"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                          title="Delete session"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600">{s.assessment_programme}</p>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Registration Window</span>
                      <span className="font-mono-tabular font-medium text-slate-800">
                        {formatDateShort(s.opening_date)} – {formatDateShort(s.closing_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Managed Levels</span>
                      <span className="font-medium text-slate-800">{s.exam_levels}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">
                        Internal Completion Progress
                      </span>
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {finalized} / {total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#13345E]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-slate-500 pt-1">
                      <span>Pending: {s.pending_count || 0}</span>
                      <span aria-hidden="true">·</span>
                      <span>Completed: {s.completed_count || 0}</span>
                      <span aria-hidden="true">·</span>
                      <span>Submitted: {s.submitted_count || 0}</span>
                      <span aria-hidden="true">·</span>
                      <span>Cancelled: {s.cancelled_count || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => loadCandidates(s)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Users className="h-3.5 w-3.5 text-blue-700" />
                    View Registered Candidates ({total})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Session Candidates Drawer/Table */}
      {selectedSession && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#0B1F3A] px-6 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-5 w-5 text-blue-300" />
              <div>
                <h3 className="text-base font-bold">{selectedSession.session_name}</h3>
                <p className="text-xs text-blue-200">
                  Registered Candidates &amp; Internal Registration Workflow Status
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Candidate Name</th>
                  <th className="px-4 py-3">UVTAB Reg No.</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3 text-right">Fee Paid</th>
                  <th className="px-4 py-3">Workflow Status</th>
                  {canUpdateStatus && <th className="px-4 py-3 text-right">Update Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingCandidates ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Loading session candidates...
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No students registered in this examination session yet.
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => (
                    <tr key={c.reg_id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-slate-700">
                        {c.student_id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-blue-700">
                        {c.reg_number}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {c.course_code} — {c.course_name}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular text-xs text-slate-800">
                        {formatUgx(c.fee_paid_ugx)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={c.status} />
                      </td>
                      {canUpdateStatus && (
                        <td className="px-4 py-3 text-right">
                          <select
                            value={c.status}
                            onChange={(e) =>
                              handleStatusUpdate(
                                c.reg_id,
                                e.target.value as RegistrationStatus
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs focus:border-blue-600 focus:outline-none"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Session Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingSession ? 'Edit Examination Session' : 'Add UVTAB Examination Session'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Session Name *
                </label>
                <input
                  type="text"
                  required
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Nov/Dec 2026 UVTAB Assessment"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Assessment Programme *
                </label>
                <input
                  type="text"
                  required
                  list="session-programmes"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
                <datalist id="session-programmes">
                  {programmes.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Examination Year *
                  </label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2035}
                    value={assessmentYear}
                    onChange={(e) => setAssessmentYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Session Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Open' | 'Closed')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Managed Examination Levels *
                </label>
                <input
                  type="text"
                  required
                  value={examLevels}
                  onChange={(e) => setExamLevels(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Registration Opening Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Registration Closing Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#13345E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingSession ? 'Update Session' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Examination Session"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.session_name}"? Sessions with existing candidate registrations cannot be deleted.`
            : ''
        }
        isLoading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
