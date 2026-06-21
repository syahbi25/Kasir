import { Product, Category } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Makanan', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'Utensils' },
  { id: '2', name: 'Minuman', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'CupSoda' },
  { id: '3', name: 'Camilan', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'Cookie' },
  { id: '4', name: 'Sembako', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: 'Package' },
  { id: '5', name: 'Kesehatan & Kebersihan', color: 'bg-pink-100 text-pink-800 border-pink-200', icon: 'Sparkles' }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Indomie Goreng Spesial 85g',
    barcode: '89686011116',
    category: 'Makanan',
    buyPrice: 2600,
    sellPrice: 3500,
    stock: 250, // Higher stock for wholesale demo
    minStockThreshold: 40,
    imageUrl: 'Indomie',
    unitName: 'Bungkus',
    wholesalePrice: 3100,
    wholesaleMinQty: 10,       // 10 Pcs gets discount
    wholesalePrice2: 2950,
    wholesaleMinQty2: 40       // 1 Dus (40 Pcs) gets even better price
  },
  {
    id: 'prod-2',
    name: 'Teh Botol Sosro Sosro Kotak 250ml',
    barcode: '89999010023',
    category: 'Minuman',
    buyPrice: 2200,
    sellPrice: 3500,
    stock: 120,
    minStockThreshold: 24,
    imageUrl: 'TehBotol',
    unitName: 'Kotak',
    wholesalePrice: 3150,
    wholesaleMinQty: 12,       // Half carton / bulk discount
    wholesalePrice2: 2900,
    wholesaleMinQty2: 24       // 1 Karton (24 Kotak)
  },
  {
    id: 'prod-3',
    name: 'Kopi Kenangan Mantan Bottle 220ml',
    barcode: '89912402120',
    category: 'Minuman',
    buyPrice: 7500,
    sellPrice: 9550,
    stock: 96,
    minStockThreshold: 12,
    imageUrl: 'Kopi',
    unitName: 'Botol',
    wholesalePrice: 8800,
    wholesaleMinQty: 12,       // 1 Lusin (12 Botol)
    wholesalePrice2: 8500,
    wholesaleMinQty2: 24       // 1 Karton
  },
  {
    id: 'prod-4',
    name: 'Oreo Double Stuf 135g',
    barcode: '89927419131',
    category: 'Camilan',
    buyPrice: 6800,
    sellPrice: 8500,
    stock: 80,
    minStockThreshold: 10,
    imageUrl: 'Oreo',
    unitName: 'Pcs',
    wholesalePrice: 7800,
    wholesaleMinQty: 10,
    wholesalePrice2: 7400,
    wholesaleMinQty2: 24
  },
  {
    id: 'prod-5',
    name: 'Susu Ultra Milk Full Cream 1L',
    barcode: '89910011012',
    category: 'Minuman',
    buyPrice: 15500,
    sellPrice: 18500,
    stock: 64,
    minStockThreshold: 12,
    imageUrl: 'Susu',
    unitName: 'Box',
    wholesalePrice: 17200,
    wholesaleMinQty: 6,        // 1/2 Dus gets wholesale
    wholesalePrice2: 16500,
    wholesaleMinQty2: 12       // 1 Dus (12 Box)
  },
  {
    id: 'prod-6',
    name: 'Beras Premium Rajalele 5kg',
    barcode: '89901357911',
    category: 'Sembako',
    buyPrice: 64000,
    sellPrice: 72000,
    stock: 35,
    minStockThreshold: 5,
    imageUrl: 'Beras',
    unitName: 'Karung',
    wholesalePrice: 69000,
    wholesaleMinQty: 5,        // Bulk reseller
    wholesalePrice2: 67200,
    wholesaleMinQty2: 10       // Agent / Agen
  },
  {
    id: 'prod-7',
    name: 'Minyak Goreng Sania 2L Pouch',
    barcode: '89970132214',
    category: 'Sembako',
    buyPrice: 28500,
    sellPrice: 34000,
    stock: 120,
    minStockThreshold: 12,
    imageUrl: 'Minyak',
    unitName: 'Pouch',
    wholesalePrice: 31500,
    wholesaleMinQty: 6,        // Half Carton (6 Pouch)
    wholesalePrice2: 30000,
    wholesaleMinQty2: 12       // 1 Karton (12 Pouch)
  },
  {
    id: 'prod-8',
    name: 'Pepsodent Pencegah Gigi Berlubang 190g',
    barcode: '89921473912',
    category: 'Kesehatan & Kebersihan',
    buyPrice: 11000,
    sellPrice: 14500,
    stock: 96,
    minStockThreshold: 12,
    imageUrl: 'Pastagigi',
    unitName: 'Tub',
    wholesalePrice: 13000,
    wholesaleMinQty: 12,       // 1 Lusin (12 unit)
    wholesalePrice2: 12400,
    wholesaleMinQty2: 24       // 2 Lusin
  },
  {
    id: 'prod-9',
    name: 'Lifebuoy Sabun Cair Total 10 Refill 400ml',
    barcode: '89921471120',
    category: 'Kesehatan & Kebersihan',
    buyPrice: 19500,
    sellPrice: 24500,
    stock: 48,
    minStockThreshold: 6,
    imageUrl: 'Sabuncair',
    unitName: 'Pouch',
    wholesalePrice: 22000,
    wholesaleMinQty: 6,
    wholesalePrice2: 21300,
    wholesaleMinQty2: 12
  },
  {
    id: 'prod-10',
    name: 'Chiki Balls Keju 55g',
    barcode: '89966141123',
    category: 'Camilan',
    buyPrice: 4800,
    sellPrice: 6000,
    stock: 160,
    minStockThreshold: 20,
    imageUrl: 'Snack',
    unitName: 'Pcs',
    wholesalePrice: 5300,
    wholesaleMinQty: 20,       // 1 Pack (20 pcs)
    wholesalePrice2: 4950,
    wholesaleMinQty2: 40       // 1 Dus (40 pcs)
  }
];

export const INITIAL_TRANSACTIONS = [
  {
    id: 'trx-1',
    invoiceNumber: 'INV/20260620/0001',
    items: [
      { productId: 'prod-1', name: 'Indomie Goreng Spesial 85g', quantity: 5, sellPrice: 3500, buyPrice: 2600 },
      { productId: 'prod-3', name: 'Kopi Kenangan Mantan Bottle 220ml', quantity: 2, sellPrice: 9500, buyPrice: 7500 }
    ],
    subtotal: 36500,
    tax: 3650, // 10% tax example or similar or empty
    discount: 0,
    total: 40150,
    paymentMethod: 'TUNAI',
    amountPaid: 50000,
    amountChange: 9850,
    timestamp: '2026-06-20T10:15:30Z',
    cashierName: 'sepbriansyah@gmail.com'
  },
  {
    id: 'trx-2',
    invoiceNumber: 'INV/20260620/0002',
    items: [
      { productId: 'prod-6', name: 'Beras Premium Rajalele 5kg', quantity: 1, sellPrice: 72000, buyPrice: 64000 },
      { productId: 'prod-7', name: 'Minyak Goreng Sania 2L Pouch', quantity: 2, sellPrice: 34000, buyPrice: 28500 }
    ],
    subtotal: 140000,
    tax: 14000,
    discount: 5000,
    total: 149000,
    paymentMethod: 'QRIS',
    amountPaid: 149000,
    amountChange: 0,
    timestamp: '2026-06-20T14:30:12Z',
    cashierName: 'sepbriansyah@gmail.com'
  }
];
