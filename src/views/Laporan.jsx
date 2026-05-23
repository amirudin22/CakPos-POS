import React, { useState } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { TrendingUp, ShoppingCart, DollarSign, ArrowDownRight, Award, Plus, Trash2, X } from 'lucide-react';
import { formatRupiah, formatDate } from '../utils/format';

/**
 * Halaman Dashboard Laporan & Catatan Pengeluaran Kas Kecil (Fase 6)
 * Menampilkan Omzet, Modal (HPP), Pengeluaran, Laba Bersih, dan Produk Terlaris
 */
export default function Laporan() {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Operasional');

  // Live Query seluruh transaksi (orders) dan pengeluaran (expenses)
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.orderBy('createdAt').reverse().toArray()) || [];

  // 1. HITUNG OMZET (Total Penjualan)
  const totalOmzet = orders.reduce((acc, order) => acc + order.totalAmount, 0);

  // 2. HITUNG HPP (Total Modal Produk Terjual)
  const totalHPP = orders.reduce((acc, order) => {
    const orderHPP = order.items.reduce((itemAcc, item) => {
      // HPP default ke harga jual jika tidak diisi
      const itemCost = item.costPrice || item.sellingPrice;
      return itemAcc + (itemCost * item.qty);
    }, 0);
    return acc + orderHPP;
  }, 0);

  // 3. HITUNG TOTAL PENGELUARAN KAS KECIL
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  // 4. HITUNG LABA BERSIH AKTUAL
  const netProfit = totalOmzet - totalHPP - totalExpenses;

  // LOGIKA TAMBAH PENGELUARAN
  const handleAddExpense = async (e) => {
    e.preventDefault();
    const amount = parseInt(expenseAmount);
    if (isNaN(amount) || amount <= 0 || !expenseDesc) {
      alert('Harap isi nominal pengeluaran dan deskripsi dengan benar!');
      return;
    }

    try {
      await db.expenses.add({
        amount,
        description: expenseDesc,
        category: expenseCategory,
        createdAt: new Date()
      });
      setExpenseAmount('');
      setExpenseDesc('');
      setShowExpenseModal(false);
    } catch (err) {
      alert('Gagal mencatat pengeluaran.');
    }
  };

  // HAPUS PENGELUARAN
  const handleDeleteExpense = async (id) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?')) {
      try {
        await db.expenses.delete(id);
      } catch (err) {
        alert('Gagal menghapus data.');
      }
    }
  };

  // 5. HITUNG PRODUK TERLARIS (Top 5 Best Sellers)
  const getBestSellers = () => {
    const productSales = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.name]) {
          productSales[item.name] = { qty: 0, revenue: 0 };
        }
        productSales[item.name].qty += item.qty;
        productSales[item.name].revenue += (item.sellingPrice * item.qty);
      });
    });

    return Object.keys(productSales)
      .map(name => ({
        name,
        qty: productSales[name].qty,
        revenue: productSales[name].revenue
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  };

  const bestSellers = getBestSellers();

  return (
    <div className="main-content">
      
      {/* HEADER HALAMAN */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Laporan Keuangan</h1>
          <p className="page-subtitle">Rangkuman performa penjualan toko dan laba rugi bersih</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowExpenseModal(true)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          <Plus size={18} />
          <span>Catat Pengeluaran</span>
        </button>
      </div>

      {/* DASHBOARD WIDGETS GRID (METRIK KEUANGAN) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1.5rem' }}>
        
        {/* WIDGET 1: TOTAL PENJUALAN / OMZET */}
        <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <TrendingUp size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Total Omzet</span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px', color: 'var(--accent-color)' }}>
            {formatRupiah(totalOmzet)}
          </h3>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {orders.length} Transaksi Selesai
          </span>
        </div>

        {/* WIDGET 2: TOTAL MODAL / HPP */}
        <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <ShoppingCart size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Modal Produk (HPP)</span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px' }}>
            {formatRupiah(totalHPP)}
          </h3>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Investasi Pokok Barang
          </span>
        </div>

        {/* WIDGET 3: TOTAL PENGELUARAN KAS KECIL */}
        <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <ArrowDownRight size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Total Pengeluaran</span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px', color: 'var(--danger)' }}>
            {formatRupiah(totalExpenses)}
          </h3>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {expenses.length} Catatan Biaya Toko
          </span>
        </div>

        {/* WIDGET 4: LABA BERSIH (HIGHLIGHT UTAMA) */}
        <div className="glass-card" style={{ 
          padding: '12px 16px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--success-light) 0%, hsla(142, 76%, 36%, 0.02) 100%)',
          border: '1px solid var(--success)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}>
            <DollarSign size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Laba Bersih</span>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: '4px', color: 'var(--success)' }}>
            {formatRupiah(netProfit)}
          </h3>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Uang Bersih Toko
          </span>
        </div>

      </div>

      {/* DUA SEKSI: PRODUK TERLARIS & RIWAYAT PENGELUARAN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        
        {/* SEKSI A: Top 5 Best Sellers */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <Award size={18} className="text-primary" />
            <span>5 Produk Terlaris</span>
          </h3>

          {bestSellers.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>Belum ada produk terjual.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bestSellers.map((item, idx) => (
                <div key={idx} className="flex-between" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8rem' }}>
                  <div>
                    <strong style={{ color: 'var(--accent-color)' }}>#{idx + 1}</strong>
                    <span style={{ marginLeft: '8px', fontWeight: 600 }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700 }}>{item.qty} pcs sold</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                      {formatRupiah(item.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEKSI B: Riwayat Pengeluaran Kas Kecil (NO TABLES - CARD BASED) */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <ArrowDownRight size={18} className="text-primary" />
            <span>Riwayat Pengeluaran</span>
          </h3>

          {expenses.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>Belum ada pengeluaran kas kecil dicatat.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              {expenses.map((exp) => (
                <div key={exp.id} className="flex-between" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8rem', borderLeft: '3px solid var(--danger)' }}>
                  <div>
                    <span style={{ fontWeight: 700, display: 'block' }}>{exp.description}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {formatDate(exp.createdAt)} • <span style={{ textTransform: 'capitalize' }}>{exp.category}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--danger)' }}>-{formatRupiah(exp.amount)}</strong>
                    <button 
                      onClick={() => handleDeleteExpense(exp.id)} 
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* MODAL INPUT PENGELUARAN KAS KECIL */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ padding: '1.25rem' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Catat Pengeluaran Toko</h3>
              <button className="btn btn-secondary" onClick={() => setShowExpenseModal(false)} style={{ padding: '0.3rem', borderRadius: '50%' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddExpense}>
              
              <div className="form-group">
                <label className="form-label">Nominal Pengeluaran (Rupiah)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Contoh: 10000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  style={{ fontSize: '1.1rem', fontWeight: 700 }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi Keperluan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Beli kantong plastik kresek"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kategori Pengeluaran</label>
                <select
                  className="form-input"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                >
                  <option value="Operasional">Operasional Toko</option>
                  <option value="Kebutuhan Mandi">Kebersihan / Iuran</option>
                  <option value="Listrik / Air">Biaya Listrik / Air / Pulsa</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowExpenseModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  Simpan Pengeluaran
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
