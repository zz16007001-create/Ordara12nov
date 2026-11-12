/**
 * Data Protection, Backups, Storage Persistence, and Auto-Snapshots
 * Separate IndexedDB database: 'treasury_snapshots_v1'
 */

import { AppDataState } from '../types';

export interface BackupMeta {
  lastBackupDate: string | null;
  lastRecordCount: number;
  snoozeUntil: number | null;
}

export interface TreasurySnapshot {
  id: string;
  timestamp: string;
  reason: 'daily_auto' | 'pre_restore' | 'pre_reset' | 'manual';
  reasonLabel: string;
  recordCount: number;
  data: unknown;
}

export interface BackupSummary {
  version?: number;
  totalOrders: number;
  totalOfficeItems: number;
  totalCapitalTransactions: number;
  totalPocketTransactions: number;
  totalRecords: number;
  initialCapital: number;
  initialPocket: number;
  currency: string;
}

const BACKUP_META_KEY = 'treasury_backup_meta_v1';
const DAILY_SNAPSHOT_KEY = 'treasury_last_daily_snapshot_date';
const SNAPSHOT_DB_NAME = 'treasury_snapshots_v1';
const SNAPSHOT_STORE_NAME = 'snapshots';
const MAX_SNAPSHOTS = 5;

// ==========================================
// 1. Storage Persistence
// ==========================================

export async function initPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch (e) {
      console.warn('Storage persist error:', e);
      return false;
    }
  }
  return false;
}

export async function getStoragePersistenceStatus(): Promise<{ persisted: boolean; quota?: number; usage?: number }> {
  let persisted = false;
  let quota: number | undefined;
  let usage: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    if (navigator.storage.persisted) {
      try {
        persisted = await navigator.storage.persisted();
      } catch {
        persisted = false;
      }
    }
    if (navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        quota = est.quota;
        usage = est.usage;
      } catch {
        // ignore
      }
    }
  }

  return { persisted, quota, usage };
}

// ==========================================
// 2. Backup Metadata & Reminder Logic
// ==========================================

export function getBackupMeta(): BackupMeta {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return {
    lastBackupDate: null,
    lastRecordCount: 0,
    snoozeUntil: null,
  };
}

export function saveBackupMeta(updates: Partial<BackupMeta>): void {
  try {
    const current = getBackupMeta();
    const next = { ...current, ...updates };
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('Failed to save backup meta:', e);
  }
}

export function snoozeBackupReminder(): void {
  // Snooze for 24 hours
  const snoozeUntil = Date.now() + 24 * 60 * 60 * 1000;
  saveBackupMeta({ snoozeUntil });
}

export function shouldShowBackupReminder(currentRecordCount: number): boolean {
  const meta = getBackupMeta();

  // If snoozed and snooze time hasn't passed, do not show
  if (meta.snoozeUntil && Date.now() < meta.snoozeUntil) {
    return false;
  }

  // If never backed up and has records
  if (!meta.lastBackupDate) {
    return currentRecordCount > 0;
  }

  // Check days passed (> 7 days)
  const lastTime = new Date(meta.lastBackupDate).getTime();
  const daysPassed = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);
  if (daysPassed >= 7) {
    return true;
  }

  // Check records diff since last backup (>= 30 records)
  const recordsAdded = currentRecordCount - meta.lastRecordCount;
  if (recordsAdded >= 30) {
    return true;
  }

  return false;
}

// ==========================================
// 3. Share-based Backup (Web Share API)
// ==========================================

export async function shareBackup(
  dataJsonString: string,
  filename?: string
): Promise<{ success: boolean; method: 'share' | 'download' }> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const finalFilename = filename || `treasury_backup_${dateStr}_${timeStr}.json`;

  const blob = new Blob([dataJsonString], { type: 'application/json' });

  // Try Web Share API with file support first
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      const file = new File([blob], finalFilename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'نسخة احتياطية - برنامج الخزن والأوردرات',
          text: `نسخة احتياطية لقاعدة بيانات برنامج الخزن بتاريخ ${now.toLocaleString('en-GB')}`,
          files: [file],
        });
        return { success: true, method: 'share' };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, method: 'share' };
      }
      console.warn('Web Share failed, falling back to download:', err);
    }
  }

  // Fallback: standard file download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, method: 'download' };
}

// ==========================================
// 4. IndexedDB Auto-Snapshots ('treasury_snapshots_v1')
// ==========================================

function openSnapshotDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(SNAPSHOT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
        db.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const REASON_LABELS: Record<TreasurySnapshot['reason'], string> = {
  daily_auto: 'لقطة تلقائية يومية',
  pre_restore: 'لقطة أمان قبل الاستعادة',
  pre_reset: 'لقطة أمان قبل التصفير',
  manual: 'لقطة يدوية',
};

export async function takeSnapshot(
  data: unknown,
  reason: TreasurySnapshot['reason'],
  recordCount: number = 0
): Promise<void> {
  try {
    const db = await openSnapshotDB();
    const id = `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const snapshot: TreasurySnapshot = {
      id,
      timestamp: new Date().toISOString(),
      reason,
      reasonLabel: REASON_LABELS[reason] || reason,
      recordCount,
      data,
    };

    // Put new snapshot
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      const req = store.put(snapshot);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Trim to last MAX_SNAPSHOTS (5)
    const all = await getSnapshots();
    if (all.length > MAX_SNAPSHOTS) {
      all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const toDelete = all.slice(0, all.length - MAX_SNAPSHOTS);
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      for (const item of toDelete) {
        store.delete(item.id);
      }
    }
  } catch (e) {
    console.warn('Failed to take auto-snapshot:', e);
  }
}

export async function getSnapshots(): Promise<TreasurySnapshot[]> {
  try {
    const db = await openSnapshotDB();
    return new Promise<TreasurySnapshot[]>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: TreasurySnapshot[] = req.result || [];
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to get snapshots:', e);
    return [];
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  try {
    const db = await openSnapshotDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to delete snapshot:', e);
  }
}

export async function checkAndTriggerDailySnapshot(data: unknown, recordCount: number): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = localStorage.getItem(DAILY_SNAPSHOT_KEY);
    if (!lastDate) {
      await takeSnapshot(data, 'daily_auto', recordCount);
      localStorage.setItem(DAILY_SNAPSHOT_KEY, today);
      return true;
    }
    const diffDays = (new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 5) {
      await takeSnapshot(data, 'daily_auto', recordCount);
      localStorage.setItem(DAILY_SNAPSHOT_KEY, today);
      return true;
    }
  } catch (e) {
    console.warn('5-day snapshot check failed:', e);
  }
  return false;
}

// ==========================================
// 5. Data Validation Helper
// ==========================================

export function validateBackupJson(jsonString: string): {
  valid: boolean;
  error?: string;
  data?: AppDataState;
  summary?: BackupSummary;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'الملف لا يحتوي على كائن بيانات صالح بصيغة JSON.' };
    }

    const obj = parsed as Record<string, unknown>;

    // Check for AppDataState collections
    if (!Array.isArray(obj.orders)) {
      return { valid: false, error: 'الملف يفتقر إلى مصفوفة الأوردرات (orders).' };
    }
    if (!Array.isArray(obj.capitalTransactions)) {
      return { valid: false, error: 'الملف يفتقر إلى حركات رأس المال (capitalTransactions).' };
    }
    if (!Array.isArray(obj.pocketTransactions)) {
      return { valid: false, error: 'الملف يفتقر إلى حركات بوكيت (pocketTransactions).' };
    }

    const orders = obj.orders as unknown[];
    const officeItems = Array.isArray(obj.officeItems) ? (obj.officeItems as unknown[]) : [];
    const capitalTransactions = obj.capitalTransactions as unknown[];
    const pocketTransactions = obj.pocketTransactions as unknown[];
    const settings = (obj.settings || {}) as Record<string, unknown>;

    const initialCapital = Number(settings.initialCapital) || 0;
    const initialPocket = Number(settings.initialPocket) || 0;
    const currency = typeof settings.currency === 'string' ? settings.currency : 'ج.م';

    const totalRecords =
      orders.length + officeItems.length + capitalTransactions.length + pocketTransactions.length;

    const summary: BackupSummary = {
      version: typeof obj.version === 'number' ? obj.version : 1,
      totalOrders: orders.length,
      totalOfficeItems: officeItems.length,
      totalCapitalTransactions: capitalTransactions.length,
      totalPocketTransactions: pocketTransactions.length,
      totalRecords,
      initialCapital,
      initialPocket,
      currency,
    };

    return { valid: true, data: parsed as AppDataState, summary };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'خطأ في معالجة الملف';
    return { valid: false, error: `فشل قراءة الملف كـ JSON صحيح: ${msg}` };
  }
}
