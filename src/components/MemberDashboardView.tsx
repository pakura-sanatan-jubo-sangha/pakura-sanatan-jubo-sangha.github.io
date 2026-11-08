import React, { useState, useMemo } from 'react';
import {
  Member,
  Contribution,
  Receipt,
  UserAccount,
  Language,
  SocietyRule,
  GeneralMeeting,
  MemberWithdrawal,
  PaymentMethod,
  ProfitDistribution,
  WithdrawalSource,
  WithdrawalStatus,
} from '../types';
import { getTranslation } from '../lib/translations';
import { StorageService } from '../lib/storage';
import { MeetingNoticeBanner } from './MeetingNoticeBanner';
import {
  PiggyBank,
  CheckCircle2,
  Clock,
  ReceiptText,
  Calendar,
  History,
  ShieldCheck,
  User,
  Users,
  Check,
  X,
  AlertCircle,
  Key,
  Lock,
  Eye,
  EyeOff,
  Layers,
  ArrowRight,
  Shield,
  Phone,
  Wallet,
  Building2,
  Bell,
  BookOpen,
  Scale,
  WalletCards,
  ArrowUpRight,
  Coins,
  Banknote,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { EnrichedNotification } from '../lib/notifications';

interface MemberDashboardViewProps {
  member: Member | undefined;
  linkedMembers?: Member[];
  contributions: Contribution[];
  receipts: Receipt[];
  currentUser: UserAccount;
  language: Language;
  onViewReceipt: (receiptId: string) => void;
  monthlyAmount: number;
  rules?: SocietyRule[];
  meetings?: GeneralMeeting[];
  withdrawals?: MemberWithdrawal[];
  distributions?: ProfitDistribution[];
  maxWithdrawalPercentage?: number;
  minReserveBalance?: number;
  onNavigate?: (tab: string) => void;
  dueDay?: number;
  lateFeeAmount?: number;
  initialTab?: 'overview' | 'penalties' | 'attendance' | 'security' | 'rules' | 'withdrawals';
  onMarkAttendance?: (memberSystemId: string, memberName: string) => void;
  onExecuteWithdrawal?: (params: {
    memberSystemId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    source?: WithdrawalSource;
    payoutAccount?: string;
    reason?: string;
  }) => void;
  onRequestWithdrawal?: (params: {
    memberSystemId: string;
    amount: number;
    source: WithdrawalSource;
    paymentMethod: PaymentMethod | 'bkash' | 'nagad' | 'rocket';
    payoutAccount?: string;
    reason?: string;
  }) => void;
  onCancelWithdrawal?: (withdrawalId: string) => void;
  onRefreshData?: () => void;
}

export const MemberDashboardView: React.FC<MemberDashboardViewProps> = ({
  member,
  linkedMembers = member ? [member] : [],
  contributions,
  receipts,
  currentUser,
  language,
  onViewReceipt,
  monthlyAmount,
  rules,
  meetings = [],
  withdrawals = [],
  distributions = [],
  maxWithdrawalPercentage = 70,
  minReserveBalance = 500,
  onNavigate,
  dueDay = 10,
  lateFeeAmount = 10,
  initialTab = 'overview',
  onMarkAttendance,
  onExecuteWithdrawal,
  onRequestWithdrawal,
  onCancelWithdrawal,
  onRefreshData,
}) => {
  const t = getTranslation(language);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [activeTab, setActiveTab] = useState<'overview' | 'penalties' | 'attendance' | 'security' | 'rules' | 'withdrawals'>(
    initialTab === ('notifications' as any) ? 'overview' : initialTab
  );

  React.useEffect(() => {
    if (initialTab && initialTab !== ('notifications' as any)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Attendance modal state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceSuccessMessage, setAttendanceSuccessMessage] = useState<string | null>(null);

  // Withdrawal modal state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawSource, setWithdrawSource] = useState<WithdrawalSource>('profit');
  const [withdrawAmount, setWithdrawAmount] = useState<number | string>('');
  const [withdrawAccountId, setWithdrawAccountId] = useState<string>('');
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethod | 'bkash' | 'nagad' | 'rocket'>('cash');
  const [withdrawPayoutAccount, setWithdrawPayoutAccount] = useState<string>('');
  const [withdrawReason, setWithdrawReason] = useState<string>('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const effectiveDueDay = dueDay || 10;
  const effectiveLateFee = lateFeeAmount ?? 10;

  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  const formatMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) return monthStr;
    const date = new Date(y, m - 1, 1);
    if (isNaN(date.getTime())) return monthStr;
    return date.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Determine active linked members
  const actualLinkedMembers = linkedMembers.length > 0 ? linkedMembers : (member ? [member] : []);
  const primaryMember = actualLinkedMembers[0] || member;
  const linkedSystemIds = actualLinkedMembers.map((m) => m.systemId);

  // Filter contributions for this member & linked accounts (accurately reflects actual amount deposited)
  const myContributions = useMemo(() => {
    return contributions.filter(
      (c) => linkedSystemIds.includes(c.memberSystemId) && c && c.month
    );
  }, [contributions, linkedSystemIds]);
  const totalSavingsPaid = myContributions.reduce((sum, c) => sum + (c.amount || 0), 0);

  // Active account selection filtering (sorted newest month first)
  const effectiveContributions = useMemo(() => {
    const list = selectedAccountId === 'all'
      ? myContributions
      : myContributions.filter((c) => c.memberSystemId === selectedAccountId);
    return [...list].sort((a, b) => {
      const monthDiff = (b.month || '').localeCompare(a.month || '');
      if (monthDiff !== 0) return monthDiff;
      return (b.contributionDate || '').localeCompare(a.contributionDate || '');
    });
  }, [myContributions, selectedAccountId]);

  const effectiveTotalSavingsPaid = effectiveContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const effectivePaidMonthsCount = effectiveContributions.length;

  // Month calculations: Generate months starting from the member's earliest recorded month in Firebase
  const memberContribMonths = effectiveContributions
    .map((c) => c.month)
    .filter((m) => m && m.match(/^\d{4}-\d{2}$/))
    .sort();
  const earliestMonth = memberContribMonths.length > 0 ? memberContribMonths[0] : '2025-10';
  const latestMonth = memberContribMonths.length > 0 ? memberContribMonths[memberContribMonths.length - 1] : '2025-10';
  const [eYearStr, eMonthStr] = earliestMonth.split('-');
  const [lYearStr, lMonthStr] = latestMonth.split('-');
  const startYear = parseInt(eYearStr, 10) || 2025;
  const startMonth = parseInt(eMonthStr, 10) || 10;
  const lYear = parseInt(lYearStr, 10) || 2025;
  const lMonth = parseInt(lMonthStr, 10) || 10;

  const curDate = new Date();
  const curY = curDate.getFullYear();
  const curM = curDate.getMonth() + 1;

  // Safeguard against client device clock discrepancies
  const endYear = Math.max(lYear, curY);
  const endMonth = (endYear === lYear && endYear === curY)
    ? Math.max(lMonth, curM)
    : (endYear === lYear ? lMonth : curM);

  const allMonthsList: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const fromM = (y === startYear) ? startMonth : 1;
    const toM = (y === endYear) ? endMonth : 12;
    for (let m = fromM; m <= toM; m++) {
      allMonthsList.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }

  // Outstanding/unpaid months
  const paidMonthsSet = new Set(effectiveContributions.map((c) => c.month));
  const outstandingMonths = allMonthsList.filter((m) => !paidMonthsSet.has(m)).reverse();

  // Calculation of total outstanding dues
  const totalOutstandingDue = outstandingMonths.reduce((sum, monthStr) => {
    const isPastDue =
      monthStr < curDate.toISOString().slice(0, 7) ||
      (monthStr === curDate.toISOString().slice(0, 7) && curDate.getDate() > effectiveDueDay);
    const fee = isPastDue ? effectiveLateFee : 0;
    return sum + (monthlyAmount || 100) + fee;
  }, 0);

  // Member's past withdrawals categorized
  const myWithdrawals = (withdrawals || []).filter((w) =>
    linkedSystemIds.includes(w.memberSystemId)
  );
  const myPendingWithdrawals = myWithdrawals.filter((w) => w.status === 'pending');
  const myCompletedWithdrawals = myWithdrawals.filter((w) => w.status === 'completed');
  const myRejectedWithdrawals = myWithdrawals.filter((w) => w.status === 'rejected');

  // Calculate aggregated financial numbers across all linked accounts
  // Guaranteed zero-loss: balances cross-reference contribution ledger minus completed savings withdrawals
  const aggregatedBalance = actualLinkedMembers.reduce((sum, m) => {
    const memberPaid = myContributions
      .filter((c) => c.memberSystemId === m.systemId && c.status === 'paid')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const memberWithdrawn = myWithdrawals
      .filter((w) => w.memberSystemId === m.systemId && w.status === 'completed' && (w.source === 'savings' || w.source === 'combined' || !w.source))
      .reduce((s, w) => s + (w.amount || 0), 0);
    const ledgerNet = Math.max(0, memberPaid - memberWithdrawn);
    return sum + Math.max(m.currentBalance || 0, ledgerNet);
  }, 0);
  const profitShareBalance = actualLinkedMembers.reduce((sum, m) => sum + (m.profitShareBalance || 0), 0);
  const totalWithdrawn = actualLinkedMembers.reduce((sum, m) => sum + (m.totalWithdrawn || 0), 0);

  // Limited Withdrawable Calculation
  const maxPercent = maxWithdrawalPercentage ?? 70;
  const minReserve = minReserveBalance ?? 500;
  const maxAllowedByPercent = Math.floor((aggregatedBalance * maxPercent) / 100);
  const maxAllowedByReserve = Math.max(0, aggregatedBalance - minReserve);
  const maxWithdrawable = Math.max(0, Math.min(maxAllowedByPercent, maxAllowedByReserve));

  const selectedWithdrawMember =
    actualLinkedMembers.find((m) => m.systemId === (withdrawAccountId || primaryMember?.systemId)) ||
    primaryMember;
  const selectedAccountBalance = selectedWithdrawMember?.currentBalance || 0;
  const selectedProfitBalance = selectedWithdrawMember?.profitShareBalance || 0;
  const selectedMaxAllowedSavings = Math.max(
    0,
    Math.min(
      Math.floor((selectedAccountBalance * maxPercent) / 100),
      Math.max(0, selectedAccountBalance - minReserve)
    )
  );

  // Dynamic maximum withdrawable based on chosen source:
  // 'profit' allows 100% of accumulated loan profit dividends
  // 'savings' allows up to 70% with minReserve
  // 'combined' allows sum of both
  const selectedMaxWithdrawable =
    withdrawSource === 'profit'
      ? selectedProfitBalance
      : withdrawSource === 'savings'
      ? selectedMaxAllowedSavings
      : selectedProfitBalance + selectedMaxAllowedSavings;


  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      setWithdrawError(language === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন।' : 'Please enter a valid amount.');
      return;
    }
    const targetSysId = withdrawAccountId || primaryMember?.systemId;
    if (!targetSysId) {
      setWithdrawError(language === 'bn' ? 'অ্যাকাউন্ট নির্বাচন করুন।' : 'Please select account.');
      return;
    }
    if (amt > selectedMaxWithdrawable) {
      const srcName = withdrawSource === 'profit' ? 'সঞ্চিত মুনাফা' : 'মূল সঞ্চয়';
      setWithdrawError(
        language === 'bn'
          ? `${srcName} থেকে সর্বোচ্চ অনুমোদিত সীমা ৳${selectedMaxWithdrawable.toLocaleString()} টাকা।`
          : `Maximum allowed withdrawal is ৳${selectedMaxWithdrawable.toLocaleString()}.`
      );
      return;
    }

    if (onRequestWithdrawal) {
      onRequestWithdrawal({
        memberSystemId: targetSysId,
        amount: amt,
        source: withdrawSource,
        paymentMethod: withdrawMethod,
        payoutAccount: withdrawPayoutAccount.trim() || undefined,
        reason: withdrawReason.trim() || undefined,
      });
    } else if (onExecuteWithdrawal) {
      onExecuteWithdrawal({
        memberSystemId: targetSysId,
        amount: amt,
        paymentMethod: (withdrawMethod === 'bkash' || withdrawMethod === 'nagad' || withdrawMethod === 'rocket') ? 'cash' : withdrawMethod,
        source: withdrawSource,
        payoutAccount: withdrawPayoutAccount.trim() || undefined,
        reason: withdrawReason.trim() || undefined,
      });
    }

    const srcName = withdrawSource === 'profit' ? 'সঞ্চিত মুনাফা' : withdrawSource === 'savings' ? 'মূল সঞ্চয়' : 'সমন্বিত তহবিল';
    setWithdrawSuccess(
      language === 'bn'
        ? `৳${amt.toLocaleString()} (${srcName}) উত্তোলন আবেদন সফলভাবে জমা হয়েছে! অ্যাডমিন পর্যালোচনা করে অর্থ প্রদান করবেন।`
        : `Withdrawal request of ৳${amt.toLocaleString()} submitted successfully!`
    );
    setWithdrawAmount('');
    setWithdrawReason('');
    setWithdrawPayoutAccount('');
    setTimeout(() => {
      setShowWithdrawalModal(false);
      setWithdrawSuccess(null);
      if (onRefreshData) onRefreshData();
    }, 2500);
  };

  const currentMonthContribution = myContributions.find((c) => c.month === currentMonth);
  const isCurrentMonthPaid = Boolean(currentMonthContribution);

  // Today calculations
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentDay = today.getDate();
  const isPastDueDayCurrentMonth = currentDay > effectiveDueDay;

  // Find today's or next active meeting
  const upcomingMeeting = meetings.find((m) => m.status === 'scheduled') || meetings[0];
  const targetMeetingId = upcomingMeeting?.meetingId;

  // Check if current user is marked present in the active meeting
  const isAlreadyMarkedPresent = Boolean(
    upcomingMeeting?.attendees?.some(
      (a) => linkedSystemIds.includes(a.memberSystemId) && a.status === 'present'
    )
  );

  // Recorded meetings
  const recordedMeetings = meetings.filter((m) => m.attendanceRecorded);
  const attendedMeetings = recordedMeetings.filter((m) =>
    m.attendees?.some(
      (a) => linkedSystemIds.includes(a.memberSystemId) && a.status === 'present'
    )
  );
  const attendanceRate =
    recordedMeetings.length > 0
      ? Math.round((attendedMeetings.length / recordedMeetings.length) * 100)
      : 0;

  // Late fees calculation
  const totalLateFees = myContributions.reduce((sum, c) => sum + (c.lateFee || 0), 0);
  const latePayments = myContributions.filter((c) => (c.lateFee || 0) > 0 || c.isLate === true);
  const latePaymentsCount = latePayments.length;

  // Handle Mark Attendance
  const handleMarkSelfAttendance = () => {
    if (!primaryMember) return;
    const res = StorageService.markMemberSelfAttendance(
      primaryMember.systemId,
      primaryMember.name,
      primaryMember.phone,
      targetMeetingId
    );
    if (res.success) {
      setAttendanceSuccessMessage(res.message);
      if (onMarkAttendance) {
        onMarkAttendance(primaryMember.systemId, primaryMember.name);
      }
      if (onRefreshData) {
        onRefreshData();
      }
      setTimeout(() => {
        setShowAttendanceModal(false);
        setAttendanceSuccessMessage(null);
      }, 2000);
    }
  };

  // Handle Password Change
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!newPassword || newPassword.length < 4) {
      setPasswordStatus({
        type: 'error',
        text: language === 'bn' ? 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' : 'Password must be at least 4 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: 'error',
        text: language === 'bn' ? 'নতুন পাসওয়ার্ড দুটি মিলছে না।' : 'New passwords do not match.',
      });
      return;
    }

    setIsChangingPassword(true);
    const res = StorageService.changeUserPassword(currentUser.userId, newPassword, currentPassword);
    setIsChangingPassword(false);

    if (res.success) {
      setPasswordStatus({ type: 'success', text: res.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordStatus({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* 1. Welcome & Aggregated Balance Banner */}
      <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold">
              <User className="w-4 h-4" />
              <span>{language === 'bn' ? 'সদস্য ড্যাশবোর্ড' : 'Member Dashboard'}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {language === 'bn' ? `নমস্কার, ${currentUser.name || primaryMember?.name || 'সম্মানিত সদস্য'}` : `Welcome, ${currentUser.name || primaryMember?.name}`}
            </h2>

            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-xl leading-relaxed">
              {language === 'bn'
                ? 'পাকুড়া সনাতন যুব সংঘের সাধারণ সদস্য পোর্টালে আপনার মোট স্থিতি, সভার হাজিরা ও নিরাপত্তা বিবরণী।'
                : 'Your total aggregated balance, meeting attendance, and security portal.'}
            </p>
          </div>

          {/* Aggregated Total Balance & Attendance Quick Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-auto">
            {/* Total Balance Card */}
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 text-left min-w-[170px] shadow-xs">
              <span className="text-[11px] text-emerald-100 uppercase tracking-wider font-semibold block">
                {language === 'bn' ? 'মোট বর্তমান ব্যালেন্স' : 'Total Balance'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                ৳{aggregatedBalance.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-100/80 mt-0.5 block">
                {language === 'bn' ? 'সঞ্চয় মূলধন স্থিতি' : 'Personal savings capital'}
              </span>
            </div>

            {/* Attendance Button (Prominent Action) */}
            <button
              type="button"
              onClick={() => setShowAttendanceModal(true)}
              className={`px-4 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md transform hover:scale-105 active:scale-95 ${
                isAlreadyMarkedPresent
                  ? 'bg-emerald-400/30 text-white border border-emerald-300/40 hover:bg-emerald-400/40'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 shadow-emerald-950/20'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${isAlreadyMarkedPresent ? 'text-emerald-200' : 'text-emerald-600'}`} />
              <div className="text-left">
                <span className="block text-[10px] uppercase tracking-wide opacity-80 leading-none">
                  {language === 'bn' ? 'সভার হাজিরা' : 'Meeting'}
                </span>
                <span className="block text-xs font-bold leading-tight mt-0.5">
                  {isAlreadyMarkedPresent
                    ? (language === 'bn' ? 'হাজিরা সম্পন্ন ✓' : 'Marked Present ✓')
                    : (language === 'bn' ? 'উপস্থিতি নিশ্চিত করুন' : 'Mark Attendance')}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Notice Banner (Rules & Meeting decisions) */}
      <MeetingNoticeBanner
        language={language}
        rules={rules}
        onNavigate={onNavigate}
      />

      {/* 3. Four Core Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Aggregated Balance */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {language === 'bn' ? 'মোট ব্যালেন্স' : 'Total Balance'}
            </span>
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            ৳{aggregatedBalance.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {`${myContributions.length} ${language === 'bn' ? 'টি কিস্তি জমা' : 'installments paid'}`}
          </span>
        </div>

        {/* Card 2: Attendance Rate & Quick Status */}
        <button
          type="button"
          onClick={() => setShowAttendanceModal(true)}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-400 text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
              {language === 'bn' ? 'হাজিরা বাটন' : 'Attendance'}
            </span>
            <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300">
            {isAlreadyMarkedPresent
              ? (language === 'bn' ? 'উপস্থিত ✓' : 'Present ✓')
              : (language === 'bn' ? 'উপস্থিতি দিন' : 'Mark Now')}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {language === 'bn' ? `হাজিরা হার: ${attendanceRate}% (${attendedMeetings.length}/${recordedMeetings.length})` : `Rate: ${attendanceRate}%`}
          </span>
        </button>

        {/* Card 3: Late Fees & Penalties */}
        <button
          type="button"
          onClick={() => setActiveTab('penalties')}
          className={`p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer shadow-xs ${
            activeTab === 'penalties'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'বিলম্ব ফি ও জরিমানা' : 'Penalties'}</span>
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">→</span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-400">
            ৳{totalLateFees.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
            {latePaymentsCount > 0
              ? (language === 'bn' ? `${latePaymentsCount} বার নির্ধারিত তারিখের পর` : `${latePaymentsCount} deposits late`)
              : (language === 'bn' ? 'কোনো জরিমানা নেই ✓' : 'Zero penalties ✓')}
          </span>
        </button>

        {/* Card 4: Security & Password */}
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer shadow-xs ${
            activeTab === 'security'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-400/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'অ্যাকাউন্ট নিরাপত্তা' : 'Security'}</span>
            </span>
            <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
            {currentUser.username || primaryMember?.phone || 'সুরক্ষিত'}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন →' : 'Change password →'}
          </span>
        </button>
      </div>

      {/* 4. Tab Navigation Bar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'আমার প্রোফাইল ও খতিয়ান' : 'My Profile & Ledger'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('penalties')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'penalties'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'বিলম্ব ফি ও জরিমানা বিবরণী' : 'Late Fees & Penalties'}</span>
            {totalLateFees > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold">
                ৳{totalLateFees}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'সভার হাজিরা খতিয়ান' : 'Attendance Log'}</span>
            <span className="ml-1 text-[10px] opacity-80">({recordedMeetings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'নিরাপত্তা ও পাসওয়ার্ড' : 'Security & Password'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'সংবিধিবদ্ধ নিয়মাবলী' : 'Rules & Regulations'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('withdrawals')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'withdrawals'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <WalletCards className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'তহবিল ও উত্তোলন' : 'Funds & Withdrawal'}</span>
            {myWithdrawals.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'withdrawals' ? 'bg-white text-blue-800' : 'bg-blue-600 text-white'
              }`}>
                {myWithdrawals.length}
              </span>
            )}
          </button>

          {/* Quick link to Receipts & Passbook */}
          <div className="ml-auto flex items-center gap-2">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('receipts')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1 cursor-pointer transition-colors"
                title={language === 'bn' ? 'আমার জমা রশিদ ও ভাউচার খতিয়ান দেখুন' : 'View My Payment Receipts & Vouchers'}
              >
                <ReceiptText className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'আমার জমা রশিদ →' : 'My Receipts →'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Content 1: Overview & Linked Accounts Breakdown */}
        {activeTab === 'overview' && (
          <div className="p-5 space-y-5">
            {/* 1. Select Account (অ্যাকাউন্ট নির্বাচন) */}
            <div className="rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              {/* Account Selector Header & Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      {language === 'bn' ? 'সদস্য একাউন্ট' : 'Member Account'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {primaryMember?.name || currentUser.name} • {primaryMember?.phone || currentUser.phone || primaryMember?.systemId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Four Metric Cards (Under Select Account) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Total Savings Paid / Credited to Fund */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
                      {language === 'bn' ? 'মোট পরিশোধিত সঞ্চয়' : 'Total Savings Paid'}
                    </span>
                    <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    ৳{effectiveTotalSavingsPaid.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    {language === 'bn' ? 'Credited to Fund (তহবিলে জমা)' : 'Credited to Fund'}
                  </span>
                </div>

                {/* 2. Paid Months Count / Fully Credited */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
                      {language === 'bn' ? 'পরিশোধিত মাসের সংখ্যা' : 'Paid Months Count'}
                    </span>
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {effectivePaidMonthsCount} {language === 'bn' ? 'মাস' : 'months'}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      {effectivePaidMonthsCount} {language === 'bn' ? 'মাস ✓ সম্পূর্ণ পরিশোধিত' : 'months ✓ Fully credited'}
                    </span>
                  </span>
                </div>

                {/* 3. Total Outstanding Dues / Zero Dues */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
                      {language === 'bn' ? 'সর্বমোট বকেয়া কিস্তি' : 'Total Outstanding Dues'}
                    </span>
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-black mt-1 ${
                      totalOutstandingDue > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {totalOutstandingDue > 0
                      ? `৳${totalOutstandingDue.toLocaleString()}`
                      : language === 'bn'
                      ? 'কোনো বকেয়া নেই ✓'
                      : 'Zero dues ✓'}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    {totalOutstandingDue > 0
                      ? language === 'bn'
                        ? 'অনতিবিলম্বে পরিশোধযোগ্য'
                        : 'Due for payment'
                      : language === 'bn'
                      ? 'কোনো বকেয়া নেই (Zero dues ✓)'
                      : 'Zero dues ✓'}
                  </span>
                </div>

                {/* 4. Outstanding Months */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
                      {language === 'bn' ? 'বকেয়া মাসসমূহ' : 'Outstanding Months'}
                    </span>
                    <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-black mt-1 ${
                      outstandingMonths.length > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {outstandingMonths.length > 0
                      ? `${outstandingMonths.length} ${language === 'bn' ? 'মাস' : 'months'}`
                      : language === 'bn'
                      ? 'সকল কিস্তি পরিশোধিত ✓'
                      : 'All cleared ✓'}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block truncate">
                    {outstandingMonths.length > 0
                      ? language === 'bn'
                        ? `${outstandingMonths.length}টি মাসের কিস্তি বাকি`
                        : `${outstandingMonths.length} months due`
                      : language === 'bn'
                      ? 'কোনো বকেয়া মাস নেই ✓'
                      : 'All cleared ✓'}
                  </span>
                </div>
              </div>
            </div>

            {/* Standard Member Account Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-100 dark:border-emerald-800">
                  {primaryMember?.name ? primaryMember.name.charAt(0) : <User className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">
                      {primaryMember?.name || currentUser.name}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {language === 'bn' ? 'সদস্য আইডি:' : 'ID:'} {primaryMember?.systemId || currentUser.userId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'bn' ? 'মোবাইল নম্বর:' : 'Phone:'}{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {primaryMember?.phone || currentUser.phone}
                    </span>
                    {' • '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ {language === 'bn' ? 'সক্রিয় সদস্য' : 'Active Member'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:border-l sm:border-slate-100 dark:sm:border-slate-800 sm:pl-5">
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    {language === 'bn' ? 'মোট পরিশোধিত সঞ্চয়' : 'Total Savings Paid'}
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    ৳{(primaryMember?.currentBalance || 0).toLocaleString()}
                  </span>
                </div>
                <div className="pl-3 border-l border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 block">
                    {language === 'bn' ? 'পরিশোধিত কিস্তি' : 'Paid Installments'}
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {myContributions.length} {language === 'bn' ? 'টি মাস' : 'months'}
                  </span>
                </div>
              </div>
            </div>

            {/* Complete Payment History (মাসিক সঞ্চয় পরিশোধের পূর্ণাঙ্গ খতিয়ান) */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <ReceiptText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      {language === 'bn' ? 'মাসিক সঞ্চয় পরিশোধের পূর্ণাঙ্গ খতিয়ান' : 'Complete Payment History'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'bn'
                        ? `${primaryMember?.name || 'সদস্য'}-র সর্বমোট ${effectiveContributions.length}টি জমার খতিয়ান ও রসিদ`
                        : `All ${effectiveContributions.length} contribution records and receipts for ${primaryMember?.name || 'Member'}`}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 self-start sm:self-auto">
                  {effectiveContributions.length} {language === 'bn' ? 'টি কিস্তি জমা' : 'Records'}
                </span>
              </div>

              {effectiveContributions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                  <PiggyBank className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <span>{language === 'bn' ? 'কোনো সঞ্চয় জমার রেকর্ড পাওয়া যায়নি।' : 'No payment records found.'}</span>
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                        <th className="p-3">#</th>
                        <th className="p-3">{language === 'bn' ? 'মাস' : 'Month'}</th>
                        <th className="p-3">{language === 'bn' ? 'জমার পরিমাণ' : 'Amount'}</th>
                        {actualLinkedMembers.length > 1 && selectedAccountId === 'all' && (
                          <th className="p-3">{language === 'bn' ? 'অ্যাকাউন্ট' : 'Account'}</th>
                        )}
                        <th className="p-3">{language === 'bn' ? 'ধরন' : 'Type'}</th>
                        <th className="p-3">{language === 'bn' ? 'জমার তারিখ' : 'Date'}</th>
                        <th className="p-3 text-center">{language === 'bn' ? 'মাধ্যম' : 'Method'}</th>
                        <th className="p-3 text-center">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
                        <th className="p-3 text-right">{language === 'bn' ? 'রশিদ ও ভাউচার' : 'Receipt'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {effectiveContributions.map((c, idx) => {
                        const accOwner = actualLinkedMembers.find((m) => m.systemId === c.memberSystemId);
                        return (
                          <tr
                            key={c.contributionId || idx}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatMonthName(c.month) || c.month}
                            </td>
                            <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              ৳{(c.amount || 0).toLocaleString()}
                              {c.lateFee && c.lateFee > 0 && (
                                <span className="block text-[10px] text-amber-600 font-normal">
                                  +{language === 'bn' ? 'বিলম্ব ফি' : 'Late fee'} ৳{c.lateFee}
                                </span>
                              )}
                            </td>
                            {actualLinkedMembers.length > 1 && selectedAccountId === 'all' && (
                              <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                                {accOwner?.name || c.memberName}
                              </td>
                            )}
                            <td className="p-3 text-slate-600 dark:text-slate-300">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {c.contributionType === 'seasonal_booster'
                                  ? language === 'bn'
                                    ? 'বুস্টার জমা'
                                    : 'Booster'
                                  : c.month.toLowerCase().includes('open')
                                  ? language === 'bn'
                                    ? 'প্রারম্ভিক সঞ্চয়'
                                    : 'Opening Deposit'
                                  : language === 'bn'
                                  ? 'নিয়মিত মাসিক চাঁদা'
                                  : 'Regular Contribution'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                              {c.contributionDate || (c.createdAt ? c.createdAt.split('T')[0] : '')}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                                {c.paymentMethod === 'bank'
                                  ? language === 'bn'
                                    ? 'ব্যাংক'
                                    : 'Bank'
                                  : language === 'bn'
                                  ? 'ক্যাশ'
                                  : 'Cash'}
                              </span>
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{language === 'bn' ? 'পরিশোধিত' : 'Paid'}</span>
                              </span>
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {c.receiptId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onViewReceipt) {
                                      onViewReceipt(c.receiptId);
                                    } else if (onNavigate) {
                                      onNavigate('receipts');
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <ReceiptText className="w-3 h-3" />
                                  <span>{language === 'bn' ? 'রশিদ' : 'Receipt'}</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Penalties & Late Fees incurred after due date */}
        {activeTab === 'penalties' && (
          <div className="p-5 space-y-4">

            {latePayments.length === 0 ? (
              <div className="py-10 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm font-bold">
                  {language === 'bn' ? 'অভিনন্দন! আপনার কোনো জরিমানা বা বিলম্ব ফি নেই।' : 'No penalties incurred!'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'bn' ? 'আপনি সকল কিস্তি নির্ধারিত ১০ তারিখের পূর্বে নিয়মিত পরিশোধ করেছেন।' : 'All deposits made on time.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {latePayments.map((c, i) => (
                  <div key={i} className="py-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{c.month}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold">
                          +{language === 'bn' ? `৳${c.lateFee} জরিমানা` : `৳${c.lateFee} penalty`}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        {language === 'bn' ? `জমার তারিখ: ${c.contributionDate}` : `Paid date: ${c.contributionDate}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-rose-600">৳{c.lateFee}</span>
                      {c.receiptId && (
                        <button
                          type="button"
                          onClick={() => onViewReceipt(c.receiptId)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                        >
                          {language === 'bn' ? 'রশিদ' : 'Receipt'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content 3: Meeting Attendance Records */}
        {activeTab === 'attendance' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সাধারণ সভার উপস্থিতি তালিকা' : 'Meeting Attendance List'}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'bn' ? 'মাসিক সাধারণ সভায় উপস্থিতির রেকর্ড' : 'Your attendance at official meetings'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAttendanceModal(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'আজকের উপস্থিতি দিন' : 'Mark Today\'s Attendance'}</span>
              </button>
            </div>

            {recordedMeetings.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                {language === 'bn' ? 'এখনও কোনো সাধারণ সভার হাজিরা সম্পন্ন হয়নি।' : 'No recorded meetings yet.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recordedMeetings.map((m) => {
                  const attendee = m.attendees?.find((a) => linkedSystemIds.includes(a.memberSystemId));
                  const isPresent = attendee?.status === 'present';

                  return (
                    <div key={m.meetingId} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {m.title}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-2">
                          <span>{m.meetingDate}</span>
                          <span>•</span>
                          <span>{m.scheduledTime}</span>
                          <span>•</span>
                          <span>{m.location}</span>
                        </div>
                      </div>

                      <div>
                        {isPresent ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>{language === 'bn' ? 'উপস্থিত' : 'Present'}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1">
                            <X className="w-3 h-3" />
                            <span>{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content 4: Security & Password Settings */}
        {activeTab === 'security' && (
          <div className="p-5 space-y-6">
            {/* Account Details View */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{language === 'bn' ? 'অ্যাকাউন্টের মূল বিবরণী' : 'Account Details'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    {language === 'bn' ? 'সদস্যের নাম:' : 'Full Name:'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {currentUser.name || primaryMember?.name}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">
                    {language === 'bn' ? 'নিবন্ধিত মোবাইল নম্বর:' : 'Phone Number:'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {currentUser.username || primaryMember?.phone}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">
                    {language === 'bn' ? 'সদস্য সিস্টেম আইডি:' : 'Member System ID:'}
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {linkedSystemIds.join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Change Security Password Form */}
            <div className="max-w-md">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{language === 'bn' ? 'নিরাপত্তা পাসওয়ার্ড পরিবর্তন' : 'Change Security Password'}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'bn'
                    ? 'আপনার অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করতে নিয়মিত নতুন পাসওয়ার্ড সেট করুন।'
                    : 'Update your security password for account safety.'}
                </p>
              </div>

              {passwordStatus && (
                <div
                  className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 ${
                    passwordStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  {passwordStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{passwordStatus.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {language === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={language === 'bn' ? 'বর্তমান পাসওয়ার্ড দিন' : 'Enter current password'}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {language === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={language === 'bn' ? 'কমপক্ষে ৪ অক্ষরের নতুন পাসওয়ার্ড' : 'At least 4 characters'}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {language === 'bn' ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={language === 'bn' ? 'পুনরায় নতুন পাসওয়ার্ড লিখুন' : 'Re-enter new password'}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isChangingPassword
                    ? (language === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...')
                    : (language === 'bn' ? 'নিরাপত্তা পাসওয়ার্ড সংরক্ষণ করুন' : 'Save New Password')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 5: Full Rules & Regulations (Privacy-Protected: No Gmail/Email Addresses) */}
        {activeTab === 'rules' && (
          <div className="p-5 sm:p-6 space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-600" />
                  <span>{language === 'bn' ? 'সমিতির সংবিধিবদ্ধ কার্যপ্রণালী ও সভার সিদ্ধান্ত' : 'Society Rules & Meeting Decisions'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'bn'
                    ? 'সাধারণ সভায় গৃহীত সকল গঠনতান্ত্রিক সিদ্ধান্ত ও নিয়মনীতি।'
                    : 'Official bylaws, monthly savings policies, and resolutions passed in general meetings.'}
                </p>
              </div>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin_rules')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'রেজোলিউশন বই দেখুন →' : 'View Rule Book →'}</span>
                </button>
              )}
            </div>

            {(() => {
              const displayRules = (rules && rules.length > 0 ? rules : StorageService.getRules()).filter(
                (r) => r.status !== 'archived'
              );

              const sanitizeText = (text: string | undefined): string => {
                if (!text) return '';
                return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, () =>
                  language === 'bn' ? 'সমিতি প্রশাসন' : 'Society Administration'
                );
              };

              if (displayRules.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <span>{language === 'bn' ? 'কোনো নিয়মাবলি পাওয়া যায়নি।' : 'No rules recorded yet.'}</span>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-3.5">
                  {displayRules.map((rule, idx) => (
                    <div
                      key={rule.ruleId}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5 hover:border-amber-300 dark:hover:border-amber-800 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {sanitizeText(rule.title)}
                          </h4>
                          {rule.resolutionNumber && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {sanitizeText(rule.resolutionNumber)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-600" />
                            <span>{rule.meetingDate}</span>
                          </span>
                          <span>•</span>
                          <span>{language === 'bn' ? 'লিপিবদ্ধকারী: সমিতি প্রশাসন' : 'Recorded By: Society Admin'}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {sanitizeText(rule.decisionDetails)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 6: Member Limited Funds Withdrawal & Dividends */}
        {activeTab === 'withdrawals' && (
          <div className="p-5 space-y-5 animate-in fade-in">
            {/* Fund Breakdown Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold">
                    <Coins className="w-4 h-4 text-amber-300" />
                    <span>{language === 'bn' ? 'ব্যক্তিগত তহবিল স্থিতি ও অনুমোদিত উত্তোলন' : 'Personal Funds & Limited Withdrawal'}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mt-1 tracking-tight">
                    {language === 'bn' ? 'তহবিল উত্তোলন ও ঋণ লভ্যাংশ সেবা' : 'Fund Withdrawal & Loan Dividends'}
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-2xl leading-relaxed">
                    {language === 'bn'
                      ? `সমিতির নীতিমালা অনুযায়ী আপনি আপনার মোট কার্যকর তহবিলের সর্বোচ্চ ${maxPercent}% পর্যন্ত উত্তোলন করতে পারবেন (অথবা সর্বনিম্ন ৳${minReserve} রিজার্ভ রেখে অবশিষ্ট অংশ)।`
                      : `Under society policy, general members can withdraw up to ${maxPercent}% of net funds while retaining at least ৳${minReserve} in membership reserve.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setWithdrawAccountId(primaryMember?.systemId || '');
                    setWithdrawAmount('');
                    setWithdrawError(null);
                    setShowWithdrawalModal(true);
                  }}
                  disabled={maxWithdrawable <= 0}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer ${
                    maxWithdrawable > 0
                      ? 'bg-white text-blue-800 hover:bg-blue-50 cursor-pointer'
                      : 'bg-white/40 text-blue-100 cursor-not-allowed'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-blue-600" />
                  <span>{language === 'bn' ? 'তহবিল উত্তোলন করুন' : 'Withdraw Funds'}</span>
                </button>
              </div>
            </div>

            {/* 4 Financial Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                  {language === 'bn' ? 'মোট সঞ্চয় কিস্তি জমা' : 'Savings Paid'}
                </span>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ৳{totalSavingsPaid.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {myContributions.length} {language === 'bn' ? 'টি কিস্তি জমা' : 'deposits'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                  {language === 'bn' ? 'ঋণ মুনাফা লভ্যাংশ তহবিল' : 'Loan Profit Dividend'}
                </span>
                <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  ৳{profitShareBalance.toLocaleString()}
                </div>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 block font-semibold">
                  + {language === 'bn' ? 'অর্জিত মুনাফা যোগ' : 'Allocated dividends'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                  {language === 'bn' ? 'পূর্বে উত্তোলিত অর্থ' : 'Previously Withdrawn'}
                </span>
                <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  ৳{totalWithdrawn.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {myWithdrawals.length} {language === 'bn' ? 'বার উত্তোলন' : 'withdrawals'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs bg-slate-50/50">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                  {language === 'bn' ? 'বর্তমান কার্যকর স্থিতি' : 'Net Total Balance'}
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                  ৳{aggregatedBalance.toLocaleString()}
                </div>
                <span className="text-[10px] text-emerald-600 mt-0.5 block font-bold">
                  ✓ {language === 'bn' ? 'কার্যকর তহবিল' : 'Net Available'}
                </span>
              </div>
            </div>

            {/* 1. Dual Fund Cards: Profit Dividend vs Monthly Savings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fund A: Accumulated Profit Dividend (সঞ্চিত মুনাফা) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 via-white to-purple-50/50 dark:from-purple-950/40 dark:via-slate-900 dark:to-purple-950/20 border-2 border-purple-200 dark:border-purple-800/80 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700 flex items-center gap-1 uppercase">
                      <Coins className="w-3 h-3 text-purple-600" />
                      <span>{language === 'bn' ? 'সঞ্চিত ঋণ মুনাফা' : 'Loan Profit Dividend'}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {language === 'bn' ? '১০০% উত্তোলনযোগ্য ✓' : '100% Withdrawable'}
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold block">
                      {language === 'bn' ? 'আমার সঞ্চিত মুনাফা লভ্যাংশ স্থিতি:' : 'My Profit Dividend Balance:'}
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-300 mt-0.5">
                      ৳{profitShareBalance.toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {language === 'bn'
                        ? 'বাইরে প্রদত্ত ঋণের ১০% মুনাফা থেকে সাধারণ সদস্যদের অর্জিত লভ্যাংশ। পুরো টাকাই যেকোনো সময় উত্তোলন করতে পারেন।'
                        : 'Your allocated share from 10% loan profits. 100% can be withdrawn at any time.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-purple-100 dark:border-purple-900/60 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    {profitShareBalance > 0
                      ? (language === 'bn' ? 'উত্তোলনের আবেদন উন্মুক্ত' : 'Ready to withdraw')
                      : (language === 'bn' ? 'কোনো লভ্যাংশ অবশিষ্ট নেই' : 'No balance')}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawAccountId(primaryMember?.systemId || '');
                      setWithdrawSource('profit');
                      setWithdrawAmount('');
                      setWithdrawError(null);
                      setShowWithdrawalModal(true);
                    }}
                    disabled={profitShareBalance <= 0}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                      profitShareBalance > 0
                        ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-purple-600/20'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'মুনাফা উত্তোলন আবেদন' : 'Withdraw Profit'}</span>
                  </button>
                </div>
              </div>

              {/* Fund B: Monthly Savings Fund (মূল সঞ্চয় তহবিল) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-blue-950/40 dark:via-slate-900 dark:to-blue-950/20 border-2 border-blue-200 dark:border-blue-800/80 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 flex items-center gap-1 uppercase">
                      <PiggyBank className="w-3 h-3 text-blue-600" />
                      <span>{language === 'bn' ? 'মূল মাসিক সঞ্চয়' : 'Monthly Savings Capital'}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {maxPercent}% {language === 'bn' ? 'লিমিট' : 'Limit'}
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold block">
                      {language === 'bn' ? 'উত্তোলনযোগ্য সঞ্চয় লিমিট:' : 'Withdrawable Savings Limit:'}
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                      ৳{maxWithdrawable.toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {language === 'bn'
                        ? `মোট ব্যালেন্স ৳${aggregatedBalance.toLocaleString()} এর সর্বোচ্চ ${maxPercent}% এবং সদস্যপদ সক্রিয় রাখতে ন্যূনতম ৳${minReserve} রিজার্ভ তহবিল সংরক্ষিত থাকে।`
                        : `Up to ${maxPercent}% of net savings. Minimum ৳${minReserve} reserve retained.`}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-100 dark:border-blue-900/60 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                    {maxWithdrawable > 0
                      ? (language === 'bn' ? 'সীমিত উত্তোলন অনুমোদনযোগ্য' : 'Allowable under policy')
                      : (language === 'bn' ? 'রিজার্ভ সীমার নিচে' : 'Below reserve')}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawAccountId(primaryMember?.systemId || '');
                      setWithdrawSource('savings');
                      setWithdrawAmount('');
                      setWithdrawError(null);
                      setShowWithdrawalModal(true);
                    }}
                    disabled={maxWithdrawable <= 0}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                      maxWithdrawable > 0
                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-600/20'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <WalletCards className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'সঞ্চয় উত্তোলন আবেদন' : 'Withdraw Savings'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. My Pending Withdrawal Requests Section */}
            {myPendingWithdrawals.length > 0 && (
              <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin" />
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {language === 'bn' ? 'আমার চলমান উত্তোলন আবেদনসমূহ (পর্যালোচনাধীন)' : 'My Pending Withdrawal Requests'}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                    {myPendingWithdrawals.length} {language === 'bn' ? 'টি আবেদন প্রক্রিয়াধীন' : 'Pending'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {myPendingWithdrawals.map((w) => {
                    const isProfit = w.source === 'profit';
                    return (
                      <div
                        key={w.withdrawalId}
                        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-2xs flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isProfit
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {isProfit ? '💎 সঞ্চিত মুনাফা' : '🏦 মূল সঞ্চয়'}
                          </span>
                          <span className="font-black text-rose-600 dark:text-rose-400 text-base">
                            ৳{w.amount.toLocaleString()}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                          <div className="flex justify-between">
                            <span>{language === 'bn' ? 'পরিশোধ মাধ্যম:' : 'Payout Method:'}</span>
                            <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{w.paymentMethod}</span>
                          </div>
                          {w.payoutAccount && (
                            <div className="flex justify-between">
                              <span>{language === 'bn' ? 'প্রাপক অ্যাকাউন্ট:' : 'Target A/C:'}</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">{w.payoutAccount}</span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 pt-1">
                            📅 {language === 'bn' ? 'আবেদনের তারিখ:' : 'Requested:'} {w.date}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{language === 'bn' ? 'অ্যাডমিন পর্যালোচনায় রয়েছে' : 'Awaiting admin review'}</span>
                          </span>

                          {onCancelWithdrawal && (
                            <button
                              type="button"
                              onClick={() => onCancelWithdrawal(w.withdrawalId)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 border border-rose-200 dark:border-rose-900 cursor-pointer"
                            >
                              {language === 'bn' ? 'আবেদন প্রত্যাহার' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Completed Withdrawal Records Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {language === 'bn' ? 'পরিশোধিত তহবিল উত্তোলনের ইতিহাস' : 'My Completed Withdrawals'}
                  </h4>
                </div>
                <span className="text-xs text-slate-400">
                  {myCompletedWithdrawals.length} {language === 'bn' ? 'টি উত্তোলন সম্পন্ন' : 'completed'}
                </span>
              </div>

              {myCompletedWithdrawals.length === 0 ? (
                <div className="py-10 text-center p-6 text-slate-400">
                  <WalletCards className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {language === 'bn' ? 'আপনি এখনো কোনো তহবিল উত্তোলন করেননি' : 'No withdrawals made yet'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === 'bn'
                      ? 'জরুরি প্রয়োজনে যেকোনো সময় সঞ্চিত মুনাফা বা অনুমোদিত সঞ্চয় তহবিল থেকে আবেদন করতে পারেন।'
                      : 'You can request withdrawals from accumulated profit or savings whenever needed.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-semibold">
                        <th className="p-3.5">{language === 'bn' ? 'উত্তোলন আইডি' : 'ID'}</th>
                        <th className="p-3.5">{language === 'bn' ? 'তারিখ' : 'Date'}</th>
                        <th className="p-3.5">{language === 'bn' ? 'উৎস' : 'Source'}</th>
                        <th className="p-3.5 text-right">{language === 'bn' ? 'উত্তোলিত অর্থ' : 'Amount'}</th>
                        <th className="p-3.5 text-center">{language === 'bn' ? 'মাধ্যম' : 'Method'}</th>
                        <th className="p-3.5">{language === 'bn' ? 'বিবরণ' : 'Purpose'}</th>
                        <th className="p-3.5 text-center">{language === 'bn' ? 'রশিদ ভাউচার' : 'Voucher'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {myCompletedWithdrawals.map((w) => (
                        <tr key={w.withdrawalId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3.5 font-mono text-slate-500">#{w.withdrawalId}</td>
                          <td className="p-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{w.date}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              w.source === 'profit'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {w.source === 'profit' ? '💎 সঞ্চিত মুনাফা' : '🏦 মূল সঞ্চয়'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-black text-rose-600 dark:text-rose-400">
                            ৳{w.amount.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                              {w.paymentMethod}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                            {w.reason || (language === 'bn' ? 'অনুমোদিত উত্তোলন' : 'Personal withdrawal')}
                          </td>
                          <td className="p-3.5 text-center">
                            {w.receiptId && (
                              <button
                                type="button"
                                onClick={() => onViewReceipt(w.receiptId!)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <ReceiptText className="w-3 h-3 text-amber-600" />
                                <span>{language === 'bn' ? 'রশিদ দেখুন' : 'View'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Member's Personal Profit Dividend Allocation Log */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {language === 'bn' ? 'আমার ঋণ মুনাফা লভ্যাংশ প্রাপ্তির খতিয়ান' : 'My Loan Profit Dividend Allocations'}
                  </h4>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {language === 'bn' ? `মোট অর্জিত লভ্যাংশ: ৳${profitShareBalance.toLocaleString()}` : `Total Dividend: ৳${profitShareBalance.toLocaleString()}`}
                </span>
              </div>

              {distributions.length === 0 ? (
                <div className="py-8 text-center p-6 text-slate-400">
                  <Coins className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {language === 'bn' ? 'এখনও কোনো ঋণ মুনাফা বন্টন ঘোষণা করা হয়নি' : 'No profit distributions announced yet'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    {language === 'bn'
                      ? 'সমিতি কর্তৃক বাইরে দেওয়া ঋণের ১০% মুনাফা থেকে সাধারণ সদস্যদের অ্যাকাউন্টে যখনই তহবিল বন্টন করা হবে, আপনার প্রাপ্য অংশ স্বয়ংক্রিয়ভাবে এখানে তালিকাভুক্ত হবে।'
                      : 'When loan profit distributions are declared by the administration, your personal share will be recorded here.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-semibold">
                        <th className="p-3.5">{language === 'bn' ? 'বন্টন আইডি' : 'ID'}</th>
                        <th className="p-3.5">{language === 'bn' ? 'তারিখ' : 'Date'}</th>
                        <th className="p-3.5">{language === 'bn' ? 'মেয়াদ / বিবরণ' : 'Period / Label'}</th>
                        <th className="p-3.5 text-center">{language === 'bn' ? 'বন্টন পদ্ধতি' : 'Method'}</th>
                        <th className="p-3.5 text-right">{language === 'bn' ? 'আমার অ্যাকাউন্টে প্রাপ্ত অর্থ' : 'My Share Credited'}</th>
                        <th className="p-3.5 text-center">{language === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {distributions.map((d) => {
                        const myShare = (d.amountPerMember || 0) * (actualLinkedMembers.length || 1);
                        return (
                          <tr key={d.distributionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3.5 font-mono text-slate-500">#{d.distributionId}</td>
                            <td className="p-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{d.date}</td>
                            <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">{d.periodLabel}</td>
                            <td className="p-3.5 text-center text-slate-500">
                              {d.distributionMethod === 'proportional'
                                ? (language === 'bn' ? 'সঞ্চয় অনুপাতে' : 'Proportional')
                                : (language === 'bn' ? 'সমান হারে' : 'Equal')}
                            </td>
                            <td className="p-3.5 text-right font-black text-purple-600 dark:text-purple-400">
                              +৳{myShare.toLocaleString()}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {language === 'bn' ? 'যুক্ত হয়েছে ✓' : 'Credited ✓'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সাধারণ সভায় উপস্থিতি প্রদান' : 'Mark Meeting Attendance'}
                </h3>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {attendanceSuccessMessage ? (
              <div className="py-8 text-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm font-bold">{attendanceSuccessMessage}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'bn' ? 'ধন্যবাদ! আপনার উপস্থিতি ডিজিটাল রেজিস্ট্রারে সংরক্ষিত হয়েছে।' : 'Attendance registered.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-xs">
                  <span className="font-bold text-purple-900 dark:text-purple-200 block text-sm">
                    {upcomingMeeting?.title || (language === 'bn' ? 'মাসিক সাধারণ সভা' : 'General Meeting')}
                  </span>
                  <div className="text-slate-600 dark:text-slate-400 mt-1.5 space-y-1">
                    <div>📅 {language === 'bn' ? 'তারিখ:' : 'Date:'} {upcomingMeeting?.meetingDate || todayStr}</div>
                    <div>⏰ {language === 'bn' ? 'সময়:' : 'Time:'} {upcomingMeeting?.scheduledTime || '০৮:০০ PM'}</div>
                    <div>📍 {language === 'bn' ? 'স্থান:' : 'Location:'} {upcomingMeeting?.location || 'পাকুড়া সমিতির কার্যালয়'}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold block mb-0.5">{language === 'bn' ? 'হাজিরা নিশ্চিতকরণ:' : 'Confirm Identity:'}</span>
                  <div>{primaryMember?.name} ({primaryMember?.phone})</div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAttendanceModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {language === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    onClick={handleMarkSelfAttendance}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{language === 'bn' ? 'উপস্থিতি নিশ্চিত করুন' : 'Confirm Presence'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Member Fund Withdrawal Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center">
                  <WalletCards className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {language === 'bn' ? 'সীমিত তহবিল উত্তোলন' : 'Limited Fund Withdrawal'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {language === 'bn' ? 'সমিতির সংরক্ষিত নীতিমালা ও লিমিট অনুযায়ী' : 'Under society reserve and limit policies'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawalModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="py-8 text-center space-y-2 animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'bn' ? 'উত্তোলন সফল হয়েছে!' : 'Withdrawal Completed!'}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {withdrawSuccess}
                </p>
                <p className="text-[11px] text-slate-400 pt-1">
                  {language === 'bn' ? 'ডিজিটাল ভাউচার রসিদ তৈরি হয়েছে এবং লেজারে যুক্ত হয়েছে।' : 'Digital voucher receipt created & recorded.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleWithdrawSubmit} className="mt-4 space-y-4">
                {withdrawError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                {/* Account Selection if member has multiple accounts */}
                {actualLinkedMembers.length > 1 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      {language === 'bn' ? 'অ্যাকাউন্ট নির্বাচন করুন:' : 'Select Account:'}
                    </label>
                    <select
                      value={withdrawAccountId || primaryMember?.systemId}
                      onChange={(e) => {
                        setWithdrawAccountId(e.target.value);
                        setWithdrawError(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {actualLinkedMembers.map((m) => (
                        <option key={m.systemId} value={m.systemId}>
                          {m.name} ({m.accountNumber || m.systemId}) - ব্যালেন্স: ৳{(m.currentBalance || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 1. Fund Source Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    {language === 'bn' ? 'কোন তহবিল থেকে উত্তোলন করবেন?' : 'Select Fund Source:'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawSource('profit');
                        setWithdrawError(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        withdrawSource === 'profit'
                          ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-purple-700 dark:text-purple-300">
                        <Coins className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'সঞ্চিত মুনাফা' : 'Profit Share'}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mt-1">
                        ৳{selectedProfitBalance.toLocaleString()} {language === 'bn' ? '(১০০% অনুমোদন)' : '(100%)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawSource('savings');
                        setWithdrawError(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        withdrawSource === 'savings'
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700 dark:text-blue-300">
                        <PiggyBank className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'মূল সঞ্চয়' : 'Savings'}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mt-1">
                        ৳{selectedMaxAllowedSavings.toLocaleString()} {language === 'bn' ? '(৭০% লিমিট)' : '(70%)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Balance & Limit Summary Card */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  withdrawSource === 'profit'
                    ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60'
                    : 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60'
                }`}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      {withdrawSource === 'profit'
                        ? (language === 'bn' ? 'আমার সঞ্চিত মুনাফা লভ্যাংশ স্থিতি:' : 'Profit Dividend Balance:')
                        : (language === 'bn' ? 'অ্যাকাউন্টের মোট সঞ্চয় স্থিতি:' : 'Total Savings Balance:')}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ৳{(withdrawSource === 'profit' ? selectedProfitBalance : selectedAccountBalance).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {language === 'bn' ? 'বর্তমানে সর্বোচ্চ উত্তোলনযোগ্য সীমা:' : 'Max Allowable Limit:'}
                    </span>
                    <span className={`font-black text-sm ${
                      withdrawSource === 'profit' ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'
                    }`}>
                      ৳{selectedMaxWithdrawable.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 3. Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {language === 'bn' ? 'উত্তোলনের পরিমাণ (৳):' : 'Withdrawal Amount (৳):'}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {language === 'bn' ? `১ থেকে ৳${selectedMaxWithdrawable.toLocaleString()}` : `1 to ৳${selectedMaxWithdrawable.toLocaleString()}`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={selectedMaxWithdrawable}
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value);
                      setWithdrawError(null);
                    }}
                    placeholder={language === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Enter amount'}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />

                  {/* Quick percentage buttons */}
                  {selectedMaxWithdrawable > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[25, 50, 75, 100].map((pct) => {
                        const calculatedPart = Math.floor((selectedMaxWithdrawable * pct) / 100);
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setWithdrawAmount(calculatedPart);
                              setWithdrawError(null);
                            }}
                            className="py-1 px-1.5 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 transition-all cursor-pointer text-center"
                          >
                            {pct}% (৳{calculatedPart.toLocaleString()})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Payment Payout Method Choice */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    {language === 'bn' ? 'টাকা গ্রহণের প্রার্থিত মাধ্যম:' : 'Payout Method:'}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {[
                      { id: 'cash', label: 'ক্যাশ', icon: Banknote },
                      { id: 'bkash', label: 'বিকাশ', icon: Smartphone },
                      { id: 'nagad', label: 'নগদ', icon: Smartphone },
                      { id: 'rocket', label: 'রকেট', icon: Smartphone },
                      { id: 'bank', label: 'ব্যাংক', icon: Building2 },
                    ].map((m) => {
                      const IconComp = m.icon;
                      const isSelected = withdrawMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setWithdrawMethod(m.id as any)}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <IconComp className="w-4 h-4 text-purple-600" />
                          <span className="text-[11px] font-bold">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Mobile / Account Number if digital method */}
                {(withdrawMethod === 'bkash' || withdrawMethod === 'nagad' || withdrawMethod === 'rocket' || withdrawMethod === 'bank') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      {withdrawMethod === 'bank'
                        ? (language === 'bn' ? 'ব্যাংক হিসাব নম্বর ও বিবরণ:' : 'Bank Account Details:')
                        : (language === 'bn' ? `${withdrawMethod.toUpperCase()} পার্সোনাল নম্বর:` : `${withdrawMethod.toUpperCase()} Mobile Number:`)}
                    </label>
                    <input
                      type="text"
                      value={withdrawPayoutAccount}
                      onChange={(e) => setWithdrawPayoutAccount(e.target.value)}
                      placeholder={withdrawMethod === 'bank' ? 'সোনালী ব্যাংক একাউন্ট নম্বর' : '01XXXXXXXXX'}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                )}

                {/* 6. Reason / Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'উত্তোলনের কারণ বা বিবরণ (ঐচ্ছিক):' : 'Reason / Note (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    placeholder={language === 'bn' ? 'যেমন: পারিবারিক প্রয়োজন, চিকিৎসা খরচ, লভ্যাংশ গ্রহণ' : 'e.g. Family need, dividend payout'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawalModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {language === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={selectedMaxWithdrawable <= 0}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 ${
                      selectedMaxWithdrawable > 0
                        ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-purple-600/20'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <WalletCards className="w-4 h-4" />
                    <span>{language === 'bn' ? 'উত্তোলন আবেদন জমা দিন' : 'Submit Withdrawal Request'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
