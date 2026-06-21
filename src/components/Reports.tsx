import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { 
  FileText, 
  Trash2, 
  TrendingUp, 
  Coins, 
  Clock, 
  QrCode, 
  DollarSign, 
  Wallet, 
  CreditCard, 
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Percent,
  CheckCircle2,
  Calendar,
  Printer,
  ClipboardList,
  UserCheck
} from 'lucide-react';
import { Product, Transaction, TransactionItem } from '../types';

interface ReportsProps {
  transactions: Transaction[];
  onCancelTransaction: (transactionId: string) => void;
  products: Product[];
}

export default function Reports({ 
  transactions, 
  onCancelTransaction,
  products
}: ReportsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('Semua');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Daily Summary (Handover) States
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [handoverDate, setHandoverDate] = useState(() => {
    return new Date().toISOString().slice(0, 10); // Standard today YYYY-MM-DD local
  });
  const [handoverCashier, setHandoverCashier] = useState('Kasir Utama');
  const [nextShiftCashier, setNextShiftCashier] = useState('Kasir Bersambung');
  const [handoverNotes, setHandoverNotes] = useState('Seluruh transaksi & kas laci telah dicocokkan dengan laporan sistem.');
  const [physicalCashInput, setPhysicalCashInput] = useState('');

  // Helper formatting currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Filter transactions (cashier can search via invoice ID, product name, cashier name, and transaction notes/custom customer names)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const keyword = searchTerm.trim().toLowerCase();
      const matchSearch = !keyword ||
                          tx.invoiceNumber.toLowerCase().includes(keyword) ||
                          tx.items.some(i => i.name.toLowerCase().includes(keyword)) ||
                          tx.cashierName.toLowerCase().includes(keyword) ||
                          (tx.notes ? tx.notes.toLowerCase().includes(keyword) : false);

      const matchPayment = paymentFilter === 'Semua' || tx.paymentMethod === paymentFilter;

      let matchDate = true;
      if (startDate || endDate) {
        const txDate = new Date(tx.timestamp);
        const txTime = txDate.getTime();

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (txTime < start.getTime()) {
            matchDate = false;
          }
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (txTime > end.getTime()) {
            matchDate = false;
          }
        }
      }

      return matchSearch && matchPayment && matchDate;
    });
  }, [transactions, searchTerm, paymentFilter, startDate, endDate]);

  // Finance calculators based on currently filtered subset list
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCoGS = 0; // HPP (Harga Pokok Penjualan)
    
    filteredTransactions.forEach(tx => {
      totalRevenue += tx.total;
      
      // original ratio after discount/tax applied to overall transaction
      const ratio = tx.subtotal > 0 ? tx.total / tx.subtotal : 1;
      
      tx.items.forEach(item => {
        // CoGS calculation based on buyPrice
        totalCoGS += (item.buyPrice * item.quantity) * ratio;
      });
    });

    const netProfit = Math.max(0, totalRevenue - totalCoGS);
    const averageOrder = filteredTransactions.length > 0 ? totalRevenue / filteredTransactions.length : 0;

    return {
      totalRevenue,
      totalCoGS,
      netProfit,
      averageOrder
    };
  }, [filteredTransactions]);

  // Payment Breakdown based on currently filtered subset list
  const paymentMetrics = useMemo(() => {
    const counts = { TUNAI: 0, QRIS: 0, TRANSFER: 0, DEBIT: 0 };
    const sums = { TUNAI: 0, QRIS: 0, TRANSFER: 0, DEBIT: 0 };

    filteredTransactions.forEach(tx => {
      if (tx.paymentMethod in counts) {
        counts[tx.paymentMethod as keyof typeof counts] += 1;
        sums[tx.paymentMethod as keyof typeof sums] += tx.total;
      }
    });

    const totalSum = filteredTransactions.reduce((s, t) => s + t.total, 0) || 1;

    return {
      counts,
      sums,
      percents: {
        TUNAI: Math.round((sums.TUNAI / totalSum) * 100),
        QRIS: Math.round((sums.QRIS / totalSum) * 100),
        TRANSFER: Math.round((sums.TRANSFER / totalSum) * 100),
        DEBIT: Math.round((sums.DEBIT / totalSum) * 100),
      }
    };
  }, [filteredTransactions]);

  // Compute Daily Summary (Handover) statistics based on selected handoverDate
  const dailySummaryData = useMemo(() => {
    const dayTx = transactions.filter(tx => {
      if (!tx.timestamp) return false;
      return tx.timestamp.slice(0, 10) === handoverDate;
    });

    let revenue = 0;
    let itemsCount = 0;
    const paymentSums = { TUNAI: 0, QRIS: 0, TRANSFER: 0, DEBIT: 0 };
    const paymentCounts = { TUNAI: 0, QRIS: 0, TRANSFER: 0, DEBIT: 0 };
    const productSoldQty: { [name: string]: { qty: number, subtotal: number, productId?: string } } = {};

    dayTx.forEach(tx => {
      revenue += tx.total;
      
      if (tx.paymentMethod in paymentSums) {
        paymentSums[tx.paymentMethod as keyof typeof paymentSums] += tx.total;
        paymentCounts[tx.paymentMethod as keyof typeof paymentCounts] += 1;
      }

      tx.items.forEach(item => {
        itemsCount += item.quantity;
        if (!productSoldQty[item.name]) {
          productSoldQty[item.name] = { qty: 0, subtotal: 0, productId: item.productId };
        }
        productSoldQty[item.name].qty += item.quantity;
        productSoldQty[item.name].subtotal += item.sellPrice * item.quantity;
      });
    });

    // sort products to get top-selling
    const topProducts = Object.entries(productSoldQty)
      .map(([name, data]) => ({ name, qty: data.qty, subtotal: data.subtotal, productId: data.productId }))
      .sort((a, b) => b.qty - a.qty);

    return {
      transactions: dayTx,
      totalRevenue: revenue,
      itemVolume: itemsCount,
      payments: paymentSums,
      paymentCounts,
      topProducts,
      orderCount: dayTx.length
    };
  }, [transactions, handoverDate]);

  const handleExportPDF = () => {
    // Menyiapkan dokumen PDF orientasi potret dengan ukuran A4
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - (2 * margin); // 180mm

    let y = 15;

    // Helper untuk menggambar garis horizontal dekoratif
    const drawLine = (yPos: number, color = [226, 232, 240], thickness = 0.5) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(thickness);
      doc.line(margin, yPos, margin + contentWidth, yPos);
    };

    // Helper untuk menangani perpindahan halaman otomatis
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin - 5) {
        doc.addPage();
        y = margin;
      }
    };

    // --- BAGIAN HEADER INSTANSI / MERCHANT ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('LAPORAN FINANCIAL & HISTORI TRANSAKSI', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600
    const printDate = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    doc.text(`Dicetak pada: ${printDate} WIB`, margin, y);
    y += 5;

    // Filter Saringan
    let filterLabel = 'Kriteria Filter: ';
    if (searchTerm || paymentFilter !== 'Semua') {
      const filters = [];
      if (searchTerm) filters.push(`Pencarian "${searchTerm}"`);
      if (paymentFilter !== 'Semua') filters.push(`Metode Pembayaran "${paymentFilter}"`);
      filterLabel += filters.join(' & ');
    } else {
      filterLabel += 'Semua Rekaman Transaksi (Tanpa Filter)';
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(filterLabel, margin, y);
    y += 6;

    drawLine(y, [203, 213, 225], 0.8); // Pembatas utama (slate-300)
    y += 10;

    // --- SEKSI 1: KARTU METRIK SUMMARY REVENUE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('SUMMARY KINERJA KEUANGAN', margin, y);
    y += 6;

    // Menghitung Grid 4 Kartu
    const gap = 4;
    const cardWidth = (contentWidth - (3 * gap)) / 4; // 180 - 12 = 168 / 4 = 42
    const cardHeight = 22;

    const cardsData = [
      { label: 'OMSET KOTOR', val: formatIDR(metrics.totalRevenue), sub: 'Total penerimaan kotor', color: [79, 70, 229] }, // indigo Accent
      { label: 'COST / HPP', val: formatIDR(metrics.totalCoGS), sub: 'Modal harga beli sediaan', color: [225, 29, 72] }, // rose Accent
      { label: 'LABA BERSIH', val: formatIDR(metrics.netProfit), sub: 'Selisih Omset & Modal', color: [13, 148, 136] }, // teal Accent
      { label: 'RATA-RATA NOTA', val: formatIDR(metrics.averageOrder), sub: 'Nilai per belanja nota', color: [100, 116, 139] } // slate Accent
    ];

    cardsData.forEach((card, idx) => {
      const xPos = margin + idx * (cardWidth + gap);
      
      // Latar belakang abu-abu terang (slate-50)
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(xPos, y, cardWidth, cardHeight, 1.5, 1.5, 'F');
      
      // Indikator garis aksen vertikal di tepi kiri setiap kartu
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.rect(xPos, y, 1.2, cardHeight, 'F');
      
      // Label Kartu
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(card.label, xPos + 3.5, y + 5);

      // Nilai Finansial
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(card.val, xPos + 3.5, y + 11.5);

      // Keterangan Sub
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(card.sub, xPos + 3.5, y + 17.5);
    });

    y += cardHeight + 8;

    // --- BREAKDOWN METODE PEMBAYARAN ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('BREAKDOWN METODE PEMBAYARAN', margin, y);
    y += 5;

    const paymentsList = [
      { label: 'TUNAI', sum: paymentMetrics.sums.TUNAI, pct: paymentMetrics.percents.TUNAI, count: paymentMetrics.counts.TUNAI },
      { label: 'QRIS', sum: paymentMetrics.sums.QRIS, pct: paymentMetrics.percents.QRIS, count: paymentMetrics.counts.QRIS },
      { label: 'TRANSFER', sum: paymentMetrics.sums.TRANSFER, pct: paymentMetrics.percents.TRANSFER, count: paymentMetrics.counts.TRANSFER },
      { label: 'DEBIT', sum: paymentMetrics.sums.DEBIT, pct: paymentMetrics.percents.DEBIT, count: paymentMetrics.counts.DEBIT }
    ];

    const pWidth = contentWidth / 4;
    paymentsList.forEach((p, idx) => {
      const xPos = margin + (idx * pWidth);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`${p.label} (${p.count}x)`, xPos, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${formatIDR(p.sum)} (${p.pct}%)`, xPos, y + 4);
    });

    y += 10;
    drawLine(y, [241, 245, 249], 0.5); // Divider line slate-100
    y += 8;

    // --- SEKSI 2: DAFTAR HISTORI TRANSAKSI ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(`HISTORI BUKU KAS TRANSAKSI (${filteredTransactions.length} Rekaman)`, margin, y);
    y += 6;

    // Parameter Kolom Tabel
    const cols = [
      { name: 'No. Invoice', width: 28 },
      { name: 'Tanggal & Waktu', width: 34 },
      { name: 'Kasir', width: 22 },
      { name: 'Pembayaran', width: 22 },
      { name: 'Barang Terjual (Detail)', width: 50 },
      { name: 'Total Nota', width: 24 }
    ];

    // Baris Header Tabel
    doc.setFillColor(30, 41, 59); // Slate-800 background
    doc.rect(margin, y, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255); // putih
    let curX = margin;
    cols.forEach(col => {
      const align = col.name === 'Total Nota' ? 'right' : 'left';
      const offset = align === 'right' ? col.width - 2 : 2;
      doc.text(col.name, curX + offset, y + 4.5, { align });
      curX += col.width;
    });

    y += 7;

    // Fungsi utilitas membatasi panjang teks
    const limitText = (str: string, limit: number) => {
      if (str.length > limit) {
        return str.substring(0, limit - 3) + '...';
      }
      return str;
    };

    // Menggambar data baris demi baris kronologis
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    if (filteredTransactions.length === 0) {
      checkPageBreak(12);
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, contentWidth, 10, 'F');
      doc.setTextColor(148, 163, 184);
      doc.text('Tidak ada data transaksi yang sesuai dengan kriteria filter saat ini.', margin + 2, y + 6);
      y += 10;
    } else {
      filteredTransactions.forEach((tx, rowIdx) => {
        // Cek space halaman
        checkPageBreak(8);

        // Selang-seling warna baris (zebra striping)
        if (rowIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(margin, y, contentWidth, 7.5, 'F');
        }

        // Garis batas tipis bawah baris
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(margin, y + 7.5, margin + contentWidth, y + 7.5);

        // Memformat variabel baris
        const invNum = tx.invoiceNumber;
        const formattedDate = new Date(tx.timestamp).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const cashierName = limitText(tx.cashierName, 12);
        const payMethod = tx.paymentMethod;
        const itemsListStr = tx.items.map(it => `${it.name} (${it.quantity}x)`).join(', ');
        const displayItems = tx.notes ? `${itemsListStr} [Memo: ${tx.notes}]` : itemsListStr;
        const truncatedItems = limitText(displayItems, 38);
        const formattedTotal = formatIDR(tx.total);

        // Render cell teks
        doc.setTextColor(15, 23, 42); // slate-900
        let rowX = margin;
        
        // No Invoice
        doc.text(invNum, rowX + 2, y + 5);
        rowX += cols[0].width;

        // Tanggal
        doc.text(formattedDate, rowX + 2, y + 5);
        rowX += cols[1].width;

        // Kasir
        doc.text(cashierName, rowX + 2, y + 5);
        rowX += cols[2].width;

        // Metode Bayar
        doc.setFont('helvetica', 'bold');
        if (payMethod === 'TUNAI') doc.setTextColor(5, 150, 105);
        else if (payMethod === 'QRIS') doc.setTextColor(6, 182, 212);
        else if (payMethod === 'TRANSFER') doc.setTextColor(79, 70, 229);
        else doc.setTextColor(147, 51, 234);

        doc.text(payMethod, rowX + 2, y + 5);
        rowX += cols[3].width;

        // Detail Barang
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(truncatedItems, rowX + 2, y + 5);
        rowX += cols[4].width;

        // Total Tagihan
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formattedTotal, rowX + cols[5].width - 2, y + 5, { align: 'right' });

        y += 7.5;
      });
    }

    // Baris Ringkasan Tambahan di akhir tabel
    if (filteredTransactions.length > 0) {
      checkPageBreak(10);
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(margin, y, contentWidth, 8, 'F');
      
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.line(margin, y, margin + contentWidth, y);
      doc.line(margin, y + 8, margin + contentWidth, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text('TOTAL REVENUE KESELURUHAN (SARINGAN):', margin + 2, y + 5.2);

      const filteredTotalSum = filteredTransactions.reduce((acc, current) => acc + current.total, 0);
      doc.text(formatIDR(filteredTotalSum), margin + contentWidth - 2, y + 5.2, { align: 'right' });
      y += 15;
    }

    // Disklaimer kaki
    checkPageBreak(12);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('* Dokumen Laporan Keuangan POS ini dihasilkan secara otomatis dan sah sebagai bukti rekap sediaan merchant.', margin, y);
    doc.text('* Mohon simpan dokumen PDF ini di tempat yang aman untuk pelaporan pajak & operasional bulanan toko Anda.', margin, y + 3.5);

    // Iterasi kembali untuk melukis total nomor halaman secara akurat di footer halaman
    const pagesCount = doc.getNumberOfPages();
    for (let i = 1; i <= pagesCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Toko Sediaan & POS Kasir - Halaman ${i} dari ${pagesCount}`, pageWidth - margin, pageHeight - margin + 5, { align: 'right' });
    }

    // Melakukan penyimpanan otomatis di browser pengguna
    const filename = `Laporan_POS_Merchant_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  const toggleExpandTxResult = (txId: string) => {
    setExpandedTxId(expandedTxId === txId ? null : txId);
  };

  return (
    <div className="space-y-6" id="reports-view-root">
      
      {/* 4 Cards Financial Reports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="reports-finance-grid">
        
        {/* Card 1: Gross Sales */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-xs flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Omset Kotor</span>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 font-mono tracking-tight">{formatIDR(metrics.totalRevenue)}</h3>
            <p className="text-[10px] text-slate-400">Total penerimaan dari pembayaran.</p>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 text-indigo-600 rounded">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Cost of goods sold (HPP) */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-xs flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Cost / HPP</span>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 font-mono tracking-tight">{formatIDR(metrics.totalCoGS)}</h3>
            <p className="text-[10px] text-rose-600 font-medium">Harga beli modal sediaan.</p>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 text-rose-600 rounded">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Net Profit */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-xs flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Laba Bersih</span>
            <h3 className="text-lg md:text-xl font-bold text-indigo-600 font-mono tracking-tight">{formatIDR(metrics.netProfit)}</h3>
            <p className="text-[10px] text-indigo-605 font-medium">Laba setelah dikurangi HPP.</p>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 text-indigo-600 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Average Order */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-xs flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Rata-Rata Nota</span>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 font-mono tracking-tight">{formatIDR(metrics.averageOrder)}</h3>
            <p className="text-[10px] text-slate-400">Rata belanja per pembeli pos.</p>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 text-indigo-600 rounded">
            <FileText className="w-4 h-4" />
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="reports-analytics-panel">
        
        {/* Left 2 Cols: Transaction Histori */}
        <div className="lg:col-span-2 space-y-4" id="ledger-book">
          
          <div className="bg-white border border-slate-200 rounded p-5 shadow-xs" id="ledger-table-card">
            
            {/* Table headers */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4" id="ledger-tab-head">
              <div>
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Buku Kas & Histori Nota
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Seluruh laporan transaksi tersimpan secara kronologis.</p>
              </div>

              <div className="flex items-center gap-2" id="ledger-actions">
                <button
                  onClick={() => setShowDailySummary(true)}
                  className="bg-slate-850 hover:bg-slate-900 border border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-755 text-white font-bold text-xs px-3.5 py-1.8 rounded shadow-xs transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider h-9"
                  title="Daily Shift Handover Report"
                  id="btn-daily-summary"
                >
                  <ClipboardList className="w-4 h-4 text-emerald-450" />
                  Ringkasan Harian & Handover
                </button>
                <button
                  onClick={handleExportPDF}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.8 rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 uppercase tracking-wider h-9"
                  title="PDF Export"
                  id="btn-export-pdf"
                >
                  <Download className="w-4 h-4" />
                  Export PDF Saringan
                </button>
              </div>
            </div>

            {/* Premium Multi-Filter & Search Bar Panel */}
            <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-4 font-sans" id="reports-filter-panel">
              {/* Row 1: Search and Payment Method */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Search Term Input */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Pencarian Kata Kunci</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input 
                      type="text"
                      placeholder="Cari No. Invoice, barang, kasir, memo..."
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-250 bg-white rounded text-xs focus:outline-none focus:border-indigo-600 font-sans shadow-2xs h-8.5"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Metode Pembayaran</label>
                  <select 
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-250 rounded text-xs focus:outline-none focus:border-indigo-600 cursor-pointer shadow-2xs h-8.5"
                  >
                    <option value="Semua">Semua Metode</option>
                    <option value="TUNAI">TUNAI</option>
                    <option value="QRIS">QRIS</option>
                    <option value="TRANSFER">TRANSFER</option>
                    <option value="DEBIT">DEBIT</option>
                  </select>
                </div>

                {/* Selected Count / Active Indicators */}
                <div className="flex flex-col justify-end items-start md:items-end p-2 rounded bg-indigo-50/40 border border-indigo-100/50">
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold">Hasil Filter</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm font-bold text-indigo-700 font-mono">{filteredTransactions.length}</span>
                    <span className="text-[10px] text-slate-400">dari {transactions.length} nota</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Date-Range Saringan */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-200/75">
                {/* Start Date */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-500" />
                    Tanggal Mulai
                  </label>
                  <input 
                    type="date"
                    className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs focus:outline-none focus:border-indigo-600 font-mono shadow-2xs h-8.5 cursor-pointer text-slate-700"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-500" />
                    Tanggal Akhir
                  </label>
                  <input 
                    type="date"
                    className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs focus:outline-none focus:border-indigo-600 font-mono shadow-2xs h-8.5 cursor-pointer text-slate-700"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Quick Date Buttons Shortcuts */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Pilih Pintasan Periode</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        setStartDate(todayStr);
                        setEndDate(todayStr);
                      }}
                      className={`py-2 rounded text-[10px] font-bold transition-all border text-center cursor-pointer ${
                        startDate === new Date().toISOString().slice(0, 10) && endDate === new Date().toISOString().slice(0, 10)
                          ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const start = new Date();
                        start.setDate(today.getDate() - 6);
                        setStartDate(start.toISOString().slice(0, 10));
                        setEndDate(today.toISOString().slice(0, 10));
                      }}
                      className={`py-2 rounded text-[10px] font-bold transition-all border text-center cursor-pointer ${
                        startDate === new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().slice(0, 10) && endDate === new Date().toISOString().slice(0, 10)
                          ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const start = new Date(today.getFullYear(), today.getMonth(), 1);
                        setStartDate(start.toISOString().slice(0, 10));
                        setEndDate(today.toISOString().slice(0, 10));
                      }}
                      className={`py-2 rounded text-[10px] font-bold transition-all border text-center cursor-pointer ${
                        startDate === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10) && endDate === new Date().toISOString().slice(0, 10)
                          ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset filter action banner */}
              {(searchTerm || paymentFilter !== 'Semua' || startDate || endDate) && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-150 p-2.5 rounded text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 text-indigo-750">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span className="font-bold text-[9.5px] uppercase font-mono block">Saringan Aktif:</span>
                    <span className="text-slate-600 font-medium">
                      {[
                        searchTerm && `kata "${searchTerm}"`,
                        paymentFilter !== 'Semua' && `metode ${paymentFilter}`,
                        (startDate || endDate) && `periode ${startDate || 'awal'} s/d ${endDate || 'akhir'}`
                      ].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setPaymentFilter('Semua');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer text-[10px] uppercase tracking-wider bg-white border border-rose-200 hover:border-rose-300 rounded px-2.5 py-1 transition-all"
                  >
                    Reset Filter
                  </button>
                </div>
              )}
            </div>

            {/* Invoices list */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-slate-400" id="empty-ledger">
                <FileText className="w-12 h-12 text-slate-350 mx-auto mb-2" />
                <p className="font-bold text-slate-550">Buku kas kosong</p>
                <p className="text-xs text-slate-400 mt-1 font-sans">Belum ada nota transaksi terdaftar dengan kriteria ini.</p>
              </div>
            ) : (
              <div className="space-y-3" id="ledger-cards-scroller">
                {filteredTransactions.slice().reverse().map((tx) => {
                  const isExpanded = expandedTxId === tx.id;
                  const itemQuantityTotal = tx.items.reduce((s, i) => s + i.quantity, 0);

                  return (
                    <div key={tx.id} className="border border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded p-4 transition-all" id={`invoice-ledger-card-${tx.id}`}>
                      {/* Flex header row */}
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpandTxResult(tx.id)}>
                        <div className="space-y-0.5">
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            {tx.invoiceNumber}
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono ${
                              tx.paymentMethod === 'TUNAI' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
                              tx.paymentMethod === 'QRIS' ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                            }`}>
                              {tx.paymentMethod}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans">
                            {new Date(tx.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} • Oleh: {tx.cashierName}
                          </div>
                          {tx.notes && (
                            <div className="text-[10px] text-amber-600 font-medium italic mt-1.5 flex items-center gap-1.5 bg-amber-50/50 border border-amber-200/50 rounded-lg px-2 py-0.5 w-fit" id={`ledger-notes-short-${tx.id}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>Memo: {tx.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono">
                            <span className="font-bold text-sm text-indigo-600 block">{formatIDR(tx.total)}</span>
                            <span className="text-[10px] text-slate-400 block font-mono font-bold uppercase">{itemQuantityTotal} item</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {/* Expandable details matching receipt simulation with Refund support */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 space-y-4 text-xs font-sans" id={`ledger-expansion-${tx.id}`}>
                          {/* Items breakdown list */}
                          <div className="space-y-2">
                            <h5 className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Rincian Barang Terjual:</h5>
                            <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded p-3 space-y-2">
                              {tx.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs pt-1.5 first:pt-0">
                                  <div>
                                    <span className="font-bold text-slate-800 block text-xs">{item.name}</span>
                                    <span className="font-mono text-[10px] text-slate-400">{item.quantity} pcs x {formatIDR(item.sellPrice)}</span>
                                  </div>
                                  <span className="font-bold text-slate-800 text-right font-mono">{formatIDR(item.sellPrice * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Calculations breakdown block */}
                          <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Subtotal:</span>
                              <span className="font-bold text-slate-800">{formatIDR(tx.subtotal)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">PPN 11%:</span>
                              <span className="font-bold text-slate-800">{formatIDR(tx.tax)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Diskon:</span>
                              <span className="font-bold text-rose-600">-{formatIDR(tx.discount)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Total Bill:</span>
                              <span className="font-bold text-indigo-600">{formatIDR(tx.total)}</span>
                            </div>
                          </div>

                          {/* Notes/Instructions Block if exists */}
                          {tx.notes && (
                            <div className="bg-white border border-slate-200 rounded p-3 text-xs" id={`ledger-expansion-notes-${tx.id}`}>
                              <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold font-mono">Catatan Transaksi / Nama Pelanggan:</span>
                              <span className="font-bold text-slate-800 italic block mt-0.5 font-sans whitespace-pre-wrap break-all">{tx.notes}</span>
                            </div>
                          )}

                          {/* Refund transaction triggers (Crucial for real-time stock sync!) */}
                          <div className="flex justify-between items-center bg-rose-50 p-3 rounded border border-rose-250">
                            <div className="space-y-0.5">
                              <span className="text-rose-900 font-bold block text-xs uppercase tracking-wider">Ajukan Pembatalan / Refund</span>
                              <p className="text-[10px] text-rose-600">Pembatalan akan mengembalikan seluruh sediaan stok ({itemQuantityTotal} unit) kembali ke gudang.</p>
                            </div>
                            <button
                              onClick={() => {
                                if (confirm(`⚠️ PERINGATAN: Apakah Anda yakin ingin membatalkan transaksi ${tx.invoiceNumber}?\n\nTindakan ini akan mengembalikan stok barang kedalam inventaris dan menghapus pencatatan omset.`)) {
                                  onCancelTransaction(tx.id);
                                }
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded text-xs shadow transition-all cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                              id={`refund-btn-${tx.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Batalkan Transaksi
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Right 1 Col: Payments distribution */}
        <div className="space-y-6" id="reports-sidebar">
          
          <div className="bg-white border border-slate-200 rounded p-5 shadow-xs" id="payment-mix-ratio">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Proporsi Metode Pembayaran</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">Nilai transaksi real-time per tipe pembayaran.</p>

            <div className="space-y-4" id="distribution-progress-deck">
              
              {/* Tunai */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                    TUNAI ({paymentMetrics.counts.TUNAI}x)
                  </span>
                  <span className="font-mono text-slate-700">{formatIDR(paymentMetrics.sums.TUNAI)} ({paymentMetrics.percents.TUNAI}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded transition-all" style={{ width: `${paymentMetrics.percents.TUNAI}%` }}></div>
                </div>
              </div>

              {/* QRIS */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-500"></span>
                    QRIS ({paymentMetrics.counts.QRIS}x)
                  </span>
                  <span className="font-mono text-slate-700">{formatIDR(paymentMetrics.sums.QRIS)} ({paymentMetrics.percents.QRIS}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded transition-all" style={{ width: `${paymentMetrics.percents.QRIS}%` }}></div>
                </div>
              </div>

              {/* Transfer */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span>
                    TRANSFER ({paymentMetrics.counts.TRANSFER}x)
                  </span>
                  <span className="font-mono text-slate-700">{formatIDR(paymentMetrics.sums.TRANSFER)} ({paymentMetrics.percents.TRANSFER}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded transition-all" style={{ width: `${paymentMetrics.percents.TRANSFER}%` }}></div>
                </div>
              </div>

              {/* Debit */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded bg-purple-500"></span>
                    DEBIT ({paymentMetrics.counts.DEBIT}x)
                  </span>
                  <span className="font-mono text-slate-700">{formatIDR(paymentMetrics.sums.DEBIT)} ({paymentMetrics.percents.DEBIT}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                  <div className="bg-purple-500 h-full rounded transition-all" style={{ width: `${paymentMetrics.percents.DEBIT}%` }}></div>
                </div>
              </div>

            </div>
          </div>

          {/* Quick tips about real-time margin safety */}
          <div className="p-5 bg-amber-50 border border-amber-200 rounded space-y-2 text-xs" id="quick-tips-anchor">
            <h4 className="font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              💡 Tips Manajemen Stok Efisien
            </h4>
            <p className="text-amber-800 leading-relaxed font-sans text-xs">
              Selalu tinjau <strong>buku kas & margin keuntungan</strong> Anda secara berkala. Pastikan margin produk minimal berkisar antara 15% - 30% dari HPP modal asal untuk menjamin biaya operasional merchant terbayarkan secara sehat. 
            </p>
          </div>

        </div>

      </div>

      {/* DAILY SUMMARY & SHIFT HANDOVER MODAL INTERACTION */}
      {showDailySummary && (
        <div className="fixed inset-0 bg-slate-900/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto" id="daily-summary-modal-overlay">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-5xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 animate-fade-in max-h-[92vh] overflow-hidden" id="daily-summary-modal-body">
            
            {/* LEFT SIDE: Config, inputs and metadata editing */}
            <div className="w-full md:w-5/12 p-5 overflow-y-auto space-y-4" id="daily-summary-config-panel">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 font-mono">
                  <ClipboardList className="w-4 h-4 text-emerald-500" />
                  Konfigurasi Handover Shift
                </h3>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                  Harian
                </span>
              </div>

              {/* Day Selection Picker */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono tracking-wider">
                  Tanggal Laporan Sumir
                </label>
                <div className="relative">
                  <input 
                    type="date"
                    required
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                    className="w-full px-3 py-1.8 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded text-xs select-none focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 font-mono text-slate-705 dark:text-slate-200 cursor-pointer shadow-2xs h-9.5"
                  />
                </div>
              </div>

              {/* Cashiers handover identification */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono tracking-wider">
                    Kasir Aktif (Menyerahkan)
                  </label>
                  <input 
                    type="text"
                    value={handoverCashier}
                    onChange={(e) => setHandoverCashier(e.target.value)}
                    placeholder="Nama Kasir Utama"
                    className="w-full px-3 py-1.8 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 font-sans shadow-2xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono tracking-wider">
                    Kasir Penerima (Menerima)
                  </label>
                  <input 
                    type="text"
                    value={nextShiftCashier}
                    onChange={(e) => setNextShiftCashier(e.target.value)}
                    placeholder="Nama Kasir Pengganti"
                    className="w-full px-3 py-1.8 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 font-sans shadow-2xs"
                  />
                </div>
              </div>

              {/* Physical Cash Counting reconciliation */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded border border-slate-200 dark:border-slate-850 space-y-3">
                <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 font-mono tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  Rekonsiliasi Kas Laci Fisik
                </span>
                
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-mono">Tunai Tercatat Sistem</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {formatIDR(dailySummaryData.payments.TUNAI)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block font-mono tracking-wide">
                    Kas Fisik Terhitung di Laci (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold font-mono">RP</span>
                    <input 
                      type="number"
                      required
                      placeholder="Contoh: 350000"
                      value={physicalCashInput}
                      onChange={(e) => setPhysicalCashInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 rounded text-xs font-mono font-bold focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Variance computed live output */}
                {physicalCashInput !== '' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono flex justify-between items-center">
                    <span className="text-slate-400 font-mono uppercase tracking-wide">Selisih Kas Laci:</span>
                    {(() => {
                      const phy = parseFloat(physicalCashInput) || 0;
                      const sys = dailySummaryData.payments.TUNAI;
                      const dev = phy - sys;
                      if (dev === 0) {
                        return <span className="text-emerald-600 dark:text-emerald-400 font-bold">PAS / BALANCE ✅</span>;
                      } else if (dev > 0) {
                        return <span className="text-blue-600 dark:text-blue-450 font-bold">SURPLUS: +{formatIDR(dev)} 📈</span>;
                      } else {
                        return <span className="text-rose-600 dark:text-rose-450 font-bold">MINUS: {formatIDR(dev)} ⚠️</span>;
                      }
                    })()}
                  </div>
                )}
              </div>

              {/* Handover comments / memo */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono tracking-wider">
                  Memo / Catatan Tambahan Serah Terima
                </label>
                <textarea 
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Isi memo singkat terkait sediaan atau kas laci..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-805 rounded text-xs focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 font-sans shadow-2xs resize-none"
                />
              </div>

              {/* CTAs and metadata actions */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 font-mono">
                <button
                  type="button"
                  onClick={() => setShowDailySummary(false)}
                  className="text-slate-450 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-850 font-bold text-[10px] px-3.5 py-2 rounded uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-650 dark:hover:bg-indigo-750 text-white font-bold text-[11px] px-5 py-2 rounded shadow transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                >
                  <Printer className="w-4 h-4 text-amber-350" />
                  Cetak Summary (Print)
                </button>
              </div>
            </div>

            {/* RIGHT SIDE: Real Pristine Minimalist Handover Receipt Slip Preview */}
            <div className="w-full md:w-7/12 p-5 bg-slate-100 dark:bg-slate-950 flex justify-center items-start overflow-y-auto max-h-full" id="daily-summary-receipt-preview-area">
              
              {/* Receipt Wrapper (Mirror of real paper layout) */}
              <div 
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded shadow-md p-6 max-w-md w-full space-y-5 flex flex-col font-mono text-xs text-black dark:text-black [color:black_!important] [background-color:white_!important]" 
                id="daily-summary-print-container"
              >
                {/* Header branding */}
                <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider font-mono">
                    KASIRPINTAR PRO
                  </h4>
                  <p className="text-[10px] tracking-wide uppercase font-mono">
                    DAILY SUMMARY & SHIFT HANDOVER SLIP
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    ---------------------------------------------
                  </p>
                  <div className="text-[10px] text-left space-y-0.5 mt-2 flex flex-col pl-1 font-mono">
                    <div className="flex justify-between">
                      <span className="font-bold">HARI/TANGGAL:</span>
                      <span className="font-mono">{new Date(handoverDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>WAKTU CETAK:</span>
                      <span>{new Date().toLocaleString('id-ID')} WIB</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>SHIFT MENYERAHKAN:</span>
                      <span>{handoverCashier.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>SHIFT MENERIMA:</span>
                      <span>{nextShiftCashier.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TOTAL NOTA:</span>
                      <span>{dailySummaryData.orderCount} Nota Terbit</span>
                    </div>
                  </div>
                </div>

                {/* Sales Totals block */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between text-xs font-bold font-mono">
                    <span>TOTAL REVENUE (OMSET):</span>
                    <span>{formatIDR(dailySummaryData.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono pl-2 border-l border-slate-200">
                    <span>Volume Item Terjual:</span>
                    <span>{dailySummaryData.itemVolume} PCS</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono text-center">
                    - - - - - PERINCIAN PEMBAYARAN - - - - -
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] pl-2 font-mono">
                    <div className="flex justify-between">
                      <span>TUNAI:</span>
                      <span>{formatIDR(dailySummaryData.payments.TUNAI)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>QRIS:</span>
                      <span>{formatIDR(dailySummaryData.payments.QRIS)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TRANSFER:</span>
                      <span>{formatIDR(dailySummaryData.payments.TRANSFER)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DEBIT:</span>
                      <span>{formatIDR(dailySummaryData.payments.DEBIT)}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Drawer Reconciliation Report */}
                <div className="border-t border-dashed border-slate-300 pt-3 space-y-1 font-mono">
                  <div className="font-bold text-[10px] text-slate-500 tracking-wider font-mono uppercase">
                    REKONSILIASI KAS LACI:
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span>Sistem Tunai Tercatat:</span>
                    <span>{formatIDR(dailySummaryData.payments.TUNAI)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span>Kas Laci Fisik Terhitung:</span>
                    <span>{physicalCashInput !== '' ? formatIDR(parseFloat(physicalCashInput) || 0) : 'Rp 0'}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold font-mono border-t border-slate-100 pt-1">
                    <span>Selisih Kas (Variance):</span>
                    {(() => {
                      const phy = parseFloat(physicalCashInput) || 0;
                      const sys = dailySummaryData.payments.TUNAI;
                      const dev = phy - sys;
                      if (physicalCashInput === '') {
                        return <span className="font-mono">Belum Diisi</span>;
                      }
                      if (dev === 0) return <span>PAS (Rp 0)</span>;
                      return <span>{dev > 0 ? `+${formatIDR(dev)}` : `-${formatIDR(Math.abs(dev))}`}</span>;
                    })()}
                  </div>
                </div>

                {/* Top Selling Products minimal table */}
                <div className="border-t border-dashed border-slate-300 pt-3 space-y-1.5 font-mono">
                  <div className="font-bold text-[10px] text-slate-500 tracking-wider font-mono uppercase flex justify-between">
                    <span>DAFTAR PRODUK ADI PENJUALAN:</span>
                    <span>QTY / SUB</span>
                  </div>
                  {dailySummaryData.topProducts.length === 0 ? (
                    <div className="text-center py-2 text-[11px] text-slate-400 italic font-mono">
                      Belum ada penjualan di tanggal ini.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 font-mono">
                      {dailySummaryData.topProducts.slice(0, 8).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start text-[10.5px] py-1 font-mono">
                          <span className="truncate pr-4 font-mono">
                            {idx + 1}. {it.name.toUpperCase()}
                          </span>
                          <span className="font-bold whitespace-nowrap font-mono">
                            {it.qty}x / {formatIDR(it.subtotal)}
                          </span>
                        </div>
                      ))}
                      {dailySummaryData.topProducts.length > 8 && (
                        <div className="text-center pt-1.5 text-[9px] text-slate-400 font-mono italic">
                          dan {dailySummaryData.topProducts.length - 8} produk lainnya...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Handover briefing note */}
                <div className="border-t border-dashed border-slate-300 pt-3 space-y-1 font-mono">
                  <div className="font-bold text-[10px] text-slate-500 tracking-wider font-mono uppercase">
                    CATATAN DAN MEMO HANDOVER:
                  </div>
                  <p className="text-[10.5px] leading-relaxed italic font-sans break-words bg-slate-50 p-2 rounded border border-slate-150">
                    {handoverNotes || "Tidak ada catatan serah terima tambahan."}
                  </p>
                </div>

                {/* Signatures verification line */}
                <div className="border-t border-dashed border-slate-300 pt-6 font-mono">
                  <div className="flex justify-between text-[11px] text-center font-mono mt-1">
                    <div className="w-[140px] space-y-10 font-mono">
                      <span>Menyerahkan (Cashier),</span>
                      <div className="block border-b border-black w-28 mx-auto font-mono mt-8"></div>
                      <span className="font-bold uppercase font-mono text-[10px] block">
                        {handoverCashier || 'Kasir Aktif'}
                      </span>
                    </div>
                    <div className="w-[140px] space-y-10 font-mono">
                      <span>Menerima,</span>
                      <div className="block border-b border-black w-28 mx-auto font-mono mt-8"></div>
                      <span className="font-bold uppercase font-mono text-[10px] block">
                        {nextShiftCashier || 'Kasir Pengganti'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[8.5px] text-slate-400 font-mono pt-4 whitespace-nowrap overflow-hidden">
                  ================ END OF HANDOVER LAPORAN ================
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
