import React, { useState } from 'react';
import { Transaction, Language, UserAccount } from '../types';
import { getTranslation } from '../lib/translations';
import {
  BookOpen,
  Filter,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Calendar,
  Wallet,
  Building2,
} from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  currentUser: UserAccount;
  language: Language;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  currentUser,
  language,
}) => {
  const t = getTranslation(language);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'bank'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Deduplicate transactions strictly to avoid duplicate rows or inflated totals
  const uniqueTransactions = React.useMemo(() => {
    const seenTxIds = new Set<string>();
    const seenRefIds = new Set<string>();
    const seenSignatures = new Set<string>();

    // Sort to prioritize standard sequential TRX- IDs over synthetic TRX-C- prefixes
    const sorted = [...transactions].sort((a, b) => {
      const aIsSynthetic = a.transactionId?.includes('-C-') || a.transactionId?.includes('-P-') || a.transactionId?.includes('-L-') || a.transactionId?.includes('-I-') || a.transactionId?.includes('-E-') || a.transactionId?.includes('-W-');
      const bIsSynthetic = b.transactionId?.includes('-C-') || b.transactionId?.includes('-P-') || b.transactionId?.includes('-L-') || b.transactionId?.includes('-I-') || b.transactionId?.includes('-E-') || b.transactionId?.includes('-W-');
      if (aIsSynthetic !== bIsSynthetic) return aIsSynthetic ? 1 : -1;
      return (a.transactionId || '').localeCompare(b.transactionId || '');
    });

    return sorted.filter((trx) => {
      if (!trx || !trx.transactionId) return false;
      if (seenTxIds.has(trx.transactionId)) return false;

      const ref = trx.referenceId || trx.transactionId.replace(/^TRX-[CPLIEW]-/, '');
      if (ref && seenRefIds.has(ref)) return false;

      const monthMatch = trx.description?.match(/(\d{4}-\d{2})/);
      const monthKey = monthMatch ? monthMatch[1] : '';
      const sig = `${trx.type}|${trx.memberSystemId || trx.partyName?.trim().toLowerCase()}|${monthKey || trx.date}|${trx.credit}|${trx.debit}`;
      if (seenSignatures.has(sig)) return false;

      seenTxIds.add(trx.transactionId);
      if (ref) seenRefIds.add(ref);
      if (trx.referenceId) seenRefIds.add(trx.referenceId);
      seenSignatures.add(sig);
      return true;
    });
  }, [transactions]);

  const filtered = uniqueTransactions.filter((trx) => {
    const matchesSearch =
      trx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.transactionId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === 'all'
        ? true
        : filterType === 'credit'
        ? trx.credit > 0
        : trx.debit > 0;
    const matchesMethod =
      filterMethod === 'all' ? true : trx.paymentMethod === filterMethod;
    return matchesSearch && matchesType && matchesMethod;
  });

  const totalCredit = filtered.reduce((sum, trx) => sum + trx.credit, 0);
  const totalDebit = filtered.reduce((sum, trx) => sum + trx.debit, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block text-center pb-4 mb-4 border-b border-slate-300">
        <div className="text-xs font-bold text-amber-700">🕉️ ওঁ শ্রী শ্রী গুরুবে নমঃ</div>
        <h1 className="text-2xl font-black text-slate-900 mt-1">পাকুড়া সনাতন যুব সংঘ</h1>
        <p className="text-xs text-slate-600">কেন্দ্রীয় মাস্টার লেজার ও আর্থিক নিরীক্ষা বিবরণী (Official Master Ledger)</p>
        <div className="text-[11px] text-slate-500 mt-1">
          {language === 'bn' ? 'মুদ্রণ তারিখ:' : 'Printed on:'} {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'full' })} • 
          {language === 'bn' ? ' মোট এন্ট্রি:' : ' Total Entries:'} {filtered.length}
        </div>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>{language === 'bn' ? 'ব্যাংক হিসাব ও কেন্দ্রীয় লেজার ইন্টারফেস' : 'Bank Account & Ledger Interface'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'সংগঠনের অফিসিয়াল ব্যাংক হিসাব, নগদ তহবিল ও সকল লেনদেনের কেন্দ্রীয় অপরিবর্তনীয় খতিয়ান'
              : 'Official bank account, cash funds, and master transaction ledger'}
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500 flex items-center gap-2 shadow-2xs transition-all self-start sm:self-auto print:hidden cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>{language === 'bn' ? 'লেজার প্রিন্ট' : 'Print Ledger'}</span>
        </button>
      </div>

      {/* Official Bank Account Information Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-md border border-indigo-700/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-indigo-300 flex-shrink-0 border border-white/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">
                {language === 'bn' ? 'সমিতির অফিশিয়াল ব্যাংক একাউন্ট' : 'Official Bank Account'}
              </span>
              <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                ✓ {language === 'bn' ? 'সক্রিয় ও অনুমোদিত' : 'Verified & Active'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-1 text-white">
              {language === 'bn' ? 'সোনালী ব্যাংক পিএলসি (সঞ্চয়ী হিসাব)' : 'Sonali Bank PLC (Savings Account)'}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-indigo-200/90 mt-1">
              <span>{language === 'bn' ? 'হিসাব নম্বর:' : 'A/C No:'} <strong className="font-mono text-white">২০২৪-০১৮৮-৯১০১</strong></span>
              <span>•</span>
              <span>{language === 'bn' ? 'শাখা:' : 'Branch:'} <strong>পাকুড়া শাখা</strong></span>
              <span>•</span>
              <span>{language === 'bn' ? 'হিসাবের শিরোনাম:' : 'Title:'} <strong>পাকুড়া সনাতন যুব সংঘ</strong></span>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/20 text-right self-end md:self-auto min-w-[170px]">
          <span className="text-[11px] text-indigo-200 uppercase font-semibold tracking-wider block">
            {language === 'bn' ? 'ব্যাংক হিসাবে জমাকৃত স্থিতি' : 'Bank Balance'}
          </span>
          <span className="text-2xl font-black text-white block mt-0.5">
            ৳{uniqueTransactions.filter(t => t.paymentMethod === 'bank').reduce((sum, t) => sum + (t.credit - t.debit), 0).toLocaleString()}
          </span>
          <span className="text-[10px] text-indigo-200/80 block mt-0.5">
            {language === 'bn' ? 'স্বয়ংক্রিয় লেনদেন ভিত্তিক হিসাব' : 'Automated balance from transactions'}
          </span>
        </div>
      </div>

      {/* Metric Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 print:border-slate-300 print:p-2.5">
          <span className="text-xs text-slate-500 font-medium">
            {language === 'bn' ? 'মোট লেনদেন রেকর্ড' : 'Total Records'}
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 print:text-lg">
            {filtered.length}
          </div>
          <span className="text-[11px] text-slate-400">
            {language === 'bn' ? 'অডিটেড এন্ট্রি' : 'Audited Entries'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 print:border-slate-300 print:p-2.5">
          <span className="text-xs text-emerald-600 font-medium">
            {language === 'bn' ? 'মোট জমা (Inflows / Credit)' : 'Total Inflows'}
          </span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 print:text-lg">
            +৳{totalCredit.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {language === 'bn' ? 'সঞ্চয়, মুনাফা, আয়' : 'Savings, Profits, Incomes'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 print:border-slate-300 print:p-2.5">
          <span className="text-xs text-red-600 font-medium">
            {language === 'bn' ? 'মোট খরচ/বিতরণ (Outflows / Debit)' : 'Total Outflows'}
          </span>
          <div className="text-2xl font-bold text-red-600 mt-1 print:text-lg">
            -৳{totalDebit.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {language === 'bn' ? 'ঋণ বিতরণ, ব্যয়' : 'Loan Disbursements, Expenses'}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between print:hidden">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'বিবরণ বা আইডি দিয়ে খুঁজুন...' : 'Search ledger...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Credit/Debit filter */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              {language === 'bn' ? 'সকল' : 'All'}
            </button>
            <button
              onClick={() => setFilterType('credit')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterType === 'credit'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              {language === 'bn' ? 'জমা (+)' : 'Credit'}
            </button>
            <button
              onClick={() => setFilterType('debit')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterType === 'debit'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              {language === 'bn' ? 'খরচ (-)' : 'Debit'}
            </button>
          </div>

          {/* Cash/Bank filter */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setFilterMethod('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterMethod === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              {language === 'bn' ? 'নগদ+ব্যাংক' : 'Cash+Bank'}
            </button>
            <button
              onClick={() => setFilterMethod('cash')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterMethod === 'cash'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              {t.cash}
            </button>
            <button
              onClick={() => setFilterMethod('bank')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterMethod === 'bank'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              {t.bank}
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {language === 'bn'
                ? 'বর্তমানে কোনো লেনদেন রেকর্ড নেই। ডাটাবেজ ৳০-তে প্রস্তুত রয়েছে।'
                : 'No ledger transactions recorded yet.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="p-3 font-semibold">{t.date}</th>
                  <th className="p-3 font-semibold">{language === 'bn' ? 'ট্রানজেকশন আইডি' : 'Trx ID'}</th>
                  <th className="p-3 font-semibold">{language === 'bn' ? 'বিবরণ' : 'Description'}</th>
                  <th className="p-3 font-semibold">{t.paymentMethod}</th>
                  <th className="p-3 font-semibold text-right">{language === 'bn' ? 'জমা (Credit)' : 'Credit'}</th>
                  <th className="p-3 font-semibold text-right">{language === 'bn' ? 'খরচ (Debit)' : 'Debit'}</th>
                  <th className="p-3 font-semibold text-right">{language === 'bn' ? 'তহবিল স্থিতি' : 'Fund Balance'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filtered.map((trx, idx) => (
                  <tr key={`${trx.transactionId}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3 text-slate-500 whitespace-nowrap">{trx.date}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">#{trx.transactionId}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white max-w-sm">
                      {trx.description}
                    </td>
                    <td className="p-3 text-slate-500 uppercase whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                        {trx.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                      {trx.credit > 0 ? `+৳${trx.credit.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-3 text-right font-bold text-red-600 whitespace-nowrap">
                      {trx.debit > 0 ? `-৳${trx.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      ৳{trx.balanceAfter.toLocaleString()}
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
