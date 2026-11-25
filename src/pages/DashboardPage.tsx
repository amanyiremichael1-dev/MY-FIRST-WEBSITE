import { useEffect, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileBarChart2,
  FileSpreadsheet,
  GraduationCap,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { StatusLabel } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';
import { formatDateShort } from '../lib/exports';
import type { DashboardData, UserRole } from '../types';

export type NavView =
  | 'dashboard'
  | 'register'
  | 'students'
  | 'search'
  | 'courses'
  | 'sessions'
  | 'reports'
  | 'users';

interface DashboardPageProps {
  userRole: UserRole;
  onNavigate: (view: NavView) => void;
  onViewStudent: (studentId: string) => void;
}

export function DashboardPage({
  userRole,
  onNavigate,
  onViewStudent,
}: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<DashboardData>('/api/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Dashboard statistics are currently unavailable.'}
      </div>
    );
  }

  const { stats, registrationsByCourse, genderStats, recentStudents, recentActivities } = data;
  const maxCourseTotal = Math.max(1, ...registrationsByCourse.map((c) => c.total));
  const maleCount = genderStats.find((g) => g.gender === 'Male')?.count || 0;
  const femaleCount = genderStats.find((g) => g.gender === 'Female')?.count || 0;
  const genderTotal = Math.max(1, maleCount + femaleCount);

  const canRegister = userRole === 'Administrator' || userRole === 'Registration Officer';

  const statCards = [
    {
      label: 'Total Registered Students',
      value: stats.totalStudents,
      sub: 'Active candidate profiles',
      icon: GraduationCap,
      accent: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'UVTAB Exam Registrations',
      value: stats.totalRegistrations,
      sub: `${stats.submittedRegistrations} marked submitted`,
      icon: FileSpreadsheet,
      accent: 'text-[#13345E] bg-slate-100',
    },
    {
      label: 'Available Courses',
      value: stats.totalCourses,
      sub: 'Accredited vocational trades',
      icon: BookOpen,
      accent: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'Examination Sessions',
      value: stats.totalSessions,
      sub: 'Configured UVTAB series',
      icon: CalendarDays,
      accent: 'text-[#13345E] bg-slate-100',
    },
    {
      label: 'Pending Registrations',
      value: stats.pendingRegistrations,
      sub: 'Awaiting clearance / completion',
      icon: Clock,
      accent: 'text-amber-700 bg-amber-50',
    },
    {
      label: 'Completed Registrations',
      value: stats.completedRegistrations,
      sub: 'Ready for UVTAB submission',
      icon: CheckCircle2,
      accent: 'text-emerald-700 bg-emerald-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 6 Dynamic Statistic Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 font-mono-tabular">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Registration Distribution by Course
              </h2>
              <p className="text-xs text-slate-500">
                Live breakdown of finalized versus pending UVTAB candidates per trade
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#13345E]" />
                Finalized (Completed / Submitted)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                Pending
              </span>
            </div>
          </div>

          {registrationsByCourse.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No course registrations recorded yet.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {registrationsByCourse.map((row) => {
                const totalWidth = Math.round((row.total / maxCourseTotal) * 100);
                const finalizedWidth =
                  row.total > 0 ? Math.round((row.finalized / row.total) * 100) : 0;
                const pendingWidth =
                  row.total > 0 ? Math.round((row.pending / row.total) * 100) : 0;

                return (
                  <div key={row.course_code} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="font-medium text-slate-800 truncate">
                        <span className="font-mono-tabular text-slate-500 mr-2">
                          {row.course_code}
                        </span>
                        {row.course_name}
                      </span>
                      <span className="font-mono-tabular font-semibold text-slate-900 whitespace-nowrap shrink-0">
                        {row.total} {row.total === 1 ? 'student' : 'students'}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-md bg-slate-100 overflow-hidden">
                      <div
                        className="h-full flex"
                        style={{ width: `${Math.max(row.total > 0 ? 6 : 0, totalWidth)}%` }}
                      >
                        {row.finalized > 0 && (
                          <div
                            className="h-full bg-[#13345E]"
                            style={{ width: `${finalizedWidth}%` }}
                            title={`Finalized: ${row.finalized}`}
                          />
                        )}
                        {row.pending > 0 && (
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${pendingWidth}%` }}
                            title={`Pending: ${row.pending}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Gender Balance Bar */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-700">Candidate Gender Distribution</span>
              <div className="flex items-center gap-4 font-mono-tabular text-slate-600">
                <span>Male: {maleCount}</span>
                <span aria-hidden="true">·</span>
                <span>Female: {femaleCount}</span>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-md bg-slate-100 overflow-hidden flex">
              <div
                className="bg-blue-700 h-full"
                style={{ width: `${(maleCount / genderTotal) * 100}%` }}
              />
              <div
                className="bg-sky-400 h-full"
                style={{ width: `${(femaleCount / genderTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions & Institutional Notice */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
              Quick Actions
            </h2>
            <div className="mt-4 space-y-2.5">
              {canRegister && (
                <button
                  type="button"
                  onClick={() => onNavigate('register')}
                  className="flex w-full items-center justify-between rounded-lg bg-[#13345E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B1F3A] transition-colors"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <UserPlus className="h-4 w-4" />
                    Register New Student
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('students')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-blue-700" />
                  Manage Student Records
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('search')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Search className="h-4 w-4 text-blue-700" />
                  Search &amp; Retrieve Student
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <FileBarChart2 className="h-4 w-4 text-blue-700" />
                  Generate UVTAB Reports
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('sessions')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 text-blue-700" />
                  View Exam Sessions
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-900 mb-1">
              UVTAB Registration Workflow Note
            </p>
            <p>
              Statuses (Pending, Completed, Submitted, Cancelled) track Alliance Vocational School&apos;s internal candidate clearance before official board submission.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Registrations + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Recent Student Registrations
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              View All Records
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No recent registrations found.
                    </td>
                  </tr>
                ) : (
                  recentStudents.map((s) => (
                    <tr key={s.student_id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {s.student_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.full_name}</div>
                        <div className="text-xs font-mono-tabular text-slate-500">
                          {s.reg_number}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <span className="font-mono-tabular text-slate-500 mr-1">
                          {s.course_code}
                        </span>
                        {s.course_name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onViewStudent(s.student_id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Recent System Activities
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivities.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                No recent system activities logged.
              </p>
            ) : (
              recentActivities.map((act) => (
                <div key={act.log_id} className="px-6 py-3.5 text-sm">
                  <p className="font-medium text-slate-900">{act.action}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{act.username}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{formatDateShort(act.log_time)}</span>
                    {act.details && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{act.details}</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
