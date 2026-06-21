import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  Coins, 
  ShoppingCart, 
  AlertTriangle, 
  Plus, 
  Package, 
  Clock, 
  ArrowRight,
  TrendingDown,
  Sparkles,
  Brain,
  Truck,
  Check,
  Activity,
  Gauge
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { Product, Transaction, Category } from '../types';

interface DashboardProps {
  products: Product[];
  transactions: Transaction[];
  onAddStock: (productId: string, quantity: number) => void;
  onNavigateToPOS: () => void;
  onNavigateToStock: () => void;
}

// Custom tooltip styling for Recharts
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const formatIDR = (value: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };

    return (
      <div className="bg-slate-900 border border-slate-800 text-white rounded p-2.5 shadow-md font-sans text-xs">
        <p className="font-semibold text-slate-300">{payload[0].payload.name}</p>
        <p className="font-mono text-indigo-400 font-bold mt-1 text-sm">
          {formatIDR(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard({ 
  products, 
  transactions, 
  onAddStock,
  onNavigateToPOS,
  onNavigateToStock
}: DashboardProps) {
  const [quickStockId, setQuickStockId] = useState<string | null>(null);
  const [quickStockAmount, setQuickStockAmount] = useState<number>(10);

  // User configurable predictive restock parameters
  const [selectedHistoryDays, setSelectedHistoryDays] = useState<number>(7);
  const [safetyBufferMultiplier, setSafetyBufferMultiplier] = useState<number>(1.0);
  const [executedRestocks, setExecutedRestocks] = useState<Record<string, boolean>>({});

  // Predictive Re-order and Restock Calculations using historical transactions
  const predictiveRestockRecommendations = useMemo(() => {
    // 1. Calculate time threshold for historical transactions
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() - selectedHistoryDays);

    // Filter relevant transactions
    const filteredTx = transactions.filter(tx => {
      if (!tx.timestamp) return false;
      const txDate = new Date(tx.timestamp);
      return txDate >= thresholdDate;
    });

    // 2. Aggregate quantities sold for each item in the period
    const productSalesQty: Record<string, number> = {};
    products.forEach(p => {
      productSalesQty[p.id] = 0;
    });

    filteredTx.forEach(tx => {
      tx.items.forEach(item => {
        if (productSalesQty[item.productId] !== undefined) {
          productSalesQty[item.productId] += item.quantity;
        } else {
          productSalesQty[item.productId] = item.quantity;
        }
      });
    });

    // 3. Compute indicators per product
    const recommendations = products.map(product => {
      const totalUnitsSold = productSalesQty[product.id] || 0;
      // Daily velocity (sales speed)
      const velocity = totalUnitsSold / selectedHistoryDays;

      // Assign realistic category-based default lead time (days)
      let customLeadTime = 3; // default
      const cat = (product.category || '').toLowerCase();
      if (cat.includes('makan') || cat.includes('minum')) {
        customLeadTime = 2; // quick delivery for food/beverages
      } else if (cat.includes('sembako') || cat.includes('pokok')) {
        customLeadTime = 3;
      } else if (cat.includes('rokok') || cat.includes('tembakau')) {
        customLeadTime = 2;
      } else if (cat.includes('tulis') || cat.includes('buku') || cat.includes('stationery')) {
        customLeadTime = 4;
      } else if (cat.includes('elektronik') || cat.includes('gadget') || cat.includes('hp')) {
        customLeadTime = 5; // electronics takes longer
      }

      // Lead time demand = daily velocity * lead time days
      const leadTimeDemand = velocity * customLeadTime;

      // Safety stock is the user's custom minStockThreshold multiplied by safety multiplier
      const safetyStock = product.minStockThreshold * safetyBufferMultiplier;

      // Reorder Point = Lead Time Demand + Safety Stock
      const reorderPoint = Math.ceil(leadTimeDemand + safetyStock);

      // We should recommend reorder if current stock is less than reorder point or under threshold
      const isCritical = product.stock === 0;
      const isBelowThreshold = product.stock <= product.minStockThreshold;
      const needsRestock = product.stock <= reorderPoint || isBelowThreshold;

      // Recommended order volume: enough to cover another 14 days of average sales,
      // but ensuring a minimum block (e.g. 15 or 25 units or double safety stock) so the order makes mathematical sense
      const fourteenDaysVolume = Math.ceil(velocity * 14);
      const recommendedQty = Math.max(
        15,
        Math.ceil(product.minStockThreshold * 2),
        fourteenDaysVolume
      );

      // Urgency percentage scored from 0% to 100% to sort critical reorders to the top
      let urgencyScore = 0;
      if (product.stock === 0) {
        urgencyScore = 100;
      } else {
        const thresholdLimit = Math.max(reorderPoint, product.minStockThreshold, 1);
        urgencyScore = Math.min(99, Math.round(((thresholdLimit - product.stock) / thresholdLimit) * 100));
      }

      // Est. Days until running out completely (if velocity > 0)
      const daysToOutStr = velocity > 0 
        ? `${Math.max(0, Math.round(product.stock / velocity))} Hari` 
        : 'Tak Terbatas';

      return {
        product,
        totalUnitsSold,
        velocity,
        leadTime: customLeadTime,
        leadTimeDemand: Math.ceil(leadTimeDemand),
        safetyStock: Math.ceil(safetyStock),
        reorderPoint,
        needsRestock,
        recommendedQty,
        urgencyScore,
        daysToOutStr,
        isCritical
      };
    });

    // 4. Return items sorted by needsRestock DESC, then urgencyScore DESC
    return recommendations
      .filter(entry => entry.needsRestock)
      .sort((a, b) => {
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        return b.urgencyScore - a.urgencyScore;
      });
  }, [products, transactions, selectedHistoryDays, safetyBufferMultiplier]);

  // Handle immediate dispatch of restock recommendation
  const handleExecuteRestock = (productId: string, reorderQty: number) => {
    onAddStock(productId, reorderQty);
    setExecutedRestocks(prev => ({
      ...prev,
      [productId]: true
    }));
    // Auto reset execution state after delay
    setTimeout(() => {
      setExecutedRestocks(prev => ({
        ...prev,
        [productId]: false
      }));
    }, 4000);
  };

  // Helper formatting currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Calculate stats
  const stats = useMemo(() => {
    let revenue = 0;
    let totalCogs = 0;
    
    transactions.forEach(tx => {
      revenue += tx.total;
      tx.items.forEach(item => {
        // Find matching product in current products to retrieve initialCost
        const product = products.find(p => p.id === item.productId);
        // Cost per unit: use product's initialCost, fallback to buyPrice or item.buyPrice as safety nets
        const unitCost = product 
          ? (product.initialCost !== undefined ? product.initialCost : product.buyPrice)
          : item.buyPrice;
        
        // Cumulative Cost of Goods Sold (COGS)
        totalCogs += unitCost * item.quantity;
      });
    });

    const netProfit = revenue - totalCogs;
    const lowStockItems = products.filter(p => p.stock <= p.minStockThreshold);

    return {
      revenue,
      profit: netProfit,
      cogs: totalCogs,
      transactionCount: transactions.length,
      lowStockCount: lowStockItems.length,
      lowStockItems
    };
  }, [products, transactions]);

  // Calculate sales over the last 7 days for the Recharts BarChart
  const { last7DaysData, last7DaysTotal } = useMemo(() => {
    const days: Array<{
      dateStr: string;
      label: string;
      dayName: string;
      revenue: number;
    }> = [];
    
    const today = new Date();
    
    // Generate the last 7 calendar days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      
      days.push({
        dateStr,
        label,
        dayName,
        revenue: 0
      });
    }

    // Accumulate revenues for matching transactions
    transactions.forEach(tx => {
      if (tx.timestamp) {
        // Extract invoice date in local timezone format (YYYY-MM-DD)
        const txDateObj = new Date(tx.timestamp);
        const txYear = txDateObj.getFullYear();
        const txMonth = String(txDateObj.getMonth() + 1).padStart(2, '0');
        const txDay = String(txDateObj.getDate()).padStart(2, '0');
        const txDateStr = `${txYear}-${txMonth}-${txDay}`;
        
        const matchedDay = days.find(day => day.dateStr === txDateStr);
        if (matchedDay) {
          matchedDay.revenue += tx.total;
        }
      }
    });

    const totalSum = days.reduce((acc, d) => acc + d.revenue, 0);

    return {
      last7DaysData: days.map(day => ({
        name: `${day.dayName}, ${day.label}`,
        label: day.label,
        dayName: day.dayName,
        revenue: day.revenue
      })),
      last7DaysTotal: totalSum
    };
  }, [transactions]);

  // Real-time stock breakdown
  const stockMetrics = useMemo(() => {
    const total = products.length;
    if (total === 0) return { outOfStock: 0, lowStock: 0, normalStock: 0 };

    const outOfStock = products.filter(p => p.stock === 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStockThreshold).length;
    const normalStock = products.filter(p => p.stock > p.minStockThreshold).length;

    return {
      outOfStock,
      lowStock,
      normalStock,
      outOfStockPercent: Math.round((outOfStock / total) * 100),
      lowStockPercent: Math.round((lowStock / total) * 100),
      normalStockPercent: Math.round((normalStock / total) * 100),
    };
  }, [products]);

  // Best selling products calculation
  const topProducts = useMemo(() => {
    const counts: { [key: string]: { name: string; qty: number; revenue: number; category: string } } = {};
    
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        if (!counts[item.productId]) {
          // Find original product category
          const orig = products.find(p => p.id === item.productId);
          counts[item.productId] = {
            name: item.name,
            qty: 0,
            revenue: 0,
            category: orig?.category || 'Makanan'
          };
        }
        counts[item.productId].qty += item.quantity;
        counts[item.productId].revenue += item.sellPrice * item.quantity;
      });
    });

    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [transactions, products]);

  // Handle quick stock increment
  const handleQuickStockSubmit = (productId: string) => {
    if (quickStockAmount > 0) {
      onAddStock(productId, quickStockAmount);
      setQuickStockId(null);
      setQuickStockAmount(10);
    }
  };

  return (
    <div className="space-y-6" id="dashboard-view-container">
      {/* Welcome Banner */}
      <div className="bg-slate-900 rounded-lg p-6 text-white border border-slate-800 shadow-sm relative overflow-hidden" id="welcome-banner">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-slate-800/20 rounded-full blur-xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight">Selamat Datang di KasirPintar Real-Time</h1>
            <p className="text-slate-300 text-xs mt-1.5 max-w-xl font-sans leading-relaxed">
              Pantau jalannya usaha Anda secara langsung dengan sistem POS modern. Stok barang berkurang otomatis dan laporan keuangan terupdate secara detik demi detik.
            </p>
          </div>
          <button 
            onClick={onNavigateToPOS}
            className="self-start md:self-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded font-semibold text-xs tracking-wider uppercase transition-all shadow-xs flex items-center gap-2 cursor-pointer border-0 whitespace-nowrap"
            id="start-cashier-btn"
          >
            <ShoppingCart className="w-4 h-4" />
            Mulai Transaksi
          </button>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-summary-grid">
        {/* Card 1: Revenue */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-xs hover:border-slate-300 transition-all flex items-start justify-between" id="stat-card-revenue">
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Total Penjualan</span>
            <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{formatIDR(stats.revenue)}</h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded">
              <TrendingUp className="w-3 h-3" /> Real-time
            </span>
          </div>
          <div className="p-3 bg-indigo-50 rounded text-indigo-600 border border-indigo-100/50">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Net Profit */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-xs hover:border-slate-300 transition-all flex items-start justify-between" id="stat-card-profit">
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Keuntungan Bersih (Net Profit)</span>
            <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{formatIDR(stats.profit)}</h3>
            <span className="text-[9.5px] text-slate-500 font-mono font-bold block bg-slate-50 border border-slate-100 p-1 rounded mt-1.5 uppercase leading-tight">
              COGS (HPP): {formatIDR(stats.cogs)}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded text-emerald-600 border border-emerald-100/50 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Total Transactions */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-xs hover:border-slate-300 transition-all flex items-start justify-between" id="stat-card-transactions">
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Jumlah Transaksi</span>
            <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{stats.transactionCount}</h3>
            <span className="text-[10px] text-slate-400 font-mono font-medium">PROSES NOTA SELESAI ({stats.transactionCount})</span>
          </div>
          <div className="p-3 bg-blue-50 rounded text-blue-600 border border-blue-100/50">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Low Stock Warnings */}
        <div className={`border rounded p-5 shadow-xs hover:border-slate-300 transition-all flex items-start justify-between cursor-pointer ${
          stats.lowStockCount > 0 
            ? 'bg-rose-50 border-rose-200 text-rose-900' 
            : 'bg-white border-slate-200 text-slate-800'
        }`} id="stat-card-low-stock" onClick={onNavigateToStock}>
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Peringatan Stok</span>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">
              {stats.lowStockCount} <span className="text-xs font-normal text-slate-500">Barang</span>
            </h3>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
              stats.lowStockCount > 0
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {stats.lowStockCount > 0 ? '⚠️ Butuh Re-stock' : '✓ Semua Aman'}
            </span>
          </div>
          <div className={`p-3 rounded border ${
            stats.lowStockCount > 0 ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Dashboard Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-details">
        
        {/* Left 2 Cols: Alerts and Top Sellers */}
        <div className="lg:col-span-2 space-y-6" id="dashboard-left-zone">
          
          {/* CARA REORDER PREDIKTIF (PREDICTIVE RESTOCK COMPONENT) */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-lg p-5 border border-slate-800 shadow-md space-y-4 animate-fade-in" id="predictive-restock-panel">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-505/20 p-2 rounded-lg border border-indigo-500/35 text-indigo-400">
                  <Brain className="w-5 h-5 animate-pulse text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-1 text-slate-100">
                    Saran Restock Prediktif <span className="text-[9px] bg-indigo-600 text-slate-100 font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ml-1">SMART BI</span>
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">Rekomendasi re-order berdasarkan kecepatan penjualan historis & lead time sediaan.</p>
                </div>
              </div>

              {/* Model Controllers */}
              <div className="flex flex-wrap items-center gap-2 text-xs" id="predictive-controllers">
                <div className="bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 flex items-center shrink-0">
                  <span className="text-[9px] uppercase font-bold text-slate-405 px-2 font-mono">History:</span>
                  {[3, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedHistoryDays(days)}
                      className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                        selectedHistoryDays === days 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Analisis data penjualan ${days} hari terakhir`}
                    >
                      {days}h
                    </button>
                  ))}
                </div>

                <div className="bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 flex items-center shrink-0">
                  <span className="text-[9px] uppercase font-bold text-slate-450 px-2 font-mono">Buffer Stok:</span>
                  {[
                    { val: 1.0, label: 'Std' },
                    { val: 1.5, label: 'Volatile' }
                  ].map((option) => (
                    <button
                      key={option.val}
                      type="button"
                      onClick={() => setSafetyBufferMultiplier(option.val)}
                      className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                        safetyBufferMultiplier === option.val 
                          ? 'bg-purple-600 text-white shadow-xs' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Faktor pengali pengaman stok: ${option.val}x`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommendations presentation */}
            {predictiveRestockRecommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-slate-800/50 rounded-lg text-center gap-2" id="predictive-empty-state">
                <div className="bg-emerald-500/10 p-2.5 rounded-full text-emerald-400 border border-emerald-500/25">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">Persediaan Terjamin Optimal</h4>
                <p className="text-[11px] text-slate-400 max-w-md">
                  Semua stok produk saat ini terhitung mencukupi berdasarkan laju penjualan harian dan estimasi waktu kiriman supplier ({selectedHistoryDays} hari history).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="predictive-recommendations-grid">
                {predictiveRestockRecommendations.slice(0, 4).map(({ product, velocity, leadTime, leadTimeDemand, safetyStock, reorderPoint, recommendedQty, urgencyScore, daysToOutStr, isCritical }) => {
                  const alreadyDone = executedRestocks[product.id];
                  
                  return (
                    <div 
                      key={product.id} 
                      className={`p-3.5 rounded-lg relative overflow-hidden transition-all border flex flex-col justify-between ${
                        isCritical 
                          ? 'bg-rose-950/25 border-rose-900/50 hover:border-rose-700/60' 
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-750'
                      }`}
                      id={`predictive-item-${product.id}`}
                    >
                      {/* Urgency colored accent line and banner */}
                      <div className={`absolute top-0 right-0 text-[8.5px] uppercase font-black px-2 py-0.5 rounded-bl font-sans tracking-wide ${
                        isCritical 
                          ? 'bg-red-600 text-white' 
                          : urgencyScore > 60 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-indigo-650 text-indigo-100'
                      }`}>
                        Urgent {urgencyScore}%
                      </div>

                      <div className="space-y-2">
                        {/* Title and stats bar */}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-100 text-xs line-clamp-1">{product.name}</span>
                            <span className="text-[8px] font-mono bg-slate-850 text-slate-400 px-1 py-0.2 rounded border border-slate-800 uppercase print:hidden">
                              {product.category}
                            </span>
                          </div>
                          <span className="text-[9.5px] font-mono font-bold text-slate-450 block mt-0.5">
                            Sisa Stok: <span className={product.stock === 0 ? 'text-rose-400 font-black' : 'text-slate-200'}>{product.stock} {product.unitName || 'Pcs'}</span> &bull; Ambang: {product.minStockThreshold}
                          </span>
                        </div>

                        {/* Calculations Box */}
                        <div className="bg-slate-950/70 rounded p-2 text-[10px] space-y-1 font-mono text-slate-300 border border-slate-900">
                          <div className="flex justify-between items-center">
                            <span>Laju Jual Harian:</span>
                            <span className="font-bold text-slate-200 flex items-center gap-0.5">
                              <Activity className="w-3 h-3 text-indigo-400" />
                              {velocity.toFixed(2)} / Hari
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Estimasi Kosong:</span>
                            <span className={`font-bold ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>{daysToOutStr}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-900 pt-1 mt-1">
                            <span>Lead Time {leadTime}h Demand:</span>
                            <span>{leadTimeDemand} Pcs</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-500">
                            <span>Saran Reorder Point:</span>
                            <span>{reorderPoint} Pcs</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons section */}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-850 pt-2.5 gap-2" id={`predictive-action-${product.id}`}>
                        <div className="space-y-0.5">
                          <span className="text-[8px] uppercase font-bold text-slate-400 block font-mono">Rekomendasi Pesan:</span>
                          <span className="text-xs font-black font-mono text-emerald-400">+{recommendedQty} {product.unitName || 'Pcs'}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleExecuteRestock(product.id, recommendedQty)}
                          disabled={alreadyDone}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-md uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            alreadyDone 
                              ? 'bg-emerald-600 text-white opacity-90 cursor-default' 
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs border-0'
                          }`}
                        >
                          {alreadyDone ? (
                            <>
                              <Check className="w-3" /> Berhasil
                            </>
                          ) : (
                            <>
                              <Truck className="w-3 h-3 animate-bounce" /> Re-Order
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Last 7 Days Sales Trend Bar Chart */}
          <div className="bg-white border border-slate-200 rounded p-5 shadow-xs" id="sales-trend-panel">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Tren Penjualan 7 Hari Terakhir
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Total omset harian yang dihitung secara real-time.</p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Omset 7 Hari</span>
                <div className="text-sm font-bold text-indigo-600 font-mono">
                  {formatIDR(last7DaysTotal)}
                </div>
              </div>
            </div>

            <div className="h-64 w-full pt-2" id="sales-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7DaysData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={5}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                      return value;
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar 
                    dataKey="revenue" 
                    fill="#4f46e5" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Low Stock Real-Time action panel */}
          <div className="bg-white border border-slate-200 rounded p-5 shadow-xs" id="low-stock-management-panel">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Stok Kritis &amp; Tambah Cepat
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Produk yang berada di bawah ambang batas minimal sediaan.</p>
              </div>
              <button 
                onClick={onNavigateToStock} 
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer uppercase tracking-wider"
                id="view-all-stock-link"
              >
                Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.lowStockItems.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded" id="empty-stock-warnings">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Seluruh Stok Kategori Aman</p>
                <p className="text-xs text-slate-400">Semua produk Anda saat ini di atas batas minimum.</p>
              </div>
            ) : (
              <div className="overflow-x-auto" id="low-stock-table-container">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-2.5">Produk</th>
                      <th className="pb-2.5 text-center">Stok / Minimal</th>
                      <th className="pb-2.5 text-right">Status</th>
                      <th className="pb-2.5 text-right">Restock Cepat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.lowStockItems.slice(0, 5).map((product) => {
                      const isOutOfStock = product.stock === 0;
                      return (
                        <tr key={product.id} className="hover:bg-slate-50" id={`low-stock-row-${product.id}`}>
                           <td className="py-3">
                            <div className="font-semibold text-slate-800">{product.name}</div>
                            <div className="text-xs text-slate-400 font-mono">{product.barcode} &bull; {product.category}</div>
                          </td>
                           <td className="py-3 text-center">
                            <div className="font-bold flex items-center justify-center gap-1.5 font-mono text-xs">
                              <span className={isOutOfStock ? 'text-red-600' : 'text-amber-600'}>
                                {product.stock}
                              </span>
                              <span className="text-slate-300">/</span>
                              <span className="text-slate-500 font-normal">{product.minStockThreshold}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isOutOfStock 
                                ? 'bg-red-50 text-red-700 border-red-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isOutOfStock ? 'HABIS' : 'MENIPIS'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {quickStockId === product.id ? (
                              <div className="inline-flex items-center gap-1" id={`quick-stock-popover-${product.id}`}>
                                <input 
                                  type="number" 
                                  min="1"
                                  className="w-16 px-2 py-1 text-xs text-center border border-slate-350 rounded focus:border-indigo-500 focus:outline-none font-mono"
                                  value={quickStockAmount}
                                  onChange={(e) => setQuickStockAmount(Math.max(1, parseInt(e.target.value) || 0))}
                                />
                                <button 
                                  onClick={() => handleQuickStockSubmit(product.id)}
                                  className="bg-indigo-600 text-white p-1 rounded font-bold hover:bg-indigo-700 cursor-pointer w-6 h-6 flex items-center justify-center"
                                  id={`submit-qty-${product.id}`}
                                  title="Simpan"
                                >
                                  +
                                </button>
                                <button 
                                  onClick={() => setQuickStockId(null)}
                                  className="text-slate-400 text-xs hover:text-slate-600 p-1 cursor-pointer font-bold"
                                  id={`cancel-qty-${product.id}`}
                                >
                                  &times;
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setQuickStockId(product.id);
                                  setQuickStockAmount(10);
                                }}
                                className="inline-flex items-center gap-1 text-xs bg-indigo-50 border border-indigo-100 font-bold text-indigo-700 hover:bg-indigo-100 px-2.5 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider"
                                id={`stock-add-trigger-${product.id}`}
                              >
                                <Plus className="w-3 h-3" />
                                Restock
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Selling Products Visual Meter */}
          <div className="bg-white border border-slate-200 rounded p-5 shadow-xs" id="top-selling-panel">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Produk Terlaris (Kuantitas)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Analisis lima produk dengan volume penjualan tertinggi.</p>
            </div>

            {topProducts.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded" id="empty-top-sellers">
                <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Belum ada transaksi</p>
                <p className="text-xs text-slate-400">Data produk terlaris otomatis terisi saat penjualan selesai.</p>
              </div>
            ) : (
              <div className="space-y-4" id="top-selling-list">
                {topProducts.map((p, idx) => {
                  const maxQty = Math.max(...topProducts.map(t => t.qty));
                  const percentageWidth = maxQty > 0 ? (p.qty / maxQty) * 100 : 0;
                  
                  return (
                    <div key={idx} className="space-y-1.5" id={`top-sell-item-${idx}`}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-slate-50 border border-slate-200 text-[10px] font-bold font-mono rounded flex items-center justify-center text-slate-500">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800 text-xs">{p.name}</span>
                          <span className="text-[9px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded uppercase">
                            {p.category}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800 text-xs font-mono">{p.qty} PCS</span>
                          <span className="text-[10px] text-indigo-600 block font-bold font-mono">{formatIDR(p.revenue)}</span>
                        </div>
                      </div>
                      
                      {/* Bar indicator with dynamic theme widths */}
                      <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded transition-all duration-300" 
                          style={{ width: `${percentageWidth}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: General Health and Quick Actions */}
        <div className="space-y-6" id="dashboard-right-zone">
          
          {/* Inventory Distribution Health Pie/Bars */}
          <div className="bg-white border border-slate-200 rounded p-5 shadow-xs" id="inventory-health-status">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-1.5 text-sm uppercase tracking-wider">
              <Package className="w-4 h-4 text-indigo-600" />
              Status Sediaan Barang
            </h3>
            
            <div className="space-y-4" id="metrics-group">
              {/* Stat breakdowns */}
              <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded border border-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Aman</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800 text-xs font-mono">{stockMetrics.normalStock} ITEM</div>
                  <div className="text-[9px] text-emerald-700 font-bold font-mono">{stockMetrics.normalStockPercent}% DARI TOTAL</div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-amber-50/50 p-3 rounded border border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Menipis</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800 text-xs font-mono">{stockMetrics.lowStock} ITEM</div>
                  <div className="text-[9px] text-amber-700 font-bold font-mono">{stockMetrics.lowStockPercent}% DARI TOTAL</div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-rose-50/50 p-3 rounded border border-rose-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">Habis</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800 text-xs font-mono">{stockMetrics.outOfStock} ITEM</div>
                  <div className="text-[9px] text-rose-700 font-bold font-mono">{stockMetrics.outOfStockPercent}% DARI TOTAL</div>
                </div>
              </div>

              {/* Progress bar visual composition */}
              <div className="pt-2">
                <div className="h-3 w-full bg-slate-100 rounded-sm flex overflow-hidden">
                  <div 
                    title="Normal" 
                    className="bg-emerald-500 h-full transition-all" 
                    style={{ width: `${stockMetrics.normalStockPercent}%` }}
                  ></div>
                  <div 
                    title="Stok Menipis" 
                    className="bg-amber-400 h-full transition-all" 
                    style={{ width: `${stockMetrics.lowStockPercent}%` }}
                  ></div>
                  <div 
                    title="Stok Habis" 
                    className="bg-red-500 h-full transition-all" 
                    style={{ width: `${stockMetrics.outOfStockPercent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-2 font-bold uppercase">
                  <span>Aman: {stockMetrics.normalStock}</span>
                  <span>Menipis: {stockMetrics.lowStock}</span>
                  <span>Habis: {stockMetrics.outOfStock}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Audits / Logs */}
          <div className="bg-white border border-slate-200 rounded p-5 shadow-xs" id="recent-transaction-history">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                <Clock className="w-4 h-4 text-indigo-600" />
                Histori Nota Terakhir
              </h3>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">Belum ada penjualan diselesaikan.</div>
            ) : (
              <div className="space-y-3" id="recent-history-list">
                {transactions.slice(-3).reverse().map((tx) => {
                  const itemsCount = tx.items.reduce((sum, item) => sum + item.quantity, 0);
                  const time = new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={tx.id} className="border-b border-slate-100 last:border-b-0 pb-3 last:pb-0 text-sm flex items-start justify-between" id={`recent-tx-${tx.id}`}>
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs font-mono">
                          {tx.invoiceNumber}
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border font-sans font-bold uppercase ${
                            tx.paymentMethod === 'TUNAI' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                          }`}>
                            {tx.paymentMethod}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {itemsCount} barang &bull; {time}
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-indigo-600 text-xs">
                        {formatIDR(tx.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
