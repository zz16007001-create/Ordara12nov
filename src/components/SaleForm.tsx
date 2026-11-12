/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OrderItem, PaymentMethod } from '../types';

interface SaleFormProps {
  orderId: string;
  item: OrderItem;
  /** يُستدعى بعد تأكيد البيع بنجاح */
  onDone: (summary: string) => void;
  /** لو موجود يظهر زر إلغاء */
  onCancel?: () => void;
}

/**
 * نموذج تسجيل البيع الموحّد (كاش / آجل / دفع جزء + العميل).
 * مستخدم في زرار "تسجيل بيع" في الأوردرات وفي البيع السريع، عشان الاتنين يبقوا نفس الواجهة ونفس الحساب.
 */
export const SaleForm: React.FC<SaleFormProps> = ({ orderId, item, onDone, onCancel }) => {
  const { state, customers, addCustomer, registerItemSale } = useApp();

  const [salePrice, setSalePrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('نقدية (كاش)');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'partial'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(item.requestedByCustomerId || item.customerId || '');
  const [partialPaidInput, setPartialPaidInput] = useState<string>('');
  const [customerSelectionMode, setCustomerSelectionMode] = useState<'registered' | 'new'>('registered');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [inlineCustName, setInlineCustName] = useState('');
  const [inlineCustPhone, setInlineCustPhone] = useState('');
  const [inlineCustSize, setInlineCustSize] = useState('');
  const [inlineCustAddress, setInlineCustAddress] = useState('');
  const [inlineCustMessenger, setInlineCustMessenger] = useState('');
  const [inlineCustNotes, setInlineCustNotes] = useState('');

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

  const normalizedInputPhone = normalizePhoneForComparison(inlineCustPhone);
  const existingCustomerWithPhone =
    normalizedInputPhone && normalizedInputPhone.length >= 7
      ? customers.find((c) => normalizePhoneForComparison(c.phone) === normalizedInputPhone)
      : null;

  const handleConfirmSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salePrice) return;
    const price = parseFloat(salePrice);
    if (!price || price <= 0) return;

    let custId = selectedCustomerId;
    if (customerSelectionMode === 'new' && inlineCustName.trim() && !existingCustomerWithPhone) {
      const created = addCustomer(
        inlineCustName.trim(),
        inlineCustPhone.trim() || undefined,
        inlineCustNotes.trim() || undefined,
        {
          size: inlineCustSize.trim() || undefined,
          address: inlineCustAddress.trim() || undefined,
          messengerLink: inlineCustMessenger.trim() || undefined,
        }
      );
      custId = created.id;
    } else if (customerSelectionMode === 'new' && existingCustomerWithPhone) {
      custId = existingCustomerWithPhone.id;
    }

    if ((paymentType === 'credit' || paymentType === 'partial') && !custId) {
      alert('يرجى اختيار أو إضافة العميل للبيع الآجل أو الجزئي');
      return;
    }

    const totalDue = price * (item.quantity || 1);
    const initialPaid =
      paymentType === 'cash'
        ? totalDue
        : paymentType === 'credit'
        ? 0
        : parseFloat(partialPaidInput) || 0;

    registerItemSale(
      orderId,
      item.id,
      price,
      paymentMethod,
      undefined,
      paymentType,
      custId || undefined,
      initialPaid
    );

    const typeText =
      paymentType === 'cash' ? 'كاش' : paymentType === 'credit' ? 'آجل بالكامل' : `دفع جزء (${Math.min(totalDue, initialPaid)})`;
    onDone(`تم بيع ${item.name} بمبلغ ${totalDue} ${state.settings.currency} - ${typeText}`);
  };

  return (
    <form onSubmit={handleConfirmSale} className="space-y-3.5 text-right text-xs">
            <div className="p-2 rounded-xl bg-[#F1F1FA] dark:bg-[#17101D] text-[11px] text-[#9A98B0] flex justify-between">
              <span>سعر التكلفة:</span>
              <strong className="text-[#2B2340] dark:text-white font-black">
                {item.costPrice} {state.settings.currency} (الكمية: {item.quantity})
              </strong>
            </div>

            {/* Selling price defaults to empty */}
            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">
                سعر البيع للقطعة *
              </label>
              <input
                type="number"
                step="0.01"
                required
                autoFocus
                placeholder="أدخل سعر البيع..."
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-black text-center text-[#5F2967] dark:text-[#9B67A4] text-base outline-none focus:border-[#5F2967]"
              />
            </div>

            {/* Payment Type Selection: [كاش كامل] [آجل كامل] [دفع جزء] */}
            <div className="space-y-1">
              <label className="block font-bold text-[#2B2340] dark:text-white text-[11px]">
                طريقة الدفع *
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'cash', label: 'كاش كامل' },
                  { id: 'credit', label: 'آجل كامل' },
                  { id: 'partial', label: 'دفع جزء' },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setPaymentType(t.id as any)}
                    className={`py-2 px-1 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      paymentType === t.id
                        ? 'bg-[#5F2967] text-white border-[#5F2967] shadow-xs'
                        : 'bg-[#F1F1FA] dark:bg-[#17101D] text-[#2B2340] dark:text-[#F2EEF7] border-[#ECECF4] dark:border-[#32263F]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* If partial: show input for "المدفوع الآن" */}
            {paymentType === 'partial' && (
              <div>
                <label className="block font-bold text-[#2B2340] dark:text-white mb-1">
                  المبلغ المدفوع الآن *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={partialPaidInput}
                  onChange={(e) => setPartialPaidInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] font-black text-center text-[#2FA36B] outline-none focus:border-[#5F2967]"
                />
                {parseFloat(salePrice) > 0 && (
                  <span className="text-[10px] text-[#E2574C] block mt-0.5 font-bold">
                    المتبقي كدين: {Math.max(0, (parseFloat(salePrice) * (item.quantity || 1)) - (parseFloat(partialPaidInput) || 0))} {state.settings.currency}
                  </span>
                )}
              </div>
            )}

            {/* Customer Selector (بند ٢) */}
            <div className="space-y-2">
              <label className="block font-bold text-[#2B2340] dark:text-white text-[11px]">
                العميل {paymentType !== 'cash' ? '(إجباري للأجل والجزئي) *' : '(اختياري)'}
              </label>

              {/* Segmented Control: عميل مسجل | عميل جديد */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F1FA] dark:bg-[#17101D] rounded-xl border border-[#ECECF4] dark:border-[#32263F]">
                <button
                  type="button"
                  onClick={() => setCustomerSelectionMode('registered')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    customerSelectionMode === 'registered'
                      ? 'bg-white dark:bg-[#231A2C] text-[#5F2967] dark:text-[#9B67A4] shadow-xs'
                      : 'text-[#7A7585] dark:text-[#9A98B0]'
                  }`}
                >
                  عميل مسجل
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerSelectionMode('new')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    customerSelectionMode === 'new'
                      ? 'bg-white dark:bg-[#231A2C] text-[#5F2967] dark:text-[#9B67A4] shadow-xs'
                      : 'text-[#7A7585] dark:text-[#9A98B0]'
                  }`}
                >
                  عميل جديد
                </button>
              </div>

              {customerSelectionMode === 'registered' ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="بحث باسم أو رقم العميل..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs outline-none focus:border-[#5F2967]"
                  />
                  <select
                    required={paymentType !== 'cash'}
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs font-bold outline-none focus:border-[#5F2967]"
                  >
                    <option value="">{paymentType === 'cash' ? '-- بدون عميل محدد --' : '-- اختر العميل --'}</option>
                    {customers
                      .filter((c) => {
                        if (!customerSearchQuery.trim()) return true;
                        const q = customerSearchQuery.trim().toLowerCase();
                        return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
                      })
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                  </select>

                  {/* تأكيد فوري لبيانات العميل المختار (هاتف ومقاس) */}
                  {selectedCustomerId && (() => {
                    const cObj = customers.find((c) => c.id === selectedCustomerId);
                    if (!cObj || (!cObj.phone && !cObj.size)) return null;
                    return (
                      <div className="text-[10px] text-[#5F2967] dark:text-[#9B67A4] bg-[#F7F2FA] dark:bg-[#1E1428] px-2.5 py-1 rounded-lg flex items-center justify-between border border-[#E8DEF8] dark:border-[#38264A]">
                        {cObj.phone && <span>الهاتف: <strong className="font-bold">{cObj.phone}</strong></span>}
                        {cObj.size && <span>المقاس: <strong className="font-bold">{cObj.size}</strong></span>}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-[#F7F7FA] dark:bg-[#1A1222] border border-[#5F2967]/30 space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#7A7585] dark:text-[#9A98B0] mb-0.5">
                      الاسم *
                    </label>
                    <input
                      type="text"
                      required={paymentType !== 'cash'}
                      placeholder="اسم العميل..."
                      value={inlineCustName}
                      onChange={(e) => setInlineCustName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs font-bold outline-none focus:border-[#5F2967]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#7A7585] dark:text-[#9A98B0] mb-0.5">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      placeholder="01xxxxxxxxx"
                      value={inlineCustPhone}
                      onChange={(e) => setInlineCustPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs outline-none focus:border-[#5F2967]"
                    />
                  </div>

                  {/* تنبيه تكرار الهاتف وزر استخدام العميل الموجود */}
                  {existingCustomerWithPhone && (
                    <div className="p-2 rounded-lg bg-[#FFF8E1] dark:bg-[#2D2310] border border-[#FFE082] dark:border-[#5E4717] text-[11px] text-[#8D6E14] dark:text-[#FFE082] space-y-1">
                      <div className="font-bold">
                        ⚠️ هذا الرقم مسجل بالفعل للعميل: <strong>{existingCustomerWithPhone.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(existingCustomerWithPhone.id);
                          setCustomerSelectionMode('registered');
                        }}
                        className="w-full py-1 rounded bg-[#8D6E14] text-white font-bold text-[10px] hover:bg-[#70540C] cursor-pointer"
                      >
                        استخدام العميل الموجود
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] font-bold text-[#7A7585] dark:text-[#9A98B0] mb-0.5">
                        المقاس
                      </label>
                      <input
                        type="text"
                        placeholder="L, XL..."
                        value={inlineCustSize}
                        onChange={(e) => setInlineCustSize(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs outline-none focus:border-[#5F2967]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#7A7585] dark:text-[#9A98B0] mb-0.5">
                        العنوان
                      </label>
                      <input
                        type="text"
                        placeholder="العنوان..."
                        value={inlineCustAddress}
                        onChange={(e) => setInlineCustAddress(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs outline-none focus:border-[#5F2967]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#7A7585] dark:text-[#9A98B0] mb-0.5">
                      رابط ماسنجر
                    </label>
                    <input
                      type="url"
                      placeholder="https://m.me/..."
                      value={inlineCustMessenger}
                      onChange={(e) => setInlineCustMessenger(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs outline-none focus:border-[#5F2967]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#7A7585] dark:text-[#9A98B0] mb-0.5">
                      ملاحظات
                    </label>
                    <input
                      type="text"
                      placeholder="ملاحظات العميل..."
                      value={inlineCustNotes}
                      onChange={(e) => setInlineCustNotes(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs outline-none focus:border-[#5F2967]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] dark:text-white mb-1">طريقة استلام النقدية</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] dark:border-[#32263F] bg-white dark:bg-[#231A2C] text-xs font-bold outline-none focus:border-[#5F2967]"
              >
                <option value="نقدية (كاش)">نقدية (كاش)</option>
                <option value="إنستاباي">إنستاباي</option>
                <option value="فودافون كاش">فودافون كاش</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 py-2.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs transition cursor-pointer shadow-xs"
        >
          تأكيد البيع
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-[#ECECF4] dark:bg-[#32263F] text-[#2B2340] dark:text-[#F2EEF7] font-bold text-xs cursor-pointer"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
};
