import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, Edit3, Plus, Trash2, X } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { apiRequest } from '../lib/api';
import { formatUgx } from '../lib/exports';
import type { Course, Department, UserRole } from '../types';

interface CoursesPageProps {
  userRole: UserRole;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function CoursesPage({ userRole, onNotify }: CoursesPageProps) {
  const isAdmin = userRole === 'Administrator';

  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Course modal/form state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [deptId, setDeptId] = useState<string>('');
  const [durationYears, setDurationYears] = useState<number>(2);
  const [feeUgx, setFeeUgx] = useState<number>(130000);
  const [isActive, setIsActive] = useState<number>(1);
  const [savingCourse, setSavingCourse] = useState(false);

  // Department inline add
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  // Confirm delete
  const [deleteCourseTarget, setDeleteCourseTarget] = useState<Course | null>(null);
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        apiRequest<{ courses: Course[] }>('/api/courses'),
        apiRequest<{ departments: Department[] }>('/api/departments'),
      ]);
      setCourses(cRes.courses);
      setDepartments(dRes.departments);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNewCourse() {
    setEditingCourse(null);
    setCourseName('');
    setCourseCode('');
    setDeptId(departments[0] ? String(departments[0].dept_id) : '');
    setDurationYears(2);
    setFeeUgx(135000);
    setIsActive(1);
    setShowCourseForm(true);
  }

  function openEditCourse(c: Course) {
    setEditingCourse(c);
    setCourseName(c.course_name);
    setCourseCode(c.course_code);
    setDeptId(c.dept_id ? String(c.dept_id) : '');
    setDurationYears(c.duration_years);
    setFeeUgx(c.fee_ugx);
    setIsActive(c.is_active);
    setShowCourseForm(true);
  }

  async function handleSaveCourse(e: FormEvent) {
    e.preventDefault();
    setSavingCourse(true);
    try {
      const payload = {
        course_name: courseName.trim(),
        course_code: courseCode.trim().toUpperCase(),
        dept_id: deptId ? Number(deptId) : null,
        duration_years: durationYears,
        fee_ugx: feeUgx,
        is_active: isActive,
      };
      if (editingCourse) {
        await apiRequest(`/api/courses/${editingCourse.course_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Course "${courseName}" updated successfully.`);
      } else {
        await apiRequest('/api/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Course "${courseName}" added successfully.`);
      }
      setShowCourseForm(false);
      loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save course.');
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleAddDepartment(e: FormEvent) {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) return;
    setSavingDept(true);
    try {
      await apiRequest('/api/departments', {
        method: 'POST',
        body: JSON.stringify({
          dept_name: deptName.trim(),
          dept_code: deptCode.trim().toUpperCase(),
        }),
      });
      onNotify('success', `Department "${deptName}" added.`);
      setDeptName('');
      setDeptCode('');
      loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to add department.');
    } finally {
      setSavingDept(false);
    }
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    try {
      if (deleteCourseTarget) {
        await apiRequest(`/api/courses/${deleteCourseTarget.course_id}`, {
          method: 'DELETE',
        });
        onNotify('success', `Course "${deleteCourseTarget.course_name}" deleted.`);
        setDeleteCourseTarget(null);
      } else if (deleteDeptTarget) {
        await apiRequest(`/api/departments/${deleteDeptTarget.dept_id}`, {
          method: 'DELETE',
        });
        onNotify('success', `Department "${deleteDeptTarget.dept_name}" deleted.`);
        setDeleteDeptTarget(null);
      }
      loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Courses Section */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Vocational Courses &amp; Programmes
            </h2>
            <p className="text-xs text-slate-500">
              Manage accredited trade courses, codes, departmental links, and standard UVTAB assessment fees (UGX).
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={openNewCourse}
              className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B1F3A] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Course
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Course / Programme Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Exam Fee (UGX)</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                    Loading courses...
                  </td>
                </tr>
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                    No courses configured yet.
                  </td>
                </tr>
              ) : (
                courses.map((c) => (
                  <tr key={c.course_id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono-tabular text-xs font-bold text-[#13345E] whitespace-nowrap">
                      {c.course_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.course_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.dept_name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono-tabular text-slate-700">
                      {c.duration_years} {c.duration_years === 1 ? 'Year' : 'Years'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono-tabular text-slate-800">
                      {formatUgx(c.fee_ugx)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono-tabular font-semibold text-slate-900">
                      {c.student_count || 0}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {c.is_active === 1 ? (
                        <span className="text-emerald-700">Active</span>
                      ) : (
                        <span className="text-slate-500">Inactive</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditCourse(c)}
                            className="rounded-md border border-slate-200 p-1.5 text-blue-700 hover:bg-blue-50"
                            title="Edit course"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCourseTarget(c)}
                            className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                            title="Delete course"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Departments Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-[#13345E]" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Academic Departments</h3>
              <p className="text-xs text-slate-500">
                Organize courses under official school departments.
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <form onSubmit={handleAddDepartment} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <input
                type="text"
                required
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Department Name (e.g. Agriculture & Agribusiness)"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3">
              <input
                type="text"
                required
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                placeholder="Code (e.g. DAG)"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular uppercase focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={savingDept}
                className="w-full rounded-lg bg-[#13345E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50"
              >
                {savingDept ? 'Adding...' : 'Add Department'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <div
              key={d.dept_id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{d.dept_name}</p>
                <p className="text-xs text-slate-500 font-mono-tabular">
                  {d.dept_code} · {d.course_count || 0} courses
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setDeleteDeptTarget(d)}
                  className="ml-2 rounded-md p-1.5 text-red-600 hover:bg-red-50 shrink-0"
                  title="Delete department"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Course Modal */}
      {showCourseForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingCourse ? 'Edit Course' : 'Add New Course'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCourseForm(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Course / Programme Name *
                </label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. National Certificate in Plumbing"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                    placeholder="e.g. NCP-107"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular uppercase focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Department
                  </label>
                  <select
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.dept_id} value={d.dept_id}>
                        {d.dept_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Duration (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={durationYears}
                    onChange={(e) => setDurationYears(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Exam Fee (UGX)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={feeUgx}
                    onChange={(e) => setFeeUgx(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    value={isActive}
                    onChange={(e) => setIsActive(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="rounded-lg bg-[#13345E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50"
                >
                  {savingCourse ? 'Saving...' : editingCourse ? 'Update Course' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteCourseTarget || deleteDeptTarget)}
        title={deleteCourseTarget ? 'Delete Course' : 'Delete Department'}
        message={
          deleteCourseTarget
            ? `Delete "${deleteCourseTarget.course_name}" (${deleteCourseTarget.course_code})? Courses with enrolled students cannot be deleted.`
            : deleteDeptTarget
            ? `Delete department "${deleteDeptTarget.dept_name}"? Departments with linked courses cannot be deleted.`
            : ''
        }
        isLoading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => {
          setDeleteCourseTarget(null);
          setDeleteDeptTarget(null);
        }}
      />
    </div>
  );
}
