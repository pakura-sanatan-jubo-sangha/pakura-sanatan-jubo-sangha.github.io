import {
  Member,
  Contribution,
  Loan,
  Borrower,
  LoanPayment,
  IncomeRecord,
  ExpenseRecord,
  Transaction,
  Receipt,
  ActivityLogItem,
  AppSettings,
  UserAccount,
  FullAppData,
} from '../types';
import { getAccessToken, googleSignIn, clearCachedAccessToken, auth } from './firebase';
import { StorageService, MAIN_ADMIN_EMAIL, MAIN_ADMIN_ACCOUNT, isStrictMainAdmin } from './storage';

export const SPREADSHEET_TITLE = 'PAKURA_SANATAN_YUVA_SANGHA_DB';

export const SHEET_NAMES = [
  'SummaryDashboard',
  'Settings',
  'Users',
  'Members',
  'Contributions',
  'Loans',
  'Borrowers',
  'LoanPayments',
  'Income',
  'Expenses',
  'Transactions',
  'Receipts',
  'Rules',
  'Meetings',
  'MeetingAttendance',
  'ActivityLog',
  'BackupLog',
] as const;

export type SheetTabName = (typeof SHEET_NAMES)[number];

// Ensure all 14 required tabs exist in the spreadsheet
export async function ensureAllSheetsExist(
  accessToken: string,
  spreadsheetId: string
): Promise<string[]> {
  const getRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!getRes.ok) {
    const err = await getRes.json().catch(() => ({}));
    const errMsg = err.error?.message || 'Failed to inspect Google Spreadsheet structure';
    if (getRes.status === 401 || err.error?.status === 'UNAUTHENTICATED' || errMsg.includes('invalid authentication credentials')) {
      clearCachedAccessToken();
      const authError: any = new Error(errMsg);
      authError.status = 401;
      authError.code = 'UNAUTHENTICATED';
      throw authError;
    }
    throw new Error(errMsg);
  }

  const sheetData = await getRes.json();
  const existingTitles: string[] = (sheetData.sheets || []).map(
    (s: { properties: { title: string } }) => s.properties.title
  );

  const missingSheets = SHEET_NAMES.filter((name) => !existingTitles.includes(name));

  if (missingSheets.length > 0) {
    const requests = missingSheets.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    }));

    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (!batchRes.ok) {
      const err = await batchRes.json().catch(() => ({}));
      console.warn('Batch add sheets warning:', err);
    }
  }

  return [...existingTitles, ...missingSheets];
}

// Clear all 14 sheets to wipe previous data, demo data, passwords, and old columns
export async function clearAllSpreadsheetData(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  try {
    const ranges = SHEET_NAMES.map((title) => `'${title}'!A1:ZZ5000`);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ranges }),
      }
    );
    if (!res.ok) {
      console.warn('Values batchClear notice:', await res.text());
    }
  } catch (err) {
    console.warn('Batch clear warning:', err);
  }
}

