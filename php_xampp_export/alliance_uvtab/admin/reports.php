<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/authentication.php';
requireLogin();

$pageTitle = 'UVTAB Registration Reports';
$rows = $pdo->query("
  SELECT s.student_id, s.full_name, s.gender, s.reg_number, c.course_code, c.course_name, es.session_name, r.reg_date, r.fee_paid_ugx, r.status
  FROM registrations r
  JOIN students s ON s.student_id = r.student_id
  JOIN courses c ON c.course_id = s.course_id
  JOIN examination_sessions es ON es.session_id = r.session_id
  ORDER BY s.full_name ASC
")->fetchAll();

include __DIR__ . '/../includes/header.php';
?>
<div class="mb-3 d-flex justify-content-end no-print">
  <button type="button" onclick="window.print()" class="btn btn-navy btn-sm">Print Report</button>
</div>
<div class="card p-4">
  <div class="border-bottom pb-3 mb-3">
    <h2 class="h5 fw-bold text-navy mb-0">ALLIANCE VOCATIONAL SCHOOL – IBANDA</h2>
    <div class="fw-semibold small">UVTAB STUDENT REGISTRATION REPORT</div>
    <div class="text-muted small">Generated: <?= date('Y-m-d H:i') ?></div>
  </div>
  <div class="table-responsive">
    <table class="table table-bordered table-sm small mb-0">
      <thead class="table-light">
        <tr><th>Student ID</th><th>Full Name</th><th>Gender</th><th>Reg Number</th><th>Course</th><th>Session</th><th>Fee Paid</th><th>Status</th></tr>
      </thead>
      <tbody>
        <?php foreach ($rows as $r): ?>
          <tr>
            <td><?= e($r['student_id']) ?></td>
            <td><?= e($r['full_name']) ?></td>
            <td><?= e($r['gender']) ?></td>
            <td><?= e($r['reg_number']) ?></td>
            <td><?= e($r['course_code'] . ' - ' . $r['course_name']) ?></td>
            <td><?= e($r['session_name']) ?></td>
            <td>UGX <?= number_format((int)$r['fee_paid_ugx']) ?></td>
            <td><?= e($r['status']) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php include __DIR__ . '/../includes/footer.php'; ?>
