/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { QuickEntryModal } from './components/QuickEntryModal';
import { BackupReminder } from './components/BackupReminder';
import { EntryPage } from './pages/EntryPage';
import { BagPage } from './pages/BagPage';
import { OfficesPage } from './pages/OfficesPage';
import { OrdersPage } from './pages/OrdersPage';
import { CapitalPage } from './pages/CapitalPage';
import { SalaryPage } from './pages/SalaryPage';
import { PocketPage } from './pages/PocketPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomersPage } from './pages/CustomersPage';
import { AuditPage } from './pages/AuditPage';

function AppContent() {
  const { currentPage, isQuickModalOpen, closeQuickModal, quickModalTab, state } = useApp();
  const [updateAction, setUpdateAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ update: () => void }>;
      if (custom.detail?.update) {
        setUpdateAction(() => custom.detail.update);
      }
    };
    window.addEventListener('sw-update-available', handleUpdate);
    return () => window.removeEventListener('sw-update-available', handleUpdate);
  }, []);

  return (
    <div
      dir="rtl"
      style={{ backgroundColor: state.settings.appBgColor || '#EDEEF2' }}
      className="min-h-screen dark:bg-[#14101B] text-[#1F1A2E] dark:text-[#F4F0FA] flex flex-col transition-colors duration-200"
    >
      {/* Service Worker Update Toast */}
      {updateAction && (
        <div className="bg-[#5F2967] text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md z-50">
          <span>يوجد تحديث جديد للبرنامج متاح!</span>
          <button
            onClick={() => updateAction()}
            className="px-3 py-1 rounded-xl bg-white text-[#5F2967] font-black hover:bg-slate-100 transition cursor-pointer active:scale-95"
          >
            تحديث الآن
          </button>
        </div>
      )}

      {/* Backup Reminder Banner */}
      <BackupReminder />

      {/* Navigation Bar (Header + Floating Button + Bottom Sheet) */}
      <Navbar />

      {/* Main Page Content */}
      <main className="flex-1 w-full max-w-[430px] mx-auto px-[15px] pt-[12px] pb-[90px]">
        {currentPage === 'entry' && <EntryPage />}
        {currentPage === 'bag' && <BagPage />}
        {currentPage === 'offices' && <OfficesPage />}
        {currentPage === 'orders' && <OrdersPage />}
        {currentPage === 'customers' && <CustomersPage />}
        {currentPage === 'capital' && <CapitalPage />}
        {currentPage === 'salary' && <SalaryPage />}
        {currentPage === 'pocket' && <PocketPage />}
        {currentPage === 'reports' && <ReportsPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'audit' && <AuditPage />}
      </main>

      {/* Central Quick Entry Modal */}
      <QuickEntryModal
        isOpen={isQuickModalOpen}
        onClose={closeQuickModal}
        defaultTab={quickModalTab}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
