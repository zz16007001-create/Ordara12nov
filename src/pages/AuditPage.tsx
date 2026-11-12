/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  AuditPeriod,
  AuditLogItem,
  AuditActionType,
  AuditManualNoteType,
} from '../types';
import {
  getAuditPeriod,
  recordAuditEntry,
  updateAuditEntry,
  deleteAuditEntry,
  resetAuditPeriod,
} from '../services/auditStorage';
import { Icon3D } from '../components/icons3d/Icon3D';

const arabicMonths = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

function formatAuditDateTime(actionDate: string, registeredAt?: string): string {
  let datePart = actionDate;
  if (actionDate && actionDate.includes('-')) {
    const parts = actionDate.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        datePart = `${day} ${arabicMonths[monthIdx]}`;
      }
    }
  }

  let timePart = '';
  if (registeredAt) {
    try {
      const d = new Date(registeredAt);
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12;
      hours = hours ? hours : 12;
      timePart = `${hours}:${minutes} ${ampm}`;
    } catch {
      timePart = '';
    }
  }

  return timePart ? `${datePart} ▪ ${timePart}` : datePart;
}

function formatSubLine(item: AuditLogItem): string | null {
  const parts: string[] = [];
  if (item.itemName) {
    parts.push(item.itemName);
  }
  if (item.itemSize) {
    parts.push(`مقاس ${item.itemSize}`);
  }
  if (item.customerName) {
    parts.push(item.customerName);
  }
  if (item.orderCode) {
    const cleanCode = item.orderCode.replace(/^أوردر\s*/, '').trim();
    parts.push(`أوردر #${cleanCode.replace(/^#/, '')}`);
  }
  if (parts.length > 0) {
    return parts.join(' ▪ ');
  }
  if (item.manualCategory) {
    return item.manualCategory;
  }
  if (item.details) {
    return item.details.slice(0, 45);
  }
  return null;
}

function formatAuditAmount(item: AuditLogItem, currency: string): string | null {
  if (item.amount === undefined) return null;
  const isReturn = item.type === 'return';
  const numStr = item.amount.toLocaleString('en-US');
  return isReturn ? `-${numStr} ${currency}` : `${numStr} ${currency}`;
}

