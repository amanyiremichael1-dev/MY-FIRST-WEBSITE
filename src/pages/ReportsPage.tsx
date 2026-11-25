import { useCallback, useEffect, useState } from 'react';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { SchoolCrest } from '../components/SchoolCrest';
import { StatusLabel } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';
import {
  exportReportToExcel,
  exportReportToPdf,
  formatDateShort,
  formatUgx,
} from '../lib/exports';
import type { Course, ExamSession, SystemSettings } from '../types';

type ReportType =
  | 'complete'
  | 'by_course'
  | 'by_session'
  | 'by_academic_year'
  | 'gender_stats'
  | 'pending'
  | 'completed';

const REPORT_TYPES: Array<{ id: ReportType; label: string }> = [
  { id: 'complete', label: '1. Complete Student Registration Report' },
  { id: 'by_course', label: '2. Students Registered per Course' },
  { id: 'by_session', label: '3. Students Registered per Exam Session' },
  { id: 'by_academic_year', label: '4. Students Registered per Academic Year' },
  { id: 'gender_stats', label: '5. Male & Female Registration Statistics' },
  { id: 'pending', label: '6. Pending Registration Report' },
  { id: 'completed', label: '7. Completed Registration Report' },
];

interface ReportRow {
  reg_id: number;
  student_id: string;
  full_name: string;
  gender: string;
  phone: string;
  district: string;
  reg_number: string;
  academic_year: string;
  year_of_study: string;
  exam_level: string;
  course_code: string;
  course_name: string;
  session_name: string;
  assessment_programme: string;
  reg_date: string;
  exam_fee_ugx: number;
  fee_paid_ugx: number;
  status: string;
}

interface ReportResponse {
  reportType: ReportType;
  generatedAt: string;
  totalRecords: number;
  totalFeesExpected: number;
  totalFeesPaid: number;
  groupedSummary: Array<Record<string, unknown>>;
  rows: ReportRow[];
}

