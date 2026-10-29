import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
} from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import {
  FullAppData,
  Member,
  Contribution,
  Loan,
  LoanPayment,
  MemberWithdrawal,
  Receipt,
  UserAccount,
  SocietyRule,
  GeneralMeeting,
  ActivityLogItem,
  IncomeRecord,
  ExpenseRecord,
  ProfitDistribution,
} from '../types';

/**
 * Helper to normalize phone numbers for Firebase Auth email mapping
 */
export function normalizePhoneForAuth(rawPhone?: string): string {
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

/**
 * Generate unique synthetic Firebase Auth email for phone-based member accounts
 */
export function phoneToMemberAuthEmail(phone: string): string {
  const clean = normalizePhoneForAuth(phone);
  return `${clean}@member.pakura.org`;
}

/**
 * Format phone number to E.164 international standard (+880...) for Firebase Phone Auth
 */
export function formatPhoneToE164(phone: string): string {
  const digits = normalizePhoneForAuth(phone);
  if (digits.startsWith('880')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+88${digits}`;
  }
  return `+880${digits}`;
}

/**
 * Firebase Firestore Cloud Synchronization Service
 * Provides secure, verified bidirectional syncing with Firestore and Firebase Auth
 * for Pakura Sanatan Jubo Sangha
 */
export class FirebaseSyncService {
  /**
   * Save or update an authenticated user profile in Firestore (/users/{userId})
   */
  static async syncUserProfile(user: UserAccount): Promise<void> {
    const path = `users/${user.userId}`;
    try {
      const userRef = doc(db, 'users', user.userId);
      await setDoc(
        userRef,
        {
          userId: user.userId,
          firebaseUid: user.firebaseUid || user.userId,
          displayName: user.displayName || user.name || 'সদস্য',
          name: user.name || user.displayName || 'সদস্য',
          username: user.username || user.phone || user.email || '',
          role: user.role,
          status: user.status || 'active',
          email: user.email || '',
          phone: user.phone || '',
          memberSystemId: user.memberSystemId || '',
          isMainAdmin: Boolean(user.isMainAdmin),
          password: user.password || '', // Stored for member self-service reference
          lastSyncedAt: new Date().toISOString(),
          createdAt: user.createdAt || new Date().toISOString().split('T')[0],
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Delete user profile from Firestore
   */
  static async deleteUserProfile(userId: string): Promise<void> {
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.warn('Failed to delete user profile from Firestore:', error);
    }
  }

  /**
   * Fetch all user accounts from Firestore
   */
  static async loadUsersFromFirestore(): Promise<UserAccount[]> {
    const users: UserAccount[] = [];
    try {
      const snap = await getDocs(collection(db, 'users'));
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.userId) {
          users.push({
            userId: d.userId,
            firebaseUid: d.firebaseUid || d.userId,
            username: d.username || d.phone || d.email || '',
            phone: d.phone || '',
            email: d.email || '',
            name: d.name || d.displayName,
            displayName: d.displayName || d.name || 'সদস্য',
            role: d.role || 'member',
            memberSystemId: d.memberSystemId || '',
            status: d.status || 'active',
            password: d.password,
            createdAt: d.createdAt || new Date().toISOString().split('T')[0],
            isMainAdmin: Boolean(d.isMainAdmin),
          });
        }
      });
    } catch (error) {
      console.warn('Could not load users from Firestore:', error);
    }
    return users;
  }

  /**
   * Register a new member account in Firebase Auth and Firestore
   */
  static async registerMemberInFirebase(
    phone: string,
    pass: string,
    member: Member
  ): Promise<{ success: boolean; message: string; user?: UserAccount }> {
    const cleanPhone = normalizePhoneForAuth(phone);
    const authEmail = phoneToMemberAuthEmail(cleanPhone);

    try {
      let firebaseUid = '';
      try {
        const cred = await createUserWithEmailAndPassword(auth, authEmail, pass);
        firebaseUid = cred.user.uid;
        try {
          await updateProfile(cred.user, { displayName: member.name });
        } catch {
          // Ignore profile update error
        }
      } catch (authError: any) {
        if (authError?.code === 'auth/email-already-in-use') {
          // Try signing in with the provided password
          try {
            const loginCred = await signInWithEmailAndPassword(auth, authEmail, pass);
            firebaseUid = loginCred.user.uid;
          } catch {
            return {
              success: false,
              message: 'এই মোবাইল নম্বরে ইতিমধ্যে ফায়ারবেস অ্যাকাউন্ট রয়েছে। দয়া করে লগইন করুন।',
            };
          }
        } else {
          console.warn('Firebase Auth user creation notice:', authError);
          // Fallback UID if Firebase Auth email-password is not enabled in console
          firebaseUid = `FB-M-${cleanPhone}`;
        }
      }

      const userId = firebaseUid || `USR-M-${cleanPhone}`;
      const newUser: UserAccount = {
        userId,
        firebaseUid,
        username: cleanPhone,
        phone: cleanPhone,
        name: member.name,
        displayName: `${member.name} (সদস্য)`,
        role: 'member',
        memberSystemId: member.systemId,
        password: pass,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
      };

      // 1. Sync User Profile to Firestore
      await this.syncUserProfile(newUser);

      // 2. Link member record with this userId and sync to Firestore
      member.userId = userId;
      member.phone = cleanPhone;
      member.updatedAt = new Date().toISOString().split('T')[0];
      await this.syncMember(member);

      return {
        success: true,
        message: `অভিনন্দন ${member.name}! ফায়ারবেস ক্লাউডে আপনার সদস্য অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।`,
        user: newUser,
      };
    } catch (error: any) {
      console.error('Firebase member registration error:', error);
      return {
        success: false,
        message: error?.message || 'ফায়ারবেসে অ্যাকাউন্ট তৈরি করা সম্ভব হয়নি।',
      };
    }
  }

  /**
   * Log in a member using phone number and password via Firebase Auth and Firestore
   */
  static async loginMemberInFirebase(
    phone: string,
    pass: string
  ): Promise<{ success: boolean; message: string; user?: UserAccount }> {
    const cleanPhone = normalizePhoneForAuth(phone);
    const authEmail = phoneToMemberAuthEmail(cleanPhone);

    try {
      let loggedUid: string | null = null;
      try {
        const cred = await signInWithEmailAndPassword(auth, authEmail, pass);
        loggedUid = cred.user.uid;
      } catch (authErr: any) {
        console.warn('Firebase Auth direct email-password sign-in:', authErr?.code);
      }

      // Check Firestore user doc
      let matchedDoc: UserAccount | null = null;
      if (loggedUid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', loggedUid));
          if (userDoc.exists()) {
            matchedDoc = userDoc.data() as UserAccount;
          }
        } catch {
          // Continue
        }
      }

      if (!matchedDoc) {
        // Query Firestore users collection by phone or username
        try {
          const q = query(collection(db, 'users'), where('phone', '==', cleanPhone));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const data = qSnap.docs[0].data() as UserAccount;
            if (data.password === pass || !data.password) {
              matchedDoc = data;
            }
          }
        } catch {
          // Ignore
        }
      }

      if (matchedDoc) {
        return {
          success: true,
          message: `স্বাগতম ${matchedDoc.name || matchedDoc.displayName}! ফায়ারবেস থেকে সফলভাবে লগইন হয়েছে।`,
          user: matchedDoc,
        };
      }

      return {
        success: false,
        message: 'ভুল মোবাইল নম্বর বা পাসওয়ার্ড। অনুগ্রহ করে সঠিক তথ্য প্রদান করুন।',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'ফায়ারবেস লগইন ব্যর্থ হয়েছে।',
      };
    }
  }

  /**
   * Delete an old member account from Firestore (users and members collections)
   */
  static async deleteOldMemberAccount(oldPhone: string, systemId?: string): Promise<void> {
    const cleanOldPhone = normalizePhoneForAuth(oldPhone);
    try {
      // 1. Delete matching user docs from /users
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const d of usersSnap.docs) {
        const data = d.data();
        const dPhone = normalizePhoneForAuth(data.phone || data.username || '');
        if (
          dPhone === cleanOldPhone ||
          (cleanOldPhone && dPhone.endsWith(cleanOldPhone.slice(-10))) ||
          (systemId && data.memberSystemId === systemId)
        ) {
          await deleteDoc(doc(db, 'users', d.id));
        }
      }

      // 2. If systemId provided, clean up member record
      if (systemId) {
        await deleteDoc(doc(db, 'members', systemId));
      }
    } catch (e) {
      console.warn('Error deleting old member account from Firebase:', e);
    }
  }

  /**
   * Request Firebase Phone Authentication SMS OTP code
   */
  static async sendPhoneOtp(
    phone: string,
    appVerifier: RecaptchaVerifier
  ): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; message: string }> {
    try {
      const e164 = formatPhoneToE164(phone);
      const confirmationResult = await signInWithPhoneNumber(auth, e164, appVerifier);
      return {
        success: true,
        confirmationResult,
        message: 'আপনার মোবাইলে ৬ ডিজিটের SMS ওটিপি কোড পাঠানো হয়েছে।',
      };
    } catch (error: any) {
      console.warn('Firebase Phone Auth sendPhoneOtp warning:', error?.code || error?.message);
      let errorMsg = 'মোবাইলে কোড পাঠাতে সমস্যা হয়েছে।';
      if (
        error?.code === 'auth/operation-not-allowed' ||
        error?.message?.includes('region enabled') ||
        error?.message?.includes('operation-not-allowed')
      ) {
        errorMsg =
          'ফায়ারবেস কনসোলে এই অঞ্চলের জন্য SMS সার্ভিস সক্রিয় করা নেই। ওটিপি SMS ছাড়াই নিচে পাসওয়ার্ড দিয়ে সরাসরি সম্পন্ন করতে পারেন।';
      } else if (error?.code === 'auth/invalid-phone-number') {
        errorMsg = 'মোবাইল নম্বরটি সঠিক ফরম্যাটে নেই (দয়া করে ১১ ডিজিটের সঠিক নম্বর দিন)।';
      } else if (error?.code === 'auth/too-many-requests') {
        errorMsg = 'অতিরিক্ত অনুরোধ করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
      } else if (error?.code === 'auth/quota-exceeded') {
        errorMsg = 'আজকের SMS কোটা পূর্ণ হয়েছে। আপনি পাসওয়ার্ড দিয়েও নিবন্ধন করতে পারেন।';
      } else if (error?.message) {
        errorMsg = error.message;
      }
      return {
        success: false,
        message: errorMsg,
      };
    }
  }

  /**
   * Complete fresh member registration with Firebase Phone User
   */
  static async registerMemberWithFirebasePhoneUser(
    firebaseUid: string,
    phone: string,
    member: Member,
    password?: string
  ): Promise<{ success: boolean; user: UserAccount; message: string }> {
    const cleanPhone = normalizePhoneForAuth(phone);
    const userId = firebaseUid || `USR-M-${cleanPhone}`;
    const today = new Date().toISOString().split('T')[0];

    const newUser: UserAccount = {
      userId,
      firebaseUid,
      username: cleanPhone,
      phone: cleanPhone,
      name: member.name,
      displayName: `${member.name} (সদস্য)`,
      role: 'member',
      memberSystemId: member.systemId,
      status: 'active',
      password: password || '',
      createdAt: today,
    };

    // 1. Sync User Profile to Firestore
    await this.syncUserProfile(newUser);

    // 2. Link member record with this userId and sync to Firestore
    member.userId = userId;
    member.phone = cleanPhone;
    member.updatedAt = today;
    await this.syncMember(member);

    return {
      success: true,
      user: newUser,
      message: `অভিনন্দন ${member.name}! ফায়ারবেস মোবাইল ভেরিফিকেশনের মাধ্যমে আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।`,
    };
  }

  /**
   * Delete all user login accounts from Firestore and reset member for fresh registration
   */
  static async deleteAllAccountsAndResetFresh(cleanPhone: string = '01319113970'): Promise<void> {
    try {
      // 1. Delete user accounts from Firestore /users
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const d of usersSnap.docs) {
        const data = d.data();
        if (data.email?.toLowerCase() !== 'freelancerkajolchandradas@gmail.com') {
          await deleteDoc(doc(db, 'users', d.id));
        }
      }

      // 2. Unlink all member records in Firestore so members are fresh and ready for new registration
      const membersSnap = await getDocs(collection(db, 'members'));
      for (const mDoc of membersSnap.docs) {
        const mData = mDoc.data();
        if (mData.userId || mDoc.id === 'SYS-000001') {
          await setDoc(
            doc(db, 'members', mDoc.id),
            {
              userId: '',
              updatedAt: new Date().toISOString().split('T')[0],
            },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.warn('Error during reset fresh in Firestore:', err);
    }
  }

  /**
   * Sync a member record to Firestore
   */
  static async syncMember(member: Member): Promise<void> {
    const path = `members/${member.systemId}`;
    try {
      const memberRef = doc(db, 'members', member.systemId);
      await setDoc(
        memberRef,
        {
          systemId: member.systemId,
          name: member.name,
          phone: member.phone,
          status: member.status,
          currentBalance: Number(member.currentBalance || 0),
          profitShareBalance: Number(member.profitShareBalance || 0),
          totalWithdrawn: Number(member.totalWithdrawn || 0),
          userId: member.userId || '',
          createdAt: member.createdAt || new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Delete member and all associated collections from Firestore
   */
  static async deleteMember(systemId: string, phone?: string): Promise<void> {
    await this.deleteMemberAndAllAssociatedData(systemId, phone);
  }

  static async deleteMemberAndAllAssociatedData(systemId: string, phone?: string): Promise<void> {
    try {
      // 1. Delete member doc by systemId
      await deleteDoc(doc(db, 'members', systemId)).catch(() => {});

      // 2. Delete contributions of this member
      const contribSnap = await getDocs(query(collection(db, 'contributions'), where('memberSystemId', '==', systemId)));
      for (const d of contribSnap.docs) {
        await deleteDoc(doc(db, 'contributions', d.id)).catch(() => {});
      }

      // 3. Delete receipts of this member
      const rctSnap = await getDocs(query(collection(db, 'receipts'), where('memberSystemId', '==', systemId)));
      for (const d of rctSnap.docs) {
        await deleteDoc(doc(db, 'receipts', d.id)).catch(() => {});
      }

      // 4. Delete withdrawals of this member
      const wthSnap = await getDocs(query(collection(db, 'member_withdrawals'), where('memberSystemId', '==', systemId)));
      for (const d of wthSnap.docs) {
        await deleteDoc(doc(db, 'member_withdrawals', d.id)).catch(() => {});
      }

      // 5. Delete user profiles mapped to this member (except main super admin)
      const usersSnap = await getDocs(query(collection(db, 'users'), where('memberSystemId', '==', systemId)));
      for (const d of usersSnap.docs) {
        const uData = d.data();
        if (uData.email?.toLowerCase() !== 'freelancerkajolchandradas@gmail.com') {
          await deleteDoc(doc(db, 'users', d.id)).catch(() => {});
        }
      }

      // 6. If phone is provided, also wipe any user account associated with this phone
      if (phone) {
        const cleanPhone = normalizePhoneForAuth(phone);
        if (cleanPhone) {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          for (const ud of allUsersSnap.docs) {
            const uData = ud.data();
            if (uData.email?.toLowerCase() !== 'freelancerkajolchandradas@gmail.com') {
              const uPhone = normalizePhoneForAuth(uData.phone || uData.username || '');
              if (uPhone && (uPhone === cleanPhone || (cleanPhone.length >= 8 && uPhone.slice(-10) === cleanPhone.slice(-10)))) {
                await deleteDoc(doc(db, 'users', ud.id)).catch(() => {});
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to delete member and associated data from Firestore:', error);
    }
  }

  /**
   * Wipe all collections in Firestore on database reset so old data never reappears
   */
  static async wipeAllDataForCleanReset(): Promise<void> {
    try {
      const collectionsToWipe = [
        'members',
        'contributions',
        'loans',
        'loan_payments',
        'borrowers',
        'incomes',
        'expenses',
        'receipts',
        'transactions',
        'profit_distributions',
        'member_withdrawals',
        'rules',
        'meetings',
      ];

      for (const colName of collectionsToWipe) {
        try {
          const snap = await getDocs(collection(db, colName));
          for (const d of snap.docs) {
            await deleteDoc(doc(db, colName, d.id)).catch(() => {});
          }
        } catch {
          // Continue with next collection
        }
      }

      // Clear non-admin users
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const d of usersSnap.docs) {
          const data = d.data();
          if (data.email?.toLowerCase() !== 'freelancerkajolchandradas@gmail.com') {
            await deleteDoc(doc(db, 'users', d.id)).catch(() => {});
          }
        }
      } catch {}

      // Write meta reset timestamp doc so any delayed reads recognize the reset
      try {
        await setDoc(doc(db, '_system_meta', 'reset_state'), {
          lastResetAt: Date.now(),
          resetBy: 'freelancerkajolchandradas@gmail.com',
          status: 'clean_reset_active',
        }, { merge: true });
      } catch {}
    } catch (err) {
      console.warn('Error during wipeAllDataForCleanReset:', err);
    }
  }

  /**
   * Reset all financial records in Firestore and set all member balances to ৳0
   */
  static async resetFinancialDataInFirestore(members: Member[]): Promise<void> {
    await this.wipeAllDataForCleanReset();
  }

  /**
   * Sync a contribution installment to Firestore
   */
  static async syncContribution(contribution: Contribution): Promise<void> {
    const path = `contributions/${contribution.contributionId}`;
    try {
      const ref = doc(db, 'contributions', contribution.contributionId);
      await setDoc(
        ref,
        {
          contributionId: contribution.contributionId,
          memberSystemId: contribution.memberSystemId,
          memberName: contribution.memberName,
          amount: Number(contribution.amount || 0),
          contributionDate: contribution.contributionDate,
          month: contribution.month,
          paymentMethod: contribution.paymentMethod || 'cash',
          receiptId: contribution.receiptId || '',
          recordedBy: contribution.recordedBy || 'admin',
          status: contribution.status || 'paid',
          lateFee: Number(contribution.lateFee || 0),
          createdAt: contribution.createdAt || new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync a loan record to Firestore
   */
  static async syncLoan(loan: Loan): Promise<void> {
    const path = `loans/${loan.loanId}`;
    try {
      const ref = doc(db, 'loans', loan.loanId);
      await setDoc(
        ref,
        {
          loanId: loan.loanId,
          borrowerId: loan.borrowerId,
          borrowerName: loan.borrowerName,
          borrowerPhone: loan.borrowerPhone,
          principal: Number(loan.principal || 0),
          loanDate: loan.loanDate,
          rate: Number(loan.rate || 10),
          status: loan.status,
          remainingPrincipal: Number(loan.remainingPrincipal ?? loan.principal),
          totalDiscountGiven: Number(loan.totalDiscountGiven || 0),
          repaidDate: loan.repaidDate || '',
          isHistoricalRepaid: Boolean(loan.isHistoricalRepaid),
          createdAt: loan.createdAt || new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync a loan repayment installment to Firestore
   */
  static async syncLoanPayment(payment: LoanPayment): Promise<void> {
    const path = `loan_payments/${payment.paymentId}`;
    try {
      const ref = doc(db, 'loan_payments', payment.paymentId);
      await setDoc(
        ref,
        {
          paymentId: payment.paymentId,
          loanId: payment.loanId,
          borrowerName: payment.borrowerName,
          paymentDate: payment.paymentDate,
          amount: Number(payment.amount || 0),
          profitPaid: Number(payment.profitPaid || 0),
          principalPaid: Number(payment.principalPaid || 0),
          discount: Number(payment.discount || 0),
          receiptId: payment.receiptId || '',
          createdAt: payment.createdAt || new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync income record to Firestore
   */
  static async syncIncome(income: IncomeRecord): Promise<void> {
    const path = `incomes/${income.incomeId}`;
    try {
      const ref = doc(db, 'incomes', income.incomeId);
      await setDoc(
        ref,
        {
          incomeId: income.incomeId,
          date: income.date,
          category: income.category,
          amount: Number(income.amount || 0),
          description: income.description || '',
          paymentMethod: income.paymentMethod || 'cash',
          receiptId: income.receiptId || '',
          createdAt: income.createdAt || new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync expense record to Firestore
   */
  static async syncExpense(expense: ExpenseRecord): Promise<void> {
    const path = `expenses/${expense.expenseId}`;
    try {
      const ref = doc(db, 'expenses', expense.expenseId);
      await setDoc(
        ref,
        {
          expenseId: expense.expenseId,
          date: expense.date,
          category: expense.category,
          amount: Number(expense.amount || 0),
          description: expense.description || '',
          paymentMethod: expense.paymentMethod || 'cash',
          receiptId: expense.receiptId || '',
          createdAt: expense.createdAt || new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync official receipt voucher to Firestore
   */
  static async syncReceipt(receipt: Receipt): Promise<void> {
    const path = `receipts/${receipt.receiptId}`;
    try {
      const ref = doc(db, 'receipts', receipt.receiptId);
      await setDoc(
        ref,
        {
          receiptId: receipt.receiptId,
          transactionId: receipt.transactionId || receipt.receiptId,
          name: receipt.name,
          phone: receipt.phone || '',
          amount: Number(receipt.amount || 0),
          purpose: receipt.purpose,
          date: receipt.date,
          receivedBy: receipt.receivedBy || 'সমিতি কোষাধ্যক্ষ',
          memberSystemId: receipt.memberSystemId || '',
          type: receipt.type || 'contribution',
          createdAt: receipt.createdAt || new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync society rule to Firestore
   */
  static async syncRule(rule: SocietyRule): Promise<void> {
    const path = `rules/${rule.ruleId}`;
    try {
      const ref = doc(db, 'rules', rule.ruleId);
      await setDoc(ref, rule, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync general meeting to Firestore
   */
  static async syncMeeting(meeting: GeneralMeeting): Promise<void> {
    const path = `meetings/${meeting.meetingId}`;
    try {
      const ref = doc(db, 'meetings', meeting.meetingId);
      await setDoc(ref, meeting, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync loan profit distribution to Firestore
   */
  static async syncProfitDistribution(dist: ProfitDistribution): Promise<void> {
    const path = `profit_distributions/${dist.distributionId}`;
    try {
      const ref = doc(db, 'profit_distributions', dist.distributionId);
      await setDoc(ref, dist, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync member withdrawal to Firestore
   */
  static async syncMemberWithdrawal(withdrawal: MemberWithdrawal): Promise<void> {
    const path = `member_withdrawals/${withdrawal.withdrawalId}`;
    try {
      const ref = doc(db, 'member_withdrawals', withdrawal.withdrawalId);
      await setDoc(ref, withdrawal, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Record security/audit activity log in Firestore
   */
  static async syncActivityLog(log: ActivityLogItem): Promise<void> {
    const path = `activity_logs/${log.logId}`;
    try {
      const ref = doc(db, 'activity_logs', log.logId);
      await setDoc(
        ref,
        {
          logId: log.logId,
          dateTime: log.dateTime,
          userId: log.userId,
          userDisplayName: log.userDisplayName,
          role: log.role,
          action: log.action,
          module: log.module,
          description: log.description,
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Export all local app records up to Firestore
   */
  static async syncAllToFirestore(appData: FullAppData): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Users
      for (const u of appData.users || []) {
        await this.syncUserProfile(u);
      }
      // 2. Members
      for (const m of appData.members || []) {
        await this.syncMember(m);
      }
      // 3. Contributions
      for (const c of appData.contributions || []) {
        await this.syncContribution(c);
      }
      // 4. Loans & Payments
      for (const l of appData.loans || []) {
        await this.syncLoan(l);
      }
      for (const p of appData.loanPayments || []) {
        await this.syncLoanPayment(p);
      }
      // 5. Incomes & Expenses
      for (const inc of appData.incomes || []) {
        await this.syncIncome(inc);
      }
      for (const exp of appData.expenses || []) {
        await this.syncExpense(exp);
      }
      // 6. Receipts
      for (const r of appData.receipts || []) {
        await this.syncReceipt(r);
      }
      // 7. Rules & Meetings
      for (const rule of appData.rules || []) {
        await this.syncRule(rule);
      }
      for (const meet of appData.meetings || []) {
        await this.syncMeeting(meet);
      }
      // 8. Profit Distributions
      for (const dist of appData.profitDistributions || []) {
        await this.syncProfitDistribution(dist);
      }

      return {
        success: true,
        message: 'ফায়ারবেস ক্লাউড ডাটাবেসে সফলভাবে সকল তথ্য ও অ্যাকাউন্ট সংরক্ষণ করা হয়েছে (All records hosted in Firebase).',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'ফায়ারবেস সিঙ্ক ব্যর্থ হয়েছে।',
      };
    }
  }

  /**
   * Check connection status to Firestore
   */
  static async checkConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const pingDoc = doc(db, '_connection_test', 'ping');
      await getDoc(pingDoc);
      return {
        connected: true,
        message: 'Firebase Firestore connected successfully',
      };
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        return {
          connected: true,
          message: 'Firebase Firestore reachable (security rules active)',
        };
      }
      return {
        connected: false,
        message: error?.message || 'Connection test failed',
      };
    }
  }

  /**
   * Fetch all app records from Firestore
   */
  static async loadAllFromFirestore(): Promise<Partial<FullAppData>> {
    const result: Partial<FullAppData> = {};

    try {
      // Check if a database reset occurred
      let lastResetAt = 0;
      try {
        const metaDoc = await getDoc(doc(db, '_system_meta', 'reset_state'));
        if (metaDoc.exists()) {
          lastResetAt = Number(metaDoc.data()?.lastResetAt) || 0;
        }
      } catch {}

      const isItemAfterReset = (item: any): boolean => {
        if (!lastResetAt) return true;
        const dateVal = item.createdAt || item.updatedAt || item.date || item.contributionDate || item.issueDate;
        if (!dateVal) return false;
        const t = new Date(dateVal).getTime();
        return !isNaN(t) && t > lastResetAt;
      };

      const [
        usersSnap,
        membersSnap,
        contributionsSnap,
        loansSnap,
        loanPaymentsSnap,
        incomesSnap,
        expensesSnap,
        receiptsSnap,
        rulesSnap,
        meetingsSnap,
        distSnap,
        withdrawalsSnap,
        transactionsSnap,
      ] = await Promise.allSettled([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'members')),
        getDocs(collection(db, 'contributions')),
        getDocs(collection(db, 'loans')),
        getDocs(collection(db, 'loan_payments')),
        getDocs(collection(db, 'incomes')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'receipts')),
        getDocs(collection(db, 'rules')),
        getDocs(collection(db, 'meetings')),
        getDocs(collection(db, 'profit_distributions')),
        getDocs(collection(db, 'member_withdrawals')),
        getDocs(collection(db, 'transactions')),
      ]);

      if (usersSnap.status === 'fulfilled') {
        const users: UserAccount[] = [];
        usersSnap.value.forEach((d) => {
          const u = d.data();
          if (u?.userId) {
            if (u.email?.toLowerCase() === 'freelancerkajolchandradas@gmail.com' || u.isMainAdmin) {
              users.push(u as UserAccount);
            } else if (isItemAfterReset(u)) {
              users.push(u as UserAccount);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'users', d.id)).catch(() => {});
            }
          }
        });
        if (users.length > 0) result.users = users;
      }

      if (membersSnap.status === 'fulfilled') {
        const members: Member[] = [];
        membersSnap.value.forEach((d) => {
          const m = d.data();
          if (m?.systemId) {
            if (isItemAfterReset(m)) {
              members.push(m as Member);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'members', d.id)).catch(() => {});
            }
          }
        });
        if (members.length > 0) result.members = members;
      }

      if (contributionsSnap.status === 'fulfilled') {
        const contributions: Contribution[] = [];
        contributionsSnap.value.forEach((d) => {
          const c = d.data();
          if (c?.contributionId) {
            if (isItemAfterReset(c)) {
              contributions.push(c as Contribution);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'contributions', d.id)).catch(() => {});
            }
          }
        });
        if (contributions.length > 0) result.contributions = contributions;
      }

      if (loansSnap.status === 'fulfilled') {
        const loans: Loan[] = [];
        loansSnap.value.forEach((d) => {
          const l = d.data();
          if (l?.loanId) {
            if (isItemAfterReset(l)) {
              loans.push(l as Loan);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'loans', d.id)).catch(() => {});
            }
          }
        });
        if (loans.length > 0) result.loans = loans;
      }

      if (loanPaymentsSnap.status === 'fulfilled') {
        const payments: LoanPayment[] = [];
        loanPaymentsSnap.value.forEach((d) => {
          const p = d.data();
          if (p?.paymentId) {
            if (isItemAfterReset(p)) {
              payments.push(p as LoanPayment);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'loan_payments', d.id)).catch(() => {});
            }
          }
        });
        if (payments.length > 0) result.loanPayments = payments;
      }

      if (incomesSnap.status === 'fulfilled') {
        const incomes: IncomeRecord[] = [];
        incomesSnap.value.forEach((d) => {
          const inc = d.data();
          if (inc?.incomeId) {
            if (isItemAfterReset(inc)) {
              incomes.push(inc as IncomeRecord);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'incomes', d.id)).catch(() => {});
            }
          }
        });
        if (incomes.length > 0) {
          result.incomes = incomes;
          result.incomeRecords = incomes;
        }
      }

      if (expensesSnap.status === 'fulfilled') {
        const expenses: ExpenseRecord[] = [];
        expensesSnap.value.forEach((d) => {
          const exp = d.data();
          if (exp?.expenseId) {
            if (isItemAfterReset(exp)) {
              expenses.push(exp as ExpenseRecord);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'expenses', d.id)).catch(() => {});
            }
          }
        });
        if (expenses.length > 0) {
          result.expenses = expenses;
          result.expenseRecords = expenses;
        }
      }

      if (receiptsSnap.status === 'fulfilled') {
        const receipts: Receipt[] = [];
        receiptsSnap.value.forEach((d) => {
          const r = d.data();
          if (r?.receiptId) {
            if (isItemAfterReset(r)) {
              receipts.push(r as Receipt);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'receipts', d.id)).catch(() => {});
            }
          }
        });
        if (receipts.length > 0) result.receipts = receipts;
      }

      if (rulesSnap.status === 'fulfilled') {
        const rules: SocietyRule[] = [];
        rulesSnap.value.forEach((d) => {
          const r = d.data();
          if (r?.ruleId) {
            if (isItemAfterReset(r)) {
              rules.push(r as SocietyRule);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'rules', d.id)).catch(() => {});
            }
          }
        });
        if (rules.length > 0) result.rules = rules;
      }

      if (meetingsSnap.status === 'fulfilled') {
        const meetings: GeneralMeeting[] = [];
        meetingsSnap.value.forEach((d) => {
          const m = d.data();
          if (m?.meetingId) {
            if (isItemAfterReset(m)) {
              meetings.push(m as GeneralMeeting);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'meetings', d.id)).catch(() => {});
            }
          }
        });
        if (meetings.length > 0) result.meetings = meetings;
      }

      if (distSnap.status === 'fulfilled') {
        const dists: ProfitDistribution[] = [];
        distSnap.value.forEach((d) => {
          const di = d.data();
          if (di?.distributionId) {
            if (isItemAfterReset(di)) {
              dists.push(di as ProfitDistribution);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'profit_distributions', d.id)).catch(() => {});
            }
          }
        });
        if (dists.length > 0) result.profitDistributions = dists;
      }

      if (withdrawalsSnap.status === 'fulfilled') {
        const withdrawals: MemberWithdrawal[] = [];
        withdrawalsSnap.value.forEach((d) => {
          const w = d.data();
          if (w?.withdrawalId) {
            if (isItemAfterReset(w)) {
              withdrawals.push(w as MemberWithdrawal);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'member_withdrawals', d.id)).catch(() => {});
            }
          }
        });
        if (withdrawals.length > 0) result.memberWithdrawals = withdrawals;
      }

      if (transactionsSnap.status === 'fulfilled') {
        const transactions: any[] = [];
        transactionsSnap.value.forEach((d) => {
          const t = d.data();
          if (t?.transactionId) {
            if (isItemAfterReset(t)) {
              transactions.push(t);
            } else if (lastResetAt) {
              deleteDoc(doc(db, 'transactions', d.id)).catch(() => {});
            }
          }
        });
        if (transactions.length > 0) result.transactions = transactions;
      }
    } catch (e) {
      console.warn('Error loading records from Firestore:', e);
    }

    return result;
  }
}
