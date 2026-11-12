/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { OfficeItem, DeliveryMode } from '../types';
import { Icon3D } from '../components/icons3d/Icon3D';
import { DeliveryChoice } from '../components/DeliveryChoice';
import { getWhatsAppUrl, openWhatsApp, formatMessengerUrl, getTelUrl } from '../utils/contact';
import { SwipeRow } from '../components/SwipeRow';

const OFFICE_COLORS = ['#8A4B90', '#2E8C69', '#C99A2E', '#3B9AC4', '#B8405E', '#2E8A82', '#6B5BD2', '#D9772B'];

const getOfficeColor = (name: string): string => {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return OFFICE_COLORS[Math.abs(sum) % OFFICE_COLORS.length];
};

const formatItemsCount = (count: number): string => {
  if (count === 1) return 'قطعة واحدة';
  if (count === 2) return 'قطعتان';
  if (count >= 3 && count <= 10) return `${count} قطع`;
  return `${count} قطعة`;
};

export const OfficesPage: React.FC = () => {
  const {
    state,
    deleteOfficeItem,
    updateOfficeItem,
    addOfficeItem,
    createOrderFromOfficeItems,
    moveRegisteredOffice,
    updateSettings,
    setCurrentPage,
    customers,
  } = useApp();

  // القسم النشط: الشراء (الافتراضي) أو التوصيل أو الاستلام
  const [activeSection, setActiveSection] = useState<'buying' | 'delivery' | 'pickup'>('buying');

  // حالة فتح/طي كروت المكاتب في قسم الشراء (مطوية افتراضياً)
  const [openOffices, setOpenOffices] = useState<Record<string, boolean>>({});
  const toggleOfficeOpen = (officeName: string) => {
    setOpenOffices((prev) => ({ ...prev, [officeName]: !prev[officeName] }));
  };

  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [customOrderCode, setCustomOrderCode] = useState('');
  const [orderCreatedMsg, setOrderCreatedMsg] = useState<string | null>(null);

  // Registered offices from settings
  const registeredOffices = state.settings.registeredOffices && state.settings.registeredOffices.length > 0
    ? state.settings.registeredOffices
    : ['مكتب النزهة', 'مكتب وسط البلد', 'مكتب العتبة'];

  // Add / Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formOfficeName, setFormOfficeName] = useState(registeredOffices[0] || '');
  const [formItemName, setFormItemName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerAddress, setFormCustomerAddress] = useState('');
  const [formCustomerSize, setFormCustomerSize] = useState('');
  const [formMessengerLink, setFormMessengerLink] = useState('');
  const [formDelivery, setFormDelivery] = useState<DeliveryMode | ''>('');
  const [formNotes, setFormNotes] = useState('');
  const [formGuideSellPrice, setFormGuideSellPrice] = useState('');
  const [formDeliveryFee, setFormDeliveryFee] = useState('');

  // وضع العميل في النموذج: عميلة جديدة (افتراضي) أو عميلة مسجلة
  const [customerFormMode, setCustomerFormMode] = useState<'new' | 'registered'>('new');
  const [selectedRegisteredCustomerId, setSelectedRegisteredCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

const normalizePhoneForComparison = (phone?: string): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0020')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('20') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
};

  // بيانات التواصل الفعلية للصنف: بيانات العميل المسجّل أولاً
  const resolveContact = (item: OfficeItem) => {
    let cust = item.customerId ? customers.find((c) => c.id === item.customerId) : undefined;
    if (!cust && item.customerPhone) {
      const norm = normalizePhoneForComparison(item.customerPhone);
      if (norm && norm.length >= 7) {
        cust = customers.find((c) => normalizePhoneForComparison(c.phone) === norm);
      }
    }
    if (!cust && item.customerName) {
      cust = customers.find((c) => c.name.trim().toLowerCase() === item.customerName?.trim().toLowerCase());
    }
    return {
      customer: cust,
      phone: cust?.phone || item.customerPhone,
      address: cust?.address || item.customerAddress,
      messenger: cust?.messengerLink || item.messengerLink || item.contactUrl,
      delivery: cust?.deliveryMode,
      customerNotes: cust?.notes,
    };
  };

  // Active items (excluding transferred ones)
  const activeOfficeItems = state.officeItems.filter((i) => !i.isTransferredToOrder);

  // Filter active items for buying section
  const filteredActiveItems = activeOfficeItems.filter((item) => {
    const matchOffice = selectedOffice === 'all' || item.officeName === selectedOffice;
    const matchQuery =
      searchQuery === '' ||
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.officeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.customerName && item.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchOffice && matchQuery;
  });

  // تجميع أصناف الشراء حسب المكاتب (بترتيب registeredOffices)
  const buyingOfficeGroups = useMemo(() => {
    const groups: { officeName: string; isRegistered: boolean; items: OfficeItem[]; totalCost: number }[] = [];
    const processedOffices = new Set<string>();

    registeredOffices.forEach((offName) => {
      processedOffices.add(offName);
      const items = filteredActiveItems.filter((it) => it.officeName === offName);
      // المكاتب التي ليس فيها أصناف نشطة لا تظهر (إلا عند اختيارها صراحة في الفلتر)
      if (items.length > 0 || (selectedOffice !== 'all' && selectedOffice === offName)) {
        const totalCost = items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
        groups.push({
          officeName: offName,
          isRegistered: true,
          items,
          totalCost,
        });
      }
    });

    // أي أصناف مكاتب قديمة غير مسجلة في registeredOffices تظهر في النهاية دون حذفها
    const unregisteredOffices = Array.from(
      new Set(
        filteredActiveItems
          .map((it) => it.officeName)
          .filter((name) => !processedOffices.has(name))
      )
    );

    unregisteredOffices.forEach((offName) => {
      const items = filteredActiveItems.filter((it) => it.officeName === offName);
      if (items.length > 0) {
        const totalCost = items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
        groups.push({
          officeName: offName,
          isRegistered: false,
          items,
          totalCost,
        });
      }
    });

    return groups;
  }, [filteredActiveItems, registeredOffices, selectedOffice]);

  // تجميع أصناف التوصيل حسب العميلة
  interface DeliveryCustomerGroup {
    key: string;
    customerId?: string;
    customerName: string;
    phone?: string;
    address?: string;
    messenger?: string;
    delivery?: DeliveryMode;
    customerNotes?: string;
    items: OfficeItem[];
  }

  const deliveryGroups: DeliveryCustomerGroup[] = useMemo(() => {
    const map = new Map<string, DeliveryCustomerGroup>();

    activeOfficeItems.forEach((item) => {
      // الأصناف التي بلا عميلة أصلاً لا تظهر في التوصيل
      const hasCustomer = !!(item.customerId || (item.customerName && item.customerName.trim()));
      if (!hasCustomer) return;

      const contact = resolveContact(item);
      // العميلة تظهر في قسم «التوصيل» فقط إذا كان وضع التسليم الفعلي لها «توصيل (شحن)»
      if (contact.delivery !== 'delivery') return;

      const cust = contact.customer;
      const cName = cust?.name || item.customerName?.trim() || '';

      let key: string;
      if (item.customerId) {
        key = `cust_${item.customerId}`;
      } else if (cust) {
        key = `cust_${cust.id}`;
      } else {
        key = `legacy_${cName}_${contact.phone || ''}`;
      }

      if (!map.has(key)) {
        map.set(key, {
          key,
          customerId: item.customerId || cust?.id,
          customerName: cName,
          phone: contact.phone,
          address: contact.address,
          messenger: contact.messenger,
          delivery: contact.delivery,
          customerNotes: contact.customerNotes,
          items: [],
        });
      }

      map.get(key)!.items.push(item);
    });

    const all = Array.from(map.values());
    if (!searchQuery.trim()) return all;

    const q = searchQuery.toLowerCase().trim();
    return all.filter((g) =>
      g.customerName.toLowerCase().includes(q) ||
      (g.phone && g.phone.includes(q)) ||
      g.items.some((it) => it.itemName.toLowerCase().includes(q))
    );
  }, [activeOfficeItems, customers, searchQuery]);

  // تجميع أصناف الاستلام حسب العميلة (deliveryMode === 'pickup')
  const pickupGroups: DeliveryCustomerGroup[] = useMemo(() => {
    const map = new Map<string, DeliveryCustomerGroup>();

    activeOfficeItems.forEach((item) => {
      // الأصناف التي بلا عميلة أصلاً لا تظهر في الاستلام
      const hasCustomer = !!(item.customerId || (item.customerName && item.customerName.trim()));
      if (!hasCustomer) return;

      const contact = resolveContact(item);
      // العميلة تظهر في قسم «الاستلام» فقط إذا كان وضع التسليم الفعلي لها «استلام من البيت»
      if (contact.delivery !== 'pickup') return;

      const cust = contact.customer;
      const cName = cust?.name || item.customerName?.trim() || '';

      let key: string;
      if (item.customerId) {
        key = `cust_${item.customerId}`;
      } else if (cust) {
        key = `cust_${cust.id}`;
      } else {
        key = `legacy_${cName}_${contact.phone || ''}`;
      }

      if (!map.has(key)) {
        map.set(key, {
          key,
          customerId: item.customerId || cust?.id,
          customerName: cName,
          phone: contact.phone,
          address: contact.address,
          messenger: contact.messenger,
          delivery: contact.delivery,
          customerNotes: contact.customerNotes,
          items: [],
        });
      }

      map.get(key)!.items.push(item);
    });

    const all = Array.from(map.values());
    if (!searchQuery.trim()) return all;

    const q = searchQuery.toLowerCase().trim();
    return all.filter((g) =>
      g.customerName.toLowerCase().includes(q) ||
      (g.phone && g.phone.includes(q)) ||
      g.items.some((it) => it.itemName.toLowerCase().includes(q))
    );
  }, [activeOfficeItems, customers, searchQuery]);

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllAvailable = () => {
    if (selectedItemIds.length === filteredActiveItems.length && filteredActiveItems.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredActiveItems.map((i) => i.id));
    }
  };

  const openAddForm = () => {
    setEditingItemId(null);
    setFormOfficeName(registeredOffices[0] || '');
    setFormItemName('');
    setFormQuantity('1');
    setFormCostPrice('');
    setFormGuideSellPrice('');
    setFormDeliveryFee('');
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerAddress('');
    setFormCustomerSize('');
    setFormMessengerLink('');
    setFormDelivery('');
    setFormNotes('');
    setCustomerFormMode('new');
    setSelectedRegisteredCustomerId('');
    setCustomerSearchTerm('');
    setShowForm(true);
  };

  const openEditForm = (item: OfficeItem) => {
    const contact = resolveContact(item);
    setEditingItemId(item.id);
    setFormOfficeName(item.officeName);
    setFormItemName(item.itemName);
    setFormQuantity(item.quantity.toString());
    setFormCostPrice(item.costPrice.toString());
    setFormGuideSellPrice(item.guideSellPrice !== undefined ? item.guideSellPrice.toString() : '');
    setFormDeliveryFee(item.deliveryFee !== undefined ? item.deliveryFee.toString() : '');
    setFormCustomerName(item.customerName || '');
    setFormCustomerPhone(contact.phone || '');
    setFormCustomerAddress(contact.address || '');
    setFormCustomerSize(item.customerSize || '');
    setFormMessengerLink(contact.messenger || '');
    setFormDelivery(contact.delivery || '');
    setFormNotes(item.notes || '');

    if (item.customerId) {
      setCustomerFormMode('registered');
      setSelectedRegisteredCustomerId(item.customerId);
    } else {
      setCustomerFormMode('new');
      setSelectedRegisteredCustomerId('');
    }
    setCustomerSearchTerm('');
    setShowForm(true);
  };

  const handleSelectRegisteredCustomer = (cust: typeof customers[0]) => {
    setSelectedRegisteredCustomerId(cust.id);
    setFormCustomerName(cust.name);
    setFormCustomerPhone(cust.phone || '');
    setFormCustomerAddress(cust.address || '');
    setFormCustomerSize(cust.size || '');
    setFormMessengerLink(cust.messengerLink || '');
    setFormDelivery(cust.deliveryMode || '');
    setCustomerSearchTerm('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOfficeName || !formItemName.trim() || !formCostPrice) return;

    const isReg = customerFormMode === 'registered' && selectedRegisteredCustomerId;
    const finalCustomerId = isReg ? selectedRegisteredCustomerId : undefined;

    const itemData = {
      officeName: formOfficeName,
      itemName: formItemName.trim(),
      quantity: parseInt(formQuantity) || 1,
      costPrice: parseFloat(formCostPrice) || 0,
      guideSellPrice: formGuideSellPrice.trim() ? parseFloat(formGuideSellPrice) : undefined,
      deliveryFee: (formDelivery === 'delivery' && formDeliveryFee.trim()) ? parseFloat(formDeliveryFee) : undefined,
      customerName: formCustomerName.trim() || undefined,
      customerPhone: formCustomerPhone.trim() || undefined,
      customerAddress: formCustomerAddress.trim() || undefined,
      customerSize: formCustomerSize.trim() || undefined,
      messengerLink: formMessengerLink.trim() || undefined,
      contactUrl: formMessengerLink.trim() || undefined,
      deliveryMode: formDelivery || undefined,
      notes: formNotes.trim() || undefined,
      customerId: finalCustomerId,
    };

    if (editingItemId) {
      updateOfficeItem(editingItemId, itemData);
    } else {
      addOfficeItem(itemData);
    }

    setShowForm(false);
    setEditingItemId(null);
  };

  const handleCreateOrder = () => {
    if (selectedItemIds.length === 0) return;
    const orderId = createOrderFromOfficeItems(selectedItemIds, customOrderCode.trim() || undefined);
    if (orderId) {
      setOrderCreatedMsg(`تم إنشاء أوردر بنجاح ونقل ${selectedItemIds.length} صنف!`);
      setSelectedItemIds([]);
      setCustomOrderCode('');
      setTimeout(() => {
        setOrderCreatedMsg(null);
        setCurrentPage('orders');
      }, 1000);
    }
  };

  // تصفية العملاء للبحث في نموذج العميلة المسجلة
  const matchingCustomers = useMemo(() => {
    if (customerFormMode !== 'registered') return [];
    const term = customerSearchTerm.trim().toLowerCase();
    if (!term) return customers.slice(0, 10);
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term))
    ).slice(0, 15);
  }, [customers, customerSearchTerm, customerFormMode]);

  // مكون مشترك لعرض كارت العميلة في قسمي التوصيل والاستلام
  const renderCustomerCard = (group: DeliveryCustomerGroup, mode: 'delivery' | 'pickup') => {
    const mUrl = formatMessengerUrl(group.messenger);
    const waUrl = getWhatsAppUrl(group.phone);
    const telUrl = getTelUrl(group.phone);

    const cust = group.customerId ? customers.find((c) => c.id === group.customerId) : undefined;
    const suggestedSize = cust?.size || group.items.find((it) => it.customerSize)?.customerSize;
    const groupDeliveryFee = mode === 'delivery'
      ? group.items.find((it) => it.deliveryFee !== undefined && it.deliveryFee !== null && it.deliveryFee > 0)?.deliveryFee
      : undefined;
    const itemsSellTotal = group.items.reduce((s, it) => s + (it.guideSellPrice ? it.guideSellPrice * (it.quantity || 1) : 0), 0);
    const hasAnySellPrice = group.items.some((it) => it.guideSellPrice !== undefined && it.guideSellPrice > 0);
    const grandTotal = itemsSellTotal + (groupDeliveryFee || 0);
    const showGrandTotal = hasAnySellPrice || !!groupDeliveryFee;

    return (
      <div
        key={group.key}
        className="rounded-2xl bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] text-xs wallet-card-shadow overflow-hidden"
      >
        {/* رأس الكارت: اسم العميلة + علامة شحن/استلام + المقاس المقترح مرة واحدة */}
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2 border-b border-[#ECECF4] dark:border-[#32263F]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-extrabold text-[14px] text-[#2B2340] dark:text-[#F2EEF7] truncate">
              {group.customerName}
            </span>
            {mode === 'delivery' ? (
              <span className="text-[10px] font-[800] text-[#2F7F5F] dark:text-[#4BA682] px-1.5 py-[1px] rounded-md bg-[#E3F2EA] dark:bg-[#162E23] border border-[#2F7F5F]/30">
                شحن
              </span>
            ) : (
              <span className="text-[10px] font-[800] text-[#B7791F] dark:text-[#D4983D] px-1.5 py-[1px] rounded-md bg-[#FBF1DE] dark:bg-[#332616] border border-[#B7791F]/30">
                استلام
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {suggestedSize && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[#666079] dark:text-[#9E97B0] bg-[#5F2967]/[0.06] dark:bg-[#5F2967]/[0.15] border border-[#5F2967]/15 whitespace-nowrap">
                المقاس المقترح: {suggestedSize}
              </span>
            )}
            <span className="text-[10px] text-[#9A98B0] font-bold">
              ({group.items.length} صنف)
            </span>
          </div>
        </div>

        {/* الجزء الغامق بعد الهيدر */}
        <div className="bg-[#3C3F4A] px-3.5 pt-2.5 pb-3.5 space-y-2">
          {/* قائمة الأصناف الخاصة بالعميلة (اسم الصنف نظيف + سعر بيع مقترح) */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#C9CAD3] block">الأصناف المطلوبة:</span>
            <div className="space-y-1 pr-1">
              {group.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2 text-xs py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E8E9EE] shrink-0" />
                    <span className="font-bold text-white truncate">
                      {it.itemName}
                    </span>
                    {it.guideSellPrice ? (
                      <span className="text-[10px] font-bold text-[#7FE0B0] shrink-0">
                        بيع {it.guideSellPrice} {it.quantity > 1 ? `×${it.quantity}` : ''}
                      </span>
                    ) : it.quantity > 1 ? (
                      <span className="text-[10px] text-[#C9CAD3] font-bold shrink-0">
                        (العدد: {it.quantity})
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* العنوان: يظهر فقط في قسم التوصيل (مخفي في الاستلام) */}
          {mode === 'delivery' && group.address && (
            <div className="pt-0.5 text-[11px] text-[#E8E9EE] leading-snug break-words">
              <span className="text-[#C9CAD3] font-bold">العنوان: </span>
              {group.address}
            </div>
          )}

          {/* ملاحظات العميلة المسجلة */}
          {group.customerNotes && (
            <div className="text-[11px] text-[#E8E9EE] leading-snug line-clamp-2 break-words bg-white/10 p-1.5 rounded-lg">
              <span className="text-[#C9CAD3] font-bold">ملاحظات: </span>
              {group.customerNotes}
            </div>
          )}

          {/* إجمالي الحساب */}
          {showGrandTotal && (
            <div className="flex items-center justify-between pt-1.5 border-t border-white/15 text-[11px]">
              <span className="font-extrabold text-white">
                إجمالي الحساب: {grandTotal.toLocaleString('en-US')} {state.settings.currency}
                {mode === 'delivery' && groupDeliveryFee ? (
                  <span className="text-[10px] font-normal text-[#C9CAD3] mr-1">
                    (شامل توصيل {groupDeliveryFee} {state.settings.currency})
                  </span>
                ) : null}
              </span>
            </div>
          )}

          {/* أزرار التواصل */}
          {(mUrl || waUrl || telUrl) && (
            <div className="flex items-center gap-2 pt-1 border-t border-white/15">
              {mUrl && (
                <a
                  href={mUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-[#E8F0FA] dark:bg-[#1E293B] text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center hover:opacity-80 active:scale-95 transition"
                  title="ماسنجر"
                  aria-label="فتح ماسنجر العميل"
                >
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.913 1.455 5.518 3.734 7.214V22l3.373-1.851c.907.251 1.879.387 2.893.387 5.523 0 10-4.145 10-9.278C22 6.145 17.523 2 12 2zm1.002 12.441l-2.559-2.73-4.996 2.73 5.498-5.836 2.621 2.73 4.934-2.73-5.498 5.836z" />
                  </svg>
                </a>
              )}
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => openWhatsApp(e, group.phone)}
                  className="w-8 h-8 rounded-full bg-[#E3F2EA] dark:bg-[#162E23] text-[#25A55F] dark:text-[#4BA682] flex items-center justify-center hover:opacity-80 active:scale-95 transition"
                  title="واتساب"
                  aria-label="إرسال رسالة واتساب"
                >
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.09.55 4.13 1.59 5.93L0 24l6.35-1.66a11.87 11.87 0 0 0 5.7 1.45h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.23-6.15-3.42-8.43zM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.77.99 1.01-3.67-.24-.38a9.88 9.88 0 0 1-1.52-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 7c0 5.45-4.44 9.91-9.86 9.91zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
                  </svg>
                </a>
              )}
              {telUrl && (
                <a
                  href={telUrl}
                  className="w-8 h-8 rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center hover:opacity-80 active:scale-95 transition"
                  title="اتصال"
                  aria-label="اتصال بالعميل"
                >
                  <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z" />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-24 max-w-xl mx-auto text-[#2B2340] dark:text-[#F2EEF7]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج */}
      <div className="card-header-purple flex items-center justify-between gap-2">
        <div className="flex items-center gap-[10px] min-w-0">
          <button
            onClick={() => setCurrentPage('entry')}
            className="btn-back-transparent shrink-0"
            title="رجوع للرئيسية"
          >
            ➜
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 flex items-center justify-center shrink-0 opacity-90">
              <Icon3D name="offices" size={20} />
            </div>
            <span className="text-[15px] sm:text-[18px] font-[800] text-white leading-none truncate">
              بضاعة المكاتب والموردين
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="shrink-0 h-[32px] px-3.5 rounded-full bg-white hover:bg-white/95 text-[#5F2967] text-[12px] font-[800] flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
        >
          <span className="text-[#5F2967] font-black text-[14px] leading-none">＋</span>
          <span>إضافة صنف</span>
        </button>
      </div>

      {/* 2. أزرار التبديل الصغيرة: «الشراء» و«التوصيل» و«الاستلام» */}
      <div className="flex items-center gap-1.5 px-0.5">
        <button
          type="button"
          onClick={() => setActiveSection('buying')}
          className={`px-3.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
            activeSection === 'buying'
              ? 'bg-[#5F2967] text-white shadow-xs'
              : 'bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] text-[#666079] dark:text-[#9E97B0]'
          }`}
        >
          الشراء
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('delivery')}
          className={`px-3.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
            activeSection === 'delivery'
              ? 'bg-[#5F2967] text-white shadow-xs'
              : 'bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] text-[#666079] dark:text-[#9E97B0]'
          }`}
        >
          التوصيل
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('pickup')}
          className={`px-3.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
            activeSection === 'pickup'
              ? 'bg-[#5F2967] text-white shadow-xs'
              : 'bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] text-[#666079] dark:text-[#9E97B0]'
          }`}
        >
          الاستلام
        </button>
      </div>

      {orderCreatedMsg && (
        <div className="p-3 rounded-2xl bg-[#2FA36B]/15 border border-[#2FA36B]/40 text-[#2FA36B] text-xs font-bold flex items-center gap-2">
          <Icon3D name="check" size={18} />
          <span>{orderCreatedMsg}</span>
        </div>
      )}

      {/* 3. Add / Edit Item Form */}
      {showForm && (
        <form
          onSubmit={handleFormSubmit}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#231A2C] border border-[#5F2967] space-y-2.5 text-xs wallet-card-shadow"
        >
          <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4] dark:border-[#32263F]">
            <span className="font-extrabold text-[#5F2967] dark:text-[#9B67A4]">
              {editingItemId ? 'تعديل صنف مكتب' : 'إضافة صنف لمكتب'}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingItemId(null);
              }}
              className="text-[#9A98B0] hover:text-[#2B2340]"
            >
              <Icon3D name="close" size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">المكتب / المورد *</label>
              <select
                required
                value={formOfficeName}
                onChange={(e) => setFormOfficeName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
              >
                {registeredOffices.map((off) => (
                  <option key={off} value={off}>{off}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">اسم الصنف / الموديل *</label>
              <input
                type="text"
                required
                placeholder="صنف..."
                value={formItemName}
                onChange={(e) => setFormItemName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[#9A98B0] mb-0.5">العدد *</label>
              <input
                type="number"
                min="1"
                required
                value={formQuantity}
                onChange={(e) => setFormQuantity(e.target.value)}
                className="w-full px-2 py-1.5 text-center rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#9A98B0] mb-0.5">سعر التكلفة للقطعة *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="0"
                value={formCostPrice}
                onChange={(e) => setFormCostPrice(e.target.value)}
                className="w-full px-2 py-1.5 text-center rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">سعر البيع المقترح (للقطعة)</label>
            <input
              type="number"
              step="any"
              placeholder="اختياري (0)"
              value={formGuideSellPrice}
              onChange={(e) => setFormGuideSellPrice(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-bold outline-none focus:border-[#5F2967]"
            />
          </div>

          {/* مربع بيانات العميل مع زرين: عميلة جديدة وعميلة مسجلة */}
          <div className="p-2.5 rounded-xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#2B2340] dark:text-white block text-[10px]">
                بيانات العميل الاختيارية:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerFormMode('new');
                    setSelectedRegisteredCustomerId('');
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    customerFormMode === 'new'
                      ? 'bg-[#5F2967] text-white shadow-xs'
                      : 'bg-white dark:bg-[#231A2C] text-[#666079] dark:text-[#9E97B0] border border-[#ECECF4] dark:border-[#32263F]'
                  }`}
                >
                  عميلة جديدة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerFormMode('registered');
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    customerFormMode === 'registered'
                      ? 'bg-[#5F2967] text-white shadow-xs'
                      : 'bg-white dark:bg-[#231A2C] text-[#666079] dark:text-[#9E97B0] border border-[#ECECF4] dark:border-[#32263F]'
                  }`}
                >
                  عميلة مسجلة
                </button>
              </div>
            </div>

            {/* وضع عميلة جديدة: الخانات اليدوية كما هي */}
            {customerFormMode === 'new' && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="اسم العميل"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
                  />
                  <input
                    type="tel"
                    placeholder="رقم الهاتف"
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="العنوان"
                    value={formCustomerAddress}
                    onChange={(e) => setFormCustomerAddress(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
                  />
                  <input
                    type="text"
                    placeholder="المقاس"
                    value={formCustomerSize}
                    onChange={(e) => setFormCustomerSize(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
                  />
                </div>
                <input
                  type="text"
                  placeholder="لينك الماسنجر (رابط العميل)"
                  value={formMessengerLink}
                  onChange={(e) => setFormMessengerLink(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
                />
                <DeliveryChoice value={formDelivery} onChange={setFormDelivery} />
              </div>
            )}

            {/* وضع عميلة مسجلة: قائمة بحث واختيار ملخص */}
            {customerFormMode === 'registered' && (
              <div className="space-y-1.5">
                {selectedRegisteredCustomerId ? (
                  <div className="p-2 rounded-lg bg-white dark:bg-[#231A2C] border border-[#5F2967]/30 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[#5F2967] dark:text-[#D8B4FE] text-xs truncate">
                          {formCustomerName}
                        </span>
                        {formCustomerPhone && (
                          <span className="text-[10px] text-[#9A98B0] shrink-0">
                            • {formCustomerPhone}
                          </span>
                        )}
                        {formDelivery === 'delivery' && (
                          <span className="text-[9px] px-1 rounded bg-[#E3F2EA] dark:bg-[#162E23] text-[#2F7F5F] font-bold">
                            شحن
                          </span>
                        )}
                      </div>
                      {formCustomerAddress && (
                        <p className="text-[10px] text-[#666079] dark:text-[#9E97B0] truncate mt-0.5">
                          {formCustomerAddress}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRegisteredCustomerId('');
                        setCustomerSearchTerm('');
                      }}
                      className="px-2 py-1 rounded-md bg-[#ECECF4] dark:bg-[#32263F] text-[10px] font-bold text-[#5F2967] dark:text-[#D8B4FE] hover:bg-[#5F2967] hover:text-white transition cursor-pointer"
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="ابحث باسم العميلة أو رقم الهاتف..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs outline-none focus:border-[#5F2967]"
                      autoFocus
                    />
                    <div className="max-h-36 overflow-y-auto divide-y divide-[#ECECF4] dark:divide-[#32263F] rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C]">
                      {matchingCustomers.length === 0 ? (
                        <div className="p-2 text-center text-[10px] text-[#9A98B0]">
                          لا توجد عميلة مطابقة
                        </div>
                      ) : (
                        matchingCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectRegisteredCustomer(c)}
                            className="w-full px-2.5 py-1.5 text-right flex items-center justify-between hover:bg-[#F1E8F4] dark:hover:bg-[#2D1F35] transition cursor-pointer"
                          >
                            <span className="font-bold text-xs text-[#2B2340] dark:text-white truncate">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-[#9A98B0] shrink-0 font-mono">
                              {c.phone || 'بدون هاتف'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* قيمة التوصيل تظهر فقط إذا كان التسليم شحن */}
            {formDelivery === 'delivery' && (
              <div>
                <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">قيمة التوصيل</label>
                <input
                  type="number"
                  step="any"
                  placeholder="اختياري (مثال: 50)"
                  value={formDeliveryFee}
                  onChange={(e) => setFormDeliveryFee(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs font-bold"
                />
              </div>
            )}

            {/* ملاحظات الصنف (محفوظة على الصنف فقط دون تلويث customer.notes) */}
            <input
              type="text"
              placeholder="ملاحظات الصنف..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs cursor-pointer shadow-xs transition"
            >
              {editingItemId ? 'حفظ التعديل' : 'إضافة الصنف'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingItemId(null);
              }}
              className="px-4 py-2 rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* 4. Search & Filter Bar (مشترك) */}
      <div className="p-2 rounded-xl bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] flex items-center gap-2 text-[11px] wallet-card-shadow">
        <div className="relative flex-1">
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon3D name="search" size={14} />
          </div>
          <input
            type="text"
            placeholder={activeSection === 'buying' ? 'بحث في أصناف المكاتب...' : 'بحث باسم العميلة...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[30px] pr-7 pl-2.5 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] text-[11px] placeholder:text-[11px] outline-none"
          />
        </div>
        {activeSection === 'buying' && (
          <select
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            className="h-[30px] px-2 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-[#F1F1FA] dark:bg-[#17101D] font-bold text-[#5F2967] dark:text-[#9B67A4] text-[11px] outline-none"
          >
            <option value="all">كل المكاتب</option>
            {registeredOffices.map((off) => (
              <option key={off} value={off}>{off}</option>
            ))}
          </select>
        )}
      </div>

      {/* ========================================================= */}
      {/* قسم الشراء */}
      {/* ========================================================= */}
      {activeSection === 'buying' && (
        <>
          {/* شريط تحديد الكل وتحويل لأوردر */}
          {filteredActiveItems.length > 0 && (
            <div
              style={{ background: 'linear-gradient(to left, #2DB5A8, #2E8A82)' }}
              className="p-3 rounded-2xl text-white flex items-center justify-between gap-2.5 shadow-md text-xs"
            >
              <button
                onClick={selectAllAvailable}
                className="flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <Icon3D
                  name={selectedItemIds.length === filteredActiveItems.length && filteredActiveItems.length > 0 ? 'checkbox_on' : 'checkbox_off'}
                  size={18}
                />
                <span>تحديد الكل ({selectedItemIds.length})</span>
              </button>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="اسم الأوردر..."
                  value={customOrderCode}
                  onChange={(e) => setCustomOrderCode(e.target.value)}
                  className="w-24 px-2 py-1 rounded-xl bg-white/20 text-white placeholder-purple-200 text-xs outline-none"
                />
                <button
                  onClick={handleCreateOrder}
                  disabled={selectedItemIds.length === 0}
                  className="px-3 py-1 rounded-xl bg-white text-[#5F2967] font-black text-xs disabled:opacity-40 cursor-pointer shadow-xs transition hover:bg-purple-50"
                >
                  تحويل لأوردر
                </button>
              </div>
            </div>
          )}

          {/* قائمة المكاتب وأصنافها المجمعة */}
          {buyingOfficeGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#9A98B0] border border-dashed border-[#ECECF4] dark:border-[#32263F] rounded-2xl bg-white dark:bg-[#231A2C]">
              لا توجد أصناف مكاتب متبقية
            </div>
          ) : (
            <div className="space-y-2">
              {buyingOfficeGroups.map((group) => {
                const regIndex = registeredOffices.indexOf(group.officeName);
                const canMoveUp = group.isRegistered && regIndex > 0;
                const canMoveDown = group.isRegistered && regIndex !== -1 && regIndex < registeredOffices.length - 1;
                const isOpen = searchQuery.trim() !== '' || !!openOffices[group.officeName];

                return (
                  <div
                    key={group.officeName}
                    className="p-[10px_12px] rounded-[10px] bg-white border border-[#E5E7EB] shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
                  >
                    {/* صف العنوان: بدون border-b ولا pb */}
                    <div
                      onClick={() => toggleOfficeOpen(group.officeName)}
                      className="flex items-center justify-between gap-2 cursor-pointer select-none"
                    >
                      {/* اليمين: خانة الترتيب + اسم المكتب + عدد القطع */}
                      <div className="flex items-center gap-2 min-w-0">
                        {group.isRegistered ? (
                          <input
                            key={`${group.officeName}_${regIndex}`}
                            type="text"
                            inputMode="numeric"
                            defaultValue={regIndex + 1}
                            style={{ backgroundColor: getOfficeColor(group.officeName) }}
                            className="w-[18px] h-[24px] rounded-[5px] shrink-0 p-0 border-0 outline-none text-center text-white text-[10px] font-[700] leading-none caret-white"
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              e.target.value = e.target.value.replace(/\D/g, '');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              const currentRank = regIndex + 1;
                              if (isNaN(val) || val <= 0) {
                                e.target.value = String(currentRank);
                                return;
                              }
                              const targetRank = Math.min(val, registeredOffices.length);
                              if (targetRank === currentRank) {
                                e.target.value = String(currentRank);
                                return;
                              }
                              const nextList = registeredOffices.filter((name) => name !== group.officeName);
                              nextList.splice(targetRank - 1, 0, group.officeName);
                              updateSettings({ registeredOffices: nextList });
                            }}
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: getOfficeColor(group.officeName) }}
                            className="w-[18px] h-[24px] rounded-[5px] shrink-0"
                          />
                        )}
                        <span className="text-[11px] font-[800] text-[#1F1A2E] truncate leading-tight">
                          {group.officeName}
                        </span>
                        <span className="text-[9px] font-[500] text-[#9A98B0] shrink-0 leading-tight">
                          {formatItemsCount(group.items.length)}
                        </span>
                      </div>

                      {/* الشمال: الإجمالي + سهم الفتح/الطي */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-[11px] font-[800] text-[#2F7F5F] tabular-nums">
                          {group.totalCost.toLocaleString('en-US')} {state.settings.currency}
                        </div>

                        <svg
                          className={`w-3.5 h-3.5 text-[#9A98B0] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* قائمة الأصناف تحت المكتب تظهر فقط عند فتح الكارت */}
                    {isOpen && (
                      group.items.length === 0 ? (
                        <div className="py-2 text-center text-[10px] text-[#9A98B0]">
                          لا توجد أصناف في هذا المكتب
                        </div>
                      ) : (
                        <div className="bg-[#3C3F4A] rounded-[8px] pt-[6px] pb-[6px] pe-[6px] ps-[30px] mt-2 space-y-1.5">
                          {group.items.map((item, itemIndex) => {
                            const isFirstItem = itemIndex === 0;
                            const isLastItem = itemIndex === group.items.length - 1;
                            const isSelected = selectedItemIds.includes(item.id);
                            return (
                              <div key={item.id} className="relative">
                                <span className={`absolute start-[-16px] w-[2px] bg-[#E2B84F] ${isFirstItem ? 'top-1/2' : '-top-[6px]'} ${isLastItem ? 'bottom-1/2' : 'bottom-0'}`} />
                                <span className="absolute start-[-16px] top-1/2 -translate-y-1/2 h-[2px] w-[14px] bg-[#E2B84F]" />
                                <span className="absolute start-[-19px] top-1/2 -translate-y-1/2 h-[8px] w-[8px] rounded-full bg-[#E2B84F]" />
                                <SwipeRow
                                  rowKey={`office_item_${item.id}`}
                                  swipeOpenKey={swipeOpenKey}
                                  onOpenChange={setSwipeOpenKey}
                                  onEdit={() => openEditForm(item)}
                                  onDelete={() => deleteOfficeItem(item.id)}
                                  className="rounded-[8px] border border-[#E5E7EB] overflow-hidden"
                                >
                                  <div className="bg-white p-[8px_10px] flex items-center justify-between gap-2 w-full">
                                    {/* اليمين: checkbox + اسم الصنف فقط */}
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleSelectItem(item.id)}
                                        className="cursor-pointer shrink-0"
                                      >
                                        <Icon3D name={isSelected ? 'checkbox_on' : 'checkbox_off'} size={18} />
                                      </button>
                                      <span className="text-[11px] font-[800] text-[#1F1A2E] truncate leading-tight">
                                        {item.itemName}
                                      </span>
                                    </div>

                                    {/* الشمال: السعر بالأخضر */}
                                    <div className="text-[11px] font-[800] text-[#2F7F5F] tabular-nums shrink-0">
                                      التكلفة <span className="font-[800]">{item.costPrice}</span> {state.settings.currency}
                                      {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                                    </div>
                                  </div>
                                </SwipeRow>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* قسم التوصيل: بطاقة لكل عميلة تجمع كل أصنافها (شحن فقط) */}
      {/* ========================================================= */}
      {activeSection === 'delivery' && (
        <div className="space-y-2.5">
          {deliveryGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#9A98B0] border border-dashed border-[#ECECF4] dark:border-[#32263F] rounded-2xl bg-white dark:bg-[#231A2C]">
              لا توجد أصناف مجهزة للتوصيل حالياً
            </div>
          ) : (
            deliveryGroups.map((group) => renderCustomerCard(group, 'delivery'))
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* قسم الاستلام: بطاقة لكل عميلة تجمع أصنافها (استلام يدوي) */}
      {/* ========================================================= */}
      {activeSection === 'pickup' && (
        <div className="space-y-2.5">
          {pickupGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#9A98B0] border border-dashed border-[#ECECF4] dark:border-[#32263F] rounded-2xl bg-white dark:bg-[#231A2C]">
              لا توجد أصناف مجهزة للاستلام حالياً
            </div>
          ) : (
            pickupGroups.map((group) => renderCustomerCard(group, 'pickup'))
          )}
        </div>
      )}
    </div>
  );
};
