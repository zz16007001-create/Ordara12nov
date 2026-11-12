/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AppDataState,
  AppSettings,
  CapitalTransaction,
  CharityRecord,
  OfficeItem,
  Order,
  OrderItem,
  PageId,
  PocketCategory,
  PocketTransaction,
  SalaryBudgetItem,
  SalaryExpenseRecord,
  BagTrip,
  BagExpense,
  BagFundSource,
  PaymentMethod,
  PocketRepayStatus,
  TreasurySourceType,
  BagCustodyReturn,
  Customer,
  CustomerPayment,
  CustomerNote,
  DeliveryMode,
} from '../types';
import {
  DEFAULT_SETTINGS,
  getCleanEmptyState,
  loadStateFromStorage,
  saveStateToStorage,
  exportStateToJson,
  importStateFromJson,
  exportToExcel,
} from '../services/storage';
import { recordAuditEntry, removeAuditEntryBySourceId } from '../services/auditStorage';

// -------------------------------------------------------------
// Helpers: كل حساب الأرباح على الكاش المحصّل فعلاً (نفس المعادلة في كل مكان)
// -------------------------------------------------------------
const itemCashReceived = (it: OrderItem): number =>
  it.isSold ? (it.paidAmount !== undefined ? it.paidAmount : (it.soldPrice || 0) * (it.quantity || 1)) : 0;

const orderCashReceived = (o: Order): number => o.items.reduce((s, it) => s + itemCashReceived(it), 0);

const orderTotalCost = (o: Order): number =>
  o.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0) + (o.additionalBagCost || 0);

const orderRealizedProfit = (o: Order): number => Math.max(0, orderCashReceived(o) - orderTotalCost(o));

const newTxId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

/**
 * مطابقة سطر دعم البوكيت بالأوردر (تعديل 1):
 * - الأساس: orderId (رقم تعريف الأوردر اللي مش بيتكرر).
 * - الأسطر القديمة اللي معندهاش orderId أصلاً: بنطابق على اسم الأوردر "كاملاً" بس،
 *   يعني «أوردر رقم 1» ما يمسكش «أوردر رقم 10» (الحرف اللي بعد الكود مايكونش رقم).
 */
const descriptionHasOrderCode = (description: string | undefined, code: string | undefined): boolean => {
  if (!description || !code) return false;
  let from = 0;
  while (true) {
    const idx = description.indexOf(code, from);
    if (idx === -1) return false;
    const next = description.charAt(idx + code.length);
    if (!/[0-9\u0660-\u0669]/.test(next)) return true;
    from = idx + 1;
  }
};


const isPocketProfitRowOfOrder = (
  p: PocketTransaction,
  order: { id: string; code?: string }
): boolean =>
  p.type === 'support_profit' &&
  (p.orderId === order.id || (!p.orderId && descriptionHasOrderCode(p.description, order.code)));

/** يشيل صنف (أو أوردر كامل) من تفاصيل الدفعات، ويحذف الدفعة لو كلها كانت على الصنف ده */
const stripFromPayments = (
  payments: CustomerPayment[],
  match: { itemId?: string; orderId?: string }
): CustomerPayment[] => {
  const out: CustomerPayment[] = [];
  for (const p of payments) {
    if (p.kind === 'refund') {
      out.push(p);
      continue;
    }
    if (match.itemId && p.appliedToItemId === match.itemId) continue; // دفعة مقدمة قديمة على نفس الصنف
    const allocs = p.allocations;
    if (!allocs || allocs.length === 0) {
      out.push(p);
      continue;
    }
    const kept = allocs.filter((a) => !(match.itemId ? a.itemId === match.itemId : a.orderId === match.orderId));
    if (kept.length === allocs.length) {
      out.push(p);
      continue;
    }
    const removed = allocs.reduce((s, a) => s + a.amount, 0) - kept.reduce((s, a) => s + a.amount, 0);
    const newAmount = p.amount - removed;
    if (kept.length === 0 || newAmount <= 0.001) continue;
    out.push({ ...p, amount: newAmount, allocations: kept });
  }
  return out;
};

/**
 * مزامنة أسطر الأرباح الثلاثة للأوردر:
 * 1) نمو رأس المال (type='growth') بنسبة settings.profitShareCapital (افتراضياً 70%)
 * 2) دعم البوكيت (type='support_profit') بنسبة settings.profitSharePocket (افتراضياً 20%)
 * 3) الصدقة (type='inflow_order') بنسبة settings.profitShareCharity (افتراضياً 10%)
 * 
 * بدون تكرار أو أسطر عكس/إضافي:
 * - لكل أوردر سطر واحد فقط من كل نوع
 * - القيمة = النسبة × max(0, الكاش المحصل فعلاً - التكلفة الحالية)
 * - لو الربح صفر أو سالب، تُحذف أسطر الربح تماماً
 * - ينعكس أي تغيير في التكلفة أو الكاش فوراً
 */
export const syncOrderProfitRows = (
  order: Order,
  capitalTxs: CapitalTransaction[],
  pocketTxs: PocketTransaction[],
  charityRecords: CharityRecord[],
  settings: AppSettings,
  txDate?: string
): {
  capitalTransactions: CapitalTransaction[];
  pocketTransactions: PocketTransaction[];
  charityRecords: CharityRecord[];
} => {
  const currentCost = order.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0) + (order.additionalBagCost || 0);
  const cashReceived = order.items.filter((it) => it.isSold).reduce((s, it) => {
    return s + (it.paidAmount !== undefined ? it.paidAmount : (it.soldPrice || 0) * (it.quantity || 1));
  }, 0);

  const netProfit = Math.max(0, cashReceived - currentCost);

  const targetCap = netProfit > 0.0001 ? (netProfit * settings.profitShareCapital) / 100 : 0;
  const targetPocket = netProfit > 0.0001 ? (netProfit * settings.profitSharePocket) / 100 : 0;
  const targetCharity = netProfit > 0.0001 ? (netProfit * settings.profitShareCharity) / 100 : 0;

  const dateToUse = txDate || order.date || new Date().toISOString().split('T')[0];

  // 1. Capital growth row
  let updatedCapitalTxs: CapitalTransaction[];
  if (targetCap <= 0.0001) {
    updatedCapitalTxs = capitalTxs.filter((tx) => !(tx.type === 'growth' && tx.orderId === order.id));
  } else {
    const existingIndex = capitalTxs.findIndex((tx) => tx.type === 'growth' && tx.orderId === order.id);
    if (existingIndex >= 0) {
      const existing = capitalTxs[existingIndex];
      const otherTxs = capitalTxs.filter((tx, idx) => idx !== existingIndex && !(tx.type === 'growth' && tx.orderId === order.id));
      const updatedRow: CapitalTransaction = {
        ...existing,
        amount: targetCap,
        description: `نمو رأس المال من ربح ${order.code}`,
      };
      updatedCapitalTxs = [...otherTxs.slice(0, existingIndex), updatedRow, ...otherTxs.slice(existingIndex)];
    } else {
      const newRow: CapitalTransaction = {
        id: `cap_grow_${order.id}`,
        date: dateToUse,
        type: 'growth',
        amount: targetCap,
        description: `نمو رأس المال من ربح ${order.code}`,
        orderId: order.id,
      };
      updatedCapitalTxs = [newRow, ...capitalTxs];
    }
  }

  // 2. Pocket support_profit row
  let updatedPocketTxs: PocketTransaction[];
  if (targetPocket <= 0.0001) {
    updatedPocketTxs = pocketTxs.filter((p) => !isPocketProfitRowOfOrder(p, order));
  } else {
    const existingIndex = pocketTxs.findIndex((p) => isPocketProfitRowOfOrder(p, order));
    if (existingIndex >= 0) {
      const existing = pocketTxs[existingIndex];
      const otherTxs = pocketTxs.filter((p, idx) => idx !== existingIndex && !isPocketProfitRowOfOrder(p, order));
      const updatedRow: PocketTransaction = {
        ...existing,
        orderId: order.id,
        amount: targetPocket,
        description: `دعم بوكيت (${settings.profitSharePocket}% من ربح ${order.code})`,
        status: 'مسدد بالكامل',
      };
      updatedPocketTxs = [...otherTxs.slice(0, existingIndex), updatedRow, ...otherTxs.slice(existingIndex)];
    } else {
      const newRow: PocketTransaction = {
        id: `pock_prof_${order.id}`,
        date: dateToUse,
        type: 'support_profit',
        amount: targetPocket,
        description: `دعم بوكيت (${settings.profitSharePocket}% من ربح ${order.code})`,
        repaidAmount: 0,
        repayments: [],
        status: 'مسدد بالكامل',
        orderId: order.id,
      };
      updatedPocketTxs = [newRow, ...pocketTxs];
    }
  }

  // 3. Charity inflow_order row
  let updatedCharityRecords: CharityRecord[];
  if (targetCharity <= 0.0001) {
    updatedCharityRecords = charityRecords.filter(
      (c) => !(c.type === 'inflow_order' && (c.orderId === order.id || (order.code && c.orderCode === order.code)))
    );
  } else {
    const existingIndex = charityRecords.findIndex(
      (c) => c.type === 'inflow_order' && (c.orderId === order.id || (order.code && c.orderCode === order.code))
    );
    if (existingIndex >= 0) {
      const existing = charityRecords[existingIndex];
      const otherTxs = charityRecords.filter(
        (c, idx) => idx !== existingIndex && !(c.type === 'inflow_order' && (c.orderId === order.id || (order.code && c.orderCode === order.code)))
      );
      const updatedRow: CharityRecord = {
        ...existing,
        orderId: order.id,
        orderCode: order.code,
        amount: targetCharity,
        description: `${settings.profitShareCharity}% من صافي ربح ${order.code}`,
      };
      updatedCharityRecords = [...otherTxs.slice(0, existingIndex), updatedRow, ...otherTxs.slice(existingIndex)];
    } else {
      const newRow: CharityRecord = {
        id: `char_${order.id}`,
        date: dateToUse,
        type: 'inflow_order',
        amount: targetCharity,
        orderId: order.id,
        orderCode: order.code,
        description: `${settings.profitShareCharity}% من صافي ربح ${order.code}`,
      };
      updatedCharityRecords = [newRow, ...charityRecords];
    }
  }

  // مزامنة حركة السحب لشراء الأوردر مع التكلفة الحالية للأصناف
  updatedCapitalTxs = updatedCapitalTxs.map((tx) => {
    if (tx.type === 'order_creation' && tx.orderId === order.id) {
      return {
        ...tx,
        amount: currentCost,
        notes: `تكلفة ${order.items.length} صنف`,
      };
    }
    return tx;
  });

  return {
    capitalTransactions: updatedCapitalTxs,
    pocketTransactions: updatedPocketTxs,
    charityRecords: updatedCharityRecords,
  };
};

