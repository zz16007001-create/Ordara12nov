/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BagExpenseRoute, DeliveryMode, PaymentMethod, PocketCategory, TreasurySourceType } from '../types';
import { Icon3D, Icon3DName } from './icons3d/Icon3D';
import { SaleForm } from './SaleForm';
import { DeliveryChoice } from './DeliveryChoice';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'bag_balances',
}) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
    setSuccessMessage(null);
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 1200);
  };

  const tabs: Array<{ id: string; label: string; iconName: Icon3DName }> = [
    { id: 'bag_balances', label: 'رصيد الشنطة', iconName: 'wallet' },
    { id: 'bag_expense', label: 'مصروف شنطة', iconName: 'bag' },
    { id: 'salary_expense', label: 'مصروفات القبض', iconName: 'salary' },
    { id: 'office_item', label: 'تجهيز مكاتب', iconName: 'offices' },
    { id: 'create_order', label: 'إنشاء أوردر', iconName: 'create_order' },
    { id: 'sell_item', label: 'تسجيل بيع', iconName: 'sell' },
    { id: 'advances_and_settlements', label: 'سلف وتسويات', iconName: 'advance' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg card-regular rounded-[24px] shadow-2xl my-auto overflow-hidden text-right flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#D4D0E0] dark:border-[#3A3150] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Icon3D name="app_logo" size={24} />
            <h2 className="text-sm font-extrabold text-[#5F2967] dark:text-[#D8B4FE]">
              نافذة التسجيل السريع
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <Icon3D name="close" size={18} />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="px-3 py-2 border-b border-[#ECECF4] dark:border-[#32263F] overflow-x-auto shrink-0 flex items-center gap-1.5 no-scrollbar bg-white dark:bg-[#231A2C]">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSuccessMessage(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[#5F2967] text-white shadow-xs'
                    : 'text-[#2B2340] dark:text-[#F2EEF7] hover:bg-[#F1F1FA] dark:hover:bg-[#17101D]'
                }`}
              >
                <Icon3D name={tab.iconName} size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Form */}
        <div className="p-4 overflow-y-auto flex-1">
          {successMessage ? (
            <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
              <Icon3D name="check" size={48} />
              <p className="text-sm font-black text-[#2FA36B]">{successMessage}</p>
            </div>
          ) : (
            <>
              {activeTab === 'bag_balances' && <BagBalancesForm onDone={showSuccess} />}
              {activeTab === 'bag_expense' && <BagExpenseForm onDone={showSuccess} />}
              {activeTab === 'salary_expense' && <SalaryExpenseQuickForm onDone={showSuccess} />}
              {activeTab === 'office_item' && <OfficeItemForm onDone={showSuccess} />}
              {activeTab === 'create_order' && <CreateOrderForm onDone={showSuccess} />}
              {activeTab === 'sell_item' && <SellItemForm onDone={showSuccess} />}
              {activeTab === 'advances_and_settlements' && <UnifiedAdvancesForm onDone={showSuccess} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Salary Expense Quick Form
// ==========================================
const SalaryExpenseQuickForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, recordSalaryExpense } = useApp();
  const sortedBudget = React.useMemo(() => {
    const pocketItem = state.salaryBudget.find((b) => b.isPocketSupport || b.isSystem);
    const regular = state.salaryBudget.filter((b) => !b.isPocketSupport && !b.isSystem);
    const safePocket = pocketItem
      ? { ...pocketItem, name: 'دعم بوكيت', isPocketSupport: true, isSystem: true }
      : { id: 'sb_pocket_support', name: 'دعم بوكيت', budgeted: 0, spent: 0, isPocketSupport: true, isSystem: true };
    return [...regular, safePocket];
  }, [state.salaryBudget]);

  const [selectedItemId, setSelectedItemId] = useState(sortedBudget[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const selectedItem = sortedBudget.find((b) => b.id === selectedItemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!selectedItemId || !num || num <= 0) return;
    recordSalaryExpense(selectedItemId, num, false, notes.trim() || undefined);
    onDone(`تم تسجيل صرف ${num} ${state.settings.currency} على بند ${selectedItem?.name || ''}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      <div>
        <label className="block font-bold text-[#2B2340] dark:text-white mb-1">اختر بند القبض *</label>
        <select
          required
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
        >
          {sortedBudget.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} (المعيّن: {b.budgeted} | المتبقي: {b.budgeted - b.spent} {state.settings.currency})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-bold text-[#2B2340] dark:text-white mb-1">المبلغ المراد صرفه *</label>
        <input
          type="number"
          step="any"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-black text-center text-base outline-none focus:border-[#5F2967]"
        />
      </div>

      <div>
        <label className="block font-bold text-[#2B2340] dark:text-white mb-1">ملاحظة / البيان</label>
        <input
          type="text"
          placeholder="تفاصيل الصرف..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] outline-none"
        />
      </div>

      {selectedItem && (selectedItem.isPocketSupport || selectedItem.isSystem) && (
        <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 text-purple-900 dark:text-purple-200 text-[11px] leading-relaxed">
          * الصرف على بند "دعم بوكيت" يتم ترحيله فورياً كحركة دعم وإيداع في خزنة بوكيت ويزيد رصيدها تلقائياً.
        </div>
      )}

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        تسجيل مصروف القبض
      </button>
    </form>
  );
};

// ==========================================
// 1. FORM: Bag Balances (رصيد الشنطة)
// ==========================================
const BagBalancesForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, updateBagSources } = useApp();

  const initialSources = (() => {
    const existing = state.currentTrip.sources || [];
    if (existing.length === 0) {
      return [
        { id: 'src_cap', sourceName: 'رأس المال', amount: 0, treasuryType: 'capital' as TreasurySourceType },
        { id: 'src_sal', sourceName: 'القبض', amount: 0, treasuryType: 'salary' as TreasurySourceType },
      ];
    }
    return existing;
  })();

  const [sources, setSources] = useState(initialSources);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceAmount, setNewSourceAmount] = useState('');
  const [newSourceTreasury, setNewSourceTreasury] = useState<TreasurySourceType>('other');
  const [showAdd, setShowAdd] = useState(false);

  const handleAmountChange = (id: string, amount: number) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, amount } : s)));
  };

  const handleDelete = (id: string) => {
    if (sources.length <= 1) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    const newSrc = {
      id: 'src_' + Date.now(),
      sourceName: newSourceName.trim(),
      amount: parseFloat(newSourceAmount) || 0,
      treasuryType: newSourceTreasury,
    };
    setSources((prev) => [...prev, newSrc]);
    setNewSourceName('');
    setNewSourceAmount('');
    setShowAdd(false);
  };

  const handleSave = () => {
    updateBagSources(sources);
    const total = sources.reduce((s, c) => s + (c.amount || 0), 0);
    onDone(`تم حفظ رصيد الشنطة: ${total.toLocaleString('en-US')} ${state.settings.currency}`);
  };

  const total = sources.reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="font-bold text-[#2B2340] dark:text-white">نقدية الشنطة الحالية:</span>
        <span className="font-extrabold text-[#5F2967] dark:text-[#9B67A4] tabular-nums">
          الإجمالي: {total.toLocaleString('en-US')} {state.settings.currency}
        </span>
      </div>

      <div className="space-y-2">
        {sources.map((src) => (
          <div
            key={src.id}
            className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon3D
                name={
                  src.sourceName.includes('رأس المال')
                    ? 'capital'
                    : src.sourceName.includes('القبض')
                    ? 'salary'
                    : src.sourceName.includes('بوكيت')
                    ? 'pocket'
                    : 'wallet'
                }
                size={24}
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#2B2340] dark:text-white block truncate">
                  {src.sourceName}
                </span>
                <span className="text-[10px] text-[#9A98B0]">
                  {src.treasuryType === 'capital' || src.sourceName.includes('رأس المال')
                    ? 'خزينة رأس المال'
                    : src.treasuryType === 'salary' || src.sourceName.includes('القبض')
                    ? 'خزينة القبض'
                    : 'مصدر عهدة'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={src.amount === 0 ? '' : src.amount}
                onChange={(e) => handleAmountChange(src.id, parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-1.5 text-center font-black text-xs rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-[#2B2340] dark:text-white outline-none focus:border-[#5F2967]"
              />
              {sources.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleDelete(src.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                  title="حذف"
                >
                  <Icon3D name="trash" size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <form onSubmit={handleAddSource} className="p-3.5 rounded-2xl bg-white dark:bg-[#17101D] border border-[#5F2967] space-y-2.5 text-xs">
          <input
            type="text"
            required
            placeholder="اسم المصدر..."
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs bg-white dark:bg-[#231A2C]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              placeholder="المبلغ"
              value={newSourceAmount}
              onChange={(e) => setNewSourceAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs font-bold text-center bg-white dark:bg-[#231A2C]"
            />
            <select
              value={newSourceTreasury}
              onChange={(e) => setNewSourceTreasury(e.target.value as TreasurySourceType)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs bg-white dark:bg-[#231A2C]"
            >
              <option value="other">عهدة أخرى</option>
              <option value="pocket">بوكيت</option>
              <option value="capital">رأس المال</option>
              <option value="salary">القبض</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 rounded-xl bg-[#5F2967] text-white font-bold text-xs cursor-pointer">
              إضافة المصدر
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-xs cursor-pointer">
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 rounded-2xl border-2 border-dashed border-[#5F2967]/30 text-[#5F2967] dark:text-[#9B67A4] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#5F2967]/5 transition cursor-pointer"
        >
          <Icon3D name="plus" size={16} />
          <span>إضافة مصدر نقدية جديد</span>
        </button>
      )}

      <button
        type="button"
        onClick={handleSave}
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        حفظ وتحديث نقدية الشنطة
      </button>
    </div>
  );
};

// ==========================================
// 2. FORM: Bag Expense (مصروف شنطة)
// تعديل المرحلة 3: شيل التصنيف السريع، المبلغ والبيان في صف واحد، مسمى "قبض"
// ==========================================
const BagExpenseForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, addBagExpense } = useApp();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [route, setRoute] = useState<BagExpenseRoute>('unclassified');
  const [targetId, setTargetId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0 || !description.trim()) return;

    let targetName: string | undefined = undefined;
    if (route === 'order') {
      const order = state.orders.find((o) => o.id === targetId);
      targetName = order ? order.code : undefined;
    } else if (route === 'salary') {
      const bItem = state.salaryBudget.find((b) => b.id === targetId);
      targetName = bItem ? bItem.name : undefined;
    }

    addBagExpense({
      amount: num,
      description: description.trim(),
      categoryTag: 'مصروف ميداني',
      route,
      targetId: targetId || undefined,
      targetName,
    });
    onDone('تم تسجيل مصروف الشنطة بنجاح');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      {/* صف واحد: المبلغ وجنبه التفاصيل والبيان */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">المبلغ *</label>
          <input
            type="number"
            step="any"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-black text-center outline-none focus:border-[#5F2967]"
          />
        </div>
        <div className="col-span-3">
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">التفاصيل والبيان *</label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="شحن، كارتة، غداء..."
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] outline-none focus:border-[#5F2967]"
          />
        </div>
      </div>

      {/* توجيه المصروف مع مسمى "قبض" بدل "بند ميزانية" */}
      <div className="p-3.5 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] space-y-2.5">
        <label className="block font-extrabold text-[#2B2340] dark:text-white">توجيه التكلفة:</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'unclassified', label: 'غير مصنف' },
            { id: 'order', label: 'أوردر' },
            { id: 'salary', label: 'قبض' }, // مسمى "قبض"
            { id: 'pocket_advance', label: 'سلفة بوكيت' },
            { id: 'capital_advance', label: 'سلفة رأس مال' },
            { id: 'capital_settlement', label: 'تسوية رأس مال' },
          ].map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => {
                setRoute(r.id as BagExpenseRoute);
                setTargetId('');
              }}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold text-center border transition cursor-pointer ${
                route === r.id
                  ? 'bg-[#5F2967] text-white border-[#5F2967] shadow-xs'
                  : 'bg-white dark:bg-[#231A2C] text-[#2B2340] dark:text-[#F2EEF7] border-[#ECECF4] dark:border-[#32263F]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {route === 'order' && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs bg-white dark:bg-[#231A2C]"
          >
            <option value="">-- اختر الأوردر المرتبط --</option>
            {state.orders.map((o) => (
              <option key={o.id} value={o.id}>{o.code}</option>
            ))}
          </select>
        )}

        {route === 'salary' && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs bg-white dark:bg-[#231A2C]"
          >
            <option value="">-- اختر بند القبض --</option>
            {state.salaryBudget.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (المتبقي: {b.budgeted - b.spent})
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        تسجيل المصروف
      </button>
    </form>
  );
};

// ==========================================
// 3. FORM: Office Item (تجهيز مكاتب)
// تعديل المرحلة 3: شيل إجمالي الفاتورة، إضافة لينك الماسنجر
// ==========================================
const OfficeItemForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, addOfficeItem } = useApp();
  const registeredOffices = state.settings.registeredOffices && state.settings.registeredOffices.length > 0
    ? state.settings.registeredOffices
    : ['مكتب النزهة', 'مكتب وسط البلد', 'مكتب العتبة'];

  const [officeName, setOfficeName] = useState(registeredOffices[0] || '');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [costPrice, setCostPrice] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerSize, setCustomerSize] = useState('');
  const [messengerLink, setMessengerLink] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | ''>('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName || !itemName.trim() || !costPrice) return;

    addOfficeItem({
      officeName,
      itemName: itemName.trim(),
      quantity: parseInt(quantity) || 1,
      costPrice: parseFloat(costPrice) || 0,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerSize: customerSize.trim() || undefined,
      messengerLink: messengerLink.trim() || undefined,
      contactUrl: messengerLink.trim() || undefined,
      deliveryMode: deliveryMode || undefined,
      notes: notes.trim() || undefined,
    });
    onDone('تم تسجيل صنف المكتب بنجاح');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">اسم المورد / المكتب *</label>
          <select
            required
            value={officeName}
            onChange={(e) => setOfficeName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
          >
            {registeredOffices.map((off) => (
              <option key={off} value={off}>{off}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">اسم الصنف *</label>
          <input
            type="text"
            required
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="اسم الموديل أو الصنف..."
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">الكمية *</label>
          <input
            type="number"
            min="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-2 py-2 text-center rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold"
          />
        </div>
        <div>
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">سعر التكلفة للقطعة *</label>
          <input
            type="number"
            step="any"
            required
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="0.00"
            className="w-full px-2 py-2 text-center rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold"
          />
        </div>
      </div>

      {/* Customer Info + Messenger Link */}
      <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] space-y-2">
        <span className="font-bold text-[#2B2340] dark:text-white block text-[11px]">
          بيانات العميل (اختيارية):
        </span>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="اسم العميل"
            className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="رقم الهاتف"
            className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            placeholder="العنوان"
            className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
          />
          <input
            type="text"
            value={customerSize}
            onChange={(e) => setCustomerSize(e.target.value)}
            placeholder="المقاس"
            className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
          />
        </div>
        <input
          type="text"
          value={messengerLink}
          onChange={(e) => setMessengerLink(e.target.value)}
          placeholder="لينك الماسنجر (رابط العميل)"
          className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
        />
        <DeliveryChoice value={deliveryMode} onChange={setDeliveryMode} />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات أخرى..."
          className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        إضافة الصنف للمكتب
      </button>
    </form>
  );
};

// ==========================================
// 4. FORM: Create Order (إنشاء أوردر)
// تعديل المرحلة 3: شيل حقل "المكتب"
// ==========================================
const CreateOrderForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, createNewOrder } = useApp();
  const [code, setCode] = useState(`أوردر #${state.orders.length + 1}`);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ name: string; quantity: number; costPrice: number }>>([
    { name: '', quantity: 1, costPrice: 0 },
  ]);

  const addItemRow = () => {
    setItems([...items, { name: '', quantity: 1, costPrice: 0 }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalCost = items.reduce((s, it) => s + (it.costPrice || 0) * (it.quantity || 1), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.name.trim() !== '' && it.costPrice > 0);
    if (validItems.length === 0) return;
    createNewOrder(code, validItems, notes);
    onDone(`تم إنشاء ${code} بتكلفة ${totalCost} ${state.settings.currency}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">كود / اسم الأوردر *</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
          />
        </div>
        <div className="text-left shrink-0">
          <span className="text-[10px] text-[#9A98B0] block">إجمالي التكلفة:</span>
          <strong className="text-sm font-black text-[#5F2967] dark:text-[#9B67A4] tabular-nums">
            {totalCost} {state.settings.currency}
          </strong>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-extrabold text-[#2B2340] dark:text-white">أصناف الأوردر:</label>
          <button
            type="button"
            onClick={addItemRow}
            className="text-xs text-[#5F2967] dark:text-[#9B67A4] font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <Icon3D name="plus" size={14} />
            <span>إضافة صنف</span>
          </button>
        </div>

        {items.map((it, idx) => (
          <div key={idx} className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="اسم الصنف / الموديل..."
                value={it.name}
                onChange={(e) => {
                  const arr = [...items];
                  arr[idx].name = e.target.value;
                  setItems(arr);
                }}
                className="flex-1 px-3 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs font-bold"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItemRow(idx)}
                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <Icon3D name="trash" size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-[#9A98B0] block">العدد</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={it.quantity}
                  onChange={(e) => {
                    const arr = [...items];
                    arr[idx].quantity = parseInt(e.target.value) || 1;
                    setItems(arr);
                  }}
                  className="w-full px-2 py-1 text-center rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[9px] text-[#9A98B0] block">سعر التكلفة للقطعة</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={it.costPrice === 0 ? '' : it.costPrice}
                  onChange={(e) => {
                    const arr = [...items];
                    arr[idx].costPrice = parseFloat(e.target.value) || 0;
                    setItems(arr);
                  }}
                  className="w-full px-2 py-1 text-center rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs font-bold"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        حفظ وإنشاء الأوردر
      </button>
    </form>
  );
};

// ==========================================
// 5. FORM: Sell Item (تسجيل بيع)
// ==========================================
const SellItemForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state } = useApp();
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');

  const currentOrder = state.orders.find((o) => o.id === selectedOrderId);
  const unsoldItems = currentOrder?.items.filter((it) => !it.isSold && it.name.trim() !== 'مصاريف') || [];
  const selectedItem = currentOrder?.items.find((it) => it.id === selectedItemId);

  return (
    <div className="space-y-3.5 text-xs">
      <div>
        <label className="block font-bold text-[#2B2340] dark:text-white mb-1">اختر الأوردر *</label>
        <select
          value={selectedOrderId}
          onChange={(e) => {
            setSelectedOrderId(e.target.value);
            setSelectedItemId('');
          }}
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
        >
          <option value="">-- اختر الأوردر --</option>
          {state.orders.map((o) => {
            const unsold = o.items.filter((i) => !i.isSold && i.name.trim() !== 'مصاريف').length;
            return (
              <option key={o.id} value={o.id}>
                {o.code} ({unsold} قطع متبقية)
              </option>
            );
          })}
        </select>
      </div>

      {selectedOrderId && (
        <div>
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">اختر الصنف المراد بيعه *</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
          >
            <option value="">-- اختر الصنف --</option>
            {unsoldItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}{it.size ? ` - مقاس ${it.size}` : ''} (التكلفة: {it.costPrice} - العدد: {it.quantity})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* نفس نموذج البيع بتاع زرار "تسجيل بيع" في الأوردرات */}
      {selectedItem && (
        <SaleForm key={selectedItem.id} orderId={selectedOrderId} item={selectedItem} onDone={onDone} />
      )}
    </div>
  );
};

// ==========================================
// 6. FORM: Unified Advances & Settlements (السلف والتسويات)
// تعديل المرحلة 3: شيل شبكة الكروت، زرين كبار "سلفة" | "سداد"
// ==========================================
const UnifiedAdvancesForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const {
    state,
    addCapitalAdvance,
    addCapitalSettlement,
    addCapitalRepayment,
    addPocketWithdrawal,
    addPocketRepayment,
    quickModalPreset,
  } = useApp();

  // Top toggle: سلفة vs سداد (لو اتفتحت من زرار «سداد» جوه كارت سلفة بتبدأ على السداد مباشرة)
  const [mainMode, setMainMode] = useState<'advance' | 'repay'>(quickModalPreset?.mode ?? 'advance');

  // Sub operations
  const [advanceSubOp, setAdvanceSubOp] = useState<'pocket_withdrawal' | 'capital_advance' | 'capital_settlement'>('pocket_withdrawal');
  const [repaySubOp, setRepaySubOp] = useState<'pocket_repay' | 'capital_repay'>('pocket_repay');

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [pocketCategory, setPocketCategory] = useState<PocketCategory>('ترفيه/أخرى');
  const [isForPocketCompensation, setIsForPocketCompensation] = useState(false);
  const [pocketTxId, setPocketTxId] = useState(quickModalPreset?.pocketTxId ?? '');
  const [repaySource, setRepaySource] = useState<'salary' | 'cash' | 'other'>('salary');
  const [salaryBudgetItemId, setSalaryBudgetItemId] = useState('');

  const openPocketWithdrawals = state.pocketTransactions.filter(
    (p) => p.type === 'withdrawal' && p.status !== 'مسدد بالكامل'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    if (mainMode === 'advance') {
      if (advanceSubOp === 'pocket_withdrawal') {
        addPocketWithdrawal(amt, pocketCategory, description || 'سحب من بوكيت');
        onDone(`تم سحب ${amt} ${state.settings.currency} من بوكيت`);
      } else if (advanceSubOp === 'capital_advance') {
        addCapitalAdvance(amt, description || 'سلفة رأس مال', isForPocketCompensation);
        onDone(`تم تسجيل سلفة رأس مال بمبلغ ${amt} ${state.settings.currency}`);
      } else if (advanceSubOp === 'capital_settlement') {
        addCapitalSettlement(amt, description || 'تسوية رأس مال');
        onDone(`تم تسجيل تسوية رأس مال بمبلغ ${amt} ${state.settings.currency}`);
      }
    } else {
      if (repaySubOp === 'pocket_repay') {
        if (!pocketTxId) return;
        addPocketRepayment(
          pocketTxId,
          amt,
          description,
          repaySource === 'salary' ? 'من القبض' : 'نقدية',
          repaySource,
          repaySource === 'salary' ? salaryBudgetItemId : undefined
        );
        onDone(`تم تسجيل سداد سلفة بوكيت بمبلغ ${amt} ${state.settings.currency}`);
      } else if (repaySubOp === 'capital_repay') {
        addCapitalRepayment(amt, description || 'سداد سلفة رأس مال');
        onDone(`تم سداد سلفة رأس مال بمبلغ ${amt} ${state.settings.currency}`);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      {/* 1. الزران الكبيران: سلفة | سداد */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
        <button
          type="button"
          onClick={() => {
            setMainMode('advance');
            setAmount('');
          }}
          className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            mainMode === 'advance'
              ? 'bg-[#5F2967] text-white shadow-sm'
              : 'text-[#2B2340] dark:text-[#F2EEF7] hover:bg-white/50'
          }`}
        >
          سلفة
        </button>
        <button
          type="button"
          onClick={() => {
            setMainMode('repay');
            setAmount('');
          }}
          className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            mainMode === 'repay'
              ? 'bg-[#5F2967] text-white shadow-sm'
              : 'text-[#2B2340] dark:text-[#F2EEF7] hover:bg-white/50'
          }`}
        >
          سداد
        </button>
      </div>

      {/* 2. الخيارات المتاحة حسب الوضع */}
      {mainMode === 'advance' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'pocket_withdrawal', label: 'سلفة بوكيت' },
            { id: 'capital_advance', label: 'سلفة رأس مال' },
            { id: 'capital_settlement', label: 'تسوية رأس مال' },
          ].map((op) => (
            <button
              type="button"
              key={op.id}
              onClick={() => setAdvanceSubOp(op.id as any)}
              className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition cursor-pointer ${
                advanceSubOp === op.id
                  ? 'bg-purple-100 text-[#5F2967] dark:bg-purple-950 dark:text-purple-300 border-[#5F2967] font-black'
                  : 'bg-white dark:bg-[#231A2C] text-[#2B2340] dark:text-[#F2EEF7] border-[#ECECF4] dark:border-[#32263F]'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'pocket_repay', label: 'سداد سلفة بوكيت' },
            { id: 'capital_repay', label: 'سداد سلفة رأس مال' },
          ].map((op) => (
            <button
              type="button"
              key={op.id}
              onClick={() => setRepaySubOp(op.id as any)}
              className={`py-2 px-2 rounded-xl text-xs font-bold text-center border transition cursor-pointer ${
                repaySubOp === op.id
                  ? 'bg-purple-100 text-[#5F2967] dark:bg-purple-950 dark:text-purple-300 border-[#5F2967] font-black'
                  : 'bg-white dark:bg-[#231A2C] text-[#2B2340] dark:text-[#F2EEF7] border-[#ECECF4] dark:border-[#32263F]'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. حقول الإدخال */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block font-bold text-[#2B2340] dark:text-white mb-1">المبلغ *</label>
          <input
            type="number"
            step="any"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-black text-center outline-none focus:border-[#5F2967]"
          />
        </div>
        {mainMode === 'advance' && advanceSubOp === 'pocket_withdrawal' && (
          <div>
            <label className="block font-bold text-[#2B2340] dark:text-white mb-1">التصنيف</label>
            <select
              value={pocketCategory}
              onChange={(e) => setPocketCategory(e.target.value as PocketCategory)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] outline-none"
            >
              <option value="التزامات قبض">التزامات قبض</option>
              <option value="موسمي">موسمي</option>
              <option value="جديد/غير دائم">جديد/غير دائم</option>
              <option value="ترفيه/أخرى">ترفيه/أخرى</option>
            </select>
          </div>
        )}
      </div>

      {mainMode === 'repay' && repaySubOp === 'pocket_repay' && (
        <div className="p-3.5 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] space-y-2.5">
          <div>
            <label className="block font-bold text-[#2B2340] dark:text-white mb-1">اختر السلفة المراد سدادها *</label>
            <select
              required
              value={pocketTxId}
              onChange={(e) => setPocketTxId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs bg-white dark:bg-[#231A2C]"
            >
              <option value="">-- اختر السلفة --</option>
              {openPocketWithdrawals.map((w) => {
                const rem = w.amount - (w.repaidAmount || 0);
                return (
                  <option key={w.id} value={w.id}>
                    {w.description} (المتبقي: {rem} {state.settings.currency})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">مصدر السداد</label>
              <select
                value={repaySource}
                onChange={(e) => setRepaySource(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs bg-white dark:bg-[#231A2C]"
              >
                <option value="salary">من القبض</option>
                <option value="cash">نقدية كاش</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            {repaySource === 'salary' && (
              <div>
                <label className="block font-bold text-[#2B2340] dark:text-white mb-1">بند القبض *</label>
                <select
                  required
                  value={salaryBudgetItemId}
                  onChange={(e) => setSalaryBudgetItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] text-xs bg-white dark:bg-[#231A2C]"
                >
                  <option value="">-- اختر البند --</option>
                  {state.salaryBudget.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (المتبقي: {b.budgeted - b.spent})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {mainMode === 'advance' && advanceSubOp === 'capital_advance' && (
        <label className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-900 dark:text-amber-200 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={isForPocketCompensation}
            onChange={(e) => setIsForPocketCompensation(e.target.checked)}
            className="w-4 h-4 rounded text-amber-600"
          />
          <span>سلفة لتعويض عجز بوكيت</span>
        </label>
      )}

      <div>
        <label className="block font-bold text-[#2B2340] dark:text-white mb-1">البيان والتفاصيل</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="تفاصيل الحركة..."
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        حفظ العملية
      </button>
    </form>
  );
};
