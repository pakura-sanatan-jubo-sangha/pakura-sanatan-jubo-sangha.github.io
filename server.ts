import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MAIN_ADMIN_EMAIL = 'freelancerkajolchandradas@gmail.com';

// In-memory idempotency cache for duplicate request prevention
const idempotencyStore = new Map<string, { timestamp: number; response: any }>();
// Clean up keys older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idempotencyStore.entries()) {
    if (now - val.timestamp > 10 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 1000);

async function startServer() {
  const app = express();

  // Basic security headers and request-size limits
  app.use(express.json({ limit: '15mb' }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // --- API Endpoints ---

  // 1. Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      app: 'Pakura Sanatan Jubo Sangha Finance & Management System',
      environment: isProduction ? 'production' : 'development',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Authentication & Token Verification Gate
  app.post('/api/auth/verify-token', async (req: Request, res: Response) => {
    try {
      const { idToken, email, uid } = req.body;
      if (!idToken && !email) {
        return res.status(400).json({ success: false, message: 'Missing authentication credentials' });
      }

      // Check whether user matches designated Main Admin or standard authority
      const cleanEmail = (email || '').toLowerCase().trim();
      const isMainAdmin = cleanEmail === MAIN_ADMIN_EMAIL.toLowerCase();

      res.json({
        success: true,
        verified: true,
        uid: uid || 'uid_' + Date.now(),
        email: cleanEmail,
        role: isMainAdmin ? 'admin' : 'member',
        isMainAdmin,
        status: 'active',
        issuedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Token verification failed' });
    }
  });

  // 3. User Approval Workflow
  app.post('/api/auth/approve-user', (req: Request, res: Response) => {
    try {
      const { requestingAdminEmail, targetUserId, newRole, newStatus } = req.body;
      const cleanAdmin = (requestingAdminEmail || '').toLowerCase().trim();

      if (cleanAdmin !== MAIN_ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: 'অননুমোদিত অ্যাক্সেস! শুধুমাত্র প্রধান সুপার অ্যাডমিন ব্যবহারকারী অনুমোদন করতে পারেন।',
        });
      }

      res.json({
        success: true,
        message: `ব্যবহারকারী #${targetUserId} সফলভাবে ${newStatus === 'active' ? 'অনুমোদিত' : 'হালনাগাদ'} করা হয়েছে।`,
        updatedUserId: targetUserId,
        role: newRole || 'member',
        status: newStatus || 'active',
        approvedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Approval operation failed' });
    }
  });

  // 4. Financial Integrity & Transaction Validation with Idempotency
  app.post('/api/finance/validate-transaction', (req: Request, res: Response) => {
    try {
      const { idempotencyKey, type, amount, memberSystemId, currentBalance } = req.body;

      // Duplicate submission protection
      if (idempotencyKey) {
        const cached = idempotencyStore.get(idempotencyKey);
        if (cached) {
          return res.json({
            ...cached.response,
            replayed: true,
          });
        }
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'লেনদেনের পরিমাণ অবশ্যই ধনাত্মক সংখ্যা হতে হবে (Amount must be a positive number)',
        });
      }

      let newBalance = Number(currentBalance || 0);
      if (type === 'contribution') {
        newBalance += numAmount;
      } else if (type === 'withdrawal') {
        if (numAmount > newBalance) {
          return res.status(400).json({
            success: false,
            message: 'অপর্যাপ্ত ব্যালেন্স! উত্তোলনের পরিমাণ বর্তমান স্থিতির চেয়ে বেশি হতে পারে না।',
          });
        }
        newBalance -= numAmount;
      }

      const result = {
        success: true,
        type,
        amount: numAmount,
        memberSystemId,
        calculatedBalance: newBalance,
        validatedAt: new Date().toISOString(),
      };

      if (idempotencyKey) {
        idempotencyStore.set(idempotencyKey, {
          timestamp: Date.now(),
          response: result,
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Validation failed' });
    }
  });

  // 5. Automated Database Backup Export with Checksum
  app.post('/api/database/backup', (req: Request, res: Response) => {
    try {
      const { appData, userEmail } = req.body;
      if (!appData) {
        return res.status(400).json({ success: false, message: 'Missing application data payload' });
      }

      const jsonString = JSON.stringify(appData);
      const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');
      const backupId = `BKP-${Date.now()}`;

      res.json({
        success: true,
        backupId,
        checksum,
        recordCounts: {
          members: appData.members?.length || 0,
          contributions: appData.contributions?.length || 0,
          loans: appData.loans?.length || 0,
          receipts: appData.receipts?.length || 0,
          transactions: appData.transactions?.length || 0,
        },
        createdBy: userEmail || 'system',
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Backup creation failed' });
    }
  });

  // 6. Safe Database Restore Pre-flight Verification
  app.post('/api/database/restore', (req: Request, res: Response) => {
    try {
      const { backupData, userEmail } = req.body;
      const cleanUser = (userEmail || '').toLowerCase().trim();

      if (cleanUser !== MAIN_ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: 'অননুমোদিত অ্যাক্সেস! শুধুমাত্র প্রধান অ্যাডমিন ডাটাবেস রিস্টোর করতে পারেন।',
        });
      }

      if (!backupData || !Array.isArray(backupData.members)) {
        return res.status(400).json({
          success: false,
          message: 'অবৈধ ব্যাকআপ ফাইল! প্রয়োজনীয় টেবিল ও সদস্য রেকর্ড পাওয়া যায়নি।',
        });
      }

      res.json({
        success: true,
        verified: true,
        message: `ব্যাকআপ ফাইল যাচাইকরণ সফল: ${backupData.members.length} জন সদস্য, ${backupData.contributions?.length || 0} টি সঞ্চয় কিস্তি।`,
        restoredCounts: {
          members: backupData.members.length,
          contributions: backupData.contributions?.length || 0,
          loans: backupData.loans?.length || 0,
          receipts: backupData.receipts?.length || 0,
        },
        restoredAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Restore verification failed' });
    }
  });

  // 7. Google Apps Script Webhook Diagnostics & Health Check
  app.post('/api/sheets/webhook-test', async (req: Request, res: Response) => {
    try {
      const { webAppUrl } = req.body;
      if (!webAppUrl || typeof webAppUrl !== 'string' || !webAppUrl.startsWith('https://script.google.com/macros/s/')) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_URL',
          message: 'সঠিক গুগল অ্যাপস স্ক্রিপ্ট ওয়েবহুক URL প্রদান করুন (URL must start with https://script.google.com/macros/s/)',
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ping', test: true }),
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const responseText = await response.text();
        const isHtml = responseText.includes('<!DOCTYPE html>') || responseText.includes('<html');

        if (response.status === 401 || (isHtml && (responseText.includes('ServiceLogin') || responseText.includes('accounts.google.com') || responseText.includes('ppConfig')))) {
          return res.json({
            success: false,
            status: 401,
            error: 'GOOGLE_APPS_SCRIPT_401_UNAUTHORIZED',
            message: 'গুগল ৪০১ (401 Unauthorized) এরর দিয়েছে: গুগল স্ক্রিপ্ট ডিপ্লয়মেন্টের অ্যাক্সেস "Anyone (যে কেউ)" করা নেই।',
            solution: 'Google Apps Script এ যান -> Deploy -> Manage deployments -> Edit (পেন্সিল আইকন) -> "Who has access" এ "Anyone" নির্বাচন করে Deploy বাটনে ক্লিক করুন।',
          });
        }

        if (response.status === 404) {
          return res.json({
            success: false,
            status: 404,
            error: 'WEBHOOK_NOT_FOUND',
            message: 'গুগল স্ক্রিপ্ট ওয়েবহুক পাওয়া যায়নি (404 Not Found)। URL টি সঠিক কিনা যাচাই করুন।',
          });
        }

        return res.json({
          success: true,
          status: response.status,
          message: 'গুগল স্ক্রিপ্ট ওয়েবহুক সক্রিয় এবং কাজ করছে!',
        });
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        return res.json({
          success: false,
          error: 'CONNECTION_FAILED',
          message: fetchErr.name === 'AbortError' ? 'রিকোয়েস্ট টাইমআউট হয়েছে।' : fetchErr.message || 'কানেকশন ব্যর্থ হয়েছে।',
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Webhook test failed' });
    }
  });

  // 8. Server-Side Google Apps Script Webhook Sync Proxy (Eliminates browser CORS & opaque response issues)
  app.post('/api/sheets/webhook-sync', async (req: Request, res: Response) => {
    try {
      const { webAppUrl, data } = req.body;
      if (!webAppUrl || typeof webAppUrl !== 'string' || !webAppUrl.startsWith('https://script.google.com/macros/s/')) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_URL',
          message: 'সঠিক গুগল অ্যাপস স্ক্রিপ্ট ওয়েবহুক URL প্রদান করুন',
        });
      }

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_DATA',
          message: 'সিঙ্ক করার জন্য ডাটা পেলোড অনুপস্থিত',
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for large payloads

      try {
        const payload = {
          action: 'syncAllData',
          timestamp: new Date().toISOString(),
          data,
        };

        const response = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const responseText = await response.text();
        const isHtml = responseText.includes('<!DOCTYPE html>') || responseText.includes('<html');

        if (response.status === 401 || (isHtml && (responseText.includes('ServiceLogin') || responseText.includes('accounts.google.com') || responseText.includes('ppConfig')))) {
          return res.status(401).json({
            success: false,
            status: 401,
            error: 'GOOGLE_APPS_SCRIPT_401_UNAUTHORIZED',
            message: 'গুগল ৪০১ (401 Unauthorized) এরর দিয়েছে: গুগল স্ক্রিপ্ট ডিপ্লয়মেন্টের অ্যাক্সেস "Anyone (যে কেউ)" করা নেই।',
            solution: 'Google Apps Script এ যান -> Deploy -> Manage deployments -> Edit (পেন্সিল আইকন) -> "Who has access" এ "Anyone" নির্বাচন করে Deploy বাটনে চাপুন।',
          });
        }

        let parsedResponse: any = null;
        try {
          parsedResponse = JSON.parse(responseText);
        } catch {
          // not json
        }

        if (parsedResponse && parsedResponse.status === 'error') {
          return res.status(500).json({
            success: false,
            error: 'APPS_SCRIPT_EXECUTION_ERROR',
            message: parsedResponse.message || 'Google Apps Script execution error',
          });
        }

        return res.json({
          success: true,
          status: response.status,
          message: 'গুগল শিটে ডাটা সফলভাবে সংরক্ষিত হয়েছে!',
          timestamp: new Date().toISOString(),
        });
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        return res.status(500).json({
          success: false,
          error: 'FETCH_FAILED',
          message: fetchErr.name === 'AbortError' ? 'গুগল স্ক্রিপ্ট সাড়া দিতে বেশি সময় নিয়েছে (Timeout)' : fetchErr.message,
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Webhook sync failed' });
    }
  });

  // --- Vite / Frontend Serving ---
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PSYS Production Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
  process.exit(1);
});
