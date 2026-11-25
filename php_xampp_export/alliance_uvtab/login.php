<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/authentication.php';

if (!empty($_SESSION['user_id'])) {
    header('Location: admin/dashboard.php');
    exit;
}

$adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'Administrator' AND is_active = 1")->fetchColumn();
$needsBootstrap = ($adminCount === 0);
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    if ($needsBootstrap && isset($_POST['bootstrap'])) {
        $username = trim($_POST['username'] ?? 'admin');
        $fullName = trim($_POST['full_name'] ?? 'System Administrator');
        $password = $_POST['password'] ?? '';
        if (strlen($password) < 8) {
            $error = 'Administrator password must be at least 8 characters.';
        } else {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, 'Administrator', 1)");
            $stmt->execute([$username, $hash, $fullName]);
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)$pdo->lastInsertId();
            $_SESSION['username'] = $username;
            $_SESSION['full_name'] = $fullName;
            $_SESSION['role'] = 'Administrator';
            logSystemActivity($pdo, 'Completed initial administrator account setup', 'user', (string)$_SESSION['user_id']);
            header('Location: admin/dashboard.php');
            exit;
        }
    } else {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)$user['user_id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['full_name'] = $user['full_name'];
            $_SESSION['role'] = $user['role'];
            $pdo->prepare('UPDATE users SET last_login = NOW() WHERE user_id = ?')->execute([$user['user_id']]);
            logSystemActivity($pdo, 'Signed in to system', 'user', (string)$user['user_id']);
            header('Location: admin/dashboard.php');
            exit;
        }
        $error = 'Invalid username or password.';
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In | Alliance Vocational School – Ibanda</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="bg-navy d-flex align-items-center justify-content-center min-vh-100 p-3">
  <div class="card shadow-lg border-0" style="max-width: 430px; width: 100%; border-radius: 14px;">
    <div class="card-body p-4 p-md-5">
      <div class="text-center mb-4">
        <p class="small fw-semibold text-primary mb-1">IBANDA MUNICIPALITY, UGANDA</p>
        <h1 class="h5 fw-bold text-navy mb-1">ALLIANCE VOCATIONAL SCHOOL – IBANDA</h1>
        <p class="small text-muted">UVTAB Student Registration Management System</p>
      </div>

      <?php if ($error): ?>
        <div class="alert alert-danger py-2 small"><?= e($error) ?></div>
      <?php endif; ?>

      <form method="POST">
        <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
        <?php if ($needsBootstrap): ?>
          <input type="hidden" name="bootstrap" value="1">
          <div class="alert alert-info py-2 small">First-run setup: Create the initial Administrator account.</div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Administrator Username</label>
            <input type="text" name="username" class="form-control" value="admin" required>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Full Name</label>
            <input type="text" name="full_name" class="form-control" value="System Administrator" required>
          </div>
          <div class="mb-4">
            <label class="form-label small fw-semibold">Set Password (min 8 characters)</label>
            <input type="password" name="password" class="form-control" minlength="8" required>
          </div>
          <button type="submit" class="btn btn-navy w-100 py-2 fw-semibold">Create Administrator &amp; Sign In</button>
        <?php else: ?>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Username</label>
            <input type="text" name="username" class="form-control" required>
          </div>
          <div class="mb-4">
            <label class="form-label small fw-semibold">Password</label>
            <input type="password" name="password" class="form-control" required>
          </div>
          <button type="submit" class="btn btn-navy w-100 py-2 fw-semibold">Sign In to Registry</button>
        <?php endif; ?>
      </form>
    </div>
  </div>
</body>
</html>
