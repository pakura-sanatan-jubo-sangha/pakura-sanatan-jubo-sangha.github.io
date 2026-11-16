import React, { useState } from 'react';
import {
  Member,
  Contribution,
  Loan,
  LoanPayment,
  Income,
  Expense,
  Transaction,
  DashboardMetrics,
  Language,
  UserAccount,
} from '../types';
import { getTranslation, formatMemberPhone } from '../lib/translations';
import {
  FileBarChart,
  Printer,
  Calendar,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Users,
  CreditCard,
  PiggyBank,
} from 'lucide-react';

interface ReportsViewProps {
  metrics: DashboardMetrics;
  members: Member[];
  contributions: Contribution[];
  loans: Loan[];
  payments: LoanPayment[];
  incomes: Income[];
  expenses: Expense[];
  transactions: Transaction[];
  language: Language;
  currentUser?: UserAccount;
  onOpenGoogleSheets: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  metrics,
  members,
  contributions,
  loans,
  payments,
  incomes,
  expenses,
  transactions,
  language,
  currentUser,
  onOpenGoogleSheets,
}) => {
  const t = getTranslation(language);
  const isAdmin = currentUser?.role === 'admin';
  const [reportType, setReportType] = useState<
    'financial_summary' | 'members_statement' | 'loans_portfolio' | 'income_expense'
  >('financial_summary');

  const totalFund = metrics.cashBalance + metrics.bankBalance + metrics.moneyOutside;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>{t.navReports}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'অফিসিয়াল আর্থিক প্রতিবেদন, বার্ষিক হিসাব ও সদস্যদের অডিট বিবরণী'
              : 'Official financial statements, annual audits and audit reports'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGoogleSheets}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{language === 'bn' ? 'গুগল শিটে এক্সপোর্ট' : 'Google Sheets Export'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'bn' ? 'রিপোর্ট প্রিন্ট' : 'Print Report'}</span>
          </button>
        </div>
      </div>

      {/* Report Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={() => setReportType('financial_summary')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            reportType === 'financial_summary'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          {language === 'bn' ? '১. সারসংক্ষেপ আর্থিক বিবরণী' : '1. Financial Summary'}
        </button>

        <button
          onClick={() => setReportType('members_statement')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            reportType === 'members_statement'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          {language === 'bn' ? '২. সদস্য সঞ্চয় তালিকা' : '2. Member Savings Statement'}
        </button>

        <button
          onClick={() => setReportType('loans_portfolio')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            reportType === 'loans_portfolio'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          {language === 'bn' ? '৩. ঋণ ও মুনাফা পোর্টফোলিও' : '3. Loans & Profit Portfolio'}
        </button>

        <button
          onClick={() => setReportType('income_expense')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            reportType === 'income_expense'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          {language === 'bn' ? '৪. আয় ও ব্যয়ের খতিয়ান' : '4. Income & Expense Statement'}
        </button>
      </div>

      {/* Printable Report Document Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Report Header */}
        <div className="text-center pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-amber-600 uppercase tracking-widest">
            {language === 'bn' ? 'পাকুড়া সনাতন যুব সংঘ' : 'Pakura Sanatan Jubo Sangha'}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {reportType === 'financial_summary' && (language === 'bn' ? 'সার্বিক আর্থিক ব্যালেন্স শীট ও তহবিল প্রতিবেদন' : 'Comprehensive Financial Balance Sheet')}
            {reportType === 'members_statement' && (language === 'bn' ? 'সদস্যদের সঞ্চয় ও মূলধন বিবরণী' : 'Members Capital & Savings Report')}
            {reportType === 'loans_portfolio' && (language === 'bn' ? 'ঋণ বিতরণ, বকেয়া আসল ও অর্জিত মুনাফা প্রতিবেদন' : 'Loan Portfolio, Outstanding Principal & Profit Report')}
            {reportType === 'income_expense' && (language === 'bn' ? 'আয় ও ব্যয়ের পূর্ণাঙ্গ অডিট প্রতিবেদন' : 'Full Income & Expenditure Audit Statement')}
          </h1>
          <div className="text-xs text-slate-400 mt-1">
            {language === 'bn' ? 'মুদ্রণের তারিখ ও সময়:' : 'Report Generated:'} {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'full' })}
          </div>
        </div>

        {/* 1. Financial Summary Content */}
        {reportType === 'financial_summary' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500">{t.totalMemberCapital}</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  ৳{metrics.totalMemberCapital.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-emerald-600 font-semibold">{t.totalLoanProfit}</div>
                <div className="text-lg font-bold text-emerald-600 mt-1">
                  ৳{metrics.totalLoanProfit.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-purple-600 font-semibold">{t.moneyOutside}</div>
                <div className="text-lg font-bold text-purple-600 mt-1">
                  ৳{metrics.moneyOutside.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-amber-600 font-semibold">{t.netFund}</div>
                <div className="text-lg font-bold text-amber-600 mt-1">
                  ৳{totalFund.toLocaleString()}
                </div>
              </div>
            </div>

            <table className="w-full text-left text-xs mt-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                  <th className="py-2.5">{language === 'bn' ? 'হিসাব খাত (Account Head)' : 'Account Head'}</th>
                  <th className="py-2.5">{language === 'bn' ? 'ধরন' : 'Category'}</th>
                  <th className="py-2.5 text-right">{language === 'bn' ? 'পরিমাণ (৳)' : 'Amount (৳)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  <td className="py-2.5 font-semibold">কোষাধ্যক্ষের নগদ স্থিতি (Cash in Hand)</td>
                  <td className="py-2.5 text-slate-500">Asset</td>
                  <td className="py-2.5 text-right font-bold">৳{metrics.cashBalance.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold">ব্যাংক হিসাবের স্থিতি (Bank Account)</td>
                  <td className="py-2.5 text-slate-500">Asset</td>
                  <td className="py-2.5 text-right font-bold">৳{metrics.bankBalance.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold">বাইরে বকেয়া ঋণের আসল (Loans Outside)</td>
                  <td className="py-2.5 text-slate-500">Receivable</td>
                  <td className="py-2.5 text-right font-bold">৳{metrics.moneyOutside.toLocaleString()}</td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                  <td className="py-3 text-amber-700 dark:text-amber-400">সর্বমোট কার্যকর তহবিল (Total Net Capital)</td>
                  <td className="py-3 text-slate-500">Total Equity</td>
                  <td className="py-3 text-right text-amber-700 dark:text-amber-400 text-sm">৳{totalFund.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Members Statement Content */}
        {reportType === 'members_statement' && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                  <th className="py-2.5">#</th>
                  <th className="py-2.5">{t.memberName}</th>
                  <th className="py-2.5">{t.phoneNumber}</th>
                  <th className="py-2.5">{t.status}</th>
                  <th className="py-2.5 text-right">{t.currentBalance}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {members.map((m, idx) => (
                  <tr key={`${m.systemId}-${idx}`}>
                    <td className="py-2.5 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">{m.name}</td>
                    <td className="py-2.5 text-slate-500 font-mono">{formatMemberPhone(m.phone, isAdmin)}</td>
                    <td className="py-2.5 uppercase text-[10px] font-bold text-emerald-600">{m.status}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                      ৳{(m.currentBalance || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800/40">
                  <td colSpan={4} className="py-3 text-right">
                    {language === 'bn' ? 'সর্বমোট সদস্য মূলধন:' : 'Total Members Capital:'}
                  </td>
                  <td className="py-3 text-right text-amber-600 text-sm">
                    ৳{metrics.totalMemberCapital.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 3. Loans Portfolio Content */}
        {reportType === 'loans_portfolio' && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                  <th className="py-2.5">{t.borrowerName}</th>
                  <th className="py-2.5">{t.loanDate}</th>
                  <th className="py-2.5 text-right">{t.principal}</th>
                  <th className="py-2.5 text-right">{t.remainingPrincipal}</th>
                  <th className="py-2.5 text-right">{language === 'bn' ? 'আদায়কৃত মুনাফা' : 'Profit Realized'}</th>
                  <th className="py-2.5 text-center">{t.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {language === 'bn' ? 'কোনো ঋণের রেকর্ড নেই।' : 'No loans on record.'}
                    </td>
                  </tr>
                ) : (
                  loans.map((l, idx) => (
                    <tr key={`${l.loanId}-${idx}`}>
                      <td className="py-2.5 font-bold text-slate-900 dark:text-white">{l.borrowerName}</td>
                      <td className="py-2.5 text-slate-500">{l.loanDate}</td>
                      <td className="py-2.5 text-right font-semibold">৳{l.principal.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-bold text-purple-600">৳{l.remainingPrincipal.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">৳{l.totalProfitPaid.toLocaleString()}</td>
                      <td className="py-2.5 text-center uppercase text-[10px] font-bold">{l.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800/40">
                  <td colSpan={3} className="py-3 text-right">
                    {language === 'bn' ? 'মোট বকেয়া আসল ও মোট মুনাফা:' : 'Total Outstanding & Total Profit:'}
                  </td>
                  <td className="py-3 text-right text-purple-600 text-sm">৳{metrics.moneyOutside.toLocaleString()}</td>
                  <td className="py-3 text-right text-emerald-600 text-sm">৳{metrics.totalLoanProfit.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 4. Income & Expense Content */}
        {reportType === 'income_expense' && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">
                {t.totalIncome}: ৳{metrics.totalIncome.toLocaleString()}
              </h3>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th className="py-2">{t.date}</th>
                    <th className="py-2">{t.category}</th>
                    <th className="py-2 text-right">{t.amount}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {incomes.map((inc, idx) => (
                    <tr key={`${inc.incomeId}-${idx}`}>
                      <td className="py-2 text-slate-500">{inc.date}</td>
                      <td className="py-2 font-medium">
                        {inc.categoryLabel ||
                          (inc.category === 'loan_profit'
                            ? language === 'bn'
                              ? 'পূর্ববর্তী ঋণের মুনাফা'
                              : 'Previous Loan Profit'
                            : inc.category)}
                      </td>
                      <td className="py-2 text-right font-bold text-teal-600">+৳{inc.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
                {t.totalExpense}: ৳{metrics.totalExpense.toLocaleString()}
              </h3>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th className="py-2">{t.date}</th>
                    <th className="py-2">{t.category}</th>
                    <th className="py-2 text-right">{t.amount}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.map((exp, idx) => (
                    <tr key={`${exp.expenseId}-${idx}`}>
                      <td className="py-2 text-slate-500">{exp.date}</td>
                      <td className="py-2 font-medium">{exp.category}</td>
                      <td className="py-2 text-right font-bold text-red-600">-৳{exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Signatures Area for Audit */}
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800 dark:text-slate-200">
              {t.rolePresident}
            </div>
            <span className="text-[10px] text-slate-400">{language === 'bn' ? 'স্বাক্ষর' : 'Signature'}</span>
          </div>
          <div>
            <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800 dark:text-slate-200">
              {t.roleSecretary}
            </div>
            <span className="text-[10px] text-slate-400">{language === 'bn' ? 'স্বাক্ষর' : 'Signature'}</span>
          </div>
          <div>
            <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800 dark:text-slate-200">
              {t.roleTreasurer}
            </div>
            <span className="text-[10px] text-slate-400">{language === 'bn' ? 'স্বাক্ষর' : 'Signature'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
