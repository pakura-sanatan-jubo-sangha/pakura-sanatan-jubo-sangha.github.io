import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, Language, ChatMessage } from '../types';
import { ChatService, RETENTION_OPTIONS } from '../lib/chatService';
import {
  MessageSquare,
  Send,
  Image as ImageIcon,
  Trash2,
  Clock,
  Shield,
  User,
  X,
  Maximize2,
  Download,
  AlertCircle,
  Lock,
  LogIn,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface CommunityChatViewProps {
  currentUser: UserAccount;
  language: Language;
  onOpenLoginModal?: () => void;
}

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  currentUser,
  language,
  onOpenLoginModal,
}) => {
  const isViewOnly = currentUser.userId === 'USR-VIEW-ONLY';
  const isAdmin = currentUser.role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>(() => ChatService.getLocalMessages());
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; fileName?: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [retentionHours, setRetentionHours] = useState<number>(() => ChatService.getRetentionHours());
  const [showSettings, setShowSettings] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to real-time chat updates & global retention hours
  useEffect(() => {
    if (isViewOnly) return;

    const unsubscribeMessages = ChatService.subscribeToMessages((msgs) => {
      setMessages(msgs);
    });

    const unsubscribeRetention = ChatService.subscribeToRetentionHours((h) => {
      setRetentionHours(h);
    });

    // Clean up every 30 seconds for expired messages locally
    const interval = setInterval(() => {
      setMessages((prev) => ChatService.filterUnexpired(prev));
    }, 30000);

    return () => {
      unsubscribeMessages();
      unsubscribeRetention();
      clearInterval(interval);
    };
  }, [isViewOnly]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Handle clipboard paste for screenshots (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const dataUrl = await ChatService.compressImage(file);
            setAttachedImage({ dataUrl, fileName: 'screenshot.png' });
          } catch (err) {
            console.warn('Failed to attach pasted screenshot:', err);
          }
        }
        break;
      }
    }
  };

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await ChatService.compressImage(file);
      setAttachedImage({ dataUrl, fileName: file.name });
    } catch (err) {
      console.warn('Failed to compress image:', err);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachedImage) || isSending || isViewOnly) return;

    setIsSending(true);
    const textToSend = inputText;
    const imgToSend = attachedImage;

    setInputText('');
    setAttachedImage(null);

    try {
      await ChatService.sendMessage(currentUser, textToSend, imgToSend || undefined, retentionHours);
    } catch (err) {
      console.warn('Failed to send message:', err);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await ChatService.deleteMessage(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetentionChange = async (hours: number) => {
    if (!isAdmin) return;
    setRetentionHours(hours);
    setShowSettings(false);
    await ChatService.updateRetentionHoursByAdmin(hours);
  };

  // Format time remaining before auto-delete
  const getTimeRemaining = (expiresAt: string) => {
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) return language === 'bn' ? 'মুছে যাবে' : 'Expiring soon';

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return language === 'bn' ? `আর ${days} দিন পর মুছে যাবে` : `Expires in ${days}d`;
    }
    if (hours > 0) {
      return language === 'bn' ? `আর ${hours} ঘণ্টা পর মুছে যাবে` : `Expires in ${hours}h`;
    }
    return language === 'bn' ? `আর ${mins} মিনিট পর মুছে যাবে` : `Expires in ${mins}m`;
  };

  // Format sent timestamp
  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {language === 'bn' ? 'একীভূত বার্তা ও আলোচনা কেন্দ্র' : 'Shared Community Space'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{language === 'bn' ? 'লাইভ সিঙ্ক' : 'Live Sync'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'সদস্য ও অ্যাডমিন সবার উন্মুক্ত স্পেস। বার্তা ও স্ক্রিনশট নির্দিষ্ট সময় পর স্বয়ংক্রিয়ভাবে মুছে যায়।'
                : 'Shared space for all members & admins. Messages & screenshots auto-delete after the set period.'}
            </p>
          </div>
        </div>

        {/* Retention Settings & Badges */}
        <div className="flex items-center gap-2 relative self-end md:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 font-semibold">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              {language === 'bn' ? 'স্বয়ংক্রিয় বিলুপ্তির সময়:' : 'Auto-delete Period:'}{' '}
              <strong className="underline decoration-amber-400">
                {RETENTION_OPTIONS.find((o) => o.hours === retentionHours)?.[language === 'bn' ? 'label_bn' : 'label_en'] || `${retentionHours}h`}
              </strong>
              {!isAdmin && (
                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 ml-1 font-normal">
                  ({language === 'bn' ? 'অ্যাডমিন নির্ধারিত' : 'Admin Set'})
                </span>
              )}
            </span>
          </div>

          {/* Retention Options Change Button: STRICTLY ADMIN ONLY */}
          {isAdmin && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-200/80 cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title={language === 'bn' ? 'বিলুপ্তির সময় পরিবর্তন করুন (শুধুমাত্র অ্যাডমিন)' : 'Change Auto-delete Time (Admin Only)'}
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">
                {language === 'bn' ? 'সময় পরিবর্তন' : 'Change Period'}
              </span>
            </button>
          )}

          {/* Retention Options Dropdown Menu: STRICTLY ADMIN ONLY */}
          {isAdmin && showSettings && (
            <div className="absolute right-0 top-11 z-30 w-60 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in zoom-in-95">
              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-1.5">
                <span className="flex items-center gap-1 text-amber-600">
                  <Shield className="w-3 h-3" />
                  <span>{language === 'bn' ? 'বিলুপ্তির সময় (অ্যাডমিন)' : 'Auto-delete (Admin)'}</span>
                </span>
                <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 rounded font-black">
                  Admin Only
                </span>
              </div>
              <div className="space-y-1">
                {RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.hours}
                    onClick={() => handleRetentionChange(opt.hours)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      retentionHours === opt.hours
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{language === 'bn' ? opt.label_bn : opt.label_en}</span>
                    {retentionHours === opt.hours && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[580px] overflow-hidden">
        {/* Messages Feed Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/20">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base">
                {language === 'bn' ? 'এখনো কোনো বার্তা নেই' : 'No messages yet'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                {language === 'bn'
                  ? 'প্রথম বার্তা পাঠিয়ে আলোচনা শুরু করুন অথবা গুরুত্বপূর্ণ তথ্য বা স্ক্রিনশট শেয়ার করুন।'
                  : 'Start the conversation by sending a message or attaching a screenshot.'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUser.userId;
              const isSenderAdmin = msg.senderRole === 'admin';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 group animate-in fade-in duration-150 ${
                    isMine ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Sender Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                      isSenderAdmin
                        ? 'bg-gradient-to-tr from-amber-500 to-amber-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isSenderAdmin ? (
                      <Shield className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>

                  {/* Message Bubble Container */}
                  <div className={`max-w-[85%] sm:max-w-[70%] space-y-1.5 ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* Sender Identity & Role Badge */}
                    <div className={`flex items-center gap-1.5 text-[11px] ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {isMine ? (language === 'bn' ? 'আপনি (You)' : 'You') : msg.senderName}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          isSenderAdmin
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {isSenderAdmin
                          ? (language === 'bn' ? 'অ্যাডমিন' : 'Admin')
                          : (language === 'bn' ? 'সদস্য' : 'Member')}
                      </span>
                      {msg.senderPhone && (
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          ({msg.senderPhone.slice(-4)})
                        </span>
                      )}
                    </div>

                    {/* Bubble Content */}
                    <div
                      className={`p-3.5 rounded-2xl shadow-2xs relative ${
                        isMine
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/80 rounded-tl-none'
                      }`}
                    >
                      {/* Attached Screenshot Image */}
                      {msg.imageUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-black/10 relative group/img cursor-pointer">
                          <img
                            src={msg.imageUrl}
                            alt="Screenshot"
                            className="max-h-64 w-full object-cover rounded-xl transition-transform hover:scale-102"
                            onClick={() => setPreviewImage(msg.imageUrl || null)}
                          />
                          <div
                            onClick={() => setPreviewImage(msg.imageUrl || null)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold"
                          >
                            <Maximize2 className="w-4 h-4" />
                            <span>{language === 'bn' ? 'বড় করে দেখুন' : 'Enlarge Image'}</span>
                          </div>
                        </div>
                      )}

                      {/* Text Message */}
                      {msg.text && (
                        <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                          {msg.text}
                        </p>
                      )}

                      {/* Message Footer Info */}
                      <div
                        className={`mt-2 flex items-center justify-between gap-3 text-[10px] ${
                          isMine ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-medium">
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 opacity-90">
                            <Clock className="w-2.5 h-2.5" />
                            {getTimeRemaining(msg.expiresAt)}
                          </span>
                        </div>

                        {/* Delete Button (Allowed for message author or admin) */}
                        {(isMine || isAdmin) && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            disabled={deletingId === msg.id}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/10 cursor-pointer ${
                              isMine ? 'text-emerald-100 hover:text-white' : 'text-slate-400 hover:text-rose-500'
                            }`}
                            title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete message'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Screenshot Attachment Preview Bar */}
        {attachedImage && (
          <div className="p-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={attachedImage.dataUrl}
                alt="Preview"
                className="w-10 h-10 object-cover rounded-lg border border-emerald-300 dark:border-emerald-700 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block truncate">
                  {attachedImage.fileName || 'Screenshot attached'}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  {language === 'bn' ? 'বার্তা পাঠানোর সাথে স্ক্রিনশট যুক্ত হবে' : 'Ready to send with message'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="p-1 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Bar Area */}
        <form
          onSubmit={handleSend}
          className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-end gap-2"
        >
          {/* Screenshot File Picker */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-400 transition-all cursor-pointer shrink-0"
            title={language === 'bn' ? 'ছবি বা স্ক্রিনশট যুক্ত করুন (অথবা সরাসরি পেস্ট করুন)' : 'Attach screenshot (or Ctrl+V)'}
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Textarea with Clipboard Paste Handler */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                language === 'bn'
                  ? 'বার্তা লিখুন বা স্ক্রিনশট পেস্ট করুন (Enter পাঠাতে, Shift+Enter নতুন লাইনে)...'
                  : 'Type a message or paste a screenshot (Enter to send, Shift+Enter for new line)...'
              }
              rows={1}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none max-h-24 custom-scrollbar"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!inputText.trim() && !attachedImage) || isSending}
            className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
              (!inputText.trim() && !attachedImage) || isSending
                ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed opacity-50'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 transform hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isSending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'bn' ? 'পাঠান' : 'Send'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Fullscreen Lightbox Modal for Screenshots */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Enlarged Screenshot"
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={previewImage}
                download="screenshot.png"
                className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>{language === 'bn' ? 'বন্ধ করুন' : 'Close'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
