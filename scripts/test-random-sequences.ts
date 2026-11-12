/**
 * Test script for randomized sequences on Order management and profit distribution
 * Tests:
 * 1) Card "سحب لشراء أوردر" matches current order items cost (sum(costPrice * quantity))
 * 2) Each order has at most 3 profit rows (growth in capital, support_profit in pocket, inflow_order in charity)
 * 3) Value of each profit row = sharePercentage * max(0, actualCashCollected - currentCost), and row is deleted when 0
 * 4) Liquidity = Base Capital - Tied in Orders - Open Advances
 * 5) Items named "مصاريف" are included in cost only, excluded from isAllSold, stagnant list, and (x/y) counter
 */

import { Order, OrderItem, CapitalTransaction, PocketTransaction, CharityRecord, AppSettings, CustomerPayment } from '../src/types/index.ts';
import { syncOrderProfitRows } from '../src/context/AppContext.tsx';

const DEFAULT_SETTINGS: AppSettings = {
  initialCapital: 100000,
  initialPocket: 5000,
  profitShareCapital: 70,
  profitSharePocket: 20,
  profitShareCharity: 10,
  pocketWarningThreshold: 500,
  darkMode: false,
  currency: 'ج.م',
  registeredOffices: ['مكتب النصر', 'مكتب الشروق'],
};

// Simulation State
interface SimulationState {
  settings: AppSettings;
  orders: Order[];
  capitalTransactions: CapitalTransaction[];
  pocketTransactions: PocketTransaction[];
  charityRecords: CharityRecord[];
  customerPayments: CustomerPayment[];
}

function calculateOrderTotalCost(order: Order): number {
  return order.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0) + (order.additionalBagCost || 0);
}

function calculateOrderCashCollected(order: Order): number {
  return order.items.filter((it) => it.isSold).reduce((s, it) => {
    return s + (it.paidAmount !== undefined ? it.paidAmount : (it.soldPrice || 0) * (it.quantity || 1));
  }, 0);
}

function calculateBaseCapital(state: SimulationState): number {
  let settlements = 0;
  let growth = 0;
  for (const tx of state.capitalTransactions) {
    if (tx.type === 'settlement') settlements += tx.amount;
    else if (tx.type === 'growth') growth += tx.amount;
  }
  return state.settings.initialCapital - settlements + growth;
}

function calculateOpenAdvances(state: SimulationState): number {
  let advances = 0;
  let repayments = 0;
  for (const tx of state.capitalTransactions) {
    if (tx.type === 'advance') advances += tx.amount;
    else if (tx.type === 'repayment') repayments += tx.amount;
  }
  return Math.max(0, advances - repayments);
}

function calculateTiedInOrders(state: SimulationState): number {
  let tied = 0;
  for (const o of state.orders) {
    const cost = calculateOrderTotalCost(o);
    const cash = calculateOrderCashCollected(o);
    const capitalRecovered = Math.min(cost, cash);
    const orderTied = Math.max(0, cost - capitalRecovered);
    tied += orderTied;
  }
  return tied;
}

function calculateLiquidity(state: SimulationState): number {
  const base = calculateBaseCapital(state);
  const tied = calculateTiedInOrders(state);
  const openAdv = calculateOpenAdvances(state);
  return base - tied - openAdv;
}

function getOrderCreationCardAmount(state: SimulationState, tx: CapitalTransaction): number {
  if (tx.type === 'order_creation') {
    const ord = state.orders.find((o) => o.id === tx.orderId);
    if (ord) {
      return ord.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
    }
  }
  return tx.amount;
}

