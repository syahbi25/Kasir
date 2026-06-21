import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  User, 
  Clock, 
  RefreshCw,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Ticket,
  Sun,
  Moon
} from 'lucide-react';
import { Product, Transaction, Category, Coupon } from './types';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_TRANSACTIONS } from './data/initialProducts';
import Dashboard from './components/Dashboard';
import Cashier from './components/Cashier';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import CouponManagement from './components/CouponManagement';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kasir' | 'stok' | 'laporan' | 'kupon'>('dashboard');

  // Core States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Theme status
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('pos_dark_mode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pos_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pos_dark_mode', 'false');
    }
  }, [darkMode]);
  
  // Real-time Date Time tickers
  const [currentTime, setCurrentTime] = useState(new Date());

  // Cashier Profiling info
  const CASHIER_EMAIL = "sepbriansyah@gmail.com";

  // Load Initial states from LocalStorage or Fallbacks
  useEffect(() => {
    const savedProducts = localStorage.getItem('pos_products');
    const savedCategories = localStorage.getItem('pos_categories');
    const savedTransactions = localStorage.getItem('pos_transactions');
    const savedCoupons = localStorage.getItem('pos_coupons');

    if (savedProducts) {
      const parsed = JSON.parse(savedProducts).map((p: any) => ({
        ...p,
        initialCost: p.initialCost !== undefined ? p.initialCost : p.buyPrice
      }));
      setProducts(parsed);
    } else {
      const mapped = INITIAL_PRODUCTS.map(p => ({
        ...p,
        initialCost: p.buyPrice
      }));
      setProducts(mapped);
      localStorage.setItem('pos_products', JSON.stringify(mapped));
    }

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    } else {
      setCategories(INITIAL_CATEGORIES);
      localStorage.setItem('pos_categories', JSON.stringify(INITIAL_CATEGORIES));
    }

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    } else {
      setTransactions(INITIAL_TRANSACTIONS);
      localStorage.setItem('pos_transactions', JSON.stringify(INITIAL_TRANSACTIONS));
    }

    if (savedCoupons) {
      setCoupons(JSON.parse(savedCoupons));
    } else {
      const initialCoupons: Coupon[] = [
        {
          id: 'coupon-1',
          code: 'HEMAT10',
          type: 'PERCENTAGE',
          value: 10,
          minPurchase: 50000,
          isActive: true,
          usageCount: 2
        },
        {
          id: 'coupon-2',
          code: 'PROMOSERU',
          type: 'FLAT',
          value: 15000,
          minPurchase: 100000,
          isActive: true,
          usageCount: 5
        },
        {
          id: 'coupon-3',
          code: 'DISKONMEMBER',
          type: 'PERCENTAGE',
          value: 5,
          minPurchase: 0,
          isActive: true,
          usageCount: 12
        }
      ];
      setCoupons(initialCoupons);
      localStorage.setItem('pos_coupons', JSON.stringify(initialCoupons));
    }
  }, []);

  // Sync state mutations to local persistence helper
  const saveProductsState = (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));
  };

  const saveTransactionsState = (updatedTransactions: Transaction[]) => {
    setTransactions(updatedTransactions);
    localStorage.setItem('pos_transactions', JSON.stringify(updatedTransactions));
  };

  const saveCouponsState = (updatedCoupons: Coupon[]) => {
    setCoupons(updatedCoupons);
    localStorage.setItem('pos_coupons', JSON.stringify(updatedCoupons));
  };

  // Coupons CRUD
  const handleAddCoupon = (newCoupon: Coupon) => {
    const updated = [newCoupon, ...coupons];
    saveCouponsState(updated);
  };

  const handleUpdateCoupon = (updatedCoupon: Coupon) => {
    const updated = coupons.map(c => c.id === updatedCoupon.id ? updatedCoupon : c);
    saveCouponsState(updated);
  };

  const handleDeleteCoupon = (couponId: string) => {
    const updated = coupons.filter(c => c.id !== couponId);
    saveCouponsState(updated);
  };

  // Clock trigger
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Add Stock Increment Function (restock)
  const handleAddStock = (productId: string, quantity: number) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        return { ...p, stock: p.stock + quantity };
      }
      return p;
    });
    saveProductsState(updated);
  };

  // 2. Deduct Stock function
  const handleDeductStock = (productId: string, quantity: number) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        return { ...p, stock: Math.max(0, p.stock - quantity) };
      }
      return p;
    });
    saveProductsState(updated);
  };

  // 3. New Product addition
  const handleAddProduct = (newProduct: Product) => {
    const updated = [newProduct, ...products];
    saveProductsState(updated);
  };

  // 4. Update Product
  const handleUpdateProduct = (updatedProduct: Product) => {
    const updated = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    saveProductsState(updated);
  };

  // 5. Delete Product from base list
  const handleDeleteProduct = (productId: string) => {
    const updated = products.filter(p => p.id !== productId);
    saveProductsState(updated);
  };

  // 6. Checkout Success: Deducts Stock AND adds transaction
  const handleCheckoutSuccess = (newTx: Transaction) => {
    // Subtract stock real-time
    const updatedProducts = products.map(prod => {
      const purchasedItem = newTx.items.find(item => item.productId === prod.id);
      if (purchasedItem) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - purchasedItem.quantity)
        };
      }
      return prod;
    });

    // Check if coupon loaded in tx
    if (newTx.couponCode) {
      const updatedCoupons = coupons.map(c => {
        if (c.code === newTx.couponCode) {
          return {
            ...c,
            usageCount: c.usageCount + 1
          };
        }
        return c;
      });
      saveCouponsState(updatedCoupons);
    }

    saveProductsState(updatedProducts);
    saveTransactionsState([...transactions, newTx]);
  };

  // 7. Cancel Transaction / Refund Function (restores stock real-time!)
  const handleCancelTransaction = (transactionId: string) => {
    const txToCancel = transactions.find(t => t.id === transactionId);
    if (!txToCancel) return;

    // Restore stock quantities
    const restoredProducts = products.map(prod => {
      const cancelledItem = txToCancel.items.find(item => item.productId === prod.id);
      if (cancelledItem) {
        return {
          ...prod,
          stock: prod.stock + cancelledItem.quantity
        };
      }
      return prod;
    });

    // Decrease coupon usage count if valid
    if (txToCancel.couponCode) {
      const updatedCoupons = coupons.map(c => {
        if (c.code === txToCancel.couponCode) {
          return {
            ...c,
            usageCount: Math.max(0, c.usageCount - 1)
          };
        }
        return c;
      });
      saveCouponsState(updatedCoupons);
    }

    // Remove transaction log
    const updatedTransactions = transactions.filter(t => t.id !== transactionId);

    saveProductsState(restoredProducts);
    saveTransactionsState(updatedTransactions);
  };

  // Reset Demo Playground to Default seed helper
  const handleResetDemoPlayground = () => {
    if (confirm('Apakah Anda yakin ingin menyetel ulang data sediaan, penjualan, dan kupon kembali ke default awal? Semua penjualan yang dicatat saat ini akan dihapus.')) {
      setProducts(INITIAL_PRODUCTS);
      setTransactions(INITIAL_TRANSACTIONS);
      const defaultCoupons: Coupon[] = [
        {
          id: 'coupon-1',
          code: 'HEMAT10',
          type: 'PERCENTAGE',
          value: 10,
          minPurchase: 50000,
          isActive: true,
          usageCount: 2
        },
        {
          id: 'coupon-2',
          code: 'PROMOSERU',
          type: 'FLAT',
          value: 15000,
          minPurchase: 100000,
          isActive: true,
          usageCount: 5
        },
        {
          id: 'coupon-3',
          code: 'DISKONMEMBER',
          type: 'PERCENTAGE',
          value: 5,
          minPurchase: 0,
          isActive: true,
          usageCount: 12
        }
      ];
      setCoupons(defaultCoupons);
      localStorage.setItem('pos_products', JSON.stringify(INITIAL_PRODUCTS));
      localStorage.setItem('pos_transactions', JSON.stringify(INITIAL_TRANSACTIONS));
      localStorage.setItem('pos_coupons', JSON.stringify(defaultCoupons));
      setActiveTab('dashboard');
    }
  };

  // Counts low stock for badge notices
  const criticalProductsCount = products.filter(p => p.stock <= p.minStockThreshold).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200" id="applet-main-body">
      
      {/* GLOBAL HIGH-CONTRAST HEADER */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-35 shadow-xs transition-colors duration-200" id="global-application-header">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Logo brand & Ticking real-time notice */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-xs">
              <div className="w-4 h-4 border-2 border-white"></div>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-800 dark:text-white uppercase">
                KasirPintar <span className="text-indigo-600 dark:text-indigo-400">Pro</span>
              </h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-widest uppercase">REAL-TIME STOCK SYSTEM</p>
            </div>
          </div>

          {/* Clock timer, theme toggle, and user cashier login profile info */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400" id="header-right-meta">
            
            {/* Dynamic ticking clock */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-850 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350" id="clock-meta">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-mono text-[11px] tracking-tight">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} {currentTime.toLocaleTimeString('id-ID')}
              </span>
            </div>

            {/* Cashier Profiler */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-850 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-800" id="cashier-profiler">
              <div className="text-right" id="cashier-user-details">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-mono uppercase tracking-wider">Kasir Aktif</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{CASHIER_EMAIL}</span>
              </div>
            </div>

            {/* Dark Mode Theme Toggle Button */}
            <button
              onClick={() => setDarkMode(prev => !prev)}
              className="text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-amber-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
              id="theme-toggle-trigger"
              title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="sr-only sm:not-sr-only text-[10px] font-medium">
                {darkMode ? 'Terang' : 'Gelap'}
              </span>
            </button>

            {/* Quick clean reset developer utility button */}
            <button 
              onClick={handleResetDemoPlayground}
              className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-450 p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border border-transparent hover:border-rose-100 dark:hover:border-rose-900/50 transition-all cursor-pointer flex items-center gap-1"
              id="playground-reset-trigger"
              title="Setel Ulang Data Demo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="sr-only sm:not-sr-only text-[10px] font-medium">Reset</span>
            </button>

          </div>

        </div>
      </header>

      {/* HORIZONTAL SYSTEM NAV NAVIGATION BAR */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 shadow-xs transition-colors duration-200" id="navigation-bar">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto no-scrollbar">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-1 py-3 font-semibold text-xs tracking-wider uppercase cursor-pointer transition-all border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="nav-tab-dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('kasir')}
            className={`flex items-center gap-2 px-1 py-3 font-semibold text-xs tracking-wider uppercase cursor-pointer transition-all border-b-2 ${
              activeTab === 'kasir'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="nav-tab-kasir"
          >
            <ShoppingCart className="w-4 h-4" />
            POS Kasir
          </button>

          <button
            onClick={() => setActiveTab('stok')}
            className={`flex items-center gap-2 px-1 py-3 font-semibold text-xs tracking-wider uppercase cursor-pointer transition-all border-b-2 relative ${
              activeTab === 'stok'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="nav-tab-stok"
          >
            <Package className="w-4 h-4" />
            Manajemen Stok
            
            {/* Warning critical notification dot badge inside the tab */}
            {criticalProductsCount > 0 && (
              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 text-[10px] font-bold px-1.5 py-0.2 rounded-sm ml-1">
                {criticalProductsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('laporan')}
            className={`flex items-center gap-2 px-1 py-3 font-semibold text-xs tracking-wider uppercase cursor-pointer transition-all border-b-2 ${
              activeTab === 'laporan'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="nav-tab-laporan"
          >
            <FileText className="w-4 h-4" />
            Laporan Keuangan
          </button>

          <button
            onClick={() => setActiveTab('kupon')}
            className={`flex items-center gap-2 px-1 py-3 font-semibold text-xs tracking-wider uppercase cursor-pointer transition-all border-b-2 ${
              activeTab === 'kupon'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="nav-tab-kupon"
          >
            <Ticket className="w-4 h-4" />
            Kupon Diskon
          </button>

        </div>
      </nav>

      {/* CORE WORKSPACE INNER CONTENT VIEW */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6" id="applet-viewport-main">
        
        {/* Render only active relative child components */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            products={products}
            transactions={transactions}
            onAddStock={handleAddStock}
            onNavigateToPOS={() => setActiveTab('kasir')}
            onNavigateToStock={() => setActiveTab('stok')}
          />
        )}

        {activeTab === 'kasir' && (
          <Cashier 
            products={products}
            categories={categories}
            coupons={coupons}
            onCheckoutSuccess={handleCheckoutSuccess}
            cashierEmail={CASHIER_EMAIL}
          />
        )}

        {activeTab === 'stok' && (
          <Inventory 
            products={products}
            categories={categories}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddStock={handleAddStock}
            onDeductStock={handleDeductStock}
          />
        )}

        {activeTab === 'laporan' && (
          <Reports 
            transactions={transactions}
            products={products}
            onCancelTransaction={handleCancelTransaction}
          />
        )}

        {activeTab === 'kupon' && (
          <CouponManagement 
            coupons={coupons}
            onAddCoupon={handleAddCoupon}
            onUpdateCoupon={handleUpdateCoupon}
            onDeleteCoupon={handleDeleteCoupon}
          />
        )}

      </main>

      {/* SOBER INTENTIONAL SYSTEM FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-3.5 px-6 font-mono text-[10px] border-t border-slate-800 uppercase tracking-wider" id="app-footer">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>&copy; 2026 KASIR PINTAR REAL-TIME &bull; SEPBRIANSYAH@GMAIL.COM</span>
          <div className="flex justify-center gap-4 text-[10px] items-center">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
              STOK TERHUBUNG (LIVE)
            </span>
            <span className="text-indigo-400 font-bold">LOCAL DATABASE READY</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