// Generate data rows for all 14 sheets
export function generateAllSheetValueRanges(
  data: FullAppData
): { range: string; values: (string | number)[][] }[] {
  const valueRanges: { range: string; values: (string | number)[][] }[] = [];
  const metrics = StorageService.getDashboardMetrics(data);

  // 1. SummaryDashboard Sheet
  const summaryRows: (string | number)[][] = [
    ['Metric / বিবরণ', 'Value (৳ / সংখ্যা)', 'Status / মন্তব্য'],
    ['মোট সদস্য সংখ্যা (Total Members)', metrics.totalMembers, `${metrics.activeMembers} জন সক্রিয়`],
    ['মোট সদস্য মূলধন (Total Capital)', metrics.totalMemberCapital, 'সদস্যদের নিয়মিত সঞ্চয়'],
    ['মোট ঋণ মুনাফা আদায় (Total Profit)', metrics.totalLoanProfit, '১০% মাসিক হারে অর্জিত'],
    ['বাইরে থাকা ঋণ আসল (Money Outside)', metrics.moneyOutside, 'বর্তমানে গ্রাহকদের কাছে বিতরণকৃত'],
    ['নগদ ক্যাশ ব্যালেন্স (Cash in Hand)', metrics.cashBalance, 'কোষাধ্যক্ষের নিকট সংরক্ষিত'],
    ['ব্যাংক একাউন্ট ব্যালেন্স (Bank Balance)', metrics.bankBalance, 'অ্যাসোসিয়েশন ব্যাংক স্থিতি'],
    ['মোট অর্জিত আয় (Total Income)', metrics.totalIncome, 'দান ও অন্যান্য প্রাপ্তি'],
    ['মোট সংঘটিত ব্যয় (Total Expense)', metrics.totalExpense, 'পূজা ও বিভিন্ন পরিচালন ব্যয়'],
    ['সর্বমোট তহবিল স্থিতি (Net Total Fund)', metrics.cashBalance + metrics.bankBalance + metrics.moneyOutside, 'বর্তমান সর্বমোট সম্পদ'],
    ['সর্বশেষ আপডেট (Last Updated)', new Date().toLocaleString('bn-BD'), 'অটোমেটিক ক্লাউড সিঙ্ক'],
  ];
  valueRanges.push({ range: 'SummaryDashboard!A1:C' + summaryRows.length, values: summaryRows });

  // 2. Settings Sheet
  const settingRows: (string | number)[][] = [
    ['Setting Key / কনফিগারেশন', 'Setting Value / মান'],
    ['Society Name (সংগঠনের নাম)', data.settings.societyName],
    ['Subtitle (উপশিরোনাম)', data.settings.societySubtitle],
    ['Phone (যোগাযোগ ফোন)', data.settings.phone || '01711-000000'],
    ['Email (ইমেইল)', data.settings.email || 'pakurasanatan@gmail.com'],
    ['Address (ঠিকানা)', data.settings.address || 'পাকুড়া, বাংলাদেশ'],
    ['Currency (মুদ্রা)', data.settings.currency || '৳'],
    ['Monthly Contribution (মাসিক চাঁদা)', data.settings.monthlyContributionAmount],
    ['Contribution Due Day (জমার শেষ দিন)', data.settings.contributionDueDay],
    ['Loan Monthly Rate (%) (মাসিক সুদের হার)', data.settings.loanMonthlyRate],
    ['Loan Days Basis (দিন ভিত্তি)', data.settings.loanDaysBasis],
    ['Cash Opening Balance (ক্যাশ ওপেনিং)', data.settings.cashOpeningBalance],
    ['Bank Opening Balance (ব্যাংক ওপেনিং)', data.settings.bankOpeningBalance],
    ['Last Synced Timestamp', new Date().toISOString()],
  ];
  valueRanges.push({ range: 'Settings!A1:B' + settingRows.length, values: settingRows });

  // 3. Users / Admins Sheet (ONLY admin type, name, and Gmail address visible; NO passwords or sensitive details)
  const allAdmins = [
    MAIN_ADMIN_ACCOUNT,
    ...data.users.filter(
      (u) =>
        u.email?.toLowerCase() !== MAIN_ADMIN_EMAIL.toLowerCase() &&
        u.userId !== 'USR-MAIN-ADMIN'
    ),
  ];
  const userRows: (string | number)[][] = [
    ['Admin Type (অ্যাডমিন পদবী)', 'Name (পূর্ণ নাম)', 'Gmail Address (জিমেইল / ইমেইল)'],
    ...allAdmins.map((u) => {
      const isMain = isStrictMainAdmin(u);
      const adminType = isMain
        ? 'Main Admin (প্রধান সুপার অ্যাডমিন)'
        : u.role === 'admin'
        ? 'General Admin (সহকারী অ্যাডমিন)'
        : u.role === 'president'
        ? 'President (সভাপতি)'
        : u.role === 'treasurer'
        ? 'Treasurer (কোষাধ্যক্ষ)'
        : u.role === 'secretary'
        ? 'Secretary (সাধারণ সম্পাদক)'
        : 'Member (সদস্য)';
      return [adminType, u.name || u.displayName || '', u.email || ''];
    }),
  ];
  valueRanges.push({ range: 'Users!A1:C' + Math.max(2, userRows.length), values: userRows });

  // 4. Members Sheet (Complete 32+ members with current savings)
  const memberRows: (string | number)[][] = [
    ['Serial', 'SystemID', 'Name (নাম)', 'Phone (মোবাইল)', 'Status (অবস্থা)', 'CurrentBalance (বর্তমান সঞ্চয় ৳)', 'CreatedAt', 'UpdatedAt'],
    ...data.members.map((m, idx) => [
      idx + 1,
      m.systemId,
      m.name,
      m.phone,
      m.status === 'active' ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয় (Inactive)',
      m.currentBalance,
      m.createdAt,
      m.updatedAt,
    ]),
  ];
  valueRanges.push({ range: 'Members!A1:H' + Math.max(2, memberRows.length), values: memberRows });

  // 5. Contributions Sheet
  const contributionRows: (string | number)[][] = [
    ['ContributionID', 'MemberSystemID', 'MemberName', 'Amount (৳)', 'LateFee (৳)', 'Date', 'Month', 'Method', 'ReceiptID', 'RecordedBy', 'Status', 'CreatedAt'],
    ...data.contributions.map((c) => [
      c.contributionId,
      c.memberSystemId,
      c.memberName,
      c.amount,
      c.lateFee || 0,
      c.contributionDate,
      c.month,
      c.paymentMethod === 'cash' ? 'ক্যাশ (Cash)' : 'ব্যাংক (Bank)',
      c.receiptId,
      c.recordedBy,
      c.status,
      c.createdAt,
    ]),
  ];
  valueRanges.push({ range: 'Contributions!A1:L' + Math.max(2, contributionRows.length), values: contributionRows });

  // 6. Loans Sheet
  const loanRows: (string | number)[][] = [
    ['LoanID', 'BorrowerID', 'BorrowerName', 'Principal (৳)', 'LoanDate', 'MonthlyRate(%)', 'DaysBasis', 'Status', 'AccruedProfit', 'TotalProfitPaid', 'TotalPrincipalPaid', 'RemainingPrincipal', 'PaymentMethod', 'CreatedBy'],
    ...data.loans.map((l) => [
      l.loanId,
      l.borrowerId,
      l.borrowerName,
      l.principal,
      l.loanDate,
      l.rate,
      l.daysBasis,
      l.status,
      // profit calculation helper
      StorageService.calculateAccruedProfit(l),
      l.totalProfitPaid,
      l.totalPrincipalPaid,
      l.remainingPrincipal,
      l.paymentMethod === 'cash' ? 'Cash' : 'Bank',
      l.createdBy,
    ]),
  ];
  valueRanges.push({ range: 'Loans!A1:N' + Math.max(2, loanRows.length), values: loanRows });

  // 7. Borrowers Sheet (NID excluded for privacy)
  const borrowerRows: (string | number)[][] = [
    ['BorrowerID', 'BorrowerName', 'Phone', 'Status', 'CreatedAt'],
    ...data.borrowers.map((b) => [
      b.borrowerId,
      b.name,
      b.phone,
      b.status,
      b.createdAt,
    ]),
  ];
  valueRanges.push({ range: 'Borrowers!A1:E' + Math.max(2, borrowerRows.length), values: borrowerRows });

  // 8. LoanPayments Sheet
  const paymentRows: (string | number)[][] = [
    ['PaymentID', 'LoanID', 'BorrowerName', 'PaymentDate', 'TotalAmount (৳)', 'ProfitPaid (৳)', 'PrincipalPaid (৳)', 'RemainingPrincipalAfter (৳)', 'PaymentMethod', 'ReceiptID', 'ReceivedBy', 'Notes'],
    ...data.loanPayments.map((p) => [
      p.paymentId,
      p.loanId,
      p.borrowerName,
      p.paymentDate,
      p.amount,
      p.profitPaid,
      p.principalPaid,
      p.remainingPrincipalAfter,
      p.paymentMethod === 'cash' ? 'Cash' : 'Bank',
      p.receiptId,
      p.receivedBy,
      p.notes || '',
    ]),
  ];
  valueRanges.push({ range: 'LoanPayments!A1:L' + Math.max(2, paymentRows.length), values: paymentRows });

  // 9. Income Sheet
  const incomeRows: (string | number)[][] = [
    ['IncomeID', 'Date', 'Category', 'Amount (৳)', 'Description', 'PaymentMethod', 'Reference', 'ReceiptID', 'CreatedBy'],
    ...data.incomeRecords.map((i) => [
      i.incomeId,
      i.date,
      i.category,
      i.amount,
      i.description,
      i.paymentMethod === 'cash' ? 'Cash' : 'Bank',
      i.reference || '',
      i.receiptId || '',
      i.createdBy,
    ]),
  ];
  valueRanges.push({ range: 'Income!A1:I' + Math.max(2, incomeRows.length), values: incomeRows });

  // 10. Expenses Sheet
  const expenseRows: (string | number)[][] = [
    ['ExpenseID', 'Date', 'Category', 'Amount (৳)', 'Description', 'PaymentMethod', 'Reference', 'ReceiptID', 'CreatedBy'],
    ...data.expenseRecords.map((e) => [
      e.expenseId,
      e.date,
      e.category,
      e.amount,
      e.description,
      e.paymentMethod === 'cash' ? 'Cash' : 'Bank',
      e.reference || '',
      e.receiptId || '',
      e.createdBy,
    ]),
  ];
  valueRanges.push({ range: 'Expenses!A1:I' + Math.max(2, expenseRows.length), values: expenseRows });

  // 11. Transactions Master Ledger Sheet
  const trxRows: (string | number)[][] = [
    ['TransactionID', 'Date', 'Type', 'ReferenceID', 'PartyName', 'Description', 'Debit (৳)', 'Credit (৳)', 'BalanceAfter (৳)', 'PaymentMethod', 'Status', 'CreatedBy'],
    ...data.transactions.map((t) => [
      t.transactionId,
      t.date,
      t.type,
      t.referenceId,
      t.partyName,
      t.description,
      t.debit,
      t.credit,
      t.balanceAfter,
      t.paymentMethod === 'cash' ? 'Cash' : 'Bank',
      t.status,
      t.createdBy,
    ]),
  ];
  valueRanges.push({ range: 'Transactions!A1:L' + Math.max(2, trxRows.length), values: trxRows });

  // 12. Receipts Sheet
  const receiptRows: (string | number)[][] = [
    ['ReceiptID', 'TransactionID', 'Name', 'Phone', 'Amount (৳)', 'Purpose', 'Date', 'ReceivedBy', 'Method'],
    ...data.receipts.map((r) => [
      r.receiptId,
      r.transactionId,
      r.recipientName || r.name,
      r.phone,
      r.amount,
      r.purpose,
      r.date,
      r.receivedBy || r.issuedBy || '',
      r.paymentMethod === 'cash' ? 'Cash' : 'Bank',
    ]),
  ];
  valueRanges.push({ range: 'Receipts!A1:I' + Math.max(2, receiptRows.length), values: receiptRows });

  // 13. Rules Sheet
  const rules = data.rules || [];
  const ruleRows: (string | number)[][] = [
    ['RuleID', 'MeetingDate (সভার তারিখ)', 'Title (শিরোনাম)', 'Category (ক্যাটাগরি)', 'ResolutionNumber (রেজোলিউশন নং)', 'DecisionDetails (বিস্তারিত সিদ্ধান্ত)', 'RecordedBy (লিপিবদ্ধকারী)', 'CreatedAt'],
    ...rules.map((r) => [
      r.ruleId,
      r.meetingDate,
      r.title,
      r.category,
      r.resolutionNumber || '',
      r.decisionDetails,
      r.addedBy,
      r.createdAt,
    ]),
  ];
  valueRanges.push({ range: 'Rules!A1:H' + Math.max(2, ruleRows.length), values: ruleRows });

  // 14. Meetings Sheet
  const meetings = data.meetings || [];
  const meetingRows: (string | number)[][] = [
    ['MeetingID', 'Title', 'Date', 'ScheduledTime', 'Location', 'Status', 'AttendanceRecorded', 'PresentCount', 'TotalMembers', 'AttendanceRate(%)', 'CertifiedBy', 'CertifiedAt', 'Agenda', 'Notes'],
    ...meetings.map((m) => {
      const total = m.attendees?.length || 0;
      const present = m.attendees?.filter((a) => a.status === 'present').length || 0;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return [
        m.meetingId,
        m.title,
        m.meetingDate,
        m.scheduledTime,
        m.location,
        m.status,
        m.attendanceRecorded ? 'Yes' : 'No',
        present,
        total,
        rate,
        m.recordedBy || '',
        m.recordedAt || '',
        m.agenda || '',
        m.notes || '',
      ];
    }),
  ];
  valueRanges.push({ range: 'Meetings!A1:N' + Math.max(2, meetingRows.length), values: meetingRows });

  // 15. MeetingAttendance Sheet
  const attendanceRows: (string | number)[][] = [
    ['MeetingID', 'MeetingTitle', 'MeetingDate', 'MemberSystemID', 'MemberName', 'Phone', 'AttendanceStatus', 'CertifiedBy', 'CertifiedAt'],
  ];
  meetings.forEach((m) => {
    (m.attendees || []).forEach((att) => {
      attendanceRows.push([
        m.meetingId,
        m.title,
        m.meetingDate,
        att.memberSystemId,
        att.memberName,
        att.phone,
        att.status === 'present' ? 'উপস্থিত (Present)' : 'অনুপস্থিত (Absent)',
        m.recordedBy || '',
        m.recordedAt || '',
      ]);
    });
  });
  valueRanges.push({ range: 'MeetingAttendance!A1:I' + Math.max(2, attendanceRows.length), values: attendanceRows });

  // 16. ActivityLog Sheet
  const logRows: (string | number)[][] = [
    ['LogID', 'DateTime', 'User', 'Role', 'Action', 'Module', 'Description'],
    ...data.activityLogs.slice(0, 500).map((l) => [
      l.logId,
      l.dateTime || l.timestamp || '',
      l.userDisplayName || l.userName || '',
      l.role,
      l.action,
      l.module,
      l.description || l.details || '',
    ]),
  ];
  valueRanges.push({ range: 'ActivityLog!A1:G' + Math.max(2, logRows.length), values: logRows });

  // 14. BackupLog Sheet
  const backupRows: (string | number)[][] = [
    ['BackupID', 'Timestamp', 'TriggeredBy', 'TotalMembers', 'TotalContributions', 'TotalLoans', 'TotalTransactions', 'Status'],
    [
      `BKP-${Date.now()}`,
      new Date().toISOString(),
      'Admin / Auto-Sync',
      data.members.length,
      data.contributions.length,
      data.loans.length,
      data.transactions.length,
      'SUCCESS',
    ],
  ];
  valueRanges.push({ range: 'BackupLog!A1:H' + backupRows.length, values: backupRows });

  return valueRanges;
}

