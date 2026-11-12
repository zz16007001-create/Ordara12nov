/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PageId =
  | 'entry'
  | 'bag'
  | 'offices'
  | 'orders'
  | 'capital'
  | 'salary'
  | 'pocket'
  | 'reports'
  | 'settings'
  | 'customers'
  | 'audit';

export type AuditActionType =
  | 'sale'
  | 'return'
  | 'collection'
  | 'expense'
  | 'withdrawal'
  | 'capital_add'
  | 'transfer'
  | 'note';

export type AuditManualNoteType =
  | 'مبلغ خارج الشغل'
  | 'مبلغ زائد في الخزينة'
  | 'مبلغ ناقص في الخزينة'
  | 'بيع لم يسجل'
  | 'تحصيل لم يسجل'
  | 'أخرى';

export interface AuditLogItem {
  id: string;
  sourceId?: string;
  type: AuditActionType;
  title: string;
  amount?: number;
  actionDate: string;
  registeredAt: string;
  details: string;
  notes?: string;
  manualCategory?: AuditManualNoteType;
  itemName?: string;
  itemSize?: string;
  orderCode?: string;
  customerName?: string;
}

export interface AuditPeriod {
  id: string;
  startDate: string;
  startTime: string;
  startedAt?: string; // لحظة بداية الفترة بالضبط (ISO) - أي حركة قبلها متتسجلش في الفترة الجديدة
  items: AuditLogItem[];
  deletedSourceIds?: string[];
}

export type PaymentMethod = 'نقدية (كاش)' | 'إنستاباي' | 'فودافون كاش' | 'تحويل بنكي' | 'أخرى';

export type PocketCategory = 'التزامات قبض' | 'موسمي' | 'جديد/غير دائم' | 'ترفيه/أخرى';

export type PocketRepayStatus = 'غير مسدد' | 'جزئي' | 'مسدد بالكامل';

export type OrderStatus = 'مفتوح' | 'مقفول' | 'خسارة';

export type TreasurySourceType = 'capital' | 'salary' | 'pocket' | 'other';

// طريقة تسليم العميل (ثابتة على العميل): توصيل = شحن، استلام = بيجي ياخد من عندي
export type DeliveryMode = 'delivery' | 'pickup';

// Order Item
export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  costPrice: number;
  soldPrice?: number;
  isSold: boolean;
  soldDate?: string;
  soldAt?: string; // وقت تسجيل البيع بالضبط (ISO) - بيستخدمه سجل المراجعة للتفرقة بين قبل وبعد التقفيل
  paymentMethod?: PaymentMethod;
  notes?: string;
  officeId?: string;
  officeName?: string;
  isSettled?: boolean; // علامة صنف مسوّى
  customerId?: string; // العميل المرتبط بالصنف
  paymentType?: 'cash' | 'credit' | 'partial'; // طريقة السداد
  paidAmount?: number; // المبلغ المدفوع من إجمالي البيع
  size?: string; // مقاس الصنف (اختياري)
  requestedByCustomerId?: string; // العميل صاحب الطلب من المكاتب (اختياري)
  suggestedSellPrice?: number; // سعر البيع المقترح للعرض فقط (من صنف المكتب)
}

// Order Entity
export interface Order {
  id: string;
  code: string; // e.g. "أوردر رقم 1"
  date: string;
  items: OrderItem[];
  additionalBagCost: number; // costs routed from bag specifically to this order
  notes?: string;
  closedDate?: string;
  isFinished?: boolean; // خاصية تنظيمية بصرية لتمييز الأوردرات المنتهية عن المفتوحة
}

// Office Purchase Item
export interface OfficeItem {
  id: string;
  officeName: string;
  itemName: string;
  quantity: number;
  costPrice: number;
  invoiceTotal?: number;
  guideSellPrice?: number;
  deliveryFee?: number; // قيمة التوصيل (اختياري)
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerSize?: string; // مقاس العميل (اختياري)
  customerId?: string; // ربط بسجل العميل في صفحة العملاء (اختياري)
  contactUrl?: string; // Messenger / Instagram / WhatsApp
  messengerLink?: string; // رابط ماسنجر للعميل
  deliveryMode?: DeliveryMode; // توصيل / استلام من البيت (بيتسجل على العميل نفسه)
  notes?: string;
  isTransferredToOrder?: boolean;
  orderId?: string;
  date: string;
}

// Capital Ledger Movement
export type CapitalActionType =
  | 'order_creation' // سحب لشراء أوردر
  | 'advance' // سلفة من رأس المال
  | 'settlement' // تسوية تنقص الرصيد الأساسي (أكل رأس المال)
  | 'repayment' // سداد لدين سلفة أو استرداد رأس مال الأوردر
  | 'growth'; // نمو رأس المال من الأرباح

export interface CapitalTransaction {
  id: string;
  date: string;
  type: CapitalActionType;
  amount: number;
  description: string;
  orderId?: string;
  itemId?: string; // الصنف المرتبط (بيتسجل في حركة التسوية عشان الإرجاع يلغيها بالظبط)
  isForPocketCompensation?: boolean;
  debtId?: string;
  notes?: string;
}

