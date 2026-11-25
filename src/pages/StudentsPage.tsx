import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { StatusLabel } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';
import { exportRecordsToCsv } from '../lib/exports';
import type { Course, ExamSession, StudentRecord, SystemSettings, UserRole } from '../types';

interface StudentsPageProps {
  userRole: UserRole;
  onAddStudent: () => void;
  onViewStudent: (studentId: string) => void;
  onEditStudent: (student: StudentRecord) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function StudentsPage({
  userRole,
  onAddStudent,
  onViewStudent,
  onEditStudent,
  onNotify,
}: StudentsPageProps) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = userRole === 'Administrator' || userRole === 'Registration Officer';
  const canDelete = userRole === 'Administrator';

  useEffect(() => {
    Promise.all([
      apiRequest<{ courses: Course[] }>('/api/courses'),
      apiRequest<{ sessions: ExamSession[] }>('/api/sessions'),
      apiRequest<{ settings: SystemSettings }>('/api/settings'),
    ])
      .then(([cRes, sRes, stRes]) => {
        setCourses(cRes.courses);
        setSessions(sRes.sessions);
        setAcademicYears(stRes.settings.academic_years || []);
      })
      .catch(() => {});
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set('search', search.trim());
      if (courseId) params.set('courseId', courseId);
      if (academicYear) params.set('academicYear', academicYear);
      if (sessionId) params.set('sessionId', sessionId);
      if (status) params.set('status', status);

      const res = await apiRequest<{
        students: StudentRecord[];
        total: number;
        totalPages: number;
      }>(`/api/students?${params.toString()}`);

      setStudents(res.students);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'Unable to load student records.'
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, courseId, academicYear, sessionId, status, onNotify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadStudents]);

  async function handleExportCsv() {
    try {
      const params = new URLSearchParams({ export: 'all' });
      if (search.trim()) params.set('search', search.trim());
      if (courseId) params.set('courseId', courseId);
      if (academicYear) params.set('academicYear', academicYear);
      if (sessionId) params.set('sessionId', sessionId);
      if (status) params.set('status', status);

      const res = await apiRequest<{ students: StudentRecord[] }>(
        `/api/students?${params.toString()}`
      );
      exportRecordsToCsv(
        [
          'Student ID',
          'Full Name',
          'Registration Number',
          'Gender',
          'Phone',
          'District',
          'Course',
          'Exam Level',
          'Academic Year',
          'Exam Session',
          'Status',
        ],
        res.students.map((s) => [
          s.student_id,
          s.full_name,
          s.reg_number,
          s.gender,
          s.phone,
          s.district,
          s.course_name || '',
          s.exam_level,
          s.academic_year,
          s.session_name || '',
          s.registration_status || 'Pending',
        ]),
        `avs_student_records_${new Date().toISOString().slice(0, 10)}`
      );
      onNotify('success', `Exported ${res.students.length} student records to CSV.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Export failed.');
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/students/${encodeURIComponent(deleteTarget.student_id)}`,
        { method: 'DELETE' }
      );
      onNotify('success', res.message);
      setDeleteTarget(null);
      loadStudents();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to delete student.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter & Actions Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Student Records Registry</h2>
            <p className="text-xs text-slate-500 font-mono-tabular">
              Showing {students.length} of {total} registered student records
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              Export Records
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={onAddStudent}
                className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B1F3A] whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                Register Student
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Name or Reg Number..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </select>

          <select
            value={academicYear}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Academic Years</option>
            {academicYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Exam Sessions</option>
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Submitted">Submitted</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Reg Number</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Exam Level</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={9} className="px-4 py-3.5">
                      <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      No matching student records found.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Adjust your search query or filters, or register a new candidate.
                    </p>
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {s.student_id}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {s.full_name}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-blue-700 font-medium whitespace-nowrap">
                      {s.reg_number}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.gender}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[220px] truncate" title={s.course_name}>
                      <span className="font-mono-tabular text-slate-500 mr-1.5">
                        {s.course_code}
                      </span>
                      {s.course_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {s.exam_level}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-slate-700 whitespace-nowrap">
                      {s.academic_year}
                    </td>
                    <td className="px-4 py-3">
                      <StatusLabel status={s.registration_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewStudent(s.student_id)}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          title="View full record"
                          aria-label={`View ${s.full_name}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEditStudent(s)}
                            className="rounded-md border border-slate-200 p-1.5 text-blue-700 hover:bg-blue-50"
                            title="Edit record"
                            aria-label={`Edit ${s.full_name}`}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(s)}
                            className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                            title="Delete record"
                            aria-label={`Delete ${s.full_name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono-tabular">
              Page {page} of {totalPages}
            </span>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-300 bg-white p-1.5 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-slate-300 bg-white p-1.5 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Student Registration Record"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete ${deleteTarget.full_name} (${deleteTarget.student_id} / ${deleteTarget.reg_number})? This will also remove all associated UVTAB registration entries.`
            : ''
        }
        isLoading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
