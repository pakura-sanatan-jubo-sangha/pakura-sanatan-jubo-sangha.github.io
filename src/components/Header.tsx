import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, Language, Theme } from '../types';
import { getTranslation } from '../lib/translations';
import { StorageService } from '../lib/storage';
import { EnrichedNotification } from '../lib/notifications';
import {
  googleSignIn,
  formatFirebaseAuthError,
} from '../lib/firebase';
import {
  CheckCircle,
  Menu,
  Eye,
  Key,
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  Mail,
  Flame,
  UserCheck,
  Phone,
  Bell,
  CheckCheck,
  ExternalLink,
  Calendar,
  BookOpen,
  PiggyBank,
  LogIn,
  Globe,
  MessageSquare,
} from 'lucide-react';

interface HeaderProps {
  currentUser: UserAccount;
  language: Language;
  theme: Theme;
  onLanguageToggle: () => void;
  onThemeToggle: () => void;
  onGoogleSheetsClick: () => void;
  onAdminLoginSuccess: () => void;
  onOpenLogin?: () => void;
  onOpenMemberLogin?: () => void;
  onOpenAdminLogin?: () => void;
  onLogout?: () => void;
  isSheetConnected: boolean;
  isAutoSaving?: boolean;
  onOpenMobileSidebar?: () => void;
  isOpenLoginModal?: boolean;
  onCloseLoginModal?: () => void;
  notifications?: EnrichedNotification[];
  onOpenAllNotifications?: () => void;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  language,
  theme,
  onLanguageToggle,
  onThemeToggle,
  onGoogleSheetsClick,
  onAdminLoginSuccess,
  onOpenLogin,
  onOpenMemberLogin,
  onOpenAdminLogin,
  onLogout,
  isSheetConnected,
  isAutoSaving = false,
  onOpenMobileSidebar,
  isOpenLoginModal,
  onCloseLoginModal,
  notifications = [],
  onOpenAllNotifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigateTab,
}) => {
  const t = getTranslation(language);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotificationDropdown(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (isOpenLoginModal) {
      setLoginError(null);
      setLoginSuccessMsg(null);
      setShowAdminLoginModal(true);
    }
  }, [isOpenLoginModal]);

  const closeLoginModal = () => {
    setShowAdminLoginModal(false);
    if (onCloseLoginModal) onCloseLoginModal();
  };

  // Form states - main admin email default
  const [adminEmail, setAdminEmail] = useState('freelancerkajolchandradas@gmail.com');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const isAdmin = currentUser.role === 'admin';
  const isViewOnly = currentUser.userId === 'USR-VIEW-ONLY';

  // Handle Login Authentication (Main Admin or Standard Admin / Member)
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccessMsg(null);

    const emailTrimmed = adminEmail.trim();
    const passTrimmed = adminPasswordInput.trim();

    if (!emailTrimmed || !passTrimmed) {
      setLoginError(
        language === 'bn'
          ? 'অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড উভয়ই লিখুন।'
          : 'Please enter both email and password.'
      );
      return;
    }

    setIsAuthenticating(true);
    try {
      // Validate credentials using internal secure credential store
      const res = StorageService.loginWithCredentials(emailTrimmed, passTrimmed);
      if (res.success && res.user) {
        setLoginSuccessMsg(res.message);

        setTimeout(() => {
          setAdminPasswordInput('');
          setShowAdminLoginModal(false);
          onAdminLoginSuccess();
        }, 700);
        return;
      }

      setLoginError(res.message);
    } catch (err: any) {
      console.warn('Login attempt error:', err);
      setLoginError(formatFirebaseAuthError(err, language));
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Firebase Google Sign-In:
  // "However, if someone logs in using 'Sign in with Google' as the main admin,
  // they will simply be designated as a standard member—not an admin.
  // They will only become an admin if I specifically set up their account with admin privileges beforehand;
  // otherwise, they won't have admin status."
  const handleGoogleSignInClick = async () => {
    setLoginError(null);
    setIsAuthenticating(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        const designatedUser = StorageService.loginAdminWithFirebase(res.user);
        if (designatedUser.role === 'admin') {
          setLoginSuccessMsg(
            language === 'bn'
              ? `সহকারী অ্যাডমিন হিসেবে সফলভাবে প্রবেশ করেছেন (${designatedUser.email || designatedUser.displayName})!`
              : `Logged in as Assistant Admin with Google (${designatedUser.email || designatedUser.displayName})!`
          );
        } else {
          setLoginSuccessMsg(
            language === 'bn'
              ? `সাধারণ সদস্য হিসেবে গুগল সাইন-ইন সম্পন্ন হয়েছে (${designatedUser.email || designatedUser.displayName})। প্রধান অ্যাডমিন কর্তৃক পূর্বে সুবিধা প্রদান ছাড়া অ্যাডমিন হওয়া সম্ভব নয়।`
              : `Signed in as Member (${designatedUser.email || designatedUser.displayName}). Admin privileges require prior assignment by the Main Admin.`
          );
        }
        setTimeout(() => {
          setShowAdminLoginModal(false);
          onAdminLoginSuccess();
        }, 800);
      }
    } catch (err: any) {
      if (err?.message === 'POPUP_BLOCKED') {
        setLoginError(
          language === 'bn'
            ? 'ব্রাউজারে পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজার ইউআরএল বারের ডানপাশে পপআপ অনুমোদন দিন অথবা ইমেইল/পাসওয়ার্ড দিয়ে লগইন করুন।'
            : 'Popup blocked by browser. Please allow popups or use Email/Password login.'
        );
      } else {
        setLoginError(formatFirebaseAuthError(err, language));
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 transition-colors shadow-xs print:hidden">
        <div className="flex items-center justify-between px-3 sm:px-6 h-16 max-w-7xl mx-auto">
          {/* Left: Mobile Toggle & Brand Identity */}
          <div className="flex items-center gap-3">
            {onOpenMobileSidebar && !isViewOnly && (
              <button
                onClick={onOpenMobileSidebar}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2.5">
              {/* Sacred Om Crest Symbol */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-xs shadow-amber-500/20 flex-shrink-0">
                🕉️
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight tracking-tight">
                    {t.appName}
                  </h1>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                    {language === 'bn' ? 'স্থাপিত: ২০২৫' : 'Est. 2025'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  {t.appSubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Right: User profile, notifications & actions (when logged in) */}
          <div className="flex items-center gap-2">
            {!isViewOnly && (
              <>

                {/* 1. User Profile Badge with Dropdown Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    title={language === 'bn' ? 'ব্যবহারকারী একাউন্ট মেনু' : 'User Account Menu'}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate max-w-[150px]">{currentUser.name || currentUser.displayName}</span>
                  </button>

                  {/* User Profile Popover */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {currentUser.name || currentUser.displayName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {currentUser.role === 'admin'
                            ? (language === 'bn' ? 'অ্যাডমিন অ্যাকাউন্ট' : 'Admin Account')
                            : (language === 'bn' ? 'সাধারণ সদস্য অ্যাকাউন্ট' : 'General Member Account')}
                        </div>
                        {(currentUser.email || currentUser.phone) && (
                          <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                            {currentUser.email || currentUser.phone}
                          </div>
                        )}
                      </div>

                      {onLogout && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            onLogout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer mt-0.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'লগআউট (Logout)' : 'Logout'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Shared Community Space & Chat Shortcut */}
                <button
                  type="button"
                  onClick={() => onNavigateTab ? onNavigateTab('chat') : null}
                  className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/80 dark:text-slate-300 dark:hover:text-emerald-400 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 shadow-2xs"
                  title={language === 'bn' ? 'একীভূত বার্তা ও আলোচনা কেন্দ্র' : 'Shared Community Space & Chat'}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden md:inline text-xs font-bold text-slate-700 dark:text-slate-200">
                    {language === 'bn' ? 'চ্যাটস্পেস' : 'Chat'}
                  </span>
                </button>

                {/* 2. Notification Bell Icon: Replaces the Lock/Logout option in that exact spot */}
                <div className="relative" ref={notificationRef}>
                  <button
                    type="button"
                    onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                    className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/80 dark:text-slate-300 dark:hover:text-indigo-400 dark:hover:bg-slate-800 transition-all relative cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 shadow-2xs"
                    aria-label="View notifications"
                    title={language === 'bn' ? 'নোটিফিকেশন ও ঘোষণা' : 'Notifications & Announcements'}
                  >
                    <Bell className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse shadow-xs">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Popover */}
                  {showNotificationDropdown && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      {/* Popover Header */}
                      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {language === 'bn' ? 'নোটিফিকেশন ও ঘোষণা' : 'Notifications & Notices'}
                          </span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              {unreadCount} {language === 'bn' ? 'নতুন' : 'new'}
                            </span>
                          )}
                        </div>

                        {unreadCount > 0 && onMarkAllNotificationsRead && (
                          <button
                            type="button"
                            onClick={() => {
                              onMarkAllNotificationsRead();
                            }}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer flex items-center gap-1"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>{language === 'bn' ? 'সব পঠিত' : 'Mark all read'}</span>
                          </button>
                        )}
                      </div>

                      {/* Notification List Items */}
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                        {notifications.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            <Bell className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                            <span>{language === 'bn' ? 'কোনো নতুন নোটিফিকেশন নেই' : 'No new notifications'}</span>
                          </div>
                        ) : (
                          notifications.slice(0, 5).map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (onMarkNotificationRead) onMarkNotificationRead(n.id);
                                if (n.actionTab && onNavigateTab) {
                                  onNavigateTab(n.actionTab);
                                  setShowNotificationDropdown(false);
                                }
                              }}
                              className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 ${
                                n.isRead
                                  ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                  : 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70'
                              }`}
                            >
                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                {n.category === 'payment' ? (
                                  <PiggyBank className="w-3.5 h-3.5 text-emerald-600" />
                                ) : n.category === 'meeting' ? (
                                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                ) : n.category === 'rule' ? (
                                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                                ) : (
                                  <Bell className="w-3.5 h-3.5 text-indigo-600" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
                                    {n.title}
                                  </span>
                                  {!n.isRead && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 mt-1" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                                  {n.message}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Prominent "View All Notifications" Button & Quick Logout */}
                      <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotificationDropdown(false);
                            if (onOpenAllNotifications) {
                              onOpenAllNotifications();
                            }
                          }}
                          className="w-full py-2.5 px-3 text-center text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer block"
                        >
                          {language === 'bn' ? 'সকল নোটিফিকেশন দেখুন (View All) →' : 'View All Notifications →'}
                        </button>
                        {onLogout && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowNotificationDropdown(false);
                              onLogout();
                            }}
                            className="w-full py-2 px-3 text-center text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Lock className="w-3 h-3" />
                            <span>{language === 'bn' ? 'লগআউট (Logout)' : 'Logout'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{language === 'bn' ? 'একক অ্যাডমিন লগইন' : 'Admin Login'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'bn'
                      ? 'সমগ্র ওয়েবসাইটের জন্য অনুমোদিত একমাত্র অ্যাডমিন লগইন প্রবেশদ্বার'
                      : 'Single authorized admin login point for the entire website'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeLoginModal}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notification / Status Banners */}
            {loginSuccessMsg && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{loginSuccessMsg}</span>
              </div>
            )}

            {loginError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Policy Info Box */}
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
              {language === 'bn'
                ? '🔒 সাধারণ দর্শক ও সদস্যদের জন্য ড্যাশবোর্ডটি শুধু দেখার সুবিধাসম্পন্ন (View-Only)। সমিতি পরিচালনা ও ডাটা ব্যবস্থাপনার জন্য শুধুমাত্র অনুমোদিত প্রধান অ্যাডমিন জিমেইল ও পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।'
                : '🔒 The website is view-only for general visitors. Only authorized Admin can log in to manage society data, member savings, and records.'}
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleAdminLoginSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'ইমেইল বা ইউজারনেম (Email or Username):' : 'Email or Username:'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="freelancerkajolchandradas@gmail.com বা আপনার ইমেইল"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {language === 'bn' ? 'পাসওয়ার্ড (Password):' : 'Password:'}
                  </label>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {language === 'bn' ? 'ডিফল্ট: admin123' : 'Default: admin123'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Google Sign In option */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={handleGoogleSignInClick}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{language === 'bn' ? 'Google একাউন্ট দিয়ে সাইন-ইন' : 'Sign in with Google'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAuthenticating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{language === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
