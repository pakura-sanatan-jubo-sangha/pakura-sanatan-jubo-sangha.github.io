import React, { useState } from 'react';
import { ActivityLog, Language, UserAccount } from '../types';
import { getTranslation } from '../lib/translations';
import { isStrictMainAdmin } from '../lib/storage';
import {
  ClipboardList,
  Search,
  Clock,
  User,
  Shield,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  CreditCard,
  PiggyBank,
  Key,
  Calendar,
} from 'lucide-react';

interface ActivityLogViewProps {
  logs: ActivityLog[];
  currentUser: UserAccount;
  language: Language;
  onClearLogs?: () => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  logs,
  currentUser,
  language,
  onClearLogs,
}) => {
  const t = getTranslation(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const isMainAdmin = isStrictMainAdmin(currentUser);

  const filteredLogs = logs.filter((l) => {
    const q = searchQuery.toLowerCase().trim();
    const actionMatch = (l.action || '').toLowerCase().includes(q);
    const detailsMatch = (l.details || l.description || '').toLowerCase().includes(q);
    const userMatch = (l.userName || l.userDisplayName || '').toLowerCase().includes(q);
    const moduleMatch = (l.module || '').toLowerCase().includes(q);

    const matchesSearch = !q || actionMatch || detailsMatch || userMatch || moduleMatch;

    if (!matchesSearch) return false;
    if (selectedModule === 'all') return true;
    if (selectedModule === 'security') {
      return (
        l.module === 'Security' ||
        l.action.includes('LOGIN') ||
        l.action.includes('PASSWORD')
      );
    }
    if (selectedModule === 'members') return l.module === 'Members' || l.action.includes('MEMBER');
    if (selectedModule === 'loans') return l.module === 'Loans' || l.action.includes('LOAN');
    if (selectedModule === 'savings') return l.module === 'Contributions' || l.action.includes('CONTRIBUTION');
    if (selectedModule === 'rules') return l.module === 'Rules' || l.action.includes('RULE');
    if (selectedModule === 'finance') return ['Income', 'Expense', 'Accounting'].includes(l.module);
    return true;
  });

  const getModuleBadge = (moduleName: string = '', actionName: string = '') => {
    if (moduleName === 'Security' || actionName.includes('LOGIN')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
    if (moduleName === 'Members') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
    if (moduleName === 'Loans') {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    if (moduleName === 'Contributions') {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (moduleName === 'Rules') {
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>{t.navActivityLog}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {logs.length} {language === 'bn' ? 'টি অডিট এন্ট্রি' : 'events'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'কে কখন লগইন করেছেন এবং কী কী পরিবর্তন বা সংযোজন করেছেন তার নিখুঁত অডিট ট্রেইল'
              : 'Audit trail tracking who logs in and what changes or additions they make'}
          </p>
        </div>

        {isMainAdmin && logs.length > 0 && onClearLogs ? (
          <button
            onClick={() => {
              if (!isMainAdmin) return;
              setShowClearConfirm(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{language === 'bn' ? 'সব অডিট লগ মুছুন' : 'Clear All Logs'}</span>
          </button>
        ) : !isMainAdmin && logs.length > 0 ? (
          <div className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 self-start sm:self-auto">
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {language === 'bn'
                ? 'অডিট লগ মোছা শুধু প্রধান অ্যাডমিনের জন্য সংরক্ষিত'
                : 'Clear Logs restricted to Main Admin only'}
            </span>
          </div>
        ) : null}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Module Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: language === 'bn' ? 'সকল অডিট' : 'All Events' },
            { id: 'security', label: language === 'bn' ? 'লগইন ও অ্যাক্সেস' : 'Logins' },
            { id: 'members', label: language === 'bn' ? 'সদস্য' : 'Members' },
            { id: 'loans', label: language === 'bn' ? 'ঋণ' : 'Loans' },
            { id: 'savings', label: language === 'bn' ? 'সঞ্চয়' : 'Savings' },
            { id: 'rules', label: language === 'bn' ? 'নিয়মাবলি' : 'Rules' },
            { id: 'finance', label: language === 'bn' ? 'আয় ও ব্যয়' : 'Finance' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setSelectedModule(pill.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedModule === pill.id
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-amber-400'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 flex-shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'অ্যাকশন, ইউজার বা বিবরণ দিয়ে খুঁজুন...' : 'Search activity logs...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {language === 'bn' ? 'বর্তমানে কোনো অডিট রেকর্ড নেই' : 'No Activity Logs Recorded'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              {language === 'bn'
                ? 'সকল ডেমো ও পূর্ববর্তী লগ মুছে ফেলা হয়েছে। এখন থেকে যে কেউ লগইন করলে কিংবা সদস্য, ঋণ, সঞ্চয় ও নিয়মাবলিতে কোনো সংযোজন বা পরিবর্তন আনলে স্বয়ংক্রিয়ভাবে তা এখানে রেকর্ড হবে।'
                : 'All previous logs have been cleared. Every login and mutation (regarding members, loans, savings, and rules) will be automatically recorded here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="p-3 font-semibold">{language === 'bn' ? 'সময় ও তারিখ' : 'Timestamp'}</th>
                  <th className="p-3 font-semibold">{language === 'bn' ? 'ব্যবহারকারী ও রোল' : 'User & Role'}</th>
                  <th className="p-3 font-semibold">{language === 'bn' ? 'বিভাগ / মডিউল' : 'Module'}</th>
                  <th className="p-3 font-semibold">{language === 'bn' ? 'কার্যক্রম' : 'Action'}</th>
                  <th className="p-3 font-semibold">{language === 'bn' ? 'বিস্তারিত বিবরণ' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredLogs.map((log, idx) => {
                  const displayName = log.userDisplayName || log.userName || 'System';
                  const detailsText = log.details || log.description || '-';
                  return (
                    <tr key={`${log.logId}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-500 whitespace-nowrap text-[11px] font-mono">
                        {log.dateTime || (log.timestamp ? new Date(log.timestamp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US') : '-')}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-[10px]">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {displayName}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase font-mono">
                              {log.role || 'user'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getModuleBadge(log.module, log.action)}`}>
                          {log.module || 'System'}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 max-w-md leading-relaxed text-[11px]">
                        {detailsText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Confirm Clear All Logs (Main Admin Only) */}
      {showClearConfirm && isMainAdmin && onClearLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-red-600">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সকল অডিট লগ মুছে ফেলা' : 'Clear All Activity Logs'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'প্রধান অ্যাডমিনের অনুমোদন প্রয়োজন' : 'Main Admin Authorization'}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'bn'
                ? 'আপনি কি নিশ্চিত যে বর্তমান সকল অডিট রেকর্ড মুছে ফেলতে চান? এটি মুছে ফেলার পর আর পুনরুদ্ধার করা যাবে না।'
                : 'Are you sure you want to permanently clear all activity logs? This action cannot be undone.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isMainAdmin) {
                    setShowClearConfirm(false);
                    return;
                  }
                  onClearLogs();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{language === 'bn' ? 'হ্যাঁ, সব লগ মুছুন' : 'Yes, Clear All Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
