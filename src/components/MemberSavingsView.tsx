import React from 'react';
import { Member, Contribution, Receipt, Language, PaymentMethod } from '../types';
import { getTranslation } from '../lib/translations';
import {
  PiggyBank,
  CheckCircle2,
  Clock,
  ReceiptText,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface MemberSavingsViewProps {
  member: Member;
  linkedMembers?: Member[];
  contributions: Contribution[];
  receipts: Receipt[];
  monthlyAmount: number;
  dueDay: number;
  lateFeeAmount?: number;
  language: Language;
  onViewReceipt: (receiptId: string) => void;
}

export const MemberSavingsView: React.FC<MemberSavingsViewProps> = ({
  member,
  linkedMembers = [member],
  contributions,
  monthlyAmount,
  dueDay = 10,
  lateFeeAmount = 10,
  language,
  onViewReceipt,
}) => {
  const t = getTranslation(language);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>('all');

  // Collect all system IDs for linked accounts
  const systemIds = linkedMembers.map((m) => m.systemId);

  // Filter contributions for this member (and linked accounts)
  const allMyContributions = contributions
    .filter((c) => systemIds.includes(c.memberSystemId) && c && c.month)
    .sort((a, b) => (b.month || '').localeCompare(a.month || ''));

  const myContributions = selectedAccountId === 'all'
    ? allMyContributions
    : allMyContributions.filter((c) => c.memberSystemId === selectedAccountId);

  // Calculate total savings paid
  const totalPaidSavings = myContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const paidMonthsCount = myContributions.length;

  // Calculate aggregated current balance from member records
  const aggregatedBalance = selectedAccountId === 'all'
    ? linkedMembers.reduce((sum, m) => sum + (m.currentBalance || 0), 0)
    : (linkedMembers.find((m) => m.systemId === selectedAccountId)?.currentBalance || 0);

  const profitShareBalance = selectedAccountId === 'all'
    ? linkedMembers.reduce((sum, m) => sum + (m.profitShareBalance || 0), 0)
    : (linkedMembers.find((m) => m.systemId === selectedAccountId)?.profitShareBalance || 0);

  const totalWithdrawn = selectedAccountId === 'all'
    ? linkedMembers.reduce((sum, m) => sum + (m.totalWithdrawn || 0), 0)
    : (linkedMembers.find((m) => m.systemId === selectedAccountId)?.totalWithdrawn || 0);

  // Month calculations: Start from earliest recorded contribution month in Firebase (2026-08)
  const memberContribMonths = myContributions
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

  const today = new Date();
  const curY = today.getFullYear();
  const curM = today.getMonth() + 1;
  const currentDay = today.getDate();

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
  const paidMonthsSet = new Set(myContributions.map((c) => c.month));
  const outstandingMonths = allMonthsList.filter((m) => !paidMonthsSet.has(m)).reverse();

  // Calculation of total outstanding dues
  const totalOutstandingDue = outstandingMonths.reduce((sum, monthStr) => {
    const isPastDue =
      monthStr < today.toISOString().slice(0, 7) ||
      (monthStr === today.toISOString().slice(0, 7) && currentDay > dueDay);
    const fee = isPastDue ? lateFeeAmount : 0;
    return sum + monthlyAmount + fee;
  }, 0);

  const formatMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return monthStr;
    const date = new Date(year, month - 1, 1);
    if (isNaN(date.getTime())) return monthStr;
    return date.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* 1. Header Banner: Strictly Member Savings & Ledger */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold uppercase tracking-wider">
              <PiggyBank className="w-4 h-4" />
              <span>{language === 'bn' ? 'সঞ্চয় হিসাব ও জমার খতিয়ান' : 'Savings & Ledger'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1 text-white tracking-tight">
              {member.name}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
              {language === 'bn' ? 'মাসিক নির্ধারিত সঞ্চয়:' : 'Monthly Contribution:'}{' '}
              <span className="font-bold text-white">৳{monthlyAmount.toLocaleString()}</span>
              {' • '}{language === 'bn' ? 'পরিশোধের শেষ তারিখ:' : 'Due Date:'}{' '}
              <span className="font-bold text-white">{dueDay} {language === 'bn' ? 'তারিখ' : 'th'}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            {profitShareBalance > 0 && (
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/20 text-right sm:min-w-[130px]">
                <span className="text-[10px] text-emerald-100 block">
                  {language === 'bn' ? 'অর্জিত ঋণ লভ্যাংশ' : 'Loan Profit Dividend'}
                </span>
                <span className="text-lg font-bold text-amber-200 block mt-0.5">
                  +৳{profitShareBalance.toLocaleString()}
                </span>
              </div>
            )}
            {totalWithdrawn > 0 && (
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/20 text-right sm:min-w-[120px]">
                <span className="text-[10px] text-emerald-100 block">
                  {language === 'bn' ? 'মোট উত্তোলন' : 'Total Withdrawn'}
                </span>
                <span className="text-lg font-bold text-rose-200 block mt-0.5">
                  -৳{totalWithdrawn.toLocaleString()}
                </span>
              </div>
            )}
            <div className="bg-white/15 backdrop-blur-xs p-3.5 rounded-xl border border-white/20 text-right sm:min-w-[160px]">
              <span className="text-[11px] text-emerald-100 block font-medium">
                {language === 'bn' ? 'মোট বর্তমান জমা স্থিতি' : 'Total Current Balance'}
              </span>
              <span className="text-2xl font-black text-white block mt-0.5">
                ৳{aggregatedBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>


      {/* 2. Four Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
            {language === 'bn' ? 'মোট পরিশোধিত সঞ্চয়' : 'Total Savings Paid'}
          </span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            ৳{totalPaidSavings.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {language === 'bn' ? 'সংগঠনের তহবিলে জমা' : 'Credited to fund'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
            {language === 'bn' ? 'পরিশোধিত মাসের সংখ্যা' : 'Paid Months Count'}
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {paidMonthsCount} {language === 'bn' ? 'মাস' : 'months'}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
            ✓ {language === 'bn' ? 'সফলভাবে প্রাপ্ত' : 'Fully credited'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
            {language === 'bn' ? 'সর্বমোট বকেয়া কিস্তি' : 'Total Outstanding Dues'}
          </span>
          <div className={`text-xl sm:text-2xl font-bold mt-1 ${
            totalOutstandingDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            ৳{totalOutstandingDue.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {totalOutstandingDue > 0
              ? (language === 'bn' ? 'অনতিবিলম্বে পরিশোধযোগ্য' : 'Due for payment')
              : (language === 'bn' ? 'কোনো বকেয়া নেই ✓' : 'Zero dues ✓')}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
            {language === 'bn' ? 'বকেয়া মাসের সংখ্যা' : 'Outstanding Months'}
          </span>
          <div className={`text-xl sm:text-2xl font-bold mt-1 ${
            outstandingMonths.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          }`}>
            {outstandingMonths.length} {language === 'bn' ? 'মাস' : 'months'}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {language === 'bn' ? `প্রতি মাসে ৳${monthlyAmount}` : `৳${monthlyAmount} / month`}
          </span>
        </div>
      </div>

      {/* 3. Outstanding Payments Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {language === 'bn' ? 'বকেয়া ও অপরিশোধিত কিস্তির হিসাব' : 'Outstanding & Due Payments'}
            </h3>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            outstandingMonths.length === 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
          }`}>
            {outstandingMonths.length === 0
              ? (language === 'bn' ? 'সকল কিস্তি পরিশোধিত ✓' : 'All Paid ✓')
              : `${outstandingMonths.length} ${language === 'bn' ? 'মাস বাকি' : 'Months Due'}`}
          </span>
        </div>

        {outstandingMonths.length === 0 ? (
          <div className="py-6 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
            <p className="text-xs sm:text-sm font-bold">
              {language === 'bn'
                ? 'অভিনন্দন! আপনার কোনো অপরিশোধিত বা বকেয়া কিস্তি নেই।'
                : 'Excellent! You have zero outstanding savings payments.'}
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
              {language === 'bn'
                ? 'আপনার সকল সঞ্চয় সম্পূর্ণ হালনাগাদ ও পরিশোধিত রয়েছে।'
                : 'All your monthly contributions are up to date.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {outstandingMonths.map((mStr) => {
                const isPastDue =
                  mStr < today.toISOString().slice(0, 7) ||
                  (mStr === today.toISOString().slice(0, 7) && currentDay > dueDay);
                const lateFee = isPastDue ? lateFeeAmount : 0;
                const totalMonthDue = monthlyAmount + lateFee;

                return (
                  <div
                    key={mStr}
                    className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {formatMonthName(mStr)}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                          {isPastDue
                            ? (language === 'bn' ? 'বকেয়া' : 'Overdue')
                            : (language === 'bn' ? 'চলতি মাস' : 'Current')}
                        </span>
                      </div>
                      <div className="mt-2 text-base font-bold text-rose-700 dark:text-rose-400">
                        ৳{totalMonthDue.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {language === 'bn' ? 'মূল সঞ্চয়: ৳' : 'Savings: ৳'}{monthlyAmount}
                        {lateFee > 0 && ` + ${language === 'bn' ? 'বিলম্ব ফি' : 'Late fee'} ৳${lateFee}`}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 text-[10px] text-rose-800 dark:text-rose-300">
                      {isPastDue ? (
                        <span>⚠️ {language === 'bn' ? `নির্ধারিত ${dueDay} তারিখ অতিক্রান্ত` : `Past day ${dueDay}`}</span>
                      ) : (
                        <span>⏰ {language === 'bn' ? `${dueDay} তারিখের পূর্বে প্রদানযোগ্য` : `Pay before day ${dueDay}`}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Complete Payment History Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {language === 'bn' ? 'পরিশোধিত জমার সম্পূর্ণ খতিয়ান' : 'Complete Payment History'}
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {myContributions.length} {language === 'bn' ? 'টি পরিশোধিত কিস্তি' : 'Payments'}
          </span>
        </div>

        <div className="overflow-x-auto">
          {myContributions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              {language === 'bn'
                ? 'এখনো কোনো জমার তথ্য পাওয়া যায়নি।'
                : 'No payment records found yet.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="p-3.5 font-medium">{language === 'bn' ? 'মাস' : 'Month'}</th>
                  <th className="p-3.5 font-medium">{language === 'bn' ? 'জমার তারিখ' : 'Payment Date'}</th>
                  <th className="p-3.5 font-medium text-right">{language === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                  <th className="p-3.5 font-medium text-center">{language === 'bn' ? 'মাধ্যম' : 'Method'}</th>
                  <th className="p-3.5 font-medium text-center">{language === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="p-3.5 font-medium text-right">{language === 'bn' ? 'রশিদ' : 'Receipt'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {myContributions.map((c, idx) => (
                  <tr
                    key={`${c.contributionId}-${idx}`}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {formatMonthName(c.month)}
                    </td>
                    <td className="p-3.5 text-slate-500 dark:text-slate-400">
                      {c.contributionDate}
                    </td>
                    <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ৳{c.amount.toLocaleString()}
                      {c.lateFee && c.lateFee > 0 && (
                        <span className="block text-[10px] text-amber-600 font-normal">
                          +{language === 'bn' ? 'জরিমানা ৳' : 'late ৳'}{c.lateFee}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                        {c.paymentMethod === 'bank' ? (language === 'bn' ? 'ব্যাংক' : 'Bank') : (language === 'bn' ? 'ক্যাশ' : 'Cash')}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{language === 'bn' ? 'পরিশোধিত' : 'Paid'}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {c.receiptId ? (
                        <button
                          onClick={() => onViewReceipt(c.receiptId)}
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
