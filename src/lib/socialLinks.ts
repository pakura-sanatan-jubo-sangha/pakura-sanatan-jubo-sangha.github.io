import React, { createContext, useContext } from 'react';
import { OwnerSocialLinks, SocialPlatformKey } from '../types';

export const SOCIAL_LINKS_STORAGE_KEY = 'pakura_owner_social_links_v1';

export interface SocialPlatformMeta {
  key: SocialPlatformKey;
  labelEn: string;
  labelBn: string;
  placeholder: string;
}

export const OWNER_SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  {
    key: 'website',
    labelEn: 'Personal Website',
    labelBn: 'ব্যক্তিগত ওয়েবসাইট',
    placeholder: 'https://yourwebsite.com',
  },
  {
    key: 'linkedin',
    labelEn: 'LinkedIn',
    labelBn: 'লিংকডইন (LinkedIn)',
    placeholder: 'https://linkedin.com/in/username',
  },
  {
    key: 'twitter',
    labelEn: 'Twitter / X',
    labelBn: 'টুইটার / X',
    placeholder: 'https://x.com/username',
  },
  {
    key: 'github',
    labelEn: 'GitHub',
    labelBn: 'গিটহাব (GitHub)',
    placeholder: 'https://github.com/username',
  },
  {
    key: 'facebook',
    labelEn: 'Facebook',
    labelBn: 'ফেসবুক (Facebook)',
    placeholder: 'https://facebook.com/username',
  },
  {
    key: 'instagram',
    labelEn: 'Instagram',
    labelBn: 'ইনস্টাগ্রাম (Instagram)',
    placeholder: 'https://instagram.com/username',
  },
  {
    key: 'tiktok',
    labelEn: 'TikTok',
    labelBn: 'টিকটক (TikTok)',
    placeholder: 'https://tiktok.com/@username',
  },
  {
    key: 'telegram',
    labelEn: 'Telegram',
    labelBn: 'টেলিগ্রাম (Telegram)',
    placeholder: 'https://t.me/username',
  },
];

/**
 * Determines whether a displayed name refers to the site owner / Main Admin (Kajal / Kajol Chandra Das).
 */
export function isOwnerNameMatch(rawName?: string | null): boolean {
  if (!rawName) return false;
  const normalized = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
  return (
    normalized.includes('kajol chandra das') ||
    normalized.includes('kajal chandra das') ||
    normalized.includes('কাজল চন্দ্র দাস')
  );
}

/**
 * Safely validates and normalizes an external URL provided in Firebase or admin UI.
 * Returns null when blank or unsafe (preventing empty/broken links or XSS schemes).
 */
export function normalizeExternalProfileUrl(raw?: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  const withScheme =
    lower.startsWith('http://') || lower.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extracts and sanitizes the 7 supported online profile fields from raw Firestore data.
 * Supports common casing/alias variations (e.g. "LinkedIn", "x", "personalWebsite") when edited directly in Firebase Console.
 */
export function sanitizeOwnerSocialLinks(raw?: Record<string, unknown> | null): OwnerSocialLinks {
  const source = raw || {};
  const pick = (...candidates: unknown[]) => {
    for (const c of candidates) {
      const normalized = normalizeExternalProfileUrl(c);
      if (normalized) return normalized;
    }
    return '';
  };

  return {
    website: pick(source.website, source.Website, source.personalWebsite, source.personal_website, source.portfolio),
    linkedin: pick(source.linkedin, source.LinkedIn, source.linkedIn),
    twitter: pick(source.twitter, source.Twitter, source.x, source.X),
    github: pick(source.github, source.GitHub, source.githubUrl),
    facebook: pick(source.facebook, source.Facebook, source.fb),
    instagram: pick(source.instagram, source.Instagram, source.ig),
    tiktok: pick(source.tiktok, source.TikTok, source.tikTok),
    telegram: pick(source.telegram, source.Telegram, source.tg),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
    updatedBy: typeof source.updatedBy === 'string' ? source.updatedBy : undefined,
  };
}

export interface ActiveSocialLinkEntry extends SocialPlatformMeta {
  url: string;
}

/**
 * Returns ONLY the platforms that actually have a valid non-empty link configured.
 * Platforms without a link are completely omitted so their icons never appear.
 */
export function getActiveSocialLinkEntries(links?: OwnerSocialLinks | null): ActiveSocialLinkEntry[] {
  if (!links) return [];
  const entries: ActiveSocialLinkEntry[] = [];
  for (const meta of OWNER_SOCIAL_PLATFORMS) {
    const url = normalizeExternalProfileUrl(links[meta.key]);
    if (url) {
      entries.push({ ...meta, url });
    }
  }
  return entries;
}

export function getCachedOwnerSocialLinks(): OwnerSocialLinks {
  try {
    const raw = localStorage.getItem(SOCIAL_LINKS_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeOwnerSocialLinks(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function cacheOwnerSocialLinks(links: OwnerSocialLinks): void {
  try {
    localStorage.setItem(SOCIAL_LINKS_STORAGE_KEY, JSON.stringify(sanitizeOwnerSocialLinks(links as Record<string, unknown>)));
  } catch {}
}

export interface OwnerSocialLinksContextValue {
  links: OwnerSocialLinks;
  isLoaded: boolean;
  onUpdateLinks?: (next: OwnerSocialLinks) => Promise<void>;
}

export const OwnerSocialLinksContext = createContext<OwnerSocialLinksContextValue>({
  links: {},
  isLoaded: false,
});

export function useOwnerSocialLinks(): OwnerSocialLinksContextValue {
  return useContext(OwnerSocialLinksContext);
}
