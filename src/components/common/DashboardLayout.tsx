// src/components/common/DashboardLayout.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { auth } from '../../lib/firebaseConfig';
import { feedbackService } from '../../services/feedbackService';
import { notificationService, type NotificationItem } from '../../services/notificationService';
import { LogOut, Bell, Menu, X, MessageSquare, Send, Loader2, Megaphone, CheckCheck, Mail } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  userName: string;
  userRole: 'superadmin' | 'schooladmin' | 'teacher' | 'student' | 'registrar';
  title: string;
  subtitle?: string;
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  tabs: TabItem[];
  children: React.ReactNode;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolMotto?: string | null;
  extraHeaderContent?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  userName,
  userRole,
  title,
  subtitle,
  activeTab,
  setActiveTab,
  tabs,
  children,
  schoolId,
  schoolName,
  schoolMotto,
  extraHeaderContent
}) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'request' | 'suggestion' | 'general' | 'complaint'>('general');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid || null;

  useEffect(() => {
    if (feedbackOpen) {
      setFeedbackName(auth.currentUser?.displayName || userName || '');
    }
  }, [feedbackOpen, userName]);

  useEffect(() => {
    if (!feedbackOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFeedbackOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [feedbackOpen]);

  useEffect(() => {
    if (!currentUserId) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);
    const unsubscribe = notificationService.subscribeToUserNotifications(currentUserId, (items) => {
      setNotifications(items);
      setNotificationsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [notificationsOpen]);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to terminate your session?")) {
      await authService.signOut();
      navigate('/login');
    }
  };

  // Define role specific color themes
  const getThemeClasses = () => {
    switch (userRole) {
      case 'superadmin':
        return {
          sidebarBg: 'bg-slate-900 border-r border-slate-800',
          logoColor: 'text-blue-400',
          logoBg: 'bg-blue-600/20 border-blue-500/30',
          activeTabBg: 'bg-blue-600 shadow-lg shadow-blue-900/50 text-white',
          hoverTabBg: 'hover:bg-slate-800 text-slate-400 hover:text-white',
          roleBadge: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
          avatarBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
          roleTitle: 'SUPER ADMIN',
          bannerBg: 'from-slate-900 via-slate-950 to-slate-900',
          bannerBadgeText: 'text-slate-300',
          bannerBadgeBg: 'bg-slate-500/10',
          bannerBadgeBorder: 'border-slate-500/20',
          bannerIconText: 'text-slate-200'
        };
      case 'schooladmin':
        return {
          sidebarBg: 'bg-indigo-950 border-r border-indigo-900',
          logoColor: 'text-indigo-400',
          logoBg: 'bg-indigo-600/20 border-indigo-500/30',
          activeTabBg: 'bg-indigo-700 shadow-lg shadow-indigo-900/50 text-white',
          hoverTabBg: 'hover:bg-indigo-900/50 text-indigo-300 hover:text-white',
          roleBadge: 'bg-indigo-900/40 text-indigo-300 border border-indigo-800/50',
          avatarBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
          roleTitle: 'SCHOOL ADMIN',
          bannerBg: 'from-indigo-900 via-purple-950 to-slate-950',
          bannerBadgeText: 'text-indigo-300',
          bannerBadgeBg: 'bg-indigo-500/10',
          bannerBadgeBorder: 'border-indigo-500/20',
          bannerIconText: 'text-indigo-200'
        };
      case 'teacher':
        return {
          sidebarBg: 'bg-emerald-950 border-r border-emerald-900',
          logoColor: 'text-emerald-400',
          logoBg: 'bg-emerald-600/20 border-emerald-500/30',
          activeTabBg: 'bg-emerald-700 shadow-lg shadow-emerald-900/50 text-white',
          hoverTabBg: 'hover:bg-emerald-900/50 text-emerald-300 hover:text-white',
          roleBadge: 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50',
          avatarBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
          roleTitle: 'INSTRUCTOR',
          bannerBg: 'from-emerald-900 via-teal-950 to-slate-950',
          bannerBadgeText: 'text-emerald-300',
          bannerBadgeBg: 'bg-emerald-500/10',
          bannerBadgeBorder: 'border-emerald-500/20',
          bannerIconText: 'text-emerald-200'
        };
      case 'student':
        return {
          sidebarBg: 'bg-cyan-950 border-r border-cyan-905',
          logoColor: 'text-cyan-400',
          logoBg: 'bg-cyan-600/20 border-cyan-500/30',
          activeTabBg: 'bg-cyan-700 shadow-lg shadow-cyan-900/50 text-white',
          hoverTabBg: 'hover:bg-cyan-900/50 text-cyan-300 hover:text-white',
          roleBadge: 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/50',
          avatarBg: 'bg-gradient-to-br from-cyan-500 to-blue-600',
          roleTitle: 'STUDENT',
          bannerBg: 'from-cyan-900 via-blue-950 to-slate-950',
          bannerBadgeText: 'text-cyan-300',
          bannerBadgeBg: 'bg-cyan-500/10',
          bannerBadgeBorder: 'border-cyan-500/20',
          bannerIconText: 'text-cyan-200'
        };
      case 'registrar':
        return {
          sidebarBg: 'bg-amber-950 border-r border-amber-900',
          logoColor: 'text-amber-400',
          logoBg: 'bg-amber-600/20 border-amber-500/30',
          activeTabBg: 'bg-amber-700 shadow-lg shadow-amber-900/50 text-white',
          hoverTabBg: 'hover:bg-amber-900/50 text-amber-300 hover:text-white',
          roleBadge: 'bg-amber-950/40 text-amber-300 border border-amber-800/50',
          avatarBg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
          roleTitle: 'REGISTRAR',
          bannerBg: 'from-amber-900 via-yellow-950 to-slate-950',
          bannerBadgeText: 'text-amber-300',
          bannerBadgeBg: 'bg-amber-500/10',
          bannerBadgeBorder: 'border-amber-500/20',
          bannerIconText: 'text-amber-200'
        };
    }
  };

  const theme = getThemeClasses();
  const canSendSupport = userRole !== 'superadmin';
  const supportLabel = useMemo(() => {
    return 'Support';
  }, [userRole]);
  const unreadNotificationCount = notifications.filter((item) => !item.readAt).length;

  const handleSubmitFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedbackSending(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    try {
      await feedbackService.submitFeedback({
        schoolId: schoolId || null,
        schoolName: schoolName || null,
        userName: feedbackName.trim() || auth.currentUser?.displayName || userName,
        userRole,
        category: feedbackCategory,
        subject: feedbackSubject,
        message: feedbackMessage
      });

      setFeedbackSuccess('Your message has been sent.');
      setFeedbackSubject('');
      setFeedbackMessage('');
      setFeedbackCategory('general');
      setTimeout(() => setFeedbackOpen(false), 900);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to send support message.');
    } finally {
      setFeedbackSending(false);
    }
  };

  React.useEffect(() => {
    if (schoolName) {
      document.title = `${title} | ${schoolName} - Liberia Schools Portal`;
    } else {
      document.title = `${title} | Liberia Schools Portal`;
    }
  }, [title, schoolName]);

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-6 sm:p-8">
        <h2 className="text-lg sm:text-xl font-black flex items-center gap-3 tracking-tighter text-white">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/20 bg-blue-600 shadow-lg shadow-blue-900/20">
            <span className="text-lg font-black text-white">L</span>
          </div>
          <div className="flex flex-col">
            <span className="leading-none">LIBERIA</span>
            <span className="text-[10px] text-blue-400 tracking-[0.2em] font-black">SCHOOLS PORTAL</span>
          </div>
        </h2>
        <div className="flex flex-col mt-2">
          <span className={`text-[10px] font-black tracking-widest uppercase py-0.5 px-2 rounded-md inline-block w-max ${theme.roleBadge}`}>
            {theme.roleTitle}
          </span>
          {schoolId && schoolId !== 'system-global' && (
            <div className="mt-3 flex flex-col gap-0.5">
              <span className="text-sm font-extrabold text-white leading-tight tracking-wide">
                {schoolName}
              </span>
              {schoolMotto && (
                <span className="text-[10px] text-slate-400 font-medium italic mt-1 leading-snug">“{schoolMotto}”</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-3 sm:px-4 space-y-1.5 overflow-y-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-bold transition-all text-sm ${
                isActive ? theme.activeTabBg : theme.hoverTabBg
              }`}
            >
              <div className="shrink-0">{tab.icon}</div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout button */}
      <div className="p-5 sm:p-6 border-t border-white/5 bg-black/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-all border border-transparent hover:border-red-500/20 text-sm"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          Terminate Session
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex lg:w-72 flex-col fixed inset-y-0 left-0 text-white z-20 ${theme.sidebarBg}`}>
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer sheet */}
          <div className={`relative flex flex-col w-[min(18rem,calc(100vw-1rem))] max-w-none h-full text-white shadow-2xl animate-slide-in ${theme.sidebarBg}`}>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main content wrapper */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 lg:px-10 py-4 sm:py-5 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center sticky top-0 z-10">
          <div className="flex min-w-0 flex-1 items-start sm:items-center gap-3 sm:gap-4">
            {/* Hamburger Trigger for Mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="min-w-0">
              {schoolName && (
                <div className="mb-1.5 hidden items-center gap-2 sm:flex">
                  <span className={`max-w-48 truncate text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${theme.bannerBadgeText} ${theme.bannerBadgeBg} border ${theme.bannerBadgeBorder}`}>
                    {schoolName}
                  </span>
                </div>
              )}
              <h1 className="truncate text-lg sm:text-xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">
                {title}
              </h1>
              {subtitle && (
                <p className="hidden sm:block text-xs lg:text-sm text-slate-500 font-medium mt-1.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3 lg:gap-6">
            {extraHeaderContent}
            {canSendSupport && (
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <MessageSquare className="h-4 w-4" />
                {supportLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotificationsOpen((value) => !value)}
              className="relative flex w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 items-center justify-center text-slate-500 hover:text-slate-900 transition border border-slate-100"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 sm:gap-3 sm:pl-3 lg:pl-6 sm:border-l border-slate-100 min-w-0">
              <div className="text-right hidden sm:block min-w-0">
                <p className="text-sm font-black text-slate-900 leading-tight">{userName}</p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{theme.roleTitle}</p>
                  {schoolName && (
                    <>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${theme.bannerBadgeText}`}>{schoolName}</p>
                    </>
                  )}
                </div>
              </div>
              <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-slate-200 uppercase ${theme.avatarBg}`}>
                {userName.substring(0, 2)}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 max-w-[1600px] w-full mx-auto pb-8">
          {schoolId && schoolId !== 'system-global' && schoolName && (
            <div className={`mb-6 sm:mb-8 p-5 sm:p-6 lg:p-8 rounded-3xl sm:rounded-[2rem] bg-gradient-to-r ${theme.bannerBg} text-white shadow-xl relative overflow-hidden border border-white/10 animate-fade-in`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_50%)]"></div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${theme.bannerBadgeText} ${theme.bannerBadgeBg} px-3 py-1 rounded-full border ${theme.bannerBadgeBorder}`}>
                    Active Educational Portal
                  </span>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-black mt-3 tracking-tight break-words">
                    {schoolName}
                  </h2>
                  {schoolMotto && (
                    <p className="text-sm text-slate-200/80 italic mt-1.5 font-medium font-sans">
                      “{schoolMotto}”
                    </p>
                  )}
                </div>
                <div className="w-full sm:w-auto shrink-0 flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                    <span className={`text-base font-black ${theme.bannerIconText} uppercase`}>{schoolName.substring(0, 2)}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Infrastructure ID</p>
                    <p className="text-xs font-mono font-bold text-slate-200 mt-1 leading-none">{schoolId}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      {canSendSupport && (
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="sm:hidden fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-900/20"
        >
          <Megaphone className="h-4 w-4" />
          {supportLabel}
        </button>
      )}

      {canSendSupport && feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Support desk</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Send a support message</h3>
                <p className="mt-1 text-sm text-slate-500">Use this for bugs, suggestions, requests, or anything that needs attention.</p>
                <p className="mt-2 text-[11px] font-semibold text-slate-400">
                  We save your signed-in account name, email, and user ID with the message.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4 px-5 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">Your name</label>
                  <input
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">Category</label>
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  >
                    <option value="general">General</option>
                    <option value="bug">Bug report</option>
                    <option value="request">Feature request</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="complaint">Complaint</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-700">Subject</label>
                <input
                  value={feedbackSubject}
                  onChange={(e) => setFeedbackSubject(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="Short subject"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-700">Message</label>
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="Explain what you need help with"
                />
              </div>

              {feedbackError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {feedbackError}
                </div>
              )}

              {feedbackSuccess && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {feedbackSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={feedbackSending}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {feedbackSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setNotificationsOpen(false)}>
          <div
            className="absolute right-4 top-16 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notifications</p>
                <h3 className="mt-1 text-base font-black text-slate-900">Your updates</h3>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[32rem] overflow-y-auto p-3">
              {notificationsLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No notifications yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((item) => {
                    const isUnread = !item.readAt;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-4 transition ${
                          isUnread ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 shrink-0 text-slate-500" />
                              <p className="text-sm font-black text-slate-900">{item.title}</p>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.message}</p>
                            <p className="mt-2 text-[11px] font-semibold text-slate-400">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {isUnread && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!currentUserId) return;
                                await notificationService.markNotificationRead(currentUserId, item.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCheck className="h-4 w-4" />
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
