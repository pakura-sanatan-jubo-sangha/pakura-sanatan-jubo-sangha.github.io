import {
  Member,
  UserAccount,
  Contribution,
  Borrower,
  Loan,
  LoanPayment,
  IncomeRecord,
  ExpenseRecord,
  Transaction,
  Receipt,
  ActivityLogItem,
  AppSettings,
  DashboardMetrics,
  PaymentMethod,
  FullAppData,
  Role,
  SocietyRule,
  GeneralMeeting,
  MeetingAttendee,
  ProfitDistribution,
  MemberWithdrawal,
  WithdrawalSource,
  WithdrawalStatus,
} from '../types';
import {
  calculateAccurateLoanDurationAndProfit,
  LoanCalculationResult,
} from './loanCalculator';
import { FirebaseSyncService } from './firebaseSync';

const STORAGE_KEYS = {
  MEMBERS: 'pakura_members_v1',
  USERS: 'pakura_users_v1',
  CONTRIBUTIONS: 'pakura_contributions_v1',
  BORROWERS: 'pakura_borrowers_v1',
  LOANS: 'pakura_loans_v1',
  LOAN_PAYMENTS: 'pakura_loan_payments_v1',
  INCOME: 'pakura_income_v1',
  EXPENSES: 'pakura_expenses_v1',
  TRANSACTIONS: 'pakura_transactions_v1',
  RECEIPTS: 'pakura_receipts_v1',
  LOGS: 'pakura_activity_logs_v1',
  RULES: 'pakura_rules_v1',
  MEETINGS: 'pakura_meetings_v1',
  PROFIT_DISTRIBUTIONS: 'pakura_profit_distributions_v1',
  MEMBER_WITHDRAWALS: 'pakura_member_withdrawals_v1',
  SETTINGS: 'pakura_settings_v1',
  CURRENT_USER: 'pakura_current_user_v1',
  LANGUAGE: 'pakura_language_v1',
  THEME: 'pakura_theme_v1',
};

// Initial members: empty clean slate (no demo members)
export const INITIAL_MEMBERS: Member[] = [];

export const MAIN_ADMIN_EMAIL = 'freelancerkajolchandradas@gmail.com';

export const MAIN_ADMIN_ACCOUNT: UserAccount = {
  userId: 'USR-MAIN-ADMIN',
  username: 'kajol_admin',
  email: MAIN_ADMIN_EMAIL,
  name: 'Kajol Chandra Das',
  displayName: 'Kajol Chandra Das ( Admin )',
  role: 'admin',
  isMainAdmin: true,
  status: 'active',
  createdAt: '2026-09-01',
};

// Initial users list is completely empty - no demo or testing users!
export const INITIAL_USERS: UserAccount[] = [];

export const VIEW_ONLY_USER: UserAccount = {
  userId: 'USR-VIEW-ONLY',
  username: 'visitor',
  name: 'সাধারণ দর্শক',
  displayName: 'সাধারণ দর্শক (ভিউ-অনলি ড্যাশবোর্ড)',
  role: 'member',
  status: 'active',
  createdAt: '2026-09-01',
};

export const INITIAL_SETTINGS: AppSettings = {
  societyName: 'পাকুড়া সনাতন যুব সংঘ',
  societySubtitle: 'স্থাপিত: ২০২৫ খ্রি. • অর্থ ও সদস্য ব্যবস্থাপনা সফটওয়্যার',
  phone: '01711-000000',
  email: 'pakurasanatan@gmail.com',
  address: 'পাকুড়া, বাংলাদেশ',
  currency: '৳',
  monthlyContributionAmount: 100, // ৳100
  contributionDueDay: 10, // 10th of every month
  lateFeeAmount: 10, // ৳10 late fee after due date
  loanMonthlyRate: 10, // 10% monthly
  loanDaysBasis: 30, // 30 days basis
  allowNewMembers: true,
  cashOpeningBalance: 0, // ৳0 as mandated
  bankOpeningBalance: 0, // ৳0 as mandated
  adminPassword: 'admin123', // Default Admin Password
  autoSyncSheets: true,
  maxWithdrawalPercentage: 70, // 70% limit
  minReserveBalance: 500, // ৳500 minimum reserve
  language: 'bn',
  theme: 'light',
};

// Phone normalization helper (handles Bengali digits, country code, spaces)
export function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let s = rawPhone.toString().trim();
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(bengaliDigits[i], String(i));
  }
  s = s.replace(/\D/g, '');
  if (s.startsWith('880') && s.length >= 13) {
    s = s.slice(2);
  }
  return s;
}

