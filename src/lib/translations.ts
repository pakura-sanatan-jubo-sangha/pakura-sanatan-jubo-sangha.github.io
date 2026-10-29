import { Language } from '../types';

export const t = {
  bn: {
    appName: 'পাকুড়া সনাতন যুব সংঘ',
    appSubtitle: 'স্থাপিত: ২০২৫ খ্রি. • অর্থ ও সদস্য ব্যবস্থাপনা সফটওয়্যার',
    login: 'লগইন করুন',
    logout: 'লগআউট',
    username: 'ব্যবহারকারীর নাম / ফোন',
    password: 'পাসওয়ার্ড / পিন',
    signInWithGoogle: 'গুগল দিয়ে সাইন-ইন',
    orLoginWithCredentials: 'অথবা ইউজারনেম দিয়ে লগইন করুন',
    lightMode: 'লাইট মোড',
    darkMode: 'ডার্ক মোড',
    searchPlaceholder: 'খুঁজুন (সদস্য, ঋণগ্রহীতা, রশিদ, লেনদেন)...',
    
    // Roles
    roleAdmin: 'প্রধান অ্যাডমিন',
    rolePresident: 'সভাপতি',
    roleTreasurer: 'কোষাধ্যক্ষ',
    roleSecretary: 'সাধারণ সম্পাদক',
    roleMember: 'সাধারণ সদস্য',
    
    // Navigation
    navDashboard: 'ড্যাশবোর্ড',
    navMembers: 'সদস্য তালিকা',
    navContributions: 'মাসিক সঞ্চয় (চাঁদা)',
    navLoans: 'ঋণ ব্যবস্থাপনা',
    navIncome: 'আয় সমূহ',
    navExpenses: 'ব্যয় সমূহ',
    navTransactions: 'মাস্টার লেজার (লেনদেন)',
    navReports: 'রিপোর্ট সেন্টার',
    navAnalytics: 'অ্যানালিটিক্স ও চার্ট',
    navReceipts: 'রশিদ ভাউচার',
    navGoogleSheets: 'গুগল শিট সিঙ্ক',
    navUsers: 'অ্যাডমিন ও নিয়মাবলি',
    navActivityLog: 'অডিট অ্যাক্টিভিটি লগ',
    navSettings: 'সিস্টেম সেটিংস',
    navMore: 'অন্যান্য মেনু',
    
    // Member specific nav
    myDashboard: 'আমার ড্যাশবোর্ড',
    myProfile: 'আমার প্রোফাইল',
    myContributions: 'আমার সঞ্চয় হিসাব',
    myHistory: 'আর্থিক ইতিহাস',
    myReceipts: 'আমার রশিদসমূহ',

    // Dashboard Cards
    totalMembers: 'মোট সদস্য',
    membersSubtitle: 'সক্রিয় সদস্য সংখ্যা',
    totalMemberCapital: 'মোট সদস্য মূলধন',
    totalLoanProfit: 'মোট ঋণ মুনাফা',
    moneyOutside: 'বাইরে থাকা ঋণ (আসল)',
    cashBalance: 'নগদ ক্যাশ ব্যালেন্স',
    bankBalance: 'ব্যাংক ব্যালেন্স',
    totalIncome: 'মোট অর্জিত আয়',
    totalExpense: 'মোট সংঘটিত ব্যয়',
    netFund: 'সর্বমোট তহবিল স্থিতি',
    totalConsolidatedFund: 'সর্বমোট সমন্বিত তহবিল',
    
    // Actions & Buttons
    addMember: 'নতুন সদস্য যোগ করুন',
    editMember: 'সদস্য তথ্য সংশোধন',
    deleteMember: 'সদস্য মুছে ফেলুন',
    confirmDeleteMember: 'সদস্য মুছে ফেলার নিশ্চিতকরণ',
    deleteMemberPrompt: 'আপনি কি নিশ্চিত যে এই সদস্যকে তালিকা থেকে মুছে ফেলতে চান? এই পদক্ষেপটি অপরিবর্তনীয়।',
    memberDeletedSuccess: 'সদস্যকে সফলভাবে তালিকা থেকে মুছে ফেলা হয়েছে!',
    confirmFullReset: 'সম্পূর্ণ রিসেট নিশ্চিত করুন',
    recordContribution: 'সঞ্চয় জমা নিন',
    createLoan: 'নতুন ঋণ প্রদান',
    receivePayment: 'ঋণের কিস্তি/আদায় নিন',
    addIncome: 'নতুন আয় জমা করুন',
    addExpense: 'নতুন ব্যয় রেকর্ড করুন',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    confirm: 'নিশ্চিত করুন',
    print: 'প্রিন্ট রশিদ',
    downloadPdf: 'পিডিএফ ডাউনলোড',
    exportCsv: 'এক্সেল / সিএসভি এক্সপোর্ট',
    reverseTransaction: 'লেনদেন রিভার্স করুন',
    viewDetails: 'বিস্তারিত দেখুন',
    filter: 'ফিল্টার',
    status: 'অবস্থা',
    active: 'সক্রিয়',
    inactive: 'নিষ্ক্রিয়',
    paid: 'পরিশোধিত',
    pending: 'বকেয়া',
    reversed: 'রিভার্সড',
    
    // Forms & Fields
    memberName: 'সদস্যের নাম',
    phoneNumber: 'মোবাইল নম্বর',
    currentBalance: 'বর্তমান সঞ্চয় স্থিতি',
    amount: 'টাকার পরিমাণ (৳)',
    date: 'তারিখ',
    paymentMethod: 'পরিশোধের মাধ্যম',
    cash: 'নগদ ক্যাশ',
    bank: 'ব্যাংক একাউন্ট',
    description: 'বিবরণ ও নোট',
    borrowerName: 'ঋণগ্রহীতার নাম',
    borrowerPhone: 'ঋণগ্রহীতার ফোন নম্বর',
    borrowerNid: 'জাতীয় পরিচয়পত্র (NID)',
    loanAmount: 'ঋণের আসল পরিমাণ (৳)',
    loanDate: 'ঋণ প্রদানের তারিখ',
    interestRate: 'মাসিক মুনাফার হার (১০% প্রতি মাসে)',
    daysBasis: 'মাসিক দিন ভিত্তি (৩০ দিন)',
    dailyProfitFormula: 'দৈনিক মুনাফা = আসল × ১০% ÷ ৩০ × অতিবাহিত দিন',
    selectMonth: 'মাস নির্বাচন করুন',
    selectAll: 'সবাইকে নির্বাচন করুন',
    markSelectedAsPaid: 'নির্বাচিতদের পরিশোধিত চিহ্নিত করুন',
    
    // Loans details
    daysElapsed: 'দিন অতিবাহিত',
    accruedProfit: 'জমাকৃত মুনাফা',
    remainingPrincipal: 'অবশিষ্ট আসল ঋণ',
    totalDueNow: 'বর্তমান মোট পাওনা',
    principalPaid: 'পরিশোধিত আসল',
    profitPaid: 'পরিশোধিত মুনাফা',
    borrowerHistory: 'ঋণগ্রহীতার লাইফটাইম ইতিহাস',
    
    // Receipts
    receiptNo: 'রশিদ নং',
    receivedFrom: 'প্রদানকারীর নাম',
    purpose: 'উদ্দেশ্য / বিবরণ',
    receivedBy: 'গ্রহীতার স্বাক্ষর / কোষাধ্যক্ষ',
    officialSeal: 'পাকুড়া সনাতন যুব সংঘের অফিসিয়াল রশিদ',
    
    // Notifications & Logs
    notifications: 'নোটিফিকেশন',
    noNotifications: 'কোনো নতুন নোটিফিকেশন নেই',
    markAllAsRead: 'সব পড়া হয়েছে মার্ক করুন',
    recentActivity: 'সাম্প্রতিক কার্যক্রম',
    
    // Google Sheets Integration
    googleSheetsTitle: 'গুগল শিট ক্লাউড ডাটাবেজ',
    googleSheetsDesc: 'আপনার পাকুড়া সনাতন যুব সংঘের ডাটা সরাসরি Google Sheets ও Drive-এ রিয়েলটাইমে ব্যাকআপ ও সিঙ্ক করুন।',
    connectGoogle: 'গুগল একাউন্ট যুক্ত করুন',
    syncNow: 'এখনই শিটে সিঙ্ক করুন',
    openSheet: 'গুগল শিটটি ওপেন করুন',
    sheetStatusConnected: 'গুগল শিট সংযুক্ত আছে',
    sheetStatusDisconnected: 'গুগল শিট সংযুক্ত নেই',
    
    // Messages
    memberAddedSuccess: 'নতুন সদস্য সফলভাবে যুক্ত হয়েছে',
    memberUpdatedSuccess: 'সদস্যের তথ্য সফলভাবে আপডেট হয়েছে',
    paymentReceivedSuccess: 'পরিশোধ সফলভাবে গৃহীত হয়েছে এবং রশিদ তৈরি হয়েছে',
    loanCreatedSuccess: 'নতুন ঋণ সফলভাবে তৈরি হয়েছে',
    transactionReversedSuccess: 'লেনদেন সফলভাবে রিভার্স করা হয়েছে',
    noPermissionWarning: 'আপনার এই কাজটি করার অনুমতি নেই।',
    demoDataResetSuccess: 'আর্থিক হিসাব সফলভাবে ৳০-তে রিসেট করা হয়েছে।',
    
    // Quick Demo Accounts Notice
    demoAccountsNotice: 'সহজে টেস্ট করার জন্য যেকোনো পদমর্যাদায় সরাসরি সুইচ করতে পারেন:',
    category: 'খাত / ক্যাটাগরি',
    principal: 'আসল টাকা',
    openSpreadsheet: 'গুগল শিট ওপেন ↗',
    receiptVoucher: 'অফিসিয়াল মানি রিসিট',
    printReceipt: 'রশিদ প্রিন্ট',
    saveSettings: 'সেটিংস সংরক্ষণ',
    addUser: 'নতুন ব্যবহারকারী যোগ',
    role: 'ভূমিকা (Role)',
    
    // Admin Security & Access Control
    adminLogin: 'প্রধান অ্যাডমিন লগইন',
    adminUnlockTitle: 'প্রধান সুপার অ্যাডমিন প্যানেল',
    adminUnlockDesc: 'প্রধান অ্যাডমিনের ইমেইল ও পাসওয়ার্ড দিয়ে পূর্ণ পরিচালনায় প্রবেশ করুন।',
    adminUnlockedBadge: 'প্রধান সুপার অ্যাডমিন (সক্রিয়)',
    viewOnlyBadge: 'ভিউ-অনলি ড্যাশবোর্ড',
    viewOnlyWarning: 'লঞ্চের পর সাধারণ দর্শকদের জন্য ড্যাশবোর্ডটি শুধু দেখার জন্য। উন্মুক্ত নিবন্ধন বন্ধ। শুধুমাত্র প্রধান অ্যাডমিন ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করতে পারবেন।',
    exitAdminMode: 'লগআউট',
    adminPassword: 'অ্যাডমিন পাসওয়ার্ড',
    changeAdminPassword: 'অ্যাডমিন পাসওয়ার্ড পরিবর্তন',
    currentPassword: 'বর্তমান পাসওয়ার্ড',
    newPassword: 'নতুন পাসওয়ার্ড',
    confirmNewPassword: 'নতুন পাসওয়ার্ড নিশ্চিত করুন',
    updatePassword: 'পাসওয়ার্ড আপডেট করুন',
    passwordsDoNotMatch: 'পাসওয়ার্ড দুটি মেলেনি!',
    adminPasswordChangedSuccess: 'অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!',
    stepByStepSync: 'ধাপে ধাপে সম্পূর্ণ সিঙ্ক (১৪টি ট্যাব)',
    stepByStepSyncDesc: 'ওয়েবসাইট এর প্রতিটি ডাটা ও ট্যাব ক্রমানুসারে গুগল শিটে সুন্দরভাবে রেকর্ড করা হবে।',
    autoSaveEnabled: 'অটো-সেভ সক্রিয় (Auto-Save)',
    dayMode: 'দিন মোড (Day)',
    nightMode: 'রাত মোড (Night)',
    autoSavingToSheets: 'গুগল শিটে সেভ হচ্ছে...',
    savedToSheets: 'গুগল শিটে সংরক্ষিত ✓',
  },
  en: {
    appName: 'Pakura Sanatan Jubo Sangha',
    appSubtitle: 'Est. 2025 • Finance & Member Management Software',
    login: 'Login',
    logout: 'Logout',
    username: 'Username / Phone',
    password: 'Password / PIN',
    signInWithGoogle: 'Sign in with Google',
    orLoginWithCredentials: 'Or login with credentials',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    searchPlaceholder: 'Search (Members, Borrowers, Receipts, Transactions)...',
    
    // Roles
    roleAdmin: 'Super Admin',
    rolePresident: 'President',
    roleTreasurer: 'Treasurer',
    roleSecretary: 'General Secretary',
    roleMember: 'General Member',
    
    // Navigation
    navDashboard: 'Dashboard',
    navMembers: 'Members List',
    navContributions: 'Monthly Savings',
    navLoans: 'Loan Management',
    navIncome: 'Incomes',
    navExpenses: 'Expenses',
    navTransactions: 'Master Ledger',
    navReports: 'Reports Center',
    navAnalytics: 'Analytics & Charts',
    navReceipts: 'Receipt Vouchers',
    navGoogleSheets: 'Google Sheets Sync',
    navUsers: 'Admin & Rules',
    navActivityLog: 'Audit Activity Log',
    navSettings: 'Settings',
    navMore: 'More Options',
    
    // Member specific nav
    myDashboard: 'My Dashboard',
    myProfile: 'My Profile',
    myContributions: 'My Contributions',
    myHistory: 'Financial History',
    myReceipts: 'My Receipts',

    // Dashboard Cards
    totalMembers: 'Total Members',
    membersSubtitle: 'Active members registered',
    totalMemberCapital: 'Total Member  Balance',
    totalLoanProfit: 'Total Loan Profit',
    moneyOutside: 'Money Outside (Principal)',
    cashBalance: 'Cash Balance',
    bankBalance: 'Bank Balance',
    totalIncome: 'Total Income',
    totalExpense: 'Total Expenses',
    netFund: 'Net Total Fund Balance',
    totalConsolidatedFund: 'Total Consolidated Fund',
    
    // Actions & Buttons
    addMember: 'Add New Member',
    editMember: 'Edit Member Details',
    deleteMember: 'Delete Member',
    confirmDeleteMember: 'Confirm Member Deletion',
    deleteMemberPrompt: 'Are you sure you want to delete this member from the roster? This action cannot be undone.',
    memberDeletedSuccess: 'Member successfully deleted from roster!',
    confirmFullReset: 'Confirm Full Reset',
    recordContribution: 'Record Savings',
    createLoan: 'Issue New Loan',
    receivePayment: 'Receive Payment',
    addIncome: 'Record Income',
    addExpense: 'Record Expense',
    save: 'Save Changes',
    cancel: 'Cancel',
    confirm: 'Confirm',
    print: 'Print Receipt',
    downloadPdf: 'Download PDF',
    exportCsv: 'Export Excel / CSV',
    reverseTransaction: 'Reverse Transaction',
    viewDetails: 'View Details',
    filter: 'Filter',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    paid: 'Paid',
    pending: 'Pending',
    reversed: 'Reversed',
    
    // Forms & Fields
    memberName: 'Member Name',
    phoneNumber: 'Phone Number',
    currentBalance: 'Current Savings Balance',
    amount: 'Amount (৳)',
    date: 'Date',
    paymentMethod: 'Payment Method',
    cash: 'Cash',
    bank: 'Bank Account',
    description: 'Description / Notes',
    borrowerName: 'Borrower Name',
    borrowerPhone: 'Borrower Phone',
    borrowerNid: 'National ID (NID)',
    loanAmount: 'Loan Principal Amount (৳)',
    loanDate: 'Disbursement Date',
    interestRate: 'Monthly Profit Rate (10% per month)',
    daysBasis: 'Days Basis (30 Days)',
    dailyProfitFormula: 'Profit = Principal × 10% ÷ 30 × Days',
    selectMonth: 'Select Month',
    selectAll: 'Select All',
    markSelectedAsPaid: 'Mark Selected as Paid',
    
    // Loans details
    daysElapsed: 'Days Elapsed',
    accruedProfit: 'Accrued Profit',
    remainingPrincipal: 'Remaining Principal',
    totalDueNow: 'Total Outstanding Due',
    principalPaid: 'Principal Repaid',
    profitPaid: 'Profit Repaid',
    borrowerHistory: 'Borrower Lifetime History',
    
    // Receipts
    receiptNo: 'Receipt No',
    receivedFrom: 'Received From',
    purpose: 'Purpose / Details',
    receivedBy: 'Received By / Treasurer',
    officialSeal: 'Official Voucher - Pakura Sanatan Jubo Sangha',
    
    // Notifications & Logs
    notifications: 'Notifications',
    noNotifications: 'No new notifications',
    markAllAsRead: 'Mark all as read',
    recentActivity: 'Recent Activities',
    
    // Google Sheets Integration
    googleSheetsTitle: 'Google Sheets Cloud Database',
    googleSheetsDesc: 'Live backup and synchronize Pakura Sanatan Jubo Sangha records directly with your Google Drive & Sheets.',
    connectGoogle: 'Connect Google Account',
    syncNow: 'Sync to Sheets Now',
    openSheet: 'Open Google Sheet',
    sheetStatusConnected: 'Google Sheet Connected',
    sheetStatusDisconnected: 'Google Sheet Not Connected',
    
    // Messages
    memberAddedSuccess: 'New member successfully added',
    memberUpdatedSuccess: 'Member details successfully updated',
    paymentReceivedSuccess: 'Payment received and receipt generated',
    loanCreatedSuccess: 'New loan successfully issued',
    transactionReversedSuccess: 'Transaction successfully reversed',
    noPermissionWarning: 'You do not have permission for this action.',
    demoDataResetSuccess: 'Financial ledgers reset to ৳0 successfully.',
    
    // Quick Demo Accounts Notice
    demoAccountsNotice: 'Quickly switch roles for testing with single click:',
    category: 'Category',
    principal: 'Principal',
    openSpreadsheet: 'Open Google Sheets ↗',
    receiptVoucher: 'Official Receipt Voucher',
    printReceipt: 'Print Receipt',
    saveSettings: 'Save Settings',
    addUser: 'Add User',
    role: 'Role',

    // Admin Security & Access Control
    adminLogin: 'Main Admin Login',
    adminUnlockTitle: 'Main Super Admin Panel',
    adminUnlockDesc: 'Log in with Main Admin email and password for full system control.',
    adminUnlockedBadge: 'Main Super Admin (Active)',
    viewOnlyBadge: 'View-Only Dashboard',
    viewOnlyWarning: 'Visitors have view-only access to the dashboard. Open registration is unavailable; users can only log in using main admin credentials.',
    exitAdminMode: 'Logout',
    adminPassword: 'Admin Password',
    changeAdminPassword: 'Change Admin Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    updatePassword: 'Update Password',
    passwordsDoNotMatch: 'Passwords do not match!',
    adminPasswordChangedSuccess: 'Admin password changed successfully!',
    stepByStepSync: 'Step-by-Step Full Sync (14 Tabs)',
    stepByStepSyncDesc: 'Systematically records every single piece of data across 14 tabs into Google Sheets.',
    autoSaveEnabled: 'Auto-Save Enabled',
    dayMode: 'Day Mode',
    nightMode: 'Night Mode',
    autoSavingToSheets: 'Saving to Google Sheet...',
    savedToSheets: 'Saved to Google Sheet ✓',
  }
};

export const getTranslation = (lang: Language) => t[lang] || t.bn;

/**
 * Format member phone number based on admin permission:
 * Admin view: full phone number (e.g. 01312345970)
 * View-only mode: only first 3 and last 3 digits displayed (e.g. 013*970)
 */
export const formatMemberPhone = (phone: string | undefined | null, isAdmin: boolean): string => {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (isAdmin) return trimmed;
  // In view-only mode: show first 3 and last 3 digits, masked with '*' (e.g., 013*970)
  if (trimmed.length <= 6) return trimmed;
  const firstThree = trimmed.slice(0, 3);
  const lastThree = trimmed.slice(-3);
  return `${firstThree}*${lastThree}`;
};
