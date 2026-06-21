export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  sellPrice: number;
  buyPrice: number;
  initialCost?: number; // Cost of Goods Sold unit cost price
  stock: number;
  minStockThreshold: number;
  imageUrl?: string;
  // Satuan & Multi-tier Harga Grosiran (Wholesale parameters)
  unitName?: string;         // e.g. "Pcs", "Pack", "Renceng", "Dus"
  wholesalePrice?: number;   // Harga grosir tier 1
  wholesaleMinQty?: number;  // Minimal qty tier 1
  wholesalePrice2?: number;  // Harga grosir tier 2 (Super Bulk)
  wholesaleMinQty2?: number; // Minimal qty tier 2
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  sellPrice: number;
  buyPrice: number;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'TUNAI' | 'QRIS' | 'TRANSFER' | 'DEBIT';
  amountPaid: number;
  amountChange: number;
  timestamp: string;
  cashierName: string;
  notes?: string;
  couponCode?: string;
}

export interface SalesSummary {
  totalRevenue: number;
  totalProfit: number;
  totalTransactions: number;
  lowStockItemsCount: number;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FLAT';
  value: number;
  minPurchase: number;
  isActive: boolean;
  usageCount: number;
}

