<?php
// includes/header.php
$pageTitle = $pageTitle ?? 'Dashboard';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($pageTitle) ?> | Alliance Vocational School – Ibanda</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body>
<div class="d-flex min-vh-100">
  <?php include __DIR__ . '/sidebar.php'; ?>
  <div class="flex-grow-1 d-flex flex-column main-shell">
    <header class="top-nav border-bottom bg-white px-4 py-3 d-flex align-items-center justify-content-between no-print">
      <div class="d-flex align-items-center gap-3">
        <button type="button" class="btn btn-outline-secondary btn-sm d-lg-none" id="sidebarToggle">
          <i class="fa fa-bars"></i>
        </button>
        <h1 class="h5 mb-0 fw-bold text-dark"><?= e($pageTitle) ?></h1>
      </div>
      <div class="d-flex align-items-center gap-3">
        <div class="text-end d-none sm-block">
          <div class="small fw-semibold"><?= e($_SESSION['full_name'] ?? '') ?></div>
          <div class="text-muted" style="font-size: 0.75rem;"><?= e($_SESSION['role'] ?? '') ?></div>
        </div>
        <a href="../logout.php" class="btn btn-outline-secondary btn-sm">Logout</a>
      </div>
    </header>
    <main class="p-4 flex-grow-1">
