/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import XLSX from 'xlsx-js-style';
import { AppDataState, AppSettings } from '../types';

const STORAGE_KEY = 'treasury_order_manager_data_v1';
const DB_NAME = 'TreasuryOrderDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

export const DEFAULT_REGISTERED_OFFICES = [
  'مكتب النور',
  'مكتب الصفا',
  'مكتب البركة',
  'مكتب النصر',
];

export const DEFAULT_SETTINGS: AppSettings = {
  initialCapital: 0,
  initialPocket: 0,
  profitShareCapital: 70,
  profitSharePocket: 20,
  profitShareCharity: 10,
  pocketWarningThreshold: 500,
  darkMode: false,
  currency: 'ج.م',
  registeredOffices: DEFAULT_REGISTERED_OFFICES,
};

export const getCleanEmptyState = (): AppDataState => ({
  version: 2,
  settings: { ...DEFAULT_SETTINGS },
  orders: [],
  officeItems: [],
  capitalTransactions: [],
  pocketTransactions: [],
  currentTrip: {
    id: 'trip_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    sources: [
      { id: 'src_cap', sourceName: 'رأس المال', amount: 0, treasuryType: 'capital' },
      { id: 'src_sal', sourceName: 'القبض', amount: 0, treasuryType: 'salary' },
    ],
    expenses: [],
    isReconciled: false,
  },
  pastTrips: [],
  salaryBudget: [
    { id: 'sb_1', name: 'مصاريف البيت', budgeted: 0, spent: 0 },
    { id: 'sb_2', name: 'الكهرباء والمرافق', budgeted: 0, spent: 0 },
    { id: 'sb_3', name: 'النت والموبايل', budgeted: 0, spent: 0 },
    { id: 'sb_4', name: 'الجمعية', budgeted: 0, spent: 0 },
    { id: 'sb_5', name: 'العلاج والصيدلية', budgeted: 0, spent: 0 },
    { id: 'sb_pocket_support', name: 'دعم بوكيت', budgeted: 0, spent: 0, isPocketSupport: true, isSystem: true },
  ],
  salaryExpenses: [],
  charityRecords: [],
  customers: [],
  customerPayments: [],
  customerNotes: [],
  orderCounter: 1,
});

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadStateFromStorage(): Promise<AppDataState> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STORAGE_KEY);
      req.onsuccess = () => {
        if (req.result) {
          try {
            const parsed = typeof req.result === 'string' ? JSON.parse(req.result) : req.result;
            resolve(mergeWithDefaults(parsed));
            return;
          } catch {
            // fallback
          }
        }
        resolve(loadFromLocalStorageFallback());
      };
      req.onerror = () => resolve(loadFromLocalStorageFallback());
    });
  } catch {
    return loadFromLocalStorageFallback();
  }
}

function loadFromLocalStorageFallback(): AppDataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return mergeWithDefaults(parsed);
    }
  } catch {
    // fallback
  }
  return getCleanEmptyState();
}

