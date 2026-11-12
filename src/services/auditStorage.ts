/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditPeriod, AuditLogItem } from '../types';

const AUDIT_STORAGE_KEY = 'ammar_audit_period_v1';

function formatTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrentTime(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function createNewAuditPeriod(): AuditPeriod {
  return {
    id: 'period_' + Date.now(),
    startDate: formatTodayDate(),
    startTime: formatCurrentTime(),
    startedAt: new Date().toISOString(),
    items: [],
    deletedSourceIds: [],
  };
}

export function getAuditPeriod(): AuditPeriod {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) {
      const initial = createNewAuditPeriod();
      saveAuditPeriod(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !Array.isArray(parsed.items)) {
      const fresh = createNewAuditPeriod();
      saveAuditPeriod(fresh);
      return fresh;
    }
    if (!parsed.deletedSourceIds) {
      parsed.deletedSourceIds = [];
    }
    return parsed;
  } catch {
    return createNewAuditPeriod();
  }
}

export function saveAuditPeriod(period: AuditPeriod): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(period));
    window.dispatchEvent(new CustomEvent('audit-period-updated', { detail: period }));
  } catch (err) {
    console.warn('Failed to save audit period', err);
  }
}

export function recordAuditEntry(
  entry: Omit<AuditLogItem, 'id' | 'registeredAt'>
): AuditLogItem | null {
  const period = getAuditPeriod();

  // If this source was manually deleted from audit log, never re-add it automatically
  if (entry.sourceId && period.deletedSourceIds?.includes(entry.sourceId)) {
    return null;
  }

  // Deduplicate by sourceId if present in current items
  if (entry.sourceId && period.items.some((item) => item.sourceId === entry.sourceId)) {
    return null; // Already logged
  }

  const newItem: AuditLogItem = {
    ...entry,
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    registeredAt: new Date().toISOString(),
  };

  period.items.unshift(newItem);
  saveAuditPeriod(period);
  return newItem;
}

/**
 * Edit an audit log entry in the documentation ledger only.
 * Does NOT touch any original orders, transactions, cashboxes, or debts.
 */
export function updateAuditEntry(
  id: string,
  updates: Partial<Pick<AuditLogItem, 'title' | 'itemName' | 'itemSize' | 'amount' | 'details' | 'notes'>>
): AuditLogItem | null {
  const period = getAuditPeriod();
  const index = period.items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  period.items[index] = {
    ...period.items[index],
    ...updates,
  };

  saveAuditPeriod(period);
  return period.items[index];
}

/**
 * Delete an entry from the audit log ONLY.
 * Records the sourceId so background synchronizations will not re-insert it.
 * Zero effect on real transactions, orders, inventory, or balances.
 */
export function deleteAuditEntry(id: string): boolean {
  const period = getAuditPeriod();
  const itemToDelete = period.items.find((item) => item.id === id);
  if (!itemToDelete) return false;

  if (!period.deletedSourceIds) {
    period.deletedSourceIds = [];
  }

  if (itemToDelete.sourceId && !period.deletedSourceIds.includes(itemToDelete.sourceId)) {
    period.deletedSourceIds.push(itemToDelete.sourceId);
  }

  period.items = period.items.filter((item) => item.id !== id);
  saveAuditPeriod(period);
  return true;
}

/**
 * تقفيل سجل المراجعة وبدء فترة جديدة تبدأ من اللحظة دي بالضبط (startedAt).
 * المزامنة التلقائية في صفحة المراجعة بتتجاهل أي بيع/دفعة اتسجلت قبل اللحظة دي،
 * وأي حركة بعدها (حتى لو في نفس اليوم) بتتسجل عادي.
 */
export function resetAuditPeriod(): AuditPeriod {
  const newPeriod = createNewAuditPeriod();
  saveAuditPeriod(newPeriod);
  return newPeriod;
}

/**
 * إزالة سطر من سجل المراجعة بالمصدر (مثلاً عند إلغاء دفعة) بدون ما يتسجل تاني تلقائياً.
 */
export function removeAuditEntryBySourceId(sourceId: string): void {
  const period = getAuditPeriod();
  const before = period.items.length;
  period.items = period.items.filter((item) => item.sourceId !== sourceId);
  if (!period.deletedSourceIds) period.deletedSourceIds = [];
  if (!period.deletedSourceIds.includes(sourceId)) period.deletedSourceIds.push(sourceId);
  if (before !== period.items.length || true) saveAuditPeriod(period);
}
