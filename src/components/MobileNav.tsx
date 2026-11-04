import React from 'react';
import { Language, UserAccount } from '../types';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  PiggyBank,
  LogIn,
  LogOut,
  User,
  Phone,
  Key,
} from 'lucide-react';

interface MobileNavProps {
  currentUser: UserAccount;
  language: Language;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenRegister?: () => void;
  onOpenLogin?: () => void;
  onOpenMemberLogin?: () => void;
  onOpenAdminLogin?: () => void;
  onLogout?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentUser,
  language,
  currentTab,
  onSelectTab,
  onOpenRegister,
  onOpenLogin,
  onOpenMemberLogin,
  onOpenAdminLogin,
  onLogout,
}) => {
  const isLoggedIn = currentUser.userId !== 'USR-VIEW-ONLY' && currentUser.userId !== 'guest';

  const handleMemberLoginClick = onOpenMemberLogin || onOpenLogin || (() => {});
  const handleAdminLoginClick = onOpenAdminLogin || onOpenLogin || (() => {});

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 lg:hidden px-3 py-1.5 flex items-center justify-around shadow-lg print:hidden">
      {/* 1. Home - Always visible with slight zoom effect */}
      <button
        onClick={() => onSelectTab('dashboard')}
        className={`group flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer ${
          currentTab === 'dashboard'
            ? 'text-amber-600 dark:text-amber-400 font-bold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
        title={language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'}
      >
        <LayoutDashboard className="w-5 h-5 transition-transform duration-200 group-hover:scale-115" />
        <span className="transition-transform duration-200 group-hover:scale-105">{language === 'bn' ? 'হোম' : 'Home'}</span>
      </button>

      {/* Without logging in: Unified Login Option */}
      {!isLoggedIn ? (
        <button
          onClick={onOpenLogin || handleMemberLoginClick}
          className="group flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer"
          title={language === 'bn' ? 'লগইন (সদস্য ও অ্যাডমিন)' : 'Login (Members & Admins)'}
        >
          <LogIn className="w-5 h-5 transition-transform duration-200 group-hover:scale-115 text-amber-600 dark:text-amber-400" />
          <span className="transition-transform duration-200 group-hover:scale-105 font-bold">
            {language === 'bn' ? 'লগইন' : 'Login'}
          </span>
        </button>
      ) : (
        /* Once logged in: ALL information becomes visible! */
        <>
          {/* Member Profile / Members Directory */}
          <button
            onClick={() => onSelectTab(currentUser.role === 'member' ? 'member_dashboard' : 'members')}
            className={`group flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer ${
              currentTab === 'members' || (currentUser.role === 'member' && currentTab === 'member_dashboard')
                ? 'text-amber-600 dark:text-amber-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
            title={currentUser.role === 'member' ? (language === 'bn' ? 'আমার হিসাব' : 'My Passbook') : (language === 'bn' ? 'সদস্য তালিকা' : 'Members')}
          >
            {currentUser.role === 'member' ? (
              <User className="w-5 h-5 transition-transform duration-200 group-hover:scale-115" />
            ) : (
              <Users className="w-5 h-5 transition-transform duration-200 group-hover:scale-115" />
            )}
            <span className="transition-transform duration-200 group-hover:scale-105">
              {currentUser.role === 'member' ? (language === 'bn' ? 'আমার প্রোফাইল' : 'Profile') : (language === 'bn' ? 'সদস্য' : 'Member')}
            </span>
          </button>

          {/* Members List (for members) or Monthly Savings (for admins) */}
          {currentUser.role === 'member' ? (
            <button
              onClick={() => onSelectTab('members')}
              className={`group flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer ${
                currentTab === 'members'
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title={language === 'bn' ? 'সদস্য তালিকা' : 'Members'}
            >
              <Users className="w-5 h-5 transition-transform duration-200 group-hover:scale-115" />
              <span className="transition-transform duration-200 group-hover:scale-105">{language === 'bn' ? 'সদস্য' : 'Members'}</span>
            </button>
          ) : (
            <button
              onClick={() => onSelectTab('contributions')}
              className={`group flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer ${
                currentTab === 'contributions'
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title={language === 'bn' ? 'মাসিক সঞ্চয়' : 'Savings'}
            >
              <PiggyBank className="w-5 h-5 transition-transform duration-200 group-hover:scale-115" />
              <span className="transition-transform duration-200 group-hover:scale-105">{language === 'bn' ? 'সঞ্চয়' : 'Savings'}</span>
            </button>
          )}

          {/* Loans - Visible to both Members and Admins to view loan manager, borrowers & outstanding balances! */}
          <button
            onClick={() => onSelectTab('loans')}
            className={`group flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer ${
              currentTab === 'loans'
                ? 'text-amber-600 dark:text-amber-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
            title={language === 'bn' ? 'ঋণ ব্যবস্থাপনা ও বকেয়া স্থিতি' : 'Loans & Outstanding Balances'}
          >
            <CreditCard className="w-5 h-5 transition-transform duration-200 group-hover:scale-115" />
            <span className="transition-transform duration-200 group-hover:scale-105">{language === 'bn' ? 'ঋণ' : 'Loans'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="group flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer"
            title={language === 'bn' ? 'লগআউট' : 'Logout'}
          >
            <LogOut className="w-5 h-5 transition-transform duration-200 group-hover:scale-115" />
            <span className="transition-transform duration-200 group-hover:scale-105">{language === 'bn' ? 'লগআউট' : 'Logout'}</span>
          </button>
        </>
      )}
    </nav>
  );
};
