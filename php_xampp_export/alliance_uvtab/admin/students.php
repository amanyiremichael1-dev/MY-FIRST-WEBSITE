<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/authentication.php';
requireLogin();

$pageTitle = 'Student Records Management';
$isAdmin = ($_SESSION['role'] ?? '') === 'Administrator';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id']) && $isAdmin) {
    verifyCsrf();
    $delId = trim($_POST['delete_id']);
    $pdo->prepare('DELETE FROM students WHERE student_id = ?')->execute([$delId]);
    logSystemActivity($pdo, "Deleted student {$delId}", 'student', $delId);
    header('Location: students.php');
    exit;
}

$search = trim($_GET['search'] ?? '');
$where = '';
$params = [];
if ($search !== '') {
    $where = 'WHERE s.full_name LIKE ? OR s.reg_number LIKE ? OR s.student_id LIKE ?';
    $term = "%{$search}%";
    $params = [$term, $term, $term];
}

$stmt = $pdo->prepare("
  SELECT s.*, c.course_name, c.course_code, r.status AS reg_status
  FROM students s
  JOIN courses c ON c.course_id = s.course_id
  LEFT JOIN registrations r ON r.student_id = s.student_id
  {$where}
  ORDER BY s.created_at DESC
");
$stmt->execute($params);
$students = $stmt->fetchAll();

include __DIR__ . '/../includes/header.php';
?>
<div class="card p-3 mb-3">
  <form method="GET" class="row g-2 align-items-center">
    <div class="col-md-6"><input type="text" name="search" class="form-control form-control-sm" placeholder="Search by name, ID, or registration number..." value="<?= e($search) ?>"></div>
    <div class="col-auto"><button type="submit" class="btn btn-navy btn-sm">Search</button></div>
    <div class="col-auto ms-auto"><a href="register_student.php" class="btn btn-primary btn-sm">Register Student</a></div>
  </form>
</div>

<div class="card">
  <div class="table-responsive">
    <table class="table table-hover mb-0 small">
      <thead class="table-light">
        <tr><th>Student ID</th><th>Name</th><th>Reg Number</th><th>Gender</th><th>Course</th><th>Level</th><th>Year</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        <?php foreach ($students as $s): ?>
          <tr>
            <td><?= e($s['student_id']) ?></td>
            <td><?= e($s['full_name']) ?></td>
            <td><?= e($s['reg_number']) ?></td>
            <td><?= e($s['gender']) ?></td>
            <td><?= e($s['course_code']) ?></td>
            <td><?= e($s['exam_level']) ?></td>
            <td><?= e($s['academic_year']) ?></td>
            <td><?= e($s['reg_status'] ?? 'Pending') ?></td>
            <td class="d-flex gap-1">
              <a href="register_student.php?edit=<?= urlencode($s['student_id']) ?>" class="btn btn-outline-primary btn-sm">Edit</a>
              <?php if ($isAdmin): ?>
                <form method="POST" data-confirm="Delete student <?= e($s['full_name']) ?>?">
                  <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                  <input type="hidden" name="delete_id" value="<?= e($s['student_id']) ?>">
                  <button type="submit" class="btn btn-outline-danger btn-sm">Delete</button>
                </form>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php include __DIR__ . '/../includes/footer.php'; ?>
