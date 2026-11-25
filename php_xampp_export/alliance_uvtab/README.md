# ALLIANCE VOCATIONAL SCHOOL – IBANDA
## UVTAB Student Registration Management System

### 1. Live Demonstration vs Production Architecture
- **Live Demonstration (AI Studio Environment)**: Runs on **Node.js + Express + React + SQLite** (`server.ts`, `server/db.ts`, `src/`) with persistent server-side SQLite storage (`data/alliance_uvtab.db`), `scrypt` password hashing, signed Bearer session tokens, RBAC, PDF/Excel/Print reporting, and live `.sql` backup export.
- **Production XAMPP Deployment (`php_xampp_export/alliance_uvtab/`)**: Contains the PHP 8 + PDO MySQL + Bootstrap 5 architecture and the complete `alliance_uvtab.sql` schema for `alliance_uvtab_registration`.

---

### 2. Running on XAMPP (Windows / macOS / Linux)
1. Install **XAMPP** (Apache + MySQL + PHP 8.x).
2. Copy the `php_xampp_export/alliance_uvtab/` folder into your XAMPP `htdocs/` directory (`C:\xampp\htdocs\alliance_uvtab`).
3. Start **Apache** and **MySQL** from the XAMPP Control Panel.

---

### 3. Importing the MySQL Database via phpMyAdmin
1. Open `http://localhost/phpmyadmin` in your browser.
2. Click **Import** (or **New** -> **SQL**).
3. Select `php_xampp_export/alliance_uvtab/database/alliance_uvtab.sql` and execute it.
4. Confirm that database `alliance_uvtab_registration` and all 8 tables (`users`, `departments`, `courses`, `examination_sessions`, `students`, `registrations`, `activity_logs`, `password_reset_requests`) are created.

---

### 4. First-Run Administrator Account Setup
1. Open `http://localhost/alliance_uvtab/` in your browser.
2. On first launch, when no Administrator account exists in the database yet, the **Initial Administrator Setup** screen prompts you to choose the initial administrator username (e.g. `admin`) and password (minimum 8 characters), hashes it securely (`scrypt` in Node.js / `password_hash()` in PHP), and signs you in.
3. For security, change temporary staff passwords immediately after first login via **Change Password** in the sidebar.

---

### 5. System Modules
- **Administrative Dashboard**: Real-time counts of registered students, UVTAB exam registrations, active courses, exam sessions, pending/completed statuses, course distribution chart, recent registrations, and audit trail.
- **Student Registration Module**: Personal, Academic, and UVTAB Exam sections with auto-generated Student IDs (`AVS-YYYY-XXXX`), duplicate registration number prevention, and UGX fee tracking.
- **Student Records Management**: Paginated directory with search, filters (course, academic year, exam session, status), view dossier, edit, delete confirmation, and CSV export.
- **Course & Department Management**: Dynamic CRUD for vocational courses, course codes, departments, durations, and UGX assessment fees.
- **UVTAB Examination Sessions**: Manage session dates, assessment programmes, levels, completion progress, and candidate workflow statuses (`Pending`, `Completed`, `Submitted`, `Cancelled`).
- **Search & Retrieval**: Instant search by name, student ID, UVTAB registration number, course, or session.
- **Report Generation**: Complete reports, per-course, per-session, per-academic-year, gender statistics, pending, and completed reports with **Print**, **PDF**, and **Excel** exports.
- **User Management & Settings**: Role-based access control (`Administrator`, `Registration Officer`, `School Staff`), password reset recovery queue, configurable UVTAB options, audit logs, and live `.sql` database backup.

---

### 6. Recommended Future Improvements
- Bulk CSV/Excel student import for intake cohorts.
- Official UVTAB portal export schema integration once official API/file specifications are issued by the board.
- Automated SMS payment/registration reminders via Ugandan SMS gateways.
- Student passport photo upload & printable examination identity cards.
