import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'alliance_uvtab.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('Administrator', 'Registration Officer', 'School Staff')),
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    last_login TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS departments (
    dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_name TEXT NOT NULL UNIQUE,
    dept_code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_name TEXT NOT NULL,
    course_code TEXT NOT NULL UNIQUE,
    dept_id INTEGER REFERENCES departments(dept_id) ON DELETE SET NULL,
    duration_years INTEGER NOT NULL DEFAULT 2,
    fee_ugx INTEGER NOT NULL DEFAULT 130000,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exam_sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_name TEXT NOT NULL,
    assessment_programme TEXT NOT NULL,
    assessment_year INTEGER NOT NULL,
    exam_levels TEXT NOT NULL,
    opening_date TEXT NOT NULL,
    closing_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    dob TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    district TEXT NOT NULL,
    address TEXT NOT NULL,
    course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT,
    department_id INTEGER REFERENCES departments(dept_id) ON DELETE SET NULL,
    year_of_study TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    reg_number TEXT NOT NULL UNIQUE,
    exam_level TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS registrations (
    reg_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES exam_sessions(session_id) ON DELETE RESTRICT,
    assessment_programme TEXT NOT NULL,
    assessment_year INTEGER NOT NULL,
    reg_date TEXT NOT NULL,
    exam_fee_ugx INTEGER NOT NULL DEFAULT 0,
    fee_paid_ugx INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Submitted', 'Cancelled')),
    notes TEXT,
    registered_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    log_time TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_reset_requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    requested_by_note TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved', 'Rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_students_name ON students(full_name);
  CREATE INDEX IF NOT EXISTS idx_students_reg_number ON students(reg_number);
  CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
  CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year);
  CREATE INDEX IF NOT EXISTS idx_registrations_student ON registrations(student_id);
  CREATE INDEX IF NOT EXISTS idx_registrations_session ON registrations(session_id);
  CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
  CREATE INDEX IF NOT EXISTS idx_logs_time ON activity_logs(log_time);
`);

export function initializeDatabase(): void {
  // Sync configured env admin password override if provided
  const envAdminPass = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  if (envAdminPass) {
    const existingAdmin = db
      .prepare('SELECT user_id FROM users WHERE username = ?')
      .get('admin') as { user_id: number } | undefined;
    const hashed = hashPassword(envAdminPass);
    if (existingAdmin) {
      db.prepare(
        "UPDATE users SET password_hash = ?, is_active = 1, updated_at = datetime('now') WHERE user_id = ?"
      ).run(hashed, existingAdmin.user_id);
    } else {
      db.prepare(
        "INSERT INTO users (username, password_hash, full_name, email, role, is_active, must_change_password) VALUES (?, ?, ?, ?, 'Administrator', 1, 0)"
      ).run('admin', hashed, 'System Administrator', 'admin@alliancevocational.ac.ug');
    }
  }

  // Seed default system settings if missing
  const settingsCount = (
    db.prepare('SELECT COUNT(*) AS cnt FROM system_settings').get() as { cnt: number }
  ).cnt;

  if (settingsCount === 0) {
    const insertSetting = db.prepare(
      'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)'
    );
    insertSetting.run('institution_name', 'ALLIANCE VOCATIONAL SCHOOL – IBANDA');
    insertSetting.run('institution_location', 'Ibanda Municipality, Western Uganda');
    insertSetting.run('currency_code', 'UGX');
    insertSetting.run(
      'assessment_programmes',
      JSON.stringify([
        'UVTAB National Certificate (Full Assessment)',
        'UVTAB Modular Assessment',
        'UVTAB Community Polytechnic Certificate (CPC)',
        'UVTAB Uganda Community Polytechnic Trade Test (Level 1-3)',
        'Configurable Assessment Programme (Pending Official Circular)',
      ])
    );
    insertSetting.run(
      'exam_levels',
      JSON.stringify([
        'Level 1 (Year 1)',
        'Level 2 (Year 2)',
        'Modular Assessment',
        'Trade Test Grade III',
        'Trade Test Grade II',
      ])
    );
    insertSetting.run(
      'academic_years',
      JSON.stringify(['2024/2025', '2025/2026', '2026/2027'])
    );
  }

  // Seed realistic demonstration institutional data if empty
  const deptCount = (
    db.prepare('SELECT COUNT(*) AS cnt FROM departments').get() as { cnt: number }
  ).cnt;

  if (deptCount === 0) {
    db.exec('BEGIN TRANSACTION');
    try {
      const insertDept = db.prepare(
        'INSERT INTO departments (dept_name, dept_code) VALUES (?, ?)'
      );
      const d1 = Number(insertDept.run('Electrical & Electronics Engineering', 'DEE').lastInsertRowid);
      const d2 = Number(insertDept.run('Building & Construction', 'DBC').lastInsertRowid);
      const d3 = Number(insertDept.run('Automotive & Mechanical Engineering', 'DAM').lastInsertRowid);
      const d4 = Number(insertDept.run('Fashion & Garment Design', 'DFG').lastInsertRowid);
      const d5 = Number(insertDept.run('Hospitality, Catering & Cosmetology', 'DHC').lastInsertRowid);

      const insertCourse = db.prepare(
        'INSERT INTO courses (course_name, course_code, dept_id, duration_years, fee_ugx) VALUES (?, ?, ?, ?, ?)'
      );
      const c1 = Number(
        insertCourse.run('National Certificate in Electrical Installation', 'NCEI-101', d1, 2, 145000).lastInsertRowid
      );
      const c2 = Number(
        insertCourse.run('National Certificate in Building & Concrete Practice', 'NCBCP-102', d2, 2, 140000).lastInsertRowid
      );
      const c3 = Number(
        insertCourse.run('National Certificate in Automotive Mechanics', 'NCAM-103', d3, 2, 150000).lastInsertRowid
      );
      const c4 = Number(
        insertCourse.run('National Certificate in Tailoring & Garment Cutting', 'NCTGC-104', d4, 2, 120000).lastInsertRowid
      );
      const c5 = Number(
        insertCourse.run('National Certificate in Hairdressing & Cosmetology', 'NCHC-105', d5, 2, 125000).lastInsertRowid
      );
      const c6 = Number(
        insertCourse.run('National Certificate in Hotel & Institutional Catering', 'NCHIC-106', d5, 2, 135000).lastInsertRowid
      );

      const insertSession = db.prepare(
        'INSERT INTO exam_sessions (session_name, assessment_programme, assessment_year, exam_levels, opening_date, closing_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const s1 = Number(
        insertSession.run(
          'Nov/Dec 2026 UVTAB Assessment',
          'UVTAB National Certificate (Full Assessment)',
          2026,
          'Level 1 (Year 1), Level 2 (Year 2), Modular Assessment',
          '2026-09-01',
          '2026-12-05',
          'Open'
        ).lastInsertRowid
      );
      const s2 = Number(
        insertSession.run(
          'June/July 2026 UVTAB Modular Series',
          'UVTAB Modular Assessment',
          2026,
          'Modular Assessment, Trade Test Grade III',
          '2026-04-01',
          '2026-06-15',
          'Closed'
        ).lastInsertRowid
      );
      const s3 = Number(
        insertSession.run(
          'Nov/Dec 2025 UVTAB National Series',
          'UVTAB National Certificate (Full Assessment)',
          2025,
          'Level 1 (Year 1), Level 2 (Year 2)',
          '2025-09-01',
          '2025-11-15',
          'Closed'
        ).lastInsertRowid
      );

      const demoStudents = [
        {
          id: 'AVS-2026-0001',
          name: 'Tumwine Brian',
          gender: 'Male',
          dob: '2004-03-14',
          phone: '0772418920',
          email: 'brian.tumwine@example.ug',
          district: 'Ibanda',
          address: 'Kagongo Division, Ibanda Municipality',
          courseId: c1,
          deptId: d1,
          yearOfStudy: 'Year 2',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0014',
          examLevel: 'Level 2 (Year 2)',
          sessionId: s1,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2026,
          regDate: '2026-10-12',
          fee: 145000,
          paid: 145000,
          status: 'Completed',
        },
        {
          id: 'AVS-2026-0002',
          name: 'Atuhaire Joan',
          gender: 'Female',
          dob: '2005-07-22',
          phone: '0782904115',
          email: 'joan.atuhaire@example.ug',
          district: 'Ibanda',
          address: 'Bufunda Division, Ibanda',
          courseId: c4,
          deptId: d4,
          yearOfStudy: 'Year 2',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0015',
          examLevel: 'Level 2 (Year 2)',
          sessionId: s1,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2026,
          regDate: '2026-10-14',
          fee: 120000,
          paid: 120000,
          status: 'Submitted',
        },
        {
          id: 'AVS-2026-0003',
          name: 'Muhanguzi Denis',
          gender: 'Male',
          dob: '2003-11-05',
          phone: '0701552319',
          email: '',
          district: 'Kiruhura',
          address: 'Kazo Trading Centre, Kiruhura',
          courseId: c3,
          deptId: d3,
          yearOfStudy: 'Year 1',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0018',
          examLevel: 'Level 1 (Year 1)',
          sessionId: s1,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2026,
          regDate: '2026-10-19',
          fee: 150000,
          paid: 75000,
          status: 'Pending',
        },
        {
          id: 'AVS-2026-0004',
          name: 'Kyomuhendo Ritah',
          gender: 'Female',
          dob: '2005-01-30',
          phone: '0775310942',
          email: 'ritah.kyomuhendo@example.ug',
          district: 'Kamwenge',
          address: 'Bwizi Sub-County, Kamwenge',
          courseId: c5,
          deptId: d5,
          yearOfStudy: 'Year 2',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0021',
          examLevel: 'Level 2 (Year 2)',
          sessionId: s1,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2026,
          regDate: '2026-10-21',
          fee: 125000,
          paid: 125000,
          status: 'Completed',
        },
        {
          id: 'AVS-2026-0005',
          name: 'Mugisha Emmanuel',
          gender: 'Male',
          dob: '2004-08-19',
          phone: '0753884210',
          email: '',
          district: 'Mbarara',
          address: 'Bwizibwera, Mbarara District',
          courseId: c2,
          deptId: d2,
          yearOfStudy: 'Year 1',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0025',
          examLevel: 'Level 1 (Year 1)',
          sessionId: s1,
          programme: 'UVTAB Modular Assessment',
          assessmentYear: 2026,
          regDate: '2026-10-28',
          fee: 140000,
          paid: 60000,
          status: 'Pending',
        },
        {
          id: 'AVS-2026-0006',
          name: 'Namazzi Brenda',
          gender: 'Female',
          dob: '2004-06-11',
          phone: '0779124578',
          email: 'brenda.namazzi@example.ug',
          district: 'Bushenyi',
          address: 'Ishaka Division, Bushenyi',
          courseId: c6,
          deptId: d5,
          yearOfStudy: 'Year 2',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0029',
          examLevel: 'Level 2 (Year 2)',
          sessionId: s1,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2026,
          regDate: '2026-11-02',
          fee: 135000,
          paid: 135000,
          status: 'Completed',
        },
        {
          id: 'AVS-2026-0007',
          name: 'Twinamatsiko Ivan',
          gender: 'Male',
          dob: '2003-12-03',
          phone: '0781449203',
          email: '',
          district: 'Buhweju',
          address: 'Nsiika Town Council, Buhweju',
          courseId: c1,
          deptId: d1,
          yearOfStudy: 'Year 1',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0033',
          examLevel: 'Modular Assessment',
          sessionId: s1,
          programme: 'UVTAB Modular Assessment',
          assessmentYear: 2026,
          regDate: '2026-11-05',
          fee: 145000,
          paid: 0,
          status: 'Pending',
        },
        {
          id: 'AVS-2026-0008',
          name: 'Ainembabazi Ruth',
          gender: 'Female',
          dob: '2005-04-27',
          phone: '0704921844',
          email: 'ruth.aine@example.ug',
          district: 'Ibanda',
          address: 'Nyamarebe Sub-County, Ibanda',
          courseId: c4,
          deptId: d4,
          yearOfStudy: 'Year 1',
          academicYear: '2026/2027',
          regNumber: 'UVT/IBD/26/0037',
          examLevel: 'Level 1 (Year 1)',
          sessionId: s1,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2026,
          regDate: '2026-11-10',
          fee: 120000,
          paid: 120000,
          status: 'Completed',
        },
        {
          id: 'AVS-2026-0009',
          name: 'Busingye Samuel',
          gender: 'Male',
          dob: '2004-09-16',
          phone: '0774638291',
          email: '',
          district: 'Ibanda',
          address: 'Bisheshe Division, Ibanda',
          courseId: c3,
          deptId: d3,
          yearOfStudy: 'Year 2',
          academicYear: '2025/2026',
          regNumber: 'UVT/IBD/26/0004',
          examLevel: 'Modular Assessment',
          sessionId: s2,
          programme: 'UVTAB Modular Assessment',
          assessmentYear: 2026,
          regDate: '2026-05-12',
          fee: 150000,
          paid: 150000,
          status: 'Submitted',
        },
        {
          id: 'AVS-2026-0010',
          name: 'Akello Grace',
          gender: 'Female',
          dob: '2005-02-09',
          phone: '0788712390',
          email: 'grace.akello@example.ug',
          district: 'Kiruhura',
          address: 'Rushere Town Council, Kiruhura',
          courseId: c6,
          deptId: d5,
          yearOfStudy: 'Year 1',
          academicYear: '2025/2026',
          regNumber: 'UVT/IBD/26/0009',
          examLevel: 'Modular Assessment',
          sessionId: s2,
          programme: 'UVTAB Modular Assessment',
          assessmentYear: 2026,
          regDate: '2026-05-18',
          fee: 135000,
          paid: 135000,
          status: 'Completed',
        },
        {
          id: 'AVS-2025-0011',
          name: 'Katusiime Ronald',
          gender: 'Male',
          dob: '2002-10-12',
          phone: '0771882450',
          email: '',
          district: 'Ibanda',
          address: 'Igorora Town Council, Ibanda',
          courseId: c2,
          deptId: d2,
          yearOfStudy: 'Year 2',
          academicYear: '2025/2026',
          regNumber: 'UVT/IBD/25/0089',
          examLevel: 'Level 2 (Year 2)',
          sessionId: s3,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2025,
          regDate: '2025-10-08',
          fee: 140000,
          paid: 140000,
          status: 'Submitted',
        },
        {
          id: 'AVS-2025-0012',
          name: 'Namukasa Prossy',
          gender: 'Female',
          dob: '2004-05-04',
          phone: '0759203812',
          email: '',
          district: 'Mbarara',
          address: 'Rubindi Trading Centre, Mbarara',
          courseId: c5,
          deptId: d5,
          yearOfStudy: 'Year 1',
          academicYear: '2025/2026',
          regNumber: 'UVT/IBD/25/0094',
          examLevel: 'Level 1 (Year 1)',
          sessionId: s3,
          programme: 'UVTAB National Certificate (Full Assessment)',
          assessmentYear: 2025,
          regDate: '2025-10-11',
          fee: 125000,
          paid: 0,
          status: 'Cancelled',
        },
      ];

      const insertStudent = db.prepare(`
        INSERT INTO students (
          student_id, full_name, gender, dob, phone, email, district, address,
          course_id, department_id, year_of_study, academic_year, reg_number, exam_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertReg = db.prepare(`
        INSERT INTO registrations (
          student_id, session_id, assessment_programme, assessment_year, reg_date,
          exam_fee_ugx, fee_paid_ugx, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of demoStudents) {
        insertStudent.run(
          s.id,
          s.name,
          s.gender,
          s.dob,
          s.phone,
          s.email || null,
          s.district,
          s.address,
          s.courseId,
          s.deptId,
          s.yearOfStudy,
          s.academicYear,
          s.regNumber,
          s.examLevel
        );
        insertReg.run(
          s.id,
          s.sessionId,
          s.programme,
          s.assessmentYear,
          s.regDate,
          s.fee,
          s.paid,
          s.status,
          'Initial demonstration enrollment record'
        );
      }

      db.prepare(
        "INSERT INTO activity_logs (username, action, entity_type, entity_id, details) VALUES ('system', 'Initialized institutional database with demonstration records', 'system', 'init', 'Seeded 5 departments, 6 courses, 3 exam sessions, and 12 students')"
      ).run();

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

export function generateNextStudentId(year?: number): string {
  const targetYear = year || new Date().getFullYear();
  const prefix = `AVS-${targetYear}-`;
  const row = db
    .prepare(
      `SELECT student_id FROM students WHERE student_id LIKE ? ORDER BY student_id DESC LIMIT 1`
    )
    .get(`${prefix}%`) as { student_id: string } | undefined;

  let nextNum = 1;
  if (row) {
    const parts = row.student_id.split('-');
    const parsed = Number.parseInt(parts[parts.length - 1] || '0', 10);
    if (!Number.isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export function logActivity(
  userId: number | null,
  username: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string
): void {
  db.prepare(
    'INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, username, action, entityType ?? null, entityId ?? null, details ?? null);
}