// Create new Google Spreadsheet with all 14 tabs
export async function createGoogleSheetDatabase(
  accessToken: string,
  data: FullAppData
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const sheetsConfig = SHEET_NAMES.map((title) => ({
    properties: {
      title,
      gridProperties: {
        frozenRowCount: 1,
      },
    },
  }));

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_TITLE,
      },
      sheets: sheetsConfig,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create Google Spreadsheet');
  }

  const createdSpreadsheet = await createRes.json();
  const spreadsheetId = createdSpreadsheet.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write all data
  await syncDataToGoogleSheets(accessToken, spreadsheetId, data);

  return { spreadsheetId, spreadsheetUrl };
}

// Full sync to Google Sheets
export async function syncDataToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  data: FullAppData
): Promise<boolean> {
  // 1. Ensure all 14 sheets exist
  await ensureAllSheetsExist(accessToken, spreadsheetId);

  // 2. Clear all 14 sheets completely to remove any previous data, leftover columns, and old demo records
  await clearAllSpreadsheetData(accessToken, spreadsheetId);

  // 3. Generate ranges
  const valueRanges = generateAllSheetValueRanges(data);

  // 4. Batch update with clean data
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueRanges,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to sync data to Google Sheets');
  }

  // Update last sync date
  StorageService.updateSettings({
    lastSyncDate: new Date().toLocaleString('bn-BD'),
    lastSyncedAt: new Date().toISOString(),
  });

  return true;
}

