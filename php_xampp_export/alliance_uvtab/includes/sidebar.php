<?php
// includes/sidebar.php
$currentPage = basename($_SERVER['PHP_SELF']);
$isAdmin = ($_SESSION['role'] ?? '') === 'Administrator';
$canReg = in_array($_SESSION['role'] ?? '', ['Administrator', 'Registration Officer'], true);
?>
<aside id="sidebar" class="sidebar bg-navy text-white d-flex flex-column no-print">
  <div class="p-4 border-bottom border-white border-opacity-10">
    <div class="small text-info fw-semibold">ALLIANCE VOCATIONAL</div>
    <div class="fw-bold">SCHOOL – IBANDA</div>
  </div>
  <nav class="p-3 flex-grow-1 d-flex flex-column gap-1">
    <a href="dashboard.php" class="nav-link-item <?= $currentPage === 'dashboard.php' ? 'active' : '' ?>">
      <i class="fa fa-gauge me-2"></i> Dashboard
    </a>
    <?php if ($canReg): ?>
      <a href="register_student.php" class="nav-link-item <?= $currentPage === 'register_student.php' ? 'active' : '' ?>">
        <i class="fa fa-user-plus me-2"></i> Register Student
      </a>
    <?php endif; ?>
    <a href="students.php" class="nav-link-item <?= $currentPage === 'students.php' ? 'active' : '' ?>">
      <i class="fa fa-users me-2"></i> Student Records
    </a>
    <a href="courses.php" class="nav-link-item <?= $currentPage === 'courses.php' ? 'active' : '' ?>">
      <i class="fa fa-book me-2"></i> Course Management
    </a>
    <a href="examinations.php" class="nav-link-item <?= $currentPage === 'examinations.php' ? 'active' : '' ?>">
      <i class="fa fa-calendar-check me-2"></i> UVTAB Sessions
    </a>
    <a href="reports.php" class="nav-link-item <?= $currentPage === 'reports.php' ? 'active' : '' ?>">
      <i class="fa fa-chart-column me-2"></i> Reports
    </a>
    <?php if ($isAdmin): ?>
      <a href="users.php" class="nav-link-item <?= $currentPage === 'users.php' ? 'active' : '' ?>">
        <i class="fa fa-user-shield me-2"></i> User Management
      </a>
    <?php endif; ?>
  </nav>
  <div class="p-3 border-top border-white border-opacity-10">
    <a href="../logout.php" class="nav-link-item text-danger-emphasis">
      <i class="fa fa-right-from-bracket me-2"></i> Sign Out
    </a>
  </div>
</aside>
