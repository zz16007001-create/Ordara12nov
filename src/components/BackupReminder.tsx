/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  shouldShowBackupReminder,
  snoozeBackupReminder,
  saveBackupMeta,
  shareBackup,
  initPersistentStorage,
  checkAndTriggerDailySnapshot,
} from '../services/backup';
import { Icon3D } from './icons3d/Icon3D';

export const BackupReminder: React.FC = () => {
  const { state } = useApp();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compute total record count across active collections
  const currentRecordCount =
    (state.capitalTransactions?.length || 0) +
    (state.pocketTransactions?.length || 0) +
    (state.orders?.length || 0) +
    (state.officeItems?.length || 0) +
    (state.salaryExpenses?.length || 0) +
    (state.charityRecords?.length || 0);

  // On mount: try storage persist, daily snapshot, and check reminder
  useEffect(() => {
    initPersistentStorage();
    if (currentRecordCount > 0) {
      checkAndTriggerDailySnapshot(state, currentRecordCount);
    }
    const show = shouldShowBackupReminder(currentRecordCount);
    setVisible(show);
  }, [currentRecordCount, state]);

  if (!visible) return null;

  const handleBackupNow = async () => {
    setSaving(true);
    try {
      const json = JSON.stringify(state, null, 2);
      const res = await shareBackup(json);
      if (res.success) {
        saveBackupMeta({
          lastBackupDate: new Date().toISOString(),
          lastRecordCount: currentRecordCount,
          snoozeUntil: null,
        });
        setVisible(false);
      }
    } catch (e) {
      console.warn('Backup error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSnooze = () => {
    snoozeBackupReminder();
    setVisible(false);
  };

  return (
    <div className="bg-gradient-to-l from-amber-500/15 via-amber-400/10 to-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-[#2B2340] dark:text-[#F2EEF7] text-xs transition-all animate-fadeIn">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-right w-full sm:w-auto">
          <div className="flex-shrink-0 p-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Icon3D name="security" size={18} />
          </div>
          <div>
            <p className="font-bold text-amber-900 dark:text-amber-300">
              تذكير أمان البيانات: لم تقم بحفظ نسخة احتياطية حديثة!
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              احفظ نسختك الآن على واتساب أو Google Drive لحماية أموالك وسجلاتك من فقدان المتصفح.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleBackupNow}
            disabled={saving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Icon3D name="cloud" size={14} />
            <span>{saving ? 'جاري الحفظ...' : 'احفظ نسخة الآن'}</span>
          </button>
          <button
            onClick={handleSnooze}
            className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#231A2C]/80 hover:bg-white dark:hover:bg-[#2d2238] border border-amber-500/20 text-slate-700 dark:text-slate-300 font-medium text-xs transition cursor-pointer"
          >
            ذكّرني بكرة
          </button>
        </div>
      </div>
    </div>
  );
};