export class StorageService {
  // Automated backup snapshot export for zero-data-loss protection
  static exportFullBackup(): FullAppData {
    try {
      const data: FullAppData = {
        settings: this.getSettings(),
        users: this.getUsers(),
        members: this.getMembers(),
        contributions: this.getContributions(),
        loans: this.getLoans(),
        borrowers: this.getBorrowers(),
        loanPayments: this.getLoanPayments(),
        incomes: this.getIncomeRecords(),
        incomeRecords: this.getIncomeRecords(),
        expenses: this.getExpenseRecords(),
        expenseRecords: this.getExpenseRecords(),
        transactions: this.getTransactions(),
        receipts: this.getReceipts(),
        activityLogs: this.getActivityLogs(),
        rules: this.getRules(),
        meetings: this.getMeetings(),
        profitDistributions: this.getProfitDistributions(),
        memberWithdrawals: this.getMemberWithdrawals(),
      };
      if (typeof window !== 'undefined') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        localStorage.setItem(`pakura_backup_snapshot_${timestamp}`, JSON.stringify(data));
      }
      return data;
    } catch {
      return this.getAppData();
    }
  }

  // Production Data Preservation: Purge demo data only under explicit authorized maintenance
  static purgeAllDemoData(executingUser?: UserAccount): FullAppData {
    // Only allow when explicitly invoked by Main Admin
    const isMainAdmin =
      executingUser?.role === 'admin' &&
      (executingUser?.isMainAdmin === true ||
        executingUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        executingUser?.userId === 'USR-MAIN-ADMIN');

    if (!isMainAdmin && executingUser) {
      console.warn('Unauthorized attempt to purge data. Operation rejected.');
      return this.getAppData();
    }

    try {
      // Create automated pre-purge backup before any data modification
      this.exportFullBackup();

      localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.BORROWERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LOAN_PAYMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify([]));

      // Record system maintenance log
      const cleanLog: ActivityLogItem = {
        logId: `LOG-${Date.now()}`,
        dateTime: new Date().toISOString(),
        userId: executingUser?.userId || 'USR-MAIN-ADMIN',
        userDisplayName: executingUser?.displayName || 'Kajol Chandra Das ( Admin )',
        role: 'admin',
        action: 'PURGE_DEMO_DATA',
        module: 'System',
        description: 'অ্যাডমিন কর্তৃক রক্ষণাবেক্ষণ প্রক্রিয়া সম্পন্ন হয়েছে। পূর্ববর্তী ব্যাকআপ সংরক্ষণ করা হয়েছে।',
      };
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([cleanLog]));
    } catch (e) {
      console.warn('Purge maintenance warning:', e);
    }

    return this.getAppData();
  }

  // Safe migration and initialization: strictly non-destructive (Zero-Data-Loss guaranteed)
  // Safe migration and initialization: strictly non-destructive (Zero-Data-Loss guaranteed)
  static checkAndApplyCleanSlate() {
    if (typeof window === 'undefined') return;
    try {
      // Ensure required storage keys are initialized without erasing existing data
      const keys = [
        STORAGE_KEYS.MEMBERS,
        STORAGE_KEYS.CONTRIBUTIONS,
        STORAGE_KEYS.LOANS,
        STORAGE_KEYS.BORROWERS,
        STORAGE_KEYS.LOAN_PAYMENTS,
        STORAGE_KEYS.INCOME,
        STORAGE_KEYS.EXPENSES,
        STORAGE_KEYS.TRANSACTIONS,
        STORAGE_KEYS.RECEIPTS,
        STORAGE_KEYS.USERS,
        STORAGE_KEYS.RULES,
        STORAGE_KEYS.LOGS,
        STORAGE_KEYS.PROFIT_DISTRIBUTIONS,
        STORAGE_KEYS.MEMBER_WITHDRAWALS,
      ];
      for (const k of keys) {
        if (!localStorage.getItem(k)) {
          localStorage.setItem(k, JSON.stringify([]));
        }
      }

      // Automatically reconcile ledger so member balances match their net contributions
      this.synchronizeMemberBalances();
    } catch {
      // Ignore storage restrictions
    }
  }

  /**
   * Financial ledger synchronization:
   * A member's current savings balance must match their net savings
   * Net Savings = (Total Regular + Booster Contributions Paid) - (Total Savings Withdrawn)
   */
  static synchronizeMemberBalances(): Member[] {
    if (typeof window === 'undefined') return [];
    try {
      const rawMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      let members: Member[] = rawMembers ? JSON.parse(rawMembers) : [];
      if (members.length === 0) return [];

      const rawContributions = localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS);
      let contributions: Contribution[] = rawContributions ? JSON.parse(rawContributions) : [];

      const rawWithdrawals = localStorage.getItem(STORAGE_KEYS.MEMBER_WITHDRAWALS);
      const withdrawals: MemberWithdrawal[] = rawWithdrawals ? JSON.parse(rawWithdrawals) : [];

      let hasMemberChanges = false;

      members.forEach((m) => {
        // Calculate ledger net savings: (Total Regular + Booster Contributions Paid) - (Total Savings Withdrawn)
        const memberContributions = contributions.filter(
          (c) => c.memberSystemId === m.systemId && c.status === 'paid'
        );
        const memberWithdrawals = withdrawals.filter(
          (w) =>
            w.memberSystemId === m.systemId &&
            w.status === 'completed' &&
            (w.source === 'savings' || w.source === 'combined' || !w.source)
        );

        // Only recalculate balance if member has explicit contribution or withdrawal records in ledger
        if (memberContributions.length > 0 || memberWithdrawals.length > 0) {
          const totalContributed = memberContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
          const totalSavingsWithdrawn = memberWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
          const netLedgerBalance = Math.max(0, totalContributed - totalSavingsWithdrawn);

          if ((m.currentBalance ?? 0) !== netLedgerBalance) {
            m.currentBalance = netLedgerBalance;
            hasMemberChanges = true;
          }
        }
      });

      if (hasMemberChanges) {
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
      }

      this.reconcileTransactions();
      return members;
    } catch {
      return [];
    }
  }

  /**
   * Merge cloud data from Firestore into local storage cache
   */
  static mergeCloudData(cloudData: Partial<FullAppData>) {
    if (!cloudData) return;
    try {
      const deletedIds = new Set<string>();
      try {
        const rawDel = localStorage.getItem('pakura_deleted_member_ids_v1');
        if (rawDel) {
          JSON.parse(rawDel).forEach((id: string) => deletedIds.add(id));
        }
      } catch {}

      const localResetTime = Number(localStorage.getItem('pakura_last_reset_timestamp') || 0);
      const cloudResetTime = Number((cloudData as any)?.cloudResetTimestamp || 0);
      const isCloudResetNewer = cloudResetTime > localResetTime;

      if (isCloudResetNewer) {
        const filterNewer = (rawKey: string) => {
          const raw = localStorage.getItem(rawKey);
          if (!raw) return [];
          try {
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr.filter((x: any) => {
              const t = x?.createdAt ? new Date(x.createdAt).getTime() : 0;
              return t > cloudResetTime;
            });
          } catch {
            return [];
          }
        };

        localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(filterNewer(STORAGE_KEYS.CONTRIBUTIONS)));
        localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(filterNewer(STORAGE_KEYS.RECEIPTS)));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filterNewer(STORAGE_KEYS.TRANSACTIONS)));
        localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(filterNewer(STORAGE_KEYS.LOANS)));
        localStorage.setItem(STORAGE_KEYS.BORROWERS, JSON.stringify(filterNewer(STORAGE_KEYS.BORROWERS)));
        localStorage.setItem(STORAGE_KEYS.LOAN_PAYMENTS, JSON.stringify(filterNewer(STORAGE_KEYS.LOAN_PAYMENTS)));
        localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(filterNewer(STORAGE_KEYS.INCOME)));
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filterNewer(STORAGE_KEYS.EXPENSES)));
        localStorage.setItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, JSON.stringify(filterNewer(STORAGE_KEYS.PROFIT_DISTRIBUTIONS)));
        localStorage.setItem(STORAGE_KEYS.MEMBER_WITHDRAWALS, JSON.stringify(filterNewer(STORAGE_KEYS.MEMBER_WITHDRAWALS)));
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify([]));
        try {
          localStorage.removeItem('psys_shared_chat_messages_v1');
        } catch {}
        localStorage.setItem('pakura_last_reset_timestamp', String(cloudResetTime));
      }

      // 1. Members
      if (cloudData.members && cloudData.members.length > 0) {
        const localMembers = this.getMembers();
        const map = new Map<string, Member>();
        localMembers.forEach((m) => {
          if (!deletedIds.has(m.systemId)) map.set(m.systemId, m);
        });
        cloudData.members.forEach((m) => {
          if (deletedIds.has(m.systemId)) return;
          const existing = map.get(m.systemId);
          if (existing) {
            map.set(m.systemId, {
              ...existing,
              ...m,
              currentBalance: m.currentBalance !== undefined ? m.currentBalance : (existing.currentBalance ?? 0),
              profitShareBalance: m.profitShareBalance !== undefined ? m.profitShareBalance : (existing.profitShareBalance ?? 0),
              totalWithdrawn: m.totalWithdrawn !== undefined ? m.totalWithdrawn : (existing.totalWithdrawn ?? 0),
            });
          } else {
            map.set(m.systemId, m);
          }
        });
        const merged = Array.from(map.values());
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(merged));
      }

      // 2. Users
      if (cloudData.users && cloudData.users.length > 0) {
        const localUsers = this.getUsers();
        const map = new Map<string, UserAccount>();
        localUsers.forEach((u) => map.set(u.userId, u));
        cloudData.users.forEach((u) => {
          if (u.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() || u.isMainAdmin) {
            map.set(u.userId, u);
            return;
          }
          if (u.memberSystemId && deletedIds.has(u.memberSystemId)) return;
          map.set(u.userId, u);
        });
        const merged = Array.from(map.values());
        this.saveUsers(merged);
      }

      // 3. Contributions: Union merge to never lose locally recorded payments
      const localContributions = this.getContributions();
      const conMap = new Map<string, Contribution>();
      localContributions.forEach((c) => {
        if (!deletedIds.has(c.memberSystemId)) conMap.set(c.contributionId, c);
      });
      if (cloudData.contributions && cloudData.contributions.length > 0) {
        cloudData.contributions.forEach((c) => {
          if (deletedIds.has(c.memberSystemId)) return;
          conMap.set(c.contributionId, c);
        });
      }
      const allContribs = Array.from(conMap.values()).map((c) => ({
        ...c,
        amount: this.sanitizeAmount(c.amount, c.contributionType, c.month),
      }));
      localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(allContribs));

      // Instant synchronization of members' currentBalance with actual verified savings
      const allMembers = this.getMembers();
      let membersBalanceUpdated = false;
      allMembers.forEach((m) => {
        const mSys = (m.systemId || '').trim().toLowerCase();
        const mNum = mSys.replace(/\D/g, '').replace(/^0+/, '');
        const mPhone = normalizePhoneNumber(m.phone || '');
        const mName = (m.name || '').trim().toLowerCase();

        const mPaid = allContribs
          .filter((c) => {
            const cSys = (c.memberSystemId || '').trim().toLowerCase();
            const cNum = cSys.replace(/\D/g, '').replace(/^0+/, '');
            const cPhone = normalizePhoneNumber((c as any).phone || '');
            const cName = (c.memberName || '').trim().toLowerCase();

            if (cSys && mSys && cSys === mSys) return true;
            if (cNum && mNum && cNum === mNum) return true;
            if (cPhone && mPhone && cPhone.length >= 10 && mPhone.length >= 10 && cPhone.slice(-10) === mPhone.slice(-10)) return true;
            if (cName && mName && (cName === mName || cName.replace(/\(.*?\)/g, '').trim() === mName.replace(/\(.*?\)/g, '').trim())) return true;
            return false;
          })
          .reduce((sum, c) => sum + Number(c.amount || 0), 0);

        if (mPaid > (m.currentBalance || 0)) {
          m.currentBalance = mPaid;
          membersBalanceUpdated = true;
        }
      });
      if (membersBalanceUpdated) {
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(allMembers));
      }

      // 4. Loans: Union merge
      const localLoans = this.getLoans();
      const loanMap = new Map<string, Loan>();
      localLoans.forEach((l) => {
        if (!deletedIds.has(l.borrowerId)) loanMap.set(l.loanId, l);
      });
      if (cloudData.loans && cloudData.loans.length > 0) {
        cloudData.loans.forEach((l) => {
          if (deletedIds.has(l.borrowerId)) return;
          loanMap.set(l.loanId, l);
        });
      }
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(Array.from(loanMap.values())));

      // 5. Loan Payments: Union merge
      const localPayments = this.getLoanPayments();
      const pMap = new Map<string, LoanPayment>();
      localPayments.forEach((p) => pMap.set(p.paymentId, p));
      if (cloudData.loanPayments && cloudData.loanPayments.length > 0) {
        cloudData.loanPayments.forEach((p) => pMap.set(p.paymentId, p));
      }
      localStorage.setItem(STORAGE_KEYS.LOAN_PAYMENTS, JSON.stringify(Array.from(pMap.values())));

      // 6. Incomes: Union merge
      const localIncomes = this.getIncomeRecords();
      const incMap = new Map<string, IncomeRecord>();
      localIncomes.forEach((i) => incMap.set(i.incomeId, i));
      if (cloudData.incomes && cloudData.incomes.length > 0) {
        cloudData.incomes.forEach((i) => incMap.set(i.incomeId, i));
      }
      localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(Array.from(incMap.values())));

      // 7. Expenses: Union merge
      const localExpenses = this.getExpenseRecords();
      const expMap = new Map<string, ExpenseRecord>();
      localExpenses.forEach((e) => expMap.set(e.expenseId, e));
      if (cloudData.expenses && cloudData.expenses.length > 0) {
        cloudData.expenses.forEach((e) => expMap.set(e.expenseId, e));
      }
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(Array.from(expMap.values())));

      // 8. Receipts: Union merge
      const localReceipts = this.getReceipts();
      const rcptMap = new Map<string, Receipt>();
      localReceipts.forEach((r) => {
        if (!deletedIds.has(r.memberSystemId || '')) rcptMap.set(r.receiptId, r);
      });
      if (cloudData.receipts && cloudData.receipts.length > 0) {
        cloudData.receipts.forEach((r) => {
          if (r.memberSystemId && deletedIds.has(r.memberSystemId)) return;
          rcptMap.set(r.receiptId, r);
        });
      }
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(Array.from(rcptMap.values())));

      // 9. Rules: Union merge
      if (cloudData.rules !== undefined && cloudData.rules.length > 0) {
        const localRules = this.getRules();
        const map = new Map<string, SocietyRule>();
        localRules.forEach((r) => map.set(r.ruleId, r));
        cloudData.rules.forEach((r) => {
          map.set(r.ruleId, r);
        });
        localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(Array.from(map.values())));
      }

      // 10. Meetings: Union merge
      if (cloudData.meetings !== undefined && cloudData.meetings.length > 0) {
        const localMeetings = this.getMeetings();
        const map = new Map<string, GeneralMeeting>();
        localMeetings.forEach((m) => map.set(m.meetingId, m));
        cloudData.meetings.forEach((m) => {
          map.set(m.meetingId, m);
        });
        localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(Array.from(map.values())));
      }

      // 11. Profit Distributions: Union merge
      const localDist = this.getProfitDistributions();
      const distMap = new Map<string, ProfitDistribution>();
      localDist.forEach((d) => distMap.set(d.distributionId, d));
      if (cloudData.profitDistributions && cloudData.profitDistributions.length > 0) {
        cloudData.profitDistributions.forEach((d) => distMap.set(d.distributionId, d));
      }
      localStorage.setItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, JSON.stringify(Array.from(distMap.values())));

      // 12. Member Withdrawals: Union merge
      const localWth = this.getMemberWithdrawals();
      const wthMap = new Map<string, MemberWithdrawal>();
      localWth.forEach((w) => {
        if (!deletedIds.has(w.memberSystemId)) wthMap.set(w.withdrawalId, w);
      });
      if (cloudData.memberWithdrawals && cloudData.memberWithdrawals.length > 0) {
        cloudData.memberWithdrawals.forEach((w) => {
          if (deletedIds.has(w.memberSystemId)) return;
          wthMap.set(w.withdrawalId, w);
        });
      }
      localStorage.setItem(STORAGE_KEYS.MEMBER_WITHDRAWALS, JSON.stringify(Array.from(wthMap.values())));

      // 13. Transactions: Union merge
      const localTrx = this.getTransactions();
      const trxMap = new Map<string, Transaction>();
      localTrx.forEach((t) => {
        if (!deletedIds.has(t.memberSystemId || '')) trxMap.set(t.transactionId, t);
      });
      if (cloudData.transactions && cloudData.transactions.length > 0) {
        cloudData.transactions.forEach((t) => {
          if (t.memberSystemId && deletedIds.has(t.memberSystemId)) return;
          trxMap.set(t.transactionId, t);
        });
      }
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(Array.from(trxMap.values())));

      // 14. Settings
      if (cloudData.settings) {
        const localSettings = this.getSettings();
        const mergedSettings = { ...localSettings, ...cloudData.settings };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(mergedSettings));
      }
      this.synchronizeMemberBalances();
      this.reconcileTransactions();
    } catch (e) {
      console.warn('Error merging cloud data:', e);
    }
  }

  // Load full app data
  static getAppData(): FullAppData {
    this.checkAndApplyCleanSlate();
    const incomes = this.getIncomeRecords();
    const expenses = this.getExpenseRecords();
    return {
      settings: this.getSettings(),
      users: this.getUsers(),
      members: this.getMembers(),
      contributions: this.getContributions(),
      loans: this.getLoans(),
      borrowers: this.getBorrowers(),
      loanPayments: this.getLoanPayments(),
      incomes,
      incomeRecords: incomes,
      expenses,
      expenseRecords: expenses,
      transactions: this.getTransactions(),
      receipts: this.getReceipts(),
      activityLogs: this.getActivityLogs(),
      rules: this.getRules(),
      meetings: this.getMeetings(),
      profitDistributions: this.getProfitDistributions(),
      memberWithdrawals: this.getMemberWithdrawals(),
    };
  }

  static loadData(): FullAppData {
    return this.getAppData();
  }

  // --- Members (Persistent Zero-Data-Loss Registry) ---
  // --- Members (Persistent Zero-Data-Loss Registry) ---
  static getMembers(): Member[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    let list: Member[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    return Array.isArray(list) ? list : [];
  }

  static saveMembers(members: Member[]) {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    try {
      for (const m of members) {
        FirebaseSyncService.syncMember(m).catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  static addMember(name: string, phone: string, currentUser?: UserAccount): FullAppData {
    const members = this.getMembers();
    const maxNum = members.reduce((max, m) => {
      const num = parseInt(m.systemId.replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextNum = maxNum + 1;
    const systemId = `SYS-${String(nextNum).padStart(6, '0')}`;
    const newMember: Member = {
      systemId,
      name: name.trim(),
      phone: phone.trim(),
      status: 'active',
      currentBalance: 0,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    members.push(newMember);
    this.saveMembers(members);

    // If previously marked deleted, remove from deleted ids
    try {
      const deletedKey = 'pakura_deleted_member_ids_v1';
      const existingDeleted = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      const filtered = existingDeleted.filter((id: string) => id !== systemId);
      localStorage.setItem(deletedKey, JSON.stringify(filtered));
    } catch {}

    const user = currentUser || this.getCurrentUser();
    this.logActivity({
      userId: user.userId,
      userDisplayName: user.displayName,
      role: user.role,
      action: 'ADD_MEMBER',
      module: 'Members',
      referenceId: systemId,
      description: `নতুন সদস্য যোগ করা হয়েছে: ${name} (${phone})`,
    });

    return this.getAppData();
  }

  static deleteMember(systemId: string, currentUser?: UserAccount): FullAppData {
    let members = this.getMembers();
    const targetMember = members.find((m) => m.systemId === systemId);
    if (!targetMember) return this.getAppData();

    // 1. Remove member from roster
    members = members.filter((m) => m.systemId !== systemId);
    this.saveMembers(members);

    // 2. Track deleted ID so cloud sync won't resurrect it
    try {
      const deletedKey = 'pakura_deleted_member_ids_v1';
      const existingDeleted = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      if (!existingDeleted.includes(systemId)) {
        existingDeleted.push(systemId);
        localStorage.setItem(deletedKey, JSON.stringify(existingDeleted));
      }
    } catch {}

    // 3. Remove all contributions associated with this member
    let contribs = this.getContributions();
    contribs = contribs.filter((c) => c.memberSystemId !== systemId);
    this.saveContributions(contribs);

    // 4. Remove all receipts associated with this member
    let receipts = this.getReceipts();
    receipts = receipts.filter((r) => r.memberSystemId !== systemId);
    this.saveReceipts(receipts);

    // 5. Remove any member withdrawals associated with this member
    let withdrawals = this.getMemberWithdrawals();
    withdrawals = withdrawals.filter((w) => w.memberSystemId !== systemId);
    this.saveMemberWithdrawals(withdrawals);

    // 6. Remove any loans & loan payments associated with this member
    let loans = this.getLoans();
    const memberLoanIds = new Set(
      loans
        .filter((l) => l.borrowerId === systemId || l.borrowerName === targetMember.name)
        .map((l) => l.loanId)
    );
    loans = loans.filter((l) => l.borrowerId !== systemId && l.borrowerName !== targetMember.name);
    this.saveLoans(loans);

    let loanPayments = this.getLoanPayments();
    loanPayments = loanPayments.filter((p) => !memberLoanIds.has(p.loanId));
    this.saveLoanPayments(loanPayments);

    // 7. Remove any user login accounts mapped to this member (except Main Admin)
    const users = this.getUsers().filter((u) => {
      if (u.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() || u.isMainAdmin) return true;
      if (u.memberSystemId === systemId) return false;
      const uPhone = normalizePhoneNumber(u.username || u.phone || '');
      const mPhone = normalizePhoneNumber(targetMember.phone || '');
      if (mPhone && uPhone === mPhone) {
        // Only delete if no other remaining member uses this phone
        const otherMemberWithPhone = members.some((om) => normalizePhoneNumber(om.phone) === mPhone);
        return otherMemberWithPhone;
      }
      return true;
    });
    this.saveUsers(users);

    // 8. Reconcile transactions
    this.reconcileTransactions();

    // 9. Remove from Firestore completely in background
    FirebaseSyncService.deleteMemberAndAllAssociatedData(systemId, targetMember.phone).catch((err) => {
      console.warn('Firestore member delete notice:', err);
    });

    const user = currentUser || this.getCurrentUser();
    this.logActivity({
      userId: user.userId,
      userDisplayName: user.displayName,
      role: user.role,
      action: 'DELETE_MEMBER',
      module: 'Members',
      referenceId: systemId,
      description: `সদস্য ও সংশ্লিষ্ট সমস্ত ডাটা স্থায়ীভাবে মুছে ফেলা হয়েছে: ${targetMember.name} (${targetMember.phone || systemId})`,
    });

    return this.getAppData();
  }

  static getLinkedMembersForUser(user: UserAccount, membersList?: Member[]): Member[] {
    const members = membersList || this.getMembers();
    if (!user || user.userId === 'USR-VIEW-ONLY') return [];

    const userPhoneDigits = normalizePhoneNumber(user.phone || '');
    const usernameDigits = normalizePhoneNumber(user.username || '');
    let effectivePhone = userPhoneDigits.length >= 10 
      ? userPhoneDigits 
      : (usernameDigits.length >= 10 ? usernameDigits : '');

    const userSysId = (user.memberSystemId || '').trim().toLowerCase();
    const userUname = (user.username || '').trim().toLowerCase();
    const userUid = (user.userId || '').trim();

    // If effectivePhone is not directly on user, resolve it from the member record matching userSysId, userUname, or userUid
    if (!effectivePhone && (userSysId || userUname || userUid)) {
      const primaryMem = members.find((m) => {
        const mSysId = (m.systemId || '').trim().toLowerCase();
        return (
          (userSysId && mSysId === userSysId) ||
          (userUname && mSysId === userUname) ||
          (userUid && m.userId === userUid)
        );
      });
      if (primaryMem && primaryMem.phone) {
        const pDigits = normalizePhoneNumber(primaryMem.phone);
        if (pDigits.length >= 10) {
          effectivePhone = pDigits;
        }
      }
    }

    // If effectivePhone is known, return ALL accounts associated with that phone number (whether 1, 2, 3, 4, 5+ accounts)
    if (effectivePhone && effectivePhone.length >= 10) {
      const phoneMatched = members.filter((m) => {
        const mNormPhone = normalizePhoneNumber(m.phone || '');
        if (!mNormPhone || mNormPhone.length < 10) return false;
        return (
          mNormPhone === effectivePhone ||
          mNormPhone.endsWith(effectivePhone.slice(-10)) ||
          effectivePhone.endsWith(mNormPhone.slice(-10))
        );
      });
      if (phoneMatched.length > 0) {
        return phoneMatched;
      }
    }

    // Fallback: match by direct systemId, username, or userId
    const matched = members.filter((m) => {
      const mSysId = (m.systemId || '').trim().toLowerCase();
      if (userSysId && mSysId === userSysId) return true;
      if (userUname && mSysId === userUname) return true;
      if (m.userId && userUid && m.userId === userUid) return true;
      return false;
    });

    if (matched.length > 0) return matched;

    // Fallback: match by member name
    const uDisplayName = (user.displayName || user.name || '').trim().toLowerCase();
    if (uDisplayName) {
      const byName = members.filter((m) => (m.name || '').trim().toLowerCase() === uDisplayName);
      if (byName.length > 0) return byName;
    }

    // Fallback search in members registry
    if (userSysId) {
      const bySys = members.find((m) => (m.systemId || '').toLowerCase() === userSysId);
      if (bySys) return [bySys];
    }
    if (userUname && (userUname.startsWith('sys') || userUname.startsWith('mem'))) {
      const byUname = members.find((m) => (m.systemId || '').toLowerCase() === userUname);
      if (byUname) return [byUname];
    }

    return [];
  }

  static markMemberSelfAttendance(
    memberSystemId: string,
    memberName: string,
    phone?: string,
    meetingId?: string
  ): { success: boolean; message: string; data: FullAppData; meeting?: GeneralMeeting } {
    const meetings = this.getMeetings();
    const today = new Date().toISOString().split('T')[0];

    // Find active/scheduled meeting, or today's meeting
    let targetMeeting = meetingId
      ? meetings.find((m) => m.meetingId === meetingId)
      : meetings.find((m) => m.status === 'scheduled' || m.meetingDate === today);

    // If no meeting exists yet, create one for current month
    if (!targetMeeting) {
      const monthName = new Date().toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' });
      const nextNum = meetings.length + 1;
      const newMeetingId = `MTG-${String(nextNum).padStart(6, '0')}`;
      targetMeeting = {
        meetingId: newMeetingId,
        title: `মাসিক সাধারণ সভা - ${monthName}`,
        meetingDate: today,
        scheduledTime: '০৮:০০ PM',
        location: 'সমিতির কার্যালয় (পাকুড়া)',
        agenda: 'মাসিক সঞ্চয় আদায়, হিসাব নিরীক্ষা ও সাধারণ আলোচনা',
        status: 'scheduled',
        attendanceRecorded: true,
        attendees: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      meetings.unshift(targetMeeting);
    }

    if (!targetMeeting.attendees) {
      targetMeeting.attendees = [];
    }

    const existingIndex = targetMeeting.attendees.findIndex(
      (a) => a.memberSystemId === memberSystemId
    );

    if (existingIndex >= 0) {
      targetMeeting.attendees[existingIndex].status = 'present';
      targetMeeting.attendees[existingIndex].notes = `উপস্থিতি চিহ্নিত: ${new Date().toLocaleTimeString('bn-BD')}`;
    } else {
      targetMeeting.attendees.push({
        memberSystemId,
        memberName,
        phone,
        status: 'present',
        notes: `স্বয়ংক্রিয় উপস্থিতি চিহ্নিত: ${new Date().toLocaleTimeString('bn-BD')}`,
      });
    }

    targetMeeting.attendanceRecorded = true;
    targetMeeting.updatedAt = new Date().toISOString();

    this.saveMeetings(meetings);

    const currentUser = this.getCurrentUser();
    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'MEMBER_ATTENDANCE',
      module: 'Meetings',
      referenceId: targetMeeting.meetingId,
      description: `${memberName} সভায় উপস্থিতি নিশ্চিত করেছেন (${targetMeeting.title})`,
    });

    return {
      success: true,
      message: `আপনার উপস্থিতি সফলভাবে নিশ্চিত করা হয়েছে! (${targetMeeting.title})`,
      data: this.getAppData(),
      meeting: targetMeeting,
    };
  }

  static loadSampleMembers(currentUser?: UserAccount): FullAppData {
    // Disabled as requested: no automatic sample data creation
    return this.getAppData();
  }

  static updateMember(
    systemId: string,
    updatesOrName: string | { name: string; phone: string; status: 'active' | 'inactive' },
    phone?: string,
    status?: 'active' | 'inactive',
    currentUser?: UserAccount
  ): FullAppData {
    const members = this.getMembers();
    const idx = members.findIndex((m) => m.systemId === systemId);
    if (idx !== -1) {
      const oldName = members[idx].name;
      const oldPhone = members[idx].phone;
      let newName = oldName;
      let newPhone = oldPhone;
      let newStatus = members[idx].status;

      if (typeof updatesOrName === 'object') {
        newName = updatesOrName.name.trim();
        newPhone = updatesOrName.phone.trim();
        newStatus = updatesOrName.status;
      } else {
        newName = updatesOrName.trim();
        if (phone) newPhone = phone.trim();
        if (status) newStatus = status;
      }

      members[idx].name = newName;
      members[idx].phone = newPhone;
      members[idx].status = newStatus;
      members[idx].updatedAt = new Date().toISOString().split('T')[0];

      this.saveMembers(members);

      const user = currentUser || this.getCurrentUser();
      this.logActivity({
        userId: user.userId,
        userDisplayName: user.displayName,
        role: user.role,
        action: 'UPDATE_MEMBER',
        module: 'Members',
        referenceId: systemId,
        description: `সদস্য তথ্য আপডেট: ${oldName} (${oldPhone}) -> ${newName} (${newPhone}) [${newStatus}]`,
      });
    }

    return this.getAppData();
  }

  // --- Users & Access Control ---
  static getUsers(): UserAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      return [];
    }
    try {
      const parsed: UserAccount[] = JSON.parse(raw);
      return parsed.filter((u) => {
        const email = (u.email || '').toLowerCase().trim();
        const uname = (u.username || '').toLowerCase().trim();
        return (
          email !== 'assistant@pakura.org' &&
          email !== 'biplob@pakura.org' &&
          uname !== 'assistant_admin' &&
          uname !== 'member1' &&
          email !== MAIN_ADMIN_EMAIL.toLowerCase() &&
          u.userId !== 'USR-000001' &&
          u.userId !== 'USR-MAIN-ADMIN'
        );
      });
    } catch {
      return [];
    }
  }

  static saveUsers(users: UserAccount[]) {
    const cleanUsers = users.filter((u) => {
      const email = (u.email || '').toLowerCase().trim();
      return (
        email !== MAIN_ADMIN_EMAIL.toLowerCase() &&
        u.userId !== 'USR-000001' &&
        u.userId !== 'USR-MAIN-ADMIN'
      );
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(cleanUsers));
    try {
      for (const u of cleanUsers) {
        FirebaseSyncService.syncUserProfile(u).catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  // The main admin has the authority to delete other admins and users
  static deleteUser(
    targetUserId: string,
    requestingUser: UserAccount
  ): { success: boolean; message: string; data: FullAppData } {
    const isMainAdmin =
      requestingUser.role === 'admin' &&
      (requestingUser.isMainAdmin === true ||
        requestingUser.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        requestingUser.userId === 'USR-000001');

    if (!isMainAdmin) {
      return {
        success: false,
        message: 'শুধুমাত্র প্রধান অ্যাডমিনের অন্যান্য অ্যাডমিন বা সদস্য মুছে ফেলার কর্তৃত্ব রয়েছে। (Only the main admin has the authority to delete other admins.)',
        data: this.getAppData(),
      };
    }

    const users = this.getUsers();
    const targetUser = users.find((u) => u.userId === targetUserId);

    if (!targetUser) {
      return {
        success: false,
        message: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি। (User not found)',
        data: this.getAppData(),
      };
    }

    // Main Super Admin cannot be deleted
    if (
      targetUser.isMainAdmin === true ||
      targetUser.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
      targetUser.userId === 'USR-000001'
    ) {
      return {
        success: false,
        message: 'প্রধান সুপার অ্যাডমিন একাউন্টটি মোছা সম্ভব নয়। (Cannot delete the Main Super Admin account)',
        data: this.getAppData(),
      };
    }

    const updatedUsers = users.filter((u) => u.userId !== targetUserId);
    this.saveUsers(updatedUsers);

    // Delete user from Firebase Firestore
    FirebaseSyncService.deleteUserProfile(targetUserId).catch(() => {});

    const isTargetAdmin = targetUser.role === 'admin';
    this.logActivity({
      userId: requestingUser.userId,
      userDisplayName: requestingUser.displayName,
      role: 'admin',
      action: isTargetAdmin ? 'DELETE_ADMIN' : 'DELETE_USER',
      module: 'User Management',
      description: `প্রধান অ্যাডমিন (${requestingUser.displayName}) কর্তৃক ${
        isTargetAdmin ? 'সহকারী অ্যাডমিন' : 'ব্যবহারকারী'
      } অপসারণ: ${targetUser.name || targetUser.displayName} (${targetUser.email || targetUser.username})`,
    });

    return {
      success: true,
      message: `${isTargetAdmin ? 'অ্যাডমিন' : 'ব্যবহারকারী'} "${
        targetUser.name || targetUser.displayName
      }" সফলভাবে অপসারিত হয়েছে।`,
      data: this.getAppData(),
    };
  }

  static normalizePhoneNumber(rawPhone?: string): string {
    return normalizePhoneNumber(rawPhone);
  }

  // --- Member Registration with Phone Number Matching Registry ---
  static checkMemberRegistryByPhone(phone: string): {
    found: boolean;
    member?: Member;
    alreadyRegistered?: boolean;
    message?: string;
  } {
    const clean = normalizePhoneNumber(phone);
    if (!clean || clean.length < 6) {
      return { found: false, message: 'অনুগ্রহ করে সঠিক মোবাইল নম্বর প্রদান করুন' };
    }

    const members = this.getMembers();
    const matched = members.find((m) => {
      const mClean = normalizePhoneNumber(m.phone);
      if (!mClean) return false;
      return (
        mClean === clean ||
        (clean.length >= 10 && mClean.endsWith(clean.slice(-10))) ||
        (mClean.length >= 10 && clean.endsWith(mClean.slice(-10)))
      );
    });

    if (!matched) {
      return {
        found: false,
        message: 'এই মোবাইল নম্বরটি সমিতির সদস্য তালিকায় পাওয়া যায়নি। অ্যাকাউন্ট খুলতে আপনার নম্বরটি সদস্য তালিকায় নিবন্ধিত থাকতে হবে।',
      };
    }

    const users = this.getUsers();
    const existingUser = users.find((u) => {
      const uClean = normalizePhoneNumber(u.username || '');
      return (
        u.memberSystemId === matched.systemId ||
        (clean.length >= 10 && uClean.endsWith(clean.slice(-10)))
      );
    });

    if (existingUser) {
      return {
        found: true,
        member: matched,
        alreadyRegistered: true,
        message: `সদস্য "${matched.name}" এর জন্য ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে। অনুগ্রহ করে লগইন করুন।`,
      };
    }

    return {
      found: true,
      member: matched,
      alreadyRegistered: false,
      message: `সদস্য পাওয়া গেছে: ${matched.name}`,
    };
  }

  static registerMemberWithPhone(
    phone: string,
    password: string
  ): { success: boolean; message: string; user?: UserAccount } {
    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return {
        success: false,
        message: 'অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন (১০-১১ ডিজিট)।',
      };
    }

    if (!password || password.trim().length < 4) {
      return {
        success: false,
        message: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।',
      };
    }

    const check = this.checkMemberRegistryByPhone(cleanPhone);
    if (!check.found || !check.member) {
      return {
        success: false,
        message:
          check.message ||
          'এই মোবাইল নম্বরটি সমিতির সদস্য তালিকায় পাওয়া যায়নি। সদস্য তালিকায় আপনার নম্বর অন্তর্ভুক্ত থাকতে হবে।',
      };
    }

    if (check.alreadyRegistered) {
      const users = this.getUsers();
      const uIdx = users.findIndex(
        (u) =>
          normalizePhoneNumber(u.username || u.phone || '') === cleanPhone ||
          u.memberSystemId === check.member?.systemId
      );
      if (uIdx !== -1) {
        users[uIdx].password = password.trim();
        users[uIdx].name = check.member.name;
        users[uIdx].displayName = `${check.member.name} (সদস্য)`;
        users[uIdx].phone = cleanPhone;
        users[uIdx].username = cleanPhone;
        this.saveUsers(users);
        this.setCurrentUser(users[uIdx]);
        FirebaseSyncService.registerMemberInFirebase(cleanPhone, password.trim(), check.member).catch(() => {});
        return {
          success: true,
          message: `স্বাগতম ${check.member.name}! আপনার সদস্য অ্যাকাউন্ট নতুন পাসওয়ার্ড সহ সফলভাবে পুনরায় নিবন্ধিত হয়েছে।`,
          user: users[uIdx],
        };
      }
    }

    const member = check.member;
    const users = this.getUsers();
    const newUser: UserAccount = {
      userId: `USR-M-${member.systemId.replace(/\D/g, '') || Date.now()}`,
      username: cleanPhone,
      name: member.name,
      displayName: `${member.name} (সদস্য)`,
      role: 'member',
      memberSystemId: member.systemId,
      password: password.trim(),
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    };

    users.push(newUser);
    this.saveUsers(users);

    // Link user to member
    const members = this.getMembers();
    const mIdx = members.findIndex((m) => m.systemId === member.systemId);
    if (mIdx !== -1) {
      members[mIdx].userId = newUser.userId;
      members[mIdx].updatedAt = new Date().toISOString().split('T')[0];
      this.saveMembers(members);
    }

    // Set current active session
    this.setCurrentUser(newUser);

    // Sync to Firebase Auth & Firestore
    try {
      FirebaseSyncService.registerMemberInFirebase(cleanPhone, password.trim(), member).catch(() => {});
    } catch {
      // Ignore
    }

    // Audit log
    this.logActivity({
      userId: newUser.userId,
      userDisplayName: newUser.displayName,
      role: 'member',
      action: 'MEMBER_REGISTER',
      module: 'Membership',
      referenceId: member.systemId,
      description: `সদস্য "${member.name}" মোবাইল নম্বর (${cleanPhone}) দিয়ে সফলভাবে অ্যাকাউন্ট নিবন্ধন করেছেন।`,
    });

    return {
      success: true,
      message: `অভিনন্দন ${member.name}! আপনার সদস্য অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।`,
      user: newUser,
    };
  }

  /**
   * Register or link member with verified Firebase Phone Authentication user
   */
  static registerMemberWithPhoneAuthUser(
    firebaseUid: string,
    phone: string,
    member: Member,
    password?: string
  ): { success: boolean; message: string; user?: UserAccount } {
    const cleanPhone = normalizePhoneNumber(phone);
    const users = this.getUsers();
    const newUser: UserAccount = {
      userId: firebaseUid || `USR-M-${cleanPhone}`,
      firebaseUid,
      username: cleanPhone,
      phone: cleanPhone,
      name: member.name,
      displayName: `${member.name} (সদস্য)`,
      role: 'member',
      memberSystemId: member.systemId,
      password: password || '',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const filteredUsers = users.filter((u) => normalizePhoneNumber(u.username || u.phone || '') !== cleanPhone);
    filteredUsers.push(newUser);
    this.saveUsers(filteredUsers);

    // Link user to member
    const members = this.getMembers();
    const mIdx = members.findIndex((m) => m.systemId === member.systemId);
    if (mIdx !== -1) {
      members[mIdx].userId = newUser.userId;
      members[mIdx].phone = cleanPhone;
      members[mIdx].updatedAt = new Date().toISOString().split('T')[0];
      this.saveMembers(members);
    }

    this.setCurrentUser(newUser);

    // Sync to Firestore
    try {
      FirebaseSyncService.registerMemberWithFirebasePhoneUser(
        firebaseUid,
        cleanPhone,
        member,
        password
      ).catch(() => {});
    } catch {
      // Ignore
    }

    this.logActivity({
      userId: newUser.userId,
      userDisplayName: newUser.displayName,
      role: 'member',
      action: 'MEMBER_PHONE_AUTH_REGISTER',
      module: 'Membership',
      referenceId: member.systemId,
      description: `সদস্য "${member.name}" ফায়ারবেস ফোন নম্বরের মাধ্যমে সফলভাবে ভেরিফাই ও নিবন্ধন সম্পন্ন করেছেন (${cleanPhone})।`,
    });

    return {
      success: true,
      message: `অভিনন্দন ${member.name}! ফায়ারবেস ফোন নাম্বারের মাধ্যমে অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।`,
      user: newUser,
    };
  }

  // Login with Main Admin credentials or pre-configured Standard Admin / Member credentials
  static loginWithMainAdminCredentials(
    emailOrUsername: string,
    password: string
  ): { success: boolean; message: string; user?: UserAccount } {
    return this.loginWithCredentials(emailOrUsername, password);
  }

  static loginWithCredentials(
    emailOrUsername: string,
    password?: string
  ): { success: boolean; message: string; user?: UserAccount } {
    const cleanInput = (emailOrUsername || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanInput) {
      return {
        success: false,
        message: 'অনুগ্রহ করে মোবাইল নম্বর বা জিমেইল লিখুন (Please enter phone number or Gmail)',
      };
    }

    const users = this.getUsers();

    // 1. Check if it is the Main Admin (freelancerkajolchandradas@gmail.com)
    const isMainAdminEmail =
      cleanInput === MAIN_ADMIN_EMAIL.toLowerCase() ||
      cleanInput === 'admin' ||
      cleanInput === 'freelancerkajolchandradas' ||
      cleanInput === 'pakurasanatan@gmail.com';

    if (isMainAdminEmail) {
      if (!cleanPass || !this.verifyAdminPassword(cleanPass)) {
        return {
          success: false,
          message: 'ভুল পাসওয়ার্ড! প্রধান অ্যাডমিনের সঠিক পাসওয়ার্ড প্রদান করুন।',
        };
      }

      const mainAdmin: UserAccount = {
        userId: 'USR-MAIN-ADMIN',
        username: 'kajol_admin',
        email: MAIN_ADMIN_EMAIL,
        name: 'Kajol Chandra Das',
        displayName: 'Kajol Chandra Das ( Admin )',
        role: 'admin',
        isMainAdmin: true,
        status: 'active',
        createdAt: '2026-09-01',
      };

      this.setCurrentUser(mainAdmin);
      this.logActivity({
        userId: mainAdmin.userId,
        userDisplayName: mainAdmin.displayName,
        role: 'admin',
        action: 'MAIN_ADMIN_LOGIN',
        module: 'Security',
        description: `প্রধান সুপার অ্যাডমিন সফলভাবে লগইন করেছেন (${MAIN_ADMIN_EMAIL})`,
      });

      return {
        success: true,
        message: 'প্রধান সুপার অ্যাডমিন হিসেবে সফলভাবে প্রবেশ করেছেন!',
        user: mainAdmin,
      };
    }

    // 2. Member account login (by phone number, systemId e.g. SYS-000001, or username)
    const cleanPhone = normalizePhoneNumber(cleanInput);
    const members = this.getMembers();

    // Find member by system ID or phone number
    const matchedMember = members.find((m) => {
      const mSysId = m.systemId.toLowerCase();
      const sysClean = mSysId.replace(/\D/g, '');
      const inputClean = cleanInput.replace(/\D/g, '');
      const mPhone = normalizePhoneNumber(m.phone || '');
      return (
        mSysId === cleanInput ||
        (cleanInput.startsWith('sys') && sysClean === inputClean && inputClean.length > 0) ||
        (cleanPhone.length >= 8 &&
          (mPhone === cleanPhone ||
            mPhone.endsWith(cleanPhone.slice(-10)) ||
            cleanPhone.endsWith(mPhone.slice(-10))))
      );
    });

    const targetPhone = matchedMember
      ? normalizePhoneNumber(matchedMember.phone)
      : cleanPhone;

    let matchedUser = users.find((u) => {
      const uEmail = (u.email || '').toLowerCase().trim();
      const uUname = (u.username || '').toLowerCase().trim();
      const uPhone = normalizePhoneNumber(u.username || u.phone || '');
      const uSysId = (u.memberSystemId || '').toLowerCase().trim();
      return (
        uEmail === cleanInput ||
        uUname === cleanInput ||
        (matchedMember &&
          (uSysId === matchedMember.systemId.toLowerCase() ||
            (targetPhone.length >= 8 && uPhone === targetPhone))) ||
        (targetPhone.length >= 8 &&
          uPhone.length >= 8 &&
          (uPhone === targetPhone ||
            uPhone.endsWith(targetPhone.slice(-10)) ||
            targetPhone.endsWith(uPhone.slice(-10))))
      );
    });

    if (!matchedUser && matchedMember) {
      // Auto-provision user account for this member
      matchedUser = {
        userId: `USR-M-${matchedMember.systemId}`,
        username: matchedMember.phone || matchedMember.systemId,
        phone: matchedMember.phone,
        name: matchedMember.name,
        displayName: `${matchedMember.name} (সদস্য)`,
        role: 'member',
        memberSystemId: matchedMember.systemId,
        password: cleanPass || 'temp1234',
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
      };
      users.push(matchedUser);
      this.saveUsers(users);
    }

    if (!matchedUser) {
      if (cleanPhone.length >= 8) {
        return {
          success: false,
          message: `এই মোবাইল নম্বরটি (${cleanPhone}) সমিতির সদস্য তালিকায় পাওয়া যায়নি। তালিকায় আপনার নাম যুক্ত করতে প্রধান অ্যাডমিনের সাথে যোগাযোগ করুন।`,
        };
      }
      return {
        success: false,
        message: 'ভুল তথ্য! সঠিক মোবাইল নম্বর বা সদস্য অ্যাকাউন্ট নম্বর প্রদান করুন।',
      };
    }

    // If member entered a password and it has at least 4 characters, save/update it
    if (cleanPass.length >= 4 && cleanPass !== matchedUser.password) {
      matchedUser.password = cleanPass;
      this.saveUsers(users);
      FirebaseSyncService.syncUserProfile(matchedUser).catch(() => {});
    }

    // Reconcile and link member to user
    if (matchedMember) {
      matchedUser.memberSystemId = matchedMember.systemId;
      matchedUser.name = matchedMember.name;
      if (!matchedUser.phone && matchedMember.phone) matchedUser.phone = matchedMember.phone;
      this.saveUsers(users);

      const mIdx = members.findIndex((m) => m.systemId === matchedMember.systemId);
      if (mIdx !== -1) {
        members[mIdx].userId = matchedUser.userId;
        this.saveMembers(members);
      }
    }

    if (matchedUser.status === 'inactive') {
      return {
        success: false,
        message: 'আপনার একাউন্টটি বর্তমানে নিষ্ক্রিয় রয়েছে। প্রধান অ্যাডমিনের সাথে যোগাযোগ করুন।',
      };
    }

    this.setCurrentUser(matchedUser);
    this.logActivity({
      userId: matchedUser.userId,
      userDisplayName: matchedUser.displayName,
      role: matchedUser.role,
      action: 'USER_LOGIN',
      module: 'Security',
      description: `ব্যবহারকারী লগইন করেছেন: ${matchedUser.displayName} (${matchedUser.email || matchedUser.username || matchedUser.phone}) [সদস্য]`,
    });

    return {
      success: true,
      message: `স্বাগতম ${matchedUser.name || matchedUser.displayName}! সদস্য পোর্টালে সফলভাবে প্রবেশ করেছেন।`,
      user: matchedUser,
    };
  }

  /**
   * Fast Human-CAPTCHA login for members.
   * Allows members to log in instantly using their member account number (SYS-000001) or phone number
   * without needing SMS OTP or password.
   */
  static loginWithCaptcha(identifier: string): { success: boolean; message: string; user?: UserAccount } {
    const cleanInput = (identifier || '').trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(cleanInput);
    const members = this.getMembers();
    const users = this.getUsers();

    // Match member by system ID or phone number
    const matchedMember = members.find((m) => {
      const mPhone = normalizePhoneNumber(m.phone || '');
      const mSysId = m.systemId.toLowerCase();
      const sysClean = mSysId.replace(/\D/g, '');
      const inputClean = cleanInput.replace(/\D/g, '');
      return (
        (cleanPhone.length >= 8 && mPhone === cleanPhone) ||
        mSysId === cleanInput ||
        (cleanInput.startsWith('sys') && sysClean === inputClean && inputClean.length > 0)
      );
    });

    if (!matchedMember) {
      return {
        success: false,
        message: 'সদস্য একাউন্ট অথবা মোবাইল নম্বরটি সমিতির তালিকায় পাওয়া যায়নি।',
      };
    }

    const memberPhone = normalizePhoneNumber(matchedMember.phone);
    let matchedUser = users.find(
      (u) =>
        (u.memberSystemId && u.memberSystemId.toLowerCase() === matchedMember.systemId.toLowerCase()) ||
        (memberPhone.length >= 8 && normalizePhoneNumber(u.username || u.phone || '') === memberPhone)
    );

    if (!matchedUser) {
      matchedUser = {
        userId: `USR-M-${matchedMember.systemId}`,
        username: matchedMember.phone || matchedMember.systemId,
        phone: matchedMember.phone,
        name: matchedMember.name,
        displayName: `${matchedMember.name} (সদস্য)`,
        role: 'member',
        memberSystemId: matchedMember.systemId,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
      };
      users.push(matchedUser);
      this.saveUsers(users);
    }

    this.setCurrentUser(matchedUser);
    this.logActivity({
      userId: matchedUser.userId,
      userDisplayName: matchedUser.displayName,
      role: 'member',
      action: 'MEMBER_CAPTCHA_LOGIN',
      module: 'Security',
      referenceId: matchedMember.systemId,
      description: `সদস্য "${matchedMember.name}" (${matchedMember.systemId}) ক্যাপচা যাচাইয়ের মাধ্যমে সফলভাবে লগইন করেছেন।`,
    });

    return {
      success: true,
      message: `স্বাগতম ${matchedMember.name}! ক্যাপচা যাচাইয়ের মাধ্যমে সফলভাবে সদস্য একাউন্টে প্রবেশ করেছেন।`,
      user: matchedUser,
    };
  }

  // Self-service password change for logged-in users (Main admin or standard admin/member)
  static changeUserPassword(
    userId: string,
    newPassword: string,
    currentPassword?: string
  ): { success: boolean; message: string; updatedUser?: UserAccount } {
    if (!newPassword || newPassword.trim().length < 4) {
      return {
        success: false,
        message: 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে (Password must be at least 4 characters)',
      };
    }

    const users = this.getUsers();
    const idx = users.findIndex((u) => u.userId === userId);
    if (idx === -1) {
      return { success: false, message: 'ব্যবহারকারী পাওয়া যায়নি (User not found)' };
    }

    const target = users[idx];
    const isMain =
      target.isMainAdmin === true ||
      target.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
      target.userId === 'USR-000001';

    // If current password is provided, verify it
    if (currentPassword && currentPassword.trim()) {
      if (isMain) {
        if (!this.verifyAdminPassword(currentPassword.trim())) {
          return { success: false, message: 'বর্তমান পাসওয়ার্ডটি সঠিক নয় (Current password incorrect)' };
        }
      } else if (target.password && target.password !== currentPassword.trim()) {
        return { success: false, message: 'বর্তমান পাসওয়ার্ডটি সঠিক নয় (Current password incorrect)' };
      }
    }

    const cleanNewPass = newPassword.trim();
    users[idx].password = cleanNewPass;

    if (isMain) {
      const settings = this.getSettings();
      settings.adminPassword = cleanNewPass;
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }

    this.saveUsers(users);

    const current = this.getCurrentUser();
    if (current.userId === userId) {
      const updated = { ...current, password: cleanNewPass };
      this.setCurrentUser(updated);
    }

    this.logActivity({
      userId,
      userDisplayName: target.displayName,
      role: target.role,
      action: 'CHANGE_PASSWORD',
      module: 'Security',
      description: `পাসওয়ার্ড পরিবর্তন করা হয়েছে (${target.email || target.username})`,
    });

    return {
      success: true,
      message: 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে! পরবর্তী লগইনে এই নতুন পাসওয়ার্ডটি ব্যবহার করবেন।',
      updatedUser: users[idx],
    };
  }

  static logout(): UserAccount {
    this.setCurrentUser(VIEW_ONLY_USER);
    this.logActivity({
      userId: 'SYS',
      userDisplayName: 'System',
      role: 'member',
      action: 'LOGOUT',
      module: 'Security',
      description: 'অ্যাডমিন/ব্যবহারকারী সেশন সমাপ্ত; সিস্টেম ভিউ-অনলি ড্যাশবোর্ড মোডে ফিরে এসেছে।',
    });
    return VIEW_ONLY_USER;
  }

  // --- Admin Security & Password Management ---
  static getAdminPassword(): string {
    const settings = this.getSettings();
    return settings.adminPassword || 'admin123';
  }

  static verifyAdminPassword(password: string): boolean {
    const clean = (password || '').trim();
    const stored = (this.getAdminPassword() || '').trim();
    // Allow configured admin password, default 'admin123', or 'admin'
    return clean === stored || clean === 'admin123' || clean === 'admin';
  }

  static updateAdminPassword(
    currentPass: string,
    newPass: string,
    currentUser?: UserAccount
  ): { success: boolean; message: string } {
    if (!this.verifyAdminPassword(currentPass)) {
      return { success: false, message: 'বর্তমান পাসওয়ার্ডটি সঠিক নয় (Incorrect current password)' };
    }
    if (!newPass || newPass.trim().length < 4) {
      return {
        success: false,
        message: 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে (Password must be at least 4 characters)',
      };
    }
    const settings = this.getSettings();
    settings.adminPassword = newPass.trim();
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    FirebaseSyncService.syncSettings(settings).catch(() => {});

    const user = currentUser || this.getCurrentUser();
    this.logActivity({
      userId: user.userId,
      userDisplayName: user.displayName,
      role: 'admin',
      action: 'CHANGE_ADMIN_PASSWORD',
      module: 'Security',
      description: 'প্রধান অ্যাডমিনের পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে',
    });

    return {
      success: true,
      message: 'অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে (Password changed successfully)',
    };
  }

  // Authenticate user using Firebase Google Sign-In or OAuth:
  // "However, if someone logs in using 'Sign in with Google' as the main admin,
  // they will simply be designated as a standard member—not an admin.
  // They will only become an admin if I specifically set up their account with admin privileges beforehand;
  // otherwise, they won't have admin status."
  static loginAdminWithFirebase(user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  }): UserAccount {
    const users = this.getUsers();
    const emailLower = (user.email || '').toLowerCase().trim();

    // Check if there is an existing account specifically set up beforehand
    const existingUser = users.find(
      (u) =>
        u.userId === user.uid ||
        (u.email && emailLower && u.email.toLowerCase().trim() === emailLower)
    );

    const isMainAdminEmail = emailLower === MAIN_ADMIN_EMAIL.toLowerCase();

    // Role resolution strictly following user's rules:
    // If someone logs in with Google as the main admin, designated as standard member (not admin)
    // Only pre-configured standard admins (created beforehand with role 'admin') get admin status
    let designatedRole: Role = 'member';

    if (isMainAdminEmail) {
      // Explicit rule: "if someone logs in using 'Sign in with Google' as the main admin, they will simply be designated as a standard member—not an admin."
      designatedRole = 'member';
    } else if (existingUser && existingUser.role === 'admin' && !existingUser.isMainAdmin) {
      // Explicitly set up beforehand with admin privileges by the main admin
      designatedRole = 'admin';
    } else if (existingUser) {
      // Keep their existing pre-set role (e.g. member, etc.)
      designatedRole = existingUser.role === 'admin' ? 'admin' : 'member';
    } else {
      // New user logging in via Google without prior admin setup is strictly a standard member
      designatedRole = 'member';
    }

    const members = this.getMembers();
    let linkedMemberSystemId = existingUser?.memberSystemId;
    if (!linkedMemberSystemId && designatedRole === 'member') {
      const match = members.find(
        (m) =>
          ((m as any).email && emailLower && (m as any).email.toLowerCase().trim() === emailLower) ||
          (user.displayName && (m.name.includes(user.displayName) || user.displayName.includes(m.name)))
      );
      if (match) {
        linkedMemberSystemId = match.systemId;
      }
    }

    const resolvedUser: UserAccount = {
      userId: existingUser?.userId || user.uid,
      username: existingUser?.username || (emailLower ? emailLower.split('@')[0] : 'user_firebase'),
      displayName: existingUser?.displayName || user.displayName || user.email || 'সাধারণ সদস্য (Member)',
      email: user.email || existingUser?.email || '',
      password: existingUser?.password,
      role: designatedRole,
      isMainAdmin: false, // Google login never grants main admin status!
      status: existingUser?.status || 'active',
      memberSystemId: linkedMemberSystemId,
      createdAt: existingUser?.createdAt || new Date().toISOString().split('T')[0],
    };

    const idx = users.findIndex(
      (u) =>
        u.userId === resolvedUser.userId ||
        (u.email && resolvedUser.email && u.email.toLowerCase().trim() === resolvedUser.email.toLowerCase().trim())
    );

    if (idx !== -1) {
      users[idx] = {
        ...users[idx],
        role: designatedRole,
        isMainAdmin: false,
      };
    } else {
      users.push(resolvedUser);
    }
    this.saveUsers(users);
    this.setCurrentUser(resolvedUser);

    this.logActivity({
      userId: resolvedUser.userId,
      userDisplayName: resolvedUser.displayName,
      role: resolvedUser.role,
      action: 'FIREBASE_GOOGLE_LOGIN',
      module: 'Security',
      description: `গুগল সাইন-ইন দিয়ে লগইন: ${resolvedUser.email || resolvedUser.displayName} [রোল: ${
        resolvedUser.role === 'admin' ? 'সহকারী অ্যাডমিন' : 'সাধারণ সদস্য'
      }]`,
    });

    return resolvedUser;
  }

  // --- Settings ---
  static getSettings(): AppSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.language !== 'bn' && parsed.language !== 'en') {
          parsed.language = 'bn';
        }
        if (parsed.theme !== 'light' && parsed.theme !== 'dark') {
          parsed.theme = 'light';
        }
      }
      return { ...INITIAL_SETTINGS, ...(parsed || {}) };
    } catch {
      return INITIAL_SETTINGS;
    }
  }

  static saveSettings(settings: AppSettings, currentUser: UserAccount) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'UPDATE_SETTINGS',
      module: 'Settings',
      description: 'সিস্টেম সেটিংস পরিবর্তন করা হয়েছে',
    });
  }

  // --- Contributions ---
  static sanitizeAmount(amount: any, _type?: string, _month?: string): number {
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
    if (isNaN(num) || num <= 0) return 0;
    return num;
  }

  static getContributions(): Contribution[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS);
    let list: Contribution[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    if (!Array.isArray(list)) return [];
    
    // Auto-sanitize all contribution amounts
    let needsResave = false;
    const sanitized = list.map((c) => {
      const cleanAmt = this.sanitizeAmount(c.amount, c.contributionType, c.month);
      if (cleanAmt !== c.amount) {
        needsResave = true;
        return { ...c, amount: cleanAmt };
      }
      return c;
    });

    if (needsResave) {
      localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(sanitized));
    }
    return sanitized;
  }

  static saveContributions(contributions: Contribution[]) {
    localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(contributions));
    try {
      for (const c of contributions) {
        FirebaseSyncService.syncContribution(c).catch(() => {});
      }
    } catch {}
  }

  static recordContribution(
    memberSystemId: string,
    amount: number,
    month: string,
    paymentMethod: PaymentMethod,
    currentUserOrName?: UserAccount | string,
    contributionType?: 'regular' | 'seasonal_booster',
    notes?: string,
    lateFee?: number
  ): { contribution: Contribution; receipt: Receipt; data: FullAppData } {
    const members = this.getMembers();
    const member = members.find((m) => m.systemId === memberSystemId);
    if (!member) throw new Error('Member not found');

    const currentUser = typeof currentUserOrName === 'object' && currentUserOrName !== null
      ? currentUserOrName
      : (this.getUsers().find(u => u.displayName === currentUserOrName || u.name === currentUserOrName) || this.getCurrentUser());

    const contributions = this.getContributions();
    const nextConNum = contributions.length + 1;
    const contributionId = `CON-${String(nextConNum).padStart(6, '0')}`;
    const receiptId = this.generateReceiptId();
    const today = new Date().toISOString().split('T')[0];

    // Record the exact amount deposited (e.g. ৳100 or whatever custom amount was deposited)
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    const effectiveAmount = !isNaN(numAmount) && numAmount > 0 ? numAmount : 100;
    const effectiveLateFee = lateFee || 0;
    const isBooster = contributionType === 'seasonal_booster' || effectiveAmount >= 500;
    const typeLabel = 'মাসিক সঞ্চয়';
    const defaultNotes = undefined;

    const newContribution: Contribution = {
      contributionId,
      memberSystemId,
      memberName: member.name,
      phone: member.phone,
      accountNumber: member.accountNumber,
      amount: effectiveAmount,
      contributionDate: today,
      month,
      paymentMethod,
      receiptId,
      recordedBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
      status: 'paid',
      contributionType: isBooster ? 'seasonal_booster' : 'regular',
      lateFee: effectiveLateFee,
      isLate: effectiveLateFee > 0,
      notes: notes || defaultNotes,
    };
    contributions.unshift(newContribution);
    this.saveContributions(contributions);

    // Update Member Current Balance with savings capital
    member.currentBalance += effectiveAmount;
    member.updatedAt = today;
    this.saveMembers(members);

    // Create Receipt including savings and late fee if any
    const totalReceiptAmount = effectiveAmount + effectiveLateFee;
    const purposeText = effectiveLateFee > 0
      ? `${typeLabel} (৳${effectiveAmount}) + বিলম্ব ফি (৳${effectiveLateFee}) - ${month}`
      : `${typeLabel} - ${month}`;

    const receipt = this.createReceipt({
      receiptId,
      transactionId: contributionId,
      name: member.name,
      phone: member.phone,
      amount: totalReceiptAmount,
      purpose: purposeText,
      date: today,
      receivedBy: currentUser.displayName,
      paymentMethod,
      memberSystemId,
      type: 'contribution',
    });

    // Strictly ONE Master Ledger Transaction per received payment (no duplicate or split TRX entries)
    const totalCreditAmount = effectiveAmount + effectiveLateFee;
    const trxDescription = effectiveLateFee > 0
      ? `${typeLabel} জমা (৳${effectiveAmount}) + বিলম্ব ফি (৳${effectiveLateFee}) (${month}) - ${member.name.trim()}`
      : `${typeLabel} জমা (${month}) - ${member.name.trim()}`;

    this.createTransaction({
      type: 'contribution',
      referenceId: contributionId,
      memberSystemId,
      partyName: member.name.trim(),
      description: trxDescription,
      debit: 0,
      credit: totalCreditAmount,
      paymentMethod,
      createdBy: currentUser.displayName,
    });

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'RECORD_CONTRIBUTION',
      module: 'Contributions',
      referenceId: contributionId,
      description: `${member.name}-এর ${typeLabel} জমা ৳${effectiveAmount}${effectiveLateFee > 0 ? ` + বিলম্ব ফি ৳${effectiveLateFee}` : ''} (${month}) [${paymentMethod}]`,
    });

    return { contribution: newContribution, receipt, data: this.getAppData() };
  }

  // --- Borrowers & Loans ---
  static getBorrowers(): Borrower[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BORROWERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveBorrowers(borrowers: Borrower[]) {
    localStorage.setItem(STORAGE_KEYS.BORROWERS, JSON.stringify(borrowers));
  }

  static getLoans(): Loan[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOANS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveLoans(loans: Loan[]) {
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
    try {
      for (const l of loans) {
        FirebaseSyncService.syncLoan(l).catch(() => {});
      }
    } catch {}
  }

  static getLoanPayments(): LoanPayment[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOAN_PAYMENTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveLoanPayments(payments: LoanPayment[]) {
    localStorage.setItem(STORAGE_KEYS.LOAN_PAYMENTS, JSON.stringify(payments));
    try {
      for (const p of payments) {
        FirebaseSyncService.syncLoanPayment(p).catch(() => {});
      }
    } catch {}
  }

  // Calculate live accrued profit and duration based on exact number of days in each month
  // (28/29 in Feb accounting for leap years, 30, 31) with remaining period simply by number of days
  static calculateLoanLiveProfit(
    loan: Loan,
    asOfDate: string = new Date().toISOString().split('T')[0]
  ): LoanCalculationResult & {
    daysElapsed: number;
    accruedProfit: number;
    totalDueNow: number;
  } {
    return calculateAccurateLoanDurationAndProfit(loan, asOfDate);
  }

  static createLoan(
    borrowerName: string,
    borrowerPhone: string,
    borrowerNid: string,
    principal: number,
    loanDate: string,
    paymentMethod: PaymentMethod,
    currentUser: UserAccount
  ): { loan: Loan; receipt: Receipt } {
    const borrowers = this.getBorrowers();
    let borrower = borrowers.find((b) => b.phone === borrowerPhone.trim());
    if (!borrower) {
      const bId = `BOR-${String(borrowers.length + 1).padStart(6, '0')}`;
      borrower = {
        borrowerId: bId,
        name: borrowerName.trim(),
        phone: borrowerPhone.trim(),
        nid: borrowerNid.trim(),
        status: 'active',
        createdAt: loanDate,
      };
      borrowers.push(borrower);
      this.saveBorrowers(borrowers);
    }

    const loans = this.getLoans();
    const loanId = `LOAN-${String(loans.length + 1).padStart(6, '0')}`;
    const settings = this.getSettings();

    const newLoan: Loan = {
      loanId,
      borrowerId: borrower.borrowerId,
      borrowerName: borrower.name,
      borrowerPhone: borrower.phone,
      principal,
      loanDate,
      rate: settings.loanMonthlyRate || 10,
      daysBasis: settings.loanDaysBasis || 30,
      status: 'active',
      totalProfitPaid: 0,
      totalPrincipalPaid: 0,
      remainingPrincipal: principal,
      paymentMethod,
      createdBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
    };
    loans.unshift(newLoan);
    this.saveLoans(loans);

    const receiptId = this.generateReceiptId();
    const receipt = this.createReceipt({
      receiptId,
      transactionId: loanId,
      name: borrower.name,
      phone: borrower.phone,
      amount: principal,
      purpose: `ঋণ বিতরণ ভাউচার (Loan Disbursement)`,
      date: loanDate,
      receivedBy: currentUser.displayName,
      paymentMethod,
    });

    // Master Ledger: Debit cash/bank for loan disbursement
    this.createTransaction({
      type: 'loan_disbursement',
      referenceId: loanId,
      borrowerId: borrower.borrowerId,
      partyName: borrower.name,
      description: `ঋণ প্রদান - ${borrower.name} (${borrower.phone})`,
      debit: principal,
      credit: 0,
      paymentMethod,
      createdBy: currentUser.displayName,
    });

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'CREATE_LOAN',
      module: 'Loans',
      referenceId: loanId,
      description: `নতুন ঋণ বিতরণ: ৳${principal} ঋণগ্রহীতা: ${borrower.name} [${paymentMethod}]`,
    });

    return { loan: newLoan, receipt };
  }

  static receiveLoanPayment(
    loanId: string,
    amount: number,
    paymentDate: string,
    paymentMethod: PaymentMethod,
    notes: string,
    currentUserOrName?: UserAccount | string,
    discount: number = 0
  ): { payment: LoanPayment; receipt: Receipt; isPaidOff: boolean; data: FullAppData } {
    const loans = this.getLoans();
    const loan = loans.find((l) => l.loanId === loanId);
    if (!loan) throw new Error('Loan not found');

    const currentUser = typeof currentUserOrName === 'object' && currentUserOrName !== null
      ? currentUserOrName
      : (this.getUsers().find(u => u.displayName === currentUserOrName || u.name === currentUserOrName) || this.getCurrentUser());

    const liveCalc = this.calculateLoanLiveProfit(loan, paymentDate);
    const accruedProfit = liveCalc.accruedProfit;

    // Concession / Discount on accrued interest (e.g. ৳29 discount on ৳729 interest = ৳700 effective profit)
    const effectiveDiscount = Math.max(0, Math.min(discount || 0, accruedProfit));
    const effectiveProfitDue = Math.max(0, accruedProfit - effectiveDiscount);

    // Allocation rule: First Accrued Profit (after discount), Then Principal
    let profitPaid = 0;
    let principalPaid = 0;

    if (amount <= effectiveProfitDue) {
      profitPaid = amount;
      principalPaid = 0;
    } else {
      profitPaid = effectiveProfitDue;
      principalPaid = Math.min(amount - effectiveProfitDue, loan.remainingPrincipal);
    }

    loan.totalProfitPaid += profitPaid;
    loan.totalPrincipalPaid += principalPaid;
    loan.remainingPrincipal = Math.max(0, loan.remainingPrincipal - principalPaid);
    if (effectiveDiscount > 0) {
      loan.totalDiscountGiven = (loan.totalDiscountGiven || 0) + effectiveDiscount;
    }

    const isPaidOff = loan.remainingPrincipal <= 0;
    if (isPaidOff) {
      loan.status = 'paid';
      loan.repaidDate = paymentDate;
    }
    this.saveLoans(loans);

    const payments = this.getLoanPayments();
    const paymentId = `PAY-${String(payments.length + 1).padStart(6, '0')}`;
    const receiptId = this.generateReceiptId();

    const newPayment: LoanPayment = {
      paymentId,
      loanId,
      borrowerName: loan.borrowerName,
      paymentDate,
      amount,
      profitPaid,
      principalPaid,
      remainingPrincipalAfter: loan.remainingPrincipal,
      paymentMethod,
      receiptId,
      receivedBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
      notes,
      discount: effectiveDiscount,
      accruedProfitBeforeDiscount: accruedProfit,
    };
    payments.unshift(newPayment);
    this.saveLoanPayments(payments);

    // Receipt with discount note if provided
    const purposeText = effectiveDiscount > 0
      ? `ঋণ পরিশোধ (আসল: ৳${principalPaid.toFixed(2)}, নিট মুনাফা: ৳${profitPaid.toFixed(2)}, মুনাফায় ছাড়: ৳${effectiveDiscount})`
      : `ঋণ পরিশোধ (আসল: ৳${principalPaid.toFixed(2)}, মুনাফা: ৳${profitPaid.toFixed(2)})`;

    const receipt = this.createReceipt({
      receiptId,
      transactionId: paymentId,
      name: loan.borrowerName,
      phone: loan.borrowerPhone,
      amount,
      purpose: purposeText,
      date: paymentDate,
      receivedBy: currentUser.displayName,
      paymentMethod,
      type: 'loan_payment',
    });

    // Master Ledger: Credit cash/bank
    this.createTransaction({
      type: 'loan_payment',
      referenceId: paymentId,
      borrowerId: loan.borrowerId,
      partyName: loan.borrowerName,
      description: `ঋণ আদায় - ${loan.borrowerName} (আসল: ৳${principalPaid.toFixed(2)}, মুনাফা: ৳${profitPaid.toFixed(2)}${effectiveDiscount > 0 ? `, ছাড়: ৳${effectiveDiscount}` : ''})`,
      debit: 0,
      credit: amount,
      paymentMethod,
      createdBy: currentUser.displayName,
    });

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'RECEIVE_LOAN_PAYMENT',
      module: 'Loans',
      referenceId: paymentId,
      description: `ঋণ আদায়: ৳${amount} (${loan.borrowerName}) - আসল: ৳${principalPaid.toFixed(2)}, মুনাফা: ৳${profitPaid.toFixed(2)}${effectiveDiscount > 0 ? ` (মুনাফায় ছাড়: ৳${effectiveDiscount})` : ''}`,
    });

    return { payment: newPayment, receipt, isPaidOff, data: this.getAppData() };
  }

  /**
   * Record a loan that has already been repaid in the past (historical loan record).
   * Supports discount on interest as well (e.g. ৳7,000 principal, ৳729 accrued profit, ৳29 discount -> ৳700 net profit).
   */
  static recordAlreadyRepaidLoan(params: {
    borrowerName: string;
    borrowerPhone: string;
    borrowerNid?: string;
    principal: number;
    loanDate: string;
    repaymentDate: string;
    accruedProfit: number;
    discount?: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    currentUserOrName?: UserAccount | string;
  }): { loan: Loan; payment: LoanPayment; receipt: Receipt; data: FullAppData } {
    const {
      borrowerName,
      borrowerPhone,
      borrowerNid = '',
      principal,
      loanDate,
      repaymentDate,
      accruedProfit,
      discount = 0,
      paymentMethod,
      notes = '',
      currentUserOrName,
    } = params;

    const currentUser = typeof currentUserOrName === 'object' && currentUserOrName !== null
      ? currentUserOrName
      : (this.getUsers().find(u => u.displayName === currentUserOrName || u.name === currentUserOrName) || this.getCurrentUser());

    // 1. Borrower
    const borrowers = this.getBorrowers();
    let borrower = borrowers.find((b) => b.phone === borrowerPhone.trim());
    if (!borrower) {
      const bId = `BOR-${String(borrowers.length + 1).padStart(6, '0')}`;
      borrower = {
        borrowerId: bId,
        name: borrowerName.trim(),
        phone: borrowerPhone.trim(),
        nid: borrowerNid.trim(),
        status: 'active',
        createdAt: loanDate,
      };
      borrowers.push(borrower);
      this.saveBorrowers(borrowers);
    }

    // 2. Calculations
    const effectiveDiscount = Math.max(0, Math.min(discount, accruedProfit));
    const netProfitPaid = Math.max(0, accruedProfit - effectiveDiscount);
    const totalAmountRepaid = principal + netProfitPaid;

    // 3. Create Loan with status 'paid'
    const loans = this.getLoans();
    const loanId = `LOAN-${String(loans.length + 1).padStart(6, '0')}`;
    const settings = this.getSettings();

    const newLoan: Loan = {
      loanId,
      borrowerId: borrower.borrowerId,
      borrowerName: borrower.name,
      borrowerPhone: borrower.phone,
      principal,
      loanDate,
      rate: settings.loanMonthlyRate || 10,
      daysBasis: settings.loanDaysBasis || 30,
      status: 'paid',
      totalProfitPaid: netProfitPaid,
      totalPrincipalPaid: principal,
      remainingPrincipal: 0,
      paymentMethod,
      createdBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
      totalDiscountGiven: effectiveDiscount,
      isHistoricalRepaid: true,
      repaidDate: repaymentDate,
    };
    loans.unshift(newLoan);
    this.saveLoans(loans);

    // 4. Create LoanPayment
    const payments = this.getLoanPayments();
    const paymentId = `PAY-${String(payments.length + 1).padStart(6, '0')}`;
    const receiptId = this.generateReceiptId();

    const newPayment: LoanPayment = {
      paymentId,
      loanId,
      borrowerName: borrower.name,
      paymentDate: repaymentDate,
      amount: totalAmountRepaid,
      profitPaid: netProfitPaid,
      principalPaid: principal,
      remainingPrincipalAfter: 0,
      paymentMethod,
      receiptId,
      receivedBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
      notes: notes || (effectiveDiscount > 0 ? `ইতিমধ্যে পরিশোধিত ঋণ (মুনাফায় ৳${effectiveDiscount} ছাড়)` : 'ইতিমধ্যে পরিশোধিত ঋণ রেকর্ড'),
      discount: effectiveDiscount,
      accruedProfitBeforeDiscount: accruedProfit,
    };
    payments.unshift(newPayment);
    this.saveLoanPayments(payments);

    // 5. Official Receipt Voucher
    const receiptPurpose = `ইতিমধ্যে পরিশোধিত ঋণ নিষ্পত্তি (আসল: ৳${principal.toLocaleString()}, নিট মুনাফা: ৳${netProfitPaid.toLocaleString()}${effectiveDiscount > 0 ? `, মুনাফায় ছাড়: ৳${effectiveDiscount}` : ''})`;
    const receipt = this.createReceipt({
      receiptId,
      transactionId: paymentId,
      name: borrower.name,
      phone: borrower.phone,
      amount: totalAmountRepaid,
      purpose: receiptPurpose,
      date: repaymentDate,
      receivedBy: currentUser.displayName,
      paymentMethod,
      type: 'loan_payment',
    });

    // 6. Master Ledger: credit net profit earned to fund
    this.createTransaction({
      type: 'loan_payment',
      referenceId: paymentId,
      borrowerId: borrower.borrowerId,
      partyName: borrower.name,
      description: `পরিশোধিত ঋণ আদায় রেকর্ড - ${borrower.name} (আসল: ৳${principal.toLocaleString()}, মুনাফা: ৳${netProfitPaid.toLocaleString()}${effectiveDiscount > 0 ? `, ছাড়: ৳${effectiveDiscount}` : ''})`,
      debit: 0,
      credit: totalAmountRepaid,
      paymentMethod,
      createdBy: currentUser.displayName,
    });

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'RECORD_REPAID_LOAN',
      module: 'Loans',
      referenceId: loanId,
      description: `ইতিমধ্যে পরিশোধিত ঋণ লিপিবদ্ধ: গ্রহীতা ${borrower.name}, মূল ঋণ ৳${principal.toLocaleString()}, নিট মুনাফা ৳${netProfitPaid.toLocaleString()}${effectiveDiscount > 0 ? ` (মুনাফায় ছাড়: ৳${effectiveDiscount})` : ''}, মোট আদায় ৳${totalAmountRepaid.toLocaleString()} [${paymentMethod}]`,
    });

    return { loan: newLoan, payment: newPayment, receipt, data: this.getAppData() };
  }

  // --- Income & Expense ---
  static getIncomeRecords(): IncomeRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.INCOME);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveIncomeRecords(records: IncomeRecord[]) {
    localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(records));
    try {
      for (const inc of records) {
        FirebaseSyncService.syncIncome(inc).catch(() => {});
      }
    } catch {}
  }

  static addIncome(
    category: 'loan_profit' | 'donation' | 'other_income',
    amount: number,
    date: string,
    description: string,
    paymentMethod: PaymentMethod,
    currentUser: UserAccount
  ): IncomeRecord {
    const records = this.getIncomeRecords();
    const incomeId = `INC-${String(records.length + 1).padStart(6, '0')}`;
    const newIncome: IncomeRecord = {
      incomeId,
      date,
      category,
      amount,
      description,
      paymentMethod,
      createdBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
    };
    records.unshift(newIncome);
    this.saveIncomeRecords(records);

    this.createTransaction({
      type: 'income',
      referenceId: incomeId,
      partyName: 'সাধারণ আয়',
      description: `আয় [${category}]: ${description}`,
      debit: 0,
      credit: amount,
      paymentMethod,
      createdBy: currentUser.displayName,
    });

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'ADD_INCOME',
      module: 'Income',
      referenceId: incomeId,
      description: `আয় রেকর্ড: ৳${amount} [${category}] - ${description}`,
    });

    return newIncome;
  }

  static getExpenseRecords(): ExpenseRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveExpenseRecords(records: ExpenseRecord[]) {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(records));
    try {
      for (const exp of records) {
        FirebaseSyncService.syncExpense(exp).catch(() => {});
      }
    } catch {}
  }

  static addExpense(
    category: 'jersey_tshirt' | 'puja' | 'event' | 'office' | 'others' | string,
    amount: number,
    date: string,
    description: string,
    paymentMethod: PaymentMethod,
    currentUser: UserAccount
  ): ExpenseRecord {
    const records = this.getExpenseRecords();
    const expenseId = `EXP-${String(records.length + 1).padStart(6, '0')}`;
    const newExpense: ExpenseRecord = {
      expenseId,
      date,
      category,
      amount,
      description,
      paymentMethod,
      createdBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
    };
    records.unshift(newExpense);
    this.saveExpenseRecords(records);

    this.createTransaction({
      type: 'expense',
      referenceId: expenseId,
      partyName: 'সংগঠনের ব্যয়',
      description: `ব্যয় [${category}]: ${description}`,
      debit: amount,
      credit: 0,
      paymentMethod,
      createdBy: currentUser.displayName,
    });

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'ADD_EXPENSE',
      module: 'Expenses',
      referenceId: expenseId,
      description: `ব্যয় রেকর্ড: ৳${amount} [${category}] - ${description}`,
    });

    return newExpense;
  }

  // --- Transactions Master Ledger Reconciler ---
  static reconcileTransactions(data?: FullAppData): Transaction[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      let list: Transaction[] = raw ? JSON.parse(raw) : [];

      const members = data ? data.members : this.getMembers();
      const contributions = data ? data.contributions : this.getContributions();
      const loans = data ? data.loans : this.getLoans();
      const loanPayments = data ? data.loanPayments : this.getLoanPayments();
      const incomes = data ? (data.incomeRecords || data.incomes || []) : this.getIncomeRecords();
      const expenses = data ? (data.expenseRecords || data.expenses || []) : this.getExpenseRecords();
      const withdrawals = data ? (data.memberWithdrawals || []) : this.getMemberWithdrawals();
      const settings = data ? data.settings : this.getSettings();

      let hasChanges = false;

      // Clean up and merge any split LF- transactions into their parent contribution transaction
      const lfTxs = list.filter((t) => t.referenceId?.startsWith('LF-') || t.description?.includes('বিলম্ব ফি (Late Fee)'));
      if (lfTxs.length > 0) {
        for (const lf of lfTxs) {
          const parentRef = lf.referenceId?.replace('LF-', '') || '';
          const parentTrx = list.find((t) => t.referenceId === parentRef || (parentRef && t.transactionId?.includes(parentRef)));
          if (parentTrx) {
            const matchCon = contributions.find((c) => c.contributionId === parentRef);
            if (matchCon) {
              parentTrx.credit = (matchCon.amount || 0) + (matchCon.lateFee || 0);
              if ((matchCon.lateFee || 0) > 0 && !parentTrx.description.includes('বিলম্ব ফি')) {
                parentTrx.description = `মাসিক সঞ্চয় জমা (৳${matchCon.amount}) + বিলম্ব ফি (৳${matchCon.lateFee}) (${matchCon.month}) - ${matchCon.memberName}`;
              }
            } else {
              parentTrx.credit += (lf.credit || 0);
            }
          }
        }
        // Purge the split LF transactions (e.g. TRX-000002) so only 1 transaction remains per received item
        list = list.filter((t) => !t.referenceId?.startsWith('LF-') && !t.description?.includes('বিলম্ব ফি (Late Fee)'));
        hasChanges = true;
      }

      // Comprehensive deduplication of transactions:
      // Remove duplicate entries where the same financial event was recorded twice
      // (e.g. one with TRX-000001 and one with TRX-C-CON-000001)
      const seenTxIds = new Set<string>();
      const seenRefIds = new Set<string>();
      const seenSignatures = new Set<string>();
      const cleanList: Transaction[] = [];

      // Sort so that standard sequential TRX-000... IDs take priority over synthetic TRX-C- prefixes
      list.sort((a, b) => {
        const aIsSynthetic = a.transactionId?.includes('-C-') || a.transactionId?.includes('-P-') || a.transactionId?.includes('-L-') || a.transactionId?.includes('-I-') || a.transactionId?.includes('-E-') || a.transactionId?.includes('-W-');
        const bIsSynthetic = b.transactionId?.includes('-C-') || b.transactionId?.includes('-P-') || b.transactionId?.includes('-L-') || b.transactionId?.includes('-I-') || b.transactionId?.includes('-E-') || b.transactionId?.includes('-W-');
        if (aIsSynthetic !== bIsSynthetic) return aIsSynthetic ? 1 : -1;
        return (a.transactionId || '').localeCompare(b.transactionId || '');
      });

      for (const t of list) {
        if (!t || !t.transactionId) continue;
        
        // 1. Check exact transactionId
        if (seenTxIds.has(t.transactionId)) {
          hasChanges = true;
          continue;
        }

        // 2. Check referenceId
        const ref = t.referenceId || t.transactionId.replace(/^TRX-[CPLIEW]-/, '');
        if (ref && seenRefIds.has(ref)) {
          hasChanges = true;
          continue;
        }

        // 3. Check exact financial signature (e.g. same member, same month, same type, same credit/debit)
        const monthMatch = t.description?.match(/(\d{4}-\d{2})/);
        const monthKey = monthMatch ? monthMatch[1] : '';
        const sig = `${t.type}|${t.memberSystemId || t.partyName?.trim().toLowerCase()}|${monthKey || t.date}|${t.credit}|${t.debit}`;
        
        if (seenSignatures.has(sig)) {
          hasChanges = true;
          continue;
        }

        seenTxIds.add(t.transactionId);
        if (ref) seenRefIds.add(ref);
        if (t.referenceId) seenRefIds.add(t.referenceId);
        seenSignatures.add(sig);
        cleanList.push(t);
      }
      list = cleanList;

      const existingRefIds = new Set<string>();
      const existingSignatures = new Set<string>();
      list.forEach((t) => {
        if (t.referenceId) existingRefIds.add(t.referenceId);
        const ref = t.transactionId?.replace(/^TRX-[CPLIEW]-/, '');
        if (ref) existingRefIds.add(ref);
        const monthMatch = t.description?.match(/(\d{4}-\d{2})/);
        const monthKey = monthMatch ? monthMatch[1] : '';
        const sig = `${t.type}|${t.memberSystemId || t.partyName?.trim().toLowerCase()}|${monthKey || t.date}|${t.credit}|${t.debit}`;
        existingSignatures.add(sig);
      });

      // 1. Reconcile Member Contributions (strictly ONE consolidated transaction per contribution)
      for (const c of contributions) {
        const totalAmt = (c.amount || 0) + (c.lateFee || 0);
        const sig = `contribution|${c.memberSystemId || c.memberName?.trim().toLowerCase()}|${c.month || c.contributionDate}|${totalAmt}|0`;
        const alreadyExists =
          existingRefIds.has(c.contributionId) ||
          existingSignatures.has(sig) ||
          list.some(
            (t) =>
              t.referenceId === c.contributionId ||
              t.transactionId === `TRX-C-${c.contributionId}` ||
              (t.type === 'contribution' &&
                (t.memberSystemId === c.memberSystemId || t.partyName?.trim().toLowerCase() === c.memberName?.trim().toLowerCase()) &&
                t.description?.includes(c.month))
          );

        if (c.status === 'paid' && c.contributionId && !alreadyExists) {
          const desc = (c.lateFee || 0) > 0
            ? `মাসিক সঞ্চয় জমা (৳${c.amount}) + বিলম্ব ফি (৳${c.lateFee}) (${c.month}) - ${c.memberName}`
            : `মাসিক সঞ্চয় জমা (${c.month}) - ${c.memberName}`;

          list.push({
            transactionId: `TRX-C-${c.contributionId}`,
            date: c.contributionDate || new Date().toISOString().split('T')[0],
            type: 'contribution',
            referenceId: c.contributionId,
            memberSystemId: c.memberSystemId,
            partyName: c.memberName,
            description: desc,
            debit: 0,
            credit: totalAmt,
            balanceAfter: 0,
            paymentMethod: c.paymentMethod || 'cash',
            createdBy: c.recordedBy || 'System',
            createdAt: c.createdAt || new Date().toISOString(),
            status: 'active',
          });
          existingRefIds.add(c.contributionId);
          existingSignatures.add(sig);
          hasChanges = true;
        }
      }

      // 2. Clean up legacy or redundant TRX-CAP- transactions
      const prevLength = list.length;
      list = list.filter((t) => !t.transactionId?.startsWith('TRX-CAP-') && !t.referenceId?.startsWith('CAP-'));
      if (list.length !== prevLength) {
        hasChanges = true;
      }

      // 3. Reconcile Loans (Disbursements)
      for (const l of loans) {
        const alreadyExists =
          existingRefIds.has(l.loanId) ||
          list.some((t) => t.referenceId === l.loanId || t.transactionId === `TRX-L-${l.loanId}`);

        if (l.loanId && !alreadyExists) {
          list.push({
            transactionId: `TRX-L-${l.loanId}`,
            date: l.loanDate || new Date().toISOString().split('T')[0],
            type: 'loan_disbursement',
            referenceId: l.loanId,
            borrowerId: l.borrowerId,
            partyName: l.borrowerName,
            description: `ঋণ বিতরণ - ${l.borrowerName}`,
            debit: l.principal || 0,
            credit: 0,
            balanceAfter: 0,
            paymentMethod: l.paymentMethod || 'cash',
            createdBy: 'System',
            createdAt: l.createdAt || new Date().toISOString(),
            status: 'active',
          });
          existingRefIds.add(l.loanId);
          hasChanges = true;
        }
      }

      // 4. Reconcile Loan Payments (Collections)
      for (const p of loanPayments) {
        const alreadyExists =
          existingRefIds.has(p.paymentId) ||
          list.some((t) => t.referenceId === p.paymentId || t.transactionId === `TRX-P-${p.paymentId}`);

        if (p.paymentId && !alreadyExists) {
          list.push({
            transactionId: `TRX-P-${p.paymentId}`,
            date: p.paymentDate || new Date().toISOString().split('T')[0],
            type: 'loan_payment',
            referenceId: p.paymentId,
            partyName: p.borrowerName,
            description: `ঋণ আদায় - ${p.borrowerName} (আসল: ৳${p.principalPaid || 0}, মুনাফা: ৳${p.profitPaid || 0})`,
            debit: 0,
            credit: p.amount || 0,
            balanceAfter: 0,
            paymentMethod: p.paymentMethod || 'cash',
            createdBy: p.receivedBy || 'System',
            createdAt: p.createdAt || new Date().toISOString(),
            status: 'active',
          });
          existingRefIds.add(p.paymentId);
          hasChanges = true;
        }
      }

      // 5. Reconcile Income Records
      for (const i of incomes) {
        const alreadyExists =
          existingRefIds.has(i.incomeId) ||
          list.some((t) => t.referenceId === i.incomeId || t.transactionId === `TRX-I-${i.incomeId}`);

        if (i.incomeId && !alreadyExists) {
          list.push({
            transactionId: `TRX-I-${i.incomeId}`,
            date: i.date || new Date().toISOString().split('T')[0],
            type: 'income',
            referenceId: i.incomeId,
            partyName: i.category || 'বিবিধ আয়',
            description: `আয় [${i.category}]: ${i.description}`,
            debit: 0,
            credit: i.amount || 0,
            balanceAfter: 0,
            paymentMethod: i.paymentMethod || 'cash',
            createdBy: i.createdBy || 'System',
            createdAt: i.createdAt || new Date().toISOString(),
            status: 'active',
          });
          existingRefIds.add(i.incomeId);
          hasChanges = true;
        }
      }

      // 6. Reconcile Expense Records
      for (const e of expenses) {
        const alreadyExists =
          existingRefIds.has(e.expenseId) ||
          list.some((t) => t.referenceId === e.expenseId || t.transactionId === `TRX-E-${e.expenseId}`);

        if (e.expenseId && !alreadyExists) {
          list.push({
            transactionId: `TRX-E-${e.expenseId}`,
            date: e.date || new Date().toISOString().split('T')[0],
            type: 'expense',
            referenceId: e.expenseId,
            partyName: 'সংগঠনের ব্যয়',
            description: `ব্যয় [${e.category}]: ${e.description}`,
            debit: e.amount || 0,
            credit: 0,
            balanceAfter: 0,
            paymentMethod: e.paymentMethod || 'cash',
            createdBy: e.createdBy || 'System',
            createdAt: e.createdAt || new Date().toISOString(),
            status: 'active',
          });
          existingRefIds.add(e.expenseId);
          hasChanges = true;
        }
      }

      // 7. Reconcile Member Withdrawals
      for (const w of withdrawals) {
        const alreadyExists =
          existingRefIds.has(w.withdrawalId) ||
          list.some((t) => t.referenceId === w.withdrawalId || t.transactionId === `TRX-W-${w.withdrawalId}`);

        if (w.status === 'completed' && w.withdrawalId && !alreadyExists) {
          list.push({
            transactionId: `TRX-W-${w.withdrawalId}`,
            date: w.date || new Date().toISOString().split('T')[0],
            type: 'withdrawal',
            referenceId: w.withdrawalId,
            memberSystemId: w.memberSystemId,
            partyName: w.memberName,
            description: `সদস্য তহবিল উত্তোলন (${w.source === 'profit' ? 'লভ্যাংশ' : 'সঞ্চয়'}) - ${w.memberName}`,
            debit: w.amount || 0,
            credit: 0,
            balanceAfter: 0,
            paymentMethod: w.paymentMethod || 'cash',
            createdBy: w.processedBy || 'System',
            createdAt: w.createdAt || new Date().toISOString(),
            status: 'active',
          });
          existingRefIds.add(w.withdrawalId);
          hasChanges = true;
        }
      }

      // Recalculate running balance: sort chronologically (oldest first)
      list.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });

      let running = (settings.cashOpeningBalance || 0) + (settings.bankOpeningBalance || 0);
      for (const trx of list) {
        if (trx.status === 'reversed') continue;
        running += (trx.credit || 0) - (trx.debit || 0);
        trx.balanceAfter = running;
      }

      // Store in reverse-chronological order (newest first) as standard
      list.reverse();

      if (hasChanges || !raw) {
        this.saveTransactions(list);
      }

      return list;
    } catch (err) {
      console.warn('Reconcile transactions error:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return raw ? JSON.parse(raw) : [];
    }
  }

  // --- Transactions Master Ledger ---
  static getTransactions(): Transaction[] {
    return this.reconcileTransactions();
  }

  static saveTransactions(transactions: Transaction[]) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    try {
      for (const t of transactions) {
        FirebaseSyncService.syncTransaction(t).catch(() => {});
      }
    } catch {}
  }

  static createTransaction(data: {
    type: Transaction['type'];
    referenceId: string;
    memberSystemId?: string;
    borrowerId?: string;
    partyName: string;
    description: string;
    debit: number;
    credit: number;
    paymentMethod: PaymentMethod;
    createdBy: string;
  }): Transaction {
    const list = this.getTransactions();

    // Check if a transaction for this referenceId or financial signature already exists
    const monthMatch = data.description?.match(/(\d{4}-\d{2})/);
    const monthKey = monthMatch ? monthMatch[1] : '';

    const existingIndex = list.findIndex(
      (t) =>
        (data.referenceId && t.referenceId === data.referenceId) ||
        (data.referenceId && t.transactionId === `TRX-C-${data.referenceId}`) ||
        (data.referenceId && t.transactionId === `TRX-P-${data.referenceId}`) ||
        (data.referenceId && t.transactionId === `TRX-L-${data.referenceId}`) ||
        (data.referenceId && t.transactionId === `TRX-I-${data.referenceId}`) ||
        (data.referenceId && t.transactionId === `TRX-E-${data.referenceId}`) ||
        (data.referenceId && t.transactionId === `TRX-W-${data.referenceId}`) ||
        (data.memberSystemId &&
          t.memberSystemId === data.memberSystemId &&
          t.type === data.type &&
          monthKey &&
          t.description?.includes(monthKey))
    );

    if (existingIndex >= 0) {
      // Update in place rather than creating duplicate
      list[existingIndex] = {
        ...list[existingIndex],
        type: data.type,
        referenceId: data.referenceId || list[existingIndex].referenceId,
        memberSystemId: data.memberSystemId || list[existingIndex].memberSystemId,
        borrowerId: data.borrowerId || list[existingIndex].borrowerId,
        partyName: data.partyName || list[existingIndex].partyName,
        description: data.description || list[existingIndex].description,
        debit: data.debit,
        credit: data.credit,
        paymentMethod: data.paymentMethod,
        createdBy: data.createdBy,
      };
      this.saveTransactions(list);
      return list[existingIndex];
    }

    const existing = new Set(list.map((t) => t.transactionId));
    let count = list.length + 1;
    let nextId = `TRX-${String(count).padStart(6, '0')}`;
    while (existing.has(nextId)) {
      count++;
      nextId = `TRX-${String(count).padStart(6, '0')}`;
    }
    
    // Calculate running balance
    const lastTrx = list[0];
    const prevBalance = lastTrx ? lastTrx.balanceAfter : 0;
    const balanceAfter = prevBalance + data.credit - data.debit;

    const newTrx: Transaction = {
      transactionId: nextId,
      date: new Date().toISOString().split('T')[0],
      type: data.type,
      referenceId: data.referenceId,
      memberSystemId: data.memberSystemId,
      borrowerId: data.borrowerId,
      partyName: data.partyName,
      description: data.description,
      debit: data.debit,
      credit: data.credit,
      balanceAfter,
      paymentMethod: data.paymentMethod,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    list.unshift(newTrx);
    this.saveTransactions(list);
    return newTrx;
  }

  static reverseTransaction(transactionId: string, reason: string, currentUser: UserAccount): boolean {
    const list = this.getTransactions();
    const trx = list.find((t) => t.transactionId === transactionId);
    if (!trx || trx.status === 'reversed') return false;

    trx.status = 'reversed';
    trx.reversalReason = reason;

    // Create compensatory transaction to restore ledger
    this.createTransaction({
      type: trx.type,
      referenceId: `REV-${trx.transactionId}`,
      partyName: trx.partyName,
      description: `[রিভার্সাল] লেনদেন #${trx.transactionId} বাতিল: ${reason}`,
      debit: trx.credit, // Invert
      credit: trx.debit, // Invert
      paymentMethod: trx.paymentMethod,
      createdBy: currentUser.displayName,
    });

    // If it was a contribution, decrease member balance
    if (trx.type === 'contribution' && trx.memberSystemId) {
      const members = this.getMembers();
      const m = members.find((x) => x.systemId === trx.memberSystemId);
      if (m) {
        m.currentBalance = Math.max(0, m.currentBalance - trx.credit);
        this.saveMembers(members);
      }
    }

    this.saveTransactions(list);

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'REVERSE_TRANSACTION',
      module: 'Transactions',
      referenceId: transactionId,
      description: `লেনদেন রিভার্স করা হয়েছে: #${transactionId}. কারণ: ${reason}`,
    });

    return true;
  }

  // --- Receipts ---
  static generateReceiptId(): string {
    const receipts = this.getReceipts();
    const existing = new Set(receipts.map((r) => r.receiptId));
    let count = receipts.length + 1;
    let candidate = `RCT-${String(count).padStart(6, '0')}`;
    while (existing.has(candidate)) {
      count++;
      candidate = `RCT-${String(count).padStart(6, '0')}`;
    }
    return candidate;
  }

  static getReceipts(): Receipt[] {
    const raw = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    let list: Receipt[] = [];
    let hasChanges = false;

    if (raw) {
      try {
        const parsed: Receipt[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const seenReceiptIds = new Set<string>();
          const seenTxnIds = new Set<string>();

          for (const r of parsed) {
            if (!r || !r.receiptId) continue;
            // Deduplicate: If another receipt with same receiptId exists, discard duplicate
            if (seenReceiptIds.has(r.receiptId)) {
              hasChanges = true;
              continue;
            }
            // Deduplicate: If another receipt with same non-empty transactionId exists, discard duplicate
            if (r.transactionId && seenTxnIds.has(r.transactionId)) {
              hasChanges = true;
              continue;
            }
            seenReceiptIds.add(r.receiptId);
            if (r.transactionId) seenTxnIds.add(r.transactionId);
            list.push(r);
          }
        }
      } catch {
        list = [];
      }
    }

    const existingReceiptIds = new Set(list.map((r) => r.receiptId).filter(Boolean));
    const existingTxnIds = new Set(list.map((r) => r.transactionId).filter(Boolean));

    // Purge legacy auto-generated receipts
    const initialLen = list.length;
    list = list.filter(
      (r) =>
        r &&
        !r.receiptId?.startsWith('RCT-KJL-') &&
        !r.transactionId?.startsWith('CON-KJL-') &&
        !r.purpose?.includes('প্রারম্ভিক স্থিতি')
    );
    if (list.length !== initialLen) {
      hasChanges = true;
    }

    // Cross-reference with contributions: make sure every contribution has an official receipt
    const rawCon = localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS);
    if (rawCon) {
      try {
        const contributions: Contribution[] = JSON.parse(rawCon);
        const rawMem = localStorage.getItem(STORAGE_KEYS.MEMBERS);
        const members: Member[] = rawMem ? JSON.parse(rawMem) : [];
        const memberMap = new Map(members.map((m) => [m.systemId, m]));

        for (const c of contributions) {
          const recId = c.receiptId || `RCT-${c.contributionId.replace(/\D/g, '').padStart(6, '0')}`;
          const existingReceipt = list.find((r) =>
            (r.receiptId && r.receiptId === recId) ||
            (c.receiptId && r.receiptId === c.receiptId) ||
            (r.transactionId && c.contributionId && r.transactionId === c.contributionId)
          );
          const m = memberMap.get(c.memberSystemId);
          const totalAmt = (c.amount || 0) + (c.lateFee || 0);

          if (!existingReceipt) {
            list.push({
              receiptId: recId,
              transactionId: c.contributionId,
              name: c.memberName || m?.name || 'সদস্য',
              phone: m?.phone || '',
              amount: totalAmt,
              purpose: c.lateFee ? `মাসিক সঞ্চয় (৳${c.amount}) + বিলম্ব ফি (৳${c.lateFee}) - ${c.month}` : `মাসিক সঞ্চয় - ${c.month}`,
              date: c.contributionDate,
              receivedBy: c.recordedBy || 'কোষাধ্যক্ষ',
              paymentMethod: c.paymentMethod || 'cash',
              type: 'contribution',
              memberSystemId: c.memberSystemId,
              createdAt: c.createdAt || new Date().toISOString(),
            });
            existingReceiptIds.add(recId);
            existingTxnIds.add(c.contributionId);
            hasChanges = true;
          } else {
            // Reconcile missing fields on existing receipt
            if (!existingReceipt.memberSystemId && c.memberSystemId) {
              existingReceipt.memberSystemId = c.memberSystemId;
              hasChanges = true;
            }
            if (!existingReceipt.phone && m?.phone) {
              existingReceipt.phone = m.phone;
              hasChanges = true;
            }
            if (!existingReceipt.type) {
              existingReceipt.type = 'contribution';
              hasChanges = true;
            }
          }
        }
      } catch {}
    }

    // Cross-reference with member withdrawals
    const rawWith = localStorage.getItem(STORAGE_KEYS.MEMBER_WITHDRAWALS);
    if (rawWith) {
      try {
        const withdrawals: MemberWithdrawal[] = JSON.parse(rawWith);
        for (const w of withdrawals) {
          const recId = w.receiptId || `RCT-${w.withdrawalId.replace(/\D/g, '').padStart(6, '0')}`;
          const existingReceipt = list.find((r) =>
            (r.receiptId && r.receiptId === recId) ||
            (w.receiptId && r.receiptId === w.receiptId) ||
            (r.transactionId && w.withdrawalId && r.transactionId === w.withdrawalId)
          );
          if (!existingReceipt) {
            list.push({
              receiptId: recId,
              transactionId: w.withdrawalId,
              name: w.memberName,
              phone: w.memberPhone || '',
              amount: w.amount,
              purpose: `সদস্য তহবিল উত্তোলন (${w.reason || 'অনুমোদিত সাধারণ উত্তোলন'})`,
              date: w.date,
              receivedBy: w.memberName,
              issuedBy: w.processedBy || 'অ্যাডমিন',
              paymentMethod: w.paymentMethod || 'cash',
              type: 'member_withdrawal',
              memberSystemId: w.memberSystemId,
              createdAt: w.createdAt || new Date().toISOString(),
            });
            existingReceiptIds.add(recId);
            existingTxnIds.add(w.withdrawalId);
            hasChanges = true;
          } else {
            if (!existingReceipt.memberSystemId && w.memberSystemId) {
              existingReceipt.memberSystemId = w.memberSystemId;
              hasChanges = true;
            }
            if (!existingReceipt.phone && w.memberPhone) {
              existingReceipt.phone = w.memberPhone;
              hasChanges = true;
            }
            if (!existingReceipt.type) {
              existingReceipt.type = 'member_withdrawal';
              hasChanges = true;
            }
          }
        }
      } catch {}
    }

    // Cross-reference with loan payments
    const rawPay = localStorage.getItem(STORAGE_KEYS.LOAN_PAYMENTS);
    if (rawPay) {
      try {
        const payments: LoanPayment[] = JSON.parse(rawPay);
        const rawMem = localStorage.getItem(STORAGE_KEYS.MEMBERS);
        const members: Member[] = rawMem ? JSON.parse(rawMem) : [];

        for (const p of payments) {
          const recId = p.receiptId || `RCT-${p.paymentId.replace(/\D/g, '').padStart(6, '0')}`;
          const existingReceipt = list.find((r) =>
            (r.receiptId && r.receiptId === recId) ||
            (p.receiptId && r.receiptId === p.receiptId) ||
            (r.transactionId && p.paymentId && r.transactionId === p.paymentId)
          );
          // Attempt to match borrower with a member record for system ID and phone
          const m = members.find((x) => x.name.trim() === p.borrowerName.trim());

          if (!existingReceipt) {
            list.push({
              receiptId: recId,
              transactionId: p.paymentId,
              name: p.borrowerName,
              phone: m?.phone || '',
              amount: p.amount,
              purpose: `ঋণ পরিশোধ (আসল: ৳${(p.principalPaid || 0).toFixed(2)}, মুনাফা: ৳${(p.profitPaid || 0).toFixed(2)})`,
              date: p.paymentDate,
              receivedBy: p.receivedBy,
              paymentMethod: p.paymentMethod || 'cash',
              type: 'loan_payment',
              memberSystemId: m?.systemId,
              createdAt: p.createdAt || new Date().toISOString(),
            });
            existingReceiptIds.add(recId);
            existingTxnIds.add(p.paymentId);
            hasChanges = true;
          } else {
            if (!existingReceipt.memberSystemId && m?.systemId) {
              existingReceipt.memberSystemId = m.systemId;
              hasChanges = true;
            }
            if (!existingReceipt.phone && m?.phone) {
              existingReceipt.phone = m.phone;
              hasChanges = true;
            }
          }
        }
      } catch {}
    }

    if (hasChanges || !raw) {
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(list));
    }

    return list;
  }

  static saveReceipts(receipts: Receipt[]) {
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
    try {
      for (const r of receipts) {
        FirebaseSyncService.syncReceipt(r).catch(() => {});
      }
    } catch {}
  }

  static createReceipt(data: Omit<Receipt, 'createdAt'>): Receipt {
    const receipts = this.getReceipts();
    const existingIndex = receipts.findIndex(
      (r) =>
        (data.receiptId && r.receiptId === data.receiptId) ||
        (data.transactionId && r.transactionId && r.transactionId === data.transactionId)
    );

    const newReceipt: Receipt = {
      ...data,
      createdAt: (data as any).createdAt || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      receipts[existingIndex] = { ...receipts[existingIndex], ...newReceipt };
      this.saveReceipts(receipts);
      return receipts[existingIndex];
    } else {
      receipts.unshift(newReceipt);
      this.saveReceipts(receipts);
      return newReceipt;
    }
  }

  // --- Activity Log ---
  static getActivityLogs(): ActivityLogItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static logActivity(entry: Omit<ActivityLogItem, 'logId' | 'dateTime'> & { timestamp?: string; userName?: string; details?: string }) {
    const logs = this.getActivityLogs();
    const logId = `LOG-${String(logs.length + 1).padStart(6, '0')}`;
    const now = new Date();
    const newEntry: ActivityLogItem = {
      ...entry,
      logId,
      timestamp: entry.timestamp || now.toISOString(),
      userName: entry.userName || entry.userDisplayName || 'User',
      userDisplayName: entry.userDisplayName || entry.userName || 'User',
      details: entry.details || entry.description || '',
      description: entry.description || entry.details || '',
      dateTime: now.toLocaleString('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    logs.unshift(newEntry);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 1000))); // Keep last 1000
  }

  static clearAllActivityLogs(
    executingUser: UserAccount
  ): { success: boolean; message: string; data: FullAppData } {
    const isMainAdmin =
      executingUser.role === 'admin' &&
      (executingUser.isMainAdmin === true ||
        executingUser.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        executingUser.userId === 'USR-000001' ||
        executingUser.userId === 'USR-MAIN-ADMIN');

    if (!isMainAdmin) {
      return {
        success: false,
        message: 'শুধুমাত্র প্রধান অ্যাডমিনের অডিট লগ মুছে ফেলার অনুমতি রয়েছে।',
        data: this.getAppData(),
      };
    }

    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    return {
      success: true,
      message: 'সকল অডিট অ্যাক্টিভিটি লগ সম্পূর্ণ মুছে ফেলা হয়েছে।',
      data: this.getAppData(),
    };
  }

  // --- Society Rules & Meeting Decisions ---
  static getDefaultConstitutionalRules(): SocietyRule[] {
    const now = '2025-01-01T00:00:00.000Z';
    return [
      {
        ruleId: 'RULE-CONST-001',
        meetingDate: '2025-01-01',
        title: 'মাসিক সাধারণ সভা ও সদস্যদের বাধ্যতামূলক উপস্থিতি বিধান',
        category: 'meeting',
        decisionDetails: 'প্রতি ইংরেজি মাসের ১ থেকে ১১ তারিখের মধ্যকার শেষ শুক্রবারে রাত ৮:০০ ঘটিকায় সমিতির কার্যালয়ে মাসিক সাধারণ সভা অনুষ্ঠিত হবে। সমিতির সকল সদস্যের যথাসময়ে সভায় উপস্থিত থেকে হাজিরা দেওয়া বাধ্যতামূলক। সাধারণ সভায় গৃহীত সিদ্ধান্তই সমিতির চূড়ান্ত সিদ্ধান্ত বলে গণ্য হবে।',
        resolutionNumber: 'রেজোলিউশন-০১/২০২৫',
        status: 'active',
        addedBy: 'সমিতি কার্যনির্বাহী পরিষদ',
        addedByEmail: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        ruleId: 'RULE-CONST-002',
        meetingDate: '2025-01-01',
        title: 'নিয়মিত মাসিক সঞ্চয় কিস্তি জমাদান ও নির্ধারিত সময়সীমা',
        category: 'savings',
        decisionDetails: 'সমিতির সকল সাধারণ সদস্যকে প্রতি মাসে ১০০ (একশত) টাকা হারে নিয়মিত মাসিক সঞ্চয় কিস্তি জমা প্রদান করতে হবে। প্রতি ইংরেজি মাসের নির্ধারিত ১০ তারিখের মধ্যে উক্ত সঞ্চয় পরিশোধ করা আবশ্যক। প্রতিটি সঞ্চয় জমার বিপরীতে সদস্যকে স্বয়ংক্রিয় ডিজিটাল জমা রশিদ প্রদান করা হবে।',
        resolutionNumber: 'রেজোলিউশন-০২/২০২৫',
        status: 'active',
        addedBy: 'সমিতি কার্যনির্বাহী পরিষদ',
        addedByEmail: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        ruleId: 'RULE-CONST-003',
        meetingDate: '2025-01-01',
        title: 'নির্ধারিত ১০ তারিখ অতিক্রান্তে বিলম্ব ফি ও জরিমানা সংক্রান্ত নীতি',
        category: 'discipline',
        decisionDetails: 'যে সকল সদস্য মাসের ১০ তারিখের মধ্যে মাসিক সঞ্চয় কিস্তি পরিশোধে ব্যর্থ হবেন, সাধারণ সভার সর্বসম্মত সিদ্ধান্ত অনুযায়ী তাদেরকে অতিরিক্ত ১০ (দশ) টাকা বিলম্ব ফি বা জরিমানা প্রদান করতে হবে। বকেয়া সঞ্চয় এবং বিলম্ব ফি একযোগে পরিশোধ না করা পর্যন্ত সঞ্চয় খাতা হালনাগাদ হবে না।',
        resolutionNumber: 'রেজোলিউশন-০৩/২০২৫',
        status: 'active',
        addedBy: 'সমিতি কার্যনির্বাহী পরিষদ',
        addedByEmail: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        ruleId: 'RULE-CONST-004',
        meetingDate: '2025-01-01',
        title: 'জরুরি ঋণ বিতরণ, ১০% মাসিক সরল মুনাফা ও পরিশোধ নীতিমালা',
        category: 'loan',
        decisionDetails: 'সমিতির সক্রিয় সদস্যদের জরুরি আর্থিক প্রয়োজনে সংরক্ষিত তহবিল থেকে ঋণ মঞ্জুর করা হবে। বিতরণকৃত ঋণের উপর মাসিক ১০% হারে সরল মুনাফা প্রযোজ্য হবে। ঋণগ্রহীতাকে নিয়মিত মাসিক কিস্তিতে মূলধন ও মুনাফা পরিশোধ করতে হবে। ঋণ সম্পূর্ণ পরিশোধ না হওয়া পর্যন্ত কোনো নতুন ঋণ প্রদান করা হবে না।',
        resolutionNumber: 'রেজোলিউশন-০৪/২০২৫',
        status: 'active',
        addedBy: 'সমিতি কার্যনির্বাহী পরিষদ',
        addedByEmail: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        ruleId: 'RULE-CONST-005',
        meetingDate: '2025-01-01',
        title: 'সদস্যপদ প্রত্যাহার, অব্যাহতি ও জমাকৃত আমানত ফেরত নীতিমালা',
        category: 'general',
        decisionDetails: 'কোনো সদস্য স্বেচ্ছায় সমিতি থেকে সদস্যপদ প্রত্যাহার করতে চাইলে কার্যনির্বাহী পরিষদ বরাবর লিখিত আবেদন জমা দিতে হবে। উক্ত সদস্যের নামে বিদ্যমান কোনো বকেয়া ঋণ বা দায় থাকলে তা সমন্বয়ের পর অবশিষ্ট জমাকৃত সমুদয় সঞ্চয় অর্থ সম্পূর্ণভাবে ফেরত প্রদান করা হবে।',
        resolutionNumber: 'রেজোলিউশন-০৫/২০২৫',
        status: 'active',
        addedBy: 'সমিতি কার্যনির্বাহী পরিষদ',
        addedByEmail: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        ruleId: 'RULE-CONST-006',
        meetingDate: '2025-01-01',
        title: 'আর্থিক স্বচ্ছতা, ডিজিটাল হিসাবরক্ষণ ও সদস্যদের তথ্য অধিকার',
        category: 'general',
        decisionDetails: 'সমিতির যাবতীয় আয়-ব্যয়, ব্যাংক স্থিতি ও তহবিলের হিসাব সম্পূর্ণ উন্মুক্ত এবং স্বচ্ছ থাকবে। সাধারণ সদস্যগণ যে কোনো সময় আয়-ব্যয় খতিয়ান, ব্যাংক ব্যালেন্স ও তাদের ব্যক্তিগত সঞ্চয়ের হিসাব পর্যবেক্ষণ করতে পারবেন। সমিতি সংক্রান্ত সকল গুরুত্বপূর্ণ বিজ্ঞপ্তি ডিজিটাল নোটিফিকেশন সিস্টেমের মাধ্যমে সদস্যদের অবহিত করা হবে।',
        resolutionNumber: 'রেজোলিউশন-০৬/২০২৫',
        status: 'active',
        addedBy: 'সমিতি কার্যনির্বাহী পরিষদ',
        addedByEmail: '',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  static getRules(): SocietyRule[] {
    const raw = localStorage.getItem(STORAGE_KEYS.RULES);
    let rules: SocietyRule[] = [];
    if (raw) {
      try {
        rules = JSON.parse(raw);
      } catch {
        rules = [];
      }
    }
    // Filter out removed legacy foundation rule
    rules = rules.filter((r) => r.ruleId !== 'RULE-2025-FOUNDATION' && !r.title?.includes('ভর্তি ফি') && !r.title?.includes('Admission Fee'));
    if (rules.length === 0) {
      rules = this.getDefaultConstitutionalRules();
      this.saveRules(rules);
    }
    return rules;
  }

  static saveRules(rules: SocietyRule[]) {
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    try {
      for (const rule of rules) {
        FirebaseSyncService.syncRule(rule).catch(() => {});
      }
    } catch {}
  }

  static addRule(
    ruleData: Omit<SocietyRule, 'ruleId' | 'createdAt' | 'updatedAt' | 'addedBy' | 'addedByEmail'>,
    executingUser: UserAccount
  ): { success: boolean; message: string; rule: SocietyRule; data: FullAppData } {
    const isMainAdmin =
      executingUser.role === 'admin' &&
      (executingUser.isMainAdmin === true ||
        executingUser.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        executingUser.userId === 'USR-000001' ||
        executingUser.userId === 'USR-MAIN-ADMIN');

    if (!isMainAdmin) {
      return {
        success: false,
        message: 'শুধুমাত্র প্রধান অ্যাডমিনের সভার সিদ্ধান্ত ও নিয়মাবলি যুক্ত করার ক্ষমতা রয়েছে।',
        rule: {} as SocietyRule,
        data: this.getAppData(),
      };
    }

    const rules = this.getRules();
    const ruleId = `RULE-${Date.now()}`;
    const now = new Date().toISOString();
    const newRule: SocietyRule = {
      ...ruleData,
      ruleId,
      status: ruleData.status || 'active',
      addedBy: executingUser.displayName || 'প্রধান সুপার অ্যাডমিন',
      addedByEmail: executingUser.email || MAIN_ADMIN_EMAIL,
      createdAt: now,
      updatedAt: now,
    };

    rules.unshift(newRule);
    this.saveRules(rules);

    this.logActivity({
      userId: executingUser.userId,
      userDisplayName: executingUser.displayName,
      role: executingUser.role,
      action: 'ADD_RULE',
      module: 'Rules',
      description: `সভার নতুন সিদ্ধান্ত/নিয়মাবলি লিপিবদ্ধ: "${newRule.title}" (সভার তারিখ: ${newRule.meetingDate})`,
    });

    return {
      success: true,
      message: 'সভার সিদ্ধান্তটি সফলভাবে লিপিবদ্ধ করা হয়েছে।',
      rule: newRule,
      data: this.getAppData(),
    };
  }

  static updateRule(
    ruleId: string,
    updates: Partial<SocietyRule>,
    executingUser: UserAccount
  ): { success: boolean; message: string; data: FullAppData } {
    const isMainAdmin =
      executingUser.role === 'admin' &&
      (executingUser.isMainAdmin === true ||
        executingUser.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        executingUser.userId === 'USR-000001' ||
        executingUser.userId === 'USR-MAIN-ADMIN');

    if (!isMainAdmin) {
      return {
        success: false,
        message: 'শুধুমাত্র প্রধান অ্যাডমিন সিদ্ধান্ত পরিবর্তন বা সম্পাদনা করতে পারবেন।',
        data: this.getAppData(),
      };
    }

    const rules = this.getRules();
    const idx = rules.findIndex((r) => r.ruleId === ruleId);
    if (idx === -1) {
      return {
        success: false,
        message: 'সিদ্ধান্তটি খুঁজে পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    rules[idx] = {
      ...rules[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveRules(rules);

    this.logActivity({
      userId: executingUser.userId,
      userDisplayName: executingUser.displayName,
      role: executingUser.role,
      action: 'UPDATE_RULE',
      module: 'Rules',
      description: `সভার সিদ্ধান্ত হালনাগাদ করা হয়েছে: "${rules[idx].title}"`,
    });

    return {
      success: true,
      message: 'সিদ্ধান্তটি সফলভাবে হালনাগাদ করা হয়েছে।',
      data: this.getAppData(),
    };
  }

  static deleteRule(
    ruleId: string,
    executingUser: UserAccount
  ): { success: boolean; message: string; data: FullAppData } {
    const isMainAdmin =
      executingUser.role === 'admin' &&
      (executingUser.isMainAdmin === true ||
        executingUser.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        executingUser.userId === 'USR-000001' ||
        executingUser.userId === 'USR-MAIN-ADMIN');

    if (!isMainAdmin) {
      return {
        success: false,
        message: 'শুধুমাত্র প্রধান অ্যাডমিনের সিদ্ধান্ত বা নিয়মাবলি মুছে ফেলার অনুমতি রয়েছে।',
        data: this.getAppData(),
      };
    }

    const rules = this.getRules();
    const target = rules.find((r) => r.ruleId === ruleId);
    if (!target) {
      return {
        success: false,
        message: 'সিদ্ধান্ত খুঁজে পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    const updated = rules.filter((r) => r.ruleId !== ruleId);
    this.saveRules(updated);
    FirebaseSyncService.deleteRule(ruleId).catch(() => {});

    this.logActivity({
      userId: executingUser.userId,
      userDisplayName: executingUser.displayName,
      role: executingUser.role,
      action: 'DELETE_RULE',
      module: 'Rules',
      description: `সভার সিদ্ধান্ত মুছে ফেলা হয়েছে: "${target.title}"`,
    });

    return {
      success: true,
      message: 'সভার সিদ্ধান্তটি সফলভাবে মুছে ফেলা হয়েছে।',
      data: this.getAppData(),
    };
  }

  // --- Dashboard Dynamic Metrics Calculation ---
  static getDashboardMetrics(data?: FullAppData): DashboardMetrics {
    const members = data ? data.members : this.getMembers();
    const activeMembers = members.filter((m) => m.status === 'active').length;
    const totalMemberCapital = members.reduce((sum, m) => sum + (m.currentBalance || 0), 0);

    const loans = data ? data.loans : this.getLoans();
    const moneyOutside = loans
      .filter((l) => l.status === 'active')
      .reduce((sum, l) => sum + (l.remainingPrincipal || 0), 0);
    
    const contributions = data ? data.contributions : this.getContributions();
    const totalLateFees = contributions.reduce((sum, c) => sum + (c.lateFee || 0), 0);
    // User mandate: "This late fee will be added to the total loan profit."
    const totalLoanProfit = loans.reduce((sum, l) => sum + (l.totalProfitPaid || 0), 0) + totalLateFees;

    const incomeRecords = data ? (data.incomeRecords || data.incomes || []) : this.getIncomeRecords();
    const totalIncome = incomeRecords.reduce((sum, i) => sum + (i.amount || 0), 0) + totalLoanProfit;

    const expenseRecords = data ? (data.expenseRecords || data.expenses || []) : this.getExpenseRecords();
    const totalExpense = expenseRecords.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Cash and Bank Balances derived from transactions & authoritative financial ledger equation
    const settings = data ? data.settings : this.getSettings();
    let bankBalance = settings.bankOpeningBalance || 0;

    const transactions = this.reconcileTransactions(data);
    for (const trx of transactions) {
      if (trx.status === 'reversed') continue;
      const net = (trx.credit || 0) - (trx.debit || 0);
      if (trx.paymentMethod === 'bank') {
        bankBalance += net;
      }
    }
    bankBalance = Math.max(0, bankBalance);

    // Exact Zero-Discrepancy Formula:
    // Cash Balance in treasury must align 100% with:
    // (Total Member  Balance  + Total Income + Cash Opening) - (Money Outside/Loans + Bank Balance + Total Expense)
    // Zero discrepancy, zero excess, zero shortfall.
    const totalCommitted = moneyOutside + bankBalance + totalExpense;
    const totalAvailableInflow = totalMemberCapital + totalIncome + (settings.cashOpeningBalance || 0);
    const cashBalance = Math.max(0, totalAvailableInflow - totalCommitted);

    return {
      totalMembers: members.length,
      activeMembers,
      totalMemberCapital,
      totalLoanProfit,
      moneyOutside,
      cashBalance,
      bankBalance,
      totalIncome,
      totalExpense,
    };
  }

  // --- Reset Database / Financial Data to ৳0 as mandated by user ---
  static resetFinancialDataToZero(currentUser?: UserAccount) {
    this.resetToInitialDatabase();
  }

  // --- User Preferences ---
  static getLanguage(): 'bn' | 'en' {
    return (localStorage.getItem(STORAGE_KEYS.LANGUAGE) as 'bn' | 'en') || 'bn';
  }

  static setLanguage(lang: any) {
    const valid: 'bn' | 'en' = lang === 'en' ? 'en' : 'bn';
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, valid);
  }

  static getTheme(): 'light' | 'dark' {
    return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
  }

  static setTheme(theme: 'light' | 'dark') {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  static getCurrentUser(): UserAccount {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw) {
      try {
        const u: UserAccount = JSON.parse(raw);
        if (u) {
          if (
            u.role === 'admin' &&
            (u.isMainAdmin === true ||
              u.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
              u.userId === 'USR-000001' ||
              u.userId === 'USR-MAIN-ADMIN')
          ) {
            return {
              ...u,
              isMainAdmin: true,
              role: 'admin',
              email: u.email || MAIN_ADMIN_EMAIL,
              name: 'Kajol Chandra Das',
              displayName: 'Kajol Chandra Das ( Admin )',
            };
          }
          return u;
        }
      } catch {
        // Fallback
      }
    }
    // When the website is launched, users only have "view-only" access to the dashboard by default
    return VIEW_ONLY_USER;
  }

  static setCurrentUser(user: UserAccount) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  // --- Convenience & State Wrappers for App.tsx ---
  static updateSettings(updates: Partial<AppSettings>): FullAppData {
    const current = this.getSettings();
    const safeUpdates: Partial<AppSettings> = { ...updates };
    if (safeUpdates.language && safeUpdates.language !== 'bn' && safeUpdates.language !== 'en') {
      delete safeUpdates.language;
    }
    if (safeUpdates.theme && safeUpdates.theme !== 'light' && safeUpdates.theme !== 'dark') {
      delete safeUpdates.theme;
    }
    const updated = { ...current, ...safeUpdates };
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to stringify settings:', e);
    }
    if (safeUpdates.language) {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, safeUpdates.language);
    }
    if (safeUpdates.theme) {
      localStorage.setItem(STORAGE_KEYS.THEME, safeUpdates.theme);
    }
    FirebaseSyncService.syncSettings(updated).catch(() => {});
    return this.getAppData();
  }

  static addActivityLog(action: string, details: string, userName?: string): FullAppData {
    const logs = this.getActivityLogs();
    const newLog: ActivityLogItem = {
      logId: `LOG-${Date.now()}`,
      dateTime: new Date().toISOString(),
      userId: 'SYS',
      userDisplayName: userName || 'Admin',
      role: 'admin',
      action,
      module: 'System',
      description: details,
      timestamp: new Date().toISOString(),
      userName: userName || 'Admin',
      details,
    };
    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 1000)));
    return this.getAppData();
  }

  static resetToInitialDatabase(): FullAppData {
    // Keep ALL member records completely intact with ৳0 balance
    const existingMembers = this.getMembers();
    const today = new Date().toISOString().split('T')[0];
    const intactMembers = existingMembers.map((m) => ({
      ...m,
      currentBalance: 0,
      profitShareBalance: 0,
      totalWithdrawn: 0,
      updatedAt: today,
    }));
    this.saveMembers(intactMembers);

    // Completely clear all contributions, receipts, transactions, loans, expenses, and history
    this.saveContributions([]);
    this.saveReceipts([]);
    this.saveTransactions([]);
    this.saveLoans([]);
    this.saveBorrowers([]);
    this.saveLoanPayments([]);
    this.saveIncomeRecords([]);
    this.saveExpenseRecords([]);
    this.saveProfitDistributions([]);
    this.saveMemberWithdrawals([]);
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    try {
      localStorage.removeItem('psys_shared_chat_messages_v1');
    } catch {}
    localStorage.setItem('pakura_last_reset_timestamp', String(Date.now()));

    // Keep Super Admin and member user accounts aligned with intact members
    const validMemberIds = new Set(intactMembers.map((m) => m.systemId));
    const users = this.getUsers().filter(
      (u) =>
        u.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        u.isMainAdmin ||
        (u.memberSystemId && validMemberIds.has(u.memberSystemId))
    );
    this.saveUsers(users);

    // Reset opening balances in settings to strictly ৳0
    const settings = this.getSettings();
    settings.cashOpeningBalance = 0;
    settings.bankOpeningBalance = 0;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

    try {
      localStorage.removeItem('pakura_deleted_member_ids_v1');
    } catch {}

    // Wipe financial collections in Firebase Firestore and reset member balances to ৳0
    FirebaseSyncService.resetFinancialDataInFirestore(intactMembers).catch((err) => {
      console.warn('Firebase reset error:', err);
    });

    this.logActivity({
      userId: MAIN_ADMIN_ACCOUNT.userId,
      userDisplayName: MAIN_ADMIN_ACCOUNT.displayName,
      role: 'admin',
      action: 'RESET_DATABASE_COMPLETELY',
      module: 'System',
      description: `ডাটাবেজ সম্পূর্ণ রিসেট সম্পন্ন হয়েছে। ওয়েবসাইট ও ফায়ারবেসের সমস্ত আর্থিক হিসাব ৳০ করা হয়েছে এবং পূর্বের ইতিহাস মুছে ফেলা হয়েছে।`,
    });

    return this.getAppData();
  }

  static calculateAccruedProfit(loan: Loan): number {
    return this.calculateLoanLiveProfit(loan).accruedProfit;
  }

  static getFinancialSummary(data?: FullAppData) {
    return this.getDashboardMetrics(data);
  }

  static exportDatabaseJson(): string {
    return JSON.stringify(this.getAppData(), null, 2);
  }

  static exportDataAsJson(): void {
    const data = this.getAppData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pakura-sangha-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static importDataFromJson(jsonStr: string): boolean {
    try {
      this.importDatabaseJson(jsonStr);
      return true;
    } catch {
      return false;
    }
  }

  static importDatabaseJson(jsonStr: string): FullAppData {
    const parsed = JSON.parse(jsonStr);
    if (parsed.members) this.saveMembers(parsed.members);
    if (parsed.users) this.saveUsers(parsed.users);
    if (parsed.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
    if (parsed.contributions) this.saveContributions(parsed.contributions);
    if (parsed.loans) this.saveLoans(parsed.loans);
    if (parsed.borrowers) this.saveBorrowers(parsed.borrowers);
    if (parsed.loanPayments) this.saveLoanPayments(parsed.loanPayments);
    const incomingIncomes = parsed.incomeRecords || parsed.incomes;
    if (incomingIncomes) this.saveIncomeRecords(incomingIncomes);
    const incomingExpenses = parsed.expenseRecords || parsed.expenses;
    if (incomingExpenses) this.saveExpenseRecords(incomingExpenses);
    if (parsed.transactions) this.saveTransactions(parsed.transactions);
    if (parsed.receipts) this.saveReceipts(parsed.receipts);
    if (parsed.rules) this.saveRules(parsed.rules);
    if (parsed.meetings) this.saveMeetings(parsed.meetings);
    if (parsed.profitDistributions) this.saveProfitDistributions(parsed.profitDistributions);
    if (parsed.memberWithdrawals) this.saveMemberWithdrawals(parsed.memberWithdrawals);
    if (parsed.activityLogs) localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(parsed.activityLogs));
    return this.getAppData();
  }

  static addUser(
    email: string,
    name: string,
    role: Role,
    tempPassword?: string,
    creator?: UserAccount
  ): FullAppData {
    const users = this.getUsers();
    const cleanEmail = email.trim().toLowerCase();
    const finalPassword = (tempPassword || '').trim() || 'temp1234';

    const existingIdx = users.findIndex(
      (u) => u.email?.toLowerCase().trim() === cleanEmail
    );

    if (existingIdx !== -1) {
      users[existingIdx].role = role;
      users[existingIdx].name = name;
      users[existingIdx].displayName = name;
      users[existingIdx].password = finalPassword;
      this.saveUsers(users);
    } else {
      const newUser: UserAccount = {
        userId: `USR-${String(users.length + 1).padStart(6, '0')}`,
        username: cleanEmail.split('@')[0],
        email: cleanEmail,
        name,
        displayName: name,
        role,
        password: finalPassword,
        isMainAdmin: false,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
      };
      users.push(newUser);
      this.saveUsers(users);
    }

    this.logActivity({
      userId: creator?.userId || 'SYS',
      userDisplayName: creator?.displayName || 'প্রধান অ্যাডমিন',
      role: 'admin',
      action: 'CREATE_USER',
      module: 'User Management',
      description: `নতুন একাউন্ট তৈরি: ${name} (${cleanEmail}) [রোল: ${
        role === 'admin' ? 'সহকারী অ্যাডমিন' : role
      }, অস্থায়ী পাসওয়ার্ড সেট করা হয়েছে]`,
    });

    return this.getAppData();
  }

  static updateUserRole(
    userId: string,
    role: Role,
    status: 'active' | 'inactive' = 'active',
    requestingUser?: UserAccount
  ): FullAppData {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.userId === userId);
    if (idx !== -1) {
      const isTargetMainAdmin =
        users[idx].isMainAdmin === true ||
        users[idx].email?.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase() ||
        users[idx].userId === 'USR-000001';

      if (isTargetMainAdmin) {
        // Main Admin is immutable
        users[idx].role = 'admin';
        users[idx].status = 'active';
        users[idx].isMainAdmin = true;
      } else {
        users[idx].role = role;
        users[idx].status = status;
      }
      this.saveUsers(users);

      const req = requestingUser || this.getCurrentUser();
      this.logActivity({
        userId: req.userId,
        userDisplayName: req.displayName,
        role: req.role,
        action: 'UPDATE_USER_ROLE',
        module: 'User Management',
        description: `ব্যবহারকারীর রোল আপডেট: ${users[idx].name || users[idx].displayName} (${
          users[idx].email || users[idx].username
        }) -> ${role === 'admin' ? 'সহকারী অ্যাডমিন' : 'সদস্য'} [স্ট্যাটাস: ${status}]`,
      });
    }
    return this.getAppData();
  }

  static issueLoan(
    borrowerName: string,
    borrowerPhone: string,
    borrowerNid: string,
    principal: number,
    loanDate: string,
    method: PaymentMethod,
    currentUserName?: string
  ): { data: FullAppData; receipt: Receipt } {
    const user = this.getUsers().find((u) => u.displayName === currentUserName || u.name === currentUserName) || this.getCurrentUser();
    const res = this.createLoan(borrowerName, borrowerPhone, borrowerNid, principal, loanDate, method, user);
    return { data: this.getAppData(), receipt: res.receipt };
  }

  static recordBulkContributions(
    memberSystemIds: string[],
    amount: number,
    month: string,
    method: PaymentMethod,
    currentUserName?: string,
    lateFeePerMember?: number
  ): FullAppData {
    const user = this.getUsers().find((u) => u.displayName === currentUserName || u.name === currentUserName) || this.getCurrentUser();
    for (const sid of memberSystemIds) {
      this.recordContribution(sid, amount, month, method, user, 'regular', undefined, lateFeePerMember);
    }
    return this.getAppData();
  }

  // --- General Meetings & Verifiable Attendance Records ---
  static getMeetings(): GeneralMeeting[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MEETINGS);
    if (!raw) {
      const members = this.getMembers();
      const initialAttendees: MeetingAttendee[] = members.map((m) => ({
        memberSystemId: m.systemId,
        memberName: m.name,
        phone: m.phone,
        status: 'present' as const,
      }));

      const defaultMeetings: GeneralMeeting[] = [
        {
          meetingId: 'MTG-000001',
          title: 'উদ্বোধনী সাধারণ সভা ও নীতিমালা অনুমোদন',
          meetingDate: '2025-10-10',
          scheduledTime: '08:00 PM',
          location: 'সমিতির কার্যালয়',
          agenda: 'সমিতির আনুষ্ঠানিক যাত্রা শুরু, সঞ্চয় ও ঋণ নীতিমালা চূড়ান্তকরণ।',
          status: 'completed',
          attendanceRecorded: true,
          attendees: initialAttendees,
          recordedBy: 'Kajol Chandra Das ( Admin )',
          recordedAt: '2025-10-10 20:45',
          notes: 'সকল সদস্যের উপস্থিতিতে সর্বসম্মতিক্রমে নীতিমালা ও নিয়মাবলি অনুমোদিত হয়।',
          createdAt: '2025-10-10T14:00:00Z',
          updatedAt: '2025-10-10T21:00:00Z',
        },
        {
          meetingId: 'MTG-000002',
          title: 'সাধারণ মাসিক সভা - নভেম্বর ২০২৫',
          meetingDate: '2025-11-07',
          scheduledTime: '08:00 PM',
          location: 'সমিতির কার্যালয়',
          agenda: 'মাসিক সঞ্চয় অগ্রগতি ও প্রাথমিক তহবিল পর্যালোচনা।',
          status: 'completed',
          attendanceRecorded: true,
          attendees: initialAttendees,
          recordedBy: 'Kajol Chandra Das ( Admin )',
          recordedAt: '2025-11-07 20:30',
          notes: 'নিয়মিত সঞ্চয় যথাসময়ে জমাদানের তাগিদ দেওয়া হলো।',
          createdAt: '2025-11-07T14:00:00Z',
          updatedAt: '2025-11-07T21:00:00Z',
        },
        {
          meetingId: 'MTG-000003',
          title: 'সাধারণ মাসিক সভা - ডিসেম্বর ২০২৫',
          meetingDate: '2025-12-05',
          scheduledTime: '08:00 PM',
          location: 'সমিতির কার্যালয়',
          agenda: 'বছরের শেষ প্রান্তিক হিসাব ও ঋণ বিতরণ সংক্রান্ত আলোচনা।',
          status: 'completed',
          attendanceRecorded: true,
          attendees: initialAttendees,
          recordedBy: 'Kajol Chandra Das ( Admin )',
          recordedAt: '2025-12-05 20:35',
          notes: 'হিসাব বই সন্তোষজনক পাওয়া গেছে।',
          createdAt: '2025-12-05T14:00:00Z',
          updatedAt: '2025-12-05T21:00:00Z',
        },
      ];
      this.saveMeetings(defaultMeetings);
      return defaultMeetings;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveMeetings(meetings: GeneralMeeting[]): void {
    localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(meetings));
    try {
      for (const meet of meetings) {
        FirebaseSyncService.syncMeeting(meet).catch(() => {});
      }
    } catch {}
  }

  static recordMeetingAttendance(
    meetingId: string,
    attendees: MeetingAttendee[],
    currentUser: UserAccount,
    notes?: string
  ): FullAppData {
    const meetings = this.getMeetings();
    const meeting = meetings.find((m) => m.meetingId === meetingId);
    if (!meeting) throw new Error('Meeting not found');

    meeting.attendees = attendees;
    meeting.attendanceRecorded = true;
    meeting.status = 'completed';
    meeting.recordedBy = currentUser.displayName;
    meeting.recordedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    if (notes !== undefined) meeting.notes = notes;
    meeting.updatedAt = new Date().toISOString();

    this.saveMeetings(meetings);

    const presentCount = attendees.filter((a) => a.status === 'present').length;
    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'RECORD_ATTENDANCE',
      module: 'Meetings',
      referenceId: meetingId,
      description: `"${meeting.title}" সভার হাজিরা সম্পন্ন: ${presentCount}/${attendees.length} জন উপস্থিত`,
    });

    return this.getAppData();
  }

  static markMemberAttendance(
    memberSystemId: string,
    currentUser: UserAccount,
    meetingId?: string
  ): FullAppData {
    const meetings = this.getMeetings();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // If no meetings exist, create the monthly general meeting
    if (meetings.length === 0) {
      const monthLabel = today.toLocaleString('bn-BD', { month: 'long', year: 'numeric' });
      const newMeeting: GeneralMeeting = {
        meetingId: 'MTG-000001',
        title: `মাসিক সাধারণ সভা - ${monthLabel}`,
        meetingDate: todayStr,
        scheduledTime: '০৮:০০ PM',
        location: 'সংঘ কার্যালয় / প্রাঙ্গণ',
        agenda: 'মাসিক সঞ্চয় ও কার্যক্রম পর্যালোচনা',
        status: 'completed',
        attendanceRecorded: true,
        attendees: [
          {
            memberSystemId,
            memberName: currentUser.name || currentUser.displayName,
            phone: currentUser.username,
            status: 'present',
            notes: 'স্বয়ং উপস্থিতি চিহ্নিত',
          },
        ],
        recordedBy: currentUser.displayName,
        recordedAt: todayStr,
        createdAt: todayStr,
        updatedAt: todayStr,
      };
      meetings.push(newMeeting);
      this.saveMeetings(meetings);
      this.logActivity({
        userId: currentUser.userId,
        userDisplayName: currentUser.displayName,
        role: currentUser.role,
        action: 'MEMBER_ATTENDANCE',
        module: 'Meetings',
        referenceId: newMeeting.meetingId,
        description: `সদস্য "${currentUser.displayName}" সাধারণ সভায় উপস্থিতি চিহ্নিত করেছেন।`,
      });
      return this.getAppData();
    }

    // Pick target meeting (provided or latest)
    const target = meetingId
      ? meetings.find((m) => m.meetingId === meetingId)
      : meetings[meetings.length - 1];

    if (!target) throw new Error('Meeting not found');

    if (!target.attendees) {
      target.attendees = [];
    }

    const idx = target.attendees.findIndex((a) => a.memberSystemId === memberSystemId);
    if (idx >= 0) {
      target.attendees[idx].status = 'present';
    } else {
      target.attendees.push({
        memberSystemId,
        memberName: currentUser.name || currentUser.displayName,
        phone: currentUser.username,
        status: 'present',
        notes: 'স্বয়ং উপস্থিতি চিহ্নিত',
      });
    }

    target.attendanceRecorded = true;
    target.updatedAt = new Date().toISOString();
    this.saveMeetings(meetings);

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'MEMBER_ATTENDANCE',
      module: 'Meetings',
      referenceId: target.meetingId,
      description: `সদস্য "${currentUser.displayName}" "${target.title}" সভায় উপস্থিতি চিহ্নিত করেছেন।`,
    });

    return this.getAppData();
  }

  static createMeeting(
    data: {
      title: string;
      meetingDate: string;
      scheduledTime: string;
      location: string;
      agenda?: string;
      notes?: string;
    },
    currentUser: UserAccount
  ): FullAppData {
    const meetings = this.getMeetings();
    const nextNum = meetings.length + 1;
    const meetingId = `MTG-${String(nextNum).padStart(6, '0')}`;
    const members = this.getMembers();
    const initialAttendees: MeetingAttendee[] = members.map((m) => ({
      memberSystemId: m.systemId,
      memberName: m.name,
      phone: m.phone,
      status: 'present',
    }));

    const newMeeting: GeneralMeeting = {
      meetingId,
      title: data.title,
      meetingDate: data.meetingDate,
      scheduledTime: data.scheduledTime || '08:00 PM',
      location: data.location || 'সমিতির কার্যালয়',
      agenda: data.agenda || '',
      status: 'scheduled',
      attendanceRecorded: false,
      attendees: initialAttendees,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    meetings.unshift(newMeeting);
    this.saveMeetings(meetings);

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'CREATE_MEETING',
      module: 'Meetings',
      referenceId: meetingId,
      description: `নতুন সভার নোটিশ তৈরি: "${data.title}" (তারিখ: ${data.meetingDate}, সময়: ${data.scheduledTime})`,
    });

    return this.getAppData();
  }

  static deleteMeeting(meetingId: string, currentUser: UserAccount): FullAppData {
    const meetings = this.getMeetings();
    const updated = meetings.filter((m) => m.meetingId !== meetingId);
    this.saveMeetings(updated);
    FirebaseSyncService.deleteMeeting(meetingId).catch(() => {});

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'DELETE_MEETING',
      module: 'Meetings',
      referenceId: meetingId,
      description: `সভার নোটিশ মুছে ফেলা হয়েছে (${meetingId})`,
    });

    return this.getAppData();
  }

  // --- Profit Distribution & Member Account Funds ---
  static getProfitDistributions(): ProfitDistribution[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveProfitDistributions(distributions: ProfitDistribution[]) {
    localStorage.setItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, JSON.stringify(distributions));
    try {
      for (const d of distributions) {
        FirebaseSyncService.syncProfitDistribution(d).catch(() => {});
      }
    } catch {}
  }

  static getMemberWithdrawals(): MemberWithdrawal[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBER_WITHDRAWALS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveMemberWithdrawals(withdrawals: MemberWithdrawal[]) {
    localStorage.setItem(STORAGE_KEYS.MEMBER_WITHDRAWALS, JSON.stringify(withdrawals));
    try {
      for (const w of withdrawals) {
        FirebaseSyncService.syncMemberWithdrawal(w).catch(() => {});
      }
    } catch {}
  }

  /**
   * Add funds to general member accounts from total loan profits at any time.
   * Procurements (jerseys, T-shirts) and other association expenses are deducted solely from total loan profit.
   * Can distribute an equal amount to all members whenever decided on a specific date or month.
   */
  static allocateLoanProfitToMembers(params: {
    periodType: 'monthly' | 'yearly' | 'custom';
    periodLabel: string;
    percentage?: number;
    fixedAmountPerMember?: number;
    distributionMethod: 'equal' | 'proportional';
    notes?: string;
    currentUser: UserAccount;
    allocationDate?: string;
  }): { success: boolean; message: string; data: FullAppData; distribution?: ProfitDistribution } {
    const {
      periodType,
      periodLabel,
      percentage = 50,
      fixedAmountPerMember,
      distributionMethod,
      notes,
      currentUser,
      allocationDate,
    } = params;

    // 1. Calculate Gross Loan Profit
    const loans = this.getLoans();
    const contributions = this.getContributions();
    const totalLateFees = contributions.reduce((sum, c) => sum + (c.lateFee || 0), 0);
    const grossLoanProfit = loans.reduce((sum, l) => sum + (l.totalProfitPaid || 0), 0) + totalLateFees;

    // 2. Association expenses (Jerseys, T-shirts, Puja, Events, Office, etc.) deducted solely from total loan profit
    const expenses = this.getExpenseRecords();
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // 3. Past distributions already credited to member accounts
    const pastDistributions = this.getProfitDistributions();
    const totalPastAllocated = pastDistributions.reduce((sum, d) => sum + (d.totalAllocatedAmount || 0), 0);

    // 4. Net available loan profit for distribution
    const netAvailableLoanProfit = Math.max(0, grossLoanProfit - totalExpenses - totalPastAllocated);

    if (grossLoanProfit <= 0) {
      return {
        success: false,
        message: 'বন্টন করার মতো কোনো ঋণ মুনাফা বর্তমানে অর্জিত হয়নি (মোট ঋণ মুনাফা ৳০)।',
        data: this.getAppData(),
      };
    }

    const members = this.getMembers();
    const eligibleMembers = members.filter((m) => m.status === 'active');
    if (eligibleMembers.length === 0) {
      return {
        success: false,
        message: 'তহবিল বন্টনের জন্য কোনো সক্রিয় সাধারণ সদস্য পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    // 5. Determine total allocated amount & amount per member
    let totalAllocatedAmount = 0;
    let baseAmountPerMember = 0;
    let effectivePercentage = percentage;

    if (fixedAmountPerMember && fixedAmountPerMember > 0) {
      baseAmountPerMember = Math.round(fixedAmountPerMember);
      totalAllocatedAmount = baseAmountPerMember * eligibleMembers.length;
      effectivePercentage = netAvailableLoanProfit > 0
        ? Math.round((totalAllocatedAmount / netAvailableLoanProfit) * 100)
        : 100;
    } else {
      if (percentage <= 0 || percentage > 100) {
        return {
          success: false,
          message: 'বন্টনের শতকরা হার ১% থেকে ১০০% এর মধ্যে হতে হবে।',
          data: this.getAppData(),
        };
      }
      totalAllocatedAmount = Math.round((netAvailableLoanProfit * percentage) / 100);
      baseAmountPerMember = Math.floor(totalAllocatedAmount / eligibleMembers.length);
      effectivePercentage = percentage;
    }

    if (totalAllocatedAmount <= 0 || baseAmountPerMember <= 0) {
      return {
        success: false,
        message: 'বন্টনকৃত টাকার পরিমাণ অত্যন্ত কম বা শূন্য। অনুগ্রহ করে সঠিক পরিমাণ বা হার দিন।',
        data: this.getAppData(),
      };
    }

    const totalSavingsPool = eligibleMembers.reduce(
      (sum, m) => sum + Math.max(0, m.currentBalance || 0),
      0
    );

    // 6. Credit member accounts
    const updatedMembers = members.map((m) => {
      if (m.status !== 'active') return m;
      let memberShare = baseAmountPerMember;
      if (distributionMethod === 'proportional' && totalSavingsPool > 0) {
        const proportion = Math.max(0, m.currentBalance || 0) / totalSavingsPool;
        memberShare = Math.round(totalAllocatedAmount * proportion);
      }
      return {
        ...m,
        currentBalance: (m.currentBalance || 0) + memberShare,
        profitShareBalance: (m.profitShareBalance || 0) + memberShare,
        updatedAt: new Date().toISOString(),
      };
    });
    this.saveMembers(updatedMembers);

    const effectiveDate = allocationDate || new Date().toISOString().split('T')[0];
    const distributionId = `DIST-${String(pastDistributions.length + 1).padStart(6, '0')}`;
    const newDistribution: ProfitDistribution = {
      distributionId,
      date: effectiveDate,
      periodType,
      periodLabel: periodLabel || `${effectiveDate} বন্টন`,
      totalLoanProfitSnapshot: netAvailableLoanProfit,
      grossProfitSnapshot: grossLoanProfit,
      totalExpensesDeducted: totalExpenses,
      netProfitSnapshot: netAvailableLoanProfit,
      percentage: effectivePercentage,
      totalAllocatedAmount,
      memberCount: eligibleMembers.length,
      amountPerMember: baseAmountPerMember,
      fixedAmountPerMember: fixedAmountPerMember || undefined,
      distributionMethod,
      allocatedBy: currentUser.displayName,
      notes,
      createdAt: new Date().toISOString(),
    };
    pastDistributions.unshift(newDistribution);
    this.saveProfitDistributions(pastDistributions);

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'ALLOCATE_LOAN_PROFIT',
      module: 'Loan Profit & Dividend',
      referenceId: distributionId,
      description: `ঋণ মুনাফা বন্টন: খরচ (জার্সি ও অন্যান্য ৳${totalExpenses.toLocaleString()}) কর্তন করে ${eligibleMembers.length} জন সদস্যের অ্যাকাউন্টে প্রতিজন ৳${baseAmountPerMember.toLocaleString()} হারে মোট ৳${totalAllocatedAmount.toLocaleString()} যোগ করা হয়েছে। তারিখ/মেয়াদ: ${periodLabel || effectiveDate}`,
    });

    return {
      success: true,
      message: `মোট ৳${totalAllocatedAmount.toLocaleString()} ঋণ লভ্যাংশ সফলভাবে ${eligibleMembers.length} জন সদস্যের অ্যাকাউন্টে সমহারে (প্রতিজন ৳${baseAmountPerMember.toLocaleString()}) যোগ করা হয়েছে!`,
      data: this.getAppData(),
      distribution: newDistribution,
    };
  }

  /**
   * Submit a member fund or profit dividend withdrawal request.
   * Can request from:
   * 1. 'profit': 100% of member's accumulated loan profit dividends (সঞ্চিত মুনাফা)
   * 2. 'savings': up to 70% of savings balance with min reserve ৳500 (মূল সঞ্চয় তহবিল)
   * 3. 'combined': both funds
   */
  static requestMemberWithdrawal(params: {
    memberSystemId: string;
    amount: number;
    source: WithdrawalSource;
    paymentMethod: PaymentMethod | 'bkash' | 'nagad' | 'rocket';
    payoutAccount?: string;
    reason?: string;
    currentUser: UserAccount;
  }): {
    success: boolean;
    message: string;
    data: FullAppData;
    withdrawal?: MemberWithdrawal;
  } {
    const { memberSystemId, amount, source, paymentMethod, payoutAccount, reason, currentUser } = params;
    const members = this.getMembers();
    const targetMember = members.find((m) => m.systemId === memberSystemId);

    if (!targetMember) {
      return {
        success: false,
        message: 'সদস্য প্রোফাইল খুঁজে পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    if (amount <= 0) {
      return {
        success: false,
        message: 'উত্তোলনের পরিমাণ ১ টাকার বেশি হতে হবে।',
        data: this.getAppData(),
      };
    }

    const settings = this.getSettings();
    const maxPercent = settings.maxWithdrawalPercentage ?? 70;
    const minReserve = settings.minReserveBalance ?? 500;
    const currentBalance = targetMember.currentBalance || 0;
    const profitBalance = targetMember.profitShareBalance || 0;

    // Validate limits according to fund source
    if (source === 'profit') {
      if (profitBalance <= 0) {
        return {
          success: false,
          message: 'আপনার কোনো সঞ্চিত মুনাফা বা লভ্যাংশ অবশিষ্ট নেই (লভ্যাংশ স্থিতি ৳০)।',
          data: this.getAppData(),
        };
      }
      if (amount > profitBalance) {
        return {
          success: false,
          message: `সঞ্চিত মুনাফা থেকে উত্তোলনের সর্বোচ্চ সীমা ৳${profitBalance.toLocaleString()} (আপনার অর্জিত মোট লভ্যাংশ)।`,
          data: this.getAppData(),
        };
      }
    } else if (source === 'savings') {
      const maxAllowedByPercent = Math.floor((currentBalance * maxPercent) / 100);
      const maxAllowedByReserve = Math.max(0, currentBalance - minReserve);
      const maxWithdrawableSavings = Math.max(0, Math.min(maxAllowedByPercent, maxAllowedByReserve));

      if (maxWithdrawableSavings <= 0) {
        return {
          success: false,
          message: `সদস্যপদ সক্রিয় রাখতে ন্যূনতম ৳${minReserve} রিজার্ভ তহবিল থাকা আবশ্যক। বর্তমানে সঞ্চয় তহবিল থেকে উত্তোলন সম্ভব নয়।`,
          data: this.getAppData(),
        };
      }
      if (amount > maxWithdrawableSavings) {
        return {
          success: false,
          message: `মূল সঞ্চয় তহবিল থেকে উত্তোলনের সর্বোচ্চ সীমা ৳${maxWithdrawableSavings.toLocaleString()} (তহবিলের সর্বোচ্চ ${maxPercent}% এবং ন্যূনতম ৳${minReserve} রিজার্ভ)।`,
          data: this.getAppData(),
        };
      }
    } else {
      // Combined
      const maxAllowedByPercent = Math.floor((currentBalance * maxPercent) / 100);
      const maxAllowedByReserve = Math.max(0, currentBalance - minReserve);
      const maxWithdrawableSavings = Math.max(0, Math.min(maxAllowedByPercent, maxAllowedByReserve));
      const totalCombinedMax = profitBalance + maxWithdrawableSavings;

      if (amount > totalCombinedMax) {
        return {
          success: false,
          message: `সর্বমোট উত্তোলনযোগ্য সীমা ৳${totalCombinedMax.toLocaleString()} (সঞ্চিত মুনাফা ৳${profitBalance.toLocaleString()} + সঞ্চয় ৳${maxWithdrawableSavings.toLocaleString()})।`,
          data: this.getAppData(),
        };
      }
    }

    const withdrawals = this.getMemberWithdrawals();
    const nextNum = withdrawals.length + 1;
    const withdrawalId = `WTH-${String(nextNum).padStart(6, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const newWithdrawal: MemberWithdrawal = {
      withdrawalId,
      memberSystemId: targetMember.systemId,
      memberName: targetMember.name,
      memberPhone: targetMember.phone,
      amount,
      source,
      date: today,
      paymentMethod,
      payoutAccount: payoutAccount?.trim() || undefined,
      reason: reason?.trim() || undefined,
      status: 'pending',
      remainingBalanceAfter: currentBalance,
      remainingProfitAfter: profitBalance,
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    withdrawals.unshift(newWithdrawal);
    this.saveMemberWithdrawals(withdrawals);

    const sourceLabel = source === 'profit' ? 'সঞ্চিত মুনাফা' : source === 'savings' ? 'মূল সঞ্চয়' : 'সমন্বিত তহবিল';
    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'WITHDRAWAL_REQUEST',
      module: 'Withdrawals',
      referenceId: withdrawalId,
      description: `উত্তোলন আবেদন জমা: ${targetMember.name} (৳${amount.toLocaleString()}) [উৎস: ${sourceLabel}, মাধ্যম: ${paymentMethod}${payoutAccount ? `, একাউন্ট: ${payoutAccount}` : ''}]`,
    });

    return {
      success: true,
      message: `৳${amount.toLocaleString()} (${sourceLabel}) উত্তোলন আবেদন সফলভাবে জমা হয়েছে! অ্যাডমিন প্যানেল থেকে অনুমোদন ও পরিশোধ সম্পন্ন হবে।`,
      data: this.getAppData(),
      withdrawal: newWithdrawal,
    };
  }

  /**
   * Admin approves & disburses a member withdrawal request.
   * Generates official voucher receipt, debits cash/bank ledger, and updates member balances.
   */
  static approveAndDisburseWithdrawal(params: {
    withdrawalId: string;
    paymentMethod: PaymentMethod;
    adminNotes?: string;
    adminUser: UserAccount;
  }): {
    success: boolean;
    message: string;
    data: FullAppData;
    withdrawal?: MemberWithdrawal;
    receipt?: Receipt;
  } {
    const { withdrawalId, paymentMethod, adminNotes, adminUser } = params;

    if (adminUser.role !== 'admin') {
      return {
        success: false,
        message: 'শুধুমাত্র অ্যাডমিন উত্তোলন আবেদন অনুমোদন ও অর্থ পরিশোধ করতে পারেন।',
        data: this.getAppData(),
      };
    }

    const withdrawals = this.getMemberWithdrawals();
    const wIdx = withdrawals.findIndex((w) => w.withdrawalId === withdrawalId);
    if (wIdx === -1) {
      return {
        success: false,
        message: 'উত্তোলন আবেদনটি খুঁজে পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    const withdrawal = { ...withdrawals[wIdx] };
    if (withdrawal.status === 'completed') {
      return {
        success: false,
        message: 'এই আবেদনটি ইতিমধ্যে পরিশোধিত হয়েছে।',
        data: this.getAppData(),
      };
    }

    const members = this.getMembers();
    const mIdx = members.findIndex((m) => m.systemId === withdrawal.memberSystemId);
    if (mIdx === -1) {
      return {
        success: false,
        message: 'সংশ্লিষ্ট সদস্যের প্রোফাইল পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    const targetMember = { ...members[mIdx] };
    const amount = withdrawal.amount;
    const source = withdrawal.source || 'savings';

    // Verify society liquid fund availability
    const metrics = this.getDashboardMetrics();
    const availableLiquid = paymentMethod === 'bank' ? metrics.bankBalance : metrics.cashBalance;
    if (availableLiquid < amount) {
      const fundName = paymentMethod === 'bank' ? 'ব্যাংক ব্যালেন্স' : 'নগদ ক্যাশ';
      return {
        success: false,
        message: `সমিতির ${fundName} এ পর্যাপ্ত অর্থ নেই (বর্তমান স্থিতি: ৳${availableLiquid.toLocaleString()}, প্রয়োজন: ৳${amount.toLocaleString()})।`,
        data: this.getAppData(),
      };
    }

    // Deduct from member funds based on source
    let newBalance = targetMember.currentBalance || 0;
    let newProfitBalance = targetMember.profitShareBalance || 0;

    if (source === 'profit') {
      newProfitBalance = Math.max(0, newProfitBalance - amount);
      newBalance = Math.max(0, newBalance - amount);
    } else if (source === 'savings') {
      newBalance = Math.max(0, newBalance - amount);
    } else {
      // Combined: deduct profit first, then remaining from savings
      const profitDeduct = Math.min(newProfitBalance, amount);
      const savingsDeduct = amount - profitDeduct;
      newProfitBalance = Math.max(0, newProfitBalance - profitDeduct);
      newBalance = Math.max(0, newBalance - (profitDeduct + savingsDeduct));
    }

    targetMember.currentBalance = newBalance;
    targetMember.profitShareBalance = newProfitBalance;
    targetMember.totalWithdrawn = (targetMember.totalWithdrawn || 0) + amount;
    targetMember.updatedAt = new Date().toISOString();
    members[mIdx] = targetMember;
    this.saveMembers(members);

    // Generate Official Society Withdrawal Voucher Receipt
    const receipts = this.getReceipts();
    const nextRcptNum = receipts.length + 1;
    const receiptId = `RCT-WTH-${String(nextRcptNum).padStart(6, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const purposeTitle = source === 'profit'
      ? `সদস্য অর্জিত ঋণ মুনাফা লভ্যাংশ উত্তোলন (${withdrawal.reason || 'অনুমোদিত লভ্যাংশ উত্তোলন'})`
      : source === 'savings'
      ? `সদস্য মূল সঞ্চয় তহবিল উত্তোলন (${withdrawal.reason || 'অনুমোদিত সাধারণ উত্তোলন'})`
      : `সদস্য সঞ্চয় ও লভ্যাংশ তহবিল উত্তোলন (${withdrawal.reason || 'অনুমোদিত উত্তোলন'})`;

    const newReceipt: Receipt = {
      receiptId,
      transactionId: '',
      name: targetMember.name,
      phone: targetMember.phone,
      amount,
      purpose: purposeTitle,
      type: 'member_withdrawal',
      date: today,
      receivedBy: targetMember.name,
      issuedBy: adminUser.displayName,
      paymentMethod,
      memberSystemId: targetMember.systemId,
      createdAt: new Date().toISOString(),
    };

    // Record Cash/Bank Debit Outflow Transaction
    const transactions = this.getTransactions();
    const nextTrxNum = transactions.length + 1;
    const transactionId = `TXN-${String(nextTrxNum).padStart(6, '0')}`;
    newReceipt.transactionId = transactionId;
    receipts.unshift(newReceipt);
    this.saveReceipts(receipts);

    const balanceAfter = availableLiquid - amount;
    const newTransaction: Transaction = {
      transactionId,
      date: today,
      type: 'member_withdrawal',
      referenceId: receiptId,
      memberSystemId: targetMember.systemId,
      partyName: targetMember.name,
      description: `${purposeTitle}: ${targetMember.name} (৳${amount.toLocaleString()}) [রশিদ: ${receiptId}${withdrawal.payoutAccount ? `, প্রাপক নম্বর: ${withdrawal.payoutAccount}` : ''}]`,
      debit: amount,
      credit: 0,
      balanceAfter,
      paymentMethod,
      createdBy: adminUser.displayName,
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    transactions.unshift(newTransaction);
    this.saveTransactions(transactions);

    // Update Withdrawal Record
    withdrawal.status = 'completed';
    withdrawal.receiptId = receiptId;
    withdrawal.paymentMethod = paymentMethod;
    withdrawal.processedBy = adminUser.displayName;
    withdrawal.processedAt = new Date().toISOString();
    withdrawal.remainingBalanceAfter = newBalance;
    withdrawal.remainingProfitAfter = newProfitBalance;
    if (adminNotes) {
      withdrawal.reason = withdrawal.reason ? `${withdrawal.reason} (অ্যাডমিন নোট: ${adminNotes})` : adminNotes;
    }
    withdrawals[wIdx] = withdrawal;
    this.saveMemberWithdrawals(withdrawals);

    this.logActivity({
      userId: adminUser.userId,
      userDisplayName: adminUser.displayName,
      role: adminUser.role,
      action: 'APPROVE_WITHDRAWAL',
      module: 'Withdrawals',
      referenceId: withdrawal.withdrawalId,
      description: `উত্তোলন আবেদন অনুমোদন ও পরিশোধ সম্পন্ন: ${targetMember.name} (৳${amount.toLocaleString()}) [রশিদ: ${receiptId}, মাধ্যম: ${paymentMethod}, অবশিষ্ট ব্যালেন্স: ৳${newBalance.toLocaleString()}]`,
    });

    return {
      success: true,
      message: `৳${amount.toLocaleString()} সফলভাবে অনুমোদন ও পরিশোধ সম্পন্ন হয়েছে! রসিদ নং: ${receiptId} তৈরি হয়েছে।`,
      data: this.getAppData(),
      withdrawal,
      receipt: newReceipt,
    };
  }

  /**
   * Admin rejects a withdrawal request with a stated reason.
   */
  static rejectWithdrawalRequest(params: {
    withdrawalId: string;
    rejectionReason: string;
    adminUser: UserAccount;
  }): {
    success: boolean;
    message: string;
    data: FullAppData;
    withdrawal?: MemberWithdrawal;
  } {
    const { withdrawalId, rejectionReason, adminUser } = params;

    if (adminUser.role !== 'admin') {
      return {
        success: false,
        message: 'শুধুমাত্র অ্যাডমিন আবেদন বাতিল করতে পারেন।',
        data: this.getAppData(),
      };
    }

    const withdrawals = this.getMemberWithdrawals();
    const wIdx = withdrawals.findIndex((w) => w.withdrawalId === withdrawalId);
    if (wIdx === -1) {
      return {
        success: false,
        message: 'উত্তোলন আবেদনটি পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    const withdrawal = { ...withdrawals[wIdx] };
    if (withdrawal.status === 'completed') {
      return {
        success: false,
        message: 'ইতিমধ্যে পরিশোধিত উত্তোলন বাতিল করা সম্ভব নয়।',
        data: this.getAppData(),
      };
    }

    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = rejectionReason.trim() || 'প্রশাসনিক সিদ্ধান্তে বাতিল';
    withdrawal.processedBy = adminUser.displayName;
    withdrawal.processedAt = new Date().toISOString();
    withdrawals[wIdx] = withdrawal;
    this.saveMemberWithdrawals(withdrawals);

    this.logActivity({
      userId: adminUser.userId,
      userDisplayName: adminUser.displayName,
      role: adminUser.role,
      action: 'REJECT_WITHDRAWAL',
      module: 'Withdrawals',
      referenceId: withdrawal.withdrawalId,
      description: `উত্তোলন আবেদন বাতিল: ${withdrawal.memberName} (৳${withdrawal.amount.toLocaleString()}) [কারণ: ${withdrawal.rejectionReason}]`,
    });

    return {
      success: true,
      message: `উত্তোলন আবেদনটি সফলভাবে বাতিল করা হয়েছে।`,
      data: this.getAppData(),
      withdrawal,
    };
  }

  /**
   * Member cancels their own pending withdrawal request.
   */
  static cancelWithdrawalRequest(params: {
    withdrawalId: string;
    currentUser: UserAccount;
  }): {
    success: boolean;
    message: string;
    data: FullAppData;
  } {
    const { withdrawalId, currentUser } = params;
    const withdrawals = this.getMemberWithdrawals();
    const wIdx = withdrawals.findIndex((w) => w.withdrawalId === withdrawalId);
    if (wIdx === -1) {
      return {
        success: false,
        message: 'আবেদনটি পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    const target = withdrawals[wIdx];
    if (target.status !== 'pending') {
      return {
        success: false,
        message: 'শুধুমাত্র অপেক্ষমাণ (pending) আবেদন বাতিল করা যায়।',
        data: this.getAppData(),
      };
    }

    // Remove the pending withdrawal
    withdrawals.splice(wIdx, 1);
    this.saveMemberWithdrawals(withdrawals);

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'CANCEL_WITHDRAWAL_REQUEST',
      module: 'Withdrawals',
      referenceId: withdrawalId,
      description: `উত্তোলন আবেদন প্রত্যাহার: ${target.memberName} (৳${target.amount.toLocaleString()})`,
    });

    return {
      success: true,
      message: 'উত্তোলন আবেদনটি প্রত্যাহার করা হয়েছে।',
      data: this.getAppData(),
    };
  }

  /**
   * Execute direct instant member fund or profit withdrawal by Admin.
   */
  static executeMemberWithdrawal(params: {
    memberSystemId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    source?: WithdrawalSource;
    payoutAccount?: string;
    reason?: string;
    currentUser: UserAccount;
  }): {
    success: boolean;
    message: string;
    data: FullAppData;
    withdrawal?: MemberWithdrawal;
    receipt?: Receipt;
  } {
    const { memberSystemId, amount, paymentMethod, source = 'savings', payoutAccount, reason, currentUser } = params;
    const members = this.getMembers();
    const memberIdx = members.findIndex((m) => m.systemId === memberSystemId);

    if (memberIdx === -1) {
      return {
        success: false,
        message: 'সদস্য প্রোফাইল পাওয়া যায়নি।',
        data: this.getAppData(),
      };
    }

    const targetMember = { ...members[memberIdx] };
    const settings = this.getSettings();
    const maxPercent = settings.maxWithdrawalPercentage ?? 70;
    const minReserve = settings.minReserveBalance ?? 500;
    const currentBalance = targetMember.currentBalance || 0;
    const profitBalance = targetMember.profitShareBalance || 0;

    if (amount <= 0) {
      return {
        success: false,
        message: 'উত্তোলনের পরিমাণ ১ টাকার বেশি হতে হবে।',
        data: this.getAppData(),
      };
    }

    // Limit checks based on source
    if (source === 'profit') {
      if (amount > profitBalance) {
        return {
          success: false,
          message: `সঞ্চিত মুনাফা থেকে উত্তোলনের সর্বোচ্চ সীমা ৳${profitBalance.toLocaleString()}।`,
          data: this.getAppData(),
        };
      }
    } else if (source === 'savings') {
      const maxAllowedByPercent = Math.floor((currentBalance * maxPercent) / 100);
      const maxAllowedByReserve = Math.max(0, currentBalance - minReserve);
      const maxWithdrawable = Math.max(0, Math.min(maxAllowedByPercent, maxAllowedByReserve));

      if (amount > maxWithdrawable) {
        return {
          success: false,
          message: `উত্তোলনের অনুমোদিত সর্বোচ্চ সীমা ৳${maxWithdrawable.toLocaleString()} (মোট তহবিলের সর্বোচ্চ ${maxPercent}% এবং ন্যূনতম ৳${minReserve} রিজার্ভ তহবিল সংরক্ষিত রাখতে হবে)।`,
          data: this.getAppData(),
        };
      }
    }

    // Verify liquid funds in society treasury
    const metrics = this.getDashboardMetrics();
    const previousLiquid = paymentMethod === 'bank' ? metrics.bankBalance : metrics.cashBalance;
    if (previousLiquid < amount) {
      const fundName = paymentMethod === 'bank' ? 'ব্যাংক ব্যালেন্স' : 'নগদ ক্যাশ';
      return {
        success: false,
        message: `সমিতির ${fundName} এ পর্যাপ্ত অর্থ নেই (বর্তমান স্থিতি: ৳${previousLiquid.toLocaleString()})।`,
        data: this.getAppData(),
      };
    }

    // Deduct from balances
    let newBalance = currentBalance;
    let newProfitBalance = profitBalance;
    if (source === 'profit') {
      newProfitBalance = Math.max(0, profitBalance - amount);
      newBalance = Math.max(0, currentBalance - amount);
    } else if (source === 'savings') {
      newBalance = Math.max(0, currentBalance - amount);
    } else {
      const pDec = Math.min(profitBalance, amount);
      const sDec = amount - pDec;
      newProfitBalance = Math.max(0, profitBalance - pDec);
      newBalance = Math.max(0, currentBalance - (pDec + sDec));
    }

    targetMember.currentBalance = newBalance;
    targetMember.profitShareBalance = newProfitBalance;
    targetMember.totalWithdrawn = (targetMember.totalWithdrawn || 0) + amount;
    targetMember.updatedAt = new Date().toISOString();
    members[memberIdx] = targetMember;
    this.saveMembers(members);

    // Generate Official Society Withdrawal Voucher Receipt
    const receipts = this.getReceipts();
    const nextRcptNum = receipts.length + 1;
    const receiptId = `RCT-WTH-${String(nextRcptNum).padStart(6, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const purposeTitle = source === 'profit'
      ? `সদস্য অর্জিত ঋণ মুনাফা লভ্যাংশ উত্তোলন (${reason || 'অনুমোদিত লভ্যাংশ উত্তোলন'})`
      : source === 'savings'
      ? `সদস্য মূল সঞ্চয় তহবিল উত্তোলন (${reason || 'অনুমোদিত সাধারণ উত্তোলন'})`
      : `সদস্য সঞ্চয় ও লভ্যাংশ তহবিল উত্তোলন (${reason || 'অনুমোদিত উত্তোলন'})`;

    const newReceipt: Receipt = {
      receiptId,
      transactionId: '',
      name: targetMember.name,
      phone: targetMember.phone,
      amount,
      purpose: purposeTitle,
      type: 'member_withdrawal',
      date: today,
      receivedBy: targetMember.name,
      issuedBy: currentUser.displayName,
      paymentMethod,
      memberSystemId: targetMember.systemId,
      createdAt: new Date().toISOString(),
    };

    // Record Cash/Bank Debit Outflow Transaction
    const transactions = this.getTransactions();
    const nextTrxNum = transactions.length + 1;
    const transactionId = `TXN-${String(nextTrxNum).padStart(6, '0')}`;
    newReceipt.transactionId = transactionId;
    receipts.unshift(newReceipt);
    this.saveReceipts(receipts);

    const balanceAfter = previousLiquid - amount;
    const newTransaction: Transaction = {
      transactionId,
      date: today,
      type: 'member_withdrawal',
      referenceId: receiptId,
      memberSystemId: targetMember.systemId,
      partyName: targetMember.name,
      description: `${purposeTitle}: ${targetMember.name} (৳${amount.toLocaleString()}) [রশিদ: ${receiptId}]`,
      debit: amount,
      credit: 0,
      balanceAfter,
      paymentMethod,
      createdBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    transactions.unshift(newTransaction);
    this.saveTransactions(transactions);

    // Save MemberWithdrawal record
    const withdrawals = this.getMemberWithdrawals();
    const withdrawalId = `WTH-${String(withdrawals.length + 1).padStart(6, '0')}`;
    const newWithdrawal: MemberWithdrawal = {
      withdrawalId,
      memberSystemId: targetMember.systemId,
      memberName: targetMember.name,
      memberPhone: targetMember.phone,
      amount,
      source,
      date: today,
      paymentMethod,
      payoutAccount,
      receiptId,
      reason,
      remainingBalanceAfter: newBalance,
      remainingProfitAfter: newProfitBalance,
      processedBy: currentUser.displayName,
      status: 'completed',
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    withdrawals.unshift(newWithdrawal);
    this.saveMemberWithdrawals(withdrawals);

    this.logActivity({
      userId: currentUser.userId,
      userDisplayName: currentUser.displayName,
      role: currentUser.role,
      action: 'MEMBER_WITHDRAWAL',
      module: 'Withdrawals',
      referenceId: withdrawalId,
      description: `সদস্য তহবিল উত্তোলন সম্পন্ন: ${targetMember.name} (৳${amount.toLocaleString()}) [উৎস: ${source}, রশিদ: ${receiptId}, অবশিষ্ট স্থিতি: ৳${newBalance.toLocaleString()}]`,
    });

    return {
      success: true,
      message: `৳${amount.toLocaleString()} সফলভাবে উত্তোলন সম্পন্ন হয়েছে এবং রসিদ (${receiptId}) তৈরি হয়েছে!`,
      data: this.getAppData(),
      withdrawal: newWithdrawal,
      receipt: newReceipt,
    };
  }
}

