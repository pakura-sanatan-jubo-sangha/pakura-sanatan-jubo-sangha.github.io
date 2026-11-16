import React from 'react';
import { DashboardMetrics, Language, Contribution, Loan, LoanPayment } from '../types';
import { getTranslation } from '../lib/translations';
import {
  PieChart,
  TrendingUp,
  CreditCard,
  PiggyBank,
  Wallet,
  Building2,
  CheckCircle2,
} from 'lucide-react';

interface AnalyticsViewProps {
  metrics: DashboardMetrics;
  contributions: Contribution[];
  loans: Loan[];
  payments: LoanPayment[];
  language: Language;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  metrics,
  contributions,
  loans,
  payments,
  language,
}) => {
  const t = getTranslation(language);
  const totalFund = metrics.cashBalance + metrics.bankBalance + metrics.moneyOutside;

  const cashPct = totalFund > 0 ? (metrics.cashBalance / totalFund) * 100 : 0;
  const bankPct = totalFund > 0 ? (metrics.bankBalance / totalFund) * 100 : 0;
  const loansPct = totalFund > 0 ? (metrics.moneyOutside / totalFund) * 100 : 0;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <PieChart className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          <span>{t.navAnalytics}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {language === 'bn'
            ? 'তহবিল বণ্টন, তারল্য অনুপাত ও ঋণ মুনাফার ভিজ্যুয়াল পরিসংখ্যান'
            : 'Asset allocation, liquidity ratio & return analytics'}
        </p>
      </div>

      {/* Asset Allocation Chart Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
            {language === 'bn' ? 'তহবিলের অবস্থান ও তারল্য বণ্টন (Asset Allocation)' : 'Asset Allocation'}
          </h3>

          <div className="mt-5 flex flex-col sm:flex-row items-center gap-6">
            {/* Donut Chart SVG */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <path
                  className="text-slate-100 dark:text-slate-800"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Cash Segment (Teal) */}
                <path
                  className="text-teal-500"
                  strokeDasharray={`${cashPct}, 100`}
                  strokeDashoffset="0"
                  strokeWidth="4.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Bank Segment (Indigo) */}
                <path
                  className="text-indigo-500"
                  strokeDasharray={`${bankPct}, 100`}
                  strokeDashoffset={`-${cashPct}`}
                  strokeWidth="4.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Loans Segment (Purple) */}
                <path
                  className="text-purple-500"
                  strokeDasharray={`${loansPct}, 100`}
                  strokeDashoffset={`-${cashPct + bankPct}`}
                  strokeWidth="4.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-slate-400">{t.netFund}</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  ৳{totalFund.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-3 w-full text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/50">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-teal-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t.cashBalance}</span>
                </div>
                <div className="text-right font-bold text-teal-700 dark:text-teal-300">
                  ৳{metrics.cashBalance.toLocaleString()} ({cashPct.toFixed(1)}%)
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/50">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t.bankBalance}</span>
                </div>
                <div className="text-right font-bold text-indigo-700 dark:text-indigo-300">
                  ৳{metrics.bankBalance.toLocaleString()} ({bankPct.toFixed(1)}%)
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/50">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t.moneyOutside}</span>
                </div>
                <div className="text-right font-bold text-purple-700 dark:text-purple-300">
                  ৳{metrics.moneyOutside.toLocaleString()} ({loansPct.toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Growth & Performance Insights */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              {language === 'bn' ? 'কার্যকারিতা ও প্রবৃদ্ধি সূচক' : 'Performance Indicators'}
            </h3>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'সঞ্চয় মূলধন প্রবৃদ্ধি' : 'Member Capital Growth'}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {contributions.length} {language === 'bn' ? 'টি কিস্তির মাধ্যমে সংগৃহীত' : 'installments collected'}
                  </div>
                </div>
                <div className="text-base font-bold text-amber-600">
                  ৳{metrics.totalMemberCapital.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'ঋণ থেকে অর্জিত রিটার্ন' : 'Realized Loan Profit'}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {payments.length} {language === 'bn' ? 'টি ঋণ আদায় ও পূর্ববর্তী ঋণের মুনাফাসহ' : 'repayments & past loan profits'}
                  </div>
                </div>
                <div className="text-base font-bold text-emerald-600">
                  ৳{metrics.totalLoanProfit.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'তারল্য অনুপাত (নগদ ও ব্যাংক)' : 'Liquidity Ratio (Cash+Bank)'}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {language === 'bn' ? 'তাত্ক্ষণিক উত্তোলনের সক্ষমতা' : 'Immediate liquid access'}
                  </div>
                </div>
                <div className="text-base font-bold text-indigo-600">
                  {totalFund > 0 ? ((metrics.cashBalance + metrics.bankBalance) / totalFund * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{language === 'bn' ? 'স্বয়ংক্রিয় গাণিতিক মডেল দ্বারা চালিত।' : 'Live mathematical calculation model.'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
