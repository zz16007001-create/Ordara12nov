/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SalaryBudgetItem, SalaryExpenseRecord } from '../types';
import { Icon3D } from '../components/icons3d/Icon3D';
import { SwipeRow } from '../components/SwipeRow';

// Fixed palette for item dots
const DEFAULT_COLORS = [
  '#3D6A8F', // أزرق
  '#E67E22', // برتقالي
  '#6B2D7A', // نيلي / بنفسجي
  '#2F7F5F', // أخضر
  '#2DB5A8', // تيل
  '#A23B5A', // عنابي / أحمر
  '#D97706', // ذهبي
  '#8B5CF6', // بنفسجي فاتح
];

export const SalaryPage: React.FC = () => {
  const {
    state,
    salaryTotalBudgeted,
    salaryTotalSpent,
    salaryTotalRemaining,
    updateSalaryBudgetItems,
    addSalaryBudgetItem,
    deleteSalaryBudgetItem,
    recordSalaryExpense,
    updateSalaryExpense,
    deleteSalaryExpense,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemBudget, setNewItemBudget] = useState('');

  // Top Global "تسجيل منصرف" Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Edit item budget modal
  const [editingItem, setEditingItem] = useState<SalaryBudgetItem | null>(null);

  // Edit individual expense record modal
  const [editingExpense, setEditingExpense] = useState<SalaryExpenseRecord | null>(null);
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseNotes, setEditExpenseNotes] = useState('');

  // Expanded item to view expense history
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);

  // Sorting: Regular items first, "دعم بوكيت" (isSystem / isPocketSupport) strictly LAST
  const sortedBudget = useMemo(() => {
    const pocketItem = state.salaryBudget.find((b) => b.isPocketSupport || b.isSystem);
    const regular = state.salaryBudget.filter((b) => !b.isPocketSupport && !b.isSystem);
    const safePocket = pocketItem
      ? { ...pocketItem, name: 'دعم بوكيت', isPocketSupport: true, isSystem: true }
      : { id: 'sb_pocket_support', name: 'دعم بوكيت', budgeted: 0, spent: 0, isPocketSupport: true, isSystem: true };

    return [...regular, safePocket];
  }, [state.salaryBudget]);

  // Filtered by search query
  const filteredBudget = useMemo(() => {
    if (!searchQuery.trim()) return sortedBudget;
    const q = searchQuery.trim().toLowerCase();
    return sortedBudget.filter((item) => item.name.toLowerCase().includes(q));
  }, [sortedBudget, searchQuery]);

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    addSalaryBudgetItem(newItemName.trim(), parseFloat(newItemBudget) || 0, false);
    setNewItemName('');
    setNewItemBudget('');
    setShowAddModal(false);
  };

  const handleRecordExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(expenseAmount);
    if (!selectedItemId || !num || num <= 0) return;

    recordSalaryExpense(selectedItemId, num, false, expenseNotes.trim() || undefined);

    setExpenseAmount('');
    setExpenseNotes('');
    setShowExpenseModal(false);
  };

  const handleSaveEditBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const updated = state.salaryBudget.map((b) => {
      if (b.id === editingItem.id) {
        return {
          ...b,
          name: editingItem.name,
          budgeted: Math.max(0, editingItem.budgeted),
        };
      }
      return b;
    });

    updateSalaryBudgetItems(updated);
    setEditingItem(null);
  };

  const handleSaveEditExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const num = parseFloat(editExpenseAmount);
    if (isNaN(num) || num <= 0) return;

    updateSalaryExpense(editingExpense.id, num, editExpenseNotes.trim() || undefined);
    setEditingExpense(null);
  };

  // Percentages for progress bars
  const percentSpent =
    salaryTotalBudgeted > 0
      ? Math.min(100, Math.round((salaryTotalSpent / salaryTotalBudgeted) * 100))
      : 0;

  const percentRemaining =
    salaryTotalBudgeted > 0
      ? Math.max(0, Math.min(100, Math.round((salaryTotalRemaining / salaryTotalBudgeted) * 100)))
      : 0;

  return (
    <div className="w-full space-y-[13px] text-[#1F1A2E] dark:text-[#F4F0FA]">
      {/* 1) كارت اسم الصفحة البنفسجي: ارتفاع 52px، العنوان 18px في سطر واحد بدون أيقونة أو أزرار */}
      <div className="card-header-purple flex items-center justify-center">
        <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
          إدارة الميزانية والمصروفات
        </span>
      </div>

      {/* 2) كارت «إجمالي القبض»: أخضر تيل، ارتفاع 92px، الرقم 30px، التسمية 11px وأيقونة المحفظة */}
      <div className="w-full h-[92px] card-hero-teal relative px-[15px] flex items-center justify-between">
        <div>
          <div className="text-[11px] text-white/85 font-[600] leading-none mb-[6px]">
            إجمالي القبض
          </div>
          <div className="flex items-baseline gap-[8px]">
            <span className="text-[30px] font-[900] leading-none text-white tabular-nums">
              {salaryTotalBudgeted.toLocaleString('en-US')}
            </span>
            <span className="text-[13px] text-white/85 font-[700] leading-none">
              ج.م
            </span>
          </div>
        </div>

        <div className="w-[32px] h-[32px] rounded-full bg-[rgba(255,255,255,0.2)] flex items-center justify-center text-white shrink-0">
          <Icon3D name="wallet" size={16} />
        </div>
      </div>

      {/* 3) كارتين «المنصرف» و«الرصيد المتبقي»: كارت إحصائية صغير (حشو 13px، الرقم 20px، التسمية 11px، أيقونة 28px، شريط 4px) */}
      <div className="grid grid-cols-2 gap-[13px] items-start">
        {/* المنصرف */}
        <div className="card-main p-[13px]">
          <div className="flex items-center gap-[7px]">
            <div className="w-[28px] h-[28px] rounded-full bg-[#F8E6EC] dark:bg-[#381B26] text-[#A23B5A] dark:text-[#FB7185] flex items-center justify-center shrink-0">
              <Icon3D name="money_out" size={15} />
            </div>
            <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-none">
              المنصرف
            </span>
          </div>

          <div className="flex items-baseline gap-[4px] mt-[6px]">
            <span className="text-[20px] font-[900] text-[#A23B5A] dark:text-[#FB7185] tabular-nums leading-tight">
              {salaryTotalSpent.toLocaleString('en-US')}
            </span>
            <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] font-normal">
              ج.م
            </span>
          </div>

          <div className="w-full h-[4px] rounded-full bg-[#E4E1EC] dark:bg-[#3A3150] mt-[8px] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#A23B5A]"
              style={{ width: `${percentSpent}%` }}
            />
          </div>
        </div>

        {/* الرصيد المتبقي */}
        <div className="card-main p-[13px]">
          <div className="flex items-center gap-[7px]">
            <div className="w-[28px] h-[28px] rounded-full bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682] flex items-center justify-center shrink-0">
              <Icon3D name="shield_ok" size={15} />
            </div>
            <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-none">
              الرصيد المتبقي
            </span>
          </div>

          <div className="flex items-baseline gap-[4px] mt-[6px]">
            <span className="text-[20px] font-[900] text-[#2F7F5F] dark:text-[#4BA682] tabular-nums leading-tight">
              {salaryTotalRemaining.toLocaleString('en-US')}
            </span>
            <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] font-normal">
              ج.م
            </span>
          </div>

          <div className="w-full h-[4px] rounded-full bg-[#E4E1EC] dark:bg-[#3A3150] mt-[8px] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2F7F5F]"
              style={{ width: `${percentRemaining}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4) صف زري «تسجيل منصرف» و«＋ بند جديد»: عمودين متساويين gap 13px */}
      <div className="grid grid-cols-2 gap-[13px]">
        <button
          onClick={() => {
            if (!selectedItemId && sortedBudget.length > 0) {
              setSelectedItemId(sortedBudget[0].id);
            }
            setShowExpenseModal(true);
          }}
          className="h-[30px] rounded-full bg-[#A23B5A] hover:bg-[#8F2E49] text-white text-[12px] font-[700] flex items-center justify-center border-0 cursor-pointer active:scale-95 shadow-xs"
        >
          تسجيل منصرف
        </button>

        <button
          onClick={() => setShowAddModal(true)}
          className="h-[30px] rounded-full border-[1.5px] border-[#5F2967] dark:border-[#D8B4FE] text-[#5F2967] dark:text-[#D8B4FE] bg-transparent text-[12px] font-[700] flex items-center justify-center cursor-pointer active:scale-95"
        >
          ＋ بند جديد
        </button>
      </div>

      {/* 6) قائمة بنود الميزانية */}
      <div className="space-y-[8px]">
        {/* كارت العنوان الأخضر */}
        <div
          className="sticky top-[54px] z-20 w-full h-[30px] rounded-[11px] grid grid-cols-[20px_minmax(0,1fr)_58px_58px_58px_12px] gap-x-[5px] items-center px-[10px] select-none text-white text-[10px] font-[700] border border-transparent shadow-[0_4px_10px_rgba(46,138,130,0.25)]"
          style={{ background: 'linear-gradient(to left, #2DB5A8, #2E8A82)' }}
        >
          <div className="col-span-2 text-center truncate">البيان</div>
          <div className="h-[14px] flex items-center justify-center border-s border-white/45">
            <span>المقرر</span>
          </div>
          <div className="h-[14px] flex items-center justify-center border-s border-white/45">
            <span>المنصرف</span>
          </div>
          <div className="h-[14px] flex items-center justify-center border-s border-white/45">
            <span>المتبقي</span>
          </div>
          <div />
        </div>

        {/* كروت بنود الميزانية */}
        {filteredBudget.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-[#666079] dark:text-[#9E97B0] rounded-[11px] border border-[#EBE6ED] bg-white">
            لا توجد بنود ميزانية مطابقة
          </div>
        ) : (
          filteredBudget.map((item, index) => {
            const remaining = item.budgeted - item.spent;
            const isPocketSupportCard = item.isPocketSupport || item.isSystem;
            const dotColor =
              item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            const isExpanded = expandedItemId === item.id;
            const itemExpenses = state.salaryExpenses.filter((e) => e.itemId === item.id);

            return (
              <div
                key={item.id}
                className="rounded-[11px] overflow-hidden border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
              >
                <SwipeRow
                  rowKey={`budget_${item.id}`}
                  swipeOpenKey={swipeOpenKey}
                  onOpenChange={setSwipeOpenKey}
                  onEdit={() => setEditingItem(item)}
                  onDelete={
                    isPocketSupportCard
                      ? undefined
                      : () => {
                          setSwipeOpenKey(null);
                          deleteSalaryBudgetItem(item.id);
                        }
                  }
                  className="bg-white"
                >
                  <div
                    className="grid grid-cols-[20px_minmax(0,1fr)_58px_58px_58px_12px] gap-x-[5px] items-center p-[6px_10px] select-none bg-white"
                  >
                    {/* 1. المربع اللوني */}
                    <div
                      style={{ backgroundColor: dotColor }}
                      className="w-[16px] h-[26px] rounded-[5px] shrink-0"
                    />

                    {/* 2. اسم البند */}
                    <div className="min-w-0 flex items-center gap-1 pr-0.5">
                      <span className="font-[800] text-[11px] text-[#211B24] truncate leading-tight">
                        {item.name}
                      </span>
                      {isPocketSupportCard && (
                        <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-purple-100 text-[#5F2967] dark:bg-purple-950 dark:text-[#D8B4FE] shrink-0 leading-none">
                          ثابت
                        </span>
                      )}
                    </div>

                    {/* 3. المقرر */}
                    <div className="border-s border-[#E4E1EC] h-[22px] flex items-center justify-center overflow-hidden">
                      <span className="text-[11px] font-[800] text-[#1F1A2E] tabular-nums whitespace-nowrap leading-none">
                        {item.budgeted.toLocaleString('en-US')}
                      </span>
                    </div>

                    {/* 4. المنصرف */}
                    <div className="border-s border-[#E4E1EC] h-[22px] flex items-center justify-center overflow-hidden">
                      <span className="text-[11px] font-[800] text-[#A23B5A] tabular-nums whitespace-nowrap leading-none">
                        {item.spent.toLocaleString('en-US')}
                      </span>
                    </div>

                    {/* 5. المتبقي */}
                    <div className="border-s border-[#E4E1EC] h-[22px] flex items-center justify-center overflow-hidden">
                      <span
                        className={`text-[11px] font-[800] tabular-nums whitespace-nowrap leading-none ${
                          remaining >= 0 ? 'text-[#2F7F5F]' : 'text-[#A23B5A]'
                        }`}
                      >
                        {remaining.toLocaleString('en-US')}
                      </span>
                    </div>

                    {/* 6. عمود فارغ للمحاذاة */}
                    <div />
                  </div>
                </SwipeRow>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: تسجيل منصرف */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-xs bg-white dark:bg-[#211A2D] rounded-[20px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC] dark:border-[#3A3150]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#F8E6EC] dark:bg-[#381B26] text-[#A23B5A] flex items-center justify-center">
                  <Icon3D name="money_out" size={14} />
                </div>
                <h3 className="font-extrabold text-sm text-[#A23B5A] dark:text-[#FB7185]">
                  تسجيل منصرف على بند
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-white p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordExpenseSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  البند المراد الصرف منه *
                </label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="input-field w-full px-3 py-2 text-xs font-bold"
                >
                  <option value="">-- اختر البند --</option>
                  {sortedBudget.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (المتبقي: {(b.budgeted - b.spent).toLocaleString('en-US')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  مبلغ المنصرف ({state.settings.currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  ملاحظات أو بيان المصروف
                </label>
                <input
                  type="text"
                  placeholder="مثال: فاتورة شهر 10..."
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="input-field w-full px-3 py-2 text-xs"
                />
              </div>

              {selectedItemId && sortedBudget.find((b) => b.id === selectedItemId)?.isPocketSupport && (
                <div className="p-2.5 rounded-[12px] bg-[#F1E8F4] dark:bg-[#2D1F35] border border-[#5F2967]/30 text-[10px] text-[#5F2967] dark:text-[#D8B4FE] font-bold">
                  * تسجيل الصرف على "دعم بوكيت" يودع المبلغ لحظياً في خزنة بوكيت ويزيد رصيدها فوراً.
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2.5 text-xs shadow-sm"
                >
                  تأكيد تسجيل المنصرف
                </button>
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn-secondary px-4 py-2.5 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: إضافة بند ميزانية جديد */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <form
            onSubmit={handleAddItemSubmit}
            className="w-full max-w-xs bg-white dark:bg-[#211A2D] rounded-[20px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC] dark:border-[#3A3150]">
              <h3 className="font-extrabold text-sm text-[#5F2967] dark:text-[#D8B4FE]">
                إضافة بند ميزانية جديد
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-white p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                اسم البند *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: مصاريف منزلية..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                المقرر ({state.settings.currency})
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={newItemBudget}
                onChange={(e) => setNewItemBudget(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="btn-primary flex-1 py-2 text-xs shadow-sm"
              >
                إضافة البند
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: تعديل بند ميزانية */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <form
            onSubmit={handleSaveEditBudget}
            className="w-full max-w-xs bg-white dark:bg-[#211A2D] rounded-[20px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC] dark:border-[#3A3150]">
              <h3 className="font-extrabold text-sm text-[#5F2967] dark:text-[#D8B4FE]">
                تعديل: {editingItem.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-white p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            {!(editingItem.isSystem || editingItem.isPocketSupport) ? (
              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  اسم البند:
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="input-field w-full px-3 py-2 text-xs"
                />
              </div>
            ) : (
              <p className="text-[11px] text-[#666079] font-bold">بند نظامي ثابت لا يمكن تعديل اسمه</p>
            )}

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                المبلغ المقرر ({state.settings.currency}):
              </label>
              <input
                type="number"
                step="any"
                required
                value={editingItem.budgeted}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, budgeted: parseFloat(e.target.value) || 0 })
                }
                className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="btn-primary flex-1 py-2 text-xs shadow-sm"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: تعديل حركة صرف */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <form
            onSubmit={handleSaveEditExpense}
            className="w-full max-w-xs bg-white dark:bg-[#211A2D] rounded-[20px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC] dark:border-[#3A3150]">
              <h3 className="font-extrabold text-sm text-[#5F2967] dark:text-[#D8B4FE]">
                تعديل حركة الصرف
              </h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-white p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                المبلغ ({state.settings.currency}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={editExpenseAmount}
                onChange={(e) => setEditExpenseAmount(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                ملاحظات أو بيان المصروف:
              </label>
              <input
                type="text"
                value={editExpenseNotes}
                onChange={(e) => setEditExpenseNotes(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="btn-primary flex-1 py-2 text-xs shadow-sm"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