export const AuditPage: React.FC = () => {
  const { state, setCurrentPage } = useApp();

  const [period, setPeriod] = useState<AuditPeriod>(getAuditPeriod);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Search & Filter (Side-by-side in one row)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Modal: Add Manual Note
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteCategory, setNoteCategory] = useState<AuditManualNoteType>('مبلغ خارج الشغل');
  const [noteAmount, setNoteAmount] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [noteDetails, setNoteDetails] = useState('');

  // Modal: Edit Audit Record (Audit ledger copy only)
  const [editingItem, setEditingItem] = useState<AuditLogItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemSize, setEditItemSize] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Modal: Confirm Delete from Audit Log (Audit ledger copy only)
  const [deletingItem, setDeletingItem] = useState<AuditLogItem | null>(null);

  // Modal: Confirm Reset / Reconcile Period
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Refresh period state whenever updated
  const refreshPeriod = useCallback(() => {
    setPeriod(getAuditPeriod());
  }, []);

  useEffect(() => {
    const handleUpdate = () => refreshPeriod();
    window.addEventListener('audit-period-updated', handleUpdate);
    return () => window.removeEventListener('audit-period-updated', handleUpdate);
  }, [refreshPeriod]);

  // Synchronize past actions since period start date to prevent missing entries
  // (Items manually deleted from audit log are stored in deletedSourceIds and never re-added)
  useEffect(() => {
    const currentP = getAuditPeriod();
    const periodStart = currentP.startDate;
    const periodStartedAt = currentP.startedAt;

    // هل الحركة حصلت بعد بداية الفترة؟
    // - لو للحركة وقت تسجيل دقيق: بنقارنه بلحظة التقفيل (حتى لو في نفس اليوم)
    // - لو حركة قديمة من غير وقت: بنعتبرها بعد التقفيل بس لو في يوم بعد يوم التقفيل
    // - لو الفترة نفسها قديمة ومفيهاش لحظة بداية: السلوك القديم بالتاريخ
    const isAfterStart = (timestamp: string | undefined, date: string): boolean => {
      if (periodStartedAt) {
        if (timestamp) return timestamp >= periodStartedAt;
        return date > periodStart;
      }
      return date >= periodStart;
    };

    // 1. Orders and sold items
    state.orders.forEach((order) => {
      order.items.forEach((it) => {
        if (it.isSold && it.soldDate && isAfterStart(it.soldAt, it.soldDate)) {
          const cust = it.customerId
            ? (state.customers || []).find((c) => c.id === it.customerId)
            : undefined;
          recordAuditEntry({
            sourceId: `sale_${order.id}_${it.id}_${it.soldDate}`,
            type: 'sale',
            title: `${it.name}${it.size ? ` (مقاس ${it.size})` : ''}`,
            itemName: it.name,
            itemSize: it.size,
            orderCode: order.code,
            customerName: cust?.name,
            amount: (it.soldPrice || 0) * (it.quantity || 1),
            actionDate: it.soldDate,
            details: `الكمية: ${it.quantity} | سعر البيع: ${it.soldPrice || 0} ${state.settings.currency} | طريقة الدفع: ${it.paymentMethod || 'نقدية (كاش)'}`,
          });
        }
      });
    });

    // 2. Customer Payments
    (state.customerPayments || []).forEach((pay) => {
      if (isAfterStart(pay.createdAt, pay.date) && !pay.appliedToItemId && pay.kind !== 'refund') {
        const cust = (state.customers || []).find((c) => c.id === pay.customerId);
        const linkedOrder = pay.orderId ? state.orders.find((o) => o.id === pay.orderId) : undefined;
        recordAuditEntry({
          sourceId: `pay_${pay.id}`,
          type: 'collection',
          title: cust?.name || 'عميل مسجل',
          customerName: cust?.name || 'عميل مسجل',
          orderCode: linkedOrder?.code,
          amount: pay.amount,
          actionDate: pay.date,
          details: `سداد دين / دفعة نقدية${pay.notes ? ` (${pay.notes})` : ''}`,
        });
      }
    });

    refreshPeriod();
  }, [
    state.orders,
    state.customerPayments,
    state.customers,
    state.settings.currency,
    refreshPeriod,
  ]);

  // Handle Save Manual Note
  const handleSaveManualNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteDetails.trim()) return;

    const amount = parseFloat(noteAmount) || undefined;
    recordAuditEntry({
      type: 'note',
      title: 'ملاحظة',
      manualCategory: noteCategory,
      itemName: noteCategory,
      amount,
      actionDate: noteDate,
      details: noteDetails.trim(),
    });

    setNoteAmount('');
    setNoteDetails('');
    setNoteCategory('مبلغ خارج الشغل');
    setShowNoteModal(false);
    refreshPeriod();
  };

  // Open Edit Modal for an audit entry
  const handleOpenEditModal = (item: AuditLogItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditItemName(item.itemName || '');
    setEditItemSize(item.itemSize || '');
    setEditAmount(item.amount !== undefined ? String(item.amount) : '');
    setEditDetails(item.details || '');
    setEditNotes(item.notes || '');
  };

  // Save Edit (Audit ledger copy only)
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const parsedAmount = editAmount.trim() ? parseFloat(editAmount) : undefined;
    updateAuditEntry(editingItem.id, {
      title: editTitle.trim() || editingItem.title,
      itemName: editItemName.trim() || undefined,
      itemSize: editItemSize.trim() || undefined,
      amount: parsedAmount,
      details: editDetails.trim(),
      notes: editNotes.trim() || undefined,
    });

    setEditingItem(null);
    refreshPeriod();
  };

  // Confirm Delete from Audit Log (Audit ledger copy only)
  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    deleteAuditEntry(deletingItem.id);
    setDeletingItem(null);
    refreshPeriod();
  };

  // Handle Reset / Reconcile Period
  const handleConfirmReset = () => {
    resetAuditPeriod();
    setShowResetConfirm(false);
    refreshPeriod();
  };

