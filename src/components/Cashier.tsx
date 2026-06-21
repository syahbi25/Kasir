import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowLeft,
  DollarSign, 
  CreditCard, 
  QrCode, 
  Wallet,
  AlertTriangle,
  FileText,
  Percent,
  CheckCircle2,
  Scan,
  Camera,
  Printer,
  Ticket
} from 'lucide-react';
import { Product, CartItem, Category, Transaction, Coupon } from '../types';
import { BarcodeScanner } from './BarcodeScanner';

export function getItemUnitPrice(product: Product, quantity: number, tier: 'UMUM' | 'RESELLER' | 'AGEN'): number {
  const sellPrice = product.sellPrice;
  const wsPrice1 = product.wholesalePrice;
  const wsMin1 = product.wholesaleMinQty;
  const wsPrice2 = product.wholesalePrice2;
  const wsMin2 = product.wholesaleMinQty2;

  if (tier === 'AGEN') {
    if (wsPrice2 !== undefined && wsPrice2 > 0) return wsPrice2;
    if (wsPrice1 !== undefined && wsPrice1 > 0) return wsPrice1;
    return sellPrice;
  }

  if (tier === 'RESELLER') {
    const hasMin2 = wsMin2 !== undefined && quantity >= wsMin2;
    if (hasMin2 && wsPrice2 !== undefined && wsPrice2 > 0) return wsPrice2;
    if (wsPrice1 !== undefined && wsPrice1 > 0) return wsPrice1;
    return sellPrice;
  }

  const hasMin2 = wsMin2 !== undefined && wsMin2 > 0 && quantity >= wsMin2;
  const hasMin1 = wsMin1 !== undefined && wsMin1 > 0 && quantity >= wsMin1;

  if (hasMin2 && wsPrice2 !== undefined && wsPrice2 > 0) {
    return wsPrice2;
  }
  if (hasMin1 && wsPrice1 !== undefined && wsPrice1 > 0) {
    return wsPrice1;
  }

  return sellPrice;
}

interface CashierProps {
  products: Product[];
  categories: Category[];
  coupons?: Coupon[];
  onCheckoutSuccess: (newTx: Transaction) => void;
  cashierEmail: string;
}

