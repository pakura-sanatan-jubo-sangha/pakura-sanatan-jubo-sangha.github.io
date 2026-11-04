import React, { useState, useEffect, useMemo } from 'react';
import {
  FullAppData,
  UserAccount,
  Member,
  Language,
  Theme,
  PaymentMethod,
  SocietyRule,
  MeetingAttendee,
  WithdrawalSource,
} from './types';
import { StorageService, MAIN_ADMIN_EMAIL } from './lib/storage';
import { GoogleSheetsService, syncViaAppsScriptWebhook } from './lib/sheetsService';
import { getAccessToken, initAuth } from './lib/firebase';
import { FirebaseSyncService } from './lib/firebaseSync';
import { getTranslation } from './lib/translations';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { ContributionsView } from './components/ContributionsView';
import { LoansView } from './components/LoansView';
import { IncomeExpenseView } from './components/IncomeExpenseView';
import { TransactionsView } from './components/TransactionsView';
import { ReportsView } from './components/ReportsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ReceiptsView } from './components/ReceiptsView';
import { GoogleSheetsView } from './components/GoogleSheetsView';
import { AdminAndRulesView } from './components/AdminAndRulesView';
import { ActivityLogView } from './components/ActivityLogView';
import { SettingsView } from './components/SettingsView';
import { MemberDashboardView } from './components/MemberDashboardView';
import { MemberSavingsView } from './components/MemberSavingsView';
import { WithdrawalsManagementView } from './components/WithdrawalsManagementView';
import { InteractiveHoverEffects } from './components/InteractiveHoverEffects';
import { AuthModal, AuthMode } from './components/AuthModal';
import { NotificationsModal } from './components/NotificationsModal';
import {
  generateUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  EnrichedNotification,
} from './lib/notifications';
import {
  ShieldAlert,
  Key,
  CheckCircle2,
  RefreshCw,
  Eye,
  ShieldCheck,
  Lock,
  Phone,
  UserPlus,
  Shield,
  UserCheck,
  Bell,
  LogIn,
  PiggyBank,
  Calendar,
  BookOpen,
  CheckCheck,
} from 'lucide-react';

const VALID_SPA_TABS = new Set([
  'dashboard',
  'member_dashboard',
  'members',
  'contributions',
  'loans',
  'income',
  'expenses',
  'transactions',
  'reports',
  'analytics',
  'receipts',
  'sheets',
  'withdrawals',
  'admin_rules',
  'users',
  'activity_log',
  'settings',
  'notifications',
  'penalties',
  'profit',
  'member_profit',
  'member_penalties',
]);

function getInitialTabFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  // 1. Check URL hash (e.g., #/members or #members)
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
  if (hash && VALID_SPA_TABS.has(hash)) {
    return hash;
  }
  // 2. Check URL pathname for clean URLs on cPanel rewrite (e.g., /members or /loans)
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
  if (path && VALID_SPA_TABS.has(path)) {
    return path;
  }
  return null;
}