function mergeWithDefaults(data: Partial<AppDataState>): AppDataState {
  const clean = getCleanEmptyState();

  // Handle registeredOffices
  const settings: AppSettings = {
    ...clean.settings,
    ...(data.settings || {}),
    darkMode: false,
    registeredOffices:
      data.settings?.registeredOffices && data.settings.registeredOffices.length > 0
        ? data.settings.registeredOffices
        : DEFAULT_REGISTERED_OFFICES,
  };

  // Ensure current trip has only Capital and Salary by default
  let trip = data.currentTrip || clean.currentTrip;
  if (!trip.sources || trip.sources.length === 0) {
    trip = {
      ...trip,
      sources: [
        { id: 'src_cap', sourceName: 'رأس المال', amount: 0, treasuryType: 'capital' },
        { id: 'src_sal', sourceName: 'القبض', amount: 0, treasuryType: 'salary' },
      ],
    };
  } else {
    // Check if only legacy default sources existed with 0
    const isLegacyDefaultZero =
      trip.sources.length === 3 &&
      trip.sources.every((s) => ['إنستاباي', 'فودافون كاش', 'نقدية درج'].includes(s.sourceName) && (s.amount || 0) === 0);

    if (isLegacyDefaultZero) {
      trip = {
        ...trip,
        sources: [
          { id: 'src_cap', sourceName: 'رأس المال', amount: 0, treasuryType: 'capital' },
          { id: 'src_sal', sourceName: 'القبض', amount: 0, treasuryType: 'salary' },
        ],
      };
    }
  }

  // Ensure salary budget items have pocket support strictly at the end with isSystem=true
  let budget = (data.salaryBudget && data.salaryBudget.length > 0) ? [...data.salaryBudget] : [...clean.salaryBudget];
  const pocketSupportIndex = budget.findIndex((b) => b.isPocketSupport || b.name.includes('دعم بوكيت'));
  let pocketSupportItem: any = pocketSupportIndex >= 0 ? budget.splice(pocketSupportIndex, 1)[0] : null;
  if (!pocketSupportItem) {
    pocketSupportItem = { id: 'sb_pocket_support', name: 'دعم بوكيت', budgeted: 0, spent: 0, isPocketSupport: true, isSystem: true };
  } else {
    pocketSupportItem.name = 'دعم بوكيت';
    pocketSupportItem.isPocketSupport = true;
    pocketSupportItem.isSystem = true;
  }
  budget.push(pocketSupportItem);

  // Renumber stored orders sequentially from 1 by date order: "أوردر رقم N"
  let maxNum = 0;
  let orders = (data.orders || []).slice();
  if (orders.length > 0) {
    const sorted = [...orders].sort((a, b) => a.date.localeCompare(b.date));
    orders = sorted.map((o, idx) => {
      const num = idx + 1;
      if (num > maxNum) maxNum = num;
      // Also migrate old items to have safe defaults for customer & payment fields
      const migratedItems = (o.items || []).map((it) => ({
        ...it,
        paymentType: it.paymentType || (it.isSold ? 'cash' : undefined),
        paidAmount: it.paidAmount !== undefined ? it.paidAmount : (it.isSold ? (it.soldPrice || 0) * (it.quantity || 1) : 0),
      }));

      // تحويل أي additionalBagCost قديمة إلى صنف عادي اسمه "مصاريف"
      if (o.additionalBagCost && o.additionalBagCost > 0) {
        migratedItems.push({
          id: `item_exp_${o.id}`,
          name: 'مصاريف',
          quantity: 1,
          costPrice: o.additionalBagCost,
          isSold: false,
          paidAmount: 0,
          paymentType: undefined,
          notes: 'مصروفات شنطة سابقة',
        });
      }

      return {
        ...o,
        code: o.code && o.code.startsWith('أوردر رقم') ? o.code : `أوردر رقم ${num}`,
        items: migratedItems,
        additionalBagCost: 0,
      };
    });
  }

  const orderCounter = Math.max(data.orderCounter || 1, maxNum + 1);

  return {
    ...clean,
    ...data,
    version: 2,
    settings,
    orders,
    officeItems: data.officeItems || [],
    capitalTransactions: data.capitalTransactions || [],
    pocketTransactions: data.pocketTransactions || [],
    currentTrip: trip,
    pastTrips: data.pastTrips || [],
    salaryBudget: budget,
    salaryExpenses: data.salaryExpenses || [],
    charityRecords: data.charityRecords || [],
    customers: data.customers || [],
    customerPayments: data.customerPayments || [],
    customerNotes: data.customerNotes || [],
    orderCounter,
  };
}

