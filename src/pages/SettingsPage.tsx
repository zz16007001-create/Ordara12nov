/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { AppSettings } from '../types';
import { Icon3D } from '../components/icons3d/Icon3D';
import {
  initPersistentStorage,
  getStoragePersistenceStatus,
  shareBackup,
  getBackupMeta,
  saveBackupMeta,
  getSnapshots,
  takeSnapshot,
  TreasurySnapshot,
} from '../services/backup';
import { SafeRestore } from '../components/SafeRestore';

export const SettingsPage: React.FC = () => {
  const {
    state,
    updateSettings,
    resetToCleanState,
    addRegisteredOffice,
    updateRegisteredOffice,
    deleteRegisteredOffice,
    downloadExcelReport,
    setCurrentPage,
  } = useApp();

  const [formData, setFormData] = useState<AppSettings>({ ...state.settings });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync formData whenever global settings change
  useEffect(() => {
    setFormData({ ...state.settings });
  }, [state.settings]);


  // Accordion open section (all closed by default)
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (sec: string) => {
    setOpenSection(openSection === sec ? null : sec);
  };

  // Office management state
  const [newOfficeName, setNewOfficeName] = useState('');
  const [editingOffice, setEditingOffice] = useState<{ oldName: string; newName: string } | null>(null);

  // Reset PIN flow state
  const [showResetModal, setShowResetModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPinVerified, setIsPinVerified] = useState(false);

  // Data Protection & Backup states
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [quotaInfo, setQuotaInfo] = useState<{ usage?: number; quota?: number }>({});
  const [backupMeta, setBackupMetaState] = useState(getBackupMeta());
  const [snapshots, setSnapshots] = useState<TreasurySnapshot[]>([]);
  const [isSharingBackup, setIsSharingBackup] = useState(false);
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<TreasurySnapshot | null>(null);

  const currentRecordCount =
    (state.capitalTransactions?.length || 0) +
    (state.pocketTransactions?.length || 0) +
    (state.orders?.length || 0) +
    (state.officeItems?.length || 0) +
    (state.salaryExpenses?.length || 0) +
    (state.charityRecords?.length || 0);

  const loadProtectionInfo = useCallback(async () => {
    const status = await getStoragePersistenceStatus();
    setIsPersisted(status.persisted);
    setQuotaInfo({ usage: status.usage, quota: status.quota });
    setBackupMetaState(getBackupMeta());
    const snaps = await getSnapshots();
    setSnapshots(snaps);
  }, []);

  useEffect(() => {
    loadProtectionInfo();
  }, [loadProtectionInfo]);

  const handleRequestPersistence = async () => {
    const granted = await initPersistentStorage();
    setIsPersisted(granted);
    if (granted) {
      alert('تم منح استمرارية التخزين بنجاح.');
    } else {
      alert('المتصفح لم يمنح الإذن، سيتم الاعتماد على IndexedDB الافتراضي.');
    }
  };

  const handleShareBackup = async () => {
    setIsSharingBackup(true);
    try {
      const json = JSON.stringify(state, null, 2);
      const res = await shareBackup(json);
      if (res.success) {
        saveBackupMeta({
          lastBackupDate: new Date().toISOString(),
          lastRecordCount: currentRecordCount,
        });
        setBackupMetaState(getBackupMeta());
      }
    } finally {
      setIsSharingBackup(false);
    }
  };

  const handleSubmitSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const totalSplit =
    formData.profitShareCapital + formData.profitSharePocket + formData.profitShareCharity;
  const isSplitValid = totalSplit === 100;

  const handleAddOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOfficeName.trim()) {
      addRegisteredOffice(newOfficeName.trim());
      setNewOfficeName('');
    }
  };

  const handleUpdateOffice = () => {
    if (editingOffice && editingOffice.newName.trim()) {
      updateRegisteredOffice(editingOffice.oldName, editingOffice.newName.trim());
      setEditingOffice(null);
    }
  };

  const handleDeleteOffice = (office: string) => {
    if (window.confirm(`هل أنت متأكد من حذف مكتب "${office}" من القائمة المعتمدة؟`)) {
      deleteRegisteredOffice(office);
    }
  };

  const handleVerifyPin = () => {
    if (pinInput.trim() === '191994') {
      setIsPinVerified(true);
      setPinError(null);
    } else {
      setPinError('رمز PIN غير صحيح.');
    }
  };

  const handleExecuteReset = async () => {
    await takeSnapshot(state, 'pre_reset', currentRecordCount);
    resetToCleanState();
    setShowResetModal(false);
    setIsPinVerified(false);
    setPinInput('');
    loadProtectionInfo();
    alert('تمت استعادة حالة المصنع وتصفير البيانات بنجاح!');
  };

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E] dark:text-[#F4F0FA]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج، ارتفاع 52px */}
      <div className="card-header-purple flex items-center justify-between">
        <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
          إعدادات النظام والأمان
        </span>

        <div className="flex items-center gap-[10px]">
          {saveSuccess && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-white font-bold text-[11px]">
              <Icon3D name="check" size={12} />
              <span>تم الحفظ</span>
            </div>
          )}
          <button
            onClick={() => setCurrentPage('entry')}
            className="btn-back-transparent"
            title="رجوع للرئيسية"
          >
            ➜
          </button>
        </div>
      </div>

      {/* 2. القوايم بنمط الأكورديون (card-main بدون حدود، مسافة 13px) */}
      <div className="w-full flex flex-col gap-[13px]">

        {/* كارت اختيار لون خلفية البرنامج */}
        <div className="card-main p-[15px] space-y-3">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
              <Icon3D name="settings" size={16} />
            </div>
            <div>
              <h3 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight">
                لون خلفية البرنامج
              </h3>
              <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block">
                اختر لون المظهر لكافة صفحات البرنامج
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap pt-1">
            {[
              { color: '#EDEEF2', label: 'رمادي فاتح (الافتراضي)' },
              { color: '#E5E7EB', label: 'رمادي' },
              { color: '#F3F4F6', label: 'رمادي ثلجي' },
              { color: '#F5F0E6', label: 'بيج' },
              { color: '#EFE6D8', label: 'بيج غامق خفيف' },
              { color: '#FAF8F3', label: 'أوف وايت' },
              { color: '#E8F1EC', label: 'أخضر فاتح' },
              { color: '#E6EEF7', label: 'أزرق فاتح' },
              { color: '#F7E9EE', label: 'وردي فاتح' },
              { color: '#F0EAF7', label: 'بنفسجي فاتح' },
            ].map((item) => {
              const current = state.settings.appBgColor || '#EDEEF2';
              const isSelected = current.toLowerCase() === item.color.toLowerCase();
              return (
                <button
                  key={item.color}
                  type="button"
                  onClick={() => updateSettings({ appBgColor: item.color })}
                  title={item.label}
                  className={`w-[32px] h-[32px] rounded-full border border-black/10 transition-transform cursor-pointer hover:scale-105 active:scale-95 shrink-0 ${
                    isSelected ? 'ring-2 ring-[#5F2967] ring-offset-2 scale-105' : ''
                  }`}
                  style={{ backgroundColor: item.color }}
                />
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* ACCORDION 1: النسخ الاحتياطي وتصدير Excel                 */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('backup')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                <Icon3D name="download" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight truncate">
                  النسخ الاحتياطي وتصدير البيانات
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  تصدير ملف Excel المنسق، ومشاركة نسخة JSON
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'backup' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'backup' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3 text-[12px]">
              {/* Storage status line */}
              <div className="card-inner space-y-1.5 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#666079] dark:text-[#9E97B0] text-[11px] font-[600]">استمرارية التخزين:</span>
                  {isPersisted ? (
                    <span className="text-[#2F7F5F] dark:text-[#4BA682] font-[700] text-[11px]">نشطة ومحمية</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestPersistence}
                      className="px-2.5 py-0.5 rounded-full bg-[#5F2967] text-white text-[10px] font-[700]"
                    >
                      تفعيل الحماية
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#666079] dark:text-[#9E97B0]">
                  <span>آخر نسخة احتياطية:</span>
                  <span className="font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] tabular-nums">
                    {backupMeta.lastBackupDate
                      ? new Date(backupMeta.lastBackupDate).toLocaleDateString('en-GB')
                      : 'لم يتم أخذ نسخة بعد'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Excel Export & JSON Share/Restore */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={downloadExcelReport}
                  className="w-full h-[40px] rounded-[14px] bg-[#2F7F5F] hover:bg-[#25664C] text-white font-[800] text-[12px] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon3D name="excel" size={18} />
                  <span>تصدير ملف Excel المنسق (9 صفحات)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleShareBackup}
                    disabled={isSharingBackup}
                    className="h-[36px] rounded-[14px] bg-[#5F2967] hover:bg-[#4E2254] text-white font-[700] text-[12px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Icon3D name="download" size={15} />
                    <span>مشاركة نسخة JSON</span>
                  </button>

                  <SafeRestore
                    buttonText="استعادة نسخة احتياطية"
                    onSuccess={loadProtectionInfo}
                    initialSnapshot={selectedSnapshotForRestore}
                    onCloseInitialSnapshot={() => setSelectedSnapshotForRestore(null)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ACCORDION 2: لقطات الأمان (كل 5 أيام)                     */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('snapshots')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                <Icon3D name="layers" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight truncate">
                  لقطات الأمان التلقائية (كل 5 أيام)
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  حفظ تلقائي دوري بحد أقصى 5 لقطات في الذاكرة
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'snapshots' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'snapshots' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-2 text-[12px]">
              <div className="pt-2">
                {snapshots.length === 0 ? (
                  <p className="text-center text-[#666079] dark:text-[#9E97B0] py-3 text-[11px]">
                    لا توجد لقطات محفوظة حالياً
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {snapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="card-inner flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <strong className="text-[#1F1A2E] dark:text-[#F4F0FA] font-[700] block text-[12px]">
                            {snap.reasonLabel}
                          </strong>
                          <span className="text-[10px] text-[#666079] dark:text-[#9E97B0] tabular-nums">
                            {new Date(snap.timestamp).toLocaleString('en-GB')} • {snap.recordCount} سجل
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSnapshotForRestore(snap)}
                          className="h-[28px] px-3 rounded-full bg-white dark:bg-[#211A2D] border border-[#5F2967] text-[#5F2967] dark:text-[#D8B4FE] font-[700] text-[11px] cursor-pointer"
                        >
                          استعادة
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ACCORDION 3: إدارة المكاتب المعتمدة                      */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('offices')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                <Icon3D name="offices" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight truncate">
                  إدارة المكاتب والموردين المعتمدين
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  {state.settings.registeredOffices?.length || 0} مكاتب مسجلة
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'offices' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'offices' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3 text-[12px]">
              <form onSubmit={handleAddOffice} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="اسم المكتب الجديد..."
                  value={newOfficeName}
                  onChange={(e) => setNewOfficeName(e.target.value)}
                  className="flex-1 h-[34px] px-3 rounded-[12px] border border-[#D4D0E0] dark:border-[#3A3150] bg-[#F5F4F9] dark:bg-[#1A1424] text-[12px] font-[700] outline-none focus:border-[#5F2967]"
                />
                <button
                  type="submit"
                  disabled={!newOfficeName.trim()}
                  className="h-[34px] px-4 rounded-[12px] bg-[#5F2967] hover:bg-[#4E2254] disabled:opacity-50 text-white font-[700] text-[12px] cursor-pointer"
                >
                  إضافة
                </button>
              </form>

              <div className="space-y-1.5">
                {(state.settings.registeredOffices || []).map((office) => {
                  const isEditing = editingOffice?.oldName === office;
                  return (
                    <div
                      key={office}
                      className="card-inner flex items-center justify-between text-[12px]"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingOffice.newName}
                            onChange={(e) =>
                              setEditingOffice({ ...editingOffice, newName: e.target.value })
                            }
                            className="flex-1 h-[28px] px-2.5 rounded-[8px] border border-[#5F2967] bg-white dark:bg-[#211A2D] text-[12px] font-[700]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleUpdateOffice}
                            className="w-[28px] h-[28px] rounded-[8px] bg-[#2F7F5F] text-white flex items-center justify-center cursor-pointer"
                          >
                            <Icon3D name="check" size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingOffice(null)}
                            className="w-[28px] h-[28px] rounded-[8px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            <Icon3D name="close" size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Icon3D name="offices" size={16} />
                            <strong className="text-[#1F1A2E] dark:text-[#F4F0FA] font-[700]">{office}</strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingOffice({ oldName: office, newName: office })}
                              className="p-1 text-[#666079] hover:text-[#3D6A8F] cursor-pointer"
                              title="تعديل"
                            >
                              <Icon3D name="edit" size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOffice(office)}
                              className="p-1 text-[#666079] hover:text-[#A23B5A] cursor-pointer"
                              title="حذف"
                            >
                              <Icon3D name="trash" size={15} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ACCORDION 4: الأرصدة الابتدائية                            */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('initial_balances')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                <Icon3D name="capital" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight truncate">
                  الأرصدة الابتدائية
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  رأس المال الأساسي ورصيد بوكيت الافتتاحي
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'initial_balances' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'initial_balances' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3 text-[12px]">
              <form onSubmit={handleSubmitSettings} className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mb-1">
                      رأس المال الأساسي ({formData.currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.initialCapital}
                      onChange={(e) =>
                        setFormData({ ...formData, initialCapital: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-[36px] px-3 rounded-[12px] border border-[#D4D0E0] dark:border-[#3A3150] bg-[#F5F4F9] dark:bg-[#1A1424] text-[12px] font-[800] tabular-nums outline-none focus:border-[#5F2967]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mb-1">
                      رصيد بوكيت الافتتاحي ({formData.currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.initialPocket}
                      onChange={(e) =>
                        setFormData({ ...formData, initialPocket: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-[36px] px-3 rounded-[12px] border border-[#D4D0E0] dark:border-[#3A3150] bg-[#F5F4F9] dark:bg-[#1A1424] text-[12px] font-[800] tabular-nums outline-none focus:border-[#5F2967]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-[38px] rounded-[14px] bg-[#5F2967] hover:bg-[#4E2254] text-white font-[700] text-[12px] transition cursor-pointer"
                >
                  حفظ الأرصدة
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ACCORDION 5: نسب توزيع الأرباح                            */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('profit_split')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                <Icon3D name="pie" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight truncate">
                  نسب توزيع أرباح الأوردرات
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  {totalSplit}% {isSplitValid ? '(صحيح = 100%)' : '(خطأ: يجب أن يساوي 100%)'}
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'profit_split' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'profit_split' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3 text-[12px]">
              <form onSubmit={handleSubmitSettings} className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="card-inner">
                    <label className="block text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mb-1">
                      رأس المال (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={formData.profitShareCapital}
                      onChange={(e) =>
                        setFormData({ ...formData, profitShareCapital: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-[32px] rounded-[8px] border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] font-[800] text-[#5F2967] dark:text-[#D8B4FE] text-center text-[12px] tabular-nums"
                    />
                  </div>
                  <div className="card-inner">
                    <label className="block text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mb-1">
                      بوكيت (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={formData.profitSharePocket}
                      onChange={(e) =>
                        setFormData({ ...formData, profitSharePocket: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-[32px] rounded-[8px] border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] font-[800] text-[#3D6A8F] dark:text-[#93C5FD] text-center text-[12px] tabular-nums"
                    />
                  </div>
                  <div className="card-inner">
                    <label className="block text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mb-1">
                      الصدقة (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={formData.profitShareCharity}
                      onChange={(e) =>
                        setFormData({ ...formData, profitShareCharity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-[32px] rounded-[8px] border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] font-[800] text-[#2F7F5F] dark:text-[#4BA682] text-center text-[12px] tabular-nums"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-[38px] rounded-[14px] bg-[#5F2967] hover:bg-[#4E2254] text-white font-[700] text-[12px] transition cursor-pointer"
                >
                  حفظ نسب الأرباح
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ACCORDION 6: حد الأمان المالي                            */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('safety_threshold')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                <Icon3D name="shield_alert" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight truncate">
                  حد الأمان لتنبيه رصيد بوكيت
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  التنبيه عند انخفاض الرصيد عن {formData.pocketWarningThreshold} {formData.currency}
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'safety_threshold' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'safety_threshold' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3 text-[12px]">
              <form onSubmit={handleSubmitSettings} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mb-1">
                    حد الأمان الأدنى ({formData.currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.pocketWarningThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, pocketWarningThreshold: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full h-[36px] px-3 rounded-[12px] border border-[#D4D0E0] dark:border-[#3A3150] bg-[#F5F4F9] dark:bg-[#1A1424] text-[12px] font-[800] tabular-nums outline-none focus:border-[#5F2967]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-[38px] rounded-[14px] bg-[#5F2967] hover:bg-[#4E2254] text-white font-[700] text-[12px] transition cursor-pointer"
                >
                  حفظ حد الأمان
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ACCORDION 7: منطقة الخطر (إعادة ضبط المصنع برمز PIN 191994)*/}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('danger_zone')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F8E6EC] dark:bg-[#381B26] text-[#A23B5A] dark:text-[#FB7185] flex items-center justify-center shrink-0">
                <Icon3D name="danger" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#A23B5A] dark:text-[#FB7185] leading-tight truncate">
                  منطقة الخطر وإعادة الضبط
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  تصفير البيانات بالكامل (محمي برمز PIN)
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'danger_zone' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'danger_zone' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3 text-[12px]">
              <div className="pt-2 space-y-2">
                <p className="text-[11px] text-[#A23B5A] dark:text-[#FB7185] leading-relaxed">
                  تنبيه: إعادة الضبط تمسح جميع الحركات والأوردرات المسجلة. قبل المسح يتم حفظ لقطة أمان تلقائية، ويتطلب إدخال رمز PIN المالي للمتابعة.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(true);
                    setIsPinVerified(false);
                    setPinInput('');
                    setPinError(null);
                  }}
                  className="w-full h-[38px] rounded-[14px] border border-[#A23B5A]/30 bg-[#F8E6EC] dark:bg-[#381B26] text-[#A23B5A] dark:text-[#FB7185] font-[700] text-[12px] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon3D name="lock" size={16} />
                  <span>بدء إجراءات إعادة ضبط المصنع...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-Step Reset Modal with PIN 191994 */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="card-main max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E1EC] dark:border-[#3A3150]">
              <div className="flex items-center gap-2 text-[#A23B5A] dark:text-[#FB7185] font-[800] text-[14px]">
                <Icon3D name="danger" size={18} />
                <span>إعادة ضبط المصنع</span>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-[#F4F0FA]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            {!isPinVerified ? (
              <div className="space-y-3">
                <p className="text-[11px] text-[#666079] dark:text-[#9E97B0] leading-relaxed">
                  يرجى إدخال رمز الحماية (PIN) للمتابعة:
                </p>
                <input
                  type="password"
                  placeholder="أدخل رمز PIN..."
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  className="w-full h-[40px] px-3 rounded-[12px] border border-[#D4D0E0] dark:border-[#3A3150] bg-[#F5F4F9] dark:bg-[#1A1424] text-center font-mono text-base tracking-widest outline-none focus:border-[#5F2967]"
                  autoFocus
                />
                {pinError && (
                  <span className="text-[10px] text-[#A23B5A] dark:text-[#FB7185] font-[700] block text-center">
                    {pinError}
                  </span>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleVerifyPin}
                    className="flex-1 h-[36px] rounded-[12px] bg-[#5F2967] hover:bg-[#4E2254] text-white font-[700] text-[12px] cursor-pointer"
                  >
                    تحقق
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="h-[36px] px-4 rounded-[12px] bg-[#F5F4F9] dark:bg-[#1A1424] text-[12px] font-[700] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-[14px] bg-[#F8E6EC] dark:bg-[#381B26] border border-[#A23B5A]/30 text-[#A23B5A] dark:text-[#FB7185] text-[11px] leading-relaxed space-y-1">
                  <strong className="block font-[800]">تحذير نهائي:</strong>
                  <span>سيتم حذف جميع السجلات بصورة نهائية ولا يمكن التراجع بعد الضغط.</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    className="flex-1 h-[36px] rounded-[12px] bg-[#A23B5A] hover:bg-[#832D46] text-white font-[800] text-[12px] cursor-pointer"
                  >
                    تأكيد التصفير النهائي
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="h-[36px] px-4 rounded-[12px] bg-[#F5F4F9] dark:bg-[#1A1424] text-[12px] font-[700] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
