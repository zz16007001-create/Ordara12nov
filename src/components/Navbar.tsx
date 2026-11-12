/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageId } from '../types';
import { Icon3D, Icon3DName } from './icons3d/Icon3D';

interface NavItem {
  id: PageId;
  label: string;
  iconName: Icon3DName;
  badge?: number | string;
  badgeColor?: string;
}

export const Navbar: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    state,
    pocketWarningActive,
  } = useApp();

  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  // Active office items count (excluding transferred ones)
  const officeCount = state.officeItems.filter((i) => !i.isTransferredToOrder).length;

  // Navigation pages in requested order
  const navItems: NavItem[] = [
    { id: 'entry', label: 'الرئيسية', iconName: 'entry' },
    { id: 'capital', label: 'رأس المال', iconName: 'capital' },
    {
      id: 'offices',
      label: 'المكاتب',
      iconName: 'offices',
      badge: officeCount > 0 ? officeCount : undefined,
      badgeColor: 'bg-[#B7791F]',
    },
    { id: 'bag', label: 'الشنطة', iconName: 'bag' },
    { id: 'salary', label: 'القبض', iconName: 'salary' },
    {
      id: 'pocket',
      label: 'بوكيت',
      iconName: 'pocket',
      badge: pocketWarningActive ? '!' : undefined,
      badgeColor: 'bg-[#A23B5A]',
    },
    { id: 'orders', label: 'الأوردرات', iconName: 'orders' },
    { id: 'audit', label: 'سجل المراجعة', iconName: 'verified' },
    { id: 'customers', label: 'العملاء والديون', iconName: 'customers' },
    { id: 'reports', label: 'التقارير', iconName: 'reports' },
    { id: 'settings', label: 'الإعدادات', iconName: 'settings' },
  ];

  const handleSelectPage = (page: PageId) => {
    setCurrentPage(page);
    setBottomSheetOpen(false);
  };

  const hasAnyBadge = officeCount > 0 || pocketWarningActive;

  return (
    <>
      {/* 1. Header in all pages: "العمار ستور" only */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#211A2D]/95 backdrop-blur-md border-b-[1.5px] border-[#D4D0E0] dark:border-[#3A3150] shadow-xs">
        <div className="max-w-xl mx-auto px-4 h-13 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[12px] bg-[#5F2967] flex items-center justify-center text-white shadow-xs">
              <Icon3D name="app_logo" size={24} />
            </div>
            <h1 className="text-base font-extrabold text-[#5F2967] dark:text-[#D8B4FE] tracking-tight">
              العمار ستور
            </h1>
          </div>

          {/* Quick status/info if needed */}
          <div className="flex items-center gap-2">
            {pocketWarningActive && (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#F8E6EC] dark:bg-[#381B26] text-[#A23B5A] dark:text-[#FB7185] font-bold border border-[#A23B5A]/30">
                تحذير بوكيت
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 2. Floating Circular Navigation Button */}
      <aside aria-label="شريط التنقل السريع" className="fixed bottom-5 left-5 z-40">
        <button
          onClick={() => setBottomSheetOpen(true)}
          className="relative w-13 h-13 rounded-full bg-[#5F2967] hover:bg-[#4A1E52] text-white shadow-[0_8px_24px_rgba(95,41,103,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer border-2 border-white dark:border-[#3A3150]"
          aria-label="قائمة الصفحات"
          title="قائمة الصفحات والتنقل"
        >
          <Icon3D name="grid" size={24} />
          {hasAnyBadge && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#A23B5A] border-2 border-white dark:border-[#211A2D] flex items-center justify-center text-[9px] font-black text-white animate-pulse">
              !
            </span>
          )}
        </button>
      </aside>

      {/* 3. Elegant Bottom Sheet Modal */}
      {bottomSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="قائمة الصفحات والتنقل السريع"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setBottomSheetOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#211A2D] rounded-t-[24px] sm:rounded-[24px] p-5 shadow-2xl border-t sm:border-[1.5px] border-[#D4D0E0] dark:border-[#3A3150] text-right max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-[#D4D0E0] dark:bg-[#3A3150] mx-auto mb-3.5 sm:hidden" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b-[1.5px] border-[#D4D0E0] dark:border-[#3A3150]">
              <div className="flex items-center gap-2">
                <Icon3D name="app_logo" size={24} />
                <h3 className="font-extrabold text-sm text-[#5F2967] dark:text-[#D8B4FE]">
                  صفحات العمار ستور
                </h3>
              </div>
              <button
                onClick={() => setBottomSheetOpen(false)}
                className="p-1 rounded-[10px] text-[#666079] hover:text-[#1F1A2E] dark:hover:text-[#F4F0FA] cursor-pointer"
              >
                <Icon3D name="close" size={18} />
              </button>
            </div>

            {/* Grid of Pages */}
            <div className="grid grid-cols-3 gap-2.5 pt-3.5">
              {navItems.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectPage(item.id)}
                    className={`relative p-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] border-[1.5px] border-[#5F2967] font-bold shadow-xs'
                        : 'bg-white dark:bg-[#211A2D] text-[#1F1A2E] dark:text-[#F4F0FA] hover:bg-[#F1E8F4]/50 dark:hover:bg-[#2D1F35]/50 border-[1.5px] border-[#D4D0E0] dark:border-[#3A3150]'
                    }`}
                  >
                    <Icon3D name={item.iconName} size={30} />
                    <span className="text-xs font-bold truncate w-full text-center">
                      {item.label}
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.2 rounded-full font-black text-white shadow-xs ${
                          item.badgeColor || 'bg-[#B7791F]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