// Step-by-Step Synchronizer with live callbacks
export async function syncStepByStepToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  data: FullAppData,
  onStepProgress: (stepNumber: number, totalSteps: number, stepTitle: string) => void
): Promise<boolean> {
  const valueRanges = generateAllSheetValueRanges(data);
  const totalSteps = valueRanges.length + 2;

  // Step 1: Ensure all tabs exist
  onStepProgress(1, totalSteps, `গুগল শিটের ${SHEET_NAMES.length}টি ট্যাব যাচাই ও প্রস্তুত করা হচ্ছে (Ensuring ${SHEET_NAMES.length} Tabs)...`);
  await ensureAllSheetsExist(accessToken, spreadsheetId);

  // Step 2: Clear all previous data and columns for 100% clean state
  onStepProgress(2, totalSteps, 'পূর্ববর্তী সকল তথ্য ও অপ্রয়োজনীয় কলাম মুছে ফেলা হচ্ছে (Clearing Previous Data)...');
  await clearAllSpreadsheetData(accessToken, spreadsheetId);

  // Step 3+: write each tab step-by-step
  for (let i = 0; i < valueRanges.length; i++) {
    const vr = valueRanges[i];
    const sheetName = vr.range.split('!')[0];
    onStepProgress(
      i + 3,
      totalSteps,
      `ট্যাব ${i + 1}/${valueRanges.length} (${sheetName}) এ পরিচ্ছন্ন ডাটা সংরক্ষণ করা হচ্ছে...`
    );

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        vr.range
      )}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: vr.range,
          majorDimension: 'ROWS',
          values: vr.values,
        }),
      }
    );

    if (!res.ok) {
      console.warn(`Warning on updating ${sheetName}:`, await res.text());
    }
  }

  // Update last sync date
  StorageService.updateSettings({
    lastSyncDate: new Date().toLocaleString('bn-BD'),
    lastSyncedAt: new Date().toISOString(),
  });

  return true;
}