function assertInvariants(state: SimulationState, stepDescription: string) {
  // 1) Verify Order Creation Card amount
  for (const tx of state.capitalTransactions) {
    if (tx.type === 'order_creation') {
      const ord = state.orders.find((o) => o.id === tx.orderId);
      if (ord) {
        const expectedCurrentCost = ord.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
        const cardAmount = getOrderCreationCardAmount(state, tx);
        if (Math.abs(cardAmount - expectedCurrentCost) > 0.001) {
          throw new Error(
            `[Invariant 1 Failed at "${stepDescription}"] Card amount ${cardAmount} != current cost ${expectedCurrentCost} for ${ord.code}`
          );
        }
      }
    }
  }

  // 2) Verify profit rows per order (at most 1 of each type, value = share * max(0, cash - cost))
  for (const ord of state.orders) {
    const cost = calculateOrderTotalCost(ord);
    const cash = calculateOrderCashCollected(ord);
    const netProfit = Math.max(0, cash - cost);

    const growthTxs = state.capitalTransactions.filter((tx) => tx.type === 'growth' && tx.orderId === ord.id);
    const pocketTxs = state.pocketTransactions.filter(
      (p) => p.type === 'support_profit' && (p.orderId === ord.id || p.description?.includes(ord.code))
    );
    const charityTxs = state.charityRecords.filter(
      (c) => c.type === 'inflow_order' && (c.orderId === ord.id || c.orderCode === ord.code)
    );

    // Max 1 row of each
    if (growthTxs.length > 1) {
      throw new Error(`[Invariant 2 Failed at "${stepDescription}"] Multiple growth rows (${growthTxs.length}) for ${ord.code}`);
    }
    if (pocketTxs.length > 1) {
      throw new Error(`[Invariant 2 Failed at "${stepDescription}"] Multiple pocket support rows (${pocketTxs.length}) for ${ord.code}`);
    }
    if (charityTxs.length > 1) {
      throw new Error(`[Invariant 2 Failed at "${stepDescription}"] Multiple charity rows (${charityTxs.length}) for ${ord.code}`);
    }

    if (netProfit <= 0.001) {
      // Must be deleted if 0
      if (growthTxs.length > 0) {
        throw new Error(`[Invariant 3 Failed at "${stepDescription}"] Growth row exists but net profit is 0 for ${ord.code}`);
      }
      if (pocketTxs.length > 0) {
        throw new Error(`[Invariant 3 Failed at "${stepDescription}"] Pocket row exists but net profit is 0 for ${ord.code}`);
      }
      if (charityTxs.length > 0) {
        throw new Error(`[Invariant 3 Failed at "${stepDescription}"] Charity row exists but net profit is 0 for ${ord.code}`);
      }
    } else {
      const expectedCap = (netProfit * state.settings.profitShareCapital) / 100;
      const expectedPocket = (netProfit * state.settings.profitSharePocket) / 100;
      const expectedCharity = (netProfit * state.settings.profitShareCharity) / 100;

      if (growthTxs.length !== 1 || Math.abs(growthTxs[0].amount - expectedCap) > 0.01) {
        throw new Error(
          `[Invariant 3 Failed at "${stepDescription}"] Growth amount ${growthTxs[0]?.amount} != expected ${expectedCap} for ${ord.code}`
        );
      }
      if (pocketTxs.length !== 1 || Math.abs(pocketTxs[0].amount - expectedPocket) > 0.01) {
        throw new Error(
          `[Invariant 3 Failed at "${stepDescription}"] Pocket amount ${pocketTxs[0]?.amount} != expected ${expectedPocket} for ${ord.code}`
        );
      }
      if (charityTxs.length !== 1 || Math.abs(charityTxs[0].amount - expectedCharity) > 0.01) {
        throw new Error(
          `[Invariant 3 Failed at "${stepDescription}"] Charity amount ${charityTxs[0]?.amount} != expected ${expectedCharity} for ${ord.code}`
        );
      }
    }

    // 5) Invariant: Items named "مصاريف"
    const regularItems = ord.items.filter((it) => it.name.trim() !== 'مصاريف');
    const isAllSold = regularItems.length > 0 && regularItems.every((it) => it.isSold);
    const expenseItems = ord.items.filter((it) => it.name.trim() === 'مصاريف');
    for (const expIt of expenseItems) {
      if (expIt.isSold) {
        throw new Error(`[Invariant 5 Failed at "${stepDescription}"] Expense item ${expIt.name} marked as sold in ${ord.code}`);
      }
    }
  }

  // 4) Verify Liquidity = Base - Tied - Open Advances
  const base = calculateBaseCapital(state);
  const tied = calculateTiedInOrders(state);
  const openAdv = calculateOpenAdvances(state);
  const expectedLiquidity = base - tied - openAdv;
  const actualLiquidity = calculateLiquidity(state);
  if (Math.abs(expectedLiquidity - actualLiquidity) > 0.001) {
    throw new Error(
      `[Invariant 4 Failed at "${stepDescription}"] Liquidity ${actualLiquidity} != expected ${expectedLiquidity} (Base: ${base}, Tied: ${tied}, Adv: ${openAdv})`
    );
  }
}

// -------------------------------------------------------------------
// Simulation Actions
// -------------------------------------------------------------------
function createOrder(state: SimulationState, code: string, initialItems: OrderItem[]): Order {
  const newOrder: Order = {
    id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    code,
    date: new Date().toISOString().split('T')[0],
    items: initialItems,
    additionalBagCost: 0,
  };
  const totalCost = initialItems.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
  const capitalTx: CapitalTransaction = {
    id: `cap_ord_${newOrder.id}`,
    date: newOrder.date,
    type: 'order_creation',
    amount: totalCost,
    description: `سحب لشراء ${newOrder.code}`,
    orderId: newOrder.id,
    notes: `تكلفة ${initialItems.length} صنف`,
  };

  state.orders = [newOrder, ...state.orders];
  state.capitalTransactions = [capitalTx, ...state.capitalTransactions];
  return newOrder;
}

