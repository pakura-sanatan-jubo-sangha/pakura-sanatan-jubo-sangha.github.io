import React, { useState, useEffect, useMemo } from 'react';
import { Member, Contribution, Language, UserAccount, PaymentMethod } from '../types';
import { getTranslation, formatMemberPhone } from '../lib/translations';
import {
  PiggyBank,
  CheckCircle2,
  Clock,
  CheckSquare,
  Square,
  FileCheck,
  Receipt,
  Calendar,
  Wallet,
  Building2,
  Users,
  PlusCircle,
  Lock,
  History,
  Search,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface ContributionsViewProps {
  members: Member[];
  contributions: Contribution[];
  currentUser: UserAccount;
  language: Language;
  monthlyAmount: number;
  dueDay?: number;
  lateFeeAmount?: number;
  onRecordContribution: (
    memberSystemId: string,
    amount: number,
    month: string,
    method: PaymentMethod,
    contributionType?: 'regular' | 'seasonal_booster',
    notes?: string,
    lateFee?: number
  ) => void;
  onRecordBulkContributions: (
    memberSystemIds: string[],
    amount: number,
    month: string,
    method: PaymentMethod,
    lateFeePerMember?: number
  ) => void;
  onViewReceipt: (receiptId: string) => void;
  onOpenAddMember?: () => void;
  onOpenLoginModal?: () => void;
}

export const ContributionsView: React.FC<ContributionsViewProps> = ({
  members,
  contributions,
  currentUser,
  language,
  monthlyAmount,
  dueDay = 10,
  lateFeeAmount = 10,
  onRecordContribution,
  onRecordBulkContributions,
  onViewReceipt,
  onOpenAddMember,
  onOpenLoginModal,
}) => {
  const t = getTranslation(language);
  const canManage = currentUser.role === 'admin';
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);

  const effectiveDueDay = dueDay || 10;
  const effectiveLateFee = lateFeeAmount ?? 10;

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [expandedHistoryMonth, setExpandedHistoryMonth] = useState<string | null>(null);

  // Check if all active members have completed their payment for a given month
  const isMonthCompleted = (monthStr: string) => {
    if (activeMembers.length === 0) return false;
    const paidMemberIds = new Set(
      contributions.filter((c) => c.month === monthStr).map((c) => c.memberSystemId)
    );
    return activeMembers.every((m) => paidMemberIds.has(m.systemId));
  };

  // Identify recorded contribution months in Firebase (Samiti began in October 2025)
  const earliestContribMonth = useMemo(() => {
    const validMonths = contributions
      .map((c) => c.month)
      .filter((m) => m && m.match(/^\d{4}-\d{2}$/))
      .sort();
    return validMonths.length > 0 ? validMonths[0] : '2025-10';
  }, [contributions]);

  const latestActiveMonth = useMemo(() => {
    const validMonths = contributions
      .map((c) => c.month)
      .filter((m) => m && m.match(/^\d{4}-\d{2}$/))
      .sort();
    return validMonths.length > 0 ? validMonths[validMonths.length - 1] : '2025-10';
  }, [contributions]);

  // Dynamic 15-month rolling view:
  // Starts sequentially from the actual samiti start month (October 2025).
  // Strictly 100 Taka flat rate for all months.
  const rollingMonths = useMemo(() => {
    const [yStr, mStr] = earliestContribMonth.split('-');
    let curYear = parseInt(yStr, 10) || 2025;
    let curMonth = parseInt(mStr, 10) || 10;

    // Always generate consecutive months starting from the earliest recorded month (2025-10)
    const list: { value: string; label: string }[] = [];
    let genYear = curYear;
    let genMonth = curMonth;

    for (let i = 0; i < 15; i++) {
      const mVal = `${genYear}-${String(genMonth).padStart(2, '0')}`;
      const d = new Date(genYear, genMonth - 1, 1);
      // Display only month and year
      const label = d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'long',
        year: 'numeric',
      });

      list.push({ value: mVal, label });

      genMonth++;
      if (genMonth > 12) {
        genMonth = 1;
        genYear++;
      }
    }

    return list;
  }, [contributions, activeMembers, language, earliestContribMonth]);

  // All historical months starting from the earliest active month onwards for the History modal
  const allHistoryMonths = useMemo(() => {
    const [yStr, mStr] = earliestContribMonth.split('-');
    const startYear = parseInt(yStr, 10) || 2025;
    const startMonth = parseInt(mStr, 10) || 10;

    let maxYear = 2026;
    let maxMonth = 12;
    if (rollingMonths.length > 0) {
      const last = rollingMonths[rollingMonths.length - 1].value.split('-');
      maxYear = parseInt(last[0], 10);
      maxMonth = parseInt(last[1], 10);
    }
    contributions.forEach((c) => {
      const parts = c.month.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (y > maxYear || (y === maxYear && m > maxMonth)) {
          maxYear = y;
          maxMonth = m;
        }
      }
    });

    const result = [];
    let curY = startYear;
    let curM = startMonth;

    while (curY < maxYear || (curY === maxYear && curM <= maxMonth)) {
      const mVal = `${curY}-${String(curM).padStart(2, '0')}`;
      const d = new Date(curY, curM - 1, 1);
      const label = d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'long',
        year: 'numeric',
      });

      const mContributions = contributions.filter((c) => c.month === mVal);
      const paidMemberIds = new Set(mContributions.map((c) => c.memberSystemId));
      const totalCol = mContributions.reduce((sum, c) => sum + c.amount, 0);
      const isComp = activeMembers.length > 0 && activeMembers.every((m) => paidMemberIds.has(m.systemId));

      result.push({
        value: mVal,
        label,
        totalCollected: totalCol,
        expectedAmount: activeMembers.length * (monthlyAmount || 100),
        paidCount: activeMembers.filter((m) => paidMemberIds.has(m.systemId)).length,
        totalCount: activeMembers.length,
        isCompleted: isComp,
        contributions: mContributions,
      });

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    return result;
  }, [contributions, activeMembers, language, monthlyAmount, rollingMonths, earliestContribMonth]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return latestActiveMonth || '2025-10';
  });

  // When database is reset or empty, automatically set active month to samiti inception: October 2025
  useEffect(() => {
    if (contributions.length === 0) {
      setSelectedMonth('2025-10');
    }
  }, [contributions.length]);

  // Year options: Samiti foundation year (2025), preceding year, current year, following year, plus any recorded years
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set<number>([
      2025, // Samiti foundation year (October 2025)
      currentYear - 1, // Preceding year
      currentYear,     // Current year
      currentYear + 1, // Following year
    ]);
    contributions.forEach((c) => {
      const y = parseInt(c.month?.slice(0, 4), 10);
      if (!isNaN(y) && y >= 2025 && y <= 2050) {
        yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [contributions]);

  // 12 calendar months with bilingual names
  const MONTHS_OPTIONS = useMemo(() => [
    { num: '01', name_bn: 'জানুয়ারি', name_en: 'January' },
    { num: '02', name_bn: 'ফেব্রুয়ারি', name_en: 'February' },
    { num: '03', name_bn: 'মার্চ', name_en: 'March' },
    { num: '04', name_bn: 'এপ্রিল', name_en: 'April' },
    { num: '05', name_bn: 'মে', name_en: 'May' },
    { num: '06', name_bn: 'জুন', name_en: 'June' },
    { num: '07', name_bn: 'জুলাই', name_en: 'July' },
    { num: '08', name_bn: 'আগস্ট', name_en: 'August' },
    { num: '09', name_bn: 'সেপ্টেম্বর', name_en: 'September' },
    { num: '10', name_bn: 'অক্টোবর', name_en: 'October' },
    { num: '11', name_bn: 'নভেম্বর', name_en: 'November' },
    { num: '12', name_bn: 'ডিসেম্বর', name_en: 'December' },
  ], []);

  // Derived selected year and month number
  const selectedYear = parseInt(selectedMonth?.split('-')[0], 10) || 2025;
  const selectedMonthNum = selectedMonth?.split('-')[1] || '10';

  // Filter available months for the selected year (for 2025, Samiti began in October 2025)
  const currentYearMonthOptions = useMemo(() => {
    const startM = selectedYear === 2025 ? 10 : 1;
    return MONTHS_OPTIONS.filter((m) => parseInt(m.num, 10) >= startM);
  }, [selectedYear, MONTHS_OPTIONS]);

  // Payments made for each month within the selected year
  const yearMonthsData = useMemo(() => {
    const startM = selectedYear === 2025 ? 10 : 1;
    const list = [];
    for (let m = startM; m <= 12; m++) {
      const mStr = String(m).padStart(2, '0');
      const mKey = `${selectedYear}-${mStr}`;
      const d = new Date(selectedYear, m - 1, 1);
      const label = d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'long',
      });
      const mContribs = contributions.filter((c) => c.month === mKey);
      const totalCollected = mContribs.reduce((sum, c) => sum + (c.amount || 0), 0);
      const paidMemberIds = new Set(mContribs.map((c) => c.memberSystemId));
      const paidCount = activeMembers.filter((mbr) => paidMemberIds.has(mbr.systemId)).length;
      const isComplete = activeMembers.length > 0 && paidCount === activeMembers.length;
      const hasSome = paidCount > 0 && !isComplete;

      list.push({
        monthKey: mKey,
        monthNum: mStr,
        label,
        totalCollected,
        paidCount,
        totalMembers: activeMembers.length,
        isComplete,
        hasSome,
        isPending: paidCount === 0,
        isSelected: selectedMonth === mKey,
      });
    }
    return list;
  }, [selectedYear, contributions, activeMembers, language, selectedMonth]);

  const handleYearChange = (newYear: number) => {
    let newM = selectedMonthNum;
    if (newYear === 2025 && parseInt(newM, 10) < 10) {
      newM = '10';
    }
    const newMonth = `${newYear}-${newM}`;
    setSelectedMonth(newMonth);
    setSelectedMemberIds([]);
  };

  const handleMonthChange = (newMonthNum: string) => {
    const newMonth = `${selectedYear}-${newMonthNum}`;
    setSelectedMonth(newMonth);
    setSelectedMemberIds([]);
  };

  const formatMonthYearLabel = (mVal: string) => {
    if (!mVal) return '';
    const [y, m] = mVal.split('-').map(Number);
    if (!y || !m) return mVal;
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Combined deduplicated available months (historical + rolling window)
  const availableMonthOptions = useMemo(() => {
    const map = new Map<string, string>();
    allHistoryMonths.forEach((m) => map.set(m.value, m.label));
    rollingMonths.forEach((m) => map.set(m.value, m.label));
    if (selectedMonth && !map.has(selectedMonth)) {
      map.set(selectedMonth, formatMonthYearLabel(selectedMonth));
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [allHistoryMonths, rollingMonths, selectedMonth, language]);

  // Ensure selectedMonth stays in valid YYYY-MM format
  useEffect(() => {
    if (!selectedMonth || !selectedMonth.match(/^\d{4}-\d{2}$/)) {
      setSelectedMonth(latestActiveMonth || '2025-10');
    }
  }, [selectedMonth, latestActiveMonth]);

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Strictly 100 Taka flat rate: no 200 Taka extra admission fee for any entry
  const currentExpectedPerMember = monthlyAmount || 100;

  // Single payment modal
  const [payingMember, setPayingMember] = useState<Member | null>(null);
  const [payAmount, setPayAmount] = useState<number>(currentExpectedPerMember);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState('');

  // Bulk payment modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMethod, setBulkMethod] = useState<PaymentMethod>('cash');
  const [bulkAmount, setBulkAmount] = useState<number>(currentExpectedPerMember);

  // Keep bulk amount in sync when month changes
  useEffect(() => {
    setBulkAmount(currentExpectedPerMember);
  }, [currentExpectedPerMember]);

  const monthContributions = contributions.filter((c) => c.month === selectedMonth);
  const paidMemberSystemIds = new Set(monthContributions.map((c) => c.memberSystemId));

  const totalExpected = activeMembers.length * currentExpectedPerMember;
  const totalCollected = monthContributions.reduce((sum, c) => sum + c.amount, 0);
  const totalPending = Math.max(0, totalExpected - totalCollected);

  const unpaidMembers = activeMembers.filter((m) => !paidMemberSystemIds.has(m.systemId));

  // Late fee state: fee if paid after the due day of the month
  const checkIfMonthIsLate = (monthStr: string) => {
    const parts = monthStr.split('-');
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const dueDate = new Date(y, m - 1, effectiveDueDay, 23, 59, 59);
      return new Date() > dueDate;
    }
    return false;
  };

  const [applyLateFee, setApplyLateFee] = useState<boolean>(false);
  const [bulkApplyLateFee, setBulkApplyLateFee] = useState<boolean>(false);

  // Toggle selection for bulk payment
  const toggleSelectMember = (systemId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(systemId) ? prev.filter((id) => id !== systemId) : [...prev, systemId]
    );
  };

  const selectAllUnpaid = () => {
    if (selectedMemberIds.length === unpaidMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(unpaidMembers.map((m) => m.systemId));
    }
  };

  // Open single payment modal with clean defaults (no automatic late fee additions)
  const openPayModal = (member: Member) => {
    setPayingMember(member);
    setPayAmount(currentExpectedPerMember);
    setPayMethod('cash');
    setPayNotes('');
    setApplyLateFee(false);
  };

  const openBulkModal = () => {
    setBulkAmount(currentExpectedPerMember);
    setBulkApplyLateFee(false);
    setShowBulkModal(true);
  };

  const handleSinglePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingMember) return;
    onRecordContribution(
      payingMember.systemId,
      payAmount,
      selectedMonth,
      payMethod,
      'regular',
      payNotes.trim() || undefined,
      applyLateFee ? effectiveLateFee : 0
    );
    setPayingMember(null);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) return;
    onRecordBulkContributions(
      selectedMemberIds,
      bulkAmount,
      selectedMonth,
      bulkMethod,
      bulkApplyLateFee ? effectiveLateFee : 0
    );
    setSelectedMemberIds([]);
    setShowBulkModal(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>{t.navContributions}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'সদস্যদের নিয়মিত মাসিক সঞ্চয় আদায় ও হিসাব (ধার্যকৃত হার: ৳১০০, ১০ তারিখের পর বিলম্ব ফি: ৳১০)'
              : 'Monthly savings collection & records (Flat rate: ৳100, late fee after 10th: ৳10)'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* History Icon Button to view all past and current month payment records */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-2xs cursor-pointer transition-all hover:border-emerald-500"
            title={language === 'bn' ? 'সকল মাসের পেমেন্ট ইতিহাস দেখুন' : 'View All Months Payment History'}
          >
            <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{language === 'bn' ? 'পেমেন্ট ইতিহাস' : 'History'}</span>
          </button>
        </div>
      </div>

      {/* Month & Year Selector Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {language === 'bn' ? 'বর্তমান নির্বাচিত মাস:' : 'Selected Month:'}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {formatMonthYearLabel(selectedMonth)}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {/* Change Year Dropdown */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {language === 'bn' ? 'বছর পরিবর্তন:' : 'Change Year:'}
              </span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Change Month Dropdown */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {language === 'bn' ? 'মাস পরিবর্তন:' : 'Change Month:'}
              </span>
              <select
                value={selectedMonthNum}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              >
                {currentYearMonthOptions.map((m) => (
                  <option key={m.num} value={m.num}>
                    {language === 'bn' ? m.name_bn : m.name_en}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Monthly Payments Overview: Displays payments made for each month within the selected year */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {language === 'bn'
                ? `${selectedYear} সালের মাসিক জমার খতিয়ান ও আদায় বিবরণী`
                : `Monthly Savings Payments for ${selectedYear}`}
            </h3>
            {selectedYear === 2025 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {language === 'bn' ? 'প্রতিষ্ঠাকালীন শুরু: অক্টোবর ২০২৫' : 'Inception: October 2025'}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            {language === 'bn'
              ? `মোট আদায়: ৳${yearMonthsData.reduce((sum, m) => sum + m.totalCollected, 0).toLocaleString()}`
              : `Year Total: ৳${yearMonthsData.reduce((sum, m) => sum + m.totalCollected, 0).toLocaleString()}`}
          </span>
        </div>

        {/* Month cards grid for the selected year */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
          {yearMonthsData.map((m) => (
            <button
              key={m.monthKey}
              type="button"
              onClick={() => {
                setSelectedMonth(m.monthKey);
                setSelectedMemberIds([]);
              }}
              className={`p-3 rounded-xl text-left transition-all cursor-pointer border ${
                m.isSelected
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/50'
                  : m.isComplete
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-slate-800 dark:text-slate-200 hover:border-emerald-400'
                  : m.hasSome
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-slate-800 dark:text-slate-200 hover:border-amber-400'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs truncate">
                  {m.label}
                </span>
                <span
                  className={`text-[10px] font-mono ${
                    m.isSelected ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {m.monthNum}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span
                  className={`font-black ${
                    m.isSelected ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  ৳{m.totalCollected.toLocaleString()}
                </span>
                {m.isComplete ? (
                  <span
                    className={`text-[10px] font-bold flex items-center gap-0.5 ${
                      m.isSelected ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    ✓ {language === 'bn' ? 'সম্পূর্ণ' : 'Full'}
                  </span>
                ) : m.hasSome ? (
                  <span
                    className={`text-[10px] font-medium ${
                      m.isSelected ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {m.paidCount}/{m.totalMembers}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] ${
                      m.isSelected ? 'text-emerald-200' : 'text-slate-400'
                    }`}
                  >
                    {language === 'bn' ? 'বকেয়া' : 'Pending'}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {language === 'bn' ? 'প্রত্যাশিত মোট চাঁদা' : 'Total Target Collection'}
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ৳{totalExpected.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {activeMembers.length} {language === 'bn' ? 'জন সদস্য × ৳' : 'members × ৳'}{currentExpectedPerMember}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-emerald-600 font-medium">
            {language === 'bn' ? 'আদায়কৃত চাঁদা' : 'Collected So Far'}
          </span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            ৳{totalCollected.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {monthContributions.length} {language === 'bn' ? 'জন পরিশোধ করেছেন' : 'members paid'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-amber-600 font-medium">
            {language === 'bn' ? 'বকেয়া রয়েছে' : 'Pending Amount'}
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            ৳{totalPending.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {unpaidMembers.length} {language === 'bn' ? 'জন বাকি আছেন' : 'members pending'}
          </span>
        </div>
      </div>

      {/* Members Collection Table */}
      <div className="space-y-4">
        {/* Action Bar with Bulk Options */}
          {canManage && unpaidMembers.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllUnpaid}
                  className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 hover:text-amber-600 cursor-pointer"
                >
                  {selectedMemberIds.length === unpaidMembers.length ? (
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{t.selectAll} ({unpaidMembers.length})</span>
                </button>
                {selectedMemberIds.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 font-medium ml-2">
                    ({selectedMemberIds.length} {language === 'bn' ? 'জন নির্বাচিত' : 'selected'})
                  </span>
                )}
              </div>

              {selectedMemberIds.length > 0 && (
                <button
                  onClick={openBulkModal}
                  className="px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>
                    {t.markSelectedAsPaid} (৳{(selectedMemberIds.length * currentExpectedPerMember).toLocaleString()})
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Members Collection Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {language === 'bn' ? 'সদস্য তালিকা ও জমার অবস্থা' : 'Monthly Member Collection'}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                {availableMonthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[600px] overflow-y-auto custom-scrollbar">
              {activeMembers.length === 0 ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      {language === 'bn' ? 'সদস্য তালিকা বর্তমানে সম্পূর্ণ নতুন ও পরিচ্ছন্ন' : 'Member Roster is Clean & Ready'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {language === 'bn'
                        ? 'সদস্য তালিকা বর্তমানে সম্পূর্ণ নতুন ও পরিচ্ছন্ন। আপনি নিজ হাতে নতুন সদস্য যোগ করতে পারেন এবং তাদের সঠিক জমার হিসাব পরিচালনা করতে পারেন।'
                        : 'Member roster is clean and brand new. You can add members manually and record their payment amounts.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    {onOpenAddMember && (
                      <button
                        onClick={onOpenAddMember}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>{language === 'bn' ? 'নতুন সদস্য যোগ করুন' : 'Add New Member'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                activeMembers.map((member, idx) => {
                  const isPaid = paidMemberSystemIds.has(member.systemId);
                  const matchingCon = monthContributions.find((c) => c.memberSystemId === member.systemId);
                  const isSelected = selectedMemberIds.includes(member.systemId);

                  return (
                    <div
                      key={`${member.systemId}-${idx}`}
                      className={`p-3.5 flex items-center justify-between gap-4 transition-colors ${
                        isPaid
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                          : isSelected
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {canManage && !isPaid ? (
                          <button
                            onClick={() => toggleSelectMember(member.systemId)}
                            className="text-slate-400 hover:text-amber-600 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4 text-center text-xs text-slate-400">
                            {idx + 1}
                          </span>
                        )}

                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{formatMemberPhone(member.phone, canManage)}</span> • {language === 'bn' ? 'মোট সঞ্চয়:' : 'Total Savings:'} ৳{(member.currentBalance || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            ৳{matchingCon ? matchingCon.amount : currentExpectedPerMember}
                          </div>
                        </div>

                        {isPaid ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t.paid}</span>
                            </span>

                            {matchingCon?.receiptId && (
                              <button
                                onClick={() => onViewReceipt(matchingCon.receiptId)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg cursor-pointer"
                                title="View Receipt"
                              >
                                <Receipt className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{t.pending}</span>
                            </span>

                            {canManage ? (
                              <button
                                onClick={() => openPayModal(member)}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer"
                              >
                                {language === 'bn' ? 'জমা নিন' : 'Collect'}
                              </button>
                            ) : (
                              <button
                                onClick={onOpenLoginModal}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                title={language === 'bn' ? 'অ্যাডমিন হিসেবে লগইন করে জমা গ্রহণ করুন' : 'Login as Admin to collect'}
                              >
                                <Lock className="w-3 h-3" />
                                <span>{language === 'bn' ? 'জমা নিন' : 'Collect'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      {/* Single Payment Modal */}
      {payingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>{language === 'bn' ? 'সঞ্চয় জমা গ্রহণ' : 'Record Member Contribution'}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {availableMonthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth}
              </span>
            </h3>

            <form onSubmit={handleSinglePaySubmit} className="mt-4 space-y-4">
              {/* Member Details */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {payingMember.name}
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-mono">{formatMemberPhone(payingMember.phone, canManage)}</span> • {language === 'bn' ? 'বর্তমান সঞ্চয় স্থিতি:' : 'Current Balance:'} ৳{(payingMember.currentBalance || 0).toLocaleString()}
                </div>
              </div>

              {/* Amount Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.amount} (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                    placeholder={String(currentExpectedPerMember)}
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPayAmount(currentExpectedPerMember)}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    {language === 'bn' ? 'নির্ধারিত মাসিক চাঁদা:' : 'Standard monthly:'} ৳{currentExpectedPerMember}
                  </button>
                </div>
              </div>

              {/* Late Fee Notice & Checkbox (Dynamic fee applied if paid after the due day) */}
              <div className={`p-3 rounded-xl border text-xs transition-all ${
                applyLateFee
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyLateFee}
                      onChange={(e) => setApplyLateFee(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {language === 'bn' ? `${effectiveDueDay} তারিখের পর বিলম্ব ফি (৳${effectiveLateFee})` : `Late Fee (৳${effectiveLateFee}) after day ${effectiveDueDay}`}
                    </span>
                  </label>
                  <span className={`font-bold ${applyLateFee ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}`}>
                    +৳{applyLateFee ? effectiveLateFee : '০'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'bn'
                    ? `প্রতি মাসের ${effectiveDueDay} তারিখের মধ্যে ৳${monthlyAmount} সঞ্চয় বাধ্যতামূলক; ${effectiveDueDay} তারিখের পর জমায় ৳${effectiveLateFee} বিলম্ব ফি ঋণের মোট লভ্যাংশে যুক্ত হবে।`
                    : `৳${monthlyAmount} due by day ${effectiveDueDay}; ৳${effectiveLateFee} late fee applies afterwards and is added to total loan profit.`}
                </p>
                {applyLateFee && (
                  <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between font-bold text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'সর্বমোট আদায়:' : 'Total Payable:'} (৳{payAmount} + ৳{effectiveLateFee})
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                      ৳{(payAmount + effectiveLateFee).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 cursor-pointer ${
                      payMethod === 'cash'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 cursor-pointer ${
                      payMethod === 'bank'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{t.bank}</span>
                  </button>
                </div>
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'মন্তব্য / বিবরণ (ঐচ্ছিক):' : 'Notes / Remarks (Optional):'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'নিয়মিত মাসিক সঞ্চয়' : 'Regular monthly savings'}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                >
                  {language === 'bn' ? 'জমা সম্পন্ন ও রশিদ তৈরি' : 'Confirm & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Payment Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              {language === 'bn' ? 'একসাথে একাধিক সদস্যের চাঁদা জমা' : 'Bulk Collection Confirmation'}
            </h3>

            <form onSubmit={handleBulkSubmit} className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-xs">
                <div>
                  <span className="text-slate-500">{language === 'bn' ? 'নির্বাচিত সদস্য সংখ্যা:' : 'Selected Members:'}</span>{' '}
                  <span className="font-bold text-amber-700 dark:text-amber-300">{selectedMemberIds.length} জন</span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">{language === 'bn' ? 'মাস:' : 'Month:'}</span>{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {availableMonthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">{language === 'bn' ? 'সদস্য প্রতি জমা:' : 'Per Member Amount:'}</span>{' '}
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    ৳{bulkAmount.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">{language === 'bn' ? 'সর্বমোট জমার পরিমাণ:' : 'Total Bulk Amount:'}</span>{' '}
                  <span className="font-bold text-emerald-600 text-sm">
                    ৳{(selectedMemberIds.length * bulkAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Bulk Amount Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'সদস্য প্রতি চাঁদার পরিমাণ (৳):' : 'Per Member Amount (৳):'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={bulkAmount || ''}
                    onChange={(e) => setBulkAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                    placeholder={String(currentExpectedPerMember)}
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkAmount(currentExpectedPerMember)}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    {language === 'bn' ? 'নির্ধারিত মাসিক চাঁদা:' : 'Standard monthly:'} ৳{currentExpectedPerMember}
                  </button>
                </div>
              </div>

              {/* Bulk Late Fee Toggle (Dynamic fee applied if after due day) */}
              <div className={`p-3 rounded-xl border text-xs transition-all ${
                bulkApplyLateFee
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkApplyLateFee}
                      onChange={(e) => setBulkApplyLateFee(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {language === 'bn' ? `${effectiveDueDay} তারিখের পর বিলম্ব ফি (সদস্য প্রতি ৳${effectiveLateFee}) যোগ করুন` : `Add Late Fee (৳${effectiveLateFee}) per member`}
                    </span>
                  </label>
                  <span className={`font-bold ${bulkApplyLateFee ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}`}>
                    +৳{bulkApplyLateFee ? (selectedMemberIds.length * effectiveLateFee).toLocaleString() : '০'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'bn'
                    ? `${effectiveDueDay} তারিখের পর বিলম্ব ফি সরাসরি সমিতির ঋণের মোট লভ্যাংশে যুক্ত হবে।`
                    : `Late fee after day ${effectiveDueDay} is added directly to society loan profit.`}
                </p>
                {bulkApplyLateFee && (
                  <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between font-bold text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'সর্বমোট (চাঁদা + বিলম্ব ফি):' : 'Grand Total (Savings + Late Fee):'}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                      ৳{(selectedMemberIds.length * (bulkAmount + effectiveLateFee)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 cursor-pointer ${
                      bulkMethod === 'cash'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 cursor-pointer ${
                      bulkMethod === 'bank'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{t.bank}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                >
                  {language === 'bn' ? 'সকলের জমা নিশ্চিত করুন' : 'Confirm Bulk Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal: Complete Payment Records for All Months Starting October 2025 */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {language === 'bn' ? 'সকল মাসের পেমেন্ট ইতিহাস' : 'All Months Payment History'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'bn'
                      ? 'অক্টোবর ২০২৫ থেকে শুরু করে প্রতিটি মাসের আদায়, স্থিতি ও রসিদের পূর্ণ বিবরণ'
                      : 'Complete collection records, payment status & receipts starting October 2025'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* History Summary Chips & Search */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[11px] text-slate-500">{language === 'bn' ? 'মোট ট্র্যাককৃত মাস' : 'Total Months'}</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">{allHistoryMonths.length} টি</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">{language === 'bn' ? 'সর্বমোট আদায়কৃত চাঁদা' : 'Total Collection'}</div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    ৳{allHistoryMonths.reduce((sum, m) => sum + m.totalCollected, 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">{language === 'bn' ? 'সম্পূর্ণ পরিশোধিত মাস' : 'Completed Months'}</div>
                  <div className="font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                    {allHistoryMonths.filter((m) => m.isCompleted).length} টি
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  placeholder={language === 'bn' ? 'মাস বা সাল দিয়ে খুঁজুন...' : 'Search by month or year...'}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Months List Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {allHistoryMonths
                .filter((m) => {
                  if (!historySearchTerm.trim()) return true;
                  const term = historySearchTerm.toLowerCase();
                  return m.label.toLowerCase().includes(term) || m.value.includes(term);
                })
                .map((m) => {
                  const isCurrentSelected = m.value === selectedMonth;
                  const isExpanded = expandedHistoryMonth === m.value;
                  return (
                    <div
                      key={m.value}
                      className={`rounded-xl border transition-all ${
                        isCurrentSelected
                          ? 'border-amber-400 dark:border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Month Info */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                            <Calendar className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                {m.label}
                              </h4>
                              {isCurrentSelected && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white">
                                  {language === 'bn' ? 'চলতি নির্বাচিত' : 'Selected'}
                                </span>
                              )}
                              {m.isCompleted ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  ✓ {language === 'bn' ? 'সম্পূর্ণ পরিশোধিত' : 'All Paid'}
                                </span>
                              ) : m.totalCollected > 0 ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  {language === 'bn' ? 'আংশিক আদায়' : 'In Progress'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {language === 'bn' ? 'অনাদায়ী' : 'Unpaid'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                              <span>
                                {language === 'bn' ? 'আদায়কৃত:' : 'Collected:'}{' '}
                                <strong className="text-emerald-600 font-semibold">৳{m.totalCollected.toLocaleString()}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                {language === 'bn' ? 'পরিশোধিত:' : 'Paid:'}{' '}
                                <strong>{m.paidCount}/{m.totalCount} {language === 'bn' ? 'জন' : 'members'}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMonth(m.value);
                              setSelectedMemberIds([]);
                              setShowHistoryModal(false);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs transition-all"
                          >
                            {language === 'bn' ? 'এই মাস খুলুন' : 'Open Month'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryMonth(expandedHistoryMonth === m.value ? null : m.value)
                            }
                            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
                            title={language === 'bn' ? 'পেমেন্ট তালিকা দেখুন' : 'View Payment Records'}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Payment Records for this month */}
                      {isExpanded && (
                        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                          {m.contributions.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-400">
                              {language === 'bn' ? 'এই মাসে এখনও কোনো চাঁদা জমা হয়নি।' : 'No payment records for this month yet.'}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold text-slate-500 px-2 flex justify-between">
                                <span>{language === 'bn' ? 'সদস্য ও তারিখ' : 'Member & Date'}</span>
                                <span>{language === 'bn' ? 'পরিমাণ ও রসিদ' : 'Amount & Receipt'}</span>
                              </div>
                              {m.contributions.map((c, cIdx) => (
                                <div
                                  key={`${c.contributionId}-${cIdx}`}
                                  className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {c.memberName}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {c.contributionDate} • {c.paymentMethod === 'cash' ? (language === 'bn' ? 'ক্যাশ' : 'Cash') : (language === 'bn' ? 'ব্যাংক' : 'Bank')}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-emerald-600">৳{c.amount}</span>
                                    {c.receiptId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowHistoryModal(false);
                                          onViewReceipt(c.receiptId!);
                                        }}
                                        className="p-1 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                        title={language === 'bn' ? 'রসিদ দেখুন' : 'View Receipt'}
                                      >
                                        <Receipt className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-right">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer transition-all"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
