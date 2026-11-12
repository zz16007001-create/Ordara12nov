/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Customer, DeliveryMode } from '../types';
import { Icon3D } from '../components/icons3d/Icon3D';
import { getWhatsAppUrl, openWhatsApp, formatMessengerUrl } from '../utils/contact';
import { smartTextMatch } from '../utils/arabicText';

export const CustomersPage: React.FC = () => {
  const {
    state,
    customers,
    customerPayments,
    customerNotes,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addCustomerNote,
    deleteCustomerNote,
    recordCustomerPayment,
    cancelCustomerPayment,
    setCurrentPage,
  } = useApp();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addressQuery, setAddressQuery] = useState(''); // فلتر العنوان (بحث ذكي وسط الكلام)
  const [selectedOrderFilter, setSelectedOrderFilter] = useState<string>('all');

  // Add customer modal states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustSize, setNewCustSize] = useState('');
  const [newCustMessenger, setNewCustMessenger] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [newCustDelivery, setNewCustDelivery] = useState<DeliveryMode | ''>('');
  // لو فيه قيمة هنا يبقى الفورم في وضع «تعديل عميل» بدل «إضافة عميل جديد»
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Collect Payment Modal
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentItemId, setPaymentItemId] = useState(''); // '' = الأقدم أول تلقائي

  // Add Note Modal
  const [noteCustomerId, setNoteCustomerId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);

  // Delete customer confirmation dialog (works reliably inside sandboxed iframes)
  const [deleteModal, setDeleteModal] = useState<{
    customerId: string;
    customerName: string;
    blocked: boolean;
    blockedMessage?: string;
    warnings?: string[];
  } | null>(null);

  // Active customer profile tab: 'statement' | 'notes'
  const [activeCustomerTab, setActiveCustomerTab] = useState<'statement' | 'payments' | 'notes'>('statement');

  // Customer Summary Statistics
  const customerStatsMap = useMemo(() => {
    const map: Record<string, { totalPurchases: number; totalPaid: number; remainingDebt: number; itemsCount: number }> = {};

    customers.forEach((c) => {
      map[c.id] = { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
    });

    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (it.customerId && it.isSold) {
          if (!map[it.customerId]) {
            map[it.customerId] = { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
          }
          const price = (it.soldPrice || 0) * (it.quantity || 1);
          const paid = it.paidAmount !== undefined ? it.paidAmount : price;
          const debt = Math.max(0, price - paid);

          map[it.customerId].totalPurchases += price;
          map[it.customerId].totalPaid += paid;
          map[it.customerId].remainingDebt += debt;
          map[it.customerId].itemsCount += 1;
        }
      });
    });

    return map;
  }, [customers, state.orders]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let debt = 0;
    let purchases = 0;
    let paid = 0;
    Object.values(customerStatsMap).forEach((st) => {
      debt += st.remainingDebt;
      purchases += st.totalPurchases;
      paid += st.totalPaid;
    });
    return { debt, purchases, paid };
  }, [customerStatsMap]);

  // Undelivered items for selected customer (بند 3-ب)
  const undeliveredItems = useMemo(() => {
    if (!selectedCustomerId) return [];
    const list: Array<{ id: string; itemName: string; orderCode: string; quantity?: number; size?: string; suggestedSellPrice?: number }> = [];
    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (!it.isSold && (it.requestedByCustomerId === selectedCustomerId || it.customerId === selectedCustomerId)) {
          list.push({
            id: it.id,
            itemName: it.name,
            orderCode: ord.code,
            quantity: it.quantity,
            size: it.size,
            suggestedSellPrice: it.suggestedSellPrice,
          });
        }
      });
    });
    return list;
  }, [selectedCustomerId, state.orders]);

  // Filtered customers (بند 3-ج)
  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (selectedOrderFilter !== 'all') {
      const targetOrder = state.orders.find((o) => o.id === selectedOrderFilter);
      if (!targetOrder) {
        list = [];
      } else {
        list = list.filter((c) =>
          targetOrder.items.some(
            (it) => it.requestedByCustomerId === c.id || it.customerId === c.id
          )
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
      );
    }

    // فلتر العنوان: بيدوّر على الكلمة في أي مكان وسط العنوان (بنها ـ مسجد كذا ← يطلع لما تكتب «بنها»)
    if (addressQuery.trim()) {
      list = list.filter((c) => smartTextMatch(c.address, addressQuery));
    }

    return list;
  }, [customers, selectedOrderFilter, searchQuery, addressQuery, state.orders]);

  // Selected customer object
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  // Selected customer purchases details
  const selectedCustomerPurchases = useMemo(() => {
    if (!selectedCustomerId) return [];
    const list: Array<{
      itemId: string;
      itemName: string;
      orderCode: string;
      orderDate: string;
      soldDate: string;
      price: number;
      paid: number;
      debt: number;
      paymentType: string;
      quantity: number;
      size?: string;
      suggestedSellPrice?: number;
    }> = [];

    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (it.customerId === selectedCustomerId && it.isSold) {
          const totalSale = (it.soldPrice || 0) * (it.quantity || 1);
          const paid = it.paidAmount !== undefined ? it.paidAmount : totalSale;
          const debt = Math.max(0, totalSale - paid);
          list.push({
            itemId: it.id,
            itemName: it.name,
            orderCode: ord.code,
            orderDate: ord.date,
            soldDate: it.soldDate || ord.date,
            price: totalSale,
            paid,
            debt,
            paymentType: it.paymentType || 'cash',
            quantity: it.quantity || 1,
            size: it.size,
            suggestedSellPrice: it.suggestedSellPrice,
          });
        }
      });
    });

    return list.sort((a, b) => b.soldDate.localeCompare(a.soldDate));
  }, [selectedCustomerId, state.orders]);

  // Selected customer payments history
  const selectedCustomerPayments = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerPayments
      .filter((p) => p.customerId === selectedCustomerId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomerId, customerPayments]);

  // Selected customer notes history
  const selectedCustomerNotes = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerNotes
      .filter((n) => n.customerId === selectedCustomerId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomerId, customerNotes]);

  // Unified Account Statement (قائمة الحساب: شراء أو دفعة نقدية مرتبة الأحدث أولاً)
  const unifiedAccountStatement = useMemo(() => {
    if (!selectedCustomerId) return [];

    type StatementEntry = {
      id: string;
      date: string;
      type: 'purchase' | 'payment';
      title: string;
      price: number;
      paid: number;
      remainingDebt: number;
      notes?: string;
    };

    const list: StatementEntry[] = [];

    // Purchases
    selectedCustomerPurchases.forEach((p) => {
      list.push({
        id: 'purch_' + p.itemId,
        date: p.soldDate,
        type: 'purchase',
        title: p.itemName,
        price: p.price,
        paid: p.paid,
        remainingDebt: p.debt,
      });
    });

    // Payments
    selectedCustomerPayments.forEach((pay) => {
      list.push({
        id: pay.id,
        date: pay.date,
        type: 'payment',
        title: 'دفعة نقدية',
        price: 0,
        paid: pay.amount,
        remainingDebt: 0,
        notes: pay.notes || undefined,
      });
    });

    // Newest first
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomerId, selectedCustomerPurchases, selectedCustomerPayments]);

  const resetCustomerForm = () => {
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustSize('');
    setNewCustMessenger('');
    setNewCustNotes('');
    setNewCustDelivery('');
    setEditingCustomerId(null);
  };

  const openAddCustomerForm = () => {
    resetCustomerForm();
    setShowAddCustomerModal(true);
  };

  const openEditCustomerForm = (cust: Customer) => {
    setEditingCustomerId(cust.id);
    setNewCustName(cust.name);
    setNewCustPhone(cust.phone || '');
    setNewCustAddress(cust.address || '');
    setNewCustSize(cust.size || '');
    setNewCustMessenger(cust.messengerLink || '');
    setNewCustNotes(cust.notes || '');
    setNewCustDelivery(cust.deliveryMode || '');
    setShowAddCustomerModal(true);
  };

  const closeCustomerForm = () => {
    setShowAddCustomerModal(false);
    resetCustomerForm();
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    if (editingCustomerId) {
      // تعديل عميل موجود: القيمة الفاضية بتمسح الحقل (undefined)
      updateCustomer(editingCustomerId, {
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        size: newCustSize.trim() || undefined,
        messengerLink: newCustMessenger.trim() || undefined,
        notes: newCustNotes.trim() || undefined,
        deliveryMode: newCustDelivery || undefined,
      });
      closeCustomerForm();
      return;
    }

    const created = addCustomer(
      newCustName.trim(),
      newCustPhone.trim() || undefined,
      newCustNotes.trim() || undefined,
      {
        address: newCustAddress.trim() || undefined,
        size: newCustSize.trim() || undefined,
        messengerLink: newCustMessenger.trim() || undefined,
        deliveryMode: newCustDelivery || undefined,
      }
    );
    closeCustomerForm();
    setSelectedCustomerId(created.id);
  };

  // حذف عميل (بحماية): لو عليه دين مايتحذفش، ولو ليه طلبات/أصناف معلقة بنحذّرك الأول في مودال داخل البرنامج
  const handleDeleteCustomer = (cust: Customer) => {
    const st = customerStatsMap[cust.id] || { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };

    if (st.remainingDebt > 0.001) {
      setDeleteModal({
        customerId: cust.id,
        customerName: cust.name,
        blocked: true,
        blockedMessage: `ماينفعش تحذف "${cust.name}" لأن عليه دين ${st.remainingDebt.toLocaleString('en-US')} ${state.settings.currency}.\nحصّل الدين الأول أو سدّده، وبعدها احذف العميل.`,
      });
      return;
    }

    const pendingOrderItems = state.orders.reduce(
      (n, ord) =>
        n +
        ord.items.filter(
          (it) => !it.isSold && (it.requestedByCustomerId === cust.id || it.customerId === cust.id)
        ).length,
      0
    );
    const pendingOfficeItems = state.officeItems.filter(
      (it) => !it.isTransferredToOrder && it.customerId === cust.id
    ).length;

    const warnings: string[] = [];
    if (pendingOrderItems > 0) warnings.push(`له ${pendingOrderItems} صنف لسه ماتباعش في الأوردرات`);
    if (pendingOfficeItems > 0) warnings.push(`له ${pendingOfficeItems} صنف في بضاعة المكاتب`);
    if (st.itemsCount > 0) warnings.push('سجل مشترياته ودفعاته هيتمسح من الشاشة دي');

    setDeleteModal({
      customerId: cust.id,
      customerName: cust.name,
      blocked: false,
      warnings,
    });
  };

  const confirmDeleteCustomer = () => {
    if (!deleteModal || deleteModal.blocked) return;
    deleteCustomer(deleteModal.customerId);
    if (selectedCustomerId === deleteModal.customerId) setSelectedCustomerId(null);
    setDeleteModal(null);
  };

  // أصناف العميل اللي عليها باقي (للدفع على صنف معيّن)
  const paymentDebtItems = useMemo(() => {
    if (!paymentCustomerId) return [];
    const list: Array<{ id: string; label: string; debt: number }> = [];
    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (it.customerId === paymentCustomerId && it.isSold) {
          const total = (it.soldPrice || 0) * (it.quantity || 1);
          const paid = it.paidAmount !== undefined ? it.paidAmount : total;
          const debt = Math.max(0, total - paid);
          if (debt > 0.001) list.push({ id: it.id, label: `${it.name} (${ord.code})`, debt });
        }
      });
    });
    return list;
  }, [paymentCustomerId, state.orders]);

  const currentCollectingCustDebt = paymentCustomerId
    ? paymentItemId
      ? paymentDebtItems.find((x) => x.id === paymentItemId)?.debt || 0
      : customerStatsMap[paymentCustomerId]?.remainingDebt || 0
    : 0;
  const isPaymentOverDebt = parseFloat(paymentAmount) > currentCollectingCustDebt;

  const handleCollectPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!paymentCustomerId || !amt || amt <= 0 || amt > currentCollectingCustDebt) return;
    recordCustomerPayment(paymentCustomerId, amt, paymentDate, paymentNotes.trim() || undefined, paymentItemId || undefined);
    setPaymentItemId('');
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentCustomerId(null);
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteCustomerId || !noteText.trim()) return;
    addCustomerNote(noteCustomerId, noteText.trim(), noteDate);
    setNoteText('');
    setNoteCustomerId(null);
  };

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E] dark:text-[#F4F0FA]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج، ارتفاع 52px */}
      <div className="card-header-purple flex items-center justify-between">
        <div className="flex items-center gap-[8px] min-w-0">
          {selectedCustomer && (
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="btn-back-transparent"
              title="الرجوع لقائمة العملاء"
            >
              ➜
            </button>
          )}
          <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
            {selectedCustomer ? selectedCustomer.name : `سجل العملاء والمديونيات (${customers.length})`}
          </span>
        </div>

        <button
          onClick={openAddCustomerForm}
          className="h-[26px] px-[10px] rounded-full bg-[#2F7F5F] hover:bg-[#25664C] text-white text-[12px] font-[700] flex items-center gap-1 flex-none shadow-sm cursor-pointer"
        >
          <span className="text-[12px] leading-none">＋</span>
          <span>عميل جديد</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* VIEW A: DETAILED CUSTOMER PROFILE VIEW                    */}
      {/* ========================================================= */}
      {selectedCustomer ? (
        <div className="w-full flex flex-col gap-[13px]">
          {/* Customer Summary Card */}
          {(() => {
            const st = customerStatsMap[selectedCustomer.id] || { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
            const paidPercent = st.totalPurchases > 0 ? Math.min(100, Math.max(0, (st.totalPaid / st.totalPurchases) * 100)) : 0;

            return (
              <div className="card-main p-4 space-y-3">
                {/* الصف الأول: اسم العميل وشارة مدين / خالص الحساب */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[17px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA]">
                      {selectedCustomer.name}
                    </h3>
                    {st.remainingDebt > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8E6EC] dark:bg-[#381B26] text-[#A23B5A] dark:text-[#FB7185] font-[700]">
                        مدين
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682] font-[700]">
                        خالص الحساب
                      </span>
                    )}
                    {selectedCustomer.deliveryMode === 'delivery' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682] font-[800] border border-[#2F7F5F]/30">
                        شحن
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditCustomerForm(selectedCustomer)}
                      className="p-1.5 text-slate-400 hover:text-blue-500 transition cursor-pointer"
                      title="تعديل العميل"
                    >
                      <Icon3D name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(selectedCustomer)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                      title="حذف العميل"
                    >
                      <Icon3D name="trash" size={18} />
                    </button>
                  </div>
                </div>

                {/* سطر معلومات صغير بدون أي إيموجي */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#666079] dark:text-[#9E97B0]">
                  {selectedCustomer.address && (
                    <span>العنوان: {selectedCustomer.address}</span>
                  )}
                  {selectedCustomer.size && (
                    <span>المقاس: {selectedCustomer.size}</span>
                  )}
                  {selectedCustomer.deliveryMode && (
                    <span>التسليم: {selectedCustomer.deliveryMode === 'delivery' ? 'توصيل (شحن)' : 'استلام من البيت'}</span>
                  )}
                  <span>عميل منذ {selectedCustomer.createdAt}</span>
                </div>

                {/* زرّان بعرض متساوي: واتساب وماسنجر */}
                <div className="flex items-center gap-2">
                  <a
                    href={selectedCustomer.phone ? (getWhatsAppUrl(selectedCustomer.phone) || '#') : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!selectedCustomer.phone) {
                        e.preventDefault();
                        return;
                      }
                      openWhatsApp(e, selectedCustomer.phone);
                    }}
                    className={`flex-1 h-[36px] rounded-xl flex items-center justify-center font-[700] text-[12px] bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682] transition ${
                      !selectedCustomer.phone ? 'opacity-40 pointer-events-none' : 'hover:opacity-90'
                    }`}
                  >
                    واتساب
                  </a>
                  <a
                    href={selectedCustomer.messengerLink ? (formatMessengerUrl(selectedCustomer.messengerLink) || '#') : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 h-[36px] rounded-xl flex items-center justify-center font-[700] text-[12px] bg-[#E8F0FA] dark:bg-[#1E293B] text-[#2563EB] dark:text-[#60A5FA] transition ${
                      !selectedCustomer.messengerLink ? 'opacity-40 pointer-events-none' : 'hover:opacity-90'
                    }`}
                  >
                    ماسنجر
                  </a>
                </div>

                {/* فاصل رفيع ثم منطقة المبلغ */}
                <div className="border-t border-[#E4E1EC] dark:border-[#3A3150] pt-3">
                  {st.remainingDebt > 0 ? (
                    <div>
                      <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] block">
                        المتبقي عليه
                      </span>
                      <div className="text-[30px] font-[900] text-[#A23B5A] dark:text-[#FB7185] leading-none my-1 tabular-nums flex items-baseline gap-1">
                        <span>{st.remainingDebt.toLocaleString('en-US')}</span>
                        <span className="text-[12px] font-[700]">{state.settings.currency}</span>
                      </div>
                      <div className="w-full h-[6px] rounded-full bg-[#E4E1EC] dark:bg-[#3A3150] overflow-hidden my-2">
                        <div
                          className="h-full bg-[#2F7F5F] dark:bg-[#4BA682] rounded-full transition-all duration-300"
                          style={{ width: `${paidPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0]">
                        <span>اشترى بـ {st.totalPurchases.toLocaleString('en-US')} {state.settings.currency}</span>
                        <span>دفع {st.totalPaid.toLocaleString('en-US')} {state.settings.currency}</span>
                      </div>
                    </div>
                  ) : st.totalPurchases > 0 ? (
                    <div>
                      <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] block">
                        الحساب
                      </span>
                      <div className="text-[24px] font-[900] text-[#2F7F5F] dark:text-[#4BA682] leading-tight my-1">
                        خالص
                      </div>
                      <div className="text-[12px] text-[#666079] dark:text-[#9E97B0]">
                        إجمالي المشتريات {st.totalPurchases.toLocaleString('en-US')} {state.settings.currency}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] block">
                        لا توجد مشتريات بعد
                      </span>
                      <div className="text-[20px] font-[900] text-[#2F7F5F] dark:text-[#4BA682] leading-tight my-1 tabular-nums">
                        0 {state.settings.currency}
                      </div>
                    </div>
                  )}
                </div>

                {/* صف الأزرار */}
                <div className="flex items-center gap-2 pt-1">
                  {st.remainingDebt > 0 && (
                    <button
                      onClick={() => {
                        setPaymentCustomerId(selectedCustomer.id);
                        setPaymentItemId('');
                        setPaymentAmount(st.remainingDebt > 0 ? st.remainingDebt.toString() : '');
                        setPaymentDate(new Date().toISOString().split('T')[0]);
                        setPaymentNotes('');
                      }}
                      className="flex-1 h-[40px] px-4 rounded-full bg-[#2F7F5F] hover:bg-[#25664C] text-white text-[13px] font-[800] flex items-center justify-center cursor-pointer transition shadow-xs"
                    >
                      تحصيل دفعة
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setNoteCustomerId(selectedCustomer.id);
                      setNoteText('');
                      setNoteDate(new Date().toISOString().split('T')[0]);
                    }}
                    className={`${
                      st.remainingDebt > 0 ? 'px-4' : 'w-full'
                    } h-[40px] rounded-full bg-[#F5F4F9] dark:bg-[#1A1424] text-[13px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] flex items-center justify-center cursor-pointer hover:bg-[#EBE9F2] dark:hover:bg-[#251D33] transition`}
                  >
                    + ملاحظة
                  </button>
                </div>
              </div>
            );
          })()}

          {/* كارت طلبات لم تُسلَّم (بند 3-ب) */}
          <div className="card-main p-4 space-y-2.5">
            <h4 className="text-[13px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA]">
              طلبات لم تُسلَّم ({undeliveredItems.length})
            </h4>
            {undeliveredItems.length === 0 ? (
              <p className="text-[11px] text-[#666079] dark:text-[#9E97B0]">
                لا توجد طلبات معلقة لم تُسلَّم لهذا العميل.
              </p>
            ) : (
              <div className="divide-y divide-[#E4E1EC] dark:divide-[#3A3150]">
                {undeliveredItems.map((item) => (
                  <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-[12px] gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] truncate">
                        {item.itemName}
                        {item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        {item.size ? ` (مقاس ${item.size})` : ''}
                      </span>
                      {item.suggestedSellPrice ? (
                        <span className="text-[10px] font-bold text-[#2F7F5F] dark:text-[#4BA682] shrink-0">
                          بيع {item.suggestedSellPrice}
                        </span>
                      ) : null}
                    </div>
                    <span className="font-[600] text-[#666079] dark:text-[#9E97B0] shrink-0">{item.orderCode}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub Navigation Bar for Customer Details (2 tabs only) */}
          <div className="flex items-center gap-1.5 p-1 rounded-full card-main">
            {[
              { id: 'statement', label: `الأصناف (${selectedCustomerPurchases.length})` },
              { id: 'payments', label: `الدفعات (${selectedCustomerPayments.length})` },
              { id: 'notes', label: `ملاحظات (${selectedCustomerNotes.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCustomerTab(tab.id as 'statement' | 'payments' | 'notes')}
                className={`flex-1 py-1.5 px-3 rounded-full text-[12px] font-[700] text-center whitespace-nowrap transition cursor-pointer ${
                  activeCustomerTab === tab.id
                    ? 'bg-[#5F2967] text-white shadow-xs'
                    : 'text-[#666079] dark:text-[#9E97B0]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* (1) TAB: الأصناف - كارت لكل صنف: السعر / المدفوع / الباقي */}
          {activeCustomerTab === 'statement' && (
            <div className="space-y-2.5">
              {selectedCustomerPurchases.length === 0 ? (
                <div className="card-main p-4 text-center py-8 space-y-1">
                  <p className="text-[13px] font-[700] text-[#666079] dark:text-[#9E97B0]">لا توجد أصناف بعد.</p>
                  <p className="text-[11px] text-[#666079]/80 dark:text-[#9E97B0]/80">
                    أي صنف يتباع للعميل (آجل أو جزئي) من الأوردرات أو البيع السريع هيظهر هنا.
                  </p>
                </div>
              ) : (
                selectedCustomerPurchases.map((p) => {
                  const itemPayments = selectedCustomerPayments.flatMap((pay) =>
                    pay.kind === 'refund'
                      ? []
                      : (pay.allocations || [])
                          .filter((a) => a.itemId === p.itemId)
                          .map((a) => ({ id: pay.id, date: pay.date, amount: a.amount }))
                  );
                  const done = p.debt <= 0.001;
                  return (
                    <div
                      key={p.itemId}
                      className={`card-main p-3.5 space-y-2 ${done ? '' : 'border-[1.5px] border-[#E6B93F]'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] block truncate">
                            {p.itemName}
                            <span className="text-[12px] font-bold text-[#666079] dark:text-[#9E97B0] mx-1">
                              (الكمية: {p.quantity || 1})
                            </span>
                            {p.size ? ` - مقاس ${p.size}` : ''}
                          </span>
                          <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] block mt-0.5">
                            {p.orderCode} • تاريخ الشراء: {p.soldDate}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-[800] shrink-0 ${
                            done
                              ? 'bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682]'
                              : 'bg-[#FFF1C7] dark:bg-[#3A2E0E] text-[#7A4A00] dark:text-[#FDE68A]'
                          }`}
                        >
                          {done ? 'خالص' : 'لسه'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-center text-[11px] font-[700]">
                        <div>
                          <span className="block text-[10px] text-[#666079] dark:text-[#9E97B0] font-[600]">السعر</span>
                          <span className="tabular-nums text-[#1F1A2E] dark:text-[#F4F0FA]">{p.price.toLocaleString('en-US')}</span>
                          {p.suggestedSellPrice !== undefined && (p.suggestedSellPrice * (p.quantity || 1)) !== p.price && (
                            <span className="block text-[9px] text-[#9A98B0] font-normal">
                              (مقترح: {(p.suggestedSellPrice * (p.quantity || 1)).toLocaleString('en-US')})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#666079] dark:text-[#9E97B0] font-[600]">دفعت</span>
                          <span className="tabular-nums text-[#2F7F5F] dark:text-[#4BA682]">{p.paid.toLocaleString('en-US')}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#666079] dark:text-[#9E97B0] font-[600]">الباقي</span>
                          <span className={`tabular-nums ${done ? 'text-[#2F7F5F] dark:text-[#4BA682]' : 'text-[#A23B5A] dark:text-[#FB7185]'}`}>
                            {p.debt.toLocaleString('en-US')}
                          </span>
                        </div>
                      </div>

                      {itemPayments.length > 0 && (
                        <div className="border-t border-[#E4E1EC] dark:border-[#3A3150] pt-1.5 space-y-0.5">
                          {itemPayments.map((ip, idx) => (
                            <div key={ip.id + idx} className="flex items-center justify-between text-[11px] text-[#666079] dark:text-[#9E97B0]">
                              <span>{ip.date}</span>
                              <span className="tabular-nums font-[700] text-[#2F7F5F] dark:text-[#4BA682]">
                                +{ip.amount.toLocaleString('en-US')} {state.settings.currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* (1-ب) TAB: الدفعات */}
          {activeCustomerTab === 'payments' && (
            <div className="card-main p-4">
              {selectedCustomerPayments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] font-[700] text-[#666079] dark:text-[#9E97B0]">لا توجد دفعات.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E4E1EC] dark:divide-[#3A3150]">
                  {selectedCustomerPayments.map((pay) => {
                    const isRefund = pay.kind === 'refund';
                    const itemNames = (pay.allocations || [])
                      .map((a) => {
                        const ord = state.orders.find((o) => o.id === a.orderId);
                        const it = ord?.items.find((i) => i.id === a.itemId);
                        return it ? it.name : null;
                      })
                      .filter(Boolean)
                      .join('، ');
                    return (
                      <div key={pay.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className={`text-[14px] font-[800] tabular-nums block ${isRefund ? 'text-[#A23B5A] dark:text-[#FB7185]' : 'text-[#2F7F5F] dark:text-[#4BA682]'}`}>
                            {isRefund ? '-' : '+'}{pay.amount.toLocaleString('en-US')} {state.settings.currency}
                            <span className="text-[11px] font-[700] text-[#666079] dark:text-[#9E97B0] mr-1.5">
                              {isRefund ? 'استرداد' : 'دفعة'}
                            </span>
                          </span>
                          <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] block mt-0.5">
                            {pay.date}
                            {itemNames ? ` • ${itemNames}` : ''}
                            {pay.notes ? ` • ${pay.notes}` : ''}
                          </span>
                        </div>
                        {!isRefund && pay.allocations && pay.allocations.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`إلغاء دفعة ${pay.amount} ${state.settings.currency}؟ الدين هيرجع على العميل والأرباح المرتبطة بيها هتتعكس.`)) {
                                cancelCustomerPayment(pay.id);
                              }
                            }}
                            className="text-[11px] font-[700] text-[#A23B5A] dark:text-[#FB7185] hover:underline cursor-pointer shrink-0"
                          >
                            إلغاء
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* (2) TAB: ملاحظات */}
          {activeCustomerTab === 'notes' && (
            <div className="card-main p-4">
              {selectedCustomerNotes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] font-[700] text-[#666079] dark:text-[#9E97B0]">
                    لا توجد ملاحظات.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E4E1EC] dark:divide-[#3A3150]">
                  {selectedCustomerNotes.map((n) => (
                    <div
                      key={n.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-[#666079] dark:text-[#9E97B0] block">
                          {n.date}
                        </span>
                        <p className="text-[13px] font-[600] text-[#1F1A2E] dark:text-[#F4F0FA] mt-1 leading-relaxed">
                          {n.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCustomerNote(n.id)}
                        className="text-[11px] font-[700] text-[#A23B5A] dark:text-[#FB7185] hover:underline cursor-pointer shrink-0 pt-0.5"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW B: ALL CUSTOMERS LIST                                */
        /* ========================================================= */
        <div className="w-full flex flex-col gap-[13px]">
          {/* Overall Debt Summary Box: Solid Teal Hero Card */}
          <div className="w-full h-[92px] card-hero-teal relative px-[15px] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-[600] text-white/85 leading-none mb-[6px] block">
                إجمالي ديون العملاء المطلوبة
              </span>
              <div className="flex items-baseline gap-[8px]">
                <span className="text-[30px] font-[900] leading-none text-white tabular-nums">
                  {overallTotals.debt.toLocaleString('en-US')}
                </span>
                <span className="text-[13px] font-[700] text-white/85 leading-none">
                  {state.settings.currency}
                </span>
              </div>
            </div>
            <div className="text-left text-[12px] font-[700] text-white/90 space-y-1 shrink-0">
              <div>المشتريات: {overallTotals.purchases.toLocaleString('en-US')}</div>
              <div>المحصّل: {overallTotals.paid.toLocaleString('en-US')}</div>
            </div>
          </div>

          {/* Search Bar + Order Filter: Capsule 34px, font 12px, borderless, card-main shadow */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-[34px] rounded-full card-main px-3 flex items-center gap-2">
              <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
                <Icon3D name="search" size={15} />
              </div>
              <input
                type="text"
                placeholder="بحث باسم العميل أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-[12px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] placeholder:text-[#666079] dark:placeholder:text-[#9E97B0]"
              />
            </div>
            <div className="h-[34px] rounded-full card-main px-3 flex items-center shrink-0">
              <select
                value={selectedOrderFilter}
                onChange={(e) => setSelectedOrderFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-[12px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-[#231A2C] text-[#1F1A2E] dark:text-[#F4F0FA]">كل الأوردرات</option>
                {state.orders.map((o) => (
                  <option key={o.id} value={o.id} className="bg-white dark:bg-[#231A2C] text-[#1F1A2E] dark:text-[#F4F0FA]">
                    {o.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* فلتر العنوان: بحث ذكي وسط الكلام (بنها ← بنها ـ مسجد كذا) */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-[34px] rounded-full card-main px-3 flex items-center gap-2">
              <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
                <Icon3D name="search" size={15} />
              </div>
              <input
                type="text"
                placeholder="فلتر بالعنوان (مثال: بنها)..."
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-[12px] font-[700] text-[#1F1A2E] dark:text-[#F4F0FA] placeholder:text-[#666079] dark:placeholder:text-[#9E97B0]"
              />
              {addressQuery && (
                <button
                  type="button"
                  onClick={() => setAddressQuery('')}
                  className="text-[#9A98B0] hover:text-[#2B2340] shrink-0 cursor-pointer"
                  title="مسح الفلتر"
                >
                  <Icon3D name="close" size={14} />
                </button>
              )}
            </div>
            {addressQuery.trim() && (
              <span className="text-[11px] font-[700] text-[#5F2967] dark:text-[#D8B4FE] shrink-0">
                {filteredCustomers.length} عميل
              </span>
            )}
          </div>

          {/* Customers Cards List */}
          {filteredCustomers.length === 0 ? (
            <div className="py-8 text-center border-[1.5px] border-dashed border-[#D4D0E0] dark:border-[#3A3150] rounded-[14px] bg-white dark:bg-[#211A2D] p-5 text-[12px] font-[600] text-[#666079] dark:text-[#9E97B0]">
              {selectedOrderFilter !== 'all'
                ? 'لا يوجد عملاء مرتبطين بهذا الأوردر.'
                : addressQuery.trim() || searchQuery.trim()
                ? 'مفيش عملاء مطابقين للبحث.'
                : 'لا يوجد عملاء مسجلين حالياً. اضغط "عميل جديد" لإضافة أول عميل.'}
            </div>
          ) : (
            <div className="w-full flex flex-col gap-[13px]">
              {filteredCustomers.map((cust) => {
                const st = customerStatsMap[cust.id] || { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
                const targetOrder = selectedOrderFilter !== 'all' ? state.orders.find((o) => o.id === selectedOrderFilter) : null;
                const custOrderItems = targetOrder ? targetOrder.items.filter((it) => it.requestedByCustomerId === cust.id || it.customerId === cust.id) : [];

                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className="card-main p-3.5 cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                          <Icon3D name="customers" size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="text-[14px] font-[800] text-[#1F1A2E] dark:text-[#F4F0FA] truncate leading-tight">
                              {cust.name}
                            </h4>
                            {cust.deliveryMode === 'delivery' && (
                              <span className="text-[9px] px-1.5 py-[1px] rounded-md bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] dark:text-[#4BA682] font-[800] shrink-0">
                                شحن
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] block truncate leading-tight mt-0.5">
                            {cust.phone ? `الهاتف: ${cust.phone}` : 'بدون هاتف'} {!targetOrder && `• ${st.itemsCount} صنف مشتريات`}
                          </span>
                          {cust.address && !targetOrder && (
                            <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] block truncate leading-tight mt-0.5">
                              العنوان: {cust.address}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditCustomerForm(cust)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 transition cursor-pointer"
                          title="تعديل العميل"
                        >
                          <Icon3D name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(cust)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          title="حذف العميل"
                        >
                          <Icon3D name="trash" size={16} />
                        </button>
                      </div>

                      {!targetOrder && (
                        <div className="text-left shrink-0">
                          <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] block leading-tight">الدين المتبقي:</span>
                          <strong className={`text-[14px] font-[800] tabular-nums leading-tight ${st.remainingDebt > 0 ? 'text-[#A23B5A] dark:text-[#FB7185]' : 'text-[#2F7F5F] dark:text-[#4BA682]'}`}>
                            {st.remainingDebt > 0 ? `${st.remainingDebt.toLocaleString('en-US')} ${state.settings.currency}` : 'خالص'}
                          </strong>
                        </div>
                      )}
                    </div>

                    {targetOrder ? (
                      <div className="space-y-1 text-[11px] font-[600] pt-1.5 border-t border-[#E4E1EC] dark:border-[#3A3150] text-[#666079] dark:text-[#9E97B0]">
                        <div>العنوان: <strong className="text-[#1F1A2E] dark:text-[#F4F0FA] font-[700]">{cust.address || 'بدون عنوان'}</strong></div>
                        {cust.notes && <div>الملاحظات: <span className="text-[#1F1A2E] dark:text-[#F4F0FA]">{cust.notes}</span></div>}
                        <div>
                          أصناف الأوردر: <strong className="text-[#5F2967] dark:text-[#D8B4FE] font-[700]">{custOrderItems.map((i) => i.name).join('، ')}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-[600] pt-1.5 border-t border-[#E4E1EC] dark:border-[#3A3150]">
                        <span className="text-[#666079] dark:text-[#9E97B0]">
                          إجمالي الشراء: <strong className="text-[#1F1A2E] dark:text-[#F4F0FA] font-[700] tabular-nums">{st.totalPurchases.toLocaleString('en-US')}</strong>
                        </span>
                        <span className="text-[#2F7F5F] dark:text-[#4BA682] text-left">
                          المسدد: <strong className="font-[700] tabular-nums">{st.totalPaid.toLocaleString('en-US')}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Add New Customer */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddCustomerSubmit}
            className="w-full max-w-xs bg-white dark:bg-[#231A2C] rounded-3xl p-5 border border-[#ECECF4] dark:border-[#32263F] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4] dark:border-[#32263F]">
              <h3 className="font-extrabold text-sm text-[#2B2340] dark:text-white">
                {editingCustomerId ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h3>
              <button
                type="button"
                onClick={closeCustomerForm}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">اسم العميل *</label>
              <input
                type="text"
                required
                autoFocus
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">العنوان</label>
              <input
                type="text"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">المقاس</label>
              <input
                type="text"
                value={newCustSize}
                onChange={(e) => setNewCustSize(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">لينك الماسنجر</label>
              <input
                type="text"
                value={newCustMessenger}
                onChange={(e) => setNewCustMessenger(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">التسليم</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'delivery', label: 'توصيل (شحن)' },
                  { id: 'pickup', label: 'استلام من البيت' },
                ] as Array<{ id: DeliveryMode; label: string }>).map((opt) => {
                  const active = newCustDelivery === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewCustDelivery(active ? '' : opt.id)}
                      className={`py-2 rounded-xl border font-bold text-[12px] cursor-pointer transition ${
                        active
                          ? opt.id === 'delivery'
                            ? 'bg-[#E3F2EA] dark:bg-[#162E23] border-[#2F7F5F] text-[#2F7F5F] dark:text-[#4BA682]'
                            : 'bg-[#F1E8F4] dark:bg-[#2D1F35] border-[#5F2967] text-[#5F2967] dark:text-[#D8B4FE]'
                          : 'bg-[#F1F1FA] dark:bg-[#17101D] border-[#ECECF4] dark:border-[#32263F] text-[#666079] dark:text-[#9E97B0]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">ملاحظات</label>
              <input
                type="text"
                value={newCustNotes}
                onChange={(e) => setNewCustNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                {editingCustomerId ? 'حفظ التعديل' : 'إضافة العميل'}
              </button>
              <button
                type="button"
                onClick={closeCustomerForm}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Collect Payment (تحصيل دفعة) */}
      {paymentCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCollectPaymentSubmit}
            className="w-full max-w-xs bg-white dark:bg-[#231A2C] rounded-3xl p-5 border border-[#ECECF4] dark:border-[#32263F] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4] dark:border-[#32263F]">
              <h3 className="font-extrabold text-sm text-[#2FA36B] flex items-center gap-1.5">
                <Icon3D name="money_in" size={20} />
                تحصيل دفعة نقدية
              </h3>
              <button
                type="button"
                onClick={() => setPaymentCustomerId(null)}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">الدفعة على أنهي صنف؟</label>
              <select
                value={paymentItemId}
                onChange={(e) => {
                  const v = e.target.value;
                  setPaymentItemId(v);
                  const d = v
                    ? paymentDebtItems.find((x) => x.id === v)?.debt || 0
                    : paymentCustomerId
                    ? customerStatsMap[paymentCustomerId]?.remainingDebt || 0
                    : 0;
                  setPaymentAmount(d > 0 ? d.toString() : '');
                }}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] font-bold outline-none"
              >
                <option value="">الأقدم أول (تلقائي)</option>
                {paymentDebtItems.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label} - باقي {x.debt.toLocaleString('en-US')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-[#2B2340] dark:text-white">المبلغ المحصل *</label>
                <span className="text-[11px] font-[700] text-[#666079] dark:text-[#9E97B0]">
                  المتبقي: <strong className="text-[#A23B5A] dark:text-[#FB7185] tabular-nums">{currentCollectingCustDebt.toLocaleString('en-US')} {state.settings.currency}</strong>
                </span>
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                max={currentCollectingCustDebt}
                required
                autoFocus
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border ${
                  isPaymentOverDebt
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                    : 'border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D]'
                } font-black text-center text-base outline-none focus:border-[#2FA36B]`}
              />
              {isPaymentOverDebt && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1">
                  المبلغ يتجاوز إجمالي الدين المتبقي للعميل ({currentCollectingCustDebt.toLocaleString('en-US')} {state.settings.currency})
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">تاريخ التحصيل</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">ملاحظة</label>
              <input
                type="text"
                placeholder="طريقة التحصيل، ملاحظات..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <p className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-xl">
              * لو ما اخترتيش صنف، الدفعة بتنزل على أقدم صنف عليه باقي وبعده اللي بعده. وتقدري تلغيها بعد كده من تبويب "الدفعات".
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || isPaymentOverDebt}
                className="flex-1 py-2.5 rounded-xl bg-[#2FA36B] hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                تأكيد التحصيل
              </button>
              <button
                type="button"
                onClick={() => setPaymentCustomerId(null)}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Add Date-Stamped Note */}
      {noteCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddNoteSubmit}
            className="w-full max-w-xs bg-white dark:bg-[#231A2C] rounded-3xl p-5 border border-[#ECECF4] dark:border-[#32263F] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4] dark:border-[#32263F]">
              <h3 className="font-extrabold text-sm text-[#5F2967] dark:text-[#9B67A4]">
                إضافة ملاحظة بتاريخ
              </h3>
              <button
                type="button"
                onClick={() => setNoteCustomerId(null)}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">التاريخ</label>
              <input
                type="date"
                required
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">الملاحظة *</label>
              <textarea
                required
                rows={3}
                placeholder="مثال: وعد بدفع 500 يوم الأحد..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-[#5F2967] text-white font-bold text-xs cursor-pointer hover:bg-[#4A1E52]"
              >
                حفظ الملاحظة
              </button>
              <button
                type="button"
                onClick={() => setNoteCustomerId(null)}
                className="px-4 py-2 rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* مودال تأكيد حذف العميل (يعمل داخل iframe وبيئة المعاينة) */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#231A2C] rounded-3xl p-5 border border-[#ECECF4] dark:border-[#32263F] space-y-3.5 text-right shadow-2xl text-xs">
            <div className="flex items-center gap-2 text-[#E2574C]">
              <Icon3D name="danger" size={22} />
              <h3 className="font-extrabold text-sm text-[#2B2340] dark:text-white">
                {deleteModal.blocked ? 'لا يمكن حذف العميل' : `حذف العميل "${deleteModal.customerName}"`}
              </h3>
            </div>

            {deleteModal.blocked ? (
              <>
                <p className="text-[12px] text-[#2B2340] dark:text-[#F2EEF7] leading-relaxed whitespace-pre-line">
                  {deleteModal.blockedMessage}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModal(null)}
                    className="w-full h-[38px] rounded-xl bg-[#5F2967] hover:bg-[#4C1F53] text-white font-bold text-xs flex items-center justify-center transition cursor-pointer active:scale-95 shadow-sm"
                  >
                    حسناً
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12px] text-[#2B2340] dark:text-[#F2EEF7] font-bold">
                  هتحذف العميل "{deleteModal.customerName}" نهائياً. متأكد؟
                </p>

                {deleteModal.warnings && deleteModal.warnings.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[#FFF5F5] dark:bg-[#2E181D] border border-[#FED7D7] dark:border-[#522329] space-y-1 text-[11px] text-[#C53030] dark:text-[#FEB2B2]">
                    <span className="font-extrabold block mb-1">انتبه:</span>
                    {deleteModal.warnings.map((w, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={confirmDeleteCustomer}
                    className="flex-1 h-[38px] rounded-xl bg-[#E2574C] hover:bg-[#C94237] text-white font-bold text-xs flex items-center justify-center transition cursor-pointer active:scale-95 shadow-sm"
                  >
                    تأكيد الحذف
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModal(null)}
                    className="flex-1 h-[38px] rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-[#666079] dark:text-[#9E97B0] font-bold text-xs flex items-center justify-center transition cursor-pointer active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
