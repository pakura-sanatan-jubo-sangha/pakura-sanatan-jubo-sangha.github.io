export type Role = 'admin' | 'president' | 'treasurer' | 'secretary' | 'member';
export type UserRole = Role;

export type Language = 'bn' | 'en';
export type Theme = 'light' | 'dark';

export type PaymentMethod = 'cash' | 'bank' | 'bkash' | 'nagad' | 'rocket';
export type TransactionType =
  | 'contribution'
  | 'loan_disbursement'
  | 'loan_payment'
  | 'income'
  | 'expense'
  | 'opening_balance'
  | 'member_withdrawal'
  | 'withdrawal'
  | 'profit_distribution';
export type TransactionStatus = 'active' | 'reversed';

export interface Member {
  systemId: string; // Internal ID for Google Sheets (e.g. MEM-000001), NOT displayed on website UI
  name: string;
  phone: string;
  status: 'active' | 'inactive';
  currentBalance: number;
  profitShareBalance?: number; // Total loan profit shares allocated to this member
  totalWithdrawn?: number; // Total amount withdrawn by this member
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfitDistribution {
  distributionId: string; // e.g. "DIST-000001"
  date: string; // YYYY-MM-DD
  periodType: 'monthly' | 'yearly' | 'custom';
  periodLabel: string; // e.g. "মে ২০২৬" or "২০২৬ সাল (বার্ষিক)"
  totalLoanProfitSnapshot: number; // Total loan profit available at time of allocation
  grossProfitSnapshot?: number; // Gross loan profit collected
  totalExpensesDeducted?: number; // Total association expenses (jerseys, etc.) deducted
  netProfitSnapshot?: number; // Net available profit snapshot after expense deductions
  percentage: number; // e.g. 50 (50%)
  totalAllocatedAmount: number; // Snapshot * percentage / 100 or fixed amount * members
  memberCount: number; // Eligible active members count
  amountPerMember: number; // Allocated amount per member
  fixedAmountPerMember?: number; // If fixed equal amount per member was used
  distributionMethod: 'equal' | 'proportional'; // Equal split or proportional to savings
  allocatedBy: string; // Admin who performed the action
  receiptId?: string;
  notes?: string;
  createdAt: string;
}

export type WithdrawalSource = 'profit' | 'savings' | 'combined';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface MemberWithdrawal {
  withdrawalId: string; // e.g. "WTH-000001"
  memberSystemId: string;
  memberName: string;
  memberPhone?: string;
  amount: number;
  source?: WithdrawalSource; // 'profit' (সঞ্চিত মুনাফা) | 'savings' (মূল সঞ্চয়) | 'combined'
  date: string;
  paymentMethod: PaymentMethod | 'bkash' | 'nagad' | 'rocket';
  payoutAccount?: string; // Digital wallet number or bank account number
  receiptId?: string;
  reason?: string;
  remainingBalanceAfter?: number;
  remainingProfitAfter?: number;
  processedBy?: string;
  status: WithdrawalStatus; // 'pending' | 'approved' | 'rejected' | 'completed'
  rejectionReason?: string;
  requestedAt?: string;
  processedAt?: string;
  createdAt: string;
}

export interface UserAccount {
  userId: string;
  firebaseUid?: string;
  username: string;
  phone?: string;
  email?: string;
  name?: string;
  displayName: string;
  role: Role;
  memberSystemId?: string; // If role === 'member', tied to this member
  status: 'active' | 'inactive' | 'pending';
  password?: string;
  approvedBy?: string;
  approvedAt?: string;
  lastLogin?: string;
  createdAt: string;
  isMainAdmin?: boolean;
}

export interface Contribution {
  contributionId: string;
  memberSystemId: string;
  memberName: string;
  amount: number;
  contributionDate: string; // YYYY-MM-DD
  month: string; // e.g. "2026-09"
  paymentMethod: PaymentMethod;
  receiptId: string;
  recordedBy: string;
  createdAt: string;
  status: 'paid' | 'pending';
  contributionType?: 'regular' | 'seasonal_booster';
  lateFee?: number; // ৳10 if paid after the 10th of the month
  isLate?: boolean;
  notes?: string;
}

export interface Borrower {
  borrowerId: string; // Internal (e.g. BOR-000001)
  name: string;
  phone: string;
  nid: string; // Sensitive, visible only to authorized management
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Loan {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  principal: number;
  loanDate: string; // YYYY-MM-DD
  rate: number; // e.g. 10 (10% monthly)
  daysBasis: number; // e.g. 30
  status: 'active' | 'paid';
  totalProfitPaid: number;
  totalPrincipalPaid: number;
  remainingPrincipal: number;
  paymentMethod: PaymentMethod;
  createdBy: string;
  createdAt: string;
  totalDiscountGiven?: number; // Total interest discount (ছাড়) granted
  isHistoricalRepaid?: boolean; // True if recorded as an already repaid loan
  repaidDate?: string; // Date when fully repaid
}

export interface LoanPayment {
  paymentId: string;
  loanId: string;
  borrowerName: string;
  paymentDate: string;
  amount: number;
  profitPaid: number;
  principalPaid: number;
  remainingPrincipalAfter: number;
  paymentMethod: PaymentMethod;
  receiptId: string;
  receivedBy: string;
  createdAt: string;
  notes?: string;
  discount?: number; // Interest discount granted (মুনাফায় ছাড়, e.g. ৳29)
  accruedProfitBeforeDiscount?: number; // Calculated interest before discount
}

export interface IncomeRecord {
  incomeId: string;
  date: string;
  category: 'loan_profit' | 'donation' | 'other_income';
  categoryLabel?: string;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  receiptId?: string;
  createdBy: string;
  createdAt: string;
  person?: string;
  note?: string;
}
export type Income = IncomeRecord;

export interface ExpenseRecord {
  expenseId: string;
  date: string;
  category: 'jersey_tshirt' | 'puja' | 'event' | 'office' | 'others' | string;
  categoryLabel?: string;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  receiptId?: string;
  createdBy: string;
  createdAt: string;
  person?: string;
  note?: string;
}
export type Expense = ExpenseRecord;

export interface Transaction {
  transactionId: string;
  date: string;
  type: TransactionType;
  referenceId: string;
  memberSystemId?: string;
  borrowerId?: string;
  partyName: string;
  description: string;
  debit: number; // Outflow (Expense, Loan given)
  credit: number; // Inflow (Contribution, Loan payment, Income)
  balanceAfter: number;
  paymentMethod: PaymentMethod;
  createdBy: string;
  createdAt: string;
  status: TransactionStatus;
  reversalReason?: string;
}

export interface Receipt {
  receiptId: string;
  transactionId: string;
  name: string;
  phone: string;
  amount: number;
  purpose: string;
  date: string;
  receivedBy: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  recipientName?: string;
  type?: string;
  issuedBy?: string;
  memberSystemId?: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'member';
  senderPhone?: string;
  senderEmail?: string;
  text: string;
  imageUrl?: string;
  imageFileName?: string;
  createdAt: string;
  expiresAt: string;
}

export interface ActivityLogItem {
  logId: string;
  dateTime: string;
  timestamp?: string;
  userId: string;
  userName?: string;
  userDisplayName: string;
  role: Role;
  action: string;
  module: string;
  referenceId?: string;
  description: string;
  details?: string;
}
export type ActivityLog = ActivityLogItem;

export type RuleCategory = 'general' | 'savings' | 'loan' | 'meeting' | 'discipline' | 'welfare';

export interface SocietyRule {
  ruleId: string;
  meetingDate: string; // YYYY-MM-DD
  title: string;
  category: RuleCategory;
  decisionDetails: string;
  resolutionNumber?: string;
  status: 'active' | 'archived';
  addedBy: string;
  addedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAttendee {
  memberSystemId: string;
  memberName: string;
  phone?: string;
  status: 'present' | 'absent';
  notes?: string;
}

export interface GeneralMeeting {
  meetingId: string; // e.g. "MTG-000001"
  title: string;
  meetingDate: string; // YYYY-MM-DD
  scheduledTime: string; // e.g. "08:00 PM"
  location: string;
  agenda?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  attendanceRecorded: boolean;
  attendees: MeetingAttendee[];
  recordedBy?: string;
  recordedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  societyName: string;
  societySubtitle: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  monthlyContributionAmount: number;
  contributionDueDay: number;
  lateFeeAmount?: number;
  loanMonthlyRate: number; // 10%
  loanDaysBasis: number; // 30
  allowNewMembers: boolean;
  cashOpeningBalance: number;
  bankOpeningBalance: number;
  googleSheetId?: string;
  googleSheetUrl?: string;
  lastSyncedAt?: string;
  organizationName?: string;
  language?: Language;
  theme?: Theme;
  lastSyncDate?: string;
  googleAppsScriptUrl?: string;
  autoSyncSheets?: boolean;
  maxWithdrawalPercentage?: number; // e.g. 70 (max 70% of member's total funds can be withdrawn)
  minReserveBalance?: number; // e.g. 500 (minimum ৳500 reserve to keep membership active)
  adminPassword?: string;
}

export interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  totalMemberCapital: number;
  totalLoanProfit: number;
  moneyOutside: number;
  cashBalance: number;
  bankBalance: number;
  totalIncome: number;
  totalExpense: number;
}

export interface BackupSnapshot {
  backupId: string;
  timestamp: string;
  triggeredBy: string;
  counts: {
    members: number;
    contributions: number;
    loans: number;
    loanPayments: number;
    transactions: number;
    receipts: number;
    incomes: number;
    expenses: number;
  };
  checksum: string;
  status: 'verified' | 'pending' | 'restored' | 'corrupted';
  data: FullAppData;
}

export interface ServerApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  operationId?: string;
  timestamp: string;
}

export interface FullAppData {
  settings: AppSettings;
  users: UserAccount[];
  members: Member[];
  contributions: Contribution[];
  loans: Loan[];
  borrowers: Borrower[];
  loanPayments: LoanPayment[];
  incomes: IncomeRecord[];
  incomeRecords: IncomeRecord[];
  expenses: ExpenseRecord[];
  expenseRecords: ExpenseRecord[];
  transactions: Transaction[];
  receipts: Receipt[];
  activityLogs: ActivityLogItem[];
  rules: SocietyRule[];
  meetings?: GeneralMeeting[];
  profitDistributions?: ProfitDistribution[];
  memberWithdrawals?: MemberWithdrawal[];
  backupSnapshots?: BackupSnapshot[];
}
