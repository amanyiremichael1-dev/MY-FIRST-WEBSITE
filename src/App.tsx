import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileBarChart2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SchoolCrest } from './components/SchoolCrest';
import { StudentDossierModal } from './components/StudentDossierModal';
import {
  apiRequest,
  setAuthToken,
  setUnauthorizedHandler,
} from './lib/api';
import { CoursesPage } from './pages/CoursesPage';
import { DashboardPage, type NavView } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterStudentPage } from './pages/RegisterStudentPage';
import { ReportsPage } from './pages/ReportsPage';
import { SearchPage } from './pages/SearchPage';
import { SessionsPage } from './pages/SessionsPage';
import { StudentsPage } from './pages/StudentsPage';
import { UsersSettingsPage } from './pages/UsersSettingsPage';
import type { AuthUser, StudentRecord } from './types';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export default function App() {
  const [authStatusLoading, setAuthStatusLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSignOut = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore if session already expired
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
      setActiveView('dashboard');
      setEditingStudent(null);
      setViewingStudentId(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setCurrentUser(null);
      setToast({
        type: 'error',
        message: 'Your session expired. Please sign in again.',
      });
    });

    apiRequest<{ needsBootstrap: boolean }>('/api/auth/status')
      .then((res) => {
        setNeedsBootstrap(res.needsBootstrap);
      })
      .catch(() => {})
      .finally(() => setAuthStatusLoading(false));
  }, []);

  if (authStatusLoading) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center p-6 text-white">
        <div className="flex flex-col items-center gap-3">
          <SchoolCrest className="h-12 w-12" />
          <p className="text-sm font-medium text-blue-100">
            Loading Alliance Vocational School Registry...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        needsBootstrap={needsBootstrap}
        onBootstrapComplete={() => setNeedsBootstrap(false)}
        onAuthenticated={(token, user) => {
          setAuthToken(token);
          setCurrentUser(user);
          setActiveView('dashboard');
          if (user.must_change_password === 1) {
            setShowChangePassword(true);
          }
        }}
      />
    );
  }

  const canRegister =
    currentUser.role === 'Administrator' ||
    currentUser.role === 'Registration Officer';
  const isAdmin = currentUser.role === 'Administrator';

  const navItems: Array<{
    id: NavView;
    label: string;
    icon: typeof LayoutDashboard;
    visible: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: 'register', label: 'Register Student', icon: UserPlus, visible: canRegister },
    { id: 'students', label: 'Student Records', icon: Users, visible: true },
    { id: 'search', label: 'Search & Retrieval', icon: Search, visible: true },
    { id: 'courses', label: 'Course Management', icon: BookOpen, visible: true },
    { id: 'sessions', label: 'UVTAB Sessions', icon: CalendarDays, visible: true },
    { id: 'reports', label: 'Reports & Exports', icon: FileBarChart2, visible: true },
    { id: 'users', label: 'Users & Settings', icon: Settings, visible: isAdmin },
  ];

  const viewTitles: Record<NavView, string> = {
    dashboard: 'Administrative Dashboard',
    register: editingStudent ? 'Edit Student Registration' : 'Student Registration',
    students: 'Student Records Management',
    search: 'Search & Record Retrieval',
    courses: 'Courses & Departments',
    sessions: 'UVTAB Examination Sessions',
    reports: 'Reports & Official Exports',
    users: 'User Management & System Settings',
  };

  function handleNavigate(view: NavView) {
    if (view === 'register') {
      setEditingStudent(null);
    }
    setActiveView(view);
    setMobileMenuOpen(false);
  }

  function handleEditStudent(student: StudentRecord) {
    setViewingStudentId(null);
    setEditingStudent(student);
    setActiveView('register');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden no-print"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Fixed Institutional Navy Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-[#0B1F3A] text-white flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 bg-[#08172B] px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <SchoolCrest className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-blue-200 truncate">
                ALLIANCE VOCATIONAL
              </p>
              <p className="text-xs font-bold text-white truncate">
                SCHOOL – IBANDA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1 text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
        </nav>

        <div className="border-t border-white/10 p-4 space-y-2 text-xs">
          <button
            type="button"
            onClick={() => setShowChangePassword(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>Change Password</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-red-300 hover:bg-red-500/15 hover:text-red-200 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-900 truncate">
                {viewTitles[activeView]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-slate-900">
                {currentUser.full_name}
              </p>
              <p className="text-[11px] text-slate-500">{currentUser.role}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* Notification Toast */}
        {toast && (
          <div className="no-print px-4 md:px-8 pt-4">
            <div
              role="status"
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded p-1 hover:bg-black/5"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 md:p-8 max-w-[1440px] w-full mx-auto">
          {activeView === 'dashboard' && (
            <DashboardPage
              userRole={currentUser.role}
              onNavigate={handleNavigate}
              onViewStudent={(id) => setViewingStudentId(id)}
            />
          )}

          {activeView === 'register' && canRegister && (
            <RegisterStudentPage
              editingStudent={editingStudent}
              onSuccess={(message) => {
                notify('success', message);
                setEditingStudent(null);
                setActiveView('students');
              }}
              onCancel={() => {
                setEditingStudent(null);
                setActiveView('students');
              }}
            />
          )}

          {activeView === 'students' && (
            <StudentsPage
              userRole={currentUser.role}
              onAddStudent={() => handleNavigate('register')}
              onViewStudent={(id) => setViewingStudentId(id)}
              onEditStudent={handleEditStudent}
              onNotify={notify}
            />
          )}

          {activeView === 'search' && (
            <SearchPage
              userRole={currentUser.role}
              onViewStudent={(id) => setViewingStudentId(id)}
              onEditStudent={handleEditStudent}
            />
          )}

          {activeView === 'courses' && (
            <CoursesPage userRole={currentUser.role} onNotify={notify} />
          )}

          {activeView === 'sessions' && (
            <SessionsPage userRole={currentUser.role} onNotify={notify} />
          )}

          {activeView === 'reports' && <ReportsPage onNotify={notify} />}

          {activeView === 'users' && isAdmin && (
            <UsersSettingsPage
              currentUserId={currentUser.user_id}
              onNotify={notify}
            />
          )}
        </main>

        <footer className="no-print border-t border-slate-200 bg-white px-4 md:px-8 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            ALLIANCE VOCATIONAL SCHOOL – IBANDA · UVTAB Student Registration Management System
          </span>
          <span>Currency: UGX · Internal Institutional Registry</span>
        </footer>
      </div>

      <StudentDossierModal
        studentId={viewingStudentId}
        canEdit={canRegister}
        onClose={() => setViewingStudentId(null)}
        onEdit={handleEditStudent}
      />

      <ChangePasswordModal
        open={showChangePassword}
        forceRequired={currentUser.must_change_password === 1}
        onClose={() => setShowChangePassword(false)}
        onSuccess={(msg) => {
          setCurrentUser((prev) =>
            prev ? { ...prev, must_change_password: 0 } : prev
          );
          notify('success', msg);
        }}
      />
    </div>
  );
}
