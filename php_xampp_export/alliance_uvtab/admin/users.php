<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/authentication.php';
requireAdmin();

$pageTitle = 'User Management';
$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_user'])) {
    verifyCsrf();
    $username = trim($_POST['username'] ?? '');
    $fullName = trim($_POST['full_name'] ?? '');
    $role = $_POST['role'] ?? 'Registration Officer';
    $password = $_POST['password'] ?? '';

    if (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters.';
    } else {
        try {
            $pdo->prepare('INSERT INTO users (username, password_hash, full_name, role, must_change_password) VALUES (?, ?, ?, ?, 1)')
                ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullName, $role]);
            logSystemActivity($pdo, "Created user {$username} ({$role})", 'user');
            $message = "User {$username} created.";
        } catch (PDOException $ex) {
            $error = 'Username already exists.';
        }
    }
}

$users = $pdo->query('SELECT user_id, username, full_name, role, is_active, last_login FROM users ORDER BY user_id ASC')->fetchAll();

include __DIR__ . '/../includes/header.php';
?>
<?php if ($message): ?><div class="alert alert-success"><?= e($message) ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-danger"><?= e($error) ?></div><?php endif; ?>

<form method="POST" class="card p-3 mb-4">
  <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
  <input type="hidden" name="add_user" value="1">
  <div class="row g-2 align-items-end">
    <div class="col-md-3"><label class="form-label small fw-semibold">Username</label><input type="text" name="username" class="form-control form-control-sm" required></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Full Name</label><input type="text" name="full_name" class="form-control form-control-sm" required></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Role</label>
      <select name="role" class="form-select form-select-sm">
        <option value="Registration Officer">Registration Officer</option>
        <option value="Administrator">Administrator</option>
        <option value="School Staff">School Staff</option>
      </select>
    </div>
    <div class="col-md-2"><label class="form-label small fw-semibold">Temp Password</label><input type="password" name="password" class="form-control form-control-sm" minlength="8" required></div>
    <div class="col-md-1"><button type="submit" class="btn btn-navy btn-sm w-100">Add</button></div>
  </div>
</form>

<div class="card">
  <div class="table-responsive">
    <table class="table table-hover mb-0 small">
      <thead class="table-light"><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Last Login</th></tr></thead>
      <tbody>
        <?php foreach ($users as $u): ?>
          <tr>
            <td class="fw-semibold"><?= e($u['username']) ?></td>
            <td><?= e($u['full_name']) ?></td>
            <td><?= e($u['role']) ?></td>
            <td><?= $u['is_active'] ? 'Active' : 'Inactive' ?></td>
            <td><?= e($u['last_login'] ?? 'Never') ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php include __DIR__ . '/../includes/footer.php'; ?>
