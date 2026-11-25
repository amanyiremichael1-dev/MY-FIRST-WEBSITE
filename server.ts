import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  db,
  generateNextStudentId,
  initializeDatabase,
  logActivity,
} from './server/db.ts';
import {
  hashPassword,
  requireCsrfHeader,
  signToken,
  verifyPassword,
  verifyToken,
} from './server/auth.ts';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
  UserRole,
} from './server/auth.ts';

initializeDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api', requireCsrfHeader);

function getBootstrapStatus(): { needsBootstrap: boolean; envOverrideActive: boolean } {
  const envOverrideActive = Boolean(process.env.ADMIN_INITIAL_PASSWORD?.trim());
  const adminRow = db
    .prepare(
      "SELECT user_id FROM users WHERE role = 'Administrator' AND is_active = 1 LIMIT 1"
    )
    .get() as { user_id: number } | undefined;
  return {
    needsBootstrap: !adminRow && !envOverrideActive,
    envOverrideActive,
  };
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  const user = db
    .prepare(
      'SELECT user_id, username, full_name, email, role, is_active, must_change_password FROM users WHERE user_id = ?'
    )
    .get(payload.userId) as AuthenticatedUser | undefined;

  if (!user || user.is_active !== 1) {
    res.status(401).json({ error: 'Account is inactive or unavailable.' });
    return;
  }

  req.authUser = user;
  next();
}

function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        error: 'Access denied. You do not have permission for this action.',
      });
      return;
    }
    next();
  };
}

function cleanStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- AUTHENTICATION ROUTES ----------

app.get('/api/auth/status', (_req: Request, res: Response) => {
  res.json(getBootstrapStatus());
});

app.post('/api/auth/bootstrap', (req: Request, res: Response) => {
  const status = getBootstrapStatus();
  if (!status.needsBootstrap) {
    res.status(409).json({
      error: 'Administrator setup has already been completed.',
    });
    return;
  }

  const username = cleanStr(req.body?.username) || 'admin';
  const fullName = cleanStr(req.body?.full_name) || 'System Administrator';
  const email = cleanStr(req.body?.email) || 'admin@alliancevocational.ac.ug';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    res.status(400).json({
      error: 'Username must be 3-32 characters (letters, numbers, dot, underscore, or hyphen).',
    });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({
      error: 'Administrator password must be at least 8 characters long.',
    });
    return;
  }

  const passwordHash = hashPassword(password);
  const result = db
    .prepare(
      "INSERT INTO users (username, password_hash, full_name, email, role, is_active, must_change_password, last_login) VALUES (?, ?, ?, ?, 'Administrator', 1, 0, datetime('now'))"
    )
    .run(username, passwordHash, fullName, email);

  const userId = Number(result.lastInsertRowid);
  const user: AuthenticatedUser = {
    user_id: userId,
    username,
    full_name: fullName,
    email,
    role: 'Administrator',
    is_active: 1,
    must_change_password: 0,
  };

  logActivity(
    userId,
    username,
    'Completed initial system administrator setup',
    'user',
    String(userId)
  );

  const token = signToken(user);
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const username = cleanStr(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const row = db
    .prepare(
      'SELECT user_id, username, password_hash, full_name, email, role, is_active, must_change_password FROM users WHERE username = ?'
    )
    .get(username) as
    | (AuthenticatedUser & { password_hash: string })
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  if (row.is_active !== 1) {
    res.status(403).json({
      error: 'Your account has been deactivated. Contact the System Administrator.',
    });
    return;
  }

  db.prepare("UPDATE users SET last_login = datetime('now') WHERE user_id = ?").run(
    row.user_id
  );
  logActivity(row.user_id, row.username, 'Signed in to system', 'user', String(row.user_id));

  const user: AuthenticatedUser = {
    user_id: row.user_id,
    username: row.username,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
  };

  const token = signToken(user);
  res.json({ token, user });
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.authUser) {
    logActivity(
      req.authUser.user_id,
      req.authUser.username,
      'Signed out of system',
      'user',
      String(req.authUser.user_id)
    );
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.authUser });
});

app.post(
  '/api/auth/change-password',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword =
      typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || newPassword.length < 8) {
      res.status(400).json({
        error: 'Current password and a new password (min 8 characters) are required.',
      });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE user_id = ?')
      .get(req.authUser!.user_id) as { password_hash: string } | undefined;

    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const updatedHash = hashPassword(newPassword);
    db.prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE user_id = ?"
    ).run(updatedHash, req.authUser!.user_id);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      'Changed account password',
      'user',
      String(req.authUser!.user_id)
    );

    res.json({ ok: true, message: 'Password updated successfully.' });
  }
);

app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const username = cleanStr(req.body?.username);
  const note = cleanStr(req.body?.note);

  if (!username) {
    res.status(400).json({ error: 'Please enter your username.' });
    return;
  }

  const user = db
    .prepare('SELECT user_id, username FROM users WHERE username = ?')
    .get(username) as { user_id: number; username: string } | undefined;

  if (user) {
    db.prepare(
      'INSERT INTO password_reset_requests (username, requested_by_note) VALUES (?, ?)'
    ).run(user.username, note || 'Staff requested administrator password reset');
    logActivity(
      user.user_id,
      user.username,
      'Submitted password recovery request',
      'password_reset',
      user.username
    );
  }

  res.json({
    ok: true,
    message:
      'If your account exists, a password recovery request has been logged for the System Administrator.',
  });
});

// ---------- DASHBOARD ----------