export default function Cashier({ 
  products, 
  categories, 
  coupons = [],
  onCheckoutSuccess,
  cashierEmail
}: CashierProps) {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerTier, setCustomerTier] = useState<'UMUM' | 'RESELLER' | 'AGEN'>('UMUM');
  
  // Checkout drawer/modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [includeTax, setIncludeTax] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'TUNAI' | 'QRIS' | 'TRANSFER' | 'DEBIT'>('TUNAI');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  // Coupon promo state managers
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  
  // Barcode search simulation
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastCreatedTransaction, setLastCreatedTransaction] = useState<Transaction | null>(null);

  // Real device camera barcode scanner state
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Low Stock Alert Notification State
  interface LowStockAlert {
    id: string;
    productId: string;
    productName: string;
    category: string;
    oldStock: number;
    newStock: number;
    minThreshold: number;
  }
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);

  // Auto Dismiss Toast Alerts
  useEffect(() => {
    if (lowStockAlerts.length > 0) {
      const oldestAlert = lowStockAlerts[0];
      const timer = setTimeout(() => {
        setLowStockAlerts(prev => prev.filter(alert => alert.id !== oldestAlert.id));
      }, 7500);
      return () => clearTimeout(timer);
    }
  }, [lowStockAlerts]);

  const dismissAlert = (alertId: string) => {
    setLowStockAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.barcode.includes(searchTerm);
      const matchCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Calculate cart sums
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = getItemUnitPrice(item.product, item.quantity, customerTier);
      return sum + (price * item.quantity);
    }, 0);
  }, [cart, customerTier]);

  const tax = useMemo(() => {
    // 11% PPN in Indonesia
    return includeTax ? Math.round(subtotal * 0.11) : 0;
  }, [subtotal, includeTax]);

  // Coupon discount calculation
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'PERCENTAGE') {
      return Math.round(subtotal * (appliedCoupon.value / 100));
    } else {
      return appliedCoupon.value;
    }
  }, [appliedCoupon, subtotal]);

  const totalDiscount = useMemo(() => {
    return discount + couponDiscount;
  }, [discount, couponDiscount]);

  const total = useMemo(() => {
    return Math.max(0, subtotal + tax - totalDiscount);
  }, [subtotal, tax, totalDiscount]);

  const amountChange = useMemo(() => {
    const paidNum = parseFloat(amountPaid) || 0;
    return Math.max(0, paidNum - total);
  }, [amountPaid, total]);

  const isValidPayment = useMemo(() => {
    if (total === 0) return false;
    if (paymentMethod === 'TUNAI') {
      return (parseFloat(amountPaid) || 0) >= total;
    }
    return true; // Non-tunai is exact payment
  }, [paymentMethod, amountPaid, total]);

  // Helper formatting currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Toast / State warning message
  const [warnMsg, setWarnMsg] = useState<string | null>(null);

  // Validate coupon when subtotal changes
  useEffect(() => {
    if (appliedCoupon) {
      if (subtotal < appliedCoupon.minPurchase) {
        setAppliedCoupon(null);
        setCouponSuccess(null);
        setWarnMsg(`Kupon "${appliedCoupon.code}" otomatis dilepas karena total belanja di bawah minimum pembelian.`);
        setTimeout(() => setWarnMsg(null), 4000);
      }
    }
  }, [subtotal, appliedCoupon]);

  const showWarning = (msg: string) => {
    setWarnMsg(msg);
    setTimeout(() => setWarnMsg(null), 3000);
  };

  // Add item to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      showWarning(`Stok "${product.name}" habis!`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.stock) {
        showWarning(`Batas stok tercapai. Sisa stok "${product.name}" hanya tinggal ${product.stock} unit.`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  // Quick Barcode Scan Simulation
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    const matchedProduct = products.find(p => p.barcode === barcodeInput);
    if (matchedProduct) {
      addToCart(matchedProduct);
      setBarcodeInput('');
      setBarcodeError(null);
    } else {
      setBarcodeError('Produk dengan barcode tersebut tidak ditemukan.');
      setTimeout(() => setBarcodeError(null), 3500);
    }
  };

  // Quantity controllers
  const incrementQuantity = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = cart.findIndex(item => item.product.id === productId);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.stock) {
        showWarning(`Gagal menambah: Stok "${product.name}" habis atau terbatas (${product.stock} unit).`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    }
  };

  const decrementQuantity = (productId: string) => {
    const existingIndex = cart.findIndex(item => item.product.id === productId);
    if (existingIndex > -1) {
      const updated = [...cart];
      if (updated[existingIndex].quantity <= 1) {
        updated.splice(existingIndex, 1);
      } else {
        updated[existingIndex].quantity -= 1;
      }
      setCart(updated);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (quantity > product.stock) {
      showWarning(`Kuantitas melebihi batas stok. Memasang jumlah maksimal: ${product.stock} unit.`);
      quantity = product.stock;
    }
    
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === productId);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity = quantity;
      setCart(updated);
    }
  };

  // Set tunai amount helper buttons
  const applyPresetCash = (amount: number) => {
    setAmountPaid(amount.toString());
  };

  // Coupon Action Handlers
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    const trimmed = couponCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setCouponError('Kode kupon tidak boleh kosong.');
      return;
    }

    if (cart.length === 0) {
      setCouponError('Keranjang belanja masih kosong.');
      return;
    }

    const matched = coupons.find(c => c.code.toUpperCase() === trimmed);
    if (!matched) {
      setCouponError(`Kupon "${trimmed}" tidak ditemukan.`);
      return;
    }

    if (!matched.isActive) {
      setCouponError(`Kupon "${matched.code}" sedang dinonaktifkan.`);
      return;
    }

    if (subtotal < matched.minPurchase) {
      setCouponError(`Min. belanja Rp ${matched.minPurchase.toLocaleString('id-ID')} diperlukan.`);
      return;
    }

    setAppliedCoupon(matched);
    setCouponSuccess(`Kupon "${matched.code}" berhasil diterapkan!`);
    setCouponCodeInput('');
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponSuccess(null);
    setCouponError(null);
  };

  // Reset states
  const resetPOS = () => {
    setCart([]);
    setDiscount(0);
    setAmountPaid('');
    setPaymentMethod('TUNAI');
    setCheckoutNotes('');
    setCustomerTier('UMUM');
    setIsCheckoutOpen(false);
    
    // Clear coupons states
    setCouponCodeInput('');
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponSuccess(null);
  };

  // Complete transactions
  const processCheckout = () => {
    if (cart.length === 0) return;
    if (!isValidPayment && paymentMethod === 'TUNAI') {
      showWarning('Pembayaran belum mencukupi.');
      return;
    }

    const paidVal = paymentMethod === 'TUNAI' ? (parseFloat(amountPaid) || 0) : total;
    const changeVal = paymentMethod === 'TUNAI' ? amountChange : 0;
    
    // Create actual unique transaction matching invoice format
    const invoiceNum = `INV/${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}/${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newTransaction: Transaction = {
      id: `trx-${Date.now()}`,
      invoiceNumber: invoiceNum,
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        sellPrice: getItemUnitPrice(item.product, item.quantity, customerTier),
        buyPrice: item.product.buyPrice
      })),
      subtotal,
      tax,
      discount: totalDiscount,
      total,
      paymentMethod,
      amountPaid: paidVal,
      amountChange: changeVal,
      timestamp: new Date().toISOString(),
      cashierName: cashierEmail,
      notes: checkoutNotes.trim() === '' ? undefined : checkoutNotes.trim(),
      couponCode: appliedCoupon?.code || undefined
    };

    // Callback so App.tsx can deduct quantities and store transactions
    onCheckoutSuccess(newTransaction);

    // Detect products whose stock falls below minimum threshold due to this sale
    const newlyLowStockItems: LowStockAlert[] = [];
    cart.forEach(item => {
      const prod = products.find(p => p.id === item.product.id);
      if (prod) {
        const remainingStock = Math.max(0, prod.stock - item.quantity);
        if (remainingStock <= prod.minStockThreshold) {
          newlyLowStockItems.push({
            id: `alert-${Date.now()}-${prod.id}`,
            productId: prod.id,
            productName: prod.name,
            category: prod.category,
            oldStock: prod.stock,
            newStock: remainingStock,
            minThreshold: prod.minStockThreshold
          });
        }
      }
    });

    if (newlyLowStockItems.length > 0) {
      setLowStockAlerts(prev => [...prev, ...newlyLowStockItems]);
    }
    
    // Prepare Receipt Modal
    setLastCreatedTransaction(newTransaction);
    setShowReceipt(true);
    resetPOS();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="cashier-zone-container">
      
      {/* Alert Warning Toast standard */}
      {warnMsg && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-red-650 text-white font-bold px-4 py-2.5 rounded border border-red-500 shadow-md z-50 flex items-center gap-2 text-xs uppercase tracking-wider" id="warning-toast">
          <AlertTriangle className="w-4 h-4 text-white" />
          <span>{warnMsg}</span>
        </div>
      )}

      {/* Low Stock Alerts Floating Toast Stack */}
      {lowStockAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0" id="low-stock-toasts-container">
          {lowStockAlerts.map((alert) => (
            <div 
              key={alert.id}
              className="bg-slate-900 border border-amber-500/35 text-white rounded-lg shadow-xl p-3.5 flex items-start gap-3 relative overflow-hidden transition-all duration-300"
              id={`toast-${alert.id}`}
            >
              {/* Dynamic Amber Alert Accent Bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 animate-pulse"></div>

              {/* Warning Icon */}
              <div className="bg-amber-500/15 p-1.5 rounded text-amber-500 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-grow space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-amber-500 font-mono">
                    Peringatan Sisa Stok
                  </span>
                  <button 
                    onClick={() => dismissAlert(alert.id)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm leading-none shrink-0"
                    title="Tutup"
                  >
                    &times;
                  </button>
                </div>
                <h5 className="font-semibold text-xs text-slate-100 line-clamp-1">{alert.productName}</h5>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span>Sisa: <strong className="text-amber-450 font-bold">{alert.newStock} unit</strong></span>
                  <span>&bull;</span>
                  <span>Batas Min: {alert.minThreshold}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LEFT COLUMN: PRODUCTS & CATEGORIES LISTING (8 Cols) */}
      <div className="lg:col-span-8 flex flex-col gap-4" id="products-listing-column">
        
        {/* Search & Scan Action Bar */}
        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs space-y-3" id="cashier-control-bar">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Standard Text Search bar */}
            <div className="relative md:col-span-7" id="product-standard-search">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Cari nama produk atau kode barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
              />
            </div>

            {/* Real Camera Barcode Scanner trigger and simulate input row */}
            <div className="relative md:col-span-12 lg:col-span-5 flex flex-col sm:flex-row gap-2" id="barcode-and-camera-setup">
              <form onSubmit={handleBarcodeSubmit} className="relative flex-grow flex gap-2" id="barcode-form">
                <div className="relative flex-grow">
                  <Scan className="absolute left-3 top-2.5 w-4 h-4 text-purple-400" />
                  <input 
                    type="text"
                    placeholder="Simulasi scan barcode..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs font-mono bg-purple-50/50 border border-purple-150 rounded focus:bg-white focus:outline-none focus:border-purple-600 text-purple-900"
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-indigo-650 text-white hover:bg-indigo-700 px-3.5 py-1.5 rounded text-xs font-bold tracking-wider uppercase transition-all shadow-xs shrink-0 cursor-pointer h-[34px] flex items-center justify-center font-sans"
                  id="barcode-scan-submit"
                >
                  Scan
                </button>
              </form>
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider shrink-0 h-[34px] font-sans"
                id="cashier-trigger-camera-scanner"
                title="Buka Pemindai Barcode Kamera Perangkat (BEEP)"
              >
                <Camera className="w-3.5 h-3.5 animate-pulse" />
                <span>Pindai Kamera</span>
              </button>
            </div>
          </div>

          {barcodeError && (
            <p className="text-xs text-red-650 font-bold px-2" id="barcode-error-label">⚠️ {barcodeError}</p>
          )}
          
          <div className="bg-indigo-50 border border-indigo-100 rounded p-2 text-[10px] text-indigo-800 font-mono" id="barcode-hint">
            <strong>💡 KLIK SIMULASI CEPAT:</strong> Copy paste <span className="underline select-all font-bold">89686011116</span> (Indomie) atau <span className="underline select-all font-bold">89999010023</span> (Teh Botol Sosro) lalu klik tombol Scan.
          </div>
        </div>

        {/* Horizontal Category Tabs selector */}
        <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar scroll-smooth" id="categories-tabs-scroll">
          <button
            onClick={() => setSelectedCategory('Semua')}
            className={`px-4 py-1.5 rounded text-xs font-bold tracking-wider uppercase border transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'Semua'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            id="cat-tab-all"
          >
            Semua ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter(p => p.category === cat.name).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-1.5 rounded text-xs font-bold tracking-wider uppercase border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat.name
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                }`}
                id={`cat-tab-${cat.id}`}
              >
                <span>{cat.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Product Grid Area with real-time stock */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded py-16 text-center shadow-xs" id="empty-catalogue-match">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold">Produk tidak ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Sesuaikan filter pencarian teks atau kriteria kategori Anda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto max-h-[520px] pr-1" id="product-grid-catalogue">
            {filteredProducts.map((product) => {
              const isLowStock = product.stock > 0 && product.stock <= product.minStockThreshold;
              const isOutOfStock = product.stock === 0;
              
              // Find quantities in current cart
              const cartItem = cart.find(item => item.product.id === product.id);
              const cartQty = cartItem ? cartItem.quantity : 0;

              return (
                <div 
                  key={product.id}
                  onClick={() => !isOutOfStock && addToCart(product)}
                  className={`bg-white rounded border p-3 flex flex-col justify-between transition-all select-none relative group ${
                    isOutOfStock 
                      ? 'border-slate-200 opacity-55 cursor-not-allowed bg-slate-50' 
                      : 'border-slate-200 hover:border-indigo-600 hover:shadow-xs cursor-pointer'
                  }`}
                  id={`product-card-${product.id}`}
                >
                  {/* Cart quantity badge */}
                  {cartQty > 0 && (
                    <span className="absolute top-2 right-2 bg-indigo-600 text-white w-5.5 h-5.5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs border border-white">
                      {cartQty}
                    </span>
                  )}

                  {/* Stock status tag */}
                  {isOutOfStock ? (
                    <span className="absolute top-2 left-2 bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                      HABIS
                    </span>
                  ) : isLowStock ? (
                    <span className="absolute top-2 left-2 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wide">
                      Menipis
                    </span>
                  ) : null}

                  {/* Visual Fallback Product Box */}
                  <div className="h-24 bg-slate-50 rounded mb-3 flex flex-col items-center justify-center text-center p-2 relative text-slate-400 group-hover:bg-indigo-50/25 transition-all border border-slate-100">
                    {product.category === 'Makanan' ? '🍜' : 
                     product.category === 'Minuman' ? '🥤' : 
                     product.category === 'Camilan' ? '🍩' : 
                     product.category === 'Sembako' ? '🌾' : '🧼'}
                    <span className="text-[10px] font-mono text-slate-400 font-bold mt-2 block tracking-wider uppercase">{product.category}</span>
                  </div>

                  {/* Pricing / Meta */}
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-800 text-xs md:text-sm line-clamp-2 leading-tight min-h-[32px]">
                      {product.name}
                    </h4>
                    
                    <div className="text-[10px] font-mono text-slate-400">
                      {product.barcode}
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {formatIDR(product.sellPrice)}
                        </span>
                        <span className="text-[8.5px] text-slate-400 font-semibold uppercase tracking-wide">
                          / {product.unitName || 'Pcs'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                        isOutOfStock 
                          ? 'bg-rose-50 text-rose-750 border border-rose-100' 
                          : isLowStock 
                            ? 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                            : 'bg-slate-50 text-slate-500 border border-slate-150'
                      }`}>
                        {product.stock} {product.unitName ? product.unitName.substr(0, 3).toUpperCase() : 'PCS'}
                      </span>
                    </div>

                    {/* Wholesale pricing indicators */}
                    {(product.wholesalePrice || product.wholesalePrice2) && (
                      <div className="pt-1 border-t border-slate-100 flex flex-col gap-0.5" id={`ws-cat-pills-${product.id}`}>
                        {product.wholesalePrice && product.wholesaleMinQty && (
                          <div className="flex items-center justify-between text-[8px] text-amber-750 font-bold bg-amber-50/50 py-0.2 px-1 rounded">
                            <span>Bulk &ge;{product.wholesaleMinQty}:</span>
                            <span>{formatIDR(product.wholesalePrice)}</span>
                          </div>
                        )}
                        {product.wholesalePrice2 && product.wholesaleMinQty2 && (
                          <div className="flex items-center justify-between text-[8px] text-rose-750 font-bold bg-rose-50/50 py-0.2 px-1 rounded">
                            <span>Dus &ge;{product.wholesaleMinQty2}:</span>
                            <span>{formatIDR(product.wholesalePrice2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: CURRENT BILL & CART BASKET (4 Cols) */}
      <div className="lg:col-span-4" id="cart-basket-column">
        <div className="bg-white rounded border border-slate-200 shadow-xs flex flex-col justify-between min-h-[580px] h-[calc(100vh-160px)] sticky top-6" id="cart-panel-card">
          
          {/* Basket Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between" id="cart-header">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Keranjang Belanja</h3>
            </div>
            {cart.length > 0 && (
              <button 
                onClick={() => setCart([])} 
                className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer uppercase tracking-wider"
                id="clear-cart-btn"
                title="Kosongkan"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Wholesale Customer Tier Selection Bar */}
          <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-col gap-1.5" id="customer-tier-subbar">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[9px] uppercase tracking-wider text-slate-500 block">Kategori Harga Grosir:</span>
              <span className="text-[10px] text-indigo-600 bg-indigo-100/60 font-bold px-1.5 py-0.2 rounded font-mono uppercase tracking-wide">
                TIER: {customerTier}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setCustomerTier('UMUM')}
                className={`py-1.5 px-1 rounded text-[10px] font-bold text-center cursor-pointer transition-all border uppercase tracking-wider ${
                  customerTier === 'UMUM'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                }`}
                title="Sistem Eceran biasa (Diskon grosir berlaku otomatis jika jumlah belanja memenuhi syarat)"
              >
                Eceran (Umum)
              </button>
              <button
                type="button"
                onClick={() => setCustomerTier('RESELLER')}
                className={`py-1.5 px-1 rounded text-[10px] font-bold text-center cursor-pointer transition-all border uppercase tracking-wider ${
                  customerTier === 'RESELLER'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                }`}
                title="Reseller / Toko Kecil (Langsung menikmati Harga Grosir L1 tanpa syarat minimal quantity)"
              >
                Reseller (L1)
              </button>
              <button
                type="button"
                onClick={() => setCustomerTier('AGEN')}
                className={`py-1.5 px-1 rounded text-[10px] font-bold text-center cursor-pointer transition-all border uppercase tracking-wider ${
                  customerTier === 'AGEN'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                }`}
                title="Agen / Distributor Dus (Langsung menikmati Harga Grosir L2 / Dus Termurah)"
              >
                Agen / Dus (L2)
              </button>
            </div>
          </div>

          {/* Cart Items Area */}
          <div className="flex-grow p-4 overflow-y-auto space-y-3" id="cart-items-scroll">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-slate-400" id="empty-cart-display">
                <ShoppingCart className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                <p className="text-sm font-semibold text-slate-500">Keranjang masih kosong</p>
                <p className="text-xs text-slate-400 mt-1 font-sans">Pilih produk di sebelah kiri atau scan barcode untuk menambahkan.</p>
              </div>
            ) : (
              cart.map((item) => {
                const appliedUnitPrice = getItemUnitPrice(item.product, item.quantity, customerTier);
                const itemTotal = appliedUnitPrice * item.quantity;
                const isWholesaleApplied = appliedUnitPrice < item.product.sellPrice;
                const appliedLabel = appliedUnitPrice === item.product.wholesalePrice2 
                  ? 'Grosir L2/Dus' 
                  : appliedUnitPrice === item.product.wholesalePrice 
                    ? 'Grosir L1' 
                    : null;

                return (
                  <div key={item.product.id} className="flex flex-col gap-1.5 border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0 font-sans" id={`cart-row-${item.product.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 max-w-[65%]">
                        <h5 className="font-semibold text-slate-800 text-xs line-clamp-1">{item.product.name}</h5>
                        <div className="text-[10px] text-slate-450 font-mono flex flex-wrap items-center gap-1">
                          {isWholesaleApplied ? (
                            <>
                              <span className="line-through text-slate-350">{formatIDR(item.product.sellPrice)}</span>
                              <span className="font-bold text-slate-900">{formatIDR(appliedUnitPrice)}</span>
                              {appliedLabel && (
                                <span className="text-[8px] bg-indigo-100/80 text-indigo-750 font-extrabold px-1 rounded uppercase tracking-wide">
                                  {appliedLabel}
                                </span>
                              )}
                            </>
                          ) : (
                            <span>{formatIDR(item.product.sellPrice)}</span>
                          )}
                          <span className="text-slate-300">&bull;</span>
                          <span className="font-bold text-indigo-600">Sisa {item.product.stock} {item.product.unitName || 'Pcs'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-200 rounded bg-slate-50 overflow-hidden">
                          <button 
                            onClick={() => decrementQuantity(item.product.id)}
                            className="p-1 px-2 text-slate-500 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                            id={`dec-qty-${item.product.id}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold font-mono text-slate-800">
                            {item.quantity}
                          </span>
                          <button 
                            onClick={() => incrementQuantity(item.product.id)}
                            className="p-1 px-2 text-slate-500 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                            id={`inc-qty-${item.product.id}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                          id={`remove-item-${item.product.id}`}
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick wholesale preset quantity shortcuts */}
                    <div className="flex flex-wrap items-center justify-between gap-1 mt-0.5 bg-slate-50 border border-slate-150 p-1 rounded">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block pl-1">Shortcut Qty Grosir:</span>
                      <div className="flex gap-1">
                        {item.product.wholesaleMinQty && item.quantity < item.product.wholesaleMinQty && (
                          <button
                            onClick={() => updateQuantity(item.product.id, item.product.wholesaleMinQty!)}
                            className="bg-amber-55 hover:bg-amber-100 text-amber-705 text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer"
                            title={`Atur kuantitas ke batas minimum Grosir Level 1 (${item.product.wholesaleMinQty} Pcs)`}
                          >
                            Set L1 ({item.product.wholesaleMinQty})
                          </button>
                        )}
                        {item.product.wholesaleMinQty2 && item.quantity < item.product.wholesaleMinQty2 && (
                          <button
                            onClick={() => updateQuantity(item.product.id, item.product.wholesaleMinQty2!)}
                            className="bg-rose-55 hover:bg-rose-100 text-rose-705 text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-200 cursor-pointer"
                            title={`Atur kuantitas ke batas minimum Grosir Level 2 / Dus (${item.product.wholesaleMinQty2} Pcs)`}
                          >
                            Set L2 ({item.product.wholesaleMinQty2})
                          </button>
                        )}
                        <span className="text-[9.5px] font-mono font-bold text-slate-600 pr-1 ml-2">
                          Total: {formatIDR(itemTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Checkout calculations and action drawer */}
          <div className="p-4 bg-slate-50 border-t border-slate-250 space-y-4 rounded-b" id="checkout-pricing-engine">
            
            {/* Real-time sum tags */}
            <div className="space-y-1.5 text-xs text-slate-600" id="pricing-review">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span>SUBTOTAL ({cart.reduce((sum, i) => sum + i.quantity, 0)} BARANG)</span>
                <span className="font-bold text-slate-800">{formatIDR(subtotal)}</span>
              </div>
              
              <div className="flex justify-between items-center text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-700 font-mono">
                  <input 
                    type="checkbox" 
                    checked={includeTax}
                    onChange={(e) => setIncludeTax(e.target.checked)}
                    className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>PPN 11%</span>
                </label>
                <span className="font-bold text-slate-800 font-mono">{formatIDR(tax)}</span>
              </div>

              {/* Discount inputs */}
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span>POTONGAN MANUAL (RP)</span>
                <div className="flex items-center gap-1" id="discount-interactive-pill">
                  <span className="text-[10px] text-slate-400 font-bold">RP</span>
                  <input 
                    type="number"
                    min="0"
                    step="500"
                    placeholder="0"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-18 bg-white border border-slate-250 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:border-indigo-600 font-bold font-mono"
                  />
                </div>
              </div>

              {/* Coupon code application block */}
              <div className="bg-white border border-slate-200 rounded p-2.5 space-y-2 mt-2" id="coupon-field-group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5 text-indigo-500" />
                    Kupon Promo / Diskon
                  </span>
                  {appliedCoupon && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded uppercase tracking-wide animate-pulse">
                      AKTIF
                    </span>
                  )}
                </div>

                <form onSubmit={handleApplyCoupon} className="flex gap-1.5" id="coupon-input-form">
                  <input 
                    type="text"
                    disabled={!!appliedCoupon}
                    placeholder={appliedCoupon ? `Kupon "${appliedCoupon.code}" Aktif` : "KODE KUPON (MISAL: HEMAT10)"}
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    className="flex-grow bg-slate-50/50 border border-slate-250 disabled:bg-slate-100 disabled:text-slate-450 rounded px-2.5 py-1 text-xs uppercase tracking-wide font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[10px] px-2.5 py-1 rounded transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Batal
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-1 rounded shadow-xs transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Pakai
                    </button>
                  )}
                </form>

                {couponError && (
                  <p className="text-[10px] text-rose-650 font-bold font-sans animate-fade-in" id="coupon-error-notice">⚠️ {couponError}</p>
                )}
                {couponSuccess && (
                  <p className="text-[10px] text-emerald-700 font-bold font-sans animate-fade-in" id="coupon-success-notice">✅ {couponSuccess}</p>
                )}
              </div>

              {/* Coupon Discount Row if applied */}
              {appliedCoupon && (
                <div className="flex justify-between items-center text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded border border-emerald-150 font-mono animate-fade-in mt-1.5">
                  <span className="flex items-center gap-1 font-bold">
                    <Percent className="w-3.5 h-3.5 text-emerald-500" />
                    KUPON: {appliedCoupon.code} ({appliedCoupon.type === 'PERCENTAGE' ? `${appliedCoupon.value}%` : 'FLAT'})
                  </span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>-{formatIDR(couponDiscount)}</span>
                    <button 
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-rose-500 hover:text-rose-800 font-extrabold cursor-pointer text-sm leading-none block px-1"
                      title="Lepas Kupon"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-dashed border-slate-250 my-2 pt-2 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-800 uppercase tracking-wide text-xs">Total Akhir</span>
                <span className="font-mono font-bold text-indigo-600 text-lg">{formatIDR(total)}</span>
              </div>
            </div>

            {/* If checkout drawer is open, show payment selections */}
            {isCheckoutOpen && cart.length > 0 && (
              <div className="bg-white border border-indigo-200 p-3 rounded space-y-3 shadow-xs animate-fade-in" id="checkout-drawer-panel">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide font-mono">Pilih Metode Pembayaran:</span>
                  <button onClick={() => setIsCheckoutOpen(false)} className="text-[10px] font-bold text-slate-450 hover:text-slate-655 cursor-pointer uppercase">Tutup</button>
                </div>

                <div className="grid grid-cols-4 gap-1.5" id="payment-methods-grid">
                  <button 
                    onClick={() => { setPaymentMethod('TUNAI'); applyPresetCash(0); }}
                    className={`p-2 rounded border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'TUNAI' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-850'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="text-[9px] uppercase tracking-wider font-bold">Tunai</span>
                  </button>
                  <button 
                    onClick={() => { setPaymentMethod('QRIS'); setAmountPaid(total.toString()); }}
                    className={`p-2 rounded border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'QRIS' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-850'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    <span className="text-[9px] uppercase tracking-wider font-bold">QRIS</span>
                  </button>
                  <button 
                    onClick={() => { setPaymentMethod('TRANSFER'); setAmountPaid(total.toString()); }}
                    className={`p-2 rounded border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'TRANSFER' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-850'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="text-[9px] uppercase tracking-wider font-bold">Bank</span>
                  </button>
                  <button 
                    onClick={() => { setPaymentMethod('DEBIT'); setAmountPaid(total.toString()); }}
                    className={`p-2 rounded border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'DEBIT' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-850'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-[9px] uppercase tracking-wider font-bold">Debit</span>
                  </button>
                </div>

                {/* Cash Payment specific calculator */}
                {paymentMethod === 'TUNAI' && (
                  <div className="space-y-2 animate-fade-in" id="cash-calculator-deck">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Jumlah Uang Diterima:</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">Rp</span>
                        <input 
                          type="number"
                          placeholder="0"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-bold font-mono border border-slate-250 rounded focus:bg-white focus:outline-none focus:border-indigo-600 bg-slate-50"
                        />
                      </div>
                    </div>

                    {/* Quick money buttons */}
                    <div className="grid grid-cols-3 gap-1" id="preset-money-buttons">
                      {[total, 10000, 20000, 50000, 100000].map((preset, idx) => {
                        // Avoid duplicates if total matches presets
                        if (idx > 0 && preset === total) return null;
                        
                        // Round up to nearest nice looking value if preset < total
                        if (preset === total) {
                          return (
                            <button 
                              key={idx}
                              type="button"
                              onClick={() => applyPresetCash(total)}
                              className="text-[10px] bg-slate-200 hover:bg-slate-350 text-slate-850 font-bold py-1 rounded cursor-pointer"
                            >
                              Uang Pas
                            </button>
                          );
                        }
                        
                        return (
                          <button 
                            key={idx}
                            type="button"
                            onClick={() => applyPresetCash(preset)}
                            className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 py-1 rounded cursor-pointer font-mono font-bold"
                          >
                            {formatIDR(preset)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Kembalian calculator result */}
                    <div className="flex items-center justify-between text-xs bg-slate-100 p-2 rounded border border-slate-110 font-mono" id="change-result">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Kembalian:</span>
                      <span className={`font-bold text-xs ${
                        (parseFloat(amountPaid) || 0) >= total 
                          ? 'text-indigo-600' 
                          : 'text-rose-600'
                      }`}>
                        {(parseFloat(amountPaid) || 0) >= total 
                          ? formatIDR(amountChange) 
                          : 'UANG KURANG'}
                      </span>
                    </div>
                  </div>
                )}

                {/* QRIS specific simulation card */}
                {paymentMethod === 'QRIS' && (
                  <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded space-y-1.5 animate-fade-in text-center shadow-xs" id="qris-simulator-dock">
                    <QrCode className="w-18 h-18 text-slate-800" />
                    <span className="text-[10px] font-bold text-indigo-700 uppercase font-mono tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">QRIS STANDARDIZED</span>
                    <span className="text-[9px] text-slate-400 font-mono">BILL: {formatIDR(total)}</span>
                  </div>
                )}

                {/* Transfer / Debit info */}
                {(paymentMethod === 'TRANSFER' || paymentMethod === 'DEBIT') && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center text-[10px] text-slate-500 leading-relaxed font-sans" id="bank-trans-deck">
                    Geser Kartu Debit / Transfer ke rekening pemilik merchant sejumlah <strong className="text-slate-800 font-mono text-[11px]">{formatIDR(total)}</strong> &bull; Validasi otomatis.
                  </div>
                )}

                {/* Notes/Instructions Field */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100" id="tx-notes-field">
                  <label className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                    Catatan khusus / Nama Pelanggan (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="Contoh: Meja 4, Atas nama Budi, GoFood, dll."
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-250 rounded focus:bg-white focus:outline-none focus:border-indigo-600 bg-slate-50"
                    id="input-transaction-notes"
                  />
                </div>
              </div>
            )}

            {/* Print and Cash out buttons */}
            <div className="flex gap-2" id="trigger-checkout">
              {!isCheckoutOpen ? (
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => setIsCheckoutOpen(true)}
                  className={`w-full py-2.5 rounded font-bold text-xs tracking-wider uppercase transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    cart.length === 0 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                  id="checkout-trigger-btn"
                >
                  <DollarSign className="w-4 h-4" />
                  Selesaikan Pembayaran
                </button>
              ) : (
                <div className="w-full flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCheckoutOpen(false)}
                    className="w-1/3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded font-bold text-xs tracking-wider uppercase cursor-pointer"
                    id="cancel-payment-btn"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={!isValidPayment}
                    onClick={processCheckout}
                    className={`w-2/3 py-2.5 rounded font-bold text-xs tracking-wider uppercase shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isValidPayment
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    id="confirm-checkout-btn"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Proses POS
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* RECEIPT SUCCESS FULL MODAL POPUP */}
      {showReceipt && lastCreatedTransaction && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 animate-fade-in" id="receipt-modal-backdrop">
          <div className="bg-white rounded p-6 shadow-2xl max-w-sm w-full space-y-4 text-center relative border border-slate-200" id="receipt-modal-card">
            
            <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 animate-scaleUp">
              <CheckCircle2 className="w-5 h-5" />
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-base uppercase tracking-wider">Transaksi Berhasil!</h4>
              <p className="text-xs text-slate-400 mt-1">Sediaan barang terupdate secara real-time pada stock ledger.</p>
            </div>

            {/* Simulated Printed Paper Receipt */}
            <div className="bg-slate-50 border border-slate-300 rounded p-4 text-left font-mono text-[11.5px] text-slate-800 space-y-3" id="printable-receipt-card">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                <h5 className="font-extrabold text-sm uppercase tracking-widest text-slate-900">&bull;&bull;&bull; KASIR POS PINTAR &bull;&bull;&bull;</h5>
                <p className="text-xs">JL. SEPBRIANSYAH RAYA NO. 45</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">NPWP: 45.123.456.7.890.000</p>
              </div>

              <div className="space-y-1 text-xs" id="receipt-header-data">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Invoice:</span>
                  <span className="font-bold text-slate-900">{lastCreatedTransaction.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal:</span>
                  <span>{new Date(lastCreatedTransaction.timestamp).toLocaleDateString('id-ID')} {new Date(lastCreatedTransaction.timestamp).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Petugas Kasir:</span>
                  <span className="font-semibold">{lastCreatedTransaction.cashierName}</span>
                </div>
                {lastCreatedTransaction.notes && (
                  <div className="flex flex-col border-t border-dashed border-slate-200 mt-1.5 pt-1 text-xs" id="receipt-printed-notes">
                    <span className="font-bold uppercase tracking-wider text-[9px] text-indigo-700">Pelanggan/Catatan:</span>
                    <span className="text-slate-705 italic font-medium break-words bg-slate-100 p-1 rounded mt-0.5">{lastCreatedTransaction.notes}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-slate-400 pt-2 space-y-2 text-xs" id="receipt-items-list">
                {lastCreatedTransaction.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-slate-100/50 pb-1.5">
                    <div className="max-w-[70%]">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {(() => {
                        const p = products.find(prod => prod.id === item.productId);
                        const unit = p?.unitName || 'Pcs';
                        const barcode = p?.barcode ? `[${p.barcode}] ` : '';
                        return (
                          <div className="text-slate-500 text-[10.5px] font-mono leading-tight">
                            {barcode}{item.quantity} {unit} x {formatIDR(item.sellPrice)}
                          </div>
                        );
                      })()}
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">{formatIDR(item.sellPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-400 pt-2 space-y-1.5 text-xs" id="receipt-math-breakdown">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pajak (PPN 11%):</span>
                  <span>{formatIDR(lastCreatedTransaction.tax)}</span>
                </div>
                {lastCreatedTransaction.couponCode && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Kupon ({lastCreatedTransaction.couponCode}):</span>
                    <span>Aktif</span>
                  </div>
                )}
                {lastCreatedTransaction.discount > 0 && (
                  <div className="flex justify-between text-rose-650 font-bold">
                    <span>Potongan / Diskon:</span>
                    <span>-{formatIDR(lastCreatedTransaction.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1.5 border-t border-dashed border-slate-300 mt-1 font-mono">
                  <span>TOTAL BILL:</span>
                  <span>{formatIDR(lastCreatedTransaction.total)}</span>
                </div>
                <div className="flex justify-between font-medium pt-1">
                  <span className="text-slate-500">Metode Bayar:</span>
                  <span className="uppercase font-bold text-indigo-705">{lastCreatedTransaction.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Jumlah Bayar:</span>
                  <span>{formatIDR(lastCreatedTransaction.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-indigo-900 border-t border-slate-150 pt-1 mt-1">
                  <span>Uang Kembali:</span>
                  <span className="text-sm font-extrabold">{formatIDR(lastCreatedTransaction.amountChange)}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-400 text-slate-550 text-[10px] space-y-1">
                <p className="font-semibold">&bull; Persediaan otomatis terinkrementasi &bull;</p>
                <p className="font-extrabold tracking-widest text-slate-900 text-xs mt-1">TERIMA KASIH SEBANYAKNYA</p>
                <p>Silakan Datang Kembali Belanja</p>
              </div>
            </div>

            {(() => {
              const lowStockItems = lastCreatedTransaction.items
                .map(item => {
                  const p = products.find(prod => prod.id === item.productId);
                  return p ? { name: p.name, stock: p.stock, threshold: p.minStockThreshold } : null;
                })
                .filter(p => p !== null && p.stock <= p.threshold) as Array<{ name: string; stock: number; threshold: number }>;

              if (lowStockItems.length === 0) return null;

              return (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-left space-y-1.5 text-xs text-amber-900 font-sans no-print" id="receipt-low-stock-warnings">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-[10px] text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Peringatan Sisa Stok Menipis!
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 text-[10px]">
                    {lowStockItems.map((item, idx) => (
                      <li key={idx} className="leading-tight">
                        <strong>{item.name}</strong> sisa <span className="font-bold text-rose-600">{item.stock} unit</span> (Min: {item.threshold})
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            <div className="flex gap-2 no-print" id="checkout-receipt-actions">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                id="print-receipt-btn"
                title="Cetak Nota Cetak Thermal Printer"
              >
                <Printer className="w-4 h-4" />
                Cetak Nota
              </button>
              <button
                type="button"
                onClick={() => setShowReceipt(false)}
                className="w-1/2 bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white font-bold py-2.5 rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
                id="close-receipt-modal"
              >
                Transaksi Baru
              </button>
            </div>

          </div>
        </div>
      )}

      {isCameraScannerOpen && (
        <BarcodeScanner
          onDetected={(code) => {
            // Find product matching this barcode and append it
            const matchedProduct = products.find(p => p.barcode === code);
            if (matchedProduct) {
              addToCart(matchedProduct);
            } else {
              showWarning(`Barcode "${code}" terdeteksi, namun produk belum terdaftar di Sediaan.`);
            }
          }}
          onClose={() => setIsCameraScannerOpen(false)}
          productsToScan={products}
          placeholderText="Arahkan barcode produk ke kamera. Tetap biarkan kamera terbuka untuk rapid scan."
          autoClose={false} // Allows rapid sequential scanning of multiple items!
        />
      )}

    </div>
  );
}
