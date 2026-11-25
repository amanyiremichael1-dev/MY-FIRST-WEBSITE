import { useEffect, useState } from 'react';
import { Edit3, Printer, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatDateShort, formatUgx } from '../lib/exports';
import type { StudentRecord } from '../types';
import { StatusLabel } from './StatusBadge';

interface RegistrationHistoryItem {
  reg_id: number;
  session_name: string;
  assessment_programme: string;
  assessment_year: number;
  reg_date: string;
  exam_fee_ugx: number;
  fee_paid_ugx: number;
  status: string;
  notes: string | null;
}

interface StudentDossierModalProps {
  studentId: string | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (student: StudentRecord) => void;
}

export function StudentDossierModal({
  studentId,
  canEdit,
  onClose,
  onEdit,
}: StudentDossierModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationHistoryItem[]>([]);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    setLoading(true);
    setError('');
    apiRequest<{ student: StudentRecord; registrations: RegistrationHistoryItem[] }>(
      `/api/students/${encodeURIComponent(studentId)}`
    )
      .then((res) => {
        if (!active) return;
        setStudent(res.student);
        setRegistrations(res.registrations);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load student dossier.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studentId]);

  if (!studentId) return null;

  const latestReg = registrations[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-dossier-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0B1F3A] px-6 py-4 text-white rounded-t-xl">
          <div>
            <p className="text-xs font-medium text-blue-200">
              ALLIANCE VOCATIONAL SCHOOL – IBANDA
            </p>
            <h3 id="student-dossier-title" className="text-lg font-bold">
              {student ? student.full_name : 'Student Registration Dossier'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Close student details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="space-y-3">
              <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && student && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {student.student_id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-blue-700 font-medium">
                    {student.reg_number}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{student.gender}</span>
                </div>
                {latestReg && <StatusLabel status={latestReg.status} />}
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <section className="space-y-3">
                  <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Personal Information
                  </h4>
                  <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
                    <dt className="text-slate-500">Date of Birth</dt>
                    <dd className="font-medium text-slate-900 tabular-nums">
                      {formatDateShort(student.dob)}
                    </dd>
                    <dt className="text-slate-500">Telephone</dt>
                    <dd className="font-mono-tabular font-medium text-slate-900">
                      {student.phone}
                    </dd>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="font-medium text-slate-900 break-all">
                      {student.email || 'Not provided'}
                    </dd>
                    <dt className="text-slate-500">Home District</dt>
                    <dd className="font-medium text-slate-900">{student.district}</dd>
                    <dt className="text-slate-500">Village / Address</dt>
                    <dd className="font-medium text-slate-900">{student.address}</dd>
                  </dl>
                </section>

                <section className="space-y-3">
                  <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Academic Information
                  </h4>
                  <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
                    <dt className="text-slate-500">Course</dt>
                    <dd className="font-medium text-slate-900">
                      {student.course_name} ({student.course_code})
                    </dd>
                    <dt className="text-slate-500">Department</dt>
                    <dd className="font-medium text-slate-900">
                      {student.dept_name || '—'}
                    </dd>
                    <dt className="text-slate-500">Year of Study</dt>
                    <dd className="font-medium text-slate-900">{student.year_of_study}</dd>
                    <dt className="text-slate-500">Academic Year</dt>
                    <dd className="font-mono-tabular font-medium text-slate-900">
                      {student.academic_year}
                    </dd>
                    <dt className="text-slate-500">Exam Level</dt>
                    <dd className="font-medium text-slate-900">{student.exam_level}</dd>
                  </dl>
                </section>
              </div>

              <section className="space-y-3">
                <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  UVTAB Examination Registration History
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Session</th>
                        <th className="px-4 py-2.5">Programme</th>
                        <th className="px-4 py-2.5">Reg Date</th>
                        <th className="px-4 py-2.5 text-right">Fee (UGX)</th>
                        <th className="px-4 py-2.5 text-right">Paid (UGX)</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registrations.map((r) => (
                        <tr key={r.reg_id}>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {r.session_name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {r.assessment_programme}
                          </td>
                          <td className="px-4 py-2.5 font-mono-tabular text-slate-600">
                            {formatDateShort(r.reg_date)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-700">
                            {formatUgx(r.exam_fee_ugx)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-tabular font-medium text-slate-900">
                            {formatUgx(r.fee_paid_ugx)}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusLabel status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  Note: Registration statuses reflect Alliance Vocational School internal processing workflow.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5 rounded-b-xl no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4" />
            Print Dossier
          </button>
          {canEdit && student && (
            <button
              type="button"
              onClick={() => {
                const fullStudent: StudentRecord = {
                  ...student,
                  reg_id: latestReg?.reg_id,
                  session_id: registrations[0]
                    ? undefined
                    : student.session_id,
                  assessment_programme: latestReg?.assessment_programme,
                  assessment_year: latestReg?.assessment_year,
                  reg_date: latestReg?.reg_date,
                  exam_fee_ugx: latestReg?.exam_fee_ugx,
                  fee_paid_ugx: latestReg?.fee_paid_ugx,
                  registration_status: (latestReg?.status as StudentRecord['registration_status']) || 'Pending',
                  notes: latestReg?.notes,
                };
                onEdit(fullStudent);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B1F3A] whitespace-nowrap shrink-0"
            >
              <Edit3 className="h-4 w-4" />
              Edit Record
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
