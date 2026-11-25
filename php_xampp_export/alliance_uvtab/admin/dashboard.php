<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/authentication.php';
requireLogin();

$pageTitle = 'Administrative Dashboard';

$totalStudents = (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn();
$totalRegs = (int)$pdo->query('SELECT COUNT(*) FROM registrations')->fetchColumn();
$totalCourses = (int)$pdo->query('SELECT COUNT(*) FROM courses WHERE is_active = 1')->fetchColumn();
$totalSessions = (int)$pdo->query('SELECT COUNT(*) FROM examination_sessions')->fetchColumn();
$pendingRegs = (int)$pdo->query("SELECT COUNT(*) FROM registrations WHERE status = 'Pending'")->fetchColumn();
$completedRegs = (int)$pdo->query("SELECT COUNT(*) FROM registrations WHERE status = 'Completed'")->fetchColumn();

$recentStudents = $pdo->query("
  SELECT s.student_id, s.full_name, s.reg_number, c.course_code, r.status, r.reg_date
  FROM students s
  JOIN courses c ON c.course_id = s.course_id
  LEFT JOIN registrations r ON r.student_id = s.student_id
  ORDER BY s.created_at DESC
  LIMIT 6
")->fetchAll();

$recentLogs = $pdo->query('SELECT username, action, log_time FROM activity_logs ORDER BY log_id DESC LIMIT 8')->fetchAll();

include __DIR__ . '/../includes/header.php';
?>

<div class="row g-3 mb-4">
  <div class="col-md-4 col-lg-2"><div class="card p-3"><div class="small text-muted">Total Students</div><div class="h3 fw-bold mb-0"><?= $totalStudents ?></div></div></div>
  <div class="col-md-4 col-lg-2"><div class="card p-3"><div class="small text-muted">Registrations</div><div class="h3 fw-bold mb-0"><?= $totalRegs ?></div></div></div>
  <div class="col-md-4 col-lg-2"><div class="card p-3"><div class="small text-muted">Courses</div><div class="h3 fw-bold mb-0"><?= $totalCourses ?></div></div></div>
  <div class="col-md-4 col-lg-2"><div class="card p-3"><div class="small text-muted">Exam Sessions</div><div class="h3 fw-bold mb-0"><?= $totalSessions ?></div></div></div>
  <div class="col-md-4 col-lg-2"><div class="card p-3"><div class="small text-muted">Pending</div><div class="h3 fw-bold text-warning mb-0"><?= $pendingRegs ?></div></div></div>
  <div class="col-md-4 col-lg-2"><div class="card p-3"><div class="small text-muted">Completed</div><div class="h3 fw-bold text-success mb-0"><?= $completedRegs ?></div></div></div>
</div>

<div class="row g-4">
  <div class="col-lg-7">
    <div class="card">
      <div class="card-header bg-white fw-bold d-flex justify-content-between align-items-center">
        <span>Recent Student Registrations</span>
        <a href="students.php" class="small">View All</a>
      </div>
      <div class="table-responsive">
        <table class="table table-hover mb-0 small">
          <thead class="table-light">
            <tr><th>ID</th><th>Name</th><th>Reg Number</th><th>Course</th><th>Status</th></tr>
          </thead>
          <tbody>
            <?php foreach ($recentStudents as $row): ?>
              <tr>
                <td><?= e($row['student_id']) ?></td>
                <td><?= e($row['full_name']) ?></td>
                <td><?= e($row['reg_number']) ?></td>
                <td><?= e($row['course_code']) ?></td>
                <td><?= e($row['status'] ?? 'Pending') ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="col-lg-5">
    <div class="card">
      <div class="card-header bg-white fw-bold">Recent System Activities</div>
      <ul class="list-group list-group-flush small">
        <?php foreach ($recentLogs as $log): ?>
          <li class="list-group-item">
            <div class="fw-semibold"><?= e($log['action']) ?></div>
            <div class="text-muted"><?= e($log['username']) ?> · <?= e($log['log_time']) ?></div>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>
