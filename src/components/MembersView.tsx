import React, { useState } from 'react';
import { Member, Contribution, Language, UserAccount, GeneralMeeting } from '../types';
import { getTranslation, formatMemberPhone } from '../lib/translations';
import {
  Users,
  Search,
  Plus,
  Edit2,
  History,
  CheckCircle2,
  XCircle,
  PiggyBank,
  X,
  Phone,
  UserCheck,
  Calendar,
  Clock,
  AlertTriangle,
  Receipt,
  Check,
  FileText,
  Lock,
  Shield,
  LogIn,
  Trash2,
} from 'lucide-react';

interface MembersViewProps {
  members: Member[];
  contributions: Contribution[];
  currentUser: UserAccount;
  language: Language;
  meetings?: GeneralMeeting[];
  onAddMember: (name: string, phone: string) => void;
  onUpdateMember: (systemId: string, name: string, phone: string, status: 'active' | 'inactive') => void;
  onDeleteMember?: (systemId: string) => void;
  onRecordContributionForMember?: (member: Member) => void;
  onViewReceipt?: (receiptId: string) => void;
  onOpenLoginModal?: () => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  contributions,
  currentUser,
  language,
  meetings = [],
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onRecordContributionForMember,
  onViewReceipt,
  onOpenLoginModal,
}) => {
  const t = getTranslation(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMemberIdToDelete, setSelectedMemberIdToDelete] = useState<string>('');

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'payments' | 'attendance'>('payments');
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  const isViewOnly = currentUser.userId === 'USR-VIEW-ONLY';
  const isMember = currentUser.role === 'member' && !isViewOnly;
  const canEdit = currentUser.role === 'admin';



  // Filtered members list: show all association members with search and status filtering
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // 1. Unauthenticated / View-only Lock Gate
  if (isViewOnly) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg text-center animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
          {language === 'bn' ? 'সদস্য তালিকা সুরক্ষিত' : 'Member Details Protected'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          {language === 'bn'
            ? 'গোপনীয়তা রক্ষার স্বার্থে সাধারণ সদস্যগণ মোবাইল নম্বর দিয়ে এবং অ্যাডমিনগণ জিমেইল ও পাসওয়ার্ড দিয়ে লগইন করে বিস্তারিত তথ্য দেখতে পারবেন।'
            : 'General members log in with mobile phone numbers, and administrators log in with Gmail to view member profiles.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            onClick={onOpenLoginModal}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{language === 'bn' ? 'লগইন' : 'Login'}</span>
          </button>
        </div>
      </div>
    );
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    onAddMember(newName.trim(), newPhone.trim());
    setNewName('');
    setNewPhone('');
    setShowAddModal(false);
  };

  const openEditModal = (m: Member) => {
    setEditingMember(m);
    setEditName(m.name);
    setEditPhone(m.phone);
    setEditStatus(m.status);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim() || !editPhone.trim()) return;
    onUpdateMember(editingMember.systemId, editName.trim(), editPhone.trim(), editStatus);
    setEditingMember(null);
  };

  const memberContributions = historyMember
    ? contributions.filter((c) => c.memberSystemId === historyMember.systemId)
    : [];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>{t.navMembers}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {members.length} {language === 'bn' ? 'জন' : 'members'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'সদস্যদের নাম, মোবাইল ও সঞ্চয় স্থিতি (আইডি ও ঠিকানা ওয়েবসাইটে উন্মুক্ত নয়)'
              : 'Member directory with names, phones & current savings balance'}
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedMemberIdToDelete(members[0]?.systemId || '');
                setShowDeleteModal(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>{language === 'bn' ? 'সদস্য মুছুন' : 'Delete Members'}</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addMember}</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Status Filters */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'নাম অথবা ফোন দিয়ে খুঁজুন...' : 'Search by name or phone...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterStatus === 'all'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {language === 'bn' ? 'সকল' : 'All'} ({members.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.active} ({members.filter((m) => m.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterStatus === 'inactive'
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.inactive} ({members.filter((m) => m.status === 'inactive').length})
          </button>
        </div>
      </div>

      {/* Member Cards Grid (Responsive & Anti-Slop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMembers.map((member, idx) => {
          return (
            <div
              key={`${member.systemId}-${idx}`}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-200 dark:border-amber-800">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {member.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{formatMemberPhone(member.phone, canEdit)}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      member.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                    }`}
                  >
                    {member.status === 'active' ? t.active : t.inactive}
                  </span>
                </div>

                {/* Savings Balance Display */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">{t.currentBalance}</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        ৳{(member.currentBalance || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setHistoryMember(member)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
                  title="Lifetime History"
                >
                  <History className="w-3.5 h-3.5 text-amber-500" />
                  <span>{language === 'bn' ? 'ইতিহাস' : 'History'}</span>
                </button>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    {onRecordContributionForMember && (
                      <button
                        onClick={() => onRecordContributionForMember(member)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        title={language === 'bn' ? 'সঞ্চয় জমা নিন' : 'Record Savings'}
                      >
                        <PiggyBank className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(member)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      title={t.editMember || (language === 'bn' ? 'সদস্য তথ্য সংশোধন' : 'Edit Member')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {onDeleteMember && (
                      <button
                        onClick={() => setMemberToDelete(member)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer"
                        title={t.deleteMember || (language === 'bn' ? 'সদস্য মুছে ফেলুন' : 'Delete Member')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div className="py-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          {isMember ? (
            <div className="max-w-md mx-auto">
              <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {language === 'bn' ? 'সদস্য তথ্য লোড করা সম্ভব হয়নি' : 'Member Record Not Found'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'bn'
                  ? 'আপনার মোবাইল নম্বরের সাথে যুক্ত সদস্য তথ্য পাওয়া যায়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন অথবা নিশ্চিত করুন আপনার নম্বরটি সদস্য তালিকায় রয়েছে।'
                  : 'Your linked member record was not found in the roster. Please contact the administrator.'}
              </p>
            </div>
          ) : (
            <>
              <div className="max-w-md mx-auto">
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সদস্য তালিকা বর্তমানে সম্পূর্ণ নতুন ও পরিচ্ছন্ন' : 'Member Roster is Clean & Ready'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'bn'
                    ? 'পূর্বের পরীক্ষামূলক সকল ডাটা মুছে ফেলা হয়েছে। এখন আপনি আসল সদস্য যোগ করতে পারেন, অথবা বোতাম ও হিসাব পরীক্ষার জন্য ৩টি নমুনা সদস্য লোড করতে পারেন।'
                    : 'All prior demo data was cleared. You can now add real members or load 3 sample members to test all features.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'bn' ? 'নতুন সদস্য যোগ করুন' : 'Add New Member'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal: Delete Member (From Header Action) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {language === 'bn' ? 'সদস্য মুছুন' : 'Delete Member'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'তালিকা থেকে স্থায়ীভাবে সদস্য অপসারণ' : 'Permanently remove member from roster'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {members.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                {language === 'bn' ? 'তালিকায় কোনো সদস্য নেই।' : 'No members found in the roster.'}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'bn' ? 'যে সদস্যকে মুছে ফেলতে চান তাকে নির্বাচন করুন:' : 'Select Member to Delete:'}
                  </label>
                  <select
                    value={selectedMemberIdToDelete || members[0]?.systemId}
                    onChange={(e) => setSelectedMemberIdToDelete(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.systemId} value={m.systemId}>
                        {m.name} — {formatMemberPhone(m.phone, true)} (সঞ্চয়: ৳{(m.currentBalance || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Member Preview Card */}
                {(() => {
                  const target = members.find((m) => m.systemId === (selectedMemberIdToDelete || members[0]?.systemId));
                  if (!target) return null;
                  return (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">{t.memberName}:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{target.name}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">{t.phoneNumber}:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{formatMemberPhone(target.phone, true)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-500 dark:text-slate-400">{t.currentBalance}:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">৳{(target.currentBalance || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  {language === 'bn'
                    ? 'সতর্কতা: সদস্য মুছে ফেললে তার সকল প্রোফাইল তথ্য ডাটাবেজ থেকে মুছে যাবে।'
                    : 'Warning: Deleting a member permanently removes their account from the association roster.'}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = members.find((m) => m.systemId === (selectedMemberIdToDelete || members[0]?.systemId));
                      if (target) {
                        setShowDeleteModal(false);
                        setMemberToDelete(target);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'মুছে ফেলতে এগিয়ে যান' : 'Proceed to Delete'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Add Member (Can exceed 32 anytime!) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {t.addMember}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.memberName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: কাজল দাস"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.phoneNumber} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="যেমন: 017XXXXXXXX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 text-[11px] text-amber-800 dark:text-amber-300">
                {language === 'bn'
                  ? 'সদস্যের প্রাথমিক সঞ্চয় স্থিতি ৳০ হবে এবং স্বয়ংক্রিয় অভ্যন্তরীণ সিস্টেম আইডি বরাদ্দ করা হবে।'
                  : 'New member initial balance will be ৳0 with auto-generated internal system ID.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Member */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {t.editMember}
              </h3>
              <button
                onClick={() => setEditingMember(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.memberName}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.phoneNumber}
                </label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.status}
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {onDeleteMember && editingMember && (
                  <button
                    type="button"
                    onClick={() => {
                      const toDel = editingMember;
                      setEditingMember(null);
                      setMemberToDelete(toDel);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.deleteMember || (language === 'bn' ? 'সদস্য মুছে ফেলুন' : 'Delete Member')}</span>
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                  >
                    {t.save}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Comprehensive Member Profile & Detailed Lifetime History */}
      {historyMember && (() => {
        const totalLateFees = memberContributions.reduce((sum, c) => sum + (c.lateFee || 0), 0);
        const latePaymentsCount = memberContributions.filter((c) => (c.lateFee || 0) > 0).length;
        const onTimePaymentsCount = memberContributions.length - latePaymentsCount;

        const recordedMeetings = meetings.filter((m) => m.attendanceRecorded);
        const attendedMeetings = recordedMeetings.filter((m) =>
          m.attendees.some((a) => a.memberSystemId === historyMember.systemId && a.status === 'present')
        );
        const attendanceRate = recordedMeetings.length > 0
          ? Math.round((attendedMeetings.length / recordedMeetings.length) * 100)
          : 0;

        const sortedCons = [...memberContributions].sort((a, b) => a.month.localeCompare(b.month));
        const durationText = sortedCons.length > 0
          ? `${sortedCons.length} ${language === 'bn' ? 'টি মাস' : 'months'} (${sortedCons[0].month} - ${sortedCons[sortedCons.length - 1].month})`
          : language === 'bn' ? 'কোনো সঞ্চয় জমা নেই' : 'No contributions recorded';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Profile Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {historyMember.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {historyMember.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        historyMember.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}>
                        {historyMember.status === 'active' ? t.active : t.inactive}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                      <span>{t.phoneNumber}: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatMemberPhone(historyMember.phone, canEdit)}</strong></span>
                      <span>•</span>
                      <span>{language === 'bn' ? 'যোগদান:' : 'Joined:'} {historyMember.createdAt || '2025-10-10'}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryMember(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 4 Multi-Dimension Metric Cards */}
              <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Total Contributed Savings */}
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {language === 'bn' ? 'মোট সঞ্চয় মূলধন' : 'Total Contributed'}
                  </span>
                  <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    ৳{(historyMember.currentBalance || 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {memberContributions.length} {language === 'bn' ? 'কিস্তি জমা' : 'payments'}
                  </span>
                </div>

                {/* 2. Duration of Payments */}
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                    {language === 'bn' ? 'জমার মেয়াদকাল' : 'Payment Duration'}
                  </span>
                  <div className="text-base font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                    {memberContributions.length} {language === 'bn' ? 'মাস' : 'Months'}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block" title={durationText}>
                    {sortedCons.length > 0 ? `${sortedCons[0].month} ~ ${sortedCons[sortedCons.length - 1].month}` : '—'}
                  </span>
                </div>

                {/* 3. Meetings Attended */}
                <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60">
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    {language === 'bn' ? 'সভায় উপস্থিতি' : 'Meetings Attended'}
                  </span>
                  <div className="text-base font-bold text-purple-700 dark:text-purple-300 mt-0.5">
                    {attendedMeetings.length} / {recordedMeetings.length}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {language === 'bn' ? `হাজিরা হার: ${attendanceRate}%` : `Rate: ${attendanceRate}%`}
                  </span>
                </div>

                {/* 4. Late Fees Record */}
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60">
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    {language === 'bn' ? 'বিলম্ব ফি রেকর্ড' : 'Late Fees Paid'}
                  </span>
                  <div className="text-base font-bold text-amber-800 dark:text-amber-300 mt-0.5">
                    ৳{totalLateFees.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {latePaymentsCount > 0
                      ? (language === 'bn' ? `${latePaymentsCount} বার বিলম্বিত` : `${latePaymentsCount} late`)
                      : (language === 'bn' ? 'সবসময় সময়মতো' : 'Always on time')}
                  </span>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-semibold pb-1">
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('payments')}
                  className={`pb-2 transition-all cursor-pointer border-b-2 ${
                    activeHistoryTab === 'payments'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'bn' ? 'মাসিক সঞ্চয় ও পেমেন্ট বিবরণী' : 'Savings & Payments History'} ({memberContributions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('attendance')}
                  className={`pb-2 transition-all cursor-pointer border-b-2 ${
                    activeHistoryTab === 'attendance'
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'bn' ? 'সাধারণ সভায় উপস্থিতি ও হাজিরা' : 'Meeting Attendance Record'} ({recordedMeetings.length})
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-2 custom-scrollbar">
                {activeHistoryTab === 'payments' && (
                  <>
                    {memberContributions.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        {language === 'bn' ? 'এখনো কোনো সঞ্চয় জমা হয়নি।' : 'No contributions recorded yet.'}
                      </div>
                    ) : (
                      memberContributions.map((c, idx) => {
                        const hasFee = (c.lateFee || 0) > 0;
                        return (
                          <div
                            key={`${c.contributionId}-${idx}`}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                              hasFee
                                ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                                : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {c.month}
                                </span>
                                {hasFee ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    {language === 'bn' ? '১০ তারিখের পর (+৳১০ বিলম্ব ফি)' : 'Late (+৳10 Fee)'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    {language === 'bn' ? '✓ সময়মতো পরিশোধিত' : 'On-time'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                {language === 'bn' ? 'জমাদানের তারিখ:' : 'Paid:'} {c.contributionDate} • {c.paymentMethod === 'cash' ? (language === 'bn' ? 'ক্যাশ' : 'Cash') : (language === 'bn' ? 'ব্যাংক' : 'Bank')}
                                {c.recordedBy && ` • ${language === 'bn' ? 'গ্রহীতা:' : 'By:'} ${c.recordedBy}`}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                ৳{c.amount.toLocaleString()}
                                {hasFee && (
                                  <span className="text-xs text-amber-600 ml-1">
                                    (+৳{c.lateFee})
                                  </span>
                                )}
                              </div>
                              {onViewReceipt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onViewReceipt(c.receiptId);
                                    setHistoryMember(null);
                                  }}
                                  className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mt-0.5 ml-auto cursor-pointer"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>#{c.receiptId}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {activeHistoryTab === 'attendance' && (
                  <>
                    {recordedMeetings.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        {language === 'bn' ? 'এখনও কোনো সাধারণ সভার হাজিরা রেকর্ড করা হয়নি।' : 'No meeting attendance records yet.'}
                      </div>
                    ) : (
                      recordedMeetings.map((m) => {
                        const attendee = m.attendees.find((a) => a.memberSystemId === historyMember.systemId);
                        const isPresent = attendee?.status === 'present';
                        return (
                          <div
                            key={m.meetingId}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {m.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-amber-500" />
                                  <span>{m.meetingDate}</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{m.scheduledTime || '08:00 PM'}</span>
                                </span>
                              </div>
                              {m.recordedBy && (
                                <div className="text-[10px] text-slate-400 mt-1">
                                  ✓ {language === 'bn' ? 'হাজিরা যাচাইকারী:' : 'Verified by:'} {m.recordedBy} ({m.recordedAt})
                                </div>
                              )}
                            </div>

                            <div className="text-right">
                              {isPresent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{language === 'bn' ? 'উপস্থিত' : 'Present'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  <X className="w-3.5 h-3.5" />
                                  <span>{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {language === 'bn' ? 'সমিতির কেন্দ্রীয় রেজিস্টার ডাটাবেজ থেকে সংগৃহীত' : 'Extracted from Society Central Ledger Database'}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal 4: Delete Member Confirmation */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {t.confirmDeleteMember || (language === 'bn' ? 'সদস্য মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Member Deletion')}
                  </h3>
                  <span className="text-[11px] text-red-500 font-semibold block">
                    {language === 'bn' ? 'অপরিবর্তনীয় পদক্ষেপ' : 'Irreversible Action'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMemberToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{t.memberName}:</span>
                <span className="font-bold text-slate-900 dark:text-white">{memberToDelete.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{t.phoneNumber}:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{formatMemberPhone(memberToDelete.phone, true)}</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">{t.currentBalance}:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">৳{(memberToDelete.currentBalance || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {language === 'bn'
                ? `আপনি কি নিশ্চিত যে আপনি "${memberToDelete.name}"-কে সদস্য তালিকা থেকে মুছে ফেলতে চান? মুছে ফেললে এই সদস্যের প্রোফাইল ডাটাবেজ থেকে স্থায়ীভাবে অপসারিত হবে।`
                : `Are you sure you want to delete "${memberToDelete.name}" from the member roster? This will permanently remove their profile from the database.`}
            </div>

            {Number(memberToDelete.currentBalance || 0) > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  {language === 'bn'
                    ? `সতর্কতা: এই সদস্যের বর্তমানে ৳${(memberToDelete.currentBalance || 0).toLocaleString()} সঞ্চয় স্থিতি রয়েছে।`
                    : `Warning: This member currently has an active savings balance of ৳${(memberToDelete.currentBalance || 0).toLocaleString()}.`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteMember && memberToDelete) {
                    onDeleteMember(memberToDelete.systemId);
                    setMemberToDelete(null);
                  }
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs shadow-red-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.deleteMember || (language === 'bn' ? 'মুছে ফেলুন' : 'Delete Member')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