export async function saveStateToStorage(state: AppDataState): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(state, STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Backup & Export Helpers
export function exportStateToJson(state: AppDataState): void {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date().toISOString().slice(0, 10);
  a.download = `نسخة_احتياطية_الخزن_والأوردرات_${now}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importStateFromJson(file: File): Promise<AppDataState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const validState = mergeWithDefaults(parsed);
        resolve(validState);
      } catch (err) {
        reject(new Error('الملف غير صالح أو تالف: ' + (err as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsText(file);
  });
}

// Helper to create professionally styled RTL sheet
function createStyledSheet(
  headers: string[],
  rows: (string | number | undefined | null)[][],
  moneyColIndices?: { green?: number[]; red?: number[] }
) {
  const ws: Record<string, any> = {};

  const headerStyle = {
    fill: { fgColor: { rgb: '5F2967' } },
    font: { name: 'Cairo', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '4A1E52' } },
      bottom: { style: 'medium', color: { rgb: '4A1E52' } },
      left: { style: 'thin', color: { rgb: '4A1E52' } },
      right: { style: 'thin', color: { rgb: '4A1E52' } },
    },
  };

  const evenRowStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: 'Cairo', sz: 10, color: { rgb: '2B2340' }, bold: false as boolean },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'ECECF4' } },
      bottom: { style: 'thin', color: { rgb: 'ECECF4' } },
      left: { style: 'thin', color: { rgb: 'ECECF4' } },
      right: { style: 'thin', color: { rgb: 'ECECF4' } },
    },
  };

  const oddRowStyle = {
    fill: { fgColor: { rgb: 'F9F8FC' } },
    font: { name: 'Cairo', sz: 10, color: { rgb: '2B2340' }, bold: false as boolean },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'ECECF4' } },
      bottom: { style: 'thin', color: { rgb: 'ECECF4' } },
      left: { style: 'thin', color: { rgb: 'ECECF4' } },
      right: { style: 'thin', color: { rgb: 'ECECF4' } },
    },
  };

  headers.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    ws[cellRef] = { v: h, t: 's', s: headerStyle };
  });

  const displayRows = rows.length > 0 ? rows : [new Array(headers.length).fill('-')];

  displayRows.forEach((row, rowIdx) => {
    const r = rowIdx + 1;
    const baseStyle = rowIdx % 2 === 0 ? evenRowStyle : oddRowStyle;
    row.forEach((val, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r, c: colIdx });
      const cellVal = val !== null && val !== undefined ? val : '';
      const isNum = typeof cellVal === 'number';
      const cellStyle = { ...baseStyle };

      if (moneyColIndices?.green?.includes(colIdx) && (typeof cellVal !== 'number' || cellVal >= 0)) {
        cellStyle.font = { ...baseStyle.font, bold: true, color: { rgb: '2FA36B' } };
      } else if (moneyColIndices?.red?.includes(colIdx) || (isNum && cellVal < 0)) {
        cellStyle.font = { ...baseStyle.font, bold: true, color: { rgb: 'E2574C' } };
      }

      ws[cellRef] = {
        v: cellVal,
        t: isNum ? 'n' : 's',
        s: cellStyle,
      };
      if (isNum) {
        ws[cellRef].z = '#,##0.00';
      }
    });
  });

  const totalRows = displayRows.length + 1;
  const totalCols = headers.length;
  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: Math.max(1, totalRows - 1), c: Math.max(0, totalCols - 1) });
  ws['!views'] = [{ rightToLeft: true }];
  ws['!autofilter'] = { ref: ws['!ref'] };
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(15, h.length * 2 + 4) }));

  return ws;
}

// Excel Export (xlsx-js-style with 9 styled sheets)
export function exportToExcel(state: AppDataState): void {
  const wb = XLSX.utils.book_new();

  // 1. الأوردرات (Orders Summary)
  const ordersSummaryHeaders = ['كود الأوردر', 'تاريخ الإنشاء', 'عدد الأصناف', 'إجمالي التكلفة', 'إجمالي المبيعات', 'صافي الربح', 'الحالة', 'ملاحظات'];
  const ordersSummaryRows = state.orders.map((o) => {
    const cost = o.items.reduce((s, it) => s + it.costPrice * it.quantity, 0) + (o.additionalBagCost || 0);
    const sold = o.items.filter((it) => it.isSold).reduce((s, it) => s + (it.soldPrice || 0) * it.quantity, 0);
    const profit = sold - cost;
    const isCompleted = o.items.length > 0 && o.items.every((it) => it.isSold);
    return [
      o.code,
      o.date,
      o.items.length,
      cost,
      sold,
      profit,
      isCompleted ? 'مقفول' : 'مفتوح',
      o.notes || '',
    ];
  });
  XLSX.utils.book_append_sheet(wb, createStyledSheet(ordersSummaryHeaders, ordersSummaryRows, { red: [3], green: [4, 5] }), 'الأوردرات');

  // 2. أصناف الأوردرات (Order Items Details)
  const itemsHeaders = ['كود الأوردر', 'اسم الصنف', 'العدد', 'سعر التكلفة', 'إجمالي التكلفة', 'حالة البيع', 'سعر البيع', 'إجمالي المبيعات', 'المدفوع', 'المتبقي دين', 'نوع السداد', 'اسم العميل', 'الربح', 'طريقة الدفع', 'المكتب'];
  const itemsRows: any[][] = [];
  state.orders.forEach((o) => {
    o.items.forEach((it) => {
      const itemCostTotal = it.costPrice * it.quantity;
      const itemSoldTotal = it.isSold && it.soldPrice !== undefined ? it.soldPrice * it.quantity : 0;
      const paid = it.paidAmount !== undefined ? it.paidAmount : itemSoldTotal;
      const debt = Math.max(0, itemSoldTotal - paid);
      const profit = it.isSold ? itemSoldTotal - itemCostTotal : 0;
      const customer = it.customerId ? (state.customers || []).find((c) => c.id === it.customerId) : null;

      itemsRows.push([
        o.code,
        it.name,
        it.quantity,
        it.costPrice,
        itemCostTotal,
        it.isSold ? (it.isSettled ? 'مسوّى' : 'تم البيع') : 'بالمخزون',
        it.soldPrice || 0,
        itemSoldTotal,
        paid,
        debt,
        it.paymentType === 'credit' ? 'آجل' : it.paymentType === 'partial' ? 'دفع جزء' : 'كاش',
        customer ? customer.name : '',
        profit,
        it.paymentMethod || '',
        it.officeName || '',
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, createStyledSheet(itemsHeaders, itemsRows, { red: [3, 4, 9], green: [6, 7, 8, 12] }), 'أصناف الأوردرات');

  // 3. العملاء والمديونيات (Customer Accounts & Debts)
  const customerHeaders = ['اسم العميل', 'رقم الهاتف', 'إجمالي المشتريات', 'المسدد', 'المتبقي (الدين)', 'تاريخ التسجيل', 'ملاحظات'];
  const customerRows = (state.customers || []).map((c) => {
    let purchases = 0;
    let paid = 0;
    state.orders.forEach((o) => {
      o.items.forEach((it) => {
        if (it.customerId === c.id && it.isSold) {
          const tot = (it.soldPrice || 0) * (it.quantity || 1);
          const p = it.paidAmount !== undefined ? it.paidAmount : tot;
          purchases += tot;
          paid += p;
        }
      });
    });
    return [
      c.name,
      c.phone || '',
      purchases,
      paid,
      Math.max(0, purchases - paid),
      c.createdAt,
      c.notes || '',
    ];
  });
  XLSX.utils.book_append_sheet(wb, createStyledSheet(customerHeaders, customerRows, { green: [3], red: [4] }), 'العملاء والمديونيات');

  // 3. بضاعة المكاتب (Office items)
  const officeHeaders = ['المكتب / المورد', 'اسم الصنف', 'العدد', 'سعر التكلفة', 'إجمالي التكلفة', 'تاريخ التسجيل', 'الحالة', 'اسم العميل', 'الهاتف', 'العنوان', 'لينك الماسنجر', 'ملاحظات'];
  const officeRows = state.officeItems.map((item) => [
    item.officeName,
    item.itemName,
    item.quantity,
    item.costPrice,
    item.costPrice * item.quantity,
    item.date,
    item.isTransferredToOrder ? 'منقول لأوردر' : 'بالمكتب',
    item.customerName || '',
    item.customerPhone || '',
    item.customerAddress || '',
    item.messengerLink || item.contactUrl || '',
    item.notes || '',
  ]);
  XLSX.utils.book_append_sheet(wb, createStyledSheet(officeHeaders, officeRows, { red: [3, 4] }), 'بضاعة المكاتب');

  // 4. حركات رأس المال (Capital Transactions)
  const capitalHeaders = ['التاريخ', 'نوع الحركة', 'المبلغ', 'البيان', 'كود الأوردر', 'ملاحظات'];
  const capitalRows = state.capitalTransactions.map((tx) => {
    let effectiveAmount = tx.amount;
    let effectiveNotes = tx.notes || '';
    if (tx.type === 'order_creation') {
      const ord = state.orders.find((o) => o.id === tx.orderId);
      if (ord) {
        effectiveAmount = ord.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
        effectiveNotes = `تكلفة ${ord.items.length} صنف`;
      }
    }
    return [
      tx.date,
      tx.type === 'order_creation'
        ? 'سحب لشراء أوردر'
        : tx.type === 'advance'
        ? 'سلفة'
        : tx.type === 'settlement'
        ? 'تسوية'
        : tx.type === 'growth'
        ? 'نمو رأس مال'
        : 'سداد سلفة',
      effectiveAmount,
      tx.description,
      tx.orderId || '',
      effectiveNotes,
    ];
  });
  XLSX.utils.book_append_sheet(wb, createStyledSheet(capitalHeaders, capitalRows, { green: [2] }), 'حركات رأس المال');

  // 5. حركات بوكيت (Pocket Transactions)
  const pocketHeaders = ['التاريخ', 'النوع', 'التصنيف', 'المبلغ', 'المسدد', 'المتبقي', 'الحالة', 'البيان'];
  const pocketRows = state.pocketTransactions.map((p) => [
    p.date,
    p.type === 'withdrawal'
      ? 'سحب'
      : p.type === 'support_profit'
      ? 'دعم أرباح 20%'
      : p.type === 'support_salary'
      ? 'دعم من القبض'
      : 'سداد',
    p.category || '',
    p.amount,
    p.repaidAmount || 0,
    p.amount - (p.repaidAmount || 0),
    p.status,
    p.description,
  ]);
  XLSX.utils.book_append_sheet(wb, createStyledSheet(pocketHeaders, pocketRows, { green: [4], red: [3, 5] }), 'حركات بوكيت');

  // 6. ميزانية القبض ومصروفاتها (Salary Budget)
  const salaryHeaders = ['بند الميزانية', 'المعيّن', 'المنصرف', 'المتبقي', 'نوع البند'];
  const salaryRows = state.salaryBudget.map((b) => [
    b.name,
    b.budgeted,
    b.spent,
    b.budgeted - b.spent,
    b.isPocketSupport ? 'دعم بوكيت للطوارئ' : 'مصروف شهري',
  ]);
  XLSX.utils.book_append_sheet(wb, createStyledSheet(salaryHeaders, salaryRows, { red: [2], green: [1, 3] }), 'ميزانية القبض ومصروفاتها');

  // 7. الصدقة (Charity Records)
  const charityHeaders = ['التاريخ', 'نوع الحركة', 'المبلغ', 'كود الأوردر', 'البيان'];
  const charityRows = state.charityRecords.map((c) => [
    c.date,
    c.type === 'inflow_order' ? 'وارد أرباح أوردر (10%)' : 'صرف صدقة',
    c.amount,
    c.orderCode || '',
    c.description,
  ]);
  XLSX.utils.book_append_sheet(wb, createStyledSheet(charityHeaders, charityRows, { green: [2] }), 'الصدقة');

  // 8. مصاريف الشنطة (Bag Expenses)
  const bagHeaders = ['التاريخ', 'الوقت', 'المبلغ', 'البيان', 'توجيه التكلفة', 'الجهة المرتبطة'];
  const bagRows = state.currentTrip.expenses.map((e) => [
    e.date,
    e.time || '',
    e.amount,
    e.description,
    e.route === 'order'
      ? 'أوردر'
      : e.route === 'salary'
      ? 'قبض'
      : e.route === 'pocket_advance'
      ? 'سلفة بوكيت'
      : e.route === 'capital_advance'
      ? 'سلفة رأس مال'
      : e.route === 'capital_settlement'
      ? 'تسوية رأس مال'
      : 'غير مصنف',
    e.targetName || '',
  ]);
  XLSX.utils.book_append_sheet(wb, createStyledSheet(bagHeaders, bagRows, { red: [2] }), 'مصاريف الشنطة');

  // 9. الموردين والمكاتب (Suppliers / Offices)
  const officeMasterHeaders = ['اسم المكتب / المورد المعتمد', 'عدد الأصناف المرتبطة'];
  const officeMasterRows = (state.settings.registeredOffices || []).map((name) => {
    const count = state.officeItems.filter((i) => i.officeName === name).length;
    return [name, count];
  });
  XLSX.utils.book_append_sheet(wb, createStyledSheet(officeMasterHeaders, officeMasterRows), 'الموردين والمكاتب');

  const now = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `العمار_ستور_التقرير_المالي_${now}.xlsx`);
}
