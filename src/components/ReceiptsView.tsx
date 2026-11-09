import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Language,
  UserAccount,
  Member,
  Contribution,
  LoanPayment,
  MemberWithdrawal,
} from '../types';
import { getTranslation, formatMemberPhone } from '../lib/translations';
import { StorageService } from '../lib/storage';
import {
  printReceiptDirectly,
  amountToBengaliWords,
  amountToEnglishWords,
} from '../lib/receiptPrinter';
import {
  ReceiptText,
  Printer,
  Search,
  CheckCircle2,
  Calendar,
  X,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  User,
  Building2,
  Eye,
  FileText,
} from 'lucide-react';

interface ReceiptsViewProps {
  receipts: Receipt[];
  members?: Member[];
  contributions?: Contribution[];
  loanPayments?: LoanPayment[];
  withdrawals?: MemberWithdrawal[];
  currentUser: UserAccount;
  language: Language;
  selectedReceiptId?: string | null;
  onClosePreview?: () => void;
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({
  receipts,
  members = [],
  contributions = [],
  loanPayments = [],
  withdrawals = [],
  currentUser,
  language,
  selectedReceiptId,
  onClosePreview,
}) => {
  const t = getTranslation(language);
  const isAdmin = currentUser.role === 'admin';
  const isMember = currentUser.role === 'member' && currentUser.userId !== 'USR-VIEW-ONLY';
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(
    selectedReceiptId ? receipts.find((r) => r.receiptId === selectedReceiptId) || null : null
  );

  // Sync if selectedReceiptId prop changes
  React.useEffect(() => {
    if (selectedReceiptId) {
      const found = receipts.find((r) => r.receiptId === selectedReceiptId);
      if (found) setActiveReceipt(found);
    }
  }, [selectedReceiptId, receipts]);

  // Retrieve linked member accounts for identification
  const linkedMembers = useMemo(() => {
    return StorageService.getLinkedMembersForUser(currentUser, members);
  }, [currentUser, members]);

  const linkedSystemIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUser.memberSystemId) ids.add(currentUser.memberSystemId);
    linkedMembers.forEach((m) => {
      if (m.systemId) ids.add(m.systemId);
    });
    return ids;
  }, [currentUser, linkedMembers]);

  const linkedPhones = useMemo(() => {
    const phones = new Set<string>();
    const cleanUserPhone = StorageService.normalizePhoneNumber(currentUser.username || '');
    if (cleanUserPhone.length >= 6) phones.add(cleanUserPhone);
    const cleanUserDirectPhone = StorageService.normalizePhoneNumber(currentUser.phone || '');
    if (cleanUserDirectPhone.length >= 6) phones.add(cleanUserDirectPhone);

    linkedMembers.forEach((m) => {
      const clean = StorageService.normalizePhoneNumber(m.phone || '');
      if (clean.length >= 6) phones.add(clean);
    });
    return phones;
  }, [currentUser, linkedMembers]);

  const linkedNames = useMemo(() => {
    const names = new Set<string>();
    if (currentUser.name) names.add(currentUser.name.toLowerCase().trim());
    if (currentUser.displayName) names.add(currentUser.displayName.toLowerCase().trim());
    linkedMembers.forEach((m) => {
      if (m.name) names.add(m.name.toLowerCase().trim());
    });
    return names;
  }, [currentUser, linkedMembers]);

  // Strip account and member suffixes for robust fuzzy comparison
  const cleanNameBase = (s: string) => {
    return s
      .toLowerCase()
      .replace(/\(হিসাব\s*[০-৯0-9]+\)/gi, '')
      .replace(/\(account\s*[0-9]+\)/gi, '')
      .replace(/\(প্রধান\s*অ্যাডমিন\)/gi, '')
      .replace(/\(সহকারী\s*অ্যাডমিন\)/gi, '')
      .replace(/\(অ্যাডমিন\)/gi, '')
      .replace(/\(admin\)/gi, '')
      .replace(/\(সদস্য\)/gi, '')
      .replace(/\(member\)/gi, '')
      .replace(/\[.*?\]/g, '')
      .trim();
  };

  // Pre-index receipt IDs from financial records belonging to linked accounts
  const linkedRecordReceiptIds = useMemo(() => {
    const ids = new Set<string>();
    const txnIds = new Set<string>();

    contributions.forEach((c) => {
      if (linkedSystemIds.has(c.memberSystemId)) {
        if (c.receiptId) ids.add(c.receiptId);
        if (c.contributionId) txnIds.add(c.contributionId);
      }
    });

    withdrawals.forEach((w) => {
      if (linkedSystemIds.has(w.memberSystemId)) {
        if (w.receiptId) ids.add(w.receiptId);
        if (w.withdrawalId) txnIds.add(w.withdrawalId);
      }
    });

    loanPayments.forEach((p) => {
      const isBorrowerLinked = linkedMembers.some((m) => {
        const mBase = cleanNameBase(m.name);
        const pBase = cleanNameBase(p.borrowerName);
        return mBase === pBase || m.name.trim() === p.borrowerName.trim();
      });
      if (isBorrowerLinked) {
        if (p.receiptId) ids.add(p.receiptId);
        if (p.paymentId) txnIds.add(p.paymentId);
      }
    });

    return { ids, txnIds };
  }, [contributions, withdrawals, loanPayments, linkedSystemIds, linkedMembers]);

  // Function to determine whether a receipt belongs to the currently logged in member (strictly by systemId or phone)
  const checkIsMyReceipt = (r: Receipt, targetSystemId?: string): boolean => {
    // If filtering by a specific account among their own linked accounts:
    if (targetSystemId) {
      if (r.memberSystemId && r.memberSystemId === targetSystemId) return true;
      const targetMember = linkedMembers.find((m) => m.systemId === targetSystemId);
      if (targetMember && targetMember.phone) {
        const tPhone = StorageService.normalizePhoneNumber(targetMember.phone);
        const rPhone = StorageService.normalizePhoneNumber(r.phone || '');
        if (tPhone && rPhone && tPhone.length >= 6 && (tPhone === rPhone || tPhone.endsWith(rPhone.slice(-10)) || rPhone.endsWith(tPhone.slice(-10)))) {
          return true;
        }
      }
      return false;
    }

    // 1. Direct system ID match for this member's own linked accounts
    if (r.memberSystemId) {
      const rSys = r.memberSystemId.trim().toLowerCase();
      if (linkedSystemIds.has(r.memberSystemId) || linkedSystemIds.has(rSys)) return true;
    }

    // 2. Receipt ID or Transaction ID linked to this member's financial records
    if (r.receiptId && linkedRecordReceiptIds.ids.has(r.receiptId)) return true;
    if (r.transactionId && linkedRecordReceiptIds.txnIds.has(r.transactionId)) return true;

    // 3. Strict phone matching: receipt phone must match member's own phone number
    const rPhoneClean = StorageService.normalizePhoneNumber(r.phone || '');
    if (rPhoneClean.length >= 6) {
      for (const lp of linkedPhones) {
        if (
          lp === rPhoneClean ||
          lp.endsWith(rPhoneClean.slice(-10)) ||
          rPhoneClean.endsWith(lp.slice(-10))
        ) {
          return true;
        }
      }
    }

    // 4. Exact or clean name matching fallback
    const rNameClean = cleanNameBase(r.recipientName || r.name || '');
    if (rNameClean) {
      for (const ln of linkedNames) {
        if (cleanNameBase(ln) === rNameClean) return true;
      }
    }

    return false;
  };

  // Multi-account filter: 'all_my', or specific systemId
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all_my');

  // Deduplicate receipts strictly so no two items/cards ever show for the same receipt or transaction
  const uniqueReceipts = useMemo(() => {
    const seenReceiptIds = new Set<string>();
    const seenTxnIds = new Set<string>();
    return receipts.filter((r) => {
      if (!r || !r.receiptId) return false;
      if (seenReceiptIds.has(r.receiptId)) return false;
      if (r.transactionId && seenTxnIds.has(r.transactionId)) return false;
      seenReceiptIds.add(r.receiptId);
      if (r.transactionId) seenTxnIds.add(r.transactionId);
      return true;
    });
  }, [receipts]);

  const myReceipts = useMemo(() => {
    return uniqueReceipts.filter((r) =>
      selectedAccountFilter === 'all_my'
        ? checkIsMyReceipt(r)
        : checkIsMyReceipt(r, selectedAccountFilter)
    );
  }, [uniqueReceipts, selectedAccountFilter, checkIsMyReceipt]);

  // General members are strictly restricted to their own receipts only!
  const baseList = isMember ? myReceipts : uniqueReceipts;

  const filteredReceipts = useMemo(() => {
    return baseList.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const name = (r.recipientName || r.name || '').toLowerCase();
      const id = (r.receiptId || '').toLowerCase();
      const type = (r.type || '').toLowerCase();
      const purpose = (r.purpose || '').toLowerCase();
      const amountStr = String(r.amount || '');
      const dateStr = (r.date || '').toLowerCase();
      return (
        id.includes(q) ||
        name.includes(q) ||
        type.includes(q) ||
        purpose.includes(q) ||
        amountStr.includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [baseList, searchQuery]);

  const handlePrint = () => {
    if (!activeReceipt) return;
    printReceiptDirectly(activeReceipt, undefined, language);
  };

  const getTypeName = (type?: string) => {
    switch (type) {
      case 'contribution':
        return language === 'bn' ? 'মাসিক সঞ্চয় জমা' : 'Monthly Contribution';
      case 'loan_issue':
        return language === 'bn' ? 'ঋণ বিতরণ' : 'Loan Disbursement';
      case 'loan_payment':
        return language === 'bn' ? 'ঋণ কিস্তি আদায়' : 'Loan Repayment';
      case 'member_withdrawal':
        return language === 'bn' ? 'সদস্য তহবিল উত্তোলন' : 'Member Fund Withdrawal';
      case 'income':
        return language === 'bn' ? 'অন্যান্য আয়' : 'Other Income';
      default:
        return type || (language === 'bn' ? 'সঞ্চয় জমা' : 'Savings Deposit');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Hide the grid and header when printing an active receipt */}
      <div className={activeReceipt ? 'print:hidden space-y-6' : 'space-y-6'}>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ReceiptText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <span>{language === 'bn' ? 'রশিদ ও ভাউচার খতিয়ান' : 'Receipt Vouchers & Records'}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {filteredReceipts.length} {language === 'bn' ? 'টি ভাউচার' : 'vouchers'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'bn'
                ? 'সকল আর্থিক লেনদেনের স্বয়ংক্রিয় ডিজিটাল রশিদের সংগ্রহশালা ও নিজস্ব রেকর্ড।'
                : 'Digital repository of all generated official payment receipts and member records.'}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={language === 'bn' ? 'রশিদ নং, নাম বা তারিখ খুঁজুন...' : 'Search receipt ID, name, or date...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        {/* Member Indicator: General members exclusively view their own receipts */}
        {isMember && (
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 w-fit text-xs font-semibold text-amber-800 dark:text-amber-300">
            <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{language === 'bn' ? 'আমার নিজস্ব অ্যাকাউন্টের রশিদের খতিয়ান' : 'My Personal Account Receipts'}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 font-bold">
              {myReceipts.length} {language === 'bn' ? 'টি রশিদ' : 'receipts'}
            </span>
          </div>
        )}


        {/* Receipts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReceipts.map((r, idx) => {
            const isMine = checkIsMyReceipt(r);
            const displayName = r.recipientName || r.name || (language === 'bn' ? 'সদস্য' : 'Member');

            return (
              <div
                key={`${r.receiptId}-${idx}`}
                onClick={() => setActiveReceipt(r)}
                className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-2xs hover:border-amber-400 hover:shadow-md ${
                  isMine
                    ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      #{r.receiptId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isMine && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                          {language === 'bn' ? 'আমার রশিদ' : 'My Receipt'}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                        {r.paymentMethod === 'bank' ? (language === 'bn' ? 'ব্যাংক' : 'Bank') : (language === 'bn' ? 'ক্যাশ' : 'Cash')}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">
                    {displayName}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {r.purpose || getTypeName(r.type)}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{r.date}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      ৳{(r.amount || 0).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReceipt(r);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                      title={language === 'bn' ? 'ভাউচার স্লিপ দেখুন' : 'View Voucher Slip'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredReceipts.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <ReceiptText className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {language === 'bn' ? 'কোনো রশিদ পাওয়া যায়নি।' : 'No receipts found.'}
            </p>
            {isMember && (
              <p className="mt-2 text-xs text-slate-400">
                {language === 'bn'
                  ? 'আপনার এই মোবাইল নম্বরের অ্যাকাউন্টে এখনও কোনো রশিদ বা ভাউচার সংরক্ষিত নেই।'
                  : 'No receipts recorded for your account phone number yet.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Receipt Modal & Print Slip */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in receipt-modal-backdrop print:static print:inset-auto print:bg-transparent print:p-0 print:block">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar receipt-modal-content print:max-h-none print:overflow-visible print:p-0 print:border-none print:shadow-none print:bg-white print:text-black print:w-full print:max-w-none">
            {/* Action Bar (hidden on print) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t.receiptVoucher}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  title="Direct Receipt Print"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'রশিদ প্রিন্ট করুন' : 'Print Receipt'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveReceipt(null);
                    if (onClosePreview) onClosePreview();
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Slip Container */}
            <div className="mt-4 p-6 rounded-2xl bg-amber-50/20 dark:bg-slate-800/40 border border-amber-200/60 dark:border-slate-700 font-sans print:border-2 print:border-slate-800 print:p-6 print:rounded-2xl print:bg-white print:text-slate-900 print:shadow-none">
              {/* Slip Header */}
              <div className="text-center pb-4 border-b-2 border-dashed border-amber-300 dark:border-slate-700">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  🕉️ ওঁ শ্রী শ্রী গুরুবে নমঃ
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {language === 'bn' ? 'পাকুড়া সনাতন যুব সংঘ' : 'Pakura Sanatan Jubo Sangha'}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  {language === 'bn' ? 'অর্থ ও হিসাব বিভাগ • অফিসিয়াল মানি রিসিট' : 'Finance & Accounts • Official Money Receipt'}
                </div>
              </div>

              {/* Slip Meta */}
              <div className="mt-4 flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">{language === 'bn' ? 'রশিদ নং:' : 'Receipt No:'}</span>{' '}
                  <span className="font-mono font-bold text-slate-900 dark:text-white">#{activeReceipt.receiptId}</span>
                </div>
                <div>
                  <span className="text-slate-400">{t.date}:</span>{' '}
                  <span className="font-semibold">{activeReceipt.date}</span>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="mt-4 space-y-2.5 text-xs bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-400">{language === 'bn' ? 'প্রদানকারী / গ্রহীতার নাম:' : 'Received From / Paid To:'}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{activeReceipt.recipientName || activeReceipt.name}</span>
                </div>

                {activeReceipt.phone && (
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">{language === 'bn' ? 'মোবাইল নম্বর:' : 'Phone Number:'}</span>
                    <span className="font-medium font-mono text-slate-700 dark:text-slate-300">{formatMemberPhone(activeReceipt.phone, isAdmin)}</span>
                  </div>
                )}

                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-400">{language === 'bn' ? 'খাত / লেনদেনের বিবরণ:' : 'Transaction Purpose:'}</span>
                  <span className="font-semibold text-amber-600">{getTypeName(activeReceipt.type)}</span>
                </div>

                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-400">{t.paymentMethod}:</span>
                  <span className="font-bold uppercase text-slate-800 dark:text-slate-200">
                    {activeReceipt.paymentMethod === 'cash' ? (language === 'bn' ? 'নগদ (Cash)' : 'Cash') : (language === 'bn' ? 'ব্যাংক (Bank)' : 'Bank')}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{language === 'bn' ? 'গৃহীত / প্রদত্ত অর্থ:' : 'Amount:'}</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    ৳{activeReceipt.amount.toLocaleString()}
                  </span>
                </div>

                {/* Amount in words */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{language === 'bn' ? 'কথায়:' : 'In Words:'}</span>{' '}
                  <span>
                    {language === 'bn'
                      ? amountToBengaliWords(activeReceipt.amount)
                      : amountToEnglishWords(activeReceipt.amount)}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-end text-xs">
                <div className="text-center">
                  <div className="w-24 border-t border-slate-400 pt-1 font-semibold text-slate-700 dark:text-slate-300">
                    {activeReceipt.issuedBy || activeReceipt.receivedBy || (language === 'bn' ? 'কোষাধ্যক্ষ' : 'Treasurer')}
                  </div>
                  <span className="text-[10px] text-slate-400">{language === 'bn' ? 'আদায়কারীর স্বাক্ষর' : 'Collector Signature'}</span>
                </div>

                <div className="text-center">
                  <div className="w-24 border-t border-slate-400 pt-1 font-semibold text-slate-700 dark:text-slate-300">
                    {language === 'bn' ? 'সভাপতি / সম্পাদক' : 'President / Sec'}
                  </div>
                  <span className="text-[10px] text-slate-400">{language === 'bn' ? 'যাচাইকারী' : 'Verified By'}</span>
                </div>

                <div className="text-center">
                  <div className="w-24 border-t border-slate-400 pt-1 font-semibold text-slate-700 dark:text-slate-300">
                    {activeReceipt.recipientName || activeReceipt.name}
                  </div>
                  <span className="text-[10px] text-slate-400">{language === 'bn' ? 'জমাকারীর স্বাক্ষর' : 'Depositor'}</span>
                </div>
              </div>

              <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
                {language === 'bn'
                  ? '✓ এটি একটি কম্পিউটার জেনারেটেড ডিজিটাল সত্যায়িত মানি রিসিট • পাকুড়া সনাতন যুব সংঘ'
                  : '✓ Official Computer Generated Money Receipt Voucher • Pakura Sanatan Jubo Sangha'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
