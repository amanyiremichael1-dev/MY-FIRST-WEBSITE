export type UserRole = 'Administrator' | 'Registration Officer' | 'School Staff';

export type RegistrationStatus = 'Pending' | 'Completed' | 'Submitted' | 'Cancelled';

export interface AuthUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  is_active: number;
  must_change_password: number;
}

export interface Department {
  dept_id: number;
  dept_name: string;
  dept_code: string;
  course_count?: number;
  created_at?: string;
}

export interface Course {
  course_id: number;
  course_name: string;
  course_code: string;
  dept_id: number | null;
  dept_name?: string;
  dept_code?: string;
  duration_years: number;
  fee_ugx: number;
  is_active: number;
  student_count?: number;
}

export interface ExamSession {
  session_id: number;
  session_name: string;
  assessment_programme: string;
  assessment_year: number;
  exam_levels: string;
  opening_date: string;
  closing_date: string;
  status: 'Open' | 'Closed';
  total_registered?: number;
  pending_count?: number;
  completed_count?: number;
  submitted_count?: number;
  cancelled_count?: number;
}

export interface StudentRecord {
  student_id: string;
  full_name: string;
  gender: 'Male' | 'Female';
  dob: string;
  phone: string;
  email: string | null;
  district: string;
  address: string;
  course_id: number;
  department_id: number | null;
  course_name?: string;
  course_code?: string;
  dept_name?: string;
  year_of_study: string;
  academic_year: string;
  reg_number: string;
  exam_level: string;
  reg_id?: number;
  session_id?: number;
  session_name?: string;
  assessment_programme?: string;
  assessment_year?: number;
  reg_date?: string;
  exam_fee_ugx?: number;
  fee_paid_ugx?: number;
  registration_status?: RegistrationStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardData {
  stats: {
    totalStudents: number;
    totalRegistrations: number;
    totalCourses: number;
    totalSessions: number;
    pendingRegistrations: number;
    completedRegistrations: number;
    submittedRegistrations: number;
    cancelledRegistrations: number;
  };
  registrationsByCourse: Array<{
    course_code: string;
    course_name: string;
    total: number;
    finalized: number;
    pending: number;
  }>;
  genderStats: Array<{ gender: string; count: number }>;
  statusStats: Array<{ status: string; count: number }>;
  recentStudents: Array<{
    student_id: string;
    full_name: string;
    reg_number: string;
    gender: string;
    academic_year: string;
    exam_level: string;
    course_name: string;
    course_code: string;
    reg_id: number;
    reg_date: string;
    status: RegistrationStatus;
    session_name: string;
  }>;
  recentActivities: Array<{
    log_id: number;
    username: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    details: string | null;
    log_time: string;
  }>;
}

export interface SystemSettings {
  institution_name: string;
  institution_location: string;
  currency_code: string;
  assessment_programmes: string[];
  exam_levels: string[];
  academic_years: string[];
}

export interface UserAccount {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  is_active: number;
  must_change_password: number;
  last_login: string | null;
  created_at: string;
}

export interface PasswordResetRequest {
  request_id: number;
  username: string;
  requested_by_note: string | null;
  status: 'Pending' | 'Resolved' | 'Rejected';
  created_at: string;
  resolved_at: string | null;
}
