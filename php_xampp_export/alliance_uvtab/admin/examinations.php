<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/authentication.php';
requireLogin();

$pageTitle = 'UVTAB Examination Sessions';
$isAdmin = ($_SESSION['role'] ?? '') === 'Administrator';
$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $isAdmin && isset($_POST['add_session'])) {
    verifyCsrf();
    $pdo->prepare('INSERT INTO examination_sessions (session_name, assessment_programme, assessment_year, exam_levels, opening_date, closing_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            trim($_POST['session_name']),
            trim($_POST['assessment_programme']),
            (int)$_POST['assessment_year'],
            trim($_POST['exam_levels']),
            $_POST['opening_date'],
            $_POST['closing_date'],
            $_POST['status'] === 'Closed' ? 'Closed' : 'Open',
        ]);
    $message = 'Examination session created.';
}

$sessions = $pdo->query("
  SELECT es.*, COUNT(r.reg_id) AS total_registered
  FROM examination_sessions es
  LEFT JOIN registrations r ON r.session_id = es.session_id
  GROUP BY es.session_id
  ORDER BY es.assessment_year DESC
")->fetchAll();

include __DIR__ . '/../includes/header.php';
?>
<?php if ($message): ?><div class="alert alert-success"><?= e($message) ?></div><?php endif; ?>

<?php if ($isAdmin): ?>
<form method="POST" class="card p-3 mb-4">
  <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
  <input type="hidden" name="add_session" value="1">
  <div class="row g-2 align-items-end">
    <div class="col-md-3"><label class="form-label small fw-semibold">Session Name</label><input type="text" name="session_name" class="form-control form-control-sm" required></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Programme</label><input type="text" name="assessment_programme" class="form-control form-control-sm" value="UVTAB National Certificate (Full Assessment)" required></div>
    <div class="col-md-1"><label class="form-label small fw-semibold">Year</label><input type="number" name="assessment_year" class="form-control form-control-sm" value="<?= date('Y') ?>" required></div>
    <div class="col-md-2"><label class="form-label small fw-semibold">Opening</label><input type="date" name="opening_date" class="form-control form-control-sm" required></div>
    <div class="col-md-2"><label class="form-label small fw-semibold">Closing</label><input type="date" name="closing_date" class="form-control form-control-sm" required></div>
    <input type="hidden" name="exam_levels" value="Level 1 (Year 1), Level 2 (Year 2)">
    <input type="hidden" name="status" value="Open">
    <div class="col-md-1"><button type="submit" class="btn btn-navy btn-sm w-100">Add</button></div>
  </div>
</form>
<?php endif; ?>

<div class="card">
  <div class="table-responsive">
    <table class="table table-hover mb-0 small">
      <thead class="table-light"><tr><th>Session</th><th>Programme</th><th>Year</th><th>Window</th><th>Status</th><th>Registered</th></tr></thead>
      <tbody>
        <?php foreach ($sessions as $s): ?>
          <tr>
            <td class="fw-semibold"><?= e($s['session_name']) ?></td>
            <td><?= e($s['assessment_programme']) ?></td>
            <td><?= e((string)$s['assessment_year']) ?></td>
            <td><?= e($s['opening_date']) ?> to <?= e($s['closing_date']) ?></td>
            <td><?= e($s['status']) ?></td>
            <td><?= (int)$s['total_registered'] ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php include __DIR__ . '/../includes/footer.php'; ?>
