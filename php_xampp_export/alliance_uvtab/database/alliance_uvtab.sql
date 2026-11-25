-- ALLIANCE VOCATIONAL SCHOOL - IBANDA, UGANDA
-- UVTAB Student Registration Management System
-- MySQL Database Schema & Demonstration Seed Script

CREATE DATABASE IF NOT EXISTS `alliance_uvtab_registration`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `alliance_uvtab_registration`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(120) NULL,
  `role` ENUM('Administrator', 'Registration Officer', 'School Staff') NOT NULL DEFAULT 'Registration Officer',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB;

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS `departments` (
  `dept_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `dept_name` VARCHAR(120) NOT NULL UNIQUE,
  `dept_code` VARCHAR(20) NOT NULL UNIQUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Courses Table
CREATE TABLE IF NOT EXISTS `courses` (
  `course_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `course_name` VARCHAR(160) NOT NULL,
  `course_code` VARCHAR(30) NOT NULL UNIQUE,
  `dept_id` INT UNSIGNED NULL,
  `duration_years` TINYINT UNSIGNED NOT NULL DEFAULT 2,
  `fee_ugx` INT UNSIGNED NOT NULL DEFAULT 130000,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_courses_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments`(`dept_id`) ON DELETE SET NULL,
  INDEX `idx_courses_dept` (`dept_id`)
) ENGINE=InnoDB;

-- 4. Examination Sessions Table
CREATE TABLE IF NOT EXISTS `examination_sessions` (
  `session_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `session_name` VARCHAR(120) NOT NULL,
  `assessment_programme` VARCHAR(160) NOT NULL,
  `assessment_year` YEAR NOT NULL,
  `exam_levels` VARCHAR(255) NOT NULL,
  `opening_date` DATE NOT NULL,
  `closing_date` DATE NOT NULL,
  `status` ENUM('Open', 'Closed') NOT NULL DEFAULT 'Open',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sessions_year` (`assessment_year`)
) ENGINE=InnoDB;

-- 5. Students Table
CREATE TABLE IF NOT EXISTS `students` (
  `student_id` VARCHAR(24) PRIMARY KEY,
  `full_name` VARCHAR(150) NOT NULL,
  `gender` ENUM('Male', 'Female') NOT NULL,
  `dob` DATE NOT NULL,
  `phone` VARCHAR(25) NOT NULL,
  `email` VARCHAR(120) NULL,
  `district` VARCHAR(80) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `department_id` INT UNSIGNED NULL,
  `year_of_study` VARCHAR(30) NOT NULL,
  `academic_year` VARCHAR(20) NOT NULL,
  `reg_number` VARCHAR(60) NOT NULL UNIQUE,
  `exam_level` VARCHAR(80) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_students_course` FOREIGN KEY (`course_id`) REFERENCES `courses`(`course_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_students_dept` FOREIGN KEY (`department_id`) REFERENCES `departments`(`dept_id`) ON DELETE SET NULL,
  INDEX `idx_students_name` (`full_name`),
  INDEX `idx_students_academic_year` (`academic_year`),
  INDEX `idx_students_course` (`course_id`)
) ENGINE=InnoDB;

-- 6. Registrations Table
CREATE TABLE IF NOT EXISTS `registrations` (
  `reg_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id` VARCHAR(24) NOT NULL,
  `session_id` INT UNSIGNED NOT NULL,
  `assessment_programme` VARCHAR(160) NOT NULL,
  `assessment_year` YEAR NOT NULL,
  `reg_date` DATE NOT NULL,
  `exam_fee_ugx` INT UNSIGNED NOT NULL DEFAULT 0,
  `fee_paid_ugx` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('Pending', 'Completed', 'Submitted', 'Cancelled') NOT NULL DEFAULT 'Pending',
  `notes` TEXT NULL,
  `registered_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_reg_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_session` FOREIGN KEY (`session_id`) REFERENCES `examination_sessions`(`session_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_reg_user` FOREIGN KEY (`registered_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL,
  INDEX `idx_reg_status` (`status`),
  INDEX `idx_reg_session` (`session_id`)
) ENGINE=InnoDB;

-- 7. Activity Logs Table
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `log_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NULL,
  `username` VARCHAR(50) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `entity_type` VARCHAR(50) NULL,
  `entity_id` VARCHAR(60) NULL,
  `details` TEXT NULL,
  `log_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL,
  INDEX `idx_logs_time` (`log_time`)
) ENGINE=InnoDB;

-- 8. Password Reset Requests Table
CREATE TABLE IF NOT EXISTS `password_reset_requests` (
  `request_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL,
  `requested_by_note` TEXT NULL,
  `status` ENUM('Pending', 'Resolved', 'Rejected') NOT NULL DEFAULT 'Pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` DATETIME NULL,
  `resolved_by` INT UNSIGNED NULL
) ENGINE=InnoDB;

-- SAMPLE INSTITUTIONAL RECORDS
INSERT INTO `departments` (`dept_id`, `dept_name`, `dept_code`) VALUES
(1, 'Electrical & Electronics Engineering', 'DEE'),
(2, 'Building & Construction', 'DBC'),
(3, 'Automotive & Mechanical Engineering', 'DAM'),
(4, 'Fashion & Garment Design', 'DFG'),
(5, 'Hospitality, Catering & Cosmetology', 'DHC');

INSERT INTO `courses` (`course_id`, `course_name`, `course_code`, `dept_id`, `duration_years`, `fee_ugx`) VALUES
(1, 'National Certificate in Electrical Installation', 'NCEI-101', 1, 2, 145000),
(2, 'National Certificate in Building & Concrete Practice', 'NCBCP-102', 2, 2, 140000),
(3, 'National Certificate in Automotive Mechanics', 'NCAM-103', 3, 2, 150000),
(4, 'National Certificate in Tailoring & Garment Cutting', 'NCTGC-104', 4, 2, 120000),
(5, 'National Certificate in Hairdressing & Cosmetology', 'NCHC-105', 5, 2, 125000),
(6, 'National Certificate in Hotel & Institutional Catering', 'NCHIC-106', 5, 2, 135000);

INSERT INTO `examination_sessions` (`session_id`, `session_name`, `assessment_programme`, `assessment_year`, `exam_levels`, `opening_date`, `closing_date`, `status`) VALUES
(1, 'Nov/Dec 2026 UVTAB Assessment', 'UVTAB National Certificate (Full Assessment)', 2026, 'Level 1 (Year 1), Level 2 (Year 2), Modular Assessment', '2026-09-01', '2026-12-05', 'Open'),
(2, 'June/July 2026 UVTAB Modular Series', 'UVTAB Modular Assessment', 2026, 'Modular Assessment, Trade Test Grade III', '2026-04-01', '2026-06-15', 'Closed');

INSERT INTO `students` (`student_id`, `full_name`, `gender`, `dob`, `phone`, `email`, `district`, `address`, `course_id`, `department_id`, `year_of_study`, `academic_year`, `reg_number`, `exam_level`) VALUES
('AVS-2026-0001', 'Tumwine Brian', 'Male', '2004-03-14', '0772418920', 'brian.tumwine@example.ug', 'Ibanda', 'Kagongo Division, Ibanda Municipality', 1, 1, 'Year 2', '2026/2027', 'UVT/IBD/26/0014', 'Level 2 (Year 2)'),
('AVS-2026-0002', 'Atuhaire Joan', 'Female', '2005-07-22', '0782904115', 'joan.atuhaire@example.ug', 'Ibanda', 'Bufunda Division, Ibanda', 4, 4, 'Year 2', '2026/2027', 'UVT/IBD/26/0015', 'Level 2 (Year 2)'),
('AVS-2026-0003', 'Muhanguzi Denis', 'Male', '2003-11-05', '0701552319', NULL, 'Kiruhura', 'Kazo Trading Centre, Kiruhura', 3, 3, 'Year 1', '2026/2027', 'UVT/IBD/26/0018', 'Level 1 (Year 1)');

INSERT INTO `registrations` (`student_id`, `session_id`, `assessment_programme`, `assessment_year`, `reg_date`, `exam_fee_ugx`, `fee_paid_ugx`, `status`, `notes`) VALUES
('AVS-2026-0001', 1, 'UVTAB National Certificate (Full Assessment)', 2026, '2026-10-12', 145000, 145000, 'Completed', 'Cleared all assessment requirements'),
('AVS-2026-0002', 1, 'UVTAB National Certificate (Full Assessment)', 2026, '2026-10-14', 120000, 120000, 'Submitted', 'Submitted internally'),
('AVS-2026-0003', 1, 'UVTAB National Certificate (Full Assessment)', 2026, '2026-10-19', 150000, 75000, 'Pending', 'Partial fee balance pending');
