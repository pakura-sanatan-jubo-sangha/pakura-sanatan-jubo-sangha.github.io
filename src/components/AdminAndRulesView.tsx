import React, { useState } from 'react';
import {
  UserAccount,
  UserRole,
  Language,
  SocietyRule,
  RuleCategory,
  GeneralMeeting,
  MeetingAttendee,
  Member,
} from '../types';
import { getTranslation, formatMemberPhone } from '../lib/translations';
import { isStrictMainAdmin, MAIN_ADMIN_EMAIL, StorageService } from '../lib/storage';
import { FirebaseSyncService } from '../lib/firebaseSync';
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
  Scale,
  Plus,
  Calendar,
  Search,
  Printer,
  FileText,
  Clock,
  BookOpen,
  Check,
  Users,
  CheckSquare,
  Square,
  UserCheck,
  History,
  MapPin,
  CalendarClock,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
} from 'lucide-react';

interface AdminAndRulesViewProps {
  users: UserAccount[];
  rules: SocietyRule[];
  currentUser: UserAccount;
  language: Language;
  meetings?: GeneralMeeting[];
  members?: Member[];
  onAddUser: (email: string, name: string, role: UserRole, tempPassword?: string) => Promise<void> | void;
  onUpdateRole: (userId: string, role: UserRole, status: 'active' | 'inactive') => void;
  onDeleteUser: (userId: string) => void;
  onAddRule: (rule: Omit<SocietyRule, 'ruleId' | 'createdAt' | 'updatedAt' | 'addedBy' | 'addedByEmail'>) => void;
  onUpdateRule: (ruleId: string, updates: Partial<SocietyRule>) => void;
  onDeleteRule: (ruleId: string) => void;
  onCreateMeeting?: (meeting: { title: string; meetingDate: string; scheduledTime: string; location: string; agenda?: string; notes?: string }) => void;
  onRecordAttendance?: (meetingId: string, attendees: MeetingAttendee[], notes?: string) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onPasswordUpdated?: (message?: string) => void;
}

