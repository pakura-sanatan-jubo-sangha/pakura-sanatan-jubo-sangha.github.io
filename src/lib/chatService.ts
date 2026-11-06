import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage, UserAccount } from '../types';

const CHAT_COLLECTION = 'chat_messages';
const LOCAL_STORAGE_KEY = 'psys_shared_chat_messages_v1';
const RETENTION_STORAGE_KEY = 'psys_chat_retention_hours';

export const DEFAULT_RETENTION_HOURS = 24;

export const RETENTION_OPTIONS = [
  { hours: 6, label_bn: '৬ ঘণ্টা', label_en: '6 Hours' },
  { hours: 12, label_bn: '১২ ঘণ্টা', label_en: '12 Hours' },
  { hours: 24, label_bn: '২৪ ঘণ্টা (ডিফল্ট)', label_en: '24 Hours (Default)' },
  { hours: 48, label_bn: '৪৮ ঘণ্টা (২ দিন)', label_en: '48 Hours (2 Days)' },
  { hours: 72, label_bn: '৩ দিন', label_en: '3 Days' },
  { hours: 168, label_bn: '৭ দিন', label_en: '7 Days' },
];

export class ChatService {
  /**
   * Get active retention setting in hours
   */
  static getRetentionHours(): number {
    try {
      const val = localStorage.getItem(RETENTION_STORAGE_KEY);
      if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_RETENTION_HOURS;
  }

  /**
   * Update retention setting in hours (Admin only)
   */
  static async updateRetentionHoursByAdmin(hours: number): Promise<void> {
    try {
      localStorage.setItem(RETENTION_STORAGE_KEY, String(hours));
      // Save globally in Firestore so all members and devices sync with admin choice
      await setDoc(
        doc(db, 'settings', 'chat_settings'),
        {
          retentionHours: hours,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Handled Notice] Firestore retention update notice:', err);
    }
  }

  /**
   * Subscribe to global retention setting from Firestore
   */
  static subscribeToRetentionHours(callback: (hours: number) => void): () => void {
    // Immediate local emission
    callback(this.getRetentionHours());

    try {
      const unsubscribe = onSnapshot(
        doc(db, 'settings', 'chat_settings'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const hours = data?.retentionHours;
            if (typeof hours === 'number' && hours > 0) {
              try {
                localStorage.setItem(RETENTION_STORAGE_KEY, String(hours));
              } catch {}
              callback(hours);
            }
          }
        },
        (err) => {
          console.warn('[Handled Notice] Chat retention sync fallback:', err.message);
        }
      );
      return unsubscribe;
    } catch {
      return () => {};
    }
  }

  /**
   * Update retention setting in hours (local fallback)
   */
  static setRetentionHours(hours: number): void {
    try {
      localStorage.setItem(RETENTION_STORAGE_KEY, String(hours));
    } catch {
      // ignore
    }
  }

  /**
   * Filter out messages that have already expired
   */
  static filterUnexpired(messages: ChatMessage[]): ChatMessage[] {
    const now = Date.now();
    return messages.filter((m) => {
      if (!m.expiresAt) return true;
      const expireTime = new Date(m.expiresAt).getTime();
      return isNaN(expireTime) || expireTime > now;
    });
  }

  /**
   * Load cached local messages
   */
  static getLocalMessages(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed: ChatMessage[] = JSON.parse(raw);
      return this.filterUnexpired(parsed);
    } catch {
      return [];
    }
  }

  /**
   * Save messages to local cache
   */
  static saveLocalMessages(messages: ChatMessage[]): void {
    try {
      const unexpired = this.filterUnexpired(messages);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(unexpired));
    } catch {
      // ignore
    }
  }

  /**
   * Prune expired messages in Firestore
   */
  static async pruneExpiredFirestoreMessages(): Promise<void> {
    try {
      const q = query(collection(db, CHAT_COLLECTION), limit(100));
      const snapshot = await getDocs(q);
      const now = Date.now();
      const deletePromises: Promise<void>[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ChatMessage;
        if (data.expiresAt) {
          const expireTime = new Date(data.expiresAt).getTime();
          if (!isNaN(expireTime) && expireTime <= now) {
            deletePromises.push(deleteDoc(doc(db, CHAT_COLLECTION, docSnap.id)));
          }
        }
      });

      if (deletePromises.length > 0) {
        await Promise.allSettled(deletePromises);
      }
    } catch (err) {
      console.warn('[Handled Notice] Chat cleanup check:', err);
    }
  }

  /**
   * Subscribe to real-time chat messages
   */
  static subscribeToMessages(callback: (messages: ChatMessage[]) => void): () => void {
    // Immediately emit local cache
    const initialLocal = this.getLocalMessages();
    callback(initialLocal);

    // Periodically prune expired messages
    this.pruneExpiredFirestoreMessages();

    try {
      const q = query(
        collection(db, CHAT_COLLECTION),
        orderBy('createdAt', 'asc'),
        limit(200)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: ChatMessage[] = [];
          snapshot.forEach((d) => {
            list.push({ ...d.data(), id: d.id } as ChatMessage);
          });

          const unexpired = this.filterUnexpired(list);
          this.saveLocalMessages(unexpired);
          callback(unexpired);
        },
        (error) => {
          console.warn('[Handled Notice] Firestore chat listener fallback:', error.message);
          // Fallback to local messages
          callback(this.getLocalMessages());
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[Handled Notice] Chat subscription error:', err);
      return () => {};
    }
  }

  /**
   * Send a new message to the shared space
   */
  static async sendMessage(
    currentUser: UserAccount,
    text: string,
    imageAttachment?: { dataUrl: string; fileName?: string },
    retentionHours?: number
  ): Promise<ChatMessage> {
    const hours = retentionHours || this.getRetentionHours();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const message: ChatMessage = {
      id,
      senderId: currentUser.userId,
      senderName: currentUser.displayName || (currentUser.role === 'admin' ? 'Admin' : 'Member'),
      senderRole: currentUser.role === 'admin' ? 'admin' : 'member',
      senderPhone: currentUser.phone,
      senderEmail: currentUser.email,
      text: text.trim(),
      imageUrl: imageAttachment?.dataUrl || undefined,
      imageFileName: imageAttachment?.fileName || undefined,
      createdAt: now.toISOString(),
      expiresAt,
    };

    // Update local immediately for snappy UX
    const current = this.getLocalMessages();
    const updated = [...current, message];
    this.saveLocalMessages(updated);

    // Sync to Firestore
    try {
      await setDoc(doc(db, CHAT_COLLECTION, id), message);
    } catch (err) {
      console.warn('[Handled Notice] Firestore message save notice:', err);
    }

    return message;
  }

  /**
   * Delete a specific message
   */
  static async deleteMessage(messageId: string): Promise<void> {
    // Remove locally
    const current = this.getLocalMessages().filter((m) => m.id !== messageId);
    this.saveLocalMessages(current);

    // Remove from Firestore
    try {
      await deleteDoc(doc(db, CHAT_COLLECTION, messageId));
    } catch (err) {
      console.warn('[Handled Notice] Message delete notice:', err);
    }
  }

  /**
   * Compress image file to base64 Data URL (optimizes screenshots for fast transmission)
   */
  static compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Compress to WebP or JPEG with 0.8 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }
}
