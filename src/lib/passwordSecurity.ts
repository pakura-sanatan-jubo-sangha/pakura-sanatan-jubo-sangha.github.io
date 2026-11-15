import { Language } from '../types';

export type PasswordSecurityLevel = 'idle' | 'low' | 'medium' | 'high';

export interface PasswordSecurityAssessment {
  level: PasswordSecurityLevel;
  score: 0 | 1 | 2 | 3; // 0 = empty, 1 = low, 2 = medium, 3 = high
  percent: number; // 0 | 33 | 66 | 100
  label: string;
  description: string;
  isValidForRegistration: boolean;
  meetsMinLength: boolean;
  isBlockedWeakPattern: boolean;
  hasLetters: boolean;
  hasNumbers: boolean;
  hasMixedCaseOrSymbol: boolean;
  rejectionReason?: string;
}

const BLOCKED_PASSWORDS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '01234567',
  '0123456789',
  '87654321',
  '98765432',
  '987654321',
  '9876543210',
  '112233',
  '11223344',
  '1122334455',
  '00112233',
  '121212',
  '12121212',
  '12341234',
  '11112222',
  '00000000',
  '11111111',
  '22222222',
  '33333333',
  '44444444',
  '55555555',
  '66666666',
  '77777777',
  '88888888',
  '99999999',
  'password',
  'password1',
  'password123',
  'pass1234',
  'qwertyui',
  'qwertyuiop',
  'qwerty12',
  'qwerty123',
  'asdfghjk',
  'zxcvbnm1',
  'abcdefgh',
  'abcd1234',
  '1234abcd',
]);

const SEQUENTIAL_CORPUSES = [
  '01234567890123456789',
  '98765432109876543210',
  'abcdefghijklmnopqrstuvwxyz',
  'zyxwvutsrqponmlkjihgfedcba',
  'qwertyuiopasdfghjklzxcvbnm',
  'mnbvcxzlkjhgfdsapoiuytrewq',
];

export function isWeakOrPredictablePassword(rawPassword: string): boolean {
  const pwd = (rawPassword || '').trim();
  if (!pwd) return false;
  const lower = pwd.toLowerCase();

  if (BLOCKED_PASSWORDS.has(lower)) return true;
  if (/^password\d*$/i.test(lower)) return true;

  // All identical characters (e.g. "aaaaaaaa", "11111111")
  if (/^(.)\1+$/.test(lower)) return true;

  // Paired repeats (e.g. "112233", "11223344", "aabbccdd")
  if (/^(?:(.)\1){2,}$/.test(lower)) return true;

  // Short period repetition of 1-4 characters (e.g. "12121212", "12312312", "12341234", "abababab")
  for (let pLen = 1; pLen <= 4; pLen++) {
    if (lower.length >= pLen * 2) {
      const pat = lower.slice(0, pLen);
      const repeated = pat.repeat(Math.ceil(lower.length / pLen)).slice(0, lower.length);
      if (lower === repeated) return true;
    }
  }

  // Known contiguous digit/alphabet/keyboard sequences
  if (lower.length >= 4 && SEQUENTIAL_CORPUSES.some((corpus) => corpus.includes(lower))) {
    return true;
  }

  // Strict +/-1 ASCII step sequence across the entire password
  if (lower.length >= 4) {
    let isAsc = true;
    let isDesc = true;
    for (let i = 1; i < lower.length; i++) {
      const diff = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
      if (diff !== 1) isAsc = false;
      if (diff !== -1) isDesc = false;
    }
    if (isAsc || isDesc) return true;
  }

  // Digits-only password with 2 or fewer distinct digits (e.g. "10101010", "11112222", "12222222")
  if (/^\d+$/.test(lower) && new Set(lower).size <= 2) {
    return true;
  }

  return false;
}

