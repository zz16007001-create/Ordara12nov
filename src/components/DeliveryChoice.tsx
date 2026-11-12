/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DeliveryMode } from '../types';

interface DeliveryChoiceProps {
  value: DeliveryMode | '';
  onChange: (v: DeliveryMode | '') => void;
}

/**
 * اختيار التسليم للعميل: توصيل (شحن) أو استلام من البيت.
 * الخيار بيتسجل على العميل نفسه (ثابت)، ولو ماتختارش حاجة مابيتغيّرش اللي على العميل.
 * الضغط على الخيار المختار تاني بيلغي الاختيار.
 */
export const DeliveryChoice: React.FC<DeliveryChoiceProps> = ({ value, onChange }) => {
  const options: Array<{ id: DeliveryMode; label: string }> = [
    { id: 'delivery', label: 'توصيل (شحن)' },
    { id: 'pickup', label: 'استلام من البيت' },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-[#9A98B0] shrink-0">التسليم:</span>
      <div className="grid grid-cols-2 gap-1.5 flex-1">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(active ? '' : opt.id)}
              className={`py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                active
                  ? opt.id === 'delivery'
                    ? 'bg-[#E3F2EA] dark:bg-[#162E23] border-[#2F7F5F] text-[#2F7F5F] dark:text-[#4BA682]'
                    : 'bg-[#F1E8F4] dark:bg-[#2D1F35] border-[#5F2967] text-[#5F2967] dark:text-[#D8B4FE]'
                  : 'bg-white dark:bg-[#231A2C] border-[#ECECF4] dark:border-[#32263F] text-[#666079] dark:text-[#9E97B0]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
