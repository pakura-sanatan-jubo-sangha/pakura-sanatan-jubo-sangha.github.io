import React, { useState, useRef, useEffect } from 'react';
import { Globe, X, Save, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { Language, OwnerSocialLinks, SocialPlatformKey } from '../types';
import {
  OWNER_SOCIAL_PLATFORMS,
  getActiveSocialLinkEntries,
  isOwnerNameMatch,
  normalizeExternalProfileUrl,
  useOwnerSocialLinks,
} from '../lib/socialLinks';

/**
 * Brand SVG icons for each supported platform (exact clean vector marks).
 * Personal Website uses Lucide's Globe icon.
 */
export const SocialPlatformIcon: React.FC<{
  platform: SocialPlatformKey;
  className?: string;
}> = ({ platform, className = 'w-4 h-4' }) => {
  switch (platform) {
    case 'website':
      return <Globe className={className} />;
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23Z" />
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
        </svg>
      );
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
  }
};

function getPlatformButtonStyles(platform: SocialPlatformKey): string {
  switch (platform) {
    case 'website':
      return 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-700';
    case 'linkedin':
      return 'text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/60';
    case 'twitter':
      return 'text-sky-500 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/60';
    case 'github':
      return 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';
    case 'facebook':
      return 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60';
    case 'instagram':
      return 'text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/60';
    case 'tiktok':
      return 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800';
    case 'telegram':
      return 'text-sky-500 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/60';
  }
}

interface OwnerProfileHoverProps {
  name?: string | null;
  children?: React.ReactNode;
  language?: Language;
  placement?: 'top' | 'bottom';
  align?: 'left' | 'center' | 'right';
  alwaysEnable?: boolean;
  className?: string;
}

/**
 * Wraps Kajol Chandra Das's name anywhere in the app.
 * On mouse hover (or focus), displays ONLY the online profile icons whose links exist in Firebase.
 * Platforms without a link in Firebase never appear at all.
 */
export const OwnerProfileHover: React.FC<OwnerProfileHoverProps> = ({
  name,
  children,
  language = 'en',
  placement = 'bottom',
  align = 'left',
  alwaysEnable = false,
  className = '',
}) => {
  const { links } = useOwnerSocialLinks();
  const [hovered, setHovered] = useState(false);
  const [pinnedByClick, setPinnedByClick] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const displayContent = children ?? name ?? '';
  const isOwner = alwaysEnable || isOwnerNameMatch(typeof name === 'string' ? name : String(displayContent || ''));
  const activeEntries = getActiveSocialLinkEntries(links);
  const isOpen = hovered || pinnedByClick;

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPinnedByClick(false);
        setHovered(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinnedByClick(false);
        setHovered(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Only render interaction if enabled AND at least one valid link exists in Firebase
  if (!isOwner || activeEntries.length === 0) {
    return <>{displayContent}</>;
  }

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setHovered(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setHovered(false);
    }, 160);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinnedByClick) {
      setPinnedByClick(false);
      setHovered(false);
    } else {
      setPinnedByClick(true);
    }
  };

  const positionClass =
    placement === 'top'
      ? 'bottom-full pb-1.5'
      : 'top-full pt-1.5';

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0';

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center group/owner-hover ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPinnedByClick(false);
          handleMouseLeave();
        }
      }}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={handleTriggerClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPinnedByClick((prev) => !prev);
          }
        }}
        className="underline decoration-dotted decoration-amber-500/60 underline-offset-4 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer focus:outline-none"
      >
        {displayContent}
      </span>

      {isOpen && (
        <div
          className={`absolute ${positionClass} ${alignClass} z-50 w-max max-w-[90vw]`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl px-3 py-2 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            {activeEntries.map((item) => (
              <a
                key={item.key}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={language === 'bn' ? item.labelBn : item.labelEn}
                aria-label={language === 'bn' ? item.labelBn : item.labelEn}
                className={`p-2 rounded-xl transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center ${getPlatformButtonStyles(item.key)}`}
              >
                <SocialPlatformIcon platform={item.key} className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </span>
  );
};

interface OwnerSocialLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

/**
 * In-app modal allowing the Main Admin to view or update the 7 online profile links
 * synced directly with Firestore `social_links/owner`.
 */
export const OwnerSocialLinksModal: React.FC<OwnerSocialLinksModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const { links, onUpdateLinks } = useOwnerSocialLinks();
  const [draft, setDraft] = useState<OwnerSocialLinks>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        website: links.website || '',
        linkedin: links.linkedin || '',
        twitter: links.twitter || '',
        github: links.github || '',
        facebook: links.facebook || '',
        instagram: links.instagram || '',
        tiktok: links.tiktok || '',
        telegram: links.telegram || '',
      });
      setFeedback(null);
    }
  }, [isOpen, links]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateLinks) return;
    setFeedback(null);

    // Validate any non-empty field so invalid URLs are caught cleanly
    for (const platform of OWNER_SOCIAL_PLATFORMS) {
      const val = (draft[platform.key] || '').trim();
      if (val && !normalizeExternalProfileUrl(val)) {
        setFeedback({
          type: 'error',
          text:
            language === 'bn'
              ? `${platform.labelBn} লিংকটি সঠিক নয়। অনুগ্রহ করে বৈধ URL দিন অথবা খালি রাখুন।`
              : `Invalid URL for ${platform.labelEn}. Please enter a valid URL or leave it blank.`,
        });
        return;
      }
    }

    setSaving(true);
    try {
      await onUpdateLinks(draft);
      setFeedback({
        type: 'success',
        text:
          language === 'bn'
            ? 'অনলাইন প্রোফাইল লিংকসমূহ ফায়ারবেসে সফলভাবে সংরক্ষিত হয়েছে!'
            : 'Online profile links saved to Firebase successfully!',
      });
    } catch {
      setFeedback({
        type: 'error',
        text:
          language === 'bn'
            ? 'ফায়ারবেসে লিংক সংরক্ষণ করা যায়নি। পুনরায় চেষ্টা করুন।'
            : 'Failed to save links to Firebase. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-600" />
              <span>
                {language === 'bn' ? 'অনলাইন প্রোফাইল লিংক (Firebase)' : 'Online Profile Links (Firebase)'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'শুধুমাত্র যে প্ল্যাটফর্মগুলোর লিংক দেবেন সেগুলোর আইকনই আপনার নামের উপর মাউস রাখলে দেখাবে।'
                : 'Only platforms with a link provided here or in Firebase (social_links/owner) will appear when hovering your name.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          {OWNER_SOCIAL_PLATFORMS.map((platform) => {
            const val = draft[platform.key] || '';
            const previewUrl = normalizeExternalProfileUrl(val);
            return (
              <div key={platform.key}>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className={getPlatformButtonStyles(platform.key).split(' ')[0]}>
                      <SocialPlatformIcon platform={platform.key} className="w-3.5 h-3.5" />
                    </span>
                    <span>{language === 'bn' ? platform.labelBn : platform.labelEn}</span>
                  </span>
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5"
                    >
                      <span>{language === 'bn' ? 'পরীক্ষা করুন' : 'Open'}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </label>
                <input
                  type="text"
                  value={val}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [platform.key]: e.target.value,
                    }))
                  }
                  placeholder={platform.placeholder}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            );
          })}

          {feedback && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? language === 'bn'
                    ? 'সংরক্ষণ হচ্ছে...'
                    : 'Saving...'
                  : language === 'bn'
                  ? 'Firebase-এ সংরক্ষণ করুন'
                  : 'Save to Firebase'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
