export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  daysFormattedBn: string;
  hoursFormattedBn: string;
  minutesFormattedBn: string;
  secondsFormattedBn: string;
  daysFormattedEn: string;
  hoursFormattedEn: string;
  minutesFormattedEn: string;
  secondsFormattedEn: string;
}

export interface MeetingNoticeInfo {
  ruleTextBn: string;
  ruleTextEn: string;
  meetingDate: Date;
  dateStringBn: string;
  dateStringEn: string;
  timeStringBn: string;
  timeStringEn: string;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining: number;
  isToday: boolean;
  statusTextBn: string;
  statusTextEn: string;
  countdown: CountdownTime;
}

const BENGALI_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DEFAULT_GENERAL_MEETING_TIME = '8:30 PM';

export interface ParsedMeetingTime {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface MeetingNoticeOptions {
  scheduledTime?: string;
  scheduledDate?: string; // Optional YYYY-MM-DD override from a scheduled meeting doc
}

export function toBengaliDigits(val: number | string): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/[0-9]/g, (digit) => bnDigits[Number(digit)]);
}

function normalizeDigits(raw: string): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let out = raw;
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(bnDigits[i], String(i));
  }
  return out;
}

/**
 * Parses time strings such as "8:30 PM", "08:30 PM", "20:30", "রাত ৮:৩০", "8:30am"
 * into 24-hour { hour, minute }. Defaults safely to 20:30 (8:30 PM).
 */
export function parseMeetingTimeString(rawTime?: string): ParsedMeetingTime {
  if (!rawTime || typeof rawTime !== 'string') {
    return { hour: 20, minute: 30 };
  }

  const normalized = normalizeDigits(rawTime).trim();
  if (!normalized) {
    return { hour: 20, minute: 30 };
  }

  const lower = normalized.toLowerCase();
  const match = lower.match(/(\d{1,2})\s*[:.]\s*(\d{1,2})/);
  if (!match) {
    return { hour: 20, minute: 30 };
  }

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 20, minute: 30 };
  }

  const hasPm = /\bpm\b|রাত|সন্ধ্যা|বিকাল|বিকেল|দুপুর/.test(lower);
  const hasAm = /\bam\b|সকাল|ভোর/.test(lower);

  if (hasPm && hour < 12) {
    // Note: "দুপুর ১২:৩০" stays 12, "রাত ৮:৩০" -> 20
    hour += 12;
  } else if (hasAm && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

export function formatMeetingTimeEn(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minStr = String(minute).padStart(2, '0');
  return `${hour12}:${minStr} ${period}`;
}

export function formatMeetingTimeBn(hour: number, minute: number): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minStr = String(minute).padStart(2, '0');
  let periodBn = 'সকাল';
  if (hour >= 12 && hour < 16) periodBn = 'দুপুর';
  else if (hour >= 16 && hour < 18) periodBn = 'বিকাল';
  else if (hour >= 18 && hour < 20) periodBn = 'সন্ধ্যা';
  else if (hour >= 20 || hour < 4) periodBn = 'রাত';
  return `${periodBn} ${toBengaliDigits(hour12)}:${toBengaliDigits(minStr)} ঘটিকা`;
}

/**
 * Finds the last Friday falling between the 1st and the 11th of a given month
 * using the configured hour and minute (defaults to 8:30 PM / 20:30).
 */
export function getLastFridayBetween1stAnd11th(
  year: number,
  monthIndex: number,
  hour: number = 20,
  minute: number = 30
): Date {
  let fridayDay = 1;
  // Friday is day 5 (0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat)
  for (let d = 1; d <= 11; d++) {
    const candidate = new Date(year, monthIndex, d, hour, minute, 0, 0);
    if (candidate.getDay() === 5) {
      fridayDay = d;
    }
  }
  return new Date(year, monthIndex, fridayDay, hour, minute, 0, 0);
}

/**
 * Computes upcoming meeting date, countdown (days, hours, minutes, seconds), and notice texts.
 * Respects any custom meeting time (e.g. from Firebase) and defaults to 8:30 PM.
 * Once the meeting time passes on the meeting day, the target immediately switches to the following month's meeting.
 */