app.get('/api/dashboard', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const totalStudents = (
    db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number }
  ).cnt;
  const totalRegistrations = (
    db.prepare('SELECT COUNT(*) AS cnt FROM registrations').get() as { cnt: number }
  ).cnt;
  const totalCourses = (
    db.prepare('SELECT COUNT(*) AS cnt FROM courses WHERE is_active = 1').get() as {
      cnt: number;
    }
  ).cnt;
  const totalSessions = (
    db.prepare('SELECT COUNT(*) AS cnt FROM exam_sessions').get() as { cnt: number }
  ).cnt;
  const pendingRegistrations = (
    db
      .prepare("SELECT COUNT(*) AS cnt FROM registrations WHERE status = 'Pending'")
      .get() as { cnt: number }
  ).cnt;
  const completedRegistrations = (
    db
      .prepare("SELECT COUNT(*) AS cnt FROM registrations WHERE status = 'Completed'")
      .get() as { cnt: number }
  ).cnt;
  const submittedRegistrations = (
    db
      .prepare("SELECT COUNT(*) AS cnt FROM registrations WHERE status = 'Submitted'")
      .get() as { cnt: number }
  ).cnt;
  const cancelledRegistrations = (
    db
      .prepare("SELECT COUNT(*) AS cnt FROM registrations WHERE status = 'Cancelled'")
      .get() as { cnt: number }
  ).cnt;

  const registrationsByCourse = db
    .prepare(
      `SELECT c.course_code, c.course_name, COUNT(r.reg_id) AS total,
              SUM(CASE WHEN r.status = 'Completed' OR r.status = 'Submitted' THEN 1 ELSE 0 END) AS finalized,
              SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending
       FROM courses c
       LEFT JOIN students s ON s.course_id = c.course_id
       LEFT JOIN registrations r ON r.student_id = s.student_id
       GROUP BY c.course_id
       ORDER BY total DESC, c.course_name ASC`
    )
    .all();

  const genderStats = db
    .prepare('SELECT gender, COUNT(*) AS count FROM students GROUP BY gender')
    .all();

  const statusStats = db
    .prepare('SELECT status, COUNT(*) AS count FROM registrations GROUP BY status')
    .all();

  const recentStudents = db
    .prepare(
      `SELECT s.student_id, s.full_name, s.reg_number, s.gender, s.academic_year, s.exam_level,
              c.course_name, c.course_code,
              r.reg_id, r.reg_date, r.status, es.session_name
       FROM students s
       JOIN courses c ON c.course_id = s.course_id
       LEFT JOIN registrations r ON r.reg_id = (
         SELECT r2.reg_id FROM registrations r2 WHERE r2.student_id = s.student_id ORDER BY r2.reg_id DESC LIMIT 1
       )
       LEFT JOIN exam_sessions es ON es.session_id = r.session_id
       ORDER BY s.created_at DESC, s.student_id DESC
       LIMIT 6`
    )
    .all();

  const recentActivities = db
    .prepare(
      'SELECT log_id, username, action, entity_type, entity_id, details, log_time FROM activity_logs ORDER BY log_id DESC LIMIT 8'
    )
    .all();

  res.json({
    stats: {
      totalStudents,
      totalRegistrations,
      totalCourses,
      totalSessions,
      pendingRegistrations,
      completedRegistrations,
      submittedRegistrations,
      cancelledRegistrations,
    },
    registrationsByCourse,
    genderStats,
    statusStats,
    recentStudents,
    recentActivities,
  });
});

// ---------- STUDENTS & REGISTRATIONS ----------

app.get('/api/students/next-id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const yearParam = Number.parseInt(String(req.query.year || ''), 10);
  const year = Number.isNaN(yearParam) ? new Date().getFullYear() : yearParam;
  res.json({ student_id: generateNextStudentId(year) });
});

