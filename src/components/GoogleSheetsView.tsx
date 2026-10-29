import React, { useState } from 'react';
import { FullAppData, Language, UserAccount } from '../types';
import { getTranslation } from '../lib/translations';
import {
  GoogleSheetsService,
  syncDataToGoogleSheets,
  syncStepByStepToGoogleSheets,
  syncViaAppsScriptWebhook,
  getAppsScriptCodeTemplate,
  SHEET_NAMES,
} from '../lib/sheetsService';
import { StorageService } from '../lib/storage';
import { clearCachedAccessToken } from '../lib/firebase';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Link,
  PlusCircle,
  Layers,
  ShieldCheck,
  Code,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Database,
  Lock,
} from 'lucide-react';

interface GoogleSheetsViewProps {
  appData: FullAppData;
  currentUser: UserAccount;
  language: Language;
  onUpdateSpreadsheetId: (id: string) => void;
  onAddActivityLog: (action: string, details: string) => void;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  appData,
  currentUser,
  language,
  onUpdateSpreadsheetId,
  onAddActivityLog,
}) => {
  const t = getTranslation(language);
  const [existingIdInput, setExistingIdInput] = useState('');
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState(
    appData.settings.googleAppsScriptUrl || ''
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);

  // Step-by-step progress tracking
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(14);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [completedTabs, setCompletedTabs] = useState<string[]>([]);

  const spreadsheetId = appData.settings.googleSheetId;
  const lastSyncDate = appData.settings.lastSyncDate;
  const isAuthorizedSheetModifier =
    currentUser.email?.toLowerCase().trim() === 'freelancerkajolchandradas@gmail.com' ||
    (currentUser.role === 'admin' && currentUser.isMainAdmin === true);
  const isAdmin = isAuthorizedSheetModifier;

  // Step-by-step sync execution
  const handleStepByStepSync = async () => {
    if (!isAdmin) {
      setSyncError(
        language === 'bn'
          ? 'শুধুমাত্র প্রধান অ্যাডমিন গুগল শিটে ডাটা সংরক্ষণ করতে পারেন।'
          : 'Only the Super Admin can save data to Google Sheets.'
      );
      return;
    }

    if (!spreadsheetId && !appsScriptUrlInput.trim()) {
      setSyncError(
        language === 'bn'
          ? 'অনুগ্রহ করে প্রথমে গুগল শিট আইডি যুক্ত করুন অথবা নতুন শিট তৈরি করুন।'
          : 'Please connect a Google Sheet ID or create a new sheet first.'
      );
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setCurrentStep(1);
    setCompletedTabs([]);
    setStepMessage(
      language === 'bn'
        ? 'গুগল শিট সার্ভারের সাথে যোগাযোগ স্থাপন করা হচ্ছে...'
        : 'Connecting to Google Sheets server...'
    );

    try {
      // If Apps Script Webhook is configured, sync through that as well
      if (appsScriptUrlInput.trim()) {
        setStepMessage(
          language === 'bn'
            ? 'গুগল অ্যাপস স্ক্রিপ্ট ওয়েবহুকের মাধ্যমে দ্রুত সেভ করা হচ্ছে...'
            : 'Saving instantly via Google Apps Script Webhook...'
        );
        await syncViaAppsScriptWebhook(appsScriptUrlInput.trim(), appData);
      }

      // If Google Spreadsheet ID is configured, perform full 14-step direct update
      if (spreadsheetId) {
        await GoogleSheetsService.syncStepByStep(
          spreadsheetId,
          appData,
          (step, total, msg) => {
            setCurrentStep(step);
            setTotalSteps(total);
            setStepMessage(msg);
            const tabName = SHEET_NAMES[step - 1];
            if (tabName) {
              setCompletedTabs((prev) => Array.from(new Set([...prev, tabName])));
            }
          }
        );
      }

      setCompletedTabs([...SHEET_NAMES]);
      setSyncStatus(
        language === 'bn'
          ? `অভিনন্দন! ওয়েবসাইটের প্রতিটি ডাটা ধাপে ধাপে গুগল শিটের ${SHEET_NAMES.length}টি ট্যাবে সফলভাবে সংরক্ষিত হয়েছে।`
          : `Success! All website data systematically recorded across all ${SHEET_NAMES.length} Google Sheet tabs.`
      );
      onAddActivityLog(
        'GOOGLE_SHEETS_STEP_SYNC',
        `All ${SHEET_NAMES.length} tabs fully updated in Google Sheet ${spreadsheetId || 'Webhook'}`
      );
    } catch (err: any) {
      console.error('Sync Error:', err);
      const isAuthErr =
        err?.status === 401 ||
        err?.code === 'UNAUTHENTICATED' ||
        err?.message?.includes('invalid authentication credentials') ||
        err?.message?.includes('UNAUTHENTICATED');

      if (err?.message === 'POPUP_BLOCKED') {
        setSyncError(
          language === 'bn'
            ? 'ব্রাউজারে গুগল সাইন-ইন পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজার ইউআরএল বারের ডানপাশে পপআপ অনুমোদন করুন অথবা নিচে আপনার গুগল শিট আইডি বা অ্যাপস স্ক্রিপ্ট ব্যবহার করুন।'
            : 'Popup blocked by browser. Please allow popups or use the Google Apps Script Webhook below.'
        );
      } else if (isAuthErr) {
        clearCachedAccessToken();
        setSyncError(
          language === 'bn'
            ? 'গুগল সাইন-ইন টোকেনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে নিচের "পুনরায় গুগল লগইন ও সিঙ্ক করুন" বোতামে ক্লিক করুন।'
            : 'Google access token expired. Please click "Re-authenticate with Google & Retry" below to refresh credentials.'
        );
      } else {
        setSyncError(
          err.message ||
            (language === 'bn'
              ? 'সিঙ্ক করতে সমস্যা হয়েছে। গুগল সাইন-ইন নিশ্চিত করুন অথবা নিচের "গুগল অ্যাপস স্ক্রিপ্ট" ব্যবহার করুন যা ১০০% নির্ভরযোগ্য।'
              : 'Failed to sync. Please ensure Google login or use the 100% reliable Apps Script option below.')
        );
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReauthAndSync = async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      clearCachedAccessToken();
      const token = await GoogleSheetsService.getValidToken(true);
      if (token) {
        await handleStepByStepSync();
      }
    } catch (e: any) {
      console.warn('Re-auth error:', e);
      setSyncError(
        e?.message ||
          (language === 'bn'
            ? 'পুনরায় লগইন সম্পন্ন করা যায়নি।'
            : 'Failed to re-authenticate with Google.')
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNewSheet = async () => {
    if (!isAdmin) {
      setSyncError(
        language === 'bn'
          ? 'শুধুমাত্র প্রধান অ্যাডমিনের এই অনুমতি রয়েছে।'
          : 'Only Admin has permission.'
      );
      return;
    }

    setIsCreating(true);
    setSyncError(null);
    setSyncStatus(
      language === 'bn'
        ? 'গুগল ড্রাইভে ১৪টি ট্যাব সহ নতুন স্প্রেডশিট ফাইল তৈরি হচ্ছে...'
        : 'Creating 14-tab spreadsheet file in Google Drive...'
    );

    try {
      const newSheetId = await GoogleSheetsService.createNewAssociationSpreadsheet(appData);
      onUpdateSpreadsheetId(newSheetId);
      setSyncStatus(
        language === 'bn'
          ? 'নতুন গুগল শিট তৈরি এবং ১৪টি ট্যাবে সম্পূর্ণ ডাটা সংরক্ষণ সম্পন্ন হয়েছে!'
          : 'Spreadsheet created and fully populated across all 14 tabs!'
      );
      onAddActivityLog('GOOGLE_SHEETS_CREATED', `Created new sheet ID: ${newSheetId}`);
    } catch (err: any) {
      console.error(err);
      if (err?.message === 'POPUP_BLOCKED') {
        setSyncError(
          language === 'bn'
            ? 'ব্রাউজারে গুগল সাইন-ইন পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজার ইউআরএল বারে পপআপ অনুমোদন করুন অথবা বিদ্যমান শিট আইডি পেস্ট করুন।'
            : 'Popup blocked by browser. Please allow popups or connect an existing Google Sheet ID below.'
        );
      } else {
        setSyncError(
          err.message ||
            (language === 'bn'
              ? 'গুগল সাইন-ইন প্রয়োজন। নিচে বিদ্যমান গুগল শিটের আইডি পেস্ট করে অথবা অ্যাপস স্ক্রিপ্ট কোড দিয়েও সরাসরি যুক্ত করতে পারেন।'
              : 'Google Sign-in required. You can also paste an existing Sheet ID or use Apps Script.')
        );
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnectExisting = () => {
    if (!existingIdInput.trim()) return;
    let cleanId = existingIdInput.trim();
    const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      cleanId = match[1];
    }
    onUpdateSpreadsheetId(cleanId);
    setExistingIdInput('');
    setSyncStatus(
      language === 'bn'
        ? 'গুগল শিট আইডি সংরক্ষিত হয়েছে। এখন "ধাপে ধাপে সম্পূর্ণ সিঙ্ক" বাটনে ক্লিক করুন।'
        : 'Google Sheet ID saved. Now click "Step-by-Step Full Sync" to record all data.'
    );
  };

  const handleSaveAppsScriptUrl = () => {
    if (!appsScriptUrlInput.trim()) return;
    StorageService.updateSettings({ googleAppsScriptUrl: appsScriptUrlInput.trim() });
    setSyncStatus(
      language === 'bn'
        ? 'অ্যাপস স্ক্রিপ্ট ওয়েবহুক লিংক সংরক্ষিত হয়েছে। এটি দিয়ে শতভাগ নির্ভরযোগ্যভাবে ব্যাকআপ রাখা যাবে।'
        : 'Apps Script Webhook URL saved successfully.'
    );
  };

  const handleCopyCode = () => {
    const code = getAppsScriptCodeTemplate();
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>{t.navGoogleSheets}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? `ওয়েবসাইটের প্রতিটি সদস্য, সঞ্চয়, ঋণ, সভা ও হিসাব ${SHEET_NAMES.length}টি ট্যাবে নিখুঁতভাবে গুগল শিটে সংরক্ষণ করুন`
              : `Record every single member, contribution, loan, meeting & ledger systematically into ${SHEET_NAMES.length} Google Sheet tabs`}
          </p>
        </div>

        {spreadsheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-xs transition-all self-start sm:self-auto"
          >
            <span>{t.openSpreadsheet}</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Main Admin Sheet Modification Permission Banner */}
      {!isAuthorizedSheetModifier ? (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-2xs">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-sm">
              {language === 'bn'
                ? '🔒 গুগল শিট সংশোধন শুধুমাত্র প্রধান অ্যাডমিনের জন্য সংরক্ষিত'
                : '🔒 Google Sheet Modification Restricted to Main Admin'}
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-1">
              {language === 'bn'
                ? 'শুধুমাত্র প্রধান অ্যাডমিন তার নির্ধারিত জিমেইল (freelancerkajolchandradas@gmail.com) দিয়ে গুগল শিট তৈরি, সিঙ্ক ও পরিবর্তন করতে পারবেন। সহকারী অ্যাডমিন বা অন্যান্যদের জন্য গুগল শিট পরিবর্তন বন্ধ।'
                : 'No one other than the main admin using freelancerkajolchandradas@gmail.com is authorized to modify or sync the Google Sheet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">
            {language === 'bn'
              ? 'প্রধান অ্যাডমিন অনুমতি সক্রিয়: freelancerkajolchandradas@gmail.com (গুগল শিট পরিবর্তনের পূর্ণ কর্তৃত্ব রয়েছে)'
              : 'Main Admin Authorized: freelancerkajolchandradas@gmail.com (Full Google Sheet modification access active)'}
          </span>
        </div>
      )}

      {/* Primary Action Card: Step-by-Step Sync Engine */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  spreadsheetId || appsScriptUrlInput ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {spreadsheetId || appsScriptUrlInput
                  ? language === 'bn'
                    ? 'গুগল শিট ক্লাউড কানেকশন সক্রিয়'
                    : 'Google Sheets Cloud Connection Ready'
                  : language === 'bn'
                  ? 'গুগল শিট এখনো সংযুক্ত করা হয়নি'
                  : 'Google Sheet Not Connected Yet'}
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'bn'
                ? 'ওয়েবসাইটের সকল ডাটা ক্রমানুসারে প্রতিটি ট্যাবে সেভ করতে নিচের বাটনে চাপুন।'
                : 'Press the button below to systematically push all data to the 14 tabs.'}
            </div>

            {spreadsheetId && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                Sheet ID: {spreadsheetId}
              </div>
            )}
          </div>

          {/* Big Action Button */}
          <div className="flex items-center gap-3">
            <button
              disabled={isSyncing || (!spreadsheetId && !appsScriptUrlInput)}
              onClick={handleStepByStepSync}
              className="px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? language === 'bn'
                    ? 'ধাপে ধাপে সেভ হচ্ছে...'
                    : 'Saving Step-by-Step...'
                  : language === 'bn'
                  ? 'ধাপে ধাপে সম্পূর্ণ ডাটা শিটে সেভ করুন'
                  : 'Save All Data Step-by-Step to Sheet'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Step Progress Indicator */}
        {isSyncing && (
          <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                <span>{stepMessage}</span>
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {currentStep} / {totalSteps}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.round((currentStep / totalSteps) * 100)}%` }}
              />
            </div>

            {/* Completed Tab Pills */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {completedTabs.map((tab) => (
                <span
                  key={tab}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{tab}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {syncStatus && !isSyncing && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}

        {syncError && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{syncError}</span>
            </div>
            {(syncError.includes('টোকেন') ||
              syncError.includes('token') ||
              syncError.includes('authentication') ||
              syncError.includes('UNAUTHENTICATED') ||
              syncError.includes('সাইন-ইন')) && (
              <button
                type="button"
                onClick={handleReauthAndSync}
                disabled={isSyncing}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {language === 'bn'
                    ? 'পুনরায় গুগল লগইন ও সিঙ্ক করুন'
                    : 'Re-authenticate with Google & Retry'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Connection Options */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Create New Sheet */}
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{language === 'bn' ? '১. নতুন ১৪-ট্যাবের স্প্রেডশিট তৈরি' : '1. Create 14-Tab Spreadsheet'}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {language === 'bn'
                  ? 'গুগল ড্রাইভে সরাসরি পাকুড়া সনাতন যুব সংঘের ১৪টি নির্দিষ্ট ট্যাব সহ নতুন শিট তৈরি করবে।'
                  : 'Provisions an official Google Sheet with all 14 tabs on your Google Drive.'}
              </p>
            </div>

            <button
              disabled={isCreating}
              onClick={handleCreateNewSheet}
              className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {isCreating
                  ? language === 'bn'
                    ? 'তৈরি হচ্ছে...'
                    : 'Creating...'
                  : language === 'bn'
                  ? 'নতুন গুগল শিট তৈরি করুন'
                  : 'Create Sheet'}
              </span>
            </button>
          </div>

          {/* Option 2: Connect Existing Sheet */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <Link className="w-4 h-4 text-blue-600" />
                <span>{language === 'bn' ? '২. আপনার গুগল শিট লিঙ্ক করুন' : '2. Connect Your Google Sheet'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {language === 'bn'
                  ? 'আপনার গুগল শিটের লিঙ্ক বা স্প্রেডশিট আইডি এখানে পেস্ট করে সরাসরি সংযুক্ত করতে পারেন।'
                  : 'Paste any Google Sheet URL or ID to link it immediately.'}
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={existingIdInput}
                onChange={(e) => setExistingIdInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleConnectExisting}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 dark:bg-slate-700 text-white"
              >
                {language === 'bn' ? 'সংযুক্ত' : 'Connect'}
              </button>
            </div>
          </div>
        </div>

        {/* Option 3: Google Apps Script 100% Reliable Webhook */}
        <div className="mt-4 p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
              <Code className="w-4 h-4 text-amber-600" />
              <span>
                {language === 'bn'
                  ? '৩. গুগল অ্যাপস স্ক্রিপ্ট ওয়েবহুক (OAuth ছাড়া শতভাগ নিশ্চিত অটো-সিঙ্ক)'
                  : '3. Google Apps Script Webhook (100% Guaranteed Auto-Sync)'}
              </span>
            </div>

            <button
              onClick={() => setShowScriptModal(true)}
              className="text-xs text-amber-700 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>{language === 'bn' ? 'স্ক্রিপ্ট কোড ও নির্দেশিকা দেখুন' : 'View Script & Setup Guide'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2.5 flex gap-2">
            <input
              type="text"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={appsScriptUrlInput}
              onChange={(e) => setAppsScriptUrlInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white font-mono"
            />
            <button
              onClick={handleSaveAppsScriptUrl}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {language === 'bn' ? 'সংরক্ষণ' : 'Save URL'}
            </button>
          </div>
        </div>

        {lastSyncDate && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {language === 'bn' ? 'সর্বশেষ সফল ক্লাউড সিঙ্ক:' : 'Last Successful Sync:'}{' '}
              <strong className="text-slate-700 dark:text-slate-300">{lastSyncDate}</strong>
            </span>
            {spreadsheetId && (
              <button
                onClick={() => onUpdateSpreadsheetId('')}
                className="text-red-500 hover:underline"
              >
                {language === 'bn' ? 'সংযোগ বিচ্ছিন্ন করুন' : 'Disconnect'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Apps Script Setup Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? 'গুগল অ্যাপস স্ক্রিপ্ট কোড ও সহজ সেটআপ'
                    : 'Google Apps Script Code & Setup'}
                </h3>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {language === 'bn' ? 'সহজ ৩-ধাপের সেটআপ:' : 'Easy 3-Step Setup:'}
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <li>
                  {language === 'bn'
                    ? 'আপনার যেকোনো গুগল শিট ওপেন করুন এবং মেনু থেকে Extensions > Apps Script এ ক্লিক করুন।'
                    : 'Open any Google Sheet and click Extensions > Apps Script.'}
                </li>
                <li>
                  {language === 'bn'
                    ? 'নিচের কোডটি কপি করে সম্পূর্ণ পেস্ট করুন।'
                    : 'Copy the code below and paste it into the editor.'}
                </li>
                <li>
                  {language === 'bn'
                    ? 'উপরে Deploy > New deployment > Web app নির্বাচন করুন। Execute as: Me এবং Who has access: Anyone দিন এবং প্রাপ্ত URL টি পেস্ট করুন।'
                    : 'Click Deploy > New deployment > Web app. Execute as: Me, Who has access: Anyone, and paste the URL here.'}
                </li>
              </ol>
            </div>

            <div className="relative mt-3 flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 p-3 text-emerald-400 font-mono text-[11px] overflow-y-auto max-h-64">
              <pre>{getAppsScriptCodeTemplate()}</pre>
            </div>

            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>
                  {copiedCode
                    ? language === 'bn'
                      ? 'কোড কপি হয়েছে!'
                      : 'Code Copied!'
                    : language === 'bn'
                    ? 'সম্পূর্ণ কোড কপি করুন'
                    : 'Copy All Code'}
                </span>
              </button>

              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