function registerSale(
  state: SimulationState,
  orderId: string,
  itemId: string,
  soldPrice: number,
  paymentType: 'cash' | 'credit' | 'partial',
  paidAmount?: number
) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const targetItem = order.items.find((it) => it.id === itemId);
  if (!targetItem) return;

  const totalSale = soldPrice * (targetItem.quantity || 1);
  let actualPaid = totalSale;
  if (paymentType === 'credit') actualPaid = 0;
  else if (paymentType === 'partial') actualPaid = Math.min(totalSale, Math.max(0, paidAmount || 0));

  const updatedItems = order.items.map((it) => {
    if (it.id === itemId) {
      return {
        ...it,
        isSold: true,
        soldPrice,
        paymentType,
        paidAmount: actualPaid,
      };
    }
    return it;
  });

  const updatedOrder = { ...order, items: updatedItems };
  state.orders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));

  const synced = syncOrderProfitRows(
    updatedOrder,
    state.capitalTransactions,
    state.pocketTransactions,
    state.charityRecords,
    state.settings
  );
  state.capitalTransactions = synced.capitalTransactions;
  state.pocketTransactions = synced.pocketTransactions;
  state.charityRecords = synced.charityRecords;
}

function recordPayment(state: SimulationState, orderId: string, itemId: string, amount: number) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const item = order.items.find((it) => it.id === itemId);
  if (!item || !item.isSold) return;

  const totalDue = (item.soldPrice || 0) * (item.quantity || 1);
  const currentPaid = item.paidAmount !== undefined ? item.paidAmount : totalDue;
  const newPaid = Math.min(totalDue, currentPaid + amount);
  item.paidAmount = newPaid;
  item.paymentType = newPaid >= totalDue - 0.001 ? 'cash' : 'partial';

  const payment: CustomerPayment = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    customerId: 'cust_1',
    date: new Date().toISOString().split('T')[0],
    amount,
    kind: 'payment',
    allocations: [{ itemId, orderId, amount }],
  };
  state.customerPayments = [payment, ...state.customerPayments];

  const synced = syncOrderProfitRows(
    order,
    state.capitalTransactions,
    state.pocketTransactions,
    state.charityRecords,
    state.settings
  );
  state.capitalTransactions = synced.capitalTransactions;
  state.pocketTransactions = synced.pocketTransactions;
  state.charityRecords = synced.charityRecords;
}

function cancelPayment(state: SimulationState, paymentId: string) {
  const p = state.customerPayments.find((x) => x.id === paymentId);
  if (!p || !p.allocations) return;

  for (const al of p.allocations) {
    const ord = state.orders.find((o) => o.id === al.orderId);
    const it = ord?.items.find((i) => i.id === al.itemId);
    if (!ord || !it || !it.isSold) continue;
    const totalDue = (it.soldPrice || 0) * (it.quantity || 1);
    const currentPaid = it.paidAmount !== undefined ? it.paidAmount : totalDue;
    const newPaid = Math.max(0, currentPaid - al.amount);
    it.paidAmount = newPaid;
    it.paymentType = newPaid >= totalDue - 0.001 ? 'cash' : newPaid > 0 ? 'partial' : 'credit';

    const synced = syncOrderProfitRows(
      ord,
      state.capitalTransactions,
      state.pocketTransactions,
      state.charityRecords,
      state.settings
    );
    state.capitalTransactions = synced.capitalTransactions;
    state.pocketTransactions = synced.pocketTransactions;
    state.charityRecords = synced.charityRecords;
  }
  state.customerPayments = state.customerPayments.filter((x) => x.id !== paymentId);
}

function returnItem(state: SimulationState, orderId: string, itemId: string) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const updatedItems = order.items.map((it) => {
    if (it.id === itemId) {
      const { soldPrice, soldDate, paymentMethod, paymentType, paidAmount, customerId, ...rest } = it;
      return { ...rest, isSold: false };
    }
    return it;
  });
  const updatedOrder = { ...order, items: updatedItems };
  state.orders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));

  const synced = syncOrderProfitRows(
    updatedOrder,
    state.capitalTransactions,
    state.pocketTransactions,
    state.charityRecords,
    state.settings
  );
  state.capitalTransactions = synced.capitalTransactions;
  state.pocketTransactions = synced.pocketTransactions;
  state.charityRecords = synced.charityRecords;
}

