import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  X, 
  Check, 
  TrendingUp, 
  Coins, 
  ShieldAlert, 
  CornerDownRight,
  Filter,
  Camera
} from 'lucide-react';
import { Product, Category } from '../types';
import { BarcodeScanner } from './BarcodeScanner';

interface InventoryProps {
  products: Product[];
  categories: Category[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAddStock: (productId: string, quantity: number) => void;
  onDeductStock: (productId: string, quantity: number) => void;
}

export default function Inventory({
  products,
  categories,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddStock,
  onDeductStock
}: InventoryProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [onlyCritical, setOnlyCritical] = useState(false);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBuyPrice, setFormBuyPrice] = useState<number>(0);
  const [formInitialCost, setFormInitialCost] = useState<number>(0);
  const [formSellPrice, setFormSellPrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formThreshold, setFormThreshold] = useState<number>(5);
  const [formUnitName, setFormUnitName] = useState('Pcs');
  const [formWholesalePrice, setFormWholesalePrice] = useState<string>('');
  const [formWholesaleMinQty, setFormWholesaleMinQty] = useState<string>('');
  const [formWholesalePrice2, setFormWholesalePrice2] = useState<string>('');
  const [formWholesaleMinQty2, setFormWholesaleMinQty2] = useState<string>('');

