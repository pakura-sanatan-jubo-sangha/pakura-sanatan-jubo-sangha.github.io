import { FullAppData, UserAccount, Language, NotificationItem, Member } from '../types';
import { StorageService } from './storage';

const NOTIFICATIONS_READ_KEY = 'pakura_notifications_read_v1';

export function getReadNotificationIds(): string[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_READ_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNotificationAsRead(id: string): string[] {
  const current = getReadNotificationIds();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(current));
  }
  return current;
}

export function markAllNotificationsAsRead(ids: string[]): string[] {
  const current = getReadNotificationIds();
  const set = new Set([...current, ...ids]);
  const updated = Array.from(set);
  localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(updated));
  return updated;
}

export interface EnrichedNotification extends NotificationItem {
  category: 'payment' | 'meeting' | 'rule' | 'general';
  actionTab?: string;
  actionLabel?: string;
}

export function generateUserNotifications(
  user: UserAccount,
  appData: FullAppData,
  language: Language
): EnrichedNotification[] {
  if (!user || user.userId === 'USR-VIEW-ONLY') return [];

  const readIds = new Set(getReadNotificationIds());
  const notifs: EnrichedNotification[] = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonth = today.toISOString().slice(0, 7);
  const currentDay = today.getDate();
  const dueDay = appData.settings.contributionDueDay || 10;
  const lateFee = appData.settings.lateFeeAmount || 10;

  // Retrieve linked members
  const linkedMembers = StorageService.getLinkedMembersForUser(user, appData.members);
  const linkedIds = linkedMembers.map((m) => m.systemId);

  // 1. Payment Notifications for Members
  if (user.role === 'member') {
    const myContributions = appData.contributions.filter((c) =>
      linkedIds.includes(c.memberSystemId)
    );
    const isCurrentPaid = myContributions.some((c) => c.month === currentMonth);

    if (!isCurrentPaid) {
      if (currentDay <= dueDay) {
        notifs.push({
          id: `pay-due-${currentMonth}`,
          type: 'warning',
          category: 'payment',
          title: language === 'bn' ? 'চলতি মাসের সঞ্চয় জমাদান (নির্ধারিত ১০ তারিখ)' : 'Monthly Savings Due (By 10th)',
          message:
            language === 'bn'
              ? `সম্মানিত সদস্য, চলতি ${currentMonth} মাসের মাসিক সঞ্চয় ৳${appData.settings.monthlyContributionAmount} নির্ধারিত ${dueDay} তারিখের মধ্যে প্রদান করে সহযোগিতার অনুরোধ করা হচ্ছে।`
              : `Please deposit your monthly savings of ৳${appData.settings.monthlyContributionAmount} for ${currentMonth} before day ${dueDay}.`,
          isRead: readIds.has(`pay-due-${currentMonth}`),
          createdAt: `${todayStr}T09:00:00Z`,
          actionTab: 'contributions',
          actionLabel: language === 'bn' ? 'সঞ্চয় খাতা দেখুন' : 'View Passbook',
        });
      } else {
        notifs.push({
          id: `pay-late-${currentMonth}`,
          type: 'alert',
          category: 'payment',
          title: language === 'bn' ? 'বিলম্ব ফি সতর্কতা: ১০ তারিখ অতিক্রান্ত' : 'Overdue Alert: Past 10th Due Date',
          message:
            language === 'bn'
              ? `চলতি ${currentMonth} মাসের নির্ধারিত ${dueDay} তারিখ অতিক্রান্ত হয়েছে। সাধারণ সভার সিদ্ধান্ত অনুযায়ী অতিরিক্ত ৳${lateFee} বিলম্ব ফিসহ চাঁদা পরিশোধ করুন।`
              : `Day ${dueDay} has passed for ${currentMonth}. Please pay your contribution along with late fee of ৳${lateFee}.`,
          isRead: readIds.has(`pay-late-${currentMonth}`),
          createdAt: `${todayStr}T09:00:00Z`,
          actionTab: 'contributions',
          actionLabel: language === 'bn' ? 'বকেয়া হিসাব দেখুন' : 'View Due Details',
        });
      }
    }

    // Most recent contribution receipt
    if (myContributions.length > 0) {
      const latest = myContributions[0];
      notifs.push({
        id: `pay-rec-${latest.contributionId}`,
        type: 'success',
        category: 'payment',
        title: language === 'bn' ? 'সঞ্চয় জমা নিশ্চিতকরণ' : 'Savings Deposit Confirmed',
        message:
          language === 'bn'
            ? `${latest.month} মাসের সঞ্চয় ৳${latest.amount} সফলভাবে অন্তর্ভুক্ত হয়েছে (রশিদ নং: ${latest.receiptId})।`
            : `Savings deposit of ৳${latest.amount} for ${latest.month} successfully credited (Receipt #${latest.receiptId}).`,
        isRead: readIds.has(`pay-rec-${latest.contributionId}`),
        createdAt: latest.createdAt || `${todayStr}T12:00:00Z`,
        actionTab: 'contributions',
        actionLabel: language === 'bn' ? 'রশিদ ও খতিয়ান' : 'Receipt Details',
      });
    }
    // Member's Withdrawal Status Notifications
    const myWithdrawals = (appData.memberWithdrawals || []).filter((w) =>
      linkedIds.includes(w.memberSystemId)
    );
    const pendingWithdrawal = myWithdrawals.find((w) => w.status === 'pending');
    if (pendingWithdrawal) {
      const srcName = pendingWithdrawal.source === 'profit' ? 'সঞ্চিত মুনাফা' : 'সঞ্চয় তহবিল';
      notifs.push({
        id: `wth-pending-${pendingWithdrawal.withdrawalId}`,
        type: 'info',
        category: 'payment',
        title: language === 'bn' ? `উত্তোলন আবেদন প্রক্রিয়াধীন (৳${pendingWithdrawal.amount.toLocaleString()})` : `Withdrawal In Progress (৳${pendingWithdrawal.amount.toLocaleString()})`,
        message:
          language === 'bn'
            ? `আপনার ${srcName} থেকে ৳${pendingWithdrawal.amount.toLocaleString()} উত্তোলনের আবেদনটি পর্যালোচনাধীন রয়েছে। কার্যনির্বাহী পরিষদ থেকে অনুমোদন ও পরিশোধ সম্পন্ন হবে।`
            : `Your withdrawal request of ৳${pendingWithdrawal.amount.toLocaleString()} from ${srcName} is under review.`,
        isRead: readIds.has(`wth-pending-${pendingWithdrawal.withdrawalId}`),
        createdAt: pendingWithdrawal.requestedAt || pendingWithdrawal.createdAt,
        actionTab: 'member_dashboard',
        actionLabel: language === 'bn' ? 'আবেদন স্থিতি দেখুন' : 'View Status',
      });
    }

    const latestCompletedWithdrawal = myWithdrawals.find((w) => w.status === 'completed');
    if (latestCompletedWithdrawal) {
      const srcName = latestCompletedWithdrawal.source === 'profit' ? 'সঞ্চিত মুনাফা' : 'সঞ্চয় তহবিল';
      notifs.push({
        id: `wth-done-${latestCompletedWithdrawal.withdrawalId}`,
        type: 'success',
        category: 'payment',
        title: language === 'bn' ? `উত্তোলন পরিশোধ সম্পন্ন (৳${latestCompletedWithdrawal.amount.toLocaleString()})` : `Withdrawal Completed (৳${latestCompletedWithdrawal.amount.toLocaleString()})`,
        message:
          language === 'bn'
            ? `আপনার ${srcName} থেকে ৳${latestCompletedWithdrawal.amount.toLocaleString()} উত্তোলন সফলভাবে সম্পন্ন হয়েছে (রশিদ নং: ${latestCompletedWithdrawal.receiptId})।`
            : `Your withdrawal of ৳${latestCompletedWithdrawal.amount.toLocaleString()} from ${srcName} has been paid (Receipt #${latestCompletedWithdrawal.receiptId}).`,
        isRead: readIds.has(`wth-done-${latestCompletedWithdrawal.withdrawalId}`),
        createdAt: latestCompletedWithdrawal.processedAt || latestCompletedWithdrawal.createdAt,
        actionTab: 'member_dashboard',
        actionLabel: language === 'bn' ? 'রশিদ ও খতিয়ান' : 'View Receipt',
      });
    }
  }

  // Admin Notification for Pending Member Withdrawals
  if (user.role === 'admin') {
    const pendingRequests = (appData.memberWithdrawals || []).filter((w) => w.status === 'pending');
    if (pendingRequests.length > 0) {
      const totalRequested = pendingRequests.reduce((sum, w) => sum + (w.amount || 0), 0);
      notifs.push({
        id: `admin-pending-withdrawals-${pendingRequests.length}-${totalRequested}`,
        type: 'alert',
        category: 'payment',
        title: language === 'bn' ? `🔔 ${pendingRequests.length}টি নতুন উত্তোলন আবেদন জমা পড়েছে` : `🔔 ${pendingRequests.length} Pending Withdrawal Requests`,
        message:
          language === 'bn'
            ? `${pendingRequests.length} জন সম্মানিত সদস্য মোট ৳${totalRequested.toLocaleString()} তহবিল ও মুনাফা উত্তোলনের আবেদন করেছেন। আবেদনসমূহ পর্যালোচনা ও অর্থ পরিশোধ করুন।`
            : `${pendingRequests.length} members requested a total of ৳${totalRequested.toLocaleString()} withdrawals. Please review and disburse.`,
        isRead: readIds.has(`admin-pending-withdrawals-${pendingRequests.length}-${totalRequested}`),
        createdAt: pendingRequests[0]?.requestedAt || `${todayStr}T09:00:00Z`,
        actionTab: 'withdrawals_management',
        actionLabel: language === 'bn' ? 'আবেদন পর্যালোচনা ও পরিশোধ' : 'Review & Disburse',
      });
    }
  }
  (appData.meetings || []).forEach((m) => {
    const isPast = m.meetingDate < todayStr;
    const cleanTitle = user.role === 'member' ? (m.title || '').replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '') : m.title;
    const cleanLocation = user.role === 'member' ? (m.location || '').replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '') : m.location;
    notifs.push({
      id: `mtg-${m.meetingId}`,
      type: isPast ? 'info' : 'warning',
      category: 'meeting',
      title: language === 'bn' ? `সাধারণ সভা: ${cleanTitle}` : `Meeting: ${cleanTitle}`,
      message:
        language === 'bn'
          ? `তারিখ: ${m.meetingDate} | সময়: ${m.scheduledTime || 'রাত ৮:৩০'} | স্থান: ${cleanLocation}। সকল সদস্যকে যথাসময়ে উপস্থিত হয়ে হাজিরা প্রদানের অনুরোধ করা হচ্ছে।`
          : `Date: ${m.meetingDate} | Time: ${m.scheduledTime} | Location: ${cleanLocation}. Please attend and mark presence.`,
      isRead: readIds.has(`mtg-${m.meetingId}`),
      createdAt: m.createdAt || `${todayStr}T08:00:00Z`,
      actionTab: 'member_dashboard',
      actionLabel: language === 'bn' ? 'হাজিরা দিন' : 'Mark Attendance',
    });
  });

  // 3. Rules & Resolutions Notifications
  (appData.rules || []).slice(0, 4).forEach((r) => {
    // Sanitize any email if member
    let detailsSnippet = r.decisionDetails || '';
    const cleanTitle = user.role === 'member' ? (r.title || '').replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '') : r.title;
    if (user.role === 'member') {
      detailsSnippet = detailsSnippet.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
        language === 'bn' ? 'সমিতি প্রশাসন' : 'Society Administration'
      );
    }
    if (detailsSnippet.length > 90) {
      detailsSnippet = `${detailsSnippet.slice(0, 90)}...`;
    }

    notifs.push({
      id: `rule-${r.ruleId}`,
      type: 'info',
      category: 'rule',
      title: language === 'bn' ? `সংবিধিবদ্ধ সিদ্ধান্ত: ${cleanTitle}` : `Society Resolution: ${cleanTitle}`,
      message:
        language === 'bn'
          ? `রেজোলিউশন নং: ${r.resolutionNumber || 'নথিভুক্ত'} | সভার তারিখ: ${r.meetingDate}। সিদ্ধান্ত: ${detailsSnippet}`
          : `Resolution #${r.resolutionNumber || 'Recorded'} | Date: ${r.meetingDate}. Decision: ${detailsSnippet}`,
      isRead: readIds.has(`rule-${r.ruleId}`),
      createdAt: r.createdAt || `${todayStr}T10:00:00Z`,
      actionTab: 'admin_rules',
      actionLabel: language === 'bn' ? 'পূর্ণ নিয়মাবলী পড়ুন' : 'Read Full Rule',
    });
  });

  // Sort: unread first, then by date descending
  return notifs.sort((a, b) => {
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}