/** إعدادات اختيارية لفتح نافذة التسجيل السريع على وضع محدد (مثلاً: سداد سلفة بوكيت معينة) */
export interface QuickModalPreset {
  mode?: 'advance' | 'repay';
  pocketTxId?: string;
}

export interface DebtItem {
  id: string;
  type: 'capital' | 'pocket';
  title: string;
  originalAmount: number;
  repaidAmount: number;
  remainingAmount: number;
  date: string;
}

export interface AppContextValue {
  state: AppDataState;
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
  isLoading: boolean;
  
  // Settings Actions
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetToCleanState: () => void;
  backupToJson: () => void;
  restoreFromJson: (file: File) => Promise<void>;
  downloadExcelReport: () => void;

  // Capital Calculations & Actions
  baseCapital: number;
  liquidity: number;
  capitalAdvancesOpen: number;
  tiedInOrders: number;
  capitalGrowthTotal: number; // نمو رأس المال من الأرباح
  capitalErosionSettled: number; // إجمالي المبالغ المسواة فعلياً من رأس المال (أكل رأس المال)
  capitalErosionWithdrawn: number; // كم سحبت من رأس المال لتعويض بوكيت
  capitalErosionRepaid: number; // كم تم سداده
  capitalErosionOpen: number; // كم ما زال مفتوحاً
  capitalErosionRate: number; // نسبة سلف تعويض بوكيت من إجمالي السلف
  addCapitalAdvance: (amount: number, description: string, isForPocketCompensation?: boolean, notes?: string) => void;
  addCapitalSettlement: (amount: number, description: string, notes?: string) => void;
  addCapitalRepayment: (amount: number, description: string, debtId?: string, notes?: string) => void;

  // Pocket Calculations & Actions
  pocketBalance: number;
  pocketTotalWithdrawn: number;
  pocketTotalRepaid: number;
  pocketOpenDebt: number;
  pocketWarningActive: boolean;
  addPocketWithdrawal: (amount: number, category: PocketCategory, description: string, notes?: string) => void;
  addPocketRepayment: (
    transactionId: string,
    amount: number,
    notes?: string,
    source?: string,
    sourceTreasury?: 'salary' | 'cash' | 'other',
    salaryBudgetItemId?: string
  ) => void;
  addPocketSalarySupport: (amount: number, description: string, salaryBudgetItemId?: string) => void;
  updatePocketWithdrawal: (
    transactionId: string,
    updates: { amount: number; description: string; category?: PocketCategory; notes?: string }
  ) => void;
  deletePocketWithdrawal: (transactionId: string) => void;

  // Salary Calculations & Actions
  salaryTotalBudgeted: number;
  salaryTotalSpent: number;
  salaryTotalRemaining: number;
  updateSalaryBudgetItems: (items: SalaryBudgetItem[]) => void;
  addSalaryBudgetItem: (name: string, budgeted: number, isPocketSupport?: boolean) => void;
  deleteSalaryBudgetItem: (id: string) => void;
  recordSalaryExpense: (itemId: string, amount: number, isAdvancedFromPocket: boolean, notes?: string) => void;
  updateSalaryExpense: (expenseId: string, newAmount: number, newNotes?: string) => void;
  deleteSalaryExpense: (expenseId: string) => void;

  // Orders Actions
  createNewOrder: (code: string, items: { name: string; quantity: number; costPrice: number; officeName?: string; requestedByCustomerId?: string; size?: string; suggestedSellPrice?: number }[], notes?: string) => string;
  registerItemSale: (
    orderId: string,
    itemId: string,
    soldPrice: number,
    paymentMethod: PaymentMethod,
    soldDate?: string,
    paymentType?: 'cash' | 'credit' | 'partial',
    customerId?: string,
    initialPaidAmount?: number
  ) => void;
  updateOrderItem: (orderId: string, itemId: string, updates: Partial<OrderItem>) => void;
  deleteOrder: (orderId: string) => void;
  deleteOrderItem: (orderId: string, itemId: string) => void;
  addOrderItemToOrder: (orderId: string, item: { name: string; size?: string; quantity: number; costPrice: number }) => void;
  returnOrderItem: (orderId: string, itemId: string, refundAmount?: number) => void;
  settleOrderItem: (orderId: string, itemId: string) => void;
  toggleOrderFinished: (orderId: string) => void;
  reconcileOrderProfit: (orderBefore: Order, orderAfter: Order) => void;
  getOrderProfitImpact: (orderId: string) => { capitalGrowth: number; pocketSupport: number; charityInflow: number };

  // Customer & Debts Actions
  customers: Customer[];
  customerPayments: CustomerPayment[];
  customerNotes: CustomerNote[];
  addCustomer: (
    name: string,
    phone?: string,
    notes?: string,
    extra?: { address?: string; size?: string; messengerLink?: string; deliveryMode?: DeliveryMode }
  ) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addCustomerNote: (customerId: string, text: string, date?: string) => void;
  deleteCustomerNote: (noteId: string) => void;
  recordCustomerPayment: (customerId: string, amount: number, date?: string, notes?: string, itemId?: string) => void;
  cancelCustomerPayment: (paymentId: string) => void;

  // Office Actions
  addOfficeItem: (item: Omit<OfficeItem, 'id' | 'date' | 'isTransferredToOrder'>) => void;
  updateOfficeItem: (id: string, updates: Partial<OfficeItem>) => void;
  deleteOfficeItem: (id: string) => void;
  createOrderFromOfficeItems: (selectedItemIds: string[], orderCode?: string) => string;
  addRegisteredOffice: (name: string) => void;
  updateRegisteredOffice: (oldName: string, newName: string) => void;
  deleteRegisteredOffice: (name: string) => void;
  moveRegisteredOffice: (name: string, direction: 'up' | 'down') => void;

  // Bag / Trip Actions
  updateBagSources: (sources: BagFundSource[]) => void;
  addBagExpense: (expense: Omit<BagExpense, 'id' | 'date'>) => void;
  updateBagExpense: (expenseId: string, updates: Partial<BagExpense>) => void;
  deleteBagExpense: (expenseId: string) => void;
  reconcileCurrentTrip: (actualCashRemaining: number) => { success: boolean; difference: number; message: string };
  startNewTrip: () => void;

  // Charity Actions
  charityBalance: number;
  charityTotalInflow: number;
  charityTotalPaid: number;
  addCharitySettlement: (amount: number, notes?: string) => void;

  // Open Debts
  allOpenDebts: DebtItem[];

