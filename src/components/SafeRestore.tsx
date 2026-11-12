/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  validateBackupJson,
  takeSnapshot,
  saveBackupMeta,
  BackupSummary,
  TreasurySnapshot,
} from '../services/backup';
import { Icon3D } from './icons3d/Icon3D';

interface SafeRestoreProps {
  buttonText?: string;
  buttonClassName?: string;
  onSuccess?: () => void;
  // If restoring from an existing snapshot directly
  initialSnapshot?: TreasurySnapshot | null;
  onCloseInitialSnapshot?: () => void;
}

export const SafeRestore: React.FC<SafeRestoreProps> = ({
  buttonText = 'استعادة نسخة احتياطية (فحص ذكي)',
  buttonClassName,
  onSuccess,
  initialSnapshot,
  onCloseInitialSnapshot,
}) => {
  const { state, restoreFromJson } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [pendingSummary, setPendingSummary] = useState<BackupSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If initialSnapshot passed from outside
  React.useEffect(() => {
    if (initialSnapshot) {
      try {
        const jsonStr = JSON.stringify(initialSnapshot.data);
        const val = validateBackupJson(jsonStr);
        if (val.valid && val.summary) {
          setPendingContent(jsonStr);
          setPendingSummary(val.summary);
          setErrorMessage(null);
          setIsOpen(true);
        } else {
          setErrorMessage(val.error || 'اللقطة غير صالحة');
          setIsOpen(true);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطأ في معالجة اللقطة';
        setErrorMessage(msg);
        setIsOpen(true);
      }
    }
  }, [initialSnapshot]);

  // Current state counts
  const currentOrders = state.orders?.length || 0;
  const currentOfficeItems = state.officeItems?.length || 0;
  const currentCapitalTxs = state.capitalTransactions?.length || 0;
  const currentPocketTxs = state.pocketTransactions?.length || 0;
  const currentRecordCount = currentOrders + currentOfficeItems + currentCapitalTxs + currentPocketTxs;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = validateBackupJson(content);
      if (!res.valid) {
        setErrorMessage(res.error || 'الملف غير صالح');
        setPendingContent(null);
        setPendingSummary(null);
        setIsOpen(true);
      } else {
        setErrorMessage(null);
        setPendingContent(content);
        setPendingSummary(res.summary || null);
        setIsOpen(true);
      }
    };
    reader.onerror = () => {
      setErrorMessage('تعذر قراءة محتوى الملف.');
      setIsOpen(true);
    };
    reader.readAsText(file, 'UTF-8');

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingContent) return;
    setIsProcessing(true);

    try {
      // 1. Mandatory Auto-Snapshot before restore
      await takeSnapshot(state, 'pre_restore', currentRecordCount);

      // 2. Perform restore via File object expected by restoreFromJson
      const file = new File([pendingContent], 'restored_backup.json', { type: 'application/json' });
      await restoreFromJson(file);

      saveBackupMeta({
        lastBackupDate: new Date().toISOString(),
        lastRecordCount: pendingSummary?.totalRecords || currentRecordCount,
      });

      setSuccessMessage('تمت استعادة البيانات بنجاح تام وتم أخذ لقطة أمان احتياطية أولاً!');
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage(null);
        setPendingContent(null);
        setPendingSummary(null);
        if (onCloseInitialSnapshot) onCloseInitialSnapshot();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
      setErrorMessage(`فشل الاستعادة: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setErrorMessage(null);
    setPendingContent(null);
    setPendingSummary(null);
    setSuccessMessage(null);
    if (onCloseInitialSnapshot) onCloseInitialSnapshot();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={
          buttonClassName ||
          'w-full py-3 rounded-2xl bg-white dark:bg-[#231A2C] border-2 border-[#5F2967]/20 dark:border-[#5F2967]/40 text-[#5F2967] dark:text-[#9B67A4] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#5F2967]/5 transition cursor-pointer'
        }
      >
        <Icon3D name="upload" size={18} />
        <span>{buttonText}</span>
      </button>

      {/* Comparison / Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#231A2C] p-6 shadow-2xl border border-[#ECECF4] dark:border-[#32263F] text-right my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECF4] dark:border-[#32263F]">
              <h3 className="font-extrabold text-[#2B2340] dark:text-white flex items-center gap-2 text-base">
                <Icon3D name="security" size={24} />
                الفحص الآمن والاستعادة المقارنة
              </h3>
              <button
                onClick={handleClose}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <Icon3D name="close" size={20} />
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">
                <p className="font-bold flex items-center gap-2">
                  <Icon3D name="warning" size={18} />
                  تعذر استعادة هذه النسخة:
                </p>
                <p className="mt-1 text-xs">{errorMessage}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  لم يتم إجراء أي تعديل على بياناتك الحالية.
                </p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-2">
                <Icon3D name="checked" size={20} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Valid comparison table */}
            {pendingSummary && !errorMessage && !successMessage && (
              <div className="mt-4 space-y-4">
                <div className="p-3 rounded-2xl bg-[#5F2967]/5 border border-[#5F2967]/15 text-xs text-[#2B2340] dark:text-[#F2EEF7]">
                  <p className="font-bold text-[#5F2967] dark:text-[#9B67A4]">
                    تم فحص ملف النسخة والتحقق من سلامة الجداول بنجاح!
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    سيتم أخذ لقطة أمان تلقائية من بياناتك الحالية قبل الاستبدال لتتمكن من الرجوع إليها في أي وقت.
                  </p>
                </div>

                {/* Comparison Grid */}
                <div className="border border-[#ECECF4] dark:border-[#32263F] rounded-2xl overflow-hidden text-xs">
                  <div className="grid grid-cols-3 bg-[#F1F1FA] dark:bg-[#1d1525] p-2.5 font-bold text-slate-600 dark:text-slate-300 border-b border-[#ECECF4] dark:border-[#32263F]">
                    <div>البند</div>
                    <div className="text-center text-slate-500">الحالي بالتطبيق</div>
                    <div className="text-center text-[#5F2967] dark:text-[#9B67A4]">الموجود بالملف</div>
                  </div>

                  <div className="divide-y divide-[#ECECF4] dark:divide-[#32263F]">
                    <div className="grid grid-cols-3 p-2.5 items-center">
                      <span className="font-medium text-slate-600 dark:text-slate-300">عدد الأوردرات</span>
                      <span className="text-center font-bold">{currentOrders}</span>
                      <span className="text-center font-bold text-[#5F2967] dark:text-[#9B67A4]">
                        {pendingSummary.totalOrders}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 p-2.5 items-center">
                      <span className="font-medium text-slate-600 dark:text-slate-300">أصناف المكاتب</span>
                      <span className="text-center font-bold">{currentOfficeItems}</span>
                      <span className="text-center font-bold text-[#5F2967] dark:text-[#9B67A4]">
                        {pendingSummary.totalOfficeItems}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 p-2.5 items-center">
                      <span className="font-medium text-slate-600 dark:text-slate-300">حركات رأس المال</span>
                      <span className="text-center font-bold">{currentCapitalTxs}</span>
                      <span className="text-center font-bold text-[#5F2967] dark:text-[#9B67A4]">
                        {pendingSummary.totalCapitalTransactions}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 p-2.5 items-center">
                      <span className="font-medium text-slate-600 dark:text-slate-300">حركات بوكيت والسلف</span>
                      <span className="text-center font-bold">{currentPocketTxs}</span>
                      <span className="text-center font-bold text-[#5F2967] dark:text-[#9B67A4]">
                        {pendingSummary.totalPocketTransactions}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 p-2.5 items-center">
                      <span className="font-medium text-slate-600 dark:text-slate-300">رأس المال الأساسي</span>
                      <span className="text-center">
                        {(state.settings.initialCapital || 0).toLocaleString('en-US')} {state.settings.currency}
                      </span>
                      <span className="text-center text-[#5F2967] dark:text-[#9B67A4] font-bold">
                        {pendingSummary.initialCapital.toLocaleString('en-US')} {pendingSummary.currency}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 p-2.5 items-center">
                      <span className="font-medium text-slate-600 dark:text-slate-300">رصيد بوكيت الافتتاحي</span>
                      <span className="text-center">
                        {(state.settings.initialPocket || 0).toLocaleString('en-US')} {state.settings.currency}
                      </span>
                      <span className="text-center text-[#5F2967] dark:text-[#9B67A4] font-bold">
                        {pendingSummary.initialPocket.toLocaleString('en-US')} {pendingSummary.currency}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleConfirmRestore}
                    disabled={isProcessing}
                    className="flex-1 py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] active:scale-95 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Icon3D name="checked" size={16} />
                    <span>{isProcessing ? 'جاري الاستعادة...' : 'تأكيد واستبدال البيانات'}</span>
                  </button>
                  <button
                    onClick={handleClose}
                    disabled={isProcessing}
                    className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-[#1d1525] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
