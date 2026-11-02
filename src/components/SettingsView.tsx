import React, { useState } from 'react';
import { AppSettings, Language, UserAccount } from '../types';
import { getTranslation } from '../lib/translations';
import { StorageService } from '../lib/storage';
import { FirebaseSyncService } from '../lib/firebaseSync';
import {
  Settings,
  Save,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Lock,
  Key,
  Eye,
  EyeOff,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Clock,
  Coins,
  Cloud,
  Database,
  RefreshCw,
  Flame,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  currentUser: UserAccount;
  language: Language;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetDatabase: () => void;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  currentUser,
  language,
  onUpdateSettings,
  onResetDatabase,
  onExportJson,
  onImportJson,
}) => {
  const t = getTranslation(language);
  const [orgName, setOrgName] = useState(settings.societyName || 'পাকুড়া সনাতন যুব সংঘ');
  const [contributionAmount, setContributionAmount] = useState(settings.monthlyContributionAmount || 100);
  const [dueDay, setDueDay] = useState(settings.contributionDueDay || 10);
  const [lateFeeAmount, setLateFeeAmount] = useState(settings.lateFeeAmount || 10);
  const [maxWithdrawalPercentage, setMaxWithdrawalPercentage] = useState(settings.maxWithdrawalPercentage ?? 70);
  const [minReserveBalance, setMinReserveBalance] = useState(settings.minReserveBalance ?? 500);
  const [googleSheetId, setGoogleSheetId] = useState(settings.googleSheetId || '');
  const [googleAppsScriptUrl, setGoogleAppsScriptUrl] = useState(settings.googleAppsScriptUrl || '');
  const [autoSyncSheets, setAutoSyncSheets] = useState(settings.autoSyncSheets ?? true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmEmail, setResetConfirmEmail] = useState('');
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [firebaseSyncLoading, setFirebaseSyncLoading] = useState(false);
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Admin Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handleSubmitGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      societyName: orgName.trim(),
      monthlyContributionAmount: Number(contributionAmount),
      contributionDueDay: Number(dueDay),
      lateFeeAmount: Number(lateFeeAmount),
      maxWithdrawalPercentage: Number(maxWithdrawalPercentage),
      minReserveBalance: Number(minReserveBalance),
      googleSheetId: googleSheetId.trim(),
      googleAppsScriptUrl: googleAppsScriptUrl.trim(),
      autoSyncSheets,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError(
        language === 'bn' ? 'নতুন পাসওয়ার্ড দুটি মেলেনি!' : 'New passwords do not match!'
      );
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError(
        language === 'bn'
          ? 'পাসওয়ার্ড ন্যূনতম ৪ অক্ষরের হতে হবে।'
          : 'Password must be at least 4 characters long.'
      );
      return;
    }

    const res = StorageService.updateAdminPassword(currentPassword, newPassword, currentUser);
    if (!res.success) {
      setPasswordError(res.message);
    } else {
      setPasswordSuccess(
        language === 'bn'
          ? 'প্রধান অ্যাডমিনের পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!'
          : 'Admin password successfully updated!'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    }
  };

  const handleTriggerExport = () => {
    try {
      onExportJson();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch {
      // Export failed
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportStatus({
        type: 'error',
        message: language === 'bn' ? 'অনুগ্রহ করে একটি বৈধ .json ব্যাকআপ ফাইল নির্বাচন করুন।' : 'Please select a valid .json backup file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || !text.trim()) {
          throw new Error('Empty file');
        }
        JSON.parse(text); // Validate JSON format
        onImportJson(text);
        setImportStatus({
          type: 'success',
          message: language === 'bn' ? 'ডাটাবেজ ব্যাকআপ সফলভাবে পুনরুদ্ধার (Restore) করা হয়েছে!' : 'Database restored from backup successfully!',
        });
        setTimeout(() => setImportStatus(null), 4500);
      } catch {
        setImportStatus({
          type: 'error',
          message: language === 'bn' ? 'অবৈধ JSON ব্যাকআপ ফাইল। ফাইলটি সঠিক ফরম্যাটের নয়।' : 'Invalid JSON backup file. Unable to parse.',
        });
      }
    };
    reader.onerror = () => {
      setImportStatus({
        type: 'error',
        message: language === 'bn' ? 'ফাইল পড়তে সমস্যা হয়েছে।' : 'Error reading file.',
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSyncToFirestore = async () => {
    setFirebaseSyncLoading(true);
    setFirebaseSyncStatus(null);
    try {
      const fullBackup = StorageService.exportFullBackup();
      const res = await FirebaseSyncService.syncAllToFirestore(fullBackup);
      if (res.success) {
        setFirebaseSyncStatus({
          type: 'success',
          message:
            language === 'bn'
              ? 'ফায়ারবেস ক্লাউড ডাটাবেসে সফলভাবে সকল তথ্য সংরক্ষিত হয়েছে (All records synced to Firestore)!'
              : 'All records successfully synchronized to Firebase Cloud Firestore!',
        });
      } else {
        setFirebaseSyncStatus({
          type: 'error',
          message: res.message,
        });
      }
    } catch (err: any) {
      setFirebaseSyncStatus({
        type: 'error',
        message: err?.message || 'Firebase Cloud Sync Error',
      });
    } finally {
      setFirebaseSyncLoading(false);
      setTimeout(() => setFirebaseSyncStatus(null), 6000);
    }
  };

  const handlePullFromFirestore = async () => {
    setFirebaseSyncLoading(true);
    setFirebaseSyncStatus(null);
    try {
      const cloudData = await FirebaseSyncService.loadAllFromFirestore();
      const memberCount = cloudData.members?.length || 0;
      const contribCount = cloudData.contributions?.length || 0;
      if (memberCount > 0 || contribCount > 0) {
        setFirebaseSyncStatus({
          type: 'success',
          message:
            language === 'bn'
              ? `ফায়ারবেস ক্লাউড থেকে ${memberCount} জন সদস্য ও ${contribCount} টি জমার তথ্য সফলভাবে যাচাই ও লোড করা হয়েছে!`
              : `Retrieved ${memberCount} members and ${contribCount} contributions from Firebase Firestore!`,
        });
      } else {
        setFirebaseSyncStatus({
          type: 'success',
          message:
            language === 'bn'
              ? 'ফায়ারবেস ক্লাউড ডাটাবেস সক্রিয় ও সফলভাবে সংযুক্ত রয়েছে।'
              : 'Firebase Cloud Firestore is online, connected, and active.',
        });
      }
    } catch (err: any) {
      setFirebaseSyncStatus({
        type: 'error',
        message: err?.message || 'Error pulling from Firestore',
      });
    } finally {
      setFirebaseSyncLoading(false);
      setTimeout(() => setFirebaseSyncStatus(null), 6000);
    }
  };

  const handleConfirmFullReset = () => {
    const trimmed = resetConfirmEmail.trim().toLowerCase();
    const validEmails = [
      'freelancerkajolchandradas@gmail.com',
      (currentUser.email || '').trim().toLowerCase(),
    ].filter(Boolean);

    const isMatch = validEmails.some((email) => email === trimmed);

    if (!isMatch) {
      setResetEmailError(
        language === 'bn'
          ? 'ভুল জিমেইল ঠিকানা! রিসেট সম্পন্ন করতে অনুমোদিত অ্যাডমিন জিমেইল লিখুন (e.g., freelancerkajolchandradas@gmail.com)।'
          : 'Invalid Gmail address! Please enter authorized admin Gmail (e.g., freelancerkajolchandradas@gmail.com).'
      );
      return;
    }

    setShowResetConfirm(false);
    setResetConfirmEmail('');
    setResetEmailError(null);
    onResetDatabase();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          <span>{t.navSettings}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {language === 'bn'
            ? 'সংগঠনের নীতিমালা, অ্যাডমিন পাসওয়ার্ড পরিবর্তন ও অটোমেটিক ক্লাউড সিঙ্ক পরিচালনা'
            : 'Organization rules, super admin password management & cloud synchronization'}
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{language === 'bn' ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে!' : 'Settings saved successfully!'}</span>
        </div>
      )}

      {/* 1. Admin Password Security Section (Requested by User) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700/60 shadow-xs relative overflow-hidden">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {language === 'bn' ? 'প্রধান অ্যাডমিনের পাসওয়ার্ড পরিবর্তন' : 'Change Main Admin Password'}
          </h3>
          <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
            {language === 'bn' ? 'প্রধান সুপার অ্যাডমিন' : 'Main Super Admin'}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {language === 'bn'
            ? 'উন্মুক্ত নিবন্ধন বন্ধ। সাধারণ ব্যবহারকারীদের জন্য ড্যাশবোর্ডটি শুধু দেখার জন্য (View-Only)। শুধুমাত্র প্রধান অ্যাডমিনের ইমেইল (freelancerkajolchandradas@gmail.com) ও পাসওয়ার্ড দিয়ে লগইন করে পরিচালনা করা যাবে। প্রধান অ্যাডমিনের অন্যান্য অ্যাডমিন অপসারণের একক কর্তৃত্ব রয়েছে।'
            : 'Open registration is disabled. Users have view-only access to the dashboard. Only the main admin can log in and has authority to delete other admins.'}
        </p>

        {passwordError && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-4 space-y-3 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'বর্তমান পাসওয়ার্ড (Current Password)' : 'Current Password'}
            </label>
            <div className="relative">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'নতুন পাসওয়ার্ড (New Password)' : 'New Password'}
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 pr-10 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন (Confirm)' : 'Confirm Password'}
              </label>
              <input
                type={showNewPass ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 shadow-xs transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>{language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন সম্পন্ন করুন' : 'Update Admin Password'}</span>
          </button>
        </form>
      </div>

      {/* 2. Main Financial, Penalty Policy & Google Sheets Rules Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{language === 'bn' ? 'সংগঠন ও ক্লাউড সিঙ্ক সেটিংস (Organisation & Cloud Sync)' : 'Organisation & Cloud Sync Settings'}</span>
          </h3>
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
            {language === 'bn' ? 'আর্থিক নীতিমালা ও ক্লাউড সিঙ্ক' : 'Financial Policy & Cloud Sync'}
          </span>
        </div>

        <form onSubmit={handleSubmitGeneral} className="mt-4 space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'bn' ? 'সংগঠনের পূর্ণ নাম' : 'Organization Name'}
            </label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
            />
          </div>

          {/* Monthly Savings, Due Date & Missed Deadline Penalty (Late Fee) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'মাসিক সঞ্চয় চাঁদা (৳)' : 'Monthly Savings (৳)'}
              </label>
              <input
                type="number"
                required
                min="10"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'bn' ? 'প্রতি সদস্যের নিয়মিত চাঁদা' : 'Per member monthly'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'জমার শেষ তারিখ (Due Day)' : 'Payment Due Day'}
              </label>
              <input
                type="number"
                required
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'bn' ? 'প্রতি ইংরেজি মাসের শেষ সময়' : 'Monthly deadline day'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
                {language === 'bn' ? 'বিলম্ব জরিমানা ফি (৳)' : 'Late Penalty Fee (৳)'}
              </label>
              <input
                type="number"
                required
                min="0"
                value={lateFeeAmount}
                onChange={(e) => setLateFeeAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-red-200 dark:border-red-900/60 text-slate-900 dark:text-white font-bold"
              />
              <span className="text-[10px] text-red-500/90 dark:text-red-400 mt-0.5 block">
                {language === 'bn' ? 'সময়সীমা পার হলে জরিমানা' : 'Missed deadline penalty'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                {language === 'bn' ? 'সদস্য সর্বোচ্চ তহবিল উত্তোলন সীমা (%)' : 'Max Member Fund Withdrawal Limit (%)'}
              </label>
              <input
                type="number"
                required
                min="10"
                max="100"
                value={maxWithdrawalPercentage}
                onChange={(e) => setMaxWithdrawalPercentage(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 text-slate-900 dark:text-white font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'bn' ? 'সদস্যের মোট তহবিলের সর্বোচ্চ শতকরা উত্তোলন' : 'Max % a member can withdraw'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'ন্যূনতম সংরক্ষিত রিজার্ভ তহবিল (৳)' : 'Minimum Reserve Retained (৳)'}
              </label>
              <input
                type="number"
                required
                min="0"
                value={minReserveBalance}
                onChange={(e) => setMinReserveBalance(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'bn' ? 'উত্তোলনের পরও অ্যাকাউন্টে ন্যূনতম অবশিষ্ট' : 'Min balance that must remain'}
              </span>
            </div>
          </div>

          {/* Google Sheets Backup Sync Controls */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{language === 'bn' ? 'গুগল শিট ক্লাউড ব্যাকআপ সিঙ্ক কনফিগারেশন' : 'Google Sheets Cloud Backup Sync Configuration'}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'bn'
                  ? 'ফায়ারবেস সম্পূর্ণ লাইভ ডাটাবেজ হিসেবে কাজ করে এবং গুগল শিট স্বয়ংক্রিয় ব্যাকআপ ভল্ট হিসেবে ব্যবহৃত হয়।'
                  : 'Firebase operates as the live primary database; Google Sheets serves as the automated cloud backup vault.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'সংযুক্ত গুগল শিট আইডি বা ইউআরএল (Google Sheet ID / URL)' : 'Google Sheet ID or URL'}
              </label>
              <input
                type="text"
                value={googleSheetId}
                onChange={(e) => setGoogleSheetId(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'গুগল অ্যাপস স্ক্রিপ্ট ওয়েবহুক ইউআরএল (ঐচ্ছিক - 100% নির্ভরযোগ্য অটো-সিঙ্ক)' : 'Google Apps Script Web App URL (Optional)'}
              </label>
              <input
                type="text"
                value={googleAppsScriptUrl}
                onChange={(e) => setGoogleAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoSyncCheck"
                checked={autoSyncSheets}
                onChange={(e) => setAutoSyncSheets(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <label htmlFor="autoSyncCheck" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                {language === 'bn'
                  ? 'প্রতিটি লেনদেন ও তথ্য পরিবর্তনের সাথে সাথে স্বয়ংক্রিয়ভাবে গুগল শিটে সংরক্ষণ করুন (Auto-save)'
                  : 'Automatically save to Google Sheets whenever any change or transaction occurs'}
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 shadow-xs transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{t.saveSettings}</span>
          </button>
        </form>
      </div>

      {/* 3. Backup, Export & Reset Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? 'ডাটাবেজ ব্যাকআপ ও ব্যবস্থাপনা' : 'Data Backup & Reset'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'ক্লাউড ও লোকাল ব্যাকআপ ডাউনলোড, পূর্ববর্তী ব্যাকআপ রিস্টোর এবং প্রাথমিক ৳০ ডাটাবেজ রিসেট'
                : 'Download full JSON snapshots, restore system state, or reset to initial ৳0 clean state'}
            </p>
          </div>
        </div>

        {importStatus && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
              importStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}
          >
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
        )}

        {exportSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {language === 'bn'
                ? 'সম্পূর্ণ JSON ব্যাকআপ ফাইলটি আপনার ডিভাইসে সফলভাবে ডাউনলোড হয়েছে!'
                : 'Full JSON backup downloaded to your device successfully!'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{language === 'bn' ? 'সম্পূর্ণ ব্যাকআপ ডাউনলোড (JSON)' : 'Download Full Backup (JSON)'}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {language === 'bn'
                  ? 'সকল সদস্য, সঞ্চয়, ঋণ, লেনদেন খতিয়ান, রশিদ ও গঠনতন্ত্র ডাটা অফলাইন ব্যাকআপ ফাইলে ডাউনলোড করুন।'
                  : 'Download complete offline snapshot including members, ledger, receipts, rules and settings.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleTriggerExport}
              className="mt-3.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 self-start transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'bn' ? 'ডাউনলোড করুন (JSON)' : 'Download JSON'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>{language === 'bn' ? 'ব্যাকআপ থেকে পুনরুদ্ধার (Restore)' : 'Restore from Backup'}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {language === 'bn'
                  ? 'পূর্বে ডাউনলোড করা .json ব্যাকআপ ফাইল আপলোড করে পূর্ববর্তী সকল ডাটা পুনরুদ্ধার করুন।'
                  : 'Restore full system state instantly from an existing JSON backup snapshot.'}
              </p>
            </div>

            <label className="mt-3.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 self-start cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'bn' ? 'ফাইল নির্বাচন করে রিস্টোর করুন' : 'Choose File to Restore'}</span>
              <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Firebase Cloud Firestore Sync Card */}
        <div className="mt-4 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{language === 'bn' ? 'ফায়ারবেস ক্লাউড ফায়ারস্টোর লাইভ সিঙ্ক' : 'Firebase Cloud Firestore Live Sync'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    {language === 'bn' ? 'সংযুক্ত ও সক্রিয়' : 'Connected & Active'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 break-all">
                  DB ID: ai-studio-financemanagemen-81457425-0980-4771-905d-23c7a458e7e5
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSyncToFirestore}
                disabled={firebaseSyncLoading}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${firebaseSyncLoading ? 'animate-spin' : ''}`} />
                <span>{language === 'bn' ? 'ক্লাউডে সিঙ্ক করুন (Upload)' : 'Sync to Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={handlePullFromFirestore}
                disabled={firebaseSyncLoading}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-500 hover:text-amber-600 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Database className="w-3.5 h-3.5 text-amber-600" />
                <span>{language === 'bn' ? 'ক্লাউড থেকে যাচাই (Pull)' : 'Pull & Check'}</span>
              </button>
            </div>
          </div>

          {firebaseSyncStatus && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
                firebaseSyncStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              {firebaseSyncStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{firebaseSyncStatus.message}</span>
            </div>
          )}

          {/* GitHub Pages & Authorized Domains Status */}
          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200 space-y-1">
            <div className="font-bold flex items-center justify-between flex-wrap gap-1">
              <span>
                {language === 'bn' ? 'গুগল সাইন-ইন অথরাইজড ডোমেইন (GitHub Pages):' : 'Google Sign-In Authorized Domain (GitHub Pages):'}
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">
                pakura-sanatan-jubo-sangha.github.io
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              {language === 'bn'
                ? 'গুগল পপআপ সাইন-ইনের জন্য এই ডোমেইনটি ফায়ারবেস কনসোলে (Authentication -> Settings -> Authorized domains) যুক্ত করুন। তবে সরাসরি ইমেইল/পাসওয়ার্ড ও মোবাইল লগইন যে কোনো ডোমেইনে এখনই সম্পূর্ণ সক্রিয়।'
                : 'For Google popup Sign-In, add this domain under Firebase Console (Authentication -> Settings -> Authorized domains). Direct Gmail/Password and Mobile login work immediately on all domains.'}
            </p>
          </div>
        </div>

        {/* Factory Reset to Initial ৳0 */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'ডাটাবেজ প্রাথমিক অবস্থায় রিসেট (৳০)' : 'Reset Database to Initial (৳0)'}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'সমস্ত আর্থিক লেনদেন, ঋণ ও সঞ্চয় মুছে দিয়ে তহবিল ৳০-তে রিসেট হবে। তবে আপনার সদস্য তালিকা অক্ষত ও বহাল থাকবে এবং ফায়ারবেসে সংরক্ষিত থাকবে।'
                : 'Resets all financial balances to ৳0 clean slate. Your member roster remains completely intact and saved in Firebase.'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowResetConfirm(true);
              setResetConfirmEmail('');
              setResetEmailError(null);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800 transition-all cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
          >
            {language === 'bn' ? 'রিসেট করুন (Reset ৳0)' : 'Reset Database (৳0)'}
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'ডাটাবেজ প্রাথমিক অবস্থায় রিসেট (৳০)' : 'Reset Database to Initial (৳0)'}
                </h3>
                <span className="text-[11px] text-red-500 font-semibold block">
                  {language === 'bn' ? 'সদস্য তালিকা অক্ষত রেখে আর্থিক হিসাব ৳০ রিসেট' : 'Resets Financials to ৳0 (Members Intact)'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-xs text-red-700 dark:text-red-300 leading-relaxed mt-3">
              {language === 'bn'
                ? 'ডাটাবেজ রিসেটের ফলে সমস্ত আর্থিক লেনদেন, ঋণ ও সঞ্চয় জমা কিস্তির হিসাব মুছে ৳০-তে রিসেট হবে। তবে আপনার সকল সদস্য তালিকা সম্পূর্ণ অক্ষত ও বহাল থাকবে এবং ফায়ারবেসে স্থায়ীভাবে সংরক্ষিত থাকবে। আপনি নিজে ম্যানুয়ালি এন্ট্রি না করা পর্যন্ত কোনো ফান্ড যুক্ত হবে না।'
                : 'Resetting the database sets all financial balances to ৳0. Your entire member list remains completely intact and permanently saved in Firebase. No funds will be added until you manually enter them.'}
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                {language === 'bn'
                  ? 'নিশ্চিত করতে আপনার অনুমোদিত জিমেইল লিখুন:'
                  : 'Enter your authorized Gmail address to confirm:'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={resetConfirmEmail}
                  onChange={(e) => {
                    setResetConfirmEmail(e.target.value);
                    setResetEmailError(null);
                  }}
                  placeholder="freelancerkajolchandradas@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 font-mono"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'bn'
                  ? 'নিশ্চিতকরণ জিমেইল: freelancerkajolchandradas@gmail.com'
                  : 'Authorized Admin Gmail: freelancerkajolchandradas@gmail.com'}
              </p>

              {resetEmailError && (
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5 font-medium animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{resetEmailError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmEmail('');
                  setResetEmailError(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmFullReset}
                disabled={!resetConfirmEmail.trim()}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                  resetConfirmEmail.trim()
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{t.confirmFullReset || (language === 'bn' ? 'সম্পূর্ণ রিসেট নিশ্চিত করুন' : 'Confirm Full Reset')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
