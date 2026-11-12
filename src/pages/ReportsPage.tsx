/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Icon3D } from '../components/icons3d/Icon3D';

const getLocalTodayDate = (): { year: number; month: number; day: number; str: string } => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const str = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, str };
};

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const formatArabicDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx >= 12) return dateStr;
  return `${day} ${ARABIC_MONTHS[monthIdx]} ${year}`;
};

export const ReportsPage: React.FC = () => {
  const {
    state,
    baseCapital,
    liquidity,
    tiedInOrders,
    capitalGrowthTotal,
    capitalAdvancesOpen,
    capitalErosionSettled,
    pocketBalance,
    pocketTotalWithdrawn,
    pocketTotalRepaid,
    pocketOpenDebt,
    salaryTotalBudgeted,
    salaryTotalSpent,
    salaryTotalRemaining,
    customers,
    setCurrentPage,
  } = useApp();

  // Accordion sections (open default: capital_orders)
  const [openSection, setOpenSection] = useState<'capital_orders' | 'pocket' | 'salary'>('capital_orders');

  const toggleSection = (sec: 'capital_orders' | 'pocket' | 'salary') => {
    setOpenSection(openSection === sec ? ('' as any) : sec);
  };

  // =========================================================
  // فلتر أرباح الأوردرات حسب الفترة (كارت ثابت جديد)
  // =========================================================
  const todayInfo = useMemo(() => getLocalTodayDate(), []);
  const [profitFilterMode, setProfitFilterMode] = useState<'month' | 'custom' | 'all'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(todayInfo.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(todayInfo.month);
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${todayInfo.year}-${String(todayInfo.month).padStart(2, '0')}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(todayInfo.str);

  const isCurrentMonthOrFuture =
    selectedYear > todayInfo.year ||
    (selectedYear === todayInfo.year && selectedMonth >= todayInfo.month);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonthOrFuture) return;
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const dateRange = useMemo(() => {
    if (profitFilterMode === 'month') {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
        daysInMonth
      ).padStart(2, '0')}`;
      return { start, end };
    } else if (profitFilterMode === 'custom') {
      return { start: customStartDate, end: customEndDate };
    }
    return null;
  }, [profitFilterMode, selectedYear, selectedMonth, customStartDate, customEndDate]);

  const periodOrdersAnalytics = useMemo(() => {
    const list = state.orders.filter((order) => {
      if (!dateRange) return true;
      if (!order.date) return false;
      return order.date >= dateRange.start && order.date <= dateRange.end;
    });

    const sorted = [...list].sort((a, b) => {
      const dComp = (b.date || '').localeCompare(a.date || '');
      if (dComp !== 0) return dComp;
      return b.id.localeCompare(a.id);
    });

    let completedCount = 0;
    let completedProfit = 0;
    let completedCost = 0;
    let completedSales = 0;

    let openCount = 0;
    let openCost = 0;

    const detailedOrders = sorted.map((order) => {
      const itemsCost = order.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
      const totalCost = itemsCost + (order.additionalBagCost || 0);
      const regularItems = order.items.filter((it) => it.name.trim() !== 'مصاريف');
      const soldItems = regularItems.filter((it) => it.isSold);
      const totalCollected = order.items.filter((it) => it.isSold).reduce((s, it) => {
        const fullPrice = (it.soldPrice || 0) * (it.quantity || 1);
        return s + (it.paidAmount !== undefined ? it.paidAmount : fullPrice);
      }, 0);
      const netProfit = totalCollected - totalCost;
      const isAllSold = regularItems.length > 0 && regularItems.every((it) => it.isSold);
      const hasRemainingDebt = soldItems.some((it) => {
        const fullPrice = (it.soldPrice || 0) * (it.quantity || 1);
        const paidAmt = it.paidAmount !== undefined ? it.paidAmount : fullPrice;
        return fullPrice - paidAmt > 0.001;
      });

      let status: 'مقفول' | 'خسارة' | 'مفتوح' | 'بانتظار التحصيل' | 'منتهي';
      if (order.isFinished) {
        status = 'منتهي';
      } else if (isAllSold) {
        if (hasRemainingDebt) {
          status = 'بانتظار التحصيل';
        } else {
          status = netProfit >= 0 ? 'مقفول' : 'خسارة';
        }
      } else {
        status = 'مفتوح';
      }

      const isCompleted = isAllSold && !hasRemainingDebt;

      if (isCompleted) {
        completedCount += 1;
        completedProfit += netProfit;
        completedCost += totalCost;
        completedSales += totalCollected;
      } else {
        openCount += 1;
        openCost += totalCost;
      }

      return {
        id: order.id,
        code: order.code,
        date: order.date,
        formattedDate: formatArabicDate(order.date),
        totalCost,
        totalCollected,
        netProfit,
        status,
        isCompleted,
      };
    });

    return {
      orders: detailedOrders,
      completedCount,
      completedProfit,
      completedCost,
      completedSales,
      openCount,
      openCost,
    };
  }, [state.orders, dateRange]);

  // =========================================================
  // 1. تقرير رأس المال والأوردرات (استثماري متقدم)
  // =========================================================
  const capitalAndOrdersAnalytics = useMemo(() => {
    let totalSales = 0;
    let totalCosts = 0;
    let totalProfit = 0;

    const ordersAnalysis: Array<{
      id: string;
      code: string;
      date: string;
      cost: number;
      sold: number;
      profit: number;
      roi: number;
      isCompleted: boolean;
      itemsCount: number;
    }> = [];
    const officePerformance: Record<string, { itemsCount: number; totalCost: number; totalSold: number; profit: number }> = {};
    const stagnantItemsList: Array<{ name: string; orderCode: string; daysOpen: number; costPrice: number }> = [];

    const now = Date.now();
    let totalTurnoverDays = 0;
    let completedOrdersCount = 0;

    state.orders.forEach((o) => {
      const orderCost = o.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0) + (o.additionalBagCost || 0);
      const regularItems = o.items.filter((it) => it.name.trim() !== 'مصاريف');
      const orderSold = o.items.filter((it) => it.isSold).reduce((s, it) => {
        const fullPrice = (it.soldPrice || 0) * (it.quantity || 1);
        return s + (it.paidAmount !== undefined ? it.paidAmount : fullPrice);
      }, 0);
      const profit = orderSold - orderCost;
      const isCompleted = regularItems.length > 0 && regularItems.every((it) => it.isSold);
      const orderRoi = orderCost > 0 ? (profit / orderCost) * 100 : 0;

      totalCosts += orderCost;
      totalSales += orderSold;
      if (profit > 0) totalProfit += profit;

      // Turnover duration
      if (isCompleted) {
        completedOrdersCount++;
        const oTime = new Date(o.date).getTime();
        const lastSoldTime = Math.max(...o.items.map((it) => (it.soldDate ? new Date(it.soldDate).getTime() : oTime)));
        const days = Math.max(1, Math.floor((lastSoldTime - oTime) / (1000 * 60 * 60 * 24)));
        totalTurnoverDays += days;
      }

      // Office performance & stagnant items
      o.items.forEach((it) => {
        const off = it.officeName || 'غير محدد';
        if (!officePerformance[off]) {
          officePerformance[off] = { itemsCount: 0, totalCost: 0, totalSold: 0, profit: 0 };
        }
        const itemCost = it.costPrice * (it.quantity || 1);
        const fullSold = it.isSold && it.soldPrice !== undefined ? it.soldPrice * (it.quantity || 1) : 0;
        const itemCollected = it.isSold ? (it.paidAmount !== undefined ? it.paidAmount : fullSold) : 0;
        const isFullyPaid = it.isSold && (it.paidAmount === undefined || it.paidAmount >= fullSold);

        officePerformance[off].itemsCount += it.quantity || 1;
        officePerformance[off].totalCost += itemCost;
        officePerformance[off].totalSold += itemCollected;
        if (it.isSold && isFullyPaid) {
          officePerformance[off].profit += itemCollected - itemCost;
        }

        if (!it.isSold && it.name.trim() !== 'مصاريف') {
          const days = Math.floor((now - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
          stagnantItemsList.push({
            name: it.name,
            orderCode: o.code,
            daysOpen: days,
            costPrice: it.costPrice * (it.quantity || 1),
          });
        }
      });

      ordersAnalysis.push({
        id: o.id,
        code: o.code,
        date: o.date,
        cost: orderCost,
        sold: orderSold,
        profit,
        roi: orderRoi,
        isCompleted,
        itemsCount: regularItems.length,
      });
    });

    const overallRoi = totalCosts > 0 ? (totalProfit / totalCosts) * 100 : 0;
    const avgTurnoverDays = completedOrdersCount > 0 ? Math.round(totalTurnoverDays / completedOrdersCount) : 0;

    // Best & Worst Orders
    const sortedByProfit = [...ordersAnalysis].sort((a, b) => b.profit - a.profit);
    const topOrders = sortedByProfit.filter((o) => o.profit > 0).slice(0, 3);
    const worstOrders = [...ordersAnalysis].sort((a, b) => a.profit - b.profit).slice(0, 3);

    // Stagnant items sorted by days open
    const topStagnantItems = [...stagnantItemsList].sort((a, b) => b.daysOpen - a.daysOpen).slice(0, 4);

    // Offices performance sorted by profit
    const sortedOffices = Object.entries(officePerformance).sort((a, b) => b[1].profit - a[1].profit);

    // Customer Debts calculation
    let totalCustomerDebt = 0;
    let indebtedCustomersCount = 0;
    customers.forEach((c) => {
      let custDebt = 0;
      state.orders.forEach((ord) => {
        ord.items.forEach((it) => {
          if (it.customerId === c.id && it.isSold) {
            const due = (it.soldPrice || 0) * (it.quantity || 1);
            const paid = it.paidAmount !== undefined ? it.paidAmount : due;
            custDebt += Math.max(0, due - paid);
          }
        });
      });
      if (custDebt > 0.001) {
        totalCustomerDebt += custDebt;
        indebtedCustomersCount++;
      }
    });

    // Smart Investment Recommendations
    const recommendations: string[] = [];
    if (tiedInOrders > liquidity) {
      recommendations.push('تنبيه: حجم رأس المال المحبوس في بضاعة الأوردرات يتجاوز السيولة الحرة المتاحة؛ يُنصح بالتركيز على تصريف المخزون الحالي قبل فتح أوردرات جديدة.');
    }
    if (topStagnantItems.length > 0 && topStagnantItems[0].daysOpen > 30) {
      recommendations.push(`يوجد أصناف راكدة تجاوزت ${topStagnantItems[0].daysOpen} يوماً (مثل ${topStagnantItems[0].name})؛ يُنصح بعمل تسوية أو عروض خصم لتسييل قيمتها.`);
    }
    if (sortedOffices.length > 0 && sortedOffices[0][1].profit > 0) {
      recommendations.push(`مكتب "${sortedOffices[0][0]}" يحقق أعلى صافي ربحية؛ يُنصح بتعزيز التعامل معه.`);
    }
    if (totalCustomerDebt > 0) {
      recommendations.push(`لديك ديون معلقة لدى العملاء بقيمة ${totalCustomerDebt.toLocaleString('en-US')} ${state.settings.currency}؛ تحصيلها سيزيد السيولة الحرة فوراً.`);
    }
    if (recommendations.length === 0) {
      recommendations.push('أداء رأس المال والأوردرات يسير بتوازن ممتاز وسيولة جيدة.');
    }

    return {
      totalSales,
      totalCosts,
      totalProfit,
      overallRoi,
      avgTurnoverDays,
      topOrders,
      worstOrders,
      topStagnantItems,
      sortedOffices,
      totalCustomerDebt,
      indebtedCustomersCount,
      recommendations,
    };
  }, [state.orders, liquidity, tiedInOrders, customers, state.settings.currency]);

  // =========================================================
  // 2. تقرير البوكيت (خزنة طوارئ وتحليلات عملية)
  // =========================================================
  const pocketAnalytics = useMemo(() => {
    const withdrawals = state.pocketTransactions.filter((tx) => tx.type === 'withdrawal');
    const repaymentRate = pocketTotalWithdrawn > 0 ? (pocketTotalRepaid / pocketTotalWithdrawn) * 100 : 100;

    // Categories Breakdown
    const catMap: Record<string, number> = {};
    const monthMap: Record<string, number> = {};
    const dayOfWeekMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const monthPartMap = { beginning: 0, middle: 0, end: 0 };

    let maxWithdrawal = { amount: 0, desc: '-', date: '-' };

    withdrawals.forEach((w) => {
      const cat = w.category || 'غير مصنف';
      catMap[cat] = (catMap[cat] || 0) + w.amount;

      const m = w.date ? w.date.slice(0, 7) : 'أخرى';
      monthMap[m] = (monthMap[m] || 0) + w.amount;

      if (w.amount > maxWithdrawal.amount) {
        maxWithdrawal = { amount: w.amount, desc: w.description, date: w.date };
      }

      // Day of week
      const d = new Date(w.date);
      if (!isNaN(d.getTime())) {
        dayOfWeekMap[d.getDay()] = (dayOfWeekMap[d.getDay()] || 0) + w.amount;
        const dayOfMonth = d.getDate();
        if (dayOfMonth <= 10) monthPartMap.beginning += w.amount;
        else if (dayOfMonth <= 20) monthPartMap.middle += w.amount;
        else monthPartMap.end += w.amount;
      }
    });

    const sortedCats = Object.entries(catMap)
      .map(([name, total]) => ({
        name,
        total,
        pct: pocketTotalWithdrawn > 0 ? (total / pocketTotalWithdrawn) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Monthly Trend Comparison (this month vs last month)
    const sortedMonths = Object.keys(monthMap).sort();
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const currentMonthSpent = monthMap[currentMonthKey] || 0;
    const prevMonthIndex = sortedMonths.indexOf(currentMonthKey) - 1;
    const prevMonthSpent = prevMonthIndex >= 0 ? monthMap[sortedMonths[prevMonthIndex]] || 0 : 0;
    const monthTrendPct = prevMonthSpent > 0 ? ((currentMonthSpent - prevMonthSpent) / prevMonthSpent) * 100 : 0;

    // Day of week names
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const sortedDays = Object.entries(dayOfWeekMap)
      .map(([idx, total]) => ({ day: dayNames[Number(idx)], total }))
      .sort((a, b) => b.total - a.total);

    // Average withdrawal
    const avgWithdrawal = withdrawals.length > 0 ? pocketTotalWithdrawn / withdrawals.length : 0;

    // Sources of Support
    let supportFromSalaryTotal = 0;
    let supportFromSalaryCount = 0;
    let supportFromOrdersTotal = 0;
    let supportFromOrdersCount = 0;

    state.pocketTransactions.forEach((tx) => {
      if (tx.type === 'support_salary') {
        supportFromSalaryTotal += tx.amount;
        supportFromSalaryCount++;
      } else if (tx.type === 'support_profit') {
        supportFromOrdersTotal += tx.amount;
        supportFromOrdersCount++;
      }
    });

    // Smart Pocket Recommendations
    const recommendations: string[] = [];
    if (sortedCats.length > 0 && sortedCats[0].pct > 40) {
      recommendations.push(`فئة "${sortedCats[0].name}" تستهلك ${sortedCats[0].pct.toFixed(0)}% من سحوبات البوكيت؛ راجع إمكانية تخصيص ميزانية لها من القبض.`);
    }
    if (monthTrendPct > 20) {
      recommendations.push(`ارتفع معدل السحب هذا الشهر بنسبة ${monthTrendPct.toFixed(0)}% مقارنة بالشهر السابق؛ يُفضل وضع سقف شهري لسحوبات الطوارئ.`);
    }
    if (pocketOpenDebt > 0 && repaymentRate < 50) {
      recommendations.push(`نسبة سداد سلف البوكيت (${repaymentRate.toFixed(0)}%) منخفضة؛ خصص جزءاً من الوفر في القبض لسداد السلف القديمة.`);
    }
    if (recommendations.length === 0) {
      recommendations.push('معدل استخدام بوكيت كخزنة طوارئ متزن وفعال.');
    }

    return {
      repaymentRate,
      sortedCats,
      currentMonthSpent,
      monthTrendPct,
      sortedDays,
      monthPartMap,
      avgWithdrawal,
      maxWithdrawal,
      withdrawalsCount: withdrawals.length,
      supportFromSalaryTotal,
      supportFromSalaryCount,
      supportFromOrdersTotal,
      supportFromOrdersCount,
      recommendations,
    };
  }, [state.pocketTransactions, pocketTotalWithdrawn, pocketTotalRepaid, pocketOpenDebt]);

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E] dark:text-[#F4F0FA]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج، ارتفاع 52px */}
      <div className="card-header-purple flex items-center justify-between">
        <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
          التقارير المالية والتحليلات
        </span>

        <button
          onClick={() => setCurrentPage('entry')}
          className="btn-back-transparent"
          title="رجوع للرئيسية"
        >
          ➜
        </button>
      </div>

      {/* كارت ثابت: أرباح الأوردرات حسب الفترة */}
      <div className="card-main p-4 space-y-3.5 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4E1EC] dark:border-[#3A3150]">
          <h3 className="text-[14px] font-[800] text-[#5F2967] dark:text-[#D8B4FE]">
            أرباح الأوردرات حسب الفترة
          </h3>
          <span className="text-[10px] text-[#857D89] dark:text-[#9E97B0] font-[600]">
            بتاريخ إنشاء الأوردر
          </span>
        </div>

        {/* أزرار أوضاع التصفية: شهر / فترة / الكل */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#F7F4F8] dark:bg-[#2A1F36] border border-[#EBE6ED] dark:border-[#3A3150] text-[11px] font-bold">
          {[
            { id: 'month', label: 'شهر' },
            { id: 'custom', label: 'فترة' },
            { id: 'all', label: 'الكل' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setProfitFilterMode(mode.id as any)}
              className={`flex-1 py-1 rounded-xl transition cursor-pointer text-center ${
                profitFilterMode === mode.id
                  ? 'bg-[#5F2967] text-white shadow-xs'
                  : 'text-[#666079] dark:text-[#9E97B0] hover:text-[#1F1A2E] dark:hover:text-[#F4F0FA]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* وضع الشهر: اسم الشهر والتنقل */}
        {profitFilterMode === 'month' && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#F7F4F8] dark:bg-[#2A1F36] border border-[#EBE6ED] dark:border-[#3A3150]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-[#5F2967] dark:text-[#D8B4FE] hover:bg-white dark:hover:bg-[#1E1726] transition cursor-pointer"
              title="الشهر السابق"
            >
              ›
            </button>
            <span className="font-[800] text-[13px] text-[#211B24] dark:text-[#F4F0FA]">
              {ARABIC_MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isCurrentMonthOrFuture}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-[#5F2967] dark:text-[#D8B4FE] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-[#1E1726] transition cursor-pointer"
              title="الشهر التالي"
            >
              ‹
            </button>
          </div>
        )}

        {/* وضع الفترة: من / إلى */}
        {profitFilterMode === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-[#857D89] dark:text-[#9E97B0] mb-1">
                من تاريخ:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl border border-[#EBE6ED] dark:border-[#3A3150] bg-white dark:bg-[#231A2C] font-bold text-[11px] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#857D89] dark:text-[#9E97B0] mb-1">
                إلى تاريخ:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl border border-[#EBE6ED] dark:border-[#3A3150] bg-white dark:bg-[#231A2C] font-bold text-[11px] outline-none"
              />
            </div>
          </div>
        )}

        {/* النتائج: رقم كبير للربح الصافي للأوردرات المكتملة */}
        <div className="p-3 rounded-2xl bg-[#F7F4F8] dark:bg-[#2A1F36] border border-[#EBE6ED] dark:border-[#3A3150] text-center space-y-1">
          <span className="text-[10px] font-[600] text-[#857D89] dark:text-[#9E97B0] block">
            صافي ربح الأوردرات المكتملة
          </span>
          <div
            className={`text-2xl font-[800] tabular-nums ${
              periodOrdersAnalytics.completedProfit > 0
                ? 'text-[#267356] dark:text-[#4BA682]'
                : periodOrdersAnalytics.completedProfit < 0
                ? 'text-[#A33B56] dark:text-[#FB7185]'
                : 'text-[#211B24] dark:text-[#F4F0FA]'
            }`}
          >
            {periodOrdersAnalytics.completedProfit > 0 ? `+` : ''}
            {periodOrdersAnalytics.completedProfit.toLocaleString('en-US')} {state.settings.currency}
          </div>
        </div>

        {/* صفين صغار لتفاصيل المكتملة والمفتوحة */}
        <div className="space-y-1.5 pt-0.5">
          {/* صف المكتملة */}
          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-xl bg-white dark:bg-[#231A2C] border border-[#EBE6ED] dark:border-[#3A3150]">
            <span className="font-[700] text-[#211B24] dark:text-[#F4F0FA]">
              أوردرات مكتملة ({periodOrdersAnalytics.completedCount})
            </span>
            <div className="flex items-center gap-2 tabular-nums font-[700] text-[10px]">
              <span className="text-[#3B9AC4] dark:text-[#7DD3FC]">
                تكلفة: {periodOrdersAnalytics.completedCost.toLocaleString('en-US')} {state.settings.currency}
              </span>
              <span className="text-[#857D89] dark:text-[#9E97B0]">|</span>
              <span className="text-[#5F2967] dark:text-[#D8B4FE]">
                مبيعات: {periodOrdersAnalytics.completedSales.toLocaleString('en-US')} {state.settings.currency}
              </span>
            </div>
          </div>

          {/* صف المفتوحة / بانتظار التحصيل */}
          <div className="px-2 py-1.5 rounded-xl bg-white dark:bg-[#231A2C] border border-[#EBE6ED] dark:border-[#3A3150] space-y-0.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-[700] text-amber-700 dark:text-amber-400">
                أوردرات مفتوحة / بانتظار التحصيل ({periodOrdersAnalytics.openCount})
              </span>
              <span className="tabular-nums font-[700] text-[10px] text-[#3B9AC4] dark:text-[#7DD3FC]">
                تكلفة: {periodOrdersAnalytics.openCost.toLocaleString('en-US')} {state.settings.currency}
              </span>
            </div>
            <p className="text-[9px] text-[#857D89] dark:text-[#9E97B0] leading-tight">
              (لا تدخل في حساب الأرباح حتى تكتمل مبيعاتها وتحصيلها بالكامل)
            </p>
          </div>
        </div>

        {/* قائمة مضغوطة بأوردرات الفترة */}
        <div className="pt-1 space-y-1">
          <span className="text-[10px] font-bold text-[#857D89] dark:text-[#9E97B0] block">
            أوردرات الفترة ({periodOrdersAnalytics.orders.length}):
          </span>

          {periodOrdersAnalytics.orders.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-[#857D89] dark:text-[#9E97B0] bg-[#F7F4F8] dark:bg-[#2A1F36] rounded-xl border border-dashed border-[#EBE6ED] dark:border-[#3A3150]">
              لا توجد أوردرات في هذه الفترة
            </div>
          ) : (
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-0.5">
              {periodOrdersAnalytics.orders.map((ord) => (
                <div
                  key={ord.id}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#231A2C] border border-[#EBE6ED] dark:border-[#3A3150] flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="font-[800] text-[#211B24] dark:text-[#F4F0FA] truncate">
                      {ord.code}
                    </span>
                    <span className="text-[9px] text-[#857D89] dark:text-[#9E97B0] shrink-0 font-normal">
                      {ord.formattedDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-[700] tabular-nums ${
                        ord.netProfit > 0
                          ? 'text-[#267356] dark:text-[#4BA682]'
                          : ord.netProfit < 0
                          ? 'text-[#A33B56] dark:text-[#FB7185]'
                          : 'text-[#857D89] dark:text-[#9E97B0]'
                      }`}
                    >
                      {ord.netProfit > 0 ? `+` : ''}
                      {ord.netProfit.toLocaleString('en-US')} {state.settings.currency}
                    </span>
                    <span
                      className={`text-[8px] font-[700] px-1.5 py-0.5 rounded-full ${
                        ord.status === 'منتهي'
                          ? 'bg-[#E2E8F0] dark:bg-[#334155] text-[#475569] dark:text-[#94A3B8]'
                          : ord.status === 'مقفول'
                          ? 'bg-[#E7F4EE] dark:bg-[#267356]/20 text-[#267356] dark:text-[#4BA682]'
                          : ord.status === 'خسارة'
                          ? 'bg-[#F9E9ED] dark:bg-[#A33B56]/20 text-[#A33B56] dark:text-[#FB7185]'
                          : ord.status === 'بانتظار التحصيل'
                          ? 'bg-[#FBF1DB] dark:bg-[#8B641E]/20 text-[#8B641E] dark:text-[#FDE68A]'
                          : 'bg-[#F4EAF5] dark:bg-[#692571]/20 text-[#692571] dark:text-[#D8B4FE]'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. THE 3 EXPANDED ACCORDION SECTIONS */}
      <div className="w-full flex flex-col gap-[13px]">
        {/* ========================================================= */}
        {/* SECTION 1: تقرير رأس المال (استثماري وعملي)               */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('capital_orders')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] dark:bg-[#2D1F35] text-[#5F2967] dark:text-[#D8B4FE] flex items-center justify-center shrink-0">
                <Icon3D name="capital" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#5F2967] dark:text-[#D8B4FE] leading-tight truncate">
                  تقرير رأس المال والاستثمار
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  العائد على الاستثمار، أداء المكاتب، والأصناف الراكدة
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'capital_orders' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'capital_orders' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3.5 text-xs">
              {/* Row 1: 4 Key Metric Cards */}
              <div className="grid grid-cols-2 gap-2 pt-3">
                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">رأس المال الحالي / الأولي:</span>
                  <div className="text-sm font-black tabular-nums text-[#2B2340] dark:text-white">
                    {baseCapital.toLocaleString('en-US')}{' '}
                    <span className="text-[10px] text-[#9A98B0]">/ {state.settings.initialCapital.toLocaleString('en-US')}</span>
                  </div>
                  <span className="text-[10px] text-[#2FA36B] font-bold block mt-0.5">
                    النمو: +{capitalGrowthTotal.toLocaleString('en-US')} {state.settings.currency}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">معدل العائد الإجمالي (ROI):</span>
                  <div className="text-sm font-black tabular-nums text-[#2FA36B]">
                    {capitalAndOrdersAnalytics.overallRoi.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-[#9A98B0] block mt-0.5">
                    صافي الأرباح: {capitalAndOrdersAnalytics.totalProfit.toLocaleString('en-US')}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">السيولة مقابل المحبوس:</span>
                  <div className="text-xs font-black tabular-nums text-[#5F2967] dark:text-[#9B67A4]">
                    {liquidity.toLocaleString('en-US')} حرة / {tiedInOrders.toLocaleString('en-US')} محبوس
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">متوسط مدة دوران الأوردر:</span>
                  <div className="text-sm font-black tabular-nums text-[#2B2340] dark:text-white">
                    {capitalAndOrdersAnalytics.avgTurnoverDays > 0 ? `${capitalAndOrdersAnalytics.avgTurnoverDays} يوم` : 'فوري'}
                  </div>
                </div>
              </div>

              {/* Row 2: Customer Debts Alert */}
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold block">
                    المديونيات المعلقة عند العملاء:
                  </span>
                  <strong className="text-sm font-black text-[#E2574C] tabular-nums">
                    {capitalAndOrdersAnalytics.totalCustomerDebt.toLocaleString('en-US')} {state.settings.currency}
                  </strong>
                </div>
                <button
                  onClick={() => setCurrentPage('customers')}
                  className="px-2.5 py-1 rounded-xl bg-amber-500 text-white font-bold text-[10px] cursor-pointer"
                >
                  عرض العملاء ({capitalAndOrdersAnalytics.indebtedCustomersCount})
                </button>
              </div>

              {/* Row 3: Office Performance Ranking */}
              {capitalAndOrdersAnalytics.sortedOffices.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-[#5F2967] dark:text-[#9B67A4] block">
                    أداء المكاتب والموردين (الربحية وعدد الأصناف):
                  </span>
                  <div className="space-y-1">
                    {capitalAndOrdersAnalytics.sortedOffices.map(([name, data]) => (
                      <div
                        key={name}
                        className="p-2.5 rounded-xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-[#2B2340] dark:text-white block font-bold">{name}</strong>
                          <span className="text-[10px] text-[#9A98B0]">
                            {data.itemsCount} صنف • تكلفة: {data.totalCost.toLocaleString('en-US')}
                          </span>
                        </div>
                        <div className="text-left">
                          <strong className={`font-black tabular-nums block ${data.profit >= 0 ? 'text-[#2FA36B]' : 'text-[#E2574C]'}`}>
                            {data.profit >= 0 ? '+' : ''}{data.profit.toLocaleString('en-US')} {state.settings.currency}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 4: Stagnant Items */}
              {capitalAndOrdersAnalytics.topStagnantItems.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-[#E2574C] block">
                    الأصناف الراكدة غير المباعة ومدة بقائها:
                  </span>
                  <div className="space-y-1">
                    {capitalAndOrdersAnalytics.topStagnantItems.map((st, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex justify-between items-center text-[11px]"
                      >
                        <div>
                          <strong className="text-[#2B2340] dark:text-white block">{st.name}</strong>
                          <span className="text-[10px] text-[#9A98B0]">
                            {st.orderCode} • مفتوح منذ {st.daysOpen} يوم
                          </span>
                        </div>
                        <strong className="text-[#E2574C] font-black tabular-nums">
                          محبوس: {st.costPrice.toLocaleString('en-US')} {state.settings.currency}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 5: Actionable Investment Recommendations */}
              <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5">
                <span className="text-xs font-black text-[#5F2967] dark:text-[#9B67A4] block">
                  توصيات وقرارات مالية مقترحة:
                </span>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#2B2340] dark:text-[#F2EEF7] leading-relaxed">
                  {capitalAndOrdersAnalytics.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: تقرير البوكيت (خزنة طوارئ وتحليلات عملية)      */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('pocket')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#EBF3F8] dark:bg-[#1E2E3D] text-[#3D6A8F] dark:text-[#93C5FD] flex items-center justify-center shrink-0">
                <Icon3D name="pocket" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-indigo-700 dark:text-indigo-400 leading-tight truncate">
                  تقرير بوكيت وخزنة الطوارئ
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  تحليل السحب والاتجاه الزمني ومصادر الدعم
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'pocket' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'pocket' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3.5 text-xs">
              {/* Row 1: 4 Key Metric Cards */}
              <div className="grid grid-cols-2 gap-2 pt-3">
                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">المسحوب / المسدد:</span>
                  <div className="text-sm font-black tabular-nums text-[#2B2340] dark:text-white">
                    {pocketTotalWithdrawn.toLocaleString('en-US')}{' '}
                    <span className="text-[10px] text-[#2FA36B]">/ {pocketTotalRepaid.toLocaleString('en-US')}</span>
                  </div>
                  <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
                    المتبقي دين: {pocketOpenDebt.toLocaleString('en-US')} {state.settings.currency}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">نسبة السداد:</span>
                  <div className="text-sm font-black tabular-nums text-[#2FA36B]">
                    {pocketAnalytics.repaymentRate.toFixed(0)}%
                  </div>
                  <span className="text-[10px] text-[#9A98B0] block mt-0.5">
                    {pocketAnalytics.withdrawalsCount} حركة سحب
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">متوسط السحبة الواحدة:</span>
                  <div className="text-sm font-black tabular-nums text-[#2B2340] dark:text-white">
                    {pocketAnalytics.avgWithdrawal.toLocaleString('en-US', { maximumFractionDigits: 0 })} {state.settings.currency}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">أكبر سحبة مسجلة:</span>
                  <div className="text-sm font-black tabular-nums text-[#E2574C]">
                    {pocketAnalytics.maxWithdrawal.amount.toLocaleString('en-US')} {state.settings.currency}
                  </div>
                  <span className="text-[9px] text-[#9A98B0] block truncate">
                    {pocketAnalytics.maxWithdrawal.desc}
                  </span>
                </div>
              </div>

              {/* Row 2: Category Breakdown with visual CSS progress bars */}
              {pocketAnalytics.sortedCats.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 block">
                    أكثر التصنيفات سحباً ونسبة كل منها:
                  </span>
                  <div className="space-y-2">
                    {pocketAnalytics.sortedCats.map((c) => (
                      <div key={c.name} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>{c.name}</span>
                          <strong className="tabular-nums">
                            {c.total.toLocaleString('en-US')} ({c.pct.toFixed(0)}%)
                          </strong>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#ECECF4] dark:bg-[#32263F] overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, c.pct))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 3: Timing analysis (Days & Part of Month) */}
              <div className="p-3 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F] space-y-2">
                <span className="text-[11px] font-bold text-[#2B2340] dark:text-white block">
                  أوقات الشهر الأكثر سحباً:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#231A2C]">
                    <span className="text-[#9A98B0] block">أول الشهر (1-10)</span>
                    <strong className="text-xs font-black tabular-nums">
                      {pocketAnalytics.monthPartMap.beginning.toLocaleString('en-US')}
                    </strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#231A2C]">
                    <span className="text-[#9A98B0] block">منتصف الشهر (11-20)</span>
                    <strong className="text-xs font-black tabular-nums">
                      {pocketAnalytics.monthPartMap.middle.toLocaleString('en-US')}
                    </strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#231A2C]">
                    <span className="text-[#9A98B0] block">آخر الشهر (21-31)</span>
                    <strong className="text-xs font-black tabular-nums">
                      {pocketAnalytics.monthPartMap.end.toLocaleString('en-US')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Row 4: Sources of Support (From Salary vs Orders 20%) */}
              <div className="p-3 rounded-2xl bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] space-y-1.5">
                <span className="text-[11px] font-bold text-[#2FA36B] block">
                  مصادر تغذية ودعم خزنة بوكيت:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                    <span className="text-[#9A98B0] block text-[10px]">من ميزانية القبض:</span>
                    <strong className="text-[#5F2967] dark:text-[#9B67A4] font-black tabular-nums">
                      +{pocketAnalytics.supportFromSalaryTotal.toLocaleString('en-US')} ({pocketAnalytics.supportFromSalaryCount} حركة)
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                    <span className="text-[#9A98B0] block text-[10px]">من أرباح الأوردرات (20%):</span>
                    <strong className="text-[#2FA36B] font-black tabular-nums">
                      +{pocketAnalytics.supportFromOrdersTotal.toLocaleString('en-US')} ({pocketAnalytics.supportFromOrdersCount} حركة)
                    </strong>
                  </div>
                </div>
              </div>

              {/* Row 5: Pocket Smart Tips */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 block">
                  تنبيهات وتوصيات لترشيد الطوارئ:
                </span>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#2B2340] dark:text-[#F2EEF7] leading-relaxed">
                  {pocketAnalytics.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: تقرير القبض والميزانية                          */}
        {/* ========================================================= */}
        <div className="card-main overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('salary')}
            className="w-full h-[50px] px-[15px] flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#FBF1DE] dark:bg-[#332616] text-[#B7791F] dark:text-[#D4983D] flex items-center justify-center shrink-0">
                <Icon3D name="salary" size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#B7791F] dark:text-[#D4983D] leading-tight truncate">
                  تقرير ميزانية القبض
                </h3>
                <span className="text-[11px] font-[600] text-[#666079] dark:text-[#9E97B0] leading-tight block truncate">
                  الميزانية المقررة والمصروف الفعلي والمتبقي
                </span>
              </div>
            </div>
            <div className="text-[#666079] dark:text-[#9E97B0] shrink-0">
              <Icon3D name={openSection === 'salary' ? 'chevron_up' : 'chevron_down'} size={18} />
            </div>
          </button>

          {openSection === 'salary' && (
            <div className="px-[15px] pb-[15px] pt-[2px] border-t border-[#E4E1EC] dark:border-[#3A3150] space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                <div className="p-2.5 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#9A98B0] block">الميزانية:</span>
                  <span className="text-sm font-black text-[#2B2340] dark:text-white tabular-nums">
                    {salaryTotalBudgeted.toLocaleString('en-US')}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#E2574C] block">المصروف:</span>
                  <span className="text-sm font-black text-[#E2574C] tabular-nums">
                    {salaryTotalSpent.toLocaleString('en-US')}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-[#F1F1FA] dark:bg-[#17101D] border border-[#ECECF4] dark:border-[#32263F]">
                  <span className="text-[10px] text-[#2FA36B] block">المتبقي:</span>
                  <span className="text-sm font-black text-[#2FA36B] tabular-nums">
                    {salaryTotalRemaining.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              {/* Items spending bars */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-[#F5A623] block">
                  أكثر بنود الميزانية صرفاً:
                </span>
                <div className="space-y-2">
                  {state.salaryBudget
                    .filter((b) => b.spent > 0)
                    .sort((a, b) => b.spent - a.spent)
                    .map((b) => {
                      const pct = b.budgeted > 0 ? (b.spent / b.budgeted) * 100 : 100;
                      return (
                        <div key={b.id} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span>{b.name}</span>
                            <strong className="tabular-nums">
                              {b.spent.toLocaleString('en-US')} / {b.budgeted.toLocaleString('en-US')} ({pct.toFixed(0)}%)
                            </strong>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#ECECF4] dark:bg-[#32263F] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 100 ? 'bg-[#E2574C]' : 'bg-[#5F2967]'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
