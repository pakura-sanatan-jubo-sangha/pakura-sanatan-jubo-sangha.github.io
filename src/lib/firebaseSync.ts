import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
} from 'firebase/auth';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
  provisionSecondaryAuthUser,
  firebaseUpdateUserPassword,
} from './firebase';

const MAIN_ADMIN_EMAIL_CONST = 'freelancerkajolchandradas@gmail.com';

function isStrictMainAdminAccount(user?: UserAccount | null): boolean {
  if (!user || user.role !== 'admin' || user.isMainAdmin === false) return false;
  const email = (user.email || '').toLowerCase().trim();
  return (
    email === MAIN_ADMIN_EMAIL_CONST.toLowerCase() ||
    (user.userId === 'USR-MAIN-ADMIN' && user.isMainAdmin === true)
  );
}
import {
  FullAppData,
  AppSettings,
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
  Transaction,
} from '../types';

export interface RegisteredAdminAccount {
  userId: string;
  email: string;
  name: string;
  displayName: string;
  role: string;
  isMainAdmin: boolean;
}

export function verifyTypedEmailMatchesAdminGmail(
  typedInput: string,
  actualAdminEmail: string
): boolean {
  const cleanTyped = (typedInput || '').toLowerCase().trim();
  const cleanActual = (actualAdminEmail || '').toLowerCase().trim();
  if (!cleanTyped || !cleanActual) return false;
  return cleanActual.includes(cleanTyped);
}

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

export function phonesMatchForVerification(a?: string, b?: string): boolean {
  const nA = normalizePhoneForAuth(a);
  const nB = normalizePhoneForAuth(b);
  if (!nA || !nB) return false;
  if (nA === nB) return true;
  if (nA.length >= 10 && nB.length >= 10 && nA.slice(-10) === nB.slice(-10)) {
    return true;
  }
  return false;
}

function extractNormalizedDigits(text?: string): string {
  if (!text) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let s = String(text);
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(bengaliDigits[i], String(i));
  }
  return s.replace(/\D/g, '');
}

function isGmailLinkedMemberAccount(u: any): boolean {
  if (!u) return false;
  const email = String(u?.email || '').toLowerCase().trim();
  if (!email || email.endsWith('@member.pakura.org')) return false;
  const role = String(u?.role || 'member').toLowerCase().trim();
  const userId = String(u?.userId || '').trim();
  if (userId === 'USR-MAIN-ADMIN') return false;
  if (['admin', 'president', 'treasurer', 'secretary'].includes(role)) return false;
  return role === 'member';
}

function isPlaceholderMemberSkeletonUser(
  u: any,
  docId: string,
  linkedMemberUserIds: Set<string>
): boolean {
  const pwd = typeof u?.password === 'string' ? u.password.trim() : '';
  const email = typeof u?.email === 'string' ? u.email.trim() : '';
  const uid = typeof u?.firebaseUid === 'string' ? u.firebaseUid.trim() : '';
  const userId = typeof u?.userId === 'string' ? u.userId.trim() : docId;
  const isFlaggedRegistered = Boolean(u?.isRegistered || u?.registeredAt);

  if (pwd.length > 0 || email.length > 0 || isFlaggedRegistered) {
    return false;
  }
  if (linkedMemberUserIds.has(userId) || linkedMemberUserIds.has(docId)) {
    return false;
  }
  // Empty pre-seeded skeleton docs always use USR-M-SYS-* without password or real Firebase UID
  const isSkeletonId =
    userId.startsWith('USR-M-SYS-') && (!uid || uid.startsWith('USR-M-SYS-'));
  return isSkeletonId;
}

