/**
 * ==============================================================================
 * Firebase Configuration for Pakura Sonatan Jubo Songho
 * ==============================================================================
 * 
 * INSTRUCTIONS FOR CPANEL / APACHE / PRODUCTION DEPLOYMENT:
 * 
 * 1. You can paste your Firebase Web App credentials directly into this file below,
 *    OR provide them via Vite environment variables (.env / .env.production).
 * 
 * 2. To get your Firebase keys:
 *    - Open Firebase Console: https://console.firebase.google.com/
 *    - Select your project -> Project Overview (gear icon) -> Project settings
 *    - Under "Your apps", select your Web App (</>)
 *    - Copy the configuration values into the corresponding fields below.
 * 
 * 3. In Firebase Console -> Authentication -> Settings -> Authorized Domains:
 *    - Add your cPanel website domain (e.g. yourdomain.com, www.yourdomain.com).
 *    - This is required for Google Sign-In and Phone Auth to work on your live domain.
 * ==============================================================================
 */

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

// Fallback configuration loaded from project configuration file if present
import appletConfig from '../../firebase-applet-config.json';

const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

export const firebaseConfig: FirebaseConfigType = {
  // Replace these with your manual Firebase API keys if needed:
  apiKey: env.VITE_FIREBASE_API_KEY || (appletConfig as any)?.apiKey || "AIzaSyBODcCxHFeEhHAI2vOZBgee9_qafOpoESY",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (appletConfig as any)?.authDomain || "gen-lang-client-0582819547.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || (appletConfig as any)?.projectId || "gen-lang-client-0582819547",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (appletConfig as any)?.storageBucket || "gen-lang-client-0582819547.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || (appletConfig as any)?.messagingSenderId || "788010361043",
  appId: env.VITE_FIREBASE_APP_ID || (appletConfig as any)?.appId || "1:788010361043:web:2a67411577a37a1c39b426",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || (appletConfig as any)?.measurementId || "",
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || (appletConfig as any)?.firestoreDatabaseId || "ai-studio-financemanagemen-81457425-0980-4771-905d-23c7a458e7e5",
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || (appletConfig as any)?.oAuthClientId || "788010361043-qvkf9l3fulsmj2n5n4cfcmgrk4okvnvp.apps.googleusercontent.com",
  recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_KEY || (appletConfig as any)?.recaptchaSiteKey || "",
};

export default firebaseConfig;
