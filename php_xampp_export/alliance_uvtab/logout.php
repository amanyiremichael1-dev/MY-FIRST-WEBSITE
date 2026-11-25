<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/authentication.php';

if (!empty($_SESSION['user_id'])) {
    logSystemActivity($pdo, 'Signed out of system', 'user', (string)$_SESSION['user_id']);
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
session_destroy();
header('Location: login.php');
exit;