app.get('/api/students', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const search = cleanStr(req.query.search);
  const courseId = cleanStr(req.query.courseId);
  const academicYear = cleanStr(req.query.academicYear);
  const sessionId = cleanStr(req.query.sessionId);
  const status = cleanStr(req.query.status);
  const exportMode = req.query.export === 'all';
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(5, Number.parseInt(String(req.query.pageSize || '10'), 10) || 10)
  );

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push(
      '(s.full_name LIKE ? OR s.student_id LIKE ? OR s.reg_number LIKE ? OR c.course_name LIKE ? OR es.session_name LIKE ?)'
    );
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }
  if (courseId) {
    conditions.push('s.course_id = ?');
    params.push(Number(courseId));
  }
  if (academicYear) {
    conditions.push('s.academic_year = ?');
    params.push(academicYear);
  }
  if (sessionId) {
    conditions.push('r.session_id = ?');
    params.push(Number(sessionId));
  }
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseFrom = `
    FROM students s
    JOIN courses c ON c.course_id = s.course_id
    LEFT JOIN departments d ON d.dept_id = s.department_id
    LEFT JOIN registrations r ON r.reg_id = (
      SELECT r2.reg_id FROM registrations r2 WHERE r2.student_id = s.student_id ORDER BY r2.reg_id DESC LIMIT 1
    )
    LEFT JOIN exam_sessions es ON es.session_id = r.session_id
  `;

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS cnt ${baseFrom} ${whereClause}`)
    .get(...params) as { cnt: number };

  const limitClause = exportMode ? '' : 'LIMIT ? OFFSET ?';
  const queryParams = exportMode
    ? params
    : [...params, pageSize, (page - 1) * pageSize];

  const rows = db
    .prepare(
      `SELECT s.*, c.course_name, c.course_code, d.dept_name,
              r.reg_id, r.session_id, r.assessment_programme, r.assessment_year,
              r.reg_date, r.exam_fee_ugx, r.fee_paid_ugx, r.status AS registration_status, r.notes,
              es.session_name
       ${baseFrom}
       ${whereClause}
       ORDER BY s.created_at DESC, s.student_id DESC
       ${limitClause}`
    )
    .all(...queryParams);

  res.json({
    students: rows,
    total: totalRow.cnt,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalRow.cnt / pageSize)),
  });
});

app.get('/api/students/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const studentId = cleanStr(req.params.id);
  const student = db
    .prepare(
      `SELECT s.*, c.course_name, c.course_code, d.dept_name
       FROM students s
       JOIN courses c ON c.course_id = s.course_id
       LEFT JOIN departments d ON d.dept_id = s.department_id
       WHERE s.student_id = ?`
    )
    .get(studentId);

  if (!student) {
    res.status(404).json({ error: 'Student record not found.' });
    return;
  }

  const registrations = db
    .prepare(
      `SELECT r.*, es.session_name, es.opening_date, es.closing_date
       FROM registrations r
       JOIN exam_sessions es ON es.session_id = r.session_id
       WHERE r.student_id = ?
       ORDER BY r.reg_id DESC`
    )
    .all(studentId);

  res.json({ student, registrations });
});

app.post(
  '/api/students',
  requireAuth,
  requireRole('Administrator', 'Registration Officer'),
  (req: AuthenticatedRequest, res: Response) => {
    const b = req.body || {};
    const fullName = cleanStr(b.full_name);
    const gender = cleanStr(b.gender);
    const dob = cleanStr(b.dob);
    const phone = cleanStr(b.phone);
    const email = cleanStr(b.email);
    const district = cleanStr(b.district);
    const address = cleanStr(b.address);
    const courseId = Number(b.course_id);
    const yearOfStudy = cleanStr(b.year_of_study);
    const academicYear = cleanStr(b.academic_year);
    const regNumber = cleanStr(b.reg_number).toUpperCase();
    const examLevel = cleanStr(b.exam_level);
    const sessionId = Number(b.session_id);
    const assessmentProgramme = cleanStr(b.assessment_programme);
    const assessmentYear = Number(b.assessment_year) || new Date().getFullYear();
    const regDate = cleanStr(b.reg_date) || new Date().toISOString().slice(0, 10);
    const examFeeUgx = Math.max(0, Number(b.exam_fee_ugx) || 0);
    const feePaidUgx = Math.max(0, Number(b.fee_paid_ugx) || 0);
    const status = cleanStr(b.status) || 'Pending';
    const notes = cleanStr(b.notes);

    if (
      !fullName ||
      !['Male', 'Female'].includes(gender) ||
      !dob ||
      !phone ||
      !district ||
      !address ||
      !courseId ||
      !yearOfStudy ||
      !academicYear ||
      !regNumber ||
      !examLevel ||
      !sessionId ||
      !assessmentProgramme
    ) {
      res.status(400).json({
        error: 'Please fill in all required personal, academic, and UVTAB examination fields.',
      });
      return;
    }

    if (email && !isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (!['Pending', 'Completed', 'Submitted', 'Cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid registration status.' });
      return;
    }

    const course = db
      .prepare('SELECT course_id, dept_id, fee_ugx FROM courses WHERE course_id = ?')
      .get(courseId) as { course_id: number; dept_id: number | null; fee_ugx: number } | undefined;
    if (!course) {
      res.status(400).json({ error: 'Selected course does not exist.' });
      return;
    }

    const session = db
      .prepare('SELECT session_id FROM exam_sessions WHERE session_id = ?')
      .get(sessionId) as { session_id: number } | undefined;
    if (!session) {
      res.status(400).json({ error: 'Selected examination session does not exist.' });
      return;
    }

    const duplicate = db
      .prepare('SELECT student_id FROM students WHERE UPPER(reg_number) = ?')
      .get(regNumber) as { student_id: string } | undefined;
    if (duplicate) {
      res.status(409).json({
        error: `Registration number "${regNumber}" is already assigned to student ${duplicate.student_id}. Duplicate registration numbers are not allowed.`,
      });
      return;
    }

    const studentId = generateNextStudentId(assessmentYear);

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(
        `INSERT INTO students (
          student_id, full_name, gender, dob, phone, email, district, address,
          course_id, department_id, year_of_study, academic_year, reg_number, exam_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        studentId,
        fullName,
        gender,
        dob,
        phone,
        email || null,
        district,
        address,
        course.course_id,
        course.dept_id,
        yearOfStudy,
        academicYear,
        regNumber,
        examLevel
      );

      db.prepare(
        `INSERT INTO registrations (
          student_id, session_id, assessment_programme, assessment_year, reg_date,
          exam_fee_ugx, fee_paid_ugx, status, notes, registered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        studentId,
        sessionId,
        assessmentProgramme,
        assessmentYear,
        regDate,
        examFeeUgx || course.fee_ugx,
        feePaidUgx,
        status,
        notes || null,
        req.authUser!.user_id
      );

      logActivity(
        req.authUser!.user_id,
        req.authUser!.username,
        `Registered student ${fullName} (${regNumber})`,
        'student',
        studentId,
        `Status: ${status}`
      );

      db.exec('COMMIT');
      res.status(201).json({
        student_id: studentId,
        message: `Student ${fullName} registered successfully with ID ${studentId}.`,
      });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
);

app.put(
  '/api/students/:id',
  requireAuth,
  requireRole('Administrator', 'Registration Officer'),
  (req: AuthenticatedRequest, res: Response) => {
    const studentId = cleanStr(req.params.id);
    const existing = db
      .prepare('SELECT student_id FROM students WHERE student_id = ?')
      .get(studentId) as { student_id: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Student record not found.' });
      return;
    }

    const b = req.body || {};
    const fullName = cleanStr(b.full_name);
    const gender = cleanStr(b.gender);
    const dob = cleanStr(b.dob);
    const phone = cleanStr(b.phone);
    const email = cleanStr(b.email);
    const district = cleanStr(b.district);
    const address = cleanStr(b.address);
    const courseId = Number(b.course_id);
    const yearOfStudy = cleanStr(b.year_of_study);
    const academicYear = cleanStr(b.academic_year);
    const regNumber = cleanStr(b.reg_number).toUpperCase();
    const examLevel = cleanStr(b.exam_level);
    const sessionId = Number(b.session_id);
    const assessmentProgramme = cleanStr(b.assessment_programme);
    const assessmentYear = Number(b.assessment_year) || new Date().getFullYear();
    const regDate = cleanStr(b.reg_date) || new Date().toISOString().slice(0, 10);
    const examFeeUgx = Math.max(0, Number(b.exam_fee_ugx) || 0);
    const feePaidUgx = Math.max(0, Number(b.fee_paid_ugx) || 0);
    const status = cleanStr(b.status) || 'Pending';
    const notes = cleanStr(b.notes);

    if (
      !fullName ||
      !['Male', 'Female'].includes(gender) ||
      !dob ||
      !phone ||
      !district ||
      !address ||
      !courseId ||
      !yearOfStudy ||
      !academicYear ||
      !regNumber ||
      !examLevel ||
      !sessionId ||
      !assessmentProgramme
    ) {
      res.status(400).json({ error: 'All required fields must be provided.' });
      return;
    }

    if (email && !isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email address format.' });
      return;
    }

    if (!['Pending', 'Completed', 'Submitted', 'Cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid registration status.' });
      return;
    }

    const duplicate = db
      .prepare(
        'SELECT student_id FROM students WHERE UPPER(reg_number) = ? AND student_id != ?'
      )
      .get(regNumber, studentId) as { student_id: string } | undefined;

    if (duplicate) {
      res.status(409).json({
        error: `Registration number "${regNumber}" already belongs to student ${duplicate.student_id}.`,
      });
      return;
    }

    const course = db
      .prepare('SELECT course_id, dept_id FROM courses WHERE course_id = ?')
      .get(courseId) as { course_id: number; dept_id: number | null } | undefined;
    if (!course) {
      res.status(400).json({ error: 'Selected course not found.' });
      return;
    }

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(
        `UPDATE students SET
          full_name = ?, gender = ?, dob = ?, phone = ?, email = ?, district = ?, address = ?,
          course_id = ?, department_id = ?, year_of_study = ?, academic_year = ?,
          reg_number = ?, exam_level = ?, updated_at = datetime('now')
         WHERE student_id = ?`
      ).run(
        fullName,
        gender,
        dob,
        phone,
        email || null,
        district,
        address,
        course.course_id,
        course.dept_id,
        yearOfStudy,
        academicYear,
        regNumber,
        examLevel,
        studentId
      );

      const regId = Number(b.reg_id);
      const targetReg = regId
        ? (db
            .prepare('SELECT reg_id FROM registrations WHERE reg_id = ? AND student_id = ?')
            .get(regId, studentId) as { reg_id: number } | undefined)
        : (db
            .prepare(
              'SELECT reg_id FROM registrations WHERE student_id = ? ORDER BY reg_id DESC LIMIT 1'
            )
            .get(studentId) as { reg_id: number } | undefined);

      if (targetReg) {
        db.prepare(
          `UPDATE registrations SET
            session_id = ?, assessment_programme = ?, assessment_year = ?, reg_date = ?,
            exam_fee_ugx = ?, fee_paid_ugx = ?, status = ?, notes = ?, updated_at = datetime('now')
           WHERE reg_id = ?`
        ).run(
          sessionId,
          assessmentProgramme,
          assessmentYear,
          regDate,
          examFeeUgx,
          feePaidUgx,
          status,
          notes || null,
          targetReg.reg_id
        );
      } else {
        db.prepare(
          `INSERT INTO registrations (
            student_id, session_id, assessment_programme, assessment_year, reg_date,
            exam_fee_ugx, fee_paid_ugx, status, notes, registered_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          studentId,
          sessionId,
          assessmentProgramme,
          assessmentYear,
          regDate,
          examFeeUgx,
          feePaidUgx,
          status,
          notes || null,
          req.authUser!.user_id
        );
      }

      logActivity(
        req.authUser!.user_id,
        req.authUser!.username,
        `Updated student record ${fullName} (${studentId})`,
        'student',
        studentId,
        `Status: ${status}`
      );

      db.exec('COMMIT');
      res.json({ message: `Student ${fullName} (${studentId}) updated successfully.` });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
);

