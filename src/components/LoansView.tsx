import React, { useState } from 'react';
import {
  Loan,
  Borrower,
  LoanPayment,
  Contribution,
  Language,
  UserAccount,
  PaymentMethod,
  Member,
  ProfitDistribution,
  ExpenseRecord,
} from '../types';
import { getTranslation } from '../lib/translations';
import { StorageService } from '../lib/storage';
import {
  CreditCard,
  Plus,
  ArrowDownRight,
  TrendingUp,
  User,
  Clock,
  CheckCircle2,
  Calendar,
  Wallet,
  Building2,
  History,
  X,
  Search,
  ShieldCheck,
  Receipt,
  Coins,
  Sparkles,
  PieChart,
  ArrowRight,
  Sliders,
  AlertCircle,
  Tag,
  Percent,
} from 'lucide-react';

interface LoansViewProps {
  loans: Loan[];
  borrowers: Borrower[];
  payments: LoanPayment[];
  contributions?: Contribution[];
  members?: Member[];
  distributions?: ProfitDistribution[];
  expenses?: ExpenseRecord[];
  currentUser: UserAccount;
  language: Language;
  onCreateLoan: (
    borrowerName: string,
    borrowerPhone: string,
    borrowerNid: string,
    principal: number,
    loanDate: string,
    method: PaymentMethod
  ) => void;
  onReceivePayment: (
    loanId: string,
    amount: number,
    date: string,
    method: PaymentMethod,
    notes: string,
    discount?: number
  ) => void;
  onRecordRepaidLoan?: (params: {
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
  }) => void;
  onViewReceipt: (receiptId: string) => void;
  onAllocateProfit?: (params: {
    periodType: 'monthly' | 'yearly' | 'custom';
    periodLabel: string;
    percentage?: number;
    fixedAmountPerMember?: number;
    distributionMethod: 'equal' | 'proportional';
    notes?: string;
    allocationDate?: string;
  }) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  loans,
  borrowers,
  payments,
  contributions = [],
  members = [],
  distributions = [],
  expenses = [],
  currentUser,
  language,
  onCreateLoan,
  onReceivePayment,
  onRecordRepaidLoan,
  onViewReceipt,
  onAllocateProfit,
}) => {
  const t = getTranslation(language);
  const [activeTab, setActiveTab] = useState<'active' | 'payments' | 'borrowers' | 'paid' | 'profit_distribution'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. New Loan Disbursement Modal
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [bName, setBName] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bNid, setBNid] = useState('');
  const [principal, setPrincipal] = useState<number>(10000);
  const [loanDate, setLoanDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loanMethod, setLoanMethod] = useState<PaymentMethod>('cash');

  // 2. Receive Payment Modal (with Interest Discount / Concession support)
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payDiscount, setPayDiscount] = useState<number>(0);

  // 3. Record Already Repaid Loan Modal
  const [showRepaidModal, setShowRepaidModal] = useState(false);
  const [repaidBName, setRepaidBName] = useState('');
  const [repaidBPhone, setRepaidBPhone] = useState('');
  const [repaidBNid, setRepaidBNid] = useState('');
  const [repaidPrincipal, setRepaidPrincipal] = useState<number>(7000);
  const [repaidLoanDate, setRepaidLoanDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 35);
    return d.toISOString().split('T')[0];
  });
  const [repaidRepaymentDate, setRepaidRepaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [repaidAccruedProfit, setRepaidAccruedProfit] = useState<number>(729);
  const [repaidDiscount, setRepaidDiscount] = useState<number>(29);
  const [repaidMethod, setRepaidMethod] = useState<PaymentMethod>('cash');
  const [repaidNotes, setRepaidNotes] = useState<string>('');

  // 4. Borrower Lifetime History Modal
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);

  // 5. Profit Distribution Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocPeriodType, setAllocPeriodType] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
  const [allocYear, setAllocYear] = useState<number>(new Date().getFullYear());
  const [allocMonth, setAllocMonth] = useState<number>(new Date().getMonth() + 1);
  const [allocCustomLabel, setAllocCustomLabel] = useState<string>('');
  const [allocSpecificDate, setAllocSpecificDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [allocMode, setAllocMode] = useState<'fixed_equal' | 'percentage'>('fixed_equal');
  const [allocFixedAmount, setAllocFixedAmount] = useState<number>(500);
  const [allocPercentage, setAllocPercentage] = useState<number>(50);
  const [allocMethod, setAllocMethod] = useState<'equal' | 'proportional'>('equal');
  const [allocNotes, setAllocNotes] = useState<string>('');
  const [allocSuccessMessage, setAllocSuccessMessage] = useState<string | null>(null);
  const [allocErrorMessage, setAllocErrorMessage] = useState<string | null>(null);

  const canManage = currentUser.role === 'admin';

  const activeLoans = loans.filter((l) => l.status === 'active');
  const paidLoans = loans.filter((l) => l.status === 'paid');

  const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.remainingPrincipal || 0), 0);
  const totalLateFees = contributions.reduce((sum, c) => sum + (c.lateFee || 0), 0);
  const loanProfitOnly = loans.reduce((sum, l) => sum + (l.totalProfitPaid || 0), 0);
  const grossLoanProfit = loanProfitOnly + totalLateFees;

  // Association Expenses (Jerseys, T-Shirts, Puja, Events, Office, etc.) deducted solely from total loan profit
  const expenseRecords = expenses.length > 0 ? expenses : StorageService.getExpenseRecords();
  const totalExpenses = expenseRecords.reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalDistributedSoFar = distributions.reduce((sum, d) => sum + (d.totalAllocatedAmount || 0), 0);
  const netLoanProfitAvailable = Math.max(0, grossLoanProfit - totalExpenses - totalDistributedSoFar);

  const activeMembersList = members.filter((m) => m.status === 'active');
  const myLinkedMembers = StorageService.getLinkedMembersForUser(currentUser, members);
  const myProfitShare = myLinkedMembers.reduce((sum, m) => sum + (m.profitShareBalance || 0), 0);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim() || !bPhone.trim() || principal <= 0) return;
    onCreateLoan(bName.trim(), bPhone.trim(), bNid.trim(), principal, loanDate, loanMethod);
    setBName('');
    setBPhone('');
    setBNid('');
    setPrincipal(10000);
    setShowNewLoanModal(false);
  };

  const openPaymentModal = (loan: Loan) => {
    setPayingLoan(loan);
    setPayDiscount(0);
    const live = StorageService.calculateLoanLiveProfit(loan, payDate);
    // Suggest accrued profit + principal or standard amount
    setPayAmount(Math.round(live.accruedProfit || (loan.remainingPrincipal * 0.1)));
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLoan || payAmount <= 0) return;
    onReceivePayment(payingLoan.loanId, payAmount, payDate, payMethod, payNotes, payDiscount);
    setPayingLoan(null);
    setPayNotes('');
    setPayDiscount(0);
  };

  const handleRepaidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repaidBName.trim() || !repaidBPhone.trim() || repaidPrincipal <= 0) return;
    const effDiscount = Math.max(0, Math.min(repaidDiscount || 0, repaidAccruedProfit));
    if (onRecordRepaidLoan) {
      onRecordRepaidLoan({
        borrowerName: repaidBName.trim(),
        borrowerPhone: repaidBPhone.trim(),
        borrowerNid: repaidBNid.trim(),
        principal: repaidPrincipal,
        loanDate: repaidLoanDate,
        repaymentDate: repaidRepaymentDate,
        accruedProfit: repaidAccruedProfit,
        discount: effDiscount,
        paymentMethod: repaidMethod,
        notes: repaidNotes.trim(),
      });
    } else {
      StorageService.recordAlreadyRepaidLoan({
        borrowerName: repaidBName.trim(),
        borrowerPhone: repaidBPhone.trim(),
        borrowerNid: repaidBNid.trim(),
        principal: repaidPrincipal,
        loanDate: repaidLoanDate,
        repaymentDate: repaidRepaymentDate,
        accruedProfit: repaidAccruedProfit,
        discount: effDiscount,
        paymentMethod: repaidMethod,
        notes: repaidNotes.trim(),
        currentUserOrName: currentUser,
      });
    }
    setShowRepaidModal(false);
    setRepaidBName('');
    setRepaidBPhone('');
    setRepaidBNid('');
    setRepaidNotes('');
  };

  const handleConfirmAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    setAllocErrorMessage(null);
    if (grossLoanProfit <= 0) {
      setAllocErrorMessage(
        language === 'bn'
          ? 'বন্টন করার মতো কোনো ঋণ মুনাফা বর্তমানে অর্জিত হয়নি (মোট ঋণ মুনাফা ৳০)।'
          : 'No loan profit available to distribute currently (Total profit is ৳0).'
      );
      return;
    }
    if (activeMembersList.length === 0) {
      setAllocErrorMessage(
        language === 'bn'
          ? 'কোনো সক্রিয় সাধারণ সদস্য নেই।'
          : 'No active general members found.'
      );
      return;
    }

    let calculatedAmt = 0;
    if (allocMode === 'fixed_equal') {
      if (allocFixedAmount <= 0) {
        setAllocErrorMessage(
          language === 'bn'
            ? 'সদস্য প্রতি বরাদ্দকৃত টাকার পরিমাণ দিন (কমপক্ষে ৳১)।'
            : 'Enter valid amount per member.'
        );
        return;
      }
      calculatedAmt = allocFixedAmount * activeMembersList.length;
    } else {
      calculatedAmt = Math.round((netLoanProfitAvailable * allocPercentage) / 100);
    }

    let label = allocCustomLabel.trim();
    if (allocPeriodType === 'monthly') {
      const monthNames =
        language === 'bn'
          ? [
              'জানুয়ারি',
              'ফেব্রুয়ারি',
              'মার্চ',
              'এপ্রিল',
              'মে',
              'জুন',
              'জুলাই',
              'আগস্ট',
              'সেপ্টেম্বর',
              'অক্টোবর',
              'নভেম্বর',
              'ডিসেম্বর',
            ]
          : [
              'January',
              'February',
              'March',
              'April',
              'May',
              'June',
              'July',
              'August',
              'September',
              'October',
              'November',
              'December',
            ];
      label = `${monthNames[allocMonth - 1]} ${allocYear} (${language === 'bn' ? 'মাসিক' : 'Monthly'})`;
    } else if (allocPeriodType === 'yearly') {
      label = `${allocYear} ${language === 'bn' ? 'সাল (বার্ষিক)' : 'Annual'}`;
    } else if (!label) {
      label = language === 'bn' ? `${allocSpecificDate} তারিখের বন্টন` : `Allocation on ${allocSpecificDate}`;
    }

    if (onAllocateProfit) {
      onAllocateProfit({
        periodType: allocPeriodType,
        periodLabel: label,
        percentage: allocMode === 'percentage' ? allocPercentage : undefined,
        fixedAmountPerMember: allocMode === 'fixed_equal' ? allocFixedAmount : undefined,
        distributionMethod: allocMethod,
        notes: allocNotes.trim() || undefined,
        allocationDate: allocSpecificDate,
      });
    }

    setShowAllocateModal(false);
    setAllocSuccessMessage(
      language === 'bn'
        ? `মোট ৳${calculatedAmt.toLocaleString()} ঋণ লভ্যাংশ সফলভাবে ${activeMembersList.length} জন সদস্যের অ্যাকাউন্টে সমহারে যোগ করা হয়েছে!`
        : `Successfully allocated ৳${calculatedAmt.toLocaleString()} loan profit to ${activeMembersList.length} members!`
    );
    setTimeout(() => setAllocSuccessMessage(null), 6000);
  };

  const handleOpenAllocateModal = () => {
    setAllocErrorMessage(null);
    setShowAllocateModal(true);
  };

  // Filtered lists
  const filteredActiveLoans = activeLoans.filter(
    (l) =>
      l.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.borrowerPhone.includes(searchQuery)
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>{t.navLoans}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'বাইরের ঋণগ্রহীতাদের ঋণ বিতরণ, ১০% মাসিক মুনাফার দৈনিক হিসাব ও আদায়'
              : 'Borrower loan disbursement, 10% monthly calculated return & collections'}
          </p>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowRepaidModal(true)}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{language === 'bn' ? 'ইতিমধ্যে পরিশোধিত ঋণ রেকর্ড করুন' : 'Record Repaid Loan'}</span>
            </button>
            <button
              onClick={() => setShowNewLoanModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.createLoan}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-medium text-purple-700 dark:text-purple-300">
            <ShieldCheck className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span>
              {language === 'bn'
                ? 'সদস্য পরিদর্শন: ঋণগ্রহীতা ও বকেয়া স্থিতি বিবরণী'
                : 'Member View: Borrowers & Outstanding Balances'}
            </span>
          </div>
        )}
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 font-medium">
            {language === 'bn' ? 'চলমান সক্রিয় ঋণ' : 'Active Running Loans'}
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {activeLoans.length} {language === 'bn' ? 'টি' : 'loans'}
          </div>
          <span className="text-[11px] text-slate-400">
            {borrowers.length} {language === 'bn' ? 'জন নিবন্ধিত গ্রহীতা' : 'borrowers registered'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-purple-600 font-medium">
            {t.moneyOutside}
          </span>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            ৳{totalOutstanding.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {language === 'bn' ? 'চলমান ঋণের অবশিষ্ট মূলধন' : 'Total outstanding principal'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 font-medium">
                {canManage
                  ? (language === 'bn' ? 'অবশিষ্ট নিট ঋণ মুনাফা' : 'Net Loan Profit Reserve')
                  : (language === 'bn' ? 'আমার অর্জিত ঋণ লভ্যাংশ' : 'My Loan Profit Dividend')}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                {canManage ? 'ব্যয় কর্তন সমন্বিত' : (language === 'bn' ? 'ব্যক্তিগত লভ্যাংশ' : 'Personal Dividend')}
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {canManage
                ? `৳${netLoanProfitAvailable.toLocaleString()}`
                : `৳${myProfitShare.toLocaleString()}`}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {canManage
                ? (language === 'bn'
                    ? `মোট মুনাফা ৳${grossLoanProfit.toLocaleString()} | সমিতি ব্যয় কর্তন ৳${totalExpenses.toLocaleString()}`
                    : `Gross ৳${grossLoanProfit.toLocaleString()} | Expenses Deducted ৳${totalExpenses.toLocaleString()}`)
                : (language === 'bn'
                    ? 'আপনার অ্যাকাউন্টে যোগ হওয়া নিজস্ব ঋণ মুনাফা লভ্যাংশ স্থিতি'
                    : 'Personal loan profit dividend credited to your account')}
            </span>
          </div>

          {canManage ? (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'bn' ? 'সদস্য একাউন্টে বন্টন:' : 'Member Dividend:'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profit_distribution');
                  handleOpenAllocateModal();
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'মুনাফা বন্টন করুন →' : 'Allocate Profit →'}</span>
              </button>
            </div>
          ) : (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'bn' ? 'হিসাব স্থিতি:' : 'Status:'}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {language === 'bn' ? 'সক্রিয় হিসাব ✓' : 'Active Account ✓'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'active'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'bn' ? 'চলমান ঋণ' : 'Active Loans'} ({activeLoans.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'payments'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'bn' ? 'আদায়ের খতিয়ান' : 'Payment History'} ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('borrowers')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'borrowers'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'bn' ? 'ঋণগ্রহীতাগণ' : 'Borrowers'} ({borrowers.length})
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'paid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'bn' ? 'পরিশোধিত ঋণ' : 'Paid Loans'} ({paidLoans.length})
          </button>
          {canManage && (
            <button
              onClick={() => setActiveTab('profit_distribution')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'profit_distribution'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'সদস্য মুনাফা বন্টন' : 'Member Profit Allocation'}</span>
              {distributions.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'profit_distribution' ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
                }`}>
                  {distributions.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'গ্রহীতার নাম/ফোন...' : 'Search borrower...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Tab 1: Active Loans List with Live Continuous Profit Calculation */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {filteredActiveLoans.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              {language === 'bn' ? 'বর্তমানে কোনো সক্রিয় ঋণ নেই।' : 'No active loans running.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredActiveLoans.map((loan, idx) => {
                const live = StorageService.calculateLoanLiveProfit(loan);

                return (
                  <div
                    key={`${loan.loanId}-${idx}`}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-400 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Borrower info and badge */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {loan.borrowerName}
                          </h3>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {loan.borrowerPhone} • {language === 'bn' ? 'প্রদান:' : 'Issued:'} {loan.loanDate}
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                          {language === 'bn' ? 'চলমান ঋণ' : 'Active'}
                        </span>
                      </div>

                      {/* Live calculation breakdown */}
                      <div className="mt-4 grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400">{t.remainingPrincipal}</span>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                            ৳{loan.remainingPrincipal.toLocaleString()}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            ({language === 'bn' ? 'আসল ছিল ৳' : 'orig: ৳'}{loan.principal.toLocaleString()})
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                            {t.accruedProfit}
                          </span>
                          <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                            +৳{live.accruedProfit.toLocaleString()}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {live.daysElapsed} {language === 'bn' ? 'দিন অতিক্রান্ত' : 'days'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-emerald-600 font-semibold">{t.totalDueNow}</span>
                          <div className="text-sm font-bold text-emerald-600 mt-0.5">
                            ৳{live.totalDueNow.toLocaleString()}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {language === 'bn' ? 'আসল + মুনাফা' : 'Principal + Return'}
                          </span>
                        </div>
                      </div>

                      {/* Accurate Calendar Duration and Month Days Breakdown */}
                      <div className="mt-3 p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            <span>{language === 'bn' ? 'মেয়াদ হিসাব:' : 'Duration:'}</span>
                          </span>
                          <span className="font-bold text-purple-700 dark:text-purple-300 text-[11px]">
                            {language === 'bn' ? live.durationTextBn : live.durationTextEn}
                          </span>
                        </div>

                        {live.monthBreakdown && live.monthBreakdown.length > 0 && (
                          <div className="mt-2 pt-1.5 border-t border-purple-100 dark:border-purple-900/30 space-y-1">
                            {live.monthBreakdown.map((mb, mIdx) => (
                              <div
                                key={mIdx}
                                className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400"
                              >
                                <span>{language === 'bn' ? mb.periodLabelBn : mb.periodLabelEn}</span>
                                <span className="font-semibold text-purple-700 dark:text-purple-300">
                                  +৳{mb.profit.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        {language === 'bn' ? 'আদায়কৃত মুনাফা:' : 'Paid Profit:'} ৳{loan.totalProfitPaid.toLocaleString()}
                      </div>

                      {canManage && (
                        <button
                          onClick={() => openPaymentModal(loan)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all flex items-center gap-1.5"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>{t.receivePayment}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Loan Payments History */}
      {activeTab === 'payments' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {language === 'bn' ? 'ঋণ কিস্তি ও আদায়ের সম্পূর্ণ খতিয়ান' : 'Loan Repayments History'} ({payments.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            {payments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                {language === 'bn' ? 'এখনো কোনো ঋণের কিস্তি আদায় রেকর্ড হয়নি।' : 'No payment history yet.'}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <th className="p-3 font-medium">{t.date}</th>
                    <th className="p-3 font-medium">{t.borrowerName}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'মুনাফা আদায়' : 'Profit Paid'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'আসল আদায়' : 'Principal Paid'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'মোট আদায়' : 'Total Paid'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'বকেয়া আসল' : 'Remaining'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'রশিদ' : 'Receipt'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {payments.map((p, idx) => (
                    <tr key={`${p.paymentId}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-500">{p.paymentDate}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {p.borrowerName}
                      </td>
                      <td className="p-3 text-right font-semibold text-purple-600">
                        ৳{p.profitPaid.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-semibold text-blue-600">
                        ৳{p.principalPaid.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600">
                        +৳{p.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                        ৳{p.remainingPrincipalAfter.toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onViewReceipt(p.receiptId)}
                          className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                        >
                          #{p.receiptId}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Borrowers Directory */}
      {activeTab === 'borrowers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {borrowers.map((b, idx) => {
            const borrowerLoans = loans.filter((l) => l.borrowerId === b.borrowerId);
            const activeLoan = borrowerLoans.find((l) => l.status === 'active');
            const totalPrincipal = borrowerLoans.reduce((sum, l) => sum + l.principal, 0);
            const totalProfit = borrowerLoans.reduce((sum, l) => sum + l.totalProfitPaid, 0);

            return (
              <div
                key={`${b.borrowerId}-${idx}`}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {b.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      activeLoan
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {activeLoan ? (language === 'bn' ? 'চলমান ঋণ' : 'Active') : (language === 'bn' ? 'ক্লিয়ার' : 'Clear')}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  <div>{t.phoneNumber}: {b.phone}</div>
                  {b.nid && <div className="text-slate-400">NID: {b.nid}</div>}
                </div>

                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{language === 'bn' ? 'মোট ঋণ নিয়েছেন:' : 'Total Borrowed:'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">৳{totalPrincipal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-400">{language === 'bn' ? 'মোট মুনাফা দিয়েছেন:' : 'Total Profit Paid:'}</span>
                    <span className="font-bold text-emerald-600">৳{totalProfit.toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => setSelectedBorrower(b)}
                    className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'লাইফটাইম ইতিহাস' : 'Lifetime History'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 4: Paid Loans Archive */}
      {activeTab === 'paid' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                {language === 'bn' ? 'সম্পূর্ণ পরিশোধিত ঋণের আর্কাইভ ও পূর্ববর্তী রেকর্ড' : 'Fully Paid Loans Archive & Historical Records'} ({paidLoans.length})
              </span>
              <span className="text-[11px] text-slate-400">
                {language === 'bn'
                  ? 'ইতিমধ্যে পরিশোধিত পূর্ববর্তী ঋণ এবং সিস্টেমে পরিশোধ সম্পন্ন হওয়া সকল ঋণের সম্পূর্ণ বিবরণ'
                  : 'Historical repaid loans and completed loans with principal, profit and discounts'}
              </span>
            </div>

            {canManage && (
              <button
                onClick={() => setShowRepaidModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'ইতিমধ্যে পরিশোধিত ঋণ রেকর্ড করুন' : 'Record Repaid Loan'}</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            {paidLoans.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                {language === 'bn' ? 'এখনো কোনো ঋণ সম্পূর্ণ পরিশোধিত হিসেবে সমাপ্ত হয়নি।' : 'No paid loans yet.'}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <th className="p-3 font-medium">{language === 'bn' ? 'ঋণ আইডি' : 'Loan ID'}</th>
                    <th className="p-3 font-medium">{t.borrowerName}</th>
                    <th className="p-3 font-medium">{language === 'bn' ? 'বিতরণ ও পরিশোধ' : 'Disbursed & Repaid'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'আসল' : 'Principal'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'পরিশোধিত মুনাফা' : 'Profit Paid'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'মুনাফায় ছাড়' : 'Discount'}</th>
                    <th className="p-3 font-medium text-right">{language === 'bn' ? 'সর্বমোট আদায়' : 'Total Repaid'}</th>
                    <th className="p-3 font-medium text-center">{t.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paidLoans.map((l, idx) => {
                    const totalRepaid = (l.principal || 0) + (l.totalProfitPaid || 0);
                    return (
                      <tr key={`${l.loanId}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <span className="font-mono text-slate-500">#{l.loanId}</span>
                          {l.isHistoricalRepaid && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {language === 'bn' ? 'ইতিমধ্যে পরিশোধিত' : 'Historical'}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{l.borrowerName}</div>
                          <div className="text-[10px] text-slate-400">{l.borrowerPhone}</div>
                        </td>
                        <td className="p-3 text-slate-500 text-[11px]">
                          <div>বিতরণ: {l.loanDate}</div>
                          <div className="text-emerald-600 font-medium">পরিশোধ: {l.repaidDate || l.loanDate}</div>
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                          ৳{l.principal.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-bold text-purple-600 dark:text-purple-400">
                          ৳{l.totalProfitPaid.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {l.totalDiscountGiven && l.totalDiscountGiven > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px]">
                              -৳{l.totalDiscountGiven.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ৳{totalRepaid.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            {t.paid} ✓
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Loan Profit Distribution to General Members */}
      {activeTab === 'profit_distribution' && (
        <div className="space-y-4">
          {/* Top Banner & Action */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-md relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold">
                  <Coins className="w-4 h-4 text-amber-300" />
                  <span>{language === 'bn' ? 'ঋণ লভ্যাংশ বন্টন ও সদস্য তহবিল বরাদ্দ' : 'Loan Profit Distribution & Member Dividend'}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mt-1 tracking-tight">
                  {language === 'bn' ? 'সদস্য একাউন্টে ঋণ মুনাফা বন্টন' : 'Distribute Loan Profits to Members'}
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
                  {language === 'bn'
                    ? 'ঋণ থেকে অর্জিত মোট মুনাফা যেকোনো সময় নির্দিষ্ট শতকরা হারে (মাসিক বা বার্ষিক ভিত্তিতে) সাধারণ সদস্যদের একাউন্টে যুক্ত করতে পারবেন। সদস্যরা এই তহবিল থেকে নির্দিষ্ট পরিমাণ অর্থ উত্তোলনও করতে পারবেন।'
                    : 'Allocate any percentage of total realized loan profits to general members at any time on a monthly or yearly basis. Members can also withdraw a limited portion of their funds.'}
                </p>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={handleOpenAllocateModal}
                  className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{language === 'bn' ? 'নতুন লভ্যাংশ বন্টন করুন' : 'New Profit Allocation'}</span>
                </button>
              )}
            </div>
          </div>

          {allocSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{allocSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setAllocSuccessMessage(null)}
                className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                {language === 'bn' ? 'মোট অর্জিত ঋণ মুনাফা' : 'Total Gross Loan Profit'}
              </span>
              <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                ৳{grossLoanProfit.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'bn' ? 'ঋণ মুনাফা ও বিলম্ব ফি' : 'Loan profit & late fees'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wide block">
                {language === 'bn' ? 'সংগঠন ব্যয় কর্তন' : 'Association Expenses'}
              </span>
              <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                -৳{totalExpenses.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'bn' ? 'জার্সি, টি-শার্ট ও অন্যান্য খরচ' : 'Jerseys, T-shirts & other costs'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide block">
                {language === 'bn' ? 'বন্টনযোগ্য নিট মুনাফা' : 'Net Available Profit'}
              </span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                ৳{netLoanProfitAvailable.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'bn' ? 'খরচ কর্তন পরবর্তী অবশিষ্ট' : 'Remaining after deductions'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide block">
                {language === 'bn' ? 'বন্টিত লভ্যাংশ তহবিল' : 'Total Distributed'}
              </span>
              <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                ৳{totalDistributedSoFar.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {distributions.length} {language === 'bn' ? 'টি বন্টন সম্পন্ন' : 'cycles completed'}
              </span>
            </div>
          </div>

          {/* History of Profit Distributions */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'bn' ? 'পূর্ববর্তী লভ্যাংশ বন্টনের খতিয়ান' : 'Distribution History'}
                </h4>
              </div>
              <span className="text-xs text-slate-400">
                {distributions.length} {language === 'bn' ? 'টি রেকর্ড' : 'records'}
              </span>
            </div>

            {distributions.length === 0 ? (
              <div className="py-12 text-center p-6 text-slate-400">
                <Coins className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {language === 'bn' ? 'এখনো কোনো ঋণ মুনাফা সদস্যদের মধ্যে বন্টন করা হয়নি' : 'No profit distributions recorded yet'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {language === 'bn'
                    ? 'উপরে "নতুন লভ্যাংশ বন্টন করুন" বোতামে চাপ দিয়ে যেকোনো সময় মাসিক বা বার্ষিক ভিত্তিতে মুনাফার নির্দিষ্ট শতাংশ সাধারণ সদস্যদের একাউন্টে যোগ করতে পারেন।'
                    : 'Click "New Profit Allocation" above to allocate loan profit to members on a monthly or yearly basis.'}
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={handleOpenAllocateModal}
                    className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'প্রথম মুনাফা বন্টন শুরু করুন' : 'Start First Allocation'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="p-3.5">{language === 'bn' ? 'বন্টন আইডি' : 'Dist ID'}</th>
                      <th className="p-3.5">{language === 'bn' ? 'তারিখ' : 'Date'}</th>
                      <th className="p-3.5">{language === 'bn' ? 'চক্র / মেয়াদ' : 'Period'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'বন্টন হার (%)' : 'Rate (%)'}</th>
                      <th className="p-3.5 text-right">{language === 'bn' ? 'মোট বন্টিত তহবিল' : 'Total Amount'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'সদস্য সংখ্যা' : 'Members'}</th>
                      <th className="p-3.5 text-right">{language === 'bn' ? 'প্রতি সদস্যের বরাদ্দ' : 'Per Member'}</th>
                      <th className="p-3.5">{language === 'bn' ? 'পদ্ধতি' : 'Method'}</th>
                      <th className="p-3.5">{language === 'bn' ? 'অনুমোদনকারী' : 'Allocated By'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {distributions.map((d) => (
                      <tr key={d.distributionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3.5 font-mono text-slate-500">#{d.distributionId}</td>
                        <td className="p-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{d.date}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.periodType === 'yearly'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {d.periodType === 'yearly' ? (language === 'bn' ? 'বার্ষিক' : 'Yearly') : (language === 'bn' ? 'মাসিক' : 'Monthly')}
                            </span>
                            <span>{d.periodLabel}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="font-extrabold text-amber-600 dark:text-amber-400">
                            {d.percentage}%
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          ৳{d.totalAllocatedAmount.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {d.memberCount} {language === 'bn' ? 'জন' : ''}
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ৳{d.amountPerMember.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {d.distributionMethod === 'proportional'
                            ? (language === 'bn' ? 'সঞ্চয়ের অনুপাত' : 'Proportional')
                            : (language === 'bn' ? 'সমান বন্টন' : 'Equal')}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                          {d.allocatedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: New Loan Form */}
      {showNewLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {t.createLoan}
              </h3>
              <button
                onClick={() => setShowNewLoanModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.borrowerName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: অনিল সাহা"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.borrowerPhone} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="যেমন: 018XXXXXXXX"
                  value={bPhone}
                  onChange={(e) => setBPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.borrowerNid} ({language === 'bn' ? 'গোপনীয়' : 'Confidential'})
                </label>
                <input
                  type="text"
                  placeholder="জাতীয় পরিচয়পত্র নম্বর"
                  value={bNid}
                  onChange={(e) => setBNid(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.loanAmount} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="500"
                    step="500"
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.loanDate} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoanMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      loanMethod === 'cash'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      loanMethod === 'bank'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{t.bank}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 text-[11px] text-purple-800 dark:text-purple-300">
                {language === 'bn'
                  ? '১০% মাসিক হারে দৈনিক মুনাফা স্বয়ংক্রিয়ভাবে হিসাব হবে এবং ক্যাশ/ব্যাংক থেকে ৳' + principal + ' ডেবিট হবে।'
                  : '10% monthly interest will accrue daily. Cash/Bank will be debited.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {language === 'bn' ? 'ঋণ বিতরণ নিশ্চিত করুন' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Receive Payment Form */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              {language === 'bn' ? 'ঋণের কিস্তি / আদায় গ্রহণ' : 'Receive Loan Payment'}
            </h3>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">
                  {payingLoan.borrowerName} ({payingLoan.borrowerPhone})
                </div>
                {(() => {
                  const live = StorageService.calculateLoanLiveProfit(payingLoan, payDate);
                  const accruedProfit = live.accruedProfit;
                  const effDiscount = Math.max(0, Math.min(payDiscount || 0, accruedProfit));
                  const netProfitDue = Math.max(0, accruedProfit - effDiscount);
                  const totalDueFull = payingLoan.remainingPrincipal + netProfitDue;

                  return (
                    <div className="mt-2 space-y-2 text-[11px]">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400">{t.remainingPrincipal}:</span>{' '}
                          <span className="font-bold">৳{payingLoan.remainingPrincipal.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-purple-600 font-semibold">{t.accruedProfit}:</span>{' '}
                          <span className="font-bold text-purple-600">৳{accruedProfit.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">
                            {language === 'bn' ? 'গণনাকৃত মেয়াদ:' : 'Calculated Duration:'}
                          </span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">
                            {language === 'bn' ? live.durationTextBn : live.durationTextEn}
                          </span>
                        </div>
                        {live.monthBreakdown && live.monthBreakdown.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                            {live.monthBreakdown.map((mb, mIdx) => (
                              <div
                                key={mIdx}
                                className="flex items-center justify-between text-[10px] text-slate-500"
                              >
                                <span>{language === 'bn' ? mb.periodLabelBn : mb.periodLabelEn}</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  +৳{mb.profit.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Interest Discount Input & Result */}
                      <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            <span>{language === 'bn' ? 'মুনাফায় ছাড় / ডিসকাউন্ট (৳):' : 'Interest Discount (৳):'}</span>
                          </label>
                          {payDiscount > 0 && (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              -৳{effDiscount.toFixed(2)} {language === 'bn' ? 'ছাড়' : 'off'}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={Math.round(accruedProfit)}
                          value={payDiscount || ''}
                          onChange={(e) => setPayDiscount(Math.max(0, Number(e.target.value)))}
                          placeholder={language === 'bn' ? 'যেমন: ২৯ টাকা' : 'e.g. 29'}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        />
                        <div className="flex justify-between text-[10px] text-amber-800 dark:text-amber-300">
                          <span>{language === 'bn' ? 'ছাড় পরবর্তী নিট মুনাফা:' : 'Net Profit After Discount:'}</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">৳{netProfitDue.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Total Due with Quick Action Buttons */}
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-emerald-600 text-xs">
                        <span>{language === 'bn' ? 'পূর্ণ পরিশোধে সর্বমোট:' : 'Full Payoff Total:'}</span>
                        <span>৳{totalDueFull.toFixed(2)}</span>
                      </div>

                      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setPayAmount(Math.round(totalDueFull))}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-200 transition-all cursor-pointer"
                        >
                          {language === 'bn' ? `পূর্ণ পরিশোধ (৳${Math.round(totalDueFull).toLocaleString()})` : `Full Payoff (৳${Math.round(totalDueFull).toLocaleString()})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayAmount(Math.round(netProfitDue))}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-200 transition-all cursor-pointer"
                        >
                          {language === 'bn' ? `শুধু নিট মুনাফা (৳${Math.round(netProfitDue).toLocaleString()})` : `Net Profit (৳${Math.round(netProfitDue).toLocaleString()})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayAmount(Math.round(payingLoan.remainingPrincipal))}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                        >
                          {language === 'bn' ? `শুধু মূলধন (৳${Math.round(payingLoan.remainingPrincipal).toLocaleString()})` : `Principal (৳${Math.round(payingLoan.remainingPrincipal).toLocaleString()})`}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'আদায়ের পরিমাণ (৳)' : 'Amount (৳)'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'আদায়ের তারিখ' : 'Payment Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      payMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      payMethod === 'bank'
                        ? 'bg-emerald-600 text-white border-emerald-600'
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
                  {language === 'bn' ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes (optional)'}
                </label>
                <input
                  type="text"
                  placeholder="যেমন: সেপ্টেম্বর মাসের কিস্তি"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 text-[11px] text-emerald-800 dark:text-emerald-300">
                {language === 'bn'
                  ? 'অ্যালোকেশন নিয়ম: প্রথমে জমাকৃত মুনাফা পরিশোধ হবে, তারপর অবশিষ্ট অর্থ মূলধন থেকে বাদ যাবে।'
                  : 'Allocation: First covers accrued profit, remaining reduces principal.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingLoan(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {language === 'bn' ? 'আদায় সম্পন্ন ও রশিদ তৈরি' : 'Confirm & Print Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Borrower Lifetime History */}
      {selectedBorrower && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {selectedBorrower.name} - {t.borrowerHistory}
                </h3>
                <p className="text-xs text-slate-400">{selectedBorrower.phone}</p>
              </div>
              <button
                onClick={() => setSelectedBorrower(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3 custom-scrollbar">
              {loans
                .filter((l) => l.borrowerId === selectedBorrower.borrowerId)
                .map((l, idx) => (
                  <div
                    key={`${l.loanId}-${idx}`}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          #{l.loanId} • ৳{l.principal.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {l.loanDate} • {l.paymentMethod}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          l.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {l.status === 'paid' ? t.paid : t.active}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-[11px]">
                      <span>{language === 'bn' ? 'পরিশোধিত মুনাফা:' : 'Profit Paid:'} ৳{l.totalProfitPaid.toFixed(2)}</span>
                      <span>{language === 'bn' ? 'অবশিষ্ট আসল:' : 'Remaining Principal:'} ৳{l.remainingPrincipal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedBorrower(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Loan Profit Allocation Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {language === 'bn' ? 'সদস্য একাউন্টে ঋণ মুনাফা বন্টন' : 'Allocate Loan Profit to Members'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {language === 'bn' ? 'মাসিক বা বার্ষিক ভিত্তিতে শতকরা হার নির্ধারণ' : 'Choose percentage on monthly or yearly basis'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAllocation} className="mt-4 space-y-4">
              {allocErrorMessage && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{allocErrorMessage}</span>
                </div>
              )}

              {/* 1. Period Frequency Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  {language === 'bn' ? '১. বন্টনের মেয়াদ / তারিখ নির্বাচন:' : '1. Allocation Period / Date:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllocPeriodType('monthly')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      allocPeriodType === 'monthly'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span>{language === 'bn' ? 'মাসিক ভিত্তিতে' : 'Monthly Basis'}</span>
                    <span className="text-[10px] font-normal opacity-80">{language === 'bn' ? 'মাস নির্বাচন' : 'Pick month'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllocPeriodType('yearly')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      allocPeriodType === 'yearly'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span>{language === 'bn' ? 'বার্ষিক ভিত্তিতে' : 'Yearly Basis'}</span>
                    <span className="text-[10px] font-normal opacity-80">{language === 'bn' ? 'বছর নির্বাচন' : 'Pick year'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllocPeriodType('custom')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      allocPeriodType === 'custom'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span>{language === 'bn' ? 'নির্দিষ্ট তারিখ / কাস্টম' : 'Specific Date'}</span>
                    <span className="text-[10px] font-normal opacity-80">{language === 'bn' ? 'তারিখ নির্বাচন' : 'Pick date'}</span>
                  </button>
                </div>

                {/* Sub-inputs based on period type */}
                <div className="mt-2.5">
                  {allocPeriodType === 'monthly' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">{language === 'bn' ? 'মাস:' : 'Month:'}</label>
                        <select
                          value={allocMonth}
                          onChange={(e) => setAllocMonth(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          {(language === 'bn'
                            ? ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
                            : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
                          ).map((mName, idx) => (
                            <option key={idx} value={idx + 1}>{mName}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">{language === 'bn' ? 'সাল:' : 'Year:'}</label>
                        <select
                          value={allocYear}
                          onChange={(e) => setAllocYear(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          {[2025, 2026, 2027, 2028].map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {allocPeriodType === 'yearly' && (
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">{language === 'bn' ? 'বছর নির্বাচন করুন:' : 'Select Year:'}</label>
                      <select
                        value={allocYear}
                        onChange={(e) => setAllocYear(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        {[2025, 2026, 2027, 2028].map((y) => (
                          <option key={y} value={y}>{y} {language === 'bn' ? 'সাল (বার্ষিক বন্টন)' : 'Annual'}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {allocPeriodType === 'custom' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">{language === 'bn' ? 'বন্টনের সুনির্দিষ্ট তারিখ:' : 'Specific Date:'}</label>
                        <input
                          type="date"
                          value={allocSpecificDate}
                          onChange={(e) => setAllocSpecificDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">{language === 'bn' ? 'বিবরণ বা উপলক্ষ (ঐচ্ছিক):' : 'Occasion/Label:'}</label>
                        <input
                          type="text"
                          placeholder="যেমন: জার্সি সংগ্রহ পরবর্তী বন্টন"
                          value={allocCustomLabel}
                          onChange={(e) => setAllocCustomLabel(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Allocation Mode: Fixed Equal Amount vs Percentage */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  {language === 'bn' ? '২. বন্টনের ধরণ নির্বাচন করুন:' : '2. Allocation Type:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllocMode('fixed_equal')}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      allocMode === 'fixed_equal'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs">
                      {language === 'bn' ? 'সদস্য প্রতি নির্দিষ্ট সমপরিমাণ' : 'Fixed Equal Amount'}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {language === 'bn' ? `সকল ${activeMembersList.length} জন সদস্য সমান টাকা পাবেন` : `All ${activeMembersList.length} members get equal amount`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllocMode('percentage')}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      allocMode === 'percentage'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs">
                      {language === 'bn' ? 'শতকরা হার (%) নির্ধারণ' : 'Percentage of Net Profit'}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {language === 'bn' ? 'নিট মুনাফার ৫০% বা ১০০% বন্টন' : 'Allocate % of available net profit'}
                    </span>
                  </button>
                </div>

                {/* Sub Inputs for Chosen Mode */}
                <div className="mt-2.5">
                  {allocMode === 'fixed_equal' ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {language === 'bn' ? 'সদস্য প্রতি বরাদ্দের পরিমাণ (৳):' : 'Amount per Member (৳):'}
                        </label>
                        <span className="text-xs font-bold text-emerald-600">
                          ৳{allocFixedAmount.toLocaleString()} / সদস্য
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {[200, 300, 500, 1000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAllocFixedAmount(preset)}
                            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              allocFixedAmount === preset
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            ৳{preset}
                          </button>
                        ))}
                      </div>

                      <input
                        type="number"
                        min="1"
                        step="50"
                        value={allocFixedAmount || ''}
                        onChange={(e) => setAllocFixedAmount(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        placeholder="যেমন: ৫০০"
                      />

                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                        ✓ {language === 'bn'
                          ? `${activeMembersList.length} জন সদস্য × ৳${allocFixedAmount.toLocaleString()} = মোট ৳${(allocFixedAmount * activeMembersList.length).toLocaleString()} বন্টন হবে`
                          : `${activeMembersList.length} members × ৳${allocFixedAmount.toLocaleString()} = Total ৳${(allocFixedAmount * activeMembersList.length).toLocaleString()}`}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {language === 'bn' ? 'প্রযোজ্য শতকরা হার (%):' : 'Applicable Percentage (%):'}
                        </label>
                        <span className="text-sm font-bold text-emerald-600">{allocPercentage}%</span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-2">
                        {[10, 25, 50, 75, 100].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAllocPercentage(preset)}
                            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              allocPercentage === preset
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={allocPercentage}
                          onChange={(e) => setAllocPercentage(Number(e.target.value))}
                          className="flex-1 accent-emerald-600 cursor-pointer"
                        />
                        <div className="w-16">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={allocPercentage}
                            onChange={(e) => setAllocPercentage(Math.max(1, Math.min(100, Number(e.target.value))))}
                            className="w-full px-2 py-1 text-center font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Live Accounting & Deduction Box */}
              {(() => {
                const totalAlloc = allocMode === 'fixed_equal'
                  ? allocFixedAmount * activeMembersList.length
                  : Math.round((netLoanProfitAvailable * allocPercentage) / 100);
                const perMember = activeMembersList.length > 0 ? Math.floor(totalAlloc / activeMembersList.length) : 0;

                return (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block">
                      {language === 'bn' ? 'ব্যয় কর্তন ও বন্টন হিসাব বিবরণী:' : 'Accounting & Deduction Breakdown:'}
                    </span>

                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{language === 'bn' ? 'মোট অর্জিত ঋণ মুনাফা:' : 'Total Gross Loan Profit:'}</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">৳{grossLoanProfit.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>{language === 'bn' ? '(-) জার্সি ও অন্যান্য সমিতি ব্যয় কর্তন:' : '(-) Jersey & Association Expenses:'}</span>
                      <span className="font-bold">-৳{totalExpenses.toLocaleString()}</span>
                    </div>

                    {totalDistributedSoFar > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>{language === 'bn' ? '(-) পূর্বে বন্টিত লভ্যাংশ:' : '(-) Previously Distributed:'}</span>
                        <span className="font-medium">-৳{totalDistributedSoFar.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-semibold text-emerald-700 dark:text-emerald-300">
                      <span>{language === 'bn' ? 'বন্টনযোগ্য অবশিষ্ট নিট মুনাফা:' : 'Available Net Profit:'}</span>
                      <span className="font-bold">৳{netLoanProfitAvailable.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                      <span>{language === 'bn' ? 'এবারে মোট বন্টন হবে:' : 'Total to Allocate Now:'}</span>
                      <span className="text-sm font-black text-emerald-600">৳{totalAlloc.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>{language === 'bn' ? `সক্রিয় সদস্য সংখ্যা (${activeMembersList.length} জন):` : `Active Members (${activeMembersList.length}):`}</span>
                      <span className="font-bold text-blue-600">প্রতিজন ৳{perMember.toLocaleString()}</span>
                    </div>

                    <div className="mt-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/50 text-[10px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      💡 {language === 'bn'
                        ? 'নীতিমালা: জার্সি বা টি-শার্ট সংগ্রহ এবং সংগঠনের যাবতীয় খরচ কেবল ঋণ মুনাফা থেকে কর্তন করার পর অবশিষ্ট অর্থ সদস্যদের একাউন্টে সমহারে যুক্ত হয়।'
                        : 'Policy: Costs for jerseys, t-shirts, and association expenses are deducted solely from loan profit before dividends are credited.'}
                    </div>
                  </div>
                );
              })()}

              {/* 4. Notes / Resolution Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'মন্তব্য বা সভার রেজুলেশন নম্বর (ঐচ্ছিক):' : 'Notes / Resolution Ref (Optional):'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'যেমন: সাধারণ সভার সিদ্ধান্ত মোতাবেক' : 'e.g. As approved in meeting'}
                  value={allocNotes}
                  onChange={(e) => setAllocNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={grossLoanProfit <= 0 || activeMembersList.length === 0}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    grossLoanProfit > 0 && activeMembersList.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'সদস্য একাউন্টে তহবিল যোগ করুন' : 'Confirm & Add Funds to Members'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Record Already Repaid Loan Modal */}
      {showRepaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {language === 'bn' ? 'ইতিমধ্যে পরিশোধিত ঋণ রেকর্ড করুন' : 'Record Already Repaid Loan'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {language === 'bn'
                      ? 'পূর্বে বিতরণ ও সম্পূর্ণ পরিশোধিত ঋণের মূলধন, অর্জিত মুনাফা ও ছাড় লিপিবদ্ধ করুন'
                      : 'Record historical repaid loans with principal, profit, discount, and dates'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRepaidModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRepaidSubmit} className="mt-4 space-y-3.5">
              {/* Borrower Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.borrowerName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: কাজল চন্দ্র দাস"
                    value={repaidBName}
                    onChange={(e) => setRepaidBName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.phoneNumber} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={repaidBPhone}
                    onChange={(e) => setRepaidBPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  জাতীয় পরিচয়পত্র / NID (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="NID নম্বর"
                  value={repaidBNid}
                  onChange={(e) => setRepaidBNid(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Loan Financials & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ঋণ আসল / মূলধন (৳) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="500"
                    step="100"
                    value={repaidPrincipal}
                    onChange={(e) => setRepaidPrincipal(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ঋণ গ্রহণের তারিখ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={repaidLoanDate}
                    onChange={(e) => setRepaidLoanDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    পরিশোধের তারিখ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={repaidRepaymentDate}
                    onChange={(e) => setRepaidRepaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Accrued Interest & Discount */}
              <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    মুনাফা ও ছাড় হিসাব (Interest & Discount)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (repaidPrincipal > 0 && repaidLoanDate && repaidRepaymentDate) {
                        const d1 = new Date(repaidLoanDate);
                        const d2 = new Date(repaidRepaymentDate);
                        const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
                        const calculated = Math.round((repaidPrincipal * 0.1 * diffDays) / 30);
                        setRepaidAccruedProfit(calculated);
                      }
                    }}
                    className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                  >
                    ⚡ ১০% মাসিক হারে স্বয়ংক্রিয় হিসাব
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      মোট ধার্য মুনাফা (৳) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={repaidAccruedProfit}
                      onChange={(e) => setRepaidAccruedProfit(Number(e.target.value))}
                      placeholder="যেমন: ৭২৯"
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      মুনাফায় ছাড় / কমিশন (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={repaidAccruedProfit}
                      value={repaidDiscount}
                      onChange={(e) => setRepaidDiscount(Number(e.target.value))}
                      placeholder="যেমন: ২৯"
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 font-bold"
                    />
                  </div>
                </div>

                {/* Calculation Summary Box */}
                {(() => {
                  const effDisc = Math.max(0, Math.min(repaidDiscount || 0, repaidAccruedProfit));
                  const netProfit = Math.max(0, repaidAccruedProfit - effDisc);
                  const totalPaid = repaidPrincipal + netProfit;

                  return (
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">ঋণ মূলধন (আসল):</span>
                        <span className="font-semibold text-slate-900 dark:text-white">৳{repaidPrincipal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">মোট ধার্যকৃত মুনাফা:</span>
                        <span className="font-semibold text-purple-600">৳{repaidAccruedProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 dark:text-amber-300">
                        <span>(-) মুনাফায় প্রদত্ত ছাড়:</span>
                        <span className="font-bold">-৳{effDisc.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>নিট আদায়কৃত মুনাফা (সমিতির আয়):</span>
                        <span>৳{netProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 dark:text-white font-extrabold pt-1 border-t border-slate-100 dark:border-slate-800 text-sm">
                        <span>সর্বমোট আদায় (আসল + নিট মুনাফা):</span>
                        <span className="text-emerald-600">৳{totalPaid.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepaidMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      repaidMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepaidMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${
                      repaidMethod === 'bank'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{t.bank}</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  মন্তব্য বা বিবরণ
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ৭,০০০ টাকা ঋণ ১ মাস পর ৭২৯ টাকা মুনাফা হয়, ২৯ টাকা ছাড় দিয়ে ৭০০ টাকা মুনাফাসহ মোট ৭,৭০০ টাকা পরিশোধ"
                  value={repaidNotes}
                  onChange={(e) => setRepaidNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRepaidModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'পরিশোধিত ঋণ সংরক্ষণ ও রশিদ তৈরি' : 'Save Repaid Loan & Issue Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