export default function App() {
  // 1. Core Application State
  const [appData, setAppData] = useState<FullAppData>(() => StorageService.loadData());
  const [language, setLanguage] = useState<Language>(() => appData.settings.language || 'bn');
  const [theme, setTheme] = useState<Theme>(() => appData.settings.theme || 'light');
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => StorageService.getCurrentUser());

  const isViewOnly = currentUser.userId === 'USR-VIEW-ONLY';
  const isMember = currentUser.role === 'member' && !isViewOnly;
  const isAdmin = currentUser.role === 'admin';

  // Public vs Private Interface separation:
  // Public visitors ALWAYS land on the Public Website.
  // Authenticated users enter their private dashboard, but can toggle to preview the public site.
  const [currentTab, setCurrentTabState] = useState<string>(() => {
    const tabFromUrl = getInitialTabFromUrl();
    if (tabFromUrl) return tabFromUrl;
    const user = StorageService.getCurrentUser();
    const isRealMember = user.role === 'member' && Boolean(user.memberSystemId) && user.userId !== 'USR-VIEW-ONLY';
    return isRealMember ? 'member_dashboard' : 'dashboard';
  });

  const setCurrentTab = (tab: string) => {
    setCurrentTabState(tab);
    if (typeof window !== 'undefined') {
      const targetHash = `#${tab}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState({ tab }, '', targetHash);
      }
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: AuthMode;
  }>({ isOpen: false, mode: 'login' });

  // Sync routing state with browser Back/Forward navigation & direct URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#/login/member') {
        setAuthModalState({ isOpen: true, mode: 'member_login' });
      } else if (hash === '#/login/admin') {
        setAuthModalState({ isOpen: true, mode: 'admin_login' });
      } else {
        const tab = getInitialTabFromUrl();
        if (tab) {
          setCurrentTabState(tab);
        }
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    // Initial hash inspection for logins
    if (typeof window !== 'undefined') {
      const h = window.location.hash.toLowerCase();
      if (h === '#/login/member') {
        setAuthModalState({ isOpen: true, mode: 'member_login' });
      } else if (h === '#/login/admin') {
        setAuthModalState({ isOpen: true, mode: 'admin_login' });
      }
    }

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Notifications for current active user
  const notifications = useMemo(
    () => generateUserNotifications(currentUser, appData, language),
    [currentUser, appData, language]
  );

  const handleMarkNotificationRead = (id: string) => {
    markNotificationAsRead(id);
    setAppData(StorageService.getAppData());
  };

  const handleMarkAllNotificationsRead = () => {
    const ids = notifications.map((n) => n.id);
    markAllNotificationsAsRead(ids);
    setAppData(StorageService.getAppData());
  };

  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setAppData(StorageService.getAppData());
    showToast(
      language === 'bn'
        ? `স্বাগতম ${user.displayName || user.name}! সফলভাবে প্রবেশ করেছেন।`
        : `Welcome ${user.displayName || user.name}! Logged in successfully.`
    );
    if (user.role === 'member') {
      setCurrentTab('member_dashboard');
    } else {
      setCurrentTab('dashboard');
    }
  };

  const t = getTranslation(language);
  const isMainAdmin =
    isAdmin &&
    (currentUser.isMainAdmin === true ||
      currentUser.email?.toLowerCase() === 'freelancerkajolchandradas@gmail.com' ||
      currentUser.userId === 'USR-000001');

  // 2. Sync Theme (Day / Night mode) with HTML Root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // 3. Listen to Firebase Authentication state for Admin access
  useEffect(() => {
    const unsubscribe = initAuth((firebaseUser) => {
      if (firebaseUser) {
        // Only trigger admin login if it is a real Google account, not internal synthetic member phone login
        const email = (firebaseUser.email || '').toLowerCase().trim();
        const isSyntheticMember = email.endsWith('@member.pakura.org') || email.includes('member.pakura.org');
        if (!isSyntheticMember && email) {
          const adminUser = StorageService.loginAdminWithFirebase(firebaseUser);
          setCurrentUser(adminUser);
          setAppData(StorageService.getAppData());
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // 4. Apply clean slate and load cloud data
  useEffect(() => {
    let isMounted = true;
    StorageService.checkAndApplyCleanSlate();
    if (isMounted) {
      setAppData(StorageService.getAppData());
    }

    const syncCloudData = async () => {
      try {
        const cloudData = await FirebaseSyncService.loadAllFromFirestore();
        if (!isMounted) return;
        if (cloudData && Object.keys(cloudData).length > 0) {
          StorageService.mergeCloudData(cloudData);
          setAppData(StorageService.getAppData());
        }
        if (!cloudData?.settings) {
          FirebaseSyncService.syncSettings(StorageService.getSettings()).catch(() => {});
        }
      } catch (err) {
        console.warn('Firestore cloud sync notice:', err);
      }
    };

    syncCloudData();

    // Re-sync when user returns to window / app tab on mobile or desktop
    const handleFocus = () => {
      syncCloudData();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    // Periodic sync every 30s so changes across devices show automatically
    const interval = setInterval(syncCloudData, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Switch language
  const handleToggleLanguage = () => {
    const nextLang: Language = language === 'bn' ? 'en' : 'bn';
    setLanguage(nextLang);
    const updated = StorageService.updateSettings({ language: nextLang });
    setAppData(updated);
  };

  // Switch theme (Day / Night Mode)
  const handleToggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    const updated = StorageService.updateSettings({ theme: nextTheme });
    setAppData(updated);
  };

  // Role switching & Admin Unlock
  const handleAdminLoginSuccess = () => {
    const adminUser = StorageService.getCurrentUser();
    setCurrentUser(adminUser);
    setAppData(StorageService.getAppData());
    showToast(
      language === 'bn'
        ? 'প্রধান অ্যাডমিন হিসেবে সফলভাবে প্রবেশ করেছেন! পূর্ণ এডিটিং ও অন্যান্য অ্যাডমিন অপসারণ সক্রিয়।'
        : 'Successfully logged in as Main Super Admin! Full editing & admin control active.'
    );
  };

  // Logout back to view-only mode for dashboard
  const handleLogout = () => {
    const visitor = StorageService.logout();
    setCurrentUser(visitor);
    setAppData(StorageService.getAppData());
    showToast(
      language === 'bn'
        ? 'লগআউট সম্পন্ন হয়েছে।'
        : 'Logged out successfully.'
    );
    if (['users', 'activity_log', 'settings'].includes(currentTab)) {
      setCurrentTab('dashboard');
    }
  };

  // Main admin authority to delete other admins and users
  const handleDeleteUser = (userId: string) => {
    const res = StorageService.deleteUser(userId, currentUser);
    if (res.success) {
      setAppData(res.data);
      showToast(res.message);
    } else {
      showToast(`⚠️ ${res.message}`);
    }
  };

  // Society Rules & Meeting Decisions Handlers (Main Admin authority)
  const handleAddRule = (ruleData: Omit<SocietyRule, 'ruleId' | 'createdAt' | 'updatedAt' | 'addedBy' | 'addedByEmail'>) => {
    const res = StorageService.addRule(ruleData, currentUser);
    if (res.success) {
      setAppData(res.data);
      showToast(res.message);
      triggerAutoSaveToGoogleSheets(res.data);
    } else {
      showToast(`⚠️ ${res.message}`);
    }
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<SocietyRule>) => {
    const res = StorageService.updateRule(ruleId, updates, currentUser);
    if (res.success) {
      setAppData(res.data);
      showToast(res.message);
      triggerAutoSaveToGoogleSheets(res.data);
    } else {
      showToast(`⚠️ ${res.message}`);
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    const res = StorageService.deleteRule(ruleId, currentUser);
    if (res.success) {
      setAppData(res.data);
      showToast(res.message);
      triggerAutoSaveToGoogleSheets(res.data);
    } else {
      showToast(`⚠️ ${res.message}`);
    }
  };

  // General Meetings & Attendance Handlers
  const handleCreateMeeting = (meetingData: {
    title: string;
    meetingDate: string;
    scheduledTime: string;
    location: string;
    agenda?: string;
    notes?: string;
  }) => {
    try {
      const updated = StorageService.createMeeting(meetingData, currentUser);
      setAppData(updated);
      showToast(language === 'bn' ? 'সাধারণ সভার নোটিশ তৈরি হয়েছে' : 'Meeting notice scheduled successfully');
      triggerAutoSaveToGoogleSheets(updated);
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    }
  };

  const handleRecordMeetingAttendance = (
    meetingId: string,
    attendees: MeetingAttendee[],
    notes?: string
  ) => {
    try {
      const updated = StorageService.recordMeetingAttendance(meetingId, attendees, currentUser, notes);
      setAppData(updated);
      showToast(language === 'bn' ? 'সাধারণ সভার উপস্থিতি সফলভাবে সংরক্ষিত হয়েছে' : 'Meeting attendance recorded successfully');
      triggerAutoSaveToGoogleSheets(updated);
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    }
  };

  const handleDeleteMeeting = (meetingId: string) => {
    try {
      const updated = StorageService.deleteMeeting(meetingId, currentUser);
      setAppData(updated);
      showToast(language === 'bn' ? 'সভার নোটিশ মুছে ফেলা হয়েছে' : 'Meeting deleted');
      triggerAutoSaveToGoogleSheets(updated);
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    }
  };

  const handleClearActivityLogs = () => {
    const res = StorageService.clearAllActivityLogs(currentUser);
    if (res.success) {
      setAppData(res.data);
      showToast(res.message);
    } else {
      showToast(`⚠️ ${res.message}`);
    }
  };

  // Google Sheets Auto-Recording Background Engine
  const triggerAutoSaveToGoogleSheets = async (updatedData: FullAppData) => {
    const sheetId = updatedData.settings.googleSheetId;
    const scriptUrl = updatedData.settings.googleAppsScriptUrl;
    const autoSyncEnabled = updatedData.settings.autoSyncSheets ?? true;

    if (!autoSyncEnabled || (!sheetId && !scriptUrl)) {
      return;
    }

    setIsAutoSaving(true);
    try {
      // 1. Google Apps Script Webhook (100% guaranteed auto-sync across all devices)
      if (scriptUrl) {
        await syncViaAppsScriptWebhook(scriptUrl, updatedData);
      }
      // 2. Direct Google Sheets API (if main admin is active)
      if (sheetId) {
        const isMainAdminModifier =
          currentUser.email?.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase() ||
          (currentUser.role === 'admin' && currentUser.isMainAdmin === true);
        if (isMainAdminModifier) {
          await GoogleSheetsService.syncAllToGoogleSheets(sheetId, updatedData).catch(() => {});
        }
      }
      const timeStr = new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US');
      setLastSavedTimestamp(timeStr);
    } catch (err) {
      console.warn('Google Sheets auto-save notice:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  // View Receipt Handler
  const handleViewReceipt = (receiptId: string) => {
    setPreviewReceiptId(receiptId);
    setCurrentTab('receipts');
  };

  // Operations (Enforcing single admin permission)
  const handleAddMember = (name: string, phone: string) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন সদস্য যুক্ত করতে পারেন।' : 'Only Admin can add members.');
      return;
    }
    const updated = StorageService.addMember(name, phone, currentUser);
    setAppData(updated);
    showToast(language === 'bn' ? `সদস্য "${name}" সফলভাবে যুক্ত হয়েছেন!` : `Member "${name}" added successfully!`);
    triggerAutoSaveToGoogleSheets(updated);
  };

  const handleUpdateMember = (
    systemId: string,
    name: string,
    phone: string,
    status: 'active' | 'inactive'
  ) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন সদস্য তথ্য পরিবর্তন করতে পারেন।' : 'Only Admin can edit members.');
      return;
    }
    const updated = StorageService.updateMember(systemId, { name, phone, status }, undefined, undefined, currentUser);
    setAppData(updated);
    showToast(language === 'bn' ? 'সদস্য তথ্য সফলভাবে হালনাগাদ হয়েছে!' : 'Member details updated successfully!');
    triggerAutoSaveToGoogleSheets(updated);
  };

  const handleDeleteMember = (systemId: string) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন সদস্য মুছে ফেলতে পারেন।' : 'Only Admin can delete members.');
      return;
    }
    const updated = StorageService.deleteMember(systemId, currentUser);
    setAppData(updated);
    showToast(
      language === 'bn'
        ? 'সদস্যকে সফলভাবে সদস্য তালিকা থেকে মুছে ফেলা হয়েছে!'
        : 'Member successfully deleted from roster!'
    );
    triggerAutoSaveToGoogleSheets(updated);
  };

  const handleRecordContribution = (
    memberSystemId: string,
    amount: number,
    month: string,
    method: PaymentMethod,
    contributionType?: 'regular' | 'seasonal_booster',
    notes?: string
  ) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন চাঁদা গ্রহণ করতে পারেন।' : 'Only Admin can record contributions.');
      return;
    }
    const result = StorageService.recordContribution(
      memberSystemId,
      amount,
      month,
      method,
      currentUser,
      contributionType,
      notes
    );
    setAppData(result.data);
    const typeText = language === 'bn' ? 'মাসিক সঞ্চয়' : 'Monthly Savings';
    showToast(
      language === 'bn'
        ? `৳${amount.toLocaleString()} ${typeText} গ্রহণ করা হয়েছে ও রশিদ #${result.receipt.receiptId} তৈরি হয়েছে!`
        : `Collected ৳${amount.toLocaleString()} (${typeText}), Receipt #${result.receipt.receiptId} issued!`
    );

    triggerAutoSaveToGoogleSheets(result.data);
    handleViewReceipt(result.receipt.receiptId);
  };

  const handleRecordBulkContributions = (
    memberSystemIds: string[],
    amount: number,
    month: string,
    method: PaymentMethod
  ) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন চাঁদা গ্রহণ করতে পারেন।' : 'Only Admin can record contributions.');
      return;
    }
    const updated = StorageService.recordBulkContributions(
      memberSystemIds,
      amount,
      month,
      method,
      currentUser.displayName
    );
    setAppData(updated);
    showToast(
      language === 'bn'
        ? `${memberSystemIds.length} জন সদস্যের চাঁদা সফলভাবে জমা হয়েছে!`
        : `Collected contributions for ${memberSystemIds.length} members!`
    );

    triggerAutoSaveToGoogleSheets(updated);
  };

  const handleCreateLoan = (
    borrowerName: string,
    borrowerPhone: string,
    borrowerNid: string,
    principal: number,
    loanDate: string,
    method: PaymentMethod
  ) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন ঋণ বিতরণ করতে পারেন।' : 'Only Admin can issue loans.');
      return;
    }
    const result = StorageService.issueLoan(
      borrowerName,
      borrowerPhone,
      borrowerNid,
      principal,
      loanDate,
      method,
      currentUser.displayName
    );
    setAppData(result.data);
    showToast(
      language === 'bn'
        ? `৳${principal} ঋণ ১০% মাসিক সুদে বিতরণ করা হয়েছে!`
        : `Disbursed ৳${principal} loan at 10% monthly interest!`
    );
    triggerAutoSaveToGoogleSheets(result.data);
    handleViewReceipt(result.receipt.receiptId);
  };

  const handleReceiveLoanPayment = (
    loanId: string,
    amount: number,
    date: string,
    method: PaymentMethod,
    notes: string,
    discount?: number
  ) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন ঋণ কিস্তি আদায় করতে পারেন।' : 'Only Admin can record loan repayments.');
      return;
    }
    const result = StorageService.receiveLoanPayment(
      loanId,
      amount,
      date,
      method,
      notes,
      currentUser,
      discount || 0
    );
    setAppData(result.data);
    const effDiscount = discount && discount > 0 ? ` (মুনাফায় ছাড়: ৳${discount})` : '';
    showToast(
      language === 'bn'
        ? `৳${amount} ঋণ আদায় সম্পন্ন হয়েছে${effDiscount}!`
        : `Received ৳${amount} loan repayment${effDiscount}!`
    );
    triggerAutoSaveToGoogleSheets(result.data);
    handleViewReceipt(result.receipt.receiptId);
  };

  const handleRecordRepaidLoan = (params: {
    borrowerName: string;
    borrowerPhone: string;
    borrowerNid: string;
    principal: number;
    loanDate: string;
    repaymentDate: string;
    accruedProfit: number;
    discount: number;
    paymentMethod: PaymentMethod;
    notes: string;
  }) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন পরিশোধিত ঋণ রেকর্ড করতে পারেন।' : 'Only Admin can record repaid loans.');
      return;
    }
    const result = StorageService.recordAlreadyRepaidLoan({
      ...params,
      currentUserOrName: currentUser,
    });
    setAppData(result.data);
    const netProfit = Math.max(0, params.accruedProfit - (params.discount || 0));
    showToast(
      language === 'bn'
        ? `ইতিমধ্যে পরিশোধিত ঋণ (আসল ৳${params.principal.toLocaleString()}, নিট মুনাফা ৳${netProfit.toLocaleString()}${params.discount > 0 ? `, ছাড় ৳${params.discount}` : ''}) সফলভাবে সংরক্ষিত হয়েছে!`
        : `Recorded repaid loan (Principal ৳${params.principal.toLocaleString()}, Net Profit ৳${netProfit.toLocaleString()})!`
    );
    triggerAutoSaveToGoogleSheets(result.data);
    handleViewReceipt(result.receipt.receiptId);
  };

  const handleAddIncomeExpense = (
    type: 'income' | 'expense',
    data: {
      amount: number;
      date: string;
      category: string;
      paymentMethod: PaymentMethod;
      person: string;
      note: string;
    }
  ) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন আয়-ব্যয় যোগ করতে পারেন।' : 'Only Admin can record income/expenses.');
      return;
    }
    if (type === 'income') {
      StorageService.addIncome(
        data.category as any,
        data.amount,
        data.date,
        data.note || data.person || 'General Income',
        data.paymentMethod,
        currentUser
      );
      showToast(language === 'bn' ? `৳${data.amount} আয় সফলভাবে জমা হয়েছে!` : `Recorded ৳${data.amount} income!`);
    } else {
      StorageService.addExpense(
        data.category as any,
        data.amount,
        data.date,
        data.note || data.person || 'General Expense',
        data.paymentMethod,
        currentUser
      );
      showToast(language === 'bn' ? `৳${data.amount} ব্যয় লিপিবদ্ধ হয়েছে!` : `Recorded ৳${data.amount} expense!`);
    }
    const refreshed = StorageService.getAppData();
    setAppData(refreshed);
    triggerAutoSaveToGoogleSheets(refreshed);
  };

  const handleUpdateSpreadsheetId = (id: string) => {
    const updated = StorageService.updateSettings({ googleSheetId: id });
    setAppData(updated);
    showToast(language === 'bn' ? 'গুগল শিট আইডি সংরক্ষিত হয়েছে।' : 'Google Sheet ID saved.');
    triggerAutoSaveToGoogleSheets(updated);
  };

  const handleAddActivityLog = (action: string, details: string) => {
    const updated = StorageService.addActivityLog(action, details, currentUser.displayName);
    setAppData(updated);
  };

  const handleAllocateProfit = (params: {
    periodType: 'monthly' | 'yearly' | 'custom';
    periodLabel: string;
    percentage?: number;
    fixedAmountPerMember?: number;
    distributionMethod: 'equal' | 'proportional';
    notes?: string;
    allocationDate?: string;
  }) => {
    if (!isAdmin) {
      showToast(language === 'bn' ? 'শুধুমাত্র প্রধান অ্যাডমিন লভ্যাংশ তহবিল বন্টন করতে পারেন।' : 'Only Admin can allocate profits.');
      return;
    }
    const result = StorageService.allocateLoanProfitToMembers({
      ...params,
      currentUser,
    });
    if (result.success) {
      setAppData(result.data);
      const detail = params.fixedAmountPerMember
        ? `(সদস্য প্রতি ৳${params.fixedAmountPerMember.toLocaleString()})`
        : `(${params.percentage}%)`;
      showToast(
        language === 'bn'
          ? `মোট ৳${result.distribution?.totalAllocatedAmount.toLocaleString()} ঋণ মুনাফা ${detail} সফলভাবে সাধারণ সদস্য একাউন্টে যোগ করা হয়েছে!`
          : `Allocated ৳${result.distribution?.totalAllocatedAmount.toLocaleString()} loan profit to general members!`
      );
      triggerAutoSaveToGoogleSheets(result.data);
    } else {
      showToast(result.message);
    }
  };

  const handleMemberWithdrawal = (params: {
    memberSystemId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    reason?: string;
  }) => {
    const result = StorageService.executeMemberWithdrawal({
      ...params,
      currentUser,
    });
    if (result.success) {
      setAppData(result.data);
      showToast(
        language === 'bn'
          ? `৳${params.amount.toLocaleString()} সফলভাবে উত্তোলন সম্পন্ন হয়েছে!`
          : `Successfully withdrawn ৳${params.amount.toLocaleString()}!`
      );
      triggerAutoSaveToGoogleSheets(result.data);
      if (result.receipt) {
        handleViewReceipt(result.receipt.receiptId);
      }
    } else {
      showToast(result.message);
    }
  };

  const handleRequestWithdrawal = (params: {
    memberSystemId: string;
    amount: number;
    source: WithdrawalSource;
    paymentMethod: PaymentMethod;
    payoutAccount?: string;
    reason?: string;
  }) => {
    const result = StorageService.requestMemberWithdrawal({
      ...params,
      currentUser,
    });
    if (result.success) {
      setAppData(result.data);
      showToast(
        language === 'bn'
          ? `৳${params.amount.toLocaleString()} উত্তোলনের আবেদন সফলভাবে জমা হয়েছে! অ্যাডমিন পর্যালোচনার পর অনুমোদন ও অর্থ প্রদান করবেন।`
          : `Withdrawal request for ৳${params.amount.toLocaleString()} submitted successfully!`
      );
      triggerAutoSaveToGoogleSheets(result.data);
    } else {
      showToast(result.message);
    }
  };

  const handleApproveWithdrawal = (params: {
    withdrawalId: string;
    paymentMethod: PaymentMethod;
    receiptNotes?: string;
  }) => {
    const result = StorageService.approveAndDisburseWithdrawal({
      withdrawalId: params.withdrawalId,
      paymentMethod: params.paymentMethod,
      adminNotes: params.receiptNotes,
      adminUser: currentUser,
    });
    if (result.success) {
      setAppData(result.data);
      showToast(
        language === 'bn'
          ? 'উত্তোলন আবেদনটি সফলভাবে অনুমোদন ও পরিশোধ করা হয়েছে!'
          : 'Withdrawal approved & disbursed successfully!'
      );
      triggerAutoSaveToGoogleSheets(result.data);
      if (result.receipt) {
        handleViewReceipt(result.receipt.receiptId);
      }
    } else {
      showToast(result.message);
    }
  };

  const handleRejectWithdrawal = (params: {
    withdrawalId: string;
    rejectionReason: string;
  }) => {
    const result = StorageService.rejectWithdrawalRequest({
      withdrawalId: params.withdrawalId,
      rejectionReason: params.rejectionReason,
      adminUser: currentUser,
    });
    if (result.success) {
      setAppData(result.data);
      showToast(
        language === 'bn'
          ? 'উত্তোলন আবেদনটি বাতিল করা হয়েছে।'
          : 'Withdrawal request rejected.'
      );
      triggerAutoSaveToGoogleSheets(result.data);
    } else {
      showToast(result.message);
    }
  };

  const handleCancelWithdrawal = (withdrawalId: string) => {
    const result = StorageService.cancelWithdrawalRequest({
      withdrawalId,
      currentUser,
    });
    if (result.success) {
      setAppData(result.data);
      showToast(
        language === 'bn'
          ? 'উত্তোলন আবেদনটি সফলভাবে প্রত্যাহার করা হয়েছে।'
          : 'Withdrawal request cancelled.'
      );
      triggerAutoSaveToGoogleSheets(result.data);
    } else {
      showToast(result.message);
    }
  };

  const handleDirectWithdrawal = (params: {
    memberSystemId: string;
    amount: number;
    source: WithdrawalSource;
    paymentMethod: PaymentMethod;
    reason?: string;
  }) => {
    const result = StorageService.executeMemberWithdrawal({
      ...params,
      currentUser,
    });
    if (result.success) {
      setAppData(result.data);
      showToast(
        language === 'bn'
          ? `৳${params.amount.toLocaleString()} সফলভাবে পরিশোধ ও হিসাব সমন্বয় সম্পন্ন হয়েছে!`
          : `Successfully disbursed ৳${params.amount.toLocaleString()}!`
      );
      triggerAutoSaveToGoogleSheets(result.data);
      if (result.receipt) {
        handleViewReceipt(result.receipt.receiptId);
      }
    } else {
      showToast(result.message);
    }
  };

  const handleUpdateSettings = (newSettings: Partial<typeof appData.settings>) => {
    const updated = StorageService.updateSettings(newSettings);
    setAppData(updated);
    showToast(language === 'bn' ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে।' : 'Settings saved successfully.');
    triggerAutoSaveToGoogleSheets(updated);
  };

  const handleResetDatabase = async () => {
    const resetData = StorageService.resetToInitialDatabase();
    setAppData(resetData);
    showToast(
      language === 'bn'
        ? 'ডাটাবেজ ও ফায়ারবেসের সমস্ত আর্থিক হিসাব ৳০-তে রিসেট সম্পন্ন হয়েছে!'
        : 'Database and Firebase financial records completely reset to ৳0!'
    );
    triggerAutoSaveToGoogleSheets(resetData);
    try {
      await FirebaseSyncService.resetFinancialDataInFirestore(resetData.members);
    } catch (err) {
      console.warn('Firebase reset sync warning:', err);
    }
  };

  const handleExportJson = async () => {
    // Incorporate both website data and live cloud data from Firebase into the full backup
    try {
      const cloudData = await FirebaseSyncService.loadAllFromFirestore();
      if (cloudData && Object.keys(cloudData).length > 0) {
        StorageService.mergeCloudData(cloudData);
      }
    } catch {}
    StorageService.exportDataAsJson();
  };

  const handleImportJson = async (jsonString: string) => {
    const success = StorageService.importDataFromJson(jsonString);
    if (success) {
      const refreshed = StorageService.getAppData();
      setAppData(refreshed);
      // Synchronize restored data to Firebase as well
      try {
        await FirebaseSyncService.syncAllToFirestore(refreshed);
      } catch (err) {
        console.warn('Firebase restore sync warning:', err);
      }
      showToast(
        language === 'bn'
          ? 'ব্যাকআপ ফাইল থেকে সমস্ত ডাটা ওয়েবসাইট ও ফায়ারবেসে সফলভাবে পুনরুদ্ধার (Restore) করা হয়েছে!'
          : 'All data successfully restored to website and Firebase from backup file!'
      );
      triggerAutoSaveToGoogleSheets(refreshed);
    } else {
      showToast(language === 'bn' ? 'অবৈধ JSON ব্যাকআপ ফাইল।' : 'Invalid JSON backup file.');
    }
  };

  const handleAddUser = (email: string, displayName: string, role: any, tempPassword?: string) => {
    const updated = StorageService.addUser(email, displayName, role, tempPassword, currentUser);
    setAppData(updated);
    showToast(
      language === 'bn'
        ? `${displayName} (${email})-কে ${role === 'admin' ? 'সহকারী অ্যাডমিন' : 'সদস্য'} হিসেবে যুক্ত করা হয়েছে!`
        : `Added ${displayName} (${email}) as ${role}!`
    );
  };

  const handleUpdateUserRole = (userId: string, newRole: any) => {
    const updated = StorageService.updateUserRole(userId, newRole);
    setAppData(updated);
  };

  // Metrics computation for dashboard & reports
  const metrics = StorageService.getFinancialSummary();

  // Retrieve all linked member accounts associated with this user (strictly their own phone number)
  const linkedMemberRecords = StorageService.getLinkedMembersForUser(currentUser, appData.members);
  const currentMemberRecord =
    linkedMemberRecords[0] ||
    (isAdmin && appData.members.length > 0
      ? appData.members.find((m) => m.status === 'active') || appData.members[0]
      : null);

  // Guarantee that every authenticated user navigating to member features has a valid member profile
  const resolvedMemberRecord: Member = useMemo(() => {
    if (currentMemberRecord) return currentMemberRecord;
    if (linkedMemberRecords.length > 0) return linkedMemberRecords[0];
    if (currentUser.memberSystemId) {
      const bySys = appData.members.find((m) => m.systemId.toLowerCase() === currentUser.memberSystemId?.toLowerCase());
      if (bySys) return bySys;
    }
    if (currentUser.username) {
      const byUname = appData.members.find((m) => m.systemId.toLowerCase() === currentUser.username?.toLowerCase());
      if (byUname) return byUname;
    }
    if (isAdmin && appData.members && appData.members.length > 0) {
      return appData.members.find((m) => m.status === 'active') || appData.members[0];
    }
    return {
      systemId: currentUser.memberSystemId || `MEM-${currentUser.userId.replace(/\D/g, '') || '000001'}`,
      name: currentUser.name || currentUser.displayName || 'সম্মানিত সদস্য',
      phone: currentUser.phone || currentUser.username || '',
      status: 'active' as const,
      currentBalance: 0,
      createdAt: currentUser.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
  }, [currentMemberRecord, linkedMemberRecords, appData.members, currentUser, isAdmin]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200 relative">
      {/* Global Interactive Dynamic Color Shifting & Area Hover Effects */}
      <InteractiveHoverEffects />

      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-18 sm:bottom-6 right-4 sm:right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div className="px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl text-xs font-semibold flex items-center gap-2.5 border border-slate-800 dark:border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Global Header */}
      <Header
        currentUser={currentUser}
        language={language}
        theme={theme}
        onLanguageToggle={handleToggleLanguage}
        onThemeToggle={handleToggleTheme}
        onGoogleSheetsClick={() => setCurrentTab('sheets')}
        onAdminLoginSuccess={handleAdminLoginSuccess}
        onOpenLogin={() => setAuthModalState({ isOpen: true, mode: 'login' })}
        onOpenMemberLogin={() => setAuthModalState({ isOpen: true, mode: 'member_login' })}
        onOpenAdminLogin={() => setAuthModalState({ isOpen: true, mode: 'admin_login' })}
        onLogout={handleLogout}
        isSheetConnected={Boolean(appData.settings.googleSheetId || appData.settings.googleAppsScriptUrl)}
        isAutoSaving={isAutoSaving}
        onOpenMobileSidebar={() => setIsMobileMenuOpen(true)}
        isOpenLoginModal={isLoginModalOpen}
        onCloseLoginModal={() => setIsLoginModalOpen(false)}
        notifications={notifications}
        onOpenAllNotifications={() => setIsNotificationsModalOpen(true)}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onNavigateTab={(tab) => setCurrentTab(tab)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentUser={currentUser}
          language={language}
          theme={theme}
          onLanguageToggle={handleToggleLanguage}
          onThemeToggle={handleToggleTheme}
          onOpenLoginModal={() => setAuthModalState({ isOpen: true, mode: 'login' })}
          onOpenMemberLoginModal={() => setAuthModalState({ isOpen: true, mode: 'member_login' })}
          onOpenAdminLoginModal={() => setAuthModalState({ isOpen: true, mode: 'admin_login' })}
          onLogout={handleLogout}
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
          pendingWithdrawalsCount={(appData.memberWithdrawals || []).filter((w) => w.status === 'pending').length}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
        />

        {/* Content View Body */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">

              {/* 1. Dashboard View */}
              {currentTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              recentTransactions={appData.transactions}
              currentUser={currentUser}
              language={language}
              rules={appData.rules || []}
              onNavigate={setCurrentTab}
              onQuickAddMember={() => {
                if (!isAdmin) {
                  setIsLoginModalOpen(true);
                } else {
                  setCurrentTab('members');
                }
              }}
              onQuickContribution={() => setCurrentTab('contributions')}
              onQuickNewLoan={() => setCurrentTab('loans')}
              onQuickPayment={() => setCurrentTab('loans')}
              onOpenGoogleSheets={() => setCurrentTab('sheets')}
              isSheetConnected={Boolean(appData.settings.googleSheetId || appData.settings.googleAppsScriptUrl)}
            />
          )}

          {/* Guest / View-Only Access Gate for non-dashboard tabs */}
          {isViewOnly && currentTab !== 'dashboard' && (
            <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg text-center animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
                {language === 'bn' ? 'লগইন আবশ্যক' : 'Login Required'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                {language === 'bn'
                  ? 'হোম ড্যাশবোর্ড ব্যতীত অন্যান্য বিস্তারিত তথ্য ও হিসাব দেখতে সাধারণ সদস্যগণ মোবাইল নম্বর দিয়ে এবং অ্যাডমিনগণ জিমেইল দিয়ে লগইন করুন।'
                  : 'Viewing sections beyond the  Dashboard requires general members to log in with mobile phone numbers and administrators to log in with Gmail.'}
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => setAuthModalState({ isOpen: true, mode: 'login' })}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{language === 'bn' ? 'লগইন করুন (Login)' : 'Login'}</span>
                </button>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  onClick={() => setAuthModalState({ isOpen: true, mode: 'register' })}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer flex items-center justify-center gap-1.5 mx-auto hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'নতুন সদস্য? মোবাইল দিয়ে অ্যাকাউন্ট নিবন্ধন করুন' : 'New Member? Register with Phone'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Notifications View for Logged-In Users */}
          {!isViewOnly && isAdmin && currentTab === 'notifications' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Header */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {language === 'bn' ? 'সকল নোটিফিকেশন ও ঘোষণা' : 'Notification & Notice Center'}
                      </h2>
                      {notifications.filter((n) => !n.isRead).length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">
                          {notifications.filter((n) => !n.isRead).length} {language === 'bn' ? 'নতুন' : 'new'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {language === 'bn'
                        ? 'মাসিক সঞ্চয় জমাদান, সাধারণ সভার নোটিশ, সভার সিদ্ধান্ত ও সমিতির আপডেটসমূহ।'
                        : 'Savings reminders, meeting announcements, rules resolutions, and society notices.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {notifications.filter((n) => !n.isRead).length > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>{language === 'bn' ? 'সব পঠিত হিসেবে চিহ্নিত করুন' : 'Mark all read'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNotificationsModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{language === 'bn' ? 'পপআপ ভিউ (View All)' : 'Popup View'}</span>
                  </button>
                </div>
              </div>

              {/* Notification Cards List */}
              {notifications.length === 0 ? (
                <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-400">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">{language === 'bn' ? 'কোনো নতুন নোটিফিকেশন নেই' : 'No notifications found'}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === 'bn' ? 'সমিতির সকল গুরুত্বপূর্ণ ঘোষণা ও নোটিশ এখানে দেখতে পাবেন।' : 'All key society announcements and alerts will be listed here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkNotificationRead(notif.id)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                        notif.isRead
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/80 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                          {notif.category === 'payment' ? (
                            <PiggyBank className="w-5 h-5 text-emerald-600" />
                          ) : notif.category === 'meeting' ? (
                            <Calendar className="w-5 h-5 text-purple-600" />
                          ) : notif.category === 'rule' ? (
                            <BookOpen className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Bell className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                              {notif.title}
                            </h3>
                            {!notif.isRead && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                                {language === 'bn' ? 'নতুন' : 'NEW'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                            {notif.message}
                          </p>
                          <div className="mt-1.5 text-[11px] text-slate-400">
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US') : ''}
                          </div>
                        </div>
                      </div>

                      {notif.actionTab && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkNotificationRead(notif.id);
                            setCurrentTab(notif.actionTab!);
                          }}
                          className="self-end sm:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 transition-colors shrink-0 shadow-2xs cursor-pointer"
                        >
                          {notif.actionLabel || (language === 'bn' ? 'বিস্তারিত দেখুন →' : 'View Details →')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Members View (Accessible to both Admins and Members) */}
          {!isViewOnly && currentTab === 'members' && (
            <MembersView
              members={appData.members}
              contributions={appData.contributions}
              currentUser={currentUser}
              language={language}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onRecordContributionForMember={() => setCurrentTab('contributions')}
              onViewReceipt={handleViewReceipt}
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
            />
          )}

          {/* 3. Contributions View (Monthly Savings) */}
          {!isViewOnly && currentTab === 'contributions' && (
            isMember && currentMemberRecord ? (
              <MemberSavingsView
                member={currentMemberRecord}
                linkedMembers={linkedMemberRecords}
                contributions={appData.contributions}
                receipts={appData.receipts}
                monthlyAmount={appData.settings.monthlyContributionAmount}
                dueDay={appData.settings.contributionDueDay}
                lateFeeAmount={appData.settings.lateFeeAmount}
                language={language}
                onViewReceipt={handleViewReceipt}
              />
            ) : (
              <ContributionsView
                members={appData.members}
                contributions={appData.contributions}
                currentUser={currentUser}
                language={language}
                monthlyAmount={appData.settings.monthlyContributionAmount}
                dueDay={appData.settings.contributionDueDay}
                lateFeeAmount={appData.settings.lateFeeAmount}
                onRecordContribution={handleRecordContribution}
                onRecordBulkContributions={handleRecordBulkContributions}
                onViewReceipt={handleViewReceipt}
                onOpenAddMember={() => setCurrentTab('members')}
                onOpenLoginModal={() => setAuthModalState({ isOpen: true, mode: 'admin_login' })}
              />
            )
          )}

          {/* 4. Loans View (10% Monthly Profit & Loan Management) */}
          {!isViewOnly && currentTab === 'loans' && (
            <LoansView
              loans={appData.loans}
              borrowers={appData.borrowers}
              payments={appData.loanPayments}
              contributions={appData.contributions}
              members={appData.members}
              distributions={appData.profitDistributions || []}
              expenses={appData.expenses || []}
              currentUser={currentUser}
              language={language}
              onCreateLoan={handleCreateLoan}
              onReceivePayment={handleReceiveLoanPayment}
              onRecordRepaidLoan={handleRecordRepaidLoan}
              onViewReceipt={handleViewReceipt}
              onAllocateProfit={handleAllocateProfit}
            />
          )}

          {/* 5. Income View (Everyone has access to view, Admin can manage) */}
          {!isViewOnly && currentTab === 'income' && (
            <IncomeExpenseView
              type="income"
              items={appData.incomes}
              currentUser={currentUser}
              language={language}
              onAddItem={(data) => handleAddIncomeExpense('income', data)}
            />
          )}

          {/* 6. Expenses View (Everyone has access to view, Admin can manage) */}
          {!isViewOnly && currentTab === 'expenses' && (
            <IncomeExpenseView
              type="expense"
              items={appData.expenses}
              currentUser={currentUser}
              language={language}
              onAddItem={(data) => handleAddIncomeExpense('expense', data)}
            />
          )}

          {/* 7. Transactions View (Master Double-Entry Ledger) */}
          {!isViewOnly && currentTab === 'transactions' && (
            <TransactionsView
              transactions={appData.transactions}
              currentUser={currentUser}
              language={language}
            />
          )}

          {/* 8. Reports View */}
          {!isViewOnly && currentTab === 'reports' && (
            <ReportsView
              metrics={metrics}
              members={appData.members}
              contributions={appData.contributions}
              loans={appData.loans}
              payments={appData.loanPayments}
              incomes={appData.incomes}
              expenses={appData.expenses}
              transactions={appData.transactions}
              language={language}
              currentUser={currentUser}
              onOpenGoogleSheets={() => setCurrentTab('sheets')}
            />
          )}

          {/* 9. Analytics View */}
          {!isViewOnly && currentTab === 'analytics' && (
            <AnalyticsView
              metrics={metrics}
              contributions={appData.contributions}
              loans={appData.loans}
              payments={appData.loanPayments}
              language={language}
            />
          )}

          {/* 10. Digital Receipts View */}
          {!isViewOnly && currentTab === 'receipts' && (
            <ReceiptsView
              receipts={appData.receipts}
              members={appData.members}
              contributions={appData.contributions}
              loanPayments={appData.loanPayments}
              withdrawals={appData.memberWithdrawals || []}
              currentUser={currentUser}
              language={language}
              selectedReceiptId={previewReceiptId}
              onClosePreview={() => setPreviewReceiptId(null)}
            />
          )}

          {/* 11. Google Sheets 14-Tab Cloud Synchronization View */}
          {!isViewOnly && currentTab === 'sheets' && (
            <GoogleSheetsView
              appData={appData}
              currentUser={currentUser}
              language={language}
              onUpdateSpreadsheetId={handleUpdateSpreadsheetId}
              onAddActivityLog={handleAddActivityLog}
            />
          )}

          {/* 12. Admin Withdrawals & Profit Dividend Management */}
          {!isViewOnly && isAdmin && currentTab === 'withdrawals' && (
            <WithdrawalsManagementView
              members={appData.members}
              withdrawals={appData.memberWithdrawals || []}
              distributions={appData.profitDistributions || []}
              metrics={metrics}
              currentUser={currentUser}
              language={language}
              maxWithdrawalPercentage={appData.settings.maxWithdrawalPercentage ?? 70}
              minReserveBalance={appData.settings.minReserveBalance ?? 500}
              onApproveAndDisburse={handleApproveWithdrawal}
              onRejectWithdrawal={handleRejectWithdrawal}
              onDirectWithdrawal={handleDirectWithdrawal}
              onViewReceipt={handleViewReceipt}
            />
          )}

          {/* 12.1. Member Personal Dashboard (If linked or member view) */}
          {!isViewOnly && (
            currentTab === 'member_dashboard' ||
            currentTab === 'member_penalties' ||
            currentTab === 'penalties' ||
            currentTab === 'member_profit' ||
            currentTab === 'profit' ||
            (!isAdmin && currentTab === 'withdrawals')
          ) && (
            <MemberDashboardView
              member={resolvedMemberRecord}
              linkedMembers={linkedMemberRecords.length > 0 ? linkedMemberRecords : [resolvedMemberRecord]}
              contributions={appData.contributions}
              receipts={appData.receipts}
              withdrawals={appData.memberWithdrawals || []}
              distributions={appData.profitDistributions || []}
              maxWithdrawalPercentage={appData.settings.maxWithdrawalPercentage ?? 70}
              minReserveBalance={appData.settings.minReserveBalance ?? 500}
              currentUser={currentUser}
              language={language}
              onViewReceipt={handleViewReceipt}
              monthlyAmount={appData.settings.monthlyContributionAmount}
              dueDay={appData.settings.contributionDueDay}
              lateFeeAmount={appData.settings.lateFeeAmount}
              initialTab={
                currentTab === 'member_penalties' || currentTab === 'penalties'
                  ? 'penalties'
                  : currentTab === 'member_profit' || currentTab === 'profit' || currentTab === 'withdrawals'
                  ? 'withdrawals'
                  : 'overview'
              }
              rules={appData.rules || []}
              meetings={appData.meetings || []}
              onNavigate={setCurrentTab}
              onExecuteWithdrawal={handleMemberWithdrawal}
              onRequestWithdrawal={handleRequestWithdrawal}
              onCancelWithdrawal={handleCancelWithdrawal}
              onRefreshData={() => setAppData(StorageService.getAppData())}
            />
          )}

          {/* 13. Admin & Rules: Society Rules & General Admin Management */}
          {!isViewOnly && (currentTab === 'admin_rules' || (currentTab === 'users' && isAdmin)) && (
            <AdminAndRulesView
              users={appData.users}
              rules={appData.rules || []}
              meetings={appData.meetings || []}
              members={appData.members || []}
              currentUser={currentUser}
              language={language}
              onAddUser={handleAddUser}
              onUpdateRole={handleUpdateUserRole}
              onDeleteUser={handleDeleteUser}
              onAddRule={handleAddRule}
              onUpdateRule={handleUpdateRule}
              onDeleteRule={handleDeleteRule}
              onCreateMeeting={handleCreateMeeting}
              onRecordAttendance={handleRecordMeetingAttendance}
              onDeleteMeeting={handleDeleteMeeting}
            />
          )}

          {/* 14. Super Admin Only: Security Activity Log */}
          {!isViewOnly && currentTab === 'activity_log' && (
            isAdmin ? (
              <ActivityLogView
                logs={appData.activityLogs}
                currentUser={currentUser}
                language={language}
                onClearLogs={handleClearActivityLogs}
              />
            ) : (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-md mx-auto my-8 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'লগইন আবশ্যক' : 'Login Required'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'bn'
                    ? 'ড্যাশবোর্ডটি ভিউ-অনলি মোডে রয়েছে। শুধুমাত্র প্রধান অ্যাডমিন হেডার থেকে লগইন করে সিকিউরিটি লগ দেখতে পারেন।'
                    : 'The dashboard is in View-Only mode. Only the main admin can access this section via header Admin Login.'}
                </p>
              </div>
            )
          )}

          {/* 15. Super Admin Only: System Settings & Admin Password Management */}
          {currentTab === 'settings' && (
            isAdmin ? (
              <SettingsView
                settings={appData.settings}
                currentUser={currentUser}
                language={language}
                onUpdateSettings={handleUpdateSettings}
                onResetDatabase={handleResetDatabase}
                onExportJson={handleExportJson}
                onImportJson={handleImportJson}
              />
            ) : (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-md mx-auto my-8 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সিস্টেম সেটিংস সুরক্ষিত' : 'System Settings Protected'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'bn'
                    ? 'ড্যাশবোর্ডটি ভিউ-অনলি মোডে রয়েছে। সেটিংস পরিবর্তনের জন্য হেডার থেকে প্রধান অ্যাডমিন হিসেবে লগইন করুন।'
                    : 'The dashboard is in View-Only mode. Please use Admin Login in the header to manage settings.'}
                </p>
              </div>
            )
          )}
        </main>
      </div>

      {/* Mobile Bottom Bar Navigation */}
      <MobileNav
        currentUser={currentUser}
        language={language}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenLogin={() => setAuthModalState({ isOpen: true, mode: 'login' })}
        onOpenRegister={() => setAuthModalState({ isOpen: true, mode: 'register' })}
        onOpenMemberLogin={() => setAuthModalState({ isOpen: true, mode: 'login' })}
        onOpenAdminLogin={() => setAuthModalState({ isOpen: true, mode: 'login' })}
        onLogout={handleLogout}
      />

      {/* Member Registration & Login Modal */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        onClose={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={handleAuthSuccess}
        language={language}
      />

        {/* Full Notifications Center Modal (Opens on "View All" click) */}
        <NotificationsModal
          isOpen={isNotificationsModalOpen}
          onClose={() => setIsNotificationsModalOpen(false)}
          notifications={notifications}
          currentUser={currentUser}
          language={language}
          onMarkAsRead={handleMarkNotificationRead}
          onMarkAllAsRead={handleMarkAllNotificationsRead}
          onNavigateTab={(tab) => setCurrentTab(tab)}
        />
      </div>
    );
}
