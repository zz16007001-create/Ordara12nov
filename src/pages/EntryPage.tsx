/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Icon3D } from '../components/icons3d/Icon3D';

export const EntryPage: React.FC = () => {
  const {
    state,
    baseCapital,
    liquidity,
    pocketBalance,
    pocketOpenDebt,
    charityBalance,
    charityTotalInflow,
    charityTotalPaid,
    salaryTotalRemaining,
    salaryTotalBudgeted,
    salaryTotalSpent,
    addCharitySettlement,
    openQuickModal,
    setCurrentPage,
  } = useApp();

  // Accordion state for Pocket & Salary cards (closed by default)
  const [isPocketOpen, setIsPocketOpen] = useState(false);
  const [isSalaryOpen, setIsSalaryOpen] = useState(false);

  // Charity Box Settlement Modal state
  const [charityModalOpen, setCharityModalOpen] = useState(false);
  // سجل الصدقة المخفي (الداخل من كل أوردر): بيتحسب من حالة البرنامج الحالية فيتحدث لحظياً
  const [showCharityLog, setShowCharityLog] = useState(false);
  const charityInflowLog = state.charityRecords
    .filter((c) => c.type === 'inflow_order')
    .map((c) => {
      const ord = state.orders.find((o) => o.id === c.orderId);
      return {
        id: c.id,
        name: ord?.code || c.orderCode || c.description,
        amount: c.amount,
        date: c.date,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleSuccess, setSettleSuccess] = useState(false);

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) return;
    addCharitySettlement(amt, settleNotes.trim() || undefined);
    setSettleAmount('');
    setSettleNotes('');
    setSettleSuccess(true);
    setTimeout(() => {
      setSettleSuccess(false);
      setCharityModalOpen(false);
    }, 1500);
  };

  // Follow-up calculations from real data
  const openOrdersCount = state.orders.filter((o) => o.items.some((it) => !it.isSold && it.name.trim() !== 'مصاريف')).length;
  const unsoldItemsCount = state.orders.reduce(
    (acc, o) =>
      acc +
      o.items
        .filter((it) => !it.isSold && it.name.trim() !== 'مصاريف')
        .reduce((sum, it) => sum + (it.quantity || 1), 0),
    0
  );
  const unpaidPocketAdvancesCount = state.pocketTransactions.filter(
    (p) => p.type === 'withdrawal' && p.status !== 'مسدد بالكامل'
  ).length;

  return (
    <div className="w-full text-[#1F1A2E] dark:text-[#F4F0FA] space-y-[13px]">
      {/* 1) كارت اسم الصفحة: بنفسجي متدرج، ارتفاع 52px، حشو 15px، زرار كبسولة بيضاء */}
      <div>
        <div className="card-header-purple">
          <span className="text-[18px] font-[800] text-white leading-none">
            لوحة التحكم
          </span>

          <button
            onClick={() => openQuickModal()}
            className="btn-header-white-pill"
          >
            ＋ تسجيل سريع
          </button>
        </div>
        <div className="text-[11px] font-[500] text-[#666079] dark:text-[#9E97B0] px-1 mt-1.5">
          المتابعة المالية وإدارة حركة الخزن
        </div>
      </div>

      {/* 2) كارت رأس المال: أخضر تيل، ارتفاعه 116px، عنوانه 17px، الرقم الكبير 30px، والتسميات 11px */}
      <div
        onClick={() => setCurrentPage('capital')}
        className="w-full h-[116px] card-hero-teal relative p-[14px] cursor-pointer overflow-hidden active:scale-[0.99]"
      >
        {/* الصف العلوي: الأيقونة 32px + «رأس المال» 17px/800 + النجمة ⭐ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <div className="w-[32px] h-[32px] rounded-full bg-[rgba(255,255,255,0.2)] flex items-center justify-center text-white shrink-0">
              <Icon3D name="money_bag" size={16} />
            </div>
            <div className="flex items-center gap-[6px] text-[17px] font-[800] text-white leading-none">
              <span>رأس المال</span>
              <span className="text-[14px] text-amber-300 leading-none">⭐</span>
            </div>
          </div>

          <div className="text-left text-[12px]">
            <span className="text-white/80 font-[500] text-[11px] ml-1">الأساسي:</span>
            <span className="text-white font-[700] tabular-nums">
              {baseCapital.toLocaleString('en-US')} ج.م
            </span>
          </div>
        </div>

        {/* الصف السفلي: «السيولة المتاحة» 11px + الرقم 30px/900 + «ج.م» 13px/700 */}
        <div className="mt-[10px]">
          <div className="text-[11px] font-[600] text-white/85 leading-none mb-[4px]">
            السيولة المتاحة
          </div>
          <div className="flex items-baseline gap-[8px]">
            <span className="text-[30px] font-[900] leading-none text-white tabular-nums">
              {liquidity.toLocaleString('en-US')}
            </span>
            <span className="text-[13px] font-[700] text-white/85 leading-none">
              ج.م
            </span>
          </div>
        </div>
      </div>

      {/* 3) كارت خزنة بوكيت وكارت خزنة القبض: جنب بعض بـ items-start، مقفولين افتراضيًا والفتح فوري */}
      <div className="grid grid-cols-2 gap-[13px] items-start">
        {/* اليمين: خزنة بوكيت */}
        <div
          onClick={() => setIsPocketOpen(!isPocketOpen)}
          className="card-main p-[12px] cursor-pointer select-none"
        >
          {/* الهيدر: الأيقونة 28px + الاسم في سطر واحد 14px/800 + سهم 22px */}
          <div className="flex items-center justify-between gap-[6px]">
            <div className="flex items-center gap-[7px] min-w-0">
              <div className="w-[28px] h-[28px] rounded-full bg-[#E4EDF5] dark:bg-[#1A2836] text-[#3D6A8F] flex items-center justify-center shrink-0">
                <Icon3D name="pocket" size={15} />
              </div>
              <span className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] whitespace-nowrap leading-[1.9]">
                خزنة بوكيت
              </span>
            </div>

            <div
              className={`w-[22px] h-[22px] rounded-full bg-[#F5F4F9] dark:bg-[#1A1424] text-[#666079] dark:text-[#9E97B0] flex items-center justify-center text-[10px] shrink-0 transition-none ${
                isPocketOpen ? 'rotate-180' : ''
              }`}
            >
              ▼
            </div>
          </div>

          {/* التسمية 11px / 600 */}
          <div className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mt-[8px] leading-none">
            السيولة المتاحة
          </div>

          {/* الرقم الكبير 24px / 900 */}
          <div className="text-[24px] font-[900] leading-[28px] text-[#3D6A8F] dark:text-[#60A5FA] tabular-nums mt-[3px]">
            {pocketBalance.toLocaleString('en-US')}
          </div>

          {/* التفاصيل المفتوحة */}
          {isPocketOpen && (
            <div className="pt-[4px]" onClick={(e) => e.stopPropagation()}>
              <div className="divider-line my-[8px]" />

              <div className="space-y-[4px] text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#666079] dark:text-[#9E97B0] font-[500]">الأساسي:</span>
                  <span className="text-[#1F1A2E] dark:text-[#F4F0FA] font-[700] tabular-nums">
                    {(state.settings.initialPocket || 0).toLocaleString('en-US')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#666079] dark:text-[#9E97B0] font-[500]">السلف المفتوحة:</span>
                  <span className="text-[#A23B5A] dark:text-[#FB7185] font-[700] tabular-nums">
                    {pocketOpenDebt.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentPage('pocket');
                }}
                className="w-full mt-[8px] h-[26px] bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] text-[12px] font-[700] rounded-full flex items-center justify-center border-0 cursor-pointer active:scale-95"
              >
                عرض التفاصيل ➜
              </button>
            </div>
          )}
        </div>

        {/* الشمال: خزنة القبض */}
        <div
          onClick={() => setIsSalaryOpen(!isSalaryOpen)}
          className="card-main p-[12px] cursor-pointer select-none"
        >
          {/* الهيدر: الأيقونة 28px + الاسم في سطر واحد 14px/800 + سهم 22px */}
          <div className="flex items-center justify-between gap-[6px]">
            <div className="flex items-center gap-[7px] min-w-0">
              <div className="w-[28px] h-[28px] rounded-full bg-[#F6ECDC] dark:bg-[#332616] text-[#B7791F] flex items-center justify-center shrink-0">
                <Icon3D name="salary" size={15} />
              </div>
              <span className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] whitespace-nowrap leading-[1.9]">
                خزنة القبض
              </span>
            </div>

            <div
              className={`w-[22px] h-[22px] rounded-full bg-[#F5F4F9] dark:bg-[#1A1424] text-[#666079] dark:text-[#9E97B0] flex items-center justify-center text-[10px] shrink-0 transition-none ${
                isSalaryOpen ? 'rotate-180' : ''
              }`}
            >
              ▼
            </div>
          </div>

          {/* التسمية 11px / 600 */}
          <div className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] mt-[8px] leading-none">
            المتبقي من القبض
          </div>

          {/* الرقم الكبير 24px / 900 */}
          <div className="text-[24px] font-[900] leading-[28px] text-[#B7791F] dark:text-[#FBBF24] tabular-nums mt-[3px]">
            {salaryTotalRemaining.toLocaleString('en-US')}
          </div>

          {/* التفاصيل المفتوحة */}
          {isSalaryOpen && (
            <div className="pt-[4px]" onClick={(e) => e.stopPropagation()}>
              <div className="divider-line my-[8px]" />

              <div className="space-y-[4px] text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#666079] dark:text-[#9E97B0] font-[500]">إجمالي القبض:</span>
                  <span className="text-[#1F1A2E] dark:text-[#F4F0FA] font-[700] tabular-nums">
                    {salaryTotalBudgeted.toLocaleString('en-US')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#666079] dark:text-[#9E97B0] font-[500]">المنصرف:</span>
                  <span className="text-[#1F1A2E] dark:text-[#F4F0FA] font-[700] tabular-nums">
                    {salaryTotalSpent.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentPage('salary');
                }}
                className="w-full mt-[8px] h-[26px] bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] text-[12px] font-[700] rounded-full flex items-center justify-center border-0 cursor-pointer active:scale-95"
              >
                عرض التفاصيل ➜
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4) كارت «صندوق الصدقة»: الارتفاع 88px بدل 118px مع إعادة ضبط مواضع العناصر */}
      <div className="w-full card-main relative">
      <div
        onClick={() => setCharityModalOpen(true)}
        className="w-full h-[88px] px-[14px] py-[10px] cursor-pointer active:scale-[0.99] flex items-center justify-between"
      >
        {/* اليمين: الأيقونة 32px + صندوق الصدقة 14px/800 + الرصيد 20px/900 */}
        <div className="flex items-center gap-[10px]">
          <div className="w-[32px] h-[32px] rounded-full bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682] flex items-center justify-center shrink-0">
            <Icon3D name="charity" size={16} />
          </div>

          <div>
            <div className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] leading-none">
              صندوق الصدقة
            </div>
            <div className="flex items-baseline gap-[6px] mt-[6px]">
              <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0]">
                الرصيد:
              </span>
              <span className="text-[20px] font-[900] text-[#2F7F5F] dark:text-[#4BA682] tabular-nums leading-none">
                {charityBalance.toLocaleString('en-US')}
              </span>
              <span className="text-[11px] font-[700] text-[#666079] dark:text-[#9E97B0]">
                ج.م
              </span>
            </div>
          </div>
        </div>

        {/* الشمال: الداخل (+...) والمدفوع (-...) */}
        <div className="flex flex-col justify-center items-end gap-[4px] text-[12px]">
          <div className="flex items-center gap-[6px]">
            <span className="text-[#666079] dark:text-[#9E97B0] font-[500]">الداخل:</span>
            <span className="text-[#2F7F5F] dark:text-[#4BA682] font-[700] tabular-nums">
              +{charityTotalInflow.toLocaleString('en-US')}
            </span>
          </div>

          <div className="flex items-center gap-[6px]">
            <span className="text-[#666079] dark:text-[#9E97B0] font-[500]">المدفوع:</span>
            <span className="text-[#A23B5A] dark:text-[#FB7185] font-[700] tabular-nums">
              -{charityTotalPaid.toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </div>

      {/* سهم صغير لفتح/إخفاء سجل الأوردرات اللي اترحّل منها 10% */}
      <button
        onClick={() => setShowCharityLog((v) => !v)}
        className="absolute top-[64px] left-1/2 -translate-x-1/2 w-[28px] h-[20px] flex items-center justify-center text-[#666079] dark:text-[#9E97B0] cursor-pointer border-0 bg-transparent"
        title={showCharityLog ? 'إخفاء سجل الأوردرات' : 'عرض سجل الأوردرات'}
      >
        <Icon3D name={showCharityLog ? 'chevron_up' : 'chevron_down'} size={14} />
      </button>

      {showCharityLog && (
        <div className="px-[14px] pb-[10px] border-t border-[#E4E1EC] dark:border-[#3A3150]">
          {charityInflowLog.length === 0 ? (
            <div className="py-3 text-center text-[11px] text-[#666079] dark:text-[#9E97B0]">
              لا توجد أوردرات رُحّل منها للصدقة حتى الآن
            </div>
          ) : (
            <div className="max-h-[220px] overflow-y-auto divide-y divide-[#E4E1EC] dark:divide-[#3A3150]">
              {charityInflowLog.map((r) => (
                <div key={r.id} className="py-[7px] flex items-center justify-between gap-2">
                  <span className="text-[12px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] truncate">
                    {r.name}
                  </span>
                  <span className="text-[12px] font-[800] text-[#2F7F5F] dark:text-[#4BA682] tabular-nums shrink-0">
                    +{r.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {state.settings.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* 5) «يحتاج متابعة»: العنوان 14px، والأقراص ارتفاعها 30px والخط 12px */}
      <div>
        <div className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] mb-[8px]">
          يحتاج متابعة
        </div>

        <div className="flex flex-wrap gap-[9px]">
          <button
            onClick={() => setCurrentPage('pocket')}
            className="h-[30px] px-[12px] bg-white dark:bg-[#211A2D] rounded-full shadow-[0_4px_14px_rgba(43,35,64,0.10)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.40)] text-[12px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] flex items-center gap-[6px] border-0 cursor-pointer active:scale-95"
          >
            <span>⚠️</span>
            <span>{unpaidPocketAdvancesCount} سلف غير مسددة</span>
          </button>

          <button
            onClick={() => setCurrentPage('orders')}
            className="h-[30px] px-[12px] bg-white dark:bg-[#211A2D] rounded-full shadow-[0_4px_14px_rgba(43,35,64,0.10)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.40)] text-[12px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] flex items-center gap-[6px] border-0 cursor-pointer active:scale-95"
          >
            <span>🛒</span>
            <span>{openOrdersCount} أوردر مفتوح</span>
          </button>

          <button
            onClick={() => setCurrentPage('orders')}
            className="h-[30px] px-[12px] bg-white dark:bg-[#211A2D] rounded-full shadow-[0_4px_14px_rgba(43,35,64,0.10)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.40)] text-[12px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] flex items-center gap-[6px] border-0 cursor-pointer active:scale-95"
          >
            <span>📦</span>
            <span>{unsoldItemsCount} قطعة لم تُبع</span>
          </button>
        </div>
      </div>

      {/* مودال تسجيل وإخراج الصدقة */}
      {charityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-xs bg-white dark:bg-[#211A2D] rounded-[24px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-4 text-right shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#D4D0E0] dark:border-[#3A3150]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] flex items-center justify-center">
                  <Icon3D name="charity" size={16} />
                </div>
                <h3 className="font-extrabold text-sm text-[#5F2967] dark:text-[#D8B4FE]">
                  تسجيل صرف من الصدقة
                </h3>
              </div>
              <button
                onClick={() => setCharityModalOpen(false)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-white p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div className="p-2.5 rounded-[14px] bg-[#E3F2EA]/60 dark:bg-[#162E23]/60 border border-[#2F7F5F]/20 flex justify-between items-center text-xs">
              <span className="text-[#666079] dark:text-[#9E97B0]">الرصيد المتاح حالياً:</span>
              <strong className="text-[#2F7F5F] dark:text-[#4BA682] font-black tabular-nums">
                {charityBalance.toLocaleString('en-US')} {state.settings.currency}
              </strong>
            </div>

            {settleSuccess && (
              <div className="p-2 rounded-[12px] bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center">
                تم تسجيل حركة الصرف بنجاح
              </div>
            )}

            <form onSubmit={handleSettleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  المبلغ المدفوع ({state.settings.currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  ملاحظات أو وجه الصرف
                </label>
                <input
                  type="text"
                  placeholder="مثال: إطعام مسكين، مساهمة علاج..."
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="input-field w-full px-3 py-2 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2.5 text-xs shadow-sm"
                >
                  تأكيد الصرف
                </button>
                <button
                  type="button"
                  onClick={() => setCharityModalOpen(false)}
                  className="btn-secondary px-4 py-2.5 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