interface ReportsPageProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function ReportsPage({ onNotify }: ReportsPageProps) {
  const [reportType, setReportType] = useState<ReportType>('complete');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [courseId, setCourseId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (courseId) params.set('courseId', courseId);
      if (sessionId) params.set('sessionId', sessionId);
      if (academicYear) params.set('academicYear', academicYear);

      const res = await apiRequest<ReportResponse>(`/api/reports?${params.toString()}`);
      setReport(res);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to generate report.');
    } finally {
      setLoading(false);
    }
  }, [reportType, startDate, endDate, courseId, sessionId, academicYear, onNotify]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const currentTypeLabel =
    REPORT_TYPES.find((r) => r.id === reportType)?.label || 'Registration Report';

  const filterSummaryParts: string[] = [];
  if (courseId) {
    const c = courses.find((x) => String(x.course_id) === courseId);
    if (c) filterSummaryParts.push(`Course: ${c.course_code}`);
  }
  if (sessionId) {
    const s = sessions.find((x) => String(x.session_id) === sessionId);
    if (s) filterSummaryParts.push(`Session: ${s.session_name}`);
  }
  if (academicYear) filterSummaryParts.push(`Academic Year: ${academicYear}`);
  if (startDate || endDate) {
    filterSummaryParts.push(`Date: ${startDate || '...'} to ${endDate || '...'}`);
  }
  const filterSummary =
    filterSummaryParts.length > 0 ? filterSummaryParts.join(' | ') : 'All Records';

  function buildExportPayload() {
    if (!report) return null;
    const isGrouped =
      ['by_course', 'by_session', 'by_academic_year', 'gender_stats'].includes(
        reportType
      ) && report.groupedSummary.length > 0;

    if (isGrouped) {
      const keys = Object.keys(report.groupedSummary[0]);
      const columns = keys.map((k) =>
        k
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (ch) => ch.toUpperCase())
      );
      const rows = report.groupedSummary.map((item) =>
        keys.map((k) => {
          const val = item[k];
          return typeof val === 'number' ? val : String(val ?? '');
        })
      );
      return {
        reportTitle: currentTypeLabel,
        filterSummary,
        generatedAt: report.generatedAt,
        columns,
        rows,
        filenameBase: `avs_uvtab_${reportType}_${new Date().toISOString().slice(0, 10)}`,
      };
    }

    return {
      reportTitle: currentTypeLabel,
      filterSummary,
      generatedAt: report.generatedAt,
      columns: [
        'Student ID',
        'Full Name',
        'Gender',
        'Reg Number',
        'Course',
        'Level',
        'Session',
        'Reg Date',
        'Paid (UGX)',
        'Status',
      ],
      rows: report.rows.map((r) => [
        r.student_id,
        r.full_name,
        r.gender,
        r.reg_number,
        `${r.course_code} - ${r.course_name}`,
        r.exam_level,
        r.session_name,
        r.reg_date,
        r.fee_paid_ugx,
        r.status,
      ]),
      filenameBase: `avs_uvtab_${reportType}_${new Date().toISOString().slice(0, 10)}`,
    };
  }

  function handleExportPdf() {
    const payload = buildExportPayload();
    if (!payload) return;
    exportReportToPdf(payload);
    onNotify('success', 'PDF report downloaded.');
  }

  function handleExportExcel() {
    const payload = buildExportPayload();
    if (!payload) return;
    exportReportToExcel(payload);
    onNotify('success', 'Excel report downloaded.');
  }

  const isGroupedReport = ['by_course', 'by_session', 'by_academic_year', 'gender_stats'].includes(
    reportType
  );

  return (
    <div className="space-y-6">
      {/* Controls & Filters (hidden on print) */}
      <div className="no-print rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              UVTAB Registration Reports &amp; Exports
            </h2>
            <p className="text-xs text-slate-500">
              Select a report template and filter criteria, then print or export to PDF / Excel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!report}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!report}
              className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B1F3A] whitespace-nowrap shrink-0"
            >
              <FileDown className="h-4 w-4" />
              Export to PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!report}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export to Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:border-blue-600 focus:outline-none"
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Course Filter
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.course_code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Session Filter
            </label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.session_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((y) => (
                <option key={y} value={y}>
                  Academic Year: {y}
                </option>
              ))}
            </select>
          </div>
          {(startDate || endDate || courseId || sessionId || academicYear) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setCourseId('');
                setSessionId('');
                setAcademicYear('');
              }}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Printable Institutional Report Sheet */}
      <div className="print-sheet rounded-xl border border-slate-200 bg-white p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#0B1F3A] pb-5">
          <div className="flex items-center gap-4">
            <SchoolCrest className="h-14 w-14 shrink-0" />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#0B1F3A]">
                ALLIANCE VOCATIONAL SCHOOL – IBANDA
              </h1>
              <p className="text-sm font-bold text-[#13345E]">
                UVTAB STUDENT REGISTRATION REPORT
              </p>
              <p className="mt-1 text-xs text-slate-600">{currentTypeLabel}</p>
            </div>
          </div>

          <div className="text-right text-xs text-slate-600 space-y-1">
            <p>
              <span className="font-semibold text-slate-800">Report Date:</span>{' '}
              <span className="font-mono-tabular">
                {report
                  ? new Date(report.generatedAt).toLocaleString('en-UG')
                  : new Date().toLocaleString('en-UG')}
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-800">Scope:</span> {filterSummary}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Generating report data...
          </div>
        ) : !report ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No report data available.
          </div>
        ) : (
          <>
            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Total Matching Registrations</p>
                <p className="mt-1 text-xl font-bold text-slate-900 font-mono-tabular">
                  {report.totalRecords}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Total Assessment Fees Assessed</p>
                <p className="mt-1 text-xl font-bold text-slate-900 font-mono-tabular">
                  {formatUgx(report.totalFeesExpected)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Total Assessment Fees Paid</p>
                <p className="mt-1 text-xl font-bold text-emerald-700 font-mono-tabular">
                  {formatUgx(report.totalFeesPaid)}
                </p>
              </div>
            </div>

            {/* Grouped Summary Table for aggregated reports */}
            {isGroupedReport && report.groupedSummary.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#13345E] text-white text-xs font-semibold">
                    <tr>
                      {Object.keys(report.groupedSummary[0]).map((key) => (
                        <th key={key} className="px-4 py-3 capitalize">
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.groupedSummary.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {Object.entries(row).map(([key, val]) => (
                          <td
                            key={key}
                            className={`px-4 py-2.5 text-xs ${
                              typeof val === 'number'
                                ? 'font-mono-tabular font-semibold text-slate-900'
                                : 'text-slate-800 font-medium'
                            }`}
                          >
                            {key.includes('ugx')
                              ? formatUgx(Number(val))
                              : String(val ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Detailed Student Listing */}
            <div className="space-y-2">
              {isGroupedReport && (
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Underlying Candidate Schedule
                </h3>
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Student ID</th>
                      <th className="px-3 py-2.5">Full Name</th>
                      <th className="px-3 py-2.5">Gender</th>
                      <th className="px-3 py-2.5">Reg Number</th>
                      <th className="px-3 py-2.5">Course</th>
                      <th className="px-3 py-2.5">Exam Session</th>
                      <th className="px-3 py-2.5">Reg Date</th>
                      <th className="px-3 py-2.5 text-right">Fee Paid</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                          No registrations match the selected report filters.
                        </td>
                      </tr>
                    ) : (
                      report.rows.map((r) => (
                        <tr key={r.reg_id}>
                          <td className="px-3 py-2 font-mono-tabular font-semibold text-slate-800 whitespace-nowrap">
                            {r.student_id}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                            {r.full_name}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{r.gender}</td>
                          <td className="px-3 py-2 font-mono-tabular text-blue-700 whitespace-nowrap">
                            {r.reg_number}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {r.course_code} — {r.course_name}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{r.session_name}</td>
                          <td className="px-3 py-2 font-mono-tabular text-slate-600 whitespace-nowrap">
                            {formatDateShort(r.reg_date)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono-tabular text-slate-900 whitespace-nowrap">
                            {formatUgx(r.fee_paid_ugx)}
                          </td>
                          <td className="px-3 py-2">
                            <StatusLabel status={r.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