export function getUpcomingMeetingNotice(
  now: Date = new Date(),
  optionsOrTime?: MeetingNoticeOptions | string
): MeetingNoticeInfo {
  const options: MeetingNoticeOptions =
    typeof optionsOrTime === 'string'
      ? { scheduledTime: optionsOrTime }
      : optionsOrTime || {};

  const { hour, minute } = parseMeetingTimeString(options.scheduledTime || DEFAULT_GENERAL_MEETING_TIME);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let targetMeeting: Date | null = null;

  // If an explicit upcoming scheduledDate (YYYY-MM-DD) is provided and hasn't passed its scheduled hour:minute yet, use it
  if (options.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(options.scheduledDate.trim())) {
    const [yStr, mStr, dStr] = options.scheduledDate.trim().split('-');
    const explicitCandidate = new Date(Number(yStr), Number(mStr) - 1, Number(dStr), hour, minute, 0, 0);
    if (!isNaN(explicitCandidate.getTime()) && now.getTime() < explicitCandidate.getTime()) {
      targetMeeting = explicitCandidate;
    }
  }

  if (!targetMeeting) {
    // Meeting date for the current calendar month at configured hour:minute (default 8:30 PM)
    const thisMonthMeeting = getLastFridayBetween1stAnd11th(currentYear, currentMonth, hour, minute);

    if (now.getTime() < thisMonthMeeting.getTime()) {
      targetMeeting = thisMonthMeeting;
    } else {
      // Once scheduled meeting time passes, countdown for the following month's meeting begins:
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      targetMeeting = getLastFridayBetween1stAnd11th(nextYear, nextMonth, hour, minute);
    }
  }

  const isToday =
    now.getFullYear() === targetMeeting.getFullYear() &&
    now.getMonth() === targetMeeting.getMonth() &&
    now.getDate() === targetMeeting.getDate();

  // Calculate live remaining difference in ms
  const diffMs = Math.max(0, targetMeeting.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  const countdown: CountdownTime = {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    daysFormattedBn: toBengaliDigits(pad(days)),
    hoursFormattedBn: toBengaliDigits(pad(hours)),
    minutesFormattedBn: toBengaliDigits(pad(minutes)),
    secondsFormattedBn: toBengaliDigits(pad(seconds)),
    daysFormattedEn: pad(days),
    hoursFormattedEn: pad(hours),
    minutesFormattedEn: pad(minutes),
    secondsFormattedEn: pad(seconds),
  };

  const day = targetMeeting.getDate();
  const monthIdx = targetMeeting.getMonth();
  const year = targetMeeting.getFullYear();

  const dateStringBn = `${day} ${BENGALI_MONTHS[monthIdx]} ${year} (শুক্রবার)`;
  const dateStringEn = `Friday, ${day} ${ENGLISH_MONTHS[monthIdx]} ${year}`;
  const timeStringBn = formatMeetingTimeBn(hour, minute);
  const timeStringEn = formatMeetingTimeEn(hour, minute);
  const shortTimeBn = timeStringBn.replace(/\s*ঘটিকা$/, '');

  const statusTextBn = isToday
    ? `আজ ${shortTimeBn} টায় সাধারণ সভা! আর ${toBengaliDigits(hours)} ঘণ্টা ${toBengaliDigits(minutes)} মিনিট বাকি`
    : days === 1
    ? `আগামীকাল ${shortTimeBn} টায় সভা! আর ১ দিন ${toBengaliDigits(hours)} ঘণ্টা বাকি`
    : `আর ${toBengaliDigits(days)} দিন ${toBengaliDigits(hours)} ঘণ্টা বাকি`;

  const statusTextEn = isToday
    ? `Tonight at ${timeStringEn}! ${hours}h ${minutes}m left`
    : days === 1
    ? `Tomorrow at ${timeStringEn}! 1 day ${hours}h left`
    : `${days} days ${hours}h left`;

  return {
    ruleTextBn:
      `আমাদের সাধারণ সভা প্রতি মাসের ১ তারিখ থেকে ১১ তারিখের মধ্যবর্তী শেষ শুক্রবার ${shortTimeBn} টায় অনুষ্ঠিত হয়।`,
    ruleTextEn:
      `Our meetings are held at ${timeStringEn} on the last Friday falling between the 1st and the 11th of the month.`,
    meetingDate: targetMeeting,
    dateStringBn,
    dateStringEn,
    timeStringBn,
    timeStringEn,
    daysRemaining: days,
    hoursRemaining: hours,
    minutesRemaining: minutes,
    secondsRemaining: seconds,
    isToday,
    statusTextBn,
    statusTextEn,
    countdown,
  };
}
