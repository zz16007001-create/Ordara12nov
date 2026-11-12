/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Icon3D, Icon3DName } from './Icon3D';

const allIcons: Icon3DName[] = [
  'salary', 'pocket', 'capital', 'charity', 'entry', 'bag', 'offices', 'orders',
  'create_order', 'sell', 'advance', 'reconcile', 'reports', 'pie', 'settings',
  'insights', 'wallet', 'dollar', 'money_in', 'money_out', 'profit', 'loss',
  'percent', 'charity_heart', 'layers', 'warning', 'danger', 'shield_alert',
  'shield_ok', 'flame', 'lightbulb', 'check', 'checkbox_on', 'checkbox_off',
  'lock', 'unlock', 'plus', 'edit', 'trash', 'save', 'download', 'upload',
  'excel', 'install', 'search', 'calendar', 'clock', 'history', 'bell', 'menu',
  'close', 'chevron_down', 'chevron_up', 'chevron_left', 'back', 'app_logo', 'verified',
];

export const IconGallery: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selectedSize, setSelectedSize] = useState<24 | 40 | 72>(40);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#231A2C] rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-right shadow-2xl border border-[#ECECF4] dark:border-[#32263F]">
        <div className="flex items-center justify-between pb-3 border-b border-[#ECECF4] dark:border-[#32263F]">
          <div>
            <h2 className="text-base font-black text-[#5F2967] dark:text-[#9B67A4]">
              معرض الأيقونات المجسمة 3D ({allIcons.length} أيقونة)
            </h2>
            <p className="text-xs text-[#9A98B0]">فحص الجودة والأبعاد بدقة (طين / بلاستيك منفوخ)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <Icon3D name="close" size={24} />
          </button>
        </div>

        {/* Size switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#9A98B0]">اختر المقاس:</span>
          {[24, 40, 72].map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSize(s as any)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                selectedSize === s
                  ? 'bg-[#5F2967] text-white shadow-xs'
                  : 'bg-[#F1F1FA] dark:bg-[#17101D] text-[#2B2340] dark:text-[#F2EEF7]'
              }`}
            >
              {s}px
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
          {allIcons.map((iconName) => (
            <div
              key={iconName}
              className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="h-20 flex items-center justify-center">
                <Icon3D name={iconName} size={selectedSize} />
              </div>
              <span className="text-[10px] font-mono text-[#9A98B0] truncate w-full block">
                {iconName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