app.delete(
  '/api/students/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const studentId = cleanStr(req.params.id);
    const existing = db
      .prepare('SELECT student_id, full_name, reg_number FROM students WHERE student_id = ?')
      .get(studentId) as
      | { student_id: string; full_name: string; reg_number: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Student record not found.' });
      return;
    }

    db.prepare('DELETE FROM students WHERE student_id = ?').run(studentId);
    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Deleted student record ${existing.full_name} (${existing.reg_number})`,
      'student',
      studentId
    );
    res.json({ message: `Student ${existing.full_name} deleted.` });
  }
);

// ---------- DEPARTMENTS & COURSES ----------

app.get('/api/departments', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const departments = db
    .prepare(
      `SELECT d.*, COUNT(c.course_id) AS course_count
       FROM departments d
       LEFT JOIN courses c ON c.dept_id = d.dept_id
       GROUP BY d.dept_id
       ORDER BY d.dept_name ASC`
    )
    .all();
  res.json({ departments });
});

app.post(
  '/api/departments',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const deptName = cleanStr(req.body?.dept_name);
    const deptCode = cleanStr(req.body?.dept_code).toUpperCase();
    if (!deptName || !deptCode) {
      res.status(400).json({ error: 'Department name and code are required.' });
      return;
    }
    const dup = db
      .prepare('SELECT dept_id FROM departments WHERE UPPER(dept_code) = ? OR LOWER(dept_name) = ?')
      .get(deptCode, deptName.toLowerCase());
    if (dup) {
      res.status(409).json({ error: 'Department name or code already exists.' });
      return;
    }
    const result = db
      .prepare('INSERT INTO departments (dept_name, dept_code) VALUES (?, ?)')
      .run(deptName, deptCode);
    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Created department ${deptName} (${deptCode})`,
      'department',
      String(result.lastInsertRowid)
    );
    res.status(201).json({ dept_id: Number(result.lastInsertRowid) });
  }
);

app.delete(
  '/api/departments/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const deptId = Number(req.params.id);
    const used = (
      db.prepare('SELECT COUNT(*) AS cnt FROM courses WHERE dept_id = ?').get(deptId) as {
        cnt: number;
      }
    ).cnt;
    if (used > 0) {
      res.status(409).json({
        error: 'Cannot delete department while courses are still assigned to it.',
      });
      return;
    }
    db.prepare('DELETE FROM departments WHERE dept_id = ?').run(deptId);
    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Deleted department #${deptId}`,
      'department',
      String(deptId)
    );
    res.json({ ok: true });
  }
);

