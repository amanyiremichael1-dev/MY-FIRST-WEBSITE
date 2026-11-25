<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/authentication.php';
requireLogin();

if (!in_array($_SESSION['role'], ['Administrator', 'Registration Officer'], true)) {
    http_response_code(403);
    die('Access denied.');
}

$pageTitle = 'Student Registration';
$editId = trim($_GET['edit'] ?? '');
$student = null;
$error = '';
$success = '';

if ($editId !== '') {
    $stmt = $pdo->prepare('
        SELECT s.*, r.reg_id, r.session_id, r.assessment_programme, r.assessment_year, r.reg_date, r.exam_fee_ugx, r.fee_paid_ugx, r.status
        FROM students s
        LEFT JOIN registrations r ON r.student_id = s.student_id
        WHERE s.student_id = ?
        ORDER BY r.reg_id DESC LIMIT 1
    ');
    $stmt->execute([$editId]);
    $student = $stmt->fetch();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    $fullName = trim($_POST['full_name'] ?? '');
    $gender = $_POST['gender'] ?? 'Male';
    $dob = $_POST['dob'] ?? '';
    $phone = trim($_POST['phone'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $district = trim($_POST['district'] ?? '');
    $address = trim($_POST['address'] ?? '');
    $courseId = (int)($_POST['course_id'] ?? 0);
    $yearOfStudy = trim($_POST['year_of_study'] ?? '');
    $academicYear = trim($_POST['academic_year'] ?? '');
    $regNumber = strtoupper(trim($_POST['reg_number'] ?? ''));
    $examLevel = trim($_POST['exam_level'] ?? '');
    $sessionId = (int)($_POST['session_id'] ?? 0);
    $programme = trim($_POST['assessment_programme'] ?? '');
    $assessmentYear = (int)($_POST['assessment_year'] ?? date('Y'));
    $regDate = $_POST['reg_date'] ?? date('Y-m-d');
    $examFee = (int)($_POST['exam_fee_ugx'] ?? 0);
    $feePaid = (int)($_POST['fee_paid_ugx'] ?? 0);
    $status = $_POST['status'] ?? 'Pending';

    $dupStmt = $pdo->prepare('SELECT student_id FROM students WHERE UPPER(reg_number) = ? AND student_id != ?');
    $dupStmt->execute([$regNumber, $editId]);
    if ($dupStmt->fetch()) {
        $error = "Duplicate registration number: {$regNumber} is already assigned.";
    } else {
        $courseRow = $pdo->prepare('SELECT dept_id FROM courses WHERE course_id = ?');
        $courseRow->execute([$courseId]);
        $deptId = $courseRow->fetchColumn() ?: null;

        $pdo->beginTransaction();
        try {
            if ($student) {
                $pdo->prepare('UPDATE students SET full_name=?, gender=?, dob=?, phone=?, email=?, district=?, address=?, course_id=?, department_id=?, year_of_study=?, academic_year=?, reg_number=?, exam_level=? WHERE student_id=?')
                    ->execute([$fullName, $gender, $dob, $phone, $email ?: null, $district, $address, $courseId, $deptId, $yearOfStudy, $academicYear, $regNumber, $examLevel, $student['student_id']]);
                if (!empty($student['reg_id'])) {
                    $pdo->prepare('UPDATE registrations SET session_id=?, assessment_programme=?, assessment_year=?, reg_date=?, exam_fee_ugx=?, fee_paid_ugx=?, status=? WHERE reg_id=?')
                        ->execute([$sessionId, $programme, $assessmentYear, $regDate, $examFee, $feePaid, $status, $student['reg_id']]);
                }
                logSystemActivity($pdo, "Updated student {$fullName} ({$student['student_id']})", 'student', $student['student_id']);
                $success = 'Student registration updated successfully.';
            } else {
                $prefix = 'AVS-' . $assessmentYear . '-';
                $lastId = $pdo->prepare('SELECT student_id FROM students WHERE student_id LIKE ? ORDER BY student_id DESC LIMIT 1');
                $lastId->execute([$prefix . '%']);
                $prev = $lastId->fetchColumn();
                $nextNum = $prev ? ((int)substr($prev, strlen($prefix)) + 1) : 1;
                $newStudentId = $prefix . str_pad((string)$nextNum, 4, '0', STR_PAD_LEFT);

                $pdo->prepare('INSERT INTO students (student_id, full_name, gender, dob, phone, email, district, address, course_id, department_id, year_of_study, academic_year, reg_number, exam_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                    ->execute([$newStudentId, $fullName, $gender, $dob, $phone, $email ?: null, $district, $address, $courseId, $deptId, $yearOfStudy, $academicYear, $regNumber, $examLevel]);
                $pdo->prepare('INSERT INTO registrations (student_id, session_id, assessment_programme, assessment_year, reg_date, exam_fee_ugx, fee_paid_ugx, status, registered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                    ->execute([$newStudentId, $sessionId, $programme, $assessmentYear, $regDate, $examFee, $feePaid, $status, $_SESSION['user_id']]);
                logSystemActivity($pdo, "Registered student {$fullName} ({$regNumber})", 'student', $newStudentId);
                $success = "Student registered successfully with ID {$newStudentId}.";
            }
            $pdo->commit();
        } catch (Throwable $ex) {
            $pdo->rollBack();
            $error = 'Error saving student registration.';
        }
    }
}

$courses = $pdo->query('SELECT * FROM courses WHERE is_active = 1 ORDER BY course_name')->fetchAll();
$sessions = $pdo->query('SELECT * FROM examination_sessions ORDER BY assessment_year DESC')->fetchAll();

include __DIR__ . '/../includes/header.php';
?>

<?php if ($error): ?><div class="alert alert-danger"><?= e($error) ?></div><?php endif; ?>
<?php if ($success): ?><div class="alert alert-success"><?= e($success) ?></div><?php endif; ?>

<form method="POST" class="card p-4">
  <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
  <h5 class="fw-bold mb-3">Personal, Academic &amp; UVTAB Information</h5>
  <div class="row g-3">
    <div class="col-md-6"><label class="form-label small fw-semibold">Full Name *</label><input type="text" name="full_name" class="form-control" required value="<?= e($student['full_name'] ?? '') ?>"></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Gender *</label><select name="gender" class="form-select"><option value="Male">Male</option><option value="Female" <?= ($student['gender'] ?? '') === 'Female' ? 'selected' : '' ?>>Female</option></select></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Date of Birth *</label><input type="date" name="dob" class="form-control" required value="<?= e($student['dob'] ?? '') ?>"></div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Telephone *</label><input type="text" name="phone" class="form-control" required value="<?= e($student['phone'] ?? '') ?>"></div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Email (Optional)</label><input type="email" name="email" class="form-control" value="<?= e($student['email'] ?? '') ?>"></div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Home District *</label><input type="text" name="district" class="form-control" required value="<?= e($student['district'] ?? 'Ibanda') ?>"></div>
    <div class="col-md-6"><label class="form-label small fw-semibold">Village / Address *</label><input type="text" name="address" class="form-control" required value="<?= e($student['address'] ?? '') ?>"></div>
    <div class="col-md-6"><label class="form-label small fw-semibold">Course *</label>
      <select name="course_id" class="form-select" required>
        <?php foreach ($courses as $c): ?>
          <option value="<?= (int)$c['course_id'] ?>" <?= (int)($student['course_id'] ?? 0) === (int)$c['course_id'] ? 'selected' : '' ?>><?= e($c['course_code'] . ' - ' . $c['course_name']) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Year of Study *</label><input type="text" name="year_of_study" class="form-control" required value="<?= e($student['year_of_study'] ?? 'Year 1') ?>"></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Academic Year *</label><input type="text" name="academic_year" class="form-control" required value="<?= e($student['academic_year'] ?? '2026/2027') ?>"></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Registration Number *</label><input type="text" name="reg_number" class="form-control" required value="<?= e($student['reg_number'] ?? '') ?>"></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Examination Level *</label><input type="text" name="exam_level" class="form-control" required value="<?= e($student['exam_level'] ?? 'Level 1 (Year 1)') ?>"></div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Examination Session *</label>
      <select name="session_id" class="form-select" required>
        <?php foreach ($sessions as $s): ?>
          <option value="<?= (int)$s['session_id'] ?>" <?= (int)($student['session_id'] ?? 0) === (int)$s['session_id'] ? 'selected' : '' ?>><?= e($s['session_name']) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Assessment Programme *</label><input type="text" name="assessment_programme" class="form-control" required value="<?= e($student['assessment_programme'] ?? 'UVTAB National Certificate (Full Assessment)') ?>"></div>
    <div class="col-md-2"><label class="form-label small fw-semibold">Assessment Year *</label><input type="number" name="assessment_year" class="form-control" required value="<?= e((string)($student['assessment_year'] ?? date('Y'))) ?>"></div>
    <div class="col-md-2"><label class="form-label small fw-semibold">Reg Date *</label><input type="date" name="reg_date" class="form-control" required value="<?= e($student['reg_date'] ?? date('Y-m-d')) ?>"></div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Exam Fee (UGX)</label><input type="number" name="exam_fee_ugx" class="form-control" value="<?= e((string)($student['exam_fee_ugx'] ?? 140000)) ?>"></div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Fee Paid (UGX)</label><input type="number" name="fee_paid_ugx" class="form-control" value="<?= e((string)($student['fee_paid_ugx'] ?? 0)) ?>"></div>
    <div class="col-md-4"><label class="form-label small fw-semibold">Status *</label>
      <select name="status" class="form-select">
        <?php foreach (['Pending', 'Completed', 'Submitted', 'Cancelled'] as $st): ?>
          <option value="<?= $st ?>" <?= ($student['status'] ?? 'Pending') === $st ? 'selected' : '' ?>><?= $st ?></option>
        <?php endforeach; ?>
      </select>
    </div>
  </div>
  <div class="mt-4 d-flex gap-2 justify-content-end">
    <a href="students.php" class="btn btn-outline-secondary">Cancel</a>
    <button type="reset" class="btn btn-outline-secondary">Clear Form</button>
    <button type="submit" class="btn btn-navy"><?= $student ? 'Update' : 'Save Registration' ?></button>
  </div>
</form>

<?php include __DIR__ . '/../includes/footer.php'; ?>
