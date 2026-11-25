<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/authentication.php';
requireLogin();

$pageTitle = 'Course & Department Management';
$isAdmin = ($_SESSION['role'] ?? '') === 'Administrator';
$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $isAdmin) {
    verifyCsrf();
    if (isset($_POST['add_course'])) {
        $name = trim($_POST['course_name'] ?? '');
        $code = strtoupper(trim($_POST['course_code'] ?? ''));
        $deptId = (int)($_POST['dept_id'] ?? 0) ?: null;
        $fee = (int)($_POST['fee_ugx'] ?? 130000);
        try {
            $pdo->prepare('INSERT INTO courses (course_name, course_code, dept_id, fee_ugx) VALUES (?, ?, ?, ?)')
                ->execute([$name, $code, $deptId, $fee]);
            logSystemActivity($pdo, "Added course {$name} ({$code})", 'course');
            $message = "Course {$name} added.";
        } catch (PDOException $ex) {
            $error = 'Course code already exists.';
        }
    } elseif (isset($_POST['delete_course'])) {
        $cid = (int)$_POST['delete_course'];
        $cnt = (int)$pdo->prepare('SELECT COUNT(*) FROM students WHERE course_id = ?')->execute([$cid]) ? 0 : 0;
        $check = $pdo->prepare('SELECT COUNT(*) FROM students WHERE course_id = ?');
        $check->execute([$cid]);
        if ((int)$check->fetchColumn() > 0) {
            $error = 'Cannot delete course with registered students.';
        } else {
            $pdo->prepare('DELETE FROM courses WHERE course_id = ?')->execute([$cid]);
            $message = 'Course deleted.';
        }
    }
}

$departments = $pdo->query('SELECT * FROM departments ORDER BY dept_name')->fetchAll();
$courses = $pdo->query('SELECT c.*, d.dept_name FROM courses c LEFT JOIN departments d ON d.dept_id = c.dept_id ORDER BY c.course_name')->fetchAll();

include __DIR__ . '/../includes/header.php';
?>
<?php if ($message): ?><div class="alert alert-success"><?= e($message) ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-danger"><?= e($error) ?></div><?php endif; ?>

<?php if ($isAdmin): ?>
<form method="POST" class="card p-3 mb-4">
  <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
  <input type="hidden" name="add_course" value="1">
  <div class="row g-2 align-items-end">
    <div class="col-md-4"><label class="form-label small fw-semibold">Course Name</label><input type="text" name="course_name" class="form-control form-control-sm" required></div>
    <div class="col-md-2"><label class="form-label small fw-semibold">Code</label><input type="text" name="course_code" class="form-control form-control-sm" required></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Department</label>
      <select name="dept_id" class="form-select form-select-sm">
        <?php foreach ($departments as $d): ?>
          <option value="<?= (int)$d['dept_id'] ?>"><?= e($d['dept_name']) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-2"><label class="form-label small fw-semibold">Fee (UGX)</label><input type="number" name="fee_ugx" class="form-control form-control-sm" value="135000"></div>
    <div class="col-md-1"><button type="submit" class="btn btn-navy btn-sm w-100">Add</button></div>
  </div>
</form>
<?php endif; ?>

<div class="card">
  <div class="table-responsive">
    <table class="table table-hover mb-0 small">
      <thead class="table-light"><tr><th>Code</th><th>Course Name</th><th>Department</th><th>Fee (UGX)</th><?php if ($isAdmin): ?><th>Action</th><?php endif; ?></tr></thead>
      <tbody>
        <?php foreach ($courses as $c): ?>
          <tr>
            <td class="fw-bold"><?= e($c['course_code']) ?></td>
            <td><?= e($c['course_name']) ?></td>
            <td><?= e($c['dept_name'] ?? '—') ?></td>
            <td>UGX <?= number_format((int)$c['fee_ugx']) ?></td>
            <?php if ($isAdmin): ?>
              <td>
                <form method="POST" data-confirm="Delete course <?= e($c['course_name']) ?>?">
                  <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                  <input type="hidden" name="delete_course" value="<?= (int)$c['course_id'] ?>">
                  <button type="submit" class="btn btn-outline-danger btn-sm">Delete</button>
                </form>
              </td>
            <?php endif; ?>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php include __DIR__ . '/../includes/footer.php'; ?>