app.get('/api/courses', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const courses = db
    .prepare(
      `SELECT c.*, d.dept_name, d.dept_code, COUNT(s.student_id) AS student_count
       FROM courses c
       LEFT JOIN departments d ON d.dept_id = c.dept_id
       LEFT JOIN students s ON s.course_id = c.course_id
       GROUP BY c.course_id
       ORDER BY c.course_name ASC`
    )
    .all();
  res.json({ courses });
});

app.post(
  '/api/courses',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const courseName = cleanStr(req.body?.course_name);
    const courseCode = cleanStr(req.body?.course_code).toUpperCase();
    const deptId = req.body?.dept_id ? Number(req.body.dept_id) : null;
    const durationYears = Math.max(1, Number(req.body?.duration_years) || 2);
    const feeUgx = Math.max(0, Number(req.body?.fee_ugx) || 0);

    if (!courseName || !courseCode) {
      res.status(400).json({ error: 'Course name and course code are required.' });
      return;
    }

    const dup = db
      .prepare('SELECT course_id FROM courses WHERE UPPER(course_code) = ?')
      .get(courseCode);
    if (dup) {
      res.status(409).json({ error: `Course code "${courseCode}" already exists.` });
      return;
    }

    const result = db
      .prepare(
        'INSERT INTO courses (course_name, course_code, dept_id, duration_years, fee_ugx) VALUES (?, ?, ?, ?, ?)'
      )
      .run(courseName, courseCode, deptId, durationYears, feeUgx);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Added course ${courseName} (${courseCode})`,
      'course',
      String(result.lastInsertRowid)
    );
    res.status(201).json({ course_id: Number(result.lastInsertRowid) });
  }
);

app.put(
  '/api/courses/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const courseId = Number(req.params.id);
    const courseName = cleanStr(req.body?.course_name);
    const courseCode = cleanStr(req.body?.course_code).toUpperCase();
    const deptId = req.body?.dept_id ? Number(req.body.dept_id) : null;
    const durationYears = Math.max(1, Number(req.body?.duration_years) || 2);
    const feeUgx = Math.max(0, Number(req.body?.fee_ugx) || 0);
    const isActive = req.body?.is_active === 0 ? 0 : 1;

    if (!courseName || !courseCode) {
      res.status(400).json({ error: 'Course name and course code are required.' });
      return;
    }

    const dup = db
      .prepare('SELECT course_id FROM courses WHERE UPPER(course_code) = ? AND course_id != ?')
      .get(courseCode, courseId);
    if (dup) {
      res.status(409).json({ error: `Course code "${courseCode}" is already in use.` });
      return;
    }

    db.prepare(
      "UPDATE courses SET course_name = ?, course_code = ?, dept_id = ?, duration_years = ?, fee_ugx = ?, is_active = ?, updated_at = datetime('now') WHERE course_id = ?"
    ).run(courseName, courseCode, deptId, durationYears, feeUgx, isActive, courseId);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Updated course ${courseName} (${courseCode})`,
      'course',
      String(courseId)
    );
    res.json({ ok: true });
  }
);

app.delete(
  '/api/courses/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const courseId = Number(req.params.id);
    const enrolled = (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM students WHERE course_id = ?')
        .get(courseId) as { cnt: number }
    ).cnt;

    if (enrolled > 0) {
      res.status(409).json({
        error: `Cannot delete course with ${enrolled} registered student(s). Reassign students or mark course inactive instead.`,
      });
      return;
    }

    const course = db
      .prepare('SELECT course_name, course_code FROM courses WHERE course_id = ?')
      .get(courseId) as { course_name: string; course_code: string } | undefined;

    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    db.prepare('DELETE FROM courses WHERE course_id = ?').run(courseId);
    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Deleted course ${course.course_name} (${course.course_code})`,
      'course',
      String(courseId)
    );
    res.json({ ok: true });
  }
);

// ---------- EXAMINATION SESSIONS ----------

app.get('/api/sessions', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const sessions = db
    .prepare(
      `SELECT es.*,
              COUNT(r.reg_id) AS total_registered,
              SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
              SUM(CASE WHEN r.status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
              SUM(CASE WHEN r.status = 'Submitted' THEN 1 ELSE 0 END) AS submitted_count,
              SUM(CASE WHEN r.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_count
       FROM exam_sessions es
       LEFT JOIN registrations r ON r.session_id = es.session_id
       GROUP BY es.session_id
       ORDER BY es.assessment_year DESC, es.opening_date DESC`
    )
    .all();
  res.json({ sessions });
});

app.post(
  '/api/sessions',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const sessionName = cleanStr(req.body?.session_name);
    const assessmentProgramme = cleanStr(req.body?.assessment_programme);
    const assessmentYear = Number(req.body?.assessment_year);
    const examLevels = cleanStr(req.body?.exam_levels);
    const openingDate = cleanStr(req.body?.opening_date);
    const closingDate = cleanStr(req.body?.closing_date);
    const status = cleanStr(req.body?.status) === 'Closed' ? 'Closed' : 'Open';

    if (
      !sessionName ||
      !assessmentProgramme ||
      !assessmentYear ||
      !examLevels ||
      !openingDate ||
      !closingDate
    ) {
      res.status(400).json({ error: 'All examination session fields are required.' });
      return;
    }

    if (closingDate < openingDate) {
      res.status(400).json({
        error: 'Closing date cannot be earlier than the opening date.',
      });
      return;
    }

    const result = db
      .prepare(
        'INSERT INTO exam_sessions (session_name, assessment_programme, assessment_year, exam_levels, opening_date, closing_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        sessionName,
        assessmentProgramme,
        assessmentYear,
        examLevels,
        openingDate,
        closingDate,
        status
      );

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Created UVTAB exam session "${sessionName}" (${assessmentYear})`,
      'exam_session',
      String(result.lastInsertRowid)
    );
    res.status(201).json({ session_id: Number(result.lastInsertRowid) });
  }
);

