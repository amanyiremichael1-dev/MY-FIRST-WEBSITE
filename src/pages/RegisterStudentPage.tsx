import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, Save, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatUgx } from '../lib/exports';
import type {
  Course,
  ExamSession,
  RegistrationStatus,
  StudentRecord,
  SystemSettings,
} from '../types';

const UGANDA_DISTRICTS = [
  'Ibanda',
  'Mbarara',
  'Kiruhura',
  'Kazo',
  'Kamwenge',
  'Bushenyi',
  'Buhweju',
  'Ntungamo',
  'Isingiro',
  'Rubirizi',
  'Mitooma',
  'Sheema',
  'Rukungiri',
  'Kabale',
  'Fort Portal',
  'Kampala',
];

interface RegisterStudentPageProps {
  editingStudent: StudentRecord | null;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

export function RegisterStudentPage({
  editingStudent,
  onSuccess,
  onCancel,
}: RegisterStudentPageProps) {
  const isEditMode = Boolean(editingStudent);

  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [studentIdPreview, setStudentIdPreview] = useState('AVS-2026-0001');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('Ibanda');
  const [address, setAddress] = useState('');

  const [courseId, setCourseId] = useState<number>(0);
  const [yearOfStudy, setYearOfStudy] = useState('Year 1');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [regNumber, setRegNumber] = useState('');
  const [examLevel, setExamLevel] = useState('Level 1 (Year 1)');

  const [sessionId, setSessionId] = useState<number>(0);
  const [assessmentProgramme, setAssessmentProgramme] = useState('');
  const [assessmentYear, setAssessmentYear] = useState<number>(2026);
  const [regDate, setRegDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [examFeeUgx, setExamFeeUgx] = useState<number>(0);
  const [feePaidUgx, setFeePaidUgx] = useState<number>(0);
  const [status, setStatus] = useState<RegistrationStatus>('Pending');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingLookups(true);
    Promise.all([
      apiRequest<{ courses: Course[] }>('/api/courses'),
      apiRequest<{ sessions: ExamSession[] }>('/api/sessions'),
      apiRequest<{ settings: SystemSettings }>('/api/settings'),
      apiRequest<{ student_id: string }>('/api/students/next-id?year=2026'),
    ])
      .then(([coursesRes, sessionsRes, settingsRes, nextIdRes]) => {
        if (!active) return;
        setCourses(coursesRes.courses);
        setSessions(sessionsRes.sessions);
        setSettings(settingsRes.settings);

        if (editingStudent) {
          setStudentIdPreview(editingStudent.student_id);
          setFullName(editingStudent.full_name);
          setGender(editingStudent.gender);
          setDob(editingStudent.dob);
          setPhone(editingStudent.phone);
          setEmail(editingStudent.email || '');
          setDistrict(editingStudent.district);
          setAddress(editingStudent.address);
          setCourseId(editingStudent.course_id);
          setYearOfStudy(editingStudent.year_of_study);
          setAcademicYear(editingStudent.academic_year);
          setRegNumber(editingStudent.reg_number);
          setExamLevel(editingStudent.exam_level);
          setSessionId(
            editingStudent.session_id || sessionsRes.sessions[0]?.session_id || 0
          );
          setAssessmentProgramme(
            editingStudent.assessment_programme ||
              settingsRes.settings.assessment_programmes[0] ||
              ''
          );
          setAssessmentYear(
            editingStudent.assessment_year ||
              sessionsRes.sessions[0]?.assessment_year ||
              2026
          );
          setRegDate(
            editingStudent.reg_date || new Date().toISOString().slice(0, 10)
          );
          setExamFeeUgx(editingStudent.exam_fee_ugx || 0);
          setFeePaidUgx(editingStudent.fee_paid_ugx || 0);
          setStatus(editingStudent.registration_status || 'Pending');
          setNotes(editingStudent.notes || '');
        } else {
          setStudentIdPreview(nextIdRes.student_id);
          const firstCourse = coursesRes.courses.find((c) => c.is_active === 1) || coursesRes.courses[0];
          if (firstCourse) {
            setCourseId(firstCourse.course_id);
            setExamFeeUgx(firstCourse.fee_ugx);
          }
          const openSession =
            sessionsRes.sessions.find((s) => s.status === 'Open') ||
            sessionsRes.sessions[0];
          if (openSession) {
            setSessionId(openSession.session_id);
            setAssessmentYear(openSession.assessment_year);
            setAssessmentProgramme(openSession.assessment_programme);
          } else if (settingsRes.settings.assessment_programmes[0]) {
            setAssessmentProgramme(settingsRes.settings.assessment_programmes[0]);
          }
          if (settingsRes.settings.academic_years[0]) {
            setAcademicYear(
              settingsRes.settings.academic_years[
                settingsRes.settings.academic_years.length - 1
              ]
            );
          }
          if (settingsRes.settings.exam_levels[0]) {
            setExamLevel(settingsRes.settings.exam_levels[0]);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load registration options.');
        }
      })
      .finally(() => {
        if (active) setLoadingLookups(false);
      });

    return () => {
      active = false;
    };
  }, [editingStudent]);

  useEffect(() => {
    if (isEditMode) return;
    apiRequest<{ student_id: string }>(`/api/students/next-id?year=${assessmentYear}`)
      .then((res) => setStudentIdPreview(res.student_id))
      .catch(() => {});
  }, [assessmentYear, isEditMode]);

  const selectedCourse = courses.find((c) => c.course_id === courseId);

  function handleCourseChange(newCourseId: number) {
    setCourseId(newCourseId);
    const found = courses.find((c) => c.course_id === newCourseId);
    if (found && !isEditMode) {
      setExamFeeUgx(found.fee_ugx);
    }
  }

  function handleSessionChange(newSessionId: number) {
    setSessionId(newSessionId);
    const found = sessions.find((s) => s.session_id === newSessionId);
    if (found) {
      setAssessmentYear(found.assessment_year);
      setAssessmentProgramme(found.assessment_programme);
    }
  }

  function handleClearForm() {
    setError('');
    setFullName('');
    setGender('Male');
    setDob('');
    setPhone('');
    setEmail('');
    setDistrict('Ibanda');
    setAddress('');
    setRegNumber('');
    setFeePaidUgx(0);
    setStatus('Pending');
    setNotes('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !dob || !phone.trim() || !district.trim() || !address.trim()) {
      setError('Please complete all required personal information fields.');
      return;
    }
    if (!courseId || !regNumber.trim() || !sessionId || !assessmentProgramme.trim()) {
      setError('Please complete all required academic and UVTAB examination fields.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        gender,
        dob,
        phone: phone.trim(),
        email: email.trim(),
        district: district.trim(),
        address: address.trim(),
        course_id: courseId,
        year_of_study: yearOfStudy,
        academic_year: academicYear,
        reg_number: regNumber.trim().toUpperCase(),
        exam_level: examLevel,
        session_id: sessionId,
        assessment_programme: assessmentProgramme.trim(),
        assessment_year: assessmentYear,
        reg_date: regDate,
        exam_fee_ugx: examFeeUgx,
        fee_paid_ugx: feePaidUgx,
        status,
        notes: notes.trim(),
        reg_id: editingStudent?.reg_id,
      };

      if (isEditMode && editingStudent) {
        const res = await apiRequest<{ message: string }>(
          `/api/students/${encodeURIComponent(editingStudent.student_id)}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        onSuccess(res.message);
      } else {
        const res = await apiRequest<{ message: string }>('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save registration.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingLookups) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 space-y-4">
        <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-48 w-full animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const programmes = settings?.assessment_programmes || [
    'UVTAB National Certificate (Full Assessment)',
    'UVTAB Modular Assessment',
    'Configurable Assessment Programme',
  ];
  const examLevels = settings?.exam_levels || [
    'Level 1 (Year 1)',
    'Level 2 (Year 2)',
    'Modular Assessment',
  ];
  const academicYears = settings?.academic_years || ['2025/2026', '2026/2027'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isEditMode
              ? `Edit Student Registration — ${editingStudent?.student_id}`
              : 'New UVTAB Student Registration'}
          </h2>
          <p className="text-xs text-slate-500">
            Fields marked with * are required. Duplicate UVTAB registration numbers are automatically rejected.
          </p>
        </div>
        <div className="text-right">
          <span className="block text-xs font-medium text-slate-500">
            {isEditMode ? 'Assigned Student ID' : 'Auto-Generated Student ID'}
          </span>
          <span className="font-mono-tabular text-base font-bold text-[#13345E]">
            {studentIdPreview}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Section 1: Personal Information */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            01. Personal Information
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Tumwine Brian"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Gender *
            </label>
            <select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value as 'Male' | 'Female')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Date of Birth *
            </label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Telephone Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0772418920"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.ug"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Home District *
            </label>
            <input
              type="text"
              required
              list="uganda-districts"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Ibanda"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
            <datalist id="uganda-districts">
              {UGANDA_DISTRICTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Village or Address *
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Kagongo Division, Ibanda Municipality"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Academic Information */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            02. Academic Information
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Course / Programme *
            </label>
            <select
              required
              value={courseId}
              onChange={(e) => handleCourseChange(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value={0} disabled>
                Select a trade course...
              </option>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  [{c.course_code}] {c.course_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Department (Auto-Assigned)
            </label>
            <input
              type="text"
              readOnly
              value={selectedCourse?.dept_name || 'Unassigned'}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Year of Study *
            </label>
            <select
              required
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="Year 1">Year 1</option>
              <option value="Year 2">Year 2</option>
              <option value="Modular">Modular</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Academic Year *
            </label>
            <select
              required
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
            >
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              UVTAB Registration Number *
            </label>
            <input
              type="text"
              required
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
              placeholder="e.g. UVT/IBD/26/0045"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular uppercase focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Examination Level *
            </label>
            <select
              required
              value={examLevel}
              onChange={(e) => setExamLevel(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              {examLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 3: UVTAB Examination Information */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            03. UVTAB Examination Information
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Statuses record Alliance Vocational School&apos;s internal registration readiness prior to board submission.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Examination Session *
            </label>
            <select
              required
              value={sessionId}
              onChange={(e) => handleSessionChange(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value={0} disabled>
                Select examination session...
              </option>
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.session_name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Assessment Programme (Configurable) *
            </label>
            <input
              type="text"
              required
              list="assessment-programmes-list"
              value={assessmentProgramme}
              onChange={(e) => setAssessmentProgramme(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
            <datalist id="assessment-programmes-list">
              {programmes.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Assessment Year *
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
              Registration Date *
            </label>
            <input
              type="date"
              required
              value={regDate}
              onChange={(e) => setRegDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Registration Status *
            </label>
            <select
              required
              value={status}
              onChange={(e) => setStatus(e.target.value as RegistrationStatus)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Submitted">Submitted</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Assessment Fee (UGX)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={examFeeUgx}
              onChange={(e) => setExamFeeUgx(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Fee Paid (UGX)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={feePaidUgx}
              onChange={(e) => setFeePaidUgx(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
            />
            <p className="mt-1 text-xs font-mono-tabular text-slate-500">
              Balance: {formatUgx(Math.max(0, examFeeUgx - feePaidUgx))}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Remarks / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional verification remark"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Form Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        {!isEditMode && (
          <button
            type="button"
            onClick={handleClearForm}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Clear Form
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#13345E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B1F3A] disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Save className="h-4 w-4" />
          {submitting
            ? 'Saving...'
            : isEditMode
            ? 'Update Registration'
            : 'Save Registration'}
        </button>
      </div>
    </form>
  );
}