export interface FirebaseRegistrationVerificationResult {
  checked: boolean;
  connectionError?: string;
  memberFound: boolean;
  matchedMembers: Member[];
  primaryMember?: Member;
  alreadyRegistered: boolean;
  reasons: string[];
  existingAccountDetails?: {
    source: 'users' | 'members' | 'activity_logs' | 'registration_history' | 'firebase_auth';
    userId?: string;
    firebaseUid?: string;
    memberSystemId?: string;
    memberName?: string;
    registeredAt?: string;
  };
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
    if (isGmailLinkedMemberAccount(user)) {
      return;
    }
    const path = `users/${user.userId}`;
    try {
      const userRef = doc(db, 'users', user.userId);
      const isMain = isStrictMainAdminAccount(user);
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
          isMainAdmin: isMain,
          password: user.password || '',
          lastSyncedAt: new Date().toISOString(),
          createdAt: user.createdAt || new Date().toISOString().split('T')[0],
        },
        { merge: true }
      );

      // Also persist permanent registration_history for every real user or admin (skip empty USR-M-SYS-* skeletons)
      const isSkeletonPlaceholder = isPlaceholderMemberSkeletonUser(user, user.userId, new Set());
      if (!isSkeletonPlaceholder) {
        await this.syncUserRegistrationHistoryInFirebase(
          { ...user, isMainAdmin: isMain },
          { source: isMain ? 'main_admin_sync' : user.role === 'member' ? 'user_profile_sync' : 'admin_profile_sync' }
        ).catch(() => {});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Delete user profile (and admin registry entry) from Firestore.
   * Refuses to delete the Main Super Admin.
   */
  static async deleteUserProfile(userId: string): Promise<void> {
    if (!userId || userId === 'USR-MAIN-ADMIN') return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.warn('Failed to delete user profile from Firestore:', error);
    }
    try {
      await deleteDoc(doc(db, 'admins', userId));
    } catch (error) {
      console.warn('Failed to delete admin record from Firestore:', error);
    }
  }

  /**
   * Add a new admin/committee user to Firebase (/users, /admins, Auth if possible, and permanent /activity_logs).
   * Strictly restricted to the Main Admin only.
   */
  static async addAdminInFirebase(params: {
    user: UserAccount;
    password: string;
    createdBy?: UserAccount | null;
  }): Promise<{ success: boolean; message: string; firebaseUid?: string }> {
    const { user, password, createdBy } = params;
    if (!isStrictMainAdminAccount(createdBy)) {
      return {
        success: false,
        message: 'শুধুমাত্র প্রধান অ্যাডমিন নতুন অ্যাডমিন যোগ করতে পারবেন। (Only the Main Admin can add admins.)',
      };
    }

    const cleanEmail = (user.email || '').trim().toLowerCase();
    const cleanPass = (password || user.password || '').trim();
    const nowIso = new Date().toISOString();

    let resolvedFirebaseUid = user.firebaseUid || '';
    if (cleanEmail && cleanPass.length >= 6) {
      const authRes = await provisionSecondaryAuthUser(
        cleanEmail,
        cleanPass,
        user.name || user.displayName
      );
      if (authRes.uid) {
        resolvedFirebaseUid = authRes.uid;
      }
    }

    const effectiveUid = resolvedFirebaseUid || user.userId;

    try {
      // 1. Save full user profile in /users/{userId}
      await setDoc(
        doc(db, 'users', user.userId),
        {
          userId: user.userId,
          firebaseUid: effectiveUid,
          displayName: user.displayName || user.name || cleanEmail,
          name: user.name || user.displayName || cleanEmail,
          username: user.username || cleanEmail.split('@')[0],
          role: user.role,
          status: user.status || 'active',
          email: cleanEmail,
          phone: user.phone || '',
          memberSystemId: user.memberSystemId || '',
          isMainAdmin: false,
          password: cleanPass,
          addedBy: createdBy?.email || MAIN_ADMIN_EMAIL_CONST,
          addedByUserId: createdBy?.userId || 'USR-MAIN-ADMIN',
          createdAt: user.createdAt || nowIso.split('T')[0],
          updatedAt: nowIso,
          passwordUpdatedAt: nowIso,
          lastSyncedAt: nowIso,
        },
        { merge: true }
      );

      // 2. Keep permanent admin record in /admins/{userId} for elevated governance roles
      const isPrivilegedRole = ['admin', 'president', 'treasurer', 'secretary'].includes(user.role);
      if (isPrivilegedRole) {
        await setDoc(
          doc(db, 'admins', user.userId),
          {
            uid: effectiveUid,
            userId: user.userId,
            email: cleanEmail,
            name: user.name || user.displayName,
            displayName: user.displayName || user.name,
            role: user.role,
            status: user.status || 'active',
            isMainAdmin: false,
            password: cleanPass,
            addedBy: createdBy?.email || MAIN_ADMIN_EMAIL_CONST,
            addedByUserId: createdBy?.userId || 'USR-MAIN-ADMIN',
            createdAt: nowIso,
            updatedAt: nowIso,
            passwordUpdatedAt: nowIso,
          },
          { merge: true }
        );
      } else {
        await deleteDoc(doc(db, 'admins', user.userId)).catch(() => {});
      }

      // 3. Record permanent registration_history for the new admin/committee user
      await this.syncUserRegistrationHistoryInFirebase(
        {
          ...user,
          firebaseUid: effectiveUid,
          email: cleanEmail,
          isMainAdmin: false,
        },
        { source: 'admin_creation' }
      ).catch(() => {});

      // 4. Keep permanent audit record in /activity_logs
      await this.syncActivityLog({
        logId: `LOG-ADM-${Date.now()}`,
        dateTime: new Date().toLocaleString('bn-BD'),
        timestamp: nowIso,
        userId: createdBy?.userId || 'USR-MAIN-ADMIN',
        userDisplayName: createdBy?.displayName || 'Kajol Chandra Das ( Admin )',
        role: 'admin',
        action: user.role === 'admin' ? 'ADD_ADMIN' : 'CREATE_USER',
        module: 'User Management',
        referenceId: user.userId,
        description: `প্রধান অ্যাডমিন (${createdBy?.email || MAIN_ADMIN_EMAIL_CONST}) ফায়ারবেস রেকর্ডে ${
          user.role === 'admin' ? 'সহকারী অ্যাডমিন' : user.role
        } যুক্ত করেছেন: ${user.name || user.displayName} (${cleanEmail})`,
      });

      return {
        success: true,
        message: 'ফায়ারবেস ক্লাউডে অ্যাডমিন ও রেকর্ড সফলভাবে সংরক্ষিত হয়েছে।',
        firebaseUid: resolvedFirebaseUid || undefined,
      };
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${user.userId}`);
      return {
        success: false,
        message: error?.message || 'ফায়ারবেসে অ্যাডমিন সংরক্ষণ করতে সমস্যা হয়েছে।',
      };
    }
  }

  /**
   * Sync admin role/status edits to /users and /admins in Firebase.
   * Strictly restricted to the Main Admin only.
   */
  static async syncAdminRoleUpdateInFirebase(params: {
    user: UserAccount;
    updatedBy?: UserAccount | null;
  }): Promise<{ success: boolean; message: string }> {
    const { user, updatedBy } = params;
    if (!isStrictMainAdminAccount(updatedBy)) {
      return {
        success: false,
        message: 'শুধুমাত্র প্রধান অ্যাডমিন রোল বা স্ট্যাটাস পরিবর্তন করতে পারবেন।',
      };
    }

    const nowIso = new Date().toISOString();
    try {
      await this.syncUserProfile(user);

      const isPrivilegedRole = ['admin', 'president', 'treasurer', 'secretary'].includes(user.role);
      if (isPrivilegedRole) {
        await setDoc(
          doc(db, 'admins', user.userId),
          {
            uid: user.firebaseUid || user.userId,
            userId: user.userId,
            email: (user.email || '').toLowerCase().trim(),
            name: user.name || user.displayName,
            displayName: user.displayName || user.name,
            role: user.role,
            status: user.status || 'active',
            isMainAdmin: false,
            password: user.password || '',
            updatedBy: updatedBy?.email || MAIN_ADMIN_EMAIL_CONST,
            updatedAt: nowIso,
            createdAt: user.createdAt || nowIso,
          },
          { merge: true }
        );
      } else {
        await deleteDoc(doc(db, 'admins', user.userId)).catch(() => {});
      }

      return { success: true, message: 'ফায়ারবেসে রোল ও স্ট্যাটাস হালনাগাদ হয়েছে।' };
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${user.userId}`);
      return { success: false, message: error?.message || 'ফায়ারবেস আপডেট ব্যর্থ হয়েছে।' };
    }
  }

  /**
   * Update an admin's password in Firebase (Firestore /users, /admins, /settings if Main Admin, Firebase Auth, and /activity_logs).
   */
  static async updateAdminPasswordInFirebase(params: {
    user: UserAccount;
    newPassword: string;
    isMainAdmin: boolean;
    settings?: AppSettings;
  }): Promise<{ success: boolean; message: string }> {
    const { user, newPassword, isMainAdmin, settings } = params;
    const cleanPass = (newPassword || '').trim();
    const nowIso = new Date().toISOString();
    const cleanEmail = (user.email || (isMainAdmin ? MAIN_ADMIN_EMAIL_CONST : '')).toLowerCase().trim();
    const targetUserId = isMainAdmin ? 'USR-MAIN-ADMIN' : user.userId;

    try {
      // 1. Update /users/{userId}
      await setDoc(
        doc(db, 'users', targetUserId),
        {
          userId: targetUserId,
          firebaseUid: user.firebaseUid || targetUserId,
          displayName: user.displayName || user.name || (isMainAdmin ? 'Kajol Chandra Das ( Admin )' : cleanEmail),
          name: user.name || user.displayName || (isMainAdmin ? 'Kajol Chandra Das' : cleanEmail),
          username: user.username || (isMainAdmin ? 'kajol_admin' : cleanEmail.split('@')[0]),
          role: user.role || 'admin',
          status: user.status || 'active',
          email: cleanEmail,
          phone: user.phone || '',
          memberSystemId: user.memberSystemId || '',
          isMainAdmin: Boolean(isMainAdmin),
          password: cleanPass,
          passwordUpdatedAt: nowIso,
          updatedAt: nowIso,
          lastSyncedAt: nowIso,
          createdAt: user.createdAt || nowIso.split('T')[0],
        },
        { merge: true }
      );

      // 2. Update /admins/{userId} (and any matching /admins docs by email)
      const isPrivilegedRole =
        isMainAdmin || ['admin', 'president', 'treasurer', 'secretary'].includes(user.role);
      if (isPrivilegedRole) {
        await setDoc(
          doc(db, 'admins', targetUserId),
          {
            uid: user.firebaseUid || targetUserId,
            userId: targetUserId,
            email: cleanEmail,
            name: user.name || user.displayName || (isMainAdmin ? 'Kajol Chandra Das' : cleanEmail),
            displayName: user.displayName || user.name || cleanEmail,
            role: user.role || 'admin',
            status: user.status || 'active',
            isMainAdmin: Boolean(isMainAdmin),
            password: cleanPass,
            passwordUpdatedAt: nowIso,
            updatedAt: nowIso,
            createdAt: user.createdAt || nowIso,
          },
          { merge: true }
        );

        if (cleanEmail) {
          try {
            const adminsSnap = await getDocsFromServer(collection(db, 'admins')).catch(() =>
              getDocs(collection(db, 'admins'))
            );
            for (const aDoc of adminsSnap.docs) {
              const data = aDoc.data() as any;
              if (
                aDoc.id !== targetUserId &&
                (data?.email || '').toLowerCase().trim() === cleanEmail
              ) {
                await setDoc(
                  doc(db, 'admins', aDoc.id),
                  {
                    password: cleanPass,
                    passwordUpdatedAt: nowIso,
                    updatedAt: nowIso,
                  },
                  { merge: true }
                );
              }
            }
          } catch (err) {
            console.warn('Matching admins password sync notice:', err);
          }
        }
      }

      // 3. If Main Admin, update /settings/app_settings
      if (isMainAdmin && settings) {
        await this.syncSettings({ ...settings, adminPassword: cleanPass });
      }

      // 4. Update Firebase Auth password if currently authenticated as this email
      await firebaseUpdateUserPassword(cleanPass, cleanEmail || undefined);

      // 5. Ensure admin registration_history is stored/updated in Firebase
      await this.syncUserRegistrationHistoryInFirebase(
        {
          ...user,
          userId: targetUserId,
          email: cleanEmail,
          isMainAdmin: Boolean(isMainAdmin),
        },
        { source: isMainAdmin ? 'main_admin_sync' : 'admin_password_update' }
      ).catch(() => {});

      // 6. Record password change audit log in Firestore /activity_logs
      await this.syncActivityLog({
        logId: `LOG-PWD-${Date.now()}`,
        dateTime: new Date().toLocaleString('bn-BD'),
        timestamp: nowIso,
        userId: targetUserId,
        userDisplayName: user.displayName || user.name || cleanEmail,
        role: user.role || 'admin',
        action: isMainAdmin ? 'CHANGE_ADMIN_PASSWORD' : 'CHANGE_PASSWORD',
        module: 'Security',
        referenceId: targetUserId,
        description: `${
          isMainAdmin ? 'প্রধান অ্যাডমিনের' : 'অ্যাডমিন/ব্যবহারকারীর'
        } পাসওয়ার্ড ফায়ারবেসে সফলভাবে হালনাগাদ করা হয়েছে (${cleanEmail || targetUserId})`,
      });

      return {
        success: true,
        message: 'পাসওয়ার্ড ফায়ারবেস ক্লাউডে সফলভাবে হালনাগাদ হয়েছে।',
      };
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${targetUserId}`);
      return {
        success: false,
        message: error?.message || 'ফায়ারবেসে পাসওয়ার্ড হালনাগাদ করতে সমস্যা হয়েছে।',
      };
    }
  }

  /**
   * Fetch an admin or user account directly from Firestore by email (and Main Admin settings if applicable).
   * Enables cross-device login immediately after an admin is added or changes their password.
   */
  static async fetchUserOrAdminByEmailFromFirestore(
    email: string
  ): Promise<{ user: UserAccount | null; settings?: AppSettings }> {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) return { user: null };

    try {
      if (cleanEmail === MAIN_ADMIN_EMAIL_CONST.toLowerCase()) {
        let loadedSettings: AppSettings | undefined;
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'app_settings'));
          if (settingsSnap.exists()) {
            loadedSettings = settingsSnap.data() as AppSettings;
          }
        } catch {}

        let mainUser: UserAccount | null = null;
        try {
          const mainDoc = await getDoc(doc(db, 'users', 'USR-MAIN-ADMIN'));
          if (mainDoc.exists()) {
            mainUser = mainDoc.data() as UserAccount;
          }
        } catch {}

        return { user: mainUser, settings: loadedSettings };
      }

      const [usersSnap, adminsSnap] = await Promise.all([
        getDocsFromServer(collection(db, 'users')).catch(() => getDocs(collection(db, 'users'))),
        getDocsFromServer(collection(db, 'admins')).catch(() => getDocs(collection(db, 'admins'))),
      ]);

      let matched: UserAccount | null = null;

      usersSnap.forEach((d) => {
        const u = d.data() as any;
        if ((u?.email || '').toLowerCase().trim() === cleanEmail) {
          matched = {
            userId: u.userId || d.id,
            firebaseUid: u.firebaseUid || u.userId || d.id,
            username: u.username || cleanEmail.split('@')[0],
            phone: u.phone || '',
            email: cleanEmail,
            name: u.name || u.displayName || cleanEmail,
            displayName: u.displayName || u.name || cleanEmail,
            role: u.role || 'member',
            memberSystemId: u.memberSystemId || '',
            status: u.status || 'active',
            password: u.password || '',
            createdAt: u.createdAt || new Date().toISOString().split('T')[0],
            isMainAdmin: false,
          };
        }
      });

      adminsSnap.forEach((d) => {
        const a = d.data() as any;
        if ((a?.email || '').toLowerCase().trim() === cleanEmail) {
          const adminUserId = a.userId || d.id;
          // Prefer latest password if present in /admins
          if (!matched) {
            matched = {
              userId: adminUserId,
              firebaseUid: a.uid || adminUserId,
              username: cleanEmail.split('@')[0],
              email: cleanEmail,
              name: a.name || a.displayName || cleanEmail,
              displayName: a.displayName || a.name || cleanEmail,
              role: a.role || 'admin',
              status: a.status || 'active',
              password: a.password || '',
              createdAt: a.createdAt ? String(a.createdAt).split('T')[0] : new Date().toISOString().split('T')[0],
              isMainAdmin: false,
            };
          } else if (a.password) {
            matched.password = a.password;
            if (a.role) matched.role = a.role;
            if (a.status) matched.status = a.status;
          }
        }
      });

      return { user: matched };
    } catch (error) {
      console.warn('Firestore user/admin lookup notice:', error);
      return { user: null };
    }
  }

  /**
   * Strictly verify the entered Gmail address against the exact Main Admin email registered in Firebase.
   * Ensures only the registered Main Admin Gmail in Firestore (/admins/USR-MAIN-ADMIN or /users/USR-MAIN-ADMIN)
   * can authorize Database Reset (৳0) or Main Admin Password Reset.
   */
  static async verifyMainAdminResetEmailInFirebase(
    enteredEmail: string,
    executingUser?: UserAccount | null
  ): Promise<{ authorized: boolean; registeredEmail?: string; message: string }> {
    const cleanEntered = (enteredEmail || '').trim().toLowerCase();
    if (!cleanEntered) {
      return {
        authorized: false,
        message: 'অনুগ্রহ করে ফায়ারবেসে নিবন্ধিত অনুমোদিত জিমেইল ঠিকানাটি নিজ হাতে লিখুন।',
      };
    }

    if (!isStrictMainAdminAccount(executingUser)) {
      return {
        authorized: false,
        message: 'অননুমোদিত অ্যাক্সেস! শুধুমাত্র প্রধান অ্যাডমিন এই রিসেট সম্পন্ন করতে পারবেন।',
      };
    }

    try {
      const [adminDocSnap, userDocSnap] = await Promise.all([
        getDocFromServer(doc(db, 'admins', 'USR-MAIN-ADMIN')).catch(() =>
          getDoc(doc(db, 'admins', 'USR-MAIN-ADMIN'))
        ),
        getDocFromServer(doc(db, 'users', 'USR-MAIN-ADMIN')).catch(() =>
          getDoc(doc(db, 'users', 'USR-MAIN-ADMIN'))
        ),
      ]);

      const adminDocEmail = adminDocSnap.exists()
        ? String(adminDocSnap.data()?.email || '').trim().toLowerCase()
        : '';
      const userDocEmail = userDocSnap.exists()
        ? String(userDocSnap.data()?.email || '').trim().toLowerCase()
        : '';

      if (!adminDocSnap.exists() || !adminDocEmail) {
        const nowIso = new Date().toISOString();
        const seedEmail = userDocEmail || MAIN_ADMIN_EMAIL_CONST.toLowerCase();
        await setDoc(
          doc(db, 'admins', 'USR-MAIN-ADMIN'),
          {
            uid: 'USR-MAIN-ADMIN',
            userId: 'USR-MAIN-ADMIN',
            email: seedEmail,
            name: 'Kajol Chandra Das',
            displayName: 'Kajol Chandra Das (Main Admin)',
            role: 'admin',
            status: 'active',
            isMainAdmin: true,
            updatedAt: nowIso,
            createdAt: nowIso,
          },
          { merge: true }
        ).catch(() => {});
      }

      const registeredEmail = adminDocEmail || userDocEmail || MAIN_ADMIN_EMAIL_CONST.toLowerCase();

      if (cleanEntered !== registeredEmail) {
        await this.syncActivityLog({
          logId: `LOG-SEC-${Date.now()}`,
          dateTime: new Date().toLocaleString('bn-BD'),
          timestamp: new Date().toISOString(),
          userId: executingUser?.userId || 'UNKNOWN',
          userDisplayName: executingUser?.displayName || 'Unknown',
          role: executingUser?.role || 'member',
          action: 'FAILED_RESET_EMAIL_VERIFICATION',
          module: 'Security',
          description: `ফায়ারবেসে নিবন্ধিত অনুমোদিত জিমেইল না মেলায় রিসেট প্রচেষ্টা প্রতিহত করা হয়েছে (প্রদত্ত ইমেইল: ${cleanEntered})`,
        }).catch(() => {});

        return {
          authorized: false,
          message:
            'ভুল জিমেইল ঠিকানা! ফায়ারবেসে এই অ্যাকাউন্টের জন্য নিবন্ধিত সঠিক অনুমোদিত জিমেইল না দিলে রিসেট কার্যকর হবে না।',
        };
      }

      return {
        authorized: true,
        registeredEmail,
        message: 'ফায়ারবেসে নিবন্ধিত অনুমোদিত জিমেইল যাচাই সফল হয়েছে।',
      };
    } catch (error: any) {
      return {
        authorized: false,
        message: error?.message || 'ফায়ারবেসের সাথে জিমেইল যাচাই করতে সমস্যা হয়েছে।',
      };
    }
  }

  /**
   * Verify that a manually entered email matches the exact email registered in Firebase for the logged-in admin/user.
   */
  static async verifyAccountEmailInFirebase(
    user: UserAccount,
    enteredEmail: string
  ): Promise<{ authorized: boolean; registeredEmail?: string; message: string }> {
    const cleanEntered = (enteredEmail || '').trim().toLowerCase();
    if (!cleanEntered) {
      return {
        authorized: false,
        message: 'অনুগ্রহ করে আপনার অ্যাকাউন্টের নিবন্ধিত জিমেইল ঠিকানাটি লিখুন।',
      };
    }

    if (isStrictMainAdminAccount(user)) {
      return this.verifyMainAdminResetEmailInFirebase(cleanEntered, user);
    }

    try {
      const targetId = user.userId;
      const [adminDocSnap, userDocSnap] = await Promise.all([
        getDocFromServer(doc(db, 'admins', targetId)).catch(() => getDoc(doc(db, 'admins', targetId))),
        getDocFromServer(doc(db, 'users', targetId)).catch(() => getDoc(doc(db, 'users', targetId))),
      ]);

      const registeredEmail = (
        (adminDocSnap.exists() ? String(adminDocSnap.data()?.email || '') : '') ||
        (userDocSnap.exists() ? String(userDocSnap.data()?.email || '') : '') ||
        (user.email || '')
      )
        .trim()
        .toLowerCase();

      if (!registeredEmail || cleanEntered !== registeredEmail) {
        return {
          authorized: false,
          message:
            'ভুল জিমেইল ঠিকানা! ফায়ারবেসে আপনার অ্যাকাউন্টের জন্য নিবন্ধিত সঠিক জিমেইলটি লিখুন।',
        };
      }

      return {
        authorized: true,
        registeredEmail,
        message: 'ফায়ারবেসে নিবন্ধিত জিমেইল যাচাই সফল হয়েছে।',
      };
    } catch (error: any) {
      return {
        authorized: false,
        message: error?.message || 'ফায়ারবেসে জিমেইল যাচাই করতে সমস্যা হয়েছে।',
      };
    }
  }

  /**
   * Clear all documents from Firestore /activity_logs.
   * Strictly restricted to the Main Admin only.
   */
  static async clearAllActivityLogsInFirebase(
    executingUser?: UserAccount | null
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    if (!isStrictMainAdminAccount(executingUser)) {
      return {
        success: false,
        deletedCount: 0,
        message: 'শুধুমাত্র প্রধান অ্যাডমিনের অডিট লগ মুছে ফেলার অনুমতি রয়েছে।',
      };
    }

    try {
      const snap = await getDocsFromServer(collection(db, 'activity_logs')).catch(() =>
        getDocs(collection(db, 'activity_logs'))
      );
      let deletedCount = 0;
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'activity_logs', d.id));
        deletedCount++;
      }
      return {
        success: true,
        deletedCount,
        message: 'ফায়ারবেস ও ওয়েবসাইটের সকল অডিট অ্যাক্টিভিটি লগ মুছে ফেলা হয়েছে।',
      };
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'activity_logs');
      return {
        success: false,
        deletedCount: 0,
        message: error?.message || 'ফায়ারবেস থেকে অডিট লগ মুছতে সমস্যা হয়েছে।',
      };
    }
  }

  /**
   * Fetch all active registered Admin accounts from Firebase (/admins and privileged /users,
   * always including the Main Super Admin) merged with local active admins for partial matching.
   */
  static async fetchRegisteredAdminAccounts(
    localUsers: UserAccount[] = []
  ): Promise<RegisteredAdminAccount[]> {
    const PRIVILEGED_ROLES = new Set(['admin', 'president', 'treasurer', 'secretary']);
    const adminMap = new Map<string, RegisteredAdminAccount>();

    const mainEmailLower = MAIN_ADMIN_EMAIL_CONST.toLowerCase();
    adminMap.set(mainEmailLower, {
      userId: 'USR-MAIN-ADMIN',
      email: MAIN_ADMIN_EMAIL_CONST,
      name: 'Kajol Chandra Das',
      displayName: 'Kajol Chandra Das ( Admin )',
      role: 'admin',
      isMainAdmin: true,
    });

    // Seed with active privileged local users
    for (const u of localUsers) {
      const emailLower = String(u.email || '').toLowerCase().trim();
      const roleLower = String(u.role || '').toLowerCase().trim();
      if (
        !emailLower ||
        !emailLower.includes('@') ||
        emailLower.endsWith('@member.pakura.org') ||
        !PRIVILEGED_ROLES.has(roleLower) ||
        u.status === 'inactive'
      ) {
        continue;
      }
      if (emailLower === mainEmailLower) continue;
      adminMap.set(emailLower, {
        userId: u.userId,
        email: emailLower,
        name: u.name || u.displayName || emailLower,
        displayName: u.displayName || u.name || emailLower,
        role: roleLower,
        isMainAdmin: false,
      });
    }

    try {
      const [adminsSnap, usersSnap] = await Promise.all([
        getDocsFromServer(collection(db, 'admins')).catch(() => getDocs(collection(db, 'admins'))),
        getDocsFromServer(collection(db, 'users')).catch(() => getDocs(collection(db, 'users'))),
      ]);

      usersSnap.forEach((d) => {
        const u = d.data() as any;
        const emailLower = String(u?.email || '').toLowerCase().trim();
        const roleLower = String(u?.role || '').toLowerCase().trim();
        if (!emailLower || !emailLower.includes('@') || emailLower.endsWith('@member.pakura.org')) {
          return;
        }
        if (emailLower === mainEmailLower) {
          const prev = adminMap.get(mainEmailLower)!;
          adminMap.set(mainEmailLower, {
            ...prev,
            name: u?.name || prev.name,
            displayName: u?.displayName || prev.displayName,
          });
          return;
        }
        if (!PRIVILEGED_ROLES.has(roleLower)) {
          adminMap.delete(emailLower);
          return;
        }
        if (String(u?.status || 'active').toLowerCase() === 'inactive') {
          adminMap.delete(emailLower);
          return;
        }
        adminMap.set(emailLower, {
          userId: String(u?.userId || d.id),
          email: emailLower,
          name: String(u?.name || u?.displayName || emailLower),
          displayName: String(u?.displayName || u?.name || emailLower),
          role: roleLower,
          isMainAdmin: false,
        });
      });

      adminsSnap.forEach((d) => {
        const a = d.data() as any;
        const emailLower = String(a?.email || '').toLowerCase().trim();
        const roleLower = String(a?.role || 'admin').toLowerCase().trim();
        if (!emailLower || !emailLower.includes('@') || emailLower.endsWith('@member.pakura.org')) {
          return;
        }
        if (emailLower === mainEmailLower) {
          const prev = adminMap.get(mainEmailLower)!;
          adminMap.set(mainEmailLower, {
            ...prev,
            name: a?.name || prev.name,
            displayName: a?.displayName || prev.displayName,
          });
          return;
        }
        if (!PRIVILEGED_ROLES.has(roleLower) || String(a?.status || 'active').toLowerCase() === 'inactive') {
          adminMap.delete(emailLower);
          return;
        }
        adminMap.set(emailLower, {
          userId: String(a?.userId || d.id),
          email: emailLower,
          name: String(a?.name || a?.displayName || emailLower),
          displayName: String(a?.displayName || a?.name || emailLower),
          role: roleLower,
          isMainAdmin: false,
        });
      });
    } catch (err) {
      console.warn('Could not refresh registered admins from Firestore:', err);
    }

    return Array.from(adminMap.values()).sort((a, b) => {
      if (a.isMainAdmin && !b.isMainAdmin) return -1;
      if (!a.isMainAdmin && b.isMainAdmin) return 1;
      return a.email.localeCompare(b.email);
    });
  }

  /**
   * Verify a Google Sign-In user strictly against authorized Admins (Main Admin or pre-configured Committee/Assistant Admins).
   * Regular members are NEVER permitted to log in or create accounts using Google Sign-In.
   * When expectedTypedInput is provided, also enforces that the characters/Gmail typed in the login field
   * strictly correspond to the actual registered Admin Gmail returned by Google.
   */
  static async verifyAdminGoogleAccountInFirebase(
    firebaseUser: { uid: string; email?: string | null; displayName?: string | null },
    localUsers: UserAccount[] = [],
    expectedTypedInput?: string
  ): Promise<{ authorized: boolean; user?: UserAccount; message: string }> {
    const emailLower = (firebaseUser.email || '').toLowerCase().trim();
    const PRIVILEGED_ROLES = new Set(['admin', 'president', 'treasurer', 'secretary']);

    if (!emailLower || emailLower.endsWith('@member.pakura.org')) {
      return {
        authorized: false,
        message:
          'গুগল সাইন-ইন শুধুমাত্র অনুমোদিত অ্যাডমিনদের জন্য সংরক্ষিত। সাধারণ সদস্যরা শুধুমাত্র মোবাইল নম্বর দিয়ে লগইন করতে পারবেন। (Google Sign-In is exclusively for Admins.)',
      };
    }

    if (expectedTypedInput !== undefined) {
      const cleanTyped = (expectedTypedInput || '').trim();
      if (!cleanTyped || !verifyTypedEmailMatchesAdminGmail(cleanTyped, emailLower)) {
        return {
          authorized: false,
          message: `প্রবেশকৃত জিমেইল (${cleanTyped || 'খালি'}) আপনার নির্বাচিত গুগল অ্যাকাউন্ট (${emailLower}) এবং অ্যাডমিন প্যানেলে নিবন্ধিত প্রকৃত জিমেইলের সাথে মিলছে না! সঠিক অ্যাডমিন জিমেইল দিয়ে আবার চেষ্টা করুন।`,
        };
      }
    }

    const nowIso = new Date().toISOString();

    // 1. Main Super Admin signing in with their registered Gmail via Google
    if (emailLower === MAIN_ADMIN_EMAIL_CONST.toLowerCase()) {
      let existingMain: any = null;
      try {
        const [adminSnap, userSnap] = await Promise.all([
          getDocFromServer(doc(db, 'admins', 'USR-MAIN-ADMIN')).catch(() =>
            getDoc(doc(db, 'admins', 'USR-MAIN-ADMIN'))
          ),
          getDocFromServer(doc(db, 'users', 'USR-MAIN-ADMIN')).catch(() =>
            getDoc(doc(db, 'users', 'USR-MAIN-ADMIN'))
          ),
        ]);
        existingMain = {
          ...(userSnap.exists() ? userSnap.data() : {}),
          ...(adminSnap.exists() ? adminSnap.data() : {}),
        };
      } catch {
        // Offline / transient read error still honors strict Main Admin identity
      }

      const mainAdminUser: UserAccount = {
        userId: 'USR-MAIN-ADMIN',
        firebaseUid: firebaseUser.uid || existingMain?.firebaseUid || 'USR-MAIN-ADMIN',
        username: existingMain?.username || 'kajol_admin',
        email: MAIN_ADMIN_EMAIL_CONST,
        name: existingMain?.name || 'Kajol Chandra Das',
        displayName: existingMain?.displayName || 'Kajol Chandra Das ( Admin )',
        role: 'admin',
        isMainAdmin: true,
        status: 'active',
        createdAt: existingMain?.createdAt
          ? String(existingMain.createdAt).split('T')[0]
          : '2026-09-01',
      };

      try {
        await setDoc(
          doc(db, 'admins', 'USR-MAIN-ADMIN'),
          {
            uid: mainAdminUser.firebaseUid,
            userId: 'USR-MAIN-ADMIN',
            email: MAIN_ADMIN_EMAIL_CONST,
            name: mainAdminUser.name,
            displayName: mainAdminUser.displayName,
            role: 'admin',
            status: 'active',
            isMainAdmin: true,
            updatedAt: nowIso,
          },
          { merge: true }
        );
        await this.syncUserRegistrationHistoryInFirebase(mainAdminUser, {
          source: 'main_admin_google_login',
        });
      } catch {
        // Non-blocking cloud sync update
      }

      return {
        authorized: true,
        user: mainAdminUser,
        message: `প্রধান সুপার অ্যাডমিন হিসেবে গুগল সাইন-ইন সম্পন্ন হয়েছে (${MAIN_ADMIN_EMAIL_CONST})!`,
      };
    }

    // 2. Non-Main-Admin Gmail: strictly look up an active pre-configured Admin in /admins or privileged /users
    let matchedAdmin: UserAccount | null = null;
    try {
      const [adminsSnap, usersSnap] = await Promise.all([
        getDocsFromServer(collection(db, 'admins')).catch(() => getDocs(collection(db, 'admins'))),
        getDocsFromServer(collection(db, 'users')).catch(() => getDocs(collection(db, 'users'))),
      ]);

      adminsSnap.forEach((d) => {
        const a = d.data() as any;
        const aEmail = String(a?.email || '').toLowerCase().trim();
        const aRole = String(a?.role || 'admin').toLowerCase().trim();
        if (aEmail === emailLower && PRIVILEGED_ROLES.has(aRole)) {
          const uid = String(a?.userId || d.id).trim();
          matchedAdmin = {
            userId: uid,
            firebaseUid: firebaseUser.uid || a?.uid || uid,
            username: a?.username || emailLower.split('@')[0],
            email: emailLower,
            name: a?.name || a?.displayName || firebaseUser.displayName || emailLower,
            displayName: a?.displayName || a?.name || firebaseUser.displayName || emailLower,
            role: aRole as any,
            status: a?.status || 'active',
            password: a?.password || '',
            isMainAdmin: false,
            createdAt: a?.createdAt
              ? String(a.createdAt).split('T')[0]
              : nowIso.split('T')[0],
          };
        }
      });

      if (!matchedAdmin) {
        usersSnap.forEach((d) => {
          const u = d.data() as any;
          const uEmail = String(u?.email || '').toLowerCase().trim();
          const uRole = String(u?.role || '').toLowerCase().trim();
          if (uEmail === emailLower && PRIVILEGED_ROLES.has(uRole)) {
            const uid = String(u?.userId || d.id).trim();
            matchedAdmin = {
              userId: uid,
              firebaseUid: firebaseUser.uid || u?.firebaseUid || uid,
              username: u?.username || emailLower.split('@')[0],
              email: emailLower,
              name: u?.name || u?.displayName || firebaseUser.displayName || emailLower,
              displayName: u?.displayName || u?.name || firebaseUser.displayName || emailLower,
              role: uRole as any,
              status: u?.status || 'active',
              password: u?.password || '',
              isMainAdmin: false,
              createdAt: u?.createdAt
                ? String(u.createdAt).split('T')[0]
                : nowIso.split('T')[0],
            };
          }
        });
      }
    } catch (err) {
      console.warn('Firestore admin Google lookup fallback to local store:', err);
      const localMatch = localUsers.find(
        (u) =>
          (u.email || '').toLowerCase().trim() === emailLower &&
          PRIVILEGED_ROLES.has(String(u.role || '').toLowerCase())
      );
      if (localMatch) {
        matchedAdmin = {
          ...localMatch,
          firebaseUid: firebaseUser.uid || localMatch.firebaseUid || localMatch.userId,
          isMainAdmin: false,
        };
      }
    }

    if (!matchedAdmin) {
      return {
        authorized: false,
        message:
          'গুগল সাইন-ইন ("Sign in with Google") শুধুমাত্র অনুমোদিত অ্যাডমিনদের জন্য! সাধারণ সদস্যরা গুগল দিয়ে অ্যাকাউন্ট তৈরি বা লগইন করতে পারবেন না — অনুগ্রহ করে আপনার মোবাইল নম্বর দিয়ে নিবন্ধন ও লগইন করুন। (Sign in with Google is exclusively for Admins. Regular members must register and log in using only their phone number.)',
      };
    }

    if (matchedAdmin.status === 'inactive') {
      return {
        authorized: false,
        message:
          'আপনার অ্যাডমিন অ্যাকাউন্টটি বর্তমানে নিষ্ক্রিয় রয়েছে। প্রধান অ্যাডমিনের সাথে যোগাযোগ করুন।',
      };
    }

    try {
      await setDoc(
        doc(db, 'admins', matchedAdmin.userId),
        {
          uid: firebaseUser.uid || matchedAdmin.userId,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
      await setDoc(
        doc(db, 'users', matchedAdmin.userId),
        {
          firebaseUid: firebaseUser.uid || matchedAdmin.userId,
          lastSyncedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
      await this.syncUserRegistrationHistoryInFirebase(matchedAdmin, {
        source: 'admin_google_login',
      });
    } catch {
      // Non-blocking sync
    }

    return {
      authorized: true,
      user: matchedAdmin,
      message: `অ্যাডমিন হিসেবে গুগল সাইন-ইন সম্পন্ন হয়েছে (${matchedAdmin.email})!`,
    };
  }

  /**
   * Permanently delete any existing non-admin (member-role) accounts linked to Gmail addresses
   * from Firestore /users and /registration_history while preserving Admins and phone-only members.
   */
  static async deleteAllGmailMemberAccountsInFirebase(): Promise<{
    deletedUsers: number;
    deletedHistory: number;
  }> {
    let deletedUsers = 0;
    let deletedHistory = 0;
    try {
      const [usersSnap, historySnap] = await Promise.all([
        getDocsFromServer(collection(db, 'users')).catch(() => getDocs(collection(db, 'users'))),
        getDocsFromServer(collection(db, 'registration_history')).catch(() =>
          getDocs(collection(db, 'registration_history'))
        ),
      ]);

      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data() as any;
        if (isGmailLinkedMemberAccount({ ...u, userId: u?.userId || uDoc.id })) {
          await deleteDoc(doc(db, 'users', uDoc.id));
          deletedUsers++;
        }
      }

      for (const hDoc of historySnap.docs) {
        const h = hDoc.data() as any;
        const email = String(h?.email || '').toLowerCase().trim();
        const role = String(h?.role || 'member').toLowerCase().trim();
        const accType = String(h?.accountType || 'member').toLowerCase().trim();
        const isMemberGmail =
          email.length > 0 &&
          !email.endsWith('@member.pakura.org') &&
          role === 'member' &&
          accType === 'member' &&
          !h?.isMainAdmin;
        if (isMemberGmail) {
          await deleteDoc(doc(db, 'registration_history', hDoc.id));
          deletedHistory++;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users/registration_history');
    }
    return { deletedUsers, deletedHistory };
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
        if (d && d.userId && !isGmailLinkedMemberAccount(d)) {
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
   * Rigorously verify via Firebase server whether a user/phone has registered previously,
   * covering the entire history across members, users, registration_history, and activity_logs.
   */
  static async verifyRegistrationHistoryInFirebase(
    phone: string
  ): Promise<FirebaseRegistrationVerificationResult> {
    const cleanPhone = normalizePhoneForAuth(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return {
        checked: true,
        memberFound: false,
        matchedMembers: [],
        alreadyRegistered: false,
        reasons: ['অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন (কমপক্ষে ১০-১১ ডিজিট)।'],
      };
    }

    const last10 = cleanPhone.slice(-10);
    const authEmail = phoneToMemberAuthEmail(cleanPhone).toLowerCase();

    try {
      const [membersSnap, usersSnap, historySnap, logsSnap] = await Promise.all([
        getDocsFromServer(collection(db, 'members')),
        getDocsFromServer(collection(db, 'users')),
        getDocsFromServer(collection(db, 'registration_history')).catch(() => null),
        getDocsFromServer(collection(db, 'activity_logs')).catch(() => null),
      ]);

      // 1. Find ALL members matching this phone number in Firebase
      const matchedMembers: Member[] = [];
      membersSnap.forEach((docSnap) => {
        const m = docSnap.data() as Member;
        if (!m) return;
        const sysId = (m.systemId || docSnap.id || '').trim();
        if (!sysId) return;
        if (phonesMatchForVerification(m.phone, cleanPhone)) {
          matchedMembers.push({
            ...m,
            systemId: sysId,
          });
        }
      });

      if (matchedMembers.length === 0) {
        return {
          checked: true,
          memberFound: false,
          matchedMembers: [],
          alreadyRegistered: false,
          reasons: [
            'এই মোবাইল নম্বরটি ফায়ারবেস সদস্য তালিকায় পাওয়া যায়নি। অ্যাকাউন্ট খুলতে আপনার নম্বরটি সদস্য তালিকায় নিবন্ধিত থাকতে হবে।',
          ],
        };
      }

      // Prefer primary member (already linked or lowest SYS ID)
      matchedMembers.sort((a, b) => a.systemId.localeCompare(b.systemId));
      const primaryMember =
        matchedMembers.find((m) => (m.userId || '').trim().length > 0) || matchedMembers[0];

      const matchedMemberIds = new Set(
        matchedMembers.map((m) => m.systemId.toUpperCase())
      );
      const matchedMemberUserIds = new Set(
        matchedMembers.map((m) => (m.userId || '').trim()).filter(Boolean)
      );

      const reasons: string[] = [];
      let existingAccountDetails: FirebaseRegistrationVerificationResult['existingAccountDetails'];

      // 2. Check /members collection for any linked userId or registration flag
      for (const m of matchedMembers as any[]) {
        const linkedUid = (m.userId || m.firebaseUid || '').trim();
        if (linkedUid || m.isRegistered === true || m.registeredAt) {
          reasons.push(
            `সদস্য রেকর্ড (${m.name} • #${m.systemId}) ফায়ারবেসে ইতিমধ্যে একটি অ্যাকাউন্টের সাথে যুক্ত রয়েছে।`
          );
          if (!existingAccountDetails) {
            existingAccountDetails = {
              source: 'members',
              userId: linkedUid || undefined,
              memberSystemId: m.systemId,
              memberName: m.name,
              registeredAt: m.registeredAt || m.updatedAt || m.createdAt,
            };
          }
        }
      }

      // 3. Check /registration_history collection (immutable permanent registration trail for member accounts)
      if (historySnap) {
        historySnap.forEach((hDoc) => {
          const h = hDoc.data() as any;
          if (!h) return;
          // Admin-only history records should not block separate member phone registrations
          const isMemberHistory =
            (!h.role || h.role === 'member') && h.accountType !== 'main_admin';
          if (!isMemberHistory) return;
          const hSysId = String(h.memberSystemId || '').toUpperCase();
          const hSysIds: string[] = Array.isArray(h.memberSystemIds)
            ? h.memberSystemIds.map((x: any) => String(x).toUpperCase())
            : [];
          const matchesPhone =
            phonesMatchForVerification(h.phone, cleanPhone) ||
            (h.phoneLast10 && h.phoneLast10 === last10) ||
            (h.authEmail && String(h.authEmail).toLowerCase() === authEmail);
          const matchesMember =
            (hSysId && matchedMemberIds.has(hSysId)) ||
            hSysIds.some((id) => matchedMemberIds.has(id));

          if (matchesPhone || matchesMember) {
            reasons.push(
              `ফায়ারবেস স্থায়ী নিবন্ধন ইতিহাসে (Registration History) এই ব্যবহারকারীর পূর্বে নিবন্ধনের প্রমাণ রয়েছে (${h.registeredAt ? String(h.registeredAt).split('T')[0] : 'ইতিহাস সংরক্ষিত'})।`
            );
            if (!existingAccountDetails) {
              existingAccountDetails = {
                source: 'registration_history',
                userId: h.userId,
                firebaseUid: h.firebaseUid,
                memberSystemId: h.memberSystemId || primaryMember.systemId,
                memberName: h.memberName || primaryMember.name,
                registeredAt: h.registeredAt,
              };
            }
          }
        });
      }

      // 4. Check /users collection thoroughly (normalized phone, username, authEmail, memberSystemId, linked userId)
      usersSnap.forEach((uDoc) => {
        const u = uDoc.data() as any;
        if (!u) return;
        const uId = String(u.userId || uDoc.id || '').trim();
        const uSysId = String(u.memberSystemId || '').toUpperCase();
        const uEmail = String(u.email || '').toLowerCase().trim();

        const matchesPhone =
          phonesMatchForVerification(u.phone, cleanPhone) ||
          phonesMatchForVerification(u.username, cleanPhone) ||
          (uEmail && uEmail === authEmail);
        const matchesMember =
          (uSysId && matchedMemberIds.has(uSysId)) ||
          (uId && matchedMemberUserIds.has(uId)) ||
          matchedMemberUserIds.has(uDoc.id);

        if ((matchesPhone || matchesMember) && !isPlaceholderMemberSkeletonUser(u, uDoc.id, matchedMemberUserIds)) {
          reasons.push(
            `ফায়ারবেস ইউজার ডাটাবেসে এই মোবাইল নম্বর/সদস্যের নামে সক্রিয় অ্যাকাউন্ট পাওয়া গেছে (${u.createdAt || 'নিবন্ধিত'})।`
          );
          if (!existingAccountDetails) {
            existingAccountDetails = {
              source: 'users',
              userId: uId,
              firebaseUid: u.firebaseUid,
              memberSystemId: u.memberSystemId || primaryMember.systemId,
              memberName: u.name || u.displayName || primaryMember.name,
              registeredAt: u.registeredAt || u.createdAt,
            };
          }
        }
      });

      // 5. Check entire /activity_logs collection for any historical registration, login, or password event
      if (logsSnap) {
        logsSnap.forEach((lDoc) => {
          const l = lDoc.data() as any;
          if (!l) return;
          const action = String(l.action || '').toUpperCase();
          const desc = String(l.description || l.details || '');
          const descDigits = extractNormalizedDigits(desc);
          const refId = String(l.referenceId || l.memberSystemId || '').toUpperCase();
          const logUserId = String(l.userId || '').trim();

          const isAccountEvent =
            action.includes('REGISTER') ||
            action.includes('SIGNUP') ||
            action.includes('USER_LOGIN') ||
            action.includes('MEMBER_CAPTCHA_LOGIN') ||
            action.includes('CHANGE_PASSWORD') ||
            action.includes('RESET_PASSWORD') ||
            action.includes('CREATE_USER') ||
            desc.includes('নিবন্ধন') ||
            desc.includes('অ্যাকাউন্ট তৈরি') ||
            desc.includes('লগইন করেছেন') ||
            desc.includes('পাসওয়ার্ড পরিবর্তন');

          if (!isAccountEvent) return;

          const matchesPhone =
            phonesMatchForVerification(l.phone, cleanPhone) ||
            (last10.length === 10 && descDigits.includes(last10));
          const matchesMember =
            (refId && matchedMemberIds.has(refId)) ||
            (logUserId && matchedMemberUserIds.has(logUserId)) ||
            Array.from(matchedMemberIds).some((id) => desc.toUpperCase().includes(id));

          if (matchesPhone || matchesMember) {
            reasons.push(
              `ফায়ারবেস অ্যাক্টিভিটি লগে এই ব্যবহারকারীর পূর্ববর্তী অ্যাকাউন্ট ইতিহাস পাওয়া গেছে (${l.action || 'ACCOUNT_HISTORY'})।`
            );
            if (!existingAccountDetails) {
              existingAccountDetails = {
                source: 'activity_logs',
                userId: logUserId || undefined,
                memberSystemId: refId || primaryMember.systemId,
                memberName: primaryMember.name,
                registeredAt: l.timestamp || l.dateTime,
              };
            }
          }
        });
      }

      return {
        checked: true,
        memberFound: true,
        matchedMembers,
        primaryMember,
        alreadyRegistered: reasons.length > 0,
        reasons: Array.from(new Set(reasons)),
        existingAccountDetails,
      };
    } catch (error: any) {
      console.warn('Firebase registration history verification error:', error);
      return {
        checked: false,
        connectionError:
          'ফায়ারবেস সার্ভারের সাথে সংযোগ স্থাপন করে পূর্বের নিবন্ধন ইতিহাস যাচাই করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
        memberFound: false,
        matchedMembers: [],
        alreadyRegistered: false,
        reasons: [],
      };
    }
  }

  /**
   * Store or update permanent registration history in Firestore (/registration_history/{historyId})
   * for any account: new or existing users, regular members, Google users, or admins.
   */
  static async syncUserRegistrationHistoryInFirebase(
    user: Partial<UserAccount> & { userId: string },
    options?: {
      member?: Member;
      matchedMembers?: Member[];
      source?: string;
      existingRegisteredAt?: string;
    }
  ): Promise<void> {
    if (!user?.userId) return;

    const cleanPhone = normalizePhoneForAuth(user.phone || options?.member?.phone || '');
    const memberSystemId = (user.memberSystemId || options?.member?.systemId || '').trim();
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const role = user.role || 'member';
    const isMain = isStrictMainAdminAccount(user as UserAccount) || Boolean(user.isMainAdmin);
    const isPrivileged =
      isMain || ['admin', 'president', 'treasurer', 'secretary'].includes(role);
    const accountType: 'main_admin' | 'admin' | 'member' = isMain
      ? 'main_admin'
      : isPrivileged
      ? 'admin'
      : 'member';

    const safeUserId = String(user.userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const historyId =
      accountType === 'member' && cleanPhone && memberSystemId
        ? `REG-${cleanPhone}-${memberSystemId}`
        : `REG-USR-${safeUserId}`;

    const path = `registration_history/${historyId}`;
    try {
      const historyRef = doc(db, 'registration_history', historyId);
      let existingRegAt = options?.existingRegisteredAt;
      if (!existingRegAt) {
        try {
          const existingSnap = await getDoc(historyRef);
          if (existingSnap.exists()) {
            existingRegAt = existingSnap.data()?.registeredAt;
          }
        } catch {
          // Ignore pre-read issues
        }
      }

      const nowIso = new Date().toISOString();
      const registeredAt =
        existingRegAt ||
        (user as any).registeredAt ||
        user.createdAt ||
        nowIso;

      const allIds = (options?.matchedMembers && options.matchedMembers.length > 0
        ? options.matchedMembers.map((m) => m.systemId)
        : memberSystemId
        ? [memberSystemId]
        : []);

      const authEmail =
        accountType === 'member' && cleanPhone
          ? phoneToMemberAuthEmail(cleanPhone)
          : cleanEmail;

      const payload: Record<string, any> = {
        historyId,
        userId: user.userId,
        firebaseUid: user.firebaseUid || user.userId,
        email: cleanEmail,
        phone: cleanPhone,
        phoneLast10: cleanPhone ? cleanPhone.slice(-10) : '',
        authEmail,
        username: user.username || cleanPhone || (cleanEmail ? cleanEmail.split('@')[0] : user.userId),
        role,
        accountType,
        isMainAdmin: isMain,
        status: user.status || 'active',
        memberSystemId,
        name: user.name || options?.member?.name || user.displayName || cleanEmail || user.userId,
        displayName: user.displayName || user.name || cleanEmail || user.userId,
        memberName: options?.member?.name || user.name || user.displayName || '',
        registeredAt,
        syncedAt: nowIso,
        source:
          options?.source ||
          (isMain
            ? 'main_admin_account'
            : isPrivileged
            ? 'admin_account'
            : 'member_registration'),
      };

      if (allIds.length > 0) {
        payload.memberSystemIds = Array.from(new Set(allIds));
      }

      await setDoc(historyRef, payload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Record permanent registration history in Firestore (/registration_history/{historyId})
   */
  static async recordRegistrationHistoryInFirebase(params: {
    phone: string;
    userId: string;
    firebaseUid?: string;
    member: Member;
    matchedMembers?: Member[];
    source?: string;
    user?: Partial<UserAccount>;
  }): Promise<void> {
    await this.syncUserRegistrationHistoryInFirebase(
      {
        ...(params.user || {}),
        userId: params.userId,
        firebaseUid: params.firebaseUid || params.user?.firebaseUid || params.userId,
        phone: params.phone || params.member.phone,
        role: params.user?.role || 'member',
        memberSystemId: params.member.systemId,
        name: params.user?.name || params.member.name,
        displayName: params.user?.displayName || `${params.member.name} (সদস্য)`,
        status: params.user?.status || 'active',
      },
      {
        member: params.member,
        matchedMembers: params.matchedMembers,
        source: params.source || 'member_registration',
      }
    );
  }

  /**
   * Backfill and synchronize registration_history in Firestore for EVERY existing user and admin
   * found in /users, /admins, and linked /members records (regular members + admins).
   */
  static async syncAllExistingUsersToRegistrationHistory(): Promise<{
    syncedCount: number;
    skippedSkeletons: number;
  }> {
    let syncedCount = 0;
    let skippedSkeletons = 0;
    try {
      const [usersSnap, adminsSnap, membersSnap, historySnap] = await Promise.all([
        getDocsFromServer(collection(db, 'users')).catch(() => getDocs(collection(db, 'users'))),
        getDocsFromServer(collection(db, 'admins')).catch(() => getDocs(collection(db, 'admins'))),
        getDocsFromServer(collection(db, 'members')).catch(() => getDocs(collection(db, 'members'))),
        getDocsFromServer(collection(db, 'registration_history')).catch(() =>
          getDocs(collection(db, 'registration_history'))
        ),
      ]);

      const memberBySysId = new Map<string, Member>();
      membersSnap.forEach((mDoc) => {
        const m = mDoc.data() as Member;
        const sysId = (m?.systemId || mDoc.id || '').trim();
        if (sysId) {
          memberBySysId.set(sysId, { ...m, systemId: sysId });
        }
      });

      const existingHistoryById = new Map<string, any>();
      historySnap.forEach((hDoc) => {
        existingHistoryById.set(hDoc.id, hDoc.data());
      });

      const accountsToSync = new Map<string, UserAccount>();

      // 1. Collect all real users from /users (skipping empty skeletons and obsolete Gmail-linked members)
      usersSnap.forEach((uDoc) => {
        const u = uDoc.data() as any;
        const userId = String(u?.userId || uDoc.id || '').trim();
        if (!userId) return;

        if (isGmailLinkedMemberAccount({ ...u, userId })) {
          return;
        }

        const isSkeleton = isPlaceholderMemberSkeletonUser(u, uDoc.id, new Set());
        const isPrivileged = u?.role && u.role !== 'member';
        if (isSkeleton && !isPrivileged && !u?.isMainAdmin) {
          skippedSkeletons++;
          return;
        }

        accountsToSync.set(userId, {
          ...(u as UserAccount),
          userId,
          firebaseUid: u?.firebaseUid || userId,
          role: u?.role || 'member',
          status: u?.status || 'active',
          isMainAdmin: isStrictMainAdminAccount({ ...u, userId } as UserAccount) || Boolean(u?.isMainAdmin),
        });
      });

      // 2. Collect / merge all administrators from /admins (including USR-MAIN-ADMIN)
      adminsSnap.forEach((aDoc) => {
        const a = aDoc.data() as any;
        const userId = String(a?.userId || aDoc.id || '').trim();
        if (!userId) return;

        const prev = accountsToSync.get(userId);
        accountsToSync.set(userId, {
          ...(prev || {}),
          userId,
          firebaseUid: a?.uid || prev?.firebaseUid || userId,
          email: a?.email || prev?.email || '',
          username: prev?.username || (a?.email ? String(a.email).split('@')[0] : userId),
          phone: prev?.phone || a?.phone || '',
          name: a?.name || prev?.name || a?.displayName || a?.email || userId,
          displayName: a?.displayName || prev?.displayName || a?.name || a?.email || userId,
          role: a?.role || prev?.role || 'admin',
          status: a?.status || prev?.status || 'active',
          isMainAdmin:
            Boolean(a?.isMainAdmin) ||
            userId === 'USR-MAIN-ADMIN' ||
            String(a?.email || '').toLowerCase().trim() === MAIN_ADMIN_EMAIL_CONST.toLowerCase(),
          createdAt: a?.createdAt || prev?.createdAt || new Date().toISOString(),
        } as UserAccount);
      });

      // 3. Ensure every collected user & admin has a complete registration_history document
      for (const account of accountsToSync.values()) {
        const memberRecord = account.memberSystemId
          ? memberBySysId.get(account.memberSystemId)
          : undefined;
        const cleanPhone = normalizePhoneForAuth(account.phone || memberRecord?.phone || '');
        const sysId = (account.memberSystemId || memberRecord?.systemId || '').trim();
        const isPrivileged =
          Boolean(account.isMainAdmin) ||
          ['admin', 'president', 'treasurer', 'secretary'].includes(account.role);

        const safeUserId = String(account.userId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const historyId =
          !isPrivileged && cleanPhone && sysId
            ? `REG-${cleanPhone}-${sysId}`
            : `REG-USR-${safeUserId}`;

        const existing = existingHistoryById.get(historyId);
        // Write if missing or missing standardized fields (role, accountType, name)
        if (!existing || !existing.role || !existing.accountType || !existing.name) {
          await this.syncUserRegistrationHistoryInFirebase(account, {
            member: memberRecord,
            source: existing?.source || (account.isMainAdmin ? 'main_admin_backfill' : isPrivileged ? 'admin_backfill' : 'member_backfill'),
            existingRegisteredAt: existing?.registeredAt,
          });
          syncedCount++;
        }
      }
    } catch (error) {
      console.warn('Backfill registration_history notice:', error);
    }
    return { syncedCount, skippedSkeletons };
  }

  /**
   * Register a new member account in Firebase Auth and Firestore ONLY after rigorous verification
   */
  static async registerMemberInFirebase(
    phone: string,
    pass: string,
    member: Member,
    matchedMembers?: Member[]
  ): Promise<{ success: boolean; alreadyRegistered?: boolean; message: string; user?: UserAccount }> {
    const cleanPhone = normalizePhoneForAuth(phone);
    const authEmail = phoneToMemberAuthEmail(cleanPhone);

    try {
      // 1. Rigorous server-side verification across entire Firebase history BEFORE creating any Auth/Firestore record
      const verification = await this.verifyRegistrationHistoryInFirebase(cleanPhone);
      if (!verification.checked) {
        return {
          success: false,
          message:
            verification.connectionError ||
            'ফায়ারবেস যাচাইকরণ সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।',
        };
      }

      if (!verification.memberFound || !verification.primaryMember) {
        return {
          success: false,
          message:
            verification.reasons[0] ||
            'এই মোবাইল নম্বরটি ফায়ারবেস সদস্য তালিকায় পাওয়া যায়নি।',
        };
      }

      if (verification.alreadyRegistered) {
        return {
          success: false,
          alreadyRegistered: true,
          message: `এই মোবাইল নম্বর দিয়ে ফায়ারবেসে পূর্বেই অ্যাকাউন্ট নিবন্ধিত হয়েছে (${verification.reasons[0] || 'আগের ইতিহাস পাওয়া গেছে'})। অনুগ্রহ করে লগইন করুন।`,
        };
      }

      const targetMember = verification.primaryMember || member;
      const linkedMembers =
        matchedMembers && matchedMembers.length > 0
          ? matchedMembers
          : verification.matchedMembers;

      // 2. Create Firebase Auth user — strictly reject if auth/email-already-in-use
      let firebaseUid = '';
      try {
        const cred = await createUserWithEmailAndPassword(auth, authEmail, pass);
        firebaseUid = cred.user.uid;
        try {
          await updateProfile(cred.user, { displayName: targetMember.name });
        } catch {
          // Ignore profile update error
        }
      } catch (authError: any) {
        if (authError?.code === 'auth/email-already-in-use') {
          return {
            success: false,
            alreadyRegistered: true,
            message:
              'ফায়ারবেস অথেনটিকেশন ইতিহাসে এই মোবাইল নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট নিবন্ধিত রয়েছে। পুনরায় নিবন্ধন করা যাবে না — অনুগ্রহ করে লগইন করুন।',
          };
        }
        if (authError?.code === 'auth/weak-password') {
          return {
            success: false,
            message: 'ফায়ারবেস নিরাপত্তার জন্য পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
          };
        }
        if (authError?.code === 'auth/network-request-failed') {
          return {
            success: false,
            message: 'ফায়ারবেস নেটওয়ার্ক সংযোগ বিচ্ছিন্ন রয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করুন।',
          };
        }
        if (authError?.code === 'auth/operation-not-allowed') {
          firebaseUid = `FB-M-${cleanPhone}`;
        } else {
          return {
            success: false,
            message:
              authError?.message ||
              'ফায়ারবেস অথেনটিকেশনে অ্যাকাউন্ট তৈরি করা সম্ভব হয়নি।',
          };
        }
      }

      const userId = firebaseUid || `USR-M-${cleanPhone}`;
      const today = new Date().toISOString().split('T')[0];
      const nowIso = new Date().toISOString();
      const newUser: UserAccount = {
        userId,
        firebaseUid,
        username: cleanPhone,
        phone: cleanPhone,
        name: targetMember.name,
        displayName: `${targetMember.name} (সদস্য)`,
        role: 'member',
        memberSystemId: targetMember.systemId,
        password: pass,
        status: 'active',
        createdAt: today,
      };

      // 3. Sync User Profile to Firestore with registration flags
      await setDoc(
        doc(db, 'users', newUser.userId),
        {
          userId: newUser.userId,
          firebaseUid: newUser.firebaseUid || newUser.userId,
          displayName: newUser.displayName,
          name: newUser.name,
          username: cleanPhone,
          role: 'member',
          status: 'active',
          email: '',
          phone: cleanPhone,
          memberSystemId: targetMember.systemId,
          isMainAdmin: false,
          password: pass,
          isRegistered: true,
          registeredAt: nowIso,
          lastSyncedAt: nowIso,
          createdAt: today,
        },
        { merge: true }
      );

      // 4. Link member record with this userId and sync to Firestore
      targetMember.userId = userId;
      targetMember.phone = cleanPhone;
      targetMember.updatedAt = today;
      await this.syncMember(targetMember);

      // 5. Record immutable registration history and cloud activity log
      await this.recordRegistrationHistoryInFirebase({
        phone: cleanPhone,
        userId,
        firebaseUid,
        member: targetMember,
        matchedMembers: linkedMembers,
        source: 'member_registration',
        user: newUser,
      });

      await this.syncActivityLog({
        logId: `LOG-REG-${Date.now()}`,
        dateTime: new Date().toLocaleString('bn-BD'),
        timestamp: nowIso,
        userId,
        userDisplayName: newUser.displayName,
        role: 'member',
        action: 'MEMBER_REGISTER',
        module: 'Membership',
        referenceId: targetMember.systemId,
        description: `সদস্য "${targetMember.name}" (${targetMember.systemId}) মোবাইল নম্বর (${cleanPhone}) দিয়ে ফায়ারবেস যাচাইয়ের মাধ্যমে নিবন্ধন সম্পন্ন করেছেন।`,
      });

      return {
        success: true,
        message: `অভিনন্দন ${targetMember.name}! ফায়ারবেস ক্লাউডে আপনার সদস্য অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।`,
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
   * Complete fresh member registration with Firebase Phone User (also enforces full history verification)
   */
  static async registerMemberWithFirebasePhoneUser(
    firebaseUid: string,
    phone: string,
    member: Member,
    password?: string
  ): Promise<{ success: boolean; alreadyRegistered?: boolean; user?: UserAccount; message: string }> {
    const cleanPhone = normalizePhoneForAuth(phone);

    const verification = await this.verifyRegistrationHistoryInFirebase(cleanPhone);
    if (!verification.checked) {
      return {
        success: false,
        message: verification.connectionError || 'ফায়ারবেস ইতিহাস যাচাই করা যায়নি।',
      };
    }
    if (verification.alreadyRegistered) {
      return {
        success: false,
        alreadyRegistered: true,
        message: `এই মোবাইল নম্বর দিয়ে ফায়ারবেসে পূর্বেই অ্যাকাউন্ট নিবন্ধিত হয়েছে (${verification.reasons[0] || 'আগের ইতিহাস পাওয়া গেছে'})। অনুগ্রহ করে লগইন করুন।`,
      };
    }

    const userId = firebaseUid || `USR-M-${cleanPhone}`;
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

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
    await setDoc(
      doc(db, 'users', newUser.userId),
      {
        ...newUser,
        isRegistered: true,
        registeredAt: nowIso,
        lastSyncedAt: nowIso,
      },
      { merge: true }
    );

    // 2. Link member record with this userId and sync to Firestore
    member.userId = userId;
    member.phone = cleanPhone;
    member.updatedAt = today;
    await this.syncMember(member);

    // 3. Record permanent registration history & activity log
    await this.recordRegistrationHistoryInFirebase({
      phone: cleanPhone,
      userId,
      firebaseUid,
      member,
      matchedMembers: verification.matchedMembers,
      source: 'phone_auth_registration',
      user: newUser,
    });

    await this.syncActivityLog({
      logId: `LOG-REG-${Date.now()}`,
      dateTime: new Date().toLocaleString('bn-BD'),
      timestamp: nowIso,
      userId,
      userDisplayName: newUser.displayName,
      role: 'member',
      action: 'MEMBER_PHONE_AUTH_REGISTER',
      module: 'Membership',
      referenceId: member.systemId,
      description: `সদস্য "${member.name}" (${member.systemId}) ফায়ারবেস ফোন নম্বরের মাধ্যমে সফলভাবে ভেরিফাই ও নিবন্ধন সম্পন্ন করেছেন (${cleanPhone})।`,
    });

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
   * Directly fetch a member by phone or systemId from Firestore (for immediate cross-origin login)
   */
  static async fetchMemberDirectly(identifier: string): Promise<Member | null> {
    const cleanId = (identifier || '').trim();
    if (!cleanId) return null;
    const cleanPhone = normalizePhoneForAuth(cleanId);

    try {
      // 1. By Document ID (SYS-000001)
      if (cleanId.toUpperCase().startsWith('SYS-') || cleanId.toUpperCase().startsWith('MEM-')) {
        const snap = await getDoc(doc(db, 'members', cleanId.toUpperCase()));
        if (snap.exists()) return snap.data() as Member;
      }

      // 2. By Phone Number
      if (cleanPhone.length >= 8) {
        const q = query(collection(db, 'members'), where('phone', '==', cleanPhone));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data() as Member;
        }
      }

      // 3. Fallback: Search all members in Firestore
      const allSnap = await getDocs(collection(db, 'members'));
      for (const d of allSnap.docs) {
        const m = d.data() as Member;
        const mPhone = normalizePhoneForAuth(m.phone || '');
        if (
          m.systemId.toLowerCase() === cleanId.toLowerCase() ||
          (cleanPhone.length >= 8 && mPhone.endsWith(cleanPhone.slice(-10)))
        ) {
          return m;
        }
      }
    } catch (err) {
      console.warn('Direct member fetch notice:', err);
    }
    return null;
  }

  /**
   * Wipe financial collections in Firestore on database reset while strictly keeping all members intact
   */
  static async wipeAllDataForCleanReset(intactMembers?: Member[]): Promise<void> {
    try {
      // NOTE: 'members' is strictly excluded so member records are NEVER deleted on database reset
      const collectionsToWipe = [
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
        'activity_logs',
        'chat_messages',
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

      // Member records are ALWAYS preserved in Firestore with their financial balances set to ৳0
      if (intactMembers && intactMembers.length > 0) {
        for (const member of intactMembers) {
          await this.syncMember({
            ...member,
            currentBalance: 0,
            profitShareBalance: 0,
            totalWithdrawn: 0,
          });
        }
      } else {
        try {
          const membersSnap = await getDocs(collection(db, 'members'));
          for (const mDoc of membersSnap.docs) {
            await setDoc(
              doc(db, 'members', mDoc.id),
              {
                currentBalance: 0,
                profitShareBalance: 0,
                totalWithdrawn: 0,
                updatedAt: new Date().toISOString().split('T')[0],
              },
              { merge: true }
            );
          }
        } catch (err) {
          console.warn('Could not reset member balances in Firestore:', err);
        }
      }

      // Clear non-admin, non-member users if any extraneous test accounts exist
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const d of usersSnap.docs) {
          const data = d.data();
          if (
            data.email?.toLowerCase() !== 'freelancerkajolchandradas@gmail.com' &&
            !data.isMainAdmin &&
            !data.memberSystemId
          ) {
            await deleteDoc(doc(db, 'users', d.id)).catch(() => {});
          }
        }
      } catch {}

      // Write meta reset timestamp doc so any delayed reads recognize the financial reset
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
    await this.wipeAllDataForCleanReset(members);
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
          phone: contribution.phone || '',
          accountNumber: contribution.accountNumber || '',
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
          timestamp: log.timestamp || new Date().toISOString(),
          userId: log.userId,
          userDisplayName: log.userDisplayName,
          role: log.role,
          action: log.action,
          module: log.module,
          referenceId: log.referenceId || '',
          description: log.description,
          details: log.details || log.description,
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync organization settings and administrator security configuration to Firestore
   */
  static async syncSettings(settings: AppSettings): Promise<void> {
    const path = 'settings/app_settings';
    try {
      const ref = doc(db, 'settings', 'app_settings');
      await setDoc(
        ref,
        {
          ...settings,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Sync master ledger transaction to Firestore (/transactions/{transactionId})
   */
  static async syncTransaction(transaction: Transaction): Promise<void> {
    if (!transaction.transactionId) return;
    const path = `transactions/${transaction.transactionId}`;
    try {
      const cleanData: Record<string, any> = {};
      Object.entries(transaction).forEach(([k, v]) => {
        if (v !== undefined) {
          cleanData[k] = v;
        }
      });
      const ref = doc(db, 'transactions', transaction.transactionId);
      await setDoc(ref, cleanData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Delete transaction from Firestore
   */
  static async deleteTransaction(transactionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'transactions', transactionId));
    } catch (e) {
      console.warn('Delete transaction from Firestore notice:', e);
    }
  }

  /**
   * Delete rule from Firestore
   */
  static async deleteRule(ruleId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'rules', ruleId));
    } catch (e) {
      console.warn('Delete rule from Firestore notice:', e);
    }
  }

  /**
   * Delete meeting from Firestore
   */
  static async deleteMeeting(meetingId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'meetings', meetingId));
    } catch (e) {
      console.warn('Delete meeting from Firestore notice:', e);
    }
  }

  /**
   * Delete contribution from Firestore
   */
  static async deleteContribution(contributionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'contributions', contributionId));
    } catch (e) {
      console.warn('Delete contribution from Firestore notice:', e);
    }
  }

  /**
   * Delete receipt from Firestore
   */
  static async deleteReceipt(receiptId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'receipts', receiptId));
    } catch (e) {
      console.warn('Delete receipt from Firestore notice:', e);
    }
  }

  /**
   * Delete income record from Firestore
   */
  static async deleteIncome(incomeId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'incomes', incomeId));
    } catch (e) {
      console.warn('Delete income from Firestore notice:', e);
    }
  }

  /**
   * Delete expense record from Firestore
   */
  static async deleteExpense(expenseId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
    } catch (e) {
      console.warn('Delete expense from Firestore notice:', e);
    }
  }

  /**
   * Delete loan record from Firestore
   */
  static async deleteLoan(loanId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'loans', loanId));
    } catch (e) {
      console.warn('Delete loan from Firestore notice:', e);
    }
  }

  /**
   * Export all local app records up to Firestore
   */
  static async syncAllToFirestore(appData: FullAppData): Promise<{ success: boolean; message: string }> {
    try {
      // 0. Settings & Admin Security Config
      if (appData.settings) {
        await this.syncSettings(appData.settings);
      }
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
      // 9. Master Ledger Transactions
      for (const t of appData.transactions || []) {
        await this.syncTransaction(t);
      }
      // 10. Member Withdrawals
      for (const w of appData.memberWithdrawals || []) {
        await this.syncMemberWithdrawal(w);
      }
      // 11. Backfill / verify registration_history for all existing Firebase users & admins
      await this.syncAllExistingUsersToRegistrationHistory();

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
      const [
        usersSnap,
        adminsSnap,
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
        getDocs(collection(db, 'admins')),
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

      const mergedUserMap = new Map<string, UserAccount>();
      if (usersSnap.status === 'fulfilled') {
        usersSnap.value.forEach((d) => {
          const u = d.data() as any;
          if (u?.userId && !isGmailLinkedMemberAccount(u)) {
            mergedUserMap.set(u.userId, {
              ...(u as UserAccount),
              isMainAdmin: isStrictMainAdminAccount(u as UserAccount),
            });
          }
        });
      }
      if (adminsSnap.status === 'fulfilled') {
        adminsSnap.value.forEach((d) => {
          const a = d.data() as any;
          const uid = a?.userId || a?.uid || d.id;
          if (!uid || !a?.email) return;
          const cleanEmail = String(a.email).toLowerCase().trim();
          const isMain = cleanEmail === MAIN_ADMIN_EMAIL_CONST.toLowerCase();
          if (isMain) return;
          const existing = mergedUserMap.get(uid);
          mergedUserMap.set(uid, {
            ...(existing || {}),
            userId: uid,
            firebaseUid: a.uid || existing?.firebaseUid || uid,
            username: existing?.username || cleanEmail.split('@')[0],
            email: cleanEmail,
            name: a.name || existing?.name || a.displayName || cleanEmail,
            displayName: a.displayName || existing?.displayName || a.name || cleanEmail,
            role: a.role || existing?.role || 'admin',
            status: a.status || existing?.status || 'active',
            password: a.password || existing?.password || '',
            createdAt:
              existing?.createdAt ||
              (a.createdAt ? String(a.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]),
            isMainAdmin: false,
          } as UserAccount);
        });
      }
      if (mergedUserMap.size > 0) {
        result.users = Array.from(mergedUserMap.values());
      }

      if (membersSnap.status === 'fulfilled') {
        const members: Member[] = [];
        membersSnap.value.forEach((d) => {
          const m = d.data();
          if (m?.systemId) {
            // Member records always remain intact and permanently saved in Firestore
            members.push(m as Member);
          }
        });
        if (members.length > 0) result.members = members;
      }

      if (contributionsSnap.status === 'fulfilled') {
        const contributions: Contribution[] = [];
        contributionsSnap.value.forEach((d) => {
          const c = d.data();
          const conId = c?.contributionId || d.id;
          if (conId) {
            contributions.push({
              contributionId: conId,
              memberSystemId: c?.memberSystemId || '',
              memberName: c?.memberName || '',
              phone: c?.phone || '',
              amount: Number(c?.amount || 0),
              contributionDate: c?.contributionDate || '',
              month: c?.month || '',
              paymentMethod: c?.paymentMethod || 'cash',
              receiptId: c?.receiptId || '',
              recordedBy: c?.recordedBy || '',
              createdAt: c?.createdAt || '',
              status: c?.status || 'paid',
              lateFee: Number(c?.lateFee || 0),
              notes: c?.notes || '',
              contributionType: c?.contributionType || 'regular',
            } as Contribution);
          }
        });
        result.contributions = contributions;
      }

      if (loansSnap.status === 'fulfilled') {
        const loans: Loan[] = [];
        loansSnap.value.forEach((d) => {
          const l = d.data();
          if (l?.loanId) {
            loans.push(l as Loan);
          }
        });
        result.loans = loans;
      }

      if (loanPaymentsSnap.status === 'fulfilled') {
        const payments: LoanPayment[] = [];
        loanPaymentsSnap.value.forEach((d) => {
          const p = d.data();
          if (p?.paymentId) {
            payments.push(p as LoanPayment);
          }
        });
        result.loanPayments = payments;
      }

      if (incomesSnap.status === 'fulfilled') {
        const incomes: IncomeRecord[] = [];
        incomesSnap.value.forEach((d) => {
          const inc = d.data();
          if (inc?.incomeId) {
            incomes.push(inc as IncomeRecord);
          }
        });
        result.incomes = incomes;
        result.incomeRecords = incomes;
      }

      if (expensesSnap.status === 'fulfilled') {
        const expenses: ExpenseRecord[] = [];
        expensesSnap.value.forEach((d) => {
          const exp = d.data();
          if (exp?.expenseId) {
            expenses.push(exp as ExpenseRecord);
          }
        });
        result.expenses = expenses;
        result.expenseRecords = expenses;
      }

      if (receiptsSnap.status === 'fulfilled') {
        const receipts: Receipt[] = [];
        receiptsSnap.value.forEach((d) => {
          const r = d.data();
          if (r?.receiptId) {
            receipts.push(r as Receipt);
          }
        });
        result.receipts = receipts;
      }

      if (rulesSnap.status === 'fulfilled') {
        const rules: SocietyRule[] = [];
        rulesSnap.value.forEach((d) => {
          const r = d.data();
          if (r?.ruleId) {
            rules.push(r as SocietyRule);
          }
        });
        result.rules = rules;
      }

      if (meetingsSnap.status === 'fulfilled') {
        const meetings: GeneralMeeting[] = [];
        meetingsSnap.value.forEach((d) => {
          const m = d.data();
          if (m?.meetingId) {
            meetings.push(m as GeneralMeeting);
          }
        });
        result.meetings = meetings;
      }

      if (distSnap.status === 'fulfilled') {
        const dists: ProfitDistribution[] = [];
        distSnap.value.forEach((d) => {
          const di = d.data();
          if (di?.distributionId) {
            dists.push(di as ProfitDistribution);
          }
        });
        result.profitDistributions = dists;
      }

      if (withdrawalsSnap.status === 'fulfilled') {
        const withdrawals: MemberWithdrawal[] = [];
        withdrawalsSnap.value.forEach((d) => {
          const w = d.data();
          if (w?.withdrawalId) {
            withdrawals.push(w as MemberWithdrawal);
          }
        });
        result.memberWithdrawals = withdrawals;
      }

      if (transactionsSnap.status === 'fulfilled') {
        const transactions: any[] = [];
        transactionsSnap.value.forEach((d) => {
          const t = d.data();
          if (t?.transactionId) {
            transactions.push(t);
          }
        });
        result.transactions = transactions;
      }

      // 9. Load Organization Settings & Admin Security Config from Firestore
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'app_settings'));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data() as Record<string, any>;
          const resolvedTime = sData.generalMeetingTime || sData.meetingTime || sData.scheduledTime;
          if (resolvedTime) {
            sData.generalMeetingTime = String(resolvedTime).trim();
          }
          if (sData.updatedAt && !sData.meetingTimeUpdatedAt) {
            sData.meetingTimeUpdatedAt = String(sData.updatedAt);
          }
          result.settings = sData as AppSettings;
        }
      } catch (err) {
        console.warn('Settings load notice:', err);
      }

      // 10. Check if a clean cloud reset occurred
      try {
        const resetMetaSnap = await getDoc(doc(db, '_system_meta', 'reset_state'));
        if (resetMetaSnap.exists()) {
          const resetMetaData = resetMetaSnap.data();
          if (resetMetaData?.lastResetAt) {
            (result as any).cloudResetTimestamp = Number(resetMetaData.lastResetAt);
          }
        }
      } catch (err) {
        console.warn('Reset meta check notice:', err);
      }
    } catch (e) {
      console.warn('Error loading records from Firestore:', e);
    }

    return result;
  }

  /**
   * Real-time multi-collection listener using Firestore onSnapshot.
   * Fires instantaneously whenever an admin or user modifies records in Firebase.
   */
  static subscribeToRealtimeData(
    onUpdate: (data: Partial<FullAppData>) => void
  ): () => void {
    const unsubscribes: (() => void)[] = [];

    // Helper to extract and sanitize a document list from snapshot
    const parseSnapshot = (snapshot: any, parser: (d: any) => any) => {
      const items: any[] = [];
      snapshot.forEach((docSnap: any) => {
        try {
          const item = parser(docSnap);
          if (item) items.push(item);
        } catch {}
      });
      return items;
    };

    // 1. Real-time Members Listener (Instant balance and status update)
    try {
      const unsub = onSnapshot(
        collection(db, 'members'),
        (snap) => {
          const members: Member[] = parseSnapshot(snap, (d) => {
            const m = d.data();
            const sysId = m?.systemId || m?.memberSystemId || m?.id || d.id;
            if (!sysId) return null;
            return {
              systemId: sysId,
              name: m?.name || m?.memberName || '',
              phone: m?.phone || m?.mobile || '',
              status: m?.status || 'active',
              currentBalance: Number(m?.currentBalance ?? m?.balance ?? 0),
              profitShareBalance: Number(m?.profitShareBalance ?? 0),
              totalWithdrawn: Number(m?.totalWithdrawn ?? 0),
              accountNumber: m?.accountNumber || '',
              email: m?.email || '',
              userId: m?.userId || '',
              createdAt: m?.createdAt || '',
              updatedAt: m?.updatedAt || '',
            } as Member;
          });
          if (members.length > 0) {
            onUpdate({ members });
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'members');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime members listener notice:', e);
    }

    // 2. Real-time Contributions Listener (Instant payment history updates)
    try {
      const unsub = onSnapshot(
        collection(db, 'contributions'),
        (snap) => {
          const contributions: Contribution[] = parseSnapshot(snap, (d) => {
            const c = d.data();
            const conId = c?.contributionId || c?.contribution_id || c?.id || d.id;
            if (!conId) return null;
            return {
              contributionId: conId,
              memberSystemId: c?.memberSystemId || c?.memberId || c?.systemId || '',
              memberName: c?.memberName || c?.member_name || c?.name || '',
              phone: c?.phone || c?.memberPhone || '',
              amount: Number(c?.amount || c?.contributionAmount || 0),
              contributionDate: c?.contributionDate || c?.date || '',
              month: c?.month || '',
              paymentMethod: c?.paymentMethod || c?.payment_method || 'cash',
              receiptId: c?.receiptId || c?.receipt_id || '',
              recordedBy: c?.recordedBy || c?.recorded_by || '',
              createdAt: c?.createdAt || '',
              status: c?.status || 'paid',
              lateFee: Number(c?.lateFee || c?.late_fee || 0),
              notes: c?.notes || '',
              contributionType: c?.contributionType || c?.contribution_type || 'regular',
            } as Contribution;
          });
          onUpdate({ contributions });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'contributions');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime contributions listener notice:', e);
    }

    // 3. Real-time Receipts Listener (Instant voucher display)
    try {
      const unsub = onSnapshot(
        collection(db, 'receipts'),
        (snap) => {
          const receipts: Receipt[] = parseSnapshot(snap, (d) => {
            const r = d.data();
            const rId = r?.receiptId || d.id;
            if (!rId) return null;
            return {
              receiptId: rId,
              transactionId: r?.transactionId || '',
              name: r?.name || r?.recipientName || '',
              phone: r?.phone || '',
              amount: Number(r?.amount || 0),
              purpose: r?.purpose || '',
              date: r?.date || '',
              receivedBy: r?.receivedBy || '',
              paymentMethod: r?.paymentMethod || 'cash',
              createdAt: r?.createdAt || '',
              type: r?.type || 'contribution',
              memberSystemId: r?.memberSystemId || '',
            } as Receipt;
          });
          onUpdate({ receipts });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'receipts');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime receipts listener notice:', e);
    }

    // 4. Real-time Transactions Listener
    try {
      const unsub = onSnapshot(
        collection(db, 'transactions'),
        (snap) => {
          const transactions: any[] = parseSnapshot(snap, (d) => {
            const t = d.data();
            return t?.transactionId ? t : { ...t, transactionId: d.id };
          });
          onUpdate({ transactions });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'transactions');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime transactions listener notice:', e);
    }

    // 5. Real-time Member Withdrawals Listener
    try {
      const unsub = onSnapshot(
        collection(db, 'member_withdrawals'),
        (snap) => {
          const withdrawals: MemberWithdrawal[] = parseSnapshot(snap, (d) => {
            const w = d.data();
            const wId = w?.withdrawalId || d.id;
            if (!wId) return null;
            return {
              withdrawalId: wId,
              memberSystemId: w?.memberSystemId || '',
              memberName: w?.memberName || '',
              amount: Number(w?.amount || 0),
              date: w?.date || '',
              paymentMethod: w?.paymentMethod || 'cash',
              status: w?.status || 'completed',
              source: w?.source || 'savings',
              createdAt: w?.createdAt || '',
              ...w,
            } as MemberWithdrawal;
          });
          onUpdate({ memberWithdrawals: withdrawals });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'member_withdrawals');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime withdrawals listener notice:', e);
    }

    // 6. Real-time Organization Settings Listener (Instant meeting time & config sync)
    try {
      const unsub = onSnapshot(
        doc(db, 'settings', 'app_settings'),
        (snap) => {
          if (!snap.exists()) return;
          const sData = snap.data() as Record<string, any>;
          const resolvedTime = sData.generalMeetingTime || sData.meetingTime || sData.scheduledTime;
          if (resolvedTime) {
            sData.generalMeetingTime = String(resolvedTime).trim();
          }
          if (sData.updatedAt && !sData.meetingTimeUpdatedAt) {
            sData.meetingTimeUpdatedAt = String(sData.updatedAt);
          }
          onUpdate({ settings: sData as AppSettings });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'settings/app_settings');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime settings listener notice:', e);
    }

    // 7. Real-time General Meetings Listener (Instant scheduled meeting updates)
    try {
      const unsub = onSnapshot(
        collection(db, 'meetings'),
        (snap) => {
          const meetings: GeneralMeeting[] = parseSnapshot(snap, (d) => {
            const m = d.data();
            const mId = m?.meetingId || d.id;
            if (!mId) return null;
            return {
              ...m,
              meetingId: mId,
            } as GeneralMeeting;
          });
          if (meetings.length > 0) {
            onUpdate({ meetings });
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'meetings');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime meetings listener notice:', e);
    }

    // 8. Real-time Society Rules Listener (Instant resolutions & bylaws sync)
    try {
      const unsub = onSnapshot(
        collection(db, 'rules'),
        (snap) => {
          const rules: SocietyRule[] = parseSnapshot(snap, (d) => {
            const r = d.data();
            const rId = r?.ruleId || d.id;
            if (!rId) return null;
            return {
              ...r,
              ruleId: rId,
            } as SocietyRule;
          });
          if (rules.length > 0) {
            onUpdate({ rules });
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'rules');
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Realtime rules listener notice:', e);
    }

    // Return cleanup unsubscribe function
    return () => {
      unsubscribes.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
    };
  }
}
