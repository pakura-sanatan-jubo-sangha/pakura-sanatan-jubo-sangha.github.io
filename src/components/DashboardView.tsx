import React from 'react';
import { DashboardMetrics, Language, UserAccount, Transaction, SocietyRule, GeneralMeeting } from '../types';
import { getTranslation } from '../lib/translations';
import { MeetingNoticeBanner } from './MeetingNoticeBanner';
import {
  Users,
  PiggyBank,
  TrendingUp,
  CreditCard,
  Wallet,
  Building2,
  ArrowDownRight,
  ArrowUpRight,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  Eye,
  Key,
  Coins,
} from 'lucide-react';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  recentTransactions: Transaction[];
  currentUser: UserAccount;
  language: Language;
  rules?: SocietyRule[];
  meetings?: GeneralMeeting[];
  generalMeetingTime?: string;
  onNavigate: (tab: string) => void;
  onQuickAddMember: () => void;
  onQuickContribution: () => void;
  onQuickNewLoan: () => void;
  onQuickPayment: () => void;
  onOpenGoogleSheets: () => void;
  isSheetConnected: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  recentTransactions,
  currentUser,
  language,
  rules,
  meetings,
  generalMeetingTime,
  onNavigate,
  onQuickAddMember,
  onQuickContribution,
  onQuickNewLoan,
  onQuickPayment,
  onOpenGoogleSheets,
  isSheetConnected,
}) => {
  const t = getTranslation(language);

  // Formatting currency in BDT
  const formatMoney = (val: number) => {
    return `৳${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const totalFund = metrics.cashBalance + metrics.bankBalance + metrics.moneyOutside;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner & Quick Sync */}
      <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-100 text-xs font-semibold uppercase tracking-wider">
              <span>🕉️ {language === 'bn' ? 'শুভ সূচনা' : 'Auspicious Beginning'}</span>
              <span>•</span>
              <span>{language === 'bn' ? 'সততা ও সেবা' : 'Integrity & Service'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1 text-white tracking-tight">
              {t.appName}
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-xl">
              {language === 'bn'
                ? 'সংগঠনের সকল সদস্যের সঞ্চয়, ঋণ বিতরণ, আদায় ও আয়-ব্যয়ের স্বচ্ছ হিসাব ব্যবস্থা।'
                : 'Transparent financial accounting for members savings, loan distributions, collections and ledgers.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenGoogleSheets}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/95 text-slate-800 hover:bg-white shadow-sm flex items-center gap-2 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>
                {isSheetConnected
                  ? language === 'bn' ? 'গুগল শিট সংযুক্ত ✓' : 'Google Sheets ✓'
                  : language === 'bn' ? 'শিটে সিঙ্ক করুন' : 'Sync Google Sheets'}
              </span>
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-800/40 hover:bg-amber-800/60 text-white border border-white/20 transition-all"
            >
              {t.navReports}
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Monthly General Meeting Notice Banner & Sequential Right-to-Left Scrolling Resolutions & Rules */}
      <MeetingNoticeBanner
        language={language}
        rules={rules}
        meetings={meetings}
        generalMeetingTime={generalMeetingTime}
        onNavigate={onNavigate}
      />

      {/* 6 Dynamic Statistics Cards (৳0 initially, calculated automatically) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total Members (Dynamic, not fixed) */}
        <div
          onClick={() => onNavigate(currentUser.role === 'member' ? 'member_dashboard' : 'members')}
          className="cursor-pointer group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t.totalMembers}
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {metrics.totalMembers}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                ({metrics.activeMembers} {language === 'bn' ? 'সক্রিয়' : 'active'})
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {currentUser.role === 'member'
                ? (language === 'bn' ? 'আমার ব্যক্তিগত প্রোফাইল ও বিবরণী' : 'My personal profile & ledger')
                : (language === 'bn' ? 'সংগঠনের সকল নিবন্ধিত সদস্য' : 'All registered members')}
            </p>
          </div>
        </div>

        {/* Card 2: Total Member Capital */}
        <div
          onClick={() => onNavigate(currentUser.role === 'member' ? 'member_dashboard' : 'contributions')}
          className="cursor-pointer group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t.totalMemberCapital}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {formatMoney(metrics.totalMemberCapital)}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {currentUser.role === 'member'
                ? (language === 'bn' ? 'আমার প্রোফাইল ও হিসাব খতিয়ান' : 'My profile & ledger')
                : (language === 'bn' ? 'সদস্যদের জমাকৃত মাসিক চাঁদা/সঞ্চয়' : 'Sum of all members savings')}
            </p>
          </div>
        </div>

        {/* Card 4: Total Loan Profit */}
        <div
          onClick={() => onNavigate('loans')}
          className="cursor-pointer group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t.totalLoanProfit}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(metrics.totalLoanProfit)}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {language === 'bn' ? '১০% মাসিক হারে অর্জিত মোট মুনাফা' : '10% monthly calculated return'}
            </p>
          </div>
        </div>

        {/* Card 5: Money Outside (Active Loan Principal) */}
        <div
          onClick={() => onNavigate('loans')}
          className="cursor-pointer group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t.moneyOutside}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {formatMoney(metrics.moneyOutside)}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {language === 'bn' ? 'বর্তমানে ঋণগ্রহীতাদের কাছে বকেয়া আসল' : 'Currently outstanding principal'}
            </p>
          </div>
        </div>

        {/* Card 6: Cash Balance */}
        <div
          onClick={() => onNavigate('transactions')}
          className="cursor-pointer group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t.cashBalance}
            </span>
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {formatMoney(metrics.cashBalance)}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {language === 'bn' ? 'কোষাধ্যক্ষের নিকট নগদ স্থিতি' : 'Cash in hand with treasurer'}
            </p>
          </div>
        </div>

        {/* Card 7: Bank Balance */}
        <div
          onClick={() => onNavigate('transactions')}
          className="cursor-pointer group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t.bankBalance}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {formatMoney(metrics.bankBalance)}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {language === 'bn' ? 'সংঘের ব্যাংক হিসাবে জমাকৃত স্থিতি' : 'Bank account deposits balance'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons for Management */}
      {currentUser.role !== 'member' && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            {language === 'bn' ? 'দ্রুত কার্যক্রম (Quick Actions)' : 'Quick Actions'}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onQuickAddMember}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition-all"
            >
              <PlusCircle className="w-4 h-4 text-amber-600" />
              <span>{t.addMember}</span>
            </button>

            <button
              onClick={onQuickContribution}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition-all"
            >
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              <span>{t.recordContribution}</span>
            </button>

            <button
              onClick={onQuickNewLoan}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition-all"
            >
              <CreditCard className="w-4 h-4 text-purple-600" />
              <span>{t.createLoan}</span>
            </button>

            <button
              onClick={onQuickPayment}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition-all"
            >
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>{t.receivePayment}</span>
            </button>

            <button
              onClick={() => onNavigate('withdrawals')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
            >
              <Coins className="w-4 h-4 text-purple-600" />
              <span>{language === 'bn' ? 'সঞ্চয় ও মুনাফা উত্তোলন' : 'Withdrawals & Profit'}</span>
            </button>

            <button
              onClick={() => onNavigate('income')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition-all"
            >
              <ArrowDownRight className="w-4 h-4 text-teal-600" />
              <span>{t.addIncome}</span>
            </button>

            <button
              onClick={() => onNavigate('expenses')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition-all"
            >
              <ArrowUpRight className="w-4 h-4 text-red-600" />
              <span>{t.addExpense}</span>
            </button>
          </div>
        </div>
      )}

      {/* Money Overview Breakdown */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? 'আর্থিক তহবিল স্থিতি চিত্র' : 'Fund Overview & Position'}
            </h3>
            <p className="text-xs text-slate-400">
              {language === 'bn' ? 'মোট তহবিল ও এর অবস্থান' : 'Total capital and active allocation'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-slate-500">{t.netFund}</div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400">
              {formatMoney(totalFund)}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3.5">
          {/* Cash Bar */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>{t.cashBalance}</span>
              <span>{formatMoney(metrics.cashBalance)}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${totalFund > 0 ? Math.min(100, (metrics.cashBalance / totalFund) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Bank Bar */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>{t.bankBalance}</span>
              <span>{formatMoney(metrics.bankBalance)}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${totalFund > 0 ? Math.min(100, (metrics.bankBalance / totalFund) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Money Outside / Loans */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>{t.moneyOutside}</span>
              <span>{formatMoney(metrics.moneyOutside)}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${totalFund > 0 ? Math.min(100, (metrics.moneyOutside / totalFund) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>{language === 'bn' ? 'অডিট নিয়ম: লেজার ভিত্তিক হিসাব' : 'Audit principle: Strict ledger balances'}</span>
          <button
            onClick={() => onNavigate('analytics')}
            className="text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>{language === 'bn' ? 'পূর্ণাঙ্গ অ্যানালিটিক্স' : 'Full Analytics'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recent Ledger Entries */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? 'সাম্প্রতিক মাস্টার লেজার লেনদেন' : 'Recent Master Ledger Transactions'}
            </h3>
            <p className="text-xs text-slate-400">
              {language === 'bn' ? 'সর্বশেষ সংগঠিত আর্থিক এন্ট্রি সমূহ' : 'Latest financial ledger entries'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>{language === 'bn' ? 'সকল লেনদেন দেখুন' : 'View All'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              {language === 'bn'
                ? 'বর্তমানে কোনো লেনদেন রেকর্ড নেই। ডাটাবেজ ৳০-তে প্রস্তুত রয়েছে।'
                : 'No transaction entries yet. Database ready at ৳0 balance.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2 font-medium">{t.date}</th>
                  <th className="pb-2 font-medium">{language === 'bn' ? 'বিবরণ' : 'Description'}</th>
                  <th className="pb-2 font-medium">{t.paymentMethod}</th>
                  <th className="pb-2 font-medium text-right">{language === 'bn' ? 'জমা (Inflow)' : 'Credit'}</th>
                  <th className="pb-2 font-medium text-right">{language === 'bn' ? 'খরচ (Outflow)' : 'Debit'}</th>
                  <th className="pb-2 font-medium text-right">{language === 'bn' ? 'স্থিতি' : 'Balance'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentTransactions.slice(0, 5).map((trx, idx) => (
                  <tr key={`${trx.transactionId}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 text-slate-500">{trx.date}</td>
                    <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {trx.description}
                    </td>
                    <td className="py-2.5 text-slate-500 uppercase">{trx.paymentMethod}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-600">
                      {trx.credit > 0 ? `+${formatMoney(trx.credit)}` : '—'}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-red-600">
                      {trx.debit > 0 ? `-${formatMoney(trx.debit)}` : '—'}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                      {formatMoney(trx.balanceAfter)}
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