const ALLOWED_AUDIT_TYPES: AuditActionType[] = ['sale', 'return', 'collection', 'note'];

function getDisplayTitle(item: AuditLogItem): string {
  if (item.type === 'sale') {
    const base = (item.itemName || item.title || '').replace(/^بيع\s*(صنف)?\s*[:\-]?\s*/, '').trim();
    if (item.itemSize && !base.includes(item.itemSize)) {
      return `${base} (مقاس ${item.itemSize})`;
    }
    return base || 'صنف مباع';
  }
  if (item.type === 'return') {
    return (item.itemName || item.title || '').replace(/^مرتجع\s*(صنف)?\s*[:\-]?\s*/, '').trim() || 'صنف مرتجع';
  }
  if (item.type === 'collection') {
    return item.customerName || (item.title || '').replace(/^تحصيل\s*(من\s*عميل)?\s*[:\-]?\s*/, '').trim() || 'تحصيل';
  }
  return item.title;
}

  // Filtered Items: Search and Dropdown filter work simultaneously
  const filteredItems = useMemo(() => {
    return period.items.filter((item) => {
      // Allowed types only: sale, return, collection, note
      if (!ALLOWED_AUDIT_TYPES.includes(item.type)) return false;

      // 1. Dropdown Type Filter
      if (filterType !== 'all') {
        if (item.type !== filterType) return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const displayTitle = getDisplayTitle(item).toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q) || displayTitle.includes(q);
        const matchDetails = (item.details || '').toLowerCase().includes(q);
        const matchItem = (item.itemName || '').toLowerCase().includes(q);
        const matchSize = (item.itemSize || '').toLowerCase().includes(q);
        const matchOrder = (item.orderCode || '').toLowerCase().includes(q);
        const matchCust = (item.customerName || '').toLowerCase().includes(q);
        const matchCat = (item.manualCategory || '').toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        if (
          !matchTitle &&
          !matchDetails &&
          !matchItem &&
          !matchSize &&
          !matchOrder &&
          !matchCust &&
          !matchCat &&
          !matchNotes
        ) {
          return false;
        }
      }

      return true;
    });
  }, [period.items, filterType, searchQuery]);

  // Statistics: only count allowed types
  const totalMovements = period.items.filter((it) => ALLOWED_AUDIT_TYPES.includes(it.type)).length;
  const manualNotesCount = period.items.filter((it) => it.type === 'note').length;

  const getTypeMeta = (type: AuditActionType, manualCat?: string) => {
    switch (type) {
      case 'sale':
        return {
          label: 'بيع',
          stripe: 'bg-[#2F7F5F]',
          badgeBg: 'bg-[#E3F2EA] dark:bg-[#162E23]',
          badgeText: 'text-[#2F7F5F] dark:text-[#4BA682]',
        };
      case 'return':
        return {
          label: 'مرتجع',
          stripe: 'bg-[#A23B5A]',
          badgeBg: 'bg-[#F8E6EC] dark:bg-[#381B26]',
          badgeText: 'text-[#A23B5A] dark:text-[#FB7185]',
        };
      case 'collection':
        return {
          label: 'تحصيل',
          stripe: 'bg-[#3D6A8F]',
          badgeBg: 'bg-[#EBF2F7] dark:bg-[#1E2E3B]',
          badgeText: 'text-[#3D6A8F] dark:text-[#60A5FA]',
        };
      case 'note':
      default:
        return {
          label: manualCat || 'ملاحظة',
          stripe: 'bg-[#2F9F91]',
          badgeBg: 'bg-[#E0F4F2] dark:bg-[#153430]',
          badgeText: 'text-[#2F9F91] dark:text-[#5EEAD4]',
        };
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItemId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E] dark:text-[#F4F0FA]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج من #6B2D7A إلى #5F2967، ارتفاع 52px */}
      <div className="card-header-purple flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => setCurrentPage('entry')}
            className="btn-back-transparent"
            title="رجوع للرئيسية"
          >
            ➜
          </button>
          <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
            سجل المراجعة
          </span>
        </div>
        <div className="w-6 h-6 flex items-center justify-center opacity-80">
          <Icon3D name="verified" size={22} />
        </div>
      </div>

      {/* 2. كارت تيل متدرج (#2F9F91 إلى #2DB2A5): فترة التسجيل الحالية */}
      <div className="rounded-[20px] bg-gradient-to-l from-[#2F9F91] to-[#2DB2A5] p-[15px] text-white shadow-[0_6px_16px_rgba(47,159,145,0.25)] select-none">
        <div
          onClick={() => setIsStatsOpen(!isStatsOpen)}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-[800]">فترة التسجيل الحالية</span>
              <span className="h-[22px] px-2.5 rounded-full bg-white/20 text-white text-[10px] font-bold inline-flex items-center gap-1 border border-white/30 backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                التسجيل شغال
              </span>
            </div>
            <p className="text-[11px] text-white/90 font-medium">
              بدأت بتاريخ: <span className="font-bold tabular-nums">{period.startDate}</span> ({period.startTime})
            </p>
          </div>

          <span className="text-sm font-bold text-white/80">
            {isStatsOpen ? '▲' : '▼'}
          </span>
        </div>

        {/* الإحصائيات (مخفية افتراضياً وتظهر عند الضغط) */}
        {isStatsOpen && (
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs">
              <span className="text-[10px] text-white/80 block font-medium">عدد الحركات</span>
              <strong className="text-[16px] font-black tabular-nums block mt-0.5">
                {totalMovements}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs">
              <span className="text-[10px] text-white/80 block font-medium">الملاحظات اليدوية</span>
              <strong className="text-[16px] font-black tabular-nums block mt-0.5">
                {manualNotesCount}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* 3. سطر تحت الكارت: زر بنفسجي صغير «＋ إضافة ملاحظة» وعداد الحركات */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowNoteModal(true)}
          className="h-[34px] px-[14px] rounded-full bg-[#5F2967] hover:bg-[#4A1E52] text-white text-[12px] font-[800] flex items-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(95,41,103,0.25)] active:scale-95 transition-all"
        >
          <span className="text-[#4ADE80] font-black text-[15px] leading-none">＋</span>
          <span>إضافة ملاحظة</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-bold text-[#666079] dark:text-[#9E97B0]">
          <span>الحركات المسجلة:</span>
          <span className="px-2 py-0.5 rounded-full bg-white dark:bg-[#211A2D] text-[#5F2967] dark:text-[#D8B4FE] border border-[#D4D0E0] dark:border-[#3A3150] tabular-nums font-black text-[11px]">
            {filteredItems.length}
          </span>
        </div>
      </div>

      {/* 4. شريط البحث وقائمة اختيار نوع الحركة في صف أفقي واحد مطابق للصورة المرجعية */}
      <div className="flex items-center gap-[10px]">
        {/* حقل البحث: عريض على اليمين في RTL */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="ابحث باسم الصنف أو الأوردر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[48px] pr-4 pl-8 rounded-[18px] border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-[13px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] placeholder:text-[#9A98B0] dark:placeholder:text-[#6C6780] outline-none focus:border-[#5F2967] shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A98B0] hover:text-[#1F1A2E] cursor-pointer text-xs"
              title="مسح البحث"
            >
              ✕
            </button>
          )}
        </div>

        {/* قائمة اختيار نوع الحركة: قائمة منسدلة حقيقية على اليسار في RTL */}
        <div className="relative w-[130px] shrink-0">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full h-[48px] pr-3 pl-8 rounded-[18px] border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-[13px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] outline-none cursor-pointer appearance-none shadow-xs text-right"
          >
            <option value="all">كل الحركات</option>
            <option value="sale">بيع</option>
            <option value="return">مرتجع</option>
            <option value="collection">تحصيل</option>
            <option value="note">ملاحظات</option>
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#7A7585] dark:text-[#9A98B0] text-[13px] font-bold">
            ∨
          </div>
        </div>
      </div>

      {/* 5. قائمة كروت الحركات: مطابقة 100% للصورة المرجعية */}
      {filteredItems.length === 0 ? (
        <div className="py-10 text-center card-main p-6 text-xs text-[#666079] dark:text-[#9E97B0] space-y-1">
          <p className="font-bold">لا توجد حركات مسجلة تطابق البحث أو نوع الحركة المختار.</p>
          <p className="text-[11px]">أي حركة بيع أو مرتجع أو تحصيل جديدة سيتم توثيقها هنا تلقائياً.</p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-[12px]">
          {filteredItems.map((item) => {
            const isExpanded = expandedItemId === item.id;
            const meta = getTypeMeta(item.type, item.manualCategory);
            const subLine = formatSubLine(item);
            const formattedAmount = formatAuditAmount(item, state.settings.currency);
            const formattedDateTime = formatAuditDateTime(item.actionDate, item.registeredAt);

            return (
              <div
                key={item.id}
                className="w-full bg-white dark:bg-[#211A2D] rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-[#ECECF4]/70 dark:border-[#32263F]/70 overflow-hidden transition-all"
              >
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="pr-3 pl-3.5 py-3 flex items-center justify-between gap-2.5 cursor-pointer select-none"
                >
                  {/* الجهة اليمنى: الشريط الملون + العنوان والشارة (موجز ومختصر بدون السطر الرمادي وهو مقفول) */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* شريط رأسي رفيع ملون عند الحافة اليمنى */}
                    <div className={`w-[4px] h-[36px] rounded-full shrink-0 ${meta.stripe}`} />

                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      {/* السطر الأول: عنوان الحركة المختصر وبجواره الشارة */}
                      <h4 className="font-extrabold text-[15px] text-[#1F1A2E] dark:text-[#F4F0FA] leading-tight truncate">
                        {getDisplayTitle(item)}
                      </h4>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.badgeBg} ${meta.badgeText} shrink-0 leading-none`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  {/* الجهة اليسرى: المبلغ والتاريخ والوقت والسهم الصغير */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      {formattedAmount && (
                        <div className="text-[15px] font-[900] text-[#1F1A2E] dark:text-[#F4F0FA] tabular-nums leading-tight">
                          {formattedAmount}
                        </div>
                      )}
                      <div className="text-[11px] text-[#8C8799] dark:text-[#8E879F] font-medium tabular-nums mt-0.5 leading-tight">
                        {formattedDateTime}
                      </div>
                    </div>

                    {/* سهم صغير لأسفل/لأعلى يوضح إمكانية فتح التفاصيل */}
                    <span className="text-[#8C8799] dark:text-[#8E879F] text-[13px] font-black">
                      {isExpanded ? '▲' : '∨'}
                    </span>
                  </div>
                </div>

                {/* تفاصيل الحركة المنسدلة عند الضغط على الكارت فقط */}
                {isExpanded && (
                  <div className="border-t border-[#ECECF4] dark:border-[#32263F] p-4 bg-[#F9F9FC] dark:bg-[#1A1424] text-xs space-y-3">
                    {subLine && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-[#211A2D] border border-[#ECECF4] dark:border-[#32263F] text-[12px] text-[#7A7585] dark:text-[#9E97B0] font-medium leading-relaxed">
                        {subLine}
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="font-bold text-[#666079] dark:text-[#9E97B0] block text-[11px]">
                        تفاصيل وبيانات الحركة:
                      </span>
                      <p className="text-[#1F1A2E] dark:text-[#F4F0FA] leading-relaxed font-medium">
                        {item.details || 'لا توجد تفاصيل إضافية'}
                      </p>
                    </div>

                    {item.notes && (
                      <div className="space-y-0.5 pt-1 border-t border-[#E4E1EC]/50 dark:border-[#3A3150]/50">
                        <span className="font-bold text-[#666079] dark:text-[#9E97B0] text-[10px]">
                          ملاحظة مرفقة:
                        </span>
                        <p className="text-[11px] text-[#5F2967] dark:text-[#D8B4FE] font-bold">
                          {item.notes}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#ECECF4] dark:border-[#32263F] flex-wrap gap-2">
                      <div className="text-[10px] text-[#9A98B0] tabular-nums">
                        {item.registeredAt && `وقت التوثيق: ${new Date(item.registeredAt).toLocaleString('ar-EG')}`}
                      </div>

                      {/* أزرار التحكم اليدوي: تعديل وحذف نسخة السجل فقط دون أي مساس بالحركة الأصلية */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="px-3 py-1.5 rounded-lg bg-[#5F2967] hover:bg-[#4C1F53] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95"
                          title="تعديل نسخة السجل فقط"
                        >
                          <Icon3D name="note" size={13} />
                          <span>تعديل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingItem(item)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-[#E2574C] font-bold text-[11px] flex items-center gap-1 cursor-pointer transition border border-rose-200 dark:border-rose-900 active:scale-95"
                          title="حذف من سجل المراجعة فقط"
                        >
                          <Icon3D name="trash" size={13} />
                          <span>حذف من سجل المراجعة</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 6. زر سفلي مطابق تماماً للصورة المرجعية: بنفسجي عريض */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="w-full py-3.5 px-4 rounded-[20px] bg-[#5F2967] hover:bg-[#4C1F53] text-white flex flex-col items-center justify-center gap-1 cursor-pointer shadow-[0_6px_20px_rgba(95,41,103,0.3)] active:scale-98 transition-all"
        >
          <span className="font-[800] text-[15px] leading-tight">
            ✓ التقفيل صحيح – ابدأ من جديد
          </span>
          <span className="text-[11px] text-white/80 font-medium leading-tight">
            يمسح سجل المراجعة فقط ولا يغير حسابات البرنامج
          </span>
        </button>
      </div>

      {/* MODAL 1: تعديل نسخة الحركة في سجل المراجعة فقط */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-sm bg-white dark:bg-[#211A2D] rounded-[24px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC] dark:border-[#3A3150]">
              <h3 className="font-extrabold text-[14px] text-[#5F2967] dark:text-[#D8B4FE]">
                تعديل نسخة الحركة في سجل المراجعة
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-white"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                عنوان الحركة / الاسم الظاهر *
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-xs font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  اسم الصنف / البيان
                </label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-xs font-bold outline-none focus:border-[#5F2967]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  المقاس (إن وجد)
                </label>
                <input
                  type="text"
                  value={editItemSize}
                  onChange={(e) => setEditItemSize(e.target.value)}
                  className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-xs font-bold outline-none focus:border-[#5F2967]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                المبلغ المعروض في السجل ({state.settings.currency})
              </label>
              <input
                type="number"
                step="any"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-center font-black text-sm text-[#5F2967] dark:text-[#D8B4FE] outline-none focus:border-[#5F2967] tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                تفاصيل ووصف الحركة
              </label>
              <textarea
                rows={2}
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-xs font-medium outline-none focus:border-[#5F2967]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                ملاحظات السجل
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="ملاحظة خاصة بسجل المراجعة..."
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-xs font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] text-[11px] leading-relaxed">
              ✓ التعديل يخص نسخة السجل فقط ولا يمس أو يغير الحركة الأصلية أو الفاتورة أو المخزون.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 h-[36px] rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                حفظ التعديل في السجل
              </button>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 h-[36px] rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-[#1F1A2E] dark:text-[#F4F0FA] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: تأكيد حذف نسخة الحركة من سجل المراجعة فقط */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#211A2D] rounded-[24px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-[#E2574C]">
              <Icon3D name="trash" size={24} />
              <h3 className="font-extrabold text-[15px] text-[#1F1A2E] dark:text-[#F4F0FA]">
                حذف من سجل المراجعة
              </h3>
            </div>

            <div className="space-y-1 text-[#666079] dark:text-[#9E97B0] leading-relaxed text-[11px]">
              <p>
                هل أنت متأكد من حذف حركة «<strong className="text-[#1F1A2E] dark:text-white font-bold">{deletingItem.title}</strong>» من سجل المراجعة؟
              </p>
              {deletingItem.itemName && (
                <p className="font-bold text-[#5F2967] dark:text-[#D8B4FE]">
                  الصنف / البيان: {deletingItem.itemName}
                </p>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-[#E2574C] dark:text-rose-300 text-[11px] font-bold leading-relaxed border border-rose-200 dark:border-rose-900">
              ✓ سيتم حذف نسخة الحركة من سجل المراجعة فقط. لن يتم حذف الفاتورة أو الأوردر أو التحصيل أو المصروف الأصلي، ولن يتأثر أي رصيد أو مخزون على الإطلاق.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 h-[38px] rounded-xl bg-[#E2574C] hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                تأكيد الحذف من السجل فقط
              </button>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 h-[38px] rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-[#1F1A2E] dark:text-[#F4F0FA] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: إضافة ملاحظة يدوية */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveManualNote}
            className="w-full max-w-sm bg-white dark:bg-[#211A2D] rounded-[24px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC] dark:border-[#3A3150]">
              <h3 className="font-extrabold text-[14px] text-[#5F2967] dark:text-[#D8B4FE]">
                إضافة ملاحظة مراجعة يدوية
              </h3>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="text-[#666079] hover:text-[#1F1A2E] dark:hover:text-white"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                نوع الملاحظة *
              </label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as AuditManualNoteType)}
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-xs font-bold outline-none focus:border-[#5F2967]"
              >
                <option value="مبلغ خارج الشغل">مبلغ خارج الشغل</option>
                <option value="مبلغ زائد في الخزينة">مبلغ زائد في الخزينة</option>
                <option value="مبلغ ناقص في الخزينة">مبلغ ناقص في الخزينة</option>
                <option value="بيع لم يسجل">بيع لم يسجل</option>
                <option value="تحصيل لم يسجل">تحصيل لم يسجل</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  المبلغ (اختياري)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={noteAmount}
                  onChange={(e) => setNoteAmount(e.target.value)}
                  className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-center font-bold outline-none focus:border-[#5F2967] tabular-nums"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                  تاريخ الحركة *
                </label>
                <input
                  type="date"
                  required
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-center font-bold outline-none focus:border-[#5F2967] text-[11px]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] dark:text-[#F4F0FA] mb-1">
                تفاصيل الملاحظة *
              </label>
              <textarea
                required
                rows={3}
                placeholder="اكتب تفاصيل الملاحظة للمراجعة والتوثيق..."
                value={noteDetails}
                onChange={(e) => setNoteDetails(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#D4D0E0] dark:border-[#3A3150] bg-white dark:bg-[#211A2D] text-xs font-medium outline-none focus:border-[#5F2967]"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-[#E0F4F2] dark:bg-[#153430] text-[#2F9F91] dark:text-[#5EEAD4] text-[10px] leading-relaxed">
              الملاحظة لغرض التوثيق والمراجعة فقط ولا تؤثر على أي حركة أو رصيد مالي.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 h-[36px] rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                حفظ الملاحظة
              </button>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="px-4 h-[36px] rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-[#1F1A2E] dark:text-[#F4F0FA] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: تأكيد التقفيل وبدء فترة مراجعة جديدة */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#211A2D] rounded-[24px] p-5 border border-[#D4D0E0] dark:border-[#3A3150] space-y-3.5 text-right text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-[#5F2967] dark:text-[#D8B4FE]">
              <Icon3D name="shield_ok" size={24} />
              <h3 className="font-extrabold text-[15px] text-[#1F1A2E] dark:text-[#F4F0FA]">
                تأكيد تقفيل سجل المراجعة
              </h3>
            </div>

            <p className="text-[11px] text-[#666079] dark:text-[#9E97B0] leading-relaxed">
              سيتم أرشفة/تصفير سجل المراجعة الحالي والبدء بفترة مراجعة جديدة بتاريخ ووقت الآن.
            </p>

            <div className="p-3 rounded-2xl bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682] text-[11px] font-bold leading-relaxed">
              ✓ لن يتم حذف أو تعديل أي حركة مالية أو أوردر أو رصيد في البرنامج على الإطلاق.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 h-[38px] rounded-xl bg-[#5F2967] hover:bg-[#4C1F53] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                تأكيد التقفيل والبدء من جديد
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 h-[38px] rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-[#1F1A2E] dark:text-[#F4F0FA] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
