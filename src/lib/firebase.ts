import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  PhoneAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
} from 'firebase/firestore';
import firebaseConfig from './firebaseConfig';
import { UserAccount } from '../types';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('[Handled Firestore Notice]', JSON.stringify(errInfo));
  return errInfo;
}

const provider = new GoogleAuthProvider();
// Workspace Scopes for Google Sheets and Drive files
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize cached access token from sessionStorage if available
try {
  if (typeof window !== 'undefined') {
    cachedAccessToken = sessionStorage.getItem('psys_google_access_token');
  }
} catch {
  // Ignore sessionStorage restriction
}

// Global window event listeners to prevent unhandled promise assertion crashes from Firebase Auth popup internals and reCAPTCHA
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const errorStr = String(event.message || event.error?.message || '');
    if (
      errorStr.includes('Pending promise was never set') ||
      errorStr.includes('cancelled-popup-request') ||
      errorStr.includes('popup-blocked') ||
      errorStr.includes('popup-closed-by-user') ||
      errorStr.includes('reCAPTCHA') ||
      errorStr.includes('grecaptcha') ||
      errorStr.includes('recaptcha')
    ) {
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      console.warn('Absorbed error event:', errorStr);
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const errorStr = String(event.reason?.message || event.reason || '');
    if (
      errorStr.includes('Pending promise was never set') ||
      errorStr.includes('cancelled-popup-request') ||
      errorStr.includes('popup-blocked') ||
      errorStr.includes('popup-closed-by-user') ||
      errorStr.includes('reCAPTCHA') ||
      errorStr.includes('grecaptcha') ||
      errorStr.includes('recaptcha') ||
      errorStr.includes('Quota exceeded') ||
      errorStr.includes('auth/') ||
      errorStr.includes('permission-denied') ||
      errorStr.includes('Missing or insufficient permissions') ||
      errorStr.includes('Failed to get document') ||
      errorStr.includes('failed to fetch') ||
      errorStr.includes('Firestore') ||
      errorStr.includes('Network') ||
      errorStr.includes('network')
    ) {
      event.preventDefault();
      console.warn('Safely handled background promise notice:', errorStr);
    }
  });
}

// Format readable Firebase Auth Error Messages in Bengali & English
export const formatFirebaseAuthError = (error: any, lang: 'bn' | 'en' = 'bn'): string => {
  const code = error?.code || '';
  const msg = error?.message || '';

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return lang === 'bn'
      ? 'ভুল ইমেইল বা পাসওয়ার্ড। অনুগ্রহ করে সঠিক তথ্য দিন।'
      : 'Invalid email or password. Please verify your credentials.';
  }
  if (code === 'auth/email-already-in-use') {
    return lang === 'bn'
      ? 'এই ইমেইলটি ইতিমধ্যে নিবন্ধিত রয়েছে। লগইন করার চেষ্টা করুন।'
      : 'This email is already in use. Please sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return lang === 'bn'
      ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
      : 'Password should be at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return lang === 'bn'
      ? 'সঠিক ইমেইল ঠিকানা দিন (যেমন: admin@gmail.com)।'
      : 'Please enter a valid email address.';
  }
  if (code === 'auth/popup-blocked') {
    return lang === 'bn'
      ? 'ব্রাউজারে পপআপ ব্লক করা আছে! অনুগ্রহ করে ব্রাউজার সেটিংসে গিয়ে পপআপ অনুমোদন করুন।'
      : 'Popup blocked by browser! Please allow popups for this site.';
  }
  if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
    return lang === 'bn'
      ? 'গুগল সাইন-ইন উইন্ডো বন্ধ করা হয়েছে।'
      : 'Google Sign-In window was closed or cancelled.';
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    return lang === 'bn'
      ? 'ফায়ারবেস অনুমোদিত ডোমেইন সংক্রান্ত নোটিশ: গুগল পপআপ ব্যবহারের জন্য pakura-sanatan-jubo-sangha.github.io ডোমেইনটি ফায়ারবেস কনসোলে (Authorized Domains) যুক্ত করুন। তবে আপনি নিচে সরাসরি জিমেইল (freelancerkajolchandradas@gmail.com) ও পাসওয়ার্ড দিয়ে এখনই নিশ্চিতভাবে লগইন করতে পারেন!'
      : 'Domain notice: pakura-sanatan-jubo-sangha.github.io must be added to Authorized Domains in Firebase Console for Google popup. However, you can log in right now directly using your Gmail and Admin Password below!';
  }
  if (
    code === 'auth/operation-not-allowed' ||
    msg.includes('operation-not-allowed') ||
    msg.includes('SMS unable to be sent') ||
    msg.includes('region enabled')
  ) {
    return lang === 'bn'
      ? 'ফায়ারবেস প্রকল্পে এই অঞ্চলের জন্য SMS সার্ভিস সক্রিয় করা নেই। ওটিপি SMS ছাড়াই নিচে পাসওয়ার্ড দিয়ে সরাসরি নিবন্ধন বা লগইন সম্পন্ন করতে পারেন।'
      : 'SMS service for this region is not enabled in Firebase Console. You can register or log in directly with your password below.';
  }

  return error?.message || (lang === 'bn' ? 'লগইন ব্যর্থ হয়েছে।' : 'Authentication failed.');
};