export const AdminAndRulesView: React.FC<AdminAndRulesViewProps> = ({
  users,
  rules = [],
  currentUser,
  language,
  meetings = [],
  members = [],
  onAddUser,
  onUpdateRole,
  onDeleteUser,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onCreateMeeting,
  onRecordAttendance,
  onDeleteMeeting,
  onPasswordUpdated,
}) => {
  const t = getTranslation(language);
  const isAdmin = currentUser.role === 'admin';
  const [activeTab, setActiveTab] = useState<'rules' | 'admins' | 'meetings'>('rules');

  // Privacy sanitizer: General members can see the full Rules & Regulations, but without seeing any Gmail/email addresses
  const sanitizeEmail = (text: string | undefined): string => {
    if (!text) return '';
    if (isAdmin) return text;
    const trimmed = text.trim();
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(trimmed)) {
      return language === 'bn' ? 'সমিতি প্রশাসন' : 'Society Administration';
    }
    return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, () => {
      return language === 'bn' ? 'সমিতি প্রশাসন' : 'Society Administration';
    });
  };

  // If user is not admin, prevent activeTab from being 'admins'
  React.useEffect(() => {
    if (!isAdmin && activeTab === 'admins') {
      setActiveTab('rules');
    }
  }, [isAdmin, activeTab]);

  // Meetings & Attendance states
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDate, setNewMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMeetingTime, setNewMeetingTime] = useState('');
  const [newMeetingLocation, setNewMeetingLocation] = useState('সমিতির কার্যালয়');
  const [newMeetingAgenda, setNewMeetingAgenda] = useState('');

  const [recordingAttendanceMeeting, setRecordingAttendanceMeeting] = useState<GeneralMeeting | null>(null);
  const [attendanceAttendees, setAttendanceAttendees] = useState<MeetingAttendee[]>([]);
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [viewingAttendanceMeeting, setViewingAttendanceMeeting] = useState<GeneralMeeting | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<GeneralMeeting | null>(null);

  // Admin user states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');
  const [newTempPassword, setNewTempPassword] = useState('temp1234');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Self-service Admin Password Change states (for both Main Admin & Auxiliary Admins)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passConfirmEmailInput, setPassConfirmEmailInput] = useState('');
  const [currPassInput, setCurrPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showPassFields, setShowPassFields] = useState(false);
  const [passChangeError, setPassChangeError] = useState<string | null>(null);
  const [passChangeSuccess, setPassChangeSuccess] = useState<string | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  // Society Rules states
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SocietyRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<SocietyRule | null>(null);

  // New Rule form inputs
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDate, setRuleDate] = useState(new Date().toISOString().split('T')[0]);
  const [ruleCategory, setRuleCategory] = useState<RuleCategory>('general');
  const [ruleDetails, setRuleDetails] = useState('');
  const [resolutionNo, setResolutionNo] = useState('');

  // Rules filtering
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<string>('all');
  const [ruleSearch, setRuleSearch] = useState('');

  const isMainAdmin = isStrictMainAdmin(currentUser);

  const isTargetMainAdmin = (u: UserAccount) => {
    return (
      isStrictMainAdmin(u) ||
      u.email?.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase() ||
      u.userId === 'USR-MAIN-ADMIN'
    );
  };

  // Only display sub-accounts / assigned admins created by the Main Admin
  const managedUsers = users.filter((u) => !isTargetMainAdmin(u));

  // Handle Add User Submit (Strictly Main Admin Only)
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) return;
    if (!newEmail.trim() || !newName.trim()) return;
    setIsAddingAdmin(true);
    try {
      await onAddUser(
        newEmail.trim().toLowerCase(),
        newName.trim(),
        newRole,
        newTempPassword.trim() || 'temp1234'
      );
      setNewEmail('');
      setNewName('');
      setNewTempPassword('temp1234');
      setShowAddUserModal(false);
    } finally {
      setIsAddingAdmin(false);
    }
  };

  // Handle Edit User Submit (Strictly Main Admin Only)
  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) return;
    if (!editingUser) return;
    onUpdateRole(editingUser.userId, editRole, editStatus);
    setEditingUser(null);
  };

  // Handle Delete User (Strictly Main Admin Only)
  const handleConfirmDeleteUser = () => {
    if (!isMainAdmin) return;
    if (!userToDelete) return;
    onDeleteUser(userToDelete.userId);
    setUserToDelete(null);
  };

  // Handle Self-Service Admin Password Change (Main Admin or Auxiliary Admin -> Verified & Synced to Firebase)
  const handleAdminSelfPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeError(null);
    setPassChangeSuccess(null);

    if (!passConfirmEmailInput.trim()) {
      setPassChangeError(
        language === 'bn'
          ? 'নিরাপত্তার স্বার্থে আপনার অ্যাকাউন্টের নিবন্ধিত জিমেইল ঠিকানা নিজ হাতে লিখুন।'
          : 'Please manually enter your registered account Gmail address.'
      );
      return;
    }

    if (newPassInput.trim() !== confirmPassInput.trim()) {
      setPassChangeError(
        language === 'bn' ? 'নতুন পাসওয়ার্ড দুটি মেলেনি!' : 'New passwords do not match!'
      );
      return;
    }

    if (newPassInput.trim().length < 4) {
      setPassChangeError(
        language === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।'
          : 'Password must be at least 4 characters long.'
      );
      return;
    }

    setIsUpdatingPass(true);
    try {
      const emailCheck = await FirebaseSyncService.verifyAccountEmailInFirebase(
        currentUser,
        passConfirmEmailInput
      );
      if (!emailCheck.authorized) {
        setPassChangeError(emailCheck.message);
        return;
      }

      const res = isMainAdmin
        ? await StorageService.updateAdminPasswordWithFirebaseSync(
            currPassInput.trim(),
            newPassInput.trim(),
            currentUser
          )
        : await StorageService.changeUserPasswordAndSyncFirebase(
            currentUser.userId,
            newPassInput.trim(),
            currPassInput.trim()
          );

      if (!res.success) {
        setPassChangeError(res.message);
      } else {
        const msg =
          language === 'bn'
            ? 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে এবং ফায়ারবেসে হালনাগাদ করা হয়েছে!'
            : 'Password updated successfully and synced to Firebase!';
        setPassChangeSuccess(msg);
        setPassConfirmEmailInput('');
        setCurrPassInput('');
        setNewPassInput('');
        setConfirmPassInput('');
        if (onPasswordUpdated) onPasswordUpdated(msg);
        setTimeout(() => {
          setShowChangePasswordModal(false);
          setPassChangeSuccess(null);
        }, 1200);
      }
    } catch (err: any) {
      setPassChangeError(
        err?.message ||
          (language === 'bn'
            ? 'ফায়ারবেসে পাসওয়ার্ড হালনাগাদ করতে সমস্যা হয়েছে।'
            : 'Error updating password in Firebase.')
      );
    } finally {
      setIsUpdatingPass(false);
    }
  };

  // Handle Add/Edit Rule Submit
  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !ruleDetails.trim()) return;

    if (editingRule) {
      onUpdateRule(editingRule.ruleId, {
        title: ruleTitle.trim(),
        meetingDate: ruleDate,
        category: ruleCategory,
        decisionDetails: ruleDetails.trim(),
        resolutionNumber: resolutionNo.trim() || undefined,
      });
      setEditingRule(null);
    } else {
      onAddRule({
        title: ruleTitle.trim(),
        meetingDate: ruleDate,
        category: ruleCategory,
        decisionDetails: ruleDetails.trim(),
        resolutionNumber: resolutionNo.trim() || undefined,
        status: 'active',
      });
    }

    setRuleTitle('');
    setRuleDetails('');
    setResolutionNo('');
    setShowAddRuleModal(false);
  };

  const openEditRuleModal = (rule: SocietyRule) => {
    setEditingRule(rule);
    setRuleTitle(rule.title);
    setRuleDate(rule.meetingDate);
    setRuleCategory(rule.category);
    setRuleDetails(rule.decisionDetails);
    setResolutionNo(rule.resolutionNumber || '');
    setShowAddRuleModal(true);
  };

  const handleConfirmDeleteRule = () => {
    if (!ruleToDelete) return;
    onDeleteRule(ruleToDelete.ruleId);
    setRuleToDelete(null);
  };

  // General Meetings Handlers
  const [attendanceSearch, setAttendanceSearch] = useState('');

  const handleCreateMeetingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingTitle.trim() || !newMeetingDate) return;
    if (onCreateMeeting) {
      onCreateMeeting({
        title: newMeetingTitle.trim(),
        meetingDate: newMeetingDate,
        scheduledTime: newMeetingTime.trim() || '',
        location: newMeetingLocation.trim() || 'সমিতির কার্যালয়',
        agenda: newMeetingAgenda.trim(),
      });
    }
    setNewMeetingTitle('');
    setNewMeetingAgenda('');
    setShowCreateMeetingModal(false);
  };

  const openRecordAttendanceModal = (meeting: GeneralMeeting) => {
    setRecordingAttendanceMeeting(meeting);
    setAttendanceNotes(meeting.notes || '');
    setAttendanceSearch('');
    if (meeting.attendees && meeting.attendees.length > 0) {
      // Merge in any newly added members who might not be in the existing meeting.attendees
      const existingMap = new Map(meeting.attendees.map((a) => [a.memberSystemId, a]));
      const fullList: MeetingAttendee[] = members.map((m) => {
        if (existingMap.has(m.systemId)) {
          return existingMap.get(m.systemId)!;
        }
        return {
          memberSystemId: m.systemId,
          memberName: m.name,
          phone: m.phone,
          status: 'present',
        };
      });
      setAttendanceAttendees(fullList);
    } else {
      const activeMembers = members.filter((m) => m.status === 'active');
      const targetMembers = activeMembers.length > 0 ? activeMembers : members;
      const initial: MeetingAttendee[] = targetMembers.map((m) => ({
        memberSystemId: m.systemId,
        memberName: m.name,
        phone: m.phone,
        status: 'present',
      }));
      setAttendanceAttendees(initial);
    }
  };

  const handleToggleAttendeeStatus = (memberSystemId: string) => {
    setAttendanceAttendees((prev) =>
      prev.map((a) =>
        a.memberSystemId === memberSystemId
          ? { ...a, status: a.status === 'present' ? 'absent' : 'present' }
          : a
      )
    );
  };

  const handleMarkAllAttendance = (status: 'present' | 'absent') => {
    setAttendanceAttendees((prev) =>
      prev.map((a) => ({ ...a, status }))
    );
  };

  const handleSaveAttendance = () => {
    if (!recordingAttendanceMeeting || !onRecordAttendance) return;
    onRecordAttendance(
      recordingAttendanceMeeting.meetingId,
      attendanceAttendees,
      attendanceNotes
    );
    setRecordingAttendanceMeeting(null);
  };

  const handleConfirmDeleteMeeting = () => {
    if (!meetingToDelete || !onDeleteMeeting) return;
    onDeleteMeeting(meetingToDelete.meetingId);
    setMeetingToDelete(null);
  };

  // Filtered Rules
  const filteredRules = rules.filter((r) => {
    const q = ruleSearch.toLowerCase().trim();
    const titleMatch = (r.title || '').toLowerCase().includes(q);
    const detailsMatch = (r.decisionDetails || '').toLowerCase().includes(q);
    const dateMatch = (r.meetingDate || '').includes(q);
    const matchesSearch = !q || titleMatch || detailsMatch || dateMatch;

    if (!matchesSearch) return false;
    if (ruleCategoryFilter === 'all') return true;
    return r.category === ruleCategoryFilter;
  });

  const getCategoryBadge = (cat: RuleCategory) => {
    switch (cat) {
      case 'savings':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'loan':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'meeting':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'discipline':
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'welfare':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getCategoryLabel = (cat: RuleCategory) => {
    switch (cat) {
      case 'savings':
        return language === 'bn' ? 'মাসিক সঞ্চয় ও চাঁদা' : 'Savings & Contributions';
      case 'loan':
        return language === 'bn' ? 'ঋণ নীতিমালা' : 'Loan Policy';
      case 'meeting':
        return language === 'bn' ? 'সাধারণ সভা ও সিদ্ধান্ত' : 'Meeting Resolution';
      case 'discipline':
        return language === 'bn' ? 'শৃঙ্খলা ও আচরণবিধি' : 'Discipline & Conduct';
      case 'welfare':
        return language === 'bn' ? 'কল্যাণ ও অনুদান' : 'Welfare & Charity';
      default:
        return language === 'bn' ? 'সাধারণ নিয়ম' : 'General Rules';
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span>{language === 'bn' ? 'অ্যাডমিন ও নিয়মাবলি' : 'Admin & Rules'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'সমিতির সভার সিদ্ধান্তসমূহ, প্রাতিষ্ঠানিক নিয়মাবলি এবং সহকারী অ্যাডমিন ব্যবস্থাপনা'
              : 'Society meeting decisions, institutional rules & administrative delegation'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{language === 'bn' ? 'সমিতির নিয়মাবলি ও সিদ্ধান্ত' : 'Rules & Decisions'}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {rules.length}
            </span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admins')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{language === 'bn' ? 'সহকারী অ্যাডমিন' : 'Admins'}</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                {managedUsers.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('meetings')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'meetings'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{language === 'bn' ? 'সাধারণ সভা ও হাজিরা' : 'Meetings & Attendance'}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              {meetings.length}
            </span>
          </button>
        </div>
      </div>

      {/* Printable Rules Document Header */}
      {activeTab === 'rules' && (
        <div className="hidden print:block text-center pb-4 mb-4 border-b border-slate-300">
          <div className="text-xs font-bold text-amber-700">🕉️ ওঁ শ্রী শ্রী গুরুবে নমঃ</div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">পাকুড়া সনাতন যুব সংঘ</h1>
          <p className="text-xs text-slate-600">সমিতির সাধারণ সভা ও রেজোলিউশন বই (Official Bylaws & Resolutions)</p>
          <div className="text-[11px] text-slate-500 mt-1">
            {language === 'bn' ? 'মুদ্রণ তারিখ:' : 'Printed on:'} {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'full' })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: RULES & MEETING DECISIONS                                */}
      {/* ============================================================== */}
      {activeTab === 'rules' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Rules Action Header Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white flex-shrink-0 mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  {language === 'bn'
                    ? 'সমিতির সভার সিদ্ধান্তসমূহ ও রেজোলিউশন বই'
                    : 'Society Meeting Resolutions & Rule Book'}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
              <button
                onClick={() => window.print()}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Print Rules"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
              </button>

              {isMainAdmin && (
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setRuleTitle('');
                    setRuleDetails('');
                    setResolutionNo('');
                    setRuleDate(new Date().toISOString().split('T')[0]);
                    setRuleCategory('general');
                    setShowAddRuleModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'bn' ? 'সভার নতুন সিদ্ধান্ত যোগ করুন' : 'Add Meeting Decision'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtering and Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: language === 'bn' ? 'সকল সিদ্ধান্ত' : 'All Decisions' },
                { id: 'general', label: language === 'bn' ? 'সাধারণ' : 'General' },
                { id: 'savings', label: language === 'bn' ? 'সঞ্চয় ও চাঁদা' : 'Savings' },
                { id: 'loan', label: language === 'bn' ? 'ঋণ' : 'Loans' },
                { id: 'meeting', label: language === 'bn' ? 'সভা' : 'Meetings' },
                { id: 'discipline', label: language === 'bn' ? 'শৃঙ্খলা' : 'Discipline' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setRuleCategoryFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    ruleCategoryFilter === pill.id
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-amber-400'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64 flex-shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === 'bn' ? 'সিদ্ধান্ত বা বিষয় খুঁজুন...' : 'Search decisions...'}
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Rules List Cards */}
          {filteredRules.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {language === 'bn' ? 'কোনো সভার সিদ্ধান্ত বা নিয়মাবলি এখনো যোগ করা হয়নি' : 'No Meeting Decisions Recorded Yet'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                {language === 'bn'
                  ? 'মাসিক বা সাধারণ সভার সিদ্ধান্তসমূহ আপনি একে একে এখানে যুক্ত করতে পারবেন। নতুন সিদ্ধান্ত যোগ করতে উপরের "সভার নতুন সিদ্ধান্ত যোগ করুন" বোতামে চাপুন।'
                  : 'You can manually record decisions made during society meetings one by one. Use the button above to add the first resolution.'}
              </p>
              {isMainAdmin && (
                <button
                  onClick={() => setShowAddRuleModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'bn' ? 'প্রথম সিদ্ধান্ত যোগ করুন' : 'Record First Decision'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRules.map((rule, idx) => (
                <div
                  key={rule.ruleId}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800/80 transition-all shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                          {sanitizeEmail(rule.title)}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getCategoryBadge(rule.category)}`}>
                          {getCategoryLabel(rule.category)}
                        </span>
                        {rule.resolutionNumber && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {sanitizeEmail(rule.resolutionNumber)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>{language === 'bn' ? 'সভার তারিখ:' : 'Meeting Date:'} {rule.meetingDate}</span>
                        </span>
                        <span>•</span>
                        <span>{language === 'bn' ? 'লিপিবদ্ধকারী:' : 'Recorded by:'} {sanitizeEmail(rule.addedBy)}</span>
                      </div>
                    </div>

                    {isMainAdmin && (
                      <div className="flex items-center gap-1 self-end sm:self-start flex-shrink-0">
                        <button
                          onClick={() => openEditRuleModal(rule)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title={language === 'bn' ? 'সম্পাদনা করুন' : 'Edit Decision'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRuleToDelete(rule)}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete Decision'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50/60 dark:bg-slate-800/30 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                    {sanitizeEmail(rule.decisionDetails)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: GENERAL ADMINS MANAGEMENT (Only accessible to Admins)     */}
      {/* ============================================================== */}
      {isAdmin && activeTab === 'admins' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Main Admin Permanent Status Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                KC
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    কাজল চন্দ্র দাস (Kajol Chandra Das)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                    MAIN ADMIN
                  </span>
                  {isMainAdmin && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                      {language === 'bn' ? 'আপনি' : 'You'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {language === 'bn' ? 'স্থায়ী প্রধান অ্যাডমিন (সুরক্ষিত)' : 'Permanent Main Admin (Protected)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setPassChangeError(null);
                  setPassChangeSuccess(null);
                  setPassConfirmEmailInput('');
                  setCurrPassInput('');
                  setNewPassInput('');
                  setConfirmPassInput('');
                  setShowChangePasswordModal(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <Key className="w-4 h-4 text-amber-600" />
                <span>{language === 'bn' ? 'আমার পাসওয়ার্ড পরিবর্তন' : 'Change My Password'}</span>
              </button>

              {isMainAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isMainAdmin) return;
                    setShowAddUserModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{language === 'bn' ? 'সহকারী অ্যাডমিন যোগ করুন' : 'Add Admin'}</span>
                </button>
              )}
            </div>
          </div>

          {!isMainAdmin && (
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                {language === 'bn'
                  ? 'নতুন অ্যাডমিন যোগ করা, রোল পরিবর্তন করা বা অ্যাডমিন অপসারণের অধিকার শুধুমাত্র প্রধান অ্যাডমিনের জন্য সংরক্ষিত। তবে আপনি আপনার নিজের পাসওয়ার্ড পরিবর্তন করতে পারবেন (যা সরাসরি ফায়ারবেসে আপডেট হবে)।'
                  : 'Only the Main Admin is permitted to add, edit, or remove admins. You can update your own password at any time (synced to Firebase).'}
              </span>
            </div>
          )}

          {/* Assigned Admins Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {managedUsers.length === 0 ? (
              <div className="py-14 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
                  <Shield className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {language === 'bn' ? 'কোনো সহকারী অ্যাডমিন যুক্ত করা হয়নি' : 'No Auxiliary Admins Added Yet'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  {language === 'bn'
                    ? 'আপনি প্রধান অ্যাডমিন হিসেবে একক দায়িত্বে আছেন। অন্য কাউকে সহকারী অ্যাডমিন একাউন্ট দিতে তাদের জিমেইল ও একটি অস্থায়ী পাসওয়ার্ড দিয়ে একাউন্ট তৈরি করে দিন।'
                    : 'You hold full Main Admin custody. Click "+ Add Admin" to create a standard admin account for another person with a temporary password.'}
                </p>
                {isMainAdmin && (
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{language === 'bn' ? 'সহকারী অ্যাডমিন তৈরি করুন' : 'Add First Admin'}</span>
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
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
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
                                    title={language === 'bn' ? 'অ্যাডমিন অপসারণ' : 'Delete User'}
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
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: GENERAL MEETINGS & VERIFIABLE ATTENDANCE RECORDS        */}
      {/* ============================================================== */}
      {activeTab === 'meetings' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Header Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-amber-500/5 to-transparent border border-purple-200 dark:border-purple-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-600 text-white flex-shrink-0 mt-0.5 shadow-2xs">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                  <span>{language === 'bn' ? 'সাধারণ সভার সময়সূচি ও উপস্থিতির প্রমাণসিদ্ধ রেকর্ড' : 'General Meeting Schedules & Verifiable Attendance'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    {meetings.length} {language === 'bn' ? 'টি সভা' : 'Meetings'}
                  </span>
                </h4>
              </div>
            </div>

            {isMainAdmin && (
              <button
                type="button"
                onClick={() => {
                  setNewMeetingTitle(language === 'bn' ? 'মাসিক সাধারণ সভা' : 'Monthly General Meeting');
                  setNewMeetingDate(new Date().toISOString().split('T')[0]);
                  setNewMeetingTime('');
                  setNewMeetingLocation('সমিতির কার্যালয়');
                  setNewMeetingAgenda('');
                  setShowCreateMeetingModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-xs transition-all self-start md:self-auto cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'bn' ? 'নতুন সভার নোটিশ জারি করুন' : 'Schedule Meeting'}</span>
              </button>
            )}
          </div>

          {/* Meeting Cards List */}
          {meetings.length === 0 ? (
            <div className="py-14 px-4 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {language === 'bn' ? 'এখনও কোনো সাধারণ সভা তৈরি করা হয়নি' : 'No Meetings Scheduled Yet'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {language === 'bn'
                  ? 'সাধারণ সভার তারিখ ও নির্ধারিত সময় দিয়ে নোটিশ তৈরি করুন এবং সভা শেষে সদস্যদের উপস্থিতি নিশ্চিত করুন।'
                  : 'Create a meeting notice with scheduled date and time, and record member attendance after the session.'}
              </p>
              {isMainAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateMeetingModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'bn' ? 'প্রথম সভার নোটিশ তৈরি করুন' : 'Schedule First Meeting'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meetings.map((meeting) => {
                const totalAttendees = meeting.attendees?.length || 0;
                const presentCount = meeting.attendees?.filter((a) => a.status === 'present').length || 0;
                const absentCount = totalAttendees - presentCount;
                const attendanceRate = totalAttendees > 0 ? Math.round((presentCount / totalAttendees) * 100) : 0;
                const isRecorded = meeting.attendanceRecorded;

                return (
                  <div
                    key={meeting.meetingId}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-300 dark:hover:border-purple-700/60 transition-all"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                          {meeting.meetingId}
                        </span>
                        {isRecorded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{language === 'bn' ? '✓ হাজিরা যাচাইকৃত' : 'Attendance Verified'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>{language === 'bn' ? 'হাজিরা অপেক্ষমাণ' : 'Pending Attendance'}</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Scheduled Time */}
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                          {sanitizeEmail(meeting.title)}
                        </h3>
                        <div className="mt-2 flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>{meeting.meetingDate}</span>
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            <span>{language === 'bn' ? `নির্ধারিত সময়: ${meeting.scheduledTime}` : `Scheduled: ${meeting.scheduledTime}`}</span>
                          </span>
                          {meeting.location && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3 h-3" />
                                <span>{sanitizeEmail(meeting.location)}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Agenda */}
                      {meeting.agenda && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                          <strong className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                            {language === 'bn' ? 'আলোচ্যসূচি / এজেন্ডা:' : 'Meeting Agenda:'}
                          </strong>
                          {sanitizeEmail(meeting.agenda)}
                        </div>
                      )}

                      {/* Attendance Tally Metrics */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-slate-500">
                            {language === 'bn' ? 'উপস্থিতির হার:' : 'Attendance Rate:'}
                          </span>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                              {presentCount} / {totalAttendees} {language === 'bn' ? 'জন উপস্থিত' : 'Present'}
                            </span>
                            <span className="text-slate-400">({attendanceRate}%)</span>
                          </div>
                        </div>

                        {absentCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {absentCount} {language === 'bn' ? 'জন অনুপস্থিত' : 'Absent'}
                          </span>
                        )}
                      </div>

                      {/* Verification Stamp */}
                      {meeting.recordedBy && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {language === 'bn' ? 'যাচাইকারী অ্যাডমিন:' : 'Verified By:'}{' '}
                            <strong className="text-slate-700 dark:text-slate-200">{sanitizeEmail(meeting.recordedBy)}</strong>{' '}
                            ({meeting.recordedAt})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openRecordAttendanceModal(meeting)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>
                            {isRecorded
                              ? (language === 'bn' ? 'হাজিরা সংশোধন' : 'Update Attendance')
                              : (language === 'bn' ? 'হাজিরা গ্রহণ করুন' : 'Record Attendance')}
                          </span>
                        </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setViewingAttendanceMeeting(meeting)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'তালিকা দেখুন' : 'View List'}</span>
                        </button>
                      </div>

                      {isMainAdmin && (
                        <button
                          type="button"
                          onClick={() => setMeetingToDelete(meeting)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-all"
                          title={language === 'bn' ? 'সভা মুছে ফেলুন' : 'Delete Meeting'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT SOCIETY RULE                                  */}
      {/* ============================================================== */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <span>
                  {editingRule
                    ? language === 'bn' ? 'সভার সিদ্ধান্ত সম্পাদন' : 'Edit Meeting Decision'
                    : language === 'bn' ? 'সভার নতুন সিদ্ধান্ত ও নিয়মাবলি যুক্ত করুন' : 'Record New Meeting Decision'}
                </span>
              </h3>
              <button
                onClick={() => setShowAddRuleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRuleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'সিদ্ধান্ত / নিয়মের শিরোনাম' : 'Decision / Rule Title'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'bn' ? 'যেমন: মাসিক সঞ্চয় জমাদানের সময়সীমা নির্ধারণ' : 'e.g. Monthly Savings Due Date Policy'}
                  value={ruleTitle}
                  onChange={(e) => setRuleTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'সভার তারিখ' : 'Meeting Date'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={ruleDate}
                    onChange={(e) => setRuleDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'বিভাগ / ক্যাটাগরি' : 'Category'}
                  </label>
                  <select
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value as RuleCategory)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="general">{language === 'bn' ? 'সাধারণ নিয়ম' : 'General Rules'}</option>
                    <option value="savings">{language === 'bn' ? 'মাসিক সঞ্চয় ও চাঁদা' : 'Savings & Contributions'}</option>
                    <option value="loan">{language === 'bn' ? 'ঋণ নীতিমালা' : 'Loan Policy'}</option>
                    <option value="meeting">{language === 'bn' ? 'সাধারণ সভা ও সিদ্ধান্ত' : 'Meeting Resolution'}</option>
                    <option value="discipline">{language === 'bn' ? 'শৃঙ্খলা ও আচরণবিধি' : 'Discipline & Conduct'}</option>
                    <option value="welfare">{language === 'bn' ? 'কল্যাণ ও অনুদান' : 'Welfare'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'রেজোলিউশন / সভার ক্রমিক নং (ঐচ্ছিক)' : 'Resolution / Ref No. (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'যেমন: রেজোলিউশন নং-০৫/২০২৫' : 'e.g. Resolution #05/2025'}
                  value={resolutionNo}
                  onChange={(e) => setResolutionNo(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'বিস্তারিত সিদ্ধান্ত ও সভার রেজোলিউশন' : 'Decision Details & Resolution Text'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={
                    language === 'bn'
                      ? 'সভায় গৃহীত সর্বসম্মত সিদ্ধান্তটি বিস্তারিতভাবে এখানে লিখুন...'
                      : 'Enter the complete resolution details agreed upon during the meeting...'
                  }
                  value={ruleDetails}
                  onChange={(e) => setRuleDetails(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white leading-relaxed resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                >
                  {editingRule ? (language === 'bn' ? 'হালনাগাদ করুন' : 'Update') : (language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Decision')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE RULE CONFIRMATION                                */}
      {/* ============================================================== */}
      {ruleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-red-600">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সিদ্ধান্ত মুছে ফেলা' : 'Delete Meeting Decision'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'প্রধান অ্যাডমিনের অনুমোদন প্রয়োজন' : 'Main Admin Authorization'}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'bn'
                ? `আপনি কি নিশ্চিত যে "${ruleToDelete.title}" সিদ্ধান্তটি স্থায়ীভাবে মুছে ফেলতে চান?`
                : `Are you sure you want to permanently delete the decision "${ruleToDelete.title}"?`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRuleToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRule}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{language === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD SUB-ADMIN USER (MAIN ADMIN ONLY -> FIREBASE SYNC)   */}
      {/* ============================================================== */}
      {showAddUserModal && isMainAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <span>{language === 'bn' ? 'সহকারী অ্যাডমিন যোগ করুন' : 'Add General Admin'}</span>
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="mt-4 space-y-3.5">
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
                  {language === 'bn' ? 'জিমেইল / ইমেইল (Gmail / Email)' : 'Email'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin2@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
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
                  <option value="admin">{language === 'bn' ? 'সহকারী অ্যাডমিন (General Admin)' : 'General Admin'}</option>
                  <option value="president">{language === 'bn' ? 'সভাপতি (President)' : 'President'}</option>
                  <option value="treasurer">{language === 'bn' ? 'কোষাধ্যক্ষ (Treasurer)' : 'Treasurer'}</option>
                  <option value="secretary">{language === 'bn' ? 'সাধারণ সম্পাদক (Secretary)' : 'Secretary'}</option>
                  <option value="member">{language === 'bn' ? 'সাধারণ সদস্য (Member)' : 'Member'}</option>
                </select>
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
                    ? '💡 তথ্যটি ফায়ারবেসে স্থায়ীভাবে সংরক্ষিত হবে। তিনি লগইন করে পরবর্তীতে পাসওয়ার্ড পরিবর্তন করলে তা ফায়ারবেসেও আপডেট হয়ে যাবে।'
                    : '💡 Saved permanently in Firebase. When they change their password later, it will automatically update in Firebase.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  disabled={isAddingAdmin}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isAddingAdmin}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isAddingAdmin && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT USER ROLE (MAIN ADMIN ONLY)                        */}
      {/* ============================================================== */}
      {editingUser && isMainAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              {language === 'bn' ? 'সহকারী অ্যাডমিনের রোল সম্পাদনা' : 'Edit Admin Role'}
            </h3>

            <form onSubmit={handleEditUserSubmit} className="mt-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">{editingUser.name || editingUser.displayName}</div>
                <div className="text-slate-500 font-mono mt-0.5">{editingUser.email || editingUser.username}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.role}
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="admin">{language === 'bn' ? 'সহকারী অ্যাডমিন (General Admin)' : 'General Admin'}</option>
                  <option value="president">{language === 'bn' ? 'সভাপতি (President)' : 'President'}</option>
                  <option value="treasurer">{language === 'bn' ? 'কোষাধ্যক্ষ (Treasurer)' : 'Treasurer'}</option>
                  <option value="secretary">{language === 'bn' ? 'সাধারণ সম্পাদক (Secretary)' : 'Secretary'}</option>
                  <option value="member">{language === 'bn' ? 'সাধারণ সদস্য (Member)' : 'Member'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.status}
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE NEW MEETING                                      */}
      {/* ============================================================== */}
      {showCreateMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-purple-600" />
                <span>{language === 'bn' ? 'সাধারণ সভার নতুন নোটিশ জারি করুন' : 'Schedule General Meeting'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateMeetingModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMeetingSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'সভার শিরোনাম / বিষয়' : 'Meeting Title / Subject'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'bn' ? 'যেমন: অক্টোবর মাসের নিয়মিত সাধারণ সভা' : 'e.g. Regular Monthly General Meeting'}
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'সভার তারিখ' : 'Meeting Date'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newMeetingDate}
                    onChange={(e) => setNewMeetingDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'bn' ? 'নির্ধারিত সময় (Scheduled Time)' : 'Scheduled Time'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder=""
                    value={newMeetingTime}
                    onChange={(e) => setNewMeetingTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'স্থান / লোকেশন' : 'Meeting Location'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'সমিতির কার্যালয়' : 'Society Office'}
                  value={newMeetingLocation}
                  onChange={(e) => setNewMeetingLocation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'আলোচ্যসূচি / এজেন্ডা' : 'Agenda / Objectives'}
                </label>
                <textarea
                  rows={3}
                  placeholder={language === 'bn' ? '১. মাসিক সঞ্চয় জমা পর্যালোচনা\n২. নতুন ঋণ প্রস্তাবনা অনুমোদন\n৩. বিবিধ' : '1. Review savings\n2. Loan approvals\n3. Miscellaneous'}
                  value={newMeetingAgenda}
                  onChange={(e) => setNewMeetingAgenda(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateMeetingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CalendarClock className="w-4 h-4" />
                  <span>{language === 'bn' ? 'নোটিশ সংরক্ষণ করুন' : 'Schedule Meeting'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: RECORD / UPDATE ATTENDANCE                              */}
      {/* ============================================================== */}
      {recordingAttendanceMeeting && (() => {
        const total = attendanceAttendees.length;
        const present = attendanceAttendees.filter((a) => a.status === 'present').length;
        const absent = total - present;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        const filteredAttendees = attendanceAttendees.filter((a) => {
          if (!attendanceSearch) return true;
          const q = attendanceSearch.toLowerCase();
          return a.memberName.toLowerCase().includes(q) || a.phone.includes(q);
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-purple-600" />
                    <span>{language === 'bn' ? 'সাধারণ সভার উপস্থিতি ও হাজিরা গ্রহণ' : 'Record Meeting Attendance'}</span>
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{recordingAttendanceMeeting.title}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-500" />
                      <span>{recordingAttendanceMeeting.meetingDate}</span>
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{recordingAttendanceMeeting.scheduledTime}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRecordingAttendanceMeeting(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Attendance Quick Tools & Real-Time Stats */}
              <div className="my-3 p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{present} {language === 'bn' ? 'উপস্থিত' : 'Present'}</span>
                  </div>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>{absent} {language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                  </div>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="text-purple-700 dark:text-purple-300 font-bold">
                    {rate}% {language === 'bn' ? 'হাজিরা' : 'Rate'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkAllAttendance('present')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs"
                  >
                    {language === 'bn' ? 'সবাই উপস্থিত' : 'All Present'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkAllAttendance('absent')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-2xs"
                  >
                    {language === 'bn' ? 'সবাই অনুপস্থিত' : 'All Absent'}
                  </button>
                </div>
              </div>

              {/* Search Member Filter */}
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'সদস্যের নাম বা ফোন নম্বর দিয়ে খুঁজুন...' : 'Search member name or phone...'}
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Scrollable Members List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-[220px]">
                {filteredAttendees.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {language === 'bn' ? 'কোনো সদস্য পাওয়া যায়নি।' : 'No members found.'}
                  </div>
                ) : (
                  filteredAttendees.map((att) => {
                    const isPres = att.status === 'present';
                    return (
                      <div
                        key={att.memberSystemId}
                        onClick={() => handleToggleAttendeeStatus(att.memberSystemId)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all select-none ${
                          isPres
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/70 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isPres
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}>
                            {att.memberName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {att.memberName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {formatMemberPhone(att.phone, isAdmin)}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isPres ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-2xs">
                              <Check className="w-3.5 h-3.5" />
                              <span>{language === 'bn' ? 'উপস্থিত' : 'Present'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-2xs">
                              <X className="w-3.5 h-3.5" />
                              <span>{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Notes */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'bn' ? 'সভার মন্তব্য বা কোরাম বিবরণী (ঐচ্ছিক):' : 'Meeting Notes / Quorum Summary (Optional):'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'যেমন: প্রয়োজনীয় কোরাম পূর্ণ হওয়ায় সভা যথাসময়ে সম্পন্ন হয়েছে।' : 'e.g. Quorum met, meeting concluded successfully.'}
                  value={attendanceNotes}
                  onChange={(e) => setAttendanceNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? `যাচাইকারী: ${currentUser.displayName}` : `Certifier: ${currentUser.displayName}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordingAttendanceMeeting(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === 'bn' ? 'হাজিরা সংরক্ষণ ও নিশ্চিত করুন' : 'Certify Attendance'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: VIEW VERIFIED ATTENDANCE BREAKDOWN                      */}
      {/* ============================================================== */}
      {viewingAttendanceMeeting && (() => {
        const total = viewingAttendanceMeeting.attendees?.length || 0;
        const presentList = viewingAttendanceMeeting.attendees?.filter((a) => a.status === 'present') || [];
        const absentList = viewingAttendanceMeeting.attendees?.filter((a) => a.status !== 'present') || [];
        const rate = total > 0 ? Math.round((presentList.length / total) * 100) : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>{language === 'bn' ? 'সাধারণ সভার উপস্থিতির প্রমাণসিদ্ধ বিবরণী' : 'Verified Attendance Records'}</span>
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{viewingAttendanceMeeting.title}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-500" />
                      <span>{viewingAttendanceMeeting.meetingDate}</span>
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{viewingAttendanceMeeting.scheduledTime}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingAttendanceMeeting(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tally Cards */}
              <div className="my-3 grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500">{language === 'bn' ? 'মোট সদস্য' : 'Total'}</span>
                  <div className="text-base font-bold text-slate-800 dark:text-white">{total}</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{language === 'bn' ? 'উপস্থিত' : 'Present'}</span>
                  <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">{presentList.length} ({rate}%)</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                  <div className="text-base font-bold text-rose-700 dark:text-rose-300">{absentList.length}</div>
                </div>
              </div>

              {/* Attendees List */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-[200px]">
                {/* Present Members */}
                <div>
                  <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'উপস্থিত সদস্যবৃন্দ' : 'Present Members'} ({presentList.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {presentList.map((a) => (
                      <div
                        key={a.memberSystemId}
                        className="p-2.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                            {a.memberName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{a.memberName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{formatMemberPhone(a.phone, isAdmin)}</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          {language === 'bn' ? 'উপস্থিত' : 'Present'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Absent Members */}
                {absentList.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'অনুপস্থিত সদস্যবৃন্দ' : 'Absent Members'} ({absentList.length})</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {absentList.map((a) => (
                        <div
                          key={a.memberSystemId}
                          className="p-2.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white font-bold flex items-center justify-center text-xs">
                              {a.memberName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">{a.memberName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{formatMemberPhone(a.phone, isAdmin)}</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                            {language === 'bn' ? 'অনুপস্থিত' : 'Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Verification Stamp & Notes */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  {viewingAttendanceMeeting.recordedBy && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ✓ {language === 'bn' ? 'যাচাইকারী অ্যাডমিন:' : 'Certified By:'}{' '}
                      <strong className="text-slate-800 dark:text-slate-200">{sanitizeEmail(viewingAttendanceMeeting.recordedBy)}</strong>{' '}
                      ({viewingAttendanceMeeting.recordedAt})
                    </div>
                  )}
                  {viewingAttendanceMeeting.notes && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {language === 'bn' ? 'মন্তব্য:' : 'Notes:'} {sanitizeEmail(viewingAttendanceMeeting.notes)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const m = viewingAttendanceMeeting;
                      setViewingAttendanceMeeting(null);
                      openRecordAttendanceModal(m);
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                  >
                    {language === 'bn' ? 'হাজিরা সংশোধন' : 'Edit Attendance'}
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingAttendanceMeeting(null)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: DELETE MEETING CONFIRMATION                              */}
      {/* ============================================================== */}
      {meetingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-red-600">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সাধারণ সভা অপসারণ নিশ্চিতকরণ' : 'Confirm Meeting Deletion'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {meetingToDelete.meetingId}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">{meetingToDelete.title}</div>
              <div className="text-slate-500">
                {language === 'bn' ? 'তারিখ ও সময়:' : 'Date & Time:'} {meetingToDelete.meetingDate} ({meetingToDelete.scheduledTime})
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'bn'
                ? 'আপনি কি নিশ্চিত যে এই সাধারণ সভার নোটিশ ও হাজিরা রেকর্ড মুছে ফেলতে চান?'
                : 'Are you sure you want to delete this meeting and its attendance record?'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMeetingToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMeeting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{language === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {userToDelete && isMainAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-red-600">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'bn' ? 'অ্যাডমিন অপসারণ নিশ্চিতকরণ' : 'Confirm Admin Deletion'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'প্রধান অ্যাডমিনের একক কর্তৃত্ব' : 'Main Admin Authority'}
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
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'bn'
                ? 'আপনি কি নিশ্চিত যে এই সহকারী অ্যাডমিনকে স্থায়ীভাবে মুছে ফেলতে চান? প্রধান অ্যাডমিন হিসেবে আপনার এই কর্তৃত্ব রয়েছে।'
                : 'Are you sure you want to permanently delete this administrator?'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{language === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SELF-SERVICE ADMIN PASSWORD CHANGE (FIREBASE SYNCED)    */}
      {/* ============================================================== */}
      {showChangePasswordModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                <span>{language === 'bn' ? 'অ্যাডমিন পাসওয়ার্ড পরিবর্তন' : 'Change Admin Password'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">{currentUser.name || currentUser.displayName}</div>
              <div className="text-[11px] text-slate-500">
                {language === 'bn'
                  ? 'নিরাপত্তার স্বার্থে আপনার নিবন্ধিত জিমেইলটি নিজ হাতে লিখে নিশ্চিত করুন।'
                  : 'For security, manually enter your registered Gmail address to confirm.'}
              </div>
            </div>

            {passChangeError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{passChangeError}</span>
              </div>
            )}

            {passChangeSuccess && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{passChangeSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdminSelfPasswordSubmit} className="mt-4 space-y-3" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'নিবন্ধিত জিমেইল লিখুন (Registered Gmail)' : 'Enter Registered Gmail'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="admin-rules-verify-registered-email"
                  autoComplete="new-password"
                  required
                  value={passConfirmEmailInput}
                  onChange={(e) => setPassConfirmEmailInput(e.target.value)}
                  placeholder={language === 'bn' ? 'ফায়ারবেসে নিবন্ধিত জিমেইল নিজ হাতে লিখুন...' : 'Manually type registered Gmail...'}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'} <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassFields ? 'text' : 'password'}
                  required
                  value={currPassInput}
                  onChange={(e) => setCurrPassInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'} <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassFields ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'} <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassFields ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPassFields}
                  onChange={(e) => setShowPassFields(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>{language === 'bn' ? 'পাসওয়ার্ড দেখুন' : 'Show passwords'}</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  disabled={isUpdatingPass}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPass}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isUpdatingPass ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{language === 'bn' ? 'ফায়ারবেসে আপডেট করুন' : 'Update in Firebase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Re-export as UsersView for backwards compatibility
export { AdminAndRulesView as UsersView };
