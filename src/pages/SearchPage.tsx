import { useEffect, useState } from 'react';
import { Edit3, Eye, Search } from 'lucide-react';
import { StatusLabel } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';
import { formatDateShort, formatUgx } from '../lib/exports';
import type { StudentRecord, UserRole } from '../types';

interface SearchPageProps {
  userRole: UserRole;
  onViewStudent: (studentId: string) => void;
  onEditStudent: (student: StudentRecord) => void;
}

export function SearchPage({
  userRole,
  onViewStudent,
  onEditStudent,
}: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const canEdit = userRole === 'Administrator' || userRole === 'Registration Officer';

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ pageSize: '30' });
      if (query.trim()) params.set('search', query.trim());

      apiRequest<{ students: StudentRecord[] }>(`/api/students?${params.toString()}`)
        .then((res) => {
          if (active) setResults(res.students);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Student Search &amp; Record Retrieval
          </h2>
          <p className="text-xs text-slate-500">
            Instantly retrieve candidate records by Student Name, Student ID, UVTAB Registration Number, Course, or Examination Session.
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type student name, AVS-2026-0001, UVT/IBD/26/..., course name, or exam session..."
            className="w-full rounded-xl border border-slate-300 pl-12 pr-4 py-3 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No matching candidate records found for &ldquo;{query}&rdquo;
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Check the spelling of the name, Student ID, or UVTAB registration number.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((s) => (
            <div
              key={s.student_id}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{s.full_name}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono-tabular">
                      <span className="font-semibold text-slate-800">{s.student_id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-blue-700 font-medium">{s.reg_number}</span>
                      <span aria-hidden="true">·</span>
                      <span>{s.gender}</span>
                    </div>
                  </div>
                  <StatusLabel status={s.registration_status} />
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Course</span>
                    <span className="font-medium text-slate-800">
                      {s.course_code} — {s.course_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Exam Session</span>
                    <span className="font-medium text-slate-800">
                      {s.session_name || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Phone / District</span>
                    <span className="font-mono-tabular text-slate-800">
                      {s.phone} · {s.district}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fee Paid / Reg Date</span>
                    <span className="font-mono-tabular text-slate-800">
                      {formatUgx(s.fee_paid_ugx)} · {formatDateShort(s.reg_date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEditStudent(s)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onViewStudent(s.student_id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#13345E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0B1F3A]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Full Record
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
