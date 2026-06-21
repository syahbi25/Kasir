import React, { useState } from 'react';
import { 
  Ticket, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Percent, 
  Coins, 
  Power, 
  AlertCircle
} from 'lucide-react';
import { Coupon } from '../types';

interface CouponManagementProps {
  coupons: Coupon[];
  onAddCoupon: (coupon: Coupon) => void;
  onUpdateCoupon: (coupon: Coupon) => void;
  onDeleteCoupon: (id: string) => void;
}

export default function CouponManagement({
  coupons,
  onAddCoupon,
  onUpdateCoupon,
  onDeleteCoupon
}: CouponManagementProps) {
  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [formValue, setFormValue] = useState<number>(10);
  const [formMinPurchase, setFormMinPurchase] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);

  // Helper currency formatting
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Open form for a new coupon
  const handleOpenAdd = () => {
    setEditingCoupon(null);
    setFormCode('');
    setFormType('PERCENTAGE');
    setFormValue(10);
    setFormMinPurchase(0);
    setFormIsActive(true);
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open form for editing
  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code);
    setFormType(coupon.type);
    setFormValue(coupon.value);
    setFormMinPurchase(coupon.minPurchase);
    setFormIsActive(coupon.isActive);
    setFormError(null);
    setIsFormOpen(true);
  };

  // Save/Submit Form
  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = formCode.trim().toUpperCase().replace(/\s+/g, '');

    if (!cleanCode) {
      setFormError('Kode kupon wajib diisi.');
      return;
    }

    if (formValue <= 0) {
      setFormError('Nilai potongan diskon harus lebih besar dari 0.');
      return;
    }

    if (formType === 'PERCENTAGE' && formValue > 100) {
      setFormError('Diskon persentase maksimal adalah 100%.');
      return;
    }

    // Check duplicate code
    const isDuplicate = coupons.some(
      c => c.code === cleanCode && c.id !== (editingCoupon?.id || '')
    );
    if (isDuplicate) {
      setFormError(`Kode kupon "${cleanCode}" sudah digunakan. Silakan buat kode unik lain.`);
      return;
    }

    if (editingCoupon) {
      // Edit
      const updated: Coupon = {
        ...editingCoupon,
        code: cleanCode,
        type: formType,
        value: formValue,
        minPurchase: formMinPurchase,
        isActive: formIsActive
      };
      onUpdateCoupon(updated);
    } else {
      // Add
      const newCoupon: Coupon = {
        id: `coupon-${Date.now()}`,
        code: cleanCode,
        type: formType,
        value: formValue,
        minPurchase: formMinPurchase,
        isActive: formIsActive,
        usageCount: 0
      };
      onAddCoupon(newCoupon);
    }

    setIsFormOpen(false);
    setEditingCoupon(null);
  };

  const handleToggleActive = (coupon: Coupon) => {
    onUpdateCoupon({
      ...coupon,
      isActive: !coupon.isActive
    });
  };

  return (
    <div className="space-y-6" id="coupon-management-panel">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-lg shadow-xs" id="coupon-hdr">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 text-indigo-650">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">Kupon & Promo Diskon</h2>
            <p className="text-xs text-slate-500 mt-0.5">Kelola diskon global toko, kupon belanja bertipe persentase atau potongan harga tetap.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2 px-4 rounded text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          id="btn-add-coupon"
        >
          <Plus className="w-4 h-4" />
          Kupon Baru
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT/MAIN CONTAINER: COUPON LIST (2 Cols on large screens) */}
        <div className="lg:col-span-2 space-y-4" id="coupons-listing-zone">
          {coupons.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center flex flex-col items-center justify-center gap-3" id="coupons-empty-state">
              <div className="bg-slate-50 p-4 rounded-full text-slate-300 border border-slate-100">
                <Ticket className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-700 text-sm uppercase tracking-wider">Belum Ada Kupon Terdaftar</h4>
              <p className="text-xs text-slate-450 max-w-sm">
                Klik tombol "Kupon Baru" untuk membuat kupon diskon global belanja yang dapat dimasukkan di halaman Kasir.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="coupons-grid">
              {coupons.map((coupon) => {
                const isPercentage = coupon.type === 'PERCENTAGE';
                
                return (
                  <div 
                    key={coupon.id} 
                    className={`bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all relative flex flex-col justify-between ${
                      coupon.isActive 
                        ? 'border-slate-200/90' 
                        : 'border-slate-200 bg-slate-50/50 opacity-75'
                    }`}
                    id={`coupon-card-${coupon.id}`}
                  >
                    {/* Semi circle ticket punches on the left and right border decoration */}
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-50 border-r border-slate-200 rounded-full z-10"></div>
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-50 border-l border-slate-200 rounded-full z-10"></div>
                    
                    {/* Upper segment */}
                    <div className="p-4 space-y-3.5 flex-grow">
                      <div className="flex items-center justify-between">
                        {/* Coupon Code badge */}
                        <div className="bg-slate-100 border border-slate-300 text-slate-800 font-mono font-bold text-xs px-2.5 py-1 rounded tracking-widest uppercase">
                          {coupon.code}
                        </div>
                        
                        {/* Active toggle indicator badge */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(coupon)}
                          className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded cursor-pointer transition-all flex items-center gap-1 font-sans ${
                            coupon.isActive 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-200 text-slate-500 border border-slate-300'
                          }`}
                          title={coupon.isActive ? "Klik untuk Nonaktifkan" : "Klik untuk Aktifkan"}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${coupon.isActive ? 'bg-emerald-500' : 'bg-slate-450'} inline-block`}></span>
                          {coupon.isActive ? 'AKTIF' : 'MATI'}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase font-mono">Dampak Potongan</span>
                        <h4 className="text-lg font-black text-indigo-900 leading-tight">
                          {isPercentage ? (
                            <span className="flex items-center gap-1">
                              <Percent className="w-5 h-5 text-indigo-600 inline-block shrink-0" />
                              {coupon.value}% Diskon
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Coins className="w-5 h-5 text-indigo-600 inline-block shrink-0" />
                              Potongan {formatIDR(coupon.value)}
                            </span>
                          )}
                        </h4>
                      </div>

                      {/* Ticket stats detail list */}
                      <div className="bg-slate-50 border border-slate-200/60 rounded p-2 text-[10px] space-y-1 font-mono text-slate-600">
                        <div className="flex justify-between items-center">
                          <span>Syarat Belanja Min:</span>
                          <span className="font-extrabold text-slate-800">
                            {coupon.minPurchase > 0 ? formatIDR(coupon.minPurchase) : 'Tanpa Minimum'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Total Penggunaan:</span>
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-150">
                            {coupon.usageCount} x Digunakan
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lower actions segment */}
                    <div className="bg-slate-50/70 border-t border-dashed border-slate-200/80 px-4 py-2.5 flex items-center justify-end gap-2.5 z-20">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(coupon)}
                        className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                        title="Ubah Kupon"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Hapus kupon "${coupon.code}" secara permanen?`)) {
                            onDeleteCoupon(coupon.id);
                          }
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-850 flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
                        title="Hapus Kupon"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: FORM DRAWER AND INSTRUCTIONS (1 Col) */}
        <div className="space-y-6" id="coupons-form-sidebar">
          
          {/* Active input form panel */}
          {isFormOpen ? (
            <div className="bg-white border border-slate-200 shadow-md rounded-lg p-5 space-y-4 animate-fade-in" id="coupon-form-card">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <Ticket className="w-4 h-4 text-indigo-600" />
                  {editingCoupon ? 'Sunting Kupon' : 'Buat Kupon Baru'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded hover:bg-slate-150 cursor-pointer text-slate-400 hover:text-slate-700 transition"
                  title="Tutup Form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-900 text-xs flex gap-2 items-start" id="form-error-toast">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-tight">{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveCoupon} className="space-y-4" id="manage-coupon-form">
                
                {/* Coupon Code input */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-650 uppercase tracking-wider text-[10px] block">Kode Kupon:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: HEMAT10, PROMO20K"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 bg-white text-xs font-mono font-bold uppercase tracking-wider"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                  />
                  <p className="text-[9px] text-slate-400">Kode unik tanpa spasi, otomatis diubah menjadi huruf kapital.</p>
                </div>

                {/* Promo type selectors */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-655 uppercase tracking-wider text-[10px] block">Tipe Diskon:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormType('PERCENTAGE');
                        if (formValue > 100) setFormValue(10);
                      }}
                      className={`py-1.5 px-3 rounded text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                        formType === 'PERCENTAGE'
                          ? 'bg-indigo-600 border-indigo-605 text-white shadow-xs'
                          : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" /> Persentase (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('FLAT')}
                      className={`py-1.5 px-3 rounded text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                        formType === 'FLAT'
                          ? 'bg-indigo-600 border-indigo-605 text-white shadow-xs'
                          : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" /> Nominal (Rp)
                    </button>
                  </div>
                </div>

                {/* Value input (Percentage / Flat Rp amount) */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-650 uppercase tracking-wider text-[10px] block">
                    {formType === 'PERCENTAGE' ? 'Persen Diskon (%):' : 'Jumlah Potongan Harga (Rp):'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-extrabold">
                      {formType === 'PERCENTAGE' ? '%' : 'Rp'}
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      max={formType === 'PERCENTAGE' ? 100 : undefined}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 bg-white text-xs font-mono font-bold"
                      value={formValue || ''}
                      onChange={(e) => setFormValue(Math.max(1, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <p className="text-[9.5px] text-slate-400">
                    {formType === 'PERCENTAGE' 
                      ? 'Diskon bertipe persentase dari total seluruh belanja (maks 100%).' 
                      : 'Diskon nominal dalam rupiah. Contoh: 15000.'}
                  </p>
                </div>

                {/* Minimum purchase prerequisite */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-650 uppercase tracking-wider text-[10px] block">Minimum Belanja Belanja (Rp):</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-extrabold">Rp</span>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded focus:outline-none focus:border-indigo-650 bg-white text-xs font-mono font-bold"
                      value={formMinPurchase || '0'}
                      onChange={(e) => setFormMinPurchase(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <p className="text-[9.5px] text-slate-400">Pasang 0 apabila promo dapat digunakan tanpa syarat batas minimal belanja.</p>
                </div>

                {/* Active check toggle */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-2.5">
                  <input
                    type="checkbox"
                    id="form-is-active"
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                  />
                  <label htmlFor="form-is-active" className="text-xs font-bold text-slate-705 cursor-pointer selection:bg-transparent">
                    Aktifkan Kupon Ini Sekarang
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-2 pt-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="w-1/2 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 font-bold py-2 rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2 rounded text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" /> Simpan
                  </button>
                </div>

              </form>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-slate-100 border border-slate-800 shadow-md rounded-lg p-5 space-y-3.5" id="coupon-hint-card">
              <div className="flex items-center gap-2 pb-2.5 border-b border-white/10">
                <Ticket className="w-4.5 h-4.5 text-indigo-400" />
                <h4 className="font-extrabold text-[11px] uppercase tracking-widest text-slate-100">Panduan Penggunaan Kupon</h4>
              </div>
              
              <ul className="space-y-2.5 text-xs text-indigo-200 list-disc pl-4 font-normal leading-relaxed">
                <li>
                  <strong className="text-white">Dapat Diinput di Kasir POS:</strong> Di sisi kanan laci pembayaran Kasir POS, terdapat opsi memasukkan kode promosi.
                </li>
                <li>
                  <strong className="text-white">Jenis Diskon Fleksibel:</strong> Tentukan presentase (cth: <span className="text-amber-400 font-mono">10%</span>) atau nominal tetap (cth: <span className="text-emerald-400 font-mono">Rp15.000</span>).
                </li>
                <li>
                  <strong className="text-white">Validasi Otomatis:</strong> Kasir POS akan berulang kali mengecek sisa total belanja, status keaktifan kupon, dan batas minimum pembelian.
                </li>
              </ul>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