export function evaluatePasswordSecurity(
  rawPassword: string,
  language: Language = 'bn'
): PasswordSecurityAssessment {
  const pwd = (rawPassword || '').trim();
  const meetsMinLength = pwd.length >= 8;
  const isBlockedWeakPattern = isWeakOrPredictablePassword(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLetters = hasLower || hasUpper;
  const hasNumbers = /\d/.test(pwd);
  const hasSymbols = /[^A-Za-z0-9]/.test(pwd);
  const hasMixedCaseOrSymbol = (hasLower && hasUpper) || hasSymbols;
  const uniqueChars = new Set(pwd).size;

  if (pwd.length === 0) {
    return {
      level: 'idle',
      score: 0,
      percent: 0,
      label: language === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Enter password',
      description:
        language === 'bn'
          ? 'অক্ষর ও সংখ্যার সমন্বয়ে কমপক্ষে ৮ অক্ষরের নিরাপদ পাসওয়ার্ড দিন'
          : 'Use at least 8 characters with letters and numbers',
      isValidForRegistration: false,
      meetsMinLength: false,
      isBlockedWeakPattern: false,
      hasLetters: false,
      hasNumbers: false,
      hasMixedCaseOrSymbol: false,
    };
  }

  if (isBlockedWeakPattern) {
    const reason =
      language === 'bn'
        ? "দুর্বল বা সহজ অনুমানযোগ্য পাসওয়ার্ড (যেমন '12345678' বা '112233') ব্যবহার করা যাবে না। অক্ষর ও সংখ্যার সমন্বয়ে শক্তিশালী পাসওয়ার্ড দিন।"
        : "Weak or predictable passwords like '12345678' or '112233' are not allowed. Choose a stronger combination of letters and numbers.";
    return {
      level: 'low',
      score: 1,
      percent: 25,
      label: language === 'bn' ? 'নিম্ন (Low) — অনুমোদিত নয়' : 'Low — Not Allowed',
      description: reason,
      isValidForRegistration: false,
      meetsMinLength,
      isBlockedWeakPattern: true,
      hasLetters,
      hasNumbers,
      hasMixedCaseOrSymbol,
      rejectionReason: reason,
    };
  }

  if (!meetsMinLength) {
    const reason =
      language === 'bn'
        ? 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'
        : 'Password must be at least 8 characters long.';
    return {
      level: 'low',
      score: 1,
      percent: Math.max(15, Math.min(35, Math.round((pwd.length / 8) * 35))),
      label: language === 'bn' ? 'নিম্ন (Low)' : 'Low',
      description:
        language === 'bn'
          ? `আরও ${8 - pwd.length}টি অক্ষর/সংখ্যা যোগ করুন (সর্বনিম্ন ৮ অক্ষর)`
          : `Add ${8 - pwd.length} more character(s) (minimum 8 required)`,
      isValidForRegistration: false,
      meetsMinLength: false,
      isBlockedWeakPattern: false,
      hasLetters,
      hasNumbers,
      hasMixedCaseOrSymbol,
      rejectionReason: reason,
    };
  }

  // Count distinct character classes
  const classCount = [hasLower, hasUpper, hasNumbers, hasSymbols].filter(Boolean).length;

  // High security:
  // - 8+ chars with 3+ classes (e.g. Upper + Lower + Number or Letters + Numbers + Symbol)
  // - OR 10+ chars with >= 2 classes (e.g. Letters + Numbers) and good character variety (>= 6 unique chars)
  // - OR 12+ chars with >= 5 unique chars
  const isHigh =
    (classCount >= 3 && uniqueChars >= 5) ||
    (pwd.length >= 10 && classCount >= 2 && uniqueChars >= 6) ||
    (pwd.length >= 12 && uniqueChars >= 5);

  if (isHigh) {
    return {
      level: 'high',
      score: 3,
      percent: 100,
      label: language === 'bn' ? 'উচ্চ নিরাপত্তা (High)' : 'High Security',
      description:
        language === 'bn'
          ? 'চমৎকার! আপনার পাসওয়ার্ডটি শক্তিশালী ও উচ্চ নিরাপত্তাসম্পন্ন।'
          : 'Strong password with high security.',
      isValidForRegistration: true,
      meetsMinLength: true,
      isBlockedWeakPattern: false,
      hasLetters,
      hasNumbers,
      hasMixedCaseOrSymbol,
    };
  }

  // Medium security:
  // - 8+ chars with >= 2 classes (e.g. letters + numbers, or upper + lower, or chars + symbols) and >= 4 unique chars
  // - OR 10+ chars single class with >= 6 unique chars
  const isMedium =
    (classCount >= 2 && uniqueChars >= 4) ||
    (pwd.length >= 10 && uniqueChars >= 6);

  if (isMedium) {
    return {
      level: 'medium',
      score: 2,
      percent: 66,
      label: language === 'bn' ? 'মাঝারি নিরাপত্তা (Medium)' : 'Medium Security',
      description:
        language === 'bn'
          ? 'ভালো! বড় হাতের অক্ষর, চিহ্ন বা ১০+ অক্ষর ব্যবহার করলে উচ্চ (High) নিরাপত্তায় উন্নীত হবে।'
          : 'Good! Add uppercase letters, symbols, or reach 10+ characters for High security.',
      isValidForRegistration: true,
      meetsMinLength: true,
      isBlockedWeakPattern: false,
      hasLetters,
      hasNumbers,
      hasMixedCaseOrSymbol,
    };
  }

  // Low security (valid 8+ char password that isn't a blocked weak sequence, but lacks mixed classes)
  return {
    level: 'low',
    score: 1,
    percent: 33,
    label: language === 'bn' ? 'নিম্ন নিরাপত্তা (Low)' : 'Low Security',
    description:
      language === 'bn'
        ? 'অক্ষর ও সংখ্যার সমন্বয় যোগ করলে নিরাপত্তা মাঝারি বা উচ্চ (High) স্তরে উঠবে।'
        : 'Combine letters and numbers to raise security from Low to High.',
    isValidForRegistration: true,
    meetsMinLength: true,
    isBlockedWeakPattern: false,
    hasLetters,
    hasNumbers,
    hasMixedCaseOrSymbol,
  };
}
