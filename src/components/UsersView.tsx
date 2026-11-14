import React, { useState } from 'react';
import { UserAccount, UserRole, Language } from '../types';
import { getTranslation } from '../lib/translations';
import { isStrictMainAdmin, MAIN_ADMIN_EMAIL } from '../lib/storage';
import {
  ShieldAlert,
  UserPlus,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  X,
  Edit2,
  Lock,
  Trash2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

interface UsersViewProps {
  users: UserAccount[];
  currentUser: UserAccount;
  language: Language;
  onAddUser: (email: string, name: string, role: UserRole, tempPassword?: string) => void;
  onUpdateRole: (userId: string, role: UserRole, status: 'active' | 'inactive') => void;
  onDeleteUser: (userId: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  currentUser,
  language,
  onAddUser,
  onUpdateRole,
  onDeleteUser,
}) => {
  const t = getTranslation(language);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');
  const [newTempPassword, setNewTempPassword] = useState('temp1234');

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  // Deletion Confirmation State
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);

  const isMainAdmin = isStrictMainAdmin(currentUser);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) return;
    if (!newEmail.trim() || !newName.trim()) return;
    onAddUser(
      newEmail.trim().toLowerCase(),
      newName.trim(),
      newRole,
      newTempPassword.trim() || 'temp1234'
    );
    setNewEmail('');
    setNewName('');
    setNewTempPassword('temp1234');
    setShowAddModal(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) return;
    if (!editingUser) return;
    onUpdateRole(editingUser.userId, editRole, editStatus);
    setEditingUser(null);
  };

  const handleConfirmDelete = () => {
    if (!isMainAdmin) return;
    if (!userToDelete) return;
    onDeleteUser(userToDelete.userId);
    setUserToDelete(null);
  };

  const isTargetMainAdmin = (u: UserAccount) => {
    return (
      isStrictMainAdmin(u) ||
      u.email?.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase() ||
      u.userId === 'USR-MAIN-ADMIN'
    );
  };

  // Only display sub-accounts / assigned admins & members created by the Main Admin
  const managedUsers = users.filter((u) => !isTargetMainAdmin(u));

  const getRoleBadge = (role: UserRole, isMain?: boolean) => {
    if (isMain) {
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800';
    }
    switch (role) {
      case 'admin':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300';
      case 'president':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
      case 'treasurer':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'secretary':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>{t.navUsers}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {managedUsers.length} {language === 'bn' ? 'জন' : 'users'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'প্রধান অ্যাডমিন কর্তৃক সাধারণ অ্যাডমিন ও ব্যবহারকারীদের ভূমিকা নিয়ন্ত্রণ ও অপসারণ'
              : 'Main Admin authority over assigned staff, general admins & user roles'}
          </p>
        </div>

        {isMainAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 shadow-xs transition-all self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.addUser}</span>
          </button>
        )}
      </div>

      {/* Authority Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-300">
        <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">
            {language === 'bn'
              ? 'প্রধান অ্যাডমিনের স্থায়ী পদ ও সাধারণ অ্যাডমিন নিয়োগ কর্তৃত্ব:'
              : 'Main Admin Authority & General Admin Assignment:'}
          </div>
          <p className="mt-0.5 text-amber-800 dark:text-amber-300/90 leading-relaxed">
            {language === 'bn'
              ? 'আমিই প্রধান অ্যাডমিন হিসেবে থাকব এবং আমাকে কেউ ডিলিট করতে পারবে না। অন্যদের জন্য জিমেইল/ইমেইল ও অস্থায়ী পাসওয়ার্ড দিয়ে সাধারণ অ্যাডমিন একাউন্ট তৈরি করা যাবে; তারা লগইন করে ইচ্ছামতো পাসওয়ার্ড পরিবর্তন করতে পারবেন। এছাড়া প্রধান অ্যাডমিনের যে কোনো অ্যাডমিন অপসারণের পূর্ণ কর্তৃত্ব রয়েছে।'
              : 'The Main Admin cannot be deleted. The Main Admin can assign General Admin roles with temporary passwords, and retains full authority to delete other admins.'}
          </p>
        </div>
      </div>

      {/* Users Table or Clean Empty State */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {managedUsers.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {language === 'bn' ? 'কোনো সাধারণ অ্যাডমিন যোগ করা হয়নি' : 'No General Admins Added Yet'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              {language === 'bn'
                ? 'আপনি প্রধান অ্যাডমিন হিসেবে একক নিয়ন্ত্রণে আছেন। অন্য ব্যক্তির জন্য জিমেইল ও অস্থায়ী পাসওয়ার্ড দিয়ে অ্যাডমিন একাউন্ট তৈরি করতে উপরের "ব্যবহারকারী যোগ করুন" বোতাম ব্যবহার করুন (সাধারণ সদস্যগণ শুধুমাত্র মোবাইল নম্বর দিয়ে নিবন্ধন করবেন)।'
                : 'You have exclusive Main Admin control. Click "+ Add User" above to create an Admin account with Gmail and temporary password (regular members register using only their phone numbers).'}
            </p>
            {isMainAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{t.addUser}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="p-3 font-semibold">{language === 'bn' ? 'ব্যবহারকারী' : 'User'}</th>
                  <th className="p-3 font-semibold">ইমেইল (Email)</th>
                  <th className="p-3 font-semibold">{t.role}</th>
                  <th className="p-3 font-semibold">{t.status}</th>
                  <th className="p-3 font-semibold text-right">{language === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {managedUsers.map((u, idx) => {
                  const isTargetAdmin = u.role === 'admin';
                  return (
                    <tr key={`${u.userId}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{u.name || u.displayName}</span>
                          {isTargetAdmin && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold">
                              {language === 'bn' ? 'সহকারী অ্যাডমিন' : 'Admin'}
                            </span>
                          )}
                          {u.userId === currentUser.userId && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              {language === 'bn' ? 'আপনি' : 'You'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{u.email || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${getRoleBadge(u.role, false)}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            u.status === 'active' ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {u.status === 'active' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{u.status === 'active' ? t.active : t.inactive}</span>
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Main Admin Only: Edit Role/Status & Delete */}
                          {isMainAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditRole(u.role);
                                  setEditStatus(u.status);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                title={language === 'bn' ? 'সম্পাদনা করুন' : 'Edit User'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setUserToDelete(u)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                                title={
                                  isTargetAdmin
                                    ? language === 'bn' ? 'অ্যাডমিন অপসারণ (প্রধান অ্যাডমিনের অধিকার)' : 'Delete Admin (Main Admin Authority)'
                                    : language === 'bn' ? 'ব্যবহারকারী অপসারণ' : 'Delete User'
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Confirm Deletion of Admin/User (Main Admin Only) */}
      {userToDelete && isMainAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-red-600">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {userToDelete.role === 'admin'
                    ? language === 'bn' ? 'অ্যাডমিন অপসারণ নিশ্চিতকরণ' : 'Confirm Admin Deletion'
                    : language === 'bn' ? 'ব্যবহারকারী অপসারণ নিশ্চিতকরণ' : 'Confirm User Deletion'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'প্রধান অ্যাডমিনের একক কর্তৃত্ব' : 'Main Admin Exclusive Authority'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'bn' ? 'নাম:' : 'Name:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">{userToDelete.name || userToDelete.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'bn' ? 'ইমেইল:' : 'Email:'}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{userToDelete.email || userToDelete.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'bn' ? 'রোল:' : 'Role:'}</span>
                <span className="font-semibold text-red-600 dark:text-red-400 uppercase">{userToDelete.role}</span>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'bn'
                ? `আপনি কি নিশ্চিত যে আপনি এই ${userToDelete.role === 'admin' ? 'অ্যাডমিনকে' : 'ব্যবহারকারীকে'} স্থায়ীভাবে মুছে ফেলতে চান? প্রধান অ্যাডমিন হিসেবে আপনার এই কর্তৃত্ব রয়েছে।`
                : `Are you sure you want to permanently delete this ${userToDelete.role === 'admin' ? 'admin' : 'user'}? As the main admin, you have the authority to delete other admins.`}
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {userToDelete.role === 'admin'
                    ? language === 'bn' ? 'হ্যাঁ, অ্যাডমিন মুছে ফেলুন' : 'Yes, Delete Admin'
                    : language === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, Delete User'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add User (Main Admin Only) */}
      {showAddModal && isMainAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {t.addUser}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: বিপ্লব কুমার দাস"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'ইমেইল (Email)' : 'Email'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin2@pakura.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.role} <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="admin">{t.roleAdmin} (সহকারী অ্যাডমিন / Admin)</option>
                  <option value="president">{t.rolePresident} (সভাপতি / President)</option>
                  <option value="treasurer">{t.roleTreasurer} (কোষাধ্যক্ষ / Treasurer)</option>
                  <option value="secretary">{t.roleSecretary} (সাধারণ সম্পাদক / Secretary)</option>
                </select>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                  {language === 'bn'
                    ? 'ℹ️ জিমেইল ও Google Sign-In শুধুমাত্র অ্যাডমিনদের জন্য। সাধারণ সদস্যগণ শুধুমাত্র মোবাইল নম্বর দিয়ে নিবন্ধন করবেন।'
                    : 'ℹ️ Gmail & Google Sign-In are exclusively for Admins. Regular members register with phone numbers only.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'অস্থায়ী পাসওয়ার্ড (Temporary Password)' : 'Temporary Password'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: temp1234"
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {language === 'bn'
                    ? '💡 তিনি এই জিমেইল ও অস্থায়ী পাসওয়ার্ড অথবা Google Sign-In দিয়ে লগইন করতে পারবেন এবং পরে পাসওয়ার্ড পরিবর্তন করতে পারবেন।'
                    : '💡 They can log in with this Gmail and temporary password or using Sign in with Google.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User (Main Admin Only) */}
      {editingUser && isMainAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              {language === 'bn' ? 'ব্যবহারকারীর রোল ও স্ট্যাটাস সম্পাদনা' : 'Edit User Privileges'}
            </h3>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">{editingUser.name || editingUser.displayName}</div>
                <div className="text-slate-500 font-mono mt-0.5">{editingUser.email || editingUser.username}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.role}
                </label>
                <select
                  disabled={isTargetMainAdmin(editingUser)}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60"
                >
                  <option value="admin">{t.roleAdmin} (Admin)</option>
                  <option value="president">{t.rolePresident} (President)</option>
                  <option value="treasurer">{t.roleTreasurer} (Treasurer)</option>
                  <option value="secretary">{t.roleSecretary} (Secretary)</option>
                </select>
                {isTargetMainAdmin(editingUser) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    {language === 'bn' ? 'প্রধান সুপার অ্যাডমিনের রোল অপরিবর্তনীয়।' : 'Main Admin role cannot be modified.'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.status}
                </label>
                <select
                  disabled={isTargetMainAdmin(editingUser)}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60"
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                {isMainAdmin && !isTargetMainAdmin(editingUser) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const toDel = editingUser;
                      setEditingUser(null);
                      setUserToDelete(toDel);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                  >
                    {t.save}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