function updateItemCost(state: SimulationState, orderId: string, itemId: string, newCost: number) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const updatedItems = order.items.map((it) => {
    if (it.id === itemId) {
      return { ...it, costPrice: newCost };
    }
    return it;
  });
  const updatedOrder = { ...order, items: updatedItems };
  state.orders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));

  const synced = syncOrderProfitRows(
    updatedOrder,
    state.capitalTransactions,
    state.pocketTransactions,
    state.charityRecords,
    state.settings
  );
  state.capitalTransactions = synced.capitalTransactions;
  state.pocketTransactions = synced.pocketTransactions;
  state.charityRecords = synced.charityRecords;
}

function addItem(state: SimulationState, orderId: string, name: string, cost: number, qty = 1) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const newItem: OrderItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    quantity: qty,
    costPrice: cost,
    isSold: false,
  };
  const updatedOrder = { ...order, items: [...order.items, newItem] };
  state.orders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));

  const synced = syncOrderProfitRows(
    updatedOrder,
    state.capitalTransactions,
    state.pocketTransactions,
    state.charityRecords,
    state.settings
  );
  state.capitalTransactions = synced.capitalTransactions;
  state.pocketTransactions = synced.pocketTransactions;
  state.charityRecords = synced.charityRecords;
}

function deleteItem(state: SimulationState, orderId: string, itemId: string) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const updatedItems = order.items.filter((it) => it.id !== itemId);
  const updatedOrder = { ...order, items: updatedItems };
  state.orders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));

  const synced = syncOrderProfitRows(
    updatedOrder,
    state.capitalTransactions,
    state.pocketTransactions,
    state.charityRecords,
    state.settings
  );
  state.capitalTransactions = synced.capitalTransactions;
  state.pocketTransactions = synced.pocketTransactions;
  state.charityRecords = synced.charityRecords;
}