app.put(
  '/api/sessions/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const sessionId = Number(req.params.id);
    const sessionName = cleanStr(req.body?.session_name);
    const assessmentProgramme = cleanStr(req.body?.assessment_programme);
    const assessmentYear = Number(req.body?.assessment_year);
    const examLevels = cleanStr(req.body?.exam_levels);
    const openingDate = cleanStr(req.body?.opening_date);
    const closingDate = cleanStr(req.body?.closing_date);
    const status = cleanStr(req.body?.status) === 'Closed' ? 'Closed' : 'Open';

    if (
      !sessionName ||
      !assessmentProgramme ||
      !assessmentYear ||
      !examLevels ||
      !openingDate ||
      !closingDate
    ) {
      res.status(400).json({ error: 'All examination session fields are required.' });
      return;
    }

    if (closingDate < openingDate) {
      res.status(400).json({
        error: 'Closing date cannot be earlier than the opening date.',
      });
      return;
    }

    db.prepare(
      "UPDATE exam_sessions SET session_name = ?, assessment_programme = ?, assessment_year = ?, exam_levels = ?, opening_date = ?, closing_date = ?, status = ?, updated_at = datetime('now') WHERE session_id = ?"
    ).run(
      sessionName,
      assessmentProgramme,
      assessmentYear,
      examLevels,
      openingDate,
      closingDate,
      status,
      sessionId
    );

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Updated UVTAB exam session "${sessionName}"`,
      'exam_session',
      String(sessionId)
    );
    res.json({ ok: true });
  }
);

app.delete(
  '/api/sessions/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const sessionId = Number(req.params.id);
    const used = (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM registrations WHERE session_id = ?')
        .get(sessionId) as { cnt: number }
    ).cnt;

    if (used > 0) {
      res.status(409).json({
        error: `Cannot delete examination session with ${used} linked student registration(s).`,
      });
      return;
    }

    db.prepare('DELETE FROM exam_sessions WHERE session_id = ?').run(sessionId);
    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Deleted exam session #${sessionId}`,
      'exam_session',
      String(sessionId)
    );
    res.json({ ok: true });
  }
);

app.get(
  '/api/sessions/:id/students',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const sessionId = Number(req.params.id);
    const session = db
      .prepare('SELECT * FROM exam_sessions WHERE session_id = ?')
      .get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Examination session not found.' });
      return;
    }

    const students = db
      .prepare(
        `SELECT r.reg_id, r.student_id, r.assessment_programme, r.reg_date, r.exam_fee_ugx, r.fee_paid_ugx, r.status, r.notes,
                s.full_name, s.reg_number, s.gender, s.exam_level, s.academic_year, s.phone,
                c.course_name, c.course_code
         FROM registrations r
         JOIN students s ON s.student_id = r.student_id
         JOIN courses c ON c.course_id = s.course_id
         WHERE r.session_id = ?
         ORDER BY s.full_name ASC`
      )
      .all(sessionId);

    res.json({ session, students });
  }
);

