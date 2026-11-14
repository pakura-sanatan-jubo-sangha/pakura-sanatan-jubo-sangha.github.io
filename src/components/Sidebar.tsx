import React from 'react';
import { UserAccount, Language, Theme } from '../types';
import { getTranslation } from '../lib/translations';
import { isStrictMainAdmin } from '../lib/storage';
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  FileBarChart,
  PieChart,
  ReceiptText,
  FileSpreadsheet,
  Scale,
  ClipboardList,
  Settings,
  X,
  User,
  UserCheck,
  ShieldCheck,
  Eye,
  Globe,
  Moon,
  Sun,
  Key,
  Lock,
  AlertCircle,
  LogIn,
  Phone,
  Bell,
  Coins,
} from 'lucide-react';

interface SidebarProps {
  currentUser: UserAccount;
  language: Language;
  theme?: Theme;
  onLanguageToggle?: () => void;
  onThemeToggle?: () => void;
  onOpenLoginModal?: () => void;
  onOpenMemberLoginModal?: () => void;
  onOpenAdminLoginModal?: () => void;
  onLogout?: () => void;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  unreadNotificationsCount?: number;
  pendingWithdrawalsCount?: number;
  onOpenNotifications?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  language,
  theme = 'light',
  onLanguageToggle,
  onThemeToggle,
  onOpenLoginModal,
  onOpenMemberLoginModal,
  onOpenAdminLoginModal,
  onLogout,
  currentTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
  unreadNotificationsCount = 0,
  pendingWithdrawalsCount = 0,
  onOpenNotifications,
}) => {
  const t = getTranslation(language);
  const isViewOnly = currentUser.userId === 'USR-VIEW-ONLY';
  const isMember = currentUser.role === 'member' && !isViewOnly;
  const isAdmin = currentUser.role === 'admin';
  const isMainAdmin = isStrictMainAdmin(currentUser);

  // Role-specific navigation items:
  // When not logged in (isViewOnly), Home Dashboard is hidden until login!
  const navItems = isViewOnly
    ? [
        { id: 'dashboard', label: language === 'bn' ? 'লগইন করুন (লক)' : 'Login Required', icon: Lock },
      ]
    : isMember
    ? [
        { id: 'dashboard', label: language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', icon: LayoutDashboard },
        { id: 'member_dashboard', label: language === 'bn' ? 'আমার প্রোফাইল ও হিসাব' : 'My Profile & Ledger', icon: UserCheck },
        { id: 'members', label: language === 'bn' ? 'সদস্য তালিকা' : 'Members List', icon: Users },
        { id: 'receipts', label: language === 'bn' ? 'রশিদ ও ভাউচার খতিয়ান' : 'Receipt Vouchers & Records', icon: ReceiptText },
        { id: 'loans', label: language === 'bn' ? 'ঋণ ব্যবস্থাপনা (চলমান ও বকেয়া স্থিতি)' : 'Loan Manager & Balances', icon: CreditCard },
        { id: 'income', label: language === 'bn' ? 'আয় বিবরণী' : 'Income Details', icon: ArrowDownRight },
        { id: 'expenses', label: language === 'bn' ? 'ব্যয় বিবরণী' : 'Expense Details', icon: ArrowUpRight },
        { id: 'transactions', label: language === 'bn' ? 'ব্যাংক হিসাব ও লেনদেন খতিয়ান' : 'Bank Ledger & Transactions', icon: BookOpen },
        { id: 'admin_rules', label: language === 'bn' ? 'সংবিধিবদ্ধ নিয়মাবলী' : 'Rules & Regulations', icon: Scale },
      ]
    : [
        { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
        { id: 'members', label: t.navMembers, icon: Users },
        { id: 'contributions', label: t.navContributions, icon: PiggyBank },
        { id: 'loans', label: language === 'bn' ? 'ঋণ ব্যবস্থাপনা' : 'Loan Management', icon: CreditCard },
        {
          id: 'withdrawals',
          label: language === 'bn' ? 'সঞ্চয় ও মুনাফা উত্তোলন' : 'Withdrawals & Profit',
          icon: Coins,
          badge: pendingWithdrawalsCount,
        },
        { id: 'income', label: language === 'bn' ? 'আয় বিবরণী' : 'Income Details', icon: ArrowDownRight },
        { id: 'expenses', label: language === 'bn' ? 'ব্যয় বিবরণী' : 'Expense Details', icon: ArrowUpRight },
        { id: 'transactions', label: t.navTransactions, icon: BookOpen },
        { id: 'reports', label: t.navReports, icon: FileBarChart },
        { id: 'analytics', label: t.navAnalytics, icon: PieChart },
        { id: 'receipts', label: t.navReceipts, icon: ReceiptText },
        // Google Sheets sync: strictly restricted to Main Admin only!
        { id: 'sheets', label: t.navGoogleSheets, icon: FileSpreadsheet, mainAdminOnly: true },
        // Admin & Rules
        { id: 'admin_rules', label: language === 'bn' ? 'সংবিধিবদ্ধ নিয়মাবলী ও প্রশাসন' : 'Rules & Regulations', icon: Scale },
        { id: 'activity_log', label: t.navActivityLog, icon: ClipboardList },
        { id: 'settings', label: t.navSettings, icon: Settings, mainAdminOnly: true },
      ];

  const handleSelect = (id: string) => {
    if (isViewOnly) {
      if (onOpenLoginModal) onOpenLoginModal();
      if (onCloseMobile) onCloseMobile();
      return;
    }
    if (id === 'notifications') {
      if (onOpenNotifications) onOpenNotifications();
    } else {
      onSelectTab(id);
    }
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-slate-50/80 dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800 w-64 p-3.5 select-none transition-colors">
      {/* Mobile Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800 lg:hidden">
        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
          {t.appName}
        </span>
        <button
          onClick={onCloseMobile}
          className="p-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Label */}
      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {language === 'bn' ? 'প্রধান মেনু' : 'Navigation Menu'}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1 overflow-y-auto py-1 pr-1 custom-scrollbar">
        {navItems
          .filter((item) => {
            if ((item as any).mainAdminOnly && !isMainAdmin) return false;
            return true;
          })
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] text-left cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/20 dark:bg-amber-600'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.id === 'notifications' && (unreadNotificationsCount || 0) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0 ml-1.5 animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
                {(item as any).badge !== undefined && (item as any).badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shrink-0 ml-1.5 shadow-xs animate-pulse">
                    {(item as any).badge}
                  </span>
                )}
                {(item as any).adminOnly && !isAdmin && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-500 font-normal">
                    {language === 'bn' ? 'অ্যাডমিন' : 'Admin'}
                  </span>
                )}
              </button>
            );
          })}
      </nav>

      {/* Language & Theme Controls (Single Language Toggle Button) */}
      <div className="pt-2.5 pb-1 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (onLanguageToggle) onLanguageToggle();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
          title="Switch Language (বাংলা / English)"
        >
          <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>{language === 'bn' ? 'English' : 'বাংলা'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onThemeToggle) onThemeToggle();
          }}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer flex items-center justify-center"
          title={theme === 'light' ? t.nightMode : t.dayMode}
          aria-label="Toggle Day / Night mode"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-700" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>
      </div>

      {/* Bottom Login / Logout & Public Website Controls */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-auto space-y-1.5">

        {isViewOnly ? (
          <button
            onClick={() => {
              if (onOpenLoginModal) onOpenLoginModal();
              else if (onOpenMemberLoginModal) onOpenMemberLoginModal();
              else if (onOpenAdminLoginModal) onOpenAdminLoginModal();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
            title={language === 'bn' ? 'লগইন (Login)' : 'Login'}
          >
            <LogIn className="w-4 h-4" />
            <span>{language === 'bn' ? 'লগইন' : 'Login'}</span>
          </button>
        ) : onLogout ? (
          <button
            onClick={() => {
              onLogout();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            title={language === 'bn' ? 'লগআউট করে ভিউ-অনলি ড্যাশবোর্ডে ফিরুন' : 'Logout to View-Only Dashboard'}
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>{language === 'bn' ? 'লগআউট' : 'Logout'}</span>
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-[calc(100vh-4rem)] sticky top-16 flex-shrink-0 print:hidden">
        {content}
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200 print:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-64 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