// Admin Login using Firebase Email/Password credentials (if enabled in Firebase project)
export const firebaseLoginWithEmailPassword = async (
  email: string,
  pass: string
): Promise<User | null> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return cred.user;
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed') {
      return null;
    }
    throw error;
  }
};

// Register / Create new Admin using Firebase Auth credentials (if enabled in Firebase project)
export const firebaseRegisterAdmin = async (
  email: string,
  pass: string,
  displayName: string = 'প্রধান অ্যাডমিন'
): Promise<User | null> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    try {
      await updateProfile(cred.user, { displayName });
    } catch {
      // Ignore profile update error
    }
    return cred.user;
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed') {
      return null;
    }
    throw error;
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token?: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await getAccessToken();
      if (onAuthSuccess) onAuthSuccess(user, token || undefined);
    } else {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem('psys_google_access_token');
      } catch {
        // Ignore
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  // Prevent concurrent or duplicate popup triggers which trigger Firebase internal assertion failure
  if (isSigningIn) {
    console.warn('Google sign-in is already in progress. Ignoring duplicate request.');
    return null;
  }

  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';

    if (token) {
      cachedAccessToken = token;
      try {
        sessionStorage.setItem('psys_google_access_token', token);
      } catch {
        // Ignore
      }
    }
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMsg = error?.message || '';

    if (errorCode === 'auth/popup-blocked') {
      throw new Error('POPUP_BLOCKED');
    }
    if (errorCode === 'auth/cancelled-popup-request' || errorCode === 'auth/popup-closed-by-user') {
      console.warn('Google sign-in popup closed or cancelled by user.');
      return null;
    }
    if (errorMsg.includes('Pending promise was never set')) {
      console.warn('Firebase internal assertion caught safely.');
      return null;
    }
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    // Settle mutex after a short delay
    setTimeout(() => {
      isSigningIn = false;
    }, 600);
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  try {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('psys_google_access_token');
      if (stored) {
        cachedAccessToken = stored;
        return stored;
      }
    }
  } catch {
    // Ignore
  }
  return null;
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('psys_google_access_token');
    }
  } catch {
    // Ignore
  }
};

export const firebaseLogout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out warning:', err);
  }
  clearCachedAccessToken();
};

// Aliases & Phone Auth
export const signInWithGoogle = googleSignIn;
export const signOutUser = firebaseLogout;
export const getCachedAccessToken = getAccessToken;
export { signInWithPhoneNumber, RecaptchaVerifier, PhoneAuthProvider };
export type { ConfirmationResult };
export { FirebaseSyncService } from './firebaseSync';