// Diagnostics and Live Health Check for Google Apps Script Webhook
export interface WebhookTestResult {
  ok: boolean;
  status?: number;
  error?: string;
  message?: string;
  solution?: string;
}

export async function testAppsScriptWebhook(webAppUrl: string): Promise<WebhookTestResult> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com/macros/s/')) {
    return {
      ok: false,
      error: 'INVALID_URL',
      message: 'গুগল অ্যাপস স্ক্রিপ্ট ওয়েবহুক URL অবশ্যই https://script.google.com/macros/s/... দিয়ে শুরু হতে হবে।',
      solution: 'সঠিক গুগল স্ক্রিপ্ট ওয়েব অ্যাপ URL পেস্ট করুন।',
    };
  }

  try {
    const res = await fetch('/api/sheets/webhook-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webAppUrl }),
    });
    const json = await res.json();
    return {
      ok: json.success,
      status: json.status,
      error: json.error,
      message: json.message,
      solution: json.solution,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: err.message || 'সার্ভারের সাথে যোগাযোগ করা যায়নি।',
    };
  }
}

// Sync via Google Apps Script Web App (Webhook) - With full diagnostics and verification
export async function syncViaAppsScriptWebhook(
  webAppUrl: string,
  data: FullAppData
): Promise<{ success: boolean; message?: string }> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com/macros/s/')) {
    throw new Error('অবৈধ গুগল স্ক্রিপ্ট URL। অনুগ্রহ করে সঠিক URL দিন।');
  }

  // 1. Try server-side proxy route first (verifies true HTTP status code 200 vs 401)
  try {
    const res = await fetch('/api/sheets/webhook-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webAppUrl, data }),
    });

    const result = await res.json().catch(() => null);

    if (res.status === 401 || result?.error === 'GOOGLE_APPS_SCRIPT_401_UNAUTHORIZED') {
      const error: any = new Error(
        result?.message ||
          'গুগল স্ক্রিপ্ট ডিপ্লয়মেন্টে 401 Unauthorized এরর! গুগল স্ক্রিপ্টে Deploy > Manage deployments-এ Who has access: "Anyone" নির্বাচন করুন।'
      );
      error.status = 401;
      error.code = 'GOOGLE_APPS_SCRIPT_401_UNAUTHORIZED';
      error.solution = result?.solution;
      throw error;
    }

    if (!res.ok || (result && !result.success)) {
      throw new Error(result?.message || `গুগল শিট সিঙ্ক ব্যর্থ হয়েছে (HTTP ${res.status})`);
    }

    // Success! Update last sync date
    StorageService.updateSettings({
      lastSyncDate: new Date().toLocaleString('bn-BD'),
      lastSyncedAt: new Date().toISOString(),
    });

    return { success: true, message: result?.message || 'সফলভাবে গুগল শিটে ডাটা সংরক্ষিত হয়েছে।' };
  } catch (serverErr: any) {
    if (serverErr.status === 401 || serverErr.code === 'GOOGLE_APPS_SCRIPT_401_UNAUTHORIZED' || serverErr.message?.includes('401')) {
      throw serverErr;
    }

    // Direct browser fetch fallback
    console.warn('Backend proxy sync notice, attempting direct webhook call:', serverErr.message);
    const payload = {
      action: 'syncAllData',
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      await fetch(webAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      StorageService.updateSettings({
        lastSyncDate: new Date().toLocaleString('bn-BD'),
        lastSyncedAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (directErr: any) {
      throw new Error(directErr.message || 'গুগল শিটে ডাটা সংরক্ষণ করা সম্ভব হয়নি।');
    }
  }
}

// Ready-to-use Google Apps Script Template
export function getAppsScriptCodeTemplate(): string {
  return `/**
 * পাকুড়া সনাতন যুব সংঘ - Google Apps Script Webhook & Automated Database Sync
 * 
 * ১০০% নির্ভরযোগ্য অটো-সিঙ্ক ও হিস্টোরিক্যাল রেকর্ড ব্যাকআপ সিস্টেম
 * 
 * সেটআপ নির্দেশিকা:
 * ১. আপনার মূল গুগল শিটে যান -> Extensions -> Apps Script
 * ২. পূর্বের সব কোড মুছে এই কোডটি সেখানে পেস্ট করুন
 * ৩. Deploy -> New deployment (বা Manage deployments) -> Select type: Web app
 * ৪. Execute as: Me (আপনার জিমেইল)
 * ৫. Who has access: Anyone (অবশ্যই "Anyone" নির্বাচন করবেন, "Only myself" দিলে ৪০১ এরর আসবে)
 * ৬. Deploy বাটনে চাপুন এবং প্রাপ্ত Web App URL টি সিস্টেমে পেস্ট করুন।
 */

// অপশনাল: যদি আলাদা গুগল শিট ফাইলে হিস্টোরি রাখতে চান তবে নিচে তার Spreadsheet ID লিখুন
// খালি রাখলে বর্তমান গুগল শিটেই "Historical_Entries_Log" নামে আলাদা ট্যাবে ইতিহাস সংরক্ষিত হবে
var HISTORICAL_SPREADSHEET_ID = "";

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    app: "পাকুড়া সনাতন যুব সংঘ - Google Sheets Database Sync",
    message: "Google Apps Script Webhook is active and working properly!",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No post data received" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var json = JSON.parse(e.postData.contents);
    if (json.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "pong", timestamp: new Date().toISOString() })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No active sheet" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = json.data;
    if (!data) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No data payload" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ১. মূল সক্রিয় শিটসমূহ আপডেট (Active Data Sheets)
    // 1. SummaryDashboard
    var metrics = data.metrics || {};
    writeSheet(ss, "SummaryDashboard", [
      ["Metric / বিবরণ", "Value (৳ / সংখ্যা)", "Status / মন্তব্য"],
      ["মোট সদস্য সংখ্যা (Total Members)", (data.members || []).length, "জন সাধারণ সদস্য"],
      ["নগদ ক্যাশ ব্যালেন্স (Cash in Hand)", metrics.cashBalance || 0, "ক্যাশ স্থিতি"],
      ["ব্যাংক ব্যালেন্স (Bank Balance)", metrics.bankBalance || 0, "ব্যাংক স্থিতি"],
      ["সর্বশেষ আপডেট (Last Updated)", new Date().toLocaleString("bn-BD"), "ওয়েবহুক অটোমেটিক সিঙ্ক"]
    ]);

    // 2. Settings
    var s = data.settings || {};
    writeSheet(ss, "Settings", [
      ["Setting Key / কনফিগারেশন", "Setting Value / মান"],
      ["Society Name (সংগঠনের নাম)", s.societyName || "পাকুড়া সনাতন যুব সংঘ"],
      ["Monthly Contribution (মাসিক চাঁদা)", s.monthlyContributionAmount || 100],
      ["Loan Monthly Rate (%) (মাসিক মুনাফার হার)", s.loanMonthlyRate || 10],
      ["Last Synced Timestamp", new Date().toISOString()]
    ]);

    // 3. Users / Admins (strictly NO passwords or sensitive tokens)
    var usersList = [
      ["Main Admin (প্রধান সুপার অ্যাডমিন)", "Kajol Chandra Das", "freelancerkajolchandradas@gmail.com"]
    ];
    if (data.users && data.users.length > 0) {
      data.users.forEach(function(u) {
        var email = (u.email || "").toLowerCase().trim();
        if (email !== "freelancerkajolchandradas@gmail.com" && u.userId !== "USR-MAIN-ADMIN") {
          var type = u.role === "admin" ? "General Admin (সহকারী অ্যাডমিন)" : (u.role === "president" ? "President (সভাপতি)" : (u.role === "treasurer" ? "Treasurer (কোষাধ্যক্ষ)" : (u.role === "secretary" ? "Secretary (সাধারণ সম্পাদক)" : "Member (সদস্য)")));
          usersList.push([type, u.name || u.displayName || "", u.email || ""]);
        }
      });
    }
    writeSheet(ss, "Users", [["Admin Type (অ্যাডমিন পদবী)", "Name (পূর্ণ নাম)", "Gmail Address (জিমেইল / ইমেইল)"]].concat(usersList));

    // 4. Members
    writeSheet(ss, "Members", [["Serial", "SystemID", "Name (নাম)", "Phone (মোবাইল)", "Status (অবস্থা)", "CurrentBalance (বর্তমান সঞ্চয় ৳)", "CreatedAt", "UpdatedAt"]].concat(
      (data.members || []).map(function(m, idx) { return [idx + 1, m.systemId, m.name, m.phone, m.status, m.currentBalance, m.createdAt, m.updatedAt]; })
    ));
    
    // 5. Contributions
    writeSheet(ss, "Contributions", [["ContributionID", "MemberSystemID", "MemberName", "Amount", "Date", "Month", "Method", "ReceiptID", "RecordedBy"]].concat(
      (data.contributions || []).map(function(c) { return [c.contributionId, c.memberSystemId, c.memberName, c.amount, c.contributionDate, c.month, c.paymentMethod, c.receiptId, c.recordedBy]; })
    ));
    
    // 6. Loans
    writeSheet(ss, "Loans", [["LoanID", "BorrowerID", "BorrowerName", "Principal", "LoanDate", "Rate", "RemainingPrincipal", "Status"]].concat(
      (data.loans || []).map(function(l) { return [l.loanId, l.borrowerId, l.borrowerName, l.principal, l.loanDate, l.rate, l.remainingPrincipal, l.status]; })
    ));

    // 7. Borrowers
    writeSheet(ss, "Borrowers", [["BorrowerID", "BorrowerName", "Phone", "Status", "CreatedAt"]].concat(
      (data.borrowers || []).map(function(b) { return [b.borrowerId, b.name, b.phone, b.status, b.createdAt]; })
    ));

    // 8. LoanPayments
    writeSheet(ss, "LoanPayments", [["PaymentID", "LoanID", "BorrowerName", "PaymentDate", "TotalAmount", "ProfitPaid", "PrincipalPaid", "RemainingPrincipalAfter", "Method", "ReceiptID", "ReceivedBy"]].concat(
      (data.loanPayments || []).map(function(p) { return [p.paymentId, p.loanId, p.borrowerName, p.paymentDate, p.amount, p.profitPaid, p.principalPaid, p.remainingPrincipalAfter, p.paymentMethod, p.receiptId, p.receivedBy]; })
    ));
    
    // 9. Income
    writeSheet(ss, "Income", [["IncomeID", "Date", "Category", "Amount", "Description", "Method", "ReceiptID"]].concat(
      (data.incomeRecords || []).map(function(i) { return [i.incomeId, i.date, i.category, i.amount, i.description, i.paymentMethod, i.receiptId]; })
    ));
    
    // 10. Expenses
    writeSheet(ss, "Expenses", [["ExpenseID", "Date", "Category", "Amount", "Description", "Method", "ReceiptID"]].concat(
      (data.expenseRecords || []).map(function(e) { return [e.expenseId, e.date, e.category, e.amount, e.description, e.paymentMethod, e.receiptId]; })
    ));
    
    // 11. Transactions
    writeSheet(ss, "Transactions", [["TransactionID", "Date", "Type", "ReferenceID", "PartyName", "Debit", "Credit", "BalanceAfter", "Method"]].concat(
      (data.transactions || []).map(function(t) { return [t.transactionId, t.date, t.type, t.referenceId, t.partyName, t.debit, t.credit, t.balanceAfter, t.paymentMethod]; })
    ));
    
    // 12. Receipts
    writeSheet(ss, "Receipts", [["ReceiptID", "TransactionID", "RecipientName", "Phone", "Amount", "Purpose", "Date", "ReceivedBy"]].concat(
      (data.receipts || []).map(function(r) { return [r.receiptId, r.transactionId, r.recipientName || r.name, r.phone, r.amount, r.purpose, r.date, r.receivedBy]; })
    ));

    // 13. Rules
    writeSheet(ss, "Rules", [["RuleID", "MeetingDate", "Title", "Category", "ResolutionNumber", "DecisionDetails", "RecordedBy"]].concat(
      (data.rules || []).map(function(r) { return [r.ruleId, r.meetingDate, r.title, r.category, r.resolutionNumber || "", r.decisionDetails, r.addedBy]; })
    ));

    // 14. Meetings
    writeSheet(ss, "Meetings", [["MeetingID", "Title", "Date", "ScheduledTime", "Location", "Status", "AttendanceRecorded", "CertifiedBy", "CertifiedAt"]].concat(
      (data.meetings || []).map(function(m) { return [m.meetingId, m.title, m.meetingDate, m.scheduledTime, m.location, m.status, m.attendanceRecorded ? "Yes" : "No", m.recordedBy || "", m.recordedAt || ""]; })
    ));

    // 15. MeetingAttendance
    var attRows = [["MeetingID", "MeetingTitle", "Date", "MemberSystemID", "MemberName", "Status", "CertifiedBy"]];
    (data.meetings || []).forEach(function(m) {
      (m.attendees || []).forEach(function(a) {
        attRows.push([m.meetingId, m.title, m.meetingDate, a.memberSystemId, a.memberName, a.status, m.recordedBy || ""]);
      });
    });
    writeSheet(ss, "MeetingAttendance", attRows);

    // 16. ActivityLog
    writeSheet(ss, "ActivityLog", [["LogID", "DateTime", "User", "Role", "Action", "Module", "Description"]].concat(
      (data.activityLogs || []).slice(0, 300).map(function(l) { return [l.logId, l.dateTime || l.timestamp || "", l.userDisplayName || l.userName || "", l.role, l.action, l.module, l.description || l.details || ""]; })
    ));
    
    // ২. হিস্টোরিক্যাল রেকর্ড লগ (Dedicated Historical Entries Archive)
    // এটি কখনো মোছা হবে না; প্রতিটি লেনদেন ও সঞ্চয়ের সম্পূর্ণ ইতিহাস স্থায়ীভাবে সংরক্ষিত থাকবে
    var targetHistorySS = ss;
    if (HISTORICAL_SPREADSHEET_ID && HISTORICAL_SPREADSHEET_ID.trim().length > 10) {
      try {
        targetHistorySS = SpreadsheetApp.openById(HISTORICAL_SPREADSHEET_ID.trim());
      } catch (e) {
        targetHistorySS = ss;
      }
    }
    
    appendHistoricalLog(targetHistorySS, data);

    // ৩. ব্যাকআপ স্ন্যাপশট লগ (Backup Log)
    writeSheet(ss, "BackupLog", [
      ["BackupID", "Timestamp", "TriggeredBy", "TotalMembers", "TotalContributions", "TotalLoans", "TotalTransactions", "Status"],
      [
        "BKP-" + new Date().getTime(),
        new Date().toISOString(),
        "Webhook Auto-Sync",
        (data.members || []).length,
        (data.contributions || []).length,
        (data.loans || []).length,
        (data.transactions || []).length,
        "SUCCESS"
      ]
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", timestamp: new Date().toISOString() })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function writeSheet(ss, sheetName, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clear();
  if (rows && rows.length > 0) {
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold").setBackground("#065f46").setFontColor("#ffffff");
  }
}

// স্থায়ী ঐতিহাসিক খতিয়ান সংরক্ষণ (Immutable Append-Only Audit Trail)
function appendHistoricalLog(ss, data) {
  var sheetName = "Historical_Entries_Log";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [["LogTimestamp", "EntryType", "RecordID", "Party/Member", "Amount (৳)", "Date", "Description", "Status", "RecordedBy"]];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.getRange(1, 1, 1, headers[0].length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  // বিদ্যমান রেকর্ড আইডিগুলো সংগ্রহ করা যাতে ডুপ্লিকেট না হয়
  var lastRow = sheet.getLastRow();
  var existingIds = {};
  if (lastRow > 1) {
    var idColValues = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    for (var i = 0; i < idColValues.length; i++) {
      if (idColValues[i][0]) existingIds[idColValues[i][0]] = true;
    }
  }

  var nowStr = new Date().toISOString();
  var newRows = [];

  // ১. সঞ্চয় জমা এন্ট্রি
  (data.contributions || []).forEach(function(c) {
    if (c.contributionId && !existingIds[c.contributionId]) {
      newRows.push([nowStr, "Contribution", c.contributionId, c.memberName || c.memberSystemId, c.amount, c.contributionDate || c.month, "মাসিক সঞ্চয় (" + c.month + ")", c.status, c.recordedBy || ""]);
      existingIds[c.contributionId] = true;
    }
  });

  // ২. ক্যাশ ও ব্যাংক লেনদেন
  (data.transactions || []).forEach(function(t) {
    if (t.transactionId && !existingIds[t.transactionId]) {
      newRows.push([nowStr, "Transaction", t.transactionId, t.partyName || "", (t.credit || 0) - (t.debit || 0), t.date, t.description || "", t.status, t.createdBy || ""]);
      existingIds[t.transactionId] = true;
    }
  });

  // ৩. ঋণ কিস্তি আদায়
  (data.loanPayments || []).forEach(function(p) {
    if (p.paymentId && !existingIds[p.paymentId]) {
      newRows.push([nowStr, "LoanPayment", p.paymentId, p.borrowerName, p.amount, p.paymentDate, "ঋণ কিস্তি আদায় (আসল: " + p.principalPaid + ", মুনাফা: " + p.profitPaid + ")", "Completed", p.receivedBy || ""]);
      existingIds[p.paymentId] = true;
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}`;
}

export class GoogleSheetsService {
  // Enforce: "No one other than me—using my Gmail address (freelancerkajolchandradas@gmail.com)—will be able to modify the Google Sheet."
  static verifyMainAdminModifier(): void {
    const googleUser = auth.currentUser;
    const currentUser = StorageService.getCurrentUser();

    // Check Firebase Google Auth account:
    // Only inspect real Google OAuth accounts. Synthetic member phone emails (@member.pakura.org) are internal phone-auth sessions and must not be treated as unauthorized Google accounts.
    if (googleUser && googleUser.email) {
      const isSyntheticMemberEmail =
        googleUser.email.endsWith('@member.pakura.org') ||
        googleUser.email.includes('member.pakura.org');

      if (!isSyntheticMemberEmail) {
        if (googleUser.email.toLowerCase().trim() !== MAIN_ADMIN_EMAIL.toLowerCase()) {
          throw new Error(
            `অননুমোদিত গুগল একাউন্ট (${googleUser.email})! শুধুমাত্র প্রধান অ্যাডমিনের জিমেইল (${MAIN_ADMIN_EMAIL}) দিয়ে গুগল শিট সংশোধন বা সিঙ্ক করা সম্ভব।`
          );
        }
      }
    }

    // Check logged-in profile:
    // Only Main Super Admin (freelancerkajolchandradas@gmail.com or isMainAdmin) can modify Google Sheets
    const isMainAdminProfile = isStrictMainAdmin(currentUser);

    if (!isMainAdminProfile) {
      throw new Error(
        `অননুমোদিত অ্যাক্সেস! শুধুমাত্র প্রধান অ্যাডমিন (${MAIN_ADMIN_EMAIL}) গুগল শিট সংশোধন বা পরিবর্তন করার কর্তৃত্ব রাখেন।`
      );
    }
  }

  static async getValidToken(interactive: boolean = false): Promise<string | null> {
    // If a synthetic member phone session is present in Firebase Auth, sign it out so Google OAuth connects cleanly as admin
    if (auth.currentUser?.email?.endsWith('@member.pakura.org') || auth.currentUser?.email?.includes('member.pakura.org')) {
      await auth.signOut().catch(() => {});
    }

    this.verifyMainAdminModifier();
    let token = await getAccessToken();
    if (!token && interactive) {
      try {
        const signInResult = await googleSignIn();
        token = signInResult?.accessToken || null;
      } catch (err: any) {
        if (err?.message === 'POPUP_BLOCKED') {
          throw new Error('POPUP_BLOCKED');
        }
        throw err;
      }
    }
    // Re-verify after sign-in popup
    this.verifyMainAdminModifier();
    return token;
  }

  static async createNewAssociationSpreadsheet(appData?: FullAppData): Promise<string> {
    this.verifyMainAdminModifier();
    const token = await this.getValidToken(true);
    if (!token) {
      throw new Error('Google Sign-In is required to create a new spreadsheet in Google Drive.');
    }
    const data = appData || StorageService.getAppData();
    const result = await createGoogleSheetDatabase(token, data);
    return result.spreadsheetId;
  }

  static async syncAllDataToSheet(
    spreadsheetId: string,
    appData?: FullAppData,
    interactive: boolean = false
  ): Promise<boolean> {
    this.verifyMainAdminModifier();
    const token = await this.getValidToken(interactive);
    if (!token) {
      if (interactive) {
        throw new Error('Google Sign-In is required to access Google Sheets.');
      }
      return false;
    }
    const data = appData || StorageService.getAppData();
    return await syncDataToGoogleSheets(token, spreadsheetId, data);
  }

  static async syncAllToGoogleSheets(
    spreadsheetId: string,
    appData?: FullAppData,
    interactive: boolean = false
  ): Promise<boolean> {
    this.verifyMainAdminModifier();
    return await this.syncAllDataToSheet(spreadsheetId, appData, interactive);
  }

  static async syncStepByStep(
    spreadsheetId: string,
    appData: FullAppData,
    onProgress: (step: number, total: number, message: string) => void,
    interactive: boolean = true
  ): Promise<boolean> {
    this.verifyMainAdminModifier();
    let token = await this.getValidToken(interactive);
    if (!token) {
      throw new Error('Google Sign-In is required to save data directly to Google Sheets.');
    }
    try {
      return await syncStepByStepToGoogleSheets(token, spreadsheetId, appData, onProgress);
    } catch (err: any) {
      const isAuthErr =
        err?.status === 401 ||
        err?.code === 'UNAUTHENTICATED' ||
        err?.message?.includes('invalid authentication credentials') ||
        err?.message?.includes('UNAUTHENTICATED');

      if (isAuthErr) {
        clearCachedAccessToken();
        if (interactive) {
          const freshToken = await this.getValidToken(true);
          if (freshToken) {
            return await syncStepByStepToGoogleSheets(freshToken, spreadsheetId, appData, onProgress);
          }
        }
      }
      throw err;
    }
  }
}