  // Direct adjustments state
  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null);
  const [stockAddAmount, setStockAddAmount] = useState<number>(10);

  // Error validations
  const [formError, setFormError] = useState<string | null>(null);

  // Barcode scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Filter computation
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.barcode.includes(searchTerm);
      const matchCategory = categoryFilter === 'Semua' || p.category === categoryFilter;
      const isCritical = p.stock <= p.minStockThreshold;
      const matchCritical = !onlyCritical || isCritical;
      
      return matchSearch && matchCategory && matchCritical;
    });
  }, [products, searchTerm, categoryFilter, onlyCritical]);

  // Open Add Form
  const openAddForm = () => {
    setEditingProduct(null);
    setFormName('');
    setFormBarcode(Math.floor(8990000000000 + Math.random() * 999999999).toString()); // auto barcode mockup
    setFormCategory(categories[0]?.name || 'Makanan');
    setFormBuyPrice(0);
    setFormInitialCost(0);
    setFormSellPrice(0);
    setFormStock(10);
    setFormThreshold(5);
    setFormUnitName('Pcs');
    setFormWholesalePrice('');
    setFormWholesaleMinQty('');
    setFormWholesalePrice2('');
    setFormWholesaleMinQty2('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Edit Form
  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormBarcode(product.barcode);
    setFormCategory(product.category);
    setFormBuyPrice(product.buyPrice);
    setFormInitialCost(product.initialCost !== undefined ? product.initialCost : product.buyPrice);
    setFormSellPrice(product.sellPrice);
    setFormStock(product.stock);
    setFormThreshold(product.minStockThreshold);
    setFormUnitName(product.unitName || 'Pcs');
    setFormWholesalePrice(product.wholesalePrice !== undefined ? product.wholesalePrice.toString() : '');
    setFormWholesaleMinQty(product.wholesaleMinQty !== undefined ? product.wholesaleMinQty.toString() : '');
    setFormWholesalePrice2(product.wholesalePrice2 !== undefined ? product.wholesalePrice2.toString() : '');
    setFormWholesaleMinQty2(product.wholesaleMinQty2 !== undefined ? product.wholesaleMinQty2.toString() : '');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Generate predictive SKU based on Category and Name
  const handleGenerateSKU = () => {
    if (!formName.trim()) {
      setFormError('Berikan Nama Produk terlebih dahulu sebelum membuat SKU.');
      return;
    }
    const cat = formCategory || 'Mkn';
    const catPrefix = cat.substring(0, 3).toUpperCase().padEnd(3, 'X');
    
    // Extract initials of product name
    const words = formName.trim().replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase().split(/\s+/).filter(Boolean);
    let nameInitials = 'PRD';
    if (words.length > 0) {
      nameInitials = words.slice(0, 3).map(w => w[0]).join('');
      if (nameInitials.length < 2 && words[0].length >= 3) {
        nameInitials = words[0].substring(0, 3);
      }
    }
    
    const baseCode = `${catPrefix}-${nameInitials}`.toUpperCase();
    
    // Find unique suffix
    let suffix = 101;
    let proposedBarcode = `${baseCode}-${suffix}`;
    while (products.some(p => p.barcode === proposedBarcode && p.id !== (editingProduct?.id || ''))) {
      suffix += 1;
      proposedBarcode = `${baseCode}-${suffix}`;
    }
    
    setFormBarcode(proposedBarcode);
    setFormError(null);
  };

  // Handle Save
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBarcode.trim()) {
      setFormError('Nama produk dan barcode wajib diisi.');
      return;
    }

    if (formSellPrice < formBuyPrice) {
      setFormError('Harga Jual tidak boleh lebih murah daripada Harga Beli (Rugi).');
      return;
    }

    const wholesaleVal1 = formWholesalePrice ? parseInt(formWholesalePrice) : undefined;
    const minQtyVal1 = formWholesaleMinQty ? parseInt(formWholesaleMinQty) : undefined;
    const wholesaleVal2 = formWholesalePrice2 ? parseInt(formWholesalePrice2) : undefined;
    const minQtyVal2 = formWholesaleMinQty2 ? parseInt(formWholesaleMinQty2) : undefined;

    if (wholesaleVal1 && wholesaleVal1 < formBuyPrice) {
      setFormError('Harga Grosir Level 1 tidak boleh lebih murah daripada Harga Beli.');
      return;
    }
    if (wholesaleVal2 && wholesaleVal2 < formBuyPrice) {
      setFormError('Harga Grosir Level 2 tidak boleh lebih murah daripada Harga Beli.');
      return;
    }

    if (editingProduct) {
      // Edit
      const updated: Product = {
        ...editingProduct,
        name: formName,
        barcode: formBarcode,
        category: formCategory,
        buyPrice: formBuyPrice,
        initialCost: formInitialCost,
        sellPrice: formSellPrice,
        stock: formStock,
        minStockThreshold: formThreshold,
        unitName: formUnitName || 'Pcs',
        wholesalePrice: wholesaleVal1,
        wholesaleMinQty: minQtyVal1,
        wholesalePrice2: wholesaleVal2,
        wholesaleMinQty2: minQtyVal2
      };
      onUpdateProduct(updated);
    } else {
      // New Product with validation
      if (products.some(p => p.barcode === formBarcode)) {
        setFormError('Barcode produk sudah digunakan oleh produk lain.');
        return;
      }

      const newProd: Product = {
        id: `prod-${Date.now()}`,
        name: formName,
        barcode: formBarcode,
        category: formCategory,
        buyPrice: formBuyPrice,
        initialCost: formInitialCost || formBuyPrice,
        sellPrice: formSellPrice,
        stock: formStock,
        minStockThreshold: formThreshold,
        unitName: formUnitName || 'Pcs',
        wholesalePrice: wholesaleVal1,
        wholesaleMinQty: minQtyVal1,
        wholesalePrice2: wholesaleVal2,
        wholesaleMinQty2: minQtyVal2
      };
      onAddProduct(newProd);
    }

    setIsFormOpen(false);
    setEditingProduct(null);
  };

  const handleQuickAddStock = (productId: string) => {
    if (stockAddAmount > 0) {
      onAddStock(productId, stockAddAmount);
      setAdjustingStockId(null);
      setStockAddAmount(10);
    }
  };

  // Format helper
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6" id="inventory-view-deck">
      
      {/* Top action header card */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-xs" id="inventory-header-action-panel">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              Sediaan Barang & Manajemen Stok
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Tambah produk baru, sunting harga modal sediaan, dan pantau level ambang batas pengingat kritis.</p>
          </div>
          <button
            onClick={openAddForm}
            className="self-start md:self-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
            id="btn-add-product-modal"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk Baru
          </button>
        </div>

        {/* Filters control deck */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-5 pt-5 border-t border-slate-100 text-xs" id="inventory-filters-deck">
          
          {/* Search box */}
          <div className="relative md:col-span-4" id="inv-search-field">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:border-indigo-600 focus:outline-none transition-all font-sans"
            />
          </div>

          {/* Category Dropdown picker */}
          <div className="relative md:col-span-3 flex items-center gap-2" id="inv-cat-dropdown">
            <span className="text-slate-400 font-bold whitespace-nowrap uppercase tracking-wider text-[10px]">Kategori:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:border-indigo-600 cursor-pointer font-sans"
            >
              <option value="Semua">Semua Kategori</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Only Critical Toggle */}
          <div className="md:col-span-5 flex items-center justify-end" id="inv-critical-toggle-deck">
            <label className="inline-flex items-center gap-2 cursor-pointer bg-amber-50 text-amber-900 border border-amber-200 p-1.5 rounded font-mono text-[10px]">
              <input
                type="checkbox"
                checked={onlyCritical}
                onChange={(e) => setOnlyCritical(e.target.checked)}
                className="rounded border-amber-300 text-amber-650 focus:ring-amber-500 cursor-pointer w-3.5 h-3.5"
              />
              <span className="font-bold flex items-center gap-1 uppercase tracking-wide">
                <AlertTriangle className="w-3.5 h-3.5" />
                Stok Kritis / Habis ({products.filter(p => p.stock <= p.minStockThreshold).length})
              </span>
            </label>
          </div>

        </div>
      </div>

      {/* Main Inventory Listings Table */}
      <div className="bg-white rounded border border-slate-200 shadow-xs overflow-hidden" id="inventory-logs-table-card">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400" id="empty-inventory-result">
            <Package className="w-16 h-16 text-slate-200 mx-auto mb-3" />
            <p className="font-bold text-slate-500">Tidak ada produk sediaan cocok</p>
            <p className="text-xs text-slate-400 mt-1 font-sans">Sesuaikan filter pencarian atau matikan saringan kritis.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" id="inventory-scroller-sheet">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-450 font-bold uppercase tracking-wider font-mono">
                  <th className="py-3 px-4 font-bold">Produk</th>
                  <th className="py-3 px-3 font-bold">Kategori</th>
                  <th className="py-3 px-3 font-bold text-right">Harga Beli</th>
                  <th className="py-3 px-3 font-bold text-right">Harga Jual (Margin)</th>
                  <th className="py-3 px-4 font-bold text-center">Stok Sisa</th>
                  <th className="py-3 px-4 font-bold text-center">Threshold</th>
                  <th className="py-3 px-4 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock === 0;
                  const isLowStock = p.stock > 0 && p.stock <= p.minStockThreshold;
                  const profitRatio = p.sellPrice - p.buyPrice;
                  const profitPercent = p.buyPrice > 0 ? Math.round((profitRatio / p.buyPrice) * 100) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors font-sans" id={`inv-row-${p.id}`}>
                      {/* Name and barcode info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 text-xs md:text-sm">{p.name}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-450 font-mono">{p.barcode}</span>
                          <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-bold uppercase tracking-wide">
                            Satuan: {p.unitName || 'Pcs'}
                          </span>
                        </div>
                      </td>

                      {/* Category tag */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded uppercase font-mono">
                          {p.category}
                        </span>
                      </td>

                      {/* Prices: buy */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-500">
                        {formatIDR(p.buyPrice)}
                      </td>

                      {/* Prices: sell */}
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="font-bold text-slate-900 block text-xs md:text-sm">{formatIDR(p.sellPrice)}</span>
                        <div className="space-y-1 mt-1 text-right flex flex-col items-end">
                          <span className="text-[9px] text-indigo-600 font-bold block">
                            Margin Retail: +{formatIDR(profitRatio)} ({profitPercent}%)
                          </span>
                          {p.wholesalePrice && p.wholesaleMinQty && (
                            <span className="text-[8px] md:text-[8.5px] text-amber-700 font-extrabold block bg-amber-50/50 border border-amber-200/50 rounded px-1.5 py-0.2 whitespace-nowrap">
                              Grosir L1 (≥{p.wholesaleMinQty}): {formatIDR(p.wholesalePrice)}
                            </span>
                          )}
                          {p.wholesalePrice2 && p.wholesaleMinQty2 && (
                            <span className="text-[8px] md:text-[8.5px] text-rose-700 font-extrabold block bg-rose-50/50 border border-rose-200/50 rounded px-1.5 py-0.2 whitespace-nowrap">
                              Grosir L2 (≥{p.wholesaleMinQty2}): {formatIDR(p.wholesalePrice2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock with inline quick action buttons */}
                      <td className="py-3 px-4 text-center">
                        {adjustingStockId === p.id ? (
                          <div className="inline-flex items-center gap-1 bg-white p-1 rounded border border-slate-350 shadow-xs" id={`adjust-panel-${p.id}`}>
                            <input
                              type="number"
                              min="1"
                              className="w-12 px-1 py-0.5 border border-slate-200 bg-slate-50 rounded text-xs text-center focus:outline-none font-bold font-mono text-slate-900"
                              value={stockAddAmount}
                              onChange={(e) => setStockAddAmount(Math.max(1, parseInt(e.target.value) || 0))}
                            />
                            <button
                              onClick={() => handleQuickAddStock(p.id)}
                              className="bg-indigo-600 text-white px-2 py-0.5 rounded hover:bg-indigo-700 text-[10px] font-bold cursor-pointer font-mono"
                              id={`save-add-stock-${p.id}`}
                              title="Tambah"
                            >
                              +
                            </button>
                            <button
                              onClick={() => {
                                if (p.stock >= stockAddAmount) {
                                  onDeductStock(p.id, stockAddAmount);
                                  setAdjustingStockId(null);
                                  setStockAddAmount(10);
                                }
                              }}
                              disabled={p.stock < stockAddAmount}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer font-mono ${
                                p.stock >= stockAddAmount
                                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                              id={`save-deduct-stock-${p.id}`}
                              title="Kurangi"
                            >
                              -
                            </button>
                            <button
                              onClick={() => setAdjustingStockId(null)}
                              className="text-slate-400 hover:text-slate-650 font-bold px-1.5 text-xs cursor-pointer"
                              id={`close-adjust-${p.id}`}
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded border ${
                              isOutOfStock 
                                ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold' 
                                : isLowStock
                                  ? 'bg-amber-50 border-amber-200 text-amber-700 font-extrabold'
                                  : 'bg-indigo-50 border-indigo-100 text-indigo-800'
                            }`}>
                              {p.stock}
                            </span>
                            <button
                              onClick={() => {
                                setAdjustingStockId(p.id);
                                setStockAddAmount(10);
                              }}
                              className="text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 p-1 rounded cursor-pointer transition-all font-mono font-bold"
                              id={`inline-adjust-btn-${p.id}`}
                              title="Quick Restock"
                            >
                              SET
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Minimum safety indicator threshold */}
                      <td className="py-3 px-4 text-center text-slate-500 font-bold font-mono">
                        {p.minStockThreshold}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" id={`actions-${p.id}`}>
                          <button
                            onClick={() => openEditForm(p)}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-705 p-1.5 rounded transition-colors cursor-pointer"
                            id={`edit-item-${p.id}`}
                            title="Sunting"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Apakah Anda yakin ingin menghapus produk "${p.name}"?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 p-1.5 rounded transition-colors cursor-pointer"
                            id={`delete-item-${p.id}`}
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILED FORM DIALOG MODAL LAYOUT */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 animate-fade-in" id="product-form-backdrop">
          <div className="bg-white rounded p-6 shadow-2xl max-w-lg w-full space-y-4 text-left border border-slate-300" id="product-form-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 text-xs md:text-sm uppercase tracking-wider">
                {editingProduct ? `Sunting: ${editingProduct.name}` : 'Tambah Produk Baru'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded font-bold border border-rose-200 uppercase tracking-wide" id="modal-validation-error">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs" id="product-actual-htmlform">
              {/* Product Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block">Nama Produk:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Susu Indomilk Chocolate 250ml"
                  className="w-full p-2 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 text-xs font-semibold"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {/* Barcode, Category & Satuan Grid */}
              <div className="grid grid-cols-3 gap-3 animate-fade-in">
                <div className="space-y-1 col-span-1">
                  <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block flex items-center justify-between">
                    <span>Barcode / SKU:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateSKU}
                        className="text-amber-700 hover:text-amber-900 border border-amber-200/50 bg-amber-50/50 px-1 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                        title="Buat SKU secara otomatis berdasarkan Kategori & Nama"
                      >
                        ⚡ Gen SKU
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="text-indigo-600 hover:text-indigo-800 text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                        title="Scan Barcode via Kamera HP/Laptop"
                      >
                        <Camera className="w-2.5 h-2.5" /> Scan
                      </button>
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="899324567..."
                      className="w-full p-2 pr-7 border border-slate-250 bg-slate-50 rounded focus:outline-none focus:border-indigo-650 font-mono text-xs"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer animate-pulse"
                      title="Pindai Kamera"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-505" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block">Kategori:</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-2 border border-slate-250 bg-white rounded focus:outline-none focus:border-indigo-650 text-xs cursor-pointer"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block">Satuan (Unit Name):</label>
                  <input
                    type="text"
                    required
                    placeholder="Pcs, Dus, Pak, dll."
                    className="w-full p-2 border border-slate-250 bg-white rounded focus:outline-none focus:border-indigo-650 text-xs font-semibold"
                    value={formUnitName}
                    onChange={(e) => setFormUnitName(e.target.value)}
                  />
                </div>
              </div>

              {/* Aturan Harga, Grosir & Tiering */}
              <div className="bg-slate-50 p-4 rounded border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="font-bold text-[10px] text-indigo-650 uppercase tracking-wider block">Aturan Harga & Grosir Bertingkat</span>
                  <span className="text-[9px] text-slate-400">Tentukan diskon grosiran otomatis</span>
                </div>
                         <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block" title="Harga beli riil saat ini dari pemasok">Harga Beli Supplier:</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rp</span>
                      <input
                        type="number"
                        required
                        min="0"
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 bg-white text-xs font-mono font-bold"
                        value={formBuyPrice || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setFormBuyPrice(val);
                          // Auto set initialCost if it was same or zero to facilitate user flow
                          if (formInitialCost === 0 || formInitialCost === formBuyPrice) {
                            setFormInitialCost(val);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-indigo-655 text-[10px] block" title="Estimasi biaya perolehan awal untuk menghitung HPP (Cost of Goods Sold)">Initial Cost (HPP):</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rp</span>
                      <input
                        type="number"
                        required
                        min="0"
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 bg-white text-xs font-mono font-bold text-amber-700"
                        value={formInitialCost || ''}
                        onChange={(e) => setFormInitialCost(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block" title="Harga jual retail dasar di kasir POS">Harga Jual Retail:</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rp</span>
                      <input
                        type="number"
                        required
                        min="0"
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 bg-white text-xs font-mono font-bold text-indigo-655"
                        value={formSellPrice || ''}
                        onChange={(e) => setFormSellPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60">
                  <div className="space-y-1.5 bg-white p-2.5 rounded border border-slate-150 shadow-sm">
                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-500 block">Grosir Lvl 1 (Grosir Kecil)</span>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        min="2"
                        placeholder="Min Qty"
                        className="w-14 p-1 px-1.5 border border-slate-200 rounded font-mono text-center text-xs"
                        value={formWholesaleMinQty}
                        onChange={(e) => setFormWholesaleMinQty(e.target.value)}
                        title="Batas Minimal Kuantitas Level 1"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">Unit</span>
                      <div className="relative flex-grow">
                        <span className="absolute left-1.5 top-1.5 text-[10px] text-slate-400">Rp</span>
                        <input
                          type="number"
                          placeholder="Harga Satuan"
                          className="w-full pl-6 pr-1.5 py-1 border border-slate-250 rounded font-mono text-xs font-bold text-amber-700"
                          value={formWholesalePrice}
                          onChange={(e) => setFormWholesalePrice(e.target.value)}
                          title="Harga per Unit Level 1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-white p-2.5 rounded border border-slate-150 shadow-sm">
                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-500 block">Grosir Lvl 2 (Reseller/Dus)</span>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        min="2"
                        placeholder="Min Qty"
                        className="w-14 p-1 px-1.5 border border-slate-200 rounded font-mono text-center text-xs"
                        value={formWholesaleMinQty2}
                        onChange={(e) => setFormWholesaleMinQty2(e.target.value)}
                        title="Batas Minimal Kuantitas Level 2"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">Unit</span>
                      <div className="relative flex-grow">
                        <span className="absolute left-1.5 top-1.5 text-[10px] text-slate-400">Rp</span>
                        <input
                          type="number"
                          placeholder="Harga Satuan"
                          className="w-full pl-6 pr-1.5 py-1 border border-slate-250 rounded font-mono text-xs font-bold text-rose-700"
                          value={formWholesalePrice2}
                          onChange={(e) => setFormWholesalePrice2(e.target.value)}
                          title="Harga per Unit Level 2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sediaan Stock & Minimum Safety Threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block">Stok Sediaan Awal:</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full p-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 text-center font-bold text-xs"
                    value={formStock}
                    disabled={!!editingProduct} // In editing mode, encourage direct list increment instead of editing base stock for safety
                    onChange={(e) => setFormStock(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  {editingProduct && <p className="text-[9px] text-slate-400 text-center uppercase tracking-wide">Gunakan tombol restock di daftar utama</p>}
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block">Batas Minimum Kritis:</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full p-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 text-center font-bold text-xs text-amber-700"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(Math.max(1, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* Submit panel */}
              <div className="pt-4 border-t border-slate-200 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-250 px-4 py-2 rounded text-slate-650 font-bold text-xs uppercase tracking-wider cursor-pointer"
                  id="cancel-modal"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded shadow-xs cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                  id="submit-modal"
                >
                  <Check className="w-3.5 h-3.5" />
                  Simpan Sediaan
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <BarcodeScanner
          onDetected={(code) => {
            setFormBarcode(code);
            setIsScannerOpen(false);
          }}
          onClose={() => setIsScannerOpen(false)}
          productsToScan={products}
          placeholderText="Kamera aktif. Pindai barcode untuk otomatis mengisi formulir sediaan."
          autoClose={true}
        />
      )}

    </div>
  );
}