app.patch(
  '/api/registrations/:regId/status',
  requireAuth,
  requireRole('Administrator', 'Registration Officer'),
  (req: AuthenticatedRequest, res: Response) => {
    const regId = Number(req.params.regId);
    const status = cleanStr(req.body?.status);
    const feePaid = req.body?.fee_paid_ugx;

    if (!['Pending', 'Completed', 'Submitted', 'Cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid registration workflow status.' });
      return;
    }

    const existing = db
      .prepare('SELECT reg_id, student_id, fee_paid_ugx FROM registrations WHERE reg_id = ?')
      .get(regId) as
      | { reg_id: number; student_id: string; fee_paid_ugx: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Registration record not found.' });
      return;
    }

    const updatedPaid =
      feePaid !== undefined && feePaid !== null
        ? Math.max(0, Number(feePaid) || 0)
        : existing.fee_paid_ugx;

    db.prepare(
      "UPDATE registrations SET status = ?, fee_paid_ugx = ?, updated_at = datetime('now') WHERE reg_id = ?"
    ).run(status, updatedPaid, regId);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Updated registration status for ${existing.student_id} to ${status}`,
      'registration',
      String(regId)
    );
    res.json({ ok: true });
  }
);

// ---------- REPORTS ----------

app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const reportType = cleanStr(req.query.type) || 'complete';
  const startDate = cleanStr(req.query.startDate);
  const endDate = cleanStr(req.query.endDate);
  const courseId = cleanStr(req.query.courseId);
  const sessionId = cleanStr(req.query.sessionId);
  const academicYear = cleanStr(req.query.academicYear);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (startDate) {
    conditions.push('r.reg_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('r.reg_date <= ?');
    params.push(endDate);
  }
  if (courseId) {
    conditions.push('s.course_id = ?');
    params.push(Number(courseId));
  }
  if (sessionId) {
    conditions.push('r.session_id = ?');
    params.push(Number(sessionId));
  }
  if (academicYear) {
    conditions.push('s.academic_year = ?');
    params.push(academicYear);
  }
  if (reportType === 'pending') {
    conditions.push("r.status = 'Pending'");
  } else if (reportType === 'completed') {
    conditions.push("r.status IN ('Completed', 'Submitted')");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT s.student_id, s.full_name, s.gender, s.phone, s.district, s.reg_number,
              s.academic_year, s.year_of_study, s.exam_level,
              c.course_code, c.course_name, d.dept_name,
              es.session_name, es.assessment_year,
              r.reg_id, r.assessment_programme, r.reg_date, r.exam_fee_ugx, r.fee_paid_ugx, r.status
       FROM registrations r
       JOIN students s ON s.student_id = r.student_id
       JOIN courses c ON c.course_id = s.course_id
       LEFT JOIN departments d ON d.dept_id = s.department_id
       JOIN exam_sessions es ON es.session_id = r.session_id
       ${whereClause}
       ORDER BY s.full_name ASC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  let groupedSummary: Array<Record<string, unknown>> = [];
  if (reportType === 'by_course') {
    groupedSummary = db
      .prepare(
        `SELECT c.course_code, c.course_name,
                COUNT(r.reg_id) AS total_registrations,
                SUM(CASE WHEN s.gender = 'Male' THEN 1 ELSE 0 END) AS male_count,
                SUM(CASE WHEN s.gender = 'Female' THEN 1 ELSE 0 END) AS female_count,
                SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN r.status IN ('Completed', 'Submitted') THEN 1 ELSE 0 END) AS completed_count,
                COALESCE(SUM(r.fee_paid_ugx), 0) AS total_fees_paid_ugx
         FROM registrations r
         JOIN students s ON s.student_id = r.student_id
         JOIN courses c ON c.course_id = s.course_id
         ${whereClause}
         GROUP BY c.course_id
         ORDER BY total_registrations DESC`
      )
      .all(...params) as Array<Record<string, unknown>>;
  } else if (reportType === 'by_session') {
    groupedSummary = db
      .prepare(
        `SELECT es.session_name, es.assessment_year, es.status AS session_status,
                COUNT(r.reg_id) AS total_registrations,
                SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN r.status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN r.status = 'Submitted' THEN 1 ELSE 0 END) AS submitted_count,
                COALESCE(SUM(r.fee_paid_ugx), 0) AS total_fees_paid_ugx
         FROM registrations r
         JOIN students s ON s.student_id = r.student_id
         JOIN exam_sessions es ON es.session_id = r.session_id
         ${whereClause}
         GROUP BY es.session_id
         ORDER BY es.assessment_year DESC`
      )
      .all(...params) as Array<Record<string, unknown>>;
  } else if (reportType === 'by_academic_year') {
    groupedSummary = db
      .prepare(
        `SELECT s.academic_year,
                COUNT(r.reg_id) AS total_registrations,
                SUM(CASE WHEN s.gender = 'Male' THEN 1 ELSE 0 END) AS male_count,
                SUM(CASE WHEN s.gender = 'Female' THEN 1 ELSE 0 END) AS female_count,
                SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN r.status IN ('Completed', 'Submitted') THEN 1 ELSE 0 END) AS completed_count
         FROM registrations r
         JOIN students s ON s.student_id = r.student_id
         JOIN exam_sessions es ON es.session_id = r.session_id
         ${whereClause}
         GROUP BY s.academic_year
         ORDER BY s.academic_year DESC`
      )
      .all(...params) as Array<Record<string, unknown>>;
  } else if (reportType === 'gender_stats') {
    groupedSummary = db
      .prepare(
        `SELECT s.gender,
                COUNT(r.reg_id) AS total_registrations,
                SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN r.status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN r.status = 'Submitted' THEN 1 ELSE 0 END) AS submitted_count,
                SUM(CASE WHEN r.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_count
         FROM registrations r
         JOIN students s ON s.student_id = r.student_id
         JOIN exam_sessions es ON es.session_id = r.session_id
         ${whereClause}
         GROUP BY s.gender`
      )
      .all(...params) as Array<Record<string, unknown>>;
  }

  const totalFeesExpected = rows.reduce((acc, r) => acc + Number(r.exam_fee_ugx || 0), 0);
  const totalFeesPaid = rows.reduce((acc, r) => acc + Number(r.fee_paid_ugx || 0), 0);

  res.json({
    reportType,
    generatedAt: new Date().toISOString(),
    totalRecords: rows.length,
    totalFeesExpected,
    totalFeesPaid,
    groupedSummary,
    rows,
  });
});

// ---------- USER MANAGEMENT (ADMIN ONLY) ----------

app.get(
  '/api/users',
  requireAuth,
  requireRole('Administrator'),
  (_req: AuthenticatedRequest, res: Response) => {
    const users = db
      .prepare(
        'SELECT user_id, username, full_name, email, role, is_active, must_change_password, last_login, created_at FROM users ORDER BY user_id ASC'
      )
      .all();
    res.json({ users });
  }
);

app.post(
  '/api/users',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const username = cleanStr(req.body?.username);
    const fullName = cleanStr(req.body?.full_name);
    const email = cleanStr(req.body?.email);
    const role = cleanStr(req.body?.role);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !fullName || !password) {
      res.status(400).json({ error: 'Username, full name, and initial password are required.' });
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3-32 valid characters.' });
      return;
    }
    if (!['Administrator', 'Registration Officer', 'School Staff'].includes(role)) {
      res.status(400).json({ error: 'Invalid user role.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }
    if (email && !isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }

    const dup = db
      .prepare('SELECT user_id FROM users WHERE LOWER(username) = ?')
      .get(username.toLowerCase());
    if (dup) {
      res.status(409).json({ error: `Username "${username}" is already taken.` });
      return;
    }

    const passwordHash = hashPassword(password);
    const result = db
      .prepare(
        'INSERT INTO users (username, password_hash, full_name, email, role, is_active, must_change_password) VALUES (?, ?, ?, ?, ?, 1, 1)'
      )
      .run(username, passwordHash, fullName, email || null, role);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Created user account ${username} (${role})`,
      'user',
      String(result.lastInsertRowid)
    );
    res.status(201).json({ user_id: Number(result.lastInsertRowid) });
  }
);

app.put(
  '/api/users/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = Number(req.params.id);
    const fullName = cleanStr(req.body?.full_name);
    const email = cleanStr(req.body?.email);
    const role = cleanStr(req.body?.role);
    const isActive = req.body?.is_active === 0 ? 0 : 1;

    if (!fullName || !['Administrator', 'Registration Officer', 'School Staff'].includes(role)) {
      res.status(400).json({ error: 'Valid full name and role are required.' });
      return;
    }

    if (userId === req.authUser!.user_id && isActive === 0) {
      res.status(400).json({ error: 'You cannot deactivate your own active administrator session.' });
      return;
    }

    db.prepare(
      "UPDATE users SET full_name = ?, email = ?, role = ?, is_active = ?, updated_at = datetime('now') WHERE user_id = ?"
    ).run(fullName, email || null, role, isActive, userId);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Updated user #${userId} (${role}, active=${isActive})`,
      'user',
      String(userId)
    );
    res.json({ ok: true });
  }
);

