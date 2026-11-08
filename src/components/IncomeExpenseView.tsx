import React, { useState } from 'react';
import { Income, Expense, Language, UserAccount, PaymentMethod } from '../types';
import { getTranslation } from '../lib/translations';
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Calendar,
  Wallet,
  Building2,
  Tag,
  Filter,
  X,
  Search,
} from 'lucide-react';

interface IncomeExpenseViewProps {
  type: 'income' | 'expense';
  items: (Income | Expense)[];
  currentUser: UserAccount;
  language: Language;
  onAddItem: (data: {
    amount: number;
    date: string;
    category: string;
    paymentMethod: PaymentMethod;
    person: string;
    note: string;
  }) => void;
}

export const IncomeExpenseView: React.FC<IncomeExpenseViewProps> = ({
  type,
  items,
  currentUser,
  language,
  onAddItem,
}) => {
  const t = getTranslation(language);
  const isIncome = type === 'income';

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>(
    isIncome ? 'অনুদান (Donation)' : 'মিটিং নাস্তা (Refreshments)'
  );
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [person, setPerson] = useState<string>(currentUser.displayName || 'Admin');
  const [note, setNote] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');

  const canManage = currentUser.role === 'admin';

  const incomeCategories = [
    'অনুদান (Donation)',
    'অনুষ্ঠান স্পন্সর (Sponsorship)',
    'সমিতির নিজস্ব মূলধন ও তহবিল (Association Capital/Funds)',
    'সদস্য ভর্তি ফি (Membership Admission)',
    'জরিমানা (Fine/Late Fee)',
    'ব্যাংক সুদ (Bank Interest)',
    'বিবিধ আয় (Miscellaneous)',
    'অন্যান্য খাত (Other Income)',
  ];

  const expenseCategories = [
    'গ্যাস ও জ্বালানি বিল (Gas & Utility Bills)',
    'বিদ্যুৎ ও পানি বিল (Electricity & Water Bills)',
    'অফিস ও ঘর ভাড়া (Office Rent)',
    'জার্সি ও টি-শার্ট ক্রয় (Jerseys & T-Shirts)',
    'মিটিং নাস্তা ও আপ্যায়ন (Refreshments)',
    'কাগজপত্র ও প্রিন্টিং (Stationery & Print)',
    'পূজা ও ধর্মীয় উৎসব (Religious Festival)',
    'দান ও সামাজিক সহায়তা (Charity & Social)',
    'যোগাযোগ ও পরিবহন (Transport/Comm)',
    'বিবিধ খরচ (Miscellaneous)',
    'অন্যান্য খাত (Other Expense)',
  ];

  const categories = isIncome ? incomeCategories : expenseCategories;

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.category.toLowerCase().includes(q) ||
      (item.person && item.person.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q)) ||
      item.paymentMethod.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCategory = category.startsWith('অন্যান্য') && customCategory.trim()
      ? customCategory.trim()
      : category;
    if (amount <= 0 || !effectiveCategory) return;
    onAddItem({
      amount,
      date,
      category: effectiveCategory,
      paymentMethod: method,
      person: person.trim(),
      note: note.trim(),
    });
    setAmount(0);
    setCustomCategory('');
    setNote('');
    setShowModal(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {isIncome ? (
              <ArrowDownRight className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            ) : (
              <ArrowUpRight className="w-6 h-6 text-red-600 dark:text-red-400" />
            )}
            <span>{isIncome ? t.navIncome : t.navExpenses}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isIncome
              ? language === 'bn'
                ? 'সংগঠনের অনুদান, স্পন্সর ও অন্যান্য খাতের আয় ব্যবস্থাপনা'
                : 'Manage organization donations, sponsorships and extra inflows'
              : language === 'bn'
              ? 'পূজা উৎসব, আপ্যায়ন, স্টেশনারি ও প্রাতিষ্ঠানিক সকল খরচের হিসাব'
              : 'Track festival costs, refreshment, printing and institutional expenses'}
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-xs transition-all ${
              isIncome
                ? 'bg-teal-600 hover:bg-teal-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isIncome ? t.addIncome : t.addExpense}</span>
          </button>
        )}
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isIncome ? t.totalIncome : t.totalExpense}
          </span>
          <div
            className={`text-2xl font-bold mt-1 ${
              isIncome ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            ৳{totalAmount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {items.length} {language === 'bn' ? 'টি এন্ট্রি লিপিবদ্ধ' : 'records registered'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1.5">
              {language === 'bn' ? 'ক্যাটাগরি ও বিবরণ সন্ধান' : 'Search & Filter'}
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">{language === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'ব্যক্তি বা বিবরণে খুঁজুন...' : 'Search by person or note...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table of Records */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {isIncome ? (language === 'bn' ? 'আয়ের তালিকা' : 'Income List') : (language === 'bn' ? 'ব্যয়ের তালিকা' : 'Expense List')}
          </span>
        </div>

        <div className="overflow-x-auto">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {language === 'bn' ? 'কোনো রেকর্ড পাওয়া যায়নি।' : 'No entries found.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                  <th className="p-3 font-medium">{t.date}</th>
                  <th className="p-3 font-medium">{t.category}</th>
                  <th className="p-3 font-medium">{isIncome ? (language === 'bn' ? 'গ্রহীতা' : 'Received By') : (language === 'bn' ? 'ব্যয়কারী' : 'Paid By')}</th>
                  <th className="p-3 font-medium">{t.paymentMethod}</th>
                  <th className="p-3 font-medium">{language === 'bn' ? 'বিবরণ/মন্তব্য' : 'Notes'}</th>
                  <th className="p-3 font-medium text-right">{t.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredItems.map((item: any, idx: number) => (
                  <tr key={item.incomeId ? `inc-${item.incomeId}-${idx}` : item.expenseId ? `exp-${item.expenseId}-${idx}` : `item-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3 text-slate-500">{item.date}</td>
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                      {item.category}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {item.receivedBy || item.paidBy || '—'}
                    </td>
                    <td className="p-3 text-slate-500 uppercase">{item.paymentMethod}</td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{item.notes || '—'}</td>
                    <td
                      className={`p-3 text-right font-bold ${
                        isIncome ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isIncome ? '+' : '-'}৳{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Add Record */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {isIncome ? t.addIncome : t.addExpense}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.amount} (৳) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.category} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.date} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {category.startsWith('অন্যান্য') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'কাস্টম খাতের নাম লিখুন' : 'Enter Custom Category Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={language === 'bn' ? 'যেমন: গ্যাস ও জ্বালানি বিল' : 'e.g., Gas & Utility Bills'}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isIncome ? (language === 'bn' ? 'আদায়কারী / জমাকারী' : 'Received By') : (language === 'bn' ? 'ব্যয়কারী / অনুমোদনকারী' : 'Paid By / Authorized By')}
                </label>
                <input
                  type="text"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      method === 'cash'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      method === 'bank'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{t.bank}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'বিস্তারিত বিবরণ' : 'Description / Notes'}
                </label>
                <input
                  type="text"
                  placeholder="যেমন: বার্ষিক সভার নাস্তা বাবদ"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white ${
                    isIncome ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