  // Quick Action Modal control
  isQuickModalOpen: boolean;
  openQuickModal: (defaultTab?: string, preset?: QuickModalPreset) => void;
  closeQuickModal: () => void;
  quickModalTab?: string;
  quickModalPreset?: QuickModalPreset;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppDataState>(getCleanEmptyState);
  const [currentPage, setCurrentPage] = useState<PageId>('entry');
  const [isLoading, setIsLoading] = useState(true);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickModalTab, setQuickModalTab] = useState<string | undefined>(undefined);
  const [quickModalPreset, setQuickModalPreset] = useState<QuickModalPreset | undefined>(undefined);

  // Initial Load
  useEffect(() => {
    let mounted = true;
    loadStateFromStorage().then((data) => {
      if (mounted) {
        setState({
          ...data,
          settings: { ...data.settings, darkMode: false },
        });
        setIsLoading(false);
        document.documentElement.classList.remove('dark');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Save changes to storage
  useEffect(() => {
    if (!isLoading) {
      saveStateToStorage(state);
      document.documentElement.classList.remove('dark');
    }
  }, [state, isLoading]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings, darkMode: false },
    }));
  }, []);

  const resetToCleanState = useCallback(() => {
    const clean = getCleanEmptyState();
    setState(clean);
  }, []);

  const backupToJson = useCallback(() => {
    exportStateToJson(state);
  }, [state]);

  const restoreFromJson = useCallback(async (file: File) => {
    const loaded = await importStateFromJson(file);
    setState(loaded);
  }, []);

  const downloadExcelReport = useCallback(() => {
    exportToExcel(state);
  }, [state]);

  // Quick modal helpers
  const openQuickModal = useCallback((defaultTab?: string, preset?: QuickModalPreset) => {
    setQuickModalTab(defaultTab);
    setQuickModalPreset(preset);
    setIsQuickModalOpen(true);
  }, []);

  const closeQuickModal = useCallback(() => {
    setIsQuickModalOpen(false);
    setQuickModalTab(undefined);
    setQuickModalPreset(undefined);
  }, []);

  // -------------------------------------------------------------
  // CALCULATIONS: Capital
  // -------------------------------------------------------------
  const {
    baseCapital,
    capitalAdvancesOpen,
    capitalGrowthTotal,
    capitalErosionSettled,
    capitalErosionWithdrawn,
    capitalErosionRepaid,
    capitalErosionOpen,
    capitalErosionRate,
  } = useMemo(() => {
    let settlements = 0;
    let advances = 0;
    let repayments = 0;
    let growth = 0;
    let erosionWithdrawn = 0;
    let erosionRepaid = 0;

    for (const tx of state.capitalTransactions) {
      if (tx.type === 'settlement') {
        settlements += tx.amount;
      } else if (tx.type === 'advance') {
        advances += tx.amount;
        if (tx.isForPocketCompensation) {
          erosionWithdrawn += tx.amount;
        }
      } else if (tx.type === 'repayment') {
        repayments += tx.amount;
        if (tx.description?.includes('تعويض بوكيت') || tx.notes?.includes('تعويض بوكيت')) {
          erosionRepaid += tx.amount;
        }
      } else if (tx.type === 'growth') {
        growth += tx.amount;
      }
    }

    const base = state.settings.initialCapital - settlements + growth;
    const openAdvances = Math.max(0, advances - repayments);
    const erosionOpen = Math.max(0, erosionWithdrawn - erosionRepaid);
    const erosionRate = advances > 0 ? (erosionWithdrawn / advances) * 100 : 0;

    return {
      baseCapital: base,
      capitalAdvancesOpen: openAdvances,
      capitalGrowthTotal: growth,
      capitalErosionSettled: settlements,
      capitalErosionWithdrawn: erosionWithdrawn,
      capitalErosionRepaid: erosionRepaid,
      capitalErosionOpen: erosionOpen,
      capitalErosionRate: erosionRate,
    };
  }, [state.settings.initialCapital, state.capitalTransactions]);

  // Calculate Tied in Orders
  const tiedInOrders = useMemo(() => {
    let tied = 0;
    for (const o of state.orders) {
      const cost = o.items.reduce((s, it) => s + it.costPrice * it.quantity, 0) + (o.additionalBagCost || 0);
      const cashReceived = o.items.filter((it) => it.isSold).reduce((s, it) => s + (it.paidAmount !== undefined ? it.paidAmount : (it.soldPrice || 0) * it.quantity), 0);
      const capitalRecovered = Math.min(cost, cashReceived);
      const orderTied = Math.max(0, cost - capitalRecovered);
      tied += orderTied;
    }
    return tied;
  }, [state.orders]);

  // Liquidity (السيولة)
  const liquidity = useMemo(() => {
    return baseCapital - tiedInOrders - capitalAdvancesOpen;
  }, [baseCapital, tiedInOrders, capitalAdvancesOpen]);

  // -------------------------------------------------------------
  // CALCULATIONS: Pocket
  // -------------------------------------------------------------
  const { pocketBalance, pocketTotalWithdrawn, pocketTotalRepaid, pocketOpenDebt } = useMemo(() => {
    let withdrawn = 0;
    let repaid = 0;
    let profitSupport = 0;
    let salarySupport = 0;

    for (const p of state.pocketTransactions) {
      if (p.type === 'withdrawal') {
        withdrawn += p.amount;
        repaid += p.repaidAmount || 0;
      } else if (p.type === 'support_profit') {
        profitSupport += p.amount;
      } else if (p.type === 'support_salary') {
        salarySupport += p.amount;
      } else if (p.type === 'repayment') {
        repaid += p.amount;
      }
    }

    const balance = state.settings.initialPocket + profitSupport + salarySupport + repaid - withdrawn;
    const openDebt = Math.max(0, withdrawn - repaid);

    return {
      pocketBalance: balance,
      pocketTotalWithdrawn: withdrawn,
      pocketTotalRepaid: repaid,
      pocketOpenDebt: openDebt,
    };
  }, [state.settings.initialPocket, state.pocketTransactions]);

  const pocketWarningActive = useMemo(() => {
    return pocketBalance <= state.settings.pocketWarningThreshold;
  }, [pocketBalance, state.settings.pocketWarningThreshold]);

  // -------------------------------------------------------------
  // CALCULATIONS: Salary
  // -------------------------------------------------------------
  const { salaryTotalBudgeted, salaryTotalSpent, salaryTotalRemaining } = useMemo(() => {
    const budgeted = state.salaryBudget.reduce((s, b) => s + (b.budgeted || 0), 0);
    const spent = state.salaryBudget.reduce((s, b) => s + (b.spent || 0), 0);
    return {
      salaryTotalBudgeted: budgeted,
      salaryTotalSpent: spent,
      salaryTotalRemaining: budgeted - spent,
    };
  }, [state.salaryBudget]);

  // -------------------------------------------------------------
  // CALCULATIONS: Charity
  // -------------------------------------------------------------
  const { charityBalance, charityTotalInflow, charityTotalPaid } = useMemo(() => {
    let inflow = 0;
    let paid = 0;
    for (const c of state.charityRecords) {
      if (c.type === 'inflow_order') {
        inflow += c.amount;
      } else if (c.type === 'settlement') {
        paid += c.amount;
      }
    }
    return {
      charityBalance: Math.max(0, inflow - paid),
      charityTotalInflow: inflow,
      charityTotalPaid: paid,
    };
  }, [state.charityRecords]);

  // -------------------------------------------------------------
  // CALCULATIONS: Open Debts List (for manual repayments)
  // -------------------------------------------------------------
  const allOpenDebts = useMemo<DebtItem[]>(() => {
    const list: DebtItem[] = [];

    // Capital open advance
    if (capitalAdvancesOpen > 0) {
      list.push({
        id: 'capital_debt_primary',
        type: 'capital',
        title: 'سلف رأس المال المفتوحة',
        originalAmount: capitalAdvancesOpen,
        repaidAmount: 0,
        remainingAmount: capitalAdvancesOpen,
        date: new Date().toISOString().split('T')[0],
      });
    }

    // Pocket unpaid withdrawals
    for (const p of state.pocketTransactions) {
      if (p.type === 'withdrawal') {
        const remaining = p.amount - (p.repaidAmount || 0);
        if (remaining > 0) {
          list.push({
            id: p.id,
            type: 'pocket',
            title: `سلفة بوكيت: ${p.description || p.category || 'سحب'}`,
            originalAmount: p.amount,
            repaidAmount: p.repaidAmount || 0,
            remainingAmount: remaining,
            date: p.date,
          });
        }
      }
    }

    return list.sort((a, b) => b.remainingAmount - a.remainingAmount);
  }, [capitalAdvancesOpen, state.pocketTransactions]);

  // -------------------------------------------------------------
  // ACTIONS: Capital
  // -------------------------------------------------------------
  const addCapitalAdvance = useCallback((amount: number, description: string, isForPocketCompensation?: boolean, notes?: string) => {
    const tx: CapitalTransaction = {
      id: 'cap_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: 'advance',
      amount,
      description,
      isForPocketCompensation,
      notes,
    };
    setState((prev) => ({
      ...prev,
      capitalTransactions: [tx, ...prev.capitalTransactions],
    }));
  }, []);

  const addCapitalSettlement = useCallback((amount: number, description: string, notes?: string) => {
    const tx: CapitalTransaction = {
      id: 'cap_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: 'settlement',
      amount,
      description,
      notes,
    };
    setState((prev) => ({
      ...prev,
      capitalTransactions: [tx, ...prev.capitalTransactions],
    }));
  }, []);

  const addCapitalRepayment = useCallback((amount: number, description: string, debtId?: string, notes?: string) => {
    const tx: CapitalTransaction = {
      id: 'cap_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: 'repayment',
      amount,
      description,
      debtId,
      notes,
    };
    setState((prev) => ({
      ...prev,
      capitalTransactions: [tx, ...prev.capitalTransactions],
    }));
  }, []);

  // -------------------------------------------------------------
  // ACTIONS: Pocket
  // -------------------------------------------------------------
  const addPocketWithdrawal = useCallback((amount: number, category: PocketCategory, description: string, notes?: string) => {
    const tx: PocketTransaction = {
      id: 'pock_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: 'withdrawal',
      amount,
      category,
      description,
      repaidAmount: 0,
      repayments: [],
      status: 'غير مسدد',
      notes,
    };
    setState((prev) => ({
      ...prev,
      pocketTransactions: [tx, ...prev.pocketTransactions],
    }));
  }, []);

  const addPocketRepayment = useCallback((
    transactionId: string,
    amount: number,
    notes?: string,
    source?: string,
    sourceTreasury?: 'salary' | 'cash' | 'other',
    salaryBudgetItemId?: string
  ) => {
    const date = new Date().toISOString().split('T')[0];
    setState((prev) => {
      let budgetItemName = '';
      const updatedSalaryBudget = prev.salaryBudget.map((b) => {
        if (sourceTreasury === 'salary' && b.id === salaryBudgetItemId) {
          budgetItemName = b.name;
          return { ...b, spent: b.spent + amount };
        }
        return b;
      });

      const newSalaryExpenses = [...prev.salaryExpenses];
      if (sourceTreasury === 'salary' && salaryBudgetItemId) {
        newSalaryExpenses.unshift({
          id: 'sexp_' + Date.now(),
          itemId: salaryBudgetItemId,
          itemName: budgetItemName || 'بند ميزانية',
          amount,
          date,
          isAdvancedFromPocket: false,
          notes: `سداد سلفة بوكيت: ${notes || ''}`,
        });
      }

      const updatedList = prev.pocketTransactions.map((tx) => {
        if (tx.id === transactionId) {
          const newRepaid = (tx.repaidAmount || 0) + amount;
          const status: PocketRepayStatus = newRepaid >= tx.amount ? 'مسدد بالكامل' : newRepaid > 0 ? 'جزئي' : 'غير مسدد';
          return {
            ...tx,
            repaidAmount: newRepaid,
            status,
            repayments: [
              ...(tx.repayments || []),
              {
                id: 'prep_' + Date.now(),
                date,
                amount,
                notes,
                source: source || (sourceTreasury === 'salary' ? `القبض (${budgetItemName})` : 'سداد يدوي'),
                sourceTreasury,
                salaryBudgetItemId,
                salaryBudgetItemName: budgetItemName,
              },
            ],
          };
        }
        return tx;
      });

      return {
        ...prev,
        salaryBudget: updatedSalaryBudget,
        salaryExpenses: newSalaryExpenses,
        pocketTransactions: updatedList,
      };
    });
  }, []);

  const addPocketSalarySupport = useCallback((amount: number, description: string, salaryBudgetItemId?: string) => {
    const date = new Date().toISOString().split('T')[0];
    setState((prev) => {
      let budgetItemName = '';
      const updatedSalaryBudget = prev.salaryBudget.map((b) => {
        if (salaryBudgetItemId && b.id === salaryBudgetItemId) {
          budgetItemName = b.name;
          return { ...b, spent: b.spent + amount };
        }
        return b;
      });

      const tx: PocketTransaction = {
        id: 'pock_' + Date.now(),
        date,
        type: 'support_salary',
        amount,
        description: description || `دعم بوكيت من القبض${budgetItemName ? ` (${budgetItemName})` : ''}`,
        repaidAmount: 0,
        repayments: [],
        status: 'مسدد بالكامل',
      };

      return {
        ...prev,
        salaryBudget: updatedSalaryBudget,
        pocketTransactions: [tx, ...prev.pocketTransactions],
      };
    });
  }, []);

  // تعديل سلفة بوكيت (المبلغ / البيان / التصنيف / الملاحظات) مع إعادة حساب حالة السداد
  const updatePocketWithdrawal = useCallback((
    transactionId: string,
    updates: { amount: number; description: string; category?: PocketCategory; notes?: string }
  ) => {
    setState((prev) => {
      const target = prev.pocketTransactions.find((t) => t.id === transactionId);
      if (!target || target.type !== 'withdrawal') return prev;
      const repaid = target.repaidAmount || 0;
      // لا يمكن أن يقل مبلغ السلفة عن ما تم سداده منها فعلاً
      const newAmount = Math.max(updates.amount, repaid);
      const status: PocketRepayStatus =
        repaid >= newAmount ? 'مسدد بالكامل' : repaid > 0 ? 'جزئي' : 'غير مسدد';
      return {
        ...prev,
        pocketTransactions: prev.pocketTransactions.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                amount: newAmount,
                description: updates.description,
                category: updates.category ?? t.category,
                notes: updates.notes,
                status,
              }
            : t
        ),
      };
    });
  }, []);

  // حذف سلفة بوكيت نهائياً مع عكس أي سداد تم من القبض (يرجع المصروف لبند القبض)
  const deletePocketWithdrawal = useCallback((transactionId: string) => {
    setState((prev) => {
      const target = prev.pocketTransactions.find((t) => t.id === transactionId);
      if (!target || target.type !== 'withdrawal') return prev;

      let salaryBudget = prev.salaryBudget;
      let salaryExpenses = prev.salaryExpenses;
      for (const rep of target.repayments || []) {
        if (rep.sourceTreasury !== 'salary' || !rep.salaryBudgetItemId) continue;
        const expectedNotes = `سداد سلفة بوكيت: ${rep.notes || ''}`;
        const idx = salaryExpenses.findIndex(
          (e) =>
            e.itemId === rep.salaryBudgetItemId &&
            e.amount === rep.amount &&
            e.date === rep.date &&
            e.notes === expectedNotes
        );
        if (idx >= 0) {
          salaryExpenses = salaryExpenses.filter((_, i) => i !== idx);
          salaryBudget = salaryBudget.map((b) =>
            b.id === rep.salaryBudgetItemId ? { ...b, spent: Math.max(0, b.spent - rep.amount) } : b
          );
        }
      }

      return {
        ...prev,
        salaryBudget,
        salaryExpenses,
        pocketTransactions: prev.pocketTransactions.filter((t) => t.id !== transactionId),
      };
    });
  }, []);

  // -------------------------------------------------------------
  // ACTIONS: Orders
  // -------------------------------------------------------------
  const createNewOrder = useCallback((
    code: string,
    items: { name: string; quantity: number; costPrice: number; officeName?: string; requestedByCustomerId?: string; size?: string; suggestedSellPrice?: number }[],
    notes?: string
  ): string => {
    const orderId = 'ord_' + Date.now();
    const date = new Date().toISOString().split('T')[0];
    const fullItems: OrderItem[] = items.map((it, idx) => ({
      id: `item_${Date.now()}_${idx}`,
      name: it.name,
      quantity: it.quantity || 1,
      costPrice: it.costPrice,
      isSold: false,
      officeName: it.officeName,
      requestedByCustomerId: it.requestedByCustomerId,
      size: it.size,
      suggestedSellPrice: it.suggestedSellPrice,
    }));

    const totalCost = fullItems.reduce((s, it) => s + it.costPrice * it.quantity, 0);

    let assignedCode = code?.trim();
    let nextCounter = state.orderCounter || 1;

    if (!assignedCode) {
      let maxNum = 0;
      for (const o of state.orders) {
        const match = o.code.match(/(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
      const numToUse = Math.max(maxNum + 1, nextCounter);
      assignedCode = `أوردر رقم ${numToUse}`;
      nextCounter = numToUse + 1;
    } else {
      const match = assignedCode.match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n >= nextCounter) nextCounter = n + 1;
      }
    }

    const newOrder: Order = {
      id: orderId,
      code: assignedCode,
      date,
      items: fullItems,
      additionalBagCost: 0,
      notes,
    };

    // Capital deduction once for order creation
    const capitalTx: CapitalTransaction = {
      id: 'cap_ord_' + Date.now(),
      date,
      type: 'order_creation',
      amount: totalCost,
      description: `سحب لشراء ${newOrder.code}`,
      orderId,
      notes: `تكلفة ${fullItems.length} صنف`,
    };

    setState((prev) => ({
      ...prev,
      orders: [newOrder, ...prev.orders],
      capitalTransactions: [capitalTx, ...prev.capitalTransactions],
      orderCounter: nextCounter,
    }));

    return orderId;
  }, [state.orders, state.orderCounter]);

  const registerItemSale = useCallback((
    orderId: string,
    itemId: string,
    soldPrice: number,
    paymentMethod: PaymentMethod,
    soldDate?: string,
    paymentType: 'cash' | 'credit' | 'partial' = 'cash',
    customerId?: string,
    initialPaidAmount?: number
  ) => {
    const date = soldDate || new Date().toISOString().split('T')[0];

    setState((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;

      const orderCost = order.items.reduce((s, it) => s + it.costPrice * it.quantity, 0) + (order.additionalBagCost || 0);

      // Old cash collected
      const oldCashReceived = order.items.reduce((s, it) => {
        if (!it.isSold) return s;
        return s + (it.paidAmount !== undefined ? it.paidAmount : (it.soldPrice || 0) * it.quantity);
      }, 0);
      const oldRealizedProfit = Math.max(0, oldCashReceived - orderCost);

      const updatedItems = order.items.map((it) => {
        if (it.id === itemId) {
          const totalSale = soldPrice * (it.quantity || 1);
          let paid = totalSale;
          if (paymentType === 'credit') {
            paid = 0;
          } else if (paymentType === 'partial') {
            paid = Math.min(totalSale, Math.max(0, initialPaidAmount || 0));
          }

          return {
            ...it,
            isSold: true,
            soldPrice,
            soldDate: date,
            soldAt: new Date().toISOString(),
            paymentMethod,
            paymentType,
            customerId: customerId || undefined,
            paidAmount: paid,
          };
        }
        return it;
      });

      const updatedOrder = { ...order, items: updatedItems };

      // 7-أ: تسجيل سطر المراجعة لحظة البيع
      const targetItem = order.items.find((it) => it.id === itemId);
      if (targetItem) {
        const cust = customerId
          ? (prev.customers || []).find((c) => c.id === customerId)
          : undefined;
        const totalSalePrice = soldPrice * (targetItem.quantity || 1);
        let actualPaid = totalSalePrice;
        let paymentStatusText = 'نقدي كامل';

        if (paymentType === 'credit') {
          actualPaid = 0;
          paymentStatusText = `آجل بالكامل | متبقي ${totalSalePrice}`;
        } else if (paymentType === 'partial') {
          actualPaid = Math.min(totalSalePrice, Math.max(0, initialPaidAmount || 0));
          paymentStatusText = `دفع جزء | مدفوع ${actualPaid} | متبقي ${totalSalePrice - actualPaid}`;
        }

        const detailsText = paymentType === 'cash'
          ? `الكمية: ${targetItem.quantity || 1} | سعر البيع: ${soldPrice} ${prev.settings.currency} | طريقة الدفع: ${paymentMethod || 'نقدية (كاش)'} | ${paymentStatusText}`
          : `الكمية: ${targetItem.quantity || 1} | سعر البيع: ${soldPrice} ${prev.settings.currency} | ${paymentStatusText}`;

        recordAuditEntry({
          sourceId: `sale_${order.id}_${itemId}_${date}`,
          type: 'sale',
          title: `${targetItem.name}${targetItem.size ? ` (مقاس ${targetItem.size})` : ''}`,
          itemName: targetItem.name,
          itemSize: targetItem.size,
          orderCode: order.code,
          customerName: cust?.name,
          amount: actualPaid,
          actionDate: date,
          details: detailsText,
        });
      }

      let newPayments = prev.customerPayments || [];
      if (customerId && paymentType === 'partial' && initialPaidAmount && initialPaidAmount > 0) {
        newPayments = [
          {
            id: newTxId('pay'),
            customerId,
            date,
            createdAt: new Date().toISOString(),
            amount: Math.min(initialPaidAmount, soldPrice * ((order.items.find((i) => i.id === itemId)?.quantity) || 1)),
            notes: `دفعة مقدمة عند بيع صنف بأوردر ${order.code}`,
            orderId: order.id,
            appliedToItemId: itemId,
            kind: 'payment',
            allocations: [
              {
                itemId,
                orderId: order.id,
                amount: Math.min(initialPaidAmount, soldPrice * ((order.items.find((i) => i.id === itemId)?.quantity) || 1)),
              },
            ],
          },
          ...newPayments,
        ];
      }

      const synced = syncOrderProfitRows(
        updatedOrder,
        prev.capitalTransactions,
        prev.pocketTransactions,
        prev.charityRecords,
        prev.settings,
        date
      );

      return {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
        customerPayments: newPayments,
        capitalTransactions: synced.capitalTransactions,
        pocketTransactions: synced.pocketTransactions,
        charityRecords: synced.charityRecords,
      };
    });
  }, []);

  const reconcileOrderProfit = useCallback((_orderBefore: Order, orderAfter: Order) => {
    setState((prev) => {
      const synced = syncOrderProfitRows(
        orderAfter,
        prev.capitalTransactions,
        prev.pocketTransactions,
        prev.charityRecords,
        prev.settings
      );
      return {
        ...prev,
        capitalTransactions: synced.capitalTransactions,
        pocketTransactions: synced.pocketTransactions,
        charityRecords: synced.charityRecords,
      };
    });
  }, []);

  const updateOrderItem = useCallback((orderId: string, itemId: string, updates: Partial<OrderItem>) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;

      const updatedItems = order.items.map((it) => {
        if (it.id !== itemId) return it;
        const merged = { ...it, ...updates };
        // لو اتعدّل سعر البيع: المدفوع يفضل زي ما هو (والزيادة تبقى دين ظاهر) ومايزيدش عن الإجمالي الجديد
        if (it.isSold && updates.soldPrice !== undefined && !it.isSettled) {
          const newTotal = (merged.soldPrice || 0) * (merged.quantity || 1);
          const oldTotal = (it.soldPrice || 0) * (it.quantity || 1);
          const oldPaid = it.paidAmount !== undefined ? it.paidAmount : oldTotal;
          const newPaid = Math.min(oldPaid, newTotal);
          merged.paidAmount = newPaid;
          merged.paymentType = newPaid >= newTotal - 0.001 ? 'cash' : newPaid > 0 ? 'partial' : 'credit';
        }
        return merged;
      });
      const updatedOrder = { ...order, items: updatedItems };

      const synced = syncOrderProfitRows(
        updatedOrder,
        prev.capitalTransactions,
        prev.pocketTransactions,
        prev.charityRecords,
        prev.settings
      );

      return {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
        capitalTransactions: synced.capitalTransactions,
        pocketTransactions: synced.pocketTransactions,
        charityRecords: synced.charityRecords,
      };
    });
  }, []);

  const returnOrderItem = useCallback((orderId: string, itemId: string, refundAmount?: number) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;

      const targetItem = order.items.find((it) => it.id === itemId);
      if (targetItem && targetItem.isSold) {
        const cust = targetItem.customerId
          ? (prev.customers || []).find((c) => c.id === targetItem.customerId)
          : undefined;
        const totalSold = (targetItem.soldPrice || 0) * (targetItem.quantity || 1);
        const actualPaid = targetItem.paidAmount !== undefined ? targetItem.paidAmount : totalSold;
        const returnPrice = targetItem.soldPrice || 0;
        const returnQty = targetItem.quantity || 1;
        const returnDate = new Date().toISOString().split('T')[0];
        const soldInstance = targetItem.soldDate || returnDate;
        // الصنف المُسوّى ماكانش فيه فلوس داخلة أصلاً (التسوية خسارة اتخصمت من رأس المال)، فمفيش نقدية مسترجعة
        const wasSettled = !!targetItem.isSettled;
        const auditAmount = wasSettled ? 0 : actualPaid;
        const refundDetailsText = wasSettled
          ? 'صنف مُسوّى: لا توجد نقدية مسترجعة (تم إلغاء حركة التسوية)'
          : actualPaid === 0
          ? 'آجل: لا توجد نقدية مسترجعة'
          : `المسترد: ${actualPaid} من ${totalSold}`;

        recordAuditEntry({
          sourceId: `return_${order.id}_${targetItem.id}_${soldInstance}_${returnPrice}`,
          type: 'return',
          title: targetItem.name,
          itemName: targetItem.name,
          itemSize: targetItem.size,
          orderCode: order.code,
          customerName: cust?.name,
          amount: auditAmount,
          actionDate: returnDate,
          details: `مرتجع مبيعات | الكمية: ${returnQty} | ${refundDetailsText}${targetItem.size ? ` | المقاس: ${targetItem.size}` : ''}${order.code ? ` | الأوردر: ${order.code}` : ''}${cust?.name ? ` | العميل: ${cust.name}` : ''}`,
        });
      }

      const updatedItems = order.items.map((it) => {
        if (it.id === itemId) {
          const { soldPrice, soldDate, paymentMethod, paymentType, paidAmount, customerId, isSettled, ...rest } = it;
          // لو الصنف كان مُسوّى: نشيل علامة «مُسوّى» وكلمة (تسوية) اللي اتضافت على ملاحظاته
          let cleanedNotes = rest.notes;
          if (isSettled && cleanedNotes) {
            cleanedNotes = cleanedNotes === 'تسوية' ? undefined : cleanedNotes.replace(/ \(تسوية\)$/, '');
            if (cleanedNotes !== undefined && cleanedNotes.trim() === '') cleanedNotes = undefined;
          }
          return {
            ...rest,
            notes: cleanedNotes,
            isSold: false,
          };
        }
        return it;
      });

      const updatedOrder = { ...order, items: updatedItems };

      // لو الصنف كان مُسوّى: نلغي حركة التسوية بتاعته من رأس المال (عشان ماتتخصمش مرتين)
      let capitalBase = prev.capitalTransactions;
      if (targetItem && targetItem.isSettled) {
        const itemCostTotal = targetItem.costPrice * (targetItem.quantity || 1);
        let settlementIdx = capitalBase.findIndex(
          (tx) => tx.type === 'settlement' && tx.orderId === order.id && tx.itemId === targetItem.id
        );
        if (settlementIdx === -1) {
          // حركات تسوية قديمة اتسجلت قبل ما نربطها بالصنف: نطابق بالأوردر + المبلغ + اسم الصنف
          settlementIdx = capitalBase.findIndex(
            (tx) =>
              tx.type === 'settlement' &&
              tx.orderId === order.id &&
              !tx.itemId &&
              Math.abs(tx.amount - itemCostTotal) < 0.001 &&
              !!tx.description &&
              tx.description.includes(`تسوية صنف ${targetItem.name} من`)
          );
        }
        if (settlementIdx !== -1) {
          capitalBase = capitalBase.filter((_, idx) => idx !== settlementIdx);
        }
      }

      const synced = syncOrderProfitRows(
        updatedOrder,
        capitalBase,
        prev.pocketTransactions,
        prev.charityRecords,
        prev.settings
      );

      // شيل الصنف ده من تفاصيل دفعات العميل
      const updatedPayments = stripFromPayments(prev.customerPayments || [], { itemId });

      // سطر استرداد في حساب العميل (توثيق للفلوس اللي اتردّت له)
      let refundRecord: CustomerPayment | null = null;
      if (targetItem && targetItem.customerId && refundAmount && refundAmount > 0) {
        refundRecord = {
          id: newTxId('refund'),
          customerId: targetItem.customerId,
          date: new Date().toISOString().split('T')[0],
          amount: refundAmount,
          notes: `استرداد عند ارتجاع ${targetItem.name} من ${order.code}`,
          orderId: order.id,
          kind: 'refund',
        };
      }

      return {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
        customerPayments: refundRecord ? [refundRecord, ...updatedPayments] : updatedPayments,
        capitalTransactions: synced.capitalTransactions,
        pocketTransactions: synced.pocketTransactions,
        charityRecords: synced.charityRecords,
      };
    });
  }, []);

  const settleOrderItem = useCallback((orderId: string, itemId: string) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;
      const targetItem = order.items.find((i) => i.id === itemId);
      if (!targetItem || targetItem.isSold) return prev;

      const today = new Date().toISOString().split('T')[0];
      const itemCostTotal = targetItem.costPrice * (targetItem.quantity || 1);

      const updatedItems = order.items.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            isSold: true,
            soldPrice: it.costPrice,
            soldDate: today,
            soldAt: new Date().toISOString(),
            notes: it.notes ? `${it.notes} (تسوية)` : 'تسوية',
            isSettled: true,
          };
        }
        return it;
      });

      const updatedOrder = { ...order, items: updatedItems };

      const settlementTx: CapitalTransaction = {
        id: newTxId('cap_set'),
        date: today,
        type: 'settlement',
        amount: itemCostTotal,
        description: `تسوية صنف ${targetItem.name} من ${order.code}`,
        orderId: order.id,
        itemId: targetItem.id, // عشان ارتجاع الصنف يلغي حركة التسوية دي بالظبط
      };

      return {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
        capitalTransactions: [settlementTx, ...prev.capitalTransactions],
      };
    });
  }, []);

  const getOrderProfitImpact = useCallback((orderId: string) => {
    const targetOrder = state.orders.find((o) => o.id === orderId);
    const targetRef = { id: orderId, code: targetOrder ? targetOrder.code : '' };
    let cap = 0;
    let pock = 0;
    let char = 0;
    for (const tx of state.capitalTransactions) {
      if (tx.orderId === orderId && tx.type === 'growth') {
        cap += tx.amount;
      }
    }
    for (const p of state.pocketTransactions) {
      if (isPocketProfitRowOfOrder(p, targetRef)) {
        pock += p.amount;
      }
    }
    for (const c of state.charityRecords) {
      if (c.orderId === orderId && c.type === 'inflow_order') {
        char += c.amount;
      }
    }
    return { capitalGrowth: cap, pocketSupport: pock, charityInflow: char };
  }, [state.orders, state.capitalTransactions, state.pocketTransactions, state.charityRecords]);

  const deleteOrder = useCallback((orderId: string) => {
    setState((prev) => {
      const targetOrder = prev.orders.find((o) => o.id === orderId);
      const targetRef = { id: orderId, code: targetOrder ? targetOrder.code : '' };
      return {
        ...prev,
        orders: prev.orders.filter((o) => o.id !== orderId),
        customerPayments: stripFromPayments(prev.customerPayments || [], { orderId }),
        capitalTransactions: prev.capitalTransactions.filter((tx) => tx.orderId !== orderId),
        charityRecords: prev.charityRecords.filter((c) => c.orderId !== orderId),
        pocketTransactions: prev.pocketTransactions.filter((p) => {
          if (p.orderId && p.orderId === orderId) return false;
          // أسطر قديمة من غير orderId: بنطابق اسم الأوردر كاملاً بس (أوردر 1 ≠ أوردر 10)
          if (!p.orderId && descriptionHasOrderCode(p.description, targetRef.code)) return false;
          return true;
        }),
      };
    });
  }, []);

  const deleteOrderItem = useCallback((orderId: string, itemId: string) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;
      const targetItem = order.items.find((i) => i.id === itemId);
      if (!targetItem) return prev;

      const remainingItems = order.items.filter((it) => it.id !== itemId);
      const updatedOrder = { ...order, items: remainingItems };

      const synced = syncOrderProfitRows(
        updatedOrder,
        prev.capitalTransactions,
        prev.pocketTransactions,
        prev.charityRecords,
        prev.settings
      );

      // شيل الصنف ده من تفاصيل دفعات العميل
      const updatedPayments = stripFromPayments(prev.customerPayments || [], { itemId });

      return {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
        customerPayments: updatedPayments,
        capitalTransactions: synced.capitalTransactions,
        pocketTransactions: synced.pocketTransactions,
        charityRecords: synced.charityRecords,
      };
    });
  }, []);

  const addOrderItemToOrder = useCallback((
    orderId: string,
    item: { name: string; size?: string; quantity: number; costPrice: number }
  ) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;

      const newItem: OrderItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: item.name.trim(),
        size: item.size?.trim() || undefined,
        quantity: item.quantity > 0 ? item.quantity : 1,
        costPrice: item.costPrice || 0,
        isSold: false,
      };

      const updatedOrder = {
        ...order,
        items: [...order.items, newItem],
      };

      const synced = syncOrderProfitRows(
        updatedOrder,
        prev.capitalTransactions,
        prev.pocketTransactions,
        prev.charityRecords,
        prev.settings
      );

      return {
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
        capitalTransactions: synced.capitalTransactions,
        pocketTransactions: synced.pocketTransactions,
        charityRecords: synced.charityRecords,
      };
    });
  }, []);

  const toggleOrderFinished = useCallback((orderId: string) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId ? { ...o, isFinished: !o.isFinished } : o
      ),
    }));
  }, []);

  // -------------------------------------------------------------
  // Customer Sync Helpers for Office Purchases
  // -------------------------------------------------------------
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

  const mergeNotes = (existingNotes?: string, newNote?: string): string | undefined => {
    const ext = existingNotes?.trim();
    const n = newNote?.trim();
    if (!n) return ext || undefined;
    if (!ext) return n;
    if (ext.includes(n)) return ext;
    return `${ext} | ${n}`;
  };

  const syncCustomerFromOfficeItem = (
    item: {
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      customerSize?: string;
      messengerLink?: string;
      contactUrl?: string;
      deliveryMode?: DeliveryMode;
      notes?: string;
      customerId?: string;
    },
    currentCustomers: Customer[]
  ): { updatedCustomers: Customer[]; assignedCustomerId?: string } => {
    const cName = item.customerName?.trim();
    if (!cName) {
      return { updatedCustomers: currentCustomers, assignedCustomerId: item.customerId };
    }

    const messenger = item.messengerLink?.trim() || item.contactUrl?.trim() || undefined;
    const phone = item.customerPhone?.trim() || undefined;
    const address = item.customerAddress?.trim() || undefined;
    const size = item.customerSize?.trim() || undefined;
    const delivery = item.deliveryMode || undefined; // لو مااختارش حاجة، مابنغيّرش اللي على العميل
    const normPhone = normalizePhoneForComparison(phone);

    // 1. If item has customerId that exists in customer list:
    if (item.customerId) {
      const existingIndex = currentCustomers.findIndex((c) => c.id === item.customerId);
      if (existingIndex !== -1) {
        const existing = currentCustomers[existingIndex];
        const updatedCust: Customer = {
          ...existing,
          name: cName,
          phone: phone !== undefined ? phone : existing.phone,
          address: address !== undefined ? address : existing.address,
          size: size !== undefined ? size : existing.size,
          messengerLink: messenger !== undefined ? messenger : existing.messengerLink,
          deliveryMode: delivery || existing.deliveryMode,
          notes: existing.notes,
        };
        const copy = [...currentCustomers];
        copy[existingIndex] = updatedCust;
        return { updatedCustomers: copy, assignedCustomerId: existing.id };
      }
    }

    // 2. If no customerId, check if phone matches an existing customer:
    if (normPhone && normPhone.length >= 7) {
      const matchedIndex = currentCustomers.findIndex(
        (c) => normalizePhoneForComparison(c.phone) === normPhone
      );
      if (matchedIndex !== -1) {
        const matched = currentCustomers[matchedIndex];
        const updatedCust: Customer = {
          ...matched,
          phone: matched.phone || phone,
          address: matched.address || address,
          size: matched.size || size,
          messengerLink: matched.messengerLink || messenger,
          deliveryMode: delivery || matched.deliveryMode,
          notes: mergeNotes(matched.notes, item.notes),
        };
        const copy = [...currentCustomers];
        copy[matchedIndex] = updatedCust;
        return { updatedCustomers: copy, assignedCustomerId: matched.id };
      }
    }

    // 3. No match (or no phone): create new customer
    const newCustId = 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newCust: Customer = {
      id: newCustId,
      name: cName,
      phone,
      address,
      size,
      messengerLink: messenger,
      deliveryMode: delivery,
      notes: item.notes?.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    return {
      updatedCustomers: [newCust, ...currentCustomers],
      assignedCustomerId: newCustId,
    };
  };

  // -------------------------------------------------------------
  // ACTIONS: Office
  // -------------------------------------------------------------
  const addOfficeItem = useCallback((item: Omit<OfficeItem, 'id' | 'date' | 'isTransferredToOrder'>) => {
    setState((prev) => {
      const currentCustomers = prev.customers || [];
      const { updatedCustomers, assignedCustomerId } = syncCustomerFromOfficeItem(item, currentCustomers);

      // خيار التوصيل/الاستلام بيتسجل على العميل نفسه، مش على الصنف
      const { deliveryMode: _ignoredDelivery, ...itemWithoutDelivery } = item;
      const newItem: OfficeItem = {
        ...itemWithoutDelivery,
        customerId: assignedCustomerId || item.customerId,
        id: 'off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString().split('T')[0],
        isTransferredToOrder: false,
      };

      return {
        ...prev,
        customers: updatedCustomers,
        officeItems: [newItem, ...prev.officeItems],
      };
    });
  }, []);

  const updateOfficeItem = useCallback((id: string, updates: Partial<OfficeItem>) => {
    setState((prev) => {
      const currentItem = prev.officeItems.find((it) => it.id === id);
      if (!currentItem) return prev;

      const mergedItem = { ...currentItem, ...updates };
      const currentCustomers = prev.customers || [];
      const { updatedCustomers, assignedCustomerId } = syncCustomerFromOfficeItem(mergedItem, currentCustomers);

      const { deliveryMode: _ignoredDelivery, ...mergedWithoutDelivery } = mergedItem;
      const finalItem: OfficeItem = {
        ...mergedWithoutDelivery,
        customerId: assignedCustomerId || mergedItem.customerId,
      };

      return {
        ...prev,
        customers: updatedCustomers,
        officeItems: prev.officeItems.map((it) => (it.id === id ? finalItem : it)),
      };
    });
  }, []);

  const deleteOfficeItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      officeItems: prev.officeItems.filter((it) => it.id !== id),
    }));
  }, []);

  const createOrderFromOfficeItems = useCallback((selectedItemIds: string[], orderCode?: string): string => {
    const targetItems = state.officeItems.filter((it) => selectedItemIds.includes(it.id));
    if (targetItems.length === 0) return '';

    const items = targetItems.map((t) => ({
      name: t.itemName,
      quantity: t.quantity || 1,
      costPrice: t.costPrice,
      officeName: t.officeName,
      requestedByCustomerId: t.customerId,
      size: t.customerSize,
      suggestedSellPrice: t.guideSellPrice,
    }));

    const orderId = createNewOrder(
      orderCode || '',
      items,
      `مكاتب: ${Array.from(new Set(targetItems.map(t => t.officeName))).join('، ')}`
    );

    setState((prev) => ({
      ...prev,
      officeItems: prev.officeItems.map((it) => {
        if (selectedItemIds.includes(it.id)) {
          return { ...it, isTransferredToOrder: true, orderId };
        }
        return it;
      }),
    }));

    return orderId;
  }, [state.officeItems, createNewOrder]);

  const addRegisteredOffice = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((prev) => {
      const current = prev.settings.registeredOffices || [];
      if (current.includes(trimmed)) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          registeredOffices: [...current, trimmed],
        },
      };
    });
  }, []);

  const updateRegisteredOffice = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        registeredOffices: (prev.settings.registeredOffices || []).map((o) => (o === oldName ? trimmed : o)),
      },
    }));
  }, []);

  const deleteRegisteredOffice = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        registeredOffices: (prev.settings.registeredOffices || []).filter((o) => o !== name),
      },
    }));
  }, []);

  const moveRegisteredOffice = useCallback((name: string, direction: 'up' | 'down') => {
    setState((prev) => {
      const current = [...(prev.settings.registeredOffices || [])];
      const index = current.indexOf(name);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return prev;

      const temp = current[index];
      current[index] = current[targetIndex];
      current[targetIndex] = temp;

      return {
        ...prev,
        settings: {
          ...prev.settings,
          registeredOffices: current,
        },
      };
    });
  }, []);

  // -------------------------------------------------------------
  // ACTIONS: Bag / Trip
  // -------------------------------------------------------------
  const updateBagSources = useCallback((sources: BagFundSource[]) => {
    setState((prev) => ({
      ...prev,
      currentTrip: {
        ...prev.currentTrip,
        sources,
      },
    }));
  }, []);

  const addBagExpense = useCallback((expense: Omit<BagExpense, 'id' | 'date'>) => {
    const newExp: BagExpense = {
      ...expense,
      id: 'bexp_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setState((prev) => ({
      ...prev,
      currentTrip: {
        ...prev.currentTrip,
        expenses: [newExp, ...prev.currentTrip.expenses],
      },
    }));
  }, []);

  const updateBagExpense = useCallback((expenseId: string, updates: Partial<BagExpense>) => {
    setState((prev) => ({
      ...prev,
      currentTrip: {
        ...prev.currentTrip,
        expenses: prev.currentTrip.expenses.map((e) => (e.id === expenseId ? { ...e, ...updates } : e)),
      },
    }));
  }, []);

  const deleteBagExpense = useCallback((expenseId: string) => {
    setState((prev) => ({
      ...prev,
      currentTrip: {
        ...prev.currentTrip,
        expenses: prev.currentTrip.expenses.filter((e) => e.id !== expenseId),
      },
    }));
  }, []);

  // Reconcile Bag Trip (منطق تقفيل العهدة ورد باقي العهدة للخزن حسب أكبر مساهمة)
  const reconcileCurrentTrip = useCallback((actualCashRemaining: number) => {
    const trip = state.currentTrip;
    const startingTotal = trip.sources.reduce((s, src) => s + (src.amount || 0), 0);
    const expensesTotal = trip.expenses.reduce((s, exp) => s + (exp.amount || 0), 0);
    const expectedRemaining = startingTotal - expensesTotal;
    const difference = actualCashRemaining - expectedRemaining;

    // Zero-difference rule
    if (Math.abs(difference) > 0.001) {
      return {
        success: false,
        difference,
        message: `يوجد فرق في الشنطة بقيمة ${difference > 0 ? '+' : ''}${difference.toFixed(2)} ${state.settings.currency}. يجب أن يكون الفرق 0.00 قبل إتمام التقفيل.`,
      };
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Process expenses
    const orderExpenseItems: Record<string, OrderItem[]> = {};
    const newCapitalTxs: CapitalTransaction[] = [];
    const newPocketTxs: PocketTransaction[] = [];
    const newSalaryExpenses: SalaryExpenseRecord[] = [];

    for (const exp of trip.expenses) {
      if (exp.route === 'order' && exp.targetId) {
        if (!orderExpenseItems[exp.targetId]) orderExpenseItems[exp.targetId] = [];
        orderExpenseItems[exp.targetId].push({
          id: `item_exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: 'مصاريف',
          quantity: 1,
          costPrice: exp.amount,
          isSold: false,
          notes: exp.description ? `مصروف شنطة: ${exp.description}` : 'مصروف شنطة',
        });
      } else if (exp.route === 'salary' && exp.targetId) {
        newSalaryExpenses.push({
          id: 'sexp_' + Date.now() + Math.random(),
          itemId: exp.targetId,
          itemName: exp.targetName || 'بند ميزانية',
          amount: exp.amount,
          date: today,
          isAdvancedFromPocket: false,
          notes: `مصروف شنطة: ${exp.description}`,
        });
      } else if (exp.route === 'pocket_advance') {
        newPocketTxs.push({
          id: 'pock_' + Date.now() + Math.random(),
          date: today,
          type: 'withdrawal',
          amount: exp.amount,
          category: 'التزامات قبض',
          description: `سلفة شنطة: ${exp.description}`,
          repaidAmount: 0,
          repayments: [],
          status: 'غير مسدد',
        });
      } else if (exp.route === 'capital_advance') {
        newCapitalTxs.push({
          id: 'cap_' + Date.now() + Math.random(),
          date: today,
          type: 'advance',
          amount: exp.amount,
          description: `سلفة شنطة: ${exp.description}`,
        });
      } else if (exp.route === 'capital_settlement') {
        newCapitalTxs.push({
          id: 'cap_' + Date.now() + Math.random(),
          date: today,
          type: 'settlement',
          amount: exp.amount,
          description: `تسوية شنطة: ${exp.description}`,
        });
      }
    }

    // 2. Custody Return Logic (رد باقي العهدة إلى الخزن حسب الترتيب التنازلي للمساهمة)
    const treasuryMap: Record<TreasurySourceType, { label: string; amount: number }> = {
      capital: { label: 'رأس المال', amount: 0 },
      salary: { label: 'القبض', amount: 0 },
      pocket: { label: 'بوكيت', amount: 0 },
      other: { label: 'نقدية خارجية / أخرى', amount: 0 },
    };

    for (const src of trip.sources) {
      const t = src.treasuryType || (
        src.sourceName.includes('رأس المال') ? 'capital' :
        src.sourceName.includes('قبض') ? 'salary' :
        src.sourceName.includes('بوكيت') ? 'pocket' : 'other'
      );
      if (treasuryMap[t]) {
        treasuryMap[t].amount += (src.amount || 0);
      } else {
        treasuryMap.other.amount += (src.amount || 0);
      }
    }

    const custodyContributions: BagCustodyReturn[] = (Object.keys(treasuryMap) as TreasurySourceType[])
      .map((t) => ({
        treasuryType: t,
        sourceLabel: treasuryMap[t].label,
        amountContributed: treasuryMap[t].amount,
        amountReturned: 0,
      }))
      .filter((c) => c.amountContributed > 0)
      .sort((a, b) => b.amountContributed - a.amountContributed);

    let cashToReturn = actualCashRemaining;
    for (const cont of custodyContributions) {
      if (cashToReturn <= 0) break;
      const refund = Math.min(cashToReturn, cont.amountContributed);
      cont.amountReturned = refund;
      cashToReturn -= refund;
    }

    // Linked orders created on this trip
    const linkedOrderCodes = state.orders
      .filter((o) => o.date === trip.date || o.date === today)
      .map((o) => o.code);

    // Finalize completed trip
    const completedTrip: BagTrip = {
      ...trip,
      actualCashRemaining,
      expectedCashRemaining: expectedRemaining,
      difference: 0,
      isReconciled: true,
      reconciledAt: new Date().toISOString(),
      returnedToTreasuries: custodyContributions,
      linkedOrderCodes: linkedOrderCodes.length > 0 ? linkedOrderCodes : undefined,
    };

    setState((prev) => {
      let curCap = [...newCapitalTxs, ...prev.capitalTransactions];
      let curPock = [...newPocketTxs, ...prev.pocketTransactions];
      let curChar = prev.charityRecords;

      const updatedOrders = prev.orders.map((o) => {
        const addedItems = orderExpenseItems[o.id];
        if (addedItems && addedItems.length > 0) {
          const updated = {
            ...o,
            items: [...o.items, ...addedItems],
          };
          const synced = syncOrderProfitRows(updated, curCap, curPock, curChar, prev.settings, today);
          curCap = synced.capitalTransactions;
          curPock = synced.pocketTransactions;
          curChar = synced.charityRecords;
          return updated;
        }
        return o;
      });

      const updatedSalaryBudget = prev.salaryBudget.map((item) => {
        const added = newSalaryExpenses.filter((e) => e.itemId === item.id).reduce((s, e) => s + e.amount, 0);
        return { ...item, spent: item.spent + added };
      });

      return {
        ...prev,
        orders: updatedOrders,
        capitalTransactions: curCap,
        pocketTransactions: curPock,
        charityRecords: curChar,
        salaryExpenses: [...newSalaryExpenses, ...prev.salaryExpenses],
        salaryBudget: updatedSalaryBudget,
        currentTrip: {
          id: 'trip_' + Date.now(),
          date: today,
          sources: [
            { id: 'src_1', sourceName: 'إنستاباي', amount: 0, treasuryType: 'other' },
            { id: 'src_2', sourceName: 'فودافون كاش', amount: 0, treasuryType: 'other' },
            { id: 'src_3', sourceName: 'نقدية درج', amount: 0, treasuryType: 'other' },
          ],
          expenses: [],
          isReconciled: false,
        },
        pastTrips: [completedTrip, ...prev.pastTrips],
      };
    });

    const returnSummary = custodyContributions
      .filter((c) => c.amountReturned > 0)
      .map((c) => `${c.sourceLabel}: ${c.amountReturned.toLocaleString('en-US')} ${state.settings.currency}`)
      .join('، ');

    return {
      success: true,
      difference: 0,
      message: `تم تقفيل عهدة الشنطة بنجاح. ${returnSummary ? `تم رد المتبقي (${actualCashRemaining} ${state.settings.currency}) إلى: ${returnSummary}.` : 'تمت المطابقة.'}`,
    };
  }, [state.currentTrip, state.orders, state.settings.currency]);

  const startNewTrip = useCallback(() => {
    setState((prev) => ({
      ...prev,
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
    }));
  }, []);

  // -------------------------------------------------------------
  // ACTIONS: Salary
  // -------------------------------------------------------------
  const updateSalaryBudgetItems = useCallback((items: SalaryBudgetItem[]) => {
    const pocketItem = items.find((b) => b.isPocketSupport);
    const regular = items.filter((b) => !b.isPocketSupport);
    const sorted = pocketItem ? [...regular, pocketItem] : regular;

    setState((prev) => ({
      ...prev,
      salaryBudget: sorted,
    }));
  }, []);

  const addSalaryBudgetItem = useCallback((name: string, budgeted: number, isPocketSupport?: boolean) => {
    const newItem: SalaryBudgetItem = {
      id: 'sb_' + Date.now(),
      name,
      budgeted,
      spent: 0,
      isPocketSupport,
    };
    setState((prev) => {
      const pocketItem = prev.salaryBudget.find((b) => b.isPocketSupport);
      const regular = prev.salaryBudget.filter((b) => !b.isPocketSupport);
      if (pocketItem) {
        return {
          ...prev,
          salaryBudget: [...regular, newItem, pocketItem],
        };
      }
      return {
        ...prev,
        salaryBudget: [...prev.salaryBudget, newItem],
      };
    });
  }, []);

  const deleteSalaryBudgetItem = useCallback((id: string) => {
    setState((prev) => {
      const item = prev.salaryBudget.find((b) => b.id === id);
      if (item?.isSystem || item?.isPocketSupport) return prev;
      return {
        ...prev,
        salaryBudget: prev.salaryBudget.filter((b) => b.id !== id),
      };
    });
  }, []);

  const recordSalaryExpense = useCallback((itemId: string, amount: number, isAdvancedFromPocket: boolean, notes?: string) => {
    const today = new Date().toISOString().split('T')[0];
    setState((prev) => {
      const target = prev.salaryBudget.find((b) => b.id === itemId);
      const itemName = target ? target.name : 'بند ميزانية';
      const expenseId = 'sexp_' + Date.now();

      const exp: SalaryExpenseRecord = {
        id: expenseId,
        itemId,
        itemName,
        amount,
        date: today,
        isAdvancedFromPocket,
        notes,
      };

      const newPocketTxs = [...prev.pocketTransactions];
      // Only record pocket support when spent is recorded on pocket support item
      if (target?.isPocketSupport || target?.isSystem) {
        newPocketTxs.unshift({
          id: 'pock_sal_' + Date.now(),
          date: today,
          type: 'support_salary',
          amount,
          description: `دعم بوكيت من القبض`,
          repaidAmount: 0,
          repayments: [],
          status: 'مسدد بالكامل',
          salaryExpenseId: expenseId,
        });
      }

      if (isAdvancedFromPocket) {
        newPocketTxs.unshift({
          id: 'pock_adv_' + Date.now(),
          date: today,
          type: 'withdrawal',
          amount,
          category: 'التزامات قبض',
          description: `سلفة قبل ميعاد القبض (${itemName})`,
          repaidAmount: 0,
          repayments: [],
          status: 'غير مسدد',
          notes,
        });
      }

      const updatedBudget = prev.salaryBudget.map((b) => {
        if (b.id === itemId) {
          return { ...b, spent: b.spent + amount };
        }
        return b;
      });

      return {
        ...prev,
        salaryExpenses: [exp, ...prev.salaryExpenses],
        salaryBudget: updatedBudget,
        pocketTransactions: newPocketTxs,
      };
    });
  }, []);

  const updateSalaryExpense = useCallback((expenseId: string, newAmount: number, newNotes?: string) => {
    setState((prev) => {
      const exp = prev.salaryExpenses.find((e) => e.id === expenseId);
      if (!exp) return prev;
      const diff = newAmount - exp.amount;

      const updatedExpenses = prev.salaryExpenses.map((e) =>
        e.id === expenseId
          ? { ...e, amount: newAmount, notes: newNotes !== undefined ? newNotes : e.notes }
          : e
      );

      const updatedBudget = prev.salaryBudget.map((b) =>
        b.id === exp.itemId ? { ...b, spent: Math.max(0, b.spent + diff) } : b
      );

      const updatedPocketTxs = prev.pocketTransactions.map((p) => {
        if (p.salaryExpenseId === expenseId) {
          return { ...p, amount: newAmount };
        }
        return p;
      });

      return {
        ...prev,
        salaryExpenses: updatedExpenses,
        salaryBudget: updatedBudget,
        pocketTransactions: updatedPocketTxs,
      };
    });
  }, []);

  const deleteSalaryExpense = useCallback((expenseId: string) => {
    setState((prev) => {
      const exp = prev.salaryExpenses.find((e) => e.id === expenseId);
      if (!exp) return prev;

      const updatedBudget = prev.salaryBudget.map((b) => {
        if (b.id === exp.itemId) {
          return { ...b, spent: Math.max(0, b.spent - exp.amount) };
        }
        return b;
      });

      const updatedPocketTxs = prev.pocketTransactions.filter(
        (p) => p.salaryExpenseId !== expenseId
      );

      return {
        ...prev,
        salaryExpenses: prev.salaryExpenses.filter((e) => e.id !== expenseId),
        salaryBudget: updatedBudget,
        pocketTransactions: updatedPocketTxs,
      };
    });
  }, []);

  // -------------------------------------------------------------
  // ACTIONS: Customers & Debts
  // -------------------------------------------------------------
  const addCustomer = useCallback((
    name: string,
    phone?: string,
    notes?: string,
    extra?: { address?: string; size?: string; messengerLink?: string; deliveryMode?: DeliveryMode }
  ): Customer => {
    const newCust: Customer = {
      id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      phone: phone?.trim() || undefined,
      notes: notes?.trim() || undefined,
      address: extra?.address?.trim() || undefined,
      size: extra?.size?.trim() || undefined,
      messengerLink: extra?.messengerLink?.trim() || undefined,
      deliveryMode: extra?.deliveryMode || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setState((prev) => ({
      ...prev,
      customers: [newCust, ...(prev.customers || [])],
    }));
    return newCust;
  }, []);

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    setState((prev) => ({
      ...prev,
      customers: (prev.customers || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      customers: (prev.customers || []).filter((c) => c.id !== id),
      customerPayments: (prev.customerPayments || []).filter((p) => p.customerId !== id),
      customerNotes: (prev.customerNotes || []).filter((n) => n.customerId !== id),
    }));
  }, []);

  const addCustomerNote = useCallback((customerId: string, text: string, date?: string) => {
    const noteDate = date || new Date().toISOString().split('T')[0];
    const newNote: CustomerNote = {
      id: 'cnote_' + Date.now(),
      customerId,
      date: noteDate,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      customerNotes: [newNote, ...(prev.customerNotes || [])],
    }));
  }, []);

  const deleteCustomerNote = useCallback((noteId: string) => {
    setState((prev) => ({
      ...prev,
      customerNotes: (prev.customerNotes || []).filter((n) => n.id !== noteId),
    }));
  }, []);

  const recordCustomerPayment = useCallback((customerId: string, amount: number, date?: string, notes?: string, onlyItemId?: string) => {
    if (amount <= 0) return;
    const paymentDate = date || new Date().toISOString().split('T')[0];

    setState((prev) => {
      const paymentId = newTxId('pay');
      let remainingToApply = amount;

      // أصناف العميل اللي عليها باقي (الأقدم أول، أو صنف واحد محدد)
      const customerDebtItems: Array<{ orderIndex: number; itemIndex: number; debt: number; date: string }> = [];

      prev.orders.forEach((ord, oIdx) => {
        ord.items.forEach((it, iIdx) => {
          if (it.customerId === customerId && it.isSold && (!onlyItemId || it.id === onlyItemId)) {
            const totalDue = (it.soldPrice || 0) * (it.quantity || 1);
            const paid = it.paidAmount !== undefined ? it.paidAmount : totalDue;
            const debt = totalDue - paid;
            if (debt > 0.001) {
              customerDebtItems.push({
                orderIndex: oIdx,
                itemIndex: iIdx,
                debt,
                date: it.soldDate || ord.date,
              });
            }
          }
        });
      });

      // FIFO: الأقدم أول
      customerDebtItems.sort((a, b) => a.date.localeCompare(b.date));

      const updatedOrders = prev.orders.map((o) => ({ ...o, items: o.items.map((it) => ({ ...it })) }));
      const affectedOrderIds = new Set<string>();
      const allocations: { itemId: string; orderId: string; amount: number }[] = [];

      for (const entry of customerDebtItems) {
        if (remainingToApply <= 0.001) break;
        const ord = updatedOrders[entry.orderIndex];
        const item = ord.items[entry.itemIndex];
        const applyAmt = Math.min(remainingToApply, entry.debt);

        item.paidAmount = (item.paidAmount !== undefined ? item.paidAmount : 0) + applyAmt;
        const totalDue = (item.soldPrice || 0) * (item.quantity || 1);
        item.paymentType = item.paidAmount >= totalDue - 0.001 ? 'cash' : 'partial';

        remainingToApply -= applyAmt;
        allocations.push({ itemId: item.id, orderId: ord.id, amount: applyAmt });
        affectedOrderIds.add(ord.id);
      }

      // لو مفيش حاجة اتطبقت (مفيش دين) ما نسجلش دفعة
      if (allocations.length === 0) return prev;

      const appliedTotal = allocations.reduce((s, x) => s + x.amount, 0);

      // مزامنة الأرباح للأوردرات المتأثرة
      let curCap = prev.capitalTransactions;
      let curPock = prev.pocketTransactions;
      let curChar = prev.charityRecords;

      for (const orderId of affectedOrderIds) {
        const ord = updatedOrders.find((o) => o.id === orderId);
        if (!ord) continue;
        const synced = syncOrderProfitRows(ord, curCap, curPock, curChar, prev.settings, paymentDate);
        curCap = synced.capitalTransactions;
        curPock = synced.pocketTransactions;
        curChar = synced.charityRecords;
      }

      const newPayment: CustomerPayment = {
        id: paymentId,
        customerId,
        date: paymentDate,
        createdAt: new Date().toISOString(),
        amount: appliedTotal,
        notes,
        kind: 'payment',
        allocations,
      };

      return {
        ...prev,
        orders: updatedOrders,
        customerPayments: [newPayment, ...(prev.customerPayments || [])],
        capitalTransactions: curCap,
        pocketTransactions: curPock,
        charityRecords: curChar,
      };
    });
  }, []);

  // إلغاء دفعة: بيرجّع الدين ويزامن أرباح الأوردرات فوراً
  const cancelCustomerPayment = useCallback((paymentId: string) => {
    setState((prev) => {
      const payment = (prev.customerPayments || []).find((p) => p.id === paymentId);
      if (!payment || payment.kind === 'refund' || !payment.allocations || payment.allocations.length === 0) return prev;

      const updatedOrders = prev.orders.map((o) => ({ ...o, items: o.items.map((it) => ({ ...it })) }));
      const affectedOrderIds = new Set<string>();

      for (const al of payment.allocations) {
        const ord = updatedOrders.find((o) => o.id === al.orderId);
        const item = ord?.items.find((i) => i.id === al.itemId);
        if (!ord || !item || !item.isSold) continue;
        const totalDue = (item.soldPrice || 0) * (item.quantity || 1);
        const currentPaid = item.paidAmount !== undefined ? item.paidAmount : totalDue;
        const newPaid = Math.max(0, currentPaid - al.amount);
        item.paidAmount = newPaid;
        item.paymentType = newPaid >= totalDue - 0.001 ? 'cash' : newPaid > 0 ? 'partial' : 'credit';
        affectedOrderIds.add(ord.id);
      }

      const today = new Date().toISOString().split('T')[0];
      let curCap = prev.capitalTransactions;
      let curPock = prev.pocketTransactions;
      let curChar = prev.charityRecords;

      for (const orderId of affectedOrderIds) {
        const ord = updatedOrders.find((o) => o.id === orderId);
        if (!ord) continue;
        const synced = syncOrderProfitRows(ord, curCap, curPock, curChar, prev.settings, today);
        curCap = synced.capitalTransactions;
        curPock = synced.pocketTransactions;
        curChar = synced.charityRecords;
      }

      removeAuditEntryBySourceId(`pay_${payment.id}`);

      return {
        ...prev,
        orders: updatedOrders,
        customerPayments: (prev.customerPayments || []).filter((p) => p.id !== paymentId),
        capitalTransactions: curCap,
        pocketTransactions: curPock,
        charityRecords: curChar,
      };
    });
  }, []);

  // -------------------------------------------------------------
  // ACTIONS: Charity
  // -------------------------------------------------------------
  const addCharitySettlement = useCallback((amount: number, notes?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const rec: CharityRecord = {
      id: 'char_set_' + Date.now(),
      date: today,
      type: 'settlement',
      amount,
      description: 'تسوية وإخراج صدقة',
      notes,
    };
    setState((prev) => ({
      ...prev,
      charityRecords: [rec, ...prev.charityRecords],
    }));
  }, []);

  const value: AppContextValue = {
    state,
    currentPage,
    setCurrentPage,
    isLoading,
    updateSettings,
    resetToCleanState,
    backupToJson,
    restoreFromJson,
    downloadExcelReport,
    baseCapital,
    liquidity,
    capitalAdvancesOpen,
    tiedInOrders,
    capitalGrowthTotal,
    capitalErosionSettled,
    capitalErosionWithdrawn,
    capitalErosionRepaid,
    capitalErosionOpen,
    capitalErosionRate,
    addCapitalAdvance,
    addCapitalSettlement,
    addCapitalRepayment,
    pocketBalance,
    pocketTotalWithdrawn,
    pocketTotalRepaid,
    pocketOpenDebt,
    pocketWarningActive,
    addPocketWithdrawal,
    addPocketRepayment,
    addPocketSalarySupport,
    updatePocketWithdrawal,
    deletePocketWithdrawal,
    salaryTotalBudgeted,
    salaryTotalSpent,
    salaryTotalRemaining,
    updateSalaryBudgetItems,
    addSalaryBudgetItem,
    deleteSalaryBudgetItem,
    recordSalaryExpense,
    updateSalaryExpense,
    deleteSalaryExpense,
    createNewOrder,
    registerItemSale,
    updateOrderItem,
    deleteOrder,
    deleteOrderItem,
    addOrderItemToOrder,
    returnOrderItem,
    settleOrderItem,
    toggleOrderFinished,
    reconcileOrderProfit,
    getOrderProfitImpact,
    customers: state.customers || [],
    customerPayments: state.customerPayments || [],
    customerNotes: state.customerNotes || [],
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addCustomerNote,
    deleteCustomerNote,
    recordCustomerPayment,
    cancelCustomerPayment,
    addOfficeItem,
    updateOfficeItem,
    deleteOfficeItem,
    createOrderFromOfficeItems,
    addRegisteredOffice,
    updateRegisteredOffice,
    deleteRegisteredOffice,
    moveRegisteredOffice,
    updateBagSources,
    addBagExpense,
    updateBagExpense,
    deleteBagExpense,
    reconcileCurrentTrip,
    startNewTrip,
    charityBalance,
    charityTotalInflow,
    charityTotalPaid,
    addCharitySettlement,
    allOpenDebts,
    isQuickModalOpen,
    openQuickModal,
    closeQuickModal,
    quickModalTab,
    quickModalPreset,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