app.post(
  '/api/users/:id/reset-password',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = Number(req.params.id);
    const newPassword =
      typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Temporary password must be at least 8 characters.' });
      return;
    }

    const user = db
      .prepare('SELECT username FROM users WHERE user_id = ?')
      .get(userId) as { username: string } | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const hash = hashPassword(newPassword);
    db.prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now') WHERE user_id = ?"
    ).run(hash, userId);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Reset password for user ${user.username}`,
      'user',
      String(userId)
    );
    res.json({ ok: true });
  }
);

app.delete(
  '/api/users/:id',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = Number(req.params.id);
    if (userId === req.authUser!.user_id) {
      res.status(400).json({ error: 'You cannot delete your own account.' });
      return;
    }
    const user = db
      .prepare('SELECT username FROM users WHERE user_id = ?')
      .get(userId) as { username: string } | undefined;
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    db.prepare('DELETE FROM users WHERE user_id = ?').run(userId);
    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Deleted user account ${user.username}`,
      'user',
      String(userId)
    );
    res.json({ ok: true });
  }
);

// ---------- PASSWORD RESET REQUESTS ----------

app.get(
  '/api/password-requests',
  requireAuth,
  requireRole('Administrator'),
  (_req: AuthenticatedRequest, res: Response) => {
    const requests = db
      .prepare('SELECT * FROM password_reset_requests ORDER BY request_id DESC LIMIT 50')
      .all();
    res.json({ requests });
  }
);

app.post(
  '/api/password-requests/:id/resolve',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.id);
    const action = cleanStr(req.body?.action);
    const tempPassword =
      typeof req.body?.tempPassword === 'string' ? req.body.tempPassword : '';

    const resetReq = db
      .prepare('SELECT * FROM password_reset_requests WHERE request_id = ?')
      .get(requestId) as
      | { request_id: number; username: string; status: string }
      | undefined;

    if (!resetReq) {
      res.status(404).json({ error: 'Reset request not found.' });
      return;
    }

    if (action === 'reject') {
      db.prepare(
        "UPDATE password_reset_requests SET status = 'Rejected', resolved_at = datetime('now'), resolved_by = ? WHERE request_id = ?"
      ).run(req.authUser!.user_id, requestId);
      logActivity(
        req.authUser!.user_id,
        req.authUser!.username,
        `Rejected password reset request for ${resetReq.username}`,
        'password_reset',
        String(requestId)
      );
      res.json({ ok: true });
      return;
    }

    if (tempPassword.length < 8) {
      res.status(400).json({ error: 'Temporary password must be at least 8 characters.' });
      return;
    }

    const hash = hashPassword(tempPassword);
    db.prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now') WHERE username = ?"
    ).run(hash, resetReq.username);
    db.prepare(
      "UPDATE password_reset_requests SET status = 'Resolved', resolved_at = datetime('now'), resolved_by = ? WHERE request_id = ?"
    ).run(req.authUser!.user_id, requestId);

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      `Resolved password reset request for ${resetReq.username}`,
      'password_reset',
      String(requestId)
    );
    res.json({ ok: true });
  }
);

// ---------- SETTINGS, AUDIT LOGS & SQL BACKUP ----------

app.get('/api/settings', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const rows = db.prepare('SELECT setting_key, setting_value FROM system_settings').all() as Array<{
    setting_key: string;
    setting_value: string;
  }>;
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    } catch {
      settings[row.setting_key] = row.setting_value;
    }
  }
  res.json({ settings });
});

app.put(
  '/api/settings',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const incoming = req.body?.settings;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Settings payload is required.' });
      return;
    }

    const allowedKeys = new Set([
      'institution_name',
      'institution_location',
      'assessment_programmes',
      'exam_levels',
      'academic_years',
    ]);

    const upsert = db.prepare(
      "INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')"
    );

    for (const [key, val] of Object.entries(incoming as Record<string, unknown>)) {
      if (!allowedKeys.has(key)) continue;
      const serialized = typeof val === 'string' ? val : JSON.stringify(val);
      upsert.run(key, serialized);
    }

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      'Updated configurable UVTAB system settings',
      'settings',
      'system_settings'
    );
    res.json({ ok: true });
  }
);

app.get(
  '/api/audit-logs',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 50));
    const logs = db
      .prepare('SELECT * FROM activity_logs ORDER BY log_id DESC LIMIT ?')
      .all(limit);
    res.json({ logs });
  }
);

function sqlEscape(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${str}'`;
}

app.get(
  '/api/backup/sql',
  requireAuth,
  requireRole('Administrator'),
  (req: AuthenticatedRequest, res: Response) => {
    const tables = [
      'departments',
      'courses',
      'exam_sessions',
      'students',
      'registrations',
      'system_settings',
      'activity_logs',
    ];

    const lines: string[] = [
      '-- ALLIANCE VOCATIONAL SCHOOL - IBANDA',
      '-- UVTAB Student Registration Management System - Live Database Backup',
      `-- Exported At: ${new Date().toISOString()}`,
      'CREATE DATABASE IF NOT EXISTS `alliance_uvtab_registration`;',
      'USE `alliance_uvtab_registration`;',
      '',
    ];

    for (const table of tables) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<
        Record<string, unknown>
      >;
      lines.push(`-- Table data for \`${table}\` (${rows.length} rows)`);
      for (const row of rows) {
        const cols = Object.keys(row)
          .map((c) => `\`${c}\``)
          .join(', ');
        const vals = Object.values(row).map(sqlEscape).join(', ');
        lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES (${vals});`);
      }
      lines.push('');
    }

    logActivity(
      req.authUser!.user_id,
      req.authUser!.username,
      'Generated SQL database backup export',
      'backup',
      'alliance_uvtab_registration'
    );

    const filename = `alliance_uvtab_backup_${new Date().toISOString().slice(0, 10)}.sql`;
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(lines.join('\n'));
  }
);

// ---------- VITE / STATIC SERVING ----------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alliance Vocational School UVTAB server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
