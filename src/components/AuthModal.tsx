import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount, Language } from '../types';
import { StorageService, normalizePhoneNumber, MAIN_ADMIN_EMAIL } from '../lib/storage';
import {
  googleSignIn,
  formatFirebaseAuthError,
} from '../lib/firebase';
import { FirebaseSyncService } from '../lib/firebaseSync';
import {
  LogIn,
  UserPlus,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Key,
  Shield,
  X,
  ArrowRight,
  UserCheck,
  Sparkles,
} from 'lucide-react';

export type AuthMode = 'login' | 'register' | 'member_login' | 'admin_login';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
  language: Language;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  language,
}) => {
  // Main tabs: Login and Registration
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    initialMode === 'register' ? 'register' : 'login'
  );

  // 1. Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // 2. Member Registration State
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regLiveCheck, setRegLiveCheck] = useState<{
    found: boolean;
    memberName?: string;
    memberId?: string;
    alreadyRegistered?: boolean;
    message?: string;
  } | null>(null);

  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode === 'register' ? 'register' : 'login');
      setErrorMsg(null);
      setSuccessMsg(null);
      setLoginIdentifier('');
      setLoginPassword('');
      setRegPhone('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegLiveCheck(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialMode]);

  // Real-time detection of input type in the unified Login section
  const trimmedId = loginIdentifier.trim();
  const isEmailInput = trimmedId.includes('@');
  const cleanDigits = trimmedId.replace(/\D/g, '');

  // Look up matching member for account number (e.g. SYS-000001) or phone number
  const matchingMemberForLogin = useMemo(() => {
    if (!trimmedId || isEmailInput) return null;
    const members = StorageService.getMembers();
    const cleanPhone = normalizePhoneNumber(trimmedId);
    const lowerInput = trimmedId.toLowerCase();
    const cleanDigitsInput = trimmedId.replace(/\D/g, '');

    return (
      members.find((m) => {
        const mSysLower = (m.systemId || '').toLowerCase();
        const mSysDigits = (m.systemId || '').replace(/\D/g, '');
        const mPhone = normalizePhoneNumber(m.phone || '');

        if (cleanPhone.length >= 8 && (mPhone === cleanPhone || mPhone.endsWith(cleanPhone.slice(-10)) || cleanPhone.endsWith(mPhone.slice(-10)))) return true;
        if (mSysLower === lowerInput) return true;
        if (lowerInput.startsWith('sys') && cleanDigitsInput.length > 0 && mSysDigits === cleanDigitsInput) return true;
        if (cleanDigitsInput.length >= 3 && mSysDigits.endsWith(cleanDigitsInput)) return true;
        return false;
      }) || null
    );
  }, [trimmedId, isEmailInput]);

  const isMemberInput = !isEmailInput && (Boolean(matchingMemberForLogin) || cleanDigits.length >= 3);
  const isPhoneInput = isMemberInput;

  // Live member lookup as user enters phone number in registration
  useEffect(() => {
    const clean = normalizePhoneNumber(regPhone);
    if (clean.length >= 10) {
      const check = StorageService.checkMemberRegistryByPhone(clean);
      if (check.found && check.member) {
        setRegLiveCheck({
          found: true,
          memberName: check.member.name,
          memberId: check.member.systemId,
          alreadyRegistered: check.alreadyRegistered,
          message: check.message,
        });
      } else {
        setRegLiveCheck({
          found: false,
          message:
            language === 'bn'
              ? '⚠️ এই নম্বরটি সমিতির সদস্য তালিকায় পাওয়া যায়নি। একাউন্ট খুলতে আপনার নম্বরটি সদস্য তালিকায় নিবন্ধিত থাকতে হবে।'
              : '⚠️ This phone number is not listed in the society member registry.',
        });
      }
    } else {
      setRegLiveCheck(null);
    }
  }, [regPhone, language]);

  if (!isOpen) return null;

  // Handle Unified Direct Login Submit (NO SMS OTP, NO CAPTCHA)
  // Phone number / Member account number -> logs directly into Member account
  // Gmail address -> logs into Admin account with admin password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const inputVal = loginIdentifier.trim();
    const passVal = loginPassword.trim();

    if (!inputVal) {
      setErrorMsg(
        language === 'bn'
          ? 'অনুগ্রহ করে আপনার মোবাইল নম্বর (সদস্য) অথবা জিমেইল (অ্যাডমিন) লিখুন।'
          : 'Please enter your phone number (Member) or Gmail (Admin).'
      );
      return;
    }

    setIsSubmitting(true);

    // 1. If input contains '@', treat as Gmail / Admin login
    if (inputVal.includes('@')) {
      if (!passVal) {
        setIsSubmitting(false);
        setErrorMsg(
          language === 'bn'
            ? 'অ্যাডমিন হিসেবে লগইন করার জন্য পাসওয়ার্ড প্রদান করা আবশ্যক।'
            : 'Password is required to log in as Admin.'
        );
        return;
      }

      const cleanEmail = inputVal.toLowerCase();
      const result = StorageService.loginWithCredentials(cleanEmail, passVal);
      setIsSubmitting(false);

      if (result.success && result.user) {
        setSuccessMsg(
          language === 'bn'
            ? `অ্যাডমিন হিসেবে সফলভাবে প্রবেশ করেছেন (${result.user.displayName || result.user.name})!`
            : `Logged in as Admin (${result.user.displayName || result.user.name})!`
        );
        setTimeout(() => {
          onSuccess(result.user!);
          onClose();
        }, 400);
      } else {
        setErrorMsg(result.message);
      }
      return;
    }

    // 2. Member direct login via Phone Number or Member ID (SYS-000001)
    // No SMS OTP and No CAPTCHA required!
    let effectiveIdentifier = matchingMemberForLogin?.systemId || inputVal;
    let result = StorageService.loginWithCredentials(effectiveIdentifier, passVal);

    if (!result.success) {
      // Cross-origin fallback (e.g. GitHub Pages on first load before background cloud sync completes):
      // Directly check Firestore for this member record
      try {
        const cloudMember = await FirebaseSyncService.fetchMemberDirectly(inputVal);
        if (cloudMember) {
          const localMembers = StorageService.getMembers();
          if (!localMembers.some((m) => m.systemId === cloudMember.systemId)) {
            localMembers.push(cloudMember);
            StorageService.saveMembers(localMembers);
          }
          effectiveIdentifier = cloudMember.systemId;
          result = StorageService.loginWithCredentials(effectiveIdentifier, passVal);
        }
      } catch (fetchErr) {
        console.warn('Direct member Firestore login attempt notice:', fetchErr);
      }
    }

    setIsSubmitting(false);

    if (result.success && result.user) {
      setSuccessMsg(
        language === 'bn'
          ? `স্বাগতম ${result.user.name || result.user.displayName}! সদস্য পোর্টালে সফলভাবে প্রবেশ করেছেন।`
          : `Welcome ${result.user.name || result.user.displayName}! Logged in successfully.`
      );
      setTimeout(() => {
        onSuccess(result.user!);
        onClose();
      }, 400);
    } else {
      setErrorMsg(result.message);
    }
  };

  // Handle Member Registration Submit (Direct registration without SMS OTP or CAPTCHA)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanPhone = normalizePhoneNumber(regPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg(
        language === 'bn'
          ? 'অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন।'
          : 'Please enter a valid phone number (at least 10-11 digits).'
      );
      return;
    }

    if (regPassword.trim().length < 4) {
      setErrorMsg(
        language === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।'
          : 'Password must be at least 4 characters.'
      );
      return;
    }

    if (regPassword.trim() !== regConfirmPassword.trim()) {
      setErrorMsg(
        language === 'bn'
          ? 'নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।'
          : 'Passwords do not match.'
      );
      return;
    }

    setIsSubmitting(true);

    // 1. Verify member exists in registry
    const check = StorageService.checkMemberRegistryByPhone(cleanPhone);
    if (!check.found || !check.member) {
      setIsSubmitting(false);
      setErrorMsg(
        check.message ||
          (language === 'bn'
            ? 'এই মোবাইল নম্বরটি সমিতির সদস্য তালিকায় পাওয়া যায়নি।'
            : 'Phone number not in registry.')
      );
      return;
    }

    try {
      // Register directly in local registry and user account
      const localResult = StorageService.registerMemberWithPhone(cleanPhone, regPassword.trim());
      setIsSubmitting(false);

      if (localResult.success && localResult.user) {
        setSuccessMsg(
          language === 'bn'
            ? `অভিনন্দন ${check.member.name}! আপনার সদস্য অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।`
            : `Congratulations ${check.member.name}! Your account has been registered successfully.`
        );
        setTimeout(() => {
          onSuccess(localResult.user!);
          onClose();
        }, 500);
      } else {
        setErrorMsg(localResult.message);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'নিবন্ধন প্রক্রিয়ায় সমস্যা হয়েছে।');
    }
  };

  // Handle Google Sign In for Admin
  const handleGoogleSignInClick = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        const designatedUser = StorageService.loginAdminWithFirebase(res.user);
        setSuccessMsg(
          language === 'bn'
            ? `${designatedUser.role === 'admin' ? 'অ্যাডমিন' : 'সদস্য'} হিসেবে সফলভাবে প্রবেশ করেছেন (${designatedUser.email || designatedUser.displayName})!`
            : `Signed in as ${designatedUser.role} with Google (${designatedUser.email || designatedUser.displayName})!`
        );
        setTimeout(() => {
          onSuccess(designatedUser);
          onClose();
        }, 500);
      }
    } catch (err: any) {
      if (err?.message === 'POPUP_BLOCKED') {
        setErrorMsg(
          language === 'bn'
            ? 'ব্রাউজারে পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে পপআপ অনুমোদন দিন অথবা নিচে মোবাইল/জিমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।'
            : 'Popup blocked. Please allow popups or use Phone/Gmail login below.'
        );
      } else {
        setErrorMsg(formatFirebaseAuthError(err, language));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-xs">
              🕉️
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {language === 'bn' ? 'পাকুড়া সনাতন যুব সংঘ' : 'Pakura Sanatan Sangha'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeTab === 'login'
                  ? language === 'bn'
                    ? 'সরাসরি লগইন (মোবাইল নম্বর: সদস্য • জিমেইল: অ্যাডমিন)'
                    : 'Direct Login (Phone: Member • Gmail: Admin)'
                  : language === 'bn'
                  ? 'নতুন সদস্য অ্যাকাউন্ট নিবন্ধন'
                  : 'New Member Account Registration'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Two Main Options: Login and Registration */}
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0 text-center">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg(null);
            }}
            className={`py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
            }`}
          >
            <LogIn className="w-4 h-4 text-amber-500" />
            <span>{language === 'bn' ? 'লগইন (Login)' : 'Login'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg(null);
            }}
            className={`py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
            }`}
          >
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>{language === 'bn' ? 'রেজিস্ট্রেশন (Registration)' : 'Registration'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* OPTION 1: LOGIN SECTION */}
          {/* Phone number logs into Member account without SMS OTP or CAPTCHA */}
          {/* Gmail address logs into Admin account */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Informative Guidance Card */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50/80 via-emerald-50/50 to-indigo-50/50 dark:from-amber-950/30 dark:via-emerald-950/20 dark:to-indigo-950/20 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2">
                  <div className="p-1 rounded-md bg-amber-500 text-white shrink-0 mt-0.5">
                    <LogIn className="w-3 h-3" />
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white block font-bold">
                      {language === 'bn' ? 'সরাসরি প্রবেশ সুবিধা:' : 'Direct Login Access:'}
                    </strong>
                    <div className="mt-1 space-y-0.5 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{language === 'bn' ? 'মোবাইল নম্বর লিখলেই সদস্য অ্যাকাউন্টে প্রবেশ হবে।' : 'Phone number logs into Membre account.'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                        <Mail className="w-3 h-3 text-indigo-600" />
                        <span>{language === 'bn' ? 'জিমেইল লিখলে অ্যাডমিন অ্যাকাউন্টে প্রবেশ হবে।' : 'Gmail address logs into Admin account.'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Identifier Input (Phone or Gmail) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'মোবাইল নম্বর অথবা জিমেইল (Phone or Gmail):' : 'Phone Number or Gmail Address:'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={
                      language === 'bn'
                        ? 'মোবাইল নম্বর বা সদস্য আইডি/জিমেইল'
                        : 'Phone number or Member ID / Gmail'
                    }
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                  {isEmailInput ? (
                    <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 transition-colors" />
                  ) : isPhoneInput ? (
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 transition-colors" />
                  ) : (
                    <LogIn className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 transition-colors" />
                  )}
                </div>

                {/* Real-time Dynamic Detection Indicator */}
                <div className="mt-2">
                  {isEmailInput ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 animate-in fade-in">
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{language === 'bn' ? 'অ্যাডমিন অ্যাকাউন্ট শনাক্ত হয়েছে (Admin Account)' : 'Admin Account Detected'}</span>
                    </div>
                  ) : isPhoneInput ? (
                    <div className="p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          <span>
                            {matchingMemberForLogin
                              ? `${matchingMemberForLogin.name}`
                              : language === 'bn' ? 'সদস্য একাউন্ট' : 'Member Account'}
                          </span>
                          {matchingMemberForLogin && (
                            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                              #{matchingMemberForLogin.systemId}
                            </span>
                          )}
                        </div>
                        {matchingMemberForLogin && (
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                            📱 {matchingMemberForLogin.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Password Input: Optional for Members, Required for Admin */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isEmailInput
                      ? (language === 'bn' ? 'অ্যাডমিন পাসওয়ার্ড (Admin Password):' : 'Admin Password:')
                      : (language === 'bn' ? 'পাসওয়ার্ড (ঐচ্ছিক / Optional):' : 'Password (Optional for Member):')}{' '}
                    {isEmailInput && <span className="text-red-500">*</span>}
                  </label>
                  {!isEmailInput && (
                    <span className="text-[10px] text-slate-400">
                      {language === 'bn' ? 'না থাকলে খালি রাখুন' : 'Leave blank if none'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required={isEmailInput}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={
                      isEmailInput
                        ? '••••••••'
                        : language === 'bn'
                        ? 'পাসওয়ার্ড থাকলে দিন, অন্যথায় খালি রেখে লগইন করুন'
                        : 'Enter password if set, or leave empty'
                    }
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {isEmailInput && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'bn'
                      ? 'অ্যাডমিন পাসওয়ার্ড (অথবা সেটিংসে আপনার নির্ধারিত পাসওয়ার্ড)'
                      : 'Admin password (or your custom password saved in settings)'}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] ${
                  isEmailInput
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-indigo-600/20'
                    : isPhoneInput
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-emerald-600/20'
                    : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-amber-500/20'
                }`}
              >
                {isSubmitting ? (
                  <span>{language === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Verifying...'}</span>
                ) : (
                  <>
                    {isEmailInput ? (
                      <Key className="w-4 h-4" />
                    ) : isPhoneInput ? (
                      <Phone className="w-4 h-4" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>
                      {isEmailInput
                        ? language === 'bn'
                          ? 'অ্যাডমিন হিসেবে লগইন করুন (Log In as Admin)'
                          : 'Log In as Admin'
                        : isPhoneInput
                        ? language === 'bn'
                          ? 'সদস্য হিসেবে সরাসরি প্রবেশ করুন'
                          : 'Log In as Member'
                        : language === 'bn'
                        ? 'প্রবেশ করুন (Log In)'
                        : 'Log In'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Google Sign-in Alternative for Admin */}
              {isEmailInput && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={isSubmitting}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{language === 'bn' ? 'গুগল সাইন-ইন দিয়ে অ্যাডমিন প্রবেশ' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}

              {/* Link to Registration */}
              <div className="text-center pt-1 text-xs text-slate-500">
                <span>{language === 'bn' ? 'নতুন সদস্য? ' : 'New member? '}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setErrorMsg(null);
                  }}
                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {language === 'bn' ? 'এখানে সদস্য অ্যাকাউন্ট নিবন্ধন করুন' : 'Register here'}
                </button>
              </div>
            </form>
          )}

          {/* OPTION 2: REGISTRATION SECTION (No SMS OTP, No CAPTCHA) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <div className="flex items-start gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">
                      {language === 'bn' ? 'সাধারণ সদস্য অ্যাকাউন্ট নিবন্ধন' : 'Member Registration'}
                    </strong>
                    <p className="mt-0.5 text-[11px] text-emerald-900/80 dark:text-emerald-300/80">
                      {language === 'bn'
                        ? 'সমিতির সদস্য তালিকায় থাকা আপনার মোবাইল নম্বরটি লিখুন এবং নিজের পছন্দের পাসওয়ার্ড সেট করে সরাসরি নিবন্ধন সম্পন্ন করুন।'
                        : 'Enter your registered mobile phone number, set a password, and register directly.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Phone Input with live verification */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'সদস্য তালিকায় থাকা মোবাইল নম্বর:' : 'Registered Phone Number:'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                {/* Real-time registry verification status */}
                {regLiveCheck && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                      regLiveCheck.found && !regLiveCheck.alreadyRegistered
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : regLiveCheck.alreadyRegistered
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    }`}
                  >
                    {regLiveCheck.found && !regLiveCheck.alreadyRegistered ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <div className="font-bold">✓ {regLiveCheck.memberName}</div>
                          <div className="text-[10px] opacity-90">
                            {language === 'bn' ? `সদস্য আইডি: ${regLiveCheck.memberId} - নিবন্ধন যোগ্য!` : `ID: ${regLiveCheck.memberId} - Verified!`}
                          </div>
                        </div>
                      </>
                    ) : regLiveCheck.alreadyRegistered ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <div>
                          <div className="font-bold">{regLiveCheck.memberName}</div>
                          <div className="text-[10px]">{regLiveCheck.message}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span className="text-[11px]">{regLiveCheck.message}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Password Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'পাসওয়ার্ড নির্ধারণ করুন:' : 'Set Password:'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="New Password"
                      className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন:' : 'Confirm Password:'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirm ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirm(!showRegConfirm)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showRegConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Registration */}
              <button
                type="submit"
                disabled={isSubmitting || (regLiveCheck?.found === false)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>{language === 'bn' ? 'অ্যাকাউন্ট তৈরি হচ্ছে...' : 'Registering...'}</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{language === 'bn' ? 'নিবন্ধন সম্পন্ন করুন (Complete Registration)' : 'Complete Registration'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Link back to Login */}
              <div className="text-center pt-2 text-xs text-slate-500">
                <span>{language === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে? ' : 'Already registered? '}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setErrorMsg(null);
                  }}
                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {language === 'bn' ? 'লগইন করুন (Login)' : 'Log In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