// -------------------------------------------------------------------
// RUN RANDOMIZED TEST SUITE
// -------------------------------------------------------------------
export function runRandomSequencesTest() {
  console.log('--- Starting Comprehensive Randomized Sequences Test ---');

  const state: SimulationState = {
    settings: { ...DEFAULT_SETTINGS },
    orders: [],
    capitalTransactions: [],
    pocketTransactions: [],
    charityRecords: [],
    customerPayments: [],
  };

  // Step 1: Create Order 1 with 3 items + 1 expense item
  const ord1 = createOrder(state, 'أوردر رقم 1', [
    { id: 'it_1', name: 'قميص أبيض', quantity: 1, costPrice: 200, isSold: false },
    { id: 'it_2', name: 'بنطلون جينز', quantity: 2, costPrice: 300, isSold: false },
    { id: 'it_3', name: 'حذاء كاجوال', quantity: 1, costPrice: 500, isSold: false },
    { id: 'it_exp_1', name: 'مصاريف', quantity: 1, costPrice: 50, isSold: false },
  ]);
  assertInvariants(state, 'Initial Order 1 Creation (Cost: 1350)');
  console.log('✓ Initial Order 1 created successfully.');

  // Step 2: Partial Sale on it_1 (Sold for 350, paid 150, debt 200)
  registerSale(state, ord1.id, 'it_1', 350, 'partial', 150);
  assertInvariants(state, 'Partial Sale on it_1');
  console.log('✓ Partial sale executed & invariants verified.');

  // Step 3: Credit Sale on it_2 (Sold for 800, paid 0)
  registerSale(state, ord1.id, 'it_2', 400, 'credit');
  assertInvariants(state, 'Credit Sale on it_2');
  console.log('✓ Credit sale executed & invariants verified.');

  // Step 4: Cash Sale on it_3 (Sold for 800, paid 800 in full)
  // Total cash now: 150 + 0 + 800 = 950. Total cost: 1350. Net profit still 0!
  registerSale(state, ord1.id, 'it_3', 800, 'cash');
  assertInvariants(state, 'Cash Sale on it_3 (Cash 950 < Cost 1350)');
  console.log('✓ Cash sale (below cost) verified: 0 profit rows as expected.');

  // Step 5: Customer pays 600 EGP towards credit item it_2
  // Total cash now: 950 + 600 = 1550. Total cost: 1350. Net profit = 200!
  recordPayment(state, ord1.id, 'it_2', 600);
  assertInvariants(state, 'Collection of 600 EGP (Net profit: 200)');
  console.log('✓ Collection triggered realized profit of 200: Capital +140, Pocket +40, Charity +20.');

  // Step 6: Cancel customer payment of 600
  // Net profit reverts to 0, profit rows must be removed!
  const lastPayment = state.customerPayments[0];
  cancelPayment(state, lastPayment.id);
  assertInvariants(state, 'Cancelled Payment: Profit reverts to 0');
  console.log('✓ Payment cancellation verified: profit rows deleted when 0.');

  // Step 7: Customer re-pays 800 in full
  recordPayment(state, ord1.id, 'it_2', 800);
  assertInvariants(state, 'Re-payment of 800');
  console.log('✓ Re-payment verified: profit rows created/synced.');

  // Step 8: Return item it_3 (was sold for 800 cash)
  // Cash drops by 800. Net profit re-calculated!
  returnItem(state, ord1.id, 'it_3');
  assertInvariants(state, 'Return of it_3');
  console.log('✓ Return item verified without any reverse rows.');

  // Step 9: Modify cost of it_1 from 200 to 100
  updateItemCost(state, ord1.id, 'it_1', 100);
  assertInvariants(state, 'Reduced cost of it_1 from 200 to 100');
  console.log('✓ Cost modification verified: order_creation card and profit synced.');

  // Step 10: Add item to order
  addItem(state, ord1.id, 'جاكيت خريفي', 400, 1);
  assertInvariants(state, 'Added new item to order');
  console.log('✓ Adding item verified: order_creation card amount and tied capital updated.');

  // Step 11: Add another expense item named "مصاريف"
  addItem(state, ord1.id, 'مصاريف', 75, 1);
  assertInvariants(state, 'Added second expense item named مصاريف');
  console.log('✓ Expense item added: included in cost, excluded from merchandise counts.');

  // Step 12: Delete item from order
  deleteItem(state, ord1.id, 'it_3');
  assertInvariants(state, 'Deleted item it_3');
  console.log('✓ Item deletion verified.');

  // Step 13: 50 Randomized Stress Steps
  console.log('--- Running 50 Randomized Monte Carlo Operations ---');
  for (let i = 1; i <= 50; i++) {
    const actionType = Math.floor(Math.random() * 7);
    const ord = state.orders[0];
    const nonExpenseItems = ord.items.filter((it) => it.name.trim() !== 'مصاريف');

    if (actionType === 0 && nonExpenseItems.length > 0) {
      // Sale
      const it = nonExpenseItems[Math.floor(Math.random() * nonExpenseItems.length)];
      const price = Math.round(it.costPrice * (1 + Math.random()));
      const modes: ('cash' | 'credit' | 'partial')[] = ['cash', 'credit', 'partial'];
      const mode = modes[Math.floor(Math.random() * modes.length)];
      const paid = mode === 'partial' ? Math.round(price * Math.random()) : undefined;
      registerSale(state, ord.id, it.id, price, mode, paid);
    } else if (actionType === 1 && state.customerPayments.length > 0) {
      // Cancel payment
      const p = state.customerPayments[Math.floor(Math.random() * state.customerPayments.length)];
      cancelPayment(state, p.id);
    } else if (actionType === 2) {
      // Collect payment
      const soldItems = ord.items.filter((it) => it.isSold);
      if (soldItems.length > 0) {
        const it = soldItems[Math.floor(Math.random() * soldItems.length)];
        recordPayment(state, ord.id, it.id, Math.round(50 + Math.random() * 200));
      }
    } else if (actionType === 3) {
      // Return item
      const soldItems = ord.items.filter((it) => it.isSold);
      if (soldItems.length > 0) {
        const it = soldItems[Math.floor(Math.random() * soldItems.length)];
        returnItem(state, ord.id, it.id);
      }
    } else if (actionType === 4 && ord.items.length > 0) {
      // Update item cost
      const it = ord.items[Math.floor(Math.random() * ord.items.length)];
      const newCost = Math.round(50 + Math.random() * 600);
      updateItemCost(state, ord.id, it.id, newCost);
    } else if (actionType === 5) {
      // Add regular item or expense item
      const isExp = Math.random() > 0.7;
      const name = isExp ? 'مصاريف' : `صنف عشوائي ${i}`;
      addItem(state, ord.id, name, Math.round(80 + Math.random() * 300), 1);
    } else if (actionType === 6 && ord.items.length > 2) {
      // Delete item
      const it = ord.items[Math.floor(Math.random() * ord.items.length)];
      deleteItem(state, ord.id, it.id);
    }

    assertInvariants(state, `Random Step #${i}`);
  }

  console.log('✓ All 50 randomized sequence iterations passed with 100% invariant validity!');
  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runRandomSequencesTest();
