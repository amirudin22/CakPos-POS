import React, { useState } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Search, User, Wallet, Phone, Share2, Check, X, Calendar, DollarSign } from 'lucide-react';
import { formatRupiah, formatDate } from '../utils/format';

/**
 * Halaman Buku Piutang / Kasbon Pelanggan (Fase 5)
 * Melacak total kasbon, pembayaran cicilan, status keterlambatan, dan tagihan WhatsApp
 */
export default function Kasbon() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payAmounts, setPayAmounts] = useState({});
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Ambil data pelanggan, kasbon (debts), dan riwayat invoice (orders)
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.toArray()) || [];

  // Filter & cari nama pelanggan yang memiliki kasbon
  const customerDebtsList = customers.map(cust => {
    // Cari semua record hutang milik pelanggan ini
    const custDebts = debts.filter(d => d.customerId === cust.id);
    const totalDebtAmount = custDebts.reduce((acc, d) => acc + (d.amount - d.amountPaid), 0);
    const unpaidCount = custDebts.filter(d => d.status === 'Belum Lunas').length;

    return {
      ...cust,
      totalDebt: totalDebtAmount,
      unpaidCount,
      allDebts: custDebts
    };
  }).filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.phone && c.phone.includes(searchTerm));
    // Hanya tampilkan pelanggan yang memiliki riwayat kasbon/hutang
    return matchesSearch && c.allDebts.length > 0;
  });

  // Hitung total piutang toko yang belum ditagih secara keseluruhan
  const totalOutstandingStoreDebt = debts
    .filter(d => d.status === 'Belum Lunas')
    .reduce((acc, d) => acc + (d.amount - d.amountPaid), 0);

  // Buka detail kasbon per pelanggan
  const handleOpenDetail = (custDebtObj) => {
    setSelectedDebt(custDebtObj);
    setPayAmounts({});
    setShowDetailModal(true);
  };

  // LOGIKA CICILAN / PELUNASAN KASBON (Transaksi Aman)
  const handlePayInstallment = async (debtId) => {
    const amountToPay = parseInt(payAmounts[debtId] || '0');
    if (isNaN(amountToPay) || amountToPay <= 0) {
      alert('Masukkan nominal pembayaran cicilan yang valid!');
      return;
    }

    const debtObj = debts.find(d => d.id === debtId);
    if (!debtObj) return;

    const remainingDebt = debtObj.amount - debtObj.amountPaid;
    if (amountToPay > remainingDebt) {
      alert(`Nominal pembayaran melebihi sisa hutang (${formatRupiah(remainingDebt)})!`);
      return;
    }

    try {
      await db.transaction('rw', [db.debts, db.orders], async () => {
        const newPaidAmount = debtObj.amountPaid + amountToPay;
        const newStatus = newPaidAmount >= debtObj.amount ? 'Lunas' : 'Belum Lunas';

        // 1. Perbarui nilai pembayaran di tabel debts
        await db.debts.update(debtId, {
          amountPaid: newPaidAmount,
          status: newStatus
        });

        // 2. Tambahkan log pembayaran di invoice penjualan terkait jika perlu
        const orderObj = await db.orders.get(debtObj.orderId);
        if (orderObj) {
          await db.orders.update(debtObj.orderId, {
            amountPaid: orderObj.amountPaid + amountToPay
          });
        }
      });

      // Sukses update
      alert('Pembayaran cicilan berhasil dicatat!');
      setPayAmounts({});
      
      // Update data modal terpilih secara dinamis
      const updatedDebts = await db.debts.toArray();
      const custDebts = updatedDebts.filter(d => d.customerId === selectedDebt.id);
      const totalDebtAmount = custDebts.reduce((acc, d) => acc + (d.amount - d.amountPaid), 0);
      const unpaidCount = custDebts.filter(d => d.status === 'Belum Lunas').length;

      setSelectedDebt({
        ...selectedDebt,
        totalDebt: totalDebtAmount,
        unpaidCount,
        allDebts: custDebts
      });

    } catch (err) {
      console.error(err);
      alert('Gagal merekam pembayaran cicilan kasbon.');
    }
  };

  // KIRIM TAGIHAN SOPAN VIA WHATSAPP SHARE
  const handleSendReminder = (debtItem, custName, custPhone) => {
    if (!custPhone) {
      alert('Nomor HP WhatsApp pelanggan tidak terdaftar!');
      return;
    }

    const remaining = debtItem.amount - debtItem.amountPaid;
    const storeProfile = "Toko Kita"; // Nanti disinkronkan dari setting
    
    let text = `Halo Kak *${custName}*,\n\n`;
    text += `Kami dari pihak toko ingin mengonfirmasi catatan kasbon Kakak untuk transaksi tanggal *${formatDate(debtItem.createdAt)}*:\n`;
    text += `Sisa Kasbon: *${formatRupiah(remaining)}*\n`;
    text += `Jatuh Tempo: *${formatDate(debtItem.dueDate)}*\n\n`;
    text += `Pembayaran dapat dilakukan langsung di toko atau transfer. Terima kasih banyak atas kerja samanya! 😊`;

    const encodedText = encodeURIComponent(text);
    const cleaned = custPhone.replace(/[^0-9]/g, '');
    const intlPhone = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
    const waUrl = `https://wa.me/${intlPhone}?text=${encodedText}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="main-content">
      
      {/* HEADER HALAMAN */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Buku Kasbon</h1>
          <p className="page-subtitle">Catatan hutang pelanggan dan pengelolaan cicilan piutang</p>
        </div>
      </div>

      {/* METRIK TOTAL OUTSTANDING DEBT */}
      <div className="glass-panel mb-4" style={{ 
        padding: '1.25rem', 
        background: 'linear-gradient(135deg, var(--danger-light) 0%, hsla(346, 84%, 61%, 0.03) 100%)',
        borderLeft: '4px solid var(--danger)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--danger-light)',
          color: 'var(--danger)'
        }}>
          <Wallet size={24} />
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Piutang Toko di Luar:</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>
            {formatRupiah(totalOutstandingStoreDebt)}
          </h2>
        </div>
      </div>

      {/* PENCARIAN BUKU HUTANG */}
      <div className="glass-panel mb-4" style={{ padding: '0.75rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Cari nama pelanggan kasbon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', paddingTop: '0.6rem', paddingBottom: '0.6rem' }}
          />
        </div>
      </div>

      {/* DAFTAR PELANGGAN KASBON (NO TABLES - MOBILE FIRST CARD BASED LIST) */}
      {customerDebtsList.length === 0 ? (
        <div className="glass-panel text-center" style={{ padding: '3rem 1.5rem', color: 'var(--text-secondary)' }}>
          <BookOpen size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>Tidak ada data kasbon ditemukan</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {customerDebtsList.map(cust => {
            const hasUnpaid = cust.totalDebt > 0;
            return (
              <div 
                key={cust.id} 
                className="glass-card flex-between" 
                onClick={() => handleOpenDetail(cust)}
                style={{ 
                  borderLeft: hasUnpaid ? '4px solid var(--danger)' : '4px solid var(--success)',
                  cursor: 'pointer',
                  padding: '12px 16px'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} className="text-secondary" />
                    <span>{cust.name}</span>
                  </h4>
                  
                  {cust.phone && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Phone size={10} />
                      <span>{cust.phone}</span>
                    </span>
                  )}
                  
                  <span className={`badge ${hasUnpaid ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem', marginTop: '6px' }}>
                    {hasUnpaid ? `${cust.unpaidCount} Kasbon Aktif` : 'Semua Lunas'}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Total Kasbon:</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: hasUnpaid ? 'var(--danger)' : 'var(--success)' }}>
                    {formatRupiah(cust.totalDebt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL RIWAYAT KASBON & CICILAN DETAIL */}
      {showDetailModal && selectedDebt && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Riwayat Kasbon: {selectedDebt.name}</h3>
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)} style={{ padding: '0.3rem', borderRadius: '50%' }}>
                <X size={16} />
              </button>
            </div>

            {/* List Kasbon item */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
              {selectedDebt.allDebts.map((item) => {
                const isPaid = item.status === 'Lunas';
                const remaining = item.amount - item.amountPaid;
                const isOverdue = !isPaid && new Date(item.dueDate + 'T23:59:59') < new Date();
                const invoice = orders.find(o => o.id === item.orderId);

                return (
                  <div key={item.id} className="glass-panel" style={{ padding: '0.85rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                    
                    {/* Badge Status Pojok */}
                    <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                      <span className={`badge ${isPaid ? 'badge-success' : (isOverdue ? 'badge-danger' : 'badge-warning')}`} style={{ fontSize: '0.65rem' }}>
                        {isPaid ? 'Lunas' : (isOverdue ? 'Jatuh Tempo!' : 'Belum Lunas')}
                      </span>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                        Invoice: {invoice ? invoice.invoiceNumber : `ID-${item.orderId}`}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                        Tgl Pinjam: {formatDate(item.createdAt)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: isOverdue ? 600 : 400 }}>
                        <Calendar size={12} />
                        <span>Tempo: {formatDate(item.dueDate)}</span>
                      </span>
                    </div>

                    {/* Informasi Nominal */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Pinjaman:</span>
                        <strong style={{ fontSize: '0.85rem' }}>{formatRupiah(item.amount)}</strong>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Dicicil:</span>
                        <strong style={{ color: 'var(--success)', fontSize: '0.85rem' }}>{formatRupiah(item.amountPaid)}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Sisa Hutang:</span>
                        <strong style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{formatRupiah(remaining)}</strong>
                      </div>
                    </div>

                    {/* Form Cicilan cepat jika belum lunas */}
                    {!isPaid && (
                      <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Nominal Cicil..."
                            value={payAmounts[item.id] || ''}
                            onChange={(e) => setPayAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                            style={{ padding: '0.45rem', fontSize: '0.8rem', flex: 1 }}
                          />
                          <button 
                            type="button" 
                            className="btn btn-primary" 
                            onClick={() => handlePayInstallment(item.id)}
                            style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            <DollarSign size={14} />
                            <span>Bayar</span>
                          </button>
                          
                          {/* Tombol Bagikan WA Tagihan */}
                          {selectedDebt.phone && (
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              onClick={() => handleSendReminder(item, selectedDebt.name, selectedDebt.phone)}
                              style={{ padding: '0.45rem', color: 'var(--success)', borderColor: 'var(--success)' }}
                              title="Kirim Pengingat WhatsApp"
                            >
                              <Share2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowDetailModal(false)}>
              Tutup Riwayat
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