// Pocket Ledger Movement
export interface PocketRepaymentEntry {
  id: string;
  date: string;
  amount: number;
  notes?: string;
  source?: string;
  sourceTreasury?: 'salary' | 'cash' | 'other';
  salaryBudgetItemId?: string;
  salaryBudgetItemName?: string;
}

export interface PocketTransaction {
  id: string;
  date: string;
  type: 'withdrawal' | 'support_profit' | 'support_salary' | 'repayment';
  amount: number;
  category?: PocketCategory;
  description: string;
  repaidAmount: number;
  repayments: PocketRepaymentEntry[];
  status: PocketRepayStatus;
  notes?: string;
  salaryExpenseId?: string; // link to salary expense if from pocket support
  orderId?: string; // كود/معرف الأوردر المرتبط بدعم الأرباح
}

// Bag / Trip State & Ledger
export interface BagFundSource {
  id: string;
  sourceName: string; // رأس المال، القبض، أخرى
  amount: number;
  treasuryType?: TreasurySourceType;
}

export type BagExpenseRoute =
  | 'order' // مصروف أوردر
  | 'salary' // مصروف قبض
  | 'pocket_advance' // سلفة بوكيت
  | 'capital_advance' // سلفة رأس مال
  | 'capital_settlement' // تسوية رأس مال
  | 'unclassified';

export interface BagExpense {
  id: string;
  date: string;
  time?: string;
  amount: number;
  description: string;
  categoryTag?: string;
  route: BagExpenseRoute;
  targetId?: string;
  targetName?: string;
  notes?: string;
}

export interface BagCustodyReturn {
  treasuryType: TreasurySourceType;
  sourceLabel: string;
  amountContributed: number;
  amountReturned: number;
}

export interface BagTrip {
  id: string;
  date: string;
  sources: BagFundSource[];
  expenses: BagExpense[];
  actualCashRemaining?: number;
  expectedCashRemaining?: number;
  difference?: number;
  isReconciled: boolean;
  reconciledAt?: string;
  returnedToTreasuries?: BagCustodyReturn[];
  linkedOrderCodes?: string[];
  distributedDebtPayments?: {
    debtType: 'capital' | 'pocket';
    debtId: string;
    description: string;
    amount: number;
  }[];
}

// Salary / Monthly Budget
export interface SalaryBudgetItem {
  id: string;
  name: string; // مصاريف البيت، الكهرباء، دعم بوكيت...
  budgeted: number; // المعيّن
  spent: number; // المنصرف
  notes?: string;
  isPocketSupport?: boolean; // بند دعم بوكيت
  isSystem?: boolean; // بند نظامي غير قابل للحذف أو إعادة التسمية
  color?: string; // لون نقطة البند في الجدول
}

export interface SalaryExpenseRecord {
  id: string;
  itemId: string;
  itemName: string;
  amount: number;
  date: string;
  isAdvancedFromPocket: boolean;
  notes?: string;
  pocketTransactionId?: string;
}

// Charity Box
export interface CharityRecord {
  id: string;
  date: string;
  type: 'inflow_order' | 'settlement'; // داخل من أوردر أو تسوية صدقة مدفوعة
  amount: number;
  orderId?: string;
  orderCode?: string;
  description: string;
  notes?: string;
}

// Customer & Debts Models
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  size?: string;
  messengerLink?: string;
  deliveryMode?: DeliveryMode; // توصيل (شحن) أو استلام من البيت
  notes?: string;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  notes?: string;
  createdAt?: string; // وقت تسجيل الدفعة بالضبط (ISO)
  appliedToItemId?: string;
  orderId?: string;
  /** 'refund' = فلوس اتردّت للعميل عند ارتجاع صنف (للتوثيق فقط، مش بتأثر على الدين) */
  kind?: 'payment' | 'refund';
  /** الأصناف اللي نزلت عليها الدفعة بالظبط (الدفعات الجديدة فقط) */
  allocations?: { itemId: string; orderId: string; amount: number }[];
}

export interface CustomerNote {
  id: string;
  customerId: string;
  date: string;
  text: string;
  createdAt: string;
}

// App Settings
export interface AppSettings {
  initialCapital: number;
  initialPocket: number;
  profitShareCapital: number; // 70%
  profitSharePocket: number; // 20%
  profitShareCharity: number; // 10%
  pocketWarningThreshold: number; // e.g. 500 EGP
  darkMode: boolean;
  currency: string; // "ج.م"
  registeredOffices: string[]; // قائمة المكاتب المسجلة المعتمدة
  salaryTotalColor?: string; // لون تدرج كارت إجمالي القبض (teal, blue, pink, gold)
  appBgColor?: string; // لون خلفية البرنامج
}

// Root State Container
export interface AppDataState {
  version: number;
  settings: AppSettings;
  orders: Order[];
  officeItems: OfficeItem[];
  capitalTransactions: CapitalTransaction[];
  pocketTransactions: PocketTransaction[];
  currentTrip: BagTrip;
  pastTrips: BagTrip[];
  salaryBudget: SalaryBudgetItem[];
  salaryExpenses: SalaryExpenseRecord[];
  charityRecords: CharityRecord[];
  customers?: Customer[];
  customerPayments?: CustomerPayment[];
  customerNotes?: CustomerNote[];
  orderCounter?: number;
}
